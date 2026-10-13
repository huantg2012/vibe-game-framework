/** Synthetic controls: no additional production worlds or replacement seeds. */
import assert from 'node:assert/strict';
import {diagnoseWorld} from './diagnostics.ts';
import {TileType} from '../../src/types/game-types.ts';

function mesh(id, rectangles) {
  const positions = [], indices = [];
  for (const [x0, y0, x1, y1] of rectangles) {
    const offset = positions.length / 3;
    positions.push(x0,y0,0, x1,y0,0, x1,y1,0, x0,y1,0);
    indices.push(offset,offset+1,offset+2, offset,offset+2,offset+3);
  }
  return {spec: {id}, positions: new Float32Array(positions), indices: new Uint16Array(indices), triangleCount: indices.length / 3};
}
function fixture(meshes, instances, from = {x:60,y:124}, to = {x:260,y:124}) {
  return {native: {definition: {instances}, meshes}, layout: {
    tileMap: {tileSize: 8, cols: 40, rows: 32, tiles: Array.from({length:32}, () => Array(40).fill(TileType.FLOOR))},
    spawnPoint: from, extractionPoint: {position: to},
  }};
}
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const controls = [];

const disjoint = fixture([mesh(1, [[100,80,120,100],[180,140,200,160]]), mesh(2, [[80,60,240,200]])],
  [{id:1,role:'solid'}, {id:2,role:'relief'}]);
const disjointResult = diagnoseWorld(disjoint);
const sample = 15 * 40 + 19; // (156,124), inside the combined solid bbox, outside both rectangles.
near(disjointResult.field.solidDistance[sample], Math.hypot(24,16));
near(disjointResult.field.voidDistance[sample], 124);
assert(disjointResult.report.routes[0].passed);
controls.push('Exact triangle footprint leaves disjoint-bbox gap empty; relief excluded; VOID independent.');

const grounded = mesh(1, [[144,80,176,176],[8,8,24,24]]);
grounded.groundEdgeStart = {triangle:2};
const edgeResult = diagnoseWorld(fixture([grounded], [{id:1,role:'solid'}]));
assert.equal(edgeResult.report.solidTriangles, 2);
near(edgeResult.field.solidDistance[5 * 40 + 5], Math.hypot(100,36)); // (44,44), ignores groundEdge.
controls.push('groundEdge triangles are excluded from measured solid footprint.');

const from = {x:60,y:124}, to = {x:260,y:124};
const request = {id:'two-sides', objectId:1, from, to, sideA:{x:156,y:60}, sideB:{x:156,y:204}};
const open = fixture([mesh(1, [[144,80,176,176]])], [{id:1,role:'solid'}]);
const openResult = diagnoseWorld(open, {detours:[request], routes:[{id:'invalid-via', from, to, via:[{x:156,y:124}]}]});
assert.equal(openResult.report.routes[1].passed, false);
const witness = openResult.report.detours[0];
assert(witness.passed);
near(Math.abs(witness.closedLoopWinding), 1);
assert(witness.solidInteriorAnchor.x > 144 && witness.solidInteriorAnchor.x < 176);
for (const route of [witness.sideA,witness.sideB]) for (let i=1;i<route.path.length;i++) assert(route.path[i].x >= route.path[i-1].x);
controls.push('Positive two-sided route winds around actual solid and never backtracks; obstructed via fails.');

const closed = fixture([mesh(1, [[144,0,176,176]])], [{id:1,role:'solid'}]);
const negative = diagnoseWorld(closed, {detours:[{...request, sideA:{x:60,y:84}, sideB:{x:60,y:164}}]}).report.detours[0];
assert.equal(negative.passed, false);
assert.equal(negative.sideA.passed, false);
assert.equal(negative.sideB.passed, true);
controls.push('North-boundary wall rejects false two-side witness even with opposite-side waypoints.');
assert.throws(() => diagnoseWorld(open, {regions:[{id:'reversed',bounds:[80,80,40,40]}]}), /Invalid region/);
assert.throws(() => diagnoseWorld(open, {detours:[{...request,to:from}]}), /Distinct detour/);
controls.push('Invalid bounds and zero-length detour are rejected.');
console.log(JSON.stringify({status:'passed', syntheticControls:controls}, null, 2));
