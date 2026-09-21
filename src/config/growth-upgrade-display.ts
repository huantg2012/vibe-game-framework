/**
 * Growth upgrade display config for UI (growth-panel / status-panel).
 * Single source of truth for the "which axes exist, in what order, with what
 * name/icon/effect-label" question — growth-panel.ts and status-panel.ts both
 * previously hardcoded their own copy of the 3-id array; this consolidates them.
 * Player-facing effect magnitudes are computed from UPGRADE_DATA (CSV-driven),
 * never hand-duplicated numbers.
 */

import { GAME_CONSTANTS } from '@/config/constants';
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
    name: UPGRADE_DATA.growth_chaos_resist.name,
    icon: '◈', // diamond
    effectLabel: (level, maxLevel) => numericEffectLabel(
      level, maxLevel,
      (lvl) => `自然混乱增速 -${pct('growth_chaos_resist', lvl)}%`,
      '自然混乱增速 -0%',
    ),
  },
  {
    id: 'growth_kindling_affinity',
    name: UPGRADE_DATA.growth_kindling_affinity.name,
    icon: '✦', // four-point star
    effectLabel: (level, maxLevel) => numericEffectLabel(
      level, maxLevel,
      (lvl) => `每堆基础薪柴 +${lvl * UPGRADE_DATA.growth_kindling_affinity.effectPerLevel}`,
      '每堆基础薪柴 +0',
    ) + '；再受储藏增益。',
  },
  {
    id: 'growth_vitality',
    name: UPGRADE_DATA.growth_vitality.name,
    icon: '♥', // heart
    effectLabel: (level, maxLevel) => numericEffectLabel(
      level, maxLevel,
      (lvl) => `完整度 +${lvl * UPGRADE_DATA.growth_vitality.effectPerLevel}`,
      '延缓覆盖',
    ),
  },
  {
    id: 'growth_sortie_slot',
    name: UPGRADE_DATA.growth_sortie_slot.name,
    icon: '▣',
    effectLabel: (level) => (level > 0 ? '主动工具 3 位；被动工具 1 位。' : '主动工具 2 → 3 位；被动仍为 1 位，携带重量照常计入。'),
  },
  {
    id: 'growth_defense_slot',
    name: UPGRADE_DATA.growth_defense_slot.name,
    icon: '▤',
    effectLabel: (level, maxLevel) => {
      const capacity = GAME_CONSTANTS.CONTAMINANT.DEFENSE_SLOTS + level;
      return level >= maxLevel ? `可同时供奉 ${capacity} 件物品。`
        : `同时供奉 ${capacity} → ${capacity + 1} 件；成熟速度不变。`;
    },
  },
  {
    id: 'growth_forecast_clarity',
    name: UPGRADE_DATA.growth_forecast_clarity.name,
    icon: '◎',
    effectLabel: (level, maxLevel) => {
      const readings = ['强度与重点仍可能误报', '辨清下次冲击强度', '辨清下次强度与重点装置', '读取下次各装置的防御前压力'];
      const current = readings[Math.min(level, readings.length - 1)]!;
      return level >= maxLevel ? current : `${current} → ${readings[level + 1]}`;
    },
  },
];

export const GROWTH_UPGRADE_IDS: GrowthUpgradeId[] = GROWTH_UPGRADE_DISPLAY.map((u) => u.id);

export const GROWTH_UPGRADE_NAMES: Record<GrowthUpgradeId, string> = Object.fromEntries(
  GROWTH_UPGRADE_DISPLAY.map((u) => [u.id, u.name]),
) as Record<GrowthUpgradeId, string>;
