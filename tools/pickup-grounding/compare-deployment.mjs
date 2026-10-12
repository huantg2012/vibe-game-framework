/** Compare real old r8 fixtures with the admitted r9 generation receipts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
const root='docs/qa/artifacts/pickup-grounding-implementation-2026-10-12';
const baseline=JSON.parse(fs.readFileSync(`${root}/legacy-r8/baseline.json`,'utf8'));
const current=JSON.parse(fs.readFileSync(`${root}/generation-final-validation.json`,'utf8'));
assert.equal(baseline.status,'passed');assert.equal(current.status,'passed');
const rows=[];
function keyedRisk(nodes){const counts=new Map();return new Map(nodes.map(row=>{const [kind,tier]=row.id.split('/'),slot=(counts.get(row.id)??0)+1;counts.set(row.id,slot);return[`r100-${kind}-${tier}-${slot}`,row];}));}
for(const old of baseline.cases){
 const newer=current.cases.find(row=>row.worldId===old.worldId&&row.grade===old.grade&&row.seed===old.seed);assert(newer);
 let map=deserialize(gunzipSync(fs.readFileSync(path.join(root,'legacy-r8',old.mapPath))));
 const oldNodes=[...map.layout.kindlingNodes,...map.layout.contaminantNodes],before=keyedRisk(map.native.diagnostics.expedition.nodes),after=keyedRisk(newer.riskChecks);
 const nodes=newer.nodes.map(node=>{
  const prior=oldNodes.find(row=>row.id===node.nodeId);assert(prior);
  const distanceMovedPx=Math.hypot(node.position.x-prior.position.x,node.position.y-prior.position.y);
  return{nodeId:node.nodeId,before:prior.position,after:node.position,distanceMovedPx,sourceKind:node.sourceKind,sourceDomain:node.sourceDomain,family:node.family,
   priorRisk:before.get(node.nodeId),currentRisk:after.get(node.nodeId)};
 });
 rows.push({worldId:old.worldId,grade:old.grade,seed:old.seed,priorEffectiveSeed:map.layout.seed,currentEffectiveSeed:newer.effectiveSeed,
  moved:nodes.filter(node=>node.distanceMovedPx>0).length,count:nodes.length,nodes});
 map=null;global.gc?.();
}
const destination=process.argv[2];assert(destination&&!fs.existsSync(destination));
const report={status:'passed',scope:'Six medium-grade seed20261012 old/new node positions and risk receipts; no aesthetic judgment.',cases:rows,totalMoved:rows.reduce((n,row)=>n+row.moved,0),totalNodes:rows.reduce((n,row)=>n+row.count,0)};
fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,moved:report.totalMoved,nodes:report.totalNodes,cases:rows.map(({worldId,moved})=>({worldId,moved}))}));
