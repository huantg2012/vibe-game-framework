/** Execute the production renderer methods with deterministic image/GL sinks.
 * This checks action/cache/lifecycle contracts, not GPU timing or appearance. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';

process.on('uncaughtException', error => {
  console.error(String(error.stack ?? error).split('\n').filter(line => !line.includes('data:text/javascript')).join('\n'));
  process.exitCode = 1;
});
const phaserStub = `
class Rectangle { static Union(a,b,out){return Object.assign(out,a,b);} }
export default { Geom:{Rectangle}, Textures:{FilterMode:{NEAREST:0}} };`;
async function rendererModule(path) {
  const result = await build({
    entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm',
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [{ name: 'image-sink', setup(builder) {
      builder.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'sink' }));
      builder.onLoad({ filter: /.*/, namespace: 'sink' }, () => ({ contents: phaserStub }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
globalThis.ImageData = class {
  constructor(data, width, height) {
    if (typeof data === 'number') { this.width = data; this.height = width; this.data = new Uint8ClampedArray(data * width * 4); }
    else { this.data = data; this.width = width; this.height = height; }
  }
};
const [{ LastLightPlayerPresentation }, { LastLightRenderer }] = await Promise.all([
  rendererModule('src/entities/player-last-light-presentation.ts'), rendererModule('src/art/last-light-renderer.ts'),
]);
const textures = new Map();
const image = () => ({
  x: 0, y: 0, visible: true, tintFill: false, mask: { stable: true }, scaleX: 1,
  setOrigin() { return this; }, setScale() { return this; },
  setVisible(value) { this.visible = value; return this; },
  setPosition(x, y) { this.x = x; this.y = y; return this; },
  setRotation(value) { this.rotation = value; return this; }, setDepth(value) { this.depth = value; return this; },
  setTexture() { return this; }, destroy() { this.destroyed = true; },
});
const scene = {
  textures: {
    createCanvas(key) {
      const texture = { key, refresh() {}, context: { putImageData(value) { texture.last = value.data.slice(); } } };
      textures.set(key, texture); return texture;
    },
    exists() { return true; }, remove(key) { textures.delete(key); },
  },
  add: { image },
};
const source = { key: 'base', yawIndex: 0, yaw: 0, pose: 'idle', phase: 0,
  wristWorld: [.328, .775, .066], shoulderWorld: [.276, 1.145, .008],
  wrist: [33, 43, 0], shoulder: [32, 35, 0], glovePixels: [35 * 64 + 32],
  rect: [0, 0, 64, 80], lampWorld: [.323, 1.296, .205] };
const baseFrame = { source, offsets: new Uint16Array([4 * (35 * 64 + 32)]),
  pixels: new Float32Array([0, 0, 30, 0, 0, 1, 90, 80, 70, 1, 0]),
  depths: new Float32Array(64 * 80), contact: null, lamp: [0, 0, 30], wrist: [0, 0, 0], shoulder: [0, 0, 0] };
const assets = {
  frames: Array.from({ length: 104 }, (_, i) => ({ ...baseFrame, source: { ...source,
    key: `base-${i}`, yawIndex: Math.floor(i / 13), yaw: Math.floor(i / 13) * Math.PI / 4,
    pose: i % 13 ? 'walk' : 'idle', phase: i % 13 ? (i % 13 - 1) / 12 * Math.PI * 2 : 0 } })),
  bodyWithoutArm: Array.from({ length: 104 }, () => baseFrame),
  attackArm: Array.from({ length: 120 }, () => baseFrame),
  headings: Array.from({ length: 8 }, (_, i) => i * Math.PI / 4),
};
const player = { x: 0, y: 0, moving: false,
  getPosition() { return this; }, getGroundY() { return this.y; }, getFacingAngle() { return 0; },
  isMoving() { return this.moving; }, getSprite() { return { visible: false }; } };
function modelFrame(id, part = 'body', depth = 0) {
  const frame = { id, width: 64, height: 80, albedo: new Uint8Array(64 * 80 * 4),
    normal: new Uint8Array(64 * 80 * 4), material: new Uint8Array(64 * 80 * 4), depth: new Uint8Array(64 * 80 * 4),
    meta: { amount: .85, fibre: .5, yaw: 0, phase: null, breath: 0, pose: 'idle', part,
      anchor: [32, 66], lamp: source.lampWorld, wrist: { world: source.wristWorld, screen: [33, 43] },
      shoulder: { world: source.shoulderWorld, screen: [32, 35] }, shadowCapsules: [], sweep: .2 },
    bakeMs: 0, buildMs: 0, triangles: 1 };
  const offset = (35 * 64 + 32) * 4, encoded = Math.round((depth + 80) * 256);
  frame.albedo.set([part === 'arm' ? 180 : 80, 80, 70, 255], offset);
  frame.normal.set([128, 255, 128, 255], offset);
  frame.material.set([150, 10, 255, 0], offset);
  frame.depth.set([encoded >> 8, encoded & 255, 4, 255], offset);
  return frame;
}
const rift = new LastLightPlayerPresentation(scene, player, assets, { lights: [] });
const originalImages = [...rift.getHitFlashImages()], originalMasks = originalImages.map(value => value.mask);
const look = { amount: .85, fibre: .5, membrane: .5, seconds: 0, motion: false, subjective: false };
rift.setAssimilationLook(look);
const body = modelFrame(1), without = modelFrame(2, 'withoutArm'), arm = modelFrame(3, 'arm', .2);
const queries = [];
let missing = false;
const provider = { getFrame(pose) {
  queries.push({ ...pose });
  return missing ? null : pose.part === 'arm' ? arm : pose.part === 'withoutArm' ? without : body;
} };
rift.setAssimilationModelSource(provider);
rift.setWeaponVisual('good');
const attack = { phase: 'active', elapsedMs: 160, facing: 0, windupMs: 100, activeMs: 120,
  recoveryMs: 200, contactHoldMs: 60, contactRemainingMs: 0 };
rift.setWeaponAttackPose(attack);
rift.syncPose(); rift.render();
assert(rift.attackIndex >= 0, 'A model bank must not disable the live attack');
assert.equal(rift.assimilationBodyWithoutArm.source.key, 'assimilation-2');
assert.equal(rift.assimilationAttackArm.source.key, 'assimilation-3');
assert.equal(rift.composedArm[35 * 64 + 32], 1, 'Near attack pixels win the original depth composition');
assert.deepEqual(queries.slice(-3).map(value => value.part), ['body', 'withoutArm', 'arm']);
assert.equal(queries.at(-1).phase, null, 'Attack bank keys do not multiply by walk phase');
assert.equal(rift.getAssimilationLookMetrics().count, 0, 'Production does not call the DEV frame timer');
const rearArm = modelFrame(4, 'arm', -.2);
rift.setAssimilationModelSource({ getFrame(pose) { return pose.part === 'arm' ? rearArm : pose.part === 'withoutArm' ? without : body; } });
rift.syncPose(); rift.render();
assert.equal(rift.composedArm[35 * 64 + 32], 0, 'An attack pixel behind the body cannot punch through its depth');
rift.setAssimilationModelSource(provider);
rift.setWeaponAttackPose({ ...attack, elapsedMs: 50, phase: 'windup' }); rift.syncPose();
const windupIndex = rift.attackIndex;
rift.setWeaponAttackPose(attack); rift.syncPose();
assert.notEqual(rift.attackIndex, windupIndex, 'The real combat clock advances while the geometry epoch stays fixed');
rift.setWeaponAttackPose({ ...attack, contactRemainingMs: 40, contactElapsedMs: 140 }); rift.syncPose();
const heldIndex = rift.attackIndex;
rift.setWeaponAttackPose({ ...attack, elapsedMs: 210, contactRemainingMs: 30, contactElapsedMs: 140 }); rift.syncPose();
assert.equal(rift.attackIndex, heldIndex, 'Contact hold uses the existing frozen contact time');
for (let i = 0; i < originalImages.length; i++) {
  assert.equal(rift.getHitFlashImages()[i], originalImages[i]);
  assert.equal(originalImages[i].mask, originalMasks[i]);
  originalImages[i].tintFill = true;
}
rift.setWeaponAttackPose({ ...attack, phase: 'idle' });
assert.equal(rift.attackIndex, -1, 'Death/cancel clears the cached arm before another render');
rift.render();
assert.equal(rift.composedArm.some(Boolean), false, 'A late render cannot replay the cancelled arm');
assert(originalImages.every(value => value.tintFill), 'Pixel replacement leaves Combat in control of flash/tint');
const countBeforeSet = queries.length;
rift.setAssimilationModelSource({ getFrame: provider.getFrame });
assert.equal(queries.length, countBeforeSet, 'Installing a completed epoch must not advance the action clock');
missing = true; player.moving = true; player.x += 9;
rift.setWeaponAttackPose(attack); rift.syncPose(); rift.render();
assert.equal(rift.assimilationModel, null);
assert(rift.attackIndex >= 0, 'A missing cache frame still renders the current base attack immediately');
missing = false;
rift.setAssimilationLook({ ...look, amount: 0 }); rift.syncPose(); rift.render();
const zeroPixels = rift.output.data.slice();
rift.setAssimilationModelSource(null); rift.syncPose(); rift.render();
assert.deepEqual(rift.output.data, zeroPixels, 'A0 is identical with and without a model provider');
const firstPrepared = rift.prepareModelFrame(body);
assert.equal(rift.prepareModelFrame({ ...body, albedo: body.albedo.slice() }), firstPrepared,
  'Re-expanded channels reuse the stable frame-id preparation');
for (let id = 10; id < 85; id++) rift.prepareModelFrame(modelFrame(id));
assert.equal(rift.assimilationFrames.size, 64, 'Prepared frame retention is bounded');
rift.destroy();
assert.equal(textures.size, 0); assert.equal(rift.assimilationFrames.size, 0);

// Real Haven draw method, with WebGL as a deterministic command sink.
const uniforms = new Map(), gl = new Proxy({ isContextLost: () => false }, {
  get(target, name) {
    return target[name] ?? ((...args) => { if (String(name).startsWith('uniform')) uniforms.set(args[0], args.slice(1)); });
  },
});
const haven = Object.create(LastLightRenderer.prototype);
const idle = { x: 0, y: 0, width: 64, height: 80, anchor: [32, 66], yaw: 0,
  pose: 'idle', phase: 2, lamp: source.lampWorld, shadowCapsules: [] };
const sit = { ...idle, pose: 'sit', phase: 0 };
const images = new Proxy({}, { get: () => ({ width: 64, height: 80 }) });
Object.assign(haven, {
  destroyed: false, gl, pack: { frames: [idle, sit], camera: { width: 960, height: 640, scale: 26.5,
    origin: [480, 320], target: [0, 0, 0], direction: [0, 0, 1] }, images, exteriorPadding: 0,
    actorDepthOffset: 80, actorDepthScale: 256 }, basis: { right: [1, 0, 0], up: [0, 1, 0], back: [0, 0, 1] },
  assimilationLook: { ...rift.assimilationLook, amount: .85, enabled: true },
  assimilationMetrics: { count: 0, totalMs: 0 }, assimilationPose: { part: 'body' }, assimilationTextures: new Map(),
  assimilationUploadedFrame: null, assimilationModel: null, assimilationPaletteUploaded: false,
  assimilationBounds: {}, frameBounds: new Map([[idle, { x: 20, y: 20, width: 20, height: 40 }], [sit, { x: 20, y: 20, width: 20, height: 40 }]]),
  actorBounds: {}, lampPosition: {}, shadows: { updateShoulder() {} }, images: new Map(), observer: [0, 0], lastSeconds: 0,
  environment: {}, composite: {}, lights: [
    { id: 'core-heart', position: [0, 0, 0], color: [1, 1, 1], power: 1, radius: 1 },
    { id: 'haven-furnace', position: [0, 0, 0], color: [1, 1, 1], power: 1, radius: 1 }],
  uniform(_program, name) { return name; }, begin() {}, texture() { return {}; },
});
const sitModel = modelFrame(100); sitModel.meta.pose = 'sit'; sitModel.meta.seatHeight = .48;
const havenQueries = [];
haven.setAssimilationModelSource({ getFrame(pose) { havenQueries.push({ ...pose }); return pose.pose === 'sit' ? sitModel : null; } });
const renderState = { seconds: 0, world: [0, 0, 0], yaw: 0, walking: false, resting: true,
  health: [1, 1, 1], charge: 0, growth: 0, thicken: 0, pulses: new Float32Array(4), reducedMotion: false,
  gaitPose: 'sit', gaitFrame: 0 };
haven.draw(renderState);
assert.equal(havenQueries.at(-1).pose, 'sit'); assert.equal(haven.currentFrame.pose, 'sit');
assert.equal(uniforms.get('uAssimilation')[0], .85, 'Seating cannot clear assimilation materials');
assert.equal(uniforms.get('uAssimilationSeatHeight')[0], .48);
assert.equal(haven.getAssimilationModelPose().pose, 'sit');
const nextPalette = { dark: [12, 18, 24], mid: [48, 66, 84], light: [90, 108, 126] };
haven.assimilationLook.fibrePalette = nextPalette;
haven.assimilationLook.neutralPalette = nextPalette;
haven.assimilationLook.neutralFraction = .25;
haven.draw({ ...renderState, gaitPose: 'idle', gaitFrame: 2, resting: false });
assert.equal(havenQueries.at(-1).breath, Math.PI / 2, 'Idle geometry follows the existing eight breathing samples');
assert.equal(haven.assimilationModel, null, 'A missing current frame cannot retain the previous seated geometry');
assert.equal(uniforms.get('uAssimilationNeutralFraction')[0], .25, 'The neutral source fraction reaches the shader');
assert.deepEqual(uniforms.get('uAssimilationFibre[1]'), nextPalette.mid.map(value => value / 255),
  'Changing a source palette updates an already-used renderer');
assert.deepEqual(uniforms.get('uAssimilationNeutral[2]'), nextPalette.light.map(value => value / 255));
nextPalette.mid[0] = 52;
haven.assimilationLook.paletteRevision = (haven.assimilationLook.paletteRevision ?? 0) + 1;
haven.draw({ ...renderState, gaitPose: 'idle', gaitFrame: 2, resting: false });
assert.equal(uniforms.get('uAssimilationFibre[1]')[0], 52 / 255,
  'A revised palette uploads its changed channels even when its object identity stays stable');
assert.equal(haven.assimilationMetrics.count, 0);
console.log(JSON.stringify({ pass: true, checks: ['production setters', 'live attack bank and depth',
  'death cancellation before late render', 'stable images/masks/tints', 'cache miss uses current action',
  'A0 exact pixels', 'stable frame-id reuse', '64 prepared-frame bound and teardown',
  'Haven seated materials and pose', 'real idle breathing query', 'dynamic source and neutral uniforms', 'production timers disabled'],
  limits: 'Deterministic renderer execution with image/GL command sinks; real gameplay appearance and CPU/GPU performance require browser verification.' }));
