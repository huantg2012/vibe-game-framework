/**
 * DefensePanel - DOM overlay for managing the 3 defense slots at the purification point.
 *
 * Displays currently slotted contaminants (name + rarity + impact charge progress),
 * inventory of defense-stage contaminants available for slotting, and unslot/equip controls.
 *
 * Follows the same DOM pattern as AllocationPanel (position:fixed, z-index, ESC to close).
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { saveManager } from '@/managers/save-manager';
import type { ContaminantType } from '@/types/game-types';
import { GAME_CONSTANTS } from '@/config/constants';

// ---------------------------------------------------------------------------
// Display name mapping
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<ContaminantType, string> = {
  solidify: '固化残渣',
  ruminate: '反刍残渣',
  scatter: '散射残渣',
  retrograde: '逆行残渣',
  delay: '延时残渣',
  siphon: '虹吸残渣',
  expand: '膨胀残渣',
  resonate: '共鸣残渣',
  overwrite: '覆写残渣',
  erode: '侵蛀残渣',
};

const RARITY_STARS: Record<string, string> = {
  common: '★',
  fine: '★★',
  rare: '★★★',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  fine: '#5599ff',
  rare: '#cc66ff',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

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
  panel = document.createElement('div');
  panel.id = 'defense-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:1001',
    'background:rgba(20,20,24,0.95)',
    'border:1px solid #444',
    'padding:20px',
    'min-width:320px',
    'max-width:400px',
    'font-family:monospace',
    'color:#ccc',
    'border-radius:4px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.8)',
  ].join(';');

  render();
  document.body.appendChild(panel);
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    defensePanel.close();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  if (!panel) return;

  const slots = contaminantSystem.getDefenseSlotted();
  const allContaminants = contaminantSystem.getAll();
  const inventory = allContaminants.filter(
    (c) => c.stage === 'defense' && !isSlotted(c.id),
  );

  const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;

  let html = `<div style="margin-bottom:14px;font-size:14px;color:#8866cc;font-weight:bold;">
    防御配置
  </div>`;

  // Slots
  for (let i = 0; i < 3; i++) {
    const c = slots[i];
    if (c) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 8px;background:#1a1a2e;border-radius:3px;">
        <span style="color:#888;min-width:48px;">Slot ${i + 1}:</span>
        <span style="color:${color};">${name} ${stars}</span>
        <span style="color:#666;font-size:10px;margin-left:4px;">${c.impactCharges}/${threshold}</span>
        <button class="defense-unslot-btn" data-index="${i}" style="${actionBtnStyle('#663333','#884444')}">卸下</button>
      </div>`;
    } else {
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 8px;background:#1a1a2e;border-radius:3px;">
        <span style="color:#888;min-width:48px;">Slot ${i + 1}:</span>
        <span style="color:#555;">空</span>
      </div>`;
    }
  }

  // Inventory
  html += `<div style="margin-top:14px;margin-bottom:8px;font-size:12px;color:#888;border-top:1px solid #333;padding-top:10px;">
    库存（可装备）：
  </div>`;

  if (inventory.length === 0) {
    html += `<div style="color:#555;font-size:11px;padding:4px 0;">无可用的防御污染物</div>`;
  } else {
    for (const c of inventory) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      // Show equip buttons for each empty slot
      const emptySlots = slots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
      const equipBtns = emptySlots
        .map((idx) => `<button class="defense-equip-btn" data-id="${c.id}" data-slot="${idx}" style="${actionBtnStyle('#2a4433','#3a6644')}">装备到 ${idx + 1}</button>`)
        .join(' ');

      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:4px 8px;background:#111118;border-radius:3px;flex-wrap:wrap;">
        <span style="color:${color};font-size:11px;">${name} ${stars}</span>
        ${equipBtns || '<span style="color:#555;font-size:10px;">已满</span>'}
      </div>`;
    }
  }

  // Close button
  html += `<div style="margin-top:14px;text-align:center;">
    <button id="defense-close-btn" style="${closeBtnStyle()}">关闭</button>
  </div>`;

  panel.innerHTML = html;
  wireEvents();
}

function wireEvents(): void {
  if (!panel) return;

  panel.querySelectorAll('.defense-unslot-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt((btn as HTMLElement).dataset.index!, 10);
      contaminantSystem.unslotDefense(index);
      saveManager.save();
      render();
    });
  });

  panel.querySelectorAll('.defense-equip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      const id = el.dataset.id!;
      const slot = parseInt(el.dataset.slot!, 10);
      contaminantSystem.slotDefense(id, slot);
      saveManager.save();
      render();
    });
  });

  panel.querySelector('#defense-close-btn')?.addEventListener('click', () => {
    defensePanel.close();
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSlotted(id: string): boolean {
  const slots = contaminantSystem.getDefenseSlotted();
  return slots.some((c) => c?.id === id);
}

function actionBtnStyle(bg: string, border: string): string {
  return [
    'padding:3px 8px',
    'font-size:10px',
    'font-family:monospace',
    `background:${bg}`,
    'color:#ccc',
    `border:1px solid ${border}`,
    'border-radius:3px',
    'cursor:pointer',
    'margin-left:auto',
  ].join(';');
}

function closeBtnStyle(): string {
  return [
    'padding:6px 20px',
    'font-size:12px',
    'font-family:monospace',
    'background:#333',
    'color:#ccc',
    'border:1px solid #555',
    'border-radius:3px',
    'cursor:pointer',
  ].join(';');
}
