/** Shared crowbar swing authority. Bodies and host cores consume one damage sample,
 * one swept arc and one target budget. AI, chaos and movement remain separately owned. */

import Phaser from 'phaser';
import { WEAPON_DATA, WEAPON_ATTACK_PROFILES } from '@/generated/weapon-data';
import type { CrowbarQuality, CrowbarVariant } from '@/art/crowbar-pixels';
import { swingDamage, swingContactProgress, type MeleeTarget, type WeaponAttackPose } from '@/systems/weapon-swing';
import type { FormAttackPose, FormFlashSource } from '@/entities/form-renderers/form-renderer';
import { GAME_CONSTANTS } from '@/config/constants';
import { BODY_PROFILE_DATA, type ContaminationBodyProfile } from '@/generated/contamination-body-data';
import { eventBus } from '@/core/event-bus';
import { INFILTRATOR_TEXTURE } from '@/entities/infiltrator-sprite';
import {
  REWRITER_CANVAS_H,
  REWRITER_CANVAS_W,
  REWRITER_ORIGIN_X,
  REWRITER_ORIGIN_Y,
  rewriterTextureFor,
} from '@/entities/rewriter-sprite';
import type { EnemyView } from '@/types/ai-types';
import { GameEvent } from '@/types/events';
import { AIState, type Vector2 } from '@/types/game-types';
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
  /** Actual model texture, copied synchronously before entity destruction. */
  captureEnemyVisual?(enemyId: string): FormFlashSource | undefined;
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
  setWeaponVisual?(quality: CrowbarQuality | null, variant?: CrowbarVariant): void;
  setWeaponAttackPose?(pose: Readonly<WeaponAttackPose>): void;
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
  getEnemyAttackVisualState(enemyId: string): FormAttackPose;
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

const LEGACY_BODY_PROFILE: ContaminationBodyProfile = {
  moveScale: 1,
  windupMs: GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_WINDUP_MS,
  cooldownMs: GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_COOLDOWN_MS,
  rangePx: GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_RANGE,
  halfAngleDeg: GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_HALF_ANGLE,
};

/** A single lookup feeds attack eligibility, execution, animation and ground warning. */
function bodyProfileFor(state: EnemyCombatState): ContaminationBodyProfile {
  const form = state.view?.getForm?.();
  return (form && BODY_PROFILE_DATA[form.substrate]) ?? LEGACY_BODY_PROFILE;
}

/** One pooled white flash. Death effects outlive the enemy entity, hence the pool. */
let flashPoolSerial = 0;

interface FxSlot {
  readonly texture: Phaser.Textures.CanvasTexture;
  readonly image: Phaser.GameObjects.Image;
  remainingMs: number;
  durationMs: number;
  fade: boolean;
}

export class CombatSystem implements CombatSystemAPI {
  private scene!: Phaser.Scene;
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
  private weaponId: string | null = 'crowbar_plain';
  private runSeed = 0;
  private attackSequence = 0;
  private damageThisSwing = 0;
  private bufferedMs = 0;
  private contactRemainingMs = 0;
  private contactElapsedMs = 0;
  private readonly hitHosts = new Set<string>();
  private readonly externalTargets = new Set<{ collectMeleeTargets(out: MeleeTarget[]): void }>();
  private readonly meleeTargets: MeleeTarget[] = [];
  private readonly bodyTargets = new Map<string, MeleeTarget>();
  private readonly candidates: { target: MeleeTarget; progress: number; distance: number }[] = [];
  private candidateCount = 0;
  private readonly weaponPose: WeaponAttackPose = {
    phase: 'idle', elapsedMs: 0, facing: 0, windupMs: 120, activeMs: 60,
    recoveryMs: 220, contactHoldMs: 24, contactRemainingMs: 0,
  };
  private swingNoiseSent = false;
  private hitNoiseSent = false;

  private readonly enemies = new Map<string, EnemyCombatState>();
  private attackTokensInUse = 0;

  /** Returned by reference from `getAttackState()`; mutated in place, never reallocated. */
  private readonly attackStateView = { phase: 'idle' as AttackPhase, cooldownRemainingMs: 0 };
  private lastCue = '-';
  private lastNoise = '-';
  private godMode = false;

  // ------------------------------------------------------------------ lifecycle

