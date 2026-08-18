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
export {
  applyStealthDensity,
  coverReachFails,
  measureCoverReach,
  stealthSpecFor,
} from '@/generation/stealth-density';
export type { CoverReachMetrics, StealthDensitySpec } from '@/generation/stealth-density';
export type { AtmosphereSpec, AtmosphereMetrics } from '@/generation/atmosphere';
export {
  SKY_SLIDE_PERIOD_MS,
  SKY_TRAVEL_SCALE,
  SKY_REPAINT_MS,
} from '@/generation/atmosphere';
export {
  LIVE_PAINT_PX_PER_TILE,
  compositeStaticPaint,
  paintSkyShade,
  skyOverlaySize,
} from '@/generation/preview-paint';
export { jitterRecipe } from '@/generation/recipes';
export { generateRiftLayout } from '@/generation/rift-layout';
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
  WalkableMask,
  GeneratedRiftLayout,
} from '@/generation/types';
