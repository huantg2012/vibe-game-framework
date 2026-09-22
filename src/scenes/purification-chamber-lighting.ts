import Phaser from 'phaser';
import { ChamberLightField, type FieldSource, type LightSpan } from '../art/chamber-light-field';
import { ChamberFloorLight } from '../art/chamber-floor-light';
import { getChamberRouteAtPosition } from '../systems/purification-chamber-locomotion';
import { CHAMBER_DEVICE_BASES, CHAMBER_DEVICE_FLOORS, CHAMBER_SIZE,
  type ChamberDevice, type ChamberFloor, type ChamberPolygon } from '../systems/purification-chamber-layout';
import type { PurificationChamberState } from './purification-chamber-visual';

type SourceId = 'core' | 'growth' | 'purifier' | 'wall-lamp';
interface Emitter {
  id: SourceId; floor: ChamberFloor; color: number; face: FieldSource; ground: FieldSource;
  floorSpans: readonly LightSpan[]; wallSpans: readonly LightSpan[]; energy: number;
}
interface DeviceReceiver {
  id: ChamberDevice; graphics: Phaser.GameObjects.Graphics;
  responses: { emitter: Emitter; spans: readonly LightSpan[] }[];
}
const FULL_FACE: readonly ChamberPolygon[] = [[{ x: 0, y: 0 }, { x: 640, y: 0 },
  { x: 640, y: 400 }, { x: 0, y: 400 }]];

/** Projected pixel lighting: real emitters and receivers, not a full-screen color filter.
 * Ground projection and source height are art parameters; they never alter collision. */
export class PurificationChamberLighting {
  private readonly field = new ChamberLightField();
  private readonly lampReceiver = new ChamberFloorLight();
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly walls: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly lamp: Phaser.GameObjects.Graphics;
  private readonly motes: Phaser.GameObjects.Graphics;
  private readonly devices: DeviceReceiver[] = [];
  private readonly emitters: Emitter[];
  private tick = -1;
  private pulseTarget = '';
  private pulseTime = -10000;
  private playerX = Number.NaN;
  private playerY = Number.NaN;
  private lampX = Number.NaN;
  private lampY = Number.NaN;

  constructor(private readonly scene: Phaser.Scene, architecture: Phaser.Textures.CanvasTexture) {
    this.ground = scene.add.graphics().setName('chamber-floor-light').setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
    this.walls = scene.add.graphics().setName('chamber-wall-light').setDepth(15.05).setBlendMode(Phaser.BlendModes.ADD);
    this.shadow = scene.add.graphics().setName('chamber-directional-shadow').setDepth(15.1);
    this.lamp = scene.add.graphics().setName('chamber-player-ground-light').setDepth(15.2).setBlendMode(Phaser.BlendModes.ADD);
    this.motes = scene.add.graphics().setName('chamber-source-motes').setDepth(407).setBlendMode(Phaser.BlendModes.ADD);
    // Derive wall receivers from the exact baked architecture, removing actual floor polygons.
    // No approximate duplicate room geometry and no light in transparent/black cutout pixels.
    const pixels = architecture.context.getImageData(0, 0, CHAMBER_SIZE.width, CHAMBER_SIZE.height).data;
    const point = { x: 0, y: 0 };
    for (let y = 0; y < CHAMBER_SIZE.height; y++) {
      for (let x = 0; x < CHAMBER_SIZE.width; x++) {
        point.x = x + .5; point.y = y + .5;
        if (getChamberRouteAtPosition(point)) pixels[(y * CHAMBER_SIZE.width + x) * 4 + 3] = 0;
      }
    }
    const specs: { id: SourceId; color: number; face: FieldSource; ground: FieldSource; floor: ChamberFloor }[] = [
      { id: 'core', color: 0x2ae6c8, floor: 'main',
        face: { x: CHAMBER_DEVICE_BASES.core.x, y: CHAMBER_DEVICE_BASES.core.y - 38, radiusX: 112, radiusY: 70 },
        ground: { ...CHAMBER_DEVICE_BASES.core, radiusX: 105, radiusY: 43 } },
      { id: 'growth', color: 0x1aad96, floor: 'upper',
        face: { x: CHAMBER_DEVICE_BASES.growth.x, y: CHAMBER_DEVICE_BASES.growth.y - 36, radiusX: 67, radiusY: 44 },
        ground: { ...CHAMBER_DEVICE_BASES.growth, radiusX: 76, radiusY: 40 } },
      { id: 'purifier', color: 0x1aad96, floor: 'main',
        face: { x: CHAMBER_DEVICE_BASES.purifier.x, y: CHAMBER_DEVICE_BASES.purifier.y - 21, radiusX: 68, radiusY: 44 },
        ground: { ...CHAMBER_DEVICE_BASES.purifier, radiusX: 74, radiusY: 39 } },
      { id: 'wall-lamp', color: 0xc4873a, floor: 'upper',
        face: { x: 213, y: 140, radiusX: 23, radiusY: 20 },
        ground: { x: 213, y: 153, radiusX: 27, radiusY: 16 } },
    ];
    this.emitters = specs.map(spec => ({ ...spec, energy: 0,
      floorSpans: this.field.compileFloor(spec.ground, spec.floor, spec.id === 'wall-lamp' ? undefined : spec.id),
      wallSpans: this.field.compileFace(spec.face, pixels, FULL_FACE),
    }));
  }

