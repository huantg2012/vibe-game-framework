/**
 * ImpactSystem - calculates and applies module damage each cycle.
 *
 * Called once per sortie entry (after allocation, before scene switch).
 * Owns no rendering; the scene that calls `run()` is responsible for the
 *演出 (shake, particle surge, result panel).
 *
 * Architecture: does not import other systems (contaminantSystem is a pre-existing
 * exception used for bonus-charge/tool-use grants and, since Slice 5 D6, the mirror
 * forecast-misreport check below — reuses that existing import rather than adding a new
 * one). Tide/growth-derived numbers (intensity, forecast_clarity level) are passed in as
 * parameters by the scene layer instead, to preserve DEC-ARCH-002 (see generateForecast()).
 * Reads/writes GameState, emits events through the bus.
 *
 * Slice 4: integrates DefenseEngine to apply defense slot effects before damage.
 * Slice 5 D6 (DEC-034): forecast is non-spatial — see generateForecast()/getForecastDisplay().
 * Slice 5 (muffle forecast-advance closure): while muffle is defense-slotted, an extra
 * "lookahead" layer previews the impact AFTER next — see generateForecast()'s queue logic
 * and getForecastLookahead().
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
  /** Defense engine result (null when skipped or no defense slots active). */
  readonly defenseResult?: DefenseResult;
  /** The module that took the 65% "重点目标" share this impact (ground truth).
   *  Always set when `!skipped`. Slice 5.5 D5: lets the result panel show a
   *  predicted-vs-actual line without exposing the internal forecastTargetId. */
  readonly primaryModuleId?: string;
  /** This impact's true severity tier, independent of forecast display noise
   *  (mirror misreport / baseline blur — see generateForecast()). */
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

/** What the boundary atmosphere / HUD actually shows the player. May lie (mirror) or
 *  blur (baseline forecast noise) relative to the true target/severity — see
 *  generateForecast(). */
export interface ForecastDisplay {
  readonly targetId: string;
  readonly severity: ForecastSeverity;
}

/**
 * muffle's "one extra round of warning" (CSV: 装备期间冲击预告多显示一层). Previews the
 * impact AFTER next — one step further than `ForecastDisplay`. Both fields are as
 * reliable as the layer-1 forecast (same FORECAST_ACCURACY bias applies once it becomes
 * the real forecast; see generateForecast()'s doc comment for why tide progression makes
 * the severity component an exact prediction, not a guess). Only ever non-null while
 * muffle is currently defense-slotted.
 */
