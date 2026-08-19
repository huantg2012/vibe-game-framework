/**
 * AllocationPanel - DOM overlay for allocating kindling to a module.
 *
 * Game-style layout: visual progress bar for module HP, preview fill for
 * allocation amount, compact +/- bar controls, inline confirm.
 */

import { eventBus } from '@/core/event-bus';
import { computeStartingChaos, gameState } from '@/managers/game-state';
import type { ModuleType } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { GameEvent } from '@/types/events';
import { GAME_CONSTANTS } from '@/config/constants';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';

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

  panel = createCrtPanel('allocation-panel');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'allocation-backdrop';
  root.appendChild(backdrop);

  render(mod.type, mod.hp, mod.maxHp);
  root.appendChild(panel);

  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('allocation-backdrop')?.remove();
  currentModuleId = null;
  selectedAmount = 0;
}

// Direct amount adjustment (IA §S3 交互契约: ←→ ±1 / Shift+←→ ±5 / Home 归零 /
// End 拉满 / Enter 注入 / Esc 离开). There is no list of selectable options here —
// the amount itself is the thing keyboard input drives, so no cursor/"已选中"
// state is needed (this satisfies "键盘可达" without a button-focus model).
function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    allocationPanel.close();
    return;
  }

  const mod = currentModuleId ? gameState.getModule(currentModuleId) : null;
  if (!mod) return;
  const maxAllocatable = getMaxAllocatable(mod.hp, mod.maxHp);

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    selectedAmount = Math.max(0, Math.min(maxAllocatable, selectedAmount + dir * step));
    rerender();
    return;
  }

  if (e.key === 'Home') {
    e.stopPropagation();
    e.preventDefault();
    selectedAmount = 0;
    rerender();
    return;
  }

  if (e.key === 'End') {
    e.stopPropagation();
    e.preventDefault();
    selectedAmount = maxAllocatable;
    rerender();
    return;
  }

  if (e.key === 'Enter') {
    e.stopPropagation();
    e.preventDefault();
    confirmAllocation();
  }
}

function confirmAllocation(): void {
  if (selectedAmount > 0 && currentModuleId) {
    const spent = gameState.allocateToModule(currentModuleId, selectedAmount);
    if (spent > 0) {
      eventBus.emit(GameEvent.ALLOCATION_CONFIRMED, {
        allocations: { [currentModuleId]: spent },
      });
    }
    allocationPanel.close();
  }
}

// ---------------------------------------------------------------------------
// Effect helpers
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

const MODULE_NAME: Record<ModuleType, string> = {
  CORE: '核心',
  STORAGE: '储藏',
  PURIFIER: '净化器',
};
const MODULE_COLOR: Record<ModuleType, string> = {
  CORE: '#c8cdd4',
  STORAGE: '#c4873a',
  PURIFIER: '#1aad96',
};
const MODULE_HP_LABEL: Record<ModuleType, string> = {
  CORE: '核心完整度',
  STORAGE: '储藏完整度',
  PURIFIER: '净化器完整度',
};

function effectHp(hp: number): number {
  return Math.min(hp, P.MODULE_EFFECT_HP_REF);
}

function computeEffectParts(type: ModuleType, hp: number, maxHp: number): { name: string; value: string } {
  if (type === 'CORE') {
    const pct = Math.round((effectHp(hp) / P.MODULE_EFFECT_HP_REF) * P.MAX_CORE_REDUCTION * 100);
    return { name: '混乱增速', value: `-${pct}%` };
  }
  if (type === 'STORAGE') {
    const mult = (1 + (effectHp(hp) / P.MODULE_EFFECT_HP_REF) * P.MAX_STORAGE_BONUS).toFixed(2);
    return { name: '薪柴价值', value: `x${mult}` };
  }
  return { name: '起始混乱', value: String(computeStartingChaos(hp, maxHp)) };
}

/** Shared by render() (for +/- boundary state) and onKeyDown() (for the keyboard
 *  amount adjustment), so the two never compute the ceiling differently. */
