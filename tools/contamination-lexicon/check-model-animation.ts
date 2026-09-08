import assert from 'node:assert/strict';
import { ModelAnimationClock } from '../../src/entities/form-renderers/d/model-animation';
import { attachAnimatedModel } from '../../src/entities/form-renderers/d/model-visual';
import type { FormVisualPose, FormAttachContext } from '../../src/entities/form-renderers/form-renderer';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw';

const base: FormVisualPose = { x: 10, y: 20, facing4: 'down', moving: true, movementSpeed: 28, visibility: 1, signal: 'idle', deltaMs: 20, attack: { phase: 'idle', progress: 0 } };
function distanceAt(fps: number, speed: number, seconds: number) {
  const clock = new ModelAnimationClock(960, 28);
  let frame;
  for (let i = 0; i < fps * seconds; i++) frame = clock.advance({ ...base, movementSpeed: speed, deltaMs: 1000 / fps });
  return frame!;
}
const a = distanceAt(50, 14, 1), b = distanceAt(100, 28, .5);
assert.ok(Math.abs(a.progress - b.progress) < 1e-9, 'same resolved distance must give the same foot phase');
assert.ok(Math.abs(a.progress - .5) < 1e-9);
const clock = new ModelAnimationClock(960, 28);
assert.equal(clock.advance({ ...base, movementSpeed: 0 }).phase, 'idle', 'blocked body must not walk on requested movement');
const attack = clock.advance({ ...base, attack: { phase: 'windup', progress: .73, facingAngle: Math.PI }, deltaMs: 1000 });
assert.deepEqual(attack, { facing: 'left', phase: 'windup', progress: .73 }, 'attack follows combat clock and committed heading despite local dt');
clock.advance({ ...base, attack: { phase: 'recover', progress: 1 } });
assert.equal(clock.advance({ ...base, moving: false, movementSpeed: 0 }).progress, 0, 'recovery joins idle at its shared zero pose');

// Exercise the production adapter against an engine-shaped texture store. We
// count allocation/upload/destruction rather than assert private cache values.
let allocated = 0, removed = 0, uploads = 0, bakes = 0;
const textures = new Set<string>();
const img = { originX: .5, originY: 42 / 64, scaleX: 1, scaleY: 1, setDepth() { return this; }, setOrigin(x: number,y: number) { this.originX=x;this.originY=y;return this; }, setScale() {}, setPosition() {}, setAlpha() {}, setVisible() {}, destroy() {} };
const context = { createImageData: (w: number,h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() { uploads++; } };
const scene = { textures: { createCanvas(key: string) { assert.ok(!textures.has(key)); textures.add(key);allocated++;return {getContext: () => context,refresh() {}}; }, remove(key: string) {assert.ok(textures.delete(key));removed++;} }, add: {image: () => img} };
const visual = attachAnimatedModel({scene,form:INFILTRATOR_FORM,seed:7,depth:20} as unknown as FormAttachContext, {
  id:'probe',walkCycleMs:960,stridePixels:28,
  bake(req) { bakes++;return {buf:{w:64,h:64,data:new Uint8ClampedArray(64*64*4)},canvas:{w:64,h:64,originX:32,originY:42,offsetX:0,offsetY:0,collision:20,coverage:req.coverage}}; },
});
for(let i=0;i<1000;i++)visual.update({...base,deltaMs:10});
assert.equal(allocated,1,'changing animation must not grow GPU textures');
assert.ok(bakes<=32,`repeated gait cycle should reuse CPU frames, got ${bakes}`);
const before=bakes, uploaded=uploads;
for(let i=0;i<200;i++)visual.update({...base,visibility:0,facing4:'left'});
assert.equal(bakes,before,'hidden entities should advance without baking');
assert.equal(uploads,uploaded,'hidden entities should not upload');
assert.equal(visual.getFlashSource!().originY,42/64);
visual.destroy();visual.destroy();assert.equal(removed,1);assert.equal(textures.size,0);
console.log('check:model-animation PASS: displacement-coupled gait, authoritative attack, one texture, frame reuse, fog skip, idempotent cleanup');
