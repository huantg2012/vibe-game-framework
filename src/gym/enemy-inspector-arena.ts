/** DEV-only single-subject arena. All motion, combat and environmental rules are production systems. */
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { isActorWalking } from '@/entities/actor-motion';
import { Enemy } from '@/entities/enemy-factory';
import { Player } from '@/entities/player';
import { schemeDMixed } from '@/entities/form-renderers/scheme-d-mixed';
import type { FormVisual, FormVisualSignal } from '@/entities/form-renderers/form-renderer';
import { productionModelFor } from '@/entities/form-renderers/d/production-models';
import { rgbToHex, yardSurfaceColors } from '@/entities/form-renderers/d/fragment-ramp';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { createLexiconObserveMap, lexiconPlayerSpawn, lexiconPracticePins, LEXICON_JIA_WAYPOINTS } from '@/gym/gym-lexicon-arena';
import { jiaRoleFor } from '@/gym/gym-lexicon-form';
import { AISystem, ENEMY_DEPTH } from '@/systems/ai';
import { ChaosSystem } from '@/systems/chaos-system';
import { CombatSystem } from '@/systems/combat-system';
import { ContaminationHostSystem } from '@/systems/contamination-host-system';
import type { VolumePhase } from '@/systems/volume-presence';
import { GroundDepthSorter, GROUND_LIGHT_DEPTH, WORLD_READOUT_DEPTH } from '@/systems/ground-depth';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { GameEvent } from '@/types/events';
import { AIState, TileType, type Vector2 } from '@/types/game-types';

export interface EnemyInspectorArenaData {
  readonly form: ContaminationForm;
  readonly seed: number;
  readonly fragmentTypeId: string;
}

const visible = (): number => 1;
const SUBJECT_ID = 'inspector-subject';

export class EnemyInspectorArena extends Phaser.Scene {
  private sampleData!: EnemyInspectorArenaData;
  private readonly tiles = new TilemapRenderer();
  private readonly player = new Player();
  private readonly ai = new AISystem();
  private readonly combat = new CombatSystem();
  private readonly hosts = new ContaminationHostSystem();
  private grid: TileGrid | null = null;
  private chaos: ChaosSystem | null = null;
  private visual: FormVisual | null = null;
  private subjectId = SUBJECT_ID;
  private depthSorter: GroundDepthSorter | null = null;
  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  private lastDelta = 16;
  private protectedReview = true;
  private alive = false;
  private created = false;
  private zoom = 3;
  private turnKey: { key: string; code: string; keyCode: number } | null = null;
  private turnTarget = 0;
  private turnRemainingMs = 0;

  constructor() { super({ key: 'EnemyInspectorArena' }); }

  init(data: EnemyInspectorArenaData): void {
    this.sampleData = data;
    this.subjectId = SUBJECT_ID;
    this.alive = false;
  }

