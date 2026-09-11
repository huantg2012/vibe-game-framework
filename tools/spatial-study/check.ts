import assert from 'node:assert/strict';
import { createSpatialStudyLayout, spatialFixtureSignature, SPATIAL_WATER } from '../../src/dev/spatial-study/fixture';
import { isInsideWaterCurtain, sampleWaterCurtain, WaterCurtainRuntime, type WaterCurtainFrame } from '../../src/dev/spatial-study/water-curtain';
import { TileType } from '../../src/types/game-types';
import { compositeSeaVolume, type SeaRasterLayers } from '../../src/dev/spatial-study/volume-composite';

let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }

check('identical data are repeatable, and restarting cannot inherit changed floor or visibility data', () => {
  for (const seed of [0, 7, 0xffffffff]) {
    const signature = spatialFixtureSignature(seed);
    const first = createSpatialStudyLayout(seed), second = createSpatialStudyLayout(seed);
    assert.deepEqual(first.tileMap, second.tileMap);
    assert.equal(first.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length, 1);
    assert.equal(first.kindlingNodes.length + first.contaminantNodes.length, 2);
    first.tileMap.tiles[5]![5] = TileType.WALL;
    first.ruins.outline.land.fill(0);
    assert.equal(second.tileMap.tiles[5]![5], TileType.FLOOR);
    assert(second.ruins.outline.land.some(Boolean));
    assert.equal(spatialFixtureSignature(seed), signature);
  }
  for (const seed of [-1, .5, NaN, Infinity, 0x100000000]) assert.throws(() => createSpatialStudyLayout(seed));
});

check('all actual loot remains reachable when the entire water footprint is forbidden', () => {
  const layout = createSpatialStudyLayout(7), tile = layout.tileMap.tileSize;
  const queue = [{ x: Math.floor(layout.spawnPoint.x / tile), y: Math.floor(layout.spawnPoint.y / tile) }];
  const reached = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!, key = `${p.x}:${p.y}`;
    if (reached.has(key) || !layout.walkableMask.isWalkable(p.x, p.y)) continue;
    // Conservative: forbid even cells whose edges overlap the active rectangle.
    const w = SPATIAL_WATER;
    if (p.x * tile < w.x + w.width / 2 && (p.x + 1) * tile > w.x - w.width / 2
      && p.y * tile < w.y + w.depth / 2 && (p.y + 1) * tile > w.y - w.depth / 2) continue;
    reached.add(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ x: p.x + dx!, y: p.y + dy! });
  }
  for (const node of [...layout.kindlingNodes, ...layout.contaminantNodes]) {
    assert(reached.has(`${Math.floor(node.position.x / tile)}:${Math.floor(node.position.y / tile)}`), `Unreachable ${node.id}`);
  }
});

check('descent is continuous, has a visible safe warning, reaches the floor, then becomes safe again', () => {
  const d = SPATIAL_WATER;
  const frame: WaterCurtainFrame = { phase: 'quiet', cycle: 0, progress: 0, extension: 0, active: false };
  const period = d.quietMs + d.warningMs + d.activeMs + d.retractMs;
  let previous = 0, safeWarning = 0, dangerous = 0;
  for (let ms = 0; ms <= period; ms++) {
    sampleWaterCurtain(frame, ms, d);
    assert(frame.extension >= 0 && frame.extension <= 1);
    assert(Math.abs(frame.extension - previous) < .01, `Height discontinuity at ${ms}`);
    assert.equal(frame.active, frame.extension >= d.contactExtension);
    if (frame.phase === 'descending' && frame.extension > 0 && !frame.active) safeWarning++;
    if (frame.active) dangerous++;
    previous = frame.extension;
  }
  assert(safeWarning > d.warningMs / 2);
  assert(dangerous >= d.activeMs);
  assert.equal(frame.cycle, 1); assert.equal(frame.phase, 'quiet'); assert.equal(frame.extension, 0);
});

