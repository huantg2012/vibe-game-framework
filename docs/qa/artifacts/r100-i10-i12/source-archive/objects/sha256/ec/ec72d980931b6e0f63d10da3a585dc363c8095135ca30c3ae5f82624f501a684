/** Bounded native-frame probe. DEV only; observes timing without driving gameplay. */
export interface RiftGymPerformanceOptions {
  readonly warmupMs?: number;
  readonly sampleMs?: number;
}
export class RiftGymPerformance {
  private startedAt: number | null = null;
  private previous: number | null = null;
  private frameStartedAt: number | null = null;
  private gaps: number[] = [];
  private cpu: number[] = [];
  private elapsed = 0;
  private heapStart: number | null = null;
  private heapEnd: number | null = null;
  private gapsExcluded = 0;
  private cachedAt = -Infinity;
  private cached: ReturnType<RiftGymPerformance['summary']> | null = null;
  private capacityExceeded = false;
  readonly warmupMs: number;
  readonly sampleMs: number;
  readonly sampleCapacity: number;
  constructor(options: RiftGymPerformanceOptions = {}) {
    this.warmupMs = options.warmupMs ?? 2000;
    this.sampleMs = options.sampleMs ?? 12000;
    if (!Number.isFinite(this.warmupMs) || this.warmupMs < 0
      || !Number.isFinite(this.sampleMs) || this.sampleMs <= 0) throw new Error('Performance probe durations must be finite and non-negative; sampleMs must be positive');
    // Room for 1,000 Hz at the requested duration, with an absolute memory bound.
    // Capacity exhaustion is an incomplete result, never fabricated elapsed time.
    this.sampleCapacity = Math.min(120000, Math.max(2400, Math.ceil(this.sampleMs) + 1));
  }
  reset(): void {
    this.startedAt = performance.now(); this.previous = null; this.frameStartedAt = null;
    this.gaps = []; this.cpu = []; this.elapsed = 0; this.gapsExcluded = 0;
    this.capacityExceeded = false; this.cached = null;
    this.heapStart = this.heapEnd = this.heap(); this.cachedAt = -Infinity;
  }
  private heap(): number | null {
    return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
  }
  before(active: boolean): void {
    const now = performance.now(); this.frameStartedAt = null;
    if (this.elapsed >= this.sampleMs || this.capacityExceeded) return;
    if (!active || document.visibilityState !== 'visible') {
      if (this.previous !== null) this.gapsExcluded++;
      this.previous = null; return;
    }
    if (this.startedAt === null || now - this.startedAt < this.warmupMs) return;
    if (this.gaps.length >= this.sampleCapacity || this.cpu.length >= this.sampleCapacity) {
      this.capacityExceeded = true; this.cachedAt = -Infinity; return;
    }
    if (this.previous !== null) { const dt = now - this.previous; this.gaps.push(dt); this.elapsed += dt; }
    this.previous = now;
    this.frameStartedAt = now;
    if (this.elapsed >= this.sampleMs) this.cachedAt = -Infinity;
  }
  after(): void {
    if (this.frameStartedAt === null) return;
    this.cpu.push(performance.now() - this.frameStartedAt); this.frameStartedAt = null;
    this.heapEnd = this.heap();
  }
  private distribution(values: number[]) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const p = (q: number) => +sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]!.toFixed(3);
    return { count: values.length, p50Ms: p(.5), p95Ms: p(.95), p99Ms: p(.99), maxMs: p(1), over33ms: values.filter(x => x > 33.4).length, over50ms: values.filter(x => x > 50).length };
  }
  private summary() {
    return { method: 'Phaser PRE_STEP intervals; PRE_STEP→POST_RENDER CPU submission, not GPU time',
      state: this.startedAt === null ? 'not-started' : this.capacityExceeded ? 'capacity-exceeded' : this.elapsed >= this.sampleMs ? 'complete' : 'sampling',
      warmupMs: this.warmupMs, requestedMs: this.sampleMs, sampledMs: +this.elapsed.toFixed(2),
      sampleCapacity: this.sampleCapacity,
      frames: this.distribution(this.gaps), cpuSubmission: this.distribution(this.cpu),
      heapStartBytes: this.heapStart, heapEndBytes: this.heapEnd, pauseSegmentsExcluded: this.gapsExcluded,
      userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
      limitations: `Single ${this.sampleMs / 1000}s active sample after ${this.warmupMs / 1000}s warmup; inactive/hidden intervals excluded; no GPU or retained-resource measurement; browser heap may be unavailable/coarse; movement must be documented separately.` };
  }
  snapshot(): ReturnType<RiftGymPerformance['summary']> {
    if (!this.cached || performance.now() - this.cachedAt >= 500) {
      this.cached = this.summary(); this.cachedAt = performance.now();
    }
    return this.cached;
  }
}
