import Phaser from 'phaser';
import { ChamberFloorLight } from '../art/chamber-floor-light';
import {
  CHAMBER_DEVICE_ANCHORS,
  CHAMBER_DEVICE_BASES,
  CHAMBER_SIZE,
  type ChamberDevice,
} from '@/systems/purification-chamber-layout';
import {
  ChamberPixels,
  paintChamberArchitecture,
  paintChamberDevice,
  paintChamberExterior,
  paintChamberForeground,
  paintChamberGrounding,
  paintChamberResistance,
  type ChamberDeviceState,
} from '../art/purification-chamber-pixels';

export interface PurificationChamberState {
  /** Actual public integrity, normalized hp / maxHp. No forecast is accepted here. */
  moduleHealth: { core: number; storage: number; purifier: number };
  thickenLevel: number;
  offeringCharge: number;
  growthLevels: Readonly<Record<string, number>>;
  activeTarget: string | null;
  /** Actor image centre. The foot is ten world pixels below this point. */
  player: { x: number; y: number };
}

type PulseKind = 'repair' | 'growth' | 'offering';
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
const DEVICE_IDS: readonly ChamberDevice[] = ['rift', 'growth', 'offering', 'purifier', 'storage', 'core'];
const MODULE_IDS = ['core', 'storage', 'purifier'] as const;
const DEVICE_BOUNDS: Readonly<Record<ChamberDevice, readonly [number, number, number, number]>> = {
  core: [-25, -63, 26, 3], storage: [-22, -42, 23, 3],
  purifier: [-29, -41, 31, 3], growth: [-20, -57, 22, 3],
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
  private readonly groundEffects: Phaser.GameObjects.Graphics;
  private readonly bodyEffects: Phaser.GameObjects.Graphics;
  private readonly boundaryEffects: Phaser.GameObjects.Graphics;
  private readonly floorLight = new ChamberFloorLight();
  private readonly coreReflection = this.floorLight.compile(
    CHAMBER_DEVICE_BASES.core.x, CHAMBER_DEVICE_BASES.core.y + 5, 45, 15);
  private readonly growthReflection = this.floorLight.compile(
    CHAMBER_DEVICE_BASES.growth.x, CHAMBER_DEVICE_BASES.growth.y + 8, 29, 13);
  private readonly purifierReflection = this.floorLight.compile(
    CHAMBER_DEVICE_BASES.purifier.x, CHAMBER_DEVICE_BASES.purifier.y + 9, 37, 12);
  private readonly reflectedLight: Phaser.GameObjects.Graphics;
  private readonly lampLight: Phaser.GameObjects.Graphics;
  private lampX = Number.NaN;
  private lampY = Number.NaN;
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
    this.addCanvas(`purification-chamber-exterior-${id}`, -50, paintChamberExterior);
    this.addCanvas(`purification-chamber-architecture-${id}`, 10, paintChamberArchitecture);
    this.addCanvas(`purification-chamber-grounding-${id}`, 12, paintChamberGrounding);
    this.resistanceTexture = this.addCanvas(`purification-chamber-resistance-${id}`, 14);
    this.resistancePainter = new ChamberPixels(this.resistanceTexture.context);
    this.reflectedLight = scene.add.graphics().setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
    this.lampLight = scene.add.graphics().setDepth(15.2).setBlendMode(Phaser.BlendModes.ADD);
    this.groundEffects = scene.add.graphics().setDepth(16);
    this.boundaryEffects = scene.add.graphics().setDepth(17);
    for (const device of DEVICE_IDS) {
      const base = CHAMBER_DEVICE_BASES[device];
      const depth = device === 'rift' ? 18 : 100 + base.y;
      const texture = this.addCanvas(`purification-chamber-${device}-${id}`, depth);
      this.devices.push({
        id: device, texture, painter: new ChamberPixels(texture.context), key: -1,
        activity: scene.add.graphics().setDepth(depth + .2),
        image: this.images[this.images.length - 1]!, bounds: DEVICE_BOUNDS[device], opacity: 1,
      });
    }
    this.addCanvas(`purification-chamber-front-cut-${id}`, 460, paintChamberForeground);
    this.bodyEffects = scene.add.graphics().setDepth(410);
  }

  private addCanvas(key: string, depth: number, paint?: (pixels: ChamberPixels) => void): Phaser.Textures.CanvasTexture {
    const texture = this.scene.textures.createCanvas(key, CHAMBER_SIZE.width, CHAMBER_SIZE.height);
    if (!texture) throw new Error(`Unable to allocate purification chamber texture: ${key}`);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (paint) paint(new ChamberPixels(texture.context));
    texture.refresh();
    this.textures.push(key);
    this.images.push(this.scene.add.image(0, 0, key).setOrigin(0).setDepth(depth));
    return texture;
  }

  update(timeMs: number, deltaMs: number, state: PurificationChamberState): void {
    if (this.destroyed) return;
    this.time = timeMs;
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
      paintChamberDevice(device.painter, device.id, this.deviceState);
      device.texture.refresh();
    }
    const frame = Math.floor(timeMs / 80);
    // The body attachment follows every player step even between animation ticks.
    this.bodyEffects.setPosition(Math.round(state.player.x), Math.round(state.player.y));
    this.bodyEffects.setDepth(110 + state.player.y + .5);
    const lampX = Math.round(state.player.x - 4); const lampY = Math.round(state.player.y + 8);
    if (lampX !== this.lampX || lampY !== this.lampY) {
      this.lampX = lampX; this.lampY = lampY;
      this.lampLight.clear();
      this.floorLight.paintLamp(this.lampLight, lampX, lampY);
    }
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
  }

  private paintActivity(time: number, state: PurificationChamberState): void {
    const breath = .5 + .5 * Math.sin(time * .0014);
    const slowFrame = Math.floor(time / 230);
    const elapsed = time - this.pulseStart;
    const pulsing = elapsed >= 0 && elapsed < 1000;
    const envelope = pulsing ? Math.sin(Math.PI * elapsed / 1000) : 0;
    const active = normalizeTarget(state.activeTarget);
    const ground = this.groundEffects;
    ground.clear(); this.bodyEffects.clear(); this.boundaryEffects.clear();
    // Small material receivers preserve the floor's authored shading. They never tint a wall/base.
    this.reflectedLight.clear();
    this.floorLight.paint(this.reflectedLight, this.coreReflection, 0x1aad96,
      (.075 + breath * .025) * Math.max(.18, state.moduleHealth.core));
    this.floorLight.paint(this.reflectedLight, this.growthReflection, 0x1a6b5c, .065 + breath * .01);
    this.floorLight.paint(this.reflectedLight, this.purifierReflection, 0x1a6b5c,
      (.06 + breath * .01) * Math.max(.18, state.moduleHealth.purifier));

    for (const device of this.devices) {
      const g = device.activity;
      g.clear();
      const { x, y } = CHAMBER_DEVICE_BASES[device.id];
      if (device.id === 'core') {
        const health = Math.max(.15, state.moduleHealth.core);
        g.fillStyle(0x1aad96, (.42 + breath * .30) * health);
        g.fillRect(x - 2, y - 42, 3, 5);
        g.fillRect(x + 1, y - 27, 2, 4);
        g.fillStyle(0x2ae6c8, (.26 + breath * .38) * health);
        g.fillRect(x - 1, y - 38, 2, 2);
      } else if (device.id === 'growth') {
        // Independent, small rising bubbles within the full liquid cylinder.
        g.fillStyle(0x1aad96, .38 + .16 * breath);
        const rise = slowFrame % 24;
        g.fillRect(x - 7, y - 14 - rise, 2, 2);
        g.fillRect(x + 7, y - 15 - ((rise + 11) % 23), 2, 1);
        g.fillStyle(0x2ae6c8, .25 + .12 * breath);
        g.fillRect(x - 6, y - 15 - rise, 1, 1);
      } else if (device.id === 'purifier') {
        const health = Math.max(.15, state.moduleHealth.purifier);
        g.fillStyle(0x1aad96, (.28 + breath * .2) * health);
        g.fillRect(x - 9, y - 23, 2, 4);
        g.fillRect(x + 4, y - 15, 3, 1);
      } else if (device.id === 'storage') {
        g.fillStyle(0x1a6b5c, .38 + breath * .15);
        g.fillRect(x - 3, y - 33, 4, 1);
      } else if (device.id === 'offering' && state.offeringCharge > 0) {
        // Same anonymous captive mass for all hidden identities; no countable world slots.
        const amount = Math.max(0, Math.min(1, state.offeringCharge));
        g.fillStyle(0x0e4a3f, 1);
        g.fillRect(x - 5, y - 20, 11, 4);
        g.fillRect(x - 2, y - 23, 6, 3);
        g.fillStyle(0x1a6b5c, .64 + breath * .2);
        g.fillRect(x - 3, y - 21, 4, 3);
        g.fillRect(x + 1, y - 18, 4, 2);
        g.fillStyle(0x1aad96, .2 + amount * .35);
        g.fillRect(x - 1, y - 22, 2, 1);
      } else if (device.id === 'rift') {
        g.fillStyle(0x1a6b5c, .42 + breath * .25);
        g.fillRect(x - 4, y - 3, 3, 1);
        g.fillRect(x, y - 3, 3, 1);
        g.fillStyle(0x1aad96, .25 + breath * .3);
        g.fillRect(x - 1, y - 2, 2, 1);
      }
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
    this.paintPressure(99, 240, state.moduleHealth.storage, 1, breath);
    this.paintPressure(319, 121, state.moduleHealth.core, 0, .5 + .5 * Math.sin(time * .0011 + 1.7));
    this.paintPressure(549, 228, state.moduleHealth.purifier, -1, .5 + .5 * Math.sin(time * .0013 + 3.1));
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
    if (health > .6) return;
    g.fillStyle(0x1aad96, .11 + phase * .16);
    if (direction === 0) {
      g.fillRect(x, y - 2, 1, 3);
      if (health < .3) g.fillRect(x + 2, y + 10, 1, 3);
    } else {
      const reach = direction * (health < .3 ? 13 : 8);
      g.fillRect(x + Math.round(reach * .5), y - 1, 2, 1);
      if (health < .3) g.fillRect(x + reach + direction * 3, y + 4, 1, 2);
    }
  }

  pulse(kind: PulseKind, target?: string): void {
    if (this.destroyed) return;
    this.pulseKind = kind;
    this.pulseStart = this.time;
    this.pulseTarget = normalizeTarget(target) ?? (kind === 'repair' ? 'core' : kind);
    this.lastFrame = -1;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.groundEffects.destroy(); this.bodyEffects.destroy(); this.boundaryEffects.destroy();
    this.reflectedLight.destroy(); this.lampLight.destroy();
    for (const device of this.devices) device.activity.destroy();
    for (const image of this.images) image.destroy();
    for (const key of this.textures) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.devices.length = 0; this.images.length = 0; this.textures.length = 0;
  }
}

function healthTier(health: number): number {
  if (health < .3) return 2;
  if (health <= .6) return 1;
  return 0;
}
function normalizeTarget(target?: string | null): string | null {
  if (!target) return null;
  const id = target.toLowerCase();
  if (id === 'defense') return 'offering';
  if (id === 'entrance') return 'rift';
  return id;
}
