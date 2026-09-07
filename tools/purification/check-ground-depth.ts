import assert from 'node:assert/strict';
import { GroundDepthSorter, GROUND_LIGHT_DEPTH, WORLD_READOUT_DEPTH } from '../../src/systems/ground-depth.ts';

// Five stationary contacts and a moving actor; verify front/back across every device.
const contacts = new Map([['core', 300], ['storage', 300], ['growth', 300], ['offering', 380], ['purifier', 412], ['player', 250]]);
const assigned = new Map<string, number>();
let writes = 0;
const targets = [...contacts.keys()].map(id => ({ id, groundY: () => contacts.get(id)!, applyDepth: (depth: number) => { assigned.set(id, depth); writes++; } }));
const sorter = new GroundDepthSorter(targets);
for (const device of ['core', 'storage', 'growth', 'offering', 'purifier']) {
  for (const offset of [-0.01, 0.01]) {
    contacts.set('player', contacts.get(device)! + offset);
    sorter.update();
    const actor = assigned.get('player')!;
    const object = assigned.get(device)!;
    assert.equal(actor > object, offset > 0, `${device}: front/back order`);
    // All local glows/ghosts are within 0.4 of base and cannot cross another group.
    assert.ok(offset > 0 ? object + 0.4 < actor : actor + 0.4 < object);
    for (const depth of assigned.values()) {
      assert.ok(GROUND_LIGHT_DEPTH < depth);
      assert.ok(depth + 0.4 < WORLD_READOUT_DEPTH && depth + 0.4 < 50);
    }
  }
}
contacts.set('player', 300);
sorter.update();
const tied = [...assigned.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
const writesBefore = writes;
for (let i = 0; i < 100; i++) sorter.update();
assert.equal(writes, writesBefore, 'idle does not resubmit depth changes');
const reversed = new Map<string, number>();
new GroundDepthSorter([...targets].reverse().map(t => ({ ...t, applyDepth: depth => reversed.set(t.id, depth) }))).update();
assert.deepEqual([...reversed.entries()].sort((a,b)=>a[1]-b[1]).map(([id])=>id), tied, 'ties independent of registration order');
assert.throws(() => new GroundDepthSorter([targets[0]!, targets[0]!]), /unique/);
console.log('PASS grounded front/back order, stable ties, attached effects, floor/mask bounds and idle updates');
