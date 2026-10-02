import { type NativeVolumeMesh, type NativeVolumeMaterialSlot, NATIVE_VOLUME_MATERIALS } from './native-volume-geometry';

export interface NativeVolumeRasterConfig {
  /** World XY origin and native-pixel extent. No camera tilt or Z projection. */
  x: number; y: number; width: number; height: number;
  pixelSize?: number; supportCellSize?: number; opticalHeight: number;
}
export interface NativeVolumeRaster {
  readonly config: Readonly<NativeVolumeRasterConfig>;
  readonly width: number; readonly height: number; readonly pixelSize: number;
  readonly cellSize: number; readonly columns: number; readonly rows: number;
  /** Collision coverage, optical interpretation, visible matter are independent. */
  readonly occupancy: Uint8Array; readonly optical: Uint8Array;
  readonly cellHeight: Float32Array;
  readonly matter: Uint8Array;
  readonly objectId: Int32Array;
  readonly material: Uint8Array;
  readonly region: Uint8Array;
  readonly family: Uint8Array;
  readonly heightField: Float32Array;
  readonly normals: Float32Array;
  readonly uv: Float32Array;
  readonly occupiedPixels: Uint32Array;
  readonly ambientOcclusion: Float32Array;
}
export type NativeVolumeColor = readonly [number, number, number];
/** RGB colours are bytes. Dynamic light colour below is RGB in [0, 1]. */
export interface NativeVolumeMaterial {
  base: NativeVolumeColor;
  dark: NativeVolumeColor;
  light: NativeVolumeColor;
  roughness: number;
  /** Strength of coherent 4–16 pixel material structure, not random dirt. */
  structure: number;
  emission?: NativeVolumeColor;
  emissionStrength?: number;
}
export type NativeVolumeMaterialSet = Readonly<Record<NativeVolumeMaterialSlot, NativeVolumeMaterial>>;
export interface NativeVolumeLight {
  x: number; y: number; z: number; radius: number; intensity: number;
  color: NativeVolumeColor;
  castsShadow?: boolean;
}
export interface NativeVolumeViewport { x: number; y: number; width: number; height: number }
export interface NativeVolumeLightingOptions {
  ambient: number;
  /** Caller-owned authoritative Rift visibility at these exact native pixels.
   * Values <= 0 skip lighting work; positive values multiply the final RGB. */
  visibility?: Float32Array;
  /** Controlled material activity. Caller shares this factor with its source light. */
  emissionScale?: number;
  viewport?: Readonly<NativeVolumeViewport>;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const FAMILY_ID = { 'folded-slab': 1, 'fibre-knot': 2, 'broken-shell': 3 } as const;

interface SurfaceShadowCache {
  x: number; y: number; z: number;
  /** Sparse in the same occupied-pixel order as the immutable raster. */
  values: Float32Array;
}

/** Static preparation only: barycentric, highest-Z opaque surface. Source UV,
 * normal, object and material IDs survive the bake for moving-light response. */
export function compileNativeVolumeRaster(meshes: readonly NativeVolumeMesh[], config: Readonly<NativeVolumeRasterConfig>): NativeVolumeRaster {
  const pixelSize = config.pixelSize ?? 1, cellSize = config.supportCellSize ?? 8;
  if (![config.x, config.y, config.width, config.height, pixelSize, cellSize, config.opticalHeight].every(Number.isFinite)
    || config.width <= 0 || config.height <= 0 || pixelSize < 1 || cellSize < pixelSize
    || config.opticalHeight < 0 || !Number.isInteger(pixelSize) || !Number.isInteger(cellSize)) throw new Error('Invalid native volume raster bounds');
  const width = Math.ceil(config.width / pixelSize), height = Math.ceil(config.height / pixelSize);
  if (width * height > 4_194_304) throw new Error('Native volume raster exceeds its bounded 4M pixel allocation');
  const size = width * height, columns = Math.ceil(config.width / cellSize), rows = Math.ceil(config.height / cellSize);
  const matter = new Uint8Array(size), objectId = new Int32Array(size), material = new Uint8Array(size), family = new Uint8Array(size), region = new Uint8Array(size);
  const heightField = new Float32Array(size), normals = new Float32Array(size * 3), uv = new Float32Array(size * 2);
  heightField.fill(-Infinity);
  const usedIds = new Set<number>();
  for (const mesh of meshes) {
    if (usedIds.has(mesh.spec.id)) throw new Error(`Duplicate native volume id ${mesh.spec.id}`);
    usedIds.add(mesh.spec.id);
    const p = mesh.positions, n = mesh.normals, tex = mesh.uv;
    for (let f = 0; f < mesh.triangleCount; f++) {
      const ia = mesh.indices[f * 3]!, ib = mesh.indices[f * 3 + 1]!, ic = mesh.indices[f * 3 + 2]!;
      const a = ia * 3, b = ib * 3, c = ic * 3;
      const ax = (p[a]! - config.x) / pixelSize, ay = (p[a + 1]! - config.y) / pixelSize;
      const bx = (p[b]! - config.x) / pixelSize, by = (p[b + 1]! - config.y) / pixelSize;
      const cx = (p[c]! - config.x) / pixelSize, cy = (p[c + 1]! - config.y) / pixelSize;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-7) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - .5)), x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - .5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - .5)), y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - .5));
      const inv = 1 / area, waX = (by - cy) * inv, waY = (cx - bx) * inv, wbX = (cy - ay) * inv, wbY = (ax - cx) * inv;
      const startX = x0 + .5, startY = y0 + .5;
      let rowA = ((bx - startX) * (cy - startY) - (by - startY) * (cx - startX)) * inv;
      let rowB = ((cx - startX) * (ay - startY) - (cy - startY) * (ax - startX)) * inv;
      for (let y = y0; y <= y1; y++, rowA += waY, rowB += wbY) {
        let wa = rowA, wb = rowB, index = y * width + x0;
        for (let x = x0; x <= x1; x++, index++, wa += waX, wb += wbX) {
          const wc = 1 - wa - wb;
          if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
          const z = wa * p[a + 2]! + wb * p[b + 2]! + wc * p[c + 2]!;
          if (z < heightField[index]! - 1e-5 || (Math.abs(z - heightField[index]!) < 1e-5 && mesh.spec.id > objectId[index]!)) continue;
          matter[index] = 1; objectId[index] = mesh.spec.id; material[index] = mesh.materials[f]!;
          region[index] = mesh.regions[f]!;
          family[index] = FAMILY_ID[mesh.spec.family]; heightField[index] = z;
          let nx = n[a]! * wa + n[b]! * wb + n[c]! * wc;
          let ny = n[a + 1]! * wa + n[b + 1]! * wb + n[c + 1]! * wc;
          let nz = n[a + 2]! * wa + n[b + 2]! * wb + n[c + 2]! * wc;
          // The visible side of a two-sided laminate faces the orthographic eye.
          // Its opposite side is independently present in the closed solid.
          if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          const norm = Math.hypot(nx, ny, nz) || 1, q = index * 3;
          normals[q] = nx / norm; normals[q + 1] = ny / norm; normals[q + 2] = nz / norm;
          uv[index * 2] = tex[ia * 2]! * wa + tex[ib * 2]! * wb + tex[ic * 2]! * wc;
          uv[index * 2 + 1] = tex[ia * 2 + 1]! * wa + tex[ib * 2 + 1]! * wb + tex[ic * 2 + 1]! * wc;
        }
      }
    }
  }
  const occupancy = new Uint8Array(columns * rows), optical = new Uint8Array(columns * rows), cellHeight = new Float32Array(columns * rows);
  const occupied: number[] = [], ambientOcclusion = new Float32Array(size);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!matter[i]) continue;
    occupied.push(i);
    const cell = Math.floor((y + .5) * pixelSize / cellSize) * columns + Math.floor((x + .5) * pixelSize / cellSize);
    occupancy[cell] = 1; cellHeight[cell] = Math.max(cellHeight[cell]!, heightField[i]!);
    if (heightField[i]! >= config.opticalHeight) optical[cell] = 1;
    let occlusion = 0;
    // Near-field horizon sampled once from the same opaque height field.
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction / 8 * Math.PI * 2;
      let horizon = 0;
      for (const distance of [3, 7, 14]) {
        const sx = Math.round(x + Math.cos(angle) * distance), sy = Math.round(y + Math.sin(angle) * distance);
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const h = heightField[sy * width + sx]! - heightField[i]!;
        horizon = Math.max(horizon, Math.atan2(Math.max(0, h - .6), distance * pixelSize));
      }
      occlusion += horizon / (Math.PI * .5);
    }
    ambientOcclusion[i] = 1 - Math.min(.67, occlusion / 8 * .9);
  }
  return { config: Object.freeze({ ...config }), width, height, pixelSize, cellSize, columns, rows,
    occupancy, optical, cellHeight, matter, objectId, material, region, family, heightField, normals, uv,
    occupiedPixels: new Uint32Array(occupied), ambientOcclusion };
}

