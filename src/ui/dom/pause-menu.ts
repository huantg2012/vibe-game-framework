/**
 * In-game Esc record menu.
 *
 * Opens over the current scene without leaving it. Three intents, in player language:
 *   - 新存档  — wipe and start a new record (exits the rift if that is where we are)
 *   - 读取存档 — load the stored record (same: exits the rift)
 *   - 继续     — dismiss; the current scene resumes, nothing happened
 *
 * Carrier: B-class world-in-terminal overlay (same `.game-panel` as other blocking
 * readouts). Esc on the root list closes; Esc on the overwrite guard returns to
 * the list without applying anything.
 */

import Phaser from 'phaser';
import { t } from '@/i18n';
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
  host.sound?.pauseAll();
}

function resumeHost(): void {
  if (!host) return;
  if (host.scene.isPaused()) host.scene.resume();
  host.sound?.resumeAll();
}

function destroyDom(): void {
  backdrop?.remove();
  panel?.remove();
  backdrop = null;
  panel = null;
}

function leaveForSession(apply: (scene: Phaser.Scene) => void): void {
  const scene = host;
  scene?.sound?.resumeAll();
  destroyDom();
  document.removeEventListener('keydown', onKey, true);
  host = null;
  if (scene) apply(scene);
}

function onNewSave(): void {
  if (hasReadableSave()) {
    mode = 'confirmOverwrite';
    buildOverwriteItems();
    paint();
    return;
  }
  leaveForSession(beginNewExpedition);
}

function onLoadSave(): void {
  leaveForSession(loadExpedition);
}

function buildRootItems(): void {
  items = [{ label: t('menu.newSave'), action: onNewSave }];
  if (hasReadableSave()) {
    items.push({ label: t('menu.loadSave'), action: onLoadSave });
  }
  items.push({ label: t('menu.resume'), action: () => pauseMenu.close() });
  selectedIndex = items.length - 1;
}

function buildOverwriteItems(): void {
  items = [
    { label: t('menu.overwriteClear'), action: () => leaveForSession(beginNewExpedition) },
    { label: t('menu.loadSave'), action: onLoadSave },
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
    const glyph = selected ? '\u25b8' : '>';
    return `<div class="pause-menu-row${selected ? ' is-selected' : ''}" data-index="${i}">${glyph} ${item.label}</div>`;
  }).join('');

  panel.innerHTML =
    `<div class="panel-title">${t('menu.pauseTitle')}</div>` +
    warning +
    `<div class="pause-menu-list">${rows}</div>` +
    `<div class="key-hint-bar"><span class="key">↑↓</span> 选择 · <span class="key">Enter</span> 确认 · <span class="key">Esc</span> ${
      mode === 'confirmOverwrite' ? '返回' : '关闭'
    }</div>`;

  panel.querySelectorAll<HTMLElement>('.pause-menu-row').forEach((row) => {
    row.addEventListener('pointerover', () => {
      selectedIndex = Number(row.dataset.index);
      paint();
    });
    row.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      selectedIndex = Number(row.dataset.index);
      items[selectedIndex]?.action();
    });
  });
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
    paint();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    e.stopPropagation();
    if (items.length === 0) return;
    selectedIndex = (selectedIndex + 1) % items.length;
    paint();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
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

    const root = getDomUiRoot();
    backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop pause-menu-backdrop';
    backdrop.style.cssText = 'position:absolute;inset:0;pointer-events:auto;z-index:1000;';
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) pauseMenu.close();
    });

    panel = document.createElement('div');
    panel.className = 'game-panel pause-menu-panel';
    panel.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:320px',
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
