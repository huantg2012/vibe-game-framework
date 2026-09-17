import { SeededRandom } from '@/utils/random';
import { worldProfileById } from './profiles';
import type { WorldFormation, WorldProfileId, WorldSample, WorldTopologyId } from './types';

const COLS = 112;
const ROWS = 76;
const TILE_SIZE = 16;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function splitSeed(seed: number, salt: number): number {
  let value = Math.imul(seed ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return (value ^ value >>> 16) >>> 0;
}

function flood(mask: Uint8Array, start: number): number[] {
  const queue = [start];
  const seen = new Uint8Array(mask.length);
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const col = cell % COLS, row = Math.floor(cell / COLS);
    for (const [dx, dy] of DIRS) {
      const x = col + dx, y = row + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const next = y * COLS + x;
      if (mask[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
    }
  }
  return queue;
}

function components(mask: Uint8Array): number[][] {
  const remaining = new Uint8Array(mask);
  const result: number[][] = [];
  for (let cell = 0; cell < remaining.length; cell++) {
    if (!remaining[cell]) continue;
    const part = flood(remaining, cell);
    for (const index of part) remaining[index] = 0;
    result.push(part);
  }
  return result.sort((a, b) => b.length - a.length);
}

function clearance(mask: Uint8Array, col: number, row: number, radius: number): boolean {
  for (let y = row - radius; y <= row + radius; y++) for (let x = col - radius; x <= col + radius; x++) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || !mask[y * COLS + x]) return false;
  }
  return true;
}

function makeLand(seed: number): Uint8Array {
  const rng = new SeededRandom(splitSeed(seed, 0x812dd651));
  const phases = Array.from({ length: 4 }, () => rng.nextFloat(0, Math.PI * 2));
  const land = new Uint8Array(COLS * ROWS);
  const cx = COLS / 2 + rng.nextFloat(-2, 2), cy = ROWS / 2 + rng.nextFloat(-1, 1);
  for (let row = 2; row < ROWS - 2; row++) for (let col = 2; col < COLS - 2; col++) {
    const x = (col - cx) / 50, y = (row - cy) / 32;
    const angle = Math.atan2(y, x);
    const coast = 1 + .055 * Math.sin(angle * 3 + phases[0]!) + .036 * Math.sin(angle * 5 + phases[1]!)
      + .025 * Math.sin(angle * 9 + phases[2]!) + .015 * Math.sin(angle * 17 + phases[3]!);
    if (Math.hypot(x, y) < coast) land[row * COLS + col] = 1;
  }
  return land;
}

function stampLoops(walls: Uint8Array, land: Uint8Array, rng: SeededRandom): void {
  const commonAngle = rng.nextFloat(-.6, .6);
  const groups = Array.from({ length: 3 }, () => ({ x: rng.nextFloat(25, 88), y: rng.nextFloat(19, 58) }));
  const masses: { x: number; y: number; radius: number }[] = [];
  // Broad irregular masses on one continuous floor. Spaces reconnect around
  // the masses; this is not a graph rendered as platforms and thin bridges.
  // Clustered rejection sampling has no placement lattice. Large quiet bays
  // coexist with several denser groups, rather than uniformly planted rocks.
  for (let attempt = 0; attempt < 260 && masses.length < 17; attempt++) {
    const group = rng.pick(groups), clustered = rng.next() < .72;
    const cx = clustered ? group.x + rng.nextGaussian() * 14 : rng.nextFloat(14, 98);
    const cy = clustered ? group.y + rng.nextGaussian() * 10 : rng.nextFloat(12, 64);
    const large = masses.length < 2;
    const rx = rng.nextFloat(large ? 9 : 4.5, large ? 12 : 9), ry = rng.nextFloat(large ? 4 : 2.6, large ? 6 : 4.8);
    if (!clearance(land, Math.round(cx), Math.round(cy), 6)) continue;
    if (masses.some(mass => Math.hypot(cx - mass.x, cy - mass.y) < Math.max(10, (rx + mass.radius) * .83))) continue;
    masses.push({ x: cx, y: cy, radius: rx });
    const angle = commonAngle + rng.nextFloat(-.9, .9);
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const notch = rng.nextFloat(.2, .75), phase = rng.nextFloat(0, 6.28);
    for (let y = Math.max(1, Math.floor(cy - 13)); y < Math.min(ROWS - 1, cy + 13); y++) {
      for (let x = Math.max(1, Math.floor(cx - 13)); x < Math.min(COLS - 1, cx + 13); x++) {
        const dx = x - cx, dy = y - cy;
        const u = (dx * cosine + dy * sine) / rx;
        const v = (-dx * sine + dy * cosine) / ry;
        const warped = v + notch * Math.sin(u * 2.3 + phase);
        const boundary = 1 + .11 * Math.sin(Math.atan2(warped, u) * 3 + phase);
        if (u * u + warped * warped < boundary && clearance(land, x, y, 4)) walls[y * COLS + x] = 1;
      }
    }
  }
}

