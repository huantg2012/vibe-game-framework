import { hasLineOfSight } from '@/utils/grid-raycast';
import { collectToolRevealSnapshot, findStitchPlacement, findSingleWallLanding, findSoundLureLanding } from '@/systems/tool-targeting';
import { getSurvivalAttributes, sumPollutionResistance } from '@/systems/survival-attributes';
import { inventoryStore } from '@/systems/inventory-store';
import { FieldLootInventory, notifyFieldAcquisition } from '@/systems/field-loot-inventory';
import { openInventory, projectInventoryItem } from '@/ui/inventory-presenter';
import { inventoryPanel } from '@/ui/dom/inventory-panel';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { GroundDepthSorter, GROUND_LIGHT_DEPTH, WORLD_READOUT_DEPTH, type GroundDepthTarget } from '@/systems/ground-depth';
import { productionModelFor } from '@/entities/form-renderers/d/production-models';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
/**
 * Rift Scene - core gameplay.
 *
 * At this point it owns the generated layout, the player, the limited field of view,
 * the enemies and combat. Chaos/loot/extraction plug in on top; the layout
 * comes from `generateRiftLayout(seed)` for this sortie.
 *
 * The scene is the orchestration layer: it owns the system instances and does the wiring
 * between them, which is what keeps the systems from calling each other directly
 * (architecture DEC-ARCH-002). Combat and the AI are the clearest case - neither imports
 * the other, and every effect one has on the other passes through the translations below.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { isActorWalking } from '@/entities/actor-motion';
import { Enemy } from '@/entities/enemy-factory';
import { getFormRenderer, type FormVisual, type FormVisualSignal } from '@/entities/form-renderers/registry';
import { Player } from '@/entities/player';
import type { FormAttackPose } from '@/entities/form-renderers/form-renderer';
import { generateRiftLayout } from '@/generation/rift-layout';
import type { GeneratedRiftLayout } from '@/generation/types';

/** Development encounters still use the complete production scene lifecycle. */
export interface RiftDevFixture {
  createLayout(): GeneratedRiftLayout;
  onReturn(): void;
  onPause?(): void;
}
import { mix32 } from '@/generation/seed-fork';
import { AISystem, ENEMY_DEPTH } from '@/systems/ai';
import { ChaosSystem, getChaosModulators, type ChaosModulators } from '@/systems/chaos-system';
import { gameState, type SortieModifiers } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { CombatSystem, COMBAT_FX_DEPTH, type CombatCueId, type NoiseLevel } from '@/systems/combat-system';
import { ContaminationHostSystem } from '@/systems/contamination-host-system';
import { contaminantSystem } from '@/systems/contaminant-system';
import { ExtractionSystem } from '@/systems/extraction-system';
import { growthSystem } from '@/systems/growth-system';
import { LootSearchSystem } from '@/systems/loot-search-system';
import { RunController } from '@/systems/run-controller';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { ToolSystem } from '@/systems/tool-system';
import { TrailSystem } from '@/systems/trail-system';
import { RiftSurfacePainter } from '@/systems/procedural-surface';
import { createRiftVisionConfig, VisibilitySystem } from '@/systems/visibility-system';
import { DetectionPulse } from '@/ui/dom/detection-pulse';
import { EncounterNarration } from '@/ui/dom/encounter-narration';
import { RiftHud, type ActiveEffectInfo, type RiftEquipmentSlot } from '@/ui/dom/rift-hud';
import { Minimap } from '@/ui/minimap';
import { getDefenseName, getToolName } from '@/ui/contaminant-names';
import { describeSideEffectBody, formatChaosMultDelta } from '@/ui/side-effect-labels';
import { riftResultPanel } from '@/ui/dom/rift-result-panel';
import { pauseMenu } from '@/ui/dom/pause-menu';
import { getDomUiRoot, showToastInline } from '@/ui/dom/panel-styles';
import type { PendingSideEffect } from '@/systems/defense-engine';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { AIState, TileType, type Contaminant, type ContaminantRarity, type ContaminantType, type Vector2 } from '@/types/game-types';
import type { AICueId } from '@/types/ai-types';
import type { LandmarkDef } from '@/types/map-types';
import { GameEvent } from '@/types/events';
import { clamp } from '@/utils/math';

