import { LIVING_LANDMASS_PLACEMENTS, LIVING_LANDMASS_SCENES, LIVING_LANDMASS_SUPPORTS,
  LIVING_LANDMASS_TENSION, type LivingLandmassSceneId } from '@/generated/living-landmass-data';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import { CONTAMINANT_SOURCE_POOLS } from '@/generated/contaminant-sources-data';
import { TileType } from '@/types/game-types';
import { checkpointChecksum } from '@/types/rift-checkpoint';
import type { GeneratedRiftLayout } from '@/generation/types';
import type { StageWorldGeometry } from '../spatial-study/stage/world-geometry';
import { createSpatialStudyLayout } from '../spatial-study/fixture';
import { assertStageVisualSupport } from '../spatial-study/stage-gameplay-fixture';
import { LivingLandmassTensionSystem } from '@/worlds/living-landmass/tension-system';
import type { LandmassPoint, LandmassSupportDefinition, SupportSample,
  TensionDefinition, TensionRuntimeStateV1, TensionView } from '@/worlds/living-landmass/types';

export type { LivingLandmassSceneId } from '@/generated/living-landmass-data';
export const LIVING_LANDMASS_WORLD_ID = 'living-landmass';
export const LIVING_LANDMASS_LOADOUT_IDS = ['bare', 'melee', 'light', 'shore'] as const;
export type LivingLandmassLoadoutId = typeof LIVING_LANDMASS_LOADOUT_IDS[number];
export interface LivingLandmassOptions {
  readonly scene: LivingLandmassSceneId;
  readonly loadout: LivingLandmassLoadoutId;
  readonly seed: number;
}
export interface LivingLandmassMetadata {
  readonly worldId: 'living-landmass';
  readonly sceneId: LivingLandmassSceneId;
  readonly sceneName: string;
  readonly recipeVersion: number;
  readonly seed: number;
  readonly entryDurationMs: number;
  readonly signature: string;
  readonly sourcePools: readonly { nodeId: string; kind: string; tier: string; poolId: string | null; allowWeapon: boolean | null }[];
}
export interface LivingLandmassWorldStateV1 {
  readonly version: 1;
  readonly signature: string;
  readonly elapsedMs: number;
  readonly tension: TensionRuntimeStateV1;
}

export function resolveLivingLandmassOptions(values: {
  scene?: string | null; loadout?: string | null; seed?: string | null;
}): LivingLandmassOptions {
  const scene = values.scene ?? 'living-borne-fin';
  if (!LIVING_LANDMASS_SCENES.some(row => row.id === scene)) throw new Error(`未知生命大陆局部：${scene}`);
  const loadout = values.loadout ?? 'bare';
  if (!LIVING_LANDMASS_LOADOUT_IDS.some(id => id === loadout) || !BUILD_LAB_LOADOUTS.some(row => row.id === loadout)) {
    throw new Error(`生命大陆尚未支持此出击配置：${loadout}`);
  }
  const text = values.seed ?? '7', seed = text.trim() === '' ? NaN : Number(text);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子须为 0–4294967295 之间的整数');
  return { scene: scene as LivingLandmassSceneId, loadout: loadout as LivingLandmassLoadoutId, seed };
}

interface SupportShape { readonly definition: LandmassSupportDefinition; readonly cosine: number; readonly sine: number }

/** One real XY footprint with continuous, authored vertical support. Every
 * attachment samples the same prepared 8px triangles used by the surface.
 * Height outside FLOOR remains continuous for visible descending edges; it
 * never grants support, navigation or a second walkable layer. */
export class LivingLandmassWorld implements StageWorldGeometry {
  readonly layout: GeneratedRiftLayout;
  readonly width: number;
  readonly height: number;
  readonly metadata: LivingLandmassMetadata;
  readonly definition: typeof LIVING_LANDMASS_SCENES[number];
  readonly supports: readonly LandmassSupportDefinition[];
  readonly tension: LivingLandmassTensionSystem;
  readonly entryDurationMs: number;
  readonly supportStep = 8;
  readonly supportColumns: number;
  readonly supportRows: number;
  readonly maximumSlope: number;
  private readonly shapes: readonly SupportShape[];
  private readonly baseHeights: Float32Array;
  private readonly flexHeights: Float32Array;
  private readonly heights: Float32Array;
  private preparedTension = NaN;
  private revision = 0;

