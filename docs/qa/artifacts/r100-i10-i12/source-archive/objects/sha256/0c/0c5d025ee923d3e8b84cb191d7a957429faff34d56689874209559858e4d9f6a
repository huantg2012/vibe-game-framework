import type Phaser from 'phaser';
import type { FormFlashSource } from '@/entities/form-renderers/form-renderer';
import { runtimeNumber, runtimeInteger, runtimeRecord } from '@/systems/ai/runtime-validation';
import type { Vector2 } from '@/types/game-types';

export type BodyEchoMode = 'mirror' | 'memory' | 'freeze' | 'phase';
export interface BodyEchoSource extends FormFlashSource { readonly frame?: string | number }
export interface BodyEcho {
  update(position: Readonly<Vector2>, progress: number, depth: number): void;
  destroy(): void;
  exportRuntimeState(): BodyEchoRuntimeState;
}
let serial = 0;

export interface BodyEchoRuntimeState {
  readonly mode: BodyEchoMode;
  readonly width: number; readonly height: number;
  readonly originX: number; readonly originY: number;
  readonly scaleX: number; readonly scaleY: number;
  /** Original immutable visible pose, never a reference to a moving actor texture. */
  readonly rgba: string;
}
export function validateBodyEchoRuntimeState(value: unknown): value is BodyEchoRuntimeState {
  if (!runtimeRecord(value) || !['mirror','memory','freeze','phase'].includes(value.mode as string)
    || !runtimeInteger(value.width, 1, 512) || !runtimeInteger(value.height, 1, 512)
    || !runtimeNumber(value.originX, -10, 10) || !runtimeNumber(value.originY, -10, 10)
    || !runtimeNumber(value.scaleX, -100, 100) || !runtimeNumber(value.scaleY, -100, 100)
    || typeof value.rgba !== 'string' || value.rgba.length !== Math.ceil(value.width * value.height * 4 / 3) * 4
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.rgba)) return false;
  try { return atob(value.rgba).length === value.width * value.height * 4; } catch { return false; }
}
/** Independent, immutable copies of the actual visible pose. Never reads a live target on update. */
export function captureBodyEcho(scene: Phaser.Scene, source: BodyEchoSource, mode: BodyEchoMode): BodyEcho | null {
  if (!scene.textures?.exists(source.textureKey)) return null;
  const frame = scene.textures.getFrame(source.textureKey, source.frame);
  if (!frame?.source?.image || !frame.realWidth || !frame.realHeight) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = frame.realWidth; canvas.height = frame.realHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      frame.x, frame.y, frame.cutWidth, frame.cutHeight);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let bytes = ''; for (const byte of pixels) bytes += String.fromCharCode(byte);
    return restoreBodyEcho(scene, { mode, width:canvas.width, height:canvas.height,
      originX:source.originX, originY:source.originY, scaleX:source.scaleX??1, scaleY:source.scaleY??1, rgba:btoa(bytes) });
  } catch { return null; }
}
export function restoreBodyEcho(scene: Phaser.Scene, saved: BodyEchoRuntimeState | null): BodyEcho | null {
  if (!saved || !validateBodyEchoRuntimeState(saved)) return null;
  const snapshot = { ...saved };
  const {width,height,mode} = snapshot;
  const source = snapshot;
  const keys: string[] = [];
  const layers: Phaser.GameObjects.Image[] = [];
  let disposed = false;
  const destroy = (): void => {
    if (disposed) return;
    disposed = true;
    scene.events?.off('shutdown', destroy);
    scene.events?.off('destroy', destroy);
    layers.forEach(layer => layer.destroy());
    keys.forEach(key => { if (scene.textures.exists(key)) scene.textures.remove(key); });
  };
  try {
    const bytes = atob(snapshot.rgba);
    const pixels = Uint8ClampedArray.from(bytes, byte => byte.charCodeAt(0));
    let top = height, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3]! > 24) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    const foot = bottom - (bottom - top) * .2;
    for (let band = 0; band < 3; band++) {
      const key = `tool-body-${++serial}`;
      const texture = scene.textures.createCanvas(key, width, height);
      if (!texture) { destroy(); return null; }
      keys.push(key);
      const ctx = texture.context;
      const output = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (pixels[index + 3]! < 24) continue;
        const cluster = ((Math.floor(x / 3) * 17 + Math.floor(y / 3) * 29) % 13);
        const layer = y >= foot ? 0 : Math.floor((y - top + Math.floor(x / 4) % 3) / 5) % 3;
        if (layer !== band) continue;
        if (mode === 'mirror' && cluster < 3 || mode === 'memory' && cluster < 6) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
          || !pixels[index - 4 + 3] || !pixels[index + 4 + 3]
          || !pixels[index - width * 4 + 3] || !pixels[index + width * 4 + 3];
        if (mode === 'freeze' && (!edge || cluster < 4) && (y + Math.floor(x / 4)) % 13 !== 0) continue;
        const light = (pixels[index]! * .3 + pixels[index + 1]! * .5 + pixels[index + 2]! * .2) / 255;
        const level = Math.floor(light * 3) / 3;
        const base = mode === 'freeze' ? 96 : mode === 'memory' ? 42 : 56;
        output.data[index] = base + level * 52;
        output.data[index + 1] = base + 17 + level * 65;
        output.data[index + 2] = base + 12 + level * 55;
        output.data[index + 3] = pixels[index + 3]!;
      }
      ctx.putImageData(output, 0, 0); texture.refresh();
      layers.push(scene.add.image(0, 0, key).setOrigin(source.originX, source.originY)
        .setScale(source.scaleX ?? 1, source.scaleY ?? 1).setVisible(false));
    }
    scene.events?.once('shutdown', destroy);
    scene.events?.once('destroy', destroy);
    return {
      destroy,
      exportRuntimeState: () => ({ ...snapshot }),
      update(position, progress, depth) {
        if (disposed) return;
        const p = Math.max(0, Math.min(1, progress));
        const fade = mode === 'phase' ? Math.min(1, (1 - p) / .15)
          : mode === 'freeze' ? Math.min(1, (1 - p) / .08) : Math.min(1, (1 - p) / .16);
        layers.forEach((layer, band) => {
          const offset = band === 0 ? 0 : (band === 1 ? -1 : 1);
          const shift = mode === 'phase' ? Math.round(offset * 4 * (1 - p) ** 2) : offset;
          layer.setPosition(Math.round(position.x) + shift, Math.round(position.y))
            .setDepth(depth + band * .001).setVisible(fade > 0)
            .setAlpha(fade * (mode === 'memory' ? .52 : mode === 'freeze' ? .78 : .72));
        });
      },
    };
  } catch {
    destroy(); return null; // Missing canvas support must never block or consume a skill differently.
  }
}
