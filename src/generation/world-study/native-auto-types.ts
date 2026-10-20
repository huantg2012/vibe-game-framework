import type {PollutionGrade} from './pollution-grade';
import type {NativeSpatialRuntimeInput} from './native-spatial-types';

/** Shared grade policy. No world identifier or successful seed belongs here. */
export interface NativeAutoConstructionPolicy {
  readonly grade:PollutionGrade;
  readonly sourceHash:string;
  readonly targetWalkAreaPx2:number;
  readonly coreWidthPx:number;readonly coreHeightPx:number;
  readonly armWidthPx:number;readonly armHeightPx:number;
  readonly armOverlapPx:number;readonly armOffsetPx:number;
  readonly siteSpacingPx:number;readonly siteJitterPx:number;
  readonly edgeClearancePx:number;readonly objectClearancePx:number;
  readonly sourcePaddingPx:number;readonly maxSiteEvaluations:number;
  readonly maxPlacementStates:number;readonly placementBranchLimit:number;
  readonly refinementPasses:number;readonly maxRefinementEvaluations:number;
  readonly minWidePercent:number;readonly targetWidePercent:number;
  readonly maxSourceAreaPercent:number;
  readonly shoreSegmentMinPx:number;readonly shoreSegmentMaxPx:number;
  readonly shoreDepthMinPx:number;readonly shoreDepthMaxPx:number;
  readonly shoreProtectedGapPx:number;readonly maxCleanRunPx:number;
}

/** Every value needed by construction is captured at departure. */
export interface NativeAutoRuntimeInput {
  readonly algorithm:'native-auto-construction-v1';
  readonly version:1;
  readonly worldId:string;
  readonly grade:PollutionGrade;
  readonly geometrySeed:number;
  readonly sourceFingerprint:string;
  readonly policy:NativeAutoConstructionPolicy;
  readonly intent:Readonly<{coreWidthPx:number;coreHeightPx:number;estimatedBlockedAreaPx2:number;estimatedBoundaryLossPx2:number;estimatedGrossAreaPx2:number}>;
  readonly nativeSpatial:NativeSpatialRuntimeInput;
}

export type NativeAutoRect = [number,number,number,number];
