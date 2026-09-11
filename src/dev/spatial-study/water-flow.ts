import type { WaterCurtainDefinition } from './water-curtain';

export interface FlowCycleDefinition extends Pick<WaterCurtainDefinition,
  'quietMs' | 'warningMs' | 'activeMs' | 'retractMs' | 'contactExtension'> {
  readonly fallTravelMs: number;
}

export interface FallingWaterFlow {
  cycleTime: number;
  feedStart: number;
  feedEnd: number;
  contactStart: number;
  contactEnd: number;
  /** Fractions of the source-to-bed distance. Both fronts travel DOWN. */
  leadingEdge: number;
  trailingEdge: number;
  sourceFeed: number;
  swell: number;
  residue: number;
}

function inverseSmoothstep(value: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (mid * mid * (3 - 2 * mid) < value) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Retarded flow: the source stops before the last water reaches the bed.
 * This preserves the existing authoritative contact interval, while replacing
 * the former vertically scaled hose with a falling front and a draining tail. */
export class WaterFlowCycle {
  readonly contactStart: number;
  readonly contactEnd: number;
  readonly feedStart: number;
  readonly feedEnd: number;
  readonly period: number;

  constructor(readonly definition: FlowCycleDefinition) {
    const durations = [definition.quietMs, definition.warningMs, definition.activeMs,
      definition.retractMs, definition.fallTravelMs];
    if (!durations.every(value => Number.isFinite(value) && value > 0)
      || !Number.isFinite(definition.contactExtension) || definition.contactExtension <= 0
      || definition.contactExtension > 1 || definition.fallTravelMs >= definition.warningMs
      || definition.fallTravelMs >= definition.activeMs) {
      throw new Error('Water flow durations and contact threshold must be finite, positive and leave a feeding interval.');
    }
    const threshold = inverseSmoothstep(definition.contactExtension);
    this.contactStart = definition.quietMs + definition.warningMs * threshold;
    this.contactEnd = definition.quietMs + definition.warningMs + definition.activeMs
      + definition.retractMs * (1 - threshold);
    this.feedStart = this.contactStart - definition.fallTravelMs;
    this.feedEnd = this.contactEnd - definition.fallTravelMs;
    this.period = definition.quietMs + definition.warningMs + definition.activeMs + definition.retractMs;
    if (this.feedStart <= definition.quietMs || this.feedEnd <= this.feedStart) {
      throw new Error('Falling water needs time to gather before release and drain after supply stops.');
    }
  }

  sample(elapsedMs: number, out: FallingWaterFlow): FallingWaterFlow {
    const t = Math.max(0, elapsedMs) % this.period;
    const flight = this.definition.fallTravelMs;
    out.cycleTime = t; out.feedStart = this.feedStart; out.feedEnd = this.feedEnd;
    out.contactStart = this.contactStart; out.contactEnd = this.contactEnd;
    out.leadingEdge = clamp((t - this.feedStart) / flight) ** 2;
    out.trailingEdge = clamp((t - this.feedEnd) / flight) ** 2;
    const rise = clamp((t - this.feedStart) / 100);
    const pinch = clamp((this.feedEnd - t) / 180);
    out.sourceFeed = rise * pinch;
    out.swell = t < this.feedStart
      ? clamp((t - this.definition.quietMs) / (this.feedStart - this.definition.quietMs))
      : t < this.feedEnd ? 1 : clamp(1 - (t - this.feedEnd) / 260);
    out.residue = t < this.contactEnd ? 0 : clamp(1 - (t - this.contactEnd) / 1050);
    return out;
  }
}

export function createFallingWaterFlow(): FallingWaterFlow {
  return { cycleTime: 0, feedStart: 0, feedEnd: 0, contactStart: 0, contactEnd: 0,
    leadingEdge: 0, trailingEdge: 0, sourceFeed: 0, swell: 0, residue: 0 };
}