  create(): void {
    this.created = true;
    const map = createLexiconObserveMap(this.sampleData.fragmentTypeId);
    const grid = this.grid = new TileGrid(map);
    const layer = this.tiles.create(this, map, {
      tilesetKey: 'placeholder-rift-tileset', collidingIndices: [TileType.WALL, TileType.VOID], depth: 0,
    });
    const colors = yardSurfaceColors(this.sampleData.fragmentTypeId);
    const surface = this.add.graphics().setDepth(0.05);
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        surface.fillStyle(rgbToHex(map.tiles[row]![col] === TileType.WALL ? colors.wall : colors.floor));
        surface.fillRect(col * map.tileSize, row * map.tileSize, map.tileSize, map.tileSize);
      }
    }
    this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);
    this.cameras.main.setBounds(0, 0, grid.widthPx, grid.heightPx)
      .setZoom(this.zoom).setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);
    this.player.create(this, { spawn: lexiconPlayerSpawn(), depth: 30, facing: 'right' });
    this.physics.add.collider(this.player.getSprite(), layer);
    this.ai.create(this, [], grid, grid, { requireExactlyOneRewriter: false });
    this.ai.setVisibilityProvider(visible);
    this.ai.addWallCollider(layer);
    this.ai.addStaticPlayerCollider(this.player.getSprite());
    this.combat.create(this, grid, this.player, this.ai, {
      captureEnemyVisual: id => id === this.subjectId ? this.visual?.getFlashSource?.() : undefined,
      onNoise: (position, radius, level) => {
        this.ai.reportNoise(position, radius, level);
        this.hosts.reportNoise(position, radius);
      },
    });
    this.combat.setGodMode(this.protectedReview);
    this.chaos = new ChaosSystem({ startingValue: 0 });
    this.hosts.bindPractice(this, lexiconPracticePins(), this.combat, this.chaos, visible,
      { liveMotion: true, occluders: grid });
    this.spawnSample();
    const keyboard = this.input.keyboard;
    if (keyboard) this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, true, false);
    document.addEventListener('focusin', this.onFocusChange);
    this.game.canvas.addEventListener('pointerdown', this.onCanvasFocus);
    this.onFocusChange();
    eventBus.on(GameEvent.ENEMY_DAMAGED, this.onDamaged);
    eventBus.on(GameEvent.ENEMY_KILLED, this.onKilled);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.cameras.main.startFollow(this.player.getSprite(), true, 0.15, 0.15);
    this.approach();
  }

  update(_time: number, delta: number): void {
    if (!this.created) return;
    this.lastDelta = delta;
    this.player.update(delta);
    if (this.turnKey) {
      this.turnRemainingMs -= delta;
      const difference = this.turnTarget - this.player.getFacingAngle();
      const remainingAngle = Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)));
      if (remainingAngle < 0.01 || this.turnRemainingMs <= 0) this.endReviewTurn();
    }
    this.ai.update(delta, this.player.getPosition(), this.player.isMoving());
    if (this.input.keyboard?.enabled && this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.combat.requestPlayerAttack();
    }
    this.combat.update(delta);
    this.hosts.update(delta, this.player.getPosition(), this.player.isMoving(), this.player.getFacingAngle());
    // The inspection session intentionally has no sortie timer or chaos settlement.
  }

  restartSample(): void { if (this.created) this.scene.restart(this.sampleData); }

  setProtected(value: boolean): void {
    this.protectedReview = value;
    if (this.created) this.combat.setGodMode(value);
  }

  setZoom(value: number): void {
    if (!Number.isFinite(value)) return;
    this.zoom = Math.max(1, Math.min(5, value));
    if (this.created) this.cameras.main.setZoom(this.zoom);
  }

  /** Stay on walkable floor with the real player's entire body clear of the wall/base. */
  approach(): void { this.placeNearSample(false); }

  approachMelee(): void { this.placeNearSample(true); }

  private placeNearSample(melee: boolean): void {
    const subject = this.subjectPosition();
    const grid = this.grid;
    if (!this.created || !subject || !grid) return;
    this.endReviewTurn();
    const angle = this.player.getFacingAngle();
    const directions: readonly (readonly [number, number])[] = [[-1, 0], [0, -1], [1, 0], [0, 1]];
    // Prefer landing where the player's current facing already points toward the sample.
    const attach = this.hosts.getVisualPin(this.subjectId)?.attach;
    const ordered = attach ? [[attach.nx, attach.ny] as const] : [...directions].sort((a, b) =>
      (a[0] * Math.cos(angle) + a[1] * Math.sin(angle)) -
      (b[0] * Math.cos(angle) + b[1] * Math.sin(angle)));
    for (const distance of melee ? [24, 32, 36] : [80, 112, 48, 144]) {
      for (const [dx, dy] of ordered) {
        const targetAngle = Math.atan2(-dy, -dx);
        const difference = targetAngle - angle;
        const requiresTurn = Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) > 0.05;
        // A real input turn includes a short step. Reserve clearance for that movement.
        if (melee && requiresTurn && distance < 36) continue;
        const x = subject.x + dx * distance;
        const y = subject.y + dy * distance;
        if (![-10, 10].every(ox => [-10, 10].every(oy => grid.isWalkableAt(x + ox, y + oy)))) continue;
        (this.player.getSprite().body as Phaser.Physics.Arcade.Body).reset(x, y);
        this.player.postUpdate();
        this.cameras.main.centerOn(x, y);
        if (melee && requiresTurn) this.beginReviewTurn(-dx, -dy, targetAngle);
        return;
      }
    }
  }

  /** Uses the actual keyboard/movement route; never writes Player's private facing. */
  private beginReviewTurn(dx: number, dy: number, angle: number): void {
    this.onCanvasFocus();
    this.turnKey = dx > 0 ? { key: 'd', code: 'KeyD', keyCode: 68 }
      : dx < 0 ? { key: 'a', code: 'KeyA', keyCode: 65 }
        : dy > 0 ? { key: 's', code: 'KeyS', keyCode: 83 }
          : { key: 'w', code: 'KeyW', keyCode: 87 };
    this.turnTarget = angle;
    this.turnRemainingMs = 250;
    window.dispatchEvent(new KeyboardEvent('keydown', { ...this.turnKey, bubbles: true }));
  }

  private endReviewTurn(): void {
    if (!this.turnKey) return;
    window.dispatchEvent(new KeyboardEvent('keyup', { ...this.turnKey, bubbles: true }));
    this.turnKey = null;
    this.turnRemainingMs = 0;
  }

  hitSample(): void {
    if (!this.created || !this.alive) return;
    if (this.sampleData.form.portfolio === 'jia') this.combat.applyToolDamage(this.subjectId, 1);
    else this.combat.requestPlayerAttack();
  }

  /** Hosts must be killed by their authored core/colony rules, never forced through a fake damage path. */
  killSample(): void {
    if (this.created && this.alive && this.sampleData.form.portfolio === 'jia') {
      this.combat.applyToolDamage(this.subjectId, Number.MAX_SAFE_INTEGER);
    }
  }

  getReviewState(): {
    ready: boolean; alive: boolean; seed: number; protected: boolean; canDirectHit: boolean; canDirectKill: boolean;
    health: number; maxHealth: number; player: Vector2; playerFacing: number; subject: Vector2 | null; state: string;
    attack: ReturnType<CombatSystem['getEnemyAttackVisualState']> | undefined;
    activity: { phase: string; progress: number } | undefined; nuclei: number; texture: string | undefined;
    textureCount: number; zoom: number; chaos: number;
    volume: { substrate: string; phase: VolumePhase; progress: number; elapsedMs: number; active: boolean; hazardActive: boolean } | undefined;
  } {
    const view = this.created ? this.ai.getEnemyById(this.subjectId) : undefined;
    const position = this.created ? this.subjectPosition() : null;
    const floor = this.sampleData?.form.portfolio === 'jia';
    const volume = this.hosts.getVolumePresenceFrame(this.subjectId);
    return {
      ready: this.created, alive: this.alive, seed: this.sampleData?.seed ?? 0, protected: this.protectedReview,
      canDirectHit: floor && this.alive, canDirectKill: floor && this.alive,
      health: this.created ? this.combat.getHealth() : 0, maxHealth: this.created ? this.combat.getMaxHealth() : 0,
      player: this.created ? { ...this.player.getPosition() } : { x: 0, y: 0 },
      playerFacing: this.created ? this.player.getFacingAngle() : 0,
      subject: position ? { ...position } : null,
      state: !this.alive ? 'dead' : view?.getState() ?? this.hosts.getVisualSignal(this.subjectId),
      attack: floor ? this.combat.getEnemyAttackVisualState(this.subjectId) : this.hosts.getAttackVisualState(this.subjectId),
      activity: view instanceof Enemy ? { ...view.getActivityVisualState() } : this.hosts.getActivityVisualState(this.subjectId),
      nuclei: floor ? Number(this.alive) : this.hosts.getLiveNucleusCount(this.subjectId),
      texture: this.visual?.getFlashSource?.().textureKey,
      textureCount: this.textures.getTextureKeys().length, zoom: this.zoom,
      chaos: this.chaos?.getValue() ?? 0,
      volume: volume ? { substrate: volume.substrate, phase: volume.phase, progress: volume.progress,
        elapsedMs: volume.elapsedMs, active: volume.active, hazardActive: volume.hazardActive } : undefined,
    };
  }

  private spawnSample(): void {
    const form = this.sampleData.form;
    if (form.portfolio === 'jia') {
      if (!this.grid?.isWalkable(14, 7)) throw new Error('Inspector floor sample needs a walkable spawn');
      this.ai.spawnOne({ id: this.subjectId, type: jiaRoleFor(form), spawn: { col: 14, row: 7 },
        facing: Math.PI, patrol: { waypoints: LEXICON_JIA_WAYPOINTS, mode: 'loop' }, form });
      this.combat.noteRosterChanged();
      const enemy = this.ai.getEnemyById(this.subjectId);
      if (enemy instanceof Enemy) {
        enemy.setVisualSuppressed(true);
        enemy.setReadoutDepth(WORLD_READOUT_DEPTH);
        enemy.setLocomotionMode(productionModelFor(form.substrate) ? 'continuous' : 'legacy-hitch');
      }
    } else {
      const id = this.hosts.spawnForm(form);
      if (!id) throw new Error('Inspector could not place environmental sample');
      this.subjectId = id;
      this.hosts.setSkipPaint(true);
    }
    this.visual = schemeDMixed.attach({ scene: this, form, seed: this.sampleData.seed, subjectId: this.subjectId,
      isWalkableFloor: (col, row) => this.grid?.isWalkable(col, row) ?? false,
      fragmentTypeId: this.sampleData.fragmentTypeId, pin: this.hosts.getVisualPin(this.subjectId) ?? undefined,
      depth: form.portfolio === 'bing' ? 1 : form.portfolio === 'ding' ? GAME_CONSTANTS.CONTAMINATION.VOLUME_DEPTH : ENEMY_DEPTH });
    if (form.portfolio !== 'jia') this.hosts.setStepFloors(this.subjectId, this.visual.stepFloors ?? []);
    const view = this.ai.getEnemyById(this.subjectId);
    this.player.setGroundDepth(30, GROUND_LIGHT_DEPTH);
    if (view && this.visual.setGroundDepth) {
      const visual = this.visual;
      this.depthSorter = new GroundDepthSorter([
        { id: 'player', groundY: () => this.player.getGroundY(), applyDepth: d => this.player.setGroundDepth(d, GROUND_LIGHT_DEPTH) },
        { id: this.subjectId, groundY: () => view.getPosition().y, applyDepth: d => visual.setGroundDepth!(d) },
      ]);
    }
    this.alive = true;
    this.onPostUpdate();
  }

  private subjectPosition(): Readonly<Vector2> | null {
    return this.ai.getEnemyById(this.subjectId)?.getPosition() ??
      this.hosts.getSubjects().find(subject => subject.id === this.subjectId)?.position ?? null;
  }

  private onPostUpdate(): void {
    if (!this.created) return;
    this.player.postUpdate();
    this.ai.postUpdate(this.lastDelta);
    const visual = this.visual;
    const view = this.ai.getEnemyById(this.subjectId);
    const position = this.subjectPosition();
    if (visual && position) {
      const enemy = view instanceof Enemy ? view : undefined;
      const velocity = enemy?.getActualVelocity();
      const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
      const pin = this.hosts.getVisualPin(this.subjectId);
      visual.update({ x: pin?.kind === 'cluster' ? pin.x : position.x,
        y: pin?.kind === 'cluster' ? pin.y : position.y, visibility: 1, deltaMs: this.lastDelta,
        facing4: view?.getFacing4() ?? this.hosts.getVisualFacing(this.subjectId),
        moving: view ? isActorWalking(speed) : this.hosts.getVisualMoving(this.subjectId), movementSpeed: speed,
        signal: enemy ? signalFor(enemy) : this.hosts.getVisualSignal(this.subjectId),
        attack: view ? this.combat.getEnemyAttackVisualState(this.subjectId) : this.hosts.getAttackVisualState(this.subjectId),
        activity: enemy?.getActivityVisualState() ?? this.hosts.getActivityVisualState(this.subjectId),
      });
    }
    this.depthSorter?.update();
  }

  private readonly onDamaged = ({ enemyId }: { enemyId: string }): void => {
    if (enemyId === this.subjectId) this.ai.reportDamage(enemyId, this.player.getPosition());
  };

  private readonly onKilled = ({ enemyId }: { enemyId: string }): void => {
    if (enemyId !== this.subjectId) return;
    this.alive = false;
    this.depthSorter = null;
    this.visual?.destroy();
    this.visual = null;
    if (this.ai.getEnemyById(enemyId)) this.ai.despawn(enemyId);
    this.combat.noteRosterChanged();
  };

  private readonly onFocusChange = (): void => {
    this.endReviewTurn();
    const target = document.activeElement;
    const editing = target instanceof HTMLElement &&
      (target.matches('input, select, textarea, button') || target.isContentEditable);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.resetKeys();
      keyboard.enabled = !editing;
      if (editing) keyboard.disableGlobalCapture();
      else keyboard.enableGlobalCapture();
    }
    this.player.setInputEnabled(!editing);
  };

  private readonly onCanvasFocus = (): void => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.onFocusChange();
  };

  private onShutdown(): void {
    if (!this.created) return;
    this.endReviewTurn();
    this.created = false;
    document.removeEventListener('focusin', this.onFocusChange);
    this.game.canvas.removeEventListener('pointerdown', this.onCanvasFocus);
    this.input.keyboard?.disableGlobalCapture();
    eventBus.off(GameEvent.ENEMY_DAMAGED, this.onDamaged);
    eventBus.off(GameEvent.ENEMY_KILLED, this.onKilled);
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.depthSorter = null;
    this.visual?.destroy();
    this.visual = null;
    this.hosts.destroy();
    this.combat.destroy();
    this.ai.destroy();
    this.player.destroy();
    this.chaos?.destroy();
    this.chaos = null;
    this.tiles.destroy();
    this.grid = null;
    if (this.attackKey) this.input.keyboard?.removeKey(this.attackKey, true);
    this.attackKey = null;
  }
}

function signalFor(enemy: Enemy): FormVisualSignal {
  if (enemy.isEngaged()) return 'strike';
  if (enemy.getState() === AIState.CHASE) return 'awake';
  if (enemy.getState() === AIState.ALERT || enemy.getState() === AIState.SUSPICIOUS) return 'inflated';
  return 'idle';
}
