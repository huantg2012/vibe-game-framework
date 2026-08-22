/**
 * 方案 D：混装（生产视觉层；I3-E 才接到 RiftScene）。
 * 甲 → d/jia（抄 A）；丙 → d/bing（抄 B）；乙/丁 → d/yi、d/ding（在 B 方向重做）。
 * 本文件只分发。像素写在 d/*。ready 为 true。
 */
import type { ContaminationFormRenderer, FormVisual } from '@/entities/form-renderers/form-renderer';
import { attachBingD } from '@/entities/form-renderers/d/bing';
import { attachDingD } from '@/entities/form-renderers/d/ding';
import { attachJiaD } from '@/entities/form-renderers/d/jia';
import { attachYiD } from '@/entities/form-renderers/d/yi';

export const schemeDMixed: ContaminationFormRenderer = {
  id: 'd-mixed',
  label: '方案 D：混装',
  ready: true,
  attach(ctx): FormVisual {
    switch (ctx.form.occupancy) {
      case 'floor':
        return attachJiaD(ctx);
      case 'wall':
        return attachYiD(ctx);
      case 'paint':
        return attachBingD(ctx);
      case 'volume':
        return attachDingD(ctx);
    }
  },
};
