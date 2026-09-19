import { getContaminantOffering } from './contaminant-catalog';
/** Pure offering resolution for the thirteen current contaminant families.
 * CSV owns values. ImpactSystem applies this result before InventoryStore matures
 * the same offering snapshot. Legacy return fields remain empty for compatibility.
 * Spec: docs/specs/system-purification-impact.md, iteration20 rules51–61.
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
  /** Legacy compatibility, always empty; stitch now transfers damage before application. */
  stitchEqualization: Record<string, number>;
  /** Whether the displayed target matched the actual primary. */
  forecastCorrect: boolean;
  /** Legacy compatibility; current families grant no upgrade discount. */
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
  /** Highest one-shot repair allowance earned by accepted damage this impact. */
  repairBonusHp: number;
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
  /** Legacy compatibility; current stitch reports transferredDamage instead. */
  equalizationAmount?: number;
  transferredDamage?: number;
  transferModuleId?: string;
  repairBonusHp?: number;
  /** combust: burst-release heal amount + which module received it. */
  healAmount?: number;
  healModuleId?: string;
  /** mirror: kindling returned based on this impact's actual damage taken. */
  kindlingReturned?: number;
  /** resonate/erode: total bonus impact charges granted to OTHER slots this impact. */
  bonusChargesGranted?: number;
  /** Legacy compatibility; current abyss never deals bonus damage. */
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

// Legacy counters are round-tripped for old saves, but no retired effect executes.
let legacyRuntime: Record<string, ContaminantRuntimeState> = {};

/** Resolve the thirteen current families against the same pre-impact snapshot.
 * Base attenuation compounds, distribution preserves its integer total, then local
 * attenuation and safe transfers run. No random hidden penalties or free refills.
 */
