/** Read-only execution freeze audit, preserving a copy of the exact preregistered task. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base='docs/qa/artifacts/r100-i13-continuation/',read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),ref=p=>({path:path.relative(process.cwd(),path.resolve(p)),sha256:sha(p)});
const planPath=base+'policy-freeze.json',plan=read(planPath),executionPath=base+'execution.json',execution=read(executionPath),taskCopy=base+'qa-frozen-task.md';
assert.equal(plan.maxAttempts,14);assert.equal(plan.maxContexts,3);assert.equal(plan.cases.reduce((n,r)=>n+r.steps.length,0),14);
assert.equal(sha(planPath),execution.planSha256);assert(Date.parse(plan.createdAt)<=Date.parse(execution.startedAt));
for(const row of [...plan.dependencies,...plan.immutablePriorSources,plan.sourceManifest,plan.preflight])assert.equal(sha(row.file),row.sha256,row.file);
if(!fs.existsSync(taskCopy)){assert.equal(sha(plan.taskContract.file),plan.taskContract.sha256);fs.writeFileSync(taskCopy,fs.readFileSync(plan.taskContract.file),{flag:'wx'});}
assert.equal(sha(taskCopy),plan.taskContract.sha256);
const manifest=read(plan.sourceManifest.file),oldManifest=read('docs/qa/artifacts/r100-i13/frozen-source/source-snapshot.json');
assert.deepEqual(manifest.sources,oldManifest.sources);
for(const [file,hash] of Object.entries(manifest.sources))assert.equal(sha(file),hash);
const reportFacts=[];
for(const c of plan.cases){
  for(const b of [...c.sourceReports,c.sourceTerminal])assert.equal(sha(b.path),b.sha256);
  assert.equal(sha(c.sourceStorage),c.sourceStorageSha256);assert.equal(sha(c.input),c.inputSha256);
  const original=read(c.sourceStorage),input=read(c.input),normalized=structuredClone(original);normalized.origins[0].origin=new URL(plan.gameUrl).origin;
  assert.deepEqual(input,normalized,'Only web origin changes, no original save bytes or extra resources');
  const state=JSON.parse(input.origins[0].localStorage.find(r=>r.name==='coh-save-v1').value);assert.deepEqual(state,read(c.sourceTerminal.path));
  const isEntry=c.id.startsWith('entry-');
  if(isEntry){assert.equal(c.steps.length,2);assert.equal(c.steps[0].grade,c.steps[1].grade);assert.equal(c.fixedFirstWorld,'ash-strata');assert.equal(c.fixedFirstSeed,20261005);assert.equal(c.maxFieldMs,40000);assert.equal(c.searchLimit,2);}
  else assert(!c.fixedFirstWorld);
  const reportPath=base+c.id+'/report.json';
  const fact={caseId:c.id,sourceBranch:c.sourceBranch,input:ref(c.input),sourceTerminal:ref(c.sourceTerminal.path),status:'not-yet-reported',observedAttempts:[]};
  if(fs.existsSync(reportPath)){
    const r=read(reportPath);fact.reportAtAudit=ref(reportPath);fact.status=r.status;
    assert(!r.controlledBuild);assert.equal(r.i13.resourceInjection,false);assert.equal(r.harnessSha256,plan.dependencies.find(d=>d.file.endsWith('/r100-i13-continuation-journey.mjs')).sha256);
    assert.equal(r.i13.sourceControllerSha256,plan.immutablePriorSources.find(d=>d.file.endsWith('/r100-i13-r2-journey.mjs')).sha256);
    assert(!fs.existsSync(base+c.id+'/i13/controlled-build-fixture.json'));
    if(r.realJourneyAttempts[0]?.before)assert.deepEqual(r.realJourneyAttempts[0].before.state,state);
    for(const a of r.realJourneyAttempts){if(!a.identity)continue;
      const fixed=isEntry&&a.ordinal===1;
      assert.equal(a.controlledWorld??null,fixed?'ash-strata':null);
      if(fixed){assert.equal(a.identity.seed,20261005);assert.equal(a.identity.generation.package.id,'r100-ash-strata');}
      fact.observedAttempts.push({ordinal:a.ordinal,status:a.status,grade:a.grade,world:a.identity.generation.package.id,seed:a.identity.seed,mode:fixed?'fixed-diagnostic':'normal-world-selection',noStateInjectionLabel:a.noStateInjection??null,
        labelCaveat:fixed?'Legacy noStateInjection boolean ignores fixedFirstWorld; explicit controlledWorld and identity determine diagnostic mode.':null});
    }
  }
  reportFacts.push(fact);
}
const output=process.argv[process.argv.indexOf('--output')+1];assert(output&&output!==process.argv[0]&&!fs.existsSync(output),'--output must name a new file');
const result={recordedAt:new Date().toISOString(),status:'freeze-and-observed-initial-state-pass',tool:ref(fileURLToPath(import.meta.url)),plan:ref(planPath),executionAtAudit:ref(executionPath),taskSnapshot:ref(taskCopy),currentTaskMatchesFrozen:sha(plan.taskContract.file)===plan.taskContract.sha256,
  productionFilesMatched:Object.keys(manifest.sources).length,toolDependenciesMatched:plan.dependencies.length,immutableSourcesMatched:plan.immutablePriorSources.length,
  dependencyReview:'New journey/encounters/policy/orchestrator and imported QA driver/slots are in the frozen tool list. Production TS imports are covered by the 1397-file source manifest. Browser/runtime packages remain the disclosed host environment, not bundled source.',
  environmentReview:'Frozen orchestrator explicitly clears QA_WORLD_ID, QA_SEED, QA_CONTROLLED_BUILD, QA_REPRO_IDENTITY_FILE and QA_REPLAY_INPUTS. Journey asserts no controlledBuild, no fixedIdentity and no replay input. QA_STORAGE_STATE retains exact original coh-save-v1 bytes with web-origin adaptation only.',
  sourceControllerSha256Meaning:'R2 parent source lineage only; actual executed continuation is harnessSha256 plus frozen dependencies.',reportFacts,
  limits:['This intermediate report binds the files as observed now; unfinished attempts have no accounting/semantic conclusion. Final audit must recheck unchanged frozen sources and complete raw saves.',
    'Entry ordinal1 is fixed diagnostic despite legacy noStateInjection=true. Entry ordinal2 follows normal selection from ordinal1 real terminal, which still requires final identity/continuity audit.',
    'Uncalled inherited controlledBuild fixture code remains in the source. Its guard, cleared environment, absent fixture artifact and raw state audits establish non-execution for this batch; code presence is not evidence of injected resources.']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:ref(output),status:result.status,productionFiles:result.productionFilesMatched,taskMatched:result.currentTaskMatchesFrozen,cases:reportFacts.map(r=>({id:r.caseId,status:r.status,attempts:r.observedAttempts}))}));
