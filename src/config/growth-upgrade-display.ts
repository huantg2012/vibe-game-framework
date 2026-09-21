/** Shared player-facing growth semantics; values come from CSV and system constants. */
import { GAME_CONSTANTS } from '@/config/constants';
import { UPGRADE_DATA } from '@/generated/upgrade-data';
import type { GrowthUpgradeId } from '@/types/game-types';

export interface GrowthEffectPreview {
  /** World-facing description, separate from the measurable effect. */
  flavor?: string;
  label: string;
  /** Total effect at the target level, or the current level for a read-only view. */
  value: string;
  currentValue?: string;
  /** This purchase's increase, never the accumulated bonus. */
  gain?: string;
  note?: string;
}

export interface GrowthUpgradeDisplay {
  id: GrowthUpgradeId;
  name: string;
  icon: string;
  /** Only the caller's actual next route step may provide targetLevel. */
  effectPreview: (level: number, targetLevel?: number) => GrowthEffectPreview;
  /** Plain-text compatibility for report/older consumers. Owned levels stay read-only. */
  effectLabel: (level: number, maxLevel: number) => string;
}

export function formatGrowthLevel(level: number): string {
  return level === 0 ? '未刻入' : `Level ${level}`;
}

function total(id: GrowthUpgradeId, level: number): number {
  return level * UPGRADE_DATA[id].effectPerLevel;
}

function percent(id: GrowthUpgradeId, level: number): number {
  return Math.round(total(id, level) * 100);
}

function display(
  id: GrowthUpgradeId,
  icon: string,
  effectPreview: GrowthUpgradeDisplay['effectPreview'],
): GrowthUpgradeDisplay {
  return {
    id, name: UPGRADE_DATA[id].name, icon, effectPreview,
    effectLabel: (level, maxLevel) => {
      const effect = effectPreview(level, level === 0 && maxLevel > 0 ? 1 : undefined);
      const change = effect.currentValue === undefined ? effect.value : `${effect.currentValue} → ${effect.value}`;
      return `${effect.label} ${change}${effect.note ? `；${effect.note}` : ''}`;
    },
  };
}

// The final unlocked slot is passive; its count stays fixed when active capacity grows.
const PASSIVE_SLOTS = GAME_CONSTANTS.CONTAMINANT.MAX_SORTIE_SLOTS
  - GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS.length;

const FORECAST_READINGS = [
  '强度与重点可能误报',
  '准确强度',
  '准确强度 · 重点装置',
  '准确强度 · 重点装置 · 供奉前压力',
] as const;
const FORECAST_GAINS = [
  '', '辨清下次冲击强度', '辨清下次冲击的重点装置', '读取下次各装置的供奉前压力',
] as const;

export const GROWTH_UPGRADE_DISPLAY: GrowthUpgradeDisplay[] = [
  display('growth_chaos_resist', '◈', (level, targetLevel) => {
    const id = 'growth_chaos_resist';
    const valueAt = (at: number): string => `减缓 ${percent(id, at)}%`;
    return {
      flavor: UPGRADE_DATA[id].description,
      label: '自然混乱增速',
      value: valueAt(targetLevel ?? level),
      ...(targetLevel === undefined ? {} : {
        currentValue: valueAt(level),
        gain: level === 0 ? `自然混乱增速减缓 ${percent(id, targetLevel)}%`
          : `自然混乱增速再减缓 ${percent(id, targetLevel - level)} 个百分点`,
      }),
      note: '只影响随时间积累的混乱，不改变起始混乱。',
    };
  }),
  display('growth_kindling_affinity', '✦', (level, targetLevel) => {
    const id = 'growth_kindling_affinity';
    const valueAt = (at: number): string => `+${total(id, at)}`;
    return {
      flavor: UPGRADE_DATA[id].description,
      label: '每堆基础额外薪柴',
      value: valueAt(targetLevel ?? level),
      ...(targetLevel === undefined ? {} : {
        currentValue: valueAt(level),
        gain: `每堆基础额外薪柴 +${total(id, targetLevel - level)}`,
      }),
      note: '计入基础收获后，再受储藏效能影响。',
    };
  }),
  display('growth_vitality', '♥', (level, targetLevel) => {
    const id = 'growth_vitality';
    const valueAt = (at: number): string => String(GAME_CONSTANTS.PLAYER.MAX_HEALTH + total(id, at));
    return {
      flavor: UPGRADE_DATA[id].description,
      label: '自身完整度上限',
      value: valueAt(targetLevel ?? level),
      ...(targetLevel === undefined ? {} : {
        currentValue: valueAt(level),
        gain: `完整度上限 +${total(id, targetLevel - level)}`,
      }),
      note: '进入裂隙时生效，不改变装置完整度。',
    };
  }),
  display('growth_sortie_slot', '▣', (level, targetLevel) => {
    const id = 'growth_sortie_slot';
    const valueAt = (at: number): string => `${GAME_CONSTANTS.CONTAMINANT.SORTIE_SLOTS - PASSIVE_SLOTS + total(id, at)} 位`;
    return {
      label: '主动工具携带位',
      value: valueAt(targetLevel ?? level),
      ...(targetLevel === undefined ? {} : {
        currentValue: valueAt(level),
        gain: `可多携带 ${total(id, targetLevel - level)} 件主动工具`,
      }),
      note: `被动工具仍为 ${PASSIVE_SLOTS} 位，携带重量照常计入。`,
    };
  }),
  display('growth_defense_slot', '▤', (level, targetLevel) => {
    const id = 'growth_defense_slot';
    const valueAt = (at: number): string => `${GAME_CONSTANTS.CONTAMINANT.DEFENSE_SLOTS + total(id, at)} 件`;
    return {
      label: '同时供奉容量',
      value: valueAt(targetLevel ?? level),
      ...(targetLevel === undefined ? {} : {
        currentValue: valueAt(level),
        gain: `可多供奉 ${total(id, targetLevel - level)} 件物品`,
      }),
      note: '物件成熟速度不变。',
    };
  }),
  display('growth_forecast_clarity', '◎', (level, targetLevel) => {
    const readingAt = (at: number): string => FORECAST_READINGS[Math.min(at, FORECAST_READINGS.length - 1)]!;
    return {
      label: targetLevel === undefined ? level > 0 ? '现已辨明' : '当前预兆' : '刻入后可辨明',
      value: readingAt(targetLevel ?? level),
      ...(targetLevel === undefined ? {} : {
        gain: FORECAST_GAINS[targetLevel],
      }),
      ...((targetLevel ?? level) === UPGRADE_DATA.growth_forecast_clarity.maxLevel
        ? { note: '压力为供奉抵消前的读数。' } : {}),
    };
  }),
];

export const GROWTH_UPGRADE_IDS: GrowthUpgradeId[] = GROWTH_UPGRADE_DISPLAY.map((u) => u.id);

export const GROWTH_UPGRADE_NAMES: Record<GrowthUpgradeId, string> = Object.fromEntries(
  GROWTH_UPGRADE_DISPLAY.map((u) => [u.id, u.name]),
) as Record<GrowthUpgradeId, string>;
