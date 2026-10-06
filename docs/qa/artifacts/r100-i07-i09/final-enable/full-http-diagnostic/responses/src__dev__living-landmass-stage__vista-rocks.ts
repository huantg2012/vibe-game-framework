import * as THREE from 'three';
import type { VistaPoint } from './vista-terrain';

export type VistaRockKind = 'shell' | 'ridge' | 'plates' | 'debris' | 'wall' | 'fallen';
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
  const bedGeometry: { id: string; kind: VistaRockKind; rootVertices: number[]; overhangVertices: number[] }[] = [];
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
  /** Several finite beds emerge from one root. Each has an actual underside,
   * an unequal broken end and a top that enters the terrain at its root. There
   * is no common enclosing cap or concentric skirt around the whole body. */
  const landform = (rock: VistaRockDefinition): void => {
    const wall = rock.kind === 'wall';
    const envelope: readonly (readonly [number, number])[] = wall
      ? [[-1, -.14], [-.68, -.84], [-.2, -1], [.64, -.64], [.96, -.18], [.68, .66], [.14, .96], [-.66, .78], [-.9, .35]]
      : [[-1, -.3], [-.6, -.8], [.6, -.58], [1, .08], [.57, .85], [-.55, .64]];
    const angle = rock.yaw * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const breadth = wall ? .56 : .44;
    const toWorld = (a: number, b: number): VistaPoint => ({
      x: rock.x + rock.radius * (a * c - b * breadth * s),
      y: rock.y + rock.radius * (a * s + b * breadth * c),
    });
    const crossBounds = (a: number): [number, number] => {
      const hits: number[] = [];
      for (let i = 0; i < envelope.length; i++) {
        const p = envelope[i]!, q = envelope[(i + 1) % envelope.length]!;
        if (a >= Math.min(p[0], q[0]) && a <= Math.max(p[0], q[0]) && p[0] !== q[0]) {
          hits.push(p[1] + (q[1] - p[1]) * (a - p[0]) / (q[0] - p[0]));
        }
      }
      return [Math.min(...hits) + .018, Math.max(...hits) - .018];
    };
    const smooth = (start: number, end: number, value: number): number => {
      const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
      return t * t * (3 - 2 * t);
    };
    // Relative sections define this primitive; CSV still owns placement,
    // overall length, height and direction. Every bed stays inside the same
    // authored parent envelope, so the surrounding route is not narrowed.
    const beds = wall
      ? [{ start: -.72, end: .61, across: -.43, halfWidth: .34, level: 1.10, bend: -.10 },
        { start: -.89, end: .84, across: .08, halfWidth: .36, level: .76, bend: .13 },
        { start: -.61, end: .59, across: .56, halfWidth: .24, level: .43, bend: -.09 }]
      : [{ start: -.88, end: .86, across: -.22, halfWidth: .44, level: 1, bend: .15 },
        { start: -.60, end: .62, across: .36, halfWidth: .32, level: .52, bend: -.12 }];
    const floor = heightAt(rock.x, rock.y);
    const vertex = (p: THREE.Vector3, shade: number): void => {
      positions.push(p.x, p.y, p.z);
      uv.push(((p.x - rock.x) * c + (p.z - rock.y) * s) / 460, (p.y - floor) / 180);
      colors.push(shade, shade * .98, shade * .96);
    };
    const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: number): void => {
      vertex(a, shade); vertex(b, shade); vertex(c, shade);
    };
    for (const bed of beds) {
      const firstVertex = positions.length / 3;
      const left: THREE.Vector3[] = [], right: THREE.Vector3[] = [];
      const underLeft: THREE.Vector3[] = [], underRight: THREE.Vector3[] = [];
      const leftFoot: VistaPoint[] = [], rightFoot: VistaPoint[] = [];
      const stations = [0, .12, .28, .48, .72, 1];
      for (const t of stations) {
        const a = bed.start + (bed.end - bed.start) * t;
        const [min, max] = crossBounds(a);
        const middle = bed.across + bed.bend * (t - .5);
        const low = Math.max(min, middle - bed.halfWidth);
        const high = Math.min(max, middle + bed.halfWidth);
        if (!(high > low)) throw new Error(`Invalid geological bed section: ${rock.id}`);
        const emergence = smooth(.12, .48, t);
        const lift = -7 + (rock.height * bed.level + 7) * emergence * (1 - Math.max(0, t - .72) * .30);
        const thickness = rock.height * bed.level * .16 + 7;
        for (const [edge, b] of [[0, low], [1, high]] as const) {
          const fractureOffset = t === 1 ? (edge === 0 ? -.055 : .026)
            : t === .72 ? (edge === 0 ? .02 : -.04) : 0;
          const edgeA = a + fractureOffset, [edgeMin, edgeMax] = crossBounds(edgeA);
          const point = toWorld(edgeA, Math.max(edgeMin, Math.min(edgeMax, b)));
          const ground = heightAt(point.x, point.y);
          if (!contains(point.x, point.y)) throw new Error(`Vista bed ${rock.id} lacks terrain at its root`);
          const top = lift + (middle - b) * rock.height * .09 * emergence;
          const underside = Math.min(top - thickness, -5 + (top + 5) * smooth(.28, .58, t));
          (edge === 0 ? left : right).push(new THREE.Vector3(point.x, ground + top, point.y));
          (edge === 0 ? underLeft : underRight).push(new THREE.Vector3(point.x, ground + underside, point.y));
          // The buried tail is not an invisible obstacle. Begin the actual
          // solid's footprint at the terrain intersection on the next span.
          if (t >= .12) (edge === 0 ? leftFoot : rightFoot).push(point);
        }
      }
      // Trim the collision's buried leading edge to the same top/ground
      // crossing. Heights are linear on these first authored planar spans.
      const trim = (points: VistaPoint[], top: THREE.Vector3): void => {
        const rootFraction = 7 / (7 + Math.max(0, top.y - heightAt(top.x, top.z)));
        const a = points[0]!, b = points[1]!;
        points[0] = { x: a.x + (b.x - a.x) * rootFraction, y: a.y + (b.y - a.y) * rootFraction };
      };
      trim(leftFoot, left[2]!); trim(rightFoot, right[2]!);
      footprints.push([...leftFoot, ...rightFoot.reverse()]);
      for (let i = 0; i < stations.length - 1; i++) {
        const next = i + 1;
        // Upper and lower faces are genuine separate surfaces. A bed's
        // overhanging lip reveals its underside and the lower bed behind it.
        triangle(left[i]!, right[i]!, left[next]!, 1);
        triangle(right[i]!, right[next]!, left[next]!, 1);
        triangle(underLeft[i]!, underLeft[next]!, underRight[i]!, .70);
        triangle(underRight[i]!, underLeft[next]!, underRight[next]!, .70);
        triangle(underLeft[i]!, left[i]!, underLeft[next]!, .86);
        triangle(underLeft[next]!, left[i]!, left[next]!, .86);
        triangle(right[i]!, underRight[i]!, right[next]!, .93);
        triangle(right[next]!, underRight[i]!, underRight[next]!, .93);
      }
      const last = stations.length - 1;
      triangle(underLeft[last]!, left[last]!, underRight[last]!, .81);
      triangle(underRight[last]!, left[last]!, right[last]!, .81);
      // This cap is below the terrain, sealing the physical root rather than
      // drawing a visible vertical heel at the end of an otherwise whole rock.
      const rootVertex = positions.length / 3;
      bedGeometry.push({ id: rock.id, kind: rock.kind,
        rootVertices: [rootVertex, rootVertex + 2],
        overhangVertices: [firstVertex + 3 * 24, firstVertex + 3 * 24 + 6] });
      triangle(left[0]!, underLeft[0]!, right[0]!, .80);
      triangle(right[0]!, underLeft[0]!, underRight[0]!, .80);
    }
  };
  for (const rock of rocks) {
    if (rock.kind === 'wall' || rock.kind === 'fallen') {
      landform(rock);
    } else if (rock.kind === 'debris') {
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
  geometry.userData.beds = bedGeometry;
  return { geometry, footprints, landmarkCount: rocks.length, pieceCount: footprints.length };
}
