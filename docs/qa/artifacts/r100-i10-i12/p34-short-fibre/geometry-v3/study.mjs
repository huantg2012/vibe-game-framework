// src/generation/world-study/native-volume-organization.ts
var uv = (p) => [p[0], p[1]];
function curved(points, at) {
  const i = Math.min(points.length - 2, Math.floor(at)), t = at - i;
  const a = points[i], c = points[i + 1], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 2)];
  const tangent = (u, v) => u * v <= 0 ? 0 : 2 / (1 / u + 1 / v);
  return [0, 1, 2].map((axis) => {
    const d = c[axis] - a[axis], start = i === 0 ? d : tangent(a[axis] - before[axis], d);
    const end = i === points.length - 2 ? d : tangent(d, after[axis] - c[axis]);
    return (2 * t ** 3 - 3 * t * t + 1) * a[axis] + (t ** 3 - 2 * t * t + t) * start + (-2 * t ** 3 + 3 * t * t) * c[axis] + (t ** 3 - t * t) * end;
  });
}
function pressureFracture(b, a, c, d) {
  if (b.spec.blocking !== 1) return;
  const sample = (u, v) => [
    a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v,
    a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + 0.04
  ];
  const p = sample(0.16, 0.16), q = sample(0.45, 0.16), r = sample(0.39, 0.28), t = sample(0.16, 0.28);
  b.quad(p, q, r, t, 3, [uv(p), uv(q), uv(r), uv(t)], [0, 0, 1], 3);
  b.joint(sample(0.28, 0.21));
}
function buildCompressedWedge(b) {
  const s = b.spec;
  const along = [-0.5, -0.34, -0.03, 0.19, 0.32, 0.43];
  const breadth = [0.57, 0.94, 1, 0.89, 0.75, 0.63];
  const rise = [0.51, 0.9, 1, 0.77, 0.52, 0.3];
  const across = [-1, -0.73, -0.36, 0.02, 0.41, 0.76, 1];
  const crown = [0.23, 0.68, 0.94, 1, 0.88, 0.62, 0.19];
  const tear = [-0.04, 0.01, -0.045, 0.075, -5e-3, -0.075, -0.11];
  const rows = [], feet = [];
  for (let i = 0; i < along.length; i++) {
    const u = i / (along.length - 1), centre = s.width * (-0.06 + 0.08 * u + 0.025 * Math.sin(u * Math.PI));
    const radius = s.width * 0.48 * breadth[i];
    const top = s.height * rise[i], foot = s.blocking === 1 ? Math.min(4, s.height * 0.12) : 0;
    const row = across.map((v, j) => {
      const shift = s.length * (tear[j] * u ** 5 + v * (0.025 - u * 0.04));
      const z = foot + (top - foot) * crown[j];
      return [s.length * along[i] + shift, centre + radius * v, z];
    });
    rows.push(row);
    const spread = Math.min(6, s.width * 0.04);
    feet.push(row.map((p, j) => [
      p[0] + (i === 0 ? -spread : i === along.length - 1 ? spread : 0),
      p[1] + (j === 0 ? -spread : j === across.length - 1 ? spread : 0),
      0
    ]));
  }
  const sample = (u, v) => curved(rows.map((row) => curved(row, v)), u);
  for (let i = 0; i < (rows.length - 1) * 2; i++) for (let j = 0; j < (across.length - 1) * 2; j++) {
    const a = sample(i / 2, j / 2), c = sample((i + 1) / 2, j / 2), d = sample((i + 1) / 2, (j + 1) / 2), e = sample(i / 2, (j + 1) / 2);
    const cut = i >= (rows.length - 2) * 2 && (j === 2 || j === 3 || j === 8 || j === 9);
    b.quad(a, c, d, e, cut ? 1 : 0, [uv(a), uv(c), uv(d), uv(e)], [0, 0, 1], cut ? 3 : 1);
    if (i === 3 && j === 4) pressureFracture(b, a, c, d);
  }
  for (const side of [0, across.length - 1]) for (let i = 0; i < (rows.length - 1) * 2; i++) {
    const a = sample(i / 2, side), c = sample((i + 1) / 2, side), af = curved(feet.map((row) => row[side]), i / 2), cf = curved(feet.map((row) => row[side]), (i + 1) / 2);
    b.quad(af, cf, c, a, 0, [uv(af), uv(cf), uv(c), uv(a)], [0, side ? 1 : -1, 0], 1);
  }
  for (const i of [0, rows.length - 1]) for (let j = 0; j < (across.length - 1) * 2; j++) {
    const a = sample(i, j / 2), c = sample(i, (j + 1) / 2), af = curved(feet[i], j / 2), cf = curved(feet[i], (j + 1) / 2);
    const cut = i !== 0, sectionUV = (p) => [p[1], p[2]];
    b.quad(
      af,
      cf,
      c,
      a,
      cut ? 1 : 0,
      [sectionUV(af), sectionUV(cf), sectionUV(c), sectionUV(a)],
      [cut ? 1 : -1, 0, 0],
      cut ? 3 : 1
    );
  }
}
function smoothOrganizedSurface(mesh) {
  const groups = /* @__PURE__ */ new Map();
  for (let face = 0; face < mesh.triangleCount; face++) {
    if (mesh.materials[face] !== 0) continue;
    for (let corner = 0; corner < 3; corner++) {
      const vertex = mesh.indices[face * 3 + corner], at = vertex * 3;
      const previous = mesh.indices[face * 3 + (corner + 1) % 3] * 3;
      const next = mesh.indices[face * 3 + (corner + 2) % 3] * 3;
      const ax = mesh.positions[previous] - mesh.positions[at], ay = mesh.positions[previous + 1] - mesh.positions[at + 1], az = mesh.positions[previous + 2] - mesh.positions[at + 2];
      const bx = mesh.positions[next] - mesh.positions[at], by = mesh.positions[next + 1] - mesh.positions[at + 1], bz = mesh.positions[next + 2] - mesh.positions[at + 2];
      const dot = (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz));
      const weight = Math.acos(Math.max(-1, Math.min(1, dot)));
      const key = `${mesh.positions[at]},${mesh.positions[at + 1]},${mesh.positions[at + 2]}:${mesh.regions[face]}`;
      const entries = groups.get(key) ?? [];
      entries.push({ vertex, weight });
      groups.set(key, entries);
    }
  }
  const normals = new Float32Array(mesh.normals), creaseCosine = Math.cos(55 * Math.PI / 180);
  for (const entries of groups.values()) for (const { vertex } of entries) {
    const at = vertex * 3, nx = mesh.normals[at], ny = mesh.normals[at + 1], nz = mesh.normals[at + 2];
    let x = 0, y = 0, z = 0;
    for (const { vertex: other, weight } of entries) {
      const q = other * 3, ox = mesh.normals[q], oy = mesh.normals[q + 1], oz = mesh.normals[q + 2];
      if (nx * ox + ny * oy + nz * oz < creaseCosine) continue;
      x += ox * weight;
      y += oy * weight;
      z += oz * weight;
    }
    const length = Math.hypot(x, y, z);
    if (length > 0) {
      normals[at] = x / length;
      normals[at + 1] = y / length;
      normals[at + 2] = z / length;
    }
  }
  return { ...mesh, normals };
}

