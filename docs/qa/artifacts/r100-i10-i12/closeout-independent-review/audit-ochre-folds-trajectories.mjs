/** Read original P43 logs only. No simulated/replayed game or hidden-state inference. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/closeout-independent-review';
const output=`${base}/ochre-folds-severe-trajectory-review.json`;
assert(!fs.existsSync(output));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({path:file,sha256:sha(file)});
const input=[],attempts=[];
const originalController='tools/qa/r100-revision6-journey.mjs';
assert.equal(sha(originalController),'1386811f4b10785803315d795240dddb3b288fa350db728cbb8fde2b325a1277');
for(const dir of ['011-ochre-folds-severe-20261005','012-ochre-folds-severe-3075192741']){
  const folder=`docs/qa/artifacts/r100-i10-i12/b13-network-recheck/original007-024/play/${dir}`;
  const reportPath=`${folder}/report.json`,logPath=`${folder}/severe/journey.jsonl`;
  input.push(ref(reportPath),ref(logPath));
  const report=JSON.parse(fs.readFileSync(reportPath)),journey=report.realJourneyAttempts[0];
  const rows=fs.readFileSync(logPath,'utf8').trim().split('\n').map((line,index)=>({...JSON.parse(line),line:index+1}));
  const clock=row=>(row.event==='visible-encounter-observation'||row.event==='known-return-budget')?row.elapsedMs:
    row.event==='snapshot'&&row.state?.scene==='rift'?row.state.elapsedMs:null;
  let prior=null;for(const row of rows){if(Number.isFinite(clock(row)))prior={line:row.line,elapsedMs:clock(row)};row.gameClockBefore=prior;}
  let next=null;for(let index=rows.length-1;index>=0;index--){const row=rows[index];if(Number.isFinite(clock(row)))next={line:row.line,elapsedMs:clock(row)};row.gameClockAfter=next;}
  const bracket=row=>({before:row.gameClockBefore,after:row.gameClockAfter});
  const observations=rows.filter(row=>row.event==='visible-encounter-observation');
  const visibleEnemies=row=>row.enemies.map(enemy=>({id:enemy.id,distance:Math.hypot(enemy.position.x-row.position.x,enemy.position.y-row.position.y),
    attack:enemy.attack,position:enemy.position,facing:enemy.facing})).sort((a,b)=>a.distance-b.distance);
  const firstNear={};for(const distance of [175,110,75,52]){const row=observations.find(row=>visibleEnemies(row).some(enemy=>enemy.distance<distance));
    if(row)firstNear[`strictlyBelow${distance}px`]={line:row.line,elapsedMs:row.elapsedMs,hp:row.hp,chaos:row.chaos,position:row.position,enemies:visibleEnemies(row)};}
  const hpDrops=[];let last=null;
  for(const row of observations){if(last&&row.hp<last.hp)hpDrops.push({fromLine:last.line,toLine:row.line,fromElapsedMs:last.elapsedMs,toElapsedMs:row.elapsedMs,
    fromHp:last.hp,toHp:row.hp,position:row.position,chaos:row.chaos,visibleEnemies:visibleEnemies(row)});last=row;}
  if(last&&journey.fieldResult.hp<last.hp)hpDrops.push({fromLine:last.line,to:'report.fieldResult',fromElapsedMs:last.elapsedMs,toElapsedMs:journey.fieldResult.elapsedMs,
    fromHp:last.hp,toHp:journey.fieldResult.hp,position:journey.fieldResult.pos,chaos:journey.fieldResult.chaos,visibleEnemies:null});
  const routes=rows.filter(row=>row.event==='read-only-body-route'),targetChanges=[];let previousTarget=null;
  for(const row of routes.filter(row=>row.target.id!=='exit'))if(row.target.id!==previousTarget){targetChanges.push({line:row.line,id:row.target.id,pos:row.target.pos,clock:bracket(row)});previousTarget=row.target.id;}
  const abandoned=rows.filter(row=>row.event==='abandoned-observed-approach').map(row=>({line:row.line,targetId:row.target.id,reason:row.reason,clock:bracket(row),
    deferredByOriginalController:true,subsequentPlannedUseOfSameTarget:routes.filter(later=>later.line>row.line&&later.target.id===row.target.id).map(later=>later.line)}));
  const searches=journey.searches.map(search=>{
    const log=rows.find(row=>row.event==='snapshot'&&row.label.startsWith('1-search-')&&row.state.elapsedMs===search.elapsedMs);
    return {id:search.id,elapsedMs:search.elapsedMs,hp:search.hp,chaos:search.chaos,decision:search.searchDecision,actualCollectedNodeIds:search.actualCollectedNodeIds,
      snapshotLine:log?.line,deferredByOriginalController:!search.actualCollectedNodeIds.length,
      subsequentPlannedUseOfSameTarget:log?routes.filter(row=>row.line>log.line&&row.target.id===search.id).map(row=>row.line):null};
  });
  const tools=rows.filter(row=>row.event==='known-tool-context-input').map(row=>({line:row.line,clock:bracket(row),label:row.label,key:row.key,slot:row.slot,
    item:row.item,remaining:row.remaining,used:row.used,facePoint:row.facePoint}));
  const swings=rows.filter(row=>row.event==='visible-pursuer-defensive-swing').map(row=>({line:row.line,clock:bracket(row),opponent:row.opponent,weapon:row.weapon}));
  const returnEvents=rows.filter(row=>row.event==='bounded-visible-return-evasion').map(row=>({line:row.line,clock:bracket(row),from:row.from,toward:row.toward,
    keys:row.keys,count:row.count,inputMs:row.inputMs,cumulativeEvasionWallWorkMs:row.elapsedMs,threatIds:row.threatIds}));
  const values=routes.map(row=>row.planningMs).sort((a,b)=>a-b);
  const finalAbandon=rows.findLast(row=>row.event==='abandoned-observed-approach');
  const returnRoute=routes.find(row=>row.line>finalAbandon.line&&row.target.id==='exit');
  const finalRef=journey.fieldResult;
  const result={seed:journey.identity.generation.requestedSeed,identitySignature:journey.identity.signature,report:ref(reportPath),log:ref(logPath),lineCount:rows.length,
    outcome:journey.outcome,final:{elapsedMs:finalRef.elapsedMs,hp:finalRef.hp,chaos:finalRef.chaos,position:finalRef.pos,carried:finalRef.carried},
    explorationGoal:rows.find(row=>row.event==='precommitted-far-geometry-goal').goal,
    targetRouteChanges:targetChanges,firstVisibleNear:firstNear,observedPlayerHpDrops:hpDrops,abandoned,searches,
    inputs:{spacePressCount:rows.filter(row=>row.event==='key'&&row.key==='Space').length,defensiveSwings:swings,
      actualEKeyInputs:rows.filter(row=>row.event==='key-down'&&row.key==='e'||row.event==='key'&&row.key.toLowerCase()==='e').length,
      contextualToolEvents:tools,successfulUseDeductions:tools.filter(row=>row.used>0).length,zeroUseInputs:tools.filter(row=>row.used===0).map(row=>row.line)},
    return:{hasActualReturnEvasion:returnEvents.length>0,events:returnEvents,
      phaseTransitionInference:{afterFinalAbandonLine:finalAbandon.line,firstExitRouteLine:returnRoute.line,clock:bracket(returnRoute),
        basis:'After the final abandonment only exit routes occur, followed by actual exit-only evasion. Earlier exit-planning rows are reserve calculations, not proof that returning already started.'},
      stoppedReserveRows:rows.filter(row=>row.event==='known-return-budget'&&row.stop).map(row=>({line:row.line,elapsedMs:row.elapsedMs,chaos:row.chaos,
        reservedChaos:row.reservedChaos,sum:row.chaos+row.reservedChaos,routeLength:row.routeLength,budgetSpeed:row.budgetSpeed})),
      endedDuringReturn:true},
    navigation:{reportedWarning:journey.navigationWarning,errors:journey.errors,consoleErrors:journey.consoleErrors,
      planningWallMs:{count:values.length,minimum:values[0],median:values[Math.floor(values.length/2)],p95NearestRank:values[Math.ceil(values.length*.95)-1],maximum:values.at(-1),sum:values.reduce((a,b)=>a+b,0)},
      slowest:routes.slice().sort((a,b)=>b.planningMs-a.planningMs).slice(0,3).map(row=>({line:row.line,targetId:row.target.id,planningMs:row.planningMs,geometryReadMs:row.geometryReadMs,nodePlanningMs:row.nodePlanningMs})),
      interpretation:'Approach-kept-dangerous is the controller25s approach cap, not a demonstrated navigation/path failure. No navigationWarning or browser exception was reported. Planning timings are wall work, not CPU profiling or proof of failure causality.'},
    relationToP42:journey.searches.length===0?
      'Different immediate failure path: no tactical.search refusal occurred. The observed-target approach hit its cap under ongoing visible pressure; after HP crossed the search threshold it entered return and died. Policy16 reapproach trigger would not apply to this original trace.':
      'One local overlap: a real visible-opponent-too-close refusal with HP145 and no pickup led to permanent deferral of that target. The same trip also had earlier/later approach caps, further exploration, repeated visible combat inputs and a failed return. That does not establish a shared complete root cause or authorize automatic P42 scope extension.'};
  assert.equal(result.outcome,'death');assert.equal(result.inputs.actualEKeyInputs,0);assert(result.return.hasActualReturnEvasion);
  assert(result.abandoned.every(row=>row.subsequentPlannedUseOfSameTarget.length===0));
  assert(result.searches.every(row=>!row.subsequentPlannedUseOfSameTarget.length));
  attempts.push(result);
}
const report={schemaVersion:1,status:'read-only-p43-trajectory-diagnosis',createdAt:new Date().toISOString(),reviewer:'i12_qa',featureIds:['COH-F052','COH-F013'],
  issueId:'R100-P43',world:'ochre-folds',grade:'severe',attempts,
  conclusion:'The pair is not equivalent to the two P42 first-refusal cases. Seed20261005 never entered guarded search; seed3075192741 has one matching refusal/defer event but subsequently encountered additional targets and failed its return. Both original deaths/zero pickups remain qualification failures.',
  originalController:{...ref(originalController),references:{approachCaps:[286,294],deferredTargetsLifetime:476,abandonedApproachDeferral:497,failedSearchDeferral:502}},
  priorRuleAssessment:ref(`${base}/ochre-folds-severe-rule-assessment.json`),inputs:input,
  limitations:[
    'All enemy facts come from the original currently-visible encounter observations; no hidden AI state, future route, unseen loot or unlogged enemy HP was queried.',
    'Space inputs and defensive-swing logs establish attempted attacks; they do not establish landed damage or kills. The logs contain no sufficient enemy-health damage proof.',
    'Player HP decreases establish actual health loss within logged time brackets. Their exact cause is not assigned from proximity alone.',
    'Input/log events without a game clock are bounded by adjacent real game-clock observations. Evasion elapsedMs is cumulative wall work and is not treated as a run clock.',
    'No Chrome, replay, extra attempt, product edit or policy16 scope extension. No claim that a controller change would solve either original seed.',
  ],harness:ref(`${base}/audit-ochre-folds-trajectories.mjs`)};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,output,sha256:sha(output),attempts:attempts.map(row=>({seed:row.seed,searches:row.searches.length,spacePresses:row.inputs.spacePressCount,
  firstHpDrop:row.observedPlayerHpDrops[0],returnStart:row.return.phaseTransitionInference,planning:row.navigation.planningWallMs}))}));
