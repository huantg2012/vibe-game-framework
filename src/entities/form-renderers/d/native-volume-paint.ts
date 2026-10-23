/** Native gas is an optical material inside the authoritative density field.
 * This painter never alters hosts, hazards, topology, clocks or floor clipping. */
import { sampleVolumeDensity, type VolumePresenceFrame } from '@/systems/volume-presence';
import type { EnemyWorldAdaptation, EnemyWorldColor } from './world-adaptation';
import { sampleWorldMaterialLight, type WorldMaterialLighting } from './world-material-light';
import { paintVolumePresence } from './volume-paint';

export interface NativeVolumeAppearance { material: EnemyWorldAdaptation; lighting?: WorldMaterialLighting }
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/** Air has no hard faceted normals. Sample its received light on 4px optical
 * cells, bounding expensive world shadow rays to one per cell/light. Density,
 * alpha and the 2px material details remain sampled independently below. */
function volumeLight(lighting: WorldMaterialLighting | undefined, w: number, h: number, left: number, top: number) {
  const cols = Math.ceil(w / 4), cells = lighting ? new Float32Array(cols * Math.ceil(h / 4) * 4) : undefined;
  const result: [number, number, number] = [1, 1, 1];
  return (x: number, y: number): readonly [number, number, number] => {
    if (!lighting || !cells) return result;
    const cx = Math.floor(x / 4), cy = Math.floor(y / 4), i = (cy * cols + cx) * 4;
    if (!cells[i]) {
      sampleWorldMaterialLight(lighting, left + cx * 4 + 2, top + cy * 4 + 2, 12, 0, 0, 1, true, result);
      cells[i] = 1; cells.set(result, i + 1);
    }
    result[0] = cells[i + 1]!; result[1] = cells[i + 2]!; result[2] = cells[i + 3]!;
    return result;
  };
}

/** A shared bounded optical grammar. Families change the organization of vapour,
 * not its state of matter. Coordinates follow the host rather than the screen. */
function vapourPattern(x: number, y: number, time: number, seed: number, world: EnemyWorldAdaptation, level: number): number {
  const phase = (seed % 997) * .037, t = time * .00055;
  const bend = Math.sin(y * .053 + phase + t * .31) * 4 + Math.sin(x * .043 - t * .2) * 3;
  if (world.kind === 'fibre') return Math.sin((x + bend) * .24 + y * .08 - t) * .6 + Math.sin(y * .08 + t * .4) * .3;
  if (world.kind === 'membrane') return Math.sin(x * .065 + y * .11 + Math.sin(x * .08 - t) * 2.4 + t) * .75;
  if (world.kind === 'slab') return Math.sin((y + Math.floor((x + bend) / 12) * 3) * .19 - t * .6) * .7 + Math.sin(x * .04 + t) * .2;
  if (world.kind === 'shell') return Math.sin(Math.hypot(x + bend - 35, (y - 29) * .7) * .18 - t) * Math.sin(x * .041 + y * .07 + phase);
  if (world.kind === 'granular') return Math.sin(x * .29 + bend + t * .3) * Math.sin(y * .32 - t * .4 + phase) * .75 + Math.sin(x * .07 + y * .1) * .25;
  return Math.sin(x * .065 + y * .1 + Math.sin(y * .06 - t * (.4 + level * .1)) * 2.6 - t * .5) * .8;
}

/** Pixel-step materials with a quiet continuous density base. Bright internal
 * wisps cannot carve visual safe holes through dangerous air. */
