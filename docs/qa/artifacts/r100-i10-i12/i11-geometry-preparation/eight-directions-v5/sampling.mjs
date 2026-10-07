// src/generation/world-study/master-ground-field.ts
var clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function hash(x, y, seed) {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}
function field(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  return (hash(ix, iy, seed) * (1 - fx) + hash(ix + 1, iy, seed) * fx) * (1 - fy) + (hash(ix, iy + 1, seed) * (1 - fx) + hash(ix + 1, iy + 1, seed) * fx) * fy;
}
function sampleMasterMaterial(material, u, v, seed, out, event = "compact") {
  if (material === "granular") {
    const scale = event === "loose" ? 5.5 : event === "cleaved" ? 10 : 14;
    const gx = u / scale, gy = v / (scale * 0.83), cx = Math.floor(gx), cy = Math.floor(gy);
    let nearest = 10, second = 10, identity = 0;
    for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
      const px = xx + 0.18 + hash(xx, yy, seed + 301) * 0.64, py = yy + 0.18 + hash(xx, yy, seed + 307) * 0.64;
      const dx2 = gx - px, dy2 = gy - py, d = dx2 * dx2 + dy2 * dy2;
      if (d < nearest) {
        second = nearest;
        nearest = d;
        identity = hash(xx, yy, seed + 311);
      } else if (d < second) second = d;
    }
    const interior = smooth(clamp((second - nearest) * 4.2)), broad2 = field(u / 117, v / 63, seed + 317);
    out.tone = clamp(0.36 + interior * 0.025 + (identity - 0.5) * 0.055 + (broad2 - 0.5) * 0.16);
    out.roughness = event === "cleaved" ? 0.74 : 0.91;
    out.relief = interior * (event === "loose" ? 0.045 : 0.025) + (broad2 - 0.5) * 0.13;
    return;
  }
  if (material === "membrane") {
    const broad2 = field(u / 103, v / 81, seed + 331), warp2 = field(u / 37, v / 71, seed + 337);
    const tension = Math.sin(v * 0.085 + u * 0.018 + warp2 * 2.7), crease = Math.pow(Math.max(0, tension), 18);
    const scuff = field(u / 11, v / 29, seed + 347);
    out.tone = clamp(0.48 + (broad2 - 0.5) * 0.15 + (scuff - 0.5) * 0.055 - crease * 0.12 + (event === "cleaved" ? 0.065 : 0));
    out.roughness = event === "loose" ? 0.78 : event === "cleaved" ? 0.69 : 0.39;
    out.relief = (broad2 - 0.5) * 0.12 - crease * 0.28;
    return;
  }
  if (material === "gel") {
    const broad2 = field(u / 121, v / 79, seed + 359), flow = field(u / 91, v / 26, seed + 367);
    const curl = Math.sin(v * 0.047 + flow * 4 + Math.sin(u * 0.023) * 1.3);
    const inclusion = Math.max(0, field(u / 8, v / 24, seed + 373) - 0.63) * 0.6;
    out.tone = clamp(0.38 + (broad2 - 0.5) * 0.18 + curl * 0.032 - inclusion + (event === "cleaved" ? 0.06 : 0));
    out.roughness = event === "loose" ? 0.66 : event === "cleaved" ? 0.51 : 0.24;
    out.relief = curl * 0.18 + (broad2 - 0.5) * 0.09 - inclusion * 0.26;
    return;
  }
  const warp = field(u / 113, v / 91, seed + 41) - 0.5;
  const a = u + warp * 12, b = v + field(u / 89, v / 67, seed + 47) * 7;
  const broad = field(a / 103, b / 71, seed + 59);
  const history = field(a / 71, b / 43, seed + 97) * 0.72 + field(a / 27, b / 19, seed + 131) * 0.28;
  const bias = event === "cleaved" ? 0.12 : event === "loose" ? 0.04 : -0.06;
  const exposure = smooth(clamp((history + bias - 0.48) * 12));
  const stretch = material === "crystal" ? 2.2 : material === "glaze" ? 0.74 : 1;
  const pu = Math.floor(a / 2) * 2 / stretch, pv = Math.floor(b / 2) * 2;
  const cluster = field(pu / 23, pv / 15, seed + 173);
  const clusterStep = Math.floor(cluster * 5) / 4;
  const mottling = field(pu / 7, pv / 5, seed + 181);
  const grain = hash(Math.floor(u), Math.floor(v), seed + 191);
  const compactTone = 0.32 + (broad - 0.5) * 0.13 + (field(a / 32, b / 24, seed + 193) - 0.5) * 0.055;
  const faceTone = 0.55 + (broad - 0.5) * 0.12 + (clusterStep - 0.5) * 0.22 + (mottling - 0.5) * 0.045;
  const row = Math.floor(b / 26), section = Math.floor(a / 53);
  const markV = (row + 0.23 + hash(section, row, seed + 211) * 0.5) * 26;
  const markU = (section + 0.2 + hash(section, row, seed + 223) * 0.5) * 53;
  const dx = (a - markU) / (8 + hash(section, row, seed + 227) * 13);
  const dy = b - markV + (a - markU) * 0.075;
  const mark = hash(section, row, seed + 229) > 0.57 && exposure > 0.78 ? clamp(1 - Math.abs(dx)) * clamp(1.2 - Math.abs(dy)) : 0;
  const pore = exposure > 0.5 && cluster < 0.39 && grain < 0.07 ? 0.07 : 0;
  const chip = (grain - 0.5) * (event === "loose" ? 0.08 : 0.025);
  const compactRough = material === "glaze" ? 0.38 : material === "crystal" ? 0.64 : 0.85;
  const faceRough = material === "glaze" ? 0.72 : material === "crystal" ? 0.38 : 0.67;
  const loose = event === "loose";
  const aggregate = Math.floor(field(a / 5.5, b / 4.5, seed + 241) * 5) / 4;
  const looseTone = 0.37 + (broad - 0.5) * 0.12 + (aggregate - 0.5) * 0.27 + chip;
  out.tone = clamp(loose ? looseTone : compactTone * (1 - exposure) + faceTone * exposure - mark * 0.12 - pore + chip, 0.1, 0.82);
  out.roughness = loose ? 0.94 : compactRough * (1 - exposure) + faceRough * exposure + mark * 0.07;
  const faceRelief = (clusterStep - 0.5) * 0.24 + (mottling - 0.5) * 0.08;
  out.relief = loose ? (aggregate - 0.5) * 0.48 : (1 - exposure) * 0.33 + faceRelief * exposure - mark * 0.18 + (broad - 0.5) * 0.1;
}

// src/generation/world-study/native-volume-cellular.ts
var TAU = Math.PI * 2;

// src/generation/world-study/native-volume-geometry.ts
var NATIVE_VOLUME_MATERIALS = ["outer", "cut", "inner", "joint"];
var TAU2 = Math.PI * 2;

