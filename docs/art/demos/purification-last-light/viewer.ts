import { createHavenMotion, type HavenMotion } from './motion';

interface ArtObject {id:number;key:string;name:string;description:string;modelAsset:string;bounds:{x:number;y:number;width:number;height:number};}
interface RestObject {id:number;key:string;name:string;description:string;bounds:ArtObject['bounds'];focus:[number,number];line:string;}
interface Manifest {stations:ArtObject[];actor:ArtObject;rest?:RestObject;}
type View='scene'|'reference'|'baseline'|number;
function el<T extends HTMLElement>(id:string):T{const n=document.getElementById(id);if(!n)throw new Error(`Missing ${id}`);return n as T;}
const canvas=el<HTMLCanvasElement>('art'),ctx=canvas.getContext('2d')!;
const status=el<HTMLParagraphElement>('status'),description=el<HTMLParagraphElement>('description'),caption=el<HTMLSpanElement>('caption');
const sceneButton=el<HTMLButtonElement>('scene'),referenceButton=el<HTMLButtonElement>('reference'),baselineButton=el<HTMLButtonElement>('baseline'),motionButton=el<HTMLButtonElement>('motion'),coreLightButton=el<HTMLButtonElement>('core-light');
const restButton=el<HTMLButtonElement>('rest-action'),restLine=el<HTMLParagraphElement>('rest-line');
const scene=new Image(),reference=new Image(),baseline=new Image(),ids=new Image(),riftActor=new Image(),seatedScene=new Image();
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),params=new URLSearchParams(location.search);
let manifest:Manifest,view:View='scene',elapsed=Math.max(0,Number(params.get('t'))||0);
let paused=reduced.matches||params.has('still'),lastTime:number|undefined,frame=0,disposed=false;
let coreLighting=true,resting=false,restReady=false,cameraAmount=0;
let cameraTween:{from:number;to:number;started:number}|undefined;
let motion:HavenMotion|undefined,seatedMotion:HavenMotion|undefined,picking:Uint8ClampedArray|undefined;
const buttons=new Map<number,HTMLButtonElement>(),models=new Map<number,HTMLImageElement>();
const load=(image:HTMLImageElement,url:string):Promise<void>=>new Promise((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error(`Unable to load ${url}`));image.src=url;});
const motionView=():boolean=>view==='scene'||view===1;
const activeMotion=():HavenMotion|undefined=>view==='scene'&&resting?seatedMotion:motion;
const clamp=(value:number,lo:number,hi:number):number=>Math.max(lo,Math.min(hi,value));

function updateControls():void{
  const currentMotion=activeMotion();
  canvas.dataset.renderer=currentMotion?'webgl':'static-fallback';
  sceneButton.setAttribute('aria-pressed',String(view==='scene'));referenceButton.setAttribute('aria-pressed',String(view==='reference'));baselineButton.setAttribute('aria-pressed',String(view==='baseline'));
  for(const[id,button]of buttons)button.setAttribute('aria-pressed',String(view===id));
  motionButton.disabled=!motionView()||!currentMotion;motionButton.textContent=paused?'继续景观':'暂停景观';motionButton.setAttribute('aria-pressed',String(!!currentMotion&&!paused&&motionView()));
  coreLightButton.disabled=view!=='scene'||!currentMotion;
  coreLightButton.textContent=currentMotion?`核心照明：${view==='scene'&&!coreLighting?'关':'开'}`:'核心照明 · 静态';
  coreLightButton.setAttribute('aria-pressed',String(view==='scene'&&currentMotion?coreLighting:true));
  coreLightButton.title=currentMotion?'比较核心投向环境的光；关闭时芯体自身仍然发光。':'静态回退中无法单独比较核心照明。';
  restButton.hidden=!manifest.rest||view!=='scene';restButton.disabled=!restReady;
  restButton.textContent=resting?'起身':'坐下';restButton.setAttribute('aria-pressed',String(resting));
  restButton.title=restReady?(resting?'起身，或按 Esc 返回。':`在${manifest.rest?.name??'残墙'}上坐下。`):'休息处尚未载入。';
  canvas.dataset.animation=currentMotion&&!paused&&motionView()&&!document.hidden?'playing':'paused';
  canvas.dataset.coreLighting=view==='scene'&&currentMotion?(coreLighting?'on':'off'):'unavailable';
  canvas.dataset.restState=resting?'seated':'standing';
}

