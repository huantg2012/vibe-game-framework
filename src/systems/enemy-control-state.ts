/** Independent tool sources compose without one expiry resetting another effect. */
export interface EnemyControlEffect {
  readonly movementMultiplier?: number;
  readonly perceptionMultiplier?: number;
  readonly suppressAttack?: boolean;
  readonly breakOnDamage?: boolean;
}

export interface EnemyControlSnapshot {
  readonly movementMultiplier: number;
  readonly perceptionMultiplier: number;
  readonly attackSuppressed: boolean;
  /** Latched interruption sequence: even a control broken within one frame cancels windup. */
  readonly attackInterruptRevision: number;
}

/** Enemy-owned, allocation-free reads; timers and source lifetimes belong to the caller. */
export class EnemyControlState implements EnemyControlSnapshot {
  private readonly sources = new Map<string, EnemyControlEffect>();
  private movement = 1;
  private perception = 1;
  private blocked = false;
  private interruptRevision = 0;

  get movementMultiplier(): number { return this.movement; }
  get perceptionMultiplier(): number { return this.perception; }
  get attackSuppressed(): boolean { return this.blocked; }
  get attackInterruptRevision(): number { return this.interruptRevision; }

  set(source: string, effect: EnemyControlEffect): void {
    if (!source) throw new Error('Enemy control requires a source id');
    for (const value of [effect.movementMultiplier, effect.perceptionMultiplier]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new Error('Enemy control multiplier must be finite and non-negative');
      }
    }
    if (effect.suppressAttack && !this.sources.get(source)?.suppressAttack) this.interruptRevision++;
    this.sources.set(source, { ...effect });
    this.recompute();
  }

  has(source: string): boolean { return this.sources.has(source); }

  clear(source: string): boolean {
    if (!this.sources.delete(source)) return false;
    this.recompute();
    return true;
  }

  /** Call only after real positive damage, never for an attempted hit. */
  breakOnDamage(): boolean {
    let changed = false;
    for (const [source, effect] of this.sources) {
      if (effect.breakOnDamage) { this.sources.delete(source); changed = true; }
    }
    if (changed) this.recompute();
    return changed;
  }

  private recompute(): void {
    this.movement = 1;
    this.perception = 1;
    this.blocked = false;
    for (const effect of this.sources.values()) {
      this.movement *= effect.movementMultiplier ?? 1;
      this.perception *= effect.perceptionMultiplier ?? 1;
      this.blocked ||= effect.suppressAttack === true;
    }
  }
}
