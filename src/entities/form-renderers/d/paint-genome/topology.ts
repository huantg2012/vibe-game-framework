/**
 * 占漆拓扑场。禁止 import proto、禁止 import `d/genome`。
 *
 * 菌毯 = 实心多瓣团（中心是肉）。油膜生产 = 聚珠 / 沾抹 / 薄滩三变体（DEC-101）；
 * `veinTree` 缺省仍是树（闸门对照 / 抽卡 A/B/C），生产挂载省略变体时采样 3/4/5。
 * 灰幕 = 环 / 薄覆层。覆盖档 = 拓扑违反自身。
 * 感知转生长主轴；节律改同一拓扑的忙静；连续性换单团 / 卫星 / 碎块 / 铺场。
 */
import { mix32 } from '@/generation/seed-fork';
import type { ContinuityId, CoverageId } from '@/generated/contamination-lexicon-data';

export type PaintTopology = 'lobe_mass' | 'vein_tree' | 'holed_veil';

/**
 * 油膜脉络枚举。0/1/2 = 抽卡课树 tweak（A/B/C）；3/4/5 = 生产三变体。
 * bake 缺省不传 = 树（闸门对照）。生产挂载省略 = `oilFilmProductionVeinVariant`。
 */
export type PaintVeinVariant = 0 | 1 | 2 | 3 | 4 | 5;

export const OIL_FILM_ID = 'oil_film' as const;

/** 陈列馆油膜三入口。策划表仍一行 `oil_film`。 */
export type OilFilmVariantId = 'beads' | 'smear' | 'rim_pool';

export const OIL_FILM_VARIANTS: readonly OilFilmVariantId[] = ['beads', 'smear', 'rim_pool'];

export const OIL_FILM_VARIANT_LABEL: Record<OilFilmVariantId, string> = {
  beads: '聚珠成滩',
  smear: '沾抹拖尾',
  rim_pool: '薄滩收边',
};

const OIL_FILM_VEIN: Record<OilFilmVariantId, 3 | 4 | 5> = {
  beads: 3,
  smear: 4,
  rim_pool: 5,
};

export function oilFilmHallId(hood: OilFilmVariantId): string {
  return `${OIL_FILM_ID}:${hood}`;
}

export function oilFilmVariantFromHallId(hallId: string): OilFilmVariantId | null {
  if (!hallId.startsWith(`${OIL_FILM_ID}:`)) return null;
  const hood = hallId.slice(OIL_FILM_ID.length + 1);
  return OIL_FILM_VARIANTS.includes(hood as OilFilmVariantId) ? (hood as OilFilmVariantId) : null;
}

export function oilFilmPaintVeinOf(hood: OilFilmVariantId): 3 | 4 | 5 {
  return OIL_FILM_VEIN[hood];
}

/** 每枚油膜宿主抽一支生产读法。同种子同变体。 */
export function oilFilmProductionVeinVariant(seed: number): 3 | 4 | 5 {
  return (((mix32(seed, 'oil_film_variant') % 3) + 3) as 3 | 4 | 5);
}

export function oilFilmVariantOf(seed: number): OilFilmVariantId {
  const vein = oilFilmProductionVeinVariant(seed);
  return vein === 3 ? 'beads' : vein === 4 ? 'smear' : 'rim_pool';
}

/** 生产挂载：油膜省略变体则按种子采样 3/4/5。菌毯 / 灰幕 / 显式钉变体不采样。 */
export function resolvePaintVeinVariant(
  substrate: string,
  seed: number,
  explicit?: PaintVeinVariant,
): PaintVeinVariant | undefined {
  if (explicit !== undefined) return explicit;
  if (substrate === OIL_FILM_ID) return oilFilmProductionVeinVariant(seed);
  return undefined;
}

export interface PaintField {
  readonly v: Float32Array;
  readonly w: number;
  readonly h: number;
}

