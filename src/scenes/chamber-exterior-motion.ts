import { CHAMBER_CONTACTS, CHAMBER_EXTERIOR_CONTACTS, CHAMBER_GROUND_OFFSET_Y,
  CHAMBER_SPAWN_POINT } from '../systems/purification-chamber-layout';

/** The room is the zero-parallax plane. Looking around it exposes progressively
 * more of the distant plates, so their compensation relative to the room grows. */
export const CHAMBER_EXTERIOR_LAYERS = [
  { id: 'far', depth: -60, parallaxWeight: .14 },
  { id: 'middle', depth: -55, parallaxWeight: .09 },
  { id: 'near', depth: -50, parallaxWeight: .04 },
] as const;
export type ChamberExteriorLayer = typeof CHAMBER_EXTERIOR_LAYERS[number]['id'];
export interface ChamberExteriorOffset { x: number; y: number }
export const CHAMBER_EXTERIOR_REFERENCE = {
  x: CHAMBER_SPAWN_POINT.x, y: CHAMBER_SPAWN_POINT.y - CHAMBER_GROUND_OFFSET_Y,
} as const;
export const CHAMBER_EXTERIOR_MAX_OBSERVER_OFFSET = 170;
export const CHAMBER_PRESENCE_PERIOD_MS = 37000;
export const CHAMBER_PRESENCE_START_MS = 8500;
export const CHAMBER_PRESENCE_DURATION_MS = 6200;

/** Pure, allocation-free player-driven observer model. No camera state enters
 * this model: opening an interaction panel cannot drag the scenery out of phase. */
export class ChamberExteriorMotion {
  readonly observer: ChamberExteriorOffset = { x: 0, y: 0 };
  readonly offsets: Record<ChamberExteriorLayer, ChamberExteriorOffset> = {
    far: { x: 0, y: 0 }, middle: { x: 0, y: 0 }, near: { x: 0, y: 0 },
  };

  update(deltaMs: number, playerX: number, playerY: number, reducedMotion: boolean): void {
    // A changed accessibility preference freezes the current composition; there
    // is no catch-up drift while reduced motion is enabled.
    if (reducedMotion || deltaMs <= 0) return;
    const blend = -Math.expm1(-Math.min(deltaMs, 100) / 130);
    const targetX = clampObserver(playerX - CHAMBER_EXTERIOR_REFERENCE.x);
    const targetY = clampObserver(playerY - CHAMBER_EXTERIOR_REFERENCE.y);
    this.observer.x += (targetX - this.observer.x) * blend;
    this.observer.y += (targetY - this.observer.y) * blend;
    for (const layer of CHAMBER_EXTERIOR_LAYERS) {
      const offset = this.offsets[layer.id];
      offset.x = this.observer.x * layer.parallaxWeight;
      offset.y = this.observer.y * layer.parallaxWeight;
    }
  }
}

function clampObserver(value: number): number {
  return Math.max(-CHAMBER_EXTERIOR_MAX_OBSERVER_OFFSET,
    Math.min(CHAMBER_EXTERIOR_MAX_OBSERVER_OFFSET, value));
}

/** A continuous near plate keeps its two real attachments, source apertures
 * and material-bound light rigid. The distant ends alone receive the observer
 * offset. The broad zero-weight margin also covers all interpolated mesh cells. */
export function chamberNearParallaxWeight(x: number, y: number): number {
  let distance = Infinity;
  for (const source of CHAMBER_EXTERIOR_CONTACTS) {
    const root = CHAMBER_CONTACTS[source.id];
    let ax: number = root.x, ay: number = root.y;
    for (const [bx, by] of source.path) {
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      distance = Math.min(distance, Math.hypot(x - ax - dx * t, y - ay - dy * t));
      ax = bx; ay = by;
    }
  }
  const t = Math.max(0, Math.min(1, (distance - 48) / 72));
  return t * t * (3 - 2 * t);
}

export interface ChamberDistantPresence {
  active: boolean;
  phase: number;
  cycle: number;
  alpha: number;
  x: number;
  y: number;
}

/** Only a rare slow occlusion in the far depth gap. This is neither an actor nor
 * gameplay RNG. Supplying time explicitly makes the exact production phase
 * inspectable in an offline frame without a production state-write hook. */
export function sampleChamberDistantPresence(timeMs: number, out: ChamberDistantPresence): void {
  const elapsed = Math.max(0, timeMs);
  out.cycle = Math.floor(elapsed / CHAMBER_PRESENCE_PERIOD_MS);
  const local = elapsed % CHAMBER_PRESENCE_PERIOD_MS - CHAMBER_PRESENCE_START_MS;
  out.active = local > 0 && local < CHAMBER_PRESENCE_DURATION_MS;
  out.phase = Math.max(0, Math.min(1, local / CHAMBER_PRESENCE_DURATION_MS));
  const envelope = Math.sin(out.phase * Math.PI);
  out.alpha = out.active ? envelope * envelope * .52 : 0;
  const reverse = out.cycle % 2 === 1 ? -1 : 1;
  out.x = 498 + (out.phase - .5) * 24 * reverse;
  out.y = 203 + (out.phase - .5) * 5;
}
