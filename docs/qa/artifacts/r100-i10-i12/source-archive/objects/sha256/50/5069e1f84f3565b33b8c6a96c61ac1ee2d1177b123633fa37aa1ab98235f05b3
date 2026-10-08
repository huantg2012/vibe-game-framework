/**
 * Layers 7–9: sky occlusion, ground fog, motes, seeps.
 * A field over the island, not a handful of named FX cases.
 *
 * Pipeline:
 *   1. Shared wind axis (seed).
 *   2. Finite capsule occluders (a mass passing overhead), slid by phase.
 *   3. Fog seeded from topology, blurred (pools), advected along wind.
 *   4. Motes sampled from fog² and drifted along wind.
 *   5. Seep glows at glitch cells; local fog bump.
 *
 * Same field animates by moving phase — fog stays, capsules and motes slide on the wind.
 * Learns from the purification stack (edge fade, teal seeps, drifting motes)
 * without copying the polar membrane.
 */

/** One full slide of the sky mass across the island. Fog does not move. */
export const SKY_SLIDE_PERIOD_MS = 8000;
/** Capsule motion blur; matches the 8-frame gallery loop. */
export const SKY_TRAVEL_SCALE = 0.35;
/** How often the live rift refreshes the low-res sky overlay. */
export const SKY_REPAINT_MS = 180;

import type { AtmosphereField, OverlayStamp, RuinCell, SkyOccluder } from '@/generation/types';
import { SeededRandom } from '@/utils/random';

export interface AtmosphereSpec {
  /** Overhead mass. 0 = none, 1 = a huge body crossing most of the island. */
  readonly skyShadow: number;
  /** Ground fog amount. 0 = dry, 1 = rim/hollow/open fully pooled. */
  readonly fog: number;
  /** Mote count budget. Actual placement is weighted by fog². */
  readonly motes: number;
  /** Teal seep at glitch cells. 0 = none, 1 = strong wound light. */
  readonly seep: number;
  /** Fog pooling weights. Need not sum to 1; they are normalized. */
  readonly poolRim: number;
  readonly poolHollow: number;
  readonly poolOpen: number;
}

