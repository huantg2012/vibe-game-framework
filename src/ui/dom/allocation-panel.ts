/**
 * AllocationPanel — 分配墙机（载体 B）。
 *
 * I11-B4b：钉顶三格身份带（只读）+ 整宽详情 + 底键印。无顶 Tab。
 * 唯一 `.crt-focus` 套「投入」。出击预估是注入后预览，不改 getSortieModifiers()。
 * 挂 #dom-ui-root。
 */

import { eventBus } from '@/core/event-bus';
import { computeStartingChaos, gameState } from '@/managers/game-state';
import type { EffectModuleType, ModuleType, SortieModifiers } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { GameEvent } from '@/types/events';
import { GAME_CONSTANTS } from '@/config/constants';
import { formatChaosRateDelta } from '@/ui/side-effect-labels';
import {
  BAR_COLOR,
  DIM,
  MODULE_LABEL,
  MODULE_ORDER,
  NAME_ACTIVE,
  NUM_ACTIVE,
  identityBandHtml,
} from './module-identity-strip';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let currentModuleId: string | null = null;
let selectedAmount = 0;
let onCloseCallback: (() => void) | null = null;

const P = GAME_CONSTANTS.PURIFICATION;

const MODULE_HP_LABEL: Record<ModuleType, string> = {
  CORE: '核心完整度',
  STORAGE: '储藏完整度',
  PURIFIER: '净化器完整度',
};
const EFFECT_LABEL: Record<ModuleType, string> = {
  CORE: '混乱增速',
  STORAGE: '薪柴价值',
  PURIFIER: '起始混乱',
};
const EFFECT_NUM: Record<ModuleType, string> = {
  CORE: '#1aad96',
  STORAGE: '#c4873a',
  PURIFIER: '#1aad96',
};

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
  } else {
    audioManager.playSFX('sfx-ui-error');
  }
}

// ---------------------------------------------------------------------------
// Effect helpers — same formulas as GameState; do not mutate modules
// ---------------------------------------------------------------------------

function effectHp(hp: number): number {
  return Math.min(hp, P.MODULE_EFFECT_HP_REF);
}

/** Mirrors `gameState.getModuleEffect` with a substituted source hp. Denominator stays 100. */
function moduleEffectFromHp(type: EffectModuleType, sourceHp: number): number {
  const resonateBonus = gameState.isResonateBonusActive() ? P.RESONATE_MODULE_CAP_BONUS : 0;
  const ratio = effectHp(sourceHp) / P.MODULE_EFFECT_HP_REF;
  if (type === 'CORE') {
    return 1.0 - ratio * (P.MAX_CORE_REDUCTION + resonateBonus);
  }
  return 1.0 + ratio * (P.MAX_STORAGE_BONUS + resonateBonus);
}

function hpNow(type: ModuleType): { hp: number; maxHp: number } {
  const mod = gameState.getModule(type);
  return { hp: mod?.hp ?? 0, maxHp: mod?.maxHp ?? 1 };
}

/**
 * selectedAmount === 0 → exact current getSortieModifiers().
 * selectedAmount > 0 → only the open module's hp becomes repairedHp; others stay current.
 * overwrite still swaps CORE/STORAGE read source; resonate still raises the cap.
 */
function previewSortieModifiers(
  openType: ModuleType,
  repairedHp: number,
): SortieModifiers {
  if (selectedAmount === 0) {
    return gameState.getSortieModifiers();
  }

  const core = hpNow('CORE');
  const storage = hpNow('STORAGE');
  const purifier = hpNow('PURIFIER');
  const coreHp = openType === 'CORE' ? repairedHp : core.hp;
  const storageHp = openType === 'STORAGE' ? repairedHp : storage.hp;
  const purifierHp = openType === 'PURIFIER' ? repairedHp : purifier.hp;

  const swap = gameState.isModuleSwapActive();
  const coreSource = swap ? storageHp : coreHp;
  const storageSource = swap ? coreHp : storageHp;

  return {
    chaosRateModifier: moduleEffectFromHp('CORE', coreSource),
    kindlingValueModifier: moduleEffectFromHp('STORAGE', storageSource),
    startingChaos: computeStartingChaos(purifierHp, purifier.maxHp),
  };
}

