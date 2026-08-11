/**
 * ContaminantSystem — manages contaminant inventory and lifecycle.
 *
 * Lifecycle: acquire (defense stage) -> slot in defense -> absorb impacts ->
 *            transform to tool -> slot in sortie loadout -> use -> break.
 *
 * Module-level singleton (DEC-ARCH-002).
 * Spec: docs/specs/system-growth-tide.md, section CN (rules CN8-CN15).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import type { ContaminantRuntimeState } from '@/systems/defense-engine';
import { GameEvent } from '@/types/events';
import type { Contaminant, ContaminantRarity, ContaminantType } from '@/types/game-types';

const CN = GAME_CONSTANTS.CONTAMINANT;
const TIDE = GAME_CONSTANTS.TIDE;
const P = GAME_CONSTANTS.PURIFICATION;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContaminantTransformResult {
  contaminantId: string;
  type: ContaminantType;
  slotIndex: number;
}

interface ContaminantSystemState {
  contaminants: Contaminant[];
  defenseSlots: (string | null)[];
  sortieLoadout: (string | null)[];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let contaminants: Contaminant[] = [];
// Both arrays are always allocated at MAX capacity (Slice 5 T5: growth_defense_slot /
// growth_sortie_slot unlock a 4th slot). Which slots are actually usable is gated by
// computeDefenseSlotCount()/computeSortieSlotCount() below, not by array length — this
// way a slot purchased mid-run "just appears" without any migration of existing state.
let defenseSlots: (string | null)[] = new Array(CN.MAX_DEFENSE_SLOTS).fill(null);
let sortieLoadout: (string | null)[] = new Array(CN.MAX_SORTIE_SLOTS).fill(null);

/**
 * echo (Slice 5 T3, DEC-033/D3): how many times each tool-stage contaminant has
 * received an echo bonus use. Key = contaminant id, capped by CN.ECHO_MAX_TOOL_USE_BONUS.
 * Persisted via getEchoBonusState()/loadEchoBonusState() (unified with defense-engine's
 * runtime state in SaveManager).
 */
const echoBonusGranted: Map<string, number> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findById(id: string): Contaminant | undefined {
  return contaminants.find((c) => c.id === id);
}

/**
 * resonate (Slice 5 gap-fill, DEC-039): recomputes GameState's module-effect-cap bonus
 * flag from the current defense loadout. Called after every mutation of `defenseSlots`
 * (slot/unslot/transform-out/reset/load) so `GameState.getModuleEffect()` always reflects
 * "is currently equipped", not a stale snapshot. A defense-slotted resonate that has just
 * transformed to a tool no longer counts - the CSV's "装备期间" is present tense.
 */
function syncResonateBonus(): void {
  const active = defenseSlots.some((id) => {
    if (!id) return false;
    const c = findById(id);
    return c !== undefined && c.type === 'resonate' && c.stage === 'defense';
  });
  gameState.setResonateBonusActive(active);
}

/**
 * siphon (Slice 5 gap-fill): recomputes GameState's repair-efficiency multiplier from the
 * current defense loadout - identical "装备期间" derivation pattern to syncResonateBonus()
 * above, called from the same mutation points. Previously this was a per-impact one-shot
 * set by ImpactSystem from DefenseEngine's output, which never reset back to 1.0 when
 * siphon left the defense slot (only another impact happening to compute exactly 1.0 could
 * have corrected it, and the code never even did that). This is the fix: the multiplier
 * now always reflects "is siphon defense-slotted right now", not "what did the last impact
 * compute".
 */
function syncRepairEfficiencyMult(): void {
  const active = defenseSlots.some((id) => {
    if (!id) return false;
    const c = findById(id);
    return c !== undefined && c.type === 'siphon' && c.stage === 'defense';
  });
  gameState.setRepairEfficiencyMult(active ? P.SIPHON_REPAIR_EFFICIENCY_MULT : 1.0);
}

/** Effective defense slot count: base + growth_defense_slot bonus (0 or 1). */
function computeDefenseSlotCount(): number {
  return CN.DEFENSE_SLOTS + growthSystem.getDefenseSlotBonus();
}

/**
 * Effective sortie loadout slot count: base + growth_sortie_slot bonus (0 or 1).
 * Exactly one of these slots is always the passive slot (the last index) — the rest
 * are active. See getSortieActiveSlotCount()/getSortiePassiveSlotIndex().
 */
function computeSortieSlotCount(): number {
  return CN.SORTIE_SLOTS + growthSystem.getSortieSlotBonus();
}

