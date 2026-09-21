/** Durable base purchases. The UI sees success only after the complete record is saved. */
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { growthSystem } from '@/systems/growth-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { inventoryStore } from '@/systems/inventory-store';
import { GameEvent } from '@/types/events';
import type { GrowthUpgradeId } from '@/types/game-types';

export type GrowthPurchaseResult =
  | { readonly ok: true; readonly spent: number; readonly newLevel: number }
  | { readonly ok: false; readonly reason: 'unavailable' | 'pending-save' | 'storage-failed' };

export function purchaseGrowth(id: GrowthUpgradeId | 'thicken'): GrowthPurchaseResult {
  if (saveManager.hasPendingSave() || inventoryStore.hasFrameTransaction()) return { ok: false, reason: 'pending-save' };
  const run = inventoryStore.getRun();
  if (run?.status === 'active') return { ok: false, reason: 'unavailable' };
  if (run?.status === 'settled' && !run.baseSettled) return { ok: false, reason: 'pending-save' };
  const nextStep = growthSystem.getNextStep();
  if (!nextStep || nextStep.id !== id || !nextStep.unlocked) return { ok: false, reason: 'unavailable' };
  const beforeGame = gameState.getState();
  const beforeGrowth = growthSystem.getState();
  const beforeStability = stabilityTracker.getState();
  const previousSlotCount = GAME_CONSTANTS.CONTAMINANT.SORTIE_SLOTS + growthSystem.getSortieSlotBonus();
  const cost = id === 'thicken' ? gameState.getNextModuleMaxHpCost() : growthSystem.getCost(id);
  const spent = id === 'thicken' ? (gameState.raiseModuleMaxHp() ? cost ?? 0 : 0) : growthSystem.purchase(id, false);
  if (spent <= 0) return { ok: false, reason: 'unavailable' };
  if (id !== 'thicken') stabilityTracker.addProgress('growth', GAME_CONSTANTS.STABILITY.GAIN_GROWTH, false);
  const expandsSlots = id === 'growth_sortie_slot';
  let slotsCompatible = true;
  if (expandsSlots) {
    inventoryStore.beginFrameTransaction();
    slotsCompatible = inventoryStore.reconcileExpandedToolSlots(previousSlotCount).ok;
  }
  const saved = slotsCompatible && (expandsSlots ? saveManager.trySaveBaseInventoryFrame() : saveManager.trySave());
  if (!saved) {
    // trySave restores its forecast snapshot itself. No success event has escaped.
    gameState.loadState(beforeGame);
    growthSystem.loadState(beforeGrowth);
    stabilityTracker.loadState(beforeStability);
    if (expandsSlots) inventoryStore.cancelFrameTransaction();
    return { ok: false, reason: slotsCompatible ? 'storage-failed' : 'unavailable' };
  }
  const newLevel = id === 'thicken' ? gameState.getModuleMaxHpTier() : growthSystem.getLevel(id);
  eventBus.emit(GameEvent.GROWTH_PURCHASED, { upgradeId: id, newLevel });
  const progress = stabilityTracker.getProgress();
  if (progress !== beforeStability.progress) eventBus.emit(GameEvent.STABILITY_CHANGED,
    { progress, delta: progress - beforeStability.progress });
  return { ok: true, spent, newLevel };
}
