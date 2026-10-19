/** Real admitted worlds, isolated memory session, controlled optical P/A samples. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=path.resolve('docs/qa/artifacts/rift-vision-study-2026-10-19');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1100,height:1000},deviceScaleFactor:1});
const sourceFiles=['src/systems/visibility-system.ts','src/systems/vision-perception.ts','src/scenes/rift-scene.ts','src/dev/rift-vision-study.ts','src/dev/rift-vision-study.css'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const report={sourcesBefore:await hashes(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),date:'2026-10-19',errors:[],checks:[],samples:[],scope:'DEV real RiftScene; 3 admitted medium worlds; optical P/A projection only; HUD hidden in study, actual combat/economy unchanged. Not production-default integration, full combat/economy/performance acceptance or human visual acceptance.'};
page.on('pageerror',error=>report.errors.push(error.stack ?? error.message));
async function check(name,pass,detail){report.checks.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name);assert(pass,name);}
async function ready(){await page.waitForFunction(()=>window.__visionStudy?.snapshot().state.running,{timeout:90000});await page.waitForTimeout(1800);}
async function set(p,a,mode='perceptual'){await page.evaluate(([p,a,mode])=>window.__visionStudy.set(p,a,mode),[p,a,mode]);await page.waitForTimeout(180);}
async function shot(name){const clip=await page.locator('#stage').boundingBox();await page.screenshot({clip,path:path.join(output,name+'.png')});report.samples.push({name,...await page.evaluate(()=>{const s=window.__visionStudy.snapshot();return {world:s.world,preview:s.preview,player:s.state.probe?.player};})});console.log('SHOT',name);}
try{
 await page.goto('http://127.0.0.1:3027/docs/art/previews/rift-vision-study/?world=crystal-fibre');await ready();
 await page.evaluate(async()=>{const file='/src/managers/audio-manager.ts';const url=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===file).at(-1)?.name??file;window.__visionScene=(await import(url)).audioManager.game.scene.getScene('RiftScene');});
 await set(70,0,'legacy');await shot('crystal-before');
 const query=()=>page.evaluate(()=>{const s=window.__visionScene,p=s.player.getPosition(),v=s.visibility;const samples=[];for(let y=-256;y<=256;y+=16)for(let x=-256;x<=256;x+=16)samples.push(v.getVisibilityAt({x:p.x+x,y:p.y+y}));return {samples,radius:v.getRadiusScale(),facing:s.player.getFacingAngle(),p};});
 const before=await query();await set(70,0);const after=await query();
 await check('presentation switch retains 1089 tactical queries',JSON.stringify(before)===JSON.stringify(after),{beforeRadius:before.radius,afterRadius:after.radius});
 await shot('crystal-after');
 // Canvas capture records the actual engine, rather than animating a screenshot.
 const clipBytes=await page.evaluate(async()=>{
   const canvas=document.querySelector('#game-container canvas'),stream=canvas.captureStream(20);
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const stopped=new Promise(resolve=>{recorder.onstop=resolve;});
   recorder.start();await new Promise(r=>setTimeout(r,8000));recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
   return [...new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())];
 });
 await fs.writeFile(path.join(output,'crystal-motion.webm'),Buffer.from(clipBytes));
 const clock=await page.evaluate(()=>window.__visionScene.visibility.elapsedMs);await page.waitForTimeout(3000);await shot('crystal-motion');
 await check('simulation advances atmosphere',await page.evaluate(()=>window.__visionScene.visibility.elapsedMs)>clock);
 await set(0,0);await shot('crystal-clear');const clean=await query();
 await set(100,0);await shot('crystal-saturated');const saturated=await query();
 await set(100,80);await shot('crystal-adapted');const adapted=await query();
 await check('assimilation restores range without clearing pollution',clean.radius>saturated.radius&&adapted.radius>saturated.radius&&adapted.radius<clean.radius,{clean:clean.radius,saturated:saturated.radius,adapted:adapted.radius});
 await page.evaluate(()=>window.__visionStudy.pause());
 const paused=await page.evaluate(()=>window.__visionScene.visibility.elapsedMs);await page.waitForTimeout(350);
 await check('pause freezes atmosphere clock',paused===await page.evaluate(()=>window.__visionScene.visibility.elapsedMs));await page.evaluate(()=>window.__visionStudy.resume());
 for(const world of ['cinder-ridge','ruptured-film']){
  await page.selectOption('#world',world);await ready();await set(70,0);await shot(world);
  await check(world+' uses real production layout',await page.evaluate(()=>window.__visionStudy.snapshot().state.probe!==null));
 }
 report.sourcesAfter=await hashes();
 await check('capture sources unchanged',JSON.stringify(report.sourcesBefore)===JSON.stringify(report.sourcesAfter));
 await check('no page errors',report.errors.length===0,report.errors);
 const rows=report.samples.map(s=>`<figure><a href="${s.name}.png"><img src="${s.name}.png"></a><figcaption>${s.name} · P${s.preview.pollution} / A${s.preview.assimilation} · ${s.preview.presentation}</figcaption></figure>`).join('');
 await fs.writeFile(path.join(output,'index.html'),`<!doctype html><meta charset="utf-8"><title>视野动态样片 · 运行截图</title><style>body{background:#101718;color:#b9c6bf;font:14px/1.6 sans-serif;margin:32px}a{color:#c6cda4}main{display:grid;grid-template-columns:repeat(2,480px);gap:24px}figure{margin:0}img{width:480px;image-rendering:pixelated}figcaption{margin:6px 0}</style><h1>视野动态样片 · 运行截图</h1><p>受控光学参数；正式地图／角色／材质／遮视。正式默认尚未切换。<a href="/docs/art/previews/rift-vision-study/">打开动态样片</a></p><p>8秒真实引擎动态记录，P70/A0：</p><video controls loop src="crystal-motion.webm" width="960"></video><main>${rows}</main>`);
}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
