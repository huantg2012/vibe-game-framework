/**
 * 核实 I6-A 的对比度草案阈值（CIE76 色差 ≥ 18）是不是一个有意义的门限。
 * 量三组：现行生产 ramp、原型协同 ramp、以及色板青绿家族各档，对四张碎片的地面主色。
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { deriveFragmentContamRamp } from '@/entities/form-renderers/d/fragment-ramp';
import { protoContamRamp } from './proto-ramp';

type Rgb = readonly [number, number, number];

const PALETTE_HEX = [
  '#080a0c', '#0a0b0d', '#0d1114', '#151a1e', '#2a2420', '#1e2228', '#2a2018', '#24221e',
  '#1a1e18', '#2c2e33', '#3a3d42', '#4a4e55', '#5a5f66', '#8a5c2a', '#c4873a', '#1a7a9a',
  '#0e4a3f', '#1a6b5c', '#1aad96', '#2ae6c8', '#3cffd4', '#7fffee', '#4adf8a', '#b0fff5',
  '#e0a848', '#2e2d30', '#2a2a2e', '#3a3838', '#1a1c1f', '#2a1f1c', '#8a8f96', '#c8cdd4',
  '#cc3333', '#b89040', '#2a2d32', '#0f1114',
] as const;

function hexRgb(h: string): Rgb {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function srgbLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function labOf(rgb: Rgb): [number, number, number] {
  const r = srgbLinear(rgb[0]);
  const g = srgbLinear(rgb[1]);
  const b = srgbLinear(rgb[2]);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE76(a: Rgb, b: Rgb): number {
  const la = labOf(a);
  const lb = labOf(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** 色温分组量化：与 I6-A 定稿口径、measure:l1-reach 同构。 */
function group(rgb: Rgb): string {
  const [r, g, b] = rgb;
  if (r - b >= 6) return 'WARM';
  if (b - r >= 6) return 'COOL';
  if (g >= r + 2 && g >= b + 2) return 'OLIVE';
  return 'NEUTRAL';
}

function groundMain(id: string): Rgb {
  const def = RIFT_FRAGMENT_DATA[id]!;
  const target: Rgb = [def.floorBv * def.floorBiasR, def.floorBv * def.floorBiasG, def.floorBv * def.floorBiasB];
  const g = group(target);
  const cands = PALETTE_HEX.map(hexRgb).filter((p) => group(p) === g);
  let best = cands[0]!;
  let bd = Infinity;
  for (const p of cands) {
    const d = (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2 + (p[2] - target[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library'];
const hex = (c: Rgb): string => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');

console.log('对比度 = CIE76 色差，污染四档 vs 该碎片地面主色（色温分组量化后的落格）');
console.log('I6-A 草案门限：四档均 ≥ 18');
console.log('');
console.log('碎片'.padEnd(18), '地面主色'.padEnd(10), '深    中    核    高光   最小值  草案判定');
for (const id of FRAGMENTS) {
  const gm = groundMain(id);
  for (const [label, ramp] of [
    ['现行生产', deriveFragmentContamRamp(id)],
    ['原型协同', protoContamRamp(id)],
  ] as const) {
    const ds = [ramp.deep, ramp.mid, ramp.core, ramp.glow].map((c) => deltaE76(c, gm));
    const min = Math.min(...ds);
    console.log(
      `${(id + ' ' + label).padEnd(24)}`,
      hex(gm).padEnd(9),
      ds.map((d) => d.toFixed(1).padStart(5)).join(' '),
      `  ${min.toFixed(1).padStart(5)}  ${min >= 18 ? 'PASS' : 'FAIL'}`,
    );
  }
}

console.log('');
console.log('色板青绿家族各档对最暗地面主色的色差（看 18 这个门限卡在哪）');
const darkest = groundMain('frag-clinic');
for (const h of ['#0e4a3f', '#1a6b5c', '#1a7a9a', '#1aad96', '#4adf8a', '#2ae6c8', '#3cffd4', '#7fffee', '#b0fff5']) {
  console.log(`  ${h}  vs ${hex(darkest)}  色差 ${deltaE76(hexRgb(h), darkest).toFixed(1)}`);
}
