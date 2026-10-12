/** Frozen environmental provenance only. Rewards and risk tiers never enter this contract. */
import type { Vector2 } from '@/types/game-types';
import type { NativeVolumeFamily } from './native-volume-geometry';

export type SearchSiteSourceKind = 'detached' | 'surface-peel' | 'ground-accumulation';
export interface R100SearchSitePolicy {
  readonly version: 1;
  readonly algorithm: 'grounded-search-v1';
  readonly worldId: string;
  readonly sourceHash: string;
  readonly sourceReachPx: number;
  readonly environmentScoreCap: number;
  readonly peelPreference: number;
  readonly footprintProfile: 'grounded-material-v1';
}
export interface R100SearchSitePlacement {
  readonly version: 1;
  readonly nodeId: string;
  readonly position: Readonly<Vector2>;
  readonly visualSeed: number;
  readonly sourceKind: SearchSiteSourceKind;
  readonly family: NativeVolumeFamily;
  readonly sourceObjectId: number | null;
  readonly sourceAnchor: Readonly<Vector2> | null;
  /** Local material direction in radians, not a claimed simulated wind/flow. */
  readonly axis: number;
  readonly footprintProfile: 'grounded-material-v1';
  /** Actual primary substrate; mixed formation material is separately recorded above. */
  readonly groundFamily: NativeVolumeFamily;
  /** Explicit sampled geometric domain; no fictitious off-screen parent. */
  readonly sourceDomain: 'formation' | 'ground';
}
