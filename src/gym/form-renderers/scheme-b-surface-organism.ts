import type { ContaminationFormRenderer, FormVisual } from '@/gym/form-renderers/form-renderer';

export const schemeBSurfaceOrganism: ContaminationFormRenderer = {
  id: 'b-surface-organism',
  label: '方案 B：地表方言活体',
  ready: false,
  attach(): FormVisual {
    throw new Error('[form-renderer] b-surface-organism is not ready');
  },
};