function getMaxAllocatable(hp: number, maxHp: number): number {
  const reserve = gameState.getKindlingReserve();
  const repairPer = gameState.getEffectiveRepairPerKindling();
  const maxUseful = Math.ceil((maxHp - hp) / repairPer);
  return Math.min(reserve, maxUseful);
}

/** Cost of the single cheapest not-yet-maxed upgrade, or null if every axis is
 *  maxed. Used by the opportunity-cost row below (IA §S3). */
function getCheapestUpgradeCost(): number | null {
  let min: number | null = null;
  for (const id of growthSystem.getAllUpgradeIds()) {
    if (growthSystem.getLevel(id) >= growthSystem.getMaxLevel(id)) continue;
    const cost = growthSystem.getCost(id);
    if (min === null || cost < min) min = cost;
  }
  return min;
}

/**
 * Opportunity-cost row (IA §S3, new): this panel used to show the module being
 * repaired in a vacuum. Three numbers make "投入这里而非别处" an actual comparison
 * instead of a form to fill out: the other module's own HP (the alternative use of
 * the same kindling), the cheapest permanent upgrade not yet bought (the third
 * outlet the single currency competes with), and whether this module is the
 * forecast's current target (the module that will actually eat the next impact).
 */
function buildOpportunityCostRow(type: ModuleType): string {
  const others = (['CORE', 'STORAGE', 'PURIFIER'] as const).filter((t) => t !== type);
  const cheapestCost = getCheapestUpgradeCost();
  const forecast = impactSystem.getForecastDisplay();
  const isForecastTarget = forecast?.targetId === type;
  const forecastName = forecast
    ? (MODULE_NAME[forecast.targetId as ModuleType] ?? forecast.targetId)
    : '—';

  const otherCells = others.map((otherType) => {
    const other = gameState.getModule(otherType);
    const otherHp = other ? String(other.hp) : '—';
    const otherMax = other ? String(other.maxHp) : '—';
    const otherColor = MODULE_COLOR[otherType];
    return `<div style="flex:1;">
        <div style="font-size:12px;color:#8a8f96;">${MODULE_HP_LABEL[otherType]}</div>
        <div><span style="font-size:13px;font-weight:bold;color:${otherColor};">${otherHp}</span>
        <span style="color:#8a8f96;"> / </span>
        <span style="font-size:13px;font-weight:bold;color:${otherColor};">${otherMax}</span></div>
      </div>`;
  }).join('');

  return `<div class="separator"></div>
    <div style="display:flex;gap:24px;padding:4px 0;">
      ${otherCells}
      <div style="flex:1;">
        <div style="font-size:12px;color:#8a8f96;">蜕变最低</div>
        <div style="font-size:13px;font-weight:bold;color:#c4873a;">${cheapestCost !== null ? cheapestCost : '已全部购满'}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:12px;color:#8a8f96;">下次冲击目标</div>
        <div style="font-size:13px;font-weight:bold;color:${isForecastTarget ? '#b89040' : '#8a8f96'};">${isForecastTarget ? '本模块' : forecastName}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(type: ModuleType, hp: number, maxHp: number): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();
  const repairPer = gameState.getEffectiveRepairPerKindling();
  const siphonBoosted = gameState.getRepairEfficiencyMult() > 1;
  const maxAllocatable = getMaxAllocatable(hp, maxHp);

  const typeLabel = MODULE_NAME[type];
  const typeColor = MODULE_COLOR[type];
  const forecast = impactSystem.getForecastDisplay();
  const isForecastTarget = forecast?.targetId === type;
  const hpLabel = type === 'PURIFIER' ? '净化器完整度' : '完整度';

  const hpPct = Math.round((hp / maxHp) * 100);
  const repairAmount = selectedAmount * repairPer;
  const repairedHp = Math.min(hp + repairAmount, maxHp);
  const repairedPct = Math.round((repairedHp / maxHp) * 100);
  const previewPct = Math.max(0, repairedPct - hpPct);
  const remaining = reserve - selectedAmount;

  const currentEffect = computeEffectParts(type, hp, maxHp);
  const afterEffect = computeEffectParts(type, repairedHp, maxHp);
  const effectColor = type === 'STORAGE' ? '#c4873a' : '#1aad96';
  const barColor = type === 'PURIFIER' ? '#1aad96' : typeColor;

  let html = `<div class="panel-title" style="display:flex;justify-content:space-between;">
    <span style="font-size:16px;font-weight:bold;color:${typeColor};">${typeLabel}</span>
    ${isForecastTarget ? '<span style="color:#b89040;">下次冲击目标</span>' : ''}
  </div>`;

  html += `<div class="panel-fixed">
    <div style="margin:8px 0 4px;display:flex;gap:12px;align-items:baseline;">
      <span style="font-size:12px;color:#8a8f96;width:96px;">${hpLabel}</span>
      <span style="font-size:16px;font-weight:bold;color:${typeColor};">${hp}</span>
      <span>/</span>
      <span style="font-size:16px;font-weight:bold;color:${typeColor};">${maxHp}</span>
    </div>
    <div class="pbar-wrap">
      <div class="pbar-preview" style="left:${hpPct}%;width:${previewPct}%;"></div>
      <div class="pbar-fill" style="width:${hpPct}%;background:${barColor};"></div>
    </div>
    <div style="margin-top:8px;display:flex;gap:12px;align-items:baseline;">
      <span style="font-size:12px;color:#8a8f96;width:96px;">${currentEffect.name}</span>
      <span style="font-size:16px;font-weight:bold;color:${effectColor};">${currentEffect.value}</span>
      <span>→</span>
      <span style="font-size:16px;font-weight:bold;color:${effectColor};">${afterEffect.value}</span>
    </div>
  </div>`;

  html += `<div class="panel-fixed">
    <div class="separator"></div>
    <div style="display:flex;gap:12px;align-items:baseline;margin:6px 0;">
      <span style="font-size:12px;color:#8a8f96;width:96px;">投入</span>
      <span style="color:#c4873a;font-weight:bold;margin-right:6px;">&gt;</span>
      <span style="font-size:16px;font-weight:bold;color:#c4873a;">${selectedAmount}</span>
    </div>
    <div style="display:flex;gap:12px;align-items:baseline;margin:6px 0;">
      <span style="font-size:12px;color:#8a8f96;width:96px;">储备</span>
      <span style="font-size:16px;font-weight:bold;color:#c4873a;">${reserve}</span>
    </div>
    <div style="display:flex;gap:12px;align-items:baseline;margin:6px 0;">
      <span style="font-size:12px;color:#8a8f96;width:96px;">注入后剩余</span>
      <span style="font-size:13px;font-weight:bold;color:#c4873a;">${remaining}</span>
      <span style="margin-left:auto;font-size:12px;color:#8a8f96;">1薪柴=${repairPer}完整度${siphonBoosted ? ' <span style="color:#c4873a;">虹吸增效</span>' : ''}</span>
    </div>
  </div>`;

  html += `<div class="panel-fixed">${buildOpportunityCostRow(type)}</div>`;
  html += `<div class="key-hint-bar">
    <span><span class="key" id="alloc-minus">←</span> <span class="key" id="alloc-plus">→</span> ±1</span>
    <span><span class="key">Shift+←→</span> ±5</span>
    <span><span class="key">Home</span> <span class="key">End</span> 归零 / 拉满</span>
    <span id="alloc-confirm"><span class="key">Enter</span> 注入</span>
    <span><span class="key">Esc</span> 离开</span>
  </div>`;

  panel.innerHTML = html;
  scrollFocusedIntoView(panel);

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

  panel.querySelector('#alloc-confirm')?.addEventListener('click', confirmAllocation);
}

function rerender(): void {
  if (!panel || !currentModuleId) return;
  const mod = gameState.getModule(currentModuleId);
  if (!mod) return;
  render(mod.type, mod.hp, mod.maxHp);
}
