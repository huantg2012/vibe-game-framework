/**
 * 一次性探针：色温分组量化之后，两张偏暖的碎片会不会落到同一个暖格。
 * I6-A 报告里把这条列为遗留问题，这里算实数据核实。
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';

const PALETTE_HEX = [
  '#080a0c', '#0a0b0d', '#0d1114', '#151a1e', '#2a2420', '#1e2228', '#2a2018', '#24221e',
  '#1a1e18', '#2c2e33', '#3a3d42', '#4a4e55', '#5a5f66', '#8a5c2a', '#c4873a', '#1a7a9a',
  '#0e4a3f', '#1a6b5c', '#1aad96', '#2ae6c8', '#3cffd4', '#7fffee', '#4adf8a', '#b0fff5',
  '#e0a848', '#2e2d30', '#2a2a2e', '#3a3838', '#1a1c1f', '#2a1f1c', '#8a8f96', '#c8cdd4',
  '#cc3333', '#b89040', '#2a2d32', '#0f1114',
] as const;

type Rgb = readonly [number, number, number];
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

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library', 'frag-residential'];

console.log('按 I6-A 的口径：先定色温组，再在组内取最近色');
console.log('');
for (const id of FRAGMENTS) {
  const def = RIFT_FRAGMENT_DATA[id];
  if (!def) continue;
  const target: Rgb = [def.floorBv * def.floorBiasR, def.floorBv * def.floorBiasG, def.floorBv * def.floorBiasB];
  const g = group(target);
  const inGroup = PALETTE.filter((p) => group(p.rgb) === g)
    .map((p) => ({ ...p, d: d2(p.rgb, target) }))
    .sort((a, b) => a.d - b.d);
  console.log(
    `${id.padEnd(18)} enabled=${String(def.enabled).padEnd(5)} 组=${g.padEnd(8)} 组内候选 ` +
      inGroup.slice(0, 4).map((p) => `${p.hex}(d=${p.d.toFixed(0)})`).join('  '),
  );
  console.log(`  → 落格 ${inGroup[0]?.hex ?? '无'}   stain_key=${def.stainKey}`);
}

console.log('');
console.log('结论检查：四张启用碎片（含旧图书馆）的落格是否互不相同');
const landed = new Map<string, string[]>();
for (const id of ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library']) {
  const def = RIFT_FRAGMENT_DATA[id]!;
  const target: Rgb = [def.floorBv * def.floorBiasR, def.floorBv * def.floorBiasG, def.floorBv * def.floorBiasB];
  const g = group(target);
  const best = PALETTE.filter((p) => group(p.rgb) === g)
    .map((p) => ({ ...p, d: d2(p.rgb, target) }))
    .sort((a, b) => a.d - b.d)[0];
  const hex = best?.hex ?? '无';
  landed.set(hex, [...(landed.get(hex) ?? []), id]);
}
for (const [hex, ids] of landed) {
  console.log(`  ${hex}  ← ${ids.join(' , ')}${ids.length > 1 ? '   ⚠ 撞格' : ''}`);
}
