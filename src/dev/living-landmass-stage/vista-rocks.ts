import * as THREE from 'three';
import { noise } from '../spatial-study/stage/materials';
import type { VistaPoint } from './vista-terrain';

export type VistaRockKind = 'shell' | 'ridge' | 'plates' | 'debris';
export interface VistaRockDefinition extends VistaPoint {
  readonly id: string;
  readonly radius: number;
  readonly height: number;
  readonly kind: VistaRockKind;
  readonly yaw: number;
}
export interface VistaRockGeometry {
  readonly geometry: THREE.BufferGeometry;
  readonly footprints: VistaPoint[][];
  readonly landmarkCount: number;
  readonly pieceCount: number;
}

/** Wide mineral forms with broad faces and a small rounded bevel. All visible
 * pieces share this mesh; the identical basal loops create physical obstacles. */
export function createVistaRocks(rocks: readonly VistaRockDefinition[], heightAt: (x: number, y: number) => number,
  contains: (x: number, y: number) => boolean): VistaRockGeometry {
  const positions: number[] = [], indices: number[] = [], uv: number[] = [], colors: number[] = [];
  const footprints: VistaPoint[][] = [];
  const sides = 20;
  const piece = (x: number, y: number, radius: number, height: number, kind: VistaRockKind, yaw: number, seed: number): void => {
    const angle = yaw * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const long = kind === 'ridge' ? 1.05 : 1, short = kind === 'ridge' ? .50 : .59;
    const footprint = Array.from({ length: sides }, (_, i) => {
      const a = i / sides * Math.PI * 2;
      const wear = 1 + Math.cos(a * 3 + seed) * .065 + Math.sin(a * 5 + seed * .7) * .025;
      const px = Math.cos(a) * radius * long * wear;
      const roundedY = Math.sin(a) * radius * short * wear;
      // One exposed broad cut face interrupts the worn shell curve. This
      // chord is geometric, not a painted fake edge or random polygon tint.
      const py = kind === 'shell' || kind === 'ridge' ? Math.min(roundedY, radius * short * .64) : roundedY;
      return { x: x + px * cos - py * sin, y: y + px * sin + py * cos };
    });
    if (footprint.some(p => !contains(p.x, p.y))) {
      if (radius < 15) return;
      throw new Error(`Vista landmark lacks terrain support at ${x},${y}`);
    }
    footprints.push(footprint);
    const offset = positions.length / 3;
    const heights = kind === 'shell' ? [0, .14, .72, .92, 1] : [0, .14, .76, .92, 1];
    const scales = kind === 'shell' ? [1, .98, .95, .84, .80] : [1, .98, .96, .86, .82];
    for (let row = 0; row < heights.length; row++) for (let i = 0; i < sides; i++) {
      const p = footprint[i]!, t = heights[row]!, scale = scales[row]!;
      const longitudinal = ((p.x - x) * cos + (p.y - y) * sin) / radius;
      const tilt = kind === 'ridge' ? longitudinal * .20 : longitudinal * -.09;
      const px = x + (p.x - x) * scale + radius * t * .06 * cos;
      const py = y + (p.y - y) * scale + radius * t * .06 * sin;
      positions.push(px, heightAt(px, py) + height * t * (1 + tilt), py);
      uv.push((px + height * t * .23) / 744, (py + height * t) / 744);
      // Pigment follows complete planes, never a random triangle palette.
      const shade = row === 0 ? .74 : row === 1 ? .78 : row === 2 ? .84 : row === 3 ? .95 : 1;
      colors.push(shade, shade * .97, shade * .92);
      if (row) {
        const a = offset + (row - 1) * sides + i, b = offset + (row - 1) * sides + (i + 1) % sides;
        const c = a + sides, d = b + sides;
        indices.push(a, c, b, b, c, d);
      }
    }
    const center = positions.length / 3;
    positions.push(x + radius * .06 * cos, heightAt(x, y) + height, y + radius * .06 * sin);
    uv.push(x / 744, y / 744); colors.push(1, .97, .92);
    const top = offset + (heights.length - 1) * sides;
    for (let i = 0; i < sides; i++) indices.push(top + i, center, top + (i + 1) % sides);
  };

  for (let index = 0; index < rocks.length; index++) {
    const rock = rocks[index]!, yaw = rock.yaw * Math.PI / 180;
    if (rock.kind === 'plates') {
      // Three large overlapping sheets, with buried bases and staggered tips.
      for (let i = 0; i < 3; i++) piece(rock.x + (i - 1) * rock.radius * .41 * Math.cos(yaw),
        rock.y + (i - 1) * rock.radius * .41 * Math.sin(yaw), rock.radius * (.69 - i * .07),
        rock.height * (1 - i * .24), 'plates', rock.yaw + i * 8, index * 31 + i);
    } else if (rock.kind === 'debris') {
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        piece(rock.x + Math.cos(a) * rock.radius * .36, rock.y + Math.sin(a) * rock.radius * .32,
          rock.radius * (.42 - i * .035), rock.height * (.54 - i * .06), 'plates', rock.yaw + i * 21, index * 31 + i);
      }
    } else {
      piece(rock.x, rock.y, rock.radius * .92, rock.height, rock.kind, rock.yaw, index * 31);
      // A low basal counter-sheet braces only one end, not another central cake.
      piece(rock.x + Math.cos(yaw) * rock.radius * .66, rock.y + Math.sin(yaw) * rock.radius * .66,
        rock.radius * .39, rock.height * .24, 'plates', rock.yaw + 18, index * 31 + 8);
    }
    for (let i = 0; i < 4; i++) {
      const a = rock.yaw * Math.PI / 180 + 1.25 + i * .55;
      const distance = rock.radius * (.75 + noise(index, i, 877) * .33);
      piece(rock.x + Math.cos(a) * distance, rock.y + Math.sin(a) * distance * .64,
        4 + noise(index, i, 918) * 5, 1.8 + noise(index, i, 741) * 2.6, 'plates', rock.yaw + i * 17, index * 31 + 12 + i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, footprints, landmarkCount: rocks.length, pieceCount: footprints.length };
}
