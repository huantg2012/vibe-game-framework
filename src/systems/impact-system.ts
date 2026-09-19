/**
 * ImpactSystem - calculates and applies module damage each cycle.
 *
 * Called once per sortie entry (after allocation, before scene switch).
 * Owns no rendering; the scene that calls `run()` is responsible for the
 *演出 (shake, particle surge, result panel).
 *
 * Tide/growth values enter through the scene boundary. This module persists forecast
 * promises and resolves offering defense before the scene advances offering progress.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { contaminantSystem } from '@/systems/contaminant-system';
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
  /** Count only positive-to-zero damage transitions, including later local repair. */
  readonly newlyZeroModules?: number;
  /** Defense engine result (null when skipped or no defense slots active). */
  readonly defenseResult?: DefenseResult;
  /** The module that took the 65% "重点目标" share this impact (ground truth).
   *  Always set when `!skipped`. Slice 5.5 D5: lets the result panel show a
   *  predicted-vs-actual line without exposing the internal forecastTargetId. */
  readonly primaryModuleId?: string;
  /** This impact's true severity tier, independent of forecast display noise
   *  (baseline blur — see generateForecast()). */
  readonly trueSeverity?: ForecastSeverity;
  /** Per-module damage before any defense reduction (only meaningful when
   *  `defenseResult` is set — otherwise base === final and the panel doesn't need
   *  a second column). Slice 5.5 D5: lets the panel show "基础 → 实际". */
  readonly baseDamagePerModule?: Record<string, number>;
}

/**
 * Non-spatial forecast severity tier (DEC-034). Ordered light -> extreme; the order in
 * SEVERITY_ORDER below is what "blur by one notch" walks along.
 */
export type ForecastSeverity = 'light' | 'moderate' | 'heavy' | 'extreme';

/** Player-facing target and severity; earned memory readings are exact. */
export interface ForecastDisplay {
  readonly targetId: string;
  readonly severity: ForecastSeverity;
}

/** An already committed impact after the upcoming one. Removing the item does not revoke it. */
export interface ForecastLookahead {
  readonly targetId: string;
  readonly severity: ForecastSeverity;
}

export interface ImpactForecastState {
  version: 1;
  targetId: string | null;
  committed: boolean;
  consumed: boolean;
  display: ForecastDisplay | null;
  lookahead: ForecastLookahead | null;
  queuedTargets: string[];
  nextIntensity: number;
  nextNextIntensity: number;
  /** Earned by a real offering impact, consumed by the next forecast creation. */
  earnedPending?: boolean;
}

export function validImpactForecastState(value: unknown, moduleIds: readonly string[]): value is ImpactForecastState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<ImpactForecastState>;
  const validReading = (reading: unknown): reading is ForecastDisplay | null => {
    if (reading === null) return true;
    if (!reading || typeof reading !== 'object') return false;
    const data = reading as Partial<ForecastDisplay>;
    return typeof data.targetId === 'string' && moduleIds.includes(data.targetId)
      && SEVERITY_ORDER.includes(data.severity as ForecastSeverity);
  };
  if (state.earnedPending !== undefined && typeof state.earnedPending !== 'boolean') return false;
  if (state.version !== 1 || typeof state.committed !== 'boolean' || typeof state.consumed !== 'boolean'
    || !validReading(state.display) || !validReading(state.lookahead)
    || !Array.isArray(state.queuedTargets) || state.queuedTargets.length > 1
    || !state.queuedTargets.every(id => typeof id === 'string' && moduleIds.includes(id))
    || typeof state.nextIntensity !== 'number' || !Number.isFinite(state.nextIntensity) || state.nextIntensity <= 0
    || typeof state.nextNextIntensity !== 'number' || !Number.isFinite(state.nextNextIntensity) || state.nextNextIntensity <= 0) return false;
  return (state.display === null ? state.targetId === null : state.display.targetId === state.targetId)
    && (state.lookahead === null ? state.queuedTargets.length === 0 : state.queuedTargets[0] === state.lookahead.targetId);
}

