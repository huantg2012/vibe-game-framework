/**
 * Machine gate for C2 scenic walls. No Phaser.
 *
 *   npm run check:ruins
 */
import { TileType } from '../../src/types/game-types.ts';
import { RIFT_FRAGMENT_DATA } from '../../src/generated/rift-fragment-data.ts';
import { generateOutline } from '../../src/generation/outline-mask.ts';
import { evaluateRuins, generateRuins, openSealedFloors } from '../../src/generation/ruins.ts';

let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) return;
  failed++;
  console.error(`FAIL ${msg}`);
}

const types = ['frag-outdoor', 'frag-clinic', 'frag-metro'] as const;
const seeds = [101, 202, 303, 404, 505, 606];

for (const type of types) {
  for (const seed of seeds) {
    const a = generateRuins(seed, type);
    const b = generateRuins(seed, type);
    assert(a.walls.length === b.walls.length, `${type} ${seed} length`);
    let same = true;
    for (let i = 0; i < a.walls.length; i++) {
      if (a.walls[i] !== b.walls[i]) {
        same = false;
        break;
      }
    }
    assert(same, `${type} ${seed} must be deterministic`);
    assert(a.fragmentTypeId === type, `${type} ${seed} id`);
    assert(a.features.length >= 12, `${type} ${seed} masses ${a.features.length}`);
    assert(a.metrics.leftoverConnected, `${type} ${seed} leftover walkable`);

    let walls = 0;
    let voidOnWall = 0;
    for (let i = 0; i < a.walls.length; i++) {
      if (!a.walls[i]) continue;
      walls++;
      if (!a.outline.land[i]) voidOnWall++;
    }
    assert(walls > 0, `${type} ${seed} has walls`);
    assert(voidOnWall === 0, `${type} ${seed} walls only on land`);

    let tileWalls = 0;
    for (const row of a.tileMap.tiles) {
      for (const t of row) if (t === TileType.WALL) tileWalls++;
    }
    assert(tileWalls === walls, `${type} ${seed} tileMap walls`);
  }
}

for (const seed of seeds) {
  const outdoor = generateRuins(seed, 'frag-outdoor');
  const clinic = generateRuins(seed, 'frag-clinic');
  const metro = generateRuins(seed, 'frag-metro');
  let landSame = true;
  for (let i = 0; i < outdoor.outline.land.length; i++) {
    if (outdoor.outline.land[i] !== clinic.outline.land[i]) landSame = false;
  }
  assert(landSame, `seed ${seed} land shared across types`);

  let oc = false;
  let om = false;
  let cm = false;
  for (let i = 0; i < outdoor.walls.length; i++) {
    if (outdoor.walls[i] !== clinic.walls[i]) oc = true;
    if (outdoor.walls[i] !== metro.walls[i]) om = true;
    if (clinic.walls[i] !== metro.walls[i]) cm = true;
  }
  assert(oc && om && cm, `seed ${seed} three grammars must differ`);

  assert(
    outdoor.features.every((f) => f.kind === 'ridge'),
    `seed ${seed} outdoor is ridges`,
  );
  assert(
    clinic.features.every((f) => f.kind === 'enclosure'),
    `seed ${seed} clinic is enclosures`,
  );
  assert(
    metro.features.every((f) => f.kind === 'slab'),
    `seed ${seed} metro is slabs`,
  );
}

const outline = generateOutline(101);
const pepper = new Uint8Array(outline.land.length);
let sprinkled = 0;
for (let i = 0; i < outline.land.length && sprinkled < 14; i++) {
  if (outline.land[i] && i % 17 === 0) {
    pepper[i] = 1;
    sprinkled++;
  }
}
const pepperVerdict = evaluateRuins(outline, pepper, [], RIFT_FRAGMENT_DATA['frag-outdoor']!);
assert(!pepperVerdict.ok, `pepper walls must be rejected (got ${pepperVerdict.reasons.join(',')})`);

const boxed = new Uint8Array(outline.land.length);
const boxCol = outline.metrics.bbox.minCol + 4;
const boxRow = outline.metrics.bbox.minRow + 4;
let boxedOk = true;
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const col = boxCol + c;
    const row = boxRow + r;
    const i = row * outline.cols + col;
    if (!outline.land[i]) boxedOk = false;
    if (r === 0 || r === 4 || c === 0 || c === 4) boxed[i] = 1;
  }
}
if (boxedOk) {
  const opened = new Uint8Array(boxed);
  const n = openSealedFloors(outline.land, opened, outline.cols, outline.rows);
  assert(n > 0, 'punch must open a walled-in pocket');
  const after = evaluateRuins(outline, opened, [], RIFT_FRAGMENT_DATA['frag-outdoor']!);
  assert(after.metrics.leftoverConnected, '1-thick box must not stay sealed');
}

const thick = new Uint8Array(outline.land.length);
let thickOk = true;
for (let r = 0; r < 6; r++) {
  for (let c = 0; c < 6; c++) {
    const col = boxCol + c;
    const row = boxRow + r;
    const i = row * outline.cols + col;
    if (!outline.land[i]) thickOk = false;
    const inner = r >= 2 && r <= 3 && c >= 2 && c <= 3;
    if (!inner) thick[i] = 1;
  }
}
if (thickOk) {
  const opened = new Uint8Array(thick);
  const n = openSealedFloors(outline.land, opened, outline.cols, outline.rows);
  assert(n > 0, 'punch must open a 2-thick pocket');
  const after = evaluateRuins(outline, opened, [], RIFT_FRAGMENT_DATA['frag-outdoor']!);
  assert(after.metrics.leftoverConnected, '2-thick box must not stay sealed');
}

let ok = 0;
const sample = 24;
for (let i = 0; i < sample; i++) {
  try {
    generateRuins(2000 + i * 13, types[i % types.length]);
    ok++;
  } catch {
    // counted below
  }
}
assert(ok >= Math.floor(sample * 0.8), `success rate ${ok}/${sample} (need ≥80%)`);

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log(`ruin checks passed (${ok}/${sample} random seeds usable)`);
