import { Raster } from './raster';
import { worldLandAt, worldWallAt } from './shape';
import type { WorldSample } from './types';

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function mix(a: number, b: number, ratio: number): number {
  const t = Math.max(0, Math.min(1, ratio));
  const r = Math.round((a >>> 16 & 255) * (1 - t) + (b >>> 16 & 255) * t);
  const g = Math.round((a >>> 8 & 255) * (1 - t) + (b >>> 8 & 255) * t);
  const blue = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return r << 16 | g << 8 | blue;
}

/** Jittered material cells: distance to a broken joint, identity and local plane. */
function cellField(x: number, y: number, scale: number, seed: number): { edge: number; identity: number; plane: number } {
  const gx = x / scale, gy = y / scale, cx = Math.floor(gx), cy = Math.floor(gy);
  let first = Infinity, second = Infinity, identity = 0, plane = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const col = cx + ox, row = cy + oy;
    const r = hash(col, row, seed), q = hash(col, row, seed ^ 19271);
    const dx = gx - col - .12 - r * .76, dy = gy - row - .12 - q * .76;
    const distance = dx * dx + dy * dy;
    if (distance < first) { second = first; first = distance; identity = r; plane = dx * .6 - dy * .8; }
    else if (distance < second) second = distance;
  }
  return { edge: (Math.sqrt(second) - Math.sqrt(first)) * scale, identity, plane };
}

