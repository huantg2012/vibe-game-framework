import { inventoryStore } from '@/systems/inventory-store';
import { showToastInline } from '@/ui/dom/panel-styles';
/**
 * Shared new-game / load-game bootstrap.
 *
 * Main menu and the in-game Esc record menu both need the same reset/load
 * sequence. Kept here so neither scene reimplements the list of systems that
 * must be cleared (defense-engine runtime state was missed once already).
 */

import Phaser from 'phaser';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { resetDefenseEngine } from '@/systems/defense-engine';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';

export type ExpeditionEntryMode = 'new' | 'continue';

/** Optional title-screen presentation; in-game callers retain immediate entry. */
export type ExpeditionEntry = (mode: ExpeditionEntryMode) => void;

function enterPurification(host: Phaser.Scene, mode: ExpeditionEntryMode, enter?: ExpeditionEntry): void {
  if (enter) enter(mode);
  else host.scene.start('PurificationScene', { fromMenu: true });
}

export function hasReadableSave(): boolean {
  return saveManager.peekRecordSummary() !== null;
}

/** Wipe runtime + save, then enter the purification point as a new record. */
export function beginNewExpedition(host: Phaser.Scene, enter?: ExpeditionEntry): void {
  saveManager.deleteSave();
  gameState.reset();
  tideSystem.reset();
  contaminantSystem.reset();
  growthSystem.reset();
  stabilityTracker.reset();
  resetDefenseEngine();
  impactSystem.resetForecastState();
  enterPurification(host, 'new', enter);
}

/** Preserve unreadable or unsupported records until the player explicitly replaces them. */
export function loadExpedition(host: Phaser.Scene, enter?: ExpeditionEntry): void {
  if (saveManager.hasPendingSave()) {
    showToastInline('结算尚未保存，请先回到当前场景重试保存。', {});
    return;
  }
  const loaded = saveManager.load();
  if (loaded && inventoryStore.getRun()?.status === 'active') {
    showToastInline('上次出击尚未结束。物品记录已保留，暂不能载入。', {});
    return;
  }
  if (loaded) {
    enterPurification(host, 'continue', enter);
  } else if (!saveManager.hasSave()) {
    beginNewExpedition(host, enter);
  } else {
    showToastInline('这份记录暂时无法读取，原记录已保留。', {});
  }
}
