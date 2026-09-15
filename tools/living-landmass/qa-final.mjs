import assert from 'node:assert/strict';
import path from 'node:path';
import { LandmassQaDriver } from './qa-driver.mjs';

const driver=new LandmassQaDriver({testCase:'final-native-frame',scene:'living-borne-fin',loadout:'bare'});
let error=null;
async function normalFrame(label){
  await driver.capture(label);
  const canvas=driver.page.locator('canvas[data-spatial-stage="true"]');
  const box=await canvas.boundingBox();
  assert.equal(Math.round(box.width),960);assert.equal(Math.round(box.height),640);
  // A normal viewport gives 1:1 output. This captures the actual scene plus
  // overlay UI in its browser rectangle, without resizing or editing pixels.
  await canvas.screenshot({path:path.join(driver.dir,`${label}-960.png`)});
}
try{
  await driver.open();await driver.page.setViewportSize({width:1240,height:840});
  await driver.start();await driver.recordAudio();
  assert.equal((await driver.fullState()).metadata.worldId,'living-landmass');
  await normalFrame('01-entry');
  await driver.waypoint(592,816,'yx');await driver.waypoint(880,816);await driver.press('w',120);
  await driver.until(s=>s.spatial.tension.phase==='rest','normal resting view');
  await normalFrame('02-rest');
  await driver.until(s=>s.spatial.tension.phase==='pull','normal loaded view',14000);
  await normalFrame('03-loaded');
  const beforeBag=(await driver.read()).snapshot.elapsedMs;
  await driver.press('Tab',80);await driver.page.waitForTimeout(650);
  const bag=await driver.read();assert.equal(bag.paused,false);
  assert(bag.snapshot.elapsedMs-beforeBag>550,'Tab inventory keeps the real world running');
  await driver.press('Tab',80);
  driver.evidence.checks.push('Actual Tab pickup UI does not pause the world');
  await driver.page.locator('#abort').click();await driver.until(s=>!s.running,'normal abort');
  assert.equal(await driver.page.locator('canvas[data-spatial-stage="true"]').count(),0);
  await driver.start();await driver.press('w',200);assert((await driver.read()).snapshot.player.y<940);
  assert.equal(await driver.page.locator('canvas[data-spatial-stage="true"]').count(),1);
  await normalFrame('04-restarted');
  await driver.page.locator('#abort').click();await driver.until(s=>!s.running,'second ordinary stop');
  assert.equal(await driver.page.locator('canvas[data-spatial-stage="true"]').count(),0);
  const records=await driver.page.evaluate(()=>window.__livingLandmass.getRecords());
  assert(records.length===2&&records.every(r=>r.gameplay.metadata.presentationRevision==='i23-living-landmass-native-world'));
  driver.evidence.checks.push('Final native 960x640 normal frames; abort/restart/stop release stage canvases; correct iteration23 records');
  await driver.assertSave('final native frame and lifecycle');
}catch(e){error=e;console.error(e.stack??e);}
const result=await driver.finish(error);if(!result.passed)process.exitCode=1;
