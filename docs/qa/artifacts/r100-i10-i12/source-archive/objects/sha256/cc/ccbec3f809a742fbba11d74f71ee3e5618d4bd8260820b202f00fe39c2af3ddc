import type { ContaminationForm } from '@/generation/contamination-draw';
import type { ContinuityId, CoverageId, PortfolioId } from '@/generated/contamination-lexicon-data';
import { GAME_CONSTANTS } from '@/config/constants';
import type { FormAttachContext } from '@/entities/form-renderers/form-renderer';
import {
  CORE_TEAL,
  GREY_BONE,
  GREY_EARTH,
  GREY_FLOOR,
  GREY_SHADOW,
  GREY_WALL,
  TEAL_COLD,
  TEAL_DEEP,
  TEAL_MID,
  type Rgb,
} from '@/gym/form-renderers/b/palette';

export type SenseKind = 'cone' | 'hear' | 'narrow' | 'touch' | 'scent' | 'domain' | 'reverse';

export interface ShapeKnobs {
  readonly rxMul: number;
  readonly ryMul: number;
  readonly warp: number;
  readonly lobeBias: number;
  readonly notch: boolean;
  readonly thin: boolean;
}

export interface DialectRecipe {
  readonly portfolio: PortfolioId;
  readonly occupancy: ContaminationForm['occupancy'];
  readonly coverage: CoverageId;
  readonly continuity: ContinuityId;
  readonly motion: string;
  readonly utteranceId?: string;
  readonly canvasW: number;
  readonly canvasH: number;
  readonly origin: 'center' | 'topleft';
  readonly ramp: { readonly deep: Rgb; readonly mid: Rgb; readonly core: Rgb; readonly glow: Rgb };
  readonly remnant: Rgb | null;
  readonly holeChance: number;
  readonly breathAmp: number;
  readonly rhythmScale: number;
  readonly hitchPeriodMs: number;
  readonly hitchPlant: number;
  readonly hitchLunge: number;
  readonly facingShift: number;
  readonly facingStretch: number;
  readonly seamSlidePx: number;
  readonly openClose: boolean;
  readonly sense: SenseKind;
  readonly contactOnStrike: boolean;
  readonly contactOnInflated: boolean;
  readonly contactOnLunge: boolean;
  readonly contactOnAwake: boolean;
  readonly satelliteCount: number;
  readonly mainRadius: number;
  readonly satRadius: number;
  readonly shape: ShapeKnobs;
  readonly volume: {
    readonly enabled: boolean;
    readonly insetTiles: number;
    readonly shiftTiles: number;
    readonly fill: number;
    readonly alpha: number;
    readonly dimUntilAwake: boolean;
  };
}

const TILE = GAME_CONSTANTS.TILE_SIZE;

