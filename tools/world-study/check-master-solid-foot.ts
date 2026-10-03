import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import { buildNativeVolume, type NativeVolumeMesh } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';

// Captured from the unchanged relief path before solid-foot construction.
// These are geometry fingerprints, not authored dimensions or game rules.
const reliefBaseline: Readonly<Record<string, string>> = {
  'folded-slab-low:1': '7c5a5c037470084e88776f58dc02bb5967bfde70bf2121dfba01ed77d13b9925',
  'folded-slab-medium:2': '562939eac6cdefa5d46f867d3f46ecd1baa10ffc3f56d681c3f36d06727459d8',
  'folded-slab-medium:3': '2372e2ba736ffbb62f55ddc12bbdd41c9a5caf43c1f0944e240df950eb692c81',
  'folded-slab-severe:3': '1010d7124eb235f953af726b2bbe562d089d47c179ac6f11ef0225f7d3d2301b',
  'fibre-knot-low:1': '3009c89b85b60c46d3e5f8fa9cabbbbd11792ffb8261db3355debd9d6cea68e9',
  'fibre-knot-medium:2': '561fcd660e52c124b5e0d8c2c54e2dbf98ad9879f2da85879899a3fbf49ea95b',
  'fibre-knot-medium:3': '301bfe858e062be51e1fdb467ee21278f7e45b68d9cfb70c59c53a5d3117d237',
  'fibre-knot-severe:3': 'e820033820d26749bad2f076780fb855bc78f923135e22ed0be32cbaa4ecff5f',
  'broken-shell-low:1': 'b214edf36fa43c2ad635fcb1bbe39f9118dc02b541bb39213e9091625c65d15d',
  'broken-shell-medium:2': 'db9966d93397d55ec96e15d792341220da88a7041b8234574d1a51ac0bab2601',
  'broken-shell-medium:3': '62e715fce9cbeed306d88aef8e3e4d22200a3de568f7838b8e8d1542ba957542',
  'broken-shell-severe:3': 'a45b84915c1a04fd67e361d11ff3bdadf4e22878c16894e528b1528b35a77764',
};

function fingerprint(mesh: NativeVolumeMesh): string {
  const hash = createHash('sha256');
  for (const data of [mesh.positions, mesh.normals, mesh.uv, mesh.indices, mesh.materials, mesh.regions]) {
    hash.update(new Uint8Array(data.buffer));
  }
  hash.update(JSON.stringify(mesh.joints));
  return hash.digest('hex');
}

function footVertices(mesh: NativeVolumeMesh): string[] {
  const points = new Set<string>();
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i + 2] === 0) points.add(`${mesh.positions[i]},${mesh.positions[i + 1]}`);
  }
  return [...points].sort();
}

function assertPlaneNormals(mesh: NativeVolumeMesh, label: string): void {
  const p = mesh.positions, n = mesh.normals;
  for (let face = 0; face < mesh.triangleCount; face++) {
    const a = mesh.indices[face * 3]! * 3, b = mesh.indices[face * 3 + 1]! * 3, c = mesh.indices[face * 3 + 2]! * 3;
    const ux = p[b]! - p[a]!, uy = p[b + 1]! - p[a + 1]!, uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!, vy = p[c + 1]! - p[a + 1]!, vz = p[c + 2]! - p[a + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-5) continue;
    for (const vertex of [a, b, c]) {
      assert(Math.abs((nx * n[vertex]! + ny * n[vertex + 1]! + nz * n[vertex + 2]!) / length) > 1 - 2e-4,
        `${label}: section normal matches its own actual triangle ${face}`);
    }
  }
}

