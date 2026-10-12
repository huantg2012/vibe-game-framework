/** Grounded-search runtime contracts. Real modules; only browser/GL/DOM ports are
 * adapted. This is not a GPU pixel, browser performance or art-quality verdict.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/pickup-grounding/check-runtime.ts
 * Add --production for one actual r9 Worker preparation/transfer fixture. */
import assert from 'node:assert/strict';
import type { MasterWorld } from '../../src/generation/world-study/r100-master-world';
import type { R100SearchSitePlacement } from '../../src/generation/world-study/search-site-types';
import type { SearchSiteMaterialPatch, SearchSiteSurfaceChannels } from '../../src/systems/r100-world/search-site-bake';
import type { MasterSurfaceBake } from '../../src/systems/r100-world/surface-bake';
import { SEARCH_SITE_CHANNELS, applySearchSitePatch, validateSearchSitePatches } from '../../src/systems/r100-world/search-site-patches';
import { MasterSurfaceRenderer } from '../../src/systems/r100-world/surface-renderer';
import { MasterPresentation } from '../../src/systems/r100-world/presentation';
import { createSurfaceSearchObjectVisual } from '../../src/systems/loot-search-presentation';
import { r100NativePreparationIdentity } from '../../src/systems/r100-world/prepared-gameplay';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';

const checks: string[] = [];
function check(name: string, run: () => void): void { run(); checks.push(name); }
function channels(width: number, height: number, value: number): SearchSiteSurfaceChannels {
  return Object.fromEntries(SEARCH_SITE_CHANNELS.map((name, index) => [name,
    new Uint8Array(width * height * 4).fill(value + index)])) as unknown as SearchSiteSurfaceChannels;
}
function site(nodeId = 'site-a', x = 16, y = 16): R100SearchSitePlacement {
  return { version: 1, nodeId, position: { x, y }, visualSeed: 29, sourceKind: 'ground-accumulation',
    family: 'folded-slab', groundFamily: 'folded-slab', sourceDomain: 'ground',
    sourceObjectId: null, sourceAnchor: null, axis: 0, footprintProfile: 'grounded-material-v1' };
}
function patch(nodeId = 'site-a', x = 14, y = 14): SearchSiteMaterialPatch {
  return { nodeId, x, y, width: 4, height: 4, intact: channels(4, 4, 41), searched: channels(4, 4, 11) };
}
function tinyWorld(sites: readonly R100SearchSitePlacement[] | undefined = [site()]): MasterWorld {
  return { algorithmRevision: sites ? 9 : 8, packageHash: 'test-receiver',
    raster: { width: 64, height: 64 }, searchSites: sites, matterAt: () => true, roleAt: () => null,
    layout: { seed: 23, spawnPoint: { x: 16, y: 16 }, tileMap: { cols: 2, rows: 2, tileSize: 32 } },
    definition: { id: 'test-receiver', family: 'folded-slab', grade: 'medium', axis: 0, erosion: [], motion_period: 30 },
    sample: { seed: 23, profile: WORLD_PROFILES[0] }, meshes: [], diagnostics: {},
  } as unknown as MasterWorld;
}
const receiver = (): MasterSurfaceBake => ({ width: 64, height: 64, ...channels(64, 64, 5), diagnostics: {} });

