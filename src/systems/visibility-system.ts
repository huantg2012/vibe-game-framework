/**
 * VisibilitySystem - the limited field of view.
 *
 * Self-implemented raycasting (architecture DEC-ARCH-004) producing a forward cone
 * unioned with an ambient ring, 32 isolux bands at the edge, and void-black plus
 * drifting noise everywhere else. Shared by the rift and the purification point;
 * the only difference between them is `VisionConfig`
 * (docs/specs/system-movement-vision.md, section V).
 *
 * Rendering: a world-space RenderTexture the size of the camera view plus two tiles of
 * padding is filled with void-black, then 32 nested ray-clipped polygons are erased
 * out of it (outermost first). Each band's radius is a reference-light-field isolux
 * (flashlight × lamp via fieldVisibilityAt) clamped to that ray's range curve;
 * compound residual just inside band k equals SUBDIV2_LEVELS[k]. The last band is
 * always the range silhouette, so shadows hug walls the same way the rays do.
 * Keeping the mask at world resolution (rather than screen resolution) means its
 * edges land on whole world pixels, which is what the pixel-art look needs.
 *
 * Performance: rays are only cast when the player has moved, turned, the grid changed,
 * or a chaos modulator changed the range. Isolux radii rebuild only when radiusScale
 * or ray counts change. Everything else is pre-allocated - the update path allocates
 * nothing.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { TileType, type Vector2 } from '@/types/game-types';
import type { OccluderGrid, TileMapData } from '@/types/map-types';
import { castRay, createRayHit, hasLineOfSight, type RayHit } from '@/utils/grid-raycast';
import { clamp, degToRad } from '@/utils/math';
import {
  computeFieldBandRadii,
  computeLevelEraseAlphas,
  fillVoidNoise,
  FLASHLIGHT_ALPHA_STOPS,
  FLASHLIGHT_POOL_STRETCH_ALONG,
  FLASHLIGHT_POOL_STRETCH_ACROSS,
  LAMP_ALPHA_STOPS,
  SUBDIV2_BAND_COUNT,
  SUBDIV2_BAND_FLOOR_PX,
  SUBDIV2_LEVELS,
  VOID_NOISE_SCROLL_Y_RATIO,
} from '@/systems/vision-textures';

const TAU = Math.PI * 2;

/** Floor on a hit distance, so a wall against the player's face cannot degenerate the polygon. */
const MIN_HIT_DIST = 4;

export type VisionMode = 'cone' | 'omni';

/**
 * Soft corruption (v3 geometric ring): concentric sub-rings under a piecewise
 * smoothstep bump - both ends land on EXACTLY 0 with zero slope. The gradient
 * also extends past the vision outline into the void by CORRUPTION_SOFT_TAIL_PX,
 * so the teal reads as seeping out of the darkness rather than stopping at a
 * contour. Production inner edge (DEC-107).
 */
const CORRUPTION_SOFT_RINGS = 20;
/** Soft v3: how far past the vision outline the outer tail bleeds into the black. */
const CORRUPTION_SOFT_TAIL_PX = 44;
/**
 * Soft v3: peak position within the extended band (0 = inner/player side,
 * 1 = tail tip). 0.25 keeps the main peak at the original mid-band while the
 * outer 3/4 of the profile becomes the long dark-side tail.
 */
const CORRUPTION_SOFT_PEAK_T = 0.25;

/**
 * Soft ring colour: production teal mixed toward the void, plus a lower peak.
 * CORRUPTION_COLOR itself is the mix source; trigger / depth / cap are unchanged.
 */
const CORRUPTION_SOFT_VOID_MIX = 0.4;
const CORRUPTION_SOFT_PEAK_SCALE = 0.7;

/**
 * Piecewise-smoothstep bump on [0, 1]: exactly 0 at both ends with zero slope,
 * exactly 1 at `peakT`. Zero slope at the ends keeps the first and last ring
 * alphas tiny, which is where the eye is most sensitive to a hard step.
 */
function corruptionSoftProfile(t: number, peakT: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < peakT) {
    const u = t / peakT;
    return u * u * (3 - 2 * u);
  }
  const w = (t - peakT) / (1 - peakT);
  return 1 - w * w * (3 - 2 * w);
}

