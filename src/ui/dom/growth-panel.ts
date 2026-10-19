/**
 * 蜕变：改造与加厚列表、选中详情及消耗；保留既有购买与存档流程。
 * 迭代 11 DEC-119；共享终端样式，挂 #dom-ui-root。
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_DISPLAY, GROWTH_UPGRADE_NAMES, formatGrowthLevel, type GrowthEffectPreview } from '@/config/growth-upgrade-display';
import { gameState } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { purchaseGrowth, type GrowthPurchaseResult } from '@/managers/growth-purchases';
import { getHealingPreview } from '@/managers/healing-cycle';
import { assimilationHostilityMultiplier, getAssimilationModulators, healingCyclesToClear } from '@/systems/assimilation-system';
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
  cost: number | null; effect: GrowthEffectPreview; next: boolean;
  unlocked: boolean; requirement: string; responsibility: string;
}
const RESPONSIBILITY: Record<string, string> = {
  body: '身体适应', base: '装置建设', equipment: '出击携带',
};
function actionState(entry: GrowthEntry, reserve: number): 'ready' | 'shortfall' | 'locked' | 'owned' {
  if (!entry.next) return 'owned';
  if (!entry.unlocked) return 'locked';
  return reserve >= entry.cost! ? 'ready' : 'shortfall';
}

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
      effect: thicken ? {
        label: '每台装置完整度上限', value: String(maxHp + (isNext ? GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER : 0)),
        currentValue: isNext ? String(maxHp) : undefined,
        gain: isNext ? `三台装置上限各 +${GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER}` : undefined,
      } : display!.effectPreview(level, isNext ? next!.level : undefined),
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
let onHealCallback: (() => void) | null = null;
let currentPage: 'growth' | 'healing' = 'growth';

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

  open(onClose?: () => void, context?: WorldInteractionContext, onHeal?: () => void): void {
    if (panel) return;
    onCloseCallback = onClose ?? null;
    onHealCallback = onHeal ?? null;
    currentPage = 'growth';
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
    onHealCallback = null;
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

  if (e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    currentPage = currentPage === 'growth' ? 'healing' : 'growth';
    render();
    return;
  }

  if (currentPage === 'healing') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation(); e.preventDefault();
      if (!e.repeat) beginHealing();
    }
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

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function effectHtml(effect: GrowthEffectPreview): string {
  const gain = effect.gain ? escapeText(effect.gain).replace(/([+−-]?\d+(?:\.\d+)?(?:%|个百分点)?)/g, '<strong>$1</strong>') : '';
  const value = effect.value.split(' · ').map(term => `<span class="growth-term">${escapeText(term)}</span>`).join(' · ');
  return `<div class="growth-effect">
    ${gain ? `<div class="growth-gain" data-growth-gain>${gain}</div>` : ''}
    <div class="growth-effect-total"><span class="readout-label">${escapeText(effect.label)}</span>
      <span>${effect.currentValue === undefined ? '' : `<span class="growth-before">${escapeText(effect.currentValue)} → </span>`}<span class="growth-after">${value}</span></span></div>
    ${effect.note ? `<p class="readout-note growth-mechanic-note">${escapeText(effect.note)}</p>` : ''}
  </div>`;
}

function thickenConsequencesHtml(): string {
  if (gameState.getNextModuleMaxHpCost() === null) return '';
  const preview = previewThickening(gameState.getModules(), gameState.getRepairBonusHp());
  const names: Record<string, string> = { CORE: '核心', STORAGE: '储藏', PURIFIER: '净化器' };
  return `<div class="growth-consequences"><div class="readout-section">加厚后</div>
    <div class="stat-row" data-thicken-consequence="chaos"><span class="readout-label">起始混乱</span><span>${preview.startingChaos} → ${preview.nextStartingChaos}</span></div>
    <p class="readout-note" data-thicken-consequence="refill">当前完整度不增加。补满另需至少 <span class="growth-cost">${preview.refillKindling} 薪柴</span>${gameState.getRepairBonusHp() > 0 ? '，已计一次修复余量' : ''}。</p>
    ${preview.modules.map(module => `<div class="stat-row"><span class="readout-label">${names[module.id] ?? module.id}</span>
      <span>${module.hp} / ${module.maxHp} → ${module.hp} / ${module.nextMaxHp}</span></div>`).join('')}</div>`;
}

function render(selectionOnly = false, revealSelection = false): void {
  if (!panel) return;
  if (currentPage === 'healing') { renderHealing(); return; }
  const reserve = gameState.getKindlingReserve();
  const entries = entriesForDisplay();
  cursorCard = Math.min(cursorCard, entries.length - 1);
  const selected = entries[cursorCard]!;
  const progress = growthSystem.getRouteProgress();
  const state = actionState(selected, reserve);
  const available = state === 'ready';
  const funded = selected.cost !== null && reserve >= selected.cost;
  const reason = !selected.next ? (selected.level === selected.maxLevel ? '已至上限。' : '已永久生效。') : '';
  const list = entries.map((entry, index) => `${index === 0 && entry.next ? '<div class="readout-section">下一次蜕变</div>' : index === (entries[0]?.next ? 1 : 0) ? '<div class="readout-section">已刻入</div>' : ''}
    <div class="upgrade-card${index === cursorCard ? ' card-selected' : ''}${!entry.next ? ' card-maxed' : !entry.unlocked || entry.cost! > reserve ? ' card-locked' : ''}"
      data-id="${entry.id}" data-growth-next="${entry.next}">
    <div class="card-body"><div class="card-name">${entry.name}</div><div class="growth-card-meta"><span class="growth-level">${formatGrowthLevel(entry.targetLevel)}</span>${entry.next ? `<span class="growth-card-state growth-state-${actionState(entry, reserve)}">${entry.unlocked ? entry.cost! <= reserve ? '可刻入' : '薪柴不足' : '尚待经历'}</span>` : ''}</div></div>
    ${entry.cost !== null ? `<div class="card-cost">${entry.cost}<span class="readout-label"> 薪柴</span></div>` : ''}
  </div>`).join('');
  const html = `<div class="panel-heading"><div class="panel-title">蜕变</div><div class="panel-reserve"><span>薪柴</span><strong>${reserve}</strong></div></div>
    ${pagesHtml()}
    <div class="growth-route-line"><span class="readout-note" data-growth-progress>已刻入 ${progress.completed} 项 · 共 ${progress.total} 项${progress.completed === progress.total ? ' · 全部完成' : ''}</span><span data-growth-feedback role="status"></span></div>
    <div class="decision-layout"><div class="decision-main scroll-area readout-list">${list}</div>
      <div class="decision-aside readout-detail"><div class="growth-category">${selected.responsibility}</div><div class="growth-name">${selected.name}</div>
        <div class="growth-level-line"><span>${selected.next ? `${selected.level === 0 ? '首次刻入' : formatGrowthLevel(selected.level)} → ` : ''}<span class="growth-level">${formatGrowthLevel(selected.targetLevel)}</span></span><span class="readout-label">最高 ${formatGrowthLevel(selected.maxLevel)}</span></div>
        ${effectHtml(selected.effect)}
        ${selected.effect.flavor ? `<p class="readout-note growth-flavor">${escapeText(selected.effect.flavor)}</p>` : ''}
        ${selected.requirement && !selected.unlocked ? `<p class="growth-condition growth-state-locked" data-growth-requirement><span>尚待经历</span>${selected.requirement}</p>` : ''}
        ${selected.cost === null ? '' : `<div class="growth-payment"><div class="stat-row"><span class="readout-label">本次消耗</span><span class="growth-cost"><strong>${selected.cost}</strong> 薪柴</span></div>
          <div class="readout-note growth-state-${funded ? 'ready' : 'shortfall'}" data-growth-funds>${funded ? `薪柴充足${available ? ` · 刻入后剩余 ${reserve - selected.cost!} 薪柴` : ''}` : `薪柴不足，还差 ${selected.cost - reserve}。`}</div></div>`}
        ${!reason ? '' : `<p class="readout-note">${reason}</p>`}
        ${thickenSelected() ? thickenConsequencesHtml() : ''}
      </div></div>
    <div class="key-hint-bar"><span><span class="key">↑ ↓</span> 选择</span>
      ${available ? `<span id="growth-confirm-btn" class="growth-state-ready" data-growth-action-state><span class="key">Enter</span> ${thickenSelected() ? '加厚' : '刻入'}</span>` : `<span class="growth-state-${state}" data-growth-action-state>${!selected.next ? '已刻入' : !selected.unlocked ? '尚待经历' : '薪柴不足'}</span>`}
      <span id="growth-close-btn"><span class="key">Esc</span> 离开</span></div>`;
  renderPanelContent(panel, html, selectionOnly);
  if (revealSelection) scrollFocusedIntoView(panel);
  wireEvents(selectionOnly);
  wirePages();
}

function pagesHtml(): string {
  return `<div class="crt-tabs" role="tablist" aria-label="培养藏功能"><button type="button" tabindex="-1" class="crt-tab${currentPage === 'growth' ? ' tab-selected' : ''}" role="tab" aria-selected="${currentPage === 'growth'}" data-cultivation-page="growth">蜕变</button><button type="button" tabindex="-1" class="crt-tab${currentPage === 'healing' ? ' tab-selected' : ''}" role="tab" aria-selected="${currentPage === 'healing'}" data-cultivation-page="healing">疗愈</button><span class="readout-note">Tab 切换</span></div>`;
}

function wirePages(): void {
  panel?.querySelectorAll<HTMLElement>('[data-cultivation-page]').forEach(button => {
    button.onclick = () => { currentPage = button.dataset.cultivationPage === 'healing' ? 'healing' : 'growth'; render(); };
  });
}

function beginHealing(): void {
  if (!onHealCallback || !getHealingPreview().available) return;
  const action = onHealCallback;
  growthPanel.close();
  action();
}

function renderHealing(): void {
  if (!panel) return;
  const preview = getHealingPreview();
  const before = preview.assimilationBefore;
  const after = preview.assimilationAfter;
  const available = preview.available && onHealCallback !== null;
  const reason = preview.reason === 'unaffected' ? '没有需要疗愈的同化。'
    : preview.reason === 'purifier-damaged' ? `净化器当前完整度 ${preview.purifierHp}，疗愈至少需要 ${preview.requiredPurifierHp}。先向净化器投入薪柴。`
    : preview.reason === 'pending-save' ? '记录尚未保存。请先完成保存重试。'
    : !available ? '当前无法开始疗愈。' : '可只疗愈这一轮，保留其余同化。';
  const percent = (value: number): string => `${value.toFixed(1)}%`;
  const sight = (value: number): string => `${Math.round(getAssimilationModulators(100, value).radiusScale * 100)}%`;
  const hostility = (value: number): string => `−${Math.round((1 - assimilationHostilityMultiplier(value)) * 100)}%`;
  const tide = tideSystem.getState();
  const phase = { rise: '涨潮', crest: '潮峰', ebb: '退潮' }[tide.phase];
  const html = `<div class="panel-heading"><div class="panel-title">疗愈</div></div>${pagesHtml()}
    <div class="scroll-area healing-content"><div class="readout-section">深层同化 · 跨趟保留</div>
      <div class="readout-hero healing-change"><span class="growth-before">${percent(before)}</span><span class="readout-note">→</span><strong>${percent(after)}</strong></div>
      <p class="readout-note">本轮降低 ${preview.reduction.toFixed(1)} 个百分点。全部清除还需 ${healingCyclesToClear(before)} 个周期。</p>
      <div class="healing-cost"><div class="growth-name">承受一次冲击</div>
        <div class="stat-row"><span class="readout-label">净化器完整度</span><span>${Number(preview.purifierHp.toFixed(1))} · 至少 ${preview.requiredPurifierHp}</span></div>
        <div class="stat-row"><span class="readout-label">当前潮汐</span><span>第 ${tide.tideNumber} 潮 · ${phase}</span></div>
        <p>每轮疗愈推进一个周期，承受一次当前潮汐的冲击。供奉照常防御、积累；不会带回薪柴。</p></div>
      <div class="readout-section">疗愈之后</div>
      <div class="stat-row"><span class="readout-label">满污染时可见半径</span><span>${sight(before)} → ${sight(after)}</span></div>
      <div class="stat-row"><span class="readout-label">未激怒敌人的感知距离</span><span>${hostility(before)} → ${hostility(after)}</span></div>
      <p class="readout-note">压回同化，也会失去一部分裂隙适应。主动攻击和接触污染仍有危险。</p>
      <p class="${available ? 'readout-note' : 'growth-state-shortfall'}" data-healing-reason>${reason}</p>
    </div><div class="key-hint-bar"><button type="button" id="healing-confirm-btn" ${available ? '' : 'disabled'}><span class="key">Enter</span> 疗愈一周期</button><span id="growth-close-btn"><span class="key">Esc</span> 离开</span></div>`;
  renderPanelContent(panel, html, false);
  wirePages();
  panel.querySelector('#healing-confirm-btn')?.addEventListener('click', beginHealing);
  panel.querySelector('#growth-close-btn')?.addEventListener('click', () => growthPanel.close());
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
    showPurchaseFlash(GROWTH_UPGRADE_NAMES[id], result.newLevel);
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
  showPurchaseFlash('加厚', result.newLevel);
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

function showPurchaseFlash(name: string, newLevel: number): void {
  if (!panel) return;
  // Transient feedback must not push the next action or thickening costs down.
  const feedback = panel.querySelector('[data-growth-feedback]');
  if (!feedback) return;
  feedback.textContent = `${name} · ${formatGrowthLevel(newLevel)} 已刻入`;
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
