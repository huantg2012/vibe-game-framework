import assert from 'node:assert/strict';
import {createNativeAutoCoverage} from '../../src/generation/world-study/native-auto-coverage.ts';
import {NATIVE_SPATIAL_DIRECTIONS} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {NATIVE_AUTO_CONSTRUCTION_POLICIES} from '../../src/generated/r100-native-auto-construction.ts';

const policy={deepEmptyThresholdPx:112,wideRadiusPx:48,referenceSightPx:224,maxEmptyRadiusPx:160,
  maxDeepEmptySpanPx:448,maxCoverRoutePx:320,minWideRatio:.5,minLargestWideRatio:.8};
function fixture(cols,rows,margin=40){
  const points=[];
  for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++)points.push({gx,gy,x:gx*8+4,y:gy*8+4,margin,source:120});
  const links=Uint8Array.from(points,p=>NATIVE_SPATIAL_DIRECTIONS.reduce((bits,[dx,dy],d)=>
    p.gx+dx>=0&&p.gx+dx<cols&&p.gy+dy>=0&&p.gy+dy<rows?bits|(1<<d):bits,0));
  return {points,links,available:new Uint8Array(points.length).fill(1),measure:createNativeAutoCoverage({points,baseLinks:links},policy)};
}

// A close exterior is never an H. Even with every cell beside the shore,
// the missing interior optical shelter remains an unsatisfied requirement.
const shore=fixture(9,9,8),emptyH=new Float32Array(81).fill(Infinity),structure=Float32Array.from(shore.points,p=>p.x);
const noH=shore.measure.measure(shore.available,shore.links,structure,emptyH);
assert.equal(noH.score.maxApproachRoutePx,Infinity);
assert.equal(noH.accepted,false);
assert.equal(shore.points[noH.holeTarget].gx,8);

// A long shallow empty band fails by its span. Construction targets its
// middle, not a far corner and not a global sum of otherwise covered cells.
const strip=fixture(150,5),stripStructure=new Float32Array(750).fill(120),coveredH=new Float32Array(750).fill(0);
const band=strip.measure.measure(strip.available,strip.links,stripStructure,coveredH);
assert.equal(band.score.maxDeepSpanPx,1184);
assert.equal(band.score.maxApproachRoutePx,0);
assert.ok([74,75].includes(strip.points[band.solidTarget].gx));
assert.equal(strip.points[band.solidTarget].gy,2);
assert.equal(band.holeTarget,band.solidTarget);
assert.equal(band.deepTarget,band.solidTarget);
assert.deepEqual(band.deepBounds,[12,12,1184,24],'Span failure retains its whole region, not just its midpoint');
// A certificate follows the actual long component. One local separator is
// insufficient; two separators produce three bounded components.
for(let y=0;y<5;y++)stripStructure[y*150+50]=0;
const once=strip.measure.measure(strip.available,strip.links,stripStructure,coveredH);
assert(once.score.maxDeepSpanPx>448);
for(let y=0;y<5;y++)stripStructure[y*150+100]=0;
const twice=strip.measure.measure(strip.available,strip.links,stripStructure,coveredH);
assert(twice.score.maxDeepSpanPx<=448);

