/**
 * Practice-field live motion + contact channels (R2-C2 / DEC-080).
 * Pure. No Phaser. No collision writes.
 *
 * Callers must gate on `gymLiveMotion === true`. Sortie ticks never import
 * these steppers — that is the frame-identity contract.
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import type { CorridorAabb } from '@/generation/types';
import {
  wallAttachForTile,
  type FormWallAttach,
  type WallTile,
} from '@/generation/wall-edge-path';
import {
  LEXEME_DATA,
  PORTFOLIO_DATA,
  STOP_LOSS_DATA,
  type ContinuityId,
  type CoverageId,
  type OccupancyId,
  type PortfolioId,
  type StopLossCorePolicy,
  type StopLossFamily,
} from '@/generated/contamination-lexicon-data';
import type { Vector2 } from '@/types/game-types';

/** Slow crawl along the wall skin. Not a combat price. Gym only. */
export const YI_ROAM_PX_PER_SEC = 12;
/** motion_turn extra reverse, so 转面 is not the same as 沿壁 ping-pong. */
export const YI_TURN_REVERSE_MS = 4500;
/** Cloud drift / morph. Gym only. Must stay too slow to read as a chase. */
export const DING_DRIFT_PX = 36;
export const DING_MORPH_PX = 14;

export type ContactChannel =
  | 'melee_hp'
  | 'adjacent_hp'
  | 'step_chaos'
  | 'volume_chaos_sight'
  | 'none';

export interface StopLossProfile {
  readonly family: StopLossFamily;
  readonly corePolicy: StopLossCorePolicy;
  readonly hittable: boolean;
}

export type Facing4 = 'up' | 'down' | 'left' | 'right';

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface YiWalkState {
  readonly segment: readonly WallTile[];
  along: number;
  dir: 1 | -1;
  turnAccumMs: number;
}

function tileKey(tile: WallTile): string {
  return `${tile.col},${tile.row}`;
}

function isFourAdjacent(a: WallTile, b: WallTile): boolean {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
}

/**
 * Split an ordered wall walk on 4-adjacency breaks.
 * `orderWallEdgeTiles` concatenates components; a non-adjacent pair is a
 * segment boundary — never lerp across it.
 */
export function splitWalkSegments(ordered: readonly WallTile[]): WallTile[][] {
  if (ordered.length === 0) return [];
  const segs: WallTile[][] = [];
  let cur: WallTile[] = [ordered[0]!];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const next = ordered[i]!;
    if (isFourAdjacent(prev, next)) cur.push(next);
    else {
      segs.push(cur);
      cur = [next];
    }
  }
  segs.push(cur);
  return segs;
}

export function segmentContaining(
  segments: readonly (readonly WallTile[])[],
  tile: WallTile,
): readonly WallTile[] | null {
  const id = tileKey(tile);
  for (const seg of segments) {
    if (seg.some((t) => tileKey(t) === id)) return seg;
  }
  return null;
}

export function strikeFloorsAt(
  tile: WallTile,
  universe: readonly WallTile[],
): WallTile[] {
  const want = new Set([
    tileKey({ col: tile.col + 1, row: tile.row }),
    tileKey({ col: tile.col - 1, row: tile.row }),
    tileKey({ col: tile.col, row: tile.row + 1 }),
    tileKey({ col: tile.col, row: tile.row - 1 }),
  ]);
  return universe.filter((f) => want.has(tileKey(f)));
}

export function facingFromAttach(attach: FormWallAttach): Facing4 {
  if (attach.face === 'n') return 'up';
  if (attach.face === 's') return 'down';
  if (attach.face === 'e') return 'right';
  return 'left';
}

function yiMode(motion: string): 'wall' | 'turn' | 'anchor' {
  if (motion === 'motion_wall') return 'wall';
  if (motion === 'motion_turn') return 'turn';
  return 'anchor';
}

function dingMode(motion: string): 'wind' | 'trail' | 'anchor' {
  if (motion === 'motion_wind') return 'wind';
  if (motion === 'motion_trail') return 'trail';
  return 'anchor';
}

