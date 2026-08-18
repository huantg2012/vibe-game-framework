export { generateOutline, evaluateOutline, measureOutline, isLandCell } from '@/generation/outline-mask';
export {
  generateRuins,
  evaluateRuins,
  pickFragmentTypeId,
  enabledFragmentIds,
  fragmentDef,
} from '@/generation/ruins';
export { measureSilhouette, silhouetteFails } from '@/generation/silhouette';
export type { SilhouetteMetrics } from '@/generation/silhouette';
export type { AtmosphereSpec, AtmosphereMetrics } from '@/generation/atmosphere';
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
  OverlayStamp,
  OverlayKind,
  AtmosphereField,
  SkyOccluder,
} from '@/generation/types';