export interface PaintFillOpts {
  readonly substrate: string;
  readonly coverage: CoverageId;
  readonly seed: number;
  readonly continuity?: ContinuityId;
  readonly sense?: string;
  readonly rhythm?: string;
  /** 缺省不传仍走树（闸门对照 / A/B/C）。生产挂载先 `resolvePaintVeinVariant`。 */
  readonly veinVariant?: PaintVeinVariant;
}

interface RhythmKnobs {
  readonly lobeExtra: number;
  readonly lobeAmp: number;
  readonly branchMul: number;
  readonly zigzag: number;
  readonly veilHoles: number;
  readonly veilWarp: number;
}

interface Placement {
  readonly cx: number;
  readonly cy: number;
  readonly scale: number;
}

const STAGE: Record<CoverageId, number> = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2,
};

class PaintRng {
  private s: number;

  constructor(seed: number, label: string) {
    this.s = mix32(seed, label) | 1;
  }

  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }

  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
}

export function topologyOf(substrate: string): PaintTopology {
  if (substrate === 'oil_film') return 'vein_tree';
  if (substrate === 'ash_veil') return 'holed_veil';
  return 'lobe_mass';
}

export function makePaintField(w: number, h: number): PaintField {
  return { v: new Float32Array(w * h), w, h };
}

function add(f: PaintField, x: number, y: number, amt: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= f.w || iy >= f.h) return;
  const i = iy * f.w + ix;
  if (amt > f.v[i]!) f.v[i] = amt;
}

function disc(f: PaintField, cx: number, cy: number, r: number, amt: number): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) continue;
      add(f, x, y, amt * (1 - Math.sqrt(d2) / (r + 0.001)) + amt * 0.2);
    }
  }
}

function dot(f: PaintField, cx: number, cy: number, r: number, amt: number): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      add(f, x, y, amt);
    }
  }
}

/** 沿走步方向拉长、垂直压扁。油膜细脉，不是圆点折线。 */
function dotFlat(f: PaintField, cx: number, cy: number, ang: number, radAlong: number, radPerp: number, amt: number): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = Math.max(radAlong, radPerp) + 1;
  const a2 = radAlong * radAlong;
  const p2 = radPerp * radPerp;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if ((along * along) / a2 + (perp * perp) / p2 > 1) continue;
      add(f, x, y, amt);
    }
  }
}

function carveDisc(f: PaintField, cx: number, cy: number, r: number): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) f.v[y * f.w + x] = 0;
    }
  }
}

function radialCrack(
  f: PaintField,
  cx: number,
  cy: number,
  ang: number,
  r0: number,
  r1: number,
  halfW: number,
): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = r1 + halfW + 1;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if (along < r0 || along > r1) continue;
      if (Math.abs(perp) > halfW) continue;
      f.v[y * f.w + x] = 0;
    }
  }
}

function stroke(
  f: PaintField,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  amt: number,
): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    dot(f, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, amt);
  }
}

/** 感知只转生长主轴，不改色。 */
export function senseAngleOf(sense: string): number {
  if (sense === 'sense_scent') return (Math.PI * 2) / 3;
  if (sense === 'sense_domain') return (Math.PI * 4) / 3;
  if (sense === 'sense_hear') return Math.PI / 2;
  if (sense === 'sense_narrow') return 0.18;
  if (sense === 'sense_reverse') return Math.PI;
  if (sense === 'sense_cone') return -Math.PI / 2;
  return 0;
}

function rhythmKnobsOf(rhythm: string): RhythmKnobs {
  if (rhythm === 'rhythm_pulse') {
    return { lobeExtra: 3, lobeAmp: 0.4, branchMul: 1.35, zigzag: 0.78, veilHoles: 2, veilWarp: 0.3 };
  }
  if (rhythm === 'rhythm_sleep') {
    return { lobeExtra: -1, lobeAmp: 0.14, branchMul: 0.62, zigzag: 0.16, veilHoles: 0, veilWarp: 0.08 };
  }
  if (rhythm === 'rhythm_cluster') {
    return { lobeExtra: 1, lobeAmp: 0.28, branchMul: 1.08, zigzag: 0.42, veilHoles: 1, veilWarp: 0.2 };
  }
  return { lobeExtra: 0, lobeAmp: 0.22, branchMul: 1, zigzag: 0.3, veilHoles: 0, veilWarp: 0.14 };
}

