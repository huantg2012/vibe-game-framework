import Phaser from 'phaser';
import { CHAMBER_DEVICE_ANCHORS, CHAMBER_SIZE } from '@/systems/purification-chamber-layout';
import {
  ChamberPixels,
  paintChamberArchitecture,
  paintChamberDevices,
  paintChamberExterior,
} from '../art/purification-chamber-pixels';

export interface PurificationChamberState {
  /** Actual public integrity, normalized hp / maxHp. No forecast is accepted here. */
  moduleHealth: { core: number; storage: number; purifier: number };
  thickenLevel: number;
  offeringCharge: number;
  growthLevels: Readonly<Record<string, number>>;
  activeTarget: string | null;
  player: { x: number; y: number };
}

type PulseKind = 'repair' | 'growth' | 'offering';

const DEVICE_POSITIONS: Readonly<Record<string, readonly [number, number]>> = Object.fromEntries(
  Object.entries(CHAMBER_DEVICE_ANCHORS).map(([id, point]) => [id, [point.x, point.y - (point.y === 180 ? 9 : 8)]]),
);


let chamberId = 0;

/**
 * Production, pixel-native side-oblique hub. Static material layers are uploaded once;
 * only module-state changes rebuild devices. A tiny 12 Hz layer owns local active matter.
 * Its input deliberately excludes the next impact, hidden offering identity and future route.
 */
export class PurificationChamberVisual {
  private readonly textures: string[] = [];
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly effects: Phaser.GameObjects.Graphics;
  private readonly bodyEffects: Phaser.GameObjects.Graphics;
  private readonly foreground: Phaser.GameObjects.Graphics;
  private readonly deviceTexture: Phaser.Textures.CanvasTexture;
  private readonly devicePainter: ChamberPixels;
  private deviceKey = '';
  private lastFrame = -1;
  private pulseStart = -10000;
  private pulseX = 276;
  private pulseY = 278;
  private pulseKind: PulseKind = 'repair';
  private pulseTarget = 'core';
  private playerX = 276;
  private playerY = 286;
  private time = 0;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {
    const id = ++chamberId;
    this.addCanvas(`purification-chamber-exterior-${id}`, -50, paintChamberExterior);
    this.addCanvas(`purification-chamber-architecture-${id}`, 10, paintChamberArchitecture);
    this.deviceTexture = this.addCanvas(`purification-chamber-devices-${id}`, 28);
    this.devicePainter = new ChamberPixels(this.deviceTexture.context);
    this.effects = scene.add.graphics().setDepth(29);
    this.bodyEffects = scene.add.graphics().setDepth(41);
    this.foreground = scene.add.graphics().setDepth(45);
    // The low front lip makes the floor read as a solid without occluding the torso.
    this.foreground.fillStyle(0x4a4e55, 1);
    this.foreground.fillRect(78, 297, 484, 2);
    this.foreground.fillRect(174, 191, 292, 2);
    this.foreground.fillStyle(0x2c2e33, 1);
    this.foreground.fillRect(82, 300, 476, 2);
    this.foreground.fillRect(178, 194, 284, 2);
  }

  private addCanvas(
    key: string,
    depth: number,
    paint?: (pixels: ChamberPixels) => void,
  ): Phaser.Textures.CanvasTexture {
    const texture = this.scene.textures.createCanvas(key, CHAMBER_SIZE.width, CHAMBER_SIZE.height);
    if (!texture) throw new Error(`Unable to allocate purification chamber texture: ${key}`);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (paint) paint(new ChamberPixels(texture.context));
    texture.refresh();
    this.textures.push(key);
    this.images.push(this.scene.add.image(0, 0, key).setOrigin(0).setDepth(depth));
    return texture;
  }

  update(timeMs: number, _deltaMs: number, state: PurificationChamberState): void {
    if (this.destroyed) return;
    this.time = timeMs;
    this.playerX = state.player.x;
    this.playerY = state.player.y;
    const health = state.moduleHealth;
    const core = healthTier(health.core);
    const storage = healthTier(health.storage);
    const purifier = healthTier(health.purifier);
    let growth = 0;
    for (const id in state.growthLevels) growth += state.growthLevels[id] ?? 0;
    const key = `${core}/${storage}/${purifier}/${state.thickenLevel}/${Math.min(growth, 12)}`;
    if (key !== this.deviceKey) {
      this.deviceKey = key;
      this.deviceTexture.context.clearRect(0, 0, 640, 400);
      paintChamberDevices(this.devicePainter, {
        core: health.core, storage: health.storage, purifier: health.purifier,
        thickenLevel: state.thickenLevel, growthLevels: growth,
      });
      this.deviceTexture.refresh();
    }
    const frame = Math.floor(timeMs / 80);
    if (this.lastFrame === frame) return;
    this.lastFrame = frame;
    this.paintActivity(timeMs, state, growth);
  }