let reliefCases = 0, unchangedFamilies = 0, slabCases = 0;
let minimumJointPixels = Infinity, maximumShallowFraction = 0;
for (const definition of MASTER_SCENES) for (const instance of definition.instances) {
  const { role, ...geometry } = instance;
  const spec = { ...geometry, family: definition.family, seed: 20261002 ^ Math.imul(instance.id, 104729) };
  const label = `${definition.id}:${instance.id}`, original = buildNativeVolume(spec);
  assert.equal(fingerprint(buildNativeVolume({ ...spec, blocking: 0 })), fingerprint(original), `${label}: explicit relief retains geometry`);
  assert.equal(fingerprint(buildNativeVolume({ ...spec, blocking: undefined })), fingerprint(original), `${label}: omitted role remains supported`);
  if (role === 'relief') {
    assert.equal(fingerprint(original), reliefBaseline[label], `${label}: low relief preserves its pre-change geometry`);
    reliefCases++;
  }
  if (definition.family !== 'folded-slab') {
    assert.equal(fingerprint(buildNativeVolume({ ...spec, blocking: 1 })), fingerprint(original), `${label}: fibre and shell remain unchanged`);
    unchangedFamilies++;
    continue;
  }
  if (role !== 'solid') continue;
  for (const seed of [20261002, 20261003]) for (let direction = 0; direction < 8; direction++) {
    const rotated = { ...spec, seed: seed ^ Math.imul(instance.id, 104729), rotation: spec.rotation + direction * Math.PI / 4 };
    const legacy = buildNativeVolume({ ...rotated, blocking: 0 });
    const solid = buildNativeVolume({ ...rotated, blocking: 1 });
    const context = `${label}/${seed}/direction-${direction}`;
    assert.deepEqual(solid.bounds, legacy.bounds, `${context}: all bounds and maximum author height stay fixed`);
    assert.deepEqual(footVertices(solid), footVertices(legacy), `${context}: exact zero-height XY foot vertices stay fixed`);
    assertPlaneNormals(solid, context);
    const config = { x: Math.floor(legacy.bounds.minX) - 2, y: Math.floor(legacy.bounds.minY) - 2,
      width: Math.ceil(legacy.bounds.maxX - legacy.bounds.minX) + 5,
      height: Math.ceil(legacy.bounds.maxY - legacy.bounds.minY) + 5, opticalHeight: 24 };
    const before = compileNativeVolumeRaster([legacy], config), after = compileNativeVolumeRaster([solid], config);
    assert.deepEqual(after.matter, before.matter, `${context}: native-pixel projected coverage stays fixed`);
    assert.deepEqual(after.occupancy, before.occupancy, `${context}: 8px occupied cells stay fixed`);
    let oldShallow = 0, newShallow = 0, lowSection = 0, jointPixels = 0, nearestJoint = Infinity;
    for (const pixel of after.occupiedPixels) {
      if (before.heightField[pixel]! < 10 && before.normals[pixel * 3 + 2]! > .85) oldShallow++;
      if (after.heightField[pixel]! < 10 && after.normals[pixel * 3 + 2]! > .85) newShallow++;
      if (after.heightField[pixel]! < 12 && after.normals[pixel * 3 + 2]! < .8) lowSection++;
      if (after.material[pixel] !== 3) continue;
      jointPixels++;
      const joint = solid.joints[0]!;
      nearestJoint = Math.min(nearestJoint, Math.hypot(config.x + pixel % after.width + .5 - joint.x,
        config.y + Math.floor(pixel / after.width) + .5 - joint.y));
    }
    assert(oldShallow > 100 && newShallow < oldShallow * .03, `${context}: the low solid outlet no longer reads as a broad ground ramp`);
    assert(lowSection > 100, `${context}: visible low faces have actual steep section normals`);
    assert(jointPixels >= 6 && nearestJoint < 3, `${context}: the physical opening still exposes pixels around its source anchor`);
    maximumShallowFraction = Math.max(maximumShallowFraction, newShallow / oldShallow);
    minimumJointPixels = Math.min(minimumJointPixels, jointPixels);
    slabCases++;
  }
}
assert.equal(reliefCases, Object.keys(reliefBaseline).length, 'All relief baseline fixtures remain exercised');
const { role: fixtureRole, ...fixtureGeometry } = MASTER_SCENES[0]!.instances[0]!;
assert.equal(fixtureRole, 'relief');
const fixture = { ...fixtureGeometry, family: MASTER_SCENES[0]!.family, seed: 1 };
assert.throws(() => buildNativeVolume({ ...fixture, blocking: .5 }), /blocking must be 0 or 1/);
console.log(JSON.stringify({ status: 'pass', reliefCases, unchangedFamilies, slabCases, minimumJointPixels, maximumShallowFraction,
  limits: 'Geometry and raster contracts only; native shoulder-light readability still needs real-scene review.' }, null, 2));
