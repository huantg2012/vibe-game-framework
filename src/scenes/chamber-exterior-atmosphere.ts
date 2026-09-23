import Phaser from 'phaser';
import { ChamberLightField, type LightSpan } from '../art/chamber-light-field';
import type { ChamberSurfaceMap } from '../art/chamber-surface-map';
import type { ChamberPolygon } from '../systems/purification-chamber-layout';

const FULL_FACE: readonly ChamberPolygon[] = [[{ x: 0, y: 0 }, { x: 640, y: 0 },
  { x: 640, y: 400 }, { x: 0, y: 400 }]];
const SOURCES = [
  { x: 16, y: 171, radiusX: 78, radiusY: 114, elevation: 91 },
  { x: 623, y: 183, radiusX: 74, radiusY: 116, elevation: 80 },
  { x: 319, y: 68, radiusX: 43, radiusY: 62, elevation: 79 },
] as const;
// Bounded exterior lanes, not a room-wide particle emitter. Never authored on the walking floor.
const LANES = [
  { x: 7, y: 154, width: 56, height: 134 },
  { x: 585, y: 126, width: 51, height: 170 },
  { x: 272, y: 13, width: 65, height: 64 },
  { x: 427, y: 363, width: 149, height: 30 },
] as const;

/** Cached material receivers and twelve slow fragments, behind the complete chamber. */
export class ChamberExteriorAtmosphere {
  private readonly field = new ChamberLightField();
  private readonly faces: readonly (readonly LightSpan[])[];
  private readonly light: Phaser.GameObjects.Graphics;
  private readonly dust: Phaser.GameObjects.Graphics;
  private tick = -1;

  constructor(scene: Phaser.Scene, albedo: Uint8ClampedArray, surfaces: ChamberSurfaceMap) {
    this.faces = SOURCES.map(source => this.field.compileFace(source, albedo, FULL_FACE,
      { surface: { map: surfaces, light: source } }));
    this.light = scene.add.graphics().setName('chamber-exterior-light').setDepth(-49)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.dust = scene.add.graphics().setName('chamber-exterior-dust').setDepth(-48);
  }

  update(time: number): void {
    const tick = Math.floor(time / 100);
    if (tick === this.tick) return;
    this.tick = tick;
    this.light.clear(); this.dust.clear();
    // Existing cold mineral hue: low energy, material-clipped, no glow in the void.
    for (let i = 0; i < this.faces.length; i++) this.field.paint(this.light, this.faces[i]!, 0x1a7a9a,
      .10 + .015 * Math.sin(time * .00038 + i * 2.1));
    for (let i = 0; i < 12; i++) {
      const lane = LANES[i % LANES.length]!;
      const phase = (time * (.000021 + (i % 3) * .000003) + i * .273) % 1;
      const x = lane.x + ((i * 29 + Math.sin(phase * 5 + i) * 4 + lane.width) % lane.width);
      const y = lane.y + lane.height * (1 - phase);
      this.dust.fillStyle(i % 3 === 0 ? 0x5a5f66 : 0x3a3d42, .25 + Math.sin(phase * Math.PI) * .40);
      this.dust.fillRect(Math.round(x), Math.round(y), 1 + Number(i % 5 === 0), 1);
    }
  }

  destroy(): void { this.light.destroy(); this.dust.destroy(); }
}
