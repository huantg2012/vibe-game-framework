import { decodeLastLightDataPng } from './player-last-light-png';
import type Phaser from 'phaser';
import { unprojectLastLight, type LightVector } from '@/art/last-light-spatial';
import { LAST_LIGHT_STRIDE_METRES } from '@/art/last-light-gait';
import { sampleWorldMaterialLight, type WorldMaterialLighting } from './form-renderers/d/world-material-light';
import { LAST_LIGHT_PLAYER_CAMERA as CAMERA, LAST_LIGHT_PLAYER_BASIS as BASIS,
  lastLightToNative, lastLightScreenHeading, nearestLastLightYaw } from './player-last-light-math';

interface ExportFrame {
  key: string; yawIndex: number; yaw: number; pose: 'idle' | 'walk'; phase: number;
  rect: [number, number, number, number]; lampWorld: LightVector;
}
interface ExportManifest {
  frame: { width: number; height: number; foot: [number, number]; scale: number };
  variants: { id: string; atlas: Record<string, string>; frames: ExportFrame[] }[];
}
interface PreparedFrame {
  readonly source: ExportFrame;
  readonly offsets: Uint16Array;
  /** Native local XYZ, native normal XYZ, albedo RGB, AO, emission. */
  readonly pixels: Float32Array;
  readonly contact: ImageData;
  readonly lamp: readonly [number, number, number];
}
export interface LastLightPlayerAssets {
  readonly frames: readonly PreparedFrame[];
  readonly headings: readonly number[];
}
const ASSET_ROOT = '/docs/art/previews/rift-player-models/assets/';
let cachedAssets: LastLightPlayerAssets | null = null;

async function loadPixels(path: string, signal?: AbortSignal): Promise<{ width: number; height: number; data: Uint8Array | Uint8ClampedArray }> {
  const response = await fetch(ASSET_ROOT + path, { signal });
  if (!response.ok) throw new Error(`Player A texture: ${response.status} ${path}`);
  if (path.endsWith('/material.png')) return decodeLastLightDataPng(new Uint8Array(await response.arrayBuffer()));
  const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    signal?.throwIfAborted();
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Player A texture decoding needs a 2D canvas');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally { bitmap.close(); }
}

/** Only the explicit DEV fixture loads these candidate assets. No review light is imported. */
export async function prepareLastLightPlayerAssets(options: { signal?: AbortSignal } = {}): Promise<LastLightPlayerAssets> {
  options.signal?.throwIfAborted();
  if (cachedAssets) return cachedAssets;
  const response = await fetch(ASSET_ROOT + 'manifest.json', { signal: options.signal });
  if (!response.ok) throw new Error(`Player A manifest: ${response.status}`);
  const manifest = await response.json() as ExportManifest;
  const variant = manifest.variants.find(value => value.id === 'a');
  if (!variant || manifest.frame.width !== 64 || manifest.frame.height !== 80 || manifest.frame.scale !== 26.5
    || manifest.frame.foot[0] !== 32 || manifest.frame.foot[1] !== 66 || variant.frames.length !== 104)
    throw new Error('Player A export contract changed');
  const [albedo, normal, material, depth, contact] = await Promise.all(
    ['albedo', 'normal', 'material', 'depth', 'contact'].map(channel => loadPixels(variant.atlas[channel]!, options.signal)));
  if (![albedo, normal, material, depth, contact].every(channel => channel?.width === 832 && channel.height === 640))
    throw new Error('Player A atlas dimensions changed');
  const frames: PreparedFrame[] = [];
  for (const source of variant.frames) {
    const offsets: number[] = [], pixels: number[] = [];
    const contactPixels = new Uint8ClampedArray(64 * 80 * 4);
    for (let y = 0; y < 80; y++) for (let x = 0; x < 64; x++) {
      const i = ((source.rect[1] + y) * albedo!.width + source.rect[0] + x) * 4, j = (y * 64 + x) * 4;
      contactPixels.set(contact!.data.subarray(i, i + 4), j);
      if (!albedo!.data[i + 3]) continue;
      const point = unprojectLastLight(x + .5, y + .5, (depth!.data[i]! * 256 + depth!.data[i + 1]!) / 256 - 80, CAMERA, BASIS);
      const p = lastLightToNative(point);
      const n = lastLightToNative([normal!.data[i]! / 127.5 - 1, normal!.data[i + 1]! / 127.5 - 1, normal!.data[i + 2]! / 127.5 - 1]);
      offsets.push(j);
      pixels.push(p[0] * CAMERA.scale, p[1] * CAMERA.scale, p[2] * CAMERA.scale, ...n,
        albedo!.data[i]!, albedo!.data[i + 1]!, albedo!.data[i + 2]!, material!.data[i + 2]! / 255, material!.data[i + 3]! / 255 * 2);
    }
    const lamp = lastLightToNative(source.lampWorld);
    frames.push({ source, offsets: new Uint16Array(offsets), pixels: new Float32Array(pixels),
      contact: new ImageData(contactPixels, 64, 80), lamp: [lamp[0] * CAMERA.scale, lamp[1] * CAMERA.scale, lamp[2] * CAMERA.scale] });
  }
  options.signal?.throwIfAborted();
  cachedAssets = { frames, headings: frames.filter(frame => frame.source.pose === 'idle').map(frame => lastLightScreenHeading(frame.source.yaw)) };
  return cachedAssets;
}

