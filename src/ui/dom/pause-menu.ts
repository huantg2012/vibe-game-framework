import { inventoryStore } from '@/systems/inventory-store';
/**
 * In-game Esc record menu.
 *
 * Opens over the current scene without leaving it. At base: new record,
 * load the saved record, or close and resume. During a recoverable outing:
 * resume this run, or explicitly confirm abandonment and its item loss.
 *
 * A frameless menu over the current scene. Esc on the root list closes;
 * Esc on the overwrite guard returns to
 * the list without applying anything.
 */

import Phaser from 'phaser';
import { t } from '@/i18n';
import { audioManager } from '@/managers/audio-manager';
import { beginNewExpedition, hasReadableSave, loadExpedition } from '@/managers/session';
import { saveManager } from '@/managers/save-manager';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

type MenuMode = 'root' | 'confirmOverwrite' | 'confirmAbandon' | 'preparing';
export type RiftPreparationStage = 'layout' | 'surface' | 'entering';
export interface PauseMenuOptions {
  onAbandon?: () => void;
  /** Focus protection must work even immediately after a manual close. */
  focusLoss?: boolean;
  preparation?: {
    title?: string;
    message: string;
    stage?: RiftPreparationStage;
    cancel: () => void;
    /** Render-only projection. Simulation, scene timers and input stay paused. */
    onVisualFrame?: (time: number, delta: number) => void;
  };
}
let recoveryOptions: PauseMenuOptions | undefined;
let loadAbort: AbortController | null = null;

interface MenuItem {
  label: string;
  action: () => void;
}

let host: Phaser.Scene | null = null;
let backdrop: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let mode: MenuMode = 'root';
let items: MenuItem[] = [];
let selectedIndex = 0;
let ignoreEscUntil = 0;
let closedAt = 0;
let preparationFrames: { scene: Phaser.Scene; frame: (renderer: unknown, time: number, delta: number) => void; release: () => void } | null = null;
const preparationLog: { stage: RiftPreparationStage; message: string }[] = [];

function releasePreparationFrames(): void {
  preparationFrames?.release();
  preparationFrames = null;
}

function startPreparationFrames(scene: Phaser.Scene): void {
  if (!recoveryOptions?.preparation?.onVisualFrame) return;
  const frame = (_renderer: unknown, time: number, delta: number): void => {
    if (host !== scene || !panel || mode !== 'preparing' || document.hidden || !scene.scene.isPaused()) return;
    recoveryOptions?.preparation?.onVisualFrame?.(time, Math.max(0, Math.min(100, delta)));
  };
  const stopped = (): void => pauseMenu.discard();
  const release = (): void => {
    scene.game.events.off(Phaser.Core.Events.PRE_RENDER, frame);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stopped);
    scene.events.off(Phaser.Scenes.Events.DESTROY, stopped);
  };
  preparationFrames = { scene, frame, release };
  scene.game.events.on(Phaser.Core.Events.PRE_RENDER, frame);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopped);
  scene.events.once(Phaser.Scenes.Events.DESTROY, stopped);
}

function pauseHost(): void {
  if (!host) return;
  if (host.scene.isActive() && !host.scene.isPaused()) host.scene.pause();
  audioManager.pauseAll();
}

function resumeHost(): void {
  if (!host) return;
  host.input.keyboard?.resetKeys();
  if (host.scene.isPaused()) host.scene.resume();
  audioManager.resumeAll();
}

function destroyDom(): void {
  releasePreparationFrames();
  preparationLog.length = 0;
  backdrop?.remove();
  panel?.remove();
  backdrop = null;
  panel = null;
}

function leaveForSession(apply: (scene: Phaser.Scene) => void): void {
  const scene = host;
  audioManager.resumeAll();
  destroyDom();
  document.removeEventListener('keydown', onKey, true);
  host = null;
  if (scene) apply(scene);
}