  /** Called only when a device's public-state bitmap has actually been repainted. */
  syncDevice(id: ChamberDevice, texture: Phaser.Textures.CanvasTexture, depth: number): void {
    let receiver = this.devices.find(device => device.id === id);
    if (!receiver) {
      receiver = { id, graphics: this.scene.add.graphics().setName(`chamber-device-light-${id}`)
        .setDepth(depth + .1).setBlendMode(Phaser.BlendModes.ADD), responses: [] };
      this.devices.push(receiver);
    }
    const pixels = texture.context.getImageData(0, 0, CHAMBER_SIZE.width, CHAMBER_SIZE.height).data;
    receiver.responses = this.emitters.filter(emitter => emitter.floor === CHAMBER_DEVICE_FLOORS[id])
      .map(emitter => ({ emitter, spans: this.field.compileFace(emitter.face, pixels, FULL_FACE) }));
    this.tick = -1;
  }

  setDeviceOpacity(id: ChamberDevice, alpha: number): void {
    this.devices.find(device => device.id === id)?.graphics.setAlpha(alpha);
  }

  energy(id: SourceId): number { return this.emitters.find(emitter => emitter.id === id)!.energy; }

  update(time: number, state: PurificationChamberState): void {
    const tick = Math.floor(time / 80);
    if (tick === this.tick) return;
    this.tick = tick;
    this.ground.clear(); this.walls.clear(); this.motes.clear();
    for (const emitter of this.emitters) {
      if (emitter.id === 'core') emitter.energy = (.29 + .055 * Math.sin(time * .00135)) * Math.max(.12, state.moduleHealth.core);
      else if (emitter.id === 'growth') emitter.energy = .115 + .02 * Math.sin(time * .00083 + 1.8);
      else if (emitter.id === 'purifier') emitter.energy = (.19 + .03 * Math.sin(time * .00103 + 3.1)) * Math.max(.1, state.moduleHealth.purifier);
      else emitter.energy = .12 + .009 * Math.sin(time * .0017 + .8);
      const sincePulse = time - this.pulseTime;
      if (sincePulse >= 0 && sincePulse < 900
        && (this.pulseTarget === emitter.id || (this.pulseTarget === 'thicken' && (emitter.id === 'core' || emitter.id === 'purifier')))) {
        emitter.energy += .045 * Math.sin(Math.PI * sincePulse / 900);
      }
      this.field.paint(this.ground, emitter.floorSpans, emitter.color, emitter.energy);
      this.field.paint(this.walls, emitter.wallSpans, emitter.color, emitter.energy * .92);
    }
    this.walls.fillStyle(0xc4873a, this.energy('wall-lamp') * 3);
    this.walls.fillRect(213, 140, 1, 1);
    for (const device of this.devices) {
      device.graphics.clear();
      for (const response of device.responses) this.field.paint(device.graphics, response.spans,
        response.emitter.color, response.emitter.energy * .85);
    }
    // Three sparse flakes near the active core, visible only in its light, never full-room confetti.
    const core = this.emitters[0]!;
    for (let i = 0; i < 3; i++) {
      const phase = (time * .00016 + i * .31) % 1;
      this.motes.fillStyle(0x8a8f96, Math.sin(phase * Math.PI) * core.energy * .8);
      this.motes.fillRect(Math.round(248 + i * 5 + Math.sin(phase * 6 + i) * 4),
        Math.round(278 - phase * 25), 1, 1);
    }
    this.playerX = Number.NaN; // Energy changed; refresh shadow without changing player animation.
    this.syncPlayer(state.player, state.lamp);
  }

  /** POST_UPDATE receives the original lamp's animated anchor, after the body/weapon rig sync. */
  syncPlayer(player: Readonly<{ x: number; y: number }>, light: Readonly<{ x: number; y: number }>): void {
    const px = Math.round(player.x); const py = Math.round(player.y + 10);
    const lx = Math.round(light.x); const ly = Math.round(light.y);
    if (px === this.playerX && py === this.playerY && lx === this.lampX && ly === this.lampY) return;
    this.playerX = px; this.playerY = py; this.lampX = lx; this.lampY = ly;
    this.lamp.clear();
    this.lampReceiver.paintLamp(this.lamp, lx, py + 1);
    this.shadow.clear();
    let strongest: Emitter | undefined; let strength = 0;
    for (const emitter of this.emitters) {
      const dx = (px - emitter.ground.x) / emitter.ground.radiusX;
      const dy = (py - emitter.ground.y) / emitter.ground.radiusY;
      const value = emitter.energy * Math.max(0, 1 - dx * dx - dy * dy);
      if (value > strength) { strength = value; strongest = emitter; }
    }
    if (strongest) this.field.paintActorShadow(this.shadow, px, py, strongest.ground, Math.min(.43, strongest.energy * 1.8));
  }

  pulse(target: string, time: number): void {
    this.pulseTarget = target; this.pulseTime = time; this.tick = -1;
  }

  destroy(): void {
    this.ground.destroy(); this.walls.destroy(); this.shadow.destroy(); this.lamp.destroy(); this.motes.destroy();
    for (const device of this.devices) device.graphics.destroy();
    this.devices.length = 0;
  }
}