function placementsOf(
  f: PaintField,
  continuity: ContinuityId,
  topo: PaintTopology,
  senseAng: number,
  rng: PaintRng,
): readonly Placement[] {
  const cx = f.w / 2;
  const cy = f.h / 2;
  const span = Math.min(f.w, f.h);
  const tree = topo === 'vein_tree';
  if (continuity === 'monolith') {
    return [{ cx, cy, scale: 1 }];
  }
  if (continuity === 'shards') {
    const n = 3 + rng.int(0, 1);
    const out: Placement[] = [];
    for (let i = 0; i < n; i++) {
      const a = senseAng + (i / n) * Math.PI * 2 + (rng.next() - 0.5) * 0.35;
      const d = span * (0.3 + rng.next() * 0.06);
      out.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.3 + rng.next() * 0.05,
      });
    }
    return out;
  }
  if (continuity === 'field') {
    const out: Placement[] = [{ cx, cy, scale: 1.18 }];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = senseAng + (i / n) * Math.PI * 2 + rng.next() * 0.25;
      const d = span * (0.4 + rng.next() * 0.05);
      out.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.4 + rng.next() * 0.05,
      });
    }
    return out;
  }
  const nSat = 3;
  const out: Placement[] = [{ cx, cy, scale: tree ? 0.5 : 0.8 }];
  const satScale = tree ? 0.48 : 0.36;
  for (let i = 0; i < nSat; i++) {
    const a = senseAng + ((i + 1) / (nSat + 1)) * Math.PI * 2 + (rng.next() - 0.5) * 0.1;
    const d = span * 0.46;
    out.push({
      cx: cx + Math.cos(a) * d,
      cy: cy + Math.sin(a) * d,
      scale: satScale,
    });
  }
  return out;
}

function lobeMass(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
): void {
  const R = Math.max(7, Math.min(f.w, f.h) * 0.33 * scale);
  const lobes = Math.max(3, 4 + knobs.lobeExtra);
  const amp = knobs.lobeAmp;
  const phi = senseAng;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const bound = R * (1 + amp * Math.cos(lobes * a + phi));
      if (d > bound) continue;
      add(f, x, y, 1 - (d / bound) * 0.45);
    }
  }
  if (stage < 1) return;
  const kids = stage === 1 ? 5 : 6;
  for (let i = 0; i < kids; i++) {
    const a = senseAng + (i / kids) * Math.PI * 2 + rng.next() * 0.18;
    const push = 1.34 + rng.next() * 0.28;
    disc(f, cx + Math.cos(a) * R * push, cy + Math.sin(a) * R * push, R * (0.3 + rng.next() * 0.1), 0.96);
  }
  const notchA = senseAng + Math.PI * 0.55;
  carveDisc(f, cx + Math.cos(notchA) * R * 1.02, cy + Math.sin(notchA) * R * 1.02, R * 0.42);
  if (stage < 2) return;
  radialCrack(f, cx, cy, senseAng + 0.4, R * 0.48, R * 1.4, Math.max(3.2, 3.8 * scale));
  radialCrack(f, cx, cy, senseAng + 1.85, R * 0.48, R * 1.35, Math.max(2.8, 3.4 * scale));
  radialCrack(f, cx, cy, senseAng + 3.3, R * 0.55, R * 1.25, Math.max(2.4, 3 * scale));
}