check('receiving contract rejects missing/duplicate/foreign patches, malformed channels and unsupported geometry', () => {
  const world = tinyWorld(), good = patch();
  validateSearchSitePatches(world, [good]);
  const legacy = { ...world, algorithmRevision: 8 as const, searchSites: undefined };
  validateSearchSitePatches(legacy, undefined);
  assert.throws(() => validateSearchSitePatches(legacy, []), /Legacy/);
  assert.throws(() => validateSearchSitePatches(world, undefined), /count/);
  assert.throws(() => validateSearchSitePatches(world, []), /count/);
  assert.throws(() => validateSearchSitePatches(world, [{ ...good, nodeId: 'foreign' }]), /identity/);
  for (const change of [{ x: -1 }, { x: 14.5 }, { y: NaN }, { width: 81 }, { height: 65 }, { width: 0 }, { x: 63 }, { x: 20 }]) {
    assert.throws(() => validateSearchSitePatches(world, [{ ...good, ...change }]), /bounds/);
  }
  for (const phase of ['intact', 'searched'] as const) for (const channel of SEARCH_SITE_CHANNELS) {
    for (const bad of [undefined, new Uint8Array(1), new Uint8ClampedArray(64), Array(64).fill(0)]) {
      assert.throws(() => validateSearchSitePatches(world,
        [{ ...good, [phase]: { ...good[phase], [channel]: bad } } as SearchSiteMaterialPatch]), /channels/);
    }
  }
  assert.throws(() => validateSearchSitePatches(tinyWorld([site(), site()]), [good, good]), /Duplicate/);
  const two = tinyWorld([site(), site('site-b', 18, 18)]);
  assert.throws(() => validateSearchSitePatches(two, [good, good]), /identity/);
  assert.throws(() => validateSearchSitePatches(two, [good, patch('site-b', 16, 16)]), /overlap/);
  const voidWorld = { ...world, matterAt: (x: number, y: number) => x !== 14 || y !== 14 };
  const cleared = structuredClone(good);
  for (const state of [cleared.intact, cleared.searched]) for (const channel of SEARCH_SITE_CHANNELS) state[channel].fill(0, 0, 4);
  validateSearchSitePatches(voidWorld, [cleared]);
  for (const phase of ['intact', 'searched'] as const) for (const channel of SEARCH_SITE_CHANNELS) {
    const dirty = structuredClone(cleared); dirty[phase][channel][0] = 1;
    assert.throws(() => validateSearchSitePatches(voidWorld, [dirty]), /absent terrain/);
  }
});

check('CPU patch composition changes exactly the transport rectangle and never mutates either phase', () => {
  const surface = receiver(), before = structuredClone(surface), p = patch(), frozen = structuredClone(p);
  applySearchSitePatch(surface, p, p.intact);
  for (const channel of SEARCH_SITE_CHANNELS) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const q = (y * 64 + x) * 4, inside = x >= 14 && x < 18 && y >= 14 && y < 18;
    assert.deepEqual(surface[channel].subarray(q, q + 4), inside ? p.intact[channel].subarray(0, 4) : before[channel].subarray(q, q + 4));
  }
  assert.deepEqual(p, frozen);
});

/** This adapter executes texture ownership and byte uploads, not shaders. */
const live = new Set<object>(), texturePixels = new Map<object, Uint8Array>();
const operations: string[] = [];
let activeUnit = 0, bound: object | null = null, fullUploads = 0, partialUploads = 0, lost = 0;
const allocate = () => { const value = {}; live.add(value); return value; };
const release = (value: object) => { assert(live.delete(value), 'GL handle must release once'); texturePixels.delete(value); };
const gl = new Proxy({
  TEXTURE0: 100, getShaderParameter: () => true, getProgramParameter: () => true,
  createShader: allocate, createProgram: allocate, createBuffer: allocate, createTexture: allocate,
  deleteShader: release, deleteProgram: release, deleteBuffer: release, deleteTexture: release,
  getAttribLocation: () => 0, getUniformLocation: () => ({}), isContextLost: () => false,
  getExtension: () => ({ loseContext() { lost++; } }),
  activeTexture(unit: number) { activeUnit = unit - 100; }, bindTexture(_target: number, texture: object) { bound = texture; },
  texImage2D(...args: unknown[]) { assert(bound); texturePixels.set(bound, (args.at(-1) as Uint8Array).slice()); fullUploads++; },
  texSubImage2D(_target: number, _level: number, x: number, y: number, width: number, height: number,
    _format: number, _type: number, pixels: Uint8Array) {
    assert(bound); const data = texturePixels.get(bound)!; assert(data);
    for (let row = 0; row < height; row++) data.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), ((y + row) * 64 + x) * 4);
    operations.push(`patch:${activeUnit}`); partialUploads++;
  },
  drawArrays() { operations.push('draw'); },
}, { get: (target, property) => property in target ? Reflect.get(target, property)
  : /^[A-Z0-9_]+$/.test(String(property)) ? 0 : () => {} });
const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  createElement: () => ({ width: 0, height: 0, getContext: () => gl }),
} });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'zh-CN' } });

