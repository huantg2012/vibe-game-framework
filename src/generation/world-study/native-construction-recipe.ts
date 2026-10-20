/** Revision 13 freezes complete direct-construction sources at departure.
 * Recovery never consults the current construction CSV or generated catalog. */
import {NATIVE_CONSTRUCTION_SOURCES,NATIVE_CONSTRUCTION_REGISTRATIONS} from '@/generated/r100-native-construction';
import {constructNativeSpatialReference,parseNativeSpatialConstructionReference,type NativeSpatialConstructedReference} from './native-spatial-construction-reference';
import {parseNativeConstructionShore} from './native-spatial-construction-shore';
import type {WorldProductionRecipeV3} from './production-recipe';
import type {NativeSpatialRuntimeInput} from './native-spatial-types';
import type {PollutionGrade} from './pollution-grade';

interface NativeConstructionCSV {readonly csv:string;readonly sourceHash:string}
/** Authored before evaluation: the reviewed macro proposal's area/count intent. */
export interface NativeConstructionIntent {
  readonly frameWidthPx:number;readonly frameHeightPx:number;
  readonly targetWalkAreaPx2:number;readonly planningCellFactor:number;
}
export interface NativeConstructionSource {
  readonly worldId:string;
  readonly reference:NativeConstructionCSV;
  readonly shore:NativeConstructionCSV;
  readonly intent:NativeConstructionIntent;
  readonly sourceHash:string;
  readonly contentSeeds?:Readonly<Record<PollutionGrade,readonly number[]>>;
  readonly contentSeedIdentities?:Readonly<Record<PollutionGrade,string>>;
}
export interface NativeConstructionRuntimeInput extends NativeConstructionSource {
  readonly algorithm:'native-direct-construction-v1';
  readonly version:1;
  /** The reviewed physical construction stays stable; contents use run seed. */
  readonly seedMode:'reviewed-geometry-v1';
  readonly geometrySeed:number;
  /** Complete source model; each frozen author CSV places it independently. */
  readonly sourceGrade:'medium';
  readonly contentSeeds:Readonly<Record<PollutionGrade,readonly number[]>>;
  readonly contentSeedIdentities:Readonly<Record<PollutionGrade,string>>;
}
export interface NativeConstructionRegistration {
  readonly worldId:string;readonly enabled:boolean;readonly seedMode:'reviewed-geometry-v1';readonly geometrySeed:number;
}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const hasKeys=(value:object,keys:readonly string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
export function createNativeConstructionRuntimeInput(worldId:string,explicitDevelopment=false):NativeConstructionRuntimeInput|undefined {
  const source=NATIVE_CONSTRUCTION_SOURCES.find(row=>row.worldId===worldId);
  const registration=NATIVE_CONSTRUCTION_REGISTRATIONS.find(row=>row.worldId===worldId);
  return source&&registration&&(registration.enabled||explicitDevelopment)?structuredClone({...source,algorithm:'native-direct-construction-v1',version:1,seedMode:registration.seedMode,geometrySeed:registration.geometrySeed,sourceGrade:'medium',
    contentSeeds:source.contentSeeds??{low:[],medium:[],severe:[]},contentSeedIdentities:source.contentSeedIdentities??{low:'',medium:'',severe:''}}):undefined;
}
export function validNativeConstructionRuntimeInput(value:unknown,worldId:string):value is NativeConstructionRuntimeInput {
  try {
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const input=value as NativeConstructionRuntimeInput;
    if(!hasKeys(input,['worldId','reference','shore','intent','sourceHash','algorithm','version','seedMode','geometrySeed','sourceGrade','contentSeeds','contentSeedIdentities'])
      ||input.worldId!==worldId||input.algorithm!=='native-direct-construction-v1'||input.version!==1||input.seedMode!=='reviewed-geometry-v1'
      ||input.geometrySeed!==20261012||input.sourceGrade!=='medium'||!hash(input.sourceHash))return false;
    const grades=['low','medium','severe'] as const;
    if(!input.contentSeeds||!input.contentSeedIdentities||!hasKeys(input.contentSeeds,grades)||!hasKeys(input.contentSeedIdentities,grades))return false;
    for(const grade of grades){const seeds=input.contentSeeds[grade];if(!Array.isArray(seeds)||seeds.length<2||seeds.length>8||new Set(seeds).size!==seeds.length
      ||seeds.some(seed=>!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)||!/^[0-9a-f]{8}$/.test(input.contentSeedIdentities[grade]))return false;}
    const intent=input.intent;
    if(!intent||!hasKeys(intent,['frameWidthPx','frameHeightPx','targetWalkAreaPx2','planningCellFactor'])
      ||![intent.frameWidthPx,intent.frameHeightPx].every(n=>Number.isInteger(n)&&n>=1024&&n%32===0)
      ||intent.frameWidthPx>3072||intent.frameHeightPx>2304||intent.frameWidthPx*intent.frameHeightPx>8388608
      ||!Number.isFinite(intent.targetWalkAreaPx2)||intent.targetWalkAreaPx2<100000||intent.targetWalkAreaPx2>intent.frameWidthPx*intent.frameHeightPx
      ||!Number.isFinite(intent.planningCellFactor)||intent.planningCellFactor<=0||intent.planningCellFactor>2)return false;
    for(const source of [input.reference,input.shore])if(!source||typeof source!=='object'||!hasKeys(source,['csv','sourceHash'])||typeof source.csv!=='string'||source.csv.length>24000||!hash(source.sourceHash))return false;
    const reference=parseNativeSpatialConstructionReference(input.reference.csv,input.reference.sourceHash),shore=parseNativeConstructionShore(input.shore.csv,input.shore.sourceHash);
    return reference.worldId===worldId&&reference.grade==='medium'&&reference.seed===input.geometrySeed&&shore.referenceId===reference.id;
  }catch{return false;}
}
/** Bind certification to every frozen generation input, excluding only the
 * request and the certificate itself. No current catalog is consulted. */
export function nativeConstructionContentIdentity(recipe:WorldProductionRecipeV3):string {
  const {requestedSeed:_request,package:_package,nativeConstruction,...frozen}=recipe;
  if(!nativeConstruction)throw new Error('Content certification requires construction inputs');
  const {contentSeeds:_seeds,contentSeedIdentities:_identities,sourceHash:_hash,...construction}=nativeConstruction;
  const source=JSON.stringify({...frozen,nativeConstruction:construction});let hash=2166136261;
  for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);
  return(hash>>>0).toString(16).padStart(8,'0');
}
export function validNativeConstructionContentBank(recipe:WorldProductionRecipeV3):boolean {
  return recipe.nativeConstruction?.contentSeedIdentities[recipe.nativeDefinition.grade]===nativeConstructionContentIdentity(recipe);
}
export function applyNativeConstructionIntent(input:NativeSpatialRuntimeInput,construction:NativeConstructionRuntimeInput):NativeSpatialRuntimeInput {
  const {planningCellFactor,...world}=construction.intent;
  return{...input,policy:{...input.policy,planningCellFactor},world:{...input.world,...world}};
}
/** Pure bounded adapter. The frozen CSV supplies L/H/S at its fixed physical
 * seed and medium model source. Recovery never reshapes it from today's grade. */
