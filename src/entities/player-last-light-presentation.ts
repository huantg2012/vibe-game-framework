import { decodeLastLightDataPng } from './player-last-light-png';
import Phaser from 'phaser';
import { renderCrowbarPixels, type CrowbarQuality, type CrowbarVariant } from '@/art/crowbar-pixels';
import type { WeaponAttackPose } from '@/systems/weapon-swing';
import type { PlayerExternalVisuals } from './player-external-visuals';
import { lastLightAttackSampleIndex } from './player-last-light-combat';
import { unprojectLastLight, type LightVector } from '@/art/last-light-spatial';
import { LAST_LIGHT_STRIDE_METRES, lastLightWalkArm } from '@/art/last-light-gait';
import {
  ASSIMILATION_SURFACE_STRIDE, AssimilationLookParameters, createAssimilationLookMetrics,
  getAssimilationLookPalettes, recordAssimilationLookTime, sampleAssimilationSurface, writeAssimilationSurface,
  type AssimilationLookMetrics, type AssimilationLookState,
} from '@/art/assimilation-appearance';
import { sampleWorldMaterialLight, type WorldMaterialLighting } from './form-renderers/d/world-material-light';
import { LAST_LIGHT_PLAYER_CAMERA as CAMERA, LAST_LIGHT_PLAYER_BASIS as BASIS,
  lastLightToNative, lastLightScreenHeading, nearestLastLightYaw } from './player-last-light-math';

interface ExportFrame {
  key: string; yawIndex: number; yaw: number; pose: 'idle' | 'walk' | 'attack'; phase: number | string;
  wristWorld: LightVector; shoulderWorld: LightVector; wrist: LightVector; shoulder: LightVector; glovePixels: number[]; sweep?: number;
  rect: [number, number, number, number]; lampWorld: LightVector;
}
interface ExportManifest {
  frame: { width: number; height: number; foot: [number, number]; scale: number };
  variants: { id: string; atlas: Record<string, string>; frames: ExportFrame[] }[];
  bodyWithoutArm: { width: number; height: number; atlas: Record<string,string> };
  attackArm: { width: number; height: number; atlas: Record<string,string>; frames: ExportFrame[] };
}
interface PreparedFrame {
  readonly source: ExportFrame;
  readonly offsets: Uint16Array;
  /** Native local XYZ, native normal XYZ, albedo RGB, AO, emission. */
  readonly pixels: Float32Array;
  readonly contact: ImageData | null;
  readonly depths: Float32Array;
  readonly lamp: readonly [number, number, number];
  readonly wrist: LightVector;
  readonly shoulder: LightVector;
}
export interface LastLightPlayerAssets {
  readonly frames: readonly PreparedFrame[];
  readonly headings: readonly number[];
  readonly bodyWithoutArm: readonly PreparedFrame[];
  readonly attackArm: readonly PreparedFrame[];
}
const ASSET_ROOT = '/assets/player-last-light-a/';
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

/** Synchronous admission check; asynchronous preparation belongs to departure/recovery. */
export function getPreparedLastLightPlayerAssets(): LastLightPlayerAssets | null { return cachedAssets; }

