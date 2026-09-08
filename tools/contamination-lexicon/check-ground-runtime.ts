/** I18: real player/model depth adapters and the shared sorter, including roster replacement. */
import assert from 'node:assert/strict';
import { GroundDepthSorter, GROUND_LIGHT_DEPTH, WORLD_READOUT_DEPTH, type GroundDepthTarget } from '../../src/systems/ground-depth';
import { Player } from '../../src/entities/player';
import { Enemy } from '../../src/entities/enemy-factory';
import { attachAnimatedModel } from '../../src/entities/form-renderers/d/model-visual';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw';
import type { FormAttachContext, FormVisualPose } from '../../src/entities/form-renderers/form-renderer';

function image() {
  return { depth: 0, writes: 0, y: 80, originX: .5, originY: 42 / 64, scaleX: 1, scaleY: 1,
    alpha: 1, visible: true, destroyed: false,
    setDepth(d: number) { assert(!this.destroyed, 'destroyed image received a depth write'); this.depth = d; this.writes++; return this; },
    setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; },
    setScale() {}, setPosition(_x: number, y: number) { this.y = y; },
    setAlpha(a: number) { this.alpha = a; }, setVisible(v: boolean) { this.visible = v; },
    destroy() { this.destroyed = true; } };
}
const player = Object.create(Player.prototype) as Player;
const playerImage = image(), lag = image(), glow = image(), ground = image();
Object.assign(player, { image: playerImage, lag, aura: { setGroundDepth(base: number, floor: number) {
  glow.setDepth(base + .2); ground.setDepth(floor);
} } });
const pTarget: GroundDepthTarget = { id: 'player', groundY: () => player.getGroundY(),
  applyDepth: depth => player.setGroundDepth(depth, GROUND_LIGHT_DEPTH) };
const images: ReturnType<typeof image>[] = [];
const scene = { add: { image: () => { const im = image(); images.push(im); return im; } },
  textures: { createCanvas: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} }), refresh() {} }), remove() {} } };
function actor(id: string, y: number) {
  const visual = attachAnimatedModel({ scene, seed: 7, depth: 25, form: INFILTRATOR_FORM } as unknown as FormAttachContext, {
    id, walkCycleMs: 960, stridePixels: 28,
    bake: req => ({ buf: { w: 64, h: 64, data: new Uint8ClampedArray(64*64*4) },
      canvas: { w:64,h:64,originX:32,originY:42,offsetX:0,offsetY:0,collision:20,coverage:req.coverage } }),
  });
  const im = images.at(-1)!;
  const pos = { x: 100, y };
  const target: GroundDepthTarget = { id, groundY: () => pos.y, applyDepth: d => visual.setGroundDepth!(d) };
  return { visual, im, pos, target };
}
const north = actor('enemy:north', 60), south = actor('enemy:south', 110);
let sorter = new GroundDepthSorter([south.target, pTarget, north.target]);
sorter.update();
assert(north.im.depth < lag.depth && glow.depth < south.im.depth, 'player composite interleaves with tall front/back bodies');
assert.equal(ground.depth, GROUND_LIGHT_DEPTH);
playerImage.y = 120; sorter.update();
assert(playerImage.depth > south.im.depth, 'crossing an enemy ground contact changes actual player image depth');
playerImage.y = 40; sorter.update();
assert(glow.depth < north.im.depth, 'player lamp follows its owner behind the enemy');
const dot = image(), lock = image();
const enemy = Object.create(Enemy.prototype) as Enemy;
Object.assign(enemy, { dots: [dot], lock }); enemy.setReadoutDepth(WORLD_READOUT_DEPTH);
assert(dot.depth > south.im.depth && lock.depth > playerImage.depth && dot.depth < 50,
  'actual Enemy readouts stay above bodies and below fog');
const pose: FormVisualPose = { x:100,y:60,facing4:'down',moving:false,visibility:0,signal:'idle',deltaMs:16 };
north.visual.update(pose);
sorter.update();
assert.equal(north.im.visible, false); assert.equal(north.im.alpha, 0, 'sorter cannot reveal a hidden enemy');
north.visual.update({ ...pose, visibility:.2 });
sorter.update(); assert.equal(north.im.alpha, .2, 'fog band alpha survives depth writes');
const writes = north.im.writes + south.im.writes + playerImage.writes;
for (let i=0;i<100;i++) sorter.update();
assert.equal(north.im.writes + south.im.writes + playerImage.writes, writes, 'stable positions do not resubmit depth');
// Same-y order is deterministic, independent of spawn/renderer insertion order.
north.pos.y = south.pos.y = 90; sorter.update();
const order = north.im.depth < south.im.depth;
sorter = new GroundDepthSorter([north.target, south.target, pTarget]); sorter.update();
assert.equal(north.im.depth < south.im.depth, order);
// Scene roster rebuild after death cannot retain callbacks into a removed model.
north.visual.destroy();
sorter = new GroundDepthSorter([pTarget, south.target]);
for (let i=0;i<50;i++) { playerImage.y = 70+i; sorter.update(); }
const deadWrites = north.im.writes;
north.visual.setGroundDepth!(22);
assert.equal(north.im.writes, deadWrites, 'late depth writes to a destroyed adapter are ignored');
// Same identity, new renderer: new image must receive its first rank, not an old cache hit.
const replacement = actor('enemy:north', 70);
sorter = new GroundDepthSorter([pTarget, south.target, replacement.target]); sorter.update();
assert(replacement.im.depth < south.im.depth && replacement.im.depth < playerImage.depth);
assert(replacement.im.writes >= 2);
for (const body of [replacement.im, south.im, playerImage]) assert(body.depth > GROUND_LIGHT_DEPTH && body.depth < WORLD_READOUT_DEPTH);
replacement.visual.destroy(); south.visual.destroy();
sorter = new GroundDepthSorter([pTarget]); sorter.update();
assert(playerImage.depth < WORLD_READOUT_DEPTH, 'empty enemy roster still keeps the player inside the reserved band');
console.log('check:ground-runtime PASS (player/model ordering, ties, fog/readouts, idle writes, death, renderer replacement, empty roster)');