/** Three material systems, each with landscape-scale beds, patches and grain. */
export function paintGroundMaterial(raster: Raster, sample: WorldSample, floorMask?: Uint8Array): void {
  const { cols, rows, tileSize: tile, seed, profile } = sample;
  const p = profile.palette, width = cols * tile, height = rows * tile;
  const floor = (x: number, y: number): boolean => {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
    return floorMask ? floorMask[iy * width + ix] === 1 : worldLandAt(sample, ix, iy) && !worldWallAt(sample, ix, iy);
  };
  const material = profile.material;
  const high = material === 'glaze' ? p.floorLight : mix(p.floorLight, p.materialLight, .30);
  const ramps = [0, 1, 2].map(region => Array.from({ length: 48 }, (_, index) => {
    const base = mix(p.floorDeep, high, index / 47);
    return region === 0 ? base : mix(base, region === 1 ? p.materialDark : p.accentDim, material === 'strata' ? .14 : .19);
  }));
  raster.setClip(floor);
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    if (!floor(x, y) && !floor(x + 1, y + 1)) continue;
    const warp = noise(x / 180, y / 170, seed ^ 0x9251) - .5;
    const macro = noise(x / 250 + warp * .9, y / 220 - warp * .7, seed ^ 0x1851);
    const meso = noise(x / 43 + warp * 2, y / 38 + warp, seed ^ 0x7691);
    const fine = noise(x / 9, y / 7, seed ^ 0x5167);
    const region = noise(x / 110, y / 95, seed ^ 0x3675);
    const grain = hash(x >> 1, y >> 1, seed ^ 0x2219) - .5;
    let value = .53 + (macro - .5) * .9 + (meso - .5) * .46 + (fine - .5) * .20;
    let colorRegion = region < .35 ? 1 : region > .68 ? 2 : 0;
    let joint = false, lip = false;
    if (material === 'strata') {
      const bed = y * .81 + x * .26 + warp * 52;
      const bands = noise(x / 80, bed / 5.5, seed ^ 0x8271);
      value += (bands - .5) * (.12 + region * .24) + grain * (.055 + meso * .12);
      const strata = cellField(x + warp * 15, y * 2.5, 54, seed ^ 0x83);
      joint = region > .49 && strata.edge < 1.25 && bands < .62;
      lip = region > .49 && strata.edge > 1.5 && strata.edge < 2.8 && strata.plane < 0;
      value += (strata.identity - .5) * .09;
    } else if (material === 'crystal') {
      const crystal = cellField(x + warp * 22, y - warp * 18, 32, seed ^ 0x631);
      const growth = Math.max(0, (region - .42) * 2.1);
      value += (crystal.identity - .5) * growth * .45;
      value += Math.sign(crystal.plane) * growth * .055 + grain * (.065 + (1 - growth) * .06);
      joint = growth > .22 && crystal.edge < 1.35;
      lip = growth > .35 && crystal.edge >= 1.35 && crystal.edge < 2.8 && crystal.plane < .1;
      if (growth > .45) colorRegion = 2;
    } else {
      const shell = cellField(x + warp * 25, y + warp * 19, 57, seed ^ 0x911);
      const glaze = noise(x / 23 + warp, y / 31, seed ^ 0x827);
      value += (shell.identity - .5) * .10 + (glaze - .5) * .21;
      value += grain * (region < .45 ? .055 : .15);
      joint = shell.edge < .95 && region > .32 && glaze < .72;
      lip = shell.edge > 1.1 && shell.edge < 2.2 && region > .37 && shell.plane < 0;
      if (region > .63 && fine > .54) value -= (fine - .5) * .40;
    }
    if (joint) value -= material === 'glaze' ? .22 : .13;
    if (lip) value += material === 'crystal' ? .21 : .12;
    const index = Math.max(0, Math.min(47, Math.round(value * 47)));
    raster.rect(x, y, 2, 2, ramps[colorRegion]![index]!);
  }

  // Sparse but substantial deposits are correlated with the same region field.
  // The jittered placement is not a tiling pattern; empty regions retain fine grain.
  for (let gy = 0; gy < height / 23; gy++) for (let gx = 0; gx < width / 23; gx++) {
    const x = (gx + hash(gx, gy, seed ^ 927)) * 23;
    const y = (gy + hash(gx, gy, seed ^ 619)) * 23;
    if (!floor(x, y)) continue;
    const region = noise(x / 110, y / 95, seed ^ 0x3675);
    const pick = hash(gx, gy, seed ^ 7719);
    if (pick > .10 + Math.max(0, region - .37) * 1.30) continue;
    const cell = Math.min(sample.flowAngle.length - 1, Math.floor(y / tile) * cols + Math.floor(x / tile));
    const angle = sample.flowAngle[cell]! + (pick - .5) * .8;
    const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
    const length = material === 'crystal' ? 5 + pick * 28 : 4 + pick * 18;
    const breadth = material === 'strata' ? 2 + pick * 3 : 3 + pick * 6;
    const pt = (along: number, across: number): readonly [number, number] => [x + ux * along + vx * across, y + uy * along + vy * across];
    if (material === 'crystal') {
      const root = pt(-length * .35, 0), tip = pt(length, 0), left = pt(length * .3, -breadth), right = pt(length * .4, breadth);
      raster.polygon([root, left, tip, right], mix(p.floorDeep, p.materialDark, .5));
      raster.polygon([root, left, tip], mix(p.materialMid, p.accentLight, pick * .7));
      raster.polygon([root, tip, right], mix(p.floorLight, p.materialMid, .5));
      raster.line(root[0], root[1], tip[0], tip[1], mix(p.faceLight, p.floorLight, .45), 1);
    } else {
      const points = [pt(-length * .6, -breadth * .6), pt(length * .35, -breadth), pt(length, 0), pt(length * .1, breadth), pt(-length * .7, breadth * .3)];
      raster.polygon(points.map(point => [point[0] + 1, point[1] + 2]), mix(p.floorDeep, p.materialDark, .3));
      const color = material === 'glaze' ? mix(p.floorLight, p.materialMid, .20 + pick * .5) : mix(p.floorLight, p.materialMid, pick);
      raster.polygon(points, color);
      raster.line(points[0]![0], points[0]![1], points[1]![0], points[1]![1], mix(color, p.faceLight, .32), 1);
    }
    // Fine broken chips form little tails beside a deposit, not confetti everywhere.
    for (let i = 0; i < 5; i++) {
      const r = hash(gx + i, gy, seed ^ 4271);
      const point = pt(-length - r * 16, (i - 2) * 4);
      raster.rect(point[0], point[1], 1 + Math.floor(r * 3), 1 + Math.floor(r * 2), mix(p.floorLight, p.materialDark, .4 + r * .3));
    }
  }
  raster.setClip(null);
}
