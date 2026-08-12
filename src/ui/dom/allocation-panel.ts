/**
 * AllocationPanel - DOM overlay for allocating kindling to a module.
 *
 * Game-style layout: visual progress bar for module HP, preview fill for
 * allocation amount, compact +/- bar controls, inline confirm.
 */

import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import type { ModuleType } from '@/managers/game-state';
import { GameEvent } from '@/types/events';
import { GAME_CONSTANTS } from '@/config/constants';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

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
    'top:0',
    'right:0',
    'height:640px',
    'width:440px',
    'z-index:1000',
    'display:flex',
    'flex-direction:column',
    'overflow-y:auto',
    'pointer-events:auto',
  ].join(';');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'allocation-backdrop';
  root.appendChild(backdrop);

  render(mod.type, mod.hp, mod.maxHp);
  root.appendChild(panel);

  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('allocation-backdrop')?.remove();
  currentModuleId = null;
  selectedAmount = 0;
}

// Direct amount adjustment (IA §S3 交互契约: ←→ ±1 / Shift+←→ ±5 / Home 归零 /
// End 拉满 / Enter 注入 / Esc 离开). There is no list of selectable options here —
// the amount itself is the thing keyboard input drives, so no cursor/"已选中"
// state is needed (this satisfies "键盘可达" without a button-focus model).
function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    allocationPanel.close();
    return;
  }

  const mod = currentModuleId ? gameState.getModule(currentModuleId) : null;
  if (!mod) return;
  const maxAllocatable = getMaxAllocatable(mod.hp, mod.maxHp);

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    selectedAmount = Math.max(0, Math.min(maxAllocatable, selectedAmount + dir * step));
    rerender();
    return;
  }

  if (e.key === 'Home') {
    e.stopPropagation();
    e.preventDefault();
    selectedAmount = 0;
    rerender();
    return;
  }

  if (e.key === 'End') {
    e.stopPropagation();
    e.preventDefault();
    selectedAmount = maxAllocatable;
    rerender();
    return;
  }

  if (e.key === 'Enter') {
    e.stopPropagation();
    e.preventDefault();
    confirmAllocation();
  }
}

function confirmAllocation(): void {
  if (selectedAmount > 0 && currentModuleId) {
    const spent = gameState.allocateToModule(currentModuleId, selectedAmount);
    if (spent > 0) {
      eventBus.emit(GameEvent.ALLOCATION_CONFIRMED, {
        allocations: { [currentModuleId]: spent },
      });
    }
    allocationPanel.close();
  }
}

// ---------------------------------------------------------------------------
// Effect helpers
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

function computeEffectText(type: ModuleType, hp: number): string {
  if (type === 'CORE') {
    const pct = Math.round((hp / 100) * P.MAX_CORE_REDUCTION * 100);
    return `混乱增速 -${pct}%`;
  }
  const mult = (1 + (hp / 100) * P.MAX_STORAGE_BONUS).toFixed(2);
  return `薪柴价值 x${mult}`;
}

/** Shared by render() (for +/- boundary state) and onKeyDown() (for the keyboard
 *  amount adjustment), so the two never compute the ceiling differently. */
