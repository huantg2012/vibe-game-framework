import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.dirname(new URL(import.meta.url).pathname);
const report={scope:'Controlled art seats using probePlacePlayer, not natural play. Coordinates selected from authored geometry only; native full 20px body support checked. Normal gameplay FOV, camera and light; no extra exposure, god mode or hidden entity inspection.',url:'http://127.0.0.1:3087',seed:20261004,grade:'medium',cases:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',error=>report.errors.push(String(error)));
try{
for(const world of ['laminate-shell','film-laminate'])for(const side of ['west','south']){
 await page.goto(`${report.url}/r100-gym.html?world=${world}&grade=medium&seed=${report.seed}`);
 await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});
 const seat=await page.evaluate(async({side})=>{
  const{audioManager}=await import('/src/managers/audio-manager.ts');
  const s=audioManager.game.scene.getScene('RiftScene'),w=s.devRuntime.world,b=s.player.getSprite().body;
  if(s.stagedEntry?.isActive()||s.nativeEntryFence?.isActive())throw Error('Entry incomplete');
  const mesh=w.meshes.find(m=>m.spec.family!==w.definition.family&&w.definition.instances.find(i=>i.id===m.spec.id)?.role==='solid');
  if(!mesh)throw Error('Missing solid secondary family');
  const box=mesh.bounds;
  const target={x:(box.minX+box.maxX)/2,y:(box.minY+box.maxY)/2};
  const ideal=side==='west'?{x:box.minX-42,y:target.y+12}:{x:target.x,y:box.maxY+42};
  const candidates=[];
  for(let y=Math.max(16,Math.floor(ideal.y)-100);y<Math.min(w.raster.height-16,ideal.y+101);y+=8)
   for(let x=Math.max(16,Math.floor(ideal.x)-100);x<Math.min(w.raster.width-16,ideal.x+101);x+=8){
    if(!s.nativeBody.supports({x,y},b.halfWidth,b.halfHeight))continue;
    if(side==='west'&&x>target.x-24||side==='south'&&y<target.y+24)continue;
    candidates.push({x,y,score:Math.hypot(x-ideal.x,y-ideal.y)});
   }
  candidates.sort((a,b)=>a.score-b.score);
  if(!candidates.length)throw Error('No legal full body seat');
  const point=candidates[0];s.probePlacePlayer(point.x,point.y);
  return {point:{x:point.x,y:point.y},side,target,secondary:{id:mesh.spec.id,family:mesh.spec.family,bounds:box},halfWidth:b.halfWidth,halfHeight:b.halfHeight,supportedBefore:true};
 },{side});
 await page.locator('#game-container').focus();
 const key=side==='west'?'d':'w';
 await page.keyboard.down(key);await page.waitForTimeout(100);await page.keyboard.up(key);
 await page.waitForTimeout(500);
 const frame=await page.evaluate(async()=>{
  const{audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game.scene.getScene('RiftScene'),p=s.player.getPosition(),b=s.player.getSprite().body;
  return {position:{x:p.x,y:p.y},bodyCenter:{x:b.center.x,y:b.center.y},halfWidth:b.halfWidth,halfHeight:b.halfHeight,
   supported:s.nativeBody.supports(b.center,b.halfWidth,b.halfHeight),spriteCentered:Math.hypot(p.x-b.center.x,p.y-b.center.y)<1e-6,
   elapsedMs:s.probeBuildLabState().elapsedMs,zoom:s.cameras.main.zoom};
 });
 assert(frame.supported&&frame.spriteCentered,'actual native body must remain supported and synchronized');
 await page.locator('#pause').click();await page.waitForTimeout(100);
 const filename=`${world}-${side}.png`;
 await page.locator('#game-container canvas').screenshot({path:path.join(out,filename)});
 report.cases.push({world,side,seat,key,movementMs:100,frame,image:filename});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(`${world}/${side}: supported normal view captured`);
}
assert.deepEqual(report.errors,[]);report.status='captured';
}catch(error){report.status='failed';report.failure=String(error);console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
