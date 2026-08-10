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
 * Spec: docs/tasks/slice-4.md, T3-T4.
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
  | 'proximity_sense_boost';

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
  /** Kindling gained from defense effects (e.g. ruminate). */
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
  /** Repair efficiency multiplier (siphon). */
  repairEfficiencyMult: number;
}

// ---------------------------------------------------------------------------
// Internal state: per-contaminant counters that persist across impacts
// ---------------------------------------------------------------------------

/**
 * Solidify shatter counter: tracks how many impacts since last shatter.
 * Key = contaminant ID, value = count (0-3). At 3, next impact shatters (reduced defense).
 */
const solidifyCounters: Map<string, number> = new Map();

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
): DefenseResult {
  const sideEffects: PendingSideEffect[] = [];
  let kindlingGain = 0;
  let stabilityChange = 0;
  let scatterRedistributed = false;
  const stitchEqualization: Record<string, number> = {};
  let upgradeDiscount = 0;
  let repairEfficiencyMult = 1.0;

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
      forecastCorrect,
      context,
    );

    totalReductionMult *= (1 - effect.damageReduction);
    kindlingGain += effect.kindlingGain;
    stabilityChange += effect.stabilityChange;
    upgradeDiscount += effect.upgradeDiscount;

    if (effect.repairEfficiencyMult > 1.0) {
      repairEfficiencyMult = Math.max(repairEfficiencyMult, effect.repairEfficiencyMult);
    }

    if (effect.scatterRedistribute) scatterActive = true;
    if (effect.expandNullified) expandNullified = true;

    for (const se of effect.sideEffects) {
      se.source = contaminant.type;
      sideEffects.push(se);
    }
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
    const perModule = Math.round(reducedTotal / moduleIds.length);
    for (const id of moduleIds) {
      finalDamage[id] = perModule;
    }
  } else {
    // Normal: apply reduction to each module's damage
    for (const key of Object.keys(finalDamage)) {
      finalDamage[key] = Math.round(finalDamage[key]! * totalReductionMult);
    }
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

    for (const id of moduleIds) {
      const hp = hpAfterDamage[id] ?? 0;
      const diff = avgHp - hp;
      // Transfer 20% of the difference
      const transfer = Math.round(diff * 0.2);
      if (transfer !== 0) {
        stitchEqualization[id] = transfer;
      }
    }
    break; // Only apply once even if multiple stitch are slotted
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
    repairEfficiencyMult,
  };
}

/** Reset internal counters (on new game). */
export function resetDefenseEngine(): void {
  solidifyCounters.clear();
}

// ---------------------------------------------------------------------------
// Per-type effect logic
// ---------------------------------------------------------------------------

interface SlotEffectResult {
  damageReduction: number;
  kindlingGain: number;
  stabilityChange: number;
  upgradeDiscount: number;
  repairEfficiencyMult: number;
  scatterRedistribute: boolean;
  expandNullified: boolean;
  sideEffects: PendingSideEffect[];
}

function applySlotEffect(
  contaminant: Contaminant,
  baseReduction: number,
  forecastCorrect: boolean,
  _context: DefenseContext,
): SlotEffectResult {
  const result: SlotEffectResult = {
    damageReduction: baseReduction,
    kindlingGain: 0,
    stabilityChange: 0,
    upgradeDiscount: 0,
    repairEfficiencyMult: 1.0,
    scatterRedistribute: false,
    expandNullified: false,
    sideEffects: [],
  };

  switch (contaminant.type) {
    case 'solidify':
      applySolidify(contaminant, result);
      break;
    case 'ruminate':
      applyRuminate(result);
      break;
    case 'scatter':
      applyScatter(result);
      break;
    case 'retrograde':
      applyRetrograde(forecastCorrect, result);
      break;
    case 'muffle':
      applyMuffle(result);
      break;
    case 'kindle':
      applyKindle(result);
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
      applyExpand(result);
      break;
    default:
      // For types without special mechanics, just use the base reduction from data
      // and apply generic side effect if the CSV defines one
      applyGenericDefense(contaminant.type, result);
      break;
  }

  return result;
}

// --- Common tier implementations ---

