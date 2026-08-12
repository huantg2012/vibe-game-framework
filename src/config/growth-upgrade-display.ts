/**
 * Growth upgrade display config for UI (growth-panel / status-panel).
 * Single source of truth for the "which axes exist, in what order, with what
 * name/icon/effect-label" question — growth-panel.ts and status-panel.ts both
 * previously hardcoded their own copy of the 3-id array; this consolidates them.
 * Player-facing effect magnitudes are computed from UPGRADE_DATA (CSV-driven),
 * never hand-duplicated numbers.
 */

import { UPGRADE_DATA } from '@/generated/upgrade-data';
import type { GrowthUpgradeId } from '@/types/game-types';

export interface GrowthUpgradeDisplay {
  id: GrowthUpgradeId;
  name: string;
  icon: string;
  /** Player-facing effect description. `maxLevel` lets the label show "当前 → 下一级"
   *  instead of only the current level's effect (IA §S7: "买了立刻变什么" was
   *  previously unanswerable at level 0, since only the current — i.e. absent —
   *  effect was rendered). At `level >= maxLevel` there is no "next" to show. */
  effectLabel: (level: number, maxLevel: number) => string;
}

function pct(id: GrowthUpgradeId, level: number): number {
  return Math.round(level * UPGRADE_DATA[id].effectPerLevel * 100);
}

/** Shared "current → next" formatter for the four numeric (percent or flat) axes.
 *  The two slot-unlock axes below are single-level toggles where "next" is just
 *  "unlocked" — already conveyed by their own flavor text, so they don't use this. */
function numericEffectLabel(
  level: number,
  maxLevel: number,
  labelAt: (lvl: number) => string,
  flavorText: string,
): string {
  if (level === 0) {
    return level >= maxLevel ? flavorText : `${flavorText} → ${labelAt(1)}`;
  }
  if (level >= maxLevel) return labelAt(level);
  return `${labelAt(level)} → ${labelAt(level + 1)}`;
}

export const GROWTH_UPGRADE_DISPLAY: GrowthUpgradeDisplay[] = [
  {
    id: 'growth_chaos_resist',
    name: '渗透抗性',
    icon: '◈', // diamond
    effectLabel: (level, maxLevel) => numericEffectLabel(
      level, maxLevel,
      (lvl) => `混乱增速 -${pct('growth_chaos_resist', lvl)}%`,
      '抵御裂隙侵蚀',
    ),
  },
  {
    id: 'growth_kindling_affinity',
    name: '薪柴亲和',
    icon: '✦', // four-point star
    effectLabel: (level, maxLevel) => numericEffectLabel(
      level, maxLevel,
      (lvl) => `拾取额外 +${lvl * UPGRADE_DATA.growth_kindling_affinity.effectPerLevel}`,
      '更高效的收割',
    ),
  },
  {
    id: 'growth_vitality',
    name: '生命强化',
    icon: '♥', // heart
    effectLabel: (level, maxLevel) => numericEffectLabel(
      level, maxLevel,
      (lvl) => `完整度 +${lvl * UPGRADE_DATA.growth_vitality.effectPerLevel}`,
      '强化躯壳',
    ),
  },
  {
    id: 'growth_sortie_slot',
    name: '出击扩容',
    icon: '▣',
    effectLabel: (level) => (level > 0 ? '已解锁第4出击槽位' : '扩展出击工具携带上限 → 解锁第4槽位'),
  },
  {
    id: 'growth_defense_slot',
    name: '供奉扩容',
    icon: '▤',
    effectLabel: (level) => (level > 0 ? '已解锁第4供奉槽位' : '扩展供奉容量 → 解锁第4槽位'),
  },
  {
    id: 'growth_forecast_clarity',
    name: '预兆洞察',
    icon: '◎',
    effectLabel: (level, maxLevel) => numericEffectLabel(
      level, maxLevel,
      (lvl) => `预告可靠度 +${pct('growth_forecast_clarity', lvl)}%`,
      '增强边界扰动感知',
    ),
  },
];

export const GROWTH_UPGRADE_IDS: GrowthUpgradeId[] = GROWTH_UPGRADE_DISPLAY.map((u) => u.id);

export const GROWTH_UPGRADE_NAMES: Record<GrowthUpgradeId, string> = Object.fromEntries(
  GROWTH_UPGRADE_DISPLAY.map((u) => [u.id, u.name]),
) as Record<GrowthUpgradeId, string>;
