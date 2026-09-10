import { WEAPON_DATA } from '@/generated/weapon-data';
/**
 * ImpactResultPanel — 冲击结算墙机（载体 B）。
 *
 * I11-B4c：保持结果屏骨架（标题 + 逐模块基础/实际 + 逐槽归因 + 潮汐/稳定度并入）。
 * 不要身份带、顶 Tab、`.crt-focus`、空状态三件套、出击预估。挂 #dom-ui-root。
 */

import type { ImpactDamageEntry, ForecastSeverity } from '@/systems/impact-system';
import { SEVERITY_LABEL } from '@/systems/impact-system';
import type { DefenseResult, SlotDisclosure } from '@/systems/defense-engine';
import type { PhaseChangeInfo } from '@/systems/tide-system';
import type { ContaminantType } from '@/types/game-types';
import { getDefenseName, getToolName } from '@/ui/contaminant-names';
import { describeSideEffectBody } from '@/ui/side-effect-labels';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';
import { audioManager } from '@/managers/audio-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Charge change data for a single defense slot. Display name is derived from
 *  `type` via `getDefenseName` (CLAUDE.md 策划数据源规则) — not carried here, so
 *  there is no local copy that can drift from the CSV. */
export interface ChargeChangeEntry {
  slotIndex: number;
  type: ContaminantType | null;
  weaponDefinitionId?: string;
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

const MODULE_LABELS: Record<string, string> = { CORE: '核心', STORAGE: '储藏', PURIFIER: '净化器' };
const MODULE_COLORS: Record<string, string> = { CORE: '#b5bbaf', STORAGE: '#b29a73', PURIFIER: '#729887' };

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
    panel.classList.add('scene-menu', 'scene-menu-impact');

    const root = getDomUiRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop scene-menu-backdrop';
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
    audioManager.playSFX('sfx-ui-open');
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
  let html = `<div class="panel-title">冲击之后</div>`;
  html += `<div class="scroll-area">`;
  const worst = damages.reduce<ImpactDamageEntry | undefined>((current, entry) =>
    !current || entry.damage > current.damage ? entry : current, undefined);
  html += `<div class="readout-hero"><span class="readout-label">${worst ? MODULE_LABELS[worst.moduleId] ?? worst.moduleId : '装置'} · 最大损伤</span>
    <strong>${worst ? `−${worst.damage}` : '0'}</strong></div>
    <div class="readout-note">冲击强度 x${intensity.toFixed(2)}${severity ? ` / ${SEVERITY_LABEL[severity]}` : ''}</div>
    <div class="section-title">装置完整度</div>`;

  const base = options.baseDamagePerModule;
  const maxDmg = Math.max(
    ...damages.map((d) => Math.max(d.damage, base?.[d.moduleId] ?? d.damage)),
    1,
  );
  for (const d of damages) {
    const color = MODULE_COLORS[d.moduleId] ?? '#b5bbaf';
    const label = MODULE_LABELS[d.moduleId] ?? d.moduleId;
    const barPct = Math.round((d.damage / maxDmg) * 100);
    const baseDmg = base?.[d.moduleId] ?? d.damage;
    html += `<div class="dmg-row">
      <span class="stat-label" style="color:${color};">${label}</span>
      <span class="stat-value">${d.newHp + d.damage}</span>
      <span>→</span>
      <span class="stat-value">${d.newHp}</span>
      <span class="readout-note">损伤</span><span class="stat-value">−${d.damage}</span>
      <div class="dmg-bar-wrap">
        <div class="dmg-bar-fill" style="width:${barPct}%;background:#9b6b5b;"></div>
      </div>
    </div>${baseDmg !== d.damage ? `<div class="readout-note">${label}：基础损伤 ${baseDmg} → 实际损伤 ${d.damage}</div>` : ''}`;
  }

  const defenseResult = options.defenseResult;

  const disclosures = defenseResult?.slotDisclosures ?? [];
  if (disclosures.length > 0) html += '<div class="section-title">供奉作用</div>';
  for (const sd of disclosures) {
    const name = getDefenseName(sd.type);
    const facts = buildSlotFacts(sd);
    html += `<div class="stat-row">
      <span class="stat-label">${name}</span>
      ${facts.map((f) => `<span class="stat-label">${f.label}</span><span class="stat-value" style="color:${f.color};">${f.value}</span>${f.unit ? `<span>${f.unit}</span>` : ''}`).join('')}
    </div>`;
  }