  private paintActivity(time: number, state: PurificationChamberState, growth: number): void {
    const g = this.effects;
    g.clear();
    this.bodyEffects.clear();
    const breath = .5 + .5 * Math.sin(time * .0014);
    // Colored matter is confined to the exposed feed and the actual world wound.
    g.fillStyle(0x1aad96, .36 + .22 * breath);
    g.fillRect(274, 236, 3, 6);
    g.fillRect(271, 250, 2, 6);
    g.fillStyle(0x2ae6c8, .35 + .20 * breath);
    g.fillRect(274, 240, 2, 2);
    g.fillStyle(0x1a6b5c, .4 + .22 * breath);
    g.fillRect(489, 274, 7, 1);
    g.fillRect(501, 272, 4, 1);
    g.fillRect(507, 268, 4, 1);
    // Light reaches a short patch of material, never a room-sized visibility dome.
    g.fillStyle(0x1a6b5c, .045 + breath * .025);
    g.fillEllipse(494, 278, 38, 10);
    g.fillStyle(0xc4873a, .065);
    g.fillEllipse(323, 251, 34, 18);
    g.fillEllipse(440, 264, 30, 15);
    g.fillEllipse(215, 120, 22, 12);

    if (state.offeringCharge > 0) {
      const amount = Math.max(0, Math.min(1, state.offeringCharge));
      g.fillStyle(0x0e4a3f, 1);
      g.fillRect(371, 151, 13, 6);
      g.fillStyle(0x1a6b5c, .5 + breath * .25);
      g.fillRect(374, 152, 3, 3);
      g.fillRect(380, 153, 2, 2);
      g.fillStyle(0x1aad96, .25 + amount * .35);
      g.fillRect(375, 151, 2, 1);
    }
    if (growth > 0) {
      g.fillStyle(0x8a8f96, .35 + .12 * breath);
      g.fillRect(263, 130, 2, 8);
      g.fillRect(284, 150, 2, 2);
    }
    // Exterior slow changes belong to the foreign material, not a particle snowfall.
    g.fillStyle(0x1a6b5c, .2 + breath * .2);
    g.fillRect(51, 124, 4, 1);
    g.fillRect(583, 176, 5, 1);
    g.fillRect(123, 113, 5, 1);
    g.fillRect(449, 117, 4, 1);

    const target = state.activeTarget === 'defense' ? 'offering' : state.activeTarget?.toLowerCase();
    const position = target ? DEVICE_POSITIONS[target] : undefined;
    if (position) {
      // A local contact cue belongs to the device; the HUD remains the action label.
      const [x, y] = position;
      g.fillStyle(0x8a8f96, .64);
      g.fillRect(x - 21, y + 4, 5, 1);
      g.fillRect(x + 18, y + 4, 5, 1);
      g.fillRect(x - 21, y + 2, 1, 3);
      g.fillRect(x + 22, y + 2, 1, 3);
    }

    const elapsed = time - this.pulseStart;
    if (elapsed >= 0 && elapsed < 1100) {
      const envelope = Math.sin(Math.PI * elapsed / 1100);
      const color = this.pulseKind === 'offering' ? 0x1aad96 : 0x8a8f96;
      if (this.pulseTarget === 'player') {
        // Brief material response on the existing sleeve/chest, never a replacement skin.
        this.bodyEffects.fillStyle(0xc8cdd4, envelope * .45);
        this.bodyEffects.fillRect(Math.round(state.player.x) - 3, Math.round(state.player.y) - 7, 2, 3);
        this.bodyEffects.fillRect(Math.round(state.player.x) + 4, Math.round(state.player.y) - 2, 1, 3);
        g.fillStyle(0x8a8f96, envelope * .25);
        g.fillEllipse(state.player.x, state.player.y + 10, 18, 4);
        return;
      }
      if (this.pulseTarget === 'thicken') {
        g.fillStyle(color, envelope * .65);
        for (const x of [166, 276, 386]) {
          g.fillRect(x - 23, 272, 5, 2);
          g.fillRect(x + 20, 272, 5, 2);
        }
        return;
      }
      const rise = Math.floor(elapsed / 1100 * 32);
      g.fillStyle(color, envelope * .35);
      g.fillRect(this.pulseX - 17, this.pulseY - rise, 34, 2);
      g.fillStyle(color, envelope * .12);
      g.fillEllipse(this.pulseX + 3, this.pulseY + 2, 48, 10);
      g.fillStyle(color, envelope * .7);
      g.fillRect(this.pulseX - 15, this.pulseY - rise, 4, 1);
      g.fillRect(this.pulseX + 9, this.pulseY - rise, 3, 1);
    }
  }

  pulse(kind: PulseKind, target?: string): void {
    if (this.destroyed) return;
    this.pulseKind = kind;
    this.pulseStart = this.time;
    const key = target?.toLowerCase() ?? (kind === 'repair' ? 'core' : kind);
    this.pulseTarget = key;
    const position = DEVICE_POSITIONS[key] ?? DEVICE_POSITIONS.core!;
    this.pulseX = key === 'player' ? this.playerX : position[0];
    this.pulseY = key === 'player' ? this.playerY : position[1];
    this.lastFrame = -1;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.effects.destroy();
    this.bodyEffects.destroy();
    this.foreground.destroy();
    for (const image of this.images) image.destroy();
    for (const key of this.textures) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
    this.images.length = 0;
    this.textures.length = 0;
  }
}

function healthTier(health: number): number {
  if (health < .3) return 2;
  if (health <= .6) return 1;
  return 0;
}
