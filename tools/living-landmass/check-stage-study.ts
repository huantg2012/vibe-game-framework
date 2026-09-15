import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ActorPixelDrawing, ACTOR_PIXEL_SIZE } from '../../src/dev/spatial-study/stage/actor-pixels';
import { StagePlayer } from '../../src/dev/spatial-study/stage/actors';
import { createPresentationFrame } from '../../src/dev/spatial-study/stage/bridge';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import { LandmassStudyCamera, STUDY_ANGLES } from '../../src/dev/living-landmass-stage/camera';
import { LivingStageModel } from '../../src/dev/living-landmass-stage/model';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';

let passed = 0;
const near = (a: number, b: number, epsilon = 1e-5): void => assert(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function check(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
const model = new LivingStageModel();
const rig = new LandmassStudyCamera(model.focus, model.span);
const owned = new THREE.Group();

try {
  check('legacy actor default and explicit 35 degree pixels remain identical', () => {
    const a = new StagePlayer(), b = new StagePlayer({ elevationDeg: 35 }); owned.add(a.root, b.root);
    const frame = createPresentationFrame(); frame.player.hp = 100;
    for (const facing of [0, Math.PI / 2, Math.PI, -.7]) {
      frame.player.facing = facing; a.update(frame.player, 1000); b.update(frame.player, 1000);
      assert.deepEqual(a.copyPixels(), b.copyPixels());
    }
  });

  check('all three angles redraw colour and pose depth in the actual camera basis', () => {
    const root = new THREE.Group(), drawing = new ActorPixelDrawing(112, 88, 56, 61);
    root.add(drawing.mesh); owned.add(root); root.position.set(600, 154, 575);
    const point = { x: 0, y: 0, depth: 0 };
    for (const angle of STUDY_ANGLES) for (const yaw of [0, .6, Math.PI / 2, Math.PI]) {
      rig.setElevation(angle); drawing.setCameraElevation(angle); root.rotation.y = yaw; drawing.begin(yaw); root.updateMatrixWorld(true);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(drawing.mesh.matrixWorld);
      near(normal.dot(new THREE.Vector3(0, 0, 1).applyQuaternion(rig.camera.quaternion)), 1);
      for (const [x, y, z] of [[-3, 1.5, -4], [0, 41, 2], [12, 25, 27], [-8, 11, -20]]) {
        drawing.project(x!, y!, z!, point);
        const card = new THREE.Vector3((point.x - drawing.anchorX) * ACTOR_PIXEL_SIZE,
          (drawing.anchorY - point.y) * ACTOR_PIXEL_SIZE, 0).applyMatrix4(drawing.mesh.matrixWorld).project(rig.camera);
        const actual = new THREE.Vector3(x!, y!, z!).applyMatrix4(root.matrixWorld).project(rig.camera);
        near(card.x, actual.x); near(card.y, actual.y);
        near((card.z + 1) / 2 - point.depth / (rig.camera.far - rig.camera.near), (actual.z + 1) / 2);
      }
    }
    for (const value of [NaN, Infinity, -1, 0, 90]) assert.throws(() => drawing.setCameraElevation(value));
  });

  check('walking height is the rendered indexed triangle, not a second approximate surface', () => {
    const geometry = model.surface.geometry, index = geometry.index!, positions = geometry.getAttribute('position');
    const sample = { height: 0, triangle: -1, inside: false };
    for (let at = 0; at < index.count; at += 3 * 37) {
      const a = index.getX(at), b = index.getX(at + 1), c = index.getX(at + 2);
      for (const weights of [[.2, .3, .5], [.65, .2, .15]]) {
        const x = positions.getX(a) * weights[0]! + positions.getX(b) * weights[1]! + positions.getX(c) * weights[2]!;
        const y = positions.getZ(a) * weights[0]! + positions.getZ(b) * weights[1]! + positions.getZ(c) * weights[2]!;
        const height = positions.getY(a) * weights[0]! + positions.getY(b) * weights[1]! + positions.getY(c) * weights[2]!;
        model.sampleGround(x, y, sample); assert(sample.inside); near(sample.height, height, .0001);
      }
    }
  });

  check('the bay is actual absent geometry and cannot be crossed by the real body sweep', () => {
    assert(!model.contains(500, 385)); assert(!model.walk.isWalkableAt(500, 385));
    const ray = new THREE.Raycaster(new THREE.Vector3(500, 800, 385), new THREE.Vector3(0, -1, 0));
    assert.equal(ray.intersectObject(model.surface).length, 0);
    assert(bodyHasSupport(model.walk, model.spawn, 10, 10));
    for (const [dx, dy] of [[-1500, 0], [1500, 0], [0, -1500], [0, 1500]]) {
      const fraction = bodyDisplacementFraction(model.walk, model.spawn, 10, 10, dx!, dy!);
      assert(fraction > 0 && fraction < 1);
      assert(bodyHasSupport(model.walk, { x: model.spawn.x + dx! * fraction, y: model.spawn.y + dy! * fraction }, 10, 10));
    }
  });

  check('every walk cell covers real skin across concave boundaries, including the three south-edge regressions', () => {
    for (const [x, y, bodyX, bodyY] of [[760.1, 700, 770, 691], [600.01, 716, 610, 707], [768.1, 716, 778, 707]]) {
      assert(!model.contains(x!, y!)); assert(!model.walk.isWalkableAt(x!, y!));
      assert.equal(new THREE.Raycaster(new THREE.Vector3(x!, 800, y!), new THREE.Vector3(0, -1, 0))
        .intersectObject(model.surface).length, 0);
      assert(!bodyHasSupport(model.walk, { x: bodyX!, y: bodyY! }, 10, 10));
    }
    const geometry = model.surface.geometry, index = geometry.index!, positions = geometry.getAttribute('position');
    const counts = new Map<string, { a: number; b: number; count: number }>();
    for (let at = 0; at < index.count; at += 3) for (let side = 0; side < 3; side++) {
      const a = index.getX(at + side), b = index.getX(at + (side + 1) % 3), key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = counts.get(key); if (edge) edge.count++; else counts.set(key, { a, b, count: 1 });
    }
    const size = model.walk.tileSize, half = size / 2;
    for (const { a, b, count } of counts.values()) {
      if (count !== 1) continue;
      const ax = positions.getX(a), ay = positions.getZ(a), bx = positions.getX(b), by = positions.getZ(b);
      const dx = (bx - ax) / 2, dy = (by - ay) / 2;
      for (let row = Math.floor(Math.min(ay, by) / size) - 1; row <= Math.floor(Math.max(ay, by) / size) + 1; row++) {
        for (let col = Math.floor(Math.min(ax, bx) / size) - 1; col <= Math.floor(Math.max(ax, bx) / size) + 1; col++) {
          if (!model.walk.isWalkable(col, row)) continue;
          // Independent separating-axis oracle, rather than the production
          // segment-clipping method. No admitted cell may meet a mesh edge.
          const mx = (ax + bx) / 2 - (col * size + half), my = (ay + by) / 2 - (row * size + half);
          const intersects = Math.abs(mx) <= half + Math.abs(dx) && Math.abs(my) <= half + Math.abs(dy)
            && Math.abs(dx * my - dy * mx) <= half * (Math.abs(dx) + Math.abs(dy));
          assert(!intersects, `walk cell ${col},${row} intersects rendered skin boundary`);
        }
      }
    }
    let coveredCells = 0;
    for (let row = 0; row < model.walk.rows; row++) for (let col = 0; col < model.walk.cols; col++) {
      if (!model.walk.isWalkable(col, row)) continue;
      coveredCells++;
      for (let y = 0; y <= size; y += size / 4) for (let x = 0; x <= size; x += size / 4) {
        assert(model.contains(col * size + x, row * size + y), `unsupported interior in walk cell ${col},${row}`);
      }
    }
    assert(coveredCells > 3000, 'boundary safety must retain a broad two-dimensional walking surface');
  });

  check('standing feet remain on the same support while the angle and facing change', () => {
    const player = new StagePlayer({ elevationDeg: 50 }), frame = createPresentationFrame(); owned.add(player.root);
    Object.assign(frame.player.position, model.spawn); frame.player.hp = 100;
    player.setGroundSampler(model.groundHeightAt); player.setGroundHeight(model.groundHeightAt(model.spawn.x, model.spawn.y));
    for (const angle of STUDY_ANGLES) for (const facing of [0, .7, Math.PI / 2, Math.PI]) {
      rig.setElevation(angle); player.setCameraElevation(angle); frame.player.facing = facing;
      player.update(frame.player, 1000); player.root.updateMatrixWorld(true);
      const feet = player.snapshot().feet as number[][];
      for (const foot of feet) near(foot[1]!, model.groundHeightAt(foot[0]!, foot[2]!) + 1.5);
      near(player.root.position.x, model.spawn.x); near(player.root.position.z, model.spawn.y);
      assert.deepEqual(player.root.scale.toArray(), [1, 1, 1]);
    }
  });

  check('switching elevation preserves geometry and lateral pixel scale', () => {
    const before = model.surface.geometry.getAttribute('position').array.slice();
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
    for (const angle of STUDY_ANGLES) {
      rig.setElevation(angle);
      rig.project(model.spawn, model.groundHeightAt(model.spawn.x, model.spawn.y), a);
      rig.project({ x: model.spawn.x + 32, y: model.spawn.y }, model.groundHeightAt(model.spawn.x, model.spawn.y), b);
      near(b.x - a.x, 32 * 960 / model.span); near(b.y, a.y);
    }
    assert.deepEqual(model.surface.geometry.getAttribute('position').array, before);
  });
} finally {
  disposeTree(owned); model.destroy(); model.destroy();
}
console.log(`Living-landmass actual-stage study: ${passed} checks passed.`);
