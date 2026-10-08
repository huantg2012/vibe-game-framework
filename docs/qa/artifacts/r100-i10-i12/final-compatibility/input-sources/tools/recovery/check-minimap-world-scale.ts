/** Physical-grid resolution must not change navigational coverage or reveal unknown terrain. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Minimap, validateMinimapRuntimeState } from '../../src/ui/minimap';
import { TileType, type Facing4, type Vector2 } from '../../src/types/game-types';

type Draw = { color: string; alpha: number; x: number; y: number; width: number; height: number };
function create(cols: number, rows: number, tileSize: number, extractionTile = { x: cols - 2, y: rows - 2 }) {
  const draws: Draw[] = [];
  const commands: unknown[][] = [];
  const context = {
    fillStyle: '', globalAlpha: 1,
    save() { commands.push(['save']); },
    restore() { commands.push(['restore']); },
    beginPath() { commands.push(['begin']); },
    arc(...args: number[]) { commands.push(['arc', ...args]); },
    clip() { commands.push(['clip']); },
    fillRect(x: number, y: number, width: number, height: number) {
      draws.push({ color: this.fillStyle, alpha: this.globalAlpha, x, y, width, height });
      commands.push(['fill', this.fillStyle, this.globalAlpha, x, y, width, height]);
    },
  };
  const tiles = Array.from({ length: rows }, () => Array<number>(cols).fill(TileType.FLOOR));
  const explored = new Uint8Array(cols * rows);
  const map = new Minimap();
  Object.assign(map, { mapWidth: cols, mapHeight: rows, tileSize, extractionTile, explored, tiles, ctx: context });
  return { map, tiles, explored, draws, commands,
    clear() { draws.length = 0; commands.length = 0; } };
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terrain = (draw: Draw) => draw.color === '#30383b' || draw.color === '#4a4e55';

// Captured from the pre-change 32px renderer, including edges, marks, fading and expiry.
// Keep these literal baselines: a new display scale must leave old active runs byte-identical.
const legacy = create(64, 42, 32, { x: 60, y: 20 });
for (let y = 0; y < 42; y++) for (let x = 0; x < 64; x++) {
  legacy.tiles[y]![x] = (x + y) % 9 === 0 ? TileType.VOID : (x + y) % 7 === 0 ? TileType.WALL : TileType.FLOOR;
  if ((x * 3 + y) % 5 === 0) legacy.map.markExplored(x, y);
}
legacy.map.markExplored(60, 20);
legacy.map.showAbyssReveal([{ x: 400, y: 640 }], [{ x: 384, y: 600 }], 6000, [{ x: 380, y: 630 }]);
const frames: [Vector2, Facing4, number][] = [
  [{ x: 320, y: 640 }, 'right', 1730],
  [{ x: 1888, y: 640 }, 'left', 160],
  [{ x: 0, y: 0 }, 'up', 4300],
];
for (const [position, facing, delta] of frames) legacy.map.update(position, facing, delta);
assert.equal(hash(legacy.commands), '4c824447db967aa244ec1cf09e93ffbf369d3725b94159bef2eb5430e872e8ea', '32px draw commands must remain identical');
assert.equal(hash(legacy.map.exportRuntimeState()), '73fd89890a9b2e9768e61da69bbd4df9cc7bdaa5e3e4bb30320063f5325f17d0', '32px saved knowledge must remain identical');

const fine = create(224, 152, 8);
const player = { x: 804, y: 604 };
fine.map.showAbyssReveal([], [
  { x: player.x + 160, y: player.y },
  { x: player.x - 192, y: player.y },
  { x: player.x + 700, y: player.y },
], 6000);
fine.map.update(player, 'right');
assert.equal(fine.draws.filter(draw => draw.color === '#1aad96').length, 6, '160px and 192px snapshots fit; distant snapshot is outside the display');
assert(!fine.draws.some(terrain), 'snapshot marks must not reveal terrain');
assert(!fine.draws.some(draw => draw.color === '#b0fff5'), 'undiscovered exit stays hidden');
assert.equal(fine.map.exportRuntimeState().explored.reduce((sum, cell) => sum + cell, 0), 0);

// One known fine cell must not borrow support information from its 15 unknown block neighbours.
fine.map.markExplored(100, 76);
fine.clear(); fine.map.update(player, 'right');
assert.deepEqual(fine.draws.filter(terrain).map(({ width, height }) => [width, height]), [[.5, .5]]);
const knownCommands = [...fine.commands];
for (let y = 76; y < 80; y++) for (let x = 100; x < 104; x++) {
  if (x !== 100 || y !== 76) fine.tiles[y]![x] = (x + y) % 2 === 0 ? TileType.WALL : TileType.VOID;
}
fine.clear(); fine.map.update(player, 'right');
assert.deepEqual(fine.commands, knownCommands, 'unseen support changes cannot affect the frame');
fine.map.markExplored(101, 76); // This cell is known VOID, so it remains background.
fine.clear(); fine.map.update(player, 'right');
assert.deepEqual(fine.commands, knownCommands, 'seen VOID cannot acquire a floor fill');

const saved = JSON.parse(JSON.stringify(fine.map.exportRuntimeState()));
assert(validateMinimapRuntimeState(saved));
assert.equal(saved.tileSize, 8);
assert.equal(saved.explored.length, 224 * 152, 'save retains fine-grained knowledge');
assert.equal(saved.explored.reduce((sum: number, cell: number) => sum + cell, 0), 2);
const resumed = create(224, 152, 8);
Object.assign(resumed.map, { tiles: fine.tiles });
resumed.map.restoreRuntimeState(saved);
assert.deepEqual(resumed.map.exportRuntimeState(), saved);
resumed.map.update(player, 'right');
assert.deepEqual(resumed.commands, fine.commands, 'fine-grid restore reproduces the frame');
resumed.clear(); resumed.map.update(player, 'right', 6000);
assert(!resumed.draws.some(draw => draw.color === '#1aad96'), 'snapshot expires after restore');
assert.deepEqual(resumed.map.exportRuntimeState().explored, saved.explored, 'expiry cannot change knowledge');

// Bound support reads by the local 1056px window, independent of the full map area.
const large = create(512, 512, 8);
large.explored.fill(1);
let supportReads = 0;
Object.assign(large.map, { tiles: large.tiles.map(row => new Proxy(row, {
  get(target, property, receiver) {
    if (typeof property === 'string' && /^\d+$/.test(property)) supportReads++;
    return Reflect.get(target, property, receiver);
  },
})) });
large.map.update({ x: 2048, y: 2048 }, 'up');
assert.equal(supportReads, 132 * 132, 'fine grid must scan only the local display window');
assert.equal(large.draws.filter(terrain).length, 132 * 132);
console.log('PASS minimap world scale: legacy 32px draw/save parity; 160/192px snapshots; fine-cell knowledge/VOID/restore; bounded local scan');
