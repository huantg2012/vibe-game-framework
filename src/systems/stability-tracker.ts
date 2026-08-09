/**
 * StabilityTracker — tracks progress toward purification completion.
 *
 * Progress accumulates from successful actions (extraction, upgrades, surviving
 * crests, advancing tides) and decreases from failures (modules reaching zero).
 * Once progress hits 100% it stays reached permanently.
 *
 * Module-level singleton (DEC-ARCH-002).
 * Spec: docs/specs/system-growth-tide.md, section S (rules S21-S23).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';
import type { StabilityState } from '@/types/game-types';

const S = GAME_CONSTANTS.STABILITY;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let progress = 0;
let reached = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const stabilityTracker = {
  /** Get current progress (0-100). */
  getProgress(): number {
    return progress;
  },

  /** Whether purification completion has been reached (once true, stays true). */
  isReached(): boolean {
    return reached;
  },

  /**
   * Add (or subtract) progress. Clamped to [0, 100].
   * Emits STABILITY_CHANGED with the delta applied.
   * When progress reaches 100 for the first time, sets `reached = true`.
   */
  addProgress(reason: string, amount: number): void {
    void reason; // For debugging/logging; not stored in state

    const before = progress;
    progress = Math.max(0, Math.min(S.MAX, progress + amount));
    const delta = progress - before;

    if (delta === 0) return;

    eventBus.emit(GameEvent.STABILITY_CHANGED, { progress, delta });

    if (progress >= S.MAX && !reached) {
      reached = true;
    }
  },

  /** Serialize current state for saving. */
  getState(): StabilityState {
    return { progress, reached };
  },

  /** Restore state from save data. */
  loadState(saved: StabilityState): void {
    progress = saved.progress;
    reached = saved.reached;
  },

  /** Reset to initial state (new game). */
  reset(): void {
    progress = 0;
    reached = false;
  },
};
