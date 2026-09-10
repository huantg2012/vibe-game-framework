import { getContaminantMaxUses, supportsContaminantQuality } from '@/systems/contaminant-quality';
import { hasLineOfSight } from '@/utils/grid-raycast';
import { collectToolRevealSnapshot, findStitchPlacement, findSingleWallLanding, findSoundLureLanding } from '@/systems/tool-targeting';
import { createWeaponInstance } from '@/systems/weapon-loot';
/** Isolated hands-on arena. Every attack, tool, body and host uses production systems. */
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { isActorWalking } from '@/entities/actor-motion';
import { Enemy } from '@/entities/enemy-factory';
import { Player } from '@/entities/player';
import { schemeDMixed } from '@/entities/form-renderers/scheme-d-mixed';
import type { FormVisual, FormVisualSignal } from '@/entities/form-renderers/form-renderer';
import { productionModelFor } from '@/entities/form-renderers/d/production-models';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { lexiconPracticePins, LEXICON_JIA_WAYPOINTS } from '@/gym/gym-lexicon-arena';
import { jiaRoleFor } from '@/gym/gym-lexicon-form';
import { createCombatLabGround } from '@/gym/combat-lab-runtime-ground';
import type { CombatLabConfig, CombatLabState } from '@/gym/combat-lab-types';
import { audioManager } from '@/managers/audio-manager';
import { AISystem, ENEMY_DEPTH } from '@/systems/ai';
import { ChaosSystem, getChaosModulators } from '@/systems/chaos-system';
import { CombatSystem, type CombatCueId } from '@/systems/combat-system';
import { ContaminationHostSystem } from '@/systems/contamination-host-system';
import { contaminantSystem } from '@/systems/contaminant-system';
import { GroundDepthSorter, GROUND_LIGHT_DEPTH, WORLD_READOUT_DEPTH } from '@/systems/ground-depth';
import { inventoryStore } from '@/systems/inventory-store';
import { RiftSurfacePainter } from '@/systems/procedural-surface';
import { getBurdenSpeedFactor, getSurvivalAttributes, sumPollutionResistance } from '@/systems/survival-attributes';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { ToolSystem } from '@/systems/tool-system';
import { GameEvent } from '@/types/events';
import { AIState, TileType, type Vector2 } from '@/types/game-types';
import type { InventoryItem, InventoryState } from '@/types/inventory-types';

interface Subject { id: string; visual: FormVisual | null; alive: boolean }
const visible = (): number => 1;

export class CombatLabScene extends Phaser.Scene {
  private config!: CombatLabConfig;
  private readonly tiles = new TilemapRenderer();
  private readonly surface = new RiftSurfacePainter();
  private readonly player = new Player();
  private readonly ai = new AISystem();
  private readonly combat = new CombatSystem();
  private readonly hosts = new ContaminationHostSystem();
  private readonly tools = new ToolSystem();
  private grid: TileGrid | null = null;
  private chaos: ChaosSystem | null = null;
  private readonly subjects: Subject[] = [];
  private depthSorter: GroundDepthSorter | null = null;
  private keys: Phaser.Input.Keyboard.Key[] = [];
  private lastDelta = 16;
  private created = false;
  private roundEnded = false;
  private toolInputAllowed = true;
  private hitsDealt = 0;
  private hitsTaken = 0;
  private message = '';
  private bonusKindling = 0;
  private stepMs = 0;
  private turnKey: { key: string; code: string; keyCode: number } | null = null;
  private turnTarget = 0;
  private turnRemainingMs = 0;
  private unsubscribeInventory: (() => void) | null = null;
  private resetTimer: Phaser.Time.TimerEvent | null = null;

  constructor() { super({ key: 'CombatLabScene' }); }

  init(config: CombatLabConfig): void {
    this.config = config;
    this.roundEnded = false;
    this.toolInputAllowed = true;
    this.hitsDealt = 0; this.hitsTaken = 0; this.bonusKindling = 0; this.stepMs = 0;
    this.message = '';
  }

