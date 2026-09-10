/**
 * DefenseEngine — calculates defense slot effects during impact resolution.
 *
 * When an impact occurs, each defense-slotted contaminant applies its type-specific
 * defense effect: damage reduction, side effects for the next sortie, resource gains,
 * and module HP redistribution.
 *
 * This module is pure logic (no Phaser dependency). It reads contaminant data and
 * returns a result struct consumed by the impact system and stored in game state.
 *
 * Spec: docs/tasks/slice-4.md, T3-T4. Slice 5 T3 (docs/tasks/slice-5.md) wires the
 * six mechanics that Slice 4 left as `handled externally` / `future iteration` stubs
 * — see decisions-log.md DEC-029..DEC-033.
 */

import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import type { Contaminant, ContaminantType } from '@/types/game-types';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SideEffectType =
  | 'initial_chaos'
  | 'chaos_rate_mult'
  | 'vision_reduction'
  | 'speed_reduction'
  | 'repair_efficiency'
  | 'upgrade_discount'
  | 'storage_halved'
  | 'proximity_sense_boost'
  /** overwrite (DEC-031): announces the module-swap toast at next sortie start.
   *  The swap itself is applied immediately at impact-resolution time (GameState);
   *  this side effect only drives the existing toast channel. */
  | 'module_swap';

export type SideEffectDuration = 'next_sortie' | 'timed';

export interface PendingSideEffect {
  type: SideEffectType;
  value: number;
  duration: SideEffectDuration;
  durationMs?: number;
  /** The contaminant type that produced this side effect (for UI display). */
  source?: string;
}

export interface DefenseContext {
  /** The forecast target module ID (what the impact system predicted). */
  forecastTargetId: string | null;
  /** The actual primary target module ID (determined by RNG after forecast). */
  actualPrimaryId: string;
  /** Current stability progress (0-100). */
  stabilityProgress: number;
  /** Module HPs before damage: { moduleId -> hp }. */
  moduleHps: Record<string, number>;
  /** Module max HPs: { moduleId -> maxHp }. */
  moduleMaxHps: Record<string, number>;
}

export interface DefenseResult {
  /** Per-module damage after all defense effects. Keys are module IDs. */
  finalDamagePerModule: Record<string, number>;
  /** Side effects to store for consumption at next sortie start. */
  sideEffects: PendingSideEffect[];
  /** Kindling gained from defense effects (e.g. ruminate, mirror). */
  kindlingGain: number;
  /** Stability change from defense effects (e.g. expand nullification). */
  stabilityChange: number;
  /** Whether scatter redistributed damage (overrides normal distribution). */
  scatterRedistributed: boolean;
  /** HP equalization entries from stitch (module id -> hp change). */
  stitchEqualization: Record<string, number>;
  /** Forecast was correct (for retrograde). */
  forecastCorrect: boolean;
  /** Upgrade discount percentage (retrograde correct prediction). */
  upgradeDiscount: number;
  /** Module HP healed after damage resolution (module id -> heal amount). combust burst. */
  healOut: Record<string, number>;
  /** Bonus impact charges granted to defense-slotted contaminants (contaminant id -> count).
   *  resonate/erode (DEC-033). Consumed by contaminantSystem.applyBonusCharges(). */
  bonusCharges: Record<string, number>;
  /** Number of "+1 use to a random tool-stage contaminant" grants this impact. echo.
   *  Consumed by contaminantSystem.grantRandomToolUse(). */
  toolUseGrants: number;
  /** Whether CORE/STORAGE module effects should swap for the next sortie. overwrite
   *  (25% chance, DEC-031). Applied immediately to GameState by the caller. */
  moduleSwapTriggered: boolean;
  /**
   * Per-slot breakdown of what each defense-slotted contaminant actually did this
   * impact (Slice 5.5 D5 / IA §S8). This is the disclosure data the impact result
   * panel renders — none of the ten aggregate outputs above name *which slot*
   * produced them, which is exactly the gap D5 closes. One entry per processed
   * defense-stage contaminant, in slot order.
   */
  slotDisclosures: SlotDisclosure[];
}