function onNewSave(): void {
  if (saveManager.hasPendingSave()) {
    const note = panel?.querySelector('.readout-note');
    if (note) note.textContent = '结算尚未保存。请合上菜单，重试保存。';
    return;
  }
  const presence = saveManager.getRecordPresence();
  if (presence === 'unavailable') {
    showNewRecordFailure();
    return;
  }
  if (presence === 'present') {
    mode = 'confirmOverwrite';
    buildOverwriteItems();
    paint();
    return;
  }
  startNewRecord();
}

function showNewRecordFailure(): void {
  const note = panel?.querySelector('.readout-note');
  if (note) note.textContent = '无法安全创建新记录。请检查浏览器存储后重试；当前进度未重置。';
}

function startNewRecord(confirmedReplacement = false): void {
  if (!host) return;
  // Keep the paused scene and its controls until the new-record guard has admitted a complete reset candidate.
  const started = beginNewExpedition(host, () => {
    leaveForSession(scene => scene.scene.start('PurificationScene', { fromMenu: true }));
  }, confirmedReplacement);
  if (!started) showNewRecordFailure();
}

function onLoadSave(): void {
  if (!host || loadAbort) return;
  if (inventoryStore.getRun()?.status === 'active' || saveManager.hasPendingSave()) {
    const note = panel?.querySelector('.readout-note');
    if (note) note.textContent = saveManager.hasPendingSave() ? '结算尚未保存。请合上菜单，重试保存。' : '当前仍在裂隙中。请完成撤离后再载入纪录。';
    return;
  }
  const scene = host, controller = new AbortController();
  loadAbort = controller; mode = 'preparing'; selectedIndex = 0;
  items = [{ label: '取消载入', action: () => controller.abort() }];
  paint();
  const note = panel?.querySelector('.readout-note');
  if (note) note.textContent = '正在辨认归途。原记录仍保留。';
  let message: string | undefined;
  void loadExpedition(scene, undefined, undefined, { signal: controller.signal, onError: error => { message = error; } }).then(result => {
    if (loadAbort !== controller || host !== scene) return;
    loadAbort = null;
    if (result === 'entered') { audioManager.resumeAll(); pauseMenu.discard(); return; }
    mode = 'root'; buildRootItems(); paint();
    const currentNote = panel?.querySelector('.readout-note');
    if (message && currentNote) currentNote.textContent = message;
  });
}

function buildRootItems(): void {
  if (recoveryOptions?.onAbandon) {
    items = [
      { label: '合上，继续本趟', action: () => pauseMenu.close() },
      { label: '放弃本趟', action: () => {
        mode = 'confirmAbandon';
        items = [{ label: '保留本趟，返回', action: () => { mode = 'root'; buildRootItems(); paint(); } },
          { label: '确认放弃，遗失随身物', action: () => { const action = recoveryOptions?.onAbandon; pauseMenu.close(); action?.(); } }];
        selectedIndex = 0; paint();
      } },
    ];
    selectedIndex = 0; return;
  }
  items = [{ label: t('menu.newSave'), action: onNewSave }];
  if (hasReadableSave()) {
    items.push({ label: '载入已保存的记录', action: onLoadSave });
  }
  items.push({ label: t('menu.resume'), action: () => pauseMenu.close() });
  selectedIndex = items.length - 1;
}

function buildOverwriteItems(): void {
  items = [
    { label: t('menu.overwriteClear'), action: () => startNewRecord(true) },
    hasReadableSave()
      ? { label: '载入已保存的记录', action: onLoadSave }
      : { label: '保留记录，返回', action: () => { mode = 'root'; buildRootItems(); paint(); } },
  ];
  selectedIndex = 1;
}

