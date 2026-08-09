/**
 * GrowthSystem — permanent upgrade management.
 *
 * Players spend kindling at the purification point's "growth altar" to permanently
 * improve their character. Upgrades persist across sorties and are never reverted.
 *
 * Module-level singleton (DEC-ARCH-002).
 * Spec: docs/specs/system-growth-tide.md, section G (rules G16-G20).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { GameEvent } from '@/types/events';
import type { GrowthState, GrowthUpgradeId } from '@/types/game-types';

const G = GAME_CONSTANTS.GROWTH;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let upgrades: Record<GrowthUpgradeId, number> = {
  growth_chaos_resist: 0,
  growth_kindling_affinity: 0,
  growth_vitality: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUpgradeConfig(id: GrowthUpgradeId) {
  return G.UPGRADES[id];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const growthSystem = {
  /** Get the current level of an upgrade (0 = not purchased). */
  getLevel(id: GrowthUpgradeId): number {
    return upgrades[id];
  },

  /** Get the maximum level for an upgrade. */
  getMaxLevel(id: GrowthUpgradeId): number {
    return getUpgradeConfig(id).maxLevel;
  },

  /**
   * Get the cost (in kindling) to purchase the next level.
   * Returns Infinity if already at max level.
   */
  getCost(id: GrowthUpgradeId): number {
    const currentLevel = upgrades[id];
    const cfg = getUpgradeConfig(id);
    if (currentLevel >= cfg.maxLevel) return Infinity;
    return G.COST_PER_LEVEL[currentLevel] ?? Infinity;
  },

  /** Check whether the player can afford the next level of an upgrade. */
  canAfford(id: GrowthUpgradeId, reserve: number): boolean {
    const cost = growthSystem.getCost(id);
    return cost !== Infinity && reserve >= cost;
  },

  /**
   * Purchase the next level of an upgrade.
   * Deducts kindling from GameState. Returns the amount spent (0 if purchase failed).
   * Emits GROWTH_PURCHASED on success.
   */
  purchase(id: GrowthUpgradeId): number {
    const cost = growthSystem.getCost(id);
    if (cost === Infinity) return 0;

    if (!gameState.spendKindling(cost)) return 0;

    upgrades[id]++;
    eventBus.emit(GameEvent.GROWTH_PURCHASED, { upgradeId: id, newLevel: upgrades[id] });
    return cost;
  },

  /**
   * Compute aggregate modifiers from all upgrades.
   * These are applied by the scene layer when constructing SortieModifiers.
   */
  getModifiers(): { chaosResist: number; kindlingAffinity: number; vitalityBonus: number } {
    const chaosResistCfg = G.UPGRADES.growth_chaos_resist;
    const kindlingCfg = G.UPGRADES.growth_kindling_affinity;
    const vitalityCfg = G.UPGRADES.growth_vitality;

    return {
      chaosResist: upgrades.growth_chaos_resist * chaosResistCfg.effectPerLevel,
      kindlingAffinity: upgrades.growth_kindling_affinity * kindlingCfg.effectPerLevel,
      vitalityBonus: upgrades.growth_vitality * vitalityCfg.effectPerLevel,
    };
  },

  /** Serialize current state for saving. */
  getState(): GrowthState {
    return { upgrades: { ...upgrades } };
  },

  /** Restore state from save data. */
  loadState(saved: GrowthState): void {
    upgrades = { ...saved.upgrades };
  },

  /** Reset to initial state (new game). */
  reset(): void {
    upgrades = {
      growth_chaos_resist: 0,
      growth_kindling_affinity: 0,
      growth_vitality: 0,
    };
  },
};
