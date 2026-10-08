/**
 * Shared walk skeleton: many small porous masses that cut leftover yards.
 * Identity (what world this was torn from) stays on the fragment row.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import type { RiftFragmentDef } from '@/generated/rift-fragment-data';
import type { RuinCell, RuinFeature, RuinPaintCell } from '@/generation/types';
import { SeededRandom } from '@/utils/random';

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function unique(raw: readonly RuinCell[]): RuinCell[] {
  const out: RuinCell[] = [];
  const seen = new Set<string>();
  for (const cell of raw) {
    const key = `${cell.col},${cell.row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}

function clip(
  raw: readonly RuinCell[],
  land: Uint8Array,
  cols: number,
  rows: number,
): RuinCell[] {
  const out: RuinCell[] = [];
  const seen = new Set<number>();
  for (const cell of raw) {
    if (!inBounds(cols, rows, cell.col, cell.row)) continue;
    const i = at(cols, cell.col, cell.row);
    if (!land[i] || seen.has(i)) continue;
    seen.add(i);
    out.push(cell);
  }
  return out;
}

function landBBox(land: Uint8Array, cols: number, rows: number) {
  let minC = cols;
  let minR = rows;
  let maxC = 0;
  let maxR = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at(cols, col, row)]) continue;
      if (col < minC) minC = col;
      if (row < minR) minR = row;
      if (col > maxC) maxC = col;
      if (row > maxR) maxR = row;
    }
  }
  return { minC, minR, maxC, maxR, width: maxC - minC + 1, height: maxR - minR + 1 };
}

/** 0 = open east, 1 = open west, 2 = open south, 3 = open north. */
type Facing = 0 | 1 | 2 | 3;

export type MassGapPlacement = 'center' | 'mid' | 'end' | 'random';
export type MassCap = 'none' | 'stub' | 'pier' | 'widen';
export type MassCorner = 'right' | 'fold';
export type MassFacingPolicy = 'random' | 'axis' | 'alternate';

/** Shared grammar vector. Three old presets stay byte-identical; cluster is one more point. */
export type MassGrammarVec = {
  readonly turns: 0 | 1 | 2;
  readonly jogPeriod: 0 | 2 | 3 | 4 | 6;
  readonly jogAmp: 0 | 1 | 2;
  readonly gaps: 0 | 1 | 2 | 3;
  readonly gapPlacement?: MassGapPlacement;
  readonly cap: MassCap;
  readonly corner?: MassCorner;
  readonly facingPolicy?: MassFacingPolicy;
};

export const MASS_GRAMMAR_PRESETS = {
  ridge: { turns: 0, jogPeriod: 4, jogAmp: 1, gaps: 0, cap: 'stub' },
  slab: { turns: 0, jogPeriod: 0, jogAmp: 0, gaps: 1, gapPlacement: 'center', cap: 'pier' },
  enclosure: { turns: 1, jogPeriod: 0, jogAmp: 0, gaps: 1, gapPlacement: 'mid', cap: 'none' },
  cluster: { turns: 0, jogPeriod: 0, jogAmp: 0, gaps: 3, gapPlacement: 'random', cap: 'none' },
} as const satisfies Record<'ridge' | 'slab' | 'enclosure' | 'cluster', MassGrammarVec>;

export function resolveMassGrammar(grammar: string): MassGrammarVec {
  if (grammar === 'ridge') return MASS_GRAMMAR_PRESETS.ridge;
  if (grammar === 'slab') return MASS_GRAMMAR_PRESETS.slab;
  if (grammar === 'enclosure') return MASS_GRAMMAR_PRESETS.enclosure;
  if (grammar === 'cluster') return MASS_GRAMMAR_PRESETS.cluster;
  throw new Error(`unknown mass grammar: ${grammar}`);
}

export function massGrammarVecEqual(a: MassGrammarVec, b: MassGrammarVec): boolean {
  return (
    a.turns === b.turns &&
    a.jogPeriod === b.jogPeriod &&
    a.jogAmp === b.jogAmp &&
    a.gaps === b.gaps &&
    a.gapPlacement === b.gapPlacement &&
    a.cap === b.cap &&
    a.corner === b.corner &&
    a.facingPolicy === b.facingPolicy
  );
}

