/** Independent full-record audit; ordinary post-restore frames are shown, not erased. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i14',raw=`${base}/continuous/recovery-v2/batch-01/i14`,old=`${base}/continuous/batch-01/i14`;
const sha=x=>createHash('sha256').update(x).digest('hex'),refs=new Map();
function read(file){const b=fs.readFileSync(file);refs.set(file,sha(b));return JSON.parse(b);}
function diff(a,b,p='',out=[]){if(Object.is(a,b))return out;if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p?`${p}.${k}`:k,out);}else out.push({path:p,before:a,after:b});return out;}
function checksum(record){let h=2166136261;for(const c of JSON.stringify(record).split(''))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16).padStart(8,'0');}
function verify(s){const{checkpointChecksum:sum,...record}=s;assert.equal(sum,checksum(record));}
function clockCategory(p){
 if(/^(run\.elapsedMs|physics\.elapsedMs|player\.(motionElapsedMs|lastDeltaMs)|tools\.(catalog\.)?elapsedMs|chaos\.(clockMs|value|peak)|trail\.elapsedMs|trail\.visited\.\d+\.atMs)$/.test(p))return'normal-clock-physics-or-chaos';
 if(/^ai\.enemies\.\d+\.(entity\.(position|bodyPosition|velocity)\.[xy]|state\.((position|velocity)\.[xy]|facingAngle|perceptionAccumMs|waypointPauseMs))$/.test(p))return'normal-ai-step';
 if(/^world\.hosts\.hosts\.\d+\.state\.(hearingAccumMs|phase|elapsedMs|phaseElapsedMs|core\.[xy])$/.test(p))return'normal-host-step';
 if(/^world\.nativePresentation\.(elapsedMs|lastElapsedMs|audio\.clock)$/.test(p))return'normal-presentation-clock';return null;
}
const rows=[];
for(const[ordinal,grade]of[[1,'low'],[2,'medium'],[3,'severe']]){
 const source=ordinal===1?JSON.parse(read(`${base}/continuous/recovery-v2/same-run-earned-storage.json`).origins.flatMap(x=>x.localStorage).find(x=>x.name==='coh-save-v1').value):read(`${raw}/${ordinal}-cold-menu-input.save.json`);
 const r=read(`${raw}/${ordinal===1?'1-resumed-first-complete':`${ordinal}-cold-first-complete`}.json`),observation=ordinal===1?r.observation:r,first=observation.firstComplete,firstSaved=JSON.parse(first.raw);
 verify(source);verify(firstSaved);assert(source.riftCheckpoint.identity.recipeId.endsWith(`-${grade}`));
 const recordDiff=diff(source,firstSaved);assert.deepEqual(recordDiff.map(x=>x.path),['riftCheckpoint.sequence','checkpointChecksum']);assert.equal(firstSaved.riftCheckpoint.sequence,source.riftCheckpoint.sequence+1);
 assert.deepEqual(first.inventory,source.inventory);assert.deepEqual(first.checkpoint.identity,source.riftCheckpoint.identity);assert.equal(first.checkpoint.runId,source.inventory.run.id);assert.deepEqual(first.checkpoint.state.player.position,source.riftCheckpoint.state.player.position);
 const runtimeDiff=diff(source.riftCheckpoint.state,first.checkpoint.state),unknown=runtimeDiff.filter(x=>!clockCategory(x.path));assert.deepEqual(unknown,[],'Every post-restore leaf difference needs an explicit normal-step category');
 assert(runtimeDiff.every(x=>Number.isFinite(x.before)&&Number.isFinite(x.after)));const dt=first.checkpoint.elapsedMs-source.riftCheckpoint.elapsedMs;assert(dt>=0);
 for(const p of ['run.elapsedMs','tools.elapsedMs','tools.catalog.elapsedMs','chaos.clockMs','trail.elapsedMs','world.nativePresentation.elapsedMs']){const d=runtimeDiff.find(x=>x.path===p);assert(d);assert(Math.abs(d.after-d.before-dt)<1e-6,p);}
 const beforeInput=read(`${raw}/${ordinal===1?'1-resumed-before-input':`${ordinal}-cold-before-first-input`}.json`);assert.deepEqual(beforeInput.inventory,source.inventory);assert.equal(beforeInput.checkpoint.runId,source.inventory.run.id);
 const pauseDir=ordinal===1?old:raw,pauseBefore=read(`${pauseDir}/${ordinal}-pause-before.json`),pauseAfter=read(`${pauseDir}/${ordinal}-pause-after.json`);const pauseDiff=diff(pauseBefore,pauseAfter);assert.deepEqual(pauseDiff.map(x=>x.path),['at']);assert(pauseBefore.paused&&pauseAfter.paused);assert(pauseAfter.at-pauseBefore.at>=700);
 const lifecycle=ordinal===1?null:read(`${raw}/${ordinal}-lifecycle.json`);
 rows.push({ordinal,grade,runId:source.inventory.run.id,recipeId:source.riftCheckpoint.identity.recipeId,seed:source.riftCheckpoint.identity.seed,
  sourceSequence:source.riftCheckpoint.sequence,firstSavedSequence:firstSaved.riftCheckpoint.sequence,fullCommittedRecordDifferences:recordDiff,
  completeSavedStateRestored:true,identityInventoryPositionExact:true,pause:{wallMs:pauseAfter.at-pauseBefore.at,fullSnapshotDifferences:pauseDiff,checkpointInventoryRawExact:true},
  cold:{restoreWallMs:ordinal===1?r.restoreWallMs:lifecycle.restoreWallMs,firstRuntimeDeltaMs:dt,fullRuntimeLeafDifferences:runtimeDiff.map(x=>({...x,category:clockCategory(x.path)})),beforeInputAdditionalDeltaMs:beforeInput.checkpoint.elapsedMs-first.checkpoint.elapsedMs,beforeInputAdditionalDifferences:diff(first.checkpoint.state,beforeInput.checkpoint.state),longTasksObserved:observation.longTasks},
  nativeFocusInOriginalHelper:'not-generated-pending-separate-headed-diagnostic'});
}
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:'three-grade-pause-and-same-run-cold-state-pass',tool:{file:`${base}/qa-three-lifecycle.mjs`,sha256:sha(fs.readFileSync(import.meta.filename))},rows,
 restoreWallMs:{samples:rows.map(x=>x.cold.restoreWallMs),max:Math.max(...rows.map(x=>x.cold.restoreWallMs)),allWithin5000:rows.every(x=>x.cold.restoreWallMs<=5000),populationP95Claim:false},
 limitations:['First low original technical interruption retained; its resumed segment is not another departure.','All committed source game data exactly persists into the first restored commit; only sequence/checksum change.','First runtime observer records a normal16.66ms frame after restore; clocks, AI movement, Host and chaos leaves are explicitly shown, not presented as a zero-time frame. Later observation lag remains separately listed.','Only three current-browser pause/restore points, supported by unchanged production source and previous broader contracts. This is not all-world new execution or a browser population p95.','Original helper generated no real focus loss. Native focus requires the separate headed fixture, and OS application focus is outside its claim.','Runtime leaf categorization and clock deltas do not certify auditory continuity or human perception.'],references:[...refs].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${base}/qa-three-lifecycle.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,rows:rows.map(x=>({grade:x.grade,restore:x.cold.restoreWallMs,delta:x.cold.firstRuntimeDeltaMs,differences:x.cold.fullRuntimeLeafDifferences.length}))}));
