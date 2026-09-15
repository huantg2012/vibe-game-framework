import { noise } from '../spatial-study/stage/materials';
import type { VistaPoint } from './vista-terrain';

/** Authored large turns remain authoritative. Only the wear between them is
 * generated: short rounded corners, long quiet edges and occasional chips.
 * The returned polygon owns the mesh AND the physical mask. */
export function shapeVistaBoundary(outline: readonly VistaPoint[], seed: number): VistaPoint[] {
  const corners = outline.map((p, i) => {
    const previous = outline[(i + outline.length - 1) % outline.length]!;
    const next = outline[(i + 1) % outline.length]!;
    const cut = 4 + noise(i, 1, seed) * 6;
    const before = Math.min(.12, cut / Math.hypot(previous.x - p.x, previous.y - p.y));
    const after = Math.min(.12, cut / Math.hypot(next.x - p.x, next.y - p.y));
    return { p, start: { x: p.x + (previous.x - p.x) * before, y: p.y + (previous.y - p.y) * before },
      end: { x: p.x + (next.x - p.x) * after, y: p.y + (next.y - p.y) * after } };
  });
  const result: VistaPoint[] = [];
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i]!, next = corners[(i + 1) % corners.length]!;
    for (let j = 0; j < 3; j++) {
      const t = j / 3, s = 1 - t;
      result.push({ x: s * s * corner.start.x + 2 * s * t * corner.p.x + t * t * corner.end.x,
        y: s * s * corner.start.y + 2 * s * t * corner.p.y + t * t * corner.end.y });
    }
    result.push(corner.end);
    const dx = next.start.x - corner.end.x, dy = next.start.y - corner.end.y, length = Math.hypot(dx, dy);
    const intervals = Math.max(1, Math.round(length / (75 + noise(i, 2, seed) * 40)));
    for (let j = 1; j < intervals; j++) {
      const t = j / intervals;
      const chip = (noise(i, j, seed + 14) - .5) * 2;
      const offset = Math.abs(chip) > .62 ? Math.sign(chip) * (4 + Math.abs(chip) * 7) : 0;
      result.push({ x: corner.end.x + dx * t - dy / length * offset,
        y: corner.end.y + dy * t + dx / length * offset });
    }
  }
  return result;
}
