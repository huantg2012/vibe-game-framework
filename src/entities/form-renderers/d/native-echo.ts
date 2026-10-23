/** Delayed, displaced pressure folds. No rectangular deposit or gas density. */
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import type { DingRecipe } from './ding-recipe';
import type { CloudPose } from './ding-cloud';
import type { NativeVolumeAppearance } from './native-volume-paint';
import { activityOf, stageOf } from './environment-pixels';
import { volumeLight } from './volume-light';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const TAU = Math.PI * 2;
export function paintNativeEcho(out: Uint8ClampedArray, w: number, h: number, recipe: DingRecipe,
  pose: FormVisualPose, elapsedMs: number, box: CloudPose, appearance: NativeVolumeAppearance): void {
  out.fill(0);
  const stage = stageOf(recipe.coverage), active = activityOf(pose), opacity = .5 + active * .5;
  const time = active > 0 ? elapsedMs / 6000 : 0, clock = time * TAU, phase = recipe.seed * .37;
  const m = appearance.material, colors = [m.dark, m.mid, m.light, m.secondary];
  const lightAt = volumeLight(appearance.lighting, w, h, pose.x - w / 2, pose.y - h / 2);
  const x0 = Math.max(0, Math.ceil(box.cx - box.rx)), x1 = Math.min(w, Math.floor(box.cx + box.rx));
  const y0 = Math.max(0, Math.ceil(box.cy - box.ry)), y1 = Math.min(h, Math.floor(box.cy + box.ry));
  const pitch = m.kind === 'fibre' ? 5 : m.kind === 'slab' ? 3 : m.kind === 'granular' ? 7 : 4;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const dx = (Math.floor(x / 2) * 2 - box.cx) / Math.max(1, box.rx);
    const dy = (Math.floor(y / 2) * 2 - box.cy) / Math.max(1, box.ry);
    const angle = Math.atan2(dy, dx);
    // Shear displaces successive fronts. Angular seams break the loops into
    // overlapping scars, not circular radar lines or a crisp danger boundary.
    const shear = Math.sin(dy * 3.4 + clock + phase) * (.11 + stage * .035);
    const radius = Math.hypot(dx + shear, dy * 1.12);
    const warp = Math.sin(angle * 3 + phase + clock) * .12
      + Math.sin(angle * pitch - clock * 2) * .048;
    const travelling = (radius + warp) * (3.1 + stage * .55) - time * 3;
    const crest = travelling - Math.floor(travelling);
    const seam = Math.sin(angle * (3 + stage) + radius * 4 + phase - clock);
    const edge = clamp(Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) / 8);
    const extent = clamp((1.32 - radius) * 4);
    let band = 0, alpha = 0;
    if (seam > -.65) {
      if (crest < .11) { band = 2; alpha = 235; }
      else if (crest < .28) { band = 0; alpha = 226; }
      else if (crest < .39 && stage > 0) { band = 1; alpha = 152; }
      // Separated after-images repeat at a different phase and offset.
      else if (crest > .75 && crest < .82 && seam > .15) { band = 3; alpha = 150; }
    }
    alpha *= edge * extent;
    if (alpha < 1) continue;
    const color = colors[band]!, light = lightAt(x, y), shade = band === 0 ? .55 : 1;
    const i = (y * w + x) * 4;
    out[i] = color[0] * light[0] * shade; out[i + 1] = color[1] * light[1] * shade;
    out[i + 2] = color[2] * light[2] * shade; out[i + 3] = alpha * opacity;
  }
  if (recipe.paintStrikeCore) {
    const r = Math.max(1, Math.ceil(recipe.strikeCorePx / 2));
    const cx = Math.round(box.cx), cy = Math.round(box.cy);
    for (let y = Math.max(y0, cy - r); y <= Math.min(y1 - 1, cy + r); y++) for (let x = Math.max(x0, cx - r); x <= Math.min(x1 - 1, cx + r); x++) {
      if (Math.abs(x - cx) + Math.abs(y - cy) > r + 1) continue;
      const light = lightAt(x, y), i = (y * w + x) * 4;
      out[i] = m.secondary[0] * light[0]; out[i + 1] = m.secondary[1] * light[1];
      out[i + 2] = m.secondary[2] * light[2]; out[i + 3] = 245 * opacity;
    }
  }
}