  create(
    scene: Phaser.Scene,
    occluders: OccluderGrid,
    player: PlayerCombatTarget,
    ai: AISystemReadView,
    hooks: CombatHooks
  ): void {
    this.scene = scene;
    this.occluders = occluders;
    this.player = player;
    this.ai = ai;
    this.hooks = hooks;

    // Reset all combat state (critical for scene re-entry via scene.start)
    this.enabled = true;
    this.dead = false;
    this.godMode = false;
    this.health = this.maxHealth;
    this.invulnRemainingMs = 0;
    this.flashRemainingMs = 0;
    this.cooldownRemainingMs = 0;
    this.phase = 'idle';
    this.swingElapsedMs = 0;
    this.attackSequence = 0;
    this.bufferedMs = 0;
    this.bodyTargets.clear();
    this.externalTargets.clear();
    this.attackTokensInUse = 0;
    this.enemies.clear();
    this.hitSet.clear();

    this.graphics = scene.add.graphics().setDepth(COMBAT_FX_DEPTH);
    for (let i = 0; i < GAME_CONSTANTS.COMBAT.FX_POOL_SIZE; i++) {
      const texture = scene.textures.createCanvas(`combat-flash-${flashPoolSerial++}`, 1, 1);
      if (!texture) throw new Error('Could not allocate combat flash texture');
      const image = scene.add
        .image(0, 0, texture.key)
        .setDepth(COMBAT_FX_DEPTH)
        .setVisible(false);
      image.setTintFill(GAME_CONSTANTS.COMBAT.FX_COLOR);
      this.fx.push({ image, texture, remainingMs: 0, durationMs: 0, fade: false });
    }

    this.syncRoster();
    this.configureWeapon(this.weaponId);
    this.emitHealth();
  }

