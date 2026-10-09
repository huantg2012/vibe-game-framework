/** Art's read-only finite evidence audit; not a rerun of the query test. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='docs/qa/artifacts/r100-i14',out=`${root}/occlusion-visual/source-audit.json`;
assert(!fs.existsSync(out));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}),read=file=>JSON.parse(fs.readFileSync(file));
const oldFile=`${root}/frozen-source/source-snapshot.json`,newFile=`${root}/actor-occlusion/frozen-source/source-snapshot.json`,deltaFile=`${root}/actor-occlusion/delta-freeze.json`,evidenceFile=`${root}/actor-occlusion/equivalence/report.json`;
const old=read(oldFile),now=read(newFile),delta=read(deltaFile),receipt=read(evidenceFile);
assert.equal(ref(oldFile).sha256,delta.oldSource.sha256);assert.equal(ref(newFile).sha256,delta.newSource.sha256);
assert.equal(ref(evidenceFile).sha256,delta.bindings.find(r=>r.path===evidenceFile).sha256);
const file='src/systems/r100-world/presentation.ts',oldPath=path.join(old.temporaryRoot,file);
assert.equal(ref(oldPath).sha256,old.sources[file]);assert.equal(ref(file).sha256,now.sources[file]);
const method=s=>s.slice(s.indexOf(' private maskActor'),s.indexOf('\n snapshot',s.indexOf(' private maskActor'))),compact=s=>s.replace(/\s/g,'');
const before=method(fs.readFileSync(oldPath,'utf8')),after=method(fs.readFileSync(file,'utf8'));
const reversed=after.replace('let start=-1;const heightLimit=Math.max(1,ground-y);for','let start=-1;for').replace('this.actorOcclusionField.isVisibleAtPixel(x,y,heightLimit)',"(this.world.roleAt(x,y)!=='solid'||nativeVolumeHeightAt(this.world.raster,x,y)<Math.max(1,ground-y))");
assert.equal(compact(reversed),compact(before),'Only the equivalent row threshold/query changed inside the actual mask method.');
assert.equal(receipt.status,'passed');assert.equal(receipt.results.length,8);
for(const c of receipt.results){assert.equal(c.alphaDifferences,0);assert.equal(c.alphaOldSha256,c.alphaNewSha256);assert.equal(c.destroyedBytes,0);assert.equal(c.poses.length,14);for(const p of c.poses)assert.equal(p.oldSha256,p.newSha256);}
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:'finite-source-and-receipt-audit-completed',features:['COH-F052','COH-F007','COH-F039'],
 methodUnchangedAfterReversingQueryHoist:true,oldQuery:"world.roleAt(x,y)!=='solid'||nativeVolumeHeightAt(world.raster,x,y)<Math.max(1,ground-y)",
 noVisualRuleExpansion:['Original integer floor/ceil actor bounds and ground-specific key unchanged.','Original fillRect run spans, mask attachment, actor retirement and destruction unchanged.','Cache stores existing Float32 solid heights; non-solid is -Infinity; NaN keeps original role OR.','One field per immutable presentation; constructor/rollback/destroy own its lifetime.','No altered material shader, texture, authored geometry, color, fog, light, facing or sprite source in the frozen two-file delta.'],
 consumedCodeReceipt:{assertions:receipt.assertions,worlds:receipt.results.length,families:[...new Set(receipt.results.map(c=>c.family))],equalSpanPairs:receipt.results.reduce((n,c)=>n+c.poses.length,0),allAlphaDifferences:0,allDestroyedBytes:0,scope:'Original oracle vs optimized query plus real maskActor invoked on synthetic bounds/actor API fixtures; this audit verifies retained hashes and method, not a second execution of the 39,757,776 assertions.'},
 worldCoverage:receipt.results.map(c=>({world:c.world,family:c.family,grade:c.grade,seed:c.seed,roles:c.roles,poses:c.poses.length})),
 pictureSelectionCorrection:'felt-wedges severe seed20261004 has no top-visible relief; actual relief visual opportunity is assigned to hollow-wreckage, which has93,825 sampled relief pixels.',
 pending:['Actual same-state normal-context browser captures and Art viewing.','No continuous-motion/four-facing/final-aesthetic conclusion from the query receipt.'],
 references:[ref(import.meta.filename),ref(oldFile),ref(newFile),ref(deltaFile),ref(evidenceFile),ref(file),ref('src/systems/r100-world/actor-occlusion-field.ts'),ref('tools/recovery/check-r100-actor-occlusion.ts')]};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:ref(out),worlds:result.consumedCodeReceipt.worlds,equalSpanPairs:result.consumedCodeReceipt.equalSpanPairs}));
