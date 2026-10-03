/** Real visual factory; texture/scene adapters only. Not a browser art verdict. */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import Phaser from 'phaser';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { buildRemainsReflection } from '../../src/systems/search-remains-ambient';
import { createSearchRemainsPixels } from '../../src/generation/world-study/search-remains';
import { createWorldSearchVisual } from '../../src/systems/world-search-presentation';

// The CPU Phaser host intentionally carries only constants used by these tests.
Object.assign(Phaser, { Scenes: { Events: { SHUTDOWN: 'shutdown' } } });
const textures = new Map<string, Uint8ClampedArray>();
const images: any[] = [];
const removed: string[] = [];
let failUpload = false;
let failFlakeAt = -1;
const manager = {
  exists: (key: string) => textures.has(key),
  createCanvas(key: string, w: number, h: number) {
    textures.set(key, new Uint8ClampedArray(w * h * 4));
    return {
      getContext: () => ({
        createImageData: () => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (data: { data: Uint8ClampedArray }) => {
          if (failUpload) throw new Error('upload failed');
          textures.set(key, data.data.slice());
        },
      }), refresh() {}, setFilter() {},
    };
  },
  remove(key: string) { assert(textures.delete(key), `double removal ${key}`); removed.push(key); },
};
function makeScene() {
  const events = new EventEmitter();
  const killed: unknown[] = [];
  const scene: any = {
    textures: manager, events,
    tweens: { killTweensOf: (image: unknown) => killed.push(image), add() {} },
    make: { graphics() {
      const g = new Proxy({}, { get: (_target, key) => key === 'generateTexture'
        ? (name: string) => textures.set(name, new Uint8ClampedArray(4)) : () => g });
      return g;
    } },
    add: { image(x: number, y: number, key: string) {
      const state: any = { x, y, key, visible: true, alpha: 1, destroyed: false };
      const setters: Record<string, (...args: any[]) => void> = {
        setVisible: value => { state.visible = value; }, setAlpha: value => { state.alpha = value; },
        setTexture: value => { state.key = value; }, setDepth: value => { state.depth = value; }, setName: value => { state.name = value; },
        setX: value => { state.x = value; }, setPosition: (nx, ny) => { state.x = nx; state.y = ny; },
        destroy: () => { assert(!state.destroyed, 'double sprite destroy'); state.destroyed = true; },
      };
      const object = new Proxy(state, { get: (target, prop: string) => prop in target ? target[prop]
        : (...args: any[]) => { setters[prop]?.(...args); return object; } });
      images.push(object); return object;
    } },
  };
  scene.add.rectangle = (x: number, y: number, width: number, height: number, color: number) => {
    if (failFlakeAt > 0 && --failFlakeAt === 0) throw new Error('flake allocation failed');
    return scene.add.image(x, y, `rectangle:${color}`);
  };
  return { scene, killed, events };
}
const a = makeScene(), b = makeScene(), position = { x: 100, y: 90 }, profile = WORLD_PROFILES[0]!;
const create = (s = a, seed = 7, p = profile) => createWorldSearchVisual(s.scene as never, position, seed, () => position, p, 123);
const first = create(), second = create(b);
const worldKeys = () => [...textures.keys()].filter(key => key.startsWith('__world_search_'));
assert.equal(worldKeys().length, 1, 'two live scenes share identical source pixels');
const firstKey = worldKeys()[0]!;
const mainSprite = images.find(img => img.name?.startsWith('search-remains:'));
const ambient = (first as any).appearance.ambient;
const sheen = ambient.sheen;
const flakes = ambient.flakes;
first.setVisibility(0); assert.equal(mainSprite.alpha, 0, 'outside sight is invisible');
first.setVisibility(1); first.setRummaging(true); first.update(50); first.setRummaging(false);
assert.deepEqual([mainSprite.x, mainSprite.y], [position.x, position.y], 'interrupt restores object location');
// Visible idle motion changes only sparse material facets and small falling chips.
first.setRummaging(false);
let litFrames = 0, flakeFrames = 0;
for (let i = 0; i < 240; i++) {
  first.update(50);
  if (sheen.visible && sheen.alpha > .1) litFrames++;
  if (flakes.some((p: any) => p.visible)) flakeFrames++;
  assert.deepEqual([mainSprite.x, mainSprite.y], [position.x, position.y], 'Idle body never bobs or slides');
}
assert(litFrames > 10 && litFrames < 110 && flakeFrames > 10, 'Intermittent visible movement with quiet gaps');
const clockBefore = ambient.elapsed;
first.update(0); assert.equal(ambient.elapsed, clockBefore, 'zero simulation delta cannot move accents');
first.setVisibility(0); first.update(2000);
assert(!sheen.visible && flakes.every((p: any) => !p.visible), 'Hidden source hides every effect immediately');
assert.equal(ambient.elapsed, clockBefore, 'hidden objects do not run an offscreen reveal cycle');
first.setVisibility(1); first.setRummaging(true); first.update(100);
assert(!sheen.visible && flakes.every((p: any) => !p.visible), 'Interaction uses its own feedback');
first.setRummaging(false);
ambient.motionPreference = { matches: true }; first.update(1000);
assert(!sheen.visible && flakes.every((p: any) => !p.visible), 'Reduced motion keeps the clear static body');
ambient.motionPreference = null;
first.playReveal({ kind: 'kindling', playerPos: position });
assert(!sheen.visible && flakes.every((p: any) => !p.visible), 'Completed object leaves no idle effects');
assert.equal(mainSprite.visible, false, 'completed shell stays removed');
first.destroy(); first.destroy();
assert(manager.exists(firstKey), 'one scene cannot release another scene’s live pixels');
assert(a.killed.length >= 9, 'visual destroys its sprite and effect tweens');
b.events.emit('shutdown');
assert(!manager.exists(firstKey), 'scene shutdown releases last texture owner');
second.destroy();
assert.equal(removed.filter(key => key === firstKey).length, 1, 'shutdown/destroy release once');
const third = create(); assert.equal(worldKeys().length, 1, 'same source can be recreated after removal'); third.destroy();
for (const p of WORLD_PROFILES) {
  const v = create(a, 11, p); assert.equal(worldKeys().length, 1);
  assert(worldKeys()[0]!.includes(p.id), 'texture is qualified by real world source'); v.destroy();
}
assert.equal(a.events.listenerCount('shutdown'), 0, 'no stale shutdown listeners');
assert.equal(worldKeys().length, 0, 'all world textures released');
assert(![...textures.keys()].some(key => key.startsWith('__search_remains_sheen_')), 'Reflection textures also released');
failUpload = true;
assert.throws(() => create(a, 19), /upload failed/);
assert.equal(worldKeys().length, 0, 'failed texture upload leaves no allocation');
assert.equal(a.events.listenerCount('shutdown'), 0);
failUpload = false;
failFlakeAt = 2;
const imagesBeforeFailure = images.length;
assert.throws(() => create(a, 31), /flake allocation failed/);
assert(images.slice(imagesBeforeFailure).every(image => image.destroyed), 'Partially created ambient objects roll back');
assert(![...textures.keys()].some(key => key.startsWith('__search_remains_sheen_') || key.startsWith('__world_search_')), 'Partial ambient failure releases both textures');
assert.equal(a.events.listenerCount('shutdown'), 0, 'Partial ambient failure releases shutdown listener');
for (const profile of WORLD_PROFILES) {
  const base = createSearchRemainsPixels(profile, 7), mask = buildRemainsReflection(base);
  let marked = 0;
  for (let i = 0; i < mask.pixels.length; i += 4) if (mask.pixels[i + 3]) {
    marked++; assert.equal(base.pixels[i + 3], 255, 'Reflection must sit on existing material');
  }
  assert(marked >= 3 && marked <= 15, `Only small facets reflect, not whole-body pulse (${marked})`);
  assert(mask.accents.length >= 1 && mask.accents.length <= 3);
}
console.log(JSON.stringify({ status: 'pass', scope: 'CPU factory lifecycle / visibility / reveal, fake scene; not visual approval',
  profiles: WORLD_PROFILES.length, checks: ['sparse reflected material only', 'idle body stationary', 'hidden/paused/reduced motion effects', 'shared texture ownership', 'source-qualified identity', 'reveal removes shell',
    'search interruption restores position', 'visibility zero', 'tween cleanup', 'shutdown/destroy idempotence', 'upload rollback'] }));
