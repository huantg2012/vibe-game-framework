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
  isContaminationDrawStyle,
} from '@/generation/preview-paint';
export type { ContaminationDrawStyle } from '@/generation/preview-paint';
export {
  contrastFloorCell,
  l1Pool,
  nearestPalette,
  quantizeInGroup,
  quantizeL1,
  temperatureGroup,
  TEAL_FAMILY,
  TEAL_FAMILY_HEX,
} from '@/generation/palette-quantize';
export type { Rgb as PaletteRgb, TemperatureGroup } from '@/generation/palette-quantize';
export { jitterRecipe } from '@/generation/recipes';
export { generateRiftLayout, type RiftLayoutOptions } from '@/generation/rift-layout';
export { evaluateDualPath, DUAL_PATH_MIN_LENGTH_RATIO } from '@/generation/dual-path';
export { rollFragmentAxes, isContaminationAge, isRuinSeverity } from '@/generation/fragment-roll';
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
  ContaminationAge,
  RuinSeverity,
  FragmentRoll,
} from '@/generation/types';
