/**
 * Purification HUD - DOM overlay for the purification scene.
 *
 * Manages two fixed-position DOM elements:
 * 1. Right-top HUD panel (kindling, stability, tide info)
 * 2. Bottom-center interaction prompt bar (context-sensitive)
 *
 * All readable text lives here in DOM, keeping the game world free of Phaser.Text.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { gameState } from '@/managers/game-state';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InteractionTargetType = 'barrier' | 'storage' | 'rift' | 'defense' | 'growth';

export interface InteractionTarget {
  type: InteractionTargetType;
  distance: number;
  moduleData?: { hp: number; maxHp: number; effectPct: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<string, string> = { rise: '涨潮', crest: '潮峰', ebb: '退潮' };

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PurificationHud {
  private hudEl: HTMLDivElement | null = null;
  private promptEl: HTMLDivElement | null = null;
  private lastPromptHtml = '';
  private lastHudHtml = '';
  private promptVisible = true;

  create(): void {
    injectPanelStyles();
    this.createHudPanel();
    this.createPromptBar();
  }

  /** Update the bottom prompt bar based on nearest interaction target. */
  updatePrompt(target: InteractionTarget | null): void {
    if (!this.promptEl) return;

    if (!this.promptVisible) {
      this.promptEl.style.opacity = '0';
      return;
    }

    let html: string;

    if (target) {
      const mainLine = this.getPromptMain(target);
      const detailLine = this.getPromptDetail(target);
      html = `<div style="font-size:11px;color:#c8cdd4;"><span style="color:#5a5f66;">&gt;</span> <span style="color:#c8cdd4;">[E]</span> <span style="color:#8a8f96;">${mainLine}</span></div>`;
      if (detailLine) {
        html += `<div style="font-size:10px;color:#666666;margin-top:4px;">${detailLine}</div>`;
      }
      this.promptEl.style.opacity = '1';
    } else {
      html = `<div style="font-size:11px;color:#5a5f66;"><span style="color:#5a5f66;">&gt;</span> <span style="color:#5a5f66;">[Tab]</span> <span style="color:#5a5f66;">状态总览</span></div>`;
      this.promptEl.style.opacity = '0.5';
    }

    if (html !== this.lastPromptHtml) {
      this.promptEl.innerHTML = html;
      this.lastPromptHtml = html;
    }
  }

  /** Refresh HUD values (call after kindling/stability/tide changes). */
  refresh(): void {
    if (!this.hudEl) return;

    const reserve = gameState.getKindlingReserve();
    const stabPct = Math.round(stabilityTracker.getProgress());
    const tideState = tideSystem.getState();
    const stabFill = stabPct >= 75 ? '#66cc88' : '#44aa66';

    const tidesCfg = GAME_CONSTANTS.TIDE.TIDES;
    const cfg = tidesCfg[Math.min(tideState.tideNumber - 1, tidesCfg.length - 1)]!;
    let phaseCycles = 0;
    if (tideState.phase === 'rise') phaseCycles = cfg.riseCycles;
    else if (tideState.phase === 'crest') phaseCycles = cfg.crestCycles;
    else phaseCycles = cfg.ebbCycles;

    const html = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding-bottom:6px;border-bottom:1px solid #2a2d32;margin-bottom:6px;">
        <span style="font-size:11px;color:#8a8f96;">薪柴</span>
        <span style="font-size:14px;font-weight:bold;color:#c89040;">${reserve}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:10px;color:#8a8f96;">稳定度</span>
        <span style="font-size:11px;color:#44aa66;">${stabPct}%</span>
      </div>
      <div style="height:3px;background:#151a1e;margin-top:3px;margin-bottom:6px;border-bottom:1px solid #2a2d32;padding-bottom:6px;">
        <div style="height:100%;width:${stabPct}%;background:${stabFill};"></div>
      </div>
      <div style="font-size:10px;color:#668888;">第${tideState.tideNumber}潮 · ${PHASE_LABELS[tideState.phase]}</div>
      <div style="font-size:9px;color:#556666;margin-top:2px;">强度 ${tideState.currentIntensity.toFixed(2)} (${tideState.cycleInPhase}/${phaseCycles})</div>
    `;

    if (html !== this.lastHudHtml) {
      this.hudEl.innerHTML = html;
      this.lastHudHtml = html;
    }
  }

  /** Hide/show the prompt bar (hide when panels are open). */
  setPromptVisible(visible: boolean): void {
    this.promptVisible = visible;
    if (this.promptEl) {
      this.promptEl.style.opacity = visible ? '1' : '0';
    }
  }

  destroy(): void {
    this.hudEl?.remove();
    this.hudEl = null;
    this.promptEl?.remove();
    this.promptEl = null;
    this.lastPromptHtml = '';
    this.lastHudHtml = '';
  }

  // ------------------------------------------------------------------ private

  private createHudPanel(): void {
    // Remove any orphaned element
    document.getElementById('purif-hud')?.remove();

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'purif-hud';
    this.hudEl.className = 'game-panel';
    this.hudEl.style.cssText = [
      'position:fixed', 'top:12px', 'right:12px', 'z-index:999',
      'pointer-events:none',
      'padding:10px 12px', 'min-width:120px',
    ].join(';');
    document.body.appendChild(this.hudEl);
    this.refresh();
  }

  private createPromptBar(): void {
    document.getElementById('purif-prompt')?.remove();

    this.promptEl = document.createElement('div');
    this.promptEl.id = 'purif-prompt';
    this.promptEl.className = 'game-panel';
    this.promptEl.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:999', 'pointer-events:none',
      'padding:6px 16px', 'text-align:center',
      'min-width:160px', 'transition:opacity 0.15s ease-out',
      'opacity:0.5',
    ].join(';');
    // Start with default prompt
    this.promptEl.innerHTML = `<div style="font-size:11px;color:#5a5f66;"><span style="color:#5a5f66;">&gt;</span> <span style="color:#5a5f66;">[Tab]</span> <span style="color:#5a5f66;">状态总览</span></div>`;
    this.lastPromptHtml = this.promptEl.innerHTML;
    document.body.appendChild(this.promptEl);
  }

  private getPromptMain(target: InteractionTarget): string {
    switch (target.type) {
      case 'barrier': return '分配薪柴 - 屏障';
      case 'storage': return '分配薪柴 - 储藏';
      case 'rift': return '进入裂隙';
      case 'defense': return '防御配置';
      case 'growth': return '永久改造';
    }
  }

  private getPromptDetail(target: InteractionTarget): string | null {
    if (!target.moduleData) {
      if (target.type === 'rift') {
        const cycle = gameState.getCycle();
        return `第${cycle}次出击`;
      }
      return null;
    }
    const { hp, maxHp, effectPct } = target.moduleData;
    if (target.type === 'barrier') {
      return `HP ${hp}/${maxHp} · 混乱抑制 -${effectPct}%`;
    }
    return `HP ${hp}/${maxHp} · 薪柴增幅 +${effectPct}%`;
  }
}

/** Singleton instance for this scene's HUD. */
export const purificationHud = new PurificationHud();
