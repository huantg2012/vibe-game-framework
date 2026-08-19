/**
 * GameState Manager - session-only in-memory state for the purification loop.
 *
 * This is a module-level singleton (architecture DEC-ARCH-002): it survives scene
 * transitions because it lives outside any single scene. Systems never import each
 * other; they read/write GameState and communicate through the event bus.
 *
 * Persisted via SaveManager (localStorage). reset() restores a new expedition.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import type { PendingSideEffect } from '@/systems/defense-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleType = 'CORE' | 'STORAGE' | 'PURIFIER';
export type EffectModuleType = 'CORE' | 'STORAGE';
export type ModuleMaxHpTier = 0 | 1 | 2 | 3;

export interface ModuleState {
  readonly id: string;
  readonly type: ModuleType;
  hp: number;
  maxHp: number;
}

export interface SortieModifiers {
  readonly chaosRateModifier: number;
  readonly kindlingValueModifier: number;
  readonly startingChaos: number;
}

export interface GameStateSnapshot {
  kindlingReserve: number;
  cycle: number;
  modules: { id: string; type: string; hp: number; maxHp: number }[];
  moduleMaxHpTier: ModuleMaxHpTier;
  pendingSideEffects: PendingSideEffect[];
  upgradeDiscount: number;
  moduleSwapActive: boolean;
}

export interface GameStateLoadInput {
  kindlingReserve: number;
  cycle: number;
  modules: { id: string; type: string; hp: number; maxHp: number }[];
  moduleMaxHpTier?: number;
  pendingSideEffects?: PendingSideEffect[];
  upgradeDiscount?: number;
  moduleSwapActive?: boolean;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

let kindlingReserve = 0;
let cycle = 0;
let impactIntensity = 1.0;
let pendingSideEffects: PendingSideEffect[] = [];
let moduleMaxHpTier: ModuleMaxHpTier = 0;
/**
 * siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍" - same "装备期间"
 * derivation as `resonateBonusActive` below, kept in sync by
 * `ContaminantSystem.syncRepairEfficiencyMult()` on every defense-slot mutation.
 */
let repairEfficiencyMult = 1.0;
let upgradeDiscount = 0;
/**
 * overwrite (Slice 5 T3, DEC-031): while active, getModuleEffect() reads the OTHER
 * module's HP through the requested type's formula, swapping which module feeds which
 * stat. Cleared at the start of the next impact resolution (exactly "1 次出击").
 * Purifier is never swapped.
 */
let moduleSwapActive = false;
/**
 * resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%,
 * 多个共振残渣不叠加此增益" - unlike overwrite's one-impact toggle, this tracks a
 * continuous "is at least one resonate currently in a defense slot" state, kept in sync
 * by ContaminantSystem on every defense-slot mutation (slot/unslot/transform-out). A
 * single boolean rather than a count is what makes "不叠加" automatic: 1 or 5 resonate
 * defense-slotted both just set this true.
 */
let resonateBonusActive = false;

function maxHpForTier(tier: number): number {
  return P.MODULE_BASE_MAX_HP + P.MODULE_MAX_HP_PER_TIER * tier;
}

function clampTier(value: number | undefined): ModuleMaxHpTier {
  const n = value ?? 0;
  if (n <= 0) return 0;
  if (n >= P.MODULE_MAX_HP_TIERS) return P.MODULE_MAX_HP_TIERS as ModuleMaxHpTier;
  return n as ModuleMaxHpTier;
}

function makeModule(type: ModuleType, hp: number, maxHp: number): ModuleState {
  return { id: type, type, hp, maxHp };
}

function createDefaultModules(): ModuleState[] {
  const maxHp = maxHpForTier(0);
  return [
    makeModule('CORE', P.MODULE_INITIAL_HP, maxHp),
    makeModule('STORAGE', P.MODULE_INITIAL_HP, maxHp),
    makeModule('PURIFIER', P.MODULE_INITIAL_HP, maxHp),
  ];
}

const modules: ModuleState[] = createDefaultModules();

