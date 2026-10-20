/** Exact field contract, independent of any admitted world or successful seed. */
import assert from 'node:assert/strict';
import {nativeAutoCounts} from '../../src/generation/world-study/native-auto-counts.ts';
import {nativeAutoCompiledField} from '../../src/generation/world-study/native-auto-shape.ts';
import {compileR100FragmentShape} from '../../src/generation/world-study/r100-fragment-shape.ts';
import {buildNativeSpatialGeometry,nativeCellPoint} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {NATIVE_AUTO_CONSTRUCTION_POLICIES} from '../../src/generated/r100-native-auto-construction.ts';
import {NATIVE_SPATIAL_POLICY} from '../../src/generated/r100-native-spatial.ts';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';

for(const policy of NATIVE_AUTO_CONSTRUCTION_POLICIES){
  const counts=nativeAutoCounts(policy.targetWalkAreaPx2,NATIVE_SPATIAL_POLICY);
  assert.equal(counts.holes,counts.solids*2);
}
const native=R100_NATIVE_WORLDS[0].definitions[0],frame=[1024,768],seed=12345,hash='0'.repeat(64);
const land=[[64,64,896,640]],holes=[[[280,240,112,80],[328,264,112,80]],[[648,472,96,80],[680,488,96,80]]],sites=[{x:352,y:288},{x:712,y:520}];
const projected=nativeAutoCompiledField(land,holes,[],sites,frame,seed,hash);
const shape=compileR100FragmentShape({algorithmVersion:'rectilinear-fragment-v1',layoutId:'automatic-native-layout',
  sourceHash:hash,seedMode:'run-seed',seedSalt:0,edgeSeed:seed,layout:{worldScale:2,authoringFrame:frame.map(v=>v/2),
    landRects:land.map(r=>r.map(v=>v/2)),voidRects:holes.flat().map(r=>r.map(v=>v/2))}},seed);
const geometry=buildNativeSpatialGeometry({...native,cols:32,rows:24,instances:[],terrainOutline:shape.terrainOutline,
  erosion:shape.erosion,fragmentShapeVersion:'rectilinear-fragment-v1',spawn_x:160,spawn_y:160},seed);
const rects=projected.holeRects.flatMap((group,index)=>group.map(([x,y,w,h])=>[x+sites[index].x,y+sites[index].y,w,h]));
let checked=0;
for(let cell=0;cell<geometry.supported.length;cell++){
  const p=nativeCellPoint(cell,geometry.terrain.cols);
  const blocked=rects.some(([x,y,w,h])=>p.x-10<x+w&&p.x+10>x&&p.y-10<y+h&&p.y+10>y);
  const predicted=projected.ground.supportsBody(p)&&!blocked;
  assert.equal(predicted,Boolean(geometry.supported[cell]),`Supported body mismatch at ${p.x},${p.y}`);
  if(predicted){
    const holeDistance=Math.min(...rects.map(([x,y,w,h])=>Math.hypot(Math.max(x-p.x,0,p.x-x-w),Math.max(y-p.y,0,p.y-y-h))));
    const distance=Math.min(holeDistance,projected.ground.margin(p));
    assert(Math.abs(distance-geometry.voidDistance(p))<1e-6,`VOID distance mismatch at ${p.x},${p.y}`);
    checked++;
  }
}
console.log(JSON.stringify({status:'passed',grades:3,checkedBodyCenters:checked,scope:'phase-local raster/body/distance agreement; not admission after moving shapes'}));
