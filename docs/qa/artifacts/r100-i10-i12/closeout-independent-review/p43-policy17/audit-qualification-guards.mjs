import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const own=path.dirname(fileURLToPath(import.meta.url)),label=process.argv[2]??'v1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ref=file=>({path:file,sha256:hash(fs.readFileSync(file))});
const source='tools/qa/r100-i12-facing-supplement.mjs',raw=fs.readFileSync(source),sourceSha=hash(raw);
const frozen=path.join(own,`facing-supplement-reviewed-${sourceSha.slice(0,12)}.mjs`);
if(!fs.existsSync(frozen))fs.writeFileSync(frozen,raw,{flag:'wx'});
assert.equal(hash(fs.readFileSync(frozen)),sourceSha);
const {validateFacingSupplementJourney}=await import(pathToFileURL(frozen));
const originalPath='docs/qa/artifacts/r100-i10-i12/b13-network-recheck/original007-024/play/011-ochre-folds-severe-20261005/report.json';
const original=JSON.parse(fs.readFileSync(originalPath)).realJourneyAttempts[0];
const attempt={world:'ochre-folds',grade:'severe',seed:20261005};
const binding={originals:new Map([['ochre-folds/severe/20261005',original]]),actualPickupLimit:1};
const copy=value=>structuredClone(value);
function geometry(at=20100,facing=0){return{targetId:'visible-opponent',visible:true,observedElapsedMs:at,
  player:{pos:{x:100,y:100},facing},enemy:{id:'visible-opponent',pos:{x:130,y:100},attack:'idle'},
  hp:145,chaos:40,ended:false,bearing:0,errorDegrees:Number((Math.abs(Math.atan2(Math.sin(-facing),Math.cos(-facing)))*180/Math.PI).toFixed(10)),
  distance:30,withinRange:true,aligned:Math.abs(facing)<=25*Math.PI/180,phaseAllowed:true};}
function record(){const g=geometry();return{index:0,targetId:g.targetId,context:'visible-pursuer',triggerElapsedMs:19990,
  maxDistance:37,minimumHp:45,startedElapsedMs:20000,endedElapsedMs:20300,elapsedMs:300,maxObservedElapsedMs:300,
  status:'allowed',reason:'current-visible-target-aligned',segments:[],turnInputMs:0,finalCheck:g,
  spaceInput:{requestedMs:60,startedElapsedMs:20120,endedElapsedMs:20200,issued:true,finalCheck:g},
  withinTimeBound:true,releasedAllTrackedKeys:true,errors:[]};}
function journey(){return{...copy(original),facingChecks:[record()]};}
function observation(g){return{event:'visible-encounter-observation',elapsedMs:g.observedElapsedMs,position:g.player.pos,facing:g.player.facing,
  hp:g.hp,chaos:g.chaos,ended:g.ended,enemies:g.visible?[{id:g.enemy.id,position:g.enemy.pos,attack:g.enemy.attack}]:[]};}
function logs(j){return j.facingChecks.flatMap(r=>[
  observation({...copy(r.finalCheck??geometry()),observedElapsedMs:r.triggerElapsedMs}),
  ...r.segments.flatMap(s=>[observation(s.before),{event:'facing-turn-input',facingCheckIndex:r.index,...s,endedElapsedMs:null,released:false,waitIssued:undefined},
    {event:'facing-turn-input-end',facingCheckIndex:r.index,...s}]),
  ...(r.finalCheck?[observation(r.finalCheck)]:[]),
  ...(r.spaceInput?.issued?[{event:'facing-space-input',facingCheckIndex:r.index,...r.spaceInput,endedElapsedMs:null,issued:false},
    {event:'key',key:'Space',delay:60},{event:'facing-space-input-end',facingCheckIndex:r.index,...r.spaceInput}]:[]),
  {event:'bounded-melee-facing-check',...r},
  {event:'visible-pursuer-defensive-swing',opponent:r.targetId,attempted:r.status==='allowed',facingCheckIndex:r.index},
]);}
const results=[];
function test(name,expected,mutate=()=>{},mutateLogs=x=>x){const j=journey();mutate(j);const log=mutateLogs(logs(j),j);
  let actual,problems,error;try{problems=validateFacingSupplementJourney(binding,attempt,j,[],log);actual=problems.length?'rejected':'accepted';}
  catch(cause){actual='rejected';error=String(cause.message??cause);}
  results.push({name,expected,actual,status:actual===expected?'pass':'gap',...(problems?{problems}:{}),...(error?{error}:{})});}
