/** Replay the measured 37/50 -> 55 controller failure, without generating maps. */
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {NativeSpatialGeometryArchive} from '../../src/generation/world-study/native-spatial-generation.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW report path');
const receiptPath='docs/qa/artifacts/native-spatial-2026-10-14/production-gel-core-shoulder-round1.json',receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8')),failure=receipt.failures[0],attempt=failure.diagnostics.attempts[0],rows=new Map(attempt.candidates.map(row=>[row.candidate,row])),archive=new NativeSpatialGeometryArchive(failure.recipe.nativeSpatial.policy),cases=[];
assert(receipt.sourcesStable);assert.deepEqual(rows.get(55).feedbackArchiveCandidates,[37,50]);
function proposal(id){const row=rows.get(id);assert(row?.gates.geometry&&row.geometryHash);return{layout:{candidate:id,requestedCounts:row.requestedCounts,countPairIndex:row.countPairIndex,bayCountIndex:row.bayCountIndex},gate:row.gates.geometry,fingerprint:{hash:row.geometryHash,canonical:`fixed-receipt-identity:${row.geometryHash}`}};}
function offer(entry){return archive.offer(entry.layout,entry.gate,entry.fingerprint);}
const best=proposal(37),other=proposal(50);offer(best);offer(other);assert.equal(archive.best.layout.candidate,37);
for(const id of [38,39,40,41]){const result=proposal(id);offer(result);archive.recordRefinement(best,result);}
assert.equal(archive.nextBase.layout.candidate,50);
for(const id of [51,52,53,54]){const result=proposal(id);offer(result);archive.recordRefinement(other,result);}
assert.equal(archive.nextBase,undefined);assert.deepEqual(archive.candidateIds,[]);assert.equal(archive.best.layout.candidate,37);
cases.push({id:'actual-37-and-50-exhaustion-removes-work-veto-but-retains-best-evidence',passed:true,history:archive.baseHistory.filter(row=>[37,50].includes(row.firstCandidate))});
const fresh=proposal(55);offer(fresh);assert.equal(archive.nextBase.layout.candidate,55,'Fresh 55 must receive a refinement opportunity even though exhausted 50 dominates its real gate');assert.equal(archive.best.layout.candidate,37);assert.deepEqual(archive.candidateIds,[55]);
cases.push({id:'actual-dominated-fresh-55-can-become-working-base',passed:true,originalRecordedFront:rows.get(55).feedbackArchiveCandidates,currentWorkingFront:archive.candidateIds,globalBest:archive.best.layout.candidate});
for(let i=0;i<4;i++)archive.recordRefinement(fresh);assert.equal(archive.nextBase,undefined);offer(proposal(56));assert.equal(archive.nextBase.layout.candidate,56);assert.equal(archive.best.layout.candidate,37);
cases.push({id:'later-distinct-fresh-still-gets-work-after-next-base-exhausts',passed:true});
const before=archive.baseHistory.find(row=>row.firstCandidate===37);offer({...best,layout:{...best.layout,candidate:1000}});assert.deepEqual(archive.baseHistory.find(row=>row.firstCandidate===37),before);assert.deepEqual(archive.candidateIds,[56]);assert.equal(archive.nextBase.layout.candidate,56);
// 38 was seen and dominated before ever being used as a base. The policy still
// does not reactivate any seen identity; it neither resets counters nor queues it.
const untried=proposal(38);assert.equal(archive.baseHistory.find(row=>row.firstCandidate===38).refinements,0);offer({...untried,layout:{...untried.layout,candidate:1001}});assert.deepEqual(archive.candidateIds,[56]);
cases.push({id:'seen-identities-neither-reset-exhaustion-nor-reenter-under-new-candidate-ID',passed:true});
const report={status:'passed',createdAt:new Date().toISOString(),sourceHashes:Object.fromEntries(['src/generation/world-study/native-spatial-generation.ts','tools/native-spatial/check-exhausted-front.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),receipt:receiptPath,receiptHash:createHash('sha256').update(fs.readFileSync(receiptPath)).digest('hex'),cases,scope:'Measured gate replay of controller scheduling only. Diagnostic hashes name receipt identities here; actual canonical geometry equality is independently tested. No new geometry compile, budget increase or full map admission.'};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
