/** V3 geometry checks; this does not qualify complete worlds or visual quality. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildNativeVolume, NATIVE_VOLUME_SHAPE_PROFILES, type NativeVolumeMesh, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import { TileType } from '../../src/types/game-types';

function fingerprint(mesh: NativeVolumeMesh): string {
  const hash = createHash('sha256');
  for (const key of ['positions', 'normals', 'uv', 'indices', 'materials', 'regions'] as const) hash.update(new Uint8Array(mesh[key].buffer));
  hash.update(JSON.stringify({ bounds: mesh.bounds, joints: mesh.joints }));
  return hash.digest('hex');
}
const baseline = JSON.parse(await readFile('tools/world-study/fixtures/r100-construction-v1-v2.json', 'utf8')) as { cases: { spec: NativeVolumeSpec; hash: string }[]; worldHashes: Record<string, string> };
for (const entry of baseline.cases) assert.equal(fingerprint(buildNativeVolume(entry.spec)), entry.hash, `Accepted construction changed: ${entry.spec.family}/${entry.spec.constructionVersion}/${entry.spec.seed}/${entry.spec.blocking}`);
const catalogSource = await readFile('src/generated/r100-native-worlds.ts', 'utf8'), declaration = 'R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ';
const catalog = JSON.parse(catalogSource.slice(catalogSource.indexOf(declaration) + declaration.length).trim().replace(/;$/, '')) as { id: string }[];
for (const [id, hash] of Object.entries(baseline.worldHashes)) assert.equal(createHash('sha256').update(JSON.stringify(catalog.find(world => world.id === id))).digest('hex'), hash, `Accepted world ${id} definition changed`);
const spec: NativeVolumeSpec = { id: 1, family: 'fibre-knot', seed: 20261005, x: 240, y: 200, rotation: 0,
  length: 360, width: 260, height: 62, thickness: 12, fold: .68, branches: 3, opening: .88, distortion: .72, blocking: 1, constructionVersion: 3, shapeProfile: 'rib-vault' };
const map = { cols: 60, rows: 50, tileSize: 8, tiles: Array.from({ length: 50 }, () => Array.from({ length: 60 }, () => TileType.FLOOR)) };
function body(mesh: NativeVolumeMesh): NativeBodyCollision {
  const native = { definition: { instances: [{ id: 1, role: 'solid' }] }, meshes: [mesh] } as unknown as R100NativeWorldData;
  return new NativeBodyCollision(native, map);
}
function normals(mesh: NativeVolumeMesh): void {
  const p = mesh.positions, n = mesh.normals;
  for (let face = 0; face < mesh.triangleCount; face++) {
    const a = mesh.indices[face * 3]! * 3, b = mesh.indices[face * 3 + 1]! * 3, c = mesh.indices[face * 3 + 2]! * 3;
    const ux=p[b]!-p[a]!,uy=p[b+1]!-p[a+1]!,uz=p[b+2]!-p[a+2]!,vx=p[c]!-p[a]!,vy=p[c+1]!-p[a+1]!,vz=p[c+2]!-p[a+2]!;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);
    if(length>1e-4) assert(Math.abs((nx*n[a]!+ny*n[a+1]!+nz*n[a+2]!)/length)>1-3e-4, `${mesh.spec.shapeProfile}: normal on triangle ${face}`);
  }
}
const images: Uint8Array[] = [], metrics: object[] = [];
const passageEvidence: object[] = [];
let cases = 0;
for (const shapeProfile of NATIVE_VOLUME_SHAPE_PROFILES) {
  for (const seed of [20261005, 20261217]) for (const blocking of [0, 1]) for (const rotation of [0, -.71]) {
    const input = { ...spec, shapeProfile, seed, blocking, rotation, height: blocking ? 62 : 6 }, mesh = buildNativeVolume(input);
    assert.equal(fingerprint(mesh), fingerprint(buildNativeVolume(input)), `${shapeProfile}: deterministic`);
    assert(mesh.positions.every(Number.isFinite) && mesh.normals.every(Number.isFinite));
    assert.equal(mesh.bounds.maxZ, input.height);
    const planar = shapeProfile === 'monolith-buttress' || shapeProfile === 'terrace-shelf';
    assert(mesh.triangleCount < 7000 && mesh.triangleCount > (planar ? 30 : 200));
    assert([0, 1, 2, 3].every(slot => mesh.materials.includes(slot)), `${shapeProfile}: material faces`);
    assert(mesh.positions.filter((_v, at) => at % 3 === 2).every(z => z >= 0), 'Nothing clips below ground');
    normals(mesh); cases++;
  }
  const mesh = buildNativeVolume({ ...spec, shapeProfile }), collision = body(mesh);
  const raster = compileNativeVolumeRaster([mesh], { x: 0, y: 0, width: 480, height: 400, opticalHeight: 24 });
  const pixels = new Uint8Array(480 * 400 * 4);
  let sides = 0, jointPixels = 0, sourceDistance = Infinity;
  for (let i = 0; i < raster.matter.length; i++) {
    const value = raster.matter[i] ? Math.round(52 + raster.heightField[i]! / spec.height * 135 + raster.normals[i * 3 + 2]! * 30) : 23;
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = value; pixels[i * 4 + 3] = 255;
    if (raster.matter[i] && raster.normals[i * 3 + 2]! < .8) sides++;
    if (raster.matter[i] && raster.material[i] === 3) {
      jointPixels++;
      for (const joint of mesh.joints) sourceDistance = Math.min(sourceDistance, Math.hypot(i % 480 + .5 - joint.x, Math.floor(i / 480) + .5 - joint.y));
    }
  }
  assert(sides > 100, `${shapeProfile}: readable projected side area`);
  assert(jointPixels > 0 && sourceDistance < 4, `${shapeProfile}: source light is on actual material`);
  if (shapeProfile === 'rib-vault') {
    let clearLanes = 0;
    for (let x = 110; x <= 370; x += 8) if (collision.supports({ x, y: 176 }, 10, 10) && collision.displacementFraction({ x, y: 176 }, 10, 10, 0, 125) === 1) clearLanes++;
    assert(clearLanes >= 4, 'Rib gaps admit the complete body from the quiet courtyard');
    assert(!collision.supports({ x: 240, y: 114 }, 10, 10), 'Backbone remains solid');
  } else if (shapeProfile === 'pleated-sheet') {
    assert(raster.occupiedPixels.length > spec.length * spec.width * .35, 'Pleated sheet unfolds across a broad two-dimensional surface, not a thin swept wall');
    for (let face = 0; face < mesh.triangleCount; face++) if (mesh.regions[face] === 4)
      assert.equal(mesh.materials[face], 0, 'Continuous folded outer skin cannot acquire alternating inner-material stripes');
    let crossings = 0;
    for (let x = 195; x <= 285; x += 4) if (collision.displacementFraction({ x, y: 80 }, 10, 10, 0, 240) === 1) crossings++;
    assert(crossings >= 2, 'Curtain cut crosses the entire body, not merely its centre');
  } else if (shapeProfile === 'cellular-shell') {
    let cavities = 0;
    for (const p of [{ x: 120, y: 226 }, { x: 240, y: 161 }, { x: 360, y: 226 }]) if (collision.supports(p, 10, 10)) cavities++;
    assert.equal(cavities, 3, 'All three cell cavities have real open ground');
  } else if (shapeProfile === 'monolith-buttress') {
    assert(collision.supports({ x: 240, y: 300 }, 10, 10), 'Full-height buttress notch has ground');
    assert.equal(collision.displacementFraction({ x: 240, y: 350 }, 10, 10, 0, -110), 1, 'The complete body enters from outside between the two feet');
    assert(collision.displacementFraction({ x: 240, y: 240 }, 10, 10, 0, -110) < 1, 'Rear mother mass stops the body; there is no bridge underpass');
    const route = [{ x: 240, y: 350 }, { x: 240, y: 214 }, { x: 450, y: 214 }];
    let clearance = 0;
    for (let margin = 0; margin <= 8; margin += .5) {
      if (!route.every(p => collision.supports(p, 10 + margin, 10 + margin))
        || !route.slice(1).every((p, index) => collision.displacementFraction(route[index]!, 10 + margin, 10 + margin,
          p.x - route[index]!.x, p.y - route[index]!.y) === 1)) break;
      clearance = margin;
    }
    assert(clearance >= 2, 'A full body can turn through the open side mouth, not merely enter a blind notch');
    passageEvidence.push({ shapeProfile, route, minimumBodyEdgeClearance: clearance });
  } else if (shapeProfile === 'terrace-shelf') {
    assert(!collision.supports({ x: 240, y: 200 }, 10, 10), 'Quiet top is still an explicit solid, not an extra walkable level');
    assert(collision.supports({ x: 40, y: 200 }, 10, 10), 'Outside floor remains supported');
    assert.equal(collision.displacementFraction({ x: 306, y: 360 }, 10, 10, 0, -108), 1, 'The offset recession is real open ground across the complete body');
    assert(collision.displacementFraction({ x: 306, y: 252 }, 10, 10, 0, -100) < 1, 'The rear bank stops the body; no bridge or walkable upper tier is implied');
  } else {
    const columnWidths = Array.from({ length: raster.width }, (_v, x) => {
      let pixels = 0; for (let y = 0; y < raster.height; y++) if (raster.matter[y * raster.width + x]) pixels++;
      return pixels;
    });
    const firstColumn = columnWidths.findIndex(width => width > 0), maximumWidth = Math.max(...columnWidths);
    assert(columnWidths[firstColumn + 6]! < maximumWidth * .15, 'Cushion leaf narrows into its end instead of terminating in a uniform ribbon section');
    // The design's bare lane is diagonal. The former horizontal-only probe
    // falsely required a second route across the leaves (reviewed by Director).
    // Search bounded parallel paths whose midpoint stays between the two leaves;
    // both endpoints lie beyond the mesh, not inside a favourable empty pocket.
    let tracks: { start: { x: number; y: number }; end: { x: number; y: number }; minimumBodyEdgeClearance: number }[] = [];
    for (let dy = 40; dy <= 100 && tracks.length < 2; dy += 4) {
      const candidates: typeof tracks = [];
      for (let middleY = 194; middleY <= 206; middleY += 2) {
        const start = { x: 40, y: middleY - dy / 2 }, end = { x: 440, y: middleY + dy / 2 };
        if (!collision.supports(start, 10, 10) || !collision.supports(end, 10, 10)
          || collision.displacementFraction(start, 10, 10, end.x - start.x, dy) !== 1) continue;
        let clearance = 0;
        // This is a conservative complete-body clearance, not a centre-ray test.
        for (let margin = .5; margin <= 16; margin += .5) {
          if (!collision.supports(start, 10 + margin, 10 + margin)
            || collision.displacementFraction(start, 10 + margin, 10 + margin, end.x - start.x, dy) !== 1) break;
          clearance = margin;
        }
        candidates.push({ start, end, minimumBodyEdgeClearance: clearance });
      }
      for (let i = 1; i < candidates.length; i++) if (Math.abs(candidates[i]!.start.y - candidates[i - 1]!.start.y - 2) < 1e-6) {
        tracks = [candidates[i - 1]!, candidates[i]!]; break;
      }
    }
    assert.equal(tracks.length, 2, 'Two adjacent diagonal tracks admit the complete 20×20 body between cushion leaves');
    passageEvidence.push({ shapeProfile, body: [20, 20], adjacentTrackSeparation: 2, tracks });
  }
  metrics.push({ shapeProfile, triangles: mesh.triangleCount, occupiedPixels: raster.occupiedPixels.length, sides, jointPixels, sourceDistance });
  images.push(pixels);
}
for (const invalid of [{ shapeProfile: 'unknown' }, { shapeProfile: undefined }, { constructionVersion: 2 }, { constructionVersion: 4 }, { opening: undefined }, { bogus: 1 }])
  assert.throws(() => buildNativeVolume({ ...spec, ...invalid } as NativeVolumeSpec), `Reject invalid new shape contract ${JSON.stringify(invalid)}`);
const outputAt = process.argv.indexOf('--output');
if (outputAt >= 0) {
  const output = process.argv[outputAt + 1]!; await mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: 960, height: Math.ceil(images.length / 2) * 400, channels: 4, background: '#171717' } }).composite(images.map((input, i) => ({ input: Buffer.from(input), raw: { width: 480, height: 400, channels: 4 as const }, left: i % 2 * 480, top: Math.floor(i / 2) * 400 }))).png().toFile(output);
}
console.log(JSON.stringify({ status: 'pass', unchangedLegacyCases: baseline.cases.length, unchangedWorlds: Object.keys(baseline.worldHashes).length, expansionCases: cases, metrics, passageEvidence,
  reviewedProbeCorrection: 'The original horizontal-only cushion assertion failed; the design specifies a diagonal lane. Director reviewed this mismatch before authorizing complete-body diagonal sweep probes. No geometry/body threshold was changed for this correction.',
  scope: 'Same-mesh surfaces, full-body openings and legacy fingerprints; not world/art qualification.' }, null, 2));