// ---------------------------------------------------------------------------
// ImpactSystem
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

const SEVERITY_ORDER: ForecastSeverity[] = ['light', 'moderate', 'heavy', 'extreme'];

/**
 * Severity tier boundaries over the tide's intensity range [1.0, 3.0] (constants.ts
 * TIDE.TIDES floor/peak). Divides that range into 4 roughly equal bands. Local constant
 * (not in constants.ts) per this task's file-ownership scope.
 */
const SEVERITY_TIER_MAX: { max: number; tier: ForecastSeverity }[] = [
  { max: 1.5, tier: 'light' },
  { max: 2.0, tier: 'moderate' },
  { max: 2.5, tier: 'heavy' },
  { max: Infinity, tier: 'extreme' },
];

/** Ambient forecast noise; retrograde commitments bypass it. */
const SEVERITY_BLUR_BASE_CHANCE = 0.20;
const SEVERITY_BLUR_FLOOR_CHANCE = 0.05;

/** Chinese labels for the four severity tiers (Slice 5.5 D5 — these had never been
 *  named in the UI before; only the pip count rendered). Kept here since this module
 *  owns the `ForecastSeverity` type. */
export const SEVERITY_LABEL: Record<ForecastSeverity, string> = {
  light: '轻微',
  moderate: '中等',
  heavy: '剧烈',
  extreme: '极端',
};

function severityFromIntensity(intensity: number): ForecastSeverity {
  for (const { max, tier } of SEVERITY_TIER_MAX) {
    if (intensity < max) return tier;
  }
  return 'extreme';
}

function pickUniform<T extends { id: string }>(items: readonly T[], random: () => number, exceptId?: string | null): T {
  const pool = exceptId ? items.filter((m) => m.id !== exceptId) : items;
  const source = pool.length > 0 ? pool : items;
  return source[Math.floor(random() * source.length)]!;
}

function pickPrimaryModule<T extends { id: string }>(
  modules: readonly T[],
  forecastId: string | null,
  random: () => number,
): T {
  const forecast = forecastId ? modules.find((m) => m.id === forecastId) : undefined;
  if (random() < P.FORECAST_ACCURACY) {
    return forecast ?? pickUniform(modules, random);
  }
  return pickUniform(modules, random, forecastId);
}

/** Primary takes THREAT_FOCUS_RATIO; remainder split across the others; last eats residue. */
function distributeThreatDamage<T extends { id: string }>(
  totalDamage: number,
  primaryId: string,
  modules: readonly T[],
): Record<string, number> {
  const total = Math.round(totalDamage);
  const primaryDamage = Math.round(totalDamage * P.THREAT_FOCUS_RATIO);
  const rest = total - primaryDamage;
  const result: Record<string, number> = {};
  for (const mod of modules) result[mod.id] = 0;
  result[primaryId] = primaryDamage;

  const others = modules.filter((m) => m.id !== primaryId);
  let allocated = 0;
  for (let i = 0; i < others.length; i++) {
    const isLast = i === others.length - 1;
    const share = isLast ? rest - allocated : Math.round(rest / others.length);
    result[others[i]!.id] = share;
    allocated += share;
  }
  return result;
}

let forecastTargetId: string | null = null;
let forecastDisplay: ForecastDisplay | null = null;
let forecastCommitted = false;
let memoryEarnedPending = false;
let forecastConsumed = false;
let forecastIntensity = 1;
let forecastNextNextIntensity = 1;
const pendingTargetQueue: string[] = [];
let forecastLookahead: ForecastLookahead | null = null;