/** What a single defense-slotted contaminant did during one impact resolution
 *  (Slice 5.5 D5). Optional fields are only set by the mechanic they belong to. */
export interface SlotDisclosure {
  contaminantId: string;
  type: ContaminantType;
  /** This slot's own reduction fraction (0-1), before compounding with siblings. */
  damageReductionPct: number;
  /** Marginal absolute damage this slot removed this impact — an exact telescoping
   *  decomposition of the multiplicative chain (see applyDefenseEffects), valid for
   *  the normal/scatter paths. Under `expandNullified` this naturally reads as "the
   *  remaining total at that point", since nothing downstream had damage left to
   *  reduce. */
  damageBlocked: number;
  kindlingGain: number;
  stabilityChange: number;
  upgradeDiscount: number;
  sideEffects: PendingSideEffect[];
  toolUseGrant: boolean;
  moduleSwapTriggered: boolean;
  expandNullified: boolean;
  scatterRedistributed: boolean;
  /** stitch: total HP moved toward the mean this impact (sum of positive transfers). */
  equalizationAmount?: number;
  /** combust: burst-release heal amount + which module received it. */
  healAmount?: number;
  healModuleId?: string;
  /** mirror: kindling returned based on this impact's actual damage taken. */
  kindlingReturned?: number;
  /** resonate/erode: total bonus impact charges granted to OTHER slots this impact. */
  bonusChargesGranted?: number;
  /** abyss: bonus unmitigated damage dealt to a full-HP module + which module. */
  bonusDamageDealt?: number;
  bonusDamageModuleId?: string;
}

/**
 * Per-contaminant runtime state that persists across impacts and must survive a
 * save/load cycle (DEC-032/D3). Indexed by contaminant id. New persistent mechanics
 * added later add a field here rather than inventing a new save channel.
 */
export interface ContaminantRuntimeState {
  /** solidify: impacts since last shatter cycle (0 to TIDE-cycle-3). */
  solidifyCounter?: number;
  /** combust: accumulated actual damage toward COMBUST_BURN_THRESHOLD. */
  combustAccumulator?: number;
  /** echo: how many times this (tool-stage) contaminant has received an echo bonus
   *  use. Owned/written by contaminant-system.ts, typed here for the shared schema. */
  echoBonusGranted?: number;
}

// ---------------------------------------------------------------------------
// Internal state: per-contaminant counters that persist across impacts
// ---------------------------------------------------------------------------

/**
 * Solidify shatter counter: tracks how many impacts since last shatter.
 * Key = contaminant ID, value = count (0-3). At 3, next impact shatters (reduced defense).
 */
const solidifyCounters: Map<string, number> = new Map();

/**
 * Combust burn accumulator: tracks cumulative actual damage taken while combust is
 * slotted. Key = contaminant ID, value = accumulated damage. Resets to 0 on burst release.
 */
const combustAccumulators: Map<string, number> = new Map();

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calculate defense effects for the current impact.
 *
 * @param baseDamagePerModule - Raw damage per module before any defense (from impact system).
 * @param defenseSlots - The 3 defense-slotted contaminants (null if empty).
 * @param context - Additional context needed for special mechanics.
 * @returns DefenseResult with final damage and all side effects.
 */
