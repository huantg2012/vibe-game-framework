/** Reject malformed author registrations at CSV compilation, without changing live author data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-fragment-registration-'));
const script = 'tools/world-study/codegen-r100-spatial.mjs';
const output = process.env.QA_REPORT;
if (output) assert(!fs.existsSync(output), 'Do not overwrite previous evidence');
const files = [script, ...fs.readdirSync('data').filter(name => name.endsWith('.csv')).map(name => `data/${name}`)];
const original = new Map(files.map(file => [file, fs.readFileSync(file, 'utf8')]));
const sourceHashes = Object.fromEntries([...original].map(([file, content]) => [file, createHash('sha256').update(content).digest('hex')]));
for (const [file, content] of original) {fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true}); fs.writeFileSync(path.join(root, file), content);}
fs.mkdirSync(path.join(root, 'src/generated'), {recursive: true});
const fragmentIds = original.get('data/rift-spatial-fragment-worlds.csv').trim().split(/\r?\n/).slice(1).map(line => line.split(',')[0]);
assert(fragmentIds.length > 0);
const targetWorld = fragmentIds.at(-1);
function edit(file, transform) {fs.writeFileSync(path.join(root, file), transform(original.get(file)));}
function rowEdit(file, select, change) {
  edit(file, text => {
    const [header, ...lines] = text.trim().split(/\r?\n/), keys = header.split(',');
    return [header, ...lines.map(line => {
      const values = line.split(','), row = Object.fromEntries(keys.map((key, i) => [key, values[i]]));
      if (select(row)) change(row);
      return keys.map(key => row[key]).join(',');
    })].join('\n') + '\n';
  });
}
function withoutLegacyFragmentErosion() {
  edit('data/rift-spatial-authored-erosion.csv', text => text.split(/\r?\n/).filter(line => !fragmentIds.includes(line.split(',')[0])).join('\n'));
}
const cases = [
  {name: 'valid source', mutate() {}, error: null},
  {name: 'fragment needs no unused legacy erosion', mutate: withoutLegacyFragmentErosion, error: null},
  {name: 'unregistered world cannot omit legacy erosion', mutate() {withoutLegacyFragmentErosion(); edit('data/rift-spatial-fragment-worlds.csv', text => text.split(/\r?\n/).filter(line => line.split(',')[0] !== targetWorld).join('\n')); edit('data/rift-spatial-fragment-layouts.csv', text => {const layoutId = original.get('data/rift-spatial-fragment-worlds.csv').split(/\r?\n/).find(line => line.startsWith(`${targetWorld},`)).split(',')[1]; return text.split(/\r?\n/).filter(line => line.split(',')[0] !== layoutId).join('\n');}); edit('data/rift-spatial-fragment-rectangles.csv', text => {const layoutId = original.get('data/rift-spatial-fragment-worlds.csv').split(/\r?\n/).find(line => line.startsWith(`${targetWorld},`)).split(',')[1]; return text.split(/\r?\n/).filter(line => line.split(',')[0] !== layoutId).join('\n');});}, error: /Incomplete sector arrangement/},
  {name: 'unknown fragment field', mutate() {edit('data/rift-spatial-fragment-worlds.csv', text => text.trim().split(/\r?\n/).map((line, index) => line + (index ? ',yes' : ',unknown_field')).join('\n') + '\n');}, error: /Unexpected fragment CSV columns/},
  {name: 'unknown world', mutate() {rowEdit('data/rift-spatial-fragment-worlds.csv', row => row.world_id === targetWorld, row => {row.world_id = 'unknown-world';});}, error: /Invalid fragment spatial registration/},
  {name: 'duplicate world binding', mutate() {edit('data/rift-spatial-fragment-worlds.csv', text => text.trim() + '\n' + text.trim().split(/\r?\n/).at(-1) + '\n');}, error: /Duplicate spatial key/},
  {name: 'unknown layout', mutate() {rowEdit('data/rift-spatial-fragment-worlds.csv', row => row.world_id === targetWorld, row => {row.layout_id = 'missing-layout';});}, error: /Invalid fragment spatial registration/},
  {name: 'unsupported scale', mutate() {rowEdit('data/rift-spatial-fragment-layouts.csv', () => true, row => {row.world_scale = '1';});}, error: /Invalid fragment spatial registration/},
  {name: 'unsupported edge seed mode', mutate() {rowEdit('data/rift-spatial-fragment-worlds.csv', row => row.world_id === targetWorld, row => {row.edge_seed_mode = 'retry-seed';});}, error: /Invalid fragment spatial registration/},
  {name: 'blank seed salt', mutate() {rowEdit('data/rift-spatial-fragment-worlds.csv', row => row.world_id === targetWorld, row => {row.seed_salt = '';});}, error: /Invalid spatial number/},
  {name: 'mirrored registration', mutate() {rowEdit('data/rift-spatial-worlds.csv', row => row.world_id === targetWorld, row => {row.mirror_x = 'true';});}, error: /Invalid fragment spatial registration/},
  {name: 'orphan rectangle', mutate() {let changed = false; rowEdit('data/rift-spatial-fragment-rectangles.csv', () => !changed, row => {row.layout_id = 'missing-layout'; changed = true;});}, error: /Incomplete fragment layout registration|Unknown fragment rectangle registration/},
  {name: 'missing spawn anchors', mutate() {edit('data/rift-spatial-sector-anchors.csv', text => text.split(/\r?\n/).filter(line => line.split(',')[0] !== targetWorld).join('\n'));}, error: /Incomplete sector arrangement/},
];
const results = [];
try {
  for (const item of cases) {
    for (const [file, content] of original) fs.writeFileSync(path.join(root, file), content);
    item.mutate();
    const result = spawnSync(process.execPath, [script], {cwd: root, encoding: 'utf8'});
    if (item.error) {assert.notEqual(result.status, 0, `${item.name} accepted`); assert.match(result.stderr, item.error, `${item.name} rejected for wrong reason`);}
    else assert.equal(result.status, 0, `${item.name}: ${result.stderr}`);
    results.push({name: item.name, expected: item.error ? 'rejected' : 'accepted', status: 'passed'});
  }
  console.log(`PASS ${results.length} build-time fragment registration contracts`);
  if (output) {fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, `${JSON.stringify({status: 'passed', sourceHashes, fragmentIds, cases: results}, null, 2)}\n`, {flag: 'wx'});}
} catch (error) {
  if (output && !fs.existsSync(output)) {fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, `${JSON.stringify({status: 'failed', sourceHashes, fragmentIds, cases: results, error: error.stack ?? String(error)}, null, 2)}\n`, {flag: 'wx'});}
  throw error;
} finally {fs.rmSync(root, {recursive: true, force: true});}