export const impactSystem = {
  getForecastDisplay(): ForecastDisplay | null {
    return forecastDisplay;
  },

  getForecastLookahead(): ForecastLookahead | null {
    return forecastLookahead;
  },

  /** Snapshot without mutation, also used to roll back a failed inventory save. */
  getForecastState(): ImpactForecastState {
    return { version: 1, targetId: forecastTargetId, committed: forecastCommitted, consumed: forecastConsumed,
      earnedPending: memoryEarnedPending,
      display: forecastDisplay ? { ...forecastDisplay } : null,
      lookahead: forecastLookahead ? { ...forecastLookahead } : null,
      queuedTargets: [...pendingTargetQueue], nextIntensity: forecastIntensity, nextNextIntensity: forecastNextNextIntensity };
  },

  /** Missing state is an old save; its first visit establishes a stable reading. */
  loadForecastState(state?: ImpactForecastState): void {
    this.resetForecastState();
    if (!state) return;
    forecastTargetId = state.targetId;
    forecastCommitted = state.committed;
    memoryEarnedPending = state.earnedPending ?? false;
    forecastConsumed = state.consumed;
    forecastDisplay = state.display ? { ...state.display } : null;
    forecastLookahead = state.lookahead ? { ...state.lookahead } : null;
    pendingTargetQueue.push(...state.queuedTargets);
    forecastIntensity = state.nextIntensity;
    forecastNextNextIntensity = state.nextNextIntensity;
  },

  resetForecastState(): void {
    forecastTargetId = null;
    forecastDisplay = null;
    forecastCommitted = false;
    memoryEarnedPending = false;
    forecastConsumed = false;
    forecastIntensity = 1;
    forecastNextNextIntensity = 1;
    pendingTargetQueue.length = 0;
    forecastLookahead = null;
  },

  /**
   * Run the impact calculation. Returns the result for the scene to display.
   * Cycle 0 is the untouched base; the first departure increments it to 1.
   * Both skip impact. Every later return applies impact, including death/abandon.
   *
   * @param defenseSlots - The 3 defense-slotted contaminants, passed from the scene layer
   *   to preserve the "systems never import each other" rule (DEC-ARCH-002).
   */
  run(defenseSlots?: (Contaminant | null)[], offeringIds?: readonly (string | null)[], random: () => number = Math.random, stabilityProgress = 0): ImpactResult {
    const cycle = gameState.getCycle();

    // First sortie: no impact (spec rule 20)
    if (cycle <= 1) {
      return { damages: [], intensity: 0, skipped: true };
    }



    // overwrite's module-swap side effect lasts exactly "1 次出击" (DEC-031): the sortie
    // between this impact and the next one. Clear it here, before this impact's own
    // defense processing may re-trigger it, so the window is always exactly one sortie.
    gameState.setModuleSwapActive(false);

    const intensity = gameState.getImpactIntensity();
    const totalDamage = P.BASE_IMPACT_DAMAGE * intensity;

    // Emit start
    eventBus.emit(GameEvent.IMPACT_STARTED, { intensity });

    // Determine primary target (spec rule 22): 80% keep forecast, else pick uniformly
    // among the remaining blood-bearing modules. Never hardcode modules[0]/[1].
    const modules = gameState.getModules();
    const primary = (forecastCommitted ? modules.find(module => module.id === forecastTargetId) : undefined)
      ?? pickPrimaryModule(modules, forecastTargetId, random);
    const baseDamagePerModule = distributeThreatDamage(totalDamage, primary.id, modules);

    // --- Defense engine phase (Slice 4) ---
    const slots = defenseSlots ?? [];
    const hasDefense = slots.some((s) => s !== null);

    let defenseResult: DefenseResult | undefined;

    if (hasDefense) {
      const moduleHps: Record<string, number> = {};
      const moduleMaxHps: Record<string, number> = {};
      for (const mod of modules) {
        moduleHps[mod.id] = mod.hp;
        moduleMaxHps[mod.id] = mod.maxHp;
      }
      const context: DefenseContext = {
        forecastTargetId,
        actualPrimaryId: primary.id,
        stabilityProgress,
        moduleHps,
        moduleMaxHps,
      };

      defenseResult = applyDefenseEffects(baseDamagePerModule, slots, context, offeringIds);

      // Apply kindling gain
      if (defenseResult.kindlingGain > 0) {
        gameState.addKindling(defenseResult.kindlingGain);
      }

      // Store side effects for next sortie
      if (defenseResult.sideEffects.length > 0) {
        gameState.addPendingSideEffects(defenseResult.sideEffects);
      }

      if (defenseResult.repairBonusHp > 0) gameState.grantRepairBonus(defenseResult.repairBonusHp);

      if (defenseResult.upgradeDiscount > 0) {
        gameState.setUpgradeDiscount(defenseResult.upgradeDiscount);
      }

      // echo: grant +1 use to a random tool-stage contaminant (no-ops if none eligible)
      for (let i = 0; i < defenseResult.toolUseGrants; i++) {
        contaminantSystem.grantRandomToolUse(random);
      }

      // overwrite: swap CORE/STORAGE module effects for the next sortie (DEC-031).
      // Applied immediately (not deferred to rift-scene's pending-side-effect consumer)
      // because purification-scene reads gameState.getSortieModifiers() to build the
      // rift scene's transition data before the rift scene itself starts.
      if (defenseResult.moduleSwapTriggered) {
        gameState.setModuleSwapActive(true);
      }
    }

    // Determine final damage per module
    const finalDamageMap = defenseResult
      ? defenseResult.finalDamagePerModule
      : baseDamagePerModule;

    // Apply damage to modules
    const damages: ImpactDamageEntry[] = [];
    const moduleDamage: Record<string, number> = {};
    let newlyZeroModules = 0;

    for (const mod of modules) {
      const dmg = finalDamageMap[mod.id] ?? 0;
      const beforeHp = mod.hp;
      const actualDmg = gameState.applyDamage(mod.id, dmg);
      if (beforeHp > 0 && mod.hp === 0) newlyZeroModules++;
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

    // combust: return this impact's accepted damage as local repair.
    if (defenseResult && Object.keys(defenseResult.healOut).length > 0) {
      for (const [moduleId, amount] of Object.entries(defenseResult.healOut)) {
        gameState.healModule(moduleId, amount);
      }
    }

    // Snapshot before offering maturation: its final impact earns the same record.
    if (slots.some(item => item?.type === 'retrograde' && item.stage === 'defense'
      && (!offeringIds || offeringIds.includes(item.id)))) memoryEarnedPending = true;
    forecastConsumed = true;

    // Emit resolved
    eventBus.emit(GameEvent.IMPACT_RESOLVED, { moduleDamage });

    return {
      damages,
      intensity,
      skipped: false,
      newlyZeroModules,
      defenseResult,
      primaryModuleId: primary.id,
      trueSeverity: severityFromIntensity(intensity),
      baseDamagePerModule: defenseResult ? baseDamagePerModule : undefined,
    };
  },

  /** Establish once per actual impact. Slot/read/unslot cannot earn information.
   * Old already-disclosed lookaheads still flow through the one-element queue.
   */
  generateForecast(
    nextIntensity: number,
    forecastReliabilityBonus = 0,
    nextNextIntensityEstimate: number,
    random: () => number = Math.random,
  ): void {
    if (forecastDisplay && !forecastConsumed) {
      return;
    }
    const modules = gameState.getModules();
    forecastIntensity = nextIntensity;
    forecastNextNextIntensity = nextNextIntensityEstimate;
    forecastConsumed = false;
    forecastCommitted = pendingTargetQueue.length > 0 || memoryEarnedPending;
    memoryEarnedPending = false;
    forecastTargetId = pendingTargetQueue.shift() ?? pickUniform(modules, random).id;
    forecastLookahead = null;
    const trueSeverity = severityFromIntensity(nextIntensity);
    const blurChance = forecastCommitted ? 0 : Math.max(SEVERITY_BLUR_FLOOR_CHANCE,
      SEVERITY_BLUR_BASE_CHANCE - Math.max(0, forecastReliabilityBonus));
    let severity = trueSeverity;
    if (blurChance > 0 && random() < blurChance) {
      const direction = random() < .5 ? -1 : 1;
      severity = SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, Math.max(0, SEVERITY_ORDER.indexOf(trueSeverity) + direction))]!;
    }
    forecastDisplay = { targetId: forecastTargetId, severity };
  },
};
