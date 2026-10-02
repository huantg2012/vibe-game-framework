/** Bounded native-frame probe. DEV only; observes timing without driving gameplay. */
export class RiftGymPerformance {
  private startedAt = 0;
  private previous = 0;
  private frameStartedAt = 0;
  private gaps: number[] = [];
  private cpu: number[] = [];
  private elapsed = 0;
  private heapStart: number | null = null;
  private heapEnd: number | null = null;
  private gapsExcluded = 0;
  private cachedAt = -Infinity;
  private cached: ReturnType<RiftGymPerformance['summary']> | null = null;
  readonly warmupMs = 2000;
  readonly sampleMs = 12000;
  reset(): void {
    this.startedAt = performance.now(); this.previous = 0; this.frameStartedAt = 0;
    this.gaps = []; this.cpu = []; this.elapsed = 0; this.gapsExcluded = 0;
    this.heapStart = this.heapEnd = this.heap(); this.cachedAt = -Infinity;
  }
  private heap(): number | null {
    return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
  }
  before(active: boolean): void {
    const now = performance.now(); this.frameStartedAt = 0;
    if (!active || document.visibilityState !== 'visible') {
      if (this.previous) this.gapsExcluded++;
      this.previous = 0; return;
    }
    if (!this.startedAt || now - this.startedAt < this.warmupMs || this.elapsed >= this.sampleMs) return;
    if (this.previous) { const dt = now - this.previous; this.gaps.push(dt); this.elapsed += dt; }
    this.previous = now;
    if (this.gaps.length < 2400) this.frameStartedAt = now;
    else this.elapsed = this.sampleMs; // bounded even on abnormally high-refresh hosts
  }
  after(): void {
    if (!this.frameStartedAt) return;
    this.cpu.push(performance.now() - this.frameStartedAt); this.frameStartedAt = 0;
    this.heapEnd = this.heap();
  }
  private distribution(values: number[]) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const p = (q: number) => +sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]!.toFixed(3);
    return { count: values.length, p50Ms: p(.5), p95Ms: p(.95), maxMs: p(1), over33ms: values.filter(x => x > 33.4).length };
  }
  private summary() {
    return { method: 'Phaser PRE_STEP intervals; PRE_STEP→POST_RENDER CPU submission, not GPU time',
      state: !this.startedAt ? 'not-started' : this.elapsed >= this.sampleMs ? 'complete' : 'sampling',
      warmupMs: this.warmupMs, requestedMs: this.sampleMs, sampledMs: +this.elapsed.toFixed(2),
      frames: this.distribution(this.gaps), cpuSubmission: this.distribution(this.cpu),
      heapStartBytes: this.heapStart, heapEndBytes: this.heapEnd, pauseSegmentsExcluded: this.gapsExcluded,
      userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
      limitations: 'Single 12s segment after 2s warmup; no GPU or retained-resource measurement; browser heap may be unavailable/coarse; movement must be documented separately.' };
  }
  snapshot(): ReturnType<RiftGymPerformance['summary']> {
    if (!this.cached || performance.now() - this.cachedAt >= 500) {
      this.cached = this.summary(); this.cachedAt = performance.now();
    }
    return this.cached;
  }
}
