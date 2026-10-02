/** CSV owns approved candidate ranges; this compiler rejects unsupported capabilities. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT = 'data/rift-world-conditions.csv';
const OUTPUT = 'src/generated/rift-world-conditions-data.ts';
export const CONDITION_RANGE_LIMITS = {
  strength: [0, 1], coherence: [0, 1], scale: [.5, 2],
  minimumDeepDetourPx: [0, 2048], safeMaxThreat: [0, 1], routeThreatPenalty: [0, 64],
  sceneryRadiusPx: [32, 128], sceneryDensity: [0, 1], motionAmplitude: [0, 1.5], motionPeriodSeconds: [7, 30],
};
const CAPABILITIES = new Set(['surface:strata', 'surface:crystal', 'surface:glaze', 'field:direction',
  'support:single-plane', 'support:grid8', 'body:aabb20', 'void:opaque', 'organization:patches',
  'organization:bands', 'organization:clusters', 'collision:dynamic', 'space:multilevel']);
const snake = value => value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const FIXED = ['id', 'version', 'label', 'rule', 'weight', 'enabled', 'requires', 'excludes'];
const HEADER = [...FIXED, ...Object.keys(CONDITION_RANGE_LIMITS).flatMap(key => [`${snake(key)}_min`, `${snake(key)}_max`]), 'fallback_seeds'];
function fail(message) { throw new Error(`World conditions CSV: ${message}`); }
function number(value, context) {
  if (!value || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) fail(`${context} is not numeric`);
  const result = Number(value);
  if (!Number.isFinite(result)) fail(`${context} is not finite`);
  return result;
}
function clauses(value, context) {
  if (!value) return [];
  const result = value.split(';');
  if (new Set(result).size !== result.length) fail(`${context} has duplicate clauses`);
  for (const clause of result) {
    const alternatives = clause.split('|');
    if (new Set(alternatives).size !== alternatives.length || alternatives.some(cap => !CAPABILITIES.has(cap)))
      fail(`${context} has unsupported capability ${clause}`);
  }
  return result;
}
export function parseWorldConditionCsv(raw) {
  const lines = raw.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.shift() !== HEADER.join(',')) fail('unexpected schema/header');
  const ids = new Set();
  const rows = lines.map((line, index) => {
    const cells = line.split(',').map(value => value.trim());
    if (cells.length !== HEADER.length) fail(`row ${index + 2} has ${cells.length} columns`);
    const row = Object.fromEntries(HEADER.map((key, i) => [key, cells[i]]));
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(row.id) || ids.has(row.id)) fail(`invalid/duplicate id ${row.id}`);
    ids.add(row.id);
    if (row.version !== '1') fail(`${row.id}: unsupported operator version`);
    if (!row.label || row.label.length > 80) fail(`${row.id}: missing/oversized label`);
    if (!['deposition', 'fracture', 'aggregation'].includes(row.rule)) fail(`${row.id}: unsupported rule`);
    if (!['true', 'false'].includes(row.enabled)) fail(`${row.id}: enabled must be true/false`);
    const weight = number(row.weight, `${row.id}.weight`);
    if (weight <= 0 || weight > 1000) fail(`${row.id}: weight outside (0,1000]`);
    const requiredCapabilities = clauses(row.requires, `${row.id}.requires`);
    const excludedCapabilities = clauses(row.excludes, `${row.id}.excludes`);
    if (!requiredCapabilities.length) fail(`${row.id}: capability contract required`);
    const ranges = {};
    for (const [key, [lo, hi]] of Object.entries(CONDITION_RANGE_LIMITS)) {
      const min = number(row[`${snake(key)}_min`], `${row.id}.${key}.min`);
      const max = number(row[`${snake(key)}_max`], `${row.id}.${key}.max`);
      if (min < lo || max > hi || min > max) fail(`${row.id}.${key} outside [${lo},${hi}] or reversed`);
      ranges[key] = [min, max];
    }
    if (ranges.minimumDeepDetourPx[0] <= 0 || ranges.routeThreatPenalty[0] <= 0 || ranges.safeMaxThreat[1] >= .18)
      fail(`${row.id}: semantic ranges lose positive detour/penalty or safe/contested separation`);
    const fallbackSeeds = row.fallback_seeds.split(';').map(value => number(value, `${row.id}.fallback_seeds`));
    if (!fallbackSeeds.length || fallbackSeeds.length > 32 || new Set(fallbackSeeds).size !== fallbackSeeds.length
      || fallbackSeeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) fail(`${row.id}: invalid fallback seeds`);
    return { id: row.id, version: 1, label: row.label, rule: row.rule, weight, enabled: row.enabled === 'true',
      requiredCapabilities, excludedCapabilities, ranges, fallbackSeeds };
  });
  if (!rows.some(row => row.enabled)) fail('no enabled program');
  return rows;
}
export function generateWorldConditions({ check = false, root = ROOT } = {}) {
  const raw = readFileSync(resolve(root, INPUT), 'utf8');
  const rows = parseWorldConditionCsv(raw);
  const hash = createHash('sha256').update(raw).digest('hex');
  const output = `// Generated from ${INPUT}; do not edit.\nimport type { WorldConditionProgram } from '../generation/world-study/world-conditions';\n\nexport const WORLD_CONDITIONS_SOURCE_HASH = '${hash}';\nexport const WORLD_CONDITION_PROGRAMS: readonly WorldConditionProgram[] = ${JSON.stringify(rows, null, 2)};\n`;
  if (check) {
    if (readFileSync(resolve(root, OUTPUT), 'utf8') !== output) fail('generated data is stale');
  } else writeFileSync(resolve(root, OUTPUT), output);
  return { programs: rows.length, sourceHash: hash, output: OUTPUT, check };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(generateWorldConditions({ check: process.argv.includes('--check') })));
