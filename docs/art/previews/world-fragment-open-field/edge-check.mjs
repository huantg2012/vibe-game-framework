// Independent checks for corner treatment studies. This is not production-map admission.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const geometryBytes = fs.readFileSync(path.join(dir, 'geometry.json'));
const geometry = JSON.parse(geometryBytes);
const baselineBytes = fs.readFileSync(path.join(dir, 'silhouette.png'));
const scale = geometry.worldScale;
const [w, h] = geometry.authoringFrame;
const n = w * h;
const ratio = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(8)) : 0;
const total = mask => mask.reduce((a, b) => a + b, 0);
const violations = [];

async function raster(bytes) {
  const { data, info } = await sharp(bytes).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== w || info.height !== h || info.channels !== 1) throw new Error('Unexpected raster dimensions.');
  return Uint8Array.from(data, v => Number(v === 255));
}

function connected(mask) {
  const labels = new Int32Array(n), queue = new Int32Array(n), components = [];
  for (let initial = 0; initial < n; initial++) {
    if (!mask[initial] || labels[initial]) continue;
    const id = components.length + 1;
    let head = 0, tail = 1, touchesFrame = false;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    labels[initial] = id; queue[0] = initial;
    while (head < tail) {
      const p = queue[head++], x = p % w, y = Math.floor(p / w);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (!x || !y || x === w - 1 || y === h - 1) touchesFrame = true;
      const visit = q => { if (mask[q] && !labels[q]) { labels[q] = id; queue[tail++] = q; } };
      if (x) visit(p - 1); if (x + 1 < w) visit(p + 1); if (y) visit(p - w); if (y + 1 < h) visit(p + w);
    }
    components.push({ id, areaPixels: tail, touchesFrame, boundsAuthoring: [minX, minY, maxX, maxY] });
  }
  components.sort((a, b) => b.areaPixels - a.areaPixels);
  return { labels, components };
}

function bodyCenters(mask) {
  const r = Math.ceil(geometry.body / scale / 2), side = r * 2 + 1, stride = w + 1;
  const integral = new Uint32Array((w + 1) * (h + 1)), result = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += mask[y * w + x]; integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row; }
  }
  for (let y = r; y < h - r; y++) for (let x = r; x < w - r; x++) {
    const left = x - r, right = x + r + 1, top = y - r, bottom = y + r + 1;
    const area = integral[bottom * stride + right] - integral[top * stride + right] - integral[bottom * stride + left] + integral[top * stride + left];
    result[y * w + x] = Number(area === side * side);
  }
  return result;
}

function boundaries(mask) {
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, v = mask[p];
    out[p] = Number((x > 0 && mask[p - 1] !== v) || (x + 1 < w && mask[p + 1] !== v) || (y > 0 && mask[p - w] !== v) || (y + 1 < h && mask[p + w] !== v));
  }
  return out;
}

