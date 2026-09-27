/** Small, allocation-free ray index for the authored haven. Rendering and light
 * visibility use world coordinates; navigation owns a separate walk contract. */
export type LightVector = readonly [number, number, number];
export interface LastLightCamera {
  width: number; height: number; origin: readonly [number, number]; scale: number;
  target: LightVector; direction: LightVector;
}
export interface LastLightBasis { right: LightVector; up: LightVector; back: LightVector }
const normalize = (v: LightVector): LightVector => {
  const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n];
};
const cross = (a: LightVector, b: LightVector): LightVector =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function lastLightBasis(camera: LastLightCamera): LastLightBasis {
  const back = normalize(camera.direction), right = normalize(cross([0, 1, 0], back));
  return { back, right, up: normalize(cross(back, right)) };
}
export function projectLastLight(point: LightVector, camera: LastLightCamera, basis = lastLightBasis(camera)): [number, number, number] {
  const x = point[0] - camera.target[0], y = point[1] - camera.target[1], z = point[2] - camera.target[2];
  return [camera.origin[0] + (x * basis.right[0] + y * basis.right[1] + z * basis.right[2]) * camera.scale,
    camera.origin[1] - (x * basis.up[0] + y * basis.up[1] + z * basis.up[2]) * camera.scale,
    x * basis.back[0] + y * basis.back[1] + z * basis.back[2]];
}
export function unprojectLastLight(x: number, y: number, depth: number, camera: LastLightCamera, basis: LastLightBasis): [number, number, number] {
  const rx = (x - camera.origin[0]) / camera.scale, uy = (camera.origin[1] - y) / camera.scale;
  return [0, 1, 2].map(i => camera.target[i]! + basis.right[i]! * rx + basis.up[i]! * uy + basis.back[i]! * depth) as [number, number, number];
}
interface RayNode { min: number[]; max: number[]; left?: RayNode; right?: RayNode; start: number; end: number }
/** Nine floats per opaque triangle, supplied by the same accepted model pack. */
export class LastLightOcclusion {
  private readonly indices: number[];
  private readonly root: RayNode;
  private readonly stack: RayNode[] = [];
  constructor(private readonly triangles: ArrayLike<number>) {
    if (triangles.length % 9) throw new Error('Last Light occluders require nine coordinates per triangle.');
    this.indices = Array.from({ length: triangles.length / 9 }, (_, i) => i);
    this.root = this.build(0, this.indices.length);
  }
  private build(start: number, end: number): RayNode {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let n = start; n < end; n++) {
      const offset = this.indices[n]! * 9;
      for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) {
        const value = this.triangles[offset + v * 3 + a]!;
        min[a] = Math.min(min[a]!, value); max[a] = Math.max(max[a]!, value);
      }
    }
    const node: RayNode = { min, max, start, end };
    if (end - start <= 8) return node;
    let axis = 0;
    for (let a = 1; a < 3; a++) if (max[a]! - min[a]! > max[axis]! - min[axis]!) axis = a;
    const center = (id: number): number => {
      const j = id * 9 + axis; return this.triangles[j]! + this.triangles[j + 3]! + this.triangles[j + 6]!;
    };
    const sorted = this.indices.slice(start, end).sort((a, b) => center(a) - center(b));
    for (let i = 0; i < sorted.length; i++) this.indices[start + i] = sorted[i]!;
    const mid = (start + end) >>> 1;
    node.left = this.build(start, mid); node.right = this.build(mid, end);
    return node;
  }
  blocked(from: LightVector, to: LightVector): boolean {
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance < .035 || !this.indices.length) return false;
    const direction = [dx / distance, dy / distance, dz / distance];
    const maximum = distance - .025;
    this.stack.length = 0; this.stack.push(this.root);
    while (this.stack.length) {
      const node = this.stack.pop()!;
      let enter = .008, leave = maximum;
      for (let a = 0; a < 3; a++) {
        const d = direction[a]!;
        if (Math.abs(d) < 1e-10) {
          if (from[a]! < node.min[a]! || from[a]! > node.max[a]!) { leave = -1; break; }
        } else {
          let lo = (node.min[a]! - from[a]!) / d, hi = (node.max[a]! - from[a]!) / d;
          if (lo > hi) { const swap = lo; lo = hi; hi = swap; }
          enter = Math.max(enter, lo); leave = Math.min(leave, hi);
        }
      }
      if (leave < enter) continue;
      if (node.left && node.right) { this.stack.push(node.left, node.right); continue; }
      for (let n = node.start; n < node.end; n++) {
        const o = this.indices[n]! * 9, t = this.triangles;
        const ex = t[o + 3]! - t[o]!, ey = t[o + 4]! - t[o + 1]!, ez = t[o + 5]! - t[o + 2]!;
        const fx = t[o + 6]! - t[o]!, fy = t[o + 7]! - t[o + 1]!, fz = t[o + 8]! - t[o + 2]!;
        const px = direction[1]! * fz - direction[2]! * fy;
        const py = direction[2]! * fx - direction[0]! * fz;
        const pz = direction[0]! * fy - direction[1]! * fx;
        const determinant = ex * px + ey * py + ez * pz;
        if (Math.abs(determinant) < 1e-8) continue;
        const inverse = 1 / determinant, tx = from[0] - t[o]!, ty = from[1] - t[o + 1]!, tz = from[2] - t[o + 2]!;
        const u = (tx * px + ty * py + tz * pz) * inverse;
        if (u < 0 || u > 1) continue;
        const qx = ty * ez - tz * ey, qy = tz * ex - tx * ez, qz = tx * ey - ty * ex;
        const v = (direction[0]! * qx + direction[1]! * qy + direction[2]! * qz) * inverse;
        if (v < 0 || u + v > 1) continue;
        const hit = (fx * qx + fy * qy + fz * qz) * inverse;
        if (hit > .008 && hit < maximum) return true;
      }
    }
    return false;
  }
}
