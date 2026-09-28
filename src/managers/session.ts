import { installProceduralRiftRecovery } from './rift-recovery';
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

/** Reset only after storage is accessible and replacement is explicit; old bytes survive until the new save. */
export function beginNewExpedition(host: Phaser.Scene, enter?: ExpeditionEntry, confirmedReplacement = false): boolean {
  if (!saveManager.prepareNewRecord(confirmedReplacement)) return false;
  gameState.reset();
  tideSystem.reset();
  contaminantSystem.reset();
  growthSystem.reset();
  stabilityTracker.reset();
  resetDefenseEngine();
  impactSystem.resetForecastState();
  enterPurification(host, 'new', enter);
  return true;
}

/** Preserve unreadable or unsupported records until the player explicitly replaces them. */
export function loadExpedition(host: Phaser.Scene, enter?: ExpeditionEntry, onInterrupted?: () => void): void {
  if (saveManager.hasPendingSave()) {
    showToastInline('结算尚未保存，请先回到当前场景重试保存。', {});
    return;
  }
  installProceduralRiftRecovery();
  const loaded = saveManager.load();
  if (loaded && inventoryStore.getRun()?.status === 'active') {
    const checkpoint = saveManager.peekRiftCheckpoint();
    const departure = saveManager.peekRiftDeparture();
    const identity = checkpoint?.identity ?? departure?.identity;
    if (identity?.worldId === 'procedural-rift') {
      const conditions = checkpoint ? (checkpoint.state as import('@/systems/rift-recovery-state').RiftRecoveryState).conditions : departure!.conditions;
      host.scene.start('RiftScene', { ...conditions, recovery: { identity, externalTargetIds: [], checkpoint } });
    } else if (onInterrupted) onInterrupted();
    else showToastInline('旧记录缺少出行状态。请在标题页选择放弃本趟，基地与收存保留。', {});
    return;
  }
  if (loaded) {
    enterPurification(host, 'continue', enter);
  } else if (saveManager.canAbandonInterruptedRun() && onInterrupted) {
    onInterrupted();
  } else if (!saveManager.hasSave()) {
    if (!beginNewExpedition(host, enter)) {
      showToastInline('无法安全创建新记录。请检查浏览器存储后重试；当前进度未重置。', {});
    }
  } else {
    showToastInline('这份记录暂时无法读取，原记录已保留。', {});
  }
}

/** Legacy active ledgers have no reconstructible world. Explicit consent is required. */
export function abandonInterruptedExpedition(host: Phaser.Scene, enter?: ExpeditionEntry): void {
  if (!saveManager.canAbandonInterruptedRun() || !saveManager.load('abandon-active')) return;
  const run = inventoryStore.getRun();
  if (!run || run.status !== 'active') return;
  const result = inventoryStore.settleRun(run.id, 'abandon', 0);
  if (!result.ok) { showToastInline('放弃结果尚未保存，请重试；原记录保留。', {}); return; }
  enterPurification(host, 'continue', enter);
}
