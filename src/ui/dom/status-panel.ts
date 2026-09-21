/**
 * 存续报告：四分页、模块列表与单项详情；出击条件与自身完整度明确归属。
 * 迭代 11 DEC-119；共享终端样式，挂 #dom-ui-root。
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_DISPLAY, GROWTH_UPGRADE_NAMES, formatGrowthLevel } from '@/config/growth-upgrade-display';
import { gameState } from '@/managers/game-state';
import type { ModuleType } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { openInventory } from '@/ui/inventory-presenter';
import { inventoryPanel } from './inventory-panel';
import { impactSystem, SEVERITY_LABEL } from '@/systems/impact-system';
import { INSPECT_EMPTY_HTML } from './inspect-dock';
import { BAR_COLOR, MODULE_LABEL, MODULE_ORDER } from './module-identity-strip';
import { formatChaosRateDelta } from '@/ui/side-effect-labels';
import type { InteractionTargetType } from './purification-hud';
import type { GrowthUpgradeId, TidePhase } from '@/types/game-types';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';
import { renderPanelContent } from './panel-render-state';

const TABS = ['装置', '物件', '潮汐', '蜕变'] as const;
type TabIndex = 0 | 1 | 2 | 3;

const MODULE_HP_LABEL: Record<ModuleType, string> = {
  CORE: '核心完整度',
  STORAGE: '储藏完整度',
  PURIFIER: '净化器完整度',
};

const PHASE_LABEL: Record<TidePhase, string> = {
  rise: '涨潮',
  crest: '潮峰',
  ebb: '退潮',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onOfferingCallback: (() => void) | null = null;
let onCloseCallback: (() => void) | null = null;

let activeTab: TabIndex = 0;
let approachedModule: ModuleType | null = null;
let selectedModule: ModuleType = 'CORE';
let cursorIndex = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const statusPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(onClose?: () => void, nearestOverlap?: InteractionTargetType | null, onOffering?: () => void): void {
    if (panel) return;
    onCloseCallback = onClose ?? null;
    onOfferingCallback = onOffering ?? null;
    activeTab = 0;
    cursorIndex = 0;
    approachedModule = overlapToModule(nearestOverlap);
    selectedModule = approachedModule ?? 'CORE';
    createPanel();
    audioManager.playSFX('sfx-ui-open');
  },

  close(): void {
    if (!panel) return;
    audioManager.playSFX('sfx-ui-close');
    destroyPanel();
    onCloseCallback?.();
    onCloseCallback = null;
    onOfferingCallback = null;
  },
};

function overlapToModule(overlap: InteractionTargetType | null | undefined): ModuleType | null {
  if (overlap === 'core') return 'CORE';
  if (overlap === 'storage') return 'STORAGE';
  if (overlap === 'purifier') return 'PURIFIER';
  return null;
}

// ---------------------------------------------------------------------------
// Panel creation
// ---------------------------------------------------------------------------

function createPanel(): void {
  panel = createCrtPanel('status-panel');
  panel.classList.add('scene-menu', 'scene-menu-report');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop scene-menu-backdrop';
  backdrop.id = 'status-backdrop';
  root.appendChild(backdrop);

  root.appendChild(panel);
  render();
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  inventoryPanel.close();
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('status-backdrop')?.remove();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' || e.key === 'Tab') {
    e.stopPropagation();
    e.preventDefault();
    statusPanel.close();
    return;
  }

  if (e.key === '[' || e.code === 'BracketLeft') {
    e.stopPropagation();
    e.preventDefault();
    setTab(((activeTab + TABS.length - 1) % TABS.length) as TabIndex);
    return;
  }
  if (e.key === ']' || e.code === 'BracketRight') {
    e.stopPropagation();
    e.preventDefault();
    setTab(((activeTab + 1) % TABS.length) as TabIndex);
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    if (activeTab === 0) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const idx = MODULE_ORDER.indexOf(selectedModule);
        selectedModule = MODULE_ORDER[(idx + dir + MODULE_ORDER.length) % MODULE_ORDER.length]!;
        render(true, true);
      }
      return;
    }
    if (activeTab === 2) return;
    const count = getInspectableCount();
    if (count === 0) return;
    cursorIndex = (cursorIndex + dir + count) % count;
    render(true, true);
  }
}

function setTab(next: TabIndex): void {
  activeTab = next;
  cursorIndex = 0;
  render(false, false, true);
}

function getInspectableCount(): number {
  if (activeTab === 1) return 0;
  if (activeTab === 3) return listInscribedIds().length;
  return 0;
}

function listInscribedIds(): GrowthUpgradeId[] {
  return growthSystem.getAllUpgradeIds().filter((id) => growthSystem.getLevel(id) > 0);
}

function integrityWord(hp: number, maxHp: number): string {
  const pct = maxHp <= 0 ? 0 : (hp / maxHp) * 100;
  if (pct > 60) return '健康';
  if (pct >= 30) return '受损';
  return '严重受损';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(selectionOnly = false, revealSelection = false, resetScroll = false): void {
  if (!panel) return;

  let html = `<div class="panel-heading"><div class="panel-title">存续报告</div><div class="panel-reserve"><span>薪柴</span><strong>${gameState.getKindlingReserve()}</strong></div></div>`;
  html += tabsHtml();
  html += detailHtml();
  html += `<div class="key-hint-bar">
    <span><span class="key">[</span> <span class="key">]</span> 切页</span>
    <span><span class="key">↑↓←→</span> 浏览</span>
    <span id="status-close-btn"><span class="key">Tab</span> / <span class="key">Esc</span> 合上</span>
  </div>`;

  inventoryPanel.close();
  renderPanelContent(panel, html, selectionOnly, resetScroll);
  if (revealSelection) scrollFocusedIntoView(panel);
  bindEvents(selectionOnly);
  if (activeTab === 1) openInventory({ mode: 'catalog', mount: panel.querySelector<HTMLElement>('#status-inventory-host')!, onClose: () => {}, onOffering: onOfferingCallback ? () => { const callback = onOfferingCallback; statusPanel.close(); callback?.(); } : undefined });
}

function tabsHtml(): string {
  const items = TABS.map((name, i) => {
    const selected = activeTab === i ? ' is-selected' : '';
    return `<div class="crt-tab${selected}" data-tab="${i}">${name}</div>`;
  }).join('');
  return `<div class="crt-tabs">${items}</div>`;
}

function detailHtml(): string {
  if (activeTab === 0) return deviceDetailHtml();
  if (activeTab === 1) return '<div id="status-inventory-host" style="min-height:0;flex:1;display:flex;"></div>';
  if (activeTab === 2) return tideDetailHtml();
  return growthDetailHtml();
}

function deviceDetailHtml(): string {
  const mod = gameState.getModule(selectedModule);
  const mods = gameState.getSortieModifiers();
  const playerHp = GAME_CONSTANTS.PLAYER.MAX_HEALTH + growthSystem.getModifiers().vitalityBonus;
  const forecast = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'));
  const list = MODULE_ORDER.map((id) => {
    const item = gameState.getModule(id);
    if (!item) return '';
    return `<div class="module-report-row${id === selectedModule ? ' is-selected' : ''}" data-module-id="${id}">
      <div class="readout-label">${MODULE_LABEL[id]}</div><div>${item.hp} / ${item.maxHp}</div>
      <div class="pbar-wrap"><div class="pbar-fill" style="width:${item.hp / item.maxHp * 100}%;background:${BAR_COLOR[id]};"></div></div>
    </div>`;
  }).join('');
  const effectCopy = selectedModule === 'CORE' ? '核心抑制裂隙中的混乱增长。'
    : selectedModule === 'STORAGE' ? '储藏提高带回薪柴的价值。' : '净化器降低踏入裂隙时的起始混乱。';
  const body = mod ? `<div class="readout-hero"><span class="readout-label">${MODULE_HP_LABEL[selectedModule]}</span><span class="readout-value">${mod.hp} / ${mod.maxHp}</span></div>
    <div class="readout-note">${integrityWord(mod.hp, mod.maxHp)}${forecast?.targetId === selectedModule ? ' · 下次冲击预告目标' : ''}</div>
    <p class="readout-copy">${effectCopy}</p>
    ${gameState.isModuleSwapActive() ? '<p class="readout-note">功能互换生效中：核心与储藏互用完整度计算效果。</p>' : ''}
    <div class="readout-section">下次踏入</div>
    <div class="stat-row"><span class="readout-label">自身完整度</span><span class="readout-value">${playerHp}</span></div>
    <div class="readout-metrics">
      <div class="readout-metric"><span class="readout-label">混乱增速</span><span class="readout-value">${formatChaosRateDelta(mods.chaosRateModifier)}</span></div>
      <div class="readout-metric"><span class="readout-label">薪柴价值</span><span class="readout-value">x${mods.kindlingValueModifier.toFixed(2)}</span></div>
      <div class="readout-metric"><span class="readout-label">起始混乱</span><span class="readout-value">${mods.startingChaos}</span></div>
    </div>` : '';
  return `<div class="module-report-layout"><div class="module-report-list">${list}</div><div class="readout-detail">${body}</div></div>`;
}

function tideDetailHtml(): string {
  const state = tideSystem.getState();
  const forecast = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'));
  const target = forecast ? MODULE_LABEL[forecast.targetId as ModuleType] : null;
  return `<div class="scroll-area">
    <div class="readout-section">下次归来</div>
    ${forecast ? `<div class="readout-hero"><span class="readout-label">${forecast.targetCertain ? '重点已辨明' : '重点推测'}</span><span class="readout-value">${target}</span></div>
      <div class="stat-row"><span class="readout-label">${forecast.severityCertain ? '强度已辨明' : '强度推测'}</span><span>${SEVERITY_LABEL[forecast.severity]}</span></div>
      ${forecast.baseDamagePerModule ? `<div class="readout-section">供奉作用前</div>${MODULE_ORDER.map(id => `<div class="stat-row"><span class="readout-label">${MODULE_LABEL[id]}</span><span class="readout-value">${forecast.baseDamagePerModule![id] ?? 0}</span></div>`).join('')}<p class="readout-note">原始压力；供奉反应与当前完整度会改变实际损失。</p>` : ''}
      ${forecast.legacy && !forecast.targetCertain && growthSystem.getLevel('growth_forecast_clarity') > 0 ? '<p class="readout-note">沿用上次留下的预告；新读取能力从下一份预告生效。</p>' : ''}` : '<p class="readout-note">暂无冲击预告。</p>'}
    <div class="stat-row"><span class="readout-label">潮汐</span><span>第 ${state.tideNumber} 潮</span><span>${PHASE_LABEL[state.phase]}</span></div>
    <div class="separator"></div><div class="readout-section">净化稳定度</div>
    <div class="readout-hero"><span class="readout-value">${Math.round(stabilityTracker.getProgress())}%</span><span>${stabilityTracker.isReached() ? '已完成' : '未完成'}</span></div>
  </div>`;
}

function growthDetailHtml(): string {
  const tier = gameState.getModuleMaxHpTier();
  const maxHp = gameState.getModuleMaxHp();
  const inscribed = listInscribedIds();
  if (cursorIndex >= inscribed.length) cursorIndex = Math.max(0, inscribed.length - 1);

  let body = `<div class="stat-row">
      <span class="stat-label">加厚</span>
      <span>${formatGrowthLevel(tier)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">每台装置完整度上限</span>
      <span class="stat-value">${maxHp}</span>
    </div>`;

  if (inscribed.length === 0) {
    body += emptyStateHtml('尚未刻入改造', '培养藏可消耗薪柴刻入永久改造。', '关闭报告，前往培养藏查看蜕变。');
  } else {
    body += `<div class="readout-list">`;
    inscribed.forEach((id, i) => {
      const selected = i === cursorIndex;
      const level = growthSystem.getLevel(id);
      body += `<div class="item-tile${selected ? ' tile-selected' : ''}" data-inspect-index="${i}">
        <span>${GROWTH_UPGRADE_NAMES[id]}</span>
        <span>${formatGrowthLevel(level)}</span>
      </div>`;
    });
    body += `</div>`;
  }

  let html = `<div class="scroll-area">${body}</div>`;
  if (inscribed.length > 0) {
    html = `<div class="decision-layout"><div class="decision-main scroll-area">${body}</div><div class="decision-aside readout-detail inspect-dock" id="status-inspect-dock">${computeUpgradeInspectHtml(inscribed)}</div></div>`;
  }
  return html;
}

function emptyStateHtml(title: string, reason: string, nextAction: string): string {
  return `<div class="readout-empty"><div class="readout-section">${title}</div><p class="readout-copy">${reason}</p><p class="readout-note">${nextAction}</p></div>`;
}

function bindEvents(selectionOnly = false): void {
  if (!panel) return;

  panel.querySelector('#status-close-btn')?.addEventListener('click', () => {
    statusPanel.close();
  });

  if (selectionOnly) return;

  panel.querySelectorAll<HTMLElement>('.crt-tab[data-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.tab!, 10) as TabIndex;
      if (idx === activeTab) return;
      setTab(idx);
    });
  });

  panel.querySelectorAll<HTMLElement>('[data-module-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.moduleId as ModuleType;
      if (!MODULE_ORDER.includes(id)) return;
      selectedModule = id;
      activeTab = 0;
      cursorIndex = 0;
      render(true);
    });
  });

  panel.querySelectorAll<HTMLElement>('.item-tile[data-inspect-index]').forEach((el) => {
    el.addEventListener('pointermove', () => {
      const idx = parseInt(el.dataset.inspectIndex!, 10);
      if (Number.isNaN(idx) || idx === cursorIndex) return;
      cursorIndex = idx;
      render(true);
    });
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.inspectIndex!, 10);
      if (Number.isNaN(idx) || idx === cursorIndex) return;
      cursorIndex = idx;
      render(true);
    });
  });
}

function computeUpgradeInspectHtml(inscribed: GrowthUpgradeId[]): string {
  const id = inscribed[cursorIndex];
  if (!id) return INSPECT_EMPTY_HTML;
  const display = GROWTH_UPGRADE_DISPLAY.find((u) => u.id === id);
  const level = growthSystem.getLevel(id);
  const name = display?.name ?? GROWTH_UPGRADE_NAMES[id];
  const effect = display?.effectLabel(level, level) ?? '';
  return `<div class="inspect-l1">${name}</div>
    <div class="inspect-l2">${formatGrowthLevel(level)} · 最高 ${formatGrowthLevel(growthSystem.getMaxLevel(id))}</div>
    <div class="inspect-l3">${effect}</div>`;
}
