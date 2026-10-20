/** Shared grade CSV -> frozen policy; no native world catalog is consulted. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source='data/rift-auto-construction-policy.csv',output='src/generated/r100-native-auto-construction.ts';
const csv=fs.readFileSync(source,'utf8'),sourceHash=createHash('sha256').update(csv).digest('hex');
const [header,...lines]=csv.trim().split(/\r?\n/),keys=header.split(',');
assert.equal(keys[0],'grade');assert.equal(keys.length,24);
assert(keys.every(key=>/^[a-z][a-z_0-9]*$/.test(key)));
const policies=lines.map(line=>{
  const cells=line.split(',');assert.equal(cells.length,keys.length);
  return Object.fromEntries([...keys.map((key,i)=>{
    if(i===0){assert(['low','medium','severe'].includes(cells[i]));return[key,cells[i]];}
    const n=Number(cells[i]);assert(Number.isSafeInteger(n)&&n>0,`${key} must be a positive integer`);
    if(key.endsWith('_px'))assert.equal(n%8,0,`${key} must align with 8px support cells`);
    return[key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),n];
  }),['sourceHash',sourceHash]]);
});
assert.equal(policies.length,3);assert.equal(new Set(policies.map(p=>p.grade)).size,3);
for(const p of policies){
  assert(p.armOverlapPx<p.armWidthPx&&p.armOverlapPx<p.coreWidthPx);
  assert(p.siteJitterPx<p.siteSpacingPx/4&&p.maxSiteEvaluations<=2048);
  assert(p.maxPlacementStates<=2048&&p.placementBranchLimit<=8);
  assert(p.refinementPasses<=3&&p.maxRefinementEvaluations<=8192);
  assert(p.shoreSegmentMinPx<=p.shoreSegmentMaxPx&&p.shoreDepthMinPx<=p.shoreDepthMaxPx);
}
const body=`/** Generated from ${source}; do not edit. */\nimport type {NativeAutoConstructionPolicy} from '@/generation/world-study/native-auto-types';\nexport const NATIVE_AUTO_CONSTRUCTION_POLICIES:readonly NativeAutoConstructionPolicy[]=${JSON.stringify(policies,null,2)};\n`;
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8'),body,'Stale automatic construction policies');
else fs.writeFileSync(output,body);
console.log(JSON.stringify({status:'passed',grades:policies.map(p=>p.grade),sourceHash,output}));
