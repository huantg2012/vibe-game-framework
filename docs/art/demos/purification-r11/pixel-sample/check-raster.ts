import assert from 'node:assert/strict';
import { MATERIALS, PixelLayer, type Ink } from './raster.ts';

const ink: Ink = { material: 'concrete', tone: 4 };
const count = (layer: PixelLayer): number => layer.mat.reduce((total, material) => total + Number(material !== 0), 0);
const channels = (layer: PixelLayer): readonly (Uint8Array | Int8Array)[] => [
  layer.mat, layer.tone, layer.normalX, layer.normalY, layer.normalZ, layer.light, layer.emission,
];

const defaults = new PixelLayer('defaults', 8, 8, 1);
assert.equal(count(defaults), 0, 'new layers must be transparent, not painted void');
defaults.rect(0, 0, 1, 1, { material: 'void', tone: 0 });
assert.equal(defaults.mat[0], 1, 'void is a real painted material distinct from transparency');
assert.equal(defaults.normalZ[0], 127);
assert.equal(defaults.light[0], 255);
defaults.rect(0, 0, 1, 1, {
  material: 'alien', tone: 9, shade: 3, normal: [-1, 0.5, 0], light: 0.25, emission: true,
});
assert.deepEqual(channels(defaults).map((channel) => channel[0]), [9, 6, -127, 64, 0, 64, 1]);
defaults.clearPoly([[0, 0], [1, 0], [1, 1], [0, 1]]);
assert.deepEqual(channels(defaults).map((channel) => channel[0]), [0, 0, 0, 0, 0, 0, 0]);
assert.deepEqual(MATERIALS, ['void', 'concrete', 'chalk', 'steel', 'paint', 'rust', 'glass', 'light', 'alien']);

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
malformed.line([[Number.NaN, 1], [4, 4]], ink);
malformed.line([[-100, -100], [-10, -10]], ink);
malformed.rect(100, 100, 10, 10, ink);
malformed.ellipse(-20, -20, 3, 2, ink);
assert.equal(count(malformed), 0, 'degenerate and fully clipped primitives must leave the layer untouched');
assert.throws(() => new PixelLayer('invalid', 0, 1, 1), RangeError);
assert.throws(() => new PixelLayer('invalid', 1, 1, 0), RangeError);

console.log('Pixel raster: material channels, shared edges, clipping, line widths, ellipse symmetry and degenerate input passed.');
