/**
 * Purification Scene - the base management walkable space.
 *
 * A small tilemap (~14x12 tiles) with a circular safe area. The player walks around,
 * interacts with three modules (CORE center, STORAGE right, PURIFIER south) via
 * allocation panels, thickens maxHp at the altar-north stake, and enters the rift
 * via the north entrance. The boundary features particle atmosphere and periodic
 * apparitions.
 *
 * Reuses Player entity + VisibilitySystem (omni mode). Does NOT use: AI, combat, chaos.
 *
 * Scene data received: { kindlingGained: number, survived: boolean }
 * Scene data sent to RiftScene: { modifiers: SortieModifiers, cycle: number }
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { Player } from '@/entities/player';
import {
  CORE_SPRITE_VARIANTS,
  PurificationModuleEntity,
} from '@/entities/purification-module';
import { gameState } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { saveManager } from '@/managers/save-manager';
import { BoundaryAtmosphere } from '@/systems/boundary-atmosphere';
import { BoundaryBreath } from '@/systems/boundary-breath';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import type { ForecastDisplay, ImpactResult } from '@/systems/impact-system';
import { createBoundaryShape } from '@/systems/boundary-shape';
import type { BoundaryShape } from '@/systems/boundary-shape';
import { createPurificationSurfaceTexture } from '@/systems/procedural-purification-surface';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { createPurificationVisionConfig, VisibilitySystem } from '@/systems/visibility-system';
import { allocationPanel } from '@/ui/dom/allocation-panel';
import { defensePanel } from '@/ui/dom/defense-panel';
import { growthPanel } from '@/ui/dom/growth-panel';
import { loadoutPanel } from '@/ui/dom/loadout-panel';
import { statusPanel } from '@/ui/dom/status-panel';
import { purificationHud } from '@/ui/dom/purification-hud';
import type { InteractionTarget } from '@/ui/dom/purification-hud';
import { impactResultPanel } from '@/ui/dom/impact-result-panel';
import { pauseMenu } from '@/ui/dom/pause-menu';
import type { ChargeChangeEntry } from '@/ui/dom/impact-result-panel';
import type { PhaseChangeInfo } from '@/systems/tide-system';
import { TileType } from '@/types/game-types';
import type { ContaminantType } from '@/types/game-types';
import { getToolName } from '@/ui/contaminant-names';
import { getDomUiRoot, showToastInline } from '@/ui/dom/panel-styles';
import { GameEvent } from '@/types/events';
import type { TileMapData, OccluderGrid } from '@/types/map-types';

// ---------------------------------------------------------------------------
// Map layout constants
// ---------------------------------------------------------------------------

const TILE = GAME_CONSTANTS.TILE_SIZE;
const COLS = GAME_CONSTANTS.PURIFICATION.MAP_COLS;
const ROWS = GAME_CONSTANTS.PURIFICATION.MAP_ROWS;
const WIDTH_PX = COLS * TILE;
const HEIGHT_PX = ROWS * TILE;
const CENTER_X = WIDTH_PX / 2;
const CENTER_Y = HEIGHT_PX / 2;

// Elliptical safe area (spec: ~12x10 usable tiles in a 14x12 map)
const ELLIPSE_RX = 5.2; // tiles
const ELLIPSE_RY = 5.0; // tiles

// Module positions (world px) — CORE at center, others radially around it
const CORE_POS = { x: CENTER_X, y: CENTER_Y };
const STORAGE_POS = { x: CENTER_X + 3.5 * TILE, y: CENTER_Y };
const PURIFIER_POS = { x: CENTER_X, y: CENTER_Y + 3.5 * TILE };
// Rift entrance (north edge)
const RIFT_ENTRANCE_POS = { x: CENTER_X, y: CENTER_Y - 3.5 * TILE };
// Defense management point (south-west)
const DEFENSE_POS = { x: CENTER_X - 3 * TILE, y: CENTER_Y + 2.5 * TILE };
// Growth altar (west)
const GROWTH_POS = { x: CENTER_X - 3.5 * TILE, y: CENTER_Y };
// Thicken stake: 2.2 tiles north of the altar, same west axis (rule 2 / U)
const THICKEN_POS = { x: GROWTH_POS.x, y: GROWTH_POS.y - 2.2 * TILE };

const RIFT_CENTER = 0x1aad96;
const RIFT_RING = 0x2ae6c8;
const DEFENSE_CENTER = 0x6644aa;
const DEFENSE_RING = 0x8866cc;
const GROWTH_CENTER = 0xaa6622;
const GROWTH_RING = 0xcc8844;
const THICKEN_CENTER = 0x5a5f66;
const THICKEN_RING = 0xc8cdd4;

// Breathing animation speeds (radians per ms)
const BREATH_SPEED_NORMAL = (2 * Math.PI) / 2500;
const BREATH_SPEED_NEAR = (2 * Math.PI) / 1200;
const BREATH_SPEED_HIGHLIGHT = (2 * Math.PI) / 800;

// ---------------------------------------------------------------------------
// Build the static tilemap (for occluder grid / visibility only, NOT physics)
// ---------------------------------------------------------------------------

/**
 * Build the tilemap using the dynamic boundary shape.
 * Tiles are FLOOR if their center is inside the boundary at 98% radius.
 * Used for visibility occluder grid only -- physics uses the smooth blob collider.
 */
function buildPurificationTileMap(shape: BoundaryShape): TileMapData {
  const tiles: number[][] = [];

  for (let row = 0; row < ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < COLS; col++) {
      const worldX = (col + 0.5) * TILE;
      const worldY = (row + 0.5) * TILE;
      const nDist = shape.normalizedDist(worldX, worldY);
      rowData.push(nDist <= 0.98 ? TileType.FLOOR : TileType.WALL);
    }
    tiles.push(rowData);
  }

  return { cols: COLS, rows: ROWS, tileSize: TILE, tiles };
}

