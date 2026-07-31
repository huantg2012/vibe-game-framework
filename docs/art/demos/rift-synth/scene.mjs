// B 方向续：程序化墙体 + 场景构图 + 程序化地面 + Darkwood 光照。一次性工具。
// 布局用 ASCII 图；墙体连续渲染（顶沿受光 / 墙脚 AO / 落影高度感）；柱子给手电制造投影。
// 用法: npx tsx docs/art/demos/rift-synth/scene.mjs --suffix s1 [光照/纹理参数同 floor.mjs]
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..', '..', '..', '..');
const A = process.argv.slice(2);
const arg = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const SUFFIX = arg('--suffix', 's');
const GRIME = Number(arg('--grime', '0.5')), MACRO = Number(arg('--macro', '0.32'));
const SCRATCHES = Number(arg('--scratches', '150')), TEAL = Number(arg('--teal', '6'));
const DITHER = arg('--dither', '1') !== '0';
const FACING = Number(arg('--facingDeg', '-90')) * Math.PI / 180;
const LAMP = Number(arg('--lamp', '0.75')), GRAIN = Number(arg('--grain', '0.02'));
const BEAM = Number(arg('--beam', '2.7')), BEAMWARM = Number(arg('--beamWarm', '0.32'));
const AMBLIT = Number(arg('--ambLit', '0.4')), EDGETEAL = Number(arg('--edgeTeal', '0.2'));

const T = 32, COLS = 20, ROWS = 13, UP = 3;
const W = COLS * T, H = ROWS * T;
const V = { RF: 224, RA: 80, CONE: 50 * Math.PI / 180, FALL: 30 * Math.PI / 180, MIN: 48, BAND: 32, ALPHAS: [1, 0.6, 0.2], VOID: [8, 10, 12], LAMPC: [0x8a, 0x5c, 0x2a] };

const palHex = JSON.parse(readFileSync(join(ROOT, 'docs/art/palette.json'), 'utf8')).colors;
const PAL = palHex.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
function nearest(r, g, b) { let bi = 0, bd = 1e9; for (let i = 0; i < PAL.length; i++) { const p = PAL[i]; const d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2; if (d < bd) { bd = d; bi = i; } } return PAL[bi]; }

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(ix, iy, seed) { let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, freq, seed) { const gx = x * freq, gy = y * freq; const x0 = Math.floor(gx), y0 = Math.floor(gy); const fx = gx - x0, fy = gy - y0; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed); return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; }
function fractal(x, y, seed) { let sum = 0, amp = 0.5, freq = 1 / 48, norm = 0; for (let o = 0; o < 4; o++) { sum += amp * vnoise(x, y, freq, seed + o * 31); norm += amp; amp *= 0.5; freq *= 2.1; } return sum / norm; }
const shortestArc = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function effRadius(off) { const th = Math.abs(shortestArc(off)); if (th <= V.CONE) return V.RF; if (th >= V.CONE + V.FALL) return V.RA; const t = (th - V.CONE) / V.FALL, s = t * t * (3 - 2 * t); return V.RF + (V.RA - V.RF) * s; }
function visAt(dist, off) { if (dist <= V.MIN) return 1; const range = effRadius(off); if (dist > range) return 0; const bw = Math.max(0, Math.min((range - V.MIN) / 2, V.BAND)); const core = Math.max(range - bw * 2, V.MIN), mid = Math.max(range - bw, core); if (dist <= core) return V.ALPHAS[0]; if (dist <= mid) return V.ALPHAS[1]; return V.ALPHAS[2]; }

// ---------- 布局 ----------
// '#'=墙 '.'=地面 'o'=柱 (=墙) 'x'=门洞(地面/void 边界) 数字=错误块
const LAYOUT = [
  '#########..#########',
  '#..................#',
  '#..................#',
  '#..................#',
  '#.....##....##.....#',
  '#.....##....##.....#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####################',
];
function buildGrid() {
  const wall = [];
  for (let r = 0; r < ROWS; r++) { wall[r] = []; for (let c = 0; c < COLS; c++) wall[r][c] = LAYOUT[r][c] === '#'; }
  // 顶部门洞两格 (row0 col9,10) 记为"门洞"：非墙、但通向 void（渲染成黑口）
  const door = new Set(['0,9', '0,10']);
  const errors = [[7, 4, 'small'], [9, 14, 'small'], [6, 10, 'large']];
  return { wall, door, errors };
}

