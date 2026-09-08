import { paintSurfaceMaterial } from './material';
/**
 * 占漆拓扑烘焙。挂载与 `check:paint-genome-topology` 共用这一条。
 * 画布数字对齐 `bingRecipeFromForm`（场 144，否则 88），不用占地 32/48/64。
 * 配色走 `deriveFragmentContamRamp`；core/glow 用现有青绿格 snap，不加新色。
 */
import {
  deriveFragmentContamRamp,
  LEXICON_DEFAULT_FRAGMENT,
  type FragmentContamRamp,
  type Rgb,
} from '@/entities/form-renderers/d/fragment-ramp';
import {
  fillPaintTopology,
  makePaintField,
  senseAngleOf,
  topologyOf,
  type PaintField,
  type PaintTopology,
  type PaintVeinVariant,
} from '@/entities/form-renderers/d/paint-genome/topology';
import type { ContinuityId, CoverageId } from '@/generated/contamination-lexicon-data';
import { mix32 } from '@/generation/seed-fork';

export interface PaintGenomeBuf {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

export interface PaintGenomeBakeRequest {
  readonly substrate: string;
  readonly coverage: CoverageId;
  readonly seed: number;
  /** 缺省 colony（菌毯合法连续；非场 = 88）。场 = 144。 */
  readonly continuity?: ContinuityId;
  readonly sense?: string;
  readonly rhythm?: string;
  readonly fragmentTypeId?: string;
  /** 缺省不传仍走树（闸门对照 / A/B/C）。生产挂载先采样再传入 3/4/5。 */
  readonly veinVariant?: PaintVeinVariant;
}

export interface PaintGenomeBakeResult {
  readonly buf: PaintGenomeBuf;
  /** Topology field after core dots, before colour. Live breath resamples this. */
  readonly field: Float32Array;
  readonly ramp: FragmentContamRamp;
  readonly topology: PaintTopology;
  /** Rest-pose growth axes for the live layer. Not a second topology. */
  readonly growth: PaintGrowthGuide;
  readonly canvasW: number;
  readonly canvasH: number;
}

const PAINT_GROWTH_UNIT_CAP = 12;

/** Per-organism rest guide: live layer deforms along these axes, not the canvas. */
export interface PaintGrowthGuide {
  readonly topology: PaintTopology;
  /** Oil-film card. Undefined = default tree. Live branches only for 3/4/5. */
  readonly veinVariant?: PaintVeinVariant;
  readonly senseAngle: number;
  readonly lobeCount: number;
  readonly unitCount: number;
  readonly ox: Float32Array;
  readonly oy: Float32Array;
  readonly span: Float32Array;
  readonly innerR: Float32Array;
  readonly outerR: Float32Array;
  readonly unitIndex: Uint8Array;
}

/** Glow / core band floor. Live layer pins these dots so inflated cannot smear into a teal flash. */
export const PAINT_CORE_LO = 0.78;

/** Same numbers as `bingRecipeFromForm` canvasW/H. Not occupancy 32/48/64. */
export function paintGenomeCanvasOf(continuity: ContinuityId = 'colony'): {
  readonly w: number;
  readonly h: number;
} {
  const field = continuity === 'field';
  return { w: field ? 144 : 88, h: field ? 144 : 88 };
}

/**
 * Visible paint (field ≥ 0.1, same floor as `colorPaintField`) → world floor tiles.
 * Canvas is centered on `originX` / `originY`. Does not write collision.
 */
export function collectPaintGenomeFloorTiles(
  field: Float32Array,
  w: number,
  h: number,
  originX: number,
  originY: number,
  tileSize: number,
): { readonly col: number; readonly row: number }[] {
  const left = originX - w * 0.5;
  const top = originY - h * 0.5;
  const seen = new Set<string>();
  const out: { col: number; row: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (field[y * w + x]! < 0.1) continue;
      const col = Math.floor((left + x + 0.5) / tileSize);
      const row = Math.floor((top + y + 0.5) / tileSize);
      const key = `${col},${row}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ col, row });
    }
  }
  return out;
}

const CORE_TEALS: readonly Rgb[] = [
  [0x1a, 0xad, 0x96],
  [0x2a, 0xe6, 0xc8],
  [0x3c, 0xff, 0xd4],
];

function snapBright(rgb: Rgb): Rgb {
  let best = CORE_TEALS[0]!;
  let bestD = Infinity;
  for (const p of CORE_TEALS) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function fragmentRamp(fragmentTypeId: string): FragmentContamRamp {
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  return {
    deep: ramp.deep,
    mid: ramp.mid,
    core: snapBright(ramp.core),
    glow: snapBright(ramp.glow),
  };
}

const STAGE: Record<CoverageId, number> = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2,
};

/** B：边缘 / 末端提到现有 core/glow 档，并向空邻格扩 1px 膜边。不加新色。 */
function applyFilmSheen(field: PaintField): void {
  const { v, w, h } = field;
  const next = new Float32Array(v);
  const at = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return v[y * w + x]!;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const cur = v[i]!;
      const n = at(x, y - 1);
      const s = at(x, y + 1);
      const e = at(x + 1, y);
      const west = at(x - 1, y);
      const emptyN =
        (n < 0.1 ? 1 : 0) + (s < 0.1 ? 1 : 0) + (e < 0.1 ? 1 : 0) + (west < 0.1 ? 1 : 0);
      if (cur >= 0.1) {
        if (emptyN >= 3) next[i] = 1;
        else if (emptyN >= 1) next[i] = Math.max(cur, 0.86);
      } else if (n >= 0.1 || s >= 0.1 || e >= 0.1 || west >= 0.1) {
        next[i] = 0.26;
      }
    }
  }
  v.set(next);
}

function lobeCountOf(rhythm: string): number {
  if (rhythm === 'rhythm_pulse') return 7;
  if (rhythm === 'rhythm_sleep') return 3;
  if (rhythm === 'rhythm_cluster') return 5;
  return 4;
}

function pickGrowthUnit(
  x: number,
  y: number,
  topology: PaintTopology,
  unitCount: number,
  ox: Float32Array,
  oy: Float32Array,
  innerR: Float32Array,
  outerR: Float32Array,
): number {
  if (unitCount <= 1) return 0;
  let nearest = 0;
  let nearestD = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dx = x - ox[i]!;
    const dy = y - oy[i]!;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD) {
      nearestD = d2;
      nearest = i;
    }
  }
  if (topology !== 'holed_veil') return nearest;
  const originX = ox[nearest]!;
  const originY = oy[nearest]!;
  const r = Math.hypot(x - originX, y - originY);
  let band = nearest;
  let bestErr = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dOx = ox[i]! - originX;
    const dOy = oy[i]! - originY;
    if (dOx * dOx + dOy * dOy > 144) continue;
    const mid = 0.5 * (innerR[i]! + outerR[i]!);
    const err = Math.abs(r - mid);
    if (err < bestErr) {
      bestErr = err;
      band = i;
    }
  }
  return band;
}

function collectBeadPeaks(
  field: Float32Array,
  w: number,
  h: number,
): { x: number; y: number; v: number }[] {
  const raw: { x: number; y: number; v: number }[] = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const v = field[i]!;
      if (v < 0.42) continue;
      let higher = 0;
      for (let oyOff = -2; oyOff <= 2; oyOff++) {
        for (let oxOff = -2; oxOff <= 2; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          if (field[(y + oyOff) * w + (x + oxOff)]! > v + 1e-6) higher += 1;
        }
      }
      if (higher > 0) continue;
      raw.push({ x: x + 0.5, y: y + 0.5, v });
    }
  }
  raw.sort((a, b) => b.v - a.v || a.y - b.y || a.x - b.x);
  const kept: { x: number; y: number; v: number }[] = [];
  const minD2 = 49;
  const floor = raw[0] !== undefined ? raw[0].v * 0.72 : 1;
  for (const p of raw) {
    if (p.v < floor) break;
    if (kept.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < minD2)) continue;
    kept.push(p);
    if (kept.length >= PAINT_GROWTH_UNIT_CAP) break;
  }
  return kept;
}

function assignGrowthUnits(
  w: number,
  h: number,
  topology: PaintTopology,
  unitCount: number,
  ox: Float32Array,
  oy: Float32Array,
  innerR: Float32Array,
  outerR: Float32Array,
): Uint8Array {
  const unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      unitIndex[y * w + x] = pickGrowthUnit(
        x + 0.5,
        y + 0.5,
        topology,
        unitCount,
        ox,
        oy,
        innerR,
        outerR,
      );
    }
  }
  return unitIndex;
}

function buildBeadGrowthGuide(
  field: Float32Array,
  w: number,
  h: number,
  topology: PaintTopology,
  sense: string,
  rhythm: string,
): PaintGrowthGuide {
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const peaks = collectBeadPeaks(field, w, h);
  let unitCount = 0;
  for (const p of peaks) {
    ox[unitCount] = p.x;
    oy[unitCount] = p.y;
    unitCount += 1;
  }
  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.2;
    outerR[0] = span[0]!;
    unitCount = 1;
  }
  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);
  if (peaks.length > 0) {
    const maxR = new Float32Array(unitCount);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (field[i]! < 0.1) continue;
        const u = unitIndex[i]!;
        const r = Math.hypot(x + 0.5 - ox[u]!, y + 0.5 - oy[u]!);
        if (r > maxR[u]!) maxR[u] = r;
      }
    }
    for (let u = 0; u < unitCount; u++) {
      span[u] = Math.max(1.5, maxR[u]!);
      outerR[u] = span[u]!;
    }
  }
  return {
    topology,
    veinVariant: 3,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex,
  };
}

function buildPaintGrowthGuide(
  field: Float32Array,
  w: number,
  h: number,
  topology: PaintTopology,
  sense: string,
  rhythm: string,
  veinVariant?: PaintVeinVariant,
): PaintGrowthGuide {
  if (veinVariant === 3) return buildBeadGrowthGuide(field, w, h, topology, sense, rhythm);
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const cs = Math.cos(senseAngle);
  const sn = Math.sin(senseAngle);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = new Int32Array(w * h);
  let unitCount = 0;
  const rimPool = veinVariant === 5;

  for (let start = 0; start < w * h; start++) {
    if (visited[start] || field[start]! < 0.1) continue;
    let top = 0;
    let n = 0;
    stack[top++] = start;
    visited[start] = 1;
    let sumX = 0;
    let sumY = 0;
    let minAlong = Infinity;
    let rootX = 0;
    let rootY = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      const p = stack[--top]!;
      comp[n++] = p;
      const x = p % w;
      const y = (p / w) | 0;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const along = x * cs + y * sn;
      if (along < minAlong) {
        minAlong = along;
        rootX = x;
        rootY = y;
      }
      for (let oyOff = -1; oyOff <= 1; oyOff++) {
        for (let oxOff = -1; oxOff <= 1; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          const nx = x + oxOff;
          const ny = y + oyOff;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (visited[q] || field[q]! < 0.1) continue;
          visited[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (n < 8 || unitCount >= PAINT_GROWTH_UNIT_CAP) continue;
    let ux: number;
    let uy: number;
    if (topology === 'vein_tree' && !rimPool) {
      ux = rootX + 0.5;
      uy = rootY + 0.5;
    } else if (topology === 'holed_veil') {
      ux = (minX + maxX) * 0.5 + 0.5;
      uy = (minY + maxY) * 0.5 + 0.5;
    } else {
      ux = sumX / n + 0.5;
      uy = sumY / n + 0.5;
    }
    let minR = Infinity;
    let maxR = 0;
    let maxAlongRel = 0;
    for (let k = 0; k < n; k++) {
      const p = comp[k]!;
      const px = (p % w) + 0.5;
      const py = ((p / w) | 0) + 0.5;
      const r = Math.hypot(px - ux, py - uy);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      const alongRel = (px - ux) * cs + (py - uy) * sn;
      if (alongRel > maxAlongRel) maxAlongRel = alongRel;
    }
    if (maxR < 2) continue;
    ox[unitCount] = ux;
    oy[unitCount] = uy;
    span[unitCount] = topology === 'vein_tree' && !rimPool ? Math.max(1, maxAlongRel) : maxR;
    innerR[unitCount] = topology === 'holed_veil' ? minR : 0;
    outerR[unitCount] = maxR;
    unitCount += 1;
  }

  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.33;
    innerR[0] = span[0]! * 0.5;
    outerR[0] = span[0]!;
    unitCount = 1;
  }

  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);

  return {
    topology,
    veinVariant,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex,
  };
}

export function bakePaintGenome(req: PaintGenomeBakeRequest): PaintGenomeBakeResult {
  const continuity = req.continuity ?? 'colony';
  const sense = req.sense ?? 'sense_touch';
  const rhythm = req.rhythm ?? 'rhythm_open';
  const { w, h } = paintGenomeCanvasOf(continuity);
  const field = makePaintField(w, h);
  const topology = fillPaintTopology(field, {
    substrate: req.substrate,
    coverage: req.coverage,
    seed: req.seed,
    continuity,
    sense,
    rhythm,
    veinVariant: req.veinVariant,
  });
  const stage = STAGE[req.coverage];
  const ramp = fragmentRamp(req.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT);
  const veinTag = req.veinVariant === undefined ? '' : `:v${req.veinVariant}`;
  const rngLabel = `paint-core:${topology}:${req.coverage}:${sense}:${rhythm}${veinTag}`;
  let s = mix32(req.seed, rngLabel) | 1;
  const next = (): number => {
    let x = s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s = x >>> 0;
    return s / 4294967296;
  };
  const pickInt = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));

  // 亮核克制：整场压到 deep/mid，再撒少量核点。不许整团发光。
  for (let i = 0; i < field.v.length; i++) field.v[i] = field.v[i]! * 0.58;
  if (req.veinVariant === 1 && topology === 'vein_tree') applyFilmSheen(field);
  // 聚珠导向在撒核前取珠心，避免 1px 核点冒充珠。
  const beadGrowth =
    req.veinVariant === 3
      ? buildPaintGrowthGuide(field.v, w, h, topology, sense, rhythm, 3)
      : undefined;
  const lit: number[] = [];
  for (let i = 0; i < field.v.length; i++) if (field.v[i]! > 0.3) lit.push(i);
  const cores = 3 + stage * 4;
  for (let n = 0; n < cores && lit.length > 0; n++) {
    const i = lit[pickInt(0, lit.length - 1)]!;
    field.v[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (n % 2 === 0 && x + 1 < w) field.v[i + 1] = 0.82;
    if (n % 3 === 0 && y + 1 < h) field.v[i + w] = 0.82;
  }

  const growth =
    beadGrowth ?? buildPaintGrowthGuide(field.v, w, h, topology, sense, rhythm, req.veinVariant);
  const out = new Uint8ClampedArray(w * h * 4);
  paintSurfaceMaterial(out, field.v, w, h, req.substrate,req.coverage,req.seed);
  return { buf: { data: out, w, h }, field: field.v, ramp, topology, growth, canvasW: w, canvasH: h };
}

/** Same ramp bands as the rest pose. Live colour must go through here so inflated cannot swap in a bright teal. */
export function colorPaintField(
  out: Uint8ClampedArray,
  field: Float32Array,
  w: number,
  h: number,
  ramp: FragmentContamRamp,
): void {
  out.fill(0);
  const glow = ramp.glow;
  const core = ramp.core;
  const mid = ramp.mid;
  const deep = ramp.deep;
  for (let i = 0; i < w * h; i++) {
    const v = field[i]!;
    if (v < 0.1) continue;
    const o = i * 4;
    if (v >= 0.95) {
      out[o] = glow[0];
      out[o + 1] = glow[1];
      out[o + 2] = glow[2];
      out[o + 3] = 255;
    } else if (v >= PAINT_CORE_LO) {
      out[o] = core[0];
      out[o + 1] = core[1];
      out[o + 2] = core[2];
      out[o + 3] = 250;
    } else if (v >= 0.42) {
      out[o] = mid[0];
      out[o + 1] = mid[1];
      out[o + 2] = mid[2];
      out[o + 3] = 232;
    } else {
      out[o] = deep[0];
      out[o + 1] = deep[1];
      out[o + 2] = deep[2];
      out[o + 3] = 208;
    }
  }
}

export function occupancyMaskOf(buf: PaintGenomeBuf): Uint8Array {
  const m = new Uint8Array(buf.w * buf.h);
  for (let i = 0; i < buf.w * buf.h; i++) {
    m[i] = (buf.data[i * 4 + 3] ?? 0) > 0 ? 1 : 0;
  }
  return m;
}

export { topologyOf };
