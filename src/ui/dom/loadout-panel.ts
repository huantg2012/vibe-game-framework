/**
 * LoadoutPanel — 出击装配墙机（载体 B）。
 *
 * I11-B4c：钉顶三格身份带（三格都暗）+ 槽/库主-从 + 只读出击预估三节点 + 底键印。
 * 无顶 Tab。键鼠同一通道：无 hoverTarget。库存无未入槽工具时库存区走空状态三件套。
 * 挂 #dom-ui-root。
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { audioManager } from '@/managers/audio-manager';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { getDefenseName, getRarityStars, getToolName, sortContaminants } from '@/ui/contaminant-names';
import { buildToolInspectHtml, INSPECT_EMPTY_HTML } from './inspect-dock';
import { identityBandHtml } from './module-identity-strip';
import type { Contaminant } from '@/types/game-types';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';
import { describeSideEffectBody, formatChaosRateDelta } from '@/ui/side-effect-labels';

// Rarity is "Degree not Kind": same contam color family, rising brightness
// (ui-art-overhaul.md A2) instead of unrelated hues per tier.
const RARITY_COLORS: Record<string, string> = {
  common: '#8a8f96',
  fine: '#1aad96',
  rare: '#3cffd4',
};

/**
 * Slot label for a given index. Active slots use their hotkey letter, read from
 * `GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS` (never hardcoded) so this panel can
 * never drift from RiftScene's actual key bindings (U7 "输入一致"). The passive slot is
 * always the last unlocked slot, labeled "被动" regardless of position.
 */
function getSlotLabel(index: number, passiveIndex: number): string {
  if (index === passiveIndex) return '被动';
  return GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[index] ?? '?';
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onConfirmCallback: (() => void) | null = null;
let onCloseCallback: (() => void) | null = null;

// Keyboard cursor (IA §0.4 "键盘是第一公民"): three focus regions, cycled with Tab.
type CursorRegion = 'slots' | 'inventory' | 'actions';
const REGION_ORDER: CursorRegion[] = ['slots', 'inventory', 'actions'];
const ACTION_COUNT = 2; // 0 = 踏入, 1 = 离开

let cursorRegion: CursorRegion = 'slots';
let cursorSlot = 0;
let cursorInv = 0;
let cursorAction = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const loadoutPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(onConfirm: () => void, onClose?: () => void): void {
    if (panel) return;
    onConfirmCallback = onConfirm;
    onCloseCallback = onClose ?? null;
    cursorRegion = 'slots';
    cursorSlot = 0;
    cursorInv = 0;
    cursorAction = 0;
    createPanel();
    audioManager.playSFX('sfx-ui-open');
  },

  close(): void {
    if (!panel) return;
    audioManager.playSFX('sfx-ui-close');
    destroyPanel();
    onCloseCallback?.();
    onCloseCallback = null;
    onConfirmCallback = null;
  },
};

// ---------------------------------------------------------------------------
// Panel creation
// ---------------------------------------------------------------------------

function createPanel(): void {
  panel = createCrtPanel('loadout-panel');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'loadout-backdrop';
  root.appendChild(backdrop);

  render();
  root.appendChild(panel);
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('loadout-backdrop')?.remove();
}

// ---------------------------------------------------------------------------
// Keyboard cursor navigation
// ---------------------------------------------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    loadoutPanel.close();
    return;
  }

  const slots = contaminantSystem.getSortieLoadout();
  const inventory = getInventory();

  if (e.key === 'Tab') {
    e.stopPropagation();
    e.preventDefault();
    cycleRegion(e.shiftKey ? -1 : 1, slots.length, inventory.length);
    render();
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    moveCursor(dir, slots.length, inventory.length);
    render();
    return;
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
    e.preventDefault();
    activateFocused(slots, inventory);
  }
}

function clampCursor(slotCount: number, invCount: number): void {
  cursorSlot = slotCount > 0 ? Math.min(cursorSlot, slotCount - 1) : 0;
  cursorInv = invCount > 0 ? Math.min(cursorInv, invCount - 1) : 0;
  if (cursorRegion === 'slots' && slotCount === 0) {
    cursorRegion = invCount > 0 ? 'inventory' : 'actions';
  }
  if (cursorRegion === 'inventory' && invCount === 0) {
    cursorRegion = slotCount > 0 ? 'slots' : 'actions';
  }
}

