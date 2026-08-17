/**
 * Slice 6 outline preview — grow+erode (path C) land masks.
 * Not the game generator. Design evidence only.
 *
 *   node docs/art/demos/slice-6-outline/preview.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const W = 64;
const H = 42;
const SCALE = 8;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idx(x, y) {
  return y * W + x;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < W && y < H;
}

function neighbors8(grid, x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny) || grid[idx(nx, ny)]) n++;
    }
  }
  return n;
}

function largestComponent(grid) {
  const seen = new Uint8Array(W * H);
  let best = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (!grid[i] || seen[i]) continue;
      const q = [[x, y]];
      seen[i] = 1;
      const cells = [];
      while (q.length) {
        const [cx, cy] = q.pop();
        cells.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          const ni = idx(nx, ny);
          if (!inBounds(nx, ny) || seen[ni] || !grid[ni]) continue;
          seen[ni] = 1;
          q.push([nx, ny]);
        }
      }
      if (cells.length > best.length) best = cells;
    }
  }
  const out = new Uint8Array(W * H);
  for (const [x, y] of best) out[idx(x, y)] = 1;
  return out;
}

/** Path C: seed grow, then erode, keep the biggest island. */
function generateC(seed) {
  const rng = mulberry32(seed);
  const grid = new Uint8Array(W * H);

  const seeds = 3 + Math.floor(rng() * 3);
  for (let s = 0; s < seeds; s++) {
    let x = Math.floor(W * (0.28 + rng() * 0.44));
    let y = Math.floor(H * (0.28 + rng() * 0.44));
    const steps = 80 + Math.floor(rng() * 90);
    for (let i = 0; i < steps; i++) {
      grid[idx(x, y)] = 1;
      const dir = Math.floor(rng() * 4);
      x += [1, -1, 0, 0][dir];
      y += [0, 0, 1, -1][dir];
      x = Math.max(2, Math.min(W - 3, x));
      y = Math.max(2, Math.min(H - 3, y));
    }
  }

  for (let iter = 0; iter < 10; iter++) {
    const next = new Uint8Array(grid);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const n = neighbors8(grid, x, y);
        if (!grid[idx(x, y)] && n >= 4 && rng() < 0.72) next[idx(x, y)] = 1;
      }
    }
    grid.set(next);
  }

  for (let iter = 0; iter < 4; iter++) {
    const next = new Uint8Array(grid);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const n = neighbors8(grid, x, y);
        if (grid[idx(x, y)] && n <= 2) next[idx(x, y)] = 0;
      }
    }
    grid.set(next);
  }

  return largestComponent(grid);
}

function stampWall(land, walls, ox, oy, cells) {
  for (const [dx, dy] of cells) {
    const x = ox + dx;
    const y = oy + dy;
    if (!inBounds(x, y) || !land[idx(x, y)]) continue;
    walls[idx(x, y)] = 1;
  }
}

function L(w, h) {
  const cells = [];
  for (let x = 0; x < w; x++) cells.push([x, 0]);
  for (let y = 1; y < h; y++) cells.push([0, y]);
  return cells;
}

function ridge(len, vertical) {
  const cells = [];
  for (let i = 0; i < len; i++) cells.push(vertical ? [0, i] : [i, 0]);
  return cells;
}

function Cshape(w, h) {
  const cells = [];
  for (let x = 0; x < w; x++) {
    cells.push([x, 0]);
    cells.push([x, h - 1]);
  }
  for (let y = 1; y < h - 1; y++) cells.push([0, y]);
  return cells;
}

function placeRuins(land, seed) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const walls = new Uint8Array(W * H);
  const stamps = [L(7, 5), L(6, 8), ridge(9, false), ridge(8, true), Cshape(8, 6)];
  let placed = 0;
  for (let attempt = 0; attempt < 80 && placed < 3; attempt++) {
    const stamp = stamps[Math.floor(rng() * stamps.length)];
    const ox = 4 + Math.floor(rng() * (W - 14));
    const oy = 4 + Math.floor(rng() * (H - 12));
    const onLand = stamp.filter(([dx, dy]) => {
      const x = ox + dx;
      const y = oy + dy;
      return inBounds(x, y) && land[idx(x, y)];
    }).length;
    if (onLand < stamp.length * 0.7) continue;
    stampWall(land, walls, ox, oy, stamp);
    placed++;
  }
  return walls;
}

function pickLand(land, rng, avoidWalls) {
  for (let i = 0; i < 400; i++) {
    const x = 2 + Math.floor(rng() * (W - 4));
    const y = 2 + Math.floor(rng() * (H - 4));
    if (land[idx(x, y)] && (!avoidWalls || !avoidWalls[idx(x, y)])) return [x, y];
  }
  return [W >> 1, H >> 1];
}

const VOID = [8, 10, 12];
const LAND = [26, 30, 24];
const WALL = [58, 48, 40];
const SPAWN = [196, 135, 58];
const EXIT = [42, 230, 200];

function raster(land, walls, spawn, exit) {
  const pw = W * SCALE;
  const ph = H * SCALE;
  const rgba = Buffer.alloc(pw * ph * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = VOID;
      if (land[idx(x, y)]) c = LAND;
      if (walls && walls[idx(x, y)]) c = WALL;
      if (spawn && spawn[0] === x && spawn[1] === y) c = SPAWN;
      if (exit && exit[0] === x && exit[1] === y) c = EXIT;
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          const o = ((y * SCALE + sy) * pw + (x * SCALE + sx)) * 4;
          rgba[o] = c[0];
          rgba[o + 1] = c[1];
          rgba[o + 2] = c[2];
          rgba[o + 3] = 255;
        }
      }
    }
  }
  return { rgba, pw, ph };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const tag = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([len, tag, data, crc]);
}

function writePng(path, rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

mkdirSync(DIR, { recursive: true });

const seeds = [101, 202, 303, 404, 505, 606];
const manifest = [];

for (const seed of seeds) {
  const land = generateC(seed);
  const walls = placeRuins(land, seed);
  const rng = mulberry32(seed ^ 17);
  const spawn = pickLand(land, rng, walls);
  let exit = pickLand(land, rng, walls);
  for (let i = 0; i < 30; i++) {
    const cand = pickLand(land, rng, walls);
    if (Math.abs(cand[0] - spawn[0]) + Math.abs(cand[1] - spawn[1]) > 28) {
      exit = cand;
      break;
    }
  }

  const bare = raster(land, null, null, null);
  const withRuins = raster(land, walls, spawn, exit);
  const barePath = join(DIR, `c-bare-${seed}.png`);
  const ruinPath = join(DIR, `c-ruins-${seed}.png`);
  writePng(barePath, bare.rgba, bare.pw, bare.ph);
  writePng(ruinPath, withRuins.rgba, withRuins.pw, withRuins.ph);
  manifest.push({ seed, bare: `c-bare-${seed}.png`, ruins: `c-ruins-${seed}.png` });
}

const rect = new Uint8Array(W * H);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) rect[idx(x, y)] = 1;
}
const rectPng = raster(rect, null, null, null);
writePng(join(DIR, 'control-rectangle.png'), rectPng.rgba, rectPng.pw, rectPng.ph);

writeFileSync(join(DIR, 'manifest.json'), JSON.stringify({ w: W, h: H, seeds: manifest }, null, 2));
console.log(`wrote ${manifest.length * 2 + 1} pngs in ${DIR}`);
