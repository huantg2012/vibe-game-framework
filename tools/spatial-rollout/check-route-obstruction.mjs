/** Independent spatial-route evidence on complete production maps. This tool
 * never edits terrain. The two half-plane restrictions exist only in QA search.
 * Run with TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx ... */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { measureRouteObstructions, ROUTE_OBSTRUCTION_POLICY as POLICY } from './route-obstruction.mjs';

const worlds = (process.env.QA_WORLDS ?? 'shell-chain,splayed-fibres,gel-fibre,monolith-sill,woven-quarters').split(',');
const grades = (process.env.QA_GRADES ?? 'low,medium,severe').split(',');
const seed = Number(process.env.QA_SEED ?? 20261010);
const reportPath = process.env.QA_REPORT ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/route-obstruction.json';
assert(!existsSync(reportPath), 'Do not overwrite previous route evidence; use a new QA_REPORT');
const sources = ['src/generation/world-study/r100-spatial-world.ts', 'src/generated/r100-spatial-data.ts',
  'src/generation/world-study/r100-production-map.ts', 'src/generation/world-study/r100-package.ts',
  'src/generation/world-study/r100-master-world.ts', 'src/generation/world-study/r100-pollution.ts',
  'src/generation/world-study/r100-expedition.ts', 'src/generation/world-study/r100-patrol-windows.ts',
  'src/systems/ai/physical-grid.ts', 'tools/spatial-rollout/route-obstruction.mjs', 'tools/spatial-rollout/check-route-obstruction.mjs'];
const sourceHashes = Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const report = { status: 'running', startedAt: new Date().toISOString(), seed, policy: POLICY, sourceHashes,
  scope: 'Complete production map at stated requested seed. Independent full-body eight-way graph. At least two distinct real solid/inner-VOID groups, blocked direct crossing, globally shortest detour ratio/extra, and routes on both closed half-planes of the crossing line. No scene input, dynamic danger, economics or aesthetic acceptance.', cases: [], failures: [] };
mkdirSync(dirname(reportPath), { recursive: true });
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
for (const id of worlds) for (const grade of grades) {
  const started = performance.now();
  try {
    const recipe = createR100ProductionRecipe(id, seed, grade), map = createR100ProductionMap(recipe);
    const row = { ...measureRouteObstructions(map, recipe), elapsedMs: performance.now() - started };
    report.cases.push(row);
    if (row.status !== 'passed') report.failures.push({ world: id, grade, reason: `Only ${row.groupsFound} distinct groups proved two-sided meaningful detours` });
    console.log(`${row.status.toUpperCase()} ${id}/${grade}: ${row.groupsFound} groups; ${row.groups.map(group => `${group.group.kind} ${group.shortest.ratio.toFixed(2)}x +${Math.round(group.shortest.extraPx)}px`).join('; ')}; ${(row.elapsedMs / 1000).toFixed(1)}s`);
  } catch (error) {
    const failure = { world: id, grade, error: String(error.stack ?? error), elapsedMs: performance.now() - started };
    report.failures.push(failure); console.log(`FAIL ${id}/${grade}: ${error.message}`);
  }
  save(); global.gc?.();
}
report.finishedAt = new Date().toISOString(); report.status = report.failures.length ? 'failed' : 'passed'; save();
if (report.failures.length) process.exitCode = 1;
