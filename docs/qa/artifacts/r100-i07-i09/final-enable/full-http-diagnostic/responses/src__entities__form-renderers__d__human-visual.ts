import type { FormAttachContext, FormVisual } from '../form-renderer';
import { bakeHumanModel, HUMAN_WALK_CYCLE_MS } from './human-model';
import { attachAnimatedModel } from './model-visual';

export function attachHumanVisual(ctx: FormAttachContext): FormVisual {
  return attachAnimatedModel(ctx, { id: 'human17', walkCycleMs: HUMAN_WALK_CYCLE_MS, stridePixels: 28, bake: bakeHumanModel });
}
