import type { ContaminationForm } from '@/generation/contamination-draw';
import type { ContinuityId, CoverageId, OccupancyId } from '@/generated/contamination-lexicon-data';

export type FamilyId =
  | 'organic_remnant'
  | 'lamp_pillar'
  | 'doorframe'
  | 'wall_rust'
  | 'fungal_mat'
  | 'oil_film';

export type FailLevel = 0 | 1 | 2;

export interface PixelRecipe {
  readonly family: FamilyId;
  readonly fail: FailLevel;
  readonly continuity: ContinuityId;
  readonly occupancy: OccupancyId;
  readonly motion: string;
  readonly sense: string;
  readonly rhythm: string;
  readonly contact: string;
  readonly utterance: string | undefined;
  readonly seed: number;
  readonly canvasW: number;
  readonly canvasH: number;
  readonly originX: number;
  readonly originY: number;
}

const FAMILIES: readonly FamilyId[] = [
  'organic_remnant',
  'lamp_pillar',
  'doorframe',
  'wall_rust',
  'fungal_mat',
  'oil_film',
];

export function recipeFromForm(form: ContaminationForm, seed: number): PixelRecipe {
  const family = familyOf(form.substrate);
  const fail = failOf(form.coverage);
  const tall = form.lexemes.sense === 'sense_hear' || (family === 'lamp_pillar' && fail >= 1);
  return {
    family,
    fail,
    continuity: form.continuity,
    occupancy: form.occupancy,
    motion: form.lexemes.motion,
    sense: form.lexemes.sense,
    rhythm: form.lexemes.rhythm,
    contact: form.lexemes.contact,
    utterance: form.utteranceId,
    seed,
    canvasW: 32,
    canvasH: tall ? 48 : 32,
    originX: 16,
    originY: tall ? 30 : 16,
  };
}

function familyOf(id: string): FamilyId {
  return (FAMILIES as readonly string[]).includes(id) ? (id as FamilyId) : 'organic_remnant';
}

function failOf(coverage: CoverageId): FailLevel {
  if (coverage === 'overwrite') return 2;
  if (coverage === 'rewrite') return 1;
  return 0;
}

/** Own gait clock. Never 3100ms (DEC-070 cluster period). */
export function rhythmPeriodMs(rhythm: string): number {
  switch (rhythm) {
    case 'rhythm_pulse':
      return 380;
    case 'rhythm_sleep':
      return 2100;
    case 'rhythm_cluster':
      return 1450;
    case 'rhythm_sky':
      return 1750;
    default:
      return 920;
  }
}

export function gaitFps(rhythm: string, moving: boolean): number {
  let fps = moving ? 6 : 3;
  if (rhythm === 'rhythm_pulse') fps += 4;
  if (rhythm === 'rhythm_sleep') fps = Math.max(2, fps - 2);
  if (rhythm === 'rhythm_sky') fps = Math.max(3, fps - 1);
  return fps;
}

export function corePx(fail: FailLevel): number {
  return fail === 2 ? 4 : fail === 1 ? 3 : 2;
}

export function flakeCount(contact: string): number {
  switch (contact) {
    case 'contact_melee_three':
      return 8;
    case 'contact_step_chaos':
      return 6;
    case 'contact_volume_chaos':
      return 5;
    case 'contact_disperse_core':
      return 4;
    default:
      return 3;
  }
}

export function recipeTag(recipe: PixelRecipe): string {
  return `a${(recipe.seed >>> 0).toString(16)}_${recipe.family}_${recipe.fail}_${recipe.continuity}_${recipe.occupancy}_${recipe.sense}_${recipe.contact}_${recipe.utterance ?? 'none'}`;
}
