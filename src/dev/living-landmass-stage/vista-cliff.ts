import * as THREE from 'three';
import { sampleVistaSections, type VistaSection } from './vista-sections';
import { sampleVistaStrata, type VistaStratum } from './vista-strata';
import type { VistaBoundaryVertex } from './vista-terrain';

/** A worn lip, broad cut face and tapering base. Their joints wander locally;
 * no horizontal material band closes around the entire landmass. */
export function createVistaCliff(outlines: readonly (readonly VistaBoundaryVertex[])[], strata: readonly VistaStratum[] = [], sections: readonly VistaSection[] = []): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [], uv: number[] = [], colors: number[] = [];
  for (let ring = 0; ring < outlines.length; ring++) {
    const outline = outlines[ring]!, points = outline;
    // Lower rings are affine contractions of the complete authored body.
    // Local inset normals at tiny wear corners fold through one another and
    // create hanging slivers. This preserves each ring's ordered topology.
    const center = outline.reduce((sum, p) => ({ x: sum.x + p.x / outline.length,
      y: sum.y + p.y / outline.length }), { x: 0, y: 0 });
    const offset = positions.length / 3, count = points.length;
    let distance = 0;
    for (let i = 0; i < count; i++) {
      const p = points[i]!, next = points[(i + 1) % count]!;
      const phase = p.x / 371 + p.y / 487 + ring * 2.1;
      const bed = sampleVistaStrata(p.x, p.y, strata);
      const section = sampleVistaSections(p.x, p.y, ring, sections);
      const thickness = 92 + Math.max(0, bed.height) * 1.4 + section.thickness * .5;
      const lip = .065 + bed.fracture * .10;
      const shoulder = .34 + Math.sin(phase + .8) * .07;
      const base = .79 + Math.sin(phase * .93 + 1.9) * .06;
      const ledgeTop = Math.min(shoulder * .74, lip + section.drop / thickness);
      const ledgeBase = Math.min(base * .83, Math.max(shoulder, ledgeTop + section.thickness / thickness));
      const fractions = [0, ledgeTop, ledgeBase, base, 1];
      // Local wedges emerge only in selected spans; the rest is one plain cut.
      const contraction = [0, .001, .010, .026, .043];
      for (let row = 0; row < fractions.length; row++) {
        const z = p.height - thickness * fractions[row]!;
        const inset = contraction[row]! * (ring ? -.8 : 1);
        const projection = row === 1 ? 1 : row === 2 ? .74 : 0;
        positions.push(p.x + (center.x - p.x) * inset + section.offsetX * projection,
          z, p.y + (center.y - p.y) * inset + section.offsetY * projection);
        // Cut-face trim follows the entire depth once: warm chipped crust at
        // the lip, dense inner material below. It never reuses the ground atlas.
        uv.push(distance / 620, 1 - fractions[row]!);
        const shade = [1, .94, .83, .79, .76][row]!;
        const variation = 1 + Math.sin(phase * .51) * .025;
        colors.push(shade * variation, shade * .99 * variation, shade * 1.025 * variation);
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
