/** A frozen visual sub-contract. Geometry hashes and historical deployment forms
 * remain unchanged; recovery identity already includes the complete recipe JSON. */
import { resolveEnemyWorldAdaptation, type EnemyWorldAdaptation } from '@/entities/form-renderers/d/world-adaptation';
import type { WorldProductionRecipeV3 } from './production-recipe';

export interface EnemyAppearanceContract {
  readonly version: 2 | 3;
  readonly material: EnemyWorldAdaptation;
  readonly signature: string;
}
const KINDS = ['fibre', 'membrane', 'slab', 'shell', 'granular', 'gel'];
const KEYS = ['key', 'worldId', 'kind', 'dark', 'mid', 'light', 'secondary', 'fibreCount', 'membraneSpread', 'motionLag', 'paintBranching'];
function signature(recipe: WorldProductionRecipeV3, material: EnemyWorldAdaptation, version: 2 | 3): string {
  const text = JSON.stringify([`enemy-appearance@${version}`, recipe.package.dependencyHash, recipe.requestedSeed, recipe.package.grade, material]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function withEnemyAppearance(recipe: WorldProductionRecipeV3, version: 2 | 3 = 3): WorldProductionRecipeV3 {
  const material = resolveEnemyWorldAdaptation(recipe.appearance!.worldId);
  if (!material) throw new Error(`Missing world enemy grammar: ${recipe.package.id}`);
  return { ...recipe, enemyAppearance: { version, material: structuredClone(material), signature: signature(recipe, material, version) } };
}
/** Strict, bounded validation using saved values, never today's family table. */
export function validEnemyAppearance(recipe: WorldProductionRecipeV3): boolean {
  const value = recipe.enemyAppearance, material = value?.material;
  if (!value || (value.version !== 2 && value.version !== 3) || Object.keys(value).sort().join(',') !== 'material,signature,version'
    || !material || !recipe.appearance || !recipe.package
    || Object.keys(material).length !== KEYS.length || !KEYS.every(key => Object.prototype.hasOwnProperty.call(material, key))
    || material.worldId !== recipe.appearance.worldId || !KINDS.includes(material.kind)
    || typeof material.key !== 'string' || material.key.length > 240
    || !material.key.startsWith(`world-body-v1:${material.worldId}:`)) return false;
  if (![material.dark, material.mid, material.light, material.secondary].every(color =>
    Array.isArray(color) && color.length === 3 && color.every(n => Number.isInteger(n) && n >= 0 && n <= 255))) return false;
  if (!Number.isInteger(material.fibreCount) || material.fibreCount < 2 || material.fibreCount > 6
    || !Number.isFinite(material.membraneSpread) || material.membraneSpread < .5 || material.membraneSpread > 1.5
    || !Number.isFinite(material.motionLag) || material.motionLag < 0 || material.motionLag > .3
    || !Number.isFinite(material.paintBranching) || material.paintBranching < 0 || material.paintBranching > 1) return false;
  return value.signature === signature(recipe, material, value.version);
}
