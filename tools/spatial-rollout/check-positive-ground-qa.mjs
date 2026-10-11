/** Independent, small QA fixtures. No production map or browser generation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateNativeTerrainOutline } from '../../src/generation/world-study/native-volume-erosion.ts';
import { buildMasterSurfaceFields } from '../../src/systems/r100-world/surface-fields.ts';
import { paintMasterGround } from '../../src/systems/r100-world/ground.ts';
import { bakeMasterSurface, masterVolumePalette } from '../../src/systems/r100-world/surface-bake.ts';
import { NativeVolumeLighting } from '../../src/generation/world-study/native-volume-raster.ts';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds.ts';

const output = process.env.QA_REPORT;
assert(output, 'QA_REPORT must identify new evidence');
assert(!fs.existsSync(output), 'Do not overwrite QA evidence');
const sourcePaths = [
  'src/generation/world-study/native-volume-erosion.ts',
  'src/generation/world-study/master-ground-field.ts',
  'src/systems/r100-world/surface-fields.ts',
  'src/systems/r100-world/ground.ts',
  'src/systems/r100-world/surface-bake.ts',
  'src/generation/world-study/native-volume-raster.ts',
  'src/generated/r100-native-worlds.ts',
  'tools/spatial-rollout/check-positive-ground-qa.mjs',
];
const hashes = () => Object.fromEntries(sourcePaths.map(p => [p, createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceHashes = hashes();
const report = { status: 'running', startedAt: new Date().toISOString(),
  scope: 'Small independent geometry counterexamples and ground/edge-field fixtures. Not full production generation, runtime performance, browser pixels or visual quality.',
  sourceHashes, cases: [], failures: [] };
const save = () => { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); };
const check = (name, fn) => {
  try { report.cases.push({ name, status: 'passed', details: fn() }); }
  catch (error) { report.failures.push({ name, error: String(error.stack ?? error) }); }
  save();
};
const points = rows => rows.map(([x, y]) => ({ x, y }));
// Independent winding-number membership, rather than copying production's
// even/odd ray algorithm. The fixtures avoid sampling exact boundary vertices.
function within(ring, x, y) {
  let winding = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const cross = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
    if (a.y <= y && b.y > y && cross > 0) winding++;
    else if (a.y > y && b.y <= y && cross < 0) winding--;
  }
  return winding !== 0;
}
const concave = points([[0, 0], [100, 0], [100, 100], [70, 100], [70, 30], [30, 30], [30, 100], [0, 100]]);
const enclosed = points([[8, 40], [20, 40], [20, 56], [8, 56]]);
const bridge = points([[16, 50], [84, 50], [84, 65], [16, 65]]);
check('concave ring and strictly enclosed hole accept either winding', () => {
  validateNativeTerrainOutline(concave, 100, 100, [enclosed]);
  validateNativeTerrainOutline([...concave].reverse(), 100, 100, [[...enclosed].reverse()]);
});
check('hole vertices inside but edges cross concave exterior must reject', () => {
  assert(bridge.every(p => within(concave, p.x, p.y)));
  assert(!within(concave, 50, 50), 'Bridge crosses the exterior notch');
  assert.throws(() => validateNativeTerrainOutline(concave, 100, 100, [bridge]), /cross|touch/);
});
check('internal hole touching concave coast must reject', () => {
  assert.throws(() => validateNativeTerrainOutline(concave, 100, 100,
    [points([[18, 40], [30, 40], [30, 56], [18, 56]])]), /inside|cross|touch/);
});

check('ground alpha and edge fields follow independent 8px support, including partial 32px cells', () => {
  const width = 320, height = 320, size = width * height;
  const outline = points([[12, 20], [272, 12], [304, 108], [240, 300], [20, 264]]);
  const hole = points([[128, 112], [176, 112], [176, 168], [128, 168]]);
  validateNativeTerrainOutline(outline, width, height, [hole]);
  const matterAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const xx = Math.floor(x / 8) * 8 + 4, yy = Math.floor(y / 8) * 8 + 4;
    return within(outline, xx, yy) && !within(hole, xx, yy);
  };
  const sourceWorld = R100_NATIVE_WORLDS.find(w => w.id === 'cinder-ridge');
  const source = sourceWorld.definitions.find(d => d.grade === 'low');
  const definition = { ...source, cols: 10, rows: 10, seed: 71011,
    instances: [], erosion: [hole], terrainOutline: outline };
  // Deliberately bare ground isolates edge-field ownership from solid/material
  // fractures. It is a test fixture, not a valid production content recipe.
  const raster = { width, height, matter: new Uint8Array(size), objectId: new Uint16Array(size),
    material: new Uint8Array(size), normals: new Float32Array(size * 3), occupiedPixels: new Uint32Array() };
  const land = new Uint8Array(100);
  for (let y = 4; y < height; y += 8) for (let x = 4; x < width; x += 8)
    if (matterAt(x, y)) land[Math.floor(y / 32) * 10 + Math.floor(x / 32)] = 1;
  const world = { definition, raster, matterAt,
    sample: { cols: 10, rows: 10, tileSize: 32, seed: 71011, land, profile: sourceWorld.profile } };
  const ground = paintMasterGround(world), fields = buildMasterSurfaceFields(world);
  // Match the normal bakeMasterWorldSurface call: final albedo alpha is the
  // renderer's support mask. ground.rgba is a black-backed preview, not this mask.
  const volume = new NativeVolumeLighting(raster, masterVolumePalette(world),
    { seed: world.sample.seed, axis: definition.axis });
  const baked = bakeMasterSurface(world, ground, volume);
  const { terrainOutline: _outline, ...legacyDefinition } = definition;
  // Control deliberately holds the support function constant and removes only
  // the new exterior-ring field, to distinguish exterior and inner-hole color.
  const control = buildMasterSurfaceFields({ ...world, definition: legacyDefinition });
  let present = 0, absent = 0, partialCoarsePresent = 0, exteriorEdgePixels = 0, internalEdgePixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, supported = matterAt(x, y);
    assert.equal(ground.albedo[i * 4 + 3], supported ? 255 : 0, `Ground albedo alpha at ${x}/${y}`);
    assert.equal(baked.albedo[i * 4 + 3], supported ? 255 : 0, `Final surface alpha at ${x}/${y}`);
    if (!supported) { absent++; assert.equal(fields.erosion[i], 0); continue; }
    present++;
    assert.equal(land[Math.floor(y / 32) * 10 + Math.floor(x / 32)], 1);
    if (!matterAt(Math.floor(x / 32) * 32 + 16, Math.floor(y / 32) * 32 + 16)) partialCoarsePresent++;
    if (fields.erosion[i] > 0 && control.erosion[i] === 0) exteriorEdgePixels++;
    if (control.erosion[i] > 0) { internalEdgePixels++; assert.equal(fields.erosion[i], control.erosion[i]); }
  }
  assert(present > 0 && absent > 0 && partialCoarsePresent > 0);
  assert(exteriorEdgePixels > 0 && internalEdgePixels > 0);
  return { fixtureSize: [width, height], present, absent, partialCoarsePresent,
    exteriorEdgePixels, internalEdgePixels, productionAdmission: false };
});

const after = hashes();
report.changedSourcesDuringRun = sourcePaths.filter(p => after[p] !== sourceHashes[p]);
if (report.changedSourcesDuringRun.length) report.failures.push({ error: 'Sources changed during checks' });
report.status = report.failures.length ? 'failed' : 'passed';
report.finishedAt = new Date().toISOString(); save();
console.log(`${report.status.toUpperCase()}: ${report.cases.length} small QA checks; ${report.failures.length} failures`);
if (report.failures.length) process.exitCode = 1;