/** Load the selected production package; no inspection-light channel is shipped. */
export async function prepareLastLightPlayerAssets(options: { signal?: AbortSignal } = {}): Promise<LastLightPlayerAssets> {
  options.signal?.throwIfAborted();
  if (cachedAssets) return cachedAssets;
  const response = await fetch(ASSET_ROOT + 'manifest.json', { signal: options.signal });
  if (!response.ok) throw new Error(`Player A manifest: ${response.status}`);
  const manifest = await response.json() as ExportManifest;
  const variant = manifest.variants.find(value => value.id === 'a');
  if (!variant || manifest.frame.width !== 64 || manifest.frame.height !== 80 || manifest.frame.scale !== 26.5
    || manifest.frame.foot[0] !== 32 || manifest.frame.foot[1] !== 66 || variant.frames.length !== 104 || manifest.attackArm?.frames.length !== 120)
    throw new Error('Player A export contract changed');
  const prepareGroup = async (atlas: Record<string,string>, sources: readonly ExportFrame[], width: number, height: number): Promise<PreparedFrame[]> => {
    const [albedo, normal, material, depth, contact] = await Promise.all(
      ['albedo','normal','material','depth','contact'].map(channel => atlas[channel] ? loadPixels(atlas[channel]!, options.signal) : Promise.resolve(null)));
    if (![albedo,normal,material,depth].every(channel => channel?.width === width && channel.height === height)) throw new Error('Player A atlas dimensions changed');
    const frames: PreparedFrame[] = [];
    for (const source of sources) {
      const offsets: number[] = [], pixels: number[] = [];
      const depths = new Float32Array(64 * 80).fill(-Infinity);
      const contactPixels = contact ? new Uint8ClampedArray(64 * 80 * 4) : null;
      for (let y = 0; y < 80; y++) for (let x = 0; x < 64; x++) {
        const i = ((source.rect[1] + y) * width + source.rect[0] + x) * 4, j = (y * 64 + x) * 4;
        if (contactPixels && contact) contactPixels.set(contact.data.subarray(i, i + 4), j);
        if (!albedo!.data[i + 3]) continue;
        const cameraDepth = (depth!.data[i]! * 256 + depth!.data[i + 1]!) / 256 - 80;
        depths[j / 4] = cameraDepth;
        const point = unprojectLastLight(x + .5, y + .5, cameraDepth, CAMERA, BASIS), p = lastLightToNative(point);
        const n = lastLightToNative([normal!.data[i]! / 127.5 - 1, normal!.data[i + 1]! / 127.5 - 1, normal!.data[i + 2]! / 127.5 - 1]);
        offsets.push(j);
        pixels.push(p[0] * CAMERA.scale, p[1] * CAMERA.scale, p[2] * CAMERA.scale, ...n,
          albedo!.data[i]!, albedo!.data[i + 1]!, albedo!.data[i + 2]!, material!.data[i + 2]! / 255, material!.data[i + 3]! / 255 * 2);
      }
      const lamp = lastLightToNative(source.lampWorld ?? [0,0,0]);
      frames.push({ source, offsets: new Uint16Array(offsets), pixels: new Float32Array(pixels), depths,
        contact: contactPixels ? new ImageData(contactPixels, 64, 80) : null,
        lamp: [lamp[0] * CAMERA.scale, lamp[1] * CAMERA.scale, lamp[2] * CAMERA.scale],
        wrist: lastLightToNative(source.wristWorld), shoulder: lastLightToNative(source.shoulderWorld) });
    }
    return frames;
  };
  const [frames, bodyWithoutArm, attackArm] = await Promise.all([
    prepareGroup(variant.atlas, variant.frames, 832, 640),
    prepareGroup(manifest.bodyWithoutArm.atlas, variant.frames, 832, 640),
    prepareGroup(manifest.attackArm.atlas, manifest.attackArm.frames, 960, 640),
  ]);
  options.signal?.throwIfAborted();
  cachedAssets = { frames, bodyWithoutArm, attackArm, headings: frames.filter(frame => frame.source.pose === 'idle').map(frame => lastLightScreenHeading(frame.source.yaw)) };
  return cachedAssets;
}