// src/generation/world-study/native-volume-compressed-felt.ts
var GROUPS = [
  { x: -0.31, y: -0.15, angle: 0.35, branches: 3 },
  { x: -0.28, y: 0.16, angle: -0.4, branches: 2 },
  { x: -0.08, y: 0.28, angle: -0.76, branches: 3 },
  { x: 0.15, y: 0.2, angle: -1, branches: 2 },
  { x: 0.24, y: 0.01, angle: 2.25, branches: 3 },
  { x: 0.18, y: -0.2, angle: 2.76, branches: 2 },
  { x: -0.025, y: -0.25, angle: 0.65, branches: 3 },
  { x: -0.32, y: -0.31, angle: 0.05, branches: 2 },
  { x: 0.04, y: -0.055, angle: 1.04, branches: 3 },
  { x: -0.15, y: 0.075, angle: -0.08, branches: 2 }
];
function heightAt(triangles, x, y) {
  let highest;
  for (const { a, b, c } of triangles) {
    const dx = b[0] - a[0], dy = b[1] - a[1], ex = c[0] - a[0], ey = c[1] - a[1];
    const determinant = dx * ey - dy * ex;
    if (Math.abs(determinant) < 1e-9) continue;
    const px = x - a[0], py = y - a[1];
    const u = (px * ey - py * ex) / determinant, v = (dx * py - dy * px) / determinant;
    if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) continue;
    const z = a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
    if (highest === void 0 || z > highest) highest = z;
  }
  return highest;
}
function buildCompressedFelt(b) {
  const skin = [], protectedFaces = [];
  let ceiling = 0;
  buildCompressedWedge({
    spec: b.spec,
    quad(a, c, d, e, material, coordinates, wanted, region) {
      b.quad(a, c, d, e, material, coordinates, wanted, region);
      ceiling = Math.max(ceiling, a[2], c[2], d[2], e[2]);
      const destination = material === 3 ? protectedFaces : skin;
      destination.push({ a, b: c, c: d }, { a, b: d, c: e });
    },
    joint: (point) => b.joint(point)
  });
  const s = b.spec;
  let groupCount = 0, branchCount = 0;
  for (let index = 0; index < GROUPS.length; index++) {
    const group = GROUPS[index];
    let accepted = 0;
    for (let branch = 0; branch < group.branches; branch++) {
      const spread = branch - (group.branches - 1) * 0.5;
      const angle = group.angle + spread * (0.21 + index % 3 * 0.055);
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      const length = 12 + (index * 7 + branch * 5) % 13;
      const width = 3.2 + (index * 3 + branch * 7) % 9 * 0.2;
      const rise = Math.min(2.25 + (index + branch * 3) % 4 * 0.2, s.height * 0.065);
      const bend = (index % 2 ? -1 : 1) * (2 + branch * 0.7);
      const originX = group.x * s.length - spread * 0.7 * Math.sin(group.angle);
      const originY = group.y * s.width + spread * 0.7 * Math.cos(group.angle);
      const rows = [], coordinates = [];
      let supported = true;
      for (let step = 0; step < 3; step++) {
        const t = step * 0.5, bow = Math.sin(t * Math.PI) * bend;
        const dx = length * cosine - Math.PI * Math.cos(t * Math.PI) * bend * sine;
        const dy = length * sine + Math.PI * Math.cos(t * Math.PI) * bend * cosine;
        const norm = Math.hypot(dx, dy), normalX = -dy / norm, normalY = dx / norm;
        const cx = originX + t * length * cosine - bow * sine;
        const cy = originY + t * length * sine + bow * cosine;
        const row = [], uvRow = [];
        for (let across = 0; across < 3; across++) {
          const side = across - 1, halfWidth = width * 0.5 * (step === 0 ? 0 : step === 1 ? 1 : 0.74);
          const retreat = step === 2 && side === 0 ? 1.15 : 0;
          const x2 = cx + side * halfWidth * normalX - retreat * cosine;
          const y2 = cy + side * halfWidth * normalY - retreat * sine;
          const base2 = heightAt(skin, x2, y2);
          if (base2 === void 0 || heightAt(protectedFaces, x2, y2) !== void 0) {
            supported = false;
            break;
          }
          row.push([x2, y2, Math.min(ceiling, base2 + (side === 0 && step > 0 ? rise * (step === 2 ? 0.72 : 1) : 0))]);
          uvRow.push([originX + t * length - retreat, originY + side * halfWidth]);
        }
        if (!supported) break;
        rows.push(row);
        coordinates.push(uvRow);
      }
      if (!supported) continue;
      const points = rows.flat(), minX = Math.min(...points.map((p) => p[0])), maxX = Math.max(...points.map((p) => p[0]));
      const minY = Math.min(...points.map((p) => p[1])), maxY = Math.max(...points.map((p) => p[1]));
      if (protectedFaces.some(({ a, b: c, c: d }) => Math.max(a[0], c[0], d[0]) >= minX && Math.min(a[0], c[0], d[0]) <= maxX && Math.max(a[1], c[1], d[1]) >= minY && Math.min(a[1], c[1], d[1]) <= maxY)) continue;
      const x = originX + length * cosine, y = originY + length * sine;
      const base = heightAt(skin, x, y);
      if (base === void 0 || heightAt(protectedFaces, x, y) !== void 0) continue;
      for (let step = 0; step < 2; step++) for (let across = 0; across < 2; across++) {
        b.quad(
          rows[step][across],
          rows[step + 1][across],
          rows[step + 1][across + 1],
          rows[step][across + 1],
          0,
          [coordinates[step][across], coordinates[step + 1][across], coordinates[step + 1][across + 1], coordinates[step][across + 1]],
          [0, 0, 1],
          1
        );
      }
      const end = rows[2], endUV = coordinates[2];
      const tip = [x, y, base], tipUV = [originX + length, originY];
      b.quad(end[0], end[1], tip, end[0], 1, [endUV[0], endUV[1], tipUV, endUV[0]], [0, 0, 1], 3);
      b.quad(end[1], end[2], tip, end[1], 1, [endUV[1], endUV[2], tipUV, endUV[1]], [0, 0, 1], 3);
      branchCount++;
      accepted++;
    }
    if (accepted > 0) groupCount++;
  }
  return { groups: groupCount, branches: branchCount };
}

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
  const heightField = new Float32Array(size), normals = new Float32Array(size * 3), uv2 = new Float32Array(size * 2);
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
          uv2[index * 2] = tex[ia * 2] * wa + tex[ib * 2] * wb + tex[ic * 2] * wc;
          uv2[index * 2 + 1] = tex[ia * 2 + 1] * wa + tex[ib * 2 + 1] * wb + tex[ic * 2 + 1] * wc;
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
    uv: uv2,
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
  },
  {
    "version": 1,
    "worldId": "shard-switchback",
    "ground": {
      "dark": 2568260,
      "mid": 5727356,
      "light": 10398912
    },
    "solid": {
      "dark": 5455964,
      "mid": 10188955,
      "light": 13678026
    },
    "cleaved": {
      "dark": 6702673,
      "mid": 11896727,
      "light": 14991307
    },
    "secondary": {
      "dark": 4604499,
      "mid": 9208214,
      "light": 12103100
    },
    "groundPattern": "strata",
    "patternScale": 224,
    "patternStrength": 0.42,
    "secondaryCoverage": 0.16,
    "textureContrast": 1.1,
    "quietCoverage": 0.58
  },
  {
    "version": 1,
    "worldId": "hollow-wreckage",
    "ground": {
      "dark": 1386554,
      "mid": 4020077,
      "light": 8690346
    },
    "solid": {
      "dark": 5590331,
      "mid": 10787705,
      "light": 13880495
    },
    "cleaved": {
      "dark": 4793906,
      "mid": 9981283,
      "light": 13538213
    },
    "secondary": {
      "dark": 3682623,
      "mid": 7954544,
      "light": 11637921
    },
    "groundPattern": "plates",
    "patternScale": 232,
    "patternStrength": 0.43,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.13,
    "quietCoverage": 0.61
  },
  {
    "version": 1,
    "worldId": "knotted-run",
    "ground": {
      "dark": 2437431,
      "mid": 5465962,
      "light": 9676196
    },
    "solid": {
      "dark": 4665912,
      "mid": 9597536,
      "light": 12756619
    },
    "cleaved": {
      "dark": 5325138,
      "mid": 10322332,
      "light": 13546696
    },
    "secondary": {
      "dark": 3877958,
      "mid": 7492985,
      "light": 10980524
    },
    "groundPattern": "veins",
    "patternScale": 216,
    "patternStrength": 0.41,
    "secondaryCoverage": 0.16,
    "textureContrast": 1.13,
    "quietCoverage": 0.59
  },
  {
    "version": 1,
    "worldId": "rolled-fragments",
    "ground": {
      "dark": 1518146,
      "mid": 3692668,
      "light": 8100281
    },
    "solid": {
      "dark": 5257262,
      "mid": 10582614,
      "light": 13941391
    },
    "cleaved": {
      "dark": 6840429,
      "mid": 11971259,
      "light": 14603743
    },
    "secondary": {
      "dark": 3487305,
      "mid": 7960725,
      "light": 11578565
    },
    "groundPattern": "tension",
    "patternScale": 236,
    "patternStrength": 0.4,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.11,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "fibre-choke",
    "ground": {
      "dark": 2106427,
      "mid": 5395567,
      "light": 9869748
    },
    "solid": {
      "dark": 2505038,
      "mid": 5405595,
      "light": 10665684
    },
    "cleaved": {
      "dark": 5462374,
      "mid": 10923450,
      "light": 14146788
    },
    "secondary": {
      "dark": 5387075,
      "mid": 10841480,
      "light": 13936826
    },
    "groundPattern": "veins",
    "patternScale": 224,
    "patternStrength": 0.43,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.13,
    "quietCoverage": 0.56
  },
  {
    "version": 1,
    "worldId": "buried-lamellae",
    "ground": {
      "dark": 3024170,
      "mid": 6377551,
      "light": 11046535
    },
    "solid": {
      "dark": 3163738,
      "mid": 7248056,
      "light": 11848409
    },
    "cleaved": {
      "dark": 6317166,
      "mid": 11450311,
      "light": 14476264
    },
    "secondary": {
      "dark": 4729385,
      "mid": 9851976,
      "light": 12948095
    },
    "groundPattern": "strata",
    "patternScale": 248,
    "patternStrength": 0.42,
    "secondaryCoverage": 0.24,
    "textureContrast": 1.12,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "pressed-rim",
    "ground": {
      "dark": 3090489,
      "mid": 6904174,
      "light": 11178666
    },
    "solid": {
      "dark": 1452095,
      "mid": 3758475,
      "light": 9284299
    },
    "cleaved": {
      "dark": 6574688,
      "mid": 12098223,
      "light": 14667741
    },
    "secondary": {
      "dark": 5064514,
      "mid": 10128509,
      "light": 1355e4
    },
    "groundPattern": "flow",
    "patternScale": 236,
    "patternStrength": 0.46,
    "secondaryCoverage": 0.18,
    "textureContrast": 1.14,
    "quietCoverage": 0.59
  },
  {
    "version": 1,
    "worldId": "wedged-hide",
    "ground": {
      "dark": 2695223,
      "mid": 6441321,
      "light": 10520491
    },
    "solid": {
      "dark": 5515073,
      "mid": 10965393,
      "light": 14260417
    },
    "cleaved": {
      "dark": 5589337,
      "mid": 10785960,
      "light": 14273757
    },
    "secondary": {
      "dark": 4934742,
      "mid": 10921907,
      "light": 14014431
    },
    "groundPattern": "tension",
    "patternScale": 228,
    "patternStrength": 0.41,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.12,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "quiet-spur",
    "ground": {
      "dark": 3879465,
      "mid": 9139804,
      "light": 11969932
    },
    "solid": {
      "dark": 2892343,
      "mid": 6705517,
      "light": 11309745
    },
    "cleaved": {
      "dark": 6116955,
      "mid": 11313579,
      "light": 14143444
    },
    "secondary": {
      "dark": 3357003,
      "mid": 7240593,
      "light": 10990272
    },
    "groundPattern": "grains",
    "patternScale": 256,
    "patternStrength": 0.34,
    "secondaryCoverage": 0.1,
    "textureContrast": 1.08,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "split-fall",
    "ground": {
      "dark": 2963013,
      "mid": 6780812,
      "light": 10925511
    },
    "solid": {
      "dark": 3158088,
      "mid": 6579073,
      "light": 11183811
    },
    "cleaved": {
      "dark": 6899800,
      "mid": 11305363,
      "light": 14269131
    },
    "secondary": {
      "dark": 4537168,
      "mid": 9206167,
      "light": 12232387
    },
    "groundPattern": "strata",
    "patternScale": 240,
    "patternStrength": 0.41,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.13,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "three-shelves",
    "ground": {
      "dark": 3683389,
      "mid": 7893372,
      "light": 11577524
    },
    "solid": {
      "dark": 4995401,
      "mid": 9796236,
      "light": 13415877
    },
    "cleaved": {
      "dark": 2438733,
      "mid": 5927054,
      "light": 10926282
    },
    "secondary": {
      "dark": 4273467,
      "mid": 8876151,
      "light": 11836833
    },
    "groundPattern": "plates",
    "patternScale": 252,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.11,
    "textureContrast": 1.11,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "frayed-outwash",
    "ground": {
      "dark": 1583166,
      "mid": 4020343,
      "light": 8494523
    },
    "solid": {
      "dark": 4336945,
      "mid": 9528146,
      "light": 13018254
    },
    "cleaved": {
      "dark": 6906218,
      "mid": 11841209,
      "light": 14605281
    },
    "secondary": {
      "dark": 3418945,
      "mid": 7889793,
      "light": 11311032
    },
    "groundPattern": "veins",
    "patternScale": 248,
    "patternStrength": 0.38,
    "secondaryCoverage": 0.13,
    "textureContrast": 1.12,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "short-fibre-mat",
    "ground": {
      "dark": 2961465,
      "mid": 6646905,
      "light": 10463157
    },
    "solid": {
      "dark": 6771296,
      "mid": 11374237,
      "light": 14205130
    },
    "cleaved": {
      "dark": 4274996,
      "mid": 9009511,
      "light": 12100491
    },
    "secondary": {
      "dark": 3292491,
      "mid": 7702937,
      "light": 11320007
    },
    "groundPattern": "tension",
    "patternScale": 248,
    "patternStrength": 0.34,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.13,
    "quietCoverage": 0.63,
    "materialOrganization": "short-fibre"
  },
  {
    "version": 1,
    "worldId": "marrow-break",
    "ground": {
      "dark": 2108227,
      "mid": 5400203,
      "light": 9544899
    },
    "solid": {
      "dark": 5122089,
      "mid": 10049366,
      "light": 13342352
    },
    "cleaved": {
      "dark": 8419164,
      "mid": 12234635,
      "light": 14275251
    },
    "secondary": {
      "dark": 4602673,
      "mid": 9402969,
      "light": 12430466
    },
    "groundPattern": "grains",
    "patternScale": 232,
    "patternStrength": 0.38,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.16,
    "quietCoverage": 0.61,
    "materialOrganization": "porous-marrow"
  },
  {
    "version": 1,
    "worldId": "felt-wedges",
    "ground": {
      "dark": 3682365,
      "mid": 8351872,
      "light": 12036796
    },
    "solid": {
      "dark": 3098977,
      "mid": 7443376,
      "light": 11913948
    },
    "cleaved": {
      "dark": 6501186,
      "mid": 11232126,
      "light": 14197173
    },
    "secondary": {
      "dark": 4932695,
      "mid": 9734827,
      "light": 12827348
    },
    "groundPattern": "tension",
    "patternScale": 224,
    "patternStrength": 0.37,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.12,
    "quietCoverage": 0.58,
    "materialOrganization": "short-fibre"
  },
  {
    "version": 1,
    "worldId": "pore-bank",
    "ground": {
      "dark": 3746856,
      "mid": 7888982,
      "light": 11836299
    },
    "solid": {
      "dark": 4865872,
      "mid": 9271193,
      "light": 12627657
    },
    "cleaved": {
      "dark": 7038558,
      "mid": 11051413,
      "light": 15064265
    },
    "secondary": {
      "dark": 4147282,
      "mid": 9016484,
      "light": 11845837
    },
    "groundPattern": "grains",
    "patternScale": 256,
    "patternStrength": 0.32,
    "secondaryCoverage": 0.1,
    "textureContrast": 1.14,
    "quietCoverage": 0.65,
    "materialOrganization": "porous-marrow"
  },
  {
    "version": 1,
    "worldId": "staggered-cups",
    "ground": {
      "dark": 3155243,
      "mid": 6836300,
      "light": 10849921
    },
    "solid": {
      "dark": 2701129,
      "mid": 6322057,
      "light": 11648456
    },
    "cleaved": {
      "dark": 6374736,
      "mid": 11372181,
      "light": 14269896
    },
    "secondary": {
      "dark": 3419715,
      "mid": 7364728,
      "light": 10984110
    },
    "groundPattern": "plates",
    "patternScale": 240,
    "patternStrength": 0.39,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.12,
    "quietCoverage": 0.6
  },
  {
    "version": 1,
    "worldId": "split-tows",
    "ground": {
      "dark": 2370362,
      "mid": 5595763,
      "light": 9674931
    },
    "solid": {
      "dark": 4337474,
      "mid": 9197944,
      "light": 12818348
    },
    "cleaved": {
      "dark": 6184554,
      "mid": 11449024,
      "light": 14278887
    },
    "secondary": {
      "dark": 4273976,
      "mid": 8548464,
      "light": 11640986
    },
    "groundPattern": "veins",
    "patternScale": 232,
    "patternStrength": 0.42,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.14,
    "quietCoverage": 0.61
  },
  {
    "version": 1,
    "worldId": "curled-flats",
    "ground": {
      "dark": 3420204,
      "mid": 7892316,
      "light": 11576205
    },
    "solid": {
      "dark": 4736848,
      "mid": 9868706,
      "light": 13749976
    },
    "cleaved": {
      "dark": 3614271,
      "mid": 7886199,
      "light": 11770036
    },
    "secondary": {
      "dark": 2896963,
      "mid": 6517898,
      "light": 10794183
    },
    "groundPattern": "tension",
    "patternScale": 256,
    "patternStrength": 0.32,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.1,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "pitch-forks",
    "ground": {
      "dark": 2501943,
      "mid": 5726830,
      "light": 9740717
    },
    "solid": {
      "dark": 2366507,
      "mid": 4864089,
      "light": 9008525
    },
    "cleaved": {
      "dark": 6701647,
      "mid": 11764883,
      "light": 14333887
    },
    "secondary": {
      "dark": 3161160,
      "mid": 7243672,
      "light": 10992584
    },
    "groundPattern": "flow",
    "patternScale": 248,
    "patternStrength": 0.37,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.17,
    "quietCoverage": 0.6
  },
  {
    "version": 1,
    "worldId": "grain-weld",
    "ground": {
      "dark": 2306116,
      "mid": 5401473,
      "light": 9545143
    },
    "solid": {
      "dark": 5591122,
      "mid": 10920096,
      "light": 14143944
    },
    "cleaved": {
      "dark": 5391417,
      "mid": 9994866,
      "light": 13285024
    },
    "secondary": {
      "dark": 4465456,
      "mid": 8994386,
      "light": 12682641
    },
    "groundPattern": "grains",
    "patternScale": 224,
    "patternStrength": 0.43,
    "secondaryCoverage": 0.19,
    "textureContrast": 1.16,
    "quietCoverage": 0.59
  },
  {
    "version": 1,
    "worldId": "silk-catch",
    "ground": {
      "dark": 3287356,
      "mid": 7035506,
      "light": 10982575
    },
    "solid": {
      "dark": 3030347,
      "mid": 7505560,
      "light": 12175314
    },
    "cleaved": {
      "dark": 6312811,
      "mid": 10785457,
      "light": 14010335
    },
    "secondary": {
      "dark": 5257775,
      "mid": 10187856,
      "light": 13151363
    },
    "groundPattern": "tension",
    "patternScale": 240,
    "patternStrength": 0.38,
    "secondaryCoverage": 0.17,
    "textureContrast": 1.13,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "resin-sleeve",
    "ground": {
      "dark": 2502722,
      "mid": 5859707,
      "light": 10004922
    },
    "solid": {
      "dark": 4465457,
      "mid": 9518417,
      "light": 13207442
    },
    "cleaved": {
      "dark": 6770782,
      "mid": 11505824,
      "light": 14533839
    },
    "secondary": {
      "dark": 5067869,
      "mid": 10530743,
      "light": 14016480
    },
    "groundPattern": "flow",
    "patternScale": 228,
    "patternStrength": 0.42,
    "secondaryCoverage": 0.2,
    "textureContrast": 1.17,
    "quietCoverage": 0.56
  },
  {
    "version": 1,
    "worldId": "shell-threads",
    "ground": {
      "dark": 3485753,
      "mid": 7891822,
      "light": 11576222
    },
    "solid": {
      "dark": 4929096,
      "mid": 9728905,
      "light": 13414594
    },
    "cleaved": {
      "dark": 6641231,
      "mid": 11704971,
      "light": 14404796
    },
    "secondary": {
      "dark": 1517631,
      "mid": 3758203,
      "light": 8495032
    },
    "groundPattern": "plates",
    "patternScale": 248,
    "patternStrength": 0.37,
    "secondaryCoverage": 0.17,
    "textureContrast": 1.13,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "chalk-divide",
    "ground": {
      "dark": 2566722,
      "mid": 5791364,
      "light": 9738939
    },
    "solid": {
      "dark": 6642528,
      "mid": 12167849,
      "light": 14734795
    },
    "cleaved": {
      "dark": 4469037,
      "mid": 8741195,
      "light": 12425088
    },
    "secondary": {
      "dark": 3618628,
      "mid": 7698052,
      "light": 11578552
    },
    "groundPattern": "grains",
    "patternScale": 256,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.14,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "red-vault-fragments",
    "ground": {
      "dark": 2438215,
      "mid": 5927043,
      "light": 10268349
    },
    "solid": {
      "dark": 4791850,
      "mid": 9518415,
      "light": 12943246
    },
    "cleaved": {
      "dark": 6447211,
      "mid": 11644089,
      "light": 14604769
    },
    "secondary": {
      "dark": 4472120,
      "mid": 9141869,
      "light": 12299413
    },
    "groundPattern": "plates",
    "patternScale": 240,
    "patternStrength": 0.41,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.16,
    "quietCoverage": 0.63
  },
  {
    "version": 1,
    "worldId": "blue-fault",
    "ground": {
      "dark": 3156278,
      "mid": 6838631,
      "light": 10850468
    },
    "solid": {
      "dark": 1518416,
      "mid": 3431062,
      "light": 8298181
    },
    "cleaved": {
      "dark": 6642765,
      "mid": 11575941,
      "light": 14471347
    },
    "secondary": {
      "dark": 3878972,
      "mid": 8415101,
      "light": 12097710
    },
    "groundPattern": "strata",
    "patternScale": 252,
    "patternStrength": 0.4,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.15,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "pale-pressure",
    "ground": {
      "dark": 2306114,
      "mid": 5532801,
      "light": 9939898
    },
    "solid": {
      "dark": 4934488,
      "mid": 10526893,
      "light": 14276319
    },
    "cleaved": {
      "dark": 4991808,
      "mid": 9589101,
      "light": 13145256
    },
    "secondary": {
      "dark": 4471878,
      "mid": 9141131,
      "light": 12430524
    },
    "groundPattern": "tension",
    "patternScale": 248,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.13,
    "textureContrast": 1.12,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "notched-backwater",
    "ground": {
      "dark": 2043715,
      "mid": 4876418,
      "light": 9545405
    },
    "solid": {
      "dark": 3682628,
      "mid": 7629701,
      "light": 11774141
    },
    "cleaved": {
      "dark": 6443863,
      "mid": 11441302,
      "light": 14271682
    },
    "secondary": {
      "dark": 4275268,
      "mid": 8549760,
      "light": 11839154
    },
    "groundPattern": "flow",
    "patternScale": 256,
    "patternStrength": 0.34,
    "secondaryCoverage": 0.13,
    "textureContrast": 1.14,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "crossed-casings",
    "ground": {
      "dark": 3485483,
      "mid": 8022873,
      "light": 11903626
    },
    "solid": {
      "dark": 1911618,
      "mid": 4348798,
      "light": 9150393
    },
    "cleaved": {
      "dark": 6507097,
      "mid": 11702692,
      "light": 14533844
    },
    "secondary": {
      "dark": 3814209,
      "mid": 8088456,
      "light": 11575233
    },
    "groundPattern": "plates",
    "patternScale": 244,
    "patternStrength": 0.38,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.13,
    "quietCoverage": 0.61
  },
  {
    "version": 1,
    "worldId": "fibre-stumpfield",
    "ground": {
      "dark": 2502974,
      "mid": 5795971,
      "light": 10071998
    },
    "solid": {
      "dark": 5521461,
      "mid": 10780509,
      "light": 13808779
    },
    "cleaved": {
      "dark": 4597298,
      "mid": 9258326,
      "light": 13141138
    },
    "secondary": {
      "dark": 3682367,
      "mid": 8086917,
      "light": 11376057
    },
    "groundPattern": "veins",
    "patternScale": 228,
    "patternStrength": 0.44,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.14,
    "quietCoverage": 0.58
  },
  {
    "version": 1,
    "worldId": "sloughed-court",
    "ground": {
      "dark": 3159879,
      "mid": 7899550,
      "light": 12306389
    },
    "solid": {
      "dark": 3153977,
      "mid": 6637689,
      "light": 11046074
    },
    "cleaved": {
      "dark": 5848128,
      "mid": 11170165,
      "light": 13870760
    },
    "secondary": {
      "dark": 4340806,
      "mid": 8944521,
      "light": 12102073
    },
    "groundPattern": "tension",
    "patternScale": 256,
    "patternStrength": 0.32,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.13,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "crushed-seam",
    "ground": {
      "dark": 2240579,
      "mid": 5467270,
      "light": 9940157
    },
    "solid": {
      "dark": 4533036,
      "mid": 9986897,
      "light": 13279627
    },
    "cleaved": {
      "dark": 6709355,
      "mid": 12104640,
      "light": 14735842
    },
    "secondary": {
      "dark": 4142403,
      "mid": 8876680,
      "light": 12101051
    },
    "groundPattern": "strata",
    "patternScale": 244,
    "patternStrength": 0.37,
    "secondaryCoverage": 0.13,
    "textureContrast": 1.15,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "husk-reef",
    "ground": {
      "dark": 2564667,
      "mid": 6378873,
      "light": 10786738
    },
    "solid": {
      "dark": 5327676,
      "mid": 10721140,
      "light": 13813929
    },
    "cleaved": {
      "dark": 3744045,
      "mid": 8405327,
      "light": 12157323
    },
    "secondary": {
      "dark": 4146772,
      "mid": 8622244,
      "light": 12042447
    },
    "groundPattern": "plates",
    "patternScale": 252,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.13,
    "textureContrast": 1.13,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "fibre-scree",
    "ground": {
      "dark": 3154743,
      "mid": 7031653,
      "light": 10783139
    },
    "solid": {
      "dark": 2767440,
      "mid": 7045016,
      "light": 11320011
    },
    "cleaved": {
      "dark": 6444609,
      "mid": 11378816,
      "light": 14207922
    },
    "secondary": {
      "dark": 3815751,
      "mid": 8485779,
      "light": 11906239
    },
    "groundPattern": "veins",
    "patternScale": 224,
    "patternStrength": 0.39,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.15,
    "quietCoverage": 0.61
  },
  {
    "version": 1,
    "worldId": "gel-rafts",
    "ground": {
      "dark": 2437959,
      "mid": 6321807,
      "light": 10465989
    },
    "solid": {
      "dark": 5456203,
      "mid": 11242652,
      "light": 14205899
    },
    "cleaved": {
      "dark": 3350584,
      "mid": 7358578,
      "light": 11372199
    },
    "secondary": {
      "dark": 4209478,
      "mid": 9339534,
      "light": 12628413
    },
    "groundPattern": "flow",
    "patternScale": 256,
    "patternStrength": 0.3,
    "secondaryCoverage": 0.1,
    "textureContrast": 1.12,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "double-return",
    "ground": {
      "dark": 3681842,
      "mid": 8152677,
      "light": 12100250
    },
    "solid": {
      "dark": 2899024,
      "mid": 7111325,
      "light": 11517902
    },
    "cleaved": {
      "dark": 7428454,
      "mid": 12164783,
      "light": 14732248
    },
    "secondary": {
      "dark": 4405570,
      "mid": 8944005,
      "light": 12364984
    },
    "groundPattern": "strata",
    "patternScale": 256,
    "patternStrength": 0.34,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.13,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "offset-basins",
    "ground": {
      "dark": 2043204,
      "mid": 4941704,
      "light": 9480382
    },
    "solid": {
      "dark": 5516099,
      "mid": 10769273,
      "light": 13866930
    },
    "cleaved": {
      "dark": 6381160,
      "mid": 11250101,
      "light": 14539231
    },
    "secondary": {
      "dark": 3880003,
      "mid": 8220293,
      "light": 11772088
    },
    "groundPattern": "plates",
    "patternScale": 248,
    "patternStrength": 0.37,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.14,
    "quietCoverage": 0.63
  },
  {
    "version": 1,
    "worldId": "pinched-fan",
    "ground": {
      "dark": 3159878,
      "mid": 7438483,
      "light": 11517902
    },
    "solid": {
      "dark": 5460837,
      "mid": 11251386,
      "light": 14606053
    },
    "cleaved": {
      "dark": 2635850,
      "mid": 6454166,
      "light": 11124174
    },
    "secondary": {
      "dark": 4007212,
      "mid": 8733515,
      "light": 12287357
    },
    "groundPattern": "tension",
    "patternScale": 244,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.16,
    "textureContrast": 1.12,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "spliced-reaches",
    "ground": {
      "dark": 3094336,
      "mid": 7043719,
      "light": 11122621
    },
    "solid": {
      "dark": 3155001,
      "mid": 7361396,
      "light": 11505578
    },
    "cleaved": {
      "dark": 6377541,
      "mid": 11177072,
      "light": 13942179
    },
    "secondary": {
      "dark": 4076356,
      "mid": 8810380,
      "light": 11901880
    },
    "groundPattern": "veins",
    "patternScale": 240,
    "patternStrength": 0.4,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.14,
    "quietCoverage": 0.61
  },
  {
    "version": 1,
    "worldId": "white-scarfield",
    "ground": {
      "dark": 4340032,
      "mid": 10062737,
      "light": 13681860
    },
    "solid": {
      "dark": 2042948,
      "mid": 4742784,
      "light": 9742527
    },
    "cleaved": {
      "dark": 5982778,
      "mid": 10586731,
      "light": 13482139
    },
    "secondary": {
      "dark": 4865352,
      "mid": 10059150,
      "light": 13020347
    },
    "groundPattern": "grains",
    "patternScale": 256,
    "patternStrength": 0.31,
    "secondaryCoverage": 0.1,
    "textureContrast": 1.15,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "black-lacuna",
    "ground": {
      "dark": 3947589,
      "mid": 8816788,
      "light": 12698059
    },
    "solid": {
      "dark": 2104105,
      "mid": 4799067,
      "light": 8877204
    },
    "cleaved": {
      "dark": 6308945,
      "mid": 10976912,
      "light": 14071751
    },
    "secondary": {
      "dark": 3489355,
      "mid": 7570841,
      "light": 11385802
    },
    "groundPattern": "flow",
    "patternScale": 256,
    "patternStrength": 0.3,
    "secondaryCoverage": 0.11,
    "textureContrast": 1.17,
    "quietCoverage": 0.65
  },
  {
    "version": 1,
    "worldId": "ochre-folds",
    "ground": {
      "dark": 3488583,
      "mid": 8227740,
      "light": 12240850
    },
    "solid": {
      "dark": 5653299,
      "mid": 11042897,
      "light": 14005634
    },
    "cleaved": {
      "dark": 2437448,
      "mid": 5664147,
      "light": 10202823
    },
    "secondary": {
      "dark": 4535104,
      "mid": 9726847,
      "light": 13081261
    },
    "groundPattern": "tension",
    "patternScale": 240,
    "patternStrength": 0.36,
    "secondaryCoverage": 0.12,
    "textureContrast": 1.13,
    "quietCoverage": 0.64
  },
  {
    "version": 1,
    "worldId": "violet-marrows",
    "ground": {
      "dark": 2897218,
      "mid": 6781323,
      "light": 10926023
    },
    "solid": {
      "dark": 4796499,
      "mid": 9593244,
      "light": 12952013
    },
    "cleaved": {
      "dark": 7757939,
      "mid": 12427958,
      "light": 14798813
    },
    "secondary": {
      "dark": 4866378,
      "mid": 9536911,
      "light": 12432059
    },
    "groundPattern": "grains",
    "patternScale": 232,
    "patternStrength": 0.34,
    "secondaryCoverage": 0.13,
    "textureContrast": 1.15,
    "quietCoverage": 0.62,
    "materialOrganization": "porous-marrow"
  },
  {
    "version": 1,
    "worldId": "fractured-estuary",
    "ground": {
      "dark": 3160137,
      "mid": 7570584,
      "light": 11583440
    },
    "solid": {
      "dark": 3222865,
      "mid": 7234976,
      "light": 11380170
    },
    "cleaved": {
      "dark": 6710127,
      "mid": 11710138,
      "light": 14539232
    },
    "secondary": {
      "dark": 4924725,
      "mid": 10700128,
      "light": 13536159
    },
    "groundPattern": "strata",
    "patternScale": 240,
    "patternStrength": 0.36,
    "secondaryCoverage": 0.17,
    "textureContrast": 1.14,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "woven-quarters",
    "ground": {
      "dark": 3482941,
      "mid": 7623293,
      "light": 11375027
    },
    "solid": {
      "dark": 3096918,
      "mid": 7771052,
      "light": 12044758
    },
    "cleaved": {
      "dark": 5330534,
      "mid": 10264494,
      "light": 13357532
    },
    "secondary": {
      "dark": 5650989,
      "mid": 11302481,
      "light": 13938055
    },
    "groundPattern": "tension",
    "patternScale": 248,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.17,
    "textureContrast": 1.13,
    "quietCoverage": 0.63,
    "materialOrganization": "short-fibre"
  },
  {
    "version": 1,
    "worldId": "shell-patchwork",
    "ground": {
      "dark": 2701127,
      "mid": 6454935,
      "light": 10729674
    },
    "solid": {
      "dark": 5789275,
      "mid": 11184045,
      "light": 14538968
    },
    "cleaved": {
      "dark": 6575711,
      "mid": 11705e3,
      "light": 14535121
    },
    "secondary": {
      "dark": 4334893,
      "mid": 9584460,
      "light": 13074062
    },
    "groundPattern": "plates",
    "patternScale": 240,
    "patternStrength": 0.35,
    "secondaryCoverage": 0.15,
    "textureContrast": 1.14,
    "quietCoverage": 0.62
  },
  {
    "version": 1,
    "worldId": "last-shelf",
    "ground": {
      "dark": 3813931,
      "mid": 8547411,
      "light": 12034952
    },
    "solid": {
      "dark": 6115649,
      "mid": 10982001,
      "light": 13811873
    },
    "cleaved": {
      "dark": 7430766,
      "mid": 12429238,
      "light": 15062239
    },
    "secondary": {
      "dark": 1976637,
      "mid": 4347253,
      "light": 9018293
    },
    "groundPattern": "grains",
    "patternScale": 256,
    "patternStrength": 0.32,
    "secondaryCoverage": 0.14,
    "textureContrast": 1.14,
    "quietCoverage": 0.65
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

// src/systems/r100-world/organization-sampling.ts
function prepareOrganizationSurfaceWindows(meshes, primaryFamily, painting) {
  const result = /* @__PURE__ */ new Map();
  for (const mesh of meshes) {
    if (mesh.spec.family !== primaryFamily) continue;
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (let i = 0; i < mesh.uv.length; i += 2) {
      minU = Math.min(minU, mesh.uv[i]);
      maxU = Math.max(maxU, mesh.uv[i]);
      minV = Math.min(minV, mesh.uv[i + 1]);
      maxV = Math.max(maxV, mesh.uv[i + 1]);
    }
    if (![minU, minV, maxU, maxV].every(Number.isFinite)) throw new Error("Organization sampling requires finite material coordinates");
    const windows = (surface) => {
      const create = (region) => {
        const patch = surface.regions?.[region];
        if (!patch) throw new Error(`Organization material lacks its ${region} source region`);
        const left = Math.round(patch.x * surface.width), top = Math.round(patch.y * surface.height);
        const width = Math.min(surface.width - left, Math.max(1, Math.round(patch.width * surface.width)));
        const height = Math.min(surface.height - top, Math.max(1, Math.round(patch.height * surface.height)));
        if (width < 3 || height < 3) throw new Error("Organization source region is too small for a continuous window");
        const spanU = maxU - minU, spanV = maxV - minV;
        const scale = Math.min(
          surface.width / surface.worldSize,
          spanU > 0 ? (width - 2) / spanU : Infinity,
          spanV > 0 ? (height - 2) / spanV : Infinity
        );
        const seed = mesh.spec.seed >>> 0;
        return {
          left,
          top,
          width,
          height,
          sourceWidth: surface.width,
          minU,
          minV,
          scale,
          offsetU: 1 + (width - 2 - spanU * scale) * (seed % 83 / 82),
          offsetV: 1 + (height - 2 - spanV * scale) * ((seed >>> 8) % 97 / 96)
        };
      };
      return { skin: create("skin"), cleaved: create("cleaved"), loose: create("loose") };
    };
    result.set(mesh.spec.id, { ground: windows(painting), ...painting.solid ? { solid: windows(painting.solid) } : {} });
  }
  return result;
}
function organizationSampleIndex(window, u, v) {
  const x = Math.max(0, Math.min(window.width - 1, Math.floor(window.offsetU + (u - window.minU) * window.scale)));
  const y = Math.max(0, Math.min(window.height - 1, Math.floor(window.offsetV + (v - window.minV) * window.scale)));
  return ((window.top + y) * window.sourceWidth + window.left + x) * 4;
}
export {
  NativeBodyCollision,
  NativeVolumeLighting,
  ORGANIZATION_MATERIALS,
  R100_WORLD_APPEARANCES,
  buildCompressedFelt,
  buildCompressedWedge,
  compileNativeVolumeRaster,
  mapWorldPigment,
  organizationSampleIndex,
  paintedToneRange,
  prepareOrganizationSurfaceWindows,
  smoothOrganizedSurface
};
