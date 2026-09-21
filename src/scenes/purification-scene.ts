import { projectItemForPlayer } from '@/systems/contaminant-catalog';
import { itemIconUrl } from '@/ui/contaminant-presentation';
import { createProceduralDeparture, installProceduralRiftRecovery } from '@/managers/rift-recovery';
import type { RiftCheckpoint } from '@/types/rift-checkpoint';
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import { inventoryStore } from '@/systems/inventory-store';
import { getEquipmentLifecycle, type OfferingTransformResult } from '@/types/inventory-types';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { inventoryPanel } from '@/ui/dom/inventory-panel';
import { openInventory, inventoryError } from '@/ui/inventory-presenter';
import { GroundDepthSorter, GROUND_LIGHT_DEPTH, WORLD_READOUT_DEPTH } from '@/systems/ground-depth';
/**
 * Purification Scene - the base management walkable space.
 *
 * A small tilemap (~14x12 tiles) with a circular safe area. The player walks around,
 * interacts with three modules (CORE center, STORAGE right, PURIFIER south) via
 * allocation panels, inscribes upgrades and thickens maxHp at the west growth
 * console, and enters the rift via the north entrance. The boundary features
 * particle atmosphere and periodic apparitions.
 *
 * Reuses Player entity + VisibilitySystem (omni mode). Does NOT use: AI, combat, chaos.
 *
 * Scene data received: { kindlingGained: number, survived: boolean }
 * Scene data sent to RiftScene: { modifiers: SortieModifiers, cycle: number }
 */

import Phaser from 'phaser';
import { MenuEntryTransition } from './menu-entry-transition';
import { GAME_CONSTANTS } from '@/config/constants';
import { ACTIVE_CONTAMINANT_TYPES } from '@/generated/contaminant-data';
import { eventBus } from '@/core/event-bus';
import { Player } from '@/entities/player';
import {
  PurificationCollision, PURIFICATION_PLAYER_BODY,
  PURIFICATION_DEVICE_ANCHORS, PURIFICATION_SPAWN_POINT, destroyStaticCollision,
} from '@/systems/purification-collision';
import {
  CORE_SPRITE_VARIANTS,
  PurificationModuleEntity,
} from '@/entities/purification-module';
import {
  ENTRANCE_DEFAULT_VARIANT,
  ENTRANCE_VARIANTS,
  RiftEntranceVisual,
  readEntranceVariantQuery,
  writeEntranceVariantQuery,
} from '@/scenes/rift-entrance-visual';
import {
  OfferingStandVisual,
  offeringStandChargeFromSlots,
} from '@/scenes/offering-stand-visual';
import { GrowthConsoleVisual } from '@/scenes/growth-console-visual';
import { PurificationRenewalVisual } from '@/scenes/purification-renewal-visual';
import { gameState, type SortieModifiers } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { saveManager } from '@/managers/save-manager';
import { BoundaryAtmosphere } from '@/systems/boundary-atmosphere';
import { BoundaryBreath } from '@/systems/boundary-breath';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { recoverGrowthFacts } from '@/systems/growth-evidence';
import { impactSystem } from '@/systems/impact-system';
import type { ForecastDisplay, ImpactResult } from '@/systems/impact-system';
import {
  createBoundaryShape, BOUNDARY_COLLISION_INNER_SCALE,
  BOUNDARY_COLLISION_SEGMENT_SIZE, BOUNDARY_COLLISION_SAMPLES,
} from '@/systems/boundary-shape';
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
import { createCrtPanel, getDomUiRoot, showToastInline } from '@/ui/dom/panel-styles';
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
const CORE_POS = PURIFICATION_DEVICE_ANCHORS.core;
const STORAGE_POS = PURIFICATION_DEVICE_ANCHORS.storage;
const PURIFIER_POS = PURIFICATION_DEVICE_ANCHORS.purifier;
// 裂隙入口嵌在北侧内壁上。4.0 tile + 1.0 安全区 = 椭圆北沿，不把膜顶出一包。
const RIFT_ENTRANCE_POS = { x: CENTER_X, y: CENTER_Y - 4.0 * TILE };
// Defense management point (south-west)
const DEFENSE_POS = PURIFICATION_DEVICE_ANCHORS.offering;
// Growth altar (west)
const GROWTH_POS = PURIFICATION_DEVICE_ANCHORS.growth;

const INTERACTION_POINTS = [
  CORE_POS, STORAGE_POS, PURIFIER_POS,
  RIFT_ENTRANCE_POS, DEFENSE_POS, GROWTH_POS,
] as const;

const RIFT_CENTER = 0x1aad96;
const RIFT_RING = 0x2ae6c8;
const DEFENSE_CENTER = 0x6644aa;
const DEFENSE_RING = 0x8866cc;
const GROWTH_CENTER = 0xaa6622;
const GROWTH_RING = 0xcc8844;

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
/**
 * 练习场对照课用的落地底：与出击同一份边界 → 瓦片 → 地面纹理。
 * 潮汐取常态（强度 1.0 / 满潮）以免对照图随存档变。只读，不改生产路径。
 */
