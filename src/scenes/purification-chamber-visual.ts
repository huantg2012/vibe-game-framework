import Phaser from 'phaser';
import { ChamberDeviceActivity } from './chamber-device-activity';
import { CHAMBER_MODULE_BOUNDS } from '../ui/chamber-integrity-placement';
import { ChamberSurfaceMap } from '../art/chamber-surface-map';
import { ChamberExteriorAtmosphere } from './chamber-exterior-atmosphere';
import { CHAMBER_EXTERIOR_LAYERS, paintChamberExteriorLayer } from '../art/chamber-exterior-pixels';
import { MATERIAL } from '../../assets/source/purification-r9/environment';
import { ChamberExteriorMotion, chamberNearParallaxWeight, CHAMBER_EXTERIOR_REFERENCE,
  type ChamberExteriorLayer, type ChamberDistantPresence } from './chamber-exterior-motion';
import { PurificationChamberLighting } from './purification-chamber-lighting';
import {
  CHAMBER_DEVICE_ANCHORS,
  CHAMBER_DEVICE_BASES,
  CHAMBER_CONTACTS,
  CHAMBER_SIZE,
  type ChamberDevice,
} from '@/systems/purification-chamber-layout';
import {
  ChamberPixels,
  paintChamberArchitecture,
  paintChamberDevice,
  paintChamberForeground,
  paintChamberGrounding,
  paintChamberResistance,
  type ChamberDeviceState,
} from '../art/purification-chamber-pixels';

export interface PurificationChamberState {
  /** Public operating efficacy, normalized min(hp / 100, 1). Capacity is separate. No forecast is accepted here. */
  moduleHealth: { core: number; storage: number; purifier: number };
  thickenLevel: number;
  offeringCharge: number;
  growthLevels: Readonly<Record<string, number>>;
  activeTarget: string | null;
  /** Actor image centre. The foot is ten world pixels below this point. */
  player: { x: number; y: number };
  lamp: { x: number; y: number };
}

type PulseKind = 'repair' | 'growth' | 'offering' | 'offering-complete';
interface DeviceLayer {
  readonly id: ChamberDevice;
  readonly texture: Phaser.Textures.CanvasTexture;
  readonly painter: ChamberPixels;
  readonly activity: Phaser.GameObjects.Graphics;
  readonly image: Phaser.GameObjects.Image;
  /** Actual painted bounds relative to the foot; the texture itself is world-sized. */
  readonly bounds: readonly [left: number, top: number, right: number, bottom: number];
  opacity: number;
  key: number;
}
export interface ChamberExteriorState {
  elapsedMs: number;
  reducedMotion: boolean;
  reference: { x: number; y: number };
  observer: { x: number; y: number };
  layers: { id: ChamberExteriorLayer; depth: number; parallaxWeight: number;
    offset: { x: number; y: number }; renderedOffset: { x: number; y: number } }[];
  anchors: { id: string; x: number; y: number; weight: number; offset: { x: number; y: number } }[];
  presence: ChamberDistantPresence & { visible: boolean; depth: number };
  clip: { x: number; y: number; width: number; height: number; worldSpace: true; maskedPlates: number };
  resources: { textures: number; plates: number; nearVertices: number; atmosphereTextures: number; geometryMasks: number };
}
const DEVICE_IDS: readonly ChamberDevice[] = ['rift', 'growth', 'offering', 'purifier', 'storage', 'core'];
const MODULE_IDS = ['core', 'storage', 'purifier'] as const;
const EXTERIOR_PADDING = 32;
const EXTERIOR_TEXTURE_WIDTH = CHAMBER_SIZE.width + EXTERIOR_PADDING * 2;
const EXTERIOR_TEXTURE_HEIGHT = CHAMBER_SIZE.height + EXTERIOR_PADDING * 2;
export const CHAMBER_DEVICE_VISUAL_BOUNDS: Readonly<Record<ChamberDevice, readonly [number, number, number, number]>> = {
  core: CHAMBER_MODULE_BOUNDS.CORE, storage: CHAMBER_MODULE_BOUNDS.STORAGE,
  purifier: CHAMBER_MODULE_BOUNDS.PURIFIER, growth: [-20, -57, 22, 3],
  offering: [-21, -45, 27, 3], rift: [-26, -17, 26, 13],
};
let chamberId = 0;

/**
 * One material texture and one tiny live layer per device: a player can circle either side.
 * Structure is cached by public state; only captive matter is redrawn at 12 Hz.
 */
