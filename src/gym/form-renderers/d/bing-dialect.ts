import type { ContaminationForm } from '@/generation/contamination-draw';
import type { ContinuityId, CoverageId } from '@/generated/contamination-lexicon-data';
import { mix32 } from '@/generation/seed-fork';
import type { FormAttachContext } from '@/gym/form-renderers/form-renderer';
import {
  deriveFragmentContamRamp,
  LEXICON_DEFAULT_FRAGMENT,
  nearestPalette,
  type FragmentContamRamp,
  type Rgb,
  yardSurfaceColors,
} from '@/gym/form-renderers/d/fragment-ramp';

export interface ShapeKnobs {
  readonly rxMul: number;
  readonly ryMul: number;
  readonly warp: number;
  readonly lobeBias: number;
  readonly notch: boolean;
  readonly thin: boolean;
}

export type CoreShiftMode = 'along' | 'side' | 'back' | 'none';

export interface BingRecipe {
  readonly substrate: string;
  readonly coverage: CoverageId;
  readonly continuity: ContinuityId;
  readonly motion: string;
  readonly utteranceId?: string;
  readonly canvasW: number;
  readonly canvasH: number;
  readonly ramp: FragmentContamRamp;
  readonly remnant: Rgb | null;
  readonly holeChance: number;
  readonly breathAmp: number;
  readonly rhythmScale: number;
  readonly satelliteCount: number;
  readonly mainRadius: number;
  readonly satRadius: number;
  readonly shape: ShapeKnobs;
  readonly coreShiftPx: number;
  readonly coreShiftMode: CoreShiftMode;
  readonly rimOnInflated: boolean;
  readonly rimAlways: boolean;
}

const EARTH: Rgb = [0x1a, 0x1c, 0x1f];
const BONE: Rgb = [0x3a, 0x38, 0x38];

const CORE_TEALS: readonly Rgb[] = [
  [0x1a, 0xad, 0x96],
  [0x2a, 0xe6, 0xc8],
  [0x3c, 0xff, 0xd4],
];

function clampAmp(n: number): number {
  return n < 0.05 ? 0.05 : n > 0.2 ? 0.2 : n;
}

