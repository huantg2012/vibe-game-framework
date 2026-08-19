/**
 * GrowthPanel - DOM overlay for inscribing (刻入) permanent upgrades at the growth altar.
 *
 * Game-style card layout: each upgrade is a visual card with icon, name,
 * dot-based level indicator, and inline cost. Maxed cards glow gold,
 * unaffordable cards are dimmed.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_DISPLAY, GROWTH_UPGRADE_NAMES } from '@/config/growth-upgrade-display';
import { gameState } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { stabilityTracker } from '@/systems/stability-tracker';
import type { GrowthUpgradeId } from '@/types/game-types';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView, showToastStamp } from './panel-styles';

// Upgrade display config (name/icon/effect label) is CSV-id-driven and shared with
// status-panel.ts via src/config/growth-upgrade-display.ts — single source of truth.
const UPGRADES = GROWTH_UPGRADE_DISPLAY;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

// Keyboard cursor (IA §0.4 / §S7: ↑↓ 选卡 · Enter 刻入 · Esc 离开).
// 关闭走底键丝印 + Esc，不再另开「…不了」按钮区。
let cursorCard = 0;

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
    cursorCard = 0;
    createPanel();
    audioManager.playSFX('sfx-ui-open');
  },

  close(): void {
    if (!panel) return;
    audioManager.playSFX('sfx-ui-close');
    destroyPanel();
    onCloseCallback?.();
    onCloseCallback = null;
  },
};

// ---------------------------------------------------------------------------
// Panel creation
// ---------------------------------------------------------------------------

function createPanel(): void {
  panel = createCrtPanel('growth-panel');

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
    return;
  }

  if (e.key === 'Tab') {
    e.stopPropagation();
    e.preventDefault();
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.stopPropagation();
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    cursorCard = (cursorCard + dir + UPGRADES.length) % UPGRADES.length;
    render();
    return;
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
    e.preventDefault();
    const upgrade = UPGRADES[cursorCard];
    if (upgrade) purchaseCard(upgrade.id);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();

  let html = `<div class="panel-title">蜕变</div>`;
  html += `<div class="panel-fixed">
    <div style="display:flex;align-items:baseline;gap:12px;margin:4px 0 8px;">
      <span style="font-size:12px;color:#8a8f96;">储备</span>
      <span style="font-size:16px;color:#c4873a;font-weight:bold;">${reserve}</span>
    </div>
  </div>`;

  html += `<div class="panel-fixed">`;
  html += `<div class="card-grid">`;

  for (let i = 0; i < UPGRADES.length; i++) {
    const upgrade = UPGRADES[i]!;
    const level = growthSystem.getLevel(upgrade.id);
    const maxLevel = growthSystem.getMaxLevel(upgrade.id);
    const isMaxed = level >= maxLevel;
    const cost = growthSystem.getCost(upgrade.id);
    const canAfford = growthSystem.canAfford(upgrade.id, reserve);

    // Dot indicators
    let dots = '';
    for (let d = 0; d < maxLevel; d++) {
      if (d < level) {
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
    // Keyboard cursor (IA §0.3 "已选中"): forced via inline style so it stays
    // visible even on maxed/locked cards, whose own state classes share the same
    // CSS specificity as .card-selected and would otherwise win by source order.
    const selected = cursorCard === i;
    if (selected) cardClass += ' card-selected';
    const cursor = selected ? '<span style="color:#c4873a;font-weight:bold;margin-right:4px;">&gt;</span>' : '';

    const iconBorder = isMaxed ? '#8a5c2a' : (canAfford ? '#c4873a' : '#2a2d32');
    const iconColor = isMaxed ? '#8a5c2a' : (canAfford ? '#c4873a' : '#8a8f96');
    const nameColor = isMaxed ? '#8a5c2a' : '#c8cdd4';
    const shortfall = !isMaxed && !canAfford ? cost - reserve : 0;

    html += `<div class="${cardClass}" data-id="${upgrade.id}">
      <div class="card-icon" style="border-color:${iconBorder};color:${iconColor};">${upgrade.icon}</div>
      <div class="card-body">
        <div class="card-name" style="color:${nameColor};">${cursor}${upgrade.name}</div>
        <div class="card-dots">${dots}</div>
        <div style="font-size:12px;color:#8a8f96;margin-top:1px;">${upgrade.effectLabel(level, maxLevel)}</div>
      </div>`;

    if (isMaxed) {
      html += `<div style="font-size:13px;color:#8a5c2a;align-self:flex-end;">已至上限</div>`;
    } else if (shortfall > 0) {
      html += `<div class="card-cost" style="align-self:flex-end;">
        <span style="color:#c4873a;font-weight:bold;">${cost}</span>
        <span style="color:#8a8f96;"> 还差 </span>
        <span style="color:#c4873a;font-weight:bold;">${shortfall}</span>
      </div>`;
    } else {
      html += `<div class="card-cost" style="align-self:flex-end;"><span class="affordable">${cost}</span></div>`;
    }

    html += `</div>`;
  }

  html += `</div>`; // end card-grid
  html += `</div>`; // end panel-fixed
  html += `<div class="key-hint-bar">
    <span><span class="key">↑</span> <span class="key">↓</span> 选卡</span>
    <span><span class="key">Enter</span> 刻入</span>
    <span id="growth-close-btn"><span class="key">Esc</span> 离开</span>
  </div>`;

  panel.innerHTML = html;
  scrollFocusedIntoView(panel);
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
      if (el.classList.contains('card-maxed') || el.classList.contains('card-locked')) {
        audioManager.playSFX('sfx-ui-error');
        return;
      }
      purchaseCard(el.dataset.id as GrowthUpgradeId);
    });
  });
}

/** Shared by the mouse click handler and the keyboard Enter handler so the two
 *  input paths can never diverge (U7 "输入一致"). */
function purchaseCard(id: GrowthUpgradeId): void {
  const prevLevel = growthSystem.getLevel(id);
  const spent = growthSystem.purchase(id);
  if (spent > 0) {
    stabilityTracker.addProgress('growth', GAME_CONSTANTS.STABILITY.GAIN_GROWTH);
    saveManager.save();
    render();
    showPurchaseFlash(id, prevLevel + 1);
    checkFirstGrowthMilestone(id, prevLevel + 1);
  } else {
    audioManager.playSFX('sfx-ui-error');
  }
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
  // "→ 第N级" replaces the English "Lv." abbreviation (S15 类别2, U5).
  flash.textContent = `${GROWTH_UPGRADE_NAMES[id]} → 第${newLevel}级`;

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

  // C6: migrated onto the shared `.toast-stamp` primitive (was a hand-rolled overlay
  // with an equivalent but independently-maintained dismiss-on-click/key/timeout).
  setTimeout(() => showToastStamp('已刻入'), 300);
}