interface PlayerPresentationSource {
  getPosition(): Readonly<{ x: number; y: number }>;
  getGroundY(): number;
  getFacingAngle(): number;
  isMoving(): boolean;
  getSprite(): { visible: boolean };
}
let nextTextureId = 0;
export class LastLightPlayerPresentation {
  private readonly image: Phaser.GameObjects.Image;
  private readonly contact: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly contactTexture: Phaser.Textures.CanvasTexture;
  private readonly output = new ImageData(64, 80);
  private readonly light: [number, number, number] = [0, 0, 0];
  private readonly lamp = { x: 0, y: 0, z: 0 };
  private frameIndex = 0;
  private previousContactFrame = -1;
  private previousX = NaN;
  private previousY = NaN;
  private distance = 0;
  private rendered = false;
  private destroyed = false;
  constructor(private readonly scene: Phaser.Scene, private readonly player: PlayerPresentationSource,
    private readonly assets: LastLightPlayerAssets, private readonly lighting: WorldMaterialLighting) {
    const key = `last-light-player-a-${++nextTextureId}`;
    const texture = scene.textures.createCanvas(key, 64, 80);
    const contactTexture = scene.textures.createCanvas(`${key}-contact`, 64, 80);
    if (!texture || !contactTexture) {
      if (texture) scene.textures.remove(texture.key);
      if (contactTexture) scene.textures.remove(contactTexture.key);
      throw new Error('Cannot allocate Player A textures');
    }
    this.texture = texture; this.contactTexture = contactTexture;
    this.contact = scene.add.image(0, 0, contactTexture.key).setOrigin(.5, 66 / 80);
    this.image = scene.add.image(0, 0, texture.key).setOrigin(.5, 66 / 80);
    this.syncPose();
  }
  syncPose(): void {
    if (this.destroyed) return;
    const position = this.player.getPosition(), groundY = this.player.getGroundY();
    const delta = Math.hypot(position.x - this.previousX, position.y - this.previousY);
    if (Number.isFinite(delta) && delta < 32 && this.player.isMoving()) this.distance += delta;
    this.previousX = position.x; this.previousY = position.y;
    const row = nearestLastLightYaw(this.player.getFacingAngle(), this.assets.headings);
    const column = this.player.isMoving() ? 1 + Math.floor(this.distance / (LAST_LIGHT_STRIDE_METRES * CAMERA.scale) * 12) % 12 : 0;
    this.frameIndex = row * 13 + column;
    const frame = this.assets.frames[this.frameIndex]!;
    this.image.setPosition(position.x, groundY); this.contact.setPosition(position.x, groundY);
    this.lamp.x = position.x + frame.lamp[0]; this.lamp.y = groundY + frame.lamp[1]; this.lamp.z = frame.lamp[2];
  }
  getLampPosition = (): Readonly<{ x: number; y: number; z: number }> => this.lamp;
  render(): void {
    if (this.destroyed) return;
    const frame = this.assets.frames[this.frameIndex]!, pixels = frame.pixels, target = this.output.data;
    target.fill(0);
    for (let i = 0; i < frame.offsets.length; i++) {
      const p = i * 11, out = frame.offsets[i]!;
      sampleWorldMaterialLight(this.lighting, this.image.x + pixels[p]!, this.image.y + pixels[p + 1]!, pixels[p + 2]!,
        pixels[p + 3]!, pixels[p + 4]!, pixels[p + 5]!, true, this.light);
      for (let c = 0; c < 3; c++) target[out + c] = pixels[p + 6 + c]! * (this.light[c]! * pixels[p + 9]! + pixels[p + 10]!);
      target[out + 3] = 255;
    }
    this.texture.context.putImageData(this.output, 0, 0); this.texture.refresh();
    if (this.previousContactFrame !== this.frameIndex) {
      this.contactTexture.context.putImageData(frame.contact, 0, 0); this.contactTexture.refresh();
      this.previousContactFrame = this.frameIndex;
    }
    this.rendered = true;
  }
  /** The body is already lit in world space. Ground fog must not be applied
   * again at the projected head pixel. Only its opaque, solid-masked footprint
   * is erased; contact, terrain visibility and ground queries stay unchanged. */
  revealBody(visibility: { revealProjectedTerrain(image: Phaser.GameObjects.Image, strength: number): void }): void {
    if (this.rendered && !this.destroyed) visibility.revealProjectedTerrain(this.image, 1);
  }
  setGroundDepth(depth: number, floorDepth: number): void { this.image.setDepth(depth + .1); this.contact.setDepth(floorDepth); }
  getProbe(): Record<string, unknown> {
    const frame = this.assets.frames[this.frameIndex]!;
    return { ready: this.rendered && !this.destroyed, model: 'a', frame: frame.source.key, frameIndex: this.frameIndex,
      yaw: frame.source.yaw, pose: frame.source.pose, foot: { x: this.image.x, y: this.image.y, anchor: [32, 66] },
      lamp: { ...this.lamp }, oldBodyVisible: this.player.getSprite().visible, nativeScale: this.image.scaleX,
      nativeLights: this.lighting.lights.length, masked: !!this.image.mask, contactMasked: !!this.contact.mask };
  }
  destroy(): void {
    if (this.destroyed) return; this.destroyed = true;
    this.image.destroy(); this.contact.destroy();
    this.scene.textures.remove(this.texture.key); this.scene.textures.remove(this.contactTexture.key);
  }
}
