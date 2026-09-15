import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='/Users/yilungao/coh/docs/qa/artifacts/iteration-23/vista-r6/code-east-lower';await mkdir(dir,{recursive:true});
const sourceFiles=[...['model','terrain','strata','material','boundary','cliff','rocks','sections','scenery','camera'].map(name=>`src/dev/living-landmass-stage/vista-${name}.ts`),'src/dev/living-landmass-stage/scene.ts',...['outline','holes','rocks','regions','route-nodes','connectors','strata','sections'].map(name=>`data/living-landmass-vista-${name}.csv`)];
async function hashes(){const result={};for(const source of sourceFiles)result[source]=createHash('sha256').update(await readFile(source)).digest('hex');return result;}
const sourceBefore=await hashes();
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],samples=[],inputs=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>window.__livingLandmassStage.getDynamicState());
await page.goto('http://127.0.0.1:3016/living-landmass-stage.html');await page.waitForFunction(()=>window.__livingLandmassStage?.getState().ready);await page.waitForTimeout(1500);
const full=await page.evaluate(()=>window.__livingLandmassStage.getState()),nodes=new Map(full.geometry.routeNodes.map(n=>[n.id,n]));
async function capture(id){await page.waitForTimeout(400);const state=await read();samples.push({id,state});if(!state.player.supported)throw Error('unsupported');const bounds=await page.locator('canvas[data-living-stage]').boundingBox();await page.screenshot({path:`${dir}/${id}.png`,clip:bounds});console.log(id,state.player.x,state.player.y);}
await capture('00-start');
for(const id of ['west-rise','west','middle-west','middle','middle-east','east','lower-east','lower']){
 const node=nodes.get(id),began=await read(),origin={x:began.player.x,y:began.player.y},vx=node.x-origin.x,vy=node.y-origin.y,length=Math.hypot(vx,vy),start=Date.now();let keys=[];
 try{while(Date.now()-start<35000){const state=await read(),remaining=Math.hypot(node.x-state.player.x,node.y-state.player.y);if(remaining<9)break;
 const along=length?Math.max(0,Math.min(length,((state.player.x-origin.x)*vx+(state.player.y-origin.y)*vy)/length)):0,look=Math.min(length,along+18),aim={x:origin.x+vx*look/(length||1),y:origin.y+vy*look/(length||1)},dx=aim.x-state.player.x,dy=aim.y-state.player.y,next=[];
 if(Math.abs(dx)>4)next.push(dx>0?'d':'a');if(Math.abs(dy)>4)next.push(dy>0?'s':'w');if(!next.length){if(Math.abs(node.x-state.player.x)>Math.abs(node.y-state.player.y))next.push(node.x>state.player.x?'d':'a');else next.push(node.y>state.player.y?'s':'w');}
 for(const key of keys)if(!next.includes(key))await page.keyboard.up(key);for(const key of next)if(!keys.includes(key))await page.keyboard.down(key);keys=next;const ms=Math.max(60,Math.min(160,remaining/80*700));inputs.push({node:id,keys:[...keys],ms,at:Date.now(),before:state.player});await page.waitForTimeout(ms);
 }}finally{for(const key of keys)await page.keyboard.up(key);}
 const arrived=await read();if(Math.hypot(arrived.player.x-node.x,arrived.player.y-node.y)>15)throw Error(`Not reached ${id}`);if(['east','lower-east','lower'].includes(id))await capture(`quality-${id}`);else console.log('waypoint',id,arrived.player.x,arrived.player.y);
}
const sourceAfter=await hashes();const sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
await writeFile(`${dir}/evidence.json`,JSON.stringify({sourceBefore,sourceAfter,sourceStable,inputs,method:'Actual headless Chrome and normal keyboard navigation, no game-state writes or time override; targeted UV/section self-check only',errors,samples},null,2));if(errors.length)throw Error(errors.join('\n'));if(!sourceStable)throw Error('Source changed during targeted route');
}finally{await browser.close();}