function veinTree(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
  variant?: PaintVeinVariant,
): void {
  if (variant === 0) {
    veinTreeFlat(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 2) {
    veinTreeConverge(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 3) {
    oilFilmBeads(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 4) {
    oilFilmSmear(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 5) {
    oilFilmRimPool(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  const thick = Math.max(0.85, 1.2 * scale);
  const loopR = Math.max(1.9, 2.15 * scale);
  const baseLen = Math.min(f.w, f.h) * 0.34 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag;
  const ends: { x: number; y: number }[] = [];

  const walk = (x: number, y: number, ang: number, len: number, t: number, depth: number): void => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(5, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.65, t * (1 - s / (steps * 1.9)));
      dot(f, px, py, rad, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? (stage >= 1 ? 4 : 2) : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.95 + stage * 0.4;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.28;
      walk(px, py, fork, len * (0.55 + rng.next() * 0.18), t * 0.74, depth + 1);
    }
  };

  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 1.25 : -1.25);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.28,
      cy + Math.sin(senseAng) * baseLen * 0.28,
      side,
      baseLen * 0.85,
      thick * 0.82,
      0,
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j]!.x - ends[i]!.x, ends[j]!.y - ends[i]!.y);
      if (d < 8 || d > 26) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const used = new Set<number>();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 2) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    stroke(f, ends[p.i]!.x, ends[p.i]!.y, ends[p.j]!.x, ends[p.j]!.y, loopR, 0.9);
    loops += 1;
  }
}

/** A：沿主轴摊开的扁脉，zigzag 压低，厚度垂直方向收。 */
function veinTreeFlat(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
): void {
  const thick = Math.max(0.95, 1.15 * scale);
  const loopR = Math.max(1.1, 1.25 * scale);
  const baseLen = Math.min(f.w, f.h) * 0.36 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag * 0.18;
  const ends: { x: number; y: number }[] = [];

  const walk = (x: number, y: number, ang: number, len: number, t: number, depth: number): void => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const fade = 1 - s / (steps * 1.55);
      const radAlong = Math.max(1.2, t * 1.9 * fade);
      const radPerp = Math.max(0.28, t * 0.36 * fade);
      dotFlat(f, px, py, a, radAlong, radPerp, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? (stage >= 1 ? 3 : 2) : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul * 0.85));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.7 + stage * 0.28;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.12;
      walk(px, py, fork, len * (0.58 + rng.next() * 0.12), t * 0.7, depth + 1);
    }
  };

  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 0.85 : -0.85);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.22,
      cy + Math.sin(senseAng) * baseLen * 0.22,
      side,
      baseLen * 0.72,
      thick * 0.7,
      0,
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j]!.x - ends[i]!.x, ends[j]!.y - ends[i]!.y);
      if (d < 10 || d > 22) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((left, right) => left.d - right.d);
  const used = new Set<number>();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 1) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    const ang = Math.atan2(ends[p.j]!.y - ends[p.i]!.y, ends[p.j]!.x - ends[p.i]!.x);
    const steps = Math.max(1, Math.ceil(p.d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      dotFlat(
        f,
        ends[p.i]!.x + (ends[p.j]!.x - ends[p.i]!.x) * t,
        ends[p.i]!.y + (ends[p.j]!.y - ends[p.i]!.y) * t,
        ang,
        loopR * 1.4,
        loopR * 0.35,
        0.88,
      );
    }
    loops += 1;
  }
}

