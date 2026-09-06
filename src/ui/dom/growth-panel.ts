/**
 * 蜕变：改造与加厚列表、选中详情及消耗；保留既有购买与存档流程。
 * 迭代 11 DEC-119；共享终端样式，挂 #dom-ui-root。
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
import { renderPanelContent } from './panel-render-state';
import { bindWorldInteraction, type WorldInteractionContext } from './world-interaction';
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
let cleanupWorldInteraction: (() => void) | null = null;
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

  open(onClose?: () => void, context?: WorldInteractionContext): void {
    if (panel) return;
    onCloseCallback = onClose ?? null;
    cursorCard = 0;
    createPanel(context);
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

function createPanel(context?: WorldInteractionContext): void {
  panel = createCrtPanel('growth-panel');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'growth-backdrop';
  root.appendChild(backdrop);

  render();
  root.appendChild(panel);
  if (context) {
    cleanupWorldInteraction = bindWorldInteraction(panel, backdrop, context, '培养藏', 'growth');
  }
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  cleanupWorldInteraction?.();
  cleanupWorldInteraction = null;
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
    render(true, true);
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
  const cur = `<span style="color:#b5bbaf;margin-left:6px;">${currentMax}</span>`;
  if (isMaxed || nextMax === null) return `${name}${cur}`;
  return `${name}${cur}<span style="color:#8a8f96;margin:0 4px;">→</span><span style="color:#b5bbaf;">${nextMax}</span>`;
}

function render(selectionOnly = false, revealSelection = false): void {
  if (!panel) return;
  const reserve = gameState.getKindlingReserve();
  const entries = UPGRADES.map((upgrade) => {
    const level = growthSystem.getLevel(upgrade.id);
    const maxLevel = growthSystem.getMaxLevel(upgrade.id);
    return { id: upgrade.id as string, name: upgrade.name, level, maxLevel,
      cost: level >= maxLevel ? null : growthSystem.getCost(upgrade.id),
      effect: upgrade.effectLabel(level, maxLevel) };
  });
  const tier = gameState.getModuleMaxHpTier();
  const maxHp = gameState.getModuleMaxHp();
  const cost = gameState.getNextModuleMaxHpCost();
  entries.push({ id: THICKEN_ID, name: '加厚', level: tier,
    maxLevel: GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_TIERS, cost,
    effect: thickenEffectHtml(maxHp, cost === null ? null : maxHp + GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER, cost === null) });
  const selected = entries[cursorCard]!;
  const available = selected.cost !== null && reserve >= selected.cost;
  const reason = selected.cost === null ? '已至上限。' : available ? '消耗薪柴后永久生效。'
    : `薪柴不足，还差 ${selected.cost - reserve}。`;
  const list = entries.map((entry, index) => `<div class="upgrade-card${index === cursorCard ? ' card-selected' : ''}${entry.cost === null ? ' card-maxed' : entry.cost > reserve ? ' card-locked' : ''}" data-id="${entry.id}">
    <div class="card-body"><div class="card-name">${entry.name}</div><div class="readout-note">${entry.level} / ${entry.maxLevel}${entry.cost === null ? ' · 已至上限' : ''}</div></div>
    ${entry.cost !== null ? `<div class="card-cost">${entry.cost}<span class="readout-label"> 薪柴</span></div>` : ''}
  </div>`).join('');
  const html = `<div class="panel-heading"><div class="panel-title">蜕变</div><div class="panel-reserve"><span>薪柴</span><strong>${reserve}</strong></div></div>
    <div class="decision-layout"><div class="decision-main scroll-area readout-list">${list}</div>
      <div class="decision-aside readout-detail"><div class="readout-section">${selected.name}</div>
        <div class="readout-hero"><span class="readout-label">${thickenSelected() ? '已加厚档位' : '已刻入等级'}</span><span class="readout-value">${selected.level} / ${selected.maxLevel}</span></div>
        <div class="readout-copy">${selected.effect}</div><div class="separator"></div>
        ${selected.cost === null ? '' : `<div class="stat-row"><span class="readout-label">本次消耗</span><span class="readout-value">${selected.cost}</span><span>薪柴</span></div>`}
        ${available ? `<div class="readout-note">完成后剩余 ${reserve - selected.cost!} 薪柴</div>` : ''}
        <p class="readout-note">${reason}</p>
        ${thickenSelected() ? '<p class="readout-note">提高全部装置的完整度上限。</p>' : ''}
      </div></div>
    <div class="key-hint-bar"><span><span class="key">↑ ↓</span> 选择</span>
      ${available ? `<span id="growth-confirm-btn"><span class="key">Enter</span> ${thickenSelected() ? '加厚' : '刻入'}</span>` : `<span>${selected.cost === null ? '已至上限' : '薪柴不足'}</span>`}
      <span id="growth-close-btn"><span class="key">Esc</span> 离开</span></div>`;
  renderPanelContent(panel, html, selectionOnly);
  if (revealSelection) scrollFocusedIntoView(panel);
  wireEvents(selectionOnly);
}

function wireEvents(selectionOnly = false): void {
  if (!panel) return;

  panel.querySelector('#growth-confirm-btn')?.addEventListener('click', commitSelectedCard);

  panel.querySelector('#growth-close-btn')?.addEventListener('click', () => {
    growthPanel.close();
  });

  if (selectionOnly) return;

  panel.querySelectorAll('.upgrade-card').forEach((card, index) => {
    card.addEventListener('pointermove', () => {
      if (cursorCard === index) return;
      cursorCard = index;
      render(true);
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
  flash.style.cssText = 'font-size:12px;color:#b29a73;text-align:center;padding:4px;animation:growth-flash 2s ease-out forwards;';
  flash.textContent = `${name} → 第${newLevel}${unit}`;

  const heading = panel.querySelector('.panel-heading');
  if (heading) {
    heading.after(flash);
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
