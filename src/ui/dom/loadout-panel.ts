/**
 * LoadoutPanel - DOM overlay for selecting sortie tools before entering the rift.
 *
 * Game-style layout: one slot cell per unlocked sortie slot (2 active + 1 passive
 * base, +1 active via growth_sortie_slot) at top, compact tile inventory below,
 * sortie attribute preview as stat bars, prominent action button.
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { CONTAMINANT_DESCRIPTIONS } from '@/config/contaminant-descriptions';
import type { ContaminantType } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

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
  erode: '侵蚀',
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

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
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

  let html = `<div class="panel-title" style="color:#1aad96;">踏入裂隙</div>`;
  html += `<div style="flex:1;overflow-y:auto;">`;

  // Slot grid - one cell per unlocked sortie slot (active slots first, passive last;
  // column count follows slots.length so growth_sortie_slot's 4th slot doesn't wrap
  // into an uneven row, per the existing .slot-grid component in panel-styles.ts).
  const passiveIndex = contaminantSystem.getSortiePassiveSlotIndex();
  html += `<div class="slot-grid" style="grid-template-columns:repeat(${slots.length},1fr);">`;
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    const label = getSlotLabel(i, passiveIndex);
    if (c) {
      const name = TYPE_NAMES[c.type];
      const color = RARITY_COLORS[c.rarity];
      html += `<div class="slot-cell slot-filled loadout-remove-btn" data-index="${i}" style="border-color:${color};">
        <span class="slot-label" style="color:#1aad96;">${label}</span>
        <span class="slot-name" style="color:${color};">${name}</span>
        <span class="slot-info">x${c.usesRemaining}</span>
      </div>`;
    } else {
      html += `<div class="slot-cell" data-index="${i}">
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
    for (const c of inventory) {
      const name = TYPE_NAMES[c.type];
      const stars = RARITY_STARS[c.rarity];
      const color = RARITY_COLORS[c.rarity];
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.tool ?? '';
      const toolType = CONTAMINANT_DATA[c.type]?.toolType ?? 'active';
      // Check if there's a compatible empty slot (active tools -> any active slot,
      // passive tools -> the passive slot; both bounds are queried, never hardcoded).
      const activeCount = contaminantSystem.getSortieActiveSlotCount();
      const emptySlots = slots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
      const hasSlot = emptySlots.some((idx) =>
        toolType === 'passive' ? idx === passiveIndex : idx < activeCount,
      );
      html += `<div class="item-tile loadout-equip-tile${hasSlot ? '' : ' tile-disabled'}" data-id="${c.id}" data-tool-type="${toolType}" style="border-color:${hasSlot ? color : '#2a2d32'};" title="${desc}">
        <span style="color:${color};">${name}</span> <span style="color:#8a8f96;">${stars} x${c.usesRemaining}</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Sortie attribute preview
  html += buildSortiePreview();
  html += `</div>`; // end flex:1 content wrapper

  // Action bar
  html += `<div class="action-bar">
    <span id="loadout-confirm-btn" class="action-btn btn-primary">踏入</span>
    <span id="loadout-cancel-btn" class="action-btn btn-muted" style="cursor:pointer;">…还是算了</span>
  </div>`;

  panel.innerHTML = html;
  wireEvents();
}

function wireEvents(): void {
  if (!panel) return;

  // Remove from slot by clicking filled cell
  panel.querySelectorAll('.loadout-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt((btn as HTMLElement).dataset.index!, 10);
      contaminantSystem.unslotSortie(index);
      render();
    });
  });

  // Equip tile: auto-assign to first compatible empty slot
  panel.querySelectorAll('.loadout-equip-tile').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      if (el.classList.contains('tile-disabled')) return;
      const id = el.dataset.id!;
      const toolType = el.dataset.toolType as string;
      const currentSlots = contaminantSystem.getSortieLoadout();
      const activeCount = contaminantSystem.getSortieActiveSlotCount();
      const passiveIdx = contaminantSystem.getSortiePassiveSlotIndex();
      const emptySlots = currentSlots.map((s, idx) => s === null ? idx : -1).filter((x) => x >= 0);
      const target = emptySlots.find((idx) =>
        toolType === 'passive' ? idx === passiveIdx : idx < activeCount,
      );
      if (target !== undefined) {
        contaminantSystem.slotSortie(id, target);
        render();
      }
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
