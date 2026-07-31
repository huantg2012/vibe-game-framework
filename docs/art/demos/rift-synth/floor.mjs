// B 方向：程序化连续地面（代码当纹理美术）+ dw3 Darkwood 光照。一次性工具。
// 地面按世界坐标程序生成：分形噪声脏污 + 划痕 + 稀疏 teal 渗漏 + Bayer 抖动 + 色板量化 => 零接缝零重复。
// 用法: npx tsx docs/art/demos/rift-synth/floor.mjs --suffix f1 --grime 0.5 --scratches 90 --teal 5 --dither 1
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..', '..', '..', '..');

const A = process.argv.slice(2);
const arg = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const SUFFIX = arg('--suffix', 'f');
const GRIME = Number(arg('--grime', '0.5'));      // 中频脏污起伏幅度
const MACRO = Number(arg('--macro', '0.35'));     // 低频大尺度明暗（暗潭/磨亮路径）
const SCRATCHES = Number(arg('--scratches', '90'));
const TEAL = Number(arg('--teal', '5'));          // teal 渗漏条数
const DITHER = arg('--dither', '1') !== '0';
// 光照（dw3 值）
const FACING = Number(arg('--facingDeg', '-90')) * Math.PI / 180;
const PCOL = Number(arg('--pcol', '10')), PROW = Number(arg('--prow', '9'));
const LAMP = Number(arg('--lamp', '0.75')), GRAIN = Number(arg('--grain', '0.02'));
const BEAM = Number(arg('--beam', '2.7')), BEAMWARM = Number(arg('--beamWarm', '0.32'));
const AMBLIT = Number(arg('--ambLit', '0.4')), EDGETEAL = Number(arg('--edgeTeal', '0.2'));

const T = 32, COLS = 20, ROWS = 13, UP = 3;
const W = COLS * T, H = ROWS * T;
const V = { RF: 224, RA: 80, CONE: 50 * Math.PI / 180, FALL: 30 * Math.PI / 180, MIN: 48, BAND: 32, ALPHAS: [1, 0.6, 0.2], VOID: [8, 10, 12], LAMPC: [0x8a, 0x5c, 0x2a] };

// ---------- palette ----------
const palHex = JSON.parse(readFileSync(join(ROOT, 'docs/art/palette.json'), 'utf8')).colors;
const PAL = palHex.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
function nearest(r, g, b) { let bi = 0, bd = 1e9; for (let i = 0; i < PAL.length; i++) { const p = PAL[i]; const d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2; if (d < bd) { bd = d; bi = i; } } return PAL[bi]; }
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(row => row.map(v => (v / 16 - 0.5))); // -0.5..0.5

// ---------- noise ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(ix, iy, seed) { let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, freq, seed) { const gx = x * freq, gy = y * freq; const x0 = Math.floor(gx), y0 = Math.floor(gy); const fx = gx - x0, fy = gy - y0; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed); return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; }
function fractal(x, y, seed) { let sum = 0, amp = 0.5, freq = 1 / 48, norm = 0; for (let o = 0; o < 4; o++) { sum += amp * vnoise(x, y, freq, seed + o * 31); norm += amp; amp *= 0.5; freq *= 2.1; } return sum / norm; }
const shortestArc = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function effRadius(off) { const th = Math.abs(shortestArc(off)); if (th <= V.CONE) return V.RF; if (th >= V.CONE + V.FALL) return V.RA; const t = (th - V.CONE) / V.FALL, s = t * t * (3 - 2 * t); return V.RF + (V.RA - V.RF) * s; }
function visAt(dist, off) { if (dist <= V.MIN) return 1; const range = effRadius(off); if (dist > range) return 0; const bw = Math.max(0, Math.min((range - V.MIN) / 2, V.BAND)); const core = Math.max(range - bw * 2, V.MIN), mid = Math.max(range - bw, core); if (dist <= core) return V.ALPHAS[0]; if (dist <= mid) return V.ALPHAS[1]; return V.ALPHAS[2]; }

// ---------- 网格（墙/错误块）----------
function buildGrid() {
  const rng = mulberry32(20260729);
  const grid = [], wall = [];
  for (let r = 0; r < ROWS; r++) { grid[r] = []; wall[r] = []; for (let c = 0; c < COLS; c++) {
    if (r === 0) grid[r][c] = 'wall'; else if (r === 4 && c >= 6 && c <= 13) grid[r][c] = 'wall'; else grid[r][c] = 'floor';
    wall[r][c] = grid[r][c] === 'wall'; rng();
  } }
  const errors = [[7, 3, 'small'], [9, 15, 'small'], [3, 10, 'small'], [8, 9, 'large']];
  for (const [r, c] of errors) wall[r][c] = false;
  return { grid, wall, errors };
}

