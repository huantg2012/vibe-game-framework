/** Pure exterior fixtures only: no map construction, renderer or admission. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {measureNativeConstructionMacro as measure,parseNativeConstructionMacroPolicy} from '../../src/generation/world-study/native-spatial-construction-macro.ts';

const policyCSV=readFileSync(new URL('../../data/rift-native-construction-macro-policy.csv',import.meta.url),'utf8');
const hash=createHash('sha256').update(policyCSV).digest('hex'),policy=parseNativeConstructionMacroPolicy(policyCSV,hash);
const polygon=coordinates=>coordinates.map(([x,y])=>({x,y}));
const rectangle=polygon([[0,0],[1200,0],[1200,1000],[0,1000]]);
const bar=polygon([[0,0],[1600,0],[1600,200],[0,200]]);
const elbow=polygon([[0,0],[1200,0],[1200,400],[400,400],[400,1000],[0,1000]]);
const saw=polygon([[0,0],[1000,0]]);
for(let y=80;y<1000;y+=100)saw.push(...polygon([[1000,y],[984,y],[984,y+20],[1000,y+20]]));
saw.push(...polygon([[1000,1000],[0,1000]]));
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),`${message}: ${actual} != ${expected}`);
const measured=[rectangle,bar,elbow,saw].map(shape=>measure(shape,policy));
const [squareResult,barResult,elbowResult,sawResult]=measured;
close(squareResult.outerAreaPx2,1_200_000,'rectangle area');close(squareResult.pca.axisRatio,1.2,'rectangle PCA');
assert.equal(squareResult.regression.squareLike,true);assert.equal(squareResult.regression.barLike,false);assert.equal(squareResult.concavity.pockets.length,0);
close(barResult.pca.axisRatio,8,'bar PCA');assert.equal(barResult.regression.squareLike,false);assert.equal(barResult.regression.barLike,true);assert.equal(barResult.regression.macroPocketCount,0);
close(elbowResult.outerAreaPx2,720_000,'L area');close(elbowResult.hull.fillRatio,.75,'L convex fill');assert.equal(elbowResult.regression.squareLike,false);assert.equal(elbowResult.regression.macroPocketCount,1);
assert.equal(sawResult.regression.squareLike,true,'small edge teeth do not defeat square warning');assert.equal(sawResult.regression.macroPocketCount,0);assert.ok(sawResult.concavity.maxDepthPx<=16);

function invariant(actual,expected){
  close(actual.outerAreaPx2,expected.outerAreaPx2,'area invariant');close(actual.hull.fillRatio,expected.hull.fillRatio,'hull fill invariant');
  for(const key of ['axisRatio','majorSpanPx','minorSpanPx'])close(actual.pca[key],expected.pca[key],`PCA ${key}`);
  for(const key of ['deficitAreaPx2','maxDepthPx','maxDepthRatio','areaWeightedDepthPx'])close(actual.concavity[key],expected.concavity[key],`concavity ${key}`);
  assert.equal(actual.concavity.pockets.length,expected.concavity.pockets.length);assert.deepEqual(actual.regression,expected.regression);
}
for(const shape of [rectangle,bar,elbow,saw]){
  const original=structuredClone(shape),baseline=measure(shape,policy),subdivided=[];
  for(let i=0;i<shape.length;i++){const a=shape[i],b=shape[(i+1)%shape.length];for(let part=0;part<7;part++)subdivided.push({x:a.x+(b.x-a.x)*part/7,y:a.y+(b.y-a.y)*part/7});}
  invariant(measure(subdivided,policy),baseline);
  invariant(measure([...shape].reverse(),policy),baseline);
  invariant(measure([...shape,shape[0]],policy),baseline);
  invariant(measure(shape.map(({x,y})=>({x:x+10_000_000,y:y-8_000_000})),policy),baseline);
  const angle=.47,c=Math.cos(angle),s=Math.sin(angle);
  invariant(measure(shape.map(({x,y})=>({x:x*c-y*s,y:x*s+y*c})),policy),baseline);
  assert.deepEqual(shape,original,'measurement must not mutate source outline');
  close(baseline.concavity.pockets.reduce((sum,pocket)=>sum+pocket.areaPx2,0),baseline.concavity.deficitAreaPx2,'pockets partition convex deficit');
}
// Caller deliberately passes only the exterior; even enormous internal holes
// cannot reduce the filled-exterior area or improve macro regression flags.
const shapeOnly=definition=>measure(definition.terrainOutline,policy);
assert.deepEqual(shapeOnly({terrainOutline:rectangle,erosion:[]}),shapeOnly({terrainOutline:rectangle,erosion:[{x:10,y:10,width:1180,height:980}]}));
assert.equal(measure(elbow).regression,null,'no policy must not invent art thresholds');
assert.throws(()=>measure(polygon([[0,0],[1,1],[2,2]])),/Degenerate/);
assert.throws(()=>measure(polygon([[0,0],[1,Infinity],[2,0]])),/Invalid/);
assert.throws(()=>parseNativeConstructionMacroPolicy(policyCSV,'invalid'),/Invalid/);
assert.throws(()=>parseNativeConstructionMacroPolicy(policyCSV.replace('diagnostic-v1,1.8','diagnostic-v1,0.8'),hash),/ranges/);
console.log(JSON.stringify({passed:true,scope:'pure filled-exterior fixtures; zero map builds',policySHA256:hash,fixtures:['rectangle','thin-bar','L-shape','sawtooth-square'],invariance:['vertex subdivision','winding','closed duplicate endpoint','translation','rotation','source immutability','internal holes excluded'],metrics:measured},null,2));
