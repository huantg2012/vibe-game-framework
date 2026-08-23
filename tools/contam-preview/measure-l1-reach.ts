/**
 * L1 碎片记忆色的可达集测量。
 *
 * `art-direction.md` §1.2 规则 3 与规则 6：碎片身份靠 L1 底色色温承担，污染色谱只在
 * teal 内偏移、不承担碎片身份。所以「不同世界看起来是同一个世界」应该是 L1 的问题。
 *
 * 本脚本算的是：每张碎片的目标底色，以及色板里离它最近的几个条目。
 * 如果可达集全是中性暗色，那么 CSV 里的暖/冷 bias 无论怎么写都到不了色板的有色暗格。
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
const PALETTE: readonly { hex: string; rgb: Rgb }[] = PALETTE_HEX.map((h) => ({
  hex: h,
  rgb: [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as Rgb,
}));

/** 色温读法：R 明显高于 B 为暖，B 明显高于 R 为冷，G 领先为橄榄，其余中性。 */
function temperature(rgb: Rgb): string {
  const [r, g, b] = rgb;
  if (r - b >= 6) return 'WARM';
  if (b - r >= 6) return 'COOL';
  if (g >= r + 2 && g >= b + 2) return 'OLIVE';
  return 'NEUTRAL';
}

function dist2(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library', 'frag-residential'];

console.log('色板里的有色暗格（碎片身份本该落在这些格子上）：');
for (const p of PALETTE) {
  const lum = (p.rgb[0] + p.rgb[1] + p.rgb[2]) / 3;
  if (lum > 55) continue;
  const t = temperature(p.rgb);
  if (t === 'NEUTRAL') continue;
  console.log(`  ${p.hex}  lum ${lum.toFixed(0).padStart(2)}  ${t}`);
}

console.log('');
for (const id of FRAGMENTS) {
  const def = RIFT_FRAGMENT_DATA[id];
  if (!def) continue;
  const floor: Rgb = [def.floorBv * def.floorBiasR, def.floorBv * def.floorBiasG, def.floorBv * def.floorBiasB];
  const near = [...PALETTE]
    .map((p) => ({ ...p, d: dist2(p.rgb, floor) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
  const target = `rgb(${floor.map((v) => v.toFixed(0)).join(',')})`;
  console.log(
    `${id.padEnd(18)} enabled=${String(def.enabled).padEnd(5)} bv=${def.floorBv} bias=(${def.floorBiasR},${def.floorBiasG},${def.floorBiasB})`,
  );
  console.log(`  目标 ${target.padEnd(18)} 意图色温 ${temperature(floor as Rgb)}`);
  console.log(
    '  可达前四 ' +
      near.map((p) => `${p.hex}(${temperature(p.rgb)},d=${p.d.toFixed(0)})`).join('  '),
  );
}
