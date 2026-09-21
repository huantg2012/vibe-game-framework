// AUTO-GENERATED from data/upgrades.csv + data/growth-route.csv — DO NOT EDIT
import type { GrowthProgressionState, GrowthUpgradeId } from '@/types/game-types';

export type GrowthResponsibility = 'body' | 'base' | 'equipment';
export type GrowthUnlockRequirement = 'none' | Exclude<keyof GrowthProgressionState, 'version'>;

export interface UpgradeDef {
  readonly id: GrowthUpgradeId;
  readonly name: string;
  readonly axis: string;
  readonly responsibility: GrowthResponsibility;
  readonly maxLevel: number;
  readonly effectPerLevel: number;
  readonly effectUnit: string;
  readonly costs: readonly number[];
  readonly description: string;
}

export const UPGRADE_DATA: Record<GrowthUpgradeId, UpgradeDef> = {
  'growth_chaos_resist': {
    id: 'growth_chaos_resist',
    name: '渗透抗性',
    axis: '出击效率',
    responsibility: 'body',
    maxLevel: 5,
    effectPerLevel: 0.04,
    effectUnit: '混乱增速减免比例',
    costs: [10, 17, 23, 33, 38],
    description: '反复暴露于异源模式后身体产生微量适应性',
  },
  'growth_kindling_affinity': {
    id: 'growth_kindling_affinity',
    name: '薪柴亲和',
    axis: '资源效率',
    responsibility: 'body',
    maxLevel: 3,
    effectPerLevel: 1,
    effectUnit: '每次拾取额外薪柴',
    costs: [9, 13, 24],
    description: '辨识和提取残渣的能力增强',
  },
  'growth_vitality': {
    id: 'growth_vitality',
    name: '生命强化',
    axis: '生存韧性',
    responsibility: 'body',
    maxLevel: 4,
    effectPerLevel: 15,
    effectUnit: '最大生命值增加',
    costs: [8, 12, 19, 30],
    description: '核心抗性的物理表现增强',
  },
  'growth_sortie_slot': {
    id: 'growth_sortie_slot',
    name: '出击扩容',
    axis: '出击扩展',
    responsibility: 'equipment',
    maxLevel: 1,
    effectPerLevel: 1,
    effectUnit: '解锁第4个出击工具槽位',
    costs: [18],
    description: '多携带一个主动工具——被动仍只能选一个且携带重量照常计入',
  },
  'growth_defense_slot': {
    id: 'growth_defense_slot',
    name: '供奉扩容',
    axis: '防御扩展',
    responsibility: 'base',
    maxLevel: 3,
    effectPerLevel: 1,
    effectUnit: '增加1个供奉槽位',
    costs: [9, 16, 28],
    description: '同一次冲击可以再供奉一个物件——不增加成熟速度或物件供给',
  },
  'growth_forecast_clarity': {
    id: 'growth_forecast_clarity',
    name: '预兆洞察',
    axis: '信息优势',
    responsibility: 'base',
    maxLevel: 3,
    effectPerLevel: 1,
    effectUnit: '信息层',
    costs: [11, 14, 26],
    description: '逐层辨清下次冲击的强度、重点模块及各模块防御前压力',
  },
};
