import type Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';
import type { FlakeLocal } from '@/entities/contam-flakes';
import type { ClusterMode, JiaRecipe } from '@/entities/form-renderers/d/jia-recipe';
import {
  alphaAt,
  clearPx,
  hash32,
  makeBuf,
  px,
  unit,
  uploadPixels,
  warpMotion,
  type PaintBuf,
  type Rgba,
} from '@/entities/form-renderers/d/jia-pixels';
import { jiaDeform, paintJiaSilhouette, ZERO_DEFORM } from '@/entities/form-renderers/d/jia-silhouette';

interface Pt {
  readonly x: number;
  readonly y: number;
}

const FACINGS: readonly Facing4[] = ['down', 'up', 'left', 'right'];
const GAITS = ['idle', 'walk'] as const;
const MODES: readonly ClusterMode[] = ['patrol', 'search', 'chase', 'strike'];

function opaquePts(buf: PaintBuf): Pt[] {
  const out: Pt[] = [];
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (alphaAt(buf, x, y) !== 0) out.push({ x, y });
    }
  }
  return out;
}

function centroidX(pts: readonly Pt[]): number {
  if (pts.length === 0) return 16;
  let s = 0;
  for (const p of pts) s += p.x;
  return s / pts.length;
}

function brokenSide(x: number, facing: Facing4, cx: number): boolean {
  if (facing === 'left') return x < cx - 1;
  return x > cx + 1;
}

function isInterior(buf: PaintBuf, x: number, y: number): boolean {
  return (
    alphaAt(buf, x - 1, y) !== 0 &&
    alphaAt(buf, x + 1, y) !== 0 &&
    alphaAt(buf, x, y - 1) !== 0 &&
    alphaAt(buf, x, y + 1) !== 0
  );
}

function isOutline(buf: PaintBuf, x: number, y: number): boolean {
  if (alphaAt(buf, x, y) === 0) return false;
  return (
    alphaAt(buf, x - 1, y) === 0 ||
    alphaAt(buf, x + 1, y) === 0 ||
    alphaAt(buf, x, y - 1) === 0 ||
    alphaAt(buf, x, y + 1) === 0
  );
}

function layDeep(buf: PaintBuf, facing: Facing4, cx: number, deep: Rgba): void {
  const pts = opaquePts(buf);
  for (const p of pts) {
    if (!brokenSide(p.x, facing, cx)) continue;
    if ((p.x + p.y) % 5 === 0) {
      clearPx(buf, p.x, p.y);
      continue;
    }
    px(buf, p.x, p.y, deep);
  }
}

function punchIntact(buf: PaintBuf, facing: Facing4, cx: number): void {
  const pts = opaquePts(buf);
  for (const p of pts) {
    if (brokenSide(p.x, facing, cx)) continue;
    if (!isInterior(buf, p.x, p.y)) continue;
    if ((p.x + p.y * 2) % 2 === 0) clearPx(buf, p.x, p.y);
  }
}

function pickCenters(cells: readonly Pt[], k: number, seed: number): Pt[] {
  if (cells.length === 0) return [];
  const ranked = cells
    .map((p, i) => ({ p, u: unit(seed, i + 91) }))
    .sort((a, b) => a.u - b.u);
  const out: Pt[] = [];
  for (const row of ranked) {
    if (out.length >= k) break;
    if (out.some((c) => (c.x - row.p.x) ** 2 + (c.y - row.p.y) ** 2 < 16)) continue;
    out.push(row.p);
  }
  while (out.length < k && out.length < cells.length) out.push(cells[out.length]!);
  return out;
}

function expandGroup(center: Pt, cells: readonly Pt[], n: number): Pt[] {
  const ranked = [...cells].sort(
    (a, b) => (a.x - center.x) ** 2 + (a.y - center.y) ** 2 - ((b.x - center.x) ** 2 + (b.y - center.y) ** 2),
  );
  return ranked.slice(0, Math.max(1, n));
}

function clusterPlan(coverage: JiaRecipe['coverage']): { total: number; sizes: readonly number[] } {
  if (coverage === 'overwrite') return { total: 32, sizes: [12, 12, 8] };
  return { total: 17, sizes: [7, 6, 4] };
}

