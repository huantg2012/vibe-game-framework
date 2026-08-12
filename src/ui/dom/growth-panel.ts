/**
 * GrowthPanel - DOM overlay for purchasing permanent upgrades at the growth altar.
 *
 * Game-style card layout: each upgrade is a visual card with icon, name,
 * dot-based level indicator, and inline cost. Maxed cards glow gold,
 * unaffordable cards are dimmed.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_DISPLAY, GROWTH_UPGRADE_NAMES } from '@/config/growth-upgrade-display';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { stabilityTracker } from '@/systems/stability-tracker';
import type { GrowthUpgradeId } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

// Upgrade display config (name/icon/effect label) is CSV-id-driven and shared with
// status-panel.ts via src/config/growth-upgrade-display.ts — single source of truth.
const UPGRADES = GROWTH_UPGRADE_DISPLAY;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const growthPanel = {
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
  panel.id = 'growth-panel';
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
  backdrop.id = 'growth-backdrop';
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
  document.getElementById('growth-backdrop')?.remove();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    growthPanel.close();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();

  let html = `<div class="panel-title" style="color:#8a5c2a;">蜕变</div>`;
  html += `<div style="flex:1;overflow-y:auto;">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <span style="font-size:13px;color:#8a8f96;">薪柴储备</span>
    <span style="font-size:16px;color:#c4873a;font-weight:bold;">${reserve}</span>
  </div>`;

  html += `<div class="card-grid">`;

  for (const upgrade of UPGRADES) {
    const level = growthSystem.getLevel(upgrade.id);
    const maxLevel = growthSystem.getMaxLevel(upgrade.id);
    const isMaxed = level >= maxLevel;
    const cost = growthSystem.getCost(upgrade.id);
    const canAfford = growthSystem.canAfford(upgrade.id, reserve);

    // Dot indicators
    let dots = '';
    for (let i = 0; i < maxLevel; i++) {
      if (i < level) {
        dots += '<span class="dot-filled">●</span>';
      } else {
        dots += '<span class="dot-empty">○</span>';
      }
    }

    // Card state class
    let cardClass = 'upgrade-card';
    if (isMaxed) {
      cardClass += ' card-maxed';
    } else if (!canAfford) {
      cardClass += ' card-locked';
    }

    // Icon border color
    const iconBorder = isMaxed ? '#8a5c2a' : (canAfford ? '#c4873a' : '#2a2d32');
    const iconColor = isMaxed ? '#8a5c2a' : (canAfford ? '#c4873a' : '#8a8f96');
    const nameColor = isMaxed ? '#8a5c2a' : '#c8cdd4';

    html += `<div class="${cardClass}" data-id="${upgrade.id}">
      <div class="card-icon" style="border-color:${iconBorder};color:${iconColor};">${upgrade.icon}</div>
      <div class="card-body">
        <div class="card-name" style="color:${nameColor};">${upgrade.name}</div>
        <div class="card-dots">${dots}</div>
        <div style="font-size:13px;color:#8a8f96;margin-top:1px;">${upgrade.effectLabel(level)}</div>
      </div>`;

    if (isMaxed) {
      html += `<div style="font-size:13px;color:#8a5c2a;font-weight:bold;">MAX</div>`;
    } else {
      const costColor = canAfford ? '#c4873a' : '#2a2d32';
      html += `<div class="card-cost"><span class="${canAfford ? 'affordable' : ''}" style="color:${costColor};">${cost}</span></div>`;
    }

    html += `</div>`;
  }

  html += `</div>`; // end card-grid
  html += `</div>`; // end flex:1 content wrapper

  html += `<div class="action-bar">
    <span id="growth-close-btn" class="action-btn btn-muted" style="cursor:pointer;">…不了</span>
  </div>`;

  panel.innerHTML = html;
  wireEvents();
}

function wireEvents(): void {
  if (!panel) return;

  panel.querySelector('#growth-close-btn')?.addEventListener('click', () => {
    growthPanel.close();
  });

  panel.querySelectorAll('.upgrade-card').forEach((card) => {
    card.addEventListener('click', () => {
      const el = card as HTMLElement;
      if (el.classList.contains('card-maxed') || el.classList.contains('card-locked')) return;
      const id = el.dataset.id as GrowthUpgradeId;
      const prevLevel = growthSystem.getLevel(id);
      const spent = growthSystem.purchase(id);
      if (spent > 0) {
        stabilityTracker.addProgress('growth', GAME_CONSTANTS.STABILITY.GAIN_GROWTH);
        saveManager.save();
        render();
        showPurchaseFlash(id, prevLevel + 1);
        checkFirstGrowthMilestone(id, prevLevel + 1);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// C1: Purchase flash animation
// ---------------------------------------------------------------------------

function showPurchaseFlash(id: GrowthUpgradeId, newLevel: number): void {
  if (!panel) return;

  if (!document.getElementById('growth-flash-style')) {
    const style = document.createElement('style');
    style.id = 'growth-flash-style';
    // Purchase = kindling spent on a permanent gain — human-side positive feedback
    // uses the warm palette, never green (ui-art-overhaul.md A2/A6).
    style.textContent = `@keyframes growth-flash { 0%{opacity:1;color:#e0a848;} 100%{opacity:0;} }`;
    document.head.appendChild(style);
  }

  const flash = document.createElement('div');
  flash.style.cssText = 'font-size:13px;color:#e0a848;text-align:center;padding:4px;animation:growth-flash 2s ease-out forwards;';
  flash.textContent = `${GROWTH_UPGRADE_NAMES[id]} → Lv.${newLevel}`;

  const title = panel.querySelector('.panel-title');
  if (title && title.nextSibling) {
    panel.insertBefore(flash, title.nextSibling);
  } else {
    panel.prepend(flash);
  }

  setTimeout(() => flash.remove(), 2000);
}

// ---------------------------------------------------------------------------
// E2: First growth milestone
// ---------------------------------------------------------------------------

function checkFirstGrowthMilestone(id: GrowthUpgradeId, newLevel: number): void {
  if (newLevel !== 1) return;
  const flag = localStorage.getItem('coh_first_growth_done');
  if (flag) return;

  const ids = growthSystem.getAllUpgradeIds();
  const otherLevels = ids.filter((i) => i !== id).map((i) => growthSystem.getLevel(i));
  if (otherLevels.some((l) => l > 0)) return;

  localStorage.setItem('coh_first_growth_done', '1');

  setTimeout(() => {
    const overlay = document.createElement('div');
    overlay.id = 'first-growth-milestone';
    overlay.className = 'game-panel';
    overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:2000', 'background:rgba(0,0,0,0.85)', 'border:none',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:16px', 'color:#c4873a',
      'cursor:pointer', 'pointer-events:auto',
    ].join(';');
    overlay.textContent = '已刻入';
    getDomUiRoot().appendChild(overlay);

    const dismiss = (): void => {
      overlay.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', keyDismiss);
      clearTimeout(tmr);
      overlay.remove();
    };
    const keyDismiss = (e: KeyboardEvent): void => { if (!e.repeat) dismiss(); };
    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', keyDismiss);
    const tmr = setTimeout(dismiss, 1500);
  }, 300);
}
