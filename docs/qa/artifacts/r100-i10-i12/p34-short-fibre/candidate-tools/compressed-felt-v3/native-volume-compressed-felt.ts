/** Compressed short fibres have grouped surface volume as well as painted
 * detail. This construction is deliberately separate from the approved wedge.
 * Its bundles stay inside that wedge's original XY support and maximum height. */
import type { Builder, Point, UV } from './native-volume-expansion';
import { buildCompressedWedge } from './native-volume-organization';

interface SurfaceTriangle { readonly a: Point; readonly b: Point; readonly c: Point }
interface FibreGroup { readonly x: number; readonly y: number; readonly angle: number; readonly branches: number }
export interface CompressedFeltBuildStats { readonly groups: number; readonly branches: number }

// Unequal gatherings, not rows: each root releases two or three short fibres.
// Positions scale with the parent; the visible fibres retain a physical width.
const GROUPS: readonly FibreGroup[] = [
  { x: -.31, y: -.15, angle: .35, branches: 3 },
  { x: -.28, y: .16, angle: -.40, branches: 2 },
  { x: -.08, y: .28, angle: -.76, branches: 3 },
  { x: .15, y: .20, angle: -1.0, branches: 2 },
  { x: .24, y: .01, angle: 2.25, branches: 3 },
  { x: .18, y: -.20, angle: 2.76, branches: 2 },
  { x: -.025, y: -.25, angle: .65, branches: 3 },
  { x: -.32, y: -.31, angle: .05, branches: 2 },
  { x: .04, y: -.055, angle: 1.04, branches: 3 },
  { x: -.15, y: .075, angle: -.08, branches: 2 },
];

function heightAt(triangles: readonly SurfaceTriangle[], x: number, y: number): number | undefined {
  let highest: number | undefined;
  for (const { a, b, c } of triangles) {
    const dx = b[0] - a[0], dy = b[1] - a[1], ex = c[0] - a[0], ey = c[1] - a[1];
    const determinant = dx * ey - dy * ex;
    if (Math.abs(determinant) < 1e-9) continue;
    const px = x - a[0], py = y - a[1];
    const u = (px * ey - py * ex) / determinant, v = (dx * py - dy * px) / determinant;
    if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) continue;
    const z = a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
    if (highest === undefined || z > highest) highest = z;
  }
  return highest;
}

/** Build-time only. The unchanged parent owns support and light fractures.
 * Narrow curved fibres rise from its skin, meet at uneven roots, and part at
 * short sloped tips. Their UVs run along each branch instead of global XY. */
export function buildCompressedFelt(b: Builder): CompressedFeltBuildStats {
  const skin: SurfaceTriangle[] = [], protectedFaces: SurfaceTriangle[] = [];
  let ceiling = 0;
  buildCompressedWedge({
    spec: b.spec,
    quad(a, c, d, e, material, coordinates, wanted, region) {
      b.quad(a, c, d, e, material, coordinates, wanted, region);
      ceiling = Math.max(ceiling, a[2], c[2], d[2], e[2]);
      const destination = material === 3 ? protectedFaces : skin;
      destination.push({ a, b: c, c: d }, { a, b: d, c: e });
    },
    joint: point => b.joint(point),
  });
  const s = b.spec;
  let groupCount = 0, branchCount = 0;
  for (let index = 0; index < GROUPS.length; index++) {
    const group = GROUPS[index]!;
    let accepted = 0;
    for (let branch = 0; branch < group.branches; branch++) {
      const spread = branch - (group.branches - 1) * .5;
      const angle = group.angle + spread * (.21 + index % 3 * .055);
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      const length = 12 + (index * 7 + branch * 5) % 13;
      const width = 3.2 + (index * 3 + branch * 7) % 9 * .2;
      const rise = Math.min(2.25 + (index + branch * 3) % 4 * .2, s.height * .065);
      const bend = (index % 2 ? -1 : 1) * (2.0 + branch * .7);
      const originX = group.x * s.length - spread * .70 * Math.sin(group.angle);
      const originY = group.y * s.width + spread * .70 * Math.cos(group.angle);
      const rows: Point[][] = [], coordinates: UV[][] = [];
      let supported = true;
      for (let step = 0; step < 3; step++) {
        const t = step * .5, bow = Math.sin(t * Math.PI) * bend;
        const dx = length * cosine - Math.PI * Math.cos(t * Math.PI) * bend * sine;
        const dy = length * sine + Math.PI * Math.cos(t * Math.PI) * bend * cosine;
        const norm = Math.hypot(dx, dy), normalX = -dy / norm, normalY = dx / norm;
        const cx = originX + t * length * cosine - bow * sine;
        const cy = originY + t * length * sine + bow * cosine;
        const row: Point[] = [], uvRow: UV[] = [];
        for (let across = 0; across < 3; across++) {
          const side = across - 1, halfWidth = width * .5 * (step === 0 ? 0 : step === 1 ? 1 : .74);
          // End centre retreats to expose a tiny sloping terminal, while the
          // two side tips remain on the parent skin. No footprint extension.
          const retreat = step === 2 && side === 0 ? 1.15 : 0;
          const x = cx + side * halfWidth * normalX - retreat * cosine;
          const y = cy + side * halfWidth * normalY - retreat * sine;
          const base = heightAt(skin, x, y);
          if (base === undefined || heightAt(protectedFaces, x, y) !== undefined) { supported = false; break; }
          row.push([x, y, Math.min(ceiling, base + (side === 0 && step > 0 ? rise * (step === 2 ? .72 : 1) : 0))]);
          uvRow.push([originX + t * length - retreat, originY + side * halfWidth]);
        }
        if (!supported) break;
        rows.push(row); coordinates.push(uvRow);
      }
      if (!supported) continue;
      const points = rows.flat(), minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
      const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
      if (protectedFaces.some(({ a, b: c, c: d }) => Math.max(a[0], c[0], d[0]) >= minX && Math.min(a[0], c[0], d[0]) <= maxX
        && Math.max(a[1], c[1], d[1]) >= minY && Math.min(a[1], c[1], d[1]) <= maxY)) continue;
      const x = originX + length * cosine, y = originY + length * sine;
      const base = heightAt(skin, x, y);
      if (base === undefined || heightAt(protectedFaces, x, y) !== undefined) continue;
      for (let step = 0; step < 2; step++) for (let across = 0; across < 2; across++) {
        b.quad(rows[step]![across]!, rows[step + 1]![across]!, rows[step + 1]![across + 1]!, rows[step]![across + 1]!, 0,
          [coordinates[step]![across]!, coordinates[step + 1]![across]!, coordinates[step + 1]![across + 1]!, coordinates[step]![across + 1]!], [0, 0, 1], 1);
      }
      const end = rows[2]!, endUV = coordinates[2]!;
      const tip: Point = [x, y, base], tipUV: UV = [originX + length, originY];
      b.quad(end[0]!, end[1]!, tip, end[0]!, 1, [endUV[0]!, endUV[1]!, tipUV, endUV[0]!], [0, 0, 1], 3);
      b.quad(end[1]!, end[2]!, tip, end[1]!, 1, [endUV[1]!, endUV[2]!, tipUV, endUV[1]!], [0, 0, 1], 3);
      branchCount++; accepted++;
    }
    if (accepted > 0) groupCount++;
  }
  return { groups: groupCount, branches: branchCount };
}