function stampClusters(
  buf: PaintBuf,
  facing: Facing4,
  cx: number,
  recipe: JiaRecipe,
  mode: ClusterMode,
): Pt[] {
  if (recipe.coverage === 'infiltrate') return [];
  const broken = opaquePts(buf).filter((p) => brokenSide(p.x, facing, cx));
  const pool = broken.length > 0 ? broken : opaquePts(buf);
  const plan = clusterPlan(recipe.coverage);
  const centers = pickCenters(pool, plan.sizes.length, recipe.seed);
  const used = new Set<string>();
  const cells: Pt[] = [];
  for (let g = 0; g < centers.length; g++) {
    const want = plan.sizes[g] ?? 4;
    for (const p of expandGroup(centers[g]!, pool, want + 4)) {
      const k = `${p.x},${p.y}`;
      if (used.has(k)) continue;
      used.add(k);
      cells.push(p);
      if (cells.length >= plan.total) break;
    }
    if (cells.length >= plan.total) break;
  }
  const keepCore = new Set(
    [cells[0], cells[Math.floor(cells.length / 2)], cells[cells.length - 1]]
      .filter((p): p is Pt => !!p)
      .map((p) => `${p.x},${p.y}`),
  );
  const searchGlow = new Set(cells.slice(0, 4).map((p) => `${p.x},${p.y}`));
  const hearts = centers.slice(0, 2);

  for (const p of cells) {
    const k = `${p.x},${p.y}`;
    let ink: Rgba = recipe.colors.core;
    if (mode === 'chase') ink = keepCore.has(k) ? recipe.colors.core : recipe.colors.glow;
    else if (mode === 'search' && searchGlow.has(k)) ink = recipe.colors.glow;
    else if (mode === 'strike') {
      const lead = facing === 'left' ? p.x <= cx - 2 : facing === 'right' ? p.x >= cx + 2 : facing === 'up' ? p.y <= 14 : p.y >= 20;
      ink = lead ? recipe.colors.bright : recipe.colors.core;
    }
    px(buf, p.x, p.y, ink);
  }
  for (const h of hearts) {
    if (mode === 'chase' && keepCore.has(`${h.x},${h.y}`)) continue;
    px(buf, h.x, h.y, recipe.colors.glow);
  }
  return cells;
}

function sprayMid(buf: PaintBuf, facing: Facing4, cx: number, recipe: JiaRecipe): void {
  const pts = opaquePts(buf);
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
  ];
  let n = 0;
  for (let i = 0; i < pts.length && n < 18; i++) {
    const p = pts[i]!;
    if (!isOutline(buf, p.x, p.y)) continue;
    if (!brokenSide(p.x, facing, cx) && recipe.family !== 'lamp_pillar') continue;
    if (unit(recipe.seed, i + 200) < 0.45) continue;
    for (const [dx, dy] of dirs) {
      if (alphaAt(buf, p.x + dx, p.y + dy) !== 0) continue;
      px(buf, p.x + dx, p.y + dy, recipe.colors.mid);
      n += 1;
      break;
    }
  }
}

function paintSpecks(
  buf: PaintBuf,
  recipe: JiaRecipe,
  facing: Facing4,
  cx: number,
  sway: number,
  infiltrate: boolean,
): void {
  const pts = opaquePts(buf);
  if (pts.length === 0) return;
  const sx = facing === 'left' ? -sway : facing === 'right' ? sway : 0;
  const sy = facing === 'up' ? -sway : facing === 'down' ? sway : 0;
  const want = infiltrate ? 6 : 1;
  let painted = 0;
  for (let i = 0; i < pts.length && painted < want; i++) {
    const idx = hash32(recipe.seed, i * 17 + 3) % pts.length;
    const p = pts[idx]!;
    if (!infiltrate && brokenSide(p.x, facing, cx)) continue;
    const ink = infiltrate && (painted === 2 || painted === 4) ? recipe.colors.cold : recipe.colors.core;
    px(buf, p.x + sx, p.y + sy, ink);
    painted += 1;
  }
}

function paintSense(buf: PaintBuf, recipe: JiaRecipe, facing: Facing4): void {
  if (recipe.sense !== 'sense_narrow' && recipe.sense !== 'sense_cone') return;
  const yOff = buf.h === 48 ? 8 : 0;
  const front = facing === 'left' ? 10 : facing === 'right' ? 22 : 16;
  const y = 6 + yOff;
  if (recipe.sense === 'sense_narrow') {
    if (facing === 'left' || facing === 'right') {
      px(buf, front, y, recipe.colors.core);
      px(buf, front, y + 1, recipe.colors.core);
    } else {
      px(buf, front, y, recipe.colors.core);
      px(buf, front + 1, y, recipe.colors.core);
    }
    return;
  }
  if (recipe.family === 'organic_remnant') {
    px(buf, facing === 'left' ? 11 : facing === 'right' ? 20 : 15, 6 + yOff, recipe.colors.earth);
  }
}

function paintShards(buf: PaintBuf, recipe: JiaRecipe): void {
  if (recipe.continuity !== 'shards') return;
  const yOff = buf.h === 48 ? 8 : 0;
  for (let y = 10 + yOff; y <= 18 + yOff; y++) clearPx(buf, 16, y);
}

