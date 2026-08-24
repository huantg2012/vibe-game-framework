/**
 * 一次性探针：核实 I6-A 补充节提出的偏置建议值是否真的落到各自指定的暖格，
 * 以及离色温组判据边界有多近（余量太小 = 将来微调就掉出暖组）。
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

function d2(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

interface Proposal {
  readonly id: string;
  readonly bv: number;
  readonly bias: Rgb;
  readonly want: string;
  readonly enabled: boolean;
}

const PROPOSALS: readonly Proposal[] = [
  { id: '户外土壤（不动）', bv: 26, bias: [0.88, 1.02, 0.82], want: '#1a1e18', enabled: true },
  { id: '医院实验室（不动）', bv: 28, bias: [0.86, 0.92, 1.08], want: '#151a1e', enabled: true },
  { id: '地铁工业（不动）', bv: 24, bias: [1.08, 0.86, 0.72], want: '#2a2018', enabled: true },
  { id: '旧图书馆（I6-A 新值）', bv: 26, bias: [1.62, 1.38, 1.23], want: '#2a2420', enabled: true },
  { id: '居民区公寓（I6-A 新值）', bv: 28, bias: [1.02, 0.96, 0.8], want: '#24221e', enabled: false },
];

const landed = new Map<string, string[]>();

for (const p of PROPOSALS) {
  const target: Rgb = [p.bv * p.bias[0], p.bv * p.bias[1], p.bv * p.bias[2]];
  const g = group(target);
  const cands = PALETTE.filter((c) => group(c.rgb) === g)
    .map((c) => ({ ...c, d: d2(c.rgb, target) }))
    .sort((a, b) => a.d - b.d);
  const got = cands[0]?.hex ?? '无';
  const runnerUp = cands[1];
  // 色温余量：离判据阈值 6 还有多远
  const warmMargin = target[0] - target[2] - 6;
  const ok = got === p.want;
  console.log(
    `${p.id.padEnd(22)} 目标 rgb(${target.map((v) => v.toFixed(1)).join(',')})`.padEnd(58) +
      ` 组=${g.padEnd(8)} 落格 ${got} ${ok ? '✓' : `✗ 期望 ${p.want}`}`,
  );
  console.log(
    `  第二名 ${runnerUp ? `${runnerUp.hex}(差 ${(runnerUp.d - (cands[0]?.d ?? 0)).toFixed(0)})` : '无'}` +
      `   暖判据余量 ${warmMargin >= 0 ? '+' : ''}${warmMargin.toFixed(1)}${warmMargin >= 0 && warmMargin < 2 ? '  ⚠ 余量小于 2，微调易掉组' : ''}`,
  );
  if (p.enabled) landed.set(got, [...(landed.get(got) ?? []), p.id]);
}

console.log('');
console.log('四张启用碎片的第一层落格是否互不相同（I6-E 闸门断言）');
let collide = false;
for (const [hex, ids] of landed) {
  if (ids.length > 1) collide = true;
  console.log(`  ${hex}  ← ${ids.join(' , ')}${ids.length > 1 ? '   ⚠ 撞格' : ''}`);
}
console.log(collide ? '结论：仍有撞格，闸门会 FAIL' : `结论：${landed.size} 张启用碎片落 ${landed.size} 个不同格，闸门 PASS`);
