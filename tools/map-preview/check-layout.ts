/**
 * Machine gate for C3 generateRiftLayout. No Phaser scene.
 *
 *   npm run check:layout
 *
 * Dual path (spec 21) and walkable-component count are FATAL.
 */
import { countWalkableComponents } from '../../src/generation/connectivity.ts';
import { evaluateDualPath } from '../../src/generation/dual-path.ts';
import { isContaminationAge, isRuinSeverity } from '../../src/generation/fragment-roll.ts';
import {
  LIVE_PAINT_PX_PER_TILE,
  paintSkyShade,
  skyOverlaySize,
} from '../../src/generation/preview-paint.ts';
import { generateRiftLayout } from '../../src/generation/rift-layout.ts';
import { selfCheckWallEdgePath, orderWallEdgeTiles, sameWallEdgeTileSet } from '../../src/generation/wall-edge-path.ts';
import { RIFT_MAP } from '../../src/scenes/rift-map-data.ts';
import { TileType } from '../../src/types/game-types.ts';
import type { GeneratedRiftLayout } from '../../src/generation/types.ts';
import type { TileMapData } from '../../src/types/map-types.ts';

const SEEDS = [3, 11, 29, 47, 73, 101, 211, 409] as const;
const EXTRACT_EPS = 1;
const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed++;
  console.error(`FAIL ${msg}`);
}

function landWalls(map: TileMapData): { land: Uint8Array; walls: Uint8Array } {
  const land = new Uint8Array(map.cols * map.rows);
  const walls = new Uint8Array(map.cols * map.rows);
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const t = map.tiles[row]![col]!;
      const i = row * map.cols + col;
      if (t !== TileType.VOID) land[i] = 1;
      if (t === TileType.WALL) walls[i] = 1;
    }
  }
  return { land, walls };
}

function wallCount(map: TileMapData): number {
  let n = 0;
  for (const row of map.tiles) {
    for (const t of row) if (t === TileType.WALL) n++;
  }
  return n;
}

function tileOf(layout: GeneratedRiftLayout, pos: { x: number; y: number }): { col: number; row: number } {
  const tile = layout.tileMap.tileSize;
  return { col: Math.floor(pos.x / tile), row: Math.floor(pos.y / tile) };
}

function floodFrom(
  layout: GeneratedRiftLayout,
  startCol: number,
  startRow: number,
): Uint8Array {
  const { cols, rows } = layout.walkableMask;
  const seen = new Uint8Array(cols * rows);
  if (!layout.walkableMask.isWalkable(startCol, startRow)) return seen;
  const stack = [startRow * cols + startCol];
  seen[stack[0]!] = 1;
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const col = cur % cols;
    const row = (cur / cols) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = col + dx;
      const ny = row + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (seen[ni] || !layout.walkableMask.isWalkable(nx, ny)) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

function dualPathOf(layout: GeneratedRiftLayout) {
  const spawn = tileOf(layout, layout.spawnPoint);
  const extract = tileOf(layout, layout.extractionPoint.position);
  const { cols, rows } = layout.walkableMask;
  const walk = new Uint8Array(cols * rows);
  const walls = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (layout.walkableMask.isWalkable(col, row)) walk[i] = 1;
      if (layout.tileMap.tiles[row]![col] === TileType.WALL) walls[i] = 1;
    }
  }
  return evaluateDualPath(walk, walls, cols, rows, spawn.row * cols + spawn.col, extract.row * cols + extract.col);
}

const forbidden = RIFT_MAP.layout.extractionPoint.position;
const ages = new Set<string>();
const ruins = new Set<string>();

{
  try {
    selfCheckWallEdgePath();
    console.log('ok wall-edge-path self-check (set-eq, walks)');
  } catch (err) {
    failed++;
    console.error(`FAIL wall-edge-path self-check: ${err instanceof Error ? err.message : String(err)}`);
  }
}

