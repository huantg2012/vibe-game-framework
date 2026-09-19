import { getContaminantSlot } from './contaminant-catalog';
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
import { WEAPON_DATA } from '@/generated/weapon-data';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { inventoryStore } from '@/systems/inventory-store';
import { isContaminantQuality, supportsContaminantQuality } from '@/systems/contaminant-quality';
import type { ContaminantRuntimeState } from '@/systems/defense-engine';
import { GameEvent } from '@/types/events';
import type { Contaminant, ContaminantQuality, ContaminantRarity, ContaminantType } from '@/types/game-types';

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

// InventoryStore owns every payload and every slot reference.
function slots() { return inventoryStore.getLegacySlots(); }
inventoryStore.configure({
  weaponDefinition: id => WEAPON_DATA[id],
  starterDefinitionId: 'crowbar_plain',
  isPassiveTool: c => getContaminantSlot(c) === 'passive',
  toolSlotCount: computeSortieSlotCount,
  defenseSlotCount: computeDefenseSlotCount,
});

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
  return inventoryStore.getContaminants().find((c) => c.id === id);
}

/**
 * resonate (Slice 5 gap-fill, DEC-039): recomputes GameState's module-effect-cap bonus
 * flag from the current defense loadout. Called after every mutation of `defenseSlots`
 * (slot/unslot/transform-out/reset/load) so `GameState.getModuleEffect()` always reflects
 * "is currently equipped", not a stale snapshot. A defense-slotted resonate that has just
 * transformed to a tool no longer counts - the CSV's "装备期间" is present tense.
 */
