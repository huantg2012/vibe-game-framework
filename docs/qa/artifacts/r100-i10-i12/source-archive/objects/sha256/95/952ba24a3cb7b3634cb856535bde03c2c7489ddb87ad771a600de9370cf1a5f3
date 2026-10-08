/** Presentation-only hit impulses. No physics, AI state or attack clocks live here. */
export interface HitReactionFrame { x: number; y: number; scaleX: number; scaleY: number }
export interface VisualHit { readonly dx: number; readonly dy: number }
const listeners = new Map<string, Set<(hit: VisualHit) => void>>();

export function observeVisualHits(id: string, listener: (hit: VisualHit) => void): () => void {
  let group = listeners.get(id);
  if (!group) { group = new Set(); listeners.set(id, group); }
  group.add(listener);
  return () => { group!.delete(listener); if (!group!.size) listeners.delete(id); };
}

/** Called exclusively after a real target passes the authoritative hit tests. */
export function notifyVisualHit(id: string, dx: number, dy: number): void {
  const group = listeners.get(id);
  if (!group) return;
  const length = Math.hypot(dx, dy) || 1;
  const hit = { dx: dx / length, dy: dy / length };
  for (const listener of group) listener(hit);
}

/** A short forced displacement, then a damped recoil. Baseline restored exactly. */
export class HitReaction {
  private ageMs = 220;
  private dx = 0;
  private dy = 0;
  readonly frame: HitReactionFrame = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  readonly receive = (hit: VisualHit): void => {
    this.ageMs = 0; this.dx = hit.dx; this.dy = hit.dy;
  };
  advance(deltaMs: number): Readonly<HitReactionFrame> {
    this.ageMs = Math.min(220, this.ageMs + Math.max(0, deltaMs));
    if (this.ageMs >= 220) {
      this.frame.x = 0; this.frame.y = 0; this.frame.scaleX = 1; this.frame.scaleY = 1; return this.frame;
    }
    const t = this.ageMs / 220;
    const envelope = t >= 1 ? 0 : Math.sin(Math.min(1, t / .12) * Math.PI * .5) * Math.pow(1 - t, 1.8);
    const rebound = envelope * Math.cos(t * Math.PI * 1.35);
    this.frame.x = this.dx * 4 * rebound;
    this.frame.y = this.dy * 4 * rebound;
    this.frame.scaleX = 1 + envelope * (.065 * Math.abs(this.dy) - .17 * Math.abs(this.dx));
    this.frame.scaleY = 1 + envelope * (.065 * Math.abs(this.dx) - .17 * Math.abs(this.dy));
    return this.frame;
  }
}
