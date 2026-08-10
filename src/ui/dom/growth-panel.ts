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
    'background:rgba(20,20,24,0.95)',
    'border:1px solid #444',
    'padding:20px',
    'min-width:340px',
    'max-width:420px',
    'font-family:monospace',
    'color:#ccc',
    'border-radius:4px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.8)',
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

  let html = `<div style="margin-bottom:14px;font-size:14px;color:#cc8844;font-weight:bold;">
    永久改造
  </div>`;

  html += `<div style="margin-bottom:14px;font-size:12px;">
    薪柴储备: <span style="color:#c89040;font-weight:bold;">${reserve}</span>
  </div>`;

  for (const upgrade of UPGRADES) {
    const level = growthSystem.getLevel(upgrade.id);
    const maxLevel = growthSystem.getMaxLevel(upgrade.id);
    const isMaxed = level >= maxLevel;
    const cost = growthSystem.getCost(upgrade.id);
    const canAfford = growthSystem.canAfford(upgrade.id, reserve);

    const effectText = upgrade.effectLabel(level);
    const nextEffect = !isMaxed ? upgrade.nextEffectLabel(level + 1) : '';

    html += `<div style="margin-bottom:12px;padding:10px;background:#1a1a2e;border-radius:4px;border-left:3px solid #cc8844;">
      <div style="font-size:12px;color:#cc8844;font-weight:bold;margin-bottom:4px;">
        ◆ ${upgrade.name} <span style="color:#888;">Lv.${level}/${maxLevel}</span>
      </div>
      <div style="font-size:11px;color:#aaa;margin-bottom:4px;">
        效果: ${effectText}
      </div>`;

    if (isMaxed) {
      html += `<div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:10px;color:#44aa66;">已满</span>
        <button disabled style="${upgradeBtnStyle(true)}">已满</button>
      </div>`;
    } else {
      const costColor = canAfford ? '#c89040' : '#664422';
      html += `<div style="font-size:11px;color:#888;margin-bottom:6px;">
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
      const spent = growthSystem.purchase(id);
      if (spent > 0) {
        // Stability: purchased an upgrade (spec S21)
        stabilityTracker.addProgress('growth', GAME_CONSTANTS.STABILITY.GAIN_GROWTH);
        saveManager.save();
        render();
      }
    });
  });

  panel.querySelector('#growth-close-btn')?.addEventListener('click', () => {
    growthPanel.close();
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function upgradeBtnStyle(disabled: boolean): string {
  const bg = disabled ? '#222' : '#3a4422';
  const border = disabled ? '#333' : '#5a6644';
  const color = disabled ? '#555' : '#aac866';
  return [
    'padding:4px 12px',
    'font-size:11px',
    'font-family:monospace',
    `background:${bg}`,
    `color:${color}`,
    `border:1px solid ${border}`,
    'border-radius:3px',
    disabled ? 'cursor:not-allowed' : 'cursor:pointer',
  ].join(';');
}

function closeBtnStyle(): string {
  return [
    'padding:6px 20px',
    'font-size:12px',
    'font-family:monospace',
    'background:#333',
    'color:#ccc',
    'border:1px solid #555',
    'border-radius:3px',
    'cursor:pointer',
  ].join(';');
}