function stampChannels(walls: Uint8Array, land: Uint8Array, rng: SeededRandom): void {
  const slope = rng.nextFloat(-.12, .12);
  const amplitude = rng.nextFloat(2.2, 4.2), frequency = rng.nextFloat(.065, .09);
  const phase = rng.nextFloat(0, 6.28);
  for (let ridge = 0; ridge < 4; ridge++) {
    const originY = 13 + ridge * 16 + rng.nextFloat(-1.4, 1.4);
    const west = 10 + rng.nextInt(0, 8), east = COLS - 12 - rng.nextInt(0, 8);
    const gapA = 29 + ridge * 5 + rng.nextFloat(-5, 5);
    const gapB = 70 - ridge * 4 + rng.nextFloat(-5, 5);
    for (let col = west; col < east; col++) {
      // Crossings are intentionally staggered: along a channel, then cross
      // and reconverge. Wide ends remain alternate routes around each ridge.
      if (Math.abs(col - gapA) < 3.6 || Math.abs(col - gapB) < 3.2) continue;
      const cy = originY + slope * (col - COLS / 2) + amplitude * Math.sin(col * frequency + phase + ridge * .42);
      const taper = Math.min(1, (col - west + 1) / 5, (east - col) / 5,
        (Math.abs(col - gapA) - 3.6) / 3, (Math.abs(col - gapB) - 3.2) / 3);
      const halfWidth = (2 + .75 * Math.sin(col * .14 + phase + ridge)) * taper;
      for (let row = Math.floor(cy - halfWidth); row <= Math.ceil(cy + halfWidth); row++) {
        if (Math.abs(row - cy) <= halfWidth && clearance(land, col, row, 4)) walls[row * COLS + col] = 1;
      }
    }
  }
}

function formationsOf(walls: Uint8Array): WorldFormation[] {
  return components(walls).map((cells, id) => {
    let cx = 0, cy = 0;
    for (const cell of cells) { cx += cell % COLS; cy += Math.floor(cell / COLS); }
    cx /= cells.length; cy /= cells.length;
    let xx = 0, yy = 0, xy = 0;
    for (const cell of cells) {
      const dx = cell % COLS - cx, dy = Math.floor(cell / COLS) - cy;
      xx += dx * dx; yy += dy * dy; xy += dx * dy;
    }
    return { id, cells, center: { x: (cx + .5) * TILE_SIZE, y: (cy + .5) * TILE_SIZE }, angle: .5 * Math.atan2(2 * xy, xx - yy) };
  });
}

/** Geometry is solely a function of topology and seed, never profile color. */
export function generateWorldSample(profileId: WorldProfileId | string, topologyId: WorldTopologyId, seed: number): WorldSample {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('World seed must be an unsigned 32-bit integer');
  if (topologyId !== 'loops' && topologyId !== 'channels') throw new Error(`Unknown topology: ${topologyId}`);
  const profile = worldProfileById(profileId);
  const land = makeLand(seed);
  const walls = new Uint8Array(land.length);
  const rng = new SeededRandom(splitSeed(seed, topologyId === 'loops' ? 0x2156198d : 0x196319eb));
  if (topologyId === 'loops') stampLoops(walls, land, rng);
  else stampChannels(walls, land, rng);
  // Rasterized tapered tips can leave disconnected one-cell crumbs. They are
  // neither useful cover nor part of the readable landform, so discard them.
  for (const fragment of components(walls)) {
    if (fragment.length < 5) for (const cell of fragment) walls[cell] = 0;
  }
  const floor = Uint8Array.from(land, (value, index) => value && !walls[index] ? 1 : 0);
  const floorParts = components(floor);
  // No inaccessible floor-shaped pockets are presented as playable space.
  for (const pocket of floorParts.slice(1)) for (const cell of pocket) { walls[cell] = 1; floor[cell] = 0; }
  const seats = floorParts[0]!.filter(cell => clearance(floor, cell % COLS, Math.floor(cell / COLS), 2));
  if (seats.length < 2) throw new Error('Map has no clear spawn/extraction seats');
  const nearest = (targetX: number, targetY: number): number => {
    let best = seats[0]!, bestDistance = Infinity;
    for (const cell of seats) {
      const dx = cell % COLS - targetX, dy = Math.floor(cell / COLS) - targetY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) { bestDistance = distance; best = cell; }
    }
    return best;
  };
  const point = (cell: number) => ({ x: (cell % COLS + .5) * TILE_SIZE, y: (Math.floor(cell / COLS) + .5) * TILE_SIZE });
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  const fieldRng = new SeededRandom(splitSeed(seed, 0x891957e1));
  const phase = fieldRng.nextFloat(0, Math.PI * 2), axis = fieldRng.nextFloat(-.7, .7);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const index = row * COLS + col;
    flowAngle[index] = axis + .45 * Math.sin(row * .09 + phase) + .15 * Math.cos(col * .06 + phase);
    deposition[index] = .5 + .24 * Math.sin(col * .077 + row * .04 + phase) + .22 * Math.cos(row * .13 - col * .032 + phase);
  }
  return { profile, topologyId, seed, cols: COLS, rows: ROWS, tileSize: TILE_SIZE, land, walls,
    spawn: point(nearest(25, 55)), exit: point(nearest(87, 19)), formations: formationsOf(walls), flowAngle, deposition };
}
