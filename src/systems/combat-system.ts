/**
 * CombatSystem - the whole of Slice 1's melee (docs/specs/system-combat.md).
 *
 * What this system is for is worth stating before any of the code makes sense: combat is
 * a *price list*, not a fight. The player has to be able to work out what a swing costs
 * before swinging, so damage carries no randomness anywhere (an infiltrator is exactly
 * three hits, forever), and the cost is charged on two axes that cannot substitute for
 * each other - chaos, via `ENEMY_DAMAGED`, and exposure, via the noise callback. If
 * playtesters start enjoying the fighting, this system has failed.
 *
 * Three structural commitments, all of them load-bearing:
 *
 * 1. **It cannot touch the AI's state machine.** It receives `AISystemReadView`, which
 *    exposes only `getEnemies` / `getEnemyById`. `reportDamage` and `despawn` are
 *    deliberately absent, so "combat drives the FSM" is not merely discouraged but
 *    unwriteable; the scene layer translates events into those calls instead.
 * 2. **It cannot touch the chaos meter.** It emits events and lets the chaos system price
 *    them. That keeps one place to change when the cost of a fight needs tuning.
 * 3. **Occlusion always goes through `utils/grid-raycast`.** Player and enemy are bound by
 *    the same rule, so neither can hit through a wall the other cannot see through.
 *
 * Ownership: this system owns player and enemy health, hits, attacks, invulnerability and
 * death. It owns none of their movement - positions, facing and the speed modifier stack
 * belong to `Player` and to the AI system, and the only thing written back is a single
 * `'attack'` speed modifier during a swing.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { ENEMY_BODY_TEXTURE } from '@/entities/enemy-factory';
import type { EnemyView } from '@/types/ai-types';
import { GameEvent } from '@/types/events';
import type { Vector2 } from '@/types/game-types';
import type { OccluderGrid } from '@/types/map-types';
import { hasLineOfSight } from '@/utils/grid-raycast';
import { clamp, degToRad, lerp, shortestArc } from '@/utils/math';

/** Player swing phases. The cooldown starts at the input instant and runs alongside them. */
export type AttackPhase = 'idle' | 'windup' | 'active' | 'recovery';

/** Enemy swing phases. `cooldown` is entered whether the attack landed or whiffed. */
export type EnemyAttackPhase = 'idle' | 'windup' | 'cooldown';

export type NoiseLevel = 'suspicious' | 'alert';

/**
 * Audio moments this system names but does not design (spec V6). `enemyWindup` matters
 * most: an enemy outside the field of view is not drawn at all, so its telegraph line is
 * invisible and the sound is the player's only warning.
 */
export type CombatCueId =
  | 'combat.cue.swing'
  | 'combat.cue.hit'
  | 'combat.cue.enemyDeath'
  | 'combat.cue.enemyWindup'
  | 'combat.cue.playerHurt';

/**
 * Injected by the scene layer at create time.
 *
 * Noise is a callback rather than an event on purpose: a whiffed swing is audible but
 * emits no event at all, so an event-based route could not carry it, and putting the radii
 * in the scene would split the noise policy away from the tuning table it belongs to.
 * The scene implements `onNoise` as a single call to `AISystem.reportNoise` and must not
 * synthesise noise from `ENEMY_DAMAGED` / `ENEMY_KILLED` as well, or every hit is
 * broadcast twice.
 */
export interface CombatHooks {
  onNoise(pos: Readonly<Vector2>, radius: number, level: NoiseLevel): void;
  /** Optional until an audio manager exists. */
  onCue?(cue: CombatCueId, pos: Readonly<Vector2>): void;
}

/**
 * The only part of the AI system combat is allowed to see. Narrowed on purpose: the
 * stimulus entry points (`reportDamage` / `reportNoise` / `despawn`) are missing from this
 * view so that changing AI state from here is a type error rather than a code review note.
 */
export interface AISystemReadView {
  getEnemies(): readonly EnemyView[];
  getEnemyById(id: string): EnemyView | undefined;
}

/**
 * The part of `Player` combat needs. `setSpeedModifier` is the single write: everything
 * else about the player's motion stays owned by the movement spec.
 *
 * Not in the spec's `create` signature, which reads the player through globals it never
 * names; passing it explicitly keeps the dependency visible and the type narrow.
 */
