import { checkpointChecksum } from '@/types/rift-checkpoint';
import type { MeleeTarget } from '@/systems/weapon-swing';
import type { LandmassPoint, TensionDefinition, TensionRuntimeStateV1, TensionView } from './types';

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function pointInsideLandmassOutline(point: LandmassPoint, outline: readonly LandmassPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const a = outline[previous]!, b = outline[index]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const cross = (point.x - a.x) * dy - (point.y - a.y) * dx;
    if (Math.abs(cross) < 1e-7
      && (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y) <= 0) return true;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** One local environment source. Combat owns swing selection and durability;
 * this owner provides eligibility, the shared pose and one contact budget.
 * No wall time, renderer tick, or scene event can advance the landscape. */
export class LivingLandmassTensionSystem {
  readonly definition: TensionDefinition;
  readonly periodMs: number;
  readonly activeStartMs: number;
  readonly activeEndMs: number;
  private readonly signature: string;
  private readonly view: Mutable<TensionView>;
  private readonly target: MeleeTarget;
  private relievedCycle = -1;
  private nextContactAtMs = 0;
  private destroyed = false;

  constructor(definition: TensionDefinition, private readonly isFloor: (x: number, y: number) => boolean) {
    if (!definition.id.trim() || definition.outline.length < 3
      || [definition.position, definition.center, ...definition.outline]
        .some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))
      || [definition.quietMs, definition.warningMs, definition.activeMs, definition.releaseMs,
        definition.transmissionMs, definition.reliefMs, definition.damage, definition.hitIntervalMs]
        .some(value => !Number.isFinite(value) || value <= 0)
      || !Number.isFinite(definition.dangerThreshold) || definition.dangerThreshold <= 0 || definition.dangerThreshold > 1) {
      throw new Error(`Invalid living-landmass tension definition: ${definition.id}`);
    }
    if (definition.transmissionMs + definition.reliefMs > definition.releaseMs) {
      throw new Error('Living relief must finish before the following cycle');
    }
    this.definition = Object.freeze({ ...definition,
      center: Object.freeze({ ...definition.center }), position: Object.freeze({ ...definition.position }),
      outline: Object.freeze(definition.outline.map(point => Object.freeze({ ...point }))) });
    this.activeStartMs = definition.quietMs + definition.warningMs;
    this.activeEndMs = this.activeStartMs + definition.activeMs;
    this.periodMs = this.activeEndMs + definition.releaseMs;
    if (!Number.isFinite(this.periodMs)) throw new Error('Living-landmass period must be finite');
    this.signature = checkpointChecksum(this.definition);
    this.view = { id: definition.id, position: this.definition.position, elapsedMs: 0,
      cycle: 0, cycleTimeMs: 0, phase: 'rest', phaseProgress: 0, tension: 0,
      naturalTension: 0, reliefProgress: 0, canHit: false, active: false, stopped: false,
      outline: this.definition.outline, hitSequence: 0, hitAtMs: null,
      contactAttempts: 0, committedHits: 0, lastContactAtMs: null };
    this.target = { id: definition.id, getPosition: () => this.definition.position,
      isAlive: () => true, canHit: () => !this.destroyed && this.view.canHit,
      applyHit: damage => this.acceptContact(damage) };
  }

  /** Borrowed until the next prepare/contact. Recorders must deep-copy arrays. */
  readonly readView = (): TensionView => this.view;

  collectMeleeTargets(out: MeleeTarget[]): void {
    if (!this.destroyed) out.push(this.target);
  }

  prepare(elapsedMs: number, ended = false): void {
    if (this.destroyed || this.view.stopped) return;
    if (ended) {
      this.view.stopped = true;
      this.view.canHit = false;
      this.view.active = false;
      return;
    }
    if (!Number.isFinite(elapsedMs) || elapsedMs < this.view.elapsedMs) {
      throw new Error('Living-landmass time must be finite and monotonic; restore requires its explicit contract');
    }
    const previouslyActive = this.view.active;
    const previousCycle = this.view.cycle;
    this.view.elapsedMs = elapsedMs;
    this.view.cycle = Math.floor(elapsedMs / this.periodMs);
    this.view.cycleTimeMs = elapsedMs % this.periodMs;
    this.syncView();
    if (this.view.cycle !== previousCycle || (this.view.active && !previouslyActive)) this.nextContactAtMs = elapsedMs;
  }

  /** Contact uses the exact footprint shown by the presenter, clipped to FLOOR.
   * Invulnerable attempts still consume this source's interval. */
  resolveContact(player: LandmassPoint, applyHit: (source: string, damage: number) => boolean): void {
    if (this.destroyed || this.view.stopped || !this.view.active || this.view.elapsedMs < this.nextContactAtMs
      || !this.isInsideDanger(player)) return;
    this.nextContactAtMs = this.view.elapsedMs + this.definition.hitIntervalMs;
    this.view.contactAttempts++;
    this.view.lastContactAtMs = this.view.elapsedMs;
    if (applyHit(`environment:${this.definition.id}`, this.definition.damage)) this.view.committedHits++;
  }

  isInsideDanger(point: LandmassPoint): boolean {
    return this.isFloor(point.x, point.y) && pointInsideLandmassOutline(point, this.definition.outline);
  }

  exportRuntimeState(): TensionRuntimeStateV1 {
    return { version: 1, signature: this.signature, elapsedMs: this.view.elapsedMs,
      relievedCycle: this.relievedCycle, nextContactAtMs: this.nextContactAtMs, stopped: this.view.stopped,
      hitSequence: this.view.hitSequence, hitAtMs: this.view.hitAtMs,
      contactAttempts: this.view.contactAttempts, committedHits: this.view.committedHits,
      lastContactAtMs: this.view.lastContactAtMs };
  }

  validateRuntimeState(value: unknown): value is TensionRuntimeStateV1 {
    if (this.destroyed || !value || typeof value !== 'object') return false;
    const state = value as TensionRuntimeStateV1;
    if (state.version !== 1 || state.signature !== this.signature || !Number.isFinite(state.elapsedMs) || state.elapsedMs < 0
      || typeof state.stopped !== 'boolean' || !Number.isSafeInteger(state.relievedCycle) || state.relievedCycle < -1
      || state.relievedCycle > Math.floor(state.elapsedMs / this.periodMs)
      || !Number.isFinite(state.nextContactAtMs) || state.nextContactAtMs < 0
      || state.nextContactAtMs > state.elapsedMs + this.definition.hitIntervalMs
      || ![state.hitSequence, state.contactAttempts, state.committedHits].every(number => Number.isSafeInteger(number) && number >= 0)
      || state.committedHits > state.contactAttempts || state.hitSequence > Math.floor(state.elapsedMs / this.periodMs) + 1) return false;
    if (state.hitSequence === 0) {
      if (state.hitAtMs !== null || state.relievedCycle !== -1) return false;
    } else {
      if (state.hitAtMs === null || !Number.isFinite(state.hitAtMs) || state.hitAtMs < 0 || state.hitAtMs > state.elapsedMs
        || Math.floor(state.hitAtMs / this.periodMs) !== state.relievedCycle
        || state.hitAtMs % this.periodMs < this.definition.quietMs || state.hitAtMs % this.periodMs >= this.activeEndMs) return false;
    }
    if (state.contactAttempts === 0) return state.lastContactAtMs === null;
    return state.lastContactAtMs !== null && Number.isFinite(state.lastContactAtMs)
      && state.lastContactAtMs >= 0 && state.lastContactAtMs <= state.elapsedMs
      && state.lastContactAtMs % this.periodMs >= this.activeStartMs
      && state.lastContactAtMs % this.periodMs < this.activeEndMs;
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid living-landmass tension checkpoint');
    this.relievedCycle = value.relievedCycle;
    this.nextContactAtMs = value.nextContactAtMs;
    Object.assign(this.view, { elapsedMs: value.elapsedMs, cycle: Math.floor(value.elapsedMs / this.periodMs),
      cycleTimeMs: value.elapsedMs % this.periodMs, stopped: value.stopped,
      hitSequence: value.hitSequence, hitAtMs: value.hitAtMs, contactAttempts: value.contactAttempts,
      committedHits: value.committedHits, lastContactAtMs: value.lastContactAtMs });
    this.syncView();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.view.canHit = false;
    this.view.active = false;
  }

  private naturalLoadAt(elapsedMs: number): number {
    const time = elapsedMs % this.periodMs;
    if (time < this.definition.quietMs) return 0;
    if (time < this.activeStartMs) return smooth((time - this.definition.quietMs) / this.definition.warningMs);
    if (time < this.activeEndMs) return 1;
    return 1 - smooth((time - this.activeEndMs) / this.definition.releaseMs);
  }

  private acceptContact(damage: number): void {
    if (this.destroyed || this.view.stopped || !this.view.canHit || !Number.isFinite(damage) || damage <= 0) return;
    this.relievedCycle = this.view.cycle;
    this.view.hitSequence++;
    this.view.hitAtMs = this.view.elapsedMs;
    this.syncView();
  }

  private syncView(): void {
    const view = this.view, time = view.cycleTimeMs;
    if (time < this.definition.quietMs) {
      view.phase = 'rest'; view.phaseProgress = time / this.definition.quietMs;
    } else if (time < this.activeStartMs) {
      view.phase = 'strain'; view.phaseProgress = (time - this.definition.quietMs) / this.definition.warningMs;
    } else if (time < this.activeEndMs) {
      view.phase = 'pull'; view.phaseProgress = (time - this.activeStartMs) / this.definition.activeMs;
    } else {
      view.phase = 'release'; view.phaseProgress = (time - this.activeEndMs) / this.definition.releaseMs;
    }
    view.naturalTension = this.naturalLoadAt(view.elapsedMs);
    const relieved = this.relievedCycle === view.cycle;
    const age = relieved ? view.elapsedMs - view.hitAtMs! - this.definition.transmissionMs : -1;
    view.reliefProgress = age < 0 ? 0 : Math.max(0, Math.min(1, age / this.definition.reliefMs));
    // Sampling the delayed propagation endpoint prevents a warning-time hit
    // from snapping back to an earlier, lower support pose after 350ms.
    view.tension = age < 0 ? view.naturalTension : Math.min(view.naturalTension,
      this.naturalLoadAt(view.hitAtMs! + this.definition.transmissionMs) * (1 - smooth(view.reliefProgress)));
    view.canHit = !view.stopped && !relieved && time >= this.definition.quietMs && time < this.activeEndMs;
    view.active = !view.stopped && view.phase === 'pull' && view.tension >= this.definition.dangerThreshold;
  }
}
