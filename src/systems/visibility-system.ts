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
 * of it at 1.00 / 0.50 / 0.20 (solid fill shrunk 1px on range edges, plus a 2px
 * world-pinned checker ring), leaving residual darkness of 0 / 0.40 / 0.80 - i.e.
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
import { TileType, type Vector2 } from '@/types/game-types';
import type { OccluderGrid, TileMapData } from '@/types/map-types';
import { castRay, createRayHit, hasLineOfSight, type RayHit } from '@/utils/grid-raycast';
import { clamp, degToRad } from '@/utils/math';
import {
  BAYER_PHASE_COUNT,
  BAYER_PHASE_MS,
  BAYER_SLOPE_INSET,
  BAYER_SLOPE_KEEPS,
  BAYER_SLOPE_RING_WIDTH,
  computeNestedEraseAlphas,
  FIELD_LAMP_DIM_STOPS,
  FIELD_LAMP_STOPS,
  FIELD_STENCIL_RAY_COUNT,
  fieldIsoluxRadius,
  fillBayerPunch,
  fillDitherPunch,
  fillVisionField,
  fillVoidNoise,
  FLASHLIGHT_ALPHA_STOPS,
  FLASHLIGHT_POOL_STRETCH_ALONG,
  FLASHLIGHT_POOL_STRETCH_ACROSS,
  LAMP_ALPHA_STOPS,
  SUBDIV_BAND_COUNT,
  SUBDIV_PROFILE_STOPS,
  VISION_FIELD_SIZE,
  VOID_NOISE_SCROLL_Y_RATIO,
} from '@/systems/vision-textures';

const TAU = Math.PI * 2;

/** Floor on a hit distance, so a wall against the player's face cannot degenerate the polygon. */
const MIN_HIT_DIST = 4;

export type VisionMode = 'cone' | 'omni';

/**
 * Mask render styles. `bands` is the production default (three stepped bands with a
 * 2px checker ring); the rest are smooth-mask spike candidates compared live in the
 * gym `vision-lab` lesson. All styles share the same rays, ranges and wall
 * truncation - only the darkness profile rendering differs. `field` and `field-dim`
 * are the round-2 intensity-layered light fields (weak lamp × strong flashlight);
 * they differ only in how weak the lamp is.
 */
export type VisionMaskStyle = 'bands' | 'subdiv' | 'field' | 'field-dim' | 'bayer';

/** Teal corruption inner edge: `hard` is production; `soft` is a spike candidate. */
export type CorruptionEdgeStyle = 'hard' | 'soft';

/**
 * Soft corruption v3 (I9-LAB round 3): concentric sub-rings under a piecewise
 * smoothstep bump - both ends land on EXACTLY 0 with zero slope (the v2 sine tent
 * left a 13% alpha hard line at its outermost ring). The gradient also extends
 * past the vision outline into the void by CORRUPTION_SOFT_TAIL_PX, so the teal
 * reads as seeping out of the darkness rather than stopping at a contour.
 * v3 remains the soft path for bands/subdiv/bayer (rejected candidates, frozen).
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
 * Soft corruption v4 / isolux (I9-LAB round 4, field modes only): the front pins
 * to the light field's isolux contour instead of the geometric cone+ring outline,
 * so the anisotropic light (strong flashlight ahead, weak lamp behind) holds the
 * corruption off where it is strong and lets it seep in where it is weak.
 */
/** v4: ring count - denser than v3, the inner falloff gets ~11 rings. */
const CORRUPTION_ISO_RINGS = 24;
/** v4: band geometry around the contour - soft rise toward the player, long tail into the void. */
const CORRUPTION_ISO_INNER_PX = 40;
const CORRUPTION_ISO_TAIL_PX = 48;
/**
 * v5 (I9-LAB5 F3): circular box-blur of the isolux front, in rays. Radius 1–2,
 * 1–2 passes; both at the upper end so a 51/182 wall-corner jump is rounded
 * before the ring quads are built. After blur the front is re-clamped to the
 * stencil so smoothing cannot push it through a wall.
 */
const CORRUPTION_ISO_FRONT_BLUR_RADIUS = 2;
const CORRUPTION_ISO_FRONT_BLUR_PASSES = 2;
/**
 * I9-LAB6: last pixels before a wall/land edge. Ring alpha smoothsteps to 0
 * across this window so teal does not pile up on the occluder face.
 */
const CORRUPTION_ISO_WALL_FADE_PX = 24;
/** v4: chaos -> isolux threshold. t = SCALE x corruption (x flicker boost), clamped. */
const CORRUPTION_ISO_THRESHOLD_SCALE = 0.9;
const CORRUPTION_ISO_THRESHOLD_MAX = 0.95;
/**
 * v4 (a: too dense/green/bright): the soft branch derives its own color - the
 * production teal mixed toward the void color - and a lower peak scale.
 * CORRUPTION_COLOR itself (production hard edge) is untouched.
 */
const CORRUPTION_SOFT_VOID_MIX = 0.4;
const CORRUPTION_SOFT_PEAK_SCALE = 0.7;

/**
 * Piecewise-smoothstep bump on [0, 1]: exactly 0 at both ends with zero slope,
 * exactly 1 at `peakT`. Zero slope at the ends keeps the first and last ring
 * alphas tiny, which is where the eye is most sensitive to a hard step.
 */
