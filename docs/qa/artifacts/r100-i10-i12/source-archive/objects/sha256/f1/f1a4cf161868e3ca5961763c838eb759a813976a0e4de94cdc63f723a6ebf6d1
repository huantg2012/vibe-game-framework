import * as THREE from 'three';
import { sampleVistaStrata, type VistaStratum } from './vista-strata';

export type VistaPoint = Readonly<{ x: number; y: number }>;
export interface VistaTerrainRegion extends VistaPoint {
  readonly id: string;
  readonly label: string;
  readonly height: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly tint: string;
  readonly landmark: string;
}
export interface VistaTerrain {
  readonly geometry: THREE.BufferGeometry;
  readonly heightAt: (x: number, y: number) => number;
  readonly boundaryRings: readonly (readonly VistaBoundaryVertex[])[];
}
export interface VistaBoundaryVertex extends VistaPoint { readonly height: number }

const SUBDIVISIONS = 3;
export const VISTA_EDGE_SEGMENTS = 2 ** SUBDIVISIONS;
const BUCKET_SIZE = 64;

/** Broad bedding, rather than per-vertex noise. This function is only a mesh
 * authoring tool: runtime feet sample the actual Float32 triangles below. */
function bedHeight(x: number, y: number, regions: readonly VistaTerrainRegion[], strata: readonly VistaStratum[]): number {
  let weighted = 0, total = 0;
  for (const region of regions) {
    const dx = (x - region.x) / region.radiusX, dy = (y - region.y) / region.radiusY;
    const weight = Math.exp(-.5 * (dx * dx + dy * dy));
    weighted += region.height * weight; total += weight;
  }
  return weighted / total + sampleVistaStrata(x, y, strata).height;
}

/** Earcut guarantees coverage, but long thin interior triangles can amplify
 * interpolation slopes. Flip only shared internal diagonals of convex quads;
 * authored boundary segments remain untouched. */
function improveTriangles(triangles: number[][], outline: readonly VistaPoint[]): void {
  const cross = (a: number, b: number, c: number): number => {
    const p = outline[a]!, q = outline[b]!, r = outline[c]!;
    return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  };
  const quality = (a: number, b: number, c: number): number => {
    const p = outline[a]!, q = outline[b]!, r = outline[c]!;
    return Math.abs(cross(a, b, c)) / Math.max(
      (p.x - q.x) ** 2 + (p.y - q.y) ** 2,
      (q.x - r.x) ** 2 + (q.y - r.y) ** 2,
      (r.x - p.x) ** 2 + (r.y - p.y) ** 2);
  };
  for (let pass = 0; pass < 4096; pass++) {
    const edges = new Map<string, { triangle: number; opposite: number }>();
    let flipped = false;
    outer: for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i]!;
      for (let edge = 0; edge < 3; edge++) {
        const a = triangle[edge]!, b = triangle[(edge + 1) % 3]!, c = triangle[(edge + 2) % 3]!;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        const neighbour = edges.get(key);
        if (!neighbour) { edges.set(key, { triangle: i, opposite: c }); continue; }
        const d = neighbour.opposite;
        if (cross(c, d, a) * cross(c, d, b) >= 0 || cross(a, b, c) * cross(a, b, d) >= 0) continue;
        const before = Math.min(quality(a, b, c), quality(a, b, d));
        const after = Math.min(quality(c, d, a), quality(c, d, b));
        if (after <= before + 1e-9) continue;
        triangles[i] = [c, d, a]; triangles[neighbour.triangle] = [d, c, b];
        flipped = true; break outer;
      }
    }
    if (!flipped) return;
  }
}

/** Every authored boundary edge receives the same subdivision depth, so
 * neighbouring earcut triangles have matching vertices, without T-junctions. */