function cyclicSegment(segment: readonly WallTile[]): boolean {
  return segment.length > 2 && isFourAdjacent(segment[0]!, segment[segment.length - 1]!);
}

export interface YiWalkResult {
  readonly along: number;
  readonly dir: 1 | -1;
  readonly turnAccumMs: number;
  readonly tile: WallTile;
  readonly core: Vector2;
  readonly strikeFloors: readonly WallTile[];
  readonly moving: boolean;
  readonly attach: FormWallAttach;
}

/**
 * Advance 乙 along one 4-connected segment. Speed follows `lexemes.motion`:
 * 沿壁 walks, 固着 stays, 转面 walks and may reverse.
 */
export function stepYiWalk(
  walk: YiWalkState,
  motion: string,
  dtMs: number,
  tileSize: number,
  floorUniverse: readonly WallTile[],
): YiWalkResult {
  const segment = walk.segment;
  const n = segment.length;
  const start = segment[0] ?? { col: 0, row: 0 };
  const mode = yiMode(motion);
  let along = walk.along;
  let dir: 1 | -1 = walk.dir;
  let turnAccumMs = walk.turnAccumMs;

  const moving = mode !== 'anchor' && n > 1;
  if (moving) {
    if (mode === 'turn') {
      turnAccumMs += dtMs;
      if (turnAccumMs >= YI_TURN_REVERSE_MS) {
        turnAccumMs -= YI_TURN_REVERSE_MS;
        dir = dir === 1 ? -1 : 1;
      }
    }
    const speedTiles = YI_ROAM_PX_PER_SEC / tileSize;
    along += dir * speedTiles * (dtMs / 1000);
    const loop = mode === 'wall' && cyclicSegment(segment);
    if (loop) {
      const len = n;
      along = ((along % len) + len) % len;
    } else {
      const max = Math.max(0, n - 1);
      let guard = 0;
      while (guard++ < 8) {
        if (along > max) {
          along = max - (along - max);
          dir = -1;
        } else if (along < 0) {
          along = -along;
          dir = 1;
        } else break;
        if (max === 0) {
          along = 0;
          break;
        }
      }
      along = Math.max(0, Math.min(max, along));
    }
  }

  const loop = mode === 'wall' && cyclicSegment(segment);
  const max = Math.max(0, n - 1);
  const i0 = n === 0 ? 0 : loop ? Math.floor(along) % n : Math.min(max, Math.floor(along));
  const frac = n === 0 ? 0 : along - Math.floor(along);
  const i1 = n === 0 ? 0 : loop ? (i0 + 1) % n : Math.min(max, i0 + 1);
  const t0 = segment[i0] ?? start;
  const t1 = segment[i1] ?? t0;
  const a0 = wallAttachForTile(t0, floorUniverse, tileSize);
  const a1 = wallAttachForTile(t1, floorUniverse, tileSize);
  const tile = frac < 0.5 ? t0 : t1;
  const local = strikeFloorsAt(tile, floorUniverse);
  return {
    along,
    dir,
    turnAccumMs,
    tile,
    core: {
      x: a0.seamX + (a1.seamX - a0.seamX) * frac,
      y: a0.seamY + (a1.seamY - a0.seamY) * frac,
    },
    strikeFloors: local.length > 0 ? local : strikeFloorsAt(t0, floorUniverse),
    moving,
    attach: frac < 0.5 ? a0 : a1,
  };
}

export function aabbPixelRect(box: CorridorAabb, tileSize: number): PixelRect {
  return {
    x: box.minCol * tileSize,
    y: box.minRow * tileSize,
    w: (box.maxCol - box.minCol + 1) * tileSize,
    h: (box.maxRow - box.minRow + 1) * tileSize,
  };
}

export function pointInRect(pos: Readonly<Vector2>, rect: PixelRect): boolean {
  return pos.x >= rect.x && pos.x < rect.x + rect.w && pos.y >= rect.y && pos.y < rect.y + rect.h;
}