export class PurificationChamberVisual {
  private readonly textures: string[] = [];
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly devices: DeviceLayer[] = [];
  private readonly exteriorLayers: { id: ChamberExteriorLayer; image: Phaser.GameObjects.Image; parallaxWeight: number }[] = [];
  private readonly exteriorMotion = new ChamberExteriorMotion();
  private readonly exteriorNearMesh: Phaser.GameObjects.Mesh;
  private readonly exteriorNearWeights: Float32Array;
  private readonly exteriorVoid: Phaser.GameObjects.Rectangle;
  private readonly exteriorClipGraphics: Phaser.GameObjects.Graphics;
  private readonly exteriorClipMask: Phaser.Display.Masks.GeometryMask;
  private readonly architectureSurfaces = new ChamberSurfaceMap();
  /** All six state bakes share one scratch atlas; compiled light spans own no atlas references. */
  private readonly deviceSurfaces = new ChamberSurfaceMap();
  private readonly groundEffects: Phaser.GameObjects.Graphics;
  private readonly bodyEffects: Phaser.GameObjects.Graphics;
  private readonly boundaryEffects: Phaser.GameObjects.Graphics;
  private readonly activity: ChamberDeviceActivity;
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly lighting: PurificationChamberLighting;
  private readonly exteriorAtmosphere: ChamberExteriorAtmosphere;
  private readonly resistanceTexture: Phaser.Textures.CanvasTexture;
  private readonly resistancePainter: ChamberPixels;
  private resistanceKey = -1;
  private readonly deviceState: ChamberDeviceState = {
    core: 1, storage: 1, purifier: 1, thickenLevel: 0, growthLevels: 0,
  };
  private lastFrame = -1;
  private pulseStart = -10000;
  private pulseKind: PulseKind = 'repair';
  private pulseTarget = 'core';
  private time = 0;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {
    const id = ++chamberId;
    // A stationary, overdrawn void prevents a shifted far plate exposing the
    // canvas colour at any of the four edges (including interaction zooms).
    this.exteriorVoid = scene.add.rectangle(320, 200, 1280, 800,
      Number.parseInt(MATERIAL.void.slice(1), 16)).setDepth(-61).setName('chamber-exterior-void');
    // Overscan only supplies pixels inside the original authored frame. The
    // shared world-space stencil follows camera focus/zoom, never the plates'
    // parallax, and never exposes the extruded texels beyond the frame.
    this.exteriorClipGraphics = scene.make.graphics({ x: 0, y: 0 }, false)
      .setName('chamber-exterior-authored-clip').fillStyle(0xffffff)
      .fillRect(0, 0, CHAMBER_SIZE.width, CHAMBER_SIZE.height);
    this.exteriorClipMask = this.exteriorClipGraphics.createGeometryMask();
    const shellSurfaces = new ChamberSurfaceMap();
    let nearAlbedo!: Uint8ClampedArray;
    let nearTexture!: Phaser.Textures.CanvasTexture;
    for (const layer of CHAMBER_EXTERIOR_LAYERS) {
      shellSurfaces.clear();
      const texture = this.addCanvas(`purification-chamber-exterior-${layer.id}-${id}`, layer.depth);
      paintChamberExteriorLayer(new ChamberPixels(texture.context, shellSurfaces), layer.id);
      const albedo = shellSurfaces.bake(texture.context);
      this.extendExteriorEdges(texture);
      texture.refresh();
      const image = this.images[this.images.length - 1]!.setName(`chamber-exterior-${layer.id}`)
        .setPosition(-EXTERIOR_PADDING, -EXTERIOR_PADDING).setMask(this.exteriorClipMask);
      this.exteriorLayers.push({ id: layer.id, image, parallaxWeight: layer.parallaxWeight });
      if (layer.id === 'near') {
        nearAlbedo = albedo;
        nearTexture = texture;
        image.setVisible(false);
      }
    }
    this.exteriorNearMesh = this.createNearExteriorMesh(nearTexture.key).setMask(this.exteriorClipMask);
    this.exteriorNearWeights = Float32Array.from(this.exteriorNearMesh.vertices,
      vertex => chamberNearParallaxWeight(vertex.u * EXTERIOR_TEXTURE_WIDTH - EXTERIOR_PADDING,
        vertex.v * EXTERIOR_TEXTURE_HEIGHT - EXTERIOR_PADDING));
    this.exteriorAtmosphere = new ChamberExteriorAtmosphere(scene, nearAlbedo, shellSurfaces);
    const architecture = this.addCanvas(`purification-chamber-architecture-${id}`, 10);
    paintChamberArchitecture(new ChamberPixels(architecture.context, this.architectureSurfaces));
    const architectureAlbedo = this.architectureSurfaces.bake(architecture.context);
    architecture.refresh();
    this.lighting = new PurificationChamberLighting(scene, architectureAlbedo, this.architectureSurfaces);
    this.addCanvas(`purification-chamber-grounding-${id}`, 12, paintChamberGrounding);
    this.resistanceTexture = this.addCanvas(`purification-chamber-resistance-${id}`, 14);
    this.resistancePainter = new ChamberPixels(this.resistanceTexture.context);
    this.groundEffects = scene.add.graphics().setDepth(16);
    this.boundaryEffects = scene.add.graphics().setDepth(17);
    for (const device of DEVICE_IDS) {
      const base = CHAMBER_DEVICE_BASES[device];
      const depth = device === 'rift' ? 18 : 100 + base.y;
      const texture = this.addCanvas(`purification-chamber-${device}-${id}`, depth);
      this.devices.push({
        id: device, texture, painter: new ChamberPixels(texture.context, this.deviceSurfaces), key: -1,
        activity: scene.add.graphics().setDepth(depth + .2),
        image: this.images[this.images.length - 1]!, bounds: CHAMBER_DEVICE_VISUAL_BOUNDS[device], opacity: 1,
      });
    }
    this.activity = new ChamberDeviceActivity(scene);
    shellSurfaces.clear();
    this.addCanvas(`purification-chamber-front-cut-${id}`, 460, paintChamberForeground, shellSurfaces);
    this.bodyEffects = scene.add.graphics().setDepth(410);
  }

