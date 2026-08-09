/**
 * SaveManager — handles localStorage persistence of game state.
 *
 * Collects state from all relevant systems and serializes to a single
 * localStorage key. On load, distributes saved state back to each system.
 *
 * Module-level singleton (DEC-ARCH-002).
 * Spec: docs/specs/system-growth-tide.md, section P (rules P24-P28).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { GameEvent } from '@/types/events';
import type { SaveDataV1 } from '@/types/game-types';

const SAVE = GAME_CONSTANTS.SAVE;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const saveManager = {
  /** Check if a save file exists in localStorage. */
  hasSave(): boolean {
    return localStorage.getItem(SAVE.KEY) !== null;
  },

  /**
   * Collect all system states and persist to localStorage.
   * Emits GAME_SAVED on success.
   */
  save(): void {
    const gs = gameState.getState();
    const cs = contaminantSystem.getState();
    const tide = tideSystem.getState();
    const growth = growthSystem.getState();
    const stability = stabilityTracker.getState();

    const data: SaveDataV1 = {
      version: SAVE.VERSION as 1,
      kindlingReserve: gs.kindlingReserve,
      modules: gs.modules,
      cycle: gs.cycle,
      tide,
      contaminants: cs.contaminants,
      defenseSlots: cs.defenseSlots,
      sortieLoadout: cs.sortieLoadout,
      growth,
      stability,
    };

    localStorage.setItem(SAVE.KEY, JSON.stringify(data));
    eventBus.emit(GameEvent.GAME_SAVED, { timestamp: Date.now() });
  },

  /**
   * Load save data from localStorage and distribute to all systems.
   * Returns true if load was successful, false if no save or invalid data.
   * Emits GAME_LOADED on success.
   */
  load(): boolean {
    const raw = localStorage.getItem(SAVE.KEY);
    if (!raw) return false;

    let data: SaveDataV1;
    try {
      data = JSON.parse(raw) as SaveDataV1;
    } catch {
      return false;
    }

    // Version check
    if (data.version !== SAVE.VERSION) {
      // Future: add migration functions here
      return false;
    }

    // Distribute to systems
    gameState.loadState({
      kindlingReserve: data.kindlingReserve,
      cycle: data.cycle,
      modules: data.modules,
    });

    tideSystem.loadState(data.tide);

    contaminantSystem.loadState({
      contaminants: data.contaminants,
      defenseSlots: data.defenseSlots,
      sortieLoadout: data.sortieLoadout,
    });

    growthSystem.loadState(data.growth);
    stabilityTracker.loadState(data.stability);

    // Sync impact intensity from tide
    gameState.setImpactIntensity(data.tide.currentIntensity);

    eventBus.emit(GameEvent.GAME_LOADED, { cycle: data.cycle });
    return true;
  },

  /** Delete the save from localStorage. */
  deleteSave(): void {
    localStorage.removeItem(SAVE.KEY);
  },
};
