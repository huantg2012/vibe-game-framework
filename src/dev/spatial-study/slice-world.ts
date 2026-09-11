import { SPATIAL_SLICE_GROUND, SPATIAL_SLICE_OPENINGS, SPATIAL_SLICE_PLACEMENTS, SPATIAL_SLICE_SCENES, SPATIAL_SLICE_WATER } from '@/generated/spatial-slice-data';
import type { GeneratedRiftLayout } from '@/generation/types';
import { TileType } from '@/types/game-types';
import { createSpatialStudyLayout } from './fixture';
import { sampleWaterCurtain, type WaterCurtainFrame } from './water-curtain';
import { GroundHeightField } from './stage/ground-height';

export type SpatialSliceMode = 'stage' | 'vista';
export interface SlicePoint { x: number; y: number }
export interface SeaColumn { field: number; top: number; bottom: number }
export interface SlicePresentation {
  update(elapsedMs: number): void;
  snapshot(): Record<string, unknown>;
  destroy(): void;
}
export const SLICE_SCENE = SPATIAL_SLICE_SCENES[0];
export const SLICE_WATER = SPATIAL_SLICE_WATER[0];

/** Geometry belongs to the world. Both renderers consume these same flowing
 * openings, real ground, water contact polygon and deterministic world clock. */
export class SpatialSliceWorld {
  readonly layout: GeneratedRiftLayout;
  readonly width: number;
  readonly height: number;
  readonly ground: GroundHeightField;
  readonly definition = SLICE_SCENE;
  readonly waterDefinition = SLICE_WATER;
  readonly water: WaterCurtainFrame = { phase: 'quiet', cycle: 0, progress: 0, extension: 0, active: false };
  readonly waterOutline: SlicePoint[];
  readonly reef: { x: number; y: number; height: number };
  readonly openings = SPATIAL_SLICE_OPENINGS;
  private readonly seaMotions = this.openings.map(h => ({ definition:h,phase:0,cx:0,cy:0,
    cos:Math.cos(h.angle*Math.PI/180),sin:Math.sin(h.angle*Math.PI/180) }));
  private seaMotionTime = NaN;
  private readonly baseWater: SlicePoint[];
  private nextHit = 0;
  hits = 0;
  attempts = 0;
  elapsedMs = 0;

  constructor(readonly seed: number) {
    this.layout = createSpatialStudyLayout(seed, SLICE_SCENE, SPATIAL_SLICE_PLACEMENTS);
    this.width = this.layout.tileMap.cols * this.layout.tileMap.tileSize;
    this.height = this.layout.tileMap.rows * this.layout.tileMap.tileSize;
    this.ground = new GroundHeightField(this.width, this.height, SPATIAL_SLICE_GROUND);
    this.baseWater = SLICE_WATER.outline.split('|').map(p => {
      const [x, y] = p.split(':').map(Number); return { x: x!, y: y! };
    });
    this.waterOutline = this.baseWater.map(() => ({ x: 0, y: 0 }));
    this.reef = { x: (SLICE_SCENE.reefCol + .5) * 32, y: (SLICE_SCENE.reefRow + .5) * 32, height: SLICE_SCENE.reefHeight };
    this.advance(0, this.layout.spawnPoint, true, () => false);
  }

  /** Positive inside the suspended body, negative in air. Natural openings do
   * not follow the player and do not modify the authoritative walkable floor. */
  seaField(x: number, y: number, elapsedMs = this.elapsedMs): number {
    const t = elapsedMs / 1000, seedPhase = this.seed * .11;
    // The moving openings have one pose per world instant. Dense geometry,
    // normals and both presenters reuse it instead of recomputing its motion
    // for every vertex. This cache contains no player or perception state.
    if (this.seaMotionTime !== elapsedMs) {
      this.seaMotionTime=elapsedMs;
      for (const motion of this.seaMotions) {
        const h=motion.definition;
        motion.phase=t*.12+h.phase+seedPhase;
        motion.cx=h.x+Math.sin(motion.phase)*h.driftX;
        motion.cy=h.y+Math.sin(motion.phase*.79+1.4)*h.driftY;
      }
    }
    let field = Math.min(1.2, (SLICE_SCENE.seaFrontY + 25 * Math.sin(x / 154 + t * .13) - y) / 42,
      (x + 96) / 70, (this.width + 96 - x) / 70, (y + 130) / 70);
    for (const motion of this.seaMotions) {
      const { definition:h,phase,cx,cy,cos,sin }=motion;
      const wx = x - cx + Math.sin(y / 69 + phase) * 11;
      const wy = y - cy + Math.sin(x / 87 - phase * .7) * 9;
      const dy = (-wx * sin + wy * cos) / h.radiusY;
      const dx = (wx * cos + wy * sin) / h.radiusX * (1 + .17 * Math.sin(dy * 2.8 + h.phase));
      const angle = Math.atan2(dy, dx);
      const distance = Math.hypot(dx, dy);
      const edge = distance - (1 + .14 * Math.sin(angle * 3 + h.phase + t * .11)
        + .08 * Math.sin(angle * 5 - h.phase + t * .17));
      field = Math.min(field, edge);
    }
    return field;
  }