export function applyDefenseEffects(
  baseDamagePerModule: Record<string, number>,
  defenseSlots: (Contaminant | null)[],
  context: DefenseContext,
  offeringIds: readonly (string | null)[] = defenseSlots.map(item => item?.id ?? null),
): DefenseResult {
  const sideEffects: PendingSideEffect[] = [];
  let kindlingGain = 0;
  let stabilityChange = 0;
  let scatterRedistributed = false;
  const stitchEqualization: Record<string, number> = {};
  let upgradeDiscount = 0;
  const bonusCharges: Record<string, number> = {};
  let toolUseGrants = 0;
  let moduleSwapTriggered = false;
  const bonusModuleDamage: Record<string, number> = {};
  const slotDisclosures: SlotDisclosure[] = [];
  // Marginal telescoping decomposition of the multiplicative reduction chain (D5):
  // runningTotal starts at the pre-defense total and each slot's own reduction is
  // applied to whatever remains, so summing every slot's `damageBlocked` below is
  // exactly `sum(baseDamagePerModule) - sum(baseDamagePerModule) * totalReductionMult`
  // — an exact decomposition, not an approximation (see SlotDisclosure doc comment).
  let runningTotalDamage = Object.values(baseDamagePerModule).reduce((a, b) => a + b, 0);

  // Start with base damage
  const finalDamage: Record<string, number> = { ...baseDamagePerModule };

  // Check forecast correctness (for retrograde)
  const forecastCorrect = context.forecastTargetId === context.actualPrimaryId;

  // Collect total damage reduction and special behaviors
  let totalReductionMult = 1.0; // multiplicative remainder after reductions
  let scatterActive = false;
  let expandNullified = false;

  // Process each defense slot
  for (const contaminant of defenseSlots) {
    if (!contaminant) continue;
    if (contaminant.stage !== 'defense') continue;

    const def = CONTAMINANT_DATA[contaminant.type];
    if (!def) continue;

    const effect = applySlotEffect(
      contaminant,
      def.defenseReduction,
      context,
    );

    totalReductionMult *= (1 - effect.damageReduction);
    kindlingGain += effect.kindlingGain;
    stabilityChange += effect.stabilityChange;
    upgradeDiscount += effect.upgradeDiscount;

    if (effect.scatterRedistribute) scatterActive = true;
    if (effect.expandNullified) expandNullified = true;
    if (effect.toolUseGrant) toolUseGrants++;
    if (effect.moduleSwapTriggered) moduleSwapTriggered = true;

    for (const [moduleId, dmg] of Object.entries(effect.bonusModuleDamage)) {
      bonusModuleDamage[moduleId] = (bonusModuleDamage[moduleId] ?? 0) + dmg;
    }

    for (const se of effect.sideEffects) {
      se.source = contaminant.type;
      sideEffects.push(se);
    }

    const blocked = Math.round(runningTotalDamage * effect.damageReduction);
    runningTotalDamage -= blocked;

    const disclosure: SlotDisclosure = {
      contaminantId: contaminant.id,
      type: contaminant.type,
      damageReductionPct: effect.damageReduction,
      damageBlocked: blocked,
      kindlingGain: effect.kindlingGain,
      stabilityChange: effect.stabilityChange,
      upgradeDiscount: effect.upgradeDiscount,
      sideEffects: effect.sideEffects,
      toolUseGrant: effect.toolUseGrant,
      moduleSwapTriggered: effect.moduleSwapTriggered,
      expandNullified: effect.expandNullified,
      scatterRedistributed: effect.scatterRedistribute,
    };
    if (Object.keys(effect.bonusModuleDamage).length > 0) {
      const [moduleId, dmg] = Object.entries(effect.bonusModuleDamage)[0]!;
      disclosure.bonusDamageDealt = dmg;
      disclosure.bonusDamageModuleId = moduleId;
    }

    // Cross-slot impact-charge bonuses (DEC-033/D5). These need the sibling slot
    // list, which applySlotEffect() does not have, so they are computed here.
    if (contaminant.type === 'resonate' && Math.random() < 0.30) {
      // 30% chance: every currently-slotted contaminant (including resonate itself)
      // gets +1 impact charge, all at once.
      let granted = 0;
      for (const otherId of offeringIds) {
        if (otherId) {
          bonusCharges[otherId] = (bonusCharges[otherId] ?? 0) + 1;
          granted++;
        }
      }
      disclosure.bonusChargesGranted = granted;
    }
    if (contaminant.type === 'erode') {
      // Unconditional every impact: +1 to every OTHER slotted contaminant, regardless
      // of how many other slots exist (DEC-033 changed this from a hardcoded "2").
      let granted = 0;
      for (const otherId of offeringIds) {
        if (otherId && otherId !== contaminant.id) {
          bonusCharges[otherId] = (bonusCharges[otherId] ?? 0) + 1;
          granted++;
        }
      }
      disclosure.bonusChargesGranted = granted;
    }

    slotDisclosures.push(disclosure);
  }

  // Apply damage modifications
  if (expandNullified) {
    // Complete nullification: no damage at all
    for (const key of Object.keys(finalDamage)) {
      finalDamage[key] = 0;
    }
  } else if (scatterActive) {
    // Scatter: redistribute total damage evenly across all modules
    scatterRedistributed = true;
    const totalDamage = Object.values(baseDamagePerModule).reduce((a, b) => a + b, 0);
    const reducedTotal = Math.round(totalDamage * totalReductionMult);
    const moduleIds = Object.keys(finalDamage);
    const perModule = Math.floor(reducedTotal / moduleIds.length);
    let remainder = reducedTotal - perModule * moduleIds.length;
    for (const id of moduleIds) {
      finalDamage[id] = perModule + (remainder-- > 0 ? 1 : 0);
    }
  } else {
    // Normal: apply reduction to each module's damage
    for (const key of Object.keys(finalDamage)) {
      finalDamage[key] = Math.round(finalDamage[key]! * totalReductionMult);
    }
  }

  for (const item of defenseSlots) {
    if (!item || item.stage !== 'defense' || item.type !== 'mirror') continue;
    let blocked = 0;
    for (const id of Object.keys(finalDamage)) {
      if (id === context.actualPrimaryId) continue;
      const before = finalDamage[id] ?? 0;
      finalDamage[id] = Math.round(before * (1 - CONTAMINANT_DATA.mirror.defenseSecondaryReduction));
      blocked += before - finalDamage[id]!;
    }
    const disclosure = slotDisclosures.find(value => value.contaminantId === item.id);
    if (disclosure) disclosure.damageBlocked += blocked;
  }

  // abyss: 5% chance of unmitigated bonus damage to a full-HP module. Applied on top
  // of (not reduced by) the normal defense math, since it is a distinct debuff.
  for (const [moduleId, dmg] of Object.entries(bonusModuleDamage)) {
    finalDamage[moduleId] = (finalDamage[moduleId] ?? 0) + dmg;
  }

  // Post-damage: stitch equalization (after damage is determined but before applied)
  for (const contaminant of defenseSlots) {
    if (!contaminant || contaminant.type !== 'stitch') continue;
    if (contaminant.stage !== 'defense') continue;

    // Calculate HP equalization: move 20% of the difference toward the mean
    const moduleIds = Object.keys(context.moduleHps);
    // Simulate HP after damage to compute equalization
    const hpAfterDamage: Record<string, number> = {};
    for (const id of moduleIds) {
      hpAfterDamage[id] = Math.max(0, (context.moduleHps[id] ?? 0) - (finalDamage[id] ?? 0));
    }

    const avgHp = moduleIds.reduce((sum, id) => sum + (hpAfterDamage[id] ?? 0), 0) / moduleIds.length;

    let totalTransferred = 0;
    for (const id of moduleIds) {
      const hp = hpAfterDamage[id] ?? 0;
      const diff = avgHp - hp;
      // Transfer 20% of the difference
      const transfer = Math.round(diff * 0.2);
      if (transfer !== 0) {
        stitchEqualization[id] = transfer;
        if (transfer > 0) totalTransferred += transfer;
      }
    }
    const stitchDisclosure = slotDisclosures.find((d) => d.contaminantId === contaminant.id);
    if (stitchDisclosure) stitchDisclosure.equalizationAmount = totalTransferred;
    break; // Only apply once even if multiple stitch are slotted
  }

  // The ember returns a small, deterministic share of accepted damage this impact.
  // No unreachable multi-impact threshold and no delayed chaos penalty.
  const healOut: Record<string, number> = {};
  for (const item of defenseSlots) {
    if (!item || item.type !== 'combust' || item.stage !== 'defense') continue;
    const ids = Object.keys(context.moduleHps);
    if (ids.length === 0) continue;
    const received = ids.reduce((sum, id) => sum + Math.min(finalDamage[id] ?? 0, context.moduleHps[id] ?? 0), 0);
    const heal = Math.floor(received * CONTAMINANT_DATA.combust.defenseHealRatio);
    if (heal <= 0) continue;
    const lowest = ids.reduce((a, b) => {
      const after = (id: string) => Math.max(0, (context.moduleHps[id] ?? 0) - (finalDamage[id] ?? 0)) + (healOut[id] ?? 0);
      return after(b) < after(a) ? b : a;
    });
    const missing = Math.max(0, (context.moduleMaxHps[lowest] ?? 0) - Math.max(0, (context.moduleHps[lowest] ?? 0) - (finalDamage[lowest] ?? 0)) - (healOut[lowest] ?? 0));
    const actualHeal = Math.min(heal, missing);
    healOut[lowest] = (healOut[lowest] ?? 0) + actualHeal;
    const disclosure = slotDisclosures.find(value => value.contaminantId === item.id);
    if (disclosure) { disclosure.healAmount = actualHeal; disclosure.healModuleId = lowest; }
    combustAccumulators.delete(item.id);
  }

  return {
    finalDamagePerModule: finalDamage,
    sideEffects,
    kindlingGain,
    stabilityChange,
    scatterRedistributed,
    stitchEqualization,
    forecastCorrect,
    upgradeDiscount,
    healOut,
    bonusCharges,
    toolUseGrants,
    moduleSwapTriggered,
    slotDisclosures,
  };
}

