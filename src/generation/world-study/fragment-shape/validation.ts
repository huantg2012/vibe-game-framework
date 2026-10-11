import { FRAGMENT_SHAPE_LIMITS, FragmentShapeError, RECTILINEAR_FRAGMENT_VERSION } from './types';
import type { FragmentPoint, RectilinearFragmentRequest } from './types';

export function validateFragmentRequest(request: RectilinearFragmentRequest): void {
  if (!request || typeof request !== 'object') throw new FragmentShapeError('INVALID_INPUT', 'A fragment request is required');
  if (request.algorithmVersion !== RECTILINEAR_FRAGMENT_VERSION) throw new FragmentShapeError('UNSUPPORTED_VERSION', `Unsupported fragment algorithm: ${String(request.algorithmVersion)}`);
  if (!Number.isInteger(request.edgeSeed) || request.edgeSeed < 0 || request.edgeSeed > 0xffffffff) throw new FragmentShapeError('INVALID_INPUT', 'edgeSeed must be an unsigned 32-bit integer');
  const layout = request.layout;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout) || layout.worldScale !== 2) throw new FragmentShapeError('INVALID_INPUT', 'v1 requires a layout object with worldScale: 2; coordinates must be authoring units, not world pixels');
  if (!Array.isArray(layout.authoringFrame) || layout.authoringFrame.length !== 2 || ![layout.authoringFrame[0], layout.authoringFrame[1]].every(n => Number.isFinite(n) && n > 0)) throw new FragmentShapeError('INVALID_INPUT', 'authoringFrame must contain two finite positive dimensions');
  if (layout.authoringFrame.some(n => n > FRAGMENT_SHAPE_LIMITS.maxFrameDimension)) throw new FragmentShapeError('BUDGET_EXCEEDED', 'Authoring frame exceeds the v1 coordinate budget');
  if (!Array.isArray(layout.landRects) || !Array.isArray(layout.voidRects) || layout.landRects.length === 0) throw new FragmentShapeError('INVALID_INPUT', 'landRects must be nonempty and voidRects must be an array');
  if (layout.landRects.length + layout.voidRects.length > FRAGMENT_SHAPE_LIMITS.maxRectangles) throw new FragmentShapeError('BUDGET_EXCEEDED', 'Rectangle count exceeds the v1 budget');
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const rectangle of [...layout.landRects, ...layout.voidRects]) {
    if (!Array.isArray(rectangle) || rectangle.length !== 4 || ![rectangle[0], rectangle[1], rectangle[2], rectangle[3]].every(Number.isFinite)) throw new FragmentShapeError('INVALID_INPUT', 'Every rectangle must contain four finite coordinates');
    const [x, y, width, height] = rectangle;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > layout.authoringFrame[0] || y + height > layout.authoringFrame[1]) throw new FragmentShapeError('INVALID_INPUT', 'Rectangles must have positive size and lie within authoringFrame');
    xs.add(x); xs.add(x + width);
    ys.add(y); ys.add(y + height);
  }
  if ((xs.size - 1) * (ys.size - 1) > FRAGMENT_SHAPE_LIMITS.maxGridCells) throw new FragmentShapeError('BUDGET_EXCEEDED', 'Rectangle partition exceeds the v1 grid budget');
}

const area = (points: readonly FragmentPoint[]): number => points.reduce((total, point, index) => {
  const next = points[(index + 1) % points.length]!;
  return total + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;

const orientation = (a: FragmentPoint, b: FragmentPoint, c: FragmentPoint): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (p: FragmentPoint, a: FragmentPoint, b: FragmentPoint): boolean => orientation(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);

function intersects(a: FragmentPoint, b: FragmentPoint, c: FragmentPoint, d: FragmentPoint): boolean {
  const abC = orientation(a, b, c), abD = orientation(a, b, d), cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
  return onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}

function contains(point: FragmentPoint, loop: readonly FragmentPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!, b = loop[j]!;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Single land component and disjoint holes. No raster/body assumptions. */
export function validateFragmentContours(contours: readonly (readonly FragmentPoint[])[], stage: 'source' | 'output'): void {
  const code = stage === 'source' ? 'UNSUPPORTED_TOPOLOGY' : 'INVALID_OUTPUT';
  const vertices = contours.reduce((sum, points) => sum + points.length, 0);
  const budget = stage === 'source' ? FRAGMENT_SHAPE_LIMITS.maxSourceVertices : FRAGMENT_SHAPE_LIMITS.maxOutputVertices;
  if (vertices > budget) throw new FragmentShapeError('BUDGET_EXCEEDED', `${stage} contour vertex budget exceeded`);
  if (contours.length === 0 || contours.filter(loop => area(loop) > 0).length !== 1 || area(contours[0]!) <= 0) throw new FragmentShapeError(code, 'v1 requires one nonempty outer land contour; disconnected or empty layouts are rejected');
  const segments: {a: FragmentPoint; b: FragmentPoint; contour: number; index: number; count: number}[] = [];
  contours.forEach((loop, contour) => {
    if (loop.length < 4 || !Number.isFinite(area(loop)) || area(loop) === 0) throw new FragmentShapeError(code, 'Degenerate contour');
    loop.forEach((point, index) => {
      const next = loop[(index + 1) % loop.length]!;
      if (!point.every(Number.isFinite) || (point[0] === next[0] && point[1] === next[1])) throw new FragmentShapeError(code, 'Nonfinite or zero-length contour edge');
      segments.push({a: point, b: next, contour, index, count: loop.length});
    });
    if (contour > 0 && (area(loop) >= 0 || !contains(loop[0]!, contours[0]!))) throw new FragmentShapeError(code, 'Hole is not strictly inside the outer contour');
  });
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i]!, b = segments[j]!;
    if (a.contour === b.contour && (Math.abs(a.index - b.index) === 1 || Math.abs(a.index - b.index) === a.count - 1)) continue;
    if (intersects(a.a, a.b, b.a, b.b)) throw new FragmentShapeError(code, 'Contour edges cross or touch; no automatic repair is performed');
  }
  for (let i = 1; i < contours.length; i++) for (let j = i + 1; j < contours.length; j++) {
    if (contains(contours[i]![0]!, contours[j]!) || contains(contours[j]![0]!, contours[i]!)) throw new FragmentShapeError(code, 'Nested holes are unsupported');
  }
}
