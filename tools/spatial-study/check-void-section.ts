import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { createStageGroundGeometry } from '../../src/dev/spatial-study/stage/ground-mesh';
import { createStageCamera } from '../../src/dev/spatial-study/stage/camera';
import { VoidRegions } from '../../src/dev/spatial-study/void-regions';

let passed = 0;
function check(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
function near(a: number, b: number, tolerance = 2e-4): void {
  assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
}

check('cliff anchors remain on known shore; every fragment belongs below its own land surface', () => {
  for (const seed of [0, 7, 42]) {
    const world = new SpatialSliceWorld(seed), before = JSON.stringify(world.layout);
    const geometry = createStageGroundGeometry(world), edge = geometry.edge;
    const p = edge.getAttribute('position'), anchor = edge.getAttribute('stageAnchor');
    const drop = edge.getAttribute('stageDrop'), span = edge.getAttribute('stageSectionSpan');
    const interior = edge.getAttribute('stageInterior');
    let deepest = 0, minSpan = Infinity, maxSpan = 0;
    try {
      for (let at = 0; at < p.count; at++) {
        assert.ok([p.getX(at), p.getY(at), p.getZ(at), anchor.getX(at), anchor.getY(at), drop.getX(at), span.getX(at)].every(Number.isFinite));
        assert.ok(world.isFloor(anchor.getX(at), anchor.getY(at)), 'no downward section may acquire visibility from VOID');
        assert.ok(p.getY(at) <= world.groundHeightAt(p.getX(at), p.getZ(at)) + 2e-4,
          'a folded root must stay below the continuous traversable height field');
        if (drop.getX(at) === 0) near(p.getY(at), world.groundHeightAt(p.getX(at), p.getZ(at)));
        if (interior.getX(at)) {
          minSpan = Math.min(minSpan, span.getX(at)); maxSpan = Math.max(maxSpan, span.getX(at));
          deepest = Math.max(deepest, drop.getX(at));
        }
      }
      assert.ok(minSpan >= 60 && maxSpan <= 130 && maxSpan - minSpan >= 10,
        'the interior wall must have differentiated geological depth');
      assert.ok(deepest > 90);
      // Also check interior triangle points, not only well-behaved vertices.
      for (let at = 0; at < p.count; at += 3) {
        const x = (p.getX(at) + p.getX(at + 1) + p.getX(at + 2)) / 3;
        const y = (p.getY(at) + p.getY(at + 1) + p.getY(at + 2)) / 3;
        const z = (p.getZ(at) + p.getZ(at + 1) + p.getZ(at + 2)) / 3;
        assert.ok(y <= world.groundHeightAt(x, z) + 2e-4);
      }
      assert.equal(JSON.stringify(world.layout), before);
    } finally { geometry.surface.dispose(); edge.dispose(); }
  }
});

check('all intermediate folds weld; the only open edges are the real upper rim and the unclosed disappearing root', () => {
  const world = new SpatialSliceWorld(7), geometry = createStageGroundGeometry(world), edge = geometry.edge;
  const p = edge.getAttribute('position'), drop = edge.getAttribute('stageDrop'), span = edge.getAttribute('stageSectionSpan');
  const edges = new Map<string, { count: number; top: boolean; root: boolean }>();
  const pointKey = (i: number): string => `${Math.round(p.getX(i) * 1000)}:${Math.round(p.getY(i) * 1000)}:${Math.round(p.getZ(i) * 1000)}`;
  try {
    for (let at = 0; at < p.count; at += 3) for (let side = 0; side < 3; side++) {
      const i = at + side, j = at + (side + 1) % 3, a = pointKey(i), b = pointKey(j);
      if (a === b) continue;
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      const value = edges.get(id) ?? { count: 0, top: drop.getX(i) === 0 && drop.getX(j) === 0,
        root: Math.abs(drop.getX(i) - span.getX(i)) < .001 && Math.abs(drop.getX(j) - span.getX(j)) < .001 };
      value.count++; edges.set(id, value);
    }
    let top = 0, root = 0;
    for (const [id, edge] of edges) {
      assert.ok(edge.count === 2 || edge.count === 1 && (edge.top || edge.root), `unwelded wall fold ${id}`);
      if (edge.count === 1 && edge.top) top++;
      if (edge.count === 1 && edge.root) root++;
    }
    assert.ok(top > 100 && root > 100); assert.equal(top, root);
  } finally { geometry.surface.dispose(); edge.dispose(); }
});

check('the central void stays genuinely bottomless; no skirt spans an interior tile', () => {
  const world = new SpatialSliceWorld(7), regions = new VoidRegions(world.layout.tileMap), geometry = createStageGroundGeometry(world);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry.edge, material);
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 2000);
  let inspected = 0;
  try {
    for (let y = 8; y < world.height; y += 16) for (let x = 8; x < world.width; x += 16) {
      if (!regions.isInterior(x, y)) continue;
      ray.ray.origin.set(x, 600, y);
      assert.equal(ray.intersectObject(mesh, false).length, 0, `artificial interior surface at ${x},${y}`); inspected++;
    }
    assert.ok(inspected > 100);
  } finally { geometry.surface.dispose(); geometry.edge.dispose(); material.dispose(); }
});

