/**
 * DefensePanel - DOM overlay for managing the defense slots at the purification point.
 *
 * Game-style slot grid: one visual container cell per unlocked defense slot (3 base,
 * +1 via growth_defense_slot), dashed empty borders, equipped items displayed as
 * colored tiles within cells. Inventory shown as compact clickable tiles below.
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { saveManager } from '@/managers/save-manager';
import type { ContaminantType } from '@/types/game-types';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DESCRIPTIONS } from '@/config/contaminant-descriptions';
import { injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Display name mapping
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<ContaminantType, string> = {
  solidify: '固化',
  ruminate: '反刍',
  scatter: '散射',
  retrograde: '逆行',
  delay: '延时',
  siphon: '虹吸',
  expand: '膨胀',
  resonate: '共鸣',
  overwrite: '覆写',
  erode: '侵蛀',
  muffle: '消声',
  kindle: '燃尽',
  stitch: '缝合',
  compress: '致密',
  mirror: '镜映',
  echo: '回响',
  abyss: '深渊',
  combust: '灰烬',
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
  injectPanelStyles();

  panel = document.createElement('div');
  panel.id = 'defense-panel';
  panel.className = 'game-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:0',
    'right:0',
    'height:100vh',
    'width:440px',
    'z-index:1001',
    'display:flex',
    'flex-direction:column',
    'overflow-y:auto',
  ].join(';');

  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'defense-backdrop';
  document.body.appendChild(backdrop);

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
  document.getElementById('defense-backdrop')?.remove();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
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

  let html = `<div class="panel-title" style="color:#6644aa;">供奉</div>`;
  html += `<div style="flex:1;overflow-y:auto;">`;

  // Slot grid - one visual container per unlocked defense slot (Slice 5 T5:
  // growth_defense_slot unlocks a 4th; column count follows slots.length so the
  // grid stays evenly divided instead of hardcoding 3).
  html += `<div class="slot-grid" style="grid-template-columns:repeat(${slots.length},1fr);">`;
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    if (c) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      const chargePct = Math.round((c.impactCharges / threshold) * 100);
      html += `<div class="slot-cell slot-filled defense-unslot-btn" data-index="${i}" style="border-color:${color};">
        <span class="slot-label">${i + 1}</span>
        <span class="slot-name" style="color:${color};">${name}</span>
        <span style="font-size:12px;color:${color};">${stars}</span>
        <div class="stat-bar" style="width:100%;margin-top:4px;">
          <div class="stat-bar-fill" style="width:${chargePct}%;background:#6644aa;"></div>
        </div>
        <span class="slot-info">${c.impactCharges}/${threshold}</span>
      </div>`;
    } else {
      html += `<div class="slot-cell" data-index="${i}">
        <span class="slot-label">${i + 1}</span>
        <span style="font-size:14px;color:#2a2d32;">+</span>
        <span class="slot-info">空</span>
      </div>`;
    }
  }
  html += `</div>`;

  // Inventory tiles
  html += `<div class="separator"></div>`;
  html += `<div style="font-size:13px;color:#5a5f66;margin-bottom:6px;">可装备:</div>`;

  if (inventory.length === 0) {
    html += `<div style="font-size:13px;color:#2a2d32;text-align:center;padding:8px;">无可用残渣</div>`;
  } else {
    html += `<div class="tile-grid">`;
    const emptySlots = slots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
    for (const c of inventory) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.defense ?? '';
      const canEquip = emptySlots.length > 0;
      html += `<div class="item-tile defense-equip-tile${canEquip ? '' : ' tile-disabled'}" data-id="${c.id}" style="border-color:${canEquip ? color : '#2a2d32'};" title="${desc}">
        <span style="color:${color};">${name}</span> <span style="color:#5a5f66;">${stars}</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Close button
  html += `</div>`; // end flex:1 content wrapper
  html += `<div class="action-bar">
    <span id="defense-close-btn" class="action-btn btn-muted" style="cursor:pointer;">离开</span>
  </div>`;
  html += `<div style="font-size:12px;color:#5a5f66;text-align:center;margin-top:4px;">点击以取下</div>`;

  panel.innerHTML = html;
  wireEvents();
}

function wireEvents(): void {
  if (!panel) return;

  panel.querySelector('#defense-close-btn')?.addEventListener('click', () => {
    defensePanel.close();
  });

  // Unslot by clicking filled slots
  panel.querySelectorAll('.defense-unslot-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt((btn as HTMLElement).dataset.index!, 10);
      contaminantSystem.unslotDefense(index);
      saveManager.save();
      render();
    });
  });

  // Equip by clicking inventory tiles (auto-assign to first empty slot)
  panel.querySelectorAll('.defense-equip-tile').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      if (el.classList.contains('tile-disabled')) return;
      const id = el.dataset.id!;
      const slots = contaminantSystem.getDefenseSlotted();
      const firstEmpty = slots.findIndex((s) => s === null);
      if (firstEmpty >= 0) {
        contaminantSystem.slotDefense(id, firstEmpty);
        saveManager.save();
        render();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSlotted(id: string): boolean {
  const slots = contaminantSystem.getDefenseSlotted();
  return slots.some((c) => c?.id === id);
}
