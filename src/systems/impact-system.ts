/**
 * ImpactSystem - calculates and applies module damage each cycle.
 *
 * Called once per sortie entry (after allocation, before scene switch).
 * Owns no rendering; the scene that calls `run()` is responsible for the
 *演出 (shake, particle surge, result panel).
 *
 * Architecture: does not import other systems. Reads/writes GameState,
 * emits events through the bus.
 *
 * Slice 4: integrates DefenseEngine to apply defense slot effects before damage.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { applyDefenseEffects, type DefenseContext, type DefenseResult } from '@/systems/defense-engine';
import { GameEvent } from '@/types/events';
import type { Contaminant } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImpactDamageEntry {
  readonly moduleId: string;
  readonly damage: number;
  readonly newHp: number;
}

export interface ImpactResult {
  readonly damages: ImpactDamageEntry[];
  readonly intensity: number;
  readonly skipped: boolean;
  /** Defense engine result (null when skipped or no defense slots active). */
  readonly defenseResult?: DefenseResult;
}

// ---------------------------------------------------------------------------
// ImpactSystem
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

/**
 * Chooses which module is the "heavy target" this cycle.
 * Returns the id of the primary target.
 * `forecastDirection` is set externally (for particle pre-cue) before calling run().
 */
let forecastTargetId: string | null = null;

export const impactSystem = {
  /**
   * Set the forecasted primary target (called during boundary atmosphere setup).
   * 80% of the time this matches the actual target; 20% it's the other one.
   */
  setForecastTarget(id: string): void {
    forecastTargetId = id;
  },

  getForecastTarget(): string | null {
    return forecastTargetId;
  },

  /**
   * Run the impact calculation. Returns the result for the scene to display.
   * On cycle=0, returns skipped=true and does nothing.
   *
   * @param defenseSlots - The 3 defense-slotted contaminants, passed from the scene layer
   *   to preserve the "systems never import each other" rule (DEC-ARCH-002).
   */
  run(defenseSlots?: (Contaminant | null)[]): ImpactResult {
    const cycle = gameState.getCycle();

    // First sortie: no impact (spec rule 20)
    if (cycle === 0) {
      return { damages: [], intensity: 0, skipped: true };
    }

    const intensity = gameState.getImpactIntensity();
    const totalDamage = P.BASE_IMPACT_DAMAGE * intensity;

    // Emit start
    eventBus.emit(GameEvent.IMPACT_STARTED, { intensity });

    // Determine primary target (spec rule 22)
    const modules = gameState.getModules();
    const primaryIndex = Math.random() < P.FORECAST_ACCURACY
      ? (forecastTargetId === modules[1]!.id ? 1 : 0)
      : (forecastTargetId === modules[1]!.id ? 0 : 1);
    const secondaryIndex = primaryIndex === 0 ? 1 : 0;

    const primary = modules[primaryIndex]!;
    const secondary = modules[secondaryIndex]!;

    const primaryDamage = Math.round(totalDamage * P.THREAT_FOCUS_RATIO);
    const secondaryDamage = Math.round(totalDamage * (1 - P.THREAT_FOCUS_RATIO));

    // Base damage per module before defense
    const baseDamagePerModule: Record<string, number> = {
      [primary.id]: primaryDamage,
      [secondary.id]: secondaryDamage,
    };

    // --- Defense engine phase (Slice 4) ---
    const slots = defenseSlots ?? [];
    const hasDefense = slots.some((s) => s !== null);

    let defenseResult: DefenseResult | undefined;

    if (hasDefense) {
      const context: DefenseContext = {
        forecastTargetId,
        actualPrimaryId: primary.id,
        stabilityProgress: 0, // TODO: wire stabilityTracker
        moduleHps: { [primary.id]: primary.hp, [secondary.id]: secondary.hp },
        moduleMaxHps: { [primary.id]: primary.maxHp, [secondary.id]: secondary.maxHp },
      };

      defenseResult = applyDefenseEffects(baseDamagePerModule, slots, context);

      // Apply kindling gain
      if (defenseResult.kindlingGain > 0) {
        gameState.addKindling(defenseResult.kindlingGain);
      }

      // Store side effects for next sortie
      if (defenseResult.sideEffects.length > 0) {
        gameState.addPendingSideEffects(defenseResult.sideEffects);
      }

      // Store repair efficiency and upgrade discount
      if (defenseResult.repairEfficiencyMult > 1.0) {
        gameState.setRepairEfficiencyMult(defenseResult.repairEfficiencyMult);
      }
      if (defenseResult.upgradeDiscount > 0) {
        gameState.setUpgradeDiscount(defenseResult.upgradeDiscount);
      }
    }

    // Determine final damage per module
    const finalDamageMap = defenseResult
      ? defenseResult.finalDamagePerModule
      : baseDamagePerModule;

    // Apply damage to modules
    const damages: ImpactDamageEntry[] = [];
    const moduleDamage: Record<string, number> = {};

    for (const mod of modules) {
      const dmg = finalDamageMap[mod.id] ?? 0;
      const actualDmg = gameState.applyDamage(mod.id, dmg);
      damages.push({ moduleId: mod.id, damage: actualDmg, newHp: mod.hp });
      moduleDamage[mod.id] = actualDmg;
      eventBus.emit(GameEvent.MODULE_DAMAGED, { moduleId: mod.id, newHealth: mod.hp });
    }

    // Stitch equalization: transfer HP between modules after damage
    if (defenseResult && Object.keys(defenseResult.stitchEqualization).length > 0) {
      for (const [moduleId, change] of Object.entries(defenseResult.stitchEqualization)) {
        const mod = modules.find((m) => m.id === moduleId);
        if (mod && change > 0) {
          // Positive change = heal this module (capped at maxHp)
          mod.hp = Math.min(mod.hp + change, mod.maxHp);
        } else if (mod && change < 0) {
          // Negative change = take from this module (floor at 0)
          mod.hp = Math.max(mod.hp + change, 0);
        }
      }
    }

    // Emit resolved
    eventBus.emit(GameEvent.IMPACT_RESOLVED, { moduleDamage });

    // Increment intensity for next cycle (spec rule 12)
    gameState.incrementIntensity();

    return { damages, intensity, skipped: false, defenseResult };
  },

  /**
   * Decide and store the forecast target for the boundary atmosphere pre-cue.
   * Call this when entering the purification scene.
   */
  generateForecast(): void {
    const modules = gameState.getModules();
    // Pick a random target for the forecast
    const targetIndex = Math.random() < 0.5 ? 0 : 1;
    forecastTargetId = modules[targetIndex]!.id;
  },
};