check('the fixed camera cannot hide a live ground attachment behind a new cliff; far and near shores have real depth occlusion', () => {
  const world = new SpatialSliceWorld(7), geometry = createStageGroundGeometry(world), camera = createStageCamera(world.width, world.height);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const wall = new THREE.Mesh(geometry.edge, material), floor = new THREE.Mesh(geometry.surface, material);
  wall.updateMatrixWorld(true); floor.updateMatrixWorld(true);
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction).negate();
  const ray = new THREE.Raycaster(new THREE.Vector3(), direction, .01, 2000);
  let attachments = 0, exposed = 0, screened = 0;
  try {
    for (let y = 16; y < world.height; y += 32) for (let x = 16; x < world.width; x += 32) {
      if (!world.isFloor(x, y)) continue;
      for (const h of [1.5, 21, 42]) {
        ray.ray.origin.set(x, world.groundHeightAt(x, y) + h, y);
        assert.equal(ray.intersectObject(wall, false).length, 0, `cliff blocks an actor at ${x},${y}, height ${h}`); attachments++;
      }
    }
    const p = geometry.edge.getAttribute('position'), drops = geometry.edge.getAttribute('stageDrop');
    const span = geometry.edge.getAttribute('stageSectionSpan'), interior = geometry.edge.getAttribute('stageInterior');
    for (let at = 0; at < p.count; at += 3) {
      if (!interior.getX(at)) continue;
      const ratio = (drops.getX(at) / span.getX(at) + drops.getX(at + 1) / span.getX(at + 1) + drops.getX(at + 2) / span.getX(at + 2)) / 3;
      if (ratio < .2 || ratio > .65) continue;
      ray.ray.origin.set((p.getX(at) + p.getX(at + 1) + p.getX(at + 2)) / 3,
        (p.getY(at) + p.getY(at + 1) + p.getY(at + 2)) / 3,
        (p.getZ(at) + p.getZ(at + 1) + p.getZ(at + 2)) / 3).addScaledVector(direction, .02);
      if (ray.intersectObject(floor, false).length) screened++; else exposed++;
    }
    assert.ok(attachments > 1000 && exposed > 30 && screened > 30);
    console.log(`MEASURE ${attachments} unobstructed actor samples; ${exposed} exposed and ${screened} terrain-occluded internal wall faces.`);
  } finally { geometry.surface.dispose(); geometry.edge.dispose(); material.dispose(); }
});

console.log(`${passed} VOID geometry / visibility-anchor / occlusion checks passed. Actual material depth readability still requires the fixed-camera visual review.`);