// Exact edge masks determine approach routes; supported-cell adjacency
// cannot cross a swept-body barrier.
const maze=fixture(9,9,200),edgeMask=maze.links.slice(),holeDistance=new Float32Array(81).fill(Infinity);
holeDistance[4*9+2]=0;
for(let i=0;i<81;i++)NATIVE_SPATIAL_DIRECTIONS.forEach(([dx,dy],d)=>{
  const p=maze.points[i],crosses=(p.gx<4&&p.gx+dx>=4)||(p.gx>=4&&p.gx+dx<4);
  if(crosses&&Math.min(p.gy,p.gy+dy)<8)edgeMask[i]&=~(1<<d);
});
const distances=maze.measure.distanceFrom(4*9+2,maze.available,edgeMask);
assert.equal(distances[4*9+6],84);
assert.equal(maze.measure.cellAt(-1,4),-1);
assert.equal(maze.measure.cellAt(72,4),-1);
assert.equal(maze.measure.cellAt(4,-1),-1);
assert.equal(maze.measure.cellAt(4,72),-1);
// A narrow but walkable cut splits two large wide regions. The witness
// belongs to that cut, so moving a nearby obstacle away can join the regions.
const divided=fixture(21,9,200),dividedStructure=new Float32Array(21*9).fill(80),dividedH=new Float32Array(21*9).fill(0);
for(let y=0;y<9;y++)for(let x=9;x<=11;x++)dividedStructure[y*21+x]=30;
const constricted=divided.measure.measure(divided.available,divided.links,dividedStructure,dividedH);
assert.equal(constricted.score.largestWideRatio,.5);
assert([9,10,11].includes(divided.points[constricted.wideTarget].gx));
for(let x=9;x<=11;x++)dividedStructure[4*21+x]=80;
const opened=divided.measure.measure(divided.available,divided.links,dividedStructure,dividedH);
assert.equal(opened.score.largestWideRatio,1);
assert.equal(opened.accepted,true);
// Area deficit witnesses must be structure-constrained, never fixed shore.
const narrow=fixture(9,9,200),narrowStructure=new Float32Array(81).fill(40);
for(let x=0;x<9;x++)narrowStructure[x]=80;
const deficient=narrow.measure.measure(narrow.available,narrow.links,narrowStructure,new Float32Array(81));
assert.equal(narrow.points[deficient.wideTarget].gy,1);
// A fixed source bottleneck cannot be opened by relocating generated H/S.
for(let y=0;y<9;y++)for(let x=9;x<=11;x++){
  divided.points[y*21+x].source=30;dividedStructure[y*21+x]=30;
}
const fixedCut=divided.measure.measure(divided.available,divided.links,dividedStructure,dividedH);
assert.equal(fixedCut.score.largestWideRatio,.5);
assert.equal(fixedCut.wideTarget,-1);
// The witness must take the longer repairable crossing instead of the fixed cut.
for(let x=9;x<=11;x++)divided.points[8*21+x].source=120;
const repairableCut=divided.measure.measure(divided.available,divided.links,dividedStructure,dividedH);
assert.equal(divided.points[repairableCut.wideTarget].gy,8);
// The most connected edge seat can also be source-limited. Skip it without
// changing the measured wide-area deficit or the underlying body graph.
for(let x=0;x<8;x++)narrow.points[9+x].source=40;
const repairableArea=narrow.measure.measure(narrow.available,narrow.links,narrowStructure,new Float32Array(81));
assert.equal(repairableArea.score.wideRatio,deficient.score.wideRatio);
assert.equal(repairableArea.wideTarget,17);
// About half is the accepted design intent: a one-point deficit is not a
// rejection, while a materially narrower field still fails the shared floor.
const nearHalf=fixture(10,10,200),nearHalfStructure=new Float32Array(100).fill(40);
nearHalfStructure.fill(80,0,49);
for(const shared of NATIVE_AUTO_CONSTRUCTION_POLICIES){
  const measure=createNativeAutoCoverage({points:nearHalf.points,baseLinks:nearHalf.links},{...policy,minWideRatio:shared.minWidePercent/100});
  assert(measure.measure(nearHalf.available,nearHalf.links,nearHalfStructure,new Float32Array(100)).accepted);
  nearHalfStructure.fill(40,47,49);
  assert(!measure.measure(nearHalf.available,nearHalf.links,nearHalfStructure,new Float32Array(100)).accepted);
  nearHalfStructure.fill(80,47,49);
}
console.log('Constructive coverage: H-only shelter, longest-band midpoint, exact-edge routing, wide-gap and immutable-source witnesses passed');

// New receipts distinguish a long connected fringe from an unavoidably broad
// exposure. Span is diagnostic; physical empty radius and shelter route remain hard.
const fringe=fixture(150,5,200),fringeStructure=new Float32Array(750).fill(120);
const physical=createNativeAutoCoverage({points:fringe.points,baseLinks:fringe.links},policy,true);
const usable=physical.measure(fringe.available,fringe.links,fringeStructure,new Float32Array(750));
assert.equal(usable.accepted,true);
assert.equal(usable.score.maxDeepSpanPx,1184);
assert.equal(usable.score.maxDeepAreaPx2,148*3*64);
assert(usable.score.qualityPenalty>0);
assert.equal(fringe.measure.measure(fringe.available,fringe.links,fringeStructure,new Float32Array(750)).accepted,false,'Historical span contract is unchanged');
assert.equal(physical.measure(fringe.available,fringe.links,new Float32Array(750).fill(180),new Float32Array(750)).accepted,false,'A broad empty area is still rejected');
assert.equal(physical.measure(fringe.available,fringe.links,fringeStructure,new Float32Array(750).fill(Infinity)).accepted,false,'A shore or visible solid cannot replace reachable optical shelter');
console.log('Physical exposure: long thin fringe accepted, broad voidless field and missing shelter rejected; legacy span preserved');
