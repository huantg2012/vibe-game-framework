import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.COH_PLAYWRIGHT_MODULE ?? path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:process.env.COH_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1100,height:1060},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(new URL('/docs/art/previews/rift-hud-pressure/',process.env.COH_QA_BASE_URL ?? 'http://127.0.0.1:3027').href);
 await page.waitForFunction(()=>!!window.__hudArt);
 const comparison=await page.locator('#comparison').evaluate(c=>c.toDataURL('image/png'));
 await fs.writeFile(out+'/comparison.png',Buffer.from(comparison.split(',')[1],'base64'));
 const samples=[];
 for(let i=0;i<3;i++){
  await page.evaluate(i=>window.__hudArt.renderPreset(i),i);
  await page.locator('#scene').screenshot({path:out+'/scene-'+i+'.png'});
  samples.push(await page.evaluate(()=>{
   const hud=document.querySelector('#hud'),g=hud.getContext('2d');
   return [0,18,36].map(y=>{
    const d=g.getImageData(28,y,hud.width-28,16).data,points=[],colors=new Set();
    for(let i=0;i<d.length/4;i++)if(d[i*4+3]){
     points.push({x:28+i%(hud.width-28),y:Math.floor(i/(hud.width-28))});
     colors.add('#'+[d[i*4],d[i*4+1],d[i*4+2]].map(v=>v.toString(16).padStart(2,'0')).join(''));
    }
    return {right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y)),colors:[...colors].sort()};
   });
  }));
 }
 for(const [i,rows] of samples.entries()){
  assert(rows.every(r=>r.right===109 && r.bottom===12));
  assert.deepEqual(rows[0].colors,['#b89040']);
  assert.deepEqual(rows[1].colors,['#8a8f96',i===0?'#c8cdd4':'#e0a848']);
  assert.deepEqual(rows[2].colors,[i===0?'#c8cdd4':'#1aad96']);
 }
 await page.locator('#weight').fill('7.5');assert((await page.evaluate(()=>window.__hudArt.getState())).weight===7.5);
 await page.locator('#assimilation').fill('32');assert((await page.evaluate(()=>window.__hudArt.getState())).assimilation===32);
 await page.locator('[data-preset="1"]').click();
 assert.deepEqual(errors,[]);
 await fs.writeFile(out+'/art-check.json',JSON.stringify({pass:true,scope:'Text HUD preview only: preserved numeric colors, aligned rows, independent controls, no page errors. Not production integration or human visual approval.',errors,samples},null,2)+'\n');
 console.log(JSON.stringify({pass:true,states:samples.length}));
}finally{await browser.close();}