/** No matter is represented by -Infinity, never by a black-emitting material. */
export function nativeVolumeHeightAt(raster: NativeVolumeRaster, x: number, y: number): number {
  const px = Math.floor((x - raster.config.x) / raster.pixelSize), py = Math.floor((y - raster.config.y) / raster.pixelSize);
  return px < 0 || py < 0 || px >= raster.width || py >= raster.height ? -Infinity : raster.heightField[py * raster.width + px]!;
}

export function nativeVolumeOccludesAt(raster: NativeVolumeRaster, x: number, y: number, z: number): boolean {
  return nativeVolumeHeightAt(raster, x, y) > z + .5;
}

/** A bounded opaque height-field ray. This is not an undercut/cave tracer: the
 * I02 contract disallows walking under these solid projected envelopes. */
export function nativeVolumeLightVisibility(raster: NativeVolumeRaster, x: number, y: number, z: number, light: Readonly<NativeVolumeLight>): number {
  const dx = light.x - x, dy = light.y - y, dz = light.z - z;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.min(48, Math.max(2, Math.ceil(distance / 4)));
  let visibility = 1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps, rayZ = z + dz * t + 1.1;
    const height = nativeVolumeHeightAt(raster, x + dx * t, y + dy * t);
    if (height > rayZ) {
      const blockage = clamp01((height - rayZ) / 2.5);
      visibility = Math.min(visibility, 1 - blockage);
      if (visibility <= .01) return 0;
    }
  }
  return visibility;
}

