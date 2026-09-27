import { lastLightBasis, projectLastLight } from './last-light-spatial';
import type { LastLightFrame, LastLightImage, LastLightRenderPack, LastLightRenderState } from './last-light-renderer';

const pixels = (image: LastLightImage): HTMLCanvasElement => {
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const ctx = c.getContext('2d')!;
  if (image instanceof ImageBitmap) { ctx.translate(0, c.height); ctx.scale(1, -1); }
  ctx.drawImage(image, 0, 0); return c;
};
/** Explicit compatibility mode: it keeps controls, action frames and real
 * opaque-depth ordering available when WebGL2 is unavailable. It does not claim
 * the source-light/atmosphere fidelity of the normal production compositor. */
export class LastLightFallback {
  readonly canvas: HTMLCanvasElement;
  readonly actorBounds = { x: 0, y: 0, width: 0, height: 0 };
  readonly lampPosition = { x: 0, y: 0 };
  private readonly context: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly actor: HTMLCanvasElement;
  private readonly actorPixels: Uint8ClampedArray;
  private readonly actorDepth: Uint8ClampedArray;
  private readonly depth: Uint8ClampedArray;
  private readonly volumeDepth: Uint8ClampedArray;
  private readonly energy: Uint8ClampedArray;
  private readonly energyBounds: { x: number; y: number; width: number; height: number };
  private readonly patch = document.createElement('canvas');
  private readonly basis;
  private current?: LastLightFrame;
  constructor(private readonly pack: LastLightRenderPack, base: LastLightImage, actor: LastLightImage) {
    this.canvas = document.createElement('canvas'); this.canvas.width = pack.camera.width; this.canvas.height = pack.camera.height;
    this.context = this.canvas.getContext('2d')!; this.context.imageSmoothingEnabled = false;
    this.base = pixels(base); this.actor = pixels(actor); this.basis = lastLightBasis(pack.camera);
    this.actorPixels = this.actor.getContext('2d')!.getImageData(0, 0, actor.width, actor.height).data;
    const ad = pixels(pack.images.actorDepth), d = pixels(pack.images.depth);
    this.actorDepth = ad.getContext('2d')!.getImageData(0, 0, ad.width, ad.height).data;
    this.depth = d.getContext('2d')!.getImageData(0, 0, d.width, d.height).data;
    const volume = pixels(pack.images.volumeDepth), energy = pixels(pack.images.energy);
    this.volumeDepth = volume.getContext('2d')!.getImageData(0, 0, volume.width, volume.height).data;
    // Compatibility mode keeps frame-zero density. Canvas cannot retain the
    // zero-alpha additive halo; that fidelity remains exclusive to WebGL.
    this.energy = energy.getContext('2d')!.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    let left = this.canvas.width, top = this.canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < this.canvas.height; y++) for (let x = 0; x < this.canvas.width; x++) {
      const i = (y * this.canvas.width + x) * 4;
      if (!(this.energy[i]! + this.energy[i + 1]! + this.energy[i + 2]! + this.energy[i + 3]!)) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    this.energyBounds = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }
  draw(state: LastLightRenderState): void {
    const pose=state.gaitPose,phase=state.gaitFrame;
    const candidates = this.pack.frames.filter(frame => frame.pose === pose);
    let score = Infinity, selected = candidates[0]!;
    for (const frame of candidates) {
      const rank = Math.abs(Math.atan2(Math.sin(frame.yaw - state.yaw), Math.cos(frame.yaw - state.yaw))) * 100 + Math.abs(frame.phase - phase);
      if (rank < score) { score = rank; selected = frame; }
    }
    this.current = selected;
    const p = projectLastLight(state.world, this.pack.camera, this.basis), frame = selected;
    const x = Math.round(p[0] - frame.anchor[0]), y = Math.round(p[1] - frame.anchor[1]);
    const lamp = projectLastLight([state.world[0] + frame.lamp[0], state.world[1] + frame.lamp[1], state.world[2] + frame.lamp[2]], this.pack.camera, this.basis);
    this.lampPosition.x = lamp[0]; this.lampPosition.y = lamp[1];
    this.context.drawImage(this.base, 0, 0);
    if (this.patch.width !== frame.width || this.patch.height !== frame.height) { this.patch.width = frame.width; this.patch.height = frame.height; }
    const ctx = this.patch.getContext('2d')!, data = ctx.createImageData(frame.width, frame.height);
    let left = frame.width, top = frame.height, right = 0, bottom = 0;
    for (let yy = 0; yy < frame.height; yy++) for (let xx = 0; xx < frame.width; xx++) {
      const px = x + xx, py = y + yy;
      if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) continue;
      const a = ((frame.y + yy) * this.actor.width + frame.x + xx) * 4, d = (py * this.canvas.width + px) * 4;
      if (!this.actorPixels[a + 3]) continue;
      left = Math.min(left, xx); top = Math.min(top, yy); right = Math.max(right, xx + 1); bottom = Math.max(bottom, yy + 1);
      const relative = (this.actorDepth[a]! * 256 + this.actorDepth[a + 1]!) / this.pack.actorDepthScale - this.pack.actorDepthOffset;
      const fixed = (this.depth[d]! * 256 + this.depth[d + 1]!) / 256 - 80;
      if (p[2] + relative <= fixed + .006) continue;
      const o = (yy * frame.width + xx) * 4;
      for (let channel = 0; channel < 4; channel++) data.data[o + channel] = this.actorPixels[a + channel]!;
    }
    Object.assign(this.actorBounds, { x: x + left, y: y + top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    ctx.putImageData(data, 0, 0); this.context.drawImage(this.patch, x, y);
    const bounds = this.energyBounds;
    if (!bounds.width || !bounds.height) return;
    const composite = this.context.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
    for (let yy = 0; yy < bounds.height; yy++) for (let xx = 0; xx < bounds.width; xx++) {
      const px = bounds.x + xx, py = bounds.y + yy, i = (py * this.canvas.width + px) * 4;
      let front = (this.depth[i]! * 256 + this.depth[i + 1]!) / 256 - 80;
      const localX = px - x, localY = py - y;
      if (localX >= 0 && localY >= 0 && localX < frame.width && localY < frame.height && data.data[(localY * frame.width + localX) * 4 + 3]) {
        const a = ((frame.y + localY) * this.actor.width + frame.x + localX) * 4;
        front = p[2] + (this.actorDepth[a]! * 256 + this.actorDepth[a + 1]!) / this.pack.actorDepthScale - this.pack.actorDepthOffset;
      }
      const volume = (this.volumeDepth[i]! * 256 + this.volumeDepth[i + 1]!) / 256 - 80;
      if (this.volumeDepth[i + 3]! > 127 && volume <= front + .006) continue;
      const o = (yy * bounds.width + xx) * 4, alpha = this.energy[i + 3]! / 255;
      for (let k = 0; k < 3; k++) composite.data[o + k] = composite.data[o + k]! * (1 - alpha) + this.energy[i + k]! * (.25 + .75 * state.health[0]);
    }
    this.context.putImageData(composite, bounds.x, bounds.y);
  }
  portrait(): string {
    const frame = this.current ?? this.pack.frames[0]!;
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.actor, frame.x, frame.y, frame.width, frame.height, 16, 8, 64, 80);
    return canvas.toDataURL();
  }
  destroy(): void { this.canvas.width = 0; this.patch.width = 0; }
}