function syncResonateBonus(): void {
  const active = slots().defenseSlots.some((id) => {
    if (!id) return false;
    const c = findById(id);
    return c !== undefined && c.type === 'resonate' && c.stage === 'defense';
  });
  gameState.setResonateBonusActive(active);
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
  syncInventoryDerivedState(): void {
    const live = new Set(inventoryStore.getContaminants().map(c => c.id));
    for (const id of echoBonusGranted.keys()) if (!live.has(id)) echoBonusGranted.delete(id);
    syncResonateBonus();
  },
  getAll(): readonly Contaminant[] {
    return inventoryStore.getItems().flatMap(item => item.kind === 'contaminant' && item.location.kind !== 'ground' ? [item.contaminant] : []);
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
    return normalizeSlotArray(slots().defenseSlots, computeDefenseSlotCount()).map((id) => (id ? findById(id) ?? null : null));
  },

  getSortieLoadout(): (Contaminant | null)[] {
    return normalizeSlotArray(slots().sortieLoadout, computeSortieSlotCount()).map((id) => (id ? findById(id) ?? null : null));
  },

  /**
   * Acquire a new contaminant (e.g. from a rift node pickup).
   * Starts in 'defense' stage with 0 impact charges.
   */
  /** Factory only: field reveal must decide ownership and burden before acquiring. */
  createUnowned(type: ContaminantType, rarity: ContaminantRarity, quality?: ContaminantQuality): Contaminant {
    if(type==='catalog')throw new Error('Catalog identities must be created from a fixed drop plan');
    const supportsQuality = supportsContaminantQuality(type);
    if (quality !== undefined && (!isContaminantQuality(quality) || !supportsQuality)) {
      throw new Error(`Unsupported contaminant quality for ${type}`);
    }
    return {
      id: `CTM_${crypto.randomUUID()}`,
      type, rarity, stage: 'defense', impactCharges: 0, usesRemaining: 0,
      ...(supportsQuality ? { quality: quality ?? 'ordinary' } : {}),
    };
  },

  acquire(type: ContaminantType, rarity: ContaminantRarity, quality?: ContaminantQuality): Contaminant {
    const contaminant = this.createUnowned(type, rarity, quality);
    const added = inventoryStore.addContaminant(contaminant);
    if (!added.ok) throw new Error(`Contaminant acquisition failed: ${added.error}`);
    const owned = findById(contaminant.id)!;
    eventBus.emit(GameEvent.CONTAMINANT_ACQUIRED, { contaminant: owned });
    return owned;
  },

  /**
   * Slot a defense-stage contaminant into a defense slot at the purification point.
   * Returns false if the slot is occupied or contaminant is not in defense stage.
   */
  slotDefense(contaminantId: string, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= computeDefenseSlotCount()) return false;
    if (slots().defenseSlots[slotIndex] != null) return false;

    const c = findById(contaminantId);
    if (!c || c.stage !== 'defense') return false;

    // Ensure it's not already slotted elsewhere
    if (slots().defenseSlots.includes(contaminantId)) return false;

    if (!inventoryStore.slotDefense(contaminantId, slotIndex).ok) return false;
    syncResonateBonus();
    return true;
  },

  /** Remove a contaminant from a defense slot (back to inventory). */
  unslotDefense(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= computeDefenseSlotCount()) return;
    if (!inventoryStore.slotDefense(null, slotIndex).ok) return;
    syncResonateBonus();
  },

  /**
   * Slot a tool-stage contaminant into a sortie loadout slot.
   * Returns false if the slot is occupied or contaminant is not in tool stage.
   */
  slotSortie(contaminantId: string, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= computeSortieSlotCount()) return false;
    if (slots().sortieLoadout[slotIndex] != null) return false;

    const c = findById(contaminantId);
    if (!c || c.stage !== 'tool') return false;

    // Ensure it's not already slotted elsewhere
    if (slots().sortieLoadout.includes(contaminantId)) return false;

    if (!inventoryStore.prepareTool(contaminantId, slotIndex).ok) return false;
    return true;
  },

  /** Remove a contaminant from a sortie loadout slot. */
  unslotSortie(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= computeSortieSlotCount()) return;
    inventoryStore.prepareTool(null, slotIndex);
  },

  /**
   * Apply impact charges to all defense-slotted contaminants.
   * Called during each impact cycle. High tide (Crest) applies CREST_CHARGE_COST (3),
   * otherwise NORMAL_CHARGE_COST (1).
   *
   * Returns list of contaminants that transformed (defense -> tool).
   */
  /** Finalize only after the same slot snapshot has defended the actual impact. */
  finishOfferingImpact(isHighTide: boolean, bonusCharges: Readonly<Record<string, number>> = {},
    snapshotIds: readonly (string | null)[] = [...slots().defenseSlots], impactId?: string) {
    const result = inventoryStore.finishOfferingImpact(snapshotIds,
      isHighTide ? TIDE.CREST_CHARGE_COST : TIDE.NORMAL_CHARGE_COST, bonusCharges, impactId);
    if (result.ok) {
      syncResonateBonus();
      for (const item of result.value) if (item.kind === 'contaminant') {
        eventBus.emit(GameEvent.CONTAMINANT_TRANSFORMED, { contaminantId: item.itemId });
      }
    }
    return result;
  },

  applyImpactCharge(isHighTide: boolean): ContaminantTransformResult[] {
    const result = this.finishOfferingImpact(isHighTide);
    return result.ok ? result.value.flatMap(item => item.kind === 'contaminant'
      ? [{ contaminantId: item.itemId, type: findById(item.itemId)?.type ?? item.definitionId as ContaminantType, slotIndex: item.slotIndex }] : []) : [];
  },

  /**
   * Use a tool-stage contaminant during a sortie.
   * Decrements usesRemaining. Returns true if the tool broke (usesRemaining hit 0).
   */
  useTool(contaminantId: string): boolean {
    const result = this.tryConsumeTool(contaminantId);
    return result.ok && result.value.broken;
  },

  /** Fallible consume entry point: callers must persist consumption before releasing effects. */
  tryConsumeTool(contaminantId: string, actionId?: string) {
    const c = findById(contaminantId);
    const result = inventoryStore.consumeTool(contaminantId, actionId);
    if (!result.ok || !c) return result;
    c.usesRemaining = result.value.usesLeft;
    if (result.value.broken) c.stage = 'broken';
    eventBus.emit(GameEvent.TOOL_USED, {
      contaminantId: c.id, toolType: c.type, usesLeft: result.value.usesLeft,
    });
    if (result.value.broken) {
      echoBonusGranted.delete(c.id);
      eventBus.emit(GameEvent.CONTAMINANT_BROKEN, { contaminantId: c.id });
    }
    return result;
  },

  /**
   * Apply cross-slot impact-charge bonuses computed by defense-engine (resonate/erode,
   * DEC-033). Bonus charges are flat +N (not multiplied by defenseChargeMult) — that
   * multiplier only applies to the normal per-cycle charge in applyImpactCharge().
   * Returns transform results for any contaminant that crossed the transform threshold.
   */
  applyBonusCharges(bonus: Record<string, number>): ContaminantTransformResult[] {
    const result = inventoryStore.finishOfferingImpact([...slots().defenseSlots], 0, bonus);
    if (!result.ok) return [];
    syncResonateBonus();
    return result.value.flatMap(item => {
      if (item.kind !== 'contaminant') return [];
      eventBus.emit(GameEvent.CONTAMINANT_TRANSFORMED, { contaminantId: item.itemId });
      return [{ contaminantId: item.itemId, type: findById(item.itemId)?.type ?? item.definitionId as ContaminantType, slotIndex: item.slotIndex }];
    });
  },

  /**
   * echo (Slice 5 T3): grant +1 usesRemaining to a random tool-stage contaminant,
   * respecting the per-tool cap (CN.ECHO_MAX_TOOL_USE_BONUS). Silently no-ops (returns
   * false) if the tool library is empty or every tool is already at the cap.
   */
  grantRandomToolUse(random: () => number = Math.random): boolean {
    const cap = CN.ECHO_MAX_TOOL_USE_BONUS;
    const candidates = inventoryStore.getContaminants().filter(
      (c) => c.stage === 'tool' && (echoBonusGranted.get(c.id) ?? 0) < cap,
    );
    if (candidates.length === 0) return false;

    const target = candidates[Math.floor(random() * candidates.length)]!;
    target.usesRemaining++;
    echoBonusGranted.set(target.id, (echoBonusGranted.get(target.id) ?? 0) + 1);
    return true;
  },

  /** Runtime state snapshot for SaveManager (D3): echo's per-tool bonus-grant counter. */
  getEchoBonusState(): Record<string, ContaminantRuntimeState> {
    const out: Record<string, ContaminantRuntimeState> = {};
    for (const [id, count] of echoBonusGranted) {
      if (!findById(id)) continue;
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
    inventoryStore.reset();
    inventoryStore.ensureStarter();
    echoBonusGranted.clear();
    syncResonateBonus();
  },

  /** Serialize current state for saving. */
  getState(): ContaminantSystemState {
    return {
      contaminants: inventoryStore.getContaminants().map((c) => ({ ...c })),
      defenseSlots: [...slots().defenseSlots],
      sortieLoadout: [...slots().sortieLoadout],
    };
  },

  /**
   * Restore state from save data. Normalizes slot arrays to MAX capacity length —
   * pre-Slice-5 saves have length-3 arrays; padding with null here means the newly
   * unlocked 4th slot always starts empty rather than throwing on old saves.
   */
  loadState(saved: ContaminantSystemState): void {
    inventoryStore.importLegacy(saved.contaminants, normalizeSlotArray(saved.defenseSlots, CN.MAX_DEFENSE_SLOTS), normalizeSlotArray(saved.sortieLoadout, CN.MAX_SORTIE_SLOTS));
    syncResonateBonus();
  },
};