/** Coherent material structure follows surface UV. Patterns have restrained
 * amplitude and do not encode illumination: disabling them preserves volume. */
function materialStructure(family: number, slot: number, region: number, u: number, v: number): number {
  if (family === 1) {
    const flow = v + Math.sin(u * .026) * 7;
    if (slot === 1) {
      // Connected layers stop at the pressure outlet. Their cleaved chunks are
      // 4–16 px across; small changes follow the bedding, never screen noise.
      const layer = Math.floor(flow / 3.5);
      const split = Math.sin(u * .24 + layer * 1.7) > .32;
      return split ? .55 : -.35;
    }
    const front = Math.sin(u * .061 + Math.sin(flow * .046) * 1.6);
    if (region === 1) return front > .3 ? -.70 : -.30; // compressed, polished beds
    if (region === 2) return front > -.30 ? .85 : .28; // exposed peel, old layer below
    if (region === 3) return Math.sin(u * .17 + flow * .10) > .1 ? .65 : -.5;
    // Quiet intact faces have only two broad material populations. Volume and
    // wear remain legible when this entire contribution is disabled.
    return front > .62 ? .26 : front < -.55 ? -.25 : .04;
  }
  if (family === 2) return Math.sin(v * .61 + Math.sin(u * .027) * .38) * .46
    + Math.sin(v * .19 - u * .011) * .22;
  if (slot === 1) return Math.sin(v * .74 + Math.sin(u * .031) * .3) * .58;
  return Math.sin(v * .12 + Math.sin(u * .016) * 1.5) * .36 + Math.sin(v * .29 + u * .006) * .10;
}

/** Static albedo preparation + allocation-free lighting. The destination is an
 * ordinary RGBA byte buffer suitable for ImageData or a renderer texture. */
