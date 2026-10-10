import type { Vector2 } from '@/types/game-types';
import type { SpatialExtractionPolicy } from './spatial-extraction-selection';
import type { R100SpatialDeploymentPolicy } from './r100-spatial-deployment';

export type R100SpatialOrganization = 'offset-divides' | 'broken-bay' | 'staggered-reaches' | 'single-buttress' | 'joined-quarters' | 'authored-group';
export interface R100SpatialGroupTransform {
  readonly scale: number;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
}
export interface R100SpatialOrganizationRules {
  readonly sourceMode: 'repeat' | 'source-once';
  readonly materialScaling: boolean;
  readonly solidCount: number;
  readonly reliefCount: number;
}
export interface R100SpatialPlacement {
  readonly id: number;
  readonly role: 'solid' | 'relief';
  /** Source index within this role; repeated only for registered repeat layouts. */
  readonly sourceIndex: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly length: number;
  readonly width: number;
}
export interface R100SpatialMaterial {
  /** Explicit shape profile takes precedence over the material family. */
  readonly key: string;
  readonly lengthScale: number;
  readonly widthScale: number;
}
/** Complete departure snapshot. Recovery never consults today's spatial CSV. */
export interface R100SpatialPolicy {
  readonly version: 1;
  readonly worldId: string;
  readonly sourceHash: string;
  readonly organization: R100SpatialOrganization;
  readonly organizationRules: R100SpatialOrganizationRules;
  /** One affine transform for the entire authored group; never role-wise slots. */
  readonly groupTransform: R100SpatialGroupTransform | null;
  readonly cols: number;
  readonly rows: number;
  readonly mirrorX: boolean;
  readonly mirrorY: boolean;
  readonly placementJitterPx: number;
  readonly placements: readonly R100SpatialPlacement[];
  readonly materials: readonly R100SpatialMaterial[];
  readonly erosion: readonly (readonly Readonly<Vector2>[])[];
  readonly spawnCandidates: readonly Readonly<Vector2>[];
  readonly extraction: SpatialExtractionPolicy;
  readonly deployment: R100SpatialDeploymentPolicy;
}