/** C：少分叉，支脉画回主干，像油往低处汇。 */
function veinTreeConverge(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
): void {
  const thick = Math.max(1.05, 1.4 * scale);
  const baseLen = Math.min(f.w, f.h) * 0.38 * scale;
  const maxDepth = 1 + (stage >= 1 ? 1 : 0);
  const zigzag = knobs.zigzag * 0.28;
  const trunk: { x: number; y: number }[] = [];
  const ends: { x: number; y: number }[] = [];

  const walk = (
    x: number,
    y: number,
    ang: number,
    len: number,
    t: number,
    depth: number,
    recordTrunk: boolean,
  ): void => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.75, t * (1 - s / (steps * 2.6)));
      dot(f, px, py, rad, 0.9);
      if (recordTrunk) trunk.push({ x: px, y: py });
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    const kids = depth === 0 ? 2 : 1;
    const spread = 0.48 + stage * 0.12;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.1;
      walk(px, py, fork, len * (0.6 + rng.next() * 0.08), t * 0.58, depth + 1, false);
    }
  };

  walk(cx, cy, senseAng, baseLen, thick, 0, true);
  if (stage >= 2 && knobs.branchMul > 0.9) {
    const side = senseAng + (rng.next() < 0.5 ? 0.55 : -0.55);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.18,
      cy + Math.sin(senseAng) * baseLen * 0.18,
      side,
      baseLen * 0.55,
      thick * 0.62,
      1,
      false,
    );
  }

  for (const end of ends) {
    let bestX = trunk[0]?.x ?? cx;
    let bestY = trunk[0]?.y ?? cy;
    let bestD = Infinity;
    for (const p of trunk) {
      const d = Math.hypot(end.x - p.x, end.y - p.y);
      if (d < bestD) {
        bestD = d;
        bestX = p.x;
        bestY = p.y;
      }
    }
    if (bestD > 5 && bestD < 30) {
      stroke(f, end.x, end.y, bestX, bestY, Math.max(0.65, thick * 0.42), 0.86);
    }
  }
}

/**
 * D：聚珠成滩。从「油膜做污染体基底」原初 idea 推导：油在不沾的表面上被表面张力收成珠，
 * 珠子靠近就聚并成滩。用 metaball 求和场画：珠心是亮的，珠与珠之间拉出凹颈，外圈一层薄膜晕。
 * 不分叉、不是线——读作液体聚并。覆盖档违规 = 聚并过度：珠径胀大，远珠被拉成长颈连回主滩。
 */
function oilFilmBeads(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
): void {
  const span = Math.min(f.w, f.h);
  const s = scale * 1.35;
  const merge = stage >= 2 ? 1.32 : 1;
  const beads: { x: number; y: number; r: number; fine: boolean }[] = [];
  const rMain = Math.max(5.5, span * 0.16 * s) * merge;
  beads.push({ x: cx, y: cy, r: rMain, fine: false });
  const rMed = Math.max(2.4, span * 0.055 * s) * merge;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const a = senseAng + side * (0.65 + rng.next() * 0.45) + (rng.next() - 0.5) * 0.28 * (0.6 + knobs.zigzag);
    const d = rMain * (0.95 + rng.next() * 0.2);
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: rMed,
      fine: false,
    });
  }
  const nFine = 4 + stage;
  const dFineMin = rMain * 1.3;
  const dFineMax = span * 0.34 * s;
  for (let i = 0; i < nFine; i++) {
    const a = senseAng + ((i + 0.5) / nFine - 0.5) * 2.1 + (rng.next() - 0.5) * 0.55;
    const spanD = Math.max(0, dFineMax - dFineMin);
    const d = dFineMin + rng.next() * spanD;
    if (d < rMain) continue;
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: Math.max(1.05, span * 0.018 * s) * merge,
      fine: true,
    });
  }
  const sum = new Float32Array(f.w * f.h);
  for (const b of beads) {
    const reach = b.r * 2.2;
    const pad = reach + 1;
    for (let y = Math.floor(b.y - pad); y <= b.y + pad; y++) {
      for (let x = Math.floor(b.x - pad); x <= b.x + pad; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const t = 1 - Math.hypot(x - b.x, y - b.y) / reach;
        if (t <= 0) continue;
        sum[y * f.w + x] = sum[y * f.w + x]! + t * t;
      }
    }
  }
  for (let i = 0; i < sum.length; i++) {
    const field = sum[i]!;
    const x = i % f.w;
    const y = (i / f.w) | 0;
    if (field >= 0.62) add(f, x, y, 0.9);
    else if (field >= 0.4) add(f, x, y, 0.66);
    else if (field >= 0.26) add(f, x, y, 0.3);
  }
  for (const b of beads) {
    if (b.fine) {
      dot(f, b.x, b.y, b.r, 1.38);
    } else if (b.r >= 2.2) {
      disc(f, b.x, b.y, b.r * 0.35, 1.45);
    }
  }
  if (stage < 2 || beads.length < 3) return;
  const pool = beads[0]!;
  const far = beads
    .slice(1)
    .map((b, i) => ({ b, i, d: Math.hypot(b.x - pool.x, b.y - pool.y) }))
    .sort((left, right) => right.d - left.d)
    .slice(0, 2);
  for (const g of far) {
    if (g.d < 6 || g.d > 30) continue;
    stroke(f, pool.x, pool.y, g.b.x, g.b.y, Math.max(0.9, 1.1 * s), 0.66);
  }
}

