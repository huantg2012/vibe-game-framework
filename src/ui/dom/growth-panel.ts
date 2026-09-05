/**
 * GrowthPanel — 蜕变墙机（载体 B）。
 *
 * I11-B4c：钉顶三格身份带（三格都暗，overlap 是培养藏）+ 七张卡为主 + 底键印。
 * 无顶 Tab、无出击预估、卡栅不走空状态三件套。挂 #dom-ui-root。
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_DISPLAY, GROWTH_UPGRADE_NAMES } from '@/config/growth-upgrade-display';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { stabilityTracker } from '@/systems/stability-tracker';
import { GameEvent } from '@/types/events';
import type { GrowthUpgradeId } from '@/types/game-types';
import { identityBandHtml } from './module-identity-strip';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView, showToastStamp } from './panel-styles';

// Upgrade display config (name/icon/effect label) is CSV-id-driven and shared with
// status-panel.ts via src/config/growth-upgrade-display.ts — single source of truth.
const UPGRADES = GROWTH_UPGRADE_DISPLAY;

/** Sentinel id for the thicken card. Not a GrowthUpgradeId. */
const THICKEN_ID = 'thicken' as const;

const PANEL_CARD_COUNT = UPGRADES.length + 1;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

// Keyboard cursor (IA §0.4 / §S7: ↑↓ 选卡 · Enter 刻入或加厚 · Esc 离开).
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
    cursorCard = (cursorCard + dir + PANEL_CARD_COUNT) % PANEL_CARD_COUNT;
    render();
    return;
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
    e.preventDefault();
    commitSelectedCard();
  }
}

function commitSelectedCard(): void {
  if (cursorCard === UPGRADES.length) {
    purchaseThicken();
    return;
  }
  const upgrade = UPGRADES[cursorCard];
  if (upgrade) purchaseCard(upgrade.id);
}