// src/generation/world-study/native-volume-raster.ts
var clamp01 = (n) => Math.max(0, Math.min(1, n));
var FAMILY_ID = { "folded-slab": 1, "fibre-knot": 2, "broken-shell": 3, "granular-ridge": 4, "membrane-rim": 5, "gel-flow": 6 };
function compileNativeVolumeRaster(meshes, config) {
  const pixelSize = config.pixelSize ?? 1, cellSize = config.supportCellSize ?? 8;
  if (![config.x, config.y, config.width, config.height, pixelSize, cellSize, config.opticalHeight].every(Number.isFinite) || config.width <= 0 || config.height <= 0 || pixelSize < 1 || cellSize < pixelSize || config.opticalHeight < 0 || !Number.isInteger(pixelSize) || !Number.isInteger(cellSize)) throw new Error("Invalid native volume raster bounds");
  const width = Math.ceil(config.width / pixelSize), height = Math.ceil(config.height / pixelSize);
  if (width * height > 4194304) throw new Error("Native volume raster exceeds its bounded 4M pixel allocation");
  const size = width * height, columns = Math.ceil(config.width / cellSize), rows = Math.ceil(config.height / cellSize);
  const matter = new Uint8Array(size), objectId = new Int32Array(size), material = new Uint8Array(size), family = new Uint8Array(size), region = new Uint8Array(size);
  const heightField = new Float32Array(size), normals = new Float32Array(size * 3), uv = new Float32Array(size * 2);
  heightField.fill(-Infinity);
  const usedIds = /* @__PURE__ */ new Set();
  for (const mesh of meshes) {
    if (usedIds.has(mesh.spec.id)) throw new Error(`Duplicate native volume id ${mesh.spec.id}`);
    usedIds.add(mesh.spec.id);
    const p = mesh.positions, n = mesh.normals, tex = mesh.uv;
    for (let f = 0; f < mesh.triangleCount; f++) {
      const ia = mesh.indices[f * 3], ib = mesh.indices[f * 3 + 1], ic = mesh.indices[f * 3 + 2];
      const a = ia * 3, b = ib * 3, c = ic * 3;
      const ax = (p[a] - config.x) / pixelSize, ay = (p[a + 1] - config.y) / pixelSize;
      const bx = (p[b] - config.x) / pixelSize, by = (p[b + 1] - config.y) / pixelSize;
      const cx = (p[c] - config.x) / pixelSize, cy = (p[c + 1] - config.y) / pixelSize;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-7) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
      const inv = 1 / area, waX = (by - cy) * inv, waY = (cx - bx) * inv, wbX = (cy - ay) * inv, wbY = (ax - cx) * inv;
      const startX = x0 + 0.5, startY = y0 + 0.5;
      let rowA = ((bx - startX) * (cy - startY) - (by - startY) * (cx - startX)) * inv;
      let rowB = ((cx - startX) * (ay - startY) - (cy - startY) * (ax - startX)) * inv;
      for (let y = y0; y <= y1; y++, rowA += waY, rowB += wbY) {
        let wa = rowA, wb = rowB, index = y * width + x0;
        for (let x = x0; x <= x1; x++, index++, wa += waX, wb += wbX) {
          const wc = 1 - wa - wb;
          if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
          const z = wa * p[a + 2] + wb * p[b + 2] + wc * p[c + 2];
          if (z < heightField[index] - 1e-5 || Math.abs(z - heightField[index]) < 1e-5 && mesh.spec.id > objectId[index]) continue;
          matter[index] = 1;
          objectId[index] = mesh.spec.id;
          material[index] = mesh.materials[f];
          region[index] = mesh.regions[f];
          family[index] = FAMILY_ID[mesh.spec.family];
          heightField[index] = z;
          let nx = n[a] * wa + n[b] * wb + n[c] * wc;
          let ny = n[a + 1] * wa + n[b + 1] * wb + n[c + 1] * wc;
          let nz = n[a + 2] * wa + n[b + 2] * wb + n[c + 2] * wc;
          if (nz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
          const norm = Math.hypot(nx, ny, nz) || 1, q = index * 3;
          normals[q] = nx / norm;
          normals[q + 1] = ny / norm;
          normals[q + 2] = nz / norm;
          uv[index * 2] = tex[ia * 2] * wa + tex[ib * 2] * wb + tex[ic * 2] * wc;
          uv[index * 2 + 1] = tex[ia * 2 + 1] * wa + tex[ib * 2 + 1] * wb + tex[ic * 2 + 1] * wc;
        }
      }
    }
  }
  const occupancy = new Uint8Array(columns * rows), optical = new Uint8Array(columns * rows), cellHeight = new Float32Array(columns * rows);
  const occupied = [], ambientOcclusion = new Float32Array(size);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!matter[i]) continue;
    occupied.push(i);
    const cell = Math.floor((y + 0.5) * pixelSize / cellSize) * columns + Math.floor((x + 0.5) * pixelSize / cellSize);
    occupancy[cell] = 1;
    cellHeight[cell] = Math.max(cellHeight[cell], heightField[i]);
    if (heightField[i] >= config.opticalHeight) optical[cell] = 1;
    let occlusion = 0;
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction / 8 * Math.PI * 2;
      let horizon = 0;
      for (const distance of [3, 7, 14]) {
        const sx = Math.round(x + Math.cos(angle) * distance), sy = Math.round(y + Math.sin(angle) * distance);
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const h = heightField[sy * width + sx] - heightField[i];
        horizon = Math.max(horizon, Math.atan2(Math.max(0, h - 0.6), distance * pixelSize));
      }
      occlusion += horizon / (Math.PI * 0.5);
    }
    ambientOcclusion[i] = 1 - Math.min(0.67, occlusion / 8 * 0.9);
  }
  return {
    config: Object.freeze({ ...config }),
    width,
    height,
    pixelSize,
    cellSize,
    columns,
    rows,
    occupancy,
    optical,
    cellHeight,
    matter,
    objectId,
    material,
    region,
    family,
    heightField,
    normals,
    uv,
    occupiedPixels: new Uint32Array(occupied),
    ambientOcclusion
  };
}
function nativeVolumeHeightAt(raster, x, y) {
  const px = Math.floor((x - raster.config.x) / raster.pixelSize), py = Math.floor((y - raster.config.y) / raster.pixelSize);
  return px < 0 || py < 0 || px >= raster.width || py >= raster.height ? -Infinity : raster.heightField[py * raster.width + px];
}
function nativeVolumeLightVisibility(raster, x, y, z, light) {
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
      if (visibility <= 0.01) return 0;
    }
  }
  return visibility;
}
var materialSample = { tone: 0, roughness: 0, relief: 0 };
function materialEvent(slot, region, height) {
  if (slot === 1) return height < 3.5 ? "loose" : "cleaved";
  return region === 2 || region === 3 || region === 4 ? "cleaved" : "compact";
}
var NativeVolumeLighting = class {
  constructor(raster, materials, context) {
    this.raster = raster;
    this.materialSets = materials instanceof Map ? materials : /* @__PURE__ */ new Map([[0, materials]]);
    const size = raster.width * raster.height;
    this.surfaceSlots = new Int32Array(size).fill(-1);
    for (let slot = 0; slot < raster.occupiedPixels.length; slot++) this.surfaceSlots[raster.occupiedPixels[slot]] = slot;
    this.shadingNormals = new Float32Array(raster.normals);
    this.albedo = new Uint8ClampedArray(size * 3);
    this.roughness = new Float32Array(size);
    this.emission = new Float32Array(size * 3);
    for (const index of raster.occupiedPixels) {
      const set = this.materialSets.get(raster.objectId[index]) ?? this.materialSets.get(0);
      if (!set) throw new Error(`No material set for native volume ${raster.objectId[index]}`);
      const slot = raster.material[index], m = set[NATIVE_VOLUME_MATERIALS[slot]];
      if (!m || !Number.isFinite(m.roughness) || m.roughness < 0 || m.roughness > 1 || !Number.isFinite(m.structure) || m.structure < 0 || m.structure > 1) throw new Error("Invalid native volume material response");
      if (m.emissionStrength !== void 0 && (!Number.isFinite(m.emissionStrength) || m.emissionStrength < 0)) throw new Error("Invalid native volume emission strength");
      for (let c = 0; c < 3; c++) {
        if (![m.base[c], m.dark[c], m.light[c], m.emission?.[c] ?? 0].every((value) => value !== void 0 && Number.isFinite(value) && value >= 0 && value <= 255)) {
          throw new Error("Invalid native volume material colour");
        }
      }
      const region = raster.region[index];
      const wx = raster.config.x + index % raster.width, wy = raster.config.y + Math.floor(index / raster.width), axis = context?.axis ?? 0;
      const u = context && slot !== 1 ? wx * Math.cos(axis) + wy * Math.sin(axis) : raster.uv[index * 2];
      const v = context && slot !== 1 ? -wx * Math.sin(axis) + wy * Math.cos(axis) : raster.uv[index * 2 + 1];
      const family = raster.family[index], materialSeed = context?.seed ?? 3917 + family * 151;
      const material = family === 1 ? "strata" : family === 2 ? "crystal" : family === 4 ? "granular" : family === 5 ? "membrane" : family === 6 ? "gel" : "glaze";
      const event = materialEvent(slot, region, raster.heightField[index]);
      sampleMasterMaterial(material, u - 1, v, materialSeed, materialSample, event);
      const hl = materialSample.relief;
      sampleMasterMaterial(material, u + 1, v, materialSeed, materialSample, event);
      const hr = materialSample.relief;
      sampleMasterMaterial(material, u, v - 1, materialSeed, materialSample, event);
      const ht = materialSample.relief;
      sampleMasterMaterial(material, u, v + 1, materialSeed, materialSample, event);
      const hb = materialSample.relief;
      const du = (hl - hr) * 0.28 * m.structure, dv = (ht - hb) * 0.28 * m.structure;
      const bumpX = context && slot !== 1 ? du * Math.cos(axis) - dv * Math.sin(axis) : 0;
      const bumpY = context && slot !== 1 ? du * Math.sin(axis) + dv * Math.cos(axis) : 0;
      const nx = raster.normals[index * 3] + bumpX, ny = raster.normals[index * 3 + 1] + bumpY, nz = raster.normals[index * 3 + 2];
      const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
      this.shadingNormals[index * 3] = nx * inv;
      this.shadingNormals[index * 3 + 1] = ny * inv;
      this.shadingNormals[index * 3 + 2] = nz * inv;
      sampleMasterMaterial(material, u, v, materialSeed, materialSample, event);
      const tone = materialSample.tone;
      for (let c = 0; c < 3; c++) {
        const base = m.base[c], target = m.dark[c] + (m.light[c] - m.dark[c]) * tone;
        if (!Number.isFinite(base) || !Number.isFinite(target) || base < 0 || base > 255 || target < 0 || target > 255) throw new Error("Invalid native volume material colour");
        this.albedo[index * 3 + c] = base + (target - base) * m.structure;
        this.emission[index * 3 + c] = (m.emission?.[c] ?? 0) * (m.emissionStrength ?? 0);
      }
      this.roughness[index] = Math.max(0, Math.min(1, m.roughness * (1 - m.structure) + materialSample.roughness * m.structure));
    }
  }
  albedo;
  roughness;
  emission;
  shadingNormals;
  materialSets;
  surfaceSlots;
  shadows = /* @__PURE__ */ new WeakMap();
  shadowCache(light) {
    let cache = this.shadows.get(light);
    if (!cache) {
      cache = { x: light.x, y: light.y, z: light.z, values: new Float32Array(this.raster.occupiedPixels.length).fill(-1) };
      this.shadows.set(light, cache);
    } else if (cache.x !== light.x || cache.y !== light.y || cache.z !== light.z) {
      cache.x = light.x;
      cache.y = light.y;
      cache.z = light.z;
      cache.values.fill(-1);
    }
    return cache;
  }
  /** The immutable geometry owns this result. Source intensity/colour may vary
   * without recasting the same ray; movement in ANY axis invalidates it.
   * This is illumination only: never multiply it into tactical visibility. */
  lightVisibilityAt(index, light) {
    const slot = this.surfaceSlots[index];
    if (slot === void 0 || slot < 0) return 0;
    if (light.castsShadow === false) return 1;
    const cache = this.shadowCache(light);
    if (cache.values[slot] >= 0) return cache.values[slot];
    const r = this.raster;
    cache.values[slot] = nativeVolumeLightVisibility(
      r,
      r.config.x + (index % r.width + 0.5) * r.pixelSize,
      r.config.y + (Math.floor(index / r.width) + 0.5) * r.pixelSize,
      r.heightField[index],
      light
    );
    return cache.values[slot];
  }
  render(lights, output, options) {
    const r = this.raster, width = r.width, pixelSize = r.pixelSize;
    if (output.length !== width * r.height * 4) throw new Error("Native volume output buffer size mismatch");
    if (!Number.isFinite(options.ambient) || options.ambient < 0 || options.ambient > 1) throw new Error("Native volume ambient must be in [0,1]");
    if (options.visibility && options.visibility.length !== width * r.height) throw new Error("Native volume visibility size mismatch");
    if (options.emissionScale !== void 0 && (!Number.isFinite(options.emissionScale) || options.emissionScale < 0)) throw new Error("Invalid native volume activity factor");
    for (let j = 0; j < lights.length; j++) {
      const light = lights[j];
      if (!Number.isFinite(light.x) || !Number.isFinite(light.y) || !Number.isFinite(light.z) || !Number.isFinite(light.radius) || !Number.isFinite(light.intensity) || light.radius < 0 || light.intensity < 0) throw new Error("Invalid native volume light");
      for (let c = 0; c < 3; c++) if (!Number.isFinite(light.color[c]) || light.color[c] < 0 || light.color[c] > 1) throw new Error("Light colour must use normalized RGB");
    }
    output.fill(0);
    const view = options.viewport, emissionScale = options.emissionScale ?? 1;
    for (let at = 0; at < r.occupiedPixels.length; at++) {
      const index = r.occupiedPixels[at], x = r.config.x + (index % width + 0.5) * pixelSize;
      const visibility = options.visibility ? clamp01(options.visibility[index]) : 1;
      if (visibility <= 0) continue;
      const y = r.config.y + (Math.floor(index / width) + 0.5) * pixelSize;
      if (view && (x < view.x || y < view.y || x >= view.x + view.width || y >= view.y + view.height)) continue;
      const q = index * 3, z = r.heightField[index], nx = this.shadingNormals[q], ny = this.shadingNormals[q + 1], nz = this.shadingNormals[q + 2];
      const ao = r.ambientOcclusion[index], ambient = options.ambient * ao;
      let lr = ambient, lg = ambient, lb = ambient, sr = 0, sg = 0, sb = 0;
      for (let j = 0; j < lights.length; j++) {
        const light = lights[j];
        if (light.radius <= 0 || light.intensity <= 0) continue;
        const dx = light.x - x, dy = light.y - y, dz = light.z - z, distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared >= light.radius * light.radius) continue;
        const distance = Math.sqrt(distanceSquared), inv = 1 / Math.max(0.01, distance);
        const ndotl = Math.max(0, (nx * dx + ny * dy + nz * dz) * inv);
        if (ndotl <= 0) continue;
        const visibility2 = this.lightVisibilityAt(index, light);
        if (visibility2 <= 1e-3) continue;
        const falloff = 1 - distance / light.radius;
        const energy = light.intensity * falloff * falloff * visibility2;
        const diffuse = ndotl * energy;
        const hz = dz * inv + 1, halfLength = Math.sqrt(dx * dx * inv * inv + dy * dy * inv * inv + hz * hz) || 1;
        const ndoth = Math.max(0, (nx * dx * inv + ny * dy * inv + nz * hz) / halfLength);
        const rough = this.roughness[index], specular = Math.pow(ndoth, 7 + (1 - rough) * 57) * (1 - rough) * energy * 52;
        lr += diffuse * light.color[0];
        lg += diffuse * light.color[1];
        lb += diffuse * light.color[2];
        sr += specular * light.color[0];
        sg += specular * light.color[1];
        sb += specular * light.color[2];
      }
      const o = index * 4;
      output[o] = (this.albedo[q] * lr + sr + this.emission[q] * emissionScale) * visibility;
      output[o + 1] = (this.albedo[q + 1] * lg + sg + this.emission[q + 1] * emissionScale) * visibility;
      output[o + 2] = (this.albedo[q + 2] * lb + sb + this.emission[q + 2] * emissionScale) * visibility;
      output[o + 3] = 255;
    }
  }
  /** Optional shared-geometry ground receiver. Alpha only, so the caller clips
   * this against actual floor matter instead of ever lighting the Rift void. */
  renderGroundShadow(light, output, strength, viewport) {
    const r = this.raster;
    if (output.length !== r.width * r.height) throw new Error("Ground shadow output must be one byte per pixel");
    output.fill(0);
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      const index = y * r.width + x;
      if (r.matter[index]) continue;
      const wx = r.config.x + (x + 0.5) * r.pixelSize, wy = r.config.y + (y + 0.5) * r.pixelSize;
      if (viewport && (wx < viewport.x || wy < viewport.y || wx >= viewport.x + viewport.width || wy >= viewport.y + viewport.height)) continue;
      if ((wx - light.x) ** 2 + (wy - light.y) ** 2 >= light.radius ** 2) continue;
      output[index] = 255 * clamp01(strength) * (1 - nativeVolumeLightVisibility(r, wx, wy, 0, light));
    }
  }
};

