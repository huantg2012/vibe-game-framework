import { readR100PreparedGameplay, requireR100GameplayPreparation } from '../../src/systems/r100-world/prepared-gameplay';
/** CPU lifecycle/recovery checks. Fake GL does not certify native visual quality. */
import assert from 'node:assert/strict';
import { createMasterWorld } from '../../src/generation/world-study/r100-master-world';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { prepareR100Presentation, getPreparedR100Presentation, createR100WorldPresentation, discardPreparedR100Presentation } from '../../src/systems/r100-world-presentation';
import { r100PresentationIdentity, validR100PresentationState } from '../../src/systems/r100-world/presentation-state';
import { MasterMaterialAudio, validMasterMaterialAudioState } from '../../src/systems/r100-world/audio';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';

import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { executeR100SurfacePreparation, type R100SurfacePreparationRequest } from '../../src/systems/r100-world/surface-preparation';

// Lifecycle scenarios require three disjoint atomic material pairs: otherwise a
// random mixed-source package can share a cached pair with the failure/retry
// scenario, changing which decodes are still pending. Production selection and
// mixed-source RGBA are independently covered by the library/prewarm suites.
const list = ['ash-strata', 'crystal-fibre', 'ivory-basin'].map((worldId, index) =>
  createR100ProductionRecipe(worldId, index + 1, 'medium'));
