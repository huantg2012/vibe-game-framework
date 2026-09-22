import assert from 'node:assert/strict';
import { ChamberSurfaceMap, type SurfacePlane } from '../../src/art/chamber-surface-map';

let checks = 0;
function expect(value: unknown, message: string): void { assert(value, message); checks++; }
function near(actual: number, expected: number, message: string, tolerance = 1e-5): void {
  expect(Math.abs(actual - expected) < tolerance, `${message}: got ${actual}, expected ${expected}`);
}

const map = new ChamberSurfaceMap();
const width = map.width; const height = map.height;
const count = width * height;
const top: SurfacePlane = { normal: [0, 0, 1], elevation: 0 };
function index(x: number, y: number): number { return y * width + x; }
function plane(surface: SurfacePlane, x: number, y: number, w = 1, h = 1): void {
  map.setPlane(surface); map.stamp(x, y, w, h);
}

/** Minimal Canvas boundary: the production algorithm must read and write once.
 * This intentionally implements no drawing or lighting logic of its own. */
function canvas(pixels: Uint8ClampedArray, canvasWidth = width, canvasHeight = height): {
  ctx: CanvasRenderingContext2D; reads: number; writes: number;
} {
  const probe = {
    reads: 0, writes: 0,
    ctx: {
      canvas: { width: canvasWidth, height: canvasHeight },
      getImageData(x: number, y: number, w: number, h: number): ImageData {
        assert.deepEqual([x, y, w, h], [0, 0, width, height]);
        probe.reads++;
        return { data: pixels, width, height, colorSpace: 'srgb' } as ImageData;
      },
      putImageData(image: ImageData, x: number, y: number): void {
        assert.equal(image.data, pixels); assert.deepEqual([x, y], [0, 0]);
        probe.writes++;
      },
    } as CanvasRenderingContext2D,
  };
  return probe;
}
function paint(pixels: Uint8ClampedArray, x: number, y: number, rgba: readonly number[]): void {
  pixels.set(rgba, index(x, y) * 4);
}
function rgba(pixels: Uint8ClampedArray, x: number, y: number): number[] {
  return [...pixels.slice(index(x, y) * 4, index(x, y) * 4 + 4)];
}

expect(width === 640 && height === 400 && map.coverage.length === count, 'Cache uses the fixed chamber resolution');
expect(map.heights instanceof Float32Array && map.normalX instanceof Float32Array,
  'Height and normals retain fractional values');
plane({ normal: [0, 0, 4], elevation: 32, occlusion: .8, roughness: .7 }, 3, 4);
near(map.normalZ[index(3, 4)]!, 1, 'Authored normals are normalized');
near(map.heights[index(3, 4)]!, 32, 'Upper height is stored');
near(map.occlusion[index(3, 4)]!, .8, 'Visibility is stored without reversing its meaning');
near(map.roughness[index(3, 4)]!, .7, 'Material roughness is stored');
const previous = map.getPlane();
map.setPlane(null); map.stamp(3, 4, 1, 1);
near(map.heights[index(3, 4)]!, 32, 'Unlabelled wear inherits the host surface');
expect(map.getPlane() === null, 'The authoring plane can be suspended for details');
map.setPlane(previous);
expect(map.getPlane() === previous, 'A nested painter can restore its authoring plane');

map.clear();
expect(map.coverage.every(value => value === 0) && map.heights.every(value => value === 0), 'Clear removes all previous geometry');
expect(map.normalX.every(value => value === 0) && map.normalZ.every(value => value === 0), 'Clear removes old normals');
expect(map.occlusion.every(value => value === 1) && map.roughness.every(value => value === 1)
  && map.getPlane() === null, 'Clear restores visibility/material defaults and unsets authoring');
plane(top, -2, -2, 4, 4);
expect(map.coverage.reduce((sum, value) => sum + value, 0) === 4, 'Negative origins clip without wrapping to another row');
plane(top, 640, 400, -2, -2);
expect(map.coverage[index(639, 399)] === 1 && map.coverage[index(638, 398)] === 1,
  'Negative rectangle extents agree with Canvas fillRect');
