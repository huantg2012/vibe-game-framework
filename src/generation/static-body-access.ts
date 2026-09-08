/** Player-footprint reachability for permanent floor bodies. Generation only; no Phaser. */
import { GAME_CONSTANTS } from '@/config/constants';
import { BODY_PROFILE_DATA } from '@/generated/contamination-body-data';
import { drawOne } from '@/generation/contamination-draw';
import type { EnemySpawnData, WalkGrid } from '@/types/map-types';
import type { Vector2 } from '@/types/game-types';
import type { SeededRandom } from '@/utils/random';

const SAMPLE_STEP = 4;
const EPSILON = 0.001;
const PLAYER_HALF = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
const BODY_CLEARANCE = PLAYER_HALF + GAME_CONSTANTS.AI.BODY_SIZE / 2;
const STATIC_SUBSTRATES = Object.keys(BODY_PROFILE_DATA).filter((id) => BODY_PROFILE_DATA[id]!.moveScale === 0);

export interface AccessTarget {
  readonly id: string;
  readonly position: Readonly<Vector2>;
  readonly radius: number;
}
export interface StaticBodyAccessInput {
  readonly grid: WalkGrid;
  readonly spawnPoint: Readonly<Vector2>;
  readonly targets: readonly AccessTarget[];
  readonly enemySpawns: readonly EnemySpawnData[];
}
export interface StaticBodyAccessResult {
  readonly reachable: boolean;
  readonly blockedTargetIds: readonly string[];
  readonly sampledPositions: number;
}
export function isStaticFloorBody(spawn: EnemySpawnData): boolean {
  return spawn.form?.occupancy === 'floor' && BODY_PROFILE_DATA[spawn.form.substrate]?.moveScale === 0;
}

/**
 * Axis-aligned 20px bodies use a 40px Minkowski exclusion square. Adjacent free
 * 4px samples are joined by axis-aligned segments: neither a 40px body obstacle
 * nor a tile wall expanded by the player half-width can fit between their ends.
 * Thus a returned route is physically clear; discretization may reject a narrow
 * route conservatively, but cannot authorize walking through an obstacle.
 */
export function checkStaticBodyAccess(input: StaticBodyAccessInput): StaticBodyAccessResult {
  const bodies = input.enemySpawns.filter(isStaticFloorBody);
  if (bodies.length === 0) return { reachable: true, blockedTargetIds: [], sampledPositions: 0 };
  const { grid, spawnPoint, targets } = input;
  const tile = grid.tileSize;
  if (tile < GAME_CONSTANTS.PLAYER.BODY_SIZE || tile % SAMPLE_STEP !== 0) {
    throw new Error('Static body access requires tiles at least player-sized and aligned to navigation samples');
  }
  const width = grid.cols * tile / SAMPLE_STEP + 1;
  const height = grid.rows * tile / SAMPLE_STEP + 1;
  const free = new Uint8Array(width * height);
  const reached = new Uint8Array(free.length);
  const queue = new Int32Array(free.length);
  for (let row = 0; row < height; row++) {
    const y = row * SAMPLE_STEP;
    for (let col = 0; col < width; col++) {
      const x = col * SAMPLE_STEP;
      const left = Math.floor((x - PLAYER_HALF + EPSILON) / tile);
      const right = Math.floor((x + PLAYER_HALF - EPSILON) / tile);
      const top = Math.floor((y - PLAYER_HALF + EPSILON) / tile);
      const bottom = Math.floor((y + PLAYER_HALF - EPSILON) / tile);
      if (!grid.isWalkable(left, top) || !grid.isWalkable(right, top) || !grid.isWalkable(left, bottom) || !grid.isWalkable(right, bottom)) continue;
      let blocked = false;
      for (const body of bodies) {
        const bx = (body.spawn.col + 0.5) * tile;
        const by = (body.spawn.row + 0.5) * tile;
        if (Math.abs(x - bx) < BODY_CLEARANCE - EPSILON && Math.abs(y - by) < BODY_CLEARANCE - EPSILON) { blocked = true; break; }
      }
      if (!blocked) free[row * width + col] = 1;
    }
  }
  const startCol = spawnPoint.x / SAMPLE_STEP, startRow = spawnPoint.y / SAMPLE_STEP;
  const start = startRow * width + startCol;
  // Production spawn points are tile centers. Reject an unaligned endpoint;
  // rounding it would claim an unchecked segment from the true player position.
  if (!Number.isInteger(startCol) || !Number.isInteger(startRow) || !free[start]) {
    return { reachable: false, blockedTargetIds: targets.map((target) => target.id), sampledPositions: free.length };
  }
  let head = 0, tail = 1;
  queue[0] = start; reached[start] = 1;
  const enqueue = (index: number): void => {
    if (index >= 0 && index < free.length && free[index] && !reached[index]) { reached[index] = 1; queue[tail++] = index; }
  };
  while (head < tail) {
    const index = queue[head++]!;
    const col = index % width;
    if (col > 0) enqueue(index - 1);
    if (col + 1 < width) enqueue(index + 1);
    enqueue(index - width); enqueue(index + width);
  }
  const blockedTargetIds: string[] = [];
  for (const target of targets) {
    let reachable = false;
    const minCol = Math.max(0, Math.ceil((target.position.x - target.radius) / SAMPLE_STEP));
    const maxCol = Math.min(width - 1, Math.floor((target.position.x + target.radius) / SAMPLE_STEP));
    const minRow = Math.max(0, Math.ceil((target.position.y - target.radius) / SAMPLE_STEP));
    const maxRow = Math.min(height - 1, Math.floor((target.position.y + target.radius) / SAMPLE_STEP));
    for (let row = minRow; row <= maxRow && !reachable; row++) for (let col = minCol; col <= maxCol && !reachable; col++) {
      if (reached[row * width + col] && (col * SAMPLE_STEP - target.position.x) ** 2 + (row * SAMPLE_STEP - target.position.y) ** 2 <= target.radius ** 2) reachable = true;
    }
    if (!reachable) blockedTargetIds.push(target.id);
  }
  return { reachable: blockedTargetIds.length === 0, blockedTargetIds, sampledPositions: free.length };
}

/** Keep the chosen seat and encounter axes; redraw candidates before selection. */
export function ensureStaticBodyAccess(
  input: StaticBodyAccessInput,
  rng: SeededRandom,
  fragmentTypeId: string,
): readonly EnemySpawnData[] | null {
  if (checkStaticBodyAccess(input).reachable) return input.enemySpawns;
  const corrected = [...input.enemySpawns];
  for (let i = 0; i < corrected.length; i++) {
    const spawn = corrected[i]!;
    if (!isStaticFloorBody(spawn)) continue;
    const previous = spawn.form!;
    const options = {
      portfolio: previous.portfolio, fragmentTypeId,
      coverage: previous.coverage, sense: previous.lexemes.sense, rhythm: previous.lexemes.rhythm,
      forbidSubstrate: STATIC_SUBSTRATES,
    };
    const form = drawOne(rng, { ...options, forbidMotion: ['motion_patrol'] })
      ?? drawOne(rng, { ...options, motion: 'motion_patrol' });
    if (!form) return null;
    corrected[i] = { ...spawn, form };
    if (checkStaticBodyAccess({ ...input, enemySpawns: corrected }).reachable) return corrected;
  }
  return null;
}
