/** Small CPU pixel rasterizer for authored ground-space creature anatomy.
 * Geometry, materials and choreography belong to each model; this module only
 * projects authored anatomy and paints part-local material folds into three
 * ink steps. Mesh normals establish light direction, not a finished face color. */
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import { makeBuf, type PaintBuf } from './genome/buffer';
import type { GenomeCanvas } from './genome/types';
import { bodyInk, bodyFold, finishBodyPixels } from './body-pixel-material';

export type ModelPoint = readonly [number, number, number];
export type ModelColor = readonly [number, number, number];
export type CreaturePhase = 'idle' | 'walk' | 'alert' | 'windup' | 'strike' | 'recover';
export interface CreatureModelRequest {
  seed: number;
  coverage: CoverageId;
  facing4: 'up' | 'down' | 'left' | 'right';
  phase: CreaturePhase;
  phase01: number;
  /** 0 = active, 1 = settled. The contact plane remains at the same height. */
  restAmount?: number;
}
export interface CreatureModelResult { buf: PaintBuf; canvas: GenomeCanvas }
export const smoothModel = (p: number): number => p * p * (3 - 2 * p);
export const modelProgress = (p: number): number => Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
export function modelSeed(seed: number): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ h >>> 16, 0x21f0aaad);
  h = Math.imul(h ^ h >>> 15, 0x735a2d97);
  return (h ^ h >>> 15) >>> 0;
}
const add = (a: ModelPoint, b: ModelPoint): ModelPoint => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: ModelPoint, b: ModelPoint): ModelPoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: ModelPoint, b: ModelPoint): ModelPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: ModelPoint): ModelPoint => { const n = Math.hypot(...v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };

export function createModelRaster(req: CreatureModelRequest, label: string, articulate?: (point: ModelPoint) => ModelPoint) {
  const buf = makeBuf(64, 64);
  const canvas: GenomeCanvas = { w: 64, h: 64, originX: 32, originY: 42, offsetX: 0, offsetY: 0, collision: 20, coverage: req.coverage };
  const depth = new Float64Array(4096).fill(-Infinity);
  const rest = modelProgress(req.restAmount ?? 0);
  const settle = (v: ModelPoint): ModelPoint => rest === 0 || v[2] <= 2 ? v : [v[0], v[1], 2 + (v[2] - 2) * (1 - rest * .38)];
  const angle = { down: 0, left: Math.PI / 2, up: Math.PI, right: -Math.PI / 2 }[req.facing4];
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const rotate = (v: ModelPoint): ModelPoint => [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs, v[2]];
  const project = (v: ModelPoint): ModelPoint => { const p = rotate(v); return [32 + p[0], 42 + p[1] * .48 - p[2], p[1] + p[2] * .48]; };
  let surface: ((p: ModelPoint) => number) | undefined;
  function triangle(a: ModelPoint, b: ModelPoint, c: ModelPoint, color: ModelColor): void {
    const sourceA = a, sourceB = b, sourceC = c;
    a = settle(articulate ? articulate(a) : a); b = settle(articulate ? articulate(b) : b); c = settle(articulate ? articulate(c) : c);
    const normal = norm(rotate(cross(sub(b, a), sub(c, a))));
    const illumination = Math.max(0, normal[0] * -.43 + normal[1] * -.3 + normal[2] * .84);

    const pa = project(a), pb = project(b), pc = project(c);
    const den = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1]);
    if (Math.abs(den) < .00001) return;
    const x0 = Math.floor(Math.min(pa[0], pb[0], pc[0])), x1 = Math.ceil(Math.max(pa[0], pb[0], pc[0]));
    const y0 = Math.floor(Math.min(pa[1], pb[1], pc[1])), y1 = Math.ceil(Math.max(pa[1], pb[1], pc[1]));
    if (x0 < 0 || y0 < 0 || x1 > 63 || y1 > 63) throw Error(`${label} geometry outside canvas: ${req.seed}/${req.coverage}/${req.facing4}/${req.phase}/${req.phase01}`);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = ((pb[1] - pc[1]) * (x + .5 - pc[0]) + (pc[0] - pb[0]) * (y + .5 - pc[1])) / den;
      const v = ((pc[1] - pa[1]) * (x + .5 - pc[0]) + (pa[0] - pc[0]) * (y + .5 - pc[1])) / den;
      const w = 1 - u - v;
      if (u < -.0001 || v < -.0001 || w < -.0001) continue;
      const z = u * pa[2] + v * pb[2] + w * pc[2], i = y * 64 + x;
      if (z < depth[i]!) continue;
      depth[i] = z;
      const mark = surface?.([u * sourceA[0] + v * sourceB[0] + w * sourceC[0], u * sourceA[1] + v * sourceB[1] + w * sourceC[1], u * sourceA[2] + v * sourceB[2] + w * sourceC[2]]) ?? 0;
      const rgb = bodyInk(color, illumination, mark);
      buf.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
    }
  }
  function face(points: readonly ModelPoint[], color: ModelColor): void {
    for (let i = 1; i < points.length - 1; i++) triangle(points[0]!, points[i]!, points[i + 1]!, color);
  }
  function tube(a: ModelPoint, b: ModelPoint, r0: number, r1: number, color: ModelColor, cuts = 6): void {
    const axis = norm(sub(b, a));
    const u = norm(cross(axis, Math.abs(axis[2]) > .85 ? [0, 1, 0] : [0, 0, 1]));
    const v = norm(cross(axis, u));
    const previousSurface = surface;
    const length = Math.hypot(...sub(b, a));
    surface = point => {
      const local = sub(point, a);
      const along = (local[0] * axis[0] + local[1] * axis[1] + local[2] * axis[2]) / (length || 1);
      const across = local[0] * u[0] + local[1] * u[1] + local[2] * u[2];
      return Math.max(r0, r1) < 1.8 ? 0 : bodyFold(across, along * length, label);
    };
    const ring = (at: ModelPoint, radius: number): ModelPoint[] => Array.from({ length: cuts }, (_, i) => {
      const c = Math.cos(i * Math.PI * 2 / cuts) * radius, s = Math.sin(i * Math.PI * 2 / cuts) * radius;
      return add(at, [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s]);
    });
    const aa = ring(a, r0), bb = ring(b, r1);
    face([...aa].reverse(), color); face(bb, color);
    for (let i = 0; i < cuts; i++) face([aa[i]!, aa[(i + 1) % cuts]!, bb[(i + 1) % cuts]!, bb[i]!], color);
    surface = previousSurface;
  }
  function volume(rings: readonly { at: ModelPoint; rx: number; ry: number }[], color: ModelColor): void {
    const previousSurface = surface;
    const bottom = rings[0]!, top = rings[rings.length - 1]!;
    const height = top.at[2] - bottom.at[2];
    surface = point => {
      const along = height === 0 ? 0 : (point[2] - bottom.at[2]) / height;
      const centerX = bottom.at[0] + (top.at[0] - bottom.at[0]) * along;
      const centerY = bottom.at[1] + (top.at[1] - bottom.at[1]) * along;
      return bodyFold(point[0] - centerX + (point[1] - centerY) * .4, along * Math.abs(height), label);
    };
    const cuts = [[-.66, -1], [.66, -1], [1, -.58], [1, .58], [.66, 1], [-.66, 1], [-1, .58], [-1, -.58]] as const;
    const rows = rings.map(r => cuts.map(([x, y]): ModelPoint => [r.at[0] + x * r.rx, r.at[1] + y * r.ry, r.at[2]]));
    face([...rows[0]!].reverse(), color);
    for (let j = 1; j < rows.length; j++) for (let i = 0; i < 8; i++) face([rows[j - 1]![i]!, rows[j - 1]![(i + 1) % 8]!, rows[j]![(i + 1) % 8]!, rows[j]![i]!], color);
    face(rows[rows.length - 1]!, color);
    surface = previousSurface;
  }
  function mass(at: ModelPoint, radii: ModelPoint, color: ModelColor): void {
    volume([
      { at: [at[0], at[1], at[2] - radii[2]], rx: radii[0] * .31, ry: radii[1] * .37 },
      { at: [at[0] - radii[0] * .04, at[1], at[2] - radii[2] * .36], rx: radii[0] * .96, ry: radii[1] },
      { at: [at[0], at[1] + radii[1] * .035, at[2] + radii[2] * .13], rx: radii[0], ry: radii[1] * .97 },
      { at: [at[0] - radii[0] * .08, at[1], at[2] + radii[2] * .68], rx: radii[0] * .7, ry: radii[1] * .78 },
      { at: [at[0] - radii[0] * .08, at[1] - radii[1] * .1, at[2] + radii[2]], rx: radii[0] * .2, ry: radii[1] * .28 },
    ], color);
  }
  return { buf, canvas, triangle, face, tube, volume, mass, finish: () => finishBodyPixels(buf) };
}
