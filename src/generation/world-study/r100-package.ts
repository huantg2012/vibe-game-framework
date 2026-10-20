import { validR100ProductionRecipe as validRevision11Recipe } from '../legacy-r100-v11/executor-recovery.js';
import { validR100ProductionRecipe as validRevision10Recipe } from '../legacy-r100-v10/executor-recovery.js';
import { SPATIAL_AUGMENTATION_POLICY } from '@/generated/r100-spatial-augmentation';
import { createNativeSpatialRuntimeInput, validNativeSpatialRuntimeInput } from './native-spatial-recipe';
import {applyNativeConstructionIntent,createNativeConstructionRuntimeInput,validNativeConstructionRuntimeInput,validNativeConstructionContentBank} from './native-construction-recipe';
import {resolveEnemyWorldAdaptation,type EnemyWorldAdaptation} from '@/entities/form-renderers/d/world-adaptation';
import {NATIVE_ENEMY_DEPLOYMENTS} from '@/generated/r100-enemy-deployment';
import {validNativeEnemyDeployment} from './native-enemy-deployment';
import { validR100ProductionRecipe as validRevision9Recipe } from '../legacy-r100-v9/executor-recovery.js';
/** A departure freezes the exact native geometry/rules. Adding catalog rows does
 * not invalidate previously frozen v3 departures. Existing asset paths are immutable. */
import { validR100ProductionRecipe as validFrozenR100ProductionRecipe } from '../legacy-r100-v2/executor.js';
import { validR100ProductionRecipe as validRevision3Recipe } from '../legacy-r100-v3/executor.js';
import { validR100ProductionRecipe as validRevision5Recipe } from '../legacy-r100-v5/executor-recovery.js';
import { validR100ProductionRecipe as validRevision4Recipe } from '../legacy-r100-v4/executor.js';
import { validR100ProductionRecipe as validRevision6Recipe } from '../legacy-r100-v6/executor-recovery.js';
import { validR100ProductionRecipe as validRevision7Recipe } from '../legacy-r100-v7/executor-recovery.js';
import { validR100ProductionRecipe as validRevision8Recipe } from '../legacy-r100-v8/executor-recovery.js';
import { R100_SEARCH_SITE_POLICIES } from '@/generated/r100-search-sites';
import { validSearchSitePolicy } from './search-site-placement';
import { createR100SpatialPolicy } from './r100-spatial-world';
import { R100_WORLD_APPEARANCES } from '@/generated/r100-world-appearance';
import { profileWithWorldAppearance, validR100WorldAppearance, type R100WorldAppearance } from './r100-world-appearance';
import { R100_MATERIAL_DEPENDENCIES } from '@/generated/r100-package-manifest';
import { R100_NATIVE_WORLDS } from '@/generated/r100-native-worlds';
import { R100_EXPEDITION_GRADES } from '@/generated/rift-expedition-grade-data';
import { RIFT_LOW_EXPEDITION_OVERRIDES } from '@/generated/rift-low-expedition-data';
import { NATIVE_LOW_CONSTRUCTION_SOURCES } from '@/generated/r100-native-low-construction';
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
  readonly algorithmRevision: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
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
function dependencyHash(recipe: Omit<WorldProductionRecipeV3, 'package'>, materials: R100PackageIdentity['materials'], revision: 8 | 11 | 12 | 13): string {
  // Public copy is frozen for display, but does not redefine the map/loot algorithm.
  return fingerprint({ algorithm: `r100-native@3.${revision}`, native: recipe.nativeDefinition, profile: recipe.profile, space: recipe.space,
    contentFragmentTypeId: recipe.contentFragmentTypeId, grade: recipe.gradeDefinition, contents: recipe.contentDefinition, spatialPolicy: recipe.spatialPolicy, appearance: recipe.appearance, materials,
    ...(revision === 11 ? { searchSitePolicy: recipe.searchSitePolicy, augmentationPolicy: recipe.augmentationPolicy } : {}),
    ...(revision >= 12 ? { searchSitePolicy: recipe.searchSitePolicy, nativeSpatial: recipe.nativeSpatial } : {}),
    ...(revision === 13 ? {nativeConstruction:recipe.nativeConstruction,surfacePixelBudget:recipe.surfacePixelBudget,enemyMaterialVersion:recipe.enemyMaterialVersion,enemyMaterial:recipe.enemyMaterial,enemyDeployment:recipe.enemyDeployment} : {}) });
}
/** Normal departures use the validated production revision, including worlds
 * that also have an experimental native-spatial authoring definition. */