function main() {
  const { grid, wall, errors } = buildGrid();

  // 预生成划痕线段（有符号：多数压暗，少数是反光磨痕）
  const srng = mulberry32(9001);
  const scratches = [];
  for (let i = 0; i < SCRATCHES; i++) { const x = srng() * W, y = srng() * H; const ang = srng() * Math.PI * 2; const len = 6 + srng() * 26; const sign = srng() < 0.35 ? 1 : -1; const mag = 5 + srng() * 12; scratches.push({ x0: x, y0: y, x1: x + Math.cos(ang) * len, y1: y + Math.sin(ang) * len, delta: sign * mag }); }
  // 微碎屑：细小亮/暗点
  const frng = mulberry32(24601);
  const flecks = [];
  for (let i = 0; i < 340; i++) { flecks.push({ x: Math.floor(frng() * W), y: Math.floor(frng() * H), rad: frng() < 0.7 ? 0 : 1, delta: (frng() < 0.5 ? 1 : -1) * (5 + frng() * 12) }); }
  // teal 渗漏折线（沿噪声脊）
  const trng = mulberry32(1717);
  const tealLines = [];
  for (let i = 0; i < TEAL; i++) { let x = trng() * W, y = trng() * H; let ang = trng() * Math.PI * 2; const pts = [[x, y]]; const seg = 8 + Math.floor(trng() * 10); for (let s = 0; s < seg; s++) { ang += (trng() - 0.5) * 1.1; x += Math.cos(ang) * 4; y += Math.sin(ang) * 4; pts.push([x, y]); } tealLines.push(pts); }

  // 划痕/碎屑 => 有符号亮度增量图（|abs| 最大者胜）
  const scratchMap = new Float32Array(W * H);
  const put = (x, y, delta) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const idx = y * W + x; if (Math.abs(delta) > Math.abs(scratchMap[idx])) scratchMap[idx] = delta; };
  const stamp = (x0, y0, x1, y1, delta) => { const steps = Math.max(2, Math.hypot(x1 - x0, y1 - y0)); for (let s = 0; s <= steps; s++) { const t = s / steps; put(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), delta); } };
  for (const s of scratches) stamp(s.x0, s.y0, s.x1, s.y1, s.delta);
  for (const fl of flecks) { put(fl.x, fl.y, fl.delta); if (fl.rad) { put(fl.x + 1, fl.y, fl.delta); put(fl.x, fl.y + 1, fl.delta); put(fl.x + 1, fl.y + 1, fl.delta); } }
  const tealMap = new Float32Array(W * H);
  for (const pts of tealLines) for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; const steps = Math.max(2, Math.hypot(x1 - x0, y1 - y0)); for (let s = 0; s <= steps; s++) { const t = s / steps; const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); if (x < 0 || y < 0 || x >= W || y >= H) continue; tealMap[y * W + x] = 1; } }

  // ---------- 生成 base 图（程序化地面 + 墙 + 错误块）----------
  const base = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; const tc = Math.floor(x / T), tr = Math.floor(y / T); const cell = grid[tr][tc];
    let r, g, b;
    if (cell === 'wall') {
      // 墙：顶面略亮 + 下沿阴影
      const localY = y - tr * T; const top = localY < T * 0.42;
      const n = fractal(x, y, 555) - 0.5;
      const baseV = top ? 42 : 18; r = baseV + n * 8; g = baseV + 2 + n * 8; b = baseV + 5 + n * 8;
      if (!top && localY < T * 0.5) { r *= 0.5; g *= 0.5; b *= 0.5; } // 墙脚阴影
    } else {
      // 地面：冷灰基 + 低频大尺度 + 中频脏污 + 划痕 + teal 渗漏
      const f = fractal(x, y, 1); const grime = (f - 0.5) * 2 * GRIME; // -GRIME..GRIME
      const macro = (vnoise(x, y, 1 / 210, 99) - 0.5) * 2 * MACRO;     // 低频大尺度起伏
      let bv = 26 * (1 + grime + macro); // 冷灰基亮度
      bv += scratchMap[y * W + x];  // 划痕/碎屑（有符号）
      r = bv * 0.82; g = bv * 0.92; b = bv * 1.05; // 冷偏蓝
      // 低频暖锈斑（极暗、稀）
      const rust = fractal(x + 1000, y - 500, 7); if (rust > 0.72) { const k = (rust - 0.72) / 0.28 * 0.4; r = r + (0x2a - r) * k; g = g + (0x20 - g) * k; b = b + (0x18 - b) * k; }
      // teal 渗漏
      if (tealMap[y * W + x]) { r = 0x1a; g = 0x7a; b = 0x9a; }
    }
    // 随机（蓝噪近似）抖动 + 量化：避免 Bayer 规则网纹
    if (DITHER) { const d = (hash2(x, y, 31337) - 0.5) * 12; r += d; g += d; b += d; }
    const q = nearest(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
    base[i] = q[0]; base[i + 1] = q[1]; base[i + 2] = q[2]; base[i + 3] = 255;
  }
  // 错误块单独盖（保证 flat 纯 teal，不被噪声污染）
  const paintRect = (cx, cy, w, h, col) => { for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = (y * W + x) * 4; base[i] = col[0]; base[i + 1] = col[1]; base[i + 2] = col[2]; } };
  for (const [r, c, kind] of errors) { const ox = c * T, oy = r * T; if (kind === 'small') paintRect(ox + 12, oy + 10, 8, 6, [0x2a, 0xe6, 0xc8]); else { paintRect(ox + 6, oy + 8, 10, 8, [0x2a, 0xe6, 0xc8]); paintRect(ox + 17, oy + 12, 7, 9, [0x1a, 0xad, 0x96]); paintRect(ox + 9, oy + 18, 8, 7, [0x3c, 0xff, 0xd4]); } }

  // ---------- Darkwood 光照渲染 ----------
  const Ox = PCOL * T + T / 2, Oy = PROW * T + T / 2, oTR = PROW, oTC = PCOL;
  function blocked(x, y) { const tc = Math.floor(x / T), tr = Math.floor(y / T); const dx = x - Ox, dy = y - Oy; const dist = Math.hypot(dx, dy); const steps = Math.max(2, Math.floor(dist / 4)); for (let s = 1; s < steps; s++) { const t = s / steps; const cc = Math.floor((Ox + dx * t) / T), rr = Math.floor((Oy + dy * t) / T); if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue; if ((rr === oTR && cc === oTC) || (rr === tr && cc === tc)) continue; if (wall[rr][cc]) return true; } return false; }

  const grng = mulberry32(4242);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const dx = x + 0.5 - Ox, dy = y + 0.5 - Oy; const dist = Math.hypot(dx, dy); const off = shortestArc(Math.atan2(dy, dx) - FACING);
    let vis = visAt(dist, off); if (vis > 0 && dist > V.MIN && blocked(x + 0.5, y + 0.5)) vis = 0;
    let r = base[i], g = base[i + 1], b = base[i + 2];
    if (vis > 0 && BEAM > 1) { const th = Math.abs(shortestArc(off)); let ang; if (th <= V.CONE) ang = 1; else if (th >= V.CONE + V.FALL) ang = AMBLIT; else { const t = (th - V.CONE) / V.FALL; ang = 1 + (AMBLIT - 1) * (t * t * (3 - 2 * t)); } const range = effRadius(off); const rad = Math.max(0, 1 - dist / range); const radF = rad * rad * (3 - 2 * rad); const boost = 1 + (BEAM - 1) * ang * radF; r *= boost; g *= boost; b *= boost; const wk = BEAMWARM * ang * radF * 0.5; r = r + (V.LAMPC[0] - r) * wk; g = g + (V.LAMPC[1] - g) * wk; b = b + (V.LAMPC[2] - b) * wk; }
    if (vis > 0 && EDGETEAL > 0) { const range = effRadius(off); let ef = (dist / range - 0.55) / 0.45; ef = Math.max(0, Math.min(1, ef)); const k = EDGETEAL * ef * ef; r = r + (0x1a - r) * k; g = g + (0xad - g) * k; b = b + (0x96 - b) * k; }
    r = V.VOID[0] + (r - V.VOID[0]) * vis; g = V.VOID[1] + (g - V.VOID[1]) * vis; b = V.VOID[2] + (b - V.VOID[2]) * vis;
    if (LAMP > 0) { const ld = dist / (V.RA * 1.4); if (ld < 1) { const fall = (1 - ld) * (1 - ld); const add = 0.12 * LAMP * fall * 255; r += V.LAMPC[0] / 255 * add; g += V.LAMPC[1] / 255 * add; b += V.LAMPC[2] / 255 * add; } }
    if (GRAIN > 0) { const n = (grng() * 2 - 1) * GRAIN * 255 * (vis > 0 ? 0.7 : 0.35); r += n; g += n; b += n; }
    out[i] = Math.max(0, Math.min(255, r)); out[i + 1] = Math.max(0, Math.min(255, g)); out[i + 2] = Math.max(0, Math.min(255, b)); out[i + 3] = 255;
  }

  // 玩家占位
  Promise.resolve().then(async () => {
    const pcomp = await sharp({ create: { width: 14, height: 14, channels: 4, background: { r: 200, g: 205, b: 212, alpha: 1 } } }).png().toBuffer();
    let img = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
    img = await sharp(img).composite([{ input: pcomp, top: Math.round(Oy - 7), left: Math.round(Ox - 7) }]).toBuffer();
    await sharp(img).resize(W * UP, H * UP, { kernel: 'nearest' }).png().toFile(join(DIR, `floor.${SUFFIX}.png`));
    // 也存一张纯地面（无光照）便于看纹理本身
    await sharp(base, { raw: { width: W, height: H, channels: 4 } }).resize(W * UP, H * UP, { kernel: 'nearest' }).png().toFile(join(DIR, `floor-flat.${SUFFIX}.png`));
    console.log(`floor.${SUFFIX}.png + floor-flat.${SUFFIX}.png (grime=${GRIME} scratches=${SCRATCHES} teal=${TEAL} dither=${DITHER})`);
  });
}
main();