interface PlayerPresentationSource {
  getPosition(): Readonly<{ x: number; y: number }>;
  getGroundY(): number;
  getFacingAngle(): number;
  isMoving(): boolean;
  getSprite(): { visible: boolean };
}
interface AssimilationFrameSurface {
  readonly pixels: Uint8Array;
  readonly normalX: number;
  readonly normalY: number;
}
let nextTextureId = 0;
export class LastLightPlayerPresentation implements PlayerExternalVisuals {
  private readonly image: Phaser.GameObjects.Image;
  private readonly contact: Phaser.GameObjects.Image;
  private readonly weapon: Phaser.GameObjects.Image;
  private readonly glove: Phaser.GameObjects.Image;
  private readonly gloveTexture: Phaser.Textures.CanvasTexture;
  private readonly gloveOutput = new ImageData(64, 80);
  private readonly composedDepth = new Float32Array(64 * 80);
  private readonly composedArm = new Uint8Array(64 * 80);
  private readonly bodyImages: readonly Phaser.GameObjects.Image[];
  private readonly boundsScratch = new Phaser.Geom.Rectangle();
  private readonly grip = { x: 0, y: 0, z: 0 };
  private quality: CrowbarQuality | null = null;
  private variant: CrowbarVariant = 'standard';
  private attackPose: Readonly<WeaponAttackPose> | null = null;
  private attackIndex = -1;
  private armOffsetX = 0;
  private armOffsetY = 0;
  private armDepthDelta = 0;
  private readonly armNativeDelta: [number, number, number] = [0, 0, 0];
  private groundDepth = 30;
  private weaponBehind = false;
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
  private readonly assimilationLook = new AssimilationLookParameters();
  private readonly assimilationMetrics = createAssimilationLookMetrics();
  private readonly assimilationSurfaces = new Map<PreparedFrame, AssimilationFrameSurface>();
  private readonly assimilationScratch = new Float32Array(5);
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
    const gloveTexture = scene.textures.createCanvas(`${key}-glove`, 64, 80);
    if (!gloveTexture) { scene.textures.remove(texture.key); scene.textures.remove(contactTexture.key); throw new Error('Cannot allocate Player A glove'); }
    this.gloveTexture = gloveTexture;
    this.texture = texture; this.contactTexture = contactTexture;
    this.contact = scene.add.image(0, 0, contactTexture.key).setOrigin(.5, 66 / 80);
    this.image = scene.add.image(0, 0, texture.key).setOrigin(.5, 66 / 80);
    this.weapon = scene.add.image(0, 0, texture.key).setOrigin(.5, .75).setScale(.68).setVisible(false);
    this.glove = scene.add.image(0, 0, gloveTexture.key).setOrigin(.5, 66 / 80).setVisible(false);
    this.bodyImages = [this.image, this.glove];
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
    this.image.setPosition(position.x, groundY); this.contact.setPosition(position.x, groundY); this.glove.setPosition(position.x, groundY);
    const sample = this.quality ? lastLightAttackSampleIndex(this.attackPose) : -1;
    this.attackIndex = sample < 0 ? -1 : row * 15 + sample;
    const arm = this.attackIndex < 0 ? null : this.assets.attackArm[this.attackIndex]!;
    let wrist = frame.source.wrist;
    this.armOffsetX = this.armOffsetY = this.armDepthDelta = 0; this.armNativeDelta.fill(0);
    if (arm) {
      this.armOffsetX = Math.round(frame.source.shoulder[0] - arm.source.shoulder[0]);
      this.armOffsetY = Math.round(frame.source.shoulder[1] - arm.source.shoulder[1]);
      this.armDepthDelta = frame.source.shoulder[2] - arm.source.shoulder[2];
      for (let i = 0; i < 3; i++) this.armNativeDelta[i] = (frame.shoulder[i]! - arm.shoulder[i]!) * CAMERA.scale;
      wrist = arm.source.wrist;
    }
    const nativeWrist = (arm ?? frame).wrist;
    this.grip.x = position.x + wrist[0] - 32 + this.armOffsetX;
    this.grip.y = groundY + wrist[1] - 66 + this.armOffsetY;
    this.grip.z = nativeWrist[2] * CAMERA.scale + this.armNativeDelta[2];
    const gx = Math.max(0,Math.min(63,Math.floor(wrist[0]+this.armOffsetX))), gy = Math.max(0,Math.min(79,Math.floor(wrist[1]+this.armOffsetY)));
    const body = arm ? this.assets.bodyWithoutArm[this.frameIndex]! : frame;
    this.weaponBehind = wrist[2] + this.armDepthDelta < body.depths[gy * 64 + gx]! - .03;
    this.weapon.setPosition(this.grip.x, this.grip.y).setRotation(this.assets.headings[row]! + (arm?.source.sweep ?? .55) + Math.PI / 2);
    this.weapon.setDepth(this.groundDepth + (this.weaponBehind ? .08 : .14));
    this.lamp.x = position.x + frame.lamp[0]; this.lamp.y = groundY + frame.lamp[1]; this.lamp.z = frame.lamp[2];
  }
  getLampPosition = (): Readonly<{ x: number; y: number; z: number }> => this.lamp;
  /** Explicit DEV opt-in. Preparation is bounded by the existing frame set. */
  setAssimilationLook(state: AssimilationLookState | null): void {
    if (!import.meta.env.DEV || this.destroyed) return;
    this.assimilationLook.set(state);
    if (!state || this.assimilationSurfaces.size) return;
    getAssimilationLookPalettes();
    const backLength = Math.hypot(BASIS.back[0], BASIS.back[2]);
    const backX = BASIS.back[0] / backLength, backZ = BASIS.back[2] / backLength;
    for (const frames of [this.assets.frames, this.assets.bodyWithoutArm]) for (const frame of frames) {
      const surface = new Uint8Array(frame.offsets.length * ASSIMILATION_SURFACE_STRIDE);
      const c = Math.cos(frame.source.yaw), s = Math.sin(frame.source.yaw), pixels = frame.pixels;
      const leftWrist = frame.source.pose === 'walk'
        ? lastLightWalkArm(false, Number(frame.source.phase) / (Math.PI * 2)).wrist
        : [-.312, .758, .083] as const;
      for (let i = 0; i < frame.offsets.length; i++) {
        const p = i * 11, nx = pixels[p]! / CAMERA.scale, ny = pixels[p + 1]! / CAMERA.scale;
        const worldX = nx * BASIS.right[0] + ny * backX, worldZ = nx * BASIS.right[2] + ny * backZ;
        const localX = worldX * c - worldZ * s, localY = pixels[p + 2]! / CAMERA.scale, localZ = worldX * s + worldZ * c;
        const leftHand = (localX - leftWrist[0]) ** 2 + (localY - leftWrist[1]) ** 2 + (localZ - leftWrist[2]) ** 2 < .13 ** 2;
        writeAssimilationSurface(localX, localY, localZ, Math.max(pixels[p + 6]!, pixels[p + 7]!, pixels[p + 8]!),
          pixels[p + 10]!, surface, i * ASSIMILATION_SURFACE_STRIDE,
          leftHand || frame.source.glovePixels.includes(frame.offsets[i]! / 4));
      }
      this.assimilationSurfaces.set(frame, {
        pixels: surface,
        normalX: c * BASIS.right[0] - s * BASIS.right[2],
        normalY: c * backX - s * backZ,
      });
      this.assimilationMetrics.maskBytes += surface.byteLength;
      this.assimilationMetrics.preparedFrames++;
    }
  }
  /** CPU render duration includes the original lighting and texture uploads. */
  getAssimilationLookMetrics(): Readonly<AssimilationLookMetrics> { return this.assimilationMetrics; }
  render(): void {
    if (this.destroyed) return;
    const measure = this.assimilationLook.enabled, start = measure ? performance.now() : 0;
    if (measure) this.assimilationMetrics.changedPixels = 0;
    const original = this.assets.frames[this.frameIndex]!;
    const arm = this.attackIndex < 0 ? null : this.assets.attackArm[this.attackIndex]!;
    const body = arm ? this.assets.bodyWithoutArm[this.frameIndex]! : original;
    this.output.data.fill(0); this.composedDepth.fill(-Infinity); this.composedArm.fill(0);
    this.drawFrame(body, 0, 0, 0, 0, 0, 0, false);
    if (arm) {
      this.drawFrame(arm, this.armOffsetX, this.armOffsetY,
        this.armNativeDelta[0], this.armNativeDelta[1], this.armNativeDelta[2], this.armDepthDelta, true);
    }
    this.texture.context.putImageData(this.output, 0, 0); this.texture.refresh();
    this.gloveOutput.data.fill(0);
    if (this.quality) {
      const source = arm ?? original;
      for (const i of source.source.glovePixels) {
        const x = i % 64 + (arm ? this.armOffsetX : 0), y = Math.floor(i / 64) + (arm ? this.armOffsetY : 0);
        if (x < 0 || x >= 64 || y < 0 || y >= 80) continue;
        const index = y*64+x;
        if (arm && !this.composedArm[index]) continue;
        for (let c=0;c<4;c++) this.gloveOutput.data[index*4+c]=this.output.data[index*4+c]!;
      }
    }
    this.gloveTexture.context.putImageData(this.gloveOutput,0,0); this.gloveTexture.refresh();
    if (this.previousContactFrame !== this.frameIndex && original.contact) {
      this.contactTexture.context.putImageData(original.contact, 0, 0); this.contactTexture.refresh();
      this.previousContactFrame = this.frameIndex;
    }
    this.rendered = true;
    if (measure) recordAssimilationLookTime(this.assimilationMetrics, start);
  }
  private drawFrame(frame:PreparedFrame, dx:number, dy:number, wx:number, wy:number, wz:number, depthDelta:number, arm:boolean):void {
    const pixels=frame.pixels,target=this.output.data;
    const look=this.assimilationLook;
    const surface=look.amount>0&&!arm?this.assimilationSurfaces.get(frame):undefined;
    for(let i=0;i<frame.offsets.length;i++) {
      const source=frame.offsets[i]!/4, x=source%64+dx,y=Math.floor(source/64)+dy;
      if(x<0||x>=64||y<0||y>=80)continue;
      const index=y*64+x,depth=frame.depths[source]!+depthDelta;
      if(depth<this.composedDepth[index]!)continue;
      this.composedDepth[index]=depth;this.composedArm[index]=arm?1:0;
      const p=i*11,out=index*4;
      let nx=pixels[p+3]!,ny=pixels[p+4]!,nz=pixels[p+5]!;
      if(surface){
        sampleAssimilationSurface(surface.pixels,i*ASSIMILATION_SURFACE_STRIDE,look,
          pixels[p+6]!,pixels[p+7]!,pixels[p+8]!,this.assimilationScratch);
        const relief=this.assimilationScratch[3]!;
        if(this.assimilationScratch[4]!>0){
          this.assimilationMetrics.changedPixels++;
          nx+=surface.normalX*relief;ny+=surface.normalY*relief;
          const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
        }
      }
      sampleWorldMaterialLight(this.lighting,this.image.x+pixels[p]!+wx,this.image.y+pixels[p+1]!+wy,pixels[p+2]!+wz,
        nx,ny,nz,true,this.light);
      const received=this.light[0]*.2126+this.light[1]*.7152+this.light[2]*.0722;
      const shadeGain=pixels[p+10]!>0?1:1+.28*Math.max(0,1-received/.8);
      for(let c=0;c<3;c++)target[out+c]=(surface?this.assimilationScratch[c]!:pixels[p+6+c]!)*(this.light[c]!*shadeGain*pixels[p+9]!+pixels[p+10]!);
      target[out+3]=255;
    }
  }
  setWeaponVisual(quality:CrowbarQuality|null,variant:CrowbarVariant='standard'):void {
    if(this.destroyed)return;
    this.quality=quality;this.variant=variant;
    this.weapon.setVisible(quality!==null);this.glove.setVisible(quality!==null);
    if(!quality){this.attackIndex=-1;return;}
    const key=`crowbar-held-${quality}-${variant}`;
    if(!this.scene.textures.exists(key)) {
      const pixels=renderCrowbarPixels(quality,variant,'world'),texture=this.scene.textures.createCanvas(key,32,32);
      if(!texture)throw new Error(`Cannot allocate ${key}`);
      const data=texture.context.createImageData(32,32);data.data.set(pixels.data);
      texture.context.putImageData(data,0,0);texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.weapon.setTexture(key);
  }
  setWeaponAttackPose(pose:Readonly<WeaponAttackPose>):void { this.attackPose=pose; }
  getHitFlashImages():readonly Phaser.GameObjects.Image[] { return this.bodyImages; }
  getVisualBounds(out:Phaser.Geom.Rectangle):Phaser.Geom.Rectangle {
    this.image.getBounds(out);
    if(this.weapon.visible){this.weapon.getBounds(this.boundsScratch);Phaser.Geom.Rectangle.Union(out,this.boundsScratch,out);}
    return out;
  }
  /** The body is already lit in world space. Ground fog must not be applied
   * again at the projected head pixel. Only its opaque, solid-masked footprint
   * is erased; contact, terrain visibility and ground queries stay unchanged. */
  revealBody(visibility: { revealProjectedTerrain(image: Phaser.GameObjects.Image, strength: number): void }): void {
    if (this.rendered && !this.destroyed) { visibility.revealProjectedTerrain(this.image, 1); if(this.weapon.visible)visibility.revealProjectedTerrain(this.weapon,1); }
  }
  setGroundDepth(depth: number, floorDepth: number): void { this.groundDepth=depth;this.image.setDepth(depth + .1);this.glove.setDepth(depth+.15);this.weapon.setDepth(depth+(this.weaponBehind ? .08 : .14)); this.contact.setDepth(floorDepth); }
  getProbe(): Record<string, unknown> {
    const frame = this.assets.frames[this.frameIndex]!;
    return { ready: this.rendered && !this.destroyed, model: 'a', frame: frame.source.key, frameIndex: this.frameIndex,
      yaw: frame.source.yaw, pose: frame.source.pose, foot: { x: this.image.x, y: this.image.y, anchor: [32, 66] },
      lamp: { ...this.lamp }, oldBodyVisible: this.player.getSprite().visible, nativeScale: this.image.scaleX,
      weapon:{quality:this.quality,variant:this.variant,visible:this.weapon.visible,behind:this.weaponBehind},attackPhase:this.attackPose?.phase??'idle',attackFrame:this.attackIndex,gripAnchor:{...this.grip},hitFlash:this.image.tintFill,
      nativeLights: this.lighting.lights.length, masked: !!this.image.mask, contactMasked: !!this.contact.mask };
  }
  destroy(): void {
    if (this.destroyed) return; this.destroyed = true;
    this.image.destroy(); this.contact.destroy();this.weapon.destroy();this.glove.destroy();
    this.scene.textures.remove(this.gloveTexture.key);
    this.scene.textures.remove(this.texture.key); this.scene.textures.remove(this.contactTexture.key);
    this.assimilationSurfaces.clear();
    this.assimilationMetrics.maskBytes = 0;
  }
}
