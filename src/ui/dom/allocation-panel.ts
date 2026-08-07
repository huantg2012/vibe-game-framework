/**
 * AllocationPanel - DOM overlay for allocating kindling to a module.
 *
 * Pure HTML/CSS; no Phaser UI. Position:fixed + z-index so it sits above the canvas.
 * Emits ALLOCATION_CONFIRMED through the event bus on confirm.
 */

import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import type { ModuleType } from '@/managers/game-state';
import { GameEvent } from '@/types/events';
import { GAME_CONSTANTS } from '@/config/constants';

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

  panel = document.createElement('div');
  panel.id = 'allocation-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:1000',
    'background:#1a1a1a',
    'border:1px solid #444',
    'padding:20px',
    'min-width:280px',
    'font-family:monospace',
    'color:#ccc',
    'border-radius:4px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.8)',
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
// Rendering
// ---------------------------------------------------------------------------

function render(type: ModuleType, hp: number, maxHp: number): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();
  const repairPer = GAME_CONSTANTS.PURIFICATION.REPAIR_PER_KINDLING;
  const maxUseful = Math.ceil((maxHp - hp) / repairPer);
  const maxAllocatable = Math.min(reserve, maxUseful);

  const typeLabel = type === 'BARRIER' ? 'BARRIER (Chaos Reduction)' : 'STORAGE (Kindling Bonus)';
  const typeColor = type === 'BARRIER' ? '#4488cc' : '#cc8844';

  panel.innerHTML = `
    <div style="margin-bottom:12px;font-size:14px;color:${typeColor};font-weight:bold;">
      ${typeLabel}
    </div>
    <div style="margin-bottom:8px;font-size:12px;">
      HP: <span style="color:#fff;">${hp}</span> / ${maxHp}
    </div>
    <div style="margin-bottom:12px;font-size:12px;">
      Available Kindling: <span style="color:#2ae6c8;">${reserve}</span>
    </div>
    <div style="margin-bottom:8px;font-size:11px;color:#888;">
      1 kindling = ${repairPer} HP
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <button id="alloc-minus" style="${btnStyle()}" ${selectedAmount <= 0 ? 'disabled' : ''}>-</button>
      <span id="alloc-amount" style="font-size:16px;color:#fff;min-width:30px;text-align:center;">
        ${selectedAmount}
      </span>
      <button id="alloc-plus" style="${btnStyle()}" ${selectedAmount >= maxAllocatable ? 'disabled' : ''}>+</button>
      <span style="font-size:11px;color:#888;margin-left:8px;">
        (+${selectedAmount * repairPer} HP)
      </span>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="alloc-confirm" style="${confirmBtnStyle()}" ${selectedAmount <= 0 ? 'disabled' : ''}>
        Confirm
      </button>
      <button id="alloc-cancel" style="${cancelBtnStyle()}">Cancel</button>
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function btnStyle(): string {
  return [
    'width:28px',
    'height:28px',
    'font-size:16px',
    'font-family:monospace',
    'background:#333',
    'color:#fff',
    'border:1px solid #555',
    'border-radius:3px',
    'cursor:pointer',
  ].join(';');
}

function confirmBtnStyle(): string {
  return [
    'padding:6px 16px',
    'font-size:12px',
    'font-family:monospace',
    'background:#2a6644',
    'color:#fff',
    'border:1px solid #4a8866',
    'border-radius:3px',
    'cursor:pointer',
  ].join(';');
}

function cancelBtnStyle(): string {
  return [
    'padding:6px 16px',
    'font-size:12px',
    'font-family:monospace',
    'background:#444',
    'color:#ccc',
    'border:1px solid #666',
    'border-radius:3px',
    'cursor:pointer',
  ].join(';');
}