interface FakeImage { x: number; y: number; key: string; visible: boolean; active: boolean; destroyed: boolean; [key: string]: unknown }
function sceneFixture() {
  const textures = new Set<string>(), images: FakeImage[] = [], tweens: unknown[] = [], graphics = new Set<object>();
  const graphic = () => {
    const g = new Proxy({}, { get: (_target, name) => name === 'generateTexture' ? (key: string) => textures.add(key)
      : name === 'destroy' ? () => assert(graphics.delete(g), 'graphics disposed once')
      : name === 'createGeometryMask' ? () => ({ destroy() {} }) : () => g });
    graphics.add(g); return g;
  };
  const image = (x: number, y: number, key: string) => {
    const state: FakeImage = { x, y, key, visible: true, active: true, destroyed: false };
    const object = new Proxy(state, { get: (value, key: string) => key in value ? value[key] : (...args: unknown[]) => {
      if (key === 'destroy') { assert(!state.destroyed); state.destroyed = true; }
      else if (key === 'setVisible') state.visible = Boolean(args[0]);
      else if (key === 'setActive') state.active = Boolean(args[0]);
      else if (key === 'setTexture') state.key = String(args[0]);
      else if (key === 'setPosition') { state.x = Number(args[0]); state.y = Number(args[1]); }
      else if (key === 'setX') state.x = Number(args[0]);
      return object;
    } }); images.push(object); return object;
  };
  return { images, tweens, textures, graphics, scene: { add: { image, graphics: graphic }, make: { graphics: graphic },
    textures: { exists: (key: string) => textures.has(key), remove: (key: string) => assert(textures.delete(key)),
      addImage(key: string) { textures.add(key); return { setFilter() {}, source: [{ update() {} }] }; } },
    tweens: { add: (value: unknown) => tweens.push(value), killTweensOf() {} },
  } };
}

