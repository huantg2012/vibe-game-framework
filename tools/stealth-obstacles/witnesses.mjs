/** Find conservative local detour witnesses on saved maps; never edits a production map. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {diagnoseWorld} from './diagnostics.ts';
import {readStoredMap, exactHash} from './baseline.mjs';

const [baselineDirectory, diagnosticsDirectory, regionsFile, output] = process.argv.slice(2);
assert(baselineDirectory && diagnosticsDirectory && regionsFile && output && !fs.existsSync(output),
  'Usage: witnesses.mjs BASELINE_DIR DIAGNOSTICS_DIR AUTHORED_REGIONS.json NEW_OUTPUT_DIR');
const baseline = JSON.parse(fs.readFileSync(path.join(baselineDirectory, 'baseline.json'), 'utf8'));
assert.equal(baseline.status, 'passed');
const cases = baseline.cases.filter(row => row.grade === 'medium');
assert(cases.length > 0 && cases.length <= 5);
const regions = JSON.parse(fs.readFileSync(regionsFile, 'utf8')).regions;
fs.mkdirSync(output, {recursive:true});
const requests = {}, reports = [];
const snap = value => Math.round((value - 4) / 8) * 8 + 4;
for (const item of cases) {
  const id = `${item.worldId}-${item.grade}-${item.seed}`;
  const map = readStoredMap(path.join(baselineDirectory, id, 'map.v8.gz'));
  assert.equal(exactHash(map), item.mapHash);
  const field = readStoredMap(path.join(diagnosticsDirectory, id, 'field.v8.gz'));
  const safe = p => p.x >= 0 && p.y >= 0 && p.x < field.cols * 8 && p.y < field.rows * 8
    && field.reachable[Math.floor(p.y / 8) * field.cols + Math.floor(p.x / 8)] === 1;
  const candidates = [], routeRequests = [], objectRegions = new Map();
  for (const region of regions[item.worldId]) {
    if (region.routeEndpoints) routeRequests.push({id:`art:${region.id}`, from:{x:region.routeEndpoints[0][0],y:region.routeEndpoints[0][1]}, to:{x:region.routeEndpoints[1][0],y:region.routeEndpoints[1][1]}});
    for (const objectId of region.newPlacementIds) {
      assert(!objectRegions.has(objectId), 'Unique authored object ids required'); objectRegions.set(objectId, region.id);
      const mesh = map.native.meshes.find(row => row.spec.id === objectId); assert(mesh);
      const points = [];
      for (let i=0;i<(mesh.groundEdgeStart?.triangle ?? mesh.triangleCount)*3;i++) {
        const index = mesh.indices[i]*3; points.push({x:mesh.positions[index],y:mesh.positions[index+1]});
      }
      const minX=Math.min(...points.map(p=>p.x)), maxX=Math.max(...points.map(p=>p.x));
      const minY=Math.min(...points.map(p=>p.y)), maxY=Math.max(...points.map(p=>p.y));
      // Bounds only choose candidate endpoints. The acceptance uses exact triangle interiors,
      // actual body sweeps and winding; bounding boxes are never obstacle occupancy.
      for (const axis of ['horizontal','vertical']) for (const margin of [24,48,80]) for (const fraction of [.5,.35,.65]) {
        const x=snap(minX+(maxX-minX)*fraction), y=snap(minY+(maxY-minY)*fraction);
        const left=snap(minX-margin), right=snap(maxX+margin), top=snap(minY-margin), bottom=snap(maxY+margin);
        const row = axis==='horizontal'
          ? {from:{x:left,y},to:{x:right,y},sideA:{x,y:top},sideB:{x,y:bottom}}
          : {from:{x,y:top},to:{x,y:bottom},sideA:{x:left,y},sideB:{x:right,y}};
        if (Object.values(row).every(safe)) candidates.push({id:`object-${objectId}:${axis}:${margin}:${fraction}`,objectId,...row});
      }
    }
  }
  const result = diagnoseWorld(map, {routes:routeRequests,detours:candidates});
  const chosen = [], objects = [];
  for (const [objectId, regionId] of objectRegions) {
    const attempts = result.report.detours.filter(row=>row.objectId===objectId);
    const successes = attempts.filter(row=>row.passed).sort((a,b)=>(a.sideA.lengthPx+a.sideB.lengthPx)-(b.sideA.lengthPx+b.sideB.lengthPx));
    if (successes.length) chosen.push(candidates.find(row=>row.id===successes[0].id));
    objects.push({objectId,regionId,candidateCount:attempts.length,passedCandidates:successes.length,
      selectedWitness:successes[0] ?? null,
      unsuccessfulCandidates:attempts.filter(row=>!row.passed).map(row=>({id:row.id,sideA:row.sideA.reason,sideB:row.sideB.reason,
        straightLineHitsSolid:row.straightLineHitsSolid,closedLoopWinding:row.closedLoopWinding}))});
  }
  const report = {worldId:item.worldId, sourceMapHash:item.mapHash,
    semantics:'Fixed seed saved map only. Finite candidate search; absent witness does not prove a bypass is impossible. No production map edits.',
    artRoutes:result.report.routes, objects};
  fs.writeFileSync(path.join(output,`${item.worldId}.json`),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  requests[item.worldId] = {detours:chosen};
  const summary={worldId:item.worldId,objectCount:objects.length,objectsWithWitness:chosen.length,
    missingObjectIds:objects.filter(row=>!row.selectedWitness).map(row=>row.objectId),
    routeFailures:result.report.routes.filter(row=>!row.passed).map(row=>({id:row.id,reason:row.reason}))};
  reports.push(summary); console.log(JSON.stringify(summary)); global.gc?.();
}
fs.writeFileSync(path.join(output,'selected-requests.json'),JSON.stringify(requests,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({status:'completed-search',cases:reports},null,2)+'\n',{flag:'wx'});
