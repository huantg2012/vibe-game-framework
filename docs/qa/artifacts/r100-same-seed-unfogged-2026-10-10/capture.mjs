import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const dir='/Users/yilungao/coh/docs/qa/artifacts/r100-same-seed-unfogged-2026-10-10';
const browser=await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const manifest=[];
try {
for (const grade of ['low','medium','severe']) {
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});
 await page.route('**/src/dev/rift-gym-runtime.ts*',async route=>{
  const response=await route.fetch(); const body=await response.text();
  if(!body.includes('bindDomUiRootToGame(game);')) throw Error('Runtime capture hook missing');
  await route.fulfill({response,body:body.replace('bindDomUiRootToGame(game);','window.__captureGame=game; bindDomUiRootToGame(game);')});
 });
 await page.goto(`http://127.0.0.1:3027/r100-gym.html?world=cinder-ridge&grade=${grade}&seed=20261010`);
 await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:90000});
 const info=await page.evaluate(async()=>{
  const game=window.__captureGame; const scene=game.scene.getScene('RiftScene');
  const {width,height}=scene.devRuntime.world.raster;
  const v=scene.visibility;
  v.getVisibilityAt=()=>1; v.getUnoccludedVisibilityAt=()=>1; v.isPointVisible=()=>true;
  v.queryRevision++; v.update=()=>{};
  for(const key of ['mask','noiseSprite','glowGraphics','corruptionGraphics','flicker','lamp','flashlight']) v[key]?.setVisible(false);
  for(const graphics of v.bandGraphics) graphics.setVisible(false);
  scene.devRuntime.setMotion(false);
  game.scale.resize(width,height);
  const cam=scene.cameras.main;
  cam.stopFollow(); cam.removeBounds(); cam.setViewport(0,0,width,height); cam.setZoom(1); cam.setScroll(0,0);
  await new Promise(resolve=>game.events.once('postrender',resolve));
  await new Promise(resolve=>game.events.once('postrender',resolve));
  game.scene.pause('RiftScene');
  const state=window.__r100Gym.getState();
  return {width,height,recipe:state.recipe,metadata:state.metadata,viewport:{x:cam.scrollX,y:cam.scrollY,zoom:cam.zoom},fogVisible:v.mask.visible};
 });
 await page.addStyleTag({content:`#game-container{position:fixed!important;left:0!important;top:0!important;width:${info.width}px!important;height:${info.height}px!important;max-width:none!important;max-height:none!important;z-index:99999!important;display:block!important;background:#0a0b0d!important}#game-container>canvas{width:${info.width}px!important;height:${info.height}px!important;margin:0!important;display:block!important}#game-container>*:not(canvas){display:none!important}`});
 await page.locator('#game-container canvas').screenshot({path:`${dir}/${grade}.png`});
 manifest.push({grade,...info});
 console.log(grade,info.width,info.height,info.viewport,info.fogVisible);
 await page.close();
}
await writeFile(`${dir}/manifest.json`,JSON.stringify({world:'cinder-ridge',seed:20261010,method:'Production R100 gym; browser-only game reference, visibility bypass, hidden fog overlays, full-map camera at zoom 1, motion frozen. No production source or save changes.',captures:manifest},null,2)+'\n');
} finally {await browser.close();}
