import assert from 'node:assert/strict';
import { SeaVolumeGeometry, SeaMesh, SEA_SURFACE, seaFrontYAt, waterShardHeight, waterShardImpactTime, type SeaVolumeGeometryConfig } from '../../src/dev/spatial-study/sea-geometry';
import { SeaRaster } from '../../src/dev/spatial-study/sea-raster';

let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }
const compression = .52, heightProjection = Math.sqrt(1 - compression * compression) / compression;
const config: SeaVolumeGeometryConfig = { seed: 7, width: 1184, height: 1056, compression, heightProjection,
  frontY: 680, bottomHeight: 150, topHeight: 300, source: { x: 592, y: 544, width: 144, depth: 88 } };
const active = (elapsedMs = 6400) => ({ elapsedMs, curtain: { extension: 1, active: true, phase: 'active' } });

check('invalid or impossible geometry fails before allocating a silently broken sea', () => {
  for (const key of ['seed', 'width', 'height', 'compression', 'heightProjection', 'frontY', 'bottomHeight', 'topHeight'] as const) {
    assert.throws(() => new SeaVolumeGeometry({ ...config, [key]: NaN }));
  }
  for (const key of ['x', 'y', 'width', 'depth'] as const) {
    assert.throws(() => new SeaVolumeGeometry({ ...config, source: { ...config.source, [key]: NaN } }));
  }
  assert.throws(() => new SeaVolumeGeometry({ ...config, compression: 0 }));
  assert.throws(() => new SeaVolumeGeometry({ ...config, source: { ...config.source, y: config.frontY } }));
});

check('closed body has upper, curved side, underside faces and changes thickness and outline over five seconds', () => {
  const g = new SeaVolumeGeometry(config); g.build(active(0));
  const original = g.body.positions.slice(0, g.body.vertexCount * 3);
  const count = g.body.vertexCount, faces = g.body.triangleCount;
  const tags = new Set(g.body.surfaces.slice(0, faces));
  assert(tags.has(SEA_SURFACE.top) && tags.has(SEA_SURFACE.roll) && tags.has(SEA_SURFACE.bottom));
  assert(g.thicknessMin > 75); assert(g.thicknessMax - g.thicknessMin > 70);
  assert(g.frontMax - g.frontMin > 65);
  g.build(active(5000)); assert.equal(g.body.vertexCount, count); assert.equal(g.body.triangleCount, faces);
  let maxY = 0, maxZ = 0;
  for (let i = 0; i < count; i++) {
    maxY = Math.max(maxY, Math.abs(original[i * 3 + 1]! - g.body.positions[i * 3 + 1]!));
    maxZ = Math.max(maxZ, Math.abs(original[i * 3 + 2]! - g.body.positions[i * 3 + 2]!));
  }
  assert(maxY > 10, `Outline moved only ${maxY}`); assert(maxZ > 25, `Height moved only ${maxZ}`);
  g.build(active(0)); assert.deepEqual(g.body.positions.slice(0, count * 3), original);
  // There is no source argument in the independently defined front boundary.
  assert.equal(g.frontAt(592), seaFrontYAt(592, config.seed, config.frontY, 0, config.width));
  for (const mesh of [g.body, g.fall]) {
    assert(mesh.positions.slice(0, mesh.vertexCount * 3).every(Number.isFinite));
    assert(mesh.normals.slice(0, mesh.vertexCount * 3).every(Number.isFinite));
    assert(mesh.indices.slice(0, mesh.triangleCount * 3).every(index => index < mesh.vertexCount));
  }
});

