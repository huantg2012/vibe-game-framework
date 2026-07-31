// Darkwood 目标态渲染器（一次性工具，非游戏运行时）。
// 忠实复刻 VisibilitySystem：前向锥+环形、三段可见度、墙体投影遮挡、贴身暖灯、void 噪声。
// 素材用 loop4 那套合规 tile。用法示例：
//   npx tsx docs/art/demos/rift-synth/darkwood.mjs --suffix dw1 --facingDeg -90 --pcol 10 --prow 9 --lamp 0.5 --grain 0.05 --floorVar 0.18
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const TILES = join(DIR, 'out-tiles.loop4');
const DECALS = join(DIR, 'out-decals.loop4');

const A = process.argv.slice(2);
const arg = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const SUFFIX = arg('--suffix', 'dw');
const FACING = Number(arg('--facingDeg', '-90')) * Math.PI / 180;
const PCOL = Number(arg('--pcol', '10')), PROW = Number(arg('--prow', '9'));
const LAMP = Number(arg('--lamp', '0.5'));       // 暖灯强度倍率
const GRAIN = Number(arg('--grain', '0.02'));     // 颗粒强度
const FLOORVAR = Number(arg('--floorVar', '0.18'));// 低频地面明暗起伏幅度
const VOIDLIFT = Number(arg('--voidLift', '0')); // void 抬亮（0=纯黑void）
const BEAM = Number(arg('--beam', '2.4'));        // 锥内光束提亮上限
const BEAMWARM = Number(arg('--beamWarm', '0.22'));// 光束暖调 0..1
const AMBLIT = Number(arg('--ambLit', '0.4'));    // 环形/锥外获得的光束比例
const EDGETEAL = Number(arg('--edgeTeal', '0.18'));// 视野边缘 teal 污染渗入 0..1

const T = 32, COLS = 20, ROWS = 13, UP = 3;
const W = COLS * T, H = ROWS * T;

// VISIBILITY 常量（对齐 src/config/constants.ts）
const V = { RF: 224, RA: 80, CONE: 50 * Math.PI / 180, FALL: 30 * Math.PI / 180, MIN: 48, BAND: 32, ALPHAS: [1.0, 0.6, 0.2], VOID: [8, 10, 12], LAMPC: [0x8a, 0x5c, 0x2a], LAMPA: 0.12 };

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shortestArc = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function effRadius(offset) {
  const th = Math.abs(shortestArc(offset));
  if (th <= V.CONE) return V.RF;
  if (th >= V.CONE + V.FALL) return V.RA;
  const t = (th - V.CONE) / V.FALL, s = t * t * (3 - 2 * t);
  return V.RF + (V.RA - V.RF) * s;
}
function visAt(dist, offset) {
  if (dist <= V.MIN) return 1.0;
  const range = effRadius(offset);
  if (dist > range) return 0;
  const bw = Math.max(0, Math.min((range - V.MIN) / 2, V.BAND));
  const core = Math.max(range - bw * 2, V.MIN), mid = Math.max(range - bw, core);
  if (dist <= core) return V.ALPHAS[0];
  if (dist <= mid) return V.ALPHAS[1];
  return V.ALPHAS[2];
}

async function tbuf(dir, n, rot) { let s = sharp(join(dir, n + '.png')).resize(T, T, { kernel: 'nearest' }); if (rot) s = s.rotate(rot); return s.toBuffer(); }

