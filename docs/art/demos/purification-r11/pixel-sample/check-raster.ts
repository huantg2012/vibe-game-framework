import assert from 'node:assert/strict';
import { MATERIALS, PixelLayer, type Ink, type Point } from './raster.ts';

const ink: Ink = { material: 'concrete', tone: 4 };
const count = (layer: PixelLayer): number => layer.mat.reduce((total, material) => total + Number(material !== 0), 0);
const channels = (layer: PixelLayer): readonly (Uint8Array | Int8Array | Float32Array)[] => [
  layer.mat, layer.tone, layer.normalX, layer.normalY, layer.normalZ, layer.light, layer.emission,
  layer.roughness, layer.occlusion, layer.specular,
];

const defaults = new PixelLayer('defaults', 8, 8, 1);
assert.equal(count(defaults), 0, 'new layers must be transparent, not painted void');
defaults.rect(0, 0, 1, 1, { material: 'void', tone: 0 });
assert.equal(defaults.mat[0], 1, 'void is a real painted material distinct from transparency');
assert.equal(defaults.normalZ[0], 127);
assert.equal(defaults.light[0], 255);
defaults.rect(0, 0, 1, 1, {
  material: 'alien', tone: 9, shade: 3, normal: [-1, 0.5, 0], light: 0.25, emission: true,
  roughness: .25, occlusion: .5, specular: .75,
});
assert.deepEqual(channels(defaults).map((channel) => channel[0]), [9, 6, -127, 64, 0, 64, 1, 64, 128, 191]);
defaults.clearPoly([[0, 0], [1, 0], [1, 1], [0, 1]]);
assert.deepEqual(channels(defaults).map((channel) => channel[0]), Array(10).fill(0));
assert.deepEqual(MATERIALS, ['void', 'concrete', 'chalk', 'steel', 'paint', 'rust', 'glass', 'light', 'alien']);
defaults.rect(2, 2, 1, 1, { material: 'chalk', tone: 3.625, shade: 0.25 });
assert.equal(defaults.tone[18], 3.375, 'painted midtones must survive rasterization without whole-step rounding');

// Neighboring faces must tile without missing or double-owned pixels along their diagonal.
const upper = new PixelLayer('upper', 8, 8, 1);
const lower = new PixelLayer('lower', 8, 8, 1);
upper.poly([[1, 1], [7, 1], [7, 7]], ink);
lower.poly([[1, 1], [7, 7], [1, 7]], ink);
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) {
    const owners = Number(upper.mat[y * 8 + x] !== 0) + Number(lower.mat[y * 8 + x] !== 0);
    assert.equal(owners, Number(x >= 1 && x < 7 && y >= 1 && y < 7), `shared edge at ${x},${y}`);
  }
}
const reversed = new PixelLayer('reversed', 8, 8, 1);
reversed.poly([[7, 7], [7, 1], [1, 1]], ink);
assert.deepEqual(reversed.mat, upper.mat, 'winding must not change filled coverage');

// Surface callbacks receive original C-space pixel centres, once per owned pixel,
// even for clipped/concave faces and reversed winding at the production scale.
const surfaceShape: readonly Point[] = [[-3.2, 1.6], [9.6, 1.6], [9.6, 4.8], [6.4, 4.8], [6.4, 11.2], [-3.2, 11.2]];
for (const shape of [surfaceShape, [...surfaceShape].reverse()]) {
  const polygon = new PixelLayer('surface coverage', 8, 8, .625);
  const surface = new PixelLayer('surface', 8, 8, .625);
  const visits = new Uint8Array(64);
  polygon.poly(shape, ink);
  surface.surface(shape, (x, y) => {
    const px = Math.floor(x * .625), py = Math.floor(y * .625);
    assert.ok(px >= 0 && px < 8 && py >= 0 && py < 8, 'callback must only visit canvas pixels');
    assert.ok(Math.abs(x - (px + .5) / .625) < 1e-12);
    assert.ok(Math.abs(y - (py + .5) / .625) < 1e-12);
    visits[py * 8 + px] = visits[py * 8 + px]! + 1;
    return {
      material: px % 2 ? 'steel' : 'chalk', tone: 1 + px / 8 + py / 16,
      normal: [(px - 4) / 4, (py - 4) / 4, .75], light: px / 8,
      emission: py % 2 === 0, roughness: px / 8, occlusion: py / 8, specular: .25,
    };
  });
  for (let i = 0; i < 64; i++) {
    const occupied = Number(polygon.mat[i] !== 0), px = i % 8, py = Math.floor(i / 8);
    assert.equal(visits[i], occupied, `surface coverage at ${px},${py}`);
    if (!occupied) {
      assert.deepEqual(channels(surface).map(channel => channel[i]), Array(10).fill(0));
      continue;
    }
    assert.deepEqual(channels(surface).map(channel => channel[i]), [
      px % 2 ? 4 : 3, 1 + px / 8 + py / 16,
      Math.round((px - 4) / 4 * 127), Math.round((py - 4) / 4 * 127), 95,
      Math.round(px / 8 * 255), py % 2 === 0 ? 1 : 0,
      Math.round(px / 8 * 255), Math.round(py / 8 * 255), 64,
    ], `surface channels at ${px},${py}`);
  }
  surface.clearPoly(shape);
  for (const channel of channels(surface)) assert.ok(channel.every(value => value === 0), 'clear must remove every surface channel');
}