export interface PlayerCombatTarget {
  getPosition(): Readonly<Vector2>;
  getFacingAngle(): number;
  setSpeedModifier(source: string, multiplier: number): void;
  clearSpeedModifier(source: string): void;
}

/** The player's combat facet, queried rather than evented (continuous, per-frame values). */
export interface PlayerCombatAPI {
  getHealth(): number;
  getMaxHealth(): number;
  isDead(): boolean;
  isInvulnerable(): boolean;
  getAttackState(): Readonly<{ phase: AttackPhase; cooldownRemainingMs: number }>;
}

export interface CombatSystemAPI extends PlayerCombatAPI {
  create(
    scene: Phaser.Scene,
    occluders: OccluderGrid,
    player: PlayerCombatTarget,
    ai: AISystemReadView,
    hooks: CombatHooks
  ): void;
  update(deltaMs: number): void;
  requestPlayerAttack(): void;
  getEnemyHealth(enemyId: string): number | undefined;
  isEnemyAlive(enemyId: string): boolean;
  setEnabled(enabled: boolean): void;
  reset(): void;
  destroy(): void;
  /**
   * A damage source outside the melee swing (Slice 5 combust: "区域内敌人每秒受到持续
   * 伤害"). Funnels through the same health/event pipeline as a player hit so chaos,
   * death and the hit flash all stay consistent, but skips the hit-test entirely - the
   * caller has already decided who is affected. Returns false if the enemy is unknown or
   * already dead.
   */
  applyToolDamage(enemyId: string, amount: number): boolean;
}

/** Dev overlay / QA readout. Nothing in here is a gameplay input. */
export interface CombatStats {
  readonly health: number;
  readonly maxHealth: number;
  readonly phase: AttackPhase;
  readonly cooldownRemainingMs: number;
  readonly invulnRemainingMs: number;
  readonly attackTokensInUse: number;
  readonly isDead: boolean;
  readonly lastCue: string;
  /**
   * Last noise broadcast, e.g. `alert r160`. Exposed because the real cost of one hit is
   * the chaos it triggers *through* the noise, and that total has never been designed by
   * any single spec - it has to be measured.
   */
  readonly lastNoise: string;
}

/**
 * Combat visuals sit above the entities and below the darkness mask (depth 50), so a
 * telegraph line or a death flash is hidden by the field of view exactly like the sprite
 * it belongs to.
 */
export const COMBAT_FX_DEPTH = 40;

/** The key of the one speed modifier this system writes. */
const SLOW_SOURCE = 'attack';

/** Per-enemy combat state. Health lives here only - the entity does not keep a copy. */
interface EnemyCombatState {
  readonly id: string;
  readonly view: EnemyView;
  health: number;
  alive: boolean;
  attackPhase: EnemyAttackPhase;
  attackTimerMs: number;
  /** Locked when the windup starts; the strike resolves against this heading, not a fresh one. */
  attackAngle: number;
  cooldownRemainingMs: number;
  /** Time spent engaged, for the first-attack delay. Reset the moment it disengages. */
  engagedSinceMs: number;
  /** Frames left of the single full-brightness frame at the strike instant (spec V2). */
  strikeFxFrames: number;
}

/** One pooled white flash. Death effects outlive the enemy entity, hence the pool. */
interface FxSlot {
  readonly image: Phaser.GameObjects.Image;
  remainingMs: number;
  durationMs: number;
  fade: boolean;
}

export class CombatSystem implements CombatSystemAPI {
  private occluders!: OccluderGrid;
  private player!: PlayerCombatTarget;
  private ai!: AISystemReadView;
  private hooks!: CombatHooks;

  private graphics!: Phaser.GameObjects.Graphics;
  private readonly fx: FxSlot[] = [];

  private enabled = true;

  // --- player combat state (spec's PlayerCombatState) ---
  private health: number = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
  private readonly maxHealth: number = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
  private dead = false;
  private phase: AttackPhase = 'idle';
  /** Time since the swing input. All three phases are derived from it. */
  private swingElapsedMs = 0;
  private attackAngle = 0;
  private cooldownRemainingMs = 0;
  private invulnRemainingMs = 0;
  private flashRemainingMs = 0;
  /** Preallocated: the hit test origin follows the player every frame. */
  private readonly attackOrigin: Vector2 = { x: 0, y: 0 };
  /** Preallocated scratch for positions that outlive the entity they came from. */
  private readonly deathPos: Vector2 = { x: 0, y: 0 };
  /** Preallocated and cleared per swing, never rebuilt (one settlement per enemy per swing). */
  private readonly hitSet = new Set<string>();
  private swingNoiseSent = false;
  private hitNoiseSent = false;