function snapBright(rgb: Rgb): Rgb {
  let best = CORE_TEALS[0]!;
  let bestD = Infinity;
  for (const p of CORE_TEALS) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function mixToward(a: Rgb, b: Rgb, t: number): Rgb {
  return nearestPalette(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

function coverageHoles(coverage: CoverageId): number {
  if (coverage === 'infiltrate') return 0.3;
  if (coverage === 'rewrite') return 0.12;
  return 0.02;
}

function coverageAmp(coverage: CoverageId): number {
  if (coverage === 'infiltrate') return 0.06;
  if (coverage === 'rewrite') return 0.12;
  return 0.18;
}

function coverageRadius(coverage: CoverageId): number {
  if (coverage === 'infiltrate') return 0.86;
  if (coverage === 'rewrite') return 1;
  return 1.12;
}

/** 团扁：切基体即换。菌毯圆瓣、油膜扁带、灰幕更扁覆层。 */
function substrateShape(id: string): ShapeKnobs {
  if (id === 'oil_film') {
    return { rxMul: 1.35, ryMul: 0.28, warp: 0.2, lobeBias: 0, notch: false, thin: true };
  }
  if (id === 'ash_veil') {
    return { rxMul: 1.52, ryMul: 0.18, warp: 0.34, lobeBias: 0.12, notch: true, thin: true };
  }
  return { rxMul: 1.05, ryMul: 0.92, warp: 0.48, lobeBias: 0.85, notch: false, thin: false };
}

function applyContinuity(shape: ShapeKnobs, continuity: ContinuityId): ShapeKnobs {
  if (continuity === 'field') {
    return { ...shape, rxMul: shape.rxMul * 1.12, ryMul: shape.ryMul * 1.1 };
  }
  if (continuity === 'colony') {
    return { ...shape, warp: Math.min(0.68, shape.warp + 0.06) };
  }
  if (continuity === 'shards') {
    return { ...shape, notch: true, warp: Math.min(0.7, shape.warp + 0.1) };
  }
  return shape;
}

function applyRhythm(shape: ShapeKnobs, rhythm: string): ShapeKnobs {
  if (rhythm === 'rhythm_pulse') {
    return {
      ...shape,
      warp: Math.min(0.7, shape.warp + 0.14),
      lobeBias: Math.min(1, shape.lobeBias + 0.15),
    };
  }
  if (rhythm === 'rhythm_sleep') {
    return { ...shape, warp: shape.warp * 0.55, lobeBias: shape.lobeBias * 0.7 };
  }
  if (rhythm === 'rhythm_sky') {
    return { ...shape, rxMul: shape.rxMul * 1.08, ryMul: shape.thin ? shape.ryMul : shape.ryMul * 1.06 };
  }
  return shape;
}

/** 外沿破损：渗透缺口多、覆盖缺口少但团更实。 */
function applyCoverage(shape: ShapeKnobs, coverage: CoverageId): ShapeKnobs {
  if (coverage === 'infiltrate') {
    return { ...shape, notch: true, warp: Math.min(0.72, shape.warp + 0.12) };
  }
  if (coverage === 'overwrite') {
    return { ...shape, notch: false, warp: shape.warp * 0.72 };
  }
  return shape;
}

function holeMul(substrate: string): number {
  if (substrate === 'ash_veil') return 1.28;
  if (substrate === 'oil_film') return 0.55;
  return 1;
}

function remnantFor(form: ContaminationForm, fragmentTypeId: string): Rgb | null {
  if (form.coverage === 'overwrite') return null;
  const floor = yardSurfaceColors(fragmentTypeId).floor;
  const mixT = 0.12 + (mix32(0, `bing-remnant:${fragmentTypeId}`) % 7) / 100;
  const base = form.substrate === 'ash_veil' ? BONE : EARTH;
  return mixToward(base, floor, mixT);
}

function satellites(continuity: ContinuityId): number {
  if (continuity === 'colony') return 3;
  if (continuity === 'shards') return 2;
  return 0;
}

function baseRadius(continuity: ContinuityId): number {
  if (continuity === 'field') return 24;
  if (continuity === 'colony') return 15;
  return 16;
}

function coreShift(sense: string): { px: number; mode: CoreShiftMode } {
  if (sense === 'sense_hear') return { px: 4, mode: 'side' };
  if (sense === 'sense_narrow') return { px: 6, mode: 'along' };
  if (sense === 'sense_touch') return { px: 3, mode: 'along' };
  if (sense === 'sense_scent') return { px: 0, mode: 'none' };
  if (sense === 'sense_domain') return { px: 2, mode: 'along' };
  if (sense === 'sense_reverse') return { px: 4, mode: 'back' };
  return { px: 5, mode: 'along' };
}

function fragmentRamp(fragmentTypeId: string): FragmentContamRamp {
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  return {
    deep: ramp.deep,
    mid: ramp.mid,
    core: snapBright(ramp.core),
    glow: snapBright(ramp.glow),
  };
}

export function bingRecipeFromForm(form: ContaminationForm, ctx: FormAttachContext): BingRecipe {
  const fragmentTypeId = ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT;
  const continuity = form.continuity;
  const field = continuity === 'field';
  const coverageScale = coverageRadius(form.coverage);
  const lung = form.utteranceId === 'cluster_lung';
  const rhythm = form.lexemes.rhythm;
  let rhythmScale = 1;
  if (rhythm === 'rhythm_sleep' || rhythm === 'rhythm_sky') rhythmScale = 0.5;
  let amp = coverageAmp(form.coverage);
  if (rhythm === 'rhythm_pulse') amp += 0.04;
  if (rhythm === 'rhythm_sleep') amp *= 0.55;
  if (lung) amp = 0.2;
  const shape = applyCoverage(
    applyRhythm(applyContinuity(substrateShape(form.substrate), continuity), rhythm),
    form.coverage,
  );
  const shift = coreShift(form.lexemes.sense);
  const mainRadius = baseRadius(continuity) * coverageScale * (lung ? 1.1 : 1);
  const holes = Math.min(0.42, coverageHoles(form.coverage) * holeMul(form.substrate));
  return {
    substrate: form.substrate,
    coverage: form.coverage,
    continuity,
    motion: form.lexemes.motion,
    utteranceId: form.utteranceId,
    canvasW: field ? 144 : 88,
    canvasH: field ? 144 : 88,
    ramp: fragmentRamp(fragmentTypeId),
    remnant: remnantFor(form, fragmentTypeId),
    holeChance: holes,
    breathAmp: clampAmp(amp),
    rhythmScale,
    satelliteCount: satellites(continuity),
    mainRadius,
    satRadius: Math.max(4.5, mainRadius * 0.42),
    shape,
    coreShiftPx: shift.px,
    coreShiftMode: shift.mode,
    rimOnInflated: form.lexemes.contact === 'contact_step_chaos',
    rimAlways: form.lexemes.sense === 'sense_scent',
  };
}
