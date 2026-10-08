/** Real saved v3 frame, relocated only in CPU negative/positive admission fixtures. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import { TileType } from '../../src/types/game-types';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyHasSupport } from '../../src/systems/ai/physical-grid';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { validateProceduralRiftAdmission, restoreProceduralWorld } = await import('../../src/managers/rift-recovery');
const record = JSON.parse(readFileSync('docs/qa/artifacts/r100-i03-i06/create-failure/restored-active-checkpoint.json', 'utf8'));
const checkpoint = record.riftCheckpoint;
assert(validateProceduralRiftAdmission(checkpoint, record.inventory), 'previous actual v3 body and sprite remain compatible');
const world = restoreProceduralWorld(checkpoint.identity)!;
const collision = new NativeBodyCollision(world.native!, world.layout.tileMap), grid = new TileGrid(world.layout.tileMap);
let corner: { x: number; y: number } | null = null, wall: { x: number; y: number } | null = null;
for (let y = 30; y < grid.heightPx - 30 && (!corner || !wall); y += 2) for (let x = 30; x < grid.widthPx - 30 && (!corner || !wall); x += 2) {
  const point = { x, y };
  if (!corner && collision.supports(point, 10, 10) && !bodyHasSupport(grid, point, 10, 10)) corner = point;
  const fullFloor = Array.from({ length: 21 }, (_, dy) => dy - 10).every(dy => Array.from({ length: 21 }, (_, dx) => dx - 10).every(dx => world.layout.tileMap.tiles[Math.floor((y + dy) / 8)]?.[Math.floor((x + dx) / 8)] !== TileType.VOID));
  if (!wall && fullFloor && !collision.supports(point, 10, 10) && grid.isWalkableAt(x, y)) wall = point;
}
assert(corner && wall, 'actual world must exercise fine allowed border and center-only false acceptance');
const at = (point: { x: number; y: number }) => {
  const frame = structuredClone(checkpoint);
  frame.state.player.position = { ...point }; frame.state.player.bodyPosition = { x: point.x - 10, y: point.y - 10 };
  return frame;
};
assert(validateProceduralRiftAdmission(at(corner), record.inventory), 'new full-body legal border may save and cold-admit');
assert(!validateProceduralRiftAdmission(at(wall), record.inventory), 'a clear sprite center cannot hide its body intersecting solid');
const bodyMismatch = at(corner); bodyMismatch.state.player.bodyPosition.x += .01;
assert(!validateProceduralRiftAdmission(bodyMismatch, record.inventory), 'body/sprite mismatch rejects');
const spriteMismatch = at(corner); spriteMismatch.state.player.position.y += .01;
assert(!validateProceduralRiftAdmission(spriteMismatch, record.inventory), 'sprite/body mismatch rejects');
const voidFrame = at({ x: 5, y: 5 });
assert(!validateProceduralRiftAdmission(voidFrame, record.inventory), 'missing complete floor support rejects');
console.log(JSON.stringify({ ok: true, actualPriorWorld: checkpoint.identity.generation.nativeDefinition.id, corner, wall, checks: 6 }));