export function applyDefenseEffects(
  baseDamagePerModule: Record<string, number>,
  defenseSlots: (Contaminant | null)[],
  context: DefenseContext,
  _offeringIds: readonly (string | null)[] = [],
): DefenseResult {
  const items = defenseSlots.filter((item): item is Contaminant => item !== null && item.stage === 'defense');
  const moduleIds = Object.keys(baseDamagePerModule);
  const finalDamage = { ...baseDamagePerModule };
  const slotDisclosures: SlotDisclosure[] = [];
  let totalReductionMult = 1;
  let runningTotal = Object.values(baseDamagePerModule).reduce((sum, damage) => sum + damage, 0);
  const scatterRedistributed = items.some(item => item.type === 'scatter');
  for (const item of items) {
    const reduction = getContaminantOffering(item).reduction;
    const blocked = Math.round(runningTotal * reduction);
    runningTotal -= blocked;
    totalReductionMult *= 1 - reduction;
    slotDisclosures.push({ contaminantId: item.id, type: item.type, damageReductionPct: reduction,
      damageBlocked: blocked, kindlingGain: 0, stabilityChange: 0, upgradeDiscount: 0,
      sideEffects: [], toolUseGrant: false, moduleSwapTriggered: false,
      expandNullified: false, scatterRedistributed: item.type === 'scatter' });
  }
  if (scatterRedistributed && moduleIds.length > 0) {
    const total = Math.round(Object.values(baseDamagePerModule).reduce((sum, damage) => sum + damage, 0) * totalReductionMult);
    const share = Math.floor(total / moduleIds.length);
    let remainder = total - share * moduleIds.length;
    for (const id of moduleIds) finalDamage[id] = share + (remainder-- > 0 ? 1 : 0);
  } else {
    for (const id of moduleIds) finalDamage[id] = finalDamage[id]! * totalReductionMult;
  }
  for (const item of items) {
    const disclosure = slotDisclosures.find(value => value.contaminantId === item.id)!;
    if(item.type === 'catalog') continue;
    const def = CONTAMINANT_DATA[item.type];
    for (const id of moduleIds) {
      let localRemainder = 1;
      if (item.type === 'mirror' && id !== context.actualPrimaryId) localRemainder = 1 - def.defenseSecondaryReduction;
      if (item.type === 'compress' && id === context.actualPrimaryId) localRemainder = 1 - def.defensePrimaryReduction;
      if (item.type === 'abyss' && (context.moduleMaxHps[id] ?? 0) > 0
        && (context.moduleHps[id] ?? 0) / context.moduleMaxHps[id]! <= def.defenseLowHpThreshold) {
        // Replace this item's 20% base attenuation with its 50% low-HP attenuation.
        localRemainder = (1 - def.defenseLowHpReduction) / (1 - def.defenseReduction);
      }
      const before = finalDamage[id]!;
      finalDamage[id] = before * localRemainder;
      disclosure.damageBlocked += Math.round(before) - Math.round(finalDamage[id]!);
    }
  }
  for (const id of moduleIds) finalDamage[id] = Math.round(finalDamage[id]!);
  for (const item of items) {
    if (item.type !== 'stitch') continue;
    const primary = context.actualPrimaryId;
    const recipients = moduleIds.filter(id => id !== primary).sort((a, b) =>
      ((context.moduleHps[b] ?? 0) - (finalDamage[b] ?? 0)) - ((context.moduleHps[a] ?? 0) - (finalDamage[a] ?? 0)));
    const recipient = recipients[0];
    if (!recipient) continue;
    const capacity = Math.max(0, (context.moduleHps[recipient] ?? 0) - (finalDamage[recipient] ?? 0) - 1);
    const transfer = Math.min(CONTAMINANT_DATA.stitch.defenseTransferCap, finalDamage[primary] ?? 0, capacity);
    if (transfer <= 0) continue;
    finalDamage[primary] = (finalDamage[primary] ?? 0) - transfer;
    finalDamage[recipient] = (finalDamage[recipient] ?? 0) + transfer;
    const disclosure = slotDisclosures.find(value => value.contaminantId === item.id)!;
    disclosure.transferredDamage = transfer;
    disclosure.transferModuleId = recipient;
  }
  // Per-module rounding may leave a one-point residual relative to the slot chain.
  // Attribute it to the latest mitigating slot; transfer itself never counts as blocked.
  const actualBlocked = Object.values(baseDamagePerModule).reduce((sum, value) => sum + value, 0)
    - Object.values(finalDamage).reduce((sum, value) => sum + value, 0);
  let residual = actualBlocked - slotDisclosures.reduce((sum, slot) => sum + slot.damageBlocked, 0);
  for (let i = slotDisclosures.length - 1; i >= 0 && residual !== 0; i--) {
    const slot = slotDisclosures[i]!;
    if (slot.damageReductionPct <= 0 && slot.damageBlocked <= 0) continue;
    const correction = residual > 0 ? residual : Math.max(residual, -slot.damageBlocked);
    slot.damageBlocked += correction;
    residual -= correction;
  }
  const acceptedDamage = moduleIds.reduce((sum, id) => sum + Math.min(finalDamage[id] ?? 0, context.moduleHps[id] ?? 0), 0);
  const healOut: Record<string, number> = {};
  let repairBonusHp = 0;
  for (const item of items) {
    const disclosure = slotDisclosures.find(value => value.contaminantId === item.id)!;
    if (item.type === 'siphon' && acceptedDamage > 0) {
      repairBonusHp = Math.max(repairBonusHp, CONTAMINANT_DATA.siphon.defenseRepairBonusHp);
      disclosure.repairBonusHp = CONTAMINANT_DATA.siphon.defenseRepairBonusHp;
    }
    if (item.type !== 'combust' || moduleIds.length === 0) continue;
    const heal = Math.floor(acceptedDamage * CONTAMINANT_DATA.combust.defenseHealRatio);
    if (heal <= 0) continue;
    const after = (id: string): number => Math.max(0, (context.moduleHps[id] ?? 0) - (finalDamage[id] ?? 0)) + (healOut[id] ?? 0);
    const lowest = moduleIds.reduce((a, b) => after(b) < after(a) ? b : a);
    const actualHeal = Math.min(heal, Math.max(0, (context.moduleMaxHps[lowest] ?? 0) - after(lowest)));
    healOut[lowest] = (healOut[lowest] ?? 0) + actualHeal;
    disclosure.healAmount = actualHeal;
    disclosure.healModuleId = lowest;
  }
  return { finalDamagePerModule: finalDamage, sideEffects: [], kindlingGain: 0,
    stabilityChange: 0, scatterRedistributed, stitchEqualization: {},
    forecastCorrect: context.forecastTargetId === context.actualPrimaryId,
    upgradeDiscount: 0, healOut, bonusCharges: {}, toolUseGrants: 0,
    moduleSwapTriggered: false, slotDisclosures, repairBonusHp };
}

export function resetDefenseEngine(): void { legacyRuntime = {}; }
export function getDefenseRuntimeState(): Record<string, ContaminantRuntimeState> {
  return Object.fromEntries(Object.entries(legacyRuntime).map(([id, value]) => [id, { ...value }]));
}
export function loadDefenseRuntimeState(state: Record<string, ContaminantRuntimeState> | undefined): void {
  legacyRuntime = state ? Object.fromEntries(Object.entries(state).map(([id, value]) => [id, { ...value }])) : {};
}