function applyMaxHpFromTier(): void {
  const cap = maxHpForTier(moduleMaxHpTier);
  for (const mod of modules) {
    mod.maxHp = cap;
    if (mod.hp > cap) mod.hp = cap;
  }
}

function ensurePurifier(hp = P.MODULE_INITIAL_HP): void {
  if (modules.some((m) => m.type === 'PURIFIER')) return;
  modules.push(makeModule('PURIFIER', hp, maxHpForTier(moduleMaxHpTier)));
}

/**
 * Starting chaos for a given purifier hp/maxHp (rule 27b). Used by GameState and by
 * the allocation wall-machine preview so the two cannot drift.
 */
export function computeStartingChaos(hp: number, maxHp: number): number {
  if (maxHp <= 0) return P.CHAOS_HARD_START;
  const integrity = Math.max(0, Math.min(1, hp / maxHp));
  return Math.round(P.CHAOS_HARD_START * (1 - integrity));
}

function effectHp(hp: number): number {
  return Math.min(hp, P.MODULE_EFFECT_HP_REF);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const gameState = {
  // --- Kindling ---

  getKindlingReserve(): number {
    return kindlingReserve;
  },

  addKindling(n: number): void {
    kindlingReserve += Math.max(0, n);
  },

  /**
   * Spend kindling from reserve. Returns true if successful (had enough).
   * Does not allow spending more than the current reserve.
   */
  spendKindling(n: number): boolean {
    if (n <= 0 || n > kindlingReserve) return false;
    kindlingReserve -= n;
    return true;
  },

  // --- Modules ---

  getModules(): readonly ModuleState[] {
    return modules;
  },

  getModule(id: string): ModuleState | undefined {
    return modules.find((m) => m.id === id);
  },

  /**
   * Spend kindling to repair a module.
   * Returns actual kindling spent (clamped by reserve and maxHp).
   */
  allocateToModule(id: string, kindling: number): number {
    const mod = modules.find((m) => m.id === id);
    if (!mod || kindling <= 0) return 0;

    const perKindling = gameState.getEffectiveRepairPerKindling();
    const maxUseful = Math.ceil((mod.maxHp - mod.hp) / perKindling);
    const actual = Math.min(kindling, kindlingReserve, maxUseful);
    if (actual <= 0) return 0;

    kindlingReserve -= actual;
    mod.hp = Math.min(mod.hp + actual * perKindling, mod.maxHp);
    return actual;
  },

  /**
   * Apply damage to a module. Returns actual damage dealt (clamped at 0 hp).
   */
  applyDamage(id: string, damage: number): number {
    const mod = modules.find((m) => m.id === id);
    if (!mod || damage <= 0) return 0;

    const actual = Math.min(damage, mod.hp);
    mod.hp -= actual;
    return actual;
  },

  /**
   * Heal a module directly (not via kindling repair). Returns actual amount healed
   * (clamped at maxHp). Used by combust's burst-release (DEC-030).
   */
  healModule(id: string, amount: number): number {
    const mod = modules.find((m) => m.id === id);
    if (!mod || amount <= 0) return 0;

    const actual = Math.min(amount, mod.maxHp - mod.hp);
    if (actual <= 0) return 0;
    mod.hp += actual;
    return actual;
  },

  // --- Module effects (spec rules 26-27b; swap per DEC-031) ---

  /** CORE/STORAGE only. Purifier does not go through this entry. */
  getModuleEffect(type: EffectModuleType): number {
    // overwrite (DEC-031): swap which module's HP feeds this stat, but keep the
    // formula tied to `type` — this is what makes the swap sometimes favour the
    // player (whichever module is currently healthier ends up feeding the stat).
    const sourceType: EffectModuleType = moduleSwapActive
      ? (type === 'CORE' ? 'STORAGE' : 'CORE')
      : type;
    const mod = modules.find((m) => m.type === sourceType);
    if (!mod) return 1.0;

    // resonate (DEC-039): raises the CAP, not the current value - at low module hp the
    // bonus is barely noticeable, same as the rest of these formulas scaling with hp.
    const resonateBonus = resonateBonusActive ? P.RESONATE_MODULE_CAP_BONUS : 0;
    const ratio = effectHp(mod.hp) / P.MODULE_EFFECT_HP_REF;

    if (type === 'CORE') {
      // chaosRateModifier: lower is better; at hp>=100 = 1 - 0.30 = 0.70
      return 1.0 - ratio * (P.MAX_CORE_REDUCTION + resonateBonus);
    }
    // STORAGE: kindlingValueModifier; at hp>=100 = 1 + 0.50 = 1.50
    return 1.0 + ratio * (P.MAX_STORAGE_BONUS + resonateBonus);
  },

  /** Unique entry for sortie starting chaos (rule 27b). */
  getStartingChaos(): number {
    const purifier = modules.find((m) => m.type === 'PURIFIER');
    if (!purifier) return P.CHAOS_HARD_START;
    return computeStartingChaos(purifier.hp, purifier.maxHp);
  },

  getModuleMaxHpTier(): ModuleMaxHpTier {
    return moduleMaxHpTier;
  },

  getModuleMaxHp(): number {
    return maxHpForTier(moduleMaxHpTier);
  },

  /** Cost of the next thicken tier, or null if already at cap. */
  getNextModuleMaxHpCost(): number | null {
    if (moduleMaxHpTier === 0) return P.MODULE_MAX_HP_COST[0];
    if (moduleMaxHpTier === 1) return P.MODULE_MAX_HP_COST[1];
    if (moduleMaxHpTier === 2) return P.MODULE_MAX_HP_COST[2];
    return null;
  },

  /** True when a thicken purchase can actually complete (not capped, enough kindling). */
  canRaiseModuleMaxHp(): boolean {
    const cost = gameState.getNextModuleMaxHpCost();
    return cost !== null && kindlingReserve >= cost;
  },

  /**
   * Spend kindling to raise every module's maxHp by one tier. Current hp is unchanged.
   * upgradeDiscount does not apply. Returns false if capped or kindling is short.
   */
  raiseModuleMaxHp(): boolean {
    const cost = gameState.getNextModuleMaxHpCost();
    if (cost === null) return false;
    if (!gameState.spendKindling(cost)) return false;
    moduleMaxHpTier = (moduleMaxHpTier + 1) as ModuleMaxHpTier;
    applyMaxHpFromTier();
    return true;
  },

  /** overwrite (DEC-031): whether CORE/STORAGE module effects are currently swapped. */
  isModuleSwapActive(): boolean {
    return moduleSwapActive;
  },

  /** overwrite (DEC-031): set by ImpactSystem when the 25% swap roll succeeds/expires. */
  setModuleSwapActive(active: boolean): void {
    moduleSwapActive = active;
  },

  /** resonate (DEC-039): whether the module-effect cap bonus is currently active. */
  isResonateBonusActive(): boolean {
    return resonateBonusActive;
  },

  /** resonate (DEC-039): set by ContaminantSystem whenever the defense loadout changes. */
  setResonateBonusActive(active: boolean): void {
    resonateBonusActive = active;
  },

  getSortieModifiers(): SortieModifiers {
    return {
      chaosRateModifier: gameState.getModuleEffect('CORE'),
      kindlingValueModifier: gameState.getModuleEffect('STORAGE'),
      startingChaos: gameState.getStartingChaos(),
    };
  },

  // --- Cycle ---

  getCycle(): number {
    return cycle;
  },

  incrementCycle(): void {
    cycle++;
  },

  // --- Impact intensity ---

  getImpactIntensity(): number {
    return impactIntensity;
  },

  /** @deprecated Slice 3 replaces linear increment with TideSystem-driven intensity. */
  incrementIntensity(): void {
    // Previously: impactIntensity += INTENSITY_STEP (capped at MAX_INTENSITY).
    // Now driven by TideSystem; this method remains as a no-op until TideSystem
    // is wired up (Slice 3 T2/T3) and the callers are migrated.
    impactIntensity += 0.15;
    if (impactIntensity > 3.0) impactIntensity = 3.0;
  },

  // --- Serialization (for SaveManager) ---

  getState(): GameStateSnapshot {
    return {
      kindlingReserve,
      cycle,
      modules: modules.map((m) => ({ id: m.id, type: m.type, hp: m.hp, maxHp: m.maxHp })),
      moduleMaxHpTier,
      pendingSideEffects: [...pendingSideEffects],
      upgradeDiscount,
      moduleSwapActive,
      // resonateBonusActive/repairEfficiencyMult are deliberately NOT persisted here: they
      // are not game-state facts, they are live derivations from ContaminantSystem's
      // defense loadout (which IS saved separately). SaveManager.load() restores
      // contaminants first, and ContaminantSystem.loadState() resyncs both flags from the
      // restored defense slots - persisting a second copy here would just be a second
      // source of truth to drift (siphon unslotted-but-still-2x-until-next-impact was
      // exactly this kind of drift before the Slice 5 gap-fill).
    };
  },

  loadState(state: GameStateLoadInput): void {
    kindlingReserve = state.kindlingReserve;
    cycle = state.cycle;
    moduleMaxHpTier = clampTier(state.moduleMaxHpTier);
    ensurePurifier(P.MODULE_INITIAL_HP);
    for (const saved of state.modules) {
      const mod = modules.find((m) => m.id === saved.id);
      if (mod) mod.hp = saved.hp;
    }
    // maxHp is derived from the persisted tier (rule 65); rewrite if the save disagrees.
    applyMaxHpFromTier();
    pendingSideEffects = state.pendingSideEffects ?? [];
    upgradeDiscount = state.upgradeDiscount ?? 0;
    moduleSwapActive = state.moduleSwapActive ?? false;
  },

  /** Set impact intensity (called by TideSystem to sync). */
  setImpactIntensity(value: number): void {
    impactIntensity = value;
  },

  // --- Pending side effects (defense engine output, consumed at sortie start) ---

  getPendingSideEffects(): PendingSideEffect[] {
    return pendingSideEffects;
  },

  addPendingSideEffects(effects: PendingSideEffect[]): void {
    pendingSideEffects.push(...effects);
  },

  /** Consume and clear all pending side effects. Called at rift scene create. */
  consumePendingSideEffects(): PendingSideEffect[] {
    const effects = [...pendingSideEffects];
    pendingSideEffects = [];
    return effects;
  },

  // --- Repair efficiency (siphon defense effect) ---

  getRepairEfficiencyMult(): number {
    return repairEfficiencyMult;
  },

  /** siphon (Slice 5 gap-fill): set by `ContaminantSystem.syncRepairEfficiencyMult()`
   * whenever the defense loadout changes - "装备期间", present tense, same lifecycle as
   * `setResonateBonusActive()`. Not a per-impact one-shot: unslotting siphon resets this
   * to 1.0 immediately, without waiting for the next impact to resolve. */
  setRepairEfficiencyMult(value: number): void {
    repairEfficiencyMult = value;
  },

  /** Single source of truth for "how much module HP one kindling repairs right now" -
   * `allocateToModule()` below and the allocation panel's preview both read this instead
   * of `PURIFICATION.REPAIR_PER_KINDLING` directly, so siphon's doubling can never drift
   * between the two. */
  getEffectiveRepairPerKindling(): number {
    return P.REPAIR_PER_KINDLING * repairEfficiencyMult;
  },

  // --- Upgrade discount (retrograde defense effect) ---

  getUpgradeDiscount(): number {
    return upgradeDiscount;
  },

  setUpgradeDiscount(value: number): void {
    upgradeDiscount = value;
  },

  consumeUpgradeDiscount(): number {
    const d = upgradeDiscount;
    upgradeDiscount = 0;
    return d;
  },

  // --- Reset (page-refresh equivalent for testing) ---

  reset(): void {
    kindlingReserve = 0;
    cycle = 0;
    impactIntensity = 1.0;
    pendingSideEffects = [];
    repairEfficiencyMult = 1.0;
    upgradeDiscount = 0;
    moduleSwapActive = false;
    resonateBonusActive = false;
    moduleMaxHpTier = 0;
    ensurePurifier(P.MODULE_INITIAL_HP);
    for (const mod of modules) {
      mod.hp = P.MODULE_INITIAL_HP;
      mod.maxHp = maxHpForTier(0);
    }
  },
};
