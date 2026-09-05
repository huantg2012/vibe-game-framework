/**
 * Purification HUD — purification-point monitor readout (carrier A, edge-anchored).
 *
 * DEC-118 / Kit §A8：装置读数板。`#purif-hud` / `#purif-prompt` 用 `.device-plate`
 *（直角暗边、无圆角、无投影），不套 `.game-panel`。Slice 5.5「不套容器」已由
 * DEC-118 收回。
 *
 * 分组：上行只薪柴；下行潮汐 + 下次归来（+ 可选再下一轮）。「下次归来」默认弱，
 * 仅 `InteractionTarget.type === 'rift'` 时满显。底栏无目标半透明一行，靠近两行
 * 预览。表名 / 数值 / 档位分节点。不画条、不画 ◇◈▣、不加回稳定度。
 *
 * Copy (DEC-047)：无菱形、无波形、无 pip、无 `·`。挂 `#dom-ui-root`。
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
  kindlingOrange: '#c4873a',
  dangerRed: '#cc3333',
  tideCyan: '#1aad96',
  dimText: '#8a8f96',
  brightText: '#c8cdd4',
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

const SLOT =
  'display:flex;flex-direction:row;flex:0 0 auto;align-items:baseline;gap:4px;white-space:nowrap;';

const HUD_INNER =
  'position:relative;z-index:1;display:flex;flex-direction:column;flex-wrap:nowrap;';

const PROMPT_INNER =
  'position:relative;z-index:1;display:flex;flex-direction:column;flex-wrap:nowrap;gap:2px;';

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

  create(): void {
    injectPanelStyles();
    this.injectForecastStyles();
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
      `<div style="${HUD_INNER}">` +
        this.wrapSlot(this.name('薪柴') + this.span(String(reserve), COL.kindlingOrange, 16)) +
        `<div style="height:1px;background:${COL.plateEdge};margin:6px 0;flex:none;"></div>` +
        `<div style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:baseline;gap:24px;">` +
          this.buildLookaheadSlot() +
          this.buildTideSlot(tideState.tideNumber, tideState.phase) +
          this.buildForecastSlot() +
        `</div>` +
      `</div>`;

    if (html !== this.lastHudHtml) {
      this.hudEl.innerHTML = html;
      this.lastHudHtml = html;
    }
  }

  /** Hide/show the prompt bar (hide when panels are open). */
  setPromptVisible(visible: boolean): void {
    this.promptVisible = visible;
    this.applyPromptOpacity();
  }

  destroy(): void {
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
    this.promptEl.style.opacity = this.nearestTarget ? '1' : '0.5';
  }

  private createHudPanel(): void {
    document.getElementById('purif-hud')?.remove();

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'purif-hud';
    this.hudEl.className = 'device-plate';
    this.hudEl.style.cssText = [
      'position:absolute', 'top:10px', 'right:12px', 'z-index:999',
      'pointer-events:none',
      'display:flex', 'flex-direction:column', 'flex-wrap:nowrap',
      'padding:8px 12px',
      'background:rgba(15,17,20,0.82)',
      'border:1px solid #2a2d32',
      'border-radius:0',
      'box-shadow:none',
      'box-sizing:border-box',
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
    this.promptEl.className = 'device-plate';
    this.promptEl.style.cssText = [
      'position:absolute', 'bottom:16px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:999', 'pointer-events:none',
      'max-width:420px',
      'padding:5px 16px',
      'background:rgba(15,17,20,0.88)',
      'border:1px solid #2a2d32',
      'border-radius:0',
      'box-shadow:none',
      'box-sizing:border-box',
      'font-family:"Courier New",monospace',
      'color:' + COL.dimText,
      'transition:opacity 150ms ease-out',
      'opacity:0.5',
      'text-shadow:0 0 2px rgba(0,0,0,0.8)',
    ].join(';');
    this.promptEl.innerHTML = this.buildIdlePrompt();
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

  private sep(): string {
    return this.span('│', COL.plateEdge, 12, 'margin:0 6px;');
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
    const forecast = impactSystem.getForecastDisplay();
    if (!forecast) return '';

    const targetName = MODULE_LABEL[forecast.targetId] ?? '?';
    const nearRift = this.nearestTarget?.type === 'rift';

    if (!nearRift) {
      return this.wrapSlot(
        this.span('下次归来', COL.dimText, 12) +
        this.span(targetName, COL.dimText, 12) +
        this.span(SEVERITY_LABEL[forecast.severity], COL.dimText, 12),
      );
    }

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
      this.span('再下一轮', COL.dimText, 12) +
      this.span(targetName, COL.dimText, 12) +
      this.span(SEVERITY_LABEL[lookahead.severity], COL.dimText, 12),
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

  private buildChromeHints(): string {
    return this.span('Tab:存续报告', COL.dimText, 12) +
      this.sep() +
      this.span('Esc:记录', COL.dimText, 12);
  }

  private buildIdlePrompt(): string {
    return `<div style="${PROMPT_INNER}">` +
      `<div style="${SLOT}">${this.buildChromeHints()}</div>` +
      `</div>`;
  }

  private buildNearPrompt(target: InteractionTarget): string {
    const row1 =
      `<div style="${SLOT}gap:6px;">` +
        this.span('[E]', COL.brightText, 13) +
        this.span(ACTION_LABEL[target.type], COL.dimText, 13) +
      `</div>`;

    const preview = this.buildPromptPreview(target);
    const row2 =
      `<div style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:baseline;justify-content:space-between;gap:16px;width:100%;">` +
        `<div style="${SLOT}">${preview ?? ''}</div>` +
        `<div style="${SLOT}flex:0 0 auto;">${this.buildChromeHints()}</div>` +
      `</div>`;

    return `<div style="${PROMPT_INNER}">${row1}${row2}</div>`;
  }

  /**
   * Second-row preview nodes. Table name / value / grade as separate nodes.
   * Empty slot → null (omit preview nodes only; caller still draws row 2 + Tab/Esc).
   * No 「生存」.
   */
  private buildPromptPreview(target: InteractionTarget): string | null {
    if (target.type === 'rift') {
      const cycle = gameState.getCycle();
      const intensity = tideSystem.getState().currentIntensity.toFixed(1);
      return this.name('出击') +
        this.qty(`第 ${cycle + 1} 次`, COL.brightText) +
        this.name('强度') +
        this.qty(`x${intensity}`, COL.brightText);
    }

    const data = target.moduleData;
    if (!data) return null;

    const valueColor = this.moduleValueColor(target.type);
    const hpBlock =
      this.name('完整度') +
      this.qty(String(data.hp), valueColor) +
      this.span('/', COL.dimText, 12) +
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
