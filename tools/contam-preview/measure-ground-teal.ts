/**
 * 地面污染簇的青绿家族像素占比，按 碎片 × contaminationAge 全扫。
 * 目的：确认「ramp 塌成 metal-grey」是不是所有年龄档都成立，还是只在 standard。
 * 走的是出击同一条 generateRuins → paintRuinedMask 路径。
 */

import { generateRuins } from '@/generation/ruins';
import { paintRuinedMask } from '@/generation/preview-paint';

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro'] as const;
const AGES = ['new', 'standard', 'ancient'] as const;
const SEEDS = [101, 404, 707];

const TEAL_FAMILY = new Set([
  '#0e4a3f',
  '#1a6b5c',
  '#1aad96',
  '#2ae6c8',
  '#3cffd4',
  '#7fffee',
  '#b0fff5',
  '#4adf8a',
  '#1a7a9a',
]);

function tealPct(fragmentTypeId: string, age: string, seed: number): number {
  const mask = generateRuins(seed, fragmentTypeId);
  const painted = paintRuinedMask({ ...mask, contaminationAge: age } as typeof mask, 16);
  let teal = 0;
  const n = painted.width * painted.height;
  for (let i = 0; i < n; i++) {
    const hex =
      '#' +
      [painted.rgba[i * 4]!, painted.rgba[i * 4 + 1]!, painted.rgba[i * 4 + 2]!]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
    if (TEAL_FAMILY.has(hex)) teal += 1;
  }
  return (teal / n) * 100;
}

console.log('地面青绿家族像素占比 (%)，三个种子取平均');
console.log('fragment'.padEnd(18), AGES.map((a) => a.padStart(10)).join(''));
for (const f of FRAGMENTS) {
  const cells = AGES.map((age) => {
    const vals = SEEDS.map((s) => tealPct(f, age, s));
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2).padStart(10);
  });
  console.log(f.padEnd(18), cells.join(''));
}
