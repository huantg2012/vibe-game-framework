import { createSpatialPrototype } from '../../src/dev/rift-spatial-prototype-world';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { TileGrid } from '../../src/systems/tile-grid';
const seed = Number(process.argv[2] ?? 20261010);
const result = createSpatialPrototype(seed, 'medium');
console.log(JSON.stringify(result.metrics, null, 2));
const metrics = result.metrics;
if (Number(metrics.areaMultiplier) < 3.4 || Number(metrics.areaMultiplier) > 5.2) throw new Error('Body-supported area outside prototype target');
if (Number(metrics.terrainFillRatio) > .76) throw new Error('Boundary remains too close to its rectangular container');
if (Number(metrics.solidTerrainRatio) < .16) throw new Error('Solid obstacles do not yet meaningfully divide the terrain');
if (Number(metrics.bodyReachableRatio) < .97) throw new Error('Too much isolated body-supported ground');
const grid = new TileGrid(result.world.layout.tileMap);
const routeCells = new Map<string, Set<string>>();
for (const route of result.routes) {
  const cells: string[] = [];
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1]!, b = route.points[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx !== 0 && dy !== 0) throw new Error(`Non-axis route segment: ${route.id}`);
    const steps = Math.hypot(dx, dy) / grid.tileSize;
    if (!Number.isInteger(steps)) throw new Error('Route segment is off the physical grid');
    for (let step = 0; step < steps; step++) {
      const point = { x: a.x + Math.sign(dx) * step * grid.tileSize, y: a.y + Math.sign(dy) * step * grid.tileSize };
      if (!bodyHasSupport(grid, point, 10, 10) || bodyDisplacementFraction(grid, point, 10, 10, Math.sign(dx) * grid.tileSize, Math.sign(dy) * grid.tileSize) !== 1)
        throw new Error(`Route crosses physical obstruction: ${route.id}`);
      cells.push(`${point.x},${point.y}`);
    }
  }
  const last = route.points[route.points.length - 1]!;
  if (!bodyHasSupport(grid, last, 10, 10)) throw new Error('Route destination has no body support');
  cells.push(`${last.x},${last.y}`);
  if (new Set(cells).size !== cells.length) throw new Error(`Route backtracks: ${route.id}`);
  if ((cells.length - 1) * grid.tileSize !== route.lengthPx) throw new Error('Route length does not match physical steps');
  routeCells.set(route.id, new Set(cells.slice(1, -1)));
}
for (const side of ['west', 'east']) {
  const north = result.routes.find(row => row.id === `${side}-north`)!, south = result.routes.find(row => row.id === `${side}-south`)!;
  if (Math.abs(north.lengthPx - south.lengthPx) < 80) throw new Error(`${side} routes do not offer different travel lengths`);
  const a = routeCells.get(north.id)!, b = routeCells.get(south.id)!;
  const sharedRatio = [...a].filter(cell => b.has(cell)).length / Math.min(a.size, b.size);
  console.log(`${side} alternative route shared ratio: ${sharedRatio}`);
  if (sharedRatio > .1) throw new Error(`${side} routes mainly use the same passage`);
}
console.log('PASS: same physical grid, irregular boundary, body area and two alternative-route pairs');
