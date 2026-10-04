/** Native construction, first complete zero-time picture, and live simulation
 * occupy separate real engine frames. No timer represents a rendered frame. */
export interface RiftEntryFrameFenceHooks {
  frame(): number;
  canPresent(): boolean;
  pausePhysics(): boolean;
  resumePhysics(): void;
  subscribeRendered(listener: () => void): () => void;
  released(): void;
}

export class RiftEntryFrameFence {
  private readonly constructionFrame: number;
  private preparedFrame: number | null = null;
  private active = true;
  private readonly ownsPhysicsPause: boolean;
  private unsubscribe: (() => void) | null;

  constructor(private readonly hooks: RiftEntryFrameFenceHooks) {
    this.constructionFrame = hooks.frame();
    this.ownsPhysicsPause = hooks.pausePhysics();
    this.unsubscribe = hooks.subscribeRendered(this.onRendered);
  }

  isActive(): boolean { return this.active; }

  /** The caller must finish all zero-time visual work and its durable checkpoint
   * before markPresented. A failed save keeps the preparation fence closed. */
  needsPresentation(): boolean {
    return this.active && this.preparedFrame === null
      && this.hooks.frame() > this.constructionFrame && this.hooks.canPresent();
  }

  markPresented(): void {
    if (!this.needsPresentation()) throw new Error('Rift entry picture must be completed in a later live frame');
    this.preparedFrame = this.hooks.frame();
  }

  private readonly onRendered = (): void => {
    if (!this.active || this.preparedFrame === null || !this.hooks.canPresent()) return;
    if (this.hooks.frame() < this.preparedFrame) return;
    this.close();
    this.hooks.released();
  };

  /** Scene shutdown owns cancellation; an old listener cannot release a newly
   * created fence or resume physics it did not pause. */
  destroy(): void { this.close(); }

  private close(): void {
    if (!this.active) return;
    this.active = false;
    this.unsubscribe?.(); this.unsubscribe = null;
    if (this.ownsPhysicsPause) this.hooks.resumePhysics();
  }
}
