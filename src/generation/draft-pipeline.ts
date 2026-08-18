/**
 * Preview-only recipe drafts. Same island, different recipes.
 * Does not replace masses.ts. Does not wire RiftScene.
 */

import {
  assertSingleWalkable,
  countWalkableComponents,
  leftoverDisconnectedCount,
  openSealedFloors,
} from '@/generation/connectivity';
import { buildAtmosphere } from '@/generation/atmosphere';
import { applyCover, countBoles, stumpTouchesStone } from '@/generation/cover';
import { generateOutline } from '@/generation/outline-mask';
import type { MapRecipe } from '@/generation/recipes';
import { forkMapRngs } from '@/generation/seed-fork';
import { measureSilhouette, silhouetteFails } from '@/generation/silhouette';
import { buildStructure } from '@/generation/structure-grammars';
import type { RuinPaintCell, RuinPaintRole, RuinedMask } from '@/generation/types';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import { SeededRandom } from '@/utils/random';

const MAX_STRUCTURE_ATTEMPTS = 24;

const ROLE_RANK: Record<RuinPaintRole, number> = {
  glitch: 5,
  stump: 4,
  root: 4,
  wreck: 4,
  organic: 3,
  vegetation: 3,
  debris: 2,
  interior: 1,
};

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

function mergePaint(into: RuinPaintCell[], extra: readonly RuinPaintCell[], cols: number, rows: number): void {
  const best = new Map<number, RuinPaintCell>();
  for (const cell of into.concat(extra)) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) continue;
    const i = at(cols, cell.col, cell.row);
    const prev = best.get(i);
    if (!prev || ROLE_RANK[cell.role] >= ROLE_RANK[prev.role]) best.set(i, cell);
  }
  into.length = 0;
  for (const cell of best.values()) into.push(cell);
}

function floorCells(land: Uint8Array, walls: Uint8Array, cols: number, rows: number) {
  const out: Array<{ col: number; row: number; i: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (land[i] && !walls[i]) out.push({ col, row, i });
    }
  }
  return out;
}

function nearWall(
  walls: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): boolean {
  for (const [dx, dy] of DIRS4) {
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds(cols, rows, nx, ny)) continue;
    if (walls[at(cols, nx, ny)]) return true;
  }
  return false;
}

function nearStump(stumps: ReadonlySet<string>, col: number, row: number): boolean {
  for (const [dx, dy] of DIRS4) {
    if (stumps.has(`${col + dx},${row + dy}`)) return true;
  }
  return stumps.has(`${col},${row}`);
}

function nearVoid(land: Uint8Array, cols: number, rows: number, col: number, row: number): boolean {
  for (const [dx, dy] of DIRS4) {
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds(cols, rows, nx, ny) || !land[at(cols, nx, ny)]) return true;
  }
  return false;
}

function scatterPaint(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  recipe: MapRecipe,
  rng: SeededRandom,
  stumps: ReadonlySet<string>,
): RuinPaintCell[] {
  const paint: RuinPaintCell[] = [];
  const floors = floorCells(land, walls, cols, rows);
  const kind = recipe.scatter.kind;

  for (const cell of floors) {
    const rim = nearVoid(land, cols, rows, cell.col, cell.row);
    const wall = nearWall(walls, cols, rows, cell.col, cell.row);
    const byStump = nearStump(stumps, cell.col, cell.row);
    let vegChance = recipe.scatter.vegetation;
    if (kind === 'none') vegChance = 0;
    if (kind === 'rimMoss') vegChance = rim ? recipe.scatter.vegetation : recipe.scatter.vegetation * 0.15;
    if (kind === 'thicket') vegChance = wall ? recipe.scatter.vegetation * 1.6 : recipe.scatter.vegetation * 0.35;
    if (kind === 'aisleLitter') vegChance = wall ? recipe.scatter.vegetation : 0;
    if (kind === 'grassPads') vegChance = wall ? recipe.scatter.vegetation * 0.4 : recipe.scatter.vegetation;
    if (byStump) vegChance *= 0.08;
    if (vegChance > 0 && rng.next() < vegChance) {
      paint.push({ col: cell.col, row: cell.row, role: 'vegetation' });
    }
    let wreckChance = recipe.scatter.wreck;
    if (kind === 'aisleLitter') wreckChance = wall ? recipe.scatter.wreck * 1.4 : recipe.scatter.wreck;
    if (kind === 'grassPads') wreckChance = wall ? 0 : recipe.scatter.wreck;
    if (wreckChance > 0 && rng.next() < wreckChance) {
      paint.push({ col: cell.col, row: cell.row, role: 'wreck' });
    }
  }

  const glitchWant = recipe.scatter.glitch;
  const candidates = floors.filter((c) => nearWall(walls, cols, rows, c.col, c.row));
  const pool = candidates.length > 0 ? candidates : floors;
  const used = new Set<number>();
  let guard = 0;
  while (used.size < glitchWant && guard++ < 80 && pool.length > 0) {
    const cell = pool[rng.nextInt(0, pool.length - 1)]!;
    if (used.has(cell.i)) continue;
    used.add(cell.i);
    paint.push({ col: cell.col, row: cell.row, role: 'glitch' });
  }
  return paint;
}

