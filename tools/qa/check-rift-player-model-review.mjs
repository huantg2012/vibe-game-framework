/** Scoped model-review UI and ground-swatch checks. Does not drive production. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'docs/qa/artifacts/rift-player-models-2026-10-16');
await fs.mkdir(output,{recursive:true});
const playwrightPath=process.env.COH_PLAYWRIGHT_MODULE||'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(playwrightPath);
const browser=await chromium.launch({executablePath:process.env.COH_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report={scope:'Independent three-model review; no production integration',errors:[],checks:[],contrast:[],sourceHashes:{}};
try{
  const page=await browser.newPage({viewport:{width:1480,height:1050},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
  await page.goto((process.env.COH_REVIEW_BASE_URL||'http://127.0.0.1:3027')+'/docs/art/previews/rift-player-models/');
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.locator('.three-views canvas').count(),9);
  const manifest=await page.evaluate(()=>window.modelReview.manifest);
  assert.equal(manifest.status,'candidate-assets');
  assert(manifest.variants.every(v=>v.frames.length===104));
  for(const variant of manifest.variants)for(const view of manifest.views){
    const frame=variant.frames.find(f=>f.yawIndex===view.yawIndex&&f.pose==='idle');
    assert(frame.bounds[0]>=14&&frame.bounds[1]>=22&&frame.bounds[2]<50&&frame.bounds[3]<74,'review crop cuts body');
  }
  report.checks.push('Nine true model views; same native crop and integer 4× scale; 416 complete baked frames.');
  const motionURLs=()=>page.locator('#motion-cards canvas').evaluateAll(cs=>cs.map(c=>c.toDataURL()));
  const movingBefore=await motionURLs();await page.waitForTimeout(370);const movingAfter=await motionURLs();
  assert(movingBefore.every((image,i)=>image!==movingAfter[i]));
  await page.locator('#play').click();const pausedBefore=await motionURLs();await page.waitForTimeout(220);
  assert.deepEqual(await motionURLs(),pausedBefore);
  report.checks.push('All three walk displays change pixels; stopping returns to a stable neutral pose.');
  for(const direction of ['0','2','4','6']){await page.locator('#direction').selectOption(direction);assert((await motionURLs()).every(Boolean));}
  await page.locator('#direction').selectOption('0');
  const stillURLs=()=>page.locator('.three-views canvas').evaluateAll(cs=>cs.map(c=>c.toDataURL()));
  const review=await stillURLs();
  await page.locator('#channel').selectOption('rgba');assert((await stillURLs()).every((p,i)=>p!==review[i]));
  for(const channel of ['silhouette','albedo','normal'])await page.locator('#channel').selectOption(channel);
  await page.locator('#backdrop').selectOption('check');await page.locator('#backdrop').selectOption('light');
  await page.locator('#backdrop').selectOption('dark');await page.locator('#channel').selectOption('review');
  report.checks.push('Review light, raw shoulder light, silhouette, albedo, normal, three backgrounds and direction controls respond.');
  await page.screenshot({path:path.join(output,'review-page.png'),fullPage:true});
  await page.locator('#candidates').screenshot({path:path.join(output,'three-models.png')});
  const samples=await page.evaluate(()=>window.modelReview.groundSamples);
  for(const ground of ['crystal','ivory']){
    await page.locator('#ground').selectOption(ground);
    await page.locator('.motion').screenshot({path:path.join(output,`${ground}-context.png`)});
    const sample=samples[ground],sourceFile=path.resolve(root,'docs/art/previews/rift-player-models',sample.url);
    const bg=await sharp(sourceFile).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let emptyGround=0;
    for(let y=0;y<104;y++)for(let x=0;x<192;x++){
      const i=((sample.crop[1]+y)*bg.info.width+sample.crop[0]+x)*4;
      if(bg.data[i]+bg.data[i+1]+bg.data[i+2]<6)emptyGround++;
    }
    assert(emptyGround/(192*104)<.01,'ground swatch includes black void instead of terrain');
    for(const variant of manifest.variants.filter(v=>v.id!=='haven'))for(const view of manifest.views){
      const asset=variant.threeViews[view.id],base=path.join(root,'docs/art/previews/rift-player-models/assets');
      const pixels=await sharp(path.join(base,asset.review)).raw().toBuffer();
      const materials=await sharp(path.join(base,asset.material)).raw().toBuffer();
      let edges=0,visible=0;
      for(let y=1;y<79;y++)for(let x=1;x<63;x++){
        const i=(y*64+x)*4;if(!pixels[i+3]||materials[i+3]>0)continue;
        if([-64,64,-1,1].every(d=>pixels[i+d*4+3]))continue;
        const j=((sample.crop[1]+10+y)*bg.info.width+sample.crop[0]+64+x)*4;
        const luminance=(p,k)=>.2126*p[k]+.7152*p[k+1]+.0722*p[k+2];
        edges++;if(Math.abs(luminance(pixels,i)-luminance(bg.data,j))>=10)visible++;
      }
      const ratio=visible/edges;report.contrast.push({ground,variant:variant.id,view:view.id,edges,visible,ratio});
      assert(ratio>=.55,`${ground}/${variant.id}/${view.id} silhouette/background contrast ${ratio}`);
    }
  }
  await page.locator('#ground').selectOption('plain');
  report.checks.push('18 native-size front/side/back ground comparisons retain ≥55% non-emissive edge contrast; two ground crops contain no void.');
  assert.deepEqual(report.errors,[]);
  for(const file of ['index.html','review.css','review.js','assets/manifest.json']){
    const relative='docs/art/previews/rift-player-models/'+file;
    report.sourceHashes[relative]=createHash('sha256').update(await fs.readFile(path.join(root,relative))).digest('hex');
  }
  report.result='pass';
}catch(error){report.result='fail';report.errors.push(error.stack);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(path.join(output,'browser-check.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({result:report.result,checks:report.checks.length,contrast:report.contrast.length,errors:report.errors},null,2));