export function createR100ProductionRecipe(worldId: string, seed: number, grade: PollutionGrade): WorldProductionRecipeV3 {
  return createR100Recipe(worldId, seed, grade, false);
}
/** Explicit DEV opt-in. Unavailable native intent rejects instead of silently
 * substituting a production recipe. Frozen r12 validation/replay is unchanged. */
export function createR100NativeSpatialDevelopmentRecipe(worldId: string, seed: number, grade: PollutionGrade): WorldProductionRecipeV3 {
  return createR100Recipe(worldId, seed, grade, true);
}
/** Explicit diagnostic access until each registered source is admitted. */
export function createR100DirectConstructionRecipe(worldId:string,seed:number,grade:PollutionGrade):WorldProductionRecipeV3 {
  return createR100Recipe(worldId,seed,grade,false,true);
}
function createR100Recipe(worldId: string, seed: number, grade: PollutionGrade, nativeDevelopment: boolean,directDevelopment=false): WorldProductionRecipeV3 {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !isPollutionGrade(grade)) throw new Error('Invalid native departure seed/grade');
  const world = R100_NATIVE_WORLDS.find(row => row.id === worldId);
  if (!world) throw new Error(`Unknown native world ${worldId}`);
  const appearance = R100_WORLD_APPEARANCES.find(row => row.worldId === worldId);
  if (!appearance) throw new Error(`Missing native world appearance ${worldId}`);
  const gradeNativeDefinition = world.definitions.find(definition => definition.grade === grade)!;
  const gradeDefinition = POLLUTION_GRADE_DEFINITIONS.find(row => row.id === grade)!;
  const baseContentDefinition = R100_EXPEDITION_GRADES.find(row => row.grade_id === grade)!;
  const lowContent = grade === 'low' ? RIFT_LOW_EXPEDITION_OVERRIDES.find(row => row.worldId === worldId) : undefined;
  const contentDefinition = lowContent ? { ...baseContentDefinition, kindling_safe_count: lowContent.kindling_safe_count,
    kindling_contested_count: lowContent.kindling_contested_count, kindling_deep_count: lowContent.kindling_deep_count,
    kindling_safe_allow_weapon: lowContent.kindling_safe_allow_weapon } : baseContentDefinition;
  const constructionSource=nativeDevelopment?undefined:createNativeConstructionRuntimeInput(worldId,directDevelopment);
  const lowConstruction=constructionSource&&grade==='low'
    ?NATIVE_LOW_CONSTRUCTION_SOURCES.find(row=>row.worldId===worldId&&row.enabled):undefined;
  const authoredConstruction=constructionSource&&lowConstruction?{...constructionSource,
    reference:lowConstruction.reference,shore:lowConstruction.shore,intent:lowConstruction.intent,
    sourceHash:lowConstruction.sourceHash}:constructionSource;
  const nativeConstruction=authoredConstruction&&lowContent?{...authoredConstruction,
    sourceHash:lowConstruction?.sourceHash??lowContent.sourceHash,
    contentSeeds:{...authoredConstruction.contentSeeds,low:[...lowContent.contentSeeds]},
    contentSeedIdentities:{...authoredConstruction.contentSeedIdentities,low:lowContent.contentIdentity}}:authoredConstruction;
  if(directDevelopment&&!nativeConstruction)throw new Error(`Direct construction is unavailable for ${worldId}`);
  // Revision 13 admits the reviewed physical mother once. Freeze all its source
  // instances; retain the requested grade's atmosphere and gameplay parameters.
  const geometrySource=nativeConstruction?world.definitions.find(definition=>definition.grade===nativeConstruction.sourceGrade)!:gradeNativeDefinition;
  const nativeDefinition=nativeConstruction?{...gradeNativeDefinition,instances:geometrySource.instances}:gradeNativeDefinition;
  let nativeSpatial = nativeDevelopment||nativeConstruction ? createNativeSpatialRuntimeInput(worldId, geometrySource) : undefined;
  if ((nativeDevelopment||nativeConstruction) && !nativeSpatial) throw new Error(`Native spatial development is unavailable for ${worldId}`);
  if(nativeConstruction&&nativeSpatial)nativeSpatial=applyNativeConstructionIntent({...nativeSpatial,
    ...(lowConstruction?{policy:{...nativeSpatial.policy,minWideRatio:lowConstruction.minWideRatio}}:{}),
    assemblies:nativeSpatial.assemblies.map(assembly=>({...assembly,grade:'all' as const,
      sourceScale:assembly.sourceScale*(lowConstruction?.assemblyScaleMultiplier??1)}))},nativeConstruction);
  const spatialPolicy = nativeSpatial ? undefined : createR100SpatialPolicy(worldId, seed);
  const searchSitePolicy = R100_SEARCH_SITE_POLICIES.find(row => row.worldId === worldId);
  if (nativeSpatial && !searchSitePolicy) throw new Error(`Native spatial world has no complete search-site policy: ${worldId}`);
  const algorithmRevision = nativeConstruction ? 13 : nativeSpatial ? 12 : searchSitePolicy ? 11 : 8;
  const enemyMaterial=nativeConstruction&&['crystal-fibre','ruptured-film'].includes(worldId)?resolveEnemyWorldAdaptation(worldId):undefined;
  if(nativeConstruction&&['crystal-fibre','ruptured-film'].includes(worldId)&&!enemyMaterial)throw new Error(`Missing admitted enemy material for ${worldId}`);
  const enemyDeployment=enemyMaterial?NATIVE_ENEMY_DEPLOYMENTS.find(row=>row.worldId===worldId&&row.grade===grade):undefined;
  if(enemyMaterial&&!validNativeEnemyDeployment(enemyDeployment,worldId,grade,gradeDefinition.paintCoverage))throw new Error(`Missing admitted enemy deployment for ${worldId}/${grade}`);
  const frozen = { version: 3 as const, requestedSeed: seed, paintGeometryVersion: 2 as const,
    profile: profileWithWorldAppearance(world.profile, appearance), appearance, space: SPACE_PROFILES[0]!, contentFragmentTypeId: 'frag-outdoor', nativeDefinition, gradeDefinition, contentDefinition,
    ...(nativeSpatial ? { nativeSpatial, searchSitePolicy } : { spatialPolicy, ...(searchSitePolicy ? { searchSitePolicy, augmentationPolicy: SPATIAL_AUGMENTATION_POLICY } : {}) }),
    ...(nativeConstruction?{nativeConstruction,surfacePixelBudget:8388608 as const,...(enemyMaterial?{enemyMaterialVersion:1 as const,enemyMaterial,enemyDeployment}:{})}:{}) };
  if (contentDefinition.version !== 2) throw new Error('Revision 8 requires expedition definition version 2');
  const materials = materialDependencies(nativeDefinition, appearance);
  return structuredClone({ ...frozen, package: { id: `r100-${worldId}`, algorithm: 'r100-native', version: 3, algorithmRevision,
    materials, dependencyHash: dependencyHash(frozen, materials, algorithmRevision), grade } });
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
    if (pack?.algorithmRevision === 6) return validRevision6Recipe(value);
    if (pack?.algorithmRevision === 7) return validRevision7Recipe(value);
    if (pack?.algorithmRevision === 8) return validRevision8Recipe(value);
    if (pack?.algorithmRevision === 9) return validRevision9Recipe(value);
    if (pack?.algorithmRevision === 10) return validRevision10Recipe(value);
    if (pack?.algorithmRevision === 11) return validRevision11Recipe(value);
    if (recipe.version !== 3 || recipe.paintGeometryVersion !== 2 || !Number.isSafeInteger(recipe.requestedSeed)
      || recipe.requestedSeed < 0 || recipe.requestedSeed > 0xffffffff || !native || !isPollutionGrade(native.grade)
      || recipe.contentFragmentTypeId !== 'frag-outdoor' || !pack || pack.algorithm !== 'r100-native' || pack.version !== 3
      || (pack.algorithmRevision !== 12&&pack.algorithmRevision !== 13) || pack.grade !== native.grade || !/^r100-[a-z][a-z0-9-]+$/.test(pack.id)
      || !R100_NATIVE_WORLDS.some(world => `r100-${world.id}` === pack.id)
      || !Array.isArray(native.instances) || native.instances.length < 1 || native.instances.length > 32
      // The source-sized mother form cannot own a second world-sized outline.
      || Object.prototype.hasOwnProperty.call(native, 'terrainOutline') || Object.prototype.hasOwnProperty.call(native, 'fragmentShapeVersion')
      || !Number.isSafeInteger(native.cols) || !Number.isSafeInteger(native.rows) || native.cols < 24 || native.cols > 40 || native.rows < 18 || native.rows > 32
      || !isPollutionGradeDefinition(recipe.gradeDefinition) || recipe.gradeDefinition.id !== native.grade
      || recipe.contentDefinition?.grade_id !== native.grade || recipe.contentDefinition.version !== 2
      || !validR100WorldAppearance(recipe.appearance) || `r100-${recipe.appearance.worldId}` !== pack.id
      || !validNativeSpatialRuntimeInput(recipe.nativeSpatial, native, recipe.appearance.worldId,pack.algorithmRevision===13?8388608:4194304)
      || Object.prototype.hasOwnProperty.call(recipe, 'spatialPolicy') || Object.prototype.hasOwnProperty.call(recipe, 'augmentationPolicy')
      || !validSearchSitePolicy(recipe.searchSitePolicy, recipe.appearance.worldId)
      || recipe.profile?.id !== native.profile || JSON.stringify(recipe).length > (pack.algorithmRevision===13?100000:60000)) return false;
    if(pack.algorithmRevision===13){
      if(recipe.surfacePixelBudget!==8388608||!validNativeConstructionRuntimeInput(recipe.nativeConstruction,recipe.appearance.worldId))return false;
      if(recipe.nativeSpatial!.assemblies.some(assembly=>assembly.grade!=='all'))return false;
      if(!equal(recipe.nativeSpatial,applyNativeConstructionIntent(recipe.nativeSpatial!,recipe.nativeConstruction!)))return false;
      const hasMaterial=['crystal-fibre','ruptured-film'].includes(recipe.appearance.worldId);
      if(hasMaterial?recipe.enemyMaterialVersion!==1||!validFrozenEnemyMaterial(recipe.enemyMaterial,recipe.appearance.worldId):recipe.enemyMaterial!==undefined||recipe.enemyMaterialVersion!==undefined)return false;
      if(hasMaterial?!validNativeEnemyDeployment(recipe.enemyDeployment,recipe.appearance.worldId,native.grade,recipe.gradeDefinition.paintCoverage):Object.prototype.hasOwnProperty.call(recipe,'enemyDeployment'))return false;
      if(!validNativeConstructionContentBank(recipe))return false;
    }else if(['nativeConstruction','surfacePixelBudget','enemyMaterial','enemyMaterialVersion','enemyDeployment'].some(key=>Object.prototype.hasOwnProperty.call(recipe,key)))return false;
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

/** Saved colours and shape grammar are self-contained, never compared with
 * today's material CSV. The complete object participates in the receipt. */
function validFrozenEnemyMaterial(value:unknown,worldId:string):value is EnemyWorldAdaptation {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const material=value as EnemyWorldAdaptation,keys=['key','worldId','kind','dark','mid','light','secondary','fibreCount','membraneSpread','motionLag','paintBranching'];
  if(Object.keys(material).length!==keys.length||!keys.every(key=>Object.prototype.hasOwnProperty.call(material,key))
    ||material.worldId!==worldId||material.kind!==(worldId==='crystal-fibre'?'fibre':'membrane')
    ||typeof material.key!=='string'||material.key.length>240||!material.key.startsWith(`world-body-v1:${worldId}:`))return false;
  if(![material.dark,material.mid,material.light,material.secondary].every(color=>Array.isArray(color)&&color.length===3&&color.every(n=>Number.isInteger(n)&&n>=0&&n<=255)))return false;
  return Number.isInteger(material.fibreCount)&&material.fibreCount>=1&&material.fibreCount<=64
    &&[material.membraneSpread,material.motionLag,material.paintBranching].every(n=>Number.isFinite(n)&&n>=0&&n<=8);
}