function draw():void{
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#070c0e';ctx.fillRect(0,0,960,640);
  let sceneFrame:CanvasImageSource=resting?seatedScene:scene;
  const currentMotion=activeMotion();
  if(currentMotion&&motionView()){
    try{currentMotion.draw(elapsed,{coreLighting:view==='scene'?coreLighting:true});sceneFrame=currentMotion.canvas;}
    catch(error){
      currentMotion.dispose();if(resting)seatedMotion=undefined;else motion=undefined;
      canvas.dataset.renderer='static-fallback';status.textContent='当前以静态画面展示。';updateControls();console.warn(error);
    }
  }
  if(view==='scene'){
    // A mild camera push keeps this a place to inhabit, never a device close-up.
    // Sample the same native pixels; no filtered enlargement or extra blur.
    const zoom=1+cameraAmount*.18,width=960/zoom,height=640/zoom;
    const focus=manifest.rest?.focus??[480,320];
    const x=clamp(focus[0]-width*.5,0,960-width),y=clamp(focus[1]-height*.5,0,640-height);
    ctx.drawImage(sceneFrame,x,y,width,height,0,0,960,640);
    canvas.dataset.cameraZoom=zoom.toFixed(3);
    description.textContent=resting?'在断墙上坐一会儿。':'炉火、肩灯与被约束的微光。点击装置或人物查看细部，也可以在残墙上坐下。';
    caption.textContent=resting?'起身 · Esc':'微光中的据点';
    canvas.setAttribute('aria-label',resting?'归来者坐在炉边残墙上，视角稍微拉近；按起身或 Esc 返回。':'右侧依托残建筑的据点，核心圣龛、归来者与缓慢活动的深景；炉边残墙可以坐下。');
  }else if(view==='reference'||view==='baseline'){
    ctx.drawImage(view==='reference'?reference:baseline,0,0,960,640);
    description.textContent=view==='reference'?'启动页原画：空间、材料、光与氛围的直接参照。':'35f17ba：本轮修改前、已获认可的完整像素场景。';caption.textContent=view==='reference'?'原画参照':'获认可基线';canvas.setAttribute('aria-label',description.textContent);
  }else{
    const object=[...manifest.stations,manifest.actor].find(s=>s.id===view)!;const b=object.bounds;
    const core=object.id===1,width=core?Math.min(105,b.width):b.width,height=core?Math.min(117,b.height):b.height;
    const cropX=core?b.x+Math.floor((b.width-width)/2):b.x;
    const cropY=core?b.y+Math.max(0,Math.floor(b.height*.40-height/2)):b.y;
    const zoom=core?4:Math.max(1,Math.min(4,Math.floor(Math.min(420/b.width,470/b.height))));
    ctx.drawImage(core?sceneFrame:scene,cropX,cropY,width,height,Math.floor((480-width*zoom)/2),Math.floor((640-height*zoom)/2),width*zoom,height*zoom);
    ctx.drawImage(models.get(object.id)!,528,128);
    ctx.fillStyle='#798481';ctx.font='12px system-ui';ctx.fillText(core?`${motion?'动态':'静态'}芯体局部 · 4× 原像素`:`整景局部 · ${zoom}× 原像素`,28,57);ctx.fillText(core?'完整模型 · 静态参照':'同源模型 · 近距离像素绘制',542,57);
    if(object.id===7){ctx.drawImage(riftActor,30,473,96,96);ctx.fillText('裂隙内：保留原角色',30,592);}
    description.textContent=object.description;caption.textContent=object.name;canvas.setAttribute('aria-label',core?'核心，左侧四倍场景芯体动效与右侧完整静态模型对照':`${object.name}，场景局部与同源模型对照`);
  }
  canvas.dataset.artTime=elapsed.toFixed(3);
}

