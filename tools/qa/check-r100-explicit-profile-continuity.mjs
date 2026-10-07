#!/usr/bin/env node
/** Actual frozen dispatch plus adversarial mutations. No map or browser work. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertExplicitProfileContinuity} from './r100-explicit-profile-continuity.mjs';

const base = 'docs/qa/artifacts/r100-i10-i12';
const beforePath = `${base}/b12-source/source-snapshot.json`, afterPath = `${base}/b14-source/source-snapshot.json`;
const output = process.argv[2]; assert(output && !fs.existsSync(output), 'New output path required');
const hash = value => createHash('sha256').update(value).digest('hex');
const receipt = file => ({path: file, sha256: hash(fs.readFileSync(file))});
const before = JSON.parse(fs.readFileSync(beforePath)), after = JSON.parse(fs.readFileSync(afterPath));
const read = (source, file) => {
  const bytes = fs.readFileSync(path.join(source.temporaryRoot, file));
  assert.equal(hash(bytes), source.sources[file]); return bytes.toString();
};
const folder = 'src/generation/world-study/';
const input = {instances: [{constructionVersion: 3, shapeProfile: 'pleated-sheet'}]};
for (const [key, file] of [['Expansion', 'native-volume-expansion.ts'], ['Ground', 'native-volume-ground.ts'], ['Geometry', 'native-volume-geometry.ts']]) {
  input[`old${key}`] = read(before, folder + file); input[`new${key}`] = read(after, folder + file);
}
input.tearModule = read(after, folder + 'native-volume-pleated-tear.ts');
input.settledModule = read(after, folder + 'native-volume-settled-sheet.ts');
const checks = [], report = {status: 'running', scope: 'Actual frozen source default-path proof plus negative code mutations; no new-shape acceptance, RGBA run or game execution.',
  before: receipt(beforePath), after: receipt(afterPath), tool: receipt('tools/qa/r100-explicit-profile-continuity.mjs'),
  harness: receipt('tools/qa/check-r100-explicit-profile-continuity.mjs'), checks};
try {
  report.proof = assertExplicitProfileContinuity(input); checks.push({name: 'actual frozen default pleated path and old dispatch', status: 'pass'});
  for (const [name, mutate] of [
    ['selected new tear', value => { value.instances[0].shapeProfile = 'pleated-tear'; }],
    ['selected new settled sheet', value => { value.instances[0].shapeProfile = 'settled-sheet'; }],
    ['selected new settled fan', value => { value.instances[0].shapeProfile = 'settled-fan'; }],
    ['new branch defaults on', value => { value.newExpansion = value.newExpansion.replace('openedTear = false', 'openedTear = true'); }],
    ['old quad pigment changed', value => { value.newExpansion = value.newExpansion.replace('else b.quad(a, c, d, e, 0,', 'else b.quad(a, c, d, e, 1,'); }],
    ['old dispatch enters new variant', value => { value.newExpansion = value.newExpansion.replace("case 'pleated-sheet': pleatedSheet(builder);", "case 'pleated-sheet': pleatedSheet(builder, true);"); }],
    ['unguarded tear creation', value => { value.newExpansion = value.newExpansion.replace('openedTear && piece === 1 ? createPleatedTear', 'piece === 1 ? createPleatedTear'); }],
    ['extra module top-level work', value => { value.tearModule += '\nMath.random();\n'; }],
    ['runtime import in inert module', value => { value.tearModule = value.tearModule.replace('import type {', 'import {'); }],
    ['new unaudited export', value => { value.settledModule += '\nexport function other() {}\n'; }],
    ['old ground dispatch changed', value => { value.newGround = value.newGround.replace("case 'clamp-bank': clampBank(builder);", "case 'clamp-bank': buildSettledSheet(builder);"); }],
    ['shared validator changes', value => { value.newGeometry = value.newGeometry.replace('spec.length < 16', 'spec.length < 8'); }],
    ['widened settled validation scope', value => { value.newGeometry = value.newGeometry.replace("spec.shapeProfile === 'settled-fan')", "spec.shapeProfile !== 'settled-fan')"); }],
  ]) {
    const candidate = structuredClone(input); mutate(candidate); assert.notDeepEqual(candidate, input, `No-op test: ${name}`);
    assert.throws(() => assertExplicitProfileContinuity(candidate), undefined, name); checks.push({name, status: 'pass'});
  }
  // Exercise the public gate with small metadata fixtures containing the real
  // dispatch text. These are gate contracts, not complete production closures.
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-explicit-profile-contract-'));
  try {
    const literal = (name, value) => `export const ${name} = ${JSON.stringify(value)} as const;`;
    const world = {id: 'fixture-pleated', enabled: false,
      definitions: [{family: 'tension-surface', instances: input.instances}]};
    const common = {
      'src/generated/r100-native-worlds.ts': literal('R100_NATIVE_WORLDS', [world]),
      'src/generated/r100-world-appearance.ts': literal('R100_WORLD_APPEARANCES', [{worldId: world.id}]),
      'src/generated/rift-search-remains.ts': literal('SEARCH_REMAINS', [{worldId: world.id, grammar: 'fixture'}]),
      'src/generated/r100-package-manifest.ts': literal('R100_MATERIAL_DEPENDENCIES', {'tension-surface': {definition: 'same', surface: 'same', solid: 'same'}}),
      'src/existing-consumer.ts': 'export const unchanged = 1;',
    };
    const oldFiles = {...common}, newFiles = {...common};
    for (const [key, file] of [['Expansion', 'native-volume-expansion.ts'], ['Ground', 'native-volume-ground.ts'], ['Geometry', 'native-volume-geometry.ts']]) {
      oldFiles[folder + file] = input[`old${key}`]; newFiles[folder + file] = input[`new${key}`];
    }
    newFiles[folder + 'native-volume-pleated-tear.ts'] = input.tearModule;
    newFiles[folder + 'native-volume-settled-sheet.ts'] = input.settledModule;
    const snapshot = (name, files) => {
      const directory = path.join(temporary, name), sources = {};
      for (const [file, content] of Object.entries(files)) {
        const target = path.join(directory, file); fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, content); sources[file] = hash(content);
      }
      const target = path.join(directory, 'snapshot.json');
      fs.writeFileSync(target, JSON.stringify({temporaryRoot: directory, sources})); return target;
    };
    for (const [name, mutate, flag, expected, error] of [
      ['public gate explicit mode', () => {}, true, true],
      ['public gate requires explicit mode', () => {}, false, false, /Unreviewed runtime change/],
      ['extra consumer rejected', files => { files['src/existing-consumer.ts'] = "import {createPleatedTear} from './generation/world-study/native-volume-pleated-tear'; export const unchanged = createPleatedTear;"; }, true, false, /Only the audited opt-in tear branch/],
      ['unregistered draft file remains unreviewed', files => { files[folder + 'native-volume-compressed-felt.ts'] = 'export function draft() {}'; }, true, false, /Unexpected new source files/],
    ]) {
      const files = {...newFiles}; mutate(files);
      const a = snapshot(name + '-before', oldFiles), b = snapshot(name + '-after', files), destination = path.join(temporary, name + '.json');
      const args = ['tools/qa/r100-source-continuity.mjs', '--from', a, '--to', b, '--worlds', world.id, '--output', destination];
      if (flag) args.push('--unused-explicit-profiles');
      const result = spawnSync(process.execPath, args, {encoding: 'utf8'});
      assert.equal(result.status === 0, expected, `${name}: ${result.stderr || result.stdout}`);
      assert.equal(fs.existsSync(destination), expected, `${name}: false receipt`);
      if (error) assert.match(result.stderr, error);
      checks.push({name, status: 'pass'});
    }
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
  report.bindingTool = receipt('tools/qa/r100-source-continuity.mjs');
  report.status = 'pass';
} catch (error) { report.status = 'failed'; report.error = String(error.stack ?? error); process.exitCode = 1; }
fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`${report.status}: ${checks.length} explicit-profile source contracts`);
