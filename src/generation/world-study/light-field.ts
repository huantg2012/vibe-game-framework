/** Production light curve over the study's continuous land/void geometry. */
import { fieldVisibilityAt, SUBDIV2_LEVELS } from '../../systems/vision-textures';
import { worldLandAt, worldWallAt } from './shape';
import type { Facing4 } from '../../types/game-types';
import type { WorldSample } from './types';

export const STUDY_LIGHT = { radiusForward: 224, radiusAmbient: 80, coneHalfAngleDeg: 50, coneFalloffAngleDeg: 30 } as const;
export const LIGHT_PIXEL = 2;
export const LIGHT_EXTENT = STUDY_LIGHT.radiusForward;
export const LIGHT_SIZE = LIGHT_EXTENT * 2 / LIGHT_PIXEL;
const RAYS = 720;
const TAU = Math.PI * 2;
const directions: Record<Facing4, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const points = LIGHT_SIZE * LIGHT_SIZE;
const offsetsX = new Int16Array(points), offsetsY = new Int16Array(points);
const distances = new Float32Array(points), rayIndices = new Uint16Array(points);
const lightByFacing = {} as Record<Facing4, Uint8Array>;
const rayX = new Float32Array(RAYS), rayY = new Float32Array(RAYS);
for (let ray = 0; ray < RAYS; ray++) {
  rayX[ray] = Math.cos(ray / RAYS * TAU); rayY[ray] = Math.sin(ray / RAYS * TAU);
}
for (let i = 0; i < points; i++) {
  const x = (i % LIGHT_SIZE + .5) * LIGHT_PIXEL - LIGHT_EXTENT;
  const y = (Math.floor(i / LIGHT_SIZE) + .5) * LIGHT_PIXEL - LIGHT_EXTENT;
  offsetsX[i] = x; offsetsY[i] = y; distances[i] = Math.hypot(x, y);
  rayIndices[i] = Math.floor(((Math.atan2(y, x) + TAU) % TAU) / TAU * RAYS);
}
for (const facing of Object.keys(directions) as Facing4[]) {
  const values = new Uint8Array(points);
  for (let i = 0; i < points; i++) {
    const angle = Math.atan2(offsetsY[i]!, offsetsX[i]!) - directions[facing];
    const theta = Math.atan2(Math.sin(angle), Math.cos(angle));
    const value = fieldVisibilityAt(theta, distances[i]!, STUDY_LIGHT);
    const level = SUBDIV2_LEVELS.find(level => level <= value) ?? 0;
    values[i] = Math.round(level * 255);
  }
  lightByFacing[facing] = values;
}

export class WorldStudyLightField {
  readonly pixels = new Uint8ClampedArray(points * 4);
  readonly floor: Uint8Array;
  readonly width: number;
  readonly height: number;
  originX = 0;
  originY = 0;
  private readonly limits = new Float32Array(RAYS);
  private previousX = Number.NaN;
  private previousY = Number.NaN;
  private previousFacing: Facing4 | null = null;

  constructor(sample: WorldSample) {
    this.width = sample.cols * sample.tileSize; this.height = sample.rows * sample.tileSize;
    this.floor = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      this.floor[y * this.width + x] = Number(worldLandAt(sample, x + .5, y + .5) && !worldWallAt(sample, x + .5, y + .5));
    }
    for (let i = 0; i < points; i++) this.pixels.set([255, 255, 255, 0], i * 4);
  }

  private contains(x: number, y: number): boolean {
    const px = Math.floor(x), py = Math.floor(y);
    return px >= 0 && py >= 0 && px < this.width && py < this.height && this.floor[py * this.width + px] === 1;
  }

  update(x: number, y: number, facing: Facing4): boolean {
    const cx = Math.round(x), cy = Math.round(y);
    if (cx === this.previousX && cy === this.previousY && facing === this.previousFacing) return false;
    this.previousX = cx; this.previousY = cy; this.previousFacing = facing;
    this.originX = cx - LIGHT_EXTENT; this.originY = cy - LIGHT_EXTENT;
    for (let ray = 0; ray < RAYS; ray++) {
      let distance = 0;
      for (; distance <= LIGHT_EXTENT; distance++) {
        if (!this.contains(cx + rayX[ray]! * distance, cy + rayY[ray]! * distance)) break;
      }
      this.limits[ray] = Math.max(0, distance - 1);
    }
    const light = lightByFacing[facing];
    for (let i = 0; i < points; i++) {
      const ray = rayIndices[i]!;
      // Conservative neighbouring rays prevent leaks around a one-pixel corner.
      const limit = Math.min(this.limits[ray]!, this.limits[(ray + 1) % RAYS]!, this.limits[(ray + RAYS - 1) % RAYS]!);
      this.pixels[i * 4 + 3] = light[i]! > 0 && distances[i]! <= limit
        && this.contains(cx + offsetsX[i]!, cy + offsetsY[i]!) ? light[i]! : 0;
    }
    return true;
  }

  visibilityAt(x: number, y: number): number {
    if (!this.contains(x, y)) return 0;
    const col = Math.floor((x - this.originX) / LIGHT_PIXEL), row = Math.floor((y - this.originY) / LIGHT_PIXEL);
    if (col < 0 || row < 0 || col >= LIGHT_SIZE || row >= LIGHT_SIZE) return 0;
    return this.pixels[(row * LIGHT_SIZE + col) * 4 + 3]! / 255;
  }
}