function thickenSelected(): boolean {
  return cursorCard === UPGRADES.length;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function thickenEffectHtml(currentMax: number, nextMax: number | null, isMaxed: boolean): string {
  const name = '<span>全部上限</span>';
  const cur = `<span style="color:#c8cdd4;margin-left:6px;">${currentMax}</span>`;
  if (isMaxed || nextMax === null) return `${name}${cur}`;
  return `${name}${cur}<span style="color:#8a8f96;margin:0 4px;">→</span><span style="color:#c8cdd4;">${nextMax}</span>`;
}

function renderCard(opts: {
  id: string;
  index: number;
  name: string;
  icon: string;
  level: number;
  maxLevel: number;
  cost: number | null;
  canAfford: boolean;
  isMaxed: boolean;
  effectHtml: string;
  reserve: number;
}): string {
  const { id, index, name, icon, level, maxLevel, cost, canAfford, isMaxed, effectHtml, reserve } = opts;

  let dots = '';
  for (let d = 0; d < maxLevel; d++) {
    if (d < level) {
      dots += '<span class="dot-filled">●</span>';
    } else {
      dots += '<span class="dot-empty">○</span>';
    }
  }

  let cardClass = 'upgrade-card';
  if (isMaxed) {
    cardClass += ' card-maxed';
  } else if (!canAfford) {
    cardClass += ' card-locked';
  }
  const selected = cursorCard === index;
  if (selected) cardClass += ' card-selected';
  const cursor = selected ? '<span style="color:#c4873a;font-weight:bold;margin-right:4px;">&gt;</span>' : '';

  const iconBorder = isMaxed ? '#8a5c2a' : (canAfford ? '#c4873a' : '#2a2d32');
  const iconColor = isMaxed ? '#8a5c2a' : (canAfford ? '#c4873a' : '#8a8f96');
  const nameColor = isMaxed ? '#8a5c2a' : '#c8cdd4';
  const shortfall = !isMaxed && cost !== null && !canAfford ? cost - reserve : 0;

  let html = `<div class="${cardClass}" data-id="${id}">
      <div class="card-icon" style="border-color:${iconBorder};color:${iconColor};">${icon}</div>
      <div class="card-body">
        <div class="card-name" style="color:${nameColor};">${cursor}${name}</div>
        <div class="card-dots">${dots}</div>
        <div style="font-size:12px;color:#8a8f96;margin-top:1px;">${effectHtml}</div>
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
  return html;
}

function render(): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();
  const commitLabel = thickenSelected() ? '加厚' : '刻入';

  let html = `<div class="panel-title">蜕变</div>`;
  html += identityBandHtml({ activeId: null });
  html += `<div class="panel-fixed">
    <div style="display:flex;align-items:baseline;gap:12px;margin:4px 0 8px;">
      <span style="font-size:12px;color:#8a8f96;">储备</span>
      <span style="font-size:16px;color:#c4873a;font-weight:bold;">${reserve}</span>
    </div>
  </div>`;

  html += `<div class="scroll-area">`;
  html += `<div class="card-grid">`;

  for (let i = 0; i < UPGRADES.length; i++) {
    const upgrade = UPGRADES[i]!;
    const level = growthSystem.getLevel(upgrade.id);
    const maxLevel = growthSystem.getMaxLevel(upgrade.id);
    const isMaxed = level >= maxLevel;
    const cost = growthSystem.getCost(upgrade.id);
    const canAfford = growthSystem.canAfford(upgrade.id, reserve);
    html += renderCard({
      id: upgrade.id,
      index: i,
      name: upgrade.name,
      icon: upgrade.icon,
      level,
      maxLevel,
      cost,
      canAfford,
      isMaxed,
      effectHtml: upgrade.effectLabel(level, maxLevel),
      reserve,
    });
  }

  const tier = gameState.getModuleMaxHpTier();
  const maxTier = GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_TIERS;
  const currentMax = gameState.getModuleMaxHp();
  const thickenCost = gameState.getNextModuleMaxHpCost();
  const nextMax = thickenCost === null
    ? null
    : currentMax + GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER;
  const thickenMaxed = thickenCost === null;
  html += renderCard({
    id: THICKEN_ID,
    index: UPGRADES.length,
    name: '加厚',
    icon: '◆',
    level: tier,
    maxLevel: maxTier,
    cost: thickenCost,
    canAfford: gameState.canRaiseModuleMaxHp(),
    isMaxed: thickenMaxed,
    effectHtml: thickenEffectHtml(currentMax, nextMax, thickenMaxed),
    reserve,
  });

  html += `</div>`; // end card-grid
  html += `</div>`; // end scroll-area
  html += `<div class="key-hint-bar">
    <span><span class="key">↑</span> <span class="key">↓</span> 选卡</span>
    <span><span class="key">Enter</span> ${commitLabel}</span>
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

  panel.querySelectorAll('.upgrade-card').forEach((card, index) => {
    card.addEventListener('mouseenter', () => {
      if (cursorCard === index) return;
      cursorCard = index;
      render();
    });
    card.addEventListener('click', () => {
      const el = card as HTMLElement;
      cursorCard = index;
      if (el.classList.contains('card-maxed') || el.classList.contains('card-locked')) {
        audioManager.playSFX('sfx-ui-error');
        render();
        return;
      }
      const id = el.dataset.id ?? '';
      if (id === THICKEN_ID) {
        purchaseThicken();
        return;
      }
      purchaseCard(id as GrowthUpgradeId);
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
    showPurchaseFlash(GROWTH_UPGRADE_NAMES[id], prevLevel + 1, '级');
    checkFirstGrowthMilestone(id, prevLevel + 1);
  } else {
    audioManager.playSFX('sfx-ui-error');
  }
}

function purchaseThicken(): void {
  if (!gameState.raiseModuleMaxHp()) {
    audioManager.playSFX('sfx-ui-error');
    return;
  }
  saveManager.save();
  const newTier = gameState.getModuleMaxHpTier();
  eventBus.emit(GameEvent.GROWTH_PURCHASED, { upgradeId: THICKEN_ID, newLevel: newTier });
  render();
  showPurchaseFlash('加厚', newTier, '档');
}

// ---------------------------------------------------------------------------
// C1: Purchase flash animation
// ---------------------------------------------------------------------------

function showPurchaseFlash(name: string, newLevel: number, unit: '级' | '档'): void {
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
  flash.textContent = `${name} → 第${newLevel}${unit}`;

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
