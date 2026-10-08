/** Independent tool sources compose without one expiry resetting another effect. */
export interface EnemyControlEffect {
  readonly movementMultiplier?: number;
  readonly perceptionMultiplier?: number;
  readonly suppressAttack?: boolean;
  readonly breakOnDamage?: boolean;
  /** Heavy areas take the strongest member of the group, rather than multiplying. */
  readonly movementGroup?: 'heavy-zone';
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
  private protectionEnabled = false;
  private protectionMs = 0;
  get controlProtectionRemainingMs(): number { return this.protectionMs; }
  setControlProtectionEnabled(enabled: boolean): void { this.protectionEnabled = enabled; if (!enabled) this.protectionMs = 0; }
  canApplyHardControl(): boolean {
    return !this.protectionEnabled || (this.protectionMs <= 0 && !this.hasHardControl());
  }
  tick(dtMs: number): void { this.protectionMs = Math.max(0, this.protectionMs - Math.max(0, dtMs)); }
  restoreControlProtection(remainingMs: number): void {
    if (!Number.isFinite(remainingMs) || remainingMs < 0 || remainingMs > 2000) throw new Error('Invalid control protection');
    this.protectionMs = remainingMs;
  }

  get movementMultiplier(): number { return this.movement; }
  get perceptionMultiplier(): number { return this.perception; }
  get attackSuppressed(): boolean { return this.blocked; }
  get attackInterruptRevision(): number { return this.interruptRevision; }

  /** Recovery prepares an empty projection; ToolSystem then rebuilds the owning sources. */
  beginRuntimeRestore(): void {
    this.sources.clear();
    this.interruptRevision = 0;
    this.protectionMs = 0;
    this.recompute();
  }

  /** Restore the historical latch after source hydration, without simulating an interruption. */
  restoreInterruptRevision(revision: number): void {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid control interruption revision');
    this.interruptRevision = revision;
  }

  set(source: string, effect: EnemyControlEffect): void {
    if (!source) throw new Error('Enemy control requires a source id');
    for (const value of [effect.movementMultiplier, effect.perceptionMultiplier]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new Error('Enemy control multiplier must be finite and non-negative');
      }
    }
    if (effect.movementMultiplier === 0 && !this.sources.has(source) && !this.canApplyHardControl()) return;
    if (effect.suppressAttack && !this.sources.get(source)?.suppressAttack) this.interruptRevision++;
    this.sources.set(source, { ...effect });
    this.recompute();
  }

  has(source: string): boolean { return this.sources.has(source); }

  clear(source: string): boolean {
    const wasHard = this.sources.get(source)?.movementMultiplier === 0;
    if (!this.sources.delete(source)) return false;
    if (wasHard) this.finishHardControl();
    this.recompute();
    return true;
  }

  /** Call only after real positive damage, never for an attempted hit. */
  breakOnDamage(): boolean {
    let changed = false;
    let hardEnded = false;
    for (const [source, effect] of this.sources) {
      if (effect.breakOnDamage) { this.sources.delete(source); changed = true; hardEnded ||= effect.movementMultiplier === 0; }
    }
    if (hardEnded) this.finishHardControl();
    if (changed) this.recompute();
    return changed;
  }

  private recompute(): void {
    this.movement = 1;
    this.perception = 1;
    this.blocked = false;
    let heavy = 1;
    for (const effect of this.sources.values()) {
      if (effect.movementGroup === 'heavy-zone') heavy = Math.min(heavy, effect.movementMultiplier ?? 1);
      else this.movement *= effect.movementMultiplier ?? 1;
      this.perception *= effect.perceptionMultiplier ?? 1;
      this.blocked ||= effect.suppressAttack === true;
    }
    this.movement *= heavy;
  }
  private hasHardControl(): boolean {
    for (const effect of this.sources.values()) if (effect.movementMultiplier === 0) return true;
    return false;
  }
  private finishHardControl(): void {
    if (this.protectionEnabled && !this.hasHardControl()) this.protectionMs = 2000;
  }
}
