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
import { getDefenseName, getToolName } from '@/ui/contaminant-names';
import { describeSideEffectBody } from '@/ui/side-effect-labels';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';

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
    panel = createCrtPanel('impact-result-panel');
    panel.style.animation = 'impact-shake 0.3s ease-out';

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

function severityColor(severity: ForecastSeverity): string {
  if (severity === 'light') return '#8a8f96';
  if (severity === 'moderate') return '#b89040';
  return '#cc3333';
}

function buildHtml(
  damages: readonly ImpactDamageEntry[],
  intensity: number,
  options: ImpactPanelOptions,
): string {
  const severity = options.actualSeverity;
  let html = `<div class="panel-title" style="color:#cc3333;">冲击结算</div>`;
  html += `<div style="display:flex;align-items:baseline;gap:8px;margin:4px 0 8px;">
    <span style="font-size:12px;color:#8a8f96;">冲击</span>
    <span style="font-size:16px;font-weight:bold;color:#cc3333;">x${intensity.toFixed(2)}</span>
    ${severity ? `<span style="font-size:12px;color:${severityColor(severity)};">${SEVERITY_LABEL[severity]}</span>` : ''}
  </div>`;
  html += `<div class="scroll-area">`;

  // 表名 / 基础 / 数值 / 实际 / 数值 分节点（禁止 32 → -11 粘一句）
  const base = options.baseDamagePerModule;
  const maxDmg = Math.max(
    ...damages.map((d) => Math.max(d.damage, base?.[d.moduleId] ?? d.damage)),
    1,
  );
  for (const d of damages) {
    const color = MODULE_COLORS[d.moduleId] ?? '#c8cdd4';
    const label = MODULE_LABELS[d.moduleId] ?? d.moduleId;
    const barPct = Math.round((d.damage / maxDmg) * 100);
    const baseDmg = base?.[d.moduleId] ?? d.damage;
    html += `<div class="dmg-row">
      <span class="dmg-label" style="color:${color};">${label}</span>
      <span style="font-size:12px;color:#8a8f96;">基础</span>
      <span style="font-size:16px;font-weight:bold;color:#c8cdd4;">${baseDmg}</span>
      <span style="font-size:12px;color:#8a8f96;">→</span>
      <span style="font-size:12px;color:#8a8f96;">实际</span>
      <span style="font-size:16px;font-weight:bold;color:${d.moduleId === 'STORAGE' ? '#c4873a' : '#cc3333'};">${d.damage}</span>
      <div class="dmg-bar-wrap">
        <div class="dmg-bar-fill" style="width:${barPct}%;background:#cc3333;"></div>
      </div>
    </div>`;
  }

  // 逐槽：残渣名 + 挡下 N（分节点）
  const defenseResult = options.defenseResult;
  if (defenseResult && defenseResult.slotDisclosures.length > 0) {
    html += `<div class="separator"></div>`;
    for (const sd of defenseResult.slotDisclosures) {
      const name = getDefenseName(sd.type);
      const facts = buildSlotFacts(sd);
      html += `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:3px 0;">
        <span style="font-size:13px;font-weight:bold;color:#1aad96;">${name}</span>
        ${facts.map((f) => `<span style="font-size:12px;color:#8a8f96;">${f.label}</span><span style="font-size:16px;font-weight:bold;color:${f.color};">${f.value}</span>${f.unit ? `<span style="font-size:12px;color:#8a8f96;">${f.unit}</span>` : ''}`).join('')}
      </div>`;
    }
  }

  // 充能 / 转化
  const chargeChanges = options.chargeChanges;
  if (chargeChanges && chargeChanges.length > 0) {
    html += `<div class="separator"></div>`;
    for (const c of chargeChanges) {
      const name = getDefenseName(c.type);
      html += `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:3px 0;">
        <span style="font-size:13px;font-weight:bold;color:${c.transformed ? '#3cffd4' : '#1aad96'};">${name}</span>
        <span style="font-size:13px;color:#c8cdd4;">${c.before}</span>
        <span style="font-size:12px;color:#8a8f96;">→</span>
        <span style="font-size:13px;color:#c8cdd4;">${c.after}</span>
        <span style="font-size:12px;color:#8a8f96;">/</span>
        <span style="font-size:13px;color:#c8cdd4;">${c.threshold}</span>
        ${c.transformed ? `<span style="font-size:12px;color:#1aad96;">转化</span><span style="font-size:13px;font-weight:bold;color:#1aad96;">${getToolName(c.type)}</span>` : ''}
      </div>`;
    }
  }

  // 本次残留（表名 / 事实 / 数值 / 来源 分节点）
  if (defenseResult && defenseResult.sideEffects.length > 0) {
    const rows = defenseResult.sideEffects
      .map((e) => {
        const body = describeSideEffectBody(e);
        if (!body) return null;
        const split = body.search(/[+\-x]/);
        const fact = split > 0 ? body.slice(0, split).trim() : body;
        const value = split > 0 ? body.slice(split) : '';
        const src = e.source ? getDefenseName(e.source as ContaminantType) : '';
        return { fact, value, src };
      })
      .filter((x): x is { fact: string; value: string; src: string } => x !== null);
    if (rows.length > 0) {
      html += `<div class="separator"></div>`;
      for (const row of rows) {
        html += `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:3px 0;">
          <span style="font-size:12px;color:#8a8f96;">本次残留</span>
          <span style="font-size:13px;color:#c8cdd4;">${row.fact}</span>
          ${row.value ? `<span style="font-size:16px;font-weight:bold;color:#1aad96;">${row.value}</span>` : ''}
          ${row.src ? `<span style="font-size:12px;color:#8a8f96;">←</span><span style="font-size:13px;color:#3cffd4;">${row.src}</span>` : ''}
        </div>`;
      }
    }
  }

  const forecastHtml = buildForecastHtml(options);
  if (forecastHtml) {
    html += `<div class="separator"></div>`;
    html += forecastHtml;
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

  html += `</div>`;
  html += `<div class="key-hint-bar">
    <span id="impact-close-btn"><span class="key">Enter</span> 合上</span>
    <span><span class="key">Esc</span> 合上</span>
  </div>`;

  return html;
}

interface SlotFact {
  label: string;
  value: string;
  color: string;
  unit?: string;
}

function buildSlotFacts(sd: SlotDisclosure): SlotFact[] {
  const facts: SlotFact[] = [];
  const teal = '#1aad96';
  const warm = '#c4873a';
  const mid = '#8a8f96';
  const warn = '#b89040';

  if (sd.expandNullified) {
    facts.push({ label: '效果', value: '完全无效化', color: teal });
  } else if (sd.scatterRedistributed) {
    facts.push({ label: '效果', value: '伤害均摊', color: teal });
  } else if (sd.damageBlocked > 0) {
    facts.push({ label: '挡下', value: String(sd.damageBlocked), color: teal });
  } else if (sd.type === 'expand') {
    facts.push({ label: '效果', value: '未生效', color: warn });
  }

  if (sd.kindlingGain > 0) facts.push({ label: '返还', value: String(sd.kindlingGain), color: warm, unit: '薪柴' });
  if (sd.kindlingReturned) facts.push({ label: '返还', value: String(sd.kindlingReturned), color: warm, unit: '薪柴' });
  if (sd.stabilityChange !== 0) {
    facts.push({ label: '稳定度', value: `${sd.stabilityChange > 0 ? '+' : ''}${sd.stabilityChange}`, color: mid });
  }
  if (sd.upgradeDiscount > 0) {
    facts.push({ label: '改造折扣', value: `+${Math.round(sd.upgradeDiscount * 100)}%`, color: teal });
  }
  if (sd.toolUseGrant) facts.push({ label: '随机工具', value: '次数+1', color: teal });
  if (sd.moduleSwapTriggered) facts.push({ label: '效果', value: '模块互换', color: warn });
  if (sd.equalizationAmount) facts.push({ label: '效果', value: 'HP 均摊', color: teal });
  if (sd.healAmount) {
    const moduleLabel = MODULE_LABELS[sd.healModuleId ?? ''] ?? sd.healModuleId ?? '';
    facts.push({ label: '修复', value: String(sd.healAmount), color: teal, unit: moduleLabel });
  }
  if (sd.bonusChargesGranted) {
    facts.push({ label: '其他槽', value: `+${sd.bonusChargesGranted}`, color: teal, unit: '冲击计数' });
  }
  if (sd.bonusDamageDealt) {
    const moduleLabel = MODULE_LABELS[sd.bonusDamageModuleId ?? ''] ?? sd.bonusDamageModuleId ?? '';
    facts.push({ label: '额外命中', value: `-${sd.bonusDamageDealt}`, color: '#cc3333', unit: moduleLabel });
  }

  if (facts.length === 0) {
    facts.push({ label: '减伤', value: `${Math.round(sd.damageReductionPct * 100)}%`, color: teal });
  }
  return facts;
}

function buildForecastHtml(options: ImpactPanelOptions): string | null {
  const predicted = options.forecastPrediction;
  if (!predicted || !options.actualPrimaryModuleId || !options.actualSeverity) return null;

  const predictedModule = MODULE_LABELS[predicted.targetId] ?? predicted.targetId;
  const actualModule = MODULE_LABELS[options.actualPrimaryModuleId] ?? options.actualPrimaryModuleId;
  const matched = predicted.targetId === options.actualPrimaryModuleId
    && predicted.severity === options.actualSeverity;

  let rest = `<span style="font-size:13px;color:#c8cdd4;">${predictedModule}</span>
    <span style="font-size:12px;color:${severityColor(predicted.severity)};">${SEVERITY_LABEL[predicted.severity]}</span>`;
  if (matched) {
    rest += `<span style="font-size:12px;color:#8a8f96;">与实际一致</span>`;
  } else {
    rest += `<span style="font-size:12px;color:#8a8f96;">实际</span>
      <span style="font-size:13px;color:#c8cdd4;">${actualModule}</span>
      <span style="font-size:12px;color:${severityColor(options.actualSeverity)};">${SEVERITY_LABEL[options.actualSeverity]}</span>`;
  }

  return `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:3px 0;">
    <span style="font-size:12px;color:#8a8f96;">预告</span>
    ${rest}
  </div>`;
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