/** Reset internal counters (on new game). */
export function resetDefenseEngine(): void {
  solidifyCounters.clear();
  combustAccumulators.clear();
}

/**
 * Snapshot persistent per-contaminant state for SaveManager (D3). Covers solidify's
 * shatter counter and combust's burn accumulator; echo's bonus-grant cap lives in
 * contaminant-system.ts and is merged into the same save section by SaveManager.
 */
export function getDefenseRuntimeState(): Record<string, ContaminantRuntimeState> {
  const out: Record<string, ContaminantRuntimeState> = {};
  for (const [id, counter] of solidifyCounters) {
    out[id] = { ...out[id], solidifyCounter: counter };
  }
  for (const [id, accum] of combustAccumulators) {
    out[id] = { ...out[id], combustAccumulator: accum };
  }
  return out;
}

/**
 * Restore persistent per-contaminant state from a save file (D3). Missing/undefined
 * input (old saves without this field) resets to empty, matching resetDefenseEngine().
 */
export function loadDefenseRuntimeState(state: Record<string, ContaminantRuntimeState> | undefined): void {
  solidifyCounters.clear();
  combustAccumulators.clear();
  if (!state) return;
  for (const [id, s] of Object.entries(state)) {
    if (typeof s.solidifyCounter === 'number') solidifyCounters.set(id, s.solidifyCounter);
    if (typeof s.combustAccumulator === 'number') combustAccumulators.set(id, s.combustAccumulator);
  }
}

