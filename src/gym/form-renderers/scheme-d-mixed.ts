/**
 * 方案 D：混装（gym only，出击不接）。
 * 甲 → d/jia（抄 A）；丙 → d/bing（抄 B）；乙/丁 → d/yi、d/ding（在 B 方向重做）。
 * 本文件只分发。像素写在 d/*。ready 在至少一孔谱填实前保持 false。
 */
import type { ContaminationFormRenderer, FormVisual } from '@/gym/form-renderers/form-renderer';
import { attachBingD } from '@/gym/form-renderers/d/bing';
import { attachDingD } from '@/gym/form-renderers/d/ding';
import { attachJiaD } from '@/gym/form-renderers/d/jia';
import { attachYiD } from '@/gym/form-renderers/d/yi';

export const schemeDMixed: ContaminationFormRenderer = {
  id: 'd-mixed',
  label: '方案 D：混装',
  ready: false,
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