// src/generation/world-study/native-body-collision.ts
var EPSILON = 1e-7;
var SEPARATION = 1e-4;
function polygon(points) {
  if (points.length < 3) return null;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(area) < EPSILON) return null;
  const normals = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], x = b.y - a.y, y = a.x - b.x, length = Math.hypot(x, y);
    if (length > EPSILON) normals.push({ x: x / length, y: y / length });
  }
  const axes = normals.map(({ x, y }) => {
    let min = Infinity, max = -Infinity;
    for (const point of points) {
      const value = point.x * x + point.y * y;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    return { x, y, min, max };
  });
  return { points, axes, minX: axes[0].min, maxX: axes[0].max, minY: axes[1].min, maxY: axes[1].max };
}
function clip(points, axis, limit, greater) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const insideA = greater ? a[axis] >= limit : a[axis] <= limit;
    const insideB = greater ? b[axis] >= limit : b[axis] <= limit;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}
function outsideExemption(p, box) {
  if (p.maxX <= box.left || p.minX >= box.right || p.maxY <= box.top || p.minY >= box.bottom) return [p];
  const horizontal = clip(clip(p.points, "x", box.left, true), "x", box.right, false);
  return [
    clip(p.points, "x", box.left, false),
    clip(p.points, "x", box.right, true),
    clip(horizontal, "y", box.top, false),
    clip(horizontal, "y", box.bottom, true)
  ].map(polygon).filter((value) => value !== null);
}
function overlap(p, center, halfW, halfH) {
  if (center.x + halfW <= p.minX + EPSILON || center.x - halfW >= p.maxX - EPSILON || center.y + halfH <= p.minY + EPSILON || center.y - halfH >= p.maxY - EPSILON) return false;
  for (const axis of p.axes) {
    const at = center.x * axis.x + center.y * axis.y, radius = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    if (at + radius <= axis.min + EPSILON || at - radius >= axis.max - EPSILON) return false;
  }
  return true;
}
function sweepPolygon(p, center, halfW, halfH, dx, dy, hit) {
  if (Math.max(center.x, center.x + dx) + halfW <= p.minX + EPSILON || Math.min(center.x, center.x + dx) - halfW >= p.maxX - EPSILON || Math.max(center.y, center.y + dy) + halfH <= p.minY + EPSILON || Math.min(center.y, center.y + dy) - halfH >= p.maxY - EPSILON) return;
  let enter = -Infinity, exit = Infinity, normalX = 0, normalY = 0;
  for (const axis of p.axes) {
    const at = center.x * axis.x + center.y * axis.y, velocity = dx * axis.x + dy * axis.y;
    const radius = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    const min = axis.min - radius + EPSILON, max = axis.max + radius - EPSILON;
    if (Math.abs(velocity) < 1e-12) {
      if (at <= min || at >= max) return;
      continue;
    }
    const a = (min - at) / velocity, b = (max - at) / velocity, start = Math.min(a, b);
    if (start > enter) {
      enter = start;
      const sign = velocity > 0 ? -1 : 1;
      normalX = axis.x * sign;
      normalY = axis.y * sign;
    }
    exit = Math.min(exit, Math.max(a, b));
    if (enter >= exit) return;
  }
  if (exit <= 0 || enter >= hit.fraction || enter > 1) return;
  hit.fraction = Math.max(0, enter);
  hit.normalX = normalX;
  hit.normalY = normalY;
}
var NativeBodyCollision = class {
  constructor(native, map) {
    this.map = map;
    if (map.tileSize !== 8) throw new Error("Native body collision requires the original 8px navigation map");
    const roles = new Map(native.definition.instances.map((instance) => [instance.id, instance.role]));
    const solids = [];
    for (const mesh of native.meshes) {
      if (roles.get(mesh.spec.id) !== "solid") continue;
      for (let face = 0; face < mesh.indices.length; face += 3) {
        const points = [];
        for (let corner = 0; corner < 3; corner++) {
          const index = mesh.indices[face + corner] * 3;
          points.push({ x: mesh.positions[index], y: mesh.positions[index + 1] });
        }
        const value = polygon(points);
        if (value) solids.push(value);
      }
    }
    this.solids = solids;
    this.triangleCount = solids.length;
    this.cell = { points: [], axes: [{ x: 1, y: 0, min: 0, max: 0 }, { x: 0, y: 1, min: 0, max: 0 }], minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  solids;
  hit = { fraction: 1, normalX: 0, normalY: 0 };
  at = { x: 0, y: 0 };
  cell;
  triangleCount;
  supports(center, halfW, halfH) {
    if (!this.validBody(center, halfW, halfH)) return false;
    const size = this.map.tileSize;
    for (let row = Math.floor((center.y - halfH + EPSILON) / size); row <= Math.floor((center.y + halfH - EPSILON) / size); row++)
      for (let col = Math.floor((center.x - halfW + EPSILON) / size); col <= Math.floor((center.x + halfW - EPSILON) / size); col++)
        if (this.map.tiles[row][col] === 3 /* VOID */) return false;
    for (const solid of this.solids) if (overlap(solid, center, halfW, halfH)) return false;
    return true;
  }
  displacementFraction(center, halfW, halfH, dx, dy, exemption) {
    if (!this.supports(center, halfW, halfH) || !Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
    return this.trace(center, halfW, halfH, dx, dy, exemption).fraction;
  }
  resolveMotion(center, halfW, halfH, dx, dy, velocity, out) {
    out.x = center.x;
    out.y = center.y;
    out.velocityX = velocity.x;
    out.velocityY = velocity.y;
    out.collided = false;
    if (!this.supports(center, halfW, halfH) || (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y))) {
      out.velocityX = 0;
      out.velocityY = 0;
      out.collided = true;
      return;
    }
    let remainingX = dx, remainingY = dy;
    for (let iteration = 0; iteration < 4 && Math.abs(remainingX) + Math.abs(remainingY) > EPSILON; iteration++) {
      this.at.x = out.x;
      this.at.y = out.y;
      const hit = this.trace(this.at, halfW, halfH, remainingX, remainingY);
      out.x += remainingX * hit.fraction;
      out.y += remainingY * hit.fraction;
      if (hit.fraction === 1) break;
      out.collided = true;
      remainingX *= 1 - hit.fraction;
      remainingY *= 1 - hit.fraction;
      const inward = remainingX * hit.normalX + remainingY * hit.normalY;
      if (inward >= 0) break;
      remainingX -= inward * hit.normalX;
      remainingY -= inward * hit.normalY;
      const velocityInward = out.velocityX * hit.normalX + out.velocityY * hit.normalY;
      if (velocityInward < 0) {
        out.velocityX -= velocityInward * hit.normalX;
        out.velocityY -= velocityInward * hit.normalY;
      }
    }
  }
  validBody(center, halfW, halfH) {
    return Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(halfW) && Number.isFinite(halfH) && halfW > 0 && halfH > 0 && center.x - halfW >= 0 && center.y - halfH >= 0 && center.x + halfW <= this.map.cols * this.map.tileSize && center.y + halfH <= this.map.rows * this.map.tileSize;
  }
  trace(center, halfW, halfH, dx, dy, exemption) {
    const hit = this.hit;
    hit.fraction = 1;
    hit.normalX = 0;
    hit.normalY = 0;
    const size = this.map.tileSize;
    const minCol = Math.max(-1, Math.floor((Math.min(center.x, center.x + dx) - halfW) / size));
    const maxCol = Math.min(this.map.cols, Math.floor((Math.max(center.x, center.x + dx) + halfW) / size));
    const minRow = Math.max(-1, Math.floor((Math.min(center.y, center.y + dy) - halfH) / size));
    const maxRow = Math.min(this.map.rows, Math.floor((Math.max(center.y, center.y + dy) + halfH) / size));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      if (row >= 0 && col >= 0 && row < this.map.rows && col < this.map.cols && this.map.tiles[row][col] !== 3 /* VOID */) continue;
      const cell = this.cell;
      cell.minX = col * size;
      cell.maxX = (col + 1) * size;
      cell.minY = row * size;
      cell.maxY = (row + 1) * size;
      cell.axes[0].min = cell.minX;
      cell.axes[0].max = cell.maxX;
      cell.axes[1].min = cell.minY;
      cell.axes[1].max = cell.maxY;
      sweepPolygon(cell, center, halfW, halfH, dx, dy, hit);
    }
    for (const solid of this.solids) {
      if (exemption) for (const piece of outsideExemption(solid, exemption)) sweepPolygon(piece, center, halfW, halfH, dx, dy, hit);
      else sweepPolygon(solid, center, halfW, halfH, dx, dy, hit);
    }
    if (hit.fraction < 1) hit.fraction = Math.max(0, hit.fraction - SEPARATION / Math.max(Math.abs(dx), Math.abs(dy), SEPARATION));
    return hit;
  }
};

// src/generation/world-study/world-material-pigment.ts
var clamp2 = (value) => Math.max(0, Math.min(1, value));
var luminance = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;
function paintedToneRange(surface) {
  const histogram = new Uint32Array(256), pixels = surface.pixels;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    if (!pixels[index + 3]) continue;
    const bin = Math.round(luminance(pixels[index], pixels[index + 1], pixels[index + 2]));
    histogram[bin] = histogram[bin] + 1;
    count++;
  }
  const percentile = (fraction) => {
    let sum = 0;
    for (let index = 0; index < 256; index++) {
      sum += histogram[index];
      if (sum >= count * fraction) return index;
    }
    return 255;
  };
  const mid = Math.max(1, Math.min(254, percentile(0.5)));
  return { low: Math.min(mid - 1, percentile(0.015)), mid, high: Math.max(mid + 1, percentile(0.985)) };
}
function rampChannel(ramp, tone, channel) {
  const shift = 16 - channel * 8;
  const a = (tone < 0.5 ? ramp.dark : ramp.mid) >>> shift & 255;
  const b = (tone < 0.5 ? ramp.mid : ramp.light) >>> shift & 255;
  const amount = tone < 0.5 ? tone * 2 : (tone - 0.5) * 2;
  return a + (b - a) * amount;
}
function mapWorldPigment(appearance, role, red, green, blue, range, field2, secondary, out) {
  const lum = luminance(red, green, blue);
  const span = lum < range.mid ? range.mid - range.low : range.high - range.mid;
  const raw = (lum - range.mid) / span;
  const normalized = raw / (1 + Math.abs(raw) * 0.22);
  const contrast = role === "ground" ? field2.detail : appearance.textureContrast;
  const tone = clamp2(0.5 + normalized * 0.43 * contrast + (role === "ground" ? field2.tone : 0));
  const ramp = appearance[role];
  const boundary = secondary * (1 - secondary) * 4;
  const materialMix = role === "ground" ? clamp2(secondary + normalized * boundary * 0.19) : secondary;
  for (let channel = 0; channel < 3; channel++) {
    const primary = rampChannel(ramp, tone, channel), second = rampChannel(appearance.secondary, tone, channel);
    const source = channel === 0 ? red : channel === 1 ? green : blue;
    out[channel] = Math.max(0, Math.min(255, primary + (second - primary) * materialMix + (source - lum) * 0.035));
  }
}

