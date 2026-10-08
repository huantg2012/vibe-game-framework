/** A departure freezes the exact native geometry/rules. Adding catalog rows does
 * not invalidate previously frozen v3 departures. Existing asset paths are immutable. */
import { validR100ProductionRecipe as validFrozenR100ProductionRecipe } from '../legacy-r100-v2/executor.js';
import { validR100ProductionRecipe as validRevision3Recipe } from '../legacy-r100-v3/executor.js';
import { validR100ProductionRecipe as validRevision5Recipe } from '../legacy-r100-v5/executor-recovery.js';
import { validR100ProductionRecipe as validRevision4Recipe } from '../legacy-r100-v4/executor.js';
import { R100_WORLD_APPEARANCES } from '@/generated/r100-world-appearance';
import { profileWithWorldAppearance, validR100WorldAppearance, type R100WorldAppearance } from './r100-world-appearance';
import { R100_MATERIAL_DEPENDENCIES } from '@/generated/r100-package-manifest';
import { R100_NATIVE_WORLDS } from '@/generated/r100-native-worlds';
import { R100_EXPEDITION_GRADES } from '@/generated/rift-expedition-grade-data';
import { POLLUTION_GRADE_DEFINITIONS } from '@/generated/rift-pollution-grade-data';
import type { RiftWorldHistory } from '@/types/rift-world-history';
import { selectR100WorldId } from './r100-world-selection';
import { validateNativeVolumeSpec } from './native-volume-geometry';
import { validateNativeErosion, validateNativeGroundEdgeOwnership } from './native-volume-erosion';
import { isPollutionGrade, isPollutionGradeDefinition, type PollutionGrade } from './pollution-grade';
import { SPACE_PROFILES } from './space-profile';
import type { WorldProductionRecipeV3 } from './production-recipe';
import type { MasterDefinition } from './r100-master-world';

export interface R100PackageIdentity {
  readonly id: string;
  readonly algorithm: 'r100-native';
  readonly version: 3;
  /** Increment/freeze the executor before changing existing algorithm semantics. */
  readonly algorithmRevision: 1 | 2 | 3 | 4 | 5 | 6;
  readonly dependencyHash: string;
  readonly materials: Readonly<Record<string, { readonly definition: string; readonly surface: string; readonly solid: string }>>;
  readonly grade: PollutionGrade;
}
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/** Integrity receipt, not an anti-cheat signature. Assets separately carry SHA256. */
function fingerprint(value: unknown): string {
  const source = JSON.stringify(value); let hash = 2166136261;
  for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function materialDependencies(definition: MasterDefinition, appearance: R100WorldAppearance): R100PackageIdentity['materials'] {
  const names: string[] = [...new Set([definition.family, ...definition.instances.map(instance => instance.family ?? definition.family)])];
  // A selected organization owns distinct immutable atoms. Empty selection
  // retains precisely the historical family-only dependency object.
  if (appearance.materialOrganization) names.push(`organization:${appearance.materialOrganization}`);
  names.sort();
  return Object.fromEntries(names.map(name => {
    const dependency = R100_MATERIAL_DEPENDENCIES[name];
    if (!dependency) throw new Error(`Missing native material ${name}`);
    return [name, dependency];
  }));
}
function dependencyHash(recipe: Omit<WorldProductionRecipeV3, 'package'>, materials: R100PackageIdentity['materials'], revision: 6 = 6): string {
  // Public copy is frozen for display, but does not redefine the map/loot algorithm.
  return fingerprint({ algorithm: `r100-native@3.${revision}`, native: recipe.nativeDefinition, profile: recipe.profile, space: recipe.space,
    contentFragmentTypeId: recipe.contentFragmentTypeId, grade: recipe.gradeDefinition, contents: recipe.contentDefinition, appearance: recipe.appearance, materials });
}
/** Explicit package selection is shared with qualification/gym; normal play only
 * calls selectR100ProductionRecipe and therefore respects the enabled pool. */
export function createR100ProductionRecipe(worldId: string, seed: number, grade: PollutionGrade): WorldProductionRecipeV3 {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !isPollutionGrade(grade)) throw new Error('Invalid native departure seed/grade');
  const world = R100_NATIVE_WORLDS.find(row => row.id === worldId);
  if (!world) throw new Error(`Unknown native world ${worldId}`);
  const appearance = R100_WORLD_APPEARANCES.find(row => row.worldId === worldId);
  if (!appearance) throw new Error(`Missing native world appearance ${worldId}`);
  const nativeDefinition = world.definitions.find(definition => definition.grade === grade)!;
  const gradeDefinition = POLLUTION_GRADE_DEFINITIONS.find(row => row.id === grade)!;
  const contentDefinition = R100_EXPEDITION_GRADES.find(row => row.grade_id === grade)!;
  const frozen = { version: 3 as const, requestedSeed: seed, paintGeometryVersion: 2 as const,
    profile: profileWithWorldAppearance(world.profile, appearance), appearance, space: SPACE_PROFILES[0]!, contentFragmentTypeId: 'frag-outdoor', nativeDefinition, gradeDefinition, contentDefinition };
  if (contentDefinition.version !== 2) throw new Error('Revision 6 requires expedition definition version 2');
  const materials = materialDependencies(nativeDefinition, appearance);
  return structuredClone({ ...frozen, package: { id: `r100-${worldId}`, algorithm: 'r100-native', version: 3, algorithmRevision: 6,
    materials, dependencyHash: dependencyHash(frozen, materials), grade } });
}
export function selectR100ProductionRecipe(seed: number, grade: PollutionGrade, history?: RiftWorldHistory): WorldProductionRecipeV3 {
  return createR100ProductionRecipe(selectR100WorldId(seed, history), seed, grade);
}
/** Validate the saved data, not today's whole catalog. This is the key distinction
 * between frozen v3 recovery and a silently recompiled current-world recipe. */
