import { pickAtmosphere, type AtmospherePool } from '@/narrative/atmosphere';
import { getDomUiRoot } from './panel-styles';

const OBJECT_POOLS: Partial<Record<string, AtmospherePool>> = {
  core: 'haven.core', storage: 'haven.storage', purifier: 'haven.purifier',
  defense: 'haven.defense', growth: 'haven.growth', rift: 'haven.rift',
};

/** Quiet observations, timed only by the owning scene's active frames. */
export class HavenNarration {
  private line: HTMLDivElement | null = null;
  private now = 0;
  private shownAt = 0;
  private holdMs = 0;
  private nextObservationAt = 0;
  private target: string | null = null;
  private targetSince = 0;
  private observations = 0;
  private readonly observed = new Set<string>();
  private arrival: { pool: AtmospherePool; ready: number; expires: number } | null = null;
  private lastRest = { text: '', at: -Infinity };

  constructor(private readonly pick = pickAtmosphere) {}

  queueArrival(pool: AtmospherePool): void {
    this.arrival = { pool, ready: this.now + 2500, expires: this.now + 20000 };
  }

  tick(deltaMs: number, state: { blocked: boolean; resting: boolean; moving: boolean; target: string | null }): void {
    this.now += Math.max(0, Math.min(100, deltaMs));
    if (this.arrival && this.now > this.arrival.expires) this.arrival = null;
    if (state.blocked) {
      this.clear();
      this.target = null;
      this.nextObservationAt = Math.max(this.nextObservationAt, this.now + 2500);
      return;
    }
    if (this.line) {
      const age = this.now - this.shownAt;
      const opacity = Math.min(1, age / 350, (this.holdMs - age) / 600);
      if (opacity <= 0 && age > 0) this.clear();
      else this.line.style.opacity = String(Math.max(0, opacity));
    }
    if (state.resting) return;
    if (this.arrival && this.now >= this.arrival.ready && this.now >= this.nextObservationAt && !this.line) {
      this.show(this.pick(this.arrival.pool), false);
      this.arrival = null;
      this.nextObservationAt = this.now + 32000;
    }
    const target = state.moving ? null : state.target;
    if (target !== this.target) {
      this.target = target;
      this.targetSince = this.now;
    }
    const pool = target ? OBJECT_POOLS[target] : undefined;
    if (!pool || !target || this.line || this.observations >= 2 || this.observed.has(target)
      || this.now < this.nextObservationAt || this.now - this.targetSince < 3500) return;
    this.show(this.pick(pool), false);
    this.observed.add(target);
    this.observations++;
    this.nextObservationAt = this.now + 32000;
  }

  sit(): void {
    this.arrival = null;
    // Rapid stand/sit is one rest, not a way to empty the writing bank.
    if (this.now - this.lastRest.at >= 30000 || !this.lastRest.text) {
      this.lastRest = { text: this.pick('haven.rest'), at: this.now };
    }
    this.show(this.lastRest.text, true);
    this.nextObservationAt = this.now + 32000;
  }

  stand(): void { this.clear(); }

  setPaused(paused: boolean): void {
    if (this.line) this.line.style.visibility = paused ? 'hidden' : '';
  }

  destroy(): void {
    this.clear();
    this.arrival = null;
  }

  private show(text: string, resting: boolean): void {
    this.clear();
    const line = document.createElement('div');
    line.id = resting ? 'purification-rest-line' : 'haven-atmosphere-line';
    line.textContent = text;
    line.style.cssText = 'position:absolute;left:180px;top:534px;width:600px;text-align:center;pointer-events:none;color:#a1ac97;font:13px/23px var(--ui-title);letter-spacing:1px;text-shadow:0 2px 5px #000;z-index:30;opacity:0';
    getDomUiRoot().append(line);
    this.line = line;
    this.shownAt = this.now;
    this.holdMs = Math.max(4800, Math.min(7400, [...text].length * 170 + 1200));
  }

  private clear(): void {
    this.line?.remove();
    this.line = null;
  }
}
