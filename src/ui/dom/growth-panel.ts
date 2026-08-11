/**
 * GrowthPanel - DOM overlay for purchasing permanent upgrades at the growth altar.
 *
 * Displays current kindling reserve, each upgrade's level/effect/cost, and upgrade buttons.
 * Buttons are disabled when at max level or when the player cannot afford the next level.
 *
 * Follows the same DOM pattern as AllocationPanel (position:fixed, z-index, ESC to close).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { saveManager } from '@/managers/save-manager';
import { stabilityTracker } from '@/systems/stability-tracker';
import type { GrowthUpgradeId } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Upgrade display config
// ---------------------------------------------------------------------------

interface UpgradeDisplay {
  id: GrowthUpgradeId;
  name: string;
  effectLabel: (level: number) => string;
  nextEffectLabel: (nextLevel: number) => string;
}

const UPGRADES: UpgradeDisplay[] = [
  {
    id: 'growth_chaos_resist',
    name: '渗透抗性',
    effectLabel: (level) => level > 0 ? `混乱增速 -${level * 4}%` : '(未解锁)',
    nextEffectLabel: (nextLevel) => `-${nextLevel * 4}%`,
  },
  {
    id: 'growth_kindling_affinity',
    name: '薪柴亲和',
    effectLabel: (level) => level > 0 ? `拾取额外 +${level}` : '(未解锁)',
    nextEffectLabel: (nextLevel) => `+${nextLevel}`,
  },
  {
    id: 'growth_vitality',
    name: '生命强化',
    effectLabel: (level) => level > 0 ? `完整度+${level * 15}` : '(未解锁)',
    nextEffectLabel: (nextLevel) => `完整度+${nextLevel * 15}`,
  },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

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
  panel = document.createElement('div');
  panel.id = 'growth-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:1001',
    'background:rgba(15,17,20,0.92)',
    'border:1px solid #2a2d32',
    'padding:12px',
    'min-width:340px',
    'max-width:420px',
    'font-family:"Courier New",monospace',
    'color:#c8cdd4',
  ].join(';');

  render();
  document.body.appendChild(panel);
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    growthPanel.close();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  if (!panel) return;

  const reserve = gameState.getKindlingReserve();

  let html = `<div style="margin-bottom:14px;font-size:14px;color:#c4873a;font-weight:bold;">
    永久改造
  </div>`;

  html += `<div style="margin-bottom:14px;font-size:11px;color:#8a8f96;">
    薪柴储备: <span style="color:#c4873a;font-weight:bold;">${reserve}</span>
  </div>`;

  for (const upgrade of UPGRADES) {
    const level = growthSystem.getLevel(upgrade.id);
    const maxLevel = growthSystem.getMaxLevel(upgrade.id);
    const isMaxed = level >= maxLevel;
    const cost = growthSystem.getCost(upgrade.id);
    const canAfford = growthSystem.canAfford(upgrade.id, reserve);

    const effectText = upgrade.effectLabel(level);
    const nextEffect = !isMaxed ? upgrade.nextEffectLabel(level + 1) : '';

    html += `<div style="margin-bottom:12px;padding:10px;background:#151a1e;border-left:3px solid #c4873a;">
      <div style="font-size:11px;color:#c4873a;font-weight:bold;margin-bottom:4px;">
        ◆ ${upgrade.name} <span style="color:#8a8f96;">Lv.${level}/${maxLevel}</span>
      </div>
      <div style="font-size:10px;color:#8a8f96;margin-bottom:4px;">
        效果: ${effectText}
      </div>`;

    if (isMaxed) {
      html += `<div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:9px;color:#4d9a6b;">已满</span>
        <button disabled style="${upgradeBtnStyle(true)}">已满</button>
      </div>`;
    } else {
      const costColor = canAfford ? '#c4873a' : '#5a5f66';
      html += `<div style="font-size:10px;color:#8a8f96;margin-bottom:6px;">
        下一级: ${nextEffect} (费用: <span style="color:${costColor};">${cost}</span>)
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="growth-upgrade-btn" data-id="${upgrade.id}" ${canAfford ? '' : 'disabled'} style="${upgradeBtnStyle(!canAfford)}">升级</button>
      </div>`;
    }

    html += `</div>`;
  }

  // Close button
  html += `<div style="margin-top:14px;text-align:center;">
    <button id="growth-close-btn" style="${closeBtnStyle()}">关闭</button>
  </div>`;

  panel.innerHTML = html;
  wireEvents();
}

function wireEvents(): void {
  if (!panel) return;

  panel.querySelectorAll('.growth-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id as GrowthUpgradeId;
      const prevLevel = growthSystem.getLevel(id);
      const spent = growthSystem.purchase(id);
      if (spent > 0) {
        // Stability: purchased an upgrade (spec S21)
        stabilityTracker.addProgress('growth', GAME_CONSTANTS.STABILITY.GAIN_GROWTH);
        saveManager.save();
        render();
        // C1: Purchase animation flash
        showPurchaseFlash(id, prevLevel + 1);
        // E2: First growth milestone check
        checkFirstGrowthMilestone(id, prevLevel + 1);
      }
    });
  });

  panel.querySelector('#growth-close-btn')?.addEventListener('click', () => {
    growthPanel.close();
  });
}

// ---------------------------------------------------------------------------
// C1: Purchase flash animation
// ---------------------------------------------------------------------------

function showPurchaseFlash(id: GrowthUpgradeId, newLevel: number): void {
  if (!panel) return;

  // Inject animation style if needed
  if (!document.getElementById('growth-flash-style')) {
    const style = document.createElement('style');
    style.id = 'growth-flash-style';
    style.textContent = `@keyframes growth-flash { 0%{opacity:1;color:#44cc88;} 100%{opacity:0;} }`;
    document.head.appendChild(style);
  }

  const names: Record<GrowthUpgradeId, string> = {
    growth_chaos_resist: '渗透抗性',
    growth_kindling_affinity: '薪柴亲和',
    growth_vitality: '生命强化',
  };

  const flash = document.createElement('div');
  flash.style.cssText = 'font-size:11px;color:#44cc88;text-align:center;padding:4px;animation:growth-flash 2s ease-out forwards;';
  flash.textContent = `${names[id]} → Lv.${newLevel}`;

  // Insert after the title
  const title = panel.querySelector('div');
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

  // Check all other upgrades are still 0
  const ids: GrowthUpgradeId[] = ['growth_chaos_resist', 'growth_kindling_affinity', 'growth_vitality'];
  const otherLevels = ids.filter((i) => i !== id).map((i) => growthSystem.getLevel(i));
  if (otherLevels.some((l) => l > 0)) return; // not the first ever

  localStorage.setItem('coh_first_growth_done', '1');

  // Show milestone overlay after a short delay (panel may close first)
  setTimeout(() => {
    const overlay = document.createElement('div');
    overlay.id = 'first-growth-milestone';
    overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:2000', 'background:rgba(0,0,0,0.85)', 'display:flex',
      'align-items:center', 'justify-content:center',
      'font-family:"Courier New",monospace', 'font-size:16px', 'color:#c4873a',
      'cursor:pointer',
    ].join(';');
    overlay.textContent = '永久改造已刻入';
    document.body.appendChild(overlay);

    const dismiss = (): void => {
      overlay.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', keyDismiss);
      clearTimeout(timer);
      overlay.remove();
    };
    const keyDismiss = (e: KeyboardEvent): void => { if (!e.repeat) dismiss(); };
    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', keyDismiss);
    const timer = setTimeout(dismiss, 1500);
  }, 300);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function upgradeBtnStyle(disabled: boolean): string {
  const color = disabled ? '#3a3f44' : '#c4873a';
  return [
    'padding:4px 8px',
    'font-size:11px',
    'font-family:"Courier New",monospace',
    'background:none',
    `color:${color}`,
    'border:none',
    disabled ? 'text-decoration:none' : 'text-decoration:underline',
    disabled ? 'cursor:not-allowed' : 'cursor:pointer',
  ].join(';');
}

function closeBtnStyle(): string {
  return [
    'padding:4px 8px',
    'font-size:11px',
    'font-family:"Courier New",monospace',
    'background:none',
    'color:#8a8f96',
    'border:none',
    'cursor:pointer',
    'text-decoration:underline',
  ].join(';');
}