// ---------------------------------------------------------------------------
// Smooth blob collider (replaces tile-based collision)
// ---------------------------------------------------------------------------

const COLLIDER_SEGMENT_SIZE = 8; // px per collider block
const COLLIDER_SAMPLES = 90;     // angular samples (4° each)

/**
 * Creates a ring of small static bodies along the blob boundary at 98% radius.
 * Returns the static group so the scene can set up a collider with the player.
 */
function createBlobCollider(
  scene: Phaser.Scene,
  shape: BoundaryShape,
): Phaser.Physics.Arcade.StaticGroup {
  const group = scene.physics.add.staticGroup();
  const cx = shape.centerX;
  const cy = shape.centerY;

  // Also add world-bounds collider bodies along outer edges
  // (in case blob doesn't cover corners)

  for (let i = 0; i < COLLIDER_SAMPLES; i++) {
    const angle = (i / COLLIDER_SAMPLES) * Math.PI * 2;
    const r = shape.radiusAt(angle) * 0.98;

    // Place collider blocks outward from the boundary point to form a wall
    // We place 2 blocks deep (8px + 8px = 16px wall thickness) for reliability
    for (let depth = 0; depth < 2; depth++) {
      const rr = r + depth * COLLIDER_SEGMENT_SIZE;
      const bx = cx + Math.cos(angle) * rr;
      const by = cy + Math.sin(angle) * rr;

      // Create an invisible static rectangle
      const block = scene.add.rectangle(bx, by, COLLIDER_SEGMENT_SIZE, COLLIDER_SEGMENT_SIZE);
      block.setVisible(false);
      group.add(block);
    }
  }

  return group;
}

function buildOccluderGrid(tileMap: TileMapData): OccluderGrid {
  return {
    cols: tileMap.cols,
    rows: tileMap.rows,
    tileSize: tileMap.tileSize,
    isOpaque(col: number, row: number): boolean {
      if (col < 0 || col >= tileMap.cols || row < 0 || row >= tileMap.rows) return true;
      return tileMap.tiles[row]![col] === TileType.WALL;
    },
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Purification tileset (cold grey tones - player is the only warm color here)
// ---------------------------------------------------------------------------

const PURIFICATION_TILESET_KEY = 'placeholder-purification-tileset';

function ensurePurificationTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(PURIFICATION_TILESET_KEY)) return;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  // frame 0 - wall (dark void)
  gfx.fillStyle(0x0a0a0a, 1);
  gfx.fillRect(0, 0, TILE, TILE);

  // frame 1 - floor (cold grey / concrete-dark)
  gfx.fillStyle(0x2c2e33, 1);
  gfx.fillRect(TILE, 0, TILE, TILE);
  gfx.lineStyle(1, 0x3a3d42, 1);
  gfx.strokeRect(TILE + 0.5, 0.5, TILE - 1, TILE - 1);

  gfx.generateTexture(PURIFICATION_TILESET_KEY, TILE * 2, TILE);
  gfx.destroy();
}

// ---------------------------------------------------------------------------
// Unified interaction point drawing (spec B3)
// ---------------------------------------------------------------------------

