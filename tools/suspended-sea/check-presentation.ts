import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSuspendedSeaWorld } from '../../src/dev/suspended-sea/world';
import { SuspendedSeaAudio, type SuspendedSeaAudioPort } from '../../src/dev/suspended-sea/audio';
import { createSuspendedSeaBedTexture, createSeaSurfaceGeometry, createSeaRibbonGeometry,
  SuspendedSeaPile } from '../../src/dev/suspended-sea/seabed';
import { SuspendedSeaStage } from '../../src/dev/suspended-sea/presentation';
import { SuspendedSeaShellSystem } from '../../src/worlds/suspended-sea/shell-system';
import { WaterFlowCycle } from '../../src/dev/spatial-study/water-flow';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import { StageVisibility } from '../../src/dev/spatial-study/stage/terrain';
import type { MeleeTarget } from '../../src/systems/weapon-swing';
import type { PlaySfxConfig } from '../../src/managers/audio-manager';
import type { SeaPoint } from '../../src/worlds/suspended-sea/types';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';
import type { RiftPresentationView } from '../../src/dev/spatial-study/stage/bridge';

let checks = 0;
function check(name: string, run: () => void): void { run(); checks++; console.log(`PASS ${name}`); }
class AudioProbe implements SuspendedSeaAudioPort {
  readonly loops = new Map<string, string>();
  readonly events: string[] = [];
  readonly positions: SeaPoint[] = [];
  playSpatialSFX(key: string, source: SeaPoint, _listener: SeaPoint, config?: PlaySfxConfig): void {
    if (config?.loop) this.loops.set(config.instanceId!, key);
    else this.events.push(key);
    this.positions.push({ ...source });
  }
  stopInstance(id: string): void { this.loops.delete(id); }
}
const content = createSuspendedSeaWorld(7, 'sea-open-channel');

function assertUpwardGeometry(geometry: THREE.BufferGeometry): void {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  assert(positions.count > 0 && positions.count % 3 === 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    const area = b.sub(a).cross(c.sub(a));
    assert(area.y > 0, `actual XZ winding faces down in ${geometry.name}, triangle ${i / 3}`);
    for (let j = 0; j < 3; j++) assert(normals.getY(i + j) > 0, 'normals must agree with the real winding');
  }
}

check('surface and ribbon production builders face upward for either input winding on sloping support', () => {
  const polygon = [{ x: -21, y: -15 }, { x: 16, y: -11 }, { x: 24, y: 4 },
    { x: 5, y: 17 }, { x: 3, y: 4 }, { x: -17, y: 12 }];
  const slope = (x: number, y: number): number => x * .13 + y * .07;
  for (const points of [polygon, [...polygon].reverse()]) {
    const surface = createSeaSurfaceGeometry(points, slope, .85);
    assertUpwardGeometry(surface);
    const position = surface.getAttribute('position');
    for (let i = 0; i < position.count; i++)
      assert(Math.abs(position.getY(i) - slope(position.getX(i), position.getZ(i)) - .85) < .001);
    const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const mesh = new THREE.Mesh(surface, material); mesh.updateMatrixWorld(true);
    assert(new THREE.Raycaster(new THREE.Vector3(-4, 30, -2), new THREE.Vector3(0, -1, 0)).intersectObject(mesh).length > 0,
      'normal attributes alone cannot rescue back-face culling');
    for (const closed of [false, true]) {
      const ribbon = createSeaRibbonGeometry(points, 3, slope, .9, closed, !closed);
      assertUpwardGeometry(ribbon); ribbon.dispose();
    }
    surface.dispose(); material.dispose();
  }
});

