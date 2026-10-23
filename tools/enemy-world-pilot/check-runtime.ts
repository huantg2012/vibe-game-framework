import { createVolumePresenceFrame, updateVolumePresenceFrame } from '../../src/systems/volume-presence';
import { ENEMY_WORLD_MATERIAL_RULES, ENEMY_WORLD_MATERIAL_ROUTING } from '../../src/generated/enemy-world-materials';
/** Real scheme-D attachments with live scene-light references and the actual
 * Rift sight query. Run with tools/contam-preview/tsconfig.json. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { schemeDMixed } from '../../src/entities/form-renderers/scheme-d-mixed';
import { resolveRuntimeEnemyWorldAppearance } from '../../src/entities/form-renderers/d/world-runtime';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { attachAnimatedModel, lightModelPixels } from '../../src/entities/form-renderers/d/model-visual';
import { productionModelFor } from '../../src/entities/form-renderers/d/production-models';
import { bakeHumanModel } from '../../src/entities/form-renderers/d/human-model';
import type { FormAttachContext, FormVisualPose } from '../../src/entities/form-renderers/form-renderer';
import type { WorldMaterialLighting } from '../../src/entities/form-renderers/d/world-material-light';
import type { NativeVolumeLight } from '../../src/generation/world-study/native-volume-raster';
import { INFILTRATOR_FORM, type ContaminationForm } from '../../src/generation/contamination-draw';
import { TileGrid } from '../../src/systems/tile-grid';
import { createRiftVisionConfig, VisibilitySystem } from '../../src/systems/visibility-system';
import { TileType } from '../../src/types/game-types';
import { createNativeMaterialLighting } from '../../src/systems/r100-world/material-lighting';

// Actual world-height sampling must shadow bodies without replacing FOV or
// copying the mutable scene lights. A moving shoulder lamp clears the wall.
{
  const heightField = new Float32Array(64 * 32);
  for (let y = 0; y < 32; y++) for (let x = 28; x < 36; x++) heightField[y * 64 + x] = 48;
  const lamp: NativeVolumeLight = { x: 52, y: 16, z: 24, radius: 100, intensity: 1,
    color: [1, 1, 1], castsShadow: true };
  const lights = [lamp];
  const lighting = createNativeMaterialLighting({ width: 64, height: 32, heightField }, lights);
  assert.equal(lighting.lights, lights);
  assert.equal(lighting.shadeAt!(8, 16, 12, lamp), .22);
  lamp.x = 20;
  assert.equal(lighting.shadeAt!(8, 16, 12, lamp), 1);
  lamp.x = 52;
  assert.equal(lighting.shadeAt!(8, 16, 96, lamp), 1);
}

// Independent light-path counterexamples. These coordinates exercise the
// surface receiver's 8px cells, including both side cells at an exact corner;
// height shadows alone cannot detect absent terrain between two visible ends.
{
  const width = 64, height = 32, absent = new Set<string>();
  let heightReads = 0;
  const heightField = new Proxy(new Float32Array(width * height), {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) heightReads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const matterAt = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height
    && !absent.has(`${Math.floor(x / 8)},${Math.floor(y / 8)}`);
  const lamp = (x: number, y: number): NativeVolumeLight => ({ x, y, z: 24,
    radius: 100, intensity: 1, color: [1, 1, 1], castsShadow: false });
  const shoulder = lamp(52, 4), local = lamp(52, 4), lights = [shoulder, local];
  const lighting = createNativeMaterialLighting({ width, height, heightField }, lights, matterAt);
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 1, 'unbroken floor transmits a local lamp');
  absent.add('3,0'); heightReads = 0;
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 0, 'a real VOID cell blocks a local lamp with visible endpoints');
  assert.equal(heightReads, 0, 'blocked material light returns before per-pixel height sampling');
  assert.equal(lighting.shadeAt!(4, 4, 2, shoulder), 1, 'slot-zero shoulder lamp preserves the surface shader VOID exception');
  local.x = 4; local.y = 4;
  assert.equal(lighting.shadeAt!(52, 4, 2, local), 0, 'the same VOID blocks reverse travel');
  absent.clear(); absent.add('1,0'); local.x = 20; local.y = 20;
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 0, 'diagonal light cannot slip past a missing horizontal side cell');
  absent.clear(); absent.add('0,1');
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 0, 'diagonal light cannot slip past a missing vertical side cell');
  absent.clear();
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 1, 'clear diagonal retains light');
  local.x = 5; local.y = 5;
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 1, 'same-cell light terminates without a spurious step');
  local.x = 68; local.y = 4;
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 0, 'a local lamp beyond the map cannot light through the absent edge');
  local.x = 52; local.y = 4; absent.add('3,0');
  lights[0] = local; lights[1] = shoulder;
  assert.equal(lighting.shadeAt!(4, 4, 2, local), 1, 'the exception follows current slot zero in the retained light array');
  assert.equal(lighting.shadeAt!(4, 4, 2, shoulder), 0, 'the previous shoulder object has no permanent bypass once it is a local lamp');
}

const digest = (data: Uint8ClampedArray) => createHash('sha256').update(data).digest('hex');
const alpha = (data: Uint8ClampedArray) => data.filter((_, i) => i % 4 === 3);
const center = { x: 512, y: 512 };
const basePose: FormVisualPose = { ...center, facing4: 'down', moving: false, visibility: 1,
  signal: 'idle', deltaMs: 0, attack: { phase: 'idle', progress: 0 }, activity: { phase: 'active', progress: 1 } };

function fixture() {
  const textures = new Map<string, { width: number; height: number; pixels: Uint8ClampedArray; uploads: number }>();
  const objects: Draw[] = [];
  let active = true;
  class Draw {
    key = ''; visible = true; alpha = 1; x = 0; y = 0;
    originX = 0; originY = 0; scaleX = 1; scaleY = 1;
    rects: { x: number; y: number; alpha: number }[] = [];
    inkAlpha = 1;
    constructor() { objects.push(this); }
    setDepth() { return this; }
    setOrigin(x: number, y = x) { this.originX = x; this.originY = y; return this; }
    setRotation() { return this; }
    setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
    setVisible(v: boolean) { this.visible = v; return this; }
    setAlpha(v: number) { this.alpha = v; return this; }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    clear() { this.rects.length = 0; return this; }
    fillStyle(_ink: number, alpha: number) { this.inkAlpha = alpha; return this; }
    fillRect(x: number, y: number) { this.rects.push({ x, y, alpha: this.inkAlpha }); return this; }
    destroy() { objects.splice(objects.indexOf(this), 1); }
  }
  const scene = {
    hosts: { isPaintFloorActive: () => active },
    add: { graphics: () => new Draw(), image: (_x: number, _y: number, key: string) => Object.assign(new Draw(), { key }) },
    textures: {
      exists: (key: string) => textures.has(key), remove: (key: string) => textures.delete(key),
      createCanvas(key: string, width: number, height: number) {
        assert(!textures.has(key), 'one live texture owner per attachment');
        const texture = { width, height, pixels: new Uint8ClampedArray(width * height * 4), uploads: 0 };
        textures.set(key, texture);
        return { setFilter() {}, refresh() {}, getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
          putImageData: (data: { data: Uint8ClampedArray }) => { texture.pixels.set(data.data); texture.uploads++; },
        }) };
      },
    },
  };
  return { scene: scene as unknown as FormAttachContext['scene'], textures, objects, setActive: (value: boolean) => { active = value; } };
}

const light: NativeVolumeLight = { x: center.x - 15, y: center.y + 64, z: 42,
  radius: 330, intensity: 2.6, color: [1, .94, .86], castsShadow: false };
let lights: readonly NativeVolumeLight[] = [light], shade = 1;
const lighting: WorldMaterialLighting = { get lights() { return lights; }, shadeAt: () => shade };
assert.deepEqual(resolveRuntimeEnemyWorldAppearance(undefined, 'human_remnant', lighting), {});
const frozenMaterial = Object.freeze({ ...resolveEnemyWorldAdaptation('crystal-fibre')!,
  key: 'saved-world-body-v1', mid: [12, 23, 34] as const, fibreCount: 5 });
for (const substrate of ['oil_film', 'ash_veil', 'insect_remnant', 'mammal_remnant', 'gas_mass'])
  assert.deepEqual(resolveRuntimeEnemyWorldAppearance(frozenMaterial, substrate, lighting), {});
const recovered = resolveRuntimeEnemyWorldAppearance(frozenMaterial, 'human_remnant', lighting);
assert.equal(recovered.worldAdaptation, frozenMaterial, 'the exact admitted profile is consumed without current CSV lookup');
assert.deepEqual(recovered.worldAdaptation!.mid, [12, 23, 34]);
assert.equal(recovered.worldAdaptation!.fibreCount, 5);
assert.notEqual(recovered.worldAdaptation!.key, resolveEnemyWorldAdaptation('crystal-fibre')!.key);

const human: ContaminationForm = { ...INFILTRATOR_FORM, substrate: 'human_remnant', coverage: 'rewrite' };
let humanCases = 0, paintCases = 0;
const worlds = ENEMY_WORLD_MATERIAL_RULES.map(rule => ENEMY_WORLD_MATERIAL_ROUTING.find(row => row.family === rule.family)!.worldId);
for (const [worldId, version] of [...['crystal-fibre', 'ruptured-film'].map(id => [id, 1] as const), ...worlds.map(id => [id, 2] as const)]) {
  const human = version === 2 ? {...INFILTRATOR_FORM, substrate: 'organic_remnant', coverage: 'rewrite' as const} : {...INFILTRATOR_FORM, substrate: 'human_remnant', coverage: 'rewrite' as const};
  const appearance = resolveRuntimeEnemyWorldAppearance(resolveEnemyWorldAdaptation(worldId), human.substrate, lighting, version);
  assert(appearance.worldAdaptation);
  assert.equal(appearance.worldLighting, lighting, 'scene light provider is retained, not copied');
  assert.equal(appearance.worldAdaptation,
    resolveRuntimeEnemyWorldAppearance(resolveEnemyWorldAdaptation(worldId), human.substrate, lighting, version).worldAdaptation, 'same world recipe has stable identity');
  const f = fixture();
  const visual = schemeDMixed.attach({ scene: f.scene, form: human, seed: 37, depth: 20, ...appearance });
  const texture = [...f.textures.values()][0]!;
  const image = f.objects.find(object => object.key)!;
  const actualPose = { ...basePose, attack: { phase: 'windup' as const, progress: .73, facingAngle: Math.PI } };
  visual.update(actualPose);
  const expected = bakeHumanModel({ seed: 37, coverage: 'rewrite', facing4: 'left', phase: 'windup',
    phase01: Math.floor(.73 * 30) / 29, worldAdaptation: appearance.worldAdaptation });
  lightModelPixels(expected.buf.data, expected.lightingSurface!, center.x, center.y, lighting);
  assert.deepEqual(texture.pixels, expected.buf.data, 'real attachment consumes committed combat heading and phase');
  const before = texture.pixels.slice();
  lights = [];
  visual.update(actualPose);
  assert.notEqual(digest(texture.pixels), digest(before), 'same cached pose receives a changed scene light list');
  assert.deepEqual(alpha(texture.pixels), alpha(before), 'light does not alter body alpha');
  lights = [light]; shade = 0;
  visual.update(actualPose);
  const shadowed = texture.pixels.slice();
  assert.notEqual(digest(shadowed), digest(before), 'scene occlusion is consumed by the runtime attachment');
  shade = 1;
  visual.update({ ...actualPose, x: center.x + 300 });
  assert.notEqual(digest(texture.pixels), digest(before), 'actual body position changes received light');
  const uploads = texture.uploads;
  visual.update({ ...actualPose, visibility: 0, deltaMs: 16 });
  assert.equal(texture.uploads, uploads, 'FOV-hidden bodies do not sample or upload materials');
  assert(!image.visible && image.alpha === 0);
  visual.destroy(); visual.destroy();
  assert.equal(f.textures.size, 0); assert.equal(f.objects.length, 0);
  humanCases++;

  for (const geometryVersion of [1, 2] as const) for (const substrate of (version === 2 ? ['fungal_mat', 'oil_film', 'ash_veil'] : ['fungal_mat'])) {
    const grid = new TileGrid({ cols: 128, rows: 128, tileSize: 8,
      tiles: Array.from({ length: 128 }, () => Array<number>(128).fill(TileType.FLOOR)) });
    const sight = new VisibilitySystem();
    Object.assign(sight, { config: createRiftVisionConfig(), occluders: grid,
      origin: { x: center.x + 96, y: center.y }, facingCache: Math.PI / 2 });
    const form: ContaminationForm = { substrate, portfolio: 'bing', continuity: substrate === 'fungal_mat' ? 'colony' : 'monolith',
      coverage: 'rewrite', occupancy: 'paint', lexemes: { motion: 'motion_anchor', sense: 'sense_touch', rhythm: 'rhythm_open', contact: 'contact_step' } };
    const adapted = fixture(), legacy = fixture();
    const common: Omit<FormAttachContext, 'scene'> = { form, seed: 1000, depth: .8, subjectId: 'paint',
      pin: { kind: 'cluster', ...center }, paintGeometryVersion: geometryVersion,
      isWalkableFloor: () => true, surfaceFloorAt: () => true,
      surfaceVisibilityAt: point => sight.getVisibilityAt(point),
      surfaceVisibilityRevision: () => sight.getQueryRevision(), surfaceIntersectsSight: bounds => sight.maySeeBounds(bounds) };
    const body = schemeDMixed.attach({ ...common, scene: adapted.scene,
      ...resolveRuntimeEnemyWorldAppearance(resolveEnemyWorldAdaptation(worldId), form.substrate, lighting, version) });
    const old = schemeDMixed.attach({ ...common, scene: legacy.scene });
    assert.deepEqual(body.stepFloors, old.stepFloors, 'material identity preserves frozen legacy/current contact cells');
    const cells = JSON.stringify(body.stepFloors);
    const pixels = [...adapted.textures.values()][0]!, baseline = [...legacy.textures.values()][0]!;
    const partial = { ...basePose, visibility: 0 };
    body.update(partial); old.update(partial);
    assert.deepEqual(alpha(pixels.pixels), alpha(baseline.pixels), 'partial real FOV is identical to legacy presentation');
    assert(pixels.pixels.some((value, index) => index % 4 === 3 && value > 0), 'surface remains partly visible while core is hidden');
    assert(pixels.pixels.some((value, index) => index % 4 === 3 && value === 0));
    const lit = pixels.pixels.slice();
    lights = [];
    body.update(partial);
    assert.notEqual(digest(pixels.pixels), digest(lit), 'paint reads changed lights without changing Host state');
    assert.deepEqual(alpha(pixels.pixels), alpha(lit));
    assert.equal(JSON.stringify(body.stepFloors), cells);
    lights = [light];
    adapted.setActive(false); legacy.setActive(false);
    body.update(partial); old.update(partial);
    assert.deepEqual(pixels.pixels, baseline.pixels, 'inactive Host residual material and alpha keep the existing contract');
    Object.assign(sight, { origin: { x: 24, y: 24 }, facingCache: -Math.PI / 2 });
    const uploaded = pixels.uploads;
    body.update(basePose);
    assert.equal(pixels.uploads, uploaded, 'wholly hidden surfaces skip material work');
    assert(adapted.objects.every(object => !object.visible && object.alpha === 0));
    body.destroy(); old.destroy();
    assert.equal(adapted.textures.size + legacy.textures.size, 0);
    assert.equal(adapted.objects.length + legacy.objects.length, 0);
    paintCases++;
  }
}

// Missing recipe opt-in must produce byte-identical normal attachments.
const a = fixture(), b = fixture();
const defaultVisual = schemeDMixed.attach({ scene: a.scene, form: human, seed: 37, depth: 20 });
const restoredVisual = schemeDMixed.attach({ scene: b.scene, form: human, seed: 37, depth: 20,
  ...resolveRuntimeEnemyWorldAppearance(undefined, human.substrate, lighting) });
defaultVisual.update(basePose); restoredVisual.update(basePose);
assert.deepEqual([...a.textures.values()][0]!.pixels, [...b.textures.values()][0]!.pixels);
defaultVisual.destroy(); restoredVisual.destroy();

// Lighting changes reuse anatomy and one GPU texture even when every visible
// frame needs a new material upload. This covers stable-pose lamp movement.
const cacheFixture = fixture(), model = productionModelFor('human_remnant')!;
let bakes = 0;
const cached = attachAnimatedModel({ scene: cacheFixture.scene, form: human, seed: 37, depth: 20,
  ...resolveRuntimeEnemyWorldAppearance(frozenMaterial, human.substrate, lighting) },
{ ...model, bake: request => { bakes++; return model.bake(request); } });
for (let frame = 0; frame < 120; frame++) {
  light.x = center.x - 40 + frame;
  cached.update(basePose);
}
assert.equal(bakes, 1, 'moving light never re-bakes a cached anatomy pose');
assert.equal(cacheFixture.textures.size, 1);
cached.destroy();
assert.equal(cacheFixture.textures.size, 0);
// Version 3 must reach the real attachment, including a stationary pose whose
// local lights change. These are mocked render objects, not a running game.
let nativeBodyCases = 0, nativeVolumeCases = 0;
for (const worldId of ['crystal-fibre', 'ruptured-film']) for (const coverage of ['infiltrate', 'rewrite', 'overwrite'] as const) {
  for (const substrate of ['organic_remnant', 'insect_remnant', 'mammal_remnant', 'worm_remnant', 'stalk_clump']) {
    const f = fixture(), form = { ...INFILTRATOR_FORM, substrate, coverage };
    const appearance = resolveRuntimeEnemyWorldAppearance(resolveEnemyWorldAdaptation(worldId), substrate, lighting, 3);
    const visual = schemeDMixed.attach({ scene: f.scene, form, seed: 37, depth: 20, ...appearance });
    visual.update(basePose);
    const texture = [...f.textures.values()][0]!;
    const expected = productionModelFor(substrate, true, 3)!.bake({ seed: 37, coverage, facing4: 'down', phase: 'idle', phase01: 0, worldAdaptation: appearance.worldAdaptation });
    assert(expected.lightingSurface);
    lightModelPixels(expected.buf.data, expected.lightingSurface, center.x, center.y, lighting);
    assert.deepEqual(texture.pixels, expected.buf.data, `${substrate}: v3 routing uses its own anatomy`);
    const before = texture.pixels.slice(); lights = [];
    visual.update(basePose);
    assert.notEqual(digest(texture.pixels), digest(before)); assert.deepEqual(alpha(texture.pixels), alpha(before));
    lights = [light]; const uploads = texture.uploads;
    visual.update({ ...basePose, visibility: 0, deltaMs: 16 }); assert.equal(texture.uploads, uploads);
    visual.destroy(); assert.equal(f.textures.size, 0); assert.equal(f.objects.length, 0); nativeBodyCases++;
  }
  for (const substrate of ['gas_mass', 'mist_bank', 'dust_swarm', 'sound_echo']) {
    const f = fixture(), form: ContaminationForm = { ...INFILTRATOR_FORM, substrate, coverage, occupancy: 'volume', portfolio: 'ding',
      continuity: 'monolith', lexemes: { motion: 'motion_anchor', sense: 'sense_touch', rhythm: 'rhythm_open', contact: 'contact_step' } };
    const rect = { x: center.x - 64, y: center.y - 48, w: 128, h: 96 };
    const frame = substrate === 'sound_echo' ? undefined : updateVolumePresenceFrame(createVolumePresenceFrame(), { substrate, coverage, elapsedMs: 2300, rect, active: true });
    const frozen = JSON.stringify(frame);
    Object.assign(f.scene, { hosts: { getVolumePresenceFrame: () => frame,
      getVisualPin: () => ({ ...rect, width: rect.w, height: rect.h }), getSubjects: () => [] } });
    const visual = schemeDMixed.attach({ scene: f.scene, form, seed: 37, depth: 20, subjectId: 'volume-v3',
      pin: { kind: 'cluster', x: rect.x, y: rect.y, width: rect.w, height: rect.h }, stainWorldPoint: { x: -1000, y: -1000 },
      ...resolveRuntimeEnemyWorldAppearance(resolveEnemyWorldAdaptation(worldId), substrate, lighting, 3) });
    const pose = { ...basePose, volumeTimeMs: 2300 };
    visual.update(pose); const texture = [...f.textures.values()][0]!, before = texture.pixels.slice();
    assert(before.some((v, i) => i % 4 === 3 && v > 0));
    lights = []; visual.update(pose);
    assert.notEqual(digest(texture.pixels), digest(before), `${substrate}: stationary field receives changed lights`);
    assert.deepEqual(alpha(texture.pixels), alpha(before)); lights = [light];
    assert.equal(JSON.stringify(frame), frozen, 'attachment does not mutate authoritative Host density');
    const uploads = texture.uploads;
    visual.update({ ...pose, visibility: 0, deltaMs: 16 }); assert.equal(texture.uploads, uploads);
    visual.destroy(); assert.equal(f.textures.size, 0); assert.equal(f.objects.length, 0); nativeVolumeCases++;
  }
}
console.log(JSON.stringify({ humanCases, paintCases, nativeBodyCases, nativeVolumeCases, supportedSubstrates: 13,
  liveSceneLight: true, committedAttack: true, frozenContactCells: true, localSightAlpha: true,
  localLightVoidBlocked: true, lightNoCornerCut: true, shoulderSlotException: true,
  legacyBytes: true, inactiveHostParity: true, hiddenWorkSkipped: true, boundedTextureLifecycle: true }));
