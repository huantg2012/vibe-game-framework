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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleType = 'BARRIER' | 'STORAGE';

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

const modules: ModuleState[] = [
  { id: 'BARRIER', type: 'BARRIER', hp: P.MODULE_INITIAL_HP, maxHp: P.MODULE_MAX_HP },
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
    if (!mod) return type === 'BARRIER' ? 1.0 : 1.0;

    if (type === 'BARRIER') {
      // chaosRateModifier: lower is better; at full hp = 1 - 0.30 = 0.70
      return 1.0 - (mod.hp / 100) * P.MAX_BARRIER_REDUCTION;
    }
    // STORAGE: kindlingValueModifier; at full hp = 1 + 0.50 = 1.50
    return 1.0 + (mod.hp / 100) * P.MAX_STORAGE_BONUS;
  },

  getSortieModifiers(): SortieModifiers {
    return {
      chaosRateModifier: gameState.getModuleEffect('BARRIER'),
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

  incrementIntensity(): void {
    impactIntensity = Math.min(impactIntensity + P.INTENSITY_STEP, P.MAX_INTENSITY);
  },

  // --- Reset (page-refresh equivalent for testing) ---

  reset(): void {
    kindlingReserve = 0;
    cycle = 0;
    impactIntensity = 1.0;
    modules[0]!.hp = P.MODULE_INITIAL_HP;
    modules[1]!.hp = P.MODULE_INITIAL_HP;
  },
};
