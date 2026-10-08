/** Reflected light only; caller applies the same land/LOS mask afterwards. */
import { groundMaterialHighlights } from './material-response';
import type { WorldSample } from './types';

export function paintMaterialLight(ctx: CanvasRenderingContext2D, sample: WorldSample, playerX: number, playerY: number, timeSeconds: number): void {
  const inheritedAlpha = ctx.globalAlpha;
  for (const face of groundMaterialHighlights(sample)) {
    const dx = playerX - face.x, dy = playerY - face.y, distance = Math.hypot(dx, dy);
    if (distance > 260 || distance < 8) continue;
    const alignment = (dx * Math.cos(face.normal) + dy * Math.sin(face.normal)) / distance;
    if (alignment < .48) continue;
    const glint = Math.pow((alignment - .48) / .52, face.sharpness);
    ctx.globalAlpha = inheritedAlpha * face.strength * glint * (.985 + Math.sin(timeSeconds * .35) * .015);
    ctx.fillStyle = `#${face.color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(face.x, face.y, face.width, face.height);
  }
  ctx.globalAlpha = inheritedAlpha;
}
