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
import { GameEvent } from '@/types/events';
import type { Contaminant, ContaminantRarity, ContaminantType } from '@/types/game-types';

const CN = GAME_CONSTANTS.CONTAMINANT;
const TIDE = GAME_CONSTANTS.TIDE;

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
let defenseSlots: (string | null)[] = [null, null, null];
let sortieLoadout: (string | null)[] = [null, null, null];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findById(id: string): Contaminant | undefined {
  return contaminants.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const contaminantSystem = {
  getAll(): readonly Contaminant[] {
    return contaminants;
  },

  getDefenseSlotted(): (Contaminant | null)[] {
    return defenseSlots.map((id) => (id ? findById(id) ?? null : null));
  },

  getSortieLoadout(): (Contaminant | null)[] {
    return sortieLoadout.map((id) => (id ? findById(id) ?? null : null));
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
    if (slotIndex < 0 || slotIndex >= CN.DEFENSE_SLOTS) return false;
    if (defenseSlots[slotIndex] !== null) return false;

    const c = findById(contaminantId);
    if (!c || c.stage !== 'defense') return false;

    // Ensure it's not already slotted elsewhere
    if (defenseSlots.includes(contaminantId)) return false;

    defenseSlots[slotIndex] = contaminantId;
    return true;
  },

  /** Remove a contaminant from a defense slot (back to inventory). */
  unslotDefense(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= CN.DEFENSE_SLOTS) return;
    defenseSlots[slotIndex] = null;
  },

  /**
   * Slot a tool-stage contaminant into a sortie loadout slot.
   * Returns false if the slot is occupied or contaminant is not in tool stage.
   */
  slotSortie(contaminantId: string, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= CN.SORTIE_SLOTS) return false;
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
    if (slotIndex < 0 || slotIndex >= CN.SORTIE_SLOTS) return;
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

  /** Reset to empty state (new game). */
  reset(): void {
    contaminants = [];
    defenseSlots = [null, null, null];
    sortieLoadout = [null, null, null];
  },

  /** Serialize current state for saving. */
  getState(): ContaminantSystemState {
    return {
      contaminants: contaminants.map((c) => ({ ...c })),
      defenseSlots: [...defenseSlots],
      sortieLoadout: [...sortieLoadout],
    };
  },

  /** Restore state from save data. */
  loadState(saved: ContaminantSystemState): void {
    contaminants = saved.contaminants.map((c) => ({ ...c }));
    defenseSlots = [...saved.defenseSlots];
    sortieLoadout = [...saved.sortieLoadout];
  },
};