  const chargeChanges = options.chargeChanges;
  if (chargeChanges && chargeChanges.length > 0) {
    html += `<div class="separator"></div>`;
    for (const c of chargeChanges) {
      const name = c.weaponDefinitionId ? WEAPON_DATA[c.weaponDefinitionId]?.name ?? '武器' : c.type ? getDefenseName(c.type) : '物件';
      html += `<div class="stat-row">
        <span class="stat-label">${name}</span>
        <span class="stat-value">${c.before}</span>
        <span>→</span>
        <span class="stat-value">${c.after}</span>
        <span>/</span>
        <span class="stat-value">${c.threshold}</span>
        ${c.transformed ? `<span>供奉完成</span><span class="stat-value" style="color:#729887;">${c.type ? getToolName(c.type) : name}</span>` : ''}
      </div>`;
    }
  }

  if (defenseResult && defenseResult.sideEffects.length > 0) {
    const rows = defenseResult.sideEffects
      .map((e) => {
        const body = describeSideEffectBody(e);
        if (!body) return null;
        const split = body.search(/[+\-x]/);
        const fact = split > 0 ? body.slice(0, split).trim() : body;
        const value = split > 0 ? body.slice(split) : '';
        const src = e.source ? getDefenseName(e.source as ContaminantType) : '';
        const duration = e.durationMs ? `${e.durationMs / 1000}s` : '';
        return { fact, value, src, duration };
      })
      .filter((x): x is { fact: string; value: string; src: string; duration: string } => x !== null);
    if (rows.length > 0) {
      html += `<div class="separator"></div>`;
      for (const row of rows) {
        html += `<div class="stat-row">
          <span class="stat-label">本次残留</span>
          <span>${row.fact}</span>
          ${row.value ? `<span class="stat-value" style="color:#729887;">${row.value}</span>` : ''}
          ${row.duration ? `<span>${row.duration}</span>` : ''}
          ${row.src ? `<span>←</span><span>${row.src}</span>` : ''}
        </div>`;
      }
    }
  }

  const forecastHtml = buildForecastHtml(options);
  if (forecastHtml) {
    html += `<div class="separator"></div>`;
    html += forecastHtml;
  }
  if (options.phaseChange) {
    const notice = buildPhaseChangeNotice(options.phaseChange);
    html += `<div class="separator"></div>`;
    html += `<div class="stat-row"><span class="stat-label">潮汐</span><span style="color:${notice.color};">${notice.text}</span></div>`;
  }
  if (options.stabilityMilestoneMessage) {
    html += `<div class="stat-row"><span class="stat-label">稳定度</span><span>${options.stabilityMilestoneMessage}</span></div>`;
  }

  html += `</div>`;

  html += `<div class="key-hint-bar">
    <button class="action-btn" id="impact-close-btn"><span class="key">Enter</span> / <span class="key">Esc</span> 合上</button>
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
  const teal = '#729887';
  const warm = '#b29a73';
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
  if (sd.equalizationAmount) facts.push({ label: '均摊', value: String(sd.equalizationAmount), color: teal });
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

  const predictedColor = MODULE_COLORS[predicted.targetId] ?? '#b5bbaf';
  const actualColor = MODULE_COLORS[options.actualPrimaryModuleId] ?? '#b5bbaf';

  let rest = `<span style="font-size:12px;color:${predictedColor};">${predictedModule}</span>
    <span style="font-size:12px;color:${severityColor(predicted.severity)};">${SEVERITY_LABEL[predicted.severity]}</span>`;
  if (matched) {
    rest += `<span style="font-size:12px;color:#8a8f96;">与实际一致</span>`;
  } else {
    rest += `<span style="font-size:12px;color:#8a8f96;">实际</span>
      <span style="font-size:12px;color:${actualColor};">${actualModule}</span>
      <span style="font-size:12px;color:${severityColor(options.actualSeverity)};">${SEVERITY_LABEL[options.actualSeverity]}</span>`;
  }

  return `<div class="stat-row">
    <span class="stat-label">预告</span>
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
  return { text: `第${info.newTideNumber}潮汐。边界压力上升。`, color: '#729887' };
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
  audioManager.playSFX('sfx-ui-close');
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