plane(top, 8.6, 9.4, 1.4, 1.4);
expect(map.coverage[index(9, 9)] === 1 && map.coverage[index(8, 9)] === 0, 'Stamp uses the painter integer rounding');
const beforeInvalid = map.coverage.slice();
map.stamp(NaN, 0, 10, 10); map.stamp(0, Infinity, 10, 10); map.stamp(0, 0, 0, 10);
expect(map.coverage.every((value, i) => value === beforeInvalid[i]), 'Invalid/empty stamps leave the cache unchanged');
for (const invalid of [
  { normal: [0, 0, 0], elevation: 0 },
  { normal: [0, NaN, 1], elevation: 0 },
  { normal: [0, 0, 1], elevation: Infinity },
  { normal: [0, 0, 1], elevation: 0, riseY: NaN },
  { normal: [0, 0, 1], elevation: 1e100 },
] as SurfacePlane[]) {
  assert.throws(() => map.setPlane(invalid), RangeError); checks++;
}

// Source swapping must reverse two opposing faces, independent of albedo.
map.clear();
plane({ normal: [-2, 0, 0], elevation: 0 }, 100, 100);
plane({ normal: [2, 0, 0], elevation: 0 }, 120, 100);
const left = { x: 80, y: 90, elevation: 20 };
const right = { x: 140, y: 90, elevation: 20 };
const leftFacing = map.receiverResponse(100, 100, left);
const rightFacing = map.receiverResponse(120, 100, right);
expect(leftFacing > .5 && rightFacing > .5, 'Each face receives a light on its outward side');
near(leftFacing, rightFacing, 'Mirroring surface and source preserves response');
expect(map.receiverResponse(100, 100, right) === 0 && map.receiverResponse(120, 100, left) === 0,
  'Backfaces do not receive direct light after swapping source sides');
plane({ normal: [-1, 0, 0], elevation: 0, occlusion: .5 }, 100, 100);
near(map.receiverResponse(100, 100, left), leftFacing / 2, 'Authored visibility attenuates direct response');
plane({ normal: [-1, 0, 0], elevation: 0, occlusion: 0 }, 100, 100);
expect(map.receiverResponse(100, 100, left) === 0, 'Zero visibility blocks direct light');
expect(map.receiverResponse(-.1, 0, left) === 0 && map.receiverResponse(640, 0, left) === 0
  && map.receiverResponse(0, 400, left) === 0 && map.receiverResponse(NaN, 0, left) === 0,
  'Out-of-bounds and nonfinite receivers return zero');
expect(map.receiverResponse(20, 20, left) === 0, 'Unauthored pixels do not invent a plane');
expect(map.receiverResponse(120, 100, { ...right, elevation: NaN }) === 0, 'Invalid emitter height returns zero');
expect(map.receiverResponse(120, 100, { x: 1e308, y: 1e308, elevation: 1e308 }) === 0,
  'Overflowing finite source coordinates do not produce NaN responses');
expect(map.receiverResponse(120, 100, { x: 120, y: 100, elevation: 0 }) === 0,
  'A coincident source has no directional response or division by zero');

// The same screen position at different world heights sees a different light vector.
map.clear(); plane(top, 100, 100);
const raisedLight = { x: 120, y: 80, elevation: 40 };
const lowerResponse = map.receiverResponse(100, 100, raisedLight);
near(lowerResponse, 40 / Math.sqrt(20 * 20 + 20 * 20 + 40 * 40), 'Response uses reconstructed world Y, not screen Y');
plane({ normal: [0, 0, 1], elevation: 32 }, 100, 100);
const upperResponse = map.receiverResponse(100, 100, raisedLight);
near(upperResponse, 8 / Math.sqrt(20 * 20 + 12 * 12 + 8 * 8), 'Receiver height changes both world Y and Z');
expect(lowerResponse - upperResponse > .4, 'Changing local elevation materially changes dynamic response');

// Left ramp interpolates the existing 32px height drop over its 42 screen rows.
map.clear();
const rise = -32 / 42;
plane({ normal: [0, -rise, 1 + rise], elevation: 32, originY: 224, riseY: rise }, 262, 224, 41, 43);
near(map.heights[index(280, 224)]!, 32, 'Ramp starts at upper-floor height');
near(map.heights[index(280, 266)]!, 0, 'Ramp meets the lower floor without a height jump');
for (let y = 224; y < 266; y++) {
  near(map.heights[index(280, y + 1)]! - map.heights[index(280, y)]!, rise, 'Each ramp row has a continuous height increment');
}
plane({ normal: [-.25, 0, 1], elevation: 6, originX: 10, riseX: .25 }, 10, 20, 3, 1);
near(map.heights[index(12, 20)]!, 6.5, 'Fractional cross-slope heights survive stamping');