/**
 * E：沾抹拖尾。残余动词是「沾」：油膜是被什么从簇心抹开的一道——头厚尾薄、边缘羽化，
 * 周围一圈被抹薄的膜。走低频弧线的软边笔画，不分叉、不折线。覆盖档违规 = 抹了一遍又一遍，
 * 三道笔画交叠。
 */
function oilFilmSmear(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
): void {
  const span = Math.min(f.w, f.h);
  const s = scale * 1.6;
  const strokes = 1 + stage;
  for (let i = 0; i < strokes; i++) {
    const side = i > 0;
    const baseA =
      senseAng + (i - (strokes - 1) / 2) * (0.5 + knobs.zigzag * 0.4) + (rng.next() - 0.5) * 0.2;
    const len = span * (0.5 + rng.next() * 0.08) * s * (side ? 0.72 : 1);
    const curl = (rng.next() - 0.5) * 0.9;
    const wHead = Math.max(4.4, 6.8 * s) * (side ? 0.48 : 1);
    const wTail = Math.max(0.55, 0.8 * s);
    const amtMul = side ? 0.55 : 1;
    let px = cx - Math.cos(baseA) * len * 0.42;
    let py = cy - Math.sin(baseA) * len * 0.42;
    const steps = Math.max(8, Math.round(len));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const a = baseA + curl * t;
      px += Math.cos(a);
      py += Math.sin(a);
      const w = wHead + (wTail - wHead) * t;
      const amt = 1.42 * (1 - t * 0.62) * amtMul;
      disc(f, px, py, w * 2.6, 0.4);
      disc(f, px, py, w, amt);
    }
  }
}

/**
 * F：薄滩收边。表面张力把油收成圆滑一滩：内部薄到只剩底色，边缘一圈弯月亮线才是它。
 * 身份由边承担，不由内部承担——与灰幕的环（中空、环是本体）分开：薄滩内部是薄但有的膜。
 * 覆盖档违规 = 漫出第二滩，两滩相叠。
 */
