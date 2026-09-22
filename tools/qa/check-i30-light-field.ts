import assert from 'node:assert/strict';
import { ChamberLightField, type FieldSource, type LightSpan } from '../../src/art/chamber-light-field';
import { CHAMBER_DEVICE_FOOTPRINTS, CHAMBER_SIZE, CHAMBER_WALK_POLYGONS,
  type ChamberPolygon } from '../../src/systems/purification-chamber-layout';

const { width, height } = CHAMBER_SIZE;
const field = new ChamberLightField();
let checks = 0;

function expect(condition: unknown, message: string): void { assert(condition, message); checks++; }
function at(spans: readonly LightSpan[], x: number, y: number): number {
  return spans.find(span => span.y === y && span.x <= x && span.x + span.width > x)?.band ?? 0;
}
function source(x: number, y: number, radiusX = 160, radiusY = 120): FieldSource {
  return { x, y, radiusX, radiusY };
}

// The ramps are adjacent receivers, but neither floor lights the other landing.
const main = field.compileFloor(source(306, 270), 'main');
expect(at(main, 310, 280) > 0, 'Main floor must receive its own light');
expect(at(main, 298, 250) > 0, 'Main light reaches the adjacent left ramp');
expect(at(main, 282, 218) === 0, 'Main light must not continue up the ramp onto the upper floor');
const upper = field.compileFloor(source(282, 218), 'upper');
expect(at(upper, 280, 211) > 0, 'Upper floor must receive its own light');
expect(at(upper, 298, 250) > 0, 'Upper light reaches the adjacent left ramp');
expect(at(upper, 310, 280) === 0, 'Upper light must not reach the main landing');
const east = field.compileFloor(source(405, 255), 'main');
expect(at(east, 401, 238) > 0, 'East ramp is also a receiver');

// Both endpoints are on main, but the straight ray cuts across the notch between them.
const notch = field.compileFloor(source(205, 250), 'main');
expect(at(notch, 211, 252) > 0, 'Notch control point receives light');
expect(at(notch, 285, 270) === 0, 'A same-floor target behind a non-walkable notch stays dark');
expect(at(notch, 248, 248) === 0, 'The notch itself must not receive');
expect(field.compileFloor(source(250, 246), 'main').length === 0, 'An emitter in a riser cannot leak onto a floor');

const base = field.compileFloor(source(220, 300), 'main');
expect(at(base, 230, 300) > 0, 'Unblocked near side of core receives');
expect(at(base, 253, 299) === 0, 'Core footprint does not receive');
expect(at(base, 280, 300) === 0, 'Core footprint blocks the far side');
const coreSource = source(253, 299);
expect(field.compileFloor(coreSource, 'main').length === 0, 'A solid emitter needs an explicit own-base exclusion');
const core = field.compileFloor(coreSource, 'main', 'core');
expect(at(core, 280, 299) > 0, 'Own-base exclusion lets the core illuminate the surrounding floor');
expect(at(core, 253, 299) === 0, 'Own-base exclusion never turns the base into a receiver');
expect(at(core, 120, 278) === 0, 'Ignoring core does not ignore the storage base farther along the ray');

const falloff = field.compileFloor(source(340.5, 295.5, 40, 25), 'main');
expect(at(falloff, 340, 295) === 24, 'The highest light band is reachable');
expect(at(falloff, 374, 295) > 0 && at(falloff, 374, 295) < 24, 'Falloff retains a dim outer receiver band');
expect(at(falloff, 380, 295) === 0, 'The exact ellipse boundary is dark');
expect(field.compileFloor(source(340, 295, 0, 25), 'main').length === 0, 'A degenerate source is empty');

// Synthetic full-room texture: receiver mask is tested independently of drawing code.
const pixels = new Uint8ClampedArray(width * height * 4);
const face: ChamberPolygon = [{ x: 200, y: 100 }, { x: 230, y: 100 }, { x: 230, y: 120 }, { x: 200, y: 120 }];
function pixel(x: number, y: number, red: number, green: number, blue: number, alpha = 255): void {
  pixels.set([red, green, blue, alpha], (y * width + x) * 4);
}
pixel(210, 110, 96, 96, 96);
pixel(212, 110, 40, 40, 40);
pixel(214, 110, 140, 140, 140, 0);
pixel(216, 110, 13, 17, 20);
pixel(218, 110, 26, 173, 150);
pixel(220, 110, 196, 135, 58);
pixel(222, 110, 14, 74, 63);
pixel(224, 110, 138, 92, 42);
pixel(210, 112, 96, 96, 96, 80);
pixel(232, 110, 96, 96, 96);
const faceSource = source(215, 110, 60, 40);
const faceSpans = field.compileFace(faceSource, pixels, [face]);
expect(at(faceSpans, 210, 110) > at(faceSpans, 212, 110), 'Brighter material responds more strongly to the same light');
expect(at(faceSpans, 214, 110) === 0, 'Transparent apertures remain empty');
expect(at(faceSpans, 216, 110) === 0, 'Black negative spaces remain empty');
expect(at(faceSpans, 218, 110) === 0 && at(faceSpans, 222, 110) === 0, 'Both bright and deep teal emission are excluded');
expect(at(faceSpans, 220, 110) === 0 && at(faceSpans, 224, 110) === 0, 'Both lamp and dim amber emission are excluded');
expect(at(faceSpans, 210, 112) < at(faceSpans, 210, 110), 'Partial texture alpha reduces received light');
expect(at(faceSpans, 232, 110) === 0, 'Opaque pixels outside the named region are excluded');
const emissionAllowed = field.compileFace(faceSource, pixels, [face], { excludeEmission: false });
expect(at(emissionAllowed, 218, 110) > 0, 'An explicit non-emission texture can opt out of the color exclusion');
assert.throws(() => field.compileFace(faceSource, new Uint8ClampedArray(4), [face]), RangeError); checks++;

