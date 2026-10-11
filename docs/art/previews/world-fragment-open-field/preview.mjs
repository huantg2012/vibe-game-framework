import { generateEdgeStudy, PREVIEW_SEEDS } from './edge-treatment.mjs';
const root=document.getElementById('fragment-open-field');
const geometry=JSON.parse(document.getElementById('fragment-geometry').textContent);
const svg=root.querySelector('.fragment-map');
const toggle=root.querySelector('#fragment-scale');
const bonesButton=root.querySelector('[data-bones]');
const terrain=root.querySelector('[data-terrain]');
const inspection=root.querySelector('[data-inspection]');
const presets=[...root.querySelectorAll('[data-point]')];
const path=points=>'M'+points.map(p=>p.join(',')).join('L')+'Z';
const svgNS='http://www.w3.org/2000/svg';
const cached=PREVIEW_SEEDS.map(seed=>generateEdgeStudy(geometry,seed));
let variant=0,bones=false,point=[440,475],land=()=>false,segments=[];
const insidePolygon=(p,poly)=>{
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
};
const inRect=(p,r)=>p[0]>=r[0]&&p[0]<=r[0]+r[2]&&p[1]>=r[1]&&p[1]<=r[1]+r[3];
const rectPoints=([x,y,w,h])=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const prepareTerrain=()=>{
  terrain.replaceChildren();
  let contours;
  if(bones){
    for(const [list,fill] of [[geometry.landRects,'#fff'],[geometry.voidRects,'#000']])for(const [x,y,width,height] of list){
      const r=document.createElementNS(svgNS,'rect');
      for(const [key,value] of Object.entries({x,y,width,height,fill,'shape-rendering':'crispEdges'}))r.setAttribute(key,String(value));terrain.append(r);
    }
    land=p=>geometry.landRects.some(r=>inRect(p,r))&&!geometry.voidRects.some(r=>inRect(p,r));
    contours=[...geometry.landRects,...geometry.voidRects].map(rectPoints);
  }else{
    const study=cached[variant];
    const p=document.createElementNS(svgNS,'path');p.setAttribute('d',study.pathD);p.setAttribute('fill','#fff');p.setAttribute('fill-rule','evenodd');terrain.append(p);
    contours=study.contours;
    land=p=>contours.reduce((count,poly)=>count+Number(insidePolygon(p,poly)),0)%2===1;
  }
  segments=contours.flatMap(poly=>poly.map((p,i)=>[p,poly[(i+1)%poly.length]]));
  bonesButton.setAttribute('aria-pressed',String(bones));
  root.querySelector('[data-variant]').textContent=bones?'原始拼合':`打磨 ${variant+1} / ${PREVIEW_SEEDS.length}`;
};
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
// Geometric full-turn envelope; deliberately not presented as the production FOV.
const ray=(p,angle)=>{
  const dir=[Math.cos(angle),Math.sin(angle)];let distance=112;
  for(const [a,b] of segments){
    const edge=[b[0]-a[0],b[1]-a[1]],offset=[a[0]-p[0],a[1]-p[1]],denom=cross(dir,edge);
    if(Math.abs(denom)<1e-8)continue;
    const t=cross(offset,edge)/denom,u=cross(offset,dir)/denom;
    if(t>=0&&t<distance&&u>=0&&u<=1&&!land([p[0]+dir[0]*(t+.001),p[1]+dir[1]*(t+.001)]))distance=t;
  }return [p[0]+dir[0]*distance,p[1]+dir[1]*distance];
};
const bodyFits=p=>[-5,0,5].every(dx=>[-5,0,5].every(dy=>land([p[0]+dx,p[1]+dy])));
const renderInspection=()=>{
  if(!bodyFits(point))point=[440,475];
  inspection.toggleAttribute('hidden',!toggle.checked);
  root.querySelector('[data-presets]').hidden=!toggle.checked;
  root.querySelector('[data-detail]').hidden=!toggle.checked;
  if(toggle.checked){
    const circle=root.querySelector('[data-range]');circle.setAttribute('cx',point[0]);circle.setAttribute('cy',point[1]);
    const body=root.querySelector('[data-body]');body.setAttribute('x',point[0]-5);body.setAttribute('y',point[1]-5);
    root.querySelector('[data-visible]').setAttribute('d',path(Array.from({length:720},(_,i)=>ray(point,i*Math.PI/360))));
  }
  presets.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.point===point.join(','))));
};
const persist=()=>{if(window.openai?.setWidgetState)window.openai.setWidgetState({modelContent:{study:'open-field-edges',scale:toggle.checked,observer:point,variant:variant+1,bones},privateContent:null}).catch(()=>{});};
const render=()=>{prepareTerrain();renderInspection();};
bonesButton.addEventListener('click',()=>{bones=!bones;render();persist();});
root.querySelector('[data-next]').addEventListener('click',()=>{variant=(variant+1)%PREVIEW_SEEDS.length;bones=false;render();persist();});
toggle.addEventListener('change',()=>{renderInspection();persist();});
const setPoint=p=>{if(!bodyFits(p))return;point=p;renderInspection();persist();};
presets.forEach(button=>button.addEventListener('click',()=>setPoint(button.dataset.point.split(',').map(Number))));
svg.addEventListener('click',event=>{
  if(!toggle.checked)return;
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());setPoint([Math.round(p.x),Math.round(p.y)]);
});
const restore=()=>{
  const s=window.openai?.widgetState?.modelContent;
  if(s?.study==='open-field-edges'){
    bones=Boolean(s.bones);toggle.checked=Boolean(s.scale);
    if(Number.isInteger(s.variant)&&s.variant>0&&s.variant<=PREVIEW_SEEDS.length)variant=s.variant-1;
    if(Array.isArray(s.observer)&&s.observer.length===2&&s.observer.every(Number.isFinite))point=s.observer;
  }render();
};
window.addEventListener('openai:set_globals',restore);restore();