// Equal albedo makes static orientation visible. Transparent RGB, black cavities,
// teal/amber emission and unlabelled pixels are required to remain byte-identical.
map.clear();
const pixels = new Uint8ClampedArray(count * 4);
for (const [x, surface] of [[20, top], [40, { normal: [0, 1, 0], elevation: 0 }],
  [60, { normal: [1, 0, 0], elevation: 0 }]] as const) {
  plane(surface, x, 20); paint(pixels, x, 20, [100, 100, 100, 255]);
}
const invariantColors = [
  [140, 140, 140, 0], [8, 10, 12, 255], [13, 17, 20, 255],
  [26, 173, 150, 255], [14, 74, 63, 255], [196, 135, 58, 255], [138, 92, 42, 255],
];
invariantColors.forEach((color, i) => { plane(top, 100 + i * 10, 20); paint(pixels, 100 + i * 10, 20, color); });
paint(pixels, 200, 20, [100, 100, 100, 255]);
plane(top, 220, 20); paint(pixels, 220, 20, [100, 100, 100, 79]);
const original = pixels.slice();
const probe = canvas(pixels);
map.bake(probe.ctx);
expect(probe.reads === 1 && probe.writes === 1, 'Baking performs exactly one Canvas read and upload');
const bright = pixels[index(20, 20) * 4]!; const front = pixels[index(40, 20) * 4]!; const side = pixels[index(60, 20) * 4]!;
expect(bright >= 125 && bright <= 140 && front >= 85 && front <= 100 && side >= 55 && side <= 70,
  `Orientation keeps distinct top/front/side bands, received ${bright}/${front}/${side}`);
expect(bright > front + 30 && front > side + 20, 'Static volume comes from adjacent face orientation');
invariantColors.forEach((color, i) => {
  assert.deepEqual(rgba(pixels, 100 + i * 10, 20), color, 'Cavity/emission/transparent pixel changed'); checks++;
});
assert.deepEqual(rgba(pixels, 200, 20), [100, 100, 100, 255]); checks++;
expect(pixels.every((value, i) => i % 4 !== 3 || value === original[i]), 'Every alpha byte survives baking');
expect(pixels[index(220, 20) * 4] === bright, 'Partial alpha retains albedo response without a second alpha multiply');
assert.throws(() => map.bake(canvas(pixels, 320, 200).ctx), RangeError); checks++;
assert.throws(() => map.bake(canvas(new Uint8ClampedArray(4)).ctx), RangeError); checks++;

// A flat ramp must not self-occlude. An actual raised neighbour may darken a
// contact, while a distant overlap or transparent hole must not darken it.
function contactFixture(neighbourHeight: number, alpha = 255, ramp = false): number {
  map.clear();
  const frame = new Uint8ClampedArray(count * 4);
  const surface: SurfacePlane = ramp
    ? { normal: [0, -.25, 1.25], elevation: 0, originY: 100, riseY: .25 }
    : top;
  plane(surface, 90, 90, 21, 21);
  for (let y = 90; y <= 110; y++) for (let x = 90; x <= 110; x++) paint(frame, x, y, [100, 100, 100, 255]);
  if (!ramp) {
    plane({ normal: [0, 0, 1], elevation: neighbourHeight }, 101, 98, 3, 5);
    for (let y = 98; y <= 102; y++) for (let x = 101; x <= 103; x++) paint(frame, x, y, [100, 100, 100, alpha]);
  }
  map.bake(canvas(frame).ctx);
  return frame[index(100, 100) * 4]!;
}
const flat = contactFixture(0);
const touching = contactFixture(3);
expect(touching < flat, 'Raised nearby geometry adds contact occlusion to a lower receiver');
expect(contactFixture(40) === flat, 'Distant world-space overlaps do not cast false contact shadows');
expect(contactFixture(3, 0) === flat, 'Transparent geometry does not occlude a neighbour');
const rampCenter = contactFixture(0, 255, true);
map.clear();
const isolatedRamp = new Uint8ClampedArray(count * 4);
plane({ normal: [0, -.25, 1.25], elevation: 0 }, 100, 100);
paint(isolatedRamp, 100, 100, [100, 100, 100, 255]);
map.bake(canvas(isolatedRamp).ctx);
expect(rampCenter === isolatedRamp[index(100, 100) * 4], 'A coplanar slope has no invented height-noise occlusion');

console.log(`I30 volume surfaces: ${checks} checks PASS (surface coverage, continuous height, mirrored light, face shading, contact geometry, alpha/cavity/emission preservation). Runtime integration and aesthetics require separate review.`);