function needsFrame():boolean{
  return !disposed&&!document.hidden&&(!!cameraTween||!!activeMotion()&&!paused&&motionView());
}
function tick(time:number):void{
  frame=0;if(disposed||document.hidden)return;
  if(lastTime!==undefined&&activeMotion()&&!paused&&motionView())elapsed+=Math.min(.08,(time-lastTime)/1000);
  lastTime=time;
  if(cameraTween){
    const progress=clamp((time-cameraTween.started)/1050,0,1),eased=progress*progress*(3-2*progress);
    cameraAmount=cameraTween.from+(cameraTween.to-cameraTween.from)*eased;
    if(progress===1)cameraTween=undefined;
  }
  draw();if(needsFrame())frame=requestAnimationFrame(tick);
}
function schedule():void{
  if(!manifest)return;
  if(frame)cancelAnimationFrame(frame);frame=0;lastTime=undefined;updateControls();draw();
  if(needsFrame())frame=requestAnimationFrame(tick);
}
function setResting(value:boolean):void{
  if(view!=='scene'||!manifest.rest||!restReady||resting===value)return;
  resting=value;
  restLine.textContent=value?manifest.rest.line:'';restLine.classList.toggle('visible',value);
  if(reduced.matches){cameraAmount=value?1:0;cameraTween=undefined;}
  else cameraTween={from:cameraAmount,to:value?1:0,started:performance.now()};
  schedule();
}
function setView(next:View):void{
  view=next;resting=false;cameraAmount=0;cameraTween=undefined;
  restLine.textContent='';restLine.classList.remove('visible');canvas.dataset.cameraZoom='1.000';
  schedule();
}
sceneButton.onclick=()=>{if(view==='scene'&&resting)setResting(false);else setView('scene');};
referenceButton.onclick=()=>setView('reference');baselineButton.onclick=()=>setView('baseline');
restButton.onclick=()=>setResting(!resting);
motionButton.onclick=()=>{paused=!paused;schedule();};
coreLightButton.onclick=()=>{if(view!=='scene'||!activeMotion())return;coreLighting=!coreLighting;updateControls();draw();};
function pickedObject(event:MouseEvent):number{
  if(!picking||view!=='scene'||resting||cameraAmount>0)return 0;
  const rect=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*960/rect.width),y=Math.floor((event.clientY-rect.top)*640/rect.height);
  return x<0||y<0||x>=960||y>=640?0:picking[(y*960+x)*4]!;
}
canvas.addEventListener('click',event=>{
  if(!manifest)return;
  if(view!=='scene'){setView('scene');return;}
  const id=pickedObject(event);if(id===manifest.rest?.id){setResting(true);return;}
  if(buttons.has(id))setView(id);
});
canvas.addEventListener('mousemove',event=>{
  const id=pickedObject(event),sit=restReady&&id===manifest.rest?.id;
  canvas.style.cursor=sit||buttons.has(id)||view!=='scene'?'pointer':'default';
  canvas.title=sit?'坐下':'';
});
canvas.addEventListener('mouseleave',()=>{canvas.title='';canvas.style.cursor='default';});
document.addEventListener('visibilitychange',()=>{if(manifest)schedule();});
reduced.addEventListener('change',event=>{
  if(event.matches){paused=true;cameraTween=undefined;cameraAmount=resting?1:0;if(manifest)schedule();}
});
document.addEventListener('keydown',event=>{
  if(event.code==='Escape'&&resting){event.preventDefault();setResting(false);restButton.focus({preventScroll:true});return;}
  if(event.code==='Space'&&(event.target===document.body||event.target===canvas)&&activeMotion()&&motionView()){event.preventDefault();paused=!paused;schedule();}
});
window.addEventListener('pagehide',event=>{if(frame)cancelAnimationFrame(frame);frame=0;lastTime=undefined;if(!event.persisted){disposed=true;motion?.dispose();seatedMotion?.dispose();}});
window.addEventListener('pageshow',event=>{if(event.persisted&&manifest){disposed=false;schedule();}});

async function loadMotion(folder:string):Promise<HavenMotion>{
  const pollution=new Image(),coreLight=new Image(),furnace=new Image(),shoulder=new Image(),motionMap=new Image(),depth=new Image(),energyBase=new Image();
  await Promise.all([load(pollution,`${folder}/light-pollution.png`),load(coreLight,`${folder}/light-core.png`),load(furnace,`${folder}/light-furnace.png`),load(shoulder,`${folder}/light-shoulder.png`),load(motionMap,`${folder}/motion-map.png`),load(depth,`${folder}/depth-layers.png`),load(energyBase,`${folder}/haven-energy-base.png`)]);
  const energyResponse=await fetch('./assets/core-energy-atlas.png');if(!energyResponse.ok)throw new Error('Missing core energy atlas');
  // Decode straight channels: zero-alpha radiance is intentional in this atlas.
  const energy=await createImageBitmap(await energyResponse.blob(),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
  try{return createHavenMotion({scene:energyBase,pollution,coreLight,furnace,shoulder,motion:motionMap,depth,energy});}
  finally{energy.close();}
}

try{
  const response=await fetch('./assets/manifest.json');if(!response.ok)throw new Error('Missing manifest');manifest=await response.json() as Manifest;
  await Promise.all([load(scene,'./assets/haven.png'),load(reference,'/assets/art/menu-last-light.png'),load(baseline,'./assets/baseline-35f17ba.png'),load(ids,'./assets/object-ids.png'),load(riftActor,'./assets/rift-actor.png')]);
  await Promise.all([...manifest.stations,manifest.actor].map(async object=>{const image=new Image();await load(image,`./assets/${object.modelAsset}`);models.set(object.id,image);}));
  try{motion=await loadMotion('./assets');canvas.dataset.renderer='webgl';}
  catch(error){status.textContent='当前以静态画面展示。';canvas.dataset.renderer='static-fallback';console.warn(error);}
  if(manifest.rest){
    try{
      await load(seatedScene,'./assets/rest/haven.png');restReady=true;
      try{seatedMotion=await loadMotion('./assets/rest');}
      catch(error){console.warn('Rest remains available as a static scene.',error);}
    }catch(error){console.warn('Rest scene could not be loaded.',error);}
  }
  const off=document.createElement('canvas');off.width=960;off.height=640;const c=off.getContext('2d')!;c.drawImage(ids,0,0);picking=c.getImageData(0,0,960,640).data;
  const group=document.querySelector<HTMLDivElement>('.stations')!;
  for(const object of [...manifest.stations,manifest.actor]){const b=document.createElement('button');b.textContent=object.name;b.setAttribute('aria-pressed','false');b.onclick=()=>setView(object.id);buttons.set(object.id,b);group.append(b);}
  if(motion)status.textContent='';schedule();
}catch(error){status.textContent='画面尚未载入，请刷新后重试。';console.error(error);}
export {};
