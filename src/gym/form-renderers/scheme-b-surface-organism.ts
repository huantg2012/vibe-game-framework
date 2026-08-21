/**
 * 方案 B：地表方言活体。污染体是裂隙崩坏簇方言的活块，不是角色精灵家族。
 * 原语：簇径向剪影（椭圆/缺角/瓣）× nearestPalette 量化漆 × DEC-070 整团胀缩（~3.1s）。
 * 禁止四向人形密像素、禁止 stamp 图库、禁止把甲画成渗透体/改写体换皮。
 * 甲是会走的不规则簇剪影（碰撞仍 20）；覆盖深度走漆的失败程度，不走新职业小人。
 * 丙不另做小人。GameObject.rotation 恒 0；朝向靠核偏移与径向拉伸。
 *
 * 字段 → 原语
 * substrate    同一套簇/缝/膜的残余色与形状偏置：灯柱冷亮核、墙锈暗灰缝、菌毯多瓣团、
 *              油膜薄带、门框缺角、有机残影默认团。bias 后量化，不新色。
 * coverage     渗透=灰底透出+破洞；改写=半团失败；覆盖=只剩方言漆。
 * continuity   单核一团；裂片=碎团仍一碰撞；菌落=卫星团；场=铺开。均不改碰撞。
 * occupancy    甲=可走活团；乙=墙缘缝；丙=簇+呼吸（主场）；丁=走廊雾格。
 * motion       团的滑/顿/凝聚；乙沿壁滑动，不进走廊。
 * sense        核/缝亮的朝向或听相，不成对眼。
 * rhythm       接到约 3.1s 簇呼吸或其倍数（睡眠/天空相 ×2）。
 * contact      抽打/胀满/迈步/觉醒时外沿多一圈失败像素，不改价目表。
 * utteranceId  成句加一笔更可读的开合/缝视/呼吸/反视；配方名不上屏。
 *
 * 动作：甲 hitch-滑；乙缝开合；丙整团呼吸；丁觉醒相。共用失败表征在呼吸。
 */
import type { ContaminationFormRenderer } from '@/gym/form-renderers/form-renderer';
import { createSurfaceVisual } from '@/gym/form-renderers/b/surface-visual';

export const schemeBSurfaceOrganism: ContaminationFormRenderer = {
  id: 'b-surface-organism',
  label: '方案 B：地表方言活体',
  ready: true,
  attach(ctx) {
    return createSurfaceVisual(ctx);
  },
};
