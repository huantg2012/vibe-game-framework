import { runtimeRecord, runtimeNumber } from './ai/runtime-validation';
export interface HazardControlRuntimeState { suppressions: [string, number][]; delays: [string, number][]; recovery: 'none' | 'wait-rest' | 'warning'; paintInflated: boolean }
/** Source-scoped temporary environmental controls; owns no damage, geometry or item uses. */
export class EnvironmentHazardControl {
  private readonly suppressions = new Map<string, number>();
  private readonly delays = new Map<string, number>();
  private recovery: 'none' | 'wait-rest' | 'warning' = 'none';
  private paintInflated = false;

  exportRuntimeState(): HazardControlRuntimeState { return { suppressions: [...this.suppressions], delays: [...this.delays], recovery: this.recovery, paintInflated: this.paintInflated }; }
  static validateRuntimeState(value: unknown): value is HazardControlRuntimeState {
    if (!runtimeRecord(value) || !['none', 'wait-rest', 'warning'].includes(value.recovery as string) || typeof value.paintInflated !== 'boolean') return false;
    return [value.suppressions, value.delays].every(rows => Array.isArray(rows) && rows.length < 1024 && rows.every(row => Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && row[0].length > 0 && runtimeNumber(row[1], 0)) && new Set(rows.map(row => row[0])).size === rows.length);
  }
  restoreRuntimeState(value: unknown): void {
    if (!EnvironmentHazardControl.validateRuntimeState(value)) throw new Error('Invalid hazard control');
    this.suppressions.clear(); this.delays.clear();
    for (const [id, time] of value.suppressions) this.suppressions.set(id, time);
    for (const [id, time] of value.delays) this.delays.set(id, time);
    this.recovery = value.recovery; this.paintInflated = value.paintInflated;
  }

  static valid(sourceId: string, durationMs: number): boolean {
    return sourceId.trim().length > 0 && Number.isFinite(durationMs) && durationMs > 0;
  }

  get suppressionRemainingMs(): number { return this.maximum(this.suppressions); }
  get delayRemainingMs(): number { return this.maximum(this.delays); }
  get recoveryPending(): boolean { return this.recovery !== 'none'; }
  get recoveryWarning(): boolean { return this.recovery === 'warning'; }
  get suppressed(): boolean { return this.suppressions.size > 0 || this.recoveryPending; }

  suppress(sourceId: string, durationMs: number): void {
    this.suppressions.set(sourceId, Math.max(durationMs, this.suppressions.get(sourceId) ?? 0));
    this.recovery = 'none';
  }

  delay(sourceId: string, durationMs: number): void {
    this.delays.set(sourceId, Math.max(durationMs, this.delays.get(sourceId) ?? 0));
  }

  /** Remove one caller's lifetime, retaining the natural recovery warning. */
  clear(sourceId: string): void {
    const wasSuppressed = this.suppressions.delete(sourceId);
    this.delays.delete(sourceId);
    if (wasSuppressed && this.suppressions.size === 0) this.recovery = 'wait-rest';
  }

  /** Returns the fraction of this frame free to advance the natural release clock. */
  tick(dtMs: number): number {
    const delayMs = this.delayRemainingMs;
    const suppressed = this.suppressions.size > 0;
    this.advance(this.delays, dtMs);
    this.advance(this.suppressions, dtMs);
    if (suppressed && this.suppressions.size === 0) this.recovery = 'wait-rest';
    return Math.max(0, dtMs - delayMs);
  }

  /** Never reactivate midway through a release; require the next natural gather warning. */
  observeVolumePhase(phase: 'rest' | 'gather' | 'release' | 'disperse'): void {
    if (this.recovery === 'wait-rest' && (phase === 'rest' || phase === 'disperse')) this.recovery = 'warning';
    if (this.recovery === 'warning' && phase === 'gather') this.recovery = 'none';
  }

  /** Continuous paint has no off phase: wait for a whole low-breath → inflation warning. */
  observePaintInflation(inflated: boolean): void {
    if (this.recovery === 'wait-rest' && this.paintInflated && !inflated) this.recovery = 'warning';
    else if (this.recovery === 'warning' && !this.paintInflated && inflated) this.recovery = 'none';
    this.paintInflated = inflated;
  }

  private maximum(sources: ReadonlyMap<string, number>): number {
    let maximum = 0;
    for (const remaining of sources.values()) maximum = Math.max(maximum, remaining);
    return maximum;
  }

  private advance(sources: Map<string, number>, dtMs: number): void {
    for (const [id, remaining] of sources) {
      if (remaining <= dtMs) sources.delete(id);
      else sources.set(id, remaining - dtMs);
    }
  }
}
