/**
 * CIE76 ΔE*ab (iteration 6 I6-A / I6-E). Shared by floor-contrast and loot-pile gates.
 * sRGB 8-bit → linear → XYZ D65 → Lab → Euclidean. Do not copy a second implementation.
 */

import type { Rgb } from '@/generation/palette-quantize';

function srgbLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function labOf(rgb: Rgb): [number, number, number] {
  const r = srgbLinear(rgb[0]);
  const g = srgbLinear(rgb[1]);
  const b = srgbLinear(rgb[2]);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1.0;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a: Rgb, b: Rgb): number {
  const la = labOf(a);
  const lb = labOf(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

export function meanRgb(rgb: Rgb): number {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}
