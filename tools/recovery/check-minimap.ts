/** Navigation knowledge and interrupted abyss capture; no browser/world visibility surrogate. */
import assert from 'node:assert/strict';
import { Minimap, validateMinimapRuntimeState } from '../../src/ui/minimap';
import { TileType } from '../../src/types/game-types';

function create() {
  const draws: { color: string; x: number; y: number }[] = [];
  const context = { fillStyle: '', globalAlpha: 1, save() {}, restore() {}, beginPath() {}, arc() {}, clip() {},
    fillRect(x: number, y: number) { draws.push({ color: this.fillStyle, x, y }); } };
  const map = new Minimap();
  Object.assign(map, { mapWidth: 64, mapHeight: 42, tileSize: 32, extractionTile: { x: 60, y: 20 },
    explored: new Uint8Array(64 * 42), tiles: Array.from({ length: 42 }, () => Array(64).fill(TileType.FLOOR)), ctx: context });
  return { map, draws };
}
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const a = create();
a.map.update({ x: 320, y: 640 }, 'up');
assert(!a.draws.some(draw => draw.color === '#b0fff5'), 'unknown exit must never leak');
a.map.markExplored(60, 20); a.draws.length = 0;
a.map.update({ x: 320, y: 640 }, 'up');
assert(a.draws.some(draw => draw.color === '#b0fff5'), 'discovered off-window exit retains a bearing');
assert.equal(a.map.exportRuntimeState().explored.reduce((n, cell) => n + cell, 0), 1, 'bearing must not explore the way');
const positions = [{ x: 400, y: 640 }];
a.map.showAbyssReveal(positions, [{ x: 384, y: 600 }], 6000, [{ x: 380, y: 630 }]);
positions[0]!.x = 1000;
a.map.update({ x: 320, y: 640 }, 'right', 1730);
const saved = json(a.map.exportRuntimeState());
assert(validateMinimapRuntimeState(saved));
assert.equal(saved.abyss!.enemyPositions[0]!.x, 400, 'snapshots cannot follow live positions');
assert.equal(saved.abyss!.remainingMs, 4270);
const b = create(); b.map.restoreRuntimeState(saved);
assert.deepEqual(b.map.exportRuntimeState(), saved);
a.map.update({ x: 320, y: 640 }, 'left', 4300); b.map.update({ x: 320, y: 640 }, 'left', 4300);
assert.deepEqual(b.map.exportRuntimeState(), a.map.exportRuntimeState());
assert.equal(b.map.exportRuntimeState().abyss!.enemyPositions.length, 0);
const old = { ...saved, abyss: undefined }; b.map.restoreRuntimeState(old);
assert.equal(b.map.exportRuntimeState().abyss!.remainingMs, 0);
for (const bad of [
  { ...saved, extractionDiscovered: false },
  { ...saved, abyss: { ...saved.abyss, remainingMs: 9000 } },
  { ...saved, abyss: { ...saved.abyss, remainingMs: 0 } },
  { ...saved, abyss: { ...saved.abyss, enemyPositions: [{ x: Infinity, y: 0 }] } },
]) assert(!validateMinimapRuntimeState(bad));
console.log('PASS minimap: unseen exit hidden, earned bearing, unchanged exploration, stale snapshot recovery/expiry, old schema and corrupt rejection');
