/**
 * Purification HUD — purification-point monitor readout (carrier A, edge-anchored).
 *
 * Layout (人锁定 Alt B，2026-08-14)：贴顶靠右横排三槽，槽内名+量(+档位)，
 * 槽间 32px。学 FTL「一槽 = 名 + 量、贴边」；不学供电格。不套 `.game-panel`。
 *
 * Copy (DEC-047)：表名 / 值 / 档位分节点。无菱形、无波形、无 pip、无 `·`。
 * 消声预告是第四槽（更淡），仅 `getForecastLookahead()` 非空时出现。
 * 稳定度不在本层（D7）。底栏 `#purif-prompt` 不是本批。
 */

import { gameState } from '@/managers/game-state';
import { impactSystem, SEVERITY_LABEL } from '@/systems/impact-system';
import type { ForecastSeverity } from '@/systems/impact-system';
import { tideSystem } from '@/systems/tide-system';
import type { TidePhase } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InteractionTargetType = 'core' | 'storage' | 'purifier' | 'rift' | 'defense' | 'growth' | 'thicken';

export interface ThickenPromptData {
  currentMax: number;
  nextMax: number | null;
  tier: number;
  cost: number | null;
  shortfall: number;
  status: 'affordable' | 'short' | 'capped';
}

export interface InteractionTarget {
  type: InteractionTargetType;
  distance: number;
  moduleData?: { hp: number; maxHp: number; effectPct: number };
  thickenData?: ThickenPromptData;
}

// ---------------------------------------------------------------------------
// Color palette (ui-art-overhaul.md A2 / A5-3 — locked values only)
// ---------------------------------------------------------------------------

const COL = {
  kindlingOrange: '#c4873a',
  dangerRed: '#cc3333',
  tideCyan: '#1aad96',
  dimText: '#8a8f96',
  brightText: '#c8cdd4',
  barEmpty: '#1a1e22',
} as const;

const MODULE_LABEL: Record<string, string> = { CORE: '核心', STORAGE: '储藏', PURIFIER: '净化器' };

/** Same phase words as status-panel `phaseLabels`. Do not invent 满潮 / 落潮. */
const TIDE_PHASE_LABEL: Record<TidePhase, string> = {
  rise: '涨潮',
  crest: '潮峰',
  ebb: '退潮',
};