// ---------------------------------------------------------------------------
// Per-type effect logic
// ---------------------------------------------------------------------------

interface SlotEffectResult {
  damageReduction: number;
  kindlingGain: number;
  stabilityChange: number;
  upgradeDiscount: number;
  scatterRedistribute: boolean;
  expandNullified: boolean;
  sideEffects: PendingSideEffect[];
  /** echo: grant +1 use to a random tool-stage contaminant this impact. */
  toolUseGrant: boolean;
  /** overwrite: 25% roll succeeded, swap CORE/STORAGE effects for next sortie. */
  moduleSwapTriggered: boolean;
  /** abyss: 5% roll succeeded, extra unmitigated damage to a full-HP module (module id -> amount). */
  bonusModuleDamage: Record<string, number>;
}

function applySlotEffect(
  contaminant: Contaminant,
  baseReduction: number,
  context: DefenseContext,
): SlotEffectResult {
  const result: SlotEffectResult = {
    damageReduction: baseReduction,
    kindlingGain: 0,
    stabilityChange: 0,
    upgradeDiscount: 0,
    scatterRedistribute: false,
    expandNullified: false,
    sideEffects: [],
    toolUseGrant: false,
    moduleSwapTriggered: false,
    bonusModuleDamage: {},
  };

  switch (contaminant.type) {
    case 'solidify':
      break;
    case 'ruminate':
      applyRuminate(result);
      break;
    case 'scatter':
      applyScatter(result);
      break;
    case 'retrograde':
      break;
    case 'muffle':
      break;
    case 'kindle':
      break;
    case 'stitch':
      applyStitch(result);
      break;
    case 'delay':
      applyDelay(result);
      break;
    case 'siphon':
      applySiphon(result);
      break;
    case 'expand':
      break;
    default:
      // For types without special common-tier mechanics, apply the CSV base reduction
      // plus whichever generic mechanic (Slice 5 T3) that type defines.
      applyGenericDefense(contaminant.type, result, context);
      break;
  }

  return result;
}

