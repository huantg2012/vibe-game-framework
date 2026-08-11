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
let repairEfficiencyMult = 1.0;
let upgradeDiscount = 0;

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

    const maxUseful = Math.ceil((mod.maxHp - mod.hp) / P.REPAIR_PER_KINDLING);
    const actual = Math.min(kindling, kindlingReserve, maxUseful);
    if (actual <= 0) return 0;

    kindlingReserve -= actual;
    mod.hp = Math.min(mod.hp + actual * P.REPAIR_PER_KINDLING, mod.maxHp);
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

  // --- Module effects (spec rules 26-27) ---

  getModuleEffect(type: ModuleType): number {
    const mod = modules.find((m) => m.type === type);
    if (!mod) return type === 'CORE' ? 1.0 : 1.0;

    if (type === 'CORE') {
      // chaosRateModifier: lower is better; at full hp = 1 - 0.30 = 0.70
      return 1.0 - (mod.hp / 100) * P.MAX_CORE_REDUCTION;
    }
    // STORAGE: kindlingValueModifier; at full hp = 1 + 0.50 = 1.50
    return 1.0 + (mod.hp / 100) * P.MAX_STORAGE_BONUS;
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

  getState(): { kindlingReserve: number; cycle: number; modules: { id: string; type: string; hp: number; maxHp: number }[]; pendingSideEffects: PendingSideEffect[]; repairEfficiencyMult: number; upgradeDiscount: number } {
    return {
      kindlingReserve,
      cycle,
      modules: modules.map((m) => ({ id: m.id, type: m.type, hp: m.hp, maxHp: m.maxHp })),
      pendingSideEffects: [...pendingSideEffects],
      repairEfficiencyMult,
      upgradeDiscount,
    };
  },

  loadState(state: { kindlingReserve: number; cycle: number; modules: { id: string; type: string; hp: number; maxHp: number }[]; pendingSideEffects?: PendingSideEffect[]; repairEfficiencyMult?: number; upgradeDiscount?: number }): void {
    kindlingReserve = state.kindlingReserve;
    cycle = state.cycle;
    for (const saved of state.modules) {
      const mod = modules.find((m) => m.id === saved.id);
      if (mod) mod.hp = saved.hp;
    }
    pendingSideEffects = state.pendingSideEffects ?? [];
    repairEfficiencyMult = state.repairEfficiencyMult ?? 1.0;
    upgradeDiscount = state.upgradeDiscount ?? 0;
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

  setRepairEfficiencyMult(value: number): void {
    repairEfficiencyMult = value;
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
    modules[0]!.hp = P.MODULE_INITIAL_HP;
    modules[1]!.hp = P.MODULE_INITIAL_HP;
  },
};
