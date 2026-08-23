/**
 * PROTOTYPE — 构件骨架 + 违规预算 for 甲.
 * Preview tooling only. Not wired to `src/**`, not a spec, not production.
 *
 * Three layers, in order:
 *   1. 骨架语法 (skeletonOf)     基体 → 一条语法，seed 采样出节数/间距/倾角/不对称
 *   2. 构件库 (drawPart)         骨架节点 → 像素构件；构件跨基体共享
 *   3. 违规预算 (transgress)     覆盖深度 → 违规条数；seed 抽哪几条；违规改骨架
 * 污染漆最后才刷，所以它不再是"差异的唯一来源"。
 */

import { mix32 } from '@/generation/seed-fork';

export type MatKey =
  | 'flesh'
  | 'cloth'
  | 'bone'
  | 'earth'
  | 'brick'
  | 'metal'
  | 'metalMid'
  | 'concrete'
  | 'shadow'
  | 'core'
  | 'glow';

export type PartKind = 'post' | 'beam' | 'mass' | 'plate' | 'filament' | 'nub' | 'core';

export interface Part {
  kind: PartKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** filament only: horizontal drift from top to bottom, in px. */
  bend?: number;
  mat: MatKey;
  /** Marks the structural spine so 违规 knows what to multiply / break. */
  role?: 'spine' | 'rib' | 'limb' | 'head' | 'base' | 'lintel' | 'accent';
}

export type Family = 'organic_remnant' | 'stalk_clump' | 'lamp_pillar' | 'railing_post' | 'doorframe';

export const TRANSGRESSIONS = [
  'proliferate',
  'asymmetry',
  'recurse',
  'graft',
  'invert',
  'bloat',
  'radiate',
] as const;
export type Transgression = (typeof TRANSGRESSIONS)[number];

export interface Skeleton {
  parts: Part[];
  /** Canvas the skeleton was laid out for. */
  readonly w: number;
  readonly h: number;
  readonly groundY: number;
  readonly family: Family;
  applied: Transgression[];
}

export class Rng {
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

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}

// ---------------------------------------------------------------- 层 1：骨架语法

const MAT_BY_FAMILY: Record<Family, { readonly hard: MatKey; readonly soft: MatKey; readonly base: MatKey }> = {
  organic_remnant: { hard: 'bone', soft: 'flesh', base: 'earth' },
  stalk_clump: { hard: 'bone', soft: 'cloth', base: 'earth' },
  lamp_pillar: { hard: 'metal', soft: 'metalMid', base: 'concrete' },
  railing_post: { hard: 'metal', soft: 'metalMid', base: 'concrete' },
  doorframe: { hard: 'metal', soft: 'brick', base: 'concrete' },
};

function lampSkeleton(rng: Rng, w: number, groundY: number): Part[] {
  const mat = MAT_BY_FAMILY.lamp_pillar;
  const segs = rng.int(2, 4);
  const top = rng.int(5, 9);
  const span = groundY - 4 - top;
  const parts: Part[] = [];
  let y = top;
  let cx = Math.floor(w / 2) + rng.int(-2, 2);
  let width = rng.int(3, 6);
  for (let i = 0; i < segs; i++) {
    const segH = Math.max(3, Math.round(span / segs) + rng.int(-2, 2));
    parts.push({
      kind: 'post',
      x: cx - (width >> 1),
      y,
      w: width,
      h: segH,
      mat: i % 2 === 0 ? mat.hard : mat.soft,
      role: 'spine',
    });
    y += segH;
    cx += rng.int(-2, 2);
    width = Math.max(2, width - rng.int(0, 1));
  }
  const coreN = rng.int(1, 2);
  for (let i = 0; i < coreN; i++) {
    const size = rng.int(1, 2);
    parts.push({
      kind: 'core',
      x: Math.floor(w / 2) + rng.int(-2, 2),
      y: top + rng.int(0, 3) + i * rng.int(2, 5),
      w: size,
      h: size,
      mat: 'glow',
      role: 'accent',
    });
  }
  const baseW = rng.int(5, 9);
  parts.push({
    kind: 'plate',
    x: Math.floor(w / 2) - (baseW >> 1),
    y: groundY - 4,
    w: baseW,
    h: 4,
    mat: mat.base,
    role: 'base',
  });
  return parts;
}