// --- Common tier implementations ---

/** Ruminate: 30% reduction + 2 kindling + side effect: initial chaos +5. */
function applyRuminate(result: SlotEffectResult): void {
  result.damageReduction = 0.30;
  result.kindlingGain = 2;
  result.sideEffects.push({
    type: 'initial_chaos',
    value: 5,
    duration: 'next_sortie',
  });
}

/** Scatter: redistribute damage evenly + side effect: initial chaos +3. */
function applyScatter(result: SlotEffectResult): void {
  result.damageReduction = CONTAMINANT_DATA.scatter.defenseReduction;
  result.scatterRedistribute = true;

}

/** Stitch: 25% reduction + post-impact HP equalization. Side effect: speed -10%. */
function applyStitch(result: SlotEffectResult): void {
  result.damageReduction = 0.25;
  // Equalization is done in the main function after damage calc.
  result.sideEffects.push({
    type: 'speed_reduction',
    value: 0.10,
    duration: 'next_sortie',
  });
}

// --- Fine tier implementations ---

/** Delay: 50% damage converted to chaos rate mult for next sortie (not HP reduction). */
function applyDelay(result: SlotEffectResult): void {
  // Effectively reduces HP damage by 50% but converts it to a debuff.
  result.damageReduction = 0.50;
  result.sideEffects.push({
    type: 'chaos_rate_mult',
    value: 2.0,
    duration: 'timed',
    durationMs: 30000,
  });
}

/**
 * Siphon: 25% reduction. Side effect: 25% chance storage halved.
 *
 * The repair-efficiency doubling this type's CSV also promises ("装备期间所有薪柴修复
 * 模块的效率翻倍") is NOT computed here: it is a standing "while equipped" bonus, not a
 * per-impact trigger, so it is owned by `ContaminantSystem.syncRepairEfficiencyMult()` +
 * `GameState` instead (same split as resonate's module-cap bonus, which for the same
 * reason never appears in this file either) - see `PURIFICATION.SIPHON_REPAIR_EFFICIENCY_MULT`.
 */
function applySiphon(result: SlotEffectResult): void {
  result.damageReduction = 0.25;
  if (Math.random() < 0.25) {
    result.sideEffects.push({
      type: 'storage_halved',
      value: 0.5,
      duration: 'next_sortie',
    });
  }
}