// src/generated/r100-world-appearance.ts
var R100_WORLD_APPEARANCES = [
  {
    "version": 1,
    "worldId": "ash-strata",
    "ground": {
      "dark": 2302505,
      "mid": 4539212,
      "light": 7762299
    },
    "solid": {
      "dark": 3289145,
      "mid": 6709611,
      "light": 11116714
    },
    "cleaved": {
      "dark": 5327703,
      "mid": 8946316,
      "light": 12762048
    },
    "secondary": {
      "dark": 3813433,
      "mid": 6771804,
      "light": 9928839
    },
    "groundPattern": "strata",
    "patternScale": 192,
    "patternStrength": 0.48,
    "secondaryCoverage": 0.16,
    "textureContrast": 1.08,
    "quietCoverage": 0.46
  },
  {
    "version": 1,
    "worldId": "crystal-fibre",
    "ground": {
      "dark": 1383746,
      "mid": 2571894,
      "light": 5270441
    },
    "solid": {
      "dark": 2370912,
      "mid": 5268135,
      "light": 9149391
    },
    "cleaved": {
      "dark": 4805753,
      "mid": 10332371,
      "light": 13752809
    },
    "secondary": {
      "dark": 4797222,
      "mid": 12421444,
      "light": 14927246
    },
    "groundPattern": "veins",
    "patternScale": 176,
    "patternStrength": 0.76,
    "secondaryCoverage": 0.23,
    "textureContrast": 1.14,
    "quietCoverage": 0.38
  },
  {
    "version": 1,
    "worldId": "ivory-basin",
    "ground": {
      "dark": 3155761,
      "mid": 6903649,
      "light": 10455947
    },
    "solid": {
      "dark": 4470332,
      "mid": 10917507,
      "light": 14340021
    },
    "cleaved": {
      "dark": 5516860,
      "mid": 10708837,
      "light": 14263704
    },
    "secondary": {
      "dark": 3746363,
      "mid": 7881813,
      "light": 12219520
    },
    "groundPattern": "plates",
    "patternScale": 224,
    "patternStrength": 0.58,
    "secondaryCoverage": 0.27,
    "textureContrast": 1.15,
    "quietCoverage": 0.52
  },
  {
    "version": 1,
    "worldId": "cinder-ridge",
    "ground": {
      "dark": 3284260,
      "mid": 7090991,
      "light": 11102027
    },
    "solid": {
      "dark": 4400936,
      "mid": 9584953,
      "light": 13334867
    },
    "cleaved": {
      "dark": 6764594,
      "mid": 13006163,
      "light": 14920823
    },
    "secondary": {
      "dark": 3159616,
      "mid": 5856364,
      "light": 9606048
    },
    "groundPattern": "grains",
    "patternScale": 104,
    "patternStrength": 0.73,
    "secondaryCoverage": 0.22,
    "textureContrast": 1.18,
    "quietCoverage": 0.27
  },
  {
    "version": 1,
    "worldId": "pallid-membrane",
    "ground": {
      "dark": 2892864,
      "mid": 5389415,
      "light": 9070734
    },
    "solid": {
      "dark": 5325150,
      "mid": 11046313,
      "light": 13877202
    },
    "cleaved": {
      "dark": 7363192,
      "mid": 13678794,
      "light": 15391712
    },
    "secondary": {
      "dark": 3422025,
      "mid": 7764887,
      "light": 11383237
    },
    "groundPattern": "tension",
    "patternScale": 224,
    "patternStrength": 0.39,
    "secondaryCoverage": 0.2,
    "textureContrast": 0.95,
    "quietCoverage": 0.61
  },
  {
    "version": 1,
    "worldId": "silt-gel",
    "ground": {
      "dark": 2107198,
      "mid": 4541558,
      "light": 8093602
    },
    "solid": {
      "dark": 3351363,
      "mid": 6767745,
      "light": 10910893
    },
    "cleaved": {
      "dark": 5587042,
      "mid": 10914756,
      "light": 13745630
    },
    "secondary": {
      "dark": 4076851,
      "mid": 9075049,
      "light": 13022615
    },
    "groundPattern": "flow",
    "patternScale": 208,
    "patternStrength": 0.69,
    "secondaryCoverage": 0.26,
    "textureContrast": 1.02,
    "quietCoverage": 0.55
  },
  {
    "version": 1,
    "worldId": "schist-shear",
    "ground": {
      "dark": 2108985,
      "mid": 3953504,
      "light": 7703444
    },
    "solid": {
      "dark": 2505804,
      "mid": 5469318,
      "light": 9810104
    },
    "cleaved": {
      "dark": 5204596,
      "mid": 10466486,
      "light": 13751756
    },
    "secondary": {
      "dark": 4603443,
      "mid": 10191704,
      "light": 13021835
    },
    "groundPattern": "strata",
    "patternScale": 112,
    "patternStrength": 0.81,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.22,
    "quietCoverage": 0.3
  },
  {
    "version": 1,
    "worldId": "splayed-fibres",
    "ground": {
      "dark": 2107976,
      "mid": 3623539,
      "light": 6979751
    },
    "solid": {
      "dark": 5849123,
      "mid": 11634502,
      "light": 14598532
    },
    "cleaved": {
      "dark": 8742200,
      "mid": 14533513,
      "light": 15785907
    },
    "secondary": {
      "dark": 1977941,
      "mid": 4547228,
      "light": 8691408
    },
    "groundPattern": "veins",
    "patternScale": 256,
    "patternStrength": 0.64,
    "secondaryCoverage": 0.42,
    "textureContrast": 1.06,
    "quietCoverage": 0.47
  },
  {
    "version": 1,
    "worldId": "shell-chain",
    "ground": {
      "dark": 3480382,
      "mid": 7614815,
      "light": 11490944
    },
    "solid": {
      "dark": 5840192,
      "mid": 11880562,
      "light": 14649504
    },
    "cleaved": {
      "dark": 9193051,
      "mid": 13797787,
      "light": 15711165
    },
    "secondary": {
      "dark": 2374996,
      "mid": 4615301,
      "light": 8627634
    },
    "groundPattern": "plates",
    "patternScale": 136,
    "patternStrength": 0.73,
    "secondaryCoverage": 0.32,
    "textureContrast": 1.06,
    "quietCoverage": 0.39
  },
  {
    "version": 1,
    "worldId": "grain-laminate",
    "ground": {
      "dark": 3418938,
      "mid": 7427437,
      "light": 11242645
    },
    "solid": {
      "dark": 5582893,
      "mid": 10050112,
      "light": 13865824
    },
    "cleaved": {
      "dark": 7952452,
      "mid": 13080174,
      "light": 15122840
    },
    "secondary": {
      "dark": 3156806,
      "mid": 5918085,
      "light": 9930421
    },
    "groundPattern": "grains",
    "patternScale": 144,
    "patternStrength": 0.69,
    "secondaryCoverage": 0.39,
    "textureContrast": 1.16,
    "quietCoverage": 0.32
  },
  {
    "version": 1,
    "worldId": "tension-membrane",
    "ground": {
      "dark": 3481901,
      "mid": 6830922,
      "light": 10709367
    },
    "solid": {
      "dark": 5456188,
      "mid": 10982016,
      "light": 13813680
    },
    "cleaved": {
      "dark": 8151899,
      "mid": 13285795,
      "light": 15129029
    },
    "secondary": {
      "dark": 1912140,
      "mid": 3957382,
      "light": 8166830
    },
    "groundPattern": "tension",
    "patternScale": 144,
    "patternStrength": 0.77,
    "secondaryCoverage": 0.34,
    "textureContrast": 1.08,
    "quietCoverage": 0.48
  },
  {
    "version": 1,
    "worldId": "shell-gel-delta",
    "ground": {
      "dark": 3484454,
      "mid": 7954508,
      "light": 11373936
    },
    "solid": {
      "dark": 5718052,
      "mid": 11171388,
      "light": 14069093
    },
    "cleaved": {
      "dark": 8872760,
      "mid": 14663543,
      "light": 15916202
    },
    "secondary": {
      "dark": 4465464,
      "mid": 9590385,
      "light": 13143969
    },
    "groundPattern": "flow",
    "patternScale": 160,
    "patternStrength": 0.83,
    "secondaryCoverage": 0.37,
    "textureContrast": 1.08,
    "quietCoverage": 0.44
  },
  {
    "version": 1,
    "worldId": "pressed-dunes",
    "ground": {
      "dark": 2372936,
      "mid": 4546937,
      "light": 8295587
    },
    "solid": {
      "dark": 4801847,
      "mid": 11050088,
      "light": 13681549
    },
    "cleaved": {
      "dark": 7694150,
      "mid": 13088906,
      "light": 14998720
    },
    "secondary": {
      "dark": 4074803,
      "mid": 7756638,
      "light": 11767171
    },
    "groundPattern": "grains",
    "patternScale": 232,
    "patternStrength": 0.45,
    "secondaryCoverage": 0.24,
    "textureContrast": 0.99,
    "quietCoverage": 0.57
  },
  {
    "version": 1,
    "worldId": "ruptured-film",
    "ground": {
      "dark": 3742769,
      "mid": 8663375,
      "light": 12412029
    },
    "solid": {
      "dark": 7022142,
      "mid": 12472422,
      "light": 14979733
    },
    "cleaved": {
      "dark": 10046288,
      "mid": 14326659,
      "light": 15781296
    },
    "secondary": {
      "dark": 2306114,
      "mid": 3887210,
      "light": 7900574
    },
    "groundPattern": "tension",
    "patternScale": 96,
    "patternStrength": 0.84,
    "secondaryCoverage": 0.35,
    "textureContrast": 1.15,
    "quietCoverage": 0.28
  },
  {
    "version": 1,
    "worldId": "reversed-flow",
    "ground": {
      "dark": 2891574,
      "mid": 5322574,
      "light": 8871288
    },
    "solid": {
      "dark": 4069937,
      "mid": 8269650,
      "light": 12146553
    },
    "cleaved": {
      "dark": 7418440,
      "mid": 13069190,
      "light": 15182264
    },
    "secondary": {
      "dark": 5391928,
      "mid": 11573638,
      "light": 14207150
    },
    "groundPattern": "flow",
    "patternScale": 112,
    "patternStrength": 0.85,
    "secondaryCoverage": 0.33,
    "textureContrast": 1.1,
    "quietCoverage": 0.4
  },
  {
    "version": 1,
    "worldId": "laminate-shell",
    "ground": {
      "dark": 2238261,
      "mid": 3686490,
      "light": 7569049
    },
    "solid": {
      "dark": 3160399,
      "mid": 5597846,
      "light": 9610952
    },
    "cleaved": {
      "dark": 5662340,
      "mid": 10333648,
      "light": 13621995
    },
    "secondary": {
      "dark": 5782859,
      "mid": 12224668,
      "light": 14662591
    },
    "groundPattern": "strata",
    "patternScale": 240,
    "patternStrength": 0.65,
    "secondaryCoverage": 0.31,
    "textureContrast": 1.11,
    "quietCoverage": 0.48
  },
  {
    "version": 1,
    "worldId": "fibre-silt",
    "ground": {
      "dark": 3157289,
      "mid": 6444869,
      "light": 10259565
    },
    "solid": {
      "dark": 4147549,
      "mid": 8622501,
      "light": 12437713
    },
    "cleaved": {
      "dark": 6713725,
      "mid": 12699587,
      "light": 14803672
    },
    "secondary": {
      "dark": 4928037,
      "mid": 11172411,
      "light": 14070903
    },
    "groundPattern": "veins",
    "patternScale": 120,
    "patternStrength": 0.84,
    "secondaryCoverage": 0.43,
    "textureContrast": 1.14,
    "quietCoverage": 0.29
  },
  {
    "version": 1,
    "worldId": "film-laminate",
    "ground": {
      "dark": 3484205,
      "mid": 6902092,
      "light": 10519156
    },
    "solid": {
      "dark": 5125175,
      "mid": 9791839,
      "light": 13212288
    },
    "cleaved": {
      "dark": 7754060,
      "mid": 13082759,
      "light": 14993580
    },
    "secondary": {
      "dark": 3878481,
      "mid": 10058665,
      "light": 13349070
    },
    "groundPattern": "strata",
    "patternScale": 160,
    "patternStrength": 0.57,
    "secondaryCoverage": 0.46,
    "textureContrast": 1.03,
    "quietCoverage": 0.55
  },
  {
    "version": 1,
    "worldId": "gel-fibre",
    "ground": {
      "dark": 2563901,
      "mid": 4339295,
      "light": 7758477
    },
    "solid": {
      "dark": 1584459,
      "mid": 2706805,
      "light": 6653604
    },
    "cleaved": {
      "dark": 4087934,
      "mid": 7904428,
      "light": 11978955
    },
    "secondary": {
      "dark": 5325874,
      "mid": 12296829,
      "light": 14732464
    },
    "groundPattern": "flow",
    "patternScale": 256,
    "patternStrength": 0.58,
    "secondaryCoverage": 0.29,
    "textureContrast": 0.97,
    "quietCoverage": 0.58
  },
  {
    "version": 1,
    "worldId": "shell-grit",
    "ground": {
      "dark": 3876131,
      "mid": 7356463,
      "light": 11237716
    },
    "solid": {
      "dark": 5717058,
      "mid": 10979718,
      "light": 13744295
    },
    "cleaved": {
      "dark": 8608081,
      "mid": 13740951,
      "light": 15454904
    },
    "secondary": {
      "dark": 4994344,
      "mid": 10185015,
      "light": 13478770
    },
    "groundPattern": "plates",
    "patternScale": 96,
    "patternStrength": 0.83,
    "secondaryCoverage": 0.44,
    "textureContrast": 1.21,
    "quietCoverage": 0.26
  },
  {
    "version": 1,
    "worldId": "rib-vault",
    "ground": {
      "dark": 2498865,
      "mid": 5128284,
      "light": 8811917
    },
    "solid": {
      "dark": 5785671,
      "mid": 11576204,
      "light": 14602935
    },
    "cleaved": {
      "dark": 7953242,
      "mid": 12493716,
      "light": 14863029
    },
    "secondary": {
      "dark": 2371392,
      "mid": 5334136,
      "light": 9281453
    },
    "groundPattern": "veins",
    "patternScale": 192,
    "patternStrength": 0.53,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.08,
    "quietCoverage": 0.58
  },
  {
    "version": 1,
    "worldId": "pleated-hide",
    "ground": {
      "dark": 3286060,
      "mid": 6374223,
      "light": 10516091
    },
    "solid": {
      "dark": 6438454,
      "mid": 11958110,
      "light": 14395785
    },
    "cleaved": {
      "dark": 5584464,
      "mid": 9922434,
      "light": 13672624
    },
    "secondary": {
      "dark": 2569801,
      "mid": 5401733,
      "light": 10203071
    },
    "groundPattern": "tension",
    "patternScale": 176,
    "patternStrength": 0.62,
    "secondaryCoverage": 0.23,
    "textureContrast": 1.06,
    "quietCoverage": 0.46
  },
  {
    "version": 1,
    "worldId": "blister-field",
    "ground": {
      "dark": 3155251,
      "mid": 7031908,
      "light": 10516626
    },
    "solid": {
      "dark": 4665380,
      "mid": 9859141,
      "light": 13280368
    },
    "cleaved": {
      "dark": 7357771,
      "mid": 12422536,
      "light": 14926e3
    },
    "secondary": {
      "dark": 2109252,
      "mid": 4415105,
      "light": 8362416
    },
    "groundPattern": "plates",
    "patternScale": 224,
    "patternStrength": 0.47,
    "secondaryCoverage": 0.2,
    "textureContrast": 1.12,
    "quietCoverage": 0.56
  },
  {
    "version": 1,
    "worldId": "wax-tongues",
    "ground": {
      "dark": 2761783,
      "mid": 5522527,
      "light": 9139603
    },
    "solid": {
      "dark": 5784873,
      "mid": 11702875,
      "light": 14666133
    },
    "cleaved": {
      "dark": 6436426,
      "mid": 11362933,
      "light": 14262436
    },
    "secondary": {
      "dark": 2635587,
      "mid": 5928322,
      "light": 9676208
    },
    "groundPattern": "flow",
    "patternScale": 240,
    "patternStrength": 0.42,
    "secondaryCoverage": 0.25,
    "textureContrast": 0.96,
    "quietCoverage": 0.63
  },
  {
    "version": 1,
    "worldId": "monolith-sill",
    "ground": {
      "dark": 4207163,
      "mid": 9469829,
      "light": 12957110
    },
    "solid": {
      "dark": 1319479,
      "mid": 2705252,
      "light": 6523040
    },
    "cleaved": {
      "dark": 3426392,
      "mid": 7507099,
      "light": 12372944
    },
    "secondary": {
      "dark": 5056830,
      "mid": 9917551,
      "light": 13209757
    },
    "groundPattern": "strata",
    "patternScale": 256,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.08,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "bleached-court",
    "ground": {
      "dark": 1976634,
      "mid": 4216175,
      "light": 7769248
    },
    "solid": {
      "dark": 4933968,
      "mid": 11249573,
      "light": 15065039
    },
    "cleaved": {
      "dark": 5712436,
      "mid": 10572380,
      "light": 13996436
    },
    "secondary": {
      "dark": 4343117,
      "mid": 8947082,
      "light": 11841459
    },
    "groundPattern": "plates",
    "patternScale": 256,
    "patternStrength": 0.34,
    "secondaryCoverage": 0.19,
    "textureContrast": 1.11,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "split-rib-causeway",
    "ground": {
      "dark": 2372427,
      "mid": 5008523,
      "light": 9414587
    },
    "solid": {
      "dark": 5056831,
      "mid": 9656687,
      "light": 13077400
    },
    "cleaved": {
      "dark": 5852003,
      "mid": 11771052,
      "light": 14535638
    },
    "secondary": {
      "dark": 4474702,
      "mid": 9014161,
      "light": 12501439
    },
    "groundPattern": "veins",
    "patternScale": 144,
    "patternStrength": 0.7,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.12,
    "quietCoverage": 0.43
  },
  {
    "version": 1,
    "worldId": "satin-fan",
    "ground": {
      "dark": 2106180,
      "mid": 4541312,
      "light": 8225969
    },
    "solid": {
      "dark": 4603996,
      "mid": 9865645,
      "light": 13484248
    },
    "cleaved": {
      "dark": 8016478,
      "mid": 12359075,
      "light": 14992071
    },
    "secondary": {
      "dark": 4537401,
      "mid": 8942703,
      "light": 12429211
    },
    "groundPattern": "tension",
    "patternScale": 248,
    "patternStrength": 0.32,
    "secondaryCoverage": 0.13,
    "textureContrast": 0.93,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "chalk-steps",
    "ground": {
      "dark": 3155764,
      "mid": 6706536,
      "light": 10653601
    },
    "solid": {
      "dark": 5525597,
      "mid": 11183019,
      "light": 14736091
    },
    "cleaved": {
      "dark": 6042690,
      "mid": 11364981,
      "light": 14396588
    },
    "secondary": {
      "dark": 2571089,
      "mid": 5405594,
      "light": 9548997
    },
    "groundPattern": "grains",
    "patternScale": 224,
    "patternStrength": 0.46,
    "secondaryCoverage": 0.16,
    "textureContrast": 1.15,
    "quietCoverage": 0.57
  },
  {
    "version": 1,
    "worldId": "porcelain-maw",
    "ground": {
      "dark": 3350574,
      "mid": 7617621,
      "light": 11432068
    },
    "solid": {
      "dark": 2570060,
      "mid": 9545398,
      "light": 13754591
    },
    "cleaved": {
      "dark": 6503512,
      "mid": 11827863,
      "light": 14662088
    },
    "secondary": {
      "dark": 2107976,
      "mid": 4938386,
      "light": 9215432
    },
    "groundPattern": "plates",
    "patternScale": 192,
    "patternStrength": 0.51,
    "secondaryCoverage": 0.23,
    "textureContrast": 1.12,
    "quietCoverage": 0.51
  },
  {
    "version": 1,
    "worldId": "amber-ribs",
    "ground": {
      "dark": 2565693,
      "mid": 5328246,
      "light": 9143205
    },
    "solid": {
      "dark": 5779997,
      "mid": 12023610,
      "light": 14990192
    },
    "cleaved": {
      "dark": 5841722,
      "mid": 11684456,
      "light": 14324377
    },
    "secondary": {
      "dark": 3880247,
      "mid": 8550775,
      "light": 12103333
    },
    "groundPattern": "veins",
    "patternScale": 184,
    "patternStrength": 0.55,
    "secondaryCoverage": 0.19,
    "textureContrast": 1.1,
    "quietCoverage": 0.48
  },
  {
    "version": 1,
    "worldId": "pale-sail",
    "ground": {
      "dark": 2435907,
      "mid": 5266820,
      "light": 9280955
    },
    "solid": {
      "dark": 5130588,
      "mid": 11182518,
      "light": 14735845
    },
    "cleaved": {
      "dark": 5647176,
      "mid": 10902914,
      "light": 14000314
    },
    "secondary": {
      "dark": 5587775,
      "mid": 10651514,
      "light": 13548198
    },
    "groundPattern": "tension",
    "patternScale": 240,
    "patternStrength": 0.39,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.02,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "root-cistern",
    "ground": {
      "dark": 2108224,
      "mid": 4610941,
      "light": 8558768
    },
    "solid": {
      "dark": 3745842,
      "mid": 7753827,
      "light": 11569046
    },
    "cleaved": {
      "dark": 6506575,
      "mid": 11703186,
      "light": 14468538
    },
    "secondary": {
      "dark": 4144197,
      "mid": 8485767,
      "light": 12170684
    },
    "groundPattern": "veins",
    "patternScale": 216,
    "patternStrength": 0.59,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.12,
    "quietCoverage": 0.56
  },
  {
    "version": 1,
    "worldId": "scab-islands",
    "ground": {
      "dark": 2437705,
      "mid": 5139595,
      "light": 9415360
    },
    "solid": {
      "dark": 5122350,
      "mid": 10111828,
      "light": 13074307
    },
    "cleaved": {
      "dark": 7426401,
      "mid": 12489636,
      "light": 15058384
    },
    "secondary": {
      "dark": 4143179,
      "mid": 8746645,
      "light": 11905221
    },
    "groundPattern": "strata",
    "patternScale": 184,
    "patternStrength": 0.58,
    "secondaryCoverage": 0.21,
    "textureContrast": 1.14,
    "quietCoverage": 0.53
  },
  {
    "version": 1,
    "worldId": "foam-trenches",
    "ground": {
      "dark": 2959166,
      "mid": 6575992,
      "light": 10655408
    },
    "solid": {
      "dark": 3425878,
      "mid": 7902113,
      "light": 12439765
    },
    "cleaved": {
      "dark": 5985109,
      "mid": 11575701,
      "light": 14668218
    },
    "secondary": {
      "dark": 5387073,
      "mid": 10249594,
      "light": 12950189
    },
    "groundPattern": "plates",
    "patternScale": 208,
    "patternStrength": 0.49,
    "secondaryCoverage": 0.19,
    "textureContrast": 1.07,
    "quietCoverage": 0.52
  },
  {
    "version": 1,
    "worldId": "resin-fall",
    "ground": {
      "dark": 3617588,
      "mid": 7891560,
      "light": 12101792
    },
    "solid": {
      "dark": 3089475,
      "mid": 6309245,
      "light": 10847665
    },
    "cleaved": {
      "dark": 4412016,
      "mid": 9282747,
      "light": 13161952
    },
    "secondary": {
      "dark": 5849655,
      "mid": 10780263,
      "light": 13874071
    },
    "groundPattern": "flow",
    "patternScale": 248,
    "patternStrength": 0.47,
    "secondaryCoverage": 0.27,
    "textureContrast": 1.05,
    "quietCoverage": 0.59
  },
  {
    "version": 1,
    "worldId": "tendon-shelves",
    "ground": {
      "dark": 2368571,
      "mid": 5326437,
      "light": 9272990
    },
    "solid": {
      "dark": 6698558,
      "mid": 12086393,
      "light": 14528686
    },
    "cleaved": {
      "dark": 6640224,
      "mid": 12428972,
      "light": 15061706
    },
    "secondary": {
      "dark": 4209462,
      "mid": 9142643,
      "light": 12563873
    },
    "groundPattern": "veins",
    "patternScale": 208,
    "patternStrength": 0.56,
    "secondaryCoverage": 0.17,
    "textureContrast": 1.13,
    "quietCoverage": 0.55
  },
  {
    "version": 1,
    "worldId": "felt-basin",
    "ground": {
      "dark": 3159106,
      "mid": 7172482,
      "light": 11251901
    },
    "solid": {
      "dark": 4337735,
      "mid": 8808578,
      "light": 12098989
    },
    "cleaved": {
      "dark": 7693135,
      "mid": 12036495,
      "light": 14603193
    },
    "secondary": {
      "dark": 2702154,
      "mid": 5797513,
      "light": 9874613
    },
    "groundPattern": "tension",
    "patternScale": 240,
    "patternStrength": 0.37,
    "secondaryCoverage": 0.22,
    "textureContrast": 1.14,
    "quietCoverage": 0.59
  },
  {
    "version": 1,
    "worldId": "cork-shelves",
    "ground": {
      "dark": 1517375,
      "mid": 3296885,
      "light": 7442348
    },
    "solid": {
      "dark": 5846574,
      "mid": 10380112,
      "light": 13608069
    },
    "cleaved": {
      "dark": 7692612,
      "mid": 12231290,
      "light": 14865074
    },
    "secondary": {
      "dark": 4928841,
      "mid": 9398664,
      "light": 11967922
    },
    "groundPattern": "grains",
    "patternScale": 192,
    "patternStrength": 0.53,
    "secondaryCoverage": 0.19,
    "textureContrast": 1.19,
    "quietCoverage": 0.57
  },
  {
    "version": 1,
    "worldId": "lacquer-court",
    "ground": {
      "dark": 3160654,
      "mid": 7308700,
      "light": 11518153
    },
    "solid": {
      "dark": 5118265,
      "mid": 10170719,
      "light": 13596054
    },
    "cleaved": {
      "dark": 4469333,
      "mid": 9270691,
      "light": 12956117
    },
    "secondary": {
      "dark": 5128765,
      "mid": 10192761,
      "light": 13219748
    },
    "groundPattern": "strata",
    "patternScale": 256,
    "patternStrength": 0.42,
    "secondaryCoverage": 0.16,
    "textureContrast": 1.12,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "ribbed-delta",
    "ground": {
      "dark": 3678508,
      "mid": 7881811,
      "light": 11303810
    },
    "solid": {
      "dark": 5784093,
      "mid": 11963460,
      "light": 14663553
    },
    "cleaved": {
      "dark": 7426873,
      "mid": 12095080,
      "light": 14664860
    },
    "secondary": {
      "dark": 2109517,
      "mid": 4351631,
      "light": 9086911
    },
    "groundPattern": "flow",
    "patternScale": 216,
    "patternStrength": 0.57,
    "secondaryCoverage": 0.38,
    "textureContrast": 1.09,
    "quietCoverage": 0.48
  },
  {
    "version": 1,
    "worldId": "bladder-weave",
    "ground": {
      "dark": 3024959,
      "mid": 6641276,
      "light": 10521263
    },
    "solid": {
      "dark": 6502732,
      "mid": 11369617,
      "light": 14401739
    },
    "cleaved": {
      "dark": 7692370,
      "mid": 12560534,
      "light": 14930619
    },
    "secondary": {
      "dark": 1780296,
      "mid": 4085381,
      "light": 8297145
    },
    "groundPattern": "tension",
    "patternScale": 192,
    "patternStrength": 0.49,
    "secondaryCoverage": 0.31,
    "textureContrast": 1.09,
    "quietCoverage": 0.51
  },
  {
    "version": 1,
    "worldId": "flake-thicket",
    "ground": {
      "dark": 2827067,
      "mid": 5981808,
      "light": 9599647
    },
    "solid": {
      "dark": 5456691,
      "mid": 10915176,
      "light": 14074776
    },
    "cleaved": {
      "dark": 2570061,
      "mid": 5600398,
      "light": 10203586
    },
    "secondary": {
      "dark": 5651002,
      "mid": 10187627,
      "light": 13279117
    },
    "groundPattern": "strata",
    "patternScale": 152,
    "patternStrength": 0.66,
    "secondaryCoverage": 0.22,
    "textureContrast": 1.17,
    "quietCoverage": 0.41
  },
  {
    "version": 1,
    "worldId": "resin-hollows",
    "ground": {
      "dark": 2502981,
      "mid": 5401991,
      "light": 10005949
    },
    "solid": {
      "dark": 3155e3,
      "mid": 6703731,
      "light": 10584749
    },
    "cleaved": {
      "dark": 7161948,
      "mid": 12093348,
      "light": 14598092
    },
    "secondary": {
      "dark": 5325623,
      "mid": 10125670,
      "light": 12891031
    },
    "groundPattern": "flow",
    "patternScale": 232,
    "patternStrength": 0.44,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.11,
    "quietCoverage": 0.59
  },
  {
    "version": 1,
    "worldId": "sentinel-mass",
    "ground": {
      "dark": 3353659,
      "mid": 7431544,
      "light": 11444917
    },
    "solid": {
      "dark": 1519179,
      "mid": 3431814,
      "light": 7773371
    },
    "cleaved": {
      "dark": 4544872,
      "mid": 10005686,
      "light": 13359062
    },
    "secondary": {
      "dark": 5325895,
      "mid": 9731456,
      "light": 12430253
    },
    "groundPattern": "strata",
    "patternScale": 256,
    "patternStrength": 0.33,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.1,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "stepped-bowl",
    "ground": {
      "dark": 3225924,
      "mid": 7832977,
      "light": 12175053
    },
    "solid": {
      "dark": 6304324,
      "mid": 11955073,
      "light": 14527411
    },
    "cleaved": {
      "dark": 2703192,
      "mid": 6193564,
      "light": 10862286
    },
    "secondary": {
      "dark": 5327683,
      "mid": 10392967,
      "light": 13617079
    },
    "groundPattern": "plates",
    "patternScale": 240,
    "patternStrength": 0.39,
    "secondaryCoverage": 0.2,
    "textureContrast": 1.08,
    "quietCoverage": 0.6
  },
  {
    "version": 1,
    "worldId": "draped-bay",
    "ground": {
      "dark": 4010545,
      "mid": 8547686,
      "light": 12363418
    },
    "solid": {
      "dark": 3624805,
      "mid": 9021881,
      "light": 12966881
    },
    "cleaved": {
      "dark": 6114401,
      "mid": 10851249,
      "light": 13944031
    },
    "secondary": {
      "dark": 5122104,
      "mid": 9527662,
      "light": 12556448
    },
    "groundPattern": "tension",
    "patternScale": 232,
    "patternStrength": 0.45,
    "secondaryCoverage": 0.29,
    "textureContrast": 1.07,
    "quietCoverage": 0.58
  },
  {
    "version": 1,
    "worldId": "ember-cushions",
    "ground": {
      "dark": 3947333,
      "mid": 9736347,
      "light": 13485777
    },
    "solid": {
      "dark": 6301995,
      "mid": 12144207,
      "light": 14849667
    },
    "cleaved": {
      "dark": 4731473,
      "mid": 9003667,
      "light": 12099783
    },
    "secondary": {
      "dark": 5065026,
      "mid": 9143412,
      "light": 12235682
    },
    "groundPattern": "flow",
    "patternScale": 208,
    "patternStrength": 0.51,
    "secondaryCoverage": 0.16,
    "textureContrast": 1.1,
    "quietCoverage": 0.55
  },
  {
    "version": 1,
    "worldId": "splinter-rotunda",
    "ground": {
      "dark": 1516607,
      "mid": 3755902,
      "light": 8493241
    },
    "solid": {
      "dark": 5850933,
      "mid": 11113848,
      "light": 14010543
    },
    "cleaved": {
      "dark": 5257809,
      "mid": 10058648,
      "light": 13284551
    },
    "secondary": {
      "dark": 3490899,
      "mid": 7834267,
      "light": 11057088
    },
    "groundPattern": "strata",
    "patternScale": 208,
    "patternStrength": 0.51,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.13,
    "quietCoverage": 0.52
  },
  {
    "version": 1,
    "worldId": "quilted-scars",
    "ground": {
      "dark": 2635840,
      "mid": 6455184,
      "light": 10796747
    },
    "solid": {
      "dark": 5648201,
      "mid": 10508674,
      "light": 14260146
    },
    "cleaved": {
      "dark": 5854567,
      "mid": 10919350,
      "light": 14143711
    },
    "secondary": {
      "dark": 4798528,
      "mid": 8875129,
      "light": 11770795
    },
    "groundPattern": "tension",
    "patternScale": 192,
    "patternStrength": 0.47,
    "secondaryCoverage": 0.19,
    "textureContrast": 1.12,
    "quietCoverage": 0.47
  },
  {
    "version": 1,
    "worldId": "silt-colonnade",
    "ground": {
      "dark": 1846080,
      "mid": 4217719,
      "light": 8822708
    },
    "solid": {
      "dark": 4934477,
      "mid": 10527136,
      "light": 14539473
    },
    "cleaved": {
      "dark": 5056291,
      "mid": 11096380,
      "light": 14195060
    },
    "secondary": {
      "dark": 4800061,
      "mid": 9535875,
      "light": 12956852
    },
    "groundPattern": "grains",
    "patternScale": 224,
    "patternStrength": 0.45,
    "secondaryCoverage": 0.23,
    "textureContrast": 1.18,
    "quietCoverage": 0.58
  },
  {
    "version": 1,
    "worldId": "shell-causeway",
    "ground": {
      "dark": 4796474,
      "mid": 9069679,
      "light": 12228768
    },
    "solid": {
      "dark": 1453655,
      "mid": 3300255,
      "light": 8560583
    },
    "cleaved": {
      "dark": 6637141,
      "mid": 11963294,
      "light": 14403537
    },
    "secondary": {
      "dark": 6116165,
      "mid": 11575433,
      "light": 13945009
    },
    "groundPattern": "plates",
    "patternScale": 184,
    "patternStrength": 0.58,
    "secondaryCoverage": 0.34,
    "textureContrast": 1.1,
    "quietCoverage": 0.45
  },
  {
    "version": 1,
    "worldId": "cleft-tableland",
    "ground": {
      "dark": 3484992,
      "mid": 7035767,
      "light": 10850475
    },
    "solid": {
      "dark": 6443110,
      "mid": 11243948,
      "light": 14534104
    },
    "cleaved": {
      "dark": 3423059,
      "mid": 7964325,
      "light": 12372957
    },
    "secondary": {
      "dark": 4928832,
      "mid": 9859709,
      "light": 12953004
    },
    "groundPattern": "strata",
    "patternScale": 240,
    "patternStrength": 0.46,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.1,
    "quietCoverage": 0.61
  },
  {
    "version": 1,
    "worldId": "fallen-spines",
    "ground": {
      "dark": 2240064,
      "mid": 5006719,
      "light": 9282230
    },
    "solid": {
      "dark": 5058615,
      "mid": 9658732,
      "light": 13476e3
    },
    "cleaved": {
      "dark": 6772568,
      "mid": 12034978,
      "light": 14734025
    },
    "secondary": {
      "dark": 3748679,
      "mid": 8086661,
      "light": 12098231
    },
    "groundPattern": "veins",
    "patternScale": 128,
    "patternStrength": 0.58,
    "secondaryCoverage": 0.17,
    "textureContrast": 1.14,
    "quietCoverage": 0.45
  },
  {
    "version": 1,
    "worldId": "clamped-shore",
    "ground": {
      "dark": 3485241,
      "mid": 7298415,
      "light": 11309473
    },
    "solid": {
      "dark": 5000019,
      "mid": 10920868,
      "light": 14276041
    },
    "cleaved": {
      "dark": 6636595,
      "mid": 11434328,
      "light": 14267787
    },
    "secondary": {
      "dark": 3417416,
      "mid": 7359369,
      "light": 11767736
    },
    "groundPattern": "plates",
    "patternScale": 216,
    "patternStrength": 0.48,
    "secondaryCoverage": 0.25,
    "textureContrast": 1.12,
    "quietCoverage": 0.57
  },
  {
    "version": 1,
    "worldId": "torn-reservoir",
    "ground": {
      "dark": 2108741,
      "mid": 5071756,
      "light": 9741766
    },
    "solid": {
      "dark": 4795198,
      "mid": 9917807,
      "light": 13603235
    },
    "cleaved": {
      "dark": 6574436,
      "mid": 11704754,
      "light": 14470364
    },
    "secondary": {
      "dark": 3553346,
      "mid": 7829637,
      "light": 10922164
    },
    "groundPattern": "tension",
    "patternScale": 208,
    "patternStrength": 0.46,
    "secondaryCoverage": 0.21,
    "textureContrast": 1.09,
    "quietCoverage": 0.6
  },
  {
    "version": 1,
    "worldId": "braided-seam",
    "ground": {
      "dark": 1452094,
      "mid": 3561334,
      "light": 7903663
    },
    "solid": {
      "dark": 2505034,
      "mid": 5470349,
      "light": 10534599
    },
    "cleaved": {
      "dark": 5913901,
      "mid": 11172950,
      "light": 14268826
    },
    "secondary": {
      "dark": 3945031,
      "mid": 7823486,
      "light": 10983088
    },
    "groundPattern": "veins",
    "patternScale": 240,
    "patternStrength": 0.4,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.11,
    "quietCoverage": 0.63
  },
  {
    "version": 1,
    "worldId": "scalloped-reach",
    "ground": {
      "dark": 1779777,
      "mid": 4216707,
      "light": 8821698
    },
    "solid": {
      "dark": 5255502,
      "mid": 11036313,
      "light": 14066621
    },
    "cleaved": {
      "dark": 6575966,
      "mid": 11641513,
      "light": 14800598
    },
    "secondary": {
      "dark": 4339266,
      "mid": 8546163,
      "light": 12098213
    },
    "groundPattern": "plates",
    "patternScale": 232,
    "patternStrength": 0.44,
    "secondaryCoverage": 0.19,
    "textureContrast": 1.09,
    "quietCoverage": 0.58
  },
  {
    "version": 1,
    "worldId": "offset-pan",
    "ground": {
      "dark": 3812665,
      "mid": 7756909,
      "light": 11505825
    },
    "solid": {
      "dark": 5724263,
      "mid": 11578811,
      "light": 14474725
    },
    "cleaved": {
      "dark": 5515576,
      "mid": 10506855,
      "light": 13343401
    },
    "secondary": {
      "dark": 3751504,
      "mid": 7634327,
      "light": 11187144
    },
    "groundPattern": "strata",
    "patternScale": 256,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.13,
    "textureContrast": 1.08,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "thin-delta",
    "ground": {
      "dark": 2108998,
      "mid": 5072519,
      "light": 9612229
    },
    "solid": {
      "dark": 4139086,
      "mid": 7951777,
      "light": 12032467
    },
    "cleaved": {
      "dark": 6244185,
      "mid": 11438750,
      "light": 14533835
    },
    "secondary": {
      "dark": 5323591,
      "mid": 9924740,
      "light": 13214895
    },
    "groundPattern": "flow",
    "patternScale": 224,
    "patternStrength": 0.46,
    "secondaryCoverage": 0.17,
    "textureContrast": 1.12,
    "quietCoverage": 0.62
  }
];

