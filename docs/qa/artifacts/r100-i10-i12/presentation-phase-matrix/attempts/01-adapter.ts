/** CPU presentation-phase contracts on actual native worlds. No raster/art or audible-listening approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { MasterPresentation } from '../../src/systems/r100-world/presentation';
import { selectMasterSourceCells } from '../../src/systems/r100-world/source-cells';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';
import type { MasterSurfaceRenderer } from '../../src/systems/r100-world/surface-renderer';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const planPath = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json';
const plan = JSON.parse(readFileSync(planPath, 'utf8')), matrix = plan.i11ContractMatrix;
const selected = (process.env.QA_WORLDS ?? R100_NATIVE_WORLDS.map(w => w.id).join(',')).split(',');
assert.equal(new Set(selected).size, selected.length);
for (const id of selected) assert(R100_NATIVE_WORLDS.some(w => w.id === id), id);
const phases = [...matrix.normalizedAnimationPhases, .8, .9]; // Also cover the short bright peak and release.
const rows: Record<string, unknown>[] = [];
let sourceSamples = 0, drawCalls = 0, graphicCalls = 0, destroyed = 0;
for (const id of selected) for (const grade of ['low','medium','severe'] as const) {
  const recipe = createR100ProductionRecipe(id, 20261005, grade), generated = createR100ProductionMap(recipe);
  const world = hydrateR100MasterWorld(generated.native!, generated.layout);
  const body = new NativeBodyCollision(generated.native!, generated.layout), sources = selectMasterSourceCells(world);
  assert(sources.length > 0, `${id}/${grade}: actual structure source is required`);
  const immutable = () => hash(JSON.stringify({ definition: world.definition, meshes: world.meshes,
    map: world.layout.tileMap, sight: world.sight, combat: world.combat }));
  const before = immutable();
  for (const degrees of matrix.orientationsDegrees as number[]) for (const phase of phases as number[]) {
    const angle = degrees * Math.PI / 180, spawn = world.layout.spawnPoint;
    const attempted = { x: spawn.x + Math.cos(angle) * 24, y: spawn.y + Math.sin(angle) * 24 };
    const position = body.supports(attempted, 10, 10) ? attempted : { ...spawn };
    const make = () => {
      const live = new Set<object>(), textures = new Set<string>();
      const graphics = () => {
        const g: any = new Proxy({ destroy() { assert(live.delete(g)); },
          createGeometryMask() { const mask = { destroy() { assert(live.delete(mask)); } }; live.add(mask); return mask; } },
          { get(target, prop) { if (prop in target) return Reflect.get(target, prop);
            return (...args: unknown[]) => { for (const a of args) if (typeof a === 'number') assert(Number.isFinite(a)); graphicCalls++; return g; }; } });
        live.add(g); return g;
      };
      let lastDraw: unknown;
      const renderer = { canvas: {}, gpuBytes: 0, surfaceDiagnostics: {},
        draw(lights: any[], activity: number, time: number, mode: number) {
          assert.equal(mode, 0); assert(Number.isFinite(activity) && Number.isFinite(time));
          assert(lights.length <= 8); for (const light of lights) {
            assert([light.x,light.y,light.z,light.radius,light.intensity,...light.color].every(Number.isFinite));
            assert(light.intensity >= 0); assert(light.radius > 0);
          }
          lastDraw = structuredClone({ lights, activity, time, mode }); drawCalls++;
        }, destroy() { destroyed++; },
      } as unknown as MasterSurfaceRenderer;
      const context = { scene: { textures: { exists: (key: string) => textures.has(key),
        addImage(key: string) { assert(!textures.has(key)); textures.add(key); return { setFilter() {}, source: [{ update() {} }] }; },
        remove(key: string) { assert(textures.delete(key)); } }, add: { graphics,
        image() { const image = { setOrigin() { return image; }, setDepth() { return image; }, destroy() { assert(live.delete(image)); } }; live.add(image); return image; },
      } }, layout: world.layout, player: { id: 'player', objects: [], getPosition: () => position, getGroundY: () => position.y }, enemies: [],
        readPresentationFrame: () => ({ player: { position, facingAngle: angle } }),
        readPollutionSources: () => [{ id: 'active-paint', x: position.x + 16, y: position.y, kind: 'paint', active: true },
          { id: 'active-volume', x: position.x, y: position.y + 24, kind: 'space', active: true }],
      } as unknown as RiftDevRuntimeContext;
      return { runtime: new MasterPresentation(context, world, undefined, renderer, sources),
        clean: () => assert.equal(live.size + textures.size, 0), draw: () => lastDraw };
    };
    const first = make(), second = make(), time = world.definition.motion_period * 1000 * phase;
    try {
      first.runtime.update(time, false); first.runtime.afterUpdate();
      const state = first.runtime.exportRuntimeState(); assert(first.runtime.validateRuntimeState(state));
      for (const light of first.runtime.snapshot().sourceLights as any[]) {
        assert(world.matterAt(light.x, light.y), `${id}: material source cannot occupy VOID`); sourceSamples++;
      }
      second.runtime.restoreRuntimeState(JSON.parse(JSON.stringify(state))); second.runtime.afterUpdate();
      assert.deepEqual(second.runtime.exportRuntimeState(), state);
      assert.deepEqual(second.draw(), first.draw(), `${id}/${grade}/${degrees}/${phase}: restored frame must match`);
      first.runtime.update(time + 16, false); second.runtime.update(time + 16, false);
      first.runtime.afterUpdate(); second.runtime.afterUpdate();
      assert.deepEqual(second.runtime.exportRuntimeState(), first.runtime.exportRuntimeState());
      assert.deepEqual(second.draw(), first.draw());
      first.runtime.setMotion(false); const paused = first.runtime.exportRuntimeState().elapsedMs;
      first.runtime.update(time + 1016, false); first.runtime.afterUpdate();
      assert.equal(first.runtime.exportRuntimeState().elapsedMs, paused);
      assert(!first.runtime.validateRuntimeState({ ...state, identity: state.identity + '-foreign' }));
      assert(!first.runtime.validateRuntimeState({ ...state, elapsedMs: NaN }));
      rows.push({ world: id, grade, degrees, phase, position, elapsedMs: time, sourceCount: sources.length,
        phaseLabel: second.runtime.snapshot().phase, activeLightCount: second.runtime.snapshot().activeLightCount,
        restorationExact: true, pausedClockExact: true });
    } finally { first.runtime.destroy(); first.runtime.destroy(); second.runtime.destroy(); first.clean(); second.clean(); }
  }
  assert.equal(immutable(), before, `${id}/${grade}: presentation cannot mutate ground, collision, sight or combat`);
}
const report = { status: 'pass', scope: 'Actual authored recipe, native triangle collision and presentation/audio clocks with a recorded renderer and scene adapter. Eight facing samples at supported positions, four frozen phases plus bright peak/release; exact restore and following frame, paused clock, no terrain/visibility mutation. GPU pixels, human visual quality, actual sound and browser keys are deliberately outside this contract.',
  source: { path: 'tools/qa/check-r100-presentation-phases.ts', sha256: hash(readFileSync('tools/qa/check-r100-presentation-phases.ts')) },
  plan: { path: planPath, sha256: hash(readFileSync(planPath)) }, worlds: selected, counts: { cases: rows.length, sourceSamples, drawCalls, graphicCalls, destroyed }, rows };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, worlds: selected.length, ...report.counts }));
