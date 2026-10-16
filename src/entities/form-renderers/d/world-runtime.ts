/** Presentation opt-in is frozen by the admitted world recipe. Never infer it
 * from a material family alone: legacy runs must keep their original visuals. */
import type { FormAttachContext } from '../form-renderer';
import type { EnemyWorldAdaptation } from './world-adaptation';
import type { WorldMaterialLighting } from './world-material-light';

export type RuntimeEnemyWorldAppearance = Pick<FormAttachContext, 'worldAdaptation' | 'worldLighting'>;

const LEGACY_APPEARANCE: RuntimeEnemyWorldAppearance = Object.freeze({});

/** The recipe caller owns the enabled-world scope. The renderer owns the two
 * substrate implementations; other families cannot accidentally inherit them.
 * Lighting is a live scene-owned reference, not a copied or manufactured lamp.
 */
export function resolveRuntimeEnemyWorldAppearance(
  material: EnemyWorldAdaptation | undefined,
  substrate: string,
  worldLighting?: WorldMaterialLighting,
): RuntimeEnemyWorldAppearance {
  if (!material || (substrate !== 'human_remnant' && substrate !== 'fungal_mat'))
    return LEGACY_APPEARANCE;
  // The admitted recipe has already validated and frozen this exact profile.
  // Do not resolve today's CSV here: cold recovery must use its saved values.
  return { worldAdaptation: material, worldLighting };
}
