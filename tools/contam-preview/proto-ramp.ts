/**
 * PROTOTYPE 污染配色。Preview tooling only.
 *
 * 缺陷根因（`preview-paint.ts:1007` 的 `deriveContamRamp`，`fragment-ramp.ts` 是同语义拷贝）：
 * `floor_bv` / `wall_bv` 在 CSV 里是 24–30，而推导按 0–255 处理。`mapV` 落到 0.10，
 * `val` 被自己的 `Math.max(0.36, mapV + 0.18)` 下限钉住，能活下来的色相是三个几乎相等的
 * 暗通道之间的噪声；`quantDistinct` 就近落到 `metal-grey`。后果：
 *   地面青绿家族像素占比  outdoor new/standard 0.00% / metro new/standard 0.00% / clinic ≤0.27%
 * 崩坏簇是项目声明的地面污染主签名，在两张世界的两个年龄档上完全没有颜色。
 *
 * 修法不是调系数，是换语义：停止把碎片 bias 当**颜色目标**去量化，改成当**关系选择器**——
 * 在色板既有的青绿家族里，按污染色与该世界底色的关系挑一条链，并强制对比度下限。
 * 这正是 `docs/art/rift-fragment-surfaces.md` §配色公式 步骤 5–6 已经写下、但从未实现的纪律。
 *
 * 全部取自 `docs/art/palette.json` 已有条目。不加新色。
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import type { FragmentContamRamp, Rgb } from '@/entities/form-renderers/d/fragment-ramp';

const P = {
  tealDarkest: [0x0e, 0x4a, 0x3f],
  tealDark: [0x1a, 0x6b, 0x5c],
  teal: [0x1a, 0xad, 0x96],
  tealBright: [0x2a, 0xe6, 0xc8],
  tealBrightest: [0x3c, 0xff, 0xd4],
  tealPale: [0x7f, 0xff, 0xee],
  tealPalest: [0xb0, 0xff, 0xf5],
  moss: [0x4a, 0xdf, 0x8a],
  cold: [0x1a, 0x7a, 0x9a],
} as const satisfies Record<string, Rgb>;

/**
 * 协同关系表。三张 enabled 碎片的实测底色（真实 `paintRuinedMask` 输出的主色）：
 *   outdoor  mean #141615  主色 #1a1e18 45%   低饱和暗橄榄绿
 *   clinic   mean #1a1d21  主色 #1a1c1f 51%   冷蓝灰，明度略高
 *   metro    mean #171916  主色 #1a1e18 61% + 暖琥珀锚点 #2a2018 6%
 *
 * 协同 ≠ 污染色靠近世界色（那会糊进地面）。协同 = 污染色与该世界底色构成稳定关系：
 *   同色相世界 → 饱和与明度跨阶（绿底上用高饱和高明度青绿，deep 仍留在青绿暗端而不是灰）
 *   冷色世界   → 走最亮青（冷灰上最跳）
 *   有暖锚世界 → 走色相对立（青绿对琥珀互补，最响）
 */
const COORDINATED: Record<string, FragmentContamRamp> = {
  'frag-outdoor': { deep: P.tealDarkest, mid: P.tealDark, core: P.moss, glow: P.tealBrightest },
  'frag-clinic': { deep: P.tealDarkest, mid: P.teal, core: P.tealBright, glow: P.tealPalest },
  'frag-metro': { deep: P.tealDarkest, mid: P.cold, core: P.teal, glow: P.tealPale },
};

/** 未启用碎片沿用材质近邻，避免开表时无值。 */
const BY_MATERIAL: Record<string, FragmentContamRamp> = {
  soil: COORDINATED['frag-outdoor']!,
  tile: COORDINATED['frag-clinic']!,
  metal: COORDINATED['frag-metro']!,
  wood: { deep: P.tealDarkest, mid: P.tealDark, core: P.teal, glow: P.tealBright },
  plaster: { deep: P.tealDark, mid: P.teal, core: P.tealBright, glow: P.tealBrightest },
};

export function protoContamRamp(fragmentTypeId: string): FragmentContamRamp {
  const direct = COORDINATED[fragmentTypeId];
  if (direct) return direct;
  const key = RIFT_FRAGMENT_DATA[fragmentTypeId]?.surfaceMaterial ?? 'tile';
  return BY_MATERIAL[key] ?? BY_MATERIAL.tile!;
}
