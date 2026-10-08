import Phaser from 'phaser';
import type { SearchObjectAmbient } from './loot-search-presentation';

interface SurfaceImage { readonly width: number; readonly height: number; readonly pixels: Uint8ClampedArray }
export interface RemainsAccent { readonly x: number; readonly y: number; readonly color: number }

/** Reflections stay inside a few existing material facets, never around the silhouette. */
export function buildRemainsReflection(image: SurfaceImage): { pixels: Uint8ClampedArray; accents: RemainsAccent[] } {
  const { width, height, pixels } = image;
  const reflection = new Uint8ClampedArray(pixels.length);
  const candidates: { x: number; y: number; light: number }[] = [];
  const lightAt = (x: number, y: number): number => {
    const i = (y * width + x) * 4;
    return pixels[i + 3] === 255 ? pixels[i]! * .2126 + pixels[i + 1]! * .7152 + pixels[i + 2]! * .0722 : 0;
  };
  for (let y = 4; y < height - 6; y++) for (let x = 3; x < width - 3; x++) {
    const light = lightAt(x, y);
    if (light > 30 && lightAt(x - 1, y) > 20 && lightAt(x + 1, y) > 20) candidates.push({ x, y, light });
  }
  candidates.sort((a, b) => b.light - a.light || a.y - b.y || a.x - b.x);
  const accents: RemainsAccent[] = [];
  for (const point of candidates) {
    if (accents.some(p => Math.hypot(point.x - p.x, point.y - p.y) < 7)) continue;
    let color = 0;
    for (let dy = 0; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dy === 1 && dx === 1) continue;
      const i = ((point.y + dy) * width + point.x + dx) * 4;
      if (pixels[i + 3] !== 255 || lightAt(point.x + dx, point.y + dy) < point.light * .65) continue;
      for (let c = 0; c < 3; c++) reflection[i + c] = Math.min(255, pixels[i + c]! * 1.34 + 14);
      reflection[i + 3] = 255;
      if (dx === 0 && dy === 0) color = (reflection[i]! << 16) | (reflection[i + 1]! << 8) | reflection[i + 2]!;
    }
    accents.push({ x: point.x, y: point.y, color });
    if (accents.length === 3) break;
  }
  return { pixels: reflection, accents };
}

/** Small reflected facets and settling fragments. No light source, additive blend or idle body motion. */
export class SearchRemainsAmbient implements SearchObjectAmbient {
  private readonly sheen: Phaser.GameObjects.Image;
  private readonly flakes: Phaser.GameObjects.Rectangle[];
  private readonly period: number;
  private readonly motionPreference = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  private elapsed = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, private readonly x: number, private readonly y: number,
    private readonly width: number, private readonly height: number, textureKey: string,
    private readonly accents: readonly RemainsAccent[], seed: number) {
    this.period = 3600 + seed % 1601;
    this.elapsed = (seed >>> 8) % this.period;
    this.sheen = scene.add.image(x, y, textureKey).setOrigin(.5, 1).setDepth(15.01)
      .setAlpha(0).setVisible(false).setName('search-remains-sheen');
    this.flakes = [];
    try {
      for (let i = 0; i < Math.min(2, accents.length); i++) {
        const flake = scene.add.rectangle(x, y, i ? 1 : 2, 1, accents[i]!.color);
        this.flakes.push(flake);
        flake.setOrigin(0, 0).setDepth(16).setVisible(false).setName('search-remains-flake');
      }
    } catch (error) {
      this.sheen.destroy(); for (const flake of this.flakes) flake.destroy();
      throw error;
    }
  }

  update(deltaMs: number, visibility: number, rummaging: boolean, bodyX: number): void {
    if (this.destroyed) return;
    if (visibility <= .02 || rummaging || this.motionPreference?.matches) { this.hide(); return; }
    this.elapsed += Math.max(0, deltaMs);
    const phase = this.elapsed % this.period;
    const pulse = phase >= 280 && phase <= 1220 ? Math.sin((phase - 280) / 940 * Math.PI) ** 2 : 0;
    this.sheen.setPosition(bodyX, this.y).setVisible(pulse > 0).setAlpha(pulse * .78 * visibility);
    for (let i = 0; i < this.flakes.length; i++) {
      const a = this.accents[i]!, flake = this.flakes[i]!;
      const age = (phase - 780 - i * 160) / 620;
      if (age < 0 || age >= 1) { flake.setVisible(false); continue; }
      flake.setPosition(Math.round(this.x - this.width / 2 + a.x + age * (i ? -2 : 2)),
        Math.round(this.y - this.height + a.y + age * age * 8));
      flake.setVisible(true).setAlpha(visibility * .78 * (1 - age));
    }
  }

  hide(): void { this.sheen.setVisible(false); for (const flake of this.flakes) flake.setVisible(false); }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.sheen.destroy(); for (const flake of this.flakes) flake.destroy();
  }
}
