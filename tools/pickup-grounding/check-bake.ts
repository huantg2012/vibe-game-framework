import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bakeSearchSitePatches, type SearchSiteMaterialPatch, type SearchSiteSurfaceChannels } from '../../src/systems/r100-world/search-site-bake';
import type { MasterSurfaceBake } from '../../src/systems/r100-world/surface-bake';
import type { MasterWorld } from '../../src/generation/world-study/r100-master-world';
import type { R100SearchSitePlacement } from '../../src/generation/world-study/search-site-types';
import { NATIVE_VOLUME_FAMILY_SEQUENCE } from '../../src/generation/world-study/native-volume-geometry';
import type { PaintedMaterial } from '../../src/systems/r100-world/painted-material';

const channels = ['albedo', 'normal', 'response', 'emission'] as const;
const digest = (value: SearchSiteSurfaceChannels): string => {
  const hash = createHash('sha256'); for (const channel of channels) hash.update(value[channel]); return hash.digest('hex');
};
const width = 256, height = 192;
const base: MasterSurfaceBake = { width, height, albedo: new Uint8Array(width * height * 4), normal: new Uint8Array(width * height * 4),
  response: new Uint8Array(width * height * 4), emission: new Uint8Array(width * height * 4), diagnostics: {} };
for (let i = 0; i < width * height; i++) {
  const q = i * 4;
  base.albedo.set([41 + i % 7, 37 + i % 11, 51 + i % 13, 255], q);
  base.normal.set([128, 128, 255, 245], q);
  base.response.set([210, 2, 0, 0], q);
  base.emission.set([i % 2, i % 3, i % 5, 0], q);
}
const makeSite = (family = NATIVE_VOLUME_FAMILY_SEQUENCE[0]!, seed = 144): R100SearchSitePlacement => ({
  version: 1, nodeId: 'node-a', position: { x: 128, y: 96 }, visualSeed: seed, sourceKind: 'ground-accumulation',
  family, groundFamily: family, sourceObjectId: null, sourceAnchor: null, axis: .24, footprintProfile: 'grounded-material-v1', sourceDomain: 'ground',
});
const makeWorld = (sites: readonly R100SearchSitePlacement[]): MasterWorld => ({
  algorithmRevision: 9, searchSites: sites,
  raster: { width, height },
  definition: { axis: .24, family: sites[0]?.family },
  sample: { seed: 42, profile: { palette: { materialMid: 0xa87866, faceLight: 0xc6ae8d } } },
  matterAt: (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height,
  roleAt: () => null,
  layout: { kindling: [{ value: 3 }], contaminants: [{ reward: 'never-read' }] },
} as unknown as MasterWorld);
const worldBefore = digest(base), variants: Record<string, number> = {};
let cases = 0;
for (const family of NATIVE_VOLUME_FAMILY_SEQUENCE) {
  const fingerprints = new Set<string>();
  for (const seed of [1, 2, 144, 39017]) for (const axis of [0, .78, 1.6]) for (const sourceKind of ['ground-accumulation', 'surface-peel', 'detached'] as const) {
    const site: R100SearchSitePlacement = { ...makeSite(family, seed), axis, sourceKind,
      ...(sourceKind === 'detached' ? { sourceObjectId: 1, sourceAnchor: { x: 100, y: 80 }, sourceDomain: 'formation' } : {}) };
    const world = makeWorld([site]);
    const patch = bakeSearchSitePatches(world, base)[0]!;
    assert.equal(patch.width, 80); assert.equal(patch.height, 64);
    assert.equal(patch.nodeId, site.nodeId);
    assert.equal(digest(patch.intact), digest(bakeSearchSitePatches(world, base)[0]!.intact), 'Preparation must repeat exactly');
    assert.notEqual(digest(patch.intact), digest(patch.searched), `${family} must change geometry on search`);
    fingerprints.add(digest(patch.intact));
    let intactMax = 0, searchedMax = 0, changed = 0, outsideCore = 0, changedOutside = 0;
    let intactCorePixels = 0, searchedCorePixels = 0, intactCentre = 0, searchedCentre = 0;
    for (let py = 0; py < patch.height; py++) for (let px = 0; px < patch.width; px++) {
      const q = (py * patch.width + px) * 4, b = ((patch.y + py) * width + patch.x + px) * 4;
      const z = (value: Uint8Array): number => (value[q + 1]! * 256 + value[q + 2]!) / 128 - 4;
      intactMax = Math.max(intactMax, z(patch.intact.response)); searchedMax = Math.max(searchedMax, z(patch.searched.response));
      const distance = Math.hypot(px + .5 - 40, py + .5 - 32);
      if (distance <= 18) { if (z(patch.intact.response) > 0) intactCorePixels++; if (z(patch.searched.response) > 0) searchedCorePixels++; }
      if (distance <= 6) { if (z(patch.intact.response) > 0) intactCentre++; if (z(patch.searched.response) > 0) searchedCentre++; }
      const different = channels.some(channel => [0, 1, 2, 3].some(c => patch.intact[channel][q + c] !== base[channel][b + c]));
      if (different) { changed++; assert.deepEqual(patch.intact.emission.subarray(q, q + 4), new Uint8Array(4), 'New residue cannot emit light'); }
      if (Math.abs(px - 40) > 18 || Math.abs(py - 32) > 13) { outsideCore++; if (different) changedOutside++; }
    }
    assert.ok(changed > 100, `${family}: missing material site`);
    assert.ok(intactMax > 1 && intactMax <= 4, `${family}: core exceeds shallow physical budget ${intactMax}`);
    assert.ok(searchedMax < intactMax && searchedMax <= 1, `${family}: searched core did not flatten`);
    assert.ok(changedOutside / outsideCore < .35, `${family}: peripheral substrate must remain exposed`);
    if (family === 'fibre-knot' || family === 'membrane-rim') {
      // Protect the specific first-review rejection: a lowered but complete
      // shape (or an equally dense parallel field) is not a searched remnant.
      assert.ok(searchedCorePixels < intactCorePixels * .65, `${family}: searched state retained a complete central object`);
      assert.ok(intactCentre >= 24 && searchedCentre < intactCentre * .25, `${family}: searched knot/fold did not expose its centre`);
    }
    cases++;
  }
  assert.ok(fingerprints.size >= 10, `${family}: real geometry variation collapsed`);
  variants[family] = fingerprints.size;
}
assert.equal(digest(base), worldBefore, 'Bake mutated shared base receiver');

// Actual terrain and native solid footprints clip all channels, including light
// response and emission. Copying only the albedo is insufficient protection.
const clippedSite = makeSite('membrane-rim');
const clippedWorld = { ...makeWorld([clippedSite]), matterAt: (x: number) => x < 129,
  roleAt: (_x: number, y: number) => y > 98 ? 'solid' as const : null };
const clipped = bakeSearchSitePatches(clippedWorld, base)[0]!;
for (let y = 0; y < clipped.height; y++) for (let x = 0; x < clipped.width; x++) {
  if (clipped.x + x < 129 && clipped.y + y <= 98) continue;
  const q = (y * clipped.width + x) * 4, b = ((clipped.y + y) * width + clipped.x + x) * 4;
  for (const state of [clipped.intact, clipped.searched]) for (const channel of channels) {
    assert.deepEqual(state[channel].subarray(q, q + 4), base[channel].subarray(b, b + 4), 'Unsupported material altered the receiver');
  }
}

const normalSite = makeSite('fibre-knot'), normalWorld = makeWorld([normalSite]);
const paint = (red: number): PaintedMaterial => ({ width: 8, height: 8, worldSize: 24, source: 'fixture',
  pixels: Uint8ClampedArray.from({ length: 8 * 8 * 4 }, (_, i) => i % 4 === 3 ? 255 : i % 4 === 0 ? red : 70) });
const dark = bakeSearchSitePatches(normalWorld, base, paint(30))[0]!, bright = bakeSearchSitePatches(normalWorld, base, paint(230))[0]!;
assert.notDeepEqual(dark.intact.albedo, bright.intact.albedo);
assert.deepEqual(dark.intact.normal, bright.intact.normal, 'Painted brightness must not manufacture normals');
assert.deepEqual(dark.intact.response, bright.intact.response, 'Painted brightness must not manufacture height');
const hiddenChange = { ...normalWorld, layout: { hiddenReward: 'entirely-different', value: 9999 } } as unknown as MasterWorld;
assert.equal(digest(bakeSearchSitePatches(hiddenChange, base)[0]!.intact), digest(bakeSearchSitePatches(normalWorld, base)[0]!.intact), 'Hidden rewards changed the material');
assert.equal(bakeSearchSitePatches({ ...normalWorld, algorithmRevision: 8 }, base).length, 0, 'Old revisions must keep their original presentation');

const closeA = { ...makeSite('gel-flow'), position: { x: 95, y: 70 } };
const closeB = { ...makeSite('broken-shell'), nodeId: 'node-b', position: { x: 174, y: 125 } };
const close = bakeSearchSitePatches(makeWorld([closeA, closeB]), base);
const overlaps = (a: SearchSiteMaterialPatch, b: SearchSiteMaterialPatch): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const separate = [closeA, closeB].map(site => bakeSearchSitePatches(makeWorld([site]), base)[0]!);
assert.ok(Math.hypot(closeA.position.x - closeB.position.x, closeA.position.y - closeB.position.y) >= 96, 'Fixture violates the legal node spacing');
assert.equal(overlaps(separate[0]!, separate[1]!), true, 'Fixture must exercise overlapping 80×64 upload windows');
assert.equal(overlaps(close[0]!, close[1]!), false, 'State upload rectangles can overwrite each other');
assert.ok(close.some((patch, i) => patch.width < separate[i]!.width || patch.height < separate[i]!.height), 'Overlapping transport windows were not trimmed');
for (const [index, site] of [closeA, closeB].entries()) {
  const cropped = close[index]!, original = separate[index]!;
  // A 40×40 box contains the rotated 34×26 core. Trimming may shorten the
  // peripheral transport window, never the core or either state's core pixels.
  assert.ok(cropped.x <= site.position.x - 20 && cropped.x + cropped.width >= site.position.x + 20);
  assert.ok(cropped.y <= site.position.y - 20 && cropped.y + cropped.height >= site.position.y + 20);
  for (let y = site.position.y - 20; y < site.position.y + 20; y++) for (let x = site.position.x - 20; x < site.position.x + 20; x++) {
    const a = ((y - cropped.y) * cropped.width + x - cropped.x) * 4;
    const b = ((y - original.y) * original.width + x - original.x) * 4;
    for (const state of ['intact', 'searched'] as const) for (const channel of channels) {
      assert.deepEqual(cropped[state][channel].subarray(a, a + 4), original[state][channel].subarray(b, b + 4), 'Neighbour trimming altered core material');
    }
  }
}
assert.throws(() => bakeSearchSitePatches(makeWorld([closeA, { ...closeA, nodeId: 'node-b' }]), base), /overlap/);
assert.throws(() => bakeSearchSitePatches(makeWorld([closeA, closeA]), base), /Duplicate/);

// Parent provenance must affect the local construction, not be frozen and then
// ignored. These do not claim to test whether the parent itself is legitimate.
const detached = { ...makeSite('folded-slab'), sourceKind: 'detached' as const, sourceDomain: 'formation' as const,
  sourceObjectId: 12, sourceAnchor: { x: 90, y: 80 } };
const opposite = { ...detached, sourceAnchor: { x: 166, y: 112 } };
assert.notEqual(digest(bakeSearchSitePatches(makeWorld([detached]), base)[0]!.intact), digest(bakeSearchSitePatches(makeWorld([opposite]), base)[0]!.intact));
console.log(JSON.stringify({ passed: true, cases, variants, contracts: ['determinism', 'receiver-readonly', 'disjoint-upload-windows',
  'void-and-solid-clipping', 'real-height-normals', 'searched-relief', 'peripheral-exposure', 'reward-independent', 'legacy-isolation', 'parent-direction'] }));
