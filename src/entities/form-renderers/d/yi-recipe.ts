/**
 * 方案 D 乙配方：贴墙缝的门框 / 墙锈。配色跟碎片 ramp，亮核钳回三色。
 */
import type { ContaminationForm } from '@/generation/contamination-draw';
import type { ContinuityId, CoverageId } from '@/generated/contamination-lexicon-data';
import { mix32 } from '@/generation/seed-fork';
import { coreMarkPx, resolveStopLoss } from '@/systems/contamination-host-live';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import {
  deriveFragmentContamRamp,
  LEXICON_DEFAULT_FRAGMENT,
  nearestPalette,
  rgbToHex,
  yardSurfaceColors,
  type FragmentContamRamp,
  type Rgb,
} from '@/entities/form-renderers/d/fragment-ramp';

export const YI_FAMILIES = ['doorframe', 'wall_rust'] as const;
export type YiFamily = (typeof YI_FAMILIES)[number];

export const CORE_TEALS: readonly Rgb[] = [
  [0x1a, 0xad, 0x96],
  [0x2a, 0xe6, 0xc8],
  [0x3c, 0xff, 0xd4],
];

const BRICK: Rgb = [0x2a, 0x1f, 0x1c];
const METAL: Rgb = [0x4a, 0x4e, 0x55];
const CONCRETE: Rgb = [0x2c, 0x2e, 0x33];

export interface YiColors {
  readonly wall: number;
  readonly remnant: number;
  readonly metal: number;
  readonly concrete: number;
  readonly deep: number;
  readonly mid: number;
  readonly core: number;
  readonly glow: number;
  readonly strikeDot: number;
}

export interface YiRecipe {
  readonly family: YiFamily;
  readonly coverage: CoverageId;
  readonly continuity: ContinuityId;
  readonly motion: string;
  readonly sense: string;
  readonly rhythm: string;
  readonly contact: string;
  readonly utterance: string | undefined;
  readonly seed: number;
  readonly fragmentTypeId: string;
  readonly filmPx: 1 | 2 | 3;
  readonly corePx: 2 | 3 | 4;
  readonly colors: YiColors;
  readonly ramp: FragmentContamRamp;
}

const FAMILIES = new Set<string>(YI_FAMILIES);

export function yiFamilyOf(substrate: string): YiFamily {
  return FAMILIES.has(substrate) ? (substrate as YiFamily) : 'wall_rust';
}

export function clampCoreTeal(rgb: Rgb): Rgb {
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

function mixTint(base: Rgb, tint: Rgb, t: number): Rgb {
  return nearestPalette(
    base[0] + (tint[0] - base[0]) * t,
    base[1] + (tint[1] - base[1]) * t,
    base[2] + (tint[2] - base[2]) * t,
  );
}

export function yiRecipeFromForm(
  form: ContaminationForm,
  seed: number,
  fragmentTypeId: string = LEXICON_DEFAULT_FRAGMENT,
): YiRecipe {
  const family = yiFamilyOf(form.substrate);
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  const surface = yardSurfaceColors(fragmentTypeId);
  const t = 0.12 + (mix32(seed, `yi-mix:${fragmentTypeId}`) % 7) / 100;
  const remnant =
    family === 'doorframe' ? mixTint(METAL, surface.wall, t) : mixTint(surface.wall, BRICK, t);
  const filmPx: 1 | 2 | 3 = form.coverage === 'infiltrate' ? 1 : form.coverage === 'rewrite' ? 2 : 3;
  const stop = resolveStopLoss(form);
  const sized = stop === 'illegal' ? 3 : coreMarkPx(stop.corePolicy, 3);
  const corePx: 2 | 3 | 4 = sized <= 2 ? 2 : sized >= 4 ? 4 : 3;
  return {
    family,
    coverage: form.coverage,
    continuity: form.continuity,
    motion: form.lexemes.motion,
    sense: form.lexemes.sense,
    rhythm: form.lexemes.rhythm,
    contact: form.lexemes.contact,
    utterance: form.utteranceId,
    seed,
    fragmentTypeId,
    filmPx,
    corePx,
    ramp,
    colors: {
      wall: rgbToHex(surface.wall),
      remnant: rgbToHex(remnant),
      metal: rgbToHex(mixTint(METAL, surface.wall, t)),
      concrete: rgbToHex(mixTint(CONCRETE, surface.wall, t * 0.8)),
      deep: rgbToHex(ramp.deep),
      mid: rgbToHex(ramp.mid),
      core: rgbToHex(clampCoreTeal(ramp.core)),
      glow: rgbToHex(clampCoreTeal(ramp.glow)),
      strikeDot: rgbToHex(CORE_TEALS[0]!),
    },
  };
}

export function yiPeriodMs(_rhythm: string): number { return 2400; }

/**
 * 与 FormWallAttach.nx/ny 同一套：指向可走地板。
 * n → (0,-1) 缝在墙格顶边；e → (1,0) 右边；s → (0,1) 底边；w → (-1,0) 左边。
 */
export function faceNormal(facing: FormVisualPose['facing4']): { nx: number; ny: number } {
  if (facing === 'right') return { nx: 1, ny: 0 };
  if (facing === 'left') return { nx: -1, ny: 0 };
  if (facing === 'down') return { nx: 0, ny: 1 };
  return { nx: 0, ny: -1 };
}
