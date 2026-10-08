import type { MeleeTarget } from '@/systems/weapon-swing';
import type { SeaPoint, ShellCycleTiming, ShellDefinition, ShellView } from './types';
import { checkpointChecksum } from '@/types/rift-checkpoint';

export interface ShellRuntimeStateV1 {
  version: 1;
  signature: string;
  elapsedMs: number;
  hitCycle: number;
  nextContactAtMs: number;
  stopped: boolean;
  hitSequence: number;
  hitAtMs: number | null;
  contactAttempts: number;
  committedHits: number;
  lastContactAtMs: number | null;
  lastContactRegion: ShellView['lastContactRegion'];
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function ownPoints(points: readonly SeaPoint[]): readonly SeaPoint[] {
  return Object.freeze(points.map(point => Object.freeze({ x: point.x, y: point.y })));
}

function contains(point: SeaPoint, polygon: readonly SeaPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!, b = polygon[i]!;
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-7
      && (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y) <= 0) return true;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** One local, non-AI target. Combat owns contact selection and durability;
 * this system owns the consequence and its ground spill, on the world's clock.
 */
export class SuspendedSeaShellSystem {
  readonly definition: ShellDefinition;
  readonly timing: ShellCycleTiming;
  private readonly view: Mutable<ShellView>;
  private readonly target: MeleeTarget;
  private hitCycle = -1;
  private nextContactAtMs = 0;
  private stopped = false;
  private destroyed = false;

