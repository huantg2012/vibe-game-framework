/** Geometry quality and control effects, independent of world IDs and rendering. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateWorldSample, MAX_SPACE_ATTEMPTS, worldSpaceDiagnostics } from '../../src/generation/world-study/layout';
import { SPACE_PROFILES, validateSpaceProfile, type SpaceProfile } from '../../src/generation/world-study/space-profile';
import { evaluateOpenSpace } from '../../src/generation/world-study/space-quality';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import type { WorldSample, WorldTopologyId } from '../../src/generation/world-study/types';

function signature(sample: WorldSample): string {
  return createHash('sha256').update(sample.land).update(sample.walls).digest('hex');
}
interface Metrics { density: number; broad: number; open: number; local: number; area: number; coherence: number; spread: number; crackShare: number; attempts: number }
function metrics(sample: WorldSample): Metrics {
  const diagnosis = worldSpaceDiagnostics(sample)!;
  assert(diagnosis.quality.accepted && diagnosis.quality.bodyRoute);
  assert(diagnosis.attempt < MAX_SPACE_ATTEMPTS);
  const forms = sample.formations;
  const cx = forms.reduce((sum, value) => sum + value.center.x, 0) / forms.length;
  const cy = forms.reduce((sum, value) => sum + value.center.y, 0) / forms.length;
  const c = forms.reduce((sum, value) => sum + Math.cos(value.angle * 2), 0);
  const s = forms.reduce((sum, value) => sum + Math.sin(value.angle * 2), 0);
  return { density: diagnosis.quality.voidFraction, broad: diagnosis.quality.broadFloorRatio,
    open: diagnosis.quality.multidirectionalRatio, local: diagnosis.quality.worstLocalOpenRatio,
    area: forms.reduce((sum, value) => sum + value.cells.length, 0) / forms.length,
    coherence: Math.hypot(c, s) / forms.length,
    spread: Math.sqrt(forms.reduce((sum, value) => sum + (value.center.x - cx) ** 2 + (value.center.y - cy) ** 2, 0) / forms.length),
    crackShare: diagnosis.fractures / (diagnosis.fractures + diagnosis.pits), attempts: diagnosis.attempt + 1 };
}
function mean(values: Metrics[]): Metrics {
  return Object.fromEntries(Object.keys(values[0]!).map(key => [key, values.reduce((sum, row) => sum + row[key as keyof Metrics], 0) / values.length])) as unknown as Metrics;
}

const seeds = Array.from({ length: 128 }, (_, index) => index < 64 ? index : Math.imul(index, 0x9e3779b1) >>> 0);
const presets: Record<string, unknown> = {};
for (const topology of ['loops', 'channels'] as const) {
  const rows: Metrics[] = [], signatures = new Set<string>();
  for (const seed of seeds) {
    const sample = generateWorldSample(WORLD_PROFILES[0]!, topology, seed);
    rows.push(metrics(sample)); signatures.add(signature(sample));
    if (seed < 6) {
      assert.equal(signature(sample), signature(generateWorldSample(WORLD_PROFILES[0]!, topology, seed)), 'Deterministic redraw');
      for (const profile of WORLD_PROFILES) assert.equal(signature(sample), signature(generateWorldSample(profile, topology, seed)), 'Material cannot alter space');
    }
  }
  assert.equal(signatures.size, seeds.length, 'Seeds must produce distinct maps');
  presets[topology] = { cases: rows.length, mean: mean(rows), minimumBroad: Math.min(...rows.map(x => x.broad)),
    minimumOpen: Math.min(...rows.map(x => x.open)), minimumLocal: Math.min(...rows.map(x => x.local)), maxAttempts: Math.max(...rows.map(x => x.attempts)) };
}

const base: SpaceProfile = { id: 'unseen-combination', label: 'Parameter probe', voidFraction: .07, crackFraction: .45,
  holeScale: 1.05, directionality: .4, clustering: .4 };
function cohort(change: Partial<SpaceProfile>): Metrics {
  const space = { ...base, ...change }, rows: Metrics[] = [];
  for (let seed = 211; seed < 227; seed++) {
    const sample = generateWorldSample(WORLD_PROFILES[seed % WORLD_PROFILES.length]!, 'loops', seed, space);
    rows.push(metrics(sample));
    if (seed === 211) assert.equal(signature(sample), signature(generateWorldSample(WORLD_PROFILES[0]!, 'channels', seed, space)), 'URL alias must not alter explicit space controls');
  }
  return mean(rows);
}
const effects = {
  density: [cohort({ voidFraction: .05 }), cohort({ voidFraction: .105 })],
  crackShare: [cohort({ crackFraction: 0 }), cohort({ crackFraction: 1 })],
  scale: [cohort({ holeScale: .75 }), cohort({ holeScale: 1.3 })],
  direction: [cohort({ crackFraction: 1, directionality: 0 }), cohort({ crackFraction: 1, directionality: 1 })],
  clustering: [cohort({ clustering: 0 }), cohort({ clustering: 1 })],
};
assert(effects.density[1]!.density > effects.density[0]!.density + .03, 'Density must change actual removed area');
assert.equal(effects.crackShare[0]!.crackShare, 0);
assert.equal(effects.crackShare[1]!.crackShare, 1);
assert(effects.scale[1]!.area > effects.scale[0]!.area * 1.6, 'Scale must change actual formation area');
assert(effects.direction[1]!.coherence > effects.direction[0]!.coherence + .30, 'Directionality must change measured axis coherence');
assert(effects.clustering[1]!.spread < effects.clustering[0]!.spread * .96, 'Clustering must change centroid distribution');

for (const space of SPACE_PROFILES) validateSpaceProfile(space);
for (const invalid of [{ voidFraction: 0 }, { voidFraction: .3 }, { crackFraction: -1 }, { holeScale: 0 },
  { directionality: 1.01 }, { clustering: Number.NaN }, { holeScale: Number.POSITIVE_INFINITY }])
  assert.throws(() => generateWorldSample(WORLD_PROFILES[0]!, 'loops', 1, { ...base, ...invalid }));

function fixture(topology: WorldTopologyId, kind: 'alleys' | 'bottleneck'): WorldSample {
  const sample = generateWorldSample(WORLD_PROFILES[0]!, topology, 3), land = new Uint8Array(sample.land.length), walls = new Uint8Array(land.length);
  for (let y = 5; y < sample.rows - 5; y++) for (let x = 5; x < sample.cols - 5; x++) {
    const cell = y * sample.cols + x; land[cell] = 1;
    if (kind === 'alleys') {
      if (x > 13 && x < sample.cols - 14 && [18, 30, 42, 54].some(row => Math.abs(y - row) <= 2)) walls[cell] = 1;
    } else if (x >= 54 && x <= 58 && Math.abs(y - 38) > 1) walls[cell] = 1;
  }
  return { ...sample, land, walls, spawn: { x: 25.5 * 16, y: 25.5 * 16 }, exit: { x: 86.5 * 16, y: 49.5 * 16 } };
}
const alley = evaluateOpenSpace(fixture('channels', 'alleys'));
assert(!alley.accepted && alley.failures.some(reason => /alley|corridor|bottleneck/i.test(reason)), 'Connected parallel alleys must fail');
const bottle = evaluateOpenSpace(fixture('loops', 'bottleneck'));
assert(!bottle.accepted && bottle.failures.some(reason => /bottleneck/.test(reason)), 'Connected thin-neck fields must fail');
console.log('Open-space: 256 preset cases + 160 independent numeric perturbations; profile/seed independence, continuous body routes and connected-bad-map rejection passed.');
if (process.argv[2]) {
  await mkdir(path.dirname(process.argv[2]), { recursive: true });
  await writeFile(process.argv[2], JSON.stringify({ presets, effects, rejectedNegativeMaps: { alley, bottle } }, null, 2));
}
