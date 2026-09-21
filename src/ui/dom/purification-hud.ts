/** Net purification readout, anchored to the shared 960×640 DOM overlay.
 * Resource, tide and forecast remain separate rows. The prompt presents the
 * nearby action and its current consequence without reducing text opacity.
 */

import { gameState } from '@/managers/game-state';
import { impactSystem, SEVERITY_LABEL } from '@/systems/impact-system';
import type { ForecastSeverity } from '@/systems/impact-system';
import { tideSystem } from '@/systems/tide-system';
import { growthSystem } from '@/systems/growth-system';
import type { TidePhase } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InteractionTargetType = 'core' | 'storage' | 'purifier' | 'rift' | 'defense' | 'growth';

export interface InteractionTarget {
  type: InteractionTargetType;
  distance: number;
  moduleData?: { hp: number; maxHp: number; effectPct: number };
}

// ---------------------------------------------------------------------------
// Color palette (ui-art-overhaul.md A2 / A5-3 / A8 — locked values only)
// ---------------------------------------------------------------------------

const COL = {
  kindlingOrange: '#b29a73',
  dangerRed: '#cc3333',
  tideCyan: '#729887',
  dimText: '#8a8f96',
  brightText: '#b5bbaf',
  plateEdge: '#2a2d32',
} as const;

const MODULE_LABEL: Record<string, string> = { CORE: '核心', STORAGE: '储藏', PURIFIER: '净化器' };

/** Same phase words as status-panel `phaseLabels`. Do not invent 满潮 / 落潮. */
const TIDE_PHASE_LABEL: Record<TidePhase, string> = {
  rise: '涨潮',
  crest: '潮峰',
  ebb: '退潮',
};