function cycleRegion(dir: 1 | -1, slotCount: number, invCount: number): void {
  let idx = REGION_ORDER.indexOf(cursorRegion);
  for (let attempts = 0; attempts < REGION_ORDER.length; attempts++) {
    idx = (idx + dir + REGION_ORDER.length) % REGION_ORDER.length;
    const region = REGION_ORDER[idx] ?? 'actions';
    if (region === 'slots' && slotCount === 0) continue;
    if (region === 'inventory' && invCount === 0) continue;
    cursorRegion = region;
    return;
  }
}

function moveCursor(dir: 1 | -1, slotCount: number, invCount: number): void {
  if (cursorRegion === 'slots' && slotCount > 0) {
    cursorSlot = (cursorSlot + dir + slotCount) % slotCount;
  } else if (cursorRegion === 'inventory' && invCount > 0) {
    cursorInv = (cursorInv + dir + invCount) % invCount;
  } else if (cursorRegion === 'actions') {
    cursorAction = (cursorAction + dir + ACTION_COUNT) % ACTION_COUNT;
  }
}

function activateFocused(slots: (Contaminant | null)[], inventory: Contaminant[]): void {
  if (cursorRegion === 'slots') {
    const c = slots[cursorSlot];
    if (c) {
      contaminantSystem.unslotSortie(cursorSlot);
      render();
    }
  } else if (cursorRegion === 'inventory') {
    const c = inventory[cursorInv];
    if (c) equipTool(c, slots);
  } else if (cursorRegion === 'actions') {
    if (cursorAction === 0) {
      panel?.querySelector<HTMLElement>('#loadout-confirm-btn')?.click();
    } else {
      loadoutPanel.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function getInventory(): Contaminant[] {
  return sortContaminants(
    contaminantSystem.getAll().filter((c) => c.stage === 'tool' && !isSlotted(c.id)),
  );
}

function render(): void {
  if (!panel) return;

  const slots = contaminantSystem.getSortieLoadout();
  const inventory = getInventory();
  clampCursor(slots.length, inventory.length);

  const passiveIndex = contaminantSystem.getSortiePassiveSlotIndex();
  const activeCount = contaminantSystem.getSortieActiveSlotCount();

  let html = `<div class="panel-title">踏入裂隙</div>`;
  html += identityBandHtml({ activeId: null });

  html += `<div class="panel-fixed">`;
  html += `<div class="slot-grid" style="grid-template-columns:repeat(${slots.length},1fr);">`;
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    const label = getSlotLabel(i, passiveIndex);
    const selected = cursorRegion === 'slots' && cursorSlot === i;
    const cursor = selected ? '<span style="color:#c4873a;font-weight:bold;margin-right:4px;">&gt;</span>' : '';
    if (c) {
      const name = getToolName(c.type);
      const color = RARITY_COLORS[c.rarity];
      const summary = toolSummary(c.type);
      html += `<div class="slot-cell slot-filled loadout-remove-btn${selected ? ' slot-selected' : ''}" data-index="${i}">
        <div>${cursor}<span class="slot-label">${label}</span></div>
        <span class="slot-name" style="color:${color};">${name}</span>
        <div><span class="slot-info">余量</span> <span style="font-weight:bold;color:#c8cdd4;">${c.usesRemaining}</span></div>
        <span class="slot-info">${summary}</span>
      </div>`;
    } else {
      html += `<div class="slot-cell${selected ? ' slot-selected' : ''}" data-index="${i}">
        <div>${cursor}<span class="slot-label">${label}</span></div>
        <span class="slot-info">空</span>
        <span class="slot-info">可装填</span>
      </div>`;
    }
  }
  html += `</div>`;
  html += `</div>`;

  html += `<div class="panel-fixed">${buildSortiePreview()}</div>`;
  html += `<div class="panel-fixed">${buildResidueRow()}</div>`;

  html += `<div class="scroll-area">`;
  if (inventory.length === 0) {
    html += inventoryEmptyHtml();
  } else {
    inventory.forEach((c, idx) => {
      const name = getToolName(c.type);
      const stars = getRarityStars(c.rarity);
      const color = RARITY_COLORS[c.rarity];
      const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
      const typeLabel = toolType === 'passive' ? '被动' : '主动';
      const hasSlot = tileHasCompatibleSlot(slots, activeCount, passiveIndex, toolType);
      const selected = cursorRegion === 'inventory' && cursorInv === idx;
      const cursor = selected ? '<span style="color:#c4873a;font-weight:bold;margin-right:4px;">&gt;</span>' : '';
      html += `<div class="item-tile loadout-equip-tile${hasSlot ? '' : ' tile-disabled'}${selected ? ' tile-selected' : ''}" data-id="${c.id}" data-tool-type="${toolType}" data-inv-index="${idx}" style="display:flex;width:100%;gap:12px;">
        <span>${cursor}<span style="color:${color};">${name}</span></span>
        <span style="color:${color};">${stars}</span>
        <span>${typeLabel}</span>
        <span style="margin-left:auto;font-weight:bold;color:#c8cdd4;">${c.usesRemaining}</span>
      </div>`;
    });
  }
  html += `</div>`;
  html += `<div class="inspect-dock" id="loadout-inspect-dock">${computeInspectHtml(slots, inventory, activeCount, passiveIndex)}</div>`;
  html += buildKeyHintBar(slots, inventory, activeCount, passiveIndex);

  panel.innerHTML = html;
  scrollFocusedIntoView(panel);
  wireEvents();
}

function buildKeyHintBar(
  slots: (Contaminant | null)[],
  inventory: Contaminant[],
  activeCount: number,
  passiveIndex: number,
): string {
  const parts: string[] = [
    `<span><span class="key">Tab</span> 切区</span>`,
    `<span><span class="key">↑↓←→</span> 移动</span>`,
  ];

  const enterIsStepIn = cursorRegion === 'actions' && cursorAction === 0;
  const enterIsLeave = cursorRegion === 'actions' && cursorAction === 1;

  if (cursorRegion === 'slots' && slots[cursorSlot]) {
    parts.push(`<span><span class="key">Enter</span> 取下</span>`);
  } else if (cursorRegion === 'inventory') {
    const c = inventory[cursorInv];
    if (c) {
      const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
      if (tileHasCompatibleSlot(slots, activeCount, passiveIndex, toolType)) {
        parts.push(`<span><span class="key">Enter</span> 装填</span>`);
      }
    }
  } else if (enterIsStepIn) {
    parts.push(`<span id="loadout-confirm-btn"><span class="key">Enter</span> 踏入</span>`);
  } else if (enterIsLeave) {
    parts.push(`<span id="loadout-cancel-btn"><span class="key">Enter</span> / <span class="key">Esc</span> 离开</span>`);
  }

  if (!enterIsLeave) {
    parts.push(`<span id="loadout-cancel-btn"><span class="key">Esc</span> 离开</span>`);
  }
  if (!enterIsStepIn) {
    parts.push(`<span id="loadout-confirm-btn">踏入</span>`);
  }

  return `<div class="key-hint-bar">
    ${parts.join('\n    ')}
  </div>`;
}

function inventoryEmptyHtml(): string {
  const defenseCount = contaminantSystem.getAll().filter((c) => c.stage === 'defense').length;
  return `<div class="crt-empty">
    <div class="crt-empty-mark"></div>
    <div>
      <div class="crt-empty-why"><span>工具</span><span>0</span></div>
      <div class="crt-empty-why"><span>残渣</span><span>${defenseCount}</span></div>
      <div class="crt-empty-next"><span class="empty-key">[Enter]</span> <span>踏入</span></div>
    </div>
  </div>`;
}

function wireEvents(): void {
  if (!panel) return;

  // Remove from slot by clicking filled cell (mouse = equal-citizen shortcut for
  // the same action Enter performs on a keyboard-focused slot).
  panel.querySelectorAll('.loadout-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt((btn as HTMLElement).dataset.index!, 10);
      contaminantSystem.unslotSortie(index);
      render();
    });
  });

  panel.querySelectorAll<HTMLElement>('.slot-cell[data-index]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      const index = parseInt(el.dataset.index!, 10);
      if (Number.isNaN(index)) return;
      if (cursorRegion === 'slots' && cursorSlot === index) return;
      cursorRegion = 'slots';
      cursorSlot = index;
      render();
    });
  });

  // Equip tile: auto-assign to first compatible empty slot
  panel.querySelectorAll('.loadout-equip-tile').forEach((btn) => {
    const el = btn as HTMLElement;
    btn.addEventListener('click', () => {
      if (el.classList.contains('tile-disabled')) return;
      const id = el.dataset.id!;
      const c = contaminantSystem.getAll().find((item) => item.id === id);
      if (c) equipTool(c, contaminantSystem.getSortieLoadout());
    });
    el.addEventListener('mouseenter', () => {
      const idx = parseInt(el.dataset.invIndex!, 10);
      if (Number.isNaN(idx)) return;
      if (cursorRegion === 'inventory' && cursorInv === idx) return;
      cursorRegion = 'inventory';
      cursorInv = idx;
      render();
    });
  });

  panel.querySelector('#loadout-confirm-btn')?.addEventListener('click', () => {
    saveManager.save();
    const cb = onConfirmCallback;
    destroyPanel();
    onConfirmCallback = null;
    onCloseCallback = null;
    cb?.();
  });

  panel.querySelector('#loadout-cancel-btn')?.addEventListener('click', () => {
    loadoutPanel.close();
  });
}