function transformLine(input) {
  const length = input.length, vertices = new Int32Array(length), breaks = new Float64Array(length + 1), result = new Float64Array(length);
  let k = 0; vertices[0] = 0; breaks[0] = -Infinity; breaks[1] = Infinity;
  for (let q = 1; q < length; q++) {
    let s;
    do {
      const v = vertices[k]; s = ((input[q] + q * q) - (input[v] + v * v)) / (2 * (q - v));
      if (s <= breaks[k]) k--; else break;
    } while (k >= 0);
    k++; vertices[k] = q; breaks[k] = s; breaks[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < length; q++) { while (breaks[k + 1] < q) k++; result[q] = (q - vertices[k]) ** 2 + input[vertices[k]]; }
  return result;
}

function squaredDistanceTo(seeds) {
  const far = (w + h) ** 2, temp = new Float64Array(n), out = new Float64Array(n);
  for (let x = 0; x < w; x++) {
    const line = transformLine(Float64Array.from({ length: h }, (_, y) => seeds[y * w + x] ? 0 : far));
    for (let y = 0; y < h; y++) temp[y * w + x] = line[y];
  }
  for (let y = 0; y < h; y++) out.set(transformLine(temp.subarray(y * w, (y + 1) * w)), y * w);
  return out;
}

function distanceStats(selection, distanceSquared) {
  const values = [];
  for (let i = 0; i < n; i++) if (selection[i]) values.push(Math.sqrt(distanceSquared[i]) * scale);
  values.sort((a, b) => a - b);
  const pick = q => values.length ? Number(values[Math.ceil((values.length - 1) * q)].toFixed(4)) : 0;
  return { samplePixels: values.length, p50World: pick(0.5), p95World: pick(0.95), maxWorld: pick(1) };
}

// Count contiguous axis-aligned raster boundary-edge runs, retaining both vertical and horizontal edges.
function straightRuns(mask) {
  const lengths = [];
  const scan = (length, isEdge) => {
    let run = 0;
    for (let position = 0; position <= length; position++) {
      if (position < length && isEdge(position)) run++;
      else if (run) { lengths.push(run * scale); run = 0; }
    }
  };
  for (let y = 1; y < h; y++) scan(w, x => mask[y * w + x] !== mask[(y - 1) * w + x]);
  for (let x = 1; x < w; x++) scan(h, y => mask[y * w + x] !== mask[y * w + x - 1]);
  const totalLength = lengths.reduce((a, b) => a + b, 0);
  return {
    totalBoundaryLengthWorld: totalLength,
    runCount: lengths.length, longestWorld: Math.max(0, ...lengths),
    thresholds: [64, 128, 256].map(minimumWorld => {
      const selected = lengths.filter(length => length >= minimumWorld), lengthWorld = selected.reduce((a, b) => a + b, 0);
      return { minimumWorld, count: selected.length, lengthWorld, fractionOfRasterBoundaryLength: ratio(lengthWorld, totalLength) };
    }),
  };
}

function topology(mask) {
  const land = connected(mask), black = connected(Uint8Array.from(mask, v => 1 - v));
  const bodyMask = bodyCenters(mask), body = connected(bodyMask), bodyCount = total(bodyMask);
  return {
    land, black, holes: black.components.filter(c => !c.touchesFrame),
    report: {
      groundPixels: total(mask), landComponentCount: land.components.length, landComponents: land.components,
      enclosedHoleCount: black.components.filter(c => !c.touchesFrame).length,
      bodyCenterPixels: bodyCount, bodyComponentCount: body.components.length,
      bodyMainFraction: ratio(body.components[0]?.areaPixels ?? 0, bodyCount), bodyComponents: body.components,
    },
  };
}

function holeMapping(base, next) {
  const baseIds = new Set(base.holes.map(c => c.id)), nextIds = new Set(next.holes.map(c => c.id));
  const overlap = new Map();
  for (let i = 0; i < n; i++) {
    const a = base.black.labels[i], b = next.black.labels[i];
    if (baseIds.has(a) && nextIds.has(b)) { const key = `${a}:${b}`; overlap.set(key, (overlap.get(key) ?? 0) + 1); }
  }
  const pairs = base.holes.map(hole => {
    const hits = next.holes.map(other => ({ originalHoleId: hole.id, nextHoleId: other.id, overlapPixels: overlap.get(`${hole.id}:${other.id}`) ?? 0, originalPixels: hole.areaPixels, nextPixels: other.areaPixels })).filter(p => p.overlapPixels > 0).sort((a, b) => b.overlapPixels - a.overlapPixels);
    return { originalHoleId: hole.id, overlappingNextCount: hits.length, matches: hits };
  });
  const picked = pairs.map(p => p.matches[0]?.nextHoleId);
  const oneToOne = pairs.every(p => p.overlappingNextCount === 1) && picked.length === next.holes.length && new Set(picked).size === picked.length;
  return { oneToOne, pairs };
}

const baselineMask = await raster(baselineBytes);
const baseline = topology(baselineMask);
const baselineBoundary = boundaries(baselineMask);
const baselineBoundaryDistance = squaredDistanceTo(baselineBoundary);
const baselineRuns = straightRuns(baselineMask);

const treatmentBytes = fs.readFileSync(path.join(dir, 'edge-treatment.mjs'));
const { generateEdgeStudy, PREVIEW_SEEDS } = await import('./edge-treatment.mjs');
const variants = PREVIEW_SEEDS.map((seed, index) => ({ seed, file: index ? `polished-${seed}.png` : 'polished.png' }));
const variantReports = [];
const generatedGeometryHashes = [];
for (const variant of variants) {
  const bytes = fs.readFileSync(path.join(dir, variant.file));
  const mask = await raster(bytes), top = topology(mask), boundary = boundaries(mask);
  const input = structuredClone(geometry), inputBefore = JSON.stringify(input);
  const first = generateEdgeStudy(input, variant.seed);
  const repeated = generateEdgeStudy(structuredClone(geometry), variant.seed);
  const deterministic = JSON.stringify(first) === JSON.stringify(repeated);
  const sourceInputUnchanged = inputBefore === JSON.stringify(input);
  const generatedHash = sha(first.pathD);
  generatedGeometryHashes.push(generatedHash);
  if (!deterministic) violations.push(`${variant.seed}: repeated pure generation differs`);
  if (!sourceInputUnchanged) violations.push(`${variant.seed}: generator mutated source input`);
  const expectedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="black"/><path fill="white" fill-rule="evenodd" d="${first.pathD}"/></svg>`;
  const expectedMask = await raster(await sharp(Buffer.from(expectedSvg)).png().toBuffer());
  let expectedRasterMismatchPixels = 0;
  for (let i = 0; i < n; i++) if (expectedMask[i] !== mask[i]) expectedRasterMismatchPixels++;
  if (expectedRasterMismatchPixels) violations.push(`${variant.seed}: published PNG differs from generated contour mask`);
  const changeMask = new Uint8Array(n);
  let added = 0, removed = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i] === baselineMask[i]) continue;
    changeMask[i] = 1;
    if (mask[i]) added++; else removed++;
  }
  const mapping = holeMapping(baseline, top);
  if (top.report.landComponentCount !== baseline.report.landComponentCount) violations.push(`${variant.seed}: land component count changed`);
  if (top.report.bodyComponentCount !== 1) violations.push(`${variant.seed}: body centers are disconnected`);
  if (top.report.enclosedHoleCount !== baseline.report.enclosedHoleCount || !mapping.oneToOne) violations.push(`${variant.seed}: enclosed-hole identity changed`);
  variantReports.push({
    seed: variant.seed, file: variant.file, pngSha256: sha(bytes), topology: top.report,
    determinism: { repeatedGenerationEqual: deterministic, sourceInputUnchanged, generatedPathSha256: generatedHash, expectedRasterMismatchPixels },
    originalHoleMapping: mapping,
    changedArea: { addedPixels: added, removedPixels: removed, totalPixels: added + removed, fractionOfOriginalGround: ratio(added + removed, baseline.report.groundPixels), areaWorldSquared: (added + removed) * scale ** 2 },
    changedPixelsDistanceToOriginalBoundary: distanceStats(changeMask, baselineBoundaryDistance),
    polishedBoundaryDistanceToOriginal: distanceStats(boundary, baselineBoundaryDistance),
    originalBoundaryDistanceToPolished: distanceStats(baselineBoundary, squaredDistanceTo(boundary)),
    straightBoundaryRuns: straightRuns(mask),
  });
}

if (sha(fs.readFileSync(path.join(dir, 'geometry.json'))) !== sha(geometryBytes) || sha(fs.readFileSync(path.join(dir, 'silhouette.png'))) !== sha(baselineBytes)) throw new Error('Baseline changed during QA.');
if (sha(fs.readFileSync(path.join(dir, 'edge-treatment.mjs'))) !== sha(treatmentBytes)) throw new Error('Treatment source changed during QA; rerun.');
for (const variant of variantReports) if (sha(fs.readFileSync(path.join(dir, variant.file))) !== variant.pngSha256) throw new Error('Variant changed during QA; rerun.');
if (variants.length !== 3) throw new Error('Expected exactly three published corner-treatment variants.');
if (new Set(generatedGeometryHashes).size !== variants.length) violations.push('Representative seeds do not all produce distinct treated contours');
const report = {
  scope: 'Independent authored-silhouette corner-treatment diagnostics, not production gameplay or aesthetic acceptance.',
  source: { geometrySha256: sha(geometryBytes), baselinePngSha256: sha(baselineBytes), treatmentSha256: sha(treatmentBytes), authoringFrame: [w, h], worldUnitsPerRasterPixel: scale },
  methods: {
    raster: 'Only exactly white pixels count as ground; antialiased pixels conservatively count as void; all components use four-neighbor adjacency.',
    body: `${geometry.body} world-pixel square body, checked by a full ${Math.ceil(geometry.body / scale / 2) * 2 + 1}-pixel square window; conservative quantization margin included.`,
    holes: 'Non-frame-connected black components; same count AND one-to-one nonempty pixel-overlap correspondence with baseline required.',
    boundaryDistance: 'Euclidean distance between raster-pixel centers adjacent to a ground/void transition, expressed in world pixels. Raster cell extent adds up to a cell diagonal of uncertainty to a geometric-boundary interpretation.',
    straightRuns: 'Contiguous horizontal/vertical raster boundary-edge lengths; thresholds are diagnostics, not aesthetic gates.',
    determinism: 'Generate each published seed twice on cloned source geometry, compare the entire returned JSON, require source-input immutability, and compare published PNG against an independent SVG render of the returned evenodd contour path.',
  },
  baseline: { topology: baseline.report, straightBoundaryRuns: baselineRuns },
  variants: variantReports,
  violations,
  limitations: [
    'Only three authored corner-treatment seeds are checked. No production generator, CSV, 8 px production grid, movement integration or actual gameplay has been run.',
    'A connected body-center mask does not validate exit search, light propagation, camera framing, encounter balance or visual quality.',
    'Preserved hole topology, limited boundary changes and long straight edges do not prove that a map feels open or satisfies the world-fragment aesthetic.',
  ],
};
fs.writeFileSync(path.join(dir, 'edge-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ variants: variantReports.map(v => ({ seed: v.seed, groundComponents: v.topology.landComponentCount, bodyComponents: v.topology.bodyComponentCount, holes: v.topology.enclosedHoleCount, changedFraction: v.changedArea.fractionOfOriginalGround, maximumBoundaryDisplacementWorld: v.polishedBoundaryDistanceToOriginal.maxWorld })), violations }, null, 2));
if (violations.length) process.exitCode = 1;
