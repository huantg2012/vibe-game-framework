/** Read-only evidence recorder. Observed states and committed consumption, never synthetic hits. */
import type { RiftScene } from '@/scenes/rift-scene';
import { getEquipmentLifecycle, type InventoryState } from '@/types/inventory-types';

export type BuildLabSample = NonNullable<ReturnType<RiftScene['probeBuildLabState']>>;
export interface BuildLabRecord {
  schemaVersion: 1;
  metadata: Record<string, unknown>;
  initialInventory: InventoryState;
  finalInventory: InventoryState;
  samples: BuildLabSample[];
  events: { elapsedMs: number; event: string; payload: unknown }[];
  outcome: 'running' | 'extract' | 'death' | 'aborted';
  metrics: { distancePx: number; stationaryMs: number; alertMs: number; engagedMs: number; peakChaos: number;
    consumedUses: Record<string, number>; discardedItems: string[]; sampleLimitReached: boolean };
}

export class BuildLabRecorder {
  readonly record: BuildLabRecord;
  private previousInventory: InventoryState;
  private last: BuildLabSample | null = null;
  private finished = false;
  constructor(metadata: Record<string, unknown>, initialInventory: InventoryState) {
    this.previousInventory = structuredClone(initialInventory);
    this.record = { schemaVersion: 1, metadata: structuredClone(metadata), initialInventory: structuredClone(initialInventory),
      finalInventory: structuredClone(initialInventory), samples: [], events: [], outcome: 'running',
      metrics: { distancePx: 0, stationaryMs: 0, alertMs: 0, engagedMs: 0, peakChaos: 0,
        consumedUses: {}, discardedItems: [], sampleLimitReached: false } };
  }
  sample(value: BuildLabSample): void {
    if (this.finished) return;
    const snapshot = structuredClone(value);
    const metrics = this.record.metrics;
    if (this.last && snapshot.elapsedMs > this.last.elapsedMs && !this.last.ended) {
      const dt = snapshot.elapsedMs - this.last.elapsedMs;
      const distance = Math.hypot(snapshot.player.x - this.last.player.x, snapshot.player.y - this.last.player.y);
      metrics.distancePx += distance;
      if (distance < .5) metrics.stationaryMs += dt;
      if (this.last.enemies.some(enemy => enemy.detection > 0 || ['suspicious','alert','chase'].includes(enemy.state))) metrics.alertMs += dt;
      if (this.last.enemies.some(enemy => enemy.engaged)) metrics.engagedMs += dt;
    }
    metrics.peakChaos = Math.max(metrics.peakChaos, snapshot.chaos);
    if (this.record.samples.length < 36000) this.record.samples.push(snapshot);
    else metrics.sampleLimitReached = true;
    this.last = snapshot;
  }
  event(event: string, payload: unknown): void {
    if (this.finished) return;
    this.record.events.push({ elapsedMs: this.last?.elapsedMs ?? 0, event, payload: structuredClone(payload) });
  }
  inventory(next: InventoryState): void {
    if (this.finished) return;
    const previous = this.previousInventory;
    for (const item of previous.items) {
      const after = next.items.find(candidate => candidate.id === item.id);
      const beforeUses = getEquipmentLifecycle(item).usesRemaining;
      // Only an explicit break ledger can turn disappearance into use consumption.
      // Death, abort and dropping gear must never masquerade as uses or successful hits.
      const newlyBroken = next.run?.destroyedIds.includes(item.id) && !previous.run?.destroyedIds.includes(item.id);
      const spent = after ? beforeUses - getEquipmentLifecycle(after).usesRemaining : newlyBroken ? beforeUses : 0;
      if (spent > 0) this.record.metrics.consumedUses[item.id] = (this.record.metrics.consumedUses[item.id] ?? 0) + spent;
      if (item.location.kind === 'carried' && after?.location.kind === 'ground') this.record.metrics.discardedItems.push(item.id);
    }
    this.event('inventory:committed', next);
    this.previousInventory = structuredClone(next);
    this.record.finalInventory = structuredClone(next);
  }
  finish(outcome: Exclude<BuildLabRecord['outcome'], 'running'>, inventory: InventoryState): void {
    if (this.finished) return;
    this.inventory(inventory);
    this.record.outcome = outcome;
    this.event('record:finished', { outcome });
    this.finished = true;
  }
}