  constructor(readonly seed: number, sceneId: LivingLandmassSceneId = 'living-borne-fin') {
    resolveLivingLandmassOptions({ scene: sceneId, seed: String(seed) });
    const scene = this.definition = LIVING_LANDMASS_SCENES.find(row => row.id === sceneId)!;
    const placements = LIVING_LANDMASS_PLACEMENTS.filter(row => row.sceneId === sceneId);
    const authoredTension = LIVING_LANDMASS_TENSION.find(row => row.sceneId === sceneId);
    if (!authoredTension) throw new Error(`Missing tension definition: ${sceneId}`);
    this.supports = Object.freeze(LIVING_LANDMASS_SUPPORTS.filter(row => row.sceneId === sceneId)
      .map(({ sceneId: _sceneId, ...definition }) => Object.freeze(definition)));
    this.shapes = this.supports.map(definition => ({ definition,
      cosine: Math.cos(definition.angle * Math.PI / 180), sine: Math.sin(definition.angle * Math.PI / 180) }));
    this.layout = createSpatialStudyLayout(seed,
      { ...scene, fragmentTypeId: scene.worldId, recipeId: `${scene.worldId}/${sceneId}@${scene.recipeVersion}` },
      placements.map(row => ({ ...row, allowWeapon: row.allowWeapon ?? undefined, lootPoolId: row.lootPoolId || undefined })));
    assertStageVisualSupport(this.layout);
    this.width = scene.cols * this.layout.tileMap.tileSize;
    this.height = scene.rows * this.layout.tileMap.tileSize;
    this.supportColumns = this.width / this.supportStep + 1;
    this.supportRows = this.height / this.supportStep + 1;
    this.baseHeights = new Float32Array(this.supportColumns * this.supportRows);
    this.flexHeights = new Float32Array(this.baseHeights.length);
    this.heights = new Float32Array(this.baseHeights.length);
    for (let row = 0; row < this.supportRows; row++) for (let col = 0; col < this.supportColumns; col++) {
      const x = col * this.supportStep, y = row * this.supportStep, at = row * this.supportColumns + col;
      for (const shape of this.shapes) {
        const influence = this.influenceAt(shape, x, y);
        this.baseHeights[at]! += influence * shape.definition.height;
        this.flexHeights[at]! += influence * shape.definition.flexHeight;
      }
    }
    this.maximumSlope = this.measureMaximumSlope();
    if (this.maximumSlope > .4) throw new Error(`Living support slope ${this.maximumSlope.toFixed(3)} exceeds 0.4; widen the CSV support`);
    const { x, y, hitX, hitY, outline, sceneId: _sceneId, ...timing } = authoredTension;
    const center = { x, y }, position = { x: hitX, y: hitY };
    const tensionDefinition: TensionDefinition = { ...timing, center, position,
      outline: outline.split('|').map(pair => {
        const [dx, dy] = pair.split(':').map(Number);
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('Invalid living-landmass danger outline');
        return { x: x + dx!, y: y + dy! };
      }) };
    if (!this.isFloor(position.x, position.y) || !this.isFloor(center.x, center.y)) throw new Error('Living tension requires real local ground');
    for (const node of this.layout.contaminantNodes) {
      if (!node.lootPoolId || !Object.prototype.hasOwnProperty.call(CONTAMINANT_SOURCE_POOLS, node.lootPoolId)) {
        throw new Error(`Living source pool unavailable: ${node.id}`);
      }
    }
    if (this.layout.enemySpawns.length !== 1 || this.layout.kindlingNodes.length !== 2 || this.layout.contaminantNodes.length !== 2) {
      throw new Error('Incomplete living-landmass local deployment');
    }
    this.tension = new LivingLandmassTensionSystem(tensionDefinition, (x, y) => this.isFloor(x, y));
    this.entryDurationMs = scene.entryDurationMs;
    const sourcePools = placements.filter(row => row.kind !== 'enemy').map(row => Object.freeze({ nodeId: `SS_${row.id}`,
      kind: row.kind, tier: row.tier, poolId: row.lootPoolId || null, allowWeapon: row.allowWeapon }));
    this.metadata = Object.freeze({ worldId: 'living-landmass', sceneId, sceneName: scene.name,
      recipeVersion: scene.recipeVersion, seed, entryDurationMs: scene.entryDurationMs,
      signature: checkpointChecksum({ seed, scene, placements, supports: this.supports, tension: tensionDefinition }),
      sourcePools: Object.freeze(sourcePools) });
    this.prepare(0);
  }

  get elapsedMs(): number { return this.tension.readView().elapsedMs; }
  get supportRevision(): number { return this.revision; }
  readonly readTensionView = (): TensionView => this.tension.readView();
  signature(): string { return this.metadata.signature; }

  isFloor(x: number, y: number): boolean {
    const map = this.layout.tileMap, col = Math.floor(x / map.tileSize), row = Math.floor(y / map.tileSize);
    return col >= 0 && row >= 0 && col < map.cols && row < map.rows && map.tiles[row]![col] === TileType.FLOOR;
  }

  prepare(elapsedMs: number, ended = false): void {
    this.tension.prepare(elapsedMs, ended);
    this.refreshSupport();
  }

  /** Read-only borrowed storage. Consumers update their own vertex buffers. */
  readSupportHeights(): Readonly<Float32Array> { return this.heights; }

  groundHeightAt(x: number, y: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Support coordinates must be finite');
    const gx = Math.max(0, Math.min(this.width, x)) / this.supportStep;
    const gy = Math.max(0, Math.min(this.height, y)) / this.supportStep;
    const col = Math.min(this.supportColumns - 2, Math.floor(gx));
    const row = Math.min(this.supportRows - 2, Math.floor(gy));
    const u = gx - col, v = gy - row, at = row * this.supportColumns + col;
    const a = this.heights[at]!, b = this.heights[at + this.supportColumns]!;
    const c = this.heights[at + 1]!, d = this.heights[at + this.supportColumns + 1]!;
    return u + v <= 1 ? a + (c - a) * u + (b - a) * v
      : d + (b - d) * (1 - u) + (c - d) * (1 - v);
  }

