/**
 * 方案 D：混装（生产视觉层；I3-E 已接 RiftScene）。
 * 甲 → d/genome `attachJiaGenomeD`（I5-J；与句法课 / 陈列馆同一份）；丙 → d/bing；乙/丁 → d/yi、d/ding。
 * 本文件只分发。像素写在 d/*。ready 为 true。A/B/C 冻结对照仍走旧 `jia-*`。
 */
import type { ContaminationFormRenderer, FormVisual } from '@/entities/form-renderers/form-renderer';
import { attachBingD } from '@/entities/form-renderers/d/bing';
import { attachDingD } from '@/entities/form-renderers/d/ding';
import { attachJiaGenomeD } from '@/entities/form-renderers/d/genome/attach';
import { attachYiD } from '@/entities/form-renderers/d/yi';

export const schemeDMixed: ContaminationFormRenderer = {
  id: 'd-mixed',
  label: '方案 D：混装',
  ready: true,
  attach(ctx): FormVisual {
    switch (ctx.form.occupancy) {
      case 'floor':
        return attachJiaGenomeD(ctx);
      case 'wall':
        return attachYiD(ctx);
      case 'paint':
        return attachBingD(ctx);
      case 'volume':
        return attachDingD(ctx);
    }
  },
};
