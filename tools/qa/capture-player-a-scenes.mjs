/** A-model fitting in isolated, real RiftScene instances. No screenshot compositing. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const {chromium}=await import(process.env.COH_PLAYWRIGHT_MODULE||'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output=path.resolve(process.env.COH_CAPTURE_OUT||'docs/qa/artifacts/player-a-three-scenes-2026-10-16');
const base=process.env.COH_REVIEW_BASE_URL||'http://127.0.0.1:3027';
const cases=[
  {id:'cinder-ridge',name:'余烬脊',seed:92,seat:[315.4456,988]},
  {id:'crystal-fibre',name:'晶化林床',seed:156,seat:[720.1732,1237.1862]},
  {id:'ruptured-film',name:'破膜盆地',seed:82,seat:[777.8225,771.9483]},
].filter(c=>!process.env.COH_CAPTURE_WORLD||c.id===process.env.COH_CAPTURE_WORLD);
await fs.mkdir(output,{recursive:true});
const report={date:'2026-10-16',scope:'A selected body model in three approved r13 worlds. Real RiftScene, normal fog/light/occlusion, memory-only unarmed fitting fixture. Full-body-supported controlled placement and short normal keys; scene frozen only for static capture. Not natural exploration or complete combat integration.',cases:[],errors:[],sources:{}};
const browser=await chromium.launch({headless:true,executablePath:process.env.COH_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
report.browser=await browser.version();
try{
  for(const definition of cases){
    const context=await browser.newContext({viewport:{width:1264,height:1000},deviceScaleFactor:1});
    const page=await context.newPage(),entry={...definition,images:[],errors:[]};report.cases.push(entry);
    page.on('pageerror',error=>entry.errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)entry.errors.push(`${response.status()} ${response.url()}`);});
    await context.addInitScript(()=>{
      window.__fittingStorage={reads:0,writes:0};
      for(const [method,counter] of [['getItem','reads'],['setItem','writes'],['removeItem','writes']]){
        const original=Storage.prototype[method];Storage.prototype[method]=function(...args){if(args[0]==='coh-save-v1')window.__fittingStorage[counter]++;return original.apply(this,args);};
      }
    });
    const started=Date.now();
    await page.goto(`${base}/r100-gym.html?world=${definition.id}&grade=medium&seed=${definition.seed}&playerModel=a`);
    await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running||document.querySelector('#error')?.hidden===false,null,{timeout:120000});
    const admission=await page.evaluate(()=>window.__r100Gym?.getState());
    assert(admission?.runtime.running,await page.locator('#error').textContent());
    entry.entryMs=Date.now()-started;entry.recipe=admission.recipe;
    await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');window.__fitScene=audioManager.game.scene.getScene('RiftScene');});
    await page.waitForFunction(()=>{const s=window.__fitScene;return !s.stagedEntry?.isActive()&&!s.nativeEntryFence?.isActive();});
    entry.world=await page.evaluate(()=>{const s=window.__fitScene,w=s.devRuntime.world;return{profile:w.sample?.profile?.id,spawn:w.layout.spawnPoint,meshes:w.meshes.filter(m=>m.spec.blocking===1).map(m=>({id:m.spec.id,bounds:m.bounds}))};});
    entry.placement=await page.evaluate(seat=>{
      const s=window.__fitScene,w=s.devRuntime.world;
      const wanted={x:seat[0],y:seat[1]},fallback=w.layout.spawnPoint;
      const p=s.nativeBody.supports(wanted,10,10)?wanted:fallback;
      if(!s.nativeBody.supports(p,10,10))throw Error('No full-body-supported fitting position');
      s.probePlacePlayer(p.x,p.y);return{requested:wanted,actual:p,fullBodySupported:true};
    },definition.seat);
    await page.locator('#game-container').focus();
    for(const [angle,key] of [['front','s'],['side','d']]){
      await page.evaluate(()=>{const s=window.__fitScene;if(s.scene.isPaused())s.scene.resume();});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.keyboard.down(key);
      await page.waitForFunction(target=>Math.abs(window.__fitScene.player.getFacingAngle()-target)<.02,angle==='front'?Math.PI/2:0,{timeout:3000});
      await page.keyboard.up(key);
      await page.waitForTimeout(220);
      const frame=await page.evaluate(()=>{
        const s=window.__fitScene,player=s.player,cam=s.cameras.main;
        const probe=s.lastLightPlayerPresentation?.getProbe?.()??null;
        const state={position:{...player.getPosition()},groundY:player.getGroundY(),facing:player.getFacingAngle(),oldBodyVisible:player.getSprite().visible,body:{width:player.getSprite().body.width,height:player.getSprite().body.height},nativeSupport:s.nativeBody.supports(player.getPosition(),10,10),camera:{x:cam.worldView.x,y:cam.worldView.y,zoom:cam.zoom},lights:s.devRuntime.worldMaterialLighting.lights,probe,canvasData:{...s.game.canvas.dataset},storage:window.__fittingStorage};
        s.scene.pause();return state;
      });
      assert.equal(frame.oldBodyVisible,false,'Old 32px player still visible');
      assert(frame.probe?.ready,'A model must be loaded and rendered');
      assert.equal(frame.probe.model,'a');
      assert(Math.abs(frame.facing-(angle==='front'?Math.PI/2:0))<.02,'Facing must match the requested static view');
      assert.equal(frame.probe.nativeScale,1,'Use native model scale');
      assert(frame.probe.masked&&frame.probe.contactMasked,'Body/contact must receive real world masking');
      assert.equal(frame.probe.foot.x,frame.position.x);
      assert.equal(frame.probe.foot.y,frame.groundY);
      assert.deepEqual({x:frame.lights[0].x,y:frame.lights[0].y,z:frame.lights[0].z},frame.probe.lamp,'World and body share the same model lamp');
      assert(frame.nativeSupport,'Actual pose must remain on legal support');
      assert.deepEqual(frame.body,{width:20,height:20});
      assert.deepEqual(frame.storage,{reads:0,writes:0});
      const box=await page.locator('#game-container canvas').boundingBox();assert(box);
      assert(Math.abs(box.width-960)<1&&Math.abs(box.height-640)<1,`Unexpected display size ${box.width}×${box.height}`);
      const filename=`${definition.id}-${angle}.png`;
      await page.screenshot({clip:box,path:path.join(output,filename)});
      const px=(frame.position.x-frame.camera.x)*frame.camera.zoom,py=(frame.groundY-frame.camera.y)*frame.camera.zoom;
      const left=Math.round(Math.max(0,Math.min(960-240,px-120))),top=Math.round(Math.max(0,Math.min(640-200,py-120)));
      const detail=`${definition.id}-${angle}-detail.png`;
      await sharp(path.join(output,filename)).extract({left,top,width:240,height:200}).resize(480,400,{kernel:'nearest'}).toFile(path.join(output,detail));
      entry.images.push({angle,file:filename,detail,frame});
    }
    assert.deepEqual(entry.errors,[]);entry.result='pass';await context.close();
    console.log(`${definition.id}: two static real-scene frames captured`);
    await fs.writeFile(path.join(output,'capture.json'),JSON.stringify(report,null,2)+'\n');
  }
  for(const file of ['src/scenes/rift-scene.ts','src/dev/r100-gym.ts','src/dev/rift-gym-runtime.ts','src/entities/player-last-light-presentation.ts','src/entities/player-last-light-math.ts','src/entities/player-last-light-png.ts','src/systems/visibility-system.ts','src/systems/r100-world/presentation.ts','docs/art/previews/rift-player-models/assets/manifest.json']){
    report.sources[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
  }
  report.result='pass';
}catch(error){report.result='fail';report.errors.push(error.stack);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(path.join(output,'capture.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({result:report.result,cases:report.cases.length,errors:report.errors},null,2));
