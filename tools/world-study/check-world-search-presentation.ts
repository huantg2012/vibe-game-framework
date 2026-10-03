/** Real visual factory; texture/scene adapters only. Not a browser art verdict. */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import Phaser from 'phaser';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { createWorldSearchVisual } from '../../src/systems/world-search-presentation';

// The CPU Phaser host intentionally carries only constants used by these tests.
Object.assign(Phaser, { Scenes: { Events: { SHUTDOWN: 'shutdown' } } });
const textures = new Map<string, Uint8ClampedArray>();
const images: any[] = [];
const removed: string[] = [];
let failUpload = false;
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
  const scene = {
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
        setTexture: value => { state.key = value; }, setName: value => { state.name = value; },
        setX: value => { state.x = value; }, setPosition: (nx, ny) => { state.x = nx; state.y = ny; },
        destroy: () => { assert(!state.destroyed, 'double sprite destroy'); state.destroyed = true; },
      };
      const object = new Proxy(state, { get: (target, prop: string) => prop in target ? target[prop]
        : (...args: any[]) => { setters[prop]?.(...args); return object; } });
      images.push(object); return object;
    } },
  };
  return { scene, killed, events };
}
const a = makeScene(), b = makeScene(), position = { x: 100, y: 90 }, profile = WORLD_PROFILES[0]!;
const create = (s = a, seed = 7, p = profile) => createWorldSearchVisual(s.scene as never, position, seed, () => position, p, 123);
const first = create(), second = create(b);
const worldKeys = () => [...textures.keys()].filter(key => key.startsWith('__world_search_'));
assert.equal(worldKeys().length, 1, 'two live scenes share identical source pixels');
const firstKey = worldKeys()[0]!;
first.setVisibility(0); assert.equal(images[0].alpha, 0, 'outside sight is invisible');
first.setVisibility(1); first.setRummaging(true); first.update(50); first.setRummaging(false);
assert.deepEqual([images[0].x, images[0].y], [position.x, position.y], 'interrupt restores object location');
first.playReveal({ kind: 'kindling', playerPos: position });
assert.equal(images[0].visible, false, 'completed shell stays removed');
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
failUpload = true;
assert.throws(() => create(a, 19), /upload failed/);
assert.equal(worldKeys().length, 0, 'failed texture upload leaves no allocation');
assert.equal(a.events.listenerCount('shutdown'), 0);
console.log(JSON.stringify({ status: 'pass', scope: 'CPU factory lifecycle / visibility / reveal, fake scene; not visual approval',
  profiles: WORLD_PROFILES.length, checks: ['shared texture ownership', 'source-qualified identity', 'reveal removes shell',
    'search interruption restores position', 'visibility zero', 'tween cleanup', 'shutdown/destroy idempotence', 'upload rollback'] }));
