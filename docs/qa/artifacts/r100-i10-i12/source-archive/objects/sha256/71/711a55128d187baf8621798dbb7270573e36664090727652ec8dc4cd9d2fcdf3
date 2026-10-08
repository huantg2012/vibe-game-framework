/**
 * 踏入准备：工具槽和库存、选中详情及已有出击条件；空槽不阻止出击。
 * 迭代 11 DEC-119；共享终端样式，挂 #dom-ui-root。
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { audioManager } from '@/managers/audio-manager';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { GAME_CONSTANTS } from '@/config/constants';
import { getContaminantSlot } from '@/systems/contaminant-catalog';
import { getDefenseName, getRarityStars, getToolName, sortContaminants } from '@/ui/contaminant-names';
import { buildToolInspectHtml, INSPECT_EMPTY_HTML } from './inspect-dock';
import type { Contaminant } from '@/types/game-types';
import { renderPanelContent } from './panel-render-state';
import { bindWorldInteraction, type WorldInteractionContext } from './world-interaction';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';
import { describeSideEffectBody, formatChaosRateDelta } from '@/ui/side-effect-labels';

// Rarity is "Degree not Kind": same contam color family, rising brightness
// (ui-art-overhaul.md A2) instead of unrelated hues per tier.
const RARITY_COLORS: Record<string, string> = {
  common: '#8a8f96',
  fine: '#729887',
  rare: '#9bb3a2',
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
let cleanupWorldInteraction: (() => void) | null = null;
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

  open(onConfirm: () => void, onClose?: () => void, context?: WorldInteractionContext): void {
    if (panel) return;
    onConfirmCallback = onConfirm;
    onCloseCallback = onClose ?? null;
    cursorRegion = 'slots';
    cursorSlot = 0;
    cursorInv = 0;
    cursorAction = 0;
    createPanel(context);
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

function createPanel(context?: WorldInteractionContext): void {
  panel = createCrtPanel('loadout-panel');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'loadout-backdrop';
  root.appendChild(backdrop);

  render();
  root.appendChild(panel);
  if (context) {
    cleanupWorldInteraction = bindWorldInteraction(panel, backdrop, context, '裂隙', 'inventory');
  }
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  cleanupWorldInteraction?.();
  cleanupWorldInteraction = null;
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

  if (e.key === 'Enter' && e.shiftKey) {
    e.stopPropagation();
    e.preventDefault();
    if (!e.repeat) confirmSortie();
    return;
  }

  const slots = contaminantSystem.getSortieLoadout();
  const inventory = getInventory();

  if (e.key === 'Tab') {
    e.stopPropagation();
    e.preventDefault();
    cycleRegion(e.shiftKey ? -1 : 1, slots.length, inventory.length);
    render(true, true);
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    moveCursor(dir, slots.length, inventory.length, e.key === 'ArrowUp' || e.key === 'ArrowDown');
    render(true, true);
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

function moveCursor(dir: 1 | -1, slotCount: number, invCount: number, vertical: boolean): void {
  if (cursorRegion === 'slots' && slotCount > 0) {
    cursorSlot = (cursorSlot + dir + slotCount) % slotCount;
  } else if (cursorRegion === 'inventory' && invCount > 0) {
    cursorInv = Math.max(0, Math.min(invCount - 1, cursorInv + dir * (vertical ? 2 : 1)));
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
      confirmSortie();
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

function render(selectionOnly = false, revealSelection = false): void {
  if (!panel) return;

  const slots = contaminantSystem.getSortieLoadout();
  const inventory = getInventory();
  clampCursor(slots.length, inventory.length);

  const passiveIndex = contaminantSystem.getSortiePassiveSlotIndex();
  const activeCount = contaminantSystem.getSortieActiveSlotCount();

  let html = `<div class="panel-heading"><div class="panel-title">踏入裂隙</div><div class="panel-reserve"><span>薪柴</span><strong>${gameState.getKindlingReserve()}</strong></div></div>`;

  html += `<div class="decision-layout"><div class="decision-main scroll-area"><div class="panel-fixed">`;
  html += `<div class="slot-grid" style="grid-template-columns:repeat(${slots.length},minmax(0,1fr));">`;
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    const label = getSlotLabel(i, passiveIndex);
    const selected = cursorRegion === 'slots' && cursorSlot === i;
    const cursor = '';
    if (c) {
      const name = getToolName(c);
      const color = RARITY_COLORS[c.rarity];
      html += `<div class="slot-cell slot-filled loadout-remove-btn${selected ? ' slot-selected' : ''}" data-index="${i}">
        <div>${cursor}<span class="slot-label">${label}</span></div>
        <span class="slot-name" style="color:${color};">${name}</span>
        <div><span class="slot-info">余量</span> <span style="font-weight:400;color:#b5bbaf;">${c.usesRemaining}</span></div>
      </div>`;
    } else {
      html += `<div class="slot-cell${selected ? ' slot-selected' : ''}" data-index="${i}">
        <div>${cursor}<span class="slot-label">${label}</span></div>
        <span class="slot-info">空槽</span>
      </div>`;
    }
  }
  html += `</div>`;
  html += `</div>`;


  html += `<div class="readout-section">库存</div><div class="tile-grid">`;
  if (inventory.length === 0) {
    html += inventoryEmptyHtml();
  } else {
    inventory.forEach((c, idx) => {
      const name = getToolName(c);
      const stars = getRarityStars(c.rarity);
      const color = RARITY_COLORS[c.rarity];
      const toolType = getContaminantSlot(c) ?? 'active';
      const typeLabel = toolType === 'passive' ? '被动' : '主动';
      const hasSlot = tileHasCompatibleSlot(slots, activeCount, passiveIndex, toolType);
      const selected = cursorRegion === 'inventory' && cursorInv === idx;
      const cursor = '';
      html += `<div class="item-tile loadout-equip-tile${hasSlot ? '' : ' tile-disabled'}${selected ? ' tile-selected' : ''}" data-id="${c.id}" data-tool-type="${toolType}" data-inv-index="${idx}" style="display:flex;align-items:baseline;gap:5px;">
        <span>${cursor}<span style="color:${color};">${name}</span></span>
        <span class="inventory-stars">${stars}</span>
        <span class="inventory-kind">${typeLabel}</span>
        <span style="margin-left:auto;font-weight:400;color:#b5bbaf;">${c.usesRemaining}</span>
      </div>`;
    });
  }
  html += `</div>`;
  html += `</div><div class="decision-aside readout-detail inspect-dock" id="loadout-inspect-dock">${computeInspectHtml(slots, inventory, activeCount, passiveIndex)}<div class="sortie-conditions">${buildSortiePreview()}${buildResidueRow()}</div></div></div>`;
  html += buildKeyHintBar(slots, inventory, activeCount, passiveIndex);

  renderPanelContent(panel, html, selectionOnly);
  if (revealSelection) scrollFocusedIntoView(panel);
  wireEvents(selectionOnly);
}

function buildKeyHintBar(
  slots: (Contaminant | null)[],
  inventory: Contaminant[],
  activeCount: number,
  passiveIndex: number,
): string {
  let contextAction = '';
  if (cursorRegion === 'slots' && slots[cursorSlot]) {
    contextAction = '<span><span class="key">Enter</span> 取下</span>';
  } else if (cursorRegion === 'inventory') {
    const c = inventory[cursorInv];
    if (c) {
      const type = getContaminantSlot(c) ?? 'active';
      if (tileHasCompatibleSlot(slots, activeCount, passiveIndex, type)) {
        contextAction = '<span><span class="key">Enter</span> 装填</span>';
      }
    }
  } else if (cursorRegion === 'actions') {
    contextAction = `<span><span class="key">Enter</span> ${cursorAction === 0 ? '踏入' : '离开'}</span>`;
  }
  return `<div class="key-hint-bar loadout-action-bar">
    <button type="button" id="loadout-confirm-btn" class="action-btn loadout-launch-action${cursorRegion === 'actions' && cursorAction === 0 ? ' is-selected' : ''}"><span class="key">Shift+Enter</span> 踏入裂隙</button>
    <span id="loadout-cancel-btn"><span class="key">Esc</span> 离开</span>
    <div class="loadout-navigation-hints"><span><span class="key">Tab</span> 切区</span><span><span class="key">↑↓←→</span> 浏览</span>${contextAction}</div>
  </div>`;
}

function inventoryEmptyHtml(): string {
  const hasTools = contaminantSystem.getSortieLoadout().some((c) => c !== null);
  const defenseCount = contaminantSystem.getAll().filter((c) => c.stage === 'defense').length;
  return `<div class="readout-empty"><div class="readout-section">${hasTools ? '工具已全部装填' : '尚无可用工具'}</div>
    <p class="readout-copy">${hasTools ? '已装填工具随本次出击携带。' : '残渣供奉后承受冲击，充能完成会转化为工具。'}</p>
    ${!hasTools && defenseCount > 0 ? `<p class="readout-note">现有 ${defenseCount} 件残渣，可在供奉台管理。</p>` : ''}
    <p class="readout-note">无需工具也可踏入裂隙。点击底部“踏入裂隙”或按 Shift+Enter 继续。</p></div>`;
}

function wireEvents(selectionOnly = false): void {
  if (!panel) return;

  panel.querySelector('#loadout-confirm-btn')?.addEventListener('click', confirmSortie);

  panel.querySelector('#loadout-cancel-btn')?.addEventListener('click', () => {
    loadoutPanel.close();
  });

  if (selectionOnly) return;

  // Remove from slot by clicking filled cell (mouse = equal-citizen shortcut for
  // the same action Enter performs on a keyboard-focused slot).
  panel.querySelectorAll('.loadout-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt((btn as HTMLElement).dataset.index!, 10);
      cursorRegion = 'slots';
      cursorSlot = index;
      contaminantSystem.unslotSortie(index);
      render();
    });
  });

  panel.querySelectorAll<HTMLElement>('.slot-cell[data-index]').forEach((el) => {
    el.addEventListener('pointermove', () => {
      const index = parseInt(el.dataset.index!, 10);
      if (Number.isNaN(index)) return;
      if (cursorRegion === 'slots' && cursorSlot === index) return;
      cursorRegion = 'slots';
      cursorSlot = index;
      render(true);
    });
  });

  // Equip tile: auto-assign to first compatible empty slot
  panel.querySelectorAll('.loadout-equip-tile').forEach((btn) => {
    const el = btn as HTMLElement;
    btn.addEventListener('click', () => {
      cursorRegion = 'inventory';
      cursorInv = Number(el.dataset.invIndex);
      if (el.classList.contains('tile-disabled')) {
        render(true);
        return;
      }
      const id = el.dataset.id!;
      const c = contaminantSystem.getAll().find((item) => item.id === id);
      if (c) equipTool(c, contaminantSystem.getSortieLoadout());
    });
    el.addEventListener('pointermove', () => {
      const idx = parseInt(el.dataset.invIndex!, 10);
      if (Number.isNaN(idx)) return;
      if (cursorRegion === 'inventory' && cursorInv === idx) return;
      cursorRegion = 'inventory';
      cursorInv = idx;
      render(true);
    });
  });

}

/** All launch inputs share one callback and close before invoking it. */
function confirmSortie(): void {
  if (!panel) return;
  saveManager.save();
  const cb = onConfirmCallback;
  destroyPanel();
  onConfirmCallback = null;
  onCloseCallback = null;
  cb?.();
}

