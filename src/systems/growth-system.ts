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

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GROWTH_ROUTE_DATA } from '@/generated/growth-route-data';
import type { GrowthRouteStep, GrowthRouteUnit } from '@/generated/growth-route-data';
import { UPGRADE_DATA } from '@/generated/upgrade-data';
import type { GrowthUnlockRequirement, UpgradeDef } from '@/generated/upgrade-data';
import { gameState } from '@/managers/game-state';
import { GameEvent } from '@/types/events';
import type { GrowthProgressionState, GrowthState, GrowthUpgradeId } from '@/types/game-types';

export interface GrowthReturnFacts {
  readonly impactOccurred: boolean;
  readonly offeringCompleted: boolean;
  readonly toolRevealed: boolean;
  readonly leftFiniteCrest: boolean;
}

export interface GrowthAvailability {
  readonly visible: boolean;
  readonly unlocked: boolean;
  /** Missing experience key. Affordability and max level are separate UI states. */
  readonly reason: Exclude<GrowthUnlockRequirement, 'none'> | null;
  readonly nextLevel: number | null;
}

export type { GrowthRouteUnit } from '@/generated/growth-route-data';

/** Public projection contains only the current step, never later names or conditions. */
export interface GrowthRouteStepView {
  readonly id: GrowthRouteUnit;
  readonly level: number;
  readonly maxLevel: number;
  readonly currentLevel: number;
  readonly order: number;
  readonly phase: string;
  readonly requirement: GrowthUnlockRequirement;
  readonly requirementText: string;
  readonly unlocked: boolean;
  readonly cost: number;
}

export interface GrowthRouteProgress {
  readonly completed: number;
  readonly total: number;
}

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

function createInitialProgression(): GrowthProgressionState {
  return { version: 1, impactExperienced: false, offeringCompleted: false, toolRevealed: false, crestExperienced: false };
}

let progression = createInitialProgression();

/** Missing facts are compatible; malformed or unsupported facts are never trusted. */
export function validateGrowthProgressionState(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  return ['impactExperienced', 'offeringCompleted', 'toolRevealed', 'crestExperienced']
    .every(key => candidate[key] === undefined || typeof candidate[key] === 'boolean');
}

function normalizeProgression(value: unknown): GrowthProgressionState {
  const normalized = createInitialProgression();
  if (!validateGrowthProgressionState(value) || value === undefined) return normalized;
  const candidate = value as Partial<GrowthProgressionState>;
  normalized.impactExperienced = candidate.impactExperienced === true;
  normalized.offeringCompleted = candidate.offeringCompleted === true;
  normalized.toolRevealed = candidate.toolRevealed === true;
  normalized.crestExperienced = candidate.crestExperienced === true;
  return normalized;
}

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

function hasRequirement(requirement: GrowthUnlockRequirement): boolean {
  return requirement === 'none' || progression[requirement];
}

function getRouteUnitLevel(unit: GrowthRouteUnit): number {
  return unit === 'thicken' ? gameState.getModuleMaxHpTier() : upgrades[unit];
}

function getNextRouteStep(): GrowthRouteStep | undefined {
  return GROWTH_ROUTE_DATA.find(step => getRouteUnitLevel(step.unit) < step.level);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const growthSystem = {
  /** All upgrade ids, in CSV row order (single source for "which axes exist"). */
  getAllUpgradeIds(): readonly GrowthUpgradeId[] {
    return UPGRADE_IDS;
  },

  getUpgradeDefinition(id: GrowthUpgradeId): UpgradeDef {
    return getUpgradeConfig(id);
  },

  /** Existing purchases skip route nodes; neither their benefits nor old saves are revoked. */
  getNextStep(): GrowthRouteStepView | null {
    const step = getNextRouteStep();
    if (!step) return null;
    const thicken = step.unit === 'thicken';
    return {
      id: step.unit,
      level: step.level,
      maxLevel: thicken ? GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_TIERS : getUpgradeConfig(step.unit).maxLevel,
      currentLevel: getRouteUnitLevel(step.unit),
      order: step.order,
      phase: step.phase,
      requirement: step.requirement,
      requirementText: step.requirementText,
      unlocked: hasRequirement(step.requirement),
      cost: thicken ? gameState.getNextModuleMaxHpCost() ?? Infinity : growthSystem.getCost(step.unit),
    };
  },

  getRouteProgress(): GrowthRouteProgress {
    let completed = 0;
    for (const step of GROWTH_ROUTE_DATA) {
      if (getRouteUnitLevel(step.unit) >= step.level) completed++;
    }
    return { completed, total: GROWTH_ROUTE_DATA.length };
  },

  /** Only the first unpurchased route node can be bought, regardless of available money. */
  getAvailability(id: GrowthUpgradeId): GrowthAvailability {
    const config = getUpgradeConfig(id);
    const currentLevel = upgrades[id];
    const maxed = currentLevel >= config.maxLevel;
    const next = getNextRouteStep();
    const current = next?.unit === id;
    const unlocked = current && hasRequirement(next.requirement);
    return {
      visible: currentLevel > 0 || current,
      unlocked,
      reason: current && !unlocked && next.requirement !== 'none' ? next.requirement : null,
      nextLevel: maxed ? null : currentLevel + 1,
    };
  },

  /** Called inside the existing return transaction; no rewards, events or persistence. */
  recordReturn(facts: GrowthReturnFacts): void {
    progression.impactExperienced ||= facts.impactOccurred === true;
    progression.offeringCompleted ||= facts.offeringCompleted === true;
    progression.toolRevealed ||= facts.toolRevealed === true;
    progression.crestExperienced ||= facts.leftFiniteCrest === true;
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
    return growthSystem.getAvailability(id).unlocked && cost !== Infinity && reserve >= cost;
  },

  /**
   * Purchase the next level of an upgrade.
   * Deducts kindling from GameState. Returns the amount spent (0 if purchase failed).
   * Emits GROWTH_PURCHASED on success.
   */
  purchase(id: GrowthUpgradeId, emitEvent = true): number {
    if (!growthSystem.getAvailability(id).unlocked) return 0;
    const cost = growthSystem.getCost(id);
    if (cost === Infinity) return 0;

    if (!gameState.spendKindling(cost)) return 0;

    upgrades[id]++;
    if (emitEvent) eventBus.emit(GameEvent.GROWTH_PURCHASED, { upgradeId: id, newLevel: upgrades[id] });
    return cost;
  },

  /**
   * Aggregate the purchased body modifiers and forecast information level (0–3).
   * Forecast clarity is a layer of knowledge, never a probability bonus.
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
   * Slot-count bonuses consumed by contaminantSystem to compute effective counts.
   * Offering capacity grows from 1 to 4; sortie capacity has one extra active slot.
   * Kept as dedicated
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
    return { schemaVersion: 2, upgrades: { ...upgrades }, progression: { ...progression } };
  },

  /**
   * Restore state from save data. Merges over freshly-initialized defaults so saves
   * written before an upgrade id existed (e.g. pre-Slice-5 saves missing the three new
   * ids) load with those levels at 0 rather than undefined.
   */
  loadState(saved: GrowthState): void {
    upgrades = { ...createInitialUpgrades(), ...saved.upgrades };
    // Legacy base 3 + purchased 0/1 becomes base 1 + purchased 2/3, exactly once.
    if (saved.schemaVersion === undefined) upgrades.growth_defense_slot += 2;
    progression = normalizeProgression(saved.progression);
  },

  /** Reset to initial state (new game). */
  reset(): void {
    upgrades = createInitialUpgrades();
    progression = createInitialProgression();
  },
};
