/** Independent, bounded render-delta evidence join. Historical evidence remains immutable. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i14/', read=f=>JSON.parse(fs.readFileSync(f)), sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const refs=new Map(), ref=file=>{const r={file,sha256:sha(file)};refs.set(file,r.sha256);return r;};
const get=p=>{ref(base+p);return read(base+p);};
function bound(r){const f=r.file??r.path;assert(f&&r.sha256);assert.equal(sha(f),r.sha256,f);ref(f);}
function audit(p,status){const d=get(p);assert.equal(d.status,status,p);for(const r of d.references??[])bound(r);return d;}
const out=base+'qa-actor-cache-delta-recommendation.json';assert(!fs.existsSync(out),'Do not overwrite an independent recommendation.');
const artArg=process.argv.indexOf('--art');assert(artArg>=0,'Require final bounded Art review path');
const artFile=process.argv[artArg+1],art=read(artFile);ref(artFile);
const delta=get('actor-occlusion/delta-freeze.json');bound(delta.oldSource);bound(delta.newSource);
const old=read(delta.oldSource.path),current=read(delta.newSource.path),changes=[];
assert.equal(Object.keys(old.sources).length,1397);assert.equal(Object.keys(current.sources).length,1398);
for(const [file,hash]of Object.entries(current.sources)){assert.equal(sha(file),hash,file);if(old.sources[file]!==hash)changes.push({path:file,before:old.sources[file]??null,after:hash});}
assert.deepEqual(changes.sort((a,b)=>a.path.localeCompare(b.path)),delta.delta);assert(Object.keys(old.sources).every(f=>current.sources[f]));
const staticReview=audit('qa-actor-cache-code-review.json','exact-query-delta-static-and-oracle-review-pass-runtime-pending');
assert.equal(staticReview.oracleEvidence.matchingFullAlphaDigests,8);assert.equal(staticReview.oracleEvidence.matchingPoseSpanDigests,112);
const verification=get('actor-occlusion/code-verification.json');bound(verification.source);assert(verification.all1398FrozenFilesMatchAfterBuild);
for(const command of verification.commands){if(command.command.includes('npm run dev'))continue;assert.equal(command.exitCode,0);for(const r of[command.log,command.report].filter(Boolean))bound(r);}
assert(verification.commands.some(c=>c.command==='npm run build'&&c.exitCode===0));
const perf=audit('qa-reference-runtime-after-cache.json','four-reference-cases-budget-pass');assert.equal(perf.cases.length,4);assert(perf.cases.every(c=>Object.values(c.tests).every(Boolean)));
const entry=audit('qa-render-entry-review.json','six-formal-render-entry-and-cold-records-independently-pass');assert.equal(entry.rows.length,6);assert(entry.allCurrentSourcesMatch);assert(entry.rows.every(r=>r.firstCompleteMs<5000&&r.riftLongTasks.length===0));
const resources=audit('qa-reference-resources-after-cache.json','bounded-reference-owned-resources-pass');assert.equal(resources.measurement.samples,12);assert(resources.measurement.maxCombinedRetainedMiB<=10);
const continuity=get('actor-occlusion/package-continuity.json');assert.equal(continuity.status,'passed-exact-package-delta');assert.equal(continuity.worlds.length,108);assert.equal(continuity.uniqueDependencies,308);
for(const r of[continuity.oldIndex,continuity.newIndex,continuity.source,continuity.delta,continuity.packageLockOutsideSource])bound(r);
// Independently compare the complete authored package payloads and exact two-path dependency changes.
let packagePayloads=0;const deps=new Map();
for(const w of continuity.worlds){assert.deepEqual(w.grades,['low','medium','severe']);assert.equal(sha(w.oldManifest.path),w.oldManifest.hash);assert.equal(sha(w.newManifest.path),w.newManifest.hash);
 const {dependencies:a,...payloadA}=read(w.oldManifest.path),{dependencies:b,...payloadB}=read(w.newManifest.path);assert.deepEqual(payloadA,payloadB);packagePayloads++;
 const prev=new Map(a.map(d=>[d.path,d.sha256])),diff=[];assert.equal(b.length,a.length+1);
 for(const d of b){if(prev.get(d.path)!==d.sha256)diff.push({path:d.path,before:prev.get(d.path)??null,after:d.sha256});if(deps.has(d.path))assert.equal(deps.get(d.path),d.sha256);deps.set(d.path,d.sha256);prev.delete(d.path);}
 assert.equal(prev.size,0);assert.deepEqual(diff.sort((a,b)=>a.path.localeCompare(b.path)),delta.delta);
}
assert.equal(deps.size,308);for(const[f,h]of deps)assert.equal(sha(f),h);
const pairs=[];for(const name of ['v2','v3']){const report=get(`occlusion-visual/${name}/capture-report.json`);assert.equal(report.status,'bounded-capture-completed');assert(report.browsersClosed);assert(report.sourceFilesUnchanged);assert.equal(report.naturalSortiesAdded,0);assert.deepEqual(report.errors,[]);bound(report.policy);
 for(const c of report.cases){assert(c.contextClosed&&c.queryRestored);for(const p of c.pairs){assert(p.observedStateEqual&&p.maskSpansEqual&&p.pngBytesEqual);assert.equal(p.beforeStateSha256,p.afterStateSha256);assert.equal(p.variants.length,2);
  const[a,b]=p.variants;for(const v of p.variants){bound(v.image);assert.equal(fs.statSync(v.image.file).size,v.image.bytes);}
  assert.equal(a.maskSpanSha256,b.maskSpanSha256);assert(fs.readFileSync(a.image.file).equals(fs.readFileSync(b.image.file)));
  pairs.push({world:c.world,id:p.id,report:base+`occlusion-visual/${name}/capture-report.json`,pngEqual:true,maskSpansEqual:true,observedStateEqual:true,coverage:a.playerCoverage??a.compositeCoverage});
 }}
}
assert.equal(pairs.length,6);assert(pairs.every(p=>p.coverage.hidden===0));
// Art's final narrative is consumed with its explicit scope; never convert a capture count into human acceptance.
for(const r of art.references??[])if((r.file||r.path)&&r.sha256)bound(r);
const first=get('qa-continuous-through-12.json');assert.equal(first.uniqueActualSorties,12);assert.equal(first.financialSnapshots,48);assert.equal(first.conservationAssertions,9989);assert.equal(first.all48Complete,false);
for(const r of first.references)if(!r.file.startsWith('src/')&&!r.file.startsWith('public/')&&!r.file.startsWith('data/'))bound(r);
const oldRecommendations=get('qa-release-gate-recommendations.json'),oldRecovery=get('qa-release-gate-recovery.json');
const parentRelease=ref('docs/qa/artifacts/r100-i10-i12/release-candidate.json');
const result={schemaVersion:1,createdAt:new Date().toISOString(),reviewer:'qa',purpose:'render-delta-inheritance-recommendation',status:'recommend-bounded-render-delta-adoption',tool:ref(import.meta.filename),parentRelease,targetSource:delta.newSource,releaseManifestHash:null,
 finalReleaseBinding:'Director must create the new RC and explicitly adopt this recommendation; null is deliberate before sealing, not a release-gate pass.',
 sourceDelta:{oldFiles:1397,newFiles:1398,unchangedPriorFiles:1396,changes,allCurrentSourceBytesMatched:true,packagePayloadsExactlyEqual:packagePayloads,packageGrades:324,uniqueDependencies:308},
 affectedValidation:{exactQuery:{assertionsInCodeReceipt:39757776,realWorlds:8,families:6,alphaDigests:8,actualMethodSpanPairs:112,review:ref(base+'qa-actor-cache-code-review.json'),newIndependentRerun:false},
  productionBuild:{command:'npm run build',exitCode:0,verification:ref(base+'actor-occlusion/code-verification.json'),warning:'Minified chunk >500kB remains; build is not an experience or device pass.'},
  performance:{cases:perf.cases.map(c=>({world:c.world,grade:c.grade,seed:c.seed,durationMs:c.durationMs,cpuP95:c.cpu.p95,materialP95:c.materialSubmit.p95,tests:c.tests})),sameOriginalBudgets:true,originalThreeFailuresPreserved:true},
  entry:{coldMs:entry.coldMs,newEntryMs:entry.newEntryMs,denominator:entry.denominator,noLongTaskInArmedRiftWindow:true,allCasesBelowIndividual5sTarget:true,notPopulationP95:true,preRiftWebsiteAndBaseLongTasksRemain:'51–487ms'},
  resources:resources.measurement,actualVisual:{pairs,partialObserved:false,artReview:ref(artFile),scope:'Six actual same-state normal-context Gym pairs; recorded observed exporters, mask spans and PNG bytes exactly match. Gym does not enable formal Combat/AI checkpoint exports. Actual partial occlusion and complete facing/continuous animation coverage were not obtained.'}},
 inheritanceRecommendations:[
  {scope:'108 world / 324 grade bounded internal qualification',recommendation:'inherit-with-explicit-new-dependency-manifests',basis:'Complete authored payloads unchanged; exact query proof/oracle and bounded actual draw, entry, resource and performance evidence cover this two-file presentation change.',notClaimed:'108 new runtime runs, new human art acceptance, all seeds or full-library performance.'},
  {scope:'COVERAGE / ECONOMY / RECOVERY evidence',recommendation:'rebind-bounded-prior-evidence-after-new-RC',basis:'Generation, grades, gameplay, economy, inventory and persistence remain byte-identical. Current three-grade new-source cold restoration preserves complete saved commitments; prior focus logic remains identical.',notClaimed:'The old release-gate JSON automatically has a new release hash, or current hidden/OS-app/cross-engine/weak-device execution.'},
  {scope:'I14 continuous chain',recommendation:'retain-first12-and-continue-exact-earned-state-for36',basis:'First12 stay1397-source historical runs; subsequent36 must bind1398source and a Director-approved delta. Exact predecessor storage and every adjacent prepared→before complete record remain mandatory.',notClaimed:'48 completed or48 all on the new source; diagnostic entry3/visual/performance do not enter the natural denominator.'},
  {scope:'ART / RELEASE and finalAcceptance',recommendation:'remain-pending',basis:'No actual new hearing, prolonged visual fatigue, real weaker device or user RC final acceptance exists.'}
 ],
 continuousBridgeRequirements:{oldAudit:ref(base+'qa-continuous-through-12.json'),firstTwelveReport:ref(base+'continuous/recovery-v2/batch-01/report.json'),precedingStorage:ref(base+'continuous/recovery-v2/batch-01/i14/browser-storage.json'),retainedFirstTwelve:12,newRemaining:36,grades:'[low,medium,severe]×16 globally; four12-run batches',sameFrozenV2Journey:true,keepOriginalColdFailure:true,sourceSpecificAuditRequired:true,EXPEDITIONPassBefore48:false},
 limits:['This is a narrowly scoped source-delta inheritance recommendation, not a new gate result or release approval.','Original3 performance failures and capture/export failures remain immutable; subsequent causal repair evidence does not change their historical outcome.','All six actual player observations have hidden0: they cannot be called demonstrated front/partial/behind coverage. Original-query full-pixel and real mask-method fixture comparisons carry the edge/partial query equivalence evidence.','Runtime percentiles are recomputed budget decisions from retained aggregate values, not recreated raw frame distributions.','Resource pass covers bounded owned GL counts and main-isolate retained memory, not driver VRAM/RSS, all108 worlds or every per-world64MiB budget.','Same reference M4 Pro / Chrome155; no second actual device or cross-engine claim.','Normal webpage/base long tasks remain; no whole-application latency claim.'],
 references:[...refs].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:ref(out),status:result.status,sourceFiles:1398,packages:packagePayloads,dependencies:deps.size,visualPairs:pairs.length}));
