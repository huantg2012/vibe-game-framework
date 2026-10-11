/** Keep a representative-only authoring change from altering unrelated worlds. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const baseline = process.env.QA_BASELINE ?? 'fc5a5f2b';
const output = process.env.QA_REPORT;
const representatives = new Set((process.env.QA_WORLDS ?? 'cleft-tableland,pale-sail,cinder-ridge').split(','));
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
assert(representatives.size > 0 && [...representatives].every(id => old.R100_SPATIAL_WORLDS.some(row => row.worldId === id)), 'Unknown changed-world scope');
assert.deepEqual(current.R100_SPATIAL_WORLDS.map(row => row.worldId), old.R100_SPATIAL_WORLDS.map(row => row.worldId), 'World catalog');
for (const key of ['CONFIG', 'PLACEMENTS', 'EROSION', 'ANCHORS', 'MATERIALS']) {
  assert.deepEqual(current[`R100_SPATIAL_${key}`], old[`R100_SPATIAL_${key}`], key);
}
const checked = [];
for (const row of old.R100_SPATIAL_WORLDS) {
  if (representatives.has(row.worldId)) continue;
  assert.deepEqual(current.R100_SPATIAL_WORLDS.find(value => value.worldId === row.worldId), row, row.worldId);
  for (const key of ['R100_SPATIAL_AUTHORED_GROUPS', 'R100_SPATIAL_SECTORS']) {
    assert.deepEqual(current[key]?.find(value => value.worldId === row.worldId), old[key]?.find(value => value.worldId === row.worldId), `${row.worldId} ${key}`);
  }
  checked.push(row.worldId);
}
for (const row of old.R100_SPATIAL_ORGANIZATIONS) {
  assert.deepEqual(current.R100_SPATIAL_ORGANIZATIONS.find(value => value.organization === row.organization), row, row.organization);
}
assert.equal(checked.length, old.R100_SPATIAL_WORLDS.length - representatives.size);
assert.deepEqual(new Set(current.R100_SPATIAL_SECTORS.map(row => row.worldId)), new Set(current.R100_SPATIAL_WORLDS.filter(row => row.organization === 'authored-sectors').map(row => row.worldId)));
const report = {
  status: 'passed', baseline, baselineSourceHash: hash(oldSource), currentSourceHash: hash(currentSource),
  scope: `${checked.length} unrelated worlds retain every placement, erosion, anchor, material and organization value, including complete authored sector policies. Only the ${representatives.size} explicitly named representative worlds may change. Global CSV sourceHash advances. This is source-data scope verification, not visual or runtime acceptance.`,
  checkedWorlds: checked, representatives: [...representatives],
};
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
console.log(`PASS ${checked.length} unrelated worlds: all spatial authoring values unchanged; ${representatives.size} named representative worlds may change`);