function main() {
  const { wall, door, errors } = buildGrid();
  const isWall = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS && wall[r][c];
  // 门洞视作"无地面无墙"的 void 口
  const isDoor = (r, c) => door.has(r + ',' + c);

  // 像素级墙 bitmap（含门洞=非墙）
  const wallPix = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = Math.floor(y / T), c = Math.floor(x / T); wallPix[y * W + x] = wall[r][c] ? 1 : 0; }

  // 划痕/碎屑（地面用）
  const srng = mulberry32(9001); const scratches = [];
  for (let i = 0; i < SCRATCHES; i++) { const x = srng() * W, y = srng() * H; const ang = srng() * Math.PI * 2; const len = 6 + srng() * 26; const sign = srng() < 0.35 ? 1 : -1; const mag = 5 + srng() * 12; scratches.push({ x0: x, y0: y, x1: x + Math.cos(ang) * len, y1: y + Math.sin(ang) * len, delta: sign * mag }); }
  const frng = mulberry32(24601); const flecks = [];
  for (let i = 0; i < 340; i++) flecks.push({ x: Math.floor(frng() * W), y: Math.floor(frng() * H), rad: frng() < 0.7 ? 0 : 1, delta: (frng() < 0.5 ? 1 : -1) * (5 + frng() * 12) });
  const scratchMap = new Float32Array(W * H);
  const put = (x, y, d) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (Math.abs(d) > Math.abs(scratchMap[i])) scratchMap[i] = d; };
  for (const s of scratches) { const steps = Math.max(2, Math.hypot(s.x1 - s.x0, s.y1 - s.y0)); for (let k = 0; k <= steps; k++) { const t = k / steps; put(Math.round(s.x0 + (s.x1 - s.x0) * t), Math.round(s.y0 + (s.y1 - s.y0) * t), s.delta); } }
  for (const fl of flecks) { put(fl.x, fl.y, fl.delta); if (fl.rad) { put(fl.x + 1, fl.y, fl.delta); put(fl.x, fl.y + 1, fl.delta); put(fl.x + 1, fl.y + 1, fl.delta); } }
  // teal 渗漏（只在地面）
  const trng = mulberry32(1717); const tealMap = new Uint8Array(W * H);
  for (let i = 0; i < TEAL; i++) { let x = trng() * W, y = trng() * H, ang = trng() * Math.PI * 2; const seg = 8 + Math.floor(trng() * 10); for (let s = 0; s < seg; s++) { ang += (trng() - 0.5) * 1.1; x += Math.cos(ang) * 4; y += Math.sin(ang) * 4; const xi = Math.round(x), yi = Math.round(y); if (xi >= 0 && yi >= 0 && xi < W && yi < H && !wallPix[yi * W + xi]) tealMap[yi * W + xi] = 1; } }

  // 落影/AO：floor 像素向"北+西"回看，若近处有墙则压暗（高度感）
  const SHADOW_LEN = 14;
  function dropShadow(x, y) {
    // 北向落影（墙在上方 -> 影投在下方）
    let sh = 0;
    for (let s = 1; s <= SHADOW_LEN; s++) { const yy = y - s; if (yy < 0) break; if (wallPix[yy * W + x]) { sh = Math.max(sh, (1 - (s - 1) / SHADOW_LEN)); break; } }
    // 贴墙 AO（四邻更近的墙加深）
    let ao = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { for (let s = 1; s <= 4; s++) { const xx = x + dx * s, yy = y + dy * s; if (xx < 0 || yy < 0 || xx >= W || yy >= H) break; if (wallPix[yy * W + xx]) { ao = Math.max(ao, 1 - (s - 1) / 4); break; } } }
    return Math.min(1, sh * 0.7 + ao * 0.5);
  }

  const base = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; const r0 = Math.floor(y / T), c0 = Math.floor(x / T);
    let r, g, b;
    if (isDoor(r0, c0)) { r = 6; g = 7; b = 9; } // 门洞：近黑 void 口
    else if (wall[r0][c0]) {
      // 墙：冷暗材质 + grime。顶/底/侧沿明暗全部基于像素级墙 bitmap => 跨格连续，无 32px 分段
      const n = (fractal(x, y, 555) - 0.5) * 10;
      let bv = 23 + n; r = bv * 0.8; g = bv * 0.9; b = bv * 1.05;
      let dN = 1; while (dN <= 4 && y - dN >= 0 && wallPix[(y - dN) * W + x]) dN++;
      let dS = 1; while (dS <= 4 && y + dS < H && wallPix[(y + dS) * W + x]) dS++;
      const topRim = dN <= 3 ? (4 - dN) / 3 : 0;   // 距北侧非墙越近，顶沿高光越强
      const botShad = dS <= 3 ? (4 - dS) / 3 : 0;  // 距南侧非墙越近，底沿投影越深
      r += 24 * topRim; g += 26 * topRim; b += 28 * topRim;
      const sf = 1 - 0.55 * botShad; r *= sf; g *= sf; b *= sf;
      let dWl = 1; while (dWl <= 3 && x - dWl >= 0 && wallPix[y * W + x - dWl]) dWl++;
      let dEr = 1; while (dEr <= 3 && x + dEr < W && wallPix[y * W + x + dEr]) dEr++;
      const sideAO = Math.max(dWl <= 2 ? (3 - dWl) / 2 : 0, dEr <= 2 ? (3 - dEr) / 2 : 0);
      const af = 1 - 0.22 * sideAO; r *= af; g *= af; b *= af;
    } else {
      // 地面（同 floor.mjs）
      const grime = (fractal(x, y, 1) - 0.5) * 2 * GRIME;
      const macro = (vnoise(x, y, 1 / 210, 99) - 0.5) * 2 * MACRO;
      let bv = 26 * (1 + grime + macro);
      bv += scratchMap[y * W + x];
      bv *= (1 - dropShadow(x, y) * 0.6); // 墙体落影/AO
      r = bv * 0.82; g = bv * 0.92; b = bv * 1.05;
      const rust = fractal(x + 1000, y - 500, 7); if (rust > 0.72) { const k = (rust - 0.72) / 0.28 * 0.4; r = r + (0x2a - r) * k; g = g + (0x20 - g) * k; b = b + (0x18 - b) * k; }
      if (tealMap[y * W + x]) { r = 0x1a; g = 0x7a; b = 0x9a; }
    }
    if (DITHER) { const d = (hash2(x, y, 31337) - 0.5) * 12; r += d; g += d; b += d; }
    const q = nearest(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
    base[i] = q[0]; base[i + 1] = q[1]; base[i + 2] = q[2]; base[i + 3] = 255;
  }
  // 错误块
  const paintRect = (cx, cy, w, h, col) => { for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = (y * W + x) * 4; base[i] = col[0]; base[i + 1] = col[1]; base[i + 2] = col[2]; } };
  for (const [r, c, kind] of errors) { const ox = c * T, oy = r * T; if (kind === 'small') paintRect(ox + 12, oy + 10, 8, 6, [0x2a, 0xe6, 0xc8]); else { paintRect(ox + 6, oy + 8, 10, 8, [0x2a, 0xe6, 0xc8]); paintRect(ox + 17, oy + 12, 7, 9, [0x1a, 0xad, 0x96]); paintRect(ox + 9, oy + 18, 8, 7, [0x3c, 0xff, 0xd4]); } }

  // ---------- Darkwood 光照 ----------
  const PCOL = Number(arg('--pcol', '10')), PROW = Number(arg('--prow', '10')); const Ox = PCOL * T + T / 2, Oy = PROW * T + T / 2;
  function blocked(x, y) { const tc = Math.floor(x / T), tr = Math.floor(y / T); const dx = x - Ox, dy = y - Oy; const dist = Math.hypot(dx, dy); const steps = Math.max(2, Math.floor(dist / 4)); for (let s = 1; s < steps; s++) { const t = s / steps; const cc = Math.floor((Ox + dx * t) / T), rr = Math.floor((Oy + dy * t) / T); if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue; if ((rr === PROW && cc === PCOL) || (rr === tr && cc === tc)) continue; if (wall[rr][cc]) return true; } return false; }
  const grng = mulberry32(4242); const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; const dx = x + 0.5 - Ox, dy = y + 0.5 - Oy; const dist = Math.hypot(dx, dy); const off = shortestArc(Math.atan2(dy, dx) - FACING);
    let vis = visAt(dist, off); if (vis > 0 && dist > V.MIN && blocked(x + 0.5, y + 0.5)) vis = 0;
    let r = base[i], g = base[i + 1], b = base[i + 2];
    if (vis > 0 && BEAM > 1) { const th = Math.abs(shortestArc(off)); let ang; if (th <= V.CONE) ang = 1; else if (th >= V.CONE + V.FALL) ang = AMBLIT; else { const t = (th - V.CONE) / V.FALL; ang = 1 + (AMBLIT - 1) * (t * t * (3 - 2 * t)); } const range = effRadius(off); const rad = Math.max(0, 1 - dist / range); const radF = rad * rad * (3 - 2 * rad); const boost = 1 + (BEAM - 1) * ang * radF; r *= boost; g *= boost; b *= boost; const wk = BEAMWARM * ang * radF * 0.5; r = r + (V.LAMPC[0] - r) * wk; g = g + (V.LAMPC[1] - g) * wk; b = b + (V.LAMPC[2] - b) * wk; }
    if (vis > 0 && EDGETEAL > 0) { const range = effRadius(off); let ef = (dist / range - 0.55) / 0.45; ef = Math.max(0, Math.min(1, ef)); const k = EDGETEAL * ef * ef; r = r + (0x1a - r) * k; g = g + (0xad - g) * k; b = b + (0x96 - b) * k; }
    r = V.VOID[0] + (r - V.VOID[0]) * vis; g = V.VOID[1] + (g - V.VOID[1]) * vis; b = V.VOID[2] + (b - V.VOID[2]) * vis;
    if (LAMP > 0) { const ld = dist / (V.RA * 1.4); if (ld < 1) { const fall = (1 - ld) * (1 - ld); const add = 0.12 * LAMP * fall * 255; r += V.LAMPC[0] / 255 * add; g += V.LAMPC[1] / 255 * add; b += V.LAMPC[2] / 255 * add; } }
    if (GRAIN > 0) { const n = (grng() * 2 - 1) * GRAIN * 255 * (vis > 0 ? 0.7 : 0.35); r += n; g += n; b += n; }
    out[i] = Math.max(0, Math.min(255, r)); out[i + 1] = Math.max(0, Math.min(255, g)); out[i + 2] = Math.max(0, Math.min(255, b)); out[i + 3] = 255;
  }

  Promise.resolve().then(async () => {
    const pcomp = await sharp({ create: { width: 14, height: 14, channels: 4, background: { r: 200, g: 205, b: 212, alpha: 1 } } }).png().toBuffer();
    let img = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
    img = await sharp(img).composite([{ input: pcomp, top: Math.round(Oy - 7), left: Math.round(Ox - 7) }]).toBuffer();
    await sharp(img).resize(W * UP, H * UP, { kernel: 'nearest' }).png().toFile(join(DIR, `scene.${SUFFIX}.png`));
    await sharp(base, { raw: { width: W, height: H, channels: 4 } }).resize(W * UP, H * UP, { kernel: 'nearest' }).png().toFile(join(DIR, `scene-flat.${SUFFIX}.png`));
    console.log(`scene.${SUFFIX}.png + scene-flat.${SUFFIX}.png`);
  });
}
main();
