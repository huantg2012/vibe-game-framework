/**
 * ImpactSystem - calculates and applies module damage each cycle.
 *
 * Called once per sortie entry (after allocation, before scene switch).
 * Owns no rendering; the scene that calls `run()` is responsible for the
 *演出 (shake, particle surge, result panel).
 *
 * Architecture: does not import other systems. Reads/writes GameState,
 * emits events through the bus.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { GameEvent } from '@/types/events';

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
   */
  run(): ImpactResult {
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

    const primaryDamage = Math.round(totalDamage * P.THREAT_FOCUS_RATIO);
    const secondaryDamage = Math.round(totalDamage * (1 - P.THREAT_FOCUS_RATIO));

    const damages: ImpactDamageEntry[] = [];
    const moduleDamage: Record<string, number> = {};

    // Apply to primary
    const primary = modules[primaryIndex]!;
    const actualPrimary = gameState.applyDamage(primary.id, primaryDamage);
    damages.push({ moduleId: primary.id, damage: actualPrimary, newHp: primary.hp });
    moduleDamage[primary.id] = actualPrimary;
    eventBus.emit(GameEvent.MODULE_DAMAGED, { moduleId: primary.id, newHealth: primary.hp });

    // Apply to secondary
    const secondary = modules[secondaryIndex]!;
    const actualSecondary = gameState.applyDamage(secondary.id, secondaryDamage);
    damages.push({ moduleId: secondary.id, damage: actualSecondary, newHp: secondary.hp });
    moduleDamage[secondary.id] = actualSecondary;
    eventBus.emit(GameEvent.MODULE_DAMAGED, { moduleId: secondary.id, newHealth: secondary.hp });

    // Emit resolved
    eventBus.emit(GameEvent.IMPACT_RESOLVED, { moduleDamage });

    // Increment intensity for next cycle (spec rule 12)
    gameState.incrementIntensity();

    return { damages, intensity, skipped: false };
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
