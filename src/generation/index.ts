export { generateOutline, evaluateOutline, measureOutline, isLandCell } from '@/generation/outline-mask';
export {
  generateRuins,
  evaluateRuins,
  pickFragmentTypeId,
  enabledFragmentIds,
  fragmentDef,
} from '@/generation/ruins';
export type {
  OutlineMask,
  OutlineMetrics,
  OutlineBBox,
  OutlineVerdict,
  OutlineReject,
  RuinedMask,
  RuinFeature,
  RuinFeatureKind,
  RuinMetrics,
  RuinPaintCell,
  RuinPaintRole,
} from '@/generation/types';
