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
const {model,core}=base();
const baseline={id:'current',title:'当前 · 开放地面',summary:'同一机位、同一坐姿与光照参数，作为三个空间方案的比较基线。',tradeoff:'保留通行空间，但核心前庭缺少明确的空间边界。',model,route:[[2,.035,-.5],[5.2,.035,.3],core.approach],stop:core.approach,footprint:[],callouts:[]};
let entries=[];
try{entries=JSON.parse(await fs.readFile(path.join(output,'options.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(const id of ['current','a','b','c']){
  if(selected.length&&!selected.includes(id))continue;
  const option=id==='current'?baseline:(await import(`./option-${id}.ts`)).buildOption();
  console.log(`Rendering ${id}: ${option.model.triangles.length} triangles`);
  const frame=render(option.model,CAMERA,console.log);
  await sharp(Buffer.from(frame.rgba),{raw:{width:CAMERA.width,height:CAMERA.height,channels:4}}).png().toFile(path.join(output,`${id}.png`));
  const screen=p=>project(p).slice(0,2);
  const item={...option,model:undefined,route:option.route.map(screen),stop:screen(option.stop),footprint:option.footprint.map(screen),callouts:option.callouts.map(c=>({...c,point:screen(c.point)})),world:{route:option.route,stop:option.stop,footprint:option.footprint},triangles:option.model.triangles.length,lights:option.model.lights.length};
  entries=entries.filter(e=>e.id!==id);entries.push(item);
  entries.sort((a,b)=>['current','a','b','c'].indexOf(a.id)-['current','a','b','c'].indexOf(b.id));
  await fs.writeFile(path.join(output,'options.json'),JSON.stringify(entries,null,2)+'\n');
}
console.log('Saved comparison renders and projected annotations.');
