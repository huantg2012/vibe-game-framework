/**
 * LoadoutPanel - DOM overlay for selecting sortie tools before entering the rift.
 *
 * Game-style layout: one slot cell per unlocked sortie slot (2 active + 1 passive
 * base, +1 active via growth_sortie_slot) at top, compact tile inventory below,
 * sortie attribute preview as stat bars, prominent action button.
 *
 * Slice 5.5 C3: keyboard cursor navigation (slots ↔ inventory ↔ actions) +
 * selected-即-检视 inspect dock, replacing the mouse-only / `title`-tooltip-only
 * interaction this panel had before (IA §0.4, U7).
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { getRarityStars, getToolName, sortContaminants } from '@/ui/contaminant-names';
import { buildToolInspectHtml, INSPECT_EMPTY_HTML } from './inspect-dock';
import type { Contaminant } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

// Rarity is "Degree not Kind": same contam color family, rising brightness
// (ui-art-overhaul.md A2) instead of unrelated hues per tier.
const RARITY_COLORS: Record<string, string> = {
  common: '#1a6b5c',
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
const ACTION_COUNT = 2; // 0 = 踏入 (confirm), 1 = …还是算了 (cancel)

let cursorRegion: CursorRegion = 'slots';
let cursorSlot = 0;
let cursorInv = 0;
let cursorAction = 0;
// Mouse hover is a secondary, non-persistent way to feed the inspect dock
// (IA §S13 "鼠标悬停填充同一区域（鼠标是二等公民，但不禁止）") — it never moves the
// keyboard cursor itself, only what the dock displays while the pointer is over it.
let hoverTarget: { kind: 'slot' | 'inventory'; index: number } | null = null;

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
    hoverTarget = null;
    createPanel();
  },

  close(): void {
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
  injectPanelStyles();

  panel = document.createElement('div');
  panel.id = 'loadout-panel';
  panel.className = 'game-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:0',
    'right:0',
    'height:640px',
    'width:440px',
    'z-index:1001',
    'display:flex',
    'flex-direction:column',
    'overflow-y:auto',
    'pointer-events:auto',
  ].join(';');

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
    hoverTarget = null;
    render();
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    moveCursor(dir, slots.length, inventory.length);
    hoverTarget = null;
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

  let html = `<div class="panel-title" style="color:#1aad96;">踏入裂隙</div>`;
  html += `<div style="flex:1;overflow-y:auto;">`;

  // Slot grid - one cell per unlocked sortie slot (active slots first, passive last;
  // column count follows slots.length so growth_sortie_slot's 4th slot doesn't wrap
  // into an uneven row, per the existing .slot-grid component in panel-styles.ts).
  html += `<div class="slot-grid" style="grid-template-columns:repeat(${slots.length},1fr);">`;
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    const label = getSlotLabel(i, passiveIndex);
    const selected = cursorRegion === 'slots' && cursorSlot === i;
    if (c) {
      const name = getToolName(c.type);
      const color = RARITY_COLORS[c.rarity];
      html += `<div class="slot-cell slot-filled loadout-remove-btn${selected ? ' slot-selected' : ''}" data-index="${i}" style="border-color:${color};">
        <span class="slot-label" style="color:#1aad96;">${label}</span>
        <span class="slot-name" style="color:${color};">${name}</span>
        <span class="slot-info">x${c.usesRemaining}</span>
      </div>`;
    } else {
      html += `<div class="slot-cell${selected ? ' slot-selected' : ''}" data-index="${i}">
        <span class="slot-label" style="color:#1aad96;">${label}</span>
        <span style="font-size:14px;color:#2a2d32;">+</span>
        <span class="slot-info">空</span>
      </div>`;
    }
  }
  html += `</div>`;

  // Inventory tiles
  html += `<div class="separator"></div>`;
  html += `<div style="font-size:13px;color:#8a8f96;margin-bottom:6px;">可用工具:</div>`;

  if (inventory.length === 0) {
    html += `<div style="font-size:13px;color:#2a2d32;text-align:center;padding:8px;">无可用工具</div>`;
  } else {
    html += `<div class="tile-grid">`;
    inventory.forEach((c, idx) => {
      const name = getToolName(c.type);
      const stars = getRarityStars(c.rarity);
      const color = RARITY_COLORS[c.rarity];
      const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
      const hasSlot = tileHasCompatibleSlot(slots, activeCount, passiveIndex, toolType);
      const selected = cursorRegion === 'inventory' && cursorInv === idx;
      html += `<div class="item-tile loadout-equip-tile${hasSlot ? '' : ' tile-disabled'}${selected ? ' tile-selected' : ''}" data-id="${c.id}" data-tool-type="${toolType}" data-inv-index="${idx}" style="border-color:${hasSlot ? color : '#2a2d32'};">
        <span style="color:${color};">${name}</span> <span style="color:#8a8f96;">${stars} x${c.usesRemaining}</span>
      </div>`;
    });
    html += `</div>`;
  }

  // Sortie attribute preview
  html += buildSortiePreview();

  // Inspect dock (选中即检视 — IA §S13 / ui-art-overhaul.md A5-13)
  html += `<div class="inspect-dock" id="loadout-inspect-dock">${computeInspectHtml(slots, inventory, activeCount, passiveIndex)}</div>`;

  html += `</div>`; // end flex:1 content wrapper

  // Action bar — reachable by keyboard too (cursorRegion === 'actions'), so
  // Enter can always confirm/cancel without a mouse (U7).
  const confirmFocused = cursorRegion === 'actions' && cursorAction === 0;
  const cancelFocused = cursorRegion === 'actions' && cursorAction === 1;
  html += `<div class="action-bar">
    <span id="loadout-confirm-btn" class="action-btn btn-primary${confirmFocused ? ' btn-focused' : ''}">踏入</span>
    <span id="loadout-cancel-btn" class="action-btn btn-muted${cancelFocused ? ' btn-focused' : ''}" style="cursor:pointer;">…还是算了</span>
  </div>`;

  panel.innerHTML = html;
  wireEvents(slots, inventory);
}

function wireEvents(slots: (Contaminant | null)[], inventory: Contaminant[]): void {
  if (!panel) return;

  // Remove from slot by clicking filled cell (mouse = equal-citizen shortcut for
  // the same action Enter performs on a keyboard-focused slot).
  panel.querySelectorAll('.loadout-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt((btn as HTMLElement).dataset.index!, 10);
      contaminantSystem.unslotSortie(index);
      render();
    });
    btn.addEventListener('mouseenter', () => {
      hoverTarget = { kind: 'slot', index: parseInt((btn as HTMLElement).dataset.index!, 10) };
      refreshInspectDock(slots, inventory);
    });
    btn.addEventListener('mouseleave', () => {
      hoverTarget = null;
      refreshInspectDock(slots, inventory);
    });
  });

  // Empty slot cells still feed the inspect dock on hover (nothing to equip there,
  // but keyboard cursor can also rest there so hover should behave consistently).
  panel.querySelectorAll('.slot-cell:not(.slot-filled)').forEach((cell) => {
    cell.addEventListener('mouseenter', () => {
      hoverTarget = { kind: 'slot', index: parseInt((cell as HTMLElement).dataset.index!, 10) };
      refreshInspectDock(slots, inventory);
    });
    cell.addEventListener('mouseleave', () => {
      hoverTarget = null;
      refreshInspectDock(slots, inventory);
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
    btn.addEventListener('mouseenter', () => {
      hoverTarget = { kind: 'inventory', index: parseInt(el.dataset.invIndex!, 10) };
      refreshInspectDock(slots, inventory);
    });
    btn.addEventListener('mouseleave', () => {
      hoverTarget = null;
      refreshInspectDock(slots, inventory);
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

function refreshInspectDock(slots: (Contaminant | null)[], inventory: Contaminant[]): void {
  const dock = panel?.querySelector('#loadout-inspect-dock');
  if (!dock) return;
  const passiveIndex = contaminantSystem.getSortiePassiveSlotIndex();
  const activeCount = contaminantSystem.getSortieActiveSlotCount();
  dock.innerHTML = computeInspectHtml(slots, inventory, activeCount, passiveIndex);
}

// ---------------------------------------------------------------------------
// Inspect dock content
// ---------------------------------------------------------------------------

function computeInspectHtml(
  slots: (Contaminant | null)[],
  inventory: Contaminant[],
  activeCount: number,
  passiveIndex: number,
): string {
  const target = hoverTarget
    ?? (cursorRegion === 'slots' ? { kind: 'slot' as const, index: cursorSlot }
      : cursorRegion === 'inventory' ? { kind: 'inventory' as const, index: cursorInv }
        : null);
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

function buildSortiePreview(): string {
  const baseHp = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
  const mods = growthSystem.getModifiers();

  const hpBonus = mods.vitalityBonus;
  const totalHp = baseHp + hpBonus;

  const coreEffect = gameState.getModuleEffect('CORE');
  const coreReduction = Math.round((1 - coreEffect) * 100);
  const growthReduction = Math.round(mods.chaosResist * 100);
  const totalChaosRate = Math.max(0, coreEffect - mods.chaosResist);

  const storageEffect = gameState.getModuleEffect('STORAGE');

  return `<div style="margin-top:8px;padding:6px 0;">
    <div class="separator"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;margin-top:6px;">
      <div>
        <div style="font-size:13px;color:#8a8f96;">完整度</div>
        <div style="font-size:16px;color:#c8cdd4;font-weight:bold;">${totalHp}</div>
        ${hpBonus > 0 ? `<div style="font-size:13px;color:#c8cdd4;">+${hpBonus}</div>` : ''}
      </div>
      <div>
        <div style="font-size:13px;color:#8a8f96;">混乱率</div>
        <div style="font-size:16px;color:#c8cdd4;font-weight:bold;">x${totalChaosRate.toFixed(2)}</div>
        ${(coreReduction + growthReduction) > 0 ? `<div style="font-size:13px;color:#c8cdd4;">-${coreReduction + growthReduction}%</div>` : ''}
      </div>
      <div>
        <div style="font-size:13px;color:#8a8f96;">薪柴值</div>
        <div style="font-size:16px;color:${storageEffect > 1 ? '#c4873a' : '#c8cdd4'};font-weight:bold;">x${storageEffect.toFixed(2)}</div>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSlotted(id: string): boolean {
  const slots = contaminantSystem.getSortieLoadout();
  return slots.some((c) => c?.id === id);
}
