/**
 * GrowthSystem — permanent upgrade management.
 *
 * Players spend kindling at the purification point's "growth altar" to permanently
 * improve their character. Upgrades persist across sorties and are never reverted.
 *
 * Upgrade definitions (axis / maxLevel / effectPerLevel / per-level costs) are CSV-driven
 * (data/upgrades.csv -> src/generated/upgrade-data.ts, CLAUDE.md 策划数据源规则). This
 * module never hand-duplicates that data — it reads UPGRADE_DATA directly, so every
 * upgrade (however many CSV rows exist) is handled uniformly with no per-id branching.
 *
 * Module-level singleton (DEC-ARCH-002).
 * Spec: docs/specs/system-growth-tide.md, section G (rules G16-G20).
 */

import { eventBus } from '@/core/event-bus';
import { UPGRADE_DATA } from '@/generated/upgrade-data';
import { gameState } from '@/managers/game-state';
import { GameEvent } from '@/types/events';
import type { GrowthState, GrowthUpgradeId } from '@/types/game-types';

/** All upgrade ids, in CSV row order. Single source of truth for "which axes exist". */
const UPGRADE_IDS = Object.keys(UPGRADE_DATA) as GrowthUpgradeId[];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function createInitialUpgrades(): Record<GrowthUpgradeId, number> {
  const out = {} as Record<GrowthUpgradeId, number>;
  for (const id of UPGRADE_IDS) out[id] = 0;
  return out;
}

let upgrades: Record<GrowthUpgradeId, number> = createInitialUpgrades();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUpgradeConfig(id: GrowthUpgradeId) {
  return UPGRADE_DATA[id];
}

/** Total effect magnitude for an upgrade at its current purchased level. */
function getEffectTotal(id: GrowthUpgradeId): number {
  return upgrades[id] * getUpgradeConfig(id).effectPerLevel;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const growthSystem = {
  /** All upgrade ids, in CSV row order (single source for "which axes exist"). */
  getAllUpgradeIds(): readonly GrowthUpgradeId[] {
    return UPGRADE_IDS;
  },

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
   * Reads the upgrade's own cost ladder from CSV data (UPGRADE_DATA[id].costs) —
   * each upgrade has its own per-level cost, not a shared ladder.
   * Returns Infinity if already at max level.
   */
  getCost(id: GrowthUpgradeId): number {
    const currentLevel = upgrades[id];
    const cfg = getUpgradeConfig(id);
    if (currentLevel >= cfg.maxLevel) return Infinity;
    return cfg.costs[currentLevel] ?? Infinity;
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
  purchase(id: GrowthUpgradeId, emitEvent = true): number {
    const cost = growthSystem.getCost(id);
    if (cost === Infinity) return 0;

    if (!gameState.spendKindling(cost)) return 0;

    upgrades[id]++;
    if (emitEvent) eventBus.emit(GameEvent.GROWTH_PURCHASED, { upgradeId: id, newLevel: upgrades[id] });
    return cost;
  },

  /**
   * Compute aggregate modifiers from the original Slice 3 axes plus forecast clarity
   * (Slice 5 T5). These are applied by the scene layer when constructing SortieModifiers,
   * or consumed by the forecast system (growth_forecast_clarity's consumer is owned by
   * another agent — this module only computes and exposes the value).
   */
  getModifiers(): {
    chaosResist: number;
    kindlingAffinity: number;
    vitalityBonus: number;
    forecastClarity: number;
  } {
    return {
      chaosResist: getEffectTotal('growth_chaos_resist'),
      kindlingAffinity: getEffectTotal('growth_kindling_affinity'),
      vitalityBonus: getEffectTotal('growth_vitality'),
      forecastClarity: getEffectTotal('growth_forecast_clarity'),
    };
  },

  /**
   * Slot-count bonuses (Slice 5 T5). Both upgrades are maxLevel 1, so these are 0 or 1 —
   * consumed by contaminantSystem to compute effective slot counts. Kept as dedicated
   * methods (rather than folded into getModifiers()) because they are slot-capacity
   * facts, not sortie stat modifiers.
   */
  getSortieSlotBonus(): number {
    return upgrades.growth_sortie_slot;
  },

  getDefenseSlotBonus(): number {
    return upgrades.growth_defense_slot;
  },

  /** Serialize current state for saving. */
  getState(): GrowthState {
    return { upgrades: { ...upgrades } };
  },

  /**
   * Restore state from save data. Merges over freshly-initialized defaults so saves
   * written before an upgrade id existed (e.g. pre-Slice-5 saves missing the three new
   * ids) load with those levels at 0 rather than undefined.
   */
  loadState(saved: GrowthState): void {
    upgrades = { ...createInitialUpgrades(), ...saved.upgrades };
  },

  /** Reset to initial state (new game). */
  reset(): void {
    upgrades = createInitialUpgrades();
  },
};