// --- Rare (+ remaining Fine) tier implementations (Slice 5 T3) ---

function applyGenericDefense(type: ContaminantType, result: SlotEffectResult, context: DefenseContext): void {
  const def = CONTAMINANT_DATA[type];
  if (!def) return;
  result.damageReduction = def.defenseReduction;

  switch (type) {
    case 'resonate':
      // Main effect (reduction) only here; the 30% cross-slot charge bonus needs the
      // sibling slot list and is computed in applyDefenseEffects (DEC-033).
      break;
    case 'overwrite':
      // Base effect: unconditional 30% discount on the next upgrade purchase.
      result.upgradeDiscount = 0.30;
      // Side effect: 25% chance to swap CORE/STORAGE module effects for 1 sortie (DEC-031).
      if (Math.random() < 0.25) {
        result.moduleSwapTriggered = true;
        result.sideEffects.push({
          type: 'module_swap',
          value: 1,
          duration: 'next_sortie',
        });
      }
      break;
    case 'erode':
      // Main effect (+1 impact charge to all other slots) is unconditional and computed
      // in applyDefenseEffects (needs sibling slot list, DEC-033/D5).
      // Side effect: 20% chance next sortie initial chaos +8.
      if (Math.random() < 0.20) {
        result.sideEffects.push({
          type: 'initial_chaos',
          value: 8,
          duration: 'next_sortie',
        });
      }
      break;
    case 'compress':
      result.damageReduction = 0.45;
      result.sideEffects.push({
        type: 'speed_reduction',
        value: 0.25,
        duration: 'timed',
        durationMs: 20000,
      });
      break;
    case 'mirror':
      // Secondary-ripple attenuation is resolved with real damage above.
      break;
    case 'echo':
      result.damageReduction = 0.20;
      // Main effect: unconditional +1 use to a random tool-stage contaminant (up to a
      // per-tool cap of +2, enforced by contaminant-system.grantRandomToolUse()).
      result.toolUseGrant = true;
      if (Math.random() < 0.20) {
        result.sideEffects.push({
          type: 'initial_chaos',
          value: 6,
          duration: 'next_sortie',
        });
      }
      break;
    case 'abyss': {
      // Dynamic reduction: 20% base + 15% per module below 50% HP, capped at 65%.
      // DEC-029: judged on PRE-damage module HP (this impact's own damage does not
      // count toward the bonus that reduces it).
      const moduleIds = Object.keys(context.moduleHps);
      const lowHpCount = moduleIds.filter((id) => {
        const hp = context.moduleHps[id] ?? 0;
        const maxHp = context.moduleMaxHps[id] ?? 1;
        return maxHp > 0 && hp / maxHp < 0.5;
      }).length;
      result.damageReduction = Math.min(0.65, 0.20 + lowHpCount * 0.15);

      // Side effect: 5% chance to hit a full-HP module for 10% of its max HP,
      // unmitigated (applied after the normal reduction math in applyDefenseEffects).
      if (Math.random() < 0.05) {
        const fullHpIds = moduleIds.filter(
          (id) => (context.moduleHps[id] ?? 0) >= (context.moduleMaxHps[id] ?? 0),
        );
        if (fullHpIds.length > 0) {
          const targetId = fullHpIds[Math.floor(Math.random() * fullHpIds.length)]!;
          const dmg = Math.round((context.moduleMaxHps[targetId] ?? 0) * 0.10);
          result.bonusModuleDamage[targetId] = (result.bonusModuleDamage[targetId] ?? 0) + dmg;
        }
      }
      break;
    }
    case 'combust':
      // Accumulation + burst-release heal is computed post-damage in applyDefenseEffects
      // (needs the contaminant id + actual damage taken this impact, DEC-030).
      break;
    default:
      break;
  }
}
