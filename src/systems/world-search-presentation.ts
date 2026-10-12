/** World-source remains; contents and search rules deliberately do not enter this layer. */
import Phaser from 'phaser';
import { createSearchRemainsPixels, type SearchRemainsMaterial } from '@/generation/world-study/search-remains';
import type { WorldProfile } from '@/generation/world-study/types';
import type { Vector2 } from '@/types/game-types';
import { createSurfaceSearchObjectVisual, createTexturedSearchObjectVisual, type SearchObjectVisual } from './loot-search-presentation';
import { buildRemainsReflection, SearchRemainsAmbient } from './search-remains-ambient';

const leases = new WeakMap<Phaser.Textures.TextureManager, Map<string, number>>();

export function createGroundedWorldSearchVisual(
  scene: Phaser.Scene, position: Readonly<Vector2>, seed: number,
  getPlayerPos: () => Readonly<Vector2>, profile: WorldProfile,
): SearchObjectVisual {
  return createSurfaceSearchObjectVisual(scene, position, seed, {
    shadow: profile.palette.shadow, stain: profile.palette.materialDark,
    body: profile.palette.materialMid, highlight: profile.palette.faceLight,
  }, getPlayerPos);
}

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
  const reflection = buildRemainsReflection(image);
  const sheenKey = `__search_remains_sheen_${key}`;
  const manager = scene.textures;
  let counts = leases.get(manager);
  if (!counts) { counts = new Map(); leases.set(manager, counts); }
  const allocated: string[] = [];
  const upload = (textureKey: string, pixels: Uint8ClampedArray): void => {
    if (manager.exists(textureKey)) return;
    const texture = manager.createCanvas(textureKey, image.width, image.height);
    if (!texture) throw new Error(`Cannot create search-remains texture: ${profile.id}`);
    allocated.push(textureKey);
    const context = texture.getContext();
    const data = context.createImageData(image.width, image.height);
    data.data.set(pixels);
    context.putImageData(data, 0, 0);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  try { upload(key, image.pixels); upload(sheenKey, reflection.pixels); }
  catch (error) { for (const textureKey of allocated) manager.remove(textureKey); throw error; }
  counts.set(key, (counts.get(key) ?? 0) + 1);
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, release);
    const remaining = (counts!.get(key) ?? 1) - 1;
    if (remaining > 0) counts!.set(key, remaining);
    else {
      counts!.delete(key);
      for (const textureKey of [key, sheenKey]) if (manager.exists(textureKey)) manager.remove(textureKey);
    }
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
  let ambient: SearchRemainsAmbient | undefined;
  try {
    ambient = new SearchRemainsAmbient(scene, position.x, position.y, image.width, image.height,
      sheenKey, reflection.accents, visualSeed);
    return createTexturedSearchObjectVisual(scene, position, visualSeed, {
      shadow: profile.palette.shadow, stain: profile.palette.materialDark,
      body: profile.palette.materialMid, highlight: profile.palette.faceLight,
    }, getPlayerPos, { textureKey: key, name: `search-remains:${profile.id}:${image.grammar}`, release, ambient });
  } catch (error) { ambient?.destroy(); release(); throw error; }
}
