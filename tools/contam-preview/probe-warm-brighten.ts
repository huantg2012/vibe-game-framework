/**
 * 一次性探针：核实 I6-A 的偏置建议是否绕过了「不整体提亮」这条否决，
 * 以及「组内取最近色」在暖组里能不能真的分开三张暖世界。
 *
 * 关键：地面**实际画出来的像素**走 preview-paint.ts:1800/1811 那条路
 *   bv = floor_bv * (1 + 噪声) + 16 ；然后 r/g/b = bv * floor_bias
 * 而配色推导（:1013）走的是 floor_bv * floor_bias（没有 +16）。
 * 两处不是同一个量，只对第二处推理会漏掉画面变亮。
 */

type Rgb = readonly [number, number, number];

const PALETTE_HEX = [
  '#080a0c', '#0a0b0d', '#0d1114', '#151a1e', '#2a2420', '#1e2228', '#2a2018', '#24221e',
  '#1a1e18', '#2c2e33', '#3a3d42', '#4a4e55', '#5a5f66', '#8a5c2a', '#c4873a', '#1a7a9a',
  '#0e4a3f', '#1a6b5c', '#1aad96', '#2ae6c8', '#3cffd4', '#7fffee', '#4adf8a', '#b0fff5',
  '#e0a848', '#2e2d30', '#2a2a2e', '#3a3838', '#1a1c1f', '#2a1f1c', '#8a8f96', '#c8cdd4',
  '#cc3333', '#b89040', '#2a2d32', '#0f1114',
] as const;

const PALETTE = PALETTE_HEX.map((h) => ({
  hex: h,
  rgb: [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as Rgb,
}));

function group(rgb: Rgb): string {
  const [r, g, b] = rgb;
  if (r - b >= 6) return 'WARM';
  if (b - r >= 6) return 'COOL';
  if (g >= r + 2 && g >= b + 2) return 'OLIVE';
  return 'NEUTRAL';
}

function lum(rgb: Rgb): number {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}

function d2(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function nearest(target: Rgb, pool: readonly Rgb[]): Rgb {
  let best = pool[0]!;
  let bd = Infinity;
  for (const p of pool) {
    const d = d2(p, target);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** 单位化到平均亮度 1，只留色相/色度方向。 */
function direction(rgb: Rgb): Rgb {
  const l = Math.max(1e-6, lum(rgb));
  return [rgb[0] / l, rgb[1] / l, rgb[2] / l];
}

function dirDist(a: Rgb, b: Rgb): number {
  const da = direction(a);
  const db = direction(b);
  return Math.hypot(da[0] - db[0], da[1] - db[1], da[2] - db[2]);
}

const hex = (c: Rgb): string => '#' + c.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');

interface Row {
  readonly id: string;
  readonly bv: number;
  readonly cur: Rgb;
  readonly proposed: Rgb | null;
}

const ROWS: readonly Row[] = [
  { id: '地铁工业', bv: 24, cur: [1.08, 0.86, 0.72], proposed: null },
  { id: '旧图书馆', bv: 26, cur: [1.08, 0.86, 0.72], proposed: [1.62, 1.38, 1.23] },
  { id: '居民区公寓', bv: 28, cur: [1.08, 0.86, 0.72], proposed: [1.02, 0.96, 0.8] },
];

console.log('一、实际画出来的地面像素亮度（bv = floor_bv + 16，再乘偏置；不含噪声）');
console.log('碎片'.padEnd(14), '现行画面'.padEnd(26), '建议值画面'.padEnd(26), '亮度变化');
for (const r of ROWS) {
  const bvPaint = r.bv + 16;
  const now: Rgb = [bvPaint * r.cur[0], bvPaint * r.cur[1], bvPaint * r.cur[2]];
  const nowQ = nearest(now, PALETTE.map((p) => p.rgb));
  if (!r.proposed) {
    console.log(
      r.id.padEnd(14),
      `rgb(${now.map((v) => v.toFixed(0)).join(',')}) → ${hex(nowQ)} lum ${lum(nowQ).toFixed(0)}`.padEnd(26),
      '（不动）'.padEnd(24),
      '—',
    );
    continue;
  }
  const nxt: Rgb = [bvPaint * r.proposed[0], bvPaint * r.proposed[1], bvPaint * r.proposed[2]];
  const nxtQ = nearest(nxt, PALETTE.map((p) => p.rgb));
  const pct = ((lum(nxt) / lum(now) - 1) * 100).toFixed(0);
  console.log(
    r.id.padEnd(14),
    `rgb(${now.map((v) => v.toFixed(0)).join(',')}) → ${hex(nowQ)} lum ${lum(nowQ).toFixed(0)}`.padEnd(26),
    `rgb(${nxt.map((v) => v.toFixed(0)).join(',')}) → ${hex(nxtQ)} lum ${lum(nxtQ).toFixed(0)}`.padEnd(26),
    `+${pct}%`,
  );
}

console.log('');
console.log('二、若只改色相方向、不改亮度量级（三张各自的偏置平均值保持现行 0.887）');
const warmPool = PALETTE.filter((p) => group(p.rgb) === 'WARM');
console.log('   暖格：', warmPool.map((p) => `${p.hex}(lum ${lum(p.rgb).toFixed(0)})`).join('  '));
console.log('');
const HUE_ONLY: readonly { id: string; bv: number; bias: Rgb }[] = [
  { id: '地铁工业（红褐）', bv: 24, bias: [1.12, 0.84, 0.70] },
  { id: '旧图书馆（黄褐）', bv: 26, bias: [1.02, 0.94, 0.70] },
  { id: '居民区公寓（灰褐）', bv: 28, bias: [0.98, 0.90, 0.78] },
];
for (const r of HUE_ONLY) {
  const target: Rgb = [r.bv * r.bias[0], r.bv * r.bias[1], r.bv * r.bias[2]];
  const byRgb = nearest(target, warmPool.map((p) => p.rgb));
  let byDir = warmPool[0]!.rgb;
  let bd = Infinity;
  for (const p of warmPool) {
    const d = dirDist(p.rgb, target);
    if (d < bd) {
      bd = d;
      byDir = p.rgb;
    }
  }
  console.log(
    `${r.id.padEnd(20)} 目标 rgb(${target.map((v) => v.toFixed(1)).join(',')}) lum ${lum(target).toFixed(1)}` +
      `   按 RGB 距离 → ${hex(byRgb)}   按色相方向 → ${hex(byDir)}`,
  );
}
