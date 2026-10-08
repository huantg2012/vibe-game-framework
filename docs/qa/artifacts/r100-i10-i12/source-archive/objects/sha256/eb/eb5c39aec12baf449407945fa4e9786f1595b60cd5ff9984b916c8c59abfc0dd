/** A return rift is a wound in the floor, not a constructed doorway.
 * 36×24 native pixels; three recessed planes, asymmetric separated lips.
 * Shares the source-world matter, below actors and the authoritative fog.
 * No new collision, white disk, green halo or visibility query. */
import Phaser from 'phaser';
import type { Vector2 } from '@/types/game-types';
import type { WorldProfile } from '@/generation/world-study/types';
import type { SearchRemainsMaterial } from '@/generation/world-study/search-remains';
import type { ExtractionVisual } from './extraction-system';

const W = 36, H = 24;
let sequence = 0;
export function createR100ExtractionVisual(scene: Phaser.Scene, position: Readonly<Vector2>,
  profile: WorldProfile, painting: SearchRemainsMaterial): ExtractionVisual {
  const key = `r100-return-wound-${++sequence}`;
  const texture = scene.textures.createCanvas(key, W, H);
  if (!texture) throw new Error('Could not allocate the return rift');
  const context = texture.getContext(), image = context.createImageData(W, H);
  const put = (x: number, y: number, rgb: readonly number[]): void => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    image.data[i] = rgb[0]!; image.data[i + 1] = rgb[1]!; image.data[i + 2] = rgb[2]!; image.data[i + 3] = 255;
  };
  const matter = (x: number, y: number, face: 'cut' | 'lip'): number[] => {
    const patch = painting.regions?.cleaved;
    const px = Math.floor((patch?.x ?? .35) * painting.width) + x;
    const py = Math.floor((patch?.y ?? .45) * painting.height) + y;
    const i = ((py % painting.height) * painting.width + px % painting.width) * 4;
    const floor = face === 'lip' ? 52 : 25, factor = face === 'lip' ? 1.04 : .48;
    return [0, 1, 2].map(channel => Math.max(floor, Math.min(118, painting.pixels[i + channel]! * factor)));
  };
  const center = (x: number): number => Math.round(16 - x * .26 + (x < 12 ? -1 : x < 21 ? 1 : 0));
  for (let x = 3; x < 34; x++) {
    const y = center(x), width = x < 7 || x > 30 ? 0 : x < 13 || x > 25 ? 1 : 2;
    // Bright surfaces are broken open edges, never a perimeter outline.
    if (x >= 7 && x <= 24 && x !== 15) {
      put(x, y - width - 3, matter(x, y, 'lip'));
      put(x, y - width - 2, matter(x, y + 1, 'cut'));
    }
    for (let dy = -width - 1; dy <= width + 1; dy++) put(x, y + dy, [21, 26, 30]);
    for (let dy = -width; dy <= width; dy++) put(x, y + dy, [8, 10, 12]);
    if (x > 13 && x < 30) {
      put(x, y + width + 2, matter(x + 3, y, 'cut'));
      put(x, y + width + 3, matter(x + 4, y + 2, 'lip'));
    }
  }
  // Two unequal fracture continuations retain the wound's directional identity.
  for (let i = 0; i < 5; i++) put(10 - i, 12 - i, [21, 26, 30]);
  for (let i = 0; i < 4; i++) put(24 + i, 13 + i, [21, 26, 30]);
  context.putImageData(image, 0, 0); texture.refresh(); texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const sprite = scene.add.image(position.x, position.y, key).setDepth(15);
  const glint = scene.add.graphics().setDepth(15.01);
  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return; destroyed = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, destroy);
    sprite.destroy(); glint.destroy(); scene.textures.remove(key);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  return {
    update(elapsedMs) {
      if (destroyed) return;
      glint.clear();
      const phase = elapsedMs % 4200 / 4200;
      if (phase < .55) return;
      const x = 9 + Math.floor((phase - .55) / .45 * 13), y = center(x) - (x < 13 ? 1 : 2) - 3;
      glint.fillStyle(profile.palette.faceLight, Math.sin((phase - .55) / .45 * Math.PI) * .24);
      glint.fillRect(Math.round(position.x - W / 2 + x), Math.round(position.y - H / 2 + y), 2, 1);
    }, destroy,
  };
}