function formatEffectValue(type: ModuleType, mods: SortieModifiers): string {
  if (type === 'CORE') return formatChaosRateDelta(mods.chaosRateModifier);
  if (type === 'STORAGE') return `x${mods.kindlingValueModifier.toFixed(2)}`;
  return String(mods.startingChaos);
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

function opportunityCostHtml(openType: ModuleType): string {
  const others = MODULE_ORDER.filter((t) => t !== openType);
  const cheapestCost = getCheapestUpgradeCost();
  const forecast = impactSystem.getForecastDisplay();
  const forecastType = (forecast?.targetId ?? null) as ModuleType | null;
  const forecastName = forecastType ? MODULE_LABEL[forecastType] : '—';
  const isThisTarget = forecastType === openType;

  const otherCells = others.map((otherType) => {
    const other = hpNow(otherType);
    const numColor = NUM_ACTIVE[otherType];
    return `<div style="flex:1;min-width:0;">
        <div style="font-size:12px;color:${DIM};">${MODULE_HP_LABEL[otherType]}</div>
        <div>
          <span style="font-size:13px;color:${numColor};">${other.hp}</span>
          <span style="color:${DIM};"> / </span>
          <span style="font-size:13px;color:${numColor};">${other.maxHp}</span>
        </div>
      </div>`;
  }).join('');

  const cheapestText = cheapestCost !== null ? String(cheapestCost) : '已全部购满';
  const cheapestColor = cheapestCost !== null ? '#c4873a' : DIM;
  const targetText = isThisTarget ? '本模块' : forecastName;
  const targetColor = forecastType ? NAME_ACTIVE[forecastType] : DIM;

  return `<div style="display:flex;gap:8px;padding:4px 0;">
      ${otherCells}
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;color:${DIM};">蜕变最低</div>
        <div style="font-size:13px;color:${cheapestColor};">${cheapestText}</div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;color:${DIM};">下次冲击目标</div>
        <div style="font-size:13px;color:${targetColor};">${targetText}</div>
      </div>
    </div>`;
}

function sortiePreviewHtml(mods: SortieModifiers): string {
  return `<div style="margin-top:auto;padding-top:8px;">
    <div class="stat-row"><span class="stat-label" style="font-size:12px;">出击预估</span></div>
    <div class="stat-row">
      <span class="stat-label" style="font-size:12px;">混乱增速</span>
      <span class="stat-value" style="color:#1aad96;font-size:13px;">${formatChaosRateDelta(mods.chaosRateModifier)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label" style="font-size:12px;">薪柴价值</span>
      <span class="stat-value" style="color:#c4873a;font-size:13px;">x${mods.kindlingValueModifier.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label" style="font-size:12px;">起始混乱</span>
      <span class="stat-value" style="color:#1aad96;font-size:13px;">${mods.startingChaos}</span>
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

  const hpPct = Math.round((hp / maxHp) * 100);
  const repairAmount = selectedAmount * repairPer;
  const repairedHp = Math.min(hp + repairAmount, maxHp);
  const repairedPct = Math.round((repairedHp / maxHp) * 100);
  const previewPct = Math.max(0, repairedPct - hpPct);
  const remaining = reserve - selectedAmount;

  const currentMods = gameState.getSortieModifiers();
  const previewMods = previewSortieModifiers(type, repairedHp);
  const currentEffect = formatEffectValue(type, currentMods);
  const afterEffect = formatEffectValue(type, previewMods);
  const effectColor = EFFECT_NUM[type];
  const numColor = NUM_ACTIVE[type];
  const barColor = BAR_COLOR[type];
  const siphonNote = siphonBoosted ? ' 虹吸增效' : '';

  let html = `<div class="panel-title">分配</div>`;
  html += identityBandHtml({ activeId: type });

  html += `<div class="scroll-area" style="display:flex;flex-direction:column;">
    <div style="margin-bottom:8px;">
      <div style="display:flex;gap:12px;align-items:baseline;margin:0 0 4px;">
        <span style="font-size:12px;color:${DIM};">${MODULE_HP_LABEL[type]}</span>
        <span style="font-size:13px;color:${numColor};">${hp}</span>
        <span style="color:${DIM};">/</span>
        <span style="font-size:13px;color:${numColor};">${maxHp}</span>
      </div>
      <div class="pbar-wrap">
        <div class="pbar-preview" style="left:${hpPct}%;width:${previewPct}%;"></div>
        <div class="pbar-fill" style="width:${hpPct}%;background:${barColor};"></div>
      </div>
    </div>
    <div style="display:flex;gap:12px;align-items:baseline;margin-bottom:8px;">
      <span style="font-size:12px;color:${DIM};">${EFFECT_LABEL[type]}</span>
      <span style="font-size:13px;color:${effectColor};">${currentEffect}</span>
      <span style="color:${DIM};">→</span>
      <span style="font-size:13px;color:${effectColor};">${afterEffect}</span>
    </div>
    <div class="crt-focus" style="display:flex;gap:12px;align-items:baseline;margin-bottom:8px;">
      <span style="font-size:12px;color:${DIM};">投入</span>
      <span style="font-size:16px;font-weight:bold;color:#c4873a;">${selectedAmount}</span>
      <span class="key" id="alloc-minus" style="display:inline-block;border:1px solid #2a2d32;padding:0 4px;color:#c8cdd4;font-size:12px;line-height:16px;">←</span>
      <span class="key" id="alloc-plus" style="display:inline-block;border:1px solid #2a2d32;padding:0 4px;color:#c8cdd4;font-size:12px;line-height:16px;">→</span>
    </div>
    <div style="margin-bottom:8px;">
      <div style="display:flex;gap:12px;align-items:baseline;margin:0 0 4px;">
        <span style="font-size:12px;color:${DIM};">储备</span>
        <span style="font-size:13px;color:#c4873a;">${reserve}</span>
      </div>
      <div style="display:flex;gap:12px;align-items:baseline;">
        <span style="font-size:12px;color:${DIM};">注入后剩余</span>
        <span style="font-size:13px;color:#c4873a;">${remaining}</span>
        <span style="margin-left:auto;font-size:12px;color:${DIM};">1薪柴=${repairPer}完整度${siphonNote}</span>
      </div>
    </div>
    <div style="margin-bottom:8px;">${opportunityCostHtml(type)}</div>
    ${sortiePreviewHtml(previewMods)}
  </div>`;

  html += `<div class="key-hint-bar">
    <span><span class="key">←</span> <span class="key">→</span> ±1</span>
    <span><span class="key">Shift+←→</span> ±5</span>
    <span><span class="key">Home</span> <span class="key">End</span> 归零 / 拉满</span>
    <span id="alloc-confirm"><span class="key">Enter</span> 注入</span>
    <span><span class="key">Esc</span> 离开</span>
  </div>`;

  panel.innerHTML = html;
  scrollFocusedIntoView(panel);
  bindEvents(maxAllocatable);
}

function bindEvents(maxAllocatable: number): void {
  if (!panel) return;

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
