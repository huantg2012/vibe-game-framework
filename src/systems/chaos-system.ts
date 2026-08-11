/**
 * ChaosSystem - the timer that pressures the player to leave.
 *
 * Chaos rises continuously and spikes on detection or combat. The systems it
 * affects (visibility, speed) never import it - they receive modulation through
 * callbacks the scene wires up, which is what keeps one-way data flow intact
 * (architecture DEC-ARCH-002).
 *
 * The system subscribes to ENEMY_ALERT, ENEMY_DAMAGED and ENEMY_LOST_PLAYER/ENEMY_KILLED
 * for chase tracking. It never imports the AI or combat systems.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';
import { clamp } from '@/utils/math';

// ---------------------------------------------------------------------------
// Pure function: chaos modulators (no class state, importable anywhere)
// ---------------------------------------------------------------------------

export interface ChaosModulators {
  /** Vision radius multiplier (1.0 = full, floor 0.4). */
  readonly radiusScale: number;
  /** Edge corruption intensity [0..1]. */
  readonly edgeCorruption: number;
  /** Full-screen flicker intensity [0..1]. */
  readonly screenFlicker: number;
  /** Player speed multiplier (1.0 = full, floor 0.5). */
  readonly speedMult: number;
}

/**
 * Piecewise-linear modulator curves, evaluated from chaos value.
 * No state - safe to call from anywhere.
 */
export function getChaosModulators(value: number): ChaosModulators {
  const t = clamp(value, 0, 150);

  let radiusScale: number;
  if (t <= 75) radiusScale = 1.0;
  else if (t <= 100) radiusScale = 1.0 - 0.10 * (t - 75) / 25;
  else radiusScale = 0.90 - 0.50 * (t - 100) / 50;

  let edgeCorruption: number;
  if (t < 50) edgeCorruption = 0;
  else if (t <= 100) edgeCorruption = 0.20 + 0.45 * (t - 50) / 50;
  else edgeCorruption = 0.65 + 0.35 * (t - 100) / 50;

  let screenFlicker: number;
  if (t <= 100) screenFlicker = 0;
  else screenFlicker = 0.60 * (t - 100) / 50;

  let speedMult: number;
  if (t <= 75) speedMult = 1.0;
  else if (t <= 100) speedMult = 1.0 - 0.10 * (t - 75) / 25;
  else speedMult = 0.90 - 0.40 * (t - 100) / 50;

  return { radiusScale, edgeCorruption, screenFlicker, speedMult };
}

// ---------------------------------------------------------------------------
// ChaosSystem class
// ---------------------------------------------------------------------------

export interface ChaosSystemAPI {
  update(deltaMs: number): void;
  getValue(): number;
  getRate(): number;
  getStage(): 'safe' | 'warning' | 'danger' | 'overflow';
  getPeak(): number;
  addChaos(source: string, amount: number): void;
  setPaused(paused: boolean): void;
  reset(): void;
  destroy(): void;
}

export interface ChaosSystemConfig {
  /** Called when value moves far enough to warrant a modulator update. */
  onModulate?: (modulators: ChaosModulators) => void;
  /** Multiplier on BASE_RATE from the purification module (CORE effect). Default 1.0. */
  chaosRateModifier?: number;
}

/** Max dt (ms) clamped to prevent background-tab chaos explosions. */
const DT_CLAMP_MS = 100;

export class ChaosSystem implements ChaosSystemAPI {
  private value: number = GAME_CONSTANTS.CHAOS.START_VALUE;
  private peak = 0;
  private paused = false;
  private rateMultiplier = 1.0;
  /** Module-based rate modifier (CORE effect). Applied multiplicatively on BASE_RATE. */
  private readonly chaosRateModifier: number;

  private lastEmitted: number = GAME_CONSTANTS.CHAOS.START_VALUE;
  private lastModulated: number = GAME_CONSTANTS.CHAOS.START_VALUE;

  /** Thresholds already fired (reset on reset()). */
  private thresholdsFired: [boolean, boolean, boolean] = [false, false, false];