function shaftSkips(vec: MassGrammarVec, longLen: number, rng: SeededRandom): ReadonlySet<number> {
  const skips = new Set<number>();
  if (vec.gaps <= 0 || vec.gapPlacement === 'mid') return skips;
  const n = vec.gaps;
  if (vec.gapPlacement === 'random') {
    const pool: number[] = [];
    for (let i = 0; i < longLen; i++) pool.push(i);
    for (let k = 0; k < n && pool.length > 0; k++) {
      const idx = rng.nextInt(0, pool.length - 1);
      skips.add(pool.splice(idx, 1)[0]!);
    }
    return skips;
  }
  if (vec.gapPlacement === 'end') {
    if (n >= 1) skips.add(longLen - 1);
    if (n >= 2) skips.add(0);
    if (n >= 3) skips.add(Math.max(0, longLen - 2));
    return skips;
  }
  const mid = (longLen / 2) | 0;
  if (n === 1) {
    skips.add(mid);
    return skips;
  }
  const start = Math.max(0, mid - ((n / 2) | 0));
  for (let k = 0; k < n && start + k < longLen; k++) skips.add(start + k);
  return skips;
}

function pickFacing(
  vec: MassGrammarVec,
  rng: SeededRandom,
  massIndex: number,
  island: { width: number; height: number },
): Facing {
  const policy = vec.facingPolicy ?? 'random';
  if (policy === 'axis') {
    const vertical = island.height >= island.width;
    return (vertical ? rng.nextInt(0, 1) : rng.nextInt(2, 3)) as Facing;
  }
  if (policy === 'alternate') {
    const vertical = massIndex % 2 === 0;
    return (vertical ? rng.nextInt(0, 1) : rng.nextInt(2, 3)) as Facing;
  }
  return rng.nextInt(0, 3) as Facing;
}

function biteGap(cells: RuinCell[], facing: Facing, gapAt: number, gap = 2): RuinCell[] {
  const drop = new Set<string>();
  const long = cells.filter((c) => {
    if (facing === 0 || facing === 1) return cells.some((o) => o.col === c.col && o.row !== c.row);
    return cells.some((o) => o.row === c.row && o.col !== c.col);
  });
  const start = Math.max(1, Math.min(gapAt, Math.max(1, long.length - gap - 1)));
  for (let n = 0; n < gap && start + n < long.length; n++) {
    const cell = long[start + n];
    if (cell) drop.add(`${cell.col},${cell.row}`);
  }
  return cells.filter((cell) => !drop.has(`${cell.col},${cell.row}`));
}

function massCells(
  vec: MassGrammarVec,
  ox: number,
  oy: number,
  facing: Facing,
  longLen: number,
  width: number,
  shortLen: number,
  skip: ReadonlySet<number>,
): RuinCell[] {
  const vertical = facing === 0 || facing === 1;
  const shaftWidth = vec.turns >= 1 ? 1 : width;
  const cells: RuinCell[] = [];
  for (let i = 0; i < longLen; i++) {
    if (skip.has(i)) continue;
    const shift =
      vec.jogPeriod > 0 && vec.jogAmp > 0 && ((i / vec.jogPeriod) | 0) % 2 === 1 ? vec.jogAmp : 0;
    for (let w = 0; w < shaftWidth; w++) {
      if (vertical) cells.push({ col: ox + shift + w, row: oy + i });
      else cells.push({ col: ox + i, row: oy + shift + w });
    }
  }
  if (vec.turns >= 1) {
    if (facing === 0) {
      for (let j = 1; j < shortLen; j++) cells.push({ col: ox + j, row: oy });
    } else if (facing === 1) {
      for (let j = 1; j < shortLen; j++) cells.push({ col: ox - j, row: oy });
    } else if (facing === 2) {
      for (let j = 1; j < shortLen; j++) cells.push({ col: ox, row: oy + j });
    } else {
      for (let j = 1; j < shortLen; j++) cells.push({ col: ox, row: oy - j });
    }
  }
  if (vec.turns >= 2) {
    const fold = vec.corner === 'fold';
    const end = longLen - 1;
    if (fold) {
      if (facing === 0) {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox + 1, row: oy + end - j });
      } else if (facing === 1) {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox - 1, row: oy + end - j });
      } else if (facing === 2) {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox + end - j, row: oy + 1 });
      } else {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox + end - j, row: oy - 1 });
      }
    } else {
      if (facing === 0) {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox - j, row: oy + end });
      } else if (facing === 1) {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox + j, row: oy + end });
      } else if (facing === 2) {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox + end, row: oy - j });
      } else {
        for (let j = 1; j < shortLen; j++) cells.push({ col: ox + end, row: oy + j });
      }
    }
  }
  if (vec.cap === 'stub') {
    const stub = 2;
    if (facing === 0) {
      for (let j = 1; j < stub; j++) cells.push({ col: ox + width + j - 1, row: oy });
    } else if (facing === 1) {
      for (let j = 1; j < stub; j++) cells.push({ col: ox - j, row: oy });
    } else if (facing === 2) {
      for (let j = 1; j < stub; j++) cells.push({ col: ox, row: oy + width + j - 1 });
    } else {
      for (let j = 1; j < stub; j++) cells.push({ col: ox, row: oy - j });
    }
  } else if (vec.cap === 'pier') {
    if (facing === 0) {
      cells.push({ col: ox + width, row: oy }, { col: ox + width + 1, row: oy });
      cells.push({ col: ox + width, row: oy + 1 }, { col: ox + width + 1, row: oy + 1 });
    } else if (facing === 1) {
      cells.push({ col: ox - 1, row: oy }, { col: ox - 2, row: oy });
      cells.push({ col: ox - 1, row: oy + 1 }, { col: ox - 2, row: oy + 1 });
    } else if (facing === 2) {
      cells.push({ col: ox, row: oy + width }, { col: ox + 1, row: oy + width });
      cells.push({ col: ox, row: oy + width + 1 }, { col: ox + 1, row: oy + width + 1 });
    } else {
      cells.push({ col: ox, row: oy - 1 }, { col: ox + 1, row: oy - 1 });
      cells.push({ col: ox, row: oy - 2 }, { col: ox + 1, row: oy - 2 });
    }
  } else if (vec.cap === 'widen') {
    const extra = 1;
    if (facing === 0) {
      for (let w = 0; w < width + extra; w++) cells.push({ col: ox + w, row: oy + longLen - 1 });
    } else if (facing === 1) {
      for (let w = 0; w < width + extra; w++) cells.push({ col: ox - extra + w, row: oy + longLen - 1 });
    } else if (facing === 2) {
      for (let w = 0; w < width + extra; w++) cells.push({ col: ox + longLen - 1, row: oy + w });
    } else {
      for (let w = 0; w < width + extra; w++) cells.push({ col: ox + longLen - 1, row: oy - extra + w });
    }
  }
  return unique(cells);
}

