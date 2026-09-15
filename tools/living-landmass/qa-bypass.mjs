import assert from 'node:assert/strict';
import { LandmassQaDriver } from './qa-driver.mjs';
const driver=new LandmassQaDriver({testCase:'stable-bypass',scene:'living-borne-fin',loadout:'bare'});
let error=null;
try{
  await driver.open();await driver.start();await driver.recordAudio();
  await driver.waypoint(560,880,'yx');await driver.search('01-root-search');
  await driver.waypoint(592,848,'yx');await driver.waypoint(400,848);
  await driver.waypoint(400,624,'yx');await driver.search('02-ridge-search');
  await driver.waypoint(400,432,'yx');await driver.waypoint(704,432);
  await driver.capture('03-before-encounter');
  const enemy=(await driver.read()).snapshot.enemies[0];assert(enemy,'The real listener is present');
  await driver.strikeEnemy(enemy.id);await driver.capture('04-real-encounter');
  await driver.waypoint(912,368);await driver.search('05-far-search');
  await driver.waypoint(880,432);await driver.waypoint(880,560,'yx');await driver.search('06-fin-search');
  assert.equal((await driver.read()).snapshot.search.remaining,0);
  // Return the same continuously safe ridge, without requiring the knot.
  await driver.waypoint(880,432,'yx');await driver.waypoint(400,432);
  await driver.waypoint(400,848,'yx');await driver.waypoint(592,848);await driver.waypoint(592,944,'yx');
  assert.equal((await driver.read()).spatial.tension.hitSequence,0,'Bypass needs no knot intervention');
  await driver.press('e',100);await driver.until(s=>s.snapshot.ended,'ordinary bypass extraction');
  await driver.capture('07-extracted');await driver.assertSave('all four piles and enemy');
  driver.evidence.checks.push('Four actual reveals, real listener encounter and stable ridge extraction without prying');
}catch(e){error=e;console.error(e.stack??e);}
const result=await driver.finish(error);if(!result.passed)process.exitCode=1;
