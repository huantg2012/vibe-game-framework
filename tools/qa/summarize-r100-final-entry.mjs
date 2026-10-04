/** Bind actual final formal entry/cold recovery records to the immutable 284-dependency receipts. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const folder=process.argv[2]??'docs/qa/artifacts/r100-i06/final-runtime/formal-entry',final=path.dirname(folder),read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const request=read(`${folder}/coverage-request.json`),index=read(`${final}/packages/index.json`),snapshot=read(request.sourceSnapshot),records=[],sources=new Map();
assert.equal(sha('tools/qa/check-r100-production-browser.mjs'),request.scriptSHA256,'execution script changed during matrix');
for(const part of ['part-a','part-b']){
 const file=`${folder}/${part}/report.json`,report=read(file);assert.equal(report.status,'passed',`${part} incomplete or failed`);assert.equal(report.cases.length,30);
 for(const [p,h]of Object.entries(report.loadedSourceHashes)){assert(!sources.has(p)||sources.get(p)===h,`served source conflict: ${p}`);sources.set(p,h);}
 for(const row of report.cases){assert.equal(row.status,'passed');assert.deepEqual(row.errors,[]);assert.equal(row.bodyGeometry.version,1);assert(row.bodyGeometry.coldBodyPositionPreserved&&row.coldIdentityPreserved);records.push({path:file,part,...row});}
}
assert.equal(records.length,60);const key=r=>`${r.world}/${r.grade}`;assert.equal(new Set(records.map(key)).size,60);
for(const row of index.worlds)for(const grade of row.grades)assert(records.some(r=>r.world===row.worldId&&r.grade===grade));
const sourceDifferences=Object.entries(snapshot.sources).filter(([p,h])=>sha(p)!==h).map(([p])=>p);assert.deepEqual(sourceDifferences,[],'current src/data/assets differ from final actual served frozen version');
const worldRecords=index.worlds.map(row=>{
 assert.equal(sha(row.dependencyManifest.path),row.dependencyManifest.hash);const dependency=read(row.dependencyManifest.path);assert.equal(dependency.dependencies.length,284);
 for(const d of dependency.dependencies){assert.equal(sha(d.path),d.sha256);if(snapshot.sources[d.path])assert.equal(snapshot.sources[d.path],d.sha256);}
 const cases=records.filter(r=>r.world===row.worldId).map(r=>({worldId:r.world,grade:r.grade,status:r.status,coverage:['production-entry','recovery'],dependencyHash:row.dependencyManifest.hash,report:r.path,controlledRequestedSeed:r.controlledSeed,effectiveSeed:r.identity.seed,identitySignature:r.identity.signature,definitionId:r.runtime.world.id,algorithmRevision:r.identity.generation.package.algorithmRevision,bodyGeometry:r.bodyGeometry,entryScreenshot:`${folder}/${r.part}/${r.world}-${r.grade}-entry.png`,recoveryScreenshot:`${folder}/${r.part}/${r.world}-${r.grade}-restored.png`}));
 for(const c of cases){assert.equal(c.algorithmRevision,2);assert(fs.existsSync(c.entryScreenshot)&&fs.existsSync(c.recoveryScreenshot));}
 return{worldId:row.worldId,grades:row.grades,dependencyManifest:row.dependencyManifest,cases};
});
const servedPath=`${folder}/served-source-hashes.json`;fs.writeFileSync(servedPath,JSON.stringify(Object.fromEntries([...sources].sort()),null,2)+'\n');
const summary={status:'passed',worlds:20,gradeCases:60,formalEntries:60,coldRecoveries:60,replacementDraws:0,failures:0,method:request.method,base:request.base,sourceSnapshot:request.sourceSnapshot,sourceSnapshotSHA256:sha(request.sourceSnapshot),scriptSHA256:request.scriptSHA256,sourceDifferences,servedSourceHashes:{path:servedPath,sha256:sha(servedPath),count:sources.size},dependencyManifestIndex:`${final}/packages/index.json`,runtimeDependencyCount:284,coverage:['production-entry','recovery'],limitations:'Controlled world/grade integration, fresh ordinary inventory and actual renderer/checkpoint/Continue; not a natural journey, economic result, art approval or full gameplay review. Two concurrent browsers make measured long tasks unsuitable as isolated P01 benchmarks. Other historical samples retain their own source revisions.',worldRecords};
const summaryPath=`${folder}/summary.json`;fs.writeFileSync(summaryPath,JSON.stringify(summary,null,2)+'\n');
const evidence=worldRecords.map(row=>({id:`R100-FINAL-PRODUCTION-${row.worldId}`,kind:'runtime',purpose:'production-integration',revision:'r100-native-v3-revision-2',path:summaryPath,worldId:row.worldId,dependencyHash:row.dependencyManifest.hash,grades:row.grades,coverage:['production-entry','recovery'],scope:'Final frozen 3074 formal production menu/grade/entry and complete checkpoint cold Continue, all three grades; body convention 1 and identity/body position preserved.',limitations:summary.limitations}));
fs.writeFileSync(`${folder}/evidence-bindings.json`,JSON.stringify({scope:'Proposed evidence fields only. This file does not modify or approve the R100 ledger.',evidence},null,2)+'\n');
console.log(JSON.stringify({status:summary.status,worlds:20,gradeCases:60,entries:60,coldRecoveries:60,summary:summaryPath,evidence:`${folder}/evidence-bindings.json`}));
