import { SEA_SURFACE, type SeaMesh } from './sea-geometry';

export interface SeaRasterLayer {
  readonly pixels: Uint32Array;
  /** Orthographic camera depth. Larger values are nearer; empty pixels are -Infinity. */
  readonly depth: Float32Array;
  readonly surface: Uint8Array;
}
export interface SeaMaterialPixels { width: number; height: number; data: Uint8ClampedArray }
export interface SeaRasterConfig {
  width: number; height: number; pixelStep: number;
  compression: number; heightProjection: number;
}

const endianBytes = new Uint8Array(new Uint32Array([0x01020304]).buffer);
const LITTLE_ENDIAN = endianBytes[0] === 4;
/** A word whose bytes match an ImageData pixel, on either host byte order. */
export function packSeaRgba(r: number, g: number, b: number, a = 255): number {
  return LITTLE_ENDIAN ? ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

/** Two independent depth buffers allow presentation to fade only the main body.
 * Faces are rasterized with barycentric depth, never painter-sorted by their center. */
export class SeaRaster {
  readonly width: number;
  readonly height: number;
  readonly body: SeaRasterLayer;
  readonly fall: SeaRasterLayer;
  private readonly projected = new Float32Array(9000 * 6);
  private readonly palette = new Uint32Array(128 * 256);
  private readonly fallPalette = new Uint32Array(128 * 256);
  private texture: SeaMaterialPixels;
  constructor(readonly config: SeaRasterConfig, texture?: SeaMaterialPixels) {
    this.width = Math.ceil(config.width / config.pixelStep);
    this.height = Math.ceil(config.height / config.pixelStep);
    const size = this.width * this.height;
    const layer = (): SeaRasterLayer => ({ pixels: new Uint32Array(size), depth: new Float32Array(size), surface: new Uint8Array(size) });
    this.body = layer(); this.fall = layer();
    this.texture = texture ?? makeFallbackSeaMaterial();
    // Texture provides travelling material variation. Directional light comes from
    // the actual mesh normals; it remains readable without a detailed texture.
    for (let light = 0; light < 128; light++) for (let texel = 0; texel < 256; texel++) {
      const illumination = light / 127, material = texel / 255;
      const grain = .68 + material * .57;
      const reflection = Math.pow(Math.max(0, (material - .40) / .60), 1.45) * (.42 + illumination * .58);
      const r = Math.min(255, Math.round((13 + illumination * 34) * grain + reflection * 106));
      const g = Math.min(255, Math.round((29 + illumination * 48) * grain + reflection * 123));
      const b = Math.min(255, Math.round((37 + illumination * 48) * grain + reflection * 120));
      this.palette[light * 256 + texel] = packSeaRgba(r, g, b);
      // Thin moving sheets transmit; the broken reflective ridges carry their highlights.
      this.fallPalette[light * 256 + texel] = packSeaRgba(
        Math.min(255, Math.round(r + reflection * 28)), Math.min(255, Math.round(g + reflection * 27)),
        Math.min(255, Math.round(b + reflection * 19)), Math.round(19 + material * 184));
    }
  }

  render(body: SeaMesh, fall: SeaMesh, elapsedMs: number, retracting = false): void {
    this.clear(this.body); this.clear(this.fall);
    this.drawMesh(body, this.body, elapsedMs, false);
    this.drawMesh(fall, this.fall, elapsedMs, true, retracting ? -1 : 1);
  }

  private clear(layer: SeaRasterLayer): void {
    layer.pixels.fill(0); layer.depth.fill(-Infinity); layer.surface.fill(SEA_SURFACE.none);
  }

  /** Public to make depth/intersection correctness testable without a browser. */
  drawMesh(mesh: SeaMesh, target: SeaRasterLayer, elapsedMs: number, falling = false, flowDirection = 1): void {
    if (mesh.vertexCount > this.projected.length / 6) throw new Error('Sea raster projection allocation exhausted');
    const { compression: k, heightProjection: h, pixelStep } = this.config;
    const cameraY = Math.sqrt(Math.max(0, 1 - k * k)), time = elapsedMs / 1000;
    const pp = this.projected, p = mesh.positions, n = mesh.normals, uv = mesh.uv;
    const lightX = -.369, lightY = .505, lightZ = .780;
    for (let i = 0; i < mesh.vertexCount; i++) {
      const p3 = i * 3, p2 = i * 2, q = i * 6;
      const ny = n[p3 + 1]!, nz = n[p3 + 2]!;
      const diffuse = Math.max(0, n[p3]! * lightX + ny * lightY + nz * lightZ);
      const view = Math.abs(ny * cameraY + nz * k);
      const grazing = Math.pow(1 - Math.min(1, view), 3);
      pp[q] = p[p3]! / pixelStep;
      pp[q + 1] = (p[p3 + 1]! - p[p3 + 2]! * h) / pixelStep;
      pp[q + 2] = p[p3 + 1]! * cameraY + p[p3 + 2]! * k;
      // The underside receives a little bed bounce, still distinctly below top light.
      pp[q + 3] = Math.min(127, (16 + diffuse * 82 + grazing * 19 + Math.max(0, -nz) * 9 + (falling ? 9 : 0)));
      pp[q + 4] = uv[p2]! + Math.sin(uv[p2 + 1]! / 97 + time * .61) * (falling ? 4 : 7);
      pp[q + 5] = uv[p2 + 1]! - time * (falling ? 92 * flowDirection : 18);
    }
    const pixels = target.pixels, depth = target.depth, tags = target.surface;
    const tw = this.texture.width, th = this.texture.height, td = this.texture.data;
    const rasterWidth = this.width, rasterHeight = this.height, palette = falling ? this.fallPalette : this.palette;
    for (let face = 0; face < mesh.triangleCount; face++) {
      let ia = mesh.indices[face * 3]! * 6, ib = mesh.indices[face * 3 + 1]! * 6, ic = mesh.indices[face * 3 + 2]! * 6;
      const ax = pp[ia]!, ay = pp[ia + 1]!;
      let bx = pp[ib]!, by = pp[ib + 1]!, cx = pp[ic]!, cy = pp[ic + 1]!;
      let area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < .00001) continue;
      if (area < 0) {
        const index = ib; ib = ic; ic = index;
        bx = pp[ib]!; by = pp[ib + 1]!; cx = pp[ic]!; cy = pp[ic + 1]!; area = -area;
      }
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - .5));
      const x1 = Math.min(rasterWidth - 1, Math.floor(Math.max(ax, bx, cx) - .5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - .5));
      const y1 = Math.min(rasterHeight - 1, Math.floor(Math.max(ay, by, cy) - .5));
      if (x0 > x1 || y0 > y1) continue;
      const invArea = 1 / area, tag = mesh.surfaces[face]!;
      const waX = (by - cy) * invArea, waY = (cx - bx) * invArea;
      const wbX = (cy - ay) * invArea, wbY = (ax - cx) * invArea;
      const startX = x0 + .5, startY = y0 + .5;
      let rowA = ((bx - startX) * (cy - startY) - (by - startY) * (cx - startX)) * invArea;
      let rowB = ((cx - startX) * (ay - startY) - (cy - startY) * (ax - startX)) * invArea;
      const az = pp[ia + 2]!, bz = pp[ib + 2]!, cz = pp[ic + 2]!;
      const al = pp[ia + 3]!, bl = pp[ib + 3]!, cl = pp[ic + 3]!;
      const au = pp[ia + 4]!, bu = pp[ib + 4]!, cu = pp[ic + 4]!;
      const av = pp[ia + 5]!, bv = pp[ib + 5]!, cv = pp[ic + 5]!;
      for (let y = y0; y <= y1; y++, rowA += waY, rowB += wbY) {
        let wa = rowA, wb = rowB, index = y * rasterWidth + x0;
        for (let x = x0; x <= x1; x++, index++, wa += waX, wb += wbX) {
          const wc = 1 - wa - wb;
          if (wa < -.00001 || wb < -.00001 || wc < -.00001) continue;
          const z = az * wa + bz * wb + cz * wc;
          if (z < depth[index]!) continue;
          const surfaceU = au * wa + bu * wb + cu * wc;
          const surfaceV = av * wa + bv * wb + cv * wc;
          // Water accelerates down the sheet. Turn the sea's broad wave material
          // into long travelling stream reflections, rather than wrapping the
          // same horizontal wave bands around a hanging solid object.
          const u = Math.floor(falling ? surfaceV * .19 : surfaceU * .72);
          const v = Math.floor(falling ? surfaceU * 2.3 : surfaceV * .72);
          const tx = ((u % tw) + tw) % tw, ty = ((v % th) + th) % th;
          const ti = (ty * tw + tx) * 4;
          const luminance = (td[ti]! * 54 + td[ti + 1]! * 183 + td[ti + 2]! * 19) >>> 8;
          // The source texture is intentionally dark (median about 24). Preserve
          // its travelling wave hierarchy instead of flattening it into teal clay.
          const value = Math.min(255, Math.max(0, Math.round((luminance - 7) * 2.8)));
          const light = Math.max(0, Math.min(127, Math.round(al * wa + bl * wb + cl * wc)));
          pixels[index] = palette[light * 256 + value]!;
          depth[index] = z; tags[index] = tag;
        }
      }
    }
  }

  /** Arrays stay owned until this renderer is unreachable; releasing the texture
   * prevents an independently retained raster from retaining decoded artwork. */
  destroy(): void { this.texture = { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) }; }
}

function makeFallbackSeaMaterial(): SeaMaterialPixels {
  const width = 256, height = 256, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const broad = Math.sin(x / width * Math.PI * 8 + Math.sin(y / height * Math.PI * 4) * 1.4);
    const fine = Math.sin(x / width * Math.PI * 22 - y / height * Math.PI * 8);
    const value = 107 + broad * 28 + fine * 9, p = (y * width + x) * 4;
    data[p] = value; data[p + 1] = value; data[p + 2] = value; data[p + 3] = 255;
  }
  return { width, height, data };
}
