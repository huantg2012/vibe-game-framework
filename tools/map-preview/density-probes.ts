/**
 * Preview-only density probes for the five stealth-space schemes.
 * Does not replace generateRecipeDraft. Does not wire RiftScene.
 */
import { countWalkableComponents, openSealedFloors } from '../../src/generation/connectivity.ts';
import { maxOpenYard, maxOpenYardRect } from '../../src/generation/masses.ts';
import { thickStoneMask, woodMask } from '../../src/generation/silhouette.ts';
import type { RuinedMask } from '../../src/generation/types.ts';
import { SeededRandom } from '../../src/utils/random.ts';

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export type ProbeScheme = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ProbeStats {
  readonly wallRatio: number;
  readonly maxYard: number;
  readonly p90Cover: number;
  readonly medianCover: number;
}

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
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

function isFloor(land: Uint8Array, walls: Uint8Array, cols: number, rows: number, col: number, row: number): boolean {
  if (!inBounds(cols, rows, col, row)) return false;
  const i = at(cols, col, row);
  return !!land[i] && !walls[i];
}

function tryStamp(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  cells: ReadonlyArray<{ col: number; row: number }>,
): boolean {
  const trial = new Uint8Array(walls);
  let n = 0;
  for (const cell of cells) {
    if (!isFloor(land, trial, cols, rows, cell.col, cell.row)) continue;
    trial[at(cols, cell.col, cell.row)] = 1;
    n++;
  }
  if (n < 4) return false;
  if (countWalkableComponents(land, trial, cols, rows) !== 1) return false;
  walls.set(trial);
  return true;
}

function rect(
  ox: number,
  oy: number,
  w: number,
  h: number,
): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number }> = [];
  for (let row = oy; row < oy + h; row++) {
    for (let col = ox; col < ox + w; col++) cells.push({ col, row });
  }
  return cells;
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

/** Distance on floor to nearest thick (2×2 or wood) cover. Walls that aren't thick are ignored as sources. */
export function coverDistanceField(mask: RuinedMask): Float32Array {
  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  const land = mask.outline.land;
  const walls = mask.walls;
  const paint = mask.features[0]?.paint ?? [];
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

export function coverStats(mask: RuinedMask): { median: number; p90: number } {
  const dist = coverDistanceField(mask);
  const land = mask.outline.land;
  const walls = mask.walls;
  const vals: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || walls[i]) continue;
    const d = dist[i]!;
    if (d > 1e8) continue;
    vals.push(d);
  }
  vals.sort((a, b) => a - b);
  if (vals.length === 0) return { median: 99, p90: 99 };
  const median = vals[(vals.length / 2) | 0]!;
  const p90 = vals[Math.min(vals.length - 1, (vals.length * 0.9) | 0)]!;
  return { median, p90 };
}

function statsOf(land: Uint8Array, walls: Uint8Array, mask: RuinedMask): ProbeStats {
  const cover = coverStats({ ...mask, outline: { ...mask.outline, land }, walls });
  return {
    wallRatio: wallRatio(land, walls),
    maxYard: maxOpenYard(land, walls, mask.outline.cols, mask.outline.rows),
    medianCover: cover.median,
    p90Cover: cover.p90,
  };
}

function pickInYard(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  rng: SeededRandom,
  minWall: number,
  maxWall: number,
  reserved?: (col: number, row: number) => boolean,
): { col: number; row: number } | null {
  const yard = maxOpenYardRect(land, walls, cols, rows);
  const dist = nearestWallField(land, walls, cols, rows);
  const hits: Array<{ col: number; row: number }> = [];
  for (let row = yard.row; row < yard.row + yard.height - 3; row++) {
    for (let col = yard.col; col < yard.col + yard.width - 3; col++) {
      if (reserved && reserved(col, row)) continue;
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      const d = dist[at(cols, col, row)]!;
      if (d < minWall || d > maxWall) continue;
      hits.push({ col, row });
    }
  }
  if (hits.length === 0) return null;
  return hits[rng.nextInt(0, hits.length - 1)]!;
}

