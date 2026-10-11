// Independent raster diagnostics for the authored study; never a production admission gate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const dir = path.dirname(fileURLToPath(import.meta.url));
const geometryBytes = fs.readFileSync(path.join(dir, 'geometry.json'));
const geometry = JSON.parse(geometryBytes);
for (const key of ['landRects', 'voidRects']) {
  if (!Array.isArray(geometry[key]) || !geometry[key].length) throw new Error(`Missing rectangle set: ${key}`);
  geometry[key].forEach((rect, index) => {
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) || rect[2] <= 0 || rect[3] <= 0) {
      throw new Error(`${key}[${index}] must be an axis-aligned [x,y,positiveWidth,positiveHeight] rectangle.`);
    }
  });
}
if ('outer' in geometry || 'voids' in geometry) throw new Error('Legacy arbitrary-polygon geometry is not permitted in this rectangle-only study.');
const pngBytes = fs.readFileSync(path.join(dir, 'silhouette.png'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const { data, info } = await sharp(pngBytes).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const count = w * h;
const scale = geometry.worldScale;
if (w !== geometry.authoringFrame[0] || h !== geometry.authoringFrame[1] || !Number.isFinite(scale) || scale <= 0) {
  throw new Error('Raster dimensions / world scale differ from the declared study frame.');
}
// All antialiased pixels are conservatively excluded from usable ground.
const ground = Uint8Array.from(data, value => Number(value === 255));
const sum = mask => mask.reduce((a, b) => a + b, 0);
const ratio = (a, b) => b ? Number((a / b).toFixed(8)) : 0;
const contains = (rect, x, y) => x >= rect[0] && y >= rect[1] && x < rect[0] + rect[2] && y < rect[1] + rect[3];
let rasterCenterMismatchCount = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const expected = geometry.landRects.some(r => contains(r, x + 0.5, y + 0.5)) && !geometry.voidRects.some(r => contains(r, x + 0.5, y + 0.5));
  if (Number(expected) !== ground[y * w + x]) rasterCenterMismatchCount++;
}
const rectanglesAreIntegerAligned = [...geometry.landRects, ...geometry.voidRects].every(rect => rect.every(Number.isInteger));
if (rectanglesAreIntegerAligned && rasterCenterMismatchCount) throw new Error('PNG does not match the declared integer-aligned rectangle union/subtraction. Rerender before checking.');

function components(mask) {
  const labels = new Int32Array(count);
  const queue = new Int32Array(count);
  const list = [];
  for (let start = 0; start < count; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = list.length + 1;
    let read = 0, write = 1;
    let minX = w, minY = h, maxX = 0, maxY = 0, touchesFrame = false;
    labels[start] = id;
    queue[0] = start;
    while (read < write) {
      const p = queue[read++], x = p % w, y = Math.floor(p / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesFrame = true;
      for (const next of [x > 0 ? p - 1 : -1, x + 1 < w ? p + 1 : -1, y > 0 ? p - w : -1, y + 1 < h ? p + w : -1]) {
        if (next >= 0 && mask[next] && !labels[next]) { labels[next] = id; queue[write++] = next; }
      }
    }
    list.push({ id, areaPixels: write, boundsAuthoring: [minX, minY, maxX, maxY], touchesFrame });
  }
  list.sort((a, b) => b.areaPixels - a.areaPixels);
  return { labels, list };
}

// Exact square erosion on the binary image, using summed-area rectangles.
function erodeSquare(mask, radius) {
  const stride = w + 1, integral = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += mask[y * w + x]; integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row; }
  }
  const result = new Uint8Array(count), side = radius * 2 + 1, wanted = side * side;
  for (let y = radius; y < h - radius; y++) for (let x = radius; x < w - radius; x++) {
    const left = x - radius, right = x + radius + 1, top = y - radius, bottom = y + radius + 1;
    const area = integral[bottom * stride + right] - integral[top * stride + right] - integral[bottom * stride + left] + integral[top * stride + left];
    result[y * w + x] = Number(area === wanted);
  }
  return result;
}

