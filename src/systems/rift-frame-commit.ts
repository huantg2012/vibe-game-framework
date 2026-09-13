import { commitEffects } from '@/core/commit-effects';
import { saveManager } from '@/managers/save-manager';
import { inventoryStore } from '@/systems/inventory-store';
import type { RiftCheckpoint } from '@/types/rift-checkpoint';

export interface RiftFrameCommitHooks {
  capture(sequence: number): RiftCheckpoint;
  onFailure(retry: () => void): void;
  onRetried(): void;
}

/** One owner for the boundary between a completed simulation frame and its
 * presentation. The world keeps its pending candidate frozen when storage fails. */
export class RiftFrameCommit {
  private sequence: number;
  private lastSavedMs: number;
  private dirty = false;
  private pending: (() => void) | null = null;
  private pendingTime = 0;
  private disposed = false;
  private readonly waiters: (() => void)[] = [];

  constructor(private readonly hooks: RiftFrameCommitHooks, restored?: RiftCheckpoint) {
    this.sequence = restored?.sequence ?? -1;
    this.lastSavedMs = restored?.elapsedMs ?? -Infinity;
  }

  begin(): void {
    if (this.disposed || this.pending || inventoryStore.hasFrameTransaction()) return;
    inventoryStore.beginFrameTransaction(); commitEffects.begin();
  }

  markChanged(): void { this.dirty = true; }
  isBlocked(): boolean { return this.pending !== null; }

  /** A DOM inventory action can wait for the same durable frame as keyboard
   * gameplay. Failure leaves it pending, with simulation stopped, until retry. */
  whenCommitted(): Promise<void> {
    if (!inventoryStore.hasFrameTransaction()) return Promise.resolve();
    this.dirty = true;
    return new Promise(resolve => this.waiters.push(resolve));
  }

  finish(elapsedMs: number, force = false): boolean {
    if (this.disposed || this.pending) return false;
    if (!inventoryStore.hasFrameTransaction()) throw new Error('Rift frame was not opened');
    const save = force || this.dirty || inventoryStore.hasFrameChanges() || elapsedMs - this.lastSavedMs >= 500;
    if (save) {
      const checkpoint = this.hooks.capture(this.sequence + 1);
      this.pending = saveManager.prepareRiftCommit(checkpoint);
      this.pendingTime = checkpoint.elapsedMs;
    }
    if (!inventoryStore.commitFrameTransaction(this.pending ?? (() => {}))) {
      this.hooks.onFailure(this.retry);
      return false;
    }
    this.complete(save);
    return true;
  }

  private readonly retry = (): void => {
    if (this.disposed || !this.pending) return;
    if (!inventoryStore.commitFrameTransaction(this.pending)) { this.hooks.onFailure(this.retry); return; }
    // Resume audio only after the bytes are durable, before queued cues publish.
    this.hooks.onRetried();
    this.complete(true);
  };

  private complete(saved: boolean): void {
    if (saved) { this.sequence++; this.lastSavedMs = this.pendingTime; }
    this.pending = null; this.dirty = false;
    commitEffects.flush();
    for (const resolve of this.waiters.splice(0)) resolve();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    commitEffects.discard(); inventoryStore.cancelFrameTransaction();
    this.pending = null;
    this.waiters.length = 0;
  }
}