function getMaxAllocatable(hp: number, maxHp: number): number {
  const reserve = gameState.getKindlingReserve();
  const repairPer = gameState.getEffectiveRepairPerKindling();
  const maxUseful = Math.ceil((maxHp - hp) / repairPer);
  return Math.min(reserve, maxUseful);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(type: ModuleType, hp: number, maxHp: number): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();
  const repairPer = gameState.getEffectiveRepairPerKindling();
  const siphonBoosted = gameState.getRepairEfficiencyMult() > 1;
  const maxAllocatable = getMaxAllocatable(hp, maxHp);

  const typeLabel = type === 'CORE' ? '核心' : '储藏';
  // CORE identity color: neutral ui-text-bright, not green — "结构性但非资源" (ui-art-overhaul.md A2).
  const typeColor = type === 'CORE' ? '#c8cdd4' : '#c4873a';
  const effectDesc = type === 'CORE' ? '混乱抑制' : '薪柴增幅';

  // Progress calculations
  const hpPct = Math.round((hp / maxHp) * 100);
  const repairAmount = selectedAmount * repairPer;
  const repairedHp = Math.min(hp + repairAmount, maxHp);
  const repairedPct = Math.round((repairedHp / maxHp) * 100);
  const previewPct = repairedPct - hpPct;

  const currentEffect = computeEffectText(type, hp);
  const afterEffect = selectedAmount > 0 ? computeEffectText(type, repairedHp) : '';

  const minusDisabled = selectedAmount <= 0;
  const plusDisabled = selectedAmount >= maxAllocatable;
  const confirmDisabled = selectedAmount <= 0;

  let html = `<div class="panel-title" style="color:${typeColor};">${typeLabel} <span style="font-size:13px;color:#8a8f96;text-transform:none;font-weight:normal;">${effectDesc}</span></div>`;
  html += `<div style="flex:1;overflow-y:auto;">`;

  // Progress bar with preview
  html += `<div style="margin:8px 0;">
    <div class="pbar-wrap">
      <div class="pbar-fill" style="width:${hpPct}%;background:${typeColor};"></div>
      <div class="pbar-preview" style="left:${hpPct}%;width:${previewPct}%;background:${typeColor};"></div>
    </div>
    <div class="pbar-label">
      <span>${hp}/${maxHp}</span>
      ${selectedAmount > 0 ? `<span style="color:${typeColor};">+${repairAmount} → ${repairedHp}</span>` : `<span>${currentEffect}</span>`}
    </div>
  </div>`;

  // Effect preview (only if allocating)
  if (selectedAmount > 0) {
    html += `<div style="font-size:13px;color:${typeColor};text-align:center;margin:4px 0;">${afterEffect}</div>`;
  }

  // Allocation control bar. Boundary state (can't go lower/higher) is opacity-dimmed
  // per ui-art-overhaul.md A5-5~A5-12 ("不可用（-/+到边界）：按钮 opacity 40%"), not
  // a text-color swap — the displayed number already states the limit, no extra
  // wording needed.
  html += `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:12px 0 8px;">
    <span id="alloc-minus" class="action-btn btn-muted" style="padding:4px 10px;${minusDisabled ? 'opacity:0.4;cursor:default;' : ''}">-</span>
    <div style="min-width:60px;text-align:center;">
      <div style="font-size:16px;color:#c8cdd4;font-weight:bold;">${selectedAmount}</div>
      <div style="font-size:13px;color:#8a8f96;">薪柴</div>
    </div>
    <span id="alloc-plus" class="action-btn btn-muted" style="padding:4px 10px;${plusDisabled ? 'opacity:0.4;cursor:default;' : ''}">+</span>
  </div>`;

  // Reserve info. siphon (Slice 5 gap-fill): while equipped, repairPer is already the
  // doubled value (gameState.getEffectiveRepairPerKindling()) - the "(虹吸增效)" tag is
  // what makes that fact visible rather than just a bigger number the player might miss.
  html += `<div style="font-size:13px;color:#8a8f96;text-align:center;margin-bottom:8px;">储备 ${reserve} | 1薪柴=${repairPer}完整度${siphonBoosted ? ' <span style="color:#c4873a;">(虹吸增效)</span>' : ''}</div>`;

  // Action bar. Disabled state relies on the .btn-muted class's own readable
  // #8a8f96/#2a2d32 pairing instead of forcing the border color as text (that
  // was the bug: an inline color override was landing #2a2d32 directly on text,
  // ~1:1 contrast against the panel background — a real V1-class violation, not
  // just a style nit).
  html += `</div>`; // end flex:1 content wrapper
  html += `<div class="action-bar">
    <span id="alloc-confirm" class="action-btn${confirmDisabled ? ' btn-muted' : ''}" style="${confirmDisabled ? 'cursor:default;' : `color:${typeColor};border-color:${typeColor};`}">注入</span>
    <span id="alloc-cancel" class="action-btn btn-muted" style="cursor:pointer;">…算了</span>
  </div>`;
  html += `<div class="key-hint-bar"><span class="key">←→</span> 调整1 · <span class="key">Shift+←→</span> 调整5 · <span class="key">Home/End</span> 归零/拉满 · <span class="key">Enter</span> 注入 · <span class="key">Esc</span> 离开</div>`;

  panel.innerHTML = html;

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

  panel.querySelector('#alloc-confirm')?.addEventListener('click', confirmAllocation);

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