  private readonly enemies = new Map<string, EnemyCombatState>();
  private attackTokensInUse = 0;

  /** Returned by reference from `getAttackState()`; mutated in place, never reallocated. */
  private readonly attackStateView = { phase: 'idle' as AttackPhase, cooldownRemainingMs: 0 };
  private lastCue = '-';
  private lastNoise = '-';

  // ------------------------------------------------------------------ lifecycle

  create(
    scene: Phaser.Scene,
    occluders: OccluderGrid,
    player: PlayerCombatTarget,
    ai: AISystemReadView,
    hooks: CombatHooks
  ): void {
    this.occluders = occluders;
    this.player = player;
    this.ai = ai;
    this.hooks = hooks;

    // Reset all combat state (critical for scene re-entry via scene.start)
    this.enabled = true;
    this.dead = false;
    this.health = this.maxHealth;
    this.invulnRemainingMs = 0;
    this.flashRemainingMs = 0;
    this.cooldownRemainingMs = 0;
    this.phase = 'idle';
    this.swingElapsedMs = 0;
    this.attackTokensInUse = 0;
    this.enemies.clear();
    this.hitSet.clear();

    this.graphics = scene.add.graphics().setDepth(COMBAT_FX_DEPTH);
    for (let i = 0; i < GAME_CONSTANTS.COMBAT.FX_POOL_SIZE; i++) {
      const image = scene.add
        .image(0, 0, ENEMY_BODY_TEXTURE)
        .setDepth(COMBAT_FX_DEPTH)
        .setVisible(false);
      image.setTintFill(GAME_CONSTANTS.COMBAT.FX_COLOR);
      this.fx.push({ image, remainingMs: 0, durationMs: 0, fade: false });
    }

    this.syncRoster();
    this.emitHealth();
  }

  destroy(): void {
    this.cancelSwing();
    this.clearAllWindups();
    this.enemies.clear();
    this.hitSet.clear();

    for (const slot of this.fx) slot.image.destroy();
    this.fx.length = 0;
    this.graphics?.destroy();
  }

  /**
   * Off means: no input, no damage, no telegraphs. Called on death, on extraction and on
   * anything else that ends a run. Cleaning the `'attack'` modifier here is the reason
   * every one of those paths funnels through this method - a player left permanently at
   * 0.35 speed is the bug this spec singles out.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) return;
    this.cancelSwing();
    this.clearAllWindups();
  }

  /** A fresh run: full health, clean timers, enemy health rebuilt from the live roster. */
  reset(): void {
    this.enabled = true;
    this.health = this.maxHealth;
    this.dead = false;
    this.invulnRemainingMs = 0;
    this.flashRemainingMs = 0;
    this.cooldownRemainingMs = 0;
    this.cancelSwing();
    this.clearAllWindups();

    this.enemies.clear();
    this.syncRoster();
    this.clearAllFx();
    this.emitHealth();
  }

  // ------------------------------------------------------------------ update

  update(deltaMs: number): void {
    // Same clamp as the AI uses: returning from a background tab must not resolve a
    // 350 ms windup and its 1200 ms cooldown inside one frame.
    const dtMs = Math.min(deltaMs, GAME_CONSTANTS.AI.DT_CLAMP_MS);

    if (this.enabled) {
      if (this.enemies.size !== this.ai.getEnemies().length) this.syncRoster();
      this.updateSwing(dtMs);
      this.updateEnemies(dtMs);
    }

    // Timers and effects keep running while disabled. Freezing them would leave the
    // player permanently mid-flash on the frame they died, which reads as a broken
    // renderer rather than as a held moment.
    this.updatePlayerTimers(dtMs);
    this.drawVisuals();
    this.stepFx(dtMs);
  }