/**
 * Current 丁 cloud. `motion_anchor` morphs in place; wind / trail also translate.
 * Never writes tiles. Hazard callers must use this rect, not the birth AABB.
 */
export function dingLiveRect(
  home: CorridorAabb,
  motion: string,
  elapsedMs: number,
  tileSize: number,
): PixelRect {
  const base = aabbPixelRect(home, tileSize);
  const t = elapsedMs / 1000;
  const mode = dingMode(motion);
  const morphW = Math.sin(t * 0.35) * DING_MORPH_PX;
  const morphH = Math.cos(t * 0.41) * DING_MORPH_PX;
  let ox = 0;
  let oy = 0;
  if (mode === 'wind') {
    ox = Math.sin(t * 0.22) * DING_DRIFT_PX;
    oy = Math.cos(t * 0.17) * DING_DRIFT_PX * 0.65;
  } else if (mode === 'trail') {
    if (base.w >= base.h) ox = Math.sin(t * 0.18) * DING_DRIFT_PX * 1.15;
    else oy = Math.sin(t * 0.18) * DING_DRIFT_PX * 1.15;
  }
  let w = base.w + morphW;
  let h = base.h + morphH;
  if (mode === 'trail') {
    if (base.w >= base.h) {
      w += Math.abs(morphW) * 0.5;
      h -= Math.abs(morphH) * 0.35;
    } else {
      h += Math.abs(morphH) * 0.5;
      w -= Math.abs(morphW) * 0.35;
    }
  }
  w = Math.max(tileSize * 2, w);
  h = Math.max(tileSize * 2, h);
  return {
    x: base.x + ox + (base.w - w) / 2,
    y: base.y + oy + (base.h - h) / 2,
    w,
    h,
  };
}

export function rectCenter(rect: PixelRect): Vector2 {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/**
 * Spec 接触词素对照表. Caller must pass `form.lexemes.contact` (the actual
 * field read). Illegal with rewrite_to → rewritten lexeme. Illegal with no
 * rewrite → none (no new DPS). 丁 never returns melee_hp / adjacent_hp.
 */
export function resolveContactChannel(
  portfolio: PortfolioId,
  contactId: string,
): ContactChannel {
  const def = LEXEME_DATA[contactId];
  let id = contactId;
  if (def && !def.legalPortfolios.includes(portfolio)) {
    const rewritten = def.rewrites.find((row) => row.portfolio === portfolio);
    if (rewritten) id = rewritten.lexeme;
    else return 'none';
  }
  if (id === 'contact_melee_three') return portfolio === 'jia' ? 'melee_hp' : 'none';
  if (id === 'contact_adjacent_strike') return portfolio === 'yi' ? 'adjacent_hp' : 'none';
  if (id === 'contact_step_chaos') return portfolio === 'bing' ? 'step_chaos' : 'none';
  if (id === 'contact_volume_chaos') return portfolio === 'ding' ? 'volume_chaos_sight' : 'none';
  return 'none';
}

/**
 * Stop-loss is derived from continuity × coverage (DEC-083). Not a fifth lexeme.
 * Leftovers follow the spec remnant table (occupancy × family); do not invent extras.
 */
export function resolveStopLoss(form: {
  continuity: ContinuityId;
  coverage: CoverageId;
  occupancy: OccupancyId;
  portfolio: PortfolioId;
}): StopLossProfile | 'illegal' {
  const row = STOP_LOSS_DATA[`${form.continuity}_${form.coverage}`];
  if (!row) return 'illegal';
  if (!row.legalOccupancies.includes(form.occupancy)) return 'illegal';
  if (PORTFOLIO_DATA[form.portfolio].blockWalk && row.family === 'unkillable') return 'illegal';
  return {
    family: row.family,
    corePolicy: row.corePolicy,
    hittable: row.family !== 'unkillable',
  };
}

/** Strike-core size. `none` → 0 (do not paint a hittable core). */
export function coreMarkPx(policy: StopLossCorePolicy, standard: number): number {
  if (policy === 'none') return 0;
  if (policy === 'exposed') return standard + 1;
  if (policy === 'obscured') return Math.max(1, standard - 1);
  return standard;
}

export function chebyshevTiles(
  a: { readonly col: number; readonly row: number },
  b: { readonly col: number; readonly row: number },
): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** 2–3 seats, gap ≥ minGap (fallback 2). Gym one-blob uses count=2. */
export function colonyNucleusSeats(
  origin: { readonly col: number; readonly row: number },
  count: number,
  minGap: number,
): { col: number; row: number }[] {
  const n = Math.max(2, Math.min(3, count));
  const gap = Math.max(2, minGap);
  const offsets = [
    { col: 0, row: 0 },
    { col: gap, row: 0 },
    { col: 0, row: -gap },
  ];
  return offsets.slice(0, n).map((o) => ({ col: origin.col + o.col, row: origin.row + o.row }));
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`contamination-host-live self-check: ${msg}`);
}

