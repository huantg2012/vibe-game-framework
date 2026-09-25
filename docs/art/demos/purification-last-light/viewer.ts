import { createHavenMotion } from './motion';
interface ArtObject {id:number;key:string;name:string;description:string;modelAsset:string;bounds:{x:number;y:number;width:number;height:number};}
interface Manifest {stations:ArtObject[];actor:ArtObject;}
function el<T extends HTMLElement>(id:string):T{const n=document.getElementById(id);if(!n)throw new Error(`Missing ${id}`);return n as T;}
const canvas=el<HTMLCanvasElement>('art'),ctx=canvas.getContext('2d')!;
const status=el<HTMLParagraphElement>('status'),description=el<HTMLParagraphElement>('description'),caption=el<HTMLSpanElement>('caption');
const sceneButton=el<HTMLButtonElement>('scene'),referenceButton=el<HTMLButtonElement>('reference'),baselineButton=el<HTMLButtonElement>('baseline'),motionButton=el<HTMLButtonElement>('motion');
const scene=new Image(),reference=new Image(),baseline=new Image(),ids=new Image(),riftActor=new Image();
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),params=new URLSearchParams(location.search);
let manifest:Manifest,view:'scene'|'reference'|'baseline'|number='scene',elapsed=Math.max(0,Number(params.get('t'))||0);
let paused=reduced.matches||params.has('still'),lastTime:number|undefined,frame=0,disposed=false;
let motion:ReturnType<typeof createHavenMotion>|undefined,picking:Uint8ClampedArray|undefined;
const buttons=new Map<number,HTMLButtonElement>(),models=new Map<number,HTMLImageElement>();
const load=(image:HTMLImageElement,url:string):Promise<void>=>new Promise((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error(`Unable to load ${url}`));image.src=url;});
function updateControls():void{
  sceneButton.setAttribute('aria-pressed',String(view==='scene'));referenceButton.setAttribute('aria-pressed',String(view==='reference'));baselineButton.setAttribute('aria-pressed',String(view==='baseline'));
  for(const[id,button]of buttons)button.setAttribute('aria-pressed',String(view===id));
  motionButton.disabled=view!=='scene'||!motion;motionButton.textContent=paused?'继续景观':'暂停景观';motionButton.setAttribute('aria-pressed',String(!paused&&view==='scene'));
  canvas.dataset.animation=motion&&!paused&&view==='scene'&&!document.hidden?'playing':'paused';
}
function draw():void{
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#070c0e';ctx.fillRect(0,0,960,640);
  if(view==='scene'){
    if(motion){
      try{motion.draw(elapsed);ctx.drawImage(motion.canvas,0,0);}
      catch(error){motion.dispose();motion=undefined;paused=true;canvas.dataset.renderer='static-fallback';status.textContent='当前以静态画面展示。';updateControls();ctx.drawImage(scene,0,0);console.warn(error);}
    }else ctx.drawImage(scene,0,0);
    description.textContent='炉火、肩灯与被约束的微光。深处的东西偶尔经过；点击装置或人物查看细部。';caption.textContent='微光中的据点';canvas.setAttribute('aria-label','右侧依托残建筑的据点，核心圣龛、归来者与缓慢活动的深景');
  }else if(view==='reference'||view==='baseline'){
    ctx.drawImage(view==='reference'?reference:baseline,0,0,960,640);
    description.textContent=view==='reference'?'启动页原画：空间、材料、光与氛围的直接参照。':'35f17ba：本轮修改前、已获认可的完整像素场景。';caption.textContent=view==='reference'?'原画参照':'获认可基线';canvas.setAttribute('aria-label',description.textContent);
  }else{
    const object=[...manifest.stations,manifest.actor].find(s=>s.id===view)!;const b=object.bounds;
    const zoom=Math.max(1,Math.min(4,Math.floor(Math.min(420/b.width,470/b.height))));
    ctx.drawImage(scene,b.x,b.y,b.width,b.height,Math.floor((480-b.width*zoom)/2),Math.floor((640-b.height*zoom)/2),b.width*zoom,b.height*zoom);
    ctx.drawImage(models.get(object.id)!,528,128);
    ctx.fillStyle='#798481';ctx.font='12px system-ui';ctx.fillText(`整景局部 · ${zoom}× 原像素`,28,57);ctx.fillText('同源模型 · 近距离像素绘制',542,57);
    if(object.id===7){ctx.drawImage(riftActor,30,473,96,96);ctx.fillText('裂隙内：保留原角色',30,592);}
    description.textContent=object.description;caption.textContent=object.name;canvas.setAttribute('aria-label',`${object.name}，场景局部与同源模型对照`);
  }
  canvas.dataset.artTime=elapsed.toFixed(3);
}
function tick(time:number):void{
  frame=0;if(disposed||paused||view!=='scene'||document.hidden)return;
  if(lastTime!==undefined)elapsed+=Math.min(.08,(time-lastTime)/1000);
  lastTime=time;draw();frame=requestAnimationFrame(tick);
}
function schedule():void{
  if(frame)cancelAnimationFrame(frame);frame=0;lastTime=undefined;updateControls();draw();
  if(motion&&!paused&&view==='scene'&&!document.hidden)frame=requestAnimationFrame(tick);
}
sceneButton.onclick=()=>{view='scene';schedule();};referenceButton.onclick=()=>{view='reference';schedule();};baselineButton.onclick=()=>{view='baseline';schedule();};
motionButton.onclick=()=>{paused=!paused;schedule();};
canvas.addEventListener('click',event=>{
  if(view!=='scene'){view='scene';schedule();return;}
  if(!picking)return;const rect=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*960/rect.width),y=Math.floor((event.clientY-rect.top)*640/rect.height);
  if(x<0||y<0||x>=960||y>=640)return;
  const id=picking[(y*960+x)*4]!;if(buttons.has(id)){view=id;schedule();}
});
document.addEventListener('visibilitychange',()=>{if(manifest)schedule();});
reduced.addEventListener('change',event=>{if(event.matches){paused=true;if(manifest)schedule();}});
document.addEventListener('keydown',event=>{if(event.code==='Space'&&(event.target===document.body||event.target===canvas)&&view==='scene'){event.preventDefault();paused=!paused;schedule();}});
window.addEventListener('pagehide',event=>{if(frame)cancelAnimationFrame(frame);frame=0;lastTime=undefined;if(!event.persisted){disposed=true;motion?.dispose();}});
window.addEventListener('pageshow',event=>{if(event.persisted&&manifest){disposed=false;schedule();}});
try{
  const response=await fetch('./assets/manifest.json');if(!response.ok)throw new Error('Missing manifest');manifest=await response.json() as Manifest;
  await Promise.all([load(scene,'./assets/haven.png'),load(reference,'/assets/art/menu-last-light.png'),load(baseline,'./assets/baseline-35f17ba.png'),load(ids,'./assets/object-ids.png'),load(riftActor,'./assets/rift-actor.png')]);
  await Promise.all([...manifest.stations,manifest.actor].map(async object=>{const image=new Image();await load(image,`./assets/${object.modelAsset}`);models.set(object.id,image);}));
  try{
    const pollution=new Image(),furnace=new Image(),shoulder=new Image(),motionMap=new Image(),depth=new Image();
    await Promise.all([load(pollution,'./assets/light-pollution.png'),load(furnace,'./assets/light-furnace.png'),load(shoulder,'./assets/light-shoulder.png'),load(motionMap,'./assets/motion-map.png'),load(depth,'./assets/depth-layers.png')]);
    motion=createHavenMotion({scene,pollution,furnace,shoulder,motion:motionMap,depth});
    canvas.dataset.renderer='webgl';
  }catch(error){status.textContent='当前以静态画面展示。';canvas.dataset.renderer='static-fallback';console.warn(error);}
  const off=document.createElement('canvas');off.width=960;off.height=640;const c=off.getContext('2d')!;c.drawImage(ids,0,0);picking=c.getImageData(0,0,960,640).data;
  const group=document.querySelector<HTMLDivElement>('.stations')!;
  for(const object of [...manifest.stations,manifest.actor]){const b=document.createElement('button');b.textContent=object.name;b.setAttribute('aria-pressed','false');b.onclick=()=>{view=object.id;schedule();};buttons.set(object.id,b);group.append(b);}
  if(motion)status.textContent='';schedule();
}catch(error){status.textContent='画面尚未载入，请刷新后重试。';console.error(error);}
export {};
