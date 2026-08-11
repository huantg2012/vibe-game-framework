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
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
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
import type { ChargeChangeEntry } from '@/ui/dom/impact-result-panel';
import type { PhaseChangeInfo } from '@/systems/tide-system';
import { TileType } from '@/types/game-types';
import type { GrowthUpgradeId } from '@/types/game-types';
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

// Interaction point colours (spec B3)
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

// B3: Tool name mapping for toast
const TOOL_NAMES: Record<string, string> = {
  solidify: '凝锁', delay: '时裂', erode: '侵蚀领域',
  ruminate: '反刍之口', scatter: '碎影', retrograde: '残响标记',
  siphon: '寄生引流', expand: '虚化步', resonate: '共振链接',
  overwrite: '规则覆写', muffle: '消声步', kindle: '燃素弹',
  stitch: '缝合线', compress: '重力锚', mirror: '镜像诱饵',
  echo: '回响脉冲', abyss: '深渊之眼', combust: '焚天',
};

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

  private barrierModule!: PurificationModuleEntity;
  private storageModule!: PurificationModuleEntity;

  private riftEntranceGraphics!: Phaser.GameObjects.Graphics;
  private riftEntrancePulse = 0;

  // Defense management interaction point
  private defenseGraphics!: Phaser.GameObjects.Graphics;
  private defensePulse = 0;

  // Growth altar interaction point
  private growthGraphics!: Phaser.GameObjects.Graphics;
  private growthPulse = 0;

  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private tabKey: Phaser.Input.Keyboard.Key | null = null;
  private transitioning = false;

  // E3: Track stability milestones already shown
  private lastStabilityMilestone = 0;

  constructor() {
    super({ key: 'PurificationScene' });
  }

  create(data?: { kindlingGained?: number; survived?: boolean; fromMenu?: boolean }): void {
    // Determine if this is a return from rift (vs. menu/load entry)
    const isReturnFromRift = !data?.fromMenu && data?.kindlingGained !== undefined;

    // Credit kindling from the rift run (spec rule 10)
    if (data?.survived && data.kindlingGained !== undefined && data.kindlingGained > 0) {
      gameState.addKindling(data.kindlingGained);
      // Stability: successful extraction (spec S21)
      stabilityTracker.addProgress('extraction', GAME_CONSTANTS.STABILITY.GAIN_EXTRACT);
    }

    // Impact only triggers on return from rift, not on menu/load entry
    let impactResult = { skipped: true, damages: [] as { moduleId: string; damage: number; newHp: number }[], intensity: 0 };
    let chargeChanges: ChargeChangeEntry[] = [];
    let phaseChange: ReturnType<typeof tideSystem.advanceCycle> = null;
    let transformResults: { contaminantId: string; type: string; slotIndex: number }[] = [];

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

      // Run impact on arrival (pass defense slots to avoid cross-system import)
      const defenseSlots = contaminantSystem.getDefenseSlotted();
      impactResult = impactSystem.run(defenseSlots);

      // Advance tide cycle after impact resolves (E1: capture phase change)
      phaseChange = tideSystem.advanceCycle();
    }

    // Generate forecast for boundary atmosphere (for NEXT impact)
    impactSystem.generateForecast();

    // Save game state
    saveManager.save();

    this.transitioning = false;

    // E3: Initialize stability milestone tracker
    this.lastStabilityMilestone = Math.floor(stabilityTracker.getProgress() / 25) * 25;

    // Build tilemap
    const tileMap = buildPurificationTileMap();
    const grid = buildOccluderGrid(tileMap);

    // Procedural surface texture (replaces flat tileset visuals)
    const surfaceKey = 'purification-surface';
    createPurificationSurfaceTexture(
      this, tileMap, surfaceKey,
      ELLIPSE_RX, ELLIPSE_RY,
      [BARRIER_POS, STORAGE_POS, RIFT_ENTRANCE_POS, DEFENSE_POS, GROWTH_POS],
    );
    this.add.image(0, 0, surfaceKey).setOrigin(0, 0).setDepth(0);

    // Invisible tilemap layer retained solely for physics collision
    ensurePurificationTileset(this);
    const layer = this.tilemapRenderer.create(this, tileMap, {
      tilesetKey: PURIFICATION_TILESET_KEY,
      collidingIndices: [TileType.WALL],
      depth: -1,
    });
    layer.setVisible(false);

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

    // Interaction point graphics (unified circles, spec B3)
    this.riftEntranceGraphics = this.add.graphics().setDepth(20);
    this.defenseGraphics = this.add.graphics().setDepth(20);
    this.growthGraphics = this.add.graphics().setDepth(20);

    // Purification HUD (DOM overlay)
    purificationHud.create();
    purificationHud.refresh();

    // Boundary atmosphere
    this.atmosphere.create(this);

    // Input
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, true, false);
      this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, true, false);
      this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB, true, false);
    }

    // C2: Listen for allocation confirmed to flash modules
    eventBus.on(GameEvent.ALLOCATION_CONFIRMED, this.onAllocationConfirmed);

    // E3: Listen for stability changes
    eventBus.on(GameEvent.STABILITY_CHANGED, this.onStabilityChanged);

    // Post-update for visibility sync
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    // Show impact result on arrival (player must dismiss before interacting)
    if (!impactResult.skipped) {
      this.player.setInputEnabled(false);
      this.cameras.main.shake(300, 0.005);
      impactResultPanel.show(impactResult.damages, impactResult.intensity, () => {
        // After impact panel dismissed, show tide phase notification if applicable (E1)
        if (phaseChange) {
          this.showPhaseChangeNotification(phaseChange, () => {
            this.player.setInputEnabled(true);
            purificationHud.refresh();
            // B3: Show new tool toast after impact flow completes
            this.showNewToolToast(transformResults);
          });
        } else {
          this.player.setInputEnabled(true);
          purificationHud.refresh();
          // B3: Show new tool toast after impact panel dismissed
          this.showNewToolToast(transformResults);
        }
      }, chargeChanges.length > 0 ? chargeChanges : undefined);
    }
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;

    this.player.update(delta);

    const pos = this.player.getPosition();

    // Update modules (checks proximity)
    this.barrierModule.update(pos.x, pos.y);
    this.storageModule.update(pos.x, pos.y);

    // Calculate distances to all interaction points
    const riftDist = this.distTo(pos, RIFT_ENTRANCE_POS);
    const defDist = this.distTo(pos, DEFENSE_POS);
    const groDist = this.distTo(pos, GROWTH_POS);

    const nearRift = riftDist <= GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;
    const nearDefense = defDist <= GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;
    const nearGrowth = groDist <= GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;

    // --- Determine nearest interaction target for prompt bar ---
    const target = this.findNearestTarget(nearRift, nearDefense, nearGrowth, riftDist, defDist, groDist);
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
      } else if (statusPanel.isOpen()) {
        statusPanel.close();
      } else {
        this.scene.start('MainMenuScene');
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
    nearRift: boolean, nearDefense: boolean, nearGrowth: boolean,
    riftDist: number, defDist: number, groDist: number,
  ): InteractionTarget | null {
    const candidates: InteractionTarget[] = [];

    if (this.barrierModule.isInRange()) {
      const hpData = this.barrierModule.getHpData();
      candidates.push({
        type: 'barrier',
        distance: 0, // modules handle their own distance check
        moduleData: hpData ? { hp: hpData.hp, maxHp: hpData.maxHp, effectPct: this.barrierModule.getEffectPct() } : undefined,
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
    if (nearRift) {
      candidates.push({ type: 'rift', distance: riftDist });
    }
    if (nearDefense) {
      candidates.push({ type: 'defense', distance: defDist });
    }
    if (nearGrowth) {
      candidates.push({ type: 'growth', distance: groDist });
    }

    if (candidates.length === 0) return null;

    // Return the closest candidate
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0]!;
  }

  private onPostUpdate(_time: number, delta: number): void {
    this.player.postUpdate();
    this.visibility.update(this.player.getPosition(), this.player.getFacingAngle(), delta);
  }

  private isAnyPanelOpen(): boolean {
    return allocationPanel.isOpen() || defensePanel.isOpen() || growthPanel.isOpen() || loadoutPanel.isOpen() || statusPanel.isOpen();
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
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:1999', 'pointer-events:none',
      'animation:rift-enter-glow 0.3s ease-in forwards',
    ].join(';');
    document.body.appendChild(glowOverlay);

    // Phase 2: After 0.3s, show black screen with text
    setTimeout(() => {
      glowOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = 'scene-transition-overlay';
      overlay.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
        'z-index:2000', 'background:#000', 'display:flex',
        'align-items:center', 'justify-content:center',
        'font-family:monospace', 'font-size:14px', 'color:#888',
      ].join(';');
      overlay.textContent = '进入裂隙。';
      document.body.appendChild(overlay);

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
  private shouldHighlight(point: 'defense' | 'growth' | 'barrier' | 'storage'): boolean {
    const reserve = gameState.getKindlingReserve();
    switch (point) {
      case 'barrier': {
        const mod = gameState.getModule('BARRIER');
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
        const ids: GrowthUpgradeId[] = ['growth_chaos_resist', 'growth_kindling_affinity', 'growth_vitality'];
        return ids.some((id) => growthSystem.canAfford(id, reserve));
      }
    }
  }

  /** B3: Show toast when new tools are available from transformation. */
  private showNewToolToast(transformResults: { contaminantId: string; type: string; slotIndex: number }[]): void {
    if (transformResults.length === 0) return;

    const names = transformResults.map((r) => TOOL_NAMES[r.type] ?? r.type);
    const text = `新工具可用: ${names.join(', ')}`;

    // Inject animation style if needed
    if (!document.getElementById('toast-fade-style')) {
      const style = document.createElement('style');
      style.id = 'toast-fade-style';
      style.textContent = `@keyframes toast-fade { 0%{opacity:1;} 70%{opacity:1;} 100%{opacity:0;} }`;
      document.head.appendChild(style);
    }

    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed', 'top:40px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:998', 'background:rgba(26,173,150,0.15)', 'border:1px solid #1aad96',
      'padding:8px 16px', 'font-family:monospace', 'font-size:11px',
      'color:#2ae6c8', 'border-radius:4px', 'pointer-events:none',
      'animation:toast-fade 3s ease-out forwards',
    ].join(';');
    toast.textContent = text;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  /** C2: Flash the module entity when repair is confirmed. */
  private readonly onAllocationConfirmed = (payload: { allocations: Record<string, number> }): void => {
    for (const moduleId of Object.keys(payload.allocations)) {
      if (moduleId === 'BARRIER') {
        this.flashModule(this.barrierModule);
      } else if (moduleId === 'STORAGE') {
        this.flashModule(this.storageModule);
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

  /** E3: Show stability milestone notifications. */
  private readonly onStabilityChanged = (payload: { progress: number; delta: number }): void => {
    const milestones = [25, 50, 75, 100];
    const messages: Record<number, string> = {
      25: '净化进度: 25%。坚持住。',
      50: '净化进度: 50%。已经过半。',
      75: '净化进度: 75%。终点在望。',
      100: '净化完成。',
    };

    for (const m of milestones) {
      if (payload.progress >= m && this.lastStabilityMilestone < m) {
        this.lastStabilityMilestone = m;
        this.showStabilityMilestone(messages[m]!);
        break;
      }
    }
  };

  private showStabilityMilestone(message: string): void {
    // Inject animation style if needed
    if (!document.getElementById('milestone-fade-style')) {
      const style = document.createElement('style');
      style.id = 'milestone-fade-style';
      style.textContent = `@keyframes milestone-fade { 0%{opacity:1;} 70%{opacity:1;} 100%{opacity:0;} }`;
      document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'z-index:1002', 'background:rgba(10,10,14,0.92)', 'border:2px solid #44aa66',
      'padding:14px 28px', 'font-family:monospace', 'color:#44aa66',
      'font-size:13px', 'border-radius:4px', 'text-align:center',
      'pointer-events:none', 'animation:milestone-fade 2s ease-out forwards',
    ].join(';');
    overlay.textContent = message;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2000);
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
        name: entry.type,
        before: entry.charges,
        after: afterCharges,
        threshold,
        transformed,
      });
    }

    return changes;
  }

  /** Show tide phase change notification overlay (E1). */
  private showPhaseChangeNotification(info: PhaseChangeInfo, onDone: () => void): void {
    let message: string;
    let borderColor: string;

    if (info.to === 'crest') {
      message = '潮峰期。冲击强度维持峰值。';
      borderColor = '#cc4444';
    } else if (info.to === 'ebb') {
      message = '退潮期。压力暂缓。';
      borderColor = '#44aa66';
    } else {
      // New tide (rise phase of a higher tide number)
      message = `第${info.newTideNumber}潮汐。边界压力上升。`;
      borderColor = '#8866cc';
    }

    const overlay = document.createElement('div');
    overlay.id = 'tide-phase-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:1002',
      'background:rgba(10,10,14,0.92)',
      `border:2px solid ${borderColor}`,
      'padding:18px 32px',
      'font-family:monospace',
      `color:${borderColor}`,
      'font-size:14px',
      'border-radius:4px',
      'text-align:center',
      'box-shadow:0 0 20px rgba(0,0,0,0.6)',
      'cursor:pointer',
    ].join(';');

    overlay.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px;">${message}</div>
      <div style="font-size:10px;color:#666;">点击或等待关闭</div>
    `;

    document.body.appendChild(overlay);

    const dismiss = (): void => {
      overlay.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', keyDismiss);
      if (autoTimer) clearTimeout(autoTimer);
      overlay.remove();
      onDone();
    };
    const keyDismiss = (e: KeyboardEvent): void => {
      if (!e.repeat) dismiss();
    };

    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', keyDismiss);
    const autoTimer = setTimeout(dismiss, 2000);
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);

    // Clean up event listeners
    eventBus.off(GameEvent.ALLOCATION_CONFIRMED, this.onAllocationConfirmed);
    eventBus.off(GameEvent.STABILITY_CHANGED, this.onStabilityChanged);

    // Clean up DOM panels
    allocationPanel.close();
    defensePanel.close();
    growthPanel.close();
    loadoutPanel.close();
    statusPanel.close();
    impactResultPanel.destroy();

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

    // Destroy systems
    this.atmosphere.destroy();
    this.visibility.destroy();
    this.barrierModule.destroy();
    this.storageModule.destroy();
    this.player.destroy();
    this.tilemapRenderer.destroy();
    this.riftEntranceGraphics?.destroy();
    this.defenseGraphics?.destroy();
    this.growthGraphics?.destroy();

    // Destroy DOM HUD
    purificationHud.destroy();
  }
}
