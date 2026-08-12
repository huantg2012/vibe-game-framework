/**
 * DefensePanel - DOM overlay for managing the defense slots at the purification point.
 *
 * Game-style slot grid: one visual container cell per unlocked defense slot (3 base,
 * +1 via growth_defense_slot), dashed empty borders, equipped items displayed as
 * colored tiles within cells. Inventory shown as compact clickable tiles below.
 *
 * Slice 5.5 C3: keyboard cursor navigation (slots ↔ inventory ↔ actions) +
 * selected-即-检视 inspect dock, replacing the mouse-only / `title`-tooltip-only
 * interaction this panel had before (IA §0.4, U7).
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { saveManager } from '@/managers/save-manager';
import { GAME_CONSTANTS } from '@/config/constants';
import { getDefenseName, getRarityStars, sortContaminants } from '@/ui/contaminant-names';
import { buildDefenseInspectHtml, INSPECT_EMPTY_HTML } from './inspect-dock';
import type { Contaminant } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

// Rarity is "Degree not Kind": escalating contam brightness instead of unrelated hues
// per tier (ui-art-overhaul.md A2 maps common -> contam-mid #1a6b5c, but that value is
// ~3:1 against this panel's background — under the 4.5:1 text floor (A1) whenever it
// lands on name text rather than a border. Resolved per the "可读性优先" tie-break rule:
// common stays plain readable text (no color escalation earned yet), fine/rare use the
// two contam tones that do clear 4.5:1. Star count remains the redundant rarity signal
// at every tier (unaffected by this).
const RARITY_COLORS: Record<string, string> = {
  common: '#8a8f96',
  fine: '#1aad96',
  rare: '#3cffd4',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

// Keyboard cursor (IA §0.4 "键盘是第一公民"): three focus regions, cycled with Tab.
type CursorRegion = 'slots' | 'inventory' | 'actions';
const REGION_ORDER: CursorRegion[] = ['slots', 'inventory', 'actions'];
const ACTION_COUNT = 1; // 0 = 离开 (leave)

let cursorRegion: CursorRegion = 'slots';
let cursorSlot = 0;
let cursorInv = 0;
let cursorAction = 0;
// Mouse hover is a secondary, non-persistent way to feed the inspect dock — it
// never moves the keyboard cursor, only what the dock displays while hovered.
let hoverTarget: { kind: 'slot' | 'inventory'; index: number } | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const defensePanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(onClose?: () => void): void {
    if (panel) return;
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
  },
};

// ---------------------------------------------------------------------------
// Panel creation
// ---------------------------------------------------------------------------

function createPanel(): void {
  injectPanelStyles();

  panel = document.createElement('div');
  panel.id = 'defense-panel';
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
  backdrop.id = 'defense-backdrop';
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
  document.getElementById('defense-backdrop')?.remove();
}

// ---------------------------------------------------------------------------
// Keyboard cursor navigation
// ---------------------------------------------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    defensePanel.close();
    return;
  }

  const slots = contaminantSystem.getDefenseSlotted();
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
      contaminantSystem.unslotDefense(cursorSlot);
      saveManager.save();
      render();
    }
  } else if (cursorRegion === 'inventory') {
    const c = inventory[cursorInv];
    if (c) equipDefense(c, slots);
  } else if (cursorRegion === 'actions') {
    defensePanel.close();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function getInventory(): Contaminant[] {
  return sortContaminants(
    contaminantSystem.getAll().filter((c) => c.stage === 'defense' && !isSlotted(c.id)),
  );
}

function render(): void {
  if (!panel) return;

  const slots = contaminantSystem.getDefenseSlotted();
  const inventory = getInventory();
  clampCursor(slots.length, inventory.length);

  const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;

  // Defense stage = "charging/dormant" reading of the same substance the tool stage is
  // the "active" reading of — same contam-core tone as the loadout panel's title
  // (ui-art-overhaul.md A2's "no separate purple class"), not the darker contam-deep
  // tone: that fails the 4.5:1 text floor (A1), so it's reserved for the charge bar
  // fill below (a decorative fill, not text).
  let html = `<div class="panel-title" style="color:#1aad96;">供奉</div>`;
  html += `<div style="flex:1;overflow-y:auto;">`;

  // Slot grid - one visual container per unlocked defense slot (Slice 5 T5:
  // growth_defense_slot unlocks a 4th; column count follows slots.length so the
  // grid stays evenly divided instead of hardcoding 3).
  html += `<div class="slot-grid" style="grid-template-columns:repeat(${slots.length},1fr);">`;
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    const selected = cursorRegion === 'slots' && cursorSlot === i;
    if (c) {
      const name = getDefenseName(c.type);
      const stars = getRarityStars(c.rarity);
      const color = RARITY_COLORS[c.rarity];
      const chargePct = Math.round((c.impactCharges / threshold) * 100);
      html += `<div class="slot-cell slot-filled defense-unslot-btn${selected ? ' slot-selected' : ''}" data-index="${i}" style="border-color:${color};">
        <span class="slot-label">${i + 1}</span>
        <span class="slot-name" style="color:${color};">${name}</span>
        <span style="font-size:12px;color:${color};">${stars}</span>
        <div class="stat-bar" style="width:100%;margin-top:4px;">
          <div class="stat-bar-fill" style="width:${chargePct}%;background:#0e4a3f;"></div>
        </div>
        <span class="slot-info">${c.impactCharges}/${threshold}</span>
      </div>`;
    } else {
      html += `<div class="slot-cell${selected ? ' slot-selected' : ''}" data-index="${i}">
        <span class="slot-label">${i + 1}</span>
        <span style="font-size:14px;color:#2a2d32;">+</span>
        <span class="slot-info">空</span>
      </div>`;
    }
  }
  html += `</div>`;

  // Inventory tiles
  html += `<div class="separator"></div>`;
  html += `<div style="font-size:13px;color:#8a8f96;margin-bottom:6px;">可装备:</div>`;

  if (inventory.length === 0) {
    // C4 遗留修复: #2a2d32 是边框/装饰色，不是文字色（A1 对比度硬下限） — 曾在此处
    // 落在文字上，对比度约 1:1，不可读。
    html += `<div style="font-size:13px;color:#8a8f96;text-align:center;padding:8px;">无可用残渣</div>`;
  } else {
    html += `<div class="tile-grid">`;
    const canEquip = slots.some((s) => s === null);
    inventory.forEach((c, idx) => {
      const name = getDefenseName(c.type);
      const stars = getRarityStars(c.rarity);
      const color = RARITY_COLORS[c.rarity];
      const selected = cursorRegion === 'inventory' && cursorInv === idx;
      html += `<div class="item-tile defense-equip-tile${canEquip ? '' : ' tile-disabled'}${selected ? ' tile-selected' : ''}" data-id="${c.id}" data-inv-index="${idx}" style="border-color:${canEquip ? color : '#2a2d32'};">
        <span style="color:${color};">${name}</span> <span style="color:#8a8f96;">${stars}</span>
      </div>`;
    });
    html += `</div>`;
  }

  // Inspect dock (选中即检视 — IA §S13 / ui-art-overhaul.md A5-13)
  html += `<div class="inspect-dock" id="defense-inspect-dock">${computeInspectHtml(slots, inventory, threshold)}</div>`;

  // Close button
  html += `</div>`; // end flex:1 content wrapper
  const leaveFocused = cursorRegion === 'actions';
  html += `<div class="action-bar">
    <span id="defense-close-btn" class="action-btn btn-muted${leaveFocused ? ' btn-focused' : ''}" style="cursor:pointer;">离开</span>
  </div>`;
  html += `<div class="key-hint-bar"><span class="key">Tab</span> 切区 · <span class="key">↑↓←→</span> 移动 · <span class="key">Enter</span> 装填/取下 · <span class="key">Esc</span> 离开</div>`;

  panel.innerHTML = html;
  wireEvents(slots, inventory);
}

function wireEvents(slots: (Contaminant | null)[], inventory: Contaminant[]): void {
  if (!panel) return;

  panel.querySelector('#defense-close-btn')?.addEventListener('click', () => {
    defensePanel.close();
  });

  // Unslot by clicking filled slots (mouse = equal-citizen shortcut for the same
  // action Enter performs on a keyboard-focused slot).
  panel.querySelectorAll('.defense-unslot-btn').forEach((btn) => {
    const el = btn as HTMLElement;
    btn.addEventListener('click', () => {
      const index = parseInt(el.dataset.index!, 10);
      contaminantSystem.unslotDefense(index);
      saveManager.save();
      render();
    });
    btn.addEventListener('mouseenter', () => {
      hoverTarget = { kind: 'slot', index: parseInt(el.dataset.index!, 10) };
      refreshInspectDock(slots, inventory);
    });
    btn.addEventListener('mouseleave', () => {
      hoverTarget = null;
      refreshInspectDock(slots, inventory);
    });
  });

  // Empty slot cells still feed the inspect dock on hover.
  panel.querySelectorAll('.slot-cell:not(.slot-filled)').forEach((cell) => {
    const el = cell as HTMLElement;
    cell.addEventListener('mouseenter', () => {
      hoverTarget = { kind: 'slot', index: parseInt(el.dataset.index!, 10) };
      refreshInspectDock(slots, inventory);
    });
    cell.addEventListener('mouseleave', () => {
      hoverTarget = null;
      refreshInspectDock(slots, inventory);
    });
  });

  // Equip by clicking inventory tiles (auto-assign to first empty slot)
  panel.querySelectorAll('.defense-equip-tile').forEach((btn) => {
    const el = btn as HTMLElement;
    btn.addEventListener('click', () => {
      if (el.classList.contains('tile-disabled')) return;
      const id = el.dataset.id!;
      const c = contaminantSystem.getAll().find((item) => item.id === id);
      if (c) equipDefense(c, contaminantSystem.getDefenseSlotted());
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
}

function equipDefense(c: Contaminant, currentSlots: (Contaminant | null)[]): void {
  const firstEmpty = currentSlots.findIndex((s) => s === null);
  if (firstEmpty >= 0) {
    contaminantSystem.slotDefense(c.id, firstEmpty);
    saveManager.save();
    render();
  }
}

function refreshInspectDock(slots: (Contaminant | null)[], inventory: Contaminant[]): void {
  const dock = panel?.querySelector('#defense-inspect-dock');
  if (!dock) return;
  const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;
  dock.innerHTML = computeInspectHtml(slots, inventory, threshold);
}

// ---------------------------------------------------------------------------
// Inspect dock content
// ---------------------------------------------------------------------------

function computeInspectHtml(
  slots: (Contaminant | null)[],
  inventory: Contaminant[],
  threshold: number,
): string {
  const target = hoverTarget
    ?? (cursorRegion === 'slots' ? { kind: 'slot' as const, index: cursorSlot }
      : cursorRegion === 'inventory' ? { kind: 'inventory' as const, index: cursorInv }
        : null);
  if (!target) return INSPECT_EMPTY_HTML;

  if (target.kind === 'slot') {
    const c = slots[target.index];
    if (!c) return INSPECT_EMPTY_HTML;
    return buildDefenseInspectHtml(c, { chargeThreshold: threshold, slotState: 'slotted', canEquip: true });
  }

  const c = inventory[target.index];
  if (!c) return INSPECT_EMPTY_HTML;
  const canEquip = slots.some((s) => s === null);
  return buildDefenseInspectHtml(c, { chargeThreshold: threshold, slotState: 'unslotted', canEquip });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSlotted(id: string): boolean {
  const slots = contaminantSystem.getDefenseSlotted();
  return slots.some((c) => c?.id === id);
}
