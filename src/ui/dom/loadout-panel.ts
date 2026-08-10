/**
 * LoadoutPanel - DOM overlay for selecting sortie tools before entering the rift.
 *
 * Shows 3 sortie slots (Q/F/Passive), tool inventory, and confirm/cancel controls.
 * On confirm, invokes a callback that triggers the sortie flow + scene transition.
 *
 * Follows the same DOM pattern as AllocationPanel (position:fixed, z-index, ESC to close).
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DESCRIPTIONS } from '@/config/contaminant-descriptions';
import type { ContaminantType } from '@/types/game-types';

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
  panel = document.createElement('div');
  panel.id = 'loadout-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:1001',
    'background:rgba(20,20,24,0.95)',
    'border:1px solid #444',
    'padding:20px',
    'min-width:340px',
    'max-width:420px',
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

  let html = `<div style="margin-bottom:14px;font-size:14px;color:#1aad96;font-weight:bold;">
    出击装备
  </div>`;

  // Slots
  for (let i = 0; i < 3; i++) {
    const c = slots[i];
    const label = SLOT_LABELS[i];
    if (c) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.tool ?? '';
      html += `<div style="margin-bottom:8px;padding:6px 8px;background:#1a1a2e;border-radius:3px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#1aad96;min-width:50px;font-size:11px;">(${label})</span>
          <span style="color:${color};">${name} ${stars}</span>
          <span style="color:#888;font-size:10px;">x${c.usesRemaining}</span>
          <button class="loadout-remove-btn" data-index="${i}" style="${actionBtnStyle('#663333','#884444')}">移除</button>
        </div>
        <div style="font-size:10px;color:#666;margin-top:3px;padding-left:58px;">${desc}</div>
      </div>`;
    } else {
      html += `<div style="margin-bottom:8px;padding:6px 8px;background:#1a1a2e;border-radius:3px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#1aad96;min-width:50px;font-size:11px;">(${label})</span>
          <span style="color:#555;">空</span>
        </div>
      </div>`;
    }
  }

  // Inventory
  html += `<div style="margin-top:14px;margin-bottom:8px;font-size:12px;color:#888;border-top:1px solid #333;padding-top:10px;">
    可用工具：
  </div>`;

  if (inventory.length === 0) {
    html += `<div style="color:#555;font-size:11px;padding:4px 0;">无可用的出击工具</div>`;
  } else {
    for (const c of inventory) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.tool ?? '';
      // Show equip buttons for each empty slot
      const emptySlots = slots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
      const equipBtns = emptySlots
        .map((idx) => `<button class="loadout-equip-btn" data-id="${c.id}" data-slot="${idx}" style="${actionBtnStyle('#1a3333','#2a5555')}">装备到 ${idx + 1}</button>`)
        .join(' ');

      html += `<div style="margin-bottom:6px;padding:4px 8px;background:#111118;border-radius:3px;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="color:${color};font-size:11px;">${name} ${stars} x${c.usesRemaining}</span>
          ${equipBtns || '<span style="color:#555;font-size:10px;">已满</span>'}
        </div>
        <div style="font-size:10px;color:#666;margin-top:2px;">${desc}</div>
      </div>`;
    }
  }

  // Sortie attribute preview (A5)
  html += buildSortiePreview();

  // Confirm and Cancel
  html += `<div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
    <button id="loadout-confirm-btn" style="${confirmBtnStyle()}">出击</button>
    <button id="loadout-cancel-btn" style="${cancelBtnStyle()}">取消</button>
  </div>`;

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

  return `<div style="margin-top:14px;padding:10px;background:#111118;border-radius:4px;border-left:3px solid #1aad96;">
    <div style="font-size:11px;color:#1aad96;margin-bottom:6px;font-weight:bold;">本次出击:</div>
    <div style="font-size:11px;color:#aaa;line-height:1.7;">
      完整度上限: <span style="color:#fff;">${totalHp}</span>${hpDetail}<br>
      混乱增速: <span style="color:#fff;">x${totalChaosRate.toFixed(2)}</span>${chaosDetail}<br>
      薪柴价值: <span style="color:#fff;">x${storageEffect.toFixed(2)}</span>${kindlingDetail}
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

function confirmBtnStyle(): string {
  return [
    'padding:8px 24px',
    'font-size:13px',
    'font-family:monospace',
    'background:#1a5544',
    'color:#2ae6c8',
    'border:1px solid #2a8866',
    'border-radius:3px',
    'cursor:pointer',
    'font-weight:bold',
  ].join(';');
}

function cancelBtnStyle(): string {
  return [
    'padding:8px 20px',
    'font-size:12px',
    'font-family:monospace',
    'background:#333',
    'color:#ccc',
    'border:1px solid #555',
    'border-radius:3px',
    'cursor:pointer',
  ].join(';');
}
