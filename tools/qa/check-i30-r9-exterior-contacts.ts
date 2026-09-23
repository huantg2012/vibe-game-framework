/** Production-pixel guard for external transport/lighting after a chamber layout edit.
 * Run: node --import tsx tools/qa/check-i30-r9-exterior-contacts.ts
 * No browser, storage, screenshots, or gameplay state mutations.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { ChamberPixels } from '../../src/art/purification-chamber-pixels';
import { ChamberSurfaceMap } from '../../src/art/chamber-surface-map';
import { ChamberLightField } from '../../src/art/chamber-light-field';
import { paintAuthoredEnvironmentLayer, paintAuthoredChamberArchitecture,
  paintAuthoredChamberFloor, paintAuthoredChamberForeground } from '../../src/art/chamber-authored-architecture';
import { CHAMBER_EXTERIOR_CONTACTS, CHAMBER_SIZE, type ChamberPolygon } from '../../src/systems/purification-chamber-layout';

const { width, height } = CHAMBER_SIZE;
const count = width * height;
let checks = 0;
function check(value: unknown, message: string): asserts value {
  checks++;
  assert(value, message);
}

/** The authored painter uses integer fillRect exclusively. This raster retains its
 * exact alpha footprint; it does not approximate polygons with another hit test. */
function raster(paint: (pixels: ChamberPixels) => void) {
  let data = new Uint8ClampedArray(count * 4);
  const context = {
    canvas: { width, height }, imageSmoothingEnabled: false, fillStyle: '#000000',
    fillRect(x: number, y: number, w: number, h: number): void {
      assert([x, y, w, h].every(Number.isInteger), 'Authored raster must remain integer native pixels');
      const rgb = parseInt(this.fillStyle.slice(1), 16);
      const rgba = [rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255];
      for (let py = Math.max(0, y); py < Math.min(height, y + h); py++) {
        for (let px = Math.max(0, x); px < Math.min(width, x + w); px++) data.set(rgba, (py * width + px) * 4);
      }
    },
    getImageData(): { data: Uint8ClampedArray; width: number; height: number } {
      return { data: data.slice(), width, height };
    },
    putImageData(image: { data: Uint8ClampedArray }): void { data = image.data.slice(); },
  };
  const surfaces = new ChamberSurfaceMap();
  paint(new ChamberPixels(context as unknown as CanvasRenderingContext2D, surfaces));
  const albedo = surfaces.bake(context as unknown as CanvasRenderingContext2D);
  return { rgba: data, albedo, surfaces };
}

const near = raster(pixels => paintAuthoredEnvironmentLayer(pixels, 'near'));
const room = raster(pixels => {
  paintAuthoredChamberArchitecture(pixels);
  paintAuthoredChamberFloor(pixels);
  paintAuthoredChamberForeground(pixels);
});
const field = new ChamberLightField();
const fullFace: readonly ChamberPolygon[] = [[
  { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height },
]];
const covered = (pixels: Uint8ClampedArray, x: number, y: number): boolean =>
  x >= 0 && x < width && y >= 0 && y < height && pixels[(y * width + x) * 4 + 3]! > 0;
const exposed = (host: Uint8ClampedArray, blockers: Uint8ClampedArray, x: number, y: number): boolean =>
  covered(host, x, y) && !covered(blockers, x, y);

// Negative controls prove that a missing host and an opaque foreground do not
// qualify merely because a light source or a transport path exists in the data.
const hostAt = near.rgba.findIndex((value, index) => index % 4 === 3 && value > 0) >> 2;
check(hostAt >= 0, 'Near layer has actual authored pixels');
const hx = hostAt % width, hy = Math.floor(hostAt / width);
const empty = new Uint8ClampedArray(count * 4);
check(!exposed(empty, empty, hx, hy), 'Missing near material is rejected');
check(!exposed(near.rgba, near.rgba, hx, hy), 'Opaque later layer rejects a hidden near pixel');
check(exposed(near.rgba, empty, hx, hy), 'An unobscured host remains eligible');