function railSkeleton(rng: Rng, w: number, groundY: number): Part[] {
  const mat = MAT_BY_FAMILY.railing_post;
  const posts = rng.int(1, 3);
  const spacing = rng.int(3, 7);
  const top = rng.int(7, 13);
  const parts: Part[] = [];
  const totalW = (posts - 1) * spacing;
  const x0 = Math.floor(w / 2) - Math.floor(totalW / 2);
  for (let i = 0; i < posts; i++) {
    parts.push({
      kind: 'post',
      x: x0 + i * spacing,
      y: top + rng.int(0, 2),
      w: rng.int(1, 2),
      h: groundY - 3 - top,
      mat: i === 0 ? mat.hard : mat.soft,
      role: 'spine',
    });
  }
  const beams = rng.int(0, 2);
  for (let i = 0; i < beams; i++) {
    const by = top + rng.int(1, Math.max(2, groundY - top - 8));
    parts.push({
      kind: 'beam',
      x: x0 - rng.int(0, 2),
      y: by,
      w: Math.max(4, totalW + rng.int(2, 5)),
      h: rng.int(1, 2),
      mat: mat.hard,
      role: 'rib',
    });
  }
  parts.push({
    kind: 'plate',
    x: x0 - 2,
    y: groundY - 3,
    w: totalW + 5,
    h: 3,
    mat: mat.base,
    role: 'base',
  });
  return parts;
}

function doorSkeleton(rng: Rng, w: number, groundY: number): Part[] {
  const mat = MAT_BY_FAMILY.doorframe;
  const gap = rng.int(8, 14);
  const jamb = rng.int(2, 4);
  const top = rng.int(5, 9);
  const lintelDrop = rng.int(0, 4);
  const xL = Math.floor(w / 2) - Math.floor(gap / 2) - jamb;
  const xR = Math.floor(w / 2) + Math.floor(gap / 2);
  const parts: Part[] = [
    { kind: 'post', x: xL, y: top, w: jamb, h: groundY - top, mat: mat.hard, role: 'spine' },
    { kind: 'post', x: xR, y: top, w: jamb, h: groundY - top, mat: mat.soft, role: 'spine' },
    {
      kind: 'beam',
      x: xL,
      y: top + lintelDrop,
      w: xR + jamb - xL,
      h: rng.int(2, 3),
      mat: mat.hard,
      role: 'lintel',
    },
  ];
  if (rng.chance(0.55)) {
    const leafH = rng.int(6, groundY - top - 4);
    const side = rng.chance(0.5);
    parts.push({
      kind: 'mass',
      x: side ? xL + jamb : Math.floor(w / 2),
      y: groundY - leafH,
      w: Math.floor(gap / 2),
      h: leafH,
      mat: mat.soft,
      role: 'rib',
    });
  }
  parts.push({ kind: 'plate', x: xL, y: groundY - 1, w: xR + jamb - xL, h: 1, mat: 'shadow', role: 'base' });
  return parts;
}

function stalkSkeleton(rng: Rng, w: number, groundY: number): Part[] {
  const mat = MAT_BY_FAMILY.stalk_clump;
  const n = rng.int(3, 6);
  const spread = rng.int(3, 8);
  const parts: Part[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.floor(w / 2) + rng.int(-spread, spread);
    const top = rng.int(5, 15);
    parts.push({
      kind: 'filament',
      x,
      y: top,
      w: rng.int(1, 2),
      h: groundY - 2 - top,
      bend: rng.int(-3, 3),
      mat: rng.chance(0.35) ? mat.hard : mat.soft,
      role: 'spine',
    });
    if (rng.chance(0.6)) {
      parts.push({ kind: 'nub', x, y: top - 1, w: rng.int(1, 2), h: 1, mat: mat.hard, role: 'accent' });
    }
  }
  parts.push({
    kind: 'plate',
    x: Math.floor(w / 2) - spread - 1,
    y: groundY - 2,
    w: spread * 2 + 3,
    h: 2,
    mat: mat.base,
    role: 'base',
  });
  return parts;
}