function stubForm(
  portfolio: PortfolioId,
  contact: string,
  extras?: {
    continuity?: ContinuityId;
    coverage?: CoverageId;
    occupancy?: OccupancyId;
  },
): ContaminationForm {
  const occupancy =
    extras?.occupancy ??
    (portfolio === 'jia' ? 'floor' : portfolio === 'yi' ? 'wall' : portfolio === 'bing' ? 'paint' : 'volume');
  const continuity =
    extras?.continuity ??
    (portfolio === 'jia' || portfolio === 'yi' ? 'monolith' : portfolio === 'bing' ? 'colony' : 'field');
  return {
    substrate: 'wall_rust',
    coverage: extras?.coverage ?? 'infiltrate',
    continuity,
    occupancy,
    portfolio,
    lexemes: {
      motion: 'motion_anchor',
      sense: 'sense_touch',
      rhythm: 'rhythm_open',
      contact,
    },
  };
}

/** Machine asserts for the contact table + roam/morph invariants. */
export function selfCheckHostLive(): void {
  const cases: readonly [PortfolioId, string, ContactChannel][] = [
    ['jia', 'contact_melee_three', 'melee_hp'],
    ['yi', 'contact_adjacent_strike', 'adjacent_hp'],
    ['yi', 'contact_melee_three', 'adjacent_hp'],
    ['bing', 'contact_step_chaos', 'step_chaos'],
    ['bing', 'contact_melee_three', 'step_chaos'],
    ['ding', 'contact_volume_chaos', 'volume_chaos_sight'],
    ['ding', 'contact_melee_three', 'volume_chaos_sight'],
    ['ding', 'contact_adjacent_strike', 'none'],
    ['yi', 'contact_step_chaos', 'none'],
  ];
  for (const [portfolio, contact, channel] of cases) {
    const form = stubForm(portfolio, contact);
    assert(
      resolveContactChannel(form.portfolio, form.lexemes.contact) === channel,
      `${portfolio} ${contact} → ${channel}`,
    );
  }

  const jiaStop = resolveStopLoss(
    stubForm('jia', 'contact_melee_three', { continuity: 'monolith', coverage: 'infiltrate' }),
  );
  assert(
    jiaStop !== 'illegal' && jiaStop.family === 'core_strike' && jiaStop.corePolicy === 'exposed' && jiaStop.hittable,
    'jia monolith infiltrate',
  );
  const bingColony = resolveStopLoss(
    stubForm('bing', 'contact_step_chaos', { continuity: 'colony', coverage: 'rewrite' }),
  );
  assert(bingColony !== 'illegal' && bingColony.family === 'scatter_rejoin', 'bing colony rewrite');
  for (const coverage of ['infiltrate', 'rewrite', 'overwrite'] as const) {
    const field = resolveStopLoss(stubForm('bing', 'contact_step_chaos', { continuity: 'field', coverage }));
    assert(field !== 'illegal' && field.family === 'unkillable' && !field.hittable, `bing field ${coverage}`);
  }
  const dingField = resolveStopLoss(stubForm('ding', 'contact_volume_chaos', { continuity: 'field' }));
  assert(dingField !== 'illegal' && dingField.family === 'unkillable' && !dingField.hittable, 'ding field');
  const dingMono = resolveStopLoss(stubForm('ding', 'contact_volume_chaos', { continuity: 'monolith' }));
  assert(dingMono !== 'illegal' && dingMono.family === 'core_strike' && dingMono.hittable, 'ding monolith');
  assert(
    resolveStopLoss(stubForm('jia', 'contact_melee_three', { continuity: 'field', occupancy: 'floor' })) === 'illegal',
    'jia must not be unkillable',
  );
  assert(
    resolveStopLoss(stubForm('jia', 'contact_melee_three', { continuity: 'shards' })) === 'illegal',
    'shards has no stop-loss row',
  );
  const seats = colonyNucleusSeats({ col: 12, row: 11 }, 2, 3);
  assert(seats.length === 2, 'colony seats 2');
  assert(chebyshevTiles(seats[0]!, seats[1]!) >= 3, 'colony gap ≥ 3');

  const two = [
    { col: 0, row: 0 },
    { col: 0, row: 1 },
    { col: 8, row: 3 },
    { col: 9, row: 3 },
  ];
  const segs = splitWalkSegments(two);
  assert(segs.length === 2, 'two segments');
  assert(segs[0]!.length === 2 && segs[1]!.length === 2, 'segment sizes');
  assert(!isFourAdjacent(two[1]!, two[2]!), 'break is not adjacent');

  const line = [
    { col: 9, row: 4 },
    { col: 9, row: 5 },
    { col: 9, row: 6 },
  ];
  const floors = [
    { col: 10, row: 4 },
    { col: 10, row: 5 },
    { col: 10, row: 6 },
  ];
  const walked = stepYiWalk(
    { segment: line, along: 0, dir: 1, turnAccumMs: 0 },
    'motion_wall',
    1000,
    32,
    floors,
  );
  assert(walked.along > 0.3 && walked.along < 0.5, `wall advances slowly (along=${walked.along})`);
  assert(walked.tile.col === 9 && walked.tile.row === 4, 'still on first tile at 1s');
  assert(walked.strikeFloors.length === 1 && walked.strikeFloors[0]!.row === 4, 'strike follows current tile');
  assert(walked.core.y > 144 && walked.core.y < 176, 'seam lerps');

  const anchored = stepYiWalk(
    { segment: line, along: 1, dir: 1, turnAccumMs: 0 },
    'motion_anchor',
    1000,
    32,
    floors,
  );
  assert(anchored.along === 1 && !anchored.moving, 'anchor does not walk');

  const home: CorridorAabb = {
    minCol: 12,
    minRow: 3,
    maxCol: 17,
    maxRow: 8,
    coreCol: 14,
    coreRow: 5,
  };
  const a0 = dingLiveRect(home, 'motion_anchor', 0, 32);
  const a1 = dingLiveRect(home, 'motion_anchor', 4000, 32);
  const c0 = rectCenter(a0);
  const c1 = rectCenter(a1);
  assert(Math.abs(c0.x - c1.x) < 0.01 && Math.abs(c0.y - c1.y) < 0.01, 'anchor morphs in place');
  assert(Math.abs(a0.w - a1.w) > 1 || Math.abs(a0.h - a1.h) > 1, 'anchor still morphs');

  const w0 = dingLiveRect(home, 'motion_wind', 0, 32);
  const w1 = dingLiveRect(home, 'motion_wind', 4000, 32);
  const wc0 = rectCenter(w0);
  const wc1 = rectCenter(w1);
  assert(Math.hypot(wc1.x - wc0.x, wc1.y - wc0.y) > 8, 'wind translates');

  const tr = dingLiveRect(home, 'motion_trail', 2500, 32);
  assert(tr.w > 0 && tr.h > 0, 'trail has area');
}
