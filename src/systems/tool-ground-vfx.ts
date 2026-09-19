import type Phaser from 'phaser';
import { contaminantWorldPixels } from '@/art/contaminant-icons';
import { catalogGroundPixels } from '@/art/contaminant-catalog-icons';
import type { LegacyContaminantType, Vector2 } from '@/types/game-types';

const objects = new Map<LegacyContaminantType, { x: number; y: number; color: number }[]>();
const catalogObjects = new Map<string, { x: number; y: number; color: number }[]>();
/** Native 16px effect proxy, authored separately from the 24px inventory image. */
export function drawCatalogToolObject(g: Phaser.GameObjects.Graphics, definitionId: string, p: Readonly<Vector2>, alpha: number): void {
  let pixels = catalogObjects.get(definitionId);
  if (!pixels) {
    const source = catalogGroundPixels({ kind: 'item', definitionId });
    if (!source) throw new Error(`Missing placed ability object: ${definitionId}`);
    pixels = [];
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      if (source.data[i + 3]) pixels.push({ x: x - source.width / 2, y: y - source.height / 2,
        color: source.data[i]! * 65536 + source.data[i + 1]! * 256 + source.data[i + 2]! });
    }
    catalogObjects.set(definitionId, pixels);
  }
  for (const pixel of pixels) g.fillStyle(pixel.color, alpha).fillRect(Math.round(p.x) + pixel.x, Math.round(p.y) + pixel.y, 1, 1);
}
/** The same material silhouette as the inventory item, sampled on the world pixel grid. */
export function drawToolObject(g: Phaser.GameObjects.Graphics, type: LegacyContaminantType, p: Readonly<Vector2>, alpha: number): void {
  let pixels = objects.get(type);
  if (!pixels) {
    pixels = []; const source = contaminantWorldPixels(type);
    for (let y = 0; y < source.height; y += 2) for (let x = 0; x < source.width; x += 2) {
      const i = (y * source.width + x) * 4;
      if (source.data[i + 3]) pixels.push({ x: x / 2 - 8, y: y / 2 - 8,
        color: source.data[i]! * 65536 + source.data[i + 1]! * 256 + source.data[i + 2]! });
    }
    objects.set(type, pixels);
  }
  for (const pixel of pixels) g.fillStyle(pixel.color, alpha)
    .fillRect(Math.round(p.x) + pixel.x, Math.round(p.y) + pixel.y, 1, 1);
}

export function drawPressure(g: Phaser.GameObjects.Graphics, p: Readonly<Vector2>, radius: number, alpha: number, drawObject = true): void {
  g.clear();
  // Broken lips of compressed floor material make the reach legible in motion.
  // The gaps remain broad: this is a dent in the floor, not a luminous spell ring.
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.39996;
    for (let step = 0; step < 7 + i % 4; step++) {
      const a = angle + step / radius;
      const r = radius - 2 - (step % 4 === 0 ? 1 : 0);
      const x = Math.round(p.x + Math.cos(a) * r), y = Math.round(p.y + Math.sin(a) * r);
      g.fillStyle(0x101b18, alpha * .8).fillRect(x - 1, y + 1, 3, 2);
      g.fillStyle(i % 3 ? 0x899281 : 0xb1a78a, alpha * .72).fillRect(x, y, 2, 1);
    }
  }
  // Settled pressure in the ground, not particles flying toward an attractive force.
  for (let i = 0; i < 37; i++) {
    const angle = i * 2.39996, r = radius * (i % 4 === 0 ? .96 : .23 + ((i * 13) % 19) / 28);
    const x = Math.round(p.x + Math.cos(angle) * r), y = Math.round(p.y + Math.sin(angle) * r);
    g.fillStyle(i % 3 ? 0x58625b : 0x8a8b75, alpha * (i % 4 ? .32 : .48));
    g.fillRect(x, y, 2 + i % 4, 1);
    if (i % 4 === 0) g.fillRect(x + 2, y + 1, 2, 1);
  }
  if (drawObject) drawToolObject(g, 'compress', p, alpha);
}