export class NativeVolumeLighting {
  readonly albedo: Uint8ClampedArray;
  readonly roughness: Float32Array;
  readonly emission: Float32Array;
  readonly materialSets: ReadonlyMap<number, NativeVolumeMaterialSet>;
  private readonly surfaceSlots: Int32Array;
  private readonly shadows = new WeakMap<Readonly<NativeVolumeLight>, SurfaceShadowCache>();
  constructor(readonly raster: NativeVolumeRaster, materials: NativeVolumeMaterialSet | ReadonlyMap<number, NativeVolumeMaterialSet>) {
    this.materialSets = materials instanceof Map ? materials : new Map([[0, materials as NativeVolumeMaterialSet]]);
    const size = raster.width * raster.height;
    this.surfaceSlots = new Int32Array(size).fill(-1);
    for (let slot = 0; slot < raster.occupiedPixels.length; slot++) this.surfaceSlots[raster.occupiedPixels[slot]!] = slot;
    this.albedo = new Uint8ClampedArray(size * 3); this.roughness = new Float32Array(size); this.emission = new Float32Array(size * 3);
    for (const index of raster.occupiedPixels) {
      const set = this.materialSets.get(raster.objectId[index]!) ?? this.materialSets.get(0);
      if (!set) throw new Error(`No material set for native volume ${raster.objectId[index]}`);
      const slot = raster.material[index]!, m = set[NATIVE_VOLUME_MATERIALS[slot]!];
      if (!m || !Number.isFinite(m.roughness) || m.roughness < 0 || m.roughness > 1
        || !Number.isFinite(m.structure) || m.structure < 0 || m.structure > 1) throw new Error('Invalid native volume material response');
      if (m.emissionStrength !== undefined && (!Number.isFinite(m.emissionStrength) || m.emissionStrength < 0)) throw new Error('Invalid native volume emission strength');
      for (let c = 0; c < 3; c++) {
        if (![m.base[c], m.dark[c], m.light[c], m.emission?.[c] ?? 0].every(value => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 255)) {
          throw new Error('Invalid native volume material colour');
        }
      }
      const region = raster.region[index]!;
      const structure = materialStructure(raster.family[index]!, slot, region, raster.uv[index * 2]!, raster.uv[index * 2 + 1]!) * m.structure;
      const tone = structure < 0 ? m.dark : m.light, amount = Math.min(1, Math.abs(structure));
      for (let c = 0; c < 3; c++) {
        const base = m.base[c]!, target = tone[c]!;
        if (!Number.isFinite(base) || !Number.isFinite(target) || base < 0 || base > 255 || target < 0 || target > 255) throw new Error('Invalid native volume material colour');
        this.albedo[index * 3 + c] = base + (target - base) * amount;
        this.emission[index * 3 + c] = (m.emission?.[c] ?? 0) * (m.emissionStrength ?? 0);
      }
      this.roughness[index] = region === 1 ? m.roughness * .64 : region === 2 ? Math.min(1, m.roughness * 1.12)
        : region === 3 ? Math.max(.91, m.roughness) : m.roughness;
    }
  }

  private shadowCache(light: Readonly<NativeVolumeLight>): SurfaceShadowCache {
    let cache = this.shadows.get(light);
    if (!cache) {
      cache = { x: light.x, y: light.y, z: light.z, values: new Float32Array(this.raster.occupiedPixels.length).fill(-1) };
      this.shadows.set(light, cache);
    } else if (cache.x !== light.x || cache.y !== light.y || cache.z !== light.z) {
      cache.x = light.x; cache.y = light.y; cache.z = light.z;
      cache.values.fill(-1);
    }
    return cache;
  }

  /** The immutable geometry owns this result. Source intensity/colour may vary
   * without recasting the same ray; movement in ANY axis invalidates it. Shared
   * by finite surface visibility and illumination to avoid duplicate rays. */
  lightVisibilityAt(index: number, light: Readonly<NativeVolumeLight>): number {
    const slot = this.surfaceSlots[index];
    if (slot === undefined || slot < 0) return 0;
    if (light.castsShadow === false) return 1;
    const cache = this.shadowCache(light);
    if (cache.values[slot]! >= 0) return cache.values[slot]!;
    const r = this.raster;
    cache.values[slot] = nativeVolumeLightVisibility(r,
      r.config.x + (index % r.width + .5) * r.pixelSize,
      r.config.y + (Math.floor(index / r.width) + .5) * r.pixelSize,
      r.heightField[index]!, light);
    return cache.values[slot]!;
  }

