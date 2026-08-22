import type { ContaminationForm } from '@/generation/contamination-draw';
import type { ContinuityId, CoverageId } from '@/generated/contamination-lexicon-data';
import { mix32 } from '@/generation/seed-fork';
import {
  deriveFragmentContamRamp,
  LEXICON_DEFAULT_FRAGMENT,
  nearestPalette,
  type FragmentContamRamp,
  type Rgb,
  yardSurfaceColors,
} from '@/entities/form-renderers/d/fragment-ramp';
import { toRgba, type Rgba } from '@/entities/form-renderers/d/jia-pixels';

export const JIA_FAMILIES = [
  'organic_remnant',
  'lamp_pillar',
  'doorframe',
  'stalk_clump',
  'railing_post',
] as const;

export type JiaFamily = (typeof JIA_FAMILIES)[number];
export type JiaVariant = 0 | 1 | 2;
export type ClusterMode = 'patrol' | 'search' | 'chase' | 'strike';

export const CORE_TEALS: readonly Rgb[] = [
  [0x1a, 0xad, 0x96],
  [0x2a, 0xe6, 0xc8],
  [0x3c, 0xff, 0xd4],
];

export const COLD_SPECK: Rgb = [0x1a, 0x7a, 0x9a];

const FLESH: Rgb = [0x2e, 0x2d, 0x30];
const CLOTH: Rgb = [0x2a, 0x2a, 0x2e];
const BONE: Rgb = [0x3a, 0x38, 0x38];
const EARTH: Rgb = [0x1a, 0x1c, 0x1f];
const BRICK: Rgb = [0x2a, 0x1f, 0x1c];
const METAL: Rgb = [0x4a, 0x4e, 0x55];
const METAL_MID: Rgb = [0x3a, 0x3d, 0x42];
const CONCRETE: Rgb = [0x2c, 0x2e, 0x33];
const SHADOW: Rgb = [0x15, 0x1a, 0x1e];

export interface JiaBodyColors {
  readonly flesh: Rgba;
  readonly cloth: Rgba;
  readonly bone: Rgba;
  readonly earth: Rgba;
  readonly brick: Rgba;
  readonly metal: Rgba;
  readonly metalMid: Rgba;
  readonly concrete: Rgba;
  readonly shadow: Rgba;
  readonly deep: Rgba;
  readonly mid: Rgba;
  readonly core: Rgba;
  readonly glow: Rgba;
  readonly bright: Rgba;
  readonly cold: Rgba;
}

export interface JiaRecipe {
  readonly family: JiaFamily;
  readonly variant: JiaVariant;
  readonly coverage: CoverageId;
  readonly continuity: ContinuityId;
  readonly motion: string;
  readonly sense: string;
  readonly rhythm: string;
  readonly contact: string;
  readonly utterance: string | undefined;
  readonly seed: number;
  readonly fragmentTypeId: string;
  readonly canvasW: 32;
  readonly canvasH: 32 | 48;
  readonly originX: 16;
  readonly originY: number;
  readonly anchored: boolean;
  readonly colors: JiaBodyColors;
  readonly ramp: FragmentContamRamp;
}

const FAMILIES = new Set<string>(JIA_FAMILIES);

export function jiaFamilyOf(substrate: string): JiaFamily {
  return FAMILIES.has(substrate) ? (substrate as JiaFamily) : 'organic_remnant';
}

export function jiaVariantOf(seed: number, substrate: string): JiaVariant {
  return (mix32(seed, substrate) % 3) as JiaVariant;
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

function mixTint(base: Rgb, tint: Rgb, t: number): Rgba {
  return toRgba(
    nearestPalette(
      base[0] + (tint[0] - base[0]) * t,
      base[1] + (tint[1] - base[1]) * t,
      base[2] + (tint[2] - base[2]) * t,
    ),
  );
}

function bodyColors(fragmentTypeId: string, seed: number, family: JiaFamily): {
  colors: JiaBodyColors;
  ramp: FragmentContamRamp;
} {
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  const surface = yardSurfaceColors(fragmentTypeId);
  const tint = family === 'organic_remnant' || family === 'stalk_clump' ? surface.floor : surface.wall;
  const t = 0.12 + (mix32(seed, `body-mix:${fragmentTypeId}`) % 7) / 100;
  const core = toRgba(clampCoreTeal(ramp.core));
  const glow = toRgba(clampCoreTeal(ramp.glow));
  return {
    ramp,
    colors: {
      flesh: mixTint(FLESH, tint, t),
      cloth: mixTint(CLOTH, tint, t),
      bone: mixTint(BONE, tint, t),
      earth: mixTint(EARTH, tint, t),
      brick: mixTint(BRICK, tint, t),
      metal: mixTint(METAL, tint, t),
      metalMid: mixTint(METAL_MID, tint, t),
      concrete: mixTint(CONCRETE, tint, t),
      shadow: mixTint(SHADOW, tint, t * 0.6),
      deep: toRgba(ramp.deep),
      mid: toRgba(ramp.mid),
      core,
      glow,
      bright: toRgba(CORE_TEALS[2]!),
      cold: toRgba(COLD_SPECK),
    },
  };
}

function tallCanvas(form: ContaminationForm): boolean {
  return form.coverage !== 'infiltrate' || form.lexemes.sense === 'sense_hear';
}

function anchoredFamily(family: JiaFamily, motion: string): boolean {
  if (motion === 'motion_anchor') return true;
  return family === 'lamp_pillar' || family === 'doorframe' || family === 'railing_post';
}

export function jiaRecipeFromForm(
  form: ContaminationForm,
  seed: number,
  fragmentTypeId: string = LEXICON_DEFAULT_FRAGMENT,
): JiaRecipe {
  const family = jiaFamilyOf(form.substrate);
  const variant = jiaVariantOf(seed, form.substrate);
  const tall = tallCanvas(form);
  const { colors, ramp } = bodyColors(fragmentTypeId, seed, family);
  return {
    family,
    variant,
    coverage: form.coverage,
    continuity: form.continuity,
    motion: form.lexemes.motion,
    sense: form.lexemes.sense,
    rhythm: form.lexemes.rhythm,
    contact: form.lexemes.contact,
    utterance: form.utteranceId,
    seed,
    fragmentTypeId,
    canvasW: 32,
    canvasH: tall ? 48 : 32,
    originX: 16,
    originY: tall ? 30 : 16,
    anchored: anchoredFamily(family, form.lexemes.motion),
    colors,
    ramp,
  };
}

/** Own gait clock. Never the 3100ms cluster period. */
export function jiaGaitFps(rhythm: string, moving: boolean): number {
  let fps = moving ? 6 : 3;
  if (rhythm === 'rhythm_pulse') fps += 4;
  if (rhythm === 'rhythm_sleep') fps = Math.max(2, fps - 2);
  if (rhythm === 'rhythm_sky') fps = Math.max(3, fps - 1);
  return fps;
}

export function jiaRecipeTag(recipe: JiaRecipe): string {
  return `djia_${(recipe.seed >>> 0).toString(16)}_${recipe.fragmentTypeId}_${recipe.family}_v${recipe.variant}_${recipe.coverage}_${recipe.continuity}_${recipe.sense}_${recipe.motion}`;
}

export function clusterModeOf(signal: 'idle' | 'strike' | 'inflated' | 'awake'): ClusterMode {
  if (signal === 'strike') return 'strike';
  if (signal === 'inflated') return 'search';
  if (signal === 'awake') return 'chase';
  return 'patrol';
}