/** RGB lerp between two 0xRRGGBB colors. */
function mixRgb(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export interface VisionConfig {
  readonly mode: VisionMode;
  readonly radiusForward: number;
  readonly radiusAmbient: number;
  readonly coneHalfAngleDeg: number;
  readonly coneFalloffAngleDeg: number;
  readonly rayCountForward: number;
  readonly rayCountAmbient: number;
  readonly minSolidRadius: number;
  readonly edgeBandWidth: number;
  readonly bandAlphas: readonly [number, number, number];
  /**
   * Mirror of the red-line `ERASE_ALPHAS` constant. 32 isolux bands no longer
   * erase in three stepped layers; kept so the logical three-band query can
   * still be compared against the original stepped profile.
   */
  readonly eraseAlphas: readonly [number, number, number];
  readonly voidColor: number;
  readonly voidNoiseEnabled: boolean;
  readonly playerLampEnabled: boolean;
  readonly playerLampAlpha: number;
  /** Forward flashlight beam that brightens (not just reveals) the cone. */
  readonly flashlightEnabled: boolean;
  readonly flashlightAlpha: number;
  /** Depth of the darkness mask; the glow, corruption and flicker layers sit just above. */
  readonly depth: number;
  /**
   * When provided, bypasses grid-based raycasting entirely.
   * Returns the hit distance (px) for a ray cast from `origin` at `angle` (radians).
   * Used by purification scene to produce a smooth boundary polygon from BoundaryShape.
   */
  readonly rayDistanceOverride?: (origin: Vector2, angle: number, maxRange: number) => number;
}

export interface VisibilityStats {
  readonly rayCount: number;
  readonly lastMs: number;
  readonly avgMs: number;
  readonly degradeLevel: number;
  readonly cached: boolean;
}

interface GlowSource {
  x: number;
  y: number;
  radius: number;
}

/** Rift defaults: a narrow cone plus a 2.5 tile ring, and noise in the void. */
export function createRiftVisionConfig(depth = 50): VisionConfig {
  const v = GAME_CONSTANTS.VISIBILITY;
  return {
    mode: 'cone',
    radiusForward: v.RADIUS_FORWARD,
    radiusAmbient: v.RADIUS_AMBIENT,
    coneHalfAngleDeg: v.CONE_HALF_ANGLE,
    coneFalloffAngleDeg: v.CONE_FALLOFF_ANGLE,
    rayCountForward: v.RAY_SPLIT_FORWARD,
    rayCountAmbient: v.RAY_SPLIT_AMBIENT,
    minSolidRadius: v.MIN_SOLID_RADIUS,
    edgeBandWidth: v.EDGE_BAND_WIDTH,
    bandAlphas: v.BAND_ALPHAS,
    eraseAlphas: v.ERASE_ALPHAS,
    voidColor: v.VOID_COLOR,
    voidNoiseEnabled: true,
    playerLampEnabled: true,
    playerLampAlpha: v.PLAYER_LAMP_ALPHA,
    flashlightEnabled: true,
    flashlightAlpha: v.FLASHLIGHT_ALPHA,
    depth,
  };
}

/**
 * Purification point defaults: omni mode covering the whole room, no void noise
 * (BoundaryAtmosphere owns what happens outside the walls), half-strength lamp.
 */
export function createPurificationVisionConfig(depth = 50): VisionConfig {
  const v = GAME_CONSTANTS.VISIBILITY;
  return {
    ...createRiftVisionConfig(depth),
    mode: 'omni',
    radiusForward: v.PURIFY_RADIUS,
    radiusAmbient: v.PURIFY_RADIUS,
    rayCountForward: v.PURIFY_RAY_COUNT,
    rayCountAmbient: 0,
    voidNoiseEnabled: false,
    playerLampAlpha: v.PLAYER_LAMP_ALPHA * 0.5,
    flashlightEnabled: false, // omni mode already lights the whole room
  };
}

export class VisibilitySystem {
  private scene!: Phaser.Scene;
  private config!: VisionConfig;
  private occluders!: OccluderGrid;

  // --- ray state (pre-allocated) ---
  private rayCountForward = 0;
  private rayCountAmbient = 0;
  private rayCount = 0;
  private rayOffsets!: Float32Array;
  private rayRange!: Float32Array;
  private rayDist!: Float32Array;
  private readonly hit: RayHit = createRayHit();

  /** Polygon vertices per band, in mask-local coordinates. Reused every frame. */
  private polygons: Array<Array<Vector2>> = [];

  // --- render objects ---
  private mask!: Phaser.GameObjects.RenderTexture;
  private bandGraphics: Phaser.GameObjects.Graphics[] = [];
  private noiseSprite: Phaser.GameObjects.TileSprite | null = null;
  private lamp: Phaser.GameObjects.Image | null = null;
  private flashlight: Phaser.GameObjects.Image | null = null;
  private glowGraphics!: Phaser.GameObjects.Graphics;
  private corruptionGraphics!: Phaser.GameObjects.Graphics;
  private flicker!: Phaser.GameObjects.Rectangle;
  /** Island stencil so the warm lamp/beam cannot paint void as tan. */
  private lightClipGraphics: Phaser.GameObjects.Graphics | null = null;

  private subdiv2Radii: Float32Array[] | null = null;
  private subdiv2Alphas: Float32Array | null = null;
  private subdiv2RadiiDirty = true;

  private maskWidth = 0;
  private maskHeight = 0;
  private padding = 0;
  private maskOriginX = 0;
  private maskOriginY = 0;

  // --- runtime modulation ---
  private radiusScale = 1;
  private abilityRadiusMultiplier = 1;
  private edgeCorruption = 0;
  private screenFlicker = 0;

  // --- extraction proximity (void noise scroll acceleration) ---
  private extractionPos: Vector2 | null = null;

  // --- cache / perf ---
  private cacheValid = false;
  private readonly originCache: Vector2 = { x: 0, y: 0 };
  private facingCache = 0;
  private gridVersionCache = -1;
  private frameIndex = 0;
  private elapsedMs = 0;
  private lastMs = 0;
  private degradeLevel = 0;
  private readonly budgetSamples = new Float32Array(GAME_CONSTANTS.VISIBILITY.DEGRADE_SAMPLE_FRAMES);
  private budgetIndex = 0;
  private budgetFilled = 0;
  private budgetSum = 0;
  private usedCacheLastFrame = false;
  private warnedOriginInWall = false;

  /** Live copy of the last update origin; used by the query API. */
  private readonly origin: Vector2 = { x: 0, y: 0 };
  private readonly glowSources = new Map<string, GlowSource>();
  private queryRevision = 0;
  private readonly querySnapshot: {
    x: number; y: number; facing: number; radiusScale: number; abilityScale: number;
    gridVersion: number; grid?: OccluderGrid; config?: VisionConfig;
  } = { x: NaN, y: NaN, facing: NaN, radiusScale: NaN, abilityScale: NaN, gridVersion: -1 };

  create(scene: Phaser.Scene, config: VisionConfig, occluders: OccluderGrid): void {
    this.scene = scene;
    this.config = config;
    this.occluders = occluders;

    // Reset mutable state for scene re-entry
    this.degradeLevel = 0;
    this.budgetIndex = 0;
    this.budgetFilled = 0;
    this.budgetSum = 0;
    this.budgetSamples.fill(0);
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.radiusScale = 1;
    this.abilityRadiusMultiplier = 1;
    this.edgeCorruption = 0;
    this.screenFlicker = 0;
    this.cacheValid = false;
    this.glowSources.clear();

    const camera = scene.cameras.main;
    this.padding = occluders.tileSize * 2;
    this.maskWidth = Math.ceil(camera.width / camera.zoomX) + this.padding * 2;
    this.maskHeight = Math.ceil(camera.height / camera.zoomY) + this.padding * 2;

    this.setRayCounts(config.rayCountForward, config.rayCountAmbient);

    this.mask = scene.add
      .renderTexture(0, 0, this.maskWidth, this.maskHeight)
      .setOrigin(0, 0)
      .setDepth(config.depth);

    for (let band = 0; band < SUBDIV2_BAND_COUNT; band++) {
      this.bandGraphics.push(scene.make.graphics({}, false));
    }

    if (config.voidNoiseEnabled) {
      const noiseKey = ensureNoiseTexture(scene);
      if (noiseKey) {
        this.noiseSprite = scene.make.tileSprite(
          { x: 0, y: 0, width: this.maskWidth, height: this.maskHeight, key: noiseKey },
          false
        );
        // RenderTexture.draw() ignores its alpha argument for Game Objects, so the
        // strength has to live on the sprite itself.
        this.noiseSprite.setOrigin(0, 0);
        this.noiseSprite.setAlpha(GAME_CONSTANTS.VISIBILITY.VOID_NOISE_ALPHA);
      }
    }

    if (config.playerLampEnabled) {
      const lampKey = ensureLampTexture(scene);
      if (lampKey) {
        this.lamp = scene.add
          .image(0, 0, lampKey)
          .setDepth(config.depth - 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(config.playerLampAlpha);
      }
    }

    if (config.flashlightEnabled && config.mode === 'cone') {
      const beamKey = ensureFlashlightTexture(scene);
      if (beamKey) {
        // Below the mask like the lamp, so the cone-shaped visible region clips it into a beam.
        this.flashlight = scene.add
          .image(0, 0, beamKey)
          .setDepth(config.depth - 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(config.flashlightAlpha);
      }
    }

    this.glowGraphics = scene.add.graphics().setDepth(config.depth + 10);
    this.corruptionGraphics = scene.add.graphics().setDepth(config.depth + 15);
    this.flicker = scene.add
      .rectangle(0, 0, this.maskWidth, this.maskHeight, GAME_CONSTANTS.VISIBILITY.CORRUPTION_COLOR)
      .setOrigin(0, 0)
      .setDepth(config.depth + 20)
      .setAlpha(0);
  }

  /** Call once per frame after the physics step. */
  update(origin: Vector2, facingAngle: number, deltaMs: number): void {
    this.frameIndex++;
    this.elapsedMs += deltaMs;
    this.origin.x = origin.x;
    this.origin.y = origin.y;

    const v = GAME_CONSTANTS.VISIBILITY;
    const posEpsilon = v.CACHE_POS_EPSILON;
    const angleEpsilon = degToRad(v.CACHE_ANGLE_EPSILON);

    let needsRaycast =
      !this.cacheValid ||
      Math.abs(origin.x - this.originCache.x) > posEpsilon ||
      Math.abs(origin.y - this.originCache.y) > posEpsilon ||
      Math.abs(shortestArc(facingAngle - this.facingCache)) > angleEpsilon ||
      this.occluders.version !== this.gridVersionCache;

    // Degradation step 2: refresh the polygon every other frame at most.
    if (needsRaycast && this.degradeLevel >= 2 && this.frameIndex % 2 === 1) {
      needsRaycast = false;
    }

    if (needsRaycast) {
      this.castRays(origin, facingAngle);
      this.originCache.x = origin.x;
      this.originCache.y = origin.y;
      this.facingCache = facingAngle;
      this.gridVersionCache = this.occluders.version;
      this.cacheValid = true;
      this.usedCacheLastFrame = false;
      this.trackBudget(this.lastMs);
    } else {
      this.lastMs = 0;
      this.usedCacheLastFrame = true;
    }

    this.render(facingAngle);
  }

  // ------------------------------------------------------------ chaos modulators

  getRadiusScale(): number {
    return this.radiusScale;
  }

  /**
   * Shrinks the whole field of view. Invalidates the cache: the ranges the cached rays
   * were measured against just changed, and without this the view would stay frozen
   * while the player stands still and then snap the moment they move
   * (system-chaos-scavenge-extract escalate item 5).
   */
  setRadiusScale(scale: number): void {
    const next = clamp(scale, GAME_CONSTANTS.VISIBILITY.MIN_RADIUS_SCALE, 1);
    if (next === this.radiusScale) return;
    this.radiusScale = next;
    this.cacheValid = false;
    this.subdiv2RadiiDirty = true;
  }

  /** Run-bound sight multiplies the chaos-clamped radius, including its safety floor. */
  setAbilityRadiusMultiplier(multiplier: number): void {
    if (!Number.isFinite(multiplier) || multiplier < 1) throw new Error('Invalid ability vision multiplier');
    if (this.abilityRadiusMultiplier === multiplier) return;
    this.abilityRadiusMultiplier = multiplier;
    this.cacheValid = false;
    this.subdiv2RadiiDirty = true;
  }

  /** Teal creeping in from the edge: hue shift, inward bleed and edge jitter, one knob. */
  setEdgeCorruption(level: number): void {
    const next = clamp(level, 0, 1);
    if (next === this.edgeCorruption) return;
    this.edgeCorruption = next;
  }

  /** Periodic full-screen shimmer at the highest chaos stage. */
  setScreenFlicker(intensity: number): void {
    this.screenFlicker = clamp(intensity, 0, 1);
  }

  /**
   * Sets the extraction point position for the proximity-based void noise scroll
   * acceleration. The closer the player is to extraction, the faster the noise drifts
   * (subtle spatial cue, not a compass).
   */
  setExtractionPosition(pos: Vector2): void {
    this.extractionPos = { x: pos.x, y: pos.y };
  }

  // ------------------------------------------------------------ queries

  /** A stable revision of exactly the inputs read by getVisibilityAt. Surface
   * renderers can reuse pixel queries while the player and sight are unchanged.
   * Use the committed facingCache (including degradation), not input facing. */
  getQueryRevision(): number {
    const previous = this.querySnapshot;
    if (previous.x !== this.origin.x || previous.y !== this.origin.y ||
        previous.facing !== this.facingCache || previous.radiusScale !== this.radiusScale ||
        previous.abilityScale !== this.abilityRadiusMultiplier ||
        previous.grid !== this.occluders || previous.gridVersion !== this.occluders.version ||
        previous.config !== this.config) {
      previous.x = this.origin.x; previous.y = this.origin.y; previous.facing = this.facingCache;
      previous.radiusScale = this.radiusScale; previous.abilityScale = this.abilityRadiusMultiplier;
      previous.grid = this.occluders; previous.gridVersion = this.occluders.version; previous.config = this.config;
      this.queryRevision++;
    }
    return this.queryRevision;
  }

  /** Conservative broad phase only. A surface outside the largest current
   * sight radius cannot contribute; intersections still need normal pixel LOS.
   * This never uses an enemy core, its cone direction or a tile-centre guess. */
  maySeeBounds(bounds: Readonly<{ left: number; top: number; right: number; bottom: number }>): boolean {
    const dx = Math.max(bounds.left - this.origin.x, 0, this.origin.x - bounds.right);
    const dy = Math.max(bounds.top - this.origin.y, 0, this.origin.y - bounds.bottom);
    const radius = Math.max(this.config.minSolidRadius, this.getEffectiveRadius(0), this.getEffectiveRadius(Math.PI));
    return dx * dx + dy * dy <= radius * radius;
  }

  isPointVisible(point: Vector2): boolean {
    return this.getVisibilityAt(point) > 0;
  }

  /**
   * Returns 0 | 0.2 | 0.6 | 1.0 - the render alpha an entity at `point` should use, and
   * also the authoritative answer to "can the player see this". Modulation is included,
   * so what the player sees and what the game considers visible never disagree.
   */
  getVisibilityAt(point: Vector2): number {
    const deltaX = point.x - this.origin.x;
    const deltaY = point.y - this.origin.y;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const config = this.config;

    if (dist <= config.minSolidRadius) {
      return hasLineOfSight(this.occluders, this.origin, point) ? config.bandAlphas[0] : 0;
    }

    const offset = shortestArc(Math.atan2(deltaY, deltaX) - this.facingCache);
    const range = this.getEffectiveRadius(offset);
    if (dist > range) return 0;
    if (!hasLineOfSight(this.occluders, this.origin, point, range)) return 0;

    const bandWidth = clamp((range - config.minSolidRadius) / 2, 0, config.edgeBandWidth);
    const coreEdge = Math.max(range - bandWidth * 2, config.minSolidRadius);
    if (dist <= coreEdge) return config.bandAlphas[0];
    if (dist <= range - bandWidth) return config.bandAlphas[1];
    return config.bandAlphas[2];
  }

  /**
   * Maximum sight distance for a ray `angleFromFacing` radians off the facing direction,
   * after modulation. `minSolidRadius` never scales - the player can always see their feet.
   */
  getEffectiveRadius(angleFromFacing: number): number {
    const config = this.config;
    let radius: number;

    if (config.mode === 'omni') {
      radius = config.radiusForward;
    } else {
      const theta = Math.abs(shortestArc(angleFromFacing));
      const half = degToRad(config.coneHalfAngleDeg);
      const falloff = degToRad(config.coneFalloffAngleDeg);
      if (theta <= half) {
        radius = config.radiusForward;
      } else if (theta >= half + falloff || falloff <= 0) {
        radius = config.radiusAmbient;
      } else {
        const t = (theta - half) / falloff;
        const smooth = t * t * (3 - 2 * t);
        radius = config.radiusForward + (config.radiusAmbient - config.radiusForward) * smooth;
      }
    }

    return Math.max(radius * this.radiusScale, config.minSolidRadius) * this.abilityRadiusMultiplier;
  }

  getStats(): VisibilityStats {
    const avg = this.budgetFilled > 0 ? this.budgetSum / this.budgetFilled : 0;
    return {
      rayCount: this.rayCount,
      lastMs: this.lastMs,
      avgMs: avg,
      degradeLevel: this.degradeLevel,
      cached: this.usedCacheLastFrame,
    };
  }

  /** DEV spatial terrain: carry a visible base's fog strength up only the opaque
   * landmark silhouette. The landmark stays in its ordinary ground depth, so
   * actors in front still cover it. No logical visibility or ground ray changes.
   * Call after update; the next update rebuilds the mask from scratch. */
  revealProjectedTerrain(image: Phaser.GameObjects.Image, visibility: number): void {
    if (!this.mask || visibility <= 0 || !image.visible) return;
    const alpha = image.alpha;
    image.setAlpha(clamp(visibility, 0, 1));
    try { this.mask.erase(image, image.x - this.maskOriginX, image.y - this.maskOriginY); }
    finally { image.setAlpha(alpha); }
  }

  // ------------------------------------------------------------ glow sources

  /** Slice 1 registers only the extraction point: the player should always know the way home. */
  registerGlowSource(id: string, position: Vector2, radius: number): void {
    const existing = this.glowSources.get(id);
    if (existing) {
      existing.x = position.x;
      existing.y = position.y;
      existing.radius = radius;
      return;
    }
    this.glowSources.set(id, { x: position.x, y: position.y, radius });
  }

  unregisterGlowSource(id: string): void {
    this.glowSources.delete(id);
  }

  /**
   * Clip the additive lamp and flashlight to land tiles. Warm ADD light on
   * void-black reads as a flat earth-yellow fill of "outside", which is the
   * opposite of a black hole.
   */
  clipLightsToIsland(map: TileMapData): void {
    this.lamp?.clearMask(false);
    this.flashlight?.clearMask(false);
    this.lightClipGraphics?.destroy();
    this.lightClipGraphics = null;

    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    const tile = map.tileSize;
    for (let row = 0; row < map.rows; row++) {
      const line = map.tiles[row]!;
      let run = -1;
      for (let col = 0; col <= map.cols; col++) {
        const land = col < map.cols && line[col] !== TileType.VOID;
        if (land && run < 0) run = col;
        if (!land && run >= 0) {
          graphics.fillRect(run * tile, row * tile, (col - run) * tile, tile);
          run = -1;
        }
      }
    }
    this.lightClipGraphics = graphics;
    const mask = graphics.createGeometryMask();
    this.lamp?.setMask(mask);
    this.flashlight?.setMask(mask);
  }

  destroy(): void {
    for (const graphics of this.bandGraphics) graphics.destroy();
    this.bandGraphics.length = 0;
    this.polygons.length = 0;
    this.noiseSprite?.destroy();
    this.noiseSprite = null;
    this.lamp?.clearMask(false);
    this.lamp?.destroy();
    this.lamp = null;
    this.flashlight?.clearMask(false);
    this.flashlight?.destroy();
    this.flashlight = null;
    this.lightClipGraphics?.destroy();
    this.lightClipGraphics = null;
    this.glowGraphics?.destroy();
    this.corruptionGraphics?.destroy();
    this.flicker?.destroy();
    this.mask?.destroy();
    this.glowSources.clear();
    this.subdiv2Radii = null;
    this.subdiv2Alphas = null;
  }

  // ------------------------------------------------------------ internals

  /**
   * (Re)allocates the ray and polygon buffers. Called once at create and at most once
   * more if performance degradation kicks in - never on a normal frame.
   */
  private setRayCounts(forward: number, ambient: number): void {
    this.rayCountForward = forward;
    this.rayCountAmbient = ambient;
    this.rayCount = forward + ambient;

    this.rayOffsets = new Float32Array(this.rayCount);
    this.rayRange = new Float32Array(this.rayCount);
    this.rayDist = new Float32Array(this.rayCount);

    this.allocatePolygonBuffers();

    this.buildRayOffsets();
    this.cacheValid = false;
  }

  /**
   * (Re)allocates polygon vertex buffers. Called from setRayCounts — a rare
   * event (create / performance degrade), never a normal frame.
   */
  private allocatePolygonBuffers(): void {
    const bandCount = SUBDIV2_BAND_COUNT;
    const vertexCount = this.rayCount;
    this.polygons = [];
    for (let band = 0; band < bandCount; band++) {
      const points: Vector2[] = new Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        points[i] = { x: 0, y: 0 };
      }
      this.polygons.push(points);
    }
    this.subdiv2Radii = [];
    for (let b = 0; b < bandCount; b++) this.subdiv2Radii.push(new Float32Array(this.rayCount));
    this.subdiv2RadiiDirty = true;
  }

  /**
   * Ray angles relative to the facing direction, in ascending order so the polygon is a
   * proper fan. The cone sector gets the dense allocation; the rest of the circle gets
   * the sparse one, which lands both at roughly the same arc spacing at their own range.
   */
  private buildRayOffsets(): void {
    const config = this.config;

    if (config.mode === 'omni' || this.rayCountAmbient === 0) {
      for (let i = 0; i < this.rayCount; i++) {
        this.rayOffsets[i] = -Math.PI + (TAU * i) / this.rayCount;
      }
      return;
    }

    const halfSpan = degToRad(config.coneHalfAngleDeg + config.coneFalloffAngleDeg);
    const forward = this.rayCountForward;
    for (let i = 0; i < forward; i++) {
      this.rayOffsets[i] = -halfSpan + (2 * halfSpan * i) / (forward - 1);
    }

    const ambientSpan = TAU - 2 * halfSpan;
    const step = ambientSpan / (this.rayCountAmbient + 1);
    for (let i = 0; i < this.rayCountAmbient; i++) {
      this.rayOffsets[forward + i] = halfSpan + step * (i + 1);
    }
  }

  private castRays(origin: Vector2, facingAngle: number): void {
    const start = performance.now();

    // If a distance override is provided (e.g. purification blob boundary),
    // bypass grid raycasting entirely for a smooth polygon.
    const override = this.config.rayDistanceOverride;
    if (override) {
      for (let i = 0; i < this.rayCount; i++) {
        const offset = this.rayOffsets[i]!;
        const range = this.getEffectiveRadius(offset);
        this.rayRange[i] = range;
        const dist = override(origin, facingAngle + offset, range);
        this.rayDist[i] = Math.min(Math.max(dist, MIN_HIT_DIST), range);
      }
      this.lastMs = performance.now() - start;
      return;
    }

    const tileSize = this.occluders.tileSize;
    const insideWall = this.occluders.isOpaque(
      Math.floor(origin.x / tileSize),
      Math.floor(origin.y / tileSize)
    );

    if (insideWall) {
      if (import.meta.env.DEV && !this.warnedOriginInWall) {
        this.warnedOriginInWall = true;
        console.warn('[VisibilitySystem] vision origin is inside a wall; falling back to a solid disc');
      }
      for (let i = 0; i < this.rayCount; i++) {
        this.rayRange[i] = this.config.minSolidRadius;
        this.rayDist[i] = this.config.minSolidRadius;
      }
      this.lastMs = performance.now() - start;
      return;
    }

    for (let i = 0; i < this.rayCount; i++) {
      const offset = this.rayOffsets[i]!;
      const range = this.getEffectiveRadius(offset);
      this.rayRange[i] = range;
      castRay(this.occluders, origin, facingAngle + offset, range, this.hit);
      this.rayDist[i] = this.hit.hit ? Math.min(Math.max(this.hit.dist, MIN_HIT_DIST), range) : range;
    }

    this.lastMs = performance.now() - start;
  }

  private trackBudget(ms: number): void {
    const window = this.budgetSamples.length;
    if (this.budgetFilled === window) {
      this.budgetSum -= this.budgetSamples[this.budgetIndex]!;
    } else {
      this.budgetFilled++;
    }
    this.budgetSamples[this.budgetIndex] = ms;
    this.budgetSum += ms;
    this.budgetIndex = (this.budgetIndex + 1) % window;

    if (this.budgetFilled < window || this.degradeLevel >= 2) return;
    if (this.budgetSum / window <= GAME_CONSTANTS.VISIBILITY.BUDGET_MS) return;

    this.degradeLevel++;
    this.budgetFilled = 0;
    this.budgetSum = 0;
    this.budgetIndex = 0;
    if (this.degradeLevel === 1) {
      const v = GAME_CONSTANTS.VISIBILITY;
      this.setRayCounts(v.RAY_SPLIT_FORWARD_DEGRADED, v.RAY_SPLIT_AMBIENT_DEGRADED);
    }
    if (import.meta.env.DEV) {
      console.warn(`[VisibilitySystem] over budget, degrading to level ${this.degradeLevel}`);
    }
  }

  private render(facingAngle: number): void {
    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    // worldView is refreshed during camera pre-render, so it lags by one frame; the two
    // tiles of padding absorb that (the camera moves at most a few px per frame).
    const viewX = view.width > 0 ? view.x : camera.scrollX + camera.width * 0.5 - this.maskWidth * 0.5;
    const viewY =
      view.height > 0 ? view.y : camera.scrollY + camera.height * 0.5 - this.maskHeight * 0.5;

    this.maskOriginX = Math.floor(viewX) - this.padding;
    this.maskOriginY = Math.floor(viewY) - this.padding;
    this.mask.setPosition(this.maskOriginX, this.maskOriginY);
    this.flicker.setPosition(this.maskOriginX, this.maskOriginY);

    this.buildPolygons(facingAngle);
    this.drawMask();
    this.drawLamp();
    this.drawFlashlight(facingAngle);
    this.drawCorruption(facingAngle);
    this.drawGlowSources();
    this.drawFlicker();
  }

  /**
   * Band radii are measured inward from each ray's *range*, not from where it hit.
   * Basing them on the hit distance would squeeze the whole gradient into one tile
   * whenever a wall is close, drawing an inexplicable dark ring around the player's feet.
   */
  private buildPolygons(facingAngle: number): void {
    const config = this.config;
    const corruption = this.edgeCorruption;
    const v = GAME_CONSTANTS.VISIBILITY;
    const jitterAmplitude =
      v.CORRUPTION_JITTER_PX * corruption * (1 + v.OVERFLOW_JITTER_BOOST * this.screenFlicker);
    const jitterPhase = (this.elapsedMs / 1000) * v.CORRUPTION_JITTER_HZ * TAU;

    const bandCount = this.polygons.length;
    this.ensureSubdiv2Radii();

    for (let i = 0; i < this.rayCount; i++) {
      const angle = facingAngle + this.rayOffsets[i]!;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const range = this.rayRange[i]!;
      const hitDist = this.rayDist[i]!;

      const jitter = jitterAmplitude > 0 ? Math.sin(jitterPhase + i * 0.7) * jitterAmplitude : 0;
      const outer = Math.max(range + jitter, config.minSolidRadius);

      const radii = this.subdiv2Radii;
      if (!radii) continue;
      for (let band = 0; band < bandCount; band++) {
        const rho = band === bandCount - 1 ? outer : radii[band]![i]!;
        this.writePoint(this.polygons[band]!, i, cos, sin, Math.min(hitDist, rho));
      }
    }
  }

  private writePoint(
    points: Array<Vector2>,
    index: number,
    cos: number,
    sin: number,
    radius: number
  ): void {
    const point = points[index]!;
    point.x = this.origin.x + cos * radius - this.maskOriginX;
    point.y = this.origin.y + sin * radius - this.maskOriginY;
  }

  private drawMask(): void {
    const config = this.config;

    this.mask.clear();
    this.mask.fill(config.voidColor, 1);

    if (this.noiseSprite) {
      // Proximity-based scroll acceleration: noise drifts faster near the extraction point.
      const baseSpeed = GAME_CONSTANTS.VISIBILITY.VOID_NOISE_SCROLL;
      let scrollSpeed = baseSpeed;
      if (this.extractionPos) {
        const tileSize = this.occluders.tileSize;
        const dx = this.origin.x - this.extractionPos.x;
        const dy = this.origin.y - this.extractionPos.y;
        const distTiles = Math.sqrt(dx * dx + dy * dy) / tileSize;
        // Lerp: full effect below 5 tiles, no effect beyond 40 tiles.
        const proximityFactor = clamp(1 - (distTiles - 5) / 35, 0, 1);
        scrollSpeed = baseSpeed * (1 + proximityFactor);
      }
      const scroll = (this.elapsedMs / 1000) * scrollSpeed;
      this.noiseSprite.tilePositionX = scroll;
      this.noiseSprite.tilePositionY = scroll * VOID_NOISE_SCROLL_Y_RATIO;
      this.mask.draw(this.noiseSprite, 0, 0);
    }

    this.drawSubdiv2Bands();
  }

  /** Pre-allocated to SUBDIV2_BAND_COUNT in create(); grows only if a degrade reallocates. */
  private bandGraphicsAt(index: number): Phaser.GameObjects.Graphics {
    while (this.bandGraphics.length <= index) {
      this.bandGraphics.push(this.scene.make.graphics({}, false));
    }
    return this.bandGraphics[index]!;
  }

  /**
   * Per-ray isolux band radii, rebuilt only when ray counts or radiusScale
   * change. Reads `rayRange`, so it must run after `castRays` on rebuild
   * frames — buildPolygons is always after it.
   */
  private ensureSubdiv2Radii(): void {
    if (!this.subdiv2RadiiDirty || !this.subdiv2Radii) return;
    const config = this.config;
    const omni = config.mode === 'omni';
    computeFieldBandRadii(SUBDIV2_LEVELS, this.rayOffsets, this.rayRange, {
      radiusForward: Math.max(config.radiusForward * this.radiusScale, config.minSolidRadius) * this.abilityRadiusMultiplier,
      radiusAmbient: Math.max(config.radiusAmbient * this.radiusScale, config.minSolidRadius) * this.abilityRadiusMultiplier,
      coneHalfAngleDeg: omni ? 180 : config.coneHalfAngleDeg,
      coneFalloffAngleDeg: omni ? 0 : config.coneFalloffAngleDeg,
    }, SUBDIV2_BAND_FLOOR_PX, this.subdiv2Radii);
    this.subdiv2RadiiDirty = false;
  }

  /** Production mask: 32 nested isolux bands. */
  private drawSubdiv2Bands(): void {
    if (!this.subdiv2Alphas) {
      this.subdiv2Alphas = computeLevelEraseAlphas(SUBDIV2_LEVELS);
    }
    this.drawBandStack(this.subdiv2Alphas);
  }

  /** Outermost first: erases compound to the target zone visibilities. */
  private drawBandStack(alphas: Float32Array): void {
    for (let band = alphas.length - 1; band >= 0; band--) {
      const graphics = this.bandGraphicsAt(band);
      graphics.clear();
      graphics.fillStyle(0xffffff, alphas[band]!);
      graphics.fillPoints(this.polygons[band]!, true);
      this.mask.erase(graphics);
    }
  }

  /**
   * The warm lamp sits below the mask so the vision boundary clips it, instead of the
   * glow shining through the darkness.
   */
  private drawLamp(): void {
    if (!this.lamp) return;
    // Sized to the ambient range (directly behind the player), so the lamp reads as the
    // 360-degree pool of warmth rather than following the cone.
    const diameter = this.getEffectiveRadius(Math.PI) * 2;
    this.lamp.setPosition(this.origin.x, this.origin.y);
    this.lamp.setDisplaySize(diameter, diameter);
  }

  /**
   * The flashlight beam: a warm additive pool pushed forward along the facing direction and
   * sized to the forward range. It is drawn under the darkness mask, so the cone-shaped hole
   * in the mask clips the round pool into a beam - the forward cone reads as *lit*, not just
   * *revealed*. Follows the range modulation so a chaos-shrunk view dims its own light.
   */
  private drawFlashlight(facingAngle: number): void {
    if (!this.flashlight) return;
    const v = GAME_CONSTANTS.VISIBILITY;
    const forward = this.getEffectiveRadius(0);
    const push = forward * v.FLASHLIGHT_FORWARD_FRAC;
    const diameter = forward * 2 * v.FLASHLIGHT_RADIUS_FRAC;
    this.flashlight.setPosition(
      this.origin.x + Math.cos(facingAngle) * push,
      this.origin.y + Math.sin(facingAngle) * push
    );
    this.flashlight.setDisplaySize(
      diameter * FLASHLIGHT_POOL_STRETCH_ALONG,
      diameter * FLASHLIGHT_POOL_STRETCH_ACROSS
    );
    this.flashlight.setRotation(facingAngle);
  }

  /** Teal eating into the outer part of the field of view, driven entirely by `edgeCorruption`. */
  private drawCorruption(facingAngle: number): void {
    const graphics = this.corruptionGraphics;
    graphics.clear();
    if (this.edgeCorruption <= 0) return;

    const v = GAME_CONSTANTS.VISIBILITY;

    const depthFraction =
      v.CORRUPTION_MAX_DEPTH *
      this.edgeCorruption *
      (1 + v.OVERFLOW_CORRUPTION_DEPTH_BOOST * this.screenFlicker);

    const rings = CORRUPTION_SOFT_RINGS;
    const color = mixRgb(v.CORRUPTION_COLOR, this.config.voidColor, CORRUPTION_SOFT_VOID_MIX);
    const capScale = CORRUPTION_SOFT_PEAK_SCALE;

    for (let ring = 0; ring < rings; ring++) {
      const f0 = ring / rings;
      const f1 = (ring + 1) / rings;
      const alphaScale = corruptionSoftProfile((ring + 0.5) / rings, CORRUPTION_SOFT_PEAK_T);
      graphics.fillStyle(
        color,
        v.CORRUPTION_MAX_MIX * this.edgeCorruption * capScale * alphaScale
      );

      for (let i = 0; i < this.rayCount; i++) {
        const next = (i + 1) % this.rayCount;
        const innerA = this.corruptionInner(i, depthFraction);
        const innerB = this.corruptionInner(next, depthFraction);
        const outerA = Math.min(this.rayDist[i]!, this.rayRange[i]!);
        const outerB = Math.min(this.rayDist[next]!, this.rayRange[next]!);
        if (outerA <= innerA && outerB <= innerB) continue;

        const spanA = Math.max(outerA - innerA, 0) + (outerA > innerA ? CORRUPTION_SOFT_TAIL_PX : 0);
        const spanB = Math.max(outerB - innerB, 0) + (outerB > innerB ? CORRUPTION_SOFT_TAIL_PX : 0);

        const a0 = innerA + spanA * f0;
        const a1 = innerA + spanA * f1;
        const b0 = innerB + spanB * f0;
        const b1 = innerB + spanB * f1;

        const angleA = facingAngle + this.rayOffsets[i]!;
        const angleB = facingAngle + this.rayOffsets[next]!;
        const cosA = Math.cos(angleA);
        const sinA = Math.sin(angleA);
        const cosB = Math.cos(angleB);
        const sinB = Math.sin(angleB);

        graphics.beginPath();
        graphics.moveTo(this.origin.x + cosA * a0, this.origin.y + sinA * a0);
        graphics.lineTo(this.origin.x + cosA * a1, this.origin.y + sinA * a1);
        graphics.lineTo(this.origin.x + cosB * b1, this.origin.y + sinB * b1);
        graphics.lineTo(this.origin.x + cosB * b0, this.origin.y + sinB * b0);
        graphics.closePath();
        graphics.fillPath();
      }
    }
  }

  private corruptionInner(index: number, depthFraction: number): number {
    const range = this.rayRange[index]!;
    const inner = Math.max(range * (1 - depthFraction), this.config.minSolidRadius);
    return Math.min(this.rayDist[index]!, inner);
  }

  private drawGlowSources(): void {
    const graphics = this.glowGraphics;
    graphics.clear();
    if (this.glowSources.size === 0) return;

    const v = GAME_CONSTANTS.VISIBILITY;
    graphics.fillStyle(0xffffff, v.GLOW_LEAK_ALPHA);
    for (const source of this.glowSources.values()) {
      graphics.fillCircle(source.x, source.y, source.radius);
    }
  }

  private drawFlicker(): void {
    if (this.screenFlicker <= 0) {
      if (this.flicker.alpha !== 0) this.flicker.setAlpha(0);
      return;
    }
    const v = GAME_CONSTANTS.VISIBILITY;
    const t = this.elapsedMs % v.FLICKER_JUMP_PERIOD_MS;
    const inJump = t < v.FLICKER_JUMP_WIDTH_MS;
    const jump = inJump ? Math.sin((t / v.FLICKER_JUMP_WIDTH_MS) * Math.PI) : 0;
    const base = v.FLICKER_BASE_ALPHA * this.screenFlicker;
    const peak = v.FLICKER_JUMP_ALPHA * this.screenFlicker;
    this.flicker.setAlpha(base + (peak - base) * jump);
  }
}

// ---------------------------------------------------------------------------
// Code-drawn textures (art-direction section 8.2: lighting is generated, not authored)
// ---------------------------------------------------------------------------

const NOISE_TEXTURE_KEY = 'vision-void-noise';
const LAMP_TEXTURE_KEY = 'vision-player-lamp';
const FLASHLIGHT_TEXTURE_KEY = 'vision-flashlight';

/**
 * A tileable noise patch. The void is not "nothing loaded yet" - it is space the player
 * cannot see into, and a barely-there drifting grain is what says so.
 */
function ensureNoiseTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(NOISE_TEXTURE_KEY)) return NOISE_TEXTURE_KEY;

  const size = GAME_CONSTANTS.VISIBILITY.VOID_NOISE_TILE;
  const canvas = scene.textures.createCanvas(NOISE_TEXTURE_KEY, size, size);
  if (!canvas) return null;

  const context = canvas.getContext();
  const image = context.createImageData(size, size);
  fillVoidNoise(image.data, size, Math.random);
  context.putImageData(image, 0, 0);
  canvas.refresh();
  return NOISE_TEXTURE_KEY;
}

