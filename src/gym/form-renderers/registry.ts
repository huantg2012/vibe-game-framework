import { schemeAPixelGrammar } from '@/gym/form-renderers/scheme-a-pixel-grammar';
import { schemeBSurfaceOrganism } from '@/gym/form-renderers/scheme-b-surface-organism';
import { schemeCStampCompositor } from '@/gym/form-renderers/scheme-c-stamp-compositor';
import {
  FORM_RENDERER_IDS,
  type ContaminationFormRenderer,
  type FormRendererId,
} from '@/gym/form-renderers/form-renderer';

const SCHEMES: Record<Exclude<FormRendererId, 'placeholder'>, ContaminationFormRenderer> = {
  'a-pixel-grammar': schemeAPixelGrammar,
  'b-surface-organism': schemeBSurfaceOrganism,
  'c-stamp-compositor': schemeCStampCompositor,
};

/** `placeholder` and unknown ids return null: gym keeps the current stand-in. */
export function getFormRenderer(id: string): ContaminationFormRenderer | null {
  if (!(FORM_RENDERER_IDS as readonly string[]).includes(id) || id === 'placeholder') {
    return null;
  }
  return SCHEMES[id as Exclude<FormRendererId, 'placeholder'>];
}
