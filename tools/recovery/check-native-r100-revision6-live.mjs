/** Saved revision6 must dispatch to its original data contract, not a live rebuild.
 * Constructors differ across independent bundles; compare every own field and
 * raw typed-array byte, never prototype object identity. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import * as historical from '../../src/generation/legacy-r100-v6/executor.js';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
const arg = process.argv.indexOf('--report');
assert(arg >= 0 && process.argv[arg + 1], '--report required');
const report = process.argv[arg + 1]; assert(!existsSync(report), 'Never overwrite earlier evidence');
const receipt = path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
/** Framed values avoid allocating multi-hundred-MiB JSON/base64 copies. */
function exactHash(value) {
  const hash = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) { hash.update(`typed:${item.constructor.name}:${item.byteLength}:`); hash.update(new Uint8Array(item.buffer, item.byteOffset, item.byteLength)); return; }
    if (Array.isArray(item)) { hash.update(`array:${item.length}[`); for (const child of item) visit(child); hash.update(']'); return; }
    if (item instanceof Map) { hash.update(`map:${item.size}[`); for (const [key, child] of item) { visit(key); visit(child); } hash.update(']'); return; }
    if (item && typeof item === 'object') { hash.update('{'); for (const key of Object.keys(item)) { visit(key); visit(item[key]); } hash.update('}'); return; }
    assert.notEqual(typeof item, 'function', 'Serialized payload must not contain functions');
    const text = typeof item === 'undefined' ? 'undefined' : JSON.stringify(item);
    hash.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value); return hash.digest('hex');
}

const cases=[]; let failure;
try {
  for (const [world,grade] of [['cinder-ridge','medium'], ['marrow-break','severe']]) {
    const recipe=historical.createR100ProductionRecipe(world,20261010,grade);
    assert(validR100ProductionRecipe(recipe));
    const expected=historical.createR100ProductionMap(recipe);
    const actual=createR100ProductionMap(recipe);
    const payloadHash=exactHash(expected), layoutHash=exactHash(expected.layout), nativeHash=exactHash(expected.native);
    assert.equal(exactHash(actual),payloadHash,`${world}: exact live outer route payload`);
    assert.equal(exactHash(actual.layout),layoutHash,`${world}: exact layout`);
    assert.equal(exactHash(actual.native),nativeHash,`${world}: exact native data`);
    cases.push({world,grade,seed:recipe.requestedSeed,payloadHash,layoutHash,nativeHash});
    console.log(`PASS live r6 route: ${world}/${grade}`);
  }
} catch(error) { failure=error instanceof Error?error.stack:String(error); }
mkdirSync(dirname(report),{recursive:true});
writeFileSync(report,JSON.stringify({status:failure?'failed':'pass',cases,failure,
  sources:['src/generation/world-study/r100-package.ts','src/generation/world-study/r100-production-map.ts',
    'src/generation/legacy-r100-v6/executor.js','src/generation/legacy-r100-v6/executor-recovery.js',
    'tools/recovery/check-native-r100-revision6-live.mjs'].map(receipt),
  hashSchema:'framed values and raw typed-array bytes v1; all own fields, no identity exclusions; bundle-local prototype identities excluded',
  correction:'Prior deepStrictEqual harness compared TileGrid constructors from separate immutable bundles; corrected to the exact data protocol already used in three-archive checks.',
  scope:'Two real saved revision6 recipes through public live dispatch versus original immutable generation. No new revision7 map qualification.'},null,2)+'\n',{flag:'wx'});
if(failure) throw new Error(failure);
