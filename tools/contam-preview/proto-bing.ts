/**
 * PROTOTYPE — 丙：基体选拓扑，不选长宽比。Preview tooling only.
 *
 * 现行 `substrateShape()` 给三组椭圆旋钮，其中两组都是 `thin: true` 扁带，所以
 * 油膜和灰幕塌成同一个形体身份。这里三种基体是三种**拓扑**：
 *   菌毯 = 团（嵌套瓣）   油膜 = 树（分支脉络）   灰幕 = 环（带孔覆层）
 * 覆盖深度不是"更实"，而是拓扑违反自身：团裂成环 / 树闭成环路 / 环再嵌环。
 */

import type { FragmentContamRamp, Rgb } from '@/entities/form-renderers/d/fragment-ramp';
import { Rng } from './proto-skeleton';

export type BingTopology = 'lobe_mass' | 'vein_tree' | 'holed_veil';
export type Coverage = 'infiltrate' | 'rewrite' | 'overwrite';

export function topologyOf(substrate: string): BingTopology {
  if (substrate === 'oil_film') return 'vein_tree';
  if (substrate === 'ash_veil') return 'holed_veil';
  return 'lobe_mass';
}

export interface Field {
  readonly v: Float32Array;
  readonly w: number;
  readonly h: number;
}

function makeField(w: number, h: number): Field {
  return { v: new Float32Array(w * h), w, h };
}

function add(f: Field, x: number, y: number, amt: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= f.w || iy >= f.h) return;
  const i = iy * f.w + ix;
  if (amt > f.v[i]!) f.v[i] = amt;
}

function disc(f: Field, cx: number, cy: number, r: number, amt: number): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) continue;
      add(f, x, y, amt * (1 - Math.sqrt(d2) / (r + 0.001)) + amt * 0.35);
    }
  }
}

// -------------------------------------------------------------------- 团（菌毯）

function lobeMass(f: Field, rng: Rng, stage: number): void {
  const cx = f.w / 2;
  const cy = f.h / 2;
  const R = f.h * (0.2 + stage * 0.06);
  const lobes = 3 + rng.int(0, 3) + stage;
  const amp = 0.22 + rng.next() * 0.2;
  const phi = rng.next() * Math.PI * 2;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const bound = R * (1 + amp * Math.cos(lobes * a + phi));
      if (d > bound) continue;
      add(f, x, y, 1 - (d / bound) * 0.75);
    }
  }
  // 嵌套瓣：团里长团。覆盖档让子团顶破外沿 —— 拓扑违规，不是"更大"。
  const kids = stage === 0 ? 0 : 2 + stage * 2;
  for (let i = 0; i < kids; i++) {
    const a = rng.next() * Math.PI * 2;
    const push = stage >= 2 ? 1.05 + rng.next() * 0.35 : 0.45 + rng.next() * 0.35;
    disc(f, cx + Math.cos(a) * R * push, cy + Math.sin(a) * R * push, R * (0.16 + rng.next() * 0.2), 0.9);
  }
  if (stage >= 2) {
    // 团裂成环：挖掉中心，外圈仍连着。
    const hole = R * (0.3 + rng.next() * 0.18);
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (Math.hypot(x - cx, y - cy) < hole) f.v[y * f.w + x] = 0;
      }
    }
  }
}

// -------------------------------------------------------------------- 树（油膜）

function veinTree(f: Field, rng: Rng, stage: number): void {
  const trunks = 1 + stage;
  const maxDepth = 3 + stage;
  const ends: { x: number; y: number }[] = [];

  const walk = (x: number, y: number, ang: number, len: number, thick: number, depth: number): void => {
    let cx = x;
    let cy = y;
    let a = ang;
    for (let s = 0; s < len; s++) {
      a += (rng.next() - 0.5) * 0.42;
      cx += Math.cos(a);
      cy += Math.sin(a);
      const t = Math.max(0.6, thick * (1 - s / (len * 1.6)));
      disc(f, cx, cy, t, 0.85);
    }
    ends.push({ x: cx, y: cy });
    if (depth >= maxDepth) return;
    const kids = rng.int(1, depth === 0 ? 3 : 2);
    for (let k = 0; k < kids; k++) {
      walk(cx, cy, a + (rng.next() - 0.5) * 1.7, len * (0.6 + rng.next() * 0.25), thick * 0.7, depth + 1);
    }
  };

  for (let t = 0; t < trunks; t++) {
    const a = (t / trunks) * Math.PI * 2 + rng.next();
    walk(f.w / 2, f.h / 2, a, f.h * (0.1 + stage * 0.03), 2.4 + stage * 0.5, 0);
  }
  if (stage < 2 || ends.length < 2) return;
  // 树闭成环路：一棵树本不该有回路。这是拓扑违规。
  for (let i = 0; i + 1 < ends.length; i += 2) {
    const a = ends[i]!;
    const b = ends[i + 1]!;
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let s = 0; s <= steps; s++) {
      const t = s / Math.max(1, steps);
      disc(f, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 1.1, 0.8);
    }
  }
}