function organicSkeleton(rng: Rng, w: number, groundY: number): Part[] {
  const mat = MAT_BY_FAMILY.organic_remnant;
  const torsoW = rng.int(9, 14);
  const torsoH = rng.int(8, 12);
  const legH = rng.int(6, 11);
  const cx = Math.floor(w / 2) + rng.int(-1, 1);
  const torsoY = groundY - legH - torsoH;
  const parts: Part[] = [
    {
      kind: 'mass',
      x: cx - (torsoW >> 1),
      y: torsoY,
      w: torsoW,
      h: torsoH,
      mat: mat.soft,
      role: 'spine',
    },
  ];
  const headW = rng.int(5, 8);
  parts.push({
    kind: 'mass',
    x: cx - (headW >> 1) + rng.int(-2, 2),
    y: torsoY - rng.int(4, 7),
    w: headW,
    h: rng.int(4, 6),
    mat: mat.hard,
    role: 'head',
  });
  const legs = rng.int(2, 2);
  for (let i = 0; i < legs; i++) {
    parts.push({
      kind: 'post',
      x: cx - (torsoW >> 1) + 1 + i * (torsoW - 4),
      y: groundY - legH,
      w: rng.int(2, 4),
      h: legH,
      mat: mat.soft,
      role: 'limb',
    });
  }
  const arms = rng.int(1, 2);
  for (let i = 0; i < arms; i++) {
    const side = i === 0 ? 1 : -1;
    const len = rng.int(5, 10);
    parts.push({
      kind: 'filament',
      x: cx + side * ((torsoW >> 1) + 1),
      y: torsoY + rng.int(1, 4),
      w: rng.int(1, 3),
      h: len,
      bend: side * rng.int(1, 4),
      mat: mat.soft,
      role: 'limb',
    });
  }
  parts.push({
    kind: 'plate',
    x: cx - (torsoW >> 1),
    y: groundY - 1,
    w: torsoW,
    h: 1,
    mat: 'shadow',
    role: 'base',
  });
  return parts;
}

const GRAMMAR: Record<Family, (rng: Rng, w: number, g: number) => Part[]> = {
  lamp_pillar: lampSkeleton,
  railing_post: railSkeleton,
  doorframe: doorSkeleton,
  stalk_clump: stalkSkeleton,
  organic_remnant: organicSkeleton,
};

export function skeletonOf(family: Family, seed: number, w: number, h: number): Skeleton {
  const groundY = h - 4;
  const rng = new Rng(seed, `skel:${family}`);
  return { parts: GRAMMAR[family](rng, w, groundY), w, h, groundY, family, applied: [] };
}

// ------------------------------------------------------------- 层 3：违规预算

/** 覆盖深度 → 违规条数。同一档抽到哪几条由 seed 定，所以同基体同覆盖度也不重样。 */
export function transgressionBudget(coverage: 'infiltrate' | 'rewrite' | 'overwrite'): number {
  if (coverage === 'infiltrate') return 1;
  if (coverage === 'rewrite') return 3;
  return 5;
}

function spines(parts: readonly Part[]): Part[] {
  return parts.filter((p) => p.role === 'spine');
}

function proliferate(sk: Skeleton, rng: Rng): void {
  const src = spines(sk.parts);
  if (src.length === 0) return;
  const copies = rng.int(2, 4);
  for (let i = 0; i < copies; i++) {
    const p = rng.pick(src);
    const dx = rng.int(-9, 9);
    const dy = rng.int(-4, 3);
    sk.parts.push({
      ...p,
      x: p.x + dx,
      y: Math.max(1, p.y + dy),
      h: Math.max(2, p.h - rng.int(0, 5)),
      w: Math.max(1, p.w - rng.int(0, 1)),
      role: 'rib',
    });
  }
}

