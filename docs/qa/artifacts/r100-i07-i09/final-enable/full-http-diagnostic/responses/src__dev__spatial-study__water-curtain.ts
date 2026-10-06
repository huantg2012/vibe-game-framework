/** Authoritative environmental cycle. The renderer and damage consume this same frame. */
export interface WaterCurtainDefinition {
  readonly id: string; readonly x: number; readonly y: number; readonly width: number; readonly depth: number;
  readonly footprint: 'ellipse' | 'rectangle';
  readonly quietMs: number; readonly warningMs: number; readonly activeMs: number; readonly retractMs: number;
  readonly damage: number; readonly hitIntervalMs: number; readonly contactExtension: number;
}
export interface WaterCurtainFrame {
  phase: 'quiet' | 'descending' | 'falling' | 'retracting';
  cycle: number; progress: number; extension: number; active: boolean;
}
const smooth = (x: number) => x * x * (3 - 2 * x);
export function sampleWaterCurtain(out: WaterCurtainFrame, elapsedMs: number,
  d: Pick<WaterCurtainDefinition, 'quietMs' | 'warningMs' | 'activeMs' | 'retractMs' | 'contactExtension'>): void {
  const period = d.quietMs + d.warningMs + d.activeMs + d.retractMs;
  const time = Math.max(0, elapsedMs), t = time % period;
  out.cycle = Math.floor(time / period);
  if (t < d.quietMs) { out.phase = 'quiet'; out.progress = t / d.quietMs; out.extension = 0; }
  else if (t < d.quietMs + d.warningMs) {
    out.phase = 'descending'; out.progress = (t - d.quietMs) / d.warningMs; out.extension = smooth(out.progress);
  } else if (t < d.quietMs + d.warningMs + d.activeMs) {
    out.phase = 'falling'; out.progress = (t - d.quietMs - d.warningMs) / d.activeMs; out.extension = 1;
  } else {
    out.phase = 'retracting'; out.progress = (t - d.quietMs - d.warningMs - d.activeMs) / d.retractMs; out.extension = 1 - smooth(out.progress);
  }
  out.active = out.extension >= d.contactExtension;
}
export function isInsideWaterCurtain(p: Readonly<{ x: number; y: number }>, d: WaterCurtainDefinition): boolean {
  const dx = (p.x - d.x) / (d.width * .5), dy = (p.y - d.y) / (d.depth * .5);
  return d.footprint === 'ellipse' ? dx * dx + dy * dy <= 1 : Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
}

export class WaterCurtainRuntime {
  readonly frame: WaterCurtainFrame = { phase: 'quiet', cycle: 0, progress: 0, extension: 0, active: false };
  private nextAttemptMs = 0;
  private previousActive = false;
  hits = 0;
  attempts = 0;
  constructor(readonly definition: WaterCurtainDefinition) {}
  update(elapsedMs: number, position: Readonly<{ x: number; y: number }>, ended: boolean,
    applyHit: (id: string, amount: number) => boolean): void {
    sampleWaterCurtain(this.frame, elapsedMs, this.definition);
    if (!this.frame.active) this.nextAttemptMs = elapsedMs;
    if (this.frame.active && !this.previousActive) this.nextAttemptMs = elapsedMs;
    this.previousActive = this.frame.active;
    if (ended || !this.frame.active || elapsedMs < this.nextAttemptMs || !isInsideWaterCurtain(position, this.definition)) return;
    this.nextAttemptMs = elapsedMs + this.definition.hitIntervalMs;
    this.attempts++;
    if (applyHit(`environment:${this.definition.id}`, this.definition.damage)) this.hits++;
  }
}