const ids = new Set<string>();
check(CHAMBER_EXTERIOR_CONTACTS.length > 0, 'Exterior has registered contacts');
for (const [sourceIndex, source] of CHAMBER_EXTERIOR_CONTACTS.entries()) {
  check(!ids.has(source.id), `Duplicate exterior contact id: ${source.id}`);
  ids.add(source.id);
  check(source.path.length >= 2, `${source.id}: transport has a nonempty path`);
  check([source.x, source.y, source.radiusX, source.radiusY, source.elevation, source.phase,
    ...source.path.flat()].every(Number.isFinite), `${source.id}: contact geometry is finite`);
  const spans = field.compileFace(source, near.albedo, fullFace, { surface: { map: near.surfaces, light: source } });
  const receiverPixels = spans.reduce((n, span) => n + span.width, 0);
  let exposedReceiverPixels = 0;
  for (const span of spans) {
    for (let x = span.x; x < span.x + span.width; x++) {
      if (exposed(near.rgba, room.rgba, x, span.y)) exposedReceiverPixels++;
    }
  }
  check(receiverPixels > 0, `${source.id}: emitter has no actual near-layer light receiver`);
  check(exposedReceiverPixels > 0, `${source.id}: all light receivers are hidden by the room`);
  const illuminated = (x: number, y: number): boolean =>
    spans.some(span => span.y === y && x >= span.x && x < span.x + span.width);

  // Exercise every segment over the visible part of the production envelope.
  // Check both pixels of the actual 2×1 glint, including boundary rounding.
  const emitted = new Set<number>();
  const actualTransport = new Set<number>();
  for (let sample = 0; sample <= 1000; sample++) {
    const t = sample / 1000;
    if (Math.sin(t * Math.PI) < .12) continue;
    const at = t * (source.path.length - 1), segment = Math.floor(at), local = at - segment;
    const a = source.path[segment]!, b = source.path[segment + 1]!;
    const x = Math.round(a[0] + (b[0] - a[0]) * local);
    const y = Math.round(a[1] + (b[1] - a[1]) * local);
    for (let px = x; px < x + 2; px++) emitted.add(y * width + px);
    // Transport is self-emissive abnormal flow, not reflected light. Its host
    // gate uses real near alpha; the separate reflection spans only gate dust.
    if (covered(near.rgba, x, y) && covered(near.rgba, x + 1, y)) {
      actualTransport.add(y * width + x);
      actualTransport.add(y * width + x + 1);
    }
  }
  check(emitted.size > 0, `${source.id}: transport emits visible path samples`);
  check(actualTransport.size > 0, `${source.id}: no transport path pixels have a complete near-material host`);
  for (const pixel of emitted) {
    const x = pixel % width, y = Math.floor(pixel / width);
    check(covered(near.rgba, x, y), `${source.id}: transport pixel ${x},${y} has no near-material host`);
    check(!covered(room.rgba, x, y), `${source.id}: transport pixel ${x},${y} is hidden behind architecture/floor/foreground`);
  }
  // Dust uses a first-pixel light guard in production. Check its whole native
  // footprint, so a 2px flake cannot spill one pixel beyond a narrow host edge.
  const motePixels = new Set<number>();
  for (let time = 0; time <= 19000; time += 100) {
    const phase = (time / 19000 + source.phase) % 1;
    const envelope = phase < .63 ? Math.sin(phase / .63 * Math.PI) : 0;
    if (envelope < .12) continue;
    for (let mote = 0; mote < 2; mote++) {
      const life = (phase * 1.4 + mote * .41) % 1;
      const x = Math.round(source.x + (sourceIndex === 1 ? 1 : -1) * (3 + life * 8) + mote * 2);
      const y = Math.round(source.y + 4 - life * (mote ? 9 : 15));
      if (!illuminated(x, y)) continue;
      for (let px = x; px < x + (mote ? 1 : 2); px++) motePixels.add(y * width + px);
    }
  }
  for (const pixel of motePixels) {
    const x = pixel % width, y = Math.floor(pixel / width);
    check(covered(near.rgba, x, y), `${source.id}: emitted dust pixel ${x},${y} has no near-material host`);
  }
  console.log(`${source.id}: ${receiverPixels} receiver pixels; ${exposedReceiverPixels} exposed; ${emitted.size} path pixels hosted and exposed (${actualTransport.size} eligible by alpha host); ${motePixels.size} emitted dust pixels hosted.`);
}

