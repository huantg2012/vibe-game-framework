/**
 * StatusPanel — 存续报告墙机（载体 B）。
 *
 * I11-B4a：顶三格身份带 + 4 个顶 Tab + 整宽详情 + 底键印。
 * 主-从：详情只讲当前选中项。出击预估只读 getSortieModifiers() 三项。
 * 键鼠同一通道：无 hoverIndex。挂 #dom-ui-root。
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_DISPLAY, GROWTH_UPGRADE_NAMES } from '@/config/growth-upgrade-display';
import { gameState } from '@/managers/game-state';
import type { ModuleType } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { contaminantSystem } from '@/systems/contaminant-system';
import { impactSystem } from '@/systems/impact-system';
import { getDefenseName, getRarityStars, getToolName, sortContaminants } from '@/ui/contaminant-names';
import { buildDefenseInspectHtml, buildToolInspectHtml, INSPECT_EMPTY_HTML } from './inspect-dock';
import { DIM, MODULE_ORDER, identityBandHtml } from './module-identity-strip';
import { formatChaosRateDelta } from '@/ui/side-effect-labels';
import type { InteractionTargetType } from './purification-hud';
import type { Contaminant, GrowthUpgradeId, TidePhase } from '@/types/game-types';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';

const RARITY_COLORS: Record<string, string> = {
  common: '#8a8f96',
  fine: '#1aad96',
  rare: '#3cffd4',
};

const TABS = ['装置', '残渣', '潮汐', '蜕变'] as const;
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

  open(onClose?: () => void, nearestOverlap?: InteractionTargetType | null): void {
    if (panel) return;
    onCloseCallback = onClose ?? null;
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

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'status-backdrop';
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
        render();
      }
      return;
    }
    if (activeTab === 2) return;
    const count = getInspectableCount();
    if (count === 0) return;
    cursorIndex = (cursorIndex + dir + count) % count;
    render();
  }
}

function setTab(next: TabIndex): void {
  activeTab = next;
  cursorIndex = 0;
  render();
}

function getInspectableCount(): number {
  if (activeTab === 1) return listResidueInspectable().length;
  if (activeTab === 3) return listInscribedIds().length;
  return 0;
}

function listResidueInspectable(): Contaminant[] {
  const all = contaminantSystem.getAll();
  const defenseItems = sortContaminants(all.filter((c) => c.stage === 'defense'));
  const toolItems = sortContaminants(all.filter((c) => c.stage === 'tool'));
  return [...defenseItems, ...toolItems];
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

function render(): void {
  if (!panel) return;

  let html = `<div class="panel-title">存续报告</div>`;
  html += identityBandHtml({
    activeId: approachedModule,
    selectedId: selectedModule,
    clickable: true,
  });
  html += tabsHtml();
  html += detailHtml();
  html += `<div class="key-hint-bar">
    <span><span class="key">[</span> <span class="key">]</span> 切页</span>
    <span><span class="key">↑↓←→</span> 浏览</span>
    <span id="status-close-btn"><span class="key">Tab</span> / <span class="key">Esc</span> 合上</span>
  </div>`;

  panel.innerHTML = html;
  scrollFocusedIntoView(panel);
  bindEvents();
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
  if (activeTab === 1) return residueDetailHtml();
  if (activeTab === 2) return tideDetailHtml();
  return growthDetailHtml();
}

function deviceDetailHtml(): string {
  const mod = gameState.getModule(selectedModule);
  const mods = gameState.getSortieModifiers();
  const playerHp = GAME_CONSTANTS.PLAYER.MAX_HEALTH + growthSystem.getModifiers().vitalityBonus;
  const forecast = impactSystem.getForecastDisplay();
  const swapActive = gameState.isModuleSwapActive();

  let body = '';
  if (mod) {
    body += `<div class="stat-row">
      <span class="stat-label">${MODULE_HP_LABEL[selectedModule]}</span>
      <span class="stat-value">${mod.hp}</span>
      <span style="color:${DIM};">/</span>
      <span class="stat-value">${mod.maxHp}</span>
    </div>`;
    body += `<div class="stat-row"><span>${integrityWord(mod.hp, mod.maxHp)}</span></div>`;
    body += moduleEffectRow(selectedModule, mods);
  }
  body += `<div class="stat-row">
    <span class="stat-label">完整度</span>
    <span class="stat-value">${playerHp}</span>
  </div>`;
  if (forecast?.targetId === selectedModule) {
    body += `<div class="stat-row"><span class="stat-label">下次冲击目标</span></div>`;
  }
  if (swapActive) {
    body += `<div class="stat-row">
      <span class="stat-label">功能互换</span>
      <span>生效中</span>
    </div>`;
  }

  body += `<div style="margin-top:auto;padding-top:8px;">
    <div class="stat-row"><span class="stat-label">出击预估</span></div>
    <div class="stat-row">
      <span class="stat-label">混乱增速</span>
      <span class="stat-value" style="color:#1aad96;font-size:13px;">${formatChaosRateDelta(mods.chaosRateModifier)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">薪柴价值</span>
      <span class="stat-value" style="color:#c4873a;font-size:13px;">x${mods.kindlingValueModifier.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">起始混乱</span>
      <span class="stat-value" style="color:#1aad96;font-size:13px;">${mods.startingChaos}</span>
    </div>
  </div>`;

  return `<div class="scroll-area" style="display:flex;flex-direction:column;">${body}</div>`;
}

function moduleEffectRow(
  id: ModuleType,
  mods: { chaosRateModifier: number; kindlingValueModifier: number; startingChaos: number },
): string {
  if (id === 'CORE') {
    return `<div class="stat-row">
      <span class="stat-label">混乱增速</span>
      <span class="stat-value" style="color:#1aad96;font-size:13px;">${formatChaosRateDelta(mods.chaosRateModifier)}</span>
    </div>`;
  }
  if (id === 'STORAGE') {
    return `<div class="stat-row">
      <span class="stat-label">薪柴价值</span>
      <span class="stat-value" style="color:#c4873a;font-size:13px;">x${mods.kindlingValueModifier.toFixed(2)}</span>
    </div>`;
  }
  return `<div class="stat-row">
    <span class="stat-label">起始混乱</span>
    <span class="stat-value" style="color:#1aad96;font-size:13px;">${mods.startingChaos}</span>
  </div>`;
}

function residueDetailHtml(): string {
  const all = contaminantSystem.getAll();
  const defenseItems = sortContaminants(all.filter((c) => c.stage === 'defense'));
  const toolItems = sortContaminants(all.filter((c) => c.stage === 'tool'));
  const brokenItems = sortContaminants(all.filter((c) => c.stage === 'broken'));
  const inspectable = [...defenseItems, ...toolItems];
  if (cursorIndex >= inspectable.length) cursorIndex = Math.max(0, inspectable.length - 1);
  const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;
  const empty = defenseItems.length === 0 && toolItems.length === 0 && brokenItems.length === 0;

  let body = '';
  if (empty) {
    body += emptyStateHtml('残渣', '0', '工具', '0', '踏入裂隙');
  } else {
    if (defenseItems.length > 0) {
      body += groupLabelHtml('残渣');
      body += `<div class="tile-grid">`;
      defenseItems.forEach((c, i) => {
        body += residueTileHtml(c, i, inspectable, 'defense', threshold);
      });
      body += `</div>`;
    }
    if (toolItems.length > 0) {
      body += groupLabelHtml('工具');
      body += `<div class="tile-grid">`;
      toolItems.forEach((c, i) => {
        body += residueTileHtml(c, defenseItems.length + i, inspectable, 'tool', 0);
      });
      body += `</div>`;
    }
    if (brokenItems.length > 0) {
      body += groupLabelHtml('破碎');
      body += `<div class="tile-grid">`;
      for (const c of brokenItems) {
        const name = getDefenseName(c.type);
        body += `<div class="item-tile"><span>${name}</span></div>`;
      }
      body += `</div>`;
    }
  }

  let html = `<div class="scroll-area">${body}</div>`;
  if (inspectable.length > 0) {
    html += `<div class="inspect-dock" id="status-inspect-dock">${computeResidueInspectHtml(inspectable, threshold)}</div>`;
  }
  return html;
}

function residueTileHtml(
  c: Contaminant,
  inspectIndex: number,
  inspectable: Contaminant[],
  kind: 'defense' | 'tool',
  threshold: number,
): string {
  const name = kind === 'defense' ? getDefenseName(c.type) : getToolName(c.type);
  const color = RARITY_COLORS[c.rarity] ?? '#8a8f96';
  const selected = inspectable[cursorIndex] === c;
  const extra = kind === 'defense'
    ? `<span style="color:#8a8f96;">${c.impactCharges}/${threshold}</span>`
    : `<span style="color:#8a8f96;">${c.usesRemaining}</span>`;
  return `<div class="item-tile${selected ? ' tile-selected' : ''}" data-inspect-index="${inspectIndex}">
    <span style="color:${color};">${name}</span>
    <span style="color:${color};">${getRarityStars(c.rarity)}</span>
    ${extra}
  </div>`;
}

function tideDetailHtml(): string {
  const tideState = tideSystem.getState();
  const phase = PHASE_LABEL[tideState.phase];
  const reached = stabilityTracker.isReached();
  const stabilityPct = `${Math.round(stabilityTracker.getProgress())}%`;
  const reachedWord = reached ? '已完成' : '未完成';
  const body = `<div class="stat-row">
      <span class="stat-label">潮汐</span>
      <span>第 ${tideState.tideNumber} 潮</span>
      <span>${phase}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">稳定度</span>
      <span class="stat-value">${stabilityPct}</span>
      <span>${reachedWord}</span>
    </div>`;
  return `<div class="scroll-area">${body}</div>`;
}

function growthDetailHtml(): string {
  const tier = gameState.getModuleMaxHpTier();
  const maxHp = gameState.getModuleMaxHp();
  const inscribed = listInscribedIds();
  if (cursorIndex >= inscribed.length) cursorIndex = Math.max(0, inscribed.length - 1);

  let body = `<div class="stat-row">
      <span class="stat-label">加厚</span>
      <span>第 ${tier} 档</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">全部上限</span>
      <span class="stat-value">${maxHp}</span>
    </div>`;

  if (inscribed.length === 0) {
    body += emptyStateHtml('刻入', '0', '全部上限', String(maxHp), '蜕变');
  } else {
    body += `<div class="tile-grid">`;
    inscribed.forEach((id, i) => {
      const selected = i === cursorIndex;
      const level = growthSystem.getLevel(id);
      body += `<div class="item-tile${selected ? ' tile-selected' : ''}" data-inspect-index="${i}">
        <span>${GROWTH_UPGRADE_NAMES[id]}</span>
        <span>${level}</span>
      </div>`;
    });
    body += `</div>`;
  }

  let html = `<div class="scroll-area">${body}</div>`;
  if (inscribed.length > 0) {
    html += `<div class="inspect-dock" id="status-inspect-dock">${computeUpgradeInspectHtml(inscribed)}</div>`;
  }
  return html;
}

function groupLabelHtml(label: string): string {
  return `<div style="font-size:12px;color:${DIM};margin:6px 0 4px;">${label}</div>`;
}

function emptyStateHtml(
  why1Label: string,
  why1Value: string,
  why2Label: string,
  why2Value: string,
  nextAction: string,
): string {
  return `<div class="crt-empty">
    <div class="crt-empty-mark"></div>
    <div>
      <div class="crt-empty-why"><span>${why1Label}</span><span>${why1Value}</span></div>
      <div class="crt-empty-why"><span>${why2Label}</span><span>${why2Value}</span></div>
      <div class="crt-empty-next"><span class="empty-key">[E]</span> <span>${nextAction}</span></div>
    </div>
  </div>`;
}

function bindEvents(): void {
  if (!panel) return;

  panel.querySelector('#status-close-btn')?.addEventListener('click', () => {
    statusPanel.close();
  });

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
      render();
    });
  });

  panel.querySelectorAll<HTMLElement>('.item-tile[data-inspect-index]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      const idx = parseInt(el.dataset.inspectIndex!, 10);
      if (Number.isNaN(idx) || idx === cursorIndex) return;
      cursorIndex = idx;
      render();
    });
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.inspectIndex!, 10);
      if (Number.isNaN(idx) || idx === cursorIndex) return;
      cursorIndex = idx;
      render();
    });
  });
}

function isDefenseSlotted(id: string): boolean {
  return contaminantSystem.getDefenseSlotted().some((c) => c?.id === id);
}

function computeResidueInspectHtml(inspectable: Contaminant[], threshold: number): string {
  const c = inspectable[cursorIndex];
  if (!c) return INSPECT_EMPTY_HTML;

  if (c.stage === 'defense') {
    const slotted = isDefenseSlotted(c.id);
    return buildDefenseInspectHtml(c, {
      chargeThreshold: threshold,
      slotState: slotted ? 'slotted' : 'unslotted',
      canEquip: true,
    });
  }

  const sortieSlots = contaminantSystem.getSortieLoadout();
  const slotIndex = sortieSlots.findIndex((s) => s?.id === c.id);
  if (slotIndex >= 0) {
    const passiveIndex = contaminantSystem.getSortiePassiveSlotIndex();
    const isPassiveSlot = slotIndex === passiveIndex;
    const hotkeyLabel = isPassiveSlot ? undefined : GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[slotIndex];
    return buildToolInspectHtml(c, { slotState: 'slotted', hotkeyLabel, canEquip: true });
  }
  return buildToolInspectHtml(c, { slotState: 'unslotted', canEquip: true });
}

function computeUpgradeInspectHtml(inscribed: GrowthUpgradeId[]): string {
  const id = inscribed[cursorIndex];
  if (!id) return INSPECT_EMPTY_HTML;
  const display = GROWTH_UPGRADE_DISPLAY.find((u) => u.id === id);
  const level = growthSystem.getLevel(id);
  const maxLevel = growthSystem.getMaxLevel(id);
  const name = display?.name ?? GROWTH_UPGRADE_NAMES[id];
  const effect = display?.effectLabel(level, maxLevel) ?? '';
  return `<div class="inspect-l1">${name}</div>
    <div class="inspect-l2"><span>等级</span> <span>${level}</span></div>
    <div class="inspect-l3">${effect}</div>`;
}
