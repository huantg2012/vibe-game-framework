/**
 * Purification HUD - Compact symbol-grid overlay for the purification scene.
 *
 * Design principles:
 * - No text labels; position + color + shape ARE the language
 * - No borders/frames; information floats directly at screen edges
 * - Pixel-aesthetic, cold-gray base + semantic accent colors
 * - UI is part of the game world, not floating above it
 *
 * Layout:
 * - Right-top: kindling (diamond + number), stability (block bar), tide (wave bar)
 * - Bottom-center: compact key hints (one line, semi-transparent)
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { gameState } from '@/managers/game-state';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InteractionTargetType = 'core' | 'storage' | 'rift' | 'defense' | 'growth';

export interface InteractionTarget {
  type: InteractionTargetType;
  distance: number;
  moduleData?: { hp: number; maxHp: number; effectPct: number };
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COL = {
  kindlingOrange: '#c4873a',
  stabilityGreen: '#4a9e5a',
  dangerRed: '#cc3333',
  tideCyan: '#1aad96',
  darkBg: '#1a1e22',
  dimText: '#5a5f66',
  brightText: '#c8ccd0',
  barEmpty: '#1a1e22',
} as const;

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
      const action = this.getActionLabel(target);
      html = this.buildPromptWithContext(action, target);
      this.promptEl.style.opacity = '0.9';
    } else {
      html = this.buildDefaultPrompt();
      this.promptEl.style.opacity = '0.6';
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

    // --- Kindling row ---
    const kindlingRow = `<div style="margin-bottom:4px;"><span style="color:${COL.kindlingOrange};font-size:13px;">◇</span><span style="color:${COL.kindlingOrange};font-size:14px;font-weight:bold;margin-left:4px;">${reserve}</span></div>`;

    // --- Stability bar (10 blocks) ---
    const stabBlocks = 10;
    const filledBlocks = Math.round((stabPct / 100) * stabBlocks);
    const stabColor = stabPct <= 30 ? COL.dangerRed : COL.stabilityGreen;
    let stabBar = '';
    for (let i = 0; i < stabBlocks; i++) {
      const color = i < filledBlocks ? stabColor : COL.barEmpty;
      stabBar += `<span style="color:${color};">▮</span>`;
    }
    const stabilityRow = `<div style="font-size:12px;letter-spacing:1px;margin-bottom:4px;">${stabBar}</div>`;

    // --- Tide wave bar ---
    const tideRow = this.buildTideRow(tideState);

    const html = kindlingRow + stabilityRow + tideRow;

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
    document.getElementById('purif-hud')?.remove();

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'purif-hud';
    // No .game-panel class — borderless, frameless
    this.hudEl.style.cssText = [
      'position:fixed', 'top:10px', 'right:12px', 'z-index:999',
      'pointer-events:none',
      'font-family:"Courier New",monospace',
      'line-height:1.4',
      'text-shadow:0 0 2px rgba(0,0,0,0.8)',
    ].join(';');
    document.body.appendChild(this.hudEl);
    this.refresh();
  }

  private createPromptBar(): void {
    document.getElementById('purif-prompt')?.remove();

    this.promptEl = document.createElement('div');
    this.promptEl.id = 'purif-prompt';
    // No .game-panel class — minimal, floating
    this.promptEl.style.cssText = [
      'position:fixed', 'bottom:16px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:999', 'pointer-events:none',
      'font:11px "Courier New",monospace',
      'color:' + COL.dimText,
      'text-align:center',
      'transition:opacity 0.15s ease-out',
      'opacity:0.6',
      'text-shadow:0 0 2px rgba(0,0,0,0.8)',
      'white-space:nowrap',
    ].join(';');
    this.promptEl.innerHTML = this.buildDefaultPrompt();
    this.lastPromptHtml = this.promptEl.innerHTML;
    document.body.appendChild(this.promptEl);
  }

  /**
   * Build the tide wave bar.
   * Represents a full tide cycle as 10 characters.
   * Current position highlighted in cyan; rising = brighter, ebbing = dimmer.
   */
  private buildTideRow(tideState: { tideNumber: number; phase: string; cycleInPhase: number; currentIntensity: number }): string {
    const tidesCfg = GAME_CONSTANTS.TIDE.TIDES;
    const cfg = tidesCfg[Math.min(tideState.tideNumber - 1, tidesCfg.length - 1)]!;

    // Calculate total cycles and current position
    const totalCycles = cfg.riseCycles + cfg.crestCycles + cfg.ebbCycles;
    let currentPos = tideState.cycleInPhase;
    if (tideState.phase === 'crest') currentPos += cfg.riseCycles;
    else if (tideState.phase === 'ebb') currentPos += cfg.riseCycles + cfg.crestCycles;

    // Map position to 0-9 index in a 10-char bar
    const barLen = 10;
    const posIndex = totalCycles > 0 ? Math.min(Math.floor((currentPos / totalCycles) * barLen), barLen - 1) : 0;

    // Wave height pattern: rises then falls
    // Use block characters of increasing height: ▁ ▂ ▃ ▄ ▅ ▆ ▇ █
    const waveChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

    // Generate wave shape: rise to peak at center, fall back
    const heights = new Array<number>(barLen);
    const peakIdx = Math.floor(barLen * (cfg.riseCycles / totalCycles));
    for (let i = 0; i < barLen; i++) {
      if (i <= peakIdx) {
        // Rising portion
        heights[i] = Math.round((i / Math.max(peakIdx, 1)) * 7);
      } else {
        // Falling portion
        const fallLen = barLen - 1 - peakIdx;
        heights[i] = Math.round(((barLen - 1 - i) / Math.max(fallLen, 1)) * 7);
      }
    }

    // Determine base color: rising = brighter, ebbing = dimmer
    const isRising = tideState.phase === 'rise' || tideState.phase === 'crest';
    const baseColor = isRising ? '#2a7a6a' : '#1a4a42';

    let bar = '';
    for (let i = 0; i < barLen; i++) {
      const ch = waveChars[heights[i]!] ?? waveChars[0]!;
      const color = i === posIndex ? COL.tideCyan : baseColor;
      bar += `<span style="color:${color};">${ch}</span>`;
    }

    // Tide number indicator
    const tideLabel = `<span style="color:${COL.dimText};font-size:9px;margin-left:4px;">${tideState.tideNumber}</span>`;

    return `<div style="font-size:12px;letter-spacing:0px;">${bar}${tideLabel}</div>`;
  }

  private buildDefaultPrompt(): string {
    return `<span style="color:${COL.dimText};">E:注入</span>` +
      `<span style="color:${COL.barEmpty};margin:0 6px;">│</span>` +
      `<span style="color:${COL.dimText};">Q:装备</span>` +
      `<span style="color:${COL.barEmpty};margin:0 6px;">│</span>` +
      `<span style="color:${COL.dimText};">Tab:总览</span>` +
      `<span style="color:${COL.barEmpty};margin:0 6px;">│</span>` +
      `<span style="color:${COL.dimText};">Esc:退出</span>`;
  }

  private buildPromptWithContext(action: string, target: InteractionTarget): string {
    const detail = this.getPromptDetail(target);
    let html = `<span style="color:${COL.brightText};">[E]</span> <span style="color:#8a8f96;">${action}</span>`;
    if (detail) {
      html += `<span style="color:${COL.barEmpty};margin:0 6px;">│</span><span style="color:${COL.dimText};font-size:10px;">${detail}</span>`;
    }
    return html;
  }

  private getActionLabel(target: InteractionTarget): string {
    switch (target.type) {
      case 'core': return '◈ 核心';
      case 'storage': return '▣ 储藏';
      case 'rift': return '◩ 裂隙';
      case 'defense': return '△ 防御';
      case 'growth': return '✦ 改造';
    }
  }

  private getPromptDetail(target: InteractionTarget): string | null {
    if (!target.moduleData) {
      if (target.type === 'rift') {
        const cycle = gameState.getCycle();
        const tideState = tideSystem.getState();
        return `#${cycle} x${tideState.currentIntensity.toFixed(1)}`;
      }
      return null;
    }
    const { hp, maxHp, effectPct } = target.moduleData;
    if (target.type === 'core') {
      return `${hp}/${maxHp} -${effectPct}%`;
    }
    return `${hp}/${maxHp} +${effectPct}%`;
  }
}

/** Singleton instance for this scene's HUD. */
export const purificationHud = new PurificationHud();
