/** Native Phaser surface; the production visibility compositor remains its sole light owner. */
import type { RiftDevRuntime, RiftDevRuntimeContext } from '@/scenes/rift-scene';
import { paintMaterialLight } from '@/generation/world-study/material-light';
import { renderWorldSurface } from '@/generation/world-study/surface';
import { worldSupportAt } from '@/generation/world-study/support';
import type { WorldSample } from '@/generation/world-study/types';

export interface WorldPlaySurface extends RiftDevRuntime {
  snapshot(): { footprint: Readonly<{ x: number; y: number; width: number; height: number }>; reflectionPixels: number; reflectionUpdatedMs: number; textureCount: number; phaserFps: number };
  inspectPoint(point: Readonly<{ x: number; y: number }>): { support: boolean; visibility: number };
}

export function createWorldPlaySurface(context: RiftDevRuntimeContext, sample: WorldSample): WorldPlaySurface {
  const { scene } = context, surface = renderWorldSurface(sample);
  const key = `world-play-surface-${sample.seed}-${sample.profile.id}`;
  const texture = scene.textures.createCanvas(key, surface.width, surface.height);
  if (!texture) throw new Error('Could not create world play surface texture');
  const reflectionKey = `${key}-reflection`;
  const objects: Phaser.GameObjects.Image[] = [];
  const keys = [key, reflectionKey];
  const extent = 260, size = extent * 2;
  let reflection: Phaser.Textures.CanvasTexture;
  let reflected: Phaser.GameObjects.Image;
  try {
    const pixels = texture.context.createImageData(surface.width, surface.height);
    pixels.data.set(surface.rgba); texture.context.putImageData(pixels, 0, 0); texture.refresh();
    objects.push(scene.add.image(0, 0, key).setOrigin(0).setDepth(0));
    const canvas = scene.textures.createCanvas(reflectionKey, size, size);
    if (!canvas) throw new Error('Could not create local material reflection texture');
    reflection = canvas;
    reflected = scene.add.image(0, 0, reflectionKey).setOrigin(0).setDepth(1); objects.push(reflected);
  } catch (reason) {
    objects.forEach(object => object.destroy());
    keys.forEach(value => { if (scene.textures.exists(value)) scene.textures.remove(value); });
    throw reason;
  }
  let destroyed = false, updatedMs = -Infinity, reflectionPixels = 0;
  const point = { x: 0, y: 0 };
  return { update() {}, afterUpdate(elapsedMs) {
    if (destroyed || context.isRunEnded() || elapsedMs - updatedMs < 1000 / 15) return;
    updatedMs = elapsedMs;
    const player = context.player.getPosition(), left = Math.floor(player.x) - extent, top = Math.floor(player.y) - extent;
    const ctx = reflection.context;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(-left, -top);
    paintMaterialLight(ctx, sample, player.x, player.y, elapsedMs / 1000); ctx.restore();
    const pixels = ctx.getImageData(0, 0, size, size), rgba = pixels.data;
    reflectionPixels = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const alpha = (y * size + x) * 4 + 3;
      if (!rgba[alpha]) continue;
      point.x = left + x + .5; point.y = top + y + .5;
      if (!worldSupportAt(sample, point.x, point.y) || context.visibilityAt(point) <= 0) rgba[alpha] = 0;
      else reflectionPixels++;
    }
    ctx.putImageData(pixels, 0, 0); reflection.refresh(); reflected.setPosition(left, top);
  }, snapshot: () => ({ footprint: context.getFootprint(), reflectionPixels, reflectionUpdatedMs: updatedMs,
    textureCount: scene.textures.getTextureKeys().filter(value => value.startsWith('world-play-surface-')).length,
    phaserFps: scene.game.loop.actualFps }),
  inspectPoint: point => ({ support: worldSupportAt(sample, point.x, point.y), visibility: context.visibilityAt(point) }),
  destroy() {
    if (destroyed) return; destroyed = true;
    objects.forEach(object => object.destroy());
    keys.forEach(value => { if (scene.textures.exists(value)) scene.textures.remove(value); });
  } };
}
