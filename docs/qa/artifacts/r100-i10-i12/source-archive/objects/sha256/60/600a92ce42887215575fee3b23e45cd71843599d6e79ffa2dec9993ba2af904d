/** Presentation effects may wait for a durable world commit. Gameplay events
 * still run synchronously; deferring those would omit damage-triggered passives. */
class CommitEffects {
  private queue: (() => void)[] | null = null;

  begin(): void {
    if (this.queue) throw new Error('Presentation commit is already open');
    this.queue = [];
  }

  defer(effect: () => void): boolean {
    if (!this.queue) return false;
    this.queue.push(effect);
    return true;
  }

  flush(): void {
    const queue = this.queue;
    this.queue = null;
    for (const effect of queue ?? []) {
      try { effect(); } catch (error) { console.error('Presentation failed after durable commit', error); }
    }
  }

  discard(): void { this.queue = null; }
  isOpen(): boolean { return this.queue !== null; }
}

export const commitEffects = new CommitEffects();
export function afterStateCommit(effect: () => void): void {
  if (!commitEffects.defer(effect)) effect();
}
