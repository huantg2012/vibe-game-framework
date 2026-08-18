/**
 * Layer 1c: combined stealth density after identity walls.
 * A = new mass in the current largest yard.
 * B = stop when the next hide is inside a 7-tile cone; keep a 6×6 plaza; gaps 4–6.
 * C = thick divider with a wide end opening, only on ridge / L / twin-beam anchors.
 * D = cover-distance ruler (stop + retry gate). Not a sightline factory.
 * E = 2-thick short flanges off existing masses; no nets, no rim hand-holding.
 * Preview stack only. Does not wire RiftScene.
 */

import { countWalkableComponents } from '@/generation/connectivity';
import { maxOpenYard, maxOpenYardRect } from '@/generation/masses';
import type { MapRecipe } from '@/generation/recipes';
import { measureSilhouette, silhouetteFails, thickStoneMask, woodMask } from '@/generation/silhouette';
import type { StructureGrammar } from '@/generation/structure-grammars';
import { SeededRandom } from '@/utils/random';

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const WALL_FILL_CAP = 0.17;
const WALL_HARD_CAP = 0.18;
const P90_TARGET = 7;
const P90_GATE = 8;
const YARD_TARGET = 96;
const YARD_GATE = 112;
const FAR_COVER = 7;
const FAR_BLOB_GATE = 48;
const PLAZA = 6;
const MIN_STAMP = 4;

export interface StealthDensitySpec {
  readonly allowDivider: boolean;
  readonly maxDividers: number;
  readonly rimRing: boolean;
  readonly preferPlate: boolean;
  readonly maxFlangesPerMass: number;
  readonly minGap: number;
}

export interface CoverReachMetrics {
  readonly median: number;
  readonly p90: number;
  readonly farBlob: number;
}

interface DensityCtx {
  land: Uint8Array;
  walls: Uint8Array;
  cols: number;
  rows: number;
  paint: ReadonlyArray<{ col: number; row: number; role: string }>;
  keepWood: Uint8Array;
  plaza: Uint8Array;
  voidDist: Int16Array;
  rng: SeededRandom;
  spec: StealthDensitySpec;
}

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function isFloor(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): boolean {
  if (!inBounds(cols, rows, col, row)) return false;
  const i = at(cols, col, row);
  return !!land[i] && !walls[i];
}

function wallRatio(land: Uint8Array, walls: Uint8Array): number {
  let landN = 0;
  let wallN = 0;
  for (let i = 0; i < land.length; i++) {
    if (land[i]) landN++;
    if (walls[i]) wallN++;
  }
  return landN === 0 ? 0 : wallN / landN;
}

function rect(ox: number, oy: number, w: number, h: number): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number }> = [];
  for (let row = oy; row < oy + h; row++) {
    for (let col = ox; col < ox + w; col++) cells.push({ col, row });
  }
  return cells;
}

function voidDistField(land: Uint8Array, cols: number, rows: number): Int16Array {
  const dist = new Int16Array(land.length);
  dist.fill(32767);
  const q: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (land[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  for (let head = 0; head < q.length; head++) {
    const i = q[head]!;
    const col = i % cols;
    const row = (i / cols) | 0;
    const d = dist[i]!;
    for (const [dx, dy] of DIRS4) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds(cols, rows, nc, nr)) continue;
      const ni = at(cols, nc, nr);
      if (dist[ni]! <= d + 1) continue;
      dist[ni] = (d + 1) as number;
      q.push(ni);
    }
  }
  return dist;
}

function nearestWallField(land: Uint8Array, walls: Uint8Array, cols: number, rows: number): Int16Array {
  const dist = new Int16Array(land.length);
  dist.fill(32767);
  const q: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || !walls[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  for (let head = 0; head < q.length; head++) {
    const i = q[head]!;
    const col = i % cols;
    const row = (i / cols) | 0;
    const d = dist[i]!;
    for (const [dx, dy] of DIRS4) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds(cols, rows, nc, nr)) continue;
      const ni = at(cols, nc, nr);
      if (!land[ni] || dist[ni]! <= d + 1) continue;
      dist[ni] = (d + 1) as number;
      q.push(ni);
    }
  }
  return dist;
}

