/** Coherent mid-scale air forms, clipped to the actual moving density lobes.
 * No per-world overrides, screen overlays, extra simulation or fabricated gaps. */
import { sampleVolumeDensity, type VolumePresenceFrame } from '@/systems/volume-presence';
import { dustHash } from '@/systems/dust-flow';
import type { NativeVolumeAppearance } from './native-volume-paint';
import { volumeLight } from './volume-light';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
function tuftNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = dustHash(ix * 173 + iy * 7919 + seed), b = dustHash((ix + 1) * 173 + iy * 7919 + seed);
  const c = dustHash(ix * 173 + (iy + 1) * 7919 + seed), d = dustHash((ix + 1) * 173 + (iy + 1) * 7919 + seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

export function paintNativeVapour(out: Uint8ClampedArray, w: number, h: number,
  f: Readonly<VolumePresenceFrame>, seed: number, appearance: NativeVolumeAppearance,
  coreSpan: number, activityOpacity: number): void {
  out.fill(0);
  const dust = f.substrate === 'dust_swarm', m = appearance.material;
  const level = f.coverage === 'infiltrate' ? 0 : f.coverage === 'rewrite' ? 1 : 2;
  const colors = [m.dark, m.mid, m.light, m.secondary];
  const ox = f.rect.x + f.rect.w / 2 - w / 2, oy = f.rect.y + f.rect.h / 2 - h / 2;
  const x0 = Math.max(0, Math.floor((w - f.rect.w) / 2)), x1 = Math.min(w, Math.ceil((w + f.rect.w) / 2));
  const y0 = Math.max(0, Math.floor((h - f.rect.h) / 2)), y1 = Math.min(h, Math.ceil((h + f.rect.h) / 2));
  const time = f.active ? f.elapsedMs * .001 : 0, opacity = clamp(activityOpacity);
  const lightAt = volumeLight(appearance.lighting, w, h, ox, oy);
  // Optical depth darkens a fold's interior, rather than adding a black outline.
  const write = (x: number, y: number, band: number, alpha: number, shade = 1): void => {
    const i = (y * w + x) * 4, color = colors[band]!, light = lightAt(x, y);
    out[i] = color[0] * light[0] * shade; out[i + 1] = color[1] * light[1] * shade;
    out[i + 2] = color[2] * light[2] * shade; out[i + 3] = Math.round(alpha * opacity);
  };
  const familyPitch = m.kind === 'fibre' ? .56 : m.kind === 'slab' ? .31 : m.kind === 'granular' ? .69 : .41;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const wx = ox + x + .5, wy = oy + y + .5, d = sampleVolumeDensity(f, wx, wy);
    if (d < .035) continue;
    let nearest = 0, score = Infinity;
    for (let k = 0; k < f.partCount; k++) {
      const p = f.parts[k]!, dx = wx - p.cx, dy = wy - p.cy;
      const r = ((dx * p.cos + dy * p.sin) / p.rx) ** 2 + ((-dx * p.sin + dy * p.cos) / p.ry) ** 2;
      if (r < score) { score = r; nearest = k; }
    }
    const p = f.parts[nearest]!, dx = wx - p.cx, dy = wy - p.cy;
    const u = Math.floor((dx * p.cos + dy * p.sin) / 2) * 2;
    const v = Math.floor((-dx * p.sin + dy * p.cos) / 2) * 2;
    const phase = nearest * 2.17 + seed * .13;
    const roll = Math.sin(u * .092 - time * .92 + phase) * 2.6
      + Math.sin(u * .037 + time * .43 - phase) * 2.1;
    const grain = tuftNoise(u * .15 + time * .22, v * .18 - time * .35, seed + nearest * 19);
    const rolling = Math.sin(u * .14 + Math.sin(v * .18 - time) * 2 + time * .7 + phase)
      * Math.sin(v * .21 + Math.sin(u * .09 + time * .6) * 2.3 - time * .9);
    const fold = dust ? grain * 2 - 1 : rolling * .77 + Math.sin((v + roll) * .31) * .23;
    const fray = Math.sin(u * familyPitch + v * .21 + phase) * Math.sin(v * .52 - time * .7);
    // The wide dark fold and lit leading face survive noisy bright and dark
    // ground. Low-stage air has a full body too; stages add splitting/overlap.
    let band = fold > .68 ? 2 : fold > (dust ? -.04 : -.36) ? 1 : 0;
    if (m.kind === 'membrane' && fold > .88 || m.kind === 'gel' && fold > .94) band = 3;
    if (m.kind === 'granular' && fray > .5) band = 2;
    if (m.kind === 'shell' && Math.sin(u * .12 + v * .08 + phase) > .78) band = Math.max(0, band - 1);
    // Never form a dark rim around a fog lobe. Wisps taper into the air and
    // deep optical folds only occur inside, unlike the edge of a solid plate.
    if (!dust && d < .24 && band === 0) band = 1;
    const edge = clamp((d - .035 - (1 - grain) * (dust ? .15 : .24)) * (dust ? 5 : 3.4));
    let alpha = edge * (dust ? 110 + grain * 120 : 90 + d * 80 + Math.abs(fold) * 35);
    if (!dust) alpha *= .63 + grain * .52;
    if (dust && fray > .33) alpha *= .55;
    if (d >= f.dangerThreshold) alpha = Math.max(88, alpha);
    write(x, y, band, alpha, band === 0 ? .68 : 1);
  }
  if (dust) {
    // Unequal torn bundles follow each authoritative parcel, with delayed tips.
    // These are fixed short strokes, not a second particle or collision system.
    for (let k = 0; k < f.partCount; k++) {
      const p = f.parts[k]!;
      for (let n = 0; n < 10 + level * 4; n++) {
        const s = seed + k * 173 + n * 37;
        const u = (dustHash(s) * 2 - 1) * p.rx * .8;
        const v = (dustHash(s + 1) * 2 - 1) * p.ry * .72;
        const length = 4 + Math.floor(dustHash(s + 2) * (7 + level * 3));
        const delay = dustHash(s + 3) * 4;
        const slope = (dustHash(s + 4) - .5) * 1.9;
        for (let t = 0; t < length; t++) {
          const xx = u - t, yy = v + t * slope + Math.sin(time * 2.5 - t * .37 + delay) * (1 + t * .15);
          const x = Math.round(p.cx + xx * p.cos - yy * p.sin - ox);
          const y = Math.round(p.cy + xx * p.sin + yy * p.cos - oy);
          for (let j = 0; j < 2; j++) {
            if (x < 0 || x >= w || y + j < 0 || y + j >= h) continue;
            const d = sampleVolumeDensity(f, x + ox + .5, y + j + oy + .5);
            if (d < .035) continue;
            const a = Math.max(d >= f.dangerThreshold ? 88 : 0, (t < length - 2 ? 195 : 105) * clamp((d - .035) * 5));
            write(x, y + j, j ? 0 : n % 4 === 0 ? 3 : n % 3 === 0 ? 1 : 2, a, j ? .68 : 1);
          }
        }
      }
    }
  }
  // The gameplay nucleus is not allowed to drift with a decorative bright tip.
  if (coreSpan > 0 && f.hasPresence) {
    const cx = Math.round(f.coreX - ox), cy = Math.round(f.coreY - oy), r = Math.max(1, Math.ceil(coreSpan / 2));
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
      if (Math.abs(x - cx) + Math.abs(y - cy) <= r + 1 && sampleVolumeDensity(f, x + ox + .5, y + oy + .5) >= f.dangerThreshold)
        write(x, y, 3, 245);
    }
  }
}