try {
  check('renderer uploads four bounded channels only on phase changes; release drops CPU/GPU ownership', () => {
    const surface = receiver(), p = patch(); applySearchSitePatch(surface, p, p.intact);
    const renderer = new MasterSurfaceRenderer(tinyWorld(), undefined, undefined, undefined, surface, [p]);
    const full = fullUploads, partial = partialUploads, losses = lost;
    assert.equal(full, 4); assert.equal(renderer.searchDiagnostics().cpuBytes, 4 * 4 * 4 * 4 * 2);
    renderer.setSearchSiteCollected('site-a', false); assert.equal(partialUploads, partial);
    renderer.setSearchSiteCollected('site-a', true); assert.equal(partialUploads, partial + 4);
    for (let i = 0; i < 120; i++) renderer.setSearchSiteCollected('site-a', true);
    assert.equal(partialUploads, partial + 4, '120 stable frames cannot upload');
    assert.equal(fullUploads, full, 'collected must not reupload the full native surface');
    assert.deepEqual(renderer.searchDiagnostics().collected, ['site-a']);
    for (const [index, pixels] of [...texturePixels.values()].entries()) {
      assert.deepEqual(pixels.subarray((14 * 64 + 14) * 4, (14 * 64 + 14) * 4 + 4), p.searched[SEARCH_SITE_CHANNELS[index]!].subarray(0, 4));
      assert.equal(pixels[0], 5 + index, 'unrelated surface remains byte-identical');
    }
    renderer.setSearchSiteCollected('site-a', false); assert.equal(partialUploads, partial + 8);
    assert.throws(() => renderer.setSearchSiteCollected('unknown-node', true), /admitted/);
    renderer.destroy(); renderer.destroy(); renderer.setSearchSiteCollected('site-a', true);
    assert.equal(live.size, 0); assert.equal(texturePixels.size, 0); assert.equal(lost, losses + 1);
    assert.equal(renderer.searchDiagnostics().cpuBytes, 0); assert.equal(renderer.searchDiagnostics().count, 0);
    assert.equal(partialUploads, partial + 8);
  });

  check('restored collected frame is synchronized before the first draw; unchanged frames never upload', () => {
    const world = tinyWorld(), surface = receiver(), p = patch(); applySearchSitePatch(surface, p, p.intact);
    const renderer = new MasterSurfaceRenderer(world, undefined, undefined, undefined, surface, [p]);
    const f = sceneFixture(), frame = { player: { position: { x: 16, y: 16 } }, piles: [{ id: p.nodeId, collected: true }] };
    const runtime = new MasterPresentation({ scene: f.scene, layout: world.layout,
      player: { id: 'player', objects: [], getPosition: () => frame.player.position, getGroundY: () => 16 }, enemies: [],
      readPresentationFrame: () => frame, readPollutionSources: () => [],
    } as never, world, undefined, renderer, []);
    const before = operations.length;
    runtime.restoreRuntimeState(runtime.exportRuntimeState());
    assert.equal(operations.length, before, 'restoring clocks alone cannot draw stale intact pixels');
    runtime.afterUpdate(); assert.deepEqual(operations.slice(before), ['patch:0', 'patch:1', 'patch:2', 'patch:3', 'draw']);
    const stable = partialUploads; runtime.afterUpdate(); assert.equal(partialUploads, stable);
    assert.equal(f.tweens.length, 0, 'state synchronization never replays reveal particles');
    assert.equal((runtime.snapshot().sounds as { eventCount: number }).eventCount, 0);
    runtime.destroy(); runtime.destroy(); assert.equal(live.size, 0); assert.equal(f.graphics.size, 0);
    assert(f.images.every(img => img.destroyed));
  });

  check('legacy presentation neither asks for grounded node state nor acquires patch buffers', () => {
    const world = { ...tinyWorld(), algorithmRevision: 8 as const, searchSites: undefined }, f = sceneFixture();
    const renderer = new MasterSurfaceRenderer(world, undefined, undefined, undefined, receiver());
    const frame = { player: { position: { x: 16, y: 16 } } };
    Object.defineProperty(frame, 'piles', { get() { throw new Error('legacy should not request grounded state'); } });
    const runtime = new MasterPresentation({ scene: f.scene, layout: world.layout,
      player: { id: 'player', objects: [], getPosition: () => frame.player.position, getGroundY: () => 16 }, enemies: [],
      readPresentationFrame: () => frame, readPollutionSources: () => [],
    } as never, world, undefined, renderer, []);
    const before = partialUploads; runtime.afterUpdate(); assert.equal(partialUploads, before);
    assert.equal(renderer.searchDiagnostics().count, 0); assert.equal(renderer.searchDiagnostics().cpuBytes, 0);
    runtime.destroy(); assert.equal(live.size, 0);
  });

  check('surface-only visual has no shell/ambient shimmer; only actual rummage/reveal starts effects', () => {
    const f = sceneFixture(), visual = createSurfaceSearchObjectVisual(f.scene as never, { x: 16, y: 16 }, 29,
      { shadow: 1, stain: 2, body: 3, highlight: 4 }, () => ({ x: 8, y: 8 }));
    assert.equal(f.images.length, 8, 'only existing 2 chip + 6 reveal pool images');
    assert(f.images.every(img => ['__loot_search_chip', '__loot_search_crystal'].includes(img.key)));
    assert([...f.textures].every(key => ['__loot_search_chip', '__loot_search_crystal', '__loot_search_mote'].includes(key)));
    for (let i = 0; i < 120; i++) visual.update(1000);
    assert.equal(f.tweens.length, 0); assert(f.images.every(img => !img.visible));
    visual.setRummaging(true); visual.update(2000); assert.equal(f.tweens.length, 1);
    visual.setVisibility(0); assert(f.images.every(img => !img.visible));
    visual.setRummaging(false); visual.setVisibility(1);
    visual.playReveal({ kind: 'kindling', playerPos: { x: 8, y: 8 } }); assert.equal(f.tweens.length, 7);
    const after = f.tweens.length; visual.update(10000); assert.equal(f.tweens.length, after);
    visual.destroy(); visual.destroy(); assert(f.images.every(img => img.destroyed));
  });

  // Actual search/inventory authority, with only the HUD and drawing adapted.
  const { LootSearchSystem } = await import('../../src/systems/loot-search-system');
  const { inventoryStore } = await import('../../src/systems/inventory-store');
  const { contaminantSystem } = await import('../../src/systems/contaminant-system');
  const { audioManager } = await import('../../src/managers/audio-manager');
  const originalSfx = audioManager.playSFX, originalStop = audioManager.stopLoop;
  let soundCount = 0; audioManager.playSFX = () => { soundCount++; }; audioManager.stopLoop = () => {};
  try {
    check('real E interruption, durable refusal, overflow and cold restore preserve collected and one reward', () => {
      inventoryStore.setPersistence(null); contaminantSystem.reset(); assert(inventoryStore.beginRun('grounding-runtime-test').ok);
      function makeSearch(contaminant = false) {
        const f = sceneFixture(), system = new LootSearchSystem(); let starts = 0;
        Object.assign((system as unknown as { hud: object }).hud,
          { create() {}, destroy() {}, setPrompt() {}, setChannel() {}, setKindling() {}, flashKindling() {}, flashResidue() {} });
        system.create(f.scene as never,
          contaminant ? [] : [{ id: 'site-a', position: { x: 16, y: 16 }, tier: 'safe', value: 1, allowWeapon: false }],
          contaminant ? [{ id: 'site-a', position: { x: 16, y: 16 }, tier: 'safe' }] : [],
          { overlayRoot: {} as never, getVisibilityAt: () => 1, fragmentTypeId: 'frag-outdoor', runSeed: 23, inventoryEnabled: true,
            onNoise: () => { starts++; }, createVisual: (scene, position, seed, player) => createSurfaceSearchObjectVisual(scene, position, seed,
              { shadow: 1, stain: 2, body: 3, highlight: 4 }, player) });
        const input = (held: boolean, dt: number) => system.update(dt, { playerPos: { x: 16, y: 16 }, searchHeld: held,
          moving: false, attacking: false, toolPressed: false, hitThisFrame: false, paused: false });
        return { f, system, input, starts: () => starts };
      }
      const a = makeSearch(); a.input(true, 0); a.input(true, 400); a.input(false, 0);
      assert.equal(a.system.getPresentationNodes()[0]!.collected, false); assert.equal(a.system.getCarriedKindling(), 0);
      a.input(true, 0); a.input(true, 1200);
      assert.equal(a.system.getPresentationNodes()[0]!.collected, true); assert.equal(a.system.getCarriedKindling(), 1);
      assert.equal(a.system.getUncollectedSearchPositions().length, 0);
      const cut = structuredClone(a.system.exportRuntimeState()), inv = inventoryStore.getState(); a.system.destroy();
      assert(inventoryStore.loadState(inv)); const b = makeSearch(), soundsBefore = soundCount;
      b.system.restoreRuntimeState(cut); assert.equal(soundCount, soundsBefore); assert.equal(b.starts(), 0);
      assert.equal(b.f.tweens.length, 0); assert.equal(b.system.getPresentationNodes()[0]!.collected, true);
      b.input(false, 0); b.input(true, 2400);
      assert.equal(b.system.getCarriedKindling(), 1); assert.equal(b.f.tweens.length, 0); assert.equal(b.starts(), 0);
      assert.equal(b.system.getUncollectedSearchPositions().length, 0); b.system.destroy();

      contaminantSystem.reset(); inventoryStore.configure({ capacity: inventoryStore.getCarryWeight() });
      assert(inventoryStore.beginRun('grounding-overflow-test').ok);
      const startingItems = inventoryStore.getItems().length;
      const c = makeSearch(true);
      inventoryStore.setPersistence(() => { throw new Error('Expected grounded-search durable refusal'); });
      c.input(true, 0); c.input(true, 1200);
      const refused = c.system.exportRuntimeState(); assert.equal(refused.nodes[0]!.collected, false);
      assert(refused.nodes[0]!.revealedItem, 'durable refusal retains the fixed roll for retry');
      assert.equal(inventoryStore.getItems().length, startingItems, 'refusal cannot consume or publish the reward');
      const fixedItem = structuredClone(refused.nodes[0]!.revealedItem);
      inventoryStore.setPersistence(null); c.input(false, 0); c.input(true, 0); c.input(true, 1200);
      assert.equal(c.system.getPresentationNodes()[0]!.collected, true);
      assert.deepEqual(c.system.exportRuntimeState().nodes[0]!.revealedItem, fixedItem);
      const item = inventoryStore.getItems().find(value => value.source?.nodeId === 'site-a')!;
      assert.equal(item.location.kind, 'ground');
      assert.deepEqual(item.location.kind === 'ground' && item.location.position, { x: 16, y: 16 });
      assert.equal(c.system.getUncollectedSearchPositions().length, 0, 'remnant cannot contend for E with ground loot');
      const overflowCut = structuredClone(c.system.exportRuntimeState()), overflowInventory = inventoryStore.getState(); c.system.destroy();
      assert(inventoryStore.loadState(overflowInventory)); const d = makeSearch(true), beforeOverflowRestore = soundCount;
      d.system.restoreRuntimeState(overflowCut); assert.equal(soundCount, beforeOverflowRestore); assert.equal(d.f.tweens.length, 0);
      assert.equal(inventoryStore.getItems().length, startingItems + 1, 'restoring a searched remnant cannot duplicate ground loot');
      assert.equal(inventoryStore.getItem(item.id)?.location.kind, 'ground'); d.system.destroy();
      inventoryStore.configure({ capacity: 10000 });
    });
  } finally { audioManager.playSFX = originalSfx; audioManager.stopLoop = originalStop; }
} finally {
  if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
}

