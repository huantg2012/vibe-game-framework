/**
 * Contaminant effect descriptions for UI display.
 * Each contaminant has a defense-stage description and a tool-stage description.
 */

import type { ContaminantType } from '@/types/game-types';

export const CONTAMINANT_DESCRIPTIONS: Record<ContaminantType, { defense: string; tool: string }> = {
  solidify: { defense: '减伤35%, 模块容量微缩', tool: '凝锁: 定身目标4s' },
  delay: { defense: '减伤55%, 偶尔延迟释放', tool: '时裂: 区域感知冻结8s' },
  erode: { defense: '减伤50%, 削弱裂隙敌人', tool: '侵蚀领域: 区域削弱12s' },
  ruminate: { defense: '减伤40%, 加速转化', tool: '反刍之口: 回收空节点' },
  scatter: { defense: '分散冲击到全部模块', tool: '碎影: 被动减缓感知' },
  retrograde: { defense: '重复方向高减伤', tool: '残响标记: 追踪敌人路线' },
  siphon: { defense: '减伤50%+薪柴返还', tool: '寄生引流: 击杀回收' },
  expand: { defense: '概率完全无效化', tool: '虚化步: 穿墙3s' },
  resonate: { defense: '成组时减伤剧增', tool: '共振链接: 绊线陷阱' },
  overwrite: { defense: '减伤70%, 偶尔覆写功能', tool: '规则覆写: 反转敌人行为' },
};
