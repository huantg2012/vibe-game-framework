import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderDensePlayerFrame, densePlayerMotionTexture } from '../../src/entities/player-sprite-dense';
import { generateWorldSample } from '../../src/generation/world-study/layout';
import { WorldStudyLightField } from '../../src/generation/world-study/light-field';

const reference = JSON.parse(readFileSync(new URL('./player-reference.json', import.meta.url), 'utf8'));
let frames = 0;
for (const facing of ['down', 'up', 'left', 'right'] as const) for (const gait of ['idle', 'walk'] as const) {
  for (let frame = 0; frame < 4; frame++) {
    const key = densePlayerMotionTexture(facing, gait, frame);
    const hash = createHash('sha256').update(renderDensePlayerFrame(facing, gait, frame)).digest('hex');
    assert.equal(hash, reference.frames[key], `Original player pixels changed: ${key}`);
    frames++;
  }
}

// An open plane with a short void wall: bright floor before it, fully hidden
// floor behind it, and a path around its end that restores line of sight.
const sample = generateWorldSample('ivory-basin', 'loops', 70421);
sample.land.fill(1); sample.walls.fill(0);
for (let row = 6; row <= 16; row++) for (let col = 11; col <= 13; col++) sample.walls[row * sample.cols + col] = 1;
const field = new WorldStudyLightField(sample);
field.update(120, 176, 'right');
assert(field.visibilityAt(148, 176) > .8, 'Forward floor should receive full light');
assert.equal(field.visibilityAt(192, 176), 0, 'Void surface became visible');
assert.equal(field.visibilityAt(252, 176), 0, 'Light crossed the void into hidden floor');
assert.equal(field.visibilityAt(20, 176), 0, 'Distant rear floor is outside the ambient lamp');
assert(field.visibilityAt(108, 176) > 0 && field.visibilityAt(108, 176) < .7, 'Ambient lamp should be weaker than forward light');
field.update(120, 64, 'right');
assert(field.visibilityAt(252, 64) > .8, 'Going around the void should reveal the floor');
field.update(120, 64, 'left');
assert.equal(field.visibilityAt(252, 64), 0, 'Turning must change the lit direction');
console.log(`World study runtime: ${frames} original player frames exact; void blocking, floor reveal, lamp/flashlight and facing checks passed.`);
