/**
 * VisibilitySystem - the limited field of view.
 *
 * Self-implemented raycasting (architecture DEC-ARCH-004) producing a forward cone
 * unioned with an ambient ring, three fixed-width alpha bands at the edge, and
 * void-black plus drifting noise everywhere else. Shared by the rift and the
 * purification point; the only difference between them is `VisionConfig`
 * (docs/specs/system-movement-vision.md, section V).
 *
 * Rendering: a world-space RenderTexture the size of the camera view plus two tiles of
 * padding is filled with void-black, then the three visibility polygons are erased out
 * of it at 1.00 / 0.50 / 0.20, leaving residual darkness of 0 / 0.40 / 0.80 - i.e.
 * visibility 1.00 / 0.60 / 0.20. Keeping the mask at world resolution (rather than
 * screen resolution) means its edges land on whole world pixels, which is what the
 * pixel-art look needs.
 *
 * Performance: rays are only cast when the player has moved, turned, the grid changed,
 * or a chaos modulator changed the range. Everything else is pre-allocated - the update
 * path allocates nothing.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { Vector2 } from '@/types/game-types';
import type { OccluderGrid } from '@/types/map-types';
import { castRay, createRayHit, hasLineOfSight, type RayHit } from '@/utils/grid-raycast';
import { clamp, degToRad } from '@/utils/math';

const TAU = Math.PI * 2;

/** Floor on a hit distance, so a wall against the player's face cannot degenerate the polygon. */
const MIN_HIT_DIST = 4;

