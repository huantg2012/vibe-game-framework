import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildNativeVolume, NativeBodyCollision, TileType } from '../static4/executor.mjs';

const dir = new URL('.', import.meta.url);
const originalBytes = fs.readFileSync(new URL('../static4/report.json', dir));
const original = JSON.parse(originalBytes).results.find(r => r.world === 'offset-basins');
const intent = JSON.parse(fs.readFileSync(new URL('../intent.json', dir)))['offset-basins'];
const seed = 20261005;
const inside = (poly, x, y) => {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
};
const point = i => ({ x: (i % 128) * 8 + 4, y: Math.floor(i / 128) * 8 + 4 });
const results = [];
// Move the lower whole bank away from the inter-bank approach. No camera,
// route-window, body width, material, seed, or shared geometry changes.
for (const southShift of [0, 16, 32]) {
  const definition = structuredClone(original.definition);
  definition.instances[1].y += southShift;
  const matterAt = (x, y) => {
    if (x < 0 || y < 0 || x >= 1024 || y >= 768) return false;
    const cx = Math.floor(x / 8) * 8 + 4, cy = Math.floor(y / 8) * 8 + 4;
    const c = Math.floor(cx / 32), r = Math.floor(cy / 32);
    return c >= 1 && r >= 1 && c < 31 && r < 23 && !(c < 3 && r < 3)
      && !(c > 28 && r > 20) && !definition.erosion.some(p => inside(p, cx, cy));
  };
  const map = { cols: 128, rows: 96, tileSize: 8,
    tiles: Array.from({ length: 96 }, (_, r) => Array.from({ length: 128 }, (_, c) => matterAt(c * 8 + 4, r * 8 + 4) ? TileType.FLOOR : TileType.VOID)) };
  const meshes = definition.instances.map(({ role, ...s }) => buildNativeVolume({ ...s,
    family: s.family ?? definition.family, blocking: role === 'solid' ? 1 : 0, seed: seed ^ Math.imul(s.id, 104729) }));
  const body = new NativeBodyCollision({ definition, meshes }, map);
  const support = Uint8Array.from({ length: 128 * 96 }, (_, i) => body.supports(point(i), 10, 10) ? 1 : 0);
  const seat = ([x, y]) => {
    let cell = -1, distance = Infinity;
    for (let i = 0; i < support.length; i++) if (support[i]) {
      const p = point(i), d = Math.hypot(x - p.x, y - p.y);
      if (d < distance) { cell = i; distance = d; }
    }
    return { requested: { x, y }, actual: point(cell), cell, distance };
  };
  const search = (start, end, bounds) => {
    const parent = new Int32Array(support.length).fill(-1), queue = [start]; parent[start] = start;
    for (let at = 0; at < queue.length && parent[end] < 0; at++) {
      const p = queue[at], a = point(p);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = p % 128 + dc, r = Math.floor(p / 128) + dr, next = r * 128 + c, b = point(next);
        if (c < 0 || r < 0 || c >= 128 || r >= 96 || parent[next] >= 0 || !support[next]
          || bounds && (b.x < bounds[0] || b.y < bounds[1] || b.x > bounds[2] || b.y > bounds[3])) continue;
        if (body.displacementFraction(a, 10, 10, dc * 8, dr * 8) < 1
          || body.displacementFraction(b, 10, 10, -dc * 8, -dr * 8) < 1) continue;
        parent[next] = p; queue.push(next);
      }
    }
    if (parent[end] < 0) return null;
    const path = []; for (let i = end; ; i = parent[i]) { path.push(point(i)); if (i === start) break; }
    return path.reverse();
  };
  const routes = intent.routes.map(r => {
    const stations = r.points.map(seat);
    const segments = stations.slice(1).map((s, i) => search(stations[i].cell, s.cell, r.bounds));
    return { name: r.name, stations, segments, pass: stations.every(s => s.distance < 24) && segments.every(Boolean) };
  });
  results.push({ southShift, pass: routes.every(r => r.pass), routes, definition });
}
const report = { scope: 'Pure geometry proposal against original station requests, original route bounds, 20px swept body, 8px terrain. No raster, production, real play or normal art claim.',
  originalReportSha256: createHash('sha256').update(originalBytes).digest('hex'), results };
fs.writeFileSync(new URL('report.json', dir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(results.map(r => ({ southShift: r.southShift, pass: r.pass,
  routes: r.routes.map(q => ({ name: q.name, pass: q.pass, distances: q.stations.map(s => s.distance), segments: q.segments.map(Boolean) })) })), null, 2));
