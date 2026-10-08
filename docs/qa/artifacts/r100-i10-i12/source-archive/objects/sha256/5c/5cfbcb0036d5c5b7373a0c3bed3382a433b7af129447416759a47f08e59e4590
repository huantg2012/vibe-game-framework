import { WORLD_SPACE_DATA } from '@/generated/rift-world-space-data';
import type { WorldTopologyId } from './types';

/** Independent geometric controls; no material, palette or seed-specific rules. */
export interface SpaceProfile {
  readonly id: string;
  readonly label: string;
  /** Fraction of original supported land removed by interior erosion. */
  readonly voidFraction: number;
  /** Proportion of erosion attempts using short fractures instead of pits. */
  readonly crackFraction: number;
  /** Multiplier on the documented 48–112px pit / 96–224px fracture lengths. */
  readonly holeScale: number;
  /** 0 = independent orientations, 1 = a shared fracture direction. */
  readonly directionality: number;
  /** 0 = dispersed centres, 1 = bounded local erosion basin. */
  readonly clustering: number;
}

export const SPACE_PROFILES: readonly SpaceProfile[] = WORLD_SPACE_DATA;
export const SPACE_LIMITS = {
  voidFraction: [.04, .18], crackFraction: [0, 1], holeScale: [.65, 1.4],
  directionality: [0, 1], clustering: [0, 1],
} as const;

export function validateSpaceProfile(profile: SpaceProfile): void {
  if (!profile || !profile.id || !profile.label) throw new Error('Space profile needs an id and label');
  for (const key of Object.keys(SPACE_LIMITS) as (keyof typeof SPACE_LIMITS)[]) {
    const [min, max] = SPACE_LIMITS[key], value = profile[key];
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(`Space ${key} must be in [${min}, ${max}], got ${value}`);
  }
}

/** Existing URL names are aliases, not separate generator implementations. */
export function spaceProfileForTopology(topology: WorldTopologyId): SpaceProfile {
  const id = topology === 'loops' ? 'open-scars' : 'fracture-fields';
  const profile = SPACE_PROFILES.find(value => value.id === id);
  if (!profile) throw new Error(`Missing space preset ${id}`);
  validateSpaceProfile(profile);
  return profile;
}