  /** Creation-only edge extrusion preserves the scale and continuation of all
   * authored off-screen masses as the viewpoint changes. Transparent intervals
   * stay transparent; no world-coloured rectangular plate becomes visible. */
  private extendExteriorEdges(texture: Phaser.Textures.CanvasTexture): void {
    const p = EXTERIOR_PADDING, width = CHAMBER_SIZE.width, height = CHAMBER_SIZE.height;
    const source = texture.context.getImageData(0, 0, width, height);
    texture.setSize(EXTERIOR_TEXTURE_WIDTH, EXTERIOR_TEXTURE_HEIGHT);
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(source, p, p);
    ctx.drawImage(ctx.canvas, p, p, width, 1, p, 0, width, p);
    ctx.drawImage(ctx.canvas, p, p + height - 1, width, 1, p, p + height, width, p);
    ctx.drawImage(ctx.canvas, p, 0, 1, EXTERIOR_TEXTURE_HEIGHT, 0, 0, p, EXTERIOR_TEXTURE_HEIGHT);
    ctx.drawImage(ctx.canvas, p + width - 1, 0, 1, EXTERIOR_TEXTURE_HEIGHT,
      p + width, 0, p, EXTERIOR_TEXTURE_HEIGHT);
  }

  private createNearExteriorMesh(textureKey: string): Phaser.GameObjects.Mesh {
    const width = EXTERIOR_TEXTURE_WIDTH, height = EXTERIOR_TEXTURE_HEIGHT;
    const columns = width / 16, rows = height / 16;
    const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        const u = column / columns, v = row / rows;
        vertices.push((u - .5) * width, (.5 - v) * height);
        uvs.push(u, v);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column, b = a + columns + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const mesh = this.scene.add.mesh(CHAMBER_SIZE.width / 2, CHAMBER_SIZE.height / 2, textureKey)
      .setName('chamber-exterior-near-projection').setDepth(-50);
    mesh.addVertices(vertices, uvs, indices);
    mesh.hideCCW = false;
    mesh.setOrtho(mesh.width, mesh.height);
    mesh.ignoreDirtyCache = true;
    return mesh;
  }

  private addCanvas(key: string, depth: number, paint?: (pixels: ChamberPixels) => void,
    surfaces?: ChamberSurfaceMap): Phaser.Textures.CanvasTexture {
    const texture = this.scene.textures.createCanvas(key, CHAMBER_SIZE.width, CHAMBER_SIZE.height);
    if (!texture) throw new Error(`Unable to allocate purification chamber texture: ${key}`);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (paint) {
      paint(new ChamberPixels(texture.context, surfaces));
      surfaces?.bake(texture.context);
    }
    texture.refresh();
    this.textures.push(key);
    this.images.push(this.scene.add.image(0, 0, key).setOrigin(0).setDepth(depth));
    return texture;
  }

