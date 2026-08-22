/**
 * Production contamination-form visual registry.
 * Sortie may import this module; it must not import `src/gym/**`.
 * Only scheme D is registered. A/B/C stay in the gym registry as frozen contrast.
 */
import { schemeDMixed } from '@/entities/form-renderers/scheme-d-mixed';
import type { ContaminationFormRenderer } from '@/entities/form-renderers/form-renderer';

export { schemeDMixed };
export {
  FORM_RENDERER_IDS,
  type ContaminationFormRenderer,
  type FormAttachContext,
  type FormRendererId,
  type FormVisual,
  type FormVisualPose,
  type FormVisualSignal,
} from '@/entities/form-renderers/form-renderer';

export function getFormRenderer(id: string): ContaminationFormRenderer | null {
  return id === 'd-mixed' ? schemeDMixed : null;
}