/** Pad/truncate a loaded slot array to exactly `size` entries (backward-compat for saves). */
function normalizeSlotArray(saved: (string | null)[] | undefined, size: number): (string | null)[] {
  const out = (saved ?? []).slice(0, size);
  while (out.length < size) out.push(null);
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const contaminantSystem = {
  getAll(): readonly Contaminant[] {
    return contaminants;
  },

  /** Effective number of defense slots (base 3 + growth_defense_slot bonus). */
  getDefenseSlotCount(): number {
    return computeDefenseSlotCount();
  },

  /** Effective number of sortie loadout slots (base 3 + growth_sortie_slot bonus). */
  getSortieSlotCount(): number {
    return computeSortieSlotCount();
  },

  /** Number of ACTIVE sortie slots — exactly one slot (the last) is always passive. */
  getSortieActiveSlotCount(): number {
    return computeSortieSlotCount() - 1;
  },

  /** Index of the passive sortie slot — always the last unlocked slot. */
  getSortiePassiveSlotIndex(): number {
    return computeSortieSlotCount() - 1;
  },

  getDefenseSlotted(): (Contaminant | null)[] {
    return defenseSlots.slice(0, computeDefenseSlotCount()).map((id) => (id ? findById(id) ?? null : null));
  },

  getSortieLoadout(): (Contaminant | null)[] {
    return sortieLoadout.slice(0, computeSortieSlotCount()).map((id) => (id ? findById(id) ?? null : null));
  },

  /**
   * Acquire a new contaminant (e.g. from a rift node pickup).
   * Starts in 'defense' stage with 0 impact charges.
   */
  acquire(type: ContaminantType, rarity: ContaminantRarity): Contaminant {
    const uses = CN.USES[rarity];
    const contaminant: Contaminant = {
      id: `CTM_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      rarity,
      stage: 'defense',
      impactCharges: 0,
      usesRemaining: uses,
    };
    contaminants.push(contaminant);
    eventBus.emit(GameEvent.CONTAMINANT_ACQUIRED, { contaminant });
    return contaminant;
  },

  /**
   * Slot a defense-stage contaminant into a defense slot at the purification point.
   * Returns false if the slot is occupied or contaminant is not in defense stage.
   */
  slotDefense(contaminantId: string, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= computeDefenseSlotCount()) return false;
    if (defenseSlots[slotIndex] !== null) return false;

    const c = findById(contaminantId);
    if (!c || c.stage !== 'defense') return false;

    // Ensure it's not already slotted elsewhere
    if (defenseSlots.includes(contaminantId)) return false;

    defenseSlots[slotIndex] = contaminantId;
    syncResonateBonus();
    syncRepairEfficiencyMult();
    return true;
  },

  /** Remove a contaminant from a defense slot (back to inventory). */
  unslotDefense(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= computeDefenseSlotCount()) return;
    defenseSlots[slotIndex] = null;
    syncResonateBonus();
    syncRepairEfficiencyMult();
  },

  /**
   * Slot a tool-stage contaminant into a sortie loadout slot.
   * Returns false if the slot is occupied or contaminant is not in tool stage.
   */
  slotSortie(contaminantId: string, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= computeSortieSlotCount()) return false;
    if (sortieLoadout[slotIndex] !== null) return false;

    const c = findById(contaminantId);
    if (!c || c.stage !== 'tool') return false;

    // Ensure it's not already slotted elsewhere
    if (sortieLoadout.includes(contaminantId)) return false;

    sortieLoadout[slotIndex] = contaminantId;
    return true;
  },

  /** Remove a contaminant from a sortie loadout slot. */
  unslotSortie(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= computeSortieSlotCount()) return;
    sortieLoadout[slotIndex] = null;
  },

  /**
   * Apply impact charges to all defense-slotted contaminants.
   * Called during each impact cycle. High tide (Crest) applies CREST_CHARGE_COST (3),
   * otherwise NORMAL_CHARGE_COST (1).
   *
   * Returns list of contaminants that transformed (defense -> tool).
   */
  applyImpactCharge(isHighTide: boolean): ContaminantTransformResult[] {
    const chargeCost = isHighTide ? TIDE.CREST_CHARGE_COST : TIDE.NORMAL_CHARGE_COST;
    const results: ContaminantTransformResult[] = [];

    for (let i = 0; i < defenseSlots.length; i++) {
      const id = defenseSlots[i];
      if (!id) continue;

      const c = findById(id);
      if (!c) {
        // Orphaned reference — clear it
        defenseSlots[i] = null;
        continue;
      }

      // Apply charge multiplier from contaminant data (e.g. kindle = 2.0)
      const chargeMult = CONTAMINANT_DATA[c.type]?.defenseChargeMult ?? 1;
      c.impactCharges += chargeCost * chargeMult;

      if (c.impactCharges >= TIDE.TRANSFORM_THRESHOLD) {
        // Transform: defense -> tool; reset uses to per-type value from CSV data
        c.stage = 'tool';
        c.usesRemaining = CONTAMINANT_DATA[c.type]?.toolUses ?? CN.USES[c.rarity];
        defenseSlots[i] = null;
        results.push({ contaminantId: c.id, type: c.type, slotIndex: i });
        eventBus.emit(GameEvent.CONTAMINANT_TRANSFORMED, { contaminantId: c.id });
      }
    }

    syncResonateBonus();
    syncRepairEfficiencyMult();
    return results;
  },

  /**
   * Use a tool-stage contaminant during a sortie.
   * Decrements usesRemaining. Returns true if the tool broke (usesRemaining hit 0).
   */
  useTool(contaminantId: string): boolean {
    const c = findById(contaminantId);
    if (!c || c.stage !== 'tool') return false;

    c.usesRemaining--;

    eventBus.emit(GameEvent.TOOL_USED, {
      contaminantId: c.id,
      toolType: c.type,
      usesLeft: c.usesRemaining,
    });

    if (c.usesRemaining <= 0) {
      c.stage = 'broken';
      // Remove from sortie loadout if slotted
      const slotIdx = sortieLoadout.indexOf(contaminantId);
      if (slotIdx !== -1) sortieLoadout[slotIdx] = null;
      // Remove from inventory
      contaminants = contaminants.filter((x) => x.id !== contaminantId);
      eventBus.emit(GameEvent.CONTAMINANT_BROKEN, { contaminantId: c.id });
      return true;
    }

    return false;
  },

  /**
   * Apply cross-slot impact-charge bonuses computed by defense-engine (resonate/erode,
   * DEC-033). Bonus charges are flat +N (not multiplied by defenseChargeMult) — that
   * multiplier only applies to the normal per-cycle charge in applyImpactCharge().
   * Returns transform results for any contaminant that crossed the transform threshold.
   */
  applyBonusCharges(bonus: Record<string, number>): ContaminantTransformResult[] {
    const results: ContaminantTransformResult[] = [];

    for (const [id, amount] of Object.entries(bonus)) {
      if (amount <= 0) continue;
      const c = findById(id);
      if (!c || c.stage !== 'defense') continue;

      c.impactCharges += amount;

      if (c.impactCharges >= TIDE.TRANSFORM_THRESHOLD) {
        c.stage = 'tool';
        c.usesRemaining = CONTAMINANT_DATA[c.type]?.toolUses ?? CN.USES[c.rarity];
        const slotIdx = defenseSlots.indexOf(id);
        if (slotIdx !== -1) defenseSlots[slotIdx] = null;
        results.push({ contaminantId: c.id, type: c.type, slotIndex: slotIdx });
        eventBus.emit(GameEvent.CONTAMINANT_TRANSFORMED, { contaminantId: c.id });
      }
    }

    syncResonateBonus();
    syncRepairEfficiencyMult();
    return results;
  },

  /**
   * echo (Slice 5 T3): grant +1 usesRemaining to a random tool-stage contaminant,
   * respecting the per-tool cap (CN.ECHO_MAX_TOOL_USE_BONUS). Silently no-ops (returns
   * false) if the tool library is empty or every tool is already at the cap.
   */
  grantRandomToolUse(): boolean {
    const cap = CN.ECHO_MAX_TOOL_USE_BONUS;
    const candidates = contaminants.filter(
      (c) => c.stage === 'tool' && (echoBonusGranted.get(c.id) ?? 0) < cap,
    );
    if (candidates.length === 0) return false;

    const target = candidates[Math.floor(Math.random() * candidates.length)]!;
    target.usesRemaining++;
    echoBonusGranted.set(target.id, (echoBonusGranted.get(target.id) ?? 0) + 1);
    return true;
  },

  /** Runtime state snapshot for SaveManager (D3): echo's per-tool bonus-grant counter. */
  getEchoBonusState(): Record<string, ContaminantRuntimeState> {
    const out: Record<string, ContaminantRuntimeState> = {};
    for (const [id, count] of echoBonusGranted) {
      out[id] = { echoBonusGranted: count };
    }
    return out;
  },

  /** Restore echo's per-tool bonus-grant counter from a save file (D3). */
  loadEchoBonusState(state: Record<string, ContaminantRuntimeState> | undefined): void {
    echoBonusGranted.clear();
    if (!state) return;
    for (const [id, s] of Object.entries(state)) {
      if (typeof s.echoBonusGranted === 'number') echoBonusGranted.set(id, s.echoBonusGranted);
    }
  },

  /** Reset to empty state (new game). */
  reset(): void {
    contaminants = [];
    defenseSlots = new Array(CN.MAX_DEFENSE_SLOTS).fill(null);
    sortieLoadout = new Array(CN.MAX_SORTIE_SLOTS).fill(null);
    echoBonusGranted.clear();
    syncResonateBonus();
    syncRepairEfficiencyMult();
  },

  /** Serialize current state for saving. */
  getState(): ContaminantSystemState {
    return {
      contaminants: contaminants.map((c) => ({ ...c })),
      defenseSlots: [...defenseSlots],
      sortieLoadout: [...sortieLoadout],
    };
  },

  /**
   * Restore state from save data. Normalizes slot arrays to MAX capacity length —
   * pre-Slice-5 saves have length-3 arrays; padding with null here means the newly
   * unlocked 4th slot always starts empty rather than throwing on old saves.
   */
  loadState(saved: ContaminantSystemState): void {
    contaminants = saved.contaminants.map((c) => ({ ...c }));
    defenseSlots = normalizeSlotArray(saved.defenseSlots, CN.MAX_DEFENSE_SLOTS);
    sortieLoadout = normalizeSlotArray(saved.sortieLoadout, CN.MAX_SORTIE_SLOTS);
    syncResonateBonus();
    syncRepairEfficiencyMult();
  },
};