check('damage uses the real contact frame, respects attempt interval, and separates blocked from committed hits', () => {
  const d = SPATIAL_WATER, runtime = new WaterCurtainRuntime(d), center = { x: d.x, y: d.y };
  const start = d.quietMs + d.warningMs;
  const calls: { id: string; damage: number }[] = [];
  const blocked = (id: string, damage: number) => { calls.push({ id, damage }); return false; };
  const committed = (id: string, damage: number) => { calls.push({ id, damage }); return true; };
  runtime.update(start, center, false, blocked);
  assert.equal(runtime.attempts, 1); assert.equal(runtime.hits, 0);
  runtime.update(start + d.hitIntervalMs - 1, center, false, committed);
  assert.equal(calls.length, 1);
  runtime.update(start + d.hitIntervalMs, center, false, committed);
  assert.equal(runtime.attempts, 2); assert.equal(runtime.hits, 1);
  for (const call of calls) { assert.equal(call.id, `environment:${d.id}`); assert.equal(call.damage, d.damage); }
  runtime.update(start + d.hitIntervalMs * 2, center, true, committed);
  assert.equal(runtime.attempts, 2);
});

check('both side routes and quiet phases cannot produce water contact damage', () => {
  const d = SPATIAL_WATER, runtime = new WaterCurtainRuntime(d);
  let attempts = 0;
  for (let ms = 0; ms < 21000; ms += 16) {
    const p = { x: d.x + d.width / 2 + 24, y: d.y };
    assert.equal(isInsideWaterCurtain(p, d), false);
    runtime.update(ms, p, false, () => { attempts++; return true; });
  }
  assert.equal(attempts, 0);
  const fresh = new WaterCurtainRuntime(d);
  fresh.update(d.quietMs - 1, { x: d.x, y: d.y }, false, () => { attempts++; return true; });
  assert.equal(attempts, 0);
});

check('rounded water contact excludes the bounding-box corners and includes its visible centerline', () => {
  const d = SPATIAL_WATER;
  assert.equal(d.footprint, 'ellipse');
  assert(isInsideWaterCurtain({ x: d.x, y: d.y }, d));
  assert(isInsideWaterCurtain({ x: d.x + d.width * .49, y: d.y }, d));
  assert(!isInsideWaterCurtain({ x: d.x + d.width * .49, y: d.y + d.depth * .49 }, d));
  assert(!isInsideWaterCurtain({ x: d.x, y: d.y + d.depth * .51 }, d));
});

check('ocean reveal keeps the column behind opaque foreground and exposes only its actual layer when clear', () => {
  const layers: SeaRasterLayers = { width: 1, height: 1, pixelStep: 2,
    bodyPixels: new Uint32Array([0xff000064]), bodyDepth: new Float32Array([20]), bodySurface: new Uint8Array([2]),
    fallPixels: new Uint32Array([0xff006400]), fallDepth: new Float32Array([10]) };
  const output = { data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' } as ImageData;
  const view = { x: 1, groundY: 20, compression: 1, elapsedMs: 0, enabled: false };
  compositeSeaVolume(layers, output, view);
  assert.deepEqual([...output.data], [100, 0, 0, 255]);
  layers.fallDepth[0] = 30;
  compositeSeaVolume(layers, output, view);
  assert.deepEqual([...output.data], [0, 100, 0, 255]);
  layers.fallDepth[0] = 10;
  compositeSeaVolume(layers, output, { ...view, enabled: true });
  assert(output.data[0]! > 0 && output.data[1]! > output.data[0]!);
  layers.bodyPixels[0] = 0; layers.bodyDepth[0] = -Infinity;
  layers.fallPixels[0] = 0; layers.fallDepth[0] = -Infinity;
  compositeSeaVolume(layers, output, view);
  assert.deepEqual([...output.data], [0, 0, 0, 0]);
});

console.log(`${passed} spatial-study checks passed`);