export function paintNativeVolume(out: Uint8ClampedArray, w: number, h: number, frame: Readonly<VolumePresenceFrame>, seed: number,
  appearance: NativeVolumeAppearance, coreSpan = 0, activityOpacity = frame.active ? 1 : .5): void {
  const dust = frame.substrate === 'dust_swarm', mist = frame.substrate === 'mist_bank';
  // Keep each moving dust parcel's authored fibres and density clipping.
  // Other substrates start from their own optical organization below.
  if (dust) paintVolumePresence(out, w, h, frame, seed, 0, activityOpacity);
  else out.fill(0);
  const world = appearance.material, colors: readonly EnemyWorldColor[] = [world.dark, world.mid, world.light, world.secondary];
  const ox = frame.rect.x + frame.rect.w / 2 - w / 2, oy = frame.rect.y + frame.rect.h / 2 - h / 2;
  const x0 = Math.max(0, Math.floor((w - frame.rect.w) / 2)), x1 = Math.min(w, Math.ceil((w + frame.rect.w) / 2));
  const y0 = Math.max(0, Math.floor((h - frame.rect.h) / 2)), y1 = Math.min(h, Math.ceil((h + frame.rect.h) / 2));
  const level = frame.coverage === 'infiltrate' ? 0 : frame.coverage === 'rewrite' ? 1 : 2;
  const time = frame.active ? frame.elapsedMs : 0, opacity = clamp(activityOpacity);
  const coreX = Math.round(frame.coreX - ox), coreY = Math.round(frame.coreY - oy), halfCore = Math.max(1, Math.ceil(coreSpan / 2));
  const receiveLight = volumeLight(appearance.lighting, w, h, ox, oy);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const wx = ox + x + .5, wy = oy + y + .5, density = sampleVolumeDensity(frame, wx, wy);
    if (density < .035) continue;
    const px = Math.floor((wx - frame.rect.x) / 2) * 2, py = Math.floor((wy - frame.rect.y) / 2) * 2;
    const pattern = vapourPattern(px, py, time, seed, world, level);
    const curl = Math.sin(px * .19 + Math.sin(py * .13 + time * .0004) * 2.4 - time * .0006)
      + Math.sin(py * .27 + Math.sin(px * .1 - time * .0003) * 2) * .55;
    const fold = curl * .6 + pattern * (.45 + level * .13);
    const i = (y * w + x) * 4;
    let band = fold > 1.18 && density > .45 ? 3 : fold > .68 ? 2 : fold > -.38 ? 1 : 0;
    // Pigment density remains legible before the contact threshold; details
    // occupy the interior instead of drawing a luminous contour around it.
    let alpha = Math.round(clamp(density * 1.25) * (60 + level * 8) + Math.abs(fold) * 88 * clamp(density * 4));
    if (band === 0) alpha += Math.round(26 * clamp(density * 3));
    if (density >= frame.dangerThreshold) alpha = Math.max(100, alpha);
    if (mist) {
      const strand = Math.sin(py * .67 + Math.sin(px * .047 - time * .00035) * 3 + pattern * (1.3 + level * .35));
      const broken = Math.sin(px * .18 - py * .08 + seed * .1 + time * .0004) > .7;
      band = !broken && strand > .63 ? 2 : strand > -.2 ? 1 : 0;
      alpha = 18 + density * 30 + (!broken && strand > .4 ? 42 * density : 0);
      if (density >= frame.dangerThreshold) alpha = Math.max(50, alpha);
    } else if (dust) {
      // Stable flecks ride the original independent parcels. Native patterns
      // tint and divide these local fragments, not a second cloud silhouette.
      const luminance = (out[i]! + out[i + 1]! + out[i + 2]!) / 3;
      band = luminance > 155 ? 3 : luminance > 112 ? 2 : luminance > 66 ? 1 : 0;
      if (pattern > .75 && out[i + 3]! > 100 * opacity) band = Math.min(3, band + 1);
      alpha = opacity > 0 ? out[i + 3]! / opacity : 0;
    }
    const light = receiveLight(x, y);
    if (coreSpan > 0 && frame.hasPresence && density >= frame.dangerThreshold
      && Math.abs(x - coreX) <= halfCore && Math.abs(y - coreY) <= halfCore
      && Math.abs(x - coreX) + Math.abs(y - coreY) <= halfCore + 1) { band = 3; alpha = 245; }
    const color = colors[band]!;
    out[i] = Math.round(color[0] * light[0]); out[i + 1] = Math.round(color[1] * light[1]); out[i + 2] = Math.round(color[2] * light[2]);
    out[i + 3] = Math.round(clamp(alpha, 0, 255) * opacity);
  }
}

/** Echo has a different (legacy live-box) host contract. Preserve every alpha
 * sample, pulse and strike nucleus from its own painter, then receive native
 * pigment/light. It must not be converted to a gas density field. */
export function tintNativeEcho(out: Uint8ClampedArray, w: number, h: number, centerX: number, centerY: number,
  appearance: NativeVolumeAppearance): void {
  const { material: world, lighting } = appearance;
  const colors = [world.dark, world.mid, world.light, world.secondary];
  const receiveLight = volumeLight(lighting, w, h, centerX - w / 2, centerY - h / 2);
  for (let i = 0; i < out.length; i += 4) {
    if (!out[i + 3]) continue;
    const brightness = (out[i]! + out[i + 1]! + out[i + 2]!) / 3;
    const color = colors[brightness > 145 ? 3 : brightness > 100 ? 2 : brightness > 60 ? 1 : 0]!;
    const light = receiveLight(i / 4 % w, Math.floor(i / 4 / w));
    out[i] = color[0] * light[0]; out[i + 1] = color[1] * light[1]; out[i + 2] = color[2] * light[2];
  }
}
