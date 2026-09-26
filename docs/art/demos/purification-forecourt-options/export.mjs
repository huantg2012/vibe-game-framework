import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {base} from './shared.ts';
import {CAMERA,project,render} from '../purification-last-light/render.ts';

const here=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(here,'assets');
await fs.mkdir(output,{recursive:true});
const selected=process.argv.slice(2);
const {model,core,stations}=base();
const baseline={id:'current',title:'当前 · 原布局',summary:'统一站立参考点、镜头、材质和光照时刻。三套候选都从这个原场景重组；尚未接入正式移动。',tradeoff:'原布局作为对照，当前游戏和样景均未替换。',model,stations,route:[[3.8,.035,3.8],[4.6,.035,1.9],[7.5,.035,1.6],core.approach],stop:core.approach,footprint:[],callouts:[],routes:[{label:'修复核心 · 原路线',points:[[3.8,.035,3.8],[4.6,.035,1.9],[7.5,.035,1.6],core.approach]},{label:'检修储藏 · 原上楼路线',points:[[3.8,.035,3.8],[2,.035,-.5],[3.5,2.635,-4],[5,2.635,-3.8],[7.4,2.635,-4.4],[9.02,2.635,-3.55]]}],design:['人物站立位置仅是统一比较起点，不是已实现的归来出生点。','备行每次出发使用；检修、供奉、成长与休息按需选择。']};
let entries=[];
try{entries=JSON.parse(await fs.readFile(path.join(output,'options.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(const id of ['current','a','b','c']){
  if(selected.length&&!selected.includes(id))continue;
  const option=id==='current'?baseline:(await import(`./option-${id}.ts`)).buildOption();
  console.log(`Rendering ${id}: ${option.model.triangles.length} triangles`);
  const frame=render(option.model,CAMERA,console.log);
  await sharp(Buffer.from(frame.rgba),{raw:{width:CAMERA.width,height:CAMERA.height,channels:4}}).png().toFile(path.join(output,`${id}.png`));
  const screen=p=>project(p).slice(0,2);
  const routes=(option.routes??[]).map(r=>({...r,points:r.points.map(screen),distance:r.points.slice(1).reduce((n,p,i)=>n+Math.hypot(...p.map((v,k)=>v-r.points[i][k])),0)}));
  const item={...option,model:undefined,stations:option.stations?.map(s=>({...s,position:screen(s.position),approach:screen(s.approach)})),routes,route:option.route.map(screen),stop:screen(option.stop),footprint:option.footprint.map(screen),callouts:option.callouts.map(c=>({...c,point:screen(c.point)})),world:{stations:option.stations,routes:option.routes,route:option.route,stop:option.stop,footprint:option.footprint},triangles:option.model.triangles.length,lights:option.model.lights.length};
  entries=entries.filter(e=>e.id!==id);entries.push(item);
  entries.sort((a,b)=>['current','a','b','c'].indexOf(a.id)-['current','a','b','c'].indexOf(b.id));
  await fs.writeFile(path.join(output,'options.json'),JSON.stringify(entries,null,2)+'\n');
}
console.log('Saved comparison renders and projected annotations.');
