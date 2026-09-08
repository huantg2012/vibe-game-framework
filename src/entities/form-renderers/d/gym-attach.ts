/** Production dispatcher shared by the lexicon lesson and gallery. */
import type { ContaminationFormRenderer, FormAttachContext, FormVisual } from '../form-renderer';

/** Keep the selected production renderer's occupancy routing, including non-oil paint. */
export function attachGymFormVisual(renderer: ContaminationFormRenderer, ctx: FormAttachContext): FormVisual {
  return renderer.attach(ctx);
}