export type VisionMode = 'cone' | 'omni';

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

  private maskWidth = 0;
  private maskHeight = 0;
  private padding = 0;
  private maskOriginX = 0;
  private maskOriginY = 0;

  // --- runtime modulation ---
  private radiusScale = 1;
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

    for (let band = 0; band < 3; band++) {
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
  }

  /** Teal creeping in from the edge: hue shift, inward bleed and edge jitter, one knob. */
  setEdgeCorruption(level: number): void {
    this.edgeCorruption = clamp(level, 0, 1);
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

    return Math.max(radius * this.radiusScale, config.minSolidRadius);
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

  destroy(): void {
    for (const graphics of this.bandGraphics) graphics.destroy();
    this.bandGraphics.length = 0;
    this.polygons.length = 0;
    this.noiseSprite?.destroy();
    this.noiseSprite = null;
    this.lamp?.destroy();
    this.lamp = null;
    this.flashlight?.destroy();
    this.flashlight = null;
    this.glowGraphics?.destroy();
    this.corruptionGraphics?.destroy();
    this.flicker?.destroy();
    this.mask?.destroy();
    this.glowSources.clear();
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

    this.polygons = [];
    for (let band = 0; band < 3; band++) {
      const points: Vector2[] = new Array(this.rayCount);
      for (let i = 0; i < this.rayCount; i++) points[i] = { x: 0, y: 0 };
      this.polygons.push(points);
    }

    this.buildRayOffsets();
    this.cacheValid = false;
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
    const jitterAmplitude = GAME_CONSTANTS.VISIBILITY.CORRUPTION_JITTER_PX * corruption;
    const jitterPhase = (this.elapsedMs / 1000) * GAME_CONSTANTS.VISIBILITY.CORRUPTION_JITTER_HZ * TAU;

    for (let i = 0; i < this.rayCount; i++) {
      const angle = facingAngle + this.rayOffsets[i]!;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const range = this.rayRange[i]!;
      const hitDist = this.rayDist[i]!;

      const jitter = jitterAmplitude > 0 ? Math.sin(jitterPhase + i * 0.7) * jitterAmplitude : 0;
      const outer = Math.max(range + jitter, config.minSolidRadius);
      const bandWidth = clamp((range - config.minSolidRadius) / 2, 0, config.edgeBandWidth);

      const core = Math.max(outer - bandWidth * 2, config.minSolidRadius);
      const middle = Math.max(outer - bandWidth, core);
      const radii0 = Math.min(hitDist, core);
      const radii1 = Math.min(hitDist, middle);
      const radii2 = Math.min(hitDist, outer);

      this.writePoint(0, i, cos, sin, radii0);
      this.writePoint(1, i, cos, sin, radii1);
      this.writePoint(2, i, cos, sin, radii2);
    }
  }

  private writePoint(band: number, index: number, cos: number, sin: number, radius: number): void {
    const point = this.polygons[band]![index]!;
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
      this.noiseSprite.tilePositionY = scroll;
      this.mask.draw(this.noiseSprite, 0, 0);
    }

    // Outer band first, core last: the erases compound to 0.80 / 0.40 / 0 darkness.
    for (let band = 2; band >= 0; band--) {
      const graphics = this.bandGraphics[band]!;
      graphics.clear();
      graphics.fillStyle(0xffffff, config.eraseAlphas[band]!);
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
    this.flashlight.setDisplaySize(diameter, diameter);
  }

  /** Teal eating into the outer part of the field of view, driven entirely by `edgeCorruption`. */
  private drawCorruption(facingAngle: number): void {
    const graphics = this.corruptionGraphics;
    graphics.clear();
    if (this.edgeCorruption <= 0) return;

    const v = GAME_CONSTANTS.VISIBILITY;
    const depthFraction = v.CORRUPTION_MAX_DEPTH * this.edgeCorruption;
    graphics.fillStyle(v.CORRUPTION_COLOR, v.CORRUPTION_MAX_MIX * this.edgeCorruption);

    for (let i = 0; i < this.rayCount; i++) {
      const next = (i + 1) % this.rayCount;
      const innerA = this.corruptionInner(i, depthFraction);
      const innerB = this.corruptionInner(next, depthFraction);
      const outerA = Math.min(this.rayDist[i]!, this.rayRange[i]!);
      const outerB = Math.min(this.rayDist[next]!, this.rayRange[next]!);
      if (outerA <= innerA && outerB <= innerB) continue;

      const angleA = facingAngle + this.rayOffsets[i]!;
      const angleB = facingAngle + this.rayOffsets[next]!;
      const cosA = Math.cos(angleA);
      const sinA = Math.sin(angleA);
      const cosB = Math.cos(angleB);
      const sinB = Math.sin(angleB);

      graphics.beginPath();
      graphics.moveTo(this.origin.x + cosA * innerA, this.origin.y + sinA * innerA);
      graphics.lineTo(this.origin.x + cosA * outerA, this.origin.y + sinA * outerA);
      graphics.lineTo(this.origin.x + cosB * outerB, this.origin.y + sinB * outerB);
      graphics.lineTo(this.origin.x + cosB * innerB, this.origin.y + sinB * innerB);
      graphics.closePath();
      graphics.fillPath();
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
    const phase = (this.elapsedMs % v.FLICKER_PERIOD_MS) / v.FLICKER_PERIOD_MS;
    const pulse = 0.5 - 0.5 * Math.cos(phase * TAU);
    this.flicker.setAlpha(v.FLICKER_MAX_ALPHA * this.screenFlicker * pulse);
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
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const lit = Math.random() < 0.3;
    const value = lit ? 140 + Math.floor(Math.random() * 115) : 0;
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
    pixels[i + 3] = lit ? 255 : 0;
  }
  context.putImageData(image, 0, 0);
  canvas.refresh();
  return NOISE_TEXTURE_KEY;
}

/** Radial warm falloff for the lamp the player carries. */
function ensureLampTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(LAMP_TEXTURE_KEY)) return LAMP_TEXTURE_KEY;

  const size = 256;
  const half = size / 2;
  const canvas = scene.textures.createCanvas(LAMP_TEXTURE_KEY, size, size);
  if (!canvas) return null;

  const color = Phaser.Display.Color.IntegerToRGB(GAME_CONSTANTS.VISIBILITY.PLAYER_LAMP_COLOR);
  const context = canvas.getContext();
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},1)`);
  gradient.addColorStop(0.6, `rgba(${color.r},${color.g},${color.b},0.45)`);
  gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  canvas.refresh();
  return LAMP_TEXTURE_KEY;
}

/**
 * Warm radial falloff for the flashlight pool. Brighter and tighter in the centre than the
 * lamp so that, once clipped to the cone by the mask, it reads as a directed beam.
 */
function ensureFlashlightTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(FLASHLIGHT_TEXTURE_KEY)) return FLASHLIGHT_TEXTURE_KEY;

  const size = 256;
  const half = size / 2;
  const canvas = scene.textures.createCanvas(FLASHLIGHT_TEXTURE_KEY, size, size);
  if (!canvas) return null;

  const color = Phaser.Display.Color.IntegerToRGB(GAME_CONSTANTS.VISIBILITY.FLASHLIGHT_COLOR);
  const context = canvas.getContext();
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},1)`);
  gradient.addColorStop(0.45, `rgba(${color.r},${color.g},${color.b},0.55)`);
  gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
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
