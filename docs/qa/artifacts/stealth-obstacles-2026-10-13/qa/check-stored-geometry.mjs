// Independent evidence over already generated maps; never regenerate or mutate production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readStoredMap, exactHash, sha256} from '../../../../../tools/stealth-obstacles/baseline.mjs';
import {measureSightObstructions} from '../../../../../tools/spatial-rollout/sight-obstruction.mjs';
import {TileType} from '../../../../../src/types/game-types.ts';
import {hydrateR100MasterWorld} from '../../../../../src/generation/world-study/r100-native-data.ts';
import {NativeBodyCollision} from '../../../../../src/generation/world-study/native-body-collision.ts';
import {hasLineOfSight} from '../../../../../src/utils/grid-raycast.ts';
const base = 'docs/qa/artifacts/stealth-obstacles-2026-10-13/code';
const output = process.argv[2];
const afterGroup = process.argv[3] ?? 'after';
assert(output && !fs.existsSync(output), 'Fresh report path required');
const beforeReceipt = JSON.parse(fs.readFileSync(`${base}/before/baseline.json`));
const afterReceipt = JSON.parse(fs.readFileSync(`${base}/${afterGroup}/baseline.json`));
assert.equal(beforeReceipt.status, 'passed'); assert.equal(afterReceipt.status, 'passed');
const report = {status:'running',createdAt:new Date().toISOString(),sourceBeforeSha256:sha256(fs.readFileSync(`${base}/before/baseline.json`)),
  sourceAfterDirectory:`${base}/${afterGroup}`,sourceAfterSha256:sha256(fs.readFileSync(`${base}/${afterGroup}/baseline.json`)), cases:[], failures:[],
  limits:['3 medium maps at requested seed 20261012, complete generation supplied by code receipts; not other grades or seeds.',
    'Projected footprints are exact original triangles with 2px centre-sampled area, not nominal length*width and not continuous union area.',
    'VOID reveal witnesses are static player-facing DDA and body-swept paths. No actual enemy, hearing, patrol phase, detection state, approach or retreat gameplay was executed.']};
