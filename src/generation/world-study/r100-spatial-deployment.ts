import { R100_SPATIAL_DEPLOYMENT } from '@/generated/rift-spatial-deployment-data';

/** Frozen per departure. No budget or pacing value is inferred from map extent. */
export interface R100SpatialDeploymentPolicy {
  readonly version: 1;
  readonly sourceHash: string;
  readonly safe_max_extra_travel_px: number;
  readonly safe_max_approach_px: number;
  readonly contested_min_extra_travel_px: number;
  readonly contested_max_extra_travel_px: number;
  readonly deep_min_extra_travel_px: number;
  readonly deep_max_extra_travel_px: number;
  readonly max_search_approach_px: number;
  readonly node_spacing_px: number;
  readonly node_spread_weight: number;
  readonly host_min_approach_px: number;
  readonly host_max_approach_px: number;
  readonly host_region_cols: number;
  readonly host_region_rows: number;
}
const POLICY_KEYS = ['version', 'sourceHash', 'safe_max_extra_travel_px', 'safe_max_approach_px',
  'contested_min_extra_travel_px', 'contested_max_extra_travel_px', 'deep_min_extra_travel_px',
  'deep_max_extra_travel_px', 'max_search_approach_px', 'node_spacing_px', 'node_spread_weight',
  'host_min_approach_px', 'host_max_approach_px', 'host_region_cols', 'host_region_rows'] as const;

export function validateR100SpatialDeploymentPolicy(value: unknown): asserts value is R100SpatialDeploymentPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing frozen spatial deployment policy');
  const row = value as Record<string, unknown>;
  const keys = POLICY_KEYS;
  if (Object.keys(row).length !== keys.length || keys.some(key => !(key in row)) || row.version !== 1
    || typeof row.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.sourceHash)
    || keys.filter(key => key !== 'sourceHash').some(key => typeof row[key] !== 'number' || !Number.isFinite(row[key]) || (row[key] as number) <= 0)) {
    throw new Error('Invalid frozen spatial deployment policy');
  }
  const policy = value as R100SpatialDeploymentPolicy;
  if (policy.safe_max_extra_travel_px > policy.contested_min_extra_travel_px
    || policy.contested_min_extra_travel_px >= policy.contested_max_extra_travel_px
    || policy.deep_min_extra_travel_px < policy.contested_min_extra_travel_px
    || policy.deep_min_extra_travel_px >= policy.deep_max_extra_travel_px
    || policy.safe_max_approach_px > policy.max_search_approach_px
    || policy.host_min_approach_px >= policy.host_max_approach_px
    || !Number.isInteger(policy.host_region_cols) || !Number.isInteger(policy.host_region_rows)
    || policy.host_region_cols > 32 || policy.host_region_rows > 32) throw new Error('Invalid spatial deployment ranges');
}

export function getR100SpatialDeploymentPolicy(): R100SpatialDeploymentPolicy {
  validateR100SpatialDeploymentPolicy(R100_SPATIAL_DEPLOYMENT);
  return { ...R100_SPATIAL_DEPLOYMENT };
}
