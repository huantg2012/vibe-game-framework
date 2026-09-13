import { getContaminantQualityName, supportsContaminantQuality } from '@/systems/contaminant-quality';
import type { ContaminantQuality } from '@/types/game-types';
/**
 * RiftResultPanel - DOM overlay for the rift sortie result (extraction / death).
 *
 * B-class world-in-terminal (ui-art-overhaul.md v2 §A0 #4): a device readout
 * report, visually of a piece with the impact result panel (#13). Replaces the
 * old centered Phaser Text version (V-A5-2, "结算面板仍是 Phaser Text").
 *
 * Pure presentation: RiftScene/HUD own the R-key restart binding, this module
 * only renders what happened.
 */

import type { ContaminantRarity, ContaminantType } from '@/types/game-types';
import { getDefenseName, getToolName } from '@/ui/contaminant-names';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiftResultData {
  survived: boolean;
  abandoned?: boolean;
  kindlingGained: number;
  killCount: number;
  peakChaos: number;
  elapsedMs: number;
  /** Every contaminant picked up this sortie, in pickup order. */
  acquired: readonly { type: ContaminantType; rarity: ContaminantRarity; quality?: ContaminantQuality }[];
  /** Passive tool trigger counts this sortie, keyed by contaminant type. */
  weapons?: readonly string[];
  passiveTriggers: ReadonlyMap<ContaminantType, number>;
}

// Same rarity ramp as loadout/defense/status/impact panels (Degree not Kind,
// ui-art-overhaul.md §A2) - kept local here rather than importing one of those
// panel modules, since none of them exports it as a shared constant yet.
const RARITY_STARS: Record<ContaminantRarity, string> = {
  common: '★',
  fine: '★★',
  rare: '★★★',
};
const RARITY_COLORS: Record<ContaminantRarity, string> = {
  common: '#8a8f96',
  fine: '#729887',
  rare: '#9bb3a2',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let continueCallback: (() => boolean | void) | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const riftResultPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  show(data: RiftResultData, onContinue?: () => boolean | void): void {
    if (panel) destroyPanel();
    injectPanelStyles();

    panel = document.createElement('div');
    panel.id = 'rift-result-panel';
    panel.className = 'game-panel crt-stack scene-menu scene-menu-result';
    panel.style.zIndex = '1001';
    continueCallback = onContinue ?? null;

    const root = getDomUiRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop scene-menu-backdrop scene-menu-compact-backdrop';
    backdrop.id = 'rift-result-backdrop';
    root.appendChild(backdrop);

    const titleText = data.abandoned ? '放弃本趟' : data.survived ? '撤离成功' : '阵亡';
    const elapsedS = Math.round(data.elapsedMs / 1000);
    const peak = Math.round(data.peakChaos);

    let html = `<div class="panel-title">${titleText}</div><div class="scroll-area">
      <div class="readout-note">${data.survived ? '这一趟带回的存续。' : '本次出击结束。带入的装备与沿途所得全部遗失。'}</div>
      <div class="readout-hero"><span class="readout-label">带回薪柴</span>
        <strong style="color:#b29a73">${data.kindlingGained}</strong>
      </div>`;

    html += `<div class="stat-grid" style="margin-bottom:8px;">
      <div class="stat-row"><span class="stat-label">带回残渣</span><span class="stat-value">${data.acquired.length}</span></div>
      <div class="stat-row"><span class="stat-label">击杀</span><span class="stat-value">${data.killCount}</span></div>
      <div class="stat-row"><span class="stat-label">峰值混乱</span><span class="stat-value">${peak}</span></div>
      <div class="stat-row"><span class="stat-label">用时</span><span class="stat-value">${elapsedS}s</span></div>
    </div>`;

    if (data.acquired.length > 0) {
      html += `<div class="separator"></div>`;
      html += `<div class="section-title">实际带回</div>`;
      html += `<div class="tile-grid">`;
      for (const c of data.acquired) {
        const name = getDefenseName(c.type);
        const color = supportsContaminantQuality(c.type) ? '#a3b3a0' : RARITY_COLORS[c.rarity];
        const stars = supportsContaminantQuality(c.type) ? getContaminantQualityName(c) : RARITY_STARS[c.rarity];
        html += `<span class="pill" style="color:${color};">${name} ${stars}</span>`;
      }
      html += `</div>`;
    }

    if (data.weapons?.length) {
      html += `<div class="section-title">带回武器</div><div class="tile-grid">`;
      for (const name of data.weapons) html += `<span class="pill">${name.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</span>`;
      html += `</div>`;
    }
    if (data.passiveTriggers.size > 0) {
      html += `<div class="section-title">被动触发</div>`;
      html += `<div class="tile-grid">`;
      for (const [type, count] of data.passiveTriggers) {
        html += `<span class="pill">${getToolName(type)} x${count}</span>`;
      }
      html += `</div>`;
    }

    html += `</div><div class="key-hint-bar">
      ${continueCallback ? '<button class="action-btn" id="rift-result-continue">' : '<span>'}
      <span class="key">R</span> 返回净化点
      ${continueCallback ? '</button>' : '</span>'}
    </div>`;

    panel.innerHTML = html;
    panel.querySelector('#rift-result-continue')?.addEventListener('click', () => {
      const callback = continueCallback;
      if (callback?.() !== false) destroyPanel();
    });
    root.appendChild(panel);
  },

  close(): void {
    destroyPanel();
  },

  destroy(): void {
    destroyPanel();
  },
};

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function destroyPanel(): void {
  continueCallback = null;
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('rift-result-backdrop')?.remove();
}