  destroy(): void {
    this.clearAttackBuffer();
    this.cancelSwing();
    this.clearAllWindups();
    this.enemies.clear();
    this.hitSet.clear();

    for (const slot of this.fx) {
      slot.image.destroy();
      this.scene.textures.remove(slot.texture.key);
    }
    this.fx.length = 0;
    this.graphics?.destroy();
    this.externalTargets.clear();
    this.bodyTargets.clear();
    this.meleeTargets.length = 0;
    this.candidates.length = 0;
    this.hitHosts.clear();
    this.player?.setWeaponVisual?.(null);
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
    this.clearAttackBuffer();
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
    this.clearAttackBuffer();
    this.cancelSwing();
    this.clearAllWindups();

    this.enemies.clear();
    this.bodyTargets.clear();
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

  /** Equipment may change only between attacks; accepted swings own their damage snapshot. */
  configureWeapon(weaponDefId: string | null, runSeed?: number): void {
    if (weaponDefId !== null && !WEAPON_DATA[weaponDefId]) throw new Error(`Unknown weapon: ${weaponDefId}`);
    this.weaponId = weaponDefId;
    if (runSeed !== undefined && runSeed !== this.runSeed) {
      this.runSeed = runSeed;
      this.attackSequence = 0;
    }
    if (this.phase === 'idle') this.syncEquippedVisual();
  }

  private syncEquippedVisual(): void {
    const weapon = this.weaponId ? WEAPON_DATA[this.weaponId] : undefined;
    this.player?.setWeaponVisual?.(weapon?.quality ?? null, weapon?.variant ?? 'standard');
  }

  registerMeleeTargets(provider: { collectMeleeTargets(out: MeleeTarget[]): void }): void {
    this.externalTargets.add(provider);
  }

  unregisterMeleeTargets(provider: { collectMeleeTargets(out: MeleeTarget[]): void }): void {
    this.externalTargets.delete(provider);
  }

  clearAttackBuffer(): void { this.bufferedMs = 0; }

  requestPlayerAttack(): void {
    if (!this.enabled || this.dead || this.weaponId === null) return;
    if (this.cooldownRemainingMs > 0 || this.phase !== 'idle') {
      if (this.cooldownRemainingMs <= 100) this.bufferedMs = 100;
      return;
    }
    this.beginSwing();
  }

  private beginSwing(): void {
    const weapon = this.weaponId ? WEAPON_DATA[this.weaponId] : undefined;
    if (!weapon) return;
    const profile = WEAPON_ATTACK_PROFILES.crowbar!;
    this.attackAngle = this.player.getFacingAngle();
    this.damageThisSwing = swingDamage(this.runSeed, ++this.attackSequence, weapon.damageMin, weapon.damageMax);
    this.phase = 'windup';
    this.swingElapsedMs = 0;
    this.cooldownRemainingMs = profile.minIntervalMs;
    this.bufferedMs = 0;
    this.hitSet.clear();
    this.hitHosts.clear();
    this.swingNoiseSent = false;
    this.hitNoiseSent = false;
    this.player.setSpeedModifier(SLOW_SOURCE, GAME_CONSTANTS.COMBAT.ATTACK_SELF_SLOW);
    this.cue('combat.cue.swing', this.player.getPosition());
    this.syncWeaponPose();
  }

  getSwingSnapshot(): Readonly<{ sequence: number; damage: number; runSeed: number }> {
    return { sequence: this.attackSequence, damage: this.damageThisSwing, runSeed: this.runSeed };
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

  /** Practice-field only: attacks still wind up, player health never drops. */
  setGodMode(enabled: boolean): void {
    this.godMode = enabled;
  }

  isInvulnerable(): boolean {
    return this.godMode || this.invulnRemainingMs > 0;
  }

  /** Call after AI spawn/despawn outside create/reset so melee roster stays in step. */
  noteRosterChanged(): void {
    this.syncRoster();
  }

  getAttackState(): Readonly<{ phase: AttackPhase; cooldownRemainingMs: number }> {
    this.attackStateView.phase = this.phase;
    this.attackStateView.cooldownRemainingMs = this.cooldownRemainingMs;
    return this.attackStateView;
  }

  getLockedAttackAngle(): number {
    return this.attackAngle;
  }

  getEnemyAttackVisualState(enemyId: string): FormAttackPose {
    const state = this.enemies.get(enemyId);
    if (!this.enabled || !state) return { phase: 'idle', progress: 0 };
    const profile = bodyProfileFor(state);
    if (state.attackPhase === 'windup') return {
      phase: 'windup', progress: clamp(state.attackTimerMs / profile.windupMs, 0, 1),
      facingAngle: state.attackAngle,
    };
    if (state.attackPhase === 'cooldown') {
      const elapsed = profile.cooldownMs - state.cooldownRemainingMs;
      // These windows animate an already-resolved hit; damage/cooldown are unchanged.
      if (elapsed < 80) return { phase: 'strike', progress: elapsed / 80, facingAngle: state.attackAngle };
      if (elapsed < 320) return { phase: 'recover', progress: (elapsed - 80) / 240, facingAngle: state.attackAngle };
    }
    return { phase: 'idle', progress: 0 };
  }

  getEnemyHealth(enemyId: string): number | undefined {
    return this.enemies.get(enemyId)?.health;
  }

  isEnemyAlive(enemyId: string): boolean {
    return this.enemies.get(enemyId)?.alive === true;
  }

  /**
   * Adjacent-strike / environmental hits from contamination hosts (DEC-076).
   * Same invulnerability and death path as a melee enemy; source is the host id.
   */
  applyHazardHit(sourceId: string, amount: number): boolean {
    if (!this.enabled || this.dead || amount <= 0) return false;
    if (this.isInvulnerable()) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnRemainingMs = GAME_CONSTANTS.COMBAT.PLAYER_IFRAME_MS;
    this.flashRemainingMs = GAME_CONSTANTS.COMBAT.PLAYER_HIT_FLASH_MS;
    this.cue('combat.cue.playerHurt', this.player.getPosition());
    eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount, source: sourceId });
    this.emitHealth();
    if (this.health <= 0) this.killPlayer();
    return true;
  }

