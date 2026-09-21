/**
 * 蜕变：改造与加厚列表、选中详情及消耗；保留既有购买与存档流程。
 * 迭代 11 DEC-119；共享终端样式，挂 #dom-ui-root。
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_DISPLAY, GROWTH_UPGRADE_NAMES } from '@/config/growth-upgrade-display';
import { gameState } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { growthSystem } from '@/systems/growth-system';
import { purchaseGrowth, type GrowthPurchaseResult } from '@/managers/growth-purchases';
import { previewThickening } from '@/ui/growth-presentation';
import type { GrowthUpgradeId } from '@/types/game-types';
import { renderPanelContent } from './panel-render-state';
import { bindWorldInteraction, type WorldInteractionContext } from './world-interaction';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView, showToastStamp } from './panel-styles';

// Upgrade display config (name/icon/effect label) is CSV-id-driven and shared with
// status-panel.ts via src/config/growth-upgrade-display.ts — single source of truth.
const UPGRADES = GROWTH_UPGRADE_DISPLAY;

/** Sentinel id for the thicken card. Not a GrowthUpgradeId. */
const THICKEN_ID = 'thicken' as const;

interface GrowthEntry {
  id: GrowthUpgradeId | typeof THICKEN_ID;
  name: string; level: number; maxLevel: number; targetLevel: number;
  cost: number | null; effect: string; next: boolean;
  unlocked: boolean; requirement: string; responsibility: string;
}
const RESPONSIBILITY: Record<string, string> = {
  body: '身体适应', base: '装置建设', equipment: '出击携带',
};
function entriesForDisplay(): GrowthEntry[] {
  const next = growthSystem.getNextStep();
  const entries: GrowthEntry[] = [];
  const add = (id: GrowthUpgradeId | typeof THICKEN_ID, isNext: boolean): void => {
    const thicken = id === THICKEN_ID;
    const level = thicken ? gameState.getModuleMaxHpTier() : growthSystem.getLevel(id);
    const maxLevel = thicken ? GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_TIERS : growthSystem.getMaxLevel(id);
    const display = UPGRADES.find(upgrade => upgrade.id === id);
    const definition = thicken ? null : growthSystem.getUpgradeDefinition(id);
    const maxHp = gameState.getModuleMaxHp();
    entries.push({ id, name: definition?.name ?? '加厚', level, maxLevel,
      targetLevel: isNext ? next!.level : level, next: isNext,
      cost: isNext ? next!.cost : null, unlocked: isNext && next!.unlocked,
      requirement: isNext ? next!.requirementText : '',
      // Owned entries only describe existing effects, never another future node.
      effect: thicken ? thickenEffectHtml(maxHp, isNext ? maxHp + GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER : null, !isNext)
        : display!.effectLabel(level, isNext ? maxLevel : level),
      responsibility: RESPONSIBILITY[definition?.responsibility ?? 'base'] ?? '' });
  };
  if (next) add(next.id, true);
  for (const upgrade of UPGRADES) {
    if (growthSystem.getLevel(upgrade.id) > 0) add(upgrade.id, false);
  }
  if (gameState.getModuleMaxHpTier() > 0) add(THICKEN_ID, false);
  return entries;
}

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
    const count = entriesForDisplay().length;
    cursorCard = (cursorCard + dir + count) % count;
    render(true, true);
    return;
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
    e.preventDefault();
    if (!e.repeat) commitSelectedCard();
  }
}

function commitSelectedCard(): void {
  const selected = entriesForDisplay()[cursorCard];
  if (!selected || !selected.unlocked) return;
  if (selected.id === THICKEN_ID) purchaseThicken();
  else purchaseCard(selected.id);
}

