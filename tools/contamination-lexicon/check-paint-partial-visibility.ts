/** Production paint attachment + the real Rift sight/VOID query. No alternate
 * light model or screenshot-specific geometry. Run with contam-preview tsconfig. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { attachBingD } from '../../src/entities/form-renderers/d/bing';
import { PaintSurfaceVisibility } from '../../src/entities/form-renderers/d/paint-genome/visibility';
import type { FormVisualPose } from '../../src/entities/form-renderers/form-renderer';
import type { ContaminationForm } from '../../src/generation/contamination-draw';
import { TileGrid } from '../../src/systems/tile-grid';
import { createRiftVisionConfig, VisibilitySystem } from '../../src/systems/visibility-system';
import { TileType } from '../../src/types/game-types';

function fixture() {
  const textures = new Map<string, { w: number; h: number; pixels: Uint8ClampedArray }>();
  const objects: Draw[] = [];
  class Draw {
    key = ''; visible = true; alpha = 1; x = 0; y = 0;
    rects: { x: number; y: number; w: number; h: number; alpha: number }[] = [];
    inkAlpha = 1;
    constructor() { objects.push(this); }
    setDepth() { return this; } setOrigin() { return this; } setRotation() { return this; } setScale() { return this; }
    setVisible(v: boolean) { this.visible = v; return this; }
    setAlpha(v: number) { this.alpha = v; return this; }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    clear() { this.rects.length = 0; return this; }
    fillStyle(_ink: number, alpha: number) { this.inkAlpha = alpha; return this; }
    fillRect(x: number, y: number, w: number, h: number) { this.rects.push({ x, y, w, h, alpha: this.inkAlpha }); return this; }
    destroy() { objects.splice(objects.indexOf(this), 1); }
  }
  const scene = {
    hosts: { isPaintFloorActive: () => true },
    add: { graphics: () => new Draw(), image: (_x: number, _y: number, key: string) => Object.assign(new Draw(), { key }) },
    textures: {
      exists: (key: string) => textures.has(key), remove: (key: string) => textures.delete(key),
      createCanvas(key: string, w: number, h: number) {
        const texture = { w, h, pixels: new Uint8ClampedArray(w * h * 4) }; textures.set(key, texture);
        return { setFilter() {}, refresh() {}, getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (data: { data: Uint8ClampedArray }) => { texture.pixels.set(data.data); },
        }) };
      },
    },
  };
  return { scene, textures, objects };
}

const center = { x: 512, y: 512 };
const grid = new TileGrid({ cols: 128, rows: 128, tileSize: 8,
  tiles: Array.from({ length: 128 }, () => Array<number>(128).fill(TileType.FLOOR)) });
const sight = new VisibilitySystem();
Object.assign(sight, { config: createRiftVisionConfig(), occluders: grid });
let calls = 0;
const sampleAt = (point: Readonly<{ x: number; y: number }>) => { calls++; return sight.getVisibilityAt(point); };
function aim(x: number, y: number, angle: number) {
  Object.assign(sight, { origin: { x, y }, facingCache: angle });
}
const base: FormVisualPose = { ...center, facing4: 'left', moving: false, visibility: 0,
  signal: 'idle', deltaMs: 0, activity: { phase: 'active', progress: 1 } };
let partialFrames = 0, shadowedPixels = 0, checkedPixels = 0;
const durations: number[] = [];
const callCounts: number[] = [];
const performanceSamples: { substrate: string; continuity: string; scalarMs: number; stillSightMs: number; movingSightMs: number }[] = [];
for (const substrate of ['oil_film', 'fungal_mat', 'ash_veil']) for (const continuity of ['colony', 'field'] as const) {
  const f = fixture();
  const form = { substrate, portfolio: 'bing', continuity, coverage: 'rewrite', occupancy: 'paint',
    lexemes: { motion: 'motion_anchor', sense: 'sense_touch', rhythm: 'rhythm_open', contact: 'contact_step' } } as ContaminationForm;
  const visual = attachBingD({ scene: f.scene as never, form, seed: 1000, depth: .8, subjectId: 'paint',
    pin: { kind: 'cluster', ...center }, isWalkableFloor: () => true, surfaceVisibilityAt: sampleAt,
    surfaceVisibilityRevision: () => sight.getQueryRevision(), surfaceIntersectsSight: bounds => sight.maySeeBounds(bounds) });
  const cells = JSON.stringify(visual.stepFloors);
  const tex = [...f.textures.values()][0]!;
  const image = f.objects.find(row => row.key)!;
  const wash = f.objects.find(row => !row.key)!;
  const left = center.x - tex.w * .5, top = center.y - tex.h * .5;
  const inspect = () => {
    let count = 0;
    for (let y = 0; y < tex.h; y++) for (let x = 0; x < tex.w; x++) {
      const alpha = tex.pixels[(y * tex.w + x) * 4 + 3]!;
      if (!alpha) continue;
      const visibility = sight.getVisibilityAt({ x: left + x + .5, y: top + y + .5 });
      assert(visibility > 0, 'no anatomy behind the actual cone/VOID LOS is revealed');
      assert.equal(alpha, Math.round(255 * visibility), 'each anatomy pixel uses its own band, not the host-core alpha');
      checkedPixels++; count++;
    }
    for (const rect of wash.rects) assert(sight.getVisibilityAt({ x: rect.x + 1.5, y: rect.y + 1.5 }) > 0,
      'danger wash cannot retain a hidden rectangle');
    return count;
  };
  for (let heading = 0; heading < 8; heading++) {
    const angle = heading * Math.PI / 4;
    // Core is 96px away, outside the 80px ambient ring; the surface's nearby
    // side intersects that ring and the side of the perpendicular cone.
    const px = center.x + Math.cos(angle) * 96, py = center.y + Math.sin(angle) * 96;
    aim(px, py, angle + Math.PI);
    visual.update({ ...base, visibility: sight.getVisibilityAt(center) });
    const frontal = inspect();
    assert(frontal > 0);
    aim(px, py, angle + Math.PI / 2);
    assert.equal(sight.getVisibilityAt(center), 0, 'fixture reproduces invisible core while only part of the surface is lit');
    calls = 0;
    const started = performance.now();
    visual.update(base);
    durations.push(performance.now() - started); callCounts.push(calls);
    const partial = inspect();
    assert(partial > 0 && partial < frontal, `${substrate}/${continuity}/${heading}: edge-lit anatomy survives without revealing the whole colony (${partial}/${frontal})`);
    assert(image.visible && image.alpha === 1, 'local alpha remains independent of an invisible core');
    assert.equal(JSON.stringify(visual.stepFloors), cells, 'turning light never changes the hazard footprint');
    calls = 0;
    visual.update(base);
    assert.equal(calls, 0, 'still frames reuse all unchanged sight samples');
    partialFrames++;
  }
  // Face the complete colony, then add a true opaque VOID strip between the
  // player and its lower part. Neighbouring visible pixels must survive.
  aim(center.x + 150, center.y, Math.PI);
  visual.update({ ...base, visibility: 1 });
  const before = tex.pixels.slice();
  for (let row = 64; row < 88; row++) grid.setTile(76, row, TileType.VOID);
  visual.update({ ...base, visibility: 1 });
  assert(inspect() > 0, 'a partial VOID shadow does not suppress the whole colony');
  for (let i = 3; i < before.length; i += 4) if (before[i]! > 0 && tex.pixels[i] === 0) shadowedPixels++;
  for (let row = 64; row < 88; row++) grid.setTile(76, row, TileType.FLOOR);
  aim(24, 24, -Math.PI / 2);
  calls = 0;
  visual.update({ ...base, visibility: 1 });
  assert(!image.visible && image.alpha === 0, 'fully hidden anatomy has no visible object or opacity');
  assert.equal(wash.rects.length, 0, 'fully hidden hazard deposits are cleared');
  assert.equal(calls, 0, 'distant surfaces skip all pixel LOS and repaint work');
  const reference = fixture();
  const scalar = attachBingD({ scene: reference.scene as never, form, seed: 1000, depth: .8, subjectId: 'paint',
    pin: { kind: 'cluster', ...center }, isWalkableFloor: () => true });
  aim(center.x + 96, center.y, Math.PI / 2);
  const measure = (update: () => void) => {
    for (let i = 0; i < 8; i++) update();
    const start = performance.now();
    for (let i = 0; i < 40; i++) update();
    return +(Math.max(0, performance.now() - start) / 40).toFixed(3);
  };
  performanceSamples.push({ substrate, continuity,
    scalarMs: measure(() => scalar.update({ ...base, visibility: 1 })),
    stillSightMs: measure(() => visual.update(base)),
    movingSightMs: measure(() => { aim(center.x + 96 + Math.sin(performance.now()) * 8, center.y, Math.PI / 2); visual.update(base); }) });
  scalar.destroy();
  visual.destroy();
  assert.equal(f.textures.size, 0); assert.equal(f.objects.length, 0);
}
assert(shadowedPixels > 0, 'VOID fixture actually casts a shadow over painted pixels');

// A full twelve-host roster must not pay twelve material/LOS updates when only
// one or two surfaces are near the player. Use real large fungal attachments.
const rosterScene = fixture();
const rosterForm = { substrate: 'fungal_mat', portfolio: 'bing', continuity: 'field', coverage: 'rewrite', occupancy: 'paint',
  lexemes: { motion: 'motion_anchor', sense: 'sense_touch', rhythm: 'rhythm_open', contact: 'contact_step' } } as ContaminationForm;
const roster = Array.from({ length: 12 }, (_, index) => {
  const x = index < 2 ? center.x : 1600 + index * 256, y = center.y + (index === 1 ? 16 : 0);
  let queries = 0;
  const visual = attachBingD({ scene: rosterScene.scene as never, form: rosterForm, seed: 1000, depth: .8,
    subjectId: `host-${index}`, textureNamespace: `host-${index}`, pin: { kind: 'cluster', x, y },
    isWalkableFloor: () => true, surfaceVisibilityAt: point => { queries++; return sight.getVisibilityAt(point); },
    surfaceVisibilityRevision: () => sight.getQueryRevision(), surfaceIntersectsSight: bounds => sight.maySeeBounds(bounds) });
  return { visual, queries: () => queries, x, y };
});
const rosterTimes: number[] = [];
for (let frame = 0; frame < 50; frame++) {
  aim(center.x + 96 + frame * .4, center.y, Math.PI / 2);
  const start = performance.now();
  for (const host of roster) host.visual.update({ ...base, x: host.x, y: host.y, deltaMs: 16 });
  if (frame >= 10) rosterTimes.push(performance.now() - start);
}
assert(roster.slice(2).every(host => host.queries() === 0), 'all ten distant hosts skip pixel queries on every moving frame');
assert(roster.slice(0, 2).every(host => host.queries() > 0), 'both nearby surfaces retain exact local sight');
for (const host of roster) host.visual.destroy();
assert.equal(rosterScene.textures.size, 0); assert.equal(rosterScene.objects.length, 0);
rosterTimes.sort((a, b) => a - b);

// Point queries are reused by material/deposits but never persist past a frame.
let sampled = 0, level = .6;
const cache = new PaintSurfaceVisibility(88, 88, () => { sampled++; return level; });
cache.begin(128, 128);
assert(Math.abs(cache.at(130, 140) - .6) < .000001);
cache.at(130.5, 140.5); assert.equal(sampled, 1);
level = 0; cache.begin(128, 128); assert.equal(cache.at(130, 140), 0); assert.equal(sampled, 2);
cache.begin(128, 128, 1); cache.at(130, 140); const stable = sampled;
cache.begin(128, 128, 1); cache.at(130, 140); assert.equal(sampled, stable);
cache.begin(129, 128, 1); cache.at(130, 140); assert.equal(sampled, stable + 1, 'moving surface origin also invalidates cached world pixels');

let revision = sight.getQueryRevision();
const changed = (message: string) => { const next = sight.getQueryRevision(); assert(next > revision, message); revision = next; };
assert.equal(sight.getQueryRevision(), revision);
aim(24.125, 24, 0); changed('subpixel player displacement invalidates local sight');
aim(24.125, 24, Math.PI / 4); changed('committed eight-way facing invalidates local sight');
sight.setRadiusScale(.8); changed('chaos radius invalidates local sight');
sight.setAbilityRadiusMultiplier(1.2); changed('contaminant radius invalidates local sight');
grid.setTile(4, 4, TileType.VOID); changed('changed VOID occlusion invalidates local sight');
Object.assign(sight, { config: createRiftVisionConfig() }); changed('scene re-entry/config replacement invalidates local sight');
Object.assign(sight, { occluders: new TileGrid({ cols: 1, rows: 1, tileSize: 8, tiles: [[TileType.FLOOR]] }) });
changed('a replacement grid invalidates even when its version is also zero');
sight.setEdgeCorruption(.2); sight.setScreenFlicker(.2);
assert.equal(sight.getQueryRevision(), revision, 'presentation-only corruption/flicker never triggers redundant LOS casts');
Object.assign(sight, { config: createRiftVisionConfig(), origin: { x: 256, y: 256 }, radiusScale: 1, abilityRadiusMultiplier: 1 });
const range = Math.max(sight.getEffectiveRadius(0), sight.getEffectiveRadius(Math.PI));
assert(sight.maySeeBounds({ left: 256 + range, right: 256 + range + 10, top: 255, bottom: 257 }), 'tangent surfaces are conservatively retained');
assert(!sight.maySeeBounds({ left: 257 + range, right: 267 + range, top: 255, bottom: 257 }), 'only wholly out-of-range bounds are rejected');
assert(sight.maySeeBounds({ left: 240, right: 5000, top: 240, bottom: 5000 }), 'a distant core cannot reject an overlapping large body');
sight.setAbilityRadiusMultiplier(2);
assert(sight.maySeeBounds({ left: 256 + range * 1.5, right: 266 + range * 1.5, top: 255, bottom: 257 }), 'ability-extended sight also extends broad-phase acceptance');
Object.assign(sight, { abilityRadiusMultiplier: .01 });
assert(sight.maySeeBounds({ left: 260, right: 262, top: 255, bottom: 257 }), 'the unconditional solid-radius floor also survives a sub-unit internal multiplier');
const source = readFileSync(new URL('../../src/scenes/rift-scene.ts', import.meta.url), 'utf8');
assert(source.includes('surfaceVisibilityAt: this.visibilityAt'), 'the formal scene supplies its own authoritative visibility query');
durations.sort((a, b) => a - b);
console.log(JSON.stringify({ partialFrames, checkedPixels, shadowedPixels, headings: 8,
  perSurfaceMedianMs: +durations[Math.floor(durations.length / 2)]!.toFixed(3),
  perSurfaceP95Ms: +durations[Math.floor(durations.length * .95)]!.toFixed(3), maxQueries: Math.max(...callCounts) }));
console.log(JSON.stringify({ performanceSamples }));
console.log(JSON.stringify({ twelveHostsTwoNearbyMedianMs: +rosterTimes[Math.floor(rosterTimes.length / 2)]!.toFixed(3),
  twelveHostsTwoNearbyP95Ms: +rosterTimes[Math.floor(rosterTimes.length * .95)]!.toFixed(3), distantHostPixelQueries: 0 }));
console.log('check-paint-partial-visibility OK');