// Drive the actual production update() in Node. Only the Phaser import and
// Graphics container are replaced; the production constructor, masks, envelope,
// interpolation and emission guard execute unchanged. This catches a reflected
// light mask accidentally replacing the self-emissive transport's host mask.
const compiled = await build({
  entryPoints: [new URL('../../src/scenes/chamber-exterior-atmosphere.ts', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'graphics-container-only', setup(builder) {
    builder.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
      contents: 'export default { BlendModes: { ADD: 1 } };', loader: 'js',
    }));
  } }],
});
const { ChamberExteriorAtmosphere } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.text).toString('base64')}`
);
type Draw = { x: number; y: number; width: number; height: number };
class GraphicsRecorder {
  name = ''; draws: Draw[] = []; destroyed = false;
  setName(name: string): this { this.name = name; return this; }
  setDepth(): this { return this; }
  setBlendMode(): this { return this; }
  clear(): this { this.draws = []; return this; }
  fillStyle(): this { return this; }
  fillRect(x: number, y: number, width: number, height: number): this {
    this.draws.push({ x, y, width, height }); return this;
  }
  destroy(): void { this.destroyed = true; }
}
const graphics: GraphicsRecorder[] = [];
const scene = { add: { graphics() {
  const graphic = new GraphicsRecorder(); graphics.push(graphic); return graphic;
} } };
const atmosphere = new ChamberExteriorAtmosphere(scene, near.albedo, near.surfaces);
const transport = graphics.find(graphic => graphic.name === 'chamber-exterior-seam-transport')!;
const lights = graphics.find(graphic => graphic.name === 'chamber-exterior-contact-light')!;
check(transport && lights, 'Production constructs the named transport and reflected-light layers');
const runtimeSamples = new Map(CHAMBER_EXTERIOR_CONTACTS.map(source => [source.id, 0]));
for (let time = 0; time < 19000; time += 100) {
  atmosphere.update(time, false);
  for (const source of CHAMBER_EXTERIOR_CONTACTS) {
    const phase = (time / 19000 + source.phase) % 1;
    const envelope = phase < .63 ? Math.sin(phase / .63 * Math.PI) : 0;
    if (envelope < .12) continue;
    const at = Math.min(source.path.length - 1.000001, phase / .63 * (source.path.length - 1));
    const segment = Math.floor(at), local = at - segment;
    const a = source.path[segment]!, b = source.path[segment + 1]!;
    const x = Math.round(a[0] + (b[0] - a[0]) * local);
    const y = Math.round(a[1] + (b[1] - a[1]) * local);
    check(transport.draws.some(draw => draw.x === x && draw.y === y && draw.width === 2 && draw.height === 1),
      `${source.id}: production emits no expected transport at ${x},${y} (time ${time}ms)`);
    runtimeSamples.set(source.id, runtimeSamples.get(source.id)! + 1);
  }
  for (const draw of transport.draws) {
    check([draw.x, draw.y, draw.width, draw.height].every(Number.isInteger), 'Production contact stays on native integer pixels');
    for (let y = draw.y; y < draw.y + draw.height; y++) for (let x = draw.x; x < draw.x + draw.width; x++) {
      check(covered(near.rgba, x, y), `Production contact/dust pixel ${x},${y} has no near-material host`);
    }
  }
}
for (const [id, samples] of runtimeSamples) {
  check(samples > 0, `${id}: production is inactive throughout one complete period`);
  console.log(`${id}: actual production update emitted all ${samples} active transport samples in 190 ticks.`);
}
atmosphere.update(19000, true);
check(transport.draws.length === 0 && lights.draws.length > 0, 'Reduced motion retains contact reflection and suppresses moving transport/dust');
atmosphere.destroy();
check(graphics.every(graphic => graphic.destroyed), 'Production destroys both owned Graphics containers');

graphics.length = 0;
const missingHost = new ChamberExteriorAtmosphere(scene, empty, new ChamberSurfaceMap());
for (let time = 0; time < 19000; time += 100) {
  missingHost.update(time, false);
  check(graphics.every(graphic => graphic.draws.length === 0), 'Production rejects every contact emission when actual near alpha is empty');
}
missingHost.destroy();
console.log(`I30 R9 exterior contacts: ${checks} checks passed.`);