function applyRadialStops(
  context: CanvasRenderingContext2D,
  size: number,
  rgb: { r: number; g: number; b: number },
  stops: ReadonlyArray<readonly [number, number]>
): void {
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  for (const [t, alpha] of stops) {
    gradient.addColorStop(t, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
}

/** Radial warm falloff for the lamp the player carries. */
function ensureLampTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(LAMP_TEXTURE_KEY)) return LAMP_TEXTURE_KEY;

  const size = 256;
  const canvas = scene.textures.createCanvas(LAMP_TEXTURE_KEY, size, size);
  if (!canvas) return null;

  const color = Phaser.Display.Color.IntegerToRGB(GAME_CONSTANTS.VISIBILITY.PLAYER_LAMP_COLOR);
  applyRadialStops(canvas.getContext(), size, color, LAMP_ALPHA_STOPS);
  canvas.refresh();
  return LAMP_TEXTURE_KEY;
}

/**
 * Warm radial falloff for the flashlight pool. Hot core, fast mid falloff, long tail;
 * the cone mask still clips it into a beam. Stretched along facing at draw time.
 */
function ensureFlashlightTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(FLASHLIGHT_TEXTURE_KEY)) return FLASHLIGHT_TEXTURE_KEY;

  const size = 256;
  const canvas = scene.textures.createCanvas(FLASHLIGHT_TEXTURE_KEY, size, size);
  if (!canvas) return null;

  const color = Phaser.Display.Color.IntegerToRGB(GAME_CONSTANTS.VISIBILITY.FLASHLIGHT_COLOR);
  applyRadialStops(canvas.getContext(), size, color, FLASHLIGHT_ALPHA_STOPS);
  canvas.refresh();
  return FLASHLIGHT_TEXTURE_KEY;
}

/** Normalises an angle to [-PI, PI]. */
function shortestArc(angle: number): number {
  let result = angle;
  while (result > Math.PI) result -= TAU;
  while (result < -Math.PI) result += TAU;
  return result;
}