  /**
   * Called by the scene on the frame the attack key goes down. No side effects while on
   * cooldown, dead or disabled - and explicitly no input buffering: queueing the press
   * would reward mashing, which is the opposite of asking the player to commit.
   */
  requestPlayerAttack(): void {
    if (!this.enabled || this.dead) return;
    if (this.cooldownRemainingMs > 0 || this.phase !== 'idle') return;

    // Locked here and nowhere else. Turning mid-swing must not redirect the blade, or
    // "faced the wrong way" stops being a mistake the player can make.
    this.attackAngle = this.player.getFacingAngle();
    this.phase = 'windup';
    this.swingElapsedMs = 0;
    this.cooldownRemainingMs = GAME_CONSTANTS.COMBAT.ATTACK_COOLDOWN;
    this.hitSet.clear();
    this.swingNoiseSent = false;
    this.hitNoiseSent = false;
    this.player.setSpeedModifier(SLOW_SOURCE, GAME_CONSTANTS.COMBAT.ATTACK_SELF_SLOW);
    this.cue('combat.cue.swing', this.player.getPosition());
  }

  // ------------------------------------------------------------------ queries

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  isDead(): boolean {
    return this.dead;
  }

  isInvulnerable(): boolean {
    return this.invulnRemainingMs > 0;
  }

  getAttackState(): Readonly<{ phase: AttackPhase; cooldownRemainingMs: number }> {
    this.attackStateView.phase = this.phase;
    this.attackStateView.cooldownRemainingMs = this.cooldownRemainingMs;
    return this.attackStateView;
  }

  getEnemyHealth(enemyId: string): number | undefined {
    return this.enemies.get(enemyId)?.health;
  }

  isEnemyAlive(enemyId: string): boolean {
    return this.enemies.get(enemyId)?.alive === true;
  }

  applyToolDamage(enemyId: string, amount: number): boolean {
    if (!this.enabled || amount <= 0) return false;
    const state = this.enemies.get(enemyId);
    if (!state || !state.alive) return false;

    state.health -= amount;
    const pos = state.view.getPosition();
    this.spawnFx(pos, state.view.getFacingAngle(), GAME_CONSTANTS.COMBAT.ENEMY_HIT_FLASH_MS, false);

    eventBus.emit(GameEvent.ENEMY_DAMAGED, { enemyId: state.id, amount, source: 'tool' });

    if (state.health <= 0) this.killEnemy(state, pos);
    return true;
  }