function equipTool(c: Contaminant, currentSlots: (Contaminant | null)[]): void {
  const toolType = getContaminantSlot(c) ?? 'active';
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
    if (!c) return `<div class="readout-section">${getSlotLabel(target.index, passiveIndex)} 工具槽</div><p class="readout-copy">空槽。</p><p class="readout-note">${inventory.length > 0 ? "用 Tab 切到库存，选择相符的工具装填。" : "空槽不会阻止出击。"}</p>`;
    const label = getSlotLabel(target.index, passiveIndex);
    return buildToolInspectHtml(c, {
      slotState: 'slotted',
      hotkeyLabel: label === '被动' ? undefined : label,
      canEquip: true,
    });
  }

  const c = inventory[target.index];
  if (!c) return INSPECT_EMPTY_HTML;
  const toolType = getContaminantSlot(c) ?? 'active';
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

function buildResidueRow(): string {
  const pending = gameState.getPendingSideEffects();
  const parts = pending
    .map((e) => {
      const body = describeSideEffectBody(e);
      if (!body) return null;
      const src = e.source ? getDefenseName(e.source as Contaminant['type']) : '';
      return `<span class="stat-label">${body.split(' ')[0] ?? ''}</span>
        <span class="stat-value" style="color:#729887;">${body.includes('+') ? body.slice(body.indexOf('+')) : body}</span>
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

  return `<div class="readout-section">下次踏入</div><div class="stat-row"><span class="readout-label">自身完整度</span><span>${playerHp}</span></div>
    <div class="readout-metrics">
      <div class="readout-metric"><span class="readout-label">混乱增速</span><span>${formatChaosRateDelta(mods.chaosRateModifier)}</span></div>
      <div class="readout-metric"><span class="readout-label">薪柴价值</span><span>x${mods.kindlingValueModifier.toFixed(2)}</span></div>
      <div class="readout-metric"><span class="readout-label">起始混乱</span><span>${mods.startingChaos}</span></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSlotted(id: string): boolean {
  const slots = contaminantSystem.getSortieLoadout();
  return slots.some((c) => c?.id === id);
}
