export { generateOutline, evaluateOutline, measureOutline, isLandCell } from '@/generation/outline-mask';
export {
  generateRuins,
  evaluateRuins,
  pickFragmentTypeId,
  enabledFragmentIds,
  fragmentDef,
} from '@/generation/ruins';
export { buildAtmosphere, occluderCoverage, measureAtmosphere, shadeAt } from '@/generation/atmosphere';
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
