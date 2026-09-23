/** Read-only live frame/light phase probe after final secondary-light integration. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out=process.env.ARTIFACT_DIR??'docs/qa/artifacts/iteration-30-r8/motion-light';fs.mkdirSync(out,{recursive:true});
const files=['src/art/chamber-device-motion.ts','src/scenes/chamber-device-activity.ts','src/scenes/purification-chamber-lighting.ts'];
const sources=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:out,size:{width:960,height:640}}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));
try {
 await page.goto(process.env.I30_URL??'http://127.0.0.1:3025/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await page.keyboard.press('Enter',{delay:90});await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1600);
 const samples=await page.evaluate(async()=>{const {sampleCoreMotion,sampleDeviceLight}=await import('/src/art/chamber-device-motion.ts');const values=[];
 for(let n=0;n<110;n++){const v=window.__game.scene.getScene('PurificationScene').chamber;const sample={time:v.time,devices:{}};
  for(const id of ['core','growth','purifier']){const layer=v.activity.layers.find(l=>l.id===id),light=v.lighting.emitters.find(e=>e.id===id);sample.devices[id]={frame:layer.frame,light:light.energy,expected:id==='core'?sampleCoreMotion(v.time,v.deviceState.core).light:sampleDeviceLight(id,v.time,id==='growth'?1:v.deviceState.purifier)};}
  values.push(sample);await new Promise(resolve=>setTimeout(resolve,80));}
 return values;});
 const maxErrors={core:0,growth:0,purifier:0};
 for(const sample of samples)for(const id of Object.keys(maxErrors))maxErrors[id]=Math.max(maxErrors[id],Math.abs(sample.devices[id].light-sample.devices[id].expected));
 assert(maxErrors.core<.012,'Core uses common motion envelope with at most one lighting tick of delay');assert(maxErrors.growth<=.00214,'Growth differs by at most one quantized phase step');assert(maxErrors.purifier<=.00321,'Purifier differs by at most one quantized phase step');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300);
 const reduced=await page.evaluate(()=>{const v=window.__game.scene.getScene('PurificationScene').chamber;return {frames:v.activity.layers.map(l=>l.frame),light:v.lighting.emitters.map(e=>e.energy)};});await page.waitForTimeout(800);
 const reducedAfter=await page.evaluate(()=>{const v=window.__game.scene.getScene('PurificationScene').chamber;return {frames:v.activity.layers.map(l=>l.frame),light:v.lighting.emitters.map(e=>e.energy)};});assert.deepEqual(reducedAfter,reduced);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(out,'final-reduced.png')});
 fs.writeFileSync(path.join(out,'phase.json'),JSON.stringify({sources,samples,maxErrors,reduced,reducedAfter,errors,scope:'Fresh normal production entry, real-time read-only phase sampling. Lighting is cached at 80ms; no synthetic events or game state mutation.'},null,2));
 console.log(JSON.stringify({ok:true,maxErrors,samples:samples.length}));
}finally{const video=page.video();await context.close();if(video){await video.saveAs(path.join(out,'paired-light.webm'));fs.unlinkSync(await video.path());}await browser.close();}
