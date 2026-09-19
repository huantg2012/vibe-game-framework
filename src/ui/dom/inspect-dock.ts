import { getContaminantQualityName, getContaminantMaxUses, supportsContaminantQuality } from '@/systems/contaminant-quality';
/**
 * Inspect dock content builder — "选中即检视" five-layer text
 * (`docs/design-notes/ux-information-architecture.md` S13, `ui-art-overhaul.md` A5-13).
 *
 * This module only builds the HTML string for the fixed `.inspect-dock` container
 * (styles + container element live in `panel-styles.ts`). Focus tracking (keyboard
 * cursor + mouse hover) is wired per-panel in `loadout-panel.ts` / `defense-panel.ts`.
 *
 * Five layers per item:
 *   L1 身份   — name (CSV-authoritative via contaminant-names.ts) · rarity · stage · category
 *   L2 摘要   — one-line mechanism summary from CSV `summaryDefense` / `summaryTool`
 *               (≤15 字；禁止再截断长描述).
 *   L3 数值   — the CSV numeric fields the IA flagged as "从未上屏": defenseReduction /
 *               toolRangePx / toolDurationMs / toolUses, plus live runtime state
 *               (charge progress / uses remaining).
 *   L4 与我的关系 — cost & fit: side effect (defense) or trigger key + equip eligibility
 *               (tool), always stating what's missing when not equippable (IA §0.3).
 *   L5 转化去向 — the defense↔tool conversion payoff, same-screen on both sides
 *               (IA's "纠结感的结构基础").
 */

import { projectItemForPlayer } from '@/systems/contaminant-catalog';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { getDefenseName, getRarityStars, getToolName } from '@/ui/contaminant-names';
import type { Contaminant } from '@/types/game-types';
import { GAME_CONSTANTS } from '@/config/constants';

/** Shown when no item currently has keyboard/mouse focus (A5-13's default state). */
export const INSPECT_EMPTY_HTML = '<div class="inspect-empty">选择已装填物或库存，查看效果与使用条件。</div>';

const LINE_CLASSES = ['inspect-l1', 'inspect-l2', 'inspect-l3', 'inspect-l4', 'inspect-l5'];

function wrapInspectLines(lines: string[]): string {
  return lines.map((line, i) => `<div class="${LINE_CLASSES[i]}">${line}</div>`).join('');
}

export interface DefenseInspectContext {
  /** Impact charges needed before this item auto-transforms into its tool form. */
  chargeThreshold: number;
  slotState: 'slotted' | 'unslotted';
  /** Only consulted when `slotState === 'unslotted'`. */
  canEquip: boolean;
  readOnly?: boolean;
}

/** Build the five-layer inspect content for an item read as its **defense** form. */
export function buildDefenseInspectHtml(c: Contaminant, ctx: DefenseInspectContext): string {
  if (c.type === 'catalog') {
    const view = projectItemForPlayer(c);
    const remaining = Math.max(0, view.offeringCharges - view.impactCharges);
    return wrapInspectLines([
      `${view.name} · 未鉴定`, view.offeringSummary,
      `结构保持性 ${getContaminantQualityName(c)} · 供奉积累 ${view.impactCharges}/${view.offeringCharges}`,
      ctx.slotState === 'slotted' ? '本轮供奉效果生效后，再积累鉴定进度' : ctx.readOnly ? '前往供奉台装填' : ctx.canEquip ? '可装填 · 自动放入空槽' : '槽位已满 · 先取下一件',
      `完成供奉后揭晓真实物件与裂隙能力 · 尚需 ${remaining} 点积累`,
    ]);
  }
  const def = CONTAMINANT_DATA[c.type];
  const name = getDefenseName(c.type);
  const stars = supportsContaminantQuality(c.type) ? getContaminantQualityName(c) : getRarityStars(c.rarity);
  const reductionPct = Math.round(def.defenseReduction * 100);

  const l1 = `${name} ${stars} · 防御 · ${def.defenseCategory}`;
  const l2 = def.summaryDefense;
  const l3 = ctx.slotState === 'slotted'
    ? `减伤 ${reductionPct}% · 充能 ${c.impactCharges}/${ctx.chargeThreshold}`
    : `减伤 ${reductionPct}%`;
  const l4 = ctx.slotState === 'slotted'
    ? (def.defenseSideEffect && def.defenseSideEffect !== '无' ? `副作用：${def.defenseSideEffect}（${def.sideEffectDuration}）` : '本轮先完成供奉效果，再积累成熟进度')
    : (ctx.readOnly ? '未供奉 · 前往供奉台装填' : ctx.canEquip ? '可装填 · 自动放入空槽' : '槽位已满 · 先取下一件');
  const remaining = Math.max(0, ctx.chargeThreshold - c.impactCharges);
  const l5 = remaining > 0
    ? `还需 ${remaining} 次冲击 → 可用 ${getContaminantMaxUses(c)} 次 · ${def.summaryTool}`
    : `转化在即 → 可用 ${getContaminantMaxUses(c)} 次 · ${def.summaryTool}`;

  return wrapInspectLines([l1, l2, l3, l4, l5]);
}

