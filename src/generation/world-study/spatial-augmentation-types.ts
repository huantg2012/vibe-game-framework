/** Frozen, CSV-owned policy. Validation never consults the current authoring tables. */
import type { NativeVolumeFamily, NativeVolumeShapeProfile } from './native-volume-geometry';
import { validateNativeVolumeSpec } from './native-volume-geometry';
import type { Vector2 } from '@/types/game-types';

export interface SpatialAugmentationParameters {
  readonly referenceSightPx: number; readonly physicalRadiusPx: number; readonly occlusionRadiusPx: number; readonly probeStepPx: number;
  readonly maxRounds: number; readonly maxCandidatesPerRound: number; readonly maxAddedSolids: number; readonly maxAddedVoids: number;
  readonly maxRemovedBaseRatio: number; readonly maxSolidAddedRatio: number; readonly maxBodyCenterLossRatio: number;
  readonly minReachableRatio: number; readonly wideCoreRadiusPx: number; readonly minWideCoreRetainedRatio: number;
  readonly minLargestOpenCoreRetainedRatio: number; readonly minVoidSeparationPx: number; readonly minSolidSeparationPx: number;
  readonly minimumImprovement: number; readonly voidLengthMinPx: number; readonly voidLengthMaxPx: number;
  readonly voidWidthMinPx: number; readonly voidWidthMaxPx: number; readonly comboOffsetPx: number; readonly hotspotRadiusPx: number;
  readonly targetPhysicalReduction: number; readonly targetOcclusionReduction: number; readonly targetBlockedPairRatio: number;
  readonly minValidOcclusionPairs: number; readonly physicalComponentMinSpanPx: number; readonly physicalComponentMinAreaPx2: number;
  readonly revealRouteMinPx: number; readonly revealRouteMaxPx: number; readonly repeatSpacingToleranceRatio: number; readonly repeatAngleToleranceDeg: number;
}
export interface SpatialAugmentationProfile {
  readonly id: string; readonly family: NativeVolumeFamily; readonly constructionVersion: 4; readonly shapeProfile: NativeVolumeShapeProfile;
  readonly minLengthPx: number; readonly maxLengthPx: number; readonly minWidthPx: number; readonly maxWidthPx: number;
  readonly minHeightPx: number; readonly maxHeightPx: number; readonly thicknessPx: number; readonly fold: number; readonly branches: number;
  readonly opening: number; readonly distortion: number; readonly rotationOffsetRad: number;
}
export interface SpatialAugmentationPolicy {
  readonly algorithm: 'spatial-completion-v1'; readonly version: 1; readonly enabled: boolean; readonly sourceHash: string;
  readonly parameters: SpatialAugmentationParameters; readonly profiles: readonly SpatialAugmentationProfile[];
}
export type SpatialAugmentationAxis = 'physical' | 'occlusion';
export type SpatialAugmentationKind = 'solid' | 'void' | 'combined';
export interface SpatialDeficits { readonly physical: number; readonly occlusion: number }
export interface SpatialRevealWitness {
  readonly observer: Readonly<Vector2>; readonly hidden: Readonly<Vector2>; readonly revealed: Readonly<Vector2>;
  readonly route: readonly Readonly<Vector2>[]; readonly routeLengthPx: number;
}
export interface SpatialCandidateReceipt {
  readonly id: string; readonly kind: SpatialAugmentationKind; readonly axis: SpatialAugmentationAxis;
  readonly hotspot: Readonly<Vector2>; readonly accepted: boolean; readonly reasons: readonly string[];
  readonly deficits?: SpatialDeficits; readonly targetImprovement?: number;
  readonly removedBaseRatio?: number; readonly addedSolidRatio?: number; readonly bodyCenterLossRatio?: number;
  readonly wideCoreRetainedRatio?: number | null; readonly largestOpenCoreRetainedRatio?: number | null;
  readonly reveal?: SpatialRevealWitness;
}
export interface SpatialAugmentationTrace {
  readonly algorithm: 'spatial-completion-v1'; readonly geometrySeed:number; readonly candidateSeed:number; readonly status: 'disabled' | 'policy-targets-met' | 'no-feasible-improvement' | 'budget-exhausted';
  readonly rounds: number; readonly evaluatedCandidates: number; readonly baselineDeficits: SpatialDeficits; readonly remainingDeficits: SpatialDeficits;
  readonly acceptedCandidateIds: readonly string[]; readonly addedSolidIds: readonly number[]; readonly addedVoidCount: number;
  readonly candidates: readonly SpatialCandidateReceipt[]; readonly fallback: boolean;
  readonly limitations: readonly string[];
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: object, expected: readonly string[]): boolean => Object.keys(value).length === expected.length && expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
/** Structural bounds are resource/serialization guards, not alternate tuning defaults. */
export const SPATIAL_PARAMETER_BOUNDS: Readonly<Record<keyof SpatialAugmentationParameters, readonly [number, number]>> = {
  referenceSightPx:[8,1024],physicalRadiusPx:[8,1024],occlusionRadiusPx:[8,1024],probeStepPx:[8,64],maxRounds:[1,4],maxCandidatesPerRound:[3,18],
  maxAddedSolids:[0,8],maxAddedVoids:[0,4],maxRemovedBaseRatio:[0,.3],maxSolidAddedRatio:[0,.3],maxBodyCenterLossRatio:[0,.4],minReachableRatio:[.97,1],
  wideCoreRadiusPx:[10,256],minWideCoreRetainedRatio:[0,1],minLargestOpenCoreRetainedRatio:[0,1],minVoidSeparationPx:[16,512],minSolidSeparationPx:[16,256],
  minimumImprovement:[.001,1],voidLengthMinPx:[16,512],voidLengthMaxPx:[16,512],voidWidthMinPx:[16,512],voidWidthMaxPx:[16,512],comboOffsetPx:[16,512],hotspotRadiusPx:[32,1024],
  targetPhysicalReduction:[0,1],targetOcclusionReduction:[0,1],targetBlockedPairRatio:[.01,1],minValidOcclusionPairs:[1,16],physicalComponentMinSpanPx:[0,4096],physicalComponentMinAreaPx2:[0,4194304],revealRouteMinPx:[8,1024],revealRouteMaxPx:[8,2048],repeatSpacingToleranceRatio:[0,.5],repeatAngleToleranceDeg:[0,45],
};
export function validSpatialAugmentationPolicy(value: unknown): value is SpatialAugmentationPolicy {
  try {
    if (!object(value) || !keys(value,['algorithm','version','enabled','sourceHash','parameters','profiles']) || value.algorithm !== 'spatial-completion-v1'
      || value.version !== 1 || typeof value.enabled !== 'boolean' || typeof value.sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.sourceHash)
      || !object(value.parameters) || !keys(value.parameters,Object.keys(SPATIAL_PARAMETER_BOUNDS)) || !Array.isArray(value.profiles) || value.profiles.length > 24) return false;
    const p = value.parameters;
    for (const [key,[min,max]] of Object.entries(SPATIAL_PARAMETER_BOUNDS)) if (!finite(p[key],min,max)) return false;
    for (const key of ['maxRounds','maxCandidatesPerRound','maxAddedSolids','maxAddedVoids','minValidOcclusionPairs','probeStepPx']) if (!Number.isInteger(p[key])) return false;
    if ((p.probeStepPx as number) % 8 || (p.voidLengthMinPx as number) > (p.voidLengthMaxPx as number)
      || (p.voidWidthMinPx as number) > (p.voidWidthMaxPx as number) || (p.revealRouteMinPx as number) > (p.revealRouteMaxPx as number)) return false;
    const ids = new Set<string>();
    for (const item of value.profiles) {
      if (!object(item) || !keys(item,['id','family','constructionVersion','shapeProfile','minLengthPx','maxLengthPx','minWidthPx','maxWidthPx','minHeightPx','maxHeightPx','thicknessPx','fold','branches','opening','distortion','rotationOffsetRad'])
        || item.constructionVersion !== 4 || typeof item.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(item.id) || ids.has(item.id) || !finite(item.rotationOffsetRad,-Math.PI*2,Math.PI*2)) return false;
      ids.add(item.id);
      const profile = item as unknown as SpatialAugmentationProfile;
      if (profile.minLengthPx > profile.maxLengthPx || profile.minWidthPx > profile.maxWidthPx || profile.minHeightPx > profile.maxHeightPx) return false;
      for (const maximum of [false,true]) validateNativeVolumeSpec({id:1,family:profile.family,seed:0,x:0,y:0,rotation:profile.rotationOffsetRad,
        length:maximum?profile.maxLengthPx:profile.minLengthPx,width:maximum?profile.maxWidthPx:profile.minWidthPx,height:maximum?profile.maxHeightPx:profile.minHeightPx,
        thickness:profile.thicknessPx,fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion,constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile,blocking:1});
    }
    return true;
  } catch { return false; }
}
