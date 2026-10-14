#!/usr/bin/env node
/** Pure counting calibration. Does not import production code or build geometry. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outputArg=process.argv.slice(2);
assert(outputArg.length<=1,'Usage: node tools/native-spatial/check-route-share-calibration.mjs [report.json]');
const output=resolve(root,outputArg[0]??'docs/qa/artifacts/native-spatial-2026-10-14/route-share-calibration/report.json');
const policyFile=resolve(root,'data/rift-native-spatial-policy.csv');
const policyText=await readFile(policyFile,'utf8');
const [header,row,...extra]=policyText.trim().split(/\r?\n/);
assert.equal(extra.length,0,'Calibration freezes the one currently approved policy row');
const policy=Object.fromEntries(header.split(',').map((key,index)=>[key,row.split(',')[index]]));
const locked={hole_to_solid_ratio:'2',min_route_encounters:'6',min_route_hole_share:'0.60',max_route_hole_share:'0.75',window_size:'6',min_window_holes:'3'};
for(const [key,value]of Object.entries(locked))assert.equal(policy[key],value,`Policy changed: ${key}; recalibration must be explicit`);

const minShare=Number(policy.min_route_hole_share),maxShare=Number(policy.max_route_hole_share);
function candidateCount(holes,total){
  assert(Number.isSafeInteger(holes)&&Number.isSafeInteger(total)&&total>=6&&holes>=0&&holes<=total);
  const share=holes/total,continuous=share>=minShare&&share<=maxShare;
  const phase=holes>=Math.floor(2*total/3)&&holes<=Math.ceil(2*total/3);
  return{accepted:continuous||phase,continuous,phase};
}
// Separate oracle: exact rational legacy band plus counts from actual periodic words.
function legacyExact(holes,total){return 5*holes>=3*total&&4*holes<=3*total;}
function periodicWord(total,phase){return Array.from({length:total},(_,i)=>(i+phase)%3===2?'S':'H').join('');}
function holeCount(word){return [...word].filter(kind=>kind==='H').length;}
function sixWindows(word){
  return Array.from({length:Math.max(0,word.length-5)},(_,i)=>({start:i,holes:holeCount(word.slice(i,i+6))}));
}
function classifyWord(word){
  const holes=holeCount(word),count=candidateCount(holes,word.length),windows=sixWindows(word),windowFailures=windows.filter(w=>w.holes<3).map(w=>w.start);
  return{word,total:word.length,holes,solids:word.length-holes,...count,windows,windowFailures,combinedAccepted:count.accepted&&windowFailures.length===0};
}

const integerDomains=[],phaseCases=[],added=[],removed=[];
let integerChecks=0;
for(let total=6;total<=32;total++){
  const phaseWords=[0,1,2].map(phase=>periodicWord(total,phase));
  const phaseHoleCounts=new Set(phaseWords.map(holeCount));
  const previous=[],calibrated=[];
  for(let holes=0;holes<=total;holes++){
    integerChecks++;
    const legacy=legacyExact(holes,total),actual=candidateCount(holes,total);
    assert.equal(actual.continuous,legacy,`Float legacy band disagrees with rational oracle N=${total},H=${holes}`);
    assert.equal(actual.phase,phaseHoleCounts.has(holes),`Closed-form phase domain disagrees with generated words N=${total},H=${holes}`);
    assert.equal(actual.accepted,legacy||phaseHoleCounts.has(holes));
    if(legacy)previous.push(holes);
    if(actual.accepted)calibrated.push(holes);
    if(actual.accepted&&!legacy)added.push({total,holes});
    if(legacy&&!actual.accepted)removed.push({total,holes});
  }
  integerDomains.push({total,checkedHFrom:0,checkedHThrough:total,checks:total+1,previous,calibrated});
  phaseWords.forEach((word,phase)=>{
    const result=classifyWord(word);
    assert.equal(result.combinedAccepted,true,`Balanced phase rejected N=${total},phase=${phase}`);
    assert(result.windows.every(window=>window.holes===4),'Every periodic six-window must be exactly 4H/2S');
    phaseCases.push({phase,...result});
  });
}
assert.equal(integerChecks,540);
assert.deepEqual(added,[{total:7,holes:4}]);
assert.deepEqual(removed,[]);

const significantNegatives=['HHHHHH','HHHHHS','HHHSSS','SSSSSS','HSHSHSHSHSHS'].map(classifyWord);
for(const result of significantNegatives)assert.equal(result.accepted,false,`Significant count imbalance accepted: ${result.word}`);
const windowCounterexample=classifyWord('SSSSHHHHHHHH');
assert.equal(windowCounterexample.accepted,true,'Counterexample must pass 8H/4S counting');
assert.equal(windowCounterexample.combinedAccepted,false,'Six-window still independently rejects long S cluster');
assert.deepEqual(windowCounterexample.windowFailures,[0]);
const sameCountPositive=classifyWord('HHSHHSHHSHHS');
assert.equal(sameCountPositive.holes,windowCounterexample.holes);
assert.equal(sameCountPositive.combinedAccepted,true);
const legacyNonPeriodic=classifyWord('HHHSHHHSHHHS');
assert.equal(legacyNonPeriodic.continuous,true);
assert.equal(legacyNonPeriodic.phase,false);
assert.equal(legacyNonPeriodic.combinedAccepted,true,'Do not tighten existing 9H/3S acceptance into exact periodicity');

// Eligibility remains outside this count-only helper. Repeated identities are
// deduplicated before counting; a route with three identities is not promoted.
const repeatedJourney=[{id:'h1',kind:'H'},{id:'h2',kind:'H'},{id:'s1',kind:'S'},{id:'h1',kind:'H'},{id:'h2',kind:'H'},{id:'s1',kind:'S'}];
const firstIds=new Map(repeatedJourney.map(event=>[event.id,event.kind]));
assert.equal(firstIds.size,3);
assert.equal(firstIds.size>=Number(policy.min_route_encounters),false);
const report={
  status:'passed',scope:'Independent counting-only Director calibration; no production implementation or user PASS',
  policy:{file:'data/rift-native-spatial-policy.csv',sha256:createHash('sha256').update(policyText).digest('hex'),locked},
  definition:'accepted = original continuous band OR integer H count of a phase of the ideal H,H,S cycle; eligibility and six-window checks remain independent',
  geometryRuns:0,productionImports:0,integerChecks,phaseChecks:phaseCases.length,added,removed,
  integerDomains,phaseCases,significantNegatives,windowCounterexample,sameCountPositive,legacyNonPeriodic,
  identityDiagnostic:{rawEncounters:repeatedJourney.length,uniqueIdentities:firstIds.size,eligible:false},
};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({status:report.status,integerChecks,phaseChecks:phaseCases.length,added,removed,geometryRuns:0,report:output}));
