/** Bounded synchronous construction stages separated by a paint opportunity and
 * a fresh task. The owner retains the zero-game-time/input fence until complete. */
export interface RiftStagedEntryScheduler { schedule(callback: () => void): () => void }
export const browserEntryScheduler: RiftStagedEntryScheduler = {
  schedule(callback) {
    let active = true, timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      if (active) timer = setTimeout(() => { if (active) callback(); }, 0);
    });
    return () => { active = false; cancelAnimationFrame(frame); if (timer !== undefined) clearTimeout(timer); };
  },
};
export class RiftStagedEntry {
  private active = true;
  private advancing = false;
  private cancelPending: (() => void) | null = null;
  constructor(private readonly steps: Generator<void, void>, private readonly completed: () => void,
    private readonly failed: (reason: unknown) => void, private readonly scheduler = browserEntryScheduler) {}
  isActive(): boolean { return this.active; }
  /** Initial stage runs inside Scene.create; each explicit yield gets its own task. */
  start(): void { this.advance(); }
  private readonly advance = (): void => {
    if (!this.active) return;
    this.cancelPending = null;
    this.advancing = true;
    try {
      const result = this.steps.next();
      this.advancing = false;
      if (!this.active) { if (!result.done) this.steps.return(); return; }
      if (result.done) { this.active = false; this.completed(); }
      else this.cancelPending = this.scheduler.schedule(this.advance);
    } catch (reason) { this.advancing = false; this.active = false; this.steps.return(); this.failed(reason); }
  };
  destroy(): void {
    if (!this.active) return;
    this.active = false; this.cancelPending?.(); this.cancelPending = null;
    if (!this.advancing) this.steps.return();
  }
}
