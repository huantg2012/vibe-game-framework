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
    title: 'COH',
    subtitle: '原型构建',
    newGame: '新远征',
    continue: '继续',
    language: '语言',
  },

  // HUD (in-game overlay)
  hud: {
    chaos: {
      label: '混乱值',
    },
    health: {
      label: '状态',
    },
    kindling: {
      label: '薪柴',
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
      barrier: '屏障模块',
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
