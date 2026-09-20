/** A saved paint footprint is gameplay state; its clipped texture is not.
 * Adapt only the complete presentation to nearby supported floor. The Host
 * pin, contact cells, nucleus positions, health and combat IDs remain untouched. */
import { collectPaintGenomeFloorTiles, type PaintGenomeBakeResult } from './bake';

export interface LegacyPaintPresentationRequest {
  readonly originX: number;
  readonly originY: number;
  readonly tileSize: number;
  readonly surfaceFloorAt: (point: Readonly<{ x: number; y: number }>) => boolean;
  readonly maxOffset?: number;
}

export interface LegacyPaintPresentationReport {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly tileSize: number;
  readonly maxOffset: number;
  readonly candidatesChecked: number;
  readonly footprintCells: number;
  readonly initialUnsupportedCells: number;
  readonly remainingUnsupportedCells: number;
}

export type LegacyPaintPresentationResult =
  | { readonly ok: true; readonly baked: PaintGenomeBakeResult; readonly report: LegacyPaintPresentationReport }
  | { readonly ok: false; readonly reason: string; readonly report: LegacyPaintPresentationReport };

function translatePresentation(source: PaintGenomeBakeResult, dx: number, dy: number): PaintGenomeBakeResult {
  if (dx === 0 && dy === 0) return source;
  // Symmetric padding retains the exact original world anchor and includes
  // the old contact canvas even when the visual body moves toward one side.
  const w = source.canvasW + Math.abs(dx) * 2, h = source.canvasH + Math.abs(dy) * 2;
  const shiftX = Math.abs(dx) + dx, shiftY = Math.abs(dy) + dy;
  const field = new Float32Array(w * h), terrainFootprintField = new Float32Array(w * h);
  const data = new Uint8ClampedArray(w * h * 4), unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < source.canvasH; y++) {
    const from = y * source.canvasW, to = (y + shiftY) * w + shiftX;
    field.set(source.field.subarray(from, from + source.canvasW), to);
    terrainFootprintField.set(source.terrainFootprintField.subarray(from, from + source.canvasW), to);
    unitIndex.set(source.growth.unitIndex.subarray(from, from + source.canvasW), to);
    data.set(source.buf.data.subarray(from * 4, (from + source.canvasW) * 4), to * 4);
  }
  const ox = new Float32Array(source.growth.ox), oy = new Float32Array(source.growth.oy);
  for (let i = 0; i < source.growth.unitCount; i++) { ox[i] = ox[i]! + shiftX; oy[i] = oy[i]! + shiftY; }
  return { ...source, canvasW: w, canvasH: h, buf: { data, w, h }, field, terrainFootprintField,
    growth: { ...source.growth, ox, oy, unitIndex } };
}

/** Search is deterministic, bounded and aligned to the actual support grid.
 * A failed fit is explicit; callers must not substitute a silently cropped body. */
export function fitLegacyPaintPresentation(
  source: PaintGenomeBakeResult,
  request: LegacyPaintPresentationRequest,
): LegacyPaintPresentationResult {
  const { tileSize, originX, originY } = request, maxOffset = request.maxOffset ?? 96;
  if (!Number.isInteger(tileSize) || tileSize <= 0 || !Number.isFinite(originX) || !Number.isFinite(originY)
    || !Number.isFinite(maxOffset) || maxOffset < 0)
    throw new Error('Invalid legacy paint presentation support contract');
  const cells = collectPaintGenomeFloorTiles(source.terrainFootprintField, source.canvasW, source.canvasH,
    originX, originY, tileSize);
  const radius = Math.floor(maxOffset / tileSize);
  const candidates: { x: number; y: number }[] = [];
  for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++)
    if ((x * x + y * y) * tileSize * tileSize <= maxOffset * maxOffset) candidates.push({ x, y });
  candidates.sort((a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y || a.y - b.y || a.x - b.x);
  const queried = new Map<string, boolean>(), point = { x: 0, y: 0 };
  let candidatesChecked = 0, initialUnsupportedCells = 0, bestMissing = Infinity;
  for (const candidate of candidates) {
    let missing = 0;
    for (const cell of cells) {
      const col = cell.col + candidate.x, row = cell.row + candidate.y, key = `${col},${row}`;
      let supported = queried.get(key);
      if (supported === undefined) {
        point.x = (col + .5) * tileSize; point.y = (row + .5) * tileSize;
        supported = request.surfaceFloorAt(point); queried.set(key, supported);
      }
      if (!supported) missing++;
    }
    candidatesChecked++;
    if (candidatesChecked === 1) initialUnsupportedCells = missing;
    bestMissing = Math.min(bestMissing, missing);
    if (missing) continue;
    const offsetX = candidate.x * tileSize, offsetY = candidate.y * tileSize;
    return { ok: true, baked: translatePresentation(source, offsetX, offsetY), report: {
      offsetX, offsetY, tileSize, maxOffset, candidatesChecked, footprintCells: cells.length,
      initialUnsupportedCells, remainingUnsupportedCells: 0,
    } };
  }
  return { ok: false, reason: `No complete paint presentation fits within ${maxOffset}px of its saved pin`,
    report: { offsetX: 0, offsetY: 0, tileSize, maxOffset, candidatesChecked,
      footprintCells: cells.length, initialUnsupportedCells, remainingUnsupportedCells: bestMissing } };
}