  create(): void {
    this.createTrainingInventory();
    this.created = true;
    const ruins = createCombatLabGround(this.config.fragmentTypeId, this.config.seed);
    const map = ruins.tileMap;
    const grid = this.grid = new TileGrid(map);
    const layer = this.tiles.create(this, map, {
      tilesetKey: 'placeholder-rift-tileset', collidingIndices: [TileType.WALL, TileType.VOID], depth: 0,
    });
    layer.setVisible(false);
    this.surface.mount(this, ruins, 'combat-lab-ground', 0);
    this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);
    this.physics.world.resume();
    this.cameras.main.setBounds(0, 0, grid.widthPx, grid.heightPx)
      .setZoom(this.config.zoom).setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);
    this.player.create(this, { spawn: { x: 370, y: 240 }, depth: 30, facing: 'right' });
    this.physics.add.collider(this.player.getSprite(), layer);
    this.ai.create(this, [], grid, grid, { requireExactlyOneRewriter: false });
    this.ai.setVisibilityProvider(visible);
    this.ai.addWallCollider(layer);
    this.ai.addStaticPlayerCollider(this.player.getSprite());
    this.combat.create(this, grid, this.player, this.ai, {
      captureEnemyVisual: id => this.subjects.find(s => s.id === id)?.visual?.getFlashSource?.(),
      onNoise: (position, radius, level) => {
        this.ai.reportNoise(position, radius, level); this.hosts.reportNoise(position, radius);
      },
      onCue: this.onCombatCue,
      consumeWeaponUse: () => {
        const id = inventoryStore.getEquipment().weaponId;
        return id ? inventoryStore.consumeEquipmentUse(id).ok : false;
      },
    });
    this.combat.configureWeapon(this.config.weaponId, this.config.seed);
    this.combat.setGodMode(this.config.protected);
    this.chaos = new ChaosSystem({
      isEnemyTargetingLure: id => this.ai.getEnemyById(id)?.isTargetingLure?.() ?? false, startingValue: this.config.startingChaos,
      getPollutionResistance: () => sumPollutionResistance([getSurvivalAttributes().resistancePercent, this.tools.getPollutionResistanceBonus()]),
      onModulate: mods => this.player.setSpeedModifier('chaos', mods.speedMult),
    });
    this.player.setSpeedModifier('chaos', getChaosModulators(this.chaos.getValue()).speedMult);
    this.hosts.bindPractice(this, lexiconPracticePins(), this.combat, this.chaos, visible, {
      liveMotion: true, occluders: grid,
      hearingPolicy: { getRangeMultiplier: () => this.ai.getHearingRangeMultiplier(),
        suppressDiscovery: id => this.ai.trySuppressHearingDiscovery(id) },
    });
    this.createTools();
    if (!this.config.empty) this.spawnSubjects();
    this.syncBurden();
    this.unsubscribeInventory = inventoryStore.subscribe(() => this.syncBurden());
    const keyboard = this.input.keyboard;
    if (keyboard) this.keys = ['SPACE', 'Q', 'F', 'R'].map(key => keyboard.addKey(key, true, false));
    eventBus.on(GameEvent.ENEMY_DAMAGED, this.onDamaged);
    eventBus.on(GameEvent.ENEMY_KILLED, this.onKilled);
    eventBus.on(GameEvent.PLAYER_DAMAGED, this.onPlayerDamaged);
    eventBus.on(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.on(GameEvent.TOOL_USED, this.onToolUsed);
    document.addEventListener('focusin', this.onFocusChange);
    this.game.canvas.addEventListener('pointerdown', this.focusArena);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.cameras.main.startFollow(this.player.getSprite(), true, 0.15, 0.15);
    this.onFocusChange();
    this.onPostUpdate();
  }

  private createTrainingInventory(): void {
    // This standalone entry has no save manager. Repeat defensively before any domain writes.
    inventoryStore.setPersistence(null);
    inventoryStore.configure({ weaponDefinition: id => WEAPON_DATA[id], toolSlotCount: () => 3,
      defenseSlotCount: () => 3, isPassiveTool: c => CONTAMINANT_DATA[c.type].toolType === 'passive' });
    const items: InventoryItem[] = [{ id: 'lab-weapon', kind: 'weapon',
      weapon: createWeaponInstance(this.config.weaponId, true, 'lab-weapon'), location: { kind: 'carried' } }];
    const toolIds = this.config.tools.map((type, index) => {
      if (!type) return null;
      const id = `lab-tool-${index}`;
      const def = CONTAMINANT_DATA[type];
      items.push({ id, kind: 'contaminant', location: { kind: 'carried' }, contaminant: {
        id, type, rarity: def.rarity, ...(supportsContaminantQuality(type) ? { quality: this.config.toolQuality ?? 'ordinary' } : {}), stage: 'tool', impactCharges: 0, usesRemaining: getContaminantMaxUses({ type, rarity: def.rarity, quality: this.config.toolQuality ?? 'ordinary' }),
      } });
      return id;
    });
    const state: InventoryState = { version: 2, items,
      equipment: { weaponId: 'lab-weapon', toolIds, defenseIds: [null, null, null] },
      run: { id: 'combat-lab', status: 'active', carriedOutIds: items.map(i => i.id), revealedNodes: {}, destroyedIds: [] },
      starterGranted: true, firstWeaponDiscovered: true };
    if (!inventoryStore.loadState(state)) throw new Error('Invalid combat lab equipment configuration');
  }

  private revealMarks: Phaser.GameObjects.Graphics | null = null;
  private revealUntil = 0;

  private createTools(): void {
    this.tools.create(this, contaminantSystem.getSortieLoadout(), () => this.player.getPosition(), () => this.ai.getEnemies(), {
      getPlayerSprite: () => this.player.getSprite(),
        isTargetAlive: id => this.combat.isEnemyAlive(id),
        isTargetVisible: () => true,
        hasTargetLineOfSight: (from, to) => hasLineOfSight(this.grid!, from, to),
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
            this.grid!, Math.max(body.halfWidth, body.halfHeight) * 2);
        },
        getStitchPlacement: (length, distance) => {
          const angle = this.player.getFacingAngle();
          return findStitchPlacement(this.player.getPosition(), { x: Math.cos(angle), y: Math.sin(angle) }, distance, length,
            this.grid!, (from, to) => hasLineOfSight(this.grid!, from, to));
        },
        getRevealSnapshot: range => collectToolRevealSnapshot(this.player.getPosition(), range, this.grid!,
          [...this.ai.getEnemies().filter(enemy => this.combat.isEnemyAlive(enemy.getId())).map(enemy => enemy.getPosition()),
            ...this.hosts.getToolTargets().map(host => host.position)], []),
        delayEnvironmentHazard: (id, source, duration) => this.hosts.delayNextHazard(id, source, duration),
        getEnvironmentTargets: () => this.hosts.getToolTargets(),
        suppressEnvironmentHazard: (id, source, duration) => this.hosts.suppressReleasedHazard(id, source, duration),
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
            grid: this.grid!, isPhaseableWall: (col, row) => this.grid!.getTile(col, row) === TileType.WALL,
          });
          return landing ? { x: sprite.x + landing.x - body.center.x, y: sprite.y + landing.y - body.center.y } : null;
        },
        movePlayerTo: position => {
          const body = this.player.getSprite().body as Phaser.Physics.Arcade.Body;
          body.reset(position.x, position.y);
          this.player.postUpdate();
        },
      setPlayerCollision: enabled => {
        const body = this.player.getSprite().body as Phaser.Physics.Arcade.Body | null;
        if (body) body.enable = enabled;
      },
      setPlayerInput: enabled => { this.toolInputAllowed = enabled; this.syncInput(); },
      getCollectedNodes: () => [],
      addKindling: n => { this.bonusKindling += n; this.message = `工具获得薪柴 ${this.bonusKindling}（仅本轮计数）`; },
      setEnemySpeedMultiplier: (id, mult) => this.ai.setEnemySpeedMultiplier(id, mult),
      setEnemyMovementLocked: (id, value) => this.ai.setEnemyMovementLocked(id, value),
      setEnemyPerceptionMultiplier: (id, mult) => this.ai.setEnemyPerceptionMultiplier(id, mult),
      reverseEnemyPatrol: id => this.ai.reverseEnemyPatrol(id),
      forceEnemyReturn: id => this.ai.forceEnemyReturn(id),
      knockbackEnemy: (id, dx, dy) => this.ai.knockbackEnemy(id, dx, dy),
      setDecoyPosition: pos => this.ai.setDecoyPosition(pos),
      damageEnemy: (id, amount) => this.combat.applyToolDamage(id, amount),
      showAbyssReveal: (enemies, _nodes, duration) => {
        this.revealMarks?.destroy(); this.revealMarks = null;
        this.revealUntil = this.time.now + duration;
        if (duration <= 0) return;
        this.revealMarks = this.add.graphics().setDepth(60);
        for (const position of enemies) {
          this.revealMarks.lineStyle(1, 0x7c998e, .8);
          this.revealMarks.strokeRect(Math.round(position.x) - 3, Math.round(position.y) - 3, 6, 6);
        }
        this.message = `背光珠留下附近 ${enemies.length} 处旧位置；标记不会跟随目标。`;
      },
      getKindlingPositions: () => [],
      boostChaosRate: (mult, ms) => this.chaos?.setTemporaryRateMult(mult, ms),
      reduceChaosRate: (mult, ms) => this.chaos?.setTemporaryRateReduction(mult, ms),
      setEnemyEscalationSuppressed: (id, value) => this.ai.setEnemyEscalationSuppressed(id, value),
      forceEnemyAlert: id => this.ai.forceEnemyAlert(id),
      demoteEnemyAlertLevel: id => this.ai.demoteEnemyAlertLevel(id),
      setEnemyDetectionFillRateMult: (id, mult) => this.ai.setEnemyDetectionFillRateMult(id, mult),
      setHearingSuppressed: value => this.ai.setHearingSuppressed(value),
    });
    this.ai.setHearingAvoidedListener(() => this.tools.notifyProximityAvoid());
  }

  update(_time: number, delta: number): void {
    if (this.revealMarks && this.time.now >= this.revealUntil) {
      this.revealMarks.destroy(); this.revealMarks = null;
    }
    if (!this.created) return;
    this.lastDelta = delta;
    if (this.input.keyboard?.enabled && this.keys[3] && Phaser.Input.Keyboard.JustDown(this.keys[3])) {
      this.restartRound(); return;
    }
    if (this.roundEnded) {
      // Attacks are disabled, but the final contact flash still needs its fade clock.
      this.combat.update(delta);
      return;
    }
    this.player.update(delta);
    if (this.turnKey) {
      this.turnRemainingMs -= delta;
      const difference = this.turnTarget - this.player.getFacingAngle();
      if (Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) < 0.01 || this.turnRemainingMs <= 0) this.endTurn();
    }
    this.ai.update(delta, this.player.getPosition(), this.player.isMoving());
    if (this.input.keyboard?.enabled && this.toolInputAllowed) {
      if (this.keys[0] && Phaser.Input.Keyboard.JustDown(this.keys[0])) this.combat.requestPlayerAttack();
      for (let i = 0; i < 2; i++) if (this.keys[i + 1] && Phaser.Input.Keyboard.JustDown(this.keys[i + 1]!)) {
        const type = this.config.tools[i];
        if (type === 'ruminate') this.message = '反刍需要已搜取节点；此战斗场不放置搜寻经济节点，未消耗次数。';
        const used = this.tools.useSlot(i);
        if (!used && type && type !== 'ruminate') this.message = '未施放：检查剩余次数、目标距离，线型工具需在两处各按一次。';
      }
    }
    this.tools.update(delta);
    this.combat.update(delta);
    if (this.roundEnded) return;
    this.hosts.update(delta, this.player.getPosition(), this.player.isMoving(), this.player.getFacingAngle());
    if (this.roundEnded) return;
    this.chaos?.update(delta);
    this.surface.update(delta);
    if (this.player.isMoving()) {
      this.stepMs += delta;
      if (this.stepMs > 450) { this.stepMs = 0; audioManager.playSFX('sfx-shared-player-step-metal', { priority: 'low' }); }
    } else this.stepMs = 0;
  }

  restartRound(): void { if (this.created) this.scene.restart(this.config); }

  readonly focusArena = (): void => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.onFocusChange();
  };

  approachMelee(): void {
    if (!this.created || this.roundEnded || !this.toolInputAllowed) return;
    const first = this.subjects.find(s => s.alive);
    const position = first ? this.subjectPosition(first.id) : null;
    if (!position || !this.grid) return;
    this.endTurn();
    const angle = this.player.getFacingAngle();
    const directions = [[-1, 0], [0, -1], [1, 0], [0, 1]] as const;
    const ordered = [...directions].sort((a, b) =>
      (a[0] * Math.cos(angle) + a[1] * Math.sin(angle)) - (b[0] * Math.cos(angle) + b[1] * Math.sin(angle)));
    for (const distance of [24, 32, 36, 48, 64]) for (const [dx, dy] of ordered) {
      const targetAngle = Math.atan2(-dy, -dx);
      const difference = targetAngle - angle;
      const requiresTurn = Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) > .05;
      if (requiresTurn && distance < 36) continue;
      const x = position.x + dx * distance, y = position.y + dy * distance;
      if (![-10, 10].every(ox => [-10, 10].every(oy => this.grid!.isWalkableAt(x + ox, y + oy)))) continue;
      (this.player.getSprite().body as Phaser.Physics.Arcade.Body).reset(x, y);
      this.player.postUpdate();
      this.focusArena();
      if (!requiresTurn) return;
      this.turnKey = dx < 0 ? { key: 'd', code: 'KeyD', keyCode: 68 } : dx > 0 ? { key: 'a', code: 'KeyA', keyCode: 65 }
        : dy < 0 ? { key: 's', code: 'KeyS', keyCode: 83 } : { key: 'w', code: 'KeyW', keyCode: 87 };
      this.turnTarget = targetAngle; this.turnRemainingMs = 250;
      window.dispatchEvent(new KeyboardEvent('keydown', { ...this.turnKey, bubbles: true }));
      return;
    }
  }

  getReviewState(): CombatLabState {
    const attr = getSurvivalAttributes();
    const swing = this.combat.getSwingSnapshot();
    const weaponId = inventoryStore.getEquipment().weaponId;
    const weapon = weaponId ? inventoryStore.getItem(weaponId) : undefined;
    return { ready: this.created, health: this.created ? this.combat.getHealth() : 0,
      maxHealth: this.created ? this.combat.getMaxHealth() : 0, chaos: this.chaos?.getValue() ?? 0,
      weight: attr.weight + (this.config?.extraWeight ?? 0), resistancePercent: sumPollutionResistance([attr.resistancePercent, this.tools.getPollutionResistanceBonus()]),
      speedFactor: getBurdenSpeedFactor(attr.weight + (this.config?.extraWeight ?? 0), attr.capacity),
      playerPhase: this.roundEnded ? 'ended' : this.combat.getAttackState().phase,
      weaponDurability: weapon?.kind === 'weapon' ? weapon.weapon.usesRemaining : 0,
      weaponMaxDurability: this.config ? WEAPON_DATA[this.config.weaponId]?.maxUses ?? 0 : 0,
      lastSwingDamage: swing.damage, swingCount: swing.sequence, hitsDealt: this.hitsDealt, hitsTaken: this.hitsTaken,
      subjects: this.subjects.map(subject => ({ id: subject.id, alive: subject.alive,
        health: this.config.form.portfolio === 'jia' ? this.combat.getEnemyHealth(subject.id) ?? 0 : null,
        nuclei: this.config.form.portfolio === 'jia' ? Number(subject.alive) : this.hosts.getLiveNucleusCount(subject.id),
        phase: !subject.alive ? 'dead' : this.config.form.portfolio === 'jia'
          ? this.combat.getEnemyAttackVisualState(subject.id).phase : this.hosts.getAttackVisualState(subject.id)?.phase ?? this.hosts.getVisualSignal(subject.id),
      })),
      tools: this.config ? this.config.tools.flatMap((type, i) => type ? [{ id: type,
        remaining: inventoryStore.getContaminants().find(c => c.id === `lab-tool-${i}`)?.usesRemaining ?? 0 }] : []) : [],
      message: this.message, roundEnded: this.roundEnded, textureCount: this.textures.getTextureKeys().length,
    };
  }

  private spawnSubjects(): void {
    const form = this.config.form;
    const count = form.portfolio === 'jia' ? this.config.count : 1;
    for (let i = 0; i < count; i++) {
      let id = `combat-lab-subject-${i}`;
      if (form.portfolio === 'jia') {
        this.ai.spawnOne({ id, type: jiaRoleFor(form), spawn: { col: 14 + i, row: 7 + i }, facing: Math.PI,
          patrol: { waypoints: LEXICON_JIA_WAYPOINTS, mode: 'loop' }, form });
        const enemy = this.ai.getEnemyById(id);
        if (enemy instanceof Enemy) {
          enemy.setVisualSuppressed(true); enemy.setReadoutDepth(WORLD_READOUT_DEPTH);
          enemy.setLocomotionMode(productionModelFor(form.substrate) ? 'continuous' : 'legacy-hitch');
        }
      } else {
        const hostId = this.hosts.spawnForm(form);
        if (!hostId) throw new Error('Combat lab could not place environmental enemy');
        id = hostId; this.hosts.setSkipPaint(true);
      }
      const visual = schemeDMixed.attach({ scene: this, form, seed: this.config.seed + i, subjectId: id,
        isWalkableFloor: (col, row) => this.grid?.isWalkable(col, row) ?? false,
        fragmentTypeId: this.config.fragmentTypeId, pin: this.hosts.getVisualPin(id) ?? undefined,
        depth: form.portfolio === 'bing' ? 1 : form.portfolio === 'ding' ? GAME_CONSTANTS.CONTAMINATION.VOLUME_DEPTH : ENEMY_DEPTH });
      this.subjects.push({ id, visual, alive: true });
      if (form.portfolio !== 'jia') this.hosts.setStepFloors(id, visual.stepFloors ?? []);
    }
    this.combat.noteRosterChanged();
    this.depthSorter = new GroundDepthSorter([
      { id: 'player', groundY: () => this.player.getGroundY(), applyDepth: depth => this.player.setGroundDepth(depth, GROUND_LIGHT_DEPTH) },
      ...this.subjects.filter(s => Boolean(s.visual?.setGroundDepth)).map(s => ({ id: s.id,
        groundY: () => this.subjectPosition(s.id)?.y ?? 0, applyDepth: (depth: number) => s.visual?.setGroundDepth?.(depth) })),
    ]);
  }

  private subjectPosition(id: string): Readonly<Vector2> | null {
    return this.ai.getEnemyById(id)?.getPosition() ?? this.hosts.getSubjects().find(s => s.id === id)?.position ?? null;
  }

  private onPostUpdate(): void {
    if (!this.created || this.roundEnded) return;
    this.player.postUpdate(); this.ai.postUpdate(this.lastDelta);
    for (const subject of this.subjects) {
      const visual = subject.visual, view = this.ai.getEnemyById(subject.id), position = this.subjectPosition(subject.id);
      if (!visual || !position || !subject.alive) continue;
      const enemy = view instanceof Enemy ? view : undefined;
      const velocity = enemy?.getActualVelocity();
      const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
      const pin = this.hosts.getVisualPin(subject.id);
      visual.update({ x: pin?.kind === 'cluster' ? pin.x : position.x, y: pin?.kind === 'cluster' ? pin.y : position.y,
        visibility: 1, deltaMs: this.lastDelta, facing4: view?.getFacing4() ?? this.hosts.getVisualFacing(subject.id),
        moving: view ? isActorWalking(speed) : this.hosts.getVisualMoving(subject.id), movementSpeed: speed,
        signal: enemy ? signalFor(enemy) : this.hosts.getVisualSignal(subject.id),
        attack: view ? this.combat.getEnemyAttackVisualState(subject.id) : this.hosts.getAttackVisualState(subject.id),
        activity: enemy?.getActivityVisualState() ?? this.hosts.getActivityVisualState(subject.id),
      });
    }
    this.depthSorter?.update();
  }

  private syncBurden(): void {
    const id = inventoryStore.getEquipment().weaponId;
    const item = id ? inventoryStore.getItem(id) : undefined;
    this.combat.configureWeapon(item?.kind === 'weapon' ? item.weapon.definitionId : null);
    const attr = getSurvivalAttributes();
    this.player.setBurdenSpeedFactor(getBurdenSpeedFactor(attr.weight + this.config.extraWeight, attr.capacity));
  }

  private syncInput(): void {
    this.player.setInputEnabled(Boolean(this.input.keyboard?.enabled) && !this.roundEnded && this.toolInputAllowed);
  }

  private readonly onFocusChange = (): void => {
    this.endTurn();
    const target = document.activeElement;
    const editing = target instanceof HTMLElement && (target.matches('input, select, textarea, button') || target.isContentEditable);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.resetKeys(); keyboard.enabled = !editing;
      if (editing) keyboard.disableGlobalCapture(); else keyboard.enableGlobalCapture();
    }
    this.combat.clearAttackBuffer(); this.syncInput();
  };

  private endTurn(): void {
    if (!this.turnKey) return;
    window.dispatchEvent(new KeyboardEvent('keyup', { ...this.turnKey, bubbles: true }));
    this.turnKey = null; this.turnRemainingMs = 0;
  }

  private readonly onDamaged = ({ enemyId, source }: { enemyId: string; source?: 'player' | 'tool' }): void => {
    if (!this.subjects.some(s => s.id === enemyId)) return;
    if (source === 'player') this.hitsDealt++;
    this.ai.reportDamage(enemyId, this.player.getPosition());
  };
  private readonly onKilled = ({ enemyId }: { enemyId: string }): void => {
    const subject = this.subjects.find(s => s.id === enemyId);
    if (!subject) return;
    subject.alive = false; subject.visual?.destroy(); subject.visual = null;
    if (this.ai.getEnemyById(enemyId)) this.ai.despawn(enemyId);
    this.combat.noteRosterChanged();
    if (this.subjects.every(s => !s.alive)) this.endRound('敌人已清除');
  };
  private readonly onPlayerDamaged = (): void => { this.hitsTaken++; };
  private readonly onPlayerDied = (): void => { this.endRound('角色倒下'); };
  private readonly onToolUsed = (): void => { audioManager.playSFX('sfx-shared-player-use-item'); };

  private endRound(reason: string): void {
    if (this.roundEnded) return;
    this.roundEnded = true; this.endTurn(); this.combat.clearAttackBuffer(); this.combat.setEnabled(false);
    this.syncInput(); this.physics.world.pause();
    this.message = `${reason}。${this.config.autoReset ? '2 秒后按当前配置重开。' : '按 R 重开。'}`;
    if (this.config.autoReset) this.resetTimer = this.time.delayedCall(2000, () => this.restartRound());
  }

  private readonly onCombatCue = (cue: CombatCueId, pos: Readonly<Vector2>): void => {
    const player = this.player.getPosition();
    if (cue === 'combat.cue.swing') audioManager.playSFX('sfx-shared-player-attack');
    else if (cue === 'combat.cue.hit') audioManager.playSpatialSFX('sfx-rift-enemy-hit', pos, player);
    else if (cue === 'combat.cue.enemyDeath') audioManager.playSpatialSFX('sfx-rift-enemy-die', pos, player);
    else if (cue === 'combat.cue.enemyWindup') audioManager.playSpatialSFX('sfx-rift-enemy-alert', pos, player);
    else if (cue === 'combat.cue.playerHurt') audioManager.playSFX('sfx-shared-player-hurt');
  };

  private onShutdown(): void {
    if (!this.created) return;
    this.endTurn(); this.created = false; this.resetTimer?.remove(); this.resetTimer = null;
    this.unsubscribeInventory?.(); this.unsubscribeInventory = null;
    document.removeEventListener('focusin', this.onFocusChange);
    this.game.canvas.removeEventListener('pointerdown', this.focusArena);
    this.input.keyboard?.disableGlobalCapture();
    eventBus.off(GameEvent.ENEMY_DAMAGED, this.onDamaged); eventBus.off(GameEvent.ENEMY_KILLED, this.onKilled);
    eventBus.off(GameEvent.PLAYER_DAMAGED, this.onPlayerDamaged); eventBus.off(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.off(GameEvent.TOOL_USED, this.onToolUsed);
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.depthSorter = null;
    for (const subject of this.subjects) subject.visual?.destroy();
    this.subjects.length = 0;
    this.tools.destroy(); this.hosts.destroy(); this.combat.destroy(); this.ai.destroy(); this.player.destroy();
    this.chaos?.destroy(); this.chaos = null; this.surface.destroy(); this.tiles.destroy(); this.grid = null;
    for (const key of this.keys) this.input.keyboard?.removeKey(key, true);
    this.keys = []; audioManager.haltNonBgm();
  }
}

function signalFor(enemy: Enemy): FormVisualSignal {
  if (enemy.isEngaged()) return 'strike';
  if (enemy.getState() === AIState.CHASE) return 'awake';
  if (enemy.getState() === AIState.ALERT || enemy.getState() === AIState.SUSPICIOUS) return 'inflated';
  return 'idle';
}