export interface AtmosphereMetrics {
  readonly fogMeanLand: number;
  readonly fogSpread: number;
  readonly shadeMeanLand: number;
  readonly occluderCount: number;
}

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function hash01(col: number, row: number, salt: number): number {
  let h = (col * 374761393 + row * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >> 13), 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function exteriorVoidMask(land: Uint8Array, cols: number, rows: number): Uint8Array {
  const ext = new Uint8Array(land.length);
  const stack: number[] = [];
  const mark = (i: number): void => {
    if (i < 0 || i >= land.length || land[i] || ext[i]) return;
    ext[i] = 1;
    stack.push(i);
  };
  for (let col = 0; col < cols; col++) {
    mark(at(cols, col, 0));
    mark(at(cols, col, rows - 1));
  }
  for (let row = 0; row < rows; row++) {
    mark(at(cols, 0, row));
    mark(at(cols, cols - 1, row));
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const col = i % cols;
    const row = (i / cols) | 0;
    if (col > 0) mark(i - 1);
    if (col < cols - 1) mark(i + 1);
    if (row > 0) mark(i - cols);
    if (row < rows - 1) mark(i + cols);
  }
  return ext;
}

function distField(source: Uint8Array, cols: number, rows: number): Float32Array {
  const inf = cols + rows + 1;
  const dist = new Float32Array(source.length);
  dist.fill(inf);
  const q: number[] = [];
  for (let i = 0; i < source.length; i++) {
    if (!source[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  let head = 0;
  while (head < q.length) {
    const i = q[head++]!;
    const col = i % cols;
    const row = (i / cols) | 0;
    const nd = dist[i]! + 1;
    const push = (j: number): void => {
      if (nd < dist[j]!) {
        dist[j] = nd;
        q.push(j);
      }
    };
    if (col > 0) push(i - 1);
    if (col < cols - 1) push(i + 1);
    if (row > 0) push(i - cols);
    if (row < rows - 1) push(i + cols);
  }
  return dist;
}

function sampleScalar(field: Float32Array, cols: number, rows: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const g = (c: number, r: number): number => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return 0;
    return field[r * cols + c]!;
  };
  return (
    g(x0, y0) * (1 - tx) * (1 - ty) +
    g(x0 + 1, y0) * tx * (1 - ty) +
    g(x0, y0 + 1) * (1 - tx) * ty +
    g(x0 + 1, y0 + 1) * tx * ty
  );
}

function capsuleKernel(x: number, y: number, cx: number, cy: number, oc: SkyOccluder): number {
  const dx = x - cx;
  const dy = y - cy;
  const along = dx * oc.ux + dy * oc.uy;
  const across = -dx * oc.uy + dy * oc.ux;
  const clamped = along < -oc.length ? -oc.length : along > oc.length ? oc.length : along;
  const dist = Math.hypot(along - clamped, across);
  const inner = oc.halfWidth - oc.softness;
  const outer = oc.halfWidth + oc.softness;
  if (dist <= inner) return 1;
  if (dist >= outer) return 0;
  return 1 - (dist - inner) / Math.max(0.01, outer - inner);
}

export function occluderCoverage(
  x: number,
  y: number,
  oc: SkyOccluder,
  slideX = 0,
  slideY = 0,
  travelScale = 1,
): number {
  const cx = oc.restCx + slideX;
  const cy = oc.restCy + slideY;
  const travel = oc.travel * travelScale;
  let acc = 0;
  const samples = 5;
  for (let s = 0; s < samples; s++) {
    const t = (s / (samples - 1) - 0.5) * travel;
    acc += capsuleKernel(x, y, cx + oc.ux * t, cy + oc.uy * t, oc);
  }
  return (acc / samples) * oc.strength;
}

function buildOccluders(
  spec: AtmosphereSpec,
  cols: number,
  rows: number,
  windX: number,
  windY: number,
  rng: SeededRandom,
): SkyOccluder[] {
  if (spec.skyShadow <= 0.04) return [];
  const restCx = cols * 0.5;
  const restCy = rows * 0.5;
  const occluders: SkyOccluder[] = [
    {
      restCx,
      restCy,
      ux: windX,
      uy: windY,
      length: 8 + spec.skyShadow * 10,
      halfWidth: 1.5 + spec.skyShadow * 2.6,
      softness: 1.1 + spec.skyShadow * 1.3,
      strength: 0.4 + spec.skyShadow * 0.28,
      travel: 2 + spec.skyShadow * 3.8,
    },
  ];
  if (spec.skyShadow > 0.48) {
    const perpX = -windY;
    const perpY = windX;
    const side = rng.next() < 0.5 ? -1 : 1;
    occluders.push({
      restCx: restCx - windX * (7 + spec.skyShadow * 4) + perpX * side * (2.2 + rng.next() * 2),
      restCy: restCy - windY * (7 + spec.skyShadow * 4) + perpY * side * (2.2 + rng.next() * 2),
      ux: windX,
      uy: windY,
      length: 3 + spec.skyShadow * 4.5,
      halfWidth: 0.9 + spec.skyShadow * 1.4,
      softness: 0.9 + spec.skyShadow * 0.6,
      strength: 0.2 + spec.skyShadow * 0.16,
      travel: 1.6 + spec.skyShadow * 2.4,
    });
  }
  return occluders;
}

function blurFog(fog: Float32Array, cols: number, rows: number): void {
  const next = new Float32Array(fog.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      let acc = fog[i]! * 0.4;
      let w = 0.4;
      if (col > 0) {
        acc += fog[i - 1]! * 0.15;
        w += 0.15;
      }
      if (col < cols - 1) {
        acc += fog[i + 1]! * 0.15;
        w += 0.15;
      }
      if (row > 0) {
        acc += fog[i - cols]! * 0.15;
        w += 0.15;
      }
      if (row < rows - 1) {
        acc += fog[i + cols]! * 0.15;
        w += 0.15;
      }
      next[i] = acc / w;
    }
  }
  fog.set(next);
}

function advectFog(
  fog: Float32Array,
  cols: number,
  rows: number,
  windX: number,
  windY: number,
): void {
  const src = new Float32Array(fog);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      const sampled = sampleScalar(src, cols, rows, col - windX * 1.5, row - windY * 1.5);
      fog[i] = fog[i]! * 0.62 + sampled * 0.38;
    }
  }
}

