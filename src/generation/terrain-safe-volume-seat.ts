/** Fixed, fully walkable local stage for material volumes. Historical echo keeps its original corridor. */
import type { CorridorAabb } from './types';
export function isMaterialVolume(substrate: string): boolean {
  return substrate === 'gas_mass' || substrate === 'mist_bank' || substrate === 'dust_swarm';
}
/** Largest all-floor axis-aligned rectangle, at least 2×2 cells; ties use stable row/column order. */
export function findTerrainSafeVolumeSeat(corridors: readonly CorridorAabb[], isWalkable: (col: number, row: number) => boolean): CorridorAabb | undefined {
  let best: CorridorAabb | undefined, bestArea = 0;
  for (const box of corridors) {
    const width = box.maxCol - box.minCol + 1;
    const heights = new Int32Array(width), stack = new Int32Array(width + 1);
    for (let row = box.minRow; row <= box.maxRow; row++) {
      for (let col = 0; col < width; col++) heights[col] = isWalkable(box.minCol + col, row) ? heights[col]! + 1 : 0;
      let top = -1;
      for (let right = 0; right <= width; right++) {
        const height = right === width ? 0 : heights[right]!;
        while (top >= 0 && heights[stack[top]!]! > height) {
          const h = heights[stack[top--]!]!, left = top < 0 ? 0 : stack[top]! + 1, w = right - left;
          if (h < 2 || w < 2) continue;
          const area = h * w, minCol = box.minCol + left, minRow = row - h + 1;
          if (area < bestArea || (area === bestArea && best && (minRow > best.minRow || (minRow === best.minRow && minCol >= best.minCol)))) continue;
          bestArea = area;
          best = { minCol, minRow, maxCol: box.minCol + right - 1, maxRow: row,
            coreCol: minCol + Math.floor((w-1)/2), coreRow: minRow + Math.floor((h-1)/2) };
        }
        stack[++top] = right;
      }
    }
  }
  return best;
}
