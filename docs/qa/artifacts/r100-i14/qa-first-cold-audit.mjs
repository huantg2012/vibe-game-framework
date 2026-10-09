import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base='docs/qa/artifacts/r100-i14';
const raw=`${base}/continuous/batch-01/i14`;
const hash=x=>createHash('sha256').update(x).digest('hex');
const refs=new Map();
function read(file){const bytes=fs.readFileSync(file);refs.set(file,hash(bytes));return JSON.parse(bytes);}
function diff(a,b,p='$',out=[]){if(Object.is(a,b))return out;if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],`${p}.${k}`,out);}else out.push({path:p,before:a,after:b});return out;}
// Same FNV-1a over serialized UTF-16 code units as the bound production checksum.
function checksum(record){let h=2166136261;for(const c of JSON.stringify(record).split(''))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16).padStart(8,'0');}
function verified(save){const{checkpointChecksum:given,...record}=save;assert.equal(given,checksum(record));return given;}
const input=read(`${raw}/1-cold-input.save.json`);
const storage=read(`${raw}/browser-storage.json`);
const saved=JSON.parse(storage.origins.flatMap(x=>x.localStorage).find(x=>x.name==='coh-save-v1').value);
const allDifferences=diff(input,saved);
assert.deepEqual(allDifferences.map(x=>x.path),['$.riftCheckpoint.sequence','$.checkpointChecksum']);
assert.equal(saved.riftCheckpoint.sequence,8);assert.equal(input.riftCheckpoint.sequence,6);
assert.equal(input.riftCheckpoint.runId,'024bdb71-0b90-4c03-9598-eef64646ba9b');
const checksums={before:verified(input),after:verified(saved)};
const pauseBefore=read(`${raw}/1-pause-before.json`),pauseAfter=read(`${raw}/1-pause-after.json`);
const pauseDiff=diff(pauseBefore,pauseAfter);
assert.deepEqual(pauseDiff.map(x=>x.path),['$.at']);
assert(pauseBefore.paused&&pauseAfter.paused);
assert(pauseAfter.at-pauseBefore.at>=700);
const focus=['before','after','held'].map(x=>read(`${raw}/1-focus-${x}.json`));
const nativeLoss=focus.flatMap(x=>x.events).filter(x=>x.trusted&&(x.type==='blur'||x.type==='visibilitychange'&&x.hidden));
assert.equal(nativeLoss.length,0);
const freezes=[];
for(const file of [`${base}/continuous/policy-freeze.json`,`${base}/continuous/recovery-v2/policy-freeze.json`]){
 const freeze=read(file),bound=[];
 function walk(v){if(!v||typeof v!=='object')return;if(v.file&&v.sha256){const actual=hash(fs.readFileSync(v.file));assert.equal(actual,v.sha256,v.file);refs.set(v.file,actual);bound.push(v.file);}for(const x of Object.values(v))if(typeof x==='object')walk(x);}
 walk(freeze);
 assert.equal(freeze.maxAttempts,48);assert.equal(freeze.maxBatch,12);assert.equal(freeze.maxContexts,1);
 assert.equal(freeze.steps.length,48);assert.deepEqual(freeze.steps.map(x=>x.ordinal),Array.from({length:48},(_,i)=>i+1));
 assert.deepEqual(freeze.steps.map(x=>x.grade),Array.from({length:48},(_,i)=>['low','medium','severe'][i%3]));
 freezes.push({file,version:freeze.version,boundReferences:bound.length,grades:{low:16,medium:16,severe:16},task:freeze.taskContract});
}
const recovery=read(`${base}/continuous/recovery-v2/same-run-earned-storage.json`);
assert.deepEqual(recovery,storage);
for(const file of ['src/types/rift-checkpoint.ts','src/managers/save-manager.ts','src/systems/rift-frame-commit.ts','src/scenes/rift-scene.ts'])refs.set(file,hash(fs.readFileSync(file)));
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:'pass-limited-forensic-audit',tool:{file:`${base}/qa-first-cold-audit.mjs`,sha256:hash(fs.readFileSync(import.meta.filename))},
 runId:input.riftCheckpoint.runId,identity:input.riftCheckpoint.identity.recipeId,seed:input.riftCheckpoint.identity.seed,
 firstAttempt:{status:'technical-assertion-failure-preserved',gameDeath:false,settled:false,extraSortie:false},
 reload:{recursiveFullRecordDifferences:allDifferences,validChecksums:checksums,simulationAndInventoryUnchanged:true,
 explanation:'Bound production pagehide and hidden handlers force checkpoint commits; each successful commit increments sequence even while the simulation is paused. Exact event multiplicity was not separately captured, so the two specific dispatches are inferred from the production paths, not claimed as observed.',
 sourceLocations:['src/scenes/rift-scene.ts:2327','src/scenes/rift-scene.ts:2340','src/systems/rift-frame-commit.ts:45','src/systems/rift-frame-commit.ts:70','src/managers/save-manager.ts:104']},
 pause:{status:'pass-for-first-low',wallMs:pauseAfter.at-pauseBefore.at,elapsedMs:pauseBefore.checkpoint.elapsedMs,fullSnapshotDifferences:pauseDiff,checkpointInventoryAndRawExactlyEqual:true},
 focus:{status:'pending-native-event-not-generated',nativeLossEvents:nativeLoss,observations:focus.map(x=>({at:x.at,elapsedMs:x.checkpoint.elapsedMs,paused:x.paused,hidden:x.hidden,focused:x.focused,events:x.events}))},
 recoveryInput:{exactStorageDeepEqual:true,originalFailedStoragePreserved:true,firstRunCount:1,completedRecovery:'pending-separate-actual-evidence'},
 freezes,scope:'No browser executed by this audit. Freeze/source and original failure diagnosis only, not completed48, recovery release gate, real focus loss, device or listening qualification.',
 references:[...refs].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${base}/qa-first-cold-audit.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,differences:allDifferences,pause:result.pause.wallMs,focus:result.focus.status,boundFiles:refs.size}));
