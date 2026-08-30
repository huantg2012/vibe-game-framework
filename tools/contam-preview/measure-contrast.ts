/**
 * I6-C: 污染四档 vs 该碎片对比度用地面主色，CIE76 ≥ 18，四张。
 * 地面主色 = I6-B `contrastFloorCell`（模拟 floorBv * bias，不加绘制器 +16）。
 * 四档 = 地面 `deriveContamRamp`（与地图课 / 出击同一份）。敌人 ramp 仍归 I6-D。
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { deriveContamRamp } from '@/generation/preview-paint';
import { contrastFloorCell, type Rgb } from '@/generation/palette-quantize';
import { deltaE76 } from '@/generation/cie76';
import type { ContaminationAge } from '@/generation/types';

function groundMain(id: string): Rgb {
  const def = RIFT_FRAGMENT_DATA[id]!;
  return contrastFloorCell(
    def.floorBv * def.floorBiasR,
    def.floorBv * def.floorBiasG,
    def.floorBv * def.floorBiasB,
  );
}

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library'] as const;
const AGES: readonly ContaminationAge[] = ['new', 'standard', 'ancient'];
const SEEDS = [0, 101];
const hex = (c: Rgb): string => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');

console.log('对比度 = CIE76 色差，地面崩坏簇四档 vs 该碎片对比度用地面主色');
console.log('门限：四档均 ≥ 18（I6-A / 硬要求 1）');
console.log('');

let failed = 0;
console.log('碎片'.padEnd(16), '年龄'.padEnd(10), '地面主色'.padEnd(10), '深    中    核    高光   最小值  判定');
for (const id of FRAGMENTS) {
  const def = RIFT_FRAGMENT_DATA[id];
  if (!def) {
    console.log(`${id.padEnd(16)} MISSING DEF`);
    failed += 1;
    continue;
  }
  const gm = groundMain(id);
  for (const age of AGES) {
    for (const seed of SEEDS) {
      const ramp = deriveContamRamp(def, age, seed);
      const ds = [ramp.deep, ramp.mid, ramp.core, ramp.glow].map((c) => deltaE76(c, gm));
      const min = Math.min(...ds);
      const pass = min >= 18;
      if (!pass) failed += 1;
      console.log(
        id.padEnd(16),
        `${age}@${seed}`.padEnd(10),
        hex(gm).padEnd(9),
        ds.map((d) => d.toFixed(1).padStart(5)).join(' '),
        `  ${min.toFixed(1).padStart(5)}  ${pass ? 'PASS' : 'FAIL'}`,
      );
    }
  }
}

if (failed > 0) {
  console.log(`\nFAIL: ${failed} 组低于 18`);
  process.exit(1);
}
console.log('\nPASS: 四张 × 三年龄 × 两种子，四档均 ≥ 18');
