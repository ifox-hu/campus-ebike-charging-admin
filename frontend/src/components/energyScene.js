
import * as THREE from 'three'

// Adapted from the clear-energy scene selected in the xiangmu design preview.
export function mountEnergyScene(stage,hit,onStatus=()=>{}) {
const root=stage.closest('.energy-login');
let disposed=false,resizeObserver,glowTexture;
function disposeResources(){
 resizeObserver?.disconnect();resizeObserver=null;
 const geometries=new Set(),materials=new Set();
 scene?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 glowTexture?.dispose();glowTexture=null;scene=null;
}
const listeners=[];
function listen(target,type,fn,options){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
const status={set textContent(value){onStatus(value)}};
const settings={motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,accent:'#64f4e2',speed:1};
let time=0,pulseStart=-100,pulsePower=0,renderer,scene,camera,world,coreMaterial,accentMaterial,clockLast=0,frameId,uniforms,tx=0,ty=0,hover=0,pulseCount=0;
let pointerX=0,pointerY=0,suppressPulse=false;

function pulse(){if(matchMedia('(prefers-reduced-motion: reduce)').matches){stage.dataset.pulse=String(++pulseCount);status.textContent='能量核心已响应';return;}pulseStart=performance.now()/1000;pulsePower=1;settings.motion=true;applySettings();stage.dataset.pulse=String(++pulseCount);status.textContent='能量脉冲已激活';}
function applySettings(){root.style.setProperty('--ec-accent',settings.accent);root.classList.toggle('ec-paused',!settings.motion);if(uniforms)uniforms.uColor.value.set(settings.accent);if(accentMaterial)accentMaterial.color.set(settings.accent);}
listen(hit,'click',e=>{if(e.detail===0||!suppressPulse)pulse();});
listen(stage,'pointerenter',()=>{hover=1;stage.dataset.hover='active';});listen(stage,'pointerleave',()=>{hover=0;stage.dataset.hover='idle';});
listen(stage,'pointermove',e=>{const b=stage.getBoundingClientRect();pointerX=(e.clientX-b.left)/b.width*2-1;pointerY=1-(e.clientY-b.top)/b.height*2;});
applySettings();const T=THREE;
try{
renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(3,Math.max(2,devicePixelRatio||1)));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;stage.appendChild(renderer.domElement);
scene=new T.Scene();camera=new T.PerspectiveCamera(38,1,.1,80);camera.position.set(0,.1,7.7);world=new T.Group();world.rotation.set(.1,-.2,-.08);scene.add(world);
// Quaternion rotation keeps the assembly freely rotatable without pole limits.
const viewRotation = world.quaternion.clone();
const turn = new T.Quaternion(), tilt = new T.Quaternion(), axis = new T.Vector3();
const pointers = new Map();
let velocityX=0, velocityY=0, lastMoveAt=0, pinchDistance=0;
let targetZoom=1;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
hit.setAttribute('aria-label','拖拽旋转能量装置，滚轮或双指缩放，点击触发能量反馈；方向键旋转，加减键缩放，Home恢复视角');
function rotateView(dx,dy){
  const length=Math.hypot(dx,dy);if(!length)return;
  axis.set(dy/length,dx/length,0);
  turn.setFromAxisAngle(axis,length);
  viewRotation.premultiply(turn).normalize();
}
function zoomView(value){targetZoom=Math.max(.78,Math.min(1.22,value));}
function saveView(){}
listen(hit,'pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(!pointers.size){suppressPulse=false;velocityX=velocityY=0;}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});
  hit.setPointerCapture(e.pointerId);stage.dataset.dragging='true';
  lastMoveAt=performance.now();
  if(pointers.size>1){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);suppressPulse=true;}
});
listen(hit,'pointermove',e=>{
  const previous=pointers.get(e.pointerId);if(!previous)return;
  const now=performance.now(),dt=Math.max(.008,(now-lastMoveAt)/1000);
  const dx=e.clientX-previous.x,dy=e.clientY-previous.y;
  if(Math.hypot(e.clientX-previous.startX,e.clientY-previous.startY)>5)suppressPulse=true;
  previous.x=e.clientX;previous.y=e.clientY;
  if(pointers.size>1){
    const p=[...pointers.values()],distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
    if(pinchDistance>0)zoomView(targetZoom*distance/pinchDistance);
    pinchDistance=distance;velocityX=velocityY=0;
  }else if(suppressPulse){
    const scale=4.2/Math.min(stage.clientWidth,stage.clientHeight);
    rotateView(dx*scale,dy*scale);
    velocityX=Math.max(-3,Math.min(3,dx*scale/dt));
    velocityY=Math.max(-3,Math.min(3,dy*scale/dt));
  }
  lastMoveAt=now;
});
function releasePointer(e){
  if(!pointers.has(e.pointerId))return;
  pointers.delete(e.pointerId);pinchDistance=0;
  if(hit.hasPointerCapture(e.pointerId))hit.releasePointerCapture(e.pointerId);
  if(e.type==='pointercancel'||performance.now()-lastMoveAt>90||reducedMotion)velocityX=velocityY=0;
  if(e.type==='pointercancel')suppressPulse=true;
  if(!pointers.size){stage.dataset.dragging='false';if(suppressPulse)saveView();}
}
listen(hit,'pointerup',releasePointer);
listen(hit,'pointercancel',releasePointer);
listen(hit,'lostpointercapture',releasePointer);
listen(window,'blur',()=>{pointers.clear();velocityX=velocityY=0;stage.dataset.dragging='false';});
listen(hit,'wheel',e=>{
  e.preventDefault();
  const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1);
  zoomView(targetZoom*Math.exp(-Math.max(-120,Math.min(120,pixels))*.0013));saveView();
},{passive:false});
listen(hit,'keydown',e=>{
  const step=e.shiftKey?.22:.10;
  if(e.key==='ArrowLeft')rotateView(-step,0);
  else if(e.key==='ArrowRight')rotateView(step,0);
  else if(e.key==='ArrowUp')rotateView(0,-step);
  else if(e.key==='ArrowDown')rotateView(0,step);
  else if(e.key==='+'||e.key==='=')zoomView(targetZoom*1.08);
  else if(e.key==='-'||e.key==='_')zoomView(targetZoom/1.08);
  else if(e.key==='Home'){viewRotation.setFromEuler(new T.Euler(.1,-.2,-.08));zoomView(1);}
  else return;
  e.preventDefault();velocityX=velocityY=0;saveView();
});
function updateView(dt){
  if(!pointers.size&&Math.hypot(velocityX,velocityY)>.002){
    rotateView(velocityX*dt,velocityY*dt);
    const damping=Math.exp(-5.8*dt);velocityX*=damping;velocityY*=damping;
    if(Math.hypot(velocityX,velocityY)<=.002)saveView();
  }
  const parallax=pointers.size?0:1;
  tilt.setFromEuler(new T.Euler(ty*parallax,tx*parallax,0));
  turn.copy(viewRotation).premultiply(tilt);
  world.quaternion.slerp(turn,1-Math.exp(-16*dt));
  camera.zoom+=(targetZoom-camera.zoom)*(1-Math.exp(-12*dt));
  camera.updateProjectionMatrix();
  stage.dataset.rotation=world.quaternion.toArray().map(n=>n.toFixed(4)).join(',');
  stage.dataset.zoom=camera.zoom.toFixed(3);
}