export function createPurificationFloorTexture(scene: Phaser.Scene, key: string): string {
  const interactionPts = [...INTERACTION_POINTS];
  const shape = createBoundaryShape({
    ellipseRx: ELLIPSE_RX,
    ellipseRy: ELLIPSE_RY,
    tideIntensity: 1.0,
    tidePhase: 'crest',
    pressureSeed: 7919,
    interactionPoints: interactionPts,
    centerX: CENTER_X,
    centerY: CENTER_Y,
  });
  const tileMap = buildPurificationTileMap(shape);
  return createPurificationSurfaceTexture(scene, tileMap, key, shape, interactionPts);
}

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

  for (let i = 0; i < BOUNDARY_COLLISION_SAMPLES; i++) {
    const angle = (i / BOUNDARY_COLLISION_SAMPLES) * Math.PI * 2;
    const r = shape.radiusAt(angle) * BOUNDARY_COLLISION_INNER_SCALE;

    // Place collider blocks outward from the boundary point to form a wall
    // We place 2 blocks deep (8px + 8px = 16px wall thickness) for reliability
    for (let depth = 0; depth < 2; depth++) {
      const rr = r + depth * BOUNDARY_COLLISION_SEGMENT_SIZE;
      const bx = cx + Math.cos(angle) * rr;
      const by = cy + Math.sin(angle) * rr;

      // Create an invisible static rectangle
      const block = scene.add.rectangle(bx, by, BOUNDARY_COLLISION_SEGMENT_SIZE, BOUNDARY_COLLISION_SEGMENT_SIZE);
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

export type WorldInteractionTarget = 'CORE' | 'STORAGE' | 'PURIFIER' | 'defense' | 'growth' | 'rift';

/** DEV routing is prepared before the departure transaction. Production owns all
 * inventory, cycle, save and transition work; the adapter only selects the scene. */
export interface PurificationDepartureData {
  readonly modifiers: SortieModifiers;
  readonly cycle: number;
  readonly loadout: ReturnType<typeof contaminantSystem.getSortieLoadout>;
}
export interface PurificationDevDeparture {
  readonly recoveryIdentity?: import('@/types/rift-checkpoint').RiftCheckpoint['identity'];
  start(data: PurificationDepartureData): void;
  cancel(): void;
}
export interface PurificationDevSession {
  prepareDeparture(): PurificationDevDeparture;
  onPause?(): void;
}

export class PurificationScene extends Phaser.Scene {
  private readonly tilemapRenderer = new TilemapRenderer();
  private readonly player = new Player();
  private unsubscribeWeapon: (() => void) | null = null;
  private unsubscribeForecast: (() => void) | null = null;
  private readonly visibility = new VisibilitySystem();
  private groundDepthSorter: GroundDepthSorter | null = null;
  private deviceCollision: PurificationCollision | null = null;
  private boundaryBodies: Phaser.Physics.Arcade.StaticGroup | null = null;
  private boundaryCollider: Phaser.Physics.Arcade.Collider | null = null;
  private repairGlowModule: PurificationModuleEntity | null = null;
  private readonly atmosphere = new BoundaryAtmosphere();
  private readonly breath = new BoundaryBreath();

  private boundaryShape!: BoundaryShape;

  private coreModule!: PurificationModuleEntity;
  private storageModule!: PurificationModuleEntity;
  private purifierModule!: PurificationModuleEntity;

  /** 贴图缺失时的回落：旧的呼吸圆点。生产外形是地面裂缝贴花（DEC-113）。 */
  private riftEntranceGraphics!: Phaser.GameObjects.Graphics;
  private riftEntrancePulse = 0;
  private riftEntrance: RiftEntranceVisual | null = null;

  // Defense management interaction point（生产外形 = 卡 I 环，DEC-115）
  private defenseGraphics!: Phaser.GameObjects.Graphics;
  private defensePulse = 0;
  private offeringStand: OfferingStandVisual | null = null;

  // Growth altar interaction point（生产外形 = 卡 A 立缸，DEC-116）
  private growthGraphics!: Phaser.GameObjects.Graphics;
  private growthPulse = 0;
  private growthConsole: GrowthConsoleVisual | null = null;
  private renewalVisual: PurificationRenewalVisual | null = null;

  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private saveRetryTimer: number | null = null;
  private tabKey: Phaser.Input.Keyboard.Key | null = null;
  // 核心抽卡方案切换（实测用）：1/2/3 -> A 敬畏 / B 仪式 / C 封印
  private coreVariantKeys: Phaser.Input.Keyboard.Key[] = [];
  // 裂隙入口外形对照（实测用）：4/5/7/8/9 -> 卡 4 地缝（对照）/ 5 击裂（生产默认）/ 7 错位 / 8 掀皮 / 9 网裂
  private entranceVariantKeys: Phaser.Input.Keyboard.Key[] = [];
  private transitioning = false;
  private devSession: PurificationDevSession | null = null;
  private productionDeparture: RiftCheckpoint['identity'] | null = null;
  private interactionPlayerAlpha: number | null = null;
  private devDeparture: PurificationDevDeparture | null = null;
  private menuEntry: MenuEntryTransition | null = null;
  private transitionDelay: Phaser.Time.TimerEvent | null = null;
  private transitionOverlay: HTMLDivElement | null = null;
  private interactionFocusReturn: { scrollX: number; scrollY: number; zoom: number } | null = null;
  private interactionFocusTween: Phaser.Tweens.Tween | null = null;
  private readonly interactionWorldPoint = { x: 0, y: 0 };
  private interactionModule: PurificationModuleEntity | null = null;
  private coreRepairGlow: Phaser.GameObjects.Image | null = null;
  private readonly interactionScreenAnchor = { x: 0, y: 0 };
  private shuttingDown = false;
  private cleanupComplete = false;
  private cleanupStage = 'ready';
  private panelClosedAt = 0;
  private lastStepAt = -1000;
  private lastBoundaryPulseAt = -10000;
  /** Same nearest overlap as the prompt bar; passed into 存续报告身份带. */
  private lastOverlapType: InteractionTarget['type'] | null = null;

  // E3: Track stability milestones already shown
  private lastStabilityMilestone = 0;

  constructor() {
    super({ key: 'PurificationScene' });
  }

  create(data?: { kindlingGained?: number; survived?: boolean; fromMenu?: boolean; menuEntry?: MenuEntryTransition; devSession?: PurificationDevSession }): void {
    this.shuttingDown = false;
    this.cleanupComplete = false;
    this.devSession = import.meta.env?.DEV ? data?.devSession ?? null : null;
    this.devDeparture = null;
    this.productionDeparture = null;
    this.menuEntry = data?.menuEntry ?? null;
    // Determine if this is a return from rift (vs. menu/load entry)
    const ledger = inventoryStore.getRun();
    const isReturnFromRift = ledger?.status === 'settled' ? !ledger.baseSettled : !data?.fromMenu && data?.kindlingGained !== undefined;
    const survived = ledger?.status === 'settled' ? ledger.outcome === 'extract' : data?.survived;
    const kindlingGained = ledger?.status === 'settled' ? ledger.kindlingGained ?? 0 : data?.kindlingGained ?? 0;

    // Stability milestone crossed by this visit's extraction bonus, if any (Slice 5.5
    // D5: this used to fire through the STABILITY_CHANGED event, but the listener is
    // registered later in create() — after this addProgress() call — so it never
    // actually reached `onStabilityChanged` (a pre-existing gap this batch closes by
    // computing the crossing here, directly, instead of relying on the event for this
    // particular trigger). Captured before/after so the merged notice below reports
    // exactly what changed on this return, no more/no less.
    let stabilityMilestoneMessage: string | null = null;

    // Impact only triggers on return from rift, not on menu/load entry
    let impactResult: ReturnType<typeof impactSystem.run> = { skipped: true, damages: [], intensity: 0 };
    let chargeChanges: ChargeChangeEntry[] = [];
    let phaseChange: PhaseChangeInfo | null = null;
    let transformResults: OfferingTransformResult[] = [];
    // Captured BEFORE run() consumes/regenerates the forecast, so this is exactly what
    // the player saw on their way out — the prediction this impact is judged against
    // (Slice 5.5 D5 "预告 vs 实际", IA §S8).
    let predictedForecast: ForecastDisplay | null = null;

    const recoveryReturn = isReturnFromRift && ledger;
    const impactRandom = recoveryReturn ? new SeededRandom(mix32(0, `return:${ledger.id}:impact`)) : null;
    const forecastRandom = recoveryReturn ? new SeededRandom(mix32(0, `return:${ledger.id}:forecast`)) : null;
    const saved = saveManager.commitWorldTransaction(() => {
    growthSystem.recordReturn(recoverGrowthFacts(inventoryStore.getState(), tideSystem.getState(), gameState.getCycle()));
    // Credit kindling from the rift run (spec rule 10)
    if (isReturnFromRift && survived && kindlingGained > 0) {
      gameState.addKindling(kindlingGained);
    }

    if (isReturnFromRift) {
      // Sync impact intensity from tide system
      gameState.setImpactIntensity(tideSystem.getCurrentIntensity());

      // Snapshot defense slot charges before applying impact (for D2 visualization)
      const chargesBefore = this.snapshotDefenseCharges();

      // Every offered item participates in this impact before completing its offering.
      const offeringIds = inventoryStore.getOfferingItems().map(item => item?.id ?? null);
      const isHighTide = tideSystem.isHighTide();
      predictedForecast = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'));
      impactResult = impactSystem.run(contaminantSystem.getDefenseSlotted(), offeringIds, impactRandom ? () => impactRandom.next() : undefined, stabilityTracker.getProgress());
      if (!impactResult.skipped) {
        const finished = contaminantSystem.finishOfferingImpact(isHighTide, impactResult.defenseResult?.bonusCharges ?? {}, offeringIds, `impact:${ledger?.id ?? gameState.getCycle()}`);
        if (!finished.ok) throw new Error(`Offering settlement failed: ${finished.error}`);
        transformResults = finished.value;
        chargeChanges = this.computeChargeChanges(chargesBefore, transformResults);
      }

      // Advance tide cycle after impact resolves (E1: capture phase change)
      phaseChange = tideSystem.advanceCycle(gameState.getModules().every(module => module.hp > 0) && !(impactResult.newlyZeroModules ?? 0));
      growthSystem.recordReturn({
        impactOccurred: !impactResult.skipped,
        offeringCompleted: transformResults.length > 0,
        toolRevealed: transformResults.some(result => {
          const item = inventoryStore.getItem(result.itemId);
          return item?.kind === 'contaminant' && projectItemForPlayer(item.contaminant).slot !== null;
        }),
        leftFiniteCrest: phaseChange?.from === 'crest' && phaseChange.to !== 'crest',
      });
      const beforeProgress = stabilityTracker.getProgress();
      stabilityTracker.recordReturn({ extracted: !!survived, newlyZeroModules: impactResult.newlyZeroModules ?? 0, phaseChange });
      stabilityMilestoneMessage = this.findCrossedStabilityMilestone(beforeProgress, stabilityTracker.getProgress());
    }

    // Generate the non-spatial forecast (target module + severity) for the NEXT impact
    // (DEC-034), plus retrograde's extra lookahead layer for the impact after that (previewed
    // via a pure, RNG-free peek at tide state). Intensity/clarity/peek are read here and
    // passed in so impact-system.ts doesn't import tideSystem/growthSystem directly
    // (DEC-ARCH-002) — see its generateForecast() doc.
    impactSystem.generateForecast(
      tideSystem.getCurrentIntensity(),
      growthSystem.getModifiers().forecastClarity,
      tideSystem.peekNextIntensity(),
      forecastRandom ? () => forecastRandom.next() : undefined,
    );

    if (isReturnFromRift && ledger?.status === 'settled') inventoryStore.markBaseSettled();
    inventoryStore.ensureStarter(recoveryReturn ? `WPN_replacement:${ledger.id}` : undefined);
    });

    this.transitioning = false;

    // E3: Initialize stability milestone tracker
    this.lastStabilityMilestone = Math.floor(stabilityTracker.getProgress() / 25) * 25;

    // Build dynamic boundary shape from current tide state
    const tideState = tideSystem.getState();
    const interactionPts = [...INTERACTION_POINTS];
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
    this.boundaryBodies = createBlobCollider(this, this.boundaryShape);

    this.physics.world.setBounds(0, 0, WIDTH_PX, HEIGHT_PX);

    // Camera — no bounds constraint; the visibility mask handles what's shown.
    // Without this the camera can't center the map when viewport > map size.
    const camera = this.cameras.main;
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(0x0a0a0a);

    // Player
    this.player.create(this, { spawn: PURIFICATION_SPAWN_POINT, depth: 30, facing: 'up', body: PURIFICATION_PLAYER_BODY });
    const syncWeapon = (): void => {
      const id = inventoryStore.getEquipment().weaponId;
      const item = id ? inventoryStore.getItem(id) : undefined;
      const weapon = item?.kind === 'weapon' ? WEAPON_DATA[item.weapon.definitionId] : undefined;
      this.player.setWeaponVisual(weapon?.quality ?? null, weapon?.variant ?? 'standard');
    };
    syncWeapon();
    this.unsubscribeWeapon = inventoryStore.subscribe(syncWeapon);
    this.boundaryCollider = this.physics.add.collider(this.player.getSprite(), this.boundaryBodies);
    this.deviceCollision = new PurificationCollision(this, this.player.getSprite(), {
      core: CORE_POS, storage: STORAGE_POS, purifier: PURIFIER_POS,
      offering: DEFENSE_POS, growth: GROWTH_POS,
    });
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
    // 裂隙入口 = 地面裂缝贴花（DEC-114，生产默认卡 5 击裂）。
    // `?entrance=4|7|8|9` 只用来看对照，不改生产默认。
    this.riftEntrance = new RiftEntranceVisual(this, RIFT_ENTRANCE_POS.x, RIFT_ENTRANCE_POS.y);
    this.riftEntrance.mount(readEntranceVariantQuery() ?? ENTRANCE_DEFAULT_VARIANT);
    this.defenseGraphics = this.add.graphics().setDepth(20);
    this.offeringStand = new OfferingStandVisual(this, DEFENSE_POS.x, DEFENSE_POS.y);
    this.offeringStand.mount(
      offeringStandChargeFromSlots(inventoryStore.getOfferingItems()),
    );
    this.growthGraphics = this.add.graphics().setDepth(20);
    this.growthConsole = new GrowthConsoleVisual(this, GROWTH_POS.x, GROWTH_POS.y);
    this.growthConsole.mount();
    this.renewalVisual = new PurificationRenewalVisual(this);
    this.syncInvestmentVisuals();
    this.riftEntranceGraphics.setDepth(1);
    this.groundDepthSorter = new GroundDepthSorter([
      ...[this.coreModule, this.storageModule, this.purifierModule].map(mod => ({
        id: mod.id, groundY: () => mod.y,
        applyDepth: (depth: number) => {
          mod.setGroundDepth(depth, GROUND_LIGHT_DEPTH, WORLD_READOUT_DEPTH);
          if (mod === this.storageModule) this.renewalVisual?.setStorageDepth(depth);
        },
      })),
      { id: 'offering', groundY: () => DEFENSE_POS.y, applyDepth: depth => {
        this.offeringStand?.setDepth(depth); this.defenseGraphics.setDepth(depth);
      } },
      { id: 'growth', groundY: () => GROWTH_POS.y, applyDepth: depth => {
        this.growthConsole?.setDepth(depth); this.growthGraphics.setDepth(depth);
      } },
      { id: 'player', groundY: () => this.player.getGroundY(),
        applyDepth: depth => this.player.setGroundDepth(depth, GROUND_LIGHT_DEPTH) },
    ]);
    this.groundDepthSorter.update();

    // Purification HUD (DOM overlay)
    purificationHud.create(() => this.openStatusPanel());
    purificationHud.refresh();
    this.unsubscribeForecast = inventoryStore.subscribe(() => {
      impactSystem.generateForecast(tideSystem.getCurrentIntensity(), growthSystem.getModifiers().forecastClarity,
        tideSystem.peekNextIntensity());
      purificationHud.refresh();
    });
    if (this.menuEntry) {
      purificationHud.setEntryVisible(false);
      this.player.setInputEnabled(false);
      this.player.getSprite().setVelocity(0, 0);
    }

    // Boundary atmosphere + breathing overlay
    this.atmosphere.create(this, this.boundaryShape);
    this.breath.create(this, this.boundaryShape, tideState.phase);

    // Input
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, true, false);
      this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, true, false);
      this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB, true, false);
      // 1/2/3 切核心对照（生产默认 B）；4/5/7/8/9 切裂隙入口（生产默认卡 5）
      this.coreVariantKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE, true, false),
      ];
      this.entranceVariantKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EIGHT, true, false),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NINE, true, false),
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
    // Exemption suppresses damage, not the return report. Snapshot unchanged HP
    // for the first return without asking the impact/defense systems to run again.
    const reportDamages = impactResult.skipped
      ? gameState.getModules().map(module => ({ moduleId: module.id, damage: 0, newHp: module.hp }))
      : impactResult.damages;
    let arrivalPublished = false;
    const publishArrival = () => {
      if (this.shuttingDown || arrivalPublished) return;
      arrivalPublished = true;
      if (isReturnFromRift) {
        if (!impactResult.skipped) {
          this.playImpactAudio(impactResult);
          this.cameras.main.shake(300, 0.005);
        }
        this.player.setInputEnabled(false);
        impactResultPanel.show(reportDamages, impactResult.intensity, () => {
          this.consumeEntryKeys();
          this.panelClosedAt = this.time.now;
          this.player.setInputEnabled(!this.menuEntry && !saveManager.hasPendingSave());
          purificationHud.refresh();
          this.startIsolationBed();
          // B3: Show new tool toast after the merged panel is dismissed (Channel B —
          // non-blocking, so it doesn't re-introduce a second confirmation step).
          this.showNewToolToast(transformResults);
        }, {
          firstReturnExempt: impactResult.skipped,
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
        if (!this.menuEntry) this.player.setInputEnabled(true);
      }
    };
    // A reveal is knowledge the player cannot unlearn. Publish it only after the
    // same settled candidate is durable; retry saving, never run the impact twice.
    if (saved) publishArrival();
    else {
      this.player.setInputEnabled(false);
      this.requestSaveRetry(publishArrival);
    }
    this.menuEntry?.arrive(this,
      () => purificationHud.setEntryVisible(true),
      () => {
        this.consumeEntryKeys();
        this.menuEntry = null;
        this.player.setInputEnabled(!saveManager.hasPendingSave() && !impactResultPanel.isOpen());
      },
    );
  }

  private consumeEntryKeys(): void {
    if (this.interactKey) Phaser.Input.Keyboard.JustDown(this.interactKey);
    if (this.escKey) Phaser.Input.Keyboard.JustDown(this.escKey);
    if (this.tabKey) Phaser.Input.Keyboard.JustDown(this.tabKey);
    for (const key of this.coreVariantKeys) Phaser.Input.Keyboard.JustDown(key);
    for (const key of this.entranceVariantKeys) Phaser.Input.Keyboard.JustDown(key);
  }

  update(time: number, delta: number): void {
    if (this.transitioning || this.shuttingDown) return;

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
    const radius = GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;

    const nearRift = riftDist <= radius;
    const nearDefense = defDist <= radius;
    const nearGrowth = groDist <= radius;

    const target = this.findNearestTarget(
      nearRift, nearDefense, nearGrowth,
      riftDist, defDist, groDist,
    );
    this.lastOverlapType = target?.type ?? null;
    purificationHud.updatePrompt(target);

    // Hide prompt when a panel is open
    purificationHud.setPromptVisible(!this.isAnyPanelOpen());

    // --- Draw interaction points (unified breathing circles) ---

    // Rift entrance：生产外形是地面裂缝贴花。只有贴图缺失才回落呼吸圆点。
    const riftHighlight = false; // rift always available
    const riftSpeed = nearRift ? BREATH_SPEED_NEAR : BREATH_SPEED_NORMAL;
    this.riftEntrancePulse += delta * riftSpeed;
    if (this.riftEntrance?.isShowing()) {
      this.riftEntranceGraphics.setVisible(false);
      this.riftEntranceGraphics.clear();
    } else {
      this.riftEntranceGraphics.setVisible(true);
      drawInteractionPoint(
        this.riftEntranceGraphics,
        RIFT_ENTRANCE_POS.x, RIFT_ENTRANCE_POS.y,
        RIFT_CENTER, RIFT_RING,
        8, 14,
        this.riftEntrancePulse,
        riftHighlight,
        nearRift,
      );
    }

    // Defense point：生产外形是卡 I 环。只有贴图缺失才回落呼吸圆点。
    const defHighlight = this.shouldHighlight('defense');
    const defSpeed = defHighlight ? BREATH_SPEED_HIGHLIGHT : (nearDefense ? BREATH_SPEED_NEAR : BREATH_SPEED_NORMAL);
    this.defensePulse += delta * defSpeed;
    this.offeringStand?.setCharge(
      offeringStandChargeFromSlots(inventoryStore.getOfferingItems()),
    );
    const tidePhase = tideSystem.getState().phase;
    this.offeringStand?.setPressure(tidePhase === 'crest' ? 1 : tidePhase === 'rise' ? .5 : .1);
    if (this.offeringStand?.isShowing()) {
      this.defenseGraphics.setVisible(false);
      this.defenseGraphics.clear();
    } else {
      this.defenseGraphics.setVisible(true);
      drawInteractionPoint(
        this.defenseGraphics,
        DEFENSE_POS.x, DEFENSE_POS.y,
        DEFENSE_CENTER, DEFENSE_RING,
        7, 12,
        this.defensePulse,
        defHighlight,
        nearDefense,
      );
    }

    // Growth altar：生产外形是卡 A 立缸。只有贴图缺失才回落呼吸圆点。
    const groHighlight = this.shouldHighlight('growth');
    const groSpeed = groHighlight ? BREATH_SPEED_HIGHLIGHT : (nearGrowth ? BREATH_SPEED_NEAR : BREATH_SPEED_NORMAL);
    this.growthPulse += delta * groSpeed;
    if (this.growthConsole?.isShowing()) {
      this.growthGraphics.setVisible(false);
      this.growthGraphics.clear();
    } else {
      this.growthGraphics.setVisible(true);
      drawInteractionPoint(
        this.growthGraphics,
        GROWTH_POS.x, GROWTH_POS.y,
        GROWTH_CENTER, GROWTH_RING,
        7, 12,
        this.growthPulse,
        groHighlight,
        nearGrowth,
      );
    }

    // Atmosphere + breathing overlay
    this.atmosphere.update(delta);
    this.breath.update(delta);

    // Keep the world alive while discarding button edges during the entry.
    // Retain held-key state so OS repeat cannot become a fresh E/Esc/Tab press.
    if (this.menuEntry) {
      this.consumeEntryKeys();
      return;
    }

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
      const coreVariant = CORE_SPRITE_VARIANTS[i];
      if (coreVariant) this.coreModule?.setCoreVariant(coreVariant);
    }

    // 4/5/7/8/9 切裂隙入口外形对照（生产默认仍是卡 4，只改本次观看）
    for (let i = 0; i < this.entranceVariantKeys.length; i++) {
      const key = this.entranceVariantKeys[i];
      const variant = ENTRANCE_VARIANTS[i];
      if (!key || !variant || !this.riftEntrance) continue;
      if (!Phaser.Input.Keyboard.JustDown(key)) continue;
      this.riftEntrance.mount(variant);
      writeEntranceVariantQuery(variant);
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
    inventoryPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (statusPanel.isOpen()) {
        statusPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (!this.interactionFocusReturn && !pauseMenu.isOpen() && this.time.now - this.panelClosedAt > 150) {
        if (this.devSession?.onPause) this.devSession.onPause();
        else pauseMenu.open(this);
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

  /** Isolated journey diagnostics only. No commands, inventory writes or position setters. */
  probeJourneyState(): Record<string, unknown> | null {
    if (!import.meta.env?.DEV || this.shuttingDown) return null;
    return { player: { ...this.player.getPosition() }, transitioning: this.transitioning,
      pendingSave: saveManager.hasPendingSave(),
      devices: { core: { ...CORE_POS }, storage: { ...STORAGE_POS }, purifier: { ...PURIFIER_POS },
        entrance: { ...RIFT_ENTRANCE_POS }, offering: { ...DEFENSE_POS }, growth: { ...GROWTH_POS } },
      panels: { inventory: inventoryPanel.isOpen(), status: statusPanel.isOpen(), offering: defensePanel.isOpen(),
        impact: impactResultPanel.isOpen(), allocation: allocationPanel.isOpen(), growth: growthPanel.isOpen() } };
  }

  // ------------------------------------------------------------------ private

  private distTo(pos: { x: number; y: number }, target: { x: number; y: number }): number {
    const dx = pos.x - target.x;
    const dy = pos.y - target.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Find the nearest in-range interaction target for the prompt bar. */
  private findNearestTarget(
    nearRift: boolean, nearDefense: boolean, nearGrowth: boolean,
    riftDist: number, defDist: number, groDist: number,
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
    if (nearRift) {
      candidates.push({ type: 'rift', distance: riftDist });
    }

    if (candidates.length === 0) return null;

    const order: InteractionTarget['type'][] = [
      'core', 'storage', 'purifier', 'defense', 'growth', 'rift',
    ];
    candidates.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    return candidates[0]!;
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
    this.syncInvestmentVisuals();
    purificationHud.refresh();
  };

  private onPostUpdate(_time: number, delta: number): void {
    if (this.shuttingDown) return;
    this.player.postUpdate();
    this.groundDepthSorter?.update();
    if (this.coreRepairGlow && this.repairGlowModule) {
      this.coreRepairGlow.setDepth(this.repairGlowModule.getBodyDepth() + 0.4);
    }
    this.visibility.update(this.player.getPosition(), this.player.getFacingAngle(), delta);
  }

  private isAnyPanelOpen(): boolean {
    return inventoryPanel.isOpen() || saveManager.hasPendingSave() || this.interactionFocusReturn !== null || allocationPanel.isOpen() || defensePanel.isOpen() || growthPanel.isOpen() || loadoutPanel.isOpen() || statusPanel.isOpen() || impactResultPanel.isOpen();
  }

  private openAllocationPanel(moduleId: 'CORE' | 'STORAGE' | 'PURIFIER'): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    const mod = moduleId === 'CORE' ? this.coreModule : moduleId === 'STORAGE' ? this.storageModule : this.purifierModule;
    this.focusWorldInteraction(mod, 320, mod);
    allocationPanel.open(moduleId, () => this.restoreInteractionFocus(), { getAnchor: this.getInteractionScreenAnchor });
  }

  /** Review controls and proximity interaction share the same production paths. */
  public openWorldInteraction(target: WorldInteractionTarget): void {
    switch (target) {
      case 'CORE': case 'STORAGE': case 'PURIFIER': this.openAllocationPanel(target); break;
      case 'defense': this.openDefensePanel(); break;
      case 'growth': this.openGrowthPanel(); break;
      case 'rift': this.enterRift(); break;
    }
  }

  /** A review screen switch must not leave a restore tween in a paused scene. */
  public cancelWorldInteraction(): void {
    this.restoreInteractionFocus(true);
  }

  public openCoreAllocationSample(): void {
    this.openWorldInteraction('CORE');
  }

  public cancelCoreAllocationSample(): void {
    this.cancelWorldInteraction();
  }

  private readonly getInteractionScreenAnchor = (): { x: number; y: number } => {
    const camera = this.cameras.main;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    // Phaser zooms around the viewport origin, not its top-left corner.
    this.interactionScreenAnchor.x = camera.x + originX + (this.interactionWorldPoint.x - camera.scrollX - originX) * camera.zoom;
    this.interactionScreenAnchor.y = camera.y + originY + (this.interactionWorldPoint.y - camera.scrollY - originY) * camera.zoom;
    return this.interactionScreenAnchor;
  };

  private focusWorldInteraction(point: Readonly<{ x: number; y: number }>, screenX: number, mod: PurificationModuleEntity | null = null): void {
    this.player.setInputEnabled(false);
    const actor = this.player.getSprite();
    if (actor.y >= point.y && Math.hypot(actor.x - point.x, actor.y - point.y) < 48) {
      this.interactionPlayerAlpha = actor.alpha; actor.setAlpha(.3);
    }
    this.interactionWorldPoint.x = point.x;
    this.interactionWorldPoint.y = point.y;
    this.interactionModule = mod;
    mod?.setInteractionReadoutActive(true);
    const camera = this.cameras.main;
    this.interactionFocusReturn = { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
    const zoom = 3;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    this.interactionFocusTween = this.tweens.add({
      targets: camera,
      zoom,
      scrollX: point.x - originX - (screenX - camera.x - originX) / zoom,
      scrollY: point.y - originY - (330 - camera.y - originY) / zoom,
      duration: 260,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.interactionFocusTween = null; },
    });
  }

  private restoreInteractionFocus(immediate = false): void {
    if (this.interactionPlayerAlpha !== null) {
      const actor = this.player.getSprite();
      if (actor?.scene) actor.setAlpha(this.interactionPlayerAlpha);
      this.interactionPlayerAlpha = null;
    }
    // CameraManager handles SHUTDOWN before this scene listener. Its main camera
    // has already been removed; discard our snapshot instead of touching it.
    if (this.shuttingDown) {
      this.interactionFocusReturn = null;
      this.interactionFocusTween = null;
      this.interactionModule = null;
      return;
    }
    const previous = this.interactionFocusReturn;
    if (!previous) return;
    this.interactionFocusTween?.stop();
    this.interactionFocusTween = null;
    const finish = (): void => {
      this.interactionModule?.setInteractionReadoutActive(false);
      this.interactionModule = null;
      this.interactionFocusReturn = null;
      this.interactionFocusTween = null;
      if (this.shuttingDown) return;
      this.panelClosedAt = this.time.now;
      this.player.setInputEnabled(!this.isAnyPanelOpen());
      purificationHud.refresh();
    };
    if (immediate || this.shuttingDown) {
      this.cameras.main.setScroll(previous.scrollX, previous.scrollY).setZoom(previous.zoom);
      finish();
      return;
    }
    this.interactionFocusTween = this.tweens.add({
      targets: this.cameras.main,
      ...previous,
      duration: 180,
      ease: 'Sine.easeInOut',
      onComplete: finish,
    });
  }

  private openDefensePanel(): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.focusWorldInteraction(DEFENSE_POS, 184);
    defensePanel.open(() => this.restoreInteractionFocus(), { getAnchor: this.getInteractionScreenAnchor });
  }

  private openGrowthPanel(): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.focusWorldInteraction(GROWTH_POS, 184);
    growthPanel.open(() => this.restoreInteractionFocus(), { getAnchor: this.getInteractionScreenAnchor });
  }

  /** A1 + B1: Open the combined status & inventory panel. */
  private openStatusPanel(): void {
    if (this.isAnyPanelOpen() || pauseMenu.isOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.player.setInputEnabled(false);
    statusPanel.open(() => {
      this.player.setInputEnabled(true);
    }, this.lastOverlapType, () => this.openOfferingFromInventory());
  }

  private enterRift(): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.focusWorldInteraction(RIFT_ENTRANCE_POS, 184);
    const sprite = this.player.getSprite();
    const portrait = document.createElement('canvas'); portrait.width = sprite.frame.cutWidth; portrait.height = sprite.frame.cutHeight;
    portrait.getContext('2d')?.drawImage(sprite.texture.getSourceImage() as CanvasImageSource, sprite.frame.cutX, sprite.frame.cutY, portrait.width, portrait.height, 0, 0, portrait.width, portrait.height);
    openInventory({ mode: 'prepare', portrait: portrait.toDataURL(), onClose: () => this.restoreInteractionFocus(),
      onDepart: () => this.transitionToRift(),
      onOffering: () => this.openOfferingFromInventory(),
    });
  }

  private openOfferingFromInventory(): void {
    // Finish the entrance camera's return before focusing the offering device.
    this.time.delayedCall(220, () => {
      if (!this.shuttingDown) this.openDefensePanel();
    });
  }

  private requestSaveRetry(onSaved?: () => void): void {
    if (this.saveRetryTimer !== null) return;
    const notice = createCrtPanel('save-retry-notice');
    notice.style.cssText = 'left:360px;top:584px;width:240px;height:auto;padding:8px;z-index:3000;pointer-events:auto';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'action-btn';
    retry.textContent = '尚未保存 · 点击重试';
    notice.append(retry);
    getDomUiRoot().append(notice);
    retry.onclick = () => { if (saveManager.trySave()) { notice.remove(); this.saveRetryTimer = null; onSaved?.(); } };
    this.saveRetryTimer = 1;
    retry.focus();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { notice.remove(); this.saveRetryTimer = null; });
  }

  /** D4: Scene transition with narrative overlay + T10 radial glow. */
  private transitionToRift(): void {
    if (this.transitioning || saveManager.hasPendingSave()) return;
    if (contaminantSystem.getSortieLoadout().some(item => item && item.type !== 'catalog' && !ACTIVE_CONTAMINANT_TYPES.includes(item.type))) {
      showToastInline('行装中有已封存的旧式工具。请先将它卸下，再进入裂隙；物件仍会保留在储藏中。', {});
      return;
    }
    try {
      this.devDeparture = this.devSession?.prepareDeparture() ?? null;
      if (!this.devSession) { installProceduralRiftRecovery(); this.productionDeparture = createProceduralDeparture(); }
    }
    catch (reason) { showToastInline(reason instanceof Error ? reason.message : String(reason), {}); return; }
    let error: string | null = null;
    const saved = saveManager.commitWorldTransaction(() => {
      const begun = inventoryStore.beginRun(crypto.randomUUID(), this.productionDeparture ? {
        catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2,
      } : undefined);
      if (!begun.ok) { error = inventoryError(begun.error); return; }
      gameState.incrementCycle();
      const identity = this.devDeparture?.recoveryIdentity ?? this.productionDeparture;
      if (identity) saveManager.recordRiftDeparture({ version: 1, runId: inventoryStore.getRun()!.id,
        identity, conditions: { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle() } });
    });
    if (error) { this.devDeparture?.cancel(); this.devDeparture = null; showToastInline(error, {}); return; }
    if (!saved) { this.requestSaveRetry(() => this.finishRiftDeparture()); return; }
    this.finishRiftDeparture();
  }

  private finishRiftDeparture(): void {
    inventoryPanel.close();
    this.transitioning = true;
    const modifiers = gameState.getSortieModifiers();
    const cycle = gameState.getCycle();
    const loadout = contaminantSystem.getSortieLoadout();

    // Save before entering rift (captures loadout selection)
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
    this.transitionOverlay = glowOverlay;

    // Phase 2: After 0.3s, show black screen with text
    this.transitionDelay = this.time.delayedCall(300, () => {
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
      this.transitionOverlay = overlay;

      this.transitionDelay = this.time.delayedCall(500, () => {
        this.transitionDelay = null;
        // scene.start is queued until the next frame. Stop drawing this scene
        // before removing the cover and disposing its actors, or the remaining
        // ground renders alone for one frame. Systems.start restores visibility.
        this.sys.setVisible(false);
        overlay.remove();
        this.transitionOverlay = null;
        const departure = this.devDeparture;
        this.devDeparture = null; // A synchronous scene shutdown must not cancel the handed-off run.
        // Dispose owned callbacks while Phaser's scene plugins are still alive.
        // SHUTDOWN remains a once-only fallback for menu/load transitions.
        try {
          const cleanupError = this.onShutdown();
          if (cleanupError) throw cleanupError;
          if (departure) departure.start({ modifiers, cycle, loadout });
          else this.scene.start('RiftScene', { modifiers, cycle, loadout, recovery: this.productionDeparture ? { identity: this.productionDeparture, externalTargetIds: [] } : undefined });
        } catch (reason) {
          console.error(`Purification departure cleanup failed at ${this.cleanupStage}; saved departure retained`, reason);
          this.scene.start('MainMenuScene', { recoveryError: '场景切换未完成，原出行记录已保留。' });
        }
      });
    });
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
  private shouldHighlight(point: 'defense' | 'growth' | 'core' | 'storage'): boolean {
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
        return inventoryStore.getItems().some(item => item.location.kind === 'stash' && getEquipmentLifecycle(item).stage === 'defense');
      }
      case 'growth': {
        const next = growthSystem.getNextStep();
        return next !== null && next.unlocked && reserve >= next.cost;
      }
    }
  }

  /** B3: Show a Channel-B toast (C6 shared primitive) when new tools are available
   *  from transformation. */
  private showNewToolToast(transformResults: OfferingTransformResult[]): void {
    if (transformResults.length === 0) return;

    const names = transformResults.map(r => { const item = inventoryStore.getItem(r.itemId); return item?.kind === 'contaminant' ? projectItemForPlayer(item.contaminant).name : WEAPON_DATA[r.definitionId]?.name ?? '物件'; });
    const text = `供奉完成：${names.join('、')}。已揭晓并收入储藏。`;

    showToastInline(text, {
      color: '#2ae6c8',
      extraStyle: "background:rgba(15,17,20,0.92);border:1px solid #1aad96;padding:8px 16px;" +
        "font:12px 'Courier New',monospace;",
    });
  }

  /** C2: Flash the module entity when repair is confirmed. */
  private readonly onAllocationConfirmed = (payload: { allocations: Record<string, number> }): void => {
    this.syncInvestmentVisuals();
    const spent = Object.values(payload.allocations).reduce((sum, n) => sum + n, 0);
    if (spent > 0) {
      audioManager.playSFX('sfx-ui-allocate');
      audioManager.playSFX('sfx-shared-module-repair');
    }
    for (const moduleId of Object.keys(payload.allocations)) {
      if (moduleId === 'CORE') {
        if ((payload.allocations[moduleId] ?? 0) > 0) this.pulseModuleRepair(this.coreModule);
      } else if (moduleId === 'STORAGE') {
        this.pulseModuleRepair(this.storageModule);
      } else if (moduleId === 'PURIFIER') {
        this.pulseModuleRepair(this.purifierModule, 0x80b39e);
      }
    }
  };

  /** Persistent additions update only after a saved investment/repair or scene creation. */
  private syncInvestmentVisuals(): void {
    const fraction = (id: string): number => {
      const module = gameState.getModule(id);
      return module && module.maxHp > 0 ? module.hp / module.maxHp : 0;
    };
    this.renewalVisual?.setState({ moduleHealth: {
      core: fraction('CORE'), purifier: fraction('PURIFIER'), storage: fraction('STORAGE'),
    }, thickenLevel: gameState.getModuleMaxHpTier() });
    this.growthConsole?.setInvestment(growthSystem.getState().upgrades);
  }

  private pulseModuleRepair(mod: PurificationModuleEntity, tint = 0xc5a47a): void {
    // Reuse the module's existing soft light texture; never redraw the device.
    if (!this.textures.exists('fx-core-glow')) return;
    if (this.coreRepairGlow) {
      this.tweens.killTweensOf(this.coreRepairGlow);
      this.coreRepairGlow.destroy();
    }
    const glow = this.add.image(mod.x, mod.y - 11, 'fx-core-glow')
      .setDepth(mod.getBodyDepth() + 0.4).setBlendMode(Phaser.BlendModes.ADD).setTintFill(tint).setScale(0.45).setAlpha(0);
    this.coreRepairGlow = glow;
    this.repairGlowModule = mod;
    this.tweens.add({
      targets: glow,
      alpha: 0.38,
      scale: 0.7,
      duration: 250,
      yoyo: true,
      hold: 60,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        glow.destroy();
        if (this.coreRepairGlow === glow) this.coreRepairGlow = null;
      },
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
  private snapshotDefenseCharges(): { slotIndex: number; id: string; type: ContaminantType | null; weaponDefinitionId?: string; publicName: string; publicIcon?: string; charges: number; threshold: number }[] {
    return inventoryStore.getOfferingItems().flatMap((item, slotIndex) => item ? [{
      slotIndex, id: item.id, type: item.kind === 'contaminant' ? item.contaminant.type : null,
      weaponDefinitionId: item.kind === 'weapon' ? item.weapon.definitionId : undefined,
      publicName: item.kind === 'contaminant' ? projectItemForPlayer(item.contaminant).name : WEAPON_DATA[item.weapon.definitionId]!.name,
      publicIcon: item.kind === 'contaminant' ? itemIconUrl(item.contaminant) : undefined,
      charges: getEquipmentLifecycle(item).impactCharges,
      threshold: item.kind === 'weapon' ? WEAPON_DATA[item.weapon.definitionId]!.offeringCharges : GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD,
    }] : []);
  }

  private computeChargeChanges(
    before: ReturnType<PurificationScene['snapshotDefenseCharges']>,
    transformResults: OfferingTransformResult[],
  ): ChargeChangeEntry[] {
    const transformedIds = new Set(transformResults.map(r => r.itemId));
    return before.map(entry => {
      const current = inventoryStore.getItem(entry.id);
      const transformed = transformedIds.has(entry.id);
      const revealed = transformed && current?.kind === 'contaminant' ? projectItemForPlayer(current.contaminant) : null;
      return { itemId: entry.id, slotIndex: entry.slotIndex, type: entry.type, weaponDefinitionId: entry.weaponDefinitionId,
        publicName: entry.publicName, publicIcon: entry.publicIcon,
        revealedName: revealed?.name, revealedSummary: revealed?.summary,
        revealedIcon: revealed && current?.kind === 'contaminant' ? itemIconUrl(current.contaminant) : undefined,
        revealedInert: revealed?.inert,
        revealedSlot: revealed?.slot, revealedUses: revealed?.usesRemaining, revealedWeight: revealed?.weight,
        before: entry.charges, after: transformed ? entry.threshold : current ? getEquipmentLifecycle(current).impactCharges : entry.charges,
        threshold: entry.threshold, transformed };
    });
  }

  private onShutdown(): Error | null {
    if (this.cleanupComplete) return null;
    this.cleanupComplete = true;
    this.shuttingDown = true;
    const failures: string[] = [];
    const dispose = (stage: string, action: () => void): void => {
      this.cleanupStage = stage;
      try { action(); } catch (reason) { failures.push(`${stage}: ${String(reason)}`); }
    };
    dispose('listeners', () => {
      eventBus.off(GameEvent.ALLOCATION_CONFIRMED, this.onAllocationConfirmed);
      eventBus.off(GameEvent.GROWTH_PURCHASED, this.onGrowthPurchased);
      eventBus.off(GameEvent.STABILITY_CHANGED, this.onStabilityChanged);
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    });
    dispose('departure', () => this.devDeparture?.cancel()); this.devDeparture = null; this.devSession = null;
    dispose('weapon-observer', () => this.unsubscribeWeapon?.()); this.unsubscribeWeapon = null;
    dispose('forecast-observer', () => this.unsubscribeForecast?.()); this.unsubscribeForecast = null;
    dispose('entry', () => this.menuEntry?.destroy()); this.menuEntry = null;
    dispose('transition-delay', () => this.transitionDelay?.remove(false)); this.transitionDelay = null;
    dispose('transition-overlay', () => this.transitionOverlay?.remove()); this.transitionOverlay = null;
    dispose('interaction-focus', () => this.restoreInteractionFocus(true));
    if (this.coreRepairGlow) {
      dispose('repair-tween', () => this.tweens.killTweensOf(this.coreRepairGlow!));
      dispose('repair-glow', () => this.coreRepairGlow?.destroy()); this.coreRepairGlow = null;
    }
    dispose('audio', () => audioManager.haltNonBgm());
    for (const [name, close] of [
      ['allocation', () => allocationPanel.close()], ['defense', () => defensePanel.close()],
      ['growth', () => growthPanel.close()], ['loadout', () => loadoutPanel.close()],
      ['inventory', () => inventoryPanel.close()], ['status', () => statusPanel.close()],
      ['impact-result', () => impactResultPanel.destroy()], ['pause', () => pauseMenu.discard()],
    ] as const) dispose(`panel:${name}`, close);
    for (const key of [this.interactKey, this.escKey, this.tabKey, ...this.coreVariantKeys, ...this.entranceVariantKeys]) {
      if (key) dispose(`input:${key.keyCode}`, () => this.input.keyboard?.removeKey(key, true));
    }
    this.interactKey = null; this.escKey = null; this.tabKey = null;
    this.coreVariantKeys = []; this.entranceVariantKeys = [];
    this.groundDepthSorter = null; this.repairGlowModule = null;
    dispose('device-collision', () => this.deviceCollision?.destroy()); this.deviceCollision = null;
    dispose('boundary-collision', () => destroyStaticCollision(this.boundaryCollider, this.boundaryBodies));
    this.boundaryCollider = null; this.boundaryBodies = null;
    for (const [name, resource] of [
      ['atmosphere', this.atmosphere], ['breath', this.breath], ['visibility', this.visibility],
      ['core', this.coreModule], ['storage', this.storageModule], ['purifier', this.purifierModule],
      ['player', this.player], ['tilemap', this.tilemapRenderer], ['entrance', this.riftEntrance],
      ['entrance-graphics', this.riftEntranceGraphics], ['offering', this.offeringStand],
      ['defense-graphics', this.defenseGraphics], ['growth', this.growthConsole], ['growth-graphics', this.growthGraphics],
      ['renewal', this.renewalVisual],
    ] as const) dispose(`world:${name}`, () => resource?.destroy());
    this.riftEntrance = null; this.offeringStand = null; this.growthConsole = null; this.renewalVisual = null;
    dispose('hud', () => purificationHud.destroy());
    this.cleanupStage = failures.length ? failures.join('; ') : 'complete';
    if (!failures.length) return null;
    const error = new Error(`Purification cleanup: ${this.cleanupStage}`);
    console.error(error);
    return error;
  }
}