export function buildAtmosphere(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  spec: AtmosphereSpec,
  glitches: readonly RuinCell[],
  rng: SeededRandom,
): AtmosphereField {
  const phase = rng.next();
  const angle = rng.next() * Math.PI * 2;
  const windX = Math.cos(angle);
  const windY = Math.sin(angle);
  const slideSpan = Math.hypot(cols, rows) * 0.72;
  const occluders = buildOccluders(spec, cols, rows, windX, windY, rng);

  const exterior = exteriorVoidMask(land, cols, rows);
  const hollow = new Uint8Array(land.length);
  for (let i = 0; i < land.length; i++) {
    if (!land[i] && !exterior[i]) hollow[i] = 1;
  }
  const distExt = distField(exterior, cols, rows);
  const distHollow = distField(hollow, cols, rows);
  const distLand = distField(land, cols, rows);
  const distWall = distField(walls, cols, rows);

  const poolSum = spec.poolRim + spec.poolHollow + spec.poolOpen;
  const wRim = poolSum > 0 ? spec.poolRim / poolSum : 0.48;
  const wHollow = poolSum > 0 ? spec.poolHollow / poolSum : 0.34;
  const wOpen = poolSum > 0 ? spec.poolOpen / poolSum : 0.18;

  const fog = new Float32Array(land.length);
  const inf = cols + rows + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      const grain = 0.78 + 0.44 * hash01(col, row, 91);
      if (!land[i]) {
        if (hollow[i]) fog[i] = spec.fog * 0.95 * grain;
        else fog[i] = spec.fog * 0.8 * Math.max(0, 1 - distLand[i]! / 3.5) * grain;
        continue;
      }
      const rim = Math.max(0, 1 - distExt[i]! / 4);
      const pit = distHollow[i]! >= inf - 1 ? 0 : Math.max(0, 1 - distHollow[i]! / 3);
      const open = Math.min(1, Math.max(0, (distWall[i]! - 1) / 3.5));
      let v = spec.fog * (wRim * rim + wHollow * pit + wOpen * open) * grain;
      if (walls[i]) v *= 0.28;
      fog[i] = v;
    }
  }

  if (spec.seep > 0) {
    for (const g of glitches) {
      const i = at(cols, g.col, g.row);
      if (i < 0 || i >= fog.length) continue;
      fog[i] = Math.min(1, fog[i]! + spec.seep * 0.18);
    }
  }

  blurFog(fog, cols, rows);
  blurFog(fog, cols, rows);
  advectFog(fog, cols, rows, windX, windY);

  const motes: OverlayStamp[] = [];
  const floors: Array<{ col: number; row: number; fog: number }> = [];
  let weightSum = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i] || walls[i]) continue;
      const w = fog[i]! * fog[i]!;
      floors.push({ col, row, fog: fog[i]! });
      weightSum += w;
    }
  }
  const want = spec.motes;
  if (floors.length > 0 && weightSum > 0) {
    let guard = 0;
    while (motes.length < want && guard++ < want * 12) {
      let pick = rng.next() * weightSum;
      let cell = floors[0]!;
      for (const f of floors) {
        pick -= f.fog * f.fog;
        if (pick <= 0) {
          cell = f;
          break;
        }
      }
      const drift = 0.15 + rng.next() * 0.55;
      motes.push({
        kind: 'mote',
        col: cell.col + 0.5 + windX * drift,
        row: cell.row + 0.5 + windY * drift,
        radiusTiles: 0.1 + cell.fog * 0.1,
        strength: 0.36 + rng.next() * 0.38 + cell.fog * 0.24,
      });
    }
  }

  if (spec.seep > 0) {
    for (const g of glitches) {
      motes.push({
        kind: 'glow',
        col: g.col + 0.5,
        row: g.row + 0.5,
        radiusTiles: 0.9 + spec.seep * 1.2,
        strength: 0.18 + spec.seep * 0.5,
      });
    }
  }

  return { phase, slideSpan, windX, windY, occluders, fog, motes };
}

export function measureAtmosphere(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  field: AtmosphereField,
): AtmosphereMetrics {
  let fogSum = 0;
  let fogMin = 1;
  let fogMax = 0;
  let shadeSum = 0;
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i] || walls[i]) continue;
      n++;
      const f = field.fog[i]!;
      fogSum += f;
      if (f < fogMin) fogMin = f;
      if (f > fogMax) fogMax = f;
      shadeSum += shadeAt(field, col + 0.5, row + 0.5);
    }
  }
  return {
    fogMeanLand: n === 0 ? 0 : fogSum / n,
    fogSpread: n === 0 ? 0 : fogMax - fogMin,
    shadeMeanLand: n === 0 ? 0 : shadeSum / n,
    occluderCount: field.occluders.length,
  };
}

/** Mote rest poses are baked at `field.phase`. Live/gallery slide from that origin along wind. */
export function moteSlide(
  field: AtmosphereField,
  phase: number,
): { dx: number; dy: number } {
  const t = (phase - field.phase) * field.slideSpan;
  return { dx: field.windX * t, dy: field.windY * t };
}

export function shadeAt(
  field: AtmosphereField,
  x: number,
  y: number,
  phase = field.phase,
  travelScale = 1,
): number {
  const slide = (phase - 0.5) * field.slideSpan;
  const sx = field.windX * slide;
  const sy = field.windY * slide;
  let shade = 0;
  for (const oc of field.occluders) shade += occluderCoverage(x, y, oc, sx, sy, travelScale);
  return clamp01(shade);
}