  render(lights: readonly NativeVolumeLight[], output: Uint8ClampedArray, options: Readonly<NativeVolumeLightingOptions>): void {
    const r = this.raster, width = r.width, pixelSize = r.pixelSize;
    if (output.length !== width * r.height * 4) throw new Error('Native volume output buffer size mismatch');
    if (!Number.isFinite(options.ambient) || options.ambient < 0 || options.ambient > 1) throw new Error('Native volume ambient must be in [0,1]');
    if (options.visibility && options.visibility.length !== width * r.height) throw new Error('Native volume visibility size mismatch');
    if (options.emissionScale !== undefined && (!Number.isFinite(options.emissionScale) || options.emissionScale < 0)) throw new Error('Invalid native volume activity factor');
    for (let j = 0; j < lights.length; j++) {
      const light = lights[j]!;
      if (!Number.isFinite(light.x) || !Number.isFinite(light.y) || !Number.isFinite(light.z)
        || !Number.isFinite(light.radius) || !Number.isFinite(light.intensity) || light.radius < 0 || light.intensity < 0) throw new Error('Invalid native volume light');
      for (let c = 0; c < 3; c++) if (!Number.isFinite(light.color[c]) || light.color[c]! < 0 || light.color[c]! > 1) throw new Error('Light colour must use normalized RGB');
    }
    output.fill(0);
    const view = options.viewport, emissionScale = options.emissionScale ?? 1;
    for (let at = 0; at < r.occupiedPixels.length; at++) {
      const index = r.occupiedPixels[at]!, x = r.config.x + (index % width + .5) * pixelSize;
      const visibility = options.visibility ? clamp01(options.visibility[index]!) : 1;
      if (visibility <= 0) continue;
      const y = r.config.y + (Math.floor(index / width) + .5) * pixelSize;
      if (view && (x < view.x || y < view.y || x >= view.x + view.width || y >= view.y + view.height)) continue;
      const q = index * 3, z = r.heightField[index]!, nx = r.normals[q]!, ny = r.normals[q + 1]!, nz = r.normals[q + 2]!;
      const ao = r.ambientOcclusion[index]!, ambient = options.ambient * ao;
      let lr = ambient, lg = ambient, lb = ambient, sr = 0, sg = 0, sb = 0;
      for (let j = 0; j < lights.length; j++) {
        const light = lights[j]!;
        if (light.radius <= 0 || light.intensity <= 0) continue;
        const dx = light.x - x, dy = light.y - y, dz = light.z - z, distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared >= light.radius * light.radius) continue;
        const distance = Math.sqrt(distanceSquared), inv = 1 / Math.max(.01, distance);
        const ndotl = Math.max(0, (nx * dx + ny * dy + nz * dz) * inv);
        if (ndotl <= 0) continue;
        const visibility = this.lightVisibilityAt(index, light);
        if (visibility <= .001) continue;
        const falloff = 1 - distance / light.radius;
        const energy = light.intensity * falloff * falloff * visibility;
        const diffuse = ndotl * energy;
        const hz = dz * inv + 1, halfLength = Math.sqrt(dx * dx * inv * inv + dy * dy * inv * inv + hz * hz) || 1;
        const ndoth = Math.max(0, (nx * dx * inv + ny * dy * inv + nz * hz) / halfLength);
        const rough = this.roughness[index]!, specular = Math.pow(ndoth, 7 + (1 - rough) * 57) * (1 - rough) * energy * 52;
        lr += diffuse * light.color[0]; lg += diffuse * light.color[1]; lb += diffuse * light.color[2];
        sr += specular * light.color[0]; sg += specular * light.color[1]; sb += specular * light.color[2];
      }
      const o = index * 4;
      output[o] = (this.albedo[q]! * lr + sr + this.emission[q]! * emissionScale) * visibility;
      output[o + 1] = (this.albedo[q + 1]! * lg + sg + this.emission[q + 1]! * emissionScale) * visibility;
      output[o + 2] = (this.albedo[q + 2]! * lb + sb + this.emission[q + 2]! * emissionScale) * visibility;
      output[o + 3] = 255;
    }
  }

  /** Optional shared-geometry ground receiver. Alpha only, so the caller clips
   * this against actual floor matter instead of ever lighting the Rift void. */
  renderGroundShadow(light: Readonly<NativeVolumeLight>, output: Uint8ClampedArray, strength: number, viewport?: Readonly<NativeVolumeViewport>): void {
    const r = this.raster;
    if (output.length !== r.width * r.height) throw new Error('Ground shadow output must be one byte per pixel');
    output.fill(0);
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      const index = y * r.width + x;
      if (r.matter[index]) continue;
      const wx = r.config.x + (x + .5) * r.pixelSize, wy = r.config.y + (y + .5) * r.pixelSize;
      if (viewport && (wx < viewport.x || wy < viewport.y || wx >= viewport.x + viewport.width || wy >= viewport.y + viewport.height)) continue;
      if ((wx - light.x) ** 2 + (wy - light.y) ** 2 >= light.radius ** 2) continue;
      output[index] = 255 * clamp01(strength) * (1 - nativeVolumeLightVisibility(r, wx, wy, 0, light));
    }
  }
}
