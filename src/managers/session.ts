import { installProceduralRiftRecovery, prepareProceduralRecovery, withPreparedProceduralRecovery } from './rift-recovery';
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

export type ExpeditionLoadResult = 'entered' | 'interrupted' | 'failed' | 'cancelled' | 'busy';
export interface ExpeditionLoadOptions {
  signal?: AbortSignal;
  onError?: (message: string) => void;
}
let activeLoad: AbortController | null = null;

function enterPurification(host: Phaser.Scene, mode: ExpeditionEntryMode, enter?: ExpeditionEntry): void {
  if (enter) enter(mode);
  else host.scene.start('PurificationScene', { fromMenu: true });
}

export function hasReadableSave(): boolean {
  return saveManager.peekRecordSummary() !== null;
}

/** Reset only after storage is accessible and replacement is explicit; old bytes survive until the new save. */
export function beginNewExpedition(host: Phaser.Scene, enter?: ExpeditionEntry, confirmedReplacement = false): boolean {
  if (activeLoad) return false;
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
export async function loadExpedition(host: Phaser.Scene, enter?: ExpeditionEntry, onInterrupted?: () => void,
  options: ExpeditionLoadOptions = {}): Promise<ExpeditionLoadResult> {
  if (activeLoad) return 'busy';
  if (options.signal?.aborted) return 'cancelled';
  const fail = (message: string): ExpeditionLoadResult => {
    if (options.onError) options.onError(message); else showToastInline(message, {});
    return 'failed';
  };
  if (saveManager.hasPendingSave()) {
    return fail('结算尚未保存，请先回到当前场景重试保存。');
  }
  const snapshot = saveManager.captureLoadSnapshot();
  if (!snapshot) return fail('暂时无法读取浏览器存储，原记录已保留。');
  const controller = new AbortController();
  activeLoad = controller;
  const cancel = (): void => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (typeof window !== 'undefined') window.addEventListener('blur', cancel, { once: true });
  host.events?.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
  host.events?.once(Phaser.Scenes.Events.DESTROY, cancel);
  try {
    installProceduralRiftRecovery();
    const identity = snapshot.checkpoint?.identity ?? snapshot.departure?.identity;
    if (identity?.worldId === 'procedural-rift') await prepareProceduralRecovery(identity, { signal: controller.signal });
    if (controller.signal.aborted) return 'cancelled';
    // No await between this comparison, the prepared-only validation scope and
    // load. A cache miss inside validation is an error, never main-thread work.
    if (!saveManager.matchesLoadSnapshot(snapshot)) return fail('等待期间记录发生了变化，请重新选择继续。原记录已保留。');
    const loaded = identity?.worldId === 'procedural-rift'
      ? withPreparedProceduralRecovery(identity, () => saveManager.load(undefined, snapshot))
      : saveManager.load(undefined, snapshot);
    if (loaded && inventoryStore.getRun()?.status === 'active') {
      const checkpoint = snapshot.checkpoint;
      const departure = snapshot.departure;
      const identity = checkpoint?.identity ?? departure?.identity;
      if (identity?.worldId === 'procedural-rift') {
        const conditions = checkpoint ? (checkpoint.state as import('@/systems/rift-recovery-state').RiftRecoveryState).conditions : departure!.conditions;
        host.scene.start('RiftScene', { ...conditions, recovery: { identity, externalTargetIds: [], checkpoint } });
        return 'entered';
      } else if (onInterrupted) { onInterrupted(); return 'interrupted'; }
      return fail('旧记录缺少出行状态。请在标题页选择放弃本趟，基地与收存保留。');
    }
    if (loaded) {
      enterPurification(host, 'continue', enter);
      return 'entered';
    } else if (saveManager.canAbandonInterruptedRun() && onInterrupted) {
      onInterrupted();
      return 'interrupted';
    } else if (snapshot.raw === null && !saveManager.hasSave()) {
      // Release the load mutex only for this synchronous admitted reset.
      activeLoad = null;
      if (!beginNewExpedition(host, enter)) {
        return fail('无法安全创建新记录。请检查浏览器存储后重试；当前进度未重置。');
      }
      return 'entered';
    } else {
      return fail('这份记录暂时无法读取，原记录已保留。');
    }
  } catch (reason) {
    if (controller.signal.aborted || (reason instanceof Error && reason.name === 'AbortError')) return 'cancelled';
    console.error('Expedition preparation failed; saved record retained', reason);
    // A damaged outing may still contain a valid base. Preserve the existing
    // explicit abandonment path, but never offer it for a replacement record.
    if (onInterrupted && saveManager.matchesLoadSnapshot(snapshot) && saveManager.canAbandonInterruptedRun()) {
      onInterrupted(); return 'interrupted';
    }
    return fail('这次未能备好裂隙，请重试。原记录已保留。');
  } finally {
    if (activeLoad === controller) activeLoad = null;
    options.signal?.removeEventListener('abort', cancel);
    if (typeof window !== 'undefined') window.removeEventListener('blur', cancel);
    host.events?.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    host.events?.off(Phaser.Scenes.Events.DESTROY, cancel);
  }
}

/** Legacy active ledgers have no reconstructible world. Explicit consent is required. */
export function abandonInterruptedExpedition(host: Phaser.Scene, enter?: ExpeditionEntry): void {
  if (activeLoad) return;
  if (!saveManager.canAbandonInterruptedRun() || !saveManager.load('abandon-active')) return;
  const run = inventoryStore.getRun();
  if (!run || run.status !== 'active') return;
  const result = inventoryStore.settleRun(run.id, 'abandon', 0);
  if (!result.ok) { showToastInline('放弃结果尚未保存，请重试；原记录保留。', {}); return; }
  enterPurification(host, 'continue', enter);
}
