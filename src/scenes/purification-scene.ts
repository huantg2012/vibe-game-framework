/**
 * Purification Scene - the base management walkable space.
 *
 * A small tilemap (~14x12 tiles) with a circular safe area. The player walks around,
 * interacts with two modules (BARRIER left, STORAGE right) via allocation panels,
 * and enters the rift via a central entrance. The boundary features particle atmosphere
 * and periodic apparitions.
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
import { PurificationModuleEntity } from '@/entities/purification-module';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { BoundaryAtmosphere } from '@/systems/boundary-atmosphere';
import { contaminantSystem } from '@/systems/contaminant-system';
import { impactSystem } from '@/systems/impact-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { createPurificationVisionConfig, VisibilitySystem } from '@/systems/visibility-system';
import { allocationPanel } from '@/ui/dom/allocation-panel';
import { defensePanel } from '@/ui/dom/defense-panel';
import { growthPanel } from '@/ui/dom/growth-panel';
import { loadoutPanel } from '@/ui/dom/loadout-panel';
import { impactResultPanel } from '@/ui/dom/impact-result-panel';
import { TileType } from '@/types/game-types';
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
const ELLIPSE_RX = 5.5; // tiles
const ELLIPSE_RY = 4.5; // tiles

// Module positions (world px)
const BARRIER_POS = { x: CENTER_X - 4 * TILE, y: CENTER_Y };
const STORAGE_POS = { x: CENTER_X + 4 * TILE, y: CENTER_Y };
// Rift entrance (center-top area)
const RIFT_ENTRANCE_POS = { x: CENTER_X, y: CENTER_Y - 3 * TILE };
// Defense management point (bottom-left)
const DEFENSE_POS = { x: CENTER_X - 3 * TILE, y: CENTER_Y + 3 * TILE };
// Growth altar (center-bottom)
const GROWTH_POS = { x: CENTER_X, y: CENTER_Y + 2.5 * TILE };

// ---------------------------------------------------------------------------
// Build the static tilemap
// ---------------------------------------------------------------------------

function buildPurificationTileMap(): TileMapData {
  const tiles: number[][] = [];
  const cx = COLS / 2;
  const cy = ROWS / 2;

  for (let row = 0; row < ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < COLS; col++) {
      // Elliptical check
      const dx = (col + 0.5 - cx) / ELLIPSE_RX;
      const dy = (row + 0.5 - cy) / ELLIPSE_RY;
      const inside = dx * dx + dy * dy <= 1.0;
      rowData.push(inside ? TileType.FLOOR : TileType.WALL);
    }
    tiles.push(rowData);
  }

  return { cols: COLS, rows: ROWS, tileSize: TILE, tiles };
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
// Purification tileset (warm grey/beige tones, contrast to the cold rift)
// ---------------------------------------------------------------------------

const PURIFICATION_TILESET_KEY = 'placeholder-purification-tileset';

function ensurePurificationTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(PURIFICATION_TILESET_KEY)) return;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  // frame 0 - wall (dark void)
  gfx.fillStyle(0x0a0a0a, 1);
  gfx.fillRect(0, 0, TILE, TILE);

  // frame 1 - floor (warm grey/beige)
  gfx.fillStyle(0x2e2a25, 1);
  gfx.fillRect(TILE, 0, TILE, TILE);
  gfx.lineStyle(1, 0x3a3530, 1);
  gfx.strokeRect(TILE + 0.5, 0.5, TILE - 1, TILE - 1);

  gfx.generateTexture(PURIFICATION_TILESET_KEY, TILE * 2, TILE);
  gfx.destroy();
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class PurificationScene extends Phaser.Scene {
  private readonly tilemapRenderer = new TilemapRenderer();
  private readonly player = new Player();
  private readonly visibility = new VisibilitySystem();
  private readonly atmosphere = new BoundaryAtmosphere();

  private barrierModule!: PurificationModuleEntity;
  private storageModule!: PurificationModuleEntity;

  private riftEntranceGraphics!: Phaser.GameObjects.Graphics;
  private riftPromptText!: Phaser.GameObjects.Text;
  private riftEntrancePulse = 0;

  // Defense management interaction point
  private defenseGraphics!: Phaser.GameObjects.Graphics;
  private defensePromptText!: Phaser.GameObjects.Text;
  private defensePulse = 0;

  // Growth altar interaction point
  private growthGraphics!: Phaser.GameObjects.Graphics;
  private growthPromptText!: Phaser.GameObjects.Text;
  private growthPulse = 0;

  // Purification HUD elements (stability + tide info)
  private stabilityBarBg!: Phaser.GameObjects.Rectangle;
  private stabilityBarFill!: Phaser.GameObjects.Rectangle;
  private tideText!: Phaser.GameObjects.Text;

  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private transitioning = false;

  constructor() {
    super({ key: 'PurificationScene' });
  }

  create(data?: { kindlingGained?: number; survived?: boolean }): void {
    // Credit kindling from the rift run (spec rule 10)
    if (data?.survived && data.kindlingGained !== undefined && data.kindlingGained > 0) {
      gameState.addKindling(data.kindlingGained);
      // Stability: successful extraction (spec S21)
      stabilityTracker.addProgress('extraction', GAME_CONSTANTS.STABILITY.GAIN_EXTRACT);
    }

    // Sync impact intensity from tide system (Slice 3 replaces linear escalation)
    gameState.setImpactIntensity(tideSystem.getCurrentIntensity());

    // Apply contaminant defense charges before running impact
    const isHighTide = tideSystem.isHighTide();
    contaminantSystem.applyImpactCharge(isHighTide);

    // Run impact on arrival (not on departure) — spec adjustment per playtest feedback
    const impactResult = impactSystem.run();

    // Advance tide cycle after impact resolves
    tideSystem.advanceCycle();

    // Generate forecast for boundary atmosphere (for NEXT impact)
    impactSystem.generateForecast();

    // Save game state after arriving at purification point (spec P24)
    saveManager.save();

    this.transitioning = false;

    // Build tilemap
    const tileMap = buildPurificationTileMap();
    const grid = buildOccluderGrid(tileMap);

    ensurePurificationTileset(this);

    const layer = this.tilemapRenderer.create(this, tileMap, {
      tilesetKey: PURIFICATION_TILESET_KEY,
      collidingIndices: [TileType.WALL],
      depth: 0,
    });

    this.physics.world.setBounds(0, 0, WIDTH_PX, HEIGHT_PX);

    // Camera
    const camera = this.cameras.main;
    camera.setBounds(0, 0, WIDTH_PX, HEIGHT_PX);
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(0x0a0a0a);

    // Player
    const spawnPoint = { x: CENTER_X, y: CENTER_Y + TILE };
    this.player.create(this, { spawn: spawnPoint, depth: 30, facing: 'up' });
    this.physics.add.collider(this.player.getSprite(), layer);
    camera.startFollow(this.player.getSprite(), true);

    // Visibility (omni mode - full room lit)
    this.visibility.create(this, createPurificationVisionConfig(50), grid);

    // Module entities
    this.barrierModule = new PurificationModuleEntity({
      id: 'BARRIER',
      type: 'BARRIER',
      x: BARRIER_POS.x,
      y: BARRIER_POS.y,
    });
    this.barrierModule.create(this);

    this.storageModule = new PurificationModuleEntity({
      id: 'STORAGE',
      type: 'STORAGE',
      x: STORAGE_POS.x,
      y: STORAGE_POS.y,
    });
    this.storageModule.create(this);

    // Rift entrance marker (pulsing teal)
    this.riftEntranceGraphics = this.add.graphics().setDepth(20);
    this.riftPromptText = this.add.text(
      RIFT_ENTRANCE_POS.x,
      RIFT_ENTRANCE_POS.y - 24,
      'E - Enter Rift',
      {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'monospace',
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      },
    ).setOrigin(0.5).setDepth(21).setVisible(false);

    // Defense management point (purple, bottom-left)
    this.defenseGraphics = this.add.graphics().setDepth(20);
    this.defensePromptText = this.add.text(
      DEFENSE_POS.x,
      DEFENSE_POS.y - 24,
      'E - 防御配置',
      {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'monospace',
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      },
    ).setOrigin(0.5).setDepth(21).setVisible(false);

    // Growth altar (orange, center-bottom)
    this.growthGraphics = this.add.graphics().setDepth(20);
    this.growthPromptText = this.add.text(
      GROWTH_POS.x,
      GROWTH_POS.y - 24,
      'E - 永久改造',
      {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'monospace',
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      },
    ).setOrigin(0.5).setDepth(21).setVisible(false);

    // Purification HUD: stability bar (top right, green)
    const cam = this.cameras.main;
    const hudW = cam.width / cam.zoomX;
    const stabilityX = hudW - 8 - 80;
    const stabilityY = 8;
    const STAB_BAR_W = 80;
    const STAB_BAR_H = 6;

    this.stabilityBarBg = this.add
      .rectangle(stabilityX, stabilityY, STAB_BAR_W, STAB_BAR_H, 0x000000, 0.4)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    const stabProgress = stabilityTracker.getProgress() / GAME_CONSTANTS.STABILITY.MAX;
    this.stabilityBarFill = this.add
      .rectangle(stabilityX, stabilityY, STAB_BAR_W * stabProgress, STAB_BAR_H, 0x44aa66)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);

    // Tide info text below stability bar
    const tideState = tideSystem.getState();
    const phaseLabels: Record<string, string> = { rise: '涨潮', crest: '潮峰', ebb: '退潮' };
    this.tideText = this.add
      .text(stabilityX + STAB_BAR_W, stabilityY + STAB_BAR_H + 3, `Tide ${tideState.tideNumber} · ${phaseLabels[tideState.phase]}`, {
        fontSize: '9px',
        color: '#44aa66',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Boundary atmosphere
    this.atmosphere.create(this);

    // Input
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, true, false);
      this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, true, false);
    }

    // Post-update for visibility sync
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    // Show impact result on arrival (player must dismiss before interacting)
    if (!impactResult.skipped) {
      this.player.setInputEnabled(false);
      this.cameras.main.shake(300, 0.005);
      impactResultPanel.show(impactResult.damages, impactResult.intensity, () => {
        this.player.setInputEnabled(true);
      });
    }
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;

    this.player.update(delta);

    const pos = this.player.getPosition();

    // Update modules (checks proximity)
    this.barrierModule.update(pos.x, pos.y);
    this.storageModule.update(pos.x, pos.y);

    // Rift entrance proximity
    const riftDx = pos.x - RIFT_ENTRANCE_POS.x;
    const riftDy = pos.y - RIFT_ENTRANCE_POS.y;
    const riftDist = Math.sqrt(riftDx * riftDx + riftDy * riftDy);
    const nearRift = riftDist <= GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;
    this.riftPromptText.setVisible(nearRift);

    // Defense point proximity
    const defDx = pos.x - DEFENSE_POS.x;
    const defDy = pos.y - DEFENSE_POS.y;
    const defDist = Math.sqrt(defDx * defDx + defDy * defDy);
    const nearDefense = defDist <= GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;
    this.defensePromptText.setVisible(nearDefense);

    // Growth altar proximity
    const groDx = pos.x - GROWTH_POS.x;
    const groDy = pos.y - GROWTH_POS.y;
    const groDist = Math.sqrt(groDx * groDx + groDy * groDy);
    const nearGrowth = groDist <= GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;
    this.growthPromptText.setVisible(nearGrowth);

    // Draw rift entrance (pulsing teal)
    this.riftEntrancePulse += delta * 0.003;
    const pulseAlpha = 0.5 + Math.sin(this.riftEntrancePulse) * 0.3;
    this.riftEntranceGraphics.clear();
    this.riftEntranceGraphics.fillStyle(0x1aad96, pulseAlpha);
    this.riftEntranceGraphics.fillCircle(RIFT_ENTRANCE_POS.x, RIFT_ENTRANCE_POS.y, 10);
    this.riftEntranceGraphics.lineStyle(2, 0x2ae6c8, pulseAlpha * 0.7);
    this.riftEntranceGraphics.strokeCircle(RIFT_ENTRANCE_POS.x, RIFT_ENTRANCE_POS.y, 14);

    // Draw defense point (pulsing purple)
    this.defensePulse += delta * 0.0025;
    const defAlpha = 0.4 + Math.sin(this.defensePulse) * 0.25;
    this.defenseGraphics.clear();
    this.defenseGraphics.fillStyle(0x8866cc, defAlpha);
    this.defenseGraphics.fillCircle(DEFENSE_POS.x, DEFENSE_POS.y, 8);
    this.defenseGraphics.lineStyle(2, 0xaa88ee, defAlpha * 0.7);
    this.defenseGraphics.strokeCircle(DEFENSE_POS.x, DEFENSE_POS.y, 12);

    // Draw growth altar (pulsing orange)
    this.growthPulse += delta * 0.002;
    const groAlpha = 0.45 + Math.sin(this.growthPulse) * 0.25;
    this.growthGraphics.clear();
    this.growthGraphics.fillStyle(0xcc8844, groAlpha);
    this.growthGraphics.fillRect(GROWTH_POS.x - 7, GROWTH_POS.y - 7, 14, 14);
    this.growthGraphics.lineStyle(2, 0xeea866, groAlpha * 0.7);
    this.growthGraphics.strokeRect(GROWTH_POS.x - 10, GROWTH_POS.y - 10, 20, 20);

    // Atmosphere
    this.atmosphere.update(delta);

    // Interaction key (edge-triggered)
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.isAnyPanelOpen()) return; // panel already open, ignore

      if (this.barrierModule.isInRange()) {
        this.openAllocationPanel('BARRIER');
      } else if (this.storageModule.isInRange()) {
        this.openAllocationPanel('STORAGE');
      } else if (nearDefense) {
        this.openDefensePanel();
      } else if (nearGrowth) {
        this.openGrowthPanel();
      } else if (nearRift) {
        this.enterRift();
      }
    }

    // ESC
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (allocationPanel.isOpen()) {
        allocationPanel.close();
      } else if (defensePanel.isOpen()) {
        defensePanel.close();
      } else if (growthPanel.isOpen()) {
        growthPanel.close();
      } else if (loadoutPanel.isOpen()) {
        loadoutPanel.close();
      } else {
        this.scene.start('MainMenuScene');
      }
    }
  }

  // ------------------------------------------------------------------ private

  private onPostUpdate(_time: number, delta: number): void {
    this.player.postUpdate();
    this.visibility.update(this.player.getPosition(), this.player.getFacingAngle(), delta);
  }

  private isAnyPanelOpen(): boolean {
    return allocationPanel.isOpen() || defensePanel.isOpen() || growthPanel.isOpen() || loadoutPanel.isOpen();
  }

  private openAllocationPanel(moduleId: string): void {
    this.player.setInputEnabled(false);
    allocationPanel.open(moduleId, () => {
      this.player.setInputEnabled(true);
    });
  }

  private openDefensePanel(): void {
    this.player.setInputEnabled(false);
    defensePanel.open(() => {
      this.player.setInputEnabled(true);
    });
  }

  private openGrowthPanel(): void {
    this.player.setInputEnabled(false);
    growthPanel.open(() => {
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

  private transitionToRift(): void {
    // Increment cycle before entering
    gameState.incrementCycle();

    const modifiers = gameState.getSortieModifiers();
    const cycle = gameState.getCycle();
    const loadout = contaminantSystem.getSortieLoadout();

    // Save before entering rift (captures loadout selection)
    saveManager.save();

    eventBus.emit(GameEvent.RIFT_ENTERED, { cycle });

    this.scene.start('RiftScene', { modifiers, cycle, loadout });
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);

    // Clean up DOM panels
    allocationPanel.close();
    defensePanel.close();
    growthPanel.close();
    loadoutPanel.close();
    impactResultPanel.destroy();

    // Clean up interact key
    if (this.interactKey) {
      this.input.keyboard?.removeKey(this.interactKey, true);
      this.interactKey = null;
    }
    if (this.escKey) {
      this.input.keyboard?.removeKey(this.escKey, true);
      this.escKey = null;
    }

    // Destroy systems
    this.atmosphere.destroy();
    this.visibility.destroy();
    this.barrierModule.destroy();
    this.storageModule.destroy();
    this.player.destroy();
    this.tilemapRenderer.destroy();
    this.riftEntranceGraphics?.destroy();
    this.riftPromptText?.destroy();
    this.defenseGraphics?.destroy();
    this.defensePromptText?.destroy();
    this.growthGraphics?.destroy();
    this.growthPromptText?.destroy();
    this.stabilityBarBg?.destroy();
    this.stabilityBarFill?.destroy();
    this.tideText?.destroy();
  }
}
