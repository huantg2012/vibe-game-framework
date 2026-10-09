/** Independent completed-report budget review. Never launches a browser. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i14/actor-occlusion',output='docs/qa/artifacts/r100-i14/qa-reference-runtime-after-cache.json';
assert(!fs.existsSync(output),'Preserve prior completed review.');
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const references=new Map();
function read(file){references.set(file,sha(file));return JSON.parse(fs.readFileSync(file));}
function bind(r){const file=r.file??r.path;assert.equal(sha(file),r.sha256,file);references.set(file,r.sha256);}
const plan=read(`${base}/runtime-policy-freeze.json`),execution=read(`${base}/runtime-reference/execution.json`),report=read(`${base}/runtime-reference/report.json`);
assert.notEqual(execution.status,'running','Only review a finished exclusive window.');
assert.notEqual(report.status,'running');
for(const r of [plan.taskContract,plan.sourceManifest,plan.releaseManifest,...plan.dependencies,plan.parentPerformanceFreeze,plan.deltaFreeze,plan.repairChecks])bind(r);
const originalPlan=read(plan.parentPerformanceFreeze.path);for(const key of ['worlds','grade','seed','keys','heldMs','minimumActiveMs','budgets','tools'])assert.deepEqual(plan[key],originalPlan[key],`Original performance contract ${key} unchanged`);
assert.deepEqual(plan.worlds,['hollow-wreckage','buried-lamellae','felt-wedges','white-scarfield']);
assert.deepEqual(report.worlds,plan.worlds);
assert.equal(report.exclusiveWindow,true);
assert.equal(report.environment.browser,'155.0.8059.39');
assert.equal(report.cases.length,4);
assert.equal(report.caseProgress.length,4);
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message);};
const rows=report.cases.map((r,i)=>{
 assert.equal(r.world,plan.worlds[i]);assert.equal(r.grade,'severe');assert.equal(r.seed,20261004);
 assert.equal(report.caseProgress[i].world,r.world);
 assert.equal(r.positions.length,plan.keys.length);
 assert.equal(r.duration,r.end.elapsedMs-r.start.elapsedMs);
 const tests={aliveFor60Seconds:!r.end.ended&&r.duration>=plan.minimumActiveMs,
  frameP95:r.frames.p95<=plan.budgets.frameP95Ms,frameP99:r.frames.p99<=plan.budgets.frameP99Ms,
  frameOver50:r.frames.over50<=plan.budgets.fractionOver50Ms,cpuP95:r.cpu.p95<=plan.budgets.cpuP95Ms,
  materialP95:r.materialSubmit.p95<=plan.budgets.materialSubmissionP95Ms};
 for(const [name,ok]of Object.entries(tests))check(ok,`${r.world}/${name}`);
 assert.equal(r.fullAliveDuration,tests.aliveFor60Seconds);assert.equal(r.budgetPass,Object.values(tests).every(Boolean));
 for(const s of [r.frames,r.cpu,r.materialSubmit])assert(Number.isInteger(s.count)&&s.count>0&&s.p50<=s.p95&&s.p95<=s.p99&&s.p99<=s.max&&s.over50>=0&&s.over50<=1);
 assert.equal(r.browserGPU.logicalSize.width,960);assert.equal(r.browserGPU.logicalSize.height,640);
 return {world:r.world,grade:r.grade,seed:r.seed,durationMs:r.duration,tests,frames:r.frames,cpu:r.cpu,materialSubmit:r.materialSubmit,browserGPU:r.browserGPU,positionsObserved:r.positions.length,start:r.start,end:r.end};
});
check(report.errors.length===0,'pageerrors');check(execution.exitCode===0,'execution exitCode');
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:failures.length?'four-reference-cases-have-failures':'four-reference-cases-budget-pass',
 parentRelease:plan.releaseCandidate,newSource:plan.sourceManifest,delta:plan.deltaFreeze,qualification:'Independent delta budget check; parent RC is provenance pending Director final newRC binding.',tool:{file:import.meta.filename,sha256:sha(import.meta.filename)},executionStatus:execution.status,
 environment:report.environment,powerBefore:execution.powerBefore,powerAfter:execution.powerAfter??null,
 cases:rows,errors:report.errors,failures,
 limitations:['Four preregistered severe Gym diagnostics on one M4 Pro with Chrome155; not natural sorties, not weak hardware, not all108 or remaining34 worlds.',
 'Independent thresholds and full alive duration are recomputed from retained per-case summaries and start/end; raw frame arrays were not retained, so percentiles cannot be independently resampled.',
 'CPU/material figures are main-thread submission timing, not GPU execution. GPU identity is actual browser-reported; no driver memory claim.',
 'Frames during the live sample do not establish main-menu load latency, production cold generation p95, audio perception, visual fatigue or final release.'],
 references:[...references].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(output),status:result.status,failures}));
if(failures.length)process.exitCode=1;
