/** Bounded three-world low-risk supply certification; old recipes are replayed separately. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createNativeConstructionCandidate } from '../../src/generation/world-study/native-construction-generation.ts';
import { nativeConstructionContentIdentity } from '../../src/generation/world-study/native-construction-recipe.ts';
import { completeNativeSpatialCandidate } from '../../src/generation/world-study/r100-production-map.ts';
import { rollWeaponDrop } from '../../src/systems/weapon-loot.ts';
import { mix32 } from '../../src/generation/seed-fork.ts';

const output = process.argv[2];
assert(output && !fs.existsSync(output), 'Usage: check-low-rift-supply.mjs NEW_OUTPUT [--install-bank]');
fs.mkdirSync(output, { recursive: true });
const worlds = ['cinder-ridge', 'crystal-fibre', 'ruptured-film'];
const report = { status: 'running', scope: 'Three admitted low-grade worlds only; exact geometry gates and full content deployment', cases: [] };
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const bankPath = 'data/rift-low-expedition-content-seeds.csv';
const [header, ...oldLines] = fs.readFileSync(bankPath, 'utf8').trim().split(/\r?\n/);
const replacements = [];
try {
  for (const worldId of worlds) {
    const start = performance.now(), recipe = createR100ProductionRecipe(worldId, 156, 'low');
    const identity = nativeConstructionContentIdentity(recipe);
    const trace = { geometrySeed: recipe.nativeConstruction.geometrySeed, proposalBudget: 1, layoutProposals: 0, geometryEvaluations: 0,
      fullCandidates: 0, feedbackBases: [], candidates: [], deploymentRejections: [], stopReason: 'searching' };
    const checkpoint = () => assert(performance.now() - start < 90000, `${worldId} exceeded bounded 90s certification`);
    const candidate = createNativeConstructionCandidate(recipe, trace, checkpoint);
    assert(candidate.trace.accepted, `${worldId} geometry: ${candidate.trace.reasons}`);
    const row = { worldId, identity, dimensions: [candidate.layout.definition.cols * 32, candidate.layout.definition.rows * 32],
      geometry: candidate.trace.gates.geometry.metrics,
      visibility: { accepted: candidate.trace.gates.visibility.accepted,
        coverage: candidate.trace.gates.visibility.metrics.coverage },
      widthContract: { wideRadiusPx: recipe.nativeSpatial.policy.wideRadiusPx, minWideRatio: recipe.nativeSpatial.policy.minWideRatio,
        maxNarrowRunPx: recipe.nativeSpatial.policy.maxNarrowRunPx, narrowRatioAdmission: 'quality diagnostic only' },
      attempts: [], accepted: [] };
    report.cases.push(row); save();
    const oldSeeds = oldLines.filter(line => line.startsWith(`${worldId},low,`)).map(line => Number(line.split(',')[2]));
    const seeds = [...new Set([156, ...oldSeeds, 42, 20261012, ...Array.from({ length: 12 }, (_, i) => mix32(156, `low-supply-${i}`))])].slice(0, 16);
    for (const seed of seeds) {
      checkpoint();
      const current = { ...trace, fullCandidates: 0, candidates: [candidate.trace], deploymentRejections: [], stopReason: 'searching' }, rejected = [];
      const result = completeNativeSpatialCandidate(recipe, candidate, { attempt: 0, trace: current, attempts: [current], rejected, checkpoint,
        contentSeed: seed, contentSeedSource: 'certification' });
      row.attempts.push({ seed, accepted: result.accepted, rejected });
      if (result.accepted) {
        const { layout, native, metadata } = result.map;
        assert.equal(layout.kindlingNodes.length, 6);
        assert.equal(layout.contaminantNodes.length, 2);
        const safe = layout.kindlingNodes.filter(node => node.tier === 'safe');
        assert.equal(safe.length, 2);
        for (const node of safe) {
          assert.equal(node.allowWeapon, false);
          for (const firstWeaponDiscovered of [false, true])
            assert.equal(rollWeaponDrop({ runSeed: seed, nodeId: node.id, tier: node.tier, allowWeapon: node.allowWeapon, firstWeaponDiscovered }), null);
        }
        assert.equal(layout.kindlingNodes.reduce((sum, node) => sum + node.value, 0), 12);
        assert.equal(native.searchSites.length, 8);
        const exit = layout.extractionPoint.position;
        if (!row.accepted.some(other => other.exit.x === exit.x && other.exit.y === exit.y)) {
          const gate = native.diagnostics.nativeSpatial.gates.routes;
          row.accepted.push({ seed, exit, spawn: layout.spawnPoint, signature: metadata.signature,
            kindling: layout.kindlingNodes, contaminants: layout.contaminantNodes, expedition: native.diagnostics.expedition,
            routes: { accepted: gate.accepted, reasons: gate.reasons, qualityDiagnostics: gate.qualityDiagnostics,
              values: gate.metrics.routes.map(route => ({ id: route.id, lengthPx: route.lengthPx,
                minSampledWidthLowerPx: Math.min(...route.transverse.sections
                  .filter(section => typeof section.widthLowerPx === 'number').map(section => section.widthLowerPx)),
                narrowRatio: route.transverse.narrowRatio,
                maxNarrowOrUncertainRunPx: route.transverse.maxNarrowOrUncertainRunPx })) } });
          replacements.push([worldId, 'low', seed, exit.x, exit.y, identity].join(','));
        }
      }
      save();
      if (row.accepted.length >= 2) break;
    }
    assert.equal(row.accepted.length, 2, `${worldId} needs two fully admitted distinct exits within 16 attempts`);
    row.elapsedMs = performance.now() - start;
    console.log(JSON.stringify({ worldId, attempts: row.attempts.length, accepted: row.accepted.map(r => r.seed), elapsedMs: row.elapsedMs }));
  }
  const preserved = oldLines.filter(line => !worlds.some(world => line.startsWith(`${world},low,`)));
  const csv = [header, ...preserved, ...replacements].join('\n') + '\n';
  fs.writeFileSync(path.join(output, 'content-seeds.csv'), csv);
  if (process.argv.includes('--install-bank')) fs.writeFileSync(bankPath, csv);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack ?? error); process.exitCode = 1;
}
save();
console.log(JSON.stringify({ status: report.status, output, error: report.error }));
