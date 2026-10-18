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
import { POLLUTION_GRADE_DEFINITIONS } from '@/generated/rift-pollution-grade-data';
import { isPollutionGrade, isPollutionGradeDefinition, pollutionExposureBetween, pollutionRateAt, type PollutionGrade, type PollutionGradeDefinition } from '@/generation/world-study/pollution-grade';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';
import { clamp } from '@/utils/math';
import { sumPollutionResistance } from '@/systems/survival-attributes';
import { runtimeNumber, runtimeRecord, runtimeStrings } from '@/systems/ai/runtime-validation';
import { assimilationPerMinute, getAssimilationModulators, POLLUTION_SATURATION } from '@/systems/assimilation-system';

export type AssimilationMode = 'persistent-v1';

/** Simulation time only: wall-clock time never advances a suspended expedition. */
export interface ChaosRuntimeState {
  readonly version: 1;
  readonly value: number;
  readonly peak: number;
  readonly paused: boolean;
  readonly clockMs: number;
  readonly chaosRateModifier: number;
  /** Absent on every historical/ungraded run. Explicit grade is resume identity. */
  readonly pollutionGrade?: PollutionGrade;
  readonly lastEmitted: number;
  readonly lastModulated: number;
  readonly thresholdsFired: readonly [boolean, boolean, boolean];
  readonly chasingEnemyIds: readonly string[];
  readonly detectionCooldowns: readonly { readonly enemyId: string; readonly atMs: number }[];
  readonly tempRateDeadlineMs: number;
  readonly tempRateMult: number;
  readonly reductionDeadlineMs: number;
  readonly reductionMult: number;
  /** Missing means the frozen historical 0–150 pressure rules. */
  readonly assimilationMode?: AssimilationMode;
  readonly assimilationValue?: number;
  readonly growthResistance?: number;
}

export function validateChaosRuntimeState(value: unknown): value is ChaosRuntimeState {
  if (!runtimeRecord(value) || value.version !== 1 || typeof value.paused !== 'boolean'
    || (value.assimilationMode !== undefined && value.assimilationMode !== 'persistent-v1')
    || (value.assimilationMode === undefined
      ? value.assimilationValue !== undefined || value.growthResistance !== undefined
      : !runtimeNumber(value.assimilationValue, 0, 100) || !runtimeNumber(value.growthResistance, 0, 1)
        || !runtimeNumber(value.value, 0, POLLUTION_SATURATION) || !runtimeNumber(value.peak, 0, POLLUTION_SATURATION))
    || (value.pollutionGrade !== undefined && !isPollutionGrade(value.pollutionGrade))
    || !runtimeNumber(value.value, 0, GAME_CONSTANTS.CHAOS.HARD_CAP)
    || !runtimeNumber(value.peak, value.value, GAME_CONSTANTS.CHAOS.HARD_CAP)
    || !runtimeNumber(value.clockMs, 0) || !runtimeNumber(value.chaosRateModifier, 0)
    || !runtimeNumber(value.lastEmitted, 0, value.peak) || !runtimeNumber(value.lastModulated, 0, value.peak)
    || !Array.isArray(value.thresholdsFired) || value.thresholdsFired.length !== 3
    || !value.thresholdsFired.every(flag => typeof flag === 'boolean')
    || !runtimeStrings(value.chasingEnemyIds, 2048) || !Array.isArray(value.detectionCooldowns)
    || value.detectionCooldowns.length > 2048
    || !runtimeNumber(value.tempRateDeadlineMs, 0) || !runtimeNumber(value.tempRateMult, 0)
    || !runtimeNumber(value.reductionDeadlineMs, 0) || !runtimeNumber(value.reductionMult, 0)) return false;
  const ids = new Set<string>();
  return value.detectionCooldowns.every(entry => {
    if (!runtimeRecord(entry) || typeof entry.enemyId !== 'string' || !entry.enemyId
      || ids.has(entry.enemyId) || !runtimeNumber(entry.atMs, 0, value.clockMs as number)) return false;
    ids.add(entry.enemyId);
    return true;
  });
}

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
  // Overflow band steepens: vision/speed hit their floors by 130, not 150, so the
  // first moments past the 100 gate already feel like a new gear. Flicker/corruption
  // keep ramping through 150 so the overlay still has somewhere to go.
  const over = Math.max(0, t - 100);
  const overToFloor = Math.min(1, over / 30); // 1 at 130
  const overToCap = Math.min(1, over / 50);   // 1 at 150
  const overToEdge = Math.min(1, over / 40);  // 1 at 140

  let radiusScale: number;
  if (t <= 75) radiusScale = 1.0;
  else if (t <= 100) radiusScale = 1.0 - 0.10 * (t - 75) / 25;
  else radiusScale = 0.90 - 0.50 * overToFloor;

  let edgeCorruption: number;
  if (t < 50) edgeCorruption = 0;
  else if (t <= 100) edgeCorruption = 0.20 + 0.45 * (t - 50) / 50;
  else edgeCorruption = 0.65 + 0.35 * overToEdge;

  const screenFlicker = t <= 100 ? 0 : overToCap;

  let speedMult: number;
  if (t <= 75) speedMult = 1.0;
  else if (t <= 100) speedMult = 1.0 - 0.10 * (t - 75) / 25;
  else speedMult = 0.90 - 0.40 * overToFloor;

  return { radiusScale, edgeCorruption, screenFlicker, speedMult };
}

