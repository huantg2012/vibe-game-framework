import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base='docs/qa/artifacts/r100-i14',kit='dist/r100-i14-device-kit-20261009';
const sha=x=>createHash('sha256').update(x).digest('hex');
const refs=[];
function read(file){const bytes=fs.readFileSync(file);refs.push({file,sha256:sha(bytes)});return JSON.parse(bytes);}
const handoff=read(`${base}/root/device-kit/handoff.json`),manifest=read(`${base}/root/device-kit/manifest.json`);
assert.equal(sha(fs.readFileSync(`${kit}/I14-DEVICE-MANIFEST.json`)),handoff.manifestSha256);
assert.deepEqual(JSON.parse(fs.readFileSync(`${kit}/I14-DEVICE-MANIFEST.json`)),manifest);
assert.equal(Object.keys(manifest.files).length,1519);assert.equal(manifest.productionSourceCount,1397);assert.equal(manifest.uniquePackageDependencies,307);
for(const[file,expected]of Object.entries(manifest.files))assert.equal(sha(fs.readFileSync(path.join(kit,file))),expected,file);
const archive=fs.readFileSync(handoff.archive);assert.equal(archive.length,handoff.archiveBytes);assert.equal(sha(archive),handoff.archiveSha256);
const toolFiles=['tools/qa/package-r100-i14-device.mjs','tools/qa/run-r100-i14-device.mjs'];
for(const file of toolFiles){refs.push({file,sha256:sha(fs.readFileSync(file))});const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);}
assert.equal(sha(fs.readFileSync(toolFiles[1])),manifest.files[toolFiles[1]]);
const rc=read('docs/qa/artifacts/r100-i10-i12/release-candidate.json');
assert.equal(manifest.release.sha256,refs.at(-1).sha256);assert.equal(manifest.release.revision,rc.revision);
const policy=read(`${base}/runtime-policy-freeze.json`);
for(const row of [policy.taskContract,policy.sourceManifest,...policy.dependencies])assert.equal(manifest.files[row.file],row.sha256,row.file);
for(const row of policy.tools)assert.equal(manifest.files[row.path],row.sha256,row.path);
const negative=read(`${base}/root/device-kit/device-receipt.json`),log=fs.readFileSync(`${base}/root/device-kit/runner.log`,'utf8');
refs.push({file:`${base}/root/device-kit/runner.log`,sha256:sha(log)});
assert.equal(negative.chrome,'/usr/bin/false');assert.equal(negative.exitCode,1);assert.equal(negative.status,'diagnostic-has-failures');assert.equal(negative.sourceVerifiedAfterRun,true);assert(negative.finishedAt);assert(log.includes('/usr/bin/false'));assert(log.includes('Error'));
const excluded=Object.keys(manifest.files).filter(x=>/browser-storage|\.save\.json$|node_modules|device-results/.test(x));assert.deepEqual(excluded,[]);
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:'pass-handoff-source-and-wrapper-review',tool:{file:`${base}/qa-device-tool-review.mjs`,sha256:sha(fs.readFileSync(import.meta.filename))},
 manifest:{sha256:handoff.manifestSha256,checkedFileCount:1519,productionFiles:1397,rcDependencies:307,allKitHashesMatch:true,archiveSha256:handoff.archiveSha256,archiveBytes:archive.length},
 staticFindings:[
  {id:'source-binding',status:'resolved',evidence:'Packaging pins exact accepted RC, verifies1397 source/108 manifests/307 dependencies including lockfile, and every runtime freeze input/tool before copying. Current runner itself is bound by the kit manifest.'},
  {id:'failure-retention',status:'resolved',evidence:'Runner persists starting/running/finished/failure/exit status, tees child stderr/stdout to runner.log, and independently checks all kit source hashes after execution. Root synthetic Chrome=false exit1 path retained; no game/browser was launched.'},
  {id:'isolation',status:'static-pass',evidence:'127.0.0.1 random Vite port, private cache, fresh temporary Chrome context, no player save bundled. Source preflight before browser launch; missing identity/executable fails before a runtime receipt because no run occurred.'},
  {id:'portability',status:'static-pass-real-OS-pending',evidence:'Node path/file URL conversion and platform Chrome candidates, explicit overrides; fixed runtime helper injected by path. Windows/Linux installation and rendering unexecuted.'}],
 negativeChildLaunch:{source:'root-preserved-real-wrapper-fixture',browserLaunched:false,exitCode:negative.exitCode,status:negative.status,persistentLog:true,finishedAt:negative.finishedAt,sourceVerifiedAfterRun:true},
 limitations:['Source/hash audit and code review, not hardware performance or compatibility execution.','The four fixed severe gym diagnostics are separate from48 natural sorties and cannot sign formal recovery, six-family visual/audio fatigue or final acceptance.','No weaker machine or actual listener exists in this evidence.','Preflight identity failures intentionally stop before a runtime receipt; shell failure remains the evidence for attempts that never launched.'],
 references:refs};
fs.writeFileSync(`${base}/qa-device-tool-review.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,files:1519,archiveBytes:archive.length,negativeStatus:negative.status}));
