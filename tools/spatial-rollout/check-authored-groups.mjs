/** Identity/erosion checks on every frozen whole-group definition. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds.ts';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100SpatialDefinition } from '../../src/generation/world-study/r100-spatial-world.ts';
import { validateNativeErosion, validateNativeGroundEdgeOwnership } from '../../src/generation/world-study/native-volume-erosion.ts';
const output = process.env.QA_REPORT ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/authored-group-identity.json';
assert(!existsSync(output),`Refusing to replace evidence: ${output}`);
const paths = ['data/rift-native-worlds.csv', 'data/rift-spatial-authored-groups.csv', 'data/rift-spatial-authored-erosion.csv', 'src/generated/r100-spatial-data.ts', 'src/generation/world-study/r100-spatial-world.ts', 'src/generation/world-study/native-volume-erosion.ts', 'tools/spatial-rollout/check-authored-groups.mjs'];
const report = { status: 'running', sourceHashes: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])), cases: [] };
const joinedCoastBudget = [Array.from({length:39},(_,i)=>({x:512+100*Math.cos(i/39*Math.PI*2),y:384+100*Math.sin(i/39*Math.PI*2)}))];
assert.throws(()=>validateNativeErosion(joinedCoastBudget),/3–32 points/);
assert.throws(()=>validateNativeErosion(joinedCoastBudget,2048,1792),/3–32 points/);
assert.throws(()=>validateNativeErosion(joinedCoastBudget,2304,1792),/3–32 points/);
const contains = (points, x, y) => {
  let inside = false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
};
for (const world of R100_NATIVE_WORLDS) for (const grade of ['low','medium','severe']) {
  const recipe = createR100ProductionRecipe(world.id, 20261010, grade), policy = recipe.spatialPolicy;
  assert(validR100ProductionRecipe(recipe));
  if (!policy.groupTransform) continue;
  const native=recipe.nativeDefinition, result=createR100SpatialDefinition(native,policy,20261010).definition, group=policy.groupTransform;
  assert.equal(result.instances.length,native.instances.length);
  assert.equal(policy.organizationRules.sourceMode,'source-once');
  assert.equal(policy.mirrorX,false);assert.equal(policy.mirrorY,false);
  for(const source of native.instances) {
    const actual=result.instances.find(instance=>instance.id===source.id);assert(actual);
    for(const key of ['role','family','rotation','height','thickness','fold','branches','opening','distortion','constructionVersion','shapeProfile','groundEdgeWidth']) assert.equal(actual[key],source[key],`${world.id}/${source.id}/${key}`);
    assert(Math.abs(actual.x-(group.targetX+(source.x-group.sourceX)*group.scale))<1e-6);
    assert(Math.abs(actual.y-(group.targetY+(source.y-group.sourceY)*group.scale))<1e-6);
    assert(Math.abs(actual.length-source.length*group.scale)<1e-6);
    assert(Math.abs(actual.width-source.width*group.scale)<1e-6);
  }
  validateNativeErosion(result.erosion,2304,1792);
  validateNativeGroundEdgeOwnership(result);
  let sourceErosionSeats=0;
  if(native.authoredErosion) for(const cut of native.erosion) {
    const transformed=cut.map(p=>({x:group.targetX+(p.x-group.sourceX)*group.scale,y:group.targetY+(p.y-group.sourceY)*group.scale}));
    for(let y=4;y<1792;y+=8) for(let x=4;x<2304;x+=8) if(contains(transformed,x,y)) {
      sourceErosionSeats++;assert(result.erosion.some(poly=>contains(poly,x,y)),`${world.id} lost source VOID at ${x}/${y}`);
    }
    const touching=cut.some(p=>p.x===0||p.x===1024||p.y===0||p.y===768);
    if(touching) {
      // Original vertices can lie on the boundary; find an interior source seat.
      let witness=null;
      for(let y=4;y<1792&&!witness;y+=8) for(let x=4;x<2304;x+=8) if(contains(transformed,x,y)){witness={x,y};break;}
      assert(witness);
      assert(result.erosion.some(poly=>contains(poly,witness.x,witness.y)&&poly.some(p=>p.x===0||p.x===2304||p.y===0||p.y===1792)),`${world.id} shore mouth became an interior lake`);
    }
  }
  report.cases.push({world:world.id,grade,sourceCount:native.instances.length,solidCount:policy.organizationRules.solidCount,reliefCount:policy.organizationRules.reliefCount,sourceErosionSeats,shoreCount:result.erosion.length,maxShoreVertices:Math.max(...result.erosion.map(p=>p.length))});
}
assert.equal(report.cases.length,258);
report.status='passed';writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${report.cases.length} whole-group definitions: source identity, relative geometry, unique edge owner, source VOID inclusion and preserved open-sea mouths`);