function equipTool(c: Contaminant, currentSlots: (Contaminant | null)[]): void {
  const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
  const activeCount = contaminantSystem.getSortieActiveSlotCount();
  const passiveIdx = contaminantSystem.getSortiePassiveSlotIndex();
  const emptySlots = currentSlots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
  const target = emptySlots.find((idx) =>
    toolType === 'passive' ? idx === passiveIdx : idx < activeCount,
  );
  if (target !== undefined) {
    contaminantSystem.slotSortie(c.id, target);
    render();
  }
}

function computeInspectHtml(
  slots: (Contaminant | null)[],
  inventory: Contaminant[],
  activeCount: number,
  passiveIndex: number,
): string {
  const target = cursorRegion === 'slots' ? { kind: 'slot' as const, index: cursorSlot }
    : cursorRegion === 'inventory' ? { kind: 'inventory' as const, index: cursorInv }
      : null;
  if (!target) return INSPECT_EMPTY_HTML;

  if (target.kind === 'slot') {
    const c = slots[target.index];
    if (!c) return INSPECT_EMPTY_HTML;
    const label = getSlotLabel(target.index, passiveIndex);
    return buildToolInspectHtml(c, {
      slotState: 'slotted',
      hotkeyLabel: label === '被动' ? undefined : label,
      canEquip: true,
    });
  }

  const c = inventory[target.index];
  if (!c) return INSPECT_EMPTY_HTML;
  const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
  const hasSlot = tileHasCompatibleSlot(slots, activeCount, passiveIndex, toolType);
  return buildToolInspectHtml(c, {
    slotState: 'unslotted',
    canEquip: hasSlot,
    unavailableReason: toolType === 'passive' ? '被动槽已满' : '主动槽已满',
  });
}