for (const seed of SEEDS) {
  const layout = generateRiftLayout(seed);
  const { land, walls } = landWalls(layout.tileMap);
  const components = countWalkableComponents(land, walls, layout.tileMap.cols, layout.tileMap.rows);
  assert(components === 1, `seed ${seed}: walkable components = ${components}`);
  assert(layout.seed === seed, `seed ${seed}: layout.seed ${layout.seed}`);
  assert(layout.extractionPoint && layout.extractionPoint.position, `seed ${seed}: missing extract`);
  assert(
    Math.abs(layout.extractionPoint.position.x - forbidden.x) >= EXTRACT_EPS ||
      Math.abs(layout.extractionPoint.position.y - forbidden.y) >= EXTRACT_EPS,
    `seed ${seed}: extract matches handwritten X`,
  );

  const spawnT = tileOf(layout, layout.spawnPoint);
  const extractT = tileOf(layout, layout.extractionPoint.position);
  assert(layout.walkableMask.isWalkable(spawnT.col, spawnT.row), `seed ${seed}: spawn not walkable`);
  assert(
    layout.walkableMask.isWalkable(extractT.col, extractT.row),
    `seed ${seed}: extract not walkable`,
  );
  const reach = floodFrom(layout, spawnT.col, spawnT.row);
  assert(reach[extractT.row * layout.walkableMask.cols + extractT.col] === 1, `seed ${seed}: spawn cannot reach extract`);

  const byTier = { safe: 0, contested: 0, deep: 0 };
  for (const node of layout.kindlingNodes) byTier[node.tier]++;
  assert(byTier.safe === 3, `seed ${seed}: safe kindling ${byTier.safe}`);
  assert(byTier.contested === 3, `seed ${seed}: contested kindling ${byTier.contested}`);
  assert(byTier.deep === 2, `seed ${seed}: deep kindling ${byTier.deep}`);
  assert(layout.contaminantNodes.length === 3, `seed ${seed}: contaminants ${layout.contaminantNodes.length}`);
  assert(
    layout.enemySpawns.length >= 3 && layout.enemySpawns.length <= 4,
    `seed ${seed}: patrols ${layout.enemySpawns.length}`,
  );
  const rewriterCount = layout.enemySpawns.filter((e) => e.type === 'rewriter').length;
  assert(rewriterCount === 1, `seed ${seed}: rewriter count ${rewriterCount} (must be exactly 1)`);
  const gate = layout.enemySpawns[0];
  assert(gate?.type === 'infiltrator', `seed ${seed}: extract gate ${gate?.id} is ${gate?.type}`);
  assert(gate?.id === 'ENM_INF_01', `seed ${seed}: gate id ${gate?.id}`);
  assert(gate?.form, `seed ${seed}: extract gate missing form`);
  assert(
    gate?.form?.substrate === 'organic_remnant' &&
      gate?.form?.coverage === 'infiltrate' &&
      gate?.form?.lexemes.sense === 'sense_cone',
    `seed ${seed}: extract gate form not remnant+infiltrate+cone`,
  );
  for (const enemy of layout.enemySpawns) {
    assert(enemy.form, `seed ${seed}: ${enemy.id} missing form`);
    const fromSense = enemy.form?.lexemes.sense === 'sense_hear' ? 'rewriter' : 'infiltrator';
    assert(enemy.type === fromSense, `seed ${seed}: ${enemy.id} type ${enemy.type} != form sense`);
  }
  const rewriter = layout.enemySpawns.find((e) => e.type === 'rewriter');
  assert(rewriter?.form?.lexemes.sense === 'sense_hear', `seed ${seed}: rewriter form is not hear`);
  const drawJia = layout.contaminationDraw.forms.filter((f) => f.portfolio === 'jia');
  assert(
    drawJia.length === layout.enemySpawns.length,
    `seed ${seed}: contaminationDraw jia ${drawJia.length} != patrols ${layout.enemySpawns.length}`,
  );
  const drawHear = layout.contaminationDraw.forms.filter((f) => f.lexemes.sense === 'sense_hear').length;
  assert(drawHear === 1, `seed ${seed}: contaminationDraw hear ${drawHear} (want 1)`);

  const checkReach = (label: string, pos: { x: number; y: number }): void => {
    const t = tileOf(layout, pos);
    assert(layout.walkableMask.isWalkable(t.col, t.row), `seed ${seed}: ${label} not walkable`);
    assert(reach[t.row * layout.walkableMask.cols + t.col] === 1, `seed ${seed}: ${label} unreachable from spawn`);
  };
  for (const node of layout.kindlingNodes) checkReach(node.id, node.position);
  for (const node of layout.contaminantNodes) checkReach(node.id, node.position);
  for (const enemy of layout.enemySpawns) {
    for (let i = 0; i < enemy.patrol.waypoints.length; i++) {
      const wp = enemy.patrol.waypoints[i]!;
      assert(layout.walkableMask.isWalkable(wp.col, wp.row), `seed ${seed}: ${enemy.id} wp ${i} not walkable`);
      assert(
        reach[wp.row * layout.walkableMask.cols + wp.col] === 1,
        `seed ${seed}: ${enemy.id} wp ${i} unreachable from spawn`,
      );
    }
  }

  const dual = dualPathOf(layout);
  assert(
    dual.ok,
    `seed ${seed}: no dual-path (main=${dual.mainSteps} alt=${dual.altSteps} open ${dual.mainOpenRatio.toFixed(2)}/${dual.altOpenRatio.toFixed(2)})`,
  );

  assert(isContaminationAge(layout.contaminationAge), `seed ${seed}: bad contaminationAge ${String(layout.contaminationAge)}`);
  assert(isRuinSeverity(layout.ruinSeverity), `seed ${seed}: bad ruinSeverity ${String(layout.ruinSeverity)}`);
  assert(layout.ruins.contaminationAge === layout.contaminationAge, `seed ${seed}: ruins.contaminationAge drifted`);
  assert(layout.ruins.ruinSeverity === layout.ruinSeverity, `seed ${seed}: ruins.ruinSeverity drifted`);
  ages.add(layout.contaminationAge);
  ruins.add(layout.ruinSeverity);

  const again = generateRiftLayout(seed);
  assert(again.fragmentTypeId === layout.fragmentTypeId, `seed ${seed}: fragmentTypeId drifted`);
  assert(again.spawnPoint.x === layout.spawnPoint.x && again.spawnPoint.y === layout.spawnPoint.y, `seed ${seed}: spawn drifted`);
  assert(
    again.extractionPoint.position.x === layout.extractionPoint.position.x &&
      again.extractionPoint.position.y === layout.extractionPoint.position.y,
    `seed ${seed}: extract drifted`,
  );
  assert(wallCount(again.tileMap) === wallCount(layout.tileMap), `seed ${seed}: wall count drifted`);
  assert(again.contaminationAge === layout.contaminationAge, `seed ${seed}: contaminationAge drifted`);
  assert(again.ruinSeverity === layout.ruinSeverity, `seed ${seed}: ruinSeverity drifted`);
  assert(layout.contaminationPins.wallEdges.length > 0, `seed ${seed}: no wall-edge pins`);
  assert(
    layout.contaminationPins.wallEdges.every((e) => e.strikeFloors.length > 0),
    `seed ${seed}: wall edge with no strike floors`,
  );
  for (let i = 0; i < layout.contaminationPins.wallEdges.length; i++) {
    const edge = layout.contaminationPins.wallEdges[i]!;
    const ordered = orderWallEdgeTiles(edge.tiles);
    assert(
      sameWallEdgeTileSet(edge.tiles, ordered),
      `seed ${seed}: wall-edge[${i}] orderWallEdgeTiles changed the tile set`,
    );
  }
  assert(layout.contaminationPins.corridorAabbs.length >= 0, `seed ${seed}: corridor field missing`);
  const paintFloors = layout.contaminationPins.paintFloors;
  assert(paintFloors.length >= 3, `seed ${seed}: paint floors ${paintFloors.length} (want ≥3)`);
  const bingForms = layout.contaminationDraw.forms.filter((f) => f.portfolio === 'bing');
  assert(
    bingForms.length === paintFloors.length,
    `seed ${seed}: bing forms ${bingForms.length} vs paint floors ${paintFloors.length}`,
  );
  for (const pin of paintFloors) {
    assert(
      layout.tileMap.tiles[pin.floorRow]?.[pin.floorCol] === TileType.FLOOR,
      `seed ${seed}: paint pin ${pin.floorCol},${pin.floorRow} not floor`,
    );
    assert(
      layout.walkableMask.isWalkable(pin.floorCol, pin.floorRow),
      `seed ${seed}: paint pin ${pin.floorCol},${pin.floorRow} not walkable`,
    );
    assert(
      reach[pin.floorRow * layout.walkableMask.cols + pin.floorCol] === 1,
      `seed ${seed}: paint pin ${pin.floorCol},${pin.floorRow} unreachable from spawn`,
    );
  }

  console.log(
    `ok seed ${seed} frag=${layout.fragmentTypeId} recipe=${layout.recipeId} age=${layout.contaminationAge} ruin=${layout.ruinSeverity} dual ${dual.mainSteps}/${dual.altSteps} patrols=${layout.enemySpawns.length} walls=${wallCount(layout.tileMap)}`,
  );
}

