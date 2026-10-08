/**
 * 方案 A：程序像素词法（gym 抽卡，出击不接）
 *
 * 原语 = 6 个残余剪影家族 × 覆盖失败旋钮 × 独立步态钟。
 * Canvas 逐像素烘焙，运行时换 Image（丁按格填薄雾）。
 * 不是崩坏簇/整团胀缩活层（B），不是底图+独立 stamp 容器（C）。
 *
 * 字段 → 原语：
 * - substrate → 家族剪影：有机残影 / 灯柱 / 门框 / 墙锈 / 菌毯 / 油膜
 * - coverage → 同一剪影的像素失败：渗透=轮廓可读；改写=半数挖空；覆盖=只剩失败像素+核
 * - continuity → 单核一块；裂片=2–3 块仍跟一个碰撞；菌落/场只在乙丙丁铺开，甲不加挡路场
 * - occupancy → 甲四向烘焙（墙偏置/漆下沉/体积霾）；乙墙缘锈斑；丙核相调制（不另做小人）；丁量化薄雾格+核
 * - motion → 步态表 hitch：巡路顿步 / 转面加滞后 / 凝聚内收 / 沿壁偏置 / 固着几乎不迈 / 簇栖扁团 / 随风错位 / 拖尾错带
 * - sense → 单点失败器官（缝亮、听腔、触地点、反面缝），不成对眼
 * - rhythm → 本方案步态钟 380–2100ms，与 DEC-070 的 3.1s 簇周期脱钩
 * - contact → 脱落尘密度、乙抽打格 1px、丁体积更浊；不改伤害
 * - utteranceId → 成句多一笔核行为（开合 / 缝视 / 呼吸 / 反视），配方名不上屏
 *
 * 参考动作：现行渗透体 Canvas 烘焙四向不转 GameObject；污染体形态 HOW 的缝核/簇核/体积带世界可读；Signalis 低保真失败表征。
 * 不学：头上名、图鉴卡、科幻全息。
 */
import type { ContaminationFormRenderer, FormVisual } from '@/entities/form-renderers/form-renderer';
import { attachBing } from '@/gym/form-renderers/a/bing-visual';
import { attachDing } from '@/gym/form-renderers/a/ding-visual';
import { attachJia } from '@/gym/form-renderers/a/jia-visual';
import { attachYi } from '@/gym/form-renderers/a/yi-visual';

export const schemeAPixelGrammar: ContaminationFormRenderer = {
  id: 'a-pixel-grammar',
  label: '方案 A：程序像素词法',
  ready: true,
  attach(ctx): FormVisual {
    switch (ctx.form.portfolio) {
      case 'jia':
        return attachJia(ctx);
      case 'yi':
        return attachYi(ctx);
      case 'bing':
        return attachBing(ctx);
      case 'ding':
        return attachDing(ctx);
    }
  },
};