function thickenSelected(): boolean {
  const selected = entriesForDisplay()[cursorCard];
  return selected?.id === THICKEN_ID && selected.next;
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

function thickenConsequencesHtml(): string {
  if (gameState.getNextModuleMaxHpCost() === null) return '';
  const preview = previewThickening(gameState.getModules(), gameState.getRepairBonusHp());
  const names: Record<string, string> = { CORE: '核心', STORAGE: '储藏', PURIFIER: '净化器' };
  return `<div class="separator"></div><div class="readout-section">扩容后仍需修复</div>
    <div class="stat-row" data-thicken-consequence="chaos"><span class="readout-label">起始混乱</span><span>${preview.startingChaos} → ${preview.nextStartingChaos}</span></div>
    <p class="readout-note" data-thicken-consequence="refill">当前完整度不增加。补满全部装置另需至少 ${preview.refillKindling} 薪柴${gameState.getRepairBonusHp() > 0 ? '，已计一次修复余量' : ''}。</p>
    ${preview.modules.map(module => `<div class="stat-row"><span class="readout-label">${names[module.id] ?? module.id}</span>
      <span>${module.hp} / ${module.maxHp} → ${module.hp} / ${module.nextMaxHp}</span></div>`).join('')}`;
}

function render(selectionOnly = false, revealSelection = false): void {
  if (!panel) return;
  const reserve = gameState.getKindlingReserve();
  const entries = entriesForDisplay();
  cursorCard = Math.min(cursorCard, entries.length - 1);
  const selected = entries[cursorCard]!;
  const progress = growthSystem.getRouteProgress();
  const available = selected.unlocked && selected.cost !== null && reserve >= selected.cost;
  const reason = !selected.next ? (selected.level === selected.maxLevel ? '已至上限。' : '已永久生效。')
    : !selected.unlocked ? '' : available ? '消耗薪柴后永久生效。'
    : `薪柴不足，还差 ${selected.cost! - reserve}。`;
  const list = entries.map((entry, index) => `${index === 0 && entry.next ? '<div class="readout-section">下一次蜕变</div>' : index === (entries[0]?.next ? 1 : 0) ? '<div class="readout-section">已刻入</div>' : ''}
    <div class="upgrade-card${index === cursorCard ? ' card-selected' : ''}${!entry.next ? ' card-maxed' : !entry.unlocked || entry.cost! > reserve ? ' card-locked' : ''}"
      data-id="${entry.id}" data-growth-next="${entry.next}">
    <div class="card-body"><div class="card-name">${entry.name}</div><div class="readout-note">${entry.next ? '刻入' : '等级'} ${entry.targetLevel} / ${entry.maxLevel}${entry.next ? ` · ${entry.unlocked ? entry.cost! <= reserve ? '可刻入' : '薪柴不足' : '尚待经历'}` : ''}</div></div>
    ${entry.cost !== null ? `<div class="card-cost">${entry.cost}<span class="readout-label"> 薪柴</span></div>` : ''}
  </div>`).join('');
  const html = `<div class="panel-heading"><div class="panel-title">蜕变</div><div class="panel-reserve"><span>薪柴</span><strong>${reserve}</strong></div></div>
    <div class="readout-note" data-growth-progress>已刻入 ${progress.completed} / ${progress.total}${progress.completed === progress.total ? ' · 全部完成' : ''}<span data-growth-feedback style="float:right;color:#b29a73;"></span></div>
    <div class="decision-layout"><div class="decision-main scroll-area readout-list">${list}</div>
      <div class="decision-aside readout-detail"><div class="readout-section">${selected.responsibility} · ${selected.name}</div>
        <div class="stat-row"><span class="readout-label">${selected.next ? '本次等级' : '当前等级'}</span><span>${selected.next ? `${selected.level} → ${selected.targetLevel}` : selected.level} / ${selected.maxLevel}</span></div>
        <div class="readout-copy">${selected.effect}</div>
        ${selected.requirement && !selected.unlocked ? `<p class="readout-note" data-growth-requirement>尚待经历 · ${selected.requirement}</p>` : ''}
        ${thickenSelected() ? '' : '<div class="separator"></div>'}
        ${selected.cost === null ? '' : `<div class="stat-row"><span class="readout-label">本次消耗</span><span class="readout-value">${selected.cost}</span><span>薪柴</span></div>`}
        ${available ? `<div class="readout-note">完成后剩余 ${reserve - selected.cost!} 薪柴</div>` : ''}
        ${thickenSelected() && available || !reason ? '' : `<p class="readout-note">${reason}</p>`}
        ${thickenSelected() ? thickenConsequencesHtml() : ''}
      </div></div>
    <div class="key-hint-bar"><span><span class="key">↑ ↓</span> 选择</span>
      ${available ? `<span id="growth-confirm-btn"><span class="key">Enter</span> ${thickenSelected() ? '加厚' : '刻入'}</span>` : `<span>${!selected.next ? '已刻入' : !selected.unlocked ? '尚待经历' : '薪柴不足'}</span>`}
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
      cursorCard = index;
      render(true);
      commitSelectedCard();
    });
  });
}

/** Shared by the mouse click handler and the keyboard Enter handler so the two
 *  input paths can never diverge (U7 "输入一致"). */
function purchaseCard(id: GrowthUpgradeId): void {
  const result = purchaseGrowth(id);
  if (result.ok) {
    cursorCard = 0;
    render();
    showPurchaseFlash(GROWTH_UPGRADE_NAMES[id], result.newLevel, '级');
    checkFirstGrowthMilestone(id, result.newLevel);
  } else {
    showPurchaseFailure(result);
  }
}

function purchaseThicken(): void {
  const result = purchaseGrowth(THICKEN_ID);
  if (!result.ok) {
    showPurchaseFailure(result);
    return;
  }
  cursorCard = 0;
  render();
  showPurchaseFlash('加厚', result.newLevel, '级');
}

function showPurchaseFailure(result: Extract<GrowthPurchaseResult, { ok: false }>): void {
  audioManager.playSFX('sfx-ui-error');
  render();
  if (result.reason !== 'unavailable') showToastStamp(result.reason === 'pending-save'
    ? '先保存归来的记录。' : '未能保存，薪柴未扣除。');
}

// ---------------------------------------------------------------------------
// C1: Purchase flash animation
// ---------------------------------------------------------------------------

function showPurchaseFlash(name: string, newLevel: number, unit: '级' | '档'): void {
  if (!panel) return;
  // Transient feedback must not push the next action or thickening costs down.
  const feedback = panel.querySelector('[data-growth-feedback]');
  if (!feedback) return;
  feedback.textContent = `${name} · ${newLevel} ${unit} 已刻入`;
  setTimeout(() => { feedback.textContent = ''; }, 2000);
}

// ---------------------------------------------------------------------------
// E2: First growth milestone
// ---------------------------------------------------------------------------

function checkFirstGrowthMilestone(id: GrowthUpgradeId, newLevel: number): void {
  if (newLevel !== 1) return;
  let flag: string | null;
  try { flag = localStorage.getItem('coh_first_growth_done'); } catch { return; }
  if (flag) return;

  const ids = growthSystem.getAllUpgradeIds();
  const otherLevels = ids.filter((i) => i !== id).map((i) => growthSystem.getLevel(i));
  if (otherLevels.some((l) => l > 0)) return;

  try { localStorage.setItem('coh_first_growth_done', '1'); } catch { return; }

  // The same quiet result line also marks the first purchase; no second blocking toast.
}
