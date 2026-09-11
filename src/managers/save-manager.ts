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
import { getDefenseRuntimeState, loadDefenseRuntimeState, type ContaminantRuntimeState } from '@/systems/defense-engine';
import { growthSystem } from '@/systems/growth-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { GameEvent } from '@/types/events';
import type { ExpeditionSaveData, SaveDataV2 } from '@/types/game-types';
import type { InventoryState } from '@/types/inventory-types';
import { InventoryStore, inventoryStore } from '@/systems/inventory-store';
import { impactSystem, validImpactForecastState } from '@/systems/impact-system';

const SAVE = GAME_CONSTANTS.SAVE;

/** Defaults to browser storage; isolated development sessions inject their own backend. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let injectedStorage: SaveStorage | null = null;
function storage(): SaveStorage { return injectedStorage ?? localStorage; }

/** Check the fields consumed by existing loaders before touching live systems. */
function validSaveEnvelope(data: ExpeditionSaveData): boolean {
  if (!data || (data.version !== 1 && data.version !== 2)) return false;
  if (!Number.isFinite(data.kindlingReserve) || !Number.isFinite(data.cycle) || !Array.isArray(data.modules)) return false;
  if (data.modules.some(module => !module || typeof module.id !== 'string' || typeof module.type !== 'string' || !Number.isFinite(module.hp) || !Number.isFinite(module.maxHp))) return false;
  if (data.repairBonusHp !== undefined && (!Number.isSafeInteger(data.repairBonusHp) || data.repairBonusHp < 0)) return false;
  if (data.impactForecast !== undefined && !validImpactForecastState(data.impactForecast, data.modules.map(module => module.id))) return false;
  if (!data.tide || !Number.isFinite(data.tide.tideNumber) || !Number.isFinite(data.tide.cycleInPhase) || !Number.isFinite(data.tide.currentIntensity) || !['rise', 'crest', 'ebb'].includes(data.tide.phase)) return false;
  if (!data.growth?.upgrades || typeof data.growth.upgrades !== 'object' || !data.stability || !Number.isFinite(data.stability.progress) || typeof data.stability.reached !== 'boolean') return false;
  const probe = new InventoryStore();
  if (data.version === 2) return probe.loadState(data.inventory);
  if (!Array.isArray(data.contaminants) || !Array.isArray(data.defenseSlots) || !Array.isArray(data.sortieLoadout)) return false;
  try {
    probe.importLegacy(data.contaminants, data.defenseSlots, data.sortieLoadout);
    return probe.loadState(probe.getState());
  } catch { return false; }
}

