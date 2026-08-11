/**
 * LoadoutPanel - DOM overlay for selecting sortie tools before entering the rift.
 *
 * Terminal-style UI: clickable text rows, CRT scanline background.
 * Uses shared panel-styles.
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { CONTAMINANT_DESCRIPTIONS } from '@/config/contaminant-descriptions';
import type { ContaminantType } from '@/types/game-types';
import { injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Display name mapping
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<ContaminantType, string> = {
  solidify: '凝锁',
  ruminate: '反刍',
  scatter: '散射',
  retrograde: '逆行',
  delay: '时裂',
  siphon: '虹吸',
  expand: '膨胀',
  resonate: '共鸣',
  overwrite: '覆写',
  erode: '侵蚀领域',
  muffle: '消声',
  kindle: '燃素',
  stitch: '缝合',
  compress: '重力锚',
  mirror: '镜像',
  echo: '回响',
  abyss: '深渊',
  combust: '焚天',
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

const SLOT_LABELS = ['Q', 'F', '被动'];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onConfirmCallback: (() => void) | null = null;
let onCloseCallback: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const loadoutPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  /**
   * Open the loadout panel.
   * @param onConfirm Called when player clicks "sortie!" - triggers rift entry.
   * @param onClose Called when panel is closed without confirming (cancel/ESC).
   */
  open(onConfirm: () => void, onClose?: () => void): void {
    if (panel) return;
    onConfirmCallback = onConfirm;
    onCloseCallback = onClose ?? null;
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
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:1001',
    'min-width:340px',
    'max-width:420px',
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
    loadoutPanel.close();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  if (!panel) return;

  const slots = contaminantSystem.getSortieLoadout();
  const allContaminants = contaminantSystem.getAll();
  const inventory = allContaminants.filter(
    (c) => c.stage === 'tool' && !isSlotted(c.id),
  );

  let html = `<div class="panel-title" style="color:#1aad96;">出击装备</div>`;

  // Slots
  for (let i = 0; i < 3; i++) {
    const c = slots[i];
    const label = SLOT_LABELS[i];
    if (c) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.tool ?? '';
      html += `<div class="panel-section">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#1aad96;min-width:50px;font-size:11px;">(${label})</span>
          <span style="color:${color};">${name} ${stars}</span>
          <span style="color:#8a8f96;font-size:10px;">x${c.usesRemaining}</span>
        </div>
        <div style="font-size:9px;color:#5a5f66;margin-top:3px;padding-left:58px;">${desc}</div>
        <div class="option loadout-remove-btn" data-index="${i}" style="margin-top:4px;padding-left:58px;">▸ 移除</div>
      </div>`;
    } else {
      html += `<div class="panel-section">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#1aad96;min-width:50px;font-size:11px;">(${label})</span>
          <span style="color:#5a5f66;">空</span>
        </div>
      </div>`;
    }
  }

  // Inventory
  html += `<div class="separator"></div>`;
  html += `<div class="info-line" style="margin-bottom:6px;">可用工具：</div>`;

  if (inventory.length === 0) {
    html += `<div class="info-line" style="color:#5a5f66;">无可用的出击工具</div>`;
  } else {
    for (const c of inventory) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.tool ?? '';
      // Determine tool type (active or passive)
      const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
      // Show equip options only for compatible empty slots
      const emptySlots = slots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
      const compatibleSlots = emptySlots.filter((idx) =>
        toolType === 'passive' ? idx === 2 : idx <= 1,
      );
      const equipOptions = compatibleSlots
        .map((idx) => `<div class="option loadout-equip-btn" data-id="${c.id}" data-slot="${idx}">▸ 装备到 ${SLOT_LABELS[idx]}</div>`)
        .join('');

      html += `<div class="panel-section">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:${color};font-size:11px;">${name} ${stars} x${c.usesRemaining}</span>
          ${compatibleSlots.length === 0 ? '<span style="color:#5a5f66;font-size:10px;">已满</span>' : ''}
        </div>
        <div style="font-size:9px;color:#5a5f66;margin-top:2px;">${desc}</div>
        ${equipOptions}
      </div>`;
    }
  }

  // Sortie attribute preview (A5)
  html += buildSortiePreview();

  // Confirm and Cancel
  html += `<div class="separator"></div>`;
  html += `<div id="loadout-confirm-btn" class="option" style="color:#1aad96;font-weight:bold;">▸ 出击</div>`;
  html += `<div id="loadout-cancel-btn" class="option">▸ 取消</div>`;

  panel.innerHTML = html;
  wireEvents();
}

function wireEvents(): void {
  if (!panel) return;

  panel.querySelectorAll('.loadout-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt((btn as HTMLElement).dataset.index!, 10);
      contaminantSystem.unslotSortie(index);
      render();
    });
  });

  panel.querySelectorAll('.loadout-equip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      const id = el.dataset.id!;
      const slot = parseInt(el.dataset.slot!, 10);
      // Validate slot-type compatibility before equipping
      const allContaminants = contaminantSystem.getAll();
      const c = allContaminants.find((x) => x.id === id);
      if (c) {
        const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
        const slotValid = toolType === 'passive' ? slot === 2 : slot <= 1;
        if (!slotValid) return;
      }
      contaminantSystem.slotSortie(id, slot);
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

// ---------------------------------------------------------------------------
// Sortie preview
// ---------------------------------------------------------------------------

function buildSortiePreview(): string {
  const baseHp = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
  const mods = growthSystem.getModifiers();

  // HP
  const hpBonus = mods.vitalityBonus;
  const totalHp = baseHp + hpBonus;
  const hpDetail = hpBonus > 0 ? ` (基础${baseHp} + 改造${hpBonus})` : '';

  // Chaos rate modifier: barrier module + growth
  const barrierEffect = gameState.getModuleEffect('BARRIER'); // e.g. 0.82
  const barrierReduction = Math.round((1 - barrierEffect) * 100); // e.g. 18
  const growthReduction = Math.round(mods.chaosResist * 100); // e.g. 12
  const totalChaosRate = Math.max(0, barrierEffect - mods.chaosResist);
  const chaosDetails: string[] = [];
  if (barrierReduction > 0) chaosDetails.push(`屏障-${barrierReduction}%`);
  if (growthReduction > 0) chaosDetails.push(`改造-${growthReduction}%`);
  const chaosDetail = chaosDetails.length > 0 ? ` (${chaosDetails.join(' + ')})` : '';

  // Kindling value modifier: storage module
  const storageEffect = gameState.getModuleEffect('STORAGE'); // e.g. 1.35
  const storageBonus = Math.round((storageEffect - 1) * 100);
  const kindlingDetail = storageBonus > 0 ? ` (储藏+${storageBonus}%)` : '';

  return `<div style="margin-top:10px;padding:8px;background:#151a1e;border-left:3px solid #1aad96;">
    <div style="font-size:11px;color:#1aad96;margin-bottom:6px;font-weight:bold;">本次出击:</div>
    <div class="info-line" style="line-height:1.7;">
      完整度上限: <span style="color:#c8cdd4;">${totalHp}</span>${hpDetail}<br>
      混乱增速: <span style="color:#c8cdd4;">x${totalChaosRate.toFixed(2)}</span>${chaosDetail}<br>
      薪柴价值: <span style="color:#c8cdd4;">x${storageEffect.toFixed(2)}</span>${kindlingDetail}
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
