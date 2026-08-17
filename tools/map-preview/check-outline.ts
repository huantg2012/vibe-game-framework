/**
 * Machine gate for C1 land masks. No Phaser.
 *
 *   npm run check:outline
 */
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import { TileType } from '../../src/types/game-types.ts';
import { evaluateOutline, generateOutline } from '../../src/generation/outline-mask.ts';

const cols = GAME_CONSTANTS.GENERATION.BUFFER_COLS;
const rows = GAME_CONSTANTS.GENERATION.BUFFER_ROWS;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) return;
  failed++;
  console.error(`FAIL ${msg}`);
}

function filledRect(inset: number): Uint8Array {
  const land = new Uint8Array(cols * rows);
  for (let y = inset; y < rows - inset; y++) {
    for (let x = inset; x < cols - inset; x++) land[y * cols + x] = 1;
  }
  return land;
}

function nibbledRect(): Uint8Array {
  const land = filledRect(1);
  land[2 * cols + 2] = 0;
  land[2 * cols + 3] = 0;
  land[3 * cols + 2] = 0;
  land[(rows - 3) * cols + (cols - 3)] = 0;
  return land;
}

const rect = evaluateOutline(filledRect(1), cols, rows);
assert(!rect.ok, `filled rectangle must be rejected (got ${rect.ok ? 'ok' : rect.reasons.join(',')})`);

const nibble = evaluateOutline(nibbledRect(), cols, rows);
assert(!nibble.ok, `nibbled rectangle must be rejected (got ${nibble.ok ? 'ok' : nibble.reasons.join(',')})`);

const known = [101, 202, 303, 404, 505, 606];
for (const seed of known) {
  const a = generateOutline(seed);
  const b = generateOutline(seed);
  assert(a.land.length === b.land.length, `seed ${seed} length`);
  let same = true;
  for (let i = 0; i < a.land.length; i++) {
    if (a.land[i] !== b.land[i]) {
      same = false;
      break;
    }
  }
  assert(same, `seed ${seed} must be deterministic`);
  assert(a.cols === cols && a.rows === rows, `seed ${seed} buffer size`);
  assert(a.tileMap.tiles.length === rows, `seed ${seed} tile rows`);

  let floor = 0;
  let voidCells = 0;
  let other = 0;
  for (const row of a.tileMap.tiles) {
    for (const t of row) {
      if (t === TileType.FLOOR) floor++;
      else if (t === TileType.VOID) voidCells++;
      else other++;
    }
  }
  assert(floor === a.metrics.landCount, `seed ${seed} floor count`);
  assert(voidCells === cols * rows - floor, `seed ${seed} void count`);
  assert(other === 0, `seed ${seed} C1 must not emit walls`);
  assert(floor > 0 && voidCells > 0, `seed ${seed} must have land and void`);
}

let ok = 0;
const sample = 48;
for (let i = 0; i < sample; i++) {
  try {
    generateOutline(1000 + i * 17);
    ok++;
  } catch {
    // counted below
  }
}
assert(ok >= Math.floor(sample * 0.85), `success rate ${ok}/${sample} (need ≥85%)`);

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log(`outline checks passed (${ok}/${sample} random seeds usable)`);