export function coverDistanceField(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  paint: ReadonlyArray<{ col: number; row: number; role: string }> = [],
): Float32Array {
  const wood = woodMask(cols, rows, paint);
  const thick = thickStoneMask(walls, wood, cols, rows);
  const dist = new Float32Array(land.length);
  dist.fill(1e9);
  const q: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (!thick[i] || !walls[i]) continue;
    dist[i] = 0;
    q.push(i);
  }
  for (let head = 0; head < q.length; head++) {
    const i = q[head]!;
    const col = i % cols;
    const row = (i / cols) | 0;
    const d = dist[i]!;
    for (const [dx, dy] of DIRS4) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds(cols, rows, nc, nr)) continue;
      const ni = at(cols, nc, nr);
      if (!land[ni] || dist[ni]! <= d + 1) continue;
      dist[ni] = d + 1;
      q.push(ni);
    }
  }
  return dist;
}

export function measureCoverReach(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  paint: ReadonlyArray<{ col: number; row: number; role: string }> = [],
): CoverReachMetrics {
  const dist = coverDistanceField(land, walls, cols, rows, paint);
  const vals: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || walls[i]) continue;
    const d = dist[i]!;
    if (d > 1e8) continue;
    vals.push(d);
  }
  vals.sort((a, b) => a - b);
  const median = vals.length === 0 ? 99 : vals[(vals.length / 2) | 0]!;
  const p90 = vals.length === 0 ? 99 : vals[Math.min(vals.length - 1, (vals.length * 0.9) | 0)]!;

  const seen = new Uint8Array(land.length);
  let farBlob = 0;
  for (let i = 0; i < land.length; i++) {
    if (seen[i] || !land[i] || walls[i] || dist[i]! <= FAR_COVER || dist[i]! > 1e8) continue;
    let n = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      n++;
      const col = cur % cols;
      const row = (cur / cols) | 0;
      for (const [dx, dy] of DIRS4) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds(cols, rows, nc, nr)) continue;
        const ni = at(cols, nc, nr);
        if (seen[ni] || !land[ni] || walls[ni] || dist[ni]! <= FAR_COVER || dist[ni]! > 1e8) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (n > farBlob) farBlob = n;
  }
  return { median, p90, farBlob };
}

export function coverReachFails(m: CoverReachMetrics, maxYard = 0, rimRing = false): string | null {
  if (m.p90 > P90_GATE + 1e-6) return `cover p90 ${m.p90.toFixed(1)} > ${P90_GATE}`;
  if (m.farBlob > FAR_BLOB_GATE) return `cover far-blob ${m.farBlob} > ${FAR_BLOB_GATE}`;
  if (!rimRing && maxYard > YARD_GATE) return `open yard ${maxYard} > ${YARD_GATE}`;
  return null;
}

export function stealthSpecFor(recipe: MapRecipe): StealthDensitySpec {
  const g: StructureGrammar = recipe.structure.grammar;
  const plateish = recipe.cover.cycle.includes('plate');
  return {
    allowDivider:
      g === 'ridge' ||
      g === 'orthoRidge' ||
      g === 'twinRidge' ||
      g === 'pads' ||
      g === 'plates' ||
      g === 'hunks',
    maxDividers: g === 'orthoRidge' || g === 'pads' || g === 'plates' || g === 'hunks' ? 1 : 2,
    rimRing: g === 'rim',
    preferPlate: plateish && g !== 'plates' && g !== 'hunks',
    maxFlangesPerMass: g === 'plates' ? 1 : 2,
    minGap: g === 'shear' || g === 'plates' ? 5 : 4,
  };
}

function blockedCell(ctx: DensityCtx, col: number, row: number): boolean {
  const { cols, rows, keepWood, plaza } = ctx;
  if (!inBounds(cols, rows, col, row)) return true;
  const i = at(cols, col, row);
  if (keepWood[i] || plaza[i]) return true;
  for (const [dx, dy] of DIRS4) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds(cols, rows, nc, nr)) continue;
    if (keepWood[at(cols, nc, nr)]) return true;
  }
  return false;
}

function tryStamp(ctx: DensityCtx, cells: ReadonlyArray<{ col: number; row: number }>): boolean {
  const { land, walls, cols, rows, paint } = ctx;
  if (wallRatio(land, walls) >= WALL_HARD_CAP) return false;
  const trial = new Uint8Array(walls);
  let n = 0;
  for (const cell of cells) {
    if (!isFloor(land, trial, cols, rows, cell.col, cell.row)) continue;
    if (blockedCell(ctx, cell.col, cell.row)) continue;
    trial[at(cols, cell.col, cell.row)] = 1;
    n++;
  }
  if (n < MIN_STAMP) return false;
  if (wallRatio(land, trial) > WALL_HARD_CAP + 1e-6) return false;
  if (countWalkableComponents(land, trial, cols, rows) !== 1) return false;
  const sil = measureSilhouette(land, trial, cols, rows, paint);
  if (silhouetteFails(sil)) return false;
  walls.set(trial);
  return true;
}