function footprint(mesh) {
  const triangles=[];
  for(let i=0;i<mesh.indices.length;i+=3) {
    const p=Array.from(mesh.indices.slice(i,i+3),j=>({x:mesh.positions[j*3],y:mesh.positions[j*3+1]}));
    const area=(p[1].x-p[0].x)*(p[2].y-p[0].y)-(p[1].y-p[0].y)*(p[2].x-p[0].x);
    if(Math.abs(area)>1e-7) triangles.push(p);
  }
  const points=triangles.flat(), xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  function contains(p,t) {
    const crosses=t.map((a,i)=>{const b=t[(i+1)%3];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);});
    return crosses.every(c=>c>=0)||crosses.every(c=>c<=0);
  }
  let occupied=0;
  for(let y=Math.floor(bounds[1]/2)*2+1;y<bounds[3];y+=2) for(let x=Math.floor(bounds[0]/2)*2+1;x<bounds[2];x+=2)
    if(triangles.some(t=>contains({x,y},t))) occupied++;
  return {objectId:mesh.spec.id,triangleHash:exactHash({positions:mesh.positions,indices:mesh.indices}),
    nondegenerateXYTriangles:triangles.length,actualXYBounds:bounds,widthPx:bounds[2]-bounds[0],heightPx:bounds[3]-bounds[1],
    occupied2PxCenterSamples:occupied,sampledProjectedAreaPx2:occupied*4,samplingStepPx:2};
}
for(const row of afterReceipt.cases) {
 const id=`${row.worldId}-${row.grade}-${row.seed}`;
 try {
  const before=readStoredMap(`${base}/before/${id}/map.v8.gz`),after=readStoredMap(`${base}/${afterGroup}/${id}/map.v8.gz`);
  assert.equal(exactHash(before),beforeReceipt.cases.find(r=>r.worldId===row.worldId&&r.grade===row.grade).mapHash);
  assert.equal(exactHash(after),row.mapHash);
  const oldIds=before.native.definition.instances.map(i=>i.id),newIds=after.native.definition.instances.filter(i=>!oldIds.includes(i.id)).map(i=>i.id);
  assert.deepEqual(after.native.definition.instances.filter(i=>oldIds.includes(i.id)),before.native.definition.instances,'Original authored instance parameters/order changed');
  const originalMeshes=before.native.meshes.map(b=>{const a=after.native.meshes.find(m=>m.spec.id===b.spec.id);
    const geometry=m=>{const {seed,...spec}=m.spec;return {...m,spec};};
    assert.deepEqual(geometry(a),geometry(b),`Original mesh geometry ${b.spec.id} changed`);
    return {objectId:b.spec.id,geometryHash:exactHash(geometry(b)),beforeMeshSeed:b.spec.seed,afterMeshSeed:a.spec.seed,
      seedChangedOnly:a.spec.seed!==b.spec.seed};});
  assert.deepEqual(after.native.definition.erosion,before.native.definition.erosion,'Original holes changed');
  const hydratedBefore=hydrateR100MasterWorld(before.native,before.layout),hydratedAfter=hydrateR100MasterWorld(after.native,after.layout);
  let matterCells=0,changedMatterCells=0,addedWallCells=0,removedWallCells=0,changedSightCells=0,transparentWallCells=0;
  for(let y=0;y<before.layout.tileMap.rows;y++) for(let x=0;x<before.layout.tileMap.cols;x++) {
    const a=after.layout.tileMap.tiles[y][x],b=before.layout.tileMap.tiles[y][x];
    if(b!==TileType.VOID)matterCells++;
    if((a===TileType.VOID)!==(b===TileType.VOID))changedMatterCells++;
    if(a===TileType.WALL&&b!==TileType.WALL)addedWallCells++;
    if(a!==TileType.WALL&&b===TileType.WALL)removedWallCells++;
    if(hydratedBefore.sight.isOpaque(x,y)!==hydratedAfter.sight.isOpaque(x,y))changedSightCells++;
    if(a===TileType.WALL) {assert.equal(hydratedAfter.sight.isOpaque(x,y),false);transparentWallCells++;}
  }
  assert.equal(changedMatterCells,0);assert.equal(removedWallCells,0);assert.equal(changedSightCells,0);
  const recipe=JSON.parse(fs.readFileSync(`${base}/${afterGroup}/${id}.recipe.json`));
  const sight=measureSightObstructions(after,recipe);
  const addedFootprints=after.native.meshes.filter(m=>newIds.includes(m.spec.id)).map(footprint);
  const body=new NativeBodyCollision(after.native,after.layout.tileMap);
  const solidTransparencyWitnesses=addedFootprints.map(f=>{
    const [x0,y0,x1,y1]=f.actualXYBounds;
    const candidates=[];
    for(let y=Math.ceil(y0/8)*8;y<y1;y+=8)candidates.push([{x:x0-24,y},{x:x1+24,y}]);
    for(let x=Math.ceil(x0/8)*8;x<x1;x+=8)candidates.push([{x,y:y0-24},{x,y:y1+24}]);
    for(const [from,to] of candidates)if(body.supports(from,10,10)&&body.supports(to,10,10)
      && body.displacementFraction(from,10,10,to.x-from.x,to.y-from.y)<1
      && hasLineOfSight(hydratedAfter.sight,from,to))return {objectId:f.objectId,from,to,bodyBlocked:true,playerAndEnemySharedSightGridClear:true};
    return {objectId:f.objectId,found:false,reason:'No supported side-to-side probe found in finite scan; opacity-cell equality is recorded separately.'};
  });
  assert(addedFootprints.every(f=>f.nondegenerateXYTriangles>0&&f.sampledProjectedAreaPx2>0));
  report.cases.push({worldId:row.worldId,grade:row.grade,requestedSeed:row.seed,effectiveSeedBefore:before.metadata.effectiveSeed,effectiveSeedAfter:after.metadata.effectiveSeed,
    originalMeshes,originalInstanceParamsPreserved:true,originalHolePolygonsPreserved:true,changedMatterCells,matterCells,changedSightCells,transparentWallCells,solidTransparencyWitnesses,
    addedConservativeWallCells:addedWallCells,removedWallCells,addedConservativeWallFractionOfMatter:addedWallCells/matterCells,
    addedFootprints,staticPlayerVoidReveal:sight});
  if(sight.status!=='passed')report.failures.push({worldId:row.worldId,type:'static-witness-search',witnesses:sight.witnessCount});
  console.log(`${row.worldId}: original geometry preserved; ${addedFootprints.length} new footprints; VOID witnesses ${sight.witnessCount}`);
 } catch(error) {report.failures.push({worldId:row.worldId,error:String(error.stack??error)});console.error(error);}
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');global.gc?.();
}
report.status=report.failures.length?'failed':'passed';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.failures.length)process.exitCode=1;
