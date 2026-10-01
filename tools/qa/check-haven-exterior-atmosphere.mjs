/** Actual production renderer, isolated browser storage. Controlled seeks prove
 * spatial masks/clock lifecycle, not natural play or human art approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const url=process.env.HAVEN_ATMOSPHERE_URL ?? 'http://127.0.0.1:3027/';
const out=process.env.HAVEN_ATMOSPHERE_OUT ?? 'docs/qa/artifacts/haven-exterior-atmosphere';
const files=['src/art/last-light-joint-exterior.ts','src/art/last-light-exterior.ts','src/art/last-light-renderer.ts','src/scenes/last-light-visual.ts','public/assets/last-light/checksums.json'];
const fingerprint=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const sources=await fingerprint();
const source=await readFile('src/art/last-light-renderer.ts','utf8');
const common=source.match(/const COMMON = `([\s\S]*?)`;/)?.[1];assert(common);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1100,height:800}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));await mkdir(out,{recursive:true});
try{
  await page.goto(url);await page.getByRole('button',{name:'开始',exact:true}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'开始',exact:true}).click();await page.locator('#purif-hud').waitFor({timeout:30000});
  await page.locator('#menu-entry-transition').waitFor({state:'detached',timeout:30000});
  assert.equal(await page.locator('canvas[data-last-light-renderer="webgl2"]').count(),1);
  const clock=()=>page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');return audioManager.game.scene.getScene('PurificationScene').chamber.renderState.exteriorSeconds;});
  const before=await clock();await page.waitForTimeout(300);assert((await clock())>before);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>document.querySelector('#pause-overlay')?.style.display==='flex');
  const blurred=await clock();await page.waitForTimeout(300);assert.equal(await clock(),blurred);
  assert(await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');return audioManager.game.scene.getScene('PurificationScene').scene.isPaused();}));
  await page.keyboard.press('x');await page.waitForFunction(()=>document.querySelector('#pause-overlay')?.style.display==='none');
  await page.waitForTimeout(200);assert((await clock())>blurred);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const reducedBefore=await clock();await page.waitForTimeout(300);assert.equal(await clock(),reducedBefore);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const result=await page.evaluate(async({common})=>{
    const {audioManager}=await import('/src/managers/audio-manager.ts');const scene=audioManager.game.scene.getScene('PurificationScene');scene.scene.pause();
    const r=scene.chamber.renderer,state={...scene.chamber.renderState},gl=r.gl,w=r.canvas.width,h=r.canvas.height;
    const output=document.createElement('canvas');output.width=w;output.height=h;const ctx=output.getContext('2d',{willReadFrequently:true});
    const {createLastLightEnvironmentShader}=await import('/src/art/last-light-exterior.ts');const shader=createLastLightEnvironmentShader(common);
    const current=r.environment,noMass=r.program(shader.replace('color=jointPassingMass(color,farOrigin,surface,time);',''));
    const unclipped=r.program(shader.replace('if(depth<=surface+.02)return vec3(0.,0.,-2000.);',''));
    const noVault=r.program(shader.replace('color=mix(color,vec3(.067,.073,.069),vault*.22);',''));
    const delta=(a,b,mask)=>{let count=0,max=0;for(let i=0;i<a.length;i+=4){if(mask&&!mask[i/4])continue;let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a[i+c]-b[i+c]));if(d)count++;max=Math.max(max,d);}return{pixels:count,max};};
    const capture=(time,program=current,reduced=false)=>{r.environment=program;r.settleExteriorObserver(state.world,time);r.draw({...state,seconds:time,exteriorSeconds:time,reducedMotion:reduced});ctx.clearRect(0,0,w,h);ctx.drawImage(r.canvas,0,0);return{data:ctx.getImageData(0,0,w,h).data,png:output.toDataURL()};};
    const frames=[0,25,30,35,40,44,48,143,151,230].map(time=>{const a=capture(time),b=capture(time,noMass);return{time,png:a.png,mass:delta(a.data,b.data)};});
    capture(35);const depth=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,r.frameBuffer);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,depth);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const protectedMask=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=((h-y-1)*w+x)*4;protectedMask[y*w+x]=depth[i+3]&&depth[i+2]>=3?1:0;}
    const a=capture(35),b=capture(35,noMass),unclippedFrame=capture(35,unclipped);
    const protection=delta(a.data,b.data,protectedMask),occlusion=delta(a.data,unclippedFrame.data);
    const vaultFrame=capture(35,noVault),rightMask=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=Math.floor(w*.6);x<w;x++)rightMask[y*w+x]=1;
    const vault={all:delta(a.data,vaultFrame.data),right:delta(a.data,vaultFrame.data,rightMask),protected:delta(a.data,vaultFrame.data,protectedMask)};
    const reduce=delta(capture(25,current,true).data,capture(40,current,true).data);
    r.environment=current;gl.deleteProgram(noMass.program);gl.deleteProgram(unclipped.program);gl.deleteProgram(noVault.program);capture(35);scene.chamber.texture.source[0].update();
    return{frames,protection,occlusion,vault,reduce,protectedCount:protectedMask.reduce((a,b)=>a+b,0),clock:scene.chamber.renderState.exteriorSeconds};
  },{common});
  for(const frame of result.frames)await writeFile(`${out}/runtime-${frame.time}s.png`,Buffer.from(frame.png.split(',')[1],'base64'));
  result.frames=result.frames.map(({time,mass})=>({time,mass}));
  assert.equal(result.protection.pixels,0);assert(result.protectedCount>50000);assert(result.occlusion.pixels>100,'World-depth occlusion must actually remove silhouette fragments');
  assert.equal(result.reduce.pixels,0);
  assert.equal(result.vault.protected.pixels,0,'Deep vault air must not wash the haven or attached near fabric');
  assert(result.vault.right.pixels>100,'New deep air must be visible in the right-hand opening');
  assert(result.vault.all.max<=5,'Deep air must remain a restrained low-value contribution');
  assert(result.frames.find(f=>f.time===35).mass.pixels>1000,'Giant must actually be visible during window');
  assert.equal(result.frames.find(f=>f.time===25).mass.pixels,0);assert.equal(result.frames.find(f=>f.time===48).mass.pixels,0);
  const paused=await clock();await page.waitForTimeout(300);assert.equal(await clock(),paused);
  // Real scene reconstruction in this test-owned Game, preserving its clock.
  await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');audioManager.game.scene.getScene('PurificationScene').scene.start('MainMenuScene');});
  await page.getByRole('button',{name:'继续',exact:true}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'继续',exact:true}).click();await page.locator('#purif-hud').waitFor({timeout:30000});
  await page.locator('#menu-entry-transition').waitFor({state:'detached',timeout:30000});
  const returned=await clock();assert(returned>=paused,'Scene reentry must retain ambience clock');
  assert.deepEqual(errors,[]);
  assert.deepEqual(await fingerprint(),sources,'Runtime sources / pack changed during QA');
  const report={status:'PASS',at:new Date().toISOString(),url,sources,...result,clocks:{before,blurred,reducedBefore,paused,returned},errors,scope:'Fresh browser root; real WebGL with controlled seeks and shader variants. Dispatched blur verifies actual Scene pause and key resume; reduced-motion and genuine MainMenu/Continue reconstruction. Dispatched blur is not an OS focus test. No natural-play or long-session performance claim.'};
  await writeFile(`${out}/result.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();}
