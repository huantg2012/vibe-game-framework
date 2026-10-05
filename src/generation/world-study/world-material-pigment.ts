/** Worker-only material mapping. Source brush values survive continuous ramps;
 * world identity changes material pigment, never lights or tactical geometry. */
import type { R100WorldAppearance, WorldMaterialRamp } from '@/generation/world-study/r100-world-appearance';
import { materialNoise } from './material-noise';
type PaintedSurface = { readonly pixels: Uint8ClampedArray };
export type WorldAppearanceRole = 'ground' | 'solid' | 'cleaved';
export interface WorldAppearanceField { secondary: number; tone: number; detail: number }
export interface PaintedToneRange { readonly low: number; readonly mid: number; readonly high: number }
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
const luminance = (r: number, g: number, b: number): number => r * .2126 + g * .7152 + b * .0722;
/** The distribution is prepared once per source, not per world pixel. An actual
 * painted shadow remains below the median and a brush highlight above it. */
export function paintedToneRange(surface: PaintedSurface): PaintedToneRange {
  const histogram = new Uint32Array(256), pixels = surface.pixels;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    if (!pixels[index + 3]) continue;
    const bin = Math.round(luminance(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!));
    histogram[bin] = histogram[bin]! + 1; count++;
  }
  const percentile = (fraction: number): number => {
    let sum = 0;
    for (let index = 0; index < 256; index++) { sum += histogram[index]!; if (sum >= count * fraction) return index; }
    return 255;
  };
  const mid = Math.max(1, Math.min(254, percentile(.5)));
  return { low: Math.min(mid - 1, percentile(.015)), mid, high: Math.max(mid + 1, percentile(.985)) };
}
/** Distinct medium-scale organizations use the world's existing structural axis.
 * These masks select material zones; they do not add fake cracks or obstacles. */
export function sampleWorldAppearance(appearance: R100WorldAppearance, u: number, v: number, seed: number, out: WorldAppearanceField): void {
  const scale = appearance.patternScale, x = u / scale, y = v / scale;
  const broad = materialNoise(x * .71, y * .83, seed ^ 0x3859);
  // Two-dimensional domain bending prevents constant-pitch bands or a straight
  // cut across the viewport. Every material bed has a finite along-axis extent.
  const wx = x + (materialNoise(x * .93, y * .81, seed ^ 0x4721) - .5) * 1.7;
  const wy = y + (materialNoise(x * .86, y * 1.07, seed ^ 0x2159) - .5) * 1.9;
  let structure = broad;
  switch (appearance.groundPattern) {
    case 'strata': structure = materialNoise(wx * .74, wy * 1.7, seed ^ 0x7183); break;
    case 'veins': structure = materialNoise(wx * .81, wy * 2.3, seed ^ 0x4297); break;
    case 'plates': structure = materialNoise(wx * 1.35, wy * 1.1, seed ^ 0x6821); break;
    case 'grains': structure = materialNoise(wx * 2.1, wy * 1.7, seed ^ 0x1937) * .74 + broad * .26; break;
    case 'tension': structure = materialNoise(wx * 1.15, wy * .83, seed ^ 0x5713); break;
    case 'flow': structure = materialNoise(wx * .83, wy * 1.6, seed ^ 0x9531); break;
  }
  const organized = clamp((structure - .16) / .68);
  const threshold = 1 - appearance.secondaryCoverage;
  out.secondary = appearance.secondaryCoverage === 0 ? 0 : smooth((organized - threshold + .13) / .26);
  out.tone = (structure - .5) * appearance.patternStrength * .22;
  const quiet = smooth((appearance.quietCoverage - broad + .12) / .24);
  out.detail = appearance.textureContrast * (1 - quiet * .48);
}
function rampChannel(ramp: WorldMaterialRamp, tone: number, channel: number): number {
  const shift = 16 - channel * 8;
  const a = (tone < .5 ? ramp.dark : ramp.mid) >>> shift & 255;
  const b = (tone < .5 ? ramp.mid : ramp.light) >>> shift & 255;
  const amount = tone < .5 ? tone * 2 : (tone - .5) * 2;
  return a + (b - a) * amount;
}
/** Caller reuses output storage. There is no quantization or colored overlay. */
export function mapWorldPigment(appearance: R100WorldAppearance, role: WorldAppearanceRole,
  red: number, green: number, blue: number, range: PaintedToneRange, field: WorldAppearanceField,
  secondary: number, out: Float32Array): void {
  const lum = luminance(red, green, blue);
  const span = lum < range.mid ? range.mid - range.low : range.high - range.mid;
  // Soft tails keep the source's deepest pits and rare highlights distinct.
  const raw = (lum - range.mid) / span;
  const normalized = raw / (1 + Math.abs(raw) * .22);
  const contrast = role === 'ground' ? field.detail : appearance.textureContrast;
  const tone = clamp(.5 + normalized * .43 * contrast + (role === 'ground' ? field.tone : 0));
  const ramp = appearance[role];
  // The source's exposed brush planes break the transition only where two
  // beds meet. Fully primary/secondary regions keep their authored pigment.
  const boundary = secondary * (1 - secondary) * 4;
  const materialMix = role === 'ground' ? clamp(secondary + normalized * boundary * .19) : secondary;
  for (let channel = 0; channel < 3; channel++) {
    const primary = rampChannel(ramp, tone, channel), second = rampChannel(appearance.secondary, tone, channel);
    // Very small source chroma variation preserves mineral flecks, while the
    // authored ramp owns the dominant hue (including dark chromatic material).
    const source = channel === 0 ? red : channel === 1 ? green : blue;
    out[channel] = Math.max(0, Math.min(255, primary + (second - primary) * materialMix + (source - lum) * .035));
  }
}
