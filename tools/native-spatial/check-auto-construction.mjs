/** Offline-only checks and optional one-candidate diagnostic. No game/browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {createNativeAutoRuntimeInput,validNativeAutoRuntimeInput} from '../../src/generation/world-study/native-auto-recipe.ts';
import {createNativeAutoCandidate} from '../../src/generation/world-study/native-auto-generation.ts';

const args=process.argv.slice(2),at=args.indexOf('--candidate');
if(at>=0){
  const worldId=args[at+1]??'cinder-ridge',grade=args[at+2]??'medium',seed=Number(args[at+3]??12345),output=args[at+4];
  assert(output,'One candidate requires a new output JSON filename');
  assert(!fs.existsSync(output),'Do not overwrite candidate evidence');
  const native=R100_NATIVE_WORLDS.find(w=>w.id===worldId)?.definitions.find(n=>n.grade===grade);
  assert(native,`Missing source ${worldId}/${grade}`);
  const started=performance.now(),stages=[],report={worldId,grade,seed,scope:'single offline geometry; no content or player acceptance',stages};
  const attempt={geometrySeed:seed,proposalBudget:1,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
  const checkpoint=()=>{if(performance.now()-started>60000)throw new Error('Automatic candidate exceeded 60-second deadline');};
  try{
    const input=createNativeAutoRuntimeInput(native,grade,seed);
    report.input=input;stages.push({stage:'input',elapsedMs:performance.now()-started});
    // The compiler consumes only source, profile identity, seed and spatial
    // contract. This minimal harness is deliberately not a playable recipe.
    const recipe={nativeDefinition:native,profile:{id:worldId},requestedSeed:seed,package:{algorithmRevision:12}};
    const result=createNativeAutoCandidate(recipe,input,attempt,checkpoint);
    report.trace=result.trace;report.plan=result.layout.plan;report.definition=result.layout.definition;
    report.status=result.trace.accepted?'passed':'rejected';process.exitCode=result.trace.accepted?0:2;
  }catch(error){report.status='failed';report.error=error.message;process.exitCode=1;}
  report.attempt=attempt;report.elapsedMs=performance.now()-started;
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,worldId,grade,seed,error:report.error,reasons:report.trace?.reasons,elapsedMs:report.elapsedMs,output}));
}else{
  let inputs=0;
  for(const world of R100_NATIVE_WORLDS)for(const native of world.definitions){
    const input=createNativeAutoRuntimeInput(native,native.grade,12345);
    assert(validNativeAutoRuntimeInput(JSON.parse(JSON.stringify(input)),native,world.id));
    assert.deepEqual(input.nativeSpatial.assemblies.flatMap(a=>[...a.sourceInstanceIds,...a.attachedReliefIds]).sort((a,b)=>a-b),native.instances.map(i=>i.id).sort((a,b)=>a-b));
    const changed=structuredClone(input);changed.sourceFingerprint='00000000';assert(!validNativeAutoRuntimeInput(changed,native,world.id));
    inputs++;
  }
  const native=R100_NATIVE_WORLDS.find(w=>w.id==='cinder-ridge').definitions.find(n=>n.grade==='medium');
  const input=createNativeAutoRuntimeInput(native,'medium',12345);
  assert.deepEqual(input,createNativeAutoRuntimeInput(native,'medium',12345),'Input derivation must be deterministic');
  const other=createNativeAutoRuntimeInput(native,'medium',12346);assert.notEqual(input.geometrySeed,other.geometrySeed);
  assert.deepEqual(input.policy,other.policy,'Seeds must not select a private successful-seed policy');
  console.log(JSON.stringify({status:'passed',inputs,scope:'input derivation and frozen validation; no geometry admission'}));
}
