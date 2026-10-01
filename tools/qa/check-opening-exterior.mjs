/** Actual WebGL compositor checks in a fresh test-owned browser. The controlled
 * frames below are renderer evidence, not natural player experience or an art
 * approval. The prior shader is compiled in the same GL context to ensure the
 * production opt-out still produces precisely its former pixels. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const playwright = process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href;
const { chromium } = await import(playwright);
const url = process.env.OPENING_EXTERIOR_URL ?? 'http://127.0.0.1:3027/docs/art/demos/opening-joint/index.html';
const output = process.env.OPENING_EXTERIOR_OUT ?? 'docs/qa/artifacts/opening-exterior-runtime';
const baseline = process.env.OPENING_EXTERIOR_BASELINE ?? 'ed5a07a';
const files = ['src/art/last-light-exterior.ts','src/art/last-light-joint-exterior.ts','src/art/last-light-renderer.ts','src/scenes/last-light-visual.ts','docs/art/demos/opening-joint/entry.ts'];
const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
const rendererSource = await readFile('src/art/last-light-renderer.ts','utf8');
const common = rendererSource.match(/const COMMON = `([\s\S]*?)`;/)?.[1];
assert(common,'Missing common GLSL');
const previous = execFileSync('git',['show',`${baseline}:src/art/last-light-exterior.ts`],{encoding:'utf8'});
const oldModule = ts.transpileModule(previous,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
  .replaceAll("'./last-light-spatial'",JSON.stringify(new URL('/src/art/last-light-spatial.ts',url).href));
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context = await browser.newContext({viewport:{width:1100,height:800}});
const page = await context.newPage(), errors=[], failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push(response.url());});
await mkdir(output,{recursive:true});
let result;
try{
  await page.goto(url);await page.locator('.joint-action:enabled').waitFor({timeout:60000});
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.body.dataset.openingPhase==='playing',null,{timeout:30000});
  assert.equal(await page.locator('#game-container > canvas').getAttribute('data-last-light-renderer'),'webgl2');
  assert.equal(await page.locator('#game-container > canvas').getAttribute('data-last-light-exterior-motion'),'joint-depth');
  result = await page.evaluate(async({oldModule,common})=>{
    const {audioManager}=await import('/src/managers/audio-manager.ts');
    const scene=audioManager.game.scene.getScene('PurificationScene');
    scene.scene.pause();
    const renderer=scene.chamber.renderer,state={...scene.chamber.renderState},gl=renderer.gl;
    const w=renderer.canvas.width,h=renderer.canvas.height;
    const output=document.createElement('canvas');output.width=w;output.height=h;
    const ctx=output.getContext('2d',{willReadFrequently:true});
    const capture=(seconds,joint=true,reduced=false)=>{
      renderer.pack.exteriorMotion=joint?'joint-depth':undefined;
      renderer.settleExteriorObserver(state.world,seconds);
      renderer.draw({...state,seconds,reducedMotion:reduced});
      ctx.clearRect(0,0,w,h);ctx.drawImage(renderer.canvas,0,0);
      const data=ctx.getImageData(0,0,w,h).data;
      return {seconds,data,png:output.toDataURL('image/png')};
    };
    const delta=(a,b,mask)=>{let changed=0,max=0,sum=0;for(let i=0;i<a.length;i+=4){if(mask&&!mask[i/4])continue;let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a[i+c]-b[i+c]));if(d)changed++;max=Math.max(max,d);sum+=d;}return {changedPixels:changed,maxChannelDelta:max,sumMaximumChannelDelta:sum};};
    const frames=[0,4,9,13,17,23].map(t=>capture(t));
    // Draws have already resolved the true per-pixel visibility. Read the depth
    // attachment, including all active layer offsets, rather than assuming a
    // fixed screen-space rectangle is a foreground object.
    const resolved=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,renderer.frameBuffer);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,resolved);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const protectedMask=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const from=((h-y-1)*w+x)*4;protectedMask[y*w+x]=resolved[from+3]&&resolved[from+2]>=3?1:0;}
    const protectedCount=protectedMask.reduce((sum,v)=>sum+v,0);
    const joint=capture(13),off=capture(13,false);
    const foreground=delta(joint.data,off.data,protectedMask);
    const effects=delta(joint.data,off.data);
    const effectFrames=frames.map(frame=>{
      const baselineFrame=capture(frame.seconds,false);
      const isolated=new Int16Array(frame.data.length);
      for(let i=0;i<isolated.length;i++)isolated[i]=frame.data[i]-baselineFrame.data[i];
      return {seconds:frame.seconds,data:isolated};
    });
    const reducedA=capture(2,true,true),reducedB=capture(12,true,true);
    const reduced=delta(reducedA.data,reducedB.data);
    const module=await import(`data:text/javascript;base64,${btoa(oldModule)}`);
    const prior=renderer.program(module.createLastLightEnvironmentShader(common)),current=renderer.environment;
    renderer.environment=prior;const oldProduction=capture(13,false);renderer.environment=current;
    const productionParity=delta(oldProduction.data,off.data);
    gl.deleteProgram(prior.program);
    renderer.pack.exteriorMotion='joint-depth';
    const timing=[];for(let i=0;i<50;i++){const t=performance.now();renderer.draw({...state,seconds:20+i*.033});timing.push(performance.now()-t);}
    capture(13);scene.chamber.texture.source[0].update();
    return {frames:frames.map(frame=>({seconds:frame.seconds,png:frame.png})),protectedCount,foreground,effects,reduced,productionParity,
      deltas:frames.slice(1).map((f,i)=>({from:frames[i].seconds,to:f.seconds,...delta(frames[i].data,f.data)})),
      effectMotionDeltas:effectFrames.slice(1).map((f,i)=>({from:effectFrames[i].seconds,to:f.seconds,...delta(effectFrames[i].data,f.data)})),
      cpuDrawSubmission:{count:timing.length,meanMs:timing.reduce((a,b)=>a+b,0)/timing.length,maxMs:Math.max(...timing),note:'CPU submission, not GPU completion or end-to-end frame rate.'},
      note:'Fixed actor and observer, actual renderer with Scene paused. effectMotionDeltas subtract the no-profile frame at each same time so pre-existing core/fire cannot prove exterior motion. Prior/new production shader parity uses identical joint assets and state.'};
  },{oldModule,common});
  for(const frame of result.frames)await writeFile(path.join(output,`runtime-${String(frame.seconds).padStart(2,'0')}s.png`),Buffer.from(frame.png.split(',')[1],'base64'));
  delete result.frames;
  assert(result.protectedCount>50000,'Expected substantive real near/haven coverage');
  assert.equal(result.foreground.changedPixels,0,'Near fabric / haven must not receive new exterior effects');
  assert.equal(result.productionParity.changedPixels,0,'Production-disabled path must match previous shader');
  assert.equal(result.reduced.changedPixels,0,'Reduced-motion must freeze new fields');
  assert(result.effects.changedPixels>10000,'The new exterior field must actually render');
  assert(result.deltas.every(d=>d.changedPixels>2000),'All sampled phases must have observable pixel changes');
  assert(result.effectMotionDeltas.every(d=>d.changedPixels>5000),'New exterior contribution itself must vary, excluding core/fire changes');
  await page.screenshot({path:path.join(output,'runtime-entry.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  result={status:'PASS',timestamp:new Date().toISOString(),url,baseline,sources,...result,errors,failed};
  await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{await context.close();await browser.close();}
