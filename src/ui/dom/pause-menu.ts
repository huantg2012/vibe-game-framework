import { inventoryStore } from '@/systems/inventory-store';
/**
 * In-game Esc record menu.
 *
 * Opens over the current scene without leaving it. Three intents:
 *   - 新的纪录 — wipe and start a new record (exits the rift if that is where we are)
 *   - 沿旧路返回 — load the stored record (same: exits the rift)
 *   - 合上 — dismiss; the current scene resumes, nothing happened
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

type MenuMode = 'root' | 'confirmOverwrite';

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

function pauseHost(): void {
  if (!host) return;
  if (host.scene.isActive() && !host.scene.isPaused()) host.scene.pause();
  audioManager.pauseAll();
}

function resumeHost(): void {
  if (!host) return;
  if (host.scene.isPaused()) host.scene.resume();
  audioManager.resumeAll();
}

function destroyDom(): void {
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
  if (hasReadableSave()) {
    mode = 'confirmOverwrite';
    buildOverwriteItems();
    paint();
    return;
  }
  leaveForSession(beginNewExpedition);
}

function onLoadSave(): void {
  if (inventoryStore.getRun()?.status === 'active' || saveManager.hasPendingSave()) {
    const note = panel?.querySelector('.readout-note');
    if (note) note.textContent = saveManager.hasPendingSave() ? '结算尚未保存。请合上菜单，重试保存。' : '当前仍在裂隙中。请完成撤离后再载入纪录。';
    return;
  }
  leaveForSession(loadExpedition);
}

function buildRootItems(): void {
  items = [{ label: t('menu.newSave'), action: onNewSave }];
  if (hasReadableSave()) {
    items.push({ label: t('menu.continue'), action: onLoadSave });
  }
  items.push({ label: t('menu.resume'), action: () => pauseMenu.close() });
  selectedIndex = items.length - 1;
}

function buildOverwriteItems(): void {
  items = [
    { label: t('menu.overwriteClear'), action: () => leaveForSession(beginNewExpedition) },
    { label: t('menu.continue'), action: onLoadSave },
  ];
  selectedIndex = 1;
}

function paint(): void {
  if (!panel) return;

  const warning = mode === 'confirmOverwrite'
    ? `<div class="hint" style="text-align:left;margin:0 0 12px;">${
        t('menu.overwriteWarning', { tideNumber: saveManager.peekTideNumber() ?? 1 })
      }</div>`
    : '';

  const rows = items.map((item, i) => {
    const selected = i === selectedIndex;
    return `<div class="pause-menu-row${selected ? ' is-selected' : ''}" data-index="${i}" role="button" tabindex="-1">${item.label}</div>`;
  }).join('');

  panel.innerHTML =
    `<div class="panel-title">${t('menu.pauseTitle')}</div>` +
    `<div class="readout-note">${mode === 'root' ? '当前行动已暂停。' : '此操作将替换已保存的纪录。'}</div>` +
    warning +
    `<div class="pause-menu-list">${rows}</div>` +
    buildKeyHintBar() +
    (mode === 'root' ? `<div class="readout-note">合上后 <span class="key">Tab</span> ${host?.scene.key === 'PurificationScene' ? '存续报告 · 物件' : '本趟拾获 · 世界继续'}</div>` : '');

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

  if (mode === 'confirmOverwrite') {
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
  if (e.repeat) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (performance.now() < ignoreEscUntil) return;
    if (mode === 'confirmOverwrite') {
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
    e.stopPropagation();
    if (items.length === 0) return;
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    audioManager.playSFX('sfx-ui-hover');
    paint();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    e.stopPropagation();
    if (items.length === 0) return;
    selectedIndex = (selectedIndex + 1) % items.length;
    audioManager.playSFX('sfx-ui-hover');
    paint();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    audioManager.playSFX('sfx-ui-click');
    items[selectedIndex]?.action();
  }
}

export const pauseMenu = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(scene: Phaser.Scene): void {
    if (panel) return;
    if (performance.now() < closedAt + 200) return;
    injectPanelStyles();
    host = scene;
    mode = 'root';
    ignoreEscUntil = performance.now() + 200;
    pauseHost();
    audioManager.playSFX('sfx-ui-open');

    const root = getDomUiRoot();
    backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop pause-menu-backdrop scene-menu-backdrop scene-menu-compact-backdrop';
    backdrop.style.cssText = 'position:absolute;inset:0;pointer-events:auto;z-index:1000;';
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) pauseMenu.close();
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
    buildRootItems();
    paint();
    document.addEventListener('keydown', onKey, true);
  },

  close(): void {
    if (!panel) return;
    audioManager.playSFX('sfx-ui-close');
    destroyDom();
    document.removeEventListener('keydown', onKey, true);
    resumeHost();
    host = null;
    closedAt = performance.now();
    ignoreEscUntil = closedAt + 200;
  },

  /** Tear down without resuming the host scene (scene is stopping). */
  discard(): void {
    if (!panel) {
      host = null;
      return;
    }
    destroyDom();
    document.removeEventListener('keydown', onKey, true);
    host = null;
    closedAt = performance.now();
  },
};