export function constructNativeProductionLayout(recipe:WorldProductionRecipeV3):NativeSpatialConstructedReference {
  const input=recipe.nativeConstruction;
  if(recipe.package.algorithmRevision!==13||!input||!recipe.nativeSpatial)throw new Error('Direct construction requires a frozen revision-13 recipe');
  const parsed=parseNativeSpatialConstructionReference(input.reference.csv,input.reference.sourceHash);
  const rows=parsed.rows.map(row=>{
    if(row.kind!=='assembly')return row;
    const matching=recipe.nativeSpatial!.assemblies.find(assembly=>assembly.id===row.profile_id&&assembly.grade==='all');
    if(!matching)throw new Error(`No frozen reviewed whole assembly for ${row.profile_id}`);
    return{...row,profile_id:matching.id};
  });
  const reference={...parsed,rows,seed:input.geometrySeed,grade:recipe.nativeDefinition.grade};
  // Retain the established reference executor unchanged for old DEV callers.
  const constructionRecipe={...recipe,requestedSeed:input.geometrySeed,package:{...recipe.package,algorithmRevision:12 as const}};
  // Extension L/H/S is already present in the complete author CSV. Appending a
  // new proposal here would change the reviewed macro shape during recovery.
  return constructNativeSpatialReference(constructionRecipe,reference,undefined,
    {policy:parseNativeConstructionShore(input.shore.csv,input.shore.sourceHash),combinedSourceHash:input.sourceHash});
}