if (process.argv.includes('--production')) {
  const { createR100ProductionRecipe } = await import('../../src/generation/world-study/r100-package');
  const { createR100ProductionMap } = await import('../../src/generation/world-study/r100-production-map');
  const { executeR100SurfacePreparation, validateR100SurfacePreparation } = await import('../../src/systems/r100-world/surface-preparation');
  const recipe = createR100ProductionRecipe('pale-sail', 20261012, 'medium');
  assert.equal(recipe.package.algorithmRevision, 9);
  const map = createR100ProductionMap(recipe), native = map.native!;
  const pixels = new Uint8ClampedArray(16 * 16 * 4).fill(96);
  for (let q = 3; q < pixels.length; q += 4) pixels[q] = 255;
  const painting = { width: 16, height: 16, worldSize: 128, source: 'runtime-test-material', pixels,
    solid: { width: 16, height: 16, worldSize: 128, source: 'runtime-test-solid', pixels,
      skinRoughness: .8, cutRoughness: .9, gain: 1, cutGain: 1 } };
  const input = { native, layout: map.layout, painting };
  const prepared = executeR100SurfacePreparation(input);
  check('actual r9 Worker result binds source provenance; rejects missing phase buffers or foreign world identity', () => {
    validateR100SurfacePreparation(prepared, input); assert(prepared.searchPatches?.length);
    const originalIdentity = r100NativePreparationIdentity(native);
    const changed = structuredClone(native); (changed.searchSites![0] as { visualSeed: number }).visualSeed ^= 123;
    assert.notEqual(r100NativePreparationIdentity(changed), originalIdentity);
    assert.throws(() => validateR100SurfacePreparation({ ...prepared, identity: 'foreign' }, input), /match/);
    assert.throws(() => validateR100SurfacePreparation({ ...prepared, searchPatches: undefined }, input), /count/);
    assert.throws(() => validateR100SurfacePreparation(prepared, { ...input, native: changed }), /match/);
    for (const channel of SEARCH_SITE_CHANNELS) for (const phase of ['intact', 'searched'] as const) {
      const patches = prepared.searchPatches!.map((value, index) => index ? value : {
        ...value, [phase]: { ...value[phase], [channel]: new Uint8Array(0) },
      });
      assert.throws(() => validateR100SurfacePreparation({ ...prepared, searchPatches: patches }, input), /channels/);
    }
    // Exact detached transfer copy, including both phases, must survive receipt;
    // original native and source material inputs remain owned by the caller.
    const derived = structuredClone(prepared), buffers = new Set<ArrayBuffer>();
    function collect(value: unknown): void {
      if (ArrayBuffer.isView(value)) { buffers.add(value.buffer as ArrayBuffer); return; }
      if (value instanceof Map) { for (const item of value.values()) collect(item); }
      else if (value && typeof value === 'object') for (const item of Object.values(value)) collect(item);
    }
    collect(derived); const received = structuredClone(derived, { transfer: [...buffers] });
    assert([...buffers].every(buffer => buffer.byteLength === 0));
    validateR100SurfacePreparation(received, input); assert.equal(pixels.byteLength, 1024);
    assert(native.raster.objectId.byteLength > 0, 'caller native input is never detached');
  });
}
console.log(JSON.stringify({ status: 'pass', checks, scope: 'CPU runtime/transport contracts with fake GL and DOM; --production adds one real r9 preparation. No native GPU pixels, FOV image, browser budget or user aesthetic verdict.' }, null, 2));
