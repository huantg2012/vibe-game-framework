interface Station {id:number;key:string;name:string;description:string;modelAsset:string;bounds:{x:number;y:number;width:number;height:number};}
interface Manifest {stations:Station[];}
function el<T extends HTMLElement>(id:string):T{const n=document.getElementById(id);if(!n)throw new Error(`Missing ${id}`);return n as T;}
const canvas=el<HTMLCanvasElement>('art'),ctx=canvas.getContext('2d')!;
const status=el<HTMLParagraphElement>('status'),description=el<HTMLParagraphElement>('description'),caption=el<HTMLSpanElement>('caption');
const sceneButton=el<HTMLButtonElement>('scene'),referenceButton=el<HTMLButtonElement>('reference');
const scene=new Image(),reference=new Image(),ids=new Image();
let manifest:Manifest,view:'scene'|'reference'|number='scene';
let picking:Uint8ClampedArray|undefined;
const buttons=new Map<number,HTMLButtonElement>();
const models=new Map<number,HTMLImageElement>();
const load=(image:HTMLImageElement,url:string):Promise<void>=>new Promise((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error(`Unable to load ${url}`));image.src=url;});
function draw():void{
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#05090b';ctx.fillRect(0,0,960,640);
  sceneButton.setAttribute('aria-pressed',String(view==='scene'));referenceButton.setAttribute('aria-pressed',String(view==='reference'));
  for(const[id,button]of buttons)button.setAttribute('aria-pressed',String(view===id));
  if(view==='scene'){
    ctx.drawImage(scene,0,0);description.textContent='断裂书库中的生存据点。点击装置或上方名称查看模型。';caption.textContent='整景 · 六处功能';canvas.setAttribute('aria-label','微光据点，完整像素场景');
  }else if(view==='reference'){
    ctx.drawImage(reference,0,0,960,640);description.textContent='启动页原画：本轮空间、材料、光与氛围的直接参照。';caption.textContent='原画参照';canvas.setAttribute('aria-label','游戏启动页原画');
  }else{
    const station=manifest.stations.find(s=>s.id===view)!;const b=station.bounds;
    const zoom=Math.max(1,Math.min(4,Math.floor(Math.min(420/b.width,470/b.height))));
    ctx.drawImage(scene,b.x,b.y,b.width,b.height,Math.floor((480-b.width*zoom)/2),Math.floor((640-b.height*zoom)/2),b.width*zoom,b.height*zoom);
    ctx.drawImage(models.get(station.id)!,528,128);
    ctx.fillStyle='#798481';ctx.font='12px system-ui';ctx.fillText(`整景局部 · ${zoom}× 原像素`,28,57);ctx.fillText('模型构造细看 · 独立像素绘制',542,57);
    description.textContent=station.description;caption.textContent=station.name;canvas.setAttribute('aria-label',`${station.name}，场景局部与独立像素模型对照`);
  }
}
sceneButton.onclick=()=>{view='scene';draw();};referenceButton.onclick=()=>{view='reference';draw();};
canvas.addEventListener('click',event=>{
  if(view!=='scene'){view='scene';draw();return;}
  if(!picking)return;const rect=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*960/rect.width),y=Math.floor((event.clientY-rect.top)*640/rect.height);
  const id=picking[(y*960+x)*4]!;if(buttons.has(id)){view=id;draw();}
});
try{
  const response=await fetch('./assets/manifest.json');if(!response.ok)throw new Error('Missing manifest');manifest=await response.json() as Manifest;
  await Promise.all([load(scene,'./assets/haven.png'),load(reference,'/assets/art/menu-last-light.png'),load(ids,'./assets/object-ids.png')]);
  await Promise.all(manifest.stations.map(async station=>{const img=new Image();await load(img,`./assets/${station.modelAsset}`);models.set(station.id,img);}));
  const off=document.createElement('canvas');off.width=960;off.height=640;const c=off.getContext('2d')!;c.drawImage(ids,0,0);picking=c.getImageData(0,0,960,640).data;
  const group=document.querySelector<HTMLDivElement>('.stations')!;
  for(const station of manifest.stations){const b=document.createElement('button');b.textContent=station.name;b.setAttribute('aria-pressed','false');b.onclick=()=>{view=station.id;draw();};buttons.set(station.id,b);group.append(b);}
  draw();status.textContent='';
}catch(error){status.textContent='画面尚未载入，请刷新后重试。';console.error(error);}
export {};