export function drawFootDrag(g: Phaser.GameObjects.Graphics, p: Readonly<Vector2>, alpha: number): void {
  const x = Math.round(p.x), y = Math.round(p.y);
  g.fillStyle(0xaaa58c, alpha * .65);
  g.fillRect(x - 6, y + 2, 4, 1); g.fillRect(x + 1, y + 3, 6, 1);
  g.fillStyle(0x536e63, alpha * .6); g.fillRect(x - 4, y + 3, 2, 1); g.fillRect(x + 4, y + 4, 2, 1);
}

/** A slack, irregular fiber, pulled taut only by a real crossing. All vertices stay pixel-aligned. */
export function drawSeam(g: Phaser.GameObjects.Graphics, a: Readonly<Vector2>, b: Readonly<Vector2>, alpha: number, tension = 0): void {
  g.clear();
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  for (let i = 0; i <= Math.ceil(length); i++) {
    const t = i / Math.ceil(length);
    const bow = Math.sin(t * Math.PI) * (Math.sin(i * .47) + 1.3) * (1 - tension);
    const x = Math.round(a.x + dx * t + nx * bow), y = Math.round(a.y + dy * t + ny * bow);
    g.fillStyle(i % 7 < 2 ? 0x829687 : 0x59685e, alpha * (.7 + tension * .25));
    g.fillRect(x, y, 1, 1);
    if ((i * 7) % 23 < 2) {
      g.fillStyle(0x99947d, alpha * .55);
      g.fillRect(Math.round(x + nx * 2), Math.round(y + ny * 2), 1 + i % 2, 1);
    }
  }
  for (const p of [a, b]) {
    g.fillStyle(0x343d36, alpha); g.fillRect(Math.round(p.x) - 3, Math.round(p.y), 5, 2);
    g.fillStyle(0x9a9379, alpha * .8); g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 1, 3, 1);
  }
}

export function drawHostRestraint(g: Phaser.GameObjects.Graphics, p: Readonly<Vector2>, held: boolean, remaining: number, elapsed: number): void {
  g.clear();
  if (held) {
    // Suspended grit holds its height, then falls when the release clock resumes.
    // Its broken columns are wide enough to read against the moving volume.
    const release = Math.max(0, -remaining / 450);
    const alpha = 1 - Math.min(1, release);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? -1 : 1;
      const x = Math.round(p.x + side * (10 + (i * 7) % 20));
      const y = Math.round(p.y - 32 + (i * 13) % 53 + release * release * (20 + i % 9));
      g.fillStyle(0x14251f, alpha * .8).fillRect(x - 1, y - 1, 4, 4);
      g.fillStyle(i % 4 ? 0xb5a989 : 0x85ac99, alpha * .9).fillRect(x, y, i % 3 ? 2 : 3, 2);
      if (i % 4 === 0) g.fillRect(x + 1, y - 3, 1, 2);
    }
    return;
  }
  const alpha = Math.min(1, remaining / 350);
  // Broken material traces around the living core: sand held up / spent ash falling down.
  for (let i = 0; i < 15; i++) {
    const side = i % 2 ? -1 : 1;
    const x = Math.round(p.x + side * (7 + ((i * 7) % 9)));
    const drift = held ? 0 : Math.floor((elapsed * .006 + i * 3) % 8);
    const y = Math.round(p.y - 19 + ((i * 11) % 26) + drift);
    g.fillStyle(held ? (i % 3 ? 0x9a9175 : 0x6c8b7d) : (i % 3 ? 0x686960 : 0x8c8777), alpha * .7);
    g.fillRect(x, y, i % 3 === 0 ? 2 : 1, held ? 2 : 1);
  }
}

export function muteSuppressedMaterial(pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const grey = pixels[i]! * .3 + pixels[i + 1]! * .5 + pixels[i + 2]! * .2;
    pixels[i] = grey * .82; pixels[i + 1] = grey * .86; pixels[i + 2] = grey * .8;
  }
}
