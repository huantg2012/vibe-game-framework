import { CHAMBER_SIZE } from '../systems/purification-chamber-layout';

/** Visible surface in the chamber's fixed projection: X=x, Y=y+height, Z=height.
 * Heights are world pixels: main floor 0, upper floor 32. For a screen-space
 * height slope (riseX, riseY), a consistent upward normal is
 * (-riseX, -riseY, 1+riseY), normalized by setPlane(). */
export interface SurfacePlane {
  readonly normal: readonly [number, number, number];
  readonly elevation: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly riseX?: number;
  readonly riseY?: number;
  /** Visibility, not darkness: 1 = unobstructed, 0 = fully occluded. */
  readonly occlusion?: number;
  /** 1 = matte, 0 = smooth. Only the small directional highlight depends on it. */
  readonly roughness?: number;
}

export interface SurfaceLightSource {
  /** Projected aperture position, with its elevation in the same world units. */
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
}

const { width, height } = CHAMBER_SIZE;
const count = width * height;
const keyLength = Math.hypot(-.48, .32, .82);
const keyX = -.48 / keyLength; const keyY = .32 / keyLength; const keyZ = .82 / keyLength;
/** Shared by baked face lighting and the corresponding fixed device projection. */
export const CHAMBER_KEY_DIRECTION = Object.freeze({ x: keyX, y: keyY, z: keyZ });
const fillLength = Math.hypot(.75, .2, .55);
const fillX = .75 / fillLength; const fillY = .2 / fillLength; const fillZ = .55 / fillLength;
// Viewing rays have constant x and y-z. The camera lies toward +Y,+Z.
const halfLength = Math.hypot(keyX, keyY + Math.SQRT1_2, keyZ + Math.SQRT1_2);
const halfX = keyX / halfLength;
const halfY = (keyY + Math.SQRT1_2) / halfLength;
const halfZ = (keyZ + Math.SQRT1_2) / halfLength;
const sampleX = [-1, 0, 1, 1, 1, 0, -1, -1] as const;
const sampleY = [-1, -1, -1, 0, 1, 1, 1, 0] as const;
const sampleRadii = [1, 3, 6] as const;

/** One visible surface per hard pixel, stamped by the actual painter, never a
 * bounding-box approximation. This is a 2.5D surface cache, not a closed mesh.
 * Arrays use y*width+x. Treat public arrays as read-only outside authoring/tests.
 * bake() is a one-time CPU operation on freshly painted albedo; repeated calls
 * require repainting that albedo first. No Canvas work occurs in receiverResponse. */
export class ChamberSurfaceMap {
  readonly width = width;
  readonly height = height;
  readonly coverage = new Uint8Array(count);
  readonly heights = new Float32Array(count);
  readonly normalX = new Float32Array(count);
  readonly normalY = new Float32Array(count);
  readonly normalZ = new Float32Array(count);
  readonly occlusion = new Float32Array(count).fill(1);
  readonly roughness = new Float32Array(count).fill(1);

  private plane: SurfacePlane | null = null;
  private nx = 0;
  private ny = 0;
  private nz = 1;
  private visibility = 1;
  private matte = 1;