function drawInteractionPoint(
  graphics: Phaser.GameObjects.Graphics,
  x: number, y: number,
  centerColor: number, ringColor: number,
  centerRadius: number, ringRadius: number,
  pulse: number,
  highlighted: boolean,
  inRange: boolean,
): void {
  const baseAlpha = highlighted ? 0.55 : 0.4;
  const pulseAmp = 0.25;
  const alpha = baseAlpha + Math.sin(pulse) * pulseAmp;
  const rBonus = inRange ? 3 : 0;

  graphics.clear();
  graphics.fillStyle(centerColor, Math.min(1, alpha + 0.15));
  graphics.fillCircle(x, y, centerRadius);
  graphics.lineStyle(2, ringColor, alpha);
  graphics.strokeCircle(x, y, ringRadius + rBonus);
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class PurificationScene extends Phaser.Scene {
  private readonly tilemapRenderer = new TilemapRenderer();
  private readonly player = new Player();
  private readonly visibility = new VisibilitySystem();
  private readonly atmosphere = new BoundaryAtmosphere();
  private readonly breath = new BoundaryBreath();

  private boundaryShape!: BoundaryShape;

  private coreModule!: PurificationModuleEntity;
  private storageModule!: PurificationModuleEntity;
  private purifierModule!: PurificationModuleEntity;

  private riftEntranceGraphics!: Phaser.GameObjects.Graphics;
  private riftEntrancePulse = 0;

  // Defense management interaction point
  private defenseGraphics!: Phaser.GameObjects.Graphics;
  private defensePulse = 0;

  // Growth altar interaction point
  private growthGraphics!: Phaser.GameObjects.Graphics;
  private growthPulse = 0;

  // Thicken stake (not a fourth module)
  private thickenGraphics!: Phaser.GameObjects.Graphics;
  private thickenPulse = 0;

  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private tabKey: Phaser.Input.Keyboard.Key | null = null;
  // 核心抽卡方案切换（实测用）：1/2/3 -> A 敬畏 / B 仪式 / C 封印
  private coreVariantKeys: Phaser.Input.Keyboard.Key[] = [];
  private transitioning = false;
  private panelClosedAt = 0;
  private lastStepAt = -1000;
  private lastBoundaryPulseAt = -10000;

  // E3: Track stability milestones already shown
  private lastStabilityMilestone = 0;

  constructor() {
    super({ key: 'PurificationScene' });
  }

  create(data?: { kindlingGained?: number; survived?: boolean; fromMenu?: boolean }): void {
    // Determine if this is a return from rift (vs. menu/load entry)
    const isReturnFromRift = !data?.fromMenu && data?.kindlingGained !== undefined;

    // Stability milestone crossed by this visit's extraction bonus, if any (Slice 5.5
    // D5: this used to fire through the STABILITY_CHANGED event, but the listener is
    // registered later in create() — after this addProgress() call — so it never
    // actually reached `onStabilityChanged` (a pre-existing gap this batch closes by
    // computing the crossing here, directly, instead of relying on the event for this
    // particular trigger). Captured before/after so the merged notice below reports
    // exactly what changed on this return, no more/no less.
    let stabilityMilestoneMessage: string | null = null;

    // Credit kindling from the rift run (spec rule 10)
    if (data?.survived && data.kindlingGained !== undefined && data.kindlingGained > 0) {
      gameState.addKindling(data.kindlingGained);
      // Stability: successful extraction (spec S21)
      const beforeProgress = stabilityTracker.getProgress();
      stabilityTracker.addProgress('extraction', GAME_CONSTANTS.STABILITY.GAIN_EXTRACT);
      const afterProgress = stabilityTracker.getProgress();
      stabilityMilestoneMessage = this.findCrossedStabilityMilestone(beforeProgress, afterProgress);
    }

    // Impact only triggers on return from rift, not on menu/load entry
    let impactResult: ReturnType<typeof impactSystem.run> = { skipped: true, damages: [], intensity: 0 };
    let chargeChanges: ChargeChangeEntry[] = [];
    let phaseChange: PhaseChangeInfo | null = null;
    let transformResults: { contaminantId: string; type: string; slotIndex: number }[] = [];
    // Captured BEFORE run() consumes/regenerates the forecast, so this is exactly what
    // the player saw on their way out — the prediction this impact is judged against
    // (Slice 5.5 D5 "预告 vs 实际", IA §S8).
    let predictedForecast: ForecastDisplay | null = null;

    if (isReturnFromRift) {
      // Sync impact intensity from tide system
      gameState.setImpactIntensity(tideSystem.getCurrentIntensity());

      // Snapshot defense slot charges before applying impact (for D2 visualization)
      const chargesBefore = this.snapshotDefenseCharges();

      // Apply contaminant defense charges before running impact
      const isHighTide = tideSystem.isHighTide();
      transformResults = contaminantSystem.applyImpactCharge(isHighTide);

      // Compute charge changes for impact panel (D2)
      chargeChanges = this.computeChargeChanges(chargesBefore, transformResults);

      predictedForecast = impactSystem.getForecastDisplay();

      // Run impact on arrival (pass defense slots to avoid cross-system import)
      const defenseSlots = contaminantSystem.getDefenseSlotted();
      impactResult = impactSystem.run(defenseSlots);

      // Advance tide cycle after impact resolves (E1: capture phase change)
      phaseChange = tideSystem.advanceCycle();
    }

    // Generate the non-spatial forecast (target module + severity) for the NEXT impact
    // (DEC-034), plus muffle's extra lookahead layer for the impact after that (previewed
    // via a pure, RNG-free peek at tide state). Intensity/clarity/peek are read here and
    // passed in so impact-system.ts doesn't import tideSystem/growthSystem directly
    // (DEC-ARCH-002) — see its generateForecast() doc.
    impactSystem.generateForecast(
      tideSystem.getCurrentIntensity(),
      growthSystem.getModifiers().forecastClarity,
      tideSystem.peekNextIntensity(),
    );

    // Save game state
    saveManager.save();

    this.transitioning = false;

    // E3: Initialize stability milestone tracker
    this.lastStabilityMilestone = Math.floor(stabilityTracker.getProgress() / 25) * 25;

    // Build dynamic boundary shape from current tide state
    const tideState = tideSystem.getState();
    const interactionPts = [
      CORE_POS, STORAGE_POS, PURIFIER_POS,
      RIFT_ENTRANCE_POS, DEFENSE_POS, GROWTH_POS, THICKEN_POS,
    ];
    this.boundaryShape = createBoundaryShape({
      ellipseRx: ELLIPSE_RX,
      ellipseRy: ELLIPSE_RY,
      tideIntensity: tideState.currentIntensity,
      tidePhase: tideState.phase,
      pressureSeed: gameState.getCycle() * 7919, // deterministic per-cycle
      interactionPoints: interactionPts,
      centerX: CENTER_X,
      centerY: CENTER_Y,
    });

    // Build tilemap from boundary shape
    const tileMap = buildPurificationTileMap(this.boundaryShape);
    const grid = buildOccluderGrid(tileMap);

    // Procedural surface texture (uses boundary shape for gradient bands)
    // Remove stale texture from prior visit (boundary shape changes with tide)
    const surfaceKey = 'purification-surface';
    if (this.textures.exists(surfaceKey)) {
      this.textures.remove(surfaceKey);
    }
    createPurificationSurfaceTexture(
      this, tileMap, surfaceKey,
      this.boundaryShape,
      interactionPts,
    );
    this.add.image(0, 0, surfaceKey).setOrigin(0, 0).setDepth(0);

    // Tilemap layer for visibility occluder only (no physics collision)
    ensurePurificationTileset(this);
    const layer = this.tilemapRenderer.create(this, tileMap, {
      tilesetKey: PURIFICATION_TILESET_KEY,
      collidingIndices: [],
      depth: -1,
    });
    layer.setVisible(false);

    // Smooth blob collider (replaces tile-based collision for curved boundary)
    const blobCollider = createBlobCollider(this, this.boundaryShape);

    this.physics.world.setBounds(0, 0, WIDTH_PX, HEIGHT_PX);

    // Camera — no bounds constraint; the visibility mask handles what's shown.
    // Without this the camera can't center the map when viewport > map size.
    const camera = this.cameras.main;
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(0x0a0a0a);

    // Player
    const spawnPoint = { x: CENTER_X, y: CENTER_Y + 2 * TILE };
    this.player.create(this, { spawn: spawnPoint, depth: 30, facing: 'up' });
    this.physics.add.collider(this.player.getSprite(), blobCollider);
    camera.centerOn(CENTER_X, CENTER_Y);

    // Visibility (omni mode - smooth blob boundary instead of tile-based raycast)
    const boundaryShape = this.boundaryShape;
    const visionConfig = {
      ...createPurificationVisionConfig(50),
      rayDistanceOverride: (origin: { x: number; y: number }, angle: number, maxRange: number): number => {
        // Ray-blob intersection: march along the ray until normalizedDist >= GRADIENT_OUTER_END.
        // This lets the procedural texture's own vignette (membrane + fade) be the visual boundary,
        // while the visibility mask only takes over where the texture has already faded to void.
        const cutoff = GAME_CONSTANTS.PURIFICATION.BOUNDARY.GRADIENT_OUTER_END;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const step = 8;
        let t = 0;
        while (t < maxRange) {
          const px = origin.x + dx * t;
          const py = origin.y + dy * t;
          if (boundaryShape.normalizedDist(px, py) >= cutoff) break;
          t += step;
        }
        let lo = Math.max(0, t - step);
        let hi = Math.min(t, maxRange);
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) * 0.5;
          const px = origin.x + dx * mid;
          const py = origin.y + dy * mid;
          if (boundaryShape.normalizedDist(px, py) >= cutoff) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        return Math.min(hi, maxRange);
      },
    };
    this.visibility.create(this, visionConfig, grid);

    // Module entities
    this.coreModule = new PurificationModuleEntity({
      id: 'CORE',
      type: 'CORE',
      x: CORE_POS.x,
      y: CORE_POS.y,
    });
    this.coreModule.create(this);

    this.storageModule = new PurificationModuleEntity({
      id: 'STORAGE',
      type: 'STORAGE',
      x: STORAGE_POS.x,
      y: STORAGE_POS.y,
    });
    this.storageModule.create(this);

    this.purifierModule = new PurificationModuleEntity({
      id: 'PURIFIER',
      type: 'PURIFIER',
      x: PURIFIER_POS.x,
      y: PURIFIER_POS.y,
    });
    this.purifierModule.create(this);

    // Interaction point graphics (unified circles, spec B3)
    this.riftEntranceGraphics = this.add.graphics().setDepth(20);
    this.defenseGraphics = this.add.graphics().setDepth(20);
    this.growthGraphics = this.add.graphics().setDepth(20);
    this.thickenGraphics = this.add.graphics().setDepth(20);

    // Purification HUD (DOM overlay)
    purificationHud.create();
    purificationHud.refresh();

    // Boundary atmosphere + breathing overlay
    this.atmosphere.create(this, this.boundaryShape);
    this.breath.create(this, this.boundaryShape, tideState.phase);

    // Input
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, true, false);
      this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, true, false);
      this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB, true, false);
      // 1/2/3 切核心对照（A 敬畏 / B 仪式 / C 封印）
      this.coreVariantKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE, true, false),
      ];
    }

    // C2: Listen for allocation confirmed to flash modules
    eventBus.on(GameEvent.ALLOCATION_CONFIRMED, this.onAllocationConfirmed);
    eventBus.on(GameEvent.GROWTH_PURCHASED, this.onGrowthPurchased);

    // E3: Listen for stability changes
    eventBus.on(GameEvent.STABILITY_CHANGED, this.onStabilityChanged);

    // Post-update for visibility sync
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    // Show impact result on arrival (player must dismiss before interacting).
    // Slice 5.5 D5: the tide-phase-change and stability-milestone notices that used to
    // chain as separate "knowledge  " overlays after this panel are now rendered as a
    // trailing section INSIDE it — one blocking notification per return, not three.
    if (!impactResult.skipped) {
      this.playImpactAudio(impactResult);
      this.player.setInputEnabled(false);
      this.cameras.main.shake(300, 0.005);
      impactResultPanel.show(impactResult.damages, impactResult.intensity, () => {
        this.player.setInputEnabled(true);
        purificationHud.refresh();
        this.startIsolationBed();
        // B3: Show new tool toast after the merged panel is dismissed (Channel B —
        // non-blocking, so it doesn't re-introduce a second confirmation step).
        this.showNewToolToast(transformResults);
      }, {
        chargeChanges: chargeChanges.length > 0 ? chargeChanges : undefined,
        defenseResult: impactResult.defenseResult,
        baseDamagePerModule: impactResult.baseDamagePerModule,
        forecastPrediction: predictedForecast,
        actualPrimaryModuleId: impactResult.primaryModuleId,
        actualSeverity: impactResult.trueSeverity,
        phaseChange,
        stabilityMilestoneMessage,
      });
    } else {
      this.startIsolationBed();
    }
  }

  update(time: number, delta: number): void {
    if (this.transitioning) return;

    this.player.update(delta);

    const pos = this.player.getPosition();
    this.tickPurificationAudio(time, pos);

    // Update modules (checks proximity)
    this.coreModule.update(pos.x, pos.y);
    this.storageModule.update(pos.x, pos.y);
    this.purifierModule.update(pos.x, pos.y);

    const riftDist = this.distTo(pos, RIFT_ENTRANCE_POS);
    const defDist = this.distTo(pos, DEFENSE_POS);
    const groDist = this.distTo(pos, GROWTH_POS);
    const thickenDist = this.distTo(pos, THICKEN_POS);
    const radius = GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;

    const nearRift = riftDist <= radius;
    const nearDefense = defDist <= radius;
    const nearGrowth = groDist <= radius;
    const nearThicken = thickenDist <= radius;

    const target = this.findNearestTarget(
      nearRift, nearDefense, nearGrowth, nearThicken,
      riftDist, defDist, groDist, thickenDist,
    );
    purificationHud.updatePrompt(target);

    // Hide prompt when a panel is open
    purificationHud.setPromptVisible(!this.isAnyPanelOpen());

    // --- Draw interaction points (unified breathing circles) ---

    // Rift entrance
    const riftHighlight = false; // rift always available
    const riftSpeed = nearRift ? BREATH_SPEED_NEAR : BREATH_SPEED_NORMAL;
    this.riftEntrancePulse += delta * riftSpeed;
    drawInteractionPoint(
      this.riftEntranceGraphics,
      RIFT_ENTRANCE_POS.x, RIFT_ENTRANCE_POS.y,
      RIFT_CENTER, RIFT_RING,
      8, 14,
      this.riftEntrancePulse,
      riftHighlight,
      nearRift,
    );

    // Defense point
    const defHighlight = this.shouldHighlight('defense');
    const defSpeed = defHighlight ? BREATH_SPEED_HIGHLIGHT : (nearDefense ? BREATH_SPEED_NEAR : BREATH_SPEED_NORMAL);
    this.defensePulse += delta * defSpeed;
    drawInteractionPoint(
      this.defenseGraphics,
      DEFENSE_POS.x, DEFENSE_POS.y,
      DEFENSE_CENTER, DEFENSE_RING,
      7, 12,
      this.defensePulse,
      defHighlight,
      nearDefense,
    );

    // Growth altar (unified to circle instead of square)
    const groHighlight = this.shouldHighlight('growth');
    const groSpeed = groHighlight ? BREATH_SPEED_HIGHLIGHT : (nearGrowth ? BREATH_SPEED_NEAR : BREATH_SPEED_NORMAL);
    this.growthPulse += delta * groSpeed;
    drawInteractionPoint(
      this.growthGraphics,
      GROWTH_POS.x, GROWTH_POS.y,
      GROWTH_CENTER, GROWTH_RING,
      7, 12,
      this.growthPulse,
      groHighlight,
      nearGrowth,
    );

    const thickenHighlight = this.shouldHighlight('thicken');
    const thickenSpeed = thickenHighlight ? BREATH_SPEED_HIGHLIGHT : (nearThicken ? BREATH_SPEED_NEAR : BREATH_SPEED_NORMAL);
    this.thickenPulse += delta * thickenSpeed;
    drawInteractionPoint(
      this.thickenGraphics,
      THICKEN_POS.x, THICKEN_POS.y,
      THICKEN_CENTER, THICKEN_RING,
      7, 12,
      this.thickenPulse,
      thickenHighlight,
      nearThicken,
    );

    // Atmosphere + breathing overlay
    this.atmosphere.update(delta);
    this.breath.update(delta);

    // Interaction key (edge-triggered)
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.isAnyPanelOpen()) return;

      switch (target?.type) {
        case 'core':
          this.openAllocationPanel('CORE');
          break;
        case 'storage':
          this.openAllocationPanel('STORAGE');
          break;
        case 'purifier':
          this.openAllocationPanel('PURIFIER');
          break;
        case 'defense':
          this.openDefensePanel();
          break;
        case 'growth':
          this.openGrowthPanel();
          break;
        case 'thicken':
          this.tryRaiseModuleMaxHp();
          break;
        case 'rift':
          this.enterRift();
          break;
        default:
          break;
      }
    }

    // 1/2/3 切核心对照
    for (let i = 0; i < this.coreVariantKeys.length; i++) {
      const key = this.coreVariantKeys[i];
      if (!key || !Phaser.Input.Keyboard.JustDown(key)) continue;
      const variant = CORE_SPRITE_VARIANTS[i];
      if (variant) this.coreModule?.setCoreVariant(variant);
    }

    // ESC
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (impactResultPanel.isOpen()) {
        impactResultPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (allocationPanel.isOpen()) {
        allocationPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (defensePanel.isOpen()) {
        defensePanel.close();
        this.panelClosedAt = this.time.now;
      } else if (growthPanel.isOpen()) {
        growthPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (loadoutPanel.isOpen()) {
        loadoutPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (statusPanel.isOpen()) {
        statusPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (!pauseMenu.isOpen() && this.time.now - this.panelClosedAt > 150) {
        pauseMenu.open(this);
      }
    }

    // Tab: Status & Inventory panel (A1 + B1)
    if (this.tabKey && Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      if (statusPanel.isOpen()) {
        statusPanel.close();
      } else if (!this.isAnyPanelOpen()) {
        this.openStatusPanel();
      }
    }
  }

  // ------------------------------------------------------------------ private

  private distTo(pos: { x: number; y: number }, target: { x: number; y: number }): number {
    const dx = pos.x - target.x;
    const dy = pos.y - target.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Find the nearest in-range interaction target for the prompt bar. */
  private findNearestTarget(
    nearRift: boolean, nearDefense: boolean, nearGrowth: boolean, nearThicken: boolean,
    riftDist: number, defDist: number, groDist: number, thickenDist: number,
  ): InteractionTarget | null {
    const candidates: InteractionTarget[] = [];

    if (this.coreModule.isInRange()) {
      const hpData = this.coreModule.getHpData();
      candidates.push({
        type: 'core',
        distance: 0,
        moduleData: hpData ? { hp: hpData.hp, maxHp: hpData.maxHp, effectPct: this.coreModule.getEffectPct() } : undefined,
      });
    }
    if (this.storageModule.isInRange()) {
      const hpData = this.storageModule.getHpData();
      candidates.push({
        type: 'storage',
        distance: 0,
        moduleData: hpData ? { hp: hpData.hp, maxHp: hpData.maxHp, effectPct: this.storageModule.getEffectPct() } : undefined,
      });
    }
    if (this.purifierModule.isInRange()) {
      const hpData = this.purifierModule.getHpData();
      candidates.push({
        type: 'purifier',
        distance: 0,
        moduleData: hpData ? { hp: hpData.hp, maxHp: hpData.maxHp, effectPct: 0 } : undefined,
      });
    }
    if (nearDefense) {
      candidates.push({ type: 'defense', distance: defDist });
    }
    if (nearGrowth) {
      candidates.push({ type: 'growth', distance: groDist });
    }
    if (nearThicken) {
      candidates.push({ type: 'thicken', distance: thickenDist, thickenData: this.readThickenPrompt() });
    }
    if (nearRift) {
      candidates.push({ type: 'rift', distance: riftDist });
    }

    if (candidates.length === 0) return null;

    const order: InteractionTarget['type'][] = [
      'core', 'storage', 'purifier', 'defense', 'growth', 'thicken', 'rift',
    ];
    candidates.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    return candidates[0]!;
  }

  private readThickenPrompt(): NonNullable<InteractionTarget['thickenData']> {
    const tier = gameState.getModuleMaxHpTier();
    const currentMax = gameState.getModuleMaxHp();
    const cost = gameState.getNextModuleMaxHpCost();
    const nextMax = cost === null ? null : currentMax + GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER;
    const reserve = gameState.getKindlingReserve();
    let status: 'affordable' | 'short' | 'capped';
    let shortfall = 0;
    if (cost === null) {
      status = 'capped';
    } else if (reserve >= cost) {
      status = 'affordable';
    } else {
      status = 'short';
      shortfall = cost - reserve;
    }
    return { currentMax, nextMax, tier, cost, shortfall, status };
  }

  private tryRaiseModuleMaxHp(): void {
    if (!gameState.raiseModuleMaxHp()) {
      audioManager.playSFX('sfx-ui-error');
      return;
    }
    purificationHud.flashThickenSuccess();
    purificationHud.refresh();
  }

  private startIsolationBed(): void {
    audioManager.playBGM('bgm-pp-isolation-drone');
    audioManager.playAmbient('amb-pp-mechanical-hum');
  }

  private playImpactAudio(result: ImpactResult): void {
    audioManager.playSFX('sfx-impact-start');
    audioManager.playSFX('sfx-ui-warning');
    audioManager.playBGM('bgm-impact-pressure', 2, { loop: false });
    result.damages.forEach((entry, i) => {
      this.time.delayedCall(200 * (i + 1), () => {
        if (entry.damage === 0) {
          audioManager.playSFX('sfx-impact-survive', { priority: 'low' });
        } else if (entry.newHp === 0) {
          audioManager.playSFX('sfx-impact-break');
        } else {
          audioManager.playSFX('sfx-impact-hit');
        }
      });
    });
  }

  private tickPurificationAudio(time: number, pos: { x: number; y: number }): void {
    if (this.player.isMoving() && time - this.lastStepAt >= 400) {
      this.lastStepAt = time;
      audioManager.playSFX('sfx-shared-player-step-metal', { priority: 'low' });
    }
    const angle = Math.atan2(pos.y - CENTER_Y, pos.x - CENTER_X);
    const radius = this.boundaryShape.radiusAt(angle);
    const distPx = Math.hypot(pos.x - CENTER_X, pos.y - CENTER_Y);
    const tiles = Math.abs(distPx - radius) / TILE;
    if (tiles <= 2 && time - this.lastBoundaryPulseAt >= 10000) {
      this.lastBoundaryPulseAt = time;
      audioManager.playSpatialSFX(
        'sfx-pp-boundary-pulse',
        { x: CENTER_X + Math.cos(angle) * radius, y: CENTER_Y + Math.sin(angle) * radius },
        pos,
      );
    }
  }

  private readonly onGrowthPurchased = (): void => {
    audioManager.playSFX('sfx-ui-click');
  };

  private onPostUpdate(_time: number, delta: number): void {
    this.player.postUpdate();
    this.visibility.update(this.player.getPosition(), this.player.getFacingAngle(), delta);
  }

  private isAnyPanelOpen(): boolean {
    return allocationPanel.isOpen() || defensePanel.isOpen() || growthPanel.isOpen() || loadoutPanel.isOpen() || statusPanel.isOpen() || impactResultPanel.isOpen();
  }

  private openAllocationPanel(moduleId: string): void {
    this.player.setInputEnabled(false);
    allocationPanel.open(moduleId, () => {
      this.player.setInputEnabled(true);
      purificationHud.refresh();
    });
  }

  private openDefensePanel(): void {
    this.player.setInputEnabled(false);
    defensePanel.open(() => {
      this.player.setInputEnabled(true);
      purificationHud.refresh();
    });
  }

  private openGrowthPanel(): void {
    this.player.setInputEnabled(false);
    growthPanel.open(() => {
      this.player.setInputEnabled(true);
      purificationHud.refresh();
    });
  }

  /** A1 + B1: Open the combined status & inventory panel. */
  private openStatusPanel(): void {
    this.player.setInputEnabled(false);
    statusPanel.open(() => {
      this.player.setInputEnabled(true);
    });
  }

  private enterRift(): void {
    if (this.transitioning) return;
    // Show loadout panel first, then transition on confirm
    this.player.setInputEnabled(false);
    loadoutPanel.open(
      () => {
        // Confirm callback: trigger rift entry
        this.transitioning = true;
        this.transitionToRift();
      },
      () => {
        // Cancel callback: re-enable player
        this.player.setInputEnabled(true);
      },
    );
  }

  /** D4: Scene transition with narrative overlay + T10 radial glow. */
  private transitionToRift(): void {
    // Increment cycle before entering
    gameState.incrementCycle();

    const modifiers = gameState.getSortieModifiers();
    const cycle = gameState.getCycle();
    const loadout = contaminantSystem.getSortieLoadout();

    // Save before entering rift (captures loadout selection)
    saveManager.save();

    eventBus.emit(GameEvent.RIFT_ENTERED, { cycle });

    // Inject transition animation styles once
    this.injectTransitionStyles();

    // Phase 1: 0.3s teal radial glow from edges inward
    const glowOverlay = document.createElement('div');
    glowOverlay.id = 'scene-transition-glow';
    glowOverlay.style.cssText = [
      'position:absolute', 'inset:0',
      'z-index:1999', 'pointer-events:none',
      'animation:rift-enter-glow 0.3s ease-in forwards',
    ].join(';');
    getDomUiRoot().appendChild(glowOverlay);

    // Phase 2: After 0.3s, show black screen with text
    setTimeout(() => {
      glowOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = 'scene-transition-overlay';
      overlay.style.cssText = [
        'position:absolute', 'inset:0',
        'z-index:2000', 'background:#000', 'display:flex',
        'align-items:center', 'justify-content:center',
        // C6: was #5a5f66 (metal-light, border/divider-only per A1 V1/V2 - unreadable
        // as text on black). Same bright text colour the chaos-threshold narration uses.
        "font:14px 'Courier New',monospace", 'color:#c8cdd4',
      ].join(';');
      overlay.textContent = '进入裂隙。';
      getDomUiRoot().appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
        this.scene.start('RiftScene', { modifiers, cycle, loadout });
      }, 500);
    }, 300);
  }

  /** Inject CSS keyframes for scene transition animations (idempotent). */
  private injectTransitionStyles(): void {
    if (document.getElementById('scene-transition-styles')) return;
    const style = document.createElement('style');
    style.id = 'scene-transition-styles';
    style.textContent = `
      @keyframes rift-collapse-glow {
        from {
          box-shadow: inset 0 0 0px rgba(0, 180, 160, 0);
          background: transparent;
        }
        to {
          box-shadow: inset 0 0 60px rgba(0, 180, 160, 0.3);
          background: rgba(0, 0, 0, 0.3);
        }
      }
      @keyframes rift-enter-glow {
        from {
          background: radial-gradient(ellipse at center, transparent 60%, rgba(0, 180, 160, 0) 100%);
        }
        to {
          background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 180, 160, 0.25) 100%);
        }
      }
    `;
    document.head.appendChild(style);
  }

  /** D1: Check whether an interaction point should pulse faster (has actionable content). */
  private shouldHighlight(point: 'defense' | 'growth' | 'core' | 'storage' | 'thicken'): boolean {
    const reserve = gameState.getKindlingReserve();
    switch (point) {
      case 'core': {
        const mod = gameState.getModule('CORE');
        return reserve > 0 && mod !== undefined && mod.hp < mod.maxHp;
      }
      case 'storage': {
        const mod = gameState.getModule('STORAGE');
        return reserve > 0 && mod !== undefined && mod.hp < mod.maxHp;
      }
      case 'defense': {
        const all = contaminantSystem.getAll();
        const slotted = contaminantSystem.getDefenseSlotted();
        return all.some((c) => c.stage === 'defense' && !slotted.some((s) => s?.id === c.id));
      }
      case 'growth': {
        return growthSystem.getAllUpgradeIds().some((id) => growthSystem.canAfford(id, reserve));
      }
      case 'thicken': {
        const cost = gameState.getNextModuleMaxHpCost();
        return cost !== null && cost <= reserve;
      }
    }
  }

  /** B3: Show a Channel-B toast (C6 shared primitive) when new tools are available
   *  from transformation. */
  private showNewToolToast(transformResults: { contaminantId: string; type: string; slotIndex: number }[]): void {
    if (transformResults.length === 0) return;

    const names = transformResults.map((r) => getToolName(r.type as ContaminantType));
    const text = `新工具可用: ${names.join(', ')}`;

    showToastInline(text, {
      color: '#2ae6c8',
      extraStyle: "background:rgba(15,17,20,0.92);border:1px solid #1aad96;padding:8px 16px;" +
        "font:12px 'Courier New',monospace;",
    });
  }

  /** C2: Flash the module entity when repair is confirmed. */
  private readonly onAllocationConfirmed = (payload: { allocations: Record<string, number> }): void => {
    const spent = Object.values(payload.allocations).reduce((sum, n) => sum + n, 0);
    if (spent > 0) {
      audioManager.playSFX('sfx-ui-allocate');
      audioManager.playSFX('sfx-shared-module-repair');
    }
    for (const moduleId of Object.keys(payload.allocations)) {
      if (moduleId === 'CORE') {
        this.flashModule(this.coreModule);
      } else if (moduleId === 'STORAGE') {
        this.flashModule(this.storageModule);
      } else if (moduleId === 'PURIFIER') {
        this.flashModule(this.purifierModule);
      }
    }
  };

  private flashModule(mod: PurificationModuleEntity): void {
    const flash = this.add.rectangle(mod.x, mod.y, 30, 30, 0xffffff, 0.7).setDepth(25);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  /** E3: Show stability milestone notifications for changes NOT already folded into
   *  the merged impact-result panel (Slice 5.5 D5) — e.g. buying an upgrade at the
   *  growth altar while standing in the purification point. The extraction-triggered
   *  crossing is handled separately in create() via `findCrossedStabilityMilestone()`,
   *  since this listener is registered after that particular addProgress() call fires
   *  (see the comment at its call site). */
  private readonly onStabilityChanged = (payload: { progress: number; delta: number }): void => {
    const message = this.findCrossedStabilityMilestone(this.lastStabilityMilestone, payload.progress);
    this.lastStabilityMilestone = Math.floor(payload.progress / 25) * 25;
    if (message) this.showStabilityMilestone(message);
  };

  /** World.md 无人称/不描述玩家感受: the old copy had second-person encouragement
   *  ("坚持住"/"终点在望") on the 25/75 lines (IA §S15 类别2) — restated as plain fact. */
  private static readonly STABILITY_MILESTONE_MESSAGES: Record<number, string> = {
    25: '<span style="color:#8a8f96;">稳定度</span> <span style="color:#c8cdd4;font-weight:bold;">25%</span>',
    50: '<span style="color:#8a8f96;">稳定度</span> <span style="color:#c8cdd4;font-weight:bold;">50%</span> <span style="color:#8a8f96;">已过半</span>',
    75: '<span style="color:#8a8f96;">稳定度</span> <span style="color:#c8cdd4;font-weight:bold;">75%</span>',
    100: '净化完成。',
  };

  /** Returns the highest milestone (25/50/75/100) newly crossed between `before` and
   *  `after`, or null if none. Shared by the extraction-triggered path (create()) and
   *  the event-driven path (onStabilityChanged) so the two can never disagree on
   *  wording. Does NOT mutate `lastStabilityMilestone` — callers own that. */
  private findCrossedStabilityMilestone(before: number, after: number): string | null {
    const milestones = [25, 50, 75, 100];
    for (const m of milestones) {
      if (after >= m && before < m) {
        return PurificationScene.STABILITY_MILESTONE_MESSAGES[m] ?? null;
      }
    }
    return null;
  }

  private showStabilityMilestone(message: string): void {
    // C6: was #44aa66 (green) - "绿色=好" has no narrative home in this project's four-
    // layer colour architecture (ui-art-overhaul.md §A2, same reasoning as the CORE
    // module colour fix). Stability progress is a human-side positive outcome, so it
    // takes the warm palette instead, same family as the growth-panel purchase flash.
    showToastInline(message, {
      color: '#e0a848',
      extraStyle: "background:rgba(15,17,20,0.92);padding:8px 16px;" +
        "font:13px 'Courier New',monospace;text-align:center;",
    });
  }

  /** Snapshot current defense slot charge levels before impact application (D2). */
  private snapshotDefenseCharges(): { slotIndex: number; id: string; type: string; charges: number }[] {
    const slots = contaminantSystem.getDefenseSlotted();
    const result: { slotIndex: number; id: string; type: string; charges: number }[] = [];
    for (let i = 0; i < slots.length; i++) {
      const c = slots[i];
      if (c) {
        result.push({ slotIndex: i, id: c.id, type: c.type, charges: c.impactCharges });
      }
    }
    return result;
  }

  /** Compute charge change entries by comparing before snapshot with current state (D2). */
  private computeChargeChanges(
    before: { slotIndex: number; id: string; type: string; charges: number }[],
    transformResults: { contaminantId: string; type: string; slotIndex: number }[],
  ): ChargeChangeEntry[] {
    const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;
    const transformedIds = new Set(transformResults.map((r) => r.contaminantId));
    const changes: ChargeChangeEntry[] = [];

    for (const entry of before) {
      const transformed = transformedIds.has(entry.id);
      // After transformation, the contaminant is no longer in defense slots
      // so we compute the "after" charge from the threshold if transformed
      const allContaminants = contaminantSystem.getAll();
      const current = allContaminants.find((c) => c.id === entry.id);
      const afterCharges = transformed ? threshold : (current?.impactCharges ?? entry.charges);

      changes.push({
        slotIndex: entry.slotIndex,
        type: entry.type as import('@/types/game-types').ContaminantType,
        before: entry.charges,
        after: afterCharges,
        threshold,
        transformed,
      });
    }

    return changes;
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);

    // Clean up event listeners
    eventBus.off(GameEvent.ALLOCATION_CONFIRMED, this.onAllocationConfirmed);
    eventBus.off(GameEvent.GROWTH_PURCHASED, this.onGrowthPurchased);
    eventBus.off(GameEvent.STABILITY_CHANGED, this.onStabilityChanged);
    audioManager.haltNonBgm();

    // Clean up DOM panels
    allocationPanel.close();
    defensePanel.close();
    growthPanel.close();
    loadoutPanel.close();
    statusPanel.close();
    impactResultPanel.destroy();
    pauseMenu.discard();

    // Clean up input keys
    if (this.interactKey) {
      this.input.keyboard?.removeKey(this.interactKey, true);
      this.interactKey = null;
    }
    if (this.escKey) {
      this.input.keyboard?.removeKey(this.escKey, true);
      this.escKey = null;
    }
    if (this.tabKey) {
      this.input.keyboard?.removeKey(this.tabKey, true);
      this.tabKey = null;
    }
    for (const k of this.coreVariantKeys) {
      this.input.keyboard?.removeKey(k, true);
    }
    this.coreVariantKeys = [];

    // Destroy systems
    this.atmosphere.destroy();
    this.breath.destroy();
    this.visibility.destroy();
    this.coreModule.destroy();
    this.storageModule.destroy();
    this.purifierModule.destroy();
    this.player.destroy();
    this.tilemapRenderer.destroy();
    this.riftEntranceGraphics?.destroy();
    this.defenseGraphics?.destroy();
    this.growthGraphics?.destroy();
    this.thickenGraphics?.destroy();

    // Destroy DOM HUD
    purificationHud.destroy();
  }
}