  constructor(definition: ShellDefinition, timing: ShellCycleTiming,
    private readonly isFloor: (x: number, y: number) => boolean) {
    const points = [definition.position, ...definition.spillOutline, ...definition.drainPath];
    if (!definition.id.trim() || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))
      || definition.spillOutline.length < 3 || definition.drainPath.length < 2
      || [definition.diversionDelayMs, definition.returnMs, definition.damage, definition.hitIntervalMs]
        .some(value => !Number.isFinite(value) || value <= 0)
      || [timing.periodMs, timing.warningStartMs, timing.contactStartMs, timing.contactEndMs]
        .some(value => !Number.isFinite(value) || value < 0)
      || !(timing.warningStartMs < timing.contactStartMs && timing.contactStartMs < timing.contactEndMs
        && timing.contactEndMs + definition.returnMs <= timing.periodMs)) {
      throw new Error(`Invalid suspended-sea shell or water timing: ${definition.id}`);
    }
    this.definition = Object.freeze({ ...definition,
      position: Object.freeze({ ...definition.position }),
      spillOutline: ownPoints(definition.spillOutline), drainPath: ownPoints(definition.drainPath) });
    this.timing = Object.freeze({ ...timing });
    this.view = { id: definition.id, position: this.definition.position, elapsedMs: 0, cycle: 0, cycleTimeMs: 0,
      mode: 'closed', canHit: false, coreActive: false, spillActive: false, diversionProgress: 0, returnProgress: 0,
      spillOutline: this.definition.spillOutline, drainPath: this.definition.drainPath,
      hitSequence: 0, hitAtMs: null, contactAttempts: 0, committedHits: 0,
      lastContactRegion: null, lastContactAtMs: null };
    this.target = {
      id: definition.id,
      getPosition: () => this.definition.position,
      isAlive: () => true,
      canHit: () => !this.destroyed && !this.stopped && this.view.canHit,
      applyHit: damage => this.acceptContact(damage),
    };
  }

  /** Borrowed stable view. Recording callers must copy it (including point arrays). */
  readonly readView = (): ShellView => this.view;

  exportRuntimeState(): ShellRuntimeStateV1 {
    return { version: 1, signature: checkpointChecksum({ definition: this.definition, timing: this.timing }),
      elapsedMs: this.view.elapsedMs, hitCycle: this.hitCycle, nextContactAtMs: this.nextContactAtMs,
      stopped: this.stopped, hitSequence: this.view.hitSequence, hitAtMs: this.view.hitAtMs,
      contactAttempts: this.view.contactAttempts, committedHits: this.view.committedHits,
      lastContactAtMs: this.view.lastContactAtMs, lastContactRegion: this.view.lastContactRegion };
  }

  validateRuntimeState(value: unknown): value is ShellRuntimeStateV1 {
    if (!value || typeof value !== 'object' || this.destroyed) return false;
    const state = value as ShellRuntimeStateV1;
    if (state.version !== 1 || state.signature !== checkpointChecksum({ definition: this.definition, timing: this.timing })
      || !Number.isFinite(state.elapsedMs) || state.elapsedMs < 0 || typeof state.stopped !== 'boolean'
      || !Number.isSafeInteger(state.hitCycle) || state.hitCycle < -1 || state.hitCycle > Math.floor(state.elapsedMs / this.timing.periodMs)
      || !Number.isFinite(state.nextContactAtMs) || state.nextContactAtMs < 0 || state.nextContactAtMs > state.elapsedMs + this.definition.hitIntervalMs
      || ![state.hitSequence, state.contactAttempts, state.committedHits].every(n => Number.isSafeInteger(n) && n >= 0)
      || state.committedHits > state.contactAttempts) return false;
    if (state.hitSequence === 0 ? state.hitAtMs !== null || state.hitCycle !== -1
      : state.hitAtMs === null || !Number.isFinite(state.hitAtMs) || state.hitAtMs < 0 || state.hitAtMs > state.elapsedMs
        || Math.floor(state.hitAtMs / this.timing.periodMs) !== state.hitCycle
        || state.hitAtMs % this.timing.periodMs < this.timing.warningStartMs
        || state.hitAtMs % this.timing.periodMs >= this.timing.contactEndMs) return false;
    return state.contactAttempts === 0 ? state.lastContactAtMs === null && state.lastContactRegion === null
      : state.lastContactAtMs !== null && Number.isFinite(state.lastContactAtMs) && state.lastContactAtMs >= 0
        && state.lastContactAtMs <= state.elapsedMs && ['core', 'spill', 'both'].includes(state.lastContactRegion!);
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid suspended-sea shell checkpoint');
    this.hitCycle = value.hitCycle; this.nextContactAtMs = value.nextContactAtMs; this.stopped = value.stopped;
    Object.assign(this.view, { elapsedMs: value.elapsedMs, cycle: Math.floor(value.elapsedMs / this.timing.periodMs),
      cycleTimeMs: value.elapsedMs % this.timing.periodMs, hitSequence: value.hitSequence, hitAtMs: value.hitAtMs,
      contactAttempts: value.contactAttempts, committedHits: value.committedHits,
      lastContactAtMs: value.lastContactAtMs, lastContactRegion: value.lastContactRegion });
    this.syncView();
    if (this.stopped) this.view.canHit = false;
  }

  collectMeleeTargets(out: MeleeTarget[]): void {
    if (!this.destroyed) out.push(this.target);
  }

  /** Called before Combat, so a swing and the spill see the same cycle boundary. */
  prepare(elapsedMs: number, ended: boolean): void {
    if (this.destroyed || this.stopped) return;
    if (ended) { this.stopped = true; this.view.canHit = false; return; }
    if (!Number.isFinite(elapsedMs) || elapsedMs < this.view.elapsedMs) {
      throw new Error('Suspended-sea time must be finite and monotonic. Re-entry requires a new instance.');
    }
    const oldActive = this.view.coreActive;
    this.view.elapsedMs = elapsedMs;
    this.view.cycle = Math.floor(elapsedMs / this.timing.periodMs);
    this.view.cycleTimeMs = elapsedMs % this.timing.periodMs;
    this.syncView();
    if (!this.view.coreActive || !oldActive) this.nextContactAtMs = elapsedMs;
  }

  /** Post-Combat only. Core and spill are one source with one attempt budget.
   * insideCore is sampled from the world's actual moving falling-water outline. */
  resolveContact(player: SeaPoint, insideCore: boolean, applyHit: (source: string, damage: number) => boolean): void {
    if (this.destroyed || this.stopped || !this.view.coreActive || this.view.elapsedMs < this.nextContactAtMs
      || !this.isFloor(player.x, player.y)) return;
    const insideSpill = this.view.spillActive && this.isInsideSpill(player);
    if (!insideCore && !insideSpill) return;
    this.nextContactAtMs = this.view.elapsedMs + this.definition.hitIntervalMs;
    this.view.contactAttempts++;
    this.view.lastContactRegion = insideCore ? insideSpill ? 'both' : 'core' : 'spill';
    this.view.lastContactAtMs = this.view.elapsedMs;
    if (applyHit(`environment:${this.definition.id}`, this.definition.damage)) this.view.committedHits++;
  }

  isInsideSpill(point: SeaPoint): boolean {
    return this.isFloor(point.x, point.y) && contains(point, this.definition.spillOutline);
  }

  destroy(): void {
    this.destroyed = true;
    this.view.canHit = false;
  }

  private acceptContact(damage: number): void {
    if (this.destroyed || this.stopped || !this.view.canHit || !Number.isFinite(damage) || damage <= 0) return;
    this.hitCycle = this.view.cycle;
    this.view.hitSequence++;
    this.view.hitAtMs = this.view.elapsedMs;
    this.syncView();
  }

  private syncView(): void {
    const view = this.view, time = view.cycleTimeMs;
    const hit = this.hitCycle === view.cycle;
    const afterHit = hit ? view.elapsedMs - view.hitAtMs! : 0;
    view.canHit = !hit && time >= this.timing.warningStartMs && time < this.timing.contactEndMs;
    view.diversionProgress = hit ? clamp(afterHit / this.definition.diversionDelayMs) : 0;
    view.returnProgress = hit ? clamp((time - this.timing.contactEndMs) / this.definition.returnMs) : 0;
    view.mode = !hit ? 'closed'
      : time >= this.timing.contactEndMs
        ? view.returnProgress < 1 ? 'returning' : 'closed'
        : afterHit < this.definition.diversionDelayMs ? 'diverting' : 'diverted';
    view.coreActive = time >= this.timing.contactStartMs && time < this.timing.contactEndMs;
    view.spillActive = view.coreActive && (!hit || afterHit < this.definition.diversionDelayMs);
  }
}
