import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StageInsect, StagePlayer } from '../../src/dev/spatial-study/stage/actors';
import { createPresentationFrame, type RiftPresentationEnemy, type RiftPresentationEvent } from '../../src/dev/spatial-study/stage/bridge';
import { createStageCamera } from '../../src/dev/spatial-study/stage/camera';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import { WEAPON_ATTACK_PROFILES } from '../../src/generated/weapon-data';
import { ActorPixelDrawing, ACTOR_PIXEL_SIZE } from '../../src/dev/spatial-study/stage/actor-pixels';

let passed = 0;
const scene = new THREE.Scene();
function check(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
function near(actual: number, expected: number, epsilon = 1e-6): void {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}
function enemy(visibility = 1): RiftPresentationEnemy {
  return { id: 'pixel-insect', substrate: 'insect_remnant', coverage: 'infiltrate', position: { x: 600, y: 400 },
    velocity: { x: 0, y: 0 }, facing: 0, hp: 75, visibility, state: 'patrol',
    activity: { phase: 'active', progress: 0 }, attack: { phase: 'idle', progress: 0 } };
}
function event(kind: RiftPresentationEvent['kind'], elapsedMs: number): RiftPresentationEvent {
  return { sequence: 1, elapsedMs, kind, id: 'pixel-insect', source: 'fixture', amount: 20,
    position: { x: 600, y: 400 }, direction: { x: 1, y: 0 } };
}
function palette(bytes: Uint8Array): Set<number> {
  const result = new Set<number>();
  for (let at = 0; at < bytes.length; at += 4) {
    assert.ok(bytes[at + 3] === 0 || bytes[at + 3] === 255, 'the sprite itself must have binary pixel coverage');
    if (bytes[at + 3]) result.add(bytes[at]! << 16 | bytes[at + 1]! << 8 | bytes[at + 2]!);
  }
  return result;
}

check('both actors are authored finite-palette pixels with opaque depth-tested cutouts', () => {
  const player = new StagePlayer(), bug = new StageInsect('pixel-insect'); scene.add(player.root, bug.root);
  const frame = createPresentationFrame(); frame.player.hp = 100; frame.player.weaponDefinitionId = 'crowbar_plain';
  for (let direction = 0; direction < 16; direction++) {
    frame.player.facing = direction * Math.PI / 8; player.update(frame.player, 2000);
    const state = enemy(); state.facing = frame.player.facing; bug.update(state, 2000);
    for (const pixels of [player.copyPixels(), bug.copyPixels()]) {
      const colours = palette(pixels); assert.ok(colours.size >= 7 && colours.size <= 24, `palette ${colours.size}`);
      let covered = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) covered++;
      assert.ok(covered > 180 && covered < 1400, `painted pixel count ${covered}`);
    }
  }
  for (const root of [player.root, bug.root]) root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.userData.pixelDrawing) return;
    const material = object.material as THREE.MeshBasicMaterial;
    assert.ok(material.isMeshBasicMaterial); assert.equal(material.toneMapped, false);
    assert.equal(material.alphaTest, .5); assert.equal(material.depthWrite, true); assert.equal(material.transparent, false);
    assert.equal(material.map!.magFilter, THREE.NearestFilter); assert.equal(object.castShadow, false);
  });
});

check('the card always faces the fixed camera and its foot anchor projects to the physical root', () => {
  const model = new StagePlayer(); scene.add(model.root);
  const camera = createStageCamera(992, 864), frame = createPresentationFrame(); frame.player.hp = 100;
  frame.player.position = { x: 496, y: 752 }; model.setGroundHeight(24);
  for (const facing of [0, .2, Math.PI / 2, Math.PI, -2.2]) {
    frame.player.facing = facing; model.update(frame.player, 200);
    model.root.updateMatrixWorld(true);
    const mesh = model.root.getObjectByName('authored-actor-pixels')!;
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    const cameraNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    assert.ok(normal.dot(cameraNormal) > .999999);
    const anchor = new THREE.Vector3(0, 0, 0).applyMatrix4(mesh.matrixWorld);
    near(anchor.x, frame.player.position.x); near(anchor.y, 24); near(anchor.z, frame.player.position.y);
  }
});

check('independently sampled feet follow sloped terrain while the production origin stays unchanged', () => {
  const height = (x: number, y: number): number => (x - 400) * .2 + (y - 400) * .14 + 16;
  const player = new StagePlayer(), bug = new StageInsect('pixel-insect'); scene.add(player.root, bug.root);
  player.setGroundSampler(height); bug.setGroundSampler(height);
  const frame = createPresentationFrame(); frame.player.position = { x: 496, y: 752 }; frame.player.hp = 100;
  frame.player.facing = .4; player.setGroundHeight(height(496, 752)); player.update(frame.player, 100);
  const state = enemy(); bug.setGroundHeight(height(state.position.x, state.position.y)); bug.update(state, 100);
  for (const [model, clearance] of [[player, 1.5], [bug, 1.1]] as const) {
    const feet = model.snapshot().feet as number[][];
    for (const foot of feet) near(foot[1]!, height(foot[0]!, foot[2]!) + clearance);
  }
  near(player.root.position.x, 496); near(player.root.position.z, 752);
  near(bug.root.position.x, 600); near(bug.root.position.z, 400);
});

