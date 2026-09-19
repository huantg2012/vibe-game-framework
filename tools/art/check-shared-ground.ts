/** Regression for the production bake: safe vegetation must not become a
 * rectangular teal host. Tests the current renderer, not copied art fixtures. */
import assert from 'node:assert/strict';
import { generateRiftLayout } from '@/generation/rift-layout';
import { bakeGround, compositeStaticPaint, LIVE_PAINT_PX_PER_TILE } from '@/generation/preview-paint';

function flatTealCell(rgba: Uint8Array, width: number, x: number, y: number, tile: number): boolean {
  let teal = 0;
  for (let yy = y; yy < y + tile; yy++) for (let xx = x; xx < x + tile; xx++) {
    const i = (yy * width + xx) * 4;
    if (rgba[i + 1]! > rgba[i]! * 1.5 && rgba[i + 2]! > rgba[i]! * 1.3 && rgba[i + 1]! >= 65) teal++;
  }
  return teal / (tile * tile) >= 0.75;
}
const bad = new Uint8Array(16 * 16 * 4);
for (let i = 0; i < bad.length; i += 4) bad.set([14,74,63,255], i);
assert(flatTealCell(bad, 16, 0, 0, 16), 'the previous pure-green tile must trigger the guard');
let inertCells = 0;
for (const seed of [3036342668, 0, 101, 13013, 908, 262626, 619, 42]) {
  const layout = generateRiftLayout(seed);
  const ground = bakeGround(layout.ruins, LIVE_PAINT_PX_PER_TILE);
  const rgba = new Uint8Array(ground.width * ground.height * 4);
  compositeStaticPaint(ground, new Float32Array(ground.raw.length), rgba);
  for (let i = 0; i < ground.roles.length; i++) {
    if (!['vegetation','organic'].includes(ground.roles[i]!)) continue;
    inertCells++;
    const x = i % layout.tileMap.cols * ground.tileSize;
    const y = Math.floor(i / layout.tileMap.cols) * ground.tileSize;
    assert(!flatTealCell(rgba, ground.width, x, y, ground.tileSize), `safe material became flat teal: ${seed}:${i}`);
  }
}
assert(inertCells > 58, 'cover the original regression plus other generated maps');
console.log(`Shared ground: 8 generated maps, ${inertCells} inert-material cells; old flat-teal fixture rejected.`);