function interiorPaint(
  walls: readonly RuinCell[],
  land: Uint8Array,
  cols: number,
  rows: number,
): RuinPaintCell[] {
  if (walls.length === 0) return [];
  let minC = walls[0]!.col;
  let maxC = minC;
  let minR = walls[0]!.row;
  let maxR = minR;
  const wallSet = new Set<string>();
  for (const cell of walls) {
    wallSet.add(`${cell.col},${cell.row}`);
    if (cell.col < minC) minC = cell.col;
    if (cell.col > maxC) maxC = cell.col;
    if (cell.row < minR) minR = cell.row;
    if (cell.row > maxR) maxR = cell.row;
  }
  const pad = 1;
  minC -= pad;
  minR -= pad;
  maxC += pad;
  maxR += pad;
  const paint: RuinPaintCell[] = [];
  for (let row = minR; row <= maxR; row++) {
    for (let col = minC; col <= maxC; col++) {
      if (!inBounds(cols, rows, col, row)) continue;
      if (!land[at(cols, col, row)]) continue;
      if (wallSet.has(`${col},${row}`)) continue;
      let touch = false;
      for (const [dx, dy] of DIRS4) {
        if (wallSet.has(`${col + dx},${row + dy}`)) touch = true;
      }
      if (touch) paint.push({ col, row, role: 'interior' });
    }
  }
  return paint;
}

function buildMass(
  grammar: RiftFragmentDef['massGrammar'],
  ox: number,
  oy: number,
  facing: Facing,
  def: RiftFragmentDef,
  rng: SeededRandom,
  longLen: number,
): RuinCell[] {
  const width = Math.max(1, def.featureWidthTiles || 1);
  const shortLen = rng.nextInt(3, 4);
  const vec = resolveMassGrammar(grammar);
  const skip = shaftSkips(vec, longLen, rng);
  const cells = massCells(vec, ox, oy, facing, longLen, width, shortLen, skip);
  if (vec.gaps > 0 && vec.gapPlacement === 'mid') {
    let out = cells;
    for (let g = 0; g < vec.gaps; g++) {
      out = biteGap(out, facing, rng.nextInt(1, 3), 2);
    }
    return out;
  }
  return cells;
}

function axisSpan(cells: readonly RuinCell[]): number {
  if (cells.length === 0) return 0;
  let minC = cells[0]!.col;
  let maxC = minC;
  let minR = cells[0]!.row;
  let maxR = minR;
  for (const cell of cells) {
    if (cell.col < minC) minC = cell.col;
    if (cell.col > maxC) maxC = cell.col;
    if (cell.row < minR) minR = cell.row;
    if (cell.row > maxR) maxR = cell.row;
  }
  return Math.max(maxC - minC + 1, maxR - minR + 1);
}

