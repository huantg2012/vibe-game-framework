// Read-only contract checks: never refresh approved artifacts or their hashes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { generateRectilinearFragment, fragmentContoursToWorld, RECTILINEAR_FRAGMENT_VERSION, FragmentShapeError } from '../../src/generation/world-study/fragment-shape/index.ts';
import { validateFragmentContours } from '../../src/generation/world-study/fragment-shape/validation.ts';
import { generateEdgeStudy, PREVIEW_SEEDS } from '../../docs/art/previews/world-fragment-open-field/edge-treatment.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const preview = path.join(root, 'docs/art/previews/world-fragment-open-field');
const accepted = JSON.parse(fs.readFileSync(path.join(directory, 'accepted-v1.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(preview, name));
const geometryBytes = read('geometry.json');
const geometry = JSON.parse(geometryBytes);
assert.equal(sha(geometryBytes), accepted.geometrySha256, 'Approved layout changed');
assert.equal(sha(read('edge-samples.json')), accepted.edgeSamplesSha256, 'Approved edge samples changed');
assert.deepEqual(PREVIEW_SEEDS, accepted.samples.map(s => s.seed));
const request = (layout, edgeSeed = 7) => ({algorithmVersion: RECTILINEAR_FRAGMENT_VERSION, layout, edgeSeed});
const generated = [];
for (let i = 0; i < accepted.samples.length; i++) {
  const sample = accepted.samples[i];
  const basename = i === 0 ? 'polished' : `polished-${sample.seed}`;
  const png = read(`${basename}.png`);
  assert.equal(sha(png), sample.pngSha256, 'Approved PNG changed');
  assert.equal(sha(read(`${basename}.svg`)), sample.svgSha256, 'Approved SVG changed');
  const input = structuredClone(geometry);
  const before = JSON.stringify(input);
  const result = generateRectilinearFragment(request(input, sample.seed));
  const repeated = generateRectilinearFragment(request(input, sample.seed));
  assert.deepEqual(result, repeated, 'Generation is not deterministic');
  assert.equal(JSON.stringify(input), before, 'Source layout was mutated');
  assert.equal(result.algorithmVersion, accepted.algorithmVersion);
  assert.equal(result.worldScale, 2);
  const {algorithmVersion, worldScale, ...study} = result;
  assert.equal(sha(JSON.stringify(study)), sample.studySha256, 'Accepted full study changed');
  assert.equal(sha(JSON.stringify(study.contours)), sample.contoursSha256, 'Accepted contours changed');
  assert.equal(sha(study.pathD), sample.pathSha256, 'Accepted path changed');
  assert.deepEqual(generateEdgeStudy(input, sample.seed), study, 'Preview is not using the shared implementation');
  const world = fragmentContoursToWorld(result);
  assert.deepEqual(world, study.contours.map(loop => loop.map(([x, y]) => [x * 2, y * 2])), 'World conversion is not exactly once');
  const [w, h] = geometry.authoringFrame;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="black"/><path fill="white" fill-rule="evenodd" d="${study.pathD}"/></svg>`;
  const actualPixels = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  const acceptedPixels = await sharp(png).ensureAlpha().raw().toBuffer();
  assert.deepEqual(actualPixels, acceptedPixels, 'Shared implementation changed accepted pixels');
  generated.push({seed: sample.seed, exactStudy: true, exactContours: true, exactPath: true, exactRgbaPixels: true, immutableInput: true});
}

let rejected = 0;
function rejects(input, code) {
  assert.throws(() => generateRectilinearFragment(input), error => error instanceof FragmentShapeError && error.code === code);
  rejected++;
}
const layout = {authoringFrame: [512, 512], worldScale: 2, landRects: [[30, 30, 450, 450]], voidRects: []};
rejects(null, 'INVALID_INPUT');
rejects({...request(layout), algorithmVersion: 'unregistered-v2'}, 'UNSUPPORTED_VERSION');
for (const seed of [-1, 2 ** 32, NaN, Infinity, 1.5]) rejects(request(layout, seed), 'INVALID_INPUT');
for (const bad of [null, {...layout, worldScale: 1}, {...layout, authoringFrame: [NaN, 512]}, {...layout, authoringFrame: Array(2)}, {...layout, landRects: [Array(4)]}, {...layout, landRects: []}, {...layout, landRects: [[1, 1, -3, 30]]}, {...layout, landRects: [[500, 20, 30, 30]]}, {...layout, voidRects: [[1, 1, Infinity, 20]]}]) rejects(request(bad), 'INVALID_INPUT');
rejects(request({...layout, authoringFrame: [20000, 512]}), 'BUDGET_EXCEEDED');
rejects(request({...layout, landRects: Array.from({length: 129}, () => [30, 30, 40, 40])}), 'BUDGET_EXCEEDED');
rejects(request({...layout, voidRects: [[0, 0, 512, 512]]}), 'UNSUPPORTED_TOPOLOGY');
rejects(request({...layout, landRects: [[30, 30, 100, 100], [230, 230, 100, 100]]}), 'UNSUPPORTED_TOPOLOGY');
rejects(request({...layout, landRects: [[30, 30, 100, 100], [130, 130, 100, 100]]}), 'UNSUPPORTED_TOPOLOGY');

// Topology is not hardcoded to the accepted map's hole count or shape.
const fixtureReports = [];
for (const voidRects of [[], [[130, 130, 50, 50]], [[130, 130, 50, 50], [300, 280, 80, 60]]]) {
  for (const seed of [0, 7, 42, 0xffffffff]) {
    const result = generateRectilinearFragment(request({...layout, voidRects}, seed));
    assert.equal(result.stats.outerContours, 1);
    assert.equal(result.stats.holeContours, voidRects.length);
  }
  fixtureReports.push({holes: voidRects.length, seeds: 4});
}
for (const contours of [
  [[[0, 0], [80, 80], [0, 80], [80, 0]]],
  [[[0, 0], [100, 0], [100, 100], [0, 100]], [[0, 20], [0, 40], [20, 40], [20, 20]]],
]) {
  assert.throws(() => validateFragmentContours(contours, 'output'), error => error instanceof FragmentShapeError && error.code === 'INVALID_OUTPUT');
  rejected++;
}
const report = {
  scope: 'Pre-integration pure fragment compiler; no production, raster-grid, body, LOS or gameplay admission.',
  algorithmVersion: RECTILINEAR_FRAGMENT_VERSION,
  acceptedRevision: accepted.acceptedRevision,
  approvedArtifactsUntouched: true,
  golden: generated,
  rejectionCases: rejected,
  additionalLayouts: fixtureReports,
  limitations: ['v1 requires one land component; authoring units are fixed at two world pixels.', 'Caller must validate chosen terrain grid, body clearance, hole identity in that grid, LOS, placement and traversal.', 'This does not generate macro-layouts or enable any production map.'],
};
console.log(JSON.stringify(report, null, 2));
if (process.argv[2]) fs.writeFileSync(path.resolve(root, process.argv[2]), `${JSON.stringify(report, null, 2)}\n`);
