/** Architectural seats for fixed wall openings. Pure and shared with generation. */
import type { WallEdgePolyline } from '@/generation/types';
import type { OccluderGrid } from '@/types/map-types';

/**
 * A frame belongs to a wall end/opening, or faces a bounded narrow passage.
 * A long uninterrupted outside wall is not an opening. The chosen floor face is
 * retained explicitly so the core, attack and renderer all face the same side.
 */
export function doorwayWallSeats(
  edges: readonly WallEdgePolyline[],
  grid: OccluderGrid,
): WallEdgePolyline[] {
  const seats: WallEdgePolyline[] = [];
  const walls = new Set(edges.flatMap(edge => edge.tiles.map(t => `${t.col},${t.row}`)));
  for (const edge of edges) {
    const floors = new Set(edge.strikeFloors.map(f => `${f.col},${f.row}`));
    for (const tile of edge.tiles) for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const col = tile.col + nx, row = tile.row + ny;
      if (!floors.has(`${col},${row}`) || grid.isOpaque(col, row)) continue;
      const tx = -ny, ty = nx;
      // Both the approach and tangent cells are real floor; the opposite
      // tangent must continue the building wall (reject isolated rubble).
      const end = ([1, -1] as const).some(sign =>
        floors.has(`${tile.col + tx * sign},${tile.row + ty * sign}`) &&
        !grid.isOpaque(tile.col + tx * sign, tile.row + ty * sign) &&
        floors.has(`${col + tx * sign},${row + ty * sign}`) &&
        !grid.isOpaque(col + tx * sign, row + ty * sign) &&
        walls.has(`${tile.col - tx * sign},${tile.row - ty * sign}`));
      let passage = false;
      for (let width = 1; width <= 3; width++) {
        if (!floors.has(`${tile.col + nx * width},${tile.row + ny * width}`) &&
            grid.isOpaque(tile.col + nx * width, tile.row + ny * width)) break;
        const beyond = width + 1;
        if (walls.has(`${tile.col + nx * beyond},${tile.row + ny * beyond}`)) {
          // The passage must continue along its tangent on both sides.
          passage = !grid.isOpaque(col + tx, row + ty) && !grid.isOpaque(col - tx, row - ty);
          break;
        }
      }
      if (end || passage) seats.push({ tiles: [tile], strikeFloors: [{ col, row }] });
    }
  }
  return seats;
}