check('an actual 96px-wide air opening clears source rays, including triangle-raster depth, throughout the cycle', () => {
  const g = new SeaVolumeGeometry(config), raster = new SeaRaster({ ...config, pixelStep: 2 });
  const cameraY = Math.sqrt(1 - compression * compression);
  for (const elapsedMs of [0, 2500, 5000, 10000, 15000, 30000, 60000]) {
    g.build(active(elapsedMs)); raster.render(g.body, g.fall, elapsedMs);
    assert(g.frontAt(config.source.x) - config.source.y > 100);
    for (let x = config.source.x - 48; x <= config.source.x + 48; x += 8) {
      const source = g.sampleColumn(x, config.source.y), sourceZ = source.bottom - 10;
      for (let y = config.source.y + 24; y <= g.frontAt(x); y += 4) {
        const column = g.sampleColumn(x, y), rayZ = sourceZ + (y - config.source.y) / heightProjection;
        assert(column.bottom - rayZ > 15, `No real air gap at t=${elapsedMs},x=${x},y=${y}`);
      }
      const px = Math.floor(x / 2), py = Math.floor((config.source.y - sourceZ * heightProjection) / 2);
      const pointDepth = cameraY * config.source.y + compression * sourceZ;
      assert(raster.body.depth[py * raster.width + px]! < pointDepth, `Actual foreground triangles hide source at ${elapsedMs}/${x}`);
    }
  }
});

check('the near silhouette opens obliquely to the right instead of closing as a symmetric arch', () => {
  const g = new SeaVolumeGeometry(config);
  for (const elapsedMs of [0, 5000, 15000, 30000]) {
    g.build(active(elapsedMs));
    const leftX = 300, rightX = 920, leftY = g.frontAt(leftX) - 30, rightY = g.frontAt(rightX) - 30;
    assert(g.frontAt(leftX) - g.frontAt(rightX) > 115, 'Right coast no longer recedes');
    const left = g.sampleColumn(leftX, leftY), right = g.sampleColumn(rightX, rightY);
    assert(right.bottom - left.bottom > 50, 'Right belly no longer rolls up');
    const leftProjectedBottom = leftY - left.bottom * heightProjection;
    const rightProjectedBottom = rightY - right.bottom * heightProjection;
    assert(leftProjectedBottom - rightProjectedBottom > 170, 'The open diagonal silhouette collapsed');
  }
});

check('fall joins the uneven underside, shares its timing, and its contact reaches exactly the authored ellipse', () => {
  const g = new SeaVolumeGeometry(config);
  g.build({ elapsedMs: 0, curtain: { extension: 0, active: false, phase: 'quiet' } });
  assert.equal(g.fall.vertexCount, 0);
  g.build({ elapsedMs: 5000, curtain: { extension: .45, active: false, phase: 'descending' } });
  assert(g.fall.vertexCount > 0); assert(g.fallLowestZ > 50);
  for (let vertex = 0; vertex <= 32; vertex++) {
    const x = g.fall.positions[vertex * 3]!, y = g.fall.positions[vertex * 3 + 1]!, z = g.fall.positions[vertex * 3 + 2]!;
    assert(Math.abs(z - g.sampleColumn(x, y).bottom - 13) < .001, 'The source collar is detached');
  }
  g.build(active()); assert.equal(g.fallLowestZ, 0);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, groundVertices = 0;
  for (let i = 0; i < g.fall.vertexCount; i++) {
    const z = g.fall.positions[i * 3 + 2]!; if (Math.abs(z) > .001) continue;
    const x = g.fall.positions[i * 3]!, y = g.fall.positions[i * 3 + 1]!;
    const nx = (x - config.source.x) / (config.source.width / 2), ny = (y - config.source.y) / (config.source.depth / 2);
    assert(nx * nx + ny * ny <= 1.00001, 'Visible contact leaves the danger ellipse');
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); groundVertices++;
  }
  assert(groundVertices > 45); assert.equal(minX, config.source.x - config.source.width / 2);
  assert.equal(maxX, config.source.x + config.source.width / 2); assert.equal(minY, config.source.y - config.source.depth / 2);
  assert.equal(maxY, config.source.y + config.source.depth / 2);
});