// -------------------------------------------------------------------- 环（灰幕）

function holedVeil(f: Field, rng: Rng, stage: number): void {
  const cx = f.w / 2;
  const cy = f.h / 2;
  const rx = f.w * (0.3 + stage * 0.05);
  const ry = f.h * (0.2 + stage * 0.04);
  const warp = 0.16 + rng.next() * 0.16;
  const k = 2 + rng.int(0, 3);
  const phi = rng.next() * Math.PI * 2;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = Math.hypot(nx, ny);
      const a = Math.atan2(ny, nx);
      if (d > 1 + warp * Math.cos(k * a + phi)) continue;
      add(f, x, y, 0.45 + 0.3 * (1 - d));
    }
  }
  const rings = 2 + stage * 2;
  for (let i = 0; i < rings; i++) {
    const a = rng.next() * Math.PI * 2;
    const dist = rng.next() * 0.72;
    const hx = cx + Math.cos(a) * rx * dist;
    const hy = cy + Math.sin(a) * ry * dist;
    const hr = Math.min(rx, ry) * (0.16 + rng.next() * 0.22);
    for (let y = Math.floor(hy - hr); y <= hy + hr; y++) {
      for (let x = Math.floor(hx - hr); x <= hx + hr; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - hx, y - hy);
        if (d < hr * 0.72) f.v[y * f.w + x] = 0;
        else if (d < hr) add(f, x, y, 1);
      }
    }
    // 覆盖档：环里再嵌环。
    if (stage >= 2 && i % 2 === 0) {
      const ir = hr * 0.45;
      for (let y = Math.floor(hy - ir); y <= hy + ir; y++) {
        for (let x = Math.floor(hx - ir); x <= hx + ir; x++) {
          if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
          if (Math.abs(Math.hypot(x - hx, y - hy) - ir) < 1) add(f, x, y, 0.95);
        }
      }
    }
  }
}

const STAGE: Record<Coverage, number> = { infiltrate: 0, rewrite: 1, overwrite: 2 };

export interface Buf {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

export function bakeBingProto(
  substrate: string,
  coverage: Coverage,
  seed: number,
  ramp: FragmentContamRamp,
  w: number,
  h: number,
): Buf {
  const topo = topologyOf(substrate);
  const f = makeField(w, h);
  const rng = new Rng(seed, `bing:${topo}:${coverage}`);
  const stage = STAGE[coverage];
  if (topo === 'lobe_mass') lobeMass(f, rng, stage);
  else if (topo === 'vein_tree') veinTree(f, rng, stage);
  else holedVeil(f, rng, stage);

  // 亮核克制：整场压到 deep/mid 区间，再撒少量核点。不许整团发光。
  for (let i = 0; i < f.v.length; i++) f.v[i] = f.v[i]! * 0.58;
  const lit: number[] = [];
  for (let i = 0; i < f.v.length; i++) if (f.v[i]! > 0.3) lit.push(i);
  const cores = 3 + stage * 4;
  for (let n = 0; n < cores && lit.length > 0; n++) {
    const i = lit[rng.int(0, lit.length - 1)]!;
    f.v[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (n % 2 === 0 && x + 1 < w) f.v[i + 1] = 0.82;
    if (n % 3 === 0 && y + 1 < h) f.v[i + w] = 0.82;
  }

  const out = new Uint8ClampedArray(w * h * 4);
  const bands: readonly { readonly lo: number; readonly rgb: Rgb; readonly a: number }[] = [
    { lo: 0.95, rgb: ramp.glow, a: 255 },
    { lo: 0.78, rgb: ramp.core, a: 250 },
    { lo: 0.42, rgb: ramp.mid, a: 232 },
    { lo: 0.1, rgb: ramp.deep, a: 208 },
  ];
  for (let i = 0; i < w * h; i++) {
    const v = f.v[i]!;
    if (v < 0.1) continue;
    const band = bands.find((b) => v >= b.lo) ?? bands[3]!;
    out[i * 4] = band.rgb[0];
    out[i * 4 + 1] = band.rgb[1];
    out[i * 4 + 2] = band.rgb[2];
    out[i * 4 + 3] = band.a;
  }
  return { data: out, w, h };
}
