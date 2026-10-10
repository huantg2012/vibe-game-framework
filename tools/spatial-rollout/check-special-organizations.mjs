/** Source-once spatial identity and actual projected contact regression. */
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { createR100SpatialDefinition } from '../../src/generation/world-study/r100-spatial-world.ts';
import { TileGrid } from '../../src/systems/tile-grid.ts';
import { bodyHasSupport, bodyDisplacementFraction } from '../../src/systems/ai/physical-grid.ts';
const output = process.env.QA_REPORT ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/special-organizations.json';
const sourcePaths = ['src/generation/world-study/r100-spatial-world.ts', 'src/generated/r100-spatial-data.ts', 'data/rift-spatial-organizations.csv', 'tools/spatial-rollout/check-special-organizations.mjs'];
const report = { status: 'running', seed: 20261010, sourceHashes: Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  scope: 'Two source-once worlds, three grades, complete production admission, original instance identity, measured XY material overlap and full 20px physical passage. Actual screen readability is separate art review.', cases: [], failures: [] };
mkdirSync(dirname(output), { recursive: true });
function coverage(mesh, bounds, step = 4) {
  const [left, top, cols, rows] = bounds, mask = new Uint8Array(cols * rows), p = mesh.positions;
  for (let t = 0; t < mesh.triangleCount; t++) {
    const a = mesh.indices[t * 3] * 3, b = mesh.indices[t * 3 + 1] * 3, c = mesh.indices[t * 3 + 2] * 3;
    const ax = p[a], ay = p[a + 1], bx = p[b], by = p[b + 1], cx = p[c], cy = p[c + 1];
    if (Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) < 1e-6) continue;
    const minX = Math.max(0, Math.floor((Math.min(ax,bx,cx) - left) / step)), maxX = Math.min(cols - 1, Math.floor((Math.max(ax,bx,cx) - left) / step));
    const minY = Math.max(0, Math.floor((Math.min(ay,by,cy) - top) / step)), maxY = Math.min(rows - 1, Math.floor((Math.max(ay,by,cy) - top) / step));
    for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
      const index = row * cols + col; if (mask[index]) continue;
      const x = left + (col + .5) * step, y = top + (row + .5) * step;
      const q = (bx-ax)*(y-ay)-(by-ay)*(x-ax), r=(cx-bx)*(y-by)-(cy-by)*(x-bx), s=(ax-cx)*(y-cy)-(ay-cy)*(x-cx);
      if ((q >= 0 && r >= 0 && s >= 0) || (q <= 0 && r <= 0 && s <= 0)) mask[index] = 1;
    }
  }
  return mask;
}
function overlap(a,b) {
  const left = Math.floor(Math.max(a.bounds.minX,b.bounds.minX)/4)*4, top = Math.floor(Math.max(a.bounds.minY,b.bounds.minY)/4)*4;
  const cols = Math.max(0,Math.ceil((Math.min(a.bounds.maxX,b.bounds.maxX)-left)/4)), rows=Math.max(0,Math.ceil((Math.min(a.bounds.maxY,b.bounds.maxY)-top)/4));
  const bounds=[left,top,cols,rows], aa=coverage(a,bounds),bb=coverage(b,bounds);let both=0;
  for(let i=0;i<aa.length;i++)both+=aa[i]&&bb[i]?16:0;return both;
}
function route(grid, from, to) {
  const n=grid.cols*grid.rows, seats=new Uint8Array(n), center=i=>({x:(i%grid.cols+.5)*8,y:(Math.floor(i/grid.cols)+.5)*8});
  for(let i=0;i<n;i++)seats[i]=+bodyHasSupport(grid,center(i),10,10);
  const nearest=p=>{let best=-1,distance=Infinity;for(let i=0;i<n;i++)if(seats[i]){const c=center(i),d=Math.hypot(c.x-p.x,c.y-p.y);if(d<distance){best=i;distance=d;}}assert(distance<=24,'Passage witness moved beyond its intended opening');return best;};
  const start=nearest(from),end=nearest(to),parent=new Int32Array(n).fill(-1),q=[start];parent[start]=start;
  for(let at=0;at<q.length&&parent[end]===-1;at++){const i=q[at],x=i%grid.cols,y=Math.floor(i/grid.cols),p=center(i);for(const[dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*grid.cols+xx;if(xx<0||yy<0||xx>=grid.cols||yy>=grid.rows||!seats[j]||parent[j]!==-1)continue;if(bodyDisplacementFraction(grid,p,10,10,dx*8,dy*8)!==1)continue;parent[j]=i;q.push(j);}}
  assert.notEqual(parent[end],-1,'Physical passage must connect');const path=[end];while(path.at(-1)!==start)path.push(parent[path.at(-1)]);return path.reverse().map(center);
}
for (const id of ['monolith-sill','woven-quarters']) for(const grade of ['low','medium','severe']) {
  try {
    const recipe=createR100ProductionRecipe(id,report.seed,grade),rules=recipe.spatialPolicy.organizationRules;
    assert.equal(rules.sourceMode,'source-once');assert.equal(rules.materialScaling,false);
    const definition=createR100SpatialDefinition(recipe.nativeDefinition,recipe.spatialPolicy,report.seed).definition;
    assert.equal(definition.instances.length,recipe.nativeDefinition.instances.length);
    assert.equal(definition.instances.filter(i=>i.role==='solid').length,rules.solidCount);
    for(const original of recipe.nativeDefinition.instances){const actual=definition.instances.find(i=>i.id===original.id);assert(actual);for(const key of ['family','role','height','thickness','fold','branches','opening','distortion','constructionVersion','shapeProfile','groundEdgeWidth'])assert.equal(actual[key],original[key],`${id}/${original.id}/${key}`);
      if(id==='woven-quarters'){assert(Math.abs(actual.x-(1190+(original.x-570)*1.7))<1e-6);assert(Math.abs(actual.y-(865+(original.y-405)*1.7))<1e-6);assert.equal(actual.rotation,original.rotation);assert(Math.abs(actual.length-original.length*1.7)<1e-6);assert(Math.abs(actual.width-original.width*1.7)<1e-6);}}
    const map=createR100ProductionMap(recipe),native=map.native,grid=new TileGrid(map.layout.tileMap);
    assert.equal(map.layout.enemySpawns.length,recipe.contentDefinition.enemy_count);
    assert.equal(map.layout.kindlingNodes.reduce((n,x)=>n+x.value,0),({low:9,medium:13,severe:17})[grade]);
    assert.equal(map.layout.contaminantNodes.length,({low:2,medium:3,severe:4})[grade]);
    assert(native.diagnostics.spatial.bodyReachableRatio>=.97);
    assert(native.diagnostics.spatial.extraction.interactionPathDistancePx>=920);
    assert(native.diagnostics.spatial.extraction.euclideanDistancePx>=560);
    const contacts=[];let passage=null;
    if(id==='woven-quarters')for(const [fiber,bed] of [[5,1],[5,2],[6,3],[6,4]]){const a=native.meshes.find(m=>m.spec.id===fiber),b=native.meshes.find(m=>m.spec.id===bed),area=overlap(a,b);assert(area>=64,`Source material ${fiber}/${bed} must actually overlap, not merely have touching AABBs: ${area}`);contacts.push({fiber,bed,projectedOverlapAreaPx:area});}
    if(id==='monolith-sill'){
      assert.equal(native.definition.instances.length,1);const s=native.definition.instances[0],world=(x,y)=>({x:s.x+x*Math.cos(s.rotation)-y*Math.sin(s.rotation),y:s.y+x*Math.sin(s.rotation)+y*Math.cos(s.rotation)});
      const mouth=world(0,s.width*.30),inside=world(0,s.width*.045),side=world(s.length*.56,s.width*.045);
      const first=route(grid,mouth,inside),second=route(grid,inside,side);assert(first.length*8<240&&second.length*8<500,'Front notch to side must use the real opening, not loop round the entire buttress');passage={mouth,inside,side,firstLengthPx:(first.length-1)*8,secondLengthPx:(second.length-1)*8};
    }
    const row={world:id,grade,attempts:map.metadata.attempt+1,effectiveSeed:map.layout.seed,solidCount:rules.solidCount,reliefCount:rules.reliefCount,spatial:native.diagnostics.spatial,contacts,passage};report.cases.push(row);console.log(`PASS ${id}/${grade} attempts=${row.attempts} contacts=${contacts.map(x=>x.projectedOverlapAreaPx).join('/')} passage=${passage?`${passage.firstLengthPx}/${passage.secondLengthPx}`:'n/a'}`);
  } catch(error){report.failures.push({world:id,grade,error:String(error.stack??error)});console.log(`FAIL ${id}/${grade}: ${error.message}`);}
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');global.gc?.();
}
report.status=report.failures.length?'failed':'passed';writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.failures.length)process.exitCode=1;