// Squared Euclidean distance transform; 1D lower envelopes in two passes.
function transformLine(input, n) {
  const vertices = new Int32Array(n), intersections = new Float64Array(n + 1), out = new Float64Array(n);
  let k = 0;
  vertices[0] = 0; intersections[0] = -Infinity; intersections[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    do {
      const v = vertices[k];
      s = ((input[q] + q * q) - (input[v] + v * v)) / (2 * (q - v));
      if (s <= intersections[k]) k--; else break;
    } while (k >= 0);
    k++; vertices[k] = q; intersections[k] = s; intersections[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (intersections[k + 1] < q) k++;
    out[q] = (q - vertices[k]) ** 2 + input[vertices[k]];
  }
  return out;
}
function clearanceSquared(mask) {
  const far = (w + h) ** 2, temp = new Float64Array(count), out = new Float64Array(count);
  for (let x = 0; x < w; x++) {
    const line = Float64Array.from({ length: h }, (_, y) => mask[y * w + x] ? far : 0);
    const transformed = transformLine(line, h);
    for (let y = 0; y < h; y++) temp[y * w + x] = transformed[y];
  }
  for (let y = 0; y < h; y++) out.set(transformLine(temp.subarray(y * w, (y + 1) * w), w), y * w);
  return out;
}

const groundPixels = sum(ground);
const floorComponents = components(ground);
const blackComponents = components(Uint8Array.from(ground, value => 1 - value));
const enclosedVoids = blackComponents.list.filter(c => !c.touchesFrame);
const bodyRadius = Math.ceil(geometry.body / scale / 2);
const bodyMask = erodeSquare(ground, bodyRadius);
const bodyComponents = components(bodyMask);
const bodyPixels = sum(bodyMask);
const distances = clearanceSquared(ground);
const clearanceDiagnostics = [112, 160, 224].map(radiusWorld => {
  // Subtract a raster cell half-diagonal, conservatively allowing for black cell extent.
  const radiusRaster = radiusWorld / scale + Math.SQRT1_2;
  const mask = Uint8Array.from(distances, distanceSquared => Number(distanceSquared > radiusRaster ** 2));
  const pixels = sum(mask), c = components(mask);
  return {
    radiusWorld, minimumOpenDiameterWorld: radiusWorld * 2,
    candidateCenterPixels: pixels, fractionOfOriginalGround: ratio(pixels, groundPixels),
    componentCount: c.list.length, largestComponentFractionOfRetainedCenters: ratio(c.list[0]?.areaPixels ?? 0, pixels),
    components: c.list,
  };
});

// Find three short horizontal spans with body-clear endpoints and an enclosed void between them.
// This only shows potential geometric occlusion; it does not call production visibility code.
const holeIds = new Set(enclosedVoids.map(c => c.id));
const witnesses = [];
const candidates = [];
for (let y = bodyRadius + 1; y < h - bodyRadius - 1; y += 3) {
  for (let x = bodyRadius + 1; x < w - bodyRadius - 1; x++) {
    if (ground[y * w + x] || !holeIds.has(blackComponents.labels[y * w + x])) continue;
    const start = x, id = blackComponents.labels[y * w + x];
    while (x < w && !ground[y * w + x]) x++;
    const end = x - 1;
    let left = start - 1, right = end + 1;
    while (left >= start - 20 && left >= 0 && !bodyMask[y * w + left]) left--;
    while (right <= end + 20 && right < w && !bodyMask[y * w + right]) right++;
    if (left < 0 || right >= w || !bodyMask[y * w + left] || !bodyMask[y * w + right]) continue;
    const distanceWorld = (right - left) * scale;
    if (distanceWorld > 208 || (end - start + 1) * scale < 32) continue;
    if (bodyComponents.labels[y * w + left] !== bodyComponents.labels[y * w + right]) continue;
    candidates.push({ id, y, left, right, midX: (left + right) / 2, distanceWorld, voidSpanWorld: (end - start + 1) * scale });
  }
}
candidates.sort((a, b) => b.voidSpanWorld - a.voidSpanWorld || a.y - b.y);
for (const c of candidates) {
  if (witnesses.some(v => v.enclosedVoidId === c.id || Math.hypot(v.midpointAuthoring[0] - c.midX, v.midpointAuthoring[1] - c.y) < 100)) continue;
  witnesses.push({
    enclosedVoidId: c.id,
    fromAuthoring: [c.left + 0.5, c.y + 0.5], toAuthoring: [c.right + 0.5, c.y + 0.5],
    fromWorld: [(c.left + 0.5) * scale, (c.y + 0.5) * scale], toWorld: [(c.right + 0.5) * scale, (c.y + 0.5) * scale],
    midpointAuthoring: [c.midX + 0.5, c.y + 0.5],
    straightDistanceWorld: c.distanceWorld, blackSpanWorld: c.voidSpanWorld,
    sameBodyClearComponent: true, productionLosChecked: false,
  });
  if (witnesses.length === 3) break;
}

if (hash(fs.readFileSync(path.join(dir, 'geometry.json'))) !== hash(geometryBytes) || hash(fs.readFileSync(path.join(dir, 'silhouette.png'))) !== hash(pngBytes)) {
  throw new Error('Source changed during check; rerun against the final render.');
}
const report = {
  scope: 'Authored rectangle-union silhouette raster diagnostics only; no production gameplay acceptance.',
  featureIds: ['COH-F052', 'COH-F007', 'COH-F011'],
  inputs: { geometrySha256: hash(geometryBytes), silhouettePngSha256: hash(pngBytes), rasterSize: [w, h], worldFrame: geometry.frame, worldUnitsPerRasterPixel: scale },
  rectangleGeometry: {
    operation: 'union(landRects) minus union(voidRects)',
    encoding: 'Every rectangle is [x,y,width,height], with finite coordinates and strictly positive width/height; no rotations or arbitrary polygons.',
    landRectangleCount: geometry.landRects.length, voidRectangleCount: geometry.voidRects.length,
    allRectanglesValidAxisAligned: true, rectanglesAreIntegerAligned, rasterCenterMismatchCount,
    note: 'Rectangle count is an authoring primitive count. Overlapping void rectangles form unions and voids touching the exterior are not enclosed holes.',
  },
  method: {
    ground: 'Only exactly white pixels count as ground; antialiased border pixels count as void. Four-neighbor connectivity throughout.',
    body: `${geometry.body} world-pixel square body; conservative ${bodyRadius * 2 + 1}×${bodyRadius * 2 + 1} full raster-cell square window at each candidate center. This includes up to one extra raster pixel of quantization margin.`,
    clearance: 'Euclidean distance to nearest black pixel center, minus a half-cell diagonal. Erosion gives admissible large-disk centers, not traversable area after dilation and not production visibility.',
    thresholds: '112, 160 and 224 world-pixel radii are diagnostic probes only. No pass/fail aesthetic threshold or required hole count.',
  },
  topology: { originalGroundPixels: groundPixels, groundAreaWorldSquared: groundPixels * scale ** 2, groundComponentCount: floorComponents.list.length, groundComponents: floorComponents.list, enclosedVoidCount: enclosedVoids.length, enclosedVoidPixels: enclosedVoids.reduce((a, c) => a + c.areaPixels, 0), enclosedVoids },
  body: {
    sideWorld: geometry.body, retainedCenterPixels: bodyPixels,
    retainedCenterFractionOfOriginalGround: ratio(bodyPixels, groundPixels),
    componentCount: bodyComponents.list.length,
    mainComponentFractionOfBodyClearCenters: ratio(bodyComponents.list[0]?.areaPixels ?? 0, bodyPixels),
    mainComponentCenterFractionOfOriginalGround: ratio(bodyComponents.list[0]?.areaPixels ?? 0, groundPixels),
    components: bodyComponents.list,
  },
  clearanceDiagnostics,
  shortAcrossVoidWitnesses: witnesses,
  limitations: [
    'Only this authored raster is covered. No seeded generation, CSV source, 8 px production grid, physics integration, spawn/extraction placement, or actual walk has been tested.',
    'The body test is a conservative raster-center connectivity test. Its percentages concern valid centers, not the percentage of all surface points a real player can visit.',
    'Clearance erosion is an openness diagnostic and can split an open field; component counts do not prove or disprove a dungeon reading.',
    'Across-void samples are geometry witnesses only. Actual directional light, range falloff, chaos, visibility grid and remembered fog are not simulated.',
    'Aesthetic quality, world-fragment identity, natural search difficulty, and human acceptance remain unverified.',
  ],
};
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ groundComponents: report.topology.groundComponentCount, enclosedVoids: report.topology.enclosedVoidCount, bodyComponents: report.body.componentCount, bodyMainFraction: report.body.mainComponentFractionOfBodyClearCenters, clearance: clearanceDiagnostics.map(c => ({ radiusWorld: c.radiusWorld, components: c.componentCount, groundFraction: c.fractionOfOriginalGround })), witnesses: witnesses.length }, null, 2));
