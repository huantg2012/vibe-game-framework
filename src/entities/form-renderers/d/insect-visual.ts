import type { FormAttachContext, FormVisual } from '../form-renderer';
import { bakeInsectModel } from './insect-model';
import { attachAnimatedModel } from './model-visual';

export function attachInsectVisual(ctx: FormAttachContext): FormVisual {
  return attachAnimatedModel(ctx, { id: 'insect16', walkCycleMs: 720, stridePixels: 22, bake: bakeInsectModel });
}
