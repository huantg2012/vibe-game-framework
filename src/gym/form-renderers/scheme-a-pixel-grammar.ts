import type { ContaminationFormRenderer, FormVisual } from '@/gym/form-renderers/form-renderer';

export const schemeAPixelGrammar: ContaminationFormRenderer = {
  id: 'a-pixel-grammar',
  label: '方案 A：程序像素词法',
  ready: false,
  attach(): FormVisual {
    throw new Error('[form-renderer] a-pixel-grammar is not ready');
  },
};
