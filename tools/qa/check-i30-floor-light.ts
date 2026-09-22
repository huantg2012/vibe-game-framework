import assert from 'node:assert/strict';
import { ChamberFloorLight } from '../../src/art/chamber-floor-light';

class ReceiverProbe {
  readonly pixels = new Map<string, number>();
  alpha = 0;
  fillStyle(_color: number, alpha: number): void { this.alpha = alpha; }
  fillRect(x: number, y: number, width: number, height: number): void {
    assert(Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(width) && height === 1);
    assert(x >= 0 && y >= 0 && x + width <= 640 && y < 400);
    for (let px = x; px < x + width; px++) this.pixels.set(`${px},${y}`, this.alpha);
  }
}

const light = new ChamberFloorLight();
let checks = 0;
for (const [x, y, shouldReceive, label] of [
  [366, 299, true, 'main floor'], [220, 190, true, 'upper floor'],
  [298, 250, true, 'central ramp'], [408, 235, true, 'east ramp'],
  [253, 299, false, 'core solid base'], [145, 278, false, 'storage solid base'],
  [451, 270, false, 'purifier solid base'], [169, 168, false, 'growth solid base'],
  [355, 176, false, 'offering solid base'], [512, 252, false, 'rift cavity'],
  [250, 246, false, 'riser between floors'], [380, 238, false, 'non-portal high edge'],
  [105, 190, false, 'return wall'], [300, 50, false, 'outside void'],
] as const) {
  const probe = new ReceiverProbe();
  light.paintLamp(probe, x, y);
  assert.equal(probe.pixels.has(`${x},${y}`), shouldReceive, label);
  checks++;
}

// A lamp near a wall may illuminate the adjacent real floor, never the wall itself.
const edge = new ReceiverProbe();
light.paintLamp(edge, 130, 201);
assert(edge.pixels.size > 0, 'Do not hide a lamp just because its centre touches an edge');
assert(!edge.pixels.has('122,201'), 'Lamp must not paint outside the upper floor');
checks += 2;

const compiled = light.compile(366, 299, 40, 15);
const bright = new ReceiverProbe(); const dim = new ReceiverProbe();
light.paint(bright, compiled, 0x1aad96, .1);
light.paint(dim, compiled, 0x1aad96, .02);
assert(bright.pixels.get('366,299')! > bright.pixels.get('390,299')!, 'Receiver falls off away from emitter');
assert.equal(bright.pixels.size, dim.pixels.size, 'Public health changes intensity, not geometry');
for (const [pixel, alpha] of bright.pixels) assert(Math.abs(dim.pixels.get(pixel)! - alpha * .2) < 1e-9);
checks += 3;

console.log(`I30 floor-light receiver: ${checks} cases PASS; void/wall/base clipping, both floors/ramps, falloff and public-state dimming. This does not assess aesthetics.`);