function markPlaza(ctx: DensityCtx, col: number, row: number): void {
  const { cols, rows, plaza } = ctx;
  for (let r = row; r < row + PLAZA; r++) {
    for (let c = col; c < col + PLAZA; c++) {
      if (!inBounds(cols, rows, c, r)) continue;
      plaza[at(cols, c, r)] = 1;
    }
  }
}

function reservePlaza(ctx: DensityCtx): void {
  const { land, walls, cols, rows, paint, spec, voidDist } = ctx;
  const wood = woodMask(cols, rows, paint);
  const thick = thickStoneMask(walls, wood, cols, rows);
  let best: { col: number; row: number; score: number } | null = null;
  for (let row = 0; row <= rows - PLAZA; row++) {
    for (let col = 0; col <= cols - PLAZA; col++) {
      let open = true;
      let minVoid = 999;
      for (let r = row; r < row + PLAZA && open; r++) {
        for (let c = col; c < col + PLAZA; c++) {
          const i = at(cols, c, r);
          if (!land[i] || walls[i]) {
            open = false;
            break;
          }
          if (voidDist[i]! < minVoid) minVoid = voidDist[i]!;
        }
      }
      if (!open) continue;
      let edged = false;
      for (let r = row - 2; r < row + PLAZA + 2 && !edged; r++) {
        for (let c = col - 2; c < col + PLAZA + 2; c++) {
          if (!inBounds(cols, rows, c, r)) continue;
          const inside = c >= col && c < col + PLAZA && r >= row && r < row + PLAZA;
          if (inside) continue;
          if (thick[at(cols, c, r)]) {
            edged = true;
            break;
          }
        }
      }
      if (!edged) continue;
      const score = minVoid;
      if (!best || score > best.score) best = { col, row, score };
    }
  }
  if (best) {
    markPlaza(ctx, best.col, best.row);
    return;
  }
  if (spec.rimRing) {
    let deep: { col: number; row: number; score: number } | null = null;
    for (let row = 0; row <= rows - PLAZA; row++) {
      for (let col = 0; col <= cols - PLAZA; col++) {
        let open = true;
        let minVoid = 999;
        for (let r = row; r < row + PLAZA && open; r++) {
          for (let c = col; c < col + PLAZA; c++) {
            const i = at(cols, c, r);
            if (!land[i] || walls[i]) {
              open = false;
              break;
            }
            if (voidDist[i]! < minVoid) minVoid = voidDist[i]!;
          }
        }
        if (!open) continue;
        if (!deep || minVoid > deep.score) deep = { col, row, score: minVoid };
      }
    }
    if (deep) markPlaza(ctx, deep.col, deep.row);
    return;
  }
  const yard = maxOpenYardRect(land, walls, cols, rows);
  if (yard.width < PLAZA || yard.height < PLAZA) return;
  const col = yard.col + Math.max(0, ((yard.width - PLAZA) / 2) | 0);
  const row = yard.row + Math.max(0, ((yard.height - PLAZA) / 2) | 0);
  markPlaza(ctx, col, row);
}

function dividerCells(
  yard: { col: number; row: number; width: number; height: number },
  endEastOrSouth: boolean,
): Array<{ col: number; row: number }> {
  const gap = 6;
  const thick = 2;
  const cells: Array<{ col: number; row: number }> = [];
  if (yard.width >= yard.height) {
    const row0 = yard.row + Math.max(5, Math.min(yard.height - 7, ((yard.height - thick) / 2) | 0));
    const run = Math.max(6, yard.width - gap);
    const start = endEastOrSouth ? 0 : yard.width - run;
    for (let k = 0; k < run; k++) {
      for (let t = 0; t < thick; t++) {
        cells.push({ col: yard.col + start + k, row: row0 + t });
      }
    }
  } else {
    const col0 = yard.col + Math.max(5, Math.min(yard.width - 7, ((yard.width - thick) / 2) | 0));
    const run = Math.max(6, yard.height - gap);
    const start = endEastOrSouth ? 0 : yard.height - run;
    for (let k = 0; k < run; k++) {
      for (let t = 0; t < thick; t++) {
        cells.push({ col: col0 + t, row: yard.row + start + k });
      }
    }
  }
  return cells;
}

