/** Revision-12 authoring contract. These values are frozen in a trip, not read during recovery. */
import type {NativeVolumeFamily,NativeVolumeShapeProfile} from './native-volume-geometry';
import type {NativeSpatialInitialTrace} from './native-spatial-initial-placement';
import type {NativeSpatialHoleQualification} from './native-spatial-hole-qualification';

/** Attempt-local work accounting. Never stored in a frozen recipe. */
export interface NativeSpatialGeometryWorkRequest {
  readonly kind:'initial-hole-identity'|'refinement-hole-identity'|'final-geometry';readonly candidate:number;
  readonly objectIndex?:number;readonly site?:Readonly<{x:number;y:number}>;
}
/** A control-flow stop, never a recoverable rejected placement. */
export class NativeSpatialGeometryWorkBudgetError extends Error {
  constructor(){super('Native geometry work budget exhausted before compilation');this.name='NativeSpatialGeometryWorkBudgetError';}
}
export interface NativeSpatialGeometryWorkResult {readonly accepted:boolean;readonly reasons:readonly string[];readonly invalidHoleIds?:readonly string[]}
export interface NativeSpatialGeometryWork {
  /** Check the same request deadline without reserving a geometry-work slot. */
  checkpoint():void;
  run<T extends NativeSpatialGeometryWorkResult>(request:NativeSpatialGeometryWorkRequest,work:()=>T):T;
}