  update(timeMs: number, deltaMs: number, state: PurificationChamberState): void {
    if (this.destroyed) return;
    // Visual time advances only with this active scene; pause/resume never jumps a pose.
    this.time += Math.max(0, Math.min(100, deltaMs));
    timeMs = this.time;
    this.exteriorMotion.update(deltaMs, state.player.x, state.player.y, this.motionQuery.matches);
    for (const layer of this.exteriorLayers) {
      const offset = this.exteriorMotion.offsets[layer.id];
      if (layer.id !== 'near') layer.image.setPosition(Math.round(offset.x) - EXTERIOR_PADDING,
        Math.round(offset.y) - EXTERIOR_PADDING);
    }
    const nearOffset = this.exteriorMotion.offsets.near;
    for (let i = 0; i < this.exteriorNearMesh.vertices.length; i++) {
      const vertex = this.exteriorNearMesh.vertices[i]!;
      const weight = this.exteriorNearWeights[i]!;
      vertex.x = (vertex.u - .5) * EXTERIOR_TEXTURE_WIDTH + nearOffset.x * weight;
      vertex.y = (.5 - vertex.v) * EXTERIOR_TEXTURE_HEIGHT - nearOffset.y * weight;
    }
    this.exteriorAtmosphere.update(timeMs, this.motionQuery.matches, this.exteriorMotion.offsets.far);
    const health = state.moduleHealth;
    let growth = 0;
    for (const id in state.growthLevels) growth += state.growthLevels[id] ?? 0;
    const core = healthTier(health.core);
    const storage = healthTier(health.storage);
    const purifier = healthTier(health.purifier);
    const resistanceKey = core + storage * 3 + purifier * 9;
    // Nothing is allocated on ordinary motion/animation frames. State uploads are rare.
    this.deviceState.core = health.core;
    this.deviceState.storage = health.storage;
    this.deviceState.purifier = health.purifier;
    this.deviceState.thickenLevel = state.thickenLevel;
    this.deviceState.growthLevels = growth;
    if (this.resistanceKey !== resistanceKey) {
      this.resistanceKey = resistanceKey;
      this.resistanceTexture.context.clearRect(0, 0, CHAMBER_SIZE.width, CHAMBER_SIZE.height);
      paintChamberResistance(this.resistancePainter, this.deviceState);
      this.resistanceTexture.refresh();
    }
    for (const device of this.devices) {
      this.updateOcclusion(device, state.player, deltaMs);
      let key = 0;
      if (device.id === 'core' || device.id === 'storage' || device.id === 'purifier') {
        key = healthTier(health[device.id]) + Math.min(3, state.thickenLevel) * 3;
      } else if (device.id === 'growth') {
        key = Number(growth > 0) + Number(growth >= 5) * 2 + Number(growth >= 12) * 4;
      }
      if (device.key === key) continue;
      device.key = key;
      device.texture.context.clearRect(0, 0, CHAMBER_SIZE.width, CHAMBER_SIZE.height);
      this.deviceSurfaces.clear();
      paintChamberDevice(device.painter, device.id, this.deviceState);
      const albedo = this.deviceSurfaces.bake(device.texture.context);
      device.texture.refresh();
      this.lighting.syncDevice(device.id, albedo, device.image.depth, this.deviceSurfaces);
    }
    const frame = Math.floor(timeMs / 80);
    // The body attachment follows every player step even between animation ticks.
    this.bodyEffects.setPosition(Math.round(state.player.x), Math.round(state.player.y));
    this.bodyEffects.setDepth(110 + state.player.y + .5);
    this.activity.update(timeMs, { ...state.moduleHealth, offeringOccupancy: state.offeringCharge }, this.motionQuery.matches);
    this.lighting.update(timeMs, state, this.motionQuery.matches);
    if (this.lastFrame === frame) return;
    this.lastFrame = frame;
    this.paintActivity(timeMs, state);
  }

