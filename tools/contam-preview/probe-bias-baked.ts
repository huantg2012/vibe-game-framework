/**
 * 一次性探针：把 I6-A 修正后的偏置写进内存，烤**真实地面**，统计可走地板像素众数，
 * 核实四张启用碎片是否互不相同——这正是 I6-E 闸门要断言的那个量。
 * 只在内存改，不动 data/ 与 src/。旧图书馆一并在内存里启用。
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { generateRuins } from '@/generation/ruins';
import { paintRuinedMask } from '@/generation/preview-paint';

interface Patch {
  readonly id: string;
  readonly label: string;
  readonly floor?: readonly [number, number, number];
  readonly wall?: readonly [number, number, number];
  readonly enable?: boolean;
}

/** I6-A 修正后的建议值。户外与医院不动。 */
const PATCHES: readonly Patch[] = [
  { id: 'frag-outdoor', label: '户外土壤 / 土（不动）' },
  { id: 'frag-clinic', label: '医院实验室 / 瓷砖（不动）' },
  { id: 'frag-metro', label: '地铁工业 / 金属', floor: [1.14, 0.87, 0.65] },
  { id: 'frag-library', label: '旧图书馆 / 木', floor: [1.02, 0.94, 0.7], wall: [1.02, 0.93, 0.68], enable: true },
];

const SEEDS = [101, 404, 707];
const T = 16;

function apply(p: Patch): void {
  const row = RIFT_FRAGMENT_DATA[p.id] as unknown as Record<string, number | boolean>;
  if (!row) throw new Error(`unknown ${p.id}`);
  if (p.floor) {
    row.floorBiasR = p.floor[0];
    row.floorBiasG = p.floor[1];
    row.floorBiasB = p.floor[2];
  }
  if (p.wall) {
    row.wallBiasR = p.wall[0];
    row.wallBiasG = p.wall[1];
    row.wallBiasB = p.wall[2];
  }
  if (p.enable) row.enabled = true;
}

function floorMode(id: string, seed: number): { mode: string; pct: number; mean: number } {
  const mask = generateRuins(seed, id);
  const painted = paintRuinedMask(mask, T);
  const cols = mask.outline.cols;
  const hist = new Map<string, number>();
  let n = 0;
  let sum = 0;
  for (let y = 0; y < painted.height; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < painted.width; x++) {
      const col = (x / T) | 0;
      const idx = row * cols + col;
      // 只统计可走地板，排除墙与图外
      if (!mask.outline.land[idx] || mask.walls[idx]) continue;
      const i = (y * painted.width + x) * 4;
      const r = painted.rgba[i] ?? 0;
      const g = painted.rgba[i + 1] ?? 0;
      const b = painted.rgba[i + 2] ?? 0;
      const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      hist.set(hex, (hist.get(hex) ?? 0) + 1);
      sum += (r + g + b) / 3;
      n += 1;
    }
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { mode: top[0], pct: (top[1] / n) * 100, mean: sum / n };
}

for (const p of PATCHES) apply(p);

console.log('真实烤图的可走地板众数（I6-E 闸门要断言的量），三个种子');
console.log('碎片'.padEnd(24), '种子101'.padEnd(20), '种子404'.padEnd(20), '种子707'.padEnd(20), '平均亮度');
const perFragment = new Map<string, string>();
for (const p of PATCHES) {
  const rows = SEEDS.map((s) => floorMode(p.id, s));
  const modes = rows.map((r) => `${r.mode} ${r.pct.toFixed(0)}%`);
  const meanLum = rows.reduce((a, r) => a + r.mean, 0) / rows.length;
  console.log(
    p.label.padEnd(24),
    modes.map((m) => m.padEnd(19)).join(' '),
    meanLum.toFixed(1),
  );
  perFragment.set(p.id, rows[1]!.mode);
}

console.log('');
console.log('闸门判定：四张启用碎片的地板众数是否互不相同（取种子 404）');
const byMode = new Map<string, string[]>();
for (const [id, mode] of perFragment) {
  byMode.set(mode, [...(byMode.get(mode) ?? []), id]);
}
let collide = false;
for (const [mode, ids] of byMode) {
  if (ids.length > 1) collide = true;
  console.log(`  ${mode}  ← ${ids.join(' , ')}${ids.length > 1 ? '   ⚠ 撞格' : ''}`);
}
console.log(collide ? '结论：仍有撞格，闸门 FAIL' : `结论：${byMode.size} 张落 ${byMode.size} 个不同众数，闸门 PASS`);

// ---------------------------------------------------------------------------
// 众数格不可达时，换一个可能可达的量：色温倾向（暖 / 冷 / 橄榄像素各占多少）。
// 若这个量能分开四张，闸门就该断言它，而不是断言量化后的众数格。
console.log('');
console.log('换一个量：可走地板的色温倾向分布（不看落到哪个格，看像素本身偏暖还是偏冷）');
console.log('碎片'.padEnd(24), '暖'.padEnd(8), '冷'.padEnd(8), '橄榄'.padEnd(8), '中性'.padEnd(8), '暖减冷');

function tempMix(id: string, seed: number): { warm: number; cool: number; olive: number; neutral: number } {
  const mask = generateRuins(seed, id);
  const painted = paintRuinedMask(mask, T);
  const cols = mask.outline.cols;
  let warm = 0;
  let cool = 0;
  let olive = 0;
  let neutral = 0;
  let n = 0;
  for (let y = 0; y < painted.height; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < painted.width; x++) {
      const col = (x / T) | 0;
      const idx = row * cols + col;
      if (!mask.outline.land[idx] || mask.walls[idx]) continue;
      const i = (y * painted.width + x) * 4;
      const r = painted.rgba[i] ?? 0;
      const g = painted.rgba[i + 1] ?? 0;
      const b = painted.rgba[i + 2] ?? 0;
      if (r - b >= 3) warm += 1;
      else if (b - r >= 3) cool += 1;
      else if (g >= r + 2 && g >= b + 2) olive += 1;
      else neutral += 1;
      n += 1;
    }
  }
  return { warm: (warm / n) * 100, cool: (cool / n) * 100, olive: (olive / n) * 100, neutral: (neutral / n) * 100 };
}

for (const p of PATCHES) {
  const rows = SEEDS.map((s) => tempMix(p.id, s));
  const avg = (k: 'warm' | 'cool' | 'olive' | 'neutral'): number =>
    rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const w = avg('warm');
  const c = avg('cool');
  console.log(
    p.label.padEnd(24),
    `${w.toFixed(1)}%`.padEnd(8),
    `${c.toFixed(1)}%`.padEnd(8),
    `${avg('olive').toFixed(1)}%`.padEnd(8),
    `${avg('neutral').toFixed(1)}%`.padEnd(8),
    `${(w - c >= 0 ? '+' : '') + (w - c).toFixed(1)}`,
  );
}
