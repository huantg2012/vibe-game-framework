import type { Vector2 } from '@/types/game-types';
import type { SpatialExtractionPolicy } from './spatial-extraction-selection';
import type { R100SpatialDeploymentPolicy } from './r100-spatial-deployment';

export type R100SpatialOrganization = 'offset-divides' | 'broken-bay' | 'staggered-reaches' | 'single-buttress' | 'joined-quarters' | 'authored-group' | 'authored-sectors';
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
/** CSV table schemas remain stable even when a strategy has no current rows. */
export interface R100SpatialAuthoringTables {
  readonly WORLDS: readonly {
    readonly worldId: string;
    readonly organization: R100SpatialOrganization;
    readonly mirrorX: boolean;
    readonly mirrorY: boolean;
  }[];
  readonly PLACEMENTS: readonly (R100SpatialPlacement & { readonly organization: R100SpatialOrganization })[];
  readonly EROSION: readonly {
    readonly organization: R100SpatialOrganization;
    readonly id: string;
    readonly points: readonly Readonly<Vector2>[];
  }[];
  readonly ANCHORS: readonly (Readonly<Vector2> & { readonly organization: R100SpatialOrganization; readonly id: number })[];
  readonly MATERIALS: readonly R100SpatialMaterial[];
  readonly ORGANIZATIONS: readonly (R100SpatialOrganizationRules & {
    readonly organization: R100SpatialOrganization;
    readonly placementJitterPx: number;
  })[];
  readonly AUTHORED_GROUPS: readonly {
    readonly worldId: string;
    readonly transform: R100SpatialGroupTransform;
    readonly solidCount: number;
    readonly reliefCount: number;
    readonly placements: readonly R100SpatialPlacement[];
    readonly erosion: readonly (readonly Readonly<Vector2>[])[];
  }[];
  readonly SECTORS: readonly {
    readonly worldId: string;
    readonly organizationRules: R100SpatialOrganizationRules;
    readonly placementJitterPx: number;
    readonly placements: readonly R100SpatialPlacement[];
    readonly erosion: readonly (readonly Readonly<Vector2>[])[];
    readonly spawnCandidates: readonly Readonly<Vector2>[];
    readonly terrainOutline?: readonly Readonly<Vector2>[];
  }[];
}
/** Complete departure snapshot. Recovery never consults today's spatial CSV. */
export interface R100SpatialPolicy {
  readonly version: 1 | 2;
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
  /** Positive ground ring; absent frozen policies retain their legacy terrain. */
  readonly terrainOutline?: readonly Readonly<Vector2>[];
  /** Revision 8: exact authored layout, compiler identity and original-trip edge seed. */
  readonly fragmentShape?: import('./r100-fragment-shape').R100FrozenFragmentShape;
  readonly spawnCandidates: readonly Readonly<Vector2>[];
  readonly extraction: SpatialExtractionPolicy;
  readonly deployment: R100SpatialDeploymentPolicy;
}
