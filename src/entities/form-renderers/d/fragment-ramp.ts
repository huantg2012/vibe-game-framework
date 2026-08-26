/**
 * Fragment colours for scheme D (and the lexicon observation yard).
 * L2 four-stop ramp calls the same `deriveContamRamp` as sortie / map-lesson
 * ground clusters (I6-D). Does not call `generateRiftLayout` / `bakeGround`,
 * and must not become the sortie ground path.
 */

import { RIFT_FRAGMENT_DATA, type RiftFragmentDef } from '@/generated/rift-fragment-data';
import { deriveContamRamp } from '@/generation/preview-paint';
import { nearestPalette, type Rgb } from '@/generation/palette-quantize';
import { mix32 } from '@/generation/seed-fork';

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
 * Same function as sortie / map-lesson `deriveContamRamp`, with
 * `age = 'standard'` and a seed mixed from the fragment id (stable per fragment).
 * No per-fragment hue split. 甲/乙/丙/丁 painters use this wrapper.
 */
export function deriveFragmentContamRamp(fragmentTypeId: string): FragmentContamRamp {
  const def = fragmentDef(fragmentTypeId);
  const seed = mix32(0, `gym-frag-ramp:${def.id}`);
  return deriveContamRamp(def, 'standard', seed);
}