function oilFilmRimPool(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
): void {
  const span = Math.min(f.w, f.h);
  const s = scale * 1.35;
  const blobs = 1 + (stage >= 2 ? 1 : 0);
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= f.w || y >= f.h ? 0 : f.v[y * f.w + x]!;
  for (let b = 0; b < blobs; b++) {
    const ba = senseAng + b * 1.9 + (rng.next() - 0.5) * 0.4;
    const bd = b === 0 ? 0 : span * 0.2 * scale;
    const bx = cx + Math.cos(ba) * bd;
    const by = cy + Math.sin(ba) * bd;
    const R = Math.max(8, span * (0.28 + stage * 0.03) * s);
    const h1 = rng.next() * Math.PI * 2;
    const h2 = rng.next() * Math.PI * 2;
    const a1 = 0.08 + knobs.veilWarp * 0.4 + rng.next() * 0.04;
    const a2 = 0.05 + rng.next() * 0.05;
    const pad = R * 1.35 + 1;
    const x0 = Math.floor(bx - pad);
    const x1 = Math.ceil(bx + pad);
    const y0 = Math.floor(by - pad);
    const y1 = Math.ceil(by + pad);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (d > bound - 2.2 && d <= bound - 1.0) add(f, x, y, 0.48);
        else add(f, x, y, 0.34);
      }
    }
    const gathers = 1 + stage;
    for (let g = 0; g < gathers; g++) {
      const ga = rng.next() * Math.PI * 2;
      const gd = rng.next() * R * 0.45;
      disc(f, bx + Math.cos(ga) * gd, by + Math.sin(ga) * gd, Math.max(1.1, R * 0.12), 0.38);
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (!(at(x + 1, y) < 0.1 || at(x - 1, y) < 0.1 || at(x, y + 1) < 0.1 || at(x, y - 1) < 0.1)) {
          continue;
        }
        const amt = 1.52 * (0.62 + 0.38 * (0.5 + 0.5 * Math.cos(ang - senseAng)));
        add(f, x, y, amt);
      }
    }
  }
}

function addEllipseRing(
  f: PaintField,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  irx: number,
  iry: number,
  warp: number,
  k: number,
  phi: number,
  rot: number,
  amt: number,
  gapCount = 0,
  gapFrac = 0,
): void {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pad = Math.max(rx, ry) + 2;
  const x0 = Math.max(0, Math.floor(cx - pad));
  const x1 = Math.min(f.w - 1, Math.ceil(cx + pad));
  const y0 = Math.max(0, Math.floor(cy - pad));
  const y1 = Math.min(f.h - 1, Math.ceil(cy + pad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      const a = Math.atan2(ly, lx);
      if (gapCount > 0 && gapFrac > 0) {
        const t = ((a - phi) / (Math.PI * 2) + 8) % 1;
        const u = (t * gapCount) % 1;
        if (u < gapFrac) continue;
      }
      const bound = 1 + warp * Math.cos(k * a + phi);
      const outerD = Math.hypot(lx / rx, ly / ry);
      if (outerD > bound) continue;
      const innerD = Math.hypot(lx / Math.max(0.5, irx), ly / Math.max(0.5, iry));
      if (innerD < bound) continue;
      add(f, x, y, amt);
    }
  }
}

function holedVeil(
  f: PaintField,
  rng: PaintRng,
  stage: number,
  cx: number,
  cy: number,
  scale: number,
  senseAng: number,
  knobs: RhythmKnobs,
): void {
  const span = Math.min(f.w, f.h);
  const grow = stage === 1 ? 1.28 : 1;
  const rx = Math.max(10, span * 0.42 * scale * grow);
  const ry = Math.max(8, span * (stage === 1 ? 0.24 : 0.3) * scale * (stage === 1 ? 1.08 : 1));
  const ringW = stage === 0 ? Math.max(3.8, 4.8 * scale) : Math.max(3.4, 3.9 * scale);
  const irx = Math.max(3, rx - ringW);
  const iry = Math.max(3, ry - ringW);
  const k = 3 + (knobs.lobeExtra > 1 ? 2 : 0);
  const gaps = stage === 1 ? 5 : 0;
  const gapFrac = stage === 1 ? 0.42 : 0;
  addEllipseRing(f, cx, cy, rx, ry, irx, iry, knobs.veilWarp, k, senseAng, senseAng, 0.9, gaps, gapFrac);
  if (stage >= 2 && scale >= 0.4) {
    const holes = 4 + knobs.veilHoles;
    const midRx = (rx + irx) * 0.5;
    const midRy = (ry + iry) * 0.5;
    for (let i = 0; i < holes; i++) {
      const a = senseAng + (i / holes) * Math.PI * 2 + rng.next() * 0.08;
      carveDisc(f, cx + Math.cos(a) * midRx, cy + Math.sin(a) * midRy, ringW * 1.35);
    }
  }
  if (stage < 2) return;
  const nrx = rx * 0.68;
  const nry = ry * 0.68;
  const nestedW = Math.max(3.2, 3.6 * scale);
  addEllipseRing(
    f,
    cx,
    cy,
    nrx,
    nry,
    Math.max(2, nrx - nestedW),
    Math.max(2, nry - nestedW),
    knobs.veilWarp * 0.55,
    k,
    senseAng + 0.5,
    senseAng,
    0.94,
  );
}