async function main() {
  const rng = mulberry32(20260729);
  const pick = a => a[Math.floor(rng() * a.length)];
  const weighted = pairs => { const s = pairs.reduce((a, [, w]) => a + w, 0); let r = rng() * s; for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; };
  const FLOORW = [['tile-rift-floor-metro-base', 90], ['tile-rift-floor-metro-crack', 0], ['tile-rift-floor-metro-worn', 0], ['tile-rift-floor-metro-seam', 10]];

  // 网格 + 墙体标记（用于遮挡）
  const grid = [], grot = [], wall = [];
  for (let r = 0; r < ROWS; r++) { grid[r] = []; grot[r] = []; wall[r] = []; for (let c = 0; c < COLS; c++) {
    if (r === 0) grid[r][c] = (c === 0 || c === COLS - 1) ? 'tile-rift-wall-metro-corner' : 'tile-rift-wall-metro-straight';
    else if (r === 4 && c >= 6 && c <= 13) grid[r][c] = 'tile-rift-wall-metro-straight';
    else grid[r][c] = weighted(FLOORW);
    wall[r][c] = grid[r][c].startsWith('tile-rift-wall');
    grot[r][c] = grid[r][c].startsWith('tile-rift-floor') ? pick([0, 90, 180, 270]) : 0;
  } }
  for (const [r, c] of [[7, 3], [9, 15], [3, 10]]) { grid[r][c] = 'tile-rift-error-small'; grot[r][c] = 0; wall[r][c] = false; }
  grid[8][9] = 'tile-rift-error-large'; grot[8][9] = 0;

  // 底层 tile 合成
  const comps = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) comps.push({ input: await tbuf(TILES, grid[r][c], grot[r][c]), top: r * T, left: c * T });
  let base = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 8, g: 10, b: 12, alpha: 1 } } }).composite(comps).png().toBuffer();
  // decal 叠加
  const dcomps = []; let placed = 0, tries = 0;
  while (placed < 16 && tries < 600) { tries++; const r = Math.floor(rng() * ROWS), c = Math.floor(rng() * COLS); if (!grid[r][c].startsWith('tile-rift-floor')) continue; const name = placed % 2 === 0 ? 'decal-rift-teal-crack' : 'decal-rift-debris'; const rot = pick([0, 90, 180, 270]); dcomps.push({ input: await sharp(join(DECALS, name + '.png')).resize(T, T, { kernel: 'nearest' }).rotate(rot).toBuffer(), top: r * T, left: c * T }); placed++; }
  base = await sharp(base).composite(dcomps).png().toBuffer();

  const { data: px } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // 低频地面起伏（value noise，双线性上采样）
  const GN = 12, gnW = Math.ceil(COLS / 2) + 2, gnH = Math.ceil(ROWS / 2) + 2;
  const nrng = mulberry32(777);
  const grid2 = Array.from({ length: gnH }, () => Array.from({ length: gnW }, () => 1 + (nrng() * 2 - 1) * FLOORVAR));
  const sampleVar = (x, y) => { const gx = x / (2 * T), gy = y / (2 * T); const x0 = Math.floor(gx), y0 = Math.floor(gy); const fx = gx - x0, fy = gy - y0; const a = grid2[y0][x0], b = grid2[y0][x0 + 1], c = grid2[y0 + 1][x0], d = grid2[y0 + 1][x0 + 1]; return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };

  // 遮挡：origin->pixel 之间是否穿过墙 tile（不含目标 tile 与 origin tile）
  const Ox = PCOL * T + T / 2, Oy = PROW * T + T / 2;
  const oTileR = PROW, oTileC = PCOL;
  function blocked(x, y) {
    const tc = Math.floor(x / T), tr = Math.floor(y / T);
    const dx = x - Ox, dy = y - Oy; const dist = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.floor(dist / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps; const sx = Ox + dx * t, sy = Oy + dy * t;
      const cc = Math.floor(sx / T), rr = Math.floor(sy / T);
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
      if ((rr === oTileR && cc === oTileC) || (rr === tr && cc === tc)) continue;
      if (wall[rr][cc]) return true;
    }
    return false;
  }

  const grng = mulberry32(4242);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const dx = x + 0.5 - Ox, dy = y + 0.5 - Oy; const dist = Math.hypot(dx, dy);
    const offset = shortestArc(Math.atan2(dy, dx) - FACING);
    let vis = visAt(dist, offset);
    if (vis > 0 && dist > V.MIN && blocked(x + 0.5, y + 0.5)) vis = 0;

    // 地面低频起伏（只在可见处有意义）
    const varf = 1 + (sampleVar(x, y) - 1); // 已含幅度
    let r = px[i] * varf, g = px[i + 1] * varf, b = px[i + 2] * varf;

    // 光束提亮：锥内近处真正被手电照亮，随角度/距离衰减
    if (vis > 0 && BEAM > 1) {
      const th = Math.abs(shortestArc(offset));
      let ang; // 角度因子：锥内=1，落差区渐降，锥外=AMBLIT
      if (th <= V.CONE) ang = 1; else if (th >= V.CONE + V.FALL) ang = AMBLIT; else { const t = (th - V.CONE) / V.FALL; ang = 1 + (AMBLIT - 1) * (t * t * (3 - 2 * t)); }
      const range = effRadius(offset);
      const rad = Math.max(0, 1 - dist / range); const radF = rad * rad * (3 - 2 * rad); // 近亮远暗
      const boost = 1 + (BEAM - 1) * ang * radF;
      r *= boost; g *= boost; b *= boost;
      // 暖调：提亮量越大越暖
      const wk = BEAMWARM * ang * radF;
      r = r + (V.LAMPC[0] - r) * wk * 0.5; g = g + (V.LAMPC[1] - g) * wk * 0.5; b = b + (V.LAMPC[2] - b) * wk * 0.5;
    }

    // 视野边缘 teal 污染渗入（vis>0 且靠近射程外沿）
    if (vis > 0 && EDGETEAL > 0) {
      const range = effRadius(offset);
      let ef = (dist / range - 0.55) / 0.45; ef = Math.max(0, Math.min(1, ef));
      const k = EDGETEAL * ef * ef;
      r = r + (0x1a - r) * k; g = g + (0xad - g) * k; b = b + (0x96 - b) * k;
    }

    // 可见度混合到 void
    const vr = V.VOID[0] + VOIDLIFT, vg = V.VOID[1] + VOIDLIFT, vb = V.VOID[2] + VOIDLIFT;
    r = vr + (r - vr) * vis; g = vg + (g - vg) * vis; b = vb + (b - vb) * vis;

    // 贴身暖灯（ADD，环形范围内径向衰减）
    if (LAMP > 0) {
      const ld = dist / (V.RA * 1.4);
      if (ld < 1) { const fall = (1 - ld) * (1 - ld); const add = V.LAMPA * LAMP * fall * 255; r += V.LAMPC[0] / 255 * add; g += V.LAMPC[1] / 255 * add; b += V.LAMPC[2] / 255 * add; }
    }
    // 颗粒（void 里更弱，避免雪花感）
    if (GRAIN > 0) { const n = (grng() * 2 - 1) * GRAIN * 255 * (vis > 0 ? 0.7 : 0.35); r += n; g += n; b += n; }

    out[i] = Math.max(0, Math.min(255, Math.round(r)));
    out[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    out[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    out[i + 3] = 255;
  }

  // 玩家占位（小方块）
  const pcomp = await sharp({ create: { width: 14, height: 14, channels: 4, background: { r: 200, g: 205, b: 212, alpha: 1 } } }).png().toBuffer();
  let img = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  img = await sharp(img).composite([{ input: pcomp, top: Math.round(Oy - 7), left: Math.round(Ox - 7) }]).toBuffer();

  await sharp(img).resize(W * UP, H * UP, { kernel: 'nearest' }).png().toFile(join(DIR, `darkwood.${SUFFIX}.png`));
  console.log(`darkwood.${SUFFIX}.png  (facing=${(FACING * 180 / Math.PI).toFixed(0)}deg pos=(${PCOL},${PROW}) lamp=${LAMP} grain=${GRAIN} floorVar=${FLOORVAR} voidLift=${VOIDLIFT})`);
}
main().catch(e => { console.error(e); process.exit(1); });
