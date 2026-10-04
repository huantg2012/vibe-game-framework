import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { createSearchRemainsPixels, type SearchRemainsMaterial } from '../../src/generation/world-study/search-remains';
import { SEARCH_REMAINS } from '../../src/generated/rift-search-remains';

const digest = (data: Uint8Array | Uint8ClampedArray): string => createHash('sha256').update(data).digest('hex');
const silhouette = (pixels: Uint8ClampedArray): Uint8Array => Uint8Array.from({ length: pixels.length / 4 }, (_, i) => pixels[i * 4 + 3]!);
// Captured from accepted 7eaa783d pixels, unchanged at 04cde7e9. These six
// seeds cover every existing mirror/vertical-offset shape. Material readability
// revisions may change RGB, never expand or replace these approved silhouettes.
const acceptedAlpha: Readonly<Record<string, string>> = {
  'laminated-flakes': 'ffa8d5194a029da31aa6123da9dc2fe22e72be788c5140646bbda59188069774',
  'fractured-fibres': '818574fd6d2797c53653714ed2f678570111795e6dc53e3bee48dce2391fa7f6',
  'glaze-shell': '6694a7fdbc48546be573cc8dcc8a7caafcbf6f78ce86a7be5866999c922d0018',
  'mineral-splinters': '4e27df9161ef5bfab3135ea15893f882b0b2eec0e1f72d78c7475b3ae9591287',
};
const profiles = [...WORLD_PROFILES, ...R100_NATIVE_WORLDS.filter(row => !WORLD_PROFILES.some(p => p.id === row.id)).map(row => row.profile)];
const sourceBefore = JSON.stringify(profiles);
const all = [];
for (const profile of profiles) {
  const definition = SEARCH_REMAINS.find(row => row.worldId === profile.id);
  assert.ok(definition, `Missing authored source identity for ${profile.id}`);
  const alphaFingerprint = createHash('sha256');
  for (const seed of [0, 1, 3, 4, 6, 8]) alphaFingerprint.update(silhouette(createSearchRemainsPixels(profile, seed).pixels));
  const alpha = alphaFingerprint.digest('hex');
  if (acceptedAlpha[definition.grammar]) assert.equal(alpha, acceptedAlpha[definition.grammar], `${profile.id}: approved alpha silhouette changed`);
  const variants = new Set<string>();
  for (const seed of [0, 1, 2, 7, 932, 10007, 70421, 20261003, 0xffffffff]) {
    const image = createSearchRemainsPixels(profile, seed);
    assert.equal(image.grammar, definition.grammar);
    assert.equal(image.sourceId, profile.id);
    assert.equal(image.width, 34); assert.equal(image.height, 26);
    assert.equal(image.pixels.length, image.width * image.height * 4);
    assert.deepEqual(image.pixels, createSearchRemainsPixels(profile, seed).pixels, 'Same source and seed must repeat exactly');
    let occupied = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4, a = image.pixels[i + 3]!;
      assert.ok(a === 0 || a === 255, 'World sprites must not contain antialiasing');
      if (x === 0 || y === 0 || x === image.width - 1 || y === image.height - 1) assert.equal(a, 0, 'Source clump touches canvas boundary');
      if (!a) assert.deepEqual(Array.from(image.pixels.subarray(i, i + 4)), [0, 0, 0, 0]);
      else occupied++;
    }
    // Mechanical size contract only; this does not claim visual quality.
    assert.ok(occupied >= 110 && occupied <= 420, `Unexpected searchable clump size ${occupied}`);
    variants.add(digest(image.pixels));
    all.push({ world: profile.id, seed, grammar: image.grammar, occupied, fingerprint: digest(image.pixels) });
  }
  assert.ok(variants.size >= 5, `${profile.id} seed variation collapsed`);
}
assert.equal(JSON.stringify(profiles), sourceBefore, 'World source profiles mutated');