export function validR100ProductionRecipe(value: unknown): value is WorldProductionRecipeV3 {
  try {
    if (!value || typeof value !== 'object') return false;
    const recipe = value as WorldProductionRecipeV3, native = recipe.nativeDefinition, pack = recipe.package;
    // Old saved packages are validated against their immutable catalog, rules and assets.
    if (pack?.algorithmRevision === 1 || pack?.algorithmRevision === 2) return validFrozenR100ProductionRecipe(value);
    if (pack?.algorithmRevision === 3) return validRevision3Recipe(value);
    if (pack?.algorithmRevision === 4) return validRevision4Recipe(value);
    if (pack?.algorithmRevision === 5) return validRevision5Recipe(value);
    if (recipe.version !== 3 || recipe.paintGeometryVersion !== 2 || !Number.isSafeInteger(recipe.requestedSeed)
      || recipe.requestedSeed < 0 || recipe.requestedSeed > 0xffffffff || !native || !isPollutionGrade(native.grade)
      || recipe.contentFragmentTypeId !== 'frag-outdoor' || !pack || pack.algorithm !== 'r100-native' || pack.version !== 3
      || pack.algorithmRevision !== 6 || pack.grade !== native.grade || !/^r100-[a-z][a-z0-9-]+$/.test(pack.id)
      || !R100_NATIVE_WORLDS.some(world => `r100-${world.id}` === pack.id)
      || !Array.isArray(native.instances) || native.instances.length < 1 || native.instances.length > 32
      || !Number.isSafeInteger(native.cols) || !Number.isSafeInteger(native.rows) || native.cols < 24 || native.cols > 40 || native.rows < 18 || native.rows > 32
      || !isPollutionGradeDefinition(recipe.gradeDefinition) || recipe.gradeDefinition.id !== native.grade
      || recipe.contentDefinition?.grade_id !== native.grade || recipe.contentDefinition.version !== 2
      || !validR100WorldAppearance(recipe.appearance) || `r100-${recipe.appearance.worldId}` !== pack.id
      || recipe.profile?.id !== native.profile || JSON.stringify(recipe).length > 60000) return false;
    validateNativeErosion(native.erosion, native.cols * 32, native.rows * 32);
    const ids = new Set<number>();
    for (const instance of native.instances) {
      if (!instance || (instance.role !== 'solid' && instance.role !== 'relief') || ids.has(instance.id)) return false;
      ids.add(instance.id);
      const { role, ...geometry } = instance;
      validateNativeVolumeSpec({ ...geometry, blocking: role === 'solid' ? 1 : 0,
        family: instance.family ?? native.family, seed: native.seed });
    }
    validateNativeGroundEdgeOwnership(native);
    const materials = materialDependencies(native, recipe.appearance), { package: _package, ...frozen } = recipe;
    return equal(pack.materials, materials) && pack.dependencyHash === dependencyHash(frozen, materials, pack.algorithmRevision);
  } catch { return false; }
}