check('the falling section is a continuous thin-edged sheet with one broad flow and a shorter narrow tail', () => {
  const g = new SeaVolumeGeometry(config); g.build(active());
  const stride = 33, rows = 20, oneSide = (rows + 1) * stride;
  const at = (row: number, col: number, component: number, back = false) =>
    g.fall.positions[((back ? oneSide : 0) + row * stride + col) * 3 + component]!;
  const mainZ = at(rows, 16, 2), notchZ = at(rows, 25, 2), tailZ = at(rows, 31, 2);
  assert(mainZ < .01); assert(notchZ > g.sourceBottom * .35);
  assert(tailZ > g.sourceBottom * .1 && tailZ < notchZ * .6, 'The two ends became equal-length legs');
  const midDepth = at(8, 16, 1) - at(8, 16, 1, true);
  const wingDepth = at(8, 0, 1) - at(8, 0, 1, true);
  const width = at(8, 32, 0) - at(8, 0, 0);
  assert(midDepth > wingDepth * 4); assert(midDepth / width < .25, 'The sheet became a thick tube');
  // A full connected 32-cell span remains above the split, on both surfaces.
  assert.equal(g.fall.surfaces[0], SEA_SURFACE.fall);
  for (let col = 0; col < 32; col++) assert(at(5, col + 1, 0) > at(5, col, 0));
});

check('moving wing tears remove actual faces, while the full upper half and broad center remain connected', () => {
  const g = new SeaVolumeGeometry(config), frontSize = 21 * 33;
  const missing = (ms: number) => {
    g.build(active(ms));
    const cells = new Set<number>();
    for (let i = 0; i < g.fall.triangleCount; i++) {
      const a = g.fall.indices[i * 3]!, b = g.fall.indices[i * 3 + 1]!, c = g.fall.indices[i * 3 + 2]!;
      if (a >= frontSize || b >= frontSize || c >= frontSize) continue;
      const row = Math.min(Math.floor(a / 33), Math.floor(b / 33), Math.floor(c / 33));
      const col = Math.min(a % 33, b % 33, c % 33);
      cells.add(row * 32 + col);
    }
    const gaps: number[] = [];
    for (let row = 0; row < 20; row++) for (let col = 0; col < 32; col++) {
      if (row < 9 || (col >= 6 && col <= 26)) assert(cells.has(row * 32 + col), `Main sheet cut at ${row}/${col}`);
      if (!cells.has(row * 32 + col)) gaps.push(row * 32 + col);
    }
    assert(gaps.length > 0 && gaps.length < 50); assert.equal(gaps.length, g.fallTornCellCount);
    return gaps;
  };
  assert.notDeepEqual(missing(6200), missing(6500), 'Torn geometry is stationary');
});

check('detached broad water accelerates downwards, physically reaches contact, and stays in a bounded geometry budget', () => {
  const height = 63, impact = waterShardImpactTime(height);
  assert(waterShardHeight(height, impact - .01) > 0); assert(waterShardHeight(height, impact + .01) === 0);
  const firstFall = waterShardHeight(height, .1) - waterShardHeight(height, .2);
  const laterFall = waterShardHeight(height, .2) - waterShardHeight(height, .3);
  assert(laterFall > firstFall + 2, 'The fragment is travelling at constant speed');
  const g = new SeaVolumeGeometry(config), actualLowest: number[] = [];
  for (const ms of [100, 200, 300]) {
    g.build(active(ms)); assert(g.fallShardCount > 0 && g.fallShardCount <= 3);
    // Each closed shard ends with its top and bottom center vertices. This is the
    // first emitter's real mesh contact point, not a predicted animation counter.
    actualLowest.push(g.fall.positions[(g.fallFragmentVertexStart + 10) * 3 + 2]!);
    assert(g.fall.vertexCount < 1850 && g.fall.triangleCount < 3650);
  }
  assert(actualLowest[0]! > actualLowest[1]! && actualLowest[1]! > actualLowest[2]!);
  assert(actualLowest[1]! - actualLowest[2]! > actualLowest[0]! - actualLowest[1]! + 2);
});