export interface ToolInspectContext {
  slotState: 'slotted' | 'unslotted';
  /** Hotkey letter, only meaningful for slotted active tools. */
  hotkeyLabel?: string;
  /** Only consulted when `slotState === 'unslotted'`. */
  canEquip: boolean;
  readOnly?: boolean;
  unavailableReason?: string;
}

/** Build the five-layer inspect content for an item read as its **tool** form. */
export function buildToolInspectHtml(c: Contaminant, ctx: ToolInspectContext): string {
  if (c.type === 'catalog') {
    const view = projectItemForPlayer(c), passive = view.slot === 'passive';
    if (view.identification === 'unidentified') return buildDefenseInspectHtml(c, { chargeThreshold: view.offeringCharges, slotState: 'unslotted', canEquip: false, readOnly: true });
    if (view.inert) return wrapInspectLines([view.name, view.description, '无裂隙能力', '可留存或丢弃，不能装配出击', '已收入发现记录']);
    return wrapInspectLines([
      `${view.name} · ${getContaminantQualityName(c)} · ${passive ? '整趟被动' : '主动'}`, view.description,
      `剩余 ${view.usesRemaining}/${view.maxUses} ${passive ? '趟' : '次'}`,
      ctx.slotState === 'slotted' ? passive ? '已装填 · 确认出发消耗一趟' : `已装填 · [${ctx.hotkeyLabel ?? '?'}] 使用`
        : ctx.readOnly ? '前往裂隙入口准备出击' : ctx.canEquip ? '可装填' : ctx.unavailableReason ?? '槽位已满',
      passive ? '末趟依然全程生效；撤离后耗尽物件消散' : '合法施放才消耗；最后一次效果持续到结束',
    ]);
  }
  const def = CONTAMINANT_DATA[c.type];
  const name = getToolName(c.type);
  const stars = supportsContaminantQuality(c.type) ? getContaminantQualityName(c) : getRarityStars(c.rarity);
  const isPassive = def.toolType === 'passive';
  const typeLabel = isPassive ? '被动' : '主动';

  const l1 = `${name} ${stars} · 工具 · ${typeLabel}`;
  const l2 = def.summaryTool;
  const rangeLabel = def.toolRangePx > 0 ? `${Math.round(def.toolRangePx / GAME_CONSTANTS.TILE_SIZE)}格` : '无范围';
  const durationLabel = def.toolDurationMs > 0 ? `${(def.toolDurationMs / 1000).toFixed(0)}秒` : '即时';
  const l3 = (c.usesRemaining > getContaminantMaxUses(c) ? `剩余 ${c.usesRemaining} 次 · 基准 ${getContaminantMaxUses(c)}` : `剩余 ${c.usesRemaining}/${getContaminantMaxUses(c)} 次`)
    + (c.type === 'muffle' || c.type === 'scatter' ? ' · 按遭遇触发' : ` · 范围 ${rangeLabel} · 持续 ${durationLabel}`);

  let l4: string;
  if (ctx.slotState === 'slotted') {
    l4 = isPassive ? '被动 · 无按键 · 已装填' : `触发键 [${ctx.hotkeyLabel ?? '?'}] · 已装填`;
  } else if (ctx.readOnly) {
    l4 = '未装填 · 前往裂隙入口准备出击';
  } else if (ctx.canEquip) {
    l4 = isPassive ? '被动 · 无按键 · 可装填' : '可装填 · 自动放入空槽';
  } else {
    l4 = ctx.unavailableReason ?? '槽位已满 · 先取下一件';
  }

  const l5 = `次数归零即破碎，不可恢复 · 源起：${def.narrativeOrigin}`;

  return wrapInspectLines([l1, l2, l3, l4, l5]);
}
