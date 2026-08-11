/**
 * AllocationPanel - DOM overlay for allocating kindling to a module.
 *
 * Terminal-style UI: no buttons, only clickable text rows with hover highlight
 * and CRT scanline background. Uses shared panel-styles.
 */

import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import type { ModuleType } from '@/managers/game-state';
import { GameEvent } from '@/types/events';
import { GAME_CONSTANTS } from '@/config/constants';
import { injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let currentModuleId: string | null = null;
let selectedAmount = 0;
let onCloseCallback: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const allocationPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(moduleId: string, onClose?: () => void): void {
    if (panel) return; // already open
    currentModuleId = moduleId;
    selectedAmount = 0;
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
  const mod = gameState.getModule(currentModuleId!);
  if (!mod) return;

  injectPanelStyles();

  panel = document.createElement('div');
  panel.id = 'allocation-panel';
  panel.className = 'game-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:1000',
    'min-width:280px',
  ].join(';');

  render(mod.type, mod.hp, mod.maxHp);
  document.body.appendChild(panel);

  // ESC to close
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
  currentModuleId = null;
  selectedAmount = 0;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    allocationPanel.close();
  }
}

// ---------------------------------------------------------------------------
// Effect helpers
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

function computeEffectText(type: ModuleType, hp: number): string {
  if (type === 'BARRIER') {
    const pct = Math.round((hp / 100) * P.MAX_BARRIER_REDUCTION * 100);
    return `混乱增速 -${pct}%`;
  }
  const mult = (1 + (hp / 100) * P.MAX_STORAGE_BONUS).toFixed(2);
  return `拾取价值 x${mult}`;
}

function computeEffectDiff(type: ModuleType, currentHp: number, repairedHp: number): string {
  if (repairedHp <= currentHp) return '';
  if (type === 'BARRIER') {
    const currentPct = Math.round((currentHp / 100) * P.MAX_BARRIER_REDUCTION * 100);
    const repairedPct = Math.round((repairedHp / 100) * P.MAX_BARRIER_REDUCTION * 100);
    const diff = repairedPct - currentPct;
    return diff > 0 ? `(+${diff}%)` : '';
  }
  const currentMult = 1 + (currentHp / 100) * P.MAX_STORAGE_BONUS;
  const repairedMult = 1 + (repairedHp / 100) * P.MAX_STORAGE_BONUS;
  const diff = repairedMult - currentMult;
  return diff > 0.001 ? `(+${diff.toFixed(2)})` : '';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(type: ModuleType, hp: number, maxHp: number): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();
  const repairPer = GAME_CONSTANTS.PURIFICATION.REPAIR_PER_KINDLING;
  const maxUseful = Math.ceil((maxHp - hp) / repairPer);
  const maxAllocatable = Math.min(reserve, maxUseful);

  const typeLabel = type === 'BARRIER' ? '屏障 (混乱抑制)' : '储藏 (薪柴增幅)';
  const typeColor = type === 'BARRIER' ? '#4d9a6b' : '#c4873a';

  // --- Effect preview calculations ---
  const currentEffectText = computeEffectText(type, hp);
  const repairedHp = Math.min(hp + selectedAmount * repairPer, maxHp);
  const repairedEffectText = computeEffectText(type, repairedHp);
  const diffText = computeEffectDiff(type, hp, repairedHp);
  const showRepaired = selectedAmount > 0;

  const repairedColor = type === 'BARRIER' ? '#4d9a6b' : '#c4873a';

  const minusDisabled = selectedAmount <= 0;
  const plusDisabled = selectedAmount >= maxAllocatable;
  const confirmDisabled = selectedAmount <= 0;

  panel.innerHTML = `
    <div class="panel-title" style="color:${typeColor};">
      ${typeLabel}
    </div>
    <div class="info-line">
      完整度: <span style="color:#c8cdd4;">${hp}</span> / ${maxHp}
    </div>
    <div class="separator"></div>
    <div class="info-line" style="color:${typeColor};">
      当前效果: ${currentEffectText}
    </div>
    ${showRepaired ? `<div class="info-line" style="color:${repairedColor};">
      修复后: ${repairedEffectText} <span style="color:#4d9a6b;">${diffText}</span>
    </div>` : ''}
    <div class="separator"></div>
    <div class="info-line">
      可用薪柴: <span style="color:#c4873a;">${reserve}</span>
    </div>
    <div class="info-line" style="font-size:9px;color:#5a5f66;">
      1 薪柴 = ${repairPer} 完整度
    </div>
    <div style="padding:8px;margin:8px 0;display:flex;align-items:center;gap:12px;">
      <span id="alloc-minus" class="option ${minusDisabled ? 'disabled' : ''}" style="display:inline-block;padding:2px 6px;">◂</span>
      <span style="font-size:14px;color:#c8cdd4;min-width:30px;text-align:center;">${selectedAmount}</span>
      <span id="alloc-plus" class="option ${plusDisabled ? 'disabled' : ''}" style="display:inline-block;padding:2px 6px;">▸</span>
      <span style="font-size:9px;color:#8a8f96;margin-left:4px;">
        (+${selectedAmount * repairPer} 完整度)
      </span>
    </div>
    <div class="separator"></div>
    <div id="alloc-confirm" class="option ${confirmDisabled ? 'disabled' : ''}" style="color:${confirmDisabled ? '#3a3f44' : '#c8cdd4'};">
      ▸ 确认分配
    </div>
    <div id="alloc-cancel" class="option">
      ▸ 取消
    </div>
  `;

  // Wire up event listeners
  panel.querySelector('#alloc-minus')?.addEventListener('click', () => {
    if (selectedAmount > 0) {
      selectedAmount--;
      rerender();
    }
  });

  panel.querySelector('#alloc-plus')?.addEventListener('click', () => {
    if (selectedAmount < maxAllocatable) {
      selectedAmount++;
      rerender();
    }
  });

  panel.querySelector('#alloc-confirm')?.addEventListener('click', () => {
    if (selectedAmount > 0 && currentModuleId) {
      const spent = gameState.allocateToModule(currentModuleId, selectedAmount);
      if (spent > 0) {
        eventBus.emit(GameEvent.ALLOCATION_CONFIRMED, {
          allocations: { [currentModuleId]: spent },
        });
      }
      allocationPanel.close();
    }
  });

  panel.querySelector('#alloc-cancel')?.addEventListener('click', () => {
    allocationPanel.close();
  });
}

function rerender(): void {
  if (!panel || !currentModuleId) return;
  const mod = gameState.getModule(currentModuleId);
  if (!mod) return;
  render(mod.type, mod.hp, mod.maxHp);
}
