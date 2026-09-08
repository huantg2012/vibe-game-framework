/** Persistent, independently advected dust knots. No rigid orbit or tiled motion. */
import type { VolumePresenceFrame } from './volume-presence';
import type { VolumeProfile } from '@/generated/contamination-volume-data';

export const DUST_KNOT_COUNT = 5;
export function dustHash(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
const ease = (t: number) => t * t * (3 - 2 * t);
/** Smooth signed noise, stable under absolute seek and independent of frame rate. */
export function dustNoise(t: number, seed: number): number {
  const i = Math.floor(t), u = ease(t - i);
  return (dustHash(i + seed) * (1 - u) + dustHash(i + seed + 1) * u) * 2 - 1;
}
export function fillDustKnots(f: VolumePresenceFrame, p: Readonly<VolumeProfile>): void {
  f.partCount = DUST_KNOT_COUNT;
  f.travelScale = p.travelScale;
  const r = f.rect, w = r.w / 2, h = r.h / 2;
  const seed = Math.imul(Math.round(r.x + r.w * 7), 31) ^ Math.round(r.y + r.h * 13);
  const time = f.elapsedMs / 1000;
  const cycle = p.restMs + p.gatherMs + p.releaseMs + p.disperseMs;
  const wind = dustNoise(time * .13, seed + 917) * .9;
  const horizontal = r.w >= r.h;
  for (let i = 0; i < f.partCount; i++) {
    const a = f.parts[i]!, k = seed + i * 7919;
    const delayed = f.elapsedMs - dustHash(k + 8) * 360;
    const t = ((delayed % cycle) + cycle) % cycle;
    let pull = 0, sweep = 0;
    if (t >= p.restMs && t < p.restMs + p.gatherMs) {
      pull = ease((t - p.restMs) / p.gatherMs);
    } else if (t >= p.restMs + p.gatherMs && t < cycle - p.disperseMs) {
      sweep = ease((t - p.restMs - p.gatherMs) / p.releaseMs);
      pull = 1 - .75 * sweep;
    } else if (t >= cycle - p.disperseMs) {
      sweep = 1 - ease((t - cycle + p.disperseMs) / p.disperseMs);
      pull = .25 * sweep;
    }
    const bx = (dustHash(k + 1) * 2 - 1) * .78;
    const by = (dustHash(k + 2) * 2 - 1) * .78;
    const speed = .18 + dustHash(k + 3) * .24;
    const nx = dustNoise(time * speed, k + 101);
    const ny = dustNoise(time * speed * .77, k + 209);
    // Each knot responds at a different time and angle, retaining stragglers.
    const drag = .45 + dustHash(k + 4) * .55;
    const turn = wind + (dustHash(k + 5) - .5) * 1.5;
    const impulse = sweep * p.travelScale * drag;
    const dx = Math.cos(turn) * impulse, dy = Math.sin(turn) * impulse;
    const x = bx * (1 - pull * .51 * drag) + nx * .25 + (horizontal ? dx : dy);
    const y = by * (1 - pull * .43 * drag) + ny * .25 + (horizontal ? dy : dx);
    a.cx = r.x + w + Math.tanh(x * 1.2) * w * .68;
    a.cy = r.y + h + Math.tanh(y * 1.2) * h * .68;
    const size = .29 + dustHash(k + 6) * .13;
    const shortAxis = Math.min(w, h);
    const breathing = 1 + dustNoise(time * .37, k + 301) * .15 - pull * .12;
    // Broad suspended tufts: one mass reads larger than a crawling creature.
    // The short stage axis bounds rotation without slicing a straight edge.
    a.rx = shortAxis * size * p.radiusScale * breathing * (1 + sweep * .32 * drag);
    a.ry = shortAxis * size * p.radiusScale * breathing * (.76 + dustHash(k + 7) * .24);
    a.angle = (dustHash(k + 9) - .5) * Math.PI + dustNoise(time * .23, k + 419) * .65;
    a.weight = .78 + dustHash(k + 10) * .22;
  }
  f.flowX = Math.cos(wind); f.flowY = Math.sin(wind);
}