export interface ForecastLookahead {
  readonly targetId: string;
  readonly severity: ForecastSeverity;
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

/**
 * mirror's forecast deception (DEC-034 replaces the old "particle direction mirror-flip"
 * with a lie about the target module). Rate carried over unchanged from the Slice 4/CSV
 * intent ("10% 概率...预告...误导"). Local constant — mirror's damage-reduction effect
 * itself still lives in defense-engine.ts; this is purely the display-layer deception.
 */
const MIRROR_MISREPORT_CHANCE = 0.10;

/**
 * Baseline chance the severity tier shown is blurred by one notch (independent of
 * mirror) — represents the boundary reading's inherent noise. growth_forecast_clarity
 * sharpens both this and MIRROR_MISREPORT_CHANCE via the same reliability bonus.
 */
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

function pickUniform<T extends { id: string }>(items: readonly T[], exceptId?: string | null): T {
  const pool = exceptId ? items.filter((m) => m.id !== exceptId) : items;
  const source = pool.length > 0 ? pool : items;
  return source[Math.floor(Math.random() * source.length)]!;
}

function pickPrimaryModule<T extends { id: string }>(
  modules: readonly T[],
  forecastId: string | null,
): T {
  const forecast = forecastId ? modules.find((m) => m.id === forecastId) : undefined;
  if (Math.random() < P.FORECAST_ACCURACY) {
    return forecast ?? pickUniform(modules);
  }
  return pickUniform(modules, forecastId);
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

/**
 * Chooses which module is the "heavy target" this cycle (ground truth). Feeds run()'s
 * FORECAST_ACCURACY bias and defense-engine's `forecastCorrect` check (retrograde) — both
 * unchanged by DEC-034. `forecastDisplay` (below) is the separate, possibly-inaccurate
 * value actually rendered to the player.
 */
let forecastTargetId: string | null = null;
let forecastDisplay: ForecastDisplay | null = null;

/**
 * Pre-committed ground-truth targets not yet consumed as `forecastTargetId`. Populated
 * one entry ahead while muffle is defense-slotted (see generateForecast()) so that the
 * lookahead layer it previews is an actual promise — the value shown now is guaranteed to
 * become the real forecastTargetId on the following generateForecast() call, not an
 * independent re-roll that could disagree with what was shown.
 */
const pendingTargetQueue: string[] = [];
let forecastLookahead: ForecastLookahead | null = null;

export const impactSystem = {
  /**
   * The player-facing forecast (target module + severity tier), possibly misreported
   * by mirror or blurred by baseline forecast noise (DEC-034). Null before the first
   * generateForecast() call.
   */
  getForecastDisplay(): ForecastDisplay | null {
    return forecastDisplay;
  },

  /**
   * muffle's extra lookahead layer (preview of the impact after next). Null unless
   * muffle is currently defense-slotted — see generateForecast().
   */
  getForecastLookahead(): ForecastLookahead | null {
    return forecastLookahead;
  },

  /** Clears forecast state (new game) — see main-menu-scene.ts's startNewExpedition(). */
  resetForecastState(): void {
    forecastTargetId = null;
    forecastDisplay = null;
    pendingTargetQueue.length = 0;
    forecastLookahead = null;
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
    const primary = pickPrimaryModule(modules, forecastTargetId);
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
        stabilityProgress: 0, // TODO: wire stabilityTracker
        moduleHps,
        moduleMaxHps,
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

      // Store upgrade discount. Repair efficiency (siphon) is NOT set here - it is a
      // standing "while equipped" bonus owned by ContaminantSystem.syncRepairEfficiencyMult()
      // (called on every defense-slot mutation), not a per-impact trigger. See
      // defense-engine.ts's applySiphon() doc comment for why.
      if (defenseResult.upgradeDiscount > 0) {
        gameState.setUpgradeDiscount(defenseResult.upgradeDiscount);
      }

      // resonate/erode: cross-slot impact-charge bonuses (DEC-033)
      if (Object.keys(defenseResult.bonusCharges).length > 0) {
        contaminantSystem.applyBonusCharges(defenseResult.bonusCharges);
      }

      // echo: grant +1 use to a random tool-stage contaminant (no-ops if none eligible)
      for (let i = 0; i < defenseResult.toolUseGrants; i++) {
        contaminantSystem.grantRandomToolUse();
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

    // combust: burst-release heal to the lowest-HP module (DEC-030)
    if (defenseResult && Object.keys(defenseResult.healOut).length > 0) {
      for (const [moduleId, amount] of Object.entries(defenseResult.healOut)) {
        gameState.healModule(moduleId, amount);
      }
    }

    // Emit resolved
    eventBus.emit(GameEvent.IMPACT_RESOLVED, { moduleDamage });

    return {
      damages,
      intensity,
      skipped: false,
      defenseResult,
      primaryModuleId: primary.id,
      trueSeverity: severityFromIntensity(intensity),
      baseDamagePerModule: defenseResult ? baseDamagePerModule : undefined,
    };
  },

  /**
   * Decide and store the forecast target + severity for the NEXT impact, and (while
   * muffle is defense-slotted) pre-commit + preview the target/severity for the impact
   * AFTER that. Call this when entering the purification scene (both on fresh entry and
   * on return from the rift).
   *
   * @param nextIntensity - The intensity the next impact will actually use. Callers pass
   *   `tideSystem.getCurrentIntensity()` (read AFTER `tideSystem.advanceCycle()` has run
   *   for this visit, if it did) — that value is exactly what `run()` will read via
   *   `gameState.setImpactIntensity()` at the start of the next visit, since tide state
   *   doesn't change between visits except through advanceCycle(). Passed as a parameter
   *   (rather than importing tideSystem here) to preserve DEC-ARCH-002.
   * @param forecastReliabilityBonus - `growthSystem.getModifiers().forecastClarity`
   *   (already level * effectPerLevel, i.e. 0/0.05/0.10/0.15 — not a raw level). Defaults
   *   to 0 if the caller can't provide it. Passed in rather than importing growthSystem
   *   directly, same DEC-ARCH-002 reasoning as nextIntensity.
   * @param nextNextIntensityEstimate - The intensity the impact AFTER next will use, i.e.
   *   `tideSystem.peekNextIntensity()` read at the SAME call site as `nextIntensity`
   *   above (a pure preview of tide state one more advanceCycle() ahead — exact, since
   *   advanceCycle() has no RNG). Only consumed when muffle is defense-slotted.
   */
  generateForecast(
    nextIntensity: number,
    forecastReliabilityBonus = 0,
    nextNextIntensityEstimate: number,
  ): void {
    const modules = gameState.getModules();

    // Ground truth for the upcoming impact. Consumes a pre-committed pick from
    // pendingTargetQueue if muffle queued one ahead of time (see below); otherwise rolls
    // fresh, identical to the pre-lookahead behaviour. Feeds run()'s FORECAST_ACCURACY
    // bias and defense-engine's `forecastCorrect` check (retrograde) — both unaffected by
    // where the value came from, since only the resulting id matters to either.
    forecastTargetId = pendingTargetQueue.length > 0
      ? pendingTargetQueue.shift()!
      : pickUniform(modules).id;
    const trueSeverity = severityFromIntensity(nextIntensity);

    // growth_forecast_clarity (DEC-034): sharpens both the mirror misreport chance and
    // the baseline severity blur chance via the same reliability bonus.
    const reliabilityBonus = Math.max(0, forecastReliabilityBonus);

    // mirror (DEC-034): if currently defense-slotted, 10% chance (minus reliability) to
    // misreport the target module. Uses the existing contaminantSystem import (see file
    // header) rather than threading defenseSlots through as a second parameter.
    const slotted = contaminantSystem.getDefenseSlotted();
    const mirrorSlotted = slotted.some((c) => c !== null && c.type === 'mirror' && c.stage === 'defense');
    const misreportChance = mirrorSlotted ? Math.max(0, MIRROR_MISREPORT_CHANCE - reliabilityBonus) : 0;
    const displayTargetId = Math.random() < misreportChance
      ? pickUniform(modules, forecastTargetId).id
      : forecastTargetId;

    // Baseline severity blur: independent of mirror, always possible, sharpened by the
    // same reliability bonus down to a residual floor (never perfectly precise).
    const blurChance = Math.max(SEVERITY_BLUR_FLOOR_CHANCE, SEVERITY_BLUR_BASE_CHANCE - reliabilityBonus);
    let displaySeverity = trueSeverity;
    if (Math.random() < blurChance) {
      const idx = SEVERITY_ORDER.indexOf(trueSeverity);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const clamped = Math.min(SEVERITY_ORDER.length - 1, Math.max(0, idx + dir));
      displaySeverity = SEVERITY_ORDER[clamped]!;
    }

    forecastDisplay = { targetId: displayTargetId, severity: displaySeverity };

    // muffle (CSV: 装备期间冲击预告多显示一层 — "比正常多1轮准备时间"): while equipped,
    // pre-commit (if not already promised by a previous round) the ground-truth target
    // for the impact AFTER next, and preview it alongside a severity read off the
    // deterministic tide-state peek. This queued target is what forecastTargetId will
    // actually become on the NEXT generateForecast() call — not a second independent
    // guess — so the preview carries the same reliability as the layer-1 forecast above,
    // it is just further out. The reuses-getDefenseSlotted() call above avoids a second
    // contaminantSystem query.
    const muffleSlotted = slotted.some((c) => c !== null && c.type === 'muffle' && c.stage === 'defense');
    if (muffleSlotted) {
      if (pendingTargetQueue.length === 0) {
        pendingTargetQueue.push(pickUniform(modules).id);
      }
      const lookaheadTargetId = pendingTargetQueue[0]!;
      forecastLookahead = { targetId: lookaheadTargetId, severity: severityFromIntensity(nextNextIntensityEstimate) };
    } else {
      forecastLookahead = null;
    }
  },
};
