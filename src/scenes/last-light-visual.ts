import Phaser from 'phaser';
import { LastLightRenderer, type LastLightFrame, type LastLightImage, type LastLightLight,
  type LastLightRenderImages, type LastLightRenderState } from '../art/last-light-renderer';
import { LastLightFallback } from '../art/last-light-fallback';
import { LastLightGait } from '../art/last-light-gait';
import type { LastLightCamera, LightVector } from '../art/last-light-spatial';

/** Public present-tense operating state. Never accepts hidden forecasts. */
export interface LastLightState {
  moduleHealth: { core: number; storage: number; purifier: number };
  thickenLevel: number;
  offeringCharge: number;
  growthLevels: Readonly<Record<string, number>>;
  activeTarget: string | null;
  player: { x: number; y: number };
  lamp: { x: number; y: number };
  worldPlayer: { x: number; y: number; z: number };
  facingYaw: number;
  walking: boolean;
  resting: boolean;
}
interface PackedFrame {
  pose: 'idle' | 'walk' | 'sit'; direction: number; frame: number; yaw: number;
  rect: { x: number; y: number; width: number; height: number };
  anchor: readonly [number, number]; lamp: LightVector;
  shadowCapsules: readonly (readonly number[])[];
}
interface RuntimeManifest {
  version: number; canvas: { width: number; height: number }; camera: LastLightCamera;
  textures: Record<string, string>; lights: LastLightLight[];
  exteriorPadding?: number;
  exteriorLayers: { id: string; color: string; parallax: number; padding?: number; offset?: readonly [number, number] }[];
  actor: { width: number; height: number; frameWidth: number; frameHeight: number;
    anchor: readonly [number, number]; textures: Record<string, string>; frames: PackedFrame[] };
}
type PulseKind = 'repair' | 'growth' | 'offering' | 'offering-complete';
const ROOT = 'assets/last-light/';
const KEY = 'last-light:';
interface LastLightAssetProfile { root: string; cachePrefix: string; exteriorMotion?: 'joint-depth'; }
const PRODUCTION_ASSETS: LastLightAssetProfile = { root: ROOT, cachePrefix: KEY, exteriorMotion: 'joint-depth' };

/** An explicit DEV fixture may own a complete asset pack. Never replace a
 * production texture under the same cache key, or let a query string silently
 * change the production scene. Set before BootScene starts its preload. */
function assetProfile(scene: Phaser.Scene): LastLightAssetProfile {
  if (!import.meta.env.DEV) return PRODUCTION_ASSETS;
  const candidate: unknown = scene.registry.get('lastLightAssetProfile');
  if (candidate == null) return PRODUCTION_ASSETS;
  const profile = candidate as Partial<LastLightAssetProfile>;
  if (typeof profile.root !== 'string' || !profile.root.startsWith('/') || !profile.root.endsWith('/')
    || typeof profile.cachePrefix !== 'string' || !profile.cachePrefix.endsWith(':')
    || profile.cachePrefix === KEY || profile.cachePrefix.length < 2) {
    throw new Error('A DEV Last Light asset profile needs an absolute root ending in / and a unique cachePrefix ending in :.');
  }
  if(profile.exteriorMotion !== undefined && profile.exteriorMotion !== 'joint-depth')throw new Error('Unknown DEV Last Light exterior motion profile.');
  return { root: profile.root, cachePrefix: profile.cachePrefix, exteriorMotion: profile.exteriorMotion };
}
const IMAGE_FILES = [
  'base-before-energy.png', 'background.png', 'haven.png', 'albedo.png', 'normal.png', 'rough-spec.png',
  'depth.png', 'energy-depth.png', 'reference.png', 'motion.png', 'objects.png', 'core-energy.png', 'light-pollution.png',
  'light-core.png', 'light-storage.png', 'light-purifier.png', 'light-furnace.png', 'exterior-far.png', 'exterior-middle.png', 'exterior-near.png',
  'exterior-depth.png', 'exterior-fields.png', 'actor-color.png', 'actor-albedo.png', 'actor-normal.png', 'actor-rough-spec.png', 'actor-depth.png',
] as const;

/** PNG data includes radiance at alpha zero. HTML image/canvas decoding can
 * discard it. This loader keeps straight channels and participates in Phaser's
 * processing queue, so create() never races an asynchronous decode. */
class LastLightBitmapFile extends Phaser.Loader.File {
  constructor(loader: Phaser.Loader.LoaderPlugin, filename: string, profile: LastLightAssetProfile) {
    super(loader, { type: 'lastlightbitmap', key: profile.cachePrefix + filename, url: profile.root + filename,
      extension: 'png', responseType: 'arraybuffer' });
    this.cache = loader.cacheManager.binary;
  }
  override onProcess(): void {
    this.state = Phaser.Loader.FILE_PROCESSING;
    const data = this.xhrLoader?.response as ArrayBuffer | undefined;
    if (!data) { this.onProcessError(); return; }
    void createImageBitmap(new Blob([data], { type: 'image/png' }), {
      imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none',
    }).then(bitmap => { this.data = bitmap; this.onProcessComplete(); }, () => this.onProcessError());
  }
}
let visualId = 0;
// A game-scoped active-time clock survives haven reconstruction after a Rift
// trip. It does not run while the Scene is paused, hidden, or reduced-motion;
// no wall-clock timers, save fields or changes to actor / source-light phases.
const exteriorClocks = new WeakMap<Phaser.Game, { seconds: number }>();
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