  setPlane(plane: SurfacePlane | null): void {
    if (plane === null) { this.plane = null; return; }
    const [nx, ny, nz] = plane.normal;
    const length = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(length) || length === 0 || !Number.isFinite(plane.elevation)
      || !Number.isFinite(plane.originX ?? 0) || !Number.isFinite(plane.originY ?? 0)
      || !Number.isFinite(plane.riseX ?? 0) || !Number.isFinite(plane.riseY ?? 0)
      || !Number.isFinite(plane.occlusion ?? 1) || !Number.isFinite(plane.roughness ?? 1)) {
      throw new RangeError('Chamber surface planes require finite values and a nonzero normal');
    }
    // Float32 storage must not silently turn a finite but overflowing authored
    // height into Infinity. An affine plane reaches its extrema at the corners.
    const base = plane.elevation - (plane.originX ?? 0) * (plane.riseX ?? 0)
      - (plane.originY ?? 0) * (plane.riseY ?? 0);
    const dx = (width - 1) * (plane.riseX ?? 0); const dy = (height - 1) * (plane.riseY ?? 0);
    if (!Number.isFinite(Math.fround(base)) || !Number.isFinite(Math.fround(base + dx))
      || !Number.isFinite(Math.fround(base + dy)) || !Number.isFinite(Math.fround(base + dx + dy))) {
      throw new RangeError('Chamber surface heights must fit the Float32 cache');
    }
    this.plane = plane;
    this.nx = nx / length; this.ny = ny / length; this.nz = nz / length;
    this.visibility = clamp01(plane.occlusion ?? 1);
    this.matte = clamp01(plane.roughness ?? 1);
  }

  getPlane(): SurfacePlane | null { return this.plane; }

  /** Match ChamberPixels.rect's integer rounding and Canvas negative extents.
   * null leaves the existing host surface in place for painted wear/patches.
   * Black cavities and emissive details are excluded using final RGBA in bake. */
  stamp(x: number, y: number, w: number, h: number): void {
    const plane = this.plane;
    if (!plane || !Number.isFinite(x) || !Number.isFinite(y)
      || !Number.isFinite(w) || !Number.isFinite(h)) return;
    const px = Math.round(x); const py = Math.round(y);
    const endX = px + Math.round(w); const endY = py + Math.round(h);
    const left = Math.max(0, Math.min(px, endX)); const right = Math.min(width, Math.max(px, endX));
    const top = Math.max(0, Math.min(py, endY)); const bottom = Math.min(height, Math.max(py, endY));
    const riseX = plane.riseX ?? 0; const riseY = plane.riseY ?? 0;
    const originX = plane.originX ?? 0; const originY = plane.originY ?? 0;
    for (let sy = top; sy < bottom; sy++) {
      for (let sx = left; sx < right; sx++) {
        const index = sy * width + sx;
        this.coverage[index] = 1;
        this.heights[index] = plane.elevation + (sx - originX) * riseX + (sy - originY) * riseY;
        this.normalX[index] = this.nx; this.normalY[index] = this.ny; this.normalZ[index] = this.nz;
        this.occlusion[index] = this.visibility; this.roughness[index] = this.matte;
      }
    }
  }

  clear(): void {
    this.plane = null;
    this.coverage.fill(0); this.heights.fill(0);
    this.normalX.fill(0); this.normalY.fill(0); this.normalZ.fill(0);
    this.occlusion.fill(1); this.roughness.fill(1);
  }

  /** Diffuse face response only; the caller retains its radial falloff, material
   * mask, light bands and source strength. A co-located light has no direction.
   * No implicit default plane: missing authoring must not receive invented light. */
  receiverResponse(x: number, y: number, source: SurfaceLightSource): number {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width || y >= height
      || !Number.isFinite(source.x) || !Number.isFinite(source.y) || !Number.isFinite(source.elevation)) return 0;
    const index = Math.floor(y) * width + Math.floor(x);
    if (!this.coverage[index]) return 0;
    const elevation = this.heights[index]!;
    const dx = source.x - x;
    const dz = source.elevation - elevation;
    const dy = source.y - y + dz;
    const distance = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(distance) || distance < 1e-6) return 0;
    const cosine = (this.normalX[index]! * dx + this.normalY[index]! * dy + this.normalZ[index]! * dz) / distance;
    return clamp01(cosine) * this.occlusion[index]!;
  }

  /** Returns original albedo for dynamic material eligibility: a shaded solid
   * must never become a black cavity merely because the fixed key faces away. */
  bake(ctx: CanvasRenderingContext2D): Uint8ClampedArray {
    if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
      throw new RangeError('Chamber surface baking requires a 640×400 Canvas');
    }
    const image = ctx.getImageData(0, 0, width, height);
    const pixels = image.data;
    if (pixels.length !== count * 4) throw new RangeError('Chamber surface baking requires 640×400 RGBA');
    const albedo = pixels.slice();
    // Snapshot participation before modifying RGB, so scan order cannot affect AO.
    const receivers = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      if (this.coverage[i] && pixels[i * 4 + 3]
        && receivesLight(pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!)) receivers[i] = pixels[i * 4 + 3]!;
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!receivers[index]) continue;
        const nx = this.normalX[index]!; const ny = this.normalY[index]!; const nz = this.normalZ[index]!;
        const visibility = this.occlusion[index]!;
        const key = Math.max(0, nx * keyX + ny * keyY + nz * keyZ) * .9 * visibility;
        const fill = Math.max(0, nx * fillX + ny * fillY + nz * fillZ) * visibility;
        const ambient = .22 + .78 * visibility;
        const smooth = 1 - this.roughness[index]!;
        const highlight = Math.pow(Math.max(0, nx * halfX + ny * halfY + nz * halfZ), 12)
          * smooth * smooth * .055 * visibility;
        const contact = 1 - this.contactOcclusion(x, y, index, receivers);
        const offset = index * 4;
        // Multiplication retains albedo hue and material contrast. Small cool fill
        // is a directional contribution, not a teal overlay or global exposure.
        pixels[offset] = pixels[offset]! * (.58 * ambient + key + .025 * fill + highlight) * contact;
        pixels[offset + 1] = pixels[offset + 1]! * (.59 * ambient + key + .030 * fill + highlight) * contact;
        pixels[offset + 2] = pixels[offset + 2]! * (.605 * ambient + key + .045 * fill + highlight) * contact;
      }
    }
    ctx.putImageData(image, 0, 0);
    return albedo;
  }

  /** Short screen-space horizon samples reconstructed into world space. A
   * coplanar neighbour has dot(N, displacement)=0, even on a sloped surface.
   * Distant screen overlaps, empty pixels and black cavities cannot occlude.
   * This only adds contact shading; hidden geometry / long cast shadows cannot
   * be reliably recovered from a single visible surface layer. */
  private contactOcclusion(x: number, y: number, index: number, receivers: Uint8Array): number {
    const z = this.heights[index]!;
    const nx = this.normalX[index]!; const ny = this.normalY[index]!; const nz = this.normalZ[index]!;
    let horizonSum = 0;
    for (let direction = 0; direction < sampleX.length; direction++) {
      let horizon = 0;
      for (const radius of sampleRadii) {
        const dx = sampleX[direction]! * radius; const screenDy = sampleY[direction]! * radius;
        const sx = x + dx; const sy = y + screenDy;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const neighbour = sy * width + sx;
        if (!receivers[neighbour]) continue;
        const dz = this.heights[neighbour]! - z;
        const dy = screenDy + dz;
        const abovePlane = nx * dx + ny * dy + nz * dz;
        if (abovePlane <= .6) continue;
        const distance = Math.hypot(dx, dy, dz);
        if (distance >= 12) continue;
        const angle = (abovePlane - .6) / distance;
        horizon = Math.max(horizon, angle * (1 - distance / 12) * receivers[neighbour]! / 255);
      }
      horizonSum += horizon;
    }
    return Math.min(.28, horizonSum / sampleX.length * .65);
  }
}

function clamp01(value: number): number { return Math.min(1, Math.max(0, value)); }

function receivesLight(red: number, green: number, blue: number): boolean {
  if (.2126 * red + .7152 * green + .0722 * blue <= 20) return false;
  const teal = green >= 50 && green > red * 1.35 && blue > red * 1.2;
  const amber = red >= 100 && green >= 65 && red > green * 1.15 && green > blue * 1.5;
  return !teal && !amber;
}
