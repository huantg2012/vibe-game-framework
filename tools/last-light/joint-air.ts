/** DEV-only world-space air for the paired opening. These density volumes are
 * optically thin incident air, not lamps, billboards or opaque geometry. The
 * source renderer remains unchanged; only the far plate's radiance is added. */
import { cameraBasis, type Camera } from '../../docs/art/demos/purification-last-light/render';
import type { V3 } from '../../docs/art/demos/purification-last-light/model';

export const JOINT_AIR = {
  version: 1,
  steps: 16,
  maxIncrement: [4, 7, 6],
  extinction: .27,
  volumes: [
    { id: 'behind-high-archive', center: [-13.2, -11.7, -14.2], radius: [3.1, 21, 3.4], gain: 1 },
    { id: 'behind-inclined-wing', center: [-16.2, -16.7, -7.2], radius: [2.7, 17, 3], gain: .82 },
  ],
  coordinateSpace: 'world',
  encoding: 'Additive RGB in far.energyBase; original alpha and geometry depth unchanged.',
} as const;

export interface AirStatistics {
  affectedPixels: number;
  additivePixels: number;
  surfacePixels: number;
  truncatedRays: number;
  fullyOccludedRays: number;
  maxIncrement: number[];
  sumIncrement: number[];
}

/** The renderer's orthographic depth grows toward the camera. Intersect each
 * ellipsoid analytically, then integrate only between the far surface and the
 * near volume boundary. The empty far plane is at -Infinity, never fake depth. */
export function applyJointAir(
  rgba: Uint8ClampedArray,
  depth: Float32Array,
  camera: Camera,
): AirStatistics {
  if (rgba.length !== camera.width * camera.height * 4 || depth.length * 4 !== rgba.length) {
    throw new Error('Joint air needs the matching padded frame and camera.');
  }
  const basis = cameraBasis(camera);
  const stats: AirStatistics = { affectedPixels: 0, additivePixels: 0, surfacePixels: 0,
    truncatedRays: 0, fullyOccludedRays: 0, maxIncrement: [0, 0, 0], sumIncrement: [0, 0, 0] };
  const volumes = JOINT_AIR.volumes.map(volume => {
    const direction = basis.back.map((v, axis) => v / volume.radius[axis]!) as unknown as V3;
    return { ...volume, direction, a: direction.reduce((n, v) => n + v * v, 0) };
  });
  for (let y = 0; y < camera.height; y++) for (let x = 0; x < camera.width; x++) {
    const i = y * camera.width + x;
    const sx = (x + .5 - camera.origin[0]) / camera.scale;
    const sy = (camera.origin[1] - y - .5) / camera.scale;
    const origin = camera.target.map((v, axis) => v + basis.right[axis]! * sx + basis.up[axis]! * sy) as unknown as V3;
    let opticalDepth = 0;
    for (const volume of volumes) {
      const o = origin.map((v, axis) => (v - volume.center[axis]!) / volume.radius[axis]!) as unknown as V3;
      const b = o.reduce((n, v, axis) => n + v * volume.direction[axis]!, 0);
      const c = o.reduce((n, v) => n + v * v, -1);
      const discriminant = b * b - volume.a * c;
      if (discriminant <= 0) continue;
      const root = Math.sqrt(discriminant);
      const far = (-b - root) / volume.a, near = (-b + root) / volume.a;
      const surface = depth[i]!;
      if (surface >= near) { stats.fullyOccludedRays++; continue; }
      if (surface > far) stats.truncatedRays++;
      const start = Math.max(far, surface + .003);
      const step = (near - start) / JOINT_AIR.steps;
      let integrated = 0;
      for (let sample = 0; sample < JOINT_AIR.steps; sample++) {
        const distance = start + (sample + .5) * step;
        const qx = o[0] + volume.direction[0] * distance;
        const qy = o[1] + volume.direction[1] * distance;
        const qz = o[2] + volume.direction[2] * distance;
        const edge = Math.max(0, 1 - qx * qx - qy * qy - qz * qz);
        // Quiet world-space density changes prevent a uniform luminous tube.
        // Squared edge produces a broad soft falloff, with no screen mask.
        const worldY = origin[1] + basis.back[1] * distance;
        const fold = .79 + .13 * Math.sin(worldY * .29 + qx * 1.8)
          + .08 * Math.sin(worldY * .71 - qz * 2.1);
        integrated += edge * edge * fold * step;
      }
      opticalDepth += integrated * JOINT_AIR.extinction * volume.gain;
    }
    if (opticalDepth <= 0) continue;
    const transmission = 1 - Math.exp(-opticalDepth);
    let changed = false;
    for (let channel = 0; channel < 3; channel++) {
      const before = rgba[i * 4 + channel]!;
      rgba[i * 4 + channel] = before + JOINT_AIR.maxIncrement[channel]! * transmission;
      const delta = rgba[i * 4 + channel]! - before;
      stats.maxIncrement[channel] = Math.max(stats.maxIncrement[channel]!, delta);
      stats.sumIncrement[channel]! += delta;
      changed ||= delta > 0;
    }
    if (changed) {
      stats.affectedPixels++;
      if (rgba[i * 4 + 3] === 0) stats.additivePixels++;
      else stats.surfacePixels++;
    }
  }
  return stats;
}