class PainterProbe {
  readonly pixels = new Map<number, number>();
  alpha = 0;
  fillStyle(_color: number, alpha: number): void {
    assert(Number.isFinite(alpha) && alpha > 0 && alpha <= 1);
    this.alpha = alpha;
  }
  fillRect(x: number, y: number, spanWidth: number, spanHeight: number): void {
    assert(Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(spanWidth) && spanWidth > 0 && spanHeight === 1);
    assert(x >= 0 && y >= 0 && x + spanWidth <= width && y < height);
    for (let px = x; px < x + spanWidth; px++) this.pixels.set(y * width + px, this.alpha);
  }
}
function shadow(x: number, y: number, light: FieldSource): PainterProbe {
  const painter = new PainterProbe();
  field.paintActorShadow(painter, x, y, light, .4);
  return painter;
}

const bright = new PainterProbe(); const dim = new PainterProbe();
field.paint(bright, falloff, 0x1aad96, .4); field.paint(dim, falloff, 0x1aad96, .1);
expect(bright.pixels.size === dim.pixels.size && bright.pixels.size > 0, 'Health/intensity modulation does not recompile receiver geometry');
expect([...bright.pixels].every(([key, value]) => Math.abs(dim.pixels.get(key)! - value / 4) < 1e-9), 'Painting scales the compiled bands linearly');

const castRight = shadow(340, 299, source(310, 299));
const castLeft = shadow(340, 299, source(370, 299));
expect(castRight.pixels.size > 0 && castLeft.pixels.size > 0, 'Both light positions produce a short shadow');
expect([...castRight.pixels.keys()].every(key => key % width >= 340), 'Light on the left casts to the right');
expect([...castLeft.pixels.keys()].every(key => key % width < 340), 'Light on the right casts to the left');
expect([...castRight.pixels.keys()].every(key => key % width - 340 < 24), 'The projected shadow is at most 24 pixels long');
const farther = shadow(340, 299, source(280, 299));
expect(Math.max(...farther.pixels.values()) < Math.max(...castRight.pixels.values()), 'Shadow opacity fades with source distance');
expect(shadow(340, 299, source(310, 299, 20, 20)).pixels.size === 0, 'No shadow outside source influence');
expect(shadow(280, 300, source(220, 300)).pixels.size === 0, 'A base blocking the light also blocks actor shadow casting');
expect(shadow(280, 299, coreSource).pixels.size > 0, 'A source inside its own base can still cast an actor shadow');
expect(shadow(282, 218, source(306, 270)).pixels.size === 0, 'Actor shadow cannot be cast across floor levels');

const baseClip = shadow(230, 299, source(210, 299));
const edgeClip = shadow(340, 331, source(340, 310));
expect(baseClip.pixels.size > 0 && edgeClip.pixels.size > 0, 'Base and edge clipping retain the unblocked contact shadow');
expect([...baseClip.pixels.keys()].every(key => key % width < 236), 'A projected shadow stops at the core base');
expect([...edgeClip.pixels.keys()].every(key => Math.floor(key / width) < 334), 'A projected shadow stops at the floor edge');

// Integer foot positions must not make a ray overshoot its endpoint on negative axes.
for (const [x, y] of [[215, 146], [215, 147], [216, 146], [223, 146], [228, 146]]) {
  expect(shadow(x!, y!, source(213, 153, 27, 16)).pixels.size > 0,
    `Upper wall-lamp shadow remains visible at integer foot ${x},${y}`);
}

// Check all painted shadow pixels against the public polygons with an independent winding test.
function inside(polygon: ChamberPolygon, x: number, y: number): boolean {
  let winding = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!; const b = polygon[(i + 1) % polygon.length]!;
    const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
    if (a.y <= y && b.y > y && side > 0) winding++;
    if (a.y > y && b.y <= y && side < 0) winding--;
  }
  return winding !== 0;
}
for (const probe of [castRight, castLeft, baseClip, edgeClip]) {
  for (const key of probe.pixels.keys()) {
    const x = key % width + .5; const y = Math.floor(key / width) + .5;
    assert(inside(CHAMBER_WALK_POLYGONS.main, x, y));
    assert(Object.values(CHAMBER_DEVICE_FOOTPRINTS).every(polygon => !inside(polygon, x, y)));
  }
}
checks++;

console.log(`I30 light field: ${checks} checks PASS (floor/ramp/void/base visibility, texture face masks, 24-band falloff, actor shadow direction and clipping). No aesthetic or 3D-lighting claim.`);
