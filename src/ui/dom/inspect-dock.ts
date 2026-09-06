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
  const def = CONTAMINANT_DATA[c.type];
  const name = getDefenseName(c.type);
  const stars = getRarityStars(c.rarity);
  const reductionPct = Math.round(def.defenseReduction * 100);

  const l1 = `${name} ${stars} · 防御 · ${def.defenseCategory}`;
  const l2 = def.summaryDefense;
  const l3 = ctx.slotState === 'slotted'
    ? `减伤 ${reductionPct}% · 充能 ${c.impactCharges}/${ctx.chargeThreshold}`
    : `减伤 ${reductionPct}%`;
  const l4 = ctx.slotState === 'slotted'
    ? `副作用：${def.defenseSideEffect}（${def.sideEffectDuration}）`
    : (ctx.readOnly ? '未供奉 · 前往供奉台装填' : ctx.canEquip ? '可装填 · 自动放入空槽' : '槽位已满 · 先取下一件');
  const remaining = Math.max(0, ctx.chargeThreshold - c.impactCharges);
  const l5 = remaining > 0
    ? `还需 ${remaining} 次冲击 → 【${def.displayNameTool}】：${def.summaryTool}`
    : `转化在即 → 【${def.displayNameTool}】：${def.summaryTool}`;

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
  const def = CONTAMINANT_DATA[c.type];
  const name = getToolName(c.type);
  const stars = getRarityStars(c.rarity);
  const isPassive = def.toolType === 'passive';
  const typeLabel = isPassive ? '被动' : '主动';

  const l1 = `${name} ${stars} · 工具 · ${typeLabel}`;
  const l2 = def.summaryTool;
  const rangeLabel = def.toolRangePx > 0 ? `${Math.round(def.toolRangePx / GAME_CONSTANTS.TILE_SIZE)}格` : '无范围';
  const durationLabel = def.toolDurationMs > 0 ? `${(def.toolDurationMs / 1000).toFixed(0)}秒` : '即时';
  const l3 = `剩余 ${c.usesRemaining}/${def.toolUses} 次 · 范围 ${rangeLabel} · 持续 ${durationLabel}`;

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
