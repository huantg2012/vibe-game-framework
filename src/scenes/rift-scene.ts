/**
 * Rift Scene - core gameplay.
 *
 * At this point in Slice 1 it owns the fixed map, the player, the limited field of view,
 * the enemies (T7) and combat (T8). Chaos/loot/extraction (T9) plugs in on top; the layout
 * data it needs is already published by `RIFT_MAP.layout`.
 *
 * The scene is the orchestration layer: it owns the system instances and does the wiring
 * between them, which is what keeps the systems from calling each other directly
 * (architecture DEC-ARCH-002). Combat and the AI are the clearest case - neither imports
 * the other, and every effect one has on the other passes through the translations below.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { Player } from '@/entities/player';
import { RIFT_MAP, validateRiftMap } from '@/scenes/rift-map-data';
import { AISystem, ENEMY_DEPTH } from '@/systems/ai';
import { ChaosSystem, getChaosModulators, type ChaosModulators } from '@/systems/chaos-system';
import { gameState, type SortieModifiers } from '@/managers/game-state';
import { CombatSystem, COMBAT_FX_DEPTH, type NoiseLevel } from '@/systems/combat-system';
import { ContaminantNodeSystem } from '@/systems/contaminant-node-system';
import { contaminantSystem } from '@/systems/contaminant-system';
import { ExtractionSystem } from '@/systems/extraction-system';
import { growthSystem } from '@/systems/growth-system';
import { LootSystem } from '@/systems/loot-system';
import { RunController } from '@/systems/run-controller';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { ToolSystem } from '@/systems/tool-system';
import { TrailSystem } from '@/systems/trail-system';
import { createRiftSurfaceTexture } from '@/systems/procedural-surface';
import { createRiftVisionConfig, VisibilitySystem } from '@/systems/visibility-system';
import { HUD } from '@/ui/hud';
import { Minimap } from '@/ui/minimap';
import type { PendingSideEffect } from '@/systems/defense-engine';
import { TileType, type Contaminant, type Vector2 } from '@/types/game-types';
import type { LandmarkDef } from '@/types/map-types';
import { GameEvent } from '@/types/events';

/** Render depths. The gaps leave room for decals, entities and the HUD. */
const DEPTH = {
  surface: 0,
  /** Owned by the AI system, which creates the enemy sprites. */
  enemy: ENEMY_DEPTH,
  player: 30,
  /** Owned by the combat system: telegraphs and flashes, under the darkness mask. */
  combatFx: COMBAT_FX_DEPTH,
  visionMask: 50,
} as const;

const RIFT_SURFACE_KEY = 'rift-surface';

export class RiftScene extends Phaser.Scene {
  private readonly tilemapRenderer = new TilemapRenderer();
  private readonly player = new Player();
  private readonly visibility = new VisibilitySystem();
  private readonly trail = new TrailSystem();
  private readonly ai = new AISystem();
  private readonly combat = new CombatSystem();
  private readonly loot = new LootSystem();
  private readonly contaminantNodes = new ContaminantNodeSystem();
  private readonly toolSystem = new ToolSystem();
  private readonly extraction = new ExtractionSystem();
  private readonly runController = new RunController();
  private readonly hud = new HUD();
  private readonly minimap = new Minimap();
  private chaos!: ChaosSystem;

  private landmarkGraphics: Phaser.GameObjects.Graphics | null = null;

  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  private extractKey: Phaser.Input.Keyboard.Key | null = null;
  private restartKey: Phaser.Input.Keyboard.Key | null = null;
  private toolKey0: Phaser.Input.Keyboard.Key | null = null;
  private toolKey1: Phaser.Input.Keyboard.Key | null = null;

  private debugPanel: HTMLDivElement | null = null;
  private debugVisible = true;
  /** Seeded past the refresh interval so the panel has content on the first frame. */
  private debugAccumulatorMs = Number.POSITIVE_INFINITY;

  constructor() {
    super({ key: 'RiftScene' });
  }

