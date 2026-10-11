/** Usage: TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc
 * --import tsx tools/spatial-rollout/check-sight-obstruction.mjs
 * QA_WORLDS=cleft-tableland,pale-sail,cinder-ridge QA_GRADES=medium
 * QA_REPORT=<new report path> QA_SEED=20261010 QA_TARGET_DISTANCE=176 (optional
 * stricter witness range; diagnostics stay at208). Never replaces evidence. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { measureSightObstructions } from './sight-obstruction.mjs';

const worlds = (process.env.QA_WORLDS ?? 'cleft-tableland,pale-sail,cinder-ridge').split(',');
const grades = (process.env.QA_GRADES ?? 'medium').split(',');
const seed = Number(process.env.QA_SEED ?? 20261010);
const maximumTargetDistancePx = Number(process.env.QA_TARGET_DISTANCE ?? 208);
assert(Number.isInteger(seed)); assert(grades.every(g => ['low', 'medium', 'severe'].includes(g)));
assert(Number.isFinite(maximumTargetDistancePx) && maximumTargetDistancePx > 0 && maximumTargetDistancePx <= 208);
const output = process.env.QA_REPORT;
assert(output, 'QA_REPORT is required; keep each measurement as separate evidence');
assert(!existsSync(output), `Refusing to overwrite evidence: ${output}`);
const paths = [
  ...readdirSync('src/generation/world-study').filter(p => p.endsWith('.ts')).map(p => `src/generation/world-study/${p}`),
  ...readdirSync('src/generated').filter(p => p.startsWith('r100-') || p.startsWith('rift-spatial-')).map(p => `src/generated/${p}`),
  ...readdirSync('data').filter(p => p.startsWith('rift-spatial-')).map(p => `data/${p}`),
  'src/config/constants.ts', 'src/types/game-types.ts', 'src/types/map-types.ts',
  'src/systems/tile-grid.ts', 'src/systems/ai/physical-grid.ts', 'src/utils/grid-raycast.ts',
  'tools/spatial-rollout/sight-obstruction.mjs', 'tools/spatial-rollout/check-sight-obstruction.mjs',
];
const sourceHashes = () => Object.fromEntries(paths.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')]));
const source = sourceHashes();
let commit = process.env.QA_SOURCE_COMMIT ?? null;
if (!commit) { try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* explicit source hashes remain authoritative */ } }
const report = { status: 'running', startedAt: new Date().toISOString(), commit,
  scope: 'Actual complete production generation + native.sight DDA; three independent VOID reveal witnesses, real 8px support/20px native body sweeps. Measurements use zero-chaos forward-facing radius; do not prove human visual quality or ordinary browser movement.',
  requestedSeed: seed, maximumTargetDistancePx, diagnosticMaximumTargetDistancePx: 208, sourceHashes: source, cases: [], failures: [] };
mkdirSync(dirname(output), { recursive: true });
const save = () => writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); save();
for (const world of worlds) for (const grade of grades) {
  const started = performance.now();
  try {
    const recipe = createR100ProductionRecipe(world, seed, grade);
    const map = createR100ProductionMap(recipe), result = measureSightObstructions(map, recipe, { maximumTargetDistancePx });
    report.cases.push({ ...result, totalMs: performance.now() - started });
    if (result.status !== 'passed') report.failures.push({ world, grade, error: `Only ${result.witnessCount} independent meaningful VOID reveal witnesses` });
    console.log(`${result.status.toUpperCase()} ${world}/${grade}: witnesses=${result.witnessCount}, interiorVOID=${(result.diagnostics.internalVoid.fractionOfCanvas * 100).toFixed(2)}%, near-ground LOS loss=${(result.diagnostics.voidBlockedPairFraction * 100).toFixed(2)}%`);
  } catch (error) { report.failures.push({ world, grade, error: String(error.stack ?? error), elapsedMs: performance.now() - started }); console.error(`FAIL ${world}/${grade}: ${error.message}`); }
  save(); global.gc?.();
}
const after = sourceHashes();
report.changedSourcesDuringRun = paths.filter(p => source[p] !== after[p]);
if (report.changedSourcesDuringRun.length) report.failures.push({ error: 'Source changed during measurement', paths: report.changedSourcesDuringRun });
report.status = report.failures.length ? 'failed' : 'passed'; report.finishedAt = new Date().toISOString(); save();
if (report.status === 'failed') process.exitCode = 1;
