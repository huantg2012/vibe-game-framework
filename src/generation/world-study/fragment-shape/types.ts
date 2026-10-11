/** Authoring coordinates, not world pixels; conversion belongs to the caller. */
export type FragmentPoint = readonly [number, number];
export type FragmentRect = readonly [number, number, number, number];
export type FragmentContourKind = 'outer' | 'hole';

/** Macro-layout is authored input. This compiler does not design a layout. */
export interface RectilinearFragmentLayout {
  /** v1 authoring distances are frozen at one unit = two world pixels. */
  readonly worldScale: 2;
  readonly authoringFrame: FragmentPoint;
  readonly landRects: readonly FragmentRect[];
  readonly voidRects: readonly FragmentRect[];
}

export const RECTILINEAR_FRAGMENT_VERSION = 'rectilinear-fragment-v1' as const;
export type RectilinearFragmentVersion = typeof RECTILINEAR_FRAGMENT_VERSION;

/** v1 has no adjustable damage parameters. Policy changes require a new version. */
export interface RectilinearFragmentRequest {
  readonly algorithmVersion: RectilinearFragmentVersion;
  readonly layout: RectilinearFragmentLayout;
  readonly edgeSeed: number;
}

export interface FragmentEdgeStats {
  readonly retained: number;
  readonly bevel: number;
  readonly broken: number;
  readonly blunt: number;
  readonly edgeBreaks: number;
  readonly outerContours: number;
  readonly holeContours: number;
  readonly sourceCorners: number;
  readonly originalArea: number;
  readonly treatedArea: number;
  readonly areaChangePercent: number;
  readonly originalAxisLengthPercent: number;
  readonly coordinateSpace: 'authoringFrame; multiply by worldScale for world pixels';
}

/** Rendering uses evenodd. Vector checks are not body/LOS/grid admission. */
export interface FragmentEdgeStudy {
  readonly seed: number;
  readonly contours: readonly (readonly FragmentPoint[])[];
  readonly contourKinds: readonly FragmentContourKind[];
  readonly pathD: string;
  readonly stats: FragmentEdgeStats;
}

export interface RectilinearFragmentResult extends FragmentEdgeStudy {
  readonly algorithmVersion: RectilinearFragmentVersion;
  readonly worldScale: 2;
}

export type FragmentShapeErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_VERSION' | 'BUDGET_EXCEEDED' | 'UNSUPPORTED_TOPOLOGY' | 'INVALID_OUTPUT';

/** Fail closed: no repaired layout, filled holes or fallback seed is returned. */
export class FragmentShapeError extends Error {
  constructor(readonly code: FragmentShapeErrorCode, message: string) {
    super(message);
    this.name = 'FragmentShapeError';
  }
}

/** Fixed v1 resource limits, not gameplay dimensions or tuning controls. */
export const FRAGMENT_SHAPE_LIMITS = Object.freeze({
  maxRectangles: 128,
  maxGridCells: 65536,
  maxFrameDimension: 16384,
  maxSourceVertices: 2048,
  maxOutputVertices: 8192,
});