  applyToolDamage(enemyId: string, amount: number): boolean {
    if (!this.enabled || amount <= 0) return false;
    const state = this.enemies.get(enemyId);
    if (!state || !state.alive) return false;

    state.health -= amount;
    const pos = state.view.getPosition();
    this.spawnFx(pos, state.view, GAME_CONSTANTS.COMBAT.ENEMY_HIT_FLASH_MS, false);

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
    // Split exactly at a queued legal start; a long frame never adds input latency.
    let remaining = dtMs;
    do {
      const queued = this.bufferedMs > 0 && this.cooldownRemainingMs <= this.bufferedMs;
      const step = queued ? Math.min(remaining, this.cooldownRemainingMs) : remaining;
      const previous = this.swingElapsedMs;
      const p = WEAPON_ATTACK_PROFILES.crowbar!;
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - step);
      this.contactRemainingMs = Math.max(0, this.contactRemainingMs - step);
      if (this.phase !== 'idle') {
        this.swingElapsedMs += step;
        const start = p.windupMs, end = start + p.activeMs;
        if (this.swingElapsedMs >= start && previous < end) {
          this.resolveSwing(Math.max(0, (previous - start) / p.activeMs), Math.min(1, (this.swingElapsedMs - start) / p.activeMs));
        }
        this.phase = this.swingElapsedMs < start ? 'windup' : this.swingElapsedMs < end ? 'active' : 'recovery';
        if (this.swingElapsedMs >= end + p.recoveryMs) this.cancelSwing();
      }
      remaining -= step;
      if (queued && this.cooldownRemainingMs === 0 && this.phase === 'idle') this.beginSwing();
      else this.bufferedMs = Math.max(0, this.bufferedMs - step);
      if (step === 0 && remaining > 0 && this.cooldownRemainingMs === 0) break;
    } while (remaining > 0);
    this.syncWeaponPose();
  }

  private syncWeaponPose(): void {
    const p = WEAPON_ATTACK_PROFILES.crowbar!;
    const pose = this.weaponPose;
    pose.phase = this.phase; pose.elapsedMs = this.swingElapsedMs; pose.facing = this.attackAngle;
    pose.windupMs = p.windupMs; pose.activeMs = p.activeMs; pose.recoveryMs = p.recoveryMs;
    pose.contactHoldMs = p.contactHoldMs; pose.contactRemainingMs = this.contactRemainingMs;
    pose.contactElapsedMs = this.contactElapsedMs;
    this.player?.setWeaponAttackPose?.(pose);
  }

  private resolveSwing(fromProgress: number, toProgress: number): void {
    const p = WEAPON_ATTACK_PROFILES.crowbar!;
    const origin = this.attackOrigin;
    const playerPos = this.player.getPosition();
    origin.x = playerPos.x; origin.y = playerPos.y;
    if (!this.swingNoiseSent) {
      this.swingNoiseSent = true;
      this.noise(origin, p.noiseWhiffPx, 'suspicious');
    }
    if (this.hitSet.size >= p.targetLimit) return;
    this.meleeTargets.length = 0;
    for (const target of this.bodyTargets.values()) this.meleeTargets.push(target);
    for (const provider of this.externalTargets) provider.collectMeleeTargets(this.meleeTargets);
    this.candidateCount = 0;
    for (const target of this.meleeTargets) {
      if (!target.isAlive() || this.hitSet.has(target.id) || (target.hostId && this.hitHosts.has(target.hostId)) || target.canHit?.() === false) continue;
      const pos = target.getPosition();
      const dx = pos.x - origin.x, dy = pos.y - origin.y;
      const progress = swingContactProgress(dx, dy, this.attackAngle, p.reachPx, degToRad(p.arcDeg));
      if (progress === null || progress + 1e-9 < fromProgress || progress - 1e-9 > toProgress) continue;
      if (!hasLineOfSight(this.occluders, origin, pos)) continue;
      const index = this.candidateCount++;
      const candidate = this.candidates[index] ?? (this.candidates[index] = { target, progress: 0, distance: 0 });
      candidate.target = target; candidate.progress = progress; candidate.distance = dx * dx + dy * dy;
    }
    // Selection sort only the two budgeted contacts; stable ID resolves exact ties.
    for (let i = 0; i < this.candidateCount && this.hitSet.size < p.targetLimit; i++) {
      let first = i;
      for (let j = i + 1; j < this.candidateCount; j++) {
        const a = this.candidates[j]!, b = this.candidates[first]!;
        if (a.progress < b.progress || (a.progress === b.progress && (a.distance < b.distance || (a.distance === b.distance && a.target.id < b.target.id)))) first = j;
      }
      const selected = this.candidates[first]!;
      this.candidates[first] = this.candidates[i]!; this.candidates[i] = selected;
      const target = selected.target;
      if (!target.isAlive() || (target.hostId && this.hitHosts.has(target.hostId))) continue;
      this.hitSet.add(target.id);
      if (target.hostId) this.hitHosts.add(target.hostId);
      const pos = target.getPosition();
      this.deathPos.x = pos.x; this.deathPos.y = pos.y;
      target.applyHit(this.damageThisSwing);
      this.contactRemainingMs = p.contactHoldMs;
      this.contactElapsedMs = p.windupMs + selected.progress * p.activeMs;
      this.cue('combat.cue.hit', this.deathPos);
      if (!this.hitNoiseSent) { this.hitNoiseSent = true; this.noise(this.deathPos, p.noiseHitPx, 'alert'); }
      if (target.hostId && !target.isAlive()) {
        this.noise(this.deathPos, p.noiseKillPx, 'alert');
        this.cue('combat.cue.enemyDeath', this.deathPos);
      }
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

    state.health -= this.damageThisSwing;
    // The flash is a pooled sprite rather than state on the enemy: the death version has
    // to outlive the entity, so one mechanism owns both and there is nothing write-only.
    this.spawnFx(enemyPos, state.view, combat.ENEMY_HIT_FLASH_MS, false);
    eventBus.emit(GameEvent.ENEMY_DAMAGED, {
      enemyId: state.id,
      amount: this.damageThisSwing,
      source: 'player',
    });

    if (state.health <= 0) this.killEnemy(state, enemyPos);
  }

  /** Remove combat eligibility immediately; death residue and drops follow the event. */
  private killEnemy(state: EnemyCombatState, enemyPos: Readonly<Vector2>): void {
    const combat = GAME_CONSTANTS.COMBAT;

    state.alive = false;
    state.health = 0;
    if (state.attackPhase === 'windup') this.releaseToken();
    state.view.setAttackCommitted?.(false);
    state.attackPhase = 'idle';
    state.attackTimerMs = 0;
    state.strikeFxFrames = 0;

    // Copied before the entity goes away: `despawn` lands inside the emit below.
    // Copy while the form renderer and its dynamic texture are still alive.
    this.spawnFx(enemyPos, state.view, combat.ENEMY_DEATH_FX_MS, true);
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

  }

  /** Ends a swing from any cause and always releases the slow. */
  private cancelSwing(): void {
    this.contactRemainingMs = 0;
    this.phase = 'idle';
    this.swingElapsedMs = 0;
    this.hitSet.clear();
    this.player?.clearSpeedModifier(SLOW_SOURCE);
    this.syncEquippedVisual();
    this.syncWeaponPose();
  }

  // ------------------------------------------------------------------ enemy attack

  private updateEnemies(dtMs: number): void {
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
        if (state.attackTimerMs >= bodyProfileFor(state).windupMs) {
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
    const profile = bodyProfileFor(state);
    if (this.dead) return false;
    if (state.view.isAttackAvailable?.() === false) return false;
    if (state.cooldownRemainingMs > 0) return false;
    if (state.engagedSinceMs < combat.ENEMY_FIRST_ATTACK_DELAY_MS) return false;
    if (this.attackTokensInUse >= combat.ENEMY_ATTACK_TOKENS) return false;

    const enemyPos = state.view.getPosition();
    const deltaX = playerPos.x - enemyPos.x;
    const deltaY = playerPos.y - enemyPos.y;
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > profile.rangePx) return false;

    const bearing = Math.atan2(deltaY, deltaX);
    const facingOffset = Math.abs(shortestArc(bearing - state.view.getFacingAngle()));
    if (facingOffset > degToRad(profile.halfAngleDeg)) return false;

    return hasLineOfSight(this.occluders, enemyPos, playerPos);
  }

  private startEnemyWindup(state: EnemyCombatState, playerPos: Readonly<Vector2>): void {
    const enemyPos = state.view.getPosition();
    state.attackPhase = 'windup';
    state.view.setAttackCommitted?.(true);
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
    const profile = bodyProfileFor(state);

    this.releaseToken();
    state.view.setAttackCommitted?.(false);
    state.attackPhase = 'cooldown';
    state.attackTimerMs = 0;
    state.cooldownRemainingMs = profile.cooldownMs;
    state.strikeFxFrames = 1;

    if (this.dead) return;

    const enemyPos = state.view.getPosition();
    const deltaX = playerPos.x - enemyPos.x;
    const deltaY = playerPos.y - enemyPos.y;
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > profile.rangePx) return;

    const bearing = Math.atan2(deltaY, deltaX);
    if (Math.abs(shortestArc(bearing - state.attackAngle)) > degToRad(profile.halfAngleDeg)) {
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
      state.view?.setAttackCommitted?.(false);
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
      this.bodyTargets.set(id, {
        id: `body:${id}`,
        getPosition: () => view.getPosition(),
        isAlive: () => this.enemies.get(id)?.alive === true,
        applyHit: () => { const state = this.enemies.get(id); if (state?.alive) this.applyPlayerHit(state, view.getPosition()); },
      });
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
      if (!this.ai.getEnemyById(id)) { this.enemies.delete(id); this.bodyTargets.delete(id); }
    }
  }

  // ------------------------------------------------------------------ presentation

  /** World feedback stays under darkness. The held weapon supplies the swing silhouette;
   * only enemy telegraphs and brief contact marks belong in this shared effects layer. */
  private drawVisuals(): void {
    const combat = GAME_CONSTANTS.COMBAT;
    const graphics = this.graphics;
    graphics.clear();

    if (this.flashRemainingMs > 0) {
      // White rect over the body. Kept as a growing square (not a sprite tint) so the
      // flash still reads when the dense player is dark grey. Provisional.
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
      const progress = clamp(state.attackTimerMs / bodyProfileFor(state).windupMs, 0, 1);
      this.drawTelegraph(state, lerp(0.2, 0.8, progress));
    }
  }

  /** Short ground scratches show the committed reach and both actual angular limits. */
  private drawTelegraph(state: EnemyCombatState, alpha: number): void {
    const combat = GAME_CONSTANTS.COMBAT;
    const profile = bodyProfileFor(state);
    const position = state.view.getPosition();
    this.graphics.lineStyle(1, combat.FX_COLOR, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(position.x, position.y);
    this.graphics.lineTo(
      position.x + Math.cos(state.attackAngle) * profile.rangePx,
      position.y + Math.sin(state.attackAngle) * profile.rangePx
    );
    this.graphics.strokePath();
    for (let side = -1; side <= 1; side += 2) {
      const angle = state.attackAngle + side * degToRad(profile.halfAngleDeg);
      const start = Math.max(0, profile.rangePx - 6);
      this.graphics.beginPath();
      this.graphics.moveTo(position.x + Math.cos(angle) * start, position.y + Math.sin(angle) * start);
      this.graphics.lineTo(position.x + Math.cos(angle) * profile.rangePx, position.y + Math.sin(angle) * profile.rangePx);
      this.graphics.strokePath();
    }
  }

  /** Takes a free pooled flash, or steals the one closest to finishing. */
  private spawnFx(
    position: Readonly<Vector2>,
    source: EnemyView | EnemyFlashCopy,
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

    const flash = 'textureKey' in source ? source
      : this.hooks.captureEnemyVisual?.(source.getId()) ?? captureEnemyFlash(source);
    const frame = this.scene.textures.getFrame(flash.textureKey);
    if (!frame) return;
    // Pool-owned pixel copies survive renderer destruction and future animated frames.
    slot.texture.setSize(frame.cutWidth, frame.cutHeight);
    const ctx = slot.texture.getContext();
    ctx.clearRect(0, 0, frame.cutWidth, frame.cutHeight);
    ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY,
      frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
    if (!fade) {
      // A short contact patch follows the material's existing pixels, not a full-body white flash.
      const player = this.player.getPosition();
      const direction = Math.atan2(player.y - position.y, player.x - position.x);
      const w = Math.max(4, Math.floor(frame.cutWidth * .4));
      const h = Math.max(4, Math.floor(frame.cutHeight * .45));
      const cx = frame.cutWidth * flash.originX + Math.cos(direction) * frame.cutWidth * .2;
      const cy = frame.cutHeight * flash.originY + Math.sin(direction) * frame.cutHeight * .2;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    slot.texture.refresh();
    slot.remainingMs = durationMs;
    slot.durationMs = durationMs;
    slot.fade = true;
    if (fade) slot.image.clearTint();
    else slot.image.setTintFill(0x9f8a6b);
    slot.image
      .setTexture(slot.texture.key)
      .setScale(flash.scaleX ?? 1, flash.scaleY ?? 1)
      .setOrigin(flash.originX, flash.originY)
      .setPosition(position.x, position.y)
      .setRotation(0)
      .setAlpha(fade ? .8 : .65)
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
      if (slot.fade) slot.image.setAlpha(.65 * slot.remainingMs / slot.durationMs);
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

interface EnemyFlashCopy extends FormFlashSource {
  readonly textureKey: string;
  readonly originX: number;
  readonly originY: number;
}

function captureEnemyFlash(view: EnemyView): EnemyFlashCopy {
  const rewriter = view.getRole() === 'rewriter';
  return {
    textureKey: rewriter
      ? rewriterTextureFor(view.getFacing4(), rewriterFlashVariant(view.getState()))
      : INFILTRATOR_TEXTURE[view.getFacing4()],
    originX: rewriter ? REWRITER_ORIGIN_X / REWRITER_CANVAS_W : 0.5,
    originY: rewriter ? REWRITER_ORIGIN_Y / REWRITER_CANVAS_H : 0.5,
  };
}

function rewriterFlashVariant(
  state: AIState
): 'patrol' | 'suspicious' | 'search' | 'chase' {
  if (state === AIState.CHASE) return 'chase';
  if (state === AIState.ALERT) return 'search';
  if (state === AIState.SUSPICIOUS) return 'suspicious';
  return 'patrol';
}
