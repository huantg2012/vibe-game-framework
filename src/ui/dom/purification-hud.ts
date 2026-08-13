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
 * - Right-top: kindling (diamond + number), tide (wave bar), impact forecast (module
 *   icon + 4-pip severity bar — DEC-034, target+severity only, no direction; direction
 *   is BoundaryShape's pressure-lobe visualization elsewhere), and — only while muffle
 *   is defense-slotted — a second, visually fainter row previewing the impact after
 *   next (muffle's "one extra round of warning")
 * - Bottom-center: compact key hints (one line, semi-transparent)
 *
 * Slice 5.5 D7: stability progress was removed from this always-visible readout and
 * moved to the survival report (`status-panel.ts`) as a state statement rather than a
 * progress bar. It never changes moment-to-moment inside the purification point and
 * has no end-state content yet (IA §R6) — a P0 progress bar for it was a standing
 * promise this Slice couldn't cash. Its removal also collapses the diagnosed "three
 * unrelated readouts sharing the same ▮ glyph" problem (IA §S2) down to one: only the
 * forecast (and its muffle lookahead variant, deliberately the same family) still uses
 * pips here.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { gameState } from '@/managers/game-state';
import { impactSystem } from '@/systems/impact-system';
import type { ForecastSeverity } from '@/systems/impact-system';
import { tideSystem } from '@/systems/tide-system';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

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
// Color palette (ui-art-overhaul.md A2 — locked values only; V2/V9 mapped)
// ---------------------------------------------------------------------------

const COL = {
  kindlingOrange: '#c4873a',
  // Was #4a9e5a (unregistered "good green"). Structure info → neutral bright. Still
  // used by the forecast row's 'light' severity pip color (not stability anymore, D7).
  stabilityNeutral: '#c8cdd4',
  dangerRed: '#cc3333',
  tideCyan: '#1aad96',
  darkBg: '#1a1e22',
  // Was #5a5f66 (V2: metal-light forbidden as text). Labels use secondary text.
  dimText: '#8a8f96',
  brightText: '#c8cdd4',
  barEmpty: '#1a1e22',
} as const;

// Reuses the exact icons already established for these modules in getActionLabel()
// below (the interaction prompt bar), so the forecast row reads as "the same device"
// rather than inventing new iconography (U11).
const MODULE_ICON: Record<string, string> = { CORE: '◈', STORAGE: '▣' };

// Second encoding beyond color for severity (U9): pip count. Colors reuse the existing
// semantic palette above rather than introducing new hex values (U3).
const SEVERITY_PIPS: Record<ForecastSeverity, number> = {
  light: 1,
  moderate: 2,
  heavy: 3,
  extreme: 4,
};
const SEVERITY_COLOR: Record<ForecastSeverity, string> = {
  light: COL.stabilityNeutral,
  moderate: COL.kindlingOrange,
  heavy: COL.dangerRed,
  extreme: COL.dangerRed,
};

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
    this.injectForecastStyles();
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

  /** Refresh HUD values (call after kindling/tide changes). Stability moved to the
   *  survival report — see the class doc comment (D7). */
  refresh(): void {
    if (!this.hudEl) return;

    const reserve = gameState.getKindlingReserve();
    const tideState = tideSystem.getState();

    // --- Kindling row ---
    const kindlingRow = `<div style="margin-bottom:4px;"><span style="color:${COL.kindlingOrange};font-size:13px;">◇</span><span style="color:${COL.kindlingOrange};font-size:14px;font-weight:bold;margin-left:4px;">${reserve}</span></div>`;

    // --- Tide wave bar ---
    const tideRow = this.buildTideRow(tideState);

    // --- Impact forecast (target module + severity, DEC-034) ---
    const forecastRow = this.buildForecastRow();

    // --- muffle's extra lookahead row (impact after next; empty string if not slotted) ---
    const lookaheadRow = this.buildForecastLookaheadRow();

    const html = kindlingRow + tideRow + forecastRow + lookaheadRow;

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
    // No .game-panel class — borderless, frameless (A-class device readout)
    this.hudEl.style.cssText = [
      'position:absolute', 'top:10px', 'right:12px', 'z-index:999',
      'pointer-events:none',
      'font-family:"Courier New",monospace',
      'line-height:1.4',
      'text-shadow:0 0 2px rgba(0,0,0,0.8)',
    ].join(';');
    getDomUiRoot().appendChild(this.hudEl);
    this.refresh();
  }

  private createPromptBar(): void {
    document.getElementById('purif-prompt')?.remove();

    this.promptEl = document.createElement('div');
    this.promptEl.id = 'purif-prompt';
    // No .game-panel class — minimal, floating
    this.promptEl.style.cssText = [
      'position:absolute', 'bottom:16px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:999', 'pointer-events:none',
      'font:12px "Courier New",monospace',
      'color:' + COL.dimText,
      'text-align:center',
      'transition:opacity 0.15s ease-out',
      'opacity:0.6',
      'text-shadow:0 0 2px rgba(0,0,0,0.8)',
      'white-space:nowrap',
    ].join(';');
    this.promptEl.innerHTML = this.buildDefaultPrompt();
    this.lastPromptHtml = this.promptEl.innerHTML;
    getDomUiRoot().appendChild(this.promptEl);
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
    // Mapped from unregistered #2a7a6a/#1a4a42 → locked contam-mid / contam-deep (A2).
    const baseColor = isRising ? '#1a6b5c' : '#0e4a3f';

    let bar = '';
    for (let i = 0; i < barLen; i++) {
      const ch = waveChars[heights[i]!] ?? waveChars[0]!;
      const color = i === posIndex ? COL.tideCyan : baseColor;
      bar += `<span style="color:${color};">${ch}</span>`;
    }

    // Tide number indicator (label tier ≥12px — was 9px, V3)
    const tideLabel = `<span style="color:${COL.dimText};font-size:12px;margin-left:4px;">${tideState.tideNumber}</span>`;

    // Minimal label prefix (IA §S2 diagnosis: three unrelated readouts sharing one
    // shape/position language with color as the only differentiator). The wave glyphs
    // are already a distinct shape from the forecast row's ▮ pips, but a one-character
    // tag costs nothing and removes any doubt about which readout this is — same idiom
    // as the forecast row's module icon prefix, not a new visual language.
    const tideTag = `<span style="color:${COL.dimText};">潮</span> `;

    return `<div style="font-size:12px;letter-spacing:0px;">${tideTag}${bar}${tideLabel}</div>`;
  }

  /**
   * Build the impact forecast row: target module icon + 4-pip severity bar (DEC-034).
   * Deliberately no direction — spatial hinting is BoundaryShape's pressure-lobe
   * visualization now, not this HUD. May be misreported (mirror) or blurred (baseline
   * forecast noise); this just renders whatever impactSystem currently reports.
   */
  private buildForecastRow(): string {
    const forecast = impactSystem.getForecastDisplay();
    if (!forecast) return '';

    const icon = MODULE_ICON[forecast.targetId] ?? '?';
    const filled = SEVERITY_PIPS[forecast.severity];
    const pipColor = SEVERITY_COLOR[forecast.severity];
    const pulseStyle = forecast.severity === 'extreme' ? 'animation:hud-critical-pulse 0.3s ease-in-out infinite;' : '';

    let pips = '';
    for (let i = 0; i < 4; i++) {
      const color = i < filled ? pipColor : COL.barEmpty;
      pips += `<span style="color:${color};">▮</span>`;
    }

    return `<div style="font-size:12px;letter-spacing:1px;${pulseStyle}"><span style="color:${COL.dimText};">${icon}</span> ${pips}</div>`;
  }

  /**
   * Build muffle's extra lookahead row: preview of the impact AFTER next (one round
   * further than buildForecastRow() above). Only rendered while muffle is defense-slotted
   * (impactSystem.getForecastLookahead() returns null otherwise — the HUD doesn't need to
   * know about muffle itself, same "renders whatever the system reports" pattern as the
   * layer-1 row).
   *
   * Deliberately weaker than the layer-1 row so it never reads as equally certain
   * information (it previews something one round further out): same ▮ pip glyph and same
   * dim/empty colors reused verbatim from the existing palette (U3/U11 — no new symbol or
   * hex value), but always COL.dimText instead of the severity color, half opacity, a
   * smaller font, and never the critical-pulse animation even at 'extreme' severity.
   */
  private buildForecastLookaheadRow(): string {
    const lookahead = impactSystem.getForecastLookahead();
    if (!lookahead) return '';

    const icon = MODULE_ICON[lookahead.targetId] ?? '?';
    const filled = SEVERITY_PIPS[lookahead.severity];

    let pips = '';
    for (let i = 0; i < 4; i++) {
      const color = i < filled ? COL.dimText : COL.barEmpty;
      pips += `<span style="color:${color};">▮</span>`;
    }

    // A1 硬下限: DOM 面板文字 ≥12px（was 10px — the "weaker" reading intentionally
    // still comes from dim color + low opacity + no pulse, not from an illegible size).
    return `<div style="font-size:12px;letter-spacing:1px;opacity:0.55;margin-top:1px;"><span style="color:${COL.dimText};">${icon}</span> ${pips}</div>`;
  }

  /** Inject the critical-pulse keyframe (idempotent) — same idiom as the existing
   *  临界脉动 spec (ui-art-overhaul.md A5: alpha 0.6-1.0, 300ms cycle). */
  private injectForecastStyles(): void {
    if (document.getElementById('hud-forecast-pulse-style')) return;
    const style = document.createElement('style');
    style.id = 'hud-forecast-pulse-style';
    style.textContent = `@keyframes hud-critical-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }`;
    document.head.appendChild(style);
  }

  private buildDefaultPrompt(): string {
    return `<span style="color:${COL.dimText};">Tab:存续报告</span>` +
      `<span style="color:${COL.barEmpty};margin:0 6px;">│</span>` +
      `<span style="color:${COL.dimText};">Esc:记录</span>`;
  }

  private buildPromptWithContext(action: string, target: InteractionTarget): string {
    const detail = this.getPromptDetail(target);
    let html = `<span style="color:${COL.brightText};">[E]</span> <span style="color:#8a8f96;">${action}</span>`;
    if (detail) {
      // A1 硬下限: DOM 面板文字 ≥12px（was 10px）.
      html += `<span style="color:${COL.barEmpty};margin:0 6px;">│</span><span style="color:${COL.dimText};font-size:12px;">${detail}</span>`;
    }
    return html;
  }

  private getActionLabel(target: InteractionTarget): string {
    switch (target.type) {
      case 'core': return '◈ 核心';
      case 'storage': return '▣ 储藏';
      case 'rift': return '◩ 踏入裂隙';
      case 'defense': return '△ 供奉';
      case 'growth': return '✦ 蜕变';
    }
  }

  private getPromptDetail(target: InteractionTarget): string | null {
    if (!target.moduleData) {
      if (target.type === 'rift') {
        const cycle = gameState.getCycle();
        const tideState = tideSystem.getState();
        return `第${cycle + 1}次出击 · 强度 x${tideState.currentIntensity.toFixed(1)}`;
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
