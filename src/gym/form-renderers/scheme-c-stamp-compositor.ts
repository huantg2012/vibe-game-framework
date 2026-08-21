import type { ContaminationFormRenderer, FormVisual } from '@/gym/form-renderers/form-renderer';

export const schemeCStampCompositor: ContaminationFormRenderer = {
  id: 'c-stamp-compositor',
  label: '方案 C：词素层叠',
  ready: false,
  attach(): FormVisual {
    throw new Error('[form-renderer] c-stamp-compositor is not ready');
  },
};
