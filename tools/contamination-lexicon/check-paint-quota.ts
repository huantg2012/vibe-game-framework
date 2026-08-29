/**
 * Machine gate for I8-Q paint-host quota and greedy kindling-path pins.
 *
 *   npm run check:paint-quota
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAINT_HOST_COUNT_RANGE,
  identityKey,
  rollPaintHostCount,
} from '../../src/generation/contamination-draw.ts';
import {
  PAINT_PINS_SHORT,
  chebyshevCells,
  paintHostSpacingLadder,
  placePaintFloorPins,
} from '../../src/generation/contamination-pins.ts';
import { generateRiftLayout } from '../../src/generation/rift-layout.ts';
import type { ContaminationAge } from '../../src/generation/types.ts';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import { TileType } from '../../src/types/game-types.ts';
import type { TileMapData } from '../../src/types/map-types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TILE = GAME_CONSTANTS.TILE_SIZE;
const AGES: readonly ContaminationAge[] = ['new', 'standard', 'ancient'];
const ROLL_SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946];
const LAYOUT_SEEDS = [3, 11, 29, 47];

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed++;
  console.error(`FAIL ${msg}`);
}

function tileOf(pos: { x: number; y: number }): { col: number; row: number } {
  return { col: Math.floor(pos.x / TILE), row: Math.floor(pos.y / TILE) };
}

function corridorMap(): TileMapData {
  const cols = 12;
  const rows = 5;
  const tiles: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: number[] = [];
    for (let col = 0; col < cols; col++) {
      const floor = row === 2 && col >= 1 && col <= 10;
      line.push(floor ? TileType.FLOOR : TileType.WALL);
    }
    tiles.push(line);
  }
  return { cols, rows, tileSize: TILE, tiles };
}

const pinSrc = readFileSync(resolve(ROOT, 'src/generation/contamination-pins.ts'), 'utf8');
const drawSrc = readFileSync(resolve(ROOT, 'src/generation/contamination-draw.ts'), 'utf8');
const layoutSrc = readFileSync(resolve(ROOT, 'src/generation/rift-layout.ts'), 'utf8');
assert(!pinSrc.includes('bing-host-seat'), 'temporary bing-host-seat must be gone');
assert(!drawSrc.includes('hasClusters'), 'drawSortie must not read hasClusters');
assert(!layoutSrc.includes('hasClusters'), 'layout must not pass hasClusters');
assert(drawSrc.includes("'paint-count'"), 'quota seed is paint-count');
assert(layoutSrc.includes("typeof contaminationPins === 'string'"), 'pin shortage retries the island');
assert(JSON.stringify(paintHostSpacingLadder(8)) === JSON.stringify([6, 4, 3]), 'N<9 spacing starts at 6');
assert(JSON.stringify(paintHostSpacingLadder(9)) === JSON.stringify([5, 4, 3]), 'N≥9 spacing starts at 5');

const rollHist: Record<ContaminationAge, number[]> = { new: [], standard: [], ancient: [] };
for (const seed of ROLL_SEEDS) {
  for (const age of AGES) {
    const n = rollPaintHostCount(seed, age);
    const [lo, hi] = PAINT_HOST_COUNT_RANGE[age];
    assert(Number.isInteger(n), `${age}/${seed} paint count not integer`);
    assert(n >= lo && n <= hi, `${age}/${seed} paint count ${n} outside ${lo}–${hi}`);
    rollHist[age].push(n);
  }
}
for (const age of AGES) {
  const [lo, hi] = PAINT_HOST_COUNT_RANGE[age];
  const seen = new Set(rollHist[age]);
  assert(seen.size >= 2, `${age} roll collapsed to ${[...seen].join(',')}`);
  console.log(`info roll ${age} ${lo}–${hi} samples=${rollHist[age].join(',')}`);
}

{
  const tiny = corridorMap();
  const short = placePaintFloorPins(tiny, {
    spawnCol: 1,
    spawnRow: 2,
    extractCol: 10,
    extractRow: 2,
    kindling: [
      { col: 4, row: 2, tier: 'contested' },
      { col: 7, row: 2, tier: 'deep' },
    ],
    paintCount: 12,
  });
  assert(typeof short === 'string', 'short corridor must fail ancient-sized N instead of clamping');
  if (typeof short === 'string') {
    assert(short.startsWith(PAINT_PINS_SHORT), `fail reason ${short}`);
    console.log(`info retry-reachable ${short}`);
  }
}

const layoutHist: Record<ContaminationAge, number[]> = { new: [], standard: [], ancient: [] };

for (const seed of LAYOUT_SEEDS) {
  for (const age of AGES) {
    const layout = generateRiftLayout(seed, { contaminationAge: age });
    const n = rollPaintHostCount(seed, age);
    const [lo, hi] = PAINT_HOST_COUNT_RANGE[age];
    const pins = layout.contaminationPins.paintFloors;
    const bing = layout.contaminationDraw.forms.filter((f) => f.portfolio === 'bing');
    assert(layout.contaminationAge === age, `seed ${seed} age drifted ${layout.contaminationAge}`);
    assert(n >= lo && n <= hi, `seed ${seed} ${age} rolled ${n}`);
    assert(pins.length === n, `seed ${seed} ${age} pins ${pins.length} want ${n}`);
    assert(bing.length === n, `seed ${seed} ${age} bing ${bing.length} want ${n}`);
    assert(n >= 3, `seed ${seed} ${age} below floor 3`);
    const key = bing[0] ? identityKey(bing[0]) : '';
    assert(
      bing.every((form) => identityKey(form) === key),
      `seed ${seed} ${age} bing identity split`,
    );

    const spawn = tileOf(layout.spawnPoint);
    const extract = tileOf(layout.extractionPoint.position);
    const kindling = new Set(
      layout.kindlingNodes.map((node) => {
        const t = tileOf(node.position);
        return `${t.col},${t.row}`;
      }),
    );
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i]!;
      assert(
        layout.tileMap.tiles[pin.floorRow]?.[pin.floorCol] === TileType.FLOOR,
        `seed ${seed} ${age} pin ${i} not floor`,
      );
      assert(
        layout.walkableMask.isWalkable(pin.floorCol, pin.floorRow),
        `seed ${seed} ${age} pin ${i} not walkable`,
      );
      assert(
        chebyshevCells(pin.floorCol, pin.floorRow, spawn.col, spawn.row) > 3,
        `seed ${seed} ${age} pin ${i} too close to spawn`,
      );
      assert(
        chebyshevCells(pin.floorCol, pin.floorRow, extract.col, extract.row) > 3,
        `seed ${seed} ${age} pin ${i} too close to extract`,
      );
      assert(
        !kindling.has(`${pin.floorCol},${pin.floorRow}`),
        `seed ${seed} ${age} pin ${i} on kindling`,
      );
      for (let j = 0; j < i; j++) {
        const other = pins[j]!;
        const d = chebyshevCells(pin.floorCol, pin.floorRow, other.floorCol, other.floorRow);
        assert(d >= 3, `seed ${seed} ${age} pin ${i}/${j} chebyshev ${d} < 3`);
        assert(d > 0, `seed ${seed} ${age} pins stacked`);
      }
    }
    layoutHist[age].push(n);
    console.log(
      `ok seed ${seed} age=${age} n=${n} greedy=${pins.filter((p) => p.onGreedy).length}/${n} frag=${layout.fragmentTypeId}`,
    );
  }
}

for (const age of AGES) {
  console.log(`info layout ${age} n=${layoutHist[age].join(',')}`);
}

if (failed) {
  console.error(`check:paint-quota ${failed} failure(s)`);
  process.exit(1);
}
console.log('check:paint-quota ok');
