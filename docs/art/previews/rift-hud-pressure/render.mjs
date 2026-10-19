import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.COH_PLAYWRIGHT_MODULE ?? path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(out,'../../../..');
const browser=await chromium.launch({headless:true,executablePath:process.env.COH_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1100,height:1060},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(new URL('/docs/art/previews/rift-hud-pressure/',process.env.COH_QA_BASE_URL ?? 'http://127.0.0.1:3027').href);
 await page.waitForFunction(()=>!!window.__hudArt);
 for(const [id,name] of [['comparison','comparison.png'],['marks','marks-enlarged.png']]){
  const url=await page.locator('#'+id).evaluate(c=>c.toDataURL('image/png'));
  await fs.writeFile(out+'/'+name,Buffer.from(url.split(',')[1],'base64'));
 }
 for(let i=0;i<3;i++){
  await page.evaluate(i=>window.__hudArt.renderPreset(i),i);
  await page.locator('#scene').screenshot({path:out+'/scene-'+i+'.png'});
 }
 const result=await page.evaluate(async()=>{
  const m=await import('./pixel-marks.js');
  const c=document.createElement('canvas');c.width=16;c.height=16;const g=c.getContext('2d',{willReadFrequently:true});
  const samples=[];
  for(const [type,values] of [['burden',[3/16,14/16,1]],['assimilation',[0,60,100]]]){
   for(const value of values){g.clearRect(0,0,16,16);if(type==='burden')m.drawBurden(g,0,0,value,0,0);else m.drawAssimilation(g,0,0,value,0,false);
    const d=g.getImageData(0,0,16,16).data;let opaque=0,partial=0;const colors=new Set();
    for(let i=0;i<d.length;i+=4){if(d[i+3]===255){opaque++;colors.add('#'+[d[i],d[i+1],d[i+2]].map(x=>x.toString(16).padStart(2,'0')).join(''));}else if(d[i+3])partial++;}
    samples.push({type,value,opaque,partial,colors:[...colors],signature:c.toDataURL()});
   }
  }
  const motion={};
  for(const growing of [false,true]){const frames=[];for(const time of [0,450,900,1400,2000]){g.clearRect(0,0,16,16);m.drawAssimilation(g,0,0,60,time,growing);frames.push(c.toDataURL());}motion[growing?'growingFrames':'stableFrames']=new Set(frames).size;}
  const frames=[];for(const f of [0,.3,.7,1]){g.clearRect(0,0,16,16);m.drawBurden(g,0,0,.875,170,f);frames.push(c.toDataURL());}motion.burdenFrames=new Set(frames).size;
  return {samples,motion};
 });
 const palette=JSON.parse(await fs.readFile(path.join(root,'docs/art/palette.json'),'utf8')).colors;
 for(const s of result.samples){assert(s.opaque>0 && s.opaque<=100);assert(s.partial===0);assert(s.colors.length<=2);assert(s.colors.every(c=>palette.includes(c)));}
 assert(new Set(result.samples.slice(0,3).map(s=>s.signature)).size===3);
 assert(new Set(result.samples.slice(3).map(s=>s.signature)).size===3);
 assert(result.motion.stableFrames===1);assert(result.motion.growingFrames>1);assert(result.motion.burdenFrames>1);
 await page.locator('#weight').fill('7.5');assert((await page.evaluate(()=>window.__hudArt.getState())).weight===7.5);
 await page.locator('#assimilation').fill('32');assert((await page.evaluate(()=>window.__hudArt.getState())).assimilation===32);
 await page.locator('[data-preset="1"]').click();
 const url=await page.evaluate(()=>window.__hudArt.getSpriteSheet());await fs.writeFile(out+'/marks-native.png',Buffer.from(url.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);
 for(const s of result.samples)delete s.signature;
 await fs.writeFile(out+'/art-check.json',JSON.stringify({pass:true,scope:'Art study only; 16x16 symbols, at most 2 colors and 100 opaque pixels, palette, distinct states, animation and controls. Not gameplay integration or human visual approval.',errors,...result},null,2)+'\n');
 console.log(JSON.stringify({pass:true,motion:result.motion}));
}finally{await browser.close();}
