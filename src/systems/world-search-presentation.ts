/** World-source remains; contents and search rules deliberately do not enter this layer. */
import Phaser from 'phaser';
import { createSearchRemainsPixels, type SearchRemainsMaterial } from '@/generation/world-study/search-remains';
import type { WorldProfile } from '@/generation/world-study/types';
import type { Vector2 } from '@/types/game-types';
import { createTexturedSearchObjectVisual, type SearchObjectVisual } from './loot-search-presentation';

const leases = new WeakMap<Phaser.Textures.TextureManager, Map<string, number>>();

function fingerprint(pixels: Uint8ClampedArray): string {
  let hash = 2166136261;
  for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16);
}

export function createWorldSearchVisual(
  scene: Phaser.Scene, position: Readonly<Vector2>, seed: number,
  getPlayerPos: () => Readonly<Vector2>, profile: WorldProfile, worldSeed: number,
  painting?: SearchRemainsMaterial,
): SearchObjectVisual {
  // Mix only stable visual identities, never reward kind, quality or quantity.
  const visualSeed = (seed ^ Math.imul(worldSeed, 0x9e3779b9)) >>> 0;
  const image = createSearchRemainsPixels(profile, visualSeed, painting);
  const key = `__world_search_${profile.id}_${image.grammar}_${fingerprint(image.pixels)}`;
  const manager = scene.textures;
  let counts = leases.get(manager);
  if (!counts) { counts = new Map(); leases.set(manager, counts); }
  if (!manager.exists(key)) {
    const texture = manager.createCanvas(key, image.width, image.height);
    if (!texture) throw new Error(`Cannot create search-remains texture: ${profile.id}`);
    try {
      const context = texture.getContext();
      const data = context.createImageData(image.width, image.height);
      data.data.set(image.pixels);
      context.putImageData(data, 0, 0);
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    } catch (error) { manager.remove(key); throw error; }
  }
  counts.set(key, (counts.get(key) ?? 0) + 1);
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, release);
    const remaining = (counts!.get(key) ?? 1) - 1;
    if (remaining > 0) counts!.set(key, remaining);
    else { counts!.delete(key); if (manager.exists(key)) manager.remove(key); }
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
  try {
    return createTexturedSearchObjectVisual(scene, position, visualSeed, {
      shadow: profile.palette.shadow, stain: profile.palette.materialDark,
      body: profile.palette.materialMid, highlight: profile.palette.faceLight,
    }, getPlayerPos, { textureKey: key, name: `search-remains:${profile.id}:${image.grammar}`, release });
  } catch (error) { release(); throw error; }
}