function farthestFloor(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  reserved?: (col: number, row: number) => boolean,
): { col: number; row: number; dist: number } | null {
  const dist = nearestWallField(land, walls, cols, rows);
  let best: { col: number; row: number; dist: number } | null = null;
  for (let row = 0; row < rows - 2; row++) {
    for (let col = 0; col < cols - 2; col++) {
      if (reserved && reserved(col, row)) continue;
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      const d = dist[at(cols, col, row)]!;
      if (!best || d > best.dist) best = { col, row, dist: d };
    }
  }
  return best;
}

function fillA(land: Uint8Array, walls: Uint8Array, cols: number, rows: number, rng: SeededRandom): void {
  for (let n = 0; n < 28; n++) {
    const ratio = wallRatio(land, walls);
    const yard = maxOpenYard(land, walls, cols, rows);
    if (ratio >= 0.16) break;
    if (yard <= 140 && ratio >= 0.1) break;
    if (yard <= 160 && n > 10 && ratio >= 0.09) break;
    const seed =
      pickInYard(land, walls, cols, rows, rng, 6, 14) ??
      pickInYard(land, walls, cols, rows, rng, 4, 20);
    if (!seed) break;
    const w = rng.nextInt(3, 4);
    const h = rng.nextInt(3, 4);
    if (!tryStamp(land, walls, cols, rows, rect(seed.col, seed.row, w, h))) continue;
  }
}

function fillB(land: Uint8Array, walls: Uint8Array, cols: number, rows: number, rng: SeededRandom): void {
  const plaza = maxOpenYardRect(land, walls, cols, rows);
  const pc = plaza.col + Math.max(0, ((plaza.width - 6) / 2) | 0);
  const pr = plaza.row + Math.max(0, ((plaza.height - 6) / 2) | 0);
  const skip = new Set<number>();
  const reserved = (col: number, row: number): boolean =>
    skip.has(at(cols, col, row)) || (col >= pc && col < pc + 6 && row >= pr && row < pr + 6);
  for (let n = 0; n < 40; n++) {
    if (wallRatio(land, walls) >= 0.16) break;
    const far = farthestFloor(land, walls, cols, rows, reserved);
    if (!far || far.dist <= 8) break;
    const w = rng.nextInt(3, 4);
    const h = rng.nextInt(3, 4);
    const ox = Math.max(0, far.col - 1);
    const oy = Math.max(0, far.row - 1);
    if (tryStamp(land, walls, cols, rows, rect(ox, oy, w, h))) continue;
    if (tryStamp(land, walls, cols, rows, rect(ox, oy, 3, 3))) continue;
    skip.add(at(cols, far.col, far.row));
  }
}

function fillC(land: Uint8Array, walls: Uint8Array, cols: number, rows: number, rng: SeededRandom): void {
  const yard = maxOpenYardRect(land, walls, cols, rows);
  if (yard.width >= 10 && yard.height >= 8) {
    const gap = 5;
    const thick = 2;
    const cells: Array<{ col: number; row: number }> = [];
    if (yard.width >= yard.height) {
      const row0 = yard.row + ((yard.height / 2) | 0);
      const run = Math.max(6, yard.width - gap);
      for (let k = 0; k < run; k++) {
        for (let t = 0; t < thick; t++) {
          cells.push({ col: yard.col + k, row: row0 + t });
        }
      }
    } else {
      const col0 = yard.col + ((yard.width / 2) | 0);
      const run = Math.max(6, yard.height - gap);
      for (let k = 0; k < run; k++) {
        for (let t = 0; t < thick; t++) {
          cells.push({ col: col0 + t, row: yard.row + k });
        }
      }
    }
    tryStamp(land, walls, cols, rows, cells);
  }
  for (let n = 0; n < 10; n++) {
    if (maxOpenYard(land, walls, cols, rows) <= 96) break;
    if (wallRatio(land, walls) >= 0.16) break;
    const seed = pickInYard(land, walls, cols, rows, rng, 4, 12);
    if (!seed) break;
    tryStamp(land, walls, cols, rows, rect(seed.col, seed.row, 3, 3));
  }
}

