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
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { createPurificationVisionConfig, VisibilitySystem } from '@/systems/visibility-system';
import { allocationPanel } from '@/ui/dom/allocation-panel';
import { defensePanel } from '@/ui/dom/defense-panel';
import { growthPanel } from '@/ui/dom/growth-panel';
import { loadoutPanel } from '@/ui/dom/loadout-panel';
import { statusPanel } from '@/ui/dom/status-panel';
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

// B3: Tool name mapping for toast
const TOOL_NAMES: Record<string, string> = {
  solidify: '凝锁', delay: '时裂', erode: '侵蚀领域',
  ruminate: '反刍之口', scatter: '碎影', retrograde: '残响标记',
  siphon: '寄生引流', expand: '虚化步', resonate: '共振链接',
  overwrite: '规则覆写',
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

  // Purification HUD elements (stability + tide info + kindling)
  private purifHud: HTMLDivElement | null = null;

  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private tabKey: Phaser.Input.Keyboard.Key | null = null;
  private transitioning = false;

  // E3: Track stability milestones already shown
  private lastStabilityMilestone = 0;

  constructor() {
    super({ key: 'PurificationScene' });
  }

  create(data?: { kindlingGained?: number; survived?: boolean }): void {
    // Determine if this is a return from rift (vs. menu/load entry)
    const isReturnFromRift = data !== undefined && data.kindlingGained !== undefined;

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

      // Run impact on arrival
      impactResult = impactSystem.run();

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
      'E - 进入裂隙',
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

    // Purification HUD (DOM overlay — Phaser text invisible on void background)
    this.createPurifHud();

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
            this.refreshKindlingDisplay();
            // B3: Show new tool toast after impact flow completes
            this.showNewToolToast(transformResults);
          });
        } else {
          this.player.setInputEnabled(true);
          this.refreshKindlingDisplay();
          // B3: Show new tool toast after impact panel dismissed
          this.showNewToolToast(transformResults);
        }
      }, chargeChanges.length > 0 ? chargeChanges : undefined);
    } else {
      this.refreshKindlingDisplay();
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

    // Draw rift entrance (pulsing teal) - always normal pulse
    this.riftEntrancePulse += delta * 0.003;
    const pulseAlpha = 0.5 + Math.sin(this.riftEntrancePulse) * 0.3;
    this.riftEntranceGraphics.clear();
    this.riftEntranceGraphics.fillStyle(0x1aad96, pulseAlpha);
    this.riftEntranceGraphics.fillCircle(RIFT_ENTRANCE_POS.x, RIFT_ENTRANCE_POS.y, 10);
    this.riftEntranceGraphics.lineStyle(2, 0x2ae6c8, pulseAlpha * 0.7);
    this.riftEntranceGraphics.strokeCircle(RIFT_ENTRANCE_POS.x, RIFT_ENTRANCE_POS.y, 14);

    // D1: Defense point pulse (accelerated when has unequipped contaminants)
    const defHighlight = this.shouldHighlight('defense');
    const defSpeed = defHighlight ? 0.006 : 0.0025;
    this.defensePulse += delta * defSpeed;
    const defBaseAlpha = defHighlight ? 0.55 : 0.4;
    const defAlpha = defBaseAlpha + Math.sin(this.defensePulse) * 0.3;
    this.defenseGraphics.clear();
    this.defenseGraphics.fillStyle(0x8866cc, defAlpha);
    this.defenseGraphics.fillCircle(DEFENSE_POS.x, DEFENSE_POS.y, 8);
    this.defenseGraphics.lineStyle(2, 0xaa88ee, defAlpha * 0.7);
    this.defenseGraphics.strokeCircle(DEFENSE_POS.x, DEFENSE_POS.y, 12);

    // D1: Growth altar pulse (accelerated when can afford upgrade)
    const groHighlight = this.shouldHighlight('growth');
    const groSpeed = groHighlight ? 0.005 : 0.002;
    this.growthPulse += delta * groSpeed;
    const groBaseAlpha = groHighlight ? 0.6 : 0.45;
    const groAlpha = groBaseAlpha + Math.sin(this.growthPulse) * 0.3;
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
      this.refreshKindlingDisplay();
    });
  }

  private openDefensePanel(): void {
    this.player.setInputEnabled(false);
    defensePanel.open(() => {
      this.player.setInputEnabled(true);
      this.refreshKindlingDisplay();
    });
  }

  private openGrowthPanel(): void {
    this.player.setInputEnabled(false);
    growthPanel.open(() => {
      this.player.setInputEnabled(true);
      this.refreshKindlingDisplay();
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

  /** D4: Scene transition with narrative overlay. */
  private transitionToRift(): void {
    // Increment cycle before entering
    gameState.incrementCycle();

    const modifiers = gameState.getSortieModifiers();
    const cycle = gameState.getCycle();
    const loadout = contaminantSystem.getSortieLoadout();

    // Save before entering rift (captures loadout selection)
    saveManager.save();

    eventBus.emit(GameEvent.RIFT_ENTERED, { cycle });

    // D4: Transition overlay
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
  }

  /** A4: Enhanced purification HUD with tide intensity and phase progress. */
  private createPurifHud(): void {
    if (this.purifHud) this.purifHud.remove();

    const tideState = tideSystem.getState();
    const phaseLabels: Record<string, string> = { rise: '涨潮', crest: '潮峰', ebb: '退潮' };
    const stabPct = Math.round(stabilityTracker.getProgress());
    const reserve = gameState.getKindlingReserve();

    // A4: Get phase cycle count for progress display
    const tidesCfg = GAME_CONSTANTS.TIDE.TIDES;
    const cfg = tidesCfg[Math.min(tideState.tideNumber - 1, tidesCfg.length - 1)]!;
    let phaseCycles = 0;
    if (tideState.phase === 'rise') phaseCycles = cfg.riseCycles;
    else if (tideState.phase === 'crest') phaseCycles = cfg.crestCycles;
    else phaseCycles = cfg.ebbCycles;

    this.purifHud = document.createElement('div');
    this.purifHud.id = 'purif-hud';
    this.purifHud.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:999;pointer-events:none;' +
      'font-family:monospace;font-size:12px;text-align:right;line-height:1.6;';
    this.purifHud.innerHTML = `
      <div style="color:#c89040;">薪柴: ${reserve}</div>
      <div style="color:#44aa66;font-size:10px;">稳定度: ${stabPct}%</div>
      <div style="color:#44aa66;font-size:10px;">第${tideState.tideNumber}潮 · ${phaseLabels[tideState.phase]}</div>
      <div style="color:#668888;font-size:10px;">强度: ${tideState.currentIntensity.toFixed(2)} (${phaseLabels[tideState.phase]} ${tideState.cycleInPhase}/${phaseCycles})</div>
    `;
    document.body.appendChild(this.purifHud);
  }

  /** Refresh the kindling HUD text (A2). */
  private refreshKindlingDisplay(): void {
    this.createPurifHud();
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
    this.riftPromptText?.destroy();
    this.defenseGraphics?.destroy();
    this.defensePromptText?.destroy();
    this.growthGraphics?.destroy();
    this.growthPromptText?.destroy();
    this.purifHud?.remove();
    this.purifHud = null;
  }
}