/** Production owner of the A model's material compositor. All animation is
 * stepped by the Scene clock: pause/reentry needs no global RAF or timers. */
export class LastLightVisual {
  private renderer: LastLightRenderer | LastLightFallback;
  private readonly pack;
  private readonly fallbackBase: LastLightImage;
  private readonly fallbackActor: LastLightImage;
  private readonly textureKey: string;
  private texture: Phaser.Textures.Texture;
  private image: Phaser.GameObjects.Image;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly pulses = new Float32Array(6);
  private readonly renderState: LastLightRenderState = {
    seconds: 0, world: [0, 0, 0], yaw: 0, walking: false, resting: false,
    health: [1, 1, 1], charge: 0, growth: 0, thicken: 0, pulses: this.pulses,
    reducedMotion: false, gaitPose: 'idle', gaitFrame: 0,
  };
  private readonly gait = new LastLightGait();
  private elapsed = 0;
  private readonly exteriorClock: { seconds: number };
  private disposed = false;

  static preload(scene: Phaser.Scene): void {
    const { root, cachePrefix } = assetProfile(scene);
    if (!scene.cache.json.exists(cachePrefix + 'manifest')) scene.load.json(cachePrefix + 'manifest', root + 'manifest.json');
    if (!scene.cache.json.exists(cachePrefix + 'occluders')) scene.load.json(cachePrefix + 'occluders', root + 'occluders.json');
    for (const filename of IMAGE_FILES) {
      if (!scene.cache.binary.exists(cachePrefix + filename)) scene.load.addFile(new LastLightBitmapFile(scene.load, filename, { root, cachePrefix }));
    }
  }
  constructor(private readonly scene: Phaser.Scene) {
    const clock = exteriorClocks.get(scene.game) ?? { seconds: 0 };
    exteriorClocks.set(scene.game, clock);
    this.exteriorClock = clock;
    const { root, cachePrefix, exteriorMotion } = assetProfile(scene);
    const manifest = scene.cache.json.get(cachePrefix + 'manifest') as RuntimeManifest | undefined;
    if (!manifest?.camera || !manifest.actor?.frames?.length) throw new Error('Last Light production assets are missing; preload must finish before creating the scene.');
    const image = (filename: string | undefined): LastLightImage => {
      const bitmap = filename && scene.cache.binary.get(cachePrefix + filename) as ImageBitmap | undefined;
      if (!bitmap) throw new Error(`Missing Last Light texture: ${filename ?? 'undefined'}`);
      return bitmap;
    };
    const t = manifest.textures, a = manifest.actor.textures;
    const exterior = (id: string): LastLightImage => image(manifest.exteriorLayers.find(layer => layer.id === id)?.color);
    const images: LastLightRenderImages = {
      scene: image(t.haven), background: image(t.background), far: exterior('far'), middle: exterior('middle'), near: exterior('near'),
      pollution: image(t.pollution), coreLight: image(t.coreLight), storageLight: image(t.storageLight), purifierLight: image(t.purifierLight), furnace: image(t.furnace),
      motion: image(t.motion), depth: image(t.depth), volumeDepth: image(t.volumeDepth), exteriorDepth: image(t.exteriorDepth), exteriorFields: image(t.exteriorFields??'exterior-fields.png'), energy: image(t.coreEnergy),
      normal: image(t.normal), albedo: image(t.albedo), rough: image(t.roughSpec),
      actorColor: image(a.albedo), actorNormal: image(a.normal), actorDepth: image(a.depth), actorRough: image(a.roughSpec),
    };
    const occluders = scene.cache.json.get(cachePrefix + 'occluders') as { triangles: number[] } | number[];
    const frames: LastLightFrame[] = manifest.actor.frames.map(frame => ({
      ...frame.rect, anchor: frame.anchor, yaw: frame.yaw, pose: frame.pose, phase: frame.frame, lamp: frame.lamp, shadowCapsules: frame.shadowCapsules,
    }));
    this.pack = { camera: manifest.camera, frames, lights: manifest.lights,
      occluders: Array.isArray(occluders) ? occluders : occluders.triangles,
      images, actorPortrait: image(a.color), actorDepthOffset: 80, actorDepthScale: 256,
      exteriorParallax: ['far', 'middle', 'near'].map(id => manifest.exteriorLayers.find(layer => layer.id === id)!.parallax) as [number, number, number],
      exteriorPadding: manifest.exteriorPadding ?? manifest.exteriorLayers[0]?.padding ?? -(manifest.exteriorLayers[0]?.offset?.[0] ?? 0),
      exteriorMotion,
    };
    this.fallbackBase = image(t.base); this.fallbackActor = image(a.color);
    try { this.renderer = new LastLightRenderer(this.pack); }
    catch (error) {
      scene.game.canvas.dataset.lastLightFallbackReason = error instanceof Error ? error.message : String(error);
      this.renderer = new LastLightFallback(this.pack, this.fallbackBase, this.fallbackActor);
    }
    scene.game.canvas.dataset.lastLightRenderer = this.renderer instanceof LastLightRenderer ? 'webgl2' : 'canvas-degraded';
    scene.game.canvas.dataset.lastLightAssetRoot = root;
    scene.game.canvas.dataset.lastLightAssetCache = cachePrefix;
    scene.game.canvas.dataset.lastLightExteriorMotion = exteriorMotion ?? 'production';
    this.textureKey = `last-light-composite-${++visualId}`;
    // TextureSource natively accepts canvas sources. addCanvas would force a
    // 2D context and CPU readback, so use TextureSource's WebGL upload path.
    const texture = scene.textures.addImage(this.textureKey, this.renderer.canvas as unknown as HTMLImageElement);
    if (!texture) { this.renderer.destroy(); throw new Error('Unable to create Last Light scene texture.'); }
    this.texture = texture; this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.image = scene.add.image(0, 0, this.textureKey).setOrigin(0).setDepth(10);
  }
  update(_time: number, delta: number, state: LastLightState): void {
    if (this.disposed) return;
    const step = Math.max(0, Math.min(delta, 100)) / 1000;
    this.elapsed += step;
    if (!this.reducedMotion.matches) this.exteriorClock.seconds += step;
    for (let i = 0; i < this.pulses.length; i++) this.pulses[i] = Math.max(0, this.pulses[i]! - step * .75);
    const s = this.renderState;
    s.seconds = this.elapsed; s.exteriorSeconds = this.exteriorClock.seconds; s.world = [state.worldPlayer.x, state.worldPlayer.y, state.worldPlayer.z];
    const gait=this.gait.update(s.world,step,state.resting);
    s.gaitPose=gait.pose; s.gaitFrame=gait.frame;
    s.yaw = state.facingYaw; s.walking = gait.moving; s.resting = state.resting;
    s.health = [clamp(state.moduleHealth.core), clamp(state.moduleHealth.storage), clamp(state.moduleHealth.purifier)];
    s.charge = clamp(state.offeringCharge); s.growth = Object.values(state.growthLevels).reduce((sum, level) => sum + Math.max(0, level), 0);
    s.thicken = Math.max(0, state.thickenLevel); s.reducedMotion = this.reducedMotion.matches;
    try { this.renderer.draw(s); }
    catch (error) {
      if (!(this.renderer instanceof LastLightRenderer)) throw error;
      this.image.destroy(); this.scene.textures.remove(this.textureKey); this.renderer.destroy();
      this.renderer = new LastLightFallback(this.pack, this.fallbackBase, this.fallbackActor);
      this.renderer.draw(s);
      const texture = this.scene.textures.addImage(this.textureKey, this.renderer.canvas as unknown as HTMLImageElement);
      if (!texture) throw new Error('Unable to restore Last Light compatibility texture.');
      this.texture = texture; texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.image = this.scene.add.image(0, 0, this.textureKey).setOrigin(0).setDepth(10);
      this.scene.game.canvas.dataset.lastLightRenderer = 'canvas-degraded';
      this.scene.game.canvas.dataset.lastLightFallbackReason = error instanceof Error ? error.message : String(error);
    }
    this.texture.source[0]!.update();
  }
  pulse(kind: PulseKind, target?: string): void {
    if (this.disposed) return;
    const key = target?.toLowerCase() ?? (kind === 'growth' ? 'growth' : 'offering');
    const index = ['core', 'storage', 'purifier', 'offering', 'growth', 'rift'].indexOf(key);
    if (index >= 0) this.pulses[index] = kind === 'offering-complete' ? 1.35 : 1;
  }
  /** The renderer uses the same authored shoulder socket as its actor frames. */
  syncPlayerLight(_player: { x: number; y: number }, _lamp: { x: number; y: number }): void {}
  getActorBounds(out: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    const b = this.renderer.actorBounds; return out.setTo(b.x, b.y, b.width, b.height);
  }
  getLampPosition<T extends { x: number; y: number }>(out: T): T {
    out.x = this.renderer.lampPosition.x; out.y = this.renderer.lampPosition.y; return out;
  }
  getPortrait(): string { return this.renderer.portrait(); }
  destroy(): void {
    if (this.disposed) return; this.disposed = true;
    this.image.destroy(); this.scene.textures.remove(this.textureKey); this.renderer.destroy();
  }
}
