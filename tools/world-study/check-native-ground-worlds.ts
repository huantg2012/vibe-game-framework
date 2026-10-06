/** First construction4 author-local ground/body review, no visual admission. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data';
import { selectMasterSourceCells } from '../../src/systems/r100-world/source-cells';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { createMasterWorld } from '../../src/generation/world-study/r100-master-world';
import { buildNativeVolume } from '../../src/generation/world-study/native-volume-geometry';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import type { Vector2 } from '../../src/types/game-types';
const output = process.argv[2] ?? 'docs/qa/artifacts/r100-i10-i12/b01-geometry/worlds';
mkdirSync(output, { recursive: true });
const ids = ['cleft-tableland', 'fallen-spines', 'clamped-shore', 'torn-reservoir'];
const targets: Record<string, Vector2[]> = {
  'cleft-tableland': [{ x: 380, y: 284 }, { x: 720, y: 284 }, { x: 800, y: 560 }, { x: 380, y: 560 }],
  'fallen-spines': [{ x: 325, y: 370 }, { x: 612, y: 412 }, { x: 725, y: 555 }, { x: 875, y: 355 }],
  'clamped-shore': [{ x: 350, y: 480 }, { x: 535, y: 430 }, { x: 665, y: 345 }, { x: 860, y: 545 }],
  'torn-reservoir': [{ x: 280, y: 450 }, { x: 460, y: 510 }, { x: 610, y: 340 }, { x: 800, y: 550 }],
};
const results: unknown[] = [];
for (const id of ids) for (const grade of ['low', 'medium', 'severe'] as const) {
  const started = performance.now();
  try {
    const row = R100_NATIVE_WORLDS.find(w => w.id === id)!, definition = row.definitions.find(d => d.grade === grade)!;
    const world = createMasterWorld(definition, 20261005, { profile: row.profile, grade: POLLUTION_GRADE_DEFINITIONS.find(value => value.id === grade)! }), map = world.layout.tileMap;
    const body = new NativeBodyCollision(world as unknown as R100NativeWorldData, map);
    const point = (cell: number): Vector2 => ({ x: (cell % map.cols + .5) * 8, y: (Math.floor(cell / map.cols) + .5) * 8 });
    const supported = new Uint8Array(map.cols * map.rows);
    for (let i = 0; i < supported.length; i++) supported[i] = body.supports(point(i), 10, 10) ? 1 : 0;
    const seat = (wanted: Vector2): number => {
      let nearest = -1, distance = Infinity;
      for (let i = 0; i < supported.length; i++) if (supported[i]) {
        const p = point(i), d = Math.hypot(p.x - wanted.x, p.y - wanted.y);
        if (d < distance) { distance = d; nearest = i; }
      }
      assert(nearest >= 0 && distance < 24, `authored station (${wanted.x},${wanted.y}) is not nearby full-body ground: ${distance}`);
      return nearest;
    };
    const origin = seat(world.layout.spawnPoint), parent = new Int32Array(supported.length).fill(-1), queue = [origin]; parent[origin] = origin;
    for (let at = 0; at < queue.length; at++) {
      const cell = queue[at]!, p = point(cell), col = cell % map.cols, row = Math.floor(cell / map.cols);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = col + dc!, r = row + dr!, next = r * map.cols + c;
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows || !supported[next] || parent[next] !== -1) continue;
        if (body.displacementFraction(p, 10, 10, dc! * 8, dr! * 8) < 1) continue;
        parent[next] = cell; queue.push(next);
      }
    }
    const stations = targets[id]!.map(wanted => {
      const cell = seat(wanted); assert(parent[cell] !== -1, 'author station not reachable from actual spawn');
      return { requested: wanted, actual: point(cell), fullBodySupport: true };
    });
    const crossings: unknown[] = [];
    if (id === 'fallen-spines') {
      // Original590,425 touched the third bundle. Root-authorized fixture is
      // the same inner end gap at612,412, confirmed independently in all3grades.
      for (let segment = 0; segment < 2; segment++) {
        const start = seat(stations[segment]!.actual), end = seat(stations[segment + 1]!.actual);
        const pathParents = new Int32Array(supported.length).fill(-1), pending = [start]; pathParents[start] = start;
        for (let at = 0; at < pending.length && pathParents[end] === -1; at++) {
          const cell = pending[at]!, p = point(cell), col = cell % map.cols, row = Math.floor(cell / map.cols);
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = col + dc!, r = row + dr!, next = r * map.cols + c, q = { x: (c + .5) * 8, y: (r + .5) * 8 };
            if (q.x < 260 || q.x > 840 || q.y < 300 || q.y > 632 || c < 0 || r < 0 || c >= map.cols || r >= map.rows || !supported[next] || pathParents[next] !== -1) continue;
            if (body.displacementFraction(p, 10, 10, dc! * 8, dr! * 8) < 1 || body.displacementFraction(q, 10, 10, -dc! * 8, -dr! * 8) < 1) continue;
            pathParents[next] = cell; pending.push(next);
          }
        }
        assert(pathParents[end] !== -1, 'inner bundle end route cannot be replaced with the outer return');
        const route: Vector2[] = []; for (let cell = end; ; cell = pathParents[cell]!) { route.push(point(cell)); if (cell === start) break; }
        route.reverse();
        crossings.push({ name: `inner-end-gap-${segment + 1}`, route, body: '20x20', bidirectionalEvery8pxSegment: true, outsideReturnExcluded: 'x outside260–840 or y outside300–632' });
      }
    }
    if (id === 'cleft-tableland') {
      for (const centreY of [284, 560]) for (const offset of [-8, 0, 8]) {
        const a = { x: 360, y: centreY + offset }, b = { x: 760, y: centreY + offset };
        assert.equal(body.displacementFraction(a, 10, 10, b.x - a.x, 0), 1, 'whole body crossing must remain fully open');
        assert.equal(body.displacementFraction(b, 10, 10, a.x - b.x, 0), 1, 'same complete route must permit return');
        for (let x = a.x; x <= b.x; x += 2) assert(body.supports({ x, y: a.y }, 10, 10));
        crossings.push({ start: a, end: b, samples: 201, body: '20x20', bidirectionalFraction: 1 });
      }
      for (const p of [{ x: 536, y: 160 }, { x: 536, y: 410 }, { x: 536, y: 690 }]) {
        assert(!world.matterAt(p.x, p.y), 'cut must remove actual ground'); assert(!body.supports(p, 10, 10), 'VOID must stop actual body');
      }
      const edgeMesh = world.meshes.find(mesh => mesh.spec.groundEdgeWidth !== undefined)!;
      assert(edgeMesh && edgeMesh.spec.blocking === 0);
      // Determine the appended edge range from the carrier without its bank.
      const { groundEdgeWidth: _width, ...carrier } = edgeMesh.spec;
      const baseTriangles = buildNativeVolume(carrier).triangleCount;
      let checked = 0;
      for (let face = baseTriangles; face < edgeMesh.triangleCount; face++) {
        const points = [0, 1, 2].map(corner => { const index = edgeMesh.indices[face * 3 + corner]! * 3; return { x: edgeMesh.positions[index]!, y: edgeMesh.positions[index + 1]! }; });
        for (const weights of [[.34, .33, .33], [.8, .1, .1], [.1, .8, .1], [.1, .1, .8]]) {
          const x = points.reduce((n, p, i) => n + p.x * weights[i]!, 0), y = points.reduce((n, p, i) => n + p.y * weights[i]!, 0);
          assert(world.matterAt(x, y), `ground edge enters absent 8px terrain (${x}, ${y})`); checked++;
        }
      }
      crossings.push({ groundEdgeTriangles: edgeMesh.triangleCount - baseTriangles, insideMatterSamples: checked });
    }
    const fractureEvidence = world.meshes.filter(mesh => mesh.spec.blocking === 1).map(mesh => {
      assert.equal(mesh.joints.length, 1, 'one localized real fracture source per solid');
      const pixels = Array.from(world.raster.occupiedPixels).filter(pixel => world.raster.objectId[pixel] === mesh.spec.id && world.raster.material[pixel] === 3 && world.matterAt(pixel % world.raster.width, Math.floor(pixel / world.raster.width)));
      const cutPixels = Array.from(world.raster.occupiedPixels).filter(pixel => world.raster.objectId[pixel] === mesh.spec.id && world.raster.material[pixel] === 1 && world.matterAt(pixel % world.raster.width, Math.floor(pixel / world.raster.width))).length;
      assert(cutPixels >= 16, `solid ${mesh.spec.id} requires a real raster-visible cut face, not a vertical zero-XY wall`);
      assert(pixels.length >= 4, `solid ${mesh.spec.id} lacks visible fractured material area`);
      const joint = mesh.joints[0]!;
      const distance = Math.min(...pixels.map(pixel => Math.hypot(pixel % world.raster.width + .5 - joint.x, Math.floor(pixel / world.raster.width) + .5 - joint.y)));
      assert(distance < 2, 'joint must sit in same-object material3 pixels, never a fallback centre');
      const source = selectMasterSourceCells(world).find(source => world.meshes[source.meshIndex]!.spec.id === mesh.spec.id);
      assert(source && pixels.includes(source.cell), 'selected source must own one actual visible fracture pixel');
      return { objectId: mesh.spec.id, material3Pixels: pixels.length, visibleCutPixels: cutPixels, jointDistancePx: distance, sourceCell: source.cell };
    });
    const fragments: string[] = [];
    for (const mesh of world.meshes) {
      const fill = mesh.spec.blocking ? '#555' : '#bbb';
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const points = [0, 1, 2].map(corner => { const at = mesh.indices[i + corner]! * 3; return `${mesh.positions[at]},${mesh.positions[at + 1]}`; }).join(' ');
        fragments.push(`<polygon points="${points}" fill="${fill}"/>`);
      }
    }
    for (const polygon of definition.erosion) fragments.push(`<polygon points="${polygon.map(p => `${p.x},${p.y}`).join(' ')}" fill="#111"/>`);
    for (const station of stations) fragments.push(`<rect x="${station.actual.x - 10}" y="${station.actual.y - 10}" width="20" height="20" fill="none" stroke="#f00"/>`);
    writeFileSync(resolve(output, `${id}-${grade}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768"><rect width="1024" height="768" fill="#eee"/>${fragments.join('')}</svg>`);
    results.push({ id, grade, requestedSeed: 20261005, status: 'PASS', stations, crossings, fractureEvidence, triangles: world.meshes.reduce((n, mesh) => n + mesh.triangleCount, 0), reachableBodySeats: queue.length, durationMs: performance.now() - started });
  } catch (error) { results.push({ id, grade, requestedSeed: 20261005, status: 'FAIL', message: error instanceof Error ? error.message : String(error), durationMs: performance.now() - started }); }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ scope: 'Author-local master 12 definitions; full20px support/sweeps and static cut/bank relation, no production admission or art pass.', results }, null, 2) + '\n');
}
assert(results.every(row => (row as { status: string }).status === 'PASS'), 'At least one first-batch ground/body case failed; report retains every case');
console.log('PASS 12 authored world/grade ground/body cases');
