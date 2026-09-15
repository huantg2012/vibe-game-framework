import * as THREE from 'three';
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

/** Embedded wedges have six unequal hard planes, a sloping whole face and
 * buried ends. There is no rounded extrusion or per-landmark gravel halo.
 * The basal loop is also the physical obstacle; decorative chips stay low. */
export function createVistaRocks(rocks: readonly VistaRockDefinition[], heightAt: (x: number, y: number) => number,
  contains: (x: number, y: number) => boolean): VistaRockGeometry {
  const positions: number[] = [], uv: number[] = [], colors: number[] = [];
  const footprints: VistaPoint[][] = [];
  const piece = (rock: VistaRockDefinition, x: number, y: number, radius: number, height: number, yaw: number): void => {
    const angle = yaw * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const short = rock.kind === 'ridge' ? .32 : .48;
    // Large intact face, clipped source-side corner and a narrow buried tip.
    const plan = [[-1, -.30], [-.70, -.91], [.53, -.76], [1, -.17], [.69, .82], [-.58, .63]] as const;
    const footprint = plan.map(([a, b]) => ({ x: x + radius * (a * c - b * short * s),
      y: y + radius * (a * s + b * short * c) }));
    if (footprint.some(p => !contains(p.x, p.y))) throw new Error(`Vista landmark ${rock.id} lacks terrain support`);
    footprints.push(footprint);
    const floor = heightAt(x, y);
    const base = footprint.map(p => new THREE.Vector3(p.x, heightAt(p.x, p.y) - 2, p.y));
    const top = plan.map(([a, b], index) => {
      const p = footprint[index]!;
      // Both longitudinal tips meet the actual bed. The exposed center is
      // one pitched shell rather than a solid object placed on a flat base.
      const embed = Math.max(0, 1 - a * a);
      const inset = .95;
      const px = x + (p.x - x) * inset, py = y + (p.y - y) * inset;
      const bed = heightAt(px, py);
      return new THREE.Vector3(px, bed + height * embed * (.70 - b * .30), py);
    });
    const vertex = (p: THREE.Vector3, shade: number): void => {
      positions.push(p.x, p.y, p.z);
      const along = (p.x - x) * c + (p.z - y) * s;
      uv.push(along / 330, Math.max(0, p.y - floor) / 105);
      colors.push(shade, shade * .97, shade * .93);
    };
    const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: number): void => {
      vertex(a, shade); vertex(b, shade); vertex(c, shade);
    };
    for (let i = 0; i < plan.length; i++) {
      const next = (i + 1) % plan.length;
      triangle(base[i]!, top[i]!, base[next]!, .81);
      triangle(base[next]!, top[i]!, top[next]!, .81);
    }
    // Fan from an existing corner leaves the broad surface planar, without a
    // peaked center or the radial shading of the old capsule forms.
    for (let i = 1; i < plan.length - 1; i++) triangle(top[0]!, top[i + 1]!, top[i]!, 1);
  };
  for (const rock of rocks) {
    if (rock.kind === 'debris') {
      // A single source-side talus fan. The row itself is authored at a basin
      // or broken root; normal landmarks never generate automatic fragments.
      const yaw = rock.yaw * Math.PI / 180;
      for (let i = 0; i < 5; i++) {
        const along = (i - 2) * rock.radius * .38, cross = (i % 2) * rock.radius * .28;
        piece(rock, rock.x + along * Math.cos(yaw) - cross * Math.sin(yaw),
          rock.y + along * Math.sin(yaw) + cross * Math.cos(yaw), rock.radius * (.34 - i * .035),
          rock.height * (.75 - i * .1), rock.yaw + (i % 2 ? 18 : -12));
      }
    } else if (rock.kind === 'plates') {
      const yaw = rock.yaw * Math.PI / 180;
      piece(rock, rock.x, rock.y, rock.radius, rock.height, rock.yaw);
      piece(rock, rock.x - Math.cos(yaw) * rock.radius * .45, rock.y - Math.sin(yaw) * rock.radius * .45,
        rock.radius * .62, rock.height * .40, rock.yaw - 8);
    } else piece(rock, rock.x, rock.y, rock.radius, rock.height, rock.yaw);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, footprints, landmarkCount: rocks.length, pieceCount: footprints.length };
}