scene.add(new T.HemisphereLight(0xc2e9ff,0x142048,2));const key=new T.DirectionalLight(0xc3f7ff,4);key.position.set(-3,4,5);scene.add(key);const rim=new T.PointLight(0x5368ff,70,16);rim.position.set(2,1,-2);scene.add(rim);const cyan=new T.PointLight(0x64ffdd,26,12);cyan.position.set(-2,-1,2);scene.add(cyan);
accentMaterial=new T.MeshBasicMaterial({color:settings.accent,toneMapped:false});const blueMat=new T.MeshBasicMaterial({color:'#758bff',toneMapped:false});const metal=new T.MeshStandardMaterial({color:'#435c73',metalness:.9,roughness:.23});const dark=new T.MeshStandardMaterial({color:'#0c2032',metalness:.86,roughness:.3});
uniforms={uTime:{value:0},uPulse:{value:0},uColor:{value:new T.Color(settings.accent)}};
coreMaterial=new T.ShaderMaterial({uniforms,vertexShader:'varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uTime; uniform float uPulse; void main(){vP=position; vec3 p=position; float d=sin(p.x*6.0+uTime)*sin(p.y*7.0-uTime*.8)*sin(p.z*5.0+uTime*.5); p+=normal*d*(.012+uPulse*.018); vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:'precision highp float; varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uTime; uniform float uPulse; uniform vec3 uColor; void main(){vec3 n=normalize(vN);float fres=pow(1.0-abs(dot(n,normalize(vV))),2.1);float lat=asin(clamp(vP.y,-.999,.999));float lon=atan(vP.z,vP.x);float f=sin(lon*7.0+sin(lat*11.0-uTime)*.7+uTime*.5);float g=sin(lat*18.0+sin(lon*6.0+uTime*.7)*1.1);float fil=pow(max(0.0,1.0-abs(f)*1.5),15.0);float fil2=pow(max(0.0,1.0-abs(g)*1.3),20.0);float weave=fil*.32+fil2*.20;float bands=pow(max(0.0,1.0-abs(sin(lat*38.0+uTime*.3))*1.6),9.0)*.035;float l=max(0.0,dot(n,normalize(vec3(-1.0,1.5,2.0))));vec3 base=mix(vec3(.016,.042,.09),uColor*.23,l);vec3 c=base+uColor*(fres*1.5+weave+bands)*(1.0+uPulse*.8);c+=vec3(.18,.32,.60)*pow(l,18.0);gl_FragColor=vec4(c,1.0);}'});
const core=new T.Mesh(new T.SphereGeometry(.98,128,80),coreMaterial);world.add(core);
const wire=new T.Mesh(new T.IcosahedronGeometry(1.023,3),new T.MeshBasicMaterial({color:'#6ac9d8',wireframe:true,transparent:true,opacity:.035,depthWrite:false}));world.add(wire);

function torus(radius,tube,material,parent,arc=Math.PI*2){const mesh=new T.Mesh(new T.TorusGeometry(radius,tube,12,192,arc),material);parent.add(mesh);return mesh;}
const orbitA=new T.Group();orbitA.rotation.set(.84,-.38,.30);world.add(orbitA);const orbitB=new T.Group();orbitB.rotation.set(1.3,.93,-.5);world.add(orbitB);const orbitC=new T.Group();orbitC.rotation.set(-.40,.64,.64);world.add(orbitC);
function luminous(radius,color,material,parent,arc=Math.PI*2){const bright=torus(radius,.011,material,parent,arc);torus(radius,.030,new T.MeshBasicMaterial({color,transparent:true,opacity:.065,blending:T.AdditiveBlending,depthWrite:false}),parent,arc);return bright;}
luminous(1.44,settings.accent,accentMaterial,orbitA,Math.PI*1.84);luminous(1.73,'#758bff',blueMat,orbitB,Math.PI*1.72);luminous(1.97,'#64baf0',new T.MeshBasicMaterial({color:'#78bfe3',transparent:true,opacity:.76}),orbitC,Math.PI*1.76);
const rail=torus(1.48,.047,metal,orbitA,Math.PI*1.74);rail.rotation.z=.12;const rail2=torus(1.77,.035,dark,orbitB,Math.PI*1.74);rail2.rotation.z=.3;
for(let i=0;i<36;i++){const a=i*Math.PI*2/36;const tick=new T.Mesh(new T.BoxGeometry(i%3===0?.025:.014,i%3===0?.13:.066,.032),i%3===0?accentMaterial:metal);tick.position.set(Math.cos(a)*1.51,Math.sin(a)*1.51,0);tick.rotation.z=a-Math.PI/2;orbitA.add(tick);}
for(let i=0;i<12;i++){const segment=torus(1.89,.052,metal,orbitC,.13);segment.rotation.z=i*Math.PI*2/12;}
const lights=[];for(let i=0;i<6;i++){const bead=new T.Mesh(new T.SphereGeometry(.026,10,8),i%2?blueMat:accentMaterial);const parent=i%2?orbitB:orbitA;parent.add(bead);lights.push({mesh:bead,parent,r:i%2?1.73:1.44,a:i*1.1});}
let seed=2701;function rand(){seed=seed*16807%2147483647;return(seed-1)/2147483646;}
const dustPositions=[],dustColors=[];for(let i=0;i<2100;i++){const a=rand()*Math.PI*2,r=1.25+Math.pow(rand(),2)*1.15;const y=(rand()-.5)*.10;dustPositions.push(Math.cos(a)*r,y,Math.sin(a)*r);const c=new T.Color().setHSL(.47+rand()*.16,.65,.48+rand()*.3);dustColors.push(c.r,c.g,c.b);}
const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.Float32BufferAttribute(dustPositions,3));dustGeo.setAttribute('color',new T.Float32BufferAttribute(dustColors,3));
const dust=new T.Points(dustGeo,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,uniforms:{uScale:{value:renderer.getPixelRatio()}},vertexShader:'uniform float uScale; varying vec3 vColor; void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(17.0/-mv.z,1.0,4.5)*uScale;gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec3 vColor; void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColor,pow(1.0-d*2.0,1.4)*.76);}'}));dust.rotation.set(.36,-.2,-.40);world.add(dust);
const starsPositions=[];for(let i=0;i<450;i++)starsPositions.push((rand()-.5)*18,(rand()-.5)*12,-2-rand()*8);const starsGeo=new T.BufferGeometry();starsGeo.setAttribute('position',new T.Float32BufferAttribute(starsPositions,3));const stars=new T.Points(starsGeo,new T.PointsMaterial({color:'#6a9ec5',size:.015,transparent:true,opacity:.52}));scene.add(stars);
const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;const gctx=glowCanvas.getContext('2d'),gradient=gctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'#c0ffffcc');gradient.addColorStop(.12,'#71ffed77');gradient.addColorStop(.4,'#4bcaff22');gradient.addColorStop(1,'#418aff00');gctx.fillStyle=gradient;gctx.fillRect(0,0,128,128);const glowMap=new T.CanvasTexture(glowCanvas);glowTexture=glowMap;
function sprite(scale,x,y,z,color,opacity){const s=new T.Sprite(new T.SpriteMaterial({map:glowMap,color,transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity}));s.scale.set(scale,scale,1);s.position.set(x,y,z);world.add(s);return s;}
const aura=sprite(5.4,0,0,-.8,0x348bd9,.22);sprite(1.0,-1.3,.6,.5,0x7affdf,.8);sprite(.6,1.25,-.9,.9,0x818eff,.7);sprite(.4,.7,1.4,.6,0x7afaff,.7);
const shockwaves=[];for(let i=0;i<3;i++){const mesh=torus(1,.011,new T.MeshBasicMaterial({color:settings.accent,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}),world);mesh.rotation.set(.15,0,0);shockwaves.push(mesh);}
const streams=[];for(let i=0;i<13;i++){const y=(rand()-.5)*7,z=-1.7-rand()*2;const pts=[new T.Vector3(-8,y-3,z),new T.Vector3(-3,y-1,z+.4),new T.Vector3(2,y+1,z),new T.Vector3(8,y+4,z-.5)];const curve=new T.CatmullRomCurve3(pts);const points=curve.getPoints(40);const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:i%2?'#6594ff':'#4ddfc7',transparent:true,opacity:.055}));scene.add(line);const seed=new T.Mesh(new T.SphereGeometry(.012,5,5),i%2?blueMat:accentMaterial);scene.add(seed);streams.push({mesh:seed,curve,offset:rand()});}
const shards=[];for(let i=0;i<7;i++){const s=new T.Mesh(new T.OctahedronGeometry(.04+rand()*.04),i%2?metal:dark);const a=rand()*Math.PI*2,r=2+rand()*.35;s.position.set(Math.cos(a)*r,Math.sin(a)*r,(rand()-.5));world.add(s);shards.push(s);}
listen(root,'pointermove',e=>{if(e.pointerType==='touch')return;const b=root.getBoundingClientRect();tx=((e.clientX-b.left)/b.width-.5)*.25;ty=((e.clientY-b.top)/b.height-.5)*.18;});listen(root,'pointerleave',()=>{tx=0;ty=0;});
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setPixelRatio(Math.min(3,Math.max(2,devicePixelRatio||1)));renderer.setSize(w,h);dust.material.uniforms.uScale.value=renderer.getPixelRatio();camera.aspect=w/h;camera.updateProjectionMatrix();}const ro=new ResizeObserver(resize);resizeObserver=ro;ro.observe(stage);resize();applySettings();stage.classList.add('ec-ready');
function animate(now){
if(disposed)return;
frameId=requestAnimationFrame(animate);const dt=Math.min((now-clockLast)/1000,.06);clockLast=now;const elapsed=now/1000-pulseStart;
updateView(dt);
if(settings.motion){time+=dt*settings.speed;core.rotation.y=time*.12;wire.rotation.y=-time*.05;
orbitA.rotation.z=.3+time*.13;orbitB.rotation.z=-.5-time*.09;orbitC.rotation.z=.64+time*.045;dust.rotation.y=-.2-time*.05;
lights.forEach((p,i)=>{const a=time*(.4+i*.02)+p.a;p.mesh.position.set(Math.cos(a)*p.r,Math.sin(a)*p.r,0);});streams.forEach(s=>s.mesh.position.copy(s.curve.getPointAt((time*.10+s.offset)%1)));shards.forEach((s,i)=>{s.rotation.x=time*(i+1)*.03;s.rotation.y=time*.1;});uniforms.uTime.value=time;
if(pulsePower){const f=Math.max(0,1-elapsed/4);uniforms.uPulse.value=Math.sin(Math.min(elapsed/1.5,1)*Math.PI)*f;world.scale.setScalar(1+Math.sin(Math.min(elapsed/2,1)*Math.PI)*.035);aura.material.opacity=.22+f*.16;
shockwaves.forEach((r,i)=>{const p=Math.max(0,(elapsed-i*.38)/2.6);r.scale.setScalar(1+p*3.4);r.material.opacity=p>0&&p<1?(1-p)*.35:0;});
if(elapsed>4.2){pulsePower=0;uniforms.uPulse.value=0;status.textContent='能量场已就绪';}}
}
renderer.render(scene,camera);
}
function schedule(){cancelAnimationFrame(frameId);frameId=undefined;if(!disposed&&!document.hidden){clockLast=performance.now();frameId=requestAnimationFrame(animate);}}schedule();listen(document,'visibilitychange',schedule);
}catch(error){disposeResources();renderer?.dispose();renderer?.domElement.remove();stage.classList.remove('ec-ready');status.textContent='能量核心 · 静态演示';}
return ()=>{disposed=true;cancelAnimationFrame(frameId);listeners.forEach(remove=>remove());disposeResources();renderer?.dispose();renderer?.domElement.remove();stage.classList.remove('ec-ready');};
}
