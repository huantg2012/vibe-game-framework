/** Offline finite qualification. Never labels an unreviewed interval human-approved. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { WORLD_CONDITION_PROGRAMS, WORLD_CONDITIONS_SOURCE_HASH } from '../../src/generated/rift-world-conditions-data';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { SPACE_PROFILES } from '../../src/generation/world-study/space-profile';
import { compileWorldConditions, type WorldConditionProgram } from '../../src/generation/world-study/world-conditions';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { selectWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'docs/qa/artifacts/rift-conditions-2026-10-02/library.json');
const SELF = fileURLToPath(import.meta.url);
type Boundary = 'sample' | 'lower' | 'upper';
interface Case { worldId: string; spaceId: string; programId: string; boundary: Boundary; seed: number;
  channel: 'bounded-range' | 'production-selection' }
const json = (value: unknown): string => JSON.stringify(value);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

function compileCase(entry: Case): Record<string, unknown> {
  const start = performance.now();
  const profile = WORLD_PROFILES.find(row => row.id === entry.worldId)!;
  const space = SPACE_PROFILES.find(row => row.id === entry.spaceId)!;
  const program = WORLD_CONDITION_PROGRAMS.find(row => row.id === entry.programId)!;
  if (!profile || !space || !program) throw new Error('Unknown library case');
  const ranges = entry.boundary === 'sample' ? program.ranges
    : Object.fromEntries(Object.entries(program.ranges).map(([key, range]) => {
      const value = range[entry.boundary === 'lower' ? 0 : 1]; return [key, [value, value]];
    })) as WorldConditionProgram['ranges'];
  const conditions = compileWorldConditions(entry.seed, profile, space, { programs: [{ ...program, ranges }] });
  const frozenRecipe = { version: 2, requestedSeed: entry.seed, profile, space, conditions,
    contentFragmentTypeId: 'frag-library', paintGeometryVersion: 2 };
  try {
    const map = createWorldProductionMap(profile, space, entry.seed, { contentFragmentTypeId: 'frag-library',
      paintGeometryVersion: 2, generationVersion: 2, conditions, fallbackSeeds: conditions.fallbackSeeds });
    const supportPixels = map.sample.land.reduce((sum, value) => sum + (value ? map.sample.tileSize ** 2 : 0), 0);
    return { ...entry, result: 'machine-qualified-sample', elapsedMs: performance.now() - start,
      frozenRecipe, metrics: { ...map.metadata, kindling: map.layout.kindlingNodes.length,
        contaminants: map.layout.contaminantNodes.length, floorEntities: map.layout.enemySpawns.length,
        paintHosts: map.layout.contaminationPins.paintFloors.length, landmarks: map.layout.landmarks.length,
        formations: map.sample.formations.length, baseLandPixels: supportPixels }, humanReview: 'pending' };
  } catch (error) {
    return { ...entry, result: 'rejected', elapsedMs: performance.now() - start, frozenRecipe,
      reason: error instanceof Error ? error.message : String(error), humanReview: 'not-applicable' };
  }
}

function sources(): Record<string, string> {
  // world-scenery also attaches identity-bearing seats/radii/seeds, so it is
  // intentionally included even though that module contains drawing functions.
  const visualOnly = new Set(['material-forms.ts', 'ground-material.ts', 'surface.ts', 'scenery-motion.ts']);
  const paths = new Set<string>();
  function add(path: string): void {
    const absolute = resolve(ROOT, path), filename = path.split('/').at(-1)!;
    if (paths.has(path) || !existsSync(absolute) || (path.startsWith('src/generation/world-study/') && visualOnly.has(filename))) return;
    paths.add(path);
    if (!path.endsWith('.ts') && !path.endsWith('.mjs')) return;
    const source = readFileSync(absolute, 'utf8');
    const imports = source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g);
    for (const match of imports) {
      const specifier = match[1]!;
      const target = specifier.startsWith('@/') ? resolve(ROOT, 'src', specifier.slice(2))
        : specifier.startsWith('.') ? resolve(dirname(absolute), specifier) : undefined;
      if (!target) continue;
      for (const candidate of [target, `${target}.ts`, `${target}.mjs`, `${target}/index.ts`]) {
        if (existsSync(candidate) && /\.(?:ts|mjs|json)$/.test(candidate)) { add(relative(ROOT, candidate)); break; }
      }
    }
  }
  add('src/generation/world-study/production-map.ts');
  add('src/generation/world-study/production-recipe.ts');
  add('tools/world-study/compile-world-library.ts');
  // Generated capability records are transitively hashed above. Also retain the
  // CSV truth, including uncompiled edits that could otherwise masquerade as a frozen package.
  for (const name of readdirSync(resolve(ROOT, 'data'))) if (name.endsWith('.csv')) add(`data/${name}`);
  return Object.fromEntries([...paths].sort().map(path => [path, hash(readFileSync(resolve(ROOT, path), 'utf8'))]));
}

async function runCase(entry: Case, timeoutMs: number): Promise<Record<string, unknown>> {
  return await new Promise(resolveCase => {
    const start = performance.now();
    const child = spawn(process.execPath, ['--import', 'tsx', SELF, '--case', json(entry)], {
      cwd: ROOT, env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', expired = false, finished = false;
    const timer = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, timeoutMs);
    const finish = (record: Record<string, unknown>): void => {
      if (finished) return; finished = true; clearTimeout(timer); resolveCase(record);
    };
    child.stdout.on('data', data => { stdout += String(data); });
    child.stderr.on('data', data => { stderr += String(data); });
    child.on('error', error => finish({ ...entry, result: 'worker-error', reason: error.message }));
    child.on('close', code => {
      if (expired) finish({ ...entry, result: 'budget-timeout', elapsedMs: performance.now() - start,
        reason: 'Finite factory budget elapsed; does not establish recipe illegality.' });
      else if (code !== 0) finish({ ...entry, result: 'worker-error', reason: stderr || stdout || `exit ${code}` });
      else {
        try { finish(JSON.parse(stdout) as Record<string, unknown>); }
        catch { finish({ ...entry, result: 'worker-error', reason: 'Invalid worker result', stdout, stderr }); }
      }
    });
  });
}

async function main(): Promise<void> {
  const outputArg = process.argv.indexOf('--output');
  if (outputArg >= 0 && !process.argv[outputArg + 1]) throw new Error('--output requires a JSON path');
  const output = outputArg < 0 ? OUTPUT : resolve(ROOT, process.argv[outputArg + 1]!);
  const budgetArg = process.argv.indexOf('--budget-ms');
  const budgetMs = budgetArg < 0 ? 300000 : Number(process.argv[budgetArg + 1]);
  if (!Number.isFinite(budgetMs) || budgetMs < 1000 || budgetMs > 300000) throw new Error('Factory budget must be 1000–300000 ms');
  const initialSources = sources(), started = performance.now();
  const cases: Case[] = [];
  for (const seed of [0, 5, 70421, 1002007]) {
    const selected = selectWorldProductionRecipe(seed);
    if (selected.version !== 2) throw new Error('Library requires the formal v2 production selector');
    cases.push({ worldId: selected.profile.id, spaceId: selected.space.id, programId: selected.conditions.programId,
      boundary: 'sample', seed, channel: 'production-selection' });
  }
  // Round-robin recipes first; interrupted runs retain coverage breadth instead of one world only.
  for (const [boundary, seed] of [['sample', 1002007], ['lower', 70421], ['upper', 175150]] as const)
    for (const world of WORLD_PROFILES) for (const space of SPACE_PROFILES) for (const program of WORLD_CONDITION_PROGRAMS.filter(row => row.enabled))
      cases.push({ worldId: world.id, spaceId: space.id, programId: program.id, boundary, seed, channel: 'bounded-range' });
  const records: Record<string, unknown>[] = [];
  for (const entry of cases) {
    const remaining = budgetMs - (performance.now() - started);
    if (remaining < 250) break;
    const record = await runCase(entry, remaining);
    records.push(record);
    if (records.length % 10 === 0) process.stderr.write(`World library ${records.length}/${cases.length}\n`);
    if (record.result === 'budget-timeout') break;
  }
  const sourcesUnchanged = json(initialSources) === json(sources());
  const counts = Object.fromEntries(['machine-qualified-sample', 'rejected', 'budget-timeout', 'worker-error']
    .map(result => [result, records.filter(record => record.result === result).length]));
  const qualification = WORLD_PROFILES.flatMap(world => SPACE_PROFILES.flatMap(space => WORLD_CONDITION_PROGRAMS.map(program => {
    const cohort = records.filter(row => row.channel === 'bounded-range' && row.worldId === world.id && row.spaceId === space.id && row.programId === program.id);
    const accepted = cohort.filter(row => row.result === 'machine-qualified-sample');
    return { worldId: world.id, spaceId: space.id, programId: program.id, checked: cohort.length,
      accepted: accepted.length, allThreeFiniteSamplesQualified: accepted.length === 3, humanReview: 'pending',
      qualifiedSamples: accepted.map(row => ({ boundary: row.boundary, requestedSeed: row.seed,
        actualSeed: (row.metrics as { effectiveSeed: number }).effectiveSeed,
        signature: (row.metrics as { signature: string }).signature })) };
  })));
  const report = { schemaVersion: 1, createdAt: new Date().toISOString(), sourceHash: WORLD_CONDITIONS_SOURCE_HASH,
    status: !sourcesUnchanged ? 'source-changed-during-run' : records.length < cases.length ? 'partial-budget-limited' : 'finite-sample-complete',
    humanReview: 'pending', scope: '5 worlds × 2 spaces × 3 conditional programs; sampled/lower/upper bounded candidates + 4 known formal-selector regression seeds; full production v2 admission',
    limitations: 'Finite machine qualification only. Not all legal seeds, not natural play or visual approval. Fallback candidates always run admission. Boundary snapshots test CSV endpoints, not separate approved runtime recipes.',
    budgetMs, elapsedMs: performance.now() - started, planned: cases.length, completed: records.length,
    counts, qualification, sourcesUnchanged, sourceScope: 'Generation and condition contracts; visual drawing modules are separately reviewed and excluded from this non-rendering qualification.', sources: initialSources, records, unprocessed: cases.slice(records.length) };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, status: report.status, completed: records.length, planned: cases.length, counts, elapsedMs: report.elapsedMs }));
  if (!sourcesUnchanged || counts['worker-error']! > 0) process.exitCode = 1;
}

const caseArg = process.argv.indexOf('--case');
if (caseArg >= 0) console.log(json(compileCase(JSON.parse(process.argv[caseArg + 1]!) as Case)));
else await main();