function placeDividers(ctx: DensityCtx): void {
  if (!ctx.spec.allowDivider || ctx.spec.rimRing) return;
  for (let n = 0; n < ctx.spec.maxDividers; n++) {
    const yard = maxOpenYardRect(ctx.land, ctx.walls, ctx.cols, ctx.rows);
    if (yard.area < 88) break;
    if (yard.width < 12 || yard.height < 12) break;
    const end = ctx.rng.next() < 0.5;
    if (tryStamp(ctx, dividerCells(yard, end))) continue;
    if (tryStamp(ctx, dividerCells(yard, !end))) continue;
    break;
  }
}

function wallComponents(ctx: DensityCtx): number[][] {
  const { land, walls, cols, rows } = ctx;
  const seen = new Uint8Array(walls.length);
  const out: number[][] = [];
  for (let i = 0; i < walls.length; i++) {
    if (!walls[i] || !land[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    const cells = [i];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const col = cur % cols;
      const row = (cur / cols) | 0;
      for (const [dx, dy] of DIRS4) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds(cols, rows, nc, nr)) continue;
        const ni = at(cols, nc, nr);
        if (seen[ni] || !walls[ni] || !land[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
        cells.push(ni);
      }
    }
    out.push(cells);
  }
  return out;
}

function flangeTouchesForeign(
  ctx: DensityCtx,
  cells: ReadonlyArray<{ col: number; row: number }>,
  mother: Set<number>,
): boolean {
  const { walls, cols, rows } = ctx;
  const self = new Set(cells.map((c) => at(cols, c.col, c.row)));
  for (const cell of cells) {
    let onMother = false;
    for (const [dx, dy] of DIRS4) {
      const ni = inBounds(cols, rows, cell.col + dx, cell.row + dy)
        ? at(cols, cell.col + dx, cell.row + dy)
        : -1;
      if (ni >= 0 && mother.has(ni)) onMother = true;
    }
    if (onMother) continue;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dc === 0 && dr === 0) continue;
        const nc = cell.col + dc;
        const nr = cell.row + dr;
        if (!inBounds(cols, rows, nc, nr)) continue;
        const ni = at(cols, nc, nr);
        if (!walls[ni]) continue;
        if (mother.has(ni) || self.has(ni)) continue;
        if (Math.abs(dc) + Math.abs(dr) <= 3) return true;
      }
    }
  }
  return false;
}

function placeFlanges(ctx: DensityCtx): void {
  const comps = wallComponents(ctx).filter((c) => c.length >= 6);
  for (const comp of comps) {
    const mother = new Set(comp);
    const tips: Array<{ col: number; row: number; dx: number; dy: number; open: number }> = [];
    for (const i of comp) {
      const col = i % ctx.cols;
      const row = (i / ctx.cols) | 0;
      for (const [dx, dy] of DIRS4) {
        let open = 0;
        for (let k = 1; k <= 5; k++) {
          if (!isFloor(ctx.land, ctx.walls, ctx.cols, ctx.rows, col + dx * k, row + dy * k)) break;
          if (blockedCell(ctx, col + dx * k, row + dy * k)) break;
          open++;
        }
        if (open < 4) continue;
        if (ctx.spec.rimRing) {
          const baseV = ctx.voidDist[at(ctx.cols, col, row)]!;
          const tipV = ctx.voidDist[at(ctx.cols, col + dx * 4, row + dy * 4)]!;
          if (tipV <= baseV) continue;
        }
        tips.push({ col, row, dx, dy, open });
      }
    }
    tips.sort((a, b) => b.open - a.open);
    let placed = 0;
    for (const tip of tips) {
      if (placed >= ctx.spec.maxFlangesPerMass) break;
      const cells: Array<{ col: number; row: number }> = [];
      const px = -tip.dy;
      const py = tip.dx;
      for (let k = 1; k <= 4; k++) {
        const col = tip.col + tip.dx * k;
        const row = tip.row + tip.dy * k;
        cells.push({ col, row });
        cells.push({ col: col + px, row: row + py });
      }
      if (flangeTouchesForeign(ctx, cells, mother)) continue;
      if (tryStamp(ctx, cells)) placed++;
    }
  }
}