const bounded = new PixelLayer('bounded material parameters', 2, 1, 1);
bounded.rect(0, 0, 1, 1, { ...ink, roughness: -1, occlusion: 2, specular: Number.NaN });
bounded.rect(1, 0, 1, 1, { material: 'steel', tone: 4 });
assert.deepEqual([bounded.roughness[0], bounded.occlusion[0], bounded.specular[0]], [0, 255, 0]);
assert.deepEqual([bounded.roughness[1], bounded.occlusion[1], bounded.specular[1]], [97, 255, 179]);

const clipped = new PixelLayer('clipped', 8, 8, 1);
clipped.rect(-3, -4, 6, 7, ink);
assert.equal(count(clipped), 9);
clipped.poly([[-20, -20], [20, -20], [20, 20], [-20, 20]], ink);
assert.equal(count(clipped), 64);
clipped.clearPoly([[-3, -3], [4, -3], [4, 4], [-3, 4]]);
assert.equal(count(clipped), 48);
for (const channel of channels(clipped)) assert.equal(channel.length, 64);

const lines = new PixelLayer('lines', 8, 8, 1);
lines.line([[-1_000_000, 3], [1_000_000, 3]], ink);
assert.equal(count(lines), 8, 'off-canvas segments must clip to the canvas');
lines.line([[4, -1_000_000], [4, 1_000_000]], ink);
assert.equal(count(lines), 15);
const scaledLine = new PixelLayer('scaled line', 8, 8, 0.625);
scaledLine.line([[0, 0], [11.2, 0]], ink);
assert.equal(count(scaledLine), 8, 'default line width remains one output pixel');
const thickLine = new PixelLayer('thick line', 8, 8, 0.625);
thickLine.line([[0, 4.8], [11.2, 4.8]], ink, 4.8);
assert.equal(count(thickLine), 24, 'supplied line width is scaled from C coordinates');

const ellipse = new PixelLayer('ellipse', 9, 9, 1);
ellipse.ellipse(4, 4, 3, 2, ink);
assert.equal(ellipse.mat[4 * 9 + 1], 2);
assert.equal(ellipse.mat[2 * 9 + 4], 2);
assert.equal(ellipse.mat[2 * 9 + 3], 0);
for (let y = 0; y < 9; y++) {
  for (let x = 0; x < 9; x++) {
    assert.equal(ellipse.mat[y * 9 + x], ellipse.mat[y * 9 + (8 - x)]);
    assert.equal(ellipse.mat[y * 9 + x], ellipse.mat[(8 - y) * 9 + x]);
  }
}
const point = new PixelLayer('point', 4, 4, 1);
point.ellipse(1, 1, 0, 0, ink);
assert.equal(count(point), 1);

const malformed = new PixelLayer('malformed', 8, 8, 1);
malformed.poly([], ink);
malformed.poly([[1, 1]], ink);
malformed.poly([[1, 1], [2, 2]], ink);
malformed.poly([[1, 1], [2, 2], [3, 3]], ink);
malformed.poly([[0, 0], [Number.NaN, 1], [1, 1]], ink);
for (const shape of [[], [[1, 1], [2, 2], [3, 3]], [[0, 0], [Number.NaN, 1], [1, 1]], [[-8, -8], [-4, -8], [-4, -4]]] as readonly (readonly Point[])[]) {
  malformed.surface(shape, () => { throw new Error('empty surface must not call the painter'); });
}
malformed.line([[Number.NaN, 1], [4, 4]], ink);
malformed.line([[-100, -100], [-10, -10]], ink);
malformed.rect(100, 100, 10, 10, ink);
malformed.ellipse(-20, -20, 3, 2, ink);
assert.equal(count(malformed), 0, 'degenerate and fully clipped primitives must leave the layer untouched');
assert.throws(() => new PixelLayer('invalid', 0, 1, 1), RangeError);
assert.throws(() => new PixelLayer('invalid', 1, 1, 0), RangeError);

console.log('Pixel raster: surface coordinates/coverage, material channels/clear, shared edges, clipping, line widths, ellipse symmetry and degenerate input passed.');