export interface NativeSpatialPolicy {
  readonly algorithm:'native-joint-layout-v1'; readonly version:2; readonly enabled:boolean; readonly sourceHash:string;
  readonly planningCellFactor:number; readonly holeToSolidRatio:number; readonly holeCountAbsTolerance:number;
  readonly holeCountRelTolerance:number; readonly minSolidCount:number; readonly requireMoreHoles:boolean;
  readonly regionHoleShareMin:number; readonly regionHoleShareMax:number; readonly comparisonSpacingsPx:readonly number[];
  readonly spacingPx:number; readonly countToleranceRatio:number; readonly areaToleranceRatio:number;
  readonly maxEmptyRadiusPx:number; readonly deepEmptyThresholdPx:number; readonly maxDeepEmptySpanPx:number;
  readonly minHoleCoreRadiusPx:number; readonly minSolidAreaPx2:number; readonly minSolidSpanPx:number;
  readonly probeStepPx:number; readonly referenceSightPx:number; readonly revealRouteMinPx:number; readonly revealRouteMaxPx:number;
  readonly maxCoverRoutePx:number; readonly wideRadiusPx:number; readonly minWideRatio:number; readonly minLargestWideRatio:number;
  readonly narrowWidthPx:number; readonly maxNarrowRatio:number; readonly maxNarrowRunPx:number;
  readonly encounterRadiusPx:number; readonly minRouteLengthPx:number; readonly minRouteEncounters:number;
  readonly minRouteHoleShare:number; readonly maxRouteHoleShare:number; readonly windowSize:number; readonly minWindowHoles:number;
  readonly maxGeometryEvaluations:number; readonly maxFullCandidates:number;
}
export interface NativeSpatialWorldIntent {
  readonly worldId:string; readonly enabled:boolean; readonly annotationStatus:'reviewed';
  readonly targetWalkAreaPx2:number; readonly frameWidthPx:number; readonly frameHeightPx:number;
  readonly materialAxisRad:number; readonly landGrammar:string;
  readonly landRectMinCount:number; readonly landRectMaxCount:number;
  readonly landRectMinSpanPx:number; readonly landRectMaxSpanPx:number;
  readonly landRectMinThicknessPx:number; readonly landRectMaxThicknessPx:number; readonly landRectMinOverlapPx:number;
  readonly landCoreMinCount:number;
  readonly landCoreMaxCount:number;
  readonly landShoulderMinCount:number;
  readonly landShoulderMaxCount:number;
  readonly landShoulderMinSpanPx:number;
  readonly landShoulderMaxSpanPx:number;
  readonly landShoulderMinThicknessPx:number;
  readonly landShoulderMaxThicknessPx:number;
  readonly landShoulderMinExtensionPx:number;
  readonly landShoulderMaxExtensionPx:number;
  readonly landShoulderAttachment:'core-outward-normal-v1';
  readonly bayGrammar:'shore-rect-cut-v1';readonly bayProfileIds:readonly string[];readonly bayCountOptions:readonly number[];
}
export interface NativeSpatialBayProfile {
  readonly id:string;readonly minRectCount:number;readonly maxRectCount:number;
  readonly minDepthPx:number;readonly maxDepthPx:number;readonly minMouthPx:number;readonly maxMouthPx:number;
  readonly minOffsetRatio:number;readonly maxOffsetRatio:number;readonly minOverlapRatio:number;readonly maxOverlapRatio:number;
  readonly maxUnionSpanPx:number;readonly minRemovedLandAreaPx2:number;readonly maxRemovedLandAreaPx2:number;
  readonly minFinalThroatPx:number;readonly minBacklandPx:number;
}
export interface NativeSpatialHoleProfile {
  readonly id:string; readonly sizeClass:string; readonly weight:number;
  readonly minSpanPx:number; readonly maxSpanPx:number; readonly minThicknessPx:number; readonly maxThicknessPx:number;
  readonly minRectCount:number; readonly maxRectCount:number; readonly minOverlapRatio:number; readonly maxOverlapRatio:number;
  readonly minOffsetRatio:number; readonly maxOffsetRatio:number; readonly maxAreaPx2:number;
}
export interface NativeSpatialAssembly {
  readonly worldId:string; readonly grade:'all'|'low'|'medium'|'severe'; readonly id:string;
  readonly sourceInstanceIds:readonly number[]; readonly attachedReliefIds:readonly number[];
  readonly sourceScale:number; readonly minScale:number; readonly maxScale:number;
  readonly rotationOffsetsRad:readonly number[]; readonly maxSpanPx:number; readonly mode:'unique-once';
}
export interface NativeSpatialSubordinateProfile {
  readonly id:string; readonly family:NativeVolumeFamily; readonly constructionVersion:4; readonly shapeProfile:NativeVolumeShapeProfile;
  readonly minLengthPx:number; readonly maxLengthPx:number; readonly minWidthPx:number; readonly maxWidthPx:number;
  readonly minHeightPx:number; readonly maxHeightPx:number; readonly thicknessPx:number; readonly fold:number;
  readonly branches:number; readonly opening:number; readonly distortion:number; readonly rotationOffsetRad:number;
}
export interface NativeSpatialFrozenInput {
  readonly policy:NativeSpatialPolicy; readonly world:NativeSpatialWorldIntent;
  readonly holeProfiles:readonly NativeSpatialHoleProfile[]; readonly assemblies:readonly NativeSpatialAssembly[];
  readonly bayProfiles:readonly NativeSpatialBayProfile[];
  readonly subordinateProfiles:readonly NativeSpatialSubordinateProfile[];
}
/** Existing exploration/content rules, without any completed spatial arrangement. */
export interface NativeSpatialRuntimeInput extends NativeSpatialFrozenInput {
  readonly extraction:import('./spatial-extraction-selection').SpatialExtractionPolicy;
  readonly deployment:import('./r100-spatial-deployment').R100SpatialDeploymentPolicy;
}
export interface NativeSpatialGateResult {
  readonly accepted:boolean; readonly reasons:readonly string[]; readonly metrics:Readonly<Record<string,unknown>>;
  /** Measured quality concerns that do not reject an otherwise valid map. */
  readonly qualityDiagnostics?:readonly string[];
}
export interface NativeSpatialCandidateTrace {
  readonly candidate:number; readonly geometrySeed:number; readonly layoutSeed:number;
  readonly initialPlacement?:NativeSpatialInitialTrace;
  readonly qualification?:NativeSpatialHoleQualification;
  readonly geometryHash?:string;
  readonly actualVoidFeedback?:Readonly<{available:boolean;reason?:string;holeCount:number}>;
  readonly jointAllowed?:boolean;
  readonly duplicateOfCandidate?:number;
  readonly feedbackBaseCandidate?:number;
  readonly feedbackBaseHash?:string;
  readonly feedbackArchiveCandidates?:readonly number[];
  readonly feedbackBestCandidate?:number;
  readonly routeProbe?:Readonly<{sourceCandidate:number;sourceGeometryHash:string;refinementOrdinal:number;comparable:boolean;comparabilityReasons:readonly string[];violations:readonly number[];maximum:number|null;sum:number|null;witnessCount:number}>;
  readonly proposalKind?:'fresh'|'refinement';
  readonly countPairIndex?:number;readonly bayCountIndex?:number;readonly requestedBayCount?:number;
  readonly requestedCounts:Readonly<{holes:number;solids:number}>;
  readonly accepted:boolean; readonly reasons:readonly string[];
  readonly gates:Readonly<Record<string,NativeSpatialGateResult>>;
}
