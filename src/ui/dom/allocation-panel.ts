/**
 * 薪柴分配：投入 → 修复与效果预览 → 剩余薪柴；键鼠共用投入状态。
 * 迭代 11 DEC-119；共享终端样式，挂 #dom-ui-root。
 */

import type { WorldInteractionContext } from './world-interaction';
import { eventBus } from '@/core/event-bus';
import { computeStartingChaos, gameState } from '@/managers/game-state';
import type { EffectModuleType, ModuleType, SortieModifiers } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { audioManager } from '@/managers/audio-manager';
import { GameEvent } from '@/types/events';
import { GAME_CONSTANTS } from '@/config/constants';
import { formatChaosRateDelta } from '@/ui/side-effect-labels';
import {
  BAR_COLOR,
  MODULE_LABEL,
  NUM_ACTIVE,
} from './module-identity-strip';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// Compatible alias for the accepted core sample; all three modules now share it.
export type CoreAllocationContext = WorldInteractionContext & {
  /** Scene layout clearance; default retains the historical top-down sample. */
  readonly integrityOffsetY?: number;
};

let coreContext: CoreAllocationContext | null = null;
let anchorFrame = 0;
let commitTimer: ReturnType<typeof setTimeout> | null = null;
let committing = false;
let saveFailed = false;
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
  CORE: '#729887',
  STORAGE: '#b29a73',
  PURIFIER: '#729887',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const allocationPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(moduleId: string, onClose?: () => void, context?: CoreAllocationContext): void {
    if (panel) return; // already open
    currentModuleId = moduleId;
    coreContext = context ?? null;
    selectedAmount = 0;
    saveFailed = false;
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
  if (coreContext) {
    panel.classList.add('core-allocation', `allocation-${mod.type.toLowerCase()}`);
    panel.style.setProperty('--integrity-offset-y', `${coreContext.integrityOffsetY ?? 34}px`);
  }

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = coreContext ? `core-allocation-backdrop allocation-${mod.type.toLowerCase()}` : 'game-panel-backdrop';
  backdrop.id = 'allocation-backdrop';
  root.appendChild(backdrop);

  render(mod.type, mod.hp, mod.maxHp);
  root.appendChild(panel);
  if (coreContext) {
    const followCore = (): void => {
      if (!panel || !coreContext) return;
      const anchor = coreContext.getAnchor();
      for (const element of [panel, backdrop]) {
        element.style.setProperty('--core-x', `${anchor.x}px`);
        element.style.setProperty('--core-y', `${anchor.y}px`);
      }
      panel.classList.add('core-present');
      anchorFrame = requestAnimationFrame(followCore);
    };
    anchorFrame = requestAnimationFrame(followCore);
  }

  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  cancelAnimationFrame(anchorFrame);
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = null;
  committing = false;
  coreContext = null;
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

  if (committing) { e.preventDefault(); e.stopPropagation(); return; }
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
  if (committing) return;
  if (selectedAmount > 0 && currentModuleId) {
    const spent = saveManager.allocateToModule(currentModuleId, selectedAmount);
    if (spent <= 0) {
      saveFailed = true;
      audioManager.playSFX('sfx-ui-error');
      rerender();
      return;
    }
    saveFailed = false;
    if (spent > 0) {
      eventBus.emit(GameEvent.ALLOCATION_CONFIRMED, {
        allocations: { [currentModuleId]: spent },
      });
    }
    if (spent > 0 && coreContext) {
      committing = true;
      selectedAmount = 0;
      rerender();
      panel?.classList.add('core-committed');
      commitTimer = setTimeout(() => allocationPanel.close(), 650);
    } else {
      allocationPanel.close();
    }
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
  const maxUseful = gameState.getMaxUsefulRepairKindling(hp, maxHp);
  return Math.min(reserve, maxUseful);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(type: ModuleType, hp: number, maxHp: number): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();
  const repairPer = gameState.getEffectiveRepairPerKindling();
  const repairBonus = gameState.getRepairBonusHp();
  const maxAllocatable = getMaxAllocatable(hp, maxHp);

  const hpPct = Math.round((hp / maxHp) * 100);
  const repairedHp = gameState.previewModuleRepair(hp, maxHp, selectedAmount);
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
  const siphonNote = repairBonus > 0 ? ` · 下次注入另修复至多 ${repairBonus} 完整度（仅一次）` : '';

  const reason = saveFailed ? '记录未能保存，注入未扣除。请重试。' : hp >= maxHp ? '装置已完整，无需注入。' : reserve <= 0
    ? '暂无薪柴。翻找裂隙中的翻堆并撤离后可带回薪柴。'
    : selectedAmount === 0 ? '尚未选择投入数量。用加号或 → 调整。' : '';
  if (coreContext) {
    // The device supplies the image and identity. Only the current decision is
    // drawn beside it; the readout remains anchored to its real ground contact.
    panel.innerHTML = `
      <div class="core-identity"><span>${MODULE_LABEL[type]}</span></div>
      <div class="core-integrity" aria-live="polite">
        <div class="core-integrity-label">完整度 <span>${hp}<small> / ${maxHp}</small></span></div>
        <div class="pbar-wrap"><div class="pbar-preview" style="left:${hpPct}%;width:${previewPct}%;"></div><div class="pbar-fill" style="width:${hpPct}%;background:${barColor};"></div></div>
        <div class="core-repair-preview">${committing ? '修复已生效' : selectedAmount > 0 ? `修复至 ${repairedHp} <span>+${repairedHp - hp}</span>` : ' '}</div>
      </div>
      <div class="core-work">
        <div class="core-work-heading"><span>${committing ? '已投入' : '投入薪柴'}</span><span class="core-reserve">储备 ${reserve}</span></div>
        <div class="core-amount">
          <button class="allocation-step" id="alloc-minus" aria-label="减少一份薪柴" ${selectedAmount <= 0 || committing ? 'disabled' : ''}>−</button>
          <strong>${committing ? '—' : selectedAmount}</strong><span class="core-unit">份</span>
          <button class="allocation-step" id="alloc-plus" aria-label="增加一份薪柴" ${selectedAmount >= maxAllocatable || committing ? 'disabled' : ''}>+</button>
        </div>
        <div class="core-efficiency">每份修复 ${repairPer} 完整度${siphonNote}</div>
        <div class="core-outcome"><span>${EFFECT_LABEL[type]}</span><span>${currentEffect}${selectedAmount > 0 ? ` <i>→</i> <strong>${afterEffect}</strong>` : ''}</span></div>
        <div class="core-outcome core-remaining"><span>余下薪柴</span><span>${remaining}</span></div>
        <div class="core-reason" role="status">${saveFailed ? reason : committing ? '修复已生效。' : selectedAmount > 0 && currentEffect === afterEffect ? `本次修复不改变${EFFECT_LABEL[type]}。` : hp >= maxHp ? `${MODULE_LABEL[type]}已完整。` : reserve <= 0 ? '暂无薪柴。撤离裂隙可带回薪柴。' : selectedAmount === 0 ? '选择这次投入的份数。' : ''}</div>
        <div class="core-actions">
          <button id="alloc-confirm" ${selectedAmount <= 0 || committing ? 'disabled' : ''}><span>Enter</span> 投入</button>
          <button id="alloc-close"><span>Esc</span> 离开</button>
        </div>
        <div class="core-controls">← → 调整 · Shift ×5<br>Home 归零 · End 拉满</div>
      </div>`;
    bindEvents(maxAllocatable);
    return;
  }
  let html = `<div class="panel-heading"><div class="panel-title">分配 · ${MODULE_LABEL[type]}</div><div class="panel-reserve"><span>薪柴</span><strong>${reserve}</strong></div></div>`;
  html += `<div class="scroll-area">
    <div class="readout-hero"><span class="readout-label">${MODULE_HP_LABEL[type]}</span><span class="readout-value" style="color:${numColor};">${hp} / ${maxHp}</span></div>
    <div class="pbar-wrap"><div class="pbar-preview" style="left:${hpPct}%;width:${previewPct}%;"></div><div class="pbar-fill" style="width:${hpPct}%;background:${barColor};"></div></div>
    <div class="allocation-input"><span>投入</span><strong class="readout-value">${selectedAmount}</strong><span class="readout-label">薪柴</span>
      <button class="allocation-step" id="alloc-minus" aria-label="减少一份薪柴" ${selectedAmount <= 0 ? 'disabled' : ''}>−</button>
      <button class="allocation-step" id="alloc-plus" aria-label="增加一份薪柴" ${selectedAmount >= maxAllocatable ? 'disabled' : ''}>+</button></div>
    <div class="readout-note">← → ±1 · Shift+←→ ±5 · Home 归零 · End 拉满</div>
    <div class="readout-section">注入结果</div>
    <div class="stat-row"><span class="readout-label">装置完整度</span><span>${hp}</span><span>→</span><span>${repairedHp} / ${maxHp}</span></div>
    <div class="stat-row"><span class="readout-label">${EFFECT_LABEL[type]}</span><span style="color:${effectColor};">${currentEffect}</span><span>→</span><span style="color:${effectColor};">${afterEffect}</span></div>
    ${selectedAmount > 0 && currentEffect === afterEffect ? '<div class="readout-note">本次修复不改变该项出击效果。</div>' : ''}
    <div class="stat-row"><span class="readout-label">注入后剩余薪柴</span><span class="readout-value">${remaining}</span><span class="readout-note">/ 储备 ${reserve}</span></div>
    <div class="readout-note">1 薪柴 = ${repairPer} 完整度${siphonNote}</div>
    ${reason ? `<p class="readout-note" role="status">${reason}</p>` : ''}
  </div>`;
  html += `<div class="key-hint-bar">
    ${selectedAmount > 0 ? '<button class="action-btn" id="alloc-confirm"><span class="key">Enter</span> 注入</button>' : `<span class="readout-note">${hp >= maxHp ? '无需修复' : reserve <= 0 ? '暂无薪柴' : '等待投入'}</span>`}
    <button class="action-btn" id="alloc-close"><span class="key">Esc</span> 离开</button>
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
  panel.querySelector('#alloc-close')?.addEventListener('click', allocationPanel.close);
}

function rerender(): void {
  if (!panel || !currentModuleId) return;
  const mod = gameState.getModule(currentModuleId);
  if (!mod) return;
  render(mod.type, mod.hp, mod.maxHp);
}