assert(
  ages.size >= 2 || ruins.size >= 2,
  `fragment roll collapsed: ages=${[...ages].join(',')} ruins=${[...ruins].join(',')}`,
);

{
  const layout = generateRiftLayout(101);
  const field = layout.ruins.atmosphere;
  assert(field, 'seed 101: missing atmosphere field');
  if (field) {
    const W = layout.ruins.outline.cols * LIVE_PAINT_PX_PER_TILE;
    const H = layout.ruins.outline.rows * LIVE_PAINT_PX_PER_TILE;
    const size = skyOverlaySize(W, H, LIVE_PAINT_PX_PER_TILE);
    const dim = new Uint8Array(size.width * size.height * 4);
    const rim = new Uint8Array(size.width * size.height * 4);
    const t0 = performance.now();
    paintSkyShade(field, W, H, LIVE_PAINT_PX_PER_TILE, 0.5, 0.35, dim, rim);
    const ms = performance.now() - t0;
    assert(
      ms < 80,
      `sky overlay ${ms.toFixed(1)}ms (budget 80ms; live path must not composite the full map)`,
    );
    console.log(`info sky-overlay ${size.width}x${size.height} ${ms.toFixed(1)}ms`);
  }
}

if (failed > 0) {
  console.error(`check:layout failed (${failed})`);
  process.exit(1);
}
console.log(`check:layout passed (${SEEDS.length} seeds)`);
