import Phaser from 'phaser';
import { ChamberPixels } from '../art/purification-chamber-pixels';
import {
  DEVICE_ACTIVITY_ATLASES, paintDeviceActivityFrame, sampleDeviceActivityFrame,
  type ChamberActivityKind, type ChamberActivityState,
} from '../art/chamber-device-motion';
import { CHAMBER_DEVICE_BASES, type ChamberDevice } from '../systems/purification-chamber-layout';

const DEVICE_IDS: readonly ChamberDevice[] = ['rift', 'growth', 'offering', 'purifier', 'storage', 'core'];
const healthTier = (health: number): number => health >= 1 ? 2 : health >= .25 ? 1 : 0;
interface ActivityLayer {
  id: ChamberDevice;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  painter: ChamberPixels;
  key: number;
  frame: number;
  pulseStart: number;
  completion: boolean;
}
let instance = 0;

/** Cropped cached atlases. Ordinary updates only select UVs; no animated canvas uploads. */
export class ChamberDeviceActivity {
  private readonly layers: ActivityLayer[] = [];
  private readonly byId = new Map<ChamberDevice, ActivityLayer>();
  private timeMs = 0;
  private destroyed = false;
  private rebuilds = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const serial = ++instance;
    for (const id of DEVICE_IDS) {
      const spec = DEVICE_ACTIVITY_ATLASES[id];
      const columns = 8;
      const rows = Math.ceil(spec.frames / columns);
      const key = `chamber-activity-${serial}-${id}`;
      const texture = scene.textures.createCanvas(key, spec.width * columns, spec.height * rows);
      if (!texture) throw new Error(`Cannot allocate ${key}`);
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (let frame = 0; frame < spec.frames; frame++) {
        texture.add(frame, 0, frame % columns * spec.width, Math.floor(frame / columns) * spec.height,
          spec.width, spec.height);
      }
      const base = CHAMBER_DEVICE_BASES[id];
      const depth = id === 'rift' ? 18 : 100 + base.y;
      const image = scene.add.image(base.x - spec.originX, base.y - spec.originY, key, 0)
        .setOrigin(0).setDepth(depth + .12);
      const layer: ActivityLayer = {
        id, texture, image, painter: new ChamberPixels(texture.context), key: -1, frame: -1,
        pulseStart: -Infinity, completion: false,
      };
      this.layers.push(layer);
      this.byId.set(id, layer);
    }
  }

  update(timeMs: number, state: ChamberActivityState, reducedMotion = false): void {
    if (this.destroyed) return;
    this.timeMs = timeMs;
    for (const layer of this.layers) {
      const id = layer.id;
      const health = id === 'core' || id === 'storage' || id === 'purifier' ? state[id] : 1;
      const occupied = id === 'offering' && state.offeringOccupancy > 0;
      const key = healthTier(health) + (occupied ? 3 : 0);
      if (key !== layer.key) {
        this.rebuild(layer, healthTier(health), occupied);
        layer.key = key;
      }
      const pulseAge = timeMs - layer.pulseStart;
      const frame = id === 'offering' && layer.completion && !reducedMotion && pulseAge >= 0 && pulseAge < 1440
        ? 24 + Math.min(7, Math.floor(pulseAge / 180))
        : sampleDeviceActivityFrame(id, timeMs, health, reducedMotion, pulseAge);
      if (frame !== layer.frame) {
        layer.image.setFrame(frame);
        layer.frame = frame;
      }
    }
  }

  private rebuild(layer: ActivityLayer, tier: number, occupied: boolean): void {
    const spec = DEVICE_ACTIVITY_ATLASES[layer.id];
    const p = layer.painter;
    const health = tier === 2 ? 1 : tier === 1 ? .5 : 0;
    layer.texture.context.clearRect(0, 0, layer.texture.width, layer.texture.height);
    for (let frame = 0; frame < spec.frames; frame++) {
      const x = frame % 8 * spec.width + spec.originX;
      const y = Math.floor(frame / 8) * spec.height + spec.originY;
      p.translate(x, y);
      paintDeviceActivityFrame(p, layer.id, frame, health, occupied);
      p.translate(-x, -y);
    }
    layer.texture.refresh();
    this.rebuilds++;
  }

  /** Call only after an existing operation reports success. New pulses replace rather than queue. */
  pulse(kind: ChamberActivityKind, target?: string): void {
    if (this.destroyed) return;
    const normalized = target?.toLowerCase();
    const id: ChamberDevice = kind === 'growth' ? 'growth' : (kind === 'offering' || kind === 'offering-complete') ? 'offering'
      : normalized === 'storage' ? 'storage' : normalized === 'purifier' ? 'purifier' : 'core';
    const layer = this.byId.get(id)!;
    layer.pulseStart = this.timeMs;
    layer.completion = kind === 'offering-complete';
  }

  setOpacity(id: ChamberDevice, opacity: number): void {
    if (!this.destroyed) this.byId.get(id)!.image.setAlpha(opacity);
  }

  /** Observability for runtime allocation/re-entry checks; no gameplay state is exposed. */
  getStats(): { textures: number; pixels: number; rebuilds: number } {
    return {
      textures: this.destroyed ? 0 : this.layers.length,
      pixels: this.destroyed ? 0 : this.layers.reduce((sum, layer) =>
        sum + layer.texture.width * layer.texture.height, 0),
      rebuilds: this.rebuilds,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const layer of this.layers) {
      layer.image.destroy();
      this.scene.textures.remove(layer.texture.key);
    }
    this.layers.length = 0;
    this.byId.clear();
  }
}
