/**
 * Chinese (Simplified) locale - default language.
 * All text visible to the player lives here.
 *
 * Style rules (from world.md):
 * - Terse, factual, no emotional embellishment
 * - No exclamation marks, no rhetorical questions
 * - Tooltip/short: max 15 chars; Description: max 40 chars
 */

import type { LocaleSchema } from '../types';

export const zhCN: LocaleSchema = {
  // Common
  common: {
    confirm: '确认',
    cancel: '取消',
    back: '返回',
  },

  // Main Menu
  menu: {
    title: '那天之后',
    subtitle: '边界仍在，光尚未熄',
    newGame: '进入净化点',
    continue: '沿旧路返回',
    newSave: '新的纪录',
    loadSave: '沿旧路返回',
    resume: '合上',
    pauseTitle: '记录',
    language: '语言',
    backHint: 'Esc 返回',
    overwriteWarning: '将清除第 {tideNumber} 潮的全部记录',
    overwriteClear: '清除后进入',
    summaryTide: '潮汐',
    summaryCycle: '出击',
    summaryStability: '稳定度',
    tideNth: '第 {n} 潮',
    phaseRise: '涨潮',
    phaseCrest: '潮峰',
    phaseEbb: '退潮',
    stabilityIncomplete: '未完成',
    stabilityComplete: '已完成',
  },

  // HUD (in-game overlay)
  hud: {
    chaos: {
      label: '混乱值',
    },
    health: {
      label: '完整度',
    },
    kindling: {
      label: '薪柴',
    },
    prompt: {
      extract: '撤离',
      search: '翻找',
    },
    residue: {
      label: '残渣',
    },
  },

  // Rift scene
  rift: {
    exitHint: '撤离点已标记',
    chaosWarning: '外来渗透加剧',
    returnToMenu: '按 ESC 返回',
  },

  // Purification point
  purify: {
    title: '净化点',
    allocate: {
      title: '薪柴分配',
      confirm: '确认分配',
      remaining: '剩余：{amount}',
    },
    module: {
      core: '核心模块',
      storage: '储藏模块',
      healthy: '正常',
      damaged: '受损',
      critical: '严重受损',
    },
    enterRift: '进入裂隙',
  },

  // Impact
  impact: {
    warning: '边界压力上升',
    intensity: '预计冲击强度：{level}',
    result: {
      safe: '模块完好',
      damaged: '模块受损',
      destroyed: '模块严重受损',
    },
  },

  // Items
  item: {
    kindling: {
      name: '薪柴',
      desc: '异源残渣压缩物。燃烧时释放否定性。',
    },
  },

  // Enemies
  enemy: {
    patrolInfiltrate: {
      name: '巡视渗透体',
      desc: '有机基体，低度覆盖。视觉感知，路径固定。',
    },
  },
};