function tileHasCompatibleSlot(
  slots: (Contaminant | null)[],
  activeCount: number,
  passiveIndex: number,
  toolType: string,
): boolean {
  const emptySlots = slots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
  return emptySlots.some((idx) =>
    toolType === 'passive' ? idx === passiveIndex : idx < activeCount,
  );
}

// ---------------------------------------------------------------------------
// Sortie preview
// ---------------------------------------------------------------------------

function toolSummary(type: Contaminant['type']): string {
  return CONTAMINANT_DATA[type]?.summaryTool ?? '';
}

function buildResidueRow(): string {
  const pending = gameState.getPendingSideEffects();
  const parts = pending
    .map((e) => {
      const body = describeSideEffectBody(e);
      if (!body) return null;
      const src = e.source ? getDefenseName(e.source as Contaminant['type']) : '';
      return `<span class="stat-label">${body.split(' ')[0] ?? ''}</span>
        <span class="stat-value" style="color:#1aad96;">${body.includes('+') ? body.slice(body.indexOf('+')) : body}</span>
        ${src ? `<span>← ${src}</span>` : ''}`;
    })
    .filter((x): x is string => x !== null);
  if (parts.length === 0) return '';
  return `<div class="separator"></div>
    <div class="stat-row">
      <span class="stat-label">既有残留</span>
      ${parts.join('')}
    </div>`;
}
function buildSortiePreview(): string {
  const playerHp = GAME_CONSTANTS.PLAYER.MAX_HEALTH + growthSystem.getModifiers().vitalityBonus;
  const mods = gameState.getSortieModifiers();

  return `<div class="stat-row">
      <span class="stat-label">完整度</span>
      <span class="stat-value">${playerHp}</span>
    </div>
    <div class="stat-row"><span class="stat-label">出击预估</span></div>
    <div class="stat-row">
      <span class="stat-label">混乱增速</span>
      <span class="stat-value" style="color:#1aad96;font-size:13px;">${formatChaosRateDelta(mods.chaosRateModifier)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">薪柴价值</span>
      <span class="stat-value" style="color:#c4873a;font-size:13px;">x${mods.kindlingValueModifier.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">起始混乱</span>
      <span class="stat-value" style="color:#1aad96;font-size:13px;">${mods.startingChaos}</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSlotted(id: string): boolean {
  const slots = contaminantSystem.getSortieLoadout();
  return slots.some((c) => c?.id === id);
}