function overlap(a: readonly RuinCell[], b: readonly RuinCell[]): number {
  const set = new Set(a.map((c) => `${c.col},${c.row}`));
  let n = 0;
  for (const cell of b) if (set.has(`${cell.col},${cell.row}`)) n++;
  return n;
}

export type OpenYard = {
  col: number;
  row: number;
  width: number;
  height: number;
  area: number;
};

export function maxOpenYardRect(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): OpenYard {
  const hist = new Array<number>(cols).fill(0);
  let best: OpenYard = { col: 0, row: 0, width: 0, height: 0, area: 0 };
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      hist[col] = land[i] && !walls[i] ? hist[col]! + 1 : 0;
    }
    const stack: number[] = [];
    for (let col = 0; col <= cols; col++) {
      const h = col < cols ? hist[col]! : 0;
      while (stack.length > 0 && hist[stack[stack.length - 1]!]! > h) {
        const hh = hist[stack.pop()!]!;
        const left = stack.length > 0 ? stack[stack.length - 1]! + 1 : 0;
        const width = col - left;
        const area = hh * width;
        if (area > best.area) {
          best = { col: left, row: row - hh + 1, width, height: hh, area };
        }
      }
      if (col < cols) stack.push(col);
    }
  }
  return best;
}

export function maxOpenYard(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  return maxOpenYardRect(land, walls, cols, rows).area;
}

function stampAll(placed: readonly RuinCell[][], cols: number, rows: number): Uint8Array {
  const walls = new Uint8Array(cols * rows);
  for (const cells of placed) {
    for (const cell of cells) walls[at(cols, cell.col, cell.row)] = 1;
  }
  return walls;
}