const representativeByGrammar = new Map<string, Uint8Array>();
for (const profile of profiles) {
  const image = createSearchRemainsPixels(profile, 70421);
  const previous = representativeByGrammar.get(image.grammar);
  if (previous) assert.deepEqual(previous, silhouette(image.pixels), 'Shared shell grammar should retain material-independent structure');
  else representativeByGrammar.set(image.grammar, silhouette(image.pixels));
}
for (const [a, maskA] of representativeByGrammar) for (const [b, maskB] of representativeByGrammar) if (a < b) {
  const changed = maskA.reduce((sum, value, index) => sum + (value !== maskB[index] ? 1 : 0), 0);
  assert.ok(changed >= 65, `${a}/${b}: merely recolored instead of a different fracture structure (${changed})`);
}

const materialPixels = new Uint8ClampedArray(32 * 32 * 4);
for (let i = 0; i < 32 * 32; i++) { materialPixels[i * 4] = 110 + i % 83; materialPixels[i * 4 + 3] = 255; }
const material: SearchRemainsMaterial = {
  width: 32, height: 32, pixels: materialPixels, source: 'test-source',
  regions: { skin: { x: 0, y: 0, width: .5, height: .5 }, cleaved: { x: .5, y: 0, width: .5, height: .5 }, loose: { x: 0, y: .5, width: .5, height: .5 } },
};
const original = digest(materialPixels);
for (const profile of profiles) {
  const painted = createSearchRemainsPixels(profile, 7, material);
  assert.equal(painted.sourceId, material.source);
  assert.deepEqual(painted.pixels, createSearchRemainsPixels(profile, 7, material).pixels);
  assert.deepEqual(silhouette(painted.pixels), silhouette(createSearchRemainsPixels(profile, 7).pixels), 'Authored material must not change silhouette');
  for (let i = 0; i < painted.pixels.length; i += 4) if (painted.pixels[i + 3]) {
    assert.equal(painted.pixels[i + 1], 0); assert.equal(painted.pixels[i + 2], 0);
  }
}
assert.equal(digest(materialPixels), original, 'Shared painted material buffer mutated');
const changed = materialPixels.slice();
for (let i = 0; i < changed.length; i += 4) { changed[i] = 0; changed[i + 2] = 150; }
assert.notDeepEqual(createSearchRemainsPixels(WORLD_PROFILES[0]!, 7, material).pixels, createSearchRemainsPixels(WORLD_PROFILES[0]!, 7, { ...material, pixels: changed }).pixels, 'Material ignored');
assert.throws(() => createSearchRemainsPixels({ ...WORLD_PROFILES[0]!, id: 'missing-world' }, 0), /no source grammar/);
for (const seed of [-1, .5, NaN, Infinity, 0x100000000]) assert.throws(() => createSearchRemainsPixels(WORLD_PROFILES[0]!, seed), /unsigned integer/);
assert.throws(() => createSearchRemainsPixels(WORLD_PROFILES[0]!, 7, { ...material, width: 31 }), /source material/);
assert.throws(() => createSearchRemainsPixels(WORLD_PROFILES[0]!, 7, { ...material, regions: { ...material.regions!, loose: { x: .9, y: 0, width: .5, height: .5 } } }), /source patch/);
const profileWithUnrelatedLoot = { ...WORLD_PROFILES[0]!, lootKind: 'contaminant', rarity: 'rare', tier: 'deep', baseValue: 900 };
assert.deepEqual(createSearchRemainsPixels(profileWithUnrelatedLoot, 7).pixels, createSearchRemainsPixels(WORLD_PROFILES[0]!, 7).pixels, 'Source appearance must not inspect unrelated hidden loot fields');
console.log(JSON.stringify({ status: 'pass', samples: all.length, acceptedSilhouetteChecks: WORLD_PROFILES.length * 6, silhouetteBaseline: '7eaa783d / 04cde7e9', worldSources: profiles.length, distinctGrammars: representativeByGrammar.size, limits: 'CPU pixels, deterministic provenance and structure only; native lit-world readability needs visual review.', samplesDetail: all }, null, 2));