function readSaveJson(): ExpeditionSaveData | null {
  const raw = storage().getItem(SAVE.KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as ExpeditionSaveData;
    if (data.version !== 1 && data.version !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Contaminant runtime state (D3 / DEC-032): a single flat save section indexed by
// contaminant id, merged from two owning modules — defense-engine (solidify shatter
// counter + combust burn accumulator) and contaminant-system (echo's per-tool bonus
// cap). IDs never collide because a contaminant is either defense-slotted (solidify/
// combust) or tool-stage (echo target), never both at once.
// ---------------------------------------------------------------------------

function mergeRuntimeState(
  ...maps: Record<string, ContaminantRuntimeState>[]
): Record<string, ContaminantRuntimeState> {
  const out: Record<string, ContaminantRuntimeState> = {};
  for (const m of maps) {
    for (const [id, state] of Object.entries(m)) {
      out[id] = { ...out[id], ...state };
    }
  }
  return out;
}

function collectSave(inventory: InventoryState): SaveDataV2 {
  const gs = gameState.getState();
  impactSystem.generateForecast(tideSystem.getCurrentIntensity(), growthSystem.getModifiers().forecastClarity,
    tideSystem.peekNextIntensity());
  return {
    version: 2,
    kindlingReserve: gs.kindlingReserve,
    repairBonusHp: gs.repairBonusHp,
    modules: gs.modules,
    moduleMaxHpTier: gs.moduleMaxHpTier,
    cycle: gs.cycle,
    tide: tideSystem.getState(),
    inventory,
    growth: growthSystem.getState(),
    stability: stabilityTracker.getState(),
    contaminantRuntimeState: mergeRuntimeState(getDefenseRuntimeState(), contaminantSystem.getEchoBonusState()),
    impactForecast: impactSystem.getForecastState(),
  };
}
let worldTransaction = false;
let pendingWorldSave = false;

function enableInventoryPersistence(): void {
  inventoryStore.setPersistence(inventory => {
    if (worldTransaction) return;
    if (pendingWorldSave) throw new Error("Previous settlement must be saved first");
    const beforeForecast = impactSystem.getForecastState();
    try { storage().setItem(SAVE.KEY, JSON.stringify(collectSave(inventory))); }
    catch (error) { impactSystem.loadForecastState(beforeForecast); throw error; }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const saveManager = {
  /** Call before session initialization. Every persistence path resolves this backend. */
  setStorage(backend: SaveStorage | null): void {
    if (worldTransaction || pendingWorldSave) throw new Error('Cannot replace storage during a pending settlement');
    injectedStorage = backend;
    enableInventoryPersistence();
  },
  /** A useful injection and its finite bonus must be durable together. */
  allocateToModule(id: string, amount: number): number {
    if (pendingWorldSave) return 0;
    const before = gameState.getState();
    const spent = gameState.allocateToModule(id, amount);
    if (spent <= 0) return 0;
    if (this.trySave()) return spent;
    gameState.loadState(before);
    return 0;
  },

  /** Combine a synchronous world/ownership change into one save; retry never replays effects. */
  commitWorldTransaction(change: () => void): boolean {
    if (pendingWorldSave) return false;
    worldTransaction = true;
    enableInventoryPersistence();
    try { change(); } finally { worldTransaction = false; }
    pendingWorldSave = true;
    return this.trySave();
  },

  hasPendingSave(): boolean { return pendingWorldSave; },

  /** Check if a save file exists in localStorage. */
  hasSave(): boolean {
    return storage().getItem(SAVE.KEY) !== null;
  },

  /**
   * Collect all system states and persist to localStorage.
   * Emits GAME_SAVED on success.
   */
  save(): void {
    const beforeForecast = impactSystem.getForecastState();
    try {
      const data = collectSave(inventoryStore.getState());
      storage().setItem(SAVE.KEY, JSON.stringify(data));
    } catch (error) { impactSystem.loadForecastState(beforeForecast); throw error; }
    pendingWorldSave = false;
    enableInventoryPersistence();
    eventBus.emit(GameEvent.GAME_SAVED, { timestamp: Date.now() });
  },

  /**
   * Load save data from localStorage and distribute to all systems.
   * Returns true if load was successful, false if no save or invalid data.
   * Emits GAME_LOADED on success.
   */
  load(): boolean {
    const raw = storage().getItem(SAVE.KEY);
    if (!raw) return false;

    let data: ExpeditionSaveData;
    try {
      data = JSON.parse(raw) as ExpeditionSaveData;
    } catch {
      return false;
    }

    // Validate the complete loaded payload before distributing state.
    if (!validSaveEnvelope(data)) {
      // Future: add migration functions here
      return false;
    }

    // Validate inventory before mutating any other system. Never infer an interrupted-run policy.
    inventoryStore.setPersistence(null);
    if (data.version === 2) inventoryStore.loadState(data.inventory);

    // Distribute to systems
    gameState.loadState({
      kindlingReserve: data.kindlingReserve,
      repairBonusHp: data.repairBonusHp,
      cycle: data.cycle,
      modules: data.modules,
      moduleMaxHpTier: data.moduleMaxHpTier,
    });

    tideSystem.loadState(data.tide);

    if (data.version === 1) {
      contaminantSystem.loadState({
        contaminants: data.contaminants,
        defenseSlots: data.defenseSlots,
        sortieLoadout: data.sortieLoadout,
      });
      inventoryStore.ensureStarter();
    }
    contaminantSystem.syncInventoryDerivedState();


    growthSystem.loadState(data.growth);
    stabilityTracker.loadState(data.stability);

    // Contaminant runtime state (D3/DEC-032). Old saves without this field load as
    // empty for both owners — never "loaded, then immediately cleared" because this
    // runs on the load path only, not on the new-game reset path.
    loadDefenseRuntimeState(data.contaminantRuntimeState);
    contaminantSystem.loadEchoBonusState(data.contaminantRuntimeState);
    contaminantSystem.syncInventoryDerivedState();

    // Sync impact intensity from tide
    gameState.setImpactIntensity(data.tide.currentIntensity);
    impactSystem.loadForecastState(data.impactForecast);

    // Migration is durable immediately; failure leaves the readable V1 record intact.
    if (data.version === 1 || data.inventory.version === 1) {
      try { storage().setItem(SAVE.KEY, JSON.stringify(collectSave(inventoryStore.getState()))); } catch { /* trySave exposes retry; do not erase old save */ }
    }
    enableInventoryPersistence();
    eventBus.emit(GameEvent.GAME_LOADED, { cycle: data.cycle });
    return true;
  },

  /** Explicit fallible entry point for departure and settlement UI. */
  trySave(): boolean {
    try { this.save(); return true; } catch { return false; }
  },

  /** Delete the save from localStorage. */
  deleteSave(): void {
    storage().removeItem(SAVE.KEY);
    // Starter creation happens before the other systems finish resetting.
    // Do not let that transaction save a half-reset record.
    inventoryStore.setPersistence(null);
  },

  /**
   * Peek at a save's tide number without loading it into any system (no side
   * effects). Used by the main menu to phrase the overwrite-confirmation warning
   * and to tell an unparsable save apart from a genuinely absent one — a save
   * that exists but fails this check is treated as "no continuable record"
   * rather than surfaced as a distinct corrupted-save state (main-menu-scene.ts,
   * Slice 5.5 C1).
   */
  peekTideNumber(): number | null {
    const data = readSaveJson();
    if (typeof data?.tide?.tideNumber !== 'number') return null;
    return data.tide.tideNumber;
  },

  peekTidePhase(): 'rise' | 'crest' | 'ebb' | null {
    const phase = readSaveJson()?.tide?.phase;
    if (phase === 'rise' || phase === 'crest' || phase === 'ebb') return phase;
    return null;
  },

  peekCycle(): number | null {
    const cycle = readSaveJson()?.cycle;
    return typeof cycle === 'number' ? cycle : null;
  },

  peekStability(): { progress: number; reached: boolean } | null {
    const stability = readSaveJson()?.stability;
    if (!stability || typeof stability.progress !== 'number' || typeof stability.reached !== 'boolean') {
      return null;
    }
    return { progress: stability.progress, reached: stability.reached };
  },

  peekRecordSummary(): {
    tideNumber: number;
    phase: 'rise' | 'crest' | 'ebb';
    cycle: number;
    progress: number;
    reached: boolean;
  } | null {
    const tideNumber = this.peekTideNumber();
    const phase = this.peekTidePhase();
    const cycle = this.peekCycle();
    const stability = this.peekStability();
    if (tideNumber === null || phase === null || cycle === null || stability === null) return null;
    return { tideNumber, phase, cycle, progress: stability.progress, reached: stability.reached };
  },
};
