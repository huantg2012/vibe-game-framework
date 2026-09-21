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

const PENDING_ID = 'pending' as const;
interface GrowthEntry {
  id: GrowthUpgradeId | typeof THICKEN_ID | typeof PENDING_ID;
  name: string; level: number; cost: number | null; effect: string;
  unlocked: boolean; reason: string | null; responsibility: string;
}
const RESPONSIBILITY: Record<string, string> = {
  body: '身体适应', base: '装置建设', equipment: '出击携带',
};
const EXPERIENCE: Record<string, string> = {
  impactExperienced: '需经历一次实际冲击（初次归来的免伤不计）',
  offeringCompleted: '需让一个物件完成供奉',
  toolRevealed: '需在供奉后揭晓一件可携入裂隙的污染物',
  crestExperienced: '需经历一次潮峰，抵达退潮',
};
function entriesForDisplay(): GrowthEntry[] {
  const entries: GrowthEntry[] = [];
  const pending = new Set<string>();
  for (const upgrade of UPGRADES) {
    const availability = growthSystem.getAvailability(upgrade.id);
    if (!availability.visible) {
      if (availability.reason) pending.add(EXPERIENCE[availability.reason] ?? availability.reason);
      continue;
    }
    const level = growthSystem.getLevel(upgrade.id);
    const maxLevel = growthSystem.getMaxLevel(upgrade.id);
    const definition = growthSystem.getUpgradeDefinition(upgrade.id);
    entries.push({ id: upgrade.id, name: definition.name, level,
      cost: level >= maxLevel ? null : growthSystem.getCost(upgrade.id),
      effect: upgrade.effectLabel(level, maxLevel), unlocked: availability.unlocked,
      reason: availability.reason ? EXPERIENCE[availability.reason] ?? availability.reason : null,
      responsibility: RESPONSIBILITY[definition.responsibility] ?? '' });
  }
  const max = gameState.getModuleMaxHp();
  const cost = gameState.getNextModuleMaxHpCost();
  entries.push({ id: THICKEN_ID, name: '加厚', level: gameState.getModuleMaxHpTier(), cost,
    effect: thickenEffectHtml(max, cost === null ? null : max + GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER, cost === null),
    unlocked: cost !== null, reason: null, responsibility: '装置建设' });
  if (pending.size) entries.push({ id: PENDING_ID, name: '尚待经历', level: 0, cost: null,
    effect: [...pending].join('；'), unlocked: false, reason: '真实经历会让新的改造可被辨认。', responsibility: '未展开' });
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
    commitSelectedCard();
  }
}

function commitSelectedCard(): void {
  const selected = entriesForDisplay()[cursorCard];
  if (!selected || !selected.unlocked) return;
  if (selected.id === THICKEN_ID) purchaseThicken();
  else if (selected.id !== PENDING_ID) purchaseCard(selected.id);
}

function thickenSelected(): boolean {
  return entriesForDisplay()[cursorCard]?.id === THICKEN_ID;
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
  const isPending = selected.id === PENDING_ID;
  const available = selected.unlocked && selected.cost !== null && reserve >= selected.cost;
  const reason = isPending ? selected.reason : selected.cost === null ? '已至上限。'
    : !selected.unlocked ? selected.reason : available ? '消耗薪柴后永久生效。'
    : `薪柴不足，还差 ${selected.cost - reserve}。`;
  const list = entries.map((entry, index) => `<div class="upgrade-card${index === cursorCard ? ' card-selected' : ''}${entry.id === PENDING_ID ? ' card-locked' : entry.cost === null ? ' card-maxed' : !entry.unlocked ? ' card-locked' : entry.cost > reserve ? ' card-locked' : ''}" data-id="${entry.id}">
    <div class="card-body"><div class="card-name">${entry.name}</div><div class="readout-note">${entry.id === PENDING_ID ? '随经历展开' : entry.level > 0 ? `已刻入 ${entry.level}${entry.cost === null ? ' · 已至上限' : ''}` : entry.responsibility}</div></div>
    ${entry.cost !== null ? `<div class="card-cost">${entry.cost}<span class="readout-label"> 薪柴</span></div>` : ''}
  </div>`).join('');
  const html = `<div class="panel-heading"><div class="panel-title">蜕变</div><div class="panel-reserve"><span>薪柴</span><strong>${reserve}</strong></div></div>
    <div class="decision-layout"><div class="decision-main scroll-area readout-list">${list}</div>
      <div class="decision-aside readout-detail"><div class="readout-section">${selected.responsibility} · ${selected.name}</div>
        ${isPending || thickenSelected() ? '' : `<div class="readout-hero"><span class="readout-label">已刻入等级</span><span class="readout-value">${selected.level}</span></div>`}
        <div class="readout-copy">${selected.effect}</div><div class="separator"></div>
        ${selected.cost === null ? '' : `<div class="stat-row"><span class="readout-label">本次消耗</span><span class="readout-value">${selected.cost}</span><span>薪柴</span></div>`}
        ${available ? `<div class="readout-note">完成后剩余 ${reserve - selected.cost!} 薪柴</div>` : ''}
        ${thickenSelected() && available ? '' : `<p class="readout-note">${reason}</p>`}
        ${thickenSelected() ? thickenConsequencesHtml() : ''}
      </div></div>
    <div class="key-hint-bar"><span><span class="key">↑ ↓</span> 选择</span>
      ${available ? `<span id="growth-confirm-btn"><span class="key">Enter</span> ${thickenSelected() ? '加厚' : '刻入'}</span>` : `<span>${isPending || !selected.unlocked && selected.cost !== null ? '尚待经历' : selected.cost === null ? '已至上限' : '薪柴不足'}</span>`}
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
  render();
  showPurchaseFlash('加厚', result.newLevel, '档');
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
  let flag: string | null;
  try { flag = localStorage.getItem('coh_first_growth_done'); } catch { return; }
  if (flag) return;

  const ids = growthSystem.getAllUpgradeIds();
  const otherLevels = ids.filter((i) => i !== id).map((i) => growthSystem.getLevel(i));
  if (otherLevels.some((l) => l > 0)) return;

  try { localStorage.setItem('coh_first_growth_done', '1'); } catch { return; }

  // C6: migrated onto the shared `.toast-stamp` primitive (was a hand-rolled overlay
  // with an equivalent but independently-maintained dismiss-on-click/key/timeout).
  setTimeout(() => showToastStamp('已刻入'), 300);
}
