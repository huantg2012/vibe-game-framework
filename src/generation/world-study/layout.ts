import { SeededRandom } from '@/utils/random';
import { worldProfileById } from './profiles';
import type { WorldFormation, WorldProfile, WorldProfileId, WorldSample, WorldTopologyId } from './types';
import { erodeOpenLand } from './open-space';
import { evaluateOpenSpace, type SpaceQuality } from './space-quality';
import { spaceProfileForTopology, validateSpaceProfile, type SpaceProfile } from './space-profile';

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

export interface SpaceDiagnostics {
  readonly space: SpaceProfile;
  readonly attempt: number;
  readonly pits: number;
  readonly fractures: number;
  readonly quality: SpaceQuality;
}
const diagnostics = new WeakMap<WorldSample, SpaceDiagnostics>();
export function worldSpaceDiagnostics(sample: WorldSample): SpaceDiagnostics | undefined { return diagnostics.get(sample); }
export const MAX_SPACE_ATTEMPTS = 12;

/** Geometry depends on numeric space controls and seed, never visual identity. */
export function generateWorldSample(profileId: WorldProfileId | string | WorldProfile, topologyId: WorldTopologyId, seed: number,
  spaceProfile?: SpaceProfile): WorldSample {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('World seed must be an unsigned 32-bit integer');
  if (topologyId !== 'loops' && topologyId !== 'channels') throw new Error(`Unknown topology: ${topologyId}`);
  const profile = typeof profileId === 'string' ? worldProfileById(profileId) : profileId;
  const space = spaceProfile ?? spaceProfileForTopology(topologyId);
  validateSpaceProfile(space);
  const land = makeLand(seed);
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  const fieldRng = new SeededRandom(splitSeed(seed, 0x891957e1));
  const phase = fieldRng.nextFloat(0, Math.PI * 2), axis = fieldRng.nextFloat(-.7, .7);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const index = row * COLS + col;
    flowAngle[index] = axis + .45 * Math.sin(row * .09 + phase) + .15 * Math.cos(col * .06 + phase);
    deposition[index] = .5 + .24 * Math.sin(col * .077 + row * .04 + phase) + .22 * Math.cos(row * .13 - col * .032 + phase);
  }
  let reason = 'No erosion candidate';
  for (let attempt = 0; attempt < MAX_SPACE_ATTEMPTS; attempt++) {
    const rng = new SeededRandom(splitSeed(seed, 0x2156198d + attempt * 0x9e3779b1));
    const erosion = erodeOpenLand(land, COLS, ROWS, rng, space), walls = erosion.walls;
    if (erosion.actualFraction < space.voidFraction * .85) { reason = 'Requested erosion density could not fit broad spacing'; continue; }
    const floor = Uint8Array.from(land, (value, index) => value && !walls[index] ? 1 : 0);
    const seats: number[] = [];
    for (let cell = 0; cell < floor.length; cell++)
      if (floor[cell] && clearance(floor, cell % COLS, Math.floor(cell / COLS), 2)) seats.push(cell);
    if (seats.length < 2) { reason = 'No broad spawn/exit seats'; continue; }
    const nearest = (targetX: number, targetY: number): number => {
      let best = seats[0]!, bestDistance = Infinity;
      for (const cell of seats) {
        const dx = cell % COLS - targetX, dy = Math.floor(cell / COLS) - targetY, distance = dx * dx + dy * dy;
        if (distance < bestDistance) { bestDistance = distance; best = cell; }
      }
      return best;
    };
    const point = (cell: number) => ({ x: (cell % COLS + .5) * TILE_SIZE, y: (Math.floor(cell / COLS) + .5) * TILE_SIZE });
    const sample: WorldSample = { profile, topologyId, seed, cols: COLS, rows: ROWS, tileSize: TILE_SIZE, land, walls,
      spawn: point(nearest(25, 55)), exit: point(nearest(87, 19)), formations: formationsOf(walls), flowAngle, deposition };
    const quality = evaluateOpenSpace(sample);
    if (!quality.accepted) { reason = quality.failures.join('; '); continue; }
    diagnostics.set(sample, { space, attempt, pits: erosion.pits, fractures: erosion.fractures, quality });
    return sample;
  }
  throw new Error(`Open-space generation rejected after ${MAX_SPACE_ATTEMPTS} bounded attempts (${space.id}, seed ${seed}): ${reason}`);
}
