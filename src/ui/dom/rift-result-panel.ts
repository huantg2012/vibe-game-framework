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
  kindlingGained: number;
  killCount: number;
  peakChaos: number;
  elapsedMs: number;
  /** Every contaminant picked up this sortie, in pickup order. */
  acquired: readonly { type: ContaminantType; rarity: ContaminantRarity }[];
  /** Passive tool trigger counts this sortie, keyed by contaminant type. */
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
  fine: '#1aad96',
  rare: '#3cffd4',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const riftResultPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  show(data: RiftResultData): void {
    if (panel) destroyPanel();
    injectPanelStyles();

    panel = document.createElement('div');
    panel.id = 'rift-result-panel';
    panel.className = 'game-panel';
    panel.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:360px',
      'height:auto',
      'z-index:1001',
      'pointer-events:auto',
    ].join(';');

    const root = getDomUiRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop';
    backdrop.id = 'rift-result-backdrop';
    root.appendChild(backdrop);

    const titleColor = data.survived ? '#c8cdd4' : '#cc3333';
    const titleText = data.survived ? '撤离成功' : '阵亡';
    const elapsedS = Math.round(data.elapsedMs / 1000);
    const peak = Math.round(data.peakChaos);

    let html = `<div style="text-align:center;margin-bottom:10px;">
      <div style="font-size:18px;font-weight:bold;color:${titleColor};">${titleText}</div>
    </div>`;

    html += `<div class="stat-grid" style="margin-bottom:8px;">
      <div class="stat-row"><span class="stat-label">薪柴</span><span class="stat-value" style="color:#c4873a;">${data.kindlingGained}</span></div>
      <div class="stat-row"><span class="stat-label">残渣</span><span class="stat-value">${data.acquired.length}</span></div>
      <div class="stat-row"><span class="stat-label">击杀</span><span class="stat-value">${data.killCount}</span></div>
      <div class="stat-row"><span class="stat-label">峰值混乱</span><span class="stat-value">${peak}</span></div>
      <div class="stat-row"><span class="stat-label">用时</span><span class="stat-value">${elapsedS}s</span></div>
    </div>`;

    if (data.acquired.length > 0) {
      html += `<div class="separator"></div>`;
      html += `<div class="section-title">拾取</div>`;
      html += `<div class="tile-grid">`;
      for (const c of data.acquired) {
        const name = getDefenseName(c.type);
        const color = RARITY_COLORS[c.rarity];
        const stars = RARITY_STARS[c.rarity];
        html += `<span class="pill" style="border-color:${color};color:${color};">${name} ${stars}</span>`;
      }
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

    html += `<div class="key-hint-bar">
      <span><span class="key">R</span> ${data.survived ? '返回净化点' : '重新出击'}</span>
    </div>`;

    panel.innerHTML = html;
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
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('rift-result-backdrop')?.remove();
}