function clampAmp(n: number): number {
  return n < 0.05 ? 0.05 : n > 0.2 ? 0.2 : n;
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

function substrateShape(id: string): ShapeKnobs {
  if (id === 'lamp_pillar') {
    return { rxMul: 0.52, ryMul: 1.38, warp: 0.22, lobeBias: 0, notch: false, thin: false };
  }
  if (id === 'doorframe') {
    return { rxMul: 0.7, ryMul: 1.2, warp: 0.16, lobeBias: 0, notch: true, thin: false };
  }
  if (id === 'wall_rust') {
    return { rxMul: 0.42, ryMul: 1.45, warp: 0.28, lobeBias: 0.15, notch: false, thin: false };
  }
  if (id === 'fungal_mat') {
    return { rxMul: 1.05, ryMul: 0.92, warp: 0.48, lobeBias: 0.85, notch: false, thin: false };
  }
  if (id === 'oil_film') {
    return { rxMul: 1.35, ryMul: 0.28, warp: 0.2, lobeBias: 0, notch: false, thin: true };
  }
  return { rxMul: 1, ryMul: 0.85, warp: 0.38, lobeBias: 0.35, notch: false, thin: false };
}

function substrateRamp(id: string): DialectRecipe['ramp'] {
  if (id === 'lamp_pillar') {
    return { deep: TEAL_DEEP, mid: TEAL_COLD, core: CORE_TEAL.bright, glow: CORE_TEAL.bright };
  }
  if (id === 'wall_rust') {
    return { deep: GREY_SHADOW, mid: GREY_WALL, core: CORE_TEAL.core, glow: CORE_TEAL.glow };
  }
  if (id === 'doorframe') {
    return { deep: GREY_SHADOW, mid: GREY_BONE, core: CORE_TEAL.glow, glow: CORE_TEAL.bright };
  }
  if (id === 'fungal_mat') {
    return { deep: TEAL_DEEP, mid: TEAL_MID, core: CORE_TEAL.glow, glow: CORE_TEAL.bright };
  }
  if (id === 'oil_film') {
    return { deep: GREY_EARTH, mid: CORE_TEAL.core, core: CORE_TEAL.glow, glow: CORE_TEAL.bright };
  }
  return { deep: TEAL_DEEP, mid: TEAL_MID, core: CORE_TEAL.core, glow: CORE_TEAL.glow };
}

function remnantFor(form: ContaminationForm): Rgb | null {
  if (form.coverage === 'overwrite') return null;
  if (form.coverage === 'rewrite') return form.occupancy === 'wall' ? GREY_WALL : GREY_FLOOR;
  if (form.occupancy === 'wall') return GREY_WALL;
  if (form.occupancy === 'volume') return GREY_SHADOW;
  return GREY_FLOOR;
}

function satellites(continuity: ContinuityId, portfolio: PortfolioId): number {
  if (portfolio === 'jia' || portfolio === 'yi') return 0;
  if (continuity === 'shards') return 2;
  if (continuity === 'colony') return 3;
  if (continuity === 'field') return portfolio === 'ding' ? 2 : 5;
  return 0;
}

function senseKind(id: string): SenseKind {
  if (id === 'sense_hear') return 'hear';
  if (id === 'sense_narrow') return 'narrow';
  if (id === 'sense_touch') return 'touch';
  if (id === 'sense_scent') return 'scent';
  if (id === 'sense_domain') return 'domain';
  if (id === 'sense_reverse') return 'reverse';
  return 'cone';
}

function canvasFor(
  form: ContaminationForm,
  pin: FormAttachContext['pin'],
): { w: number; h: number; origin: 'center' | 'topleft' } {
  if (form.portfolio === 'ding') {
    const w = Math.max(TILE * 3, Math.round(pin?.width ?? TILE * 6));
    const h = Math.max(TILE * 3, Math.round(pin?.height ?? TILE * 6));
    return { w, h, origin: 'topleft' };
  }
  if (form.portfolio === 'bing') {
    const field = form.continuity === 'field';
    return { w: field ? 144 : 88, h: field ? 144 : 88, origin: 'center' };
  }
  if (form.portfolio === 'yi') return { w: 40, h: 56, origin: 'center' };
  return { w: 56, h: 56, origin: 'center' };
}

function baseRadius(form: ContaminationForm): number {
  if (form.portfolio === 'jia') return 11;
  if (form.portfolio === 'yi') return 9;
  if (form.portfolio === 'bing') return form.continuity === 'field' ? 22 : 16;
  return 10;
}

export function dialectFromForm(
  form: ContaminationForm,
  pin: FormAttachContext['pin'],
): DialectRecipe {
  const canvas = canvasFor(form, pin);
  const coverageScale = coverageRadius(form.coverage);
  const occBoost = form.occupancy === 'paint' ? 1.15 : form.occupancy === 'floor' ? 1 : 0.92;
  const domainBoost = form.lexemes.sense === 'sense_domain' ? 1.12 : 1;
  const lung = form.utteranceId === 'cluster_lung';
  const watching = form.utteranceId === 'corridor_watching';
  const door = form.utteranceId === 'door_still_closing' || form.substrate === 'doorframe';
  const rhythm = form.lexemes.rhythm;
  let rhythmScale = 1;
  if (rhythm === 'rhythm_sleep' || rhythm === 'rhythm_sky') rhythmScale = 0.5;
  let amp = coverageAmp(form.coverage);
  if (rhythm === 'rhythm_pulse') amp += 0.04;
  if (rhythm === 'rhythm_sleep') amp *= 0.55;
  if (form.lexemes.sense === 'sense_domain') amp += 0.03;
  if (lung) amp = 0.2;
  const motion = form.lexemes.motion;
  let hitchPeriod = 380;
  if (motion === 'motion_turn') hitchPeriod = 520;
  if (motion === 'motion_coalesce') hitchPeriod = 900;
  const seamSlide =
    form.portfolio === 'yi' && (motion === 'motion_wall' || motion === 'motion_turn') ? 7 : 0;
  const mainRadius = baseRadius(form) * coverageScale * occBoost * domainBoost * (lung ? 1.1 : 1);
  const inset =
    form.substrate === 'oil_film' ? 2 : form.continuity === 'monolith' ? 1 : form.continuity === 'field' ? 0 : 1;
  const volAlpha =
    form.coverage === 'infiltrate' ? 110 : form.coverage === 'rewrite' ? 160 : 210;
  return {
    portfolio: form.portfolio,
    occupancy: form.occupancy,
    coverage: form.coverage,
    continuity: form.continuity,
    motion,
    utteranceId: form.utteranceId,
    canvasW: canvas.w,
    canvasH: canvas.h,
    origin: canvas.origin,
    ramp: substrateRamp(form.substrate),
    remnant: remnantFor(form),
    holeChance: coverageHoles(form.coverage),
    breathAmp: clampAmp(amp),
    rhythmScale,
    hitchPeriodMs: hitchPeriod,
    hitchPlant: motion === 'motion_coalesce' ? 0.72 : 0.88,
    hitchLunge: motion === 'motion_coalesce' ? 1.08 : 1.16,
    facingShift: form.portfolio === 'jia' ? 3 : 0,
    facingStretch: form.portfolio === 'jia' ? 0.18 : 0,
    seamSlidePx: seamSlide,
    openClose: door,
    sense: senseKind(form.lexemes.sense),
    contactOnStrike: form.lexemes.contact === 'contact_adjacent_strike',
    contactOnInflated: form.lexemes.contact === 'contact_step_chaos',
    contactOnLunge: form.lexemes.contact === 'contact_melee_three',
    contactOnAwake: form.lexemes.contact === 'contact_volume_chaos',
    satelliteCount: satellites(form.continuity, form.portfolio),
    mainRadius,
    satRadius: Math.max(4.5, mainRadius * 0.42),
    shape: substrateShape(form.substrate),
    volume: {
      enabled: form.portfolio === 'ding',
      insetTiles: inset,
      shiftTiles: form.continuity === 'field' ? 1 : 0,
      fill: form.coverage === 'overwrite' ? 0.42 : form.coverage === 'rewrite' ? 0.28 : 0.16,
      alpha: watching ? Math.min(230, volAlpha + 20) : volAlpha,
      dimUntilAwake: watching || form.lexemes.sense === 'sense_reverse',
    },
  };
}
