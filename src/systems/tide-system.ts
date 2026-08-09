/**
 * TideSystem — replaces linear intensity escalation with a multi-phase tide model.
 *
 * Each Tide has three phases: Rise -> Crest -> Ebb.
 * Intensity ramps up during Rise, holds at peak during Crest, and drops during Ebb.
 * Final Tide (5) has an infinite Crest — the game never auto-ends.
 *
 * Module-level singleton (DEC-ARCH-002).
 * Spec: docs/specs/system-growth-tide.md, section T (rules T1-T7).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';
import type { TidePhase, TideState } from '@/types/game-types';

const TIDES = GAME_CONSTANTS.TIDE.TIDES;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let state: TideState = {
  tideNumber: 1,
  phase: 'rise' as TidePhase,
  cycleInPhase: 0,
  currentIntensity: TIDES[0]!.floor,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTideConfig(tideNum: number) {
  return TIDES[Math.min(tideNum - 1, TIDES.length - 1)]!;
}

function isFinalTide(tideNum: number): boolean {
  return tideNum >= TIDES.length;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const tideSystem = {
  getState(): TideState {
    return { ...state };
  },

  getCurrentIntensity(): number {
    return state.currentIntensity;
  },

  isHighTide(): boolean {
    return state.phase === 'crest';
  },

  /**
   * Advance the tide state machine by one cycle (called after each sortie return).
   * Updates intensity according to the current phase, and transitions phases/tides
   * when the current phase is exhausted.
   */
  advanceCycle(): void {
    const cfg = getTideConfig(state.tideNumber);
    state.cycleInPhase++;

    // Apply intensity change for the current phase
    switch (state.phase) {
      case 'rise': {
        const step = (cfg.peak - cfg.floor) / cfg.riseCycles;
        state.currentIntensity += step;
        // Clamp to peak
        if (state.currentIntensity > cfg.peak) state.currentIntensity = cfg.peak;
        break;
      }
      case 'crest': {
        // Intensity stays at peak. Final tide crest is infinite.
        state.currentIntensity = cfg.peak;
        break;
      }
      case 'ebb': {
        const step = (cfg.peak - cfg.ebbTarget) / cfg.ebbCycles;
        state.currentIntensity -= step;
        // Clamp to ebb target
        if (state.currentIntensity < cfg.ebbTarget) state.currentIntensity = cfg.ebbTarget;
        break;
      }
    }

    // Check phase completion and transition
    let phaseChanged = false;

    if (state.phase === 'rise' && state.cycleInPhase >= cfg.riseCycles) {
      state.phase = 'crest';
      state.cycleInPhase = 0;
      state.currentIntensity = cfg.peak;
      phaseChanged = true;
    } else if (state.phase === 'crest' && !isFinalTide(state.tideNumber) && state.cycleInPhase >= cfg.crestCycles) {
      state.phase = 'ebb';
      state.cycleInPhase = 0;
      phaseChanged = true;
    } else if (state.phase === 'ebb' && state.cycleInPhase >= cfg.ebbCycles) {
      // Transition to next tide
      state.currentIntensity = cfg.ebbTarget;
      state.tideNumber++;
      state.phase = 'rise';
      state.cycleInPhase = 0;
      phaseChanged = true;
    }

    if (phaseChanged) {
      eventBus.emit(GameEvent.TIDE_PHASE_CHANGED, {
        tide: state.tideNumber,
        phase: state.phase,
        intensity: state.currentIntensity,
      });
    }
  },

  /** Reset to initial state (new game). */
  reset(): void {
    state = {
      tideNumber: 1,
      phase: 'rise',
      cycleInPhase: 0,
      currentIntensity: TIDES[0]!.floor,
    };
  },

  /** Load state from save data. */
  loadState(saved: TideState): void {
    state = { ...saved };
  },
};