function toTileMap(land: Uint8Array, walls: Uint8Array, cols: number, rows: number, tileSize: number): TileMapData {
  const tiles: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: number[] = [];
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i]) line.push(TileType.VOID);
      else if (walls[i]) line.push(TileType.WALL);
      else line.push(TileType.FLOOR);
    }
    tiles.push(line);
  }
  return { cols, rows, tileSize, tiles };
}

export function generateRecipeDraft(seed: number, recipe: MapRecipe): RuinedMask {
  const base = generateOutline(seed);
  const cols = base.cols;
  const rows = base.rows;
  const land = new Uint8Array(base.land);
  const { scatterRng, atmosphereRng } = forkMapRngs(seed, recipe.id);
  let walls = new Uint8Array(land.length);
  let structurePaint: RuinPaintCell[] = [];
  let attempt = 0;
  let ok = false;
  let lastWhy = 'no attempt';

  for (; attempt < MAX_STRUCTURE_ATTEMPTS; attempt++) {
    land.set(base.land);
    const forked = forkMapRngs(seed, recipe.id, attempt);
    const built = buildStructure({ ...base, land }, forked.structureRng, recipe.structure);
    walls = new Uint8Array(built.walls);
    structurePaint = built.paint;
    openSealedFloors(land, walls, cols, rows);
    if (countWalkableComponents(land, walls, cols, rows) !== 1) {
      lastWhy = 'structure walkable != 1';
      continue;
    }
    const coverPaint = applyCover(land, walls, cols, rows, recipe.cover, forked.coverRng);
    for (let i = 0; i < walls.length; i++) if (!land[i]) walls[i] = 0;
    const keepWood = new Uint8Array(walls.length);
    for (const cell of coverPaint) {
      if (cell.role !== 'stump' && cell.role !== 'root') continue;
      keepWood[at(cols, cell.col, cell.row)] = 1;
    }
    openSealedFloors(land, walls, cols, rows, keepWood);
    if (countWalkableComponents(land, walls, cols, rows) !== 1) {
      lastWhy = 'cover walkable != 1';
      continue;
    }
    if (stumpTouchesStone(walls, cols, rows, coverPaint)) {
      lastWhy = 'stump touches stone';
      continue;
    }
    if (recipe.cover.trees >= 1 && countBoles(coverPaint, walls, cols) < 1) {
      lastWhy = 'missing bole';
      continue;
    }
    const sil = measureSilhouette(land, walls, cols, rows, structurePaint.concat(coverPaint));
    const silFail = silhouetteFails(sil);
    if (silFail) {
      lastWhy = silFail;
      continue;
    }
    structurePaint = structurePaint.concat(coverPaint);
    ok = true;
    break;
  }

  const label = `generateRecipeDraft ${recipe.id} seed ${seed}`;
  if (!ok) {
    throw new Error(`${label}: no connected structure after ${MAX_STRUCTURE_ATTEMPTS} attempts (${lastWhy})`);
  }
  assertSingleWalkable(land, walls, cols, rows, label);

  const paint = structurePaint.filter((c) => {
    const i = at(cols, c.col, c.row);
    if (!land[i]) return false;
    if (walls[i]) return c.role === 'stump' || c.role === 'root';
    return true;
  });
  mergePaint(
    paint,
    scatterPaint(
      land,
      walls,
      cols,
      rows,
      recipe,
      scatterRng,
      new Set(
        paint.filter((c) => c.role === 'stump' || c.role === 'root').map((c) => `${c.col},${c.row}`),
      ),
    ),
    cols,
    rows,
  );
  const glitches = paint.filter((c) => c.role === 'glitch');
  const atmosphere = buildAtmosphere(
    land,
    walls,
    cols,
    rows,
    recipe.atmosphere,
    glitches,
    atmosphereRng,
  );

  let wallCount = 0;
  let landCount = 0;
  for (let i = 0; i < land.length; i++) {
    if (land[i]) landCount++;
    if (walls[i]) wallCount++;
  }

  const tileMap = toTileMap(land, walls, cols, rows, base.tileSize);
  return {
    seed,
    attempt,
    fragmentTypeId: recipe.fragmentTypeId,
    outline: { ...base, land, tileMap },
    walls,
    features: [{ kind: 'ridge', cells: [], paint }],
    tileMap,
    metrics: {
      wallCount,
      wallRatio: landCount === 0 ? 0 : wallCount / landCount,
      featureCount: 1,
      leftoverConnected: leftoverDisconnectedCount(land, walls, cols, rows) === 0,
    },
    overlays: atmosphere.motes,
    atmosphere,
  };
}
