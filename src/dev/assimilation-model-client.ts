import type { AssimilationModelFrame, AssimilationModelRequest, AssimilationModelResponse } from './assimilation-model-protocol';

export interface AssimilationModelConsumer {
  getAssimilationModelPose(): Pick<AssimilationModelRequest, 'yaw' | 'phase' | 'breath' | 'settle'> | null;
  setAssimilationModel(frame: AssimilationModelFrame | null): void;
}

/** Art-study baker: one in-flight request, latest desired pose, bounded LRU.
 * The ordinary game never imports this client or starts its worker. */
export class AssimilationModelClient {
  private readonly worker = new Worker(new URL('./assimilation-model-worker.ts', import.meta.url), { type: 'module' });
  private readonly cache = new Map<string, AssimilationModelFrame>();
  private consumer: AssimilationModelConsumer | null = null;
  private desired: Omit<AssimilationModelRequest, 'id'> | null = null;
  private pending: { id: number; key: string; start: number } | null = null;
  private displayed = '';
  private nextId = 0;
  private lastSent = -Infinity;
  private failed = false;
  readonly metrics = { requests: 0, applied: 0, cacheHits: 0, cacheBytes: 0, lastBakeMs: 0,
    maxBakeMs: 0, lastBuildMs: 0, lastApplyMs: 0, maxApplyMs: 0, lastLatencyMs: 0, triangles: 0, error: '' };
  constructor(private readonly onError: (reason: unknown) => void, private readonly onApplied: () => void) {
    this.worker.onmessage = ({ data }: MessageEvent<AssimilationModelResponse>) => {
      const pending = this.pending;
      if (!pending || data.id !== pending.id) return;
      this.pending = null;
      if ('error' in data) { this.fail(data.error); return; }
      this.metrics.lastBakeMs = data.bakeMs;
      this.metrics.maxBakeMs = Math.max(this.metrics.maxBakeMs, data.bakeMs);
      this.metrics.lastBuildMs = data.buildMs;
      this.metrics.lastLatencyMs = performance.now() - pending.start;
      this.metrics.triangles = data.triangles;
      this.cache.set(pending.key, data);
      while (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value!);
      this.metrics.cacheBytes = this.cache.size * 64 * 80 * 4 * 4;
      // A changed source/pose never receives an obsolete geometry response.
      if (this.desired && this.key(this.desired) === pending.key) this.apply(pending.key, data);
    };
    this.worker.onerror = event => this.fail(event.message);
  }
  private fail(reason: unknown): void {
    this.failed = true; this.metrics.error = String(reason); this.onError(reason);
  }
  private key(value: Omit<AssimilationModelRequest, 'id'>): string {
    return [value.amount, value.fibre, value.yaw, value.phase, value.breath, value.settle ?? 0].join('/');
  }
  private apply(key: string, frame: AssimilationModelFrame): void {
    const start = performance.now();
    this.consumer?.setAssimilationModel(frame); this.onApplied(); this.displayed = key;
    this.metrics.lastApplyMs = performance.now() - start;
    this.metrics.maxApplyMs = Math.max(this.metrics.maxApplyMs, this.metrics.lastApplyMs);
    this.metrics.applied++;
  }
  update(consumer: AssimilationModelConsumer, amount: number, fibre: number, seconds: number, motion: boolean): void {
    this.consumer = consumer;
    const pose = consumer.getAssimilationModelPose();
    if (this.failed || !pose || amount < .005) {
      this.desired = null;
      if (this.displayed) { consumer.setAssimilationModel(null); this.onApplied(); }
      this.displayed = '';
      return;
    }
    // 40 geometry nodes across A; 20 across mixture. Material remains continuous
    // at display rate. A node is a real re-rasterization, never sprite blending.
    this.desired = { amount: Math.round(amount * 40) / 40, fibre: Math.round(fibre * 20) / 20, ...pose,
      breath: motion && pose.phase === null ? (Math.floor(seconds / 3.2 * 8) % 8) / 8 * Math.PI * 2 : 0 };
    const key = this.key(this.desired);
    if (key === this.displayed) return;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key); this.cache.set(key, cached);
      this.metrics.cacheHits++; this.apply(key, cached); return;
    }
    const now = performance.now();
    if (this.pending || now - this.lastSent < 100) return;
    this.lastSent = now;
    const id = ++this.nextId;
    this.pending = { id, key, start: now }; this.metrics.requests++;
    this.worker.postMessage({ ...this.desired, id } satisfies AssimilationModelRequest);
  }
  get settled(): boolean { return !this.desired || this.displayed === this.key(this.desired); }
  destroy(): void {
    this.worker.terminate(); this.consumer?.setAssimilationModel(null);
    this.consumer = null; this.pending = null; this.cache.clear();
  }
}
