/** Offline P43 melee-input diagnosis using original observations and pure production geometry. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {swingContactProgress} from '../../../../../../src/systems/weapon-swing.ts';
import {stepAngleToward} from '../../../../../../src/utils/math.ts';
import {GAME_CONSTANTS} from '../../../../../../src/config/constants.ts';
const base='docs/qa/artifacts/r100-i10-i12/closeout-independent-review/p43-melee-input';
const out=`${base}/review.json`;assert(!fs.existsSync(out));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({path:file,sha256:sha(file)});
const source='docs/qa/artifacts/r100-i10-i12/late-low-surfaces-refined-source/source-snapshot.json';
const manifest=JSON.parse(fs.readFileSync(source));
assert.equal(sha(source),'1351b0cfb76e762ca7ef6933e78ff6efb268b5519b96b708c7724f18e941880c');
const files=['src/scenes/rift-scene.ts','src/entities/player.ts','src/systems/combat-system.ts','src/systems/weapon-swing.ts',
  'src/config/constants.ts','src/utils/math.ts','data/weapons.csv','data/weapon-attack-profiles.csv','data/weapon-qualities.csv'];
const exactSource=files.map(file=>{const r=ref(file);assert.equal(r.sha256,manifest.sources[file]);return {...r,exactOriginalSourceBytes:true};});
const csv=fs.readFileSync('data/weapon-attack-profiles.csv','utf8').trim().split(/\r?\n/).map(row=>row.split(','));
const profile=Object.fromEntries(csv[0].map((key,index)=>[key,csv[1][index]]));
const reach=Number(profile.reach_px),arcDeg=Number(profile.arc_deg),windup=Number(profile.windup_ms),active=Number(profile.active_ms),recovery=Number(profile.recovery_ms);
assert.equal(reach,40);assert.equal(arcDeg,120);assert.equal(windup,120);assert.equal(active,60);assert.equal(recovery,220);
const turnRate=GAME_CONSTANTS.PLAYER.FACING_TURN_RATE;
const deg=rad=>rad*180/Math.PI,rad=deg=>deg*Math.PI/180,short=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const attempts=[];
for(const dir of ['011-ochre-folds-severe-20261005','012-ochre-folds-severe-3075192741']){
  const folder=`docs/qa/artifacts/r100-i10-i12/b13-network-recheck/original007-024/play/${dir}`;
  const reportPath=`${folder}/report.json`,logPath=`${folder}/severe/journey.jsonl`;
  const journey=JSON.parse(fs.readFileSync(reportPath)).realJourneyAttempts[0];
  const rows=fs.readFileSync(logPath,'utf8').trim().split('\n').map((row,index)=>({...JSON.parse(row),line:index+1}));
  const inventory=journey.entrySave.state.inventory,weapon=inventory.items.find(item=>item.id===inventory.equipment.weaponId);
  assert.equal(weapon.weapon.definitionId,'crowbar_fine_standard');
  const observe=(row,enemyId)=>{
    const enemy=row.enemies.find(enemy=>enemy.id===enemyId),dx=enemy?enemy.position.x-row.position.x:null,dy=enemy?enemy.position.y-row.position.y:null;
    return {line:row.line,at:row.at,elapsedMs:row.elapsedMs,position:row.position,facingRadians:row.facing,facingDeg:deg(row.facing),
      hp:row.hp,enemy:enemy?{id:enemy.id,position:enemy.position,visiblePhase:enemy.attack,distance:Math.hypot(dx,dy),bearingDeg:deg(Math.atan2(dy,dx)),
        facingErrorDeg:deg(short(Math.atan2(dy,dx)-row.facing)),snapshotContactProgress:swingContactProgress(dx,dy,row.facing,reach,rad(arcDeg))}:null};
  };
  const swings=[];
  for(const row of rows.filter(row=>row.event==='visible-pursuer-defensive-swing')){
    const before=rows.slice(0,row.line-1).findLast(row=>row.event==='visible-encounter-observation');
    const after=rows.slice(row.line).find(row=>row.event==='visible-encounter-observation');
    const press=rows.slice(0,row.line-1).findLast(row=>row.event==='key'&&row.key==='Space');
    const facing=rows.slice(before.line,row.line).find(row=>row.event==='hold'&&row.ms===35);
    const nextHold=rows.slice(row.line).find(row=>row.event==='hold');
    assert(facing&&press.delay===60&&before.elapsedMs<after.elapsedMs);
    const b=observe(before,row.opponent),a=observe(after,row.opponent);
    const x=Number(facing.keys.includes('d'))-Number(facing.keys.includes('a')),y=Number(facing.keys.includes('s'))-Number(facing.keys.includes('w'));
    const intendedFacing=Math.atan2(y,x),nominal35msFacing=stepAngleToward(before.facing,intendedFacing,rad(turnRate)*.035);
    const n=before.enemies.find(enemy=>enemy.id===row.opponent);
    const nominalContact=swingContactProgress(n.position.x-before.position.x,n.position.y-before.position.y,nominal35msFacing,reach,rad(arcDeg));
    assert(b.enemy.distance<=37);assert(after.elapsedMs-before.elapsedMs<windup+active+recovery);
    swings.push({ordinal:swings.length+1,eventLine:row.line,opponent:row.opponent,weaponLabel:row.weapon,before:b,
      facingInput:{line:facing.line,at:facing.at,keys:facing.keys,requestedHoldMs:facing.ms,intendedFacingDeg:deg(intendedFacing),
        nominalMaximumTurnDeg:turnRate*.035,nominal35msFacingDeg:deg(nominal35msFacing),
        nominalStaticTargetContactProgress:nominalContact,
        minimumIdealTurnTimeIntoHalfArcMs:Math.max(0,Math.abs(b.enemy.facingErrorDeg)-arcDeg/2)/turnRate*1000},
      spaceInput:{line:press.line,at:press.at,requestedPressMs:press.delay},after:a,
      timing:{beforeToAfterGameMs:after.elapsedMs-before.elapsedMs,spaceLogToFirstPostObservationWallMs:Date.parse(after.at)-Date.parse(press.at),
        spaceLogToNextMovementWallMs:Date.parse(nextHold.at)-Date.parse(press.at),nextMovement:{line:nextHold.line,keys:nextHold.keys,requestedMs:nextHold.ms},
        note:'Space log precedes the browser key-down; wall intervals are not measured attack-phase times. No accepted-attack timestamp or contact-frame pose was recorded.'},
      postSnapshotOutsideHalfArc:a.enemy?Math.abs(a.enemy.facingErrorDeg)>arcDeg/2:null});
  }
  const gaps=swings.slice(1).map((row,index)=>row.before.elapsedMs-swings[index].before.elapsedMs);
  attempts.push({seed:journey.identity.generation.requestedSeed,report:ref(reportPath),log:ref(logPath),equippedWeapon:{id:weapon.id,definitionId:weapon.weapon.definitionId},
    swings,summary:{loggedSwings:swings.length,postSnapshotsWithSameVisibleTarget:swings.filter(row=>row.after.enemy).length,
      postSnapshotsOutsideHalfArc:swings.filter(row=>row.postSnapshotOutsideHalfArc===true).length,
      inputDistanceRangePx:[Math.min(...swings.map(row=>row.before.enemy.distance)),Math.max(...swings.map(row=>row.before.enemy.distance))],
      preSwingEnemyWindupCount:swings.filter(row=>row.before.enemy.visiblePhase==='windup').length,
      preSwingEnemyStrikeCount:swings.filter(row=>row.before.enemy.visiblePhase==='strike').length,
      minimumBetweenPreSwingObservationGameMs:Math.min(...gaps),
      nextMovementWallMsRange:[Math.min(...swings.map(row=>row.timing.spaceLogToNextMovementWallMs)),Math.max(...swings.map(row=>row.timing.spaceLogToNextMovementWallMs))]}});
}
const illustration=attempts[0].swings[1];
assert.equal(illustration.opponent,'ENM_RWR_01');assert(illustration.after.enemy.facingErrorDeg>140);
assert.equal(illustration.after.enemy.snapshotContactProgress,null);
assert.equal(illustration.facingInput.nominalStaticTargetContactProgress,null);
const report={schemaVersion:1,status:'confirmed-controller-facing-gap-no-hit-rate-claim',createdAt:new Date().toISOString(),reviewer:'i12_qa',issueId:'R100-P43',
  featureIds:['COH-F052','COH-F013'],source:ref(source),exactSource,
  specs:[ref('docs/specs/system-player-weapons.md'),ref('docs/specs/system-combat.md')],
  controller:[ref('tools/qa/r100-revision6-journey.mjs'),ref('tools/qa/r100-i09-costed-encounters.mjs'),ref('tools/qa/i27-journey-driver.mjs')],
  profile:{id:'crowbar',fineDamageRange:[36,44],reachPx:reach,arcDeg,windupMs:windup,activeMs:active,recoveryMs:recovery,
    minimumIntervalMs:Number(profile.min_interval_ms),facingTurnRateDegPerSecond:turnRate,space:'press edge; release does not cancel a committed swing'},
  findings:[
    {id:'P43-QA-MELEE-01',type:'confirmed-input-controller-defect',severity:'medium',
      statement:'The35ms pre-swing face step does not ensure that the observed target lies inside the real locked120-degree attack arc. The controller checks distance but never checks actual player facing before Space.',
      evidence:'Player turning is rate-limited to1080deg/s while nonzero movement input is held.35ms permits37.8degrees nominally; the following released35ms does not complete the turn. beginSwing freezes the current actual facing. Post-input observations retain severe angular error at otherwise legal distances.',
      scope:'This is a defect in the expert QA input controller, not in product crowbar damage, geometry or balance. It does not establish that it caused all P43 deaths, or that a repaired controller would qualify either seed.'},
    {id:'P43-QA-MELEE-02',type:'measurement-limitation',severity:'low',
      statement:'The controller does not wait on its own actual weapon phase before retreat. Nominal60ms Space plus110ms wait is170ms,10ms short of the180ms active end, but observations, geometry and optional tool actions add latency.',
      evidence:'All logged next movement commands occur at least220ms after the Space log in wall time. The logs have no accepted-swing timestamp or phase at contact, so they do not establish a systematic premature retreat. An enemy windup check in caution refers to the enemy, not the player swing.',
      scope:'Do not label the original runs as always cancelling or withdrawing before their own strike. Space release and movement do not cancel the committed attack in product code; movement can still change its live origin.'},
  ],
  geometryInterpretation:{postSnapshotsWithTarget:attempts.reduce((sum,row)=>sum+row.summary.postSnapshotsWithSameVisibleTarget,0),
    postSnapshotsOutsideArc:attempts.reduce((sum,row)=>sum+row.summary.postSnapshotsOutsideHalfArc,0),
    statement:'These are observed geometry counts, not miss or hit rates. Pure production swingContactProgress returns null for the out-of-arc snapshot coordinates, but the actual active/contact-frame coordinates were not recorded. Enemy disappearance or chaos jumps are not treated as damage/kill proof.'},
  attacksMatchRangeAndInputCadence:{distance:'Every logged pre-swing target distance is<=37px, within the40px profile; no fixed out-of-reach trigger found.',
    input:'All15 entries are one60ms Space press, consistent with the production edge-triggered input.',
    cooldown:'Observed pre-swing game-clock gaps exceed the500ms minimum; no static cooldown-mismatch defect found.',
    phase:'Player attackAngle is locked at beginSwing and maintained throughout400ms. Enemy public phases are idle/windup/strike/recover; the original pre-swing guard avoids only enemy windup, with one logged strike-state counterattack. No concealed AI phase was used.'},
  attempts,
  codeEvidence:[
    {path:'tools/qa/r100-i09-costed-encounters.mjs',line:85,rule:'face converts relative target position to real directional keys; no facing-angle completion check'},
    {path:'tools/qa/r100-i09-costed-encounters.mjs',line:204,rule:'enemy windup retreats; distance>37 approaches; otherwise35ms face, Space60, wait110, evade'},
    {path:'tools/qa/i27-journey-driver.mjs',line:20,rule:'Space press logging precedes keyboard dispatch; hold releases keys then waits35ms'},
    {path:'src/config/constants.ts',line:23,rule:'1080deg/s turn rate'},
    {path:'src/entities/player.ts',line:206,rule:'attack pose locks player facing; otherwise turn only with nonzero current movement input'},
    {path:'src/entities/player.ts',line:451,rule:'no movement means no further turn; rate-limited stepFacing'},
    {path:'src/scenes/rift-scene.ts',line:885,rule:'player facing update precedes edge-triggered requestPlayerAttack; combat update follows'},
    {path:'src/systems/combat-system.ts',line:684,rule:'request admission and100ms buffer; beginSwing samples actual player facing'},
    {path:'src/systems/combat-system.ts',line:847,rule:'120ms windup/60ms active/220ms recovery, swept progress handling'},
    {path:'src/systems/combat-system.ts',line:884,rule:'attack origin follows player; locked angle, live target position and LOS determine contact'},
    {path:'src/systems/weapon-swing.ts',line:29,rule:'production40px andhalfarc geometry used directly by this offline audit'},
    {path:'data/weapon-attack-profiles.csv',line:2,rule:'shared crowbar timing/range/arc'},
    {path:'docs/specs/system-player-weapons.md',line:60,rule:'current weapon-family attack and shared contact contract; historical combat defaults are not the current weapon timings'},
  ],
  proposedPolicy17Rules:{status:'recommendation-for-root-protocol-not-executed',
    intent:'Correct facing only for an already eligible planned defensive swing; no extra search retry, new target, additional attack budget or product change.',
    rules:[
      'Keep the same currently visible opponent ID and the existing owned/equipped weapon. Read its visible position/attack cue and actual player facing; never target by hidden AI/HP or future trajectory.',
      'Use genuine short WASD holds to turn; repeat only while the target remains visible and eligible. Before Space, require observed distance<=37px and absolute target-bearing minus player-facing below a declared threshold no wider than60degrees;45degrees is a conservative proposed controller threshold, not a product arc change.',
      'Give each planned swing at most one alignment window, suggested<=300ms actual game time with each movement hold<=35ms. Include all waits and releases; exceed the bound or lose visibility/eligibility and abort that swing. Do not reset any original approach/return/cooldown budget.',
      'After every asynchronous observation/hold and immediately before Space, recheck real distance, player HP/chaos/return reserve, pickup budget, ended state and enemy visible attack cue. At minimum preserve the existing windup retreat; conservatively refuse current strike as well if root freezes that rule. Never exempt a dangerous enemy.',
      'Release every tracked key on success, timeout, condition change or exception. Return to the existing evade/route behavior when alignment cannot be completed; do not add P43 repeat-search episodes or replacement seeds.',
      'Log alignment start/end/max actual clock, all inputs, visible target and player angles/distances, cancellation reason, and public player weapon pose around Space. Keep original15/16 files and P43 failures immutable; freeze17 source/dependency hashes and require exact original seed/source/earned-save/full-identity preservation for any separately approved recheck.',
    ]},
  limitations:['No Chrome, game replay or real input was executed','No per-swing hit, damage, kill or success-rate inference','No policy17 code or protocol changed or approved','Policy16 remains white-scarfield only; this diagnosis does not expand its scope'],
  harness:ref(`${base}/audit.mjs`)};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,output:out,sha256:sha(out),summaries:attempts.map(row=>({seed:row.seed,...row.summary})),illustration:illustration.after}));
