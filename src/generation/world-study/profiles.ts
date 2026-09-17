import { WORLD_PROFILE_DATA } from '@/generated/rift-world-profile-data';
import type { WorldProfile, WorldProfileId } from './types';

export const WORLD_PROFILES: readonly WorldProfile[] = WORLD_PROFILE_DATA;

export function worldProfileById(id: WorldProfileId | string): WorldProfile {
  const profile = WORLD_PROFILES.find(value => value.id === id);
  if (!profile) throw new Error(`Unknown world profile: ${id}`);
  return profile;
}
