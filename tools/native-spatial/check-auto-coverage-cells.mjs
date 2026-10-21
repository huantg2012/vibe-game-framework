import assert from 'node:assert/strict';
import {nativeAutoCoverageCells,nativeAutoSplitCoverageCell,nativeAutoCoverageCellNeighbors} from '../../src/generation/world-study/native-auto-cells.ts';
const points=[];
for(let gy=0;gy<150;gy++)for(let gx=0;gx<250;gx++)points.push({gx,gy,x:gx*8+4,y:gy*8+4,source:Infinity,margin:Math.min(gx,gy,249-gx,149-gy)*8+4});
const cells=nativeAutoCoverageCells(points,320,160,112,()=>true);
assert.equal(new Set(cells.map(c=>c.row)).size,4,'Boundary alignment keeps one useful row rather than two sliver rows');
assert.deepEqual(cells.flatMap(c=>c.points).sort((a,b)=>a-b),points.map((_,i)=>i),'Every actual body sample has exactly one owner');
assert(cells.every(c=>!c.sourceAssisted && !c.sourceCovered));
const largest=cells.reduce((a,b)=>a.points.length>b.points.length?a:b),split=nativeAutoSplitCoverageCell(largest,points);
assert.deepEqual(split.flatMap(c=>c.points).sort((a,b)=>a-b),[...largest.points].sort((a,b)=>a-b),'Splitting before placement neither drops nor duplicates space');
assert(split.every(c=>c.points.length>0));
const full=[...cells.filter(c=>c!==largest),...split],neighbors=nativeAutoCoverageCellNeighbors(full,points);
neighbors.forEach((list,a)=>list.forEach(b=>assert(neighbors[b].includes(a),'Shared-cell adjacency is symmetric')));
assert(neighbors.every(list=>list.length>0));
assert(neighbors[full.length-1].includes(full.length-2),'Split halves remain adjacent');
// A small mean can hide a far uncovered corner. It is an assignment hint,
// never a certificate that discards the corner from the actual field.
const partlyAssisted=points.map((p,index)=>({...p,source:index===0?240:0}));
const assisted=nativeAutoCoverageCells(partlyAssisted,320,160,112);
const corner=assisted.find(cell=>cell.points.includes(0));
assert.equal(corner.sourceAssisted,true);
assert.equal(corner.sourceCovered,false);
assert.equal(assisted.flatMap(cell=>cell.points).length,points.length);
console.log(`Coverage cells: ${points.length} samples partitioned into ${cells.length} staggered cells; boundary alignment, complete ownership and split adjacency passed`);