  getStats(): CombatStats {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      phase: this.phase,
      cooldownRemainingMs: this.cooldownRemainingMs,
      invulnRemainingMs: this.invulnRemainingMs,
      attackTokensInUse: this.attackTokensInUse,
      isDead: this.dead,
      lastCue: this.lastCue,
      lastNoise: this.lastNoise,
    };
  }

  // ------------------------------------------------------------------ player attack

  private updateSwing(dtMs: number): void {
    const combat = GAME_CONSTANTS.COMBAT;
    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - dtMs);
    }
    if (this.phase === 'idle') return;

    const previous = this.swingElapsedMs;
    this.swingElapsedMs += dtMs;

    const activeStart = combat.ATTACK_WINDUP_MS;
    const activeEnd = activeStart + combat.ATTACK_ACTIVE_MS;

    // Overlap test rather than "phase === active": a long frame can step straight over a
    // 50 ms window, and a swing that silently never tests for hits is unexplainable.
    if (this.swingElapsedMs > activeStart && previous < activeEnd) this.resolveSwing();

    this.phase =
      this.swingElapsedMs < activeStart
        ? 'windup'
        : this.swingElapsedMs < activeEnd
          ? 'active'
          : 'recovery';

    if (this.swingElapsedMs >= combat.ATTACK_SLOW_MS) this.cancelSwing();
  }

  /**
   * Forward-sector hit test. A sector rather than a rectangle because its tolerance
   * narrows with distance the way the player already reads the vision cone and the
   * perception cone - the same geometric language, so nothing new has to be learned.
   */
  private resolveSwing(): void {
    const combat = GAME_CONSTANTS.COMBAT;
    const origin = this.attackOrigin;
    const playerPos = this.player.getPosition();
    origin.x = playerPos.x;
    origin.y = playerPos.y;

    if (!this.swingNoiseSent) {
      this.swingNoiseSent = true;
      // A whiff costs no chaos but is still heard. "No cost" means no chaos, not that the
      // world failed to notice - which is what makes exploratory swinging a bad habit.
      // Sent before the hits so that the louder alert-grade noise, if any, is the last
      // stimulus each enemy receives.
      this.noise(origin, combat.NOISE_SWING_RADIUS, 'suspicious');
    }

    const halfAngle = degToRad(combat.ATTACK_HALF_ANGLE);

    for (const state of this.enemies.values()) {
      if (!state.alive || this.hitSet.has(state.id)) continue;

      const enemyPos = state.view.getPosition();
      const deltaX = enemyPos.x - origin.x;
      const deltaY = enemyPos.y - origin.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Cheap tests first; the ray is only paid for by a candidate that already passed.
      if (distance > combat.ATTACK_RANGE) continue;
      if (distance > combat.ATTACK_MIN_ANGLE_BYPASS) {
        const bearing = Math.atan2(deltaY, deltaX);
        if (Math.abs(shortestArc(bearing - this.attackAngle)) > halfAngle) continue;
      }
      if (!hasLineOfSight(this.occluders, origin, enemyPos)) continue;

      this.hitSet.add(state.id);
      this.applyPlayerHit(state, enemyPos);
    }
  }

  /**
   * One enemy takes one hit. Order matters and is the spec's: damage, flash, event, then
   * death.
   *
   * The subtle part is why a killing blow does not end up chasing the player. The event is
   * dispatched synchronously, so the scene's `reportDamage` runs before we know the enemy
   * died - but `ENEMY_KILLED` follows in the same call stack and despawns it, and the AI
   * only consumes pending stimuli on its own update, which already ran this frame. The
   * flag is therefore written to an object that is destroyed before anything can read it.
   * This is also why `combat.update()` must stay after `ai.update()`.
   */
  private applyPlayerHit(state: EnemyCombatState, enemyPos: Readonly<Vector2>): void {
    const combat = GAME_CONSTANTS.COMBAT;

    state.health -= combat.PLAYER_DAMAGE;
    // The flash is a pooled sprite rather than state on the enemy: the death version has
    // to outlive the entity, so one mechanism owns both and there is nothing write-only.
    this.spawnFx(enemyPos, state.view.getFacingAngle(), combat.ENEMY_HIT_FLASH_MS, false);
    this.cue('combat.cue.hit', enemyPos);

    if (!this.hitNoiseSent) {
      this.hitNoiseSent = true;
      // Broadcast once per swing from the first victim's position, not once per victim:
      // `reportNoise` is a radius sweep, so repeating it only repeats the sweep.
      this.noise(enemyPos, combat.NOISE_HIT_RADIUS, 'alert');
    }

    eventBus.emit(GameEvent.ENEMY_DAMAGED, {
      enemyId: state.id,
      amount: combat.PLAYER_DAMAGE,
      source: 'player',
    });

    if (state.health <= 0) this.killEnemy(state, enemyPos);
  }

  /**
   * Removal from the simulation is immediate; the dissolve is not. A corpse must never
   * block a blade or keep chasing, and Slice 1 leaves nothing behind: no body, no drop.
   * Kindling is the residue of two contamination modes colliding, not loot - making
   * enemies drop it would turn combat from a way to cut losses into a way to make
   * progress, which is the one thing this system must not become.
   */
  private killEnemy(state: EnemyCombatState, enemyPos: Readonly<Vector2>): void {
    const combat = GAME_CONSTANTS.COMBAT;

    state.alive = false;
    state.health = 0;
    if (state.attackPhase === 'windup') this.releaseToken();
    state.attackPhase = 'idle';
    state.attackTimerMs = 0;
    state.strikeFxFrames = 0;

    // Copied before the entity goes away: `despawn` lands inside the emit below.
    const facing = state.view.getFacingAngle();
    this.deathPos.x = enemyPos.x;
    this.deathPos.y = enemyPos.y;
    this.enemies.delete(state.id);

    // A fresh payload per kill: a handful per run, and consumers may retain it.
    eventBus.emit(GameEvent.ENEMY_KILLED, {
      enemyId: state.id,
      position: { x: this.deathPos.x, y: this.deathPos.y },
    });

    this.noise(this.deathPos, combat.NOISE_KILL_RADIUS, 'alert');
    this.cue('combat.cue.enemyDeath', this.deathPos);
    this.spawnFx(this.deathPos, facing, combat.ENEMY_DEATH_FX_MS, true);
  }

  /** Ends a swing from any cause and always releases the slow. */
  private cancelSwing(): void {
    this.phase = 'idle';
    this.swingElapsedMs = 0;
    this.hitSet.clear();
    this.player?.clearSpeedModifier(SLOW_SOURCE);
  }

  // ------------------------------------------------------------------ enemy attack

  private updateEnemies(dtMs: number): void {
    const combat = GAME_CONSTANTS.COMBAT;
    const playerPos = this.player.getPosition();

    for (const state of this.enemies.values()) {
      if (!state.alive) continue;

      if (state.cooldownRemainingMs > 0) {
        state.cooldownRemainingMs = Math.max(0, state.cooldownRemainingMs - dtMs);
        if (state.cooldownRemainingMs === 0 && state.attackPhase === 'cooldown') {
          state.attackPhase = 'idle';
        }
      }

      // Queried every frame rather than driven by an event: whether an enemy may swing is
      // a continuous condition, and routing it through the bus would be pure traffic.
      const engaged = state.view.isEngaged();
      state.engagedSinceMs = engaged ? state.engagedSinceMs + dtMs : 0;

      if (state.attackPhase === 'windup') {
        // A windup cannot be interrupted (only cancelled by dying). Interruption would
        // make pre-emptive swinging dominant and turn "should I fight" into "fight well".
        state.attackTimerMs += dtMs;
        if (state.attackTimerMs >= combat.ENEMY_ATTACK_WINDUP_MS) {
          this.resolveEnemyAttack(state, playerPos);
          if (!this.enabled) return;
        }
        continue;
      }

      if (state.attackPhase !== 'idle' || !engaged) continue;
      if (this.canStartEnemyAttack(state, playerPos)) this.startEnemyWindup(state, playerPos);
    }
  }

  private canStartEnemyAttack(
    state: EnemyCombatState,
    playerPos: Readonly<Vector2>
  ): boolean {
    const combat = GAME_CONSTANTS.COMBAT;
    if (this.dead) return false;
    if (state.cooldownRemainingMs > 0) return false;
    if (state.engagedSinceMs < combat.ENEMY_FIRST_ATTACK_DELAY_MS) return false;
    if (this.attackTokensInUse >= combat.ENEMY_ATTACK_TOKENS) return false;

    const enemyPos = state.view.getPosition();
    const deltaX = playerPos.x - enemyPos.x;
    const deltaY = playerPos.y - enemyPos.y;
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > combat.ENEMY_ATTACK_RANGE) return false;

    const bearing = Math.atan2(deltaY, deltaX);
    const facingOffset = Math.abs(shortestArc(bearing - state.view.getFacingAngle()));
    if (facingOffset > degToRad(combat.ENEMY_ATTACK_HALF_ANGLE)) return false;

    return hasLineOfSight(this.occluders, enemyPos, playerPos);
  }

  private startEnemyWindup(state: EnemyCombatState, playerPos: Readonly<Vector2>): void {
    const enemyPos = state.view.getPosition();
    state.attackPhase = 'windup';
    state.attackTimerMs = 0;
    state.attackAngle = Math.atan2(playerPos.y - enemyPos.y, playerPos.x - enemyPos.x);
    this.attackTokensInUse++;
    this.cue('combat.cue.enemyWindup', enemyPos);
  }

  /**
   * The windup ends and the hit is settled once, against conditions evaluated *now*.
   * Standing in the wrong place at this instant is the entire content of "controllable":
   * fear should come from having misjudged, never from a die roll.
   */
  private resolveEnemyAttack(state: EnemyCombatState, playerPos: Readonly<Vector2>): void {
    const combat = GAME_CONSTANTS.COMBAT;

    this.releaseToken();
    state.attackPhase = 'cooldown';
    state.attackTimerMs = 0;
    state.cooldownRemainingMs = combat.ENEMY_ATTACK_COOLDOWN_MS;
    state.strikeFxFrames = 1;

    if (this.dead) return;

    const enemyPos = state.view.getPosition();
    const deltaX = playerPos.x - enemyPos.x;
    const deltaY = playerPos.y - enemyPos.y;
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > combat.ENEMY_ATTACK_RANGE) return;

    const bearing = Math.atan2(deltaY, deltaX);
    if (Math.abs(shortestArc(bearing - state.attackAngle)) > degToRad(combat.ENEMY_ATTACK_HALF_ANGLE)) {
      return;
    }
    if (!hasLineOfSight(this.occluders, enemyPos, playerPos)) return;
    // Whiffing on invulnerability is silent by design: no damage, no event, and the
    // remaining invulnerability is not refreshed.
    if (this.isInvulnerable()) return;

    this.applyEnemyHit(state.id);
  }

  private applyEnemyHit(enemyId: string): void {
    const combat = GAME_CONSTANTS.COMBAT;

    this.health = Math.max(0, this.health - combat.ENEMY_DAMAGE_BASE);
    this.invulnRemainingMs = combat.PLAYER_IFRAME_MS;
    this.flashRemainingMs = combat.PLAYER_HIT_FLASH_MS;
    this.cue('combat.cue.playerHurt', this.player.getPosition());

    // Both events, always, in this order. One says "a hit happened, and this is who did
    // it", the other says "health is now this much". Neither carries the other's
    // information, so neither can stand in for the other.
    eventBus.emit(GameEvent.PLAYER_DAMAGED, {
      amount: combat.ENEMY_DAMAGE_BASE,
      source: enemyId,
    });
    this.emitHealth();

    if (this.health <= 0) this.killPlayer();
  }

  /**
   * Death stops here: the settlement panel, the input freeze and the lost kindling belong
   * to the run controller, which listens for `PLAYER_DIED`. The view is deliberately not
   * faded to black either - the run should end on the sight of what killed you.
   */
  private killPlayer(): void {
    if (this.dead) return;
    this.dead = true;
    this.health = 0;
    // Health first: the HUD has to be showing an empty bar when the panel arrives.
    this.emitHealth();
    eventBus.emit(GameEvent.PLAYER_DIED, { cause: 'enemy_attack' });
    this.setEnabled(false);
  }

  private releaseToken(): void {
    this.attackTokensInUse = Math.max(0, this.attackTokensInUse - 1);
  }

  private clearAllWindups(): void {
    for (const state of this.enemies.values()) {
      if (state.attackPhase === 'windup') {
        state.attackPhase = 'idle';
        state.attackTimerMs = 0;
      }
      state.strikeFxFrames = 0;
    }
    // Reset rather than decrement: this runs from re-entrant paths (a death emit calls
    // back into `setEnabled`), where counting down twice would underflow the budget.
    this.attackTokensInUse = 0;
  }

  private updatePlayerTimers(dtMs: number): void {
    if (this.invulnRemainingMs > 0) {
      this.invulnRemainingMs = Math.max(0, this.invulnRemainingMs - dtMs);
    }
    if (this.flashRemainingMs > 0) {
      this.flashRemainingMs = Math.max(0, this.flashRemainingMs - dtMs);
    }
  }

  // ------------------------------------------------------------------ roster

  /**
   * Mirrors the AI's roster into local combat state. Runs at create, at reset, and on the
   * rare frame where the counts disagree; never as a matter of course.
   *
   * Combat iterates its own map in `update`, never the AI's live array, because a kill
   * splices that array from inside the loop that is walking it.
   */
  private syncRoster(): void {
    const views = this.ai.getEnemies();

    for (const view of views) {
      const id = view.getId();
      if (this.enemies.has(id)) continue;
      this.enemies.set(id, {
        id,
        view,
        health: GAME_CONSTANTS.COMBAT.ENEMY_MAX_HEALTH,
        alive: true,
        attackPhase: 'idle',
        attackTimerMs: 0,
        attackAngle: view.getFacingAngle(),
        cooldownRemainingMs: 0,
        engagedSinceMs: 0,
        strikeFxFrames: 0,
      });
    }

    for (const id of this.enemies.keys()) {
      if (!this.ai.getEnemyById(id)) this.enemies.delete(id);
    }
  }

  // ------------------------------------------------------------------ presentation

  /**
   * Everything the player sees of a fight, redrawn from scratch each frame into one
   * Graphics object (no allocation, no per-entity objects to leak).
   *
   * Placeholder rules, all of them from the spec and none of them signed off by art yet:
   * white, thin, and nothing else. No screen shake, no hit stop, no damage numbers, no
   * knockback - those exist to make fighting feel good, and this system needs it to read
   * as expensive.
   */
  private drawVisuals(): void {
    const combat = GAME_CONSTANTS.COMBAT;
    const graphics = this.graphics;
    graphics.clear();

    const activeStart = combat.ATTACK_WINDUP_MS;
    if (
      this.phase !== 'idle' &&
      this.swingElapsedMs >= activeStart &&
      this.swingElapsedMs <= activeStart + combat.ATTACK_FAN_FX_MS
    ) {
      this.drawSwingFan();
    }

    if (this.flashRemainingMs > 0) {
      // The player placeholder is already solid white, so a plain overlay would be
      // invisible; the flash reads as the body briefly growing. Provisional - see the
      // outstanding art question about white meaning both "player" and "attack".
      const position = this.player.getPosition();
      const size = GAME_CONSTANTS.PLAYER.BODY_SIZE + combat.PLAYER_FLASH_PAD;
      graphics.fillStyle(combat.FX_COLOR, 1);
      graphics.fillRect(position.x - size / 2, position.y - size / 2, size, size);
    }

    for (const state of this.enemies.values()) {
      if (state.strikeFxFrames > 0) {
        state.strikeFxFrames--;
        this.drawTelegraph(state, 1);
        continue;
      }
      if (state.attackPhase !== 'windup') continue;
      const progress = clamp(state.attackTimerMs / combat.ENEMY_ATTACK_WINDUP_MS, 0, 1);
      this.drawTelegraph(state, lerp(0.2, 0.8, progress));
    }
  }

  private drawSwingFan(): void {
    const combat = GAME_CONSTANTS.COMBAT;
    const graphics = this.graphics;
    const position = this.player.getPosition();
    const halfAngle = degToRad(combat.ATTACK_HALF_ANGLE);
    const range = combat.ATTACK_RANGE;
    const from = this.attackAngle - halfAngle;
    const to = this.attackAngle + halfAngle;

    graphics.lineStyle(1, combat.FX_COLOR, 1);
    graphics.beginPath();
    graphics.moveTo(position.x + Math.cos(from) * range, position.y + Math.sin(from) * range);
    graphics.lineTo(position.x, position.y);
    graphics.lineTo(position.x + Math.cos(to) * range, position.y + Math.sin(to) * range);
    graphics.strokePath();

    graphics.beginPath();
    graphics.arc(position.x, position.y, range, from, to);
    graphics.strokePath();
  }

  /** The telegraph: a thin line from the enemy along the heading it committed to. */
  private drawTelegraph(state: EnemyCombatState, alpha: number): void {
    const combat = GAME_CONSTANTS.COMBAT;
    const position = state.view.getPosition();
    this.graphics.lineStyle(1, combat.FX_COLOR, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(position.x, position.y);
    this.graphics.lineTo(
      position.x + Math.cos(state.attackAngle) * combat.ENEMY_ATTACK_RANGE,
      position.y + Math.sin(state.attackAngle) * combat.ENEMY_ATTACK_RANGE
    );
    this.graphics.strokePath();
  }

  /** Takes a free pooled flash, or steals the one closest to finishing. */
  private spawnFx(
    position: Readonly<Vector2>,
    rotation: number,
    durationMs: number,
    fade: boolean
  ): void {
    let slot: FxSlot | undefined;
    for (const candidate of this.fx) {
      if (candidate.remainingMs <= 0) {
        slot = candidate;
        break;
      }
      if (!slot || candidate.remainingMs < slot.remainingMs) slot = candidate;
    }
    if (!slot) return;

    slot.remainingMs = durationMs;
    slot.durationMs = durationMs;
    slot.fade = fade;
    slot.image
      .setPosition(position.x, position.y)
      .setRotation(rotation)
      .setAlpha(1)
      .setVisible(true);
  }

  private stepFx(dtMs: number): void {
    for (const slot of this.fx) {
      if (slot.remainingMs <= 0) continue;
      slot.remainingMs -= dtMs;
      if (slot.remainingMs <= 0) {
        slot.remainingMs = 0;
        slot.image.setVisible(false);
        continue;
      }
      if (slot.fade) slot.image.setAlpha(slot.remainingMs / slot.durationMs);
    }
  }

  private clearAllFx(): void {
    for (const slot of this.fx) {
      slot.remainingMs = 0;
      slot.image.setVisible(false);
    }
  }

  // ------------------------------------------------------------------ internals

  private emitHealth(): void {
    eventBus.emit(GameEvent.PLAYER_HEALTH_CHANGED, {
      current: this.health,
      max: this.maxHealth,
    });
  }

  private cue(id: CombatCueId, position: Readonly<Vector2>): void {
    this.lastCue = id;
    this.hooks.onCue?.(id, position);
  }

  /** Single funnel for the exposure half of the price, so it stays observable. */
  private noise(position: Readonly<Vector2>, radius: number, level: NoiseLevel): void {
    this.lastNoise = `${level} r${radius}`;
    this.hooks.onNoise(position, radius, level);
  }
}
