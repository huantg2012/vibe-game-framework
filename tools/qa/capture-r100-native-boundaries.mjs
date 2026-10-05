/** Legal controlled seats, actual normal FOV and keyboard contact. This is
 * visual/collision evidence, not a natural complete expedition or human review. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i04/native-boundaries');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),report={scope:'Legal controlled full-body starts; normal finite FOV; actual keyboard into native collision; no exposure/zoom changes. Not whole-run play.',cases:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));
const worlds=(process.env.QA_WORLDS??'cinder-ridge,pallid-membrane,silt-gel').split(','),grades=(process.env.QA_GRADES??'low,medium,severe').split(','),seeds=(process.env.QA_SEEDS??'20261004,20261005').split(',');
try{
 for(const world of worlds)for(const grade of grades)for(const seed of seeds){
  const id=`${world}-${grade}-${seed}`;
  await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3052'}/r100-gym.html?world=${world}&grade=${grade}&seed=${seed}`);
  await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});
  const seat=await page.evaluate(async()=>{
   const{audioManager}=await import('/src/managers/audio-manager.ts');const{bodyHasSupport,bodyDisplacementFraction}=await import('/src/systems/ai/physical-grid.ts');const{TileType}=await import('/src/types/game-types.ts');
   const s=audioManager.game.scene.getScene('RiftScene'),w=s.devRuntime.world,g=s.formFloorGrid,choices=[];
   if(!s.nativeBody)throw Error('Native boundary capture requires the formal exact body query');
   for(const mesh of w.meshes){if(w.definition.instances.find(i=>i.id===mesh.spec.id)?.role!=='solid')continue;
    for(let row=1;row<g.rows-1;row++)for(let col=1;col<g.cols-1;col++){
     if(g.getTile(col,row)!==TileType.WALL)continue;
     const x=(col+.5)*g.tileSize,y=(row+.5)*g.tileSize;
     if(w.raster.objectId[Math.floor(y)*w.raster.width+Math.floor(x)]!==mesh.spec.id||y<mesh.spec.y)continue;
     const point={x,y:y+54};if(!bodyHasSupport(g,point,10,10)||!s.nativeBody.supports(point,10,10))continue;
     const fraction=bodyDisplacementFraction(g,point,10,10,0,-72);if(fraction<.12||fraction>.75)continue;
     let supported=true;for(let d=0;d<54;d+=4)if(!w.matterAt(x,y+54-d))supported=false;if(!supported)continue;
     choices.push({point,edge:{x,y},objectId:mesh.spec.id,family:mesh.spec.family,score:Math.abs(x-mesh.spec.x)+(mesh.bounds.maxY-y)*.5,fraction});
    }
   }
   choices.sort((a,b)=>a.score-b.score);if(!choices[0])throw Error('No legal south seat for solid boundary');
   s.probePlacePlayer(choices[0].point.x,choices[0].point.y);return choices[0];
  });
  await page.locator('#game-container').focus();await page.keyboard.down('w');await page.waitForTimeout(90);await page.keyboard.up('w');
  await page.evaluate(async p=>{const{audioManager}=await import('/src/managers/audio-manager.ts');audioManager.game.scene.getScene('RiftScene').probePlacePlayer(p.x,p.y);},seat.point);
  await page.waitForTimeout(200);await page.locator('#game-container canvas').screenshot({path:path.join(out,`${id}-approach.png`)});
  await page.keyboard.down('w');await page.waitForTimeout(750);await page.keyboard.up('w');await page.waitForTimeout(100);
  const after=await page.evaluate(async()=>{
   const{audioManager}=await import('/src/managers/audio-manager.ts');const{bodyHasSupport}=await import('/src/systems/ai/physical-grid.ts');
   const s=audioManager.game.scene.getScene('RiftScene'),p=s.player.getPosition(),sprite=s.player.getSprite(),body=sprite.body;
   const centre={x:body.center.x,y:body.center.y},halfWidth=body.halfWidth,halfHeight=body.halfHeight;
   if(!s.nativeBody)throw Error('Formal native collision is missing after contact');
   // W may slide tangentially along a sloped edge. Probe bounded directions
   // through the same full-body collision API; do not assume W is its normal.
   let blockedSweep=null;
   for(let direction=0;direction<16;direction++){
    const angle=direction*Math.PI/8,dx=Math.cos(angle)*8,dy=Math.sin(angle)*8;
    const fraction=s.nativeBody.displacementFraction(centre,halfWidth,halfHeight,dx,dy);
    if(fraction<1&&(!blockedSweep||fraction<blockedSweep.fraction))blockedSweep={dx,dy,fraction,
      destinationSupported:s.nativeBody.supports({x:centre.x+dx,y:centre.y+dy},halfWidth,halfHeight)};
   }
   return{point:{x:p.x,y:p.y},sprite:{x:sprite.x,y:sprite.y},body:{centre,halfWidth,halfHeight},
    gridSupport:bodyHasSupport(s.formFloorGrid,centre,halfWidth,halfHeight),
    support:s.nativeBody.supports(centre,halfWidth,halfHeight),blockedSweep,state:s.probeBuildLabState()};
  });
  // Persist failed observations too: a failure must retain its legal start,
  // exact body position and both the old grid and current triangle verdicts.
  report.cases.push({id,seat,after});
  assert.equal(after.body.halfWidth,10);assert.equal(after.body.halfHeight,10);
  assert(Math.hypot(after.body.centre.x-after.sprite.x,after.body.centre.y-after.sprite.y)<1e-6,'body centre must match sprite position');
  assert(Math.hypot(after.point.x-after.sprite.x,after.point.y-after.sprite.y)<1e-6,'reported player position must match the sprite');
  assert(after.support,'contact cannot put a complete body inside actual solid matter or missing floor');
  assert(after.blockedSweep&&after.blockedSweep.fraction<1&&!after.blockedSweep.destinationSupported,'further movement into the actual boundary must be rejected');
  await page.locator('#game-container canvas').screenshot({path:path.join(out,`${id}-contact.png`)});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(`${id}: south approach/contact captured`);
 }
 assert.deepEqual(report.errors,[]);report.status='captured';
}catch(error){report.status='failed';report.failure=String(error);console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