  /** Enemies currently chasing; non-empty => rateMultiplier = CHASE_RATE_MULT. */
  private readonly chasingEnemies = new Set<string>();

  /** Per-enemy cooldown map for detection bonus (enemyId => timestamp of last grant). */
  private readonly detectionCooldowns = new Map<string, number>();
  /** Monotonic clock for cooldown tracking. */
  private clockMs = 0;

  private readonly onModulate: ((modulators: ChaosModulators) => void) | null;

  // Stored references for cleanup
  private readonly onEnemyAlert: (payload: { enemyId: string; alertLevel: 'suspicious' | 'alert' | 'chase' }) => void;
  private readonly onEnemyDamaged: (payload: { enemyId: string; amount: number; source?: 'player' }) => void;
  private readonly onEnemyLostPlayer: (payload: { enemyId: string }) => void;
  private readonly onEnemyKilled: (payload: { enemyId: string; position: { x: number; y: number } }) => void;

  constructor(config?: ChaosSystemConfig) {
    this.chaosRateModifier = config?.chaosRateModifier ?? 1.0;
    this.onModulate = config?.onModulate ?? null;

    this.onEnemyAlert = (payload) => {
      const { enemyId, alertLevel } = payload;
      if (alertLevel === 'chase') {
        this.chasingEnemies.add(enemyId);
        this.updateRateMultiplier();
      }
      if (alertLevel === 'alert' || alertLevel === 'chase') {
        this.applyDetectionBonus(enemyId);
      }
    };

    this.onEnemyDamaged = (payload) => {
      if (payload.source === 'player') {
        this.addChaos('combat', GAME_CONSTANTS.CHAOS.COMBAT_BONUS);
      }
    };

    this.onEnemyLostPlayer = (payload) => {
      this.chasingEnemies.delete(payload.enemyId);
      this.updateRateMultiplier();
    };

    this.onEnemyKilled = (payload) => {
      this.chasingEnemies.delete(payload.enemyId);
      this.updateRateMultiplier();
    };

    eventBus.on(GameEvent.ENEMY_ALERT, this.onEnemyAlert);
    eventBus.on(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.on(GameEvent.ENEMY_LOST_PLAYER, this.onEnemyLostPlayer);
    eventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
  }

  // ------------------------------------------------------------------ lifecycle

  update(deltaMs: number): void {
    if (this.paused) return;
    const dtMs = Math.min(deltaMs, DT_CLAMP_MS);
    const dtSec = dtMs / 1000;
    this.clockMs += dtMs;

    // Check temporary rate multiplier expiry
    if (this.tempRateDeadlineMs > 0 && this.clockMs >= this.tempRateDeadlineMs) {
      this.tempRateDeadlineMs = 0;
      this.tempRateMult = 1.0;
      this.updateRateMultiplier();
    }

    const chaos = GAME_CONSTANTS.CHAOS;
    const effectiveRateMult = this.tempRateDeadlineMs > 0
      ? Math.max(this.rateMultiplier, this.tempRateMult)
      : this.rateMultiplier;
    const increment = chaos.BASE_RATE * this.chaosRateModifier * effectiveRateMult * dtSec;
    this.value = Math.min(this.value + increment, chaos.HARD_CAP);
    if (this.value > this.peak) this.peak = this.value;

    this.checkThresholds();
    this.checkEmit();
    this.checkModulate();
  }

  reset(): void {
    this.value = GAME_CONSTANTS.CHAOS.START_VALUE;
    this.peak = 0;
    this.paused = false;
    this.rateMultiplier = 1.0;
    this.tempRateDeadlineMs = 0;
    this.tempRateMult = 1.0;
    this.lastEmitted = GAME_CONSTANTS.CHAOS.START_VALUE;
    this.lastModulated = GAME_CONSTANTS.CHAOS.START_VALUE;
    this.thresholdsFired = [false, false, false];
    this.chasingEnemies.clear();
    this.detectionCooldowns.clear();
    this.clockMs = 0;
  }

  destroy(): void {
    eventBus.off(GameEvent.ENEMY_ALERT, this.onEnemyAlert);
    eventBus.off(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.off(GameEvent.ENEMY_LOST_PLAYER, this.onEnemyLostPlayer);
    eventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
  }

  // ------------------------------------------------------------------ public API

  getValue(): number {
    return this.value;
  }

  getRate(): number {
    return GAME_CONSTANTS.CHAOS.BASE_RATE * this.chaosRateModifier * this.rateMultiplier;
  }

  getStage(): 'safe' | 'warning' | 'danger' | 'overflow' {
    if (this.value < GAME_CONSTANTS.CHAOS.THRESHOLD_1) return 'safe';
    if (this.value < GAME_CONSTANTS.CHAOS.THRESHOLD_2) return 'warning';
    if (this.value < GAME_CONSTANTS.CHAOS.THRESHOLD_3) return 'danger';
    return 'overflow';
  }

  getPeak(): number {
    return this.peak;
  }

  addChaos(source: string, amount: number): void {
    void source; // reserved for analytics
    const chaos = GAME_CONSTANTS.CHAOS;
    this.value = Math.min(this.value + amount, chaos.HARD_CAP);
    if (this.value > this.peak) this.peak = this.value;
    this.checkThresholds();
    this.checkEmit();
    this.checkModulate();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /**
   * Add chaos immediately (e.g. from defense side effects at sortie start).
   * Same as addChaos but with a clearer name for the use case.
   */
  addImmediate(amount: number): void {
    this.addChaos('defense_side_effect', amount);
  }

  /**
   * Set a temporary rate multiplier that decays after a given duration.
   * Used by defense side effects (e.g. delay: chaos rate x2 for 30s).
   */
  setTemporaryRateMult(mult: number, durationMs: number): void {
    this.tempRateDeadlineMs = this.clockMs + durationMs;
    this.tempRateMult = mult;
  }

  private tempRateDeadlineMs = 0;
  private tempRateMult = 1.0;

  // ------------------------------------------------------------------ internal

  private applyDetectionBonus(enemyId: string): void {
    const chaos = GAME_CONSTANTS.CHAOS;
    const lastTime = this.detectionCooldowns.get(enemyId) ?? -Infinity;
    if (this.clockMs - lastTime < chaos.DETECTION_BONUS_COOLDOWN) return;
    this.detectionCooldowns.set(enemyId, this.clockMs);
    this.addChaos('detection', chaos.DETECTION_BONUS);
  }

  private updateRateMultiplier(): void {
    this.rateMultiplier = this.chasingEnemies.size > 0
      ? GAME_CONSTANTS.CHAOS.CHASE_RATE_MULT
      : 1.0;
  }

  private checkThresholds(): void {
    const chaos = GAME_CONSTANTS.CHAOS;
    const thresholds: [number, number, number] = [chaos.THRESHOLD_1, chaos.THRESHOLD_2, chaos.THRESHOLD_3];
    for (let i = 0; i < 3; i++) {
      if (!this.thresholdsFired[i] && this.value >= thresholds[i]!) {
        this.thresholdsFired[i] = true;
        eventBus.emit(GameEvent.CHAOS_THRESHOLD_REACHED, { level: (i + 1) as 1 | 2 | 3 });
      }
    }
  }

  private checkEmit(): void {
    const step = GAME_CONSTANTS.CHAOS.EMIT_STEP;
    if (Math.abs(this.value - this.lastEmitted) >= step) {
      const delta = this.value - this.lastEmitted;
      this.lastEmitted = this.value;
      eventBus.emit(GameEvent.CHAOS_CHANGED, {
        value: this.value,
        delta,
        max: GAME_CONSTANTS.CHAOS.MAX_VALUE,
        rate: this.getRate(),
      });
    }
  }

  private checkModulate(): void {
    const step = GAME_CONSTANTS.CHAOS.MODULATOR_STEP;
    if (Math.abs(this.value - this.lastModulated) >= step) {
      this.lastModulated = this.value;
      this.onModulate?.(getChaosModulators(this.value));
    }
  }
}
