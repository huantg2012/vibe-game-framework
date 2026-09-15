import assert from 'node:assert/strict';
import { LandmassQaDriver } from './qa-driver.mjs';
const driver=new LandmassQaDriver({testCase:'support-contact',scene:'living-borne-fin',loadout:'bare'});
let error=null;
try{
  await driver.open();await driver.start();await driver.recordAudio();
  await driver.waypoint(560,880,'yx');await driver.search('01-root-search');
  await driver.waypoint(592,816,'yx');await driver.waypoint(880,816);await driver.waypoint(880,752,'yx');
  const before=await driver.read();
  await driver.until(s=>s.spatial.tension.phase==='rest','stationary rest');
  await driver.capture('02-supported-rest');
  const still=await driver.read();
  await driver.until(s=>s.spatial.tension.phase==='pull','stationary rise',14000);
  const raised=await driver.read();
  assert.equal(raised.snapshot.hp,before.snapshot.hp,'Rising ground outside pinch does not hurt');
  assert.deepEqual(raised.snapshot.player,still.snapshot.player,'Standing player keeps actual XY');
  assert(raised.spatial.playerSupportHeight-still.spatial.playerSupportHeight>9,'Standing support actually rises');
  assert.equal(raised.spatial.presentation.player.groundHeight,raised.spatial.playerSupportHeight);
  await driver.capture('03-supported-rise');
  driver.evidence.checks.push('Actual standing player keeps XY and follows support Z; ordinary rising ground is harmless');
  // Real movement enters the authored pinch; no position/HP/time overrides.
  await driver.waypoint(880,656,'yx');
  const initialHp=(await driver.read()).snapshot.hp;
  await driver.until(s=>s.snapshot.hp<initialHp,'real pinch damage',16000);
  await driver.capture('04-actual-hurt');
  assert.equal((await driver.read()).spatial.tension.committedHits>0,true);
  await driver.until(s=>s.snapshot.ended,'natural death while staying in pinch',100000,200);
  const dead=await driver.read();assert.equal(dead.snapshot.hp,0);
  await driver.capture('05-death');
  const inventory=await driver.items();assert.equal(inventory.some(i=>i.location.kind==='carried'),false);
  const terminal=(await driver.fullState()).spatial;
  await driver.page.waitForTimeout(650);
  assert.equal((await driver.fullState()).spatial.elapsedMs,terminal.elapsedMs);
  assert.deepEqual((await driver.fullState()).spatial.tension,terminal.tension);
  driver.evidence.checks.push('Actual pinch damage reaches death through formal chain; ended clock/support freezes');
  await driver.assertSave('natural death');
}catch(e){error=e;console.error(e.stack??e);}
const result=await driver.finish(error);if(!result.passed)process.exitCode=1;
