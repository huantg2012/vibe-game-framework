import assert from 'node:assert/strict';
import { createNativeAutoRouteField } from '../../src/generation/world-study/native-auto-route-field.ts';
const points = [];
for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 9; gx++) points.push({ gx, gy });
const solve = createNativeAutoRouteField(points, 8);
const open = new Uint8Array(81).fill(1), holes = new Float32Array(81).fill(Infinity);
holes[4 * 9 + 2] = 0;
assert.equal(solve(open, holes, 0)[4 * 9 + 6], 32);
// A wall with a single bottom opening defeats the Euclidean proxy.
for (let y = 0; y < 8; y++) open[y * 9 + 4] = 0;
assert.equal(solve(open, holes, 0)[4 * 9 + 6], 88);
open[8 * 9 + 4] = 0;
assert.equal(solve(open, holes, 0)[4 * 9 + 6], Infinity);
// Reuse clears blocked/disconnected state, including the cyclic queue.
open.fill(1);
const actual = [...solve(open, holes, 0)];
assert.equal(actual[4 * 9 + 6], 32);
assert.equal(actual[0], 40);
// A second source shortens real route distance.
holes[4 * 9 + 6] = 0;
assert.equal(solve(open, holes, 0)[4 * 9 + 6], 0);
const tiny = createNativeAutoRouteField([{gx:0,gy:0},{gx:1,gy:1}], 8);
assert.equal(tiny(new Uint8Array([1,1]), new Float32Array([0,Infinity]), 0)[1], Infinity);
// Independent O(n²) Dijkstra oracle exercises bucket wrap and decrease-key.
for (let fixture = 0; fixture < 32; fixture++) {
  let rng = fixture + 1;
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 2**32; };
  const cells = Uint8Array.from(points, () => Number(random() > .24));
  const starts = Float32Array.from(points, () => random() < .12 ? 0 : Infinity);
  const expected = Array.from(points, (_, i) => cells[i] && starts[i] === 0 ? 0 : Infinity);
  const visited = new Set();
  for (;;) {
    let selected = -1;
    for (let i = 0; i < 81; i++) if (!visited.has(i) && Number.isFinite(expected[i])
      && (selected < 0 || expected[i] < expected[selected])) selected = i;
    if (selected < 0) break;
    visited.add(selected);
    const x = selected % 9, y = Math.floor(selected / 9);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x+dx < 0 || x+dx >= 9 || y+dy < 0 || y+dy >= 9) continue;
      const to = (y+dy)*9+x+dx;
      if (!cells[to] || (dx && dy && (!cells[y*9+x+dx] || !cells[(y+dy)*9+x]))) continue;
      expected[to] = Math.min(expected[to], expected[selected] + (dx && dy ? 12 : 8));
    }
  }
  assert.deepEqual([...solve(cells, starts, 0)], expected, `Oracle fixture ${fixture}`);
}
console.log('Automatic route field: 7 topology cases and 32 independent Dijkstra comparisons passed');
