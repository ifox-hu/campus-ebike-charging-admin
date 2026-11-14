// Verify the shared scene, real login contracts and teardown in Pages/connected modes.
const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const output=path.join(__dirname,'artifacts');fs.mkdirSync(output,{recursive:true})
async function sceneChecks(page,label){
 await page.locator('.ec-ready canvas').waitFor({timeout:30000})
 assert.equal(await page.locator('.ec-scene-tools,.fx-motion,.fx-drag').count(),0)
 const hit=page.locator('.ec-core-hit'),stage=page.locator('.ec-stage')
 const rotation=await stage.getAttribute('data-rotation')
 const b=await hit.boundingBox()
 await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.65,b.y+b.height*.6,{steps:10});await page.mouse.up()
 await page.waitForTimeout(150)
 assert.notEqual(await stage.getAttribute('data-rotation'),rotation,'drag changes scene rotation')
 assert.equal(await stage.getAttribute('data-pulse'),null,'drag must not trigger pulse')
 await hit.focus();await page.keyboard.press('Home');await page.keyboard.press('+');await page.waitForTimeout(200)
 assert.ok(Number(await stage.getAttribute('data-zoom'))>1,'keyboard zoom works')
 await page.keyboard.press('Enter');assert.equal(await stage.getAttribute('data-pulse'),'1')
 await page.screenshot({path:path.join(output,`energy-${label}-desktop.png`),fullPage:true})
 for(const width of [736,390,320]){
  await page.setViewportSize({width,height:950});await page.waitForTimeout(100)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`layout fits ${width}px`)
  const panel=await page.locator('.ec-panel-shell').boundingBox(),footer=await page.locator('.ec-footer').boundingBox()
  assert.ok(panel.y+panel.height+8<footer.y,`form clears footer at ${width}px`)
 }
 await page.screenshot({path:path.join(output,`energy-${label}-mobile.png`),fullPage:true})
 await page.setViewportSize({width:1440,height:1000})
}
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
 const errors=[]
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message))
  await page.goto(process.env.ENERGY_PAGES_URL||'http://127.0.0.1:5207/')
  await page.locator('.ec-ready canvas').waitFor({timeout:30000})
  await page.screenshot({path:path.join(output,'energy-pages-initial.png'),fullPage:true})
  await sceneChecks(page,'pages')
  await page.getByRole('button',{name:'填入演示账号',exact:true}).click()
  await page.getByRole('button',{name:'显示密码',exact:true}).click()
  assert.equal(await page.locator('input[autocomplete=current-password]').getAttribute('type'),'text')
  await page.locator('.login-submit').click();await page.locator('.platform').waitFor()
  assert.equal(await page.locator('.energy-login canvas').count(),0)
  await page.getByRole('button',{name:'管理员账号菜单',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click()
  await page.locator('.ec-ready canvas').waitFor()
  assert.equal(await page.locator('.energy-login canvas').count(),1,'return creates exactly one canvas')
  assert.equal(await page.locator('input[autocomplete=current-password]').inputValue(),'')
  await page.close()
  const connected=await browser.newPage({viewport:{width:1440,height:1000}});connected.on('pageerror',e=>errors.push(e.message));const logins=[]
  await connected.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url());let data=[]
   if(url.pathname==='/api/auth/login'){
    const body=request.postDataJSON();logins.push(body)
    if(body.password!=='correct-password')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:401,message:'账号或密码不正确'})})
    data={token:'browser-test-only',role:'ADMIN'}
   }else if(url.pathname==='/api/auth/me')data={id:1,username:'operator-test',displayName:'测试管理员',role:'ADMIN',features:{repairs:false}}
   else if(url.pathname==='/api/auth/users')data={rows:[],total:0,page:1,totalPages:1}
   await route.fulfill({contentType:'application/json',body:JSON.stringify({code:200,data})})
  })
  await connected.goto(process.env.ENERGY_CONNECTED_URL||'http://127.0.0.1:5201/')
  await sceneChecks(connected,'connected')
  await connected.locator('input[autocomplete=username]').fill('operator-test');await connected.locator('input[autocomplete=current-password]').fill('wrong');await connected.locator('.login-submit').click()
  await connected.getByRole('alert').filter({hasText:'账号或密码不正确'}).waitFor()
  await connected.locator('input[autocomplete=current-password]').fill('correct-password');await connected.locator('.login-submit').click();await connected.locator('.platform').waitFor()
  assert.equal(await connected.locator('.energy-login canvas').count(),0)
  assert.deepEqual(logins,[{username:'operator-test',password:'wrong'},{username:'operator-test',password:'correct-password'}])
  if(process.env.ENERGY_ACCOUNT_URL){
   const account=await browser.newPage({viewport:{width:1024,height:950}});account.on('pageerror',e=>errors.push(e.message));let submits=0,retries=0
   await account.route('**/api/**',route=>{if(route.request().url().includes('/auth/login'))submits++;if(route.request().url().includes('/auth/me'))retries++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:503,message:'测试账号服务暂不可用'})})})
   await account.goto(process.env.ENERGY_ACCOUNT_URL)
   await account.getByRole('button',{name:'重试连接账号服务',exact:true}).waitFor()
   await account.locator('input[autocomplete=username]').fill('retry-test');await account.locator('input[autocomplete=current-password]').fill('must-not-submit')
   const before=retries;await account.getByRole('button',{name:'重试连接账号服务',exact:true}).click()
   await account.getByRole('button',{name:'重试连接账号服务',exact:true}).waitFor()
   assert.ok(retries>before,'reconnect retries account read');assert.equal(submits,0,'reconnect never submits credentials')
   await account.close()
  }
  const fallback=await browser.newPage();fallback.on('pageerror',e=>errors.push(e.message))
  await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args)}})
  await fallback.goto(process.env.ENERGY_PAGES_URL||'http://127.0.0.1:5207/')
  await fallback.getByRole('button',{name:'填入演示账号',exact:true}).click();await fallback.locator('.login-submit').click();await fallback.locator('.platform').waitFor()
  assert.equal(await fallback.locator('.energy-login').count(),0,'WebGL absence does not block login')
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({pagesLogin:true,connectedLoginContract:true,invalidPassword:true,remount:true,drag:true,zoom:true,pulse:true,mobileWidths:[736,390,320],errors},null,2))
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
