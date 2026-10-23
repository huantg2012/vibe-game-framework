/** Native Host admission on the same 8px physical floor as the R100 fixtures.
 * The 32px map serves Host contact/painting only, never player collision. */
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '@/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import type { ContaminationPins, CorridorAabb } from '@/generation/types';
import type { PollutionGradeDefinition } from '@/generation/world-study/pollution-grade';
import type { TileGrid } from '@/systems/tile-grid';
import { bodyDisplacementFraction } from '@/systems/ai/physical-grid';
import { GAME_CONSTANTS } from '@/config/constants';
import {colonyNucleusSeatsInFloors,resolveStopLoss} from '@/systems/contamination-host-live';
import type { R100SpatialDeploymentPolicy } from './r100-spatial-deployment';
import type { TileMapData } from '@/types/map-types';
import { TileType, type Vector2 } from '@/types/game-types';

export interface MasterPollution {
  readonly hostTileMap: TileMapData;
  readonly forms: readonly ContaminationForm[];
  readonly pins: ContaminationPins;
  readonly paintCells: readonly Readonly<Vector2>[];
  readonly volumes: readonly CorridorAabb[];
  readonly safeRoute: readonly Readonly<Vector2>[];
  readonly paintAreaPx: number;
  readonly volumeAreaPx: number;
}
const TILE = 32;
export function createMasterPollution(grade: PollutionGradeDefinition, seed: number, grid: TileGrid,
  reachable: Uint8Array, start: number, targets: readonly Readonly<Vector2>[], spatial?: R100SpatialDeploymentPolicy, frozenPaintForm?: ContaminationForm): MasterPollution {
  const cols = grid.cols * grid.tileSize / TILE, rows = grid.rows * grid.tileSize / TILE;
  const scale = TILE / grid.tileSize;
  const tiles = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++)
      if (!grid.isWalkable(col * scale + x, row * scale + y)) return TileType.VOID;
    return TileType.FLOOR;
  }));
  const hostTileMap: TileMapData = { cols, rows, tileSize: TILE, tiles };
  const isFloor = (col: number, row: number): boolean => tiles[row]?.[col] === TileType.FLOOR;
  const fineCell = (p: Readonly<Vector2>): number => Math.floor(p.y / grid.tileSize) * grid.cols + Math.floor(p.x / grid.tileSize);
  const fineCenter = (cell: number): Vector2 => ({ x: (cell % grid.cols + .5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + .5) * grid.tileSize });
  // Protect one honest walking route to the loot and extraction. Other routes
  // can cross pollution; none is a compulsory toll on entering or retreating.
  const parents = new Int32Array(reachable.length).fill(-1), approach = new Float64Array(reachable.length).fill(Infinity), queue = [start]; parents[start] = start; approach[start] = 0;
  for (let at = 0; at < queue.length; at++) {
    const cell = queue[at]!;
    for (const next of [cell - 1, cell + 1, cell - grid.cols, cell + grid.cols]) {
      if (!reachable[next] || parents[next] !== -1 || (Math.abs(next - cell) === 1 && Math.floor(next / grid.cols) !== Math.floor(cell / grid.cols))) continue;
      if (spatial) {
        const point = fineCenter(cell), to = fineCenter(next), half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
        if (bodyDisplacementFraction(grid, point, half, half, to.x - point.x, to.y - point.y) < 1) continue;
      }
      parents[next] = cell; approach[next] = approach[cell]! + grid.tileSize; queue.push(next);
    }
  }
  const protectedCells = new Set<number>();
  for (const target of targets) {
    let cell = fineCell(target);
    if (parents[cell] === -1) throw new Error('A protected R100 pollution route is unreachable');
    while (cell !== start) { protectedCells.add(cell); cell = parents[cell]!; }
  }
  protectedCells.add(start);
  const safeRoute = [...protectedCells].map(fineCenter);
  const forbidden = new Set<number>();
  for (const point of safeRoute) {
    // Body width20px + 8px clearance on each side; cell overlap is conservative.
    for (let row = Math.floor((point.y - 18) / TILE); row <= Math.floor((point.y + 18) / TILE); row++)
      for (let col = Math.floor((point.x - 18) / TILE); col <= Math.floor((point.x + 18) / TILE); col++) forbidden.add(row * cols + col);
  }
  const spawn = fineCenter(start), anchors = [spawn, ...targets];
  const blocked = (col: number, row: number): boolean => forbidden.has(row * cols + col)
    || anchors.some((anchor, index) => Math.hypot((col + .5) * TILE - anchor.x, (row + .5) * TILE - anchor.y) < (index === 0 ? 80 : 40));
  const candidates: { col: number; row: number }[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (isFloor(col, row)
    && reachable[fineCell({ x: (col + .5) * TILE, y: (row + .5) * TILE })]) candidates.push({ col, row });

  const approachAt = (col: number, row: number): number => approach[fineCell({ x: col * TILE, y: row * TILE })]!;
  const regionAt = (col: number, row: number): number => spatial
    ? Math.min(spatial.host_region_cols - 1, Math.floor(col / cols * spatial.host_region_cols))
      + Math.min(spatial.host_region_rows - 1, Math.floor(row / rows * spatial.host_region_rows)) * spatial.host_region_cols : 0;
  const spatialHostScore = (col: number, row: number, slot: number, count: number, kind: string,
    placed: readonly { readonly col: number; readonly row: number }[]): number => {
    if (!spatial) return 0;
    const distance = approachAt(col, row);
    if (!Number.isFinite(distance) || distance < spatial.host_min_approach_px || distance > spatial.host_max_approach_px) return -Infinity;
    const jitter = mix32(seed, `spatial-${kind}-depth-${slot}`) / 0x100000000;
    const target = spatial.host_min_approach_px + (slot + .25 + jitter * .5) / count
      * (spatial.host_max_approach_px - spatial.host_min_approach_px);
    const spread = placed.length ? Math.min(600, ...placed.map(seat => Math.hypot(col - seat.col, row - seat.row) * TILE)) : 0;
    const occupiedRegion = placed.some(seat => regionAt(col, row) === regionAt(seat.col, seat.row));
    return -Math.abs(distance - target) * .6 + spread * .35 - Number(occupiedRegion) * 240
      + mix32(seed, `spatial-${kind}-${slot}-${col}-${row}`) / 0x100000000 * 80;
  };

  const forms: ContaminationForm[] = [], paintFloors: ContaminationPins['paintFloors'][number][] = [];
  const occupiedPaint = new Set<number>();
  type Seat = { col: number; row: number; danger: readonly number[] };
  const paintRequests: { form: ContaminationForm; seats: Seat[] }[] = [];
  for (let slot = 0; slot < grade.paintCount; slot++) {
    const form: ContaminationForm = frozenPaintForm ?? { substrate: grade.paintSubstrate, coverage: grade.paintCoverage,
      continuity: grade.paintContinuity, occupancy: 'paint', portfolio: 'bing',
      lexemes: { motion: 'motion_anchor', sense: 'sense_domain', rhythm: 'rhythm_open', contact: 'contact_step_chaos' } };
    const hostSeed = mix32(seed, `ENM_BING_${String(slot + 1).padStart(2, '0')}`);
    const baked = bakePaintGenome({ ...form, seed: hostSeed, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
      fragmentTypeId: 'frag-outdoor', veinVariant: resolvePaintVeinVariant(form.substrate, hostSeed), geometryVersion: 2 });
    const cells = (field: Float32Array) => collectPaintGenomeFloorTiles(field, baked.canvasW, baked.canvasH, TILE / 2, TILE / 2, TILE);
    const support = cells(baked.terrainFootprintField), danger = cells(baked.field);
    if(frozenPaintForm){
      const stop=resolveStopLoss(form),config=GAME_CONSTANTS.CONTAMINATION;
      if(stop==='illegal'||!danger.length)throw new Error(`${grade.id}: frozen paint form has no legal Host surface`);
      if(stop.family==='scatter_rejoin'&&colonyNucleusSeatsInFloors(danger,config.COLONY_NUCLEUS_COUNT_MIN,
        config.COLONY_NUCLEUS_COUNT_MAX,config.COLONY_NUCLEUS_MIN_TILE_GAP,2).length<config.COLONY_NUCLEUS_COUNT_MIN)
        throw new Error(`${grade.id}: frozen paint form cannot preserve its colony nucleus quota`);
    }
    const seats = candidates.filter(seat => support.every(offset => isFloor(seat.col + offset.col, seat.row + offset.row))
      && danger.every(offset => !blocked(seat.col + offset.col, seat.row + offset.row)))
      .map(seat => ({ ...seat, danger: danger.map(offset => (seat.row + offset.row) * cols + seat.col + offset.col) }));
    if (!seats.length) throw new Error(`${grade.id}: no complete native paint footprint for Host ${slot + 1}`);
    paintRequests.push({ form, seats });
  }
  const chosen: (Seat | null)[] = Array.from({ length: grade.paintCount }, () => null);
  let attempts = 0;
  function placePaint(remaining: number): boolean {
    if (remaining === 0) return true;
    if (++attempts > 20000) return false;
    let slot = -1, allowed: Seat[] = [];
    for (let index = 0; index < chosen.length; index++) {
      if (chosen[index]) continue;
      const seats = paintRequests[index]!.seats.filter(seat => seat.danger.every(cell => !occupiedPaint.has(cell)));
      if (!seats.length) return false;
      if (slot === -1 || seats.length < allowed.length) { slot = index; allowed = seats; }
    }
    const score = (seat: Seat): number => {
      const x = (seat.col + .5) * TILE, y = (seat.row + .5) * TILE;
      const placed = chosen.filter((p): p is Seat => p !== null);
      if (spatial) return spatialHostScore(seat.col + .5, seat.row + .5, slot, grade.paintCount, 'paint', placed.map(p => ({ col: p.col + .5, row: p.row + .5 })));
      if (!placed.length) return -Math.abs(Math.hypot(x - spawn.x, y - spawn.y) - 160);
      return Math.min(...placed.map(p => Math.hypot(seat.col - p.col, seat.row - p.row))) * TILE
        - Math.abs(Math.hypot(x - spawn.x, y - spawn.y) - 250) * .14;
    };
    allowed.sort((a, b) => score(b) - score(a) || a.row - b.row || a.col - b.col);
    for (const seat of allowed) {
      if (spatial && !Number.isFinite(score(seat))) continue;
      chosen[slot] = seat;
      for (const cell of seat.danger) occupiedPaint.add(cell);
      if (placePaint(remaining - 1)) return true;
      for (const cell of seat.danger) occupiedPaint.delete(cell);
      chosen[slot] = null;
    }
    return false;
  }
  if (!placePaint(grade.paintCount)) throw new Error(`${grade.id}: complete native paint quota cannot fit without blocking the safe route`);
  for (let slot = 0; slot < chosen.length; slot++) {
    const seat = chosen[slot]!;
    paintFloors.push({ floorCol: seat.col, floorRow: seat.row, onGreedy: false, throatScore: 0 });
    forms.push(paintRequests[slot]!.form);
  }
  const volumes: CorridorAabb[] = [], volumeCells = new Set<number>();
  for (let slot = 0; slot < grade.volumeCount; slot++) {
    const allowed = candidates.filter(seat => {
      for (let row = seat.row; row < seat.row + grade.volumeRows; row++) for (let col = seat.col; col < seat.col + grade.volumeCols; col++)
        if (!isFloor(col, row) || blocked(col, row) || volumeCells.has(row * cols + col)) return false;
      return true;
    });
    const score = (seat: typeof candidates[number]): number => {
      const x = (seat.col + grade.volumeCols / 2) * TILE, y = (seat.row + grade.volumeRows / 2) * TILE;
      if (spatial) return spatialHostScore(x / TILE, y / TILE, slot, grade.volumeCount, 'volume',
        [...chosen.filter((p): p is Seat => p !== null).map(p => ({ col: p.col + .5, row: p.row + .5 })), ...volumes.map(box => ({ col: box.coreCol + .5, row: box.coreRow + .5 }))]);
      const distance = Math.hypot(x - spawn.x, y - spawn.y);
      const spread = volumes.length ? Math.min(...volumes.map(box => Math.hypot(x - (box.coreCol + .5) * TILE, y - (box.coreRow + .5) * TILE))) : 0;
      return spread - Math.abs(distance - 210) * .6;
    };
    allowed.sort((a, b) => score(b) - score(a) || a.row - b.row || a.col - b.col);
    const seat = allowed.find(seat => !spatial || Number.isFinite(score(seat)));
    if (!seat) throw new Error(`${grade.id}: no complete native volume footprint for Host ${slot + 1}`);
    const box = { minCol: seat.col, minRow: seat.row, maxCol: seat.col + grade.volumeCols - 1,
      maxRow: seat.row + grade.volumeRows - 1, coreCol: seat.col + Math.floor((grade.volumeCols - 1) / 2), coreRow: seat.row + Math.floor((grade.volumeRows - 1) / 2) };
    for (let row = box.minRow; row <= box.maxRow; row++) for (let col = box.minCol; col <= box.maxCol; col++) volumeCells.add(row * cols + col);
    volumes.push(box);
    // Frozen v1 grades retain gas; v2 draws without replacement at the existing Host seats.
    const pool = grade.version === 2 ? grade.volumePool! : [grade.volumeSubstrate];
    const ordered = [...pool].sort((a, b) => mix32(seed, `volume-kind-${a}`) - mix32(seed, `volume-kind-${b}`) || a.localeCompare(b));
    forms.push({ substrate: ordered[slot % ordered.length]!, coverage: grade.volumeCoverage, continuity: 'field', occupancy: 'volume', portfolio: 'ding',
      lexemes: { motion: 'motion_anchor', sense: 'sense_domain', rhythm: 'rhythm_open', contact: 'contact_volume_chaos' } });
  }
  return { hostTileMap, forms, pins: { wallEdges: [], paintFloors, corridorAabbs: volumes },
    paintCells: [...occupiedPaint].map(cell => ({ x: (cell % cols + .5) * TILE, y: (Math.floor(cell / cols) + .5) * TILE })),
    volumes, safeRoute, paintAreaPx: occupiedPaint.size * TILE * TILE, volumeAreaPx: volumeCells.size * TILE * TILE };
}
