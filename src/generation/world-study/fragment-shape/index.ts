// Pre-integration authoring library. Do not add this to the live r7 generator.
export { generateRectilinearFragment, fragmentContoursToWorld } from './rectilinear-fragment';
export { FragmentShapeError, FRAGMENT_SHAPE_LIMITS, RECTILINEAR_FRAGMENT_VERSION } from './types';
export type {
  FragmentPoint,
  FragmentRect,
  FragmentContourKind,
  RectilinearFragmentLayout,
  RectilinearFragmentRequest,
  RectilinearFragmentResult,
  RectilinearFragmentVersion,
  FragmentEdgeStudy,
  FragmentEdgeStats,
  FragmentShapeErrorCode,
} from './types';