function paint(): void {
  if (!panel) return;

  const tideNumber = mode === 'confirmOverwrite' ? saveManager.peekTideNumber() : null;
  const warning = mode === 'confirmOverwrite'
    ? `<div class="hint" style="text-align:left;margin:0 0 12px;">${
        tideNumber === null ? '已有记录暂时无法读取。清除后将永久替换这份记录。'
          : t('menu.overwriteWarning', { tideNumber })
      }</div>`
    : mode === 'confirmAbandon' ? '<div class="hint" style="text-align:left;margin:0 0 12px;">带入装备与本趟拾获全部遗失，不给予携回奖励。返回净化点后结算一次既有冲击，基地库存保留。</div>' : '';

  const rows = items.map((item, i) => {
    const selected = i === selectedIndex;
    return `<div class="pause-menu-row${selected ? ' is-selected' : ''}" data-index="${i}" role="button" tabindex="-1">${item.label}</div>`;
  }).join('');

  const isDeparturePreparation = mode === 'preparing' && !!recoveryOptions?.preparation;
  panel.classList.toggle('scene-menu-preparing', isDeparturePreparation);
  panel.innerHTML =
    `<div class="panel-title"></div>` +
    (isDeparturePreparation ? '<div class="rift-preparation-log" role="status" aria-live="polite" aria-atomic="true"></div>'
      : `<div class="readout-note">${mode === 'preparing' ? '正在辨认归途。原记录仍保留。' : mode === 'confirmAbandon' ? '只有明确放弃才结损。' : mode === 'root' ? (recoveryOptions?.onAbandon ? '当前行动已暂停。关闭或刷新后，继续这一趟。' : '当前行动已暂停。') : '此操作将替换已保存的纪录。'}</div>`) +
    warning +
    `<div class="pause-menu-list">${rows}</div>` +
    buildKeyHintBar() +
    (mode === 'root' ? `<div class="readout-note">合上后 <span class="key">Tab</span> ${host?.scene.key === 'PurificationScene' ? '存续报告 · 物件' : '随身 · 世界继续'}</div>` : '');
  panel.querySelector('.panel-title')!.textContent = isDeparturePreparation
    ? recoveryOptions?.preparation?.title ?? t('menu.pauseTitle') : t('menu.pauseTitle');
  if (isDeparturePreparation) paintPreparationLog();

  panel.querySelectorAll<HTMLElement>('.pause-menu-row').forEach((row) => {
    row.addEventListener('pointermove', () => {
      const next = Number(row.dataset.index);
      if (next === selectedIndex) return;
      audioManager.playSFX('sfx-ui-hover');
      selectedIndex = next;
      paint();
    });
    row.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      selectedIndex = Number(row.dataset.index);
      audioManager.playSFX('sfx-ui-click');
      items[selectedIndex]?.action();
    });
  });
}

function buildKeyHintBar(): string {
  const selectedLabel = items[selectedIndex]?.label ?? '';
  const resumeLabel = t('menu.resume');
  if (mode === 'preparing') {
    return `<div class="key-hint-bar"><span><span class="key">Enter</span> / <span class="key">Esc</span> ${selectedLabel}</span></div>`;
  }

  if (mode === 'confirmOverwrite' || mode === 'confirmAbandon') {
    return `<div class="key-hint-bar">
    <span><span class="key">↑↓</span> 选中</span>
    <span><span class="key">Enter</span> ${selectedLabel}</span>
    <span><span class="key">Esc</span> 返回</span>
  </div>`;
  }

  if (selectedLabel === resumeLabel) {
    return `<div class="key-hint-bar">
    <span><span class="key">↑↓</span> 选中</span>
    <span><span class="key">Enter</span> / <span class="key">Esc</span> 合上</span>
  </div>`;
  }

  return `<div class="key-hint-bar">
    <span><span class="key">↑↓</span> 选中</span>
    <span><span class="key">Enter</span> ${selectedLabel}</span>
    <span><span class="key">Esc</span> 合上</span>
  </div>`;
}

function onKey(e: KeyboardEvent): void {
  if (!panel) return;
  if (mode === 'preparing') {
    // No scene action may queue behind an async preparation menu.
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  if (e.repeat) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (performance.now() < ignoreEscUntil) return;
    if (loadAbort) { loadAbort.abort(); return; }
    if (mode === 'confirmOverwrite' || mode === 'confirmAbandon') {
      mode = 'root';
      buildRootItems();
      paint();
    } else {
      pauseMenu.close();
    }
    return;
  }
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (items.length < 2) return;
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    audioManager.playSFX('sfx-ui-hover');
    paint();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (items.length < 2) return;
    selectedIndex = (selectedIndex + 1) % items.length;
    audioManager.playSFX('sfx-ui-hover');
    paint();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopImmediatePropagation();
    audioManager.playSFX('sfx-ui-click');
    items[selectedIndex]?.action();
  }
}