const first = list[0]!;
const worlds = new Map(list.map(recipe=>[recipe,createR100ProductionMap(recipe)]));
const worldFor=(recipe:typeof first)=>worlds.get(recipe)!;
const pending: Array<{ resolve(): void; reject(error: Error): void }> = [];
let decodes = 0, releasedImages = 0, loses = 0;
const live = new Set<object>();
const allocate = () => { const value = {}; live.add(value); return value; };
const release = (value: object) => assert(live.delete(value), 'owned GL handle releases once');
const gl = new Proxy({
  getShaderParameter: () => true, getProgramParameter: () => true,
  createShader: allocate, createProgram: allocate, createBuffer: allocate, createTexture: allocate,
  deleteShader: release, deleteProgram: release, deleteBuffer: release, deleteTexture: release,
  getAttribLocation: () => 0, getUniformLocation: () => ({}), isContextLost: () => false,
  getExtension: () => ({ loseContext() { loses++; } }),
}, { get(target, property) { return property in target ? Reflect.get(target, property) : /^[A-Z0-9_]+$/.test(String(property)) ? 0 : () => {}; } });
class FakeImage {
  naturalWidth = 1254; naturalHeight = 1254; decoding = ''; src = '';
  decode() { decodes++; return new Promise<void>((resolve, reject) => pending.push({ resolve, reject })); }
  removeAttribute() { releasedImages++; }
}
const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const oldImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  createElement() {
    const canvas = { width: 0, height: 0, getContext(kind: string) {
      return kind === 'webgl2' ? gl : { drawImage() {}, getImageData() {
        const data = new Uint8ClampedArray(canvas.width * canvas.height * 4); data.fill(64);
        return { data };
      } };
    } };
    return canvas;
  },
} });
const oldWorker=Object.getOwnPropertyDescriptor(globalThis,'Worker');
class SurfaceWorker {
 onmessage:((event:unknown)=>void)|null=null;onerror:((event:unknown)=>void)|null=null;onmessageerror=null;terminated=false;
 postMessage(request:R100SurfacePreparationRequest):void {
  const input=structuredClone(request.input);
  setTimeout(()=>{if(this.terminated)return;try{const result=executeR100SurfacePreparation(input);this.onmessage?.({data:{id:request.id,result}});}
   catch(error){this.onmessage?.({data:{id:request.id,error:String(error)}});}},0);
 }
 terminate():void{this.terminated=true;}
}
Object.defineProperty(globalThis,'Worker',{configurable:true,value:SurfaceWorker});
const drain = (fail = false) => {
  const batch = pending.splice(0); assert.equal(batch.length, 2);
  batch.forEach((item, i) => fail && i === 1 ? item.reject(new Error('intentional decode failure')) : item.resolve());
};
function context(layout: ReturnType<typeof createMasterWorld>['layout'], failImage = false) {
  const textures = new Set<string>(), objects = new Set<object>();
  const graphic = () => {
    const object = { setDepth() { return this; }, setVisible() { return this; }, clear() {}, fillRect() {}, fillStyle() {}, fillTriangle() {},
      createGeometryMask() { const mask = { destroy() { assert(objects.delete(mask)); } }; objects.add(mask); return mask; },
      destroy() { assert(objects.delete(object)); } };
    objects.add(object); return object;
  };
  const scene = { textures: {
    exists: (key: string) => textures.has(key),
    addImage(key: string) { assert(!textures.has(key)); textures.add(key); return { setFilter() {}, source: [{ update() {} }] }; },
    remove(key: string) { assert(textures.delete(key)); },
  }, add: {
    image() { if (failImage) throw new Error('intentional image failure'); const object = { setOrigin() { return this; }, setDepth() { return this; }, destroy() { assert(objects.delete(object)); } }; objects.add(object); return object; },
    graphics: graphic,
  } };
  return { textures, objects, value: { scene, layout, player: { id: 'player', objects: [], getPosition: () => layout.spawnPoint,
    getGroundY: () => layout.spawnPoint.y }, enemies: [],
    readPresentationFrame: () => ({ player: { position: layout.spawnPoint } }),
    readPollutionSources: () => [],
  } as unknown as RiftDevRuntimeContext };
}
try {
  assert.throws(() => getPreparedR100Presentation(first), /not prepared/);
  const stale = structuredClone(first); (stale.package as { dependencyHash: string }).dependencyHash = 'stale';
  await assert.rejects(prepareR100Presentation(stale,{world:worldFor(first)}), /available frozen/);
  assert.equal(decodes, 0);
  const priorAbort = new AbortController(); priorAbort.abort();
  await assert.rejects(prepareR100Presentation(first, { world:worldFor(first), signal: priorAbort.signal }), { name: 'AbortError' });
  assert.equal(decodes, 0, 'already cancelled request cannot start image decode');

  const cancelled = new AbortController();
  const waiting = prepareR100Presentation(first, { world:worldFor(first), signal: cancelled.signal });
  const rejection = assert.rejects(waiting, { name: 'AbortError' }); cancelled.abort(); await rejection;
  drain(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.throws(() => getPreparedR100Presentation(first), /not prepared/, 'late cancelled decode does not publish scene preparation');
  const paint = await prepareR100Presentation(first,{world:worldFor(first)});
  assert.equal(decodes, 2); assert.equal(getPreparedR100Presentation(first), paint);
  assert.throws(() => getPreparedR100Presentation(stale), /available frozen/);
  const other = list[1]!, controller = new AbortController();
  const left = prepareR100Presentation(other, { world:worldFor(other), signal: controller.signal }), right = prepareR100Presentation(other,{world:worldFor(other)});
  const rejectLeft = assert.rejects(left, { name: 'AbortError' }); controller.abort(); drain(); await rejectLeft;
  assert.equal(await right, getPreparedR100Presentation(other), 'one cancelled subscriber cannot cancel the survivor');
  const failure = prepareR100Presentation(list[2]!,{world:worldFor(list[2]!)}); const rejected = assert.rejects(failure, /decode failure/); drain(true); await rejected;
  assert.throws(() => getPreparedR100Presentation(list[2]!), /not prepared/);
  const retry = prepareR100Presentation(list[2]!,{world:worldFor(list[2]!)}); drain(); await retry;
  assert.equal(releasedImages, decodes, 'all temporary decoded images are released');

  // Three prepared worlds exceed the two-surface GPU bound; the oldest cannot
  // silently bake again during scene creation. Decode aliases remain shared.
  const firstMap=worldFor(first),native=firstMap.native!;
  requireR100GameplayPreparation(firstMap.layout);
  assert.throws(()=>createR100WorldPresentation(native,firstMap.layout,paint),/not prepared/);
  for(const world of worlds.values())discardPreparedR100Presentation(world);
  await prepareR100Presentation(first,{world:firstMap});
  const interrupted=createR100WorldPresentation(native,firstMap.layout,paint);
  assert(live.size>0);
  interrupted.disposeUnconsumed();interrupted.disposeUnconsumed();
  assert.equal(live.size,0,'interruption before createRuntime and repeated shutdown release preparation once');
  assert.throws(()=>readR100PreparedGameplay(firstMap.layout,native),/not prepared/,'interrupted GPU owner releases its gameplay preparation');
  assert.throws(()=>interrupted.createRuntime(context(firstMap.layout).value),/already consumed/);
  await prepareR100Presentation(first,{world:firstMap});
  const obsolete=createR100WorldPresentation(native,firstMap.layout,paint);
  await prepareR100Presentation(first,{world:firstMap});
  const replacementHandles=live.size;
  const replacementGameplay=readR100PreparedGameplay(firstMap.layout,native);
  assert(replacementHandles>0);
  obsolete.disposeUnconsumed();obsolete.disposeUnconsumed();
  assert.equal(live.size,replacementHandles,'old wrapper shutdown cannot release a new same-key preparation');
  assert.equal(readR100PreparedGameplay(firstMap.layout,native),replacementGameplay,'old wrapper cannot delete new gameplay preparation');
  assert.throws(()=>readR100PreparedGameplay(firstMap.layout,{...native,packageHash:'foreign'}),/identity differs/);
  assert.throws(()=>createR100WorldPresentation(native,{...firstMap.layout},paint),/different admitted layout/);
  assert.throws(()=>obsolete.createRuntime(context(firstMap.layout).value),/already consumed/);
  discardPreparedR100Presentation(firstMap);
  const afterReady=new AbortController();
  await prepareR100Presentation(first,{world:firstMap,signal:afterReady.signal});
  assert(live.size>0,'GPU receiver exists during preparation');
  afterReady.abort();assert.equal(live.size,0,'abort after GPU preparation releases unconsumed resources');
  assert.throws(()=>readR100PreparedGameplay(firstMap.layout,native),/not prepared/);
  assert.throws(()=>createR100WorldPresentation(native,firstMap.layout,paint),/not prepared/);
  await prepareR100Presentation(first,{world:firstMap});
  const sourceWorld=hydrateR100MasterWorld(native,firstMap.layout);
  const config = createR100WorldPresentation(native, sourceWorld.layout, paint);
  assert.equal(config.world.layout, sourceWorld.layout);
  for (let row = 0; row < sourceWorld.sight.rows; row++) for (let col = 0; col < sourceWorld.sight.cols; col++) {
    assert.equal(config.world.sight.isOpaque(col, row), sourceWorld.sight.isOpaque(col, row));
    assert.equal(config.world.combat.isOpaque(col, row), sourceWorld.combat.isOpaque(col, row));
  }
  const wrong = PAINTED_MATERIALS.find(row => row.family !== first.nativeDefinition.family)!;
  assert.throws(() => createR100WorldPresentation(native, sourceWorld.layout, { ...paint, source: wrong.source }), /does not match/);
  const failed = context(sourceWorld.layout, true), lostBefore = loses;
  assert.throws(() => config.createRuntime(failed.value), /intentional image failure/);
  assert.equal(failed.objects.size + failed.textures.size + live.size, 0);
  assert.equal(loses, lostBefore + 1, 'failed Phaser allocation also destroys the material renderer');
  assert.throws(()=>readR100PreparedGameplay(firstMap.layout,native),/not prepared/,'failed runtime constructor releases CPU admission preparation');

  const c1 = context(sourceWorld.layout), c2 = context(sourceWorld.layout);
  assert.throws(()=>config.createRuntime(c1.value),/already consumed/);
  const consumedController=new AbortController();
  await prepareR100Presentation(first,{world:firstMap,signal:consumedController.signal});
  const current=createR100WorldPresentation(native,sourceWorld.layout,paint);
  const a=current.createRuntime(c1.value),ownedHandles=live.size;
  const consumedGameplay=readR100PreparedGameplay(firstMap.layout,native);
  current.disposeUnconsumed();current.disposeUnconsumed();
  assert.equal(live.size,ownedHandles,'shutdown of preparation never destroys the consumed runtime');
  consumedController.abort();assert.equal(live.size,ownedHandles,'consuming removes preparation abort ownership');
  assert.equal(readR100PreparedGameplay(firstMap.layout,native),consumedGameplay,'consumed runtime retains admission facts after former abort');
  await prepareR100Presentation(first,{world:firstMap});
  const b=createR100WorldPresentation(native,sourceWorld.layout,paint).createRuntime(c2.value);
  const end = Math.round(first.nativeDefinition.motion_period * 800);
  for (let time = 0; time <= end; time += 100) { a.update(time, false); a.afterUpdate(); }
  const state = a.exportRuntimeState();
  assert(a.validateRuntimeState(state)); assert(validR100PresentationState(state, r100PresentationIdentity(first.nativeDefinition.id, sourceWorld.sample.seed,first.package.dependencyHash)));
  const next = state.lastElapsedMs + 100;
  b.restoreRuntimeState(structuredClone(state));
  assert.equal(b.snapshot().elapsedMs, a.snapshot().elapsedMs);
  assert.equal(b.snapshot().phase, a.snapshot().phase);
  assert.deepEqual(b.exportRuntimeState(), state, 'restoration preserves exact presentation and audio clocks');
  const invalid = { ...state, elapsedMs: Number.NaN }; assert(!a.validateRuntimeState(invalid));
  assert.throws(() => b.restoreRuntimeState(invalid), /Invalid/);
  assert(!validR100PresentationState({ ...state, identity: 'another-world' }, state.identity));
  assert(!validR100PresentationState({ ...state, audio: { ...state.audio, clock: state.elapsedMs + 1 } }));
  assert(!a.validateRuntimeState({ ...state, audio: { ...state.audio, sourceIndex: 100000 } }));
  a.update(next, false); b.update(next, false); a.afterUpdate(); b.afterUpdate();
  assert.deepEqual(a.exportRuntimeState(), b.exportRuntimeState(), 'same next frame continues the same phase without double advancement');
  a.setMotion(false); const paused = a.exportRuntimeState().elapsedMs;
  a.update(next + 1000, false); a.afterUpdate(); assert.equal(a.exportRuntimeState().elapsedMs, paused);
  a.destroy(); a.destroy(); b.destroy(); b.destroy();
  assert.equal(c1.objects.size + c1.textures.size + c2.objects.size + c2.textures.size + live.size, 0);

  // An audio restore resumes observed state rather than inventing a new event.
  let eventsA = 0, eventsB = 0;
  const audioA = new MasterMaterialAudio({ family: 'folded-slab', grade: 'severe', seed: 1 }, {
    playSFX(_key, config) { if (!config?.loop) eventsA++; }, stopInstance() {},
  });
  const audioB = new MasterMaterialAudio({ family: 'folded-slab', grade: 'severe', seed: 1 }, {
    playSFX(_key, config) { if (!config?.loop) eventsB++; }, stopInstance() {},
  });
  const listener = { x: 0, y: 0 }, sources = [{ x: 30, y: 0 }];
  audioA.update(0, 0, listener, sources); audioA.update(100, .5, listener, sources); audioA.update(200, .95, listener, sources);
  assert.equal(eventsA, 1); const audioState = audioA.exportRuntimeState(); assert(validMasterMaterialAudioState(audioState));
  audioB.restoreRuntimeState(audioState); audioB.update(300, .96, listener, sources); assert.equal(eventsB, 0, 'stress is not replayed');
  audioB.update(400, .5, listener, sources); assert.equal(eventsB, 1, 'future release remains audible once');
  audioB.update(450, .4, listener, sources); assert.equal(eventsB, 1);
  assert(!validMasterMaterialAudioState({ ...audioState, eventCount: -1 }));
  audioA.destroy(); audioB.destroy();
  // Regression for the real expedition save rejection: .006921 pressure was
  // silent, yet peak=0 < previousPressure. Exercise every frame, not just peaks.
  let audioFrames = 0;
  for (const available of [sources, [], [{ x: Number.NaN, y: 0 }]]) {
    const create = () => new MasterMaterialAudio({ family: 'folded-slab', grade: 'low', seed: 3390232493 },
      { playSFX() {}, stopInstance() {} });
    const uninterrupted = create(), restored = create();
    uninterrupted.update(0, 0, listener, available); restored.update(0, 0, listener, available);
    for (let frame = 1; frame <= 2400; frame++) {
      const time = frame * 1000 / 60;
      const pressure = Math.max(0, Math.sin(time / 19000 * Math.PI * 2));
      uninterrupted.update(time, pressure, listener, available);
      restored.update(time, pressure, listener, available);
      const state = uninterrupted.exportRuntimeState();
      assert(validMasterMaterialAudioState(state), `audio checkpoint frame ${frame}, pressure ${pressure}`);
      assert.deepEqual(restored.exportRuntimeState(), state, 'recovered audio continues without changing event/phase history');
      if (frame % 30 === 0) restored.restoreRuntimeState(structuredClone(state));
      audioFrames++;
    }
    uninterrupted.destroy(); restored.destroy();
  }
  console.log(JSON.stringify({ status: 'pass', checks: ['package identity and family preloads', 'abort before and during decode', 'cancelled late result not published',
    'shared subscriber independence', 'retry after paired decode failure', 'same pure DTO sight/combat rebuild', 'source family mismatch rejected',
    'Phaser allocation rollback releases GL', 'clock/phase/audio recovery', 'no duplicate stress event', 'pause freezes material time', 'idempotent disposal','GPU LRU disposal','abort after GPU preparation','consumed scene ignores former preparation abort',
    'pre-runtime interruption disposal','repeated preparation disposal','old wrapper cannot release replacement','consumed runtime retains renderer ownership','CPU gameplay cancellation/constructor-failure disposal','CPU gameplay replacement ownership','consumed admission cache preserved','foreign layout/package facts rejected'],
    audioFrames, scope: 'CPU lifecycle with fake browser/GL; native visual rendering and actual sound listening require real-game QA' }));
} finally {
  for(const world of worlds.values())discardPreparedR100Presentation(world);
  if(oldWorker)Object.defineProperty(globalThis,'Worker',oldWorker);else Reflect.deleteProperty(globalThis,'Worker');
  if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
  if (oldImage) Object.defineProperty(globalThis, 'Image', oldImage); else Reflect.deleteProperty(globalThis, 'Image');
}