function asymmetry(sk: Skeleton, rng: Rng): void {
  const cx = sk.w / 2;
  const side = rng.chance(0.5) ? 1 : -1;
  const stretch = rng.int(3, 8);
  for (const p of sk.parts) {
    if (p.role === 'base') continue;
    const mid = p.x + p.w / 2;
    if ((mid - cx) * side <= 0) continue;
    p.y = Math.max(1, p.y - stretch);
    p.h += stretch;
    if (rng.chance(0.5)) p.w += 1;
  }
}

function recurse(sk: Skeleton, rng: Rng): void {
  const host = rng.pick(sk.parts.filter((p) => p.role !== 'base'));
  if (!host) return;
  const scale = 0.35 + rng.next() * 0.2;
  const sub = GRAMMAR[sk.family](new Rng(rng.int(1, 1e6), 'sub'), sk.w, sk.groundY);
  const ax = host.x + host.w / 2;
  const ay = host.y + (rng.chance(0.5) ? 0 : host.h);
  for (const p of sub) {
    if (p.role === 'base') continue;
    sk.parts.push({
      ...p,
      x: Math.round(ax + (p.x + p.w / 2 - sk.w / 2) * scale - (p.w * scale) / 2),
      y: Math.round(ay + (p.y - sk.groundY) * scale),
      w: Math.max(1, Math.round(p.w * scale)),
      h: Math.max(1, Math.round(p.h * scale)),
      role: 'accent',
    });
  }
}

function graft(sk: Skeleton, rng: Rng): void {
  const others = (Object.keys(GRAMMAR) as Family[]).filter((f) => f !== sk.family);
  const donor = rng.pick(others);
  const parts = GRAMMAR[donor](new Rng(rng.int(1, 1e6), `graft:${donor}`), sk.w, sk.groundY);
  const take = parts.filter((p) => p.role === 'spine' || p.role === 'lintel');
  const n = Math.min(take.length, rng.int(1, 3));
  const anchor = rng.pick(sk.parts.filter((p) => p.role !== 'base')) ?? sk.parts[0]!;
  for (let i = 0; i < n; i++) {
    const p = take[i]!;
    const scale = 0.4 + rng.next() * 0.35;
    sk.parts.push({
      ...p,
      x: Math.round(anchor.x + rng.int(-4, 4)),
      y: Math.round(Math.max(1, anchor.y + rng.int(-6, 6))),
      w: Math.max(1, Math.round(p.w * (scale + 0.3))),
      h: Math.max(2, Math.round(p.h * scale)),
      role: 'rib',
    });
  }
}

/** 朝向违规：构件在自己的锚点上转 90°，仍与本体相连，不飘。 */
function invert(sk: Skeleton, rng: Rng): void {
  const cands = sk.parts.filter((p) => p.role === 'rib' || p.role === 'limb' || p.role === 'lintel');
  const pool = cands.length > 0 ? cands : sk.parts.filter((p) => p.role !== 'base');
  const n = Math.min(pool.length, rng.int(1, 3));
  for (let i = 0; i < n; i++) {
    const p = rng.pick(pool);
    if (p.kind === 'filament') {
      p.bend = -(p.bend ?? 1) * rng.int(2, 4);
      continue;
    }
    const ax = p.x + p.w / 2;
    const ay = p.y + p.h / 2;
    const w = p.h;
    const h = p.w;
    p.w = Math.max(1, w);
    p.h = Math.max(1, h);
    p.x = Math.round(ax - p.w / 2);
    p.y = Math.max(1, Math.round(ay - p.h / 2));
  }
}

