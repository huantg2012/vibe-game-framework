import assert from 'node:assert/strict';
import { createStageCamera, projectStagePoint, StageFollowCamera } from '../../src/dev/spatial-study/stage/camera';

let passed = 0;
function check(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
function near(a: number, b: number, epsilon = 1e-6): void { assert(Math.abs(a - b) < epsilon, `${a} != ${b}`); }
const target = (x: number, y: number, vx = 0, vy = 0) => ({ position: { x, y }, velocity: { x: vx, y: vy }, moving: vx !== 0 || vy !== 0 });

check('the local camera retains its original fixed framing', () => {
  const camera = createStageCamera(992, 864), snapshot = camera.matrixWorld.toArray();
  near(camera.left, -530); near(camera.right, 530);
  near(camera.position.x, 496); near(camera.position.z, 864 * .49 + Math.cos(35 * Math.PI / 180) * 1300);
  const again = createStageCamera(992, 864);
  assert.deepEqual(again.matrixWorld.toArray(), snapshot);
});

check('a long stage starts with the actual spawn in view, retaining actor scale independent of map size', () => {
  for (const [width, height] of [[1824, 1120], [3200, 1800]]) {
    const follow = new StageFollowCamera(width!, height!, { x: 240, y: 944 });
    const state = follow.snapshot();
    near(state.span, 1060); assert(state.playerScreen.x > 160 && state.playerScreen.x < 800); near(state.playerScreen.y, 385);
    const interior = new StageFollowCamera(width!, height!, { x: width! / 2, y: 944 });
    near(interior.snapshot().playerScreen.x, 480, 1e-6);
    near(follow.camera.right - follow.camera.left, 1060);
    const foot = { x: 0, y: 0 }, head = { x: 0, y: 0 };
    projectStagePoint(follow.camera, { x: 240, y: 944 }, foot);
    projectStagePoint(follow.camera, { x: 240, y: 944 }, head, 48);
    near(foot.y - head.y, 48 * Math.cos(35 * Math.PI / 180) * 960 / 1060);
  }
});

check('lateral movement cannot expose the sea construction edges or crop the outer shore actor', () => {
  const width = 1824, follow = new StageFollowCamera(width, 1120, { x: 240, y: 944 });
  const west = { x: 0, y: 0 }, east = { x: 0, y: 0 }, foot = { x: 0, y: 0 };
  let elapsed = 0;
  for (const x of [112, width - 112, 112]) {
    for (let frame = 0; frame < 300; frame++) follow.update(elapsed += 16, target(x, 600, x < width / 2 ? -80 : 80), false);
    projectStagePoint(follow.camera, { x: -96, y: 600 }, west);
    projectStagePoint(follow.camera, { x: width + 96, y: 600 }, east);
    assert(west.x < -1 && east.x > 961, 'Straight sea side faces must remain outside the screen');
    projectStagePoint(follow.camera, { x, y: 600 }, foot);
    assert(foot.x > 160 && foot.x < 800, 'A player at the outer coast needs body and melee room');
  }
});

check('translation retains shared WASD, height projection and orthographic direction through a long traversal', () => {
  const follow = new StageFollowCamera(1824, 1120, { x: 240, y: 944 });
  const orientation = follow.camera.quaternion.clone(), projection = follow.camera.projectionMatrix.toArray();
  let largestStep = 0, previous = { ...follow.center };
  for (let frame = 1; frame <= 900; frame++) {
    const x = 240 + Math.min(1100, frame * 80 / 60), y = 944 - Math.max(0, frame - 300) * 60 / 60;
    follow.update(frame * 1000 / 60, target(x, y, 80, frame > 300 ? -60 : 0), false);
    largestStep = Math.max(largestStep, Math.hypot(follow.center.x - previous.x, follow.center.y - previous.y));
    previous = { ...follow.center };
    near(Math.abs(orientation.dot(follow.camera.quaternion)), 1);
    assert.deepEqual(follow.camera.projectionMatrix.toArray(), projection);
    const point = { x, y }, foot = { x: 0, y: 0 }, east = { x: 0, y: 0 }, north = { x: 0, y: 0 };
    projectStagePoint(follow.camera, point, foot);
    projectStagePoint(follow.camera, { x: x + 32, y }, east);
    projectStagePoint(follow.camera, { x, y: y - 32 }, north);
    assert(east.x > foot.x && north.y < foot.y); near(east.y, foot.y); near(north.x, foot.x);
    near((foot.y - north.y) / (east.x - foot.x), Math.sin(35 * Math.PI / 180));
    assert(foot.x > 80 && foot.x < 880 && foot.y > 80 && foot.y < 560);
  }
  assert(largestStep < 3, `Unbounded tracking step: ${largestStep}`);
  assert(follow.center.x > 1000 && follow.center.y < 500, 'Both axes must translate rather than shrinking the long map');
});

check('turning, attack timing and ground relief do not move a settled camera', () => {
  const follow = new StageFollowCamera(1824, 1120, { x: 240, y: 944 });
  for (let frame = 1; frame <= 120; frame++) follow.update(frame * 16, target(240 + frame, 944, 60), false);
  for (let frame = 121; frame <= 200; frame++) follow.update(frame * 16, target(360, 944), false, 20);
  const settled = follow.snapshot(), position = follow.camera.position.toArray();
  for (let frame = 201; frame <= 1000; frame++) follow.update(frame * 16, target(360, 944), false, Math.sin(frame) * 30);
  assert.deepEqual(follow.snapshot().center, settled.center);
  assert.deepEqual(follow.snapshot().target, settled.target);
  assert.deepEqual(follow.camera.position.toArray(), position);
});

check('pause has no catch-up motion and ended runs freeze all camera state', () => {
  const follow = new StageFollowCamera(1824, 1120, { x: 240, y: 944 });
  follow.update(100, target(260, 944, 80), false);
  const before = follow.snapshot();
  for (let i = 0; i < 20; i++) follow.update(100, target(260, 944, 80), false);
  assert.deepEqual(follow.snapshot(), before);
  follow.update(5000, target(1600, 200, 80), true);
  assert.deepEqual(follow.snapshot(), before);
});

check('bounded overscan handles a map smaller than the frustum without invalid limits or scale changes', () => {
  for (const [width, height] of [[1824, 1120], [120, 100]]) {
    const follow = new StageFollowCamera(width!, height!, { x: width! / 2, y: height! / 2 });
    for (let frame = 1; frame <= 100; frame++) follow.update(frame * 100, target(-10000, 20000, -80, 80), false);
    assert(follow.center.x >= 0 && follow.center.x <= width!);
    assert(follow.center.y >= 0 && follow.center.y <= height!);
    assert(follow.camera.position.toArray().every(Number.isFinite));
    near(follow.camera.right - follow.camera.left, 1060);
  }
});

check('diagnostic snapshots copy state while the light rig borrows a stable center reference', () => {
  const follow = new StageFollowCamera(1824, 1120, { x: 240, y: 944 }), center = follow.center;
  const snapshot = follow.snapshot();
  (snapshot.center as { x: number }).x = -500;
  (snapshot.focus as { z: number }).z = -500;
  follow.update(100, target(360, 944, 80), false);
  assert.equal(follow.center, center); assert(follow.center.x > 0 && follow.focus.z > 0);
});

console.log(`${passed} stage-camera checks passed. Actual route framing remains a browser review.`);