function inRimRing(ctx: DensityCtx, col: number, row: number): boolean {
  if (!ctx.spec.rimRing) return true;
  const d = ctx.voidDist[at(ctx.cols, col, row)]!;
  return d >= 2 && d <= 10;
}

function pickSplitInYard(
  ctx: DensityCtx,
  minWall: number,
  skip: Set<number>,
): { col: number; row: number } | null {
  const { land, walls, cols, rows } = ctx;
  const yard = maxOpenYardRect(land, walls, cols, rows);
  const dist = nearestWallField(land, walls, cols, rows);
  let best: { col: number; row: number; dist: number } | null = null;
  for (let row = yard.row; row < yard.row + yard.height - 3; row++) {
    for (let col = yard.col; col < yard.col + yard.width - 3; col++) {
      if (skip.has(at(cols, col, row))) continue;
      if (blockedCell(ctx, col, row)) continue;
      if (!inRimRing(ctx, col, row)) continue;
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      const d = dist[at(cols, col, row)]!;
      if (d < minWall) continue;
      if (!best || d > best.dist) best = { col, row, dist: d };
    }
  }
  return best ? { col: best.col, row: best.row } : null;
}

function farthestFloor(
  ctx: DensityCtx,
): { col: number; row: number; dist: number } | null {
  const { land, walls, cols, rows } = ctx;
  const dist = nearestWallField(land, walls, cols, rows);
  let best: { col: number; row: number; dist: number } | null = null;
  for (let row = 0; row < rows - 2; row++) {
    for (let col = 0; col < cols - 2; col++) {
      if (blockedCell(ctx, col, row)) continue;
      if (!inRimRing(ctx, col, row)) continue;
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      const d = dist[at(cols, col, row)]!;
      if (!best || d > best.dist) best = { col, row, dist: d };
    }
  }
  return best;
}

function stampFamily(ctx: DensityCtx, seed: { col: number; row: number }): boolean {
  const { rng, spec } = ctx;
  if (spec.preferPlate) {
    const long = rng.nextInt(4, 5);
    const horizontal = rng.next() < 0.5;
    const cells = horizontal ? rect(seed.col, seed.row, long, 2) : rect(seed.col, seed.row, 2, long);
    if (tryStamp(ctx, cells)) return true;
  }
  const w = rng.nextInt(3, 4);
  const h = rng.nextInt(3, 4);
  if (tryStamp(ctx, rect(seed.col, seed.row, w, h))) return true;
  return tryStamp(ctx, rect(seed.col, seed.row, 3, 3));
}

function fillHoles(ctx: DensityCtx): void {
  const skip = new Set<number>();
  for (let n = 0; n < 48; n++) {
    const ratio = wallRatio(ctx.land, ctx.walls);
    if (ratio >= WALL_FILL_CAP) break;
    const reach = measureCoverReach(ctx.land, ctx.walls, ctx.cols, ctx.rows, ctx.paint);
    const yard = maxOpenYard(ctx.land, ctx.walls, ctx.cols, ctx.rows);
    if (yard <= YARD_TARGET && reach.p90 <= P90_TARGET) break;

    const gap = yard > YARD_TARGET ? Math.min(4, ctx.spec.minGap) : ctx.spec.minGap;
    let seed: { col: number; row: number } | null = pickSplitInYard(ctx, gap, skip);
    const far = farthestFloor(ctx);
    if (!seed && far && far.dist > gap && !skip.has(at(ctx.cols, far.col, far.row))) {
      seed = { col: Math.max(0, far.col - 1), row: Math.max(0, far.row - 1) };
    }
    if (!seed) break;
    if (stampFamily(ctx, seed)) continue;
    skip.add(at(ctx.cols, seed.col, seed.row));
    if (far) skip.add(at(ctx.cols, far.col, far.row));
  }
}

export function applyStealthDensity(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  paint: ReadonlyArray<{ col: number; row: number; role: string }>,
  keepWood: Uint8Array,
  rng: SeededRandom,
  spec: StealthDensitySpec,
): void {
  const ctx: DensityCtx = {
    land,
    walls,
    cols,
    rows,
    paint,
    keepWood,
    plaza: new Uint8Array(land.length),
    voidDist: voidDistField(land, cols, rows),
    rng,
    spec,
  };
  placeDividers(ctx);
  reservePlaza(ctx);
  fillHoles(ctx);
  placeFlanges(ctx);
  fillHoles(ctx);
}
