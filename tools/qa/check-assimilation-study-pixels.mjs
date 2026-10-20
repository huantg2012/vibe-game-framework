/** Compare the real renderer at identical frozen geometry/light/time. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const rows=[];
try{
 for(const world of ['crystal-fibre','haven']){
  const context=await browser.newContext({viewport:{width:1360,height:1100}});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:3027/docs/art/previews/assimilation-appearance-study/?world=${world}&amount=.9&fibre=.5`);
  await page.waitForFunction(()=>window.__assimilationStudy?.snapshot().ready,null,{timeout:90000});
  await page.waitForTimeout(world==='haven'?2200:1000);
  const row=await page.evaluate(async world=>{
   const file='/src/managers/audio-manager.ts';
   const url=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===file).at(-1)?.name??file;
   const {audioManager}=await import(url);
   const game=audioManager.game;
   const scene=game.scene.getScene(world==='haven'?'PurificationScene':'RiftScene');
   const r=world==='haven'?scene.chamber.renderer:scene.lastLightPlayerPresentation;
   window.__assimilationStudy.pause(true);
   const look={amount:1,fibre:.5,membrane:.5,seconds:0,motion:false,subjective:false};
   const render=value=>{
    r.setAssimilationLook(value);
    if(world==='haven'){
     r.draw(scene.chamber.renderState);
     const bytes=new Uint8Array(r.canvas.width*r.canvas.height*4);
     r.gl.readPixels(0,0,r.canvas.width,r.canvas.height,r.gl.RGBA,r.gl.UNSIGNED_BYTE,bytes);
     return bytes;
    }
    r.render();return r.output.data.slice();
   };
   const diff=(a,b)=>{
    let pixels=0,total=0,max=0;
    for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);total+=d;max=Math.max(max,d);changed||=d>0;}if(changed)pixels++;}
    return {pixels,total,max};
   };
   const base=render(null),zero=render({...look,amount:0}),full=render(look),half=render({...look,amount:.5});
   const fixedLater=render({...look,seconds:1.6});
   const motion0=render({...look,motion:true}),motion1=render({...look,motion:true,seconds:1.6});
   const fibre=render({...look,fibre:1,membrane:0}),membrane=render({...look,fibre:0,membrane:1});
   const subjective=world==='haven'?diff(full,render({...look,subjective:true})):null;
   return {world,zero:diff(base,zero),full:diff(base,full),half:diff(base,half),frozen:diff(full,fixedLater),
    motion:diff(motion0,motion1),mixedVsFibre:diff(full,fibre),mixedVsMembrane:diff(full,membrane),subjective,
    preparationMs:window.__assimilationStudy.snapshot().preparationMs,maskBytes:r.getAssimilationLookMetrics().maskBytes};
  },world);
  rows.push(row);
  assert.equal(row.zero.pixels,0,'A0 equals default bytes');
  assert.equal(row.frozen.pixels,0,'motion disabled ignores study time');
  assert(row.full.total>row.half.total&&row.half.total>0,'healing removes visible change');
  assert(row.motion.pixels>0,'actual pixels animate with fixed game light/pose');
  assert(row.mixedVsFibre.pixels>0&&row.mixedVsMembrane.pixels>0,'both source contributions present');
  if(world==='haven')assert(row.subjective.pixels>0&&row.subjective.max<=4,'bounded subjective layer has actual pixels');
  console.log(JSON.stringify(row));
  await context.close();
 }
}finally{
 await browser.close();
 await fs.writeFile('docs/qa/artifacts/assimilation-appearance-2026-10-20/pixel-checks.json',JSON.stringify(rows,null,2)+'\n');
}