const SLOT =
  'display:flex;flex-direction:row;flex:0 0 auto;align-items:baseline;gap:4px;white-space:nowrap;';

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PurificationHud {
  private hudEl: HTMLDivElement | null = null;
  private promptEl: HTMLDivElement | null = null;
  private lastPromptHtml = '';
  private lastHudHtml = '';
  private promptVisible = true;
  private thickenFlashUntil = 0;

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

    // DOM order + flex-end → visual left-to-right: lookahead (if any), 薪柴, 潮汐, 下次归来
    const html =
      this.buildLookaheadSlot() +
      this.buildKindlingSlot(reserve) +
      this.buildTideSlot(tideState.tideNumber, tideState.phase) +
      this.buildForecastSlot();

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
    this.thickenFlashUntil = 0;
  }

  /** Human-side positive flash after a successful thicken (300ms #e0a848 → rest). */
  flashThickenSuccess(): void {
    this.thickenFlashUntil = performance.now() + 300;
    this.lastPromptHtml = '';
  }

  // ------------------------------------------------------------------ private

  private createHudPanel(): void {
    document.getElementById('purif-hud')?.remove();

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'purif-hud';
    this.hudEl.style.cssText = [
      'position:absolute', 'top:10px', 'right:12px', 'z-index:999',
      'pointer-events:none',
      'display:flex', 'flex-direction:row', 'flex-wrap:nowrap',
      'align-items:baseline', 'justify-content:flex-end', 'gap:32px',
      'font-family:"Courier New",monospace',
      'text-shadow:0 0 2px rgba(0,0,0,0.8)',
    ].join(';');
    getDomUiRoot().appendChild(this.hudEl);
    this.refresh();
  }

  private createPromptBar(): void {
    document.getElementById('purif-prompt')?.remove();

    this.promptEl = document.createElement('div');
    this.promptEl.id = 'purif-prompt';
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

  private span(text: string, color: string, sizePx: number, extra = ''): string {
    return `<span style="color:${color};font-size:${sizePx}px;line-height:1.2;${extra}">${text}</span>`;
  }

  private name(text: string): string {
    return this.span(text, COL.dimText, 12);
  }

  private qty(text: string, color: string): string {
    return this.span(text, color, 13);
  }

  private grade(text: string, color: string): string {
    return this.span(text, color, 12);
  }

  private wrapSlot(inner: string, extra = ''): string {
    return `<div style="${SLOT}${extra}">${inner}</div>`;
  }

  /** 轻微/中等 stay dim so they don't steal kindling orange. 剧烈/极端 use danger. */
  private gradeColor(severity: ForecastSeverity): string {
    return severity === 'heavy' || severity === 'extreme' ? COL.dangerRed : COL.dimText;
  }

  private targetColor(targetId: string): string {
    if (targetId === 'STORAGE') return COL.kindlingOrange;
    if (targetId === 'PURIFIER') return COL.tideCyan;
    return COL.brightText;
  }

  private buildKindlingSlot(reserve: number): string {
    return this.wrapSlot(this.name('薪柴') + this.qty(String(reserve), COL.kindlingOrange));
  }

  private buildTideSlot(tideNumber: number, phase: TidePhase): string {
    return this.wrapSlot(
      this.name('潮汐') +
      this.qty(`第 ${tideNumber} 潮`, COL.tideCyan) +
      this.grade(TIDE_PHASE_LABEL[phase], COL.dimText),
    );
  }

  private buildForecastSlot(): string {
    const forecast = impactSystem.getForecastDisplay();
    if (!forecast) return '';

    const targetName = MODULE_LABEL[forecast.targetId] ?? '?';
    const pulse = forecast.severity === 'extreme'
      ? 'animation:hud-critical-pulse 0.3s ease-in-out infinite;'
      : '';

    return this.wrapSlot(
      this.name('下次归来') +
      this.qty(targetName, this.targetColor(forecast.targetId)) +
      this.grade(SEVERITY_LABEL[forecast.severity], this.gradeColor(forecast.severity)),
      pulse,
    );
  }

  private buildLookaheadSlot(): string {
    const lookahead = impactSystem.getForecastLookahead();
    if (!lookahead) return '';

    const targetName = MODULE_LABEL[lookahead.targetId] ?? '?';
    return this.wrapSlot(
      this.name('再下一轮') +
      this.qty(targetName, COL.dimText) +
      this.grade(SEVERITY_LABEL[lookahead.severity], COL.dimText),
      'opacity:0.85;',
    );
  }

  /** Inject the critical-pulse keyframe (idempotent) — Kit §A5-3 / A6: alpha 0.6-1.0, 300ms. */
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
    if (target.type === 'thicken' && target.thickenData) {
      return this.buildThickenPrompt(target.thickenData);
    }
    if (target.type === 'purifier') {
      return this.buildPurifierPrompt(target);
    }

    const detail = this.getPromptDetail(target);
    let html = `<span style="color:${COL.brightText};">[E]</span> <span style="color:#8a8f96;">${action}</span>`;
    if (detail) {
      html += `<span style="color:${COL.barEmpty};margin:0 6px;">│</span><span style="color:${COL.dimText};font-size:12px;">${detail}</span>`;
    }
    html += `<span style="color:${COL.barEmpty};margin:0 6px;">│</span>` + this.buildDefaultPrompt();
    return html;
  }

  private buildPurifierPrompt(target: InteractionTarget): string {
    const hp = target.moduleData?.hp;
    const maxHp = target.moduleData?.maxHp;
    let html = `<span style="color:${COL.brightText};font-size:12px;">[E]</span>`
      + `<span style="color:#8a8f96;font-size:12px;margin-left:6px;">净化器</span>`;
    if (hp !== undefined && maxHp !== undefined) {
      html += `<span style="color:#5a5f66;font-size:12px;margin:0 6px;">│</span>`
        + `<span style="color:#8a8f96;font-size:12px;">净化器完整度</span>`
        + `<span style="color:#c8cdd4;font-size:13px;margin-left:6px;">${hp}</span>`
        + `<span style="color:#8a8f96;font-size:12px;margin:0 4px;">/</span>`
        + `<span style="color:#c8cdd4;font-size:13px;">${maxHp}</span>`;
    }
    html += `<span style="color:${COL.barEmpty};margin:0 6px;">│</span>` + this.buildDefaultPrompt();
    return html;
  }

  private buildThickenPrompt(data: ThickenPromptData): string {
    const flash = performance.now() < this.thickenFlashUntil;
    const numColor = flash ? '#e0a848' : '#c8cdd4';
    const sep = `<span style="color:#5a5f66;font-size:12px;margin:0 6px;">│</span>`;
    let html = `<span style="color:#c8cdd4;font-size:12px;">[E]</span>`
      + `<span style="color:#8a8f96;font-size:12px;margin-left:6px;">加厚</span>`
      + sep
      + `<span style="color:#8a8f96;font-size:12px;">完整度上限</span>`
      + `<span style="color:${numColor};font-size:13px;margin-left:6px;">${data.currentMax}</span>`;
    if (data.status !== 'capped' && data.nextMax !== null) {
      html += `<span style="color:${numColor};font-size:13px;margin-left:6px;">${data.nextMax}</span>`;
    }
    html += `<span style="color:#8a8f96;font-size:12px;margin-left:8px;">档</span>`
      + `<span style="color:#8a8f96;font-size:12px;margin-left:6px;">第 ${data.tier} 档</span>`;
    html += `<span style="color:#8a8f96;font-size:12px;margin-left:8px;">薪柴</span>`;
    if (data.status === 'capped') {
      html += `<span style="color:#8a8f96;font-size:12px;margin-left:6px;">上限已至</span>`;
    } else if (data.status === 'short') {
      html += `<span style="color:#b89040;font-size:13px;margin-left:6px;">还差 ${data.shortfall}</span>`
        + `<span style="color:#b89040;font-size:12px;margin-left:8px;">薪柴不足 · 还差 ${data.shortfall}</span>`;
    } else {
      html += `<span style="color:#c4873a;font-size:13px;margin-left:6px;">${data.cost ?? ''}</span>`
        + `<span style="color:#c8cdd4;font-size:12px;margin-left:8px;">可加厚</span>`;
    }
    html += `<span style="color:${COL.barEmpty};margin:0 6px;">│</span>` + this.buildDefaultPrompt();
    return html;
  }

  private getActionLabel(target: InteractionTarget): string {
    switch (target.type) {
      case 'core': return '◈ 核心';
      case 'storage': return '▣ 储藏';
      case 'purifier': return '净化器';
      case 'thicken': return '加厚';
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