function paintSatellites(buf: PaintBuf, recipe: JiaRecipe): void {
  const n = recipe.continuity === 'field' ? 4 : recipe.continuity === 'colony' ? 2 : 0;
  for (let i = 0; i < n; i++) {
    const x = 6 + (hash32(recipe.seed, 40 + i) % (buf.w - 12));
    const y = buf.h - 8 + (i % 3);
    px(buf, x, y, i % 2 === 0 ? recipe.colors.core : recipe.colors.deep);
    px(buf, x + 1, y, recipe.colors.deep);
  }
}

function paintUtterance(buf: PaintBuf, recipe: JiaRecipe, facing: Facing4): void {
  if (recipe.utterance !== 'door_still_closing' || recipe.family !== 'doorframe') return;
  const yOff = buf.h === 48 ? 8 : 0;
  px(buf, facing === 'left' ? 11 : 20, 16 + yOff, recipe.colors.glow);
}

function flakeLocals(buf: PaintBuf, originX: number, originY: number): FlakeLocal[] {
  const out: FlakeLocal[] = [];
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (!isOutline(buf, x, y)) continue;
      if (unit(x * 13 + y, y) > 0.18) continue;
      out.push({ x: x - originX, y: y - originY });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

export function bakeJiaBase(
  recipe: JiaRecipe,
  facing: Facing4,
  gait: 'idle' | 'walk',
  frame: number,
  mode: ClusterMode,
): PaintBuf {
  const buf = makeBuf(recipe.canvasW, recipe.canvasH);
  const infiltrate = recipe.coverage === 'infiltrate';
  const strike = mode === 'strike';
  const deform = infiltrate
    ? jiaDeform(recipe, facing, gait, frame, strike)
    : strike
      ? jiaDeform(recipe, facing, 'idle', 0, true)
      : ZERO_DEFORM;
  paintJiaSilhouette(buf, recipe.family, recipe.variant, facing, deform, recipe.colors);
  const cx = centroidX(opaquePts(buf));
  if (!infiltrate) {
    if (recipe.coverage === 'overwrite') punchIntact(buf, facing, cx);
    layDeep(buf, facing, cx, recipe.colors.deep);
    stampClusters(buf, facing, cx, recipe, mode);
    if (recipe.coverage === 'overwrite') sprayMid(buf, facing, cx, recipe);
  }
  paintShards(buf, recipe);
  paintSatellites(buf, recipe);
  paintSense(buf, recipe, facing);
  paintUtterance(buf, recipe, facing);
  if (infiltrate) paintSpecks(buf, recipe, facing, cx, deform.speck, true);
  else if (recipe.coverage === 'rewrite') paintSpecks(buf, recipe, facing, cx, 0, false);
  if (recipe.family === 'lamp_pillar' && recipe.variant === 0) {
    const yOff = buf.h === 48 ? 8 : 0;
    const faceNudge = facing === 'right' ? 1 : facing === 'left' ? -1 : 0;
    px(buf, 15 + faceNudge + deform.dx, 5 + yOff + deform.headDy, recipe.colors.glow);
  }
  if (infiltrate) return buf;
  const melt = true;
  return warpMotion(buf, gait, frame, facing, recipe.originX, recipe.originY, melt);
}

export function bakeJiaSheet(
  scene: Phaser.Scene,
  recipe: JiaRecipe,
  keyFor: (facing: Facing4, gait: 'idle' | 'walk', frame: number, mode: ClusterMode) => string,
  facings: readonly Facing4[] = FACINGS,
): { keys: string[]; flakes: Partial<Record<Facing4, readonly FlakeLocal[]>> } {
  const keys: string[] = [];
  const flakes: Partial<Record<Facing4, readonly FlakeLocal[]>> = {};
  const modes: readonly ClusterMode[] =
    recipe.coverage === 'infiltrate' ? ['patrol', 'strike'] : MODES;
  for (const facing of facings) {
    let flakeSrc: PaintBuf | null = null;
    for (const gait of GAITS) {
      for (let frame = 0; frame < 4; frame++) {
        for (const mode of modes) {
          const key = keyFor(facing, gait, frame, mode);
          const buf = bakeJiaBase(recipe, facing, gait, frame, mode);
          uploadPixels(scene, key, buf);
          keys.push(key);
          if (mode === 'patrol' && gait === 'idle' && frame === 0) flakeSrc = buf;
        }
      }
    }
    flakes[facing] = flakeSrc ? flakeLocals(flakeSrc, recipe.originX, recipe.originY) : [];
  }
  return { keys, flakes };
}

export function resolveJiaKey(
  keyFor: (facing: Facing4, gait: 'idle' | 'walk', frame: number, mode: ClusterMode) => string,
  facing: Facing4,
  gait: 'idle' | 'walk',
  frame: number,
  mode: ClusterMode,
  coverage: JiaRecipe['coverage'],
): string {
  const use = coverage === 'infiltrate' && mode !== 'strike' ? 'patrol' : mode;
  return keyFor(facing, gait, frame, use);
}