/** Smoothstep 0→1 on [0, 1]; clamps outside. No allocation. */
function smoothstep01(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * 1 when `radius` is at least `fadePx` inside the wall distance, 0 when it
 * has reached the wall. Isolux rings use this so teal dies in front of a face.
 */
function wallProximityFade(radius: number, wallDist: number, fadePx: number): number {
  const remaining = wallDist - radius;
  if (remaining >= fadePx) return 1;
  if (remaining <= 0) return 0;
  return smoothstep01(remaining / fadePx);
}

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
  /** Same vertices pulled in 1px on range-edge rays (dither ring occupies that pixel). */
  private shrunkPolygons: Array<Array<Vector2>> = [];
  /** 1 if ray i of band k reached the range (not a wall). Length = rayCount * 3. */
  private rangeEdge = new Uint8Array(0);

  // --- render objects ---
  private mask!: Phaser.GameObjects.RenderTexture;
  private bandGraphics: Phaser.GameObjects.Graphics[] = [];
  private noiseSprite: Phaser.GameObjects.TileSprite | null = null;
  private lamp: Phaser.GameObjects.Image | null = null;
  private flashlight: Phaser.GameObjects.Image | null = null;
  private glowGraphics!: Phaser.GameObjects.Graphics;
  private corruptionGraphics!: Phaser.GameObjects.Graphics;
  /**
   * v5 (I9-LAB5 F2): hidden stencil polygon used as a GeometryMask on the
   * isolux corruption layer. Same 360-degree wall-truncated fan as the field
   * mask (`castFieldStencil` / `drawFieldMask`); larger than the lit region so
   * the dark-side tail still seeps out of the void.
   */
  private corruptionClipGraphics: Phaser.GameObjects.Graphics | null = null;
  private corruptionClipMask: Phaser.Display.Masks.GeometryMask | null = null;
  private flicker!: Phaser.GameObjects.Rectangle;
  /** Island stencil so the warm lamp/beam cannot paint void as tan. */
  private lightClipGraphics: Phaser.GameObjects.Graphics | null = null;
  /** 2px range-edge ring, reused; never added to the display list. */
  private ditherRingGraphics: Phaser.GameObjects.Graphics | null = null;
  /** World-pinned 2×2 punch tile (checker-off cells are white). */
  private ditherPunch: Phaser.GameObjects.TileSprite | null = null;
  /** Scratch RT for ring ∩ checker. Allocated once in create(). */
  private ditherScratch: Phaser.GameObjects.RenderTexture | null = null;

  // --- smooth-mask spike state (gym vision-lab; `bands` default never touches these) ---
  private maskStyle: VisionMaskStyle = 'bands';
  private corruptionEdge: CorruptionEdgeStyle = 'hard';
  private subdivAlphas: Float32Array | null = null;
  private fieldImage: Phaser.GameObjects.Image | null = null;
  private fieldScratch: Phaser.GameObjects.RenderTexture | null = null;
  private stencilScratch: Phaser.GameObjects.RenderTexture | null = null;
  private bayerPunches: Array<Phaser.GameObjects.TileSprite | null> = [null, null, null];
  /**
   * Field v3: wall-hit distances for the 360-degree full-range stencil fan. The fan
   * only truncates at walls; the baked texture owns the whole light shape, so the
   * old cone+ring outline (which shrinks across the falloff shoulder) can no longer
   * slice the field at 0.2-0.5 alpha into a hard polygon edge.
   */
  private stencilDist = new Float32Array(0);
  private stencilRange = 0;
  /** Teal v4: per-fan-ray isolux front radius (wall-clamped), refreshed per frame. */
  private corruptionFront = new Float32Array(0);
  /** v5 F3: preallocated scratch for the circular box-blur of `corruptionFront`. */
  private corruptionFrontScratch = new Float32Array(0);

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

    this.ditherRingGraphics = scene.make.graphics({}, false);
    const punchKey = ensureDitherPunchTexture(scene);
    if (punchKey) {
      this.ditherPunch = scene.make.tileSprite(
        { x: 0, y: 0, width: this.maskWidth, height: this.maskHeight, key: punchKey },
        false
      );
      this.ditherPunch.setOrigin(0, 0);
    }
    this.ditherScratch = scene.make.renderTexture(
      { x: 0, y: 0, width: this.maskWidth, height: this.maskHeight },
      false
    );
    this.ditherScratch.setOrigin(0, 0);
    this.ditherScratch.setVisible(false);
    this.ditherScratch.removeFromDisplayList();

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

    // Scene re-entry while a spike style is active: the textures survived (global
    // manager) but the unlisted game objects were destroyed with the scene.
    if (isFieldStyle(this.maskStyle)) this.ensureFieldObjects();
    if (this.maskStyle === 'bayer') this.ensureBayerPunches();
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
      if (isFieldStyle(this.maskStyle)) {
        const stencilStart = performance.now();
        this.castFieldStencil(origin, facingAngle);
        this.lastMs += performance.now() - stencilStart;
      }
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
   * Spike hook (gym vision-lab): switch the mask render style at runtime. Rays,
   * ranges and getVisibilityAt are untouched; only the darkness profile rendering
   * changes. Buffer reallocation happens here, on the keypress, never per frame.
   */
  setMaskStyle(style: VisionMaskStyle): void {
    if (style === this.maskStyle) return;
    this.maskStyle = style;
    this.allocatePolygonBuffers();
    if (isFieldStyle(style)) this.ensureFieldObjects();
    if (style === 'bayer') this.ensureBayerPunches();
    // Force a recast: the field stencil fan must exist even if the player never moves.
    this.cacheValid = false;
  }

  /** Spike hook (gym vision-lab): hard vs soft teal corruption inner edge. */
  setCorruptionEdge(style: CorruptionEdgeStyle): void {
    this.corruptionEdge = style;
  }

  getMaskStyle(): VisionMaskStyle {
    return this.maskStyle;
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
    this.shrunkPolygons.length = 0;
    this.ditherRingGraphics?.destroy();
    this.ditherRingGraphics = null;
    this.ditherPunch?.destroy();
    this.ditherPunch = null;
    this.ditherScratch?.destroy();
    this.ditherScratch = null;
    this.fieldImage?.destroy();
    this.fieldImage = null;
    this.fieldScratch?.destroy();
    this.fieldScratch = null;
    this.stencilScratch?.destroy();
    this.stencilScratch = null;
    for (let k = 0; k < this.bayerPunches.length; k++) {
      this.bayerPunches[k]?.destroy();
      this.bayerPunches[k] = null;
    }
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
    this.corruptionGraphics?.clearMask(false);
    this.corruptionClipGraphics?.destroy();
    this.corruptionClipGraphics = null;
    this.corruptionClipMask = null;
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

    this.allocatePolygonBuffers();

    this.buildRayOffsets();
    this.cacheValid = false;
  }

  /** Polygon bands the current mask style needs: 3 stepped, N subdiv, or 1 stencil. */
  private bandCountForStyle(): number {
    switch (this.maskStyle) {
      case 'subdiv':
        return SUBDIV_BAND_COUNT;
      case 'field':
      case 'field-dim':
        return 1;
      default:
        return 3;
    }
  }

  /**
   * (Re)allocates polygon vertex buffers for the current style. Called from
   * setRayCounts and from setMaskStyle - both are rare events, never a normal frame.
   */
  private allocatePolygonBuffers(): void {
    const bandCount = this.bandCountForStyle();
    this.polygons = [];
    this.shrunkPolygons = [];
    this.rangeEdge = new Uint8Array(this.rayCount * bandCount);
    // Field styles draw one stencil polygon fed by the 360-degree fan, not by the
    // production cone+ambient ray split.
    const vertexCount = isFieldStyle(this.maskStyle) ? FIELD_STENCIL_RAY_COUNT : this.rayCount;
    this.stencilDist = isFieldStyle(this.maskStyle)
      ? new Float32Array(FIELD_STENCIL_RAY_COUNT)
      : new Float32Array(0);
    for (let band = 0; band < bandCount; band++) {
      const points: Vector2[] = new Array(vertexCount);
      const shrunk: Vector2[] = new Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        points[i] = { x: 0, y: 0 };
        shrunk[i] = { x: 0, y: 0 };
      }
      this.polygons.push(points);
      this.shrunkPolygons.push(shrunk);
    }
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

  /**
   * Field v3 stencil fan: 360 degrees at full forward range, wall-truncated only.
   * The baked texture fades to exactly 0 before this outline anywhere, so the
   * stencil is invisible except where a wall genuinely cuts the light. Runs on the
   * same cache cadence as the production rays - never on a cached frame.
   */
  private castFieldStencil(origin: Vector2, facingAngle: number): void {
    const count = FIELD_STENCIL_RAY_COUNT;
    if (this.stencilDist.length !== count) {
      this.stencilDist = new Float32Array(count);
    }
    const range = Math.max(
      this.config.radiusForward * this.radiusScale,
      this.config.minSolidRadius
    );
    this.stencilRange = range;

    const override = this.config.rayDistanceOverride;
    const tileSize = this.occluders.tileSize;
    const insideWall =
      !override &&
      this.occluders.isOpaque(Math.floor(origin.x / tileSize), Math.floor(origin.y / tileSize));

    for (let i = 0; i < count; i++) {
      const angle = facingAngle - Math.PI + (TAU * i) / count;
      if (insideWall) {
        this.stencilDist[i] = this.config.minSolidRadius;
        continue;
      }
      if (override) {
        const dist = override(origin, angle, range);
        this.stencilDist[i] = Math.min(Math.max(dist, MIN_HIT_DIST), range);
        continue;
      }
      castRay(this.occluders, origin, angle, range, this.hit);
      this.stencilDist[i] = this.hit.hit
        ? Math.min(Math.max(this.hit.dist, MIN_HIT_DIST), range)
        : range;
    }
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
    this.drawMask(facingAngle);
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

    const style = this.maskStyle;
    const bandCount = this.polygons.length;
    // Bayer slopes straddle the contour, so the solid fill pulls in further than the
    // 1px the checker ring needs.
    const shrinkPx = style === 'bayer' ? BAYER_SLOPE_INSET : 1;

    if (isFieldStyle(style)) {
      // 360-degree wall-only stencil: the field texture owns the shape; this polygon
      // just cuts it where walls block the light. No jitter - the texture edge is
      // already 0 at the outline, so a crawling contour would only add shimmer.
      const count = FIELD_STENCIL_RAY_COUNT;
      const range = this.stencilRange;
      const polygon = this.polygons[0]!;
      for (let i = 0; i < count; i++) {
        const angle = facingAngle - Math.PI + (TAU * i) / count;
        const dist = Math.min(this.stencilDist[i] ?? range, range);
        this.writePoint(polygon, i, Math.cos(angle), Math.sin(angle), dist);
      }
      return;
    }

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

      if (style === 'subdiv') {
        for (let band = 0; band < bandCount; band++) {
          const rho = core + ((outer - core) * band) / (bandCount - 1);
          this.writePoint(this.polygons[band]!, i, cos, sin, Math.min(hitDist, rho));
        }
        continue;
      }

      const middle = Math.max(outer - bandWidth, core);
      const radii0 = Math.min(hitDist, core);
      const radii1 = Math.min(hitDist, middle);
      const radii2 = Math.min(hitDist, outer);

      this.rangeEdge[i] = hitDist >= core - 1 ? 1 : 0;
      this.rangeEdge[this.rayCount + i] = hitDist >= middle - 1 ? 1 : 0;
      this.rangeEdge[this.rayCount * 2 + i] = hitDist >= outer - 1 ? 1 : 0;

      this.writePoint(this.polygons[0]!, i, cos, sin, radii0);
      this.writePoint(this.polygons[1]!, i, cos, sin, radii1);
      this.writePoint(this.polygons[2]!, i, cos, sin, radii2);
      this.writePoint(
        this.shrunkPolygons[0]!,
        i,
        cos,
        sin,
        Math.max(radii0 - this.rangeEdge[i]! * shrinkPx, 0)
      );
      this.writePoint(
        this.shrunkPolygons[1]!,
        i,
        cos,
        sin,
        Math.max(radii1 - this.rangeEdge[this.rayCount + i]! * shrinkPx, 0)
      );
      this.writePoint(
        this.shrunkPolygons[2]!,
        i,
        cos,
        sin,
        Math.max(radii2 - this.rangeEdge[this.rayCount * 2 + i]! * shrinkPx, 0)
      );
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

  private drawMask(facingAngle: number): void {
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

    switch (this.maskStyle) {
      case 'subdiv':
        this.drawSubdivBands();
        break;
      case 'field':
      case 'field-dim':
        this.drawFieldMask(facingAngle);
        break;
      case 'bayer':
        this.drawBayerBands();
        break;
      default:
        // Outer band first, core last: the erases compound to 0.80 / 0.40 / 0 darkness.
        // Each band: shrink the solid fill 1px on range edges, then punch a 2px
        // checker ring along the original contour (wall-truncated segments stay hard).
        for (let band = 2; band >= 0; band--) {
          const graphics = this.bandGraphicsAt(band);
          graphics.clear();
          graphics.fillStyle(0xffffff, config.eraseAlphas[band]!);
          graphics.fillPoints(this.shrunkPolygons[band]!, true);
          this.mask.erase(graphics);
          this.eraseDitherRing(band, config.eraseAlphas[band]!);
        }
    }
  }

  /** Lazily grown so subdiv mode gets more band graphics than the default three. */
  private bandGraphicsAt(index: number): Phaser.GameObjects.Graphics {
    while (this.bandGraphics.length <= index) {
      this.bandGraphics.push(this.scene.make.graphics({}, false));
    }
    return this.bandGraphics[index]!;
  }

  /** Subdiv spike: N nested polygons whose erase strengths sample a smooth profile. */
  private drawSubdivBands(): void {
    if (!this.subdivAlphas) {
      this.subdivAlphas = computeNestedEraseAlphas(SUBDIV_BAND_COUNT, SUBDIV_PROFILE_STOPS);
    }
    for (let band = SUBDIV_BAND_COUNT - 1; band >= 0; band--) {
      const graphics = this.bandGraphicsAt(band);
      graphics.clear();
      graphics.fillStyle(0xffffff, this.subdivAlphas[band]!);
      graphics.fillPoints(this.polygons[band]!, true);
      this.mask.erase(graphics);
    }
  }

  /**
   * Field spike: erase the baked light field through the wall-truncated visibility
   * outline. The field owns the smooth radial/angular falloff; the stencil keeps
   * wall cuts hard, which is the optically correct split (occlusion hard, falloff
   * soft). RT.erase skips GameObject masks, so the complement stencil goes through
   * a scratch RT - the same route the dither ring already takes.
   */
  private drawFieldMask(facingAngle: number): void {
    const field = this.fieldImage;
    const scratch = this.fieldScratch;
    const stencil = this.stencilScratch;
    if (!field || !scratch || !stencil) return;

    const outline = this.bandGraphicsAt(0);
    outline.clear();
    outline.fillStyle(0xffffff, 1);
    outline.fillPoints(this.polygons[0]!, true);

    stencil.clear();
    stencil.fill(0xffffff, 1);
    stencil.erase(outline);

    field.setPosition(this.origin.x - this.maskOriginX, this.origin.y - this.maskOriginY);
    field.setRotation(facingAngle);
    field.setScale(this.radiusScale);

    scratch.clear();
    scratch.draw(field);
    scratch.erase(stencil);
    this.mask.erase(scratch);
  }

  /**
   * Bayer spike: the three stepped bands stay, but each contour gets an 8px
   * ordered-dither slope (3 punched rings at 12/8/4 sixteenths density) instead of
   * the 2px binary checker - a duty-cycle ramp instead of a noisy hard edge.
   */
  private drawBayerBands(): void {
    const config = this.config;
    for (let band = 2; band >= 0; band--) {
      const graphics = this.bandGraphicsAt(band);
      graphics.clear();
      graphics.fillStyle(0xffffff, config.eraseAlphas[band]!);
      graphics.fillPoints(this.shrunkPolygons[band]!, true);
      this.mask.erase(graphics);
      this.eraseBayerSlope(band, config.eraseAlphas[band]!);
    }
  }

  private eraseBayerSlope(band: number, eraseAlpha: number): void {
    const ring = this.ditherRingGraphics;
    const scratch = this.ditherScratch;
    if (!ring || !scratch) return;
    const points = this.polygons[band]!;
    const edgeOffset = band * this.rayCount;
    const originX = this.origin.x - this.maskOriginX;
    const originY = this.origin.y - this.maskOriginY;
    // Temporal phase: the rank matrix rotates ~8 Hz, so the slope shimmers even
    // when the player (and thus the world-pinned tile offset) stands still.
    const phase = Math.floor(this.elapsedMs / BAYER_PHASE_MS) % BAYER_PHASE_COUNT;

    for (let k = 0; k < BAYER_SLOPE_KEEPS.length; k++) {
      const punch = this.bayerPunches[k];
      if (!punch) return;
      const phaseKey = bayerPunchKey(BAYER_SLOPE_KEEPS[k]!, phase);
      if (punch.texture.key !== phaseKey) punch.setTexture(phaseKey);
      // Ring centres at -2.7 / -0.1 / +2.5 px from the contour (solid fill is
      // already pulled in BAYER_SLOPE_INSET px, so the slope spans -4 .. +4).
      const offset = 1.5 + k * BAYER_SLOPE_RING_WIDTH - BAYER_SLOPE_INSET;
      ring.clear();
      ring.lineStyle(BAYER_SLOPE_RING_WIDTH, 0xffffff, eraseAlpha);
      for (let i = 0; i < this.rayCount; i++) {
        const next = (i + 1) % this.rayCount;
        if (this.rangeEdge[edgeOffset + i] !== 1 || this.rangeEdge[edgeOffset + next] !== 1) continue;
        this.ringVertex(points[i]!, originX, originY, offset, this.ringScratchA);
        this.ringVertex(points[next]!, originX, originY, offset, this.ringScratchB);
        ring.lineBetween(
          this.ringScratchA.x,
          this.ringScratchA.y,
          this.ringScratchB.x,
          this.ringScratchB.y
        );
      }
      scratch.clear();
      scratch.draw(ring);
      punch.tilePositionX = this.maskOriginX & 3;
      punch.tilePositionY = this.maskOriginY & 3;
      scratch.erase(punch);
      this.mask.erase(scratch);
    }
  }

  private readonly ringScratchA: Vector2 = { x: 0, y: 0 };
  private readonly ringScratchB: Vector2 = { x: 0, y: 0 };

  /** Push a contour vertex `offset` px outward along its own ray from the origin. */
  private ringVertex(point: Vector2, originX: number, originY: number, offset: number, out: Vector2): void {
    const dx = point.x - originX;
    const dy = point.y - originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-4) {
      out.x = point.x;
      out.y = point.y;
      return;
    }
    const scale = (dist + offset) / dist;
    out.x = originX + dx * scale;
    out.y = originY + dy * scale;
  }

  /**
   * Field spike objects: the baked light-field image plus two scratch RTs (field ∩
   * stencil). Created on first switch to `field` and re-created on scene re-entry;
   * the canvas texture itself lives in the global texture manager and is baked once.
   */
  private ensureFieldObjects(): void {
    const style = isFieldStyle(this.maskStyle) ? this.maskStyle : 'field';
    const textureKey = fieldTextureKey(style);
    if (!this.scene.textures.exists(textureKey)) {
      const canvas = this.scene.textures.createCanvas(textureKey, VISION_FIELD_SIZE, VISION_FIELD_SIZE);
      if (canvas) {
        const context = canvas.getContext();
        const image = context.createImageData(VISION_FIELD_SIZE, VISION_FIELD_SIZE);
        fillVisionField(image.data, VISION_FIELD_SIZE, {
          radiusForward: this.config.radiusForward,
          radiusAmbient: this.config.radiusAmbient,
          coneHalfAngleDeg: this.config.coneHalfAngleDeg,
          coneFalloffAngleDeg: this.config.coneFalloffAngleDeg,
          lampStops: style === 'field-dim' ? FIELD_LAMP_DIM_STOPS : FIELD_LAMP_STOPS,
        });
        context.putImageData(image, 0, 0);
        canvas.refresh();
      }
    }
    if (!this.fieldImage) {
      this.fieldImage = this.scene.make.image({ key: textureKey }, false);
      this.fieldImage.setOrigin(0.5, 0.5);
    } else if (this.fieldImage.texture.key !== textureKey) {
      this.fieldImage.setTexture(textureKey);
    }
    if (!this.fieldScratch) {
      this.fieldScratch = this.scene.make.renderTexture(
        { x: 0, y: 0, width: this.maskWidth, height: this.maskHeight },
        false
      );
      this.fieldScratch.setOrigin(0, 0);
    }
    if (!this.stencilScratch) {
      this.stencilScratch = this.scene.make.renderTexture(
        { x: 0, y: 0, width: this.maskWidth, height: this.maskHeight },
        false
      );
      this.stencilScratch.setOrigin(0, 0);
    }
  }

  /**
   * Bayer spike objects: three 4×4 punch tiles at the slope densities, each with
   * BAYER_PHASE_COUNT rotated-rank variants baked up front. The per-frame phase
   * switch is a setTexture on an unlisted sprite - no allocation, no rebake.
   */
  private ensureBayerPunches(): void {
    for (let k = 0; k < BAYER_SLOPE_KEEPS.length; k++) {
      for (let phase = 0; phase < BAYER_PHASE_COUNT; phase++) {
        const key = bayerPunchKey(BAYER_SLOPE_KEEPS[k]!, phase);
        if (this.scene.textures.exists(key)) continue;
        const canvas = this.scene.textures.createCanvas(key, 4, 4);
        if (!canvas) continue;
        const context = canvas.getContext();
        const image = context.createImageData(4, 4);
        fillBayerPunch(image.data, BAYER_SLOPE_KEEPS[k]!, phase);
        context.putImageData(image, 0, 0);
        canvas.refresh();
      }
      if (this.bayerPunches[k]) continue;
      const punch = this.scene.make.tileSprite(
        { x: 0, y: 0, width: this.maskWidth, height: this.maskHeight, key: bayerPunchKey(BAYER_SLOPE_KEEPS[k]!, 0) },
        false
      );
      punch.setOrigin(0, 0);
      this.bayerPunches[k] = punch;
    }
  }

  /**
   * Route 2 (scratch RT): stroke the 2px range-edge ring, erase checker-off cells,
   * then erase the remainder into the mask at the band's erase alpha.
   * Geometry-mask erase (route 1) is not used — RT.erase skips GameObject masks.
   */
  private eraseDitherRing(band: number, eraseAlpha: number): void {
    const ring = this.ditherRingGraphics;
    const punch = this.ditherPunch;
    const scratch = this.ditherScratch;
    if (!ring || !punch || !scratch) return;

    ring.clear();
    ring.lineStyle(2, 0xffffff, eraseAlpha);
    const points = this.polygons[band]!;
    const edgeOffset = band * this.rayCount;
    for (let i = 0; i < this.rayCount; i++) {
      const next = (i + 1) % this.rayCount;
      if (this.rangeEdge[edgeOffset + i] !== 1 || this.rangeEdge[edgeOffset + next] !== 1) continue;
      const a = points[i]!;
      const b = points[next]!;
      ring.lineBetween(a.x, a.y, b.x, b.y);
    }

    scratch.clear();
    scratch.draw(ring);
    punch.tilePositionX = this.maskOriginX & 1;
    punch.tilePositionY = this.maskOriginY & 1;
    scratch.erase(punch);
    this.mask.erase(scratch);
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
    const soft = this.corruptionEdge === 'soft';

    // v4/v5: in field modes the soft edge follows the light field's isolux contour.
    if (soft && isFieldStyle(this.maskStyle)) {
      this.drawCorruptionIsolux(facingAngle);
      return;
    }

    // Isolux-only GeometryMask must not leak onto hard / v3 geometric rings.
    this.corruptionGraphics.clearMask(false);

    const depthFraction =
      v.CORRUPTION_MAX_DEPTH *
      this.edgeCorruption *
      (1 + v.OVERFLOW_CORRUPTION_DEPTH_BOOST * this.screenFlicker);

    // `hard` (production): one fill at the alpha cap. `soft` v3 (spike): concentric
    // sub-rings under a piecewise smoothstep bump - both ends land on exactly 0 with
    // zero slope, and the outer side extends CORRUPTION_SOFT_TAIL_PX past the vision
    // outline into the void, so the teal rises out of the darkness and eats toward
    // the light. Same trigger, same depth, same cap; only the spatial profile changes.
    // v4 note: the soft branch also uses the dimmed, void-mixed soft color.
    const rings = soft ? CORRUPTION_SOFT_RINGS : 1;
    const color = soft
      ? mixRgb(v.CORRUPTION_COLOR, this.config.voidColor, CORRUPTION_SOFT_VOID_MIX)
      : v.CORRUPTION_COLOR;
    const capScale = soft ? CORRUPTION_SOFT_PEAK_SCALE : 1;

    for (let ring = 0; ring < rings; ring++) {
      const f0 = ring / rings;
      const f1 = (ring + 1) / rings;
      const alphaScale = soft ? corruptionSoftProfile((ring + 0.5) / rings, CORRUPTION_SOFT_PEAK_T) : 1;
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

        // Soft v3: the ring band runs [inner, outer + tail]; the tail only exists
        // where the band itself exists (a wall closer than the band start still
        // suppresses the whole ray, same trigger semantics as production).
        const spanA =
          Math.max(outerA - innerA, 0) + (soft && outerA > innerA ? CORRUPTION_SOFT_TAIL_PX : 0);
        const spanB =
          Math.max(outerB - innerB, 0) + (soft && outerB > innerB ? CORRUPTION_SOFT_TAIL_PX : 0);

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

  /**
   * Soft v4 (field modes only) + v5 wall/clip/smoothing (I9-LAB5):
   * the corruption front pins to the light field's isolux contour - the radius
   * per direction where the field decays to a chaos-driven threshold. Strong
   * light (flashlight cone) holds the front far out; weak light (lamp side/rear)
   * lets it seep toward the player. The band is fixed-width around the contour:
   * a zero-slope rise on the player side and a long tail past the contour into
   * the void. Walls still truncate the front (a wall face is a vision edge).
   * Chaos mapping preserved: higher corruption raises the threshold, pushing
   * the front toward brighter radii (the player).
   *
   * v5 F1: tail outer edge is min(front + TAIL, stencilDist) so the band cannot
   * walk through a wall brick. v5 F2: the layer is clipped to the same 360°
   * wall-truncated stencil polygon the field mask uses, so quads interpolating
   * across a wall corner cannot paint behind the wall. v5 F3: 1–2 passes of
   * circular box-blur on the 128-ray front, then re-clamp to the stencil, so a
   * door-gap 51/182 jump does not smear into a diagonal teal wedge.
   *
   * I9-LAB6: each ring's alpha is also multiplied by a wall-proximity fade —
   * within CORRUPTION_ISO_WALL_FADE_PX of stencilDist the band smoothsteps to 0
   * so teal dissipates in front of a wall face instead of stacking into a
   * specular rim. Isolux/soft only; hard and bands/subdiv/bayer stay untouched.
   */
  private drawCorruptionIsolux(facingAngle: number): void {
    const graphics = this.corruptionGraphics;
    const v = GAME_CONSTANTS.VISIBILITY;
    const config = this.config;
    const count = FIELD_STENCIL_RAY_COUNT;

    if (this.corruptionFront.length !== count) {
      this.corruptionFront = new Float32Array(count);
      this.corruptionFrontScratch = new Float32Array(count);
    }

    const threshold = Math.min(
      CORRUPTION_ISO_THRESHOLD_SCALE *
        this.edgeCorruption *
        (1 + v.OVERFLOW_CORRUPTION_DEPTH_BOOST * this.screenFlicker),
      CORRUPTION_ISO_THRESHOLD_MAX
    );
    const fieldParams = {
      radiusForward: config.radiusForward * this.radiusScale,
      radiusAmbient: config.radiusAmbient * this.radiusScale,
      coneHalfAngleDeg: config.coneHalfAngleDeg,
      coneFalloffAngleDeg: config.coneFalloffAngleDeg,
      lampStops: this.maskStyle === 'field-dim' ? FIELD_LAMP_DIM_STOPS : FIELD_LAMP_STOPS,
    };
    for (let i = 0; i < count; i++) {
      const theta = -Math.PI + (TAU * i) / count;
      const contour = fieldIsoluxRadius(theta, threshold, fieldParams, config.minSolidRadius);
      const wall = this.stencilDist[i] ?? fieldParams.radiusForward;
      this.corruptionFront[i] = Math.min(contour, wall);
    }

    this.smoothCorruptionFront(count);

    this.ensureCorruptionClipMask();
    this.redrawCorruptionClip(facingAngle);
    if (this.corruptionClipMask) graphics.setMask(this.corruptionClipMask);

    const peakT = CORRUPTION_ISO_INNER_PX / (CORRUPTION_ISO_INNER_PX + CORRUPTION_ISO_TAIL_PX);
    const color = mixRgb(v.CORRUPTION_COLOR, config.voidColor, CORRUPTION_SOFT_VOID_MIX);
    const capAlpha =
      v.CORRUPTION_MAX_MIX * this.edgeCorruption * CORRUPTION_SOFT_PEAK_SCALE;

    for (let ring = 0; ring < CORRUPTION_ISO_RINGS; ring++) {
      const f0 = ring / CORRUPTION_ISO_RINGS;
      const f1 = (ring + 1) / CORRUPTION_ISO_RINGS;
      const alphaScale = corruptionSoftProfile((ring + 0.5) / CORRUPTION_ISO_RINGS, peakT);

      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        const frontA = this.corruptionFront[i]!;
        const frontB = this.corruptionFront[next]!;
        const wallA = this.stencilDist[i] ?? fieldParams.radiusForward;
        const wallB = this.stencilDist[next] ?? fieldParams.radiusForward;
        const innerA = Math.max(frontA - CORRUPTION_ISO_INNER_PX, 0);
        const innerB = Math.max(frontB - CORRUPTION_ISO_INNER_PX, 0);
        // F1: clamp the dark-side tail to the same-ray wall distance. Inner
        // stays unclamped: front ≤ wall already, so inner is inside the stencil.
        const outerA = Math.min(frontA + CORRUPTION_ISO_TAIL_PX, wallA);
        const outerB = Math.min(frontB + CORRUPTION_ISO_TAIL_PX, wallB);
        if (outerA <= innerA && outerB <= innerB) continue;

        const angleA = facingAngle - Math.PI + (TAU * i) / count;
        const angleB = facingAngle - Math.PI + (TAU * next) / count;
        const cosA = Math.cos(angleA);
        const sinA = Math.sin(angleA);
        const cosB = Math.cos(angleB);
        const sinB = Math.sin(angleB);

        const a0 = innerA + (outerA - innerA) * f0;
        const a1 = innerA + (outerA - innerA) * f1;
        const b0 = innerB + (outerB - innerB) * f0;
        const b1 = innerB + (outerB - innerB) * f1;

        // I9-LAB6: fade the ring's outer edge out over the last
        // CORRUPTION_ISO_WALL_FADE_PX before the wall so teal dissipates in
        // front of the face instead of stacking into a specular rim. A quad
        // gets one fillStyle, so the dimmer of the two rays wins.
        const fade = Math.min(
          wallProximityFade(a1, wallA, CORRUPTION_ISO_WALL_FADE_PX),
          wallProximityFade(b1, wallB, CORRUPTION_ISO_WALL_FADE_PX)
        );
        if (fade <= 0) continue;
        graphics.fillStyle(color, capAlpha * alphaScale * fade);

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

  /**
   * F3: circular box-blur of the 128-ray isolux front, then re-clamp to the
   * wall stencil. Preallocated scratch; O(rays × kernel × passes).
   */
  private smoothCorruptionFront(count: number): void {
    const src = this.corruptionFront;
    const dst = this.corruptionFrontScratch;
    if (src.length !== count || dst.length !== count) return;

    const radius = CORRUPTION_ISO_FRONT_BLUR_RADIUS;
    const kernel = radius * 2 + 1;
    let read: Float32Array = src;
    let write: Float32Array = dst;
    for (let pass = 0; pass < CORRUPTION_ISO_FRONT_BLUR_PASSES; pass++) {
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          let j = i + k;
          if (j < 0) j += count;
          else if (j >= count) j -= count;
          sum += read[j]!;
        }
        write[i] = sum / kernel;
      }
      const swap = read;
      read = write;
      write = swap;
    }
    if (read !== src) src.set(read);

    for (let i = 0; i < count; i++) {
      const wall = this.stencilDist[i] ?? this.stencilRange;
      src[i] = Math.min(src[i]!, wall);
    }
  }

  private ensureCorruptionClipMask(): void {
    if (this.corruptionClipGraphics) return;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    this.corruptionClipGraphics = graphics;
    this.corruptionClipMask = graphics.createGeometryMask();
  }

  /**
   * F2: rebuild the field-mode stencil polygon in world space and bind it as
   * the isolux layer's GeometryMask. Same 128-ray, radiusForward-capped fan as
   * `drawFieldMask` / `buildPolygons` field branch — not the lit-region outline.
   */
  private redrawCorruptionClip(facingAngle: number): void {
    const clip = this.corruptionClipGraphics;
    if (!clip) return;
    const count = FIELD_STENCIL_RAY_COUNT;
    const range = this.stencilRange;
    clip.clear();
    clip.fillStyle(0xffffff, 1);
    clip.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = facingAngle - Math.PI + (TAU * i) / count;
      const dist = Math.min(this.stencilDist[i] ?? range, range);
      const x = this.origin.x + Math.cos(angle) * dist;
      const y = this.origin.y + Math.sin(angle) * dist;
      if (i === 0) clip.moveTo(x, y);
      else clip.lineTo(x, y);
    }
    clip.closePath();
    clip.fillPath();
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
const DITHER_PUNCH_TEXTURE_KEY = 'vision-band-dither-punch';
const FIELD_TEXTURE_KEY = 'vision-light-field';
const BAYER_PUNCH_TEXTURE_KEY = 'vision-bayer-punch';

function isFieldStyle(style: VisionMaskStyle): style is 'field' | 'field-dim' {
  return style === 'field' || style === 'field-dim';
}

function fieldTextureKey(style: 'field' | 'field-dim'): string {
  return style === 'field-dim' ? `${FIELD_TEXTURE_KEY}-dim` : FIELD_TEXTURE_KEY;
}

function bayerPunchKey(keeps: number, phase: number): string {
  return `${BAYER_PUNCH_TEXTURE_KEY}-${keeps}-p${phase}`;
}

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

function ensureDitherPunchTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(DITHER_PUNCH_TEXTURE_KEY)) return DITHER_PUNCH_TEXTURE_KEY;

  const canvas = scene.textures.createCanvas(DITHER_PUNCH_TEXTURE_KEY, 2, 2);
  if (!canvas) return null;

  const context = canvas.getContext();
  const image = context.createImageData(2, 2);
  fillDitherPunch(image.data, 2);
  context.putImageData(image, 0, 0);
  canvas.refresh();
  return DITHER_PUNCH_TEXTURE_KEY;
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