function floorSplit(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): boolean {
  const total = cols * rows;
  const seen = new Uint8Array(total);
  let started = false;
  const stack: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!land[i] || walls[i]) continue;
    if (!started) {
      started = true;
      seen[i] = 1;
      stack.push(i);
      while (stack.length > 0) {
        const cur = stack.pop()!;
        const col = cur % cols;
        const row = (cur / cols) | 0;
        for (const [dx, dy] of DIRS4) {
          const nx = col + dx;
          const ny = row + dy;
          if (!inBounds(cols, rows, nx, ny)) continue;
          const ni = at(cols, nx, ny);
          if (seen[ni] || !land[ni] || walls[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      continue;
    }
    if (!seen[i]) return true;
  }
  return false;
}

function acceptMass(
  cells: RuinCell[],
  land: Uint8Array,
  existing: readonly RuinCell[][],
  cols: number,
  rows: number,
): boolean {
  if (cells.length < 6 || axisSpan(cells) < 4) return false;
  if (existing.some((prev) => overlap(prev, cells) > 1)) return false;
  const walls = stampAll([...existing, cells], cols, rows);
  return !floorSplit(land, walls, cols, rows);
}

function tryPlaceAt(
  ox: number,
  oy: number,
  grammar: RiftFragmentDef['massGrammar'],
  def: RiftFragmentDef,
  land: Uint8Array,
  existing: readonly RuinCell[][],
  cols: number,
  rows: number,
  rng: SeededRandom,
  massIndex: number,
  island: { width: number; height: number },
): RuinCell[] | null {
  const longLen = Math.max(5, Math.min(6, def.featureLengthTiles || 6));
  const vec = resolveMassGrammar(grammar);
  for (let attempt = 0; attempt < 6; attempt++) {
    const facing = pickFacing(vec, rng, massIndex, island);
    const cells = clip(
      buildMass(grammar, ox + rng.nextInt(-1, 1), oy + rng.nextInt(-1, 1), facing, def, rng, longLen),
      land,
      cols,
      rows,
    );
    if (acceptMass(cells, land, existing, cols, rows)) return cells;
  }
  return null;
}

function tryCutYard(
  yard: OpenYard,
  grammar: RiftFragmentDef['massGrammar'],
  def: RiftFragmentDef,
  land: Uint8Array,
  existing: readonly RuinCell[][],
  cols: number,
  rows: number,
  rng: SeededRandom,
): RuinCell[] | null {
  if (yard.area < 16 || yard.width < 4 || yard.height < 4) return null;
  const cutVertical = yard.width >= yard.height;
  const span = cutVertical ? yard.height : yard.width;
  const longLen = Math.max(5, Math.min(6, span - 2, def.featureLengthTiles || 6));
  for (let attempt = 0; attempt < 8; attempt++) {
    const facing = (cutVertical ? rng.nextInt(0, 1) : rng.nextInt(2, 3)) as Facing;
    const ox = cutVertical
      ? yard.col + ((yard.width / 2) | 0) + rng.nextInt(-1, 1)
      : yard.col + 1 + rng.nextInt(0, Math.max(0, yard.width - longLen - 1));
    const oy = cutVertical
      ? yard.row + 1 + rng.nextInt(0, Math.max(0, yard.height - longLen - 1))
      : yard.row + ((yard.height / 2) | 0) + rng.nextInt(-1, 1);
    const cells = clip(buildMass(grammar, ox, oy, facing, def, rng, longLen), land, cols, rows);
    if (acceptMass(cells, land, existing, cols, rows)) return cells;
  }
  return null;
}

function evenPick<T>(items: readonly T[], n: number): T[] {
  if (n >= items.length) return items.slice();
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(items[Math.floor((i * items.length) / n)]!);
  }
  return out;
}

function packSites(
  box: { minC: number; minR: number; maxC: number; maxR: number },
  rng: SeededRandom,
): RuinCell[] {
  const step = 5;
  const sites: RuinCell[] = [];
  const row0 = box.minR + rng.nextInt(2, 4);
  const col0 = box.minC + rng.nextInt(2, 4);
  let rowIndex = 0;
  for (let row = row0; row <= box.maxR - 3; row += step + rng.nextInt(-1, 1)) {
    const stagger = rowIndex % 2 === 1 ? (step >> 1) : 0;
    rowIndex++;
    for (let col = col0 + stagger; col <= box.maxC - 3; col += step + rng.nextInt(-1, 1)) {
      sites.push({ col, row });
    }
  }
  return sites;
}

export function placeMasses(
  def: RiftFragmentDef,
  land: Uint8Array,
  cols: number,
  rows: number,
  rng: SeededRandom,
): RuinFeature[] | null {
  const box = landBBox(land, cols, rows);
  if (box.width < 16 || box.height < 14) return null;
  const grammar = def.massGrammar;
  resolveMassGrammar(grammar);
  if (
    grammar !== 'ridge' &&
    grammar !== 'slab' &&
    grammar !== 'enclosure' &&
    grammar !== 'cluster'
  ) {
    throw new Error(`unknown mass grammar: ${grammar}`);
  }
  const kind = grammar;
  const yardMax = GAME_CONSTANTS.GENERATION.YARD_AREA_MAX;
  const min = def.featureCountMin;
  const cap = def.featureCountMax;
  let landCount = 0;
  for (let i = 0; i < land.length; i++) if (land[i]) landCount++;
  const wallBudget = Math.max(min * 6, Math.floor(landCount * 0.2));

  for (let attempt = 0; attempt < 40; attempt++) {
    const masses: RuinCell[][] = [];
    let used = 0;
    const allSites = packSites(box, rng).filter((site) => land[at(cols, site.col, site.row)]);
    // Old: min(max(min, cap-4), …) collapsed to min when cap-4 ≤ min.
    // min+1 keeps one extra site on tight ranges; for 12–24 this still equals cap-4.
    const gridWant = Math.min(cap, Math.max(min + 1, cap - 4), Math.max(min, (wallBudget / 8) | 0));
    const sites = evenPick(allSites, gridWant);
    for (const site of sites) {
      if (masses.length >= cap || used >= wallBudget) break;
      const walls = stampAll(masses, cols, rows);
      if (masses.length >= min && maxOpenYard(land, walls, cols, rows) <= yardMax) break;
      if (!land[at(cols, site.col, site.row)]) continue;
      const cells = tryPlaceAt(
        site.col,
        site.row,
        grammar,
        def,
        land,
        masses,
        cols,
        rows,
        rng,
        masses.length,
        box,
      );
      if (!cells || used + cells.length > wallBudget) continue;
      masses.push(cells);
      used += cells.length;
    }
    while (masses.length < cap && used < wallBudget) {
      const walls = stampAll(masses, cols, rows);
      const yard = maxOpenYardRect(land, walls, cols, rows);
      if (masses.length >= min && yard.area <= yardMax) break;
      const cells = tryCutYard(yard, grammar, def, land, masses, cols, rows, rng);
      if (!cells || used + cells.length > wallBudget) break;
      masses.push(cells);
      used += cells.length;
    }
    if (masses.length < min) continue;
    const walls = stampAll(masses, cols, rows);
    if (maxOpenYard(land, walls, cols, rows) > yardMax) continue;
    if (floorSplit(land, walls, cols, rows)) continue;

    return masses.map((cells) => ({
      kind,
      cells,
      paint: interiorPaint(cells, land, cols, rows),
      alignY: box.height >= box.width,
    }));
  }
  return null;
}