  sampleSupport(x: number, y: number, out: SupportSample): SupportSample {
    out.height = this.groundHeightAt(x, y);
    const gx = Math.max(0, Math.min(this.width, x)) / this.supportStep;
    const gy = Math.max(0, Math.min(this.height, y)) / this.supportStep;
    const col = Math.min(this.supportColumns - 2, Math.floor(gx));
    const row = Math.min(this.supportRows - 2, Math.floor(gy));
    const at = row * this.supportColumns + col;
    const a = this.heights[at]!, b = this.heights[at + this.supportColumns]!;
    const c = this.heights[at + 1]!, d = this.heights[at + this.supportColumns + 1]!;
    const first = gx - col + gy - row <= 1;
    const dx = (first ? c - a : d - b) / this.supportStep;
    const dz = (first ? b - a : d - c) / this.supportStep;
    const inverse = 1 / Math.hypot(dx, 1, dz);
    out.normal.x = -dx * inverse; out.normal.y = inverse; out.normal.z = -dz * inverse;
    out.supportId = null;
    if (this.isFloor(x, y)) {
      let best = -1;
      for (const shape of this.shapes) {
        const influence = this.influenceAt(shape, x, y);
        const priority = influence > 0 ? influence + (shape.definition.kind === 'fin' ? 2 : 0) : -1;
        if (priority > best) { best = priority; out.supportId = shape.definition.id; }
      }
    }
    return out;
  }

  exportRuntimeState(): LivingLandmassWorldStateV1 {
    return { version: 1, signature: this.signature(), elapsedMs: this.elapsedMs, tension: this.tension.exportRuntimeState() };
  }

  validateRuntimeState(value: unknown): value is LivingLandmassWorldStateV1 {
    if (!value || typeof value !== 'object') return false;
    const state = value as LivingLandmassWorldStateV1;
    return state.version === 1 && state.signature === this.signature() && this.tension.validateRuntimeState(state.tension)
      && state.elapsedMs === state.tension.elapsedMs;
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid living-landmass world checkpoint');
    this.tension.restoreRuntimeState(value.tension);
    this.preparedTension = NaN;
    this.refreshSupport();
  }

  snapshot(): Record<string, unknown> {
    return { worldId: 'living-landmass', signature: this.signature(), elapsedMs: this.elapsedMs,
      supportRevision: this.revision, maximumSlope: this.maximumSlope, supportStep: this.supportStep,
      supportColumns: this.supportColumns, supportRows: this.supportRows,
      tension: { ...this.readTensionView(), position: { ...this.readTensionView().position },
        outline: this.readTensionView().outline.map(point => ({ ...point })) } };
  }

  private influenceAt(shape: SupportShape, x: number, y: number): number {
    const dx = x - shape.definition.x, dy = y - shape.definition.y;
    const u = (dx * shape.cosine + dy * shape.sine) / shape.definition.radiusX;
    const v = (-dx * shape.sine + dy * shape.cosine) / shape.definition.radiusY;
    const distance = Math.min(1, Math.hypot(u, v));
    return 1 - distance * distance * (3 - 2 * distance);
  }

  private refreshSupport(): void {
    const tension = this.readTensionView().tension;
    if (tension === this.preparedTension) return;
    for (let index = 0; index < this.heights.length; index++) {
      this.heights[index] = this.baseHeights[index]! + this.flexHeights[index]! * tension;
    }
    this.preparedTension = tension;
    this.revision++;
  }

  private measureMaximumSlope(): number {
    let maximum = 0;
    // Gradients between these two states are linear combinations, so their
    // norms cannot exceed the endpoint maximum at any intermediate tension.
    for (const load of [0, 1]) for (let row = 0; row < this.supportRows - 1; row++) for (let col = 0; col < this.supportColumns - 1; col++) {
      const at = row * this.supportColumns + col;
      const a = this.baseHeights[at]! + this.flexHeights[at]! * load;
      const b = this.baseHeights[at + this.supportColumns]! + this.flexHeights[at + this.supportColumns]! * load;
      const c = this.baseHeights[at + 1]! + this.flexHeights[at + 1]! * load;
      const d = this.baseHeights[at + this.supportColumns + 1]! + this.flexHeights[at + this.supportColumns + 1]! * load;
      maximum = Math.max(maximum, Math.hypot(c - a, b - a) / this.supportStep, Math.hypot(d - b, d - c) / this.supportStep);
    }
    return maximum;
  }
}

export function createLivingLandmassWorld(seed: number, sceneId: LivingLandmassSceneId = 'living-borne-fin'): LivingLandmassWorld {
  return new LivingLandmassWorld(seed, sceneId);
}

export function copyLandmassPoints(points: readonly LandmassPoint[]): LandmassPoint[] {
  return points.map(point => ({ x: point.x, y: point.y }));
}
