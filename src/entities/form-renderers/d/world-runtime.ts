/** Presentation opt-in is frozen by the admitted world recipe. Never infer it
 * from a material family alone: legacy runs must keep their original visuals. */
import type { FormAttachContext } from '../form-renderer';
import type { EnemyWorldAdaptation } from './world-adaptation';
import type { WorldMaterialLighting } from './world-material-light';

export type RuntimeEnemyWorldAppearance = Pick<FormAttachContext, 'worldAdaptation' | 'worldLighting' | 'enemyAppearanceVersion'>;

const LEGACY_APPEARANCE: RuntimeEnemyWorldAppearance = Object.freeze({});

/** Old receipts admit only the two pilot substrates. Version 2 maps existing
 * humanoid/paint substrates to two presentation archetypes without mutating forms.
 * Lighting is a live scene-owned reference, not a copied or manufactured lamp.
 */
export function resolveRuntimeEnemyWorldAppearance(
  material: EnemyWorldAdaptation | undefined,
  substrate: string,
  worldLighting?: WorldMaterialLighting,
  appearanceVersion: 1 | 2 | 3 = 1,
): RuntimeEnemyWorldAppearance {
  const supported = appearanceVersion === 3
    ? ['human_remnant', 'organic_remnant', 'insect_remnant', 'mammal_remnant', 'worm_remnant', 'stalk_clump',
      'fungal_mat', 'oil_film', 'ash_veil', 'gas_mass', 'mist_bank', 'dust_swarm', 'sound_echo'].includes(substrate)
    : appearanceVersion === 2
    ? ['human_remnant', 'organic_remnant', 'fungal_mat', 'oil_film', 'ash_veil'].includes(substrate)
    : substrate === 'human_remnant' || substrate === 'fungal_mat';
  if (!material || !supported)
    return LEGACY_APPEARANCE;
  // The admitted recipe has already validated and frozen this exact profile.
  // Do not resolve today's CSV here: cold recovery must use its saved values.
  return { worldAdaptation: material, worldLighting, ...(appearanceVersion === 3 ? { enemyAppearanceVersion: 3 as const } : {}) };
}