// ---------------------------------------------------------------------------
// ChaosSystem class
// ---------------------------------------------------------------------------

export interface ChaosSystemAPI {
  exportRuntimeState(): ChaosRuntimeState;
  validateRuntimeState(value: unknown): value is ChaosRuntimeState;
  restoreRuntimeState(value: unknown): void;
  update(deltaMs: number): void;
  getValue(): number;
  getRate(): number;
  getStage(): 'safe' | 'warning' | 'danger' | 'overflow';
  getPeak(): number;
  addChaos(source: string, amount: number): void;
  setPaused(paused: boolean): void;
  reset(startingValue?: number): void;
  destroy(): void;
}

export interface ChaosSystemConfig {
  assimilationMode?: AssimilationMode;
  /** Long-lived physiology belongs to GameState and the enclosing atomic save. */
  getAssimilation?: () => number;
  setAssimilation?: (value: number) => void;
  growthResistance?: number;
  /** Explicit authored grade only; omitted preserves the historical constant rate. */
  pollutionGrade?: PollutionGrade;
  /** Frozen departure rules; future catalog balancing must not rewrite an active run. */
  pollutionDefinition?: PollutionGradeDefinition;
  isEnemyTargetingLure?: (enemyId: string) => boolean;
  /** Effective equipped resistance; evaluated on positive inflow only. */
  getPollutionResistance?: () => number;
  /** Called when value moves far enough to warrant a modulator update. */
  onModulate?: (modulators: ChaosModulators) => void;
  /** Multiplier on BASE_RATE from the purification module (CORE effect). Default 1.0. */
  chaosRateModifier?: number;
  /**
   * Sortie opening value (purifier startingChaos + Σ initial_chaos, already clamped).
   * Thresholds already crossed at this value are marked fired without emitting.
   */
  startingValue?: number;
}

/** Max dt (ms) clamped to prevent background-tab chaos explosions. */
const DT_CLAMP_MS = 100;

export class ChaosSystem implements ChaosSystemAPI {
  private readonly assimilationMode: AssimilationMode | undefined;
  private readonly getAssimilation: () => number;
  private readonly setAssimilation: (value: number) => void;
  private readonly growthResistance: number;
  private lastAssimilationModulated = 0;
  private readonly pollutionDefinition: PollutionGradeDefinition | null;
  private readonly getPollutionResistance: () => number;
  private value = 0;
  private peak = 0;
  private paused = false;
  private rateMultiplier = 1.0;
  /** Module-based rate modifier (CORE effect). Applied multiplicatively on BASE_RATE. */
  private readonly chaosRateModifier: number;