function bloat(sk: Skeleton, rng: Rng): void {
  const pool = sk.parts.filter((p) => p.role !== 'base');
  if (pool.length === 0) return;
  const p = rng.pick(pool);
  const k = 1.8 + rng.next() * 1.6;
  const ncx = p.x + p.w / 2;
  const ncy = p.y + p.h / 2;
  p.w = Math.max(2, Math.round(p.w * k));
  p.h = Math.max(2, Math.round(p.h * (p.kind === 'post' || p.kind === 'filament' ? 1 : k)));
  p.x = Math.round(ncx - p.w / 2);
  p.y = Math.max(1, Math.round(ncy - p.h / 2));
  if (p.kind === 'core') p.mat = 'glow';
}

function radiate(sk: Skeleton, rng: Rng): void {
  const hub = { x: Math.floor(sk.w / 2), y: Math.floor(sk.groundY - sk.h * 0.35) };
  const arms = rng.int(3, 5);
  const mat = MAT_BY_FAMILY[sk.family];
  for (let i = 0; i < arms; i++) {
    const len = rng.int(6, Math.max(8, Math.floor(sk.h * 0.32)));
    const dir = i / arms;
    const bend = Math.round(Math.cos(dir * Math.PI * 2) * len * 0.9);
    sk.parts.push({
      kind: 'filament',
      x: hub.x,
      y: hub.y - Math.round(Math.abs(Math.sin(dir * Math.PI * 2)) * len),
      w: rng.int(1, 2),
      h: len,
      bend,
      mat: i % 2 === 0 ? mat.hard : mat.soft,
      role: 'rib',
    });
  }
  sk.parts.push({ kind: 'core', x: hub.x, y: hub.y, w: rng.int(2, 3), h: rng.int(2, 3), mat: 'glow', role: 'accent' });
}

const OPS: Record<Transgression, (sk: Skeleton, rng: Rng) => void> = {
  proliferate,
  asymmetry,
  recurse,
  graft,
  invert,
  bloat,
  radiate,
};

export function transgress(
  sk: Skeleton,
  coverage: 'infiltrate' | 'rewrite' | 'overwrite',
  seed: number,
): Skeleton {
  const rng = new Rng(seed, `trans:${coverage}`);
  const budget = transgressionBudget(coverage);
  // 放射对称只在覆盖档解锁：一个东西变成放射状，读作"不再是这个世界的物件"。
  const pool: Transgression[] = TRANSGRESSIONS.filter(
    (t) => t !== 'radiate' || coverage === 'overwrite',
  );
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = t;
  }
  for (let i = 0; i < budget && i < bag.length; i++) {
    const op = bag[i]!;
    OPS[op](sk, rng);
    sk.applied.push(op);
  }
  weld(sk);
  return sk;
}

function touches(a: Part, b: Part): boolean {
  return (
    a.x - 1 < b.x + b.w && b.x - 1 < a.x + a.w && a.y - 1 < b.y + b.h && b.y - 1 < a.y + a.h
  );
}

/**
 * 违规不许把身体拆成飘着的碎片。任何构件必须与其他构件相接；不相接的拉回最近构件。
 * 这条和地图生成的连通纪律同源：先保证是一个东西，再谈它有多疯。
 */
function weld(sk: Skeleton): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const p of sk.parts) {
      if (sk.parts.some((q) => q !== p && touches(p, q))) continue;
      let best: Part | null = null;
      let bestD = Infinity;
      for (const q of sk.parts) {
        if (q === p) continue;
        const d = (p.x + p.w / 2 - (q.x + q.w / 2)) ** 2 + (p.y + p.h / 2 - (q.y + q.h / 2)) ** 2;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
      if (!best) continue;
      const dx = best.x + best.w / 2 - (p.x + p.w / 2);
      const dy = best.y + best.h / 2 - (p.y + p.h / 2);
      if (Math.abs(dx) > Math.abs(dy)) {
        p.x += Math.sign(dx) * Math.max(1, Math.abs(dx) - (p.w + best.w) / 2);
      } else {
        p.y += Math.sign(dy) * Math.max(1, Math.abs(dy) - (p.h + best.h) / 2);
      }
      p.x = Math.round(p.x);
      p.y = Math.max(1, Math.round(p.y));
      moved = true;
    }
    if (!moved) return;
  }
}
