import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { createNativeConstructionRuntimeInput } from '../../src/generation/world-study/native-construction-recipe.ts';
import { R100_EXPEDITION_GRADES } from '../../src/generated/rift-expedition-grade-data.ts';
import { rollWeaponDrop } from '../../src/systems/weapon-loot.ts';
const output = process.argv[2];
assert(output && !fs.existsSync(output), 'Usage: check-low-rift-replay.mjs NEW_OUTPUT');
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(fs.readFileSync('tools/qa/fixtures/low-rift-before-2026-10-20.json', 'utf8'));
const report = { status: 'running', old: [], current: [], unchangedGrades: [] };
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
try {
  for (const fixture of fixtures) {
    const recipe = fixture.recipe;
    assert(validR100ProductionRecipe(recipe), `Old ${fixture.id} snapshot must remain valid`);
    const map = createR100ProductionMap(recipe);
    assert.equal(map.metadata.signature, fixture.signature, 'Full old decision/geometry/content signature');
    assert.deepEqual(map.layout.kindlingNodes, fixture.kindling);
    assert.deepEqual(map.layout.contaminantNodes, fixture.contaminants);
    report.old.push({ worldId: fixture.id, signature: map.metadata.signature, status: 'passed' }); save();
    for (const grade of ['medium', 'severe']) {
      const current = createR100ProductionRecipe(fixture.id, 156, grade);
      assert(validR100ProductionRecipe(current));
      assert.deepEqual(current.contentDefinition, R100_EXPEDITION_GRADES.find(row => row.grade_id === grade));
      assert.deepEqual(current.nativeConstruction, createNativeConstructionRuntimeInput(fixture.id));
      report.unchangedGrades.push({ worldId: fixture.id, grade }); save();
    }
    for (const seed of [156, 20261020]) {
      const current = createR100ProductionRecipe(fixture.id, seed, 'low');
      assert(validR100ProductionRecipe(current));
      const start = performance.now(), fresh = createR100ProductionMap(JSON.parse(JSON.stringify(current)));
      const { layout, native } = fresh;
      assert.equal(layout.kindlingNodes.length, 6); assert.equal(layout.contaminantNodes.length, 2);
      assert.equal(native.searchSites.length, 8);
      for (const node of layout.kindlingNodes.filter(node => node.tier === 'safe')) {
        assert.equal(node.allowWeapon, false);
        for (const firstWeaponDiscovered of [false, true])
          assert.equal(rollWeaponDrop({ nodeId: node.id, runSeed: layout.seed, tier: node.tier, allowWeapon: node.allowWeapon, firstWeaponDiscovered }), null);
      }
      const summary = { worldId: fixture.id, seed, effectiveSeed: layout.seed, generationMs: performance.now() - start,
        signature: fresh.metadata.signature, dimensions: [layout.tileMap.cols * 8, layout.tileMap.rows * 8],
        spawn: layout.spawnPoint, exit: layout.extractionPoint.position, kindling: layout.kindlingNodes,
        contaminants: layout.contaminantNodes, expedition: native.diagnostics.expedition };
      report.current.push(summary); save(); console.log(JSON.stringify({ worldId: fixture.id, seed, generationMs: summary.generationMs }));
    }
  }
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error.stack ?? error); process.exitCode = 1; }
save(); console.log(JSON.stringify({ status: report.status, old: report.old.length, current: report.current.length, output, error: report.error }));