  private updateOcclusion(device: DeviceLayer, player: { x: number; y: number }, deltaMs: number): void {
    if (device.id === 'rift') return;
    const base = CHAMBER_DEVICE_BASES[device.id];
    const bounds = device.bounds;
    const feet = player.y + 10;
    // Test the dense character's body against this device, never the full canvas extent.
    const behind = feet < base.y - 1;
    const overlaps = player.x + 11 > base.x + bounds[0] && player.x - 11 < base.x + bounds[2]
      && player.y + 8 > base.y + bounds[1] && player.y - 15 < base.y + bounds[3];
    const target = behind && overlaps ? .44 : 1;
    const step = Math.min(50, Math.max(0, deltaMs)) * .56 / 80;
    device.opacity += Math.max(-step, Math.min(step, target - device.opacity));
    device.image.setAlpha(device.opacity);
    device.activity.setAlpha(device.opacity);
    this.activity.setOpacity(device.id, device.opacity);
    this.lighting.setDeviceOpacity(device.id, device.opacity);
  }

  private paintActivity(time: number, state: PurificationChamberState): void {
    const motionTime = this.motionQuery.matches ? 0 : time;
    const breath = .5 + .5 * Math.sin(motionTime * .0014);
    const elapsed = time - this.pulseStart;
    const pulsing = elapsed >= 0 && elapsed < 1000;
    const envelope = pulsing ? Math.sin(Math.PI * elapsed / 1000) : 0;
    const active = normalizeTarget(state.activeTarget);
    const ground = this.groundEffects;
    ground.clear(); this.bodyEffects.clear(); this.boundaryEffects.clear();
    for (const device of this.devices) {
      const g = device.activity;
      g.clear();
      const { x, y } = CHAMBER_DEVICE_BASES[device.id];
      if (active === device.id) {
        // Two short scuffed contact marks on the actual operator position, below the actor.
        const at = CHAMBER_DEVICE_ANCHORS[device.id];
        ground.fillStyle(0x8a8f96, .45);
        ground.fillRect(Math.round(at.x) - 10, Math.round(at.y) + 1, 4, 1);
        ground.fillRect(Math.round(at.x) + 6, Math.round(at.y) + 1, 4, 1);
      }
      if (!pulsing || (this.pulseTarget !== device.id && this.pulseTarget !== 'thicken')) continue;
      if (this.pulseTarget === 'thicken' && !MODULE_IDS.includes(device.id as typeof MODULE_IDS[number])) continue;
      // Material response at real clamps, not a floating horizontal scan line.
      g.fillStyle(this.pulseKind === 'offering' ? 0x1aad96 : 0x8a8f96, envelope * .62);
      const halfWidth = device.id === 'purifier' ? 22 : 16;
      g.fillRect(x - halfWidth, y - 7, 3, 3);
      g.fillRect(x + halfWidth - 2, y - 5, 3, 2);
      if (device.id === 'core') g.fillRect(x - 2, y - 25, 3, 3);
      ground.fillStyle(0x8a8f96, envelope * .09);
      ground.fillEllipse(x, y, halfWidth * 2 + 14, 9);
    }
    // Light stays in the existing material split. Damage changes how far the active seam escapes.
    this.paintPressure(CHAMBER_CONTACTS.west.x, CHAMBER_CONTACTS.west.y, state.moduleHealth.storage, 1, breath);
    this.paintPressure(CHAMBER_CONTACTS.rear.x, CHAMBER_CONTACTS.rear.y, state.moduleHealth.core, 0, .5 + .5 * Math.sin(motionTime * .0011 + 1.7));
    this.paintPressure(CHAMBER_CONTACTS.east.x, CHAMBER_CONTACTS.east.y, state.moduleHealth.purifier, -1, .5 + .5 * Math.sin(motionTime * .0013 + 3.1));
    if (pulsing && this.pulseTarget === 'player') {
      this.bodyEffects.fillStyle(0xc8cdd4, envelope * .45);
      this.bodyEffects.fillRect(-3, -7, 2, 3);
      this.bodyEffects.fillRect(4, -2, 1, 3);
      ground.fillStyle(0x8a8f96, envelope * .18);
      ground.fillEllipse(state.player.x, state.player.y + 10, 18, 4);
    }
  }

