import { UPGRADE_DATA } from '@/generated/upgrade-data';
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
import { checkpointChecksum, validRiftCheckpoint, validRiftDeparture, type RiftDepartureIntent, type RiftCheckpoint } from '@/types/rift-checkpoint';
import { runtimeInteger, runtimeNumber, runtimeRecord } from '@/systems/ai/runtime-validation';

const SAVE = GAME_CONSTANTS.SAVE;

/** Defaults to browser storage; isolated development sessions inject their own backend. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let injectedStorage: SaveStorage | null = null;
let currentRiftCheckpoint: RiftCheckpoint | undefined;
let currentRiftDeparture: RiftDepartureIntent | undefined;
let validateDeparture: ((intent: RiftDepartureIntent) => boolean) | null = null;
let validateRiftState: ((checkpoint: RiftCheckpoint, inventory: InventoryState) => boolean) | null = null;
function storage(): SaveStorage { return injectedStorage ?? localStorage; }

/** Check the fields consumed by existing loaders before touching live systems. */
function validSaveEnvelope(data: ExpeditionSaveData): boolean {
  if (!data || (data.version !== 1 && data.version !== 2)) return false;
  if (!runtimeNumber(data.kindlingReserve, 0, Number.MAX_SAFE_INTEGER) || !runtimeInteger(data.cycle)
    || !Array.isArray(data.modules)) return false;
  const tier = data.moduleMaxHpTier ?? 0;
  if (!runtimeInteger(tier, 0, GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_TIERS)) return false;
  const maxHp = GAME_CONSTANTS.PURIFICATION.MODULE_BASE_MAX_HP + tier * GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER;
  // Before Slice 7, V1 records contain CORE/STORAGE only. Current records must
  // contain all three identities exactly once; arbitrary rows cannot rescue a base.
  const expectedModules = data.version === 1 && data.modules.length === 2 ? ['CORE', 'STORAGE'] : ['CORE', 'STORAGE', 'PURIFIER'];
  if (data.modules.length !== expectedModules.length || new Set(data.modules.map(module => module?.id)).size !== expectedModules.length
    || data.modules.some(module => !module || !expectedModules.includes(module.id) || module.type !== module.id
      || module.maxHp !== maxHp || !runtimeNumber(module.hp, 0, maxHp))) return false;
  if (data.repairBonusHp !== undefined && (!Number.isSafeInteger(data.repairBonusHp) || data.repairBonusHp < 0)) return false;
  if (data.impactForecast !== undefined && !validImpactForecastState(data.impactForecast, data.modules.map(module => module.id))) return false;
  if (!data.tide || !runtimeInteger(data.tide.tideNumber, 1, GAME_CONSTANTS.TIDE.TIDES.length)
    || !runtimeInteger(data.tide.cycleInPhase) || !['rise', 'crest', 'ebb'].includes(data.tide.phase)
    || (data.tide.crestIntact !== undefined && typeof data.tide.crestIntact !== 'boolean')) return false;
  const tide = GAME_CONSTANTS.TIDE.TIDES[data.tide.tideNumber - 1]!;
  const phaseLength = data.tide.phase === 'rise' ? tide.riseCycles : data.tide.phase === 'crest' ? tide.crestCycles : tide.ebbCycles;
  const minimumIntensity = data.tide.phase === 'crest' ? tide.peak : data.tide.phase === 'ebb' ? tide.ebbTarget : tide.floor;
  if (data.tide.cycleInPhase >= phaseLength || !runtimeNumber(data.tide.currentIntensity, minimumIntensity - 1e-9, tide.peak + 1e-9)) return false;
  if (!runtimeRecord(data.growth?.upgrades) || Object.entries(data.growth.upgrades).some(([id, level]) =>
    !Object.prototype.hasOwnProperty.call(UPGRADE_DATA, id) || !runtimeInteger(level, 0, UPGRADE_DATA[id as keyof typeof UPGRADE_DATA].maxLevel))
    || !data.stability || !runtimeNumber(data.stability.progress, 0, GAME_CONSTANTS.STABILITY.MAX)
    || typeof data.stability.reached !== 'boolean' || (data.stability.progress === GAME_CONSTANTS.STABILITY.MAX && !data.stability.reached)) return false;
  if (data.contaminantRuntimeState !== undefined && (!runtimeRecord(data.contaminantRuntimeState)
    || Object.entries(data.contaminantRuntimeState).some(([id, state]) => !id || !runtimeRecord(state)
      || Object.entries(state).some(([key, value]) => key === 'solidifyCounter' ? !runtimeInteger(value, 0, 2)
        : key === 'combustAccumulator' ? !runtimeNumber(value, 0)
        : key === 'echoBonusGranted' ? !runtimeInteger(value, 0, GAME_CONSTANTS.CONTAMINANT.ECHO_MAX_TOOL_USE_BONUS) : true)))) return false;
  if (data.pendingSideEffects !== undefined && (!Array.isArray(data.pendingSideEffects) || data.pendingSideEffects.some(effect =>
    !effect || !['initial_chaos', 'chaos_rate_mult', 'vision_reduction', 'speed_reduction', 'repair_efficiency', 'upgrade_discount', 'storage_halved', 'proximity_sense_boost', 'module_swap'].includes(effect.type)
    || !Number.isFinite(effect.value) || !['next_sortie', 'timed'].includes(effect.duration)
    || (effect.durationMs !== undefined && (!Number.isFinite(effect.durationMs) || effect.durationMs < 0))))) return false;
  if (data.upgradeDiscount !== undefined && !runtimeNumber(data.upgradeDiscount, 0, 1)) return false;
  if (data.moduleSwapActive !== undefined && typeof data.moduleSwapActive !== 'boolean') return false;
  const probe = new InventoryStore();
  if (data.version === 2) {
    if (!probe.loadState(data.inventory)) return false;
    if (data.riftCheckpoint !== undefined || data.riftDeparture !== undefined) {
      if (data.riftCheckpoint !== undefined && data.riftDeparture !== undefined) return false;
      if (data.riftCheckpoint !== undefined && (!validRiftCheckpoint(data.riftCheckpoint) || data.riftCheckpoint.runId !== data.inventory.run?.id)) return false;
      if (data.riftDeparture !== undefined && (!validRiftDeparture(data.riftDeparture) || data.riftDeparture.runId !== data.inventory.run?.id
        || data.inventory.run.status !== 'active' || data.riftDeparture.conditions.cycle !== data.cycle)) return false;
      const identity = data.riftCheckpoint?.identity ?? data.riftDeparture?.identity;
      const run = data.inventory.run;
      if(run?.catalogVersion !== undefined && (identity?.catalogVersion !== run.catalogVersion
        || identity.lootAlgorithmVersion !== run.lootAlgorithmVersion || identity.combatRulesVersion !== run.combatRulesVersion)) return false;
      if(run?.dropPlan && identity?.seed !== run.dropPlan.runSeed) return false;
      const { checkpointChecksum: checksum, ...record } = data;
      if (checksum !== checkpointChecksum(record)) return false;
    } else if (data.checkpointChecksum !== undefined) return false;
    return true;
  }
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

function collectSave(inventory: InventoryState, forecast = true): SaveDataV2 {
  const gs = gameState.getState();
  if (forecast) impactSystem.generateForecast(tideSystem.getCurrentIntensity(), growthSystem.getModifiers().forecastClarity,
    tideSystem.peekNextIntensity());
  return {
    version: 2,
    kindlingReserve: gs.kindlingReserve,
    repairBonusHp: gs.repairBonusHp,
    pendingSideEffects: gs.pendingSideEffects,
    upgradeDiscount: gs.upgradeDiscount,
    moduleSwapActive: gs.moduleSwapActive,
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
let pendingWorldBytes: string | null = null;

function attachCheckpoint(data: SaveDataV2, checkpoint = currentRiftCheckpoint): SaveDataV2 {
  if (checkpoint && data.inventory.run?.id === checkpoint.runId && !data.inventory.run.baseSettled) {
    data.riftCheckpoint = checkpoint;
  } else if (currentRiftDeparture && data.inventory.run?.id === currentRiftDeparture.runId && data.inventory.run.status === 'active') {
    data.riftDeparture = currentRiftDeparture;
  }
  if (data.riftCheckpoint || data.riftDeparture) {
    data.checkpointChecksum = checkpointChecksum(data);
  }
  return data;
}

function writeRecord(bytes: string, keepPrevious = false): void {
  const previous = keepPrevious ? storage().getItem(SAVE.KEY) : null;
  // setItem replaces one complete value atomically. A failed backup must never
  // report the already committed primary record as an unsuccessful gameplay step.
  storage().setItem(SAVE.KEY, bytes);
  if (previous && previous !== bytes) {
    try { storage().setItem(`${SAVE.KEY}:previous`, previous); } catch { /* current record is durable */ }
  }
}

function enableInventoryPersistence(): void {
  inventoryStore.setPersistence(inventory => {
    if (worldTransaction) return;
    if (pendingWorldSave) throw new Error("Previous settlement must be saved first");
    if (currentRiftCheckpoint && inventory.run?.status === 'active') {
      throw new Error('An active recovered world requires a complete frame commit');
    }
    const beforeForecast = impactSystem.getForecastState();
    try { writeRecord(JSON.stringify(attachCheckpoint(collectSave(inventory)))); }
    catch (error) { impactSystem.loadForecastState(beforeForecast); throw error; }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const saveManager = {
  /** Call before session initialization. Every persistence path resolves this backend. */
  setStorage(backend: SaveStorage | null): void {
    if (worldTransaction || pendingWorldSave || inventoryStore.hasFrameTransaction()) throw new Error('Cannot replace storage during a pending settlement');
    injectedStorage = backend;
    currentRiftCheckpoint = undefined;
    currentRiftDeparture = undefined;
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

  /** The world adapter validates all domain DTOs before load mutates inventory,
   * base modules or the scene. Unsupported worlds remain intact in storage. */
  setRiftStateValidator(validate: ((checkpoint: RiftCheckpoint, inventory: InventoryState) => boolean) | null): void {
    validateRiftState = validate;
  },

  setRiftDepartureValidator(validate: ((intent: RiftDepartureIntent) => boolean) | null): void { validateDeparture = validate; },
  recordRiftDeparture(intent: RiftDepartureIntent): void {
    if (!worldTransaction || !validRiftDeparture(intent) || inventoryStore.getRun()?.id !== intent.runId
      || !validateDeparture?.(intent)) throw new Error('Invalid atomic Rift departure');
    currentRiftDeparture = structuredClone(intent);
    currentRiftCheckpoint = undefined;
  },
  peekRiftDeparture(): RiftDepartureIntent | null {
    const data = readSaveJson();
    return data?.version === 2 && validSaveEnvelope(data) ? data.riftDeparture ?? null : null;
  },
  peekRiftCheckpoint(): RiftCheckpoint | null {
    const data = readSaveJson();
    return data?.version === 2 && validSaveEnvelope(data) ? data.riftCheckpoint ?? null : null;
  },

  /** Capture once after the simulation frame. The returned operation retries
   * exactly the same inventory, world, forecast and sequence, never a new roll. */
  prepareRiftCommit(checkpoint: RiftCheckpoint): () => void {
    if (worldTransaction || pendingWorldSave) throw new Error('Base settlement is still pending');
    const inventory = inventoryStore.getState();
    if (!validRiftCheckpoint(checkpoint) || checkpoint.runId !== inventory.run?.id
      || !validateRiftState?.(checkpoint, inventory)) throw new Error('Incomplete Rift checkpoint');
    if (currentRiftCheckpoint?.runId === checkpoint.runId && checkpoint.sequence <= currentRiftCheckpoint.sequence) {
      throw new Error('Rift checkpoint sequence must increase');
    }
    const frozen = JSON.parse(JSON.stringify(checkpoint)) as RiftCheckpoint;
    const data = attachCheckpoint(collectSave(inventory, false), frozen);
    const bytes = JSON.stringify(data);
    let committed = false;
    return () => {
      if (committed) return;
      writeRecord(bytes, true);
      currentRiftCheckpoint = frozen;
      currentRiftDeparture = undefined;
      committed = true;
    };
  },

  /** Check if a save file exists in localStorage. */
  hasSave(): boolean {
    return storage().getItem(SAVE.KEY) !== null;
  },

  /**
   * Collect all system states and persist to localStorage.
   * Emits GAME_SAVED on success.
   */
  save(): void {
    if (inventoryStore.hasFrameTransaction()) throw new Error('Save the complete Rift frame first');
    const beforeForecast = impactSystem.getForecastState();
    try {
      if (currentRiftCheckpoint && inventoryStore.getRun()?.status === 'active' && !worldTransaction) {
        throw new Error('Active Rift requires its world checkpoint');
      }
      const bytes = pendingWorldBytes ?? JSON.stringify(attachCheckpoint(collectSave(inventoryStore.getState())));
      if (pendingWorldSave) pendingWorldBytes = bytes;
      writeRecord(bytes);
      // A failed first write rolled this one side effect back; a byte-identical
      // retry must publish the forecast from those bytes, not generate another.
      if (pendingWorldBytes) impactSystem.loadForecastState((JSON.parse(bytes) as SaveDataV2).impactForecast);
    } catch (error) { impactSystem.loadForecastState(beforeForecast); throw error; }
    pendingWorldSave = false;
    pendingWorldBytes = null;
    if (inventoryStore.getRun()?.baseSettled) { currentRiftCheckpoint = undefined; currentRiftDeparture = undefined; }
    enableInventoryPersistence();
    eventBus.emit(GameEvent.GAME_SAVED, { timestamp: Date.now() });
  },

  /**
   * Load save data from localStorage and distribute to all systems.
   * Returns true if load was successful, false if no save or invalid data.
   * Emits GAME_LOADED on success.
   */
  load(mode?: 'abandon-active'): boolean {
    if (pendingWorldSave || inventoryStore.hasFrameTransaction()) return false;
    const raw = storage().getItem(SAVE.KEY);
    if (!raw) return false;

    let data: ExpeditionSaveData;
    try {
      data = JSON.parse(raw) as ExpeditionSaveData;
    } catch {
      return false;
    }

    if (mode === 'abandon-active') {
      if (data?.version !== 2 || data.inventory?.run?.status !== 'active') return false;
      const { riftCheckpoint: _checkpoint, riftDeparture: _departure, checkpointChecksum: _checksum, ...base } = data;
      data = base;
    }
    // Validate the complete loaded payload before distributing state.
    if (!validSaveEnvelope(data)) {
      // Future: add migration functions here
      return false;
    }
    if (data.version === 2 && data.riftCheckpoint && !validateRiftState?.(data.riftCheckpoint, data.inventory)) return false;
    if (data.version === 2 && data.riftCheckpoint?.identity.worldId === 'procedural-rift') {
      const conditions = (data.riftCheckpoint.state as import('@/systems/rift-recovery-state').RiftRecoveryState).conditions;
      const upgrades = data.growth.upgrades;
      const maxHealth = GAME_CONSTANTS.PLAYER.MAX_HEALTH + (upgrades.growth_vitality ?? 0) * UPGRADE_DATA.growth_vitality.effectPerLevel;
      const affinity = (upgrades.growth_kindling_affinity ?? 0) * UPGRADE_DATA.growth_kindling_affinity.effectPerLevel;
      if (conditions.maxHealth !== maxHealth || conditions.kindlingAffinity !== affinity) return false;
    }

    if (data.version === 2 && data.riftDeparture && !validateDeparture?.(data.riftDeparture)) return false;

    // Validate inventory before mutating any other system. Never infer an interrupted-run policy.
    inventoryStore.setPersistence(null);
    if (data.version === 2) inventoryStore.loadState(data.inventory);
    currentRiftCheckpoint = data.version === 2 ? data.riftCheckpoint : undefined;
    currentRiftDeparture = data.version === 2 ? data.riftDeparture : undefined;

    // Distribute to systems
    gameState.loadState({
      kindlingReserve: data.kindlingReserve,
      repairBonusHp: data.repairBonusHp,
      pendingSideEffects: data.pendingSideEffects,
      upgradeDiscount: data.upgradeDiscount,
      moduleSwapActive: data.moduleSwapActive,
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

  canAbandonInterruptedRun(): boolean {
    const data = readSaveJson();
    if (data?.version !== 2 || data.inventory?.run?.status !== 'active') return false;
    const { riftCheckpoint: _checkpoint, riftDeparture: _departure, checkpointChecksum: _checksum, ...base } = data;
    return validSaveEnvelope(base);
  },

  /** Explicit fallible entry point for departure and settlement UI. */
  trySave(): boolean {
    try { this.save(); return true; } catch { return false; }
  },

  /** Delete the save from localStorage. */
  deleteSave(): void {
    storage().removeItem(SAVE.KEY);
    currentRiftCheckpoint = undefined;
    currentRiftDeparture = undefined;
    pendingWorldSave = false;
    pendingWorldBytes = null;
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
