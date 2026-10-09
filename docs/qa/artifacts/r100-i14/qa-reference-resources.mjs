/** Recompute retained resource budgets from immutable completed observations. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i14',output=`${base}/qa-reference-resources.json`;
assert(!fs.existsSync(output));const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),refs=new Map();
function read(file){refs.set(file,sha(file));return JSON.parse(fs.readFileSync(file));}
function bind(r){const f=r.file??r.path;assert.equal(sha(f),r.sha256,f);refs.set(f,r.sha256);}
const plan=read(`${base}/resources/policy-freeze.json`),execution=read(`${base}/resources/execution.json`),report=read(`${base}/resources/runtime/report.json`),batch=read(`${base}/qa-continuous-through-12.json`);
assert.equal(execution.exitCode,0);assert.equal(execution.policySha256,sha(`${base}/resources/policy-freeze.json`));bind(execution.report);
for(const r of [plan.release,plan.sourceManifest,...plan.tools])bind(r);
assert.equal(batch.sourceCount,1397);assert.equal(batch.sourceAllStillMatch,true);
assert.equal(report.status,'passed-bounded-lifecycle');assert.deepEqual(report.errors,[]);
assert.equal(report.repetitions,10);assert.equal(report.mixedRebuilds,6);assert.equal(report.samples.length,12);
for(const p of report.rebuildProgress)assert.equal(p.status,'completed');
const warmup=report.rebuildProgress.filter(p=>p.phase==='warmup');assert.deepEqual(warmup.map(p=>p.world),plan.method.warmupWorlds);assert(warmup.every(p=>p.grade==='severe'&&p.seed===20261004));
assert.equal(report.rebuildProgress.filter(p=>p.phase==='identical').length,10);
assert.deepEqual(report.mixedCoverage,report.catalogWorldIds.slice(0,6).map((world,i)=>({world,grade:'low',seed:20261004+i})));
const expectedLabels=['warmed-baseline',...Array.from({length:10},(_,i)=>`identical-${i+1}`),'after-mixed-6'];assert.deepEqual(report.samples.map(s=>s.label),expectedLabels);
const baseline=report.samples[0],stableKinds=[...plan.method.stableCounts,'Shader'];
const rows=report.samples.map(s=>{
 const heap=s.usage.usedSize-baseline.usage.usedSize,backing=(s.usage.backingStorageSize??0)-(baseline.usage.backingStorageSize??0),combined=heap+Math.max(0,backing);
 assert.equal(s.usedHeapGrowth,heap);assert.equal(s.backingGrowth,backing);assert(combined<10*1024*1024);
 for(const kind of stableKinds)assert.equal(s.objects[kind]?.active??0,baseline.objects[kind]?.active??0,`${s.label}/${kind}`);
 return {label:s.label,heapGrowthBytes:heap,backingGrowthBytes:backing,combinedRetainedGrowthBytes:combined,combinedRetainedGrowthMiB:combined/1024/1024,active:Object.fromEntries(stableKinds.map(k=>[k,s.objects[k]?.active??0]))};
});
const tool=fs.readFileSync(plan.tools[0].path,'utf8');assert.equal((tool.match(/await cdp.send\('HeapProfiler.collectGarbage'\)/g)||[]).length,2);
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:'bounded-reference-owned-resources-pass',tool:{file:import.meta.filename,sha256:sha(import.meta.filename)},release:plan.release,
 sourceBinding:{continuousAudit:`${base}/qa-continuous-through-12.json`,sourceCount:1397,allStillMatch:true},
 host:execution.host,powerAfter:execution.powerAfter,measurement:{identical:10,mixed:6,warmupFamilies:6,samples:12,gcCallsPerSample:2,totalGcCallsByFrozenCode:24,budgetMiB:10,maxCombinedRetainedMiB:Math.max(...rows.map(r=>r.combinedRetainedGrowthMiB)),stableActiveKinds:stableKinds},rows,
 limitations:['One reference machine, six source-family warmups plus10same/6mixed diagnostics; not natural48 or all108/324 resources.',
 'Combined budget is main-isolate used heap plus positive backing growth, not process RSS, embedder heap sum, GPU driver bytes or per-world64MiB CPU/GPU cache estimation.',
 'Original runner checks six owned active object kinds. QA additionally finds Shader active count stable at62; created counters rise as expected and are not live retained counts.',
 'Original runner records neither browser.version nor GPU identity; Chrome155 environment is bound by the adjacent runtime execution and fixed Chrome executable, not relabelled as an in-page resource-report measurement.',
 'Resource budget success does not close current CPU/material timing failures, real weaker hardware, actual listening or human final acceptance.'],references:[...refs].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,sha256:sha(output),status:result.status,measurement:result.measurement}));
