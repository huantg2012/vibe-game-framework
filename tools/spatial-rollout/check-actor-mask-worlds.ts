/** Real production/legacy geometry, compared to the prior pixel scanner. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createR100ProductionRecipe as createRevision6Recipe } from '../../src/generation/legacy-r100-v6/executor.js';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { nativeVolumeHeightAt } from '../../src/generation/world-study/native-volume-raster';
import { ActorOcclusionField } from '../../src/systems/r100-world/actor-occlusion-field';

type Span = [number, number, number, number];
const out = process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/actor-mask-worlds';
assert(!existsSync(out), 'Do not overwrite earlier evidence'); mkdirSync(out, { recursive: true });
const sourceHashes = ['src/systems/r100-world/actor-occlusion-field.ts', 'src/systems/r100-world/presentation.ts',
  'src/generation/world-study/r100-production-map.ts', 'src/generation/legacy-r100-v6/executor-recovery.js']
  .map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
const results: Record<string, unknown>[] = [];
let failure: string | undefined;
try {
  for (const [revision, id] of [[7, 'crystal-fibre'], [7, 'woven-quarters'], [6, 'cinder-ridge']] as const) {
    const recipe = (revision === 6 ? createRevision6Recipe : createR100ProductionRecipe)(id, 20261010, 'severe');
    const map = createR100ProductionMap(recipe), world = hydrateR100MasterWorld(map.native!, map.layout);
    const started = performance.now(), field = new ActorOcclusionField(world), buildMs = performance.now() - started;
    const original = (x: number, y: number, limit: number): boolean => world.roleAt(x, y) !== 'solid' || nativeVolumeHeightAt(world.raster, x, y) < limit;
    const actual: Span[] = [], expected: Span[] = [], sink = { fillRect: (...span: Span) => actual.push(span) };
    let pixelChecks = 0, rowChecks = 0;
    const alphaOld = createHash('sha256'), alphaNew = createHash('sha256');
    const oldRow = new Uint8Array(field.width), newRow = new Uint8Array(field.width);
    for (let y = -1; y <= field.height; y++) {
      const limit = Math.max(1, world.layout.spawnPoint.y + .375 - y);
      for (let x = -1; x <= field.width; x++) {
        const oldVisible = original(x, y, limit), newVisible = field.isVisibleAtPixel(x, y, limit);
        assert.equal(newVisible, oldVisible, `${revision}/${id} at${x},${y}`); pixelChecks++;
        if (x >= 0 && x < field.width) { oldRow[x] = Number(oldVisible) * 255; newRow[x] = Number(newVisible) * 255; }
      }
      alphaOld.update(oldRow); alphaNew.update(newRow);
      for (const heightLimit of [limit, NaN, Infinity]) {
        actual.length = 0; expected.length = 0;
        let start = -1;
        for (let x = -17; x <= field.width + 18; x++) {
          const visible = x <= field.width + 17 && original(x, y, heightLimit);
          if (visible && start < 0) start = x;
          if (!visible && start >= 0) { expected.push([start, y, x - start, 1]); start = -1; }
        }
        field.drawVisibleRow(sink, -17, field.width + 17, y, heightLimit);
        assert.deepEqual(actual, expected, `${revision}/${id} row${y} limit${heightLimit}`); rowChecks++;
      }
    }
    const oldHash = alphaOld.digest('hex'), newHash = alphaNew.digest('hex'); assert.equal(oldHash, newHash);
    const allocatedBytes = field.byteLength, blockBytes = Math.ceil(field.width / 16) * field.height * 4;
    field.destroy(); assert.equal(field.byteLength, 0);
    results.push({ revision, world: id, seed: recipe.requestedSeed, effectiveSeed: world.layout.seed,
      width: field.width, height: field.height, buildMs, allocatedBytes, blockBytes, destroyedBytes: field.byteLength,
      pixelChecks, rowChecks, alphaOldSha256: oldHash, alphaNewSha256: newHash });
    console.log(`PASS r${revision}/${id} ${field.width}x${field.height}: ${pixelChecks} pixels, ${rowChecks} exact rows`);
  }
} catch (error) { failure = error instanceof Error ? error.stack : String(error); }
writeFileSync(`${out}/report.json`, JSON.stringify({ status: failure ? 'failed' : 'passed', sourceHashes, results, failure,
  scope: 'Two current r7 full spatial production worlds and one actual r6 recovery world. Exact mask output only; browser runtime is separate.' }, null, 2) + '\n');
if (failure) throw new Error(failure);
