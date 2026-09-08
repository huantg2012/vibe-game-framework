/** Authoritative world-space volume geometry. Renderer, contact and foot stain share this field. */
import { DUST_KNOT_COUNT, fillDustKnots } from './dust-flow';
import { VOLUME_PROFILE_DATA, type VolumeProfile } from '@/generated/contamination-volume-data';
export type VolumePhase = 'rest' | 'gather' | 'release' | 'disperse';
export interface VolumeRect { x: number; y: number; w: number; h: number }
export interface VolumePart { cx: number; cy: number; rx: number; ry: number; angle: number; cos: number; sin: number; weight: number }
export interface VolumePresenceFrame {
  substrate: string; coverage: string; elapsedMs: number; phase: VolumePhase; progress: number;
  active: boolean; hazardActive: boolean; rect: VolumeRect; parts: VolumePart[]; partCount: number;
  coreX: number; coreY: number; hasPresence: boolean; travelScale: number; flowX: number; flowY: number; gapPx: number; dangerThreshold: number;
  isWalkableFloor?: (col: number, row: number) => boolean;
}
export interface VolumePresenceInput {
  substrate: string; coverage: string; elapsedMs: number; rect: Readonly<VolumeRect>; active: boolean;
  isWalkableFloor?: (col: number, row: number) => boolean;
}
const MIST_LENGTH = [.46, .57, .39, .35] as const;
const MIST_THICKNESS = [.28, .25, .32, .27] as const;
const MIST_ALONG = [-.40, -.12, .24, .47] as const;
const MIST_ACROSS = [-.62, .65, -.57, .67] as const;
const PHASES: readonly VolumePhase[] = ['rest', 'gather', 'release', 'disperse'];
export function getVolumeProfile(substrate: string): Readonly<VolumeProfile> {
  return VOLUME_PROFILE_DATA[substrate] ?? VOLUME_PROFILE_DATA.sound_echo!;
}
function duration(p: Readonly<VolumeProfile>, phase: VolumePhase): number {
  return phase === 'rest' ? p.restMs : phase === 'gather' ? p.gatherMs : phase === 'release' ? p.releaseMs : p.disperseMs;
}
export function volumeTimeAtPhase(substrate: string, phase: VolumePhase, progress = 0): number {
  const p = getVolumeProfile(substrate); let t = 0;
  for (const key of PHASES) { if (key === phase) return t + duration(p, key) * Math.max(0, Math.min(.999999, progress)); t += duration(p, key); }
  return t;
}
export function createVolumePresenceFrame(): VolumePresenceFrame {
  return { substrate: '', coverage: '', elapsedMs: 0, phase: 'rest', progress: 0, active: false, hazardActive: false,
    rect: { x: 0, y: 0, w: 0, h: 0 }, parts: Array.from({length: DUST_KNOT_COUNT}, () => ({cx: 0, cy: 0, rx: 1, ry: 1, angle: 0, cos: 1, sin: 0, weight: 0})),
    partCount: 0, coreX: 0, coreY: 0, hasPresence: false, travelScale: NaN, flowX: 0, flowY: 0, gapPx: 0, dangerThreshold: .22 };
}
/** Mutates preallocated frame; no per-pixel or per-frame object allocation. Coverage never changes contact geometry. */
export function updateVolumePresenceFrame(f: VolumePresenceFrame, input: VolumePresenceInput): VolumePresenceFrame {
  const p = getVolumeProfile(input.substrate);
  f.substrate = input.substrate; f.coverage = input.coverage; f.elapsedMs = input.elapsedMs;
  if (f.rect.x !== input.rect.x || f.rect.y !== input.rect.y || f.rect.w !== input.rect.w || f.rect.h !== input.rect.h || f.isWalkableFloor !== input.isWalkableFloor) f.travelScale = NaN;
  f.active = input.active; f.isWalkableFloor = input.isWalkableFloor;
  f.rect.x = input.rect.x; f.rect.y = input.rect.y; f.rect.w = input.rect.w; f.rect.h = input.rect.h;
  f.gapPx = p.gapPx; f.dangerThreshold = p.dangerThreshold;
  const cycle = p.restMs + p.gatherMs + p.releaseMs + p.disperseMs;
  let t = ((input.elapsedMs % cycle) + cycle) % cycle;
  for (const phase of PHASES) { const d = duration(p, phase); if (t < d) { f.phase = phase; f.progress = t / d; break; } t -= d; }
  f.hazardActive = f.active && (f.substrate === 'sound_echo' || f.phase === 'release');
  const u = f.progress, cx = f.rect.x + f.rect.w / 2, cy = f.rect.y + f.rect.h / 2;
  const w = f.rect.w * .5, h = f.rect.h * .5;
  const pulse = f.phase === 'gather' ? 1 - u * .45 : f.phase === 'release' ? .55 + Math.sin(u * Math.PI * .5) * .45 : f.phase === 'disperse' ? 1 - u * .15 : .85 + u * .15;
  f.flowX = 0; f.flowY = 0;
  if (f.substrate === 'mist_bank') {
    f.partCount = 4;
    const horizontal = w >= h;
    for (let i = 0; i < 4; i++) {
      const a = f.parts[i]!;
      const drift = Math.sin(input.elapsedMs / (1800 + i * 410) + i * 1.7) * p.travelScale;
      a.cx = cx + (horizontal ? (MIST_ALONG[i]! + drift) * w : MIST_ACROSS[i]! * w);
      a.cy = cy + (horizontal ? MIST_ACROSS[i]! * h : (MIST_ALONG[i]! + drift) * h);
      a.rx = w * (horizontal ? MIST_LENGTH[i]! : MIST_THICKNESS[i]!) * p.radiusScale;
      a.ry = h * (horizontal ? MIST_THICKNESS[i]! : MIST_LENGTH[i]!) * p.radiusScale;
      a.angle = 0; a.weight = 1;
    }
    f.flowX = horizontal ? Math.cos(input.elapsedMs / 2100) : 0;
    f.flowY = horizontal ? 0 : Math.cos(input.elapsedMs / 2100);
  } else if (f.substrate === 'dust_swarm') {
    fillDustKnots(f, p);
  } else {
    f.partCount = 3;
    for (let i = 0; i < 3; i++) {
      const a = f.parts[i]!, theta = i * Math.PI * 2 / 3;
      a.cx = cx + Math.cos(theta) * w * .14 * pulse;
      a.cy = cy + Math.sin(theta) * h * .14 * pulse;
      a.rx = w * p.radiusScale * pulse * .79; a.ry = h * p.radiusScale * pulse * .79;
      a.angle = 0; a.weight = 1;
    }
    f.flowX = f.phase === 'gather' ? -1 : f.phase === 'release' ? 1 : 0;
  }
  for (let i = 0; i < f.partCount; i++) {
    const a = f.parts[i]!; a.cos = Math.cos(a.angle); a.sin = Math.sin(a.angle);
  }
  f.hasPresence = false;
  // Prefer a lobe centre. Terrain clipping may erase one; never leave a hittable
  // nucleus in a wall, void, or the mist's explicit traversal gap.
  for (let i = 0; i < f.partCount; i++) {
    const a = f.parts[i]!;
    if (sampleVolumeDensity(f, a.cx, a.cy) >= f.dangerThreshold) {
      f.coreX = a.cx; f.coreY = a.cy; f.hasPresence = true; break;
    }
  }
  if (!f.hasPresence) {
    for (let y = f.rect.y + 4; y < f.rect.y + f.rect.h && !f.hasPresence; y += 8) {
      for (let x = f.rect.x + 4; x < f.rect.x + f.rect.w; x += 8) {
        if (sampleVolumeDensity(f, x, y) >= f.dangerThreshold) { f.coreX = x; f.coreY = y; f.hasPresence = true; break; }
      }
    }
  }
  if (!f.hasPresence) f.hazardActive = false;
  return f;
}
export function sampleVolumeDensity(f: Readonly<VolumePresenceFrame>, x: number, y: number): number {
  const r = f.rect;
  if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h || (f.isWalkableFloor && !f.isWalkableFloor(Math.floor(x / 32), Math.floor(y / 32)))) return 0;
  if (f.gapPx > 0) {
    const cross = r.w >= r.h ? y - r.y - r.h / 2 : x - r.x - r.w / 2;
    if (Math.abs(cross) < f.gapPx / 2) return 0;
  }
  let density = 0;
  for (let i = 0; i < f.partCount; i++) {
    const a = f.parts[i]!, px = x - a.cx, py = y - a.cy;
    const dx = (px * a.cos + py * a.sin) / a.rx;
    const dy = (-px * a.sin + py * a.cos) / a.ry;
    const radius = dx * dx + dy * dy;
    if (radius >= 1.25) continue;
    // Ragged lobes and tapered strands travel with each knot, rather than a
    // circular cookie cutter moving over an unrelated scrolling texture.
    const edge = f.substrate === 'dust_swarm'
      ? .18 * Math.sin(dx * 10 + i * 2.31) * Math.sin(dy * 8 - i * 1.73)
        + .12 * Math.sin(dx * 19 + dy * 11 + i * 3.17)
      : 0;
    density = Math.max(density, (1 - radius + edge * Math.min(1, radius * 3)) * a.weight);
  }
  return Math.max(0, Math.min(1, density));
}
export function isVolumeDangerousAt(f: Readonly<VolumePresenceFrame>, x: number, y: number): boolean {
  return f.hazardActive && sampleVolumeDensity(f, x, y) >= f.dangerThreshold;
}
