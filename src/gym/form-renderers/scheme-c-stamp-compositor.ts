/**
 * 方案 C：词素层叠。身份 = 有限枚举图章叠加，不是配方里连续拧密度，也不是崩坏簇整团。
 * Canvas 烤 24 张 1-bit/索引色 stamp；运行时 Container 叠层。1053 = 组合。换侧栏字段应对得上「哪一层换了」。
 * motion / rhythm 不是 stamp，是播放图（偏移、显隐、甲的块交替、闪核、胀缩 scale）。
 *
 * 字段 → 图章层
 * occupancy     占位剪影（4）：floor 块 / wall 缝条 / paint 漆斑 / volume 带（平铺）
 * substrate     基体残余（6）：有机残影 / 灯柱 / 门框 / 墙锈 / 菌毯 / 油膜
 * coverage      覆盖纱（3）：thin 渗透 / half 改写 / thick 覆盖；覆盖时关掉基体层
 * continuity    排列层：整块=不加副本；碎裂= occupancy 偏移副本；菌落=卫星环；场=平铺或更大卫星圈
 * sense         感知（3）：cone/narrow/reverse→缝亮；hear/scent/domain→听腔；touch→触地点。不成对眼
 * contact       残迹（3）：三刀/打核→尘；踩踏/场内混乱→污斑；邻格抽打/打核→抽打点
 * utteranceId   成句标记（4）：开合 / 缝视 / 呼吸 / 反视。无则关。配方名不上屏
 * motion        播放：巡路=块交替；转面=镜像顿；凝聚=向核收；沿壁=缝滑；固着=几乎不动；簇栖=卫星半径；随风=带平移；拖尾=错位带
 * rhythm        播放：常开=感知常在；睡眠=感知几乎关；脉冲=感知闪；随簇呼吸=卫星胀缩；随天空相=体积带 alpha
 *
 * 甲：Container 跟身体走，腿/块 stamp 交替，朝向 flipX，rotation 恒 0。
 * 乙：缝条 + 核，钉墙格。丙：不另做小人，簇座位上核 stamp + 卫星，胀缩用 scale / 外圈显隐。
 * 丁：体积带平铺在盒内 + 核；awake 时核层亮。深度只取 ctx。
 *
 * 24 张底图：occ-floor/wall/paint/volume；sub-organic/lamp/door/rust/fungal/oil；
 * veil-thin/half/thick；cont-sat；sense-seam/cavity/touch；contact-dust/stain/strike；
 * utt-open/seam/breath/watch。再靠 flip / offset / alpha / 显隐 / scale 组合全空间。
 */
import type {
  ContaminationFormRenderer,
  FormAttachContext,
  FormVisual,
} from '@/gym/form-renderers/form-renderer';
import { ensureCStamps } from '@/gym/form-renderers/c/stamps';
import { createStampVisual } from '@/gym/form-renderers/c/visual';

export const schemeCStampCompositor: ContaminationFormRenderer = {
  id: 'c-stamp-compositor',
  label: '方案 C：词素层叠',
  ready: true,
  attach(ctx: FormAttachContext): FormVisual {
    ensureCStamps(ctx.scene);
    return createStampVisual(ctx);
  },
};
