/**
 * GameState Manager - session-only in-memory state for the purification loop.
 *
 * This is a module-level singleton (architecture DEC-ARCH-002): it survives scene
 * transitions because it lives outside any single scene. Systems never import each
 * other; they read/write GameState and communicate through the event bus.
 *
 * All state resets on page refresh (no localStorage).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import type { PendingSideEffect } from '@/systems/defense-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleType = 'CORE' | 'STORAGE';

export interface ModuleState {
  readonly id: string;
  readonly type: ModuleType;
  hp: number;
  readonly maxHp: number;
}

export interface SortieModifiers {
  readonly chaosRateModifier: number;
  readonly kindlingValueModifier: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

let kindlingReserve = 0;
let cycle = 0;
let impactIntensity = 1.0;
let pendingSideEffects: PendingSideEffect[] = [];
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

const modules: ModuleState[] = [
  { id: 'CORE', type: 'CORE', hp: P.MODULE_INITIAL_HP, maxHp: P.MODULE_MAX_HP },
  { id: 'STORAGE', type: 'STORAGE', hp: P.MODULE_INITIAL_HP, maxHp: P.MODULE_MAX_HP },
];

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

  // --- Module effects (spec rules 26-27; swap per DEC-031) ---

  getModuleEffect(type: ModuleType): number {
    // overwrite (DEC-031): swap which module's HP feeds this stat, but keep the
    // formula tied to `type` — this is what makes the swap sometimes favour the
    // player (whichever module is currently healthier ends up feeding the stat).
    const sourceType: ModuleType = moduleSwapActive
      ? (type === 'CORE' ? 'STORAGE' : 'CORE')
      : type;
    const mod = modules.find((m) => m.type === sourceType);
    if (!mod) return 1.0;

    // resonate (DEC-039): raises the CAP, not the current value - at low module hp the
    // bonus is barely noticeable, same as the rest of these formulas scaling with hp.
    const resonateBonus = resonateBonusActive ? P.RESONATE_MODULE_CAP_BONUS : 0;

    if (type === 'CORE') {
      // chaosRateModifier: lower is better; at full hp = 1 - 0.30 = 0.70
      return 1.0 - (mod.hp / 100) * (P.MAX_CORE_REDUCTION + resonateBonus);
    }
    // STORAGE: kindlingValueModifier; at full hp = 1 + 0.50 = 1.50
    return 1.0 + (mod.hp / 100) * (P.MAX_STORAGE_BONUS + resonateBonus);
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

  getState(): { kindlingReserve: number; cycle: number; modules: { id: string; type: string; hp: number; maxHp: number }[]; pendingSideEffects: PendingSideEffect[]; upgradeDiscount: number; moduleSwapActive: boolean } {
    return {
      kindlingReserve,
      cycle,
      modules: modules.map((m) => ({ id: m.id, type: m.type, hp: m.hp, maxHp: m.maxHp })),
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

  loadState(state: { kindlingReserve: number; cycle: number; modules: { id: string; type: string; hp: number; maxHp: number }[]; pendingSideEffects?: PendingSideEffect[]; upgradeDiscount?: number; moduleSwapActive?: boolean }): void {
    kindlingReserve = state.kindlingReserve;
    cycle = state.cycle;
    for (const saved of state.modules) {
      const mod = modules.find((m) => m.id === saved.id);
      if (mod) mod.hp = saved.hp;
    }
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
    modules[0]!.hp = P.MODULE_INITIAL_HP;
    modules[1]!.hp = P.MODULE_INITIAL_HP;
  },
};