  private lastEmitted = 0;
  private lastModulated = 0;

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
  private readonly onEnemyDamaged: (payload: { enemyId: string; amount: number; source?: 'player' | 'tool' }) => void;
  private readonly onEnemyLostPlayer: (payload: { enemyId: string }) => void;
  private readonly onEnemyKilled: (payload: { enemyId: string; position: { x: number; y: number } }) => void;

  constructor(config?: ChaosSystemConfig) {
    this.assimilationMode = config?.assimilationMode;
    if (this.assimilationMode && (!config?.getAssimilation || !config.setAssimilation)) {
      throw new Error('Persistent assimilation requires its durable state owner');
    }
    this.getAssimilation = config?.getAssimilation ?? (() => 0);
    this.setAssimilation = config?.setAssimilation ?? (() => {});
    this.growthResistance = config?.growthResistance ?? 0;
    if (!runtimeNumber(this.growthResistance, 0, 1)) throw new Error('Invalid growth resistance');
    if (config?.pollutionDefinition && (!isPollutionGradeDefinition(config.pollutionDefinition)
      || config.pollutionDefinition.id !== config.pollutionGrade)) throw new Error('Incompatible frozen pollution rules');
    this.pollutionDefinition = config?.pollutionDefinition ? structuredClone(config.pollutionDefinition)
      : config?.pollutionGrade === undefined ? null
      : POLLUTION_GRADE_DEFINITIONS.find(definition => definition.id === config.pollutionGrade) ?? null;
    if (config?.pollutionGrade !== undefined && !this.pollutionDefinition) throw new Error('Unsupported map pollution grade');
    this.getPollutionResistance = config?.getPollutionResistance ?? (() => 0);
    this.chaosRateModifier = config?.chaosRateModifier ?? 1.0;
    this.onModulate = config?.onModulate ?? null;
    this.applyOpeningValue(config?.startingValue);

    this.onEnemyAlert = (payload) => {
      const { enemyId, alertLevel } = payload;
      if (config?.isEnemyTargetingLure?.(enemyId)) return;
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
    const dtMs = Math.max(0, Math.min(deltaMs, DT_CLAMP_MS));
    const dtSec = dtMs / 1000;
    this.clockMs += dtMs;

    // Check temporary rate multiplier expiry
    if (this.tempRateDeadlineMs > 0 && this.clockMs >= this.tempRateDeadlineMs) {
      this.tempRateDeadlineMs = 0;
      this.tempRateMult = 1.0;
      this.updateRateMultiplier();
    }
    if (this.reductionDeadlineMs > 0 && this.clockMs >= this.reductionDeadlineMs) {
      this.reductionDeadlineMs = 0;
      this.reductionMult = 1.0;
    }

    const chaos = GAME_CONSTANTS.CHAOS;
    const effectiveRateMult = this.tempRateDeadlineMs > 0
      ? Math.max(this.rateMultiplier, this.tempRateMult)
      : this.rateMultiplier;
    const exposure = this.pollutionDefinition
      ? pollutionExposureBetween(this.pollutionDefinition, (this.clockMs - dtMs) / 1000, this.clockMs / 1000)
      : chaos.BASE_RATE * dtSec;
    const inflowMultiplier = this.chaosRateModifier * effectiveRateMult * this.reductionMult * this.resistanceFactor();
    const increment = exposure * inflowMultiplier;
    if (this.assimilationMode) {
      let saturatedMs = this.value >= POLLUTION_SATURATION ? dtMs : 0;
      if (this.value < POLLUTION_SATURATION && this.value + increment > POLLUTION_SATURATION) {
        // Invert the same exact integral only on the one crossing frame. Count
        // the fraction after saturation; frame size cannot grant extra exposure.
        const needed = POLLUTION_SATURATION - this.value;
        let low = 0, high = dtSec;
        const fromSeconds = (this.clockMs - dtMs) / 1000;
        for (let i = 0; i < 40; i++) {
          const middle = (low + high) / 2;
          const partial = this.pollutionDefinition
            ? pollutionExposureBetween(this.pollutionDefinition, fromSeconds, fromSeconds + middle)
            : chaos.BASE_RATE * middle;
          if (partial * inflowMultiplier < needed) low = middle;
          else high = middle;
        }
        saturatedMs = Math.max(0, dtMs - high * 1000);
      }
      if (saturatedMs > 0) this.setAssimilation(Math.min(100, this.getAssimilation()
        + assimilationPerMinute(this.pollutionDefinition?.id, sumPollutionResistance([this.getPollutionResistance()]) / 100,
          this.growthResistance) * saturatedMs / 60000));
    }
    this.value = Math.min(this.value + increment, this.getCap());
    if (this.value > this.peak) this.peak = this.value;

    this.checkThresholds();
    this.checkEmit();
    this.checkModulate();
  }

  reset(startingValue?: number): void {
    this.paused = false;
    this.rateMultiplier = 1.0;
    this.tempRateDeadlineMs = 0;
    this.tempRateMult = 1.0;
    this.reductionDeadlineMs = 0;
    this.reductionMult = 1.0;
    this.chasingEnemies.clear();
    this.detectionCooldowns.clear();
    this.clockMs = 0;
    this.applyOpeningValue(startingValue);
  }

  destroy(): void {
    eventBus.off(GameEvent.ENEMY_ALERT, this.onEnemyAlert);
    eventBus.off(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.off(GameEvent.ENEMY_LOST_PLAYER, this.onEnemyLostPlayer);
    eventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
  }

  exportRuntimeState(): ChaosRuntimeState {
    return {
      version: 1, value: this.value, peak: this.peak, paused: this.paused, clockMs: this.clockMs,
      ...(this.pollutionDefinition ? { pollutionGrade: this.pollutionDefinition.id } : {}),
      chaosRateModifier: this.chaosRateModifier, lastEmitted: this.lastEmitted, lastModulated: this.lastModulated,
      thresholdsFired: [...this.thresholdsFired], chasingEnemyIds: [...this.chasingEnemies],
      detectionCooldowns: [...this.detectionCooldowns].map(([enemyId, atMs]) => ({ enemyId, atMs })),
      tempRateDeadlineMs: this.tempRateDeadlineMs, tempRateMult: this.tempRateMult,
      reductionDeadlineMs: this.reductionDeadlineMs, reductionMult: this.reductionMult,
      ...(this.assimilationMode ? { assimilationMode: this.assimilationMode,
        assimilationValue: this.getAssimilation(), growthResistance: this.growthResistance } : {}),
    };
  }

  validateRuntimeState(value: unknown): value is ChaosRuntimeState {
    return validateChaosRuntimeState(value) && value.chaosRateModifier === this.chaosRateModifier
      && value.pollutionGrade === this.pollutionDefinition?.id && value.assimilationMode === this.assimilationMode
      && (!this.assimilationMode || (value.growthResistance === this.growthResistance
        && value.assimilationValue === this.getAssimilation()));
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid or incompatible chaos runtime state');
    this.value = value.value; this.peak = value.peak; this.paused = value.paused; this.clockMs = value.clockMs;
    this.lastEmitted = value.lastEmitted; this.lastModulated = value.lastModulated;
    this.thresholdsFired = [...value.thresholdsFired];
    this.chasingEnemies.clear();
    for (const id of value.chasingEnemyIds) this.chasingEnemies.add(id);
    this.detectionCooldowns.clear();
    for (const entry of value.detectionCooldowns) this.detectionCooldowns.set(entry.enemyId, entry.atMs);
    this.tempRateDeadlineMs = value.tempRateDeadlineMs; this.tempRateMult = value.tempRateMult;
    this.reductionDeadlineMs = value.reductionDeadlineMs; this.reductionMult = value.reductionMult;
    this.updateRateMultiplier();
    // Restore the last published projection, without replaying thresholds or inflow.
    this.lastAssimilationModulated = this.getAssimilation();
    this.onModulate?.(this.getModulators());
  }

  // ------------------------------------------------------------------ public API

  getValue(): number {
    return this.value;
  }

  isAssimilationEnabled(): boolean { return this.assimilationMode !== undefined; }

  getModulators(): ChaosModulators {
    return this.assimilationMode ? getAssimilationModulators(this.lastModulated, this.getAssimilation())
      : getChaosModulators(this.lastModulated);
  }

  private getCap(): number { return this.assimilationMode ? POLLUTION_SATURATION : GAME_CONSTANTS.CHAOS.HARD_CAP; }

  getRate(): number {
    const rate = this.tempRateDeadlineMs > 0 ? Math.max(this.rateMultiplier, this.tempRateMult) : this.rateMultiplier;
    const baseRate = this.pollutionDefinition ? pollutionRateAt(this.pollutionDefinition, this.clockMs / 1000) : GAME_CONSTANTS.CHAOS.BASE_RATE;
    return baseRate * this.chaosRateModifier * rate * this.reductionMult * this.resistanceFactor();
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
    const incoming = amount > 0 ? amount * this.resistanceFactor() : amount;
    this.value = clamp(this.value + incoming, 0, this.getCap());
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

  /**
   * Slice 5 siphon tool (T1): "接下来5秒内混乱值增速减半". `setTemporaryRateMult` above
   * cannot express this - it takes `Math.max(rateMultiplier, tempRateMult)`, a floor that
   * can only ever raise the rate, never lower it. This is a separate, purely multiplicative
   * factor for the opposite direction, composed on top rather than replacing it.
   */
  setTemporaryRateReduction(mult: number, durationMs: number): void {
    this.reductionDeadlineMs = this.clockMs + durationMs;
    this.reductionMult = mult;
  }

  private tempRateDeadlineMs = 0;
  private tempRateMult = 1.0;
  private reductionDeadlineMs = 0;
  private reductionMult = 1.0;

  // ------------------------------------------------------------------ internal

  /**
   * Write the sortie opening value once. Thresholds already at or below this value
   * are marked fired without emitting, so the opening does not flash as a crossing.
   */
  private applyOpeningValue(startingValue?: number): void {
    const chaos = GAME_CONSTANTS.CHAOS;
    const start = clamp(startingValue ?? chaos.START_VALUE, 0, this.getCap());
    this.value = start;
    this.peak = start;
    this.lastEmitted = start;
    this.lastModulated = start;
    this.lastAssimilationModulated = this.getAssimilation();
    this.thresholdsFired = [
      start >= chaos.THRESHOLD_1,
      start >= chaos.THRESHOLD_2,
      start >= chaos.THRESHOLD_3,
    ];
  }

  private applyDetectionBonus(enemyId: string): void {
    const chaos = GAME_CONSTANTS.CHAOS;
    const lastTime = this.detectionCooldowns.get(enemyId) ?? -Infinity;
    if (this.clockMs - lastTime < chaos.DETECTION_BONUS_COOLDOWN) return;
    this.detectionCooldowns.set(enemyId, this.clockMs);
    this.addChaos('detection', chaos.DETECTION_BONUS);
  }

  private resistanceFactor(): number {
    return 1 - sumPollutionResistance([this.getPollutionResistance()]) / 100;
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
    if (this.assimilationMode ? this.value !== this.lastModulated || this.getAssimilation() !== this.lastAssimilationModulated
      : Math.abs(this.value - this.lastModulated) >= step) {
      this.lastModulated = this.value;
      this.lastAssimilationModulated = this.getAssimilation();
      this.onModulate?.(this.getModulators());
    }
  }
}