function paintPreparationLog(): void {
  const log = panel?.querySelector('.rift-preparation-log');
  if (!log) return;
  log.replaceChildren();
  for (let i = 0; i < preparationLog.length; i++) {
    const entry = preparationLog[i]!;
    const current = i === preparationLog.length - 1;
    const line = document.createElement('div');
    line.className = `rift-preparation-line${current ? ' is-current' : ''}`;
    line.dataset.stage = entry.stage;
    const copy = document.createElement('span');
    copy.textContent = entry.message;
    line.append(copy);
    if (current) {
      const activity = document.createElement('span');
      activity.className = 'rift-preparation-activity';
      activity.setAttribute('aria-hidden', 'true');
      activity.textContent = '···';
      line.append(activity);
    }
    log.append(line);
  }
}

export const pauseMenu = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(scene: Phaser.Scene, options?: PauseMenuOptions): void {
    if (panel) return;
    if (!options?.preparation && !options?.focusLoss && performance.now() < closedAt + 200) return;
    injectPanelStyles();
    host = scene;
    recoveryOptions = options;
    mode = 'root';
    ignoreEscUntil = performance.now() + 200;
    pauseHost();
    audioManager.playSFX('sfx-ui-open');

    const root = getDomUiRoot();
    backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop pause-menu-backdrop scene-menu-backdrop scene-menu-compact-backdrop';
    backdrop.style.cssText = 'position:absolute;inset:0;pointer-events:auto;z-index:1000;';
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop && mode !== 'preparing') pauseMenu.close();
    });

    panel = document.createElement('div');
    panel.className = 'game-panel pause-menu-panel scene-menu scene-menu-pause';
    panel.style.cssText = [
      'position:absolute',
      'height:auto',
      'z-index:1001',
      'pointer-events:auto',
    ].join(';');

    root.appendChild(backdrop);
    root.appendChild(panel);
    if (options?.preparation) {
      mode = 'preparing'; selectedIndex = 0;
      items = [{ label: '取消准备', action: () => pauseMenu.close() }];
      preparationLog.push({ stage: options.preparation.stage ?? 'layout', message: options.preparation.message });
    } else buildRootItems();
    paint();
    startPreparationFrames(scene);
    document.addEventListener('keydown', onKey, true);
  },

  /** Only the owning operation reports real phase boundaries. No timer advances
   * this log or implies that an unfinished world is ready. */
  setPreparationStage(stage: RiftPreparationStage, message: string): void {
    const preparation = recoveryOptions?.preparation;
    if (!panel || mode !== 'preparing' || !preparation) return;
    if (preparationLog.some(entry => entry.stage === stage)) return;
    preparation.stage = stage;
    preparation.message = message;
    preparationLog.push({ stage, message });
    paintPreparationLog();
  },

  close(): void {
    if (!panel) return;
    loadAbort?.abort(); loadAbort = null;
    const cancel = recoveryOptions?.preparation?.cancel;
    if (recoveryOptions) delete recoveryOptions.preparation;
    cancel?.();
    audioManager.playSFX('sfx-ui-close');
    destroyDom();
    document.removeEventListener('keydown', onKey, true);
    resumeHost();
    host = null; recoveryOptions = undefined;
    closedAt = performance.now();
    ignoreEscUntil = closedAt + 200;
  },

  /** Tear down without resuming the host scene (scene is stopping). */
  discard(): void {
    loadAbort?.abort(); loadAbort = null;
    recoveryOptions?.preparation?.cancel();
    recoveryOptions = undefined;
    if (!panel) {
      host = null;
      return;
    }
    destroyDom();
    document.removeEventListener('keydown', onKey, true);
    host = null;
    closedAt = performance.now();
  },

  /** Preparation owns no inventory commit. Cancellation returns to Haven,
   * whose focus loss does not require a separate resume confirmation. */
  finishPreparation(): void {
    if (!recoveryOptions?.preparation) return;
    delete recoveryOptions.preparation;
    this.close();
  },
};
