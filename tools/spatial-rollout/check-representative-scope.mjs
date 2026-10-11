/** Keep a representative-only authoring change from altering unrelated worlds. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const baseline = process.env.QA_BASELINE ?? 'fc5a5f2b';
const output = process.env.QA_REPORT;
const representatives = new Set(['cleft-tableland', 'pale-sail', 'cinder-ridge']);
const sourcePath = 'src/generated/r100-spatial-data.ts';
const oldSource = execFileSync('git', ['show', `${baseline}:${sourcePath}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const currentSource = fs.readFileSync(sourcePath, 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
// Generated constants contain JSON only; do not evaluate source as JavaScript.
function constants(source) {
  const values = {};
  for (const match of source.matchAll(/export const (R100_SPATIAL_\w+) = ([\s\S]*?) as const;/g)) values[match[1]] = JSON.parse(match[2]);
  assert(values.R100_SPATIAL_WORLDS, 'Missing generated spatial catalog');
  return values;
}
const old = constants(oldSource), current = constants(currentSource);
for (const key of ['CONFIG', 'PLACEMENTS', 'EROSION', 'ANCHORS', 'MATERIALS']) {
  assert.deepEqual(current[`R100_SPATIAL_${key}`], old[`R100_SPATIAL_${key}`], key);
}
const checked = [];
for (const row of old.R100_SPATIAL_WORLDS) {
  if (representatives.has(row.worldId)) continue;
  assert.deepEqual(current.R100_SPATIAL_WORLDS.find(value => value.worldId === row.worldId), row, row.worldId);
  checked.push(row.worldId);
}
for (const row of old.R100_SPATIAL_AUTHORED_GROUPS) {
  if (!representatives.has(row.worldId)) assert.deepEqual(current.R100_SPATIAL_AUTHORED_GROUPS.find(value => value.worldId === row.worldId), row, row.worldId);
}
for (const row of old.R100_SPATIAL_ORGANIZATIONS) {
  assert.deepEqual(current.R100_SPATIAL_ORGANIZATIONS.find(value => value.organization === row.organization), row, row.organization);
}
assert.equal(checked.length, 105);
assert.deepEqual(new Set(current.R100_SPATIAL_SECTORS.map(row => row.worldId)), representatives);
const report = {
  status: 'passed', baseline, baselineSourceHash: hash(oldSource), currentSourceHash: hash(currentSource),
  scope: '105 unrelated worlds retain every placement, erosion, anchor, material and organization value; only three explicitly registered representatives change. Global CSV sourceHash advances. This is source-data scope verification, not visual or runtime acceptance.',
  checkedWorlds: checked, representatives: [...representatives],
};
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
console.log('PASS 105 unrelated worlds: all spatial authoring values unchanged; three representative sector layouts registered');
