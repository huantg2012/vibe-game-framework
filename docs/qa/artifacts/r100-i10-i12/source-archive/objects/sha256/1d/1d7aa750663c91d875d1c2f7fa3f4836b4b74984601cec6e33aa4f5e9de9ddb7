import { ATMOSPHERE_LINES, type AtmospherePool } from '../generated/atmosphere-copy-data';
import { NarrationMemory, type NarrationRow, type NarrationStorage } from './narration-memory';

export type { AtmospherePool } from '../generated/atmosphere-copy-data';
export { NarrationMemory, NARRATION_STORAGE_KEY } from './narration-memory';
let shared: NarrationMemory | null = null;
function memory(): NarrationMemory {
  if (!shared) {
    let storage: NarrationStorage | null = null;
    try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { /* Storage can throw even on property access. */ }
    shared = new NarrationMemory(storage);
  }
  return shared;
}

/** Call after presentation eligibility and the destination DOM are confirmed.
 * Returning a line consumes it; speculative/preload calls are not presentation. */
export function chooseNarration<T extends NarrationRow>(scope: string, rows: readonly T[]): T {
  return memory().choose(scope, rows);
}

export function pickAtmosphere(pool: AtmospherePool): string {
  return chooseNarration(`atmosphere:${pool}`, ATMOSPHERE_LINES[pool]).text;
}
