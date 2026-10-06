import * as THREE from 'three';
import { TileGrid } from '@/systems/tile-grid';
import { TileType } from '@/types/game-types';
import { bodyHasSupport } from '@/systems/ai/physical-grid';
import { disposeTree } from '../spatial-study/stage/materials';
import { createStudyMaterial } from './materials';

const WIDTH = 1344, LENGTH = 1056, START = 156, REACH = 596, ACROSS = 96, ALONG = 112, GRID = 8;
const clamp = (value: number, low = 0, high = 1): number => Math.max(low, Math.min(high, value));
const bell = (value: number): number => Math.exp(-value * value);
type BoundaryEdge = readonly [number, number];

/** Inclusive segment / rectangle clipping. A cell touched by the skin's edge
 * is withheld even when all four of its corners happen to lie on the skin. */
function edgeTouchesCell(ax: number, ay: number, bx: number, by: number, left: number, top: number): boolean {
  const epsilon = 1e-6, dx = bx - ax, dy = by - ay;
  let enter = 0, exit = 1;
  if (Math.abs(dx) < epsilon) {
    if (ax < left - epsilon || ax > left + GRID + epsilon) return false;
  } else {
    const a = (left - epsilon - ax) / dx, b = (left + GRID + epsilon - ax) / dx;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
  }
  if (Math.abs(dy) < epsilon) {
    if (ay < top - epsilon || ay > top + GRID + epsilon) return false;
  } else {
    const a = (top - epsilon - ay) / dy, b = (top + GRID + epsilon - ay) / dy;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit;
}

function center(v: number): number { return 650 + (624 + 38 * Math.sin(v * 3.9) - 26 * v - 650) * .72; }
function halfWidth(v: number): number {
  const spread = clamp((v - .55) / .45);
  return (86 + 438 * Math.pow(Math.sin(v * Math.PI * .91), .86)) * .72 + 100 * spread * spread * (3 - 2 * spread);
}
function frontLimit(u: number): number {
  // Three broad unequal lobes, with shallow open clefts between them. They
  // change real indexed geometry and the derived body footprint together.
  return Math.min(1, .79 + .215 * bell((u - .19) / .18)
    + .17 * bell((u - .58) / .18) + .21 * bell((u - .86) / .10));
}
function topHeight(u: number, v: number): number {
  const x = u * 2 - 1;
  const spine = 284 - 169 * Math.sin(v * Math.PI / 2);
  const cup = 24 * x * x * Math.sin(v * Math.PI * .9);
  const ribs = Math.pow(Math.max(0, Math.cos(x * 16 + v * .9)), 5) * (2 + 9 * Math.sin(v * Math.PI));
  const natural = spine + cup + ribs + 7 * Math.sin(v * 5.1 + x * 2.1) * Math.sin(v * Math.PI);
  const seat = bell((u - .515) / .19) * bell((v - .25) / .075);
  const spread = bell((u - .50) / .29);
  const creaseA = bell((v - .16 - (u - .5) * .055) / .018);
  const creaseB = bell((v - .205 + (u - .5) * .07) / .017);
  return natural * (1 - seat * .7) + 208 * seat * .7 + spread * (17 * creaseA + 10 * creaseB);
}
function thickness(u: number, v: number): number {
  const edge = clamp((v - .72) / .28), lobeThickness = 9 + 10 * (1 + Math.sin(u * 7.1 + .8)) / 2;
  return (14 + 123 * Math.pow(1 - v, 2) + 16 * (1 - Math.abs(u * 2 - 1)) * Math.sin(v * Math.PI)) * (1 - edge)
    + lobeThickness * edge;
}
/** A broad open bite exposes the bearing body's approach and contact. */
function inOpenBay(x: number, y: number): boolean {
  const sourceX = 650 + (x - 650) / .72, sourceY = 454 + (y - 454) / .78;
  const tip = clamp((sourceX - 435) / 320), radius = 116 * Math.sqrt(Math.max(0, 1 - tip * tip));
  const middle = 374 - 26 * clamp(sourceX / 755);
  return sourceX < 755 && sourceY > middle - radius && sourceY < middle + radius;
}

export interface GroundSample { height: number; triangle: number; inside: boolean }

/** Static sculpted surface. Its exact triangles own visual height. The derived
 * fine XY mask is only the bounded walking area; there is no second floor. */
export class LivingStageModel {
  readonly group = new THREE.Group();
  readonly surface: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly walk: TileGrid;
  readonly width = WIDTH;
  readonly height = LENGTH;
  readonly spawn = { x: 568, y: 582 };
  readonly focus = { x: 632, height: 22, y: 466 };
  readonly span = 1060;
  readonly contact: { x: number; height: number; y: number };
  private readonly vertices = new Float32Array((ACROSS + 1) * (ALONG + 1) * 3);
  private readonly sample: GroundSample = { height: 0, triangle: -1, inside: false };
  private readonly barycentric = new Float64Array(3);
  private readonly admitted = new Uint8Array(ACROSS * ALONG);
  private disposed = false;

  constructor() {
    const indices: number[] = [], uv = new Float32Array((ACROSS + 1) * (ALONG + 1) * 2);
    for (let row = 0; row <= ALONG; row++) for (let col = 0; col <= ACROSS; col++) {
      const u = col / ACROSS, v = row / ALONG, index = row * (ACROSS + 1) + col;
      this.vertices[index * 3] = center(v) + (u * 2 - 1) * halfWidth(v);
      this.vertices[index * 3 + 1] = topHeight(u, v); this.vertices[index * 3 + 2] = START + v * REACH;
      uv[index * 2] = u; uv[index * 2 + 1] = v;
      if (row < ALONG && col < ACROSS) {
        const a = index, b = a + 1, c = a + ACROSS + 1, d = c + 1;
        const midV = (row + .5) / ALONG, midX = center(midV) + ((col + .5) / ACROSS * 2 - 1) * halfWidth(midV);
        if (midV <= frontLimit((col + .5) / ACROSS) && !inOpenBay(midX, START + midV * REACH)) {
          indices.push(a, c, b, b, c, d); this.admitted[row * ACROSS + col] = 1;
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.surface = new THREE.Mesh(geometry, createStudyMaterial('skin'));
    this.surface.name = 'continuous-walkable-fan'; this.surface.receiveShadow = true; this.surface.castShadow = true;
    this.group.add(this.surface);
    const boundary = this.boundaryEdges(indices);
    this.makeUnderside(indices, boundary);
    const contactX = 645, contactY = 305, contactV = (contactY - START) / REACH;
    const contactU = .5 + (contactX - center(contactV)) / (2 * halfWidth(contactV));
    this.contact = { x: contactX, y: contactY,
      height: this.groundHeightAt(contactX, contactY) - thickness(contactU, contactV) };
    this.makeBearer();
    this.makeDistantContinuation();
    this.walk = this.makeWalkingGrid(boundary);
    if (!bodyHasSupport(this.walk, this.spawn, 10, 10)) throw new Error('Visual study spawn has no complete body support');
    this.group.updateMatrixWorld(true);
  }

  contains(x: number, y: number): boolean {
    if (y < START || y > START + REACH) return false;
    const v = (y - START) / REACH, row = Math.min(ALONG - 1, Math.floor(v * ALONG)), t = v * ALONG - row;
    const left0 = this.vertices[(row * (ACROSS + 1)) * 3]!, left1 = this.vertices[((row + 1) * (ACROSS + 1)) * 3]!;
    const right0 = this.vertices[(row * (ACROSS + 1) + ACROSS) * 3]!, right1 = this.vertices[((row + 1) * (ACROSS + 1) + ACROSS) * 3]!;
    const left = left0 + (left1 - left0) * t, right = right0 + (right1 - right0) * t;
    const col = Math.min(ACROSS - 1, Math.max(0, Math.floor((x - left) / (right - left) * ACROSS)));
    return x >= left && x <= right && !!this.admitted[row * ACROSS + col];
  }

  /** Barycentric height on the exact visible triangle, including changing row
   * width. Sampling the analytic authoring curve here would float the feet. */
  sampleGround(x: number, y: number, out: GroundSample): GroundSample {
    const v = clamp((y - START) / REACH), row = Math.min(ALONG - 1, Math.floor(v * ALONG)), t = v * ALONG - row;
    const first = row * (ACROSS + 1), next = first + ACROSS + 1;
    const left = this.vertices[first * 3]! * (1 - t) + this.vertices[next * 3]! * t;
    const right = this.vertices[(first + ACROSS) * 3]! * (1 - t) + this.vertices[(next + ACROSS) * 3]! * t;
    const u = clamp((x - left) / (right - left)), col = Math.min(ACROSS - 1, Math.floor(u * ACROSS));
    const px = left + u * (right - left), py = START + v * REACH;
    const a = first + col, b = a + 1, c = a + ACROSS + 1, d = c + 1;
    let ia = a, ib = c, ic = b, half = 0;
    this.sampleBarycentric(a, c, b, px, py);
    if (this.barycentric[0]! < -1e-6 || this.barycentric[1]! < -1e-6 || this.barycentric[2]! < -1e-6) {
      ia = b; ib = c; ic = d; half = 1; this.sampleBarycentric(b, c, d, px, py);
    }
    out.height = this.barycentric[0]! * this.vertices[ia * 3 + 1]! + this.barycentric[1]! * this.vertices[ib * 3 + 1]!
      + this.barycentric[2]! * this.vertices[ic * 3 + 1]!;
    out.triangle = (row * ACROSS + col) * 2 + half; out.inside = this.contains(x, y);
    return out;
  }

  readonly groundHeightAt = (x: number, y: number): number => this.sampleGround(x, y, this.sample).height;

  snapshot(): Record<string, unknown> {
    let meshes = 0, triangles = 0, vertices = 0;
    this.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++; vertices += object.geometry.getAttribute('position').count;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    });
    return { meshes, triangles, vertices, staticGeometry: true, topSurfaceTriangles: this.surface.geometry.index!.count / 3,
      surface: 'continuous loft; barycentric support on the rendered triangles',
      underside: 'welded rolled perimeter and continuous belly', contact: { ...this.contact },
      physics: 'production 20px Player body and XY sweep on conservative 8px mask',
      texture: 'authored 256px finite-colour fibre fields; nearest filtering; no scene images' };
  }

  destroy(): void { if (this.disposed) return; this.disposed = true; disposeTree(this.group); this.group.clear(); }

  private sampleBarycentric(ia: number, ib: number, ic: number, x: number, y: number): void {
    const ax = this.vertices[ia * 3]!, az = this.vertices[ia * 3 + 2]!, bx = this.vertices[ib * 3]!, bz = this.vertices[ib * 3 + 2]!;
    const cx = this.vertices[ic * 3]!, cz = this.vertices[ic * 3 + 2]!;
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    this.barycentric[0] = ((bz - cz) * (x - cx) + (cx - bx) * (y - cz)) / denominator;
    this.barycentric[1] = ((cz - az) * (x - cx) + (ax - cx) * (y - cz)) / denominator;
    this.barycentric[2] = 1 - this.barycentric[0]! - this.barycentric[1]!;
  }

  private boundaryEdges(topIndices: readonly number[]): readonly BoundaryEdge[] {
    const edges = new Map<string, BoundaryEdge>();
    for (let at = 0; at < topIndices.length; at += 3) {
      const a = topIndices[at]!, b = topIndices[at + 1]!, c = topIndices[at + 2]!;
      for (const [from, to] of [[a, b], [b, c], [c, a]]) {
        const key = `${Math.min(from!, to!)}:${Math.max(from!, to!)}`;
        if (edges.has(key)) edges.delete(key); else edges.set(key, [from!, to!]);
      }
    }
    return [...edges.values()];
  }

  private makeWalkingGrid(boundary: readonly BoundaryEdge[]): TileGrid {
    const cols = WIDTH / GRID, rows = LENGTH / GRID;
    const tiles = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
      const x = col * GRID, y = row * GRID;
      return this.contains(x, y) && this.contains(x + GRID, y)
        && this.contains(x, y + GRID) && this.contains(x + GRID, y + GRID) ? TileType.FLOOR : TileType.VOID;
    }));
    // Boundary segments are taken from the rendered indexed mesh, including
    // every short edge of the bay and lobes. Excluding intersected cells proves
    // full coverage; a concave notch cannot slip between corner samples.
    for (const [from, to] of boundary) {
      const ax = this.vertices[from * 3]!, ay = this.vertices[from * 3 + 2]!;
      const bx = this.vertices[to * 3]!, by = this.vertices[to * 3 + 2]!;
      const minCol = Math.max(0, Math.floor((Math.min(ax, bx) - 1e-6) / GRID));
      const maxCol = Math.min(cols - 1, Math.floor((Math.max(ax, bx) + 1e-6) / GRID));
      const minRow = Math.max(0, Math.floor((Math.min(ay, by) - 1e-6) / GRID));
      const maxRow = Math.min(rows - 1, Math.floor((Math.max(ay, by) + 1e-6) / GRID));
      for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
        if (edgeTouchesCell(ax, ay, bx, by, col * GRID, row * GRID)) tiles[row]![col] = TileType.VOID;
      }
    }
    return new TileGrid({ cols, rows, tileSize: GRID, tiles });
  }

  private makeUnderside(topIndices: readonly number[], boundary: readonly BoundaryEdge[]): void {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    // Bottom shares the top's XZ lattice. Its thickness narrows toward the fan
    // margin instead of becoming a second disconnected horizontal plate.
    for (let row = 0; row <= ALONG; row++) for (let col = 0; col <= ACROSS; col++) {
      const i = row * (ACROSS + 1) + col, u = col / ACROSS, v = row / ALONG;
      positions.push(this.vertices[i * 3]!, this.vertices[i * 3 + 1]! - thickness(u, v), this.vertices[i * 3 + 2]!);
      uvs.push(u, v);
    }
    for (let at = 0; at < topIndices.length; at += 3) {
      const a = topIndices[at]!, b = topIndices[at + 1]!, c = topIndices[at + 2]!;
      indices.push(a, c, b);
    }
    const steps = 8;
    for (const [from, to] of boundary) {
      const base = positions.length / 3, ax = this.vertices[from * 3]!, az = this.vertices[from * 3 + 2]!;
      const bx = this.vertices[to * 3]!, bz = this.vertices[to * 3 + 2]!, distance = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / distance, nz = (bx - ax) / distance;
      for (let ring = 0; ring <= steps; ring++) for (const index of [from, to]) {
        const row = Math.floor(index / (ACROSS + 1)), col = index % (ACROSS + 1), t = ring / steps;
        const thick = thickness(col / ACROSS, row / ALONG), bulge = Math.sin(t * Math.PI) * Math.min(9, thick * .23);
        positions.push(this.vertices[index * 3]! + nx * bulge, this.vertices[index * 3 + 1]! - thick * t,
          this.vertices[index * 3 + 2]! + nz * bulge); uvs.push(col / ACROSS, t);
      }
      for (let ring = 0; ring < steps; ring++) {
        const a = base + ring * 2, b = a + 1, c = a + 2, d = a + 3; indices.push(a, b, c, b, d, c);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, createStudyMaterial('belly'));
    mesh.name = 'welded-rolled-margin-and-belly'; mesh.receiveShadow = true; mesh.castShadow = true; this.group.add(mesh);
  }

  private makeBearer(): void {
    const p = this.contact;
    const points = [new THREE.Vector3(-230, -140, 510), new THREE.Vector3(60, -90, 475),
      new THREE.Vector3(320, p.height - 130, 416),
      new THREE.Vector3(p.x, p.height - 68, p.y), new THREE.Vector3(p.x + 110, -6, p.y - 130),
      new THREE.Vector3(960, -160, 15), new THREE.Vector3(1130, -240, -220)];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = this.makeLoft(curve, 96, 68, 160, 40, true);
    const mesh = new THREE.Mesh(geometry, createStudyMaterial('bearer'));
    mesh.name = 'lower-bearing-body'; mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
  }

  private makeDistantContinuation(): void {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(100, -355, -110), new THREE.Vector3(370, -337, 105),
      new THREE.Vector3(750, -324, 132), new THREE.Vector3(1040, -346, 54), new THREE.Vector3(1520, -420, -80)]);
    const mesh = new THREE.Mesh(this.makeLoft(curve, 215, 112, 100, 40), createStudyMaterial('distant'));
    mesh.name = 'distant-next-bearing-layer'; mesh.receiveShadow = true; this.group.add(mesh);
  }

  private makeLoft(curve: THREE.CatmullRomCurve3, width: number, height: number, along: number, around: number,
    bearingContact = false): THREE.BufferGeometry {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let row = 0; row <= along; row++) {
      const t = row / along, p = curve.getPoint(t), direction = curve.getTangent(t), l = Math.hypot(direction.x, direction.z) || 1;
      const nx = direction.z / l, nz = -direction.x / l;
      const saddle = bearingContact ? bell((t - .5) / .10) : 0;
      const breadth = width * ((bearingContact ? .68 : .82) + .18 * Math.sin(t * Math.PI) + saddle * .56);
      for (let col = 0; col <= around; col++) {
        const angle = col / around * Math.PI * 2, undulation = 1 + .045 * Math.cos(angle * 5 + t * 8);
        const sine = Math.sin(angle);
        const vertical = sine >= 0 ? (sine * (1 - saddle) + Math.min(1, sine * 1.45) * saddle) * height
          : sine * height * (.52 - saddle * .14) - Math.cos(angle) ** 2 * height * .18;
        positions.push(p.x + nx * Math.cos(angle) * breadth * undulation,
          p.y + vertical, p.z + nz * Math.cos(angle) * breadth * undulation);
        uvs.push(col / around, t * 1.5);
        if (row < along && col < around) {
          const a = row * (around + 1) + col, b = a + 1, c = a + around + 1, d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }
}