/** Render depths. The gaps leave room for decals, entities and the HUD. */
const DEPTH = {
  surface: 0,
  /** 丙 visual ≤ surface+1; must stay under the player (30). */
  bing: 1,
  /** 乙 seam core. */
  yi: 20,
  /** Owned by the AI system, which creates the enemy sprites. 甲 ≈ 25. */
  enemy: ENEMY_DEPTH,
  player: 30,
  /** 丁 cloud. Must stay below visionMask (~50). */
  ding: GAME_CONSTANTS.CONTAMINATION.VOLUME_DEPTH,
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
  private readonly hosts = new ContaminationHostSystem();
  private readonly search = new LootSearchSystem();
  private readonly toolSystem = new ToolSystem();
  private readonly extraction = new ExtractionSystem();
  private toolInputAllowed = true;
  private unsubscribeInventory: (() => void) | null = null;
  private readonly fieldInventory = new FieldLootInventory();
  private devFixture: RiftDevFixture | null = null;
  private devElapsedMs = 0;
  private inventoryClosedAt = -1000;
  private readonly runController = new RunController();
  private readonly hud = new RiftHud();
  private readonly encounter = new EncounterNarration();
  private thresholdUntilMs = 0;
  private readonly detectionPulse = new DetectionPulse();
  private readonly minimap = new Minimap();
  private readonly riftSurface = new RiftSurfacePainter();
  private chaos!: ChaosSystem;

  private landmarkGraphics: Phaser.GameObjects.Graphics | null = null;

  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  private extractKey: Phaser.Input.Keyboard.Key | null = null;
  private restartKey: Phaser.Input.Keyboard.Key | null = null;
  /** One entry per active sortie slot (2 base, 3 with growth_sortie_slot), see `bindToolKeys`. */
  private toolKeys: Phaser.Input.Keyboard.Key[] = [];

  private debugPanel: HTMLDivElement | null = null;
  /** V7 (ui-art-overhaul.md A1): dev overlay must not outshine the real HUD by
   *  default. F1 opens it; DEV builds only (see `createDebugOverlay`). */
  private debugVisible = false;
  /** Seeded past the refresh interval so the panel has content on the first frame. */
  private debugAccumulatorMs = Number.POSITIVE_INFINITY;
  private layoutDebug = { seed: 0, fragmentTypeId: '', recipeId: '' };
  private lastStepAt = -1000;
  private hitThisFrame = false;
  private probeSearchHeld = false;
  private wasSpotted = false;
  private atmosphereHeldOff = false;
  private atmosphereRestoreAt = 0;

  // --- Sortie result tracking (feeds the DOM result panel on exit, C2) ---
  private sortieKillCount = 0;
  private sortieAcquired: { type: ContaminantType; rarity: ContaminantRarity }[] = [];
  private sortiePassiveTriggers = new Map<ContaminantType, number>();
  /** Defense residue lines shown in the rift HUD; remainingMs ticked here, then
   *  merged with tool-system remaining each frame so tool rows are not double-counted. */
  private defenseHudEffects: ActiveEffectInfo[] = [];
  /** Reused each post-update so the minimap visibility scan does not allocate. */
  private readonly minimapVisibilityQuery: Vector2 = { x: 0, y: 0 };
  /** Reused for scheme D visibility samples (乙 seam is offset 1px into the floor). */
  private readonly formVisQuery: Vector2 = { x: 0, y: 0 };
  private groundDepthSorter: GroundDepthSorter | null = null;
  private readonly formVisuals = new Map<string, FormVisual>();
  private formFloorGrid: TileGrid | null = null;

  constructor() {
    super({ key: 'RiftScene' });
  }

  create(data?: { modifiers?: SortieModifiers; cycle?: number; loadout?: (Contaminant | null)[]; devFixture?: RiftDevFixture }): void {
    this.devFixture = import.meta.env.DEV ? data?.devFixture ?? null : null;
    this.devElapsedMs = 0;
    this.probeSearchHeld = false;
    this.inventoryClosedAt = -1000;
    this.thresholdUntilMs = 0;
    this.toolInputAllowed = true;
    const sortieModifiers = data?.modifiers;
    const sortieLoadout = data?.loadout ?? contaminantSystem.getSortieLoadout();
    let seed = readRiftSeed();
    const recipeId = readRiftRecipeId();
    let generated;
    try {
      generated = this.devFixture?.createLayout() ?? generateRiftLayout(seed, recipeId ? { recipeId } : undefined);
      seed = generated.seed;
    } catch (err) {
      console.error(`[RiftScene] generateRiftLayout(${seed}) failed`, err);
      throw err;
    }
    const tileMap = generated.tileMap;
    const grid = new TileGrid(tileMap);
    this.formFloorGrid = grid;
    const layout = generated;
    this.layoutDebug = {
      seed: generated.seed,
      fragmentTypeId: generated.fragmentTypeId,
      recipeId: generated.recipeId,
    };

    // The tilemap layer stays for physics/collision but is made invisible: the visible
    // surface is a continuous procedural texture (DEC-018), not the flat placeholder tiles.
    const layer = this.tilemapRenderer.create(this, tileMap, {
      tilesetKey: 'placeholder-rift-tileset',
      collidingIndices: [TileType.WALL, TileType.VOID],
      depth: DEPTH.surface,
    });
    layer.setVisible(false);

    this.riftSurface.mount(this, generated.ruins, RIFT_SURFACE_KEY, DEPTH.surface);

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
    this.visibility.clipLightsToIsland(tileMap);
    this.visibility.setExtractionPosition(layout.extractionPoint.position);

    this.trail.create(this, tileMap.cols, tileMap.tileSize, this.visibilityAt);
    this.createLandmarkDecals(layout.landmarks, tileMap.tileSize);

    // The AI reads the same grid twice through two different contracts: as an occluder
    // grid for line of sight, as a walk grid for pathfinding. Slice 1 derives both from
    // one tile array, but low walls or chasms would break that equivalence later.
    const hearingCount = layout.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length;
    if (hearingCount !== 1) throw new Error(`Rift hearing budget invalid: ${hearingCount}`);
    const floorHearingCount = layout.enemySpawns.filter(spawn => spawn.form?.lexemes.sense === 'sense_hear').length;
    this.ai.create(this, layout.enemySpawns, grid, grid, { requireExactlyOneRewriter: floorHearingCount === 1 });
    this.ai.setVisibilityProvider(this.visibilityAt);
    this.ai.addWallCollider(layer);
    this.ai.addStaticPlayerCollider(this.player.getSprite());

    // Combat gets a read-only view of the AI (`getEnemies` / `getEnemyById`) plus one
    // callback. Noise is the only cross-system output that does not go through the bus: a
    // whiffed swing is audible yet emits nothing, so there is no event to carry it.
    this.combat.create(this, grid, this.player, this.ai, {
      onNoise: this.reportNoise,
      onCue: this.onCombatCue,
      captureEnemyVisual: (id) => this.formVisuals.get(id)?.getFlashSource?.(),
      consumeWeaponUse: () => {
        const id = inventoryStore.getEquipment().weaponId;
        if (!id) return false;
        const result = inventoryStore.consumeEquipmentUse(id);
        if (!result.ok && result.error === 'storage-failed') showToastInline('未能保存耐久度，本次命中没有生效。', {});
        return result.ok;
      },
    });
    const weaponId = inventoryStore.getEquipment().weaponId;
    const equippedWeapon = weaponId ? inventoryStore.getItem(weaponId) : undefined;
    this.combat.configureWeapon(equippedWeapon?.kind === 'weapon'
      ? equippedWeapon.weapon.definitionId
      : import.meta.env.DEV && !inventoryStore.getRun() ? 'crowbar_plain' : null, seed);

    // --- T9 systems: chaos, loot, extraction, run controller, HUD ---

    // Apply growth modifiers on top of module modifiers
    const growthMods = growthSystem.getModifiers();
    const effectiveChaosRate = (sortieModifiers?.chaosRateModifier ?? 1.0) * (1 - growthMods.chaosResist);
    // growthMods.kindlingAffinity (+N per pickup) applied through LootSearchSystem config below
    // growthMods.vitalityBonus (+HP) applied through combat system max health

    const startingChaos = sortieModifiers?.startingChaos ?? gameState.getStartingChaos();
    let residueChaos = 0;
    for (const effect of gameState.getPendingSideEffects()) {
      if (effect.type === 'initial_chaos') residueChaos += effect.value;
    }
    const openingChaos = clamp(startingChaos + residueChaos, 0, GAME_CONSTANTS.CHAOS.HARD_CAP);

    this.chaos = new ChaosSystem({
      isEnemyTargetingLure: id => this.ai.getEnemyById(id)?.isTargetingLure?.() ?? false,
      onModulate: this.applyChaosModulators,
      chaosRateModifier: effectiveChaosRate,
      startingValue: openingChaos,
      getPollutionResistance: () => sumPollutionResistance([getSurvivalAttributes().resistancePercent, this.toolSystem.getPollutionResistanceBonus()]),
    });
    this.hosts.create(this, layout, this.combat, this.chaos, this.visibilityAt, { liveMotion: true, occluders: grid,
      hearingPolicy: {
        getRangeMultiplier: () => this.ai.getHearingRangeMultiplier(),
        suppressDiscovery: (id) => this.ai.trySuppressHearingDiscovery(id),
      },
    });

    this.search.create(this, layout.kindlingNodes, layout.contaminantNodes, {
      inventoryEnabled: true,
      runSeed: seed,
      onMessage: message => showToastInline(message, {}),
      overlayRoot: getDomUiRoot(),
      getVisibilityAt: this.visibilityAt,
      fragmentTypeId: generated.fragmentTypeId,
      extraction: {
        position: layout.extractionPoint.position,
        radius: layout.extractionPoint.triggerRadius,
      },
      onNoise: this.reportNoise,
      kindlingValueModifier: sortieModifiers?.kindlingValueModifier,
    });

    this.fieldInventory.create(this, () => this.player.getPosition(), this.visibilityAt,
      position => grid.isWalkableAt(position.x, position.y), () => this.openBag(),
      message => showToastInline(message, {}));

    // Tool system (Slice 4/5): sortie loadout with expanded options. The Slice 5 (T1/T2)
    // entries route enemy-, combat- and chaos-facing tool effects into AISystem /
    // CombatSystem / ChaosSystem the same way `setPlayerCollision` / `addKindling` above
    // already route player- and loot-facing ones - the scene stays the only place two
    // systems' effects on each other get translated (architecture DEC-ARCH-002).
    this.toolSystem.create(
      this,
      sortieLoadout,
      () => this.player.getPosition(),
      () => this.ai.getEnemies(),
      {
        getPlayerSprite: () => this.player.getSprite(),
        getPlayerGroundY: () => this.player.getGroundY(),
        getGroundVisualDepth: groundY => this.groundDepthSorter?.depthAt(groundY) ?? 29,
        captureEnemyVisual: id => this.formVisuals.get(id)?.getFlashSource?.(),
        isTargetAlive: id => this.combat.isEnemyAlive(id),
        isTargetVisible: position => this.visibilityAt(position) > 0,
        hasTargetLineOfSight: (from, to) => hasLineOfSight(grid, from, to),
        setEnemyControl: (id, source, effect) => this.ai.setEnemyControl(id, source, effect),
        clearEnemyControl: (id, source) => this.ai.clearEnemyControl(id, source),
        hasEnemyControl: (id, source) => this.ai.hasEnemyControl(id, source),
        setVisualDecoy: (source, position) => this.ai.setVisualDecoy(source, position),
        reportSoundLure: (position, radius) => this.ai.reportSoundLure(position, radius),
        getSoundLureDestination: maxDistance => {
          const body = this.player.getSprite().body as Phaser.Physics.Arcade.Body | null;
          if (!body) return null;
          const angle = this.player.getFacingAngle();
          return findSoundLureLanding(body.center, { x: Math.cos(angle), y: Math.sin(angle) }, maxDistance,
            grid, Math.max(body.halfWidth, body.halfHeight) * 2);
        },
        getStitchPlacement: (length, distance) => {
          const angle = this.player.getFacingAngle();
          return findStitchPlacement(this.player.getPosition(), { x: Math.cos(angle), y: Math.sin(angle) }, distance, length,
            grid, (from, to) => hasLineOfSight(grid, from, to));
        },
        getRevealSnapshot: range => collectToolRevealSnapshot(this.player.getPosition(), range, grid,
          this.ai.getEnemies().filter(enemy => this.combat.isEnemyAlive(enemy.getId())).map(enemy => enemy.getPosition()),
          this.search.getUncollectedSearchPositions(), this.hosts.getToolTargets().map(host => host.position)),
        delayEnvironmentHazard: (id, source, duration) => this.hosts.delayNextHazard(id, source, duration),
        getEnvironmentTargets: () => this.hosts.getToolTargets(),
        suppressEnvironmentHazard: (id, source, duration) => this.hosts.suppressHazard(id, source, duration),
        clearEnvironmentControl: (id, source) => this.hosts.clearToolControl(id, source),
        getPhaseDestination: () => {
          const sprite = this.player.getSprite();
          const body = sprite.body as Phaser.Physics.Arcade.Body | null;
          if (!body) return null;
          const angle = this.player.getFacingAngle();
          const landing = findSingleWallLanding({
            origin: body.center, direction: { x: Math.cos(angle), y: Math.sin(angle) },
            maxDistance: CONTAMINANT_DATA.expand.toolRangePx,
            bodyHalfWidth: body.halfWidth, bodyHalfHeight: body.halfHeight,
            grid, isPhaseableWall: (col, row) => grid.getTile(col, row) === TileType.WALL,
          });
          return landing ? { x: sprite.x + landing.x - body.center.x, y: sprite.y + landing.y - body.center.y } : null;
        },
        movePlayerTo: position => {
          const body = this.player.getSprite().body as Phaser.Physics.Arcade.Body;
          body.reset(position.x, position.y);
          this.player.postUpdate();
        },
        setPlayerCollision: (enabled) => {
          const sprite = this.player.getSprite();
          const body = sprite.body as Phaser.Physics.Arcade.Body | null;
          if (body) body.enable = enabled;
        },
        setPlayerInput: (enabled) => { this.toolInputAllowed = enabled; this.syncPlayerInput(); },
        getCollectedNodes: () => this.search.getCollectedKindlingPositions(),
        addKindling: (n) => this.search.addBonusKindling(n),
        setEnemySpeedMultiplier: (id, mult) => this.ai.setEnemySpeedMultiplier(id, mult),
        setEnemyMovementLocked: (id, locked) => this.ai.setEnemyMovementLocked(id, locked),
        setEnemyPerceptionMultiplier: (id, mult) => this.ai.setEnemyPerceptionMultiplier(id, mult),
        reverseEnemyPatrol: (id) => this.ai.reverseEnemyPatrol(id),
        forceEnemyReturn: (id) => this.ai.forceEnemyReturn(id),
        knockbackEnemy: (id, dx, dy) => this.ai.knockbackEnemy(id, dx, dy),
        setDecoyPosition: (pos) => this.ai.setDecoyPosition(pos),
        damageEnemy: (id, amount) => this.combat.applyToolDamage(id, amount),
        showAbyssReveal: (enemies, nodes, durationMs, cores) => this.minimap.showAbyssReveal(enemies, nodes, durationMs, cores),
        getKindlingPositions: () => this.search.getUncollectedSearchPositions(),
        boostChaosRate: (mult, durationMs) => this.chaos.setTemporaryRateMult(mult, durationMs),
        reduceChaosRate: (mult, durationMs) => this.chaos.setTemporaryRateReduction(mult, durationMs),
        // T7 rewire: the 8 Slice 4 tools' enemy-facing overrides, wired the same way.
        setEnemyEscalationSuppressed: (id, suppressed) => this.ai.setEnemyEscalationSuppressed(id, suppressed),
        forceEnemyAlert: (id) => this.ai.forceEnemyAlert(id),
        demoteEnemyAlertLevel: (id) => this.ai.demoteEnemyAlertLevel(id),
        setEnemyDetectionFillRateMult: (id, mult) => this.ai.setEnemyDetectionFillRateMult(id, mult),
        setHearingSuppressed: (active) => this.ai.setHearingSuppressed(active),
      },
    );
    // muffle (T7 rewire): the AI announces a swallowed hearing signal here; ToolSystem
    // spends one of muffle's charges for it (same translation role as `reportNoise`).
    this.ai.setHearingAvoidedListener(() => this.toolSystem.notifyProximityAvoid());

    this.extraction.create(
      this,
      layout.extractionPoint,
      () => this.player.getPosition(),
      () => this.runController.isRunEnded(),
      { registerGlowSource: (id, pos, r) => this.visibility.registerGlowSource(id, pos, r) },
    );

    this.runController.create(this, {
      pauseChaos: (paused) => this.chaos.setPaused(paused),
      setPlayerInput: () => this.syncPlayerInput(),
      getCarriedKindling: () => this.search.getCarriedKindling(),
      onSettlementFailure: (message, retry) => this.showSettlementRetry(message, retry),
      onReturn: this.devFixture?.onReturn,
    });

    this.hud.create({
      canExtract: () => this.extraction.canExtract(),
      isRunEnded: () => this.runController.isRunEnded(),
      suppressExtractPrompt: true,
      onInventory: () => this.openBag(),
    });
    this.encounter.create();
    this.detectionPulse.create();

    this.sortieKillCount = 0;
    this.sortieAcquired = [];
    this.sortiePassiveTriggers = new Map();

    this.applyChaosModulators(getChaosModulators(this.chaos.getValue()));

    // Consume pending side effects from defense engine (Slice 4).
    // initial_chaos is already folded into openingChaos — do not add it again.
    this.applyPendingSideEffects();

    this.minimap.create(
      tileMap.tiles,
      tileMap.cols,
      tileMap.rows,
      tileMap.tileSize,
      layout.extractionPoint.position,
    );

    const updateBurden = (): void => {
      const id = inventoryStore.getEquipment().weaponId;
      const equipped = id ? inventoryStore.getItem(id) : undefined;
      this.combat.configureWeapon(equipped?.kind === 'weapon' ? equipped.weapon.definitionId : null);
      const attributes = getSurvivalAttributes();
      this.player.setBurdenSpeedFactor(attributes.burdenSpeedFactor);
      this.hud.setBurden(attributes.weight, attributes.capacity);
      const equipment = inventoryStore.getEquipment();
      const makeSlot = (slotId: string, itemId: string | null | undefined, label: string, isPassive = false): RiftEquipmentSlot => {
        const item = itemId ? inventoryStore.getItem(itemId) : undefined;
        const view = item ? projectInventoryItem(item, 'prepare') : undefined;
        return { slotId, itemId: view?.id, label, name: view?.name ?? '未装配', icon: view?.icon, usesRemaining: view?.usesRemaining, maxDurability: view?.maxDurability, isPassive };
      };
      const passive = contaminantSystem.getSortiePassiveSlotIndex();
      this.hud.setEquipment([makeSlot('weapon', equipment.weaponId, '武器'), ...Array.from({ length: contaminantSystem.getSortieSlotCount() }, (_, index) => makeSlot(String(index), equipment.toolIds[index], index === passive ? '被动' : GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[index] ?? '?', index === passive))]);
    };
    updateBurden();
    this.unsubscribeInventory = inventoryStore.subscribe(updateBurden);
    this.bindAttackKey();
    this.bindExtractionKeys();
    this.bindToolKeys();

    this.attachSchemeD();

    // Visibility runs after the physics step so the mask and the sprite agree on where
    // the player actually ended up this frame.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.bindAIStimuli();
    this.ai.setCueListener(this.onAiCue);
    this.startRiftAudio();
    this.input.keyboard?.on('keydown-ESC', this.openPauseMenu, this);
    this.input.keyboard?.on('keydown-TAB', this.openBag, this);

    if (import.meta.env.DEV) this.createDebugOverlay();
  }

  update(_time: number, delta: number): void {
    if (this.devFixture && !this.runController.isRunEnded()) this.devElapsedMs += delta;
    this.player.update(delta);
    this.syncRiftAudio();
    this.ai.update(delta, this.player.getPosition(), this.player.isMoving());

    // Edge-triggered: holding the key does not chain swings.
    if (this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey) && !inventoryPanel.isOpen() && !this.runController.isRunEnded()) {
      this.combat.requestPlayerAttack();
    }
    // After the AI, always. Whether an enemy may swing is read from this frame's engaged
    // state; one frame of lag on that at 30 px reads as "it is right there and doing
    // nothing".
    this.combat.update(delta);
    this.hosts.update(delta, this.player.getPosition(), this.player.isMoving(), this.player.getFacingAngle());
    this.toolSystem.syncHostVisuals();

    const tileSize = GAME_CONSTANTS.TILE_SIZE;
    const p = this.player.getPosition();
    const pCol = Math.floor(p.x / tileSize);
    const pRow = Math.floor(p.y / tileSize);
    this.encounter.tick(
      this.time.now,
      [
        ...this.ai.getEnemies().map((enemy) => ({
          id: enemy.getId(),
          form: enemy.getForm(),
          identifiable: this.visibility.getVisibilityAt(enemy.getPosition()) > 0,
        })),
        ...this.hosts.getSubjects().map((subject) => ({
          id: subject.id,
          form: subject.form,
          identifiable: this.hosts.isIdentifiable(subject.id, pCol, pRow),
        })),
      ],
      this.time.now < this.thresholdUntilMs,
    );

    // T9 systems
    this.chaos.update(delta);
    const toolJustDown: boolean[] = [];
    for (let i = 0; i < this.toolKeys.length; i++) {
      toolJustDown[i] = Phaser.Input.Keyboard.JustDown(this.toolKeys[i]!);
    }
    this.search.update(delta, {
      playerPos: this.player.getPosition(),
      searchHeld: this.probeSearchHeld || Boolean(this.extractKey?.isDown),
      moving: this.player.isMoving(),
      attacking: Boolean(this.attackKey?.isDown),
      toolPressed: toolJustDown.some(Boolean),
      hitThisFrame: this.hitThisFrame,
      paused: false,
      interactionBlocked: inventoryPanel.isOpen() || this.fieldInventory.hasNearby(),
      runEnded: this.runController.isRunEnded(),
    });
    this.fieldInventory.update(delta, {
      interactHeld: Boolean(this.extractKey?.isDown), extractPriority: this.search.getPrompt() === 'extract',
      blocked: inventoryPanel.isOpen() || this.runController.isRunEnded() || this.hitThisFrame || this.player.isMoving() || Boolean(this.attackKey?.isDown) || toolJustDown.some(Boolean),
    });
    this.hitThisFrame = false;
    this.toolSystem.update(delta);
    this.tickDefenseHudEffects(delta);
    this.syncHudActiveEffects();
    this.extraction.update(delta);
    this.hud.update(delta);
    this.riftSurface.update(delta);

    // Tool key input (edge-triggered), one entry per active sortie slot.
    for (let i = 0; i < this.toolKeys.length; i++) {
      if (toolJustDown[i] && !inventoryPanel.isOpen() && !this.runController.isRunEnded()) {
        if (!this.toolSystem.useSlot(i)) {
          const reason = this.toolSystem.getLastUseFailure();
          if (reason) showToastInline(reason, {});
        }
      }
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

    // Extraction key (edge-triggered). Search holds E; extract wins on same-frame JustDown
    // only when the shared prompt is extract (nearer / same-dist extraction).
    if (
      this.extractKey
      && Phaser.Input.Keyboard.JustDown(this.extractKey)
      && !inventoryPanel.isOpen()
      && this.search.getPrompt() === 'extract'
    ) {
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
    this.syncSchemeDPoses(delta);
    this.groundDepthSorter?.update();
    this.toolSystem.syncBodyVisuals();
    // Minimap after visibility so explored tiles match this frame's cone + occlusion.
    this.syncMinimapExploration();
    this.minimap.update(this.player.getPosition(), this.player.getFacing4(), delta);
    this.syncDetectionPulse(delta);
    if (this.debugPanel) this.updateDebugOverlay(delta);
  }

  /**
   * Accumulates tiles currently visible by the same queries the main view uses.
   * Writes into the minimap; does not expand VisibilitySystem.
   *
   * Wall cells are opaque, so a center sample never gets line of sight. If the
   * center is dark, sample 1px outside each edge (in the adjacent cell). A
   * visible wall face then lights the wall; a blocked neighbor does not.
   */
  private syncMinimapExploration(): void {
    const tileSize = GAME_CONSTANTS.TILE_SIZE;
    const playerPos = this.player.getPosition();
    const playerTileX = Math.floor(playerPos.x / tileSize);
    const playerTileY = Math.floor(playerPos.y / tileSize);
    const range = Math.ceil(GAME_CONSTANTS.VISIBILITY.RADIUS_FORWARD / tileSize) + 1;

    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const tileX = playerTileX + dx;
        const tileY = playerTileY + dy;
        const left = tileX * tileSize;
        const top = tileY * tileSize;
        const midX = left + tileSize * 0.5;
        const midY = top + tileSize * 0.5;
        if (
          this.isMinimapSampleVisible(midX, midY) ||
          this.isMinimapSampleVisible(left - 1, midY) ||
          this.isMinimapSampleVisible(left + tileSize, midY) ||
          this.isMinimapSampleVisible(midX, top - 1) ||
          this.isMinimapSampleVisible(midX, top + tileSize)
        ) {
          this.minimap.markExplored(tileX, tileY);
        }
      }
    }
  }

  /**
   * Scene-layer translation only: AI and the rim pulse never import each other.
   * World positions become a 960×640 view box that tracks the camera, not Phaser HUD.
   */
  private syncDetectionPulse(deltaMs: number): void {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const player = this.player.getPosition();
    this.detectionPulse.update(
      deltaMs,
      { worldX: view.x, worldY: view.y, worldW: view.width, worldH: view.height },
      player,
      this.ai.getEnemies().filter(enemy => !enemy.isTargetingLure?.()).map((enemy) => {
        const pos = enemy.getPosition();
        return {
          id: enemy.getId(),
          detection: enemy.getDetection(),
          state: enemy.getState(),
          worldX: pos.x,
          worldY: pos.y,
        };
      }),
    );
  }

  private isMinimapSampleVisible(x: number, y: number): boolean {
    const point = this.minimapVisibilityQuery;
    point.x = x;
    point.y = y;
    return this.visibility.getVisibilityAt(point) > 0;
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
    eventBus.on(GameEvent.PLAYER_DAMAGED, this.onPlayerDamaged);
    eventBus.on(GameEvent.RIFT_EXIT_REACHED, this.onRunEnded);
    eventBus.on(GameEvent.RIFT_EXITED, this.onRunEnded);
    eventBus.on(GameEvent.RIFT_EXITED, this.onRiftExitedShowResult);
    eventBus.on(GameEvent.CHAOS_THRESHOLD_REACHED, this.onChaosThreshold);
    eventBus.on(GameEvent.CHAOS_CHANGED, this.onChaosChangedAudio);
    eventBus.on(GameEvent.ITEM_COLLECTED, this.onPickupAudio);
    eventBus.on(GameEvent.ITEM_USED, this.onUseAudio);
    eventBus.on(GameEvent.TOOL_USED, this.onUseAudio);
    eventBus.on(GameEvent.RIFT_EXIT_REACHED, this.onExitAudio);
    eventBus.on(GameEvent.CONTAMINANT_ACQUIRED, this.onContaminantAcquired);
    eventBus.on(GameEvent.TOOL_USED, this.onToolUsedForResult);
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

  /**
   * One key per active sortie slot (spec F29 for Q/F; the 3rd slot's G follows the same
   * "single source of truth" constant so it can never drift from what the loadout panel
   * displays). Bound dynamically off `getSortieActiveSlotCount()` rather than a fixed 2,
   * so growth_sortie_slot's 3rd active slot (Slice 5 T5) is actually usable in the rift,
   * not just equippable.
   */
  private bindToolKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const activeCount = contaminantSystem.getSortieActiveSlotCount();
    const keyNames = GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS;
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.toolKeys = [];
    for (let i = 0; i < activeCount; i++) {
      const keyName = keyNames[i];
      if (!keyName) break; // ran out of assigned keys; report as a gap rather than guess
      this.toolKeys.push(keyboard.addKey(codes[keyName], true, false));
    }
  }

  private readonly onPlayerDamaged = (): void => {
    this.hitThisFrame = true;
    inventoryPanel.close();
  };

  private readonly onEnemyDamaged = ({ enemyId }: { enemyId: string }): void => {
    this.ai.reportDamage(enemyId, this.player.getPosition());
  };

  private readonly onEnemyKilled = ({ enemyId }: { enemyId: string }): void => {
    this.destroySchemeDVisual(enemyId);
    this.ai.despawn(enemyId);
    this.sortieKillCount++;
  };

  private readonly onContaminantAcquired = ({ contaminant }: { contaminant: Contaminant }): void => {
    this.sortieAcquired.push({ type: contaminant.type, rarity: contaminant.rarity });
  };

  /** Passive tools (碎影/消声步/寄生引流) have no button - this is the only place
   *  their trigger count is captured for the result panel's "被动触发" line (S10). */
  private readonly onToolUsedForResult = ({ toolType }: { toolType: ContaminantType }): void => {
    if (CONTAMINANT_DATA[toolType]?.toolType !== 'passive') return;
    this.sortiePassiveTriggers.set(toolType, (this.sortiePassiveTriggers.get(toolType) ?? 0) + 1);
  };

  private readonly onRiftExitedShowResult = (payload: { kindlingGained: number; survived: boolean }): void => {
    riftResultPanel.show({
      survived: payload.survived,
      kindlingGained: payload.kindlingGained,
      killCount: this.sortieKillCount,
      peakChaos: this.chaos.getPeak(),
      elapsedMs: this.runController.getElapsedMs(),
      acquired: (inventoryStore.getRun()?.returnedIds ?? []).flatMap(id => {
        const item = inventoryStore.getItem(id);
        return item?.kind === 'contaminant' ? [{ type: item.contaminant.type, rarity: item.contaminant.rarity, quality: item.contaminant.quality }] : [];
      }),
      weapons: (inventoryStore.getRun()?.returnedIds ?? []).flatMap(id => {
        const item = inventoryStore.getItem(id);
        return item?.kind === 'weapon' ? [WEAPON_DATA[item.weapon.definitionId]?.name ?? '撬棍'] : [];
      }),
      passiveTriggers: this.sortiePassiveTriggers,
    }, () => {
      if (this.runController.isRunEnded()) this.runController.restart();
    });
  };

  /**
   * Death and extraction both end the run: everyone stands down and combat stops
   * accepting input or dealing damage. Combat disables itself on death as well; the two
   * are deliberately redundant, because a run that ends any other way still has to clear
   * the enemies mid-windup and the player's swing slow.
   */
  private readonly onRunEnded = (): void => {
    inventoryPanel.close();
    this.ai.onPlayerLost();
    this.combat.setEnabled(false);
  };

  /**
   * T9: Chaos threshold visual + narration overlay.
   * DOM-based (pointer-events:none, z-index:998) so it won't be clipped by the
   * Phaser vision mask and won't block gameplay input.
   */
  private readonly onChaosThreshold = ({ level }: { level: 1 | 2 | 3 }): void => {
    this.thresholdUntilMs = this.time.now + 3000;
    audioManager.playSFX('sfx-shared-chaos-threshold');
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
      "font:14px 'Courier New',monospace", 'color:#c8cdd4',
      'text-shadow:0 0 8px rgba(0,0,0,0.8)',
      'opacity:0', 'animation:chaos-flash-in 0.5s ease-out forwards',
    ].join(';');
    narration.textContent = text;
    overlay.appendChild(narration);

    // Mounted on the shared DOM UI root (C6), not document.body directly - the root's
    // transform is what keeps this text scaling in step with the canvas under Scale.FIT
    // (ui-art-overhaul.md §A1), same as every other DOM overlay.
    getDomUiRoot().appendChild(overlay);

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
    this.hosts.reportNoise(pos, radius);
  };

  private startRiftAudio(): void {
    audioManager.playBGM('bgm-rift-base-drone', 3.5);
    audioManager.setLayerVolume('base', 0.4, 0);
    audioManager.playSFX('sfx-rift-enter');
    if (this.chaos.getValue() <= 25) {
      audioManager.playAmbient('amb-rift-alien-atmosphere');
    }
  }

  private stepKey(): string {
    const material = RIFT_FRAGMENT_DATA[this.layoutDebug.fragmentTypeId]?.surfaceMaterial ?? 'soil';
    if (material === 'metal') return 'sfx-shared-player-step-metal';
    if (material === 'soil' || material === 'wood') return 'sfx-shared-player-step-organic';
    return 'sfx-shared-player-step-crystal';
  }

  private syncRiftAudio(): void {
    const now = this.time.now;
    const playerPos = this.player.getPosition();
    if (this.player.isMoving() && now - this.lastStepAt >= 400) {
      this.lastStepAt = now;
      audioManager.playSFX(this.stepKey(), { priority: 'low' });
    }

    const value = this.chaos.getValue();
    const tension = value > 25 ? 0.4 * clamp((value - 25) / 75, 0, 1) : 0;
    const enemies = this.ai.getEnemies();
    const spotted = enemies.some((enemy) => {
      const state = enemy.getState();
      return !enemy.isTargetingLure?.() && (state === AIState.ALERT || state === AIState.CHASE);
    });
    const chaosThreat = value > 60 ? 0.5 * clamp((value - 60) / 40, 0, 1) : 0;
    const threat = spotted ? Math.max(0.5, chaosThreat) : chaosThreat;

    let prox = 0;
    const nodes = this.search.getRemainingContaminantPositions();
    if (nodes.length > 0) {
      let best = Infinity;
      for (const node of nodes) {
        const d = Math.hypot(node.x - playerPos.x, node.y - playerPos.y) / GAME_CONSTANTS.TILE_SIZE;
        if (d < best) best = d;
      }
      if (best <= 3) prox = 0.3;
      else if (best < 6) prox = 0.3 * (1 - (best - 3) / 3);
    }

    audioManager.setLayerVolume('base', 0.4, 0);
    audioManager.setLayerVolume('tension', tension, 1);
    audioManager.setLayerVolume('threat', threat, spotted ? 0.5 : 1);
    audioManager.setLayerVolume('proximity', prox, 1);

    if (tension > 0.05) {
      if (!this.atmosphereHeldOff) {
        audioManager.stopAmbient('amb-rift-alien-atmosphere', 0.4);
        this.atmosphereHeldOff = true;
      }
      this.atmosphereRestoreAt = 0;
    } else if (this.atmosphereHeldOff) {
      if (this.atmosphereRestoreAt === 0) this.atmosphereRestoreAt = now + 1000;
      if (now >= this.atmosphereRestoreAt) {
        audioManager.playAmbient('amb-rift-alien-atmosphere', 1);
        this.atmosphereHeldOff = false;
        this.atmosphereRestoreAt = 0;
      }
    }

    if (spotted && !this.wasSpotted) audioManager.duckAmbientGroup();
    this.wasSpotted = spotted;
    this.syncEnemyLoops(playerPos);
  }

  private syncEnemyLoops(playerPos: Readonly<Vector2>): void {
    const enemies = this.ai.getEnemies();
    const rewriter = enemies.find((enemy) => enemy.getRole() === 'rewriter');
    if (rewriter) {
      const chasing = rewriter.getState() === AIState.CHASE;
      audioManager.playSpatialSFX(
        chasing ? 'sfx-rift-enemy-chase' : 'sfx-rift-enemy-overwriter-hum',
        rewriter.getPosition(),
        playerPos,
        { loop: true, instanceId: 'slot-r' },
      );
    } else {
      audioManager.stopLoop('slot-r');
    }

    const infiltrators = enemies.filter((enemy) => enemy.getRole() === 'infiltrator');
    if (infiltrators.length === 0) {
      audioManager.stopLoop('slot-i');
      return;
    }
    const chasing = infiltrators.filter((enemy) => enemy.getState() === AIState.CHASE);
    const pool = chasing.length > 0 ? chasing : infiltrators;
    let nearest = pool[0]!;
    let best = Infinity;
    for (const enemy of pool) {
      const pos = enemy.getPosition();
      const d = Math.hypot(pos.x - playerPos.x, pos.y - playerPos.y);
      if (d < best) {
        best = d;
        nearest = enemy;
      }
    }
    audioManager.playSpatialSFX(
      chasing.length > 0 ? 'sfx-rift-enemy-chase' : 'sfx-rift-enemy-idle',
      nearest.getPosition(),
      playerPos,
      { loop: true, instanceId: 'slot-i' },
    );
  }

  private readonly onAiCue = (enemyId: string, cue: AICueId): void => {
    if (cue === 'ai.cue.suspicious') return;
    const enemy = this.ai.getEnemyById(enemyId);
    if (!enemy) return;
    const playerPos = this.player.getPosition();
    if (cue === 'ai.cue.alert') {
      audioManager.playSpatialSFX('sfx-rift-enemy-alert', enemy.getPosition(), playerPos);
    }
    // chase / lost: looping slots are driven every frame by syncEnemyLoops
  };

  private readonly onCombatCue = (cue: CombatCueId, pos: Readonly<Vector2>): void => {
    const playerPos = this.player.getPosition();
    if (cue === 'combat.cue.swing') audioManager.playSFX('sfx-shared-player-attack');
    else if (cue === 'combat.cue.hit') audioManager.playSpatialSFX('sfx-rift-enemy-hit', pos, playerPos);
    else if (cue === 'combat.cue.enemyDeath') audioManager.playSpatialSFX('sfx-rift-enemy-die', pos, playerPos);
    else if (cue === 'combat.cue.enemyWindup') audioManager.playSpatialSFX('sfx-rift-enemy-alert', pos, playerPos);
    else if (cue === 'combat.cue.playerHurt') audioManager.playSFX('sfx-shared-player-hurt');
  };

  private readonly onChaosChangedAudio = ({ delta }: { delta: number }): void => {
    if (delta > 0) audioManager.playSFX('sfx-shared-chaos-tick', { volume: 0.15, priority: 'low' });
  };

  private readonly onPickupAudio = (): void => {
    audioManager.playSFX('sfx-shared-player-pickup');
  };

  private readonly onUseAudio = (): void => {
    audioManager.playSFX('sfx-shared-player-use-item');
  };

  private readonly onExitAudio = (): void => {
    audioManager.playSFX('sfx-rift-exit');
  };

  /** Bound once so injecting it into the AI system allocates nothing per frame. */
  private readonly visibilityAt = (point: Readonly<Vector2>): number =>
    this.visibility.getVisibilityAt(point);

  /** Wired as the chaos system's onModulate callback. */
  private readonly applyChaosModulators = (mods: ChaosModulators): void => {
    this.visibility.setRadiusScale(mods.radiusScale * this.hosts.getVolumeSightMult());
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

    // Channel B: one toast per residue, queued (max 2 visible).
    this.showSideEffectToasts(effects);
    this.defenseHudEffects = this.buildActiveEffectLines(effects);
    this.syncHudActiveEffects();
  }

  /** Turns sortie-duration side effects into HUD status lines. Instant/one-shot
   *  effects (initial_chaos, module_swap, purification-phase-only effects) have
   *  nothing ongoing to show and are intentionally omitted. */
  private buildActiveEffectLines(effects: PendingSideEffect[]): ActiveEffectInfo[] {
    const lines: ActiveEffectInfo[] = [];
    for (const e of effects) {
      switch (e.type) {
        case 'chaos_rate_mult':
          if (e.durationMs) {
            lines.push({ label: `混乱增速 ${formatChaosMultDelta(e.value)}`, remainingMs: e.durationMs });
          }
          break;
        case 'vision_reduction':
          lines.push({ label: `视野 -${Math.round(e.value * 100)}%` });
          break;
        case 'speed_reduction':
          lines.push({ label: `移速 -${Math.round(e.value * 100)}%` });
          break;
        case 'proximity_sense_boost':
          lines.push({ label: `敌近距感知 +${Math.round(e.value * 100)}%` });
          break;
        default:
          break; // initial_chaos / module_swap / purification-phase-only: no ongoing state
      }
    }
    return lines;
  }

  private tickDefenseHudEffects(deltaMs: number): void {
    if (this.defenseHudEffects.length === 0) return;
    for (const e of this.defenseHudEffects) {
      if (e.remainingMs === undefined) continue;
      e.remainingMs -= deltaMs;
    }
    this.defenseHudEffects = this.defenseHudEffects.filter(
      (e) => e.remainingMs === undefined || e.remainingMs > 0,
    );
  }

  private lastToolResistanceBonus = 0;
  private syncHudActiveEffects(): void {
    const resistanceBonus = this.toolSystem.getPollutionResistanceBonus();
    if (resistanceBonus !== this.lastToolResistanceBonus) {
      this.lastToolResistanceBonus = resistanceBonus;
      if (inventoryPanel.isOpen()) inventoryPanel.update();
    }
    const toolLines: ActiveEffectInfo[] = this.toolSystem.getActiveTimedEffects().map((e) => ({
      label: e.type === 'siphon' ? `抗污 +${resistanceBonus}` : e.type === 'expand' ? '身体归位' : e.type === 'abyss' ? '附近旧影 · 非实时' : getToolName(e.type),
      remainingMs: e.remainingMs,
    }));
    this.hud.setActiveEffects([...this.defenseHudEffects, ...toolLines]);
  }

  /** Show a Channel-B toast (ui-art-overhaul.md §A4, C6 shared primitive) disclosing
   *  defense side effects carried into this sortie. */
  private showSideEffectToasts(effects: PendingSideEffect[]): void {
    // Shared with impact-result-panel.ts (Slice 5.5 D5/V8) so the two "what did
    // this side effect do" mappings can never drift apart. This site keeps its own
    // "防御残留: " prefix + parenthesized source (its own established toast style).
    const describeEffect = (e: PendingSideEffect): string | null => {
      const body = describeSideEffectBody(e);
      if (!body) return null;
      const sourceName = e.source ? getDefenseName(e.source as ContaminantType) : '未知';
      return `防御残留: ${body} (${sourceName})`;
    };

    const messages = effects.map(describeEffect).filter((m): m is string => m !== null);
    if (messages.length === 0) return;

    const extraStyle = "background:rgba(15,17,20,0.92);border:1px solid #cc3333;padding:8px 16px;" +
      "font:12px 'Courier New',monospace;text-align:left;line-height:1.6;";
    for (const msg of messages) {
      showToastInline(msg, {
        color: '#cc3333',
        extraStyle,
      });
    }
  }

  private applySingleSideEffect(effect: PendingSideEffect): void {
    switch (effect.type) {
      case 'initial_chaos':
        // Already written into ChaosSystem.startingValue (rule 31a). Toast still fires.
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
        // muffle's *defense*-slot side effect (next sortie's enemies hear better) -
        // distinct from muffle's tool-slot passive (`AISystem.setHearingSuppressed()`,
        // wired by the T7 rewire). `effect.value` is the fractional boost (0.15 = +15%),
        // so the multiplier handed to AISystem is `1 + value`.
        this.ai.setHearingRangeMultiplier(1.0 + effect.value);
        break;
      case 'repair_efficiency':
      case 'upgrade_discount':
      case 'storage_halved':
        // These are purification-phase effects, not sortie effects. No-op here.
        break;
      case 'module_swap':
        // Already applied directly to GameState at impact-resolution time (DEC-031,
        // see impact-system.ts) so it takes effect before getSortieModifiers() is read
        // at the purification→rift transition. This case exists only to drive the toast.
        break;
    }
  }

  /**
   * Draws navigation landmarks as simple coloured geometric marks onto a single
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

  private syncPlayerInput(): void {
    this.player.setInputEnabled(this.toolInputAllowed && !inventoryPanel.isOpen() && !this.runController.isRunEnded());
  }

  private openBag(): void {
    if (inventoryPanel.isOpen() || this.runController.isRunEnded() || pauseMenu.isOpen() || this.time.now - this.inventoryClosedAt < 150) return;
    this.combat.clearAttackBuffer();
    this.attackKey?.reset();
    this.extractKey?.reset();
    for (const key of this.toolKeys) key.reset();
    this.player.setInputEnabled(false);
    openInventory({ mode: 'rift', getPollutionResistanceBonus: () => this.toolSystem.getPollutionResistanceBonus(), onClose: () => {
      this.inventoryClosedAt = this.time.now;
      this.syncPlayerInput();
    }, getNearby: () => this.fieldInventory.getNearby(),
      getDropPosition: () => ({ ...this.player.getPosition() }),
      canTake: this.fieldInventory.canTake, canDrop: this.fieldInventory.canDrop,
      onTaken: notifyFieldAcquisition,
    });
  }

  private showSettlementRetry(message: string, retry: () => void): void {
    if (document.getElementById('inventory-settlement-retry')) return;
    const button = document.createElement('button');
    button.id = 'inventory-settlement-retry'; button.className = 'action-btn';
    button.textContent = `${message} 点击重试保存`;
    button.style.cssText = 'position:absolute;left:272px;top:560px;z-index:3000';
    button.onclick = () => { button.remove(); retry(); };
    getDomUiRoot().append(button);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => button.remove());
  }

  private openPauseMenu(): void {
    if (inventoryPanel.isOpen() || this.time.now - this.inventoryClosedAt < 150 || riftResultPanel.isOpen()) return;
    if (this.devFixture?.onPause) this.devFixture.onPause();
    else pauseMenu.open(this);
  }

  /**
   * Scheme D production visuals (I3-E). Import is `src/entities/form-renderers/` only.
   * Texture reuse: occupancy × substrate × coverage × seed × facing (jia bakes per facing
   * at attach / facing change; bing/ding canvases are unique per seed and deform in place).
   */
  private attachSchemeD(): void {
    this.destroySchemeDVisuals();
    const renderer = getFormRenderer('d-mixed');
    if (renderer?.ready !== true) return;
    this.hosts.setSkipPaint(true);
    const fragmentTypeId = this.layoutDebug.fragmentTypeId;
    const seedRoot = this.layoutDebug.seed;
    for (const view of this.ai.getEnemies()) {
      if (!(view instanceof Enemy)) continue;
      view.setVisualSuppressed(true);
      if (productionModelFor(view.getForm().substrate)) {
        view.setLocomotionMode('continuous');
      }
      const visual = renderer.attach({
        scene: this,
        form: view.getForm(),
        seed: mix32(seedRoot, view.getId()),
        depth: DEPTH.enemy,
        fragmentTypeId,
      });
      this.formVisuals.set(view.getId(), visual);
    }
    for (const subject of this.hosts.getSubjects()) {
      const pin = this.hosts.getVisualPin(subject.id) ?? undefined;
      const visual = renderer.attach({
        scene: this,
        form: subject.form,
        subjectId: subject.id,
        isWalkableFloor: (col, row) => this.formFloorGrid?.isWalkable(col, row) ?? false,
        seed: mix32(seedRoot, subject.id),
        depth: this.depthForHostPin(pin?.kind),
        fragmentTypeId,
        pin,
      });
      this.formVisuals.set(subject.id, visual);
      this.hosts.setStepFloors(subject.id, visual.stepFloors ?? []);
    }
    this.rebuildGroundDepth();
  }

  private rebuildGroundDepth(): void {
    const targets: GroundDepthTarget[] = [{ id: 'player', groundY: () => this.player.getGroundY(),
      applyDepth: depth => this.player.setGroundDepth(depth, GROUND_LIGHT_DEPTH) }];
    for (const view of this.ai.getEnemies()) {
      const visual = this.formVisuals.get(view.getId());
      if (!(view instanceof Enemy) || !visual?.setGroundDepth) continue;
      view.setReadoutDepth(WORLD_READOUT_DEPTH);
      targets.push({ id: `enemy:${view.getId()}`, groundY: () => view.getPosition().y,
        applyDepth: depth => visual.setGroundDepth!(depth) });
    }
    this.groundDepthSorter = new GroundDepthSorter(targets);
    this.groundDepthSorter.update();
  }

  private syncSchemeDPoses(deltaMs: number): void {
    if (this.formVisuals.size === 0) return;
    for (const [id, visual] of this.formVisuals) {
      const view = this.ai.getEnemyById(id);
      if (view) {
        const pos = view.getPosition();
        const vel = view instanceof Enemy ? view.getActualVelocity() : { x: 0, y: 0 };
        const attack = this.combat.getEnemyAttackVisualState(id);
        visual.update({
          x: pos.x,
          y: pos.y,
          facing4: view.getFacing4(),
          moving: isActorWalking(Math.hypot(vel.x, vel.y)),
          movementSpeed: Math.hypot(vel.x, vel.y),
          restraint: this.toolSystem.getEnemyRestraintPose(id),
          visibility: this.visibility.getVisibilityAt(pos),
          signal: this.jiaSchemeSignal(view, attack),
          attack,
          activity: view instanceof Enemy ? view.getActivityVisualState() : undefined,
          deltaMs: this.ai.getEnemyControlState(id)?.attackSuppressed && this.ai.getEnemyControlState(id)?.movementMultiplier === 0 ? 0 : deltaMs,
        });
        continue;
      }
      const host = this.hosts.getSubjects().find((row) => row.id === id);
      if (!host) continue;
      const pin = this.hosts.getVisualPin(id);
      visual.update({
        x: pin?.attach ? pin.attach.seamX : pin?.kind === 'cluster' ? pin.x : host.position.x,
        y: pin?.attach ? pin.attach.seamY : pin?.kind === 'cluster' ? pin.y : host.position.y,
        facing4: this.hosts.getVisualFacing(id),
        moving: this.hosts.getVisualMoving(id),
        visibility: this.hostSchemeVisibility(id, host.position),
        signal: this.hosts.getVisualSignal(id),
        toolControl: this.hosts.getToolVisualControl(id),
        attack: this.hosts.getAttackVisualState(id),
        activity: this.hosts.getActivityVisualState(id),
        deltaMs,
      });
    }
  }

  private jiaSchemeSignal(view: { getState(): AIState }, attack: FormAttackPose): FormVisualSignal {
    if (attack.phase === 'windup') return 'inflated';
    if (attack.phase === 'strike') return 'strike';
    if (attack.phase === 'recover') return 'awake';
    const state = view.getState();
    if (state === AIState.CHASE) return 'awake';
    if (state === AIState.ALERT || state === AIState.SUSPICIOUS) return 'inflated';
    return 'idle';
  }

  private depthForHostPin(kind: 'wall' | 'cluster' | 'volume' | undefined): number {
    if (kind === 'wall') return DEPTH.yi;
    if (kind === 'cluster') return DEPTH.bing;
    return DEPTH.ding;
  }

  private hostSchemeVisibility(hostId: string, fallback: Readonly<Vector2>): number {
    const pin = this.hosts.getVisualPin(hostId);
    const q = this.formVisQuery;
    if (pin?.attach) {
      q.x = pin.attach.seamX + pin.attach.nx;
      q.y = pin.attach.seamY + pin.attach.ny;
    } else {
      q.x = fallback.x;
      q.y = fallback.y;
    }
    return this.visibility.getVisibilityAt(q);
  }

  private destroySchemeDVisual(id: string): void {
    const visual = this.formVisuals.get(id);
    if (!visual) return;
    visual.destroy();
    this.formVisuals.delete(id);
    this.rebuildGroundDepth();
  }

  private destroySchemeDVisuals(): void {
    for (const visual of this.formVisuals.values()) visual.destroy();
    this.formVisuals.clear();
    this.groundDepthSorter = null;
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.input.keyboard?.off('keydown-ESC', this.openPauseMenu, this);
    this.input.keyboard?.off('keydown-TAB', this.openBag, this);
    inventoryPanel.close();
    this.fieldInventory.destroy();
    this.unsubscribeInventory?.(); this.unsubscribeInventory = null;
    this.input.keyboard?.off('keydown-F1');
    eventBus.off(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
    eventBus.off(GameEvent.PLAYER_DIED, this.onRunEnded);
    eventBus.off(GameEvent.PLAYER_DAMAGED, this.onPlayerDamaged);
    eventBus.off(GameEvent.RIFT_EXIT_REACHED, this.onRunEnded);
    eventBus.off(GameEvent.RIFT_EXITED, this.onRunEnded);
    eventBus.off(GameEvent.RIFT_EXITED, this.onRiftExitedShowResult);
    eventBus.off(GameEvent.CHAOS_THRESHOLD_REACHED, this.onChaosThreshold);
    eventBus.off(GameEvent.CHAOS_CHANGED, this.onChaosChangedAudio);
    eventBus.off(GameEvent.ITEM_COLLECTED, this.onPickupAudio);
    eventBus.off(GameEvent.ITEM_USED, this.onUseAudio);
    eventBus.off(GameEvent.TOOL_USED, this.onUseAudio);
    eventBus.off(GameEvent.RIFT_EXIT_REACHED, this.onExitAudio);
    eventBus.off(GameEvent.CONTAMINANT_ACQUIRED, this.onContaminantAcquired);
    eventBus.off(GameEvent.TOOL_USED, this.onToolUsedForResult);
    this.ai.setCueListener(null);
    audioManager.haltNonBgm();
    riftResultPanel.destroy();
    pauseMenu.discard();
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
    for (const key of this.toolKeys) {
      this.input.keyboard?.removeKey(key, true);
    }
    this.toolKeys = [];
    // Before the player is destroyed: this is what releases the swing speed modifier.
    this.destroySchemeDVisuals();
    this.combat.destroy();
    this.hosts.destroy();
    this.formFloorGrid = null;
    this.detectionPulse.destroy();
    this.encounter.destroy();
    this.hud.destroy();
    this.runController.destroy();
    this.extraction.destroy();
    this.toolSystem.destroy();
    this.search.destroy();
    this.chaos.destroy();
    this.ai.destroy();
    this.trail.destroy();
    this.minimap.destroy();
    this.riftSurface.destroy();
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
    // S11 (ux-information-architecture.md): default OFF, F1 toggles. Anchored
    // top-center rather than top-left so it never sits on top of the real HUD's
    // four corner readouts (HP top-left, kindling top-right, tool slots
    // bottom-left, minimap bottom-right) - it now occupies the strip those four
    // deliberately leave empty.
    panel.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:10',
      'padding:4px 6px',
      'font:11px/1.45 monospace',
      'color:#8ad8cc',
      'background:rgba(0,0,0,0.55)',
      'white-space:pre',
      'pointer-events:none',
      'display:none',
    ].join(';');
    (document.getElementById('game-container') ?? document.body).appendChild(panel);
    this.debugPanel = panel;

    this.input.keyboard?.on('keydown-F1', () => {
      this.debugVisible = !this.debugVisible;
      if (this.debugPanel) this.debugPanel.style.display = this.debugVisible ? 'block' : 'none';
    });
  }

  private updateDebugOverlay(delta: number): void {
    if (!this.debugVisible) return;
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
      `layout seed ${this.layoutDebug.seed}  ${this.layoutDebug.fragmentTypeId}  ${this.layoutDebug.recipeId}`,
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
      `loot ${this.search.getCarriedKindling()} carried  ${this.search.getRemainingCount()} remaining`,
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

  /** Development review only: exposes production state without a second simulation. */
  probeEnemyReview() {
    if (!import.meta.env.DEV) return null;
    return {
      seed: this.layoutDebug.seed, hp: this.combat.getHealth(), chaos: this.chaos.getValue(),
      fps: Math.round(this.game.loop.actualFps),
      player: { ...this.player.getPosition() },
      enemies: this.ai.getEnemies().map((view) => ({
        id: view.getId(), substrate: view.getForm().substrate, coverage: view.getForm().coverage,
        motion: view.getForm().lexemes.motion, state: view.getState(),
        occupancy: view.getForm().occupancy, sense: view.getForm().lexemes.sense,
        rhythm: view.getForm().lexemes.rhythm, activity: view instanceof Enemy ? view.getActivityVisualState() : undefined,
        velocity: view instanceof Enemy ? { ...view.getActualVelocity() } : undefined,
        position: { ...view.getPosition() }, facing: view.getFacing4(),
        attack: this.combat.getEnemyAttackVisualState(view.getId()),
        hp: this.combat.getEnemyHealth(view.getId()),
        texture: this.formVisuals.get(view.getId())?.getFlashSource?.().textureKey,
      })),
      hosts: this.hosts.getSubjects().map((host) => ({
        id: host.id, substrate: host.form.substrate, coverage: host.form.coverage,
        occupancy: host.form.occupancy, motion: host.form.lexemes.motion,
        sense: host.form.lexemes.sense, rhythm: host.form.lexemes.rhythm,
        position: { ...host.position }, pin: this.hosts.getVisualPin(host.id),
        attack: this.hosts.getAttackVisualState(host.id), activity: this.hosts.getActivityVisualState(host.id),
        signal: this.hosts.getVisualSignal(host.id),
        volume: (() => {
          const f = this.hosts.getVolumePresenceFrame(host.id);
          return f ? { phase: f.phase, progress: f.progress, elapsedMs: f.elapsedMs,
            active: f.active, hazardActive: f.hazardActive, rect: { ...f.rect } } : undefined;
        })(),
      })),
      textures: this.textures.getTextureKeys().filter((key) => /insect16|human17|beast18|worm18|relic18|growth18|remnant18/.test(key) || key.startsWith('combat-flash-')),
    };
  }

  /** Read-only recorder sample. No teleport, invulnerability or timing overrides. */
  probeBuildLabState() {
    if (!import.meta.env.DEV || !this.devFixture) return null;
    return {
      elapsedMs: this.devElapsedMs, ended: this.runController.isRunEnded(),
      player: { ...this.player.getPosition() }, hp: this.combat.getHealth(), chaos: this.chaos.getValue(),
      attack: { ...this.combat.getAttackState() }, kindling: this.search.getCarriedKindling(),
      search: { prompt: this.search.getPrompt(), progress: this.search.getChannelProgress01(), remaining: this.search.getRemainingCount() },
      enemies: this.ai.getEnemies().map(enemy => ({ id: enemy.getId(), state: enemy.getState(),
        position: { ...enemy.getPosition() }, hp: this.combat.getEnemyHealth(enemy.getId()),
        detection: enemy.getDetection(), engaged: enemy.isEngaged(), visible: this.visibilityAt(enemy.getPosition()) > 0 })),
      hosts: this.hosts.getToolTargets().map(host => ({ id: host.id, substrate: host.form.substrate,
        position: { ...host.position }, hazardReleased: host.hazardReleased,
        suppressionRemainingMs: host.suppressionRemainingMs, delayRemainingMs: host.delayRemainingMs,
        recoveryWarning: host.recoveryWarning,
        volume: (() => { const frame = this.hosts.getVolumePresenceFrame(host.id); return frame ? {
          phase: frame.phase, elapsedMs: frame.elapsedMs, hazardActive: frame.hazardActive,
        } : undefined; })() })),
    };
  }

  probeInspectEnemy(id: string, distance: number): boolean {
    if (!import.meta.env.DEV) return false;
    const enemy = this.ai.getEnemyById(id);
    const layer = this.tilemapRenderer.getLayer();
    const host = this.hosts.getSubjects().find((subject) => subject.id === id);
    if ((!enemy && !host) || !layer) return false;
    const p = enemy?.getPosition() ?? host!.position;
    for (const angle of [this.player.getFacingAngle() + Math.PI, Math.PI, 0, Math.PI / 2, -Math.PI / 2]) {
      const x = p.x + Math.cos(angle) * distance;
      const y = p.y + Math.sin(angle) * distance;
      const clear = [-10, 10].every((dx) => [-10, 10].every((dy) => {
        const tile = layer.getTileAtWorldXY(x + dx, y + dy);
        return tile && !tile.collides;
      }));
      if (!clear) continue;
      this.probePlacePlayer(x, y);
      return true;
    }
    return false;
  }

  probeReviewCoverage(id: string, coverage: CoverageId | null): void {
    if (import.meta.env.DEV) this.formVisuals.get(id)?.setReviewCoverage?.(coverage);
  }

  probeReviewProtection(enabled: boolean): void {
    if (import.meta.env.DEV) this.combat.setGodMode(enabled);
  }

  probeReviewHit(id: string, lethal: boolean): void {
    if (import.meta.env.DEV) this.combat.applyToolDamage(id, lethal ? 999 : 1);
  }

  probePlacePlayer(x: number, y: number): void {
    const sprite = this.player.getSprite();
    sprite.setPosition(x, y);
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.reset(x, y);
    this.player.postUpdate();
  }

  probeSetSearchHeld(held: boolean): void {
    this.probeSearchHeld = held;
  }

  probeGetSearchState(): {
    prompt: string | null;
    progress: number | null;
    remaining: number;
    kindling: number;
    fragmentTypeId: string;
    seed: number;
    player: { x: number; y: number };
    nodes: ReadonlyArray<{
      id: string;
      kind: 'kindling' | 'contaminant';
      x: number;
      y: number;
      collected: boolean;
    }>;
  } {
    const pos = this.player.getPosition();
    return {
      prompt: this.search.getPrompt(),
      progress: this.search.getChannelProgress01(),
      remaining: this.search.getRemainingCount(),
      kindling: this.search.getCarriedKindling(),
      fragmentTypeId: this.layoutDebug.fragmentTypeId,
      seed: this.layoutDebug.seed,
      player: { x: pos.x, y: pos.y },
      nodes: this.search.getNodesProbe(),
    };
  }
}

function readRiftSeed(): number {
  const query = new URLSearchParams(window.location.search).get('riftSeed');
  if (query && Number.isFinite(Number(query))) return Number(query) >>> 0;
  const hash = window.location.hash;
  const tagged = /^#rift=(\d+)$/.exec(hash);
  if (tagged) return Number(tagged[1]) >>> 0;
  return Date.now() >>> 0;
}

/** Dev-only recipe lock for review screenshots. Omit = live pickRecipe. */
function readRiftRecipeId(): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  const query = new URLSearchParams(window.location.search).get('riftRecipe');
  return query && query.length > 0 ? query : undefined;
}