check('the actual two-layout shell/cavity/dry-channel meshes remain front-visible and follow real spill/return state', () => {
  for (const sceneId of ['sea-open-channel', 'sea-folded-ridge'] as const) {
    const pack = createSuspendedSeaWorld(7, sceneId), world = pack.base;
    const shell = new SuspendedSeaShellSystem(pack.shellDefinition, pack.shellTiming, (x, y) => world.isFloor(x, y));
    const context = { visibilityAt: () => 1, isRunEnded: () => false,
      readEntryView: () => ({ active: false, elapsedMs: 1200, durationMs: 1200, progress: 1 }) } as unknown as RiftDevRuntimeContext;
    const scene = new THREE.Scene(), visibility = new StageVisibility(context, world.width, world.height);
    const native = new SuspendedSeaStage(context, world, shell.readView, pack.shellBody,
      { scene, visibility, camera: new THREE.OrthographicCamera() });
    scene.updateMatrixWorld(true);
    let supportedMeshes = 0;
    for (const name of ['suspended-sea-shell-plate', 'suspended-sea-shell-cavity'])
      assert(scene.getObjectByName(name) instanceof THREE.Mesh, `missing actual ${name}`);
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !object.geometry.name.startsWith('suspended-sea-supported-')) return;
      supportedMeshes++; assertUpwardGeometry(object.geometry);
      assert.equal((object.material as THREE.Material).side, THREE.FrontSide, 'ground water cannot mask a winding defect with DoubleSide');
    });
    assert(supportedMeshes >= 8, 'check actual shell, fold, wet polygon and dry/wet path geometry');
    const frame = { ended: false, player: { position: pack.shellDefinition.position } } as unknown as RiftPresentationView;
    const targets: MeleeTarget[] = []; shell.collectMeleeTargets(targets);
    const step = (time: number): Record<string, unknown> => {
      shell.prepare(time, false); native.update(time, frame);
      return native.snapshot().shell as Record<string, unknown>;
    };
    const hitAt = pack.shellTiming.contactStartMs + 2;
    assert.equal(step(hitAt).spillVisible, true); targets[0]!.applyHit(20);
    assert.equal(step(hitAt + 300).spillVisible, true, 'middle of 600ms drainage still shows the full old hazard');
    assert.equal(step(hitAt + 300).drainVisible, true);
    assert.equal(step(hitAt + 599).spillVisible, true);
    const drained = step(hitAt + 600); assert.equal(drained.spillVisible, false); assert.equal(drained.drainVisible, true);
    const returning = step(pack.shellTiming.contactEndMs + 300);
    assert.equal(returning.mode, 'returning'); assert.equal(returning.drainVisible, false);
    assert.equal(returning.coreActive, false);
    native.destroy(); visibility.destroy(); shell.destroy(); disposeTree(scene);
  }
});
function fixture() {
  const shell = new SuspendedSeaShellSystem(content.shellDefinition, content.shellTiming, (x, y) => content.base.isFloor(x, y));
  const port = new AudioProbe(), audio = new SuspendedSeaAudio(content.base.waterDefinition, content.base.waterDefinition, port);
  const targets: MeleeTarget[] = []; shell.collectMeleeTargets(targets);
  const step = (time: number, entry = false, ended = false): void => {
    shell.prepare(time, ended); audio.update(shell.readView(), content.shellDefinition.position, ended, entry);
    assert(port.loops.size <= 1, 'one water object owns at most one near loop');
  };
  return { shell, port, audio, target: targets[0]!, step };
}

check('audio follows real feeding/contact/tail intervals, with no impact before water arrives', () => {
  const f = fixture(), cycle = new WaterFlowCycle(content.base.waterDefinition);
  for (let time = 0; time < cycle.period; time += 16) {
    f.step(time);
    if (time < content.base.waterDefinition.quietMs) assert.equal(f.port.loops.size, 0);
    if (time >= cycle.contactStart && time < cycle.contactEnd)
      assert.deepEqual([...f.port.loops.values()], ['sfx-suspended-sea-contact']);
    if (time >= cycle.feedStart && time < cycle.contactStart) assert.equal(f.port.loops.size, 0);
    if (time >= cycle.contactEnd) assert.equal(f.port.loops.size, 0);
  }
  assert.deepEqual(f.port.events, ['sfx-suspended-sea-fall', 'sfx-suspended-sea-drain']);
  f.audio.destroy(); assert.equal(f.port.loops.size, 0);
});

