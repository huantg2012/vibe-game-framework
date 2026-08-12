/**
 * ImpactResultPanel - DOM overlay showing impact damage results.
 *
 * Game-style compact damage report: colored bars per module showing damage,
 * inline charge progress mini-bars, and (Slice 5.5 D5) a full disclosure of what
 * the defense engine actually did this impact — previously `defense-engine.ts`
 * computed ten distinct outputs per impact and this panel showed none of them,
 * so the defense slots' investment was invisible to the player (IA §S8).
 *
 * D5 also merges the tide-phase-change and stability-milestone notifications into
 * this panel (as a trailing section) instead of chaining two more "知道了"-style
 * dismissals after it closes — IA §S14's "one blocking notification per return".
 */

import type { ImpactDamageEntry, ForecastSeverity } from '@/systems/impact-system';
import { SEVERITY_LABEL } from '@/systems/impact-system';
import type { DefenseResult, SlotDisclosure } from '@/systems/defense-engine';
import type { PhaseChangeInfo } from '@/systems/tide-system';
import type { ContaminantType } from '@/types/game-types';
import { getDefenseName } from '@/ui/contaminant-names';
import { describeSideEffectWithSource } from '@/ui/side-effect-labels';
import { getDomUiRoot, injectPanelStyles, scrollFocusedIntoView } from './panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Charge change data for a single defense slot. Display name is derived from
 *  `type` via `getDefenseName` (CLAUDE.md 策划数据源规则) — not carried here, so
 *  there is no local copy that can drift from the CSV. */
export interface ChargeChangeEntry {
  slotIndex: number;
  type: ContaminantType;
  before: number;
  after: number;
  threshold: number;
  transformed: boolean;
}

export interface ImpactPanelOptions {
  chargeChanges?: readonly ChargeChangeEntry[];
  /** Full defense-engine output for this impact (undefined = no defense slots active). */
  defenseResult?: DefenseResult;
  /** Per-module damage before defense reduction — only meaningful alongside `defenseResult`. */
  baseDamagePerModule?: Record<string, number>;
  /** The forecast the player saw before this impact happened (may be misreported/blurred). */
  forecastPrediction?: { targetId: string; severity: ForecastSeverity } | null;
  /** Ground truth for this impact, to compare against the prediction above. */
  actualPrimaryModuleId?: string;
  actualSeverity?: ForecastSeverity;
  /** Merged in per D5 — replaces the separate tide-phase overlay that used to chain
   *  after this panel closed. */
  phaseChange?: PhaseChangeInfo | null;
  /** Merged in per D5 — replaces the separate stability-milestone overlay for the
   *  specific milestone crossed by this return trip's extraction bonus. */
  stabilityMilestoneMessage?: string | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let onDoneCallback: (() => void) | null = null;

const MODULE_LABELS: Record<string, string> = { CORE: '核心', STORAGE: '储藏' };
// A2 mapping: CORE green #4d9a6b → ui-text-bright; STORAGE stays warm-glow.
const MODULE_COLORS: Record<string, string> = { CORE: '#c8cdd4', STORAGE: '#c4873a' };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const impactResultPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  /** Show the impact result. Calls onDone when the user dismisses the panel. */
  show(
    damages: readonly ImpactDamageEntry[],
    intensity: number,
    onDone: () => void,
    options: ImpactPanelOptions = {},
  ): void {
    if (panel) destroyPanel();

    onDoneCallback = onDone;
    injectPanelStyles();

    panel = document.createElement('div');
    panel.id = 'impact-result-panel';
    panel.className = 'game-panel';
    panel.style.cssText = [
      'position:absolute',
      'top:0',
      'right:0',
      'height:640px',
      'width:440px',
      'z-index:1001',
      'display:flex',
      'flex-direction:column',
      'border-color:#cc3333',
      'animation:impact-shake 0.3s ease-out',
      'pointer-events:auto',
    ].join(';');

    // Inject keyframe if not already present
    if (!document.getElementById('impact-shake-style')) {
      const style = document.createElement('style');
      style.id = 'impact-shake-style';
      style.textContent = `
        @keyframes impact-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
      `;
      document.head.appendChild(style);
    }

    const root = getDomUiRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop';
    backdrop.id = 'impact-backdrop';
    root.appendChild(backdrop);

    panel.innerHTML = buildHtml(damages, intensity, options);
    root.appendChild(panel);
    scrollFocusedIntoView(panel);

    // Wire close button click
    panel.querySelector('#impact-close-btn')?.addEventListener('click', dismiss);

    // Enter/Esc both close — the button text implies Enter, so Enter must actually
    // work (IA §S8 called this out: "按钮文案暗示回车，绑定却没有").
    document.addEventListener('keydown', onKeyDown);
  },

  close(): void {
    dismiss();
  },

