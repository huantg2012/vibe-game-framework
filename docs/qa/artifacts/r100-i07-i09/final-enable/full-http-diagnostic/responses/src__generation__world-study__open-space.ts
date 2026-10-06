import { SeededRandom } from '@/utils/random';
import type { SpaceProfile } from './space-profile';

export interface ErosionResult { walls: Uint8Array; targetFraction: number; actualFraction: number; pits: number; fractures: number }
export interface WorldOrganization { readonly axis: number; readonly coherence: number }
export function validateWorldOrganization(value: WorldOrganization): void {
  if (!value || !Number.isFinite(value.axis) || !Number.isFinite(value.coherence) || value.coherence < 0 || value.coherence > 1)
    throw new Error('Invalid world organization axis/coherence');
}

/** Eight-neighbour distance in cells to unsupported space. */
export function clearanceField(mask: Uint8Array, cols: number, rows: number): Uint16Array {
  const distance = new Uint16Array(mask.length), queue = new Int32Array(mask.length);
  let head = 0, tail = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) { distance[i] = 0; queue[tail++] = i; } else distance[i] = 65535;
  }
  while (head < tail) {
    const cell = queue[head++]!, x = cell % cols, y = Math.floor(cell / cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, next = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || distance[next]! <= distance[cell]! + 1) continue;
      distance[next] = distance[cell]! + 1; queue[tail++] = next;
    }
  }
  return distance;
}

/** Carve independent local tears; never grow parallel map-spanning barriers. */
export function erodeOpenLand(land: Uint8Array, cols: number, rows: number, rng: SeededRandom, profile: SpaceProfile,
  organization?: WorldOrganization): ErosionResult {
  if (organization) validateWorldOrganization(organization);
  const walls = new Uint8Array(land.length), excluded = new Uint8Array(land.length);
  const coastDistance = clearanceField(land, cols, rows), area = land.reduce((sum, value) => sum + value, 0);
  const target = Math.round(area * profile.voidFraction);
  // A clustered erosion basin occupies a bounded part of the land. Merely
  // increasing Gaussian sampling around scattered centres is insufficient:
  // spacing rejection otherwise fills the tails and recreates a uniform map.
  const basin = { x: rng.nextFloat(cols * .40, cols * .60), y: rng.nextFloat(rows * .40, rows * .60) };
  const centres = Array.from({ length: 3 }, () => ({
    x: basin.x + rng.nextFloat(-cols * .10, cols * .10),
    y: basin.y + rng.nextFloat(-rows * .10, rows * .10),
  }));
  // Consume the historical draw even when v2 supplies an axis. Unversioned callers
  // keep their complete RNG sequence and resulting geometry byte for byte.
  const sampledMainAngle = rng.nextFloat(0, Math.PI);
  const mainAngle = organization?.axis ?? sampledMainAngle, shapePhase = rng.nextFloat(0, Math.PI * 2);
  let carved = 0, pits = 0, fractures = 0;
  for (let attempt = 0; attempt < 1800 && carved < target; attempt++) {
    const clustered = rng.next() < profile.clustering, centre = rng.pick(centres);
    const cx = clustered ? centre.x + rng.nextGaussian() * cols * .12 : rng.nextFloat(cols * .13, cols * .87);
    const cy = clustered ? centre.y + rng.nextGaussian() * rows * .12 : rng.nextFloat(rows * .13, rows * .87);
    if (clustered && ((cx - basin.x) / (cols * .30)) ** 2 + ((cy - basin.y) / (rows * .31)) ** 2 > 1) continue;
    const fracture = rng.next() < profile.crackFraction;
    const scale = profile.holeScale * (rng.next() < .27 ? rng.nextFloat(1.1, 1.4) : rng.nextFloat(.72, 1));
    const rx = rng.nextFloat(fracture ? 4.6 : 2.8, fracture ? 7 : 4.6) * scale;
    const ry = rng.nextFloat(fracture ? 1.45 : 2.25, fracture ? 2.3 : 3.9) * scale;
    const angle = mainAngle + rng.nextFloat(-Math.PI, Math.PI) * (1 - profile.directionality);
    const cosine = Math.cos(angle), sine = Math.sin(angle), phase = rng.nextFloat(0, 6.28) + shapePhase;
    const extent = Math.ceil(Math.max(rx, ry) * 1.2 + 1), cells: number[] = [];
    let clear = true;
    for (let y = Math.floor(cy - extent); y <= cy + extent; y++) for (let x = Math.floor(cx - extent); x <= cx + extent; x++) {
      const dx = x - cx, dy = y - cy, u = (dx * cosine + dy * sine) / rx;
      const v = (-dx * sine + dy * cosine) / ry + Math.sin(u * 2.1 + phase) * (fracture ? .21 : .09);
      const polar = Math.atan2(v, u);
      const boundary = 1 + Math.sin(polar * 3 + phase) * .20 + Math.sin(polar * 5 - phase) * .06;
      if (u * u + v * v > boundary) continue;
      const cell = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows || coastDistance[cell]! < 6 || excluded[cell]) { clear = false; continue; }
      cells.push(cell);
    }
    if (!clear || cells.length < 8 || carved + cells.length > target * 1.12) continue;
    for (const cell of cells) {
      walls[cell] = 1;
      const x = cell % cols, y = Math.floor(cell / cols);
      // Five clear cells between unrelated tears preserves broad land around them.
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) excluded[ny * cols + nx] = 1;
      }
    }
    carved += cells.length;
    if (fracture) fractures++; else pits++;
  }
  return { walls, targetFraction: profile.voidFraction, actualFraction: carved / area, pits, fractures };
}
