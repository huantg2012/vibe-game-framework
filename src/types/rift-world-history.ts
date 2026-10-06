import { R100_WORLD_SELECTION_POLICY } from '@/generated/r100-world-selection';
import { isPollutionGrade, type PollutionGrade } from '@/generation/world-study/pollution-grade';

/** Committed native departures, oldest first. This does not store future rolls. */
export interface RiftWorldVisit {
  readonly worldId: string;
  readonly grade: PollutionGrade;
}
export interface RiftWorldHistory {
  readonly version: 1;
  readonly visits: readonly RiftWorldVisit[];
}

export function emptyRiftWorldHistory(): RiftWorldHistory { return { version: 1, visits: [] }; }

export function validRiftWorldVisit(value: unknown): value is RiftWorldVisit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const visit = value as RiftWorldVisit;
  // Retired identities remain valid history. Loading must not depend on today's catalog.
  return typeof visit.worldId === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(visit.worldId)
    && isPollutionGrade(visit.grade);
}

export function validRiftWorldHistory(value: unknown): value is RiftWorldHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const history = value as RiftWorldHistory;
  return history.version === 1 && Array.isArray(history.visits)
    && history.visits.length <= R100_WORLD_SELECTION_POLICY.historyLimit
    && history.visits.every(validRiftWorldVisit);
}

export function appendRiftWorldVisit(history: RiftWorldHistory, visit: RiftWorldVisit): RiftWorldHistory {
  return { version: 1, visits: [...history.visits.slice(1 - R100_WORLD_SELECTION_POLICY.historyLimit), { ...visit }] };
}