check('a real shell hit plays once, remains audible through drainage, and never replays on a frozen frame', () => {
  const f = fixture(), at = content.shellTiming.contactStartMs + 2;
  f.step(at); f.target.applyHit(20); f.step(at);
  for (let i = 0; i < 12; i++) f.step(at);
  assert.equal(f.port.events.filter(key => key.endsWith('shell-hit')).length, 1);
  f.step(at + 599); assert.equal(f.shell.readView().spillActive, true); assert.equal(f.port.loops.size, 1);
  f.step(at + 600); assert.equal(f.shell.readView().spillActive, false); assert.equal(f.port.loops.size, 1);
  assert.deepEqual(f.port.positions.at(-1), content.shellDefinition.drainPath[1]);
  f.step(at + 600, false, true); assert.equal(f.port.loops.size, 0);
  const events = f.port.events.length;
  f.audio.update(f.shell.readView(), content.shellDefinition.position, false, false);
  assert.equal(f.port.events.length, events); assert.equal(f.port.loops.size, 0);
});

check('early invalid contact, entry and skipped stale intervals do not fabricate hit or hazard sounds', () => {
  const f = fixture(); f.target.applyHit(20); f.step(0, true);
  assert.equal(f.port.events.length, 0); assert.equal(f.port.loops.size, 0);
  f.step(content.shellTiming.periodMs * 3 + 50); assert.equal(f.port.events.length, 0);
  assert.equal(f.port.loops.size, 0); f.audio.destroy();
});

check('native sediment is deterministic and quiet at the two-world-unit pigment grid', () => {
  for (const scene of ['sea-open-channel', 'sea-folded-ridge'] as const) {
    const world = createSuspendedSeaWorld(42, scene).base;
    const a = createSuspendedSeaBedTexture(world), b = createSuspendedSeaBedTexture(world);
    assert.deepEqual(a.image.data, b.image.data);
    assert.equal(a.magFilter, THREE.NearestFilter); assert.equal(a.minFilter, THREE.NearestFilter);
    assert.equal(a.image.width, Math.ceil(world.width / 2));
    const bytes = a.image.data as Uint8Array, colors = new Map<string, number>();
    for (let i = 0; i < bytes.length; i += 4) {
      assert.equal(bytes[i + 3], 255);
      const key = `${bytes[i]}:${bytes[i + 1]}:${bytes[i + 2]}`; colors.set(key, (colors.get(key) ?? 0) + 1);
    }
    const largest = Math.max(...colors.values()) / (bytes.length / 4);
    assert(largest > .55, `dominant continuous sediment field, got ${largest}`);
    assert(colors.size >= 3 && colors.size <= 6); a.dispose(); b.dispose();
  }
});

check('native pile materials keep source identity without revealing item identity, stay planted and obey formal search state', () => {
  const world = content.base;
  const node = world.layout.contaminantNodes[0]!;
  const state = { id: node.id, position: node.position, collected: false, visibility: 1, searching: false, targeted: false, progress: 0 };
  const models = ['sea-deposit', 'rift-debris'].map(source => new SuspendedSeaPile(world, state, source as 'sea-deposit' | 'rift-debris'));
  const scene = new THREE.Scene();
  for (const model of models) {
    scene.add(model.root); model.update(state, 0);
    assert.equal(model.root.position.y, world.groundHeightAt(node.position.x, node.position.y));
    model.update({ ...state, visibility: 0 }, 80); assert.equal(model.root.visible, false);
    model.update({ ...state, collected: true }, 100); assert.equal(model.root.visible, true);
  }
  assert.notEqual(models[0]!.root.name, models[1]!.root.name);
  assert.notEqual(models[0]!.root.children.length, models[1]!.root.children.length); disposeTree(scene);
});

check('native wet and shell materials use current per-fragment sight; old terrain keeps its memory contract', () => {
  const visibility = new StageVisibility({ visibilityAt: () => 1 } as unknown as RiftDevRuntimeContext, 64, 64);
  const material = new THREE.MeshStandardMaterial(); visibility.apply(material, undefined, false, undefined, true);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <worldpos_vertex>',
    fragmentShader: '#include <common>\n#include <opaque_fragment>' };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  assert(shader.fragmentShader.includes('if(awareness<=0.)discard;'));
  assert(!shader.fragmentShader.includes('rememberedGround'));
  material.dispose(); visibility.destroy();
});
console.log(`PASS ${checks} suspended sea presentation/audio state checks. Raw image and listening reviews remain separate.`);
