/**
 * 练习场形态分发（句法课 / 陈列馆共用入口）。住在方案 D 根目录：
 * 它跨占地（genome）与占漆（paint-genome）两层分发，不属于任何一个基体目录。
 * 出击不走这里——出击分发在 `scheme-d-mixed` / `RiftScene.attachSchemeD`。
 */
import type {
  ContaminationFormRenderer,
  FormAttachContext,
  FormVisual,
} from '@/entities/form-renderers/form-renderer';
import { attachJiaGenomeD } from '@/entities/form-renderers/d/genome/attach';
import { attachBingPaintGenome } from '@/entities/form-renderers/d/paint-genome/attach';

/** 占地走基因谱；占漆走 `d/paint-genome`（油膜省略变体 = 种子采样，DEC-101）；其余走 `d-mixed`。 */
export function attachGymFormVisual(
  renderer: ContaminationFormRenderer,
  ctx: FormAttachContext,
): FormVisual {
  if (ctx.form.occupancy === 'floor') return attachJiaGenomeD(ctx);
  if (ctx.form.occupancy === 'paint') return attachBingPaintGenome(ctx);
  return renderer.attach(ctx);
}