  destroy(): void {
    destroyPanel();
  },
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function buildHtml(
  damages: readonly ImpactDamageEntry[],
  intensity: number,
  options: ImpactPanelOptions,
): string {
  let html = `<div style="text-align:center;margin-bottom:8px;">
    <div style="font-size:18px;font-weight:bold;color:#cc3333;">冲击 x${intensity.toFixed(2)}</div>
  </div>`;
  html += `<div class="scroll-area">`;

  // --- Damage bars (基础 → 实际 when defense reduced them, D5) ---
  const base = options.baseDamagePerModule;
  const maxDmg = Math.max(...damages.map((d) => d.damage), 1);
  for (const d of damages) {
    const color = MODULE_COLORS[d.moduleId] ?? '#c8cdd4';
    const label = MODULE_LABELS[d.moduleId] ?? d.moduleId;
    const barPct = Math.round((d.damage / maxDmg) * 100);
    const baseDmg = base?.[d.moduleId];
    const valueText = baseDmg !== undefined && baseDmg !== d.damage
      ? `${baseDmg} → -${d.damage}`
      : `-${d.damage}`;
    html += `<div class="dmg-row">
      <span class="dmg-label" style="color:${color};">${label}</span>
      <div class="dmg-bar-wrap">
        <div class="dmg-bar-fill" style="width:${barPct}%;background:#cc3333;"></div>
      </div>
      <span class="dmg-value" style="color:#cc3333;min-width:56px;">${valueText}</span>
    </div>`;
  }

  // --- Defense disclosure: 逐槽 "残渣名 + 它做了什么" (D5 primary deliverable) ---
  const defenseResult = options.defenseResult;
  if (defenseResult && defenseResult.slotDisclosures.length > 0) {
    html += `<div class="separator"></div>`;
    html += `<div class="section-title">防御生效</div>`;
    for (const sd of defenseResult.slotDisclosures) {
      const name = getDefenseName(sd.type);
      const facts = buildSlotFacts(sd);
      html += `<div style="font-size:13px;padding:2px 0;">
        <span style="color:#1aad96;font-weight:bold;">${name}</span>
        <span style="color:#8a8f96;"> · ${facts.join(' · ')}</span>
      </div>`;
    }
  }

  // --- Residual: side effects carried into the next sortie (D5) ---
  if (defenseResult && defenseResult.sideEffects.length > 0) {
    const lines = defenseResult.sideEffects
      .map(describeSideEffectWithSource)
      .filter((l): l is string => l !== null);
    if (lines.length > 0) {
      html += `<div class="separator"></div>`;
      html += `<div class="section-title">本次产生的残留</div>`;
      for (const line of lines) {
        html += `<div style="font-size:13px;color:#b89040;padding:1px 0;">${line}</div>`;
      }
    }
  }

  // --- Forecast vs actual (D5) ---
  const forecastLine = buildForecastLine(options);
  if (forecastLine) {
    html += `<div class="separator"></div>`;
    html += `<div style="font-size:13px;color:#8a8f96;padding:2px 0;">${forecastLine}</div>`;
  }

  // --- Charge progress (existing, D2) ---
  const chargeChanges = options.chargeChanges;
  if (chargeChanges && chargeChanges.length > 0) {
    html += `<div class="separator"></div>`;
    html += `<div style="font-size:13px;color:#8a8f96;margin-bottom:4px;">防御充能</div>`;
    for (const c of chargeChanges) {
      const name = getDefenseName(c.type);
      const afterPct = Math.round((c.after / c.threshold) * 100);
      // A2: #6644aa → contam-deep (charging dark state)
      const barColor = c.transformed ? '#1aad96' : '#0e4a3f';
      html += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
        <span style="font-size:12px;color:#8a8f96;min-width:32px;">${name}</span>
        <div class="stat-bar" style="flex:1;">
          <div class="stat-bar-fill" style="width:${afterPct}%;background:${barColor};"></div>
        </div>
        <span style="font-size:12px;color:${c.transformed ? '#1aad96' : '#8a8f96'};">${c.transformed ? '已转化' : `${c.after}/${c.threshold}`}</span>
      </div>`;
    }
  }

  // --- Merged: tide phase change + stability milestone (D5 — one notification, not three) ---
  const mergedNotices: { text: string; color: string }[] = [];
  if (options.phaseChange) mergedNotices.push(buildPhaseChangeNotice(options.phaseChange));
  if (options.stabilityMilestoneMessage) {
    mergedNotices.push({ text: options.stabilityMilestoneMessage, color: '#8a5c2a' });
  }
  if (mergedNotices.length > 0) {
    html += `<div class="separator"></div>`;
    for (const n of mergedNotices) {
      html += `<div style="font-size:13px;color:${n.color};text-align:center;padding:3px 0;">${n.text}</div>`;
    }
  }

  html += `</div>`; // end flex:1 content wrapper
  html += `<div class="action-bar">
    <span id="impact-close-btn" class="action-btn btn-muted" style="cursor:pointer;">知道了</span>
  </div>`;
  html += `<div class="key-hint-bar"><span class="key">Enter</span> / <span class="key">Esc</span> 关闭</div>`;

  return html;
}

/** Build the fact list for one defense slot's disclosure line (D5). Falls back to
 *  a plain reduction% when a slot produced no other observable outcome this impact
 *  (e.g. a slot whose only job is the base damage reduction). */
function buildSlotFacts(sd: SlotDisclosure): string[] {
  const facts: string[] = [];

  if (sd.expandNullified) {
    facts.push('完全无效化');
  } else if (sd.scatterRedistributed) {
    facts.push('伤害均摊至全部模块');
  } else if (sd.damageBlocked > 0) {
    facts.push(`挡下 ${sd.damageBlocked}`);
  } else if (sd.type === 'expand') {
    facts.push('未生效（本次判定失败）');
  }

  if (sd.kindlingGain > 0) facts.push(`返还 ${sd.kindlingGain} 薪柴`);
  if (sd.kindlingReturned) facts.push(`返还 ${sd.kindlingReturned} 薪柴`);
  if (sd.stabilityChange !== 0) facts.push(`稳定度 ${sd.stabilityChange > 0 ? '+' : ''}${sd.stabilityChange}`);
  if (sd.upgradeDiscount > 0) facts.push(`改造折扣 +${Math.round(sd.upgradeDiscount * 100)}%`);
  if (sd.toolUseGrant) facts.push('随机工具 次数+1');
  if (sd.moduleSwapTriggered) facts.push('模块功能互换（下次出击）');
  if (sd.equalizationAmount) facts.push('模块 HP 向均值调整');
  if (sd.healAmount) {
    const moduleLabel = MODULE_LABELS[sd.healModuleId ?? ''] ?? sd.healModuleId;
    facts.push(`修复 ${sd.healAmount} 至 ${moduleLabel}`);
  }
  if (sd.bonusChargesGranted) facts.push(`为其他槽 +${sd.bonusChargesGranted} 冲击计数`);
  if (sd.bonusDamageDealt) {
    const moduleLabel = MODULE_LABELS[sd.bonusDamageModuleId ?? ''] ?? sd.bonusDamageModuleId;
    facts.push(`额外命中 ${moduleLabel} -${sd.bonusDamageDealt}（不吃减伤）`);
  }

  if (facts.length === 0) facts.push(`减伤 ${Math.round(sd.damageReductionPct * 100)}%`);
  return facts;
}

function buildForecastLine(options: ImpactPanelOptions): string | null {
  const predicted = options.forecastPrediction;
  if (!predicted || !options.actualPrimaryModuleId || !options.actualSeverity) return null;

  const predictedModule = MODULE_LABELS[predicted.targetId] ?? predicted.targetId;
  const actualModule = MODULE_LABELS[options.actualPrimaryModuleId] ?? options.actualPrimaryModuleId;
  const predictedLabel = `${predictedModule} · ${SEVERITY_LABEL[predicted.severity]}`;

  const matched = predicted.targetId === options.actualPrimaryModuleId
    && predicted.severity === options.actualSeverity;
  if (matched) return `预告 ${predictedLabel} · 与实际一致`;

  const actualLabel = `${actualModule} · ${SEVERITY_LABEL[options.actualSeverity]}`;
  return `预告 ${predictedLabel} · 实际 ${actualLabel}`;
}

function buildPhaseChangeNotice(info: PhaseChangeInfo): { text: string; color: string } {
  // Colors mapped to the locked palette while relocating this block from its old
  // standalone overlay (which predated the A2 color audit): crest = danger red
  // (pressure at peak), new tide = the same teal already used for the tide row's
  // "current position" marker in purification-hud.ts (COL.tideCyan), ebb = neutral
  // (pressure easing is "fading to neutral", not "turning green" — A2).
  if (info.to === 'crest') return { text: '潮峰期。冲击强度维持峰值。', color: '#cc3333' };
  if (info.to === 'ebb') return { text: '退潮期。压力暂缓。', color: '#8a8f96' };
  return { text: `第${info.newTideNumber}潮汐。边界压力上升。`, color: '#1aad96' };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' || e.key === 'Enter') {
    e.stopPropagation();
    e.preventDefault();
    dismiss();
  }
}

function dismiss(): void {
  document.removeEventListener('keydown', onKeyDown);
  const cb = onDoneCallback;
  onDoneCallback = null;
  destroyPanel();
  cb?.();
}

function destroyPanel(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('impact-backdrop')?.remove();
}