function wallComponents(walls: Uint8Array, land: Uint8Array, cols: number, rows: number): number[][] {
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

function fillE(land: Uint8Array, walls: Uint8Array, cols: number, rows: number, rng: SeededRandom): void {
  const comps = wallComponents(walls, land, cols, rows).filter((c) => c.length >= 6);
  for (const comp of comps) {
    const tips: Array<{ col: number; row: number; dx: number; dy: number; open: number }> = [];
    for (const i of comp) {
      const col = i % cols;
      const row = (i / cols) | 0;
      for (const [dx, dy] of DIRS4) {
        let open = 0;
        for (let k = 1; k <= 5; k++) {
          if (!isFloor(land, walls, cols, rows, col + dx * k, row + dy * k)) break;
          open++;
        }
        if (open >= 4) tips.push({ col, row, dx, dy, open });
      }
    }
    tips.sort((a, b) => b.open - a.open);
    let placed = 0;
    for (const tip of tips) {
      if (placed >= 3) break;
      const cells: Array<{ col: number; row: number }> = [];
      const px = -tip.dy;
      const py = tip.dx;
      for (let k = 1; k <= 4; k++) {
        const col = tip.col + tip.dx * k;
        const row = tip.row + tip.dy * k;
        cells.push({ col, row });
        cells.push({ col: col + px, row: row + py });
      }
      if (tryStamp(land, walls, cols, rows, cells)) placed++;
    }
    if (placed === 0 && tips[0]) {
      const t = tips[rng.nextInt(0, Math.min(3, tips.length - 1))]!;
      tryStamp(land, walls, cols, rows, rect(t.col + t.dx, t.row + t.dy, 3, 3));
    }
  }
}

export function applyProbe(
  mask: RuinedMask,
  scheme: ProbeScheme,
  rng: SeededRandom,
): { mask: RuinedMask; stats: ProbeStats } {
  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  const land = new Uint8Array(mask.outline.land);
  const walls = new Uint8Array(mask.walls);
  if (scheme === 'A') fillA(land, walls, cols, rows, rng);
  if (scheme === 'B') fillB(land, walls, cols, rows, rng);
  if (scheme === 'C') fillC(land, walls, cols, rows, rng);
  if (scheme === 'E') fillE(land, walls, cols, rows, rng);
  openSealedFloors(land, walls, cols, rows);
  const next: RuinedMask = {
    ...mask,
    outline: { ...mask.outline, land },
    walls,
    metrics: {
      ...mask.metrics,
      wallCount: walls.reduce((n, v) => n + v, 0),
      wallRatio: wallRatio(land, walls),
      leftoverConnected: mask.metrics.leftoverConnected,
    },
  };
  return { mask: next, stats: statsOf(land, walls, next) };
}

export function tintTiles(
  rgba: Uint8Array,
  width: number,
  height: number,
  tile: number,
  cols: number,
  rows: number,
  land: Uint8Array,
  walls: Uint8Array,
  colorAt: (col: number, row: number) => readonly [number, number, number, number] | null,
): void {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i] || walls[i]) continue;
      const tint = colorAt(col, row);
      if (!tint) continue;
      const [tr, tg, tb, ta] = tint;
      for (let y = 0; y < tile; y++) {
        for (let x = 0; x < tile; x++) {
          const px = (row * tile + y) * width + (col * tile + x);
          if (px < 0 || px >= width * height) continue;
          const o = px * 4;
          rgba[o] = (rgba[o]! * (1 - ta) + tr * ta) | 0;
          rgba[o + 1] = (rgba[o + 1]! * (1 - ta) + tg * ta) | 0;
          rgba[o + 2] = (rgba[o + 2]! * (1 - ta) + tb * ta) | 0;
        }
      }
    }
  }
}