  private paintPressure(x: number, y: number, health: number, direction: -1 | 0 | 1, phase: number): void {
    const g = this.boundaryEffects;
    g.fillStyle(0x1a6b5c, .22 + phase * .24);
    g.fillRect(x - 1, y - 15, 2, 4);
    if (health >= 1) return;
    g.fillStyle(0x1aad96, .11 + phase * .16);
    if (direction === 0) {
      g.fillRect(x, y - 2, 1, 3);
      if (health < .25) g.fillRect(x + 2, y + 10, 1, 3);
    } else {
      const reach = direction * (health < .25 ? 13 : 8);
      g.fillRect(x + Math.round(reach * .5), y - 1, 2, 1);
      if (health < .25) g.fillRect(x + reach + direction * 3, y + 4, 1, 2);
    }
  }

  syncPlayerLight(player: Readonly<{ x: number; y: number }>, lamp: Readonly<{ x: number; y: number }>): void {
    if (!this.destroyed) this.lighting.syncPlayer(player, lamp);
  }

  /** Read-only diagnostics. Normal frames never allocate this snapshot. */
  getExteriorState(): ChamberExteriorState {
    return {
      elapsedMs: this.time, reducedMotion: this.motionQuery.matches,
      reference: { ...CHAMBER_EXTERIOR_REFERENCE }, observer: { ...this.exteriorMotion.observer },
      layers: this.exteriorLayers.map(layer => ({ id: layer.id, depth: layer.image.depth,
        parallaxWeight: layer.parallaxWeight, offset: { ...this.exteriorMotion.offsets[layer.id] },
        renderedOffset: layer.id === 'near' ? { ...this.exteriorMotion.offsets.near }
          : { x: layer.image.x + EXTERIOR_PADDING, y: layer.image.y + EXTERIOR_PADDING } })),
      anchors: (['rear', 'east'] as const).map(id => {
        const root = CHAMBER_CONTACTS[id];
        const weight = chamberNearParallaxWeight(root.x, root.y);
        const offset = { x: this.exteriorMotion.offsets.near.x * weight,
          y: this.exteriorMotion.offsets.near.y * weight };
        return { id, x: root.x + offset.x, y: root.y + offset.y, weight, offset };
      }),
      presence: this.exteriorAtmosphere.getPresenceState(),
      clip: { x: this.exteriorClipGraphics.x, y: this.exteriorClipGraphics.y,
        width: CHAMBER_SIZE.width, height: CHAMBER_SIZE.height, worldSpace: true,
        maskedPlates: this.destroyed ? 0 : this.exteriorLayers.reduce((count, layer) =>
          count + Number(layer.id === 'near' ? this.exteriorNearMesh.mask === this.exteriorClipMask
            : layer.image.mask === this.exteriorClipMask), 0) },
      resources: { textures: this.destroyed ? 0 : this.textures.length,
        plates: this.destroyed ? 0 : this.exteriorLayers.length,
        nearVertices: this.destroyed ? 0 : this.exteriorNearMesh.vertices.length,
        atmosphereTextures: this.destroyed ? 0 : 1, geometryMasks: this.destroyed ? 0 : 1 },
    };
  }

  pulse(kind: PulseKind, target?: string): void {
    if (this.destroyed) return;
    this.pulseKind = kind;
    this.pulseStart = this.time;
    this.pulseTarget = normalizeTarget(target) ?? (kind === 'repair' ? 'core' : kind);
    this.activity.pulse(kind, this.pulseTarget);
    this.lighting.pulse(kind === 'growth' ? 'growth' : this.pulseTarget, this.time);
    this.lastFrame = -1;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.groundEffects.destroy(); this.bodyEffects.destroy(); this.boundaryEffects.destroy();
    this.lighting.destroy();
    this.activity.destroy();
    this.exteriorAtmosphere.destroy();
    // This mask is shared: borrowers must detach before its single owner frees
    // the stencil and the Graphics object (which is not on the display list).
    for (const layer of this.exteriorLayers) layer.image.clearMask();
    this.exteriorNearMesh.clearMask().destroy();
    this.exteriorClipMask.destroy();
    this.exteriorClipGraphics.destroy();
    this.exteriorVoid.destroy();
    for (const device of this.devices) device.activity.destroy();
    for (const image of this.images) image.destroy();
    for (const key of this.textures) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.devices.length = 0; this.images.length = 0; this.textures.length = 0;
  }
}

function healthTier(health: number): number {
  if (health < .25) return 2;
  if (health < 1) return 1;
  return 0;
}
function normalizeTarget(target?: string | null): string | null {
  if (!target) return null;
  const id = target.toLowerCase();
  if (id === 'defense') return 'offering';
  if (id === 'entrance') return 'rift';
  return id;
}
