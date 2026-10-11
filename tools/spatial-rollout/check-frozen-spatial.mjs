/** Replay the actual pre-correction r7 departures, not recipes made by today's CSV. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity.ts';
const source = process.env.QA_RECIPES ?? 'docs/qa/artifacts/r100-spatial-void-2026-10-11/old-recipes.json';
const output = process.env.QA_REPORT;
assert(output, 'QA_REPORT is required');
assert(!fs.existsSync(output), 'Do not overwrite historical evidence');
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'running', source, sourceHash: hash(fs.readFileSync(source)),
  scope: 'Actual historical r7 recipes replayed after data correction: original geometry fingerprint, spawn and extraction; current full layout/native hashes available for exact before/after comparison. Not browser cold recovery.', cases: [] };
for (const item of JSON.parse(fs.readFileSync(source, 'utf8'))) {
  assert(validR100ProductionRecipe(item.recipe), `Rejected historical recipe ${item.world}`);
  const world = createR100ProductionMap(item.recipe);
  assert.equal(world.native.diagnostics.geometryFingerprint, item.geometry);
  assert.deepEqual(world.layout.spawnPoint, item.spawn);
  assert.deepEqual(world.layout.extractionPoint.position, item.extraction);
  const raster = world.native.raster;
  const h = createHash('sha256');
  for (const key of Object.keys(raster).sort()) {
    const value = raster[key];
    if (ArrayBuffer.isView(value)) h.update(key).update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  report.cases.push({ world: item.world, geometry: item.geometry,
    layoutHash: hash(JSON.stringify(world.layout)), rasterHash: h.digest('hex'),
    identity: generatedRiftIdentity(world.layout, item.recipe, world).signature });
  console.log(`PASS frozen ${item.world}`);
}
if (process.env.QA_COMPARE) {
  const previous = JSON.parse(fs.readFileSync(process.env.QA_COMPARE, 'utf8'));
  assert.deepEqual(report.cases, previous.cases, 'Historical departures changed after CSV correction');
  report.comparedWith = process.env.QA_COMPARE;
}
report.status = 'passed';
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
