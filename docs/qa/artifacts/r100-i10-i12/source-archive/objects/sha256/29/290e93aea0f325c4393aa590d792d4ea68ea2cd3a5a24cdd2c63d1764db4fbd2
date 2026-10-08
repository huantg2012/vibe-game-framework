import { ENVIRONMENT_FACES, type Face } from '../../assets/source/purification-r9/environment';
import { CHAMBER_DEVICE_BASES, CHAMBER_DEVICE_FOOTPRINTS, CHAMBER_WALK_POLYGONS,
  type ChamberPoint, type ChamberPolygon } from './purification-chamber-layout';
import { CHAMBER_MODULE_BOUNDS, distanceToIntegrityFootprint } from '../ui/chamber-integrity-placement';

type ObservableModule = keyof typeof CHAMBER_MODULE_BOUNDS;
/** x/y are the authored screen-plane coordinates. Actual depth Y = y + z. */
export interface ChamberSightPoint extends ChamberPoint { readonly z: number }
export interface ChamberObservation { readonly distance: number; readonly visible: boolean }
const EPSILON = 1e-6;
const OPAQUE_FACES = ENVIRONMENT_FACES.filter(face =>
  (face.layer === 'architecture' || face.layer === 'foreground') && face.plane !== null);

function contains(polygon: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.abs((x - a[0]) * dy - (y - a[1]) * dx) < EPSILON
      && (x - a[0]) * (x - b[0]) + (y - a[1]) * (y - b[1]) <= EPSILON) return true;
    if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * dx / dy) inside = !inside;
  }
  return inside;
}
const coordinates = (polygon: ChamberPolygon): readonly (readonly [number, number])[] => polygon.map(point => [point.x, point.y] as const);
const floorPolygons = {
  main: coordinates(CHAMBER_WALK_POLYGONS.main), upper: coordinates(CHAMBER_WALK_POLYGONS.upper),
  'left-stair': coordinates(CHAMBER_WALK_POLYGONS['left-stair']), 'right-stair': coordinates(CHAMBER_WALK_POLYGONS['right-stair']),
};

/** Route geometry determines eye height; its label never decides sight eligibility. */
export function chamberObservationFloorHeight(feet: ChamberPoint): number {
  for (const ramp of ['left-stair', 'right-stair'] as const) {
    if (!contains(floorPolygons[ramp], feet.x, feet.y)) continue;
    const polygon: ChamberPolygon = CHAMBER_WALK_POLYGONS[ramp];
    return Math.max(0, Math.min(32, 32 * (polygon[3]!.y - feet.y) / (polygon[3]!.y - polygon[0]!.y)));
  }
  return contains(floorPolygons.upper, feet.x, feet.y) ? 32 : 0;
}

/** Intersect a sight segment with the same affine-height polygons used to paint
 * the opaque construction. No foot-radius sweep, route veto or invented wall box.
 * Decorative paint without a physical plane and exterior distance layers are not walls. */
export function isChamberObservationRayClear(eye: ChamberSightPoint, target: ChamberSightPoint,
  faces: readonly Face[] = OPAQUE_FACES): boolean {
  for (const face of faces) {
    const plane = face.plane;
    if (!plane) continue;
    const heightAtEye = plane.elevation + (eye.x - (plane.originX ?? 0)) * (plane.riseX ?? 0)
      + (eye.y - (plane.originY ?? 0)) * (plane.riseY ?? 0);
    const slope = (target.x - eye.x) * (plane.riseX ?? 0) + (target.y - eye.y) * (plane.riseY ?? 0);
    const denominator = target.z - eye.z - slope;
    if (Math.abs(denominator) < EPSILON) continue;
    const t = (heightAtEye - eye.z) / denominator;
    // Touching the observer/target surface is not an intervening wall.
    if (t <= EPSILON || t >= 1 - EPSILON) continue;
    const x = eye.x + (target.x - eye.x) * t, y = eye.y + (target.y - eye.y) * t;
    if (!contains(face.points, x, y)) continue;
    // Architecture is painted before floors. Its broad understructure polygons
    // are overpainted by the exact walk surfaces; those pixels are not exposed walls.
    if (faces === OPAQUE_FACES && face.layer === 'architecture'
      && Object.values(floorPolygons).some(polygon => contains(polygon, x, y))) continue;
    return false;
  }
  return true;
}

/** Nearby exposed body, including an upper body seen over a lower bearing face.
 * Nine inset body samples are sufficient for these three authored convex bodies;
 * at least one must have an unobstructed ray from the actor's actual eye height. */
export function getChamberObservation(feet: ChamberPoint, moduleId: ObservableModule): ChamberObservation {
  const deviceId = moduleId.toLowerCase() as 'core' | 'storage' | 'purifier';
  const base = CHAMBER_DEVICE_BASES[deviceId];
  const distance = distanceToIntegrityFootprint(feet, CHAMBER_DEVICE_FOOTPRINTS[deviceId]);
  const eye = { x: feet.x, y: feet.y - 16, z: chamberObservationFloorHeight(feet) + 16 };
  const bounds = CHAMBER_MODULE_BOUNDS[moduleId];
  const bodyHeight = -bounds[1];
  // All three original modules stand on main-floor elevation 0.
  for (const heightFraction of [.8, .55, .3]) {
    for (const horizontalFraction of [0, -.3, .3]) {
      const height = bodyHeight * heightFraction;
      const target = { x: base.x + Math.min(-bounds[0], bounds[2]) * horizontalFraction,
        y: base.y - height, z: height };
      if (isChamberObservationRayClear(eye, target)) return { distance, visible: true };
    }
  }
  return { distance, visible: false };
}