  sampleSea(x: number, y: number, elapsedMs: number, out: SeaColumn): SeaColumn {
    const t = elapsedMs / 1000;
    out.field = this.seaField(x, y, elapsedMs);
    const rim = Math.max(0, 1 - Math.abs(out.field) * 3.2);
    out.top = SLICE_SCENE.seaTopHeight + Math.sin(x / 167 + y / 237 - t * .31) * 12
      + Math.sin(x / 71 - y / 173 + t * .57) * 5 - rim * 15;
    out.bottom = SLICE_SCENE.seaBottomHeight + Math.sin(x / 201 - y / 187 + t * .24) * 10
      + Math.sin(y / 98 + t * .41) * 6 + rim * 13;
    const swell = Math.sin(x / 260 - y / 170 + t * .16) * 40
      + Math.sin(x / 180 + y / 250 - t * .21) * 22;
    out.top += swell;
    out.bottom += swell * .68;
    out.top = Math.max(out.top, out.bottom + 68);
    // The near-right body curls upward as a real volume. This leaves an air
    // corridor beneath its belly, so an interior fall can be seen from the
    // shared fixed camera without relocating its source to the outer edge.
    const curlWidth = Math.exp(-Math.pow((x - SLICE_WATER.x) / 185, 4));
    const curl = Math.max(0, y - (SLICE_WATER.y - 32)) * .96 * curlWidth;
    out.top += curl;
    out.bottom += curl;
    return out;
  }

  isFloor(x: number, y: number): boolean {
    const map = this.layout.tileMap, col = Math.floor(x / map.tileSize), row = Math.floor(y / map.tileSize);
    return col >= 0 && row >= 0 && col < map.cols && row < map.rows && map.tiles[row]![col] === TileType.FLOOR;
  }

  groundHeightAt(x: number, y: number): number { return this.ground.heightAt(x, y); }

  advance(elapsedMs: number, player: Readonly<SlicePoint>, ended: boolean,
    applyHit: (source: string, damage: number) => boolean): void {
    this.elapsedMs = elapsedMs;
    const wasActive = this.water.active;
    sampleWaterCurtain(this.water, elapsedMs, SLICE_WATER);
    const t = elapsedMs / 1000;
    for (let i = 0; i < this.baseWater.length; i++) {
      const base = this.baseWater[i]!, point = this.waterOutline[i]!;
      // Different tongues travel at different speeds, preserving the broad
      // authored asymmetry instead of decorating a circle with edge noise.
      point.x = SLICE_WATER.x + base.x * (1 + .06 * Math.sin(t * 1.1 + i * .9)) + Math.sin(t * .64) * 3;
      point.y = SLICE_WATER.y + base.y * (1 + .07 * Math.sin(t * .83 - i * .7));
    }
    if (!this.water.active || !wasActive) this.nextHit = elapsedMs;
    if (ended || !this.water.active || elapsedMs < this.nextHit || !this.isInsideWater(player)) return;
    this.nextHit = elapsedMs + SLICE_WATER.hitIntervalMs;
    this.attempts++;
    if (applyHit(`environment:${SLICE_WATER.id}`, SLICE_WATER.damage)) this.hits++;
  }

  isInsideWater(point: Readonly<SlicePoint>): boolean { return pointInPolygon(point, this.waterOutline); }

  signature(): string {
    const input = JSON.stringify({ seed: this.seed, scene: SLICE_SCENE, water: SLICE_WATER,
      placements: SPATIAL_SLICE_PLACEMENTS, openings: SPATIAL_SLICE_OPENINGS, ground: SPATIAL_SLICE_GROUND });
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

export function pointInPolygon(point: Readonly<SlicePoint>, polygon: readonly SlicePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!, b = polygon[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const cross = (point.x - a.x) * dy - (point.y - a.y) * dx;
    if (Math.abs(cross) < 1e-7 && (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y) <= 0) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