  create(data?: { modifiers?: SortieModifiers; cycle?: number; loadout?: (Contaminant | null)[] }): void {
    const sortieModifiers = data?.modifiers;
    const sortieLoadout = data?.loadout ?? contaminantSystem.getSortieLoadout();
    const { tileMap, grid, layout } = RIFT_MAP;

    if (import.meta.env.DEV) {
      const problems = validateRiftMap();
      if (problems.length > 0) {
        console.error(`[RiftScene] fixed map validation failed:\n- ${problems.join('\n- ')}`);
      }
    }

    // The tilemap layer stays for physics/collision but is made invisible: the visible
    // surface is a continuous procedural texture (DEC-018), not the flat placeholder tiles.
    const layer = this.tilemapRenderer.create(this, tileMap, {
      tilesetKey: 'placeholder-rift-tileset',
      collidingIndices: [TileType.WALL],
      depth: DEPTH.surface,
    });
    layer.setVisible(false);

    createRiftSurfaceTexture(this, tileMap, RIFT_SURFACE_KEY);
    this.add.image(0, 0, RIFT_SURFACE_KEY).setOrigin(0, 0).setDepth(DEPTH.surface);

    this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);

    // Zoom must be set before the visibility system sizes its mask to the view.
    const camera = this.cameras.main;
    camera.setBounds(0, 0, grid.widthPx, grid.heightPx);
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);

    this.player.create(this, { spawn: layout.spawnPoint, depth: DEPTH.player, facing: 'right' });
    this.physics.add.collider(this.player.getSprite(), layer);
    camera.startFollow(this.player.getSprite(), true);

    this.visibility.create(this, createRiftVisionConfig(DEPTH.visionMask), grid);
    this.visibility.setExtractionPosition(layout.extractionPoint.position);

    this.trail.create(this, tileMap.cols, tileMap.tileSize, this.visibilityAt);
    this.createLandmarkDecals(layout.landmarks, tileMap.tileSize);

    // The AI reads the same grid twice through two different contracts: as an occluder
    // grid for line of sight, as a walk grid for pathfinding. Slice 1 derives both from
    // one tile array, but low walls or chasms would break that equivalence later.
    this.ai.create(this, layout.enemySpawns, grid, grid);
    this.ai.setVisibilityProvider(this.visibilityAt);
    this.ai.addWallCollider(layer);

    // Combat gets a read-only view of the AI (`getEnemies` / `getEnemyById`) plus one
    // callback. Noise is the only cross-system output that does not go through the bus: a
    // whiffed swing is audible yet emits nothing, so there is no event to carry it.
    this.combat.create(this, grid, this.player, this.ai, { onNoise: this.reportNoise });

    // --- T9 systems: chaos, loot, extraction, run controller, HUD ---

    // Apply growth modifiers on top of module modifiers
    const growthMods = growthSystem.getModifiers();
    const effectiveChaosRate = (sortieModifiers?.chaosRateModifier ?? 1.0) * (1 - growthMods.chaosResist);
    // growthMods.kindlingAffinity (+N per pickup) applied through LootSystem config below
    // growthMods.vitalityBonus (+HP) applied through combat system max health

    this.chaos = new ChaosSystem({
      onModulate: this.applyChaosModulators,
      chaosRateModifier: effectiveChaosRate,
    });

    this.loot.create(this, layout.kindlingNodes, this.player.getSprite(), {
      getVisibilityAt: this.visibilityAt,
      kindlingValueModifier: sortieModifiers?.kindlingValueModifier,
    });

    // Contaminant pickup nodes (Slice 3)
    this.contaminantNodes.create(this, layout.contaminantNodes, this.player.getSprite(), {
      getVisibilityAt: this.visibilityAt,
    });

    // Tool system (Slice 4): sortie loadout with expanded options
    this.toolSystem.create(
      this,
      sortieLoadout,
      () => this.player.getPosition(),
      () => this.ai.getEnemies(),
      {
        setPlayerCollision: (enabled) => {
          const sprite = this.player.getSprite();
          const body = sprite.body as Phaser.Physics.Arcade.Body | null;
          if (body) body.enable = enabled;
        },
        setPlayerInput: (enabled) => this.player.setInputEnabled(enabled),
        getCollectedNodes: () => this.contaminantNodes.getCollectedPositions(),
        addKindling: (n) => this.loot.addBonusKindling(n),
      },
    );

    this.extraction.create(
      this,
      layout.extractionPoint,
      () => this.player.getPosition(),
      () => this.runController.isRunEnded(),
      { registerGlowSource: (id, pos, r) => this.visibility.registerGlowSource(id, pos, r) },
    );

    this.runController.create(this, {
      pauseChaos: (paused) => this.chaos.setPaused(paused),
      setPlayerInput: (enabled) => this.player.setInputEnabled(enabled),
      getCarriedKindling: () => this.loot.getCarriedKindling(),
      resetAll: () => this.resetAllSystems(),
    });

    // Build tool slot info for HUD display
    const toolSlots = sortieLoadout
      .filter((c): c is Contaminant => c !== null)
      .map((c, i) => ({
        label: i === 0 ? 'Q' : i === 1 ? 'F' : '被动',
        name: c.type,
        usesRemaining: c.usesRemaining,
      }));

    this.hud.create(this, {
      canExtract: () => this.extraction.canExtract(),
      isRunEnded: () => this.runController.isRunEnded(),
      getPeakChaos: () => this.chaos.getPeak(),
      getElapsedMs: () => this.runController.getElapsedMs(),
      kindlingValueModifier: sortieModifiers?.kindlingValueModifier,
      toolSlots: toolSlots.length > 0 ? toolSlots : undefined,
    });

    // Apply initial chaos modulators (all at 0 - no effect)
    this.applyChaosModulators(getChaosModulators(0));

    // Consume pending side effects from defense engine (Slice 4)
    this.applyPendingSideEffects();

    this.minimap.create(
      tileMap.tiles,
      tileMap.cols,
      tileMap.rows,
      tileMap.tileSize,
      layout.extractionPoint.position,
    );

    this.bindAttackKey();
    this.bindExtractionKeys();
    this.bindToolKeys();

    // Visibility runs after the physics step so the mask and the sprite agree on where
    // the player actually ended up this frame.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.bindAIStimuli();
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);

    if (import.meta.env.DEV) this.createDebugOverlay();
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);
    this.ai.update(delta, this.player.getPosition(), this.player.isMoving());

    // Edge-triggered: holding the key does not chain swings.
    if (this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.combat.requestPlayerAttack();
    }
    // After the AI, always. Whether an enemy may swing is read from this frame's engaged
    // state; one frame of lag on that at 30 px reads as "it is right there and doing
    // nothing".
    this.combat.update(delta);

    // T9 systems
    this.chaos.update(delta);
    this.loot.update();
    this.contaminantNodes.update(delta);
    this.toolSystem.update(delta);
    this.extraction.update(delta);
    this.hud.update(delta);

    // Tool key input (edge-triggered)
    if (this.toolKey0 && Phaser.Input.Keyboard.JustDown(this.toolKey0)) {
      this.toolSystem.useSlot(0);
    }
    if (this.toolKey1 && Phaser.Input.Keyboard.JustDown(this.toolKey1)) {
      this.toolSystem.useSlot(1);
    }

    // Trail system: record player position and redraw visible trail marks.
    const playerPos = this.player.getPosition();
    const tile = GAME_CONSTANTS.TILE_SIZE;
    this.trail.update(
      Math.floor(playerPos.x / tile),
      Math.floor(playerPos.y / tile),
      this.chaos.getValue(),
      delta
    );

    // Minimap: reveal tiles within ambient radius around player
    this.minimap.update(playerPos);

    // Extraction key (edge-triggered)
    if (this.extractKey && Phaser.Input.Keyboard.JustDown(this.extractKey)) {
      this.extraction.requestExtract();
    }
    // Restart key handled via event listener (see bindExtractionKeys)
  }

  private onPostUpdate(_time: number, delta: number): void {
    this.player.postUpdate();
    this.visibility.update(this.player.getPosition(), this.player.getFacingAngle(), delta);
    // Enemies are drawn last of the three: their visibility is looked up against the mask
    // this frame produced, so an enemy is never drawn into darkness (rule R4).
    this.ai.postUpdate(delta);
    if (this.debugPanel) this.updateDebugOverlay(delta);
  }

  /**
   * Forwards the events the AI reacts to. This indirection is the point: combat and the
   * AI never call each other, the scene translates between them (architecture
   * DEC-ARCH-002). Combat emits these; the AI only ever receives them.
   */
  private bindAIStimuli(): void {
    eventBus.on(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
    eventBus.on(GameEvent.PLAYER_DIED, this.onRunEnded);
    eventBus.on(GameEvent.RIFT_EXIT_REACHED, this.onRunEnded);
    eventBus.on(GameEvent.RIFT_EXITED, this.onRunEnded);
    eventBus.on(GameEvent.CHAOS_THRESHOLD_REACHED, this.onChaosThreshold);
  }

  private bindAttackKey(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    // Captured so the browser does not scroll the page on space.
    const code = Phaser.Input.Keyboard.KeyCodes[GAME_CONSTANTS.COMBAT.ATTACK_KEY];
    this.attackKey = keyboard.addKey(code, true, false);
  }

  private bindExtractionKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const extractCode = Phaser.Input.Keyboard.KeyCodes[GAME_CONSTANTS.EXTRACTION.KEY];
    this.extractKey = keyboard.addKey(extractCode, true, false);
    const restartCode = Phaser.Input.Keyboard.KeyCodes[GAME_CONSTANTS.EXTRACTION.RESTART_KEY];
    this.restartKey = keyboard.addKey(restartCode, true, false);
    // Use event listener instead of polling in update() — works even when scene is paused
    keyboard.on('keydown-R', () => {
      if (this.runController.isRunEnded()) {
        this.runController.restart();
      }
    });
  }

  private bindToolKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    // Q = slot 0, F = slot 1 (spec F29)
    this.toolKey0 = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q, true, false);
    this.toolKey1 = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F, true, false);
  }

  private readonly onEnemyDamaged = ({ enemyId }: { enemyId: string }): void => {
    this.ai.reportDamage(enemyId, this.player.getPosition());
  };

  private readonly onEnemyKilled = ({ enemyId }: { enemyId: string }): void => {
    this.ai.despawn(enemyId);
  };

  /**
   * Death and extraction both end the run: everyone stands down and combat stops
   * accepting input or dealing damage. Combat disables itself on death as well; the two
   * are deliberately redundant, because a run that ends any other way still has to clear
   * the enemies mid-windup and the player's swing slow.
   */
  private readonly onRunEnded = (): void => {
    this.ai.onPlayerLost();
    this.combat.setEnabled(false);
  };

  /**
   * T9: Chaos threshold visual + narration overlay.
   * DOM-based (pointer-events:none, z-index:998) so it won't be clipped by the
   * Phaser vision mask and won't block gameplay input.
   */
  private readonly onChaosThreshold = ({ level }: { level: 1 | 2 | 3 }): void => {
    const config: Record<1 | 2 | 3, { color: string; alpha: number; text: string }> = {
      1: { color: '0, 180, 160', alpha: 0.08, text: '边界在渗透。' },
      2: { color: '0, 180, 160', alpha: 0.12, text: '混乱在蔓延。视野正在收缩。' },
      3: { color: '220, 40, 40', alpha: 0.15, text: '临界。净化点的回忆在模糊。' },
    };
    const { color, alpha, text } = config[level];

    // Inject keyframes once
    if (!document.getElementById('chaos-threshold-style')) {
      const style = document.createElement('style');
      style.id = 'chaos-threshold-style';
      style.textContent = `
        @keyframes chaos-flash-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chaos-flash-out { from { opacity: 1; } to { opacity: 0; } }
      `;
      document.head.appendChild(style);
    }

    // Full-screen flash overlay
    const overlay = document.createElement('div');
    overlay.className = 'chaos-threshold-overlay';
    overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'z-index:998', 'pointer-events:none',
      `background:rgba(${color}, ${alpha})`,
      'display:flex', 'align-items:flex-start', 'justify-content:center',
      'padding-top:20vh',
      'animation:chaos-flash-in 0.5s ease-out forwards',
    ].join(';');

    // Narration text
    const narration = document.createElement('div');
    narration.style.cssText = [
      'font-family:monospace', 'font-size:14px', 'color:#ffffff',
      'text-shadow:0 0 8px rgba(0,0,0,0.8)',
      'opacity:0', 'animation:chaos-flash-in 0.5s ease-out forwards',
    ].join(';');
    narration.textContent = text;
    overlay.appendChild(narration);

    document.body.appendChild(overlay);

    // Timeline: 0.5s fade-in, 2.0s hold, 0.5s fade-out, then remove (total 3s)
    setTimeout(() => {
      overlay.style.animation = 'chaos-flash-out 0.5s ease-in forwards';
      narration.style.animation = 'chaos-flash-out 0.5s ease-in forwards';
      setTimeout(() => overlay.remove(), 500);
    }, 2500); // 500ms fade-in + 2000ms hold
  };

  /** The single line that turns combat's noise policy into an AI stimulus. */
  private readonly reportNoise = (
    pos: Readonly<Vector2>,
    radius: number,
    level: NoiseLevel
  ): void => {
    this.ai.reportNoise(pos, radius, level);
  };

  /** Bound once so injecting it into the AI system allocates nothing per frame. */
  private readonly visibilityAt = (point: Readonly<Vector2>): number =>
    this.visibility.getVisibilityAt(point);

  /** Wired as the chaos system's onModulate callback. */
  private readonly applyChaosModulators = (mods: ChaosModulators): void => {
    this.visibility.setRadiusScale(mods.radiusScale);
    this.visibility.setEdgeCorruption(mods.edgeCorruption);
    this.visibility.setScreenFlicker(mods.screenFlicker);
    this.player.setSpeedModifier('chaos', mods.speedMult);
  };

  /**
   * Consume and apply pending side effects from defense engine.
   * These modify the sortie's starting conditions (chaos, speed, vision, etc.).
   */
  private applyPendingSideEffects(): void {
    const effects = gameState.consumePendingSideEffects();
    if (effects.length === 0) return;

    for (const effect of effects) {
      this.applySingleSideEffect(effect);
    }

    // Show toast notifications for side effects so the player understands what happened
    this.showSideEffectToasts(effects);
  }

  /** Show DOM toast notifications for defense side effects. */
  private showSideEffectToasts(effects: PendingSideEffect[]): void {
    // Map effect types to human-readable descriptions
    const describeEffect = (e: PendingSideEffect): string | null => {
      const sourceNames: Record<string, string> = {
        solidify: '晶锁残渣', ruminate: '噬化残渣', scatter: '裂散残渣',
        retrograde: '回溯残渣', delay: '缓释残渣', siphon: '虹吸残渣',
        expand: '膨胀残渣', muffle: '消声残渣', kindle: '燃尽残渣',
        stitch: '缝合残渣', compress: '致密残渣', echo: '回响残渣',
        erode: '侵蚀残渣', combust: '灰烬残渣', resonate: '共振残渣',
        overwrite: '覆写残渣', mirror: '镜映残渣', abyss: '深渊残渣',
      };
      const sourceName = e.source ? (sourceNames[e.source] ?? e.source) : '未知';

      switch (e.type) {
        case 'initial_chaos':
          return `防御残留: 初始混乱 +${e.value} (${sourceName})`;
        case 'chaos_rate_mult':
          return `防御残留: 混乱增速 x${e.value} ${e.durationMs ? `${e.durationMs / 1000}s` : ''} (${sourceName})`;
        case 'vision_reduction':
          return `防御残留: 视野 -${Math.round(e.value * 100)}% (${sourceName})`;
        case 'speed_reduction':
          return `防御残留: 移速 -${Math.round(e.value * 100)}% (${sourceName})`;
        case 'proximity_sense_boost':
          return `防御残留: 敌近距感知 +${Math.round(e.value * 100)}% (${sourceName})`;
        case 'storage_halved':
          return `防御残留: 储藏效果减半 (${sourceName})`;
        default:
          return null;
      }
    };

    const messages = effects.map(describeEffect).filter((m): m is string => m !== null);
    if (messages.length === 0) return;

    // Inject animation style if needed
    if (!document.getElementById('side-effect-toast-style')) {
      const style = document.createElement('style');
      style.id = 'side-effect-toast-style';
      style.textContent = `@keyframes side-effect-fade { 0%{opacity:1;} 70%{opacity:1;} 100%{opacity:0;} }`;
      document.head.appendChild(style);
    }

    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed', 'top:60px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:998', 'background:rgba(100,40,40,0.2)', 'border:1px solid #884444',
      'padding:8px 16px', 'font-family:monospace', 'font-size:11px',
      'color:#cc8888', 'border-radius:4px', 'pointer-events:none',
      'animation:side-effect-fade 3s ease-out forwards',
      'text-align:left', 'line-height:1.6',
    ].join(';');
    toast.innerHTML = messages.join('<br>');

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  private applySingleSideEffect(effect: PendingSideEffect): void {
    switch (effect.type) {
      case 'initial_chaos':
        // Add chaos immediately at sortie start
        this.chaos.addImmediate(effect.value);
        break;
      case 'chaos_rate_mult':
        // Multiply chaos rate for a duration
        if (effect.duration === 'timed' && effect.durationMs) {
          this.chaos.setTemporaryRateMult(effect.value, effect.durationMs);
        }
        break;
      case 'speed_reduction':
        // Reduce player speed for the sortie
        this.player.setSpeedModifier('defense_side_effect', 1.0 - effect.value);
        break;
      case 'vision_reduction':
        // Reduce visibility radius slightly
        this.visibility.setRadiusScale(1.0 - effect.value);
        break;
      case 'proximity_sense_boost':
        // Handled by the AI system reading tool debuffs (muffle passive may counteract)
        // Store as metadata for AI to read — simplified: no-op if muffle is active
        break;
      case 'repair_efficiency':
      case 'upgrade_discount':
      case 'storage_halved':
        // These are purification-phase effects, not sortie effects. No-op here.
        break;
    }
  }

  /** Resets all T9 systems and combat for a fresh run. */
  private resetAllSystems(): void {
    this.chaos.reset();
    this.loot.reset();
    this.contaminantNodes.reset();
    this.toolSystem.reset();
    this.extraction.reset();
    this.combat.reset();
    this.hud.reset();
    this.trail.reset();
    this.minimap.reset();
    this.applyChaosModulators(getChaosModulators(0));
  }

  /**
   * Draws all 8 navigation landmarks as simple coloured geometric marks onto a single
   * static Graphics object. Drawn once at create, never updated.
   */
  private createLandmarkDecals(landmarks: readonly LandmarkDef[], tileSize: number): void {
    const g = this.add.graphics();
    g.setDepth(2); // Above surface (0), below trail (5)
    this.landmarkGraphics = g;

    for (const lm of landmarks) {
      const cx = lm.col * tileSize + tileSize * 0.5;
      const cy = lm.row * tileSize + tileSize * 0.5;

      switch (lm.style) {
        case 'pool': {
          // Deep purple ellipse spanning 2x1 tiles
          g.fillStyle(0x2a0e3d, 0.55);
          g.fillEllipse(cx + tileSize * 0.5, cy, tileSize * 1.8, tileSize * 0.7);
          break;
        }
        case 'scratches': {
          // Three parallel diagonal lines, dark red
          g.lineStyle(1.5, 0x5c1a1a, 0.6);
          for (let i = -1; i <= 1; i++) {
            const offsetX = i * 6;
            g.beginPath();
            g.moveTo(cx + offsetX - 8, cy - 10);
            g.lineTo(cx + offsetX + 8, cy + 10);
            g.strokePath();
          }
          break;
        }
        case 'rubble': {
          // Scattered small grey squares
          g.fillStyle(0x4a4a4a, 0.5);
          const offsets = [
            [-8, -6], [4, -9], [10, -2], [-5, 5], [7, 8], [-10, 1], [2, -1],
          ];
          for (const [ox, oy] of offsets) {
            const size = 3 + Math.abs((ox! + oy!) % 3);
            g.fillRect(cx + ox! - size * 0.5, cy + oy! - size * 0.5, size, size);
          }
          break;
        }
        case 'crack': {
          // A single glowing green crack line
          g.lineStyle(1.5, 0x2dcc70, 0.65);
          g.beginPath();
          g.moveTo(cx - 12, cy - 2);
          g.lineTo(cx - 4, cy + 5);
          g.lineTo(cx + 3, cy - 3);
          g.lineTo(cx + 11, cy + 1);
          g.strokePath();
          break;
        }
        case 'scorch': {
          // Black radial burn mark
          g.fillStyle(0x0a0a0a, 0.5);
          g.fillCircle(cx, cy, 8);
          g.lineStyle(1, 0x1a1a1a, 0.4);
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            g.beginPath();
            g.moveTo(cx + Math.cos(angle) * 5, cy + Math.sin(angle) * 5);
            g.lineTo(cx + Math.cos(angle) * 13, cy + Math.sin(angle) * 13);
            g.strokePath();
          }
          break;
        }
        case 'crystals': {
          // Teal small triangle cluster
          g.fillStyle(0x1aad96, 0.55);
          const triangles = [
            [0, -8, -4, -2, 4, -2],
            [6, -4, 3, 3, 9, 3],
            [-6, -1, -9, 6, -3, 6],
            [1, 4, -2, 10, 4, 10],
          ];
          for (const t of triangles) {
            g.beginPath();
            g.moveTo(cx + t[0]!, cy + t[1]!);
            g.lineTo(cx + t[2]!, cy + t[3]!);
            g.lineTo(cx + t[4]!, cy + t[5]!);
            g.closePath();
            g.fillPath();
          }
          break;
        }
        case 'bloodtrail': {
          // Dark red drag line
          g.lineStyle(2.5, 0x4a1010, 0.55);
          g.beginPath();
          g.moveTo(cx - 14, cy - 1);
          g.lineTo(cx - 6, cy + 3);
          g.lineTo(cx + 2, cy - 1);
          g.lineTo(cx + 10, cy + 2);
          g.lineTo(cx + 14, cy);
          g.strokePath();
          // Small droplets
          g.fillStyle(0x4a1010, 0.4);
          g.fillCircle(cx - 10, cy + 6, 1.5);
          g.fillCircle(cx + 5, cy + 5, 1.2);
          break;
        }
        case 'rune': {
          // Pale white geometric pattern
          g.lineStyle(1, 0xcccccc, 0.4);
          // Outer diamond
          g.beginPath();
          g.moveTo(cx, cy - 10);
          g.lineTo(cx + 8, cy);
          g.lineTo(cx, cy + 10);
          g.lineTo(cx - 8, cy);
          g.closePath();
          g.strokePath();
          // Inner cross
          g.beginPath();
          g.moveTo(cx - 4, cy);
          g.lineTo(cx + 4, cy);
          g.moveTo(cx, cy - 4);
          g.lineTo(cx, cy + 4);
          g.strokePath();
          break;
        }
      }
    }
  }

  private returnToMenu(): void {
    this.scene.start('MainMenuScene');
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    this.input.keyboard?.off('keydown-F1');
    eventBus.off(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
    eventBus.off(GameEvent.PLAYER_DIED, this.onRunEnded);
    eventBus.off(GameEvent.RIFT_EXIT_REACHED, this.onRunEnded);
    eventBus.off(GameEvent.RIFT_EXITED, this.onRunEnded);
    eventBus.off(GameEvent.CHAOS_THRESHOLD_REACHED, this.onChaosThreshold);
    if (this.attackKey) {
      this.input.keyboard?.removeKey(this.attackKey, true);
      this.attackKey = null;
    }
    if (this.extractKey) {
      this.input.keyboard?.removeKey(this.extractKey, true);
      this.extractKey = null;
    }
    if (this.restartKey) {
      this.input.keyboard?.removeKey(this.restartKey, true);
      this.restartKey = null;
    }
    if (this.toolKey0) {
      this.input.keyboard?.removeKey(this.toolKey0, true);
      this.toolKey0 = null;
    }
    if (this.toolKey1) {
      this.input.keyboard?.removeKey(this.toolKey1, true);
      this.toolKey1 = null;
    }
    // Before the player is destroyed: this is what releases the swing speed modifier.
    this.combat.destroy();
    this.hud.destroy();
    this.runController.destroy();
    this.extraction.destroy();
    this.toolSystem.destroy();
    this.contaminantNodes.destroy();
    this.loot.destroy();
    this.chaos.destroy();
    this.ai.destroy();
    this.trail.destroy();
    this.minimap.destroy();
    this.visibility.destroy();
    this.player.destroy();
    this.tilemapRenderer.destroy();
    this.landmarkGraphics?.destroy();
    this.landmarkGraphics = null;
    this.debugPanel?.remove();
    this.debugPanel = null;
  }

  // ------------------------------------------------------------ dev overlay

  /**
   * Reports the numbers this slice has to be verified against: framing in tiles, the
   * raycasting cost against its 2 ms budget, and whether the static cache is holding.
   *
   * A DOM overlay rather than a Phaser Text: scroll-factor-0 game objects are still
   * transformed by the camera zoom, so anything meant to be screen-space needs either a
   * second camera or the DOM. The DOM is the cheaper answer for a dev panel.
   * Dev builds only; F1 toggles it.
   */
  private createDebugOverlay(): void {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:8px',
      'z-index:10',
      'padding:4px 6px',
      'font:11px/1.45 monospace',
      'color:#8ad8cc',
      'background:rgba(0,0,0,0.55)',
      'white-space:pre',
      'pointer-events:none',
    ].join(';');
    (document.getElementById('game-container') ?? document.body).appendChild(panel);
    this.debugPanel = panel;

    this.input.keyboard?.on('keydown-F1', () => {
      this.debugVisible = !this.debugVisible;
      if (this.debugPanel) this.debugPanel.style.display = this.debugVisible ? 'block' : 'none';
    });
  }

  private updateDebugOverlay(delta: number): void {
    this.debugAccumulatorMs += delta;
    if (this.debugAccumulatorMs < 200) return;
    this.debugAccumulatorMs = 0;

    const camera = this.cameras.main;
    const tile = GAME_CONSTANTS.TILE_SIZE;
    const stats = this.visibility.getStats();
    const ai = this.ai.getStats();
    const combat = this.combat.getStats();
    const position = this.player.getPosition();
    const view = camera.worldView;

    if (!this.debugPanel) return;
    const lines = [
      `fps ${Math.round(this.game.loop.actualFps)}  zoom ${camera.zoom}`,
      `viewport ${Math.round(view.width)}x${Math.round(view.height)}px = ` +
        `${(view.width / tile).toFixed(1)}x${(view.height / tile).toFixed(1)} tiles`,
      `rays ${stats.rayCount}  last ${stats.lastMs.toFixed(2)}ms  ` +
        `avg ${stats.avgMs.toFixed(2)}ms  budget ${GAME_CONSTANTS.VISIBILITY.BUDGET_MS}ms`,
      `degrade ${stats.degradeLevel}  ${stats.cached ? 'cached' : 'recast'}`,
      `pos ${Math.round(position.x)},${Math.round(position.y)}  ` +
        `tile ${Math.floor(position.x / tile)},${Math.floor(position.y / tile)}  ` +
        `facing ${this.player.getFacing4()}`,
      `ai ${ai.lastMs.toFixed(2)}ms avg ${ai.avgMs.toFixed(2)}ms  ` +
        `rays/frame ${ai.raysThisFrame}  paths/frame ${ai.pathsThisFrame}  ` +
        `unstick ${ai.unstickEvents}`,
      `A* calls ${ai.pathCalls} fail ${ai.pathFailures}  last ${ai.lastPathMs.toFixed(2)}ms ` +
        `(${ai.lastPathNodes}n) avg ${ai.avgPathMs.toFixed(2)}ms  queued ${ai.pendingPathRequests}`,
      `cue ${ai.lastCue}`,
      `hp ${combat.health}/${combat.maxHealth}  atk ${combat.phase.padEnd(8)} ` +
        `cd ${Math.round(combat.cooldownRemainingMs)}  iframe ${Math.round(combat.invulnRemainingMs)}` +
        `  tokens ${combat.attackTokensInUse}${combat.isDead ? '  DEAD' : ''}`,
      `combat cue ${combat.lastCue}  noise ${combat.lastNoise}`,
      `chaos ${this.chaos.getValue().toFixed(1)} [${this.chaos.getStage()}] ` +
        `rate ${this.chaos.getRate().toFixed(2)}/s  peak ${this.chaos.getPeak().toFixed(0)}`,
      `loot ${this.loot.getCarriedKindling()} carried  ${this.loot.getRemainingNodes()} remaining`,
    ];

    // Per-enemy line: the fastest way to check a downgrade chain actually walks itself
    // back down (chase -> alert -> suspicious -> return -> patrol).
    for (const enemy of this.ai.getEnemies()) {
      const enemyPos = enemy.getPosition();
      lines.push(
        `  ${enemy.getId()} ${enemy.getState().padEnd(10)} ` +
          `hp ${this.combat.getEnemyHealth(enemy.getId()) ?? '-'} ` +
          `det ${enemy.getDetection().toFixed(2)} ` +
          `d ${Math.round(Math.hypot(enemyPos.x - position.x, enemyPos.y - position.y))}` +
          (enemy.isEngaged() ? ' engaged' : '')
      );
    }

    lines.push('F1 overlay   ESC menu');
    this.debugPanel.textContent = lines.join('\n');
  }
}
