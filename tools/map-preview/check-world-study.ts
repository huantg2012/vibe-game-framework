/** Independent study checks: no Phaser, art screenshots or production rules. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateWorldSample } from '../../src/generation/world-study/layout';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { canStandWorld } from '../../src/generation/world-study/support';
import type { WorldSample, WorldTopologyId } from '../../src/generation/world-study/types';

const seeds = [0, 1, 3, 11, 29, 47, 73, 101, 211, 409, 70421, 0xffffffff,
  ...Array.from({ length: 36 }, (_, index) => Math.imul(index + 1, 0x9e3779b1) >>> 0)];
const topologies: readonly WorldTopologyId[] = ['loops', 'channels'];
const bodySeeds = [0, 47, 101, 409, 70421, 0xffffffff] as const;

/** Exercise the viewer/formal body's shared support contract along whole routes. */
const bodyCanStand = canStandWorld;

function checkContinuousBodyRoute(sample: WorldSample): void {
  const step = 8;
  const cols = sample.cols * sample.tileSize / step + 1;
  const rows = sample.rows * sample.tileSize / step + 1;
  const prefix = `${sample.topologyId}/${sample.seed}`;
  for (const point of [sample.spawn, sample.exit]) {
    assert.equal(point.x % step, 0, 'Body test requires aligned starting/exit seats');
    assert.equal(point.y % step, 0, 'Body test requires aligned starting/exit seats');
    assert(bodyCanStand(sample, point.x, point.y), `${prefix}: body does not fit on supported seat`);
  }
  const start = sample.spawn.y / step * cols + sample.spawn.x / step;
  const goal = sample.exit.y / step * cols + sample.exit.x / step;
  const seen = new Uint8Array(cols * rows);
  const stand = new Uint8Array(cols * rows);
  const queue = [start];
  seen[start] = 1;
  stand[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    if (cell === goal) return;
    const col = cell % cols, row = Math.floor(cell / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = col + dx, y = row + dy, next = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows || seen[next]) continue;
      if (!stand[next]) stand[next] = bodyCanStand(sample, x * step, y * step) ? 1 : 2;
      if (stand[next] !== 1) continue;
      // A clear destination alone cannot prove that the body can get there.
      // Sweep each 8px edge in 2px increments (viewer steps are <=3px).
      let clear = true;
      for (let offset = 2; offset < step; offset += 2) {
        if (!bodyCanStand(sample, col * step + dx * offset, row * step + dy * offset)) { clear = false; break; }
      }
      if (clear) { seen[next] = 1; queue.push(next); }
    }
  }
  assert.fail(`${prefix}: no continuous 20×20 body route from spawn to exit`);
}

function geometrySignature(sample: WorldSample): string {
  return createHash('sha256').update(sample.land).update(sample.walls)
    .update(JSON.stringify([sample.spawn, sample.exit])).digest('hex');
}

function checkGeometry(sample: WorldSample): void {
  const { cols, rows, tileSize, land, walls } = sample;
  const prefix = `${sample.topologyId}/${sample.seed}`;
  assert.equal(land.length, cols * rows);
  assert.equal(walls.length, land.length);
  const walk = (col: number, row: number): boolean => col >= 0 && row >= 0 && col < cols && row < rows
    && land[row * cols + col] === 1 && walls[row * cols + col] === 0;
  for (const point of [sample.spawn, sample.exit]) {
    const col = Math.floor(point.x / tileSize), row = Math.floor(point.y / tileSize);
    for (let y = row - 2; y <= row + 2; y++) for (let x = col - 2; x <= col + 2; x++) {
      assert(walk(x, y), `${prefix}: unsafe spawn/exit clearance`);
    }
  }
  let count = 0;
  for (let index = 0; index < land.length; index++) {
    assert(!walls[index] || land[index], `${prefix}: wall has no support`);
    if (land[index] && !walls[index]) count++;
    assert(Number.isFinite(sample.flowAngle[index]), `${prefix}: invalid direction field`);
    assert(sample.deposition[index]! >= 0 && sample.deposition[index]! <= 1, `${prefix}: invalid deposition`);
  }
  const origin = Math.floor(sample.spawn.y / tileSize) * cols + Math.floor(sample.spawn.x / tileSize);
  const queue = [origin], seen = new Set(queue);
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!, col = cell % cols, row = Math.floor(cell / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = col + dx, y = row + dy, next = y * cols + x;
      if (walk(x, y) && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  assert.equal(seen.size, count, `${prefix}: disconnected floor`);
  assert(seen.has(Math.floor(sample.exit.y / tileSize) * cols + Math.floor(sample.exit.x / tileSize)), `${prefix}: unreachable exit`);
  assert(sample.formations.length >= 4, `${prefix}: missing obstacle field`);
  const described = sample.formations.flatMap(formation => formation.cells);
  assert.equal(new Set(described).size, described.length, `${prefix}: duplicate formation cells`);
  assert.equal(described.length, walls.reduce((sum, value) => sum + value, 0), `${prefix}: formation/collision disagreement`);
}

let checked = 0;
for (const topology of topologies) {
  const signatures = new Set<string>();
  for (const seed of seeds) {
    const reference = generateWorldSample('ash-strata', topology, seed);
    checkGeometry(reference);
    const signature = geometrySignature(reference);
    signatures.add(signature);
    assert.equal(signature, geometrySignature(generateWorldSample('ash-strata', topology, seed)), 'Non-deterministic geometry');
    for (const profile of WORLD_PROFILES) {
      const sample = generateWorldSample(profile.id, topology, seed);
      assert.equal(geometrySignature(sample), signature, 'Changing world changed topology');
      assert.equal(sample.profile.id, profile.id);
    }
    checked++;
  }
  assert.equal(signatures.size, seeds.length, `${topology}: different seeds collapsed to the same map`);
}
for (const seed of seeds) {
  assert.notEqual(geometrySignature(generateWorldSample('ash-strata', 'loops', seed)),
    geometrySignature(generateWorldSample('ash-strata', 'channels', seed)), 'Topology parameter is inert');
}
for (const topology of topologies) for (const seed of bodySeeds) {
  checkContinuousBodyRoute(generateWorldSample('ash-strata', topology, seed));
}
for (const value of Object.values(WORLD_PROFILES.find(profile => profile.id === 'ash-strata')!.palette)) {
  assert.equal(value >>> 16 & 255, value >>> 8 & 255, 'Achromatic palette contains chroma');
  assert.equal(value >>> 8 & 255, value & 255, 'Achromatic palette contains chroma');
}
assert.throws(() => generateWorldSample('missing', 'loops', 1));
assert.throws(() => generateWorldSample('ash-strata', 'loops', -1));
assert.throws(() => generateWorldSample('ash-strata', 'loops', Number.NaN));
assert.throws(() => generateWorldSample('ash-strata', 'channels', 1.5));
console.log(`World study: ${checked} geometry cases, ${bodySeeds.length * topologies.length} continuous 20×20 body routes (exact AABB; 8px lattice / 2px sweep), deterministic/seed/profile/topology independence, full grid reachability and achromatic palette passed.`);