test('one chronological visible Space is accepted','accepted');
test('changed complete original identity is rejected','rejected',j=>j.identity.generation.requestedSeed++);
test('changed original earned before save is rejected','rejected',j=>j.before.state.kindlingReserve++);
test('a Space before its facing permission is rejected','rejected',()=>{},log=>{const key=log.find(r=>r.event==='key');return[key,...log.filter(r=>r!==key)];});
test('a Space after its recorded facing window is rejected','rejected',()=>{},log=>{const key=log.find(r=>r.event==='key');return[...log.filter(r=>r!==key),key];});
test('missing original facing Space start trace is rejected','rejected',()=>{},log=>log.filter(r=>r.event!=='facing-space-input'));
test('Space starting after the750ms early-stop/reserve allowance is rejected','rejected',j=>{
  const r=j.facingChecks[0];r.endedElapsedMs=20850;r.elapsedMs=r.maxObservedElapsedMs=850;r.finalCheck.observedElapsedMs=20690;
  r.spaceInput.startedElapsedMs=20700;r.spaceInput.endedElapsedMs=20800;
});
test('a second pursuer opportunity only400ms later is rejected','rejected',j=>{
  const r=copy(j.facingChecks[0]);r.index=1;r.triggerElapsedMs+=400;r.startedElapsedMs+=400;r.endedElapsedMs+=400;
  r.finalCheck.observedElapsedMs+=400;r.spaceInput.startedElapsedMs+=400;r.spaceInput.endedElapsedMs+=400;j.facingChecks.push(r);
});
test('a pre-entry negative opportunity trigger is rejected','rejected',j=>j.facingChecks[0].triggerElapsedMs=-1);
function withSegment(j){const r=j.facingChecks[0];r.segments=[{index:0,keys:['d'],requestedMs:60,
  startedElapsedMs:20020,endedElapsedMs:20090,before:geometry(20010,Math.PI/2),released:true,waitIssued:true}];r.turnInputMs=60;}
test('a real correctly directed segment followed by aligned Space is accepted','accepted',withSegment);
test('opposite direction to currently visible bearing is rejected','rejected',j=>{withSegment(j);j.facingChecks[0].segments[0].keys=['a'];});
test('missing actual segment completion trace is rejected','rejected',withSegment,log=>log.filter(r=>r.event!=='facing-turn-input-end'));
test('direction input while its recorded observation is below health reserve is rejected','rejected',j=>{withSegment(j);j.facingChecks[0].segments[0].before.hp=1;});
test('direction input while its recorded observation is atchaos120 is rejected','rejected',j=>{withSegment(j);j.facingChecks[0].segments[0].before.chaos=120;});
test('direction input while its recorded observation says ended is rejected','rejected',j=>{withSegment(j);j.facingChecks[0].segments[0].before.ended=true;});
test('bounded early abandonment before issuing a direction wait is accepted','accepted',j=>{
  const r=j.facingChecks[0];r.status='abandoned';r.reason='game-time-budget';r.endedElapsedMs=20700;r.elapsedMs=r.maxObservedElapsedMs=700;
  r.finalCheck=geometry(20000,Math.PI/2);r.spaceInput=null;r.turnInputMs=0;
  r.segments=[{index:0,keys:['d'],requestedMs:60,startedElapsedMs:20000,endedElapsedMs:20700,before:r.finalCheck,released:true}];
});
test('actual whole-clock overrun is rejected despite a forged withinTimeBound flag','rejected',j=>{
  const r=j.facingChecks[0];r.endedElapsedMs=21001;r.elapsedMs=r.maxObservedElapsedMs=1001;r.withinTimeBound=true;
});
test('release failure remains invalid despite completed gameplay','rejected',j=>j.facingChecks[0].releasedAllTrackedKeys=false);
const output=path.join(own,`guard-review-${label}.json`);
const report={schema:'coh.qa.policy17-independent-guard-adversaries.v1',status:results.every(r=>r.status==='pass')?'pass':'gaps-found',
  scope:'Synthetic metadata and chronological log mutations against real preserved identity/before. No browser execution and no gameplay success claim.',
  implementation:{path:source,sha256:sourceSha,frozen:path.relative(process.cwd(),frozen)},original:ref(originalPath),
  audit:ref(fileURLToPath(import.meta.url)),counts:{passed:results.filter(r=>r.status==='pass').length,gaps:results.filter(r=>r.status==='gap').length},results};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:ref(output).sha256,status:report.status,...report.counts,gaps:results.filter(r=>r.status==='gap').map(r=>({name:r.name,actual:r.actual,error:r.error}))}));