function drawUnit(
  f: PaintField,
  topo: PaintTopology,
  rng: PaintRng,
  stage: number,
  p: Placement,
  senseAng: number,
  knobs: RhythmKnobs,
  variant?: PaintVeinVariant,
): void {
  if (topo === 'lobe_mass') lobeMass(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
  else if (topo === 'vein_tree') veinTree(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs, variant);
  else holedVeil(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
}

/** R3: growing shelf colonies / torn ash deposits, each with its own mass. */
function materialColony(f: PaintField, p: Placement, seed: number, stage: number, ash: boolean): void {
  const span=Math.min(f.w,f.h)*p.scale;
  const count=ash?4+stage:5+stage*2;
  const rng=new PaintRng(seed,ash?'ash-lamina':'fungal-shelves');
  for(let k=0;k<count;k++) {
    const angle=rng.next()*Math.PI*2;
    const cx=p.cx+Math.cos(angle)*span*.16,cy=p.cy+Math.sin(angle)*span*.12;
    const rx=span*(ash?.25:.17)*(1+rng.next()*.3),ry=span*(ash?.055:.12)*(1+rng.next()*.3);
    for(let y=Math.floor(cy-ry*1.5);y<=cy+ry*1.5;y++) for(let x=Math.floor(cx-rx*1.3);x<=cx+rx*1.3;x++) {
      const dx=(x-cx)/rx,dy=(y-cy)/ry;
      const warp=Math.sin(dx*7+k)*(.08+stage*.05)+Math.sin(dy*5+k)*.05;
      if(dx*dx+dy*dy>1+warp)continue;
      // Higher coverage splits the native shelves into interleaving folds,
      // retaining sizeable masses rather than a mathematically perfect ring.
      if(stage>0&&Math.sin(dx*5+dy*2+k)>.91&&Math.abs(dx)>.4)continue;
      add(f,x,y,.55+Math.max(0,1-dx*dx-dy*dy)*.4);
    }
  }
}

/** Fill a topology field. Coverage stage 0/1/2 = 渗透 / 改写 / 覆盖. */
export function fillPaintTopology(field: PaintField, opts: PaintFillOpts): PaintTopology {
  const topo = topologyOf(opts.substrate);
  const coverage = opts.coverage;
  const continuity = opts.continuity ?? 'colony';
  const sense = opts.sense ?? 'sense_touch';
  const rhythm = opts.rhythm ?? 'rhythm_open';
  const veinTag = opts.veinVariant === undefined ? '' : `:v${opts.veinVariant}`;
  const rng = new PaintRng(opts.seed, `paint:${topo}:${coverage}:${continuity}:${sense}:${rhythm}${veinTag}`);
  const senseAng = senseAngleOf(sense);
  const knobs = rhythmKnobsOf(rhythm);
  const stage = STAGE[coverage];
  const placements = placementsOf(field, continuity, topo, senseAng, rng);
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    const unitRng = new PaintRng(
      mix32(opts.seed, `u:${i}`),
      `paint-unit:${topo}:${coverage}:${sense}:${rhythm}${veinTag}`,
    );
    if(opts.substrate==='fungal_mat'||opts.substrate==='ash_veil')
      materialColony(field,p,mix32(opts.seed,`material:${i}`),stage,opts.substrate==='ash_veil');
    else drawUnit(field, topo, unitRng, stage, p, senseAng, knobs, opts.veinVariant);
  }
  return topo;
}
