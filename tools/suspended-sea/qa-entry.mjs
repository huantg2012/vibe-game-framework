/** Actual entry and lifecycle boundary checks; no game-state writes. */
import assert from 'node:assert/strict';
import { SeaQaDriver } from './qa-driver.mjs';

const testCase=process.env.CASE??'entry-held';
assert(['entry-natural','entry-held','entry-pause','entry-skip','abort-restart'].includes(testCase));
const qa=new SeaQaDriver({scene:'sea-open-channel',seed:7,loadout:'melee',testCase});
async function down(key) {qa.held.add(key);qa.evidence.inputs.push({kind:'down',key,at:Date.now()});await qa.page.keyboard.down(key);}
async function up(key) {await qa.page.keyboard.up(key);qa.held.delete(key);qa.evidence.inputs.push({kind:'up',key,at:Date.now()});}
const cloneGameplay=state=>({player:state.snapshot.player,hp:state.snapshot.hp,chaos:state.snapshot.chaos,
  enemies:state.snapshot.enemies,inventory:state.inventory,elapsedMs:state.snapshot.elapsedMs});
async function endEntry() {await qa.until(s=>s.snapshot.elapsedMs>100,'natural control handoff',6000);}
let failure;
try {
  await qa.open();await qa.start({waitForControl:false});await qa.recordAudio();
  const initial=await qa.fullState();
  assert(initial.spatial.entry.active,'The actual start is observed during its authored 1200ms entry');
  await qa.capture('01-entry-preparing');
  if(testCase==='entry-natural') {
    const first=await qa.fullState();await qa.page.waitForTimeout(200);const second=await qa.fullState();
    assert(second.spatial.entry.active,'Sample occurs before natural entry completion');
    assert.deepEqual(cloneGameplay(first),cloneGameplay(second),'Entry advances presentation alone, not physics/AI/chaos/search/equipment');
    assert(second.spatial.entry.elapsedMs>first.spatial.entry.elapsedMs,'Entry presentation is establishing');
    await endEntry();await qa.capture('02-control-handed-over');
    await qa.press('w',180);assert(distance(initial.snapshot.player,(await qa.read()).snapshot.player)>4,'Normal movement starts after natural handoff');
    qa.evidence.checks.push('Natural entry freezes the gameplay state, then enables ordinary movement.');
  } else if(testCase==='entry-held') {
    const keys=['w','q','f','Space','e','Tab'];for(const key of keys)await down(key);
    await qa.page.waitForTimeout(1500);
    const held=await qa.fullState();
    assert(!held.spatial.entry.active);assert(held.snapshot.elapsedMs>0);
    assert.deepEqual(held.snapshot.player,initial.snapshot.player,'Held movement does not leak through handoff');
    assert.deepEqual(held.inventory,initial.inventory,'Held attack/tool/search keys do not spend inventory or reveal');
    assert.equal(held.snapshot.attack.phase,'idle');assert.equal(await qa.page.locator('#inventory-panel').count(),0,'Held Tab does not open panel at handoff');
    await qa.capture('02-held-inputs-blocked');for(const key of keys)await up(key);
    await qa.press('w',180);assert(distance(initial.snapshot.player,(await qa.read()).snapshot.player)>4,'Fresh keydown after real keyup moves');
    await qa.press('q',60);await qa.page.waitForTimeout(180);
    assert((await qa.read()).frame.tools.seams.length>0,'Fresh released/repressed skill key works');
    await qa.capture('03-fresh-input-accepted');
    qa.evidence.checks.push('Held WASD/Space/Q/F/E/Tab suppressed through handoff; keyup and fresh press restore normal actions.');
  } else if(testCase==='entry-pause') {
    await down('w');await down('q');await qa.press('Escape',50);
    await qa.until(s=>s.paused,'pause during entry');
    const paused=await qa.fullState();await up('w');await up('q');
    await qa.page.waitForTimeout(500);const still=await qa.fullState();
    assert.deepEqual(still.spatial.entry,paused.spatial.entry,'Paused entry progress freezes');
    assert.deepEqual(cloneGameplay(still),cloneGameplay(paused),'Paused simulation state freezes');
    await qa.capture('02-entry-paused-keyup');
    await qa.press('Escape',50);await endEntry();
    await qa.press('w',180);assert(distance(initial.snapshot.player,(await qa.read()).snapshot.player)>4,'Key released while paused is not stuck blocked after resume');
    await qa.press('q',60);await qa.page.waitForTimeout(180);
    assert((await qa.read()).frame.tools.seams.length>0,'Skill released during pause works on a fresh press');
    await qa.capture('03-entry-resumed-fresh-input');
    qa.evidence.checks.push('Entry pause freezes all clocks; keyup while paused is honored on resume.');
  } else if(testCase==='entry-skip') {
    const before=await qa.fullState();assert(before.spatial.entry.elapsedMs<1000);
    await qa.press('Enter',40);await endEntry();
    const skipped=await qa.fullState();assert(!skipped.spatial.entry.active);
    assert.deepEqual(skipped.snapshot.player,initial.snapshot.player,'Skipping does not advance player position');
    assert.deepEqual(skipped.inventory,initial.inventory,'Skipping does not consume inventory');
    await qa.capture('02-entry-skipped');qa.evidence.checks.push('Real Enter skips the establishing mask and enables the same prepared gameplay state.');
  } else {
    await endEntry();await qa.press('q',60);await qa.until(s=>s.frame.tools.seams.length>0,'actual skill before abort');
    const initialId=(await qa.fullState()).inventory.run.id;
    await qa.capture('02-before-abort');await qa.page.locator('#abort').click();
    await qa.page.waitForTimeout(550);assert(!(await qa.fullState()).running,'Actual abort ends the current scene');
    const audio=await qa.page.evaluate(()=>window.__qaSeaAudioRead());
    assert(!audio.voices.some(v=>v.key.includes('suspended-sea')),'Abort stops old sea audio instances');
    await qa.start();const restarted=await qa.fullState();
    assert.notEqual(restarted.inventory.run.id,initialId,'Restart creates an independent formal run ledger');
    assert.equal(restarted.snapshot.search.remaining,7);assert.equal(restarted.snapshot.hp,100);
    assert.equal(restarted.spatial.shell.hitSequence,0);assert.equal((await qa.read()).frame.tools.seams.length,0);
    await qa.capture('03-restarted-cleanly');qa.evidence.checks.push('Actual abort and restart release old sea audio/effects and create a clean independent run.');
  }
  await qa.assertSave(testCase);
} catch(error) {failure=error;console.error(String(error.stack??error));}
const result=await qa.finish(failure);if(!result.passed)process.exitCode=1;
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