check('contact fragments actually move horizontally through impact and never enlarge the ground danger footprint', () => {
  const g = new SeaVolumeGeometry(config), positions: { x: number; y: number }[] = [];
  for (const ms of [40, 140]) {
    g.build(active(ms)); assert(g.contactBurstCount > 0 && g.contactBurstCount <= 6);
    const index = (g.fallContactVertexStart + 10) * 3;
    positions.push({ x: g.fall.positions[index]!, y: g.fall.positions[index + 1]! });
    assert.equal(g.fall.positions[index + 2], 0, 'The horizontal impact is floating');
    for (let i = g.fallFragmentVertexStart; i < g.fall.vertexCount; i++) {
      const x = g.fall.positions[i * 3]!, y = g.fall.positions[i * 3 + 1]!, z = g.fall.positions[i * 3 + 2]!;
      assert(z >= 0);
      if (z > .001) continue;
      const nx = (x - config.source.x) / (config.source.width / 2), ny = (y - config.source.y) / (config.source.depth / 2);
      assert(nx * nx + ny * ny <= 1, 'Contact moved outside the authored ellipse');
    }
  }
  assert(Math.hypot(positions[1]!.x - positions[0]!.x, positions[1]!.y - positions[0]!.y) > 12, 'Only height changes at impact');
  g.build({ elapsedMs: 6000, curtain: { extension: .5, active: false, phase: 'descending' } });
  assert.equal(g.contactBurstCount, 0); assert.equal(g.fallShardCount, 0);
});

check('z-buffer resolves intersecting faces per pixel, independently of submission order', () => {
  const mesh = new SeaMesh(6, 2), cameraY = Math.sqrt(1 - compression * compression);
  const point = (x: number, screenY: number, depth: number) => {
    const z = compression * (depth - cameraY * screenY), y = screenY + heightProjection * z;
    return mesh.vertex(x, y, z, x, y);
  };
  const a = point(10, 10, 110), b = point(110, 10, 170), c = point(10, 110, 130);
  const d = point(10, 10, 155), e = point(110, 10, 120), f = point(10, 110, 140);
  mesh.triangle(a, b, c, SEA_SURFACE.top); mesh.triangle(d, e, f, SEA_SURFACE.roll); mesh.finishNormals();
  const raster = new SeaRaster({ width: 128, height: 128, compression, heightProjection, pixelStep: 1 });
  raster.render(mesh, new SeaMesh(1, 1), 0);
  assert.equal(raster.body.surface[20 * 128 + 20], SEA_SURFACE.roll);
  assert.equal(raster.body.surface[20 * 128 + 70], SEA_SURFACE.top);
  const before = raster.body.depth.slice();
  mesh.indices.set([d, e, f, a, b, c]); mesh.surfaces.set([SEA_SURFACE.roll, SEA_SURFACE.top]);
  raster.render(mesh, new SeaMesh(1, 1), 0); assert.deepEqual(raster.body.depth, before);
});

check('body and falling water retain separate pixels and depth, with actual source pixels visible without any cutout', () => {
  const g = new SeaVolumeGeometry(config), raster = new SeaRaster({ ...config, pixelStep: 2 });
  g.build(active()); raster.render(g.body, g.fall, 6400);
  assert.notEqual(raster.body.pixels, raster.fall.pixels); assert.notEqual(raster.body.depth, raster.fall.depth);
  let visible = 0, hidden = 0;
  for (let i = 0; i < raster.fall.pixels.length; i++) {
    if (!raster.fall.pixels[i]) continue;
    if (raster.fall.depth[i]! > raster.body.depth[i]!) visible++; else hidden++;
  }
  assert(visible > 1000); assert(hidden > 100, 'The source must still penetrate and be occluded by its own real parent body');
  const identities = [g.body.positions, g.fall.positions, raster.body.depth, raster.fall.pixels];
  g.build(active(11400)); raster.render(g.body, g.fall, 11400);
  assert.deepEqual([g.body.positions, g.fall.positions, raster.body.depth, raster.fall.pixels].map((buffer, i) => buffer === identities[i]), [true, true, true, true]);
});

console.log(`${passed} sea-volume checks passed`);
