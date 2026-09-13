/** Actual skill-created movement/search windows. Only real input; probes are read-only. */
import assert from 'node:assert/strict';
import { SeaQaDriver } from './qa-driver.mjs';
const testCase=process.env.CASE??'control-escape';
assert(['control-escape','lure-search','shore-escape'].includes(testCase));
const loadout=testCase==='control-escape'?'melee':testCase==='shore-escape'?'shore':'light';
const qa=new SeaQaDriver({scene:'sea-open-channel',seed:7,loadout,testCase});
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const enemy=s=>s.frame.enemies.find(e=>e.id==='SS_listener');
function stage(s){return {elapsedMs:s.snapshot.elapsedMs,hp:s.snapshot.hp,player:s.snapshot.player,enemy:enemy(s),tools:s.frame.tools};}
async function wait(predicate,label,timeout=12000){return qa.until(predicate,label,timeout,25);}
async function faceEast(){
  for(let n=0;n<12;n++){if(Math.abs((await qa.read()).frame.player.facing)<.08)return;await qa.press('d',55);}
  throw Error('Ordinary input did not complete an eastward turn');
}
async function faceWest(){
  for(let n=0;n<12;n++){const a=(await qa.read()).frame.player.facing;if(Math.abs(Math.atan2(Math.sin(a-Math.PI),Math.cos(a-Math.PI)))<.08)return;await qa.press('a',55);}
  throw Error('Ordinary input did not complete a westward turn');
}
async function nearFuel(){await qa.waypoint(272,880);await qa.search('02-actual-near-kindling');}
async function westCorridor(y){await qa.move('x',464);await qa.move('y',y);}
async function extract(initial){
  await qa.move('x',464);await qa.move('y',944);await qa.move('x',240);
  await qa.capture('08-actual-return');await qa.press('e',80);
  await wait(s=>s.snapshot.ended,'ordinary extraction',6000);
  await qa.page.waitForFunction(()=>window.__suspendedSea.getRecords().some(r=>r.gameplay.outcome==='extract'),null,{timeout:6000});
  const final=await qa.fullState();const weapon=final.inventory.items.find(i=>i.id===initial.inventory.equipment.weaponId);
  assert.equal(weapon.weapon.usesRemaining,60,'This tactical route does not spend weapon durability');
  assert(final.snapshot.enemies.some(e=>e.id==='SS_listener'&&e.hp>0),'Observed control recovery is on a living enemy, not removal by death');
  await qa.capture('09-extracted-without-killing');
  return final;
}
async function control(initial){
  await westCorridor(272);await qa.move('x',800);
  // Walk toward the real patrolling enemy in short normal steps; do not inject an enemy destination.
  for(let i=0;i<140;i++){
    const s=await qa.read(),e=enemy(s);assert(e&&e.hp>0);const gap=e.position.x-s.snapshot.player.x;
    assert(Math.abs(e.position.y-s.snapshot.player.y)<12,'The actual corridor encounter stays on its authored lane');
    if(gap>=80&&gap<=100)break;
    assert(gap>80,'The approach passed the intended safe deployment range');
    await qa.press('d',100);
    if(i===139)throw Error('No real patrol approach window');
  }
  const before=await qa.read();qa.evidence.observations.push({label:'line-setup',...stage(before)});
  await qa.press(loadout==='shore'?'f':'q',50);await qa.press('Space',50); // ordinary whiff supplies genuine nearby attack noise
  // Move back behind the placed line so the enemy must cross it before reaching melee range.
  // Standing still can leave its centre just outside the line while it attacks.
  await qa.press('a',360);
  const caught=await wait(s=>enemy(s)?.restraint?.snared,'living hearing enemy crosses the actual line',6000);
  const caughtStage=stage(caught);
  await qa.press('a',800);const escaped=await qa.read();
  qa.evidence.observations.push({label:'line-real-retreat',before:caughtStage,after:stage(escaped)});
  assert(caught.snapshot.player.x-escaped.snapshot.player.x>40,'Snare window was spent moving away at least 40 pixels');
  assert(d(enemy(caught).position,enemy(escaped).position)<8,'Real trapped enemy remains stopped during the retreat');
  assert.equal(escaped.snapshot.hp,caught.snapshot.hp,'The actual snare retreat takes no damage');
  await faceEast();await qa.capture('03-line-retreat-window');
  const recovered=await wait(s=>{const e=enemy(s);return e?.hp>0&&!e.restraint?.snared;},'living enemy naturally recovers from the line',4000);
  qa.evidence.observations.push({label:'living-line-recovery',...stage(recovered)});
  if(loadout==='shore'){
    await qa.move('x',464);const end=await extract(initial);
    const a=initial.inventory.items.find(i=>i.contaminant?.type==='stitch');const b=end.inventory.items.find(i=>i.id===a.id);
    assert.equal(a.contaminant.usesRemaining-b.contaminant.usesRemaining,1);
    qa.evidence.checks.push('The shore configuration spends its additional 2.0-weight line to create a measured real escape window, leaves the recovered enemy alive, and extracts without weapon durability loss.');
    return;
  }
  await wait(s=>d(enemy(s).position,s.snapshot.player)<60,'real enemy enters pressure deployment range',5000);
  await qa.press('f',50);
  const pressed=await wait(s=>enemy(s)?.restraint?.pressure,'real living enemy is inside pressure',1000);
  const start=stage(pressed);await qa.press('a',1400);const separated=await qa.read();
  qa.evidence.observations.push({label:'pressure-real-separation',before:start,after:stage(separated)});
  assert(start.player.x-separated.snapshot.player.x>75,'Pressure window was used to physically retreat');
  assert(d(enemy(separated).position,separated.snapshot.player)-d(start.enemy.position,start.player)>25,'Actual distance grows while the pursuing enemy is slowed');
  assert.equal(separated.snapshot.hp,start.hp,'Pressure separation takes no damage');
  await faceEast();await qa.capture('04-pressure-separation-window');
  const released=await wait(s=>{const e=enemy(s);return e?.hp>0&&!e.restraint?.pressure;},'living enemy exits/finishes the pressure and recovers',6500);
  qa.evidence.observations.push({label:'living-pressure-recovery',...stage(released)});
  // Leave immediately once the living recovery was observed; there is no need to fight a recovered pursuer.
  await qa.move('x',464);await qa.capture('05-living-enemy-left-behind');
  const end=await extract(initial);
  const items=end.inventory.items;
  for(const type of ['stitch','compress']){const a=initial.inventory.items.find(i=>i.contaminant?.type===type);const b=items.find(i=>i.id===a.id);assert.equal(a.contaminant.usesRemaining-b.contaminant.usesRemaining,1);}
  qa.evidence.checks.push('One real line cast creates a measured stopped-enemy retreat window; one real pressure cast creates a measured separation window; the same live enemy recovers from both, and the player carries found fuel home without a kill or weapon durability loss.');
}
async function lure(initial){
  await westCorridor(208);await qa.move('x',1104);await qa.move('y',112);await qa.move('x',1456);await qa.move('y',208);await faceWest();
  const pile=initial.layout.contaminantNodes.find(n=>n.id==='SS_foreign-remnant');assert(pile);
  // Wait for the actual patrol to guard its nearby pile. Throw before confirmed chase.
  const ready=await wait(s=>{const e=enemy(s),p=s.snapshot.player;const source={x:p.x-96,y:p.y};return e&&e.hp>0&&e.state!=='chase'&&d(e.position,pile.position)<90&&d(e.position,source)<94;},'ordinary patrol approaches the pile before confirmed chase',26000);
  assert(Math.abs(Math.atan2(Math.sin(ready.frame.player.facing-Math.PI),Math.cos(ready.frame.player.facing-Math.PI)))<.08,'Actual westward turn aims the throw into the far-side ground');
  qa.evidence.observations.push({label:'guard-before-lure',...stage(ready),pile:pile.position});
  await qa.press('q',50);const targeted=await wait(s=>enemy(s)?.targetingLure,'actual unengaged hearing enemy selects the thrown sound',2500);
  qa.evidence.observations.push({label:'actual-lure-recipient',...stage(targeted)});
  const hpBefore=targeted.snapshot.hp;
  await qa.move('y',304);await qa.move('x',1296);
  const before=await qa.read();qa.evidence.observations.push({label:'lure-before-actual-search',...stage(before),pile:pile.position});
  assert(d(enemy(before).position,pile.position)>85,'The real lure recipient has moved away from the guarded pile');
  const remaining=before.snapshot.search.remaining;await qa.press('e',1550);
  const searched=await qa.fullState();
  assert.equal(searched.snapshot.search.remaining,remaining-1,'The created window completes real hold-E searching');
  assert(searched.inventory.items.some(i=>i.source?.nodeId==='SS_foreign-remnant'&&i.location.kind==='carried'),'Actual guarded-pile item is acquired in the bag');
  assert.equal(searched.snapshot.hp,hpBefore,'The lure-created search completes without damage');
  await qa.capture('03-lure-enabled-real-pickup');
  const end=await extract(initial);const q0=initial.inventory.items.find(i=>i.contaminant?.type==='kindle');const q1=end.inventory.items.find(i=>i.id===q0.id);
  assert.equal(q0.contaminant.usesRemaining-q1.contaminant.usesRemaining,1);
  assert(end.inventory.items.some(i=>i.source?.nodeId==='SS_foreign-remnant'&&i.location.kind==='stash'),'Actually acquired guarded item is committed on return');
  qa.evidence.checks.push('One proactive sound throw redirects an actual hearing patrol away from its pile, creates a complete hold-E search and retrieval window, and the real find is extracted without killing or weapon durability loss.');
}
let failure;
try{
  await qa.open();await qa.start();await qa.recordAudio();
  const initial=await qa.fullState();qa.evidence.initialInventory=initial.inventory;
  await qa.capture('01-start');await nearFuel();
  if(testCase==='lure-search')await lure(initial);else await control(initial);
}catch(error){failure=error;console.error(String(error.stack??error));}
const result=await qa.finish(failure);if(!result.passed)process.exitCode=1;