// src/generated/r100-material-organizations.ts
var ORGANIZATION_MATERIALS = [
  {
    "organization": "short-fibre",
    "source": "/assets/r100-materials/short-fibre-ground-source.png",
    "logical_pixels": 512,
    "world_size": 384,
    "regions": {
      "skin": {
        "x": 0.04,
        "y": 0.36,
        "width": 0.55,
        "height": 0.6
      },
      "cleaved": {
        "x": 0.69,
        "y": 0.36,
        "width": 0.27,
        "height": 0.6
      },
      "loose": {
        "x": 0.04,
        "y": 0.03,
        "width": 0.92,
        "height": 0.22
      }
    },
    "solid": {
      "source": "/assets/r100-materials/short-fibre-solid-source.png",
      "logical_pixels": 512,
      "world_size": 384,
      "regions": {
        "skin": {
          "x": 0.025,
          "y": 0.025,
          "width": 0.95,
          "height": 0.4
        },
        "cleaved": {
          "x": 0.025,
          "y": 0.55,
          "width": 0.95,
          "height": 0.42
        },
        "loose": {
          "x": 0.025,
          "y": 0.55,
          "width": 0.95,
          "height": 0.42
        }
      },
      "skinRoughness": 0.82,
      "cutRoughness": 0.94,
      "gain": 1,
      "cutGain": 1.08
    }
  },
  {
    "organization": "porous-marrow",
    "source": "/assets/r100-materials/porous-marrow-ground-source.png",
    "logical_pixels": 512,
    "world_size": 320,
    "regions": {
      "skin": {
        "x": 0.04,
        "y": 0.36,
        "width": 0.5,
        "height": 0.6
      },
      "cleaved": {
        "x": 0.69,
        "y": 0.36,
        "width": 0.27,
        "height": 0.6
      },
      "loose": {
        "x": 0.04,
        "y": 0.03,
        "width": 0.92,
        "height": 0.22
      }
    },
    "solid": {
      "source": "/assets/r100-materials/porous-marrow-solid-source.png",
      "logical_pixels": 512,
      "world_size": 384,
      "regions": {
        "skin": {
          "x": 0.025,
          "y": 0.025,
          "width": 0.95,
          "height": 0.4
        },
        "cleaved": {
          "x": 0.025,
          "y": 0.55,
          "width": 0.95,
          "height": 0.42
        },
        "loose": {
          "x": 0.025,
          "y": 0.55,
          "width": 0.95,
          "height": 0.42
        }
      },
      "skinRoughness": 0.72,
      "cutRoughness": 0.91,
      "gain": 1,
      "cutGain": 1.08
    }
  }
];
export {
  NativeBodyCollision,
  NativeVolumeLighting,
  ORGANIZATION_MATERIALS,
  R100_WORLD_APPEARANCES,
  compileNativeVolumeRaster,
  mapWorldPigment,
  paintedToneRange
};
