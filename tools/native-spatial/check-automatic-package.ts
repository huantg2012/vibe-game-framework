/** Pure offline package/replay check. Never starts a game or touches saves. */
import assert from 'node:assert/strict';
import { writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { createR100AutomaticRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import type { PollutionGrade } from '../../src/generation/world-study/pollution-grade';

const [worldId, gradeArg, seedArg, output] = process.argv.slice(2);
const single = process.argv[6] === '--single';
if (!worldId) {
  let count = 0;
  const failures: { worldId: string; grade: string; error: string }[] = [];
  for (const world of R100_NATIVE_WORLDS) for (const grade of ['low', 'medium', 'severe'] as const) {
    try {
    const recipe = createR100AutomaticRecipe(world.id, 12345, grade);
    assert.equal(recipe.package.algorithmRevision, 14);
    assert(!recipe.nativeConstruction, 'Automatic recipe must not contain authored coordinates or seed banks');
    assert(validR100ProductionRecipe(JSON.parse(JSON.stringify(recipe))), `${world.id}/${grade}`);
    const changed = structuredClone(recipe);
    (changed.nativeAuto!.policy as { targetWalkAreaPx2: number }).targetWalkAreaPx2 += 8;
    assert(!validR100ProductionRecipe(changed), 'Policy mutation must invalidate the frozen receipt');
    count++;
    } catch (error) {
      failures.push({worldId:world.id,grade,error:error instanceof Error?error.message:String(error)});
    }
  }
  if (failures.length) process.exitCode = 1;
  console.log(JSON.stringify({ status: failures.length?'failed':'pass', count, failures, scope: 'all catalog grade inputs and frozen package validation; not map admission' }));
} else {
  assert(['low', 'medium', 'severe'].includes(gradeArg!), 'Need a pollution grade');
  assert(output && !existsSync(output) && !existsSync(`${output}.gz`), 'Need a new report path; never overwrite evidence');
  const seed = Number(seedArg), started = performance.now();
  const report: Record<string, unknown> = { worldId, grade: gradeArg, seed,
    scope: single?'offline complete map admission; no replay or gameplay':'offline complete map and JSON recipe replay; no gameplay' };
  try {
    const recipe = createR100AutomaticRecipe(worldId, seed, gradeArg as PollutionGrade);
    assert(validR100ProductionRecipe(recipe));
    const map = createR100ProductionMap(recipe);
    assert(map.native);
    hydrateR100MasterWorld(map.native, map.layout);
    if (!single) {
      const replay = createR100ProductionMap(JSON.parse(JSON.stringify(recipe)));
      assert.equal(replay.metadata.signature, map.metadata.signature);
      assert.deepEqual(replay.layout, map.layout);
    }
    report.status = 'pass';
    report.recipe = recipe;
    report.metadata = map.metadata;
    report.diagnostics = map.native.diagnostics;
    report.content = {
      kindling: map.layout.kindlingNodes.length,
      contaminants: map.layout.contaminantNodes.length,
      spawn: map.layout.spawnPoint,
      extraction: map.layout.extractionPoint.position,
    };
  } catch (error) {
    report.status = 'failed';
    report.error = error instanceof Error ? error.message : String(error);
    if (error && typeof error === 'object' && 'diagnostics' in error) report.diagnostics = error.diagnostics;
    process.exitCode = 1;
  }
  report.elapsedMs = performance.now() - started;
  // Preserve every diagnostic without checking megabytes of repeated path
  // vertices into the readable evidence index.
  writeFileSync(`${output}.gz`, gzipSync(JSON.stringify(report)));
  writeFileSync(output!, JSON.stringify({
    worldId, grade: gradeArg, seed, status: report.status, error: report.error,
    scope: report.scope, elapsedMs: report.elapsedMs, content: report.content,
    fullTrace: basename(`${output}.gz`),
  }, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, error: report.error, elapsedMs: report.elapsedMs, output }));
}
