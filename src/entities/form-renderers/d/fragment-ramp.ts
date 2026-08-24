/**
 * Fragment colours for scheme D (and the lexicon observation yard).
 * Copies `deriveContamRamp` *semantics* from preview-paint.ts (bias → teal hue
 * pull → palette quantize). Does not import that module, does not call
 * `generateRiftLayout` / `bakeGround`, and must not become the sortie ground path.
 */

import { RIFT_FRAGMENT_DATA, type RiftFragmentDef } from '@/generated/rift-fragment-data';
import {
  PALETTE,
  nearestPalette,
  type Rgb,
} from '@/generation/palette-quantize';
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';

export type { Rgb };
export {
  contrastFloorCell,
  l1Pool,
  nearestPalette,
  quantizeInGroup,
  quantizeL1,
  temperatureGroup,
  TEAL_FAMILY,
  TEAL_FAMILY_HEX,
} from '@/generation/palette-quantize';
export type { TemperatureGroup } from '@/generation/palette-quantize';

export const LEXICON_FRAGMENT_IDS = [
  'frag-outdoor',
  'frag-clinic',
  'frag-metro',
  'frag-library',
  'frag-residential',
] as const;

export type LexiconFragmentId = (typeof LEXICON_FRAGMENT_IDS)[number];

export const LEXICON_DEFAULT_FRAGMENT: LexiconFragmentId = 'frag-clinic';

export interface FragmentContamRamp {
  readonly deep: Rgb;
  readonly mid: Rgb;
  readonly core: Rgb;
  readonly glow: Rgb;
}

export interface YardSurfaceColors {
  readonly floor: Rgb;
  readonly wall: Rgb;
}

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max < 1e-6 ? 0 : d / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hh = ((h % 1) + 1) % 1;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh * 6) % 2) - 1));
  const m = v - c;
  const i = (hh * 6) | 0;
  let r = 0;
  let g = 0;
  let b = 0;
  if (i === 0) {
    r = c;
    g = x;
  } else if (i === 1) {
    r = x;
    g = c;
  } else if (i === 2) {
    g = c;
    b = x;
  } else if (i === 3) {
    g = x;
    b = c;
  } else if (i === 4) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function rgbDist2(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function sameRgb(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function quantDistinct(r: number, g: number, b: number, used: readonly Rgb[], floorRgb: Rgb): Rgb {
  const target: [number, number, number] = [clamp255(r), clamp255(g), clamp255(b)];
  let best: Rgb | null = null;
  let bestScore = Infinity;
  for (const p of PALETTE) {
    if (used.some((u) => sameRgb(u, p))) continue;
    const toTarget = rgbDist2(p, target);
    const toFloor = rgbDist2(p, floorRgb);
    const floorPenalty = toFloor < 2800 ? (2800 - toFloor) * 2.4 : 0;
    const score = toTarget + floorPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best ?? nearestPalette(target[0], target[1], target[2]);
}

function fragmentDef(fragmentTypeId: string): RiftFragmentDef {
  return RIFT_FRAGMENT_DATA[fragmentTypeId] ?? RIFT_FRAGMENT_DATA[LEXICON_DEFAULT_FRAGMENT]!;
}

export function isLexiconFragmentId(id: string): id is LexiconFragmentId {
  return (LEXICON_FRAGMENT_IDS as readonly string[]).includes(id);
}

/** Wall / floor bias of this fragment, snapped to the locked palette. Yard paint only. */
export function yardSurfaceColors(fragmentTypeId: string): YardSurfaceColors {
  const def = fragmentDef(fragmentTypeId);
  return {
    floor: nearestPalette(
      clamp255(def.floorBv * def.floorBiasR),
      clamp255(def.floorBv * def.floorBiasG),
      clamp255(def.floorBv * def.floorBiasB),
    ),
    wall: nearestPalette(
      clamp255(def.wallBv * def.wallBiasR),
      clamp255(def.wallBv * def.wallBiasG),
      clamp255(def.wallBv * def.wallBiasB),
    ),
  };
}

export function rgbToHex(rgb: Rgb): number {
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

/**
 * Same pull-to-teal + age + quantize as sortie `deriveContamRamp`, with
 * `age = 'standard'` and a seed mixed from the fragment id (stable per fragment).
 * Later 甲/乙/丙/丁 painters should use this, not a second palette.
 */
export function deriveFragmentContamRamp(fragmentTypeId: string): FragmentContamRamp {
  const def = fragmentDef(fragmentTypeId);
  const seed = mix32(0, `gym-frag-ramp:${def.id}`);
  return deriveContamRampCopy(def, seed);
}

function deriveContamRampCopy(def: RiftFragmentDef, seed: number): FragmentContamRamp {
  const floorRgb: [number, number, number] = [
    clamp255(def.floorBv * def.floorBiasR),
    clamp255(def.floorBv * def.floorBiasG),
    clamp255(def.floorBv * def.floorBiasB),
  ];
  const fh = rgbToHsv(floorRgb[0], floorRgb[1], floorRgb[2]);
  const wh = rgbToHsv(def.wallBv * def.wallBiasR, def.wallBv * def.wallBiasG, def.wallBv * def.wallBiasB);
  const mapHue = fh.s < 0.06 && wh.s < 0.06 ? 0.48 : fh.s >= wh.s ? fh.h : wh.h;
  const mapV = fh.v * 0.6 + wh.v * 0.4;
  const mapS = fh.s > wh.s ? fh.s : wh.s;
  const rng = new SeededRandom(mix32(seed, 'contam-ramp'));
  const tealHue = 0.48;
  const ageShift = 0;
  const hue = (((tealHue + (mapHue - tealHue) * 0.52 + ageShift + (rng.next() - 0.5) * 0.05) % 1) + 1) % 1;
  const sat = clamp01(0.5 + mapS * 0.38 + (rng.next() - 0.5) * 0.05);
  const val = clamp01(Math.max(0.36, mapV + 0.18) + (rng.next() - 0.5) * 0.04);
  const deepHsv = hsvToRgb(hue, sat * 0.82, val * 0.68);
  const midHsv = hsvToRgb(hue, sat, val * 0.95);
  const coreHsv = hsvToRgb(hue, sat * 0.78, clamp01(val * 1.2));
  const glowHsv = hsvToRgb(hue, sat * 0.46, clamp01(val * 1.42));
  const core = quantDistinct(coreHsv[0], coreHsv[1], coreHsv[2], [], floorRgb);
  const mid = quantDistinct(midHsv[0], midHsv[1], midHsv[2], [core], floorRgb);
  const deep = quantDistinct(deepHsv[0], deepHsv[1], deepHsv[2], [core, mid], floorRgb);
  const glow = quantDistinct(glowHsv[0], glowHsv[1], glowHsv[2], [core, mid, deep], floorRgb);
  return { deep, mid, core, glow };
}