const ACTION_LABEL: Record<InteractionTargetType, string> = {
  core: '核心',
  storage: '储藏',
  purifier: '净化器',
  rift: '踏入裂隙',
  defense: '供奉',
  growth: '蜕变',
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
  private nearestTarget: InteractionTarget | null = null;

  private onReport: (() => void) | undefined;

  create(onReport?: () => void): void {
    this.destroy();
    this.onReport = onReport;
    injectPanelStyles();
    this.promptVisible = true;
    this.createHudPanel();
    this.createPromptBar();
  }

  /** Update the bottom prompt bar based on nearest interaction target. */
  updatePrompt(target: InteractionTarget | null): void {
    const wasRift = this.nearestTarget?.type === 'rift';
    this.nearestTarget = target;
    if (wasRift !== (target?.type === 'rift')) {
      this.refresh();
    }

    if (!this.promptEl) return;

    if (!this.promptVisible) {
      this.applyPromptOpacity();
      return;
    }

    const html = target ? this.buildNearPrompt(target) : this.buildIdlePrompt();
    if (html !== this.lastPromptHtml) {
      this.promptEl.innerHTML = html;
      this.lastPromptHtml = html;
    }
    this.applyPromptOpacity();
  }

  /** Refresh HUD values (call after kindling/tide changes). Stability moved to the
   *  survival report — see the class doc comment (D7). */
  refresh(): void {
    if (!this.hudEl) return;

    const reserve = gameState.getKindlingReserve();
    const tideState = tideSystem.getState();

    const html =
      `<div class="purif-hud-inner">` +
        `<div class="purif-hud-kindling">${this.name('薪柴')}${this.span(String(reserve), COL.kindlingOrange, 11, 'font-family:var(--ui-mono);')}</div>` +
        `<div class="purif-hud-details">` +
          this.buildTideSlot(tideState.tideNumber, tideState.phase) +
          this.buildForecastSlot() +
          this.buildLookaheadSlot() +
        `</div>` +
        (this.onReport ? `<button type="button" class="hud-report-entry" id="purif-report-entry" aria-label="打开存续报告（Tab）" aria-keyshortcuts="Tab"><span class="hud-entry-key">Tab</span><span>存续报告</span></button>` : '') +
      `</div>`;

    if (html !== this.lastHudHtml) {
      // Keep the actual control node: inventory remembers it to restore focus
      // after an equipment transaction updates this HUD behind the open panel.
      const entry = this.hudEl.querySelector<HTMLButtonElement>('#purif-report-entry');
      const restoreFocus = entry === document.activeElement;
      this.hudEl.innerHTML = html;
      const replacement = this.hudEl.querySelector<HTMLButtonElement>('#purif-report-entry');
      if (entry && replacement) {
        replacement.replaceWith(entry);
        if (restoreFocus) entry.focus({ preventScroll: true });
      }
      this.lastHudHtml = html;
    }
  }

  /** Hide/show the prompt bar (hide when panels are open). */
  setPromptVisible(visible: boolean): void {
    this.promptVisible = visible;
    this.applyPromptOpacity();
  }

  /** Entry veil owns the fade; visibility keeps both readouts out of the reveal. */
  setEntryVisible(visible: boolean): readonly HTMLElement[] {
    const elements: HTMLElement[] = [];
    for (const element of [this.hudEl, this.promptEl]) {
      if (!element) continue;
      element.style.visibility = visible ? '' : 'hidden';
      elements.push(element);
    }
    return elements;
  }

  destroy(): void {
    this.onReport = undefined;
    this.hudEl?.remove();
    this.hudEl = null;
    this.promptEl?.remove();
    this.promptEl = null;
    this.lastPromptHtml = '';
    this.lastHudHtml = '';
    this.nearestTarget = null;
  }

  // ------------------------------------------------------------------ private

  private applyPromptOpacity(): void {
    if (!this.promptEl) return;
    if (!this.promptVisible) {
      this.promptEl.style.opacity = '0';
      return;
    }
    this.promptEl.style.opacity = '1';
  }

  private createHudPanel(): void {
    document.getElementById('purif-hud')?.remove();

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'purif-hud';
    this.hudEl.className = 'device-plate';
    this.hudEl.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('.hud-report-entry')) { event.stopPropagation(); this.onReport?.(); }
    });
    for (const name of ['pointerdown', 'keydown', 'keyup'] as const) this.hudEl.addEventListener(name, event => {
      if (event.target instanceof Element && event.target.closest('.hud-report-entry') && (!(event instanceof KeyboardEvent) || ['Enter', ' '].includes(event.key))) event.stopPropagation();
    });
    getDomUiRoot().appendChild(this.hudEl);
    this.refresh();
  }

  private createPromptBar(): void {
    document.getElementById('purif-prompt')?.remove();

    this.promptEl = document.createElement('div');
    this.promptEl.id = 'purif-prompt';
    this.promptEl.className = 'device-plate';
    this.promptEl.innerHTML = this.buildIdlePrompt();
    this.lastPromptHtml = this.promptEl.innerHTML;
    getDomUiRoot().appendChild(this.promptEl);
  }

  private span(text: string, color: string, sizePx: number, extra = ''): string {
    return `<span style="color:${color};font-size:${sizePx}px;line-height:16px;${extra}">${text}</span>`;
  }

  private name(text: string): string {
    return this.span(text, COL.dimText, 11);
  }

  private qty(text: string, color: string): string {
    return this.span(text, color, 11, 'font-family:var(--ui-mono);');
  }

  private grade(text: string, color: string): string {
    return this.span(text, color, 11);
  }

  private wrapSlot(inner: string, extra = ''): string {
    return `<div class="purif-readout-slot" style="${extra}">${inner}</div>`;
  }

  private sep(): string {
    return this.span('│', COL.plateEdge, 11, 'margin:0 8px;');
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

  private moduleValueColor(type: InteractionTargetType): string {
    if (type === 'storage') return COL.kindlingOrange;
    if (type === 'purifier') return COL.tideCyan;
    return COL.brightText;
  }

  private buildTideSlot(tideNumber: number, phase: TidePhase): string {
    return this.wrapSlot(
      this.name('潮汐') +
      this.qty(`第 ${tideNumber} 潮`, COL.tideCyan) +
      this.grade(TIDE_PHASE_LABEL[phase], COL.dimText),
    );
  }

  private buildForecastSlot(): string {
    const forecast = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'));
    if (!forecast) return '';

    const targetName = MODULE_LABEL[forecast.targetId] ?? '?';
    const nearRift = this.nearestTarget?.type === 'rift';

    if (!nearRift) {
      return this.wrapSlot(
        this.name('下次归来') +
        this.span(`${targetName}${forecast.targetCertain ? '' : '？'}`, COL.dimText, 11) +
        this.span(`${SEVERITY_LABEL[forecast.severity]}${forecast.severityCertain ? '' : '？'}`, COL.dimText, 11),
      );
    }

    return this.wrapSlot(
      this.name('下次归来') +
      this.qty(`${targetName}${forecast.targetCertain ? '' : '？'}`, this.targetColor(forecast.targetId)) +
      this.grade(`${SEVERITY_LABEL[forecast.severity]}${forecast.severityCertain ? '' : '？'}`, this.gradeColor(forecast.severity)),
      forecast.severity === 'extreme' ? 'border-left:2px solid #cc3333;padding-left:6px;' : '',
    );
  }

  private buildLookaheadSlot(): string {
    const lookahead = impactSystem.getForecastLookahead();
    if (!lookahead) return '';

    const targetName = MODULE_LABEL[lookahead.targetId] ?? '?';
    return this.wrapSlot(
      this.name('再下一轮') +
      this.span(targetName, COL.dimText, 11) +
      this.span(SEVERITY_LABEL[lookahead.severity], COL.dimText, 11),

    );
  }

  private buildChromeHints(): string {
    return this.span('Tab', COL.brightText, 11, 'font-family:var(--ui-mono);') +
      this.name('存续报告') + this.sep() +
      this.span('Esc', COL.brightText, 11, 'font-family:var(--ui-mono);') +
      this.name('纪录');
  }

  private buildIdlePrompt(): string {
    return `<div class="purif-prompt-hints">${this.buildChromeHints()}</div>`;
  }

  private buildNearPrompt(target: InteractionTarget): string {
    const preview = this.buildPromptPreview(target);
    return `<div class="purif-prompt-inner">` +
      `<div class="purif-readout-slot">` +
        this.span('[E]', COL.brightText, 11, 'font-family:var(--ui-mono);') +
        this.span(ACTION_LABEL[target.type], COL.brightText, 11) +
      `</div>` +
      (preview ? `<div class="purif-readout-slot">${preview}</div>` : '') +
      `</div>`;
  }

  /**
   * Second-row preview nodes. Table name / value / grade as separate nodes.
   * Empty slot → null (omit preview nodes only; caller still draws row 2 + Tab/Esc).
   * No 「生存」.
   */
  private buildPromptPreview(target: InteractionTarget): string | null {
    if (target.type === 'rift') {
      const cycle = gameState.getCycle();
      const forecast = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'));
      return this.name('出击') +
        this.qty(`第 ${cycle + 1} 次`, COL.brightText) +
        (forecast ? this.name('强度') +
          this.grade(`${SEVERITY_LABEL[forecast.severity]}${forecast.severityCertain ? '' : '？'}`, COL.brightText) : '');
    }

    const data = target.moduleData;
    if (!data) return null;

    const valueColor = this.moduleValueColor(target.type);
    const hpBlock =
      this.name('完整度') +
      this.qty(String(data.hp), valueColor) +
      this.span('/', COL.dimText, 11) +
      this.qty(String(data.maxHp), valueColor);

    if (target.type === 'core') {
      return hpBlock +
        this.name('混乱增速') +
        this.qty(`-${data.effectPct}%`, valueColor);
    }
    if (target.type === 'storage') {
      return hpBlock +
        this.name('薪柴价值') +
        this.qty(`+${data.effectPct}%`, valueColor);
    }
    if (target.type === 'purifier') {
      return hpBlock;
    }
    return hpBlock;
  }
}

/** Singleton instance for this scene's HUD. */
export const purificationHud = new PurificationHud();