check('per-pixel pose depth equals the common camera depth, instead of a flat billboard depth', () => {
  const camera = createStageCamera(992, 864), root = new THREE.Group(); scene.add(root);
  const drawing = new ActorPixelDrawing(112, 88, 56, 61); root.add(drawing.mesh);
  root.position.set(500, 26, 420);
  const projected = { x: 0, y: 0, depth: 0 };
  for (const yaw of [0, .4, 1.7, Math.PI]) {
    root.rotation.y = yaw; drawing.begin(yaw); root.updateMatrixWorld(true);
    for (const [x, y, z] of [[-3, 1.5, -4], [0, 41, 2], [12, 25, 27], [-8, 11, -20]]) {
      drawing.project(x!, y!, z!, projected);
      const cardPoint = new THREE.Vector3((projected.x - drawing.anchorX) * ACTOR_PIXEL_SIZE,
        (drawing.anchorY - projected.y) * ACTOR_PIXEL_SIZE, 0).applyMatrix4(drawing.mesh.matrixWorld).project(camera);
      const actual = new THREE.Vector3(x!, y!, z!).applyMatrix4(root.matrixWorld).project(camera);
      near(cardPoint.x, actual.x); near(cardPoint.y, actual.y);
      near((cardPoint.z + 1) / 2 - projected.depth / (camera.far - camera.near), (actual.z + 1) / 2);
    }
  }
});

check('weapon drawing follows the formal attack/contact clock and remains within the actual reach', () => {
  const model = new StagePlayer(); scene.add(model.root); const frame = createPresentationFrame();
  const p = frame.player, profile = WEAPON_ATTACK_PROFILES.crowbar!; p.hp = 100; p.weaponDefinitionId = 'crowbar_plain';
  Object.assign(p.attack, { phase: 'active', elapsedMs: 25, facing: .3, contactElapsedMs: 15, contactRemainingMs: 10,
    windupMs: profile.windupMs, activeMs: profile.activeMs, recoveryMs: profile.recoveryMs });
  const source = JSON.stringify(p); model.update(p, 1000); const held = Number(model.snapshot().attackArc);
  model.update(p, 1100); near(Number(model.snapshot().attackArc), held); assert.equal(JSON.stringify(p), source);
  near(model.root.rotation.y, Math.PI / 2 - .3);
  for (const phase of ['windup', 'active', 'recovery'] as const) {
    p.attack.phase = phase; p.attack.contactRemainingMs = 0;
    for (const elapsed of [0, 15, 30, 45]) {
      p.attack.elapsedMs = elapsed; model.update(p, 1200 + elapsed);
      const tip = model.snapshot().weaponTip as number[];
      assert.ok(Math.hypot(tip[0]! - p.position.x, tip[2]! - p.position.y) <= profile.reachPx);
    }
  }
  p.weaponDefinitionId = null; model.update(p, 1500); assert.equal(model.snapshot().weaponVisible, false);
});

check('an invisible enemy has no pixels or shadow in the visible scene graph', () => {
  const model = new StageInsect('pixel-insect'); scene.add(model.root);
  model.update(enemy(1), 100); assert.equal(model.root.visible, true);
  model.update(enemy(0), 116); assert.equal(model.root.visible, false);
  let visibleObjects = 0; model.root.traverseVisible(() => visibleObjects++); assert.equal(visibleObjects, 0);
  model.hit(event('enemy-death', 130)); model.update(undefined, 150);
  assert.equal(model.root.visible, false, 'a hidden death must not create a visible carcass');
});

check('only real hit/death events create recoil and bounded collapse, not roster removal', () => {
  const model = new StageInsect('pixel-insect'); scene.add(model.root); const state = enemy();
  model.update(state, 100); const before = model.copyPixels(); model.update(undefined, 116); assert.equal(model.root.visible, false);
  model.update(state, 132); model.hit(event('enemy-hit', 132)); model.update(state, 148);
  assert.notDeepEqual(model.copyPixels(), before); near(model.root.position.x, state.position.x);
  model.hit(event('enemy-death', 150)); model.update(undefined, 180); assert.equal(model.root.visible, true);
  const upright = model.copyPixels(); model.update(undefined, 650); assert.notDeepEqual(model.copyPixels(), upright);
  model.update(undefined, 1101); assert.equal(model.root.visible, false);
});

check('actor pixels, geometry and shadow textures are all reclaimed by the stage resource owner', () => {
  const root = new THREE.Group(), player = new StagePlayer(), bug = new StageInsect('pixel-insect'); root.add(player.root, bug.root);
  const disposals = new Map<THREE.EventDispatcher, number>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshBasicMaterial;
    const resources = [object.geometry, material, material.map!];
    const depthTexture = material.userData.actorDepthTexture as THREE.Texture | undefined;
    if (depthTexture) resources.push(depthTexture);
    for (const resource of resources) {
      disposals.set(resource, 0);
      resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource)! + 1));
    }
  });
  disposeTree(root); assert.equal(disposals.size, 14);
  assert.ok([...disposals.values()].every(count => count === 1));
});

disposeTree(scene);
console.log(`Pixel actor geometry / input clock / visibility / lifetime: ${passed} checks passed. Scene composition and motion remain visual review tasks.`);
