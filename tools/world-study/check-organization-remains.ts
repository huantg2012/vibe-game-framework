import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { R100_WORLD_APPEARANCES } from '../../src/generated/r100-world-appearance';
import { SEARCH_REMAINS } from '../../src/generated/rift-search-remains';
import { createSearchRemainsGrammarPixels, type SearchRemainsMaterial } from '../../src/generation/world-study/search-remains';

const out = process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i10-i12/material-organization/remains-v1';
mkdirSync(out, { recursive: true });
const digest = (bytes: Uint8Array | Uint8ClampedArray) => createHash('sha256').update(bytes).digest('hex');
const alpha = (pixels: Uint8ClampedArray) => Uint8Array.from({ length: pixels.length / 4 }, (_, i) => pixels[i * 4 + 3]!);
const samples = [];
for (const [organization, grammar, world] of [
  ['short-fibre', 'compressed-fibre-fragments', 'pallid-membrane'],
  ['porous-marrow', 'porous-core-chips', 'cinder-ridge'],
] as const) {
  assert.ok(!SEARCH_REMAINS.some(row => String(row.grammar) === grammar), 'Candidate is not yet selected by any world');
  const profile = R100_NATIVE_WORLDS.find(row => row.id === world)!.profile;
  const definition = ORGANIZATION_MATERIALS.find(row => row.organization === organization)!;
  const source = `public${definition.source}`;
  const prepared = await sharp(source).resize(512, 512).ensureAlpha().raw().toBuffer();
  const painting: SearchRemainsMaterial = { width: 512, height: 512, pixels: new Uint8ClampedArray(prepared), source: definition.source, regions: definition.regions, appearance: R100_WORLD_APPEARANCES.find(row => row.worldId === world)! };
  const original = digest(painting.pixels);
  const fingerprints = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const result = createSearchRemainsGrammarPixels(profile, seed, grammar, painting);
    assert.deepEqual(result.pixels, createSearchRemainsGrammarPixels(profile, seed, grammar, painting).pixels);
    assert.deepEqual(alpha(result.pixels), alpha(createSearchRemainsGrammarPixels(profile, seed, grammar).pixels), 'Source pigment cannot change shape');
    assert.equal(result.width, 34); assert.equal(result.height, 26);
    let occupied = 0;
    for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) {
      const i = (y * result.width + x) * 4, a = result.pixels[i + 3]!;
      assert.ok(a === 0 || a === 255);
      if (!a) assert.deepEqual(Array.from(result.pixels.subarray(i, i + 4)), [0, 0, 0, 0]);
      else occupied++;
      if (x === 0 || y === 0 || x === 33 || y === 25) assert.equal(a, 0, 'Unclipped transparent padding');
    }
    assert.ok(occupied >= 110 && occupied <= 420, `Search clump occupancy ${occupied}`);
    fingerprints.add(digest(result.pixels));
  }
  assert.ok(fingerprints.size >= 5);
  assert.equal(digest(painting.pixels), original);
  const oldGrammars = [...new Set(SEARCH_REMAINS.map(row => row.grammar))];
  const ownAlpha = alpha(createSearchRemainsGrammarPixels(profile, 70421, grammar).pixels);
  for (const oldGrammar of oldGrammars) {
    const oldAlpha = alpha(createSearchRemainsGrammarPixels(profile, 70421, oldGrammar).pixels);
    const difference = ownAlpha.reduce((n, value, i) => n + Number(value !== oldAlpha[i]), 0);
    assert.ok(difference >= 65, `${grammar} merely recolors ${oldGrammar}: ${difference}`);
  }
  const sheet = new Uint8Array(34 * 4 * 26 * 4);
  for (const [column, seed] of [0, 7, 932, 70421].entries()) {
    const image = createSearchRemainsGrammarPixels(profile, seed, grammar, painting);
    for (let y = 0; y < 26; y++) sheet.set(image.pixels.subarray(y * 34 * 4, (y + 1) * 34 * 4), (y * 136 + column * 34) * 4);
  }
  const path = `${out}/${organization}-native.png`;
  await sharp(sheet, { raw: { width: 136, height: 26, channels: 4 } }).png().toFile(path);
  await sharp(sheet, { raw: { width: 136, height: 26, channels: 4 } }).resize(816, 156, { kernel: 'nearest' }).png().toFile(`${out}/${organization}-6x.png`);
  samples.push({ organization, grammar, source, sourceSha256: digest(readFileSync(source)), preparedSha256: original, comparisonAppearance: world, variants: fingerprints.size, nativePath: path, nativeSha256: digest(readFileSync(path)), seeds: [0, 7, 932, 70421] });
}
assert.throws(() => createSearchRemainsGrammarPixels(R100_NATIVE_WORLDS[0]!.profile, 0, 'unknown' as never), /unsupported source grammar/);
const report = { status: 'cpu-pass-visual-candidate', samples, scope: '200 deterministic 34x26 source-material clumps, opaque hard edges, preserved source buffers and silhouettes differ from prior seven. Unlit previews using existing world ramps; not normal-view art approval and no world opted in.' };
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