export function createVistaTerrain(outline: readonly VistaPoint[], holes: readonly (readonly VistaPoint[])[],
  regions: readonly VistaTerrainRegion[], strata: readonly VistaStratum[] = []): VistaTerrain {
  const contour = outline.map(p => new THREE.Vector2(p.x, p.y));
  const voidContours = holes.map(hole => hole.map(p => new THREE.Vector2(p.x, p.y)));
  const vertices = [...outline, ...holes.flat()];
  const triangles = THREE.ShapeUtils.triangulateShape(contour, voidContours);
  improveTriangles(triangles, vertices);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [];
  const strataWeights: number[] = [], beddingUvs: number[] = [];
  const pigments = regions.map(region => new THREE.Color(`#${region.tint}`));
  const vertex = (p: VistaPoint): void => {
    const bed = sampleVistaStrata(p.x, p.y, strata);
    strataWeights.push(bed.exposure, bed.sediment, bed.fracture);
    beddingUvs.push(bed.beddingU, bed.beddingV);
    positions.push(p.x, bedHeight(p.x, p.y, regions, strata), p.y);
    const dx = bedHeight(p.x + .5, p.y, regions, strata) - bedHeight(p.x - .5, p.y, regions, strata);
    const dz = bedHeight(p.x, p.y + .5, regions, strata) - bedHeight(p.x, p.y - .5, regions, strata);
    const length = Math.hypot(dx, 1, dz);
    normals.push(-dx / length, 1 / length, -dz / length);
    // A single continuous UV field bends with the long living bed; shared
    // seams never reset at an arbitrary region or connector boundary.
    uvs.push((p.x + Math.sin(p.y / 440) * 48) / 744, (p.y + Math.sin(p.x / 330) * 35) / 744);
    let r = 0, g = 0, b = 0, total = 0;
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i]!, color = pigments[i]!;
      const rx = (p.x - region.x) / region.radiusX, ry = (p.y - region.y) / region.radiusY;
      const weight = Math.exp(-.75 * (rx * rx + ry * ry));
      r += color.r * weight; g += color.g * weight; b += color.b * weight; total += weight;
    }
    colors.push(.94 + r / total * .035, .94 + g / total * .035, .94 + b / total * .035);
  };
  const subdivide = (a: VistaPoint, b: VistaPoint, c: VistaPoint, depth: number): void => {
    if (!depth) {
      vertex(a);
      if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0) {
        vertex(c); vertex(b);
      } else { vertex(b); vertex(c); }
      return;
    }
    const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };
    subdivide(a, ab, ca, depth - 1); subdivide(ab, b, bc, depth - 1);
    subdivide(ca, bc, c, depth - 1); subdivide(ab, bc, ca, depth - 1);
  };
  for (const triangle of triangles) {
    subdivide(vertices[triangle[0]!]!, vertices[triangle[1]!]!, vertices[triangle[2]!]!, SUBDIVISIONS);
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.Float32BufferAttribute(positions, 3);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('vistaBedding', new THREE.Float32BufferAttribute(beddingUvs, 2));
  geometry.setAttribute('vistaStrata', new THREE.Float32BufferAttribute(strataWeights, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const box = geometry.boundingBox!;
  const minX = Math.floor(box.min.x / BUCKET_SIZE), minY = Math.floor(box.min.z / BUCKET_SIZE);
  const cols = Math.floor(box.max.x / BUCKET_SIZE) - minX + 1;
  const rows = Math.floor(box.max.z / BUCKET_SIZE) - minY + 1;
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < position.count; i += 3) {
    const x0 = Math.floor(Math.min(position.getX(i), position.getX(i + 1), position.getX(i + 2)) / BUCKET_SIZE);
    const x1 = Math.floor(Math.max(position.getX(i), position.getX(i + 1), position.getX(i + 2)) / BUCKET_SIZE);
    const y0 = Math.floor(Math.min(position.getZ(i), position.getZ(i + 1), position.getZ(i + 2)) / BUCKET_SIZE);
    const y1 = Math.floor(Math.max(position.getZ(i), position.getZ(i + 1), position.getZ(i + 2)) / BUCKET_SIZE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      buckets[(y - minY) * cols + x - minX]!.push(i);
    }
  }
  const heightAt = (x: number, y: number): number => {
    const col = Math.floor(x / BUCKET_SIZE) - minX, row = Math.floor(y / BUCKET_SIZE) - minY;
    if (col < 0 || row < 0 || col >= cols || row >= rows) return 0;
    const bucket = buckets[row * cols + col]!;
    for (let t = 0; t < bucket.length; t++) {
      const i = bucket[t]!;
      const ax = position.getX(i), az = position.getZ(i);
      const bx = position.getX(i + 1), bz = position.getZ(i + 1);
      const cx = position.getX(i + 2), cz = position.getZ(i + 2);
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      const a = ((bz - cz) * (x - cx) + (cx - bx) * (y - cz)) / denominator;
      const b = ((cz - az) * (x - cx) + (ax - cx) * (y - cz)) / denominator;
      const c = 1 - a - b;
      // A fixed barycentric tolerance changes its physical size with triangle
      // aspect ratio. Use a sub-millimetre world-space edge tolerance instead.
      const areaSquared = denominator * denominator;
      const toleranceSquared = .00025 ** 2;
      if ((a >= 0 || a * a * areaSquared <= toleranceSquared * ((bx - cx) ** 2 + (bz - cz) ** 2))
        && (b >= 0 || b * b * areaSquared <= toleranceSquared * ((cx - ax) ** 2 + (cz - az) ** 2))
        && (c >= 0 || c * c * areaSquared <= toleranceSquared * ((ax - bx) ** 2 + (az - bz) ** 2))) {
        return a * position.getY(i) + b * position.getY(i + 1) + (1 - a - b) * position.getY(i + 2);
      }
    }
    // Outside the actual outline. This value cannot grant physical support.
    return 0;
  };
  // Side geometry binds to the actual top vertices, not a point-containment
  // query evaluated on its mathematical boundary. Float32 rounding can place
  // a boundary query microscopically outside its neighbouring triangle.
  const vertexHeights = new Map<string, number>();
  for (let i = 0; i < position.count; i++) vertexHeights.set(`${position.getX(i)}:${position.getZ(i)}`, position.getY(i));
  const boundaryRings = [outline, ...holes].map(ring => {
    const boundary: VistaBoundaryVertex[] = [];
    for (let edge = 0; edge < ring.length; edge++) {
      const a = ring[edge]!, b = ring[(edge + 1) % ring.length]!;
      for (let step = 0; step < VISTA_EDGE_SEGMENTS; step++) {
        const x = Math.fround(a.x + (b.x - a.x) * step / VISTA_EDGE_SEGMENTS);
        const y = Math.fround(a.y + (b.y - a.y) * step / VISTA_EDGE_SEGMENTS);
        const height = vertexHeights.get(`${x}:${y}`);
        if (height === undefined) throw new Error(`Missing shared vista rim vertex ${x},${y}`);
        boundary.push({ x, y, height });
      }
    }
    return boundary;
  });
  return { geometry, heightAt, boundaryRings };
}
