import * as THREE from 'three';
import type { VistaBoundaryVertex } from './vista-terrain';

/** A worn lip, broad cut face and tapering base. Their joints wander locally;
 * no horizontal material band closes around the entire landmass. */
export function createVistaCliff(outlines: readonly (readonly VistaBoundaryVertex[])[]): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [], uv: number[] = [], colors: number[] = [];
  for (let ring = 0; ring < outlines.length; ring++) {
    const outline = outlines[ring]!, points = outline;
    let area = 0;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
      area += a.x * b.y - a.y * b.x;
    }
    const outwardSign = (area > 0 ? 1 : -1) * (ring ? -1 : 1);
    const offset = positions.length / 3, count = points.length;
    let distance = 0;
    for (let i = 0; i < count; i++) {
      const p = points[i]!, previous = points[(i + count - 1) % count]!, next = points[(i + 1) % count]!;
      const tx = next.x - previous.x, ty = next.y - previous.y, length = Math.hypot(tx, ty);
      const nx = ty / length * outwardSign, ny = -tx / length * outwardSign;
      const phase = p.x / 137 + p.y / 193 + ring * 2.1;
      const thickness = (ring ? 77.76 : 108) * (1 + Math.sin(phase) * .13 + Math.sin(phase * 2.37) * .07);
      const lip = .11 + Math.sin(phase * 1.71) * .045;
      const shoulder = .27 + Math.sin(phase + .8) * .075;
      const base = .79 + Math.sin(phase * .93 + 1.9) * .06;
      const fractions = [0, lip, shoulder, base, 1];
      // Local wedges emerge only in selected spans; the rest is one plain cut.
      const projectingPlate = Math.max(0, Math.sin(phase * .72 + .5) - .75) * 40;
      const offsets = [0, 4 + projectingPlate, -4 + projectingPlate * .25, -12 - Math.sin(phase) * 6, -22 - Math.cos(phase * 1.3) * 7];
      for (let row = 0; row < fractions.length; row++) {
        const z = p.height - thickness * fractions[row]!;
        positions.push(p.x + nx * offsets[row]!, z, p.y + ny * offsets[row]!);
        uv.push(distance / 744, (z + Math.sin(distance / 220) * 28) / 744);
        const shade = [1, .94, .83, .79, .76][row]!;
        const variation = 1 + Math.sin(phase * .51) * .025;
        colors.push(shade * variation, shade * .97 * variation, shade * .93 * variation);
        if (i) {
          const a = offset + (i - 1) * 5 + row, b = offset + i * 5 + row;
          if (row < 4) indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      distance += Math.hypot(next.x - p.x, next.y - p.y);
    }
    for (let row = 0; row < 4; row++) {
      const a = offset + (count - 1) * 5 + row, b = offset + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