/** Solidify: 35% reduction, every 4th impact reduces to 20% (shatter cycle). */
function applySolidify(contaminant: Contaminant, result: SlotEffectResult): void {
  const counter = solidifyCounters.get(contaminant.id) ?? 0;

  if (counter >= 3) {
    // Shatter: reduced defense this impact
    result.damageReduction = 0.20;
    solidifyCounters.set(contaminant.id, 0);
  } else {
    result.damageReduction = 0.35;
    solidifyCounters.set(contaminant.id, counter + 1);
  }
}

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
  // Scatter doesn't reduce total damage but redistributes it.
  // The effective reduction on the primary target is ~50% (since it splits evenly).
  // We set damageReduction to 0 here; the redistribution is handled in the main function.
  result.damageReduction = 0;
  result.scatterRedistribute = true;
  result.sideEffects.push({
    type: 'initial_chaos',
    value: 3,
    duration: 'next_sortie',
  });
}

/** Retrograde: 15% base + 20% upgrade discount on correct forecast + vision penalty on wrong. */
function applyRetrograde(forecastCorrect: boolean, result: SlotEffectResult): void {
  result.damageReduction = 0.15;
  if (forecastCorrect) {
    result.upgradeDiscount = 0.20;
  } else {
    result.sideEffects.push({
      type: 'vision_reduction',
      value: 0.05,
      duration: 'next_sortie',
    });
  }
}

/** Muffle: 30% reduction + advance forecast 1 round. Side effect: enemy proximity sense +15%. */
function applyMuffle(result: SlotEffectResult): void {
  result.damageReduction = 0.30;
  // The "forecast advance" is a passive benefit handled by the purification scene reading
  // defense slots. The side effect is what we track here.
  result.sideEffects.push({
    type: 'proximity_sense_boost',
    value: 0.15,
    duration: 'next_sortie',
  });
}

/** Kindle: 15% reduction, charge_mult=2.0 (already handled by contaminant system). Side effect: initial chaos +4. */
function applyKindle(result: SlotEffectResult): void {
  result.damageReduction = 0.15;
  result.sideEffects.push({
    type: 'initial_chaos',
    value: 4,
    duration: 'next_sortie',
  });
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

/** Siphon: 25% reduction + repair efficiency doubled. Side effect: 25% chance storage halved. */
function applySiphon(result: SlotEffectResult): void {
  result.damageReduction = 0.25;
  result.repairEfficiencyMult = 2.0;
  if (Math.random() < 0.25) {
    result.sideEffects.push({
      type: 'storage_halved',
      value: 0.5,
      duration: 'next_sortie',
    });
  }
}

/** Expand: 50% chance to completely nullify. On success: stability -1. */
function applyExpand(result: SlotEffectResult): void {
  if (Math.random() < 0.5) {
    result.expandNullified = true;
    result.damageReduction = 1.0; // full nullification
    result.stabilityChange = -1;
  } else {
    result.damageReduction = 0; // failed: no reduction
  }
}

// --- Generic fallback for rare+ types without special common-tier mechanics ---

function applyGenericDefense(type: ContaminantType, result: SlotEffectResult): void {
  const def = CONTAMINANT_DATA[type];
  if (!def) return;
  result.damageReduction = def.defenseReduction;

  // Apply generic side effects based on the CSV data
  // These are probabilistic or conditional per the spec
  switch (type) {
    case 'resonate':
      // 30% chance all slots get +1 impact count (handled externally via event)
      break;
    case 'overwrite':
      // 25% chance module function swap (too complex for Slice 4, skip)
      result.upgradeDiscount = 0.30;
      break;
    case 'erode':
      // +1 impact count to other 2 defense slots (handled externally)
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
      // 10% chance of forecast misinformation (handled by purification scene)
      result.damageReduction = 0.25;
      // Return kindling = 10% of damage taken (calculated elsewhere after damage is known)
      break;
    case 'echo':
      // +1 use to a random tool (handled externally)
      result.damageReduction = 0.20;
      if (Math.random() < 0.20) {
        result.sideEffects.push({
          type: 'initial_chaos',
          value: 6,
          duration: 'next_sortie',
        });
      }
      break;
    case 'abyss':
      // Bonus reduction per low-HP module (calculated from context)
      result.damageReduction = 0.20;
      // The dynamic bonus is handled via context in a future iteration
      if (Math.random() < 0.05) {
        // 5% chance to hurt a full-HP module by 10% (handled externally)
      }
      break;
    case 'combust':
      // Accumulates damage for burst heal (requires persistent state, future iteration)
      result.damageReduction = 0.25;
      break;
    default:
      break;
  }
}
