import type { TileMapData } from '@/types/map-types';
import { TileType } from '@/types/game-types';

/** The study's dry seabed. Geometry always comes from the playable tile map. */
export function grain(x: number, y: number, seed: number): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, size: number, seed: number): number {
  const a = Math.floor(x / size), b = Math.floor(y / size);
  let u = x / size - a, v = y / size - b;
  u *= u * (3 - 2 * u); v *= v * (3 - 2 * v);
  const top = grain(a, b, seed) * (1 - u) + grain(a + 1, b, seed) * u;
  const bottom = grain(a, b + 1, seed) * (1 - u) + grain(a + 1, b + 1, seed) * u;
  return top * (1 - v) + bottom * v;
}

export function makeSeabed(map: TileMapData, seed: number, heightProjection: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const width = map.cols * map.tileSize, height = map.rows * map.tileSize;
  canvas.width = width; canvas.height = height + 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const tile = map.tileSize;
  const solid = (x: number, y: number) => {
    const col = Math.floor(x / tile), row = Math.floor(y / tile);
    return col >= 0 && row >= 0 && col < map.cols && row < map.rows && map.tiles[row]![col] !== TileType.VOID;
  };
  // Exposed sediment edge is a visible side, below the one actual walkable floor.
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    if (map.tiles[row]![col] === TileType.VOID || solid(col * tile, (row + 1) * tile)) continue;
    for (let x = col * tile; x < (col + 1) * tile; x += 2) {
      const depth = Math.round((19 + grain(x, row, seed) * 21) * Math.max(.4, heightProjection));
      const shade = 17 + Math.floor(grain(x, row, seed + 2) * 15);
      ctx.fillStyle = `rgb(${shade + 5},${shade + 8},${shade + 9})`;
      ctx.fillRect(x, (row + 1) * tile, 2, depth);
      ctx.fillStyle = '#080e12'; ctx.fillRect(x, (row + 1) * tile + depth - 4, 2, 6);
    }
  }
  // Correlated deposits, not independent per-tile noise: no visible tile grid.
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    if (!solid(x, y)) continue;
    const broad = smoothNoise(x, y, 116, seed), medium = smoothNoise(x, y, 25, seed + 7);
    const fine = grain(x >> 1, y >> 1, seed + 3);
    const strand = Math.sin(x * .041 + y * .078 + broad * 9 + medium * 2.4);
    const shellBed = broad > .54;
    let r = 49 + broad * 31 + medium * 12;
    let g = 57 + broad * 27 + medium * 10;
    let b = 58 + broad * 20 + medium * 8;
    const deposit = strand > .76 ? (strand - .76) * 35 : -2;
    const grit = (fine - .5) * 14 + deposit;
    if (shellBed) { r += 13; g += 8; b += 1; }
    let edge = 1;
    if (!solid(x - 4, y) || !solid(x + 4, y) || !solid(x, y - 4) || !solid(x, y + 4)) edge = .72;
    if (!solid(x, y + 6)) { r += 14; g += 13; b += 10; }
    if (map.tiles[Math.floor(y / tile)]![Math.floor(x / tile)] === TileType.WALL) edge *= .42;
    ctx.fillStyle = `rgb(${Math.round((r + grit) * edge)},${Math.round((g + grit) * edge)},${Math.round((b + grit) * edge)})`;
    ctx.fillRect(x, y, 2, 2);
  }
  // Crushed shell valves lie flat; larger upright ribs only occupy collision tiles.
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(grain(i, 19, seed) * width / 2) * 2;
    const y = Math.floor(grain(i, 41, seed) * height / 2) * 2;
    if (!solid(x - 6, y - 6) || !solid(x + 8, y + 6)) continue;
    const span = 2 + Math.floor(grain(i, 31, seed) * 4) * 2;
    if (grain(i, 6, seed) < .76) {
      ctx.fillStyle = grain(i, 81, seed) > .5 ? '#8e8b7a' : '#323d3e';
      ctx.fillRect(x, y, span, 2); ctx.fillRect(x + 2, y - 2, Math.max(2, span - 4), 2);
    } else {
      ctx.fillStyle = '#313c3e'; ctx.fillRect(x - 2, y + 4, span + 4, 2);
      ctx.fillStyle = '#999584'; ctx.fillRect(x, y, span, 4);
      ctx.fillStyle = '#b0a992'; ctx.fillRect(x + 2, y - 2, Math.max(2, span - 4), 2);
      ctx.fillStyle = '#626b65'; ctx.fillRect(x + 4, y, 2, 4);
    }
  }
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    if (map.tiles[row]![col] !== TileType.WALL) continue;
    for (let i = 0; i < 12; i++) {
      const x = col * tile + Math.floor(grain(col * 17 + i, row, seed) * 28 / 2) * 2;
      const y = row * tile + Math.floor(grain(col * 11 + i, row, seed + 1) * 28 / 2) * 2;
      const rise = Math.round((7 + grain(i, row + col, seed) * 13) * Math.max(.5, heightProjection));
      ctx.fillStyle = '#293437'; ctx.fillRect(x - 2, y, 8, 4);
      ctx.fillStyle = '#676e66'; ctx.fillRect(x, y - rise, 4, rise + 2);
      ctx.fillStyle = '#a1a08c'; ctx.fillRect(x, y - rise, 4, 2);
      ctx.fillStyle = '#434e4d'; ctx.fillRect(x + 4, y - rise + 2, 2, rise);
    }
  }
  return canvas;
}

export { smoothNoise };
