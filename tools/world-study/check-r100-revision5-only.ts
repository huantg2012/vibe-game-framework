/** Boundary contracts for the revision5-only derivative. Exact maps and all
 * four RGBA buffers are checked separately by check-r100-revision5 --full. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createR100ProductionRecipe, createR100ProductionMap, validR100ProductionRecipe,
  bakeMasterWorldSurface } from '../../src/generation/legacy-r100-v5/executor-revision5.js';
import type { WorldProductionRecipeV3 } from '../../src/generation/world-study/production-recipe';
import type { MasterWorld } from '../../src/generation/world-study/r100-master-world';
import type { PollutionGrade } from '../../src/generation/world-study/pollution-grade';

const report = JSON.parse(fs.readFileSync('docs/qa/artifacts/r100-i09/production-final52-recheck/report.json', 'utf8')) as {
  cases: { world: string; grade: PollutionGrade; identity: { generation: WorldProductionRecipeV3 } }[];
};
assert.equal(report.cases.length, 156);
for (const row of report.cases) {
  const old = row.identity.generation;
  assert(validR100ProductionRecipe(old));
  assert.deepEqual(createR100ProductionRecipe(row.world, old.requestedSeed, row.grade), old);
}
const old = report.cases[0]!.identity.generation;
const rejected = [undefined, null, 0, 1, 2, 3, 4, 6, 7, '5'];
for (const revision of rejected) {
  const forged = structuredClone(old);
  (forged.package as unknown as Record<string, unknown>).algorithmRevision = revision;
  assert(!validR100ProductionRecipe(forged), `Validator rejects revision ${revision}`);
  assert.throws(() => createR100ProductionMap(forged), /Invalid or unavailable native world package/);
  const world = { algorithmRevision: revision, appearance: old.appearance } as unknown as MasterWorld;
  assert.throws(() => bakeMasterWorldSurface(world), /Revision 5 surface requires/);
}
assert.throws(() => bakeMasterWorldSurface({ algorithmRevision: 5 } as MasterWorld), /Revision 5 surface requires/);
assert(!validR100ProductionRecipe(null));
assert(!validR100ProductionRecipe({ package: { algorithmRevision: 5 } }));
console.log(`PASS revision5-only boundary: 156 original recipes exact; ${rejected.length} old/unknown revisions rejected by validator/map/surface; malformed input and absent appearance rejected.`);
