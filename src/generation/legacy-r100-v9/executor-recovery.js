// IMMUTABLE revision9 recovery closure. Source: 17476a4eee039f86ca1538398acf6b6d949c6bf9.
// Exact 108-ID membership projection; reproduce tools/recovery/project-native-r100-revision9.mjs. Prior archives remain retained.

// revision9-projected-recovery.js
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var SeededRandom = class {
  constructor(seed2) {
    __publicField(this, "state");
    this.state = seed2;
  }
  /**
   * Get next random float in [0, 1).
   */
  next() {
    this.state |= 0;
    this.state = this.state + 1831565813 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /**
   * Standard normal N(0, 1) via Box-Muller. Consumes two next() samples.
   */
  nextGaussian() {
    const u1 = Math.max(1e-12, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
  }
  /**
   * Get random integer in [min, max] (inclusive).
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  /**
   * Get random float in [min, max).
   */
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }
  /**
   * Pick a random element from an array.
   */
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
  /**
   * Shuffle an array in place (Fisher-Yates).
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
};
function mix32(seed2, label) {
  let h = seed2 >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 2654435769);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2146121005);
  h ^= h >>> 15;
  return h >>> 0;
}
function createRayHit() {
  return { x: 0, y: 0, dist: 0, hit: false };
}
var CORNER_MARGIN = 1;
var losScratch = createRayHit();
function castRayDirection(grid, originX, originY, dirX, dirY, maxDist, out) {
  const tileSize = grid.tileSize;
  let col = Math.floor(originX / tileSize);
  let row = Math.floor(originY / tileSize);
  if (grid.isOpaque(col, row)) {
    out.x = originX;
    out.y = originY;
    out.dist = 0;
    out.hit = true;
    return out;
  }
  const stepCol = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepRow = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const invX = stepCol !== 0 ? 1 / Math.abs(dirX) : Infinity;
  const invY = stepRow !== 0 ? 1 / Math.abs(dirY) : Infinity;
  const deltaX = tileSize * invX;
  const deltaY = tileSize * invY;
  let nextX = stepCol > 0 ? ((col + 1) * tileSize - originX) * invX : stepCol < 0 ? (originX - col * tileSize) * invX : Infinity;
  let nextY = stepRow > 0 ? ((row + 1) * tileSize - originY) * invY : stepRow < 0 ? (originY - row * tileSize) * invY : Infinity;
  const maxSteps = grid.cols + grid.rows + 2;
  for (let step = 0; step < maxSteps; step++) {
    const throughVertex = stepCol !== 0 && stepRow !== 0 && Math.abs(nextX - nextY) <= CORNER_MARGIN;
    if (throughVertex) {
      const dist2 = nextX < nextY ? nextX : nextY;
      if (dist2 > maxDist) break;
      if (grid.isOpaque(col + stepCol, row) && grid.isOpaque(col, row + stepRow)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      col += stepCol;
      row += stepRow;
      nextX += deltaX;
      nextY += deltaY;
      if (grid.isOpaque(col, row)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      continue;
    }
    let dist;
    if (nextX < nextY) {
      dist = nextX;
      if (dist > maxDist) break;
      col += stepCol;
      nextX += deltaX;
    } else {
      dist = nextY;
      if (dist > maxDist) break;
      row += stepRow;
      nextY += deltaY;
    }
    if (grid.isOpaque(col, row)) {
      return writeHit(out, originX, originY, dirX, dirY, dist, true);
    }
  }
  return writeHit(out, originX, originY, dirX, dirY, maxDist, false);
}
function hasLineOfSight(grid, from, to, maxDist) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length2 = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (length2 < 1e-6) {
    return !grid.isOpaque(Math.floor(from.x / grid.tileSize), Math.floor(from.y / grid.tileSize));
  }
  if (maxDist !== void 0 && length2 > maxDist) return false;
  castRayDirection(grid, from.x, from.y, deltaX / length2, deltaY / length2, length2, losScratch);
  return !losScratch.hit || losScratch.dist >= length2 - 1e-3;
}
function writeHit(out, originX, originY, dirX, dirY, dist, hit) {
  out.x = originX + dirX * dist;
  out.y = originY + dirY * dist;
  out.dist = dist;
  out.hit = hit;
  return out;
}
var TAU = Math.PI * 2;
var uv = (point) => [point[0], point[1]];
var lerp = (a, b, t) => a + (b - a) * t;
function variation(seed2, salt) {
  let value = Math.imul(seed2 ^ salt, 73244475);
  value = Math.imul(value ^ value >>> 16, 73244475);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}
function buildCellularShell(builder) {
  const spec = builder.spec, count = Math.min(4, Math.max(2, spec.branches));
  for (let cell = 0; cell < count; cell++) {
    const scale = cell % 3 === 0 ? 1.25 : cell % 3 === 1 ? 0.91 : 0.9;
    const rx = spec.length / count * 0.45 * scale;
    const ry = spec.width * (cell % 3 === 0 ? 0.38 : cell % 3 === 1 ? 0.23 : 0.29);
    const ox = ((cell + 0.5) / count - 0.5) * spec.length;
    const oy = (cell % 2 ? -0.15 : 0.1) * spec.width;
    const opening = (cell % 2 ? -0.5 : 0.5) * Math.PI + (variation(spec.seed, 2700 + cell) - 0.5) * 0.27;
    const gap = 1.2 + spec.opening * 1.38 + (cell % 3 === 1 ? 0.9 : cell % 3 === 0 ? -0.26 : -0.43);
    const mouthBias = cell % 3 === 0 ? 0.32 : cell % 3 === 1 ? 0.62 : 0.38;
    const start = opening + gap * mouthBias, end = opening + TAU - gap * (1 - mouthBias);
    const steps = 48, rows = [];
    const phase2 = variation(spec.seed, 2730 + cell) * 0.6 + cell * 1.9;
    for (let index = 0; index <= steps; index++) {
      const t = index / steps, angle = lerp(start, end, t);
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const shoulder = Math.pow(0.5 + 0.5 * Math.cos(angle - phase2), 3);
      const outerRadius = 0.94 + shoulder * (0.31 + spec.distortion * 0.13) + Math.sin(angle * 2 + phase2) * 0.085 + Math.sin(angle * 3 - phase2) * 0.045;
      const outerX = ox + rx * ca * outerRadius;
      const outerY = oy + ry * sa * outerRadius;
      const hollowRadius = 0.62 + 0.08 * Math.sin(angle + phase2 + 0.65) + 0.06 * Math.sin(angle * 2 - phase2) + 0.025 * Math.sin(angle * 3 - phase2);
      const innerX = ox + rx * 0.045 * Math.cos(phase2) + rx * ca * hollowRadius;
      const innerY = oy - ry * 0.055 * Math.sin(phase2) + ry * sa * (hollowRadius + 0.08);
      const seam = Math.pow(Math.abs(Math.sin(t * Math.PI)), 0.48);
      const tornLip = 0.29 + 0.71 * Math.min(1, t / (cell % 3 === 1 ? 0.43 : 0.29));
      const height = spec.height * (cell % 3 === 1 ? 0.48 : cell % 3 === 2 ? 0.79 : 1) * (0.39 + shoulder * 0.36 + seam * 0.22 + 0.1 * Math.sin(angle + phase2)) * tornLip;
      const foot = spec.blocking === 1 ? Math.min(8, height * 0.35) : 0;
      const point = (across, z) => [lerp(outerX, innerX, across), lerp(outerY, innerY, across), z];
      rows.push([
        point(0, 0),
        point(0.035, foot),
        point(0.16, height * 0.63),
        point(0.42 + shoulder * 0.08, height),
        point(0.79, height * (0.81 + shoulder * 0.08)),
        point(0.96, Math.max(foot, height * 0.22)),
        point(1, 0)
      ]);
    }
    for (let index = 0; index < steps; index++) {
      for (let across = 0; across < rows[index].length - 1; across++) {
        const a = rows[index][across], b = rows[index + 1][across];
        const c = rows[index + 1][across + 1], d = rows[index][across + 1];
        builder.quad(a, b, c, d, across < 4 ? 0 : 2, [uv(a), uv(b), uv(c), uv(d)], [0, 0, 1], across < 2 ? 1 : across < 4 ? 0 : 5);
        if (cell === 0 && index === Math.floor(steps * 0.47) && across === 3) {
          const onFace = (u, v) => [
            a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v,
            a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v,
            a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v + 0.08
          ];
          const p = onFace(0.08, 0.12), q = onFace(0.57, 0.12), r = onFace(0.4, 0.4), s = onFace(0.08, 0.4);
          builder.quad(p, q, r, s, 3, [uv(p), uv(q), uv(r), uv(s)], [0, 0, 1], 3);
          builder.joint(onFace(0.28, 0.27));
        }
      }
    }
    for (const at2 of [0, steps]) {
      const row = rows[at2], angle = at2 === 0 ? start : end, sign = at2 === 0 ? -1 : 1;
      for (let across = 0; across < row.length - 1; across++) {
        const a = row[across], b = row[across + 1];
        const run = Math.min(6, spec.thickness * 0.42) * (at2 === 0 ? 0.72 : 1.12);
        const dx = -Math.sin(angle) * run * sign, dy = Math.cos(angle) * run * sign;
        const c = [b[0] + dx, b[1] + dy, 0], d = [a[0] + dx, a[1] + dy, 0];
        builder.quad(a, b, c, d, 1, [uv(a), uv(b), uv(c), uv(d)], [0, 0, 1], 3);
      }
    }
  }
}
var uv2 = (p) => [p[0], p[1]];
var EPSILON = 1e-7;
function createPleatedTear(builder, centre, tangent) {
  const magnitude = Math.hypot(...tangent);
  if (magnitude < EPSILON) throw new Error("Pleated tear needs a real surface direction");
  const direction2 = [tangent[0] / magnitude, tangent[1] / magnitude];
  const normal = [-direction2[1], direction2[0]];
  const length2 = Math.min(12, builder.spec.length * 0.15, builder.spec.width * 0.15);
  const halfWidth = Math.min(1.3, length2 * 0.11), depth = Math.min(1.4, builder.spec.height * 0.06);
  const local = (p, axis) => {
    const basis = axis === 0 ? direction2 : normal;
    return (p[0] - centre[0]) * basis[0] + (p[1] - centre[1]) * basis[1];
  };
  const planes = [
    { axis: 0, limit: -length2 / 2, greater: true },
    { axis: 0, limit: length2 / 2, greater: false },
    { axis: 1, limit: -halfWidth, greater: true },
    { axis: 1, limit: halfWidth, greater: false }
  ];
  const clip = (polygon, plane) => {
    const output = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const av = local(a, plane.axis), bv = local(b, plane.axis);
      const ai = plane.greater ? av >= plane.limit : av <= plane.limit;
      const bi = plane.greater ? bv >= plane.limit : bv <= plane.limit;
      if (ai) output.push(a);
      if (ai !== bi) {
        const t = (plane.limit - av) / (bv - av);
        output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return output;
  };
  const draw = (polygon, material, region) => {
    for (let i = 1; i + 1 < polygon.length; i++) {
      const a = polygon[0], b = polygon[i], c = polygon[i + 1];
      builder.quad(a, b, c, c, material, [uv2(a), uv2(b), uv2(c), uv2(c)], [0, 0, 1], region);
    }
  };
  const bottom = (p, lift = 0) => {
    const along = local(p, 0) * 0.94, across = local(p, 1) * 0.72;
    return [
      centre[0] + direction2[0] * along + normal[0] * across,
      centre[1] + direction2[1] * along + normal[1] * across,
      p[2] - depth + lift
    ];
  };
  const glowPlanes = [
    { axis: 0, limit: -length2 * 0.35, greater: true },
    { axis: 0, limit: length2 * 0.35, greater: false },
    { axis: 1, limit: -halfWidth * 0.55, greater: true },
    { axis: 1, limit: halfWidth * 0.75, greater: false }
  ];
  let jointWritten = false;
  return {
    triangle(a, b, c) {
      let inside2 = [a, b, c];
      for (const plane of planes) {
        draw(clip(inside2, { ...plane, greater: !plane.greater }), 0, 4);
        inside2 = clip(inside2, plane);
        if (inside2.length < 3) return;
      }
      const floor = inside2.map((p) => bottom(p));
      draw(floor, 2, 3);
      for (let i = 0; i < inside2.length; i++) {
        const next = (i + 1) % inside2.length, p = inside2[i], q = inside2[next];
        if (!planes.some((plane) => Math.abs(local(p, plane.axis) - plane.limit) < EPSILON && Math.abs(local(q, plane.axis) - plane.limit) < EPSILON)) continue;
        builder.quad(p, q, floor[next], floor[i], 2, [uv2(p), uv2(q), uv2(floor[next]), uv2(floor[i])], [0, 0, 1], 3);
      }
      if (builder.spec.blocking !== 1) return;
      let glow = inside2;
      for (const plane of glowPlanes) glow = clip(glow, plane);
      if (glow.length < 3) return;
      const lit = glow.map((p) => bottom(p, 0.04));
      draw(lit, 3, 3);
      if (!jointWritten) {
        builder.joint([
          lit.reduce((sum, p) => sum + p[0], 0) / lit.length,
          lit.reduce((sum, p) => sum + p[1], 0) / lit.length,
          lit.reduce((sum, p) => sum + p[2], 0) / lit.length
        ]);
        jointWritten = true;
      }
    }
  };
}
var NATIVE_VOLUME_SHAPE_PROFILES = ["rib-vault", "pleated-sheet", "cellular-shell", "lobed-cushion", "monolith-buttress", "terrace-shelf", "pleated-tear"];
var uv3 = (p) => [p[0], p[1]];
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function noise(seed2, salt) {
  let value = Math.imul(seed2 ^ salt, 73244475);
  value = Math.imul(value ^ value >>> 16, 73244475);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}
function fracture(b, a, c, d, size) {
  const sample = (u, v) => [
    a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v,
    a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + 0.08
  ];
  const length2 = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const perpendicular = Math.abs((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0])) / Math.max(1e-3, length2);
  const du = size ? Math.min(0.44, size[0] / Math.max(1e-3, length2)) : 0.44;
  const dv = size ? Math.min(0.22, size[1] / Math.max(1e-3, perpendicular)) : 0.22;
  const p = sample(0.16, 0.12), q = sample(size ? 0.16 + du : 0.6, 0.12), r = sample(size ? 0.16 + du * 0.82 : 0.52, size ? 0.12 + dv : 0.34), s = sample(0.16, size ? 0.12 + dv : 0.34);
  b.quad(p, q, r, s, 3, [uv3(p), uv3(q), uv3(r), uv3(s)], [0, 0, 1], 3);
  b.joint(sample(size ? 0.16 + du * 0.43 : 0.35, size ? 0.12 + dv * 0.5 : 0.23));
}
function ribbon(b, centres, radii, form, marked = false, sideScales) {
  const rows = [];
  const section2 = form === "ridge" ? [[-1, 0], [-0.91, 0.14], [-0.63, 0.62], [-0.12, 1], [0.28, 0.9], [0.75, 0.41], [0.94, 0.14], [1, 0]] : [[-1, 0], [-0.95, 0.2], [-0.76, 0.77], [-0.37, 0.98], [0.29, 1], [0.74, 0.84], [0.94, 0.2], [1, 0]];
  for (let i = 0; i < centres.length; i++) {
    const p = centres[i], before = centres[Math.max(0, i - 1)], after = centres[Math.min(centres.length - 1, i + 1)];
    const dx = after[0] - before[0], dy = after[1] - before[1], length2 = Math.hypot(dx, dy) || 1;
    const radius = radii[i], foot = b.spec.blocking === 1 ? Math.min(8, p[2] * 0.32) : 0;
    rows.push(section2.map(([across, rise], at2) => {
      const breadth = radius * across * (sideScales?.[i]?.[across < 0 ? 0 : 1] ?? 1);
      return [
        p[0] - dy / length2 * breadth,
        p[1] + dx / length2 * breadth,
        at2 === 0 || at2 === section2.length - 1 ? 0 : Math.max(foot, p[2] * rise)
      ];
    }));
  }
  let distance2 = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], c = rows[i + 1], nextDistance = distance2 + Math.hypot(centres[i + 1][0] - centres[i][0], centres[i + 1][1] - centres[i][1]);
    for (let j = 0; j < a.length - 1; j++) {
      const cut = j === 0 || j === a.length - 2, slot = cut ? 1 : j >= 4 ? 2 : 0;
      b.quad(
        a[j],
        c[j],
        c[j + 1],
        a[j + 1],
        slot,
        [[distance2, j * radii[i] / 3], [nextDistance, j * radii[i + 1] / 3], [nextDistance, (j + 1) * radii[i + 1] / 3], [distance2, (j + 1) * radii[i] / 3]],
        [0, 0, 1],
        cut ? 3 : form === "pad" ? 5 : 4
      );
      if (marked && i === Math.floor((rows.length - 1) * 0.53) && j === 3) fracture(b, a[j], c[j], c[j + 1]);
    }
    distance2 = nextDistance;
  }
  for (const index of [0, rows.length - 1]) {
    const row = rows[index], centre = centres[index], neighbour = centres[index === 0 ? 1 : index - 1];
    const dx = centre[0] - neighbour[0], dy = centre[1] - neighbour[1], length2 = Math.hypot(dx, dy) || 1;
    const run = Math.min(7, b.spec.thickness * 0.6);
    for (let j = 0; j < row.length - 1; j++) {
      const a = row[j], c = row[j + 1], af = [a[0] + dx / length2 * run, a[1] + dy / length2 * run, 0], cf = [c[0] + dx / length2 * run, c[1] + dy / length2 * run, 0];
      b.quad(a, af, cf, c, 1, [uv3(a), uv3(af), uv3(cf), uv3(c)], [0, 0, 1], 3);
    }
  }
}
function ribVault(b) {
  const s = b.spec, count = s.branches, spine = [], radii = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, arch = Math.sin(Math.PI * t);
    spine.push([(t - 0.5) * s.length, -s.width * (0.33 + 0.035 * Math.sin(t * 5)), s.height * (0.53 + arch * 0.47)]);
    radii.push(s.width * (0.058 + 0.018 * arch));
  }
  ribbon(b, spine, radii, "ridge", true);
  for (let rib = 0; rib < count; rib++) {
    const at2 = (rib + 0.52) / count, length2 = s.width * (0.46 + noise(s.seed, 1900 + rib) * 0.28), centres = [], widths = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, bend = Math.sin(t * Math.PI * 0.86);
      centres.push([
        (at2 - 0.5) * s.length + bend * s.length * (0.036 + s.fold * 0.035),
        -s.width * 0.33 + t * length2,
        s.height * (0.6 - t * 0.36 + bend * 0.12) * (1 - rib % 3 * 0.055)
      ]);
      widths.push(Math.min(s.length / count * 0.18, s.width * 0.057) * (1 - t * 0.38));
    }
    ribbon(b, centres, widths, "ridge");
  }
}
function pleatedSheet(b, openedTear = false) {
  const s = b.spec, gap = Math.min(s.length * 0.38, Math.max(48, s.width * (0.28 + s.opening * 0.14) + 20));
  const centreGap = (0.04 + (noise(s.seed, 1981) - 0.5) * 0.1) * s.length;
  const folds = [
    [-0.35, 0.08],
    [0, 0.68],
    [0.16, 0.13],
    [0.43, 0.94],
    [0.56, 0.17],
    [0.9, 0.58],
    [1.14, 0.06],
    [1.31, 0.85],
    [1.6, 0.14],
    [1.87, 0.7],
    [2.2, 0.12]
  ];
  const creaseAt = (at2) => {
    for (let i = 1; i < folds.length; i++) if (at2 <= folds[i][0]) {
      const a = folds[i - 1], c = folds[i], t = clamp((at2 - a[0]) / (c[0] - a[0]), 0, 1);
      return a[1] + (c[1] - a[1]) * t;
    }
    return folds[folds.length - 1][1];
  };
  const tear = (at2, centre, radius) => Math.max(0, 1 - Math.abs(at2 - centre) / radius);
  const pieces = [[-s.length * 0.5, centreGap - gap * 0.5], [centreGap + gap * 0.5, s.length * 0.5]];
  for (const [piece, [start, end]] of pieces.entries()) {
    const along = 36, across = 16, rows = [];
    for (let i = 0; i <= along; i++) {
      const t = i / along, baseX = start + (end - start) * t, u = baseX / s.length + 0.5, row = [];
      const north = s.width * (-0.43 + 0.045 * Math.sin(u * 5.1) + 0.13 * tear(t, piece ? 0.28 : 0.7, 0.16));
      const south = s.width * (0.38 + 0.065 * Math.sin(u * 4.6 + 0.8) - 0.17 * tear(t, piece ? 0.78 : 0.23, 0.13));
      for (let j = 0; j <= across; j++) {
        const v = j / across;
        const x = baseX + s.length * (0.012 + 0.06 * tear(v, piece ? 0.7 : 0.24, 0.2)) * (1 - t) ** 5 - s.length * (0.018 + 0.075 * tear(v, piece ? 0.34 : 0.76, 0.18)) * t ** 5;
        const phase2 = u * (0.6 + s.branches * 0.16) + (v - 0.5) * (0.2 + s.fold * 0.1);
        const crease = creaseAt(phase2), amplitude = 0.79 + 0.12 * Math.sin(u * 4.7 + 0.9) + v * 0.09;
        const foot = s.blocking === 1 ? Math.min(8, s.height * 0.22) : 0;
        row.push([
          x,
          north + (south - north) * v,
          foot + s.height * (0.065 + crease * amplitude) * (0.79 + 0.21 * Math.sin(Math.PI * v))
        ]);
      }
      rows.push(row);
    }
    let ridge = 4;
    if (openedTear && piece === 1) {
      for (let i = 5; i < along - 4; i++)
        if (rows[i][6][2] > rows[ridge][6][2]) ridge = i;
    }
    const openedSurface = openedTear && piece === 1 ? createPleatedTear(
      b,
      rows[ridge][6],
      [rows[ridge][7][0] - rows[ridge][5][0], rows[ridge][7][1] - rows[ridge][5][1]]
    ) : void 0;
    for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
      const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
      if (openedSurface) {
        openedSurface.triangle(a, c, d);
        openedSurface.triangle(a, d, e);
      } else b.quad(a, c, d, e, 0, [uv3(a), uv3(c), uv3(d), uv3(e)], [0, 0, 1], 4);
      if (!openedTear && start < 0 && i === 15 && j === 7) fracture(b, a, c, d);
    }
    const outline = [
      ...rows.map((row) => row[0]),
      ...rows[along].slice(1),
      ...rows.slice(0, along).reverse().map((row) => row[across]),
      ...rows[0].slice(1, across).reverse()
    ];
    const feet = outline.map((p, i) => {
      const prev = outline[(i + outline.length - 1) % outline.length], next = outline[(i + 1) % outline.length];
      const dx = next[0] - prev[0], dy = next[1] - prev[1], length2 = Math.hypot(dx, dy) || 1, width = s.blocking === 1 ? Math.min(6, s.thickness * 0.55) : 1.5;
      return [p[0] + dy / length2 * width, p[1] - dx / length2 * width, 0];
    });
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length, a = outline[i], c = outline[next];
      const exposedInnerTear = piece === 0 && i > along + 3 && i < along + across - 3;
      b.quad(a, feet[i], feet[next], c, exposedInnerTear ? 2 : 1, [uv3(a), uv3(feet[i]), uv3(feet[next]), uv3(c)], [0, 0, 1], 3);
    }
  }
}
function lobedCushion(b) {
  const s = b.spec, count = clamp(s.branches - 1, 2, 3);
  for (let lobe = 0; lobe < count; lobe++) {
    const side = (lobe + 0.5) / count - 0.5, extent = (lobe === 0 ? 0.94 : 0.7) + noise(s.seed, 2100 + lobe) * 0.05;
    const points = [], radii = [], sideScales = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36, shoulder = Math.pow(Math.sin(Math.PI * t), 0.5), taper = 0.04 + 0.96 * shoulder;
      const widthPeak = Math.exp(-Math.pow((t - (0.32 + lobe * 0.18)) / 0.22, 2));
      const curl = Math.exp(-Math.pow((t - (lobe === 0 ? 0.81 : 0.67)) / (0.1 + s.fold * 0.04), 2));
      points.push([
        (t - 0.5) * s.length * extent + lobe * s.length * 0.105,
        side * s.width + (t - 0.5) * s.width * (0.12 + s.distortion * 0.14),
        s.height * (0.1 + shoulder * 0.15 + curl * (lobe === 0 ? 0.5 + s.fold * 0.25 : 0.19))
      ]);
      radii.push(s.width / count * 0.33 * taper * (1 - s.opening * 0.14));
      const outer = 1.15 + widthPeak * (lobe === 0 ? 0.8 : 0.4);
      const notch = 1 - 0.17 * Math.exp(-Math.pow((t - 0.61) / 0.095, 2));
      sideScales.push(lobe === 0 ? [outer * notch, 0.9] : lobe === count - 1 ? [0.9, outer] : [0.86, 0.88]);
    }
    ribbon(b, points, radii, "pad", lobe === 0, sideScales);
  }
}
function planarMass(b, outline, topHeight, baseZ = 0, marked = false) {
  const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length, cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
  const foot = outline.map(([x, y]) => [x, y, baseZ]);
  const low = outline.map(([x, y]) => [
    cx + (x - cx) * 0.965,
    cy + (y - cy) * 0.965,
    baseZ + Math.min(b.spec.blocking === 1 ? 9 : 1, (topHeight(x, y) - baseZ) * 0.32)
  ]);
  const crown = outline.map(([x, y]) => {
    const px = cx + (x - cx) * 0.85, py = cy + (y - cy) * 0.85;
    return [px, py, topHeight(px, py)];
  });
  const centre = [cx, cy, topHeight(cx, cy)];
  let distance2 = 0;
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length, a = foot[i], c = foot[next], edge = Math.hypot(c[0] - a[0], c[1] - a[1]);
    b.quad(a, c, low[next], low[i], 1, [[distance2, baseZ], [distance2 + edge, baseZ], [distance2 + edge, low[next][2]], [distance2, low[i][2]]], [0, 0, 1], 3);
    b.quad(
      low[i],
      low[next],
      crown[next],
      crown[i],
      i % 3 === 0 ? 2 : 1,
      [[distance2, low[i][2]], [distance2 + edge, low[next][2]], [distance2 + edge, crown[next][2]], [distance2, crown[i][2]]],
      [0, 0, 1],
      1
    );
    b.quad(centre, crown[i], crown[next], centre, 0, [uv3(centre), uv3(crown[i]), uv3(crown[next]), uv3(centre)], [0, 0, 1], 0);
    if (marked && i === 1) fracture(b, centre, crown[i], crown[next], [18, 1.4]);
    distance2 += edge;
  }
}
function monolithButtress(b) {
  const s = b.spec, l = s.length, w = s.width, gap = Math.max(30, l * (0.12 + s.opening * 0.14));
  const offset = (noise(s.seed, 2201) - 0.5) * l * 0.08;
  const sideMouth = Math.min(w * 0.2, Math.max(32, w * (0.08 + s.opening * 0.08)) - w * 0.025);
  planarMass(
    b,
    [[-l * 0.46, -w * 0.42], [l * 0.34, -w * 0.49], [l * 0.46, -w * 0.27], [l * 0.38, -w * 0.025], [-l * 0.4, -w * 0.025]],
    (x, y) => s.height * (0.8 + x / l * s.fold * 0.2 - y / w * 0.24),
    0,
    true
  );
  planarMass(b, [
    [-l * 0.4, -w * 0.12],
    [-gap * 0.5 + offset, -w * 0.12],
    [-gap * 0.5 + offset, w * 0.31],
    [-l * 0.25, w * 0.48],
    [-l * 0.46, w * 0.34]
  ], (x, y) => s.height * (0.65 - y / w * 0.4 - x / l * 0.14));
  planarMass(b, [
    [gap * 0.5 + offset, sideMouth],
    [l * 0.39, sideMouth],
    [l * 0.46, w * 0.26],
    [l * 0.31, w * 0.43],
    [gap * 0.5 + offset, w * 0.29]
  ], (_x, y) => s.height * (0.67 - y / w * (0.2 + s.fold * 0.22)));
}
function terraceShelf(b) {
  const s = b.spec, tiers = clamp(s.branches, 2, 4), l = s.length, w = s.width;
  const scaled = (outline) => outline.map(([x, y]) => [x * l, y * w]);
  const lowerHeight = (x, y) => s.height * (0.4 + x / l * 0.17 + y / w * (0.06 + s.fold * 0.04));
  planarMass(b, scaled([[-0.49, -0.32], [-0.34, -0.5], [0.41, -0.43], [0.49, -0.18], [0.39, 0.035], [-0.38, 0.035]]), lowerHeight);
  planarMass(b, scaled([[-0.43, -0.09], [0.085, -0.09], [0.045, 0.22], [-0.1, 0.44], [-0.48, 0.32]]), lowerHeight);
  planarMass(b, scaled([[0.245, -0.09], [0.41, -0.1], [0.5, 0.13], [0.35, 0.39], [0.285, 0.25]]), lowerHeight);
  const upper = [[-0.37, -0.26], [-0.27, -0.43], [-0.02, -0.39], [0.18, -0.17], [0.04, -0.055], [-0.28, -0.09]];
  for (let tier = 1; tier < tiers; tier++) {
    const along = 0.56 ** (tier - 1), across = 0.68 ** (tier - 1);
    const outline = scaled(upper.map(([x, y]) => [-0.12 + (x + 0.12) * along, -0.23 + (y + 0.23) * across]));
    const height = (x, y) => s.height * (0.42 + 0.53 * tier / (tiers - 1) + (x / l + 0.15) * 0.1 - (y / w + 0.25) * (0.08 + s.fold * 0.05));
    planarMass(b, outline, height, 0, tier === tiers - 1);
  }
}
function buildExpandedNativeVolume(builder) {
  switch (builder.spec.shapeProfile) {
    case "rib-vault":
      ribVault(builder);
      return;
    case "pleated-sheet":
      pleatedSheet(builder);
      return;
    case "pleated-tear":
      pleatedSheet(builder, true);
      return;
    case "cellular-shell":
      buildCellularShell(builder);
      return;
    case "lobed-cushion":
      lobedCushion(builder);
      return;
    case "monolith-buttress":
      monolithButtress(builder);
      return;
    case "terrace-shelf":
      terraceShelf(builder);
      return;
    default:
      throw new Error("Unknown expanded native shape profile");
  }
}
var uv4 = (p) => [p[0], p[1]];
var mix = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
function curved(points, at2) {
  const i = Math.min(points.length - 2, Math.floor(at2)), t = at2 - i;
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
  b.quad(p, q, r, t, 3, [uv4(p), uv4(q), uv4(r), uv4(t)], [0, 0, 1], 3);
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
    b.quad(a, c, d, e, cut ? 1 : 0, [uv4(a), uv4(c), uv4(d), uv4(e)], [0, 0, 1], cut ? 3 : 1);
    if (i === 3 && j === 4) pressureFracture(b, a, c, d);
  }
  for (const side of [0, across.length - 1]) for (let i = 0; i < (rows.length - 1) * 2; i++) {
    const a = sample(i / 2, side), c = sample((i + 1) / 2, side), af = curved(feet.map((row) => row[side]), i / 2), cf = curved(feet.map((row) => row[side]), (i + 1) / 2);
    b.quad(af, cf, c, a, 0, [uv4(af), uv4(cf), uv4(c), uv4(a)], [0, side ? 1 : -1, 0], 1);
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
function buildPorousBreak(b) {
  const s = b.spec;
  const along = [-0.49, -0.34, -0.19, -0.025, 0.19, 0.35, 0.48];
  const widths = [0.43, 0.82, 1, 0.91, 0.94, 0.66, 0.29];
  const heights = [0.43, 0.76, 1, 0.93, 0.74, 0.62, 0.27];
  const split = [0.77, 0.55, 0.19, 0.13, 0.28, 0.52, 0.81];
  const rows = along.map((x, i) => {
    const radius = s.width * 0.48 * widths[i], centre = s.width * (0.045 * Math.sin(i * 0.7) - 0.035);
    const z = s.height * heights[i], t = split[i];
    const foot = [x * s.length, centre - radius, 0];
    const shoulder = [x * s.length + s.length * 0.012, centre - radius * 0.77, z * 0.59];
    const crown = [x * s.length, centre - radius * 0.17, z];
    const lip = [x * s.length + s.length * 0.022 * Math.sin(i * 1.3), centre + radius * t, z * (1 - 0.25 * t - 0.65 * t * t)];
    const toe = [x * s.length + Math.min(5, s.length * 0.02), centre + radius, 0];
    return { foot, shoulder, crown, lip, toe };
  });
  const sizes = [5, 12, 7, 14, 6, 4], offsets = [0.56, 0.35, 0.65, 0.47, 0.37, 0.48], depths = [0.44, 0.61, 0.38, 0.5, 0.63, 0.43];
  const rowAt = (u) => ["foot", "shoulder", "crown", "lip", "toe"].map((key) => curved(rows.map((row) => row[key]), u));
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], c = rows[i + 1];
    for (let along2 = 0; along2 < 2; along2++) for (let across = 0; across < 6; across++) {
      const start = rowAt(i + along2 / 2), end = rowAt(i + (along2 + 1) / 2);
      const p = curved(start, across / 2), q = curved(end, across / 2), r = curved(end, (across + 1) / 2), t = curved(start, (across + 1) / 2);
      b.quad(p, q, r, t, 0, [uv4(p), uv4(q), uv4(r), uv4(t)], [0, 0, 1], 0);
      if (i === 2 && along2 === 1 && across === 4) pressureFracture(b, p, q, r);
    }
    const sample = (u, v) => {
      const row = rowAt(i + u);
      return mix(row[3], row[4], v);
    };
    const centreU = offsets[i], centreV = depths[i], centre = sample(centreU, centreV);
    const width = c.lip[0] - a.lip[0], depth = (a.toe[1] - a.lip[1] + (c.toe[1] - c.lip[1])) / 2;
    const radius = Math.min(sizes[i] / 2, width * 0.23, depth * 0.23);
    const outer = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
    const ring = outer.map(([u, v]) => sample(u, v)), mouth = [], bottom = [];
    const recess = Math.min(5, centre[2] * 0.32, radius * 0.74);
    for (let j = 0; j < 8; j++) {
      const angle = -Math.PI * 0.75 + j * Math.PI / 4;
      const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius * (0.68 + i % 2 * 0.12);
      mouth.push(sample(centreU + dx / width, centreV + dy / depth));
      const p = sample(centreU + dx * 0.63 / width, centreV + dy * 0.63 / depth);
      bottom.push([p[0], p[1], p[2] - recess]);
    }
    const centreBottom = [centre[0], centre[1], centre[2] - recess];
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8, p = mouth[j], q = mouth[k], af = bottom[j], cf = bottom[k];
      b.quad(ring[j], ring[k], q, p, 1, [uv4(ring[j]), uv4(ring[k]), uv4(q), uv4(p)], [0, 0, 1], 3);
      b.quad(p, q, cf, af, 2, [uv4(p), uv4(q), uv4(cf), uv4(af)], [0, 0, 1], 2);
      b.quad(
        af,
        cf,
        centreBottom,
        centreBottom,
        2,
        [uv4(af), uv4(cf), uv4(centreBottom), uv4(centreBottom)],
        [0, 0, 1],
        0
      );
    }
  }
  for (const i of [0, rows.length - 1]) {
    const row = rowAt(i), face = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4].map((at2) => curved(row, at2));
    for (let j = 1; j < face.length - 1; j++) {
      const a = face[0], c = face[j], d = face[j + 1];
      b.quad(a, c, d, d, 0, [uv4(a), uv4(c), uv4(d), uv4(d)], [i ? 1 : -1, 0, 0], 0);
    }
  }
}
function smoothOrganizedSurface(mesh) {
  const groups = /* @__PURE__ */ new Map();
  for (let face = 0; face < mesh.triangleCount; face++) {
    if (mesh.materials[face] !== 0) continue;
    for (let corner = 0; corner < 3; corner++) {
      const vertex = mesh.indices[face * 3 + corner], at2 = vertex * 3;
      const previous = mesh.indices[face * 3 + (corner + 1) % 3] * 3;
      const next = mesh.indices[face * 3 + (corner + 2) % 3] * 3;
      const ax = mesh.positions[previous] - mesh.positions[at2], ay = mesh.positions[previous + 1] - mesh.positions[at2 + 1], az = mesh.positions[previous + 2] - mesh.positions[at2 + 2];
      const bx = mesh.positions[next] - mesh.positions[at2], by = mesh.positions[next + 1] - mesh.positions[at2 + 1], bz = mesh.positions[next + 2] - mesh.positions[at2 + 2];
      const dot2 = (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz));
      const weight = Math.acos(Math.max(-1, Math.min(1, dot2)));
      const key = `${mesh.positions[at2]},${mesh.positions[at2 + 1]},${mesh.positions[at2 + 2]}:${mesh.regions[face]}`;
      const entries = groups.get(key) ?? [];
      entries.push({ vertex, weight });
      groups.set(key, entries);
    }
  }
  const normals = new Float32Array(mesh.normals), creaseCosine = Math.cos(55 * Math.PI / 180);
  for (const entries of groups.values()) for (const { vertex } of entries) {
    const at2 = vertex * 3, nx = mesh.normals[at2], ny = mesh.normals[at2 + 1], nz = mesh.normals[at2 + 2];
    let x = 0, y = 0, z = 0;
    for (const { vertex: other, weight } of entries) {
      const q = other * 3, ox = mesh.normals[q], oy = mesh.normals[q + 1], oz = mesh.normals[q + 2];
      if (nx * ox + ny * oy + nz * oz < creaseCosine) continue;
      x += ox * weight;
      y += oy * weight;
      z += oz * weight;
    }
    const length2 = Math.hypot(x, y, z);
    if (length2 > 0) {
      normals[at2] = x / length2;
      normals[at2 + 1] = y / length2;
      normals[at2 + 2] = z / length2;
    }
  }
  return { ...mesh, normals };
}
function buildSettledSheet(b) {
  const outline = [
    [-0.5, -0.23],
    [-0.29, -0.48],
    [0.13, -0.37],
    [0.4, -0.26],
    [0.51, -0.03],
    [0.34, 0.29],
    [0.23, 0.13],
    [0.04, -0.02],
    [0.13, 0.23],
    [-0.1, 0.49],
    [-0.37, 0.34],
    [-0.28, 0.13],
    [-0.46, 0.02]
  ];
  const parts2 = [[0, 1, 2, 7, 11, 12], [11, 7, 8, 9, 10], [2, 3, 4, 5, 6, 7]];
  buildSettledMaterial(b, outline, parts2, "sheet");
}
function buildSettledFan(b) {
  const outline = [
    [-0.5, -0.3],
    [-0.32, -0.49],
    [0.24, -0.4],
    [0.43, -0.18],
    [0.51, 0.17],
    [0.29, 0.39],
    [0.16, 0.21],
    [0.09, -0.04],
    [-0.02, 0.36],
    [-0.3, 0.5],
    [-0.46, 0.17],
    [-0.3, -0.1]
  ];
  const parts2 = [[0, 1, 2, 3, 7, 11], [11, 7, 8, 9, 10], [7, 3, 4, 5, 6]];
  buildSettledMaterial(b, outline, parts2, "fan");
}
function buildSettledMaterial(b, outline, parts2, profile) {
  const s = b.spec;
  if (s.blocking !== 0 || s.height > 6) throw new Error("Settled material requires shallow, nonblocking material");
  const boundary = outline.map(([x, y]) => [x * s.length, y * s.width]);
  const smooth3 = (n) => {
    const t = Math.max(0, Math.min(1, n));
    return t * t * (3 - 2 * t);
  };
  const height = ([x, y]) => {
    let distance2 = Infinity;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], c = boundary[(i + 1) % boundary.length];
      const dx = c[0] - a[0], dy = c[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      distance2 = Math.min(distance2, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t));
    }
    const retreat = 5 + 3 * Math.sin(x * 0.043 + y * 0.025) + 2 * Math.sin(y * 0.071 - x * 0.019);
    const buried = smooth3((distance2 - retreat) / 24);
    const fold = profile === "sheet" ? 0.45 + 0.55 * smooth3((y / s.width + 0.34 + 0.14 * x / s.length) / 0.7) : 0.78 + x / s.length * (0.08 + s.fold * 0.08) - y / s.width * 0.13 - 0.27 * smooth3((x / s.length - 0.09) / 0.25) * smooth3((y / s.width + 0.04) / 0.3);
    return s.height * buried * fold;
  };
  const clip = (polygon, axis, at2, greater) => {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], c = polygon[(i + 1) % polygon.length];
      const ai = greater ? a[axis] >= at2 : a[axis] <= at2;
      const ci = greater ? c[axis] >= at2 : c[axis] <= at2;
      if (ai) result.push(a);
      if (ai !== ci) {
        const t = (at2 - a[axis]) / (c[axis] - a[axis]);
        result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    return result;
  };
  const minX = Math.min(...boundary.map((p) => p[0])), maxX = Math.max(...boundary.map((p) => p[0]));
  const minY = Math.min(...boundary.map((p) => p[1])), maxY = Math.max(...boundary.map((p) => p[1]));
  const xs = Array.from({ length: 13 }, (_, i) => minX + (maxX - minX) * i / 12);
  const ys = Array.from({ length: 11 }, (_, i) => minY + (maxY - minY) * i / 10);
  for (const part of parts2) for (let x = 0; x < 12; x++) for (let y = 0; y < 10; y++) {
    const polygon = clip(clip(clip(
      clip(part.map((i) => boundary[i]), 0, xs[x], true),
      0,
      xs[x + 1],
      false
    ), 1, ys[y], true), 1, ys[y + 1], false);
    if (polygon.length < 3) continue;
    const points = polygon.map((p) => [p[0], p[1], height(p)]);
    for (let i = 1; i < points.length - 1; i++) {
      b.quad(
        points[0],
        points[i],
        points[i + 1],
        points[i + 1],
        0,
        [polygon[0], polygon[i], polygon[i + 1], polygon[i + 1]],
        [0, 0, 1],
        4
      );
    }
  }
}
var cross = (a, b) => a[0] * b[1] - a[1] * b[0];
var subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
var xy = (p) => [p[0], p[1]];
function buildSettledProjection(b, construct, refine) {
  if (b.spec.blocking !== 0 || b.spec.height > 6) throw new Error("Settled projection requires shallow nonblocking material");
  const source = [];
  const add2 = (a, c, d) => {
    if (Math.abs(cross(subtract(xy(c), xy(a)), subtract(xy(d), xy(a)))) > 1e-8) source.push([a, c, d]);
  };
  construct({
    spec: b.spec,
    quad(a, c, d, e) {
      add2(a, c, d);
      add2(a, d, e);
    },
    joint() {
      throw new Error("Shallow source must not emit a pollution joint");
    }
  });
  const weights = (p, t) => {
    const a = xy(t[0]), ab = subtract(xy(t[1]), a), ac = subtract(xy(t[2]), a), ap = subtract(p, a);
    const area2 = cross(ab, ac), v = cross(ap, ac) / area2, w = cross(ab, ap) / area2, u = 1 - v - w;
    return u >= -1e-8 && v >= -1e-8 && w >= -1e-8 ? [u, v, w] : null;
  };
  const contains3 = (p) => source.some((t) => weights(p, t) !== null);
  const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  const edges = /* @__PURE__ */ new Map();
  for (const t of source) for (let i = 0; i < 3; i++) {
    const a = xy(t[i]), c = xy(t[(i + 1) % 3]), ak = key(a), ck = key(c), id = ak < ck ? `${ak}/${ck}` : `${ck}/${ak}`;
    const edge = edges.get(id);
    if (edge) edge.uses++;
    else edges.set(id, { a, b: c, uses: 1 });
  }
  const candidates = [...edges.values()].filter((e) => e.uses === 1), boundary = [];
  const epsilon = Math.max(b.spec.length, b.spec.width) * 1e-6;
  for (const edge of candidates) {
    const ab = subtract(edge.b, edge.a), length2 = Math.hypot(...ab), cuts = [0, 1];
    for (const other of candidates) {
      if (other === edge) continue;
      const cd = subtract(other.b, other.a), ac = subtract(other.a, edge.a), denominator = cross(ab, cd);
      if (Math.abs(denominator) > 1e-9) {
        const t = cross(ac, cd) / denominator, u = cross(ac, ab) / denominator;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      } else if (Math.abs(cross(ac, ab)) < 1e-7) {
        for (const p of [other.a, other.b]) {
          const ap = subtract(p, edge.a), t = (ap[0] * ab[0] + ap[1] * ab[1]) / (length2 * length2);
          if (t > 0 && t < 1) cuts.push(t);
        }
      }
    }
    cuts.sort((a, c) => a - c);
    const at2 = (t) => [edge.a[0] + ab[0] * t, edge.a[1] + ab[1] * t];
    for (let i = 0; i < cuts.length - 1; i++) {
      if (cuts[i + 1] - cuts[i] < 1e-8) continue;
      const p = at2((cuts[i] + cuts[i + 1]) / 2), nx = -ab[1] / length2 * epsilon, ny = ab[0] / length2 * epsilon;
      if (contains3([p[0] + nx, p[1] + ny]) !== contains3([p[0] - nx, p[1] - ny]))
        boundary.push({ a: at2(cuts[i]), b: at2(cuts[i + 1]), uses: 1 });
    }
  }
  if (!boundary.length) throw new Error("Settled material has no exterior boundary");
  const cache = /* @__PURE__ */ new Map();
  const surface = (p) => {
    const id = key(p), known = cache.get(id);
    if (known) return known;
    let distance2 = Infinity, height = 0;
    for (const edge of boundary) {
      const ab = subtract(edge.b, edge.a), ap = subtract(p, edge.a);
      const t2 = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1])));
      distance2 = Math.min(distance2, Math.hypot(ap[0] - ab[0] * t2, ap[1] - ab[1] * t2));
    }
    for (const triangle of source) {
      const w = weights(p, triangle);
      if (w) height = Math.max(height, w[0] * triangle[0][2] + w[1] * triangle[1][2] + w[2] * triangle[2][2]);
    }
    const span = Math.min(34, Math.max(16, b.spec.width * 0.18)) * (1 + 0.22 * p[0] / b.spec.length - 0.12 * p[1] / b.spec.width);
    const t = Math.max(0, Math.min(1, distance2 / span)), settled = t * t * (3 - 2 * t);
    const point = [p[0], p[1], height * settled];
    cache.set(id, point);
    return point;
  };
  const emit = (a, c, d) => {
    b.quad(surface(a), surface(c), surface(d), surface(d), 0, [a, c, d, d], [0, 0, 1], 0);
  };
  const midpoint = (a, c) => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  for (const triangle of source) {
    const [a, c, d] = triangle.map(xy);
    if (refine) {
      const ac = midpoint(a, c), cd = midpoint(c, d), da = midpoint(d, a);
      emit(a, ac, da);
      emit(ac, c, cd);
      emit(da, cd, d);
      emit(ac, cd, da);
    } else emit(a, c, d);
  }
}
var NATIVE_VOLUME_V4_PROFILES = ["fracture-fan", "fallen-bundle", "clamp-bank", "torn-sheet", "compressed-wedge", "porous-break", "settled-sheet", "settled-fan", "settled-bundle", "settled-clamp"];
var uv5 = (p) => [p[0], p[1]];
function fracturedFace(b, a, c, d) {
  if (b.spec.blocking !== 1) return;
  const length2 = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const perpendicular = Math.abs((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0])) / Math.max(1e-3, length2);
  const du = Math.min(0.34, 24 / Math.max(1, length2)), dv = Math.min(0.23, 6 / Math.max(1, perpendicular));
  const sample = (u, v) => [
    a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v,
    a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + 0.06
  ];
  const p = sample(0.17, 0.14), q = sample(0.17 + du, 0.14), r = sample(0.17 + du * 0.78, 0.14 + dv), t = sample(0.17, 0.14 + dv);
  b.quad(p, q, r, t, 3, [uv5(p), uv5(q), uv5(r), uv5(t)], [0, 0, 1], 3);
  b.joint(sample(0.17 + du * 0.43, 0.14 + dv * 0.43));
}
function insetOutline(b, outline) {
  const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length, cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
  return outline.map(([x, y]) => {
    const factor = b.spec.blocking === 1 ? Math.min(0.25, 6.5 / Math.max(1, Math.hypot(x - cx, y - cy))) : 0;
    return [x + (cx - x) * factor, y + (cy - y) * factor];
  });
}
function surfaceHeight(b, height) {
  const foot = b.spec.blocking === 1 ? Math.min(6, b.spec.height * 0.3) : 0;
  return foot + height * (1 - foot / b.spec.height);
}
function section(b, outline, height, scar = false, closed = true) {
  const crown = closed ? insetOutline(b, outline) : outline;
  const top = crown.map(([x, y]) => [x, y, surfaceHeight(b, height(x, y))]);
  const cx = crown.reduce((sum, p) => sum + p[0], 0) / crown.length;
  const cy = crown.reduce((sum, p) => sum + p[1], 0) / crown.length;
  const centre = [cx, cy, surfaceHeight(b, height(cx, cy))];
  for (let i = 0; i < top.length; i++) {
    const a = top[i], c = top[(i + 1) % top.length];
    b.quad(a, c, centre, centre, 0, [uv5(a), uv5(c), uv5(centre), uv5(centre)], [0, 0, 1]);
    if (closed) {
      const footA = outline[i], footC = outline[(i + 1) % outline.length], af = [...footA, 0], cf = [...footC, 0];
      b.quad(
        af,
        cf,
        c,
        a,
        1,
        [[a[0], 0], [c[0], 0], [c[0], c[2]], [a[0], a[2]]],
        [a[0] + c[0] - 2 * cx, a[1] + c[1] - 2 * cy, 0],
        3
      );
    }
    if (scar && i === 1) fracturedFace(b, a, c, centre);
  }
}
function strip(b, rows, innerFrom = Infinity) {
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], c = rows[i + 1];
    for (let j = 0; j < a.length - 1; j++) {
      const edge = j === 0 || j === a.length - 2;
      b.quad(
        a[j],
        c[j],
        c[j + 1],
        a[j + 1],
        edge ? 1 : j >= innerFrom ? 2 : 0,
        [uv5(a[j]), uv5(c[j]), uv5(c[j + 1]), uv5(a[j + 1])],
        [0, 0, 1],
        edge ? 3 : 0
      );
      if (i === 1 && j === 3) fracturedFace(b, a[j], c[j], c[j + 1]);
    }
  }
  for (const index of [0, rows.length - 1]) {
    const row = rows[index], direction2 = index === 0 ? -1 : 1;
    for (let j = 0; j < row.length - 1; j++) {
      const a = row[j], c = row[j + 1], af = [a[0], a[1], 0], cf = [c[0], c[1], 0];
      b.quad(af, a, c, cf, 1, [uv5(af), uv5(a), uv5(c), uv5(cf)], [direction2, 0, 0], 3);
    }
  }
}
function fractureFan(b) {
  const s = b.spec, l = s.length, w = s.width;
  const outline = [
    [-0.5, -0.3],
    [-0.32, -0.49],
    [0.24, -0.4],
    [0.43, -0.18],
    [0.51, 0.17],
    [0.29, 0.39],
    [0.16, 0.21],
    [0.09, -0.04],
    [-0.02, 0.36],
    [-0.3, 0.5],
    [-0.46, 0.17],
    [-0.3, -0.1]
  ];
  const feet = outline.map(([x, y]) => [x * l, y * w]);
  const depths = [0.16, 0.1, 0.18, 0.48, 0.94, 0.3, 0.78, 0.42, 0.7, 1, 0.26, 0.12];
  const breadth = Math.min(s.blocking === 1 ? 11 : 6, Math.min(l, w) * 0.065);
  const inward = (a, c) => {
    const dx = c[0] - a[0], dy = c[1] - a[1], size = Math.hypot(dx, dy);
    return [-dy / size, dx / size];
  };
  const crown = feet.map((p, i) => {
    const before = inward(feet[(i + feet.length - 1) % feet.length], p), after = inward(p, feet[(i + 1) % feet.length]);
    const dx = before[0] + after[0], dy = before[1] + after[1], size = Math.hypot(dx, dy);
    return [p[0] + dx / size * breadth * depths[i], p[1] + dy / size * breadth * depths[i]];
  });
  const rims = feet.map((a, i) => {
    const next = (i + 1) % feet.length, c = feet[next], p = crown[i], q = crown[next], normal = inward(a, c);
    const samples = i === 4 ? [0, 0.24, 0.61, 0.76, 1] : i === 8 ? [0, 0.32, 0.79, 1] : [0, 1];
    return samples.map((t) => {
      const chip = i === 4 ? t === 0.61 ? 0.83 : t === 0.76 ? 0.12 : 0 : i === 8 && t === 0.32 ? 0.38 : 0;
      return {
        foot: [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t],
        top: [
          p[0] + (q[0] - p[0]) * t + normal[0] * breadth * chip,
          p[1] + (q[1] - p[1]) * t + normal[1] * breadth * chip
        ]
      };
    });
  });
  const parts2 = [[0, 1, 2, 3, 7, 11], [11, 7, 8, 9, 10], [7, 3, 4, 5, 6]];
  const alongShoulder = ([x, y]) => ((y / w + 0.04) * 0.34 + (x / l - 0.09) * 0.14) / Math.hypot(0.34, 0.14);
  const bands = [-1, 0.055, 0.14, 1], drops = [0, 0, 0.27, 0.45];
  const height = (p, part) => {
    let drop = 0;
    if (part === 2) {
      const v = alongShoulder(p), band = Math.max(0, Math.min(2, bands.findIndex((at2) => at2 > v) - 1));
      const t = (v - bands[band]) / (bands[band + 1] - bands[band]);
      drop = drops[band] + (drops[band + 1] - drops[band]) * t;
    }
    return surfaceHeight(b, s.height * (0.78 + p[0] / l * (0.08 + s.fold * 0.08) - p[1] / w * 0.13 - drop));
  };
  const clip = (polygon, boundary, greater) => {
    const result = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j], c = polygon[(j + 1) % polygon.length], av = alongShoulder(a), cv = alongShoulder(c);
      const ai = greater ? av >= boundary : av <= boundary, ci = greater ? cv >= boundary : cv <= boundary;
      if (ai) result.push(a);
      if (ai !== ci) {
        const t = (boundary - av) / (cv - av);
        result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    return result;
  };
  for (const [part, indices] of parts2.entries()) {
    const polygon = [];
    for (let i = 0; i < indices.length; i++) {
      const at2 = indices[i], next = indices[(i + 1) % indices.length];
      if ((at2 + 1) % feet.length === next) polygon.push(...rims[at2].slice(0, -1).map((p) => p.top));
      else polygon.push(crown[at2]);
    }
    for (let band = 0; band < (part === 2 ? 3 : 1); band++) {
      const face = part === 2 ? clip(clip(polygon, bands[band], true), bands[band + 1], false) : polygon;
      if (face.length < 3) continue;
      const centre = [face.reduce((sum, p) => sum + p[0], 0) / face.length, face.reduce((sum, p) => sum + p[1], 0) / face.length];
      const mid = [...centre, height(centre, part)];
      for (let i = 0; i < face.length; i++) {
        const p = face[i], q = face[(i + 1) % face.length], a = [...p, height(p, part)], c = [...q, height(q, part)];
        b.quad(a, c, mid, mid, 0, [uv5(a), uv5(c), uv5(mid), uv5(mid)], [0, 0, 1]);
        if (part === 0 && i === 1) fracturedFace(b, a, c, mid);
      }
    }
  }
  for (let edge = 0; edge < feet.length; edge++) {
    const row = rims[edge], part = edge >= 3 && edge <= 6 ? 2 : 0;
    for (let j = 0; j < row.length - 1; j++) {
      const p = row[j], q = row[j + 1], av = alongShoulder(p.top), cv = alongShoulder(q.top);
      const cuts = part === 2 ? [0, ...bands.map((v) => (v - av) / (cv - av)).filter((t) => t > 0 && t < 1), 1].sort((a, c) => a - c) : [0, 1];
      for (let k = 0; k < cuts.length - 1; k++) {
        const lerp2 = (a2, c2, t) => [a2[0] + (c2[0] - a2[0]) * t, a2[1] + (c2[1] - a2[1]) * t];
        const a = lerp2(p.top, q.top, cuts[k]), c = lerp2(p.top, q.top, cuts[k + 1]);
        const af = [...lerp2(p.foot, q.foot, cuts[k]), 0], cf = [...lerp2(p.foot, q.foot, cuts[k + 1]), 0];
        const at2 = [...a, height(a, part)], ct = [...c, height(c, part)];
        const material = edge === 4 || edge === 5 || edge === 8 || edge === 7 && j === 0 ? 1 : 0;
        b.quad(af, cf, ct, at2, material, [uv5(af), uv5(cf), uv5(ct), uv5(at2)], [0, 0, 1], material === 1 ? 3 : 0);
      }
    }
  }
}
function fallenBundle(b) {
  const s = b.spec, rows = [];
  const bend = ((Math.imul(s.seed, 1103515245) >>> 0) / 4294967296 - 0.5) * s.distortion * 0.06;
  const widths = [1, 1.16, 1.02, 0.77, 0.64, 0.38];
  const xs = [-0.5, -0.34, -0.1, 0.15, 0.34, 0.5];
  for (let i = 0; i < xs.length; i++) {
    const t = i / (xs.length - 1), x = xs[i] * s.length;
    const centre = s.width * (Math.sin(t * 2.2) * (0.12 + s.fold * 0.06 + bend) - 0.06);
    const radius = s.width * 0.4 * widths[i];
    const peak = s.height * (0.93 - t * 0.48 + Math.sin(t * Math.PI) * 0.1);
    const foot = s.blocking === 1 ? Math.min(7, peak * 0.3) : 0;
    const profile = [[-1, 0], [-0.93, foot / peak], [-0.63, 0.69], [-0.16, 1], [0.32, 0.85], [0.77, 0.41], [0.96, foot / peak], [1, 0]];
    rows.push(profile.map(([across, rise], at2) => [
      x + s.length * 0.022 * across * (i === 0 ? 1 : i === xs.length - 1 ? -1 : 0),
      centre + radius * across * (across > 0 ? 0.84 + 0.1 * t : 1),
      at2 === 0 || at2 === profile.length - 1 ? 0 : Math.max(foot, peak * rise)
    ]));
  }
  strip(b, rows);
  const count = Math.min(4, s.branches);
  for (let i = 0; i < count; i++) {
    const y = s.width * (0.02 + (i / (count - 1) - 0.5) * 0.22), x = s.length * (0.38 + i % 2 * 0.022);
    section(
      b,
      [
        [x, y - s.width * 0.065],
        [s.length * (0.56 + 0.035 * i), y - s.width * 0.026],
        [s.length * (0.53 + 0.032 * i), y + s.width * 0.019],
        [x, y + s.width * 0.039]
      ],
      (px) => s.height * (0.26 - (px / s.length - 0.38) * 0.63)
    );
  }
}
function clampBank(b) {
  const s = b.spec, rows = [], textureRows = [];
  const along = [-0.5, -0.36, -0.13, 0.12, 0.34, 0.49];
  const breadths = [0.62, 1, 1.14, 0.91, 0.72, 0.35];
  const stations = along.map((t, i) => ({
    x: t * s.length,
    bend: s.width * (0.1 * Math.sin(i * 0.65) - 0.03),
    width: s.width * breadths[i],
    peak: s.height * (0.7 + 0.3 * Math.sin((i + 0.6) / (along.length + 0.2) * Math.PI))
  }));
  const across = [-0.5, -0.46, -0.34, -0.13 - s.fold * 0.045, 0.05, 0.2 + s.opening * 0.035, 0.4, 0.47, 0.5];
  const samples = across.flatMap((a, i) => i === across.length - 1 ? [a] : [a, a + (across[i + 1] - a) / 3, a + (across[i + 1] - a) * 2 / 3]);
  const smoothHeight = (v, values) => {
    const slopes = across.slice(0, -1).map((a, i) => (values[i + 1] - values[i]) / (across[i + 1] - a));
    const tangents = values.map((_value, i) => i === 0 ? slopes[0] : i === values.length - 1 ? slopes[i - 1] : slopes[i - 1] * slopes[i] <= 0 ? 0 : 2 / (1 / slopes[i - 1] + 1 / slopes[i]));
    const index = Math.min(across.length - 2, Math.max(0, across.findIndex((a) => a > v) - 1));
    const span = across[index + 1] - across[index], t = (v - across[index]) / span;
    return (2 * t ** 3 - 3 * t * t + 1) * values[index] + (t ** 3 - 2 * t * t + t) * span * tangents[index] + (-2 * t ** 3 + 3 * t * t) * values[index + 1] + (t ** 3 - t * t) * span * tangents[index + 1];
  };
  const subdivisions = 2;
  for (let at2 = 0; at2 <= (stations.length - 1) * subdivisions; at2++) {
    const segment = Math.min(stations.length - 2, Math.floor(at2 / subdivisions)), t = at2 / subdivisions - segment;
    const a = stations[segment], c = stations[segment + 1], u = at2 / ((stations.length - 1) * subdivisions);
    const lerp2 = (p, q) => p + (q - p) * t;
    const x = lerp2(a.x, c.x), width = lerp2(a.width, c.width), bend = lerp2(a.bend, c.bend);
    const peak = lerp2(a.peak, c.peak), foot = s.blocking === 1 ? Math.min(8, peak * 0.32) : 0;
    const pressure = Math.sin(Math.PI * u) ** 2, shoulder = 0.5 + 0.5 * Math.cos(u * Math.PI * 1.7 + 0.4);
    const profile = [
      0,
      foot / peak,
      0.54 + shoulder * 0.08,
      1,
      0.84 + pressure * 0.09,
      0.31 + shoulder * 0.16,
      0.13 + pressure * 0.09,
      foot / peak,
      0
    ];
    const row = samples.map((v, j) => {
      const isFoot = j === 0 || j === samples.length - 1;
      const end = Math.min(9, s.length * 0.038) * ((1 - u) ** 12 - u ** 12);
      const tear = 0.42 + 0.58 * Math.max(0, 1 - Math.abs((v - 0.1) / 0.35));
      return [
        x + s.length * 0.028 * v + (isFoot ? 0 : end * tear),
        bend + width * v,
        isFoot ? 0 : Math.max(foot * 0.6, peak * smoothHeight(v, profile))
      ];
    });
    let arc = 0;
    const texels = row.map((point, j) => {
      if (j) {
        const previous = row[j - 1];
        arc += Math.hypot(point[1] - previous[1], point[2] - previous[2]);
      }
      return [x, arc];
    });
    rows.push(row);
    textureRows.push(texels);
  }
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < samples.length - 1; j++) {
    const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
    const edge = j === 0 || j === samples.length - 2, inner = samples[j] >= 0.05;
    const slot = edge ? 1 : inner ? 2 : 0;
    b.quad(a, c, d, e, slot, [
      textureRows[i][j],
      textureRows[i + 1][j],
      textureRows[i + 1][j + 1],
      textureRows[i][j + 1]
    ], [0, 0, 1], edge ? 3 : inner ? 1 : 0);
    if (i === Math.floor((rows.length - 1) * 0.34) && j === 10) fracturedFace(b, a, c, d);
  }
  for (const index of [0, rows.length - 1]) {
    const row = rows[index], station = stations[index === 0 ? 0 : stations.length - 1];
    for (let j = 0; j < row.length - 1; j++) {
      const a = row[j], c = row[j + 1], af = [station.x + s.length * 0.028 * samples[j], a[1], 0], cf = [station.x + s.length * 0.028 * samples[j + 1], c[1], 0];
      b.quad(af, cf, c, a, 1, [[0, a[1]], [0, c[1]], [c[2], c[1]], [a[2], a[1]]], [0, 0, 1], 3);
    }
  }
}
function tornSheet(b) {
  const s = b.spec;
  const outline = [
    [-0.5, -0.23],
    [-0.29, -0.48],
    [0.13, -0.37],
    [0.4, -0.26],
    [0.51, -0.03],
    [0.34, 0.29],
    [0.23, 0.13],
    [0.04, -0.02],
    [0.13, 0.23],
    [-0.1, 0.49],
    [-0.37, 0.34],
    [-0.28, 0.13],
    [-0.46, 0.02]
  ];
  const feet = outline.map(([x, y]) => [x * s.length, y * s.width]);
  const depths = [0.18, 0.1, 0.16, 0.3, 0.52, 0.94, 0.62, 0.28, 0.72, 1, 0.47, 0.23, 0.14];
  const breadth = Math.min(s.blocking === 1 ? 4 : 1.2, Math.min(s.length, s.width) * 0.035);
  const inward = (a, c) => {
    const dx = c[0] - a[0], dy = c[1] - a[1], size = Math.hypot(dx, dy);
    return [-dy / size, dx / size];
  };
  const crown = feet.map((p, i) => {
    const a = inward(feet[(i + feet.length - 1) % feet.length], p), c = inward(p, feet[(i + 1) % feet.length]);
    const dx = a[0] + c[0], dy = a[1] + c[1], size = Math.hypot(dx, dy);
    return [p[0] + dx / size * breadth * depths[i], p[1] + dy / size * breadth * depths[i]];
  });
  const parts2 = [[0, 1, 2, 7, 11, 12], [11, 7, 8, 9, 10], [2, 3, 4, 5, 6, 7]];
  const clamp6 = (value) => Math.max(0, Math.min(1, value));
  const smooth3 = (value) => {
    const t = clamp6(value);
    return t * t * (3 - 2 * t);
  };
  const phase2 = ([x, y]) => y / s.width + (0.18 + s.fold * 0.1) * x / s.length;
  const height = (point) => {
    const v = phase2(point), x = point[0] / s.length;
    const lift = v < -0.25 ? 0.035 : v < 0.17 ? 0.035 + 0.965 * smooth3((v + 0.25) / 0.42) : 1 - 0.71 * smooth3((v - 0.17) / 0.25);
    const amplitude = 0.56 + 0.44 * smooth3((0.38 - x) / 0.86);
    const foot = s.blocking === 1 ? Math.min(3.5, s.height * 0.16) : 0;
    return foot + (s.height - foot) * (0.025 + amplitude * lift);
  };
  const clip = (polygon, axis, boundary, greater) => {
    const result = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j], c = polygon[(j + 1) % polygon.length], av = a[axis], cv = c[axis];
      const ai = greater ? av >= boundary : av <= boundary, ci = greater ? cv >= boundary : cv <= boundary;
      if (ai) result.push(a);
      if (ai !== ci) {
        const t = (boundary - av) / (cv - av);
        result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    return result;
  };
  const xs = [-0.52, -0.36, -0.18, 0.1, 0.27, 0.4, 0.53].map((x) => x * s.length);
  const ys = [-0.52, -0.35, -0.25, -0.16, -0.05, 0.035, 0.1, 0.16, 0.22, 0.28, 0.35, 0.43, 0.55].map((y) => y * s.width);
  for (const [part, indices] of parts2.entries()) for (let x = 0; x < xs.length - 1; x++) for (let y = 0; y < ys.length - 1; y++) {
    const polygon = clip(clip(clip(clip(indices.map((i) => crown[i]), 0, xs[x], true), 0, xs[x + 1], false), 1, ys[y], true), 1, ys[y + 1], false);
    if (polygon.length < 3) continue;
    const points = polygon.map((p) => [...p, height(p)]);
    const centre = [polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length, polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length];
    const material = phase2(centre) > 0.17 ? 2 : 0;
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0], c = points[i], d = points[i + 1];
      b.quad(a, c, d, d, material, [uv5(a), uv5(c), uv5(d), uv5(d)], [0, 0, 1], 4);
      if (part === 0 && x === 2 && y === 3 && i === 1) fracturedFace(b, a, c, d);
    }
  }
  for (let edge = 0; edge < feet.length; edge++) {
    const next = (edge + 1) % feet.length, a = crown[edge], c = crown[next], af = feet[edge], cf = feet[next];
    const cuts = [0, ...xs.map((v) => (v - a[0]) / (c[0] - a[0])), ...ys.map((v) => (v - a[1]) / (c[1] - a[1])), 1].filter((t) => t >= 0 && t <= 1).sort((x, y) => x - y);
    const at2 = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
    for (let i = 0; i < cuts.length - 1; i++) {
      if (cuts[i + 1] - cuts[i] < 1e-9) continue;
      const p = at2(a, c, cuts[i]), q = at2(a, c, cuts[i + 1]);
      const pFoot = [...at2(af, cf, cuts[i]), 0], qFoot = [...at2(af, cf, cuts[i + 1]), 0];
      const pTop = [...p, height(p)], qTop = [...q, height(q)];
      const material = edge === 5 || edge === 6 || edge === 8 || edge === 9 ? 1 : 0;
      b.quad(pFoot, qFoot, qTop, pTop, material, [uv5(pFoot), uv5(qFoot), uv5(qTop), uv5(pTop)], [0, 0, 1], material === 1 ? 3 : 4);
    }
  }
}
function buildGroundNativeVolume(builder) {
  switch (builder.spec.shapeProfile) {
    case "fracture-fan":
      fractureFan(builder);
      return;
    case "fallen-bundle":
      fallenBundle(builder);
      return;
    case "clamp-bank":
      clampBank(builder);
      return;
    case "torn-sheet":
      tornSheet(builder);
      return;
    case "compressed-wedge":
      buildCompressedWedge(builder);
      return;
    case "porous-break":
      buildPorousBreak(builder);
      return;
    case "settled-sheet":
      buildSettledSheet(builder);
      return;
    case "settled-fan":
      buildSettledFan(builder);
      return;
    case "settled-bundle":
      buildSettledProjection(builder, fallenBundle, true);
      return;
    case "settled-clamp":
      buildSettledProjection(builder, clampBank, false);
      return;
    default:
      throw new Error("Unknown construction 4 native shape profile");
  }
}
function distance(p, a, b) {
  const x = b.x - a.x, y = b.y - a.y, length2 = x * x + y * y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / length2));
  return Math.hypot(p.x - a.x - x * t, p.y - a.y - y * t);
}
function appendNativeGroundEdges(b, context) {
  const width = b.spec.groundEdgeWidth;
  if (width === void 0) return;
  if (!context || !context.polygons.length || typeof context.matterAt !== "function" || !Number.isInteger(context.width / 8) || !Number.isInteger(context.height / 8) || context.width <= 0 || context.height <= 0 || context.width * context.height > 4194304)
    throw new Error("Ground edge requires the complete bounded authoritative terrain context");
  const triangleBudget = context.width <= 1280 && context.height <= 1024 ? 2048 : 20480;
  const cosine = Math.cos(b.spec.rotation), sine = Math.sin(b.spec.rotation);
  const local = (x, y, z) => {
    const dx = x - b.spec.x, dy = y - b.spec.y;
    return [dx * cosine + dy * sine, -dx * sine + dy * cosine, z];
  };
  const nearest = (x, y) => {
    let result = Infinity;
    for (const polygon of context.polygons) for (let i = 0; i < polygon.length; i++) result = Math.min(result, distance({ x, y }, polygon[i], polygon[(i + 1) % polygon.length]));
    return result;
  };
  const heightAt = (x, y) => {
    const t = Math.min(1, nearest(x, y) / width);
    return b.spec.height * (t < 0.3 ? t / 0.3 : (1 - t) / 0.7);
  };
  const normalRunsAcrossX = (x, y) => {
    let nearestSquared = Infinity, acrossX = true;
    for (const polygon of context.polygons) for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], c = polygon[(i + 1) % polygon.length], dx = c.x - a.x, dy = c.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
      const nx = x - a.x - dx * t, ny = y - a.y - dy * t, squared = nx * nx + ny * ny;
      if (squared < nearestSquared) {
        nearestSquared = squared;
        acrossX = squared < 1e-12 ? Math.abs(dy) >= Math.abs(dx) : Math.abs(nx) >= Math.abs(ny);
      }
    }
    return acrossX;
  };
  let previousPeak = 0;
  const cells = /* @__PURE__ */ new Map();
  const horizontalMidpoints = /* @__PURE__ */ new Set(), verticalMidpoints = /* @__PURE__ */ new Set();
  const stride = context.width / 8 + 1;
  for (const polygon of context.polygons) {
    const minX = Math.max(0, Math.floor((Math.min(...polygon.map((p) => p.x)) - width) / 8));
    const maxX = Math.min(context.width / 8 - 1, Math.floor((Math.max(...polygon.map((p) => p.x)) + width) / 8));
    const minY = Math.max(0, Math.floor((Math.min(...polygon.map((p) => p.y)) - width) / 8));
    const maxY = Math.min(context.height / 8 - 1, Math.floor((Math.max(...polygon.map((p) => p.y)) + width) / 8));
    for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
      const key = row * (context.width / 8) + col, x = col * 8, y = row * 8;
      if (cells.has(key) || !context.matterAt(x + 4, y + 4) || nearest(x + 4, y + 4) > width + 6) continue;
      previousPeak = Math.max(
        previousPeak,
        heightAt(x, y),
        heightAt(x + 8, y),
        heightAt(x + 8, y + 8),
        heightAt(x, y + 8),
        heightAt(x + 4, y + 4)
      );
      const acrossX = normalRunsAcrossX(x + 4, y + 4);
      const samples = [
        [x, y],
        [x + 8, y],
        [x + 8, y + 8],
        [x, y + 8],
        [x + 4, y],
        [x + 4, y + 8],
        [x, y + 4],
        [x + 8, y + 4]
      ];
      if (samples.every((p) => heightAt(p[0], p[1]) === 0)) continue;
      cells.set(key, { col, row, acrossX });
      if (acrossX) {
        horizontalMidpoints.add(row * stride + col);
        horizontalMidpoints.add((row + 1) * stride + col);
      } else {
        verticalMidpoints.add(row * stride + col);
        verticalMidpoints.add(row * stride + col + 1);
      }
    }
  }
  let triangles = 0, nextPeak = 0;
  const faces = [];
  const face = (polygon) => {
    triangles += polygon.length - 2;
    if (triangles > triangleBudget) throw new Error(`Authored ground cut exceeds the ${triangleBudget}-triangle edge budget`);
    faces.push(polygon);
    for (const p of polygon) nextPeak = Math.max(nextPeak, heightAt(p[0], p[1]));
  };
  for (const { col, row, acrossX } of cells.values()) {
    const x = col * 8, y = row * 8;
    const a = [x, y], c = [x + 8, y], d = [x + 8, y + 8], e = [x, y + 8];
    const top = [x + 4, y], right = [x + 8, y + 4], bottom = [x + 4, y + 8], left = [x, y + 4];
    if (acrossX) {
      face([top, bottom, e, ...verticalMidpoints.has(row * stride + col) ? [left] : [], a]);
      face([top, c, ...verticalMidpoints.has(row * stride + col + 1) ? [right] : [], d, bottom]);
    } else {
      face([left, a, ...horizontalMidpoints.has(row * stride + col) ? [top] : [], c, right]);
      face([left, right, d, ...horizontalMidpoints.has((row + 1) * stride + col) ? [bottom] : [], e]);
    }
  }
  if (triangles === 0 || nextPeak === 0) throw new Error("Authored ground edge produced no present material");
  const heightScale = previousPeak > 0 ? previousPeak / nextPeak : 1;
  for (const polygon of faces) {
    const points = polygon.map((p) => local(p[0], p[1], heightAt(p[0], p[1]) * heightScale));
    for (let i = 1; i < polygon.length - 1; i++) b.quad(
      points[0],
      points[i],
      points[i + 1],
      points[i + 1],
      1,
      [polygon[0], polygon[i], polygon[i + 1], polygon[i + 1]],
      [0, 0, 1],
      3
    );
  }
}
var NATIVE_VOLUME_FAMILY_SEQUENCE = ["folded-slab", "fibre-knot", "broken-shell", "granular-ridge", "membrane-rim", "gel-flow"];
var NATIVE_VOLUME_MATERIALS = ["outer", "cut", "inner", "joint"];
var NATIVE_VOLUME_REGIONS = { intact: 0, compressed: 1, peeled: 2, fractured: 3, tension: 4, glazed: 5 };
var TAU2 = Math.PI * 2;
var clamp2 = (v, low, high2) => Math.max(low, Math.min(high2, v));
function phase(seed2, salt) {
  let a = Math.imul((seed2 | 0) ^ salt, 73244475);
  a = Math.imul(a ^ a >>> 16, 73244475);
  return ((a ^ a >>> 16) >>> 0) / 4294967296;
}
function validateNativeVolumeSpec(spec) {
  const numbers = ["id", "seed", "x", "y", "rotation", "length", "width", "height", "thickness", "fold", "branches", "opening", "distortion"];
  const keys = /* @__PURE__ */ new Set([...numbers, "family", "blocking", "constructionVersion", "shapeProfile", "groundEdgeWidth"]);
  if (Object.keys(spec).some((key) => !keys.has(key)) || numbers.some((key) => !Number.isFinite(spec[key])))
    throw new Error("Native volume must contain exactly the known required numeric fields");
  for (const [key, value] of Object.entries(spec)) {
    if (key !== "family" && key !== "shapeProfile" && !((key === "blocking" || key === "constructionVersion") && value === void 0) && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`Native volume ${key} must be finite`);
    }
  }
  if (!["folded-slab", "fibre-knot", "broken-shell", "granular-ridge", "membrane-rim", "gel-flow"].includes(spec.family)) throw new Error("Unknown native volume family");
  if (!Number.isInteger(spec.id) || spec.id < 1 || spec.id > 2147483647) throw new Error("Volume id must be a positive Int32");
  if (!Number.isInteger(spec.seed)) throw new Error("Volume seed must be an integer");
  if (spec.constructionVersion !== void 0 && ![1, 2, 3, 4].includes(spec.constructionVersion)) throw new Error("Native volume constructionVersion must be 1, 2, 3 or 4");
  const profiles = spec.constructionVersion === 4 ? NATIVE_VOLUME_V4_PROFILES : spec.constructionVersion === 3 ? NATIVE_VOLUME_SHAPE_PROFILES : [];
  if (profiles.length ? !profiles.includes(spec.shapeProfile) : spec.shapeProfile !== void 0)
    throw new Error("Native volume shapeProfile must belong to its explicit construction version");
  if (spec.blocking !== void 0 && spec.blocking !== 0 && spec.blocking !== 1) throw new Error("Native volume blocking must be 0 or 1");
  if (spec.shapeProfile?.startsWith("settled-") && (spec.blocking !== 0 || spec.height > 6))
    throw new Error("Settled material requires explicit nonblocking material with height at most 6");
  if (spec.groundEdgeWidth !== void 0 && (spec.constructionVersion !== 4 || spec.blocking !== 0 || spec.height > 6 || spec.groundEdgeWidth < 8 || spec.groundEdgeWidth > 24)) throw new Error("Native ground edge requires v4 low relief and width 8\u201324px");
  if (spec.length < 16 || spec.width < 12 || spec.height < 2 || spec.thickness < 1 || spec.length > 2048 || spec.width > 2048 || spec.height > 512 || spec.thickness > Math.min(spec.length, spec.width) * 0.45) throw new Error("Native volume dimensions outside bounded construction range");
  for (const key of ["fold", "opening", "distortion"]) {
    if (spec[key] < 0 || spec[key] > 1) throw new Error(`Native volume ${key} must be in [0, 1]`);
  }
  if (!Number.isInteger(spec.branches) || spec.branches < 2 || spec.branches > 8) throw new Error("Native volume branches must be an integer in [2, 8]");
}
var MeshBuilder = class {
  constructor(spec) {
    this.spec = spec;
    __publicField(this, "groundEdgeStart");
    __publicField(this, "points", []);
    __publicField(this, "normalData", []);
    __publicField(this, "texels", []);
    __publicField(this, "triangles", []);
    __publicField(this, "slots", []);
    __publicField(this, "regions", []);
    __publicField(this, "joints", []);
    __publicField(this, "bounds", { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: 0 });
    __publicField(this, "cosine");
    __publicField(this, "sine");
    this.cosine = Math.cos(spec.rotation);
    this.sine = Math.sin(spec.rotation);
  }
  vertex(p, uv6, n) {
    const x = this.spec.x + p[0] * this.cosine - p[1] * this.sine;
    const y = this.spec.y + p[0] * this.sine + p[1] * this.cosine;
    const z = Math.max(0, p[2]);
    this.bounds.minX = Math.min(this.bounds.minX, x);
    this.bounds.maxX = Math.max(this.bounds.maxX, x);
    this.bounds.minY = Math.min(this.bounds.minY, y);
    this.bounds.maxY = Math.max(this.bounds.maxY, y);
    this.bounds.maxZ = Math.max(this.bounds.maxZ, z);
    const index = this.points.length / 3;
    this.points.push(x, y, z);
    this.normalData.push(n[0] * this.cosine - n[1] * this.sine, n[0] * this.sine + n[1] * this.cosine, n[2]);
    this.texels.push(uv6[0], uv6[1]);
    return index;
  }
  quad(a, b, c, d, material, uvs, wanted, region = 0) {
    const triangle = (p, q, r, up, uq, ur) => {
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const size = Math.hypot(nx, ny, nz);
      if (size < 1e-6) return;
      nx /= size;
      ny /= size;
      nz /= size;
      if (wanted && nx * wanted[0] + ny * wanted[1] + nz * wanted[2] < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const normal = [nx, ny, nz];
      this.triangles.push(this.vertex(p, up, normal), this.vertex(q, uq, normal), this.vertex(r, ur, normal));
      this.slots.push(material);
      this.regions.push(region);
    };
    triangle(a, b, c, uvs[0], uvs[1], uvs[2]);
    triangle(a, c, d, uvs[0], uvs[2], uvs[3]);
  }
  joint(p) {
    this.joints.push({
      index: this.joints.length,
      x: this.spec.x + p[0] * this.cosine - p[1] * this.sine,
      y: this.spec.y + p[0] * this.sine + p[1] * this.cosine,
      z: p[2]
    });
  }
  beginGroundEdges() {
    this.groundEdgeStart = Object.freeze({ vertex: this.points.length / 3, triangle: this.slots.length });
  }
  finish() {
    const heightScale = this.spec.height / Math.max(1, this.bounds.maxZ);
    for (let i = 0; i < this.points.length; i += 3) {
      this.points[i + 2] = this.points[i + 2] * heightScale;
      const nx = this.normalData[i], ny = this.normalData[i + 1], nz = this.normalData[i + 2] / heightScale;
      const length2 = Math.hypot(nx, ny, nz) || 1;
      this.normalData[i] = nx / length2;
      this.normalData[i + 1] = ny / length2;
      this.normalData[i + 2] = nz / length2;
    }
    for (const joint of this.joints) joint.z *= heightScale;
    this.bounds.maxZ = this.spec.height;
    return {
      spec: Object.freeze({ ...this.spec }),
      positions: new Float32Array(this.points),
      normals: new Float32Array(this.normalData),
      uv: new Float32Array(this.texels),
      indices: new Uint32Array(this.triangles),
      materials: new Uint8Array(this.slots),
      regions: new Uint8Array(this.regions),
      vertexCount: this.points.length / 3,
      triangleCount: this.slots.length,
      ...this.groundEdgeStart ? { groundEdgeStart: this.groundEdgeStart } : {},
      bounds: Object.freeze(this.bounds),
      joints: this.joints
    };
  }
};
function foldedSlab(b) {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const shift = (phase(s.seed, 101) - 0.5) * 0.05;
  const thrust = (s.fold - 0.5) * 0.075;
  const px = (x) => (x + shift) * l;
  const py = (y) => y * w;
  const near = (ratio) => Math.min(h * ratio, 19 + s.thickness * 0.22);
  const a = [
    [-l * 0.51, py(-0.14), 0],
    [-l * 0.37, py(-0.37), h * 0.33],
    [px(-0.15), py(-0.43), h * 0.6424],
    [px(0.025), py(-0.2), h * 0.486],
    [px(-0.014), py(0.058 + thrust), near(0.31056 - thrust * 0.68)],
    [px(-0.19), py(0.235), near(0.1902)],
    [-l * 0.42, py(0.135), h * 0.025]
  ];
  const c = [
    [px(0.035), py(-0.3), h * 0.7028],
    [px(0.22), py(-0.49), h * 0.9836],
    [l * 0.49, py(-0.27), h * 0.16],
    [l * 0.46, py(-5e-3), h * 0.025],
    [px(0.24), py(0.095), near(0.1662)],
    [px(0.085), py(-0.025), near(0.3218)]
  ];
  const outlet = [
    [px(-0.26), py(0.3), near(0.11)],
    [px(-0.075), py(0.135 + thrust), near(0.21)],
    [px(0.09), py(0.13 + thrust), near(0.19)],
    [px(0.265), py(0.35), near(0.08)],
    [px(0.095), py(0.535), 0],
    [px(-0.15), py(0.49), h * 0.018]
  ];
  const plane = (outline, peak, dx, dy) => {
    const depth = outline.map((p) => p[0] * dx + p[1] * dy), min = Math.min(...depth), span = Math.max(...depth) - min;
    for (let i = 0; i < outline.length; i++) outline[i] = [outline[i][0], outline[i][1], (depth[i] - min) / span * peak];
    const x = outline.reduce((n, p) => n + p[0], 0) / outline.length, y = outline.reduce((n, p) => n + p[1], 0) / outline.length;
    return [x, y, (x * dx + y * dy - min) / span * peak];
  };
  const aCentre = plane(a, h * 0.73, 0.16, -1);
  const cCentre = plane(c, h, -0.35, -1);
  const outletCentre = plane(outlet, near(0.25), 0.13, -1);
  bedMass(b, a, aCentre, 0, [3, 4], Math.min(24, Math.max(9, w * 0.12)));
  bedMass(b, c, cCentre, 1, [4, 5], Math.min(21, Math.max(8, w * 0.105)));
  bedMass(b, outlet, outletCentre, 2, [0, 1], Math.min(17, Math.max(7, w * 0.085)));
}
function bedMass(b, top, centre, salt, faultEdges, cutWidth) {
  const n = top.length, s = b.spec;
  const lerp2 = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  const footHeight = s.blocking === 1 ? Math.min(s.height * 0.42, 8.5 + salt * 0.9 + phase(s.seed, 810 + salt) * 1.2) : 0;
  const lift = (p) => footHeight > 0 ? [p[0], p[1], footHeight + p[2] * (1 - footHeight / s.height)] : p;
  const surfaceCentre = lift(centre);
  const rim = [];
  let distance2 = 0;
  const mouthPeak = 0.43 + phase(s.seed, 700 + salt) * 0.16;
  for (let i = 0; i < n; i++) {
    const p = top[i], q = top[(i + 1) % n], rank = faultEdges.indexOf(i), fault = rank >= 0;
    const subdivisions = fault ? 5 : 1;
    const edgeLength = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions, at2 = lerp2(p, q, t), along = (rank + t) / faultEdges.length;
      const lobe = fault ? clamp2(along < mouthPeak ? along / mouthPeak : (1 - along) / (1 - mouthPeak), 0, 1) : 0;
      const mouth = lobe * lobe * (3 - 2 * lobe);
      const radius = Math.hypot(at2[0] - centre[0], at2[1] - centre[1]) || 1;
      const nx = (at2[0] - centre[0]) / radius, ny = (at2[1] - centre[1]) / radius;
      const inset = cutWidth * mouth * (salt === 2 ? 0.52 : 0.78);
      let lip = lerp2(at2, centre, Math.min(0.26, inset / radius));
      const burial = clamp2(at2[2] / Math.max(3, s.height * 0.16), 0, 1);
      const spread = cutWidth * burial * (fault ? 0.13 + mouth * 1.8 : 0.26);
      const foot = [at2[0] + nx * spread, at2[1] + ny * spread, 0];
      if (footHeight > 0) {
        const sectionWidth = 6.5 + phase(s.seed, 830 + salt) * 1.5 + (at2[0] / s.length + 0.5) * 1.1 + mouth * 0.8;
        const run = Math.hypot(lip[0] - foot[0], lip[1] - foot[1]);
        const lowEnd = 1 - clamp2(at2[2] / (footHeight * 2), 0, 1);
        const toCentre = Math.hypot(lip[0] - centre[0], lip[1] - centre[1]) || 1;
        lip = lerp2(lip, centre, clamp2((sectionWidth - run) * lowEnd / toCentre, 0, 0.34));
      }
      const shoulder = lift(lerp2(lip, centre, Math.min(0.34, (5 + cutWidth * 0.7) * mouth / radius)));
      lip = lift(lip);
      rim.push({ top: lip, foot, shoulder, mouth, distance: distance2 + edgeLength * t, fault });
    }
    distance2 += edgeLength;
  }
  let contactPlaced = false;
  for (let i = 0; i < rim.length; i++) {
    const next = (i + 1) % rim.length, a = rim[i], c = rim[next];
    const region = salt === 2 ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.intact;
    const topUv = (p) => [p[0], p[1]];
    b.quad(
      surfaceCentre,
      a.shoulder,
      c.shoulder,
      surfaceCentre,
      0,
      [topUv(surfaceCentre), topUv(a.shoulder), topUv(c.shoulder), topUv(surfaceCentre)],
      [0, 0, 1],
      region
    );
    b.quad(
      a.shoulder,
      a.top,
      c.top,
      c.shoulder,
      0,
      [topUv(a.shoulder), topUv(a.top), topUv(c.top), topUv(c.shoulder)],
      [0, 0, 1],
      NATIVE_VOLUME_REGIONS.peeled
    );
    const endDistance = next === 0 ? distance2 : c.distance;
    const sideUv = (p, d) => [d, p[2]];
    const open = a.fault && Math.max(a.mouth, c.mouth) > 0.08;
    b.quad(
      a.top,
      a.foot,
      c.foot,
      c.top,
      open ? 1 : 0,
      [sideUv(a.top, a.distance), sideUv(a.foot, a.distance), sideUv(c.foot, endDistance), sideUv(c.top, endDistance)],
      [0, 0, 1],
      open ? NATIVE_VOLUME_REGIONS.fractured : region
    );
    b.quad(
      [centre[0], centre[1], 0],
      c.foot,
      a.foot,
      [centre[0], centre[1], 0],
      2,
      [topUv(centre), topUv(c.foot), topUv(a.foot), topUv(centre)],
      [0, 0, -1],
      NATIVE_VOLUME_REGIONS.intact
    );
    if (salt === 0 && !contactPlaced && a.fault && a.mouth > 0.5 && c.mouth > a.mouth) {
      const point = (t, v) => [
        a.top[0] + t * (c.foot[0] - a.top[0]) + v * (a.foot[0] - a.top[0]),
        a.top[1] + t * (c.foot[1] - a.top[1]) + v * (a.foot[1] - a.top[1]),
        a.top[2] + t * (c.foot[2] - a.top[2]) + v * (a.foot[2] - a.top[2]) + 0.055
      ];
      const p0 = point(0.08, 0.08), p1 = point(0.46, 0.08), p2 = point(0.46, 0.42), p3 = point(0.08, 0.42);
      b.quad(p0, p3, p2, p1, 3, [[0, 0], [0, 6], [12, 6], [12, 0]], [0, 0, 1], NATIVE_VOLUME_REGIONS.compressed);
      b.joint([(p0[0] + p1[0] + p2[0] + p3[0]) * 0.25, (p0[1] + p1[1] + p2[1] + p3[1]) * 0.25, (p0[2] + p1[2] + p2[2] + p3[2]) * 0.25]);
      contactPlaced = true;
    }
  }
}
function fibreKnot(b) {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const knotX = l * (-0.08 + (phase(s.seed, 211) - 0.5) * 0.045), knotY = w * (0.05 + 0.12 * s.distortion + (phase(s.seed, 213) - 0.5) * 0.035);
  const main = [
    [-l * 0.51, -w * 0.16, s.thickness * 0.6],
    [-l * 0.3, -w * 0.08, h * 0.27],
    [knotX, knotY, h * 0.57],
    [l * 0.18, w * 0.02, h * 0.38],
    [l * 0.5, w * 0.19, s.thickness * 0.63]
  ];
  sweptBundle(b, main, w * 0.145, 0);
  const cross4 = [
    [-l * 0.24, w * 0.48, s.thickness * 0.44],
    [-l * 0.18, w * 0.28, h * 0.29],
    [knotX + w * 0.07, knotY, h * 0.82],
    [l * 0.04, -w * 0.15, h * 0.45],
    [l * 0.15, -w * 0.46, s.thickness * 0.51]
  ];
  sweptBundle(b, cross4, w * 0.08, 1);
  if (s.branches >= 3) {
    const subordinate = [
      [l * 0.41, -w * 0.38, s.thickness * 0.36],
      [l * 0.2, -w * 0.16, h * 0.25],
      [knotX + w * 0.06, knotY - w * 0.045, h * 0.69],
      [-l * 0.13, w * 0.26, h * 0.35]
    ];
    sweptBundle(b, subordinate, w * 0.047, 2);
  }
  b.joint([knotX + w * 0.04, knotY, h * 0.84]);
}
function sweptBundle(b, spine, radius, salt) {
  const s = b.spec, cross4 = 18, steps = (spine.length - 1) * 8;
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const whole = i / steps * (spine.length - 1), segment = Math.min(spine.length - 2, Math.floor(whole));
    const t = i === steps ? 1 : whole - segment;
    const a = spine[segment], c = spine[segment + 1];
    const before = spine[Math.max(0, segment - 1)], after = spine[Math.min(spine.length - 1, segment + 2)];
    const curve = (channel2, q) => 0.5 * (2 * a[channel2] + (-before[channel2] + c[channel2]) * q + (2 * before[channel2] - 5 * a[channel2] + 4 * c[channel2] - after[channel2]) * q * q + (-before[channel2] + 3 * a[channel2] - 3 * c[channel2] + after[channel2]) * q * q * q);
    const tangent = (channel2) => 0.5 * (-before[channel2] + c[channel2] + 2 * (2 * before[channel2] - 5 * a[channel2] + 4 * c[channel2] - after[channel2]) * t + 3 * (-before[channel2] + 3 * a[channel2] - 3 * c[channel2] + after[channel2]) * t * t);
    const dx = tangent(0), dy = tangent(1), len = Math.hypot(dx, dy) || 1;
    const vx = -dy / len, vy = dx / len, along = i / steps;
    const clampWidth = 1 - Math.exp(-Math.pow((along - 0.5) / 0.16, 2)) * (salt === 0 ? 0.3 : 0.12);
    const rootTaper = 0.28 + Math.pow(Math.sin(along * Math.PI), 0.7) * 0.75;
    const r = radius * rootTaper * clampWidth;
    const cx = curve(0, t), cy = curve(1, t), cz = Math.max(r * (s.constructionVersion === 2 ? 0.78 : 0.62), curve(2, t));
    const ring = [];
    for (let j = 0; j < cross4; j++) {
      const angle = j / cross4 * TAU2;
      const root = Math.pow(Math.abs(along - 0.5) * 2, 5);
      const flute = 1 + Math.cos(angle * 5 + salt + along * 3) * (0.045 + 0.07 * root);
      ring.push([
        cx + vx * Math.cos(angle) * r * flute,
        cy + vy * Math.cos(angle) * r * flute,
        cz + Math.sin(angle) * r * (0.57 + 0.19 * Math.sin(along * Math.PI))
      ]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < cross4; j++) {
    const a = rings[i], c = rings[i + 1], k = (j + 1) % cross4;
    const slot = salt > 0 && i > steps * 0.45 && i < steps * 0.54 && j > 2 && j < 5 ? 3 : 0;
    b.quad(
      a[j],
      c[j],
      c[k],
      a[k],
      slot,
      [
        [i * s.length / steps, j * radius * TAU2 / cross4],
        [(i + 1) * s.length / steps, j * radius * TAU2 / cross4],
        [(i + 1) * s.length / steps, (j + 1) * radius * TAU2 / cross4],
        [i * s.length / steps, (j + 1) * radius * TAU2 / cross4]
      ]
    );
    if (s.constructionVersion === 2 && salt === 1 && i === Math.floor(steps * 0.5) && j === 3) {
      b.joint([
        (a[j][0] + c[j][0] + c[k][0]) / 3,
        (a[j][1] + c[j][1] + c[k][1]) / 3,
        (a[j][2] + c[j][2] + c[k][2]) / 3 + 0.055
      ]);
    }
  }
  for (const end of [0, steps]) {
    const r = rings[end];
    const middle = [
      r.reduce((sum, p) => sum + p[0], 0) / cross4,
      r.reduce((sum, p) => sum + p[1], 0) / cross4,
      r.reduce((sum, p) => sum + p[2], 0) / cross4
    ];
    for (let j = 0; j < cross4; j++) {
      const k = (j + 1) % cross4;
      b.quad(middle, r[j], r[k], middle, end === 0 ? 1 : 2, [[0, 0], [j, radius], [j + 1, radius], [0, 0]]);
    }
  }
}
function brokenShell(b) {
  const s = b.spec;
  const gap = 0.82 + s.opening * 1.35;
  shellPetal(b, -s.length * 0.06, -s.width * 0.045, s.length * 0.49, s.width * 0.47, gap * 0.5, TAU2 - gap, 1, 0);
  shellPetal(
    b,
    s.length * 0.22,
    s.width * 0.16,
    s.length * 0.25,
    s.width * 0.31,
    Math.PI * 1.1,
    Math.PI * (1.08 + s.fold * 0.13),
    0.68,
    1
  );
  b.joint([s.length * 0.22, s.width * 0.02, s.height * 0.34]);
}
function shellPetal(b, ox, oy, rx, ry, begin, sweep, heightScale, salt) {
  const s = b.spec, around = 54, radial = 16, seedPhase = phase(s.seed, 53 + salt) * TAU2;
  const rings = [];
  for (let i = 0; i <= around; i++) {
    const angle = begin + i / around * sweep, ca = Math.cos(angle), sa = Math.sin(angle);
    const jointCompression = Math.exp(-Math.pow((i / around - 0.78) / 0.2, 2));
    const lip = 1 + 0.12 * s.distortion * Math.sin(angle * 2 + seedPhase) - jointCompression * 0.1 + 0.045 * Math.sin(angle * 9 + salt);
    const rimZ = s.height * heightScale * (0.6 + 0.26 * Math.sin(angle - 0.5) + 0.12 * Math.cos(angle * 2 + seedPhase));
    const thickness = clamp2(s.thickness / Math.min(rx, ry), 0.1, 0.42);
    const rimInner = 0.69 - thickness * 0.43;
    const profile = [
      [1, 0],
      [0.96, rimZ * 0.22],
      [0.84 * lip, rimZ * 0.68],
      [0.73 * lip, rimZ],
      [rimInner, rimZ * 0.94],
      [rimInner - 0.09, rimZ * 0.6],
      [0.31, rimZ * 0.14],
      [0.15, s.thickness * 0.17],
      [0, s.thickness * 0.13]
    ];
    const ring = [];
    for (let j = 0; j <= radial; j++) {
      const f = j / radial * (profile.length - 1), a = Math.floor(f), t = f - a;
      const p = profile[a], q = profile[Math.min(a + 1, profile.length - 1)];
      const r = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
      const inner = 1 - r;
      const flare = Math.exp(-Math.pow((angle - (begin + 0.32)) / 0.35, 2)) * s.fold;
      ring.push([
        ox + ca * rx * r + inner * rx * (0.24 + s.distortion * 0.17) + flare * rx * 0.1 * r,
        oy + sa * ry * r - inner * ry * (0.13 + s.distortion * 0.08),
        z * (1 - flare * 0.34) * (1 + 0.07 * Math.sin(angle * 7 + seedPhase) * r)
      ]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < around; i++) for (let j = 0; j < radial; j++) {
    const a = rings[i], c = rings[i + 1];
    const slot = j < 6 ? 0 : j < 8 ? 1 : j < 13 ? 2 : 0;
    b.quad(
      a[j],
      c[j],
      c[j + 1],
      a[j + 1],
      salt === 1 && i < 4 && j >= 7 && j < 12 ? 3 : slot,
      [
        [i / around * sweep * (rx + ry) * 0.5, j / radial * s.width],
        [(i + 1) / around * sweep * (rx + ry) * 0.5, j / radial * s.width],
        [(i + 1) / around * sweep * (rx + ry) * 0.5, (j + 1) / radial * s.width],
        [i / around * sweep * (rx + ry) * 0.5, (j + 1) / radial * s.width]
      ],
      [0, 0, 1]
    );
  }
  for (const end of [0, around]) {
    const ring = rings[end];
    for (let j = 0; j < radial; j++) {
      const a = ring[j], c = ring[j + 1];
      const sign = end === 0 ? -1 : 1, angle = begin + end / around * sweep;
      const dx = -Math.sin(angle) * s.thickness * 0.72 * sign, dy = Math.cos(angle) * s.thickness * 0.72 * sign;
      b.quad(
        a,
        c,
        [c[0] + dx, c[1] + dy, 0],
        [a[0] + dx, a[1] + dy, 0],
        1,
        [[j * s.width / radial, a[2]], [(j + 1) * s.width / radial, c[2]], [(j + 1) * s.width / radial, 0], [j * s.width / radial, 0]],
        [0, 0, 1]
      );
    }
  }
}
function granularRidge(b) {
  const s = b.spec, along = 30, across = 14, rows = [];
  const authored = s.constructionVersion === 2;
  const clusters = Array.from({ length: s.branches + 3 }, (_, i) => ({
    x: (i + 0.25 + phase(s.seed, 910 + i) * 0.5) / (s.branches + 3),
    y: 0.24 + phase(s.seed, 950 + i) * 0.5,
    span: 0.09 + phase(s.seed, 980 + i) * 0.08,
    rise: 0.1 + phase(s.seed, 1010 + i) * 0.2
  }));
  for (let i = 0; i <= along; i++) {
    const u = i / along, taper = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * u), authored ? 0.25 + s.opening * 0.9 : 0.48), row = [];
    const spine = Math.sin(u * (authored ? 2.2 + s.fold * 3 : 4.5) + phase(s.seed, 897) * 2) * s.width * (authored ? 0.025 + s.distortion * 0.13 : 0.11);
    for (let j = 0; j <= across; j++) {
      const v = j / across, edge = Math.min(u * along, (1 - u) * along, v * across, (1 - v) * across);
      const foot = Math.min(1, edge), peak = (authored ? 0.28 + s.fold * 0.3 : 0.43) + 0.08 * Math.sin(u * 5.4);
      const side = v < peak ? v / peak : (1 - v) / (1 - peak);
      let rise = Math.pow(Math.max(0, side), authored ? 0.48 + s.fold * 1.2 : 0.86) * (0.51 + 0.16 * Math.sin(u * 4 + 1));
      for (const c of clusters) {
        const distance2 = Math.abs(u - c.x) / c.span + Math.abs(v - c.y) / 0.26;
        rise += Math.max(0, 1 - distance2) * c.rise * (authored ? 0.45 + s.distortion * 2 : 1);
      }
      const z = (s.blocking === 1 ? Math.min(8, s.height * 0.26) * foot : 0) + s.height * rise * foot * Math.pow(Math.sin(Math.PI * u), 0.34);
      row.push([(u - 0.5) * s.length, (v - 0.5) * s.width * taper + spine, z]);
    }
    rows.push(row);
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
    const cut = j === 0 || j === across - 1 || i === 0 || i === along - 1;
    const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
    b.quad(
      a,
      c,
      d,
      e,
      cut ? 1 : j > 8 ? 2 : 0,
      [
        [i * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, (j + 1) * s.width / across],
        [i * s.length / along, (j + 1) * s.width / across]
      ],
      [0, 0, 1],
      cut ? NATIVE_VOLUME_REGIONS.fractured : j < 6 ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.intact
    );
  }
  surfaceFracture(b, rows, [[10.1, 5.9], [11.8, 6.1], [12.5, 5.6], [14.2, 5.8], [15.1, 6.4], [17.4, 6.2]], 0.085);
}
function membraneRim(b) {
  const s = b.spec, around = 46, radial = 12, rows = [];
  const begin = 0.2 + s.opening * 0.3, sweep = TAU2 - (1.35 + s.opening * 1.15), offset = phase(s.seed, 1131) * 1.4;
  for (let i = 0; i <= around; i++) {
    const angle = begin + i / around * sweep, ca = Math.cos(angle), sa = Math.sin(angle);
    const uneven = 1 + 0.13 * Math.sin(angle * 3 + offset) + 0.06 * Math.cos(angle * 5 - 0.3);
    const crown = s.height * (0.64 + 0.24 * Math.sin(angle + 0.8) + 0.09 * Math.cos(angle * 2 + offset));
    const profile = [
      [1, 0],
      [0.955, s.blocking === 1 ? Math.min(crown * 0.35, 9) : crown * 0.05],
      [0.875, crown * 0.82],
      [0.78, crown],
      [0.69, crown * 0.62],
      [0.54, crown * 0.15],
      [0, crown * 0.075]
    ];
    const row = [];
    for (let j = 0; j <= radial; j++) {
      const q = j / radial * (profile.length - 1), n = Math.floor(q), f = q - n;
      const p = profile[n], next = profile[Math.min(n + 1, profile.length - 1)];
      const r = p[0] + (next[0] - p[0]) * f, z = p[1] + (next[1] - p[1]) * f;
      const tension = j > 8 ? Math.sin(angle * 11 + r * 5) * s.thickness * 0.12 * r : 0;
      row.push([ca * s.length * 0.5 * r * uneven + (1 - r) * s.length * 0.1, sa * s.width * 0.49 * r * uneven - (1 - r) * s.width * 0.17, z + tension]);
    }
    rows.push(row);
  }
  for (let i = 0; i < around; i++) for (let j = 0; j < radial; j++) {
    const a = rows[i], c = rows[i + 1];
    const slot = j < 2 ? 1 : j < 8 ? 0 : 2;
    b.quad(
      a[j],
      c[j],
      c[j + 1],
      a[j + 1],
      slot,
      [
        [i * s.length / around, j * s.width / radial],
        [(i + 1) * s.length / around, j * s.width / radial],
        [(i + 1) * s.length / around, (j + 1) * s.width / radial],
        [i * s.length / around, (j + 1) * s.width / radial]
      ],
      [0, 0, 1],
      j > 7 ? NATIVE_VOLUME_REGIONS.tension : NATIVE_VOLUME_REGIONS.intact
    );
  }
  surfaceFracture(b, rows, [[12.2, 2.8], [13.5, 3.3], [13.2, 4.4], [14.1, 5], [13.7, 6.3], [14.6, 7.6], [14.4, 8.7]], 0.095);
  for (const i of [0, around]) for (let j = 0; j < radial; j++) {
    const a = rows[i][j], c = rows[i][j + 1], angle = begin + i / around * sweep, sign = i === 0 ? -1 : 1;
    const dx = -Math.sin(angle) * s.thickness * 0.3 * sign, dy = Math.cos(angle) * s.thickness * 0.3 * sign;
    b.quad(
      a,
      c,
      [c[0] + dx, c[1] + dy, 0],
      [a[0] + dx, a[1] + dy, 0],
      1,
      [[j * s.width / radial, a[2]], [(j + 1) * s.width / radial, c[2]], [(j + 1) * s.width / radial, 0], [j * s.width / radial, 0]],
      [0, 0, 1],
      NATIVE_VOLUME_REGIONS.fractured
    );
  }
}
function gelFlow(b) {
  const s = b.spec, along = 32, across = 20, rows = [];
  const profile = [[0, 0], [0.08, 0.11], [0.33, 0.19], [0.58, 0.38], [0.78, 0.78], [0.88, 1], [0.95, 0.52], [1, 0]];
  for (let i = 0; i <= along; i++) {
    const u = i / along, side = Math.pow(Math.sin(Math.PI * u), 0.35), lobes = 0.12 * Math.sin(u * 13 + phase(s.seed, 1207) * 2) + 0.055 * Math.sin(u * 27 + 0.5);
    const row = [];
    for (let j = 0; j <= across; j++) {
      const v = j / across;
      let p = 0;
      while (p + 1 < profile.length && profile[p + 1][0] < v) p++;
      const a = profile[p], c = profile[Math.min(p + 1, profile.length - 1)], f = (v - a[0]) / Math.max(1e-3, c[0] - a[0]);
      const ridge = a[1] + (c[1] - a[1]) * f, edge = Math.min(u * along, (1 - u) * along, v * across, (1 - v) * across);
      const foot = s.blocking === 1 ? Math.min(s.height * 0.22, 7) * Math.min(1, edge) : 0;
      row.push([
        (u - 0.5) * s.length + (v - 0.5) * s.length * 0.08,
        (v - 0.5) * s.width * (0.3 + side * 0.7) + Math.pow(v, 3) * lobes * s.width,
        foot + ridge * s.height * side * (0.75 + 0.19 * Math.sin(u * 8 + 0.2))
      ]);
    }
    rows.push(row);
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
    const front = j >= 18, thin = j <= 6;
    const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
    b.quad(
      a,
      c,
      d,
      e,
      front ? 1 : thin ? 2 : 0,
      [
        [i * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, (j + 1) * s.width / across],
        [i * s.length / along, (j + 1) * s.width / across]
      ],
      [0, 0, 1],
      thin ? NATIVE_VOLUME_REGIONS.peeled : front ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.glazed
    );
  }
  surfaceFracture(b, rows, [[10.2, 17.4], [11.5, 17.1], [12.1, 17.7], [13.8, 17.8], [14.4, 18.3], [16.5, 18.1]], 0.09);
}
function shearedBeds(b) {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const gap = Math.min(w * 0.4, Math.max(30, w * (0.12 + s.opening * 0.15)));
  const shear = l * (0.025 + s.distortion * 0.1), skew = (phase(s.seed, 1301) - 0.5) * w * 0.05;
  const upper = [
    [-l * 0.5, -w * 0.27, 0],
    [-l * 0.36, -w * 0.5, 0],
    [l * 0.36 - shear, -w * 0.44, 0],
    [l * 0.5 - shear, -gap * 0.56 + skew, 0],
    [l * 0.12 - shear, -gap * 0.5 + skew, 0],
    [-l * 0.42, -gap * 0.6, 0]
  ];
  const lower = [
    [-l * 0.43 + shear, gap * 0.62, 0],
    [-l * 0.04 + shear, gap * 0.5 + skew, 0],
    [l * 0.48, gap * 0.6, 0],
    [l * 0.44, w * 0.43, 0],
    [l * 0.16, w * 0.5, 0],
    [-l * 0.5 + shear, w * 0.36, 0]
  ];
  const incline = (outline, peak, dx, dy) => {
    let min = Infinity, max = -Infinity;
    for (const p of outline) {
      const q = p[0] * dx + p[1] * dy;
      min = Math.min(min, q);
      max = Math.max(max, q);
    }
    let x = 0, y = 0;
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i];
      x += p[0];
      y += p[1];
      outline[i] = [p[0], p[1], (p[0] * dx + p[1] * dy - min) / (max - min) * peak];
    }
    x /= outline.length;
    y /= outline.length;
    return [x, y, (x * dx + y * dy - min) / (max - min) * peak];
  };
  bedMass(b, upper, incline(upper, h, 0.12, -1), 0, [3, 4], Math.min(6, w * 0.024));
  bedMass(b, lower, incline(lower, h * (0.32 + s.fold * 0.5), -0.1, 1), 1, [0, 1], Math.min(5, w * 0.022));
  if (s.branches >= 5) {
    const toe = [[-l * 0.42, w * 0.39, 0], [-l * 0.14, w * 0.42, 0], [-l * 0.05, w * 0.57, 0], [-l * 0.36, w * 0.59, 0]];
    bedMass(b, toe, incline(toe, h * 0.17, 0.2, -1), 2, [0, 1], Math.min(8, w * 0.03));
  }
}
function tensileBranches(b) {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const pull = s.fold, joinX = l * (-0.18 + 0.18 * s.opening), joinY = w * (phase(s.seed, 1321) - 0.5) * 0.1;
  const radius = Math.max(s.thickness * 0.65, w * (0.068 + 0.028 * (1 - pull)));
  const main = [
    [-l * 0.52, -w * 0.08, s.thickness * 0.65],
    [-l * 0.28, -w * 0.04, h * 0.43],
    [joinX, joinY, h * 0.72],
    [l * 0.25, w * (0.03 + 0.1 * s.distortion), h * 0.48],
    [l * 0.52, w * 0.14, s.thickness * 0.72]
  ];
  sweptBundle(b, main, radius, 0);
  for (let arm = 1; arm < s.branches; arm++) {
    const side = arm % 2 === 1 ? -1 : 1, rank = Math.floor((arm - 1) / 2), spread = 0.27 + rank * 0.12;
    const attachX = joinX + l * (rank * 0.07 - 0.025), attachY = joinY + w * rank * 0.018;
    const endX = l * (0.46 - rank * 0.11) * (arm % 3 === 0 ? -1 : 1);
    const endY = side * w * Math.min(0.5, spread + s.opening * 0.18);
    const branch = [
      [attachX - l * 0.1, attachY, h * 0.55],
      [attachX, attachY, h * (0.74 - rank * 0.06)],
      [attachX + (endX - attachX) * 0.55, endY * (0.37 + 0.3 * (1 - pull)), h * (0.4 - rank * 0.03)],
      [endX, endY, s.thickness * (0.46 + 0.06 * rank)]
    ];
    sweptBundle(b, branch, radius * (0.7 - rank * 0.085), arm);
  }
}
function openShellWall(b) {
  const s = b.spec, around = 56, radial = 8, rows = [];
  const gap = 0.76 + s.opening * 2.4, begin = gap * 0.5, sweep = TAU2 - gap;
  const inner = 0.43 + s.opening * 0.19, phaseOffset = phase(s.seed, 1351) * TAU2;
  for (let i = 0; i <= around; i++) {
    const u = i / around, angle = begin + u * sweep, ca = Math.cos(angle), sa = Math.sin(angle);
    const uneven = 1 + s.distortion * (0.075 * Math.sin(angle * 2 + phaseOffset) + 0.035 * Math.sin(angle * 5));
    const crown = s.height * (0.66 + 0.23 * Math.sin(angle + 0.7) + 0.09 * Math.cos(angle * 2 + phaseOffset));
    const foot = s.blocking === 1 ? Math.min(9, s.height * 0.3) : s.height * 0.05;
    const lip = 0.82 - s.fold * 0.07;
    const profile = [
      [1, 0],
      [0.97, foot],
      [0.91, crown * 0.58],
      [lip, crown],
      [lip - 0.045, crown * 0.97],
      [inner + 0.075, crown * 0.72],
      [inner + 0.025, foot],
      [inner, 0],
      [inner, 0]
    ];
    rows.push(profile.map(([r, z]) => [
      ca * s.length * 0.5 * r * uneven + (1 - r) * s.length * s.distortion * 0.07,
      sa * s.width * 0.5 * r * uneven,
      z
    ]));
  }
  for (let i = 0; i < around; i++) for (let j = 0; j < radial; j++) {
    const a = rows[i], c = rows[i + 1], joint = i === Math.floor(around * 0.69) && j === 4;
    const slot = joint ? 3 : j < 3 ? 0 : j < 5 ? 1 : 2;
    b.quad(a[j], c[j], c[j + 1], a[j + 1], slot, [
      [i * s.length / around, j * s.width / radial],
      [(i + 1) * s.length / around, j * s.width / radial],
      [(i + 1) * s.length / around, (j + 1) * s.width / radial],
      [i * s.length / around, (j + 1) * s.width / radial]
    ], [0, 0, 1], j < 3 ? NATIVE_VOLUME_REGIONS.intact : j < 5 ? NATIVE_VOLUME_REGIONS.fractured : NATIVE_VOLUME_REGIONS.glazed);
    if (joint) b.joint([(a[j][0] + c[j + 1][0]) * 0.5, (a[j][1] + c[j + 1][1]) * 0.5, (a[j][2] + c[j + 1][2]) * 0.5]);
  }
  for (const end of [0, around]) {
    const row = rows[end], angle = begin + end / around * sweep, sign = end === 0 ? -1 : 1;
    for (let j = 0; j < radial - 1; j++) {
      const a = row[j], c = row[j + 1], dx = -Math.sin(angle) * s.thickness * 0.4 * sign, dy = Math.cos(angle) * s.thickness * 0.4 * sign;
      b.quad(
        a,
        c,
        [c[0] + dx, c[1] + dy, 0],
        [a[0] + dx, a[1] + dy, 0],
        1,
        [[j * s.width / radial, a[2]], [(j + 1) * s.width / radial, c[2]], [(j + 1) * s.width / radial, 0], [j * s.width / radial, 0]],
        [0, 0, 1],
        NATIVE_VOLUME_REGIONS.fractured
      );
    }
  }
}
function tornMembrane(b) {
  const s = b.spec, along = 36, across = 12, rows = [];
  const tearAt = 0.36 + phase(s.seed, 1381) * 0.17, tearDepth = 0.3 + s.opening * 0.58;
  for (let i = 0; i <= along; i++) {
    const u = i / along, edgeTaper = 0.63 + 0.37 * Math.sin(Math.PI * u), row = [];
    const tear = tearDepth * Math.pow(Math.max(0, 1 - Math.abs(u - tearAt) / (0.11 + s.distortion * 0.045)), 0.72);
    const second = s.branches >= 5 ? tearDepth * 0.68 * Math.pow(Math.max(0, 1 - Math.abs(u - 0.79) / 0.08), 0.8) : 0;
    const front = 1 - Math.max(tear, second);
    for (let j = 0; j <= across; j++) {
      const v = j / across, local = v * front;
      const taut = Math.pow(Math.sin(Math.PI * u), 0.45), curl = Math.exp(-Math.pow((local - (0.16 + s.fold * 0.09)) / 0.18, 2));
      const fold = Math.pow(Math.max(0, Math.sin(u * Math.PI * (s.branches - 1) + local * 2)), 3) * s.distortion * 0.15;
      const foot = s.blocking === 1 ? Math.min(8, s.height * 0.3) : 0;
      const z = foot + s.height * taut * (curl * (0.5 + s.fold * 0.3) + 0.075 + fold) * (0.55 + 0.45 * Math.sin(Math.PI * v));
      row.push([(u - 0.5) * s.length, (local - 0.5) * s.width * edgeTaper, z]);
    }
    rows.push(row);
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
    const a = rows[i], c = rows[i + 1], slot = j < 3 ? 0 : j > 9 ? 1 : 2;
    b.quad(a[j], c[j], c[j + 1], a[j + 1], slot, [
      [i * s.length / along, j * s.width / across],
      [(i + 1) * s.length / along, j * s.width / across],
      [(i + 1) * s.length / along, (j + 1) * s.width / across],
      [i * s.length / along, (j + 1) * s.width / across]
    ], [0, 0, 1], j < 3 ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.tension);
  }
  const outline = [];
  for (let i = 0; i <= along; i++) outline.push(rows[i][0]);
  for (let j = 1; j <= across; j++) outline.push(rows[along][j]);
  for (let i = along - 1; i >= 0; i--) outline.push(rows[i][across]);
  for (let j = across - 1; j > 0; j--) outline.push(rows[0][j]);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], c = outline[(i + 1) % outline.length], dx = c[0] - a[0], dy = c[1] - a[1], length2 = Math.hypot(dx, dy) || 1;
    const width = s.blocking === 1 ? Math.min(6, s.thickness * 0.55) : 1.5, ox = dy / length2 * width, oy = -dx / length2 * width;
    b.quad(a, [a[0] + ox, a[1] + oy, 0], [c[0] + ox, c[1] + oy, 0], c, 1, [[0, a[2]], [0, 0], [length2, 0], [length2, c[2]]], [0, 0, 1], NATIVE_VOLUME_REGIONS.fractured);
  }
  surfaceFracture(b, rows, [[8.2, 3.4], [9.7, 4], [10.3, 4.5], [11.8, 4.8], [12.3, 5.4]], 0.085);
}
function pooledGel(b) {
  const s = b.spec, along = 38, across = 22, rows = [];
  const lobeCount = Math.max(2, s.branches - 1), offset = phase(s.seed, 1411) * 1.7;
  for (let i = 0; i <= along; i++) {
    const u = i / along, side = Math.pow(Math.sin(Math.PI * u), 0.28), row = [];
    const lobes = Math.pow(0.5 + 0.5 * Math.sin(u * Math.PI * 2 * lobeCount + offset), 2);
    const irregular = 0.045 * Math.sin(u * 19 + offset);
    for (let j = 0; j <= across; j++) {
      const v = j / across, edge = Math.min(u * along, (1 - u) * along, v * across, (1 - v) * across);
      const frontAt = 0.74 + s.opening * 0.13, front = Math.exp(-Math.pow((v - frontAt) / (0.09 + s.fold * 0.09), 2));
      const pool = 0.065 + Math.sin(Math.PI * v) * (0.09 + s.opening * 0.04);
      const ridge = front * (0.42 + s.fold * 0.39) * (0.6 + 0.4 * lobes);
      const foot = s.blocking === 1 ? Math.min(8, s.height * 0.28) * Math.min(1, edge) : 0;
      row.push([
        (u - 0.5) * s.length + (v - 0.5) * s.length * s.distortion * 0.1,
        (v - 0.5) * s.width * (0.5 + side * 0.5) + Math.pow(v, 4) * s.width * (lobes * (0.09 + s.distortion * 0.12) + irregular),
        foot + (pool + ridge) * s.height * side * Math.min(1, edge)
      ]);
    }
    rows.push(row);
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
    const a = rows[i], c = rows[i + 1], front = j >= across - 2, thin = j < across * 0.48;
    b.quad(
      a[j],
      c[j],
      c[j + 1],
      a[j + 1],
      front ? 1 : thin ? 2 : 0,
      [
        [i * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, (j + 1) * s.width / across],
        [i * s.length / along, (j + 1) * s.width / across]
      ],
      [0, 0, 1],
      front ? NATIVE_VOLUME_REGIONS.compressed : thin ? NATIVE_VOLUME_REGIONS.peeled : NATIVE_VOLUME_REGIONS.glazed
    );
  }
  surfaceFracture(b, rows, [[12.1, 17.4], [13.2, 17.8], [14.1, 17.7], [15.2, 18.1], [16.4, 18]], 0.09);
}
function surfaceFracture(b, rows, path, halfWidth) {
  const sample = (u, v) => {
    const i = clamp2(Math.floor(u), 0, rows.length - 2), j = clamp2(Math.floor(v), 0, rows[0].length - 2), a = u - i, t = v - j;
    const p = rows[i][j], q = rows[i + 1][j], r = rows[i + 1][j + 1], s = rows[i][j + 1];
    const weights = t <= a ? [1 - a, a - t, t, 0] : [1 - t, 0, a, t - a];
    return [
      p[0] * weights[0] + q[0] * weights[1] + r[0] * weights[2] + s[0] * weights[3],
      p[1] * weights[0] + q[1] * weights[1] + r[1] * weights[2] + s[1] * weights[3],
      p[2] * weights[0] + q[2] * weights[1] + r[2] * weights[2] + s[2] * weights[3] + 0.12
    ];
  };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], c = path[i], dx = c[0] - a[0], dy = c[1] - a[1], length2 = Math.hypot(dx, dy), px = -dy / length2 * halfWidth, py = dx / length2 * halfWidth;
    const uv6 = [[a[0] + px, a[1] + py], [c[0] + px, c[1] + py], [c[0] - px, c[1] - py], [a[0] - px, a[1] - py]];
    b.quad(sample(...uv6[0]), sample(...uv6[1]), sample(...uv6[2]), sample(...uv6[3]), 3, uv6, [0, 0, 1], NATIVE_VOLUME_REGIONS.fractured);
  }
  const centre = path[Math.floor(path.length / 2)];
  b.joint(sample(...centre));
}
function buildNativeVolume(spec, ground) {
  validateNativeVolumeSpec(spec);
  if (spec.groundEdgeWidth !== void 0 && !ground) throw new Error("Native ground edge is missing its authoritative terrain context");
  const builder = new MeshBuilder(spec);
  if (spec.constructionVersion === 4) buildGroundNativeVolume(builder);
  else if (spec.constructionVersion === 3) buildExpandedNativeVolume(builder);
  else if (spec.constructionVersion === 2) {
    if (spec.family === "folded-slab") shearedBeds(builder);
    else if (spec.family === "fibre-knot") tensileBranches(builder);
    else if (spec.family === "broken-shell") openShellWall(builder);
    else if (spec.family === "membrane-rim") tornMembrane(builder);
    else if (spec.family === "gel-flow") pooledGel(builder);
    else granularRidge(builder);
  } else if (spec.family === "folded-slab") foldedSlab(builder);
  else if (spec.family === "fibre-knot") fibreKnot(builder);
  else if (spec.family === "broken-shell") brokenShell(builder);
  else if (spec.family === "granular-ridge") granularRidge(builder);
  else if (spec.family === "membrane-rim") membraneRim(builder);
  else gelFlow(builder);
  if (spec.groundEdgeWidth !== void 0) {
    builder.beginGroundEdges();
    appendNativeGroundEdges(builder, ground);
  }
  const mesh = builder.finish();
  if (spec.constructionVersion === 4 && (spec.shapeProfile === "compressed-wedge" || spec.shapeProfile === "porous-break"))
    return smoothOrganizedSurface(mesh);
  return mesh;
}
var tau = Math.PI * 2;
var direction = (angle) => (angle % tau + tau) % tau;
var finitePoint = (point) => Boolean(point && typeof point === "object" && Number.isFinite(point.x) && Number.isFinite(point.y));
function validSearchSitePolicy(value, worldId) {
  if (!value || typeof value !== "object") return false;
  const p = value;
  return Object.keys(p).sort().join(",") === "algorithm,environmentScoreCap,footprintProfile,peelPreference,sourceHash,sourceReachPx,version,worldId" && p.version === 1 && p.algorithm === "grounded-search-v1" && p.worldId === worldId && /^[a-f0-9]{64}$/.test(p.sourceHash) && p.footprintProfile === "grounded-material-v1" && Number.isFinite(p.sourceReachPx) && p.sourceReachPx >= 24 && p.sourceReachPx <= 96 && Number.isFinite(p.environmentScoreCap) && p.environmentScoreCap >= 0 && p.environmentScoreCap <= 16 && Number.isFinite(p.peelPreference) && p.peelPreference >= 0 && p.peelPreference <= 1;
}
function segmentPoint(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length2));
  return { x: ax + t * dx, y: ay + t * dy };
}
function nearestFormation(world, point, reach, onlyObjectId) {
  let best = null, distance2 = reach;
  for (const mesh of world.meshes) {
    if (onlyObjectId !== void 0 && mesh.spec.id !== onlyObjectId) continue;
    const b = mesh.bounds;
    if (Math.hypot(Math.max(b.minX - point.x, 0, point.x - b.maxX), Math.max(b.minY - point.y, 0, point.y - b.maxY)) > distance2) continue;
    const p = mesh.positions, count = mesh.groundEdgeStart?.triangle ?? mesh.triangleCount;
    for (let face = 0; face < count; face++) {
      const a = mesh.indices[face * 3] * 3, c = mesh.indices[face * 3 + 1] * 3, d = mesh.indices[face * 3 + 2] * 3;
      const ax = p[a], ay = p[a + 1], bx = p[c], by = p[c + 1], cx = p[d], cy = p[d + 1];
      if (Math.hypot(
        Math.max(Math.min(ax, bx, cx) - point.x, 0, point.x - Math.max(ax, bx, cx)),
        Math.max(Math.min(ay, by, cy) - point.y, 0, point.y - Math.max(ay, by, cy))
      ) > distance2) continue;
      const cross4 = (x1, y1, x2, y2) => (x2 - x1) * (point.y - y1) - (y2 - y1) * (point.x - x1);
      const e0 = cross4(ax, ay, bx, by), e1 = cross4(bx, by, cx, cy), e2 = cross4(cx, cy, ax, ay);
      const area2 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const interior = Math.abs(area2) > 1e-7 && (e0 >= 0 && e1 >= 0 && e2 >= 0 || e0 <= 0 && e1 <= 0 && e2 <= 0);
      const candidates = interior ? [point] : [segmentPoint(point.x, point.y, ax, ay, bx, by), segmentPoint(point.x, point.y, bx, by, cx, cy), segmentPoint(point.x, point.y, cx, cy, ax, ay)];
      for (const candidate of candidates) {
        const gap = Math.hypot(candidate.x - point.x, candidate.y - point.y);
        if (gap > distance2 || gap === distance2 && best && mesh.spec.id >= best.mesh.spec.id || !world.matterAt(candidate.x, candidate.y) || !hasLineOfSight(world.sight, point, candidate, reach + 1e-3)) continue;
        best = { point: { x: candidate.x, y: candidate.y }, distance: gap, mesh };
        distance2 = gap;
      }
    }
  }
  return best;
}
var SearchSitePlanner = class {
  constructor(world, policy) {
    this.world = world;
    this.policy = policy;
    __publicField(this, "contexts", /* @__PURE__ */ new Map());
    __publicField(this, "meshes");
    this.meshes = new Map(world.meshes.map((mesh) => [mesh.spec.id, mesh]));
  }
  score(position) {
    return this.sample(position).score;
  }
  placement(nodeId, position) {
    return { nodeId, ...this.sample(position).site };
  }
  sample(position) {
    const key = `${position.x},${position.y}`, cached = this.contexts.get(key);
    if (cached) return cached;
    const world = this.world, policy = this.policy, r = world.raster;
    if (!world.matterAt(position.x, position.y)) throw new Error("Search-site core lacks actual terrain");
    const visualSeed = mix32(world.sample.seed, `grounded-search-v1:${key}`);
    const unit = mix32(visualSeed, "environment-relation") / 4294967296;
    const i = Math.floor(position.y) * r.width + Math.floor(position.x);
    const local = world.roleAt(position.x, position.y) === "relief" ? this.meshes.get(r.objectId[i]) : void 0;
    const nearby = local ? null : nearestFormation(world, position, policy.sourceReachPx);
    const detached = nearby && unit < 1 - nearby.distance / policy.sourceReachPx ? nearby : null;
    const formation = local ?? detached?.mesh;
    const sourceKind = local ? "surface-peel" : detached ? "detached" : mix32(visualSeed, "ground-layer-relation") / 4294967296 < policy.peelPreference ? "surface-peel" : "ground-accumulation";
    const site = {
      version: 1,
      position: { x: position.x, y: position.y },
      visualSeed,
      sourceKind,
      family: formation?.spec.family ?? world.definition.family,
      groundFamily: world.definition.family,
      sourceObjectId: formation?.spec.id ?? null,
      sourceAnchor: local ? { x: position.x, y: position.y } : detached?.point ?? null,
      sourceDomain: formation ? "formation" : "ground",
      axis: direction(formation?.spec.rotation ?? world.definition.axis),
      footprintProfile: policy.footprintProfile
    };
    const quality = detached ? 1 - detached.distance / policy.sourceReachPx : local ? 0.75 : sourceKind === "surface-peel" ? 0.45 : 0.25;
    const value = { site, score: Math.max(0, Math.min(policy.environmentScoreCap, quality * policy.environmentScoreCap)) };
    this.contexts.set(key, value);
    return value;
  }
};
function validateSearchSites(world) {
  if (world.algorithmRevision !== 9) {
    if (world.searchSites !== void 0) throw new Error("Historical world cannot acquire grounded search sites");
    return;
  }
  const nodes = [...world.layout.kindlingNodes, ...world.layout.contaminantNodes], sites = world.searchSites;
  if (!sites || sites.length !== nodes.length) throw new Error("Grounded search sites must cover every admitted node");
  const ids = /* @__PURE__ */ new Set(), instances = new Map(world.meshes.map((mesh) => [mesh.spec.id, mesh]));
  for (const site of sites) {
    if (!site || typeof site !== "object" || Object.keys(site).sort().join(",") !== "axis,family,footprintProfile,groundFamily,nodeId,position,sourceAnchor,sourceDomain,sourceKind,sourceObjectId,version,visualSeed") throw new Error("Unexpected grounded search-site fields");
    const node = nodes.find((node2) => node2.id === site.nodeId);
    if (!node || ids.has(site.nodeId) || site.version !== 1 || !finitePoint(site.position) || site.position.x !== node.position.x || site.position.y !== node.position.y || !world.matterAt(site.position.x, site.position.y) || !Number.isSafeInteger(site.visualSeed) || site.visualSeed < 0 || site.visualSeed > 4294967295 || !NATIVE_VOLUME_FAMILY_SEQUENCE.includes(site.family) || site.groundFamily !== world.definition.family || !["detached", "surface-peel", "ground-accumulation"].includes(site.sourceKind) || site.footprintProfile !== "grounded-material-v1" || !Number.isFinite(site.axis) || site.axis < 0 || site.axis >= tau) throw new Error("Invalid grounded search-site identity");
    ids.add(site.nodeId);
    if (site.visualSeed !== mix32(world.sample.seed, `grounded-search-v1:${site.position.x},${site.position.y}`)) throw new Error("Grounded search-site visual seed changed");
    if (site.sourceDomain === "ground") {
      if (site.sourceObjectId !== null || site.sourceAnchor !== null || site.family !== site.groundFamily || site.sourceKind === "detached" || site.axis !== direction(world.definition.axis)) throw new Error("Ground site claims a fictitious formation or material direction");
    } else if (site.sourceDomain === "formation") {
      const mesh = site.sourceObjectId === null ? void 0 : instances.get(site.sourceObjectId);
      if (!mesh || mesh.spec.family !== site.family || !finitePoint(site.sourceAnchor) || !world.matterAt(site.sourceAnchor.x, site.sourceAnchor.y) || Math.hypot(site.sourceAnchor.x - site.position.x, site.sourceAnchor.y - site.position.y) > 96.001 || !hasLineOfSight(world.sight, site.position, site.sourceAnchor, 96.002) || site.sourceKind === "ground-accumulation") throw new Error("Invalid search-site material provenance");
      if (!nearestFormation(world, site.sourceAnchor, 1e-3, mesh.spec.id) || site.axis !== direction(mesh.spec.rotation)) throw new Error("Search-site parent is not the claimed original surface");
      if (site.sourceKind === "surface-peel" && (site.sourceAnchor.x !== site.position.x || site.sourceAnchor.y !== site.position.y || world.roleAt(site.position.x, site.position.y) !== "relief")) throw new Error("Formation peel must share its real walkable surface");
    } else throw new Error("Unknown search-site source domain");
  }
}
var GAME_CONSTANTS = {
  /** Tile size in pixels */
  TILE_SIZE: 32,
  /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
  CAMERA: {
    ZOOM: 1.5
  },
  /** Player movement (docs/specs/system-movement-vision.md, section M) */
  PLAYER: {
    SPEED: 80,
    // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
    MOVE_ACCEL_TIME: 0.08,
    // s from standstill to full speed
    MOVE_DECEL_TIME: 0.1,
    // s from full speed to standstill
    FACING_TURN_RATE: 1080,
    // deg/s the vision cone swings toward the input direction
    FACING_QUANT_HYSTERESIS: 5,
    // deg of dead zone around the 45 degree facing4 boundaries
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 sprite
    SPEED_MOD_MIN: 0.5
    // floor on the multiplied speed modifier stack
  },
  /**
   * Presentation-only gait (art-direction §3.3). Does not change facingAngle,
   * facing4 snap timing, speeds, or colliders.
   */
  ACTOR_MOTION: {
    FRAME_COUNT: 4,
    TURN_MS: 180,
    LAG_PX: 3,
    LAG_ALPHA: 0.38,
    MOVE_SPEED_FLOOR: 6,
    // px/s; below this the idle cycle plays
    PLAYER_IDLE_FPS: 4,
    PLAYER_WALK_FPS: 8,
    INFILTRATOR_IDLE_FPS: 4,
    INFILTRATOR_WALK_FPS: 4,
    // puppet hitch supplies the step; keep the sheet slow
    REWRITER_IDLE_FPS: 4,
    REWRITER_WALK_FPS: 6
  },
  /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
  CHAOS: {
    START_VALUE: 0,
    MAX_VALUE: 100,
    // HUD gauge max (value CAN exceed this)
    HARD_CAP: 150,
    BASE_RATE: 0.5,
    // points per second (DEC-024: calibrated for 80 px/s travel)
    THRESHOLD_1: 50,
    THRESHOLD_2: 75,
    THRESHOLD_3: 100,
    COMBAT_BONUS: 5,
    DETECTION_BONUS: 3,
    DETECTION_BONUS_COOLDOWN: 1e4,
    // ms per-enemy cooldown on detection chaos
    CHASE_RATE_MULT: 2,
    EMIT_STEP: 1,
    // minimum delta before emitting CHAOS_CHANGED
    MODULATOR_STEP: 1
    // minimum delta before calling onModulate callback
  },
  /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
  LOOT: {
    /** 迭代 10 起退役，见 spec 规则 14。名义参数，代码无引用；由 SEARCH_RADIUS 取代。 */
    PICKUP_RADIUS: 16,
    NODE_COUNT: 8,
    VALUE_SAFE: 1,
    VALUE_CONTESTED: 2,
    VALUE_DEEP: 4,
    SEARCH_CHANNEL_MS: 1200,
    SEARCH_RADIUS: 48,
    SEARCH_NOISE_RADIUS: 96,
    SEARCH_NOISE_LEVEL: "suspicious"
  },
  /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
  EXTRACTION: {
    TRIGGER_RADIUS: 48,
    KEY: "E",
    SETTLE_DELAY_MS: 600,
    RESTART_KEY: "R"
  },
  /**
   * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
   * Models a forward cone unioned with an ambient ring, with three fixed-width edge
   * bands. The older single-radius + edge-softness model was replaced rather than
   * extended, so the two parameter sets never coexist.
   */
  VISIBILITY: {
    RADIUS_FORWARD: 224,
    // px straight ahead (7 tiles); must exceed every profile sightRange (I1)
    RADIUS_AMBIENT: 80,
    // px all around (2.5 tiles) = the lamp the player carries
    CONE_HALF_ANGLE: 50,
    // deg half-angle of the full-range sector
    CONE_FALLOFF_ANGLE: 30,
    // deg of transition from forward range down to ambient
    MIN_SOLID_RADIUS: 48,
    // px that stay fully lit no matter what
    EDGE_BAND_WIDTH: 32,
    // px per gradient band (1 tile, art-direction 4.3)
    BAND_ALPHAS: [1, 0.6, 0.2],
    // visibility of core / middle / outer band
    ERASE_ALPHAS: [1, 0.5, 0.2],
    // per-layer erase strength producing those alphas
    RAY_COUNT: 60,
    // architecture ceiling
    RAY_SPLIT_FORWARD: 40,
    // rays inside the cone sector
    RAY_SPLIT_AMBIENT: 20,
    // rays across the remaining angles
    RAY_COUNT_DEGRADED: 40,
    // first degradation step
    RAY_SPLIT_FORWARD_DEGRADED: 28,
    RAY_SPLIT_AMBIENT_DEGRADED: 12,
    MIN_RADIUS_SCALE: 0.4,
    // hard floor for the chaos radius modulator
    CACHE_POS_EPSILON: 0.5,
    // px of movement tolerated before the cache is dropped
    CACHE_ANGLE_EPSILON: 0.5,
    // deg of rotation tolerated before the cache is dropped
    BUDGET_MS: 2,
    // per-frame raycasting budget
    DEGRADE_SAMPLE_FRAMES: 30,
    // consecutive frames over budget before degrading
    /** Void outside the field of view */
    VOID_COLOR: 526860,
    VOID_NOISE_ALPHA: 0.04,
    VOID_NOISE_TILE: 64,
    // px noise texture size
    VOID_NOISE_SCROLL: 2,
    // px/s drift
    /** Warm lamp the player carries - the only warm light inside a rift */
    PLAYER_LAMP_COLOR: 9067562,
    PLAYER_LAMP_ALPHA: 0.12,
    /**
     * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
     * the vision cone by the darkness mask. This is what makes the forward cone read as
     * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
     */
    FLASHLIGHT_COLOR: 11047018,
    // pale warm; a saturated brown would wash the cold floor out
    FLASHLIGHT_ALPHA: 0.16,
    // low enough that fragment L1 (clinic/metro/soil) still reads under the cone
    FLASHLIGHT_FORWARD_FRAC: 0.34,
    // push the pool centre this fraction of forward range ahead
    FLASHLIGHT_RADIUS_FRAC: 0.85,
    // pool radius as a fraction of forward range
    /** Glow bleeding through the darkness (Slice 1: extraction point only) */
    GLOW_LEAK_ALPHA: 0.25,
    GLOW_LEAK_RADIUS: 48,
    /** Chaos corruption of the vision edge */
    CORRUPTION_COLOR: 1748374,
    CORRUPTION_MAX_MIX: 0.6,
    // alpha of the teal band at corruption 1.0
    CORRUPTION_MAX_DEPTH: 0.35,
    // fraction of the range teal can eat at corruption 1.0
    CORRUPTION_JITTER_PX: 4,
    CORRUPTION_JITTER_HZ: 6,
    /**
     * Overflow (chaos > 100) full-screen teal wash. Persistent base stays well below the
     * old 0.08 epilepsy cap; the jump is a discrete ~2 s pulse (not a strobe), so its
     * peak can read as a "skip" without a rapid flash train.
     */
    FLICKER_BASE_ALPHA: 0.05,
    FLICKER_JUMP_ALPHA: 0.16,
    FLICKER_JUMP_PERIOD_MS: 2200,
    FLICKER_JUMP_WIDTH_MS: 140,
    /** Extra teal bite / edge jitter scale at screenFlicker = 1.0 */
    OVERFLOW_CORRUPTION_DEPTH_BOOST: 0.4,
    OVERFLOW_JITTER_BOOST: 1,
    /** Purification point overrides (omni mode) */
    PURIFY_RADIUS: 400,
    PURIFY_RAY_COUNT: 90
  },
  /**
   * Enemy AI (docs/specs/system-enemy-ai.md, "数值结构"). Every AI number lives here;
   * none are inlined in the systems.
   *
   * Six of these values are load-bearing relations rather than free parameters - the
   * balance invariants I1-I6 that make stealth playable at all. `config/invariants.ts`
   * asserts them at boot so tuning cannot silently break one.
   *
   * The old `SIGHT_ANGLE: 90 // cone half-angle` key was removed rather than kept: its
   * meaning split into a core cone and a peripheral band, and three overlapping angle
   * parameters would have been three ways to be wrong.
   */
  AI: {
    // --- movement and body (shared; per-role speeds live in data/enemies.csv) ---
    TURN_RATE: 360,
    // deg/s; a third of the player's, which is what makes flanking work (I6)
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 infiltrator sprite
    SEPARATION_RADIUS: 24,
    // px; soft repulsion instead of enemy-vs-enemy physics
    SEPARATION_WEIGHT: 0.35,
    // how strongly separation bends the movement direction
    STANDOFF_DISTANCE: 30,
    // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
    STANDOFF_BAND: 4,
    // px of tolerance around it (26..34)
    STANDOFF_ADJUST_SPEED: 60,
    // px/s used to back off when the player crowds it
    // --- perception (shared; cone / hearing radii / weights live in data/enemies.csv) ---
    DETECT_FILL_TIME: 0.45,
    // s of clear sight to go from 0 to certain; then × visionWeight
    HEAR_FILL_TIME: 2,
    // s of hearing fill baseline; then × hearingWeight × moveMult
    HEARING_STILL_CAP: 0.2,
    // still-hearing cannot push detection past this (below 0.35)
    HEAR_ALERT_THRESHOLD: 0.7,
    // rewriter T0-4b: hearing can push to ALERT, never CHASE
    DETECT_DIST_FACTOR_NEAR: 1.6,
    // detection rate multiplier at point blank
    DETECT_DIST_FACTOR_FAR: 0.5,
    // ...and at the edge of sight range
    DETECT_ZONE_FACTOR_PERIPH: 0.45,
    // peripheral vision fills far slower than the core cone
    SUSPICION_THRESHOLD: 0.35,
    // detection at which it stops and turns - the player's warning
    REACQUIRE_THRESHOLD: 0.5,
    // lower bar to re-lock while already searching
    DETECT_DECAY_RATE: 0.67,
    // per s; ~1.5 s to clear after breaking sight
    DETECT_DECAY_ALERT_SCALE: 0.5,
    // decays half as fast while searching: it is holding a grudge
    HEARING_JITTER: 32,
    // px of positional fuzz, so hearing is not a wall-hack locator
    PERCEPTION_TICK_MS: 100,
    // 10 Hz perception; one raycast per enemy per tick
    PERCEPTION_TICK_MS_FAR: 200,
    // 5 Hz beyond ACTIVE_RANGE (rule N8)
    // --- timers (section "计时器") ---
    LOS_GRACE_MS: 400,
    // how long a chase survives with no line of sight
    LOST_PLAYER_DURATION: 5e3,
    // ms of ALERT searching
    ALERT_DURATION: 3e3,
    // ms a SUSPICIOUS enemy stays wary with no new stimulus
    CHASE_ABANDON_RANGE: 320,
    // px past which an unseen chase is given up
    WAYPOINT_PAUSE_MS: 1200,
    // dwell at a patrol waypoint - the player's window to slip past
    SCAN_HOLD_MS: 600,
    // dwell on each scan heading
    SEARCH_HOLD_MS: 800,
    // dwell at each ALERT search point
    EXTRAPOLATE_SEC: 0.6,
    // how far ahead of the last sighting to guess - punishes running straight
    SEARCH_SPREAD: 96,
    // px radius of the random third search point
    ALERT_EMIT_COOLDOWN_MS: 1e3,
    // suppression window for repeated same-level ENEMY_ALERT
    SUSPICIOUS_TURN_HOLD_MS: 200,
    // minimum standstill when turning to look (rule B2, ">= 0.2 s")
    SCAN_SWEEP_ANGLE: 45,
    // deg to each side when scanning in place
    SCAN_SWEEP_PERIOD_MS: 1500,
    // full left-right-left sweep period
    FACING_ARRIVE_EPSILON: 6,
    // deg within which a turn counts as completed
    // --- pathfinding and performance (section "寻路与性能") ---
    MAX_PATHS_PER_FRAME: 1,
    // architecture hard rule
    REPATH_INTERVAL_MS: 500,
    REPATH_INTERVAL_MS_FAR: 1e3,
    // for requests past SIMPLE_PATH_RANGE (rule N5)
    REPATH_MOVE_THRESHOLD: 48,
    // px of target movement that earns an early chase repath
    SIMPLE_PATH_RANGE: 384,
    // px past which a request drops to the lowest priority
    ASTAR_MAX_NODES: 3e3,
    // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
    PATH_FAIL_LIMIT: 3,
    // consecutive failures before giving up on the goal
    ACTIVE_RANGE: 640,
    // px; beyond this the FSM runs at 5 Hz and never asks for a path
    ARRIVE_EPSILON: 8,
    // px within which a path point counts as reached
    MAX_ACTIVE_ENEMIES: 8,
    // Slice 1 uses 4; more than this means the map data is wrong
    MAX_PATH_POINTS: 64,
    // capacity of a per-enemy dynamic path buffer
    DT_CLAMP_MS: 100,
    // stops a backgrounded tab from teleporting enemies on return
    /**
     * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
     * clear sight line does not prove a 20 px body fits through the diagonal seam it
     * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
     * symptom (wanting to move but not moving) and fall back to a real path.
     */
    STUCK_REPATH_MS: 400,
    STUCK_PATH_PREFERENCE_MS: 2e3,
    // how long a stuck enemy keeps preferring A* over straight lines
    STUCK_PROGRESS_FRACTION: 0.25,
    // actual/desired speed below which we count as stuck
    // --- placeholder presentation (section "占位期表现", art-direction 12) ---
    BODY_COLOR: 13386820,
    // "low tier enemy"; encodes tier, never state
    INDICATOR_COLOR: 2811592,
    // contamination teal; state lives here
    SUSPICIOUS_BREATH_HZ_MIN: 1.5,
    // breathing rate at the suspicion threshold...
    SUSPICIOUS_BREATH_HZ_MAX: 3,
    // ...and at full certainty (rule R3)
    ALERT_BLINK_HZ: 3,
    // blinking = searching
    AFTERIMAGE_INTERVAL_MS: 100,
    AFTERIMAGE_LIFETIME_MS: 300,
    AFTERIMAGE_ALPHA: 0.3,
    AFTERIMAGE_SLOTS: 4,
    // ring buffer per enemy; lifetime/interval + 1
    /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
    DEBUG_SHOW_VISION_CONE: false
  },
  /** Map generation */
  MAP: {
    WIDTH: 80,
    // tiles (larger to accommodate multiple fragments)
    HEIGHT: 80,
    // tiles
    /** Voronoi partitioning */
    FRAGMENT_COUNT_MIN: 4,
    FRAGMENT_COUNT_MAX: 6,
    FRAGMENT_MIN_AREA: 150,
    // minimum tiles per fragment
    /** Cellular automata */
    CA_ITERATIONS: 5,
    // smoothing passes
    CA_WALL_THRESHOLD: 4,
    // cells with >= N wall neighbors become wall
    CA_INITIAL_FILL: 0.45,
    // initial random fill ratio (lower = more open)
    /** Fracture connections between fragments */
    FRACTURE_WIDTH: 2,
    // tiles (narrow passage width)
    FRACTURE_MAX_PER_EDGE: 2
    // max connections between two adjacent fragments
  },
  /**
   * Slice 6 C1 land outline. Rectangular tile buffer; walkable land must not fill it.
   * 80×80 MAP.* numbers stay architecture placeholders — do not use them for this generator.
   */
  GENERATION: {
    BUFFER_COLS: 64,
    BUFFER_ROWS: 42,
    MAX_OUTLINE_ATTEMPTS: 28,
    LAND_FILL_MIN: 0.24,
    LAND_FILL_MAX: 0.48,
    BORDER_RING: 2,
    /** Fraction of the outer ring that may be land. Higher = island hugging the rectangle. */
    BORDER_OCCUPANCY_MAX: 0.12,
    /** Land / axis-aligned bbox. Circles sit near 0.78; filled rectangles sit near 1. */
    BBOX_FILL_MAX: 0.8,
    /**
     * Share of land cells that touch void. Large blobs naturally sit lower;
     * this only rejects near-solid blocks (a 1-cell frame around a filled rect).
     */
    ROUGHNESS_MIN: 0.08,
    /** bbox must leave at least this many leftover cells on width+height combined. */
    MIN_BBOX_SLACK: 8,
    MAX_EDGES_TOUCHING: 3,
    MAX_RUIN_ATTEMPTS: 40,
    MIN_FEATURE_SEPARATION: 7,
    WALL_RATIO_MIN: 0.018,
    WALL_RATIO_MAX: 0.22,
    /** Largest leftover open rectangle (tiles). Bigger than this reads as an empty plaza. */
    YARD_AREA_MAX: 64
  },
  /** Purification point (docs/specs/system-purification-impact.md) */
  PURIFICATION: {
    /** Spatial layout */
    MAP_COLS: 14,
    // tiles
    MAP_ROWS: 12,
    // tiles
    INTERACTION_RADIUS: 32,
    // pixels for module/rift-entrance interaction
    /** Module state */
    MODULE_INITIAL_HP: 70,
    /** Tier-0 repair cap / effect denominator baseline (DEC-064). */
    MODULE_BASE_MAX_HP: 100,
    /** Alias of MODULE_BASE_MAX_HP so older call sites still compile. */
    MODULE_MAX_HP: 100,
    /** Each thicken tier adds this many maxHp to every module. */
    MODULE_MAX_HP_PER_TIER: 15,
    /** Highest purchasable thicken tier (maxHp = 100 + 15*3 = 145). */
    MODULE_MAX_HP_TIERS: 3,
    // Thickening purchase costs are authored alongside all other growth steps
    // in data/growth-route.csv, not a separate system-constant price ladder.
    /** All three module effects use this HP reference; thickening does not raise it. */
    MODULE_EFFECT_HP_REF: 100,
    /** Starting chaos when purifier hp = 0 (full integrity → 0). */
    CHAOS_HARD_START: 50,
    REPAIR_PER_KINDLING: 4,
    // 1 kindling = this many hp (tuned for scarcity)
    /** Impact system (intensity now driven by TideSystem, see TIDE constants) */
    BASE_IMPACT_DAMAGE: 30,
    THREAT_FOCUS_RATIO: 0.65,
    // primary target gets this fraction of total damage
    FORECAST_ACCURACY: 0.8,
    // particle prediction accuracy
    /** combust defense mechanic (DEC-030): fixed threshold, not derived from
     * BASE_IMPACT_DAMAGE, so tide-driven damage swings don't shift the trigger point.
     * Value chosen to equal ~2x BASE_IMPACT_DAMAGE(30) per the CSV's "约等于2次满额冲击". */
    COMBUST_BURN_THRESHOLD: 60,
    /** Module effects */
    MAX_CORE_REDUCTION: 0.3,
    // chaosRate reduction at full hp
    MAX_STORAGE_BONUS: 0.5,
    // kindling value bonus at full hp
    /** resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%".
     * A flat bump to both caps above while at least one resonate sits in a defense slot -
     * not a multiplier, so it reads the same way the CSV states it ("+10%" alongside two
     * numbers already expressed as flat percentages). "不叠加" is enforced by storing this
     * as a single on/off flag (`GameState.isResonateBonusActive()`), not a per-item count. */
    RESONATE_MODULE_CAP_BONUS: 0.1,
    /** siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍(1薪柴=8hp)" - same
     * "装备期间" derivation pattern as RESONATE_MODULE_CAP_BONUS above (owned by
     * `ContaminantSystem.syncRepairEfficiencyMult()` + `GameState`, not a per-impact
     * defense-engine effect), since the CSV names it a standing equip-state bonus rather
     * than a one-impact trigger. 4 (REPAIR_PER_KINDLING) * 2.0 = 8, matching the CSV. */
    SIPHON_REPAIR_EFFICIENCY_MULT: 2,
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 50,
      // active boundary particles
      PARTICLE_ALPHA_MIN: 0.06,
      PARTICLE_ALPHA_MAX: 0.25,
      PARTICLE_SPEED: 8,
      // px/s slow inward drift
      APPARITION_INTERVAL_MIN: 8e3,
      // ms
      APPARITION_INTERVAL_MAX: 15e3,
      APPARITION_DURATION: 3e3,
      // ms (0.5s fade in + 2s hold + 0.5s fade out)
      APPARITION_MAX_SIMULTANEOUS: 3
    },
    /** Dynamic boundary shape (polar pressure blob) */
    BOUNDARY: {
      SHRINK_AT_MAX_INTENSITY: 0.72,
      // tideScale at intensity 3.0 (boundary loses up to 28%)
      PRESSURE_PRIMARY_AMP: 0.2,
      // max inward push fraction (primary Gaussian lobe)
      PRESSURE_SECONDARY_AMP: 0.1,
      // secondary lobe amplitude
      PRESSURE_LOBE_SIGMA: 0.7,
      // radians; width of each Gaussian lobe
      PRESSURE_CREST_BONUS: 0.4,
      // +40% amplitude during crest phase
      PRESSURE_EBB_FACTOR: 0.6,
      // amplitude multiplier during ebb phase
      SAFE_MARGIN_TILES: 1,
      // minimum distance from any interaction point to boundary
      GRADIENT_INNER_START: 0.8,
      // fraction of R where darkening begins
      GRADIENT_MEMBRANE_START: 0.95,
      // fraction where "membrane" teal band begins
      GRADIENT_OUTER_END: 1.15,
      // fraction where full void begins
      /**
       * B4 (Slice 5): the old BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT
       * keys described a single global sinusoidal pulse from a "whole-boundary breathing"
       * design that DEC-028 (Slice 4.5) replaced with localized pressure impacts
       * (`src/systems/boundary-breath.ts`). Those 5 keys had zero consumers and were
       * removed; this nested object holds boundary-breath.ts's real tuning knobs
       * (previously inlined as top-of-file `const`s there) instead. Values unchanged.
       */
      BREATH: {
        SAMPLE_COUNT: 72,
        // angular resolution of the membrane/impact draw
        MAX_IMPACTS: 5,
        // max simultaneous localized impacts
        ARC_HALF_MIN: 0.4,
        // rad; narrowest impact arc half-width
        ARC_HALF_MAX: 0.8,
        // rad; widest impact arc half-width
        SPAWN_DIST_MIN: 14,
        // px; closest impact spawn distance outside the membrane
        SPAWN_DIST_MAX: 30,
        // px; farthest impact spawn distance
        IMPACT_DURATION_MIN: 1800,
        // ms; shortest single-impact lifetime
        IMPACT_DURATION_MAX: 3500,
        // ms; longest single-impact lifetime
        SPAWN_INTERVAL_MIN: 400,
        // ms; shortest gap between new impacts
        SPAWN_INTERVAL_MAX: 1200,
        // ms; longest gap between new impacts (x0.6 during crest)
        WAVE_COLOR: 936511,
        // dark desaturated teal, the inbound wave arcs
        MEMBRANE_COLOR: 1735274,
        // the boundary membrane line itself
        DEFORM_MAX_PX: 8
        // px; max inward push of the membrane at impact center
      }
    },
    /** Scene transition timing */
    IMPACT_RESULT_DISPLAY_MS: 2e3,
    SCENE_TRANSITION_DELAY_MS: 600
  },
  /**
   * Combat (docs/specs/system-combat.md, "数值结构"). Every combat number lives here.
   *
   * The system is a price list, not a fight: the point is that the player can work out
   * what swinging costs before swinging. Three of these relations carry that promise and
   * are asserted at boot by `config/invariants.ts` (K1/K2/K3/K5) - notably
   * `ENEMY_MAX_HEALTH` being an exact multiple of `PLAYER_DAMAGE`, which is what makes
   * "three hits" a fact rather than an average.
   *
   * When combat turns out too cheap in playtesting, the spec's tuning order is
   * `CHAOS.COMBAT_BONUS` and `NOISE_HIT_RADIUS` first, `ENEMY_MAX_HEALTH` second, and
   * `PLAYER_DAMAGE` never (weakening it makes combat expensive *and* unpleasant).
   */
  COMBAT: {
    // --- player attack (section "玩家攻击") ---
    PLAYER_DAMAGE: 25,
    ATTACK_COOLDOWN: 500,
    // ms, counted from the input instant, parallel to the phases
    ATTACK_RANGE: 40,
    // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
    ATTACK_HALF_ANGLE: 60,
    // deg -> a 120 deg forward sector
    ATTACK_WINDUP_MS: 100,
    // the player's side of the commitment
    ATTACK_ACTIVE_MS: 50,
    // ~3 frames; exists to tolerate frame jitter, not to widen the hit
    ATTACK_RECOVERY_MS: 70,
    ATTACK_SLOW_MS: 220,
    // derived: windup + active + recovery (asserted, not free)
    ATTACK_SELF_SLOW: 0.35,
    // move speed while swinging - the "cost" that lands on feel
    ATTACK_MIN_ANGLE_BYPASS: 16,
    // px within which the angle test is meaningless and skipped
    /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
    ATTACK_KEY: "SPACE",
    // --- infiltrator (section "敌人（渗透体）") ---
    ENEMY_MAX_HEALTH: 75,
    // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
    ENEMY_DAMAGE_BASE: 15,
    ENEMY_ATTACK_RANGE: 38,
    // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
    ENEMY_ATTACK_HALF_ANGLE: 60,
    // deg; symmetric with the player's
    ENEMY_ATTACK_WINDUP_MS: 350,
    // the player's dodge window - the whole of "controllable" (K3)
    ENEMY_ATTACK_COOLDOWN_MS: 1200,
    ENEMY_FIRST_ATTACK_DELAY_MS: 300,
    // "caught up with you" and "hit you" stay two events
    ENEMY_ATTACK_TOKENS: 2,
    // enemies allowed in windup at once; caps unavoidable damage
    ENEMY_HIT_FLASH_MS: 80,
    ENEMY_DEATH_FX_MS: 180,
    // presentation only; the enemy is gone from logic at 0 ms
    // --- player health and hits (section "玩家生命值与受击") ---
    PLAYER_IFRAME_MS: 400,
    // stops two enemies resolving on one frame for 30 damage
    PLAYER_HIT_FLASH_MS: 100,
    // --- noise: the exposure half of the price (section "噪声") ---
    NOISE_SWING_RADIUS: 96,
    // px (3 tiles), 'suspicious' - a whiff is heard, not billed
    NOISE_HIT_RADIUS: 160,
    // px (5 tiles), 'alert' - the main reason a fight is loud
    NOISE_KILL_RADIUS: 192,
    // px (6 tiles), 'alert'
    /**
     * Placeholder presentation (spec V2). White is on loan here: it currently means
     * "player / extraction point" in art-direction 12, and using thin white lines and
     * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
     * Treat these as stand-ins, not as the visual language.
     */
    FX_COLOR: 16777215,
    ATTACK_FAN_FX_MS: 60,
    // how long the swing outline stays up (spec V2)
    PLAYER_FLASH_PAD: 6,
    // px the hit flash overshoots the body; see report on white-on-white
    FX_POOL_SIZE: 12
    // preallocated flash/death sprites: 8 enemies + headroom
  },
  /**
   * Contamination lexicon (DEC-076). Morph tables stay in CSV.
   * These are system constants: core HP, chaos prices, draw retry, encounter timing.
   */
  CONTAMINATION: {
    CORE_MAX_HEALTH: 50,
    ADJACENT_STRIKE_DAMAGE: 15,
    ADJACENT_STRIKE_WINDUP_MS: 350,
    PAINT_STEP_CHAOS_REST: 2,
    PAINT_STEP_CHAOS_INFLATED: 4,
    VOLUME_CHAOS_PER_SEC: 1,
    VOLUME_SIGHT_MULT: 0.7,
    DRAW_RETRY_LIMIT: 12,
    ENCOUNTER_COOLDOWN_MS: 6e4,
    ENCOUNTER_GAP_MS: 2500,
    ENCOUNTER_HOLD_MS: 2500,
    VOLUME_DEPTH: 40,
    COLONY_NUCLEUS_COUNT_MIN: 2,
    COLONY_NUCLEUS_COUNT_MAX: 3,
    COLONY_NUCLEUS_MIN_TILE_GAP: 3
  },
  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5
  },
  /** Tide system (docs/specs/system-growth-tide.md, section T) */
  TIDE: {
    TIDES: [
      { floor: 1, peak: 1.6, riseCycles: 3, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.2 },
      { floor: 1.2, peak: 2, riseCycles: 4, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.5 },
      { floor: 1.5, peak: 2.4, riseCycles: 4, crestCycles: 2, ebbCycles: 2, ebbTarget: 1.8 },
      { floor: 1.8, peak: 2.8, riseCycles: 4, crestCycles: 2, ebbCycles: 3, ebbTarget: 2 },
      { floor: 2, peak: 3, riseCycles: 5, crestCycles: Infinity, ebbCycles: 0, ebbTarget: 2 }
    ],
    CREST_CHARGE_COST: 3,
    // impact charge cost during Crest phase
    NORMAL_CHARGE_COST: 1,
    // impact charge cost during Rise/Ebb phases
    TRANSFORM_THRESHOLD: 3
    // charges needed to transform defense -> tool
  },
  // Growth / permanent upgrades (docs/specs/system-growth-tide.md, section G):
  // Definitions come from data/upgrades.csv; all step costs come from
  // data/growth-route.csv (including thickening). Both generate upgrade-data.ts
  // under the CSV source rule — no constants block here
  // by design; growth-system.ts reads UPGRADE_DATA directly.
  /** Contaminant system (docs/specs/system-growth-tide.md, section CN) */
  CONTAMINANT: {
    NODES_PER_MAP: 3,
    // contaminant pickup nodes per rift map
    RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
    DEFENSE_SLOTS: 1,
    // base slot; each growth_defense_slot level adds +1
    SORTIE_SLOTS: 3,
    // base slots (2 active + 1 passive); growth_sortie_slot adds +1 active
    MAX_DEFENSE_SLOTS: 4,
    // DEFENSE_SLOTS + max growth_defense_slot bonus (maxLevel 3)
    MAX_SORTIE_SLOTS: 4,
    // SORTIE_SLOTS + max growth_sortie_slot bonus (maxLevel 1)
    USES: { common: 5, fine: 3, rare: 2 },
    // uses remaining after transformation
    /** echo defense mechanic: "单件因此最多+2" — per-tool cap on echo bonus grants. */
    ECHO_MAX_TOOL_USE_BONUS: 2,
    /**
     * Hotkeys for the active sortie slots, in slot order. The passive slot (always the
     * last unlocked slot, see `contaminantSystem.getSortiePassiveSlotIndex()`) never gets
     * an entry here - it has no hotkey by design. G was picked for the 3rd slot
     * (growth_sortie_slot, Slice 5 T5) because it sits directly beside F on the keyboard,
     * the same "one key past the movement cluster" reach as Q/F already use, and every
     * other neighbour (E/R/T) is already taken by extraction/restart/nothing-reserved-but-
     * awkward. Single source of truth for both the RiftScene binding and any UI that needs
     * to render the real key label.
     */
    SORTIE_ACTIVE_KEYS: ["Q", "F", "G"]
  },
  /** Purification stability (docs/specs/system-growth-tide.md, section S) */
  STABILITY: {
    MAX: 100,
    GAIN_EXTRACT: 1,
    // successful extraction (calibrated: ~35 cycles to cap)
    GAIN_GROWTH: 1,
    // purchased an upgrade
    GAIN_CREST_SURVIVED: 3,
    // survived a full Crest with no module at zero
    GAIN_TIDE_ADVANCE: 5,
    // tide advanced to next number
    LOSS_MODULE_ZERO: -1
    // a module reached 0 hp
  },
  /**
   * Fine/Rare active+passive tool numbers not already carried by
   * `src/generated/contaminant-data.ts` (radius/duration/uses read straight from the CSV
   * at the point of use instead of being re-hardcoded here - see `docs/design-notes/
   * slice3-sortie-tools.md`). Everything below is either a multiplier/amount the CSV
   * description states in prose (`data/contaminants.csv`, `description_tool` column) or,
   * where flagged, a placeholder-tier number the CSV leaves unspecified (Slice 5 T1).
   */
  TOOLS: {
    /** compress: "半径2格内敌人移速-60%" */
    COMPRESS_SPEED_MULT: 0.4,
    /** resonate: "弹回3格并眩晕2秒" */
    RESONATE_KNOCKBACK_PX: 96,
    RESONATE_STUN_MS: 2e3,
    /** overwrite: "感知范围缩小50%" */
    OVERWRITE_PERCEPTION_MULT: 0.5,
    /** combust: "感知范围-50%"(烈焰遮蔽视线) */
    COMBUST_PERCEPTION_MULT: 0.5,
    /** combust: "每秒受到持续伤害" - CSV gives no amount; placeholder tuned so an enemy
     * that stays the full 8s duration dies (75 hp / 15 = 5 ticks), matching the tool's
     * rare-tier power level. Flagged for design confirmation (see delivery report). */
    COMBUST_DAMAGE_PER_TICK: 15,
    COMBUST_TICK_MS: 1e3,
    /** mirror: "被敌人接触后碎裂消失" - CSV gives no contact radius; placeholder tuned to
     * roughly one enemy body width. Flagged for design confirmation. */
    MIRROR_CONTACT_RADIUS: 20,
    /** abyss: "使用后5秒内混乱增速+50%" - a second timing value the CSV's single
     * `tool_duration_ms` column cannot carry (that field holds the 10s reveal instead). */
    ABYSS_CHAOS_BOOST_MULT: 1.5,
    ABYSS_CHAOS_BOOST_MS: 5e3,
    /** siphon: "吸取2点薪柴且...混乱值增速减半" */
    SIPHON_KINDLING_GAIN: 2,
    SIPHON_CHAOS_REDUCTION_MULT: 0.5
  },
  /** Persistent save (docs/specs/system-growth-tide.md, section P) */
  SAVE: {
    KEY: "coh-save-v1",
    VERSION: 2
  }
};
var BODY_CLEARANCE_EPSILON = 1e-6;
function bodyHasSupport(walk, center2, halfWidth, halfHeight) {
  if (![center2.x, center2.y, halfWidth, halfHeight].every(Number.isFinite) || halfWidth < 0 || halfHeight < 0 || center2.x - halfWidth < 0 || center2.y - halfHeight < 0 || center2.x + halfWidth > walk.cols * walk.tileSize || center2.y + halfHeight > walk.rows * walk.tileSize) return false;
  const insetX = Math.min(halfWidth, BODY_CLEARANCE_EPSILON), insetY = Math.min(halfHeight, BODY_CLEARANCE_EPSILON);
  const firstCol = Math.floor((center2.x - halfWidth + insetX) / walk.tileSize);
  const lastCol = Math.floor((center2.x + halfWidth - insetX) / walk.tileSize);
  const firstRow = Math.floor((center2.y - halfHeight + insetY) / walk.tileSize);
  const lastRow = Math.floor((center2.y + halfHeight - insetY) / walk.tileSize);
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) if (!walk.isWalkable(col, row)) return false;
  }
  return true;
}
function bodyDisplacementFraction(walk, center2, halfWidth, halfHeight, dx, dy) {
  if (!Number.isFinite(center2.x) || !Number.isFinite(center2.y) || !Number.isFinite(halfWidth) || !Number.isFinite(halfHeight) || !Number.isFinite(dx) || !Number.isFinite(dy) || halfWidth < 0 || halfHeight < 0) return 0;
  if (dx === 0 && dy === 0) return 0;
  const size = walk.tileSize, epsilon = BODY_CLEARANCE_EPSILON;
  const firstCol = Math.max(-1, Math.floor((Math.min(center2.x, center2.x + dx) - halfWidth) / size));
  const lastCol = Math.min(walk.cols, Math.floor((Math.max(center2.x, center2.x + dx) + halfWidth) / size));
  const firstRow = Math.max(-1, Math.floor((Math.min(center2.y, center2.y + dy) - halfHeight) / size));
  const lastRow = Math.min(walk.rows, Math.floor((Math.max(center2.y, center2.y + dy) + halfHeight) / size));
  let fraction = 1;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      if (col >= 0 && row >= 0 && col < walk.cols && row < walk.rows && walk.isWalkable(col, row)) continue;
      const minX = col * size - halfWidth + epsilon, maxX = (col + 1) * size + halfWidth - epsilon;
      const minY = row * size - halfHeight + epsilon, maxY = (row + 1) * size + halfHeight - epsilon;
      let entry = 0, exit = fraction;
      if (dx === 0) {
        if (center2.x <= minX || center2.x >= maxX) continue;
      } else {
        const a = (minX - center2.x) / dx, b = (maxX - center2.x) / dx;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
      if (dy === 0) {
        if (center2.y <= minY || center2.y >= maxY) continue;
      } else {
        const a = (minY - center2.y) / dy, b = (maxY - center2.y) / dy;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
      if (entry < exit && exit > 0) fraction = Math.min(fraction, entry);
    }
  }
  return fraction < 1 ? Math.max(0, fraction - 1e-4 / Math.max(Math.abs(dx), Math.abs(dy))) : 1;
}
var TileGrid = class {
  constructor(map) {
    __publicField(this, "cols");
    __publicField(this, "rows");
    __publicField(this, "tileSize");
    __publicField(this, "widthPx");
    __publicField(this, "heightPx");
    __publicField(this, "data");
    __publicField(this, "_version", 0);
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.cols * map.tileSize;
    this.heightPx = map.rows * map.tileSize;
    this.data = new Uint8Array(map.cols * map.rows);
    for (let row = 0; row < map.rows; row++) {
      const sourceRow = map.tiles[row];
      if (!sourceRow || sourceRow.length !== map.cols) {
        throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
      }
      for (let col = 0; col < map.cols; col++) {
        this.data[row * map.cols + col] = sourceRow[col];
      }
    }
  }
  get version() {
    return this._version;
  }
  /**
   * Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks.
   * In-bounds VOID stays VOID (unwalkable; opaque via `isOpaque`).
   */
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    return this.data[row * this.cols + col];
  }
  isOpaque(col, row) {
    const tile = this.getTile(col, row);
    return tile === 0 || tile === 3;
  }
  isWalkable(col, row) {
    const tile = this.getTile(col, row);
    return tile === 1 || tile === 2;
  }
  /** True when the world position falls inside a walkable tile. */
  isWalkableAt(x, y) {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }
  /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
  setTile(col, row, tile) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (this.data[index] === tile) return;
    this.data[index] = tile;
    this._version++;
  }
  /** Writes the centre of a tile into `out` (no allocation). */
  tileToWorld(col, row, out) {
    out.x = col * this.tileSize + this.tileSize / 2;
    out.y = row * this.tileSize + this.tileSize / 2;
    return out;
  }
  /** Writes the tile containing a world position into `out` (no allocation). */
  worldToTile(x, y, out) {
    out.col = Math.floor(x / this.tileSize);
    out.row = Math.floor(y / this.tileSize);
    return out;
  }
};
var BUILD_LAB_PLACEMENTS = [
  {
    "scene": "watched",
    "id": "safe",
    "kind": "kindling",
    "col": 8,
    "row": 18,
    "tier": "safe",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "prize",
    "kind": "contaminant",
    "col": 29,
    "row": 12,
    "tier": "contested",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "deep",
    "kind": "kindling",
    "col": 30,
    "row": 6,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "extra",
    "kind": "contaminant",
    "col": 30,
    "row": 18,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "watcher",
    "kind": "enemy",
    "col": 23,
    "row": 12,
    "tier": "",
    "substrate": "human_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_cone",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "21:12|27:12",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "listener",
    "kind": "enemy",
    "col": 28,
    "row": 19,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 270,
    "patrol": "28:19|32:19",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "safe",
    "kind": "kindling",
    "col": 9,
    "row": 12,
    "tier": "safe",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "prize",
    "kind": "contaminant",
    "col": 29,
    "row": 12,
    "tier": "contested",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "deep",
    "kind": "kindling",
    "col": 29,
    "row": 6,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "extra",
    "kind": "contaminant",
    "col": 31,
    "row": 18,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "listener",
    "kind": "enemy",
    "col": 30,
    "row": 20,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "28:20|32:20",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "field",
    "kind": "volume",
    "col": 18,
    "row": 12,
    "tier": "",
    "substrate": "gas_mass",
    "coverage": "infiltrate",
    "motion": "motion_anchor",
    "sense": "sense_domain",
    "rhythm": "rhythm_open",
    "contact": "contact_volume_chaos",
    "facing": 0,
    "patrol": "",
    "box": "16:10:21:15"
  },
  {
    "scene": "contested",
    "id": "safe",
    "kind": "kindling",
    "col": 10,
    "row": 18,
    "tier": "safe",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "prize",
    "kind": "contaminant",
    "col": 25,
    "row": 13,
    "tier": "contested",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "deep",
    "kind": "kindling",
    "col": 31,
    "row": 7,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "extra",
    "kind": "contaminant",
    "col": 31,
    "row": 18,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "watcher",
    "kind": "enemy",
    "col": 24,
    "row": 12,
    "tier": "",
    "substrate": "human_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_cone",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "21:10|25:10|25:15|21:15",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "listener",
    "kind": "enemy",
    "col": 31,
    "row": 13,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 270,
    "patrol": "31:10|31:17",
    "box": ""
  }
];
var POLLUTION_GRADE_DEFINITIONS = [
  {
    "id": "low",
    "version": 1,
    "label": "\u4F4E\u6C61\u67D3",
    "status": "dev-masters",
    "intent": "\u6C61\u67D3\u5C40\u90E8\u4FB5\u5165\uFF1B\u5141\u8BB8\u505C\u7559\u89C2\u5BDF\u548C\u4F4E\u635F\u8017\u641C\u53D6",
    "paintCount": 2,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "infiltrate",
    "volumeCount": 1,
    "volumeSubstrate": "gas_mass",
    "volumeCoverage": "infiltrate",
    "volumeCols": 3,
    "volumeRows": 3,
    "chaosStartRate": 0.24,
    "chaosEndRate": 0.34,
    "chaosRampStartSeconds": 90,
    "chaosRampEndSeconds": 210
  },
  {
    "id": "medium",
    "version": 1,
    "label": "\u4E2D\u6C61\u67D3",
    "status": "dev-masters",
    "intent": "\u6C61\u67D3\u5206\u5E03\u5728\u591A\u5904\u8DEF\u5F84\u8FB9\uFF1B\u89C2\u5BDF\u98CE\u9669\u540E\u9009\u62E9\u7ED5\u884C\u6216\u627F\u53D7\u6C61\u67D3",
    "paintCount": 4,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "rewrite",
    "volumeCount": 2,
    "volumeSubstrate": "gas_mass",
    "volumeCoverage": "rewrite",
    "volumeCols": 4,
    "volumeRows": 3,
    "chaosStartRate": 0.42,
    "chaosEndRate": 0.6,
    "chaosRampStartSeconds": 60,
    "chaosRampEndSeconds": 180
  },
  {
    "id": "severe",
    "version": 1,
    "label": "\u91CD\u5EA6\u6C61\u67D3",
    "status": "dev-masters",
    "intent": "\u5927\u7247\u5730\u9762\u548C\u7A7A\u6C14\u5DF2\u88AB\u4FB5\u5360\uFF1B\u5145\u5206\u51C6\u5907\u540E\u77ED\u65F6\u6DF1\u5165\u5E76\u5C3D\u65E9\u64A4\u79BB",
    "paintCount": 6,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "overwrite",
    "volumeCount": 3,
    "volumeSubstrate": "gas_mass",
    "volumeCoverage": "overwrite",
    "volumeCols": 5,
    "volumeRows": 3,
    "chaosStartRate": 0.64,
    "chaosEndRate": 0.96,
    "chaosRampStartSeconds": 40,
    "chaosRampEndSeconds": 130
  }
];
var ENV_INK = {
  seam: [20, 28, 28],
  shadow: [36, 46, 44],
  body: [64, 79, 73],
  ridge: [100, 117, 103],
  ash: [112, 113, 102],
  ashShadow: [59, 65, 62],
  oil: [29, 39, 39],
  oilRidge: [69, 94, 86],
  metal: [88, 91, 83],
  rust: [92, 75, 60],
  teal: [54, 154, 132],
  lit: [128, 198, 168]
};
function stageOf(c) {
  return c === "infiltrate" ? 0 : c === "rewrite" ? 1 : 2;
}
function activityOf(p) {
  return p?.activity?.phase === "rest" ? 0 : p?.activity?.phase === "waking" ? p.activity.progress : 1;
}
function putPixel(out, w, h, x, y, ink, alpha = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  out[i] = ink[0];
  out[i + 1] = ink[1];
  out[i + 2] = ink[2];
  out[i + 3] = alpha;
}
function cluster(x, y, seed2) {
  let n = Math.imul(Math.floor(x / 3) + seed2, 374761393) ^ Math.imul(Math.floor(y / 2) + 11, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return (n >>> 0) % 11;
}
function paintSurfaceMaterial(out, field2, w, h, substrate, coverage, seed2, elapsedMs = 0, pose) {
  out.fill(0);
  const stage = stageOf(coverage), activity = activityOf(pose);
  const phase2 = elapsedMs * Math.PI * 2 / 2400;
  const inflated = pose?.signal === "inflated";
  const lift = activity * (inflated ? 1 : 0.45);
  const cx = w * 0.5, cy = h * 0.5;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = field2[i];
    if (v < 0.1) continue;
    const r = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
    const north = field2[i - w] < 0.1, south = field2[i + w] < 0.1;
    const edge = north || south || field2[i - 1] < 0.1 || field2[i + 1] < 0.1;
    let ink = ENV_INK.shadow, alpha = 255;
    if (substrate === "fungal_mat") {
      const fold = (Math.floor(y * 0.65 + Math.sin(x * 0.16 + stage * 0.3) * (3 + stage) + Math.sin(y * 0.09) * 2 + Math.sin(phase2 - y * 0.08) * lift * 1.8) % 7 + 7) % 7;
      ink = fold <= 1 ? ENV_INK.seam : fold === 2 ? ENV_INK.ridge : fold < 5 ? ENV_INK.body : ENV_INK.shadow;
      if (north) ink = ENV_INK.ridge;
      if (south) ink = ENV_INK.seam;
      if (cluster(x, y, seed2) === 3 && fold > 2 && fold < 5) ink = ENV_INK.shadow;
      if (stage > 0 && Math.abs(Math.sin(a * (3 + stage) + r * 0.08)) < 0.1 && fold === 2) ink = ENV_INK.teal;
    } else if (substrate === "oil_film") {
      const ribbon2 = Math.floor(y + Math.sin(x * 0.11 + stage * 0.4) * (2 + stage) + Math.sin(phase2) * lift * 2) % 12;
      ink = ENV_INK.oil;
      if (north) ink = ENV_INK.oilRidge;
      else if (south) ink = ENV_INK.seam;
      else if (ribbon2 === 2 && cluster(x, y, seed2) < 7) ink = ENV_INK.oilRidge;
      else if (ribbon2 === 3 && cluster(x, y, seed2) < 4) ink = ENV_INK.body;
      if (stage > 0 && ribbon2 === 8 && Math.floor(x / 5) % 3 === 1) ink = ENV_INK.shadow;
      if (stage === 2 && ribbon2 === 9 && Math.floor(x / 4) % 5 === 0) ink = ENV_INK.teal;
    } else {
      const shear = Math.round(Math.sin(phase2 + y * 0.12) * lift * (1 + stage));
      const fold = (y + Math.floor(x / 8) * (stage + 1) + shear + 1e3) % 8;
      ink = fold === 0 ? ENV_INK.seam : fold < 3 ? ENV_INK.ash : fold < 5 ? ENV_INK.ashShadow : ENV_INK.shadow;
      if (north) ink = ENV_INK.ash;
      if (south) ink = ENV_INK.seam;
      if (cluster(x, y, seed2) === 5 && fold > 2) ink = ENV_INK.ashShadow;
      if (stage > 0 && fold === 1 && Math.floor(x / 4) % 7 === 0) ink = ENV_INK.teal;
    }
    if (edge && cluster(x, y, seed2) < 2) ink = ENV_INK.shadow;
    if (v >= 0.78) ink = activity > 0.35 ? ENV_INK.teal : ENV_INK.body;
    if (activity < 0.3 && ink === ENV_INK.teal) ink = ENV_INK.body;
    if (ink === ENV_INK.teal && inflated) ink = ENV_INK.lit;
    putPixel(out, w, h, x, y, ink, alpha);
  }
}
var RIFT_FRAGMENT_DATA = {
  "frag-outdoor": {
    id: "frag-outdoor",
    displayName: "\u6237\u5916\u571F\u58E4",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 4,
    jogAmp: 1,
    gapCount: 0,
    gapPlacement: "",
    turnCount: 0,
    turnCorner: "",
    capKind: "stub",
    facingPolicy: "random",
    join: "single",
    surfaceMaterial: "soil",
    enabled: true,
    floorBv: 26,
    floorBiasR: 0.88,
    floorBiasG: 1.02,
    floorBiasB: 0.82,
    stainKey: "frag-outdoor",
    stainThreshold: 0.72,
    stainStrength: 0.4,
    grimeAmp: 0.5,
    macroAmp: 0.32,
    scratchPer1000px2: 0.55,
    fleckPer1000px2: 1.25,
    scratchAngle: "free",
    scratchDispersion: 0,
    wallBv: 24,
    wallBiasR: 1,
    wallBiasG: 0.88,
    wallBiasB: 0.75,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 12,
    featureCountMax: 24
  },
  "frag-clinic": {
    id: "frag-clinic",
    displayName: "\u533B\u9662\u5B9E\u9A8C\u5BA4",
    coverage: "remnant",
    massGrammar: "enclosure",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "end",
    turnCount: 2,
    turnCorner: "right",
    capKind: "none",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "tile",
    enabled: true,
    floorBv: 28,
    floorBiasR: 0.86,
    floorBiasG: 0.92,
    floorBiasB: 1.08,
    stainKey: "shadow-grey",
    stainThreshold: 0.78,
    stainStrength: 0.25,
    grimeAmp: 0.28,
    macroAmp: 0.18,
    scratchPer1000px2: 0.7,
    fleckPer1000px2: 0.55,
    scratchAngle: "orthogonal",
    scratchDispersion: 0,
    wallBv: 30,
    wallBiasR: 0.82,
    wallBiasG: 0.9,
    wallBiasB: 1.05,
    featureWidthTiles: 1,
    featureLengthTiles: 5,
    featureCountMin: 14,
    featureCountMax: 22
  },
  "frag-metro": {
    id: "frag-metro",
    displayName: "\u5730\u94C1\u5DE5\u4E1A",
    coverage: "remnant",
    massGrammar: "slab",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "center",
    turnCount: 0,
    turnCorner: "",
    capKind: "pier",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "metal",
    enabled: true,
    floorBv: 24,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "brick-dark",
    stainThreshold: 0.68,
    stainStrength: 0.35,
    grimeAmp: 0.42,
    macroAmp: 0.28,
    scratchPer1000px2: 0.45,
    fleckPer1000px2: 0.9,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.15,
    wallBv: 26,
    wallBiasR: 1.1,
    wallBiasG: 0.82,
    wallBiasB: 0.68,
    featureWidthTiles: 2,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-library": {
    id: "frag-library",
    displayName: "\u65E7\u56FE\u4E66\u9986",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 6,
    jogAmp: 1,
    gapCount: 2,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "none",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "wood",
    enabled: true,
    floorBv: 26,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-library",
    stainThreshold: 0.6,
    stainStrength: 0.3,
    grimeAmp: 0.34,
    macroAmp: 0.2,
    scratchPer1000px2: 0.8,
    fleckPer1000px2: 0.7,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.35,
    wallBv: 24,
    wallBiasR: 1.02,
    wallBiasG: 0.93,
    wallBiasB: 0.68,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-residential": {
    id: "frag-residential",
    displayName: "\u5C45\u6C11\u533A\u516C\u5BD3",
    coverage: "remnant",
    massGrammar: "cluster",
    jogPeriod: 2,
    jogAmp: 1,
    gapCount: 3,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "widen",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "plaster",
    enabled: false,
    floorBv: 28,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-residential",
    stainThreshold: 0.7,
    stainStrength: 0.3,
    grimeAmp: 0.38,
    macroAmp: 0.24,
    scratchPer1000px2: 0.4,
    fleckPer1000px2: 0.4,
    scratchAngle: "orthogonal",
    scratchDispersion: 0.6,
    wallBv: 30,
    wallBiasR: 1.02,
    wallBiasG: 0.96,
    wallBiasB: 0.79,
    featureWidthTiles: 2,
    featureLengthTiles: 5,
    featureCountMin: 18,
    featureCountMax: 24
  }
};
var ENABLED_RIFT_FRAGMENTS = Object.values(RIFT_FRAGMENT_DATA).filter((row) => row.enabled);
var PALETTE_HEX = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE = PALETTE_HEX.map(hexToRgb);
var TEAL_FAMILY_HEX = [
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#b0fff5",
  "#4adf8a",
  "#1a7a9a"
];
var TEAL_FAMILY = TEAL_FAMILY_HEX.map(hexToRgb);
var TEAL_FAMILY_SET = new Set(TEAL_FAMILY_HEX);
var TEAL_SUBSET_DEEP_MID_HEX = ["#0e4a3f", "#1a6b5c", "#1a7a9a"];
var TEAL_SUBSET_CORE_HEX = ["#1aad96"];
var TEAL_SUBSET_GLOW_HEX = ["#2ae6c8"];
var TEAL_SUBSET_DEEP_MID = TEAL_SUBSET_DEEP_MID_HEX.map(hexToRgb);
var TEAL_SUBSET_CORE = TEAL_SUBSET_CORE_HEX.map(hexToRgb);
var TEAL_SUBSET_GLOW = TEAL_SUBSET_GLOW_HEX.map(hexToRgb);
var L3_WARM_HEX = ["#8a5c2a", "#c4873a"];
var L4_GLOW_HEX = ["#e0a848"];
var UI_HEX = ["#8a8f96", "#c8cdd4", "#2a2d32", "#0f1114"];
var DANGER_HEX = ["#cc3333"];
var WARNING_HEX = ["#b89040"];
var DEBRIS_HEX = ["#50463c", "#5d483e", "#4f4835"];
var DEBRIS_HEX_SET = new Set(DEBRIS_HEX);
var L1_EXCLUDED_HEX = /* @__PURE__ */ new Set([
  ...TEAL_FAMILY_HEX,
  ...L3_WARM_HEX,
  ...L4_GLOW_HEX,
  ...UI_HEX,
  ...DANGER_HEX,
  ...WARNING_HEX
]);
var L1_MEAN_MAX = 55;
var CHROMA_TIE_EPS = 1e-9;
function hexToRgb(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function meanRgb(rgb2) {
  return (rgb2[0] + rgb2[1] + rgb2[2]) / 3;
}
function sameRgb(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function rgbDist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}
function chromaDir(rgb2) {
  const m = Math.max(1e-6, meanRgb(rgb2));
  return [rgb2[0] / m, rgb2[1] / m, rgb2[2] / m];
}
function chromaDist2(a, b) {
  const da = chromaDir(a);
  const db = chromaDir(b);
  return (da[0] - db[0]) ** 2 + (da[1] - db[1]) ** 2 + (da[2] - db[2]) ** 2;
}
function temperatureGroup(r, g, b) {
  if (r - b >= 6) return "WARM";
  if (b - r >= 6) return "COOL";
  if (g >= r + 2 && g >= b + 2) return "OLIVE";
  return "NEUTRAL";
}
function buildL1Pools() {
  const pools = {
    WARM: [],
    COOL: [],
    OLIVE: [],
    NEUTRAL: []
  };
  for (let i = 0; i < PALETTE_HEX.length; i++) {
    const hex = PALETTE_HEX[i];
    if (L1_EXCLUDED_HEX.has(hex)) continue;
    const rgb2 = PALETTE[i];
    if (meanRgb(rgb2) > L1_MEAN_MAX) continue;
    pools[temperatureGroup(rgb2[0], rgb2[1], rgb2[2])].push(rgb2);
  }
  return pools;
}
var L1_POOL_MUTABLE = buildL1Pools();
var L1_POOL = {
  WARM: L1_POOL_MUTABLE.WARM,
  COOL: L1_POOL_MUTABLE.COOL,
  OLIVE: L1_POOL_MUTABLE.OLIVE,
  NEUTRAL: L1_POOL_MUTABLE.NEUTRAL
};
function pickByChroma(target, candidates) {
  let best = candidates[0];
  let bestChroma = Infinity;
  let bestRgb = Infinity;
  for (const c of candidates) {
    const chroma = chromaDist2(c, target);
    const rgbD = rgbDist2(c, target);
    if (chroma < bestChroma - CHROMA_TIE_EPS) {
      best = c;
      bestChroma = chroma;
      bestRgb = rgbD;
    } else if (Math.abs(chroma - bestChroma) <= CHROMA_TIE_EPS && rgbD < bestRgb) {
      best = c;
      bestRgb = rgbD;
    }
  }
  return best;
}
function unused(candidates, used) {
  return candidates.filter((c) => !used.some((u) => sameRgb(u, c)));
}
function quantizeInGroup(targetRgb, subset, used = []) {
  const remaining = unused(subset, used);
  if (remaining.length > 0) {
    return pickByChroma(targetRgb, remaining);
  }
  console.warn(
    "[palette-quantize] candidate pool empty after used-filter; falling back to NEUTRAL L1 pool"
  );
  const neutralFree = unused(L1_POOL.NEUTRAL, used);
  if (neutralFree.length > 0) {
    return pickByChroma(targetRgb, neutralFree);
  }
  console.warn(
    "[palette-quantize] NEUTRAL L1 pool also exhausted; returning a NEUTRAL cell, not full-palette nearest"
  );
  const neutral = L1_POOL.NEUTRAL;
  if (neutral.length > 0) {
    return pickByChroma(targetRgb, neutral);
  }
  return PALETTE[0];
}
var PALETTE_HEX2 = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE2 = PALETTE_HEX2.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
]);
var PALETTE_WITHOUT_DEBRIS = PALETTE2.filter(
  (_rgb, i) => !DEBRIS_HEX_SET.has(PALETTE_HEX2[i])
);
var PALETTE_HEX_SET = new Set(PALETTE_HEX2.map((h) => h.toLowerCase()));
function clamp255(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}
var CLUSTER_TEAL_RGB = [
  ...TEAL_SUBSET_DEEP_MID,
  ...TEAL_SUBSET_CORE,
  ...TEAL_SUBSET_GLOW
];
function clamp01(n) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === rn) h = (gn - bn) / d % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max < 1e-6 ? 0 : d / max, v: max };
}
function hsvToRgb(h, s, v) {
  const hh = (h % 1 + 1) % 1;
  const c = v * s;
  const x = c * (1 - Math.abs(hh * 6 % 2 - 1));
  const m = v - c;
  const i = hh * 6 | 0;
  let r = 0;
  let g = 0;
  let b = 0;
  if (i === 0) {
    r = c;
    g = x;
  } else if (i === 1) {
    r = x;
    g = c;
  } else if (i === 2) {
    g = c;
    b = x;
  } else if (i === 3) {
    g = x;
    b = c;
  } else if (i === 4) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function toRgb(t) {
  return [clamp255(t[0]), clamp255(t[1]), clamp255(t[2])];
}
function clampHueWindow(h) {
  return h < 0.42 ? 0.42 : h > 0.56 ? 0.56 : h;
}
function deriveContamRamp(def, age, seed2) {
  const floorRgb = [
    clamp255(def.floorBv * def.floorBiasR),
    clamp255(def.floorBv * def.floorBiasG),
    clamp255(def.floorBv * def.floorBiasB)
  ];
  const fh = rgbToHsv(floorRgb[0], floorRgb[1], floorRgb[2]);
  const wh = rgbToHsv(def.wallBv * def.wallBiasR, def.wallBv * def.wallBiasG, def.wallBv * def.wallBiasB);
  const mapHue = fh.s < 0.06 && wh.s < 0.06 ? 0.48 : fh.s >= wh.s ? fh.h : wh.h;
  const mapV = fh.v * 0.6 + wh.v * 0.4;
  const mapS = fh.s > wh.s ? fh.s : wh.s;
  const rng = new SeededRandom(mix32(seed2, "contam-ramp"));
  const ageShift = age === "new" ? -0.07 : age === "ancient" ? 0.08 : 0;
  const hue = clampHueWindow(0.48 + (mapHue - 0.48) * 0.52 + ageShift + (rng.next() - 0.5) * 0.05);
  const sat = clamp01(0.5 + mapS * 0.38 + (age === "ancient" ? 0.08 : 0) + (rng.next() - 0.5) * 0.05);
  const val = clamp01(Math.max(0.36, mapV + 0.18) + (rng.next() - 0.5) * 0.04);
  const deepRgb = toRgb(hsvToRgb(hue, sat * 0.82, val * 0.68));
  const midRgb = toRgb(hsvToRgb(hue, sat, val * 0.95));
  const coreRgb = toRgb(hsvToRgb(hue, sat * 0.78, clamp01(val * 1.2)));
  const glowRgb = toRgb(hsvToRgb(hue, sat * 0.46, clamp01(val * 1.42)));
  const deep = quantizeInGroup(deepRgb, TEAL_SUBSET_DEEP_MID, []);
  const mid = quantizeInGroup(midRgb, TEAL_SUBSET_DEEP_MID, [deep]);
  const core = quantizeInGroup(coreRgb, TEAL_SUBSET_CORE, [deep, mid]);
  const glow = quantizeInGroup(glowRgb, TEAL_SUBSET_GLOW, [deep, mid, core]);
  return { deep, mid, core, glow };
}
var LEXICON_DEFAULT_FRAGMENT = "frag-clinic";
function fragmentDef(fragmentTypeId) {
  return RIFT_FRAGMENT_DATA[fragmentTypeId] ?? RIFT_FRAGMENT_DATA[LEXICON_DEFAULT_FRAGMENT];
}
function deriveFragmentContamRamp(fragmentTypeId) {
  const def = fragmentDef(fragmentTypeId);
  const seed2 = mix32(0, `gym-frag-ramp:${def.id}`);
  return deriveContamRamp(def, "standard", seed2);
}
var OIL_FILM_ID = "oil_film";
function oilFilmProductionVeinVariant(seed2) {
  return mix32(seed2, "oil_film_variant") % 3 + 3;
}
function resolvePaintVeinVariant(substrate, seed2, explicit) {
  if (explicit !== void 0) return explicit;
  if (substrate === OIL_FILM_ID) return oilFilmProductionVeinVariant(seed2);
  return void 0;
}
var STAGE = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2
};
var PaintRng = class {
  constructor(seed2, label) {
    __publicField(this, "s");
    this.s = mix32(seed2, label) | 1;
  }
  next() {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  int(lo, hi) {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
};
function topologyOf(substrate) {
  if (substrate === "oil_film") return "vein_tree";
  if (substrate === "ash_veil") return "holed_veil";
  return "lobe_mass";
}
function makePaintField(w, h, logicalSpan) {
  return { v: new Float32Array(w * h), w, h, ...logicalSpan === void 0 ? {} : { logicalSpan } };
}
function authoredSpan(field2) {
  return field2.logicalSpan ?? Math.min(field2.w, field2.h);
}
function add(f, x, y, amt) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= f.w || iy >= f.h) return;
  const i = iy * f.w + ix;
  if (amt > f.v[i]) f.v[i] = amt;
}
function disc(f, cx, cy, r, amt) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) continue;
      add(f, x, y, amt * (1 - Math.sqrt(d2) / (r + 1e-3)) + amt * 0.2);
    }
  }
}
function dot(f, cx, cy, r, amt) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      add(f, x, y, amt);
    }
  }
}
function dotFlat(f, cx, cy, ang, radAlong, radPerp, amt) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = Math.max(radAlong, radPerp) + 1;
  const a2 = radAlong * radAlong;
  const p2 = radPerp * radPerp;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if (along * along / a2 + perp * perp / p2 > 1) continue;
      add(f, x, y, amt);
    }
  }
}
function carveDisc(f, cx, cy, r) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) f.v[y * f.w + x] = 0;
    }
  }
}
function radialCrack(f, cx, cy, ang, r0, r1, halfW) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = r1 + halfW + 1;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if (along < r0 || along > r1) continue;
      if (Math.abs(perp) > halfW) continue;
      f.v[y * f.w + x] = 0;
    }
  }
}
function stroke(f, x0, y0, x1, y1, r, amt) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    dot(f, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, amt);
  }
}
function senseAngleOf(sense) {
  if (sense === "sense_scent") return Math.PI * 2 / 3;
  if (sense === "sense_domain") return Math.PI * 4 / 3;
  if (sense === "sense_hear") return Math.PI / 2;
  if (sense === "sense_narrow") return 0.18;
  if (sense === "sense_reverse") return Math.PI;
  if (sense === "sense_cone") return -Math.PI / 2;
  return 0;
}
function rhythmKnobsOf(rhythm) {
  if (rhythm === "rhythm_pulse") {
    return { lobeExtra: 3, lobeAmp: 0.4, branchMul: 1.35, zigzag: 0.78, veilHoles: 2, veilWarp: 0.3 };
  }
  if (rhythm === "rhythm_sleep") {
    return { lobeExtra: -1, lobeAmp: 0.14, branchMul: 0.62, zigzag: 0.16, veilHoles: 0, veilWarp: 0.08 };
  }
  if (rhythm === "rhythm_cluster") {
    return { lobeExtra: 1, lobeAmp: 0.28, branchMul: 1.08, zigzag: 0.42, veilHoles: 1, veilWarp: 0.2 };
  }
  return { lobeExtra: 0, lobeAmp: 0.22, branchMul: 1, zigzag: 0.3, veilHoles: 0, veilWarp: 0.14 };
}
function placementsOf(f, continuity, topo, senseAng, rng) {
  const cx = f.w / 2;
  const cy = f.h / 2;
  const span = authoredSpan(f);
  const tree = topo === "vein_tree";
  if (continuity === "monolith") {
    return [{ cx, cy, scale: 1 }];
  }
  if (continuity === "shards") {
    const n = 3 + rng.int(0, 1);
    const out2 = [];
    for (let i = 0; i < n; i++) {
      const a = senseAng + i / n * Math.PI * 2 + (rng.next() - 0.5) * 0.35;
      const d = span * (0.3 + rng.next() * 0.06);
      out2.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.3 + rng.next() * 0.05
      });
    }
    return out2;
  }
  if (continuity === "field") {
    const out2 = [{ cx, cy, scale: 1.18 }];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = senseAng + i / n * Math.PI * 2 + rng.next() * 0.25;
      const d = span * (0.4 + rng.next() * 0.05);
      out2.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.4 + rng.next() * 0.05
      });
    }
    return out2;
  }
  const nSat = 3;
  const out = [{ cx, cy, scale: tree ? 0.5 : 0.8 }];
  const satScale = tree ? 0.48 : 0.36;
  for (let i = 0; i < nSat; i++) {
    const a = senseAng + (i + 1) / (nSat + 1) * Math.PI * 2 + (rng.next() - 0.5) * 0.1;
    const d = span * 0.46;
    out.push({
      cx: cx + Math.cos(a) * d,
      cy: cy + Math.sin(a) * d,
      scale: satScale
    });
  }
  return out;
}
function lobeMass(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const R = Math.max(7, authoredSpan(f) * 0.33 * scale);
  const lobes = Math.max(3, 4 + knobs.lobeExtra);
  const amp = knobs.lobeAmp;
  const phi = senseAng;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const bound = R * (1 + amp * Math.cos(lobes * a + phi));
      if (d > bound) continue;
      add(f, x, y, 1 - d / bound * 0.45);
    }
  }
  if (stage < 1) return;
  const kids = stage === 1 ? 5 : 6;
  for (let i = 0; i < kids; i++) {
    const a = senseAng + i / kids * Math.PI * 2 + rng.next() * 0.18;
    const push = 1.34 + rng.next() * 0.28;
    disc(f, cx + Math.cos(a) * R * push, cy + Math.sin(a) * R * push, R * (0.3 + rng.next() * 0.1), 0.96);
  }
  const notchA = senseAng + Math.PI * 0.55;
  carveDisc(f, cx + Math.cos(notchA) * R * 1.02, cy + Math.sin(notchA) * R * 1.02, R * 0.42);
  if (stage < 2) return;
  radialCrack(f, cx, cy, senseAng + 0.4, R * 0.48, R * 1.4, Math.max(3.2, 3.8 * scale));
  radialCrack(f, cx, cy, senseAng + 1.85, R * 0.48, R * 1.35, Math.max(2.8, 3.4 * scale));
  radialCrack(f, cx, cy, senseAng + 3.3, R * 0.55, R * 1.25, Math.max(2.4, 3 * scale));
}
function veinTree(f, rng, stage, cx, cy, scale, senseAng, knobs, variant) {
  if (variant === 0) {
    veinTreeFlat(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 2) {
    veinTreeConverge(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 3) {
    oilFilmBeads(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 4) {
    oilFilmSmear(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 5) {
    oilFilmRimPool(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  const thick = Math.max(0.85, 1.2 * scale);
  const loopR = Math.max(1.9, 2.15 * scale);
  const baseLen = authoredSpan(f) * 0.34 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag;
  const ends = [];
  const walk = (x, y, ang, len, t, depth) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(5, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.65, t * (1 - s / (steps * 1.9)));
      dot(f, px, py, rad, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? stage >= 1 ? 4 : 2 : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.95 + stage * 0.4;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.28;
      walk(px, py, fork, len * (0.55 + rng.next() * 0.18), t * 0.74, depth + 1);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 1.25 : -1.25);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.28,
      cy + Math.sin(senseAng) * baseLen * 0.28,
      side,
      baseLen * 0.85,
      thick * 0.82,
      0
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
      if (d < 8 || d > 26) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const used = /* @__PURE__ */ new Set();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 2) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    stroke(f, ends[p.i].x, ends[p.i].y, ends[p.j].x, ends[p.j].y, loopR, 0.9);
    loops += 1;
  }
}
function veinTreeFlat(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const thick = Math.max(0.95, 1.15 * scale);
  const loopR = Math.max(1.1, 1.25 * scale);
  const baseLen = authoredSpan(f) * 0.36 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag * 0.18;
  const ends = [];
  const walk = (x, y, ang, len, t, depth) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const fade = 1 - s / (steps * 1.55);
      const radAlong = Math.max(1.2, t * 1.9 * fade);
      const radPerp = Math.max(0.28, t * 0.36 * fade);
      dotFlat(f, px, py, a, radAlong, radPerp, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? stage >= 1 ? 3 : 2 : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul * 0.85));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.7 + stage * 0.28;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.12;
      walk(px, py, fork, len * (0.58 + rng.next() * 0.12), t * 0.7, depth + 1);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 0.85 : -0.85);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.22,
      cy + Math.sin(senseAng) * baseLen * 0.22,
      side,
      baseLen * 0.72,
      thick * 0.7,
      0
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
      if (d < 10 || d > 22) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((left, right) => left.d - right.d);
  const used = /* @__PURE__ */ new Set();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 1) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    const ang = Math.atan2(ends[p.j].y - ends[p.i].y, ends[p.j].x - ends[p.i].x);
    const steps = Math.max(1, Math.ceil(p.d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      dotFlat(
        f,
        ends[p.i].x + (ends[p.j].x - ends[p.i].x) * t,
        ends[p.i].y + (ends[p.j].y - ends[p.i].y) * t,
        ang,
        loopR * 1.4,
        loopR * 0.35,
        0.88
      );
    }
    loops += 1;
  }
}
function veinTreeConverge(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const thick = Math.max(1.05, 1.4 * scale);
  const baseLen = authoredSpan(f) * 0.38 * scale;
  const maxDepth = 1 + (stage >= 1 ? 1 : 0);
  const zigzag = knobs.zigzag * 0.28;
  const trunk = [];
  const ends = [];
  const walk = (x, y, ang, len, t, depth, recordTrunk) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.75, t * (1 - s / (steps * 2.6)));
      dot(f, px, py, rad, 0.9);
      if (recordTrunk) trunk.push({ x: px, y: py });
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    const kids = depth === 0 ? 2 : 1;
    const spread = 0.48 + stage * 0.12;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.1;
      walk(px, py, fork, len * (0.6 + rng.next() * 0.08), t * 0.58, depth + 1, false);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0, true);
  if (stage >= 2 && knobs.branchMul > 0.9) {
    const side = senseAng + (rng.next() < 0.5 ? 0.55 : -0.55);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.18,
      cy + Math.sin(senseAng) * baseLen * 0.18,
      side,
      baseLen * 0.55,
      thick * 0.62,
      1,
      false
    );
  }
  for (const end of ends) {
    let bestX = trunk[0]?.x ?? cx;
    let bestY = trunk[0]?.y ?? cy;
    let bestD = Infinity;
    for (const p of trunk) {
      const d = Math.hypot(end.x - p.x, end.y - p.y);
      if (d < bestD) {
        bestD = d;
        bestX = p.x;
        bestY = p.y;
      }
    }
    if (bestD > 5 && bestD < 30) {
      stroke(f, end.x, end.y, bestX, bestY, Math.max(0.65, thick * 0.42), 0.86);
    }
  }
}
function oilFilmBeads(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.35;
  const merge = stage >= 2 ? 1.32 : 1;
  const beads = [];
  const rMain = Math.max(5.5, span * 0.16 * s) * merge;
  beads.push({ x: cx, y: cy, r: rMain, fine: false });
  const rMed = Math.max(2.4, span * 0.055 * s) * merge;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const a = senseAng + side * (0.65 + rng.next() * 0.45) + (rng.next() - 0.5) * 0.28 * (0.6 + knobs.zigzag);
    const d = rMain * (0.95 + rng.next() * 0.2);
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: rMed,
      fine: false
    });
  }
  const nFine = 4 + stage;
  const dFineMin = rMain * 1.3;
  const dFineMax = span * 0.34 * s;
  for (let i = 0; i < nFine; i++) {
    const a = senseAng + ((i + 0.5) / nFine - 0.5) * 2.1 + (rng.next() - 0.5) * 0.55;
    const spanD = Math.max(0, dFineMax - dFineMin);
    const d = dFineMin + rng.next() * spanD;
    if (d < rMain) continue;
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: Math.max(1.05, span * 0.018 * s) * merge,
      fine: true
    });
  }
  const sum = new Float32Array(f.w * f.h);
  for (const b of beads) {
    const reach = b.r * 2.2;
    const pad = reach + 1;
    for (let y = Math.floor(b.y - pad); y <= b.y + pad; y++) {
      for (let x = Math.floor(b.x - pad); x <= b.x + pad; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const t = 1 - Math.hypot(x - b.x, y - b.y) / reach;
        if (t <= 0) continue;
        sum[y * f.w + x] = sum[y * f.w + x] + t * t;
      }
    }
  }
  for (let i = 0; i < sum.length; i++) {
    const field2 = sum[i];
    const x = i % f.w;
    const y = i / f.w | 0;
    if (field2 >= 0.62) add(f, x, y, 0.9);
    else if (field2 >= 0.4) add(f, x, y, 0.66);
    else if (field2 >= 0.26) add(f, x, y, 0.3);
  }
  for (const b of beads) {
    if (b.fine) {
      dot(f, b.x, b.y, b.r, 1.38);
    } else if (b.r >= 2.2) {
      disc(f, b.x, b.y, b.r * 0.35, 1.45);
    }
  }
  if (stage < 2 || beads.length < 3) return;
  const pool = beads[0];
  const far = beads.slice(1).map((b, i) => ({ b, i, d: Math.hypot(b.x - pool.x, b.y - pool.y) })).sort((left, right) => right.d - left.d).slice(0, 2);
  for (const g of far) {
    if (g.d < 6 || g.d > 30) continue;
    stroke(f, pool.x, pool.y, g.b.x, g.b.y, Math.max(0.9, 1.1 * s), 0.66);
  }
}
function oilFilmSmear(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.6;
  const strokes = 1 + stage;
  for (let i = 0; i < strokes; i++) {
    const side = i > 0;
    const baseA = senseAng + (i - (strokes - 1) / 2) * (0.5 + knobs.zigzag * 0.4) + (rng.next() - 0.5) * 0.2;
    const len = span * (0.5 + rng.next() * 0.08) * s * (side ? 0.72 : 1);
    const curl = (rng.next() - 0.5) * 0.9;
    const wHead = Math.max(4.4, 6.8 * s) * (side ? 0.48 : 1);
    const wTail = Math.max(0.55, 0.8 * s);
    const amtMul = side ? 0.55 : 1;
    let px = cx - Math.cos(baseA) * len * 0.42;
    let py = cy - Math.sin(baseA) * len * 0.42;
    const steps = Math.max(8, Math.round(len));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const a = baseA + curl * t;
      px += Math.cos(a);
      py += Math.sin(a);
      const w = wHead + (wTail - wHead) * t;
      const amt = 1.42 * (1 - t * 0.62) * amtMul;
      disc(f, px, py, w * 2.6, 0.4);
      disc(f, px, py, w, amt);
    }
  }
}
function oilFilmRimPool(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.35;
  const blobs = 1 + (stage >= 2 ? 1 : 0);
  const at2 = (x, y) => x < 0 || y < 0 || x >= f.w || y >= f.h ? 0 : f.v[y * f.w + x];
  for (let b = 0; b < blobs; b++) {
    const ba = senseAng + b * 1.9 + (rng.next() - 0.5) * 0.4;
    const bd = b === 0 ? 0 : span * 0.2 * scale;
    const bx = cx + Math.cos(ba) * bd;
    const by = cy + Math.sin(ba) * bd;
    const R = Math.max(8, span * (0.28 + stage * 0.03) * s);
    const h1 = rng.next() * Math.PI * 2;
    const h2 = rng.next() * Math.PI * 2;
    const a1 = 0.08 + knobs.veilWarp * 0.4 + rng.next() * 0.04;
    const a2 = 0.05 + rng.next() * 0.05;
    const pad = R * 1.35 + 1;
    const x0 = Math.floor(bx - pad);
    const x1 = Math.ceil(bx + pad);
    const y0 = Math.floor(by - pad);
    const y1 = Math.ceil(by + pad);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (d > bound - 2.2 && d <= bound - 1) add(f, x, y, 0.48);
        else add(f, x, y, 0.34);
      }
    }
    const gathers = 1 + stage;
    for (let g = 0; g < gathers; g++) {
      const ga = rng.next() * Math.PI * 2;
      const gd = rng.next() * R * 0.45;
      disc(f, bx + Math.cos(ga) * gd, by + Math.sin(ga) * gd, Math.max(1.1, R * 0.12), 0.38);
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (!(at2(x + 1, y) < 0.1 || at2(x - 1, y) < 0.1 || at2(x, y + 1) < 0.1 || at2(x, y - 1) < 0.1)) {
          continue;
        }
        const amt = 1.52 * (0.62 + 0.38 * (0.5 + 0.5 * Math.cos(ang - senseAng)));
        add(f, x, y, amt);
      }
    }
  }
}
function addEllipseRing(f, cx, cy, rx, ry, irx, iry, warp, k, phi, rot, amt, gapCount = 0, gapFrac = 0) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pad = Math.max(rx, ry) + 2;
  const x0 = Math.max(0, Math.floor(cx - pad));
  const x1 = Math.min(f.w - 1, Math.ceil(cx + pad));
  const y0 = Math.max(0, Math.floor(cy - pad));
  const y1 = Math.min(f.h - 1, Math.ceil(cy + pad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      const a = Math.atan2(ly, lx);
      if (gapCount > 0 && gapFrac > 0) {
        const t = ((a - phi) / (Math.PI * 2) + 8) % 1;
        const u = t * gapCount % 1;
        if (u < gapFrac) continue;
      }
      const bound = 1 + warp * Math.cos(k * a + phi);
      const outerD = Math.hypot(lx / rx, ly / ry);
      if (outerD > bound) continue;
      const innerD = Math.hypot(lx / Math.max(0.5, irx), ly / Math.max(0.5, iry));
      if (innerD < bound) continue;
      add(f, x, y, amt);
    }
  }
}
function holedVeil(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const grow = stage === 1 ? 1.28 : 1;
  const rx = Math.max(10, span * 0.42 * scale * grow);
  const ry = Math.max(8, span * (stage === 1 ? 0.24 : 0.3) * scale * (stage === 1 ? 1.08 : 1));
  const ringW = stage === 0 ? Math.max(3.8, 4.8 * scale) : Math.max(3.4, 3.9 * scale);
  const irx = Math.max(3, rx - ringW);
  const iry = Math.max(3, ry - ringW);
  const k = 3 + (knobs.lobeExtra > 1 ? 2 : 0);
  const gaps = stage === 1 ? 5 : 0;
  const gapFrac = stage === 1 ? 0.42 : 0;
  addEllipseRing(f, cx, cy, rx, ry, irx, iry, knobs.veilWarp, k, senseAng, senseAng, 0.9, gaps, gapFrac);
  if (stage >= 2 && scale >= 0.4) {
    const holes = 4 + knobs.veilHoles;
    const midRx = (rx + irx) * 0.5;
    const midRy = (ry + iry) * 0.5;
    for (let i = 0; i < holes; i++) {
      const a = senseAng + i / holes * Math.PI * 2 + rng.next() * 0.08;
      carveDisc(f, cx + Math.cos(a) * midRx, cy + Math.sin(a) * midRy, ringW * 1.35);
    }
  }
  if (stage < 2) return;
  const nrx = rx * 0.68;
  const nry = ry * 0.68;
  const nestedW = Math.max(3.2, 3.6 * scale);
  addEllipseRing(
    f,
    cx,
    cy,
    nrx,
    nry,
    Math.max(2, nrx - nestedW),
    Math.max(2, nry - nestedW),
    knobs.veilWarp * 0.55,
    k,
    senseAng + 0.5,
    senseAng,
    0.94
  );
}
function drawUnit(f, topo, rng, stage, p, senseAng, knobs, variant) {
  if (topo === "lobe_mass") lobeMass(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
  else if (topo === "vein_tree") veinTree(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs, variant);
  else holedVeil(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
}
function materialColony(f, p, seed2, stage, ash) {
  const span = authoredSpan(f) * p.scale;
  const count = ash ? 4 + stage : 5 + stage * 2;
  const rng = new PaintRng(seed2, ash ? "ash-lamina" : "fungal-shelves");
  for (let k = 0; k < count; k++) {
    const angle = rng.next() * Math.PI * 2;
    const cx = p.cx + Math.cos(angle) * span * 0.16, cy = p.cy + Math.sin(angle) * span * 0.12;
    const rx = span * (ash ? 0.25 : 0.17) * (1 + rng.next() * 0.3), ry = span * (ash ? 0.055 : 0.12) * (1 + rng.next() * 0.3);
    for (let y = Math.floor(cy - ry * 1.5); y <= cy + ry * 1.5; y++) for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const warp = Math.sin(dx * 7 + k) * (0.08 + stage * 0.05) + Math.sin(dy * 5 + k) * 0.05;
      if (dx * dx + dy * dy > 1 + warp) continue;
      if (stage > 0 && Math.sin(dx * 5 + dy * 2 + k) > 0.91 && Math.abs(dx) > 0.4) continue;
      add(f, x, y, 0.55 + Math.max(0, 1 - dx * dx - dy * dy) * 0.4);
    }
  }
}
function fillPaintTopology(field2, opts) {
  const topo = topologyOf(opts.substrate);
  const coverage = opts.coverage;
  const continuity = opts.continuity ?? "colony";
  const sense = opts.sense ?? "sense_touch";
  const rhythm = opts.rhythm ?? "rhythm_open";
  const veinTag = opts.veinVariant === void 0 ? "" : `:v${opts.veinVariant}`;
  const rng = new PaintRng(opts.seed, `paint:${topo}:${coverage}:${continuity}:${sense}:${rhythm}${veinTag}`);
  const senseAng = senseAngleOf(sense);
  const knobs = rhythmKnobsOf(rhythm);
  const stage = STAGE[coverage];
  const placements = placementsOf(field2, continuity, topo, senseAng, rng);
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const unitRng = new PaintRng(
      mix32(opts.seed, `u:${i}`),
      `paint-unit:${topo}:${coverage}:${sense}:${rhythm}${veinTag}`
    );
    if (opts.substrate === "fungal_mat" || opts.substrate === "ash_veil")
      materialColony(field2, p, mix32(opts.seed, `material:${i}`), stage, opts.substrate === "ash_veil");
    else drawUnit(field2, topo, unitRng, stage, p, senseAng, knobs, opts.veinVariant);
  }
  return topo;
}
var PAINT_GROWTH_UNIT_CAP = 12;
var PAINT_INFLATED_AMP = 0.18;
function paintGenomeCanvasOf(continuity = "colony") {
  const field2 = continuity === "field";
  return { w: field2 ? 144 : 88, h: field2 ? 144 : 88 };
}
function collectPaintGenomeFloorTiles(field2, w, h, originX, originY, tileSize) {
  const left = originX - w * 0.5;
  const top = originY - h * 0.5;
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (field2[y * w + x] < 0.1) continue;
      const col = Math.floor((left + x + 0.5) / tileSize);
      const row = Math.floor((top + y + 0.5) / tileSize);
      const key = `${col},${row}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ col, row });
    }
  }
  return out;
}
function reserveBreathingFootprint(field2, w, h, radius) {
  const horizontal = new Uint8Array(field2.length);
  const result = new Float32Array(field2.length);
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = -radius; x < w; x++) {
      const incoming = x + radius;
      if (incoming < w && field2[y * w + incoming] >= 0.1) count++;
      const outgoing = x - radius - 1;
      if (outgoing >= 0 && field2[y * w + outgoing] >= 0.1) count--;
      if (x >= 0) horizontal[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = -radius; y < h; y++) {
      const incoming = y + radius;
      if (incoming < h) count += horizontal[incoming * w + x];
      const outgoing = y - radius - 1;
      if (outgoing >= 0) count -= horizontal[outgoing * w + x];
      if (y >= 0 && count > 0) result[y * w + x] = 1;
    }
  }
  return result;
}
function topologyCanvas(req) {
  const continuity = req.continuity ?? "colony";
  const authored = paintGenomeCanvasOf(continuity);
  const options = {
    substrate: req.substrate,
    coverage: req.coverage,
    seed: req.seed,
    continuity,
    sense: req.sense ?? "sense_touch",
    rhythm: req.rhythm ?? "rhythm_open",
    veinVariant: req.veinVariant
  };
  if (req.geometryVersion === 1) {
    const field2 = makePaintField(authored.w, authored.h);
    return { field: field2, topology: fillPaintTopology(field2, options) };
  }
  let padding = Math.max(authored.w, authored.h);
  for (let attempt = 0; attempt < 4; attempt++, padding *= 2) {
    const field2 = makePaintField(
      authored.w + padding * 2,
      authored.h + padding * 2,
      Math.min(authored.w, authored.h)
    );
    const topology = fillPaintTopology(field2, options);
    let minX = field2.w, minY = field2.h, maxX = -1, maxY = -1;
    for (let y = 0; y < field2.h; y++) for (let x = 0; x < field2.w; x++) {
      if (field2.v[y * field2.w + x] < 0.1) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const clearance = Math.ceil(Math.hypot(maxX - minX + 1, maxY - minY + 1) * PAINT_INFLATED_AMP) + 4;
    if (maxX < 0 || Math.min(minX, minY, field2.w - 1 - maxX, field2.h - 1 - maxY) >= clearance)
      return { field: field2, topology };
  }
  throw new Error(`[paint-genome] complete geometry exceeds bounded canvas: ${req.substrate}/${continuity}/${req.seed}`);
}
var CORE_TEALS = [
  [26, 173, 150],
  [42, 230, 200],
  [60, 255, 212]
];
function snapBright(rgb2) {
  let best = CORE_TEALS[0];
  let bestD = Infinity;
  for (const p of CORE_TEALS) {
    const d = (p[0] - rgb2[0]) ** 2 + (p[1] - rgb2[1]) ** 2 + (p[2] - rgb2[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
function fragmentRamp(fragmentTypeId) {
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  return {
    deep: ramp.deep,
    mid: ramp.mid,
    core: snapBright(ramp.core),
    glow: snapBright(ramp.glow)
  };
}
var STAGE2 = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2
};
function applyFilmSheen(field2) {
  const { v, w, h } = field2;
  const next = new Float32Array(v);
  const at2 = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return v[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const cur = v[i];
      const n = at2(x, y - 1);
      const s = at2(x, y + 1);
      const e = at2(x + 1, y);
      const west = at2(x - 1, y);
      const emptyN = (n < 0.1 ? 1 : 0) + (s < 0.1 ? 1 : 0) + (e < 0.1 ? 1 : 0) + (west < 0.1 ? 1 : 0);
      if (cur >= 0.1) {
        if (emptyN >= 3) next[i] = 1;
        else if (emptyN >= 1) next[i] = Math.max(cur, 0.86);
      } else if (n >= 0.1 || s >= 0.1 || e >= 0.1 || west >= 0.1) {
        next[i] = 0.26;
      }
    }
  }
  v.set(next);
}
function lobeCountOf(rhythm) {
  if (rhythm === "rhythm_pulse") return 7;
  if (rhythm === "rhythm_sleep") return 3;
  if (rhythm === "rhythm_cluster") return 5;
  return 4;
}
function pickGrowthUnit(x, y, topology, unitCount, ox, oy, innerR, outerR) {
  if (unitCount <= 1) return 0;
  let nearest = 0;
  let nearestD = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dx = x - ox[i];
    const dy = y - oy[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD) {
      nearestD = d2;
      nearest = i;
    }
  }
  if (topology !== "holed_veil") return nearest;
  const originX = ox[nearest];
  const originY = oy[nearest];
  const r = Math.hypot(x - originX, y - originY);
  let band = nearest;
  let bestErr = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dOx = ox[i] - originX;
    const dOy = oy[i] - originY;
    if (dOx * dOx + dOy * dOy > 144) continue;
    const mid = 0.5 * (innerR[i] + outerR[i]);
    const err = Math.abs(r - mid);
    if (err < bestErr) {
      bestErr = err;
      band = i;
    }
  }
  return band;
}
function collectBeadPeaks(field2, w, h) {
  const raw = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const v = field2[i];
      if (v < 0.42) continue;
      let higher = 0;
      for (let oyOff = -2; oyOff <= 2; oyOff++) {
        for (let oxOff = -2; oxOff <= 2; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          if (field2[(y + oyOff) * w + (x + oxOff)] > v + 1e-6) higher += 1;
        }
      }
      if (higher > 0) continue;
      raw.push({ x: x + 0.5, y: y + 0.5, v });
    }
  }
  raw.sort((a, b) => b.v - a.v || a.y - b.y || a.x - b.x);
  const kept = [];
  const minD2 = 49;
  const floor = raw[0] !== void 0 ? raw[0].v * 0.72 : 1;
  for (const p of raw) {
    if (p.v < floor) break;
    if (kept.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < minD2)) continue;
    kept.push(p);
    if (kept.length >= PAINT_GROWTH_UNIT_CAP) break;
  }
  return kept;
}
function assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR) {
  const unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      unitIndex[y * w + x] = pickGrowthUnit(
        x + 0.5,
        y + 0.5,
        topology,
        unitCount,
        ox,
        oy,
        innerR,
        outerR
      );
    }
  }
  return unitIndex;
}
function buildBeadGrowthGuide(field2, w, h, topology, sense, rhythm) {
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const peaks = collectBeadPeaks(field2, w, h);
  let unitCount = 0;
  for (const p of peaks) {
    ox[unitCount] = p.x;
    oy[unitCount] = p.y;
    unitCount += 1;
  }
  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.2;
    outerR[0] = span[0];
    unitCount = 1;
  }
  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);
  if (peaks.length > 0) {
    const maxR = new Float32Array(unitCount);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (field2[i] < 0.1) continue;
        const u = unitIndex[i];
        const r = Math.hypot(x + 0.5 - ox[u], y + 0.5 - oy[u]);
        if (r > maxR[u]) maxR[u] = r;
      }
    }
    for (let u = 0; u < unitCount; u++) {
      span[u] = Math.max(1.5, maxR[u]);
      outerR[u] = span[u];
    }
  }
  return {
    topology,
    veinVariant: 3,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex
  };
}
function buildPaintGrowthGuide(field2, w, h, topology, sense, rhythm, veinVariant) {
  if (veinVariant === 3) return buildBeadGrowthGuide(field2, w, h, topology, sense, rhythm);
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const cs = Math.cos(senseAngle);
  const sn = Math.sin(senseAngle);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = new Int32Array(w * h);
  let unitCount = 0;
  const rimPool = veinVariant === 5;
  for (let start = 0; start < w * h; start++) {
    if (visited[start] || field2[start] < 0.1) continue;
    let top = 0;
    let n = 0;
    stack[top++] = start;
    visited[start] = 1;
    let sumX = 0;
    let sumY = 0;
    let minAlong = Infinity;
    let rootX = 0;
    let rootY = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      const p = stack[--top];
      comp[n++] = p;
      const x = p % w;
      const y = p / w | 0;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const along = x * cs + y * sn;
      if (along < minAlong) {
        minAlong = along;
        rootX = x;
        rootY = y;
      }
      for (let oyOff = -1; oyOff <= 1; oyOff++) {
        for (let oxOff = -1; oxOff <= 1; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          const nx = x + oxOff;
          const ny = y + oyOff;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (visited[q] || field2[q] < 0.1) continue;
          visited[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (n < 8 || unitCount >= PAINT_GROWTH_UNIT_CAP) continue;
    let ux;
    let uy;
    if (topology === "vein_tree" && !rimPool) {
      ux = rootX + 0.5;
      uy = rootY + 0.5;
    } else if (topology === "holed_veil") {
      ux = (minX + maxX) * 0.5 + 0.5;
      uy = (minY + maxY) * 0.5 + 0.5;
    } else {
      ux = sumX / n + 0.5;
      uy = sumY / n + 0.5;
    }
    let minR = Infinity;
    let maxR = 0;
    let maxAlongRel = 0;
    for (let k = 0; k < n; k++) {
      const p = comp[k];
      const px = p % w + 0.5;
      const py = (p / w | 0) + 0.5;
      const r = Math.hypot(px - ux, py - uy);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      const alongRel = (px - ux) * cs + (py - uy) * sn;
      if (alongRel > maxAlongRel) maxAlongRel = alongRel;
    }
    if (maxR < 2) continue;
    ox[unitCount] = ux;
    oy[unitCount] = uy;
    span[unitCount] = topology === "vein_tree" && !rimPool ? Math.max(1, maxAlongRel) : maxR;
    innerR[unitCount] = topology === "holed_veil" ? minR : 0;
    outerR[unitCount] = maxR;
    unitCount += 1;
  }
  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.33;
    innerR[0] = span[0] * 0.5;
    outerR[0] = span[0];
    unitCount = 1;
  }
  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);
  return {
    topology,
    veinVariant,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex
  };
}
function compactPaintCanvas(field2, growth, continuity) {
  const clearance = Math.ceil(Math.max(...growth.span, ...growth.outerR) * PAINT_INFLATED_AMP) + 2;
  const minimum = paintGenomeCanvasOf(continuity);
  let reachX = 0, reachY = 0;
  for (let y = 0; y < field2.h; y++) for (let x = 0; x < field2.w; x++) {
    if (field2.v[y * field2.w + x] < 0.1) continue;
    reachX = Math.max(reachX, Math.abs(x - field2.w / 2), Math.abs(x + 1 - field2.w / 2));
    reachY = Math.max(reachY, Math.abs(y - field2.h / 2), Math.abs(y + 1 - field2.h / 2));
  }
  const w = Math.min(field2.w, Math.max(minimum.w, 2 * Math.ceil(reachX + clearance + 2)));
  const h = Math.min(field2.h, Math.max(minimum.h, 2 * Math.ceil(reachY + clearance + 2)));
  if (w === field2.w && h === field2.h) return { field: field2, growth, clearance };
  const shiftX = (field2.w - w) / 2, shiftY = (field2.h - h) / 2;
  const cropped = makePaintField(w, h, field2.logicalSpan);
  const unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const begin = (y + shiftY) * field2.w + shiftX;
    cropped.v.set(field2.v.subarray(begin, begin + w), y * w);
    unitIndex.set(growth.unitIndex.subarray(begin, begin + w), y * w);
  }
  const ox = new Float32Array(growth.ox), oy = new Float32Array(growth.oy);
  for (let i = 0; i < growth.unitCount; i++) {
    ox[i] = ox[i] - shiftX;
    oy[i] = oy[i] - shiftY;
  }
  return { field: cropped, growth: { ...growth, ox, oy, unitIndex }, clearance };
}
function bakePaintGenome(req) {
  const sense = req.sense ?? "sense_touch";
  const rhythm = req.rhythm ?? "rhythm_open";
  const geometryVersion = req.geometryVersion ?? 2;
  const { field: field2, topology } = topologyCanvas(req);
  const { w, h } = field2;
  const stage = STAGE2[req.coverage];
  const ramp = fragmentRamp(req.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT);
  const veinTag = req.veinVariant === void 0 ? "" : `:v${req.veinVariant}`;
  const rngLabel = `paint-core:${topology}:${req.coverage}:${sense}:${rhythm}${veinTag}`;
  let s = mix32(req.seed, rngLabel) | 1;
  const next = () => {
    let x = s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s = x >>> 0;
    return s / 4294967296;
  };
  const pickInt = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  for (let i = 0; i < field2.v.length; i++) field2.v[i] = field2.v[i] * 0.58;
  if (req.veinVariant === 1 && topology === "vein_tree") applyFilmSheen(field2);
  const beadGrowth = req.veinVariant === 3 ? buildPaintGrowthGuide(field2.v, w, h, topology, sense, rhythm, 3) : void 0;
  const lit = [];
  for (let i = 0; i < field2.v.length; i++) if (field2.v[i] > 0.3) lit.push(i);
  const cores = 3 + stage * 4;
  for (let n = 0; n < cores && lit.length > 0; n++) {
    const i = lit[pickInt(0, lit.length - 1)];
    field2.v[i] = 1;
    const x = i % w;
    const y = i / w | 0;
    if (n % 2 === 0 && x + 1 < w) field2.v[i + 1] = 0.82;
    if (n % 3 === 0 && y + 1 < h) field2.v[i + w] = 0.82;
  }
  const rawGrowth = beadGrowth ?? buildPaintGrowthGuide(field2.v, w, h, topology, sense, rhythm, req.veinVariant);
  const compact = geometryVersion === 1 ? { field: field2, growth: rawGrowth, clearance: 0 } : compactPaintCanvas(field2, rawGrowth, req.continuity ?? "colony");
  const body = compact.field, growth = compact.growth;
  const out = new Uint8ClampedArray(body.w * body.h * 4);
  paintSurfaceMaterial(out, body.v, body.w, body.h, req.substrate, req.coverage, req.seed);
  const terrainFootprintField = geometryVersion === 1 ? body.v : reserveBreathingFootprint(body.v, body.w, body.h, compact.clearance);
  return {
    buf: { data: out, w: body.w, h: body.h },
    field: body.v,
    terrainFootprintField,
    geometryVersion,
    ramp,
    topology,
    growth,
    canvasW: body.w,
    canvasH: body.h
  };
}
var TILE = 32;
function createMasterPollution(grade, seed2, grid, reachable, start, targets, spatial) {
  const cols = grid.cols * grid.tileSize / TILE, rows = grid.rows * grid.tileSize / TILE;
  const scale = TILE / grid.tileSize;
  const tiles = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_2, col) => {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++)
      if (!grid.isWalkable(col * scale + x, row * scale + y)) return 3;
    return 1;
  }));
  const hostTileMap = { cols, rows, tileSize: TILE, tiles };
  const isFloor = (col, row) => tiles[row]?.[col] === 1;
  const fineCell = (p) => Math.floor(p.y / grid.tileSize) * grid.cols + Math.floor(p.x / grid.tileSize);
  const fineCenter = (cell) => ({ x: (cell % grid.cols + 0.5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + 0.5) * grid.tileSize });
  const parents = new Int32Array(reachable.length).fill(-1), approach = new Float64Array(reachable.length).fill(Infinity), queue = [start];
  parents[start] = start;
  approach[start] = 0;
  for (let at2 = 0; at2 < queue.length; at2++) {
    const cell = queue[at2];
    for (const next of [cell - 1, cell + 1, cell - grid.cols, cell + grid.cols]) {
      if (!reachable[next] || parents[next] !== -1 || Math.abs(next - cell) === 1 && Math.floor(next / grid.cols) !== Math.floor(cell / grid.cols)) continue;
      if (spatial) {
        const point = fineCenter(cell), to = fineCenter(next), half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
        if (bodyDisplacementFraction(grid, point, half, half, to.x - point.x, to.y - point.y) < 1) continue;
      }
      parents[next] = cell;
      approach[next] = approach[cell] + grid.tileSize;
      queue.push(next);
    }
  }
  const protectedCells = /* @__PURE__ */ new Set();
  for (const target of targets) {
    let cell = fineCell(target);
    if (parents[cell] === -1) throw new Error("A protected R100 pollution route is unreachable");
    while (cell !== start) {
      protectedCells.add(cell);
      cell = parents[cell];
    }
  }
  protectedCells.add(start);
  const safeRoute = [...protectedCells].map(fineCenter);
  const forbidden = /* @__PURE__ */ new Set();
  for (const point of safeRoute) {
    for (let row = Math.floor((point.y - 18) / TILE); row <= Math.floor((point.y + 18) / TILE); row++)
      for (let col = Math.floor((point.x - 18) / TILE); col <= Math.floor((point.x + 18) / TILE); col++) forbidden.add(row * cols + col);
  }
  const spawn = fineCenter(start), anchors = [spawn, ...targets];
  const blocked = (col, row) => forbidden.has(row * cols + col) || anchors.some((anchor, index) => Math.hypot((col + 0.5) * TILE - anchor.x, (row + 0.5) * TILE - anchor.y) < (index === 0 ? 80 : 40));
  const candidates = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (isFloor(col, row) && reachable[fineCell({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE })]) candidates.push({ col, row });
  const approachAt = (col, row) => approach[fineCell({ x: col * TILE, y: row * TILE })];
  const regionAt = (col, row) => spatial ? Math.min(spatial.host_region_cols - 1, Math.floor(col / cols * spatial.host_region_cols)) + Math.min(spatial.host_region_rows - 1, Math.floor(row / rows * spatial.host_region_rows)) * spatial.host_region_cols : 0;
  const spatialHostScore = (col, row, slot, count, kind, placed) => {
    if (!spatial) return 0;
    const distance2 = approachAt(col, row);
    if (!Number.isFinite(distance2) || distance2 < spatial.host_min_approach_px || distance2 > spatial.host_max_approach_px) return -Infinity;
    const jitter = mix32(seed2, `spatial-${kind}-depth-${slot}`) / 4294967296;
    const target = spatial.host_min_approach_px + (slot + 0.25 + jitter * 0.5) / count * (spatial.host_max_approach_px - spatial.host_min_approach_px);
    const spread = placed.length ? Math.min(600, ...placed.map((seat) => Math.hypot(col - seat.col, row - seat.row) * TILE)) : 0;
    const occupiedRegion = placed.some((seat) => regionAt(col, row) === regionAt(seat.col, seat.row));
    return -Math.abs(distance2 - target) * 0.6 + spread * 0.35 - Number(occupiedRegion) * 240 + mix32(seed2, `spatial-${kind}-${slot}-${col}-${row}`) / 4294967296 * 80;
  };
  const forms = [], paintFloors = [];
  const occupiedPaint = /* @__PURE__ */ new Set();
  const paintRequests = [];
  for (let slot = 0; slot < grade.paintCount; slot++) {
    const form = {
      substrate: grade.paintSubstrate,
      coverage: grade.paintCoverage,
      continuity: grade.paintContinuity,
      occupancy: "paint",
      portfolio: "bing",
      lexemes: { motion: "motion_anchor", sense: "sense_domain", rhythm: "rhythm_open", contact: "contact_step_chaos" }
    };
    const hostSeed = mix32(seed2, `ENM_BING_${String(slot + 1).padStart(2, "0")}`);
    const baked = bakePaintGenome({
      ...form,
      seed: hostSeed,
      sense: form.lexemes.sense,
      rhythm: form.lexemes.rhythm,
      fragmentTypeId: "frag-outdoor",
      veinVariant: resolvePaintVeinVariant(form.substrate, hostSeed),
      geometryVersion: 2
    });
    const cells = (field2) => collectPaintGenomeFloorTiles(field2, baked.canvasW, baked.canvasH, TILE / 2, TILE / 2, TILE);
    const support = cells(baked.terrainFootprintField), danger = cells(baked.field);
    const seats = candidates.filter((seat) => support.every((offset) => isFloor(seat.col + offset.col, seat.row + offset.row)) && danger.every((offset) => !blocked(seat.col + offset.col, seat.row + offset.row))).map((seat) => ({ ...seat, danger: danger.map((offset) => (seat.row + offset.row) * cols + seat.col + offset.col) }));
    if (!seats.length) throw new Error(`${grade.id}: no complete native paint footprint for Host ${slot + 1}`);
    paintRequests.push({ form, seats });
  }
  const chosen = Array.from({ length: grade.paintCount }, () => null);
  let attempts = 0;
  function placePaint(remaining) {
    if (remaining === 0) return true;
    if (++attempts > 2e4) return false;
    let slot = -1, allowed = [];
    for (let index = 0; index < chosen.length; index++) {
      if (chosen[index]) continue;
      const seats = paintRequests[index].seats.filter((seat) => seat.danger.every((cell) => !occupiedPaint.has(cell)));
      if (!seats.length) return false;
      if (slot === -1 || seats.length < allowed.length) {
        slot = index;
        allowed = seats;
      }
    }
    const score = (seat) => {
      const x = (seat.col + 0.5) * TILE, y = (seat.row + 0.5) * TILE;
      const placed = chosen.filter((p) => p !== null);
      if (spatial) return spatialHostScore(seat.col + 0.5, seat.row + 0.5, slot, grade.paintCount, "paint", placed.map((p) => ({ col: p.col + 0.5, row: p.row + 0.5 })));
      if (!placed.length) return -Math.abs(Math.hypot(x - spawn.x, y - spawn.y) - 160);
      return Math.min(...placed.map((p) => Math.hypot(seat.col - p.col, seat.row - p.row))) * TILE - Math.abs(Math.hypot(x - spawn.x, y - spawn.y) - 250) * 0.14;
    };
    allowed.sort((a, b) => score(b) - score(a) || a.row - b.row || a.col - b.col);
    for (const seat of allowed) {
      if (spatial && !Number.isFinite(score(seat))) continue;
      chosen[slot] = seat;
      for (const cell of seat.danger) occupiedPaint.add(cell);
      if (placePaint(remaining - 1)) return true;
      for (const cell of seat.danger) occupiedPaint.delete(cell);
      chosen[slot] = null;
    }
    return false;
  }
  if (!placePaint(grade.paintCount)) throw new Error(`${grade.id}: complete native paint quota cannot fit without blocking the safe route`);
  for (let slot = 0; slot < chosen.length; slot++) {
    const seat = chosen[slot];
    paintFloors.push({ floorCol: seat.col, floorRow: seat.row, onGreedy: false, throatScore: 0 });
    forms.push(paintRequests[slot].form);
  }
  const volumes = [], volumeCells = /* @__PURE__ */ new Set();
  for (let slot = 0; slot < grade.volumeCount; slot++) {
    const allowed = candidates.filter((seat2) => {
      for (let row = seat2.row; row < seat2.row + grade.volumeRows; row++) for (let col = seat2.col; col < seat2.col + grade.volumeCols; col++)
        if (!isFloor(col, row) || blocked(col, row) || volumeCells.has(row * cols + col)) return false;
      return true;
    });
    const score = (seat2) => {
      const x = (seat2.col + grade.volumeCols / 2) * TILE, y = (seat2.row + grade.volumeRows / 2) * TILE;
      if (spatial) return spatialHostScore(
        x / TILE,
        y / TILE,
        slot,
        grade.volumeCount,
        "volume",
        [...chosen.filter((p) => p !== null).map((p) => ({ col: p.col + 0.5, row: p.row + 0.5 })), ...volumes.map((box2) => ({ col: box2.coreCol + 0.5, row: box2.coreRow + 0.5 }))]
      );
      const distance2 = Math.hypot(x - spawn.x, y - spawn.y);
      const spread = volumes.length ? Math.min(...volumes.map((box2) => Math.hypot(x - (box2.coreCol + 0.5) * TILE, y - (box2.coreRow + 0.5) * TILE))) : 0;
      return spread - Math.abs(distance2 - 210) * 0.6;
    };
    allowed.sort((a, b) => score(b) - score(a) || a.row - b.row || a.col - b.col);
    const seat = allowed.find((seat2) => !spatial || Number.isFinite(score(seat2)));
    if (!seat) throw new Error(`${grade.id}: no complete native volume footprint for Host ${slot + 1}`);
    const box = {
      minCol: seat.col,
      minRow: seat.row,
      maxCol: seat.col + grade.volumeCols - 1,
      maxRow: seat.row + grade.volumeRows - 1,
      coreCol: seat.col + Math.floor((grade.volumeCols - 1) / 2),
      coreRow: seat.row + Math.floor((grade.volumeRows - 1) / 2)
    };
    for (let row = box.minRow; row <= box.maxRow; row++) for (let col = box.minCol; col <= box.maxCol; col++) volumeCells.add(row * cols + col);
    volumes.push(box);
    forms.push({
      substrate: grade.volumeSubstrate,
      coverage: grade.volumeCoverage,
      continuity: "field",
      occupancy: "volume",
      portfolio: "ding",
      lexemes: { motion: "motion_anchor", sense: "sense_domain", rhythm: "rhythm_open", contact: "contact_volume_chaos" }
    });
  }
  return {
    hostTileMap,
    forms,
    pins: { wallEdges: [], paintFloors, corridorAabbs: volumes },
    paintCells: [...occupiedPaint].map((cell) => ({ x: (cell % cols + 0.5) * TILE, y: (Math.floor(cell / cols) + 0.5) * TILE })),
    volumes,
    safeRoute,
    paintAreaPx: occupiedPaint.size * TILE * TILE,
    volumeAreaPx: volumeCells.size * TILE * TILE
  };
}
var POLICY_KEYS = [
  "version",
  "sourceHash",
  "safe_max_extra_travel_px",
  "safe_max_approach_px",
  "contested_min_extra_travel_px",
  "contested_max_extra_travel_px",
  "deep_min_extra_travel_px",
  "deep_max_extra_travel_px",
  "max_search_approach_px",
  "node_spacing_px",
  "node_spread_weight",
  "host_min_approach_px",
  "host_max_approach_px",
  "host_region_cols",
  "host_region_rows"
];
function validateR100SpatialDeploymentPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing frozen spatial deployment policy");
  const row = value;
  const keys = POLICY_KEYS;
  if (Object.keys(row).length !== keys.length || keys.some((key) => !(key in row)) || row.version !== 1 || typeof row.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(row.sourceHash) || keys.filter((key) => key !== "sourceHash").some((key) => typeof row[key] !== "number" || !Number.isFinite(row[key]) || row[key] <= 0)) {
    throw new Error("Invalid frozen spatial deployment policy");
  }
  const policy = value;
  if (policy.safe_max_extra_travel_px > policy.contested_min_extra_travel_px || policy.contested_min_extra_travel_px >= policy.contested_max_extra_travel_px || policy.deep_min_extra_travel_px < policy.contested_min_extra_travel_px || policy.deep_min_extra_travel_px >= policy.deep_max_extra_travel_px || policy.safe_max_approach_px > policy.max_search_approach_px || policy.host_min_approach_px >= policy.host_max_approach_px || !Number.isInteger(policy.host_region_cols) || !Number.isInteger(policy.host_region_rows) || policy.host_region_cols > 32 || policy.host_region_rows > 32) throw new Error("Invalid spatial deployment ranges");
}
var DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function at(cols, col, row) {
  return row * cols + col;
}
function inBounds(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function measureOutline(land, cols, rows) {
  const ring = GAME_CONSTANTS.GENERATION.BORDER_RING;
  let landCount = 0;
  let minCol = cols;
  let minRow = rows;
  let maxCol = -1;
  let maxRow = -1;
  let ringLand = 0;
  let roughCells = 0;
  const edgeHas = [false, false, false, false];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at(cols, col, row)]) continue;
      landCount++;
      if (col < minCol) minCol = col;
      if (row < minRow) minRow = row;
      if (col > maxCol) maxCol = col;
      if (row > maxRow) maxRow = row;
      if (col < ring || row < ring || col >= cols - ring || row >= rows - ring) {
        ringLand++;
      }
      if (col === 0) edgeHas[0] = true;
      if (col === cols - 1) edgeHas[1] = true;
      if (row === 0) edgeHas[2] = true;
      if (row === rows - 1) edgeHas[3] = true;
      let touchesVoid = false;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny) || !land[at(cols, nx, ny)]) {
          touchesVoid = true;
          break;
        }
      }
      if (touchesVoid) roughCells++;
    }
  }
  const width = landCount === 0 ? 0 : maxCol - minCol + 1;
  const height = landCount === 0 ? 0 : maxRow - minRow + 1;
  const bboxArea = Math.max(1, width * height);
  const innerW = Math.max(0, cols - ring * 2);
  const innerH = Math.max(0, rows - ring * 2);
  const ringCells = cols * rows - innerW * innerH;
  return {
    landCount,
    fillRatio: landCount / (cols * rows),
    bbox: {
      minCol: landCount === 0 ? 0 : minCol,
      minRow: landCount === 0 ? 0 : minRow,
      maxCol: landCount === 0 ? 0 : maxCol,
      maxRow: landCount === 0 ? 0 : maxRow,
      width,
      height
    },
    bboxFill: landCount / bboxArea,
    borderOccupancy: ringCells === 0 ? 0 : ringLand / ringCells,
    edgesTouching: edgeHas.filter(Boolean).length,
    roughness: landCount === 0 ? 0 : roughCells / landCount
  };
}
var EPSILON2 = 1e-7;
var LEGACY_TERRAIN_BUDGET = { minPolygons: 1, maxPolygons: 12, maxPoints: 32, maxTotalPoints: 384 };
var FRAGMENT_TERRAIN_BUDGET = Object.freeze({ minPolygons: 0, maxPolygons: 128, maxPoints: 2048, maxTotalPoints: 8192 });
var cross2 = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function onSegment(a, b, p) {
  return Math.abs(cross2(a, b, p)) <= EPSILON2 && p.x >= Math.min(a.x, b.x) - EPSILON2 && p.x <= Math.max(a.x, b.x) + EPSILON2 && p.y >= Math.min(a.y, b.y) - EPSILON2 && p.y <= Math.max(a.y, b.y) + EPSILON2;
}
function intersects(a, b, c, d) {
  const abC = cross2(a, b, c), abD = cross2(a, b, d), cdA = cross2(c, d, a), cdB = cross2(c, d, b);
  return abC * abD < -EPSILON2 && cdA * cdB < -EPSILON2 || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function contains(polygon, point) {
  let inside2 = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (a.y > point.y !== b.y > point.y && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside2 = !inside2;
  }
  return inside2;
}
function validateNativeErosion(value, width = 1024, height = 768, budget = LEGACY_TERRAIN_BUDGET) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Array.isArray(value) || value.length < budget.minPolygons || value.length > budget.maxPolygons) throw new Error("Native erosion polygon count exceeds its explicit terrain budget");
  if (value.reduce((total, polygon) => total + (Array.isArray(polygon) ? polygon.length : 0), 0) > budget.maxTotalPoints) throw new Error("Native terrain total vertex budget exceeded");
  for (const polygon of value) {
    if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > budget.maxPoints) throw new Error("Native terrain polygon point budget exceeded");
    for (const point of polygon) {
      if (!point || typeof point !== "object" || Object.keys(point).sort().join(",") !== "x,y" || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > width || point.y < 0 || point.y > height)
        throw new Error("Native erosion point must have only finite in-bounds x/y");
    }
    const points = polygon;
    if (new Set(points.map((point) => `${point.x}:${point.y}`)).size !== points.length) throw new Error("Native erosion polygon repeats a point");
    const twiceArea = points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a.x * b.y - a.y * b.x;
    }, 0);
    if (Math.abs(twiceArea) < 128) throw new Error("Native erosion polygon area must be at least 64px\xB2");
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], previous = points[(i + points.length - 1) % points.length];
      if (Math.abs(cross2(previous, a, b)) <= EPSILON2 && (previous.x - a.x) * (b.x - a.x) + (previous.y - a.y) * (b.y - a.y) > 0)
        throw new Error("Native erosion adjacent edges overlap");
      for (let j = i + 1; j < points.length; j++) {
        if (j === i + 1 || i === 0 && j === points.length - 1) continue;
        if (intersects(a, b, points[j], points[(j + 1) % points.length])) throw new Error("Native erosion polygon self-intersects");
      }
    }
  }
  const polygons = value;
  for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++) {
    const a = polygons[i], b = polygons[j];
    if (contains(a, b[0]) || contains(b, a[0])) throw new Error("Native erosion polygons contain one another");
    for (let x = 0; x < a.length; x++) for (let y = 0; y < b.length; y++) {
      if (intersects(a[x], a[(x + 1) % a.length], b[y], b[(y + 1) % b.length])) throw new Error("Native erosion polygons overlap or touch");
    }
  }
}
function validateNativeTerrainOutline(value, width, height, erosion = [], budget = LEGACY_TERRAIN_BUDGET) {
  validateNativeErosion([value], width, height, budget);
  const outline = value;
  for (const hole of erosion) {
    if (hole.some((point) => !contains(outline, point))) throw new Error("Terrain erosion must remain inside the positive outline");
    for (let i = 0; i < outline.length; i++) for (let j = 0; j < hole.length; j++) {
      if (intersects(outline[i], outline[(i + 1) % outline.length], hole[j], hole[(j + 1) % hole.length]))
        throw new Error("Terrain erosion must not cross or touch the positive outline");
    }
  }
}
function validateNativeGroundEdgeOwnership(definition, budget = LEGACY_TERRAIN_BUDGET) {
  if (definition.authoredErosion !== void 0 && definition.authoredErosion !== true) throw new Error("Invalid authored erosion marker");
  if (definition.authoredErosion && definition.instances.some((instance) => instance.constructionVersion !== 4)) throw new Error("Authored erosion requires construction 4");
  const holders = definition.instances.filter((instance) => instance.groundEdgeWidth !== void 0);
  if (!holders.length) return;
  const primaryRelief = definition.instances.find((instance) => instance.role === "relief" && (instance.family ?? definition.family) === definition.family);
  if (!definition.authoredErosion || holders.length !== 1 || holders[0] !== primaryRelief || holders[0].constructionVersion !== 4 || holders[0].height > 6 || holders[0].groundEdgeWidth < 8 || holders[0].groundEdgeWidth > 24)
    throw new Error("Authored ground edge must belong to the unique first v4 low primary relief");
  validateNativeErosion(definition.erosion, definition.cols * 32, definition.rows * 32, budget);
}
var clamp3 = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function hash(x, y, seed2) {
  let h = Math.imul(x ^ seed2, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}
function field(x, y, seed2) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  return (hash(ix, iy, seed2) * (1 - fx) + hash(ix + 1, iy, seed2) * fx) * (1 - fy) + (hash(ix, iy + 1, seed2) * (1 - fx) + hash(ix + 1, iy + 1, seed2) * fx) * fy;
}
function random(seed2) {
  let s = seed2 >>> 0;
  return () => {
    s += 1831565813;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function channel(col, shift) {
  return col >>> shift & 255;
}
function sampleMasterMaterial(material, u, v, seed2, out, event = "compact") {
  if (material === "granular") {
    const scale = event === "loose" ? 5.5 : event === "cleaved" ? 10 : 14;
    const gx = u / scale, gy = v / (scale * 0.83), cx = Math.floor(gx), cy = Math.floor(gy);
    let nearest = 10, second = 10, identity = 0;
    for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
      const px = xx + 0.18 + hash(xx, yy, seed2 + 301) * 0.64, py = yy + 0.18 + hash(xx, yy, seed2 + 307) * 0.64;
      const dx2 = gx - px, dy2 = gy - py, d = dx2 * dx2 + dy2 * dy2;
      if (d < nearest) {
        second = nearest;
        nearest = d;
        identity = hash(xx, yy, seed2 + 311);
      } else if (d < second) second = d;
    }
    const interior = smooth(clamp3((second - nearest) * 4.2)), broad2 = field(u / 117, v / 63, seed2 + 317);
    out.tone = clamp3(0.36 + interior * 0.025 + (identity - 0.5) * 0.055 + (broad2 - 0.5) * 0.16);
    out.roughness = event === "cleaved" ? 0.74 : 0.91;
    out.relief = interior * (event === "loose" ? 0.045 : 0.025) + (broad2 - 0.5) * 0.13;
    return;
  }
  if (material === "membrane") {
    const broad2 = field(u / 103, v / 81, seed2 + 331), warp2 = field(u / 37, v / 71, seed2 + 337);
    const tension = Math.sin(v * 0.085 + u * 0.018 + warp2 * 2.7), crease = Math.pow(Math.max(0, tension), 18);
    const scuff = field(u / 11, v / 29, seed2 + 347);
    out.tone = clamp3(0.48 + (broad2 - 0.5) * 0.15 + (scuff - 0.5) * 0.055 - crease * 0.12 + (event === "cleaved" ? 0.065 : 0));
    out.roughness = event === "loose" ? 0.78 : event === "cleaved" ? 0.69 : 0.39;
    out.relief = (broad2 - 0.5) * 0.12 - crease * 0.28;
    return;
  }
  if (material === "gel") {
    const broad2 = field(u / 121, v / 79, seed2 + 359), flow = field(u / 91, v / 26, seed2 + 367);
    const curl = Math.sin(v * 0.047 + flow * 4 + Math.sin(u * 0.023) * 1.3);
    const inclusion = Math.max(0, field(u / 8, v / 24, seed2 + 373) - 0.63) * 0.6;
    out.tone = clamp3(0.38 + (broad2 - 0.5) * 0.18 + curl * 0.032 - inclusion + (event === "cleaved" ? 0.06 : 0));
    out.roughness = event === "loose" ? 0.66 : event === "cleaved" ? 0.51 : 0.24;
    out.relief = curl * 0.18 + (broad2 - 0.5) * 0.09 - inclusion * 0.26;
    return;
  }
  const warp = field(u / 113, v / 91, seed2 + 41) - 0.5;
  const a = u + warp * 12, b = v + field(u / 89, v / 67, seed2 + 47) * 7;
  const broad = field(a / 103, b / 71, seed2 + 59);
  const history = field(a / 71, b / 43, seed2 + 97) * 0.72 + field(a / 27, b / 19, seed2 + 131) * 0.28;
  const bias = event === "cleaved" ? 0.12 : event === "loose" ? 0.04 : -0.06;
  const exposure = smooth(clamp3((history + bias - 0.48) * 12));
  const stretch = material === "crystal" ? 2.2 : material === "glaze" ? 0.74 : 1;
  const pu = Math.floor(a / 2) * 2 / stretch, pv = Math.floor(b / 2) * 2;
  const cluster2 = field(pu / 23, pv / 15, seed2 + 173);
  const clusterStep = Math.floor(cluster2 * 5) / 4;
  const mottling = field(pu / 7, pv / 5, seed2 + 181);
  const grain = hash(Math.floor(u), Math.floor(v), seed2 + 191);
  const compactTone = 0.32 + (broad - 0.5) * 0.13 + (field(a / 32, b / 24, seed2 + 193) - 0.5) * 0.055;
  const faceTone = 0.55 + (broad - 0.5) * 0.12 + (clusterStep - 0.5) * 0.22 + (mottling - 0.5) * 0.045;
  const row = Math.floor(b / 26), section2 = Math.floor(a / 53);
  const markV = (row + 0.23 + hash(section2, row, seed2 + 211) * 0.5) * 26;
  const markU = (section2 + 0.2 + hash(section2, row, seed2 + 223) * 0.5) * 53;
  const dx = (a - markU) / (8 + hash(section2, row, seed2 + 227) * 13);
  const dy = b - markV + (a - markU) * 0.075;
  const mark = hash(section2, row, seed2 + 229) > 0.57 && exposure > 0.78 ? clamp3(1 - Math.abs(dx)) * clamp3(1.2 - Math.abs(dy)) : 0;
  const pore = exposure > 0.5 && cluster2 < 0.39 && grain < 0.07 ? 0.07 : 0;
  const chip = (grain - 0.5) * (event === "loose" ? 0.08 : 0.025);
  const compactRough = material === "glaze" ? 0.38 : material === "crystal" ? 0.64 : 0.85;
  const faceRough = material === "glaze" ? 0.72 : material === "crystal" ? 0.38 : 0.67;
  const loose = event === "loose";
  const aggregate = Math.floor(field(a / 5.5, b / 4.5, seed2 + 241) * 5) / 4;
  const looseTone = 0.37 + (broad - 0.5) * 0.12 + (aggregate - 0.5) * 0.27 + chip;
  out.tone = clamp3(loose ? looseTone : compactTone * (1 - exposure) + faceTone * exposure - mark * 0.12 - pore + chip, 0.1, 0.82);
  out.roughness = loose ? 0.94 : compactRough * (1 - exposure) + faceRough * exposure + mark * 0.07;
  const faceRelief = (clusterStep - 0.5) * 0.24 + (mottling - 0.5) * 0.08;
  out.relief = loose ? (aggregate - 0.5) * 0.48 : (1 - exposure) * 0.33 + faceRelief * exposure - mark * 0.18 + (broad - 0.5) * 0.1;
}
function bakeMasterGround(options) {
  const { width, height, seed: seed2, axis, material, palette, support } = options;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16777216) throw new Error("Invalid ground extent");
  const size = width * height;
  if (support && support.length !== size) throw new Error("Ground support extent mismatch");
  const albedo = new Uint8ClampedArray(size * 4), rgba = new Uint8ClampedArray(size * 4), heightField = new Float32Array(size), normals = new Float32Array(size * 3), roughness = new Float32Array(size), ambientOcclusion = new Float32Array(size), depositId = new Uint16Array(size), materialEvents = new Uint8Array(size);
  const tones = new Float32Array(size), sourceU = new Float32Array(size), sourceV = new Float32Array(size), edgeField = new Float32Array(size), surfaceSeed = new Uint32Array(size);
  const rnd = random(seed2), ca = Math.cos(axis), sa = Math.sin(axis), sample = { tone: 0, roughness: 0, relief: 0 };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, u = x * ca + y * sa, v = -x * sa + y * ca;
    sampleMasterMaterial(material, u, v, seed2, sample);
    heightField[i] = 0.45 + field(u / 180, v / 80, seed2 + 51) * 0.6 + sample.relief;
    tones[i] = sample.tone - 0.015;
    roughness[i] = sample.roughness;
    sourceU[i] = u;
    sourceV[i] = v;
    surfaceSeed[i] = seed2;
  }
  const beds = [];
  const count = (options.sources?.length ?? 3) * 4;
  for (let j = 0; j < count; j++) {
    const source = options.sources?.[Math.floor(j / 4) % (options.sources?.length ?? 1)];
    const sourceAngle = source?.rotation ?? axis, cx = source?.x ?? width * 0.5, cy = source?.y ?? height * 0.5;
    const caSource = Math.cos(sourceAngle), saSource = Math.sin(sourceAngle);
    const along = (j % 4 / 3 - 0.5) * (source?.length ?? width * 0.7) + (rnd() - 0.5) * 24;
    const across = (source?.width ?? 80) * (0.37 + rnd() * 0.38);
    const x = cx + caSource * along - saSource * across, y = cy + saSource * along + caSource * across;
    let angle = axis + (rnd() - 0.5) * 0.34, pressure = 0;
    for (const source2 of options.sources ?? []) {
      const d = Math.hypot((x - source2.x) / Math.max(source2.length, 0.01), (y - source2.y) / Math.max(source2.width * 2, 0.01)), w = Math.exp(-d * d);
      pressure = Math.max(pressure, w);
      angle += (source2.rotation - axis) * w * 0.45;
    }
    const length2 = material === "gel" ? 75 + rnd() * 65 : material === "membrane" ? 44 + rnd() * 63 : material === "granular" ? 24 + rnd() * 30 : material === "crystal" ? 55 + rnd() * 70 : material === "glaze" ? 32 + rnd() * 48 : 38 + rnd() * 59;
    const widthBed = material === "gel" ? 16 + rnd() * 24 : material === "membrane" ? 28 + rnd() * 41 : material === "granular" ? 18 + rnd() * 25 : material === "crystal" ? 6 + rnd() * 11 : material === "glaze" ? 22 + rnd() * 31 : 12 + rnd() * 23;
    const bevel = rnd() * 0.16, short = 0.14 + rnd() * 0.2;
    const points = material === "gel" ? [[-0.5, -0.18], [-0.26, -0.37], [0.22, -0.41], [0.49, -0.16], [0.41, 0.32], [0.03, 0.49], [-0.28, 0.23]] : material === "membrane" ? [[-0.49, -0.3], [-0.21, -0.48], [0.34, -0.32], [0.49, 0.21], [0.12, 0.4], [-0.36, 0.23]] : material === "granular" ? [[-0.42, -0.25], [-0.14, -0.49], [0.3, -0.36], [0.49, 0.14], [0.19, 0.42], [-0.34, 0.35]] : material === "glaze" ? [[-0.47, -0.26], [-0.18, -0.5], [0.34, -0.34], [0.5, 0.18], [0.06, 0.47], [-0.38, 0.24]] : material === "crystal" ? [[-0.5, -0.13], [-0.29, -0.39], [0.45, -0.28], [0.5, 0.01], [0.25, 0.34], [-0.43, 0.17]] : [[-0.5, -0.28], [-0.5 + short, -0.48], [0.5, -0.34], [0.33, 0.05], [0.39, 0.29], [-0.19 - bevel, 0.46], [-0.39, 0.18]];
    beds.push({ x, y, angle, length: length2, width: widthBed, rise: 0.16 + rnd() * 0.5 + pressure * 0.18, tone: (rnd() - 0.5) * 0.08, seed: Math.floor(rnd() * 4294967295), kind: 0, points });
    const tip = length2 * (0.44 + rnd() * 0.1), offset = (rnd() - 0.5) * widthBed * 0.3;
    beds.push({ x: x + Math.cos(angle) * tip - Math.sin(angle) * offset, y: y + Math.sin(angle) * tip + Math.cos(angle) * offset, angle: angle + (rnd() - 0.5) * 0.25, length: 25 + rnd() * 41, width: 15 + rnd() * 21, rise: 0.03, tone: 0, seed: Math.floor(rnd() * 4294967295), kind: 2, points: [[-0.5, -0.12], [-0.22, -0.5], [0.24, -0.37], [0.5, 0.08], [0.13, 0.46], [-0.4, 0.33]] });
    if (rnd() < 0.8) {
      const fragments = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < fragments; k++) {
        const shift = length2 * (0.43 + rnd() * 0.16), side = (rnd() - 0.5) * widthBed;
        beds.push({ x: x + Math.cos(angle) * shift - Math.sin(angle) * side, y: y + Math.sin(angle) * shift + Math.cos(angle) * side, angle: angle + (rnd() - 0.5) * 0.55, length: 9 + rnd() * 22, width: 5 + rnd() * 11, rise: 0.9 + rnd() * 0.6, tone: (rnd() - 0.5) * 0.15, seed: Math.floor(rnd() * 4294967295), kind: 1, points: [[-0.5, -0.3], [0.08, -0.5], [0.5, -0.1], [0.26, 0.5], [-0.5, 0.2]] });
      }
    }
  }
  let id = 0;
  for (const bed of beds) {
    id++;
    const c = Math.cos(bed.angle), s = Math.sin(bed.angle), rad = (bed.length + bed.width) * 0.55;
    const minX = Math.max(0, Math.floor(bed.x - rad)), maxX = Math.min(width - 1, Math.ceil(bed.x + rad)), minY = Math.max(0, Math.floor(bed.y - rad)), maxY = Math.min(height - 1, Math.ceil(bed.y + rad));
    const pts = bed.points.map(([x, y]) => [x * bed.length, y * bed.width]);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const dx = x - bed.x, dy = y - bed.y, u = dx * c + dy * s, v = -dx * s + dy * c;
      let edge = Infinity, inside2 = true;
      for (let p = 0; p < pts.length; p++) {
        const a = pts[p], b = pts[(p + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], d = (ex * (v - a[1]) - ey * (u - a[0])) / Math.hypot(ex, ey);
        if (d < 0) {
          inside2 = false;
          break;
        }
        edge = Math.min(edge, d);
      }
      if (!inside2) continue;
      const i = y * width + x;
      const exposed = clamp3(u / bed.length + 0.5), lip = bed.kind ? 2 : 3 + exposed * 6;
      const buried = smooth(clamp3((u / bed.length + 0.5) * 2.2));
      const bevel = smooth(clamp3(edge / lip)) * buried, slope = u / bed.length * 0.13;
      const mu = bed.kind === 1 ? u + bed.seed % 97 : x * ca + y * sa;
      const mv = bed.kind === 1 ? v : -x * sa + y * ca;
      const ms = bed.kind === 1 ? bed.seed : seed2;
      sampleMasterMaterial(material, mu, mv, ms, sample, bed.kind === 2 ? "loose" : "cleaved");
      if (bed.kind === 2) {
        const amount = smooth(clamp3(edge / 5)) * 0.86;
        if (amount < 0.08) continue;
        heightField[i] = heightField[i] + sample.relief * 0.06 * amount;
        tones[i] = tones[i] * (1 - amount) + (sample.tone + bed.tone) * amount;
        roughness[i] = roughness[i] * (1 - amount) + sample.roughness * amount;
        if (amount > 0.24) {
          materialEvents[i] = 2;
          sourceU[i] = mu;
          sourceV[i] = mv;
          surfaceSeed[i] = ms;
        }
        continue;
      }
      const h = 0.68 + bed.rise * bevel + slope + sample.relief * bevel;
      if (h < heightField[i]) continue;
      heightField[i] = h;
      depositId[i] = id;
      materialEvents[i] = 1;
      surfaceSeed[i] = ms;
      sourceU[i] = mu;
      sourceV[i] = mv;
      edgeField[i] = edge;
      const fracture2 = (1 - bevel) * exposed, compressed = clamp3((field(u / 44, v / 23, bed.seed + 83) - 0.53) * 4);
      const weight = bed.kind ? 1 : clamp3(bevel * 1.9);
      tones[i] = tones[i] * (1 - weight) + (sample.tone + bed.tone + fracture2 * 0.14 - compressed * 0.055) * weight;
      roughness[i] = clamp3(sample.roughness + fracture2 * 0.14, 0.1, 1);
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, p = i * 4, n = i * 3;
    if (support && !support[i]) {
      rgba[p + 3] = 255;
      continue;
    }
    const h = heightField[i], left = heightField[y * width + Math.max(0, x - 1)], right = heightField[y * width + Math.min(width - 1, x + 1)], up = heightField[Math.max(0, y - 1) * width + x], down = heightField[Math.min(height - 1, y + 1) * width + x];
    const nx = (left - right) * 0.39, ny = (up - down) * 0.39, nz = 1, inv = 1 / Math.hypot(nx, ny, nz);
    normals[n] = nx * inv;
    normals[n + 1] = ny * inv;
    normals[n + 2] = inv;
    let enclosure = 0;
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-8, -4], [8, 4]]) {
      const xx = clamp3(x + dx, 0, width - 1), yy = clamp3(y + dy, 0, height - 1);
      enclosure += Math.max(0, heightField[yy * width + xx] - h - 0.15);
    }
    const ao = clamp3(1 - enclosure * 0.047, 0.65, 1);
    ambientOcclusion[i] = ao;
    const u = sourceU[i], v = sourceV[i], sd = surfaceSeed[i];
    const endgrain = depositId[i] !== 0 && edgeField[i] < 4 && field(u / 11, v / 7, sd + 71) > 0.62;
    const grain = endgrain && hash(Math.floor(u / 2), Math.floor(v / 2), sd) > 0.77 ? 0.12 : 0;
    const mineral = field(u / 9, v / 6, sd + 37), poreZone = clamp3((mineral - 0.51) * 7);
    const granule = hash(Math.floor(u), Math.floor(v), sd + 17);
    const grit = materialEvents[i] === 2 && poreZone > 0.2 && granule > 0.88 ? (granule > 0.96 ? 0.075 : -0.065) * poreZone : 0;
    const tone = clamp3(tones[i] + grain + grit, 0.06, 0.88);
    for (let k = 0; k < 3; k++) {
      const shift = 16 - k * 8, dark = channel(palette.materialDark, shift) * 0.65 + channel(palette.floorDeep, shift) * 0.35;
      const light = channel(palette.materialLight, shift) * 0.76 + channel(palette.floorLight, shift) * 0.24;
      const color = dark + (light - dark) * tone;
      albedo[p + k] = Math.round(color);
      rgba[p + k] = Math.round(color * ao);
    }
    albedo[p + 3] = rgba[p + 3] = 255;
  }
  return { width, height, rgba, albedo, normals, heightField, roughness, ambientOcclusion, depositId, materialEvents };
}
var clamp012 = (n) => Math.max(0, Math.min(1, n));
var FAMILY_ID = { "folded-slab": 1, "fibre-knot": 2, "broken-shell": 3, "granular-ridge": 4, "membrane-rim": 5, "gel-flow": 6 };
function compileNativeVolumeRaster(meshes, config) {
  const pixelSize = config.pixelSize ?? 1, cellSize = config.supportCellSize ?? 8;
  if (![config.x, config.y, config.width, config.height, pixelSize, cellSize, config.opticalHeight].every(Number.isFinite) || config.width <= 0 || config.height <= 0 || pixelSize < 1 || cellSize < pixelSize || config.opticalHeight < 0 || !Number.isInteger(pixelSize) || !Number.isInteger(cellSize)) throw new Error("Invalid native volume raster bounds");
  const width = Math.ceil(config.width / pixelSize), height = Math.ceil(config.height / pixelSize);
  if (width * height > 4194304) throw new Error("Native volume raster exceeds its bounded 4M pixel allocation");
  const size = width * height, columns = Math.ceil(config.width / cellSize), rows = Math.ceil(config.height / cellSize);
  const matter = new Uint8Array(size), objectId = new Int32Array(size), material = new Uint8Array(size), family = new Uint8Array(size), region = new Uint8Array(size);
  const heightField = new Float32Array(size), normals = new Float32Array(size * 3), uv6 = new Float32Array(size * 2);
  const groundEdgePixels = meshes.some((mesh) => mesh.groundEdgeStart !== void 0) ? new Uint32Array(Math.ceil(size / 32)) : void 0;
  heightField.fill(-Infinity);
  const usedIds = /* @__PURE__ */ new Set();
  for (const mesh of meshes) {
    if (usedIds.has(mesh.spec.id)) throw new Error(`Duplicate native volume id ${mesh.spec.id}`);
    usedIds.add(mesh.spec.id);
    const p = mesh.positions, n = mesh.normals, tex = mesh.uv;
    for (let f = 0; f < mesh.triangleCount; f++) {
      const groundEdge = mesh.groundEdgeStart !== void 0 && f >= mesh.groundEdgeStart.triangle;
      const ia = mesh.indices[f * 3], ib = mesh.indices[f * 3 + 1], ic = mesh.indices[f * 3 + 2];
      const a = ia * 3, b = ib * 3, c = ic * 3;
      const ax = (p[a] - config.x) / pixelSize, ay = (p[a + 1] - config.y) / pixelSize;
      const bx = (p[b] - config.x) / pixelSize, by = (p[b + 1] - config.y) / pixelSize;
      const cx = (p[c] - config.x) / pixelSize, cy = (p[c + 1] - config.y) / pixelSize;
      const area2 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area2) < 1e-7) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
      const inv = 1 / area2, waX = (by - cy) * inv, waY = (cx - bx) * inv, wbX = (cy - ay) * inv, wbY = (ax - cx) * inv;
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
          if (groundEdgePixels) {
            const word = index >>> 5, bit = 1 << (index & 31);
            groundEdgePixels[word] = groundEdge ? groundEdgePixels[word] | bit : groundEdgePixels[word] & ~bit;
          }
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
          uv6[index * 2] = tex[ia * 2] * wa + tex[ib * 2] * wb + tex[ic * 2] * wc;
          uv6[index * 2 + 1] = tex[ia * 2 + 1] * wa + tex[ib * 2 + 1] * wb + tex[ic * 2 + 1] * wc;
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
    for (let direction2 = 0; direction2 < 8; direction2++) {
      const angle = direction2 / 8 * Math.PI * 2;
      let horizon = 0;
      for (const distance2 of [3, 7, 14]) {
        const sx = Math.round(x + Math.cos(angle) * distance2), sy = Math.round(y + Math.sin(angle) * distance2);
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const h = heightField[sy * width + sx] - heightField[i];
        horizon = Math.max(horizon, Math.atan2(Math.max(0, h - 0.6), distance2 * pixelSize));
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
    uv: uv6,
    occupiedPixels: new Uint32Array(occupied),
    ambientOcclusion,
    ...groundEdgePixels ? { groundEdgePixels } : {}
  };
}
function nativeVolumeHeightAt(raster, x, y) {
  const px = Math.floor((x - raster.config.x) / raster.pixelSize), py = Math.floor((y - raster.config.y) / raster.pixelSize);
  return px < 0 || py < 0 || px >= raster.width || py >= raster.height ? -Infinity : raster.heightField[py * raster.width + px];
}
function nativeVolumeLightVisibility(raster, x, y, z, light) {
  const dx = light.x - x, dy = light.y - y, dz = light.z - z;
  const distance2 = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.min(48, Math.max(2, Math.ceil(distance2 / 4)));
  let visibility = 1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps, rayZ = z + dz * t + 1.1;
    const height = nativeVolumeHeightAt(raster, x + dx * t, y + dy * t);
    if (height > rayZ) {
      const blockage = clamp012((height - rayZ) / 2.5);
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
    __publicField(this, "albedo");
    __publicField(this, "roughness");
    __publicField(this, "emission");
    __publicField(this, "shadingNormals");
    __publicField(this, "materialSets");
    __publicField(this, "surfaceSlots");
    __publicField(this, "shadows", /* @__PURE__ */ new WeakMap());
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
    const view2 = options.viewport, emissionScale = options.emissionScale ?? 1;
    for (let at2 = 0; at2 < r.occupiedPixels.length; at2++) {
      const index = r.occupiedPixels[at2], x = r.config.x + (index % width + 0.5) * pixelSize;
      const visibility = options.visibility ? clamp012(options.visibility[index]) : 1;
      if (visibility <= 0) continue;
      const y = r.config.y + (Math.floor(index / width) + 0.5) * pixelSize;
      if (view2 && (x < view2.x || y < view2.y || x >= view2.x + view2.width || y >= view2.y + view2.height)) continue;
      const q = index * 3, z = r.heightField[index], nx = this.shadingNormals[q], ny = this.shadingNormals[q + 1], nz = this.shadingNormals[q + 2];
      const ao = r.ambientOcclusion[index], ambient = options.ambient * ao;
      let lr = ambient, lg = ambient, lb = ambient, sr = 0, sg = 0, sb = 0;
      for (let j = 0; j < lights.length; j++) {
        const light = lights[j];
        if (light.radius <= 0 || light.intensity <= 0) continue;
        const dx = light.x - x, dy = light.y - y, dz = light.z - z, distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared >= light.radius * light.radius) continue;
        const distance2 = Math.sqrt(distanceSquared), inv = 1 / Math.max(0.01, distance2);
        const ndotl = Math.max(0, (nx * dx + ny * dy + nz * dz) * inv);
        if (ndotl <= 0) continue;
        const visibility2 = this.lightVisibilityAt(index, light);
        if (visibility2 <= 1e-3) continue;
        const falloff = 1 - distance2 / light.radius;
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
      output[index] = 255 * clamp012(strength) * (1 - nativeVolumeLightVisibility(r, wx, wy, 0, light));
    }
  }
};
var WORLD_PROFILE_DATA = [
  {
    "id": "ash-strata",
    "label": "\u65E0\u5F69\u5C42\u539F",
    "description": "\u6C89\u79EF\u5C42\u7247\u4E0E\u5931\u8272\u65AD\u9762",
    "material": "strata",
    "surface": {
      "substrate": "strata",
      "coating": "strata",
      "organization": "bands",
      "coverage": 0.46,
      "wear": 0.52,
      "deposits": 0.52,
      "scale": 1.1,
      "relief": 0.52,
      "contrast": 0.75,
      "regionScale": 1.15,
      "quietness": 0.48,
      "formScale": 1.3,
      "fragmentation": 0.65,
      "accentCoverage": 0.02
    },
    "palette": {
      "void": 592137,
      "shadow": 1381653,
      "floorDeep": 2302755,
      "floor": 3421236,
      "floorLight": 4539717,
      "materialDark": 3158064,
      "materialMid": 5855577,
      "materialLight": 7895160,
      "faceLight": 10066329,
      "accentDim": 5395026,
      "accent": 11184810,
      "accentLight": 13421772,
      "peak": 15658734,
      "actorDark": 1842204,
      "actorMid": 12237498,
      "actorLight": 16777215,
      "ground": 3421236,
      "groundLight": 4539717,
      "groundDark": 2302755,
      "wall": 5855577,
      "wallLight": 10066329,
      "wallDark": 3158064
    }
  },
  {
    "id": "crystal-fibre",
    "label": "\u6676\u5316\u6797\u5E8A",
    "description": "\u7EA4\u7EF4\u5E8A\u6CBF\u7EDF\u4E00\u65B9\u5411\u6676\u5316",
    "material": "crystal",
    "surface": {
      "substrate": "strata",
      "coating": "crystal",
      "organization": "clusters",
      "coverage": 0.66,
      "wear": 0.43,
      "deposits": 0.42,
      "scale": 0.95,
      "relief": 0.58,
      "contrast": 0.85,
      "regionScale": 1.1,
      "quietness": 0.5,
      "formScale": 1.5,
      "fragmentation": 0.32,
      "accentCoverage": 0.18
    },
    "palette": {
      "void": 856090,
      "shadow": 1449e3,
      "floorDeep": 2303798,
      "floor": 3158599,
      "floorLight": 4472919,
      "materialDark": 3488592,
      "materialMid": 5001839,
      "materialLight": 7173782,
      "faceLight": 10136256,
      "accentDim": 5326174,
      "accent": 7956100,
      "accentLight": 11444401,
      "peak": 14476773,
      "actorDark": 2433318,
      "actorMid": 11702376,
      "actorLight": 15584925,
      "ground": 3158599,
      "groundLight": 4472919,
      "groundDark": 2303798,
      "wall": 5001839,
      "wallLight": 10136256,
      "wallDark": 3488592
    }
  },
  {
    "id": "ivory-basin",
    "label": "\u5438\u5149\u91C9\u539F",
    "description": "\u539A\u91C9\u6C89\u79EF\u4E0E\u5438\u5149\u7ED3\u8282",
    "material": "glaze",
    "surface": {
      "substrate": "strata",
      "coating": "glaze",
      "organization": "patches",
      "coverage": 0.54,
      "wear": 0.57,
      "deposits": 0.55,
      "scale": 1.2,
      "relief": 0.5,
      "contrast": 0.72,
      "regionScale": 1.4,
      "quietness": 0.55,
      "formScale": 1.6,
      "fragmentation": 0.42,
      "accentCoverage": 0.11
    },
    "palette": {
      "void": 1448997,
      "shadow": 2699322,
      "floorDeep": 7367527,
      "floor": 11182476,
      "floorLight": 12564125,
      "materialDark": 4868945,
      "materialMid": 7695973,
      "materialLight": 9799795,
      "faceLight": 13813675,
      "accentDim": 6443617,
      "accent": 8809848,
      "accentLight": 11639443,
      "peak": 15590084,
      "actorDark": 2369326,
      "actorMid": 4936539,
      "actorLight": 12750939,
      "ground": 11182476,
      "groundLight": 12564125,
      "groundDark": 7367527,
      "wall": 7695973,
      "wallLight": 13813675,
      "wallDark": 4868945
    }
  },
  {
    "id": "carmine-lacquer",
    "label": "\u7329\u91C9\u5C42\u539F",
    "description": "\u9971\u548C\u7EDB\u91C9\u4E0E\u9752\u84DD\u88F8\u5E8A",
    "material": "glaze",
    "surface": {
      "substrate": "strata",
      "coating": "glaze",
      "organization": "patches",
      "coverage": 0.68,
      "wear": 0.28,
      "deposits": 0.55,
      "scale": 1.2,
      "relief": 0.5,
      "contrast": 0.65,
      "regionScale": 1.4,
      "quietness": 0.46,
      "formScale": 1.45,
      "fragmentation": 0.42,
      "accentCoverage": 0.14
    },
    "palette": {
      "void": 1448997,
      "shadow": 1512231,
      "floorDeep": 1320759,
      "floor": 2315112,
      "floorLight": 4361364,
      "materialDark": 5247786,
      "materialMid": 9774917,
      "materialLight": 13980262,
      "faceLight": 15963525,
      "accentDim": 2441094,
      "accent": 3571652,
      "accentLight": 7522780,
      "peak": 16764589,
      "actorDark": 2369326,
      "actorMid": 4936539,
      "actorLight": 12750939,
      "ground": 2315112,
      "groundLight": 4361364,
      "groundDark": 1320759,
      "wall": 9774917,
      "wallLight": 15963525,
      "wallDark": 5247786
    }
  },
  {
    "id": "cobalt-gold",
    "label": "\u94B4\u84DD\u91D1\u8109",
    "description": "\u94B4\u84DD\u6676\u5C42\u4E0E\u91D1\u8272\u5171\u751F\u6C89\u79EF",
    "material": "crystal",
    "surface": {
      "substrate": "strata",
      "coating": "crystal",
      "organization": "bands",
      "coverage": 0.62,
      "wear": 0.34,
      "deposits": 0.58,
      "scale": 0.95,
      "relief": 0.58,
      "contrast": 0.85,
      "regionScale": 1.2,
      "quietness": 0.42,
      "formScale": 1.4,
      "fragmentation": 0.35,
      "accentCoverage": 0.44
    },
    "palette": {
      "void": 856090,
      "shadow": 1449e3,
      "floorDeep": 1056331,
      "floor": 2309512,
      "floorLight": 4221904,
      "materialDark": 6961177,
      "materialMid": 11889444,
      "materialLight": 14131528,
      "faceLight": 15781518,
      "accentDim": 1785949,
      "accent": 3052190,
      "accentLight": 8112572,
      "peak": 16773308,
      "actorDark": 2433318,
      "actorMid": 11702376,
      "actorLight": 15584925,
      "ground": 2309512,
      "groundLight": 4221904,
      "groundDark": 1056331,
      "wall": 11889444,
      "wallLight": 15781518,
      "wallDark": 6961177
    }
  }
];
var WORLD_PROFILES = WORLD_PROFILE_DATA;
function worldProfileById(id) {
  const profile = WORLD_PROFILES.find((value) => value.id === id);
  if (!profile) throw new Error(`Unknown world profile: ${id}`);
  return profile;
}
var MASTER_SCENES_SOURCE_HASH = "6bf6dbcd959875f08124d628c3c08807dd7d85faaa4e2465a7cd839d7c98cb57";
var TILE2 = 32;
var SUPPORT = 8;
var HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
var DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function insidePolygon(points, x, y) {
  let inside2 = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside2 = !inside2;
  }
  return inside2;
}
function solidCoverage(meshes, cols, rows) {
  const coverage = new Uint8Array(cols * rows), half = SUPPORT / 2;
  for (const mesh of meshes) for (let face = 0; face < mesh.triangleCount; face++) {
    const p = mesh.positions, a = mesh.indices[face * 3] * 3, b = mesh.indices[face * 3 + 1] * 3, c = mesh.indices[face * 3 + 2] * 3;
    const xs = [p[a], p[b], p[c]], ys = [p[a + 1], p[b + 1], p[c + 1]];
    if (Math.abs((xs[1] - xs[0]) * (ys[2] - ys[0]) - (ys[1] - ys[0]) * (xs[2] - xs[0])) < 1e-7) continue;
    const minCol = Math.max(0, Math.floor(Math.min(...xs) / SUPPORT)), maxCol = Math.min(cols - 1, Math.floor(Math.max(...xs) / SUPPORT));
    const minRow = Math.max(0, Math.floor(Math.min(...ys) / SUPPORT)), maxRow = Math.min(rows - 1, Math.floor(Math.max(...ys) / SUPPORT));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const index = row * cols + col;
      if (coverage[index]) continue;
      const x = (col + 0.5) * SUPPORT, y = (row + 0.5) * SUPPORT;
      let overlaps = true;
      for (let edge = 0; edge < 3; edge++) {
        const next = (edge + 1) % 3, nx = ys[next] - ys[edge], ny = xs[edge] - xs[next];
        const pa = xs[0] * nx + ys[0] * ny, pb = xs[1] * nx + ys[1] * ny, pc = xs[2] * nx + ys[2] * ny;
        const center2 = x * nx + y * ny, radius = half * (Math.abs(nx) + Math.abs(ny));
        if (Math.max(pa, pb, pc) <= center2 - radius + 1e-7 || Math.min(pa, pb, pc) >= center2 + radius - 1e-7) {
          overlaps = false;
          break;
        }
      }
      if (overlaps) coverage[index] = 1;
    }
  }
  return coverage;
}
function createMasterWorld(definition, seed2, frozen) {
  if (!Number.isSafeInteger(seed2) || seed2 < 0 || seed2 > 4294967295) throw new Error("\u79CD\u5B50\u5FC5\u987B\u662F 0\u20134294967295 \u7684\u6574\u6570");
  if (frozen?.spatialDeployment) validateR100SpatialDeploymentPolicy(frozen.spatialDeployment);
  const width = definition.cols * TILE2, height = definition.rows * TILE2;
  const positiveTerrain = Object.prototype.hasOwnProperty.call(definition, "terrainOutline");
  if (definition.fragmentShapeVersion !== void 0 && (definition.fragmentShapeVersion !== "rectilinear-fragment-v1" || !positiveTerrain)) throw new Error("Invalid compiled fragment terrain identity");
  const terrainBudget = definition.fragmentShapeVersion === "rectilinear-fragment-v1" ? FRAGMENT_TERRAIN_BUDGET : void 0;
  if (positiveTerrain) validateNativeTerrainOutline(definition.terrainOutline, width, height, definition.erosion, terrainBudget);
  const land = new Uint8Array(definition.cols * definition.rows), walls = new Uint8Array(land.length);
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  for (let row = 0; row < definition.rows; row++) for (let col = 0; col < definition.cols; col++) {
    const i = row * definition.cols + col;
    if (!positiveTerrain) land[i] = col >= 1 && row >= 1 && col < definition.cols - 1 && row < definition.rows - 1 && !(col < 3 && row < 3) && !(col > definition.cols - 4 && row > definition.rows - 4) ? 1 : 0;
    flowAngle[i] = definition.axis + Math.sin(row * 0.34) * 0.06;
    deposition[i] = 0.48 + Math.sin(col * 0.23 + row * 0.1) * 0.15;
  }
  const cols = width / SUPPORT, rows = height / SUPPORT;
  const matter = new Uint8Array(cols * rows), erosion = new Uint8Array(matter.length);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = (col + 0.5) * SUPPORT, y = (row + 0.5) * SUPPORT, index = row * cols + col;
    const floor = positiveTerrain ? insidePolygon(definition.terrainOutline, x, y) : land[Math.floor(y / TILE2) * definition.cols + Math.floor(x / TILE2)] === 1;
    erosion[index] = floor && definition.erosion.some((polygon) => insidePolygon(polygon, x, y)) ? 1 : 0;
    matter[index] = floor && !erosion[index] ? 1 : 0;
    if (positiveTerrain && matter[index]) land[Math.floor(y / TILE2) * definition.cols + Math.floor(x / TILE2)] = 1;
  }
  const matterAt = (x, y) => x >= 0 && y >= 0 && x < width && y < height && matter[Math.floor(y / SUPPORT) * cols + Math.floor(x / SUPPORT)] === 1;
  validateNativeGroundEdgeOwnership(definition, terrainBudget);
  const terrainEdges = positiveTerrain ? [definition.terrainOutline, ...definition.erosion] : definition.erosion;
  const roles = /* @__PURE__ */ new Map();
  const meshes = definition.instances.map((instance) => {
    const { role, ...geometry } = instance;
    roles.set(instance.id, role);
    return buildNativeVolume(
      { ...geometry, blocking: role === "solid" ? 1 : 0, family: instance.family ?? definition.family, seed: seed2 ^ Math.imul(instance.id, 104729) },
      instance.groundEdgeWidth === void 0 ? void 0 : { polygons: terrainEdges, width, height, matterAt }
    );
  });
  const raster = compileNativeVolumeRaster(meshes, { x: 0, y: 0, width, height, pixelSize: 1, supportCellSize: SUPPORT, opticalHeight: 24 });
  const roleAt = (x, y) => {
    if (!matterAt(x, y)) return null;
    return roles.get(raster.objectId[Math.floor(y) * raster.width + Math.floor(x)]) ?? null;
  };
  const solids = solidCoverage(meshes.filter((mesh) => roles.get(mesh.spec.id) === "solid"), cols, rows);
  const tiles = Array.from({ length: rows }, (_, row) => Array.from(
    { length: cols },
    (_2, col) => !matter[row * cols + col] ? 3 : solids[row * cols + col] ? 0 : 1
    /* FLOOR */
  ));
  const tileMap = { cols, rows, tileSize: SUPPORT, tiles }, grid = new TileGrid(tileMap);
  const center2 = (cell) => ({ x: (cell % cols + 0.5) * SUPPORT, y: (Math.floor(cell / cols) + 0.5) * SUPPORT });
  const seats = new Uint8Array(cols * rows);
  for (let i = 0; i < seats.length; i++) seats[i] = grid.isWalkable(i % cols, Math.floor(i / cols)) && bodyHasSupport(grid, center2(i), HALF_BODY, HALF_BODY) ? 1 : 0;
  function nearest(target, available) {
    let best = -1, distance2 = Infinity;
    for (let i = 0; i < available.length; i++) {
      if (!available[i]) continue;
      const p = center2(i), d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
      if (d < distance2) {
        best = i;
        distance2 = d;
      }
    }
    if (best < 0) throw new Error("\u6784\u9020\u6CA1\u6709\u7559\u4E0B\u539F\u751F20px\u8EAB\u4F53\u7684\u5B89\u5168\u7AD9\u4F4D");
    return best;
  }
  const start = nearest({ x: definition.spawn_x, y: definition.spawn_y }, seats), reachable = new Uint8Array(seats.length), queue = [start];
  reachable[start] = 1;
  for (let at2 = 0; at2 < queue.length; at2++) {
    const cell = queue[at2], c = cell % cols, r = Math.floor(cell / cols), p = center2(cell);
    for (const [dx, dy] of DIRECTIONS) {
      const x = c + dx, y = r + dy, next = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows || !seats[next] || reachable[next]) continue;
      if (bodyDisplacementFraction(grid, p, HALF_BODY, HALF_BODY, dx * SUPPORT, dy * SUPPORT) < 1) continue;
      reachable[next] = 1;
      queue.push(next);
    }
  }
  const spawnPoint = center2(start), exitPoint = center2(nearest({ x: definition.exit_x, y: definition.exit_y }, reachable));
  const searchPoint = center2(nearest({ x: definition.search_x, y: definition.search_y }, reachable));
  const enemyPoint = center2(nearest({ x: definition.enemy_x, y: definition.enemy_y }, reachable));
  if (Math.hypot(spawnPoint.x - definition.spawn_x, spawnPoint.y - definition.spawn_y) > 64) throw new Error("\u6BCD\u7248\u5165\u53E3\u88AB\u5DE8\u6784\u6324\u51FA\u540C\u4E00\u89C2\u5BDF\u533A");
  const source = BUILD_LAB_PLACEMENTS.find((row) => row.scene === "watched" && row.kind === "enemy" && row.sense === "sense_hear");
  const form = { substrate: source.substrate, coverage: source.coverage, continuity: "monolith", portfolio: "jia", occupancy: "floor", lexemes: { motion: source.motion, sense: source.sense, rhythm: source.rhythm, contact: source.contact } };
  const physicalLand = Uint8Array.from(tiles.flat(), (v) => v === 3 ? 0 : 1), physicalWalls = Uint8Array.from(tiles.flat(), (v) => v === 0 ? 1 : 0);
  const fragmentTypeId = "frag-outdoor";
  const grade = frozen?.grade ?? POLLUTION_GRADE_DEFINITIONS.find((item) => item.id === definition.grade);
  const pollution = createMasterPollution(grade, seed2, grid, reachable, start, [exitPoint, searchPoint], frozen?.spatialDeployment);
  const outline = { seed: seed2, attempt: 0, cols, rows, tileSize: SUPPORT, land: physicalLand, tileMap, metrics: measureOutline(physicalLand, cols, rows) };
  const enemyCell = { col: Math.floor(enemyPoint.x / SUPPORT), row: Math.floor(enemyPoint.y / SUPPORT) };
  const layout = {
    seed: seed2,
    paintGeometryVersion: 2,
    fragmentTypeId,
    recipeId: `r100-art-lab:${definition.id}`,
    contaminationAge: "new",
    ruinSeverity: "broken",
    tileMap,
    ruins: { seed: seed2, attempt: 0, fragmentTypeId, outline, walls: physicalWalls, features: [], tileMap, metrics: { wallCount: physicalWalls.reduce((a, b) => a + b, 0), wallRatio: physicalWalls.reduce((a, b) => a + b, 0) / physicalLand.length, featureCount: meshes.length, leftoverConnected: true } },
    walkableMask: grid,
    spawnPoint,
    extractionPoint: { id: "master-exit", position: exitPoint, triggerRadius: GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS },
    kindlingNodes: [{ id: "master-search", position: searchPoint, tier: "safe", allowWeapon: false }],
    contaminantNodes: [],
    enemySpawns: [{ id: "master-listener", type: "rewriter", spawn: enemyCell, facing: source.facing, patrol: { mode: "static", waypoints: [enemyCell] }, form }],
    landmarks: [],
    contaminationPins: pollution.pins,
    contaminationDraw: { forms: [form, ...pollution.forms], warnings: [] }
  };
  const baseProfile = frozen?.profile ?? worldProfileById(definition.profile);
  const sample = { profile: { ...baseProfile, surface: { ...baseProfile.surface, quietness: definition.ground_quietness, contrast: definition.ground_contrast, coverage: definition.ground_coverage } }, topologyId: "loops", seed: seed2, cols: definition.cols, rows: definition.rows, tileSize: TILE2, land, walls, spawn: spawnPoint, exit: exitPoint, formations: [], flowAngle, deposition };
  const sight = { cols, rows, tileSize: SUPPORT, version: 0, isOpaque: (col, row) => col < 0 || row < 0 || col >= cols || row >= rows || !matter[row * cols + col] };
  let hash2 = 2166136261;
  for (const mesh of meshes) for (const v of mesh.positions) {
    hash2 = Math.imul(hash2 ^ Math.round(v * 100), 16777619);
  }
  for (const v of physicalWalls) hash2 = Math.imul(hash2 ^ v, 16777619);
  for (const v of matter) hash2 = Math.imul(hash2 ^ v, 16777619);
  return { ...frozen?.spatialDeployment ? { spatialDeployment: frozen.spatialDeployment } : {}, definition, meshes, raster, sample, layout, hostTileMap: pollution.hostTileMap, pollution, sight, combat: grid, matterAt, roleAt, diagnostics: {
    identity: definition.id,
    family: definition.family,
    grade: definition.grade,
    seed: seed2,
    sourceHash: MASTER_SCENES_SOURCE_HASH,
    geometryFingerprint: (hash2 >>> 0).toString(16).padStart(8, "0"),
    qualification: "author-local-art-lab; not a production-world admission",
    projection: "native XY topdown; height projection 0",
    nativeCanvas: [960, 640],
    cameraZoom: 1.5,
    actorBody: HALF_BODY * 2,
    movementPxPerSecond: 80,
    supportCell: SUPPORT,
    triangles: meshes.reduce((n, m) => n + m.triangleCount, 0),
    reachableBodySeats: queue.length,
    spawnPoint,
    exitPoint,
    searchPoint,
    enemyPoint,
    sightPolicy: "only missing terrain and authored light erosion; ordinary relief/solid scenery is transparent",
    erosionCells: erosion.reduce((count, value) => count + value, 0),
    solidCells: physicalWalls.reduce((count, value) => count + value, 0),
    physicalRoles: definition.instances.map(({ id, role }) => ({ id, role })),
    geometryBeforeDeployment: true,
    dynamicTopology: false,
    gradeMechanics: true,
    paintHosts: grade.paintCount,
    volumeHosts: grade.volumeCount,
    paintContactAreaPx: pollution.paintAreaPx,
    volumeBoundsAreaPx: pollution.volumeAreaPx,
    chaosRateStart: grade.chaosStartRate,
    chaosRateEnd: grade.chaosEndRate,
    materialSounds: "registered material sources consume the same visible pressure clock; two low-priority voices, distance falloff; perceptual review recorded separately"
  } };
}
var RECTILINEAR_FRAGMENT_VERSION = "rectilinear-fragment-v1";
var FragmentShapeError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "FragmentShapeError";
  }
};
var FRAGMENT_SHAPE_LIMITS = Object.freeze({
  maxRectangles: 128,
  maxGridCells: 65536,
  maxFrameDimension: 16384,
  maxSourceVertices: 2048,
  maxOutputVertices: 8192
});
function validateFragmentRequest(request) {
  if (!request || typeof request !== "object") throw new FragmentShapeError("INVALID_INPUT", "A fragment request is required");
  if (request.algorithmVersion !== RECTILINEAR_FRAGMENT_VERSION) throw new FragmentShapeError("UNSUPPORTED_VERSION", `Unsupported fragment algorithm: ${String(request.algorithmVersion)}`);
  if (!Number.isInteger(request.edgeSeed) || request.edgeSeed < 0 || request.edgeSeed > 4294967295) throw new FragmentShapeError("INVALID_INPUT", "edgeSeed must be an unsigned 32-bit integer");
  const layout = request.layout;
  if (!layout || typeof layout !== "object" || Array.isArray(layout) || layout.worldScale !== 2) throw new FragmentShapeError("INVALID_INPUT", "v1 requires a layout object with worldScale: 2; coordinates must be authoring units, not world pixels");
  if (!Array.isArray(layout.authoringFrame) || layout.authoringFrame.length !== 2 || ![layout.authoringFrame[0], layout.authoringFrame[1]].every((n) => Number.isFinite(n) && n > 0)) throw new FragmentShapeError("INVALID_INPUT", "authoringFrame must contain two finite positive dimensions");
  if (layout.authoringFrame.some((n) => n > FRAGMENT_SHAPE_LIMITS.maxFrameDimension)) throw new FragmentShapeError("BUDGET_EXCEEDED", "Authoring frame exceeds the v1 coordinate budget");
  if (!Array.isArray(layout.landRects) || !Array.isArray(layout.voidRects) || layout.landRects.length === 0) throw new FragmentShapeError("INVALID_INPUT", "landRects must be nonempty and voidRects must be an array");
  if (layout.landRects.length + layout.voidRects.length > FRAGMENT_SHAPE_LIMITS.maxRectangles) throw new FragmentShapeError("BUDGET_EXCEEDED", "Rectangle count exceeds the v1 budget");
  const xs = /* @__PURE__ */ new Set();
  const ys = /* @__PURE__ */ new Set();
  for (const rectangle of [...layout.landRects, ...layout.voidRects]) {
    if (!Array.isArray(rectangle) || rectangle.length !== 4 || ![rectangle[0], rectangle[1], rectangle[2], rectangle[3]].every(Number.isFinite)) throw new FragmentShapeError("INVALID_INPUT", "Every rectangle must contain four finite coordinates");
    const [x, y, width, height] = rectangle;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > layout.authoringFrame[0] || y + height > layout.authoringFrame[1]) throw new FragmentShapeError("INVALID_INPUT", "Rectangles must have positive size and lie within authoringFrame");
    xs.add(x);
    xs.add(x + width);
    ys.add(y);
    ys.add(y + height);
  }
  if ((xs.size - 1) * (ys.size - 1) > FRAGMENT_SHAPE_LIMITS.maxGridCells) throw new FragmentShapeError("BUDGET_EXCEEDED", "Rectangle partition exceeds the v1 grid budget");
}
var area = (points) => points.reduce((total, point, index) => {
  const next = points[(index + 1) % points.length];
  return total + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;
var orientation = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
var onSegment2 = (p, a, b) => orientation(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
function intersects2(a, b, c, d) {
  const abC = orientation(a, b, c), abD = orientation(a, b, d), cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  if ((abC > 0 && abD < 0 || abC < 0 && abD > 0) && (cdA > 0 && cdB < 0 || cdA < 0 && cdB > 0)) return true;
  return onSegment2(c, a, b) || onSegment2(d, a, b) || onSegment2(a, c, d) || onSegment2(b, c, d);
}
function contains2(point, loop) {
  let inside2 = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside2 = !inside2;
  }
  return inside2;
}
function validateFragmentContours(contours, stage) {
  const code = stage === "source" ? "UNSUPPORTED_TOPOLOGY" : "INVALID_OUTPUT";
  const vertices = contours.reduce((sum, points) => sum + points.length, 0);
  const budget = stage === "source" ? FRAGMENT_SHAPE_LIMITS.maxSourceVertices : FRAGMENT_SHAPE_LIMITS.maxOutputVertices;
  if (vertices > budget) throw new FragmentShapeError("BUDGET_EXCEEDED", `${stage} contour vertex budget exceeded`);
  if (contours.length === 0 || contours.filter((loop) => area(loop) > 0).length !== 1 || area(contours[0]) <= 0) throw new FragmentShapeError(code, "v1 requires one nonempty outer land contour; disconnected or empty layouts are rejected");
  const segments = [];
  contours.forEach((loop, contour) => {
    if (loop.length < 4 || !Number.isFinite(area(loop)) || area(loop) === 0) throw new FragmentShapeError(code, "Degenerate contour");
    loop.forEach((point, index) => {
      const next = loop[(index + 1) % loop.length];
      if (!point.every(Number.isFinite) || point[0] === next[0] && point[1] === next[1]) throw new FragmentShapeError(code, "Nonfinite or zero-length contour edge");
      segments.push({ a: point, b: next, contour, index, count: loop.length });
    });
    if (contour > 0 && (area(loop) >= 0 || !contains2(loop[0], contours[0]))) throw new FragmentShapeError(code, "Hole is not strictly inside the outer contour");
  });
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i], b = segments[j];
    if (a.contour === b.contour && (Math.abs(a.index - b.index) === 1 || Math.abs(a.index - b.index) === a.count - 1)) continue;
    if (intersects2(a.a, a.b, b.a, b.b)) throw new FragmentShapeError(code, "Contour edges cross or touch; no automatic repair is performed");
  }
  for (let i = 1; i < contours.length; i++) for (let j = i + 1; j < contours.length; j++) {
    if (contains2(contours[i][0], contours[j]) || contains2(contours[j][0], contours[i])) throw new FragmentShapeError(code, "Nested holes are unsupported");
  }
}
var cross3 = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
var length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
var signedArea = (points) => points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;
var pointKey = (point) => `${point[0]},${point[1]}`;
var insideRect = (x, y, [rx, ry, rw, rh]) => x > rx && x < rx + rw && y > ry && y < ry + rh;
var round = (value) => Math.round(value * 100) / 100;
function randomGenerator(seed2) {
  let state = seed2 >>> 0;
  return () => {
    state += 1831565813;
    let x = Math.imul(state ^ state >>> 15, 1 | state);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
function rectangleContours(geometry) {
  const rects = [...geometry.landRects, ...geometry.voidRects];
  const xs = [...new Set(rects.flatMap(([x, , w]) => [x, x + w]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap(([, y, , h]) => [y, y + h]))].sort((a, b) => a - b);
  const width = xs.length - 1;
  const height = ys.length - 1;
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (xs[x] + xs[x + 1]) / 2;
    const py = (ys[y] + ys[y + 1]) / 2;
    cells[y * width + x] = Number(geometry.landRects.some((r) => insideRect(px, py, r)) && !geometry.voidRects.some((r) => insideRect(px, py, r)));
  }
  const occupied = (x, y) => x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x] === 1;
  const edges = [];
  const starts = /* @__PURE__ */ new Map();
  const addEdge = (a, b) => {
    const index = edges.length;
    edges.push({ a, b, used: false });
    const key = pointKey(a);
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(index);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (occupied(x, y)) {
    if (!occupied(x, y - 1)) addEdge([xs[x], ys[y]], [xs[x + 1], ys[y]]);
    if (!occupied(x + 1, y)) addEdge([xs[x + 1], ys[y]], [xs[x + 1], ys[y + 1]]);
    if (!occupied(x, y + 1)) addEdge([xs[x + 1], ys[y + 1]], [xs[x], ys[y + 1]]);
    if (!occupied(x - 1, y)) addEdge([xs[x], ys[y + 1]], [xs[x], ys[y]]);
  }
  const contours = [];
  for (let start = 0; start < edges.length; start++) {
    if (edges[start].used) continue;
    const points = [];
    let current = start;
    for (let count = 0; count <= edges.length; count++) {
      const edge = edges[current];
      if (edge.used) throw new FragmentShapeError("UNSUPPORTED_TOPOLOGY", "Rectangle boundary unexpectedly revisited");
      edge.used = true;
      points.push(edge.a);
      if (pointKey(edge.b) === pointKey(edges[start].a)) break;
      const candidates = (starts.get(pointKey(edge.b)) ?? []).filter((i) => !edges[i].used);
      if (candidates.length === 0) throw new FragmentShapeError("UNSUPPORTED_TOPOLOGY", "Rectangle boundary is open");
      if (candidates.length > 1) throw new FragmentShapeError("UNSUPPORTED_TOPOLOGY", "Point-touching boundary is unsupported");
      candidates.sort((a, b) => cross3(edge.a, edge.b, edges[b].b) - cross3(edge.a, edge.b, edges[a].b));
      current = candidates[0];
    }
    const simplified = points.filter((p, i) => cross3(points[(i + points.length - 1) % points.length], p, points[(i + 1) % points.length]) !== 0);
    contours.push(simplified);
  }
  return contours.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
}
function pointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
function otherBoundaryClearance(point, allContours, contourIndex, vertexIndex) {
  let nearest = Infinity;
  allContours.forEach((points, ci) => points.forEach((a, i) => {
    if (ci === contourIndex && (i === vertexIndex || (i + 1) % points.length === vertexIndex)) return;
    nearest = Math.min(nearest, pointSegmentDistance(point, a, points[(i + 1) % points.length]));
  }));
  return nearest;
}
function generateEdgeStudy(geometry, seed2) {
  const normalizedSeed = seed2 >>> 0;
  const random2 = randomGenerator(normalizedSeed);
  const rawContours = rectangleContours(geometry);
  validateFragmentContours(rawContours, "source");
  const allPoints = rawContours.flat();
  const patches = Array.from({ length: 4 }, (_, i) => {
    const candidates = i < 2 ? rawContours[0] : allPoints;
    const p = candidates[Math.floor(random2() * candidates.length)];
    return { point: p, reach: 135 + random2() * 190, strength: 0.65 + random2() * 0.35, bias: random2() * 2 - 1, style: i % 3 };
  });
  const damageAt = (point) => {
    let winner = patches[0];
    let intensity = 0;
    for (const patch of patches) {
      const weight = Math.exp(-Math.pow(length(point, patch.point) / patch.reach, 2)) * patch.strength;
      if (weight > intensity) {
        intensity = weight;
        winner = patch;
      }
    }
    return { intensity, bias: winner.bias, style: winner.style };
  };
  const counts = { retained: 0, bevel: 0, broken: 0, blunt: 0, edgeBreaks: 0 };
  let retainedAxisLength = 0;
  let sourcePerimeter = 0;
  const contours = rawContours.map((points, ci) => {
    const corners = points.map((vertex, i) => {
      const previous = points[(i + points.length - 1) % points.length];
      const next = points[(i + 1) % points.length];
      const incomingLength = length(vertex, previous);
      const outgoingLength = length(vertex, next);
      const clearance = otherBoundaryClearance(vertex, rawContours, ci, i);
      const damage = damageAt(vertex);
      const chance = random2();
      if (chance < 0.15 + (1 - damage.intensity) * 0.37 || Math.min(incomingLength, outgoingLength) < 9) {
        counts.retained++;
        return { start: vertex, end: vertex, points: [vertex], type: "retained" };
      }
      const maximum = Math.min(68, clearance * 0.43);
      const scale = (0.56 + damage.intensity * 0.74) * (0.72 + random2() * 0.48);
      const a = Math.min(incomingLength * 0.34, maximum * scale * (1 + damage.bias * 0.44));
      const b = Math.min(outgoingLength * 0.34, maximum * scale * (1 - damage.bias * 0.44));
      const inUnit = [(previous[0] - vertex[0]) / incomingLength, (previous[1] - vertex[1]) / incomingLength];
      const outUnit = [(next[0] - vertex[0]) / outgoingLength, (next[1] - vertex[1]) / outgoingLength];
      const local = (u, v) => [round(vertex[0] + inUnit[0] * a * u + outUnit[0] * b * v), round(vertex[1] + inUnit[1] * a * u + outUnit[1] * b * v)];
      const start = local(1, 0);
      const end = local(0, 1);
      const styleRoll = random2();
      let style = damage.style;
      if (styleRoll < 0.35) style = Math.floor(random2() * 3);
      let treatment;
      if (style === 0) {
        counts.bevel++;
        treatment = [start, end];
      } else if (style === 1) {
        counts.broken++;
        treatment = [start, local(0.64 + random2() * 0.15, 0.07 + random2() * 0.14), local(0.52 + random2() * 0.1, 0.42 + random2() * 0.14), local(0.11 + random2() * 0.15, 0.56 + random2() * 0.11), end];
      } else {
        counts.blunt++;
        treatment = [start, local(0.68 + random2() * 0.13, 0.22 + random2() * 0.12), local(0.2 + random2() * 0.14, 0.73 + random2() * 0.12), end];
      }
      return { start, end, points: treatment, type: ["bevel", "broken", "blunt"][style] };
    });
    if (signedArea(points) < 0 && points.length === 4 && Math.abs(signedArea(points)) < 3e3) {
      const smallRandom = randomGenerator(normalizedSeed ^ Math.imul(ci + 1, 2654435761));
      const first = Math.floor(smallRandom() * 4);
      const keepCount = smallRandom() < 0.3 ? 3 : 2;
      const opposite = smallRandom() < 0.5;
      const preserve = keepCount === 3 ? [first, (first + 1) % 4, (first + 2) % 4] : [first, (first + (opposite ? 2 : 1)) % 4];
      for (const i of preserve) if (corners[i].type !== "retained") {
        counts[corners[i].type]--;
        counts.retained++;
        corners[i] = { start: points[i], end: points[i], points: [points[i]], type: "retained" };
      }
    }
    const treated = [];
    const edgeCandidates = corners.map((corner, i) => {
      const next = corners[(i + 1) % corners.length];
      const midpoint = [(corner.end[0] + next.start[0]) / 2, (corner.end[1] + next.start[1]) / 2];
      return { i, length: length(corner.end, next.start), priority: damageAt(midpoint).intensity * 0.8 + random2() * 0.2 };
    }).filter((edge) => edge.length >= 145).sort((a, b) => b.priority - a.priority);
    const brokenEdges = new Set(edgeCandidates.slice(0, ci === 0 ? 3 : 0).map((edge) => edge.i));
    for (let i = 0; i < points.length; i++) {
      const current = corners[i];
      const next = corners[(i + 1) % points.length];
      treated.push(...current.points);
      const edgeLength = length(current.end, next.start);
      const sourceLength = length(points[i], points[(i + 1) % points.length]);
      sourcePerimeter += sourceLength;
      retainedAxisLength += edgeLength;
      const midpoint = [(current.end[0] + next.start[0]) / 2, (current.end[1] + next.start[1]) / 2];
      const damage = damageAt(midpoint);
      if (!brokenEdges.has(i)) continue;
      const direction2 = [(next.start[0] - current.end[0]) / edgeLength, (next.start[1] - current.end[1]) / edgeLength];
      const inward = [-direction2[1], direction2[0]];
      const width = Math.min(48, edgeLength * (0.14 + random2() * 0.13));
      const center2 = edgeLength * (0.33 + random2() * 0.34);
      const clearance = Math.min(...rawContours.flatMap((loop, index) => loop.map((a, ei) => index === ci && ei === i ? Infinity : pointSegmentDistance(midpoint, a, loop[(ei + 1) % loop.length]))));
      const depth = Math.min(7 + damage.intensity * 13, clearance * 0.18);
      const edgePoint = (along, inset) => [round(current.end[0] + direction2[0] * along + inward[0] * inset), round(current.end[1] + direction2[1] * along + inward[1] * inset)];
      treated.push(edgePoint(center2 - width / 2, 0), edgePoint(center2 - width * 0.18, depth * 0.72), edgePoint(center2 + width * 0.25, depth), edgePoint(center2 + width / 2, 0));
      retainedAxisLength -= width;
      counts.edgeBreaks++;
    }
    return { kind: signedArea(points) > 0 ? "outer" : "hole", points: treated, sourcePoints: points };
  });
  validateFragmentContours(contours.map((contour) => contour.points), "output");
  const pathD = contours.map(({ points }) => `M${points.map((p) => p.join(" ")).join("L")}Z`).join("");
  const originalArea = rawContours.reduce((total, points) => total + signedArea(points), 0);
  const treatedArea = contours.reduce((total, { points }) => total + signedArea(points), 0);
  return {
    seed: normalizedSeed,
    contours: contours.map((contour) => contour.points),
    contourKinds: contours.map((contour) => contour.kind),
    pathD,
    stats: {
      ...counts,
      outerContours: contours.filter((c) => c.kind === "outer").length,
      holeContours: contours.filter((c) => c.kind === "hole").length,
      sourceCorners: rawContours.reduce((sum, points) => sum + points.length, 0),
      originalArea,
      treatedArea: round(treatedArea),
      areaChangePercent: round((treatedArea - originalArea) / originalArea * 100),
      originalAxisLengthPercent: round(retainedAxisLength / sourcePerimeter * 100),
      coordinateSpace: "authoringFrame; multiply by worldScale for world pixels"
    }
  };
}
function generateRectilinearFragment(request) {
  validateFragmentRequest(request);
  const study = generateEdgeStudy(request.layout, request.edgeSeed);
  return { algorithmVersion: RECTILINEAR_FRAGMENT_VERSION, worldScale: 2, ...study };
}
function fragmentContoursToWorld(result) {
  if (result.algorithmVersion !== RECTILINEAR_FRAGMENT_VERSION || result.worldScale !== 2) throw new FragmentShapeError("INVALID_INPUT", "World conversion requires a v1 result in authoring units");
  return result.contours.map((loop) => loop.map(([x, y]) => [x * result.worldScale, y * result.worldScale]));
}
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var keysAre = (value, keys) => Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
var seed = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4294967295;
function compileR100FragmentShape(value, requestedSeed) {
  if (!object(value) || !keysAre(value, ["algorithmVersion", "layoutId", "sourceHash", "seedMode", "seedSalt", "edgeSeed", "layout"]) || value.algorithmVersion !== RECTILINEAR_FRAGMENT_VERSION || typeof value.layoutId !== "string" || !/^[a-z][a-z0-9-]{0,95}$/.test(value.layoutId) || typeof value.sourceHash !== "string" || !/^[0-9a-f]{64}$/.test(value.sourceHash) || value.seedMode !== "run-seed" || !seed(value.seedSalt) || !seed(value.edgeSeed) || !object(value.layout) || !keysAre(value.layout, ["authoringFrame", "worldScale", "landRects", "voidRects"])) throw new Error("Invalid frozen fragment authoring snapshot");
  if (requestedSeed !== void 0 && (!seed(requestedSeed) || value.edgeSeed !== requestedSeed + value.seedSalt >>> 0)) throw new Error("Fragment edge seed must remain tied to the original departure");
  const snapshot = value;
  const result = generateRectilinearFragment({ algorithmVersion: snapshot.algorithmVersion, layout: snapshot.layout, edgeSeed: snapshot.edgeSeed });
  const polygons = fragmentContoursToWorld(result).map((loop) => loop.map(([x, y]) => ({ x, y })));
  const outerIndex = result.contourKinds.indexOf("outer");
  if (outerIndex < 0 || result.contourKinds.filter((kind) => kind === "outer").length !== 1) throw new Error("Fragment compiler did not produce one ground body");
  return { snapshot, terrainOutline: polygons[outerIndex], erosion: polygons.filter((_, index) => result.contourKinds[index] === "hole") };
}
var HALF_BODY2 = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
var DIRECTIONS2 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
var DistanceHeap = class {
  constructor(distances) {
    this.distances = distances;
    __publicField(this, "cells");
    __publicField(this, "positions");
    __publicField(this, "size", 0);
    this.cells = new Int32Array(distances.length);
    this.positions = new Int32Array(distances.length).fill(-1);
  }
  addOrDecrease(cell) {
    let at2 = this.positions[cell];
    if (at2 === -1) {
      at2 = this.size++;
      this.cells[at2] = cell;
    }
    while (at2 > 0) {
      const parent = at2 - 1 >> 1, parentCell = this.cells[parent];
      if (this.distances[parentCell] <= this.distances[cell]) break;
      this.cells[at2] = parentCell;
      this.positions[parentCell] = at2;
      at2 = parent;
    }
    this.cells[at2] = cell;
    this.positions[cell] = at2;
  }
  pop() {
    if (this.size === 0) return void 0;
    const first = this.cells[0], last = this.cells[--this.size];
    this.positions[first] = -1;
    if (this.size === 0) return first;
    let at2 = 0;
    while (at2 * 2 + 1 < this.size) {
      let child = at2 * 2 + 1;
      if (child + 1 < this.size && this.distances[this.cells[child + 1]] < this.distances[this.cells[child]]) child++;
      const childCell = this.cells[child];
      if (this.distances[last] <= this.distances[childCell]) break;
      this.cells[at2] = childCell;
      this.positions[childCell] = at2;
      at2 = child;
    }
    this.cells[at2] = last;
    this.positions[last] = at2;
    return first;
  }
};
function validatePolicy(policy) {
  if (![
    policy.minPathDistancePx,
    policy.minEuclideanDistancePx,
    policy.minPathFraction,
    policy.maxPathFraction,
    policy.clearanceHalfSize,
    policy.regionCols,
    policy.regionRows,
    policy.distanceBands
  ].every(Number.isFinite) || policy.minPathDistancePx <= 0 || policy.minEuclideanDistancePx <= 0 || policy.minPathFraction < 0 || policy.maxPathFraction > 1 || policy.minPathFraction >= policy.maxPathFraction || policy.clearanceHalfSize < HALF_BODY2 || ![policy.regionCols, policy.regionRows, policy.distanceBands].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error("Invalid spatial extraction policy");
  }
}
function buildSpatialExtractionField(grid, spawn, policy) {
  validatePolicy(policy);
  if (!bodyHasSupport(grid, spawn, HALF_BODY2, HALF_BODY2)) throw new Error("Spatial extraction spawn lacks complete body support");
  const count = grid.cols * grid.rows, size = grid.tileSize;
  const seats = new Uint8Array(count), settled = new Uint8Array(count);
  const distances = new Float64Array(count).fill(Infinity), parents = new Int32Array(count).fill(-1);
  const centre = (cell) => ({ x: (cell % grid.cols + 0.5) * size, y: (Math.floor(cell / grid.cols) + 0.5) * size });
  for (let cell = 0; cell < count; cell++) seats[cell] = Number(bodyHasSupport(grid, centre(cell), HALF_BODY2, HALF_BODY2));
  const heap = new DistanceHeap(distances);
  const spawnCol = Math.floor(spawn.x / size), spawnRow = Math.floor(spawn.y / size);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const col = spawnCol + dx, row = spawnRow + dy, cell = row * grid.cols + col;
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows || !seats[cell]) continue;
    const point = centre(cell), moveX = point.x - spawn.x, moveY = point.y - spawn.y;
    if ((moveX !== 0 || moveY !== 0) && bodyDisplacementFraction(grid, spawn, HALF_BODY2, HALF_BODY2, moveX, moveY) !== 1) continue;
    distances[cell] = Math.hypot(moveX, moveY);
    heap.addOrDecrease(cell);
  }
  let reachableCount = 0, maxPathDistancePx = 0;
  for (let current = heap.pop(); current !== void 0; current = heap.pop()) {
    settled[current] = 1;
    reachableCount++;
    const distance2 = distances[current], point = centre(current);
    maxPathDistancePx = Math.max(maxPathDistancePx, distance2);
    const col = current % grid.cols, row = Math.floor(current / grid.cols);
    for (const [dx, dy] of DIRECTIONS2) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || settled[next]) continue;
      const candidateDistance = distance2 + size * Math.hypot(dx, dy);
      if (candidateDistance >= distances[next]) continue;
      if (bodyDisplacementFraction(grid, point, HALF_BODY2, HALF_BODY2, dx * size, dy * size) !== 1) continue;
      distances[next] = candidateDistance;
      parents[next] = current;
      heap.addOrDecrease(next);
    }
  }
  const minPath = Math.max(policy.minPathDistancePx, maxPathDistancePx * policy.minPathFraction);
  const maxPath = maxPathDistancePx * policy.maxPathFraction;
  const candidates = [], regionCounts = {}, distanceBandCounts = {};
  let minCandidatePathDistancePx = Infinity, maxCandidatePathDistancePx = 0;
  const triggerRadius = GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS, triggerOffsets = [];
  for (let dy = -Math.floor(triggerRadius / size); dy <= Math.floor(triggerRadius / size); dy++) {
    for (let dx = -Math.floor(triggerRadius / size); dx <= Math.floor(triggerRadius / size); dx++) {
      if (Math.hypot(dx * size, dy * size) <= triggerRadius) triggerOffsets.push({ dx, dy });
    }
  }
  for (let cell = 0; cell < count; cell++) {
    const pathDistancePx = distances[cell];
    if (!Number.isFinite(pathDistancePx) || pathDistancePx < minPath || pathDistancePx > maxPath) continue;
    const point = centre(cell), euclideanDistancePx = Math.hypot(point.x - spawn.x, point.y - spawn.y);
    if (euclideanDistancePx < policy.minEuclideanDistancePx || !bodyHasSupport(grid, point, policy.clearanceHalfSize, policy.clearanceHalfSize)) continue;
    let interactionPathDistancePx = pathDistancePx;
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    for (const offset of triggerOffsets) {
      const x = col + offset.dx, y = row + offset.dy;
      if (x >= 0 && y >= 0 && x < grid.cols && y < grid.rows) interactionPathDistancePx = Math.min(interactionPathDistancePx, distances[y * grid.cols + x]);
    }
    if (interactionPathDistancePx < minPath) continue;
    const regionCol = Math.min(policy.regionCols - 1, Math.floor(point.x / grid.widthPx * policy.regionCols));
    const regionRow = Math.min(policy.regionRows - 1, Math.floor(point.y / grid.heightPx * policy.regionRows));
    const regionId = regionRow * policy.regionCols + regionCol;
    const distanceBand = Math.min(policy.distanceBands - 1, Math.floor((pathDistancePx - minPath) / Math.max(size, maxPath - minPath) * policy.distanceBands));
    candidates.push({ point, cell, pathDistancePx, interactionPathDistancePx, euclideanDistancePx, pathFraction: pathDistancePx / maxPathDistancePx, regionId, distanceBand });
    minCandidatePathDistancePx = Math.min(minCandidatePathDistancePx, pathDistancePx);
    maxCandidatePathDistancePx = Math.max(maxCandidatePathDistancePx, pathDistancePx);
    regionCounts[regionId] = (regionCounts[regionId] ?? 0) + 1;
    distanceBandCounts[distanceBand] = (distanceBandCounts[distanceBand] ?? 0) + 1;
  }
  if (candidates.length === 0) throw new Error(`Spatial extraction has no legal exploration candidate (reachable=${reachableCount}, maxPath=${Math.round(maxPathDistancePx)})`);
  const summary = {
    reachableCount,
    maxPathDistancePx,
    minCandidatePathDistancePx,
    maxCandidatePathDistancePx,
    candidateCount: candidates.length,
    regionCount: Object.keys(regionCounts).length,
    distanceBandCount: Object.keys(distanceBandCounts).length,
    regionCounts,
    distanceBandCounts
  };
  return { cols: grid.cols, rows: grid.rows, tileSize: size, spawn: { ...spawn }, policy: { ...policy }, distances, parents, candidates, summary };
}
function selectSpatialExtraction(field2, seed2) {
  const rng = new SeededRandom(mix32(seed2, "spatial-extraction-exploration-v1"));
  const band = rng.pick(Object.keys(field2.summary.distanceBandCounts).map(Number));
  const bandCandidates = field2.candidates.filter((candidate2) => candidate2.distanceBand === band);
  const region = rng.pick([...new Set(bandCandidates.map((candidate2) => candidate2.regionId))]);
  const candidate = rng.pick(bandCandidates.filter((candidate2) => candidate2.regionId === region));
  if (!candidate) throw new Error("Spatial extraction field has no selectable candidate");
  return { ...candidate, candidateCount: field2.summary.candidateCount, regionCount: field2.summary.regionCount };
}
var object2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var keysAre2 = (value, keys) => Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
var range = (value, lo, hi) => typeof value === "number" && Number.isFinite(value) && value >= lo && value <= hi;
var integer = (value, lo, hi) => range(value, lo, hi) && Number.isInteger(value);
function validR100SpatialPolicy(value, worldId, requestedSeed) {
  try {
    if (!object2(value) || !keysAre2(value, [
      "version",
      "worldId",
      "sourceHash",
      "organization",
      "organizationRules",
      "groupTransform",
      "cols",
      "rows",
      "mirrorX",
      "mirrorY",
      "placementJitterPx",
      "placements",
      "materials",
      "erosion",
      "spawnCandidates",
      "extraction",
      "deployment",
      ...Object.prototype.hasOwnProperty.call(value, "terrainOutline") ? ["terrainOutline"] : [],
      ...Object.prototype.hasOwnProperty.call(value, "fragmentShape") ? ["fragmentShape"] : []
    ]) || value.version !== 1 && value.version !== 2 || value.worldId !== worldId || !/^[a-z][a-z0-9-]+$/.test(worldId) || typeof value.sourceHash !== "string" || !/^[0-9a-f]{64}$/.test(value.sourceHash) || !["offset-divides", "broken-bay", "staggered-reaches", "single-buttress", "joined-quarters", "authored-group", "authored-sectors"].includes(value.organization) || !integer(value.cols, 48, 96) || !integer(value.rows, 36, 72) || value.cols * value.rows * 1024 > 4194304 || typeof value.mirrorX !== "boolean" || typeof value.mirrorY !== "boolean" || !range(value.placementJitterPx, 0, 24)) return false;
    const width = value.cols * 32, height = value.rows * 32;
    const hasFragment = Object.prototype.hasOwnProperty.call(value, "fragmentShape");
    if (value.version === 2 !== hasFragment) return false;
    const fragment = hasFragment ? compileR100FragmentShape(value.fragmentShape, requestedSeed) : void 0;
    if (fragment && (value.organization !== "authored-sectors" || value.mirrorX || value.mirrorY || fragment.snapshot.layout.authoringFrame[0] * fragment.snapshot.layout.worldScale !== width || fragment.snapshot.layout.authoringFrame[1] * fragment.snapshot.layout.worldScale !== height || JSON.stringify(value.terrainOutline) !== JSON.stringify(fragment.terrainOutline) || JSON.stringify(value.erosion) !== JSON.stringify(fragment.erosion))) return false;
    const rules = value.organizationRules;
    if (!object2(rules) || !keysAre2(rules, ["sourceMode", "materialScaling", "solidCount", "reliefCount"]) || !["repeat", "source-once"].includes(rules.sourceMode) || typeof rules.materialScaling !== "boolean" || !integer(rules.solidCount, 1, 32) || !integer(rules.reliefCount, 0, 16) || rules.sourceMode === "repeat" && rules.solidCount < 12) return false;
    const group = value.groupTransform;
    if (value.organization === "authored-group") {
      if (!object2(group) || !keysAre2(group, ["scale", "sourceX", "sourceY", "targetX", "targetY"]) || !range(group.scale, 1, 2) || !range(group.sourceX, 0, 2048) || !range(group.sourceY, 0, 2048) || !range(group.targetX, 0, width) || !range(group.targetY, 0, height) || rules.sourceMode !== "source-once" || rules.materialScaling || value.placementJitterPx !== 0 || value.mirrorX || value.mirrorY) return false;
    } else if (group !== null) return false;
    const point = (p) => object2(p) && keysAre2(p, ["x", "y"]) && range(p.x, 0, width) && range(p.y, 0, height);
    if (!Array.isArray(value.placements) || value.placements.length !== rules.solidCount + rules.reliefCount || value.placements.length > 48 || !Array.isArray(value.materials) || value.materials.length < 6 || value.materials.length > 32 || !Array.isArray(value.spawnCandidates) || value.spawnCandidates.length < 6 || value.spawnCandidates.length > 32 || !value.spawnCandidates.every(point) || !Array.isArray(value.erosion) || (fragment ? value.erosion.length > FRAGMENT_TERRAIN_BUDGET.maxPolygons : value.erosion.length < 4 || value.erosion.length > 12)) return false;
    const ids = /* @__PURE__ */ new Set();
    for (const p of value.placements) {
      if (!object2(p) || !keysAre2(p, ["id", "role", "sourceIndex", "x", "y", "rotation", "length", "width"]) || !integer(p.id, 1, 1e4) || ids.has(p.id) || !["solid", "relief"].includes(p.role) || !integer(p.sourceIndex, 0, 31) || !range(p.x, 32, width - 32) || !range(p.y, 32, height - 32) || !range(p.rotation, -Math.PI * 2, Math.PI * 2) || !range(p.length, 16, 2048) || !range(p.width, 12, 2048)) return false;
      ids.add(p.id);
    }
    if (value.placements.filter((p) => p.role === "solid").length !== rules.solidCount || value.placements.filter((p) => p.role === "relief").length !== rules.reliefCount) return false;
    if (rules.sourceMode === "source-once") for (const role of ["solid", "relief"]) {
      const placements = value.placements.filter((p) => p.role === role);
      if (placements.some((p) => p.sourceIndex >= placements.length) || new Set(placements.map((p) => p.sourceIndex)).size !== placements.length) return false;
    }
    const shapeKeys = /* @__PURE__ */ new Set();
    for (const m of value.materials) {
      if (!object2(m) || !keysAre2(m, ["key", "lengthScale", "widthScale"]) || typeof m.key !== "string" || !/^[a-z][a-z-]+$/.test(m.key) || shapeKeys.has(m.key) || !range(m.lengthScale, 0.5, 2) || !range(m.widthScale, 0.5, 3)) return false;
      shapeKeys.add(m.key);
    }
    const budget = fragment ? FRAGMENT_TERRAIN_BUDGET : void 0;
    if (value.erosion.some((polygon) => !Array.isArray(polygon) || polygon.length < 3 || polygon.length > (budget?.maxPoints ?? 32) || !polygon.every(point))) return false;
    validateNativeErosion(value.erosion, width, height, budget);
    if (Object.prototype.hasOwnProperty.call(value, "terrainOutline")) {
      if (value.organization !== "authored-sectors") return false;
      validateNativeTerrainOutline(value.terrainOutline, width, height, value.erosion, budget);
    }
    const e = value.extraction;
    if (!object2(e) || !keysAre2(e, ["minPathDistancePx", "minEuclideanDistancePx", "minPathFraction", "maxPathFraction", "clearanceHalfSize", "regionCols", "regionRows", "distanceBands"]) || !range(e.minPathDistancePx, 700, 8e3) || !range(e.minEuclideanDistancePx, 400, 2e3) || !range(e.minPathFraction, 0.1, 0.8) || !range(e.maxPathFraction, 0.5, 1) || e.minPathFraction >= e.maxPathFraction || !range(e.clearanceHalfSize, 20, 80) || !integer(e.regionCols, 2, 8) || !integer(e.regionRows, 2, 8) || !integer(e.distanceBands, 2, 8)) return false;
    validateR100SpatialDeploymentPolicy(value.deployment);
    return true;
  } catch {
    return false;
  }
}
function createR100SpatialDefinition(native, policy, seed2) {
  if (Object.prototype.hasOwnProperty.call(native, "terrainOutline") || Object.prototype.hasOwnProperty.call(native, "fragmentShapeVersion"))
    throw new Error("The source mother form cannot override the frozen spatial terrain outline");
  const width = policy.cols * 32, height = policy.rows * 32;
  const transform = (p) => ({ x: policy.mirrorX ? width - p.x : p.x, y: policy.mirrorY ? height - p.y : p.y });
  const solids = native.instances.filter((instance) => instance.role === "solid");
  const reliefs = native.instances.filter((instance) => instance.role === "relief");
  if (!solids.length) throw new Error("Spatial arrangement requires the source world to define real solid material");
  const sourceOnce = policy.organizationRules.sourceMode === "source-once";
  if (sourceOnce && (solids.length !== policy.organizationRules.solidCount || reliefs.length !== policy.organizationRules.reliefCount))
    throw new Error("Source-once spatial arrangement must preserve every authored instance exactly once");
  const edgeOwner = reliefs.find((instance) => instance.groundEdgeWidth !== void 0);
  let edgeAssigned = false;
  const placements = [...policy.placements].sort((a, b) => (a.role === "relief" ? 0 : 1) - (b.role === "relief" ? 0 : 1) || a.id - b.id);
  const instances = [];
  for (const p of placements) {
    const sources = p.role === "solid" ? solids : reliefs;
    if (!sources.length) continue;
    const source = sourceOnce ? sources[p.sourceIndex] : p.role === "relief" && edgeOwner && !edgeAssigned ? edgeOwner : sources[p.sourceIndex % sources.length];
    const group = policy.groupTransform;
    if (group && (p.id !== source.id || Math.abs(p.x - (group.targetX + (source.x - group.sourceX) * group.scale)) > 1e-6 || Math.abs(p.y - (group.targetY + (source.y - group.sourceY) * group.scale)) > 1e-6 || p.rotation !== source.rotation || Math.abs(p.length - source.length * group.scale) > 1e-6 || Math.abs(p.width - source.width * group.scale) > 1e-6))
      throw new Error("Whole-group spatial placement diverges from its frozen source transform");
    const { groundEdgeWidth: _groundEdgeWidth, ...geometry } = source;
    const style = policy.materials.find((row) => row.key === (source.shapeProfile ?? source.family ?? native.family)) ?? policy.materials.find((row) => row.key === (source.family ?? native.family));
    if (!style) throw new Error(`No frozen spatial material proportions for ${source.shapeProfile ?? source.family ?? native.family}`);
    const jitter = (axis) => (mix32(seed2, `spatial-${policy.worldId}-${p.id}-${axis}`) / 4294967295 * 2 - 1) * policy.placementJitterPx;
    const center2 = transform({ x: p.x + jitter("x"), y: p.y + jitter("y") });
    let rotation = p.rotation;
    if (policy.mirrorX) rotation = Math.PI - rotation;
    if (policy.mirrorY) rotation = -rotation;
    const instance = {
      ...geometry,
      id: p.id,
      role: p.role,
      ...center2,
      rotation,
      length: p.length * (p.role === "solid" && policy.organizationRules.materialScaling ? style.lengthScale : 1),
      width: p.width * (p.role === "solid" && policy.organizationRules.materialScaling ? style.widthScale : 1),
      ...p.role === "relief" && edgeOwner && !edgeAssigned && (!sourceOnce || source === edgeOwner) ? { groundEdgeWidth: edgeOwner.groundEdgeWidth } : {}
    };
    if (instance.groundEdgeWidth !== void 0) edgeAssigned = true;
    instances.push(instance);
  }
  const spawnIndex = policy.spawnCandidates.map((_, index) => ({ index, order: mix32(seed2, `spatial-spawn-${policy.worldId}-${index}`) })).sort((a, b) => a.order - b.order || a.index - b.index)[0].index;
  const spawn = transform(policy.spawnCandidates[spawnIndex]);
  const search = transform({ x: width * 0.5, y: height * 0.68 }), enemy = transform({ x: width * 0.7, y: height * 0.55 });
  return { spawnIndex, definition: {
    ...native,
    cols: policy.cols,
    rows: policy.rows,
    seed: seed2,
    spawn_x: spawn.x,
    spawn_y: spawn.y,
    exit_x: spawn.x,
    exit_y: spawn.y,
    search_x: search.x,
    search_y: search.y,
    enemy_x: enemy.x,
    enemy_y: enemy.y,
    instances,
    erosion: policy.erosion.map((polygon) => polygon.map(transform)),
    ...policy.terrainOutline === void 0 ? {} : { terrainOutline: policy.terrainOutline.map(transform) },
    ...policy.fragmentShape === void 0 ? {} : { fragmentShapeVersion: policy.fragmentShape.algorithmVersion }
  } };
}
function inspectSpatialTerrain(definition, policy, seed2, options) {
  const terrain = createMasterWorld(definition, seed2, options);
  const grid = new TileGrid(terrain.layout.tileMap);
  const extractionField = buildSpatialExtractionField(grid, terrain.layout.spawnPoint, policy.extraction);
  const extraction = selectSpatialExtraction(extractionField, seed2);
  let matter = 0, solid = 0, supported = 0;
  const half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
    const tile = grid.getTile(x, y);
    if (tile !== 3) matter++;
    if (tile === 0) solid++;
    if (bodyHasSupport(grid, { x: (x + 0.5) * grid.tileSize, y: (y + 0.5) * grid.tileSize }, half, half)) supported++;
  }
  const reachable = terrain.diagnostics.reachableBodySeats;
  if (reachable / supported < 0.97) throw new Error(`Spatial terrain leaves ${supported - reachable}/${supported} full-body seats disconnected`);
  return {
    extraction,
    extractionCandidateField: extractionField.summary,
    reachable,
    supported,
    terrainFillRatio: matter / (grid.cols * grid.rows),
    solidTerrainRatio: solid / matter
  };
}
function createR100SpatialWorld(native, policy, seed2, frozen) {
  if (!validR100SpatialPolicy(policy, policy.worldId)) throw new Error("Invalid frozen spatial policy");
  const { definition, spawnIndex } = createR100SpatialDefinition(native, policy, seed2);
  const options = { ...frozen, spatialDeployment: policy.deployment };
  const { extraction, extractionCandidateField, reachable, supported, terrainFillRatio, solidTerrainRatio } = inspectSpatialTerrain(definition, policy, seed2, options);
  const world = createMasterWorld({ ...definition, exit_x: extraction.point.x, exit_y: extraction.point.y }, seed2, options);
  if (world.layout.extractionPoint.position.x !== extraction.point.x || world.layout.extractionPoint.position.y !== extraction.point.y)
    throw new Error("Spatial extraction moved during final physical deployment");
  return { ...world, algorithmRevision: 8, diagnostics: {
    ...world.diagnostics,
    spatial: {
      version: policy.version,
      worldId: policy.worldId,
      sourceHash: policy.sourceHash,
      organization: policy.organization,
      width: policy.cols * 32,
      height: policy.rows * 32,
      terrainFillRatio,
      solidTerrainRatio,
      bodyReachableRatio: reachable / supported,
      unreachableBodySeats: supported - reachable,
      spawnIndex,
      spawnRelocationPx: Math.hypot(world.layout.spawnPoint.x - definition.spawn_x, world.layout.spawnPoint.y - definition.spawn_y),
      extraction,
      extractionCandidateField,
      solidObjectCount: world.definition.instances.filter((row) => row.role === "solid").length
    }
  } };
}
var WORLD_GROUND_PATTERNS = ["strata", "veins", "plates", "grains", "tension", "flow"];
var WORLD_MATERIAL_ORGANIZATIONS = ["short-fibre", "porous-marrow", "short-fibre-loose"];
var inRange = (value, low, high2) => typeof value === "number" && Number.isFinite(value) && value >= low && value <= high2;
var luminance = (color) => (color >>> 16 & 255) * 0.2126 + (color >>> 8 & 255) * 0.7152 + (color & 255) * 0.0722;
function validR100WorldAppearance(value) {
  if (!value || typeof value !== "object") return false;
  const row = value;
  if (row.version !== 1 || !/^[a-z][a-z0-9-]+$/.test(row.worldId) || !WORLD_GROUND_PATTERNS.includes(row.groundPattern) || !inRange(row.patternScale, 48, 256) || !inRange(row.patternStrength, 0, 1) || !inRange(row.secondaryCoverage, 0, 0.6) || !inRange(row.textureContrast, 0.6, 1.6) || !inRange(row.quietCoverage, 0.1, 0.65) || row.materialOrganization !== void 0 && !WORLD_MATERIAL_ORGANIZATIONS.includes(row.materialOrganization)) return false;
  return [row.ground, row.solid, row.cleaved, row.secondary].every((ramp) => !!ramp && [ramp.dark, ramp.mid, ramp.light].every((color) => Number.isSafeInteger(color) && inRange(color, 0, 16777215)) && luminance(ramp.dark) < luminance(ramp.mid) && luminance(ramp.mid) < luminance(ramp.light));
}
var R100_MATERIAL_DEPENDENCIES = {
  "folded-slab": {
    "definition": "cff866a51ffb73b54f28f80b01bd1d4cf2d18d91cf7da55908d520c34614e781",
    "surface": "88bda7c04ecd21f8954fa7076dc73ce332ff0bb8935d39752b9923778fe01f4a",
    "solid": "4b2082c1be77d27f0ba57aef104204e3c10bb59c88078df8f741b9bd6ce38454"
  },
  "fibre-knot": {
    "definition": "07c4626ba229e38d6cb11f6000b93bd0cea55899fc28c0781bb1f005bcf67634",
    "surface": "b94630043fdc4418673337daa5eb3121dc5238b62b94f5b0fb2ef8fc461df002",
    "solid": "015e854e49a0b48f5554f725341564817a0a267ad0c6b84708925a7231306089"
  },
  "broken-shell": {
    "definition": "b8e69dc639ee9d3254ea4e31d2985a9fe72d9222b546981738083bf0fa456835",
    "surface": "0f3a10c683852461fc38543f508953ed058799dc7922c87c98bfb705f0b62f8d",
    "solid": "784e95d608ea573f99bd99ff8f345e601504d3ebd24b18918dc78179cf4a4220"
  },
  "granular-ridge": {
    "definition": "dadfc46797b6df7d4868b89fb6ca6a759b880598b2ee698d97db40d33c6b8030",
    "surface": "7261eb6dc1eecc662ba9f3b4c907752e3324de5319adc72a6306be737535222b",
    "solid": "4217d2d52cb80e412cc704c494c27db37439e5ca5aba279353fd50da3eecee5d"
  },
  "membrane-rim": {
    "definition": "0d780b412e533356e5cff9eadd1b7a35a7709aabc070833b37ede3ec3024db5b",
    "surface": "9faf60060f8b9e6a41bc89c8fc1a8c393ff3b821a7a822735d063f5f2ff732cf",
    "solid": "3d11b9161c969fd35cb77a8d77b161b98105122b00b772b58ebb43ee61921d23"
  },
  "gel-flow": {
    "definition": "0ce794cb484749b4d4ba54007c2de6e4f01089fccb2ef7d420b06c105dd40dc9",
    "surface": "7bbcfaa18563ef08395152454a7007eb71a573b0d83171e959dfa6b58ec805bd",
    "solid": "c4b7797bd83d18746d027b9cd4e556f77109fcbfa9dacacd2bb7b30083444612"
  },
  "organization:short-fibre": {
    "definition": "5136e92cd5d57693961e7e72797a4fa4c543d1ac0adb5008cc9e25b57957822e",
    "surface": "39a3207c28c9c00ca4713e72cf44edddbd9e948cdd88959d553bb9db94f68b4c",
    "solid": "488fa9b7cc8cd093c832aab4684cd229b76c582cbecce743d7db24a27b32ec2a"
  },
  "organization:porous-marrow": {
    "definition": "9cc9c897e22fafc2aed2c9a097b2638f07199a95ed7c4fcda48e1162e134b2e6",
    "surface": "9496b48569ae9abb48c96e45413595d081b49e7d8f772326bb791ba1160c5c55",
    "solid": "3b5c7d9af2a4faeb8c577b2be94009b2f9571c0187055de66456de93130c0c58"
  },
  "organization:short-fibre-loose": {
    "definition": "06b98bb318c7f8440c6c576a6f0472aac78c13a198f65fe8ffcc1b1a266dd328",
    "surface": "c7bd9b26d16d9dd374d4d61e2b42eb13cee3a5e0980cee07e292b5db8d4112dd",
    "solid": "cf673c46a193dd9f50bf1c26a0218bced7c335af8b52e9adb5b3f6c0f50246dd"
  }
};
var R100_NATIVE_WORLDS = [{ id: "ash-strata" }, { id: "crystal-fibre" }, { id: "ivory-basin" }, { id: "cinder-ridge" }, { id: "pallid-membrane" }, { id: "silt-gel" }, { id: "schist-shear" }, { id: "splayed-fibres" }, { id: "shell-chain" }, { id: "grain-laminate" }, { id: "tension-membrane" }, { id: "shell-gel-delta" }, { id: "pressed-dunes" }, { id: "ruptured-film" }, { id: "reversed-flow" }, { id: "laminate-shell" }, { id: "fibre-silt" }, { id: "film-laminate" }, { id: "gel-fibre" }, { id: "shell-grit" }, { id: "rib-vault" }, { id: "pleated-hide" }, { id: "blister-field" }, { id: "wax-tongues" }, { id: "monolith-sill" }, { id: "bleached-court" }, { id: "split-rib-causeway" }, { id: "satin-fan" }, { id: "chalk-steps" }, { id: "porcelain-maw" }, { id: "amber-ribs" }, { id: "pale-sail" }, { id: "root-cistern" }, { id: "scab-islands" }, { id: "foam-trenches" }, { id: "resin-fall" }, { id: "tendon-shelves" }, { id: "felt-basin" }, { id: "cork-shelves" }, { id: "lacquer-court" }, { id: "ribbed-delta" }, { id: "bladder-weave" }, { id: "flake-thicket" }, { id: "resin-hollows" }, { id: "sentinel-mass" }, { id: "stepped-bowl" }, { id: "draped-bay" }, { id: "ember-cushions" }, { id: "splinter-rotunda" }, { id: "quilted-scars" }, { id: "silt-colonnade" }, { id: "shell-causeway" }, { id: "cleft-tableland" }, { id: "fallen-spines" }, { id: "clamped-shore" }, { id: "torn-reservoir" }, { id: "braided-seam" }, { id: "scalloped-reach" }, { id: "offset-pan" }, { id: "thin-delta" }, { id: "shard-switchback" }, { id: "hollow-wreckage" }, { id: "knotted-run" }, { id: "rolled-fragments" }, { id: "fibre-choke" }, { id: "buried-lamellae" }, { id: "pressed-rim" }, { id: "wedged-hide" }, { id: "quiet-spur" }, { id: "split-fall" }, { id: "three-shelves" }, { id: "frayed-outwash" }, { id: "short-fibre-mat" }, { id: "marrow-break" }, { id: "felt-wedges" }, { id: "pore-bank" }, { id: "staggered-cups" }, { id: "split-tows" }, { id: "curled-flats" }, { id: "pitch-forks" }, { id: "grain-weld" }, { id: "silk-catch" }, { id: "resin-sleeve" }, { id: "shell-threads" }, { id: "chalk-divide" }, { id: "red-vault-fragments" }, { id: "blue-fault" }, { id: "pale-pressure" }, { id: "notched-backwater" }, { id: "crossed-casings" }, { id: "fibre-stumpfield" }, { id: "sloughed-court" }, { id: "crushed-seam" }, { id: "husk-reef" }, { id: "fibre-scree" }, { id: "gel-rafts" }, { id: "double-return" }, { id: "offset-basins" }, { id: "pinched-fan" }, { id: "spliced-reaches" }, { id: "white-scarfield" }, { id: "black-lacuna" }, { id: "ochre-folds" }, { id: "violet-marrows" }, { id: "fractured-estuary" }, { id: "woven-quarters" }, { id: "shell-patchwork" }, { id: "last-shelf" }];
var POLLUTION_GRADES = ["low", "medium", "severe"];
function isPollutionGrade(value) {
  return typeof value === "string" && POLLUTION_GRADES.some((grade) => grade === value);
}
function isPollutionGradeDefinition(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value;
  const coverage = ["infiltrate", "rewrite", "overwrite"];
  const keys = "chaosEndRate,chaosRampEndSeconds,chaosRampStartSeconds,chaosStartRate,id,intent,label,paintContinuity,paintCount,paintCoverage,paintSubstrate,status,version,volumeCols,volumeCount,volumeCoverage,volumeRows,volumeSubstrate";
  return !(!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join(",") !== keys || !isPollutionGrade(row.id) || row.version !== 1 || row.status !== "dev-masters" || typeof row.label !== "string" || !row.label.trim() || row.label.length > 40 || typeof row.intent !== "string" || !row.intent.trim() || row.intent.length > 500 || row.paintSubstrate !== "oil_film" || row.paintContinuity !== "monolith" || row.volumeSubstrate !== "gas_mass" || !coverage.includes(String(row.paintCoverage)) || !coverage.includes(String(row.volumeCoverage)) || !["paintCount", "volumeCount", "volumeCols", "volumeRows"].every((key) => typeof row[key] === "number" && Number.isInteger(row[key]) && row[key] > 0 && row[key] <= 16) || !["chaosStartRate", "chaosEndRate", "chaosRampStartSeconds", "chaosRampEndSeconds"].every((key) => typeof row[key] === "number" && Number.isFinite(row[key]) && row[key] >= 0) || row.chaosStartRate <= 0 || row.chaosEndRate < row.chaosStartRate || row.chaosEndRate > 2 || row.chaosRampEndSeconds <= row.chaosRampStartSeconds);
}
var equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function fingerprint(value) {
  const source = JSON.stringify(value);
  let hash2 = 2166136261;
  for (let index = 0; index < source.length; index++) hash2 = Math.imul(hash2 ^ source.charCodeAt(index), 16777619);
  return (hash2 >>> 0).toString(16).padStart(8, "0");
}
function materialDependencies(definition, appearance) {
  const names = [.../* @__PURE__ */ new Set([definition.family, ...definition.instances.map((instance) => instance.family ?? definition.family)])];
  if (appearance.materialOrganization) names.push(`organization:${appearance.materialOrganization}`);
  names.sort();
  return Object.fromEntries(names.map((name) => {
    const dependency = R100_MATERIAL_DEPENDENCIES[name];
    if (!dependency) throw new Error(`Missing native material ${name}`);
    return [name, dependency];
  }));
}
function dependencyHash(recipe, materials, revision) {
  return fingerprint({
    algorithm: `r100-native@3.${revision}`,
    native: recipe.nativeDefinition,
    profile: recipe.profile,
    space: recipe.space,
    contentFragmentTypeId: recipe.contentFragmentTypeId,
    grade: recipe.gradeDefinition,
    contents: recipe.contentDefinition,
    spatialPolicy: recipe.spatialPolicy,
    appearance: recipe.appearance,
    materials,
    ...revision === 9 ? { searchSitePolicy: recipe.searchSitePolicy } : {}
  });
}
function validR100ProductionRecipe(value) {
  try {
    if (!value || typeof value !== "object") return false;
    const recipe = value, native = recipe.nativeDefinition, pack = recipe.package;
    if (recipe.version !== 3 || recipe.paintGeometryVersion !== 2 || !Number.isSafeInteger(recipe.requestedSeed) || recipe.requestedSeed < 0 || recipe.requestedSeed > 4294967295 || !native || !isPollutionGrade(native.grade) || recipe.contentFragmentTypeId !== "frag-outdoor" || !pack || pack.algorithm !== "r100-native" || pack.version !== 3 || pack.algorithmRevision !== 9 || pack.grade !== native.grade || !/^r100-[a-z][a-z0-9-]+$/.test(pack.id) || !R100_NATIVE_WORLDS.some((world) => `r100-${world.id}` === pack.id) || !Array.isArray(native.instances) || native.instances.length < 1 || native.instances.length > 32 || Object.prototype.hasOwnProperty.call(native, "terrainOutline") || Object.prototype.hasOwnProperty.call(native, "fragmentShapeVersion") || !Number.isSafeInteger(native.cols) || !Number.isSafeInteger(native.rows) || native.cols < 24 || native.cols > 40 || native.rows < 18 || native.rows > 32 || !isPollutionGradeDefinition(recipe.gradeDefinition) || recipe.gradeDefinition.id !== native.grade || recipe.contentDefinition?.grade_id !== native.grade || recipe.contentDefinition.version !== 2 || !validR100WorldAppearance(recipe.appearance) || `r100-${recipe.appearance.worldId}` !== pack.id || !validR100SpatialPolicy(recipe.spatialPolicy, recipe.appearance.worldId, recipe.requestedSeed) || !validSearchSitePolicy(recipe.searchSitePolicy, recipe.appearance.worldId) || recipe.profile?.id !== native.profile || JSON.stringify(recipe).length > 6e4) return false;
    validateNativeErosion(native.erosion, native.cols * 32, native.rows * 32);
    const ids = /* @__PURE__ */ new Set();
    for (const instance of native.instances) {
      if (!instance || instance.role !== "solid" && instance.role !== "relief" || ids.has(instance.id)) return false;
      ids.add(instance.id);
      const { role, ...geometry } = instance;
      validateNativeVolumeSpec({
        ...geometry,
        blocking: role === "solid" ? 1 : 0,
        family: instance.family ?? native.family,
        seed: native.seed
      });
    }
    validateNativeGroundEdgeOwnership(native);
    const materials = materialDependencies(native, recipe.appearance), { package: _package, ...frozen } = recipe;
    return equal(pack.materials, materials) && pack.dependencyHash === dependencyHash(frozen, materials, pack.algorithmRevision);
  } catch {
    return false;
  }
}
function createHistoricalArithmeticExecutor(historicalAtan2) {
  var __defProp3 = Object.defineProperty;
  var __defNormalProp3 = (obj, key, value) => key in obj ? __defProp3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField3 = (obj, key, value) => __defNormalProp3(obj, typeof key !== "symbol" ? key + "" : key, value);
  var GAME_CONSTANTS3 = {
    /** Tile size in pixels */
    TILE_SIZE: 32,
    /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
    CAMERA: {
      ZOOM: 1.5
    },
    /** Player movement (docs/specs/system-movement-vision.md, section M) */
    PLAYER: {
      SPEED: 80,
      // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
      MAX_HEALTH: 100,
      INVENTORY_SLOTS: 4,
      MOVE_ACCEL_TIME: 0.08,
      // s from standstill to full speed
      MOVE_DECEL_TIME: 0.1,
      // s from full speed to standstill
      FACING_TURN_RATE: 1080,
      // deg/s the vision cone swings toward the input direction
      FACING_QUANT_HYSTERESIS: 5,
      // deg of dead zone around the 45 degree facing4 boundaries
      BODY_SIZE: 20,
      // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
      BODY_OFFSET: { x: 6, y: 6 },
      // centres the collider inside the 32x32 sprite
      SPEED_MOD_MIN: 0.5
      // floor on the multiplied speed modifier stack
    },
    /**
     * Presentation-only gait (art-direction §3.3). Does not change facingAngle,
     * facing4 snap timing, speeds, or colliders.
     */
    ACTOR_MOTION: {
      FRAME_COUNT: 4,
      TURN_MS: 180,
      LAG_PX: 3,
      LAG_ALPHA: 0.38,
      MOVE_SPEED_FLOOR: 6,
      // px/s; below this the idle cycle plays
      PLAYER_IDLE_FPS: 4,
      PLAYER_WALK_FPS: 8,
      INFILTRATOR_IDLE_FPS: 4,
      INFILTRATOR_WALK_FPS: 4,
      // puppet hitch supplies the step; keep the sheet slow
      REWRITER_IDLE_FPS: 4,
      REWRITER_WALK_FPS: 6
    },
    /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
    CHAOS: {
      START_VALUE: 0,
      MAX_VALUE: 100,
      // HUD gauge max (value CAN exceed this)
      HARD_CAP: 150,
      BASE_RATE: 0.5,
      // points per second (DEC-024: calibrated for 80 px/s travel)
      THRESHOLD_1: 50,
      THRESHOLD_2: 75,
      THRESHOLD_3: 100,
      COMBAT_BONUS: 5,
      DETECTION_BONUS: 3,
      DETECTION_BONUS_COOLDOWN: 1e4,
      // ms per-enemy cooldown on detection chaos
      CHASE_RATE_MULT: 2,
      EMIT_STEP: 1,
      // minimum delta before emitting CHAOS_CHANGED
      MODULATOR_STEP: 1
      // minimum delta before calling onModulate callback
    },
    /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
    LOOT: {
      /** 迭代 10 起退役，见 spec 规则 14。名义参数，代码无引用；由 SEARCH_RADIUS 取代。 */
      PICKUP_RADIUS: 16,
      NODE_COUNT: 8,
      VALUE_SAFE: 1,
      VALUE_CONTESTED: 2,
      VALUE_DEEP: 4,
      SEARCH_CHANNEL_MS: 1200,
      SEARCH_RADIUS: 48,
      SEARCH_NOISE_RADIUS: 96,
      SEARCH_NOISE_LEVEL: "suspicious"
    },
    /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
    EXTRACTION: {
      TRIGGER_RADIUS: 48,
      KEY: "E",
      SETTLE_DELAY_MS: 600,
      RESTART_KEY: "R"
    },
    /**
     * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
     * Models a forward cone unioned with an ambient ring, with three fixed-width edge
     * bands. The older single-radius + edge-softness model was replaced rather than
     * extended, so the two parameter sets never coexist.
     */
    VISIBILITY: {
      RADIUS_FORWARD: 224,
      // px straight ahead (7 tiles); must exceed every profile sightRange (I1)
      RADIUS_AMBIENT: 80,
      // px all around (2.5 tiles) = the lamp the player carries
      CONE_HALF_ANGLE: 50,
      // deg half-angle of the full-range sector
      CONE_FALLOFF_ANGLE: 30,
      // deg of transition from forward range down to ambient
      MIN_SOLID_RADIUS: 48,
      // px that stay fully lit no matter what
      EDGE_BAND_WIDTH: 32,
      // px per gradient band (1 tile, art-direction 4.3)
      BAND_ALPHAS: [1, 0.6, 0.2],
      // visibility of core / middle / outer band
      ERASE_ALPHAS: [1, 0.5, 0.2],
      // per-layer erase strength producing those alphas
      RAY_COUNT: 60,
      // architecture ceiling
      RAY_SPLIT_FORWARD: 40,
      // rays inside the cone sector
      RAY_SPLIT_AMBIENT: 20,
      // rays across the remaining angles
      RAY_COUNT_DEGRADED: 40,
      // first degradation step
      RAY_SPLIT_FORWARD_DEGRADED: 28,
      RAY_SPLIT_AMBIENT_DEGRADED: 12,
      MIN_RADIUS_SCALE: 0.4,
      // hard floor for the chaos radius modulator
      CACHE_POS_EPSILON: 0.5,
      // px of movement tolerated before the cache is dropped
      CACHE_ANGLE_EPSILON: 0.5,
      // deg of rotation tolerated before the cache is dropped
      BUDGET_MS: 2,
      // per-frame raycasting budget
      DEGRADE_SAMPLE_FRAMES: 30,
      // consecutive frames over budget before degrading
      /** Void outside the field of view */
      VOID_COLOR: 526860,
      VOID_NOISE_ALPHA: 0.04,
      VOID_NOISE_TILE: 64,
      // px noise texture size
      VOID_NOISE_SCROLL: 2,
      // px/s drift
      /** Warm lamp the player carries - the only warm light inside a rift */
      PLAYER_LAMP_COLOR: 9067562,
      PLAYER_LAMP_ALPHA: 0.12,
      /**
       * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
       * the vision cone by the darkness mask. This is what makes the forward cone read as
       * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
       */
      FLASHLIGHT_COLOR: 11047018,
      // pale warm; a saturated brown would wash the cold floor out
      FLASHLIGHT_ALPHA: 0.16,
      // low enough that fragment L1 (clinic/metro/soil) still reads under the cone
      FLASHLIGHT_FORWARD_FRAC: 0.34,
      // push the pool centre this fraction of forward range ahead
      FLASHLIGHT_RADIUS_FRAC: 0.85,
      // pool radius as a fraction of forward range
      /** Glow bleeding through the darkness (Slice 1: extraction point only) */
      GLOW_LEAK_ALPHA: 0.25,
      GLOW_LEAK_RADIUS: 48,
      /** Chaos corruption of the vision edge */
      CORRUPTION_COLOR: 1748374,
      CORRUPTION_MAX_MIX: 0.6,
      // alpha of the teal band at corruption 1.0
      CORRUPTION_MAX_DEPTH: 0.35,
      // fraction of the range teal can eat at corruption 1.0
      CORRUPTION_JITTER_PX: 4,
      CORRUPTION_JITTER_HZ: 6,
      /**
       * Overflow (chaos > 100) full-screen teal wash. Persistent base stays well below the
       * old 0.08 epilepsy cap; the jump is a discrete ~2 s pulse (not a strobe), so its
       * peak can read as a "skip" without a rapid flash train.
       */
      FLICKER_BASE_ALPHA: 0.05,
      FLICKER_JUMP_ALPHA: 0.16,
      FLICKER_JUMP_PERIOD_MS: 2200,
      FLICKER_JUMP_WIDTH_MS: 140,
      /** Extra teal bite / edge jitter scale at screenFlicker = 1.0 */
      OVERFLOW_CORRUPTION_DEPTH_BOOST: 0.4,
      OVERFLOW_JITTER_BOOST: 1,
      /** Purification point overrides (omni mode) */
      PURIFY_RADIUS: 400,
      PURIFY_RAY_COUNT: 90
    },
    /**
     * Enemy AI (docs/specs/system-enemy-ai.md, "数值结构"). Every AI number lives here;
     * none are inlined in the systems.
     *
     * Six of these values are load-bearing relations rather than free parameters - the
     * balance invariants I1-I6 that make stealth playable at all. `config/invariants.ts`
     * asserts them at boot so tuning cannot silently break one.
     *
     * The old `SIGHT_ANGLE: 90 // cone half-angle` key was removed rather than kept: its
     * meaning split into a core cone and a peripheral band, and three overlapping angle
     * parameters would have been three ways to be wrong.
     */
    AI: {
      // --- movement and body (shared; per-role speeds live in data/enemies.csv) ---
      TURN_RATE: 360,
      // deg/s; a third of the player's, which is what makes flanking work (I6)
      BODY_SIZE: 20,
      // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
      BODY_OFFSET: { x: 6, y: 6 },
      // centres the collider inside the 32x32 infiltrator sprite
      SEPARATION_RADIUS: 24,
      // px; soft repulsion instead of enemy-vs-enemy physics
      SEPARATION_WEIGHT: 0.35,
      // how strongly separation bends the movement direction
      STANDOFF_DISTANCE: 30,
      // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
      STANDOFF_BAND: 4,
      // px of tolerance around it (26..34)
      STANDOFF_ADJUST_SPEED: 60,
      // px/s used to back off when the player crowds it
      // --- perception (shared; cone / hearing radii / weights live in data/enemies.csv) ---
      DETECT_FILL_TIME: 0.45,
      // s of clear sight to go from 0 to certain; then × visionWeight
      HEAR_FILL_TIME: 2,
      // s of hearing fill baseline; then × hearingWeight × moveMult
      HEARING_STILL_CAP: 0.2,
      // still-hearing cannot push detection past this (below 0.35)
      HEAR_ALERT_THRESHOLD: 0.7,
      // rewriter T0-4b: hearing can push to ALERT, never CHASE
      DETECT_DIST_FACTOR_NEAR: 1.6,
      // detection rate multiplier at point blank
      DETECT_DIST_FACTOR_FAR: 0.5,
      // ...and at the edge of sight range
      DETECT_ZONE_FACTOR_PERIPH: 0.45,
      // peripheral vision fills far slower than the core cone
      SUSPICION_THRESHOLD: 0.35,
      // detection at which it stops and turns - the player's warning
      REACQUIRE_THRESHOLD: 0.5,
      // lower bar to re-lock while already searching
      DETECT_DECAY_RATE: 0.67,
      // per s; ~1.5 s to clear after breaking sight
      DETECT_DECAY_ALERT_SCALE: 0.5,
      // decays half as fast while searching: it is holding a grudge
      HEARING_JITTER: 32,
      // px of positional fuzz, so hearing is not a wall-hack locator
      PERCEPTION_TICK_MS: 100,
      // 10 Hz perception; one raycast per enemy per tick
      PERCEPTION_TICK_MS_FAR: 200,
      // 5 Hz beyond ACTIVE_RANGE (rule N8)
      // --- timers (section "计时器") ---
      LOS_GRACE_MS: 400,
      // how long a chase survives with no line of sight
      LOST_PLAYER_DURATION: 5e3,
      // ms of ALERT searching
      ALERT_DURATION: 3e3,
      // ms a SUSPICIOUS enemy stays wary with no new stimulus
      CHASE_ABANDON_RANGE: 320,
      // px past which an unseen chase is given up
      WAYPOINT_PAUSE_MS: 1200,
      // dwell at a patrol waypoint - the player's window to slip past
      SCAN_HOLD_MS: 600,
      // dwell on each scan heading
      SEARCH_HOLD_MS: 800,
      // dwell at each ALERT search point
      EXTRAPOLATE_SEC: 0.6,
      // how far ahead of the last sighting to guess - punishes running straight
      SEARCH_SPREAD: 96,
      // px radius of the random third search point
      ALERT_EMIT_COOLDOWN_MS: 1e3,
      // suppression window for repeated same-level ENEMY_ALERT
      SUSPICIOUS_TURN_HOLD_MS: 200,
      // minimum standstill when turning to look (rule B2, ">= 0.2 s")
      SCAN_SWEEP_ANGLE: 45,
      // deg to each side when scanning in place
      SCAN_SWEEP_PERIOD_MS: 1500,
      // full left-right-left sweep period
      FACING_ARRIVE_EPSILON: 6,
      // deg within which a turn counts as completed
      // --- pathfinding and performance (section "寻路与性能") ---
      MAX_PATHS_PER_FRAME: 1,
      // architecture hard rule
      REPATH_INTERVAL_MS: 500,
      REPATH_INTERVAL_MS_FAR: 1e3,
      // for requests past SIMPLE_PATH_RANGE (rule N5)
      REPATH_MOVE_THRESHOLD: 48,
      // px of target movement that earns an early chase repath
      SIMPLE_PATH_RANGE: 384,
      // px past which a request drops to the lowest priority
      ASTAR_MAX_NODES: 3e3,
      // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
      PATH_FAIL_LIMIT: 3,
      // consecutive failures before giving up on the goal
      ACTIVE_RANGE: 640,
      // px; beyond this the FSM runs at 5 Hz and never asks for a path
      ARRIVE_EPSILON: 8,
      // px within which a path point counts as reached
      MAX_ACTIVE_ENEMIES: 8,
      // Slice 1 uses 4; more than this means the map data is wrong
      MAX_PATH_POINTS: 64,
      // capacity of a per-enemy dynamic path buffer
      DT_CLAMP_MS: 100,
      // stops a backgrounded tab from teleporting enemies on return
      /**
       * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
       * clear sight line does not prove a 20 px body fits through the diagonal seam it
       * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
       * symptom (wanting to move but not moving) and fall back to a real path.
       */
      STUCK_REPATH_MS: 400,
      STUCK_PATH_PREFERENCE_MS: 2e3,
      // how long a stuck enemy keeps preferring A* over straight lines
      STUCK_PROGRESS_FRACTION: 0.25,
      // actual/desired speed below which we count as stuck
      // --- placeholder presentation (section "占位期表现", art-direction 12) ---
      BODY_COLOR: 13386820,
      // "low tier enemy"; encodes tier, never state
      INDICATOR_COLOR: 2811592,
      // contamination teal; state lives here
      SUSPICIOUS_BREATH_HZ_MIN: 1.5,
      // breathing rate at the suspicion threshold...
      SUSPICIOUS_BREATH_HZ_MAX: 3,
      // ...and at full certainty (rule R3)
      ALERT_BLINK_HZ: 3,
      // blinking = searching
      AFTERIMAGE_INTERVAL_MS: 100,
      AFTERIMAGE_LIFETIME_MS: 300,
      AFTERIMAGE_ALPHA: 0.3,
      AFTERIMAGE_SLOTS: 4,
      // ring buffer per enemy; lifetime/interval + 1
      /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
      DEBUG_SHOW_VISION_CONE: false
    },
    /** Map generation */
    MAP: {
      WIDTH: 80,
      // tiles (larger to accommodate multiple fragments)
      HEIGHT: 80,
      // tiles
      /** Voronoi partitioning */
      FRAGMENT_COUNT_MIN: 4,
      FRAGMENT_COUNT_MAX: 6,
      FRAGMENT_MIN_AREA: 150,
      // minimum tiles per fragment
      /** Cellular automata */
      CA_ITERATIONS: 5,
      // smoothing passes
      CA_WALL_THRESHOLD: 4,
      // cells with >= N wall neighbors become wall
      CA_INITIAL_FILL: 0.45,
      // initial random fill ratio (lower = more open)
      /** Fracture connections between fragments */
      FRACTURE_WIDTH: 2,
      // tiles (narrow passage width)
      FRACTURE_MAX_PER_EDGE: 2
      // max connections between two adjacent fragments
    },
    /**
     * Slice 6 C1 land outline. Rectangular tile buffer; walkable land must not fill it.
     * 80×80 MAP.* numbers stay architecture placeholders — do not use them for this generator.
     */
    GENERATION: {
      BUFFER_COLS: 64,
      BUFFER_ROWS: 42,
      MAX_OUTLINE_ATTEMPTS: 28,
      LAND_FILL_MIN: 0.24,
      LAND_FILL_MAX: 0.48,
      BORDER_RING: 2,
      /** Fraction of the outer ring that may be land. Higher = island hugging the rectangle. */
      BORDER_OCCUPANCY_MAX: 0.12,
      /** Land / axis-aligned bbox. Circles sit near 0.78; filled rectangles sit near 1. */
      BBOX_FILL_MAX: 0.8,
      /**
       * Share of land cells that touch void. Large blobs naturally sit lower;
       * this only rejects near-solid blocks (a 1-cell frame around a filled rect).
       */
      ROUGHNESS_MIN: 0.08,
      /** bbox must leave at least this many leftover cells on width+height combined. */
      MIN_BBOX_SLACK: 8,
      MAX_EDGES_TOUCHING: 3,
      MAX_RUIN_ATTEMPTS: 40,
      MIN_FEATURE_SEPARATION: 7,
      WALL_RATIO_MIN: 0.018,
      WALL_RATIO_MAX: 0.22,
      /** Largest leftover open rectangle (tiles). Bigger than this reads as an empty plaza. */
      YARD_AREA_MAX: 64
    },
    /** Purification point (docs/specs/system-purification-impact.md) */
    PURIFICATION: {
      /** Spatial layout */
      MAP_COLS: 14,
      // tiles
      MAP_ROWS: 12,
      // tiles
      INTERACTION_RADIUS: 32,
      // pixels for module/rift-entrance interaction
      /** Module state */
      MODULE_INITIAL_HP: 70,
      /** Tier-0 repair cap / effect denominator baseline (DEC-064). */
      MODULE_BASE_MAX_HP: 100,
      /** Alias of MODULE_BASE_MAX_HP so older call sites still compile. */
      MODULE_MAX_HP: 100,
      /** Each thicken tier adds this many maxHp to every module. */
      MODULE_MAX_HP_PER_TIER: 15,
      /** Highest purchasable thicken tier (maxHp = 100 + 15*3 = 145). */
      MODULE_MAX_HP_TIERS: 3,
      // Thickening purchase costs are authored alongside all other growth steps
      // in data/growth-route.csv, not a separate system-constant price ladder.
      /** All three module effects use this HP reference; thickening does not raise it. */
      MODULE_EFFECT_HP_REF: 100,
      /** Starting chaos when purifier hp = 0 (full integrity → 0). */
      CHAOS_HARD_START: 50,
      REPAIR_PER_KINDLING: 4,
      // 1 kindling = this many hp (tuned for scarcity)
      /** Impact system (intensity now driven by TideSystem, see TIDE constants) */
      BASE_IMPACT_DAMAGE: 30,
      THREAT_FOCUS_RATIO: 0.65,
      // primary target gets this fraction of total damage
      FORECAST_ACCURACY: 0.8,
      // particle prediction accuracy
      /** combust defense mechanic (DEC-030): fixed threshold, not derived from
       * BASE_IMPACT_DAMAGE, so tide-driven damage swings don't shift the trigger point.
       * Value chosen to equal ~2x BASE_IMPACT_DAMAGE(30) per the CSV's "约等于2次满额冲击". */
      COMBUST_BURN_THRESHOLD: 60,
      /** Module effects */
      MAX_CORE_REDUCTION: 0.3,
      // chaosRate reduction at full hp
      MAX_STORAGE_BONUS: 0.5,
      // kindling value bonus at full hp
      /** resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%".
       * A flat bump to both caps above while at least one resonate sits in a defense slot -
       * not a multiplier, so it reads the same way the CSV states it ("+10%" alongside two
       * numbers already expressed as flat percentages). "不叠加" is enforced by storing this
       * as a single on/off flag (`GameState.isResonateBonusActive()`), not a per-item count. */
      RESONATE_MODULE_CAP_BONUS: 0.1,
      /** siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍(1薪柴=8hp)" - same
       * "装备期间" derivation pattern as RESONATE_MODULE_CAP_BONUS above (owned by
       * `ContaminantSystem.syncRepairEfficiencyMult()` + `GameState`, not a per-impact
       * defense-engine effect), since the CSV names it a standing equip-state bonus rather
       * than a one-impact trigger. 4 (REPAIR_PER_KINDLING) * 2.0 = 8, matching the CSV. */
      SIPHON_REPAIR_EFFICIENCY_MULT: 2,
      /** Boundary atmosphere */
      ATMOSPHERE: {
        PARTICLE_COUNT: 50,
        // active boundary particles
        PARTICLE_ALPHA_MIN: 0.06,
        PARTICLE_ALPHA_MAX: 0.25,
        PARTICLE_SPEED: 8,
        // px/s slow inward drift
        APPARITION_INTERVAL_MIN: 8e3,
        // ms
        APPARITION_INTERVAL_MAX: 15e3,
        APPARITION_DURATION: 3e3,
        // ms (0.5s fade in + 2s hold + 0.5s fade out)
        APPARITION_MAX_SIMULTANEOUS: 3
      },
      /** Dynamic boundary shape (polar pressure blob) */
      BOUNDARY: {
        SHRINK_AT_MAX_INTENSITY: 0.72,
        // tideScale at intensity 3.0 (boundary loses up to 28%)
        PRESSURE_PRIMARY_AMP: 0.2,
        // max inward push fraction (primary Gaussian lobe)
        PRESSURE_SECONDARY_AMP: 0.1,
        // secondary lobe amplitude
        PRESSURE_LOBE_SIGMA: 0.7,
        // radians; width of each Gaussian lobe
        PRESSURE_CREST_BONUS: 0.4,
        // +40% amplitude during crest phase
        PRESSURE_EBB_FACTOR: 0.6,
        // amplitude multiplier during ebb phase
        SAFE_MARGIN_TILES: 1,
        // minimum distance from any interaction point to boundary
        GRADIENT_INNER_START: 0.8,
        // fraction of R where darkening begins
        GRADIENT_MEMBRANE_START: 0.95,
        // fraction where "membrane" teal band begins
        GRADIENT_OUTER_END: 1.15,
        // fraction where full void begins
        /**
         * B4 (Slice 5): the old BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT
         * keys described a single global sinusoidal pulse from a "whole-boundary breathing"
         * design that DEC-028 (Slice 4.5) replaced with localized pressure impacts
         * (`src/systems/boundary-breath.ts`). Those 5 keys had zero consumers and were
         * removed; this nested object holds boundary-breath.ts's real tuning knobs
         * (previously inlined as top-of-file `const`s there) instead. Values unchanged.
         */
        BREATH: {
          SAMPLE_COUNT: 72,
          // angular resolution of the membrane/impact draw
          MAX_IMPACTS: 5,
          // max simultaneous localized impacts
          ARC_HALF_MIN: 0.4,
          // rad; narrowest impact arc half-width
          ARC_HALF_MAX: 0.8,
          // rad; widest impact arc half-width
          SPAWN_DIST_MIN: 14,
          // px; closest impact spawn distance outside the membrane
          SPAWN_DIST_MAX: 30,
          // px; farthest impact spawn distance
          IMPACT_DURATION_MIN: 1800,
          // ms; shortest single-impact lifetime
          IMPACT_DURATION_MAX: 3500,
          // ms; longest single-impact lifetime
          SPAWN_INTERVAL_MIN: 400,
          // ms; shortest gap between new impacts
          SPAWN_INTERVAL_MAX: 1200,
          // ms; longest gap between new impacts (x0.6 during crest)
          WAVE_COLOR: 936511,
          // dark desaturated teal, the inbound wave arcs
          MEMBRANE_COLOR: 1735274,
          // the boundary membrane line itself
          DEFORM_MAX_PX: 8
          // px; max inward push of the membrane at impact center
        }
      },
      /** Scene transition timing */
      IMPACT_RESULT_DISPLAY_MS: 2e3,
      SCENE_TRANSITION_DELAY_MS: 600
    },
    /**
     * Combat (docs/specs/system-combat.md, "数值结构"). Every combat number lives here.
     *
     * The system is a price list, not a fight: the point is that the player can work out
     * what swinging costs before swinging. Three of these relations carry that promise and
     * are asserted at boot by `config/invariants.ts` (K1/K2/K3/K5) - notably
     * `ENEMY_MAX_HEALTH` being an exact multiple of `PLAYER_DAMAGE`, which is what makes
     * "three hits" a fact rather than an average.
     *
     * When combat turns out too cheap in playtesting, the spec's tuning order is
     * `CHAOS.COMBAT_BONUS` and `NOISE_HIT_RADIUS` first, `ENEMY_MAX_HEALTH` second, and
     * `PLAYER_DAMAGE` never (weakening it makes combat expensive *and* unpleasant).
     */
    COMBAT: {
      // --- player attack (section "玩家攻击") ---
      PLAYER_DAMAGE: 25,
      ATTACK_COOLDOWN: 500,
      // ms, counted from the input instant, parallel to the phases
      ATTACK_RANGE: 40,
      // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
      ATTACK_HALF_ANGLE: 60,
      // deg -> a 120 deg forward sector
      ATTACK_WINDUP_MS: 100,
      // the player's side of the commitment
      ATTACK_ACTIVE_MS: 50,
      // ~3 frames; exists to tolerate frame jitter, not to widen the hit
      ATTACK_RECOVERY_MS: 70,
      ATTACK_SLOW_MS: 220,
      // derived: windup + active + recovery (asserted, not free)
      ATTACK_SELF_SLOW: 0.35,
      // move speed while swinging - the "cost" that lands on feel
      ATTACK_MIN_ANGLE_BYPASS: 16,
      // px within which the angle test is meaningless and skipped
      /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
      ATTACK_KEY: "SPACE",
      // --- infiltrator (section "敌人（渗透体）") ---
      ENEMY_MAX_HEALTH: 75,
      // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
      ENEMY_DAMAGE_BASE: 15,
      ENEMY_ATTACK_RANGE: 38,
      // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
      ENEMY_ATTACK_HALF_ANGLE: 60,
      // deg; symmetric with the player's
      ENEMY_ATTACK_WINDUP_MS: 350,
      // the player's dodge window - the whole of "controllable" (K3)
      ENEMY_ATTACK_COOLDOWN_MS: 1200,
      ENEMY_FIRST_ATTACK_DELAY_MS: 300,
      // "caught up with you" and "hit you" stay two events
      ENEMY_ATTACK_TOKENS: 2,
      // enemies allowed in windup at once; caps unavoidable damage
      ENEMY_HIT_FLASH_MS: 80,
      ENEMY_DEATH_FX_MS: 180,
      // presentation only; the enemy is gone from logic at 0 ms
      // --- player health and hits (section "玩家生命值与受击") ---
      PLAYER_IFRAME_MS: 400,
      // stops two enemies resolving on one frame for 30 damage
      PLAYER_HIT_FLASH_MS: 100,
      // --- noise: the exposure half of the price (section "噪声") ---
      NOISE_SWING_RADIUS: 96,
      // px (3 tiles), 'suspicious' - a whiff is heard, not billed
      NOISE_HIT_RADIUS: 160,
      // px (5 tiles), 'alert' - the main reason a fight is loud
      NOISE_KILL_RADIUS: 192,
      // px (6 tiles), 'alert'
      /**
       * Placeholder presentation (spec V2). White is on loan here: it currently means
       * "player / extraction point" in art-direction 12, and using thin white lines and
       * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
       * Treat these as stand-ins, not as the visual language.
       */
      FX_COLOR: 16777215,
      ATTACK_FAN_FX_MS: 60,
      // how long the swing outline stays up (spec V2)
      PLAYER_FLASH_PAD: 6,
      // px the hit flash overshoots the body; see report on white-on-white
      FX_POOL_SIZE: 12
      // preallocated flash/death sprites: 8 enemies + headroom
    },
    /**
     * Contamination lexicon (DEC-076). Morph tables stay in CSV.
     * These are system constants: core HP, chaos prices, draw retry, encounter timing.
     */
    CONTAMINATION: {
      CORE_MAX_HEALTH: 50,
      ADJACENT_STRIKE_DAMAGE: 15,
      ADJACENT_STRIKE_WINDUP_MS: 350,
      PAINT_STEP_CHAOS_REST: 2,
      PAINT_STEP_CHAOS_INFLATED: 4,
      VOLUME_CHAOS_PER_SEC: 1,
      VOLUME_SIGHT_MULT: 0.7,
      DRAW_RETRY_LIMIT: 12,
      ENCOUNTER_COOLDOWN_MS: 6e4,
      ENCOUNTER_GAP_MS: 2500,
      ENCOUNTER_HOLD_MS: 2500,
      VOLUME_DEPTH: 40,
      COLONY_NUCLEUS_COUNT_MIN: 2,
      COLONY_NUCLEUS_COUNT_MAX: 3,
      COLONY_NUCLEUS_MIN_TILE_GAP: 3
    },
    /** Audio */
    AUDIO: {
      MAX_SIMULTANEOUS_SFX: 8,
      DEFAULT_SFX_VOLUME: 0.7,
      DEFAULT_BGM_VOLUME: 0.4,
      DEFAULT_AMBIENT_VOLUME: 0.5
    },
    /** Tide system (docs/specs/system-growth-tide.md, section T) */
    TIDE: {
      TIDES: [
        { floor: 1, peak: 1.6, riseCycles: 3, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.2 },
        { floor: 1.2, peak: 2, riseCycles: 4, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.5 },
        { floor: 1.5, peak: 2.4, riseCycles: 4, crestCycles: 2, ebbCycles: 2, ebbTarget: 1.8 },
        { floor: 1.8, peak: 2.8, riseCycles: 4, crestCycles: 2, ebbCycles: 3, ebbTarget: 2 },
        { floor: 2, peak: 3, riseCycles: 5, crestCycles: Infinity, ebbCycles: 0, ebbTarget: 2 }
      ],
      CREST_CHARGE_COST: 3,
      // impact charge cost during Crest phase
      NORMAL_CHARGE_COST: 1,
      // impact charge cost during Rise/Ebb phases
      TRANSFORM_THRESHOLD: 3
      // charges needed to transform defense -> tool
    },
    // Growth / permanent upgrades (docs/specs/system-growth-tide.md, section G):
    // Definitions come from data/upgrades.csv; all step costs come from
    // data/growth-route.csv (including thickening). Both generate upgrade-data.ts
    // under the CSV source rule — no constants block here
    // by design; growth-system.ts reads UPGRADE_DATA directly.
    /** Contaminant system (docs/specs/system-growth-tide.md, section CN) */
    CONTAMINANT: {
      NODES_PER_MAP: 3,
      // contaminant pickup nodes per rift map
      RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
      DEFENSE_SLOTS: 1,
      // base slot; each growth_defense_slot level adds +1
      SORTIE_SLOTS: 3,
      // base slots (2 active + 1 passive); growth_sortie_slot adds +1 active
      MAX_DEFENSE_SLOTS: 4,
      // DEFENSE_SLOTS + max growth_defense_slot bonus (maxLevel 3)
      MAX_SORTIE_SLOTS: 4,
      // SORTIE_SLOTS + max growth_sortie_slot bonus (maxLevel 1)
      USES: { common: 5, fine: 3, rare: 2 },
      // uses remaining after transformation
      /** echo defense mechanic: "单件因此最多+2" — per-tool cap on echo bonus grants. */
      ECHO_MAX_TOOL_USE_BONUS: 2,
      /**
       * Hotkeys for the active sortie slots, in slot order. The passive slot (always the
       * last unlocked slot, see `contaminantSystem.getSortiePassiveSlotIndex()`) never gets
       * an entry here - it has no hotkey by design. G was picked for the 3rd slot
       * (growth_sortie_slot, Slice 5 T5) because it sits directly beside F on the keyboard,
       * the same "one key past the movement cluster" reach as Q/F already use, and every
       * other neighbour (E/R/T) is already taken by extraction/restart/nothing-reserved-but-
       * awkward. Single source of truth for both the RiftScene binding and any UI that needs
       * to render the real key label.
       */
      SORTIE_ACTIVE_KEYS: ["Q", "F", "G"]
    },
    /** Purification stability (docs/specs/system-growth-tide.md, section S) */
    STABILITY: {
      MAX: 100,
      GAIN_EXTRACT: 1,
      // successful extraction (calibrated: ~35 cycles to cap)
      GAIN_GROWTH: 1,
      // purchased an upgrade
      GAIN_CREST_SURVIVED: 3,
      // survived a full Crest with no module at zero
      GAIN_TIDE_ADVANCE: 5,
      // tide advanced to next number
      LOSS_MODULE_ZERO: -1
      // a module reached 0 hp
    },
    /**
     * Fine/Rare active+passive tool numbers not already carried by
     * `src/generated/contaminant-data.ts` (radius/duration/uses read straight from the CSV
     * at the point of use instead of being re-hardcoded here - see `docs/design-notes/
     * slice3-sortie-tools.md`). Everything below is either a multiplier/amount the CSV
     * description states in prose (`data/contaminants.csv`, `description_tool` column) or,
     * where flagged, a placeholder-tier number the CSV leaves unspecified (Slice 5 T1).
     */
    TOOLS: {
      /** compress: "半径2格内敌人移速-60%" */
      COMPRESS_SPEED_MULT: 0.4,
      /** resonate: "弹回3格并眩晕2秒" */
      RESONATE_KNOCKBACK_PX: 96,
      RESONATE_STUN_MS: 2e3,
      /** overwrite: "感知范围缩小50%" */
      OVERWRITE_PERCEPTION_MULT: 0.5,
      /** combust: "感知范围-50%"(烈焰遮蔽视线) */
      COMBUST_PERCEPTION_MULT: 0.5,
      /** combust: "每秒受到持续伤害" - CSV gives no amount; placeholder tuned so an enemy
       * that stays the full 8s duration dies (75 hp / 15 = 5 ticks), matching the tool's
       * rare-tier power level. Flagged for design confirmation (see delivery report). */
      COMBUST_DAMAGE_PER_TICK: 15,
      COMBUST_TICK_MS: 1e3,
      /** mirror: "被敌人接触后碎裂消失" - CSV gives no contact radius; placeholder tuned to
       * roughly one enemy body width. Flagged for design confirmation. */
      MIRROR_CONTACT_RADIUS: 20,
      /** abyss: "使用后5秒内混乱增速+50%" - a second timing value the CSV's single
       * `tool_duration_ms` column cannot carry (that field holds the 10s reveal instead). */
      ABYSS_CHAOS_BOOST_MULT: 1.5,
      ABYSS_CHAOS_BOOST_MS: 5e3,
      /** siphon: "吸取2点薪柴且...混乱值增速减半" */
      SIPHON_KINDLING_GAIN: 2,
      SIPHON_CHAOS_REDUCTION_MULT: 0.5
    },
    /** Persistent save (docs/specs/system-growth-tide.md, section P) */
    SAVE: {
      KEY: "coh-save-v1",
      VERSION: 2
    }
  };
  var ENV_INK2 = {
    seam: [20, 28, 28],
    shadow: [36, 46, 44],
    body: [64, 79, 73],
    ridge: [100, 117, 103],
    ash: [112, 113, 102],
    ashShadow: [59, 65, 62],
    oil: [29, 39, 39],
    oilRidge: [69, 94, 86],
    metal: [88, 91, 83],
    rust: [92, 75, 60],
    teal: [54, 154, 132],
    lit: [128, 198, 168]
  };
  function stageOf2(c) {
    return c === "infiltrate" ? 0 : c === "rewrite" ? 1 : 2;
  }
  function activityOf2(p) {
    return p?.activity?.phase === "rest" ? 0 : p?.activity?.phase === "waking" ? p.activity.progress : 1;
  }
  function putPixel2(out, w, h, x, y, ink, alpha = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    out[i] = ink[0];
    out[i + 1] = ink[1];
    out[i + 2] = ink[2];
    out[i + 3] = alpha;
  }
  function cluster2(x, y, seed2) {
    let n = Math.imul(Math.floor(x / 3) + seed2, 374761393) ^ Math.imul(Math.floor(y / 2) + 11, 668265263);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return (n >>> 0) % 11;
  }
  function paintSurfaceMaterial2(out, field2, w, h, substrate, coverage, seed2, elapsedMs = 0, pose) {
    out.fill(0);
    const stage = stageOf2(coverage), activity = activityOf2(pose);
    const phase2 = elapsedMs * Math.PI * 2 / 2400;
    const inflated = pose?.signal === "inflated";
    const lift = activity * (inflated ? 1 : 0.45);
    const cx = w * 0.5, cy = h * 0.5;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, v = field2[i];
      if (v < 0.1) continue;
      const r = Math.hypot(x - cx, y - cy), a = historicalAtan2(y - cy, x - cx);
      const north = field2[i - w] < 0.1, south = field2[i + w] < 0.1;
      const edge = north || south || field2[i - 1] < 0.1 || field2[i + 1] < 0.1;
      let ink = ENV_INK2.shadow, alpha = 255;
      if (substrate === "fungal_mat") {
        const fold = (Math.floor(y * 0.65 + Math.sin(x * 0.16 + stage * 0.3) * (3 + stage) + Math.sin(y * 0.09) * 2 + Math.sin(phase2 - y * 0.08) * lift * 1.8) % 7 + 7) % 7;
        ink = fold <= 1 ? ENV_INK2.seam : fold === 2 ? ENV_INK2.ridge : fold < 5 ? ENV_INK2.body : ENV_INK2.shadow;
        if (north) ink = ENV_INK2.ridge;
        if (south) ink = ENV_INK2.seam;
        if (cluster2(x, y, seed2) === 3 && fold > 2 && fold < 5) ink = ENV_INK2.shadow;
        if (stage > 0 && Math.abs(Math.sin(a * (3 + stage) + r * 0.08)) < 0.1 && fold === 2) ink = ENV_INK2.teal;
      } else if (substrate === "oil_film") {
        const ribbon2 = Math.floor(y + Math.sin(x * 0.11 + stage * 0.4) * (2 + stage) + Math.sin(phase2) * lift * 2) % 12;
        ink = ENV_INK2.oil;
        if (north) ink = ENV_INK2.oilRidge;
        else if (south) ink = ENV_INK2.seam;
        else if (ribbon2 === 2 && cluster2(x, y, seed2) < 7) ink = ENV_INK2.oilRidge;
        else if (ribbon2 === 3 && cluster2(x, y, seed2) < 4) ink = ENV_INK2.body;
        if (stage > 0 && ribbon2 === 8 && Math.floor(x / 5) % 3 === 1) ink = ENV_INK2.shadow;
        if (stage === 2 && ribbon2 === 9 && Math.floor(x / 4) % 5 === 0) ink = ENV_INK2.teal;
      } else {
        const shear = Math.round(Math.sin(phase2 + y * 0.12) * lift * (1 + stage));
        const fold = (y + Math.floor(x / 8) * (stage + 1) + shear + 1e3) % 8;
        ink = fold === 0 ? ENV_INK2.seam : fold < 3 ? ENV_INK2.ash : fold < 5 ? ENV_INK2.ashShadow : ENV_INK2.shadow;
        if (north) ink = ENV_INK2.ash;
        if (south) ink = ENV_INK2.seam;
        if (cluster2(x, y, seed2) === 5 && fold > 2) ink = ENV_INK2.ashShadow;
        if (stage > 0 && fold === 1 && Math.floor(x / 4) % 7 === 0) ink = ENV_INK2.teal;
      }
      if (edge && cluster2(x, y, seed2) < 2) ink = ENV_INK2.shadow;
      if (v >= 0.78) ink = activity > 0.35 ? ENV_INK2.teal : ENV_INK2.body;
      if (activity < 0.3 && ink === ENV_INK2.teal) ink = ENV_INK2.body;
      if (ink === ENV_INK2.teal && inflated) ink = ENV_INK2.lit;
      putPixel2(out, w, h, x, y, ink, alpha);
    }
  }
  var RIFT_FRAGMENT_DATA3 = {
    "frag-outdoor": {
      id: "frag-outdoor",
      displayName: "\u6237\u5916\u571F\u58E4",
      coverage: "remnant",
      massGrammar: "ridge",
      jogPeriod: 4,
      jogAmp: 1,
      gapCount: 0,
      gapPlacement: "",
      turnCount: 0,
      turnCorner: "",
      capKind: "stub",
      facingPolicy: "random",
      join: "single",
      surfaceMaterial: "soil",
      enabled: true,
      floorBv: 26,
      floorBiasR: 0.88,
      floorBiasG: 1.02,
      floorBiasB: 0.82,
      stainKey: "frag-outdoor",
      stainThreshold: 0.72,
      stainStrength: 0.4,
      grimeAmp: 0.5,
      macroAmp: 0.32,
      scratchPer1000px2: 0.55,
      fleckPer1000px2: 1.25,
      scratchAngle: "free",
      scratchDispersion: 0,
      wallBv: 24,
      wallBiasR: 1,
      wallBiasG: 0.88,
      wallBiasB: 0.75,
      featureWidthTiles: 1,
      featureLengthTiles: 6,
      featureCountMin: 12,
      featureCountMax: 24
    },
    "frag-clinic": {
      id: "frag-clinic",
      displayName: "\u533B\u9662\u5B9E\u9A8C\u5BA4",
      coverage: "remnant",
      massGrammar: "enclosure",
      jogPeriod: 0,
      jogAmp: 0,
      gapCount: 1,
      gapPlacement: "end",
      turnCount: 2,
      turnCorner: "right",
      capKind: "none",
      facingPolicy: "alternate",
      join: "single",
      surfaceMaterial: "tile",
      enabled: true,
      floorBv: 28,
      floorBiasR: 0.86,
      floorBiasG: 0.92,
      floorBiasB: 1.08,
      stainKey: "shadow-grey",
      stainThreshold: 0.78,
      stainStrength: 0.25,
      grimeAmp: 0.28,
      macroAmp: 0.18,
      scratchPer1000px2: 0.7,
      fleckPer1000px2: 0.55,
      scratchAngle: "orthogonal",
      scratchDispersion: 0,
      wallBv: 30,
      wallBiasR: 0.82,
      wallBiasG: 0.9,
      wallBiasB: 1.05,
      featureWidthTiles: 1,
      featureLengthTiles: 5,
      featureCountMin: 14,
      featureCountMax: 22
    },
    "frag-metro": {
      id: "frag-metro",
      displayName: "\u5730\u94C1\u5DE5\u4E1A",
      coverage: "remnant",
      massGrammar: "slab",
      jogPeriod: 0,
      jogAmp: 0,
      gapCount: 1,
      gapPlacement: "center",
      turnCount: 0,
      turnCorner: "",
      capKind: "pier",
      facingPolicy: "axis",
      join: "single",
      surfaceMaterial: "metal",
      enabled: true,
      floorBv: 24,
      floorBiasR: 1.08,
      floorBiasG: 0.86,
      floorBiasB: 0.72,
      stainKey: "brick-dark",
      stainThreshold: 0.68,
      stainStrength: 0.35,
      grimeAmp: 0.42,
      macroAmp: 0.28,
      scratchPer1000px2: 0.45,
      fleckPer1000px2: 0.9,
      scratchAngle: "longitudinal",
      scratchDispersion: 0.15,
      wallBv: 26,
      wallBiasR: 1.1,
      wallBiasG: 0.82,
      wallBiasB: 0.68,
      featureWidthTiles: 2,
      featureLengthTiles: 6,
      featureCountMin: 10,
      featureCountMax: 16
    },
    "frag-library": {
      id: "frag-library",
      displayName: "\u65E7\u56FE\u4E66\u9986",
      coverage: "remnant",
      massGrammar: "ridge",
      jogPeriod: 6,
      jogAmp: 1,
      gapCount: 2,
      gapPlacement: "random",
      turnCount: 0,
      turnCorner: "",
      capKind: "none",
      facingPolicy: "axis",
      join: "single",
      surfaceMaterial: "wood",
      enabled: true,
      floorBv: 26,
      floorBiasR: 1.08,
      floorBiasG: 0.86,
      floorBiasB: 0.72,
      stainKey: "frag-library",
      stainThreshold: 0.6,
      stainStrength: 0.3,
      grimeAmp: 0.34,
      macroAmp: 0.2,
      scratchPer1000px2: 0.8,
      fleckPer1000px2: 0.7,
      scratchAngle: "longitudinal",
      scratchDispersion: 0.35,
      wallBv: 24,
      wallBiasR: 1.02,
      wallBiasG: 0.93,
      wallBiasB: 0.68,
      featureWidthTiles: 1,
      featureLengthTiles: 6,
      featureCountMin: 10,
      featureCountMax: 16
    },
    "frag-residential": {
      id: "frag-residential",
      displayName: "\u5C45\u6C11\u533A\u516C\u5BD3",
      coverage: "remnant",
      massGrammar: "cluster",
      jogPeriod: 2,
      jogAmp: 1,
      gapCount: 3,
      gapPlacement: "random",
      turnCount: 0,
      turnCorner: "",
      capKind: "widen",
      facingPolicy: "alternate",
      join: "single",
      surfaceMaterial: "plaster",
      enabled: false,
      floorBv: 28,
      floorBiasR: 1.08,
      floorBiasG: 0.86,
      floorBiasB: 0.72,
      stainKey: "frag-residential",
      stainThreshold: 0.7,
      stainStrength: 0.3,
      grimeAmp: 0.38,
      macroAmp: 0.24,
      scratchPer1000px2: 0.4,
      fleckPer1000px2: 0.4,
      scratchAngle: "orthogonal",
      scratchDispersion: 0.6,
      wallBv: 30,
      wallBiasR: 1.02,
      wallBiasG: 0.96,
      wallBiasB: 0.79,
      featureWidthTiles: 2,
      featureLengthTiles: 5,
      featureCountMin: 18,
      featureCountMax: 24
    }
  };
  var ENABLED_RIFT_FRAGMENTS3 = Object.values(RIFT_FRAGMENT_DATA3).filter((row) => row.enabled);
  function at2(cols, col, row) {
    return row * cols + col;
  }
  function hash01(col, row, salt) {
    let h = col * 374761393 + row * 668265263 + salt * 2147483647 | 0;
    h = Math.imul(h ^ h >> 13, 1274126177) | 0;
    return ((h ^ h >> 16) >>> 0) / 4294967296;
  }
  function exteriorVoidMask(land, cols, rows) {
    const ext = new Uint8Array(land.length);
    const stack = [];
    const mark = (i) => {
      if (i < 0 || i >= land.length || land[i] || ext[i]) return;
      ext[i] = 1;
      stack.push(i);
    };
    for (let col = 0; col < cols; col++) {
      mark(at2(cols, col, 0));
      mark(at2(cols, col, rows - 1));
    }
    for (let row = 0; row < rows; row++) {
      mark(at2(cols, 0, row));
      mark(at2(cols, cols - 1, row));
    }
    while (stack.length > 0) {
      const i = stack.pop();
      const col = i % cols;
      const row = i / cols | 0;
      if (col > 0) mark(i - 1);
      if (col < cols - 1) mark(i + 1);
      if (row > 0) mark(i - cols);
      if (row < rows - 1) mark(i + cols);
    }
    return ext;
  }
  function distField(source, cols, rows) {
    const inf = cols + rows + 1;
    const dist = new Float32Array(source.length);
    dist.fill(inf);
    const q = [];
    for (let i = 0; i < source.length; i++) {
      if (!source[i]) continue;
      dist[i] = 0;
      q.push(i);
    }
    let head = 0;
    while (head < q.length) {
      const i = q[head++];
      const col = i % cols;
      const row = i / cols | 0;
      const nd = dist[i] + 1;
      const push = (j) => {
        if (nd < dist[j]) {
          dist[j] = nd;
          q.push(j);
        }
      };
      if (col > 0) push(i - 1);
      if (col < cols - 1) push(i + 1);
      if (row > 0) push(i - cols);
      if (row < rows - 1) push(i + cols);
    }
    return dist;
  }
  function sampleScalar(field2, cols, rows, x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const g = (c, r) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return 0;
      return field2[r * cols + c];
    };
    return g(x0, y0) * (1 - tx) * (1 - ty) + g(x0 + 1, y0) * tx * (1 - ty) + g(x0, y0 + 1) * (1 - tx) * ty + g(x0 + 1, y0 + 1) * tx * ty;
  }
  function buildOccluders(spec, cols, rows, windX, windY, rng) {
    if (spec.skyShadow <= 0.04) return [];
    const restCx = cols * 0.5;
    const restCy = rows * 0.5;
    const occluders = [
      {
        restCx,
        restCy,
        ux: windX,
        uy: windY,
        length: 8 + spec.skyShadow * 10,
        halfWidth: 1.5 + spec.skyShadow * 2.6,
        softness: 1.1 + spec.skyShadow * 1.3,
        strength: 0.4 + spec.skyShadow * 0.28,
        travel: 2 + spec.skyShadow * 3.8
      }
    ];
    if (spec.skyShadow > 0.48) {
      const perpX = -windY;
      const perpY = windX;
      const side = rng.next() < 0.5 ? -1 : 1;
      occluders.push({
        restCx: restCx - windX * (7 + spec.skyShadow * 4) + perpX * side * (2.2 + rng.next() * 2),
        restCy: restCy - windY * (7 + spec.skyShadow * 4) + perpY * side * (2.2 + rng.next() * 2),
        ux: windX,
        uy: windY,
        length: 3 + spec.skyShadow * 4.5,
        halfWidth: 0.9 + spec.skyShadow * 1.4,
        softness: 0.9 + spec.skyShadow * 0.6,
        strength: 0.2 + spec.skyShadow * 0.16,
        travel: 1.6 + spec.skyShadow * 2.4
      });
    }
    return occluders;
  }
  function blurFog(fog, cols, rows) {
    const next = new Float32Array(fog.length);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at2(cols, col, row);
        let acc = fog[i] * 0.4;
        let w = 0.4;
        if (col > 0) {
          acc += fog[i - 1] * 0.15;
          w += 0.15;
        }
        if (col < cols - 1) {
          acc += fog[i + 1] * 0.15;
          w += 0.15;
        }
        if (row > 0) {
          acc += fog[i - cols] * 0.15;
          w += 0.15;
        }
        if (row < rows - 1) {
          acc += fog[i + cols] * 0.15;
          w += 0.15;
        }
        next[i] = acc / w;
      }
    }
    fog.set(next);
  }
  function advectFog(fog, cols, rows, windX, windY) {
    const src = new Float32Array(fog);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at2(cols, col, row);
        const sampled = sampleScalar(src, cols, rows, col - windX * 1.5, row - windY * 1.5);
        fog[i] = fog[i] * 0.62 + sampled * 0.38;
      }
    }
  }
  function buildAtmosphere(land, walls, cols, rows, spec, glitches, rng) {
    const phase2 = rng.next();
    const angle = rng.next() * Math.PI * 2;
    const windX = Math.cos(angle);
    const windY = Math.sin(angle);
    const slideSpan = Math.hypot(cols, rows) * 0.72;
    const occluders = buildOccluders(spec, cols, rows, windX, windY, rng);
    const exterior = exteriorVoidMask(land, cols, rows);
    const hollow = new Uint8Array(land.length);
    for (let i = 0; i < land.length; i++) {
      if (!land[i] && !exterior[i]) hollow[i] = 1;
    }
    const distExt = distField(exterior, cols, rows);
    const distHollow = distField(hollow, cols, rows);
    const distLand = distField(land, cols, rows);
    const distWall = distField(walls, cols, rows);
    const poolSum = spec.poolRim + spec.poolHollow + spec.poolOpen;
    const wRim = poolSum > 0 ? spec.poolRim / poolSum : 0.48;
    const wHollow = poolSum > 0 ? spec.poolHollow / poolSum : 0.34;
    const wOpen = poolSum > 0 ? spec.poolOpen / poolSum : 0.18;
    const fog = new Float32Array(land.length);
    const inf = cols + rows + 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at2(cols, col, row);
        const grain = 0.78 + 0.44 * hash01(col, row, 91);
        if (!land[i]) {
          if (hollow[i]) fog[i] = spec.fog * 0.95 * grain;
          else fog[i] = spec.fog * 0.8 * Math.max(0, 1 - distLand[i] / 3.5) * grain;
          continue;
        }
        const rim = Math.max(0, 1 - distExt[i] / 4);
        const pit = distHollow[i] >= inf - 1 ? 0 : Math.max(0, 1 - distHollow[i] / 3);
        const open = Math.min(1, Math.max(0, (distWall[i] - 1) / 3.5));
        let v = spec.fog * (wRim * rim + wHollow * pit + wOpen * open) * grain;
        if (walls[i]) v *= 0.28;
        fog[i] = v;
      }
    }
    if (spec.seep > 0) {
      for (const g of glitches) {
        const i = at2(cols, g.col, g.row);
        if (i < 0 || i >= fog.length) continue;
        fog[i] = Math.min(1, fog[i] + spec.seep * 0.18);
      }
    }
    blurFog(fog, cols, rows);
    blurFog(fog, cols, rows);
    advectFog(fog, cols, rows, windX, windY);
    const motes = [];
    const floors = [];
    let weightSum = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at2(cols, col, row);
        if (!land[i] || walls[i]) continue;
        const w = fog[i] * fog[i];
        floors.push({ col, row, fog: fog[i] });
        weightSum += w;
      }
    }
    const want = spec.motes;
    if (floors.length > 0 && weightSum > 0) {
      let guard = 0;
      while (motes.length < want && guard++ < want * 12) {
        let pick = rng.next() * weightSum;
        let cell = floors[0];
        for (const f of floors) {
          pick -= f.fog * f.fog;
          if (pick <= 0) {
            cell = f;
            break;
          }
        }
        const drift = 0.15 + rng.next() * 0.55;
        motes.push({
          kind: "mote",
          col: cell.col + 0.5 + windX * drift,
          row: cell.row + 0.5 + windY * drift,
          radiusTiles: 0.1 + cell.fog * 0.1,
          strength: 0.36 + rng.next() * 0.38 + cell.fog * 0.24
        });
      }
    }
    if (spec.seep > 0) {
      for (const g of glitches) {
        motes.push({
          kind: "glow",
          col: g.col + 0.5,
          row: g.row + 0.5,
          radiusTiles: 0.9 + spec.seep * 1.2,
          strength: 0.18 + spec.seep * 0.5
        });
      }
    }
    return { phase: phase2, slideSpan, windX, windY, occluders, fog, motes };
  }
  var SeededRandom2 = class {
    constructor(seed2) {
      __publicField3(this, "state");
      this.state = seed2;
    }
    /**
     * Get next random float in [0, 1).
     */
    next() {
      this.state |= 0;
      this.state = this.state + 1831565813 | 0;
      let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    /**
     * Standard normal N(0, 1) via Box-Muller. Consumes two next() samples.
     */
    nextGaussian() {
      const u1 = Math.max(1e-12, this.next());
      const u2 = this.next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
    }
    /**
     * Get random integer in [min, max] (inclusive).
     */
    nextInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }
    /**
     * Get random float in [min, max).
     */
    nextFloat(min, max) {
      return this.next() * (max - min) + min;
    }
    /**
     * Pick a random element from an array.
     */
    pick(array) {
      return array[Math.floor(this.next() * array.length)];
    }
    /**
     * Shuffle an array in place (Fisher-Yates).
     */
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
  };
  function mix322(seed2, label) {
    let h = seed2 >>> 0;
    for (let i = 0; i < label.length; i++) {
      h = Math.imul(h ^ label.charCodeAt(i), 2654435769);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 2146121005);
    h ^= h >>> 15;
    return h >>> 0;
  }
  function forkMapRngs(seed2, recipeId, attempt = 0) {
    return {
      outlineSeed: seed2 >>> 0,
      structureRng: new SeededRandom2(mix322(seed2, `structure:${recipeId}:${attempt}`)),
      coverRng: new SeededRandom2(mix322(seed2, `cover:${recipeId}:${attempt}`)),
      densityRng: new SeededRandom2(mix322(seed2, `density:${recipeId}:${attempt}`)),
      scatterRng: new SeededRandom2(mix322(seed2, `scatter:${recipeId}`)),
      atmosphereRng: new SeededRandom2(mix322(seed2, `atmosphere:${recipeId}`))
    };
  }
  var CONTAMINATION_AGES = ["new", "standard", "ancient"];
  var RUIN_SEVERITIES = ["intact", "broken", "eaten"];
  function rollFragmentAxes(seed2) {
    const rng = new SeededRandom2(mix322(seed2, "fragment-roll"));
    return {
      contaminationAge: CONTAMINATION_AGES[rng.nextInt(0, CONTAMINATION_AGES.length - 1)],
      ruinSeverity: RUIN_SEVERITIES[rng.nextInt(0, RUIN_SEVERITIES.length - 1)]
    };
  }
  var PALETTE_HEX4 = [
    "#080a0c",
    "#0a0b0d",
    "#0d1114",
    "#151a1e",
    "#2a2420",
    "#1e2228",
    "#2a2018",
    "#24221e",
    "#1a1e18",
    "#2c2e33",
    "#3a3d42",
    "#4a4e55",
    "#5a5f66",
    "#8a5c2a",
    "#c4873a",
    "#1a7a9a",
    "#0e4a3f",
    "#1a6b5c",
    "#1aad96",
    "#2ae6c8",
    "#3cffd4",
    "#7fffee",
    "#4adf8a",
    "#b0fff5",
    "#e0a848",
    "#2e2d30",
    "#2a2a2e",
    "#3a3838",
    "#1a1c1f",
    "#2a1f1c",
    "#50463c",
    "#5d483e",
    "#4f4835",
    "#8a8f96",
    "#c8cdd4",
    "#cc3333",
    "#b89040",
    "#2a2d32",
    "#0f1114"
  ];
  var PALETTE4 = PALETTE_HEX4.map(hexToRgb3);
  var TEAL_FAMILY_HEX3 = [
    "#0e4a3f",
    "#1a6b5c",
    "#1aad96",
    "#2ae6c8",
    "#3cffd4",
    "#7fffee",
    "#b0fff5",
    "#4adf8a",
    "#1a7a9a"
  ];
  var TEAL_FAMILY3 = TEAL_FAMILY_HEX3.map(hexToRgb3);
  var TEAL_FAMILY_SET3 = new Set(TEAL_FAMILY_HEX3);
  var TEAL_SUBSET_DEEP_MID_HEX3 = ["#0e4a3f", "#1a6b5c", "#1a7a9a"];
  var TEAL_SUBSET_CORE_HEX3 = ["#1aad96"];
  var TEAL_SUBSET_GLOW_HEX3 = ["#2ae6c8"];
  var TEAL_SUBSET_DEEP_MID3 = TEAL_SUBSET_DEEP_MID_HEX3.map(hexToRgb3);
  var TEAL_SUBSET_CORE3 = TEAL_SUBSET_CORE_HEX3.map(hexToRgb3);
  var TEAL_SUBSET_GLOW3 = TEAL_SUBSET_GLOW_HEX3.map(hexToRgb3);
  var L3_WARM_HEX3 = ["#8a5c2a", "#c4873a"];
  var L4_GLOW_HEX3 = ["#e0a848"];
  var UI_HEX3 = ["#8a8f96", "#c8cdd4", "#2a2d32", "#0f1114"];
  var DANGER_HEX3 = ["#cc3333"];
  var WARNING_HEX3 = ["#b89040"];
  var DEBRIS_HEX3 = ["#50463c", "#5d483e", "#4f4835"];
  var DEBRIS_HEX_SET3 = new Set(DEBRIS_HEX3);
  var L1_EXCLUDED_HEX3 = /* @__PURE__ */ new Set([
    ...TEAL_FAMILY_HEX3,
    ...L3_WARM_HEX3,
    ...L4_GLOW_HEX3,
    ...UI_HEX3,
    ...DANGER_HEX3,
    ...WARNING_HEX3
  ]);
  var L1_MEAN_MAX3 = 55;
  var CHROMA_TIE_EPS2 = 1e-9;
  function hexToRgb3(hex) {
    const h = hex.startsWith("#") ? hex.slice(1) : hex;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function meanRgb3(rgb2) {
    return (rgb2[0] + rgb2[1] + rgb2[2]) / 3;
  }
  function sameRgb2(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }
  function rgbDist22(a, b) {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  }
  function chromaDir2(rgb2) {
    const m = Math.max(1e-6, meanRgb3(rgb2));
    return [rgb2[0] / m, rgb2[1] / m, rgb2[2] / m];
  }
  function chromaDist22(a, b) {
    const da = chromaDir2(a);
    const db = chromaDir2(b);
    return (da[0] - db[0]) ** 2 + (da[1] - db[1]) ** 2 + (da[2] - db[2]) ** 2;
  }
  function temperatureGroup3(r, g, b) {
    if (r - b >= 6) return "WARM";
    if (b - r >= 6) return "COOL";
    if (g >= r + 2 && g >= b + 2) return "OLIVE";
    return "NEUTRAL";
  }
  function buildL1Pools3() {
    const pools = {
      WARM: [],
      COOL: [],
      OLIVE: [],
      NEUTRAL: []
    };
    for (let i = 0; i < PALETTE_HEX4.length; i++) {
      const hex = PALETTE_HEX4[i];
      if (L1_EXCLUDED_HEX3.has(hex)) continue;
      const rgb2 = PALETTE4[i];
      if (meanRgb3(rgb2) > L1_MEAN_MAX3) continue;
      pools[temperatureGroup3(rgb2[0], rgb2[1], rgb2[2])].push(rgb2);
    }
    return pools;
  }
  var L1_POOL_MUTABLE3 = buildL1Pools3();
  var L1_POOL3 = {
    WARM: L1_POOL_MUTABLE3.WARM,
    COOL: L1_POOL_MUTABLE3.COOL,
    OLIVE: L1_POOL_MUTABLE3.OLIVE,
    NEUTRAL: L1_POOL_MUTABLE3.NEUTRAL
  };
  function pickByChroma2(target, candidates) {
    let best = candidates[0];
    let bestChroma = Infinity;
    let bestRgb = Infinity;
    for (const c of candidates) {
      const chroma = chromaDist22(c, target);
      const rgbD = rgbDist22(c, target);
      if (chroma < bestChroma - CHROMA_TIE_EPS2) {
        best = c;
        bestChroma = chroma;
        bestRgb = rgbD;
      } else if (Math.abs(chroma - bestChroma) <= CHROMA_TIE_EPS2 && rgbD < bestRgb) {
        best = c;
        bestRgb = rgbD;
      }
    }
    return best;
  }
  function unused2(candidates, used) {
    return candidates.filter((c) => !used.some((u) => sameRgb2(u, c)));
  }
  function quantizeInGroup2(targetRgb, subset, used = []) {
    const remaining = unused2(subset, used);
    if (remaining.length > 0) {
      return pickByChroma2(targetRgb, remaining);
    }
    console.warn(
      "[palette-quantize] candidate pool empty after used-filter; falling back to NEUTRAL L1 pool"
    );
    const neutralFree = unused2(L1_POOL3.NEUTRAL, used);
    if (neutralFree.length > 0) {
      return pickByChroma2(targetRgb, neutralFree);
    }
    console.warn(
      "[palette-quantize] NEUTRAL L1 pool also exhausted; returning a NEUTRAL cell, not full-palette nearest"
    );
    const neutral = L1_POOL3.NEUTRAL;
    if (neutral.length > 0) {
      return pickByChroma2(targetRgb, neutral);
    }
    return PALETTE4[0];
  }
  var PALETTE_HEX23 = [
    "#080a0c",
    "#0a0b0d",
    "#0d1114",
    "#151a1e",
    "#2a2420",
    "#1e2228",
    "#2a2018",
    "#24221e",
    "#1a1e18",
    "#2c2e33",
    "#3a3d42",
    "#4a4e55",
    "#5a5f66",
    "#8a5c2a",
    "#c4873a",
    "#1a7a9a",
    "#0e4a3f",
    "#1a6b5c",
    "#1aad96",
    "#2ae6c8",
    "#3cffd4",
    "#7fffee",
    "#4adf8a",
    "#b0fff5",
    "#e0a848",
    "#2e2d30",
    "#2a2a2e",
    "#3a3838",
    "#1a1c1f",
    "#2a1f1c",
    "#50463c",
    "#5d483e",
    "#4f4835",
    "#8a8f96",
    "#c8cdd4",
    "#cc3333",
    "#b89040",
    "#2a2d32",
    "#0f1114"
  ];
  var PALETTE23 = PALETTE_HEX23.map((h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16)
  ]);
  var PALETTE_WITHOUT_DEBRIS3 = PALETTE23.filter(
    (_rgb, i) => !DEBRIS_HEX_SET3.has(PALETTE_HEX23[i])
  );
  var PALETTE_HEX_SET3 = new Set(PALETTE_HEX23.map((h) => h.toLowerCase()));
  function clamp2552(n) {
    return n < 0 ? 0 : n > 255 ? 255 : n | 0;
  }
  var CLUSTER_TEAL_RGB3 = [
    ...TEAL_SUBSET_DEEP_MID3,
    ...TEAL_SUBSET_CORE3,
    ...TEAL_SUBSET_GLOW3
  ];
  function clamp013(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }
  function rgbToHsv2(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d > 1e-6) {
      if (max === rn) h = (gn - bn) / d % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h /= 6;
      if (h < 0) h += 1;
    }
    return { h, s: max < 1e-6 ? 0 : d / max, v: max };
  }
  function hsvToRgb2(h, s, v) {
    const hh = (h % 1 + 1) % 1;
    const c = v * s;
    const x = c * (1 - Math.abs(hh * 6 % 2 - 1));
    const m = v - c;
    const i = hh * 6 | 0;
    let r = 0;
    let g = 0;
    let b = 0;
    if (i === 0) {
      r = c;
      g = x;
    } else if (i === 1) {
      r = x;
      g = c;
    } else if (i === 2) {
      g = c;
      b = x;
    } else if (i === 3) {
      g = x;
      b = c;
    } else if (i === 4) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function toRgb2(t) {
    return [clamp2552(t[0]), clamp2552(t[1]), clamp2552(t[2])];
  }
  function clampHueWindow2(h) {
    return h < 0.42 ? 0.42 : h > 0.56 ? 0.56 : h;
  }
  function deriveContamRamp2(def, age, seed2) {
    const floorRgb = [
      clamp2552(def.floorBv * def.floorBiasR),
      clamp2552(def.floorBv * def.floorBiasG),
      clamp2552(def.floorBv * def.floorBiasB)
    ];
    const fh = rgbToHsv2(floorRgb[0], floorRgb[1], floorRgb[2]);
    const wh = rgbToHsv2(def.wallBv * def.wallBiasR, def.wallBv * def.wallBiasG, def.wallBv * def.wallBiasB);
    const mapHue = fh.s < 0.06 && wh.s < 0.06 ? 0.48 : fh.s >= wh.s ? fh.h : wh.h;
    const mapV = fh.v * 0.6 + wh.v * 0.4;
    const mapS = fh.s > wh.s ? fh.s : wh.s;
    const rng = new SeededRandom2(mix322(seed2, "contam-ramp"));
    const ageShift = age === "new" ? -0.07 : age === "ancient" ? 0.08 : 0;
    const hue = clampHueWindow2(0.48 + (mapHue - 0.48) * 0.52 + ageShift + (rng.next() - 0.5) * 0.05);
    const sat = clamp013(0.5 + mapS * 0.38 + (age === "ancient" ? 0.08 : 0) + (rng.next() - 0.5) * 0.05);
    const val = clamp013(Math.max(0.36, mapV + 0.18) + (rng.next() - 0.5) * 0.04);
    const deepRgb = toRgb2(hsvToRgb2(hue, sat * 0.82, val * 0.68));
    const midRgb = toRgb2(hsvToRgb2(hue, sat, val * 0.95));
    const coreRgb = toRgb2(hsvToRgb2(hue, sat * 0.78, clamp013(val * 1.2)));
    const glowRgb = toRgb2(hsvToRgb2(hue, sat * 0.46, clamp013(val * 1.42)));
    const deep = quantizeInGroup2(deepRgb, TEAL_SUBSET_DEEP_MID3, []);
    const mid = quantizeInGroup2(midRgb, TEAL_SUBSET_DEEP_MID3, [deep]);
    const core = quantizeInGroup2(coreRgb, TEAL_SUBSET_CORE3, [deep, mid]);
    const glow = quantizeInGroup2(glowRgb, TEAL_SUBSET_GLOW3, [deep, mid, core]);
    return { deep, mid, core, glow };
  }
  var LEXICON_DEFAULT_FRAGMENT2 = "frag-clinic";
  function fragmentDef2(fragmentTypeId) {
    return RIFT_FRAGMENT_DATA3[fragmentTypeId] ?? RIFT_FRAGMENT_DATA3[LEXICON_DEFAULT_FRAGMENT2];
  }
  function deriveFragmentContamRamp2(fragmentTypeId) {
    const def = fragmentDef2(fragmentTypeId);
    const seed2 = mix322(0, `gym-frag-ramp:${def.id}`);
    return deriveContamRamp2(def, "standard", seed2);
  }
  var OIL_FILM_ID2 = "oil_film";
  function oilFilmProductionVeinVariant2(seed2) {
    return mix322(seed2, "oil_film_variant") % 3 + 3;
  }
  function resolvePaintVeinVariant2(substrate, seed2, explicit) {
    if (explicit !== void 0) return explicit;
    if (substrate === OIL_FILM_ID2) return oilFilmProductionVeinVariant2(seed2);
    return void 0;
  }
  var STAGE3 = {
    infiltrate: 0,
    rewrite: 1,
    overwrite: 2
  };
  var PaintRng2 = class {
    constructor(seed2, label) {
      __publicField3(this, "s");
      this.s = mix322(seed2, label) | 1;
    }
    next() {
      let x = this.s;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.s = x >>> 0;
      return this.s / 4294967296;
    }
    int(lo, hi) {
      return lo + Math.floor(this.next() * (hi - lo + 1));
    }
  };
  function topologyOf2(substrate) {
    if (substrate === "oil_film") return "vein_tree";
    if (substrate === "ash_veil") return "holed_veil";
    return "lobe_mass";
  }
  function makePaintField2(w, h, logicalSpan) {
    return { v: new Float32Array(w * h), w, h, ...logicalSpan === void 0 ? {} : { logicalSpan } };
  }
  function authoredSpan2(field2) {
    return field2.logicalSpan ?? Math.min(field2.w, field2.h);
  }
  function add2(f, x, y, amt) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= f.w || iy >= f.h) return;
    const i = iy * f.w + ix;
    if (amt > f.v[i]) f.v[i] = amt;
  }
  function disc2(f, cx, cy, r, amt) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > r2) continue;
        add2(f, x, y, amt * (1 - Math.sqrt(d2) / (r + 1e-3)) + amt * 0.2);
      }
    }
  }
  function dot2(f, cx, cy, r, amt) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
        add2(f, x, y, amt);
      }
    }
  }
  function dotFlat2(f, cx, cy, ang, radAlong, radPerp, amt) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const pad = Math.max(radAlong, radPerp) + 1;
    const a2 = radAlong * radAlong;
    const p2 = radPerp * radPerp;
    for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
      for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const along = dx * c + dy * s;
        const perp = -dx * s + dy * c;
        if (along * along / a2 + perp * perp / p2 > 1) continue;
        add2(f, x, y, amt);
      }
    }
  }
  function carveDisc2(f, cx, cy, r) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) f.v[y * f.w + x] = 0;
      }
    }
  }
  function radialCrack2(f, cx, cy, ang, r0, r1, halfW) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const pad = r1 + halfW + 1;
    for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
      for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const dx = x - cx;
        const dy = y - cy;
        const along = dx * c + dy * s;
        const perp = -dx * s + dy * c;
        if (along < r0 || along > r1) continue;
        if (Math.abs(perp) > halfW) continue;
        f.v[y * f.w + x] = 0;
      }
    }
  }
  function stroke2(f, x0, y0, x1, y1, r, amt) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      dot2(f, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, amt);
    }
  }
  function senseAngleOf2(sense) {
    if (sense === "sense_scent") return Math.PI * 2 / 3;
    if (sense === "sense_domain") return Math.PI * 4 / 3;
    if (sense === "sense_hear") return Math.PI / 2;
    if (sense === "sense_narrow") return 0.18;
    if (sense === "sense_reverse") return Math.PI;
    if (sense === "sense_cone") return -Math.PI / 2;
    return 0;
  }
  function rhythmKnobsOf2(rhythm) {
    if (rhythm === "rhythm_pulse") {
      return { lobeExtra: 3, lobeAmp: 0.4, branchMul: 1.35, zigzag: 0.78, veilHoles: 2, veilWarp: 0.3 };
    }
    if (rhythm === "rhythm_sleep") {
      return { lobeExtra: -1, lobeAmp: 0.14, branchMul: 0.62, zigzag: 0.16, veilHoles: 0, veilWarp: 0.08 };
    }
    if (rhythm === "rhythm_cluster") {
      return { lobeExtra: 1, lobeAmp: 0.28, branchMul: 1.08, zigzag: 0.42, veilHoles: 1, veilWarp: 0.2 };
    }
    return { lobeExtra: 0, lobeAmp: 0.22, branchMul: 1, zigzag: 0.3, veilHoles: 0, veilWarp: 0.14 };
  }
  function placementsOf2(f, continuity, topo, senseAng, rng) {
    const cx = f.w / 2;
    const cy = f.h / 2;
    const span = authoredSpan2(f);
    const tree = topo === "vein_tree";
    if (continuity === "monolith") {
      return [{ cx, cy, scale: 1 }];
    }
    if (continuity === "shards") {
      const n = 3 + rng.int(0, 1);
      const out2 = [];
      for (let i = 0; i < n; i++) {
        const a = senseAng + i / n * Math.PI * 2 + (rng.next() - 0.5) * 0.35;
        const d = span * (0.3 + rng.next() * 0.06);
        out2.push({
          cx: cx + Math.cos(a) * d,
          cy: cy + Math.sin(a) * d,
          scale: 0.3 + rng.next() * 0.05
        });
      }
      return out2;
    }
    if (continuity === "field") {
      const out2 = [{ cx, cy, scale: 1.18 }];
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = senseAng + i / n * Math.PI * 2 + rng.next() * 0.25;
        const d = span * (0.4 + rng.next() * 0.05);
        out2.push({
          cx: cx + Math.cos(a) * d,
          cy: cy + Math.sin(a) * d,
          scale: 0.4 + rng.next() * 0.05
        });
      }
      return out2;
    }
    const nSat = 3;
    const out = [{ cx, cy, scale: tree ? 0.5 : 0.8 }];
    const satScale = tree ? 0.48 : 0.36;
    for (let i = 0; i < nSat; i++) {
      const a = senseAng + (i + 1) / (nSat + 1) * Math.PI * 2 + (rng.next() - 0.5) * 0.1;
      const d = span * 0.46;
      out.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: satScale
      });
    }
    return out;
  }
  function lobeMass2(f, rng, stage, cx, cy, scale, senseAng, knobs) {
    const R = Math.max(7, authoredSpan2(f) * 0.33 * scale);
    const lobes = Math.max(3, 4 + knobs.lobeExtra);
    const amp = knobs.lobeAmp;
    const phi = senseAng;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        const a = historicalAtan2(dy, dx);
        const bound = R * (1 + amp * Math.cos(lobes * a + phi));
        if (d > bound) continue;
        add2(f, x, y, 1 - d / bound * 0.45);
      }
    }
    if (stage < 1) return;
    const kids = stage === 1 ? 5 : 6;
    for (let i = 0; i < kids; i++) {
      const a = senseAng + i / kids * Math.PI * 2 + rng.next() * 0.18;
      const push = 1.34 + rng.next() * 0.28;
      disc2(f, cx + Math.cos(a) * R * push, cy + Math.sin(a) * R * push, R * (0.3 + rng.next() * 0.1), 0.96);
    }
    const notchA = senseAng + Math.PI * 0.55;
    carveDisc2(f, cx + Math.cos(notchA) * R * 1.02, cy + Math.sin(notchA) * R * 1.02, R * 0.42);
    if (stage < 2) return;
    radialCrack2(f, cx, cy, senseAng + 0.4, R * 0.48, R * 1.4, Math.max(3.2, 3.8 * scale));
    radialCrack2(f, cx, cy, senseAng + 1.85, R * 0.48, R * 1.35, Math.max(2.8, 3.4 * scale));
    radialCrack2(f, cx, cy, senseAng + 3.3, R * 0.55, R * 1.25, Math.max(2.4, 3 * scale));
  }
  function veinTree2(f, rng, stage, cx, cy, scale, senseAng, knobs, variant) {
    if (variant === 0) {
      veinTreeFlat2(f, rng, stage, cx, cy, scale, senseAng, knobs);
      return;
    }
    if (variant === 2) {
      veinTreeConverge2(f, rng, stage, cx, cy, scale, senseAng, knobs);
      return;
    }
    if (variant === 3) {
      oilFilmBeads2(f, rng, stage, cx, cy, scale, senseAng, knobs);
      return;
    }
    if (variant === 4) {
      oilFilmSmear2(f, rng, stage, cx, cy, scale, senseAng, knobs);
      return;
    }
    if (variant === 5) {
      oilFilmRimPool2(f, rng, stage, cx, cy, scale, senseAng, knobs);
      return;
    }
    const thick = Math.max(0.85, 1.2 * scale);
    const loopR = Math.max(1.9, 2.15 * scale);
    const baseLen = authoredSpan2(f) * 0.34 * scale;
    const maxDepth = 2 + stage;
    const zigzag = knobs.zigzag;
    const ends = [];
    const walk = (x, y, ang, len, t, depth) => {
      let px = x;
      let py = y;
      let a = ang;
      const steps = Math.max(5, Math.round(len));
      for (let s = 0; s < steps; s++) {
        a += (rng.next() - 0.5) * zigzag;
        px += Math.cos(a);
        py += Math.sin(a);
        const rad = Math.max(0.65, t * (1 - s / (steps * 1.9)));
        dot2(f, px, py, rad, 0.9);
      }
      ends.push({ x: px, y: py });
      if (depth >= maxDepth) return;
      let kids = depth === 0 ? stage >= 1 ? 4 : 2 : stage >= 1 ? 2 : 1;
      kids = Math.max(1, Math.round(kids * knobs.branchMul));
      if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
      const spread = 0.95 + stage * 0.4;
      for (let k = 0; k < kids; k++) {
        const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.28;
        walk(px, py, fork, len * (0.55 + rng.next() * 0.18), t * 0.74, depth + 1);
      }
    };
    walk(cx, cy, senseAng, baseLen, thick, 0);
    if (stage >= 1) {
      const side = senseAng + (rng.next() < 0.5 ? 1.25 : -1.25);
      walk(
        cx + Math.cos(senseAng) * baseLen * 0.28,
        cy + Math.sin(senseAng) * baseLen * 0.28,
        side,
        baseLen * 0.85,
        thick * 0.82,
        0
      );
    }
    if (stage < 2 || ends.length < 2) return;
    const pairs = [];
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
        if (d < 8 || d > 26) continue;
        pairs.push({ i, j, d });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    const used = /* @__PURE__ */ new Set();
    let loops = 0;
    for (const p of pairs) {
      if (loops >= 2) break;
      if (used.has(p.i) || used.has(p.j)) continue;
      used.add(p.i);
      used.add(p.j);
      stroke2(f, ends[p.i].x, ends[p.i].y, ends[p.j].x, ends[p.j].y, loopR, 0.9);
      loops += 1;
    }
  }
  function veinTreeFlat2(f, rng, stage, cx, cy, scale, senseAng, knobs) {
    const thick = Math.max(0.95, 1.15 * scale);
    const loopR = Math.max(1.1, 1.25 * scale);
    const baseLen = authoredSpan2(f) * 0.36 * scale;
    const maxDepth = 2 + stage;
    const zigzag = knobs.zigzag * 0.18;
    const ends = [];
    const walk = (x, y, ang, len, t, depth) => {
      let px = x;
      let py = y;
      let a = ang;
      const steps = Math.max(6, Math.round(len));
      for (let s = 0; s < steps; s++) {
        a += (rng.next() - 0.5) * zigzag;
        px += Math.cos(a);
        py += Math.sin(a);
        const fade = 1 - s / (steps * 1.55);
        const radAlong = Math.max(1.2, t * 1.9 * fade);
        const radPerp = Math.max(0.28, t * 0.36 * fade);
        dotFlat2(f, px, py, a, radAlong, radPerp, 0.9);
      }
      ends.push({ x: px, y: py });
      if (depth >= maxDepth) return;
      let kids = depth === 0 ? stage >= 1 ? 3 : 2 : stage >= 1 ? 2 : 1;
      kids = Math.max(1, Math.round(kids * knobs.branchMul * 0.85));
      if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
      const spread = 0.7 + stage * 0.28;
      for (let k = 0; k < kids; k++) {
        const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.12;
        walk(px, py, fork, len * (0.58 + rng.next() * 0.12), t * 0.7, depth + 1);
      }
    };
    walk(cx, cy, senseAng, baseLen, thick, 0);
    if (stage >= 1) {
      const side = senseAng + (rng.next() < 0.5 ? 0.85 : -0.85);
      walk(
        cx + Math.cos(senseAng) * baseLen * 0.22,
        cy + Math.sin(senseAng) * baseLen * 0.22,
        side,
        baseLen * 0.72,
        thick * 0.7,
        0
      );
    }
    if (stage < 2 || ends.length < 2) return;
    const pairs = [];
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
        if (d < 10 || d > 22) continue;
        pairs.push({ i, j, d });
      }
    }
    pairs.sort((left, right) => left.d - right.d);
    const used = /* @__PURE__ */ new Set();
    let loops = 0;
    for (const p of pairs) {
      if (loops >= 1) break;
      if (used.has(p.i) || used.has(p.j)) continue;
      used.add(p.i);
      used.add(p.j);
      const ang = historicalAtan2(ends[p.j].y - ends[p.i].y, ends[p.j].x - ends[p.i].x);
      const steps = Math.max(1, Math.ceil(p.d));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        dotFlat2(
          f,
          ends[p.i].x + (ends[p.j].x - ends[p.i].x) * t,
          ends[p.i].y + (ends[p.j].y - ends[p.i].y) * t,
          ang,
          loopR * 1.4,
          loopR * 0.35,
          0.88
        );
      }
      loops += 1;
    }
  }
  function veinTreeConverge2(f, rng, stage, cx, cy, scale, senseAng, knobs) {
    const thick = Math.max(1.05, 1.4 * scale);
    const baseLen = authoredSpan2(f) * 0.38 * scale;
    const maxDepth = 1 + (stage >= 1 ? 1 : 0);
    const zigzag = knobs.zigzag * 0.28;
    const trunk = [];
    const ends = [];
    const walk = (x, y, ang, len, t, depth, recordTrunk) => {
      let px = x;
      let py = y;
      let a = ang;
      const steps = Math.max(6, Math.round(len));
      for (let s = 0; s < steps; s++) {
        a += (rng.next() - 0.5) * zigzag;
        px += Math.cos(a);
        py += Math.sin(a);
        const rad = Math.max(0.75, t * (1 - s / (steps * 2.6)));
        dot2(f, px, py, rad, 0.9);
        if (recordTrunk) trunk.push({ x: px, y: py });
      }
      ends.push({ x: px, y: py });
      if (depth >= maxDepth) return;
      const kids = depth === 0 ? 2 : 1;
      const spread = 0.48 + stage * 0.12;
      for (let k = 0; k < kids; k++) {
        const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.1;
        walk(px, py, fork, len * (0.6 + rng.next() * 0.08), t * 0.58, depth + 1, false);
      }
    };
    walk(cx, cy, senseAng, baseLen, thick, 0, true);
    if (stage >= 2 && knobs.branchMul > 0.9) {
      const side = senseAng + (rng.next() < 0.5 ? 0.55 : -0.55);
      walk(
        cx + Math.cos(senseAng) * baseLen * 0.18,
        cy + Math.sin(senseAng) * baseLen * 0.18,
        side,
        baseLen * 0.55,
        thick * 0.62,
        1,
        false
      );
    }
    for (const end of ends) {
      let bestX = trunk[0]?.x ?? cx;
      let bestY = trunk[0]?.y ?? cy;
      let bestD = Infinity;
      for (const p of trunk) {
        const d = Math.hypot(end.x - p.x, end.y - p.y);
        if (d < bestD) {
          bestD = d;
          bestX = p.x;
          bestY = p.y;
        }
      }
      if (bestD > 5 && bestD < 30) {
        stroke2(f, end.x, end.y, bestX, bestY, Math.max(0.65, thick * 0.42), 0.86);
      }
    }
  }
  function oilFilmBeads2(f, rng, stage, cx, cy, scale, senseAng, knobs) {
    const span = authoredSpan2(f);
    const s = scale * 1.35;
    const merge = stage >= 2 ? 1.32 : 1;
    const beads = [];
    const rMain = Math.max(5.5, span * 0.16 * s) * merge;
    beads.push({ x: cx, y: cy, r: rMain, fine: false });
    const rMed = Math.max(2.4, span * 0.055 * s) * merge;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const a = senseAng + side * (0.65 + rng.next() * 0.45) + (rng.next() - 0.5) * 0.28 * (0.6 + knobs.zigzag);
      const d = rMain * (0.95 + rng.next() * 0.2);
      beads.push({
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d,
        r: rMed,
        fine: false
      });
    }
    const nFine = 4 + stage;
    const dFineMin = rMain * 1.3;
    const dFineMax = span * 0.34 * s;
    for (let i = 0; i < nFine; i++) {
      const a = senseAng + ((i + 0.5) / nFine - 0.5) * 2.1 + (rng.next() - 0.5) * 0.55;
      const spanD = Math.max(0, dFineMax - dFineMin);
      const d = dFineMin + rng.next() * spanD;
      if (d < rMain) continue;
      beads.push({
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d,
        r: Math.max(1.05, span * 0.018 * s) * merge,
        fine: true
      });
    }
    const sum = new Float32Array(f.w * f.h);
    for (const b of beads) {
      const reach = b.r * 2.2;
      const pad = reach + 1;
      for (let y = Math.floor(b.y - pad); y <= b.y + pad; y++) {
        for (let x = Math.floor(b.x - pad); x <= b.x + pad; x++) {
          if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
          const t = 1 - Math.hypot(x - b.x, y - b.y) / reach;
          if (t <= 0) continue;
          sum[y * f.w + x] = sum[y * f.w + x] + t * t;
        }
      }
    }
    for (let i = 0; i < sum.length; i++) {
      const field2 = sum[i];
      const x = i % f.w;
      const y = i / f.w | 0;
      if (field2 >= 0.62) add2(f, x, y, 0.9);
      else if (field2 >= 0.4) add2(f, x, y, 0.66);
      else if (field2 >= 0.26) add2(f, x, y, 0.3);
    }
    for (const b of beads) {
      if (b.fine) {
        dot2(f, b.x, b.y, b.r, 1.38);
      } else if (b.r >= 2.2) {
        disc2(f, b.x, b.y, b.r * 0.35, 1.45);
      }
    }
    if (stage < 2 || beads.length < 3) return;
    const pool = beads[0];
    const far = beads.slice(1).map((b, i) => ({ b, i, d: Math.hypot(b.x - pool.x, b.y - pool.y) })).sort((left, right) => right.d - left.d).slice(0, 2);
    for (const g of far) {
      if (g.d < 6 || g.d > 30) continue;
      stroke2(f, pool.x, pool.y, g.b.x, g.b.y, Math.max(0.9, 1.1 * s), 0.66);
    }
  }
  function oilFilmSmear2(f, rng, stage, cx, cy, scale, senseAng, knobs) {
    const span = authoredSpan2(f);
    const s = scale * 1.6;
    const strokes = 1 + stage;
    for (let i = 0; i < strokes; i++) {
      const side = i > 0;
      const baseA = senseAng + (i - (strokes - 1) / 2) * (0.5 + knobs.zigzag * 0.4) + (rng.next() - 0.5) * 0.2;
      const len = span * (0.5 + rng.next() * 0.08) * s * (side ? 0.72 : 1);
      const curl = (rng.next() - 0.5) * 0.9;
      const wHead = Math.max(4.4, 6.8 * s) * (side ? 0.48 : 1);
      const wTail = Math.max(0.55, 0.8 * s);
      const amtMul = side ? 0.55 : 1;
      let px = cx - Math.cos(baseA) * len * 0.42;
      let py = cy - Math.sin(baseA) * len * 0.42;
      const steps = Math.max(8, Math.round(len));
      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        const a = baseA + curl * t;
        px += Math.cos(a);
        py += Math.sin(a);
        const w = wHead + (wTail - wHead) * t;
        const amt = 1.42 * (1 - t * 0.62) * amtMul;
        disc2(f, px, py, w * 2.6, 0.4);
        disc2(f, px, py, w, amt);
      }
    }
  }
  function oilFilmRimPool2(f, rng, stage, cx, cy, scale, senseAng, knobs) {
    const span = authoredSpan2(f);
    const s = scale * 1.35;
    const blobs = 1 + (stage >= 2 ? 1 : 0);
    const at14 = (x, y) => x < 0 || y < 0 || x >= f.w || y >= f.h ? 0 : f.v[y * f.w + x];
    for (let b = 0; b < blobs; b++) {
      const ba = senseAng + b * 1.9 + (rng.next() - 0.5) * 0.4;
      const bd = b === 0 ? 0 : span * 0.2 * scale;
      const bx = cx + Math.cos(ba) * bd;
      const by = cy + Math.sin(ba) * bd;
      const R = Math.max(8, span * (0.28 + stage * 0.03) * s);
      const h1 = rng.next() * Math.PI * 2;
      const h2 = rng.next() * Math.PI * 2;
      const a1 = 0.08 + knobs.veilWarp * 0.4 + rng.next() * 0.04;
      const a2 = 0.05 + rng.next() * 0.05;
      const pad = R * 1.35 + 1;
      const x0 = Math.floor(bx - pad);
      const x1 = Math.ceil(bx + pad);
      const y0 = Math.floor(by - pad);
      const y1 = Math.ceil(by + pad);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
          const d = Math.hypot(x - bx, y - by);
          const ang = historicalAtan2(y - by, x - bx);
          const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
          if (d > bound) continue;
          if (d > bound - 2.2 && d <= bound - 1) add2(f, x, y, 0.48);
          else add2(f, x, y, 0.34);
        }
      }
      const gathers = 1 + stage;
      for (let g = 0; g < gathers; g++) {
        const ga = rng.next() * Math.PI * 2;
        const gd = rng.next() * R * 0.45;
        disc2(f, bx + Math.cos(ga) * gd, by + Math.sin(ga) * gd, Math.max(1.1, R * 0.12), 0.38);
      }
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
          const d = Math.hypot(x - bx, y - by);
          const ang = historicalAtan2(y - by, x - bx);
          const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
          if (d > bound) continue;
          if (!(at14(x + 1, y) < 0.1 || at14(x - 1, y) < 0.1 || at14(x, y + 1) < 0.1 || at14(x, y - 1) < 0.1)) {
            continue;
          }
          const amt = 1.52 * (0.62 + 0.38 * (0.5 + 0.5 * Math.cos(ang - senseAng)));
          add2(f, x, y, amt);
        }
      }
    }
  }
  function addEllipseRing2(f, cx, cy, rx, ry, irx, iry, warp, k, phi, rot, amt, gapCount = 0, gapFrac = 0) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const pad = Math.max(rx, ry) + 2;
    const x0 = Math.max(0, Math.floor(cx - pad));
    const x1 = Math.min(f.w - 1, Math.ceil(cx + pad));
    const y0 = Math.max(0, Math.floor(cy - pad));
    const y1 = Math.min(f.h - 1, Math.ceil(cy + pad));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const lx = dx * c + dy * s;
        const ly = -dx * s + dy * c;
        const a = historicalAtan2(ly, lx);
        if (gapCount > 0 && gapFrac > 0) {
          const t = ((a - phi) / (Math.PI * 2) + 8) % 1;
          const u = t * gapCount % 1;
          if (u < gapFrac) continue;
        }
        const bound = 1 + warp * Math.cos(k * a + phi);
        const outerD = Math.hypot(lx / rx, ly / ry);
        if (outerD > bound) continue;
        const innerD = Math.hypot(lx / Math.max(0.5, irx), ly / Math.max(0.5, iry));
        if (innerD < bound) continue;
        add2(f, x, y, amt);
      }
    }
  }
  function holedVeil2(f, rng, stage, cx, cy, scale, senseAng, knobs) {
    const span = authoredSpan2(f);
    const grow = stage === 1 ? 1.28 : 1;
    const rx = Math.max(10, span * 0.42 * scale * grow);
    const ry = Math.max(8, span * (stage === 1 ? 0.24 : 0.3) * scale * (stage === 1 ? 1.08 : 1));
    const ringW = stage === 0 ? Math.max(3.8, 4.8 * scale) : Math.max(3.4, 3.9 * scale);
    const irx = Math.max(3, rx - ringW);
    const iry = Math.max(3, ry - ringW);
    const k = 3 + (knobs.lobeExtra > 1 ? 2 : 0);
    const gaps = stage === 1 ? 5 : 0;
    const gapFrac = stage === 1 ? 0.42 : 0;
    addEllipseRing2(f, cx, cy, rx, ry, irx, iry, knobs.veilWarp, k, senseAng, senseAng, 0.9, gaps, gapFrac);
    if (stage >= 2 && scale >= 0.4) {
      const holes = 4 + knobs.veilHoles;
      const midRx = (rx + irx) * 0.5;
      const midRy = (ry + iry) * 0.5;
      for (let i = 0; i < holes; i++) {
        const a = senseAng + i / holes * Math.PI * 2 + rng.next() * 0.08;
        carveDisc2(f, cx + Math.cos(a) * midRx, cy + Math.sin(a) * midRy, ringW * 1.35);
      }
    }
    if (stage < 2) return;
    const nrx = rx * 0.68;
    const nry = ry * 0.68;
    const nestedW = Math.max(3.2, 3.6 * scale);
    addEllipseRing2(
      f,
      cx,
      cy,
      nrx,
      nry,
      Math.max(2, nrx - nestedW),
      Math.max(2, nry - nestedW),
      knobs.veilWarp * 0.55,
      k,
      senseAng + 0.5,
      senseAng,
      0.94
    );
  }
  function drawUnit2(f, topo, rng, stage, p, senseAng, knobs, variant) {
    if (topo === "lobe_mass") lobeMass2(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
    else if (topo === "vein_tree") veinTree2(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs, variant);
    else holedVeil2(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
  }
  function materialColony2(f, p, seed2, stage, ash) {
    const span = authoredSpan2(f) * p.scale;
    const count = ash ? 4 + stage : 5 + stage * 2;
    const rng = new PaintRng2(seed2, ash ? "ash-lamina" : "fungal-shelves");
    for (let k = 0; k < count; k++) {
      const angle = rng.next() * Math.PI * 2;
      const cx = p.cx + Math.cos(angle) * span * 0.16, cy = p.cy + Math.sin(angle) * span * 0.12;
      const rx = span * (ash ? 0.25 : 0.17) * (1 + rng.next() * 0.3), ry = span * (ash ? 0.055 : 0.12) * (1 + rng.next() * 0.3);
      for (let y = Math.floor(cy - ry * 1.5); y <= cy + ry * 1.5; y++) for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const warp = Math.sin(dx * 7 + k) * (0.08 + stage * 0.05) + Math.sin(dy * 5 + k) * 0.05;
        if (dx * dx + dy * dy > 1 + warp) continue;
        if (stage > 0 && Math.sin(dx * 5 + dy * 2 + k) > 0.91 && Math.abs(dx) > 0.4) continue;
        add2(f, x, y, 0.55 + Math.max(0, 1 - dx * dx - dy * dy) * 0.4);
      }
    }
  }
  function fillPaintTopology2(field2, opts) {
    const topo = topologyOf2(opts.substrate);
    const coverage = opts.coverage;
    const continuity = opts.continuity ?? "colony";
    const sense = opts.sense ?? "sense_touch";
    const rhythm = opts.rhythm ?? "rhythm_open";
    const veinTag = opts.veinVariant === void 0 ? "" : `:v${opts.veinVariant}`;
    const rng = new PaintRng2(opts.seed, `paint:${topo}:${coverage}:${continuity}:${sense}:${rhythm}${veinTag}`);
    const senseAng = senseAngleOf2(sense);
    const knobs = rhythmKnobsOf2(rhythm);
    const stage = STAGE3[coverage];
    const placements = placementsOf2(field2, continuity, topo, senseAng, rng);
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const unitRng = new PaintRng2(
        mix322(opts.seed, `u:${i}`),
        `paint-unit:${topo}:${coverage}:${sense}:${rhythm}${veinTag}`
      );
      if (opts.substrate === "fungal_mat" || opts.substrate === "ash_veil")
        materialColony2(field2, p, mix322(opts.seed, `material:${i}`), stage, opts.substrate === "ash_veil");
      else drawUnit2(field2, topo, unitRng, stage, p, senseAng, knobs, opts.veinVariant);
    }
    return topo;
  }
  var PAINT_GROWTH_UNIT_CAP2 = 12;
  var PAINT_INFLATED_AMP2 = 0.18;
  function paintGenomeCanvasOf2(continuity = "colony") {
    const field2 = continuity === "field";
    return { w: field2 ? 144 : 88, h: field2 ? 144 : 88 };
  }
  function collectPaintGenomeFloorTiles2(field2, w, h, originX, originY, tileSize) {
    const left = originX - w * 0.5;
    const top = originY - h * 0.5;
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (field2[y * w + x] < 0.1) continue;
        const col = Math.floor((left + x + 0.5) / tileSize);
        const row = Math.floor((top + y + 0.5) / tileSize);
        const key = `${col},${row}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ col, row });
      }
    }
    return out;
  }
  function reserveBreathingFootprint2(field2, w, h, radius) {
    const horizontal = new Uint8Array(field2.length);
    const result = new Float32Array(field2.length);
    for (let y = 0; y < h; y++) {
      let count = 0;
      for (let x = -radius; x < w; x++) {
        const incoming = x + radius;
        if (incoming < w && field2[y * w + incoming] >= 0.1) count++;
        const outgoing = x - radius - 1;
        if (outgoing >= 0 && field2[y * w + outgoing] >= 0.1) count--;
        if (x >= 0) horizontal[y * w + x] = count > 0 ? 1 : 0;
      }
    }
    for (let x = 0; x < w; x++) {
      let count = 0;
      for (let y = -radius; y < h; y++) {
        const incoming = y + radius;
        if (incoming < h) count += horizontal[incoming * w + x];
        const outgoing = y - radius - 1;
        if (outgoing >= 0) count -= horizontal[outgoing * w + x];
        if (y >= 0 && count > 0) result[y * w + x] = 1;
      }
    }
    return result;
  }
  function topologyCanvas2(req) {
    const continuity = req.continuity ?? "colony";
    const authored = paintGenomeCanvasOf2(continuity);
    const options = {
      substrate: req.substrate,
      coverage: req.coverage,
      seed: req.seed,
      continuity,
      sense: req.sense ?? "sense_touch",
      rhythm: req.rhythm ?? "rhythm_open",
      veinVariant: req.veinVariant
    };
    if (req.geometryVersion === 1) {
      const field2 = makePaintField2(authored.w, authored.h);
      return { field: field2, topology: fillPaintTopology2(field2, options) };
    }
    let padding = Math.max(authored.w, authored.h);
    for (let attempt = 0; attempt < 4; attempt++, padding *= 2) {
      const field2 = makePaintField2(
        authored.w + padding * 2,
        authored.h + padding * 2,
        Math.min(authored.w, authored.h)
      );
      const topology = fillPaintTopology2(field2, options);
      let minX = field2.w, minY = field2.h, maxX = -1, maxY = -1;
      for (let y = 0; y < field2.h; y++) for (let x = 0; x < field2.w; x++) {
        if (field2.v[y * field2.w + x] < 0.1) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      const clearance2 = Math.ceil(Math.hypot(maxX - minX + 1, maxY - minY + 1) * PAINT_INFLATED_AMP2) + 4;
      if (maxX < 0 || Math.min(minX, minY, field2.w - 1 - maxX, field2.h - 1 - maxY) >= clearance2)
        return { field: field2, topology };
    }
    throw new Error(`[paint-genome] complete geometry exceeds bounded canvas: ${req.substrate}/${continuity}/${req.seed}`);
  }
  var CORE_TEALS2 = [
    [26, 173, 150],
    [42, 230, 200],
    [60, 255, 212]
  ];
  function snapBright2(rgb2) {
    let best = CORE_TEALS2[0];
    let bestD = Infinity;
    for (const p of CORE_TEALS2) {
      const d = (p[0] - rgb2[0]) ** 2 + (p[1] - rgb2[1]) ** 2 + (p[2] - rgb2[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
  function fragmentRamp2(fragmentTypeId) {
    const ramp = deriveFragmentContamRamp2(fragmentTypeId);
    return {
      deep: ramp.deep,
      mid: ramp.mid,
      core: snapBright2(ramp.core),
      glow: snapBright2(ramp.glow)
    };
  }
  var STAGE22 = {
    infiltrate: 0,
    rewrite: 1,
    overwrite: 2
  };
  function applyFilmSheen2(field2) {
    const { v, w, h } = field2;
    const next = new Float32Array(v);
    const at14 = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      return v[y * w + x];
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const cur = v[i];
        const n = at14(x, y - 1);
        const s = at14(x, y + 1);
        const e = at14(x + 1, y);
        const west = at14(x - 1, y);
        const emptyN = (n < 0.1 ? 1 : 0) + (s < 0.1 ? 1 : 0) + (e < 0.1 ? 1 : 0) + (west < 0.1 ? 1 : 0);
        if (cur >= 0.1) {
          if (emptyN >= 3) next[i] = 1;
          else if (emptyN >= 1) next[i] = Math.max(cur, 0.86);
        } else if (n >= 0.1 || s >= 0.1 || e >= 0.1 || west >= 0.1) {
          next[i] = 0.26;
        }
      }
    }
    v.set(next);
  }
  function lobeCountOf2(rhythm) {
    if (rhythm === "rhythm_pulse") return 7;
    if (rhythm === "rhythm_sleep") return 3;
    if (rhythm === "rhythm_cluster") return 5;
    return 4;
  }
  function pickGrowthUnit2(x, y, topology, unitCount, ox, oy, innerR, outerR) {
    if (unitCount <= 1) return 0;
    let nearest = 0;
    let nearestD = Infinity;
    for (let i = 0; i < unitCount; i++) {
      const dx = x - ox[i];
      const dy = y - oy[i];
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestD) {
        nearestD = d2;
        nearest = i;
      }
    }
    if (topology !== "holed_veil") return nearest;
    const originX = ox[nearest];
    const originY = oy[nearest];
    const r = Math.hypot(x - originX, y - originY);
    let band = nearest;
    let bestErr = Infinity;
    for (let i = 0; i < unitCount; i++) {
      const dOx = ox[i] - originX;
      const dOy = oy[i] - originY;
      if (dOx * dOx + dOy * dOy > 144) continue;
      const mid = 0.5 * (innerR[i] + outerR[i]);
      const err = Math.abs(r - mid);
      if (err < bestErr) {
        bestErr = err;
        band = i;
      }
    }
    return band;
  }
  function collectBeadPeaks2(field2, w, h) {
    const raw = [];
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        const v = field2[i];
        if (v < 0.42) continue;
        let higher = 0;
        for (let oyOff = -2; oyOff <= 2; oyOff++) {
          for (let oxOff = -2; oxOff <= 2; oxOff++) {
            if (oxOff === 0 && oyOff === 0) continue;
            if (field2[(y + oyOff) * w + (x + oxOff)] > v + 1e-6) higher += 1;
          }
        }
        if (higher > 0) continue;
        raw.push({ x: x + 0.5, y: y + 0.5, v });
      }
    }
    raw.sort((a, b) => b.v - a.v || a.y - b.y || a.x - b.x);
    const kept = [];
    const minD2 = 49;
    const floor = raw[0] !== void 0 ? raw[0].v * 0.72 : 1;
    for (const p of raw) {
      if (p.v < floor) break;
      if (kept.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < minD2)) continue;
      kept.push(p);
      if (kept.length >= PAINT_GROWTH_UNIT_CAP2) break;
    }
    return kept;
  }
  function assignGrowthUnits2(w, h, topology, unitCount, ox, oy, innerR, outerR) {
    const unitIndex = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        unitIndex[y * w + x] = pickGrowthUnit2(
          x + 0.5,
          y + 0.5,
          topology,
          unitCount,
          ox,
          oy,
          innerR,
          outerR
        );
      }
    }
    return unitIndex;
  }
  function buildBeadGrowthGuide2(field2, w, h, topology, sense, rhythm) {
    const senseAngle = senseAngleOf2(sense);
    const lobeCount = lobeCountOf2(rhythm);
    const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const span = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const peaks = collectBeadPeaks2(field2, w, h);
    let unitCount = 0;
    for (const p of peaks) {
      ox[unitCount] = p.x;
      oy[unitCount] = p.y;
      unitCount += 1;
    }
    if (unitCount === 0) {
      ox[0] = w * 0.5;
      oy[0] = h * 0.5;
      span[0] = Math.min(w, h) * 0.2;
      outerR[0] = span[0];
      unitCount = 1;
    }
    const unitIndex = assignGrowthUnits2(w, h, topology, unitCount, ox, oy, innerR, outerR);
    if (peaks.length > 0) {
      const maxR = new Float32Array(unitCount);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (field2[i] < 0.1) continue;
          const u = unitIndex[i];
          const r = Math.hypot(x + 0.5 - ox[u], y + 0.5 - oy[u]);
          if (r > maxR[u]) maxR[u] = r;
        }
      }
      for (let u = 0; u < unitCount; u++) {
        span[u] = Math.max(1.5, maxR[u]);
        outerR[u] = span[u];
      }
    }
    return {
      topology,
      veinVariant: 3,
      senseAngle,
      lobeCount,
      unitCount,
      ox,
      oy,
      span,
      innerR,
      outerR,
      unitIndex
    };
  }
  function buildPaintGrowthGuide2(field2, w, h, topology, sense, rhythm, veinVariant) {
    if (veinVariant === 3) return buildBeadGrowthGuide2(field2, w, h, topology, sense, rhythm);
    const senseAngle = senseAngleOf2(sense);
    const lobeCount = lobeCountOf2(rhythm);
    const cs = Math.cos(senseAngle);
    const sn = Math.sin(senseAngle);
    const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const span = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP2);
    const visited = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);
    const comp = new Int32Array(w * h);
    let unitCount = 0;
    const rimPool = veinVariant === 5;
    for (let start = 0; start < w * h; start++) {
      if (visited[start] || field2[start] < 0.1) continue;
      let top = 0;
      let n = 0;
      stack[top++] = start;
      visited[start] = 1;
      let sumX = 0;
      let sumY = 0;
      let minAlong = Infinity;
      let rootX = 0;
      let rootY = 0;
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      while (top > 0) {
        const p = stack[--top];
        comp[n++] = p;
        const x = p % w;
        const y = p / w | 0;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        const along = x * cs + y * sn;
        if (along < minAlong) {
          minAlong = along;
          rootX = x;
          rootY = y;
        }
        for (let oyOff = -1; oyOff <= 1; oyOff++) {
          for (let oxOff = -1; oxOff <= 1; oxOff++) {
            if (oxOff === 0 && oyOff === 0) continue;
            const nx = x + oxOff;
            const ny = y + oyOff;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = ny * w + nx;
            if (visited[q] || field2[q] < 0.1) continue;
            visited[q] = 1;
            stack[top++] = q;
          }
        }
      }
      if (n < 8 || unitCount >= PAINT_GROWTH_UNIT_CAP2) continue;
      let ux;
      let uy;
      if (topology === "vein_tree" && !rimPool) {
        ux = rootX + 0.5;
        uy = rootY + 0.5;
      } else if (topology === "holed_veil") {
        ux = (minX + maxX) * 0.5 + 0.5;
        uy = (minY + maxY) * 0.5 + 0.5;
      } else {
        ux = sumX / n + 0.5;
        uy = sumY / n + 0.5;
      }
      let minR = Infinity;
      let maxR = 0;
      let maxAlongRel = 0;
      for (let k = 0; k < n; k++) {
        const p = comp[k];
        const px = p % w + 0.5;
        const py = (p / w | 0) + 0.5;
        const r = Math.hypot(px - ux, py - uy);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        const alongRel = (px - ux) * cs + (py - uy) * sn;
        if (alongRel > maxAlongRel) maxAlongRel = alongRel;
      }
      if (maxR < 2) continue;
      ox[unitCount] = ux;
      oy[unitCount] = uy;
      span[unitCount] = topology === "vein_tree" && !rimPool ? Math.max(1, maxAlongRel) : maxR;
      innerR[unitCount] = topology === "holed_veil" ? minR : 0;
      outerR[unitCount] = maxR;
      unitCount += 1;
    }
    if (unitCount === 0) {
      ox[0] = w * 0.5;
      oy[0] = h * 0.5;
      span[0] = Math.min(w, h) * 0.33;
      innerR[0] = span[0] * 0.5;
      outerR[0] = span[0];
      unitCount = 1;
    }
    const unitIndex = assignGrowthUnits2(w, h, topology, unitCount, ox, oy, innerR, outerR);
    return {
      topology,
      veinVariant,
      senseAngle,
      lobeCount,
      unitCount,
      ox,
      oy,
      span,
      innerR,
      outerR,
      unitIndex
    };
  }
  function compactPaintCanvas2(field2, growth, continuity) {
    const clearance2 = Math.ceil(Math.max(...growth.span, ...growth.outerR) * PAINT_INFLATED_AMP2) + 2;
    const minimum = paintGenomeCanvasOf2(continuity);
    let reachX = 0, reachY = 0;
    for (let y = 0; y < field2.h; y++) for (let x = 0; x < field2.w; x++) {
      if (field2.v[y * field2.w + x] < 0.1) continue;
      reachX = Math.max(reachX, Math.abs(x - field2.w / 2), Math.abs(x + 1 - field2.w / 2));
      reachY = Math.max(reachY, Math.abs(y - field2.h / 2), Math.abs(y + 1 - field2.h / 2));
    }
    const w = Math.min(field2.w, Math.max(minimum.w, 2 * Math.ceil(reachX + clearance2 + 2)));
    const h = Math.min(field2.h, Math.max(minimum.h, 2 * Math.ceil(reachY + clearance2 + 2)));
    if (w === field2.w && h === field2.h) return { field: field2, growth, clearance: clearance2 };
    const shiftX = (field2.w - w) / 2, shiftY = (field2.h - h) / 2;
    const cropped = makePaintField2(w, h, field2.logicalSpan);
    const unitIndex = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const begin = (y + shiftY) * field2.w + shiftX;
      cropped.v.set(field2.v.subarray(begin, begin + w), y * w);
      unitIndex.set(growth.unitIndex.subarray(begin, begin + w), y * w);
    }
    const ox = new Float32Array(growth.ox), oy = new Float32Array(growth.oy);
    for (let i = 0; i < growth.unitCount; i++) {
      ox[i] = ox[i] - shiftX;
      oy[i] = oy[i] - shiftY;
    }
    return { field: cropped, growth: { ...growth, ox, oy, unitIndex }, clearance: clearance2 };
  }
  function bakePaintGenome2(req) {
    const sense = req.sense ?? "sense_touch";
    const rhythm = req.rhythm ?? "rhythm_open";
    const geometryVersion = req.geometryVersion ?? 2;
    const { field: field2, topology } = topologyCanvas2(req);
    const { w, h } = field2;
    const stage = STAGE22[req.coverage];
    const ramp = fragmentRamp2(req.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT2);
    const veinTag = req.veinVariant === void 0 ? "" : `:v${req.veinVariant}`;
    const rngLabel = `paint-core:${topology}:${req.coverage}:${sense}:${rhythm}${veinTag}`;
    let s = mix322(req.seed, rngLabel) | 1;
    const next = () => {
      let x = s;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      s = x >>> 0;
      return s / 4294967296;
    };
    const pickInt = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    for (let i = 0; i < field2.v.length; i++) field2.v[i] = field2.v[i] * 0.58;
    if (req.veinVariant === 1 && topology === "vein_tree") applyFilmSheen2(field2);
    const beadGrowth = req.veinVariant === 3 ? buildPaintGrowthGuide2(field2.v, w, h, topology, sense, rhythm, 3) : void 0;
    const lit = [];
    for (let i = 0; i < field2.v.length; i++) if (field2.v[i] > 0.3) lit.push(i);
    const cores = 3 + stage * 4;
    for (let n = 0; n < cores && lit.length > 0; n++) {
      const i = lit[pickInt(0, lit.length - 1)];
      field2.v[i] = 1;
      const x = i % w;
      const y = i / w | 0;
      if (n % 2 === 0 && x + 1 < w) field2.v[i + 1] = 0.82;
      if (n % 3 === 0 && y + 1 < h) field2.v[i + w] = 0.82;
    }
    const rawGrowth = beadGrowth ?? buildPaintGrowthGuide2(field2.v, w, h, topology, sense, rhythm, req.veinVariant);
    const compact = geometryVersion === 1 ? { field: field2, growth: rawGrowth, clearance: 0 } : compactPaintCanvas2(field2, rawGrowth, req.continuity ?? "colony");
    const body = compact.field, growth = compact.growth;
    const out = new Uint8ClampedArray(body.w * body.h * 4);
    paintSurfaceMaterial2(out, body.v, body.w, body.h, req.substrate, req.coverage, req.seed);
    const terrainFootprintField = geometryVersion === 1 ? body.v : reserveBreathingFootprint2(body.v, body.w, body.h, compact.clearance);
    return {
      buf: { data: out, w: body.w, h: body.h },
      field: body.v,
      terrainFootprintField,
      geometryVersion,
      ramp,
      topology,
      growth,
      canvasW: body.w,
      canvasH: body.h
    };
  }
  var CONTAMINATION_ENCOUNTER_DATA2 = {
    "frag-outdoor": {
      "hearingWallWeight": 0,
      "hearingFloorWeight": 4
    },
    "frag-clinic": {
      "hearingWallWeight": 0,
      "hearingFloorWeight": 3
    },
    "frag-metro": {
      "hearingWallWeight": 0,
      "hearingFloorWeight": 3
    },
    "frag-library": {
      "hearingWallWeight": 0,
      "hearingFloorWeight": 3
    },
    "frag-residential": {
      "hearingWallWeight": 0,
      "hearingFloorWeight": 3
    }
  };
  var FAMILY_CAPABILITY_DATA2 = [
    {
      "id": "organic_remnant_jia",
      "substrate": "organic_remnant",
      "portfolio": "jia",
      "motion": [
        "motion_patrol",
        "motion_turn",
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_patrol"
    },
    {
      "id": "lamp_pillar_jia",
      "substrate": "lamp_pillar",
      "portfolio": "jia",
      "motion": [
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "doorframe_yi",
      "substrate": "doorframe",
      "portfolio": "yi",
      "motion": [
        "motion_anchor"
      ],
      "sense": [
        "sense_touch",
        "sense_narrow",
        "sense_hear"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_adjacent_strike"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "wall_rust_yi",
      "substrate": "wall_rust",
      "portfolio": "yi",
      "motion": [
        "motion_wall",
        "motion_turn",
        "motion_anchor"
      ],
      "sense": [
        "sense_touch",
        "sense_narrow",
        "sense_hear"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_adjacent_strike"
      ],
      "infiltrateMotion": "motion_wall"
    },
    {
      "id": "fungal_mat_bing",
      "substrate": "fungal_mat",
      "portfolio": "bing",
      "motion": [
        "motion_cluster"
      ],
      "sense": [
        "sense_touch"
      ],
      "rhythm": [
        "rhythm_cluster"
      ],
      "contact": [
        "contact_step_chaos"
      ],
      "infiltrateMotion": "motion_cluster"
    },
    {
      "id": "oil_film_bing",
      "substrate": "oil_film",
      "portfolio": "bing",
      "motion": [
        "motion_cluster"
      ],
      "sense": [
        "sense_touch"
      ],
      "rhythm": [
        "rhythm_cluster"
      ],
      "contact": [
        "contact_step_chaos"
      ],
      "infiltrateMotion": "motion_cluster"
    },
    {
      "id": "stalk_clump_jia",
      "substrate": "stalk_clump",
      "portfolio": "jia",
      "motion": [
        "motion_patrol",
        "motion_turn",
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_turn"
    },
    {
      "id": "railing_post_jia",
      "substrate": "railing_post",
      "portfolio": "jia",
      "motion": [
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "ash_veil_bing",
      "substrate": "ash_veil",
      "portfolio": "bing",
      "motion": [
        "motion_cluster"
      ],
      "sense": [
        "sense_touch"
      ],
      "rhythm": [
        "rhythm_cluster"
      ],
      "contact": [
        "contact_step_chaos"
      ],
      "infiltrateMotion": "motion_cluster"
    },
    {
      "id": "sound_echo_ding",
      "substrate": "sound_echo",
      "portfolio": "ding",
      "motion": [
        "motion_anchor",
        "motion_wind",
        "motion_trail"
      ],
      "sense": [
        "sense_domain",
        "sense_reverse"
      ],
      "rhythm": [
        "rhythm_open"
      ],
      "contact": [
        "contact_volume_chaos"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "light_scatter_ding",
      "substrate": "light_scatter",
      "portfolio": "ding",
      "motion": [
        "motion_anchor",
        "motion_wind",
        "motion_trail"
      ],
      "sense": [
        "sense_domain",
        "sense_reverse"
      ],
      "rhythm": [
        "rhythm_open"
      ],
      "contact": [
        "contact_volume_chaos"
      ],
      "infiltrateMotion": "motion_trail"
    },
    {
      "id": "space_interval_ding",
      "substrate": "space_interval",
      "portfolio": "ding",
      "motion": [
        "motion_anchor",
        "motion_wind",
        "motion_trail"
      ],
      "sense": [
        "sense_domain",
        "sense_reverse"
      ],
      "rhythm": [
        "rhythm_open"
      ],
      "contact": [
        "contact_volume_chaos"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "street_wreckage_jia",
      "substrate": "street_wreckage",
      "portfolio": "jia",
      "motion": [
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "insect_remnant_jia",
      "substrate": "insect_remnant",
      "portfolio": "jia",
      "motion": [
        "motion_patrol",
        "motion_turn",
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_patrol"
    },
    {
      "id": "mammal_remnant_jia",
      "substrate": "mammal_remnant",
      "portfolio": "jia",
      "motion": [
        "motion_patrol",
        "motion_turn",
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_patrol"
    },
    {
      "id": "worm_remnant_jia",
      "substrate": "worm_remnant",
      "portfolio": "jia",
      "motion": [
        "motion_patrol",
        "motion_turn",
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_turn"
    },
    {
      "id": "human_remnant_jia",
      "substrate": "human_remnant",
      "portfolio": "jia",
      "motion": [
        "motion_patrol",
        "motion_turn",
        "motion_anchor"
      ],
      "sense": [
        "sense_cone",
        "sense_hear",
        "sense_narrow"
      ],
      "rhythm": [
        "rhythm_open",
        "rhythm_sleep",
        "rhythm_pulse"
      ],
      "contact": [
        "contact_melee_three"
      ],
      "infiltrateMotion": "motion_patrol"
    },
    {
      "id": "gas_mass_ding",
      "substrate": "gas_mass",
      "portfolio": "ding",
      "motion": [
        "motion_anchor"
      ],
      "sense": [
        "sense_domain",
        "sense_reverse"
      ],
      "rhythm": [
        "rhythm_open"
      ],
      "contact": [
        "contact_volume_chaos"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "mist_bank_ding",
      "substrate": "mist_bank",
      "portfolio": "ding",
      "motion": [
        "motion_anchor"
      ],
      "sense": [
        "sense_domain",
        "sense_reverse"
      ],
      "rhythm": [
        "rhythm_open"
      ],
      "contact": [
        "contact_volume_chaos"
      ],
      "infiltrateMotion": "motion_anchor"
    },
    {
      "id": "dust_swarm_ding",
      "substrate": "dust_swarm",
      "portfolio": "ding",
      "motion": [
        "motion_anchor"
      ],
      "sense": [
        "sense_domain",
        "sense_reverse"
      ],
      "rhythm": [
        "rhythm_open"
      ],
      "contact": [
        "contact_volume_chaos"
      ],
      "infiltrateMotion": "motion_anchor"
    }
  ];
  var CONTAMINATION_DIALECT_DATA2 = {
    "frag-outdoor": {
      "substrates": [
        [
          "fungal_mat",
          3
        ],
        [
          "ash_veil",
          3
        ],
        [
          "oil_film",
          3
        ],
        [
          "organic_remnant",
          2
        ],
        [
          "stalk_clump",
          2
        ],
        [
          "sound_echo",
          2
        ],
        [
          "insect_remnant",
          1
        ],
        [
          "human_remnant",
          1
        ],
        [
          "mammal_remnant",
          1
        ],
        [
          "worm_remnant",
          1
        ],
        [
          "gas_mass",
          2
        ],
        [
          "mist_bank",
          3
        ],
        [
          "dust_swarm",
          3
        ]
      ],
      "wallHostWeight": 0,
      "volumeHostWeight": 1
    },
    "frag-clinic": {
      "substrates": [
        [
          "organic_remnant",
          1
        ],
        [
          "stalk_clump",
          1
        ],
        [
          "ash_veil",
          1
        ],
        [
          "sound_echo",
          1
        ],
        [
          "insect_remnant",
          1
        ],
        [
          "human_remnant",
          1
        ],
        [
          "mammal_remnant",
          1
        ],
        [
          "worm_remnant",
          1
        ],
        [
          "fungal_mat",
          0
        ],
        [
          "oil_film",
          0
        ],
        [
          "gas_mass",
          3
        ],
        [
          "mist_bank",
          2
        ],
        [
          "dust_swarm",
          1
        ]
      ],
      "wallHostWeight": 0,
      "volumeHostWeight": 1
    },
    "frag-metro": {
      "substrates": [
        [
          "oil_film",
          2
        ],
        [
          "ash_veil",
          2
        ],
        [
          "sound_echo",
          2
        ],
        [
          "insect_remnant",
          1
        ],
        [
          "human_remnant",
          1
        ],
        [
          "mammal_remnant",
          1
        ],
        [
          "worm_remnant",
          1
        ],
        [
          "organic_remnant",
          0
        ],
        [
          "fungal_mat",
          0
        ],
        [
          "stalk_clump",
          0
        ],
        [
          "gas_mass",
          3
        ],
        [
          "mist_bank",
          2
        ],
        [
          "dust_swarm",
          3
        ]
      ],
      "wallHostWeight": 0,
      "volumeHostWeight": 1
    },
    "frag-library": {
      "substrates": [
        [
          "organic_remnant",
          2
        ],
        [
          "sound_echo",
          2
        ],
        [
          "stalk_clump",
          1
        ],
        [
          "insect_remnant",
          1
        ],
        [
          "human_remnant",
          1
        ],
        [
          "mammal_remnant",
          1
        ],
        [
          "worm_remnant",
          1
        ],
        [
          "fungal_mat",
          1
        ],
        [
          "oil_film",
          1
        ],
        [
          "ash_veil",
          1
        ],
        [
          "gas_mass",
          1
        ],
        [
          "mist_bank",
          2
        ],
        [
          "dust_swarm",
          4
        ]
      ],
      "wallHostWeight": 0,
      "volumeHostWeight": 1
    },
    "frag-residential": {
      "substrates": [
        [
          "organic_remnant",
          3
        ],
        [
          "stalk_clump",
          3
        ],
        [
          "oil_film",
          2
        ],
        [
          "ash_veil",
          1
        ],
        [
          "sound_echo",
          1
        ],
        [
          "insect_remnant",
          1
        ],
        [
          "human_remnant",
          1
        ],
        [
          "mammal_remnant",
          1
        ],
        [
          "worm_remnant",
          1
        ],
        [
          "fungal_mat",
          0
        ],
        [
          "gas_mass",
          2
        ],
        [
          "mist_bank",
          2
        ],
        [
          "dust_swarm",
          2
        ]
      ],
      "wallHostWeight": 0,
      "volumeHostWeight": 1
    }
  };
  var SUBSTRATE_DATA2 = {
    organic_remnant: {
      id: "organic_remnant",
      displayToken: "\u6709\u673A\u6B8B\u5F71",
      residualVerb: "\u8D70",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith", "shards"],
      enabledScope: "sortie"
    },
    lamp_pillar: {
      id: "lamp_pillar",
      displayToken: "\u706F\u67F1",
      residualVerb: "\u4EAE",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith"],
      enabledScope: "gym"
    },
    doorframe: {
      id: "doorframe",
      displayToken: "\u95E8\u6846",
      residualVerb: "\u5F00\u5408",
      legalOccupancies: ["wall"],
      sortieLegalOccupancies: ["wall"],
      legalContinuities: ["monolith"],
      enabledScope: "gym"
    },
    wall_rust: {
      id: "wall_rust",
      displayToken: "\u5899\u9508",
      residualVerb: "\u6E17",
      legalOccupancies: ["wall"],
      sortieLegalOccupancies: ["wall"],
      legalContinuities: ["monolith", "colony"],
      enabledScope: "gym"
    },
    fungal_mat: {
      id: "fungal_mat",
      displayToken: "\u83CC\u6BEF",
      residualVerb: "\u94FA",
      legalOccupancies: ["paint"],
      sortieLegalOccupancies: ["paint"],
      legalContinuities: ["colony", "field"],
      enabledScope: "sortie"
    },
    oil_film: {
      id: "oil_film",
      displayToken: "\u6CB9\u819C",
      residualVerb: "\u6CBE",
      legalOccupancies: ["paint"],
      sortieLegalOccupancies: ["paint"],
      legalContinuities: ["monolith", "colony", "field"],
      enabledScope: "sortie"
    },
    stalk_clump: {
      id: "stalk_clump",
      displayToken: "\u6B8B\u830E",
      residualVerb: "\u6447",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith", "shards"],
      enabledScope: "sortie"
    },
    railing_post: {
      id: "railing_post",
      displayToken: "\u680F\u67F1",
      residualVerb: "\u62E6",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith"],
      enabledScope: "gym"
    },
    ash_veil: {
      id: "ash_veil",
      displayToken: "\u7070\u5E55",
      residualVerb: "\u8986",
      legalOccupancies: ["paint"],
      sortieLegalOccupancies: ["paint"],
      legalContinuities: ["monolith", "colony", "field"],
      enabledScope: "sortie"
    },
    sound_echo: {
      id: "sound_echo",
      displayToken: "\u4F59\u54CD",
      residualVerb: "\u54CD",
      legalOccupancies: ["volume"],
      sortieLegalOccupancies: ["volume"],
      legalContinuities: ["monolith", "field"],
      enabledScope: "sortie"
    },
    light_scatter: {
      id: "light_scatter",
      displayToken: "\u6563\u5149",
      residualVerb: "\u6298",
      legalOccupancies: ["volume"],
      sortieLegalOccupancies: ["volume"],
      legalContinuities: ["monolith", "field"],
      enabledScope: "gym"
    },
    space_interval: {
      id: "space_interval",
      displayToken: "\u95F4\u8DDD",
      residualVerb: "\u6324",
      legalOccupancies: ["volume"],
      sortieLegalOccupancies: ["volume"],
      legalContinuities: ["monolith", "field"],
      enabledScope: "gym"
    },
    street_wreckage: {
      id: "street_wreckage",
      displayToken: "\u8857\u5177\u6B8B\u9AB8",
      residualVerb: "\u7ACB",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith"],
      enabledScope: "gym"
    },
    insect_remnant: {
      id: "insect_remnant",
      displayToken: "\u866B",
      residualVerb: "\u722C",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith"],
      enabledScope: "sortie"
    },
    mammal_remnant: {
      id: "mammal_remnant",
      displayToken: "\u54FA\u4E73\u52A8\u7269",
      residualVerb: "\u8D70",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith"],
      enabledScope: "sortie"
    },
    worm_remnant: {
      id: "worm_remnant",
      displayToken: "\u5927\u53F7\u8815\u866B",
      residualVerb: "\u62F1",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith"],
      enabledScope: "sortie"
    },
    human_remnant: {
      id: "human_remnant",
      displayToken: "\u4EBA\u5F62\u6B8B\u4F59",
      residualVerb: "\u8D70",
      legalOccupancies: ["floor"],
      sortieLegalOccupancies: ["floor"],
      legalContinuities: ["monolith"],
      enabledScope: "sortie"
    },
    gas_mass: {
      id: "gas_mass",
      displayToken: "\u6C14\u56E2",
      residualVerb: "\u6D8C",
      legalOccupancies: ["volume"],
      sortieLegalOccupancies: ["volume"],
      legalContinuities: ["monolith", "field"],
      enabledScope: "sortie"
    },
    mist_bank: {
      id: "mist_bank",
      displayToken: "\u96FE\u56E2",
      residualVerb: "\u6F2B",
      legalOccupancies: ["volume"],
      sortieLegalOccupancies: ["volume"],
      legalContinuities: ["monolith", "field"],
      enabledScope: "sortie"
    },
    dust_swarm: {
      id: "dust_swarm",
      displayToken: "\u5C18\u7D6E\u7FA4",
      residualVerb: "\u65CB",
      legalOccupancies: ["volume"],
      sortieLegalOccupancies: ["volume"],
      legalContinuities: ["monolith", "field"],
      enabledScope: "sortie"
    }
  };
  var PORTFOLIO_DATA2 = {
    jia: {
      id: "jia",
      displayToken: "\u5360\u5730",
      continuity: "monolith",
      occupancy: "floor",
      legalContinuities: ["monolith"],
      pinLayer: "waypoints",
      canChase: true,
      blockWalk: true,
      defaultContact: "contact_melee_three",
      detectionPulse: true
    },
    yi: {
      id: "yi",
      displayToken: "\u5360\u5899",
      continuity: "monolith",
      occupancy: "wall",
      legalContinuities: ["monolith"],
      pinLayer: "wall_edge",
      canChase: false,
      blockWalk: false,
      defaultContact: "contact_adjacent_strike",
      detectionPulse: true
    },
    bing: {
      id: "bing",
      displayToken: "\u5360\u6F06",
      continuity: "colony",
      occupancy: "paint",
      legalContinuities: ["colony", "field"],
      pinLayer: "cluster_core",
      canChase: false,
      blockWalk: false,
      defaultContact: "contact_step_chaos",
      detectionPulse: false
    },
    ding: {
      id: "ding",
      displayToken: "\u5360\u7A7A",
      continuity: "field",
      occupancy: "volume",
      legalContinuities: ["field", "monolith"],
      pinLayer: "corridor_aabb",
      canChase: false,
      blockWalk: false,
      defaultContact: "contact_volume_chaos",
      detectionPulse: false
    }
  };
  var LEXEME_DATA2 = {
    motion_patrol: {
      id: "motion_patrol",
      slot: "motion",
      displayToken: "\u5DE1\u8DEF",
      legalPortfolios: ["jia"],
      rewrites: []
    },
    motion_turn: {
      id: "motion_turn",
      slot: "motion",
      displayToken: "\u8F6C\u9762",
      legalPortfolios: ["jia", "yi"],
      rewrites: []
    },
    motion_coalesce: {
      id: "motion_coalesce",
      slot: "motion",
      displayToken: "\u51DD\u805A",
      legalPortfolios: ["jia"],
      rewrites: []
    },
    motion_wall: {
      id: "motion_wall",
      slot: "motion",
      displayToken: "\u6CBF\u58C1",
      legalPortfolios: ["yi"],
      rewrites: []
    },
    motion_anchor: {
      id: "motion_anchor",
      slot: "motion",
      displayToken: "\u56FA\u7740",
      legalPortfolios: ["jia", "yi", "bing", "ding"],
      rewrites: []
    },
    motion_cluster: {
      id: "motion_cluster",
      slot: "motion",
      displayToken: "\u7C07\u6816",
      legalPortfolios: ["bing"],
      rewrites: []
    },
    motion_wind: {
      id: "motion_wind",
      slot: "motion",
      displayToken: "\u968F\u98CE",
      legalPortfolios: ["bing", "ding"],
      rewrites: []
    },
    motion_trail: {
      id: "motion_trail",
      slot: "motion",
      displayToken: "\u62D6\u5C3E",
      legalPortfolios: ["ding"],
      rewrites: []
    },
    sense_cone: {
      id: "sense_cone",
      slot: "sense",
      displayToken: "\u89C6\u9525",
      legalPortfolios: ["jia"],
      rewrites: []
    },
    sense_hear: {
      id: "sense_hear",
      slot: "sense",
      displayToken: "\u542C\u566A",
      legalPortfolios: ["jia", "yi"],
      rewrites: []
    },
    sense_narrow: {
      id: "sense_narrow",
      slot: "sense",
      displayToken: "\u7A84\u89C6",
      legalPortfolios: ["jia", "yi"],
      rewrites: []
    },
    sense_touch: {
      id: "sense_touch",
      slot: "sense",
      displayToken: "\u89E6\u5730",
      legalPortfolios: ["yi", "bing"],
      rewrites: []
    },
    sense_scent: {
      id: "sense_scent",
      slot: "sense",
      displayToken: "\u55C5\u6DF7\u4E71",
      legalPortfolios: ["bing", "ding"],
      rewrites: []
    },
    sense_domain: {
      id: "sense_domain",
      slot: "sense",
      displayToken: "\u9886\u57DF",
      legalPortfolios: ["bing", "ding"],
      rewrites: []
    },
    sense_reverse: {
      id: "sense_reverse",
      slot: "sense",
      displayToken: "\u53CD\u89C6",
      legalPortfolios: ["ding"],
      rewrites: []
    },
    rhythm_open: {
      id: "rhythm_open",
      slot: "rhythm",
      displayToken: "\u5E38\u5F00",
      legalPortfolios: ["jia", "yi", "bing", "ding"],
      rewrites: []
    },
    rhythm_sleep: {
      id: "rhythm_sleep",
      slot: "rhythm",
      displayToken: "\u7761\u7720",
      legalPortfolios: ["jia", "yi"],
      rewrites: []
    },
    rhythm_pulse: {
      id: "rhythm_pulse",
      slot: "rhythm",
      displayToken: "\u8109\u51B2",
      legalPortfolios: ["jia", "yi", "bing", "ding"],
      rewrites: []
    },
    rhythm_cluster: {
      id: "rhythm_cluster",
      slot: "rhythm",
      displayToken: "\u968F\u7C07\u547C\u5438",
      legalPortfolios: ["bing"],
      rewrites: []
    },
    rhythm_sky: {
      id: "rhythm_sky",
      slot: "rhythm",
      displayToken: "\u968F\u5929\u7A7A\u76F8",
      legalPortfolios: ["ding"],
      rewrites: []
    },
    contact_melee_three: {
      id: "contact_melee_three",
      slot: "contact",
      displayToken: "\u4E09\u5200\u8FD1\u6218",
      legalPortfolios: ["jia"],
      rewrites: [{ portfolio: "yi", lexeme: "contact_adjacent_strike" }, { portfolio: "bing", lexeme: "contact_step_chaos" }, { portfolio: "ding", lexeme: "contact_volume_chaos" }]
    },
    contact_adjacent_strike: {
      id: "contact_adjacent_strike",
      slot: "contact",
      displayToken: "\u90BB\u683C\u62BD\u6253",
      legalPortfolios: ["yi"],
      rewrites: []
    },
    contact_step_chaos: {
      id: "contact_step_chaos",
      slot: "contact",
      displayToken: "\u8E29\u8E0F\u6DF7\u4E71",
      legalPortfolios: ["bing"],
      rewrites: []
    },
    contact_volume_chaos: {
      id: "contact_volume_chaos",
      slot: "contact",
      displayToken: "\u573A\u5185\u52A0\u901F\u6DF7\u4E71",
      legalPortfolios: ["ding"],
      rewrites: []
    }
  };
  var UTTERANCE_DATA2 = {
    door_still_closing: {
      id: "door_still_closing",
      internalLabel: "\u95E8\u8FD8\u60F3\u5173",
      onScreenMark: "\u5F00\u5408",
      coverage: "infiltrate",
      substrate: "doorframe",
      portfolio: "yi",
      continuity: "monolith",
      occupancy: "wall",
      motion: "motion_anchor",
      sense: "sense_touch",
      rhythm: "rhythm_pulse",
      contact: "contact_adjacent_strike"
    },
    eye_in_the_seam: {
      id: "eye_in_the_seam",
      internalLabel: "\u7F1D\u91CC\u7684\u773C",
      onScreenMark: "\u7F1D\u4EAE",
      coverage: "overwrite",
      substrate: "wall_rust",
      portfolio: "yi",
      continuity: "monolith",
      occupancy: "wall",
      motion: "motion_anchor",
      sense: "sense_narrow",
      rhythm: "rhythm_open",
      contact: "contact_adjacent_strike"
    },
    cluster_lung: {
      id: "cluster_lung",
      internalLabel: "\u7C07\u7684\u80BA",
      onScreenMark: "\u5728\u6DA8",
      coverage: "rewrite",
      substrate: "fungal_mat",
      portfolio: "bing",
      continuity: "field",
      occupancy: "paint",
      motion: "motion_cluster",
      sense: "sense_touch",
      rhythm: "rhythm_cluster",
      contact: "contact_step_chaos"
    },
    corridor_watching: {
      id: "corridor_watching",
      internalLabel: "\u8D70\u5ECA\u5728\u770B\u4F60",
      onScreenMark: "\u56DE\u5934",
      coverage: "overwrite",
      substrate: "space_interval",
      portfolio: "ding",
      continuity: "field",
      occupancy: "volume",
      motion: "motion_anchor",
      sense: "sense_reverse",
      rhythm: "rhythm_sky",
      contact: "contact_volume_chaos"
    }
  };
  var STOP_LOSS_DATA = {
    monolith_infiltrate: {
      id: "monolith_infiltrate",
      continuity: "monolith",
      coverage: "infiltrate",
      family: "core_strike",
      corePolicy: "exposed",
      legalOccupancies: ["floor", "wall", "paint", "volume"]
    },
    monolith_rewrite: {
      id: "monolith_rewrite",
      continuity: "monolith",
      coverage: "rewrite",
      family: "core_strike",
      corePolicy: "standard",
      legalOccupancies: ["floor", "wall", "paint", "volume"]
    },
    monolith_overwrite: {
      id: "monolith_overwrite",
      continuity: "monolith",
      coverage: "overwrite",
      family: "core_strike",
      corePolicy: "obscured",
      legalOccupancies: ["floor", "wall", "paint", "volume"]
    },
    colony_infiltrate: {
      id: "colony_infiltrate",
      continuity: "colony",
      coverage: "infiltrate",
      family: "scatter_rejoin",
      corePolicy: "exposed",
      legalOccupancies: ["paint", "wall"]
    },
    colony_rewrite: {
      id: "colony_rewrite",
      continuity: "colony",
      coverage: "rewrite",
      family: "scatter_rejoin",
      corePolicy: "standard",
      legalOccupancies: ["paint", "wall"]
    },
    colony_overwrite: {
      id: "colony_overwrite",
      continuity: "colony",
      coverage: "overwrite",
      family: "scatter_rejoin",
      corePolicy: "obscured",
      legalOccupancies: ["paint", "wall"]
    },
    field_infiltrate: {
      id: "field_infiltrate",
      continuity: "field",
      coverage: "infiltrate",
      family: "unkillable",
      corePolicy: "none",
      legalOccupancies: ["paint", "volume"]
    },
    field_rewrite: {
      id: "field_rewrite",
      continuity: "field",
      coverage: "rewrite",
      family: "unkillable",
      corePolicy: "none",
      legalOccupancies: ["paint", "volume"]
    },
    field_overwrite: {
      id: "field_overwrite",
      continuity: "field",
      coverage: "overwrite",
      family: "unkillable",
      corePolicy: "none",
      legalOccupancies: ["paint", "volume"]
    }
  };
  var PAINT_HOST_COUNT_RANGE = {
    new: [3, 5],
    standard: [6, 8],
    ancient: [9, 12]
  };
  function rollPaintHostCount(layoutSeed, age) {
    const range2 = PAINT_HOST_COUNT_RANGE[age];
    const lo = range2[0];
    const hi = range2[1];
    const rng = new SeededRandom2(mix322(layoutSeed, "paint-count"));
    return lo + Math.floor(rng.next() * (hi - lo + 1));
  }
  var RETRY3 = GAME_CONSTANTS3.CONTAMINATION.DRAW_RETRY_LIMIT;
  var SLOTS = ["motion", "sense", "rhythm", "contact"];
  var COVERAGES = ["infiltrate", "rewrite", "overwrite"];
  var INFILTRATOR_FORM2 = {
    substrate: "organic_remnant",
    coverage: "infiltrate",
    continuity: "monolith",
    occupancy: "floor",
    portfolio: "jia",
    lexemes: {
      motion: "motion_patrol",
      sense: "sense_cone",
      rhythm: "rhythm_open",
      contact: "contact_melee_three"
    }
  };
  var REWRITER_FORM2 = {
    substrate: "organic_remnant",
    coverage: "rewrite",
    continuity: "monolith",
    occupancy: "floor",
    portfolio: "jia",
    lexemes: {
      motion: "motion_patrol",
      sense: "sense_hear",
      rhythm: "rhythm_open",
      contact: "contact_melee_three"
    }
  };
  function occupanciesForScope(sub, scope) {
    return scope === "sortie" ? sub.sortieLegalOccupancies : sub.legalOccupancies;
  }
  function dialectOf(fragmentTypeId) {
    return CONTAMINATION_DIALECT_DATA2[fragmentTypeId] ?? { substrates: [], wallHostWeight: 0, volumeHostWeight: 0 };
  }
  function pickWeighted(rng, items) {
    let total = 0;
    for (const [, w] of items) total += w;
    if (total <= 0) return null;
    let roll = rng.next() * total;
    for (const [id, w] of items) {
      roll -= w;
      if (roll <= 0) return id;
    }
    return items[items.length - 1]?.[0] ?? null;
  }
  function lexemesFor(slot, portfolio) {
    return Object.values(LEXEME_DATA2).filter((row) => row.slot === slot && row.legalPortfolios.includes(portfolio)).map((row) => row.id);
  }
  function familyCapabilityFor(substrate, portfolio) {
    return FAMILY_CAPABILITY_DATA2.find((row) => row.substrate === substrate && row.portfolio === portfolio);
  }
  function motionChoicesFor(substrate, portfolio, coverage) {
    const family = familyCapabilityFor(substrate, portfolio);
    if (!family) return [];
    return coverage === "infiltrate" ? [family.infiltrateMotion] : family.motion;
  }
  function floorMotionFor2(form) {
    const choices = motionChoicesFor(form.substrate, form.portfolio, form.coverage);
    const motion = choices.includes(form.lexemes.motion) ? form.lexemes.motion : choices[0];
    return motion === "motion_patrol" || motion === "motion_turn" ? motion : "motion_anchor";
  }
  function supportsRuntimeForm(form) {
    const family = familyCapabilityFor(form.substrate, form.portfolio);
    const port = PORTFOLIO_DATA2[form.portfolio];
    const sub = SUBSTRATE_DATA2[form.substrate];
    return !!family && sub?.enabledScope === "sortie" && form.occupancy === port.occupancy && sub.sortieLegalOccupancies.includes(form.occupancy) && sub.legalContinuities.includes(form.continuity) && port.legalContinuities.includes(form.continuity) && SLOTS.every((slot) => family[slot].includes(form.lexemes[slot])) && motionChoicesFor(form.substrate, form.portfolio, form.coverage).includes(form.lexemes.motion);
  }
  function inScope(sub, scope) {
    return scope === "gym" || sub.enabledScope === "sortie";
  }
  function legalSubstrates(portfolio, fragmentTypeId, scope) {
    const occupancy = PORTFOLIO_DATA2[portfolio].occupancy;
    const dialect = dialectOf(fragmentTypeId);
    const out = [];
    for (const [id, w] of dialect.substrates) {
      const sub = SUBSTRATE_DATA2[id];
      if (!sub || w <= 0) continue;
      if (!inScope(sub, scope)) continue;
      if (!occupanciesForScope(sub, scope).includes(occupancy)) continue;
      const contOk = sub.legalContinuities.some(
        (c) => PORTFOLIO_DATA2[portfolio].legalContinuities.includes(c)
      );
      if (!contOk) continue;
      out.push([id, w]);
    }
    return out;
  }
  function pickContinuity(rng, portfolio, substrate) {
    const port = PORTFOLIO_DATA2[portfolio];
    const sub = SUBSTRATE_DATA2[substrate];
    if (!sub) return null;
    const inter = port.legalContinuities.filter((c) => sub.legalContinuities.includes(c));
    if (inter.length === 0) return null;
    if (inter.includes(port.continuity) && rng.next() < 0.7) return port.continuity;
    return rng.pick(inter);
  }
  function formFromUtterance(id) {
    const u = UTTERANCE_DATA2[id];
    if (!u) return null;
    return {
      substrate: u.substrate,
      coverage: u.coverage,
      continuity: u.continuity,
      occupancy: u.occupancy,
      portfolio: u.portfolio,
      lexemes: { motion: u.motion, sense: u.sense, rhythm: u.rhythm, contact: u.contact },
      utteranceId: u.id
    };
  }
  function utteranceAllowed(form, scope) {
    if (scope === "gym") return true;
    const sub = SUBSTRATE_DATA2[form.substrate];
    return sub?.enabledScope === "sortie" && supportsRuntimeForm(form);
  }
  function slotChoices(slot, substrate, coverage, opts) {
    const family = familyCapabilityFor(substrate, opts.portfolio);
    let choices = (opts.scope ?? "sortie") === "sortie" ? slot === "motion" ? motionChoicesFor(substrate, opts.portfolio, coverage) : family?.[slot] ?? [] : lexemesFor(slot, opts.portfolio);
    if (slot === "motion") {
      if (opts.scope === "gym" && coverage === "infiltrate" && family) choices = [family.infiltrateMotion];
      if (opts.motion) choices = choices.filter((id) => id === opts.motion);
      if (opts.forbidMotion) choices = choices.filter((id) => !opts.forbidMotion.includes(id));
    }
    if (slot === "rhythm") {
      if (opts.rhythm) choices = choices.filter((id) => id === opts.rhythm);
      if (opts.forbidRhythm) choices = choices.filter((id) => !opts.forbidRhythm.includes(id));
    }
    if (slot === "sense") {
      if (opts.sense) choices = choices.filter((id) => id === opts.sense);
      if (opts.forbidSense) choices = choices.filter((id) => !opts.forbidSense.includes(id));
    }
    return choices;
  }
  function tryDrawOne(rng, opts) {
    const port = PORTFOLIO_DATA2[opts.portfolio];
    const scope = opts.scope ?? "sortie";
    const gymSub = scope === "gym" && opts.substrate ? SUBSTRATE_DATA2[opts.substrate] : void 0;
    const legal = gymSub ? occupanciesForScope(gymSub, scope).includes(port.occupancy) && gymSub.legalContinuities.some((c) => port.legalContinuities.includes(c)) ? [[gymSub.id, 1]] : [] : legalSubstrates(opts.portfolio, opts.fragmentTypeId, scope).filter(([id]) => !opts.substrate || id === opts.substrate);
    const candidates = legal.filter(([id]) => !opts.forbidSubstrate?.includes(id));
    const viableCoverages = (opts.coverage ? [opts.coverage] : COVERAGES).filter((coverage2) => candidates.some(([id]) => SLOTS.every((slot) => slotChoices(slot, id, coverage2, opts).length > 0)));
    if (viableCoverages.length === 0) return null;
    if (opts.preferUtterance) {
      const matching = Object.values(UTTERANCE_DATA2).filter((u) => {
        if (u.portfolio !== opts.portfolio || !viableCoverages.includes(u.coverage) || !candidates.some(([id]) => id === u.substrate)) return false;
        const form = formFromUtterance(u.id);
        return !!form && utteranceAllowed(form, scope) && SLOTS.every((slot) => slotChoices(slot, u.substrate, u.coverage, opts).includes(form.lexemes[slot]));
      });
      if (matching.length > 0 && rng.next() < 0.35) return formFromUtterance(rng.pick(matching).id);
    }
    const coverage = opts.coverage ?? pickWeighted(rng, viableCoverages.map((id) => [id, id === "infiltrate" ? 5 : id === "rewrite" ? 3 : 2]));
    const pool = candidates.filter(([id]) => SLOTS.every((slot) => slotChoices(slot, id, coverage, opts).length > 0));
    const substrate = pickWeighted(rng, pool);
    if (!substrate) return null;
    const continuity = pickContinuity(rng, opts.portfolio, substrate);
    if (!continuity) return null;
    const lexemes = { motion: "", sense: "", rhythm: "", contact: "" };
    for (const slot of SLOTS) lexemes[slot] = rng.pick([...slotChoices(slot, substrate, coverage, opts)]);
    return { substrate, coverage, continuity, occupancy: port.occupancy, portfolio: opts.portfolio, lexemes };
  }
  function drawOne(rng, opts) {
    for (let i = 0; i < RETRY3; i++) {
      const form = tryDrawOne(rng, opts);
      if (form) return form;
    }
    return null;
  }
  function pickYiOrDing(rng, pins) {
    const dialect = dialectOf(pins.fragmentTypeId);
    const yiOk = pins.hasWallEdges && dialect.wallHostWeight > 0 && legalSubstrates("yi", pins.fragmentTypeId, "sortie").length > 0;
    const dingOk = pins.hasCorridors && dialect.volumeHostWeight > 0 && legalSubstrates("ding", pins.fragmentTypeId, "sortie").length > 0;
    if (!yiOk && !dingOk) return null;
    if (yiOk && !dingOk) return "yi";
    if (!yiOk && dingOk) return "ding";
    const total = dialect.wallHostWeight + dialect.volumeHostWeight;
    if (total <= 0) return null;
    const roll = rng.next() * total;
    return dialect.volumeHostWeight > dialect.wallHostWeight ? roll < dialect.volumeHostWeight ? "ding" : "yi" : roll < dialect.wallHostWeight ? "yi" : "ding";
  }
  function drawSortie(rng, pins) {
    const warnings = [];
    const forms = [];
    const jiaCount = pins.hearingAxisTaken ? 0 : rng.nextInt(2, 3);
    const alt = pickYiOrDing(rng, pins);
    if (!alt) warnings.push("no legal production environment host with a matching pin; skipped yi/ding");
    let hearingOnAlt = false;
    if (alt === "yi") {
      const encounter = CONTAMINATION_ENCOUNTER_DATA2[pins.fragmentTypeId];
      const preferWallHear = !pins.hearingAxisTaken && !!encounter && rng.next() * (encounter.hearingWallWeight + encounter.hearingFloorWeight) < encounter.hearingWallWeight;
      const withHear = preferWallHear ? drawOne(rng, {
        portfolio: "yi",
        fragmentTypeId: pins.fragmentTypeId,
        forbidSubstrate: pins.hasWallOpenings === false ? ["doorframe"] : void 0,
        preferUtterance: true,
        sense: "sense_hear"
      }) : null;
      if (withHear) {
        forms.push(withHear);
        hearingOnAlt = true;
      } else {
        const any = drawOne(rng, {
          portfolio: "yi",
          fragmentTypeId: pins.fragmentTypeId,
          forbidSubstrate: pins.hasWallOpenings === false ? ["doorframe"] : void 0,
          forbidSense: ["sense_hear"],
          preferUtterance: true
        });
        if (any) forms.push(any);
        else warnings.push("yi draw failed after retries");
      }
    } else if (alt === "ding") {
      const ding = drawOne(rng, {
        portfolio: "ding",
        fragmentTypeId: pins.fragmentTypeId,
        preferUtterance: true
      });
      if (ding) forms.push(ding);
      else warnings.push("ding draw failed after retries");
    }
    for (let i = 0; i < jiaCount; i++) {
      const extractGate = i === 0;
      const needHear = !hearingOnAlt && i === 1;
      const forbidHear = hearingOnAlt || extractGate;
      const form = extractGate ? drawOne(rng, {
        portfolio: "jia",
        fragmentTypeId: pins.fragmentTypeId,
        coverage: "infiltrate",
        rhythm: "rhythm_open",
        motion: "motion_patrol",
        sense: "sense_cone"
      }) : drawOne(rng, {
        portfolio: "jia",
        fragmentTypeId: pins.fragmentTypeId,
        motion: "motion_patrol",
        sense: needHear ? "sense_hear" : void 0,
        forbidSense: forbidHear ? ["sense_hear"] : needHear ? void 0 : ["sense_hear"]
      });
      if (!form) {
        warnings.push(`jia[${i}] draw failed after retries`);
        continue;
      }
      if (extractGate) forms.unshift(form);
      else forms.push(form);
    }
    if (pins.paintCount > 0) {
      const bing = drawOne(rng, {
        portfolio: "bing",
        fragmentTypeId: pins.fragmentTypeId,
        preferUtterance: true
      });
      if (bing) {
        for (let i = 0; i < pins.paintCount; i++) forms.push(bing);
      } else {
        warnings.push("bing draw failed after retries");
      }
    }
    const hearCount = forms.filter((f) => f.lexemes.sense === "sense_hear").length;
    if (pins.hearingAxisTaken) {
      if (hearCount !== 0) warnings.push(`hearing axis already taken but draw produced ${hearCount}`);
    } else if (hearCount !== 1) {
      const jiaIdx = forms.findIndex((f) => f.portfolio === "jia" && f.lexemes.sense !== "sense_cone");
      if (hearCount === 0 && jiaIdx >= 0) {
        const patched = drawOne(rng, {
          portfolio: "jia",
          fragmentTypeId: pins.fragmentTypeId,
          sense: "sense_hear",
          motion: "motion_patrol",
          coverage: "rewrite"
        });
        if (patched) forms[jiaIdx] = patched;
      }
      const again = forms.filter((f) => f.lexemes.sense === "sense_hear").length;
      if (again !== 1) warnings.push(`hearing axis count ${again} (want 1)`);
    }
    return { forms, warnings };
  }
  var DIRS42 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  function at22(cols, col, row) {
    return row * cols + col;
  }
  function inBounds2(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function landOrOobNeighbors8(land, cols, rows, col, row) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds2(cols, rows, nx, ny) || land[at22(cols, nx, ny)]) n++;
      }
    }
    return n;
  }
  function largestComponent(land, cols, rows) {
    const seen = new Uint8Array(cols * rows);
    let best = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at22(cols, col, row);
        if (!land[i] || seen[i]) continue;
        const stack = [i];
        seen[i] = 1;
        const cells = [];
        while (stack.length > 0) {
          const cur = stack.pop();
          cells.push(cur);
          const c = cur % cols;
          const r = cur / cols | 0;
          for (const [dx, dy] of DIRS42) {
            const nx = c + dx;
            const ny = r + dy;
            if (!inBounds2(cols, rows, nx, ny)) continue;
            const ni = at22(cols, nx, ny);
            if (seen[ni] || !land[ni]) continue;
            seen[ni] = 1;
            stack.push(ni);
          }
        }
        if (cells.length > best.length) best = cells;
      }
    }
    const out = new Uint8Array(cols * rows);
    for (const i of best) out[i] = 1;
    return out;
  }
  function measureOutline2(land, cols, rows) {
    const ring = GAME_CONSTANTS3.GENERATION.BORDER_RING;
    let landCount2 = 0;
    let minCol = cols;
    let minRow = rows;
    let maxCol = -1;
    let maxRow = -1;
    let ringLand = 0;
    let roughCells = 0;
    const edgeHas = [false, false, false, false];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!land[at22(cols, col, row)]) continue;
        landCount2++;
        if (col < minCol) minCol = col;
        if (row < minRow) minRow = row;
        if (col > maxCol) maxCol = col;
        if (row > maxRow) maxRow = row;
        if (col < ring || row < ring || col >= cols - ring || row >= rows - ring) {
          ringLand++;
        }
        if (col === 0) edgeHas[0] = true;
        if (col === cols - 1) edgeHas[1] = true;
        if (row === 0) edgeHas[2] = true;
        if (row === rows - 1) edgeHas[3] = true;
        let touchesVoid = false;
        for (const [dx, dy] of DIRS42) {
          const nx = col + dx;
          const ny = row + dy;
          if (!inBounds2(cols, rows, nx, ny) || !land[at22(cols, nx, ny)]) {
            touchesVoid = true;
            break;
          }
        }
        if (touchesVoid) roughCells++;
      }
    }
    const width = landCount2 === 0 ? 0 : maxCol - minCol + 1;
    const height = landCount2 === 0 ? 0 : maxRow - minRow + 1;
    const bboxArea = Math.max(1, width * height);
    const innerW = Math.max(0, cols - ring * 2);
    const innerH = Math.max(0, rows - ring * 2);
    const ringCells = cols * rows - innerW * innerH;
    return {
      landCount: landCount2,
      fillRatio: landCount2 / (cols * rows),
      bbox: {
        minCol: landCount2 === 0 ? 0 : minCol,
        minRow: landCount2 === 0 ? 0 : minRow,
        maxCol: landCount2 === 0 ? 0 : maxCol,
        maxRow: landCount2 === 0 ? 0 : maxRow,
        width,
        height
      },
      bboxFill: landCount2 / bboxArea,
      borderOccupancy: ringCells === 0 ? 0 : ringLand / ringCells,
      edgesTouching: edgeHas.filter(Boolean).length,
      roughness: landCount2 === 0 ? 0 : roughCells / landCount2
    };
  }
  function evaluateOutline(land, cols, rows) {
    const g = GAME_CONSTANTS3.GENERATION;
    const metrics = measureOutline2(land, cols, rows);
    const reasons = [];
    if (metrics.landCount === 0) reasons.push("empty");
    if (metrics.fillRatio < g.LAND_FILL_MIN) reasons.push("too-small");
    if (metrics.fillRatio > g.LAND_FILL_MAX) reasons.push("fills-buffer");
    if (metrics.borderOccupancy > g.BORDER_OCCUPANCY_MAX) reasons.push("hugs-frame");
    if (metrics.bboxFill > g.BBOX_FILL_MAX) reasons.push("filled-rectangle");
    if (metrics.roughness < g.ROUGHNESS_MIN) reasons.push("smooth-box");
    if (metrics.edgesTouching > g.MAX_EDGES_TOUCHING) reasons.push("touches-all-sides");
    const slack = cols - metrics.bbox.width + (rows - metrics.bbox.height);
    if (slack < g.MIN_BBOX_SLACK) reasons.push("flush-with-buffer");
    const nibbled = metrics.bbox.width >= cols - 4 && metrics.bbox.height >= rows - 4 && metrics.bboxFill > 0.72;
    if (nibbled) reasons.push("nibbled-rectangle");
    if (reasons.length > 0) {
      return { ok: false, reasons, metrics };
    }
    return { ok: true, reasons: [], metrics };
  }
  function growErode(rng, cols, rows) {
    const land = new Uint8Array(cols * rows);
    const walkers = 4 + rng.nextInt(0, 2);
    for (let s = 0; s < walkers; s++) {
      let x = Math.floor(cols * (0.24 + rng.next() * 0.52));
      let y = Math.floor(rows * (0.24 + rng.next() * 0.52));
      const steps = 130 + rng.nextInt(0, 110);
      for (let i = 0; i < steps; i++) {
        land[at22(cols, x, y)] = 1;
        const horizontal = rng.next() < 0.6;
        if (horizontal) x += rng.next() < 0.5 ? 1 : -1;
        else y += rng.next() < 0.5 ? 1 : -1;
        x = Math.max(3, Math.min(cols - 4, x));
        y = Math.max(3, Math.min(rows - 4, y));
      }
    }
    const growIters = 8 + rng.nextInt(0, 3);
    for (let iter = 0; iter < growIters; iter++) {
      const next = new Uint8Array(land);
      for (let y = 2; y < rows - 2; y++) {
        for (let x = 2; x < cols - 2; x++) {
          const n = landOrOobNeighbors8(land, cols, rows, x, y);
          if (!land[at22(cols, x, y)] && n >= 3 && rng.next() < 0.7) {
            next[at22(cols, x, y)] = 1;
          }
        }
      }
      land.set(next);
    }
    const erodeIters = 4 + rng.nextInt(0, 2);
    for (let iter = 0; iter < erodeIters; iter++) {
      const next = new Uint8Array(land);
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const n = landOrOobNeighbors8(land, cols, rows, x, y);
          if (land[at22(cols, x, y)] && n <= 2) next[at22(cols, x, y)] = 0;
        }
      }
      land.set(next);
    }
    return largestComponent(land, cols, rows);
  }
  function toTileMap(land, cols, rows) {
    const tiles = [];
    for (let row = 0; row < rows; row++) {
      const line = [];
      for (let col = 0; col < cols; col++) {
        line.push(
          land[at22(cols, col, row)] ? 1 : 3
          /* VOID */
        );
      }
      tiles.push(line);
    }
    return {
      cols,
      rows,
      tileSize: GAME_CONSTANTS3.TILE_SIZE,
      tiles
    };
  }
  function tryGenerateOutlineOnce(attemptSeed, cols = GAME_CONSTANTS3.GENERATION.BUFFER_COLS, rows = GAME_CONSTANTS3.GENERATION.BUFFER_ROWS) {
    const rng = new SeededRandom2(attemptSeed);
    const land = growErode(rng, cols, rows);
    const verdict = evaluateOutline(land, cols, rows);
    if (!verdict.ok) return verdict;
    return {
      seed: attemptSeed,
      attempt: 0,
      cols,
      rows,
      tileSize: GAME_CONSTANTS3.TILE_SIZE,
      land,
      tileMap: toTileMap(land, cols, rows),
      metrics: verdict.metrics
    };
  }
  function generateOutline(seed2) {
    const cols = GAME_CONSTANTS3.GENERATION.BUFFER_COLS;
    const rows = GAME_CONSTANTS3.GENERATION.BUFFER_ROWS;
    const max = GAME_CONSTANTS3.GENERATION.MAX_OUTLINE_ATTEMPTS;
    let last = null;
    for (let attempt = 0; attempt < max; attempt++) {
      const attemptSeed = seed2 + attempt * 2654435769 >>> 0;
      const result = tryGenerateOutlineOnce(attemptSeed, cols, rows);
      if ("tileMap" in result) {
        return { ...result, seed: seed2, attempt };
      }
      last = result;
    }
    const why = last?.reasons.join(", ") ?? "unknown";
    throw new Error(
      `generateOutline: seed ${seed2} produced no usable land after ${max} attempts (${why})`
    );
  }
  function isMaterialVolume(substrate) {
    return substrate === "gas_mass" || substrate === "mist_bank" || substrate === "dust_swarm";
  }
  function findTerrainSafeVolumeSeat(corridors, isWalkable) {
    let best, bestArea = 0;
    for (const box of corridors) {
      const width = box.maxCol - box.minCol + 1;
      const heights = new Int32Array(width), stack = new Int32Array(width + 1);
      for (let row = box.minRow; row <= box.maxRow; row++) {
        for (let col = 0; col < width; col++) heights[col] = isWalkable(box.minCol + col, row) ? heights[col] + 1 : 0;
        let top = -1;
        for (let right = 0; right <= width; right++) {
          const height = right === width ? 0 : heights[right];
          while (top >= 0 && heights[stack[top]] > height) {
            const h = heights[stack[top--]], left = top < 0 ? 0 : stack[top] + 1, w = right - left;
            if (h < 2 || w < 2) continue;
            const area2 = h * w, minCol = box.minCol + left, minRow = row - h + 1;
            if (area2 < bestArea || area2 === bestArea && best && (minRow > best.minRow || minRow === best.minRow && minCol >= best.minCol)) continue;
            bestArea = area2;
            best = {
              minCol,
              minRow,
              maxCol: box.minCol + right - 1,
              maxRow: row,
              coreCol: minCol + Math.floor((w - 1) / 2),
              coreRow: minRow + Math.floor((h - 1) / 2)
            };
          }
          stack[++top] = right;
        }
      }
    }
    return best;
  }
  function doorwayWallSeats(edges, grid) {
    const seats = [];
    const walls = new Set(edges.flatMap((edge) => edge.tiles.map((t) => `${t.col},${t.row}`)));
    for (const edge of edges) {
      const floors = new Set(edge.strikeFloors.map((f) => `${f.col},${f.row}`));
      for (const tile of edge.tiles) for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const col = tile.col + nx, row = tile.row + ny;
        if (!floors.has(`${col},${row}`) || grid.isOpaque(col, row)) continue;
        const tx = -ny, ty = nx;
        const end = [1, -1].some((sign) => floors.has(`${tile.col + tx * sign},${tile.row + ty * sign}`) && !grid.isOpaque(tile.col + tx * sign, tile.row + ty * sign) && floors.has(`${col + tx * sign},${row + ty * sign}`) && !grid.isOpaque(col + tx * sign, row + ty * sign) && walls.has(`${tile.col - tx * sign},${tile.row - ty * sign}`));
        let passage = false;
        for (let width = 1; width <= 3; width++) {
          if (!floors.has(`${tile.col + nx * width},${tile.row + ny * width}`) && grid.isOpaque(tile.col + nx * width, tile.row + ny * width)) break;
          const beyond = width + 1;
          if (walls.has(`${tile.col + nx * beyond},${tile.row + ny * beyond}`)) {
            passage = !grid.isOpaque(col + tx, row + ty) && !grid.isOpaque(col - tx, row - ty);
            break;
          }
        }
        if (end || passage) seats.push({ tiles: [tile], strikeFloors: [{ col, row }] });
      }
    }
    return seats;
  }
  var ENEMY_DATA3 = {
    infiltrator: {
      role: "infiltrator",
      displayName: "\u6E17\u900F\u4F53",
      sightRange: 180,
      sightHalfAngleCore: 55,
      sightRangePeriph: 90,
      sightHalfAnglePeriph: 90,
      chaseSightRange: 210,
      hearingRange: 100,
      hearingMoveMult: 1,
      hearingStillRange: 0,
      hearingWallFactor: 0.6,
      visionWeight: 1,
      hearingWeight: 0,
      hearingMaxPush: "suspicious",
      patrolSpeed: 30,
      chaseSpeed: 65,
      suspiciousSpeed: 22,
      alertSpeed: 45,
      returnSpeed: 38
    },
    rewriter: {
      role: "rewriter",
      displayName: "\u6539\u5199\u4F53",
      sightRange: 180,
      sightHalfAngleCore: 32,
      sightRangePeriph: 56,
      sightHalfAnglePeriph: 50,
      chaseSightRange: 210,
      hearingRange: 150,
      hearingMoveMult: 2,
      hearingStillRange: 40,
      hearingWallFactor: 0.6,
      visionWeight: 0.45,
      hearingWeight: 1,
      hearingMaxPush: "alert",
      patrolSpeed: 30,
      chaseSpeed: 65,
      suspiciousSpeed: 22,
      alertSpeed: 45,
      returnSpeed: 38
    }
  };
  var DIRS422 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  function at3(cols, col, row) {
    return row * cols + col;
  }
  function inBounds22(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function labelFloors(land, walls, cols, rows) {
    const total = cols * rows;
    const labels = new Int32Array(total);
    let count = 0;
    for (let i = 0; i < total; i++) {
      if (!land[i] || walls[i] || labels[i]) continue;
      count++;
      const stack = [i];
      labels[i] = count;
      while (stack.length > 0) {
        const cur = stack.pop();
        const col = cur % cols;
        const row = cur / cols | 0;
        for (const [dx, dy] of DIRS422) {
          const nx = col + dx;
          const ny = row + dy;
          if (!inBounds22(cols, rows, nx, ny)) continue;
          const ni = at3(cols, nx, ny);
          if (labels[ni] || !land[ni] || walls[ni]) continue;
          labels[ni] = count;
          stack.push(ni);
        }
      }
    }
    return { labels, count };
  }
  function countWalkableComponents(land, walls, cols, rows) {
    return labelFloors(land, walls, cols, rows).count;
  }
  function leftoverDisconnectedCount(land, walls, cols, rows) {
    const { labels, count } = labelFloors(land, walls, cols, rows);
    if (count <= 1) return 0;
    const sizes = new Array(count + 1).fill(0);
    for (let i = 0; i < labels.length; i++) sizes[labels[i]]++;
    let best = 0;
    for (let k = 1; k <= count; k++) if (sizes[k] > best) best = sizes[k];
    let floor = 0;
    for (let i = 0; i < land.length; i++) if (land[i] && !walls[i]) floor++;
    return floor - best;
  }
  function openSealedFloors(land, walls, cols, rows, keep) {
    let punched = 0;
    for (let iter = 0; iter < 48; iter++) {
      const { labels, count } = labelFloors(land, walls, cols, rows);
      if (count <= 1) return punched;
      const sizes = new Array(count + 1).fill(0);
      for (let i = 0; i < labels.length; i++) sizes[labels[i]]++;
      let main = 1;
      for (let k = 2; k <= count; k++) if (sizes[k] > sizes[main]) main = k;
      let both = -1;
      let leftoverOnly = -1;
      for (let i = 0; i < walls.length; i++) {
        if (!walls[i] || !land[i]) continue;
        if (keep && keep[i]) continue;
        const col = i % cols;
        const row = i / cols | 0;
        let touchMain = false;
        let touchLeftover = false;
        for (const [dx, dy] of DIRS422) {
          const nx = col + dx;
          const ny = row + dy;
          if (!inBounds22(cols, rows, nx, ny)) continue;
          const id = labels[at3(cols, nx, ny)];
          if (id === main) touchMain = true;
          else if (id > 0) touchLeftover = true;
        }
        if (touchMain && touchLeftover) {
          both = i;
          break;
        }
        if (touchLeftover && leftoverOnly < 0) leftoverOnly = i;
      }
      const hit = both >= 0 ? both : leftoverOnly;
      if (hit < 0) return punched;
      walls[hit] = 0;
      punched++;
    }
    return punched;
  }
  function assertSingleWalkable(land, walls, cols, rows, label) {
    const n = countWalkableComponents(land, walls, cols, rows);
    if (n === 1) return;
    throw new Error(`${label}: walkable components = ${n}, need 1`);
  }
  function at4(cols, col, row) {
    return row * cols + col;
  }
  function maxOpenYardRect(land, walls, cols, rows) {
    const hist = new Array(cols).fill(0);
    let best = { col: 0, row: 0, width: 0, height: 0, area: 0 };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at4(cols, col, row);
        hist[col] = land[i] && !walls[i] ? hist[col] + 1 : 0;
      }
      const stack = [];
      for (let col = 0; col <= cols; col++) {
        const h = col < cols ? hist[col] : 0;
        while (stack.length > 0 && hist[stack[stack.length - 1]] > h) {
          const hh = hist[stack.pop()];
          const left = stack.length > 0 ? stack[stack.length - 1] + 1 : 0;
          const width = col - left;
          const area2 = hh * width;
          if (area2 > best.area) {
            best = { col: left, row: row - hh + 1, width, height: hh, area: area2 };
          }
        }
        if (col < cols) stack.push(col);
      }
    }
    return best;
  }
  function maxOpenYard(land, walls, cols, rows) {
    return maxOpenYardRect(land, walls, cols, rows).area;
  }
  var WALL_RATIO_CAP = 0.18;
  function at5(cols, col, row) {
    return row * cols + col;
  }
  function inBounds3(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function isFloor(land, walls, cols, rows, col, row) {
    if (!inBounds3(cols, rows, col, row)) return false;
    const i = at5(cols, col, row);
    return !!land[i] && !walls[i];
  }
  function landCount(land) {
    let n = 0;
    for (let i = 0; i < land.length; i++) if (land[i]) n++;
    return n;
  }
  function wallCount(walls) {
    let n = 0;
    for (let i = 0; i < walls.length; i++) if (walls[i]) n++;
    return n;
  }
  function voidDist(land, cols, rows, col, row) {
    let best = cols + rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (land[at5(cols, c, r)]) continue;
        const d = Math.abs(c - col) + Math.abs(r - row);
        if (d < best) best = d;
      }
    }
    return best;
  }
  function abutsReservedWall(walls, reserved, cols, rows, col, row) {
    for (const [dx, dy] of ROOT_DIRS) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds3(cols, rows, nc, nr)) continue;
      const i = at5(cols, nc, nr);
      if (reserved[i] && walls[i]) return true;
    }
    return false;
  }
  function tryAddWalls(land, walls, cols, rows, cells, avoid) {
    if (cells.length === 0) return false;
    const trial = new Uint8Array(walls);
    let stamped = 0;
    for (const cell of cells) {
      if (!isFloor(land, walls, cols, rows, cell.col, cell.row)) continue;
      const i = at5(cols, cell.col, cell.row);
      if (avoid && avoid[i]) continue;
      if (avoid && abutsReservedWall(walls, avoid, cols, rows, cell.col, cell.row)) continue;
      trial[i] = 1;
      stamped++;
    }
    if (stamped === 0) return false;
    if (countWalkableComponents(land, trial, cols, rows) !== 1) return false;
    walls.set(trial);
    return true;
  }
  function tryPunchLand(land, walls, cols, rows, cells, avoid) {
    if (cells.length === 0) return false;
    const trialLand = new Uint8Array(land);
    const trialWalls = new Uint8Array(walls);
    for (const cell of cells) {
      const i = at5(cols, cell.col, cell.row);
      if (!land[i]) return false;
      if (avoid && avoid[i]) return false;
      trialLand[i] = 0;
      trialWalls[i] = 0;
    }
    const empty = new Uint8Array(land.length);
    if (countWalkableComponents(trialLand, empty, cols, rows) !== 1) return false;
    if (countWalkableComponents(trialLand, trialWalls, cols, rows) !== 1) return false;
    land.set(trialLand);
    walls.set(trialWalls);
    return true;
  }
  function paintAround(land, walls, cols, rows, near, role, radius) {
    const paint = [];
    const seen = /* @__PURE__ */ new Set();
    for (const cell of near) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const col = cell.col + dx;
          const row = cell.row + dy;
          if (!isFloor(land, walls, cols, rows, col, row)) continue;
          const i = at5(cols, col, row);
          if (seen.has(i)) continue;
          seen.add(i);
          paint.push({ col, row, role });
        }
      }
    }
    return paint;
  }
  function pickFloor(land, walls, cols, rows, rng, used, minDist, preferOpen) {
    const yard = maxOpenYardRect(land, walls, cols, rows);
    const candidates = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!isFloor(land, walls, cols, rows, col, row)) continue;
        if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < minDist)) continue;
        if (preferOpen) {
          const inYard = col >= yard.col && col < yard.col + yard.width && row >= yard.row && row < yard.row + yard.height;
          if (!inYard && yard.area > 8) continue;
        }
        candidates.push({ col, row });
      }
    }
    if (candidates.length === 0) {
      if (preferOpen) return pickFloor(land, walls, cols, rows, rng, used, minDist, false);
      return null;
    }
    return candidates[rng.nextInt(0, candidates.length - 1)];
  }
  function clumpCells(seed2, rng) {
    const w = rng.nextInt(2, 3);
    const h = rng.nextInt(2, 3);
    const cells = [];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) cells.push({ col: seed2.col + dx, row: seed2.row + dy });
    }
    return cells;
  }
  function wallNormal(walls, cols, rows, col, row) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds3(cols, rows, nc, nr)) continue;
      if (walls[at5(cols, nc, nr)]) return { dx, dy };
    }
    return null;
  }
  function pickAbutting(land, walls, cols, rows, rng, used, minDist) {
    const candidates = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!isFloor(land, walls, cols, rows, col, row)) continue;
        if (!wallNormal(walls, cols, rows, col, row)) continue;
        if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < minDist)) continue;
        candidates.push({ col, row });
      }
    }
    if (candidates.length === 0) return null;
    return candidates[rng.nextInt(0, candidates.length - 1)];
  }
  function abutMass(kind, seed2, walls, cols, rows, rng) {
    const n = wallNormal(walls, cols, rows, seed2.col, seed2.row);
    if (kind === "clump" || !n) return clumpCells(seed2, rng);
    const alongX = n.dy !== 0;
    const long = rng.nextInt(4, 6);
    const cells = [];
    for (let a = 0; a < long; a++) {
      for (let t = 0; t < 2; t++) {
        const col = alongX ? seed2.col + a : seed2.col - n.dx * t;
        const row = alongX ? seed2.row - n.dy * t : seed2.row + a;
        cells.push({ col, row });
      }
    }
    return cells;
  }
  function remainsCells(seed2, rng) {
    return clumpCells(seed2, rng).slice(0, rng.nextInt(3, 4));
  }
  var ROOT_DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  function boleCells(seed2) {
    return [
      { col: seed2.col, row: seed2.row },
      { col: seed2.col + 1, row: seed2.row },
      { col: seed2.col, row: seed2.row + 1 },
      { col: seed2.col + 1, row: seed2.row + 1 }
    ];
  }
  function canPlaceBole(land, walls, cols, rows, seed2, clearRing) {
    const bole = boleCells(seed2);
    for (const cell of bole) {
      if (!isFloor(land, walls, cols, rows, cell.col, cell.row)) return false;
    }
    const mine = new Set(bole.map((c) => `${c.col},${c.row}`));
    for (const cell of bole) {
      if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return false;
    }
    if (!clearRing) return true;
    for (let dy = -1; dy <= 2; dy++) {
      for (let dx = -1; dx <= 2; dx++) {
        const col = seed2.col + dx;
        const row = seed2.row + dy;
        if (!inBounds3(cols, rows, col, row)) continue;
        if (walls[at5(cols, col, row)]) return false;
      }
    }
    return true;
  }
  function growRoots(land, walls, cols, rows, seed2, rng) {
    const order = [...ROOT_DIRS];
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    const rootN = rng.nextInt(3, 4);
    const seen = new Set(boleCells(seed2).map((c) => `${c.col},${c.row}`));
    const roots = [];
    for (let r = 0; r < rootN; r++) {
      const [dx, dy] = order[r];
      const len = rng.nextInt(2, 4);
      let col = dx > 0 ? seed2.col + 1 : dx < 0 ? seed2.col : seed2.col + (rng.next() < 0.5 ? 0 : 1);
      let row = dy > 0 ? seed2.row + 1 : dy < 0 ? seed2.row : seed2.row + (rng.next() < 0.5 ? 0 : 1);
      const arm = [];
      for (let k = 0; k < len; k++) {
        col += dx;
        row += dy;
        if (!isFloor(land, walls, cols, rows, col, row)) break;
        if (touchesForeignWall(walls, cols, rows, col, row, seen)) break;
        const key = `${col},${row}`;
        if (seen.has(key) || arm.some((c) => `${c.col},${c.row}` === key)) continue;
        arm.push({ col, row });
      }
      if (arm.length < 2) continue;
      for (const cell of arm) {
        seen.add(`${cell.col},${cell.row}`);
        roots.push(cell);
      }
    }
    return roots;
  }
  function growStump(land, walls, cols, rows, seed2, clearRing, rng) {
    if (!canPlaceBole(land, walls, cols, rows, seed2, clearRing)) return null;
    const bole = boleCells(seed2);
    const roots = growRoots(land, walls, cols, rows, seed2, rng);
    const mine = new Set([...bole, ...roots].map((c) => `${c.col},${c.row}`));
    for (const cell of [...bole, ...roots]) {
      if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return { bole, roots: [] };
    }
    return { bole, roots };
  }
  function touchesForeignWall(walls, cols, rows, col, row, mine) {
    for (const [dx, dy] of ROOT_DIRS) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds3(cols, rows, nc, nr)) continue;
      if (!walls[at5(cols, nc, nr)]) continue;
      if (!mine.has(`${nc},${nr}`)) return true;
    }
    return false;
  }
  function markStumpReserve(reserved, cols, rows, seed2, cells) {
    const stamp2 = (col, row) => {
      if (!inBounds3(cols, rows, col, row)) return;
      reserved[at5(cols, col, row)] = 1;
    };
    for (let dy = -1; dy <= 2; dy++) {
      for (let dx = -1; dx <= 2; dx++) stamp2(seed2.col + dx, seed2.row + dy);
    }
    for (const cell of cells) {
      stamp2(cell.col, cell.row);
      stamp2(cell.col + 1, cell.row);
      stamp2(cell.col - 1, cell.row);
      stamp2(cell.col, cell.row + 1);
      stamp2(cell.col, cell.row - 1);
    }
  }
  function collectStumpSites(land, walls, cols, rows, used, blocked, clearRing) {
    const seeds = [];
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        if (!isFloor(land, walls, cols, rows, col, row)) continue;
        if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < 10)) continue;
        if (blocked.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < 2)) continue;
        const seed2 = { col, row };
        if (!canPlaceBole(land, walls, cols, rows, seed2, clearRing)) continue;
        seeds.push(seed2);
      }
    }
    return seeds;
  }
  function scoreStumpSite(land, walls, cols, rows, seed2) {
    const yard = maxOpenYardRect(land, walls, cols, rows);
    const inYard = seed2.col >= yard.col && seed2.col < yard.col + yard.width && seed2.row >= yard.row && seed2.row < yard.row + yard.height;
    const nearWall2 = wallNormal(walls, cols, rows, seed2.col, seed2.row) ? 20 : 0;
    return (inYard ? 8 : 0) + nearWall2 + voidDist(land, cols, rows, seed2.col, seed2.row);
  }
  function pickStumpSite(land, walls, cols, rows, used, blocked, rng) {
    for (const clearRing of [true, false]) {
      const sites = collectStumpSites(land, walls, cols, rows, used, blocked, clearRing);
      if (sites.length === 0) continue;
      const ranked = sites.map((seed22) => ({ seed: seed22, score: scoreStumpSite(land, walls, cols, rows, seed22) })).sort((a, b) => b.score - a.score);
      const cut = Math.max(1, ranked.length * 0.4 | 0);
      const pool = ranked.slice(0, cut);
      const seed2 = pool[rng.nextInt(0, pool.length - 1)].seed;
      const grown = growStump(land, walls, cols, rows, seed2, clearRing, rng);
      if (grown) return { seed: seed2, bole: grown.bole, roots: grown.roots };
    }
    return null;
  }
  function hollowCells(land, walls, cols, rows, seed2, rng) {
    const rad = rng.nextInt(1, 2);
    const cells = [];
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad + 1) continue;
        const col = seed2.col + dx;
        const row = seed2.row + dy;
        if (!isFloor(land, walls, cols, rows, col, row)) continue;
        cells.push({ col, row });
      }
    }
    return cells;
  }
  function applyCover(land, walls, cols, rows, spec, rng) {
    const paint = [];
    const used = [];
    const reserved = new Uint8Array(land.length);
    const place = (cells, around, radius) => {
      if (!tryAddWalls(land, walls, cols, rows, cells, reserved)) return false;
      used.push(cells[0]);
      if (around) paint.push(...paintAround(land, walls, cols, rows, cells, around, radius));
      return true;
    };
    const blocked = [];
    for (let t = 0; t < spec.trees; t++) {
      let placed = false;
      for (let tryN = 0; tryN < 20 && !placed; tryN++) {
        const site = pickStumpSite(land, walls, cols, rows, used, blocked, rng);
        if (!site) break;
        const withRoots = site.bole.concat(site.roots);
        const cells = tryAddWalls(land, walls, cols, rows, withRoots, reserved) ? withRoots : tryAddWalls(land, walls, cols, rows, site.bole, reserved) ? site.bole : null;
        if (!cells) {
          blocked.push(site.seed);
          continue;
        }
        used.push(site.seed);
        markStumpReserve(reserved, cols, rows, site.seed, cells);
        for (const cell of site.bole) {
          const i = at5(cols, cell.col, cell.row);
          if (land[i] && walls[i]) paint.push({ col: cell.col, row: cell.row, role: "stump" });
        }
        if (cells.length > site.bole.length) {
          for (const cell of site.roots) {
            const i = at5(cols, cell.col, cell.row);
            if (land[i] && walls[i]) paint.push({ col: cell.col, row: cell.row, role: "root" });
          }
        }
        placed = true;
      }
    }
    for (let r = 0; r < spec.remains; r++) {
      const seed2 = pickAbutting(land, walls, cols, rows, rng, used, 6) ?? pickFloor(land, walls, cols, rows, rng, used, 7, false);
      if (!seed2) break;
      place(remainsCells(seed2, rng), "wreck", 1);
    }
    for (let h = 0; h < spec.hollows; h++) {
      let placed = false;
      for (let tryN = 0; tryN < 24 && !placed; tryN++) {
        const seed2 = pickFloor(land, walls, cols, rows, rng, used, 8, false);
        if (!seed2) break;
        if (voidDist(land, cols, rows, seed2.col, seed2.row) < 3) continue;
        const cells = hollowCells(land, walls, cols, rows, seed2, rng);
        if (tryPunchLand(land, walls, cols, rows, cells, reserved)) {
          used.push(seed2);
          placed = true;
        }
      }
    }
    const cycle = spec.cycle.length > 0 ? spec.cycle : ["clump", "plate"];
    const cutN = Math.min(spec.cuts, 4);
    for (let c = 0; c < cutN; c++) {
      const landN = landCount(land);
      const ratio = landN === 0 ? 0 : wallCount(walls) / landN;
      if (ratio >= WALL_RATIO_CAP) break;
      const kind = cycle[c % cycle.length] === "stub" ? "clump" : cycle[c % cycle.length];
      const seed2 = pickAbutting(land, walls, cols, rows, rng, used, 5);
      if (!seed2) break;
      const cells = abutMass(kind, seed2, walls, cols, rows, rng);
      if (place(cells, null, 0)) continue;
      place(clumpCells(seed2, rng), null, 0);
    }
    return paint;
  }
  function stumpTouchesStone(walls, cols, rows, paint) {
    const wood = paint.filter((c) => c.role === "stump" || c.role === "root");
    const mine = new Set(wood.map((c) => `${c.col},${c.row}`));
    for (const cell of wood) {
      if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return true;
    }
    return false;
  }
  function countBoles(paint, walls, cols) {
    const stumps = paint.filter((c) => {
      if (c.role !== "stump") return false;
      if (!walls || cols === void 0) return true;
      return !!walls[c.row * cols + c.col];
    });
    let n = 0;
    const seen = /* @__PURE__ */ new Set();
    for (const cell of stumps) {
      for (const [ox, oy] of [
        [0, 0],
        [-1, 0],
        [0, -1],
        [-1, -1]
      ]) {
        const c0 = cell.col + ox;
        const r0 = cell.row + oy;
        const key = `${c0},${r0}`;
        if (seen.has(key)) continue;
        const has = (dc, dr) => stumps.some((c) => c.col === c0 + dc && c.row === r0 + dr);
        if (has(0, 0) && has(1, 0) && has(0, 1) && has(1, 1)) {
          seen.add(key);
          n++;
        }
      }
    }
    return n;
  }
  var DIRS43 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  function at6(cols, col, row) {
    return row * cols + col;
  }
  function inBounds4(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function woodMask(cols, rows, paint) {
    const wood = new Uint8Array(cols * rows);
    for (const cell of paint) {
      if (cell.role !== "stump" && cell.role !== "root") continue;
      if (!inBounds4(cols, rows, cell.col, cell.row)) continue;
      wood[at6(cols, cell.col, cell.row)] = 1;
    }
    return wood;
  }
  function isStone(walls, wood, cols, col, row) {
    const i = at6(cols, col, row);
    return !!walls[i] && !wood[i];
  }
  function isFloor2(land, walls, cols, col, row) {
    const i = at6(cols, col, row);
    return !!land[i] && !walls[i];
  }
  function thickStoneMask(walls, wood, cols, rows) {
    const thick = new Uint8Array(walls.length);
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        if (isStone(walls, wood, cols, col, row) && isStone(walls, wood, cols, col + 1, row) && isStone(walls, wood, cols, col, row + 1) && isStone(walls, wood, cols, col + 1, row + 1)) {
          thick[at6(cols, col, row)] = 1;
          thick[at6(cols, col + 1, row)] = 1;
          thick[at6(cols, col, row + 1)] = 1;
          thick[at6(cols, col + 1, row + 1)] = 1;
        }
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at6(cols, col, row);
        if (wood[i] && walls[i]) thick[i] = 1;
      }
    }
    return thick;
  }
  function maxThinRun(walls, wood, thick, cols, rows) {
    const thin = (col, row) => {
      if (!inBounds4(cols, rows, col, row)) return false;
      const i = at6(cols, col, row);
      return !!walls[i] && !wood[i] && !thick[i];
    };
    let best = 0;
    for (let row = 0; row < rows; row++) {
      let run = 0;
      for (let col = 0; col <= cols; col++) {
        if (col < cols && thin(col, row)) {
          run++;
          if (run > best) best = run;
        } else run = 0;
      }
    }
    for (let col = 0; col < cols; col++) {
      let run = 0;
      for (let row = 0; row <= rows; row++) {
        if (row < rows && thin(col, row)) {
          run++;
          if (run > best) best = run;
        } else run = 0;
      }
    }
    return best;
  }
  function narrowSlotCount(land, walls, wood, cols, rows) {
    const stone = (c, r) => inBounds4(cols, rows, c, r) && isStone(walls, wood, cols, c, r);
    const floor = (c, r) => inBounds4(cols, rows, c, r) && isFloor2(land, walls, cols, c, r);
    let n = 0;
    const seen = /* @__PURE__ */ new Set();
    const mark = (key) => {
      if (seen.has(key)) return;
      seen.add(key);
      n++;
    };
    for (let row = 0; row < rows; row++) {
      for (let gap = 1; gap <= 2; gap++) {
        let run = 0;
        for (let col = 0; col <= cols; col++) {
          const ok = col < cols && stone(col, row) && stone(col, row + gap + 1) && Array.from({ length: gap }, (_, k) => floor(col, row + 1 + k)).every(Boolean);
          if (ok) {
            run++;
            if (run === 4) mark(`h:${row}:${gap}:${col - 3}`);
          } else run = 0;
        }
      }
    }
    for (let col = 0; col < cols; col++) {
      for (let gap = 1; gap <= 2; gap++) {
        let run = 0;
        for (let row = 0; row <= rows; row++) {
          const ok = row < rows && stone(col, row) && stone(col + gap + 1, row) && Array.from({ length: gap }, (_, k) => floor(col + 1 + k, row)).every(Boolean);
          if (ok) {
            run++;
            if (run === 4) mark(`v:${col}:${gap}:${row - 3}`);
          } else run = 0;
        }
      }
    }
    return n;
  }
  function perpFloorSpan(land, walls, cols, rows, col, row, horizontal) {
    if (horizontal) {
      let a2 = row;
      while (a2 - 1 >= 0 && isFloor2(land, walls, cols, col, a2 - 1)) a2--;
      let b2 = row;
      while (b2 + 1 < rows && isFloor2(land, walls, cols, col, b2 + 1)) b2++;
      const span2 = b2 - a2 + 1;
      const walled2 = (a2 - 1 < 0 || !!walls[at6(cols, col, a2 - 1)]) && (b2 + 1 >= rows || !!walls[at6(cols, col, b2 + 1)]);
      return { span: span2, walled: walled2 };
    }
    let a = col;
    while (a - 1 >= 0 && isFloor2(land, walls, cols, a - 1, row)) a--;
    let b = col;
    while (b + 1 < cols && isFloor2(land, walls, cols, b + 1, row)) b++;
    const span = b - a + 1;
    const walled = (a - 1 < 0 || !!walls[at6(cols, a - 1, row)]) && (b + 1 >= cols || !!walls[at6(cols, b + 1, row)]);
    return { span, walled };
  }
  function maxWalledAlley(land, walls, cols, rows) {
    let best = 0;
    for (let row = 0; row < rows; row++) {
      let run = 0;
      for (let col = 0; col <= cols; col++) {
        const ok = col < cols && isFloor2(land, walls, cols, col, row) && (() => {
          const p = perpFloorSpan(land, walls, cols, rows, col, row, true);
          return p.walled && p.span >= 2 && p.span <= 4;
        })();
        if (ok) {
          run++;
          if (run > best) best = run;
        } else run = 0;
      }
    }
    for (let col = 0; col < cols; col++) {
      let run = 0;
      for (let row = 0; row <= rows; row++) {
        const ok = row < rows && isFloor2(land, walls, cols, col, row) && (() => {
          const p = perpFloorSpan(land, walls, cols, rows, col, row, false);
          return p.walled && p.span >= 2 && p.span <= 4;
        })();
        if (ok) {
          run++;
          if (run > best) best = run;
        } else run = 0;
      }
    }
    return best;
  }
  function oneWideStep(land, walls, wood, cols, rows, col, row, dx, dy) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds4(cols, rows, nc, nr) || !isFloor2(land, walls, cols, nc, nr)) return false;
    const horiz = dx !== 0;
    const p = perpFloorSpan(land, walls, cols, rows, nc, nr, horiz);
    if (p.span !== 1 || !p.walled) return false;
    const sideA = horiz ? [nc, nr - 1] : [nc - 1, nr];
    const sideB = horiz ? [nc, nr + 1] : [nc + 1, nr];
    const stoneA = inBounds4(cols, rows, sideA[0], sideA[1]) && isStone(walls, wood, cols, sideA[0], sideA[1]);
    const stoneB = inBounds4(cols, rows, sideB[0], sideB[1]) && isStone(walls, wood, cols, sideB[0], sideB[1]);
    return stoneA && stoneB;
  }
  function threeWayAlleyCount(land, walls, wood, cols, rows) {
    let n = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!isFloor2(land, walls, cols, col, row)) continue;
        let arms = 0;
        for (const [dx, dy] of DIRS43) {
          if (oneWideStep(land, walls, wood, cols, rows, col, row, dx, dy)) arms++;
        }
        if (arms >= 3) n++;
      }
    }
    return n;
  }
  function openYardWithEdgeCover(land, walls, thick, cols, rows) {
    const SIZE = 6;
    for (let row = 0; row <= rows - SIZE; row++) {
      for (let col = 0; col <= cols - SIZE; col++) {
        let open = true;
        for (let r = row; r < row + SIZE && open; r++) {
          for (let c = col; c < col + SIZE; c++) {
            const i = at6(cols, c, r);
            if (!land[i] || walls[i]) {
              open = false;
              break;
            }
          }
        }
        if (!open) continue;
        for (let r = row - 2; r < row + SIZE + 2; r++) {
          for (let c = col - 2; c < col + SIZE + 2; c++) {
            if (!inBounds4(cols, rows, c, r)) continue;
            const inside2 = c >= col && c < col + SIZE && r >= row && r < row + SIZE;
            if (inside2) continue;
            if (thick[at6(cols, c, r)]) return true;
          }
        }
      }
    }
    return false;
  }
  function measureSilhouette(land, walls, cols, rows, paint = []) {
    const wood = woodMask(cols, rows, paint);
    const thick = thickStoneMask(walls, wood, cols, rows);
    let landN = 0;
    let wallN = 0;
    let stoneN = 0;
    let thickN = 0;
    for (let i = 0; i < land.length; i++) {
      if (land[i]) landN++;
      if (!walls[i]) continue;
      wallN++;
      if (wood[i]) {
        if (thick[i]) thickN++;
        continue;
      }
      stoneN++;
      if (thick[i]) thickN++;
    }
    const thickRatio = wallN === 0 ? 1 : thickN / wallN;
    return {
      thinRun: maxThinRun(walls, wood, thick, cols, rows),
      thickRatio,
      narrowSlots: narrowSlotCount(land, walls, wood, cols, rows),
      threeWayAlleys: threeWayAlleyCount(land, walls, wood, cols, rows),
      openYardCovered: openYardWithEdgeCover(land, walls, thick, cols, rows),
      longAlley: maxWalledAlley(land, walls, cols, rows),
      wallRatio: landN === 0 ? 0 : wallN / landN
    };
  }
  function silhouetteFails(m) {
    if (m.thinRun > 6) return `thin run ${m.thinRun} > 6`;
    if (m.thickRatio < 0.5) return `thick ratio ${m.thickRatio.toFixed(2)} < 0.5`;
    if (m.narrowSlots > 0) return `narrow slots ${m.narrowSlots}`;
    if (m.threeWayAlleys > 0) return `three-way alleys ${m.threeWayAlleys}`;
    if (!m.openYardCovered) return "no 6x6 yard with edge cover";
    if (m.longAlley > 8) return `walled alley ${m.longAlley} > 8`;
    if (m.wallRatio > 0.18 + 1e-6) return `wall ratio ${(m.wallRatio * 100).toFixed(1)}% > 18%`;
    return null;
  }
  var DIRS44 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  var WALL_FILL_CAP = 0.17;
  var WALL_HARD_CAP = 0.18;
  var P90_TARGET = 7;
  var P90_GATE = 8;
  var YARD_TARGET = 96;
  var YARD_GATE = 112;
  var FAR_COVER = 7;
  var FAR_BLOB_GATE = 48;
  var PLAZA = 6;
  var MIN_STAMP = 4;
  function at7(cols, col, row) {
    return row * cols + col;
  }
  function inBounds5(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function isFloor3(land, walls, cols, rows, col, row) {
    if (!inBounds5(cols, rows, col, row)) return false;
    const i = at7(cols, col, row);
    return !!land[i] && !walls[i];
  }
  function wallRatio(land, walls) {
    let landN = 0;
    let wallN = 0;
    for (let i = 0; i < land.length; i++) {
      if (land[i]) landN++;
      if (walls[i]) wallN++;
    }
    return landN === 0 ? 0 : wallN / landN;
  }
  function rect(ox, oy, w, h) {
    const cells = [];
    for (let row = oy; row < oy + h; row++) {
      for (let col = ox; col < ox + w; col++) cells.push({ col, row });
    }
    return cells;
  }
  function voidDistField(land, cols, rows) {
    const dist = new Int16Array(land.length);
    dist.fill(32767);
    const q = [];
    for (let i = 0; i < land.length; i++) {
      if (land[i]) continue;
      dist[i] = 0;
      q.push(i);
    }
    for (let head = 0; head < q.length; head++) {
      const i = q[head];
      const col = i % cols;
      const row = i / cols | 0;
      const d = dist[i];
      for (const [dx, dy] of DIRS44) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds5(cols, rows, nc, nr)) continue;
        const ni = at7(cols, nc, nr);
        if (dist[ni] <= d + 1) continue;
        dist[ni] = d + 1;
        q.push(ni);
      }
    }
    return dist;
  }
  function nearestWallField(land, walls, cols, rows) {
    const dist = new Int16Array(land.length);
    dist.fill(32767);
    const q = [];
    for (let i = 0; i < land.length; i++) {
      if (!land[i] || !walls[i]) continue;
      dist[i] = 0;
      q.push(i);
    }
    for (let head = 0; head < q.length; head++) {
      const i = q[head];
      const col = i % cols;
      const row = i / cols | 0;
      const d = dist[i];
      for (const [dx, dy] of DIRS44) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds5(cols, rows, nc, nr)) continue;
        const ni = at7(cols, nc, nr);
        if (!land[ni] || dist[ni] <= d + 1) continue;
        dist[ni] = d + 1;
        q.push(ni);
      }
    }
    return dist;
  }
  function coverDistanceField(land, walls, cols, rows, paint = []) {
    const wood = woodMask(cols, rows, paint);
    const thick = thickStoneMask(walls, wood, cols, rows);
    const dist = new Float32Array(land.length);
    dist.fill(1e9);
    const q = [];
    for (let i = 0; i < land.length; i++) {
      if (!thick[i] || !walls[i]) continue;
      dist[i] = 0;
      q.push(i);
    }
    for (let head = 0; head < q.length; head++) {
      const i = q[head];
      const col = i % cols;
      const row = i / cols | 0;
      const d = dist[i];
      for (const [dx, dy] of DIRS44) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds5(cols, rows, nc, nr)) continue;
        const ni = at7(cols, nc, nr);
        if (!land[ni] || dist[ni] <= d + 1) continue;
        dist[ni] = d + 1;
        q.push(ni);
      }
    }
    return dist;
  }
  function measureCoverReach(land, walls, cols, rows, paint = []) {
    const dist = coverDistanceField(land, walls, cols, rows, paint);
    const vals = [];
    for (let i = 0; i < land.length; i++) {
      if (!land[i] || walls[i]) continue;
      const d = dist[i];
      if (d > 1e8) continue;
      vals.push(d);
    }
    vals.sort((a, b) => a - b);
    const median = vals.length === 0 ? 99 : vals[vals.length / 2 | 0];
    const p90 = vals.length === 0 ? 99 : vals[Math.min(vals.length - 1, vals.length * 0.9 | 0)];
    const seen = new Uint8Array(land.length);
    let farBlob = 0;
    for (let i = 0; i < land.length; i++) {
      if (seen[i] || !land[i] || walls[i] || dist[i] <= FAR_COVER || dist[i] > 1e8) continue;
      let n = 0;
      const stack = [i];
      seen[i] = 1;
      while (stack.length > 0) {
        const cur = stack.pop();
        n++;
        const col = cur % cols;
        const row = cur / cols | 0;
        for (const [dx, dy] of DIRS44) {
          const nc = col + dx;
          const nr = row + dy;
          if (!inBounds5(cols, rows, nc, nr)) continue;
          const ni = at7(cols, nc, nr);
          if (seen[ni] || !land[ni] || walls[ni] || dist[ni] <= FAR_COVER || dist[ni] > 1e8) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (n > farBlob) farBlob = n;
    }
    return { median, p90, farBlob };
  }
  function coverReachFails(m, maxYard = 0, rimRing = false) {
    if (m.p90 > P90_GATE + 1e-6) return `cover p90 ${m.p90.toFixed(1)} > ${P90_GATE}`;
    if (m.farBlob > FAR_BLOB_GATE) return `cover far-blob ${m.farBlob} > ${FAR_BLOB_GATE}`;
    if (!rimRing && maxYard > YARD_GATE) return `open yard ${maxYard} > ${YARD_GATE}`;
    return null;
  }
  function stealthSpecFor(recipe) {
    const g = recipe.structure.grammar;
    const plateish = recipe.cover.cycle.includes("plate");
    return {
      allowDivider: g === "ridge" || g === "orthoRidge" || g === "twinRidge" || g === "pads" || g === "plates" || g === "hunks",
      maxDividers: g === "orthoRidge" || g === "pads" || g === "plates" || g === "hunks" ? 1 : 2,
      rimRing: g === "rim",
      preferPlate: plateish && g !== "plates" && g !== "hunks",
      maxFlangesPerMass: g === "plates" ? 1 : 2,
      minGap: g === "shear" || g === "plates" ? 5 : 4
    };
  }
  function blockedCell(ctx, col, row) {
    const { cols, rows, keepWood, plaza } = ctx;
    if (!inBounds5(cols, rows, col, row)) return true;
    const i = at7(cols, col, row);
    if (keepWood[i] || plaza[i]) return true;
    for (const [dx, dy] of DIRS44) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds5(cols, rows, nc, nr)) continue;
      if (keepWood[at7(cols, nc, nr)]) return true;
    }
    return false;
  }
  function tryStamp(ctx, cells) {
    const { land, walls, cols, rows, paint } = ctx;
    if (wallRatio(land, walls) >= WALL_HARD_CAP) return false;
    const trial = new Uint8Array(walls);
    let n = 0;
    for (const cell of cells) {
      if (!isFloor3(land, trial, cols, rows, cell.col, cell.row)) continue;
      if (blockedCell(ctx, cell.col, cell.row)) continue;
      trial[at7(cols, cell.col, cell.row)] = 1;
      n++;
    }
    if (n < MIN_STAMP) return false;
    if (wallRatio(land, trial) > WALL_HARD_CAP + 1e-6) return false;
    if (countWalkableComponents(land, trial, cols, rows) !== 1) return false;
    const sil = measureSilhouette(land, trial, cols, rows, paint);
    if (silhouetteFails(sil)) return false;
    walls.set(trial);
    return true;
  }
  function markPlaza(ctx, col, row) {
    const { cols, rows, plaza } = ctx;
    for (let r = row; r < row + PLAZA; r++) {
      for (let c = col; c < col + PLAZA; c++) {
        if (!inBounds5(cols, rows, c, r)) continue;
        plaza[at7(cols, c, r)] = 1;
      }
    }
  }
  function reservePlaza(ctx) {
    const { land, walls, cols, rows, paint, spec, voidDist: voidDist2 } = ctx;
    const wood = woodMask(cols, rows, paint);
    const thick = thickStoneMask(walls, wood, cols, rows);
    let best = null;
    for (let row2 = 0; row2 <= rows - PLAZA; row2++) {
      for (let col2 = 0; col2 <= cols - PLAZA; col2++) {
        let open = true;
        let minVoid = 999;
        for (let r = row2; r < row2 + PLAZA && open; r++) {
          for (let c = col2; c < col2 + PLAZA; c++) {
            const i = at7(cols, c, r);
            if (!land[i] || walls[i]) {
              open = false;
              break;
            }
            if (voidDist2[i] < minVoid) minVoid = voidDist2[i];
          }
        }
        if (!open) continue;
        let edged = false;
        for (let r = row2 - 2; r < row2 + PLAZA + 2 && !edged; r++) {
          for (let c = col2 - 2; c < col2 + PLAZA + 2; c++) {
            if (!inBounds5(cols, rows, c, r)) continue;
            const inside2 = c >= col2 && c < col2 + PLAZA && r >= row2 && r < row2 + PLAZA;
            if (inside2) continue;
            if (thick[at7(cols, c, r)]) {
              edged = true;
              break;
            }
          }
        }
        if (!edged) continue;
        const score = minVoid;
        if (!best || score > best.score) best = { col: col2, row: row2, score };
      }
    }
    if (best) {
      markPlaza(ctx, best.col, best.row);
      return;
    }
    if (spec.rimRing) {
      let deep = null;
      for (let row2 = 0; row2 <= rows - PLAZA; row2++) {
        for (let col2 = 0; col2 <= cols - PLAZA; col2++) {
          let open = true;
          let minVoid = 999;
          for (let r = row2; r < row2 + PLAZA && open; r++) {
            for (let c = col2; c < col2 + PLAZA; c++) {
              const i = at7(cols, c, r);
              if (!land[i] || walls[i]) {
                open = false;
                break;
              }
              if (voidDist2[i] < minVoid) minVoid = voidDist2[i];
            }
          }
          if (!open) continue;
          if (!deep || minVoid > deep.score) deep = { col: col2, row: row2, score: minVoid };
        }
      }
      if (deep) markPlaza(ctx, deep.col, deep.row);
      return;
    }
    const yard = maxOpenYardRect(land, walls, cols, rows);
    if (yard.width < PLAZA || yard.height < PLAZA) return;
    const col = yard.col + Math.max(0, (yard.width - PLAZA) / 2 | 0);
    const row = yard.row + Math.max(0, (yard.height - PLAZA) / 2 | 0);
    markPlaza(ctx, col, row);
  }
  function dividerCells(yard, endEastOrSouth) {
    const gap = 6;
    const thick = 2;
    const cells = [];
    if (yard.width >= yard.height) {
      const row0 = yard.row + Math.max(5, Math.min(yard.height - 7, (yard.height - thick) / 2 | 0));
      const run = Math.max(6, yard.width - gap);
      const start = endEastOrSouth ? 0 : yard.width - run;
      for (let k = 0; k < run; k++) {
        for (let t = 0; t < thick; t++) {
          cells.push({ col: yard.col + start + k, row: row0 + t });
        }
      }
    } else {
      const col0 = yard.col + Math.max(5, Math.min(yard.width - 7, (yard.width - thick) / 2 | 0));
      const run = Math.max(6, yard.height - gap);
      const start = endEastOrSouth ? 0 : yard.height - run;
      for (let k = 0; k < run; k++) {
        for (let t = 0; t < thick; t++) {
          cells.push({ col: col0 + t, row: yard.row + start + k });
        }
      }
    }
    return cells;
  }
  function placeDividers(ctx) {
    if (!ctx.spec.allowDivider || ctx.spec.rimRing) return;
    for (let n = 0; n < ctx.spec.maxDividers; n++) {
      const yard = maxOpenYardRect(ctx.land, ctx.walls, ctx.cols, ctx.rows);
      if (yard.area < 88) break;
      if (yard.width < 12 || yard.height < 12) break;
      const end = ctx.rng.next() < 0.5;
      if (tryStamp(ctx, dividerCells(yard, end))) continue;
      if (tryStamp(ctx, dividerCells(yard, !end))) continue;
      break;
    }
  }
  function wallComponents(ctx) {
    const { land, walls, cols, rows } = ctx;
    const seen = new Uint8Array(walls.length);
    const out = [];
    for (let i = 0; i < walls.length; i++) {
      if (!walls[i] || !land[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
      const cells = [i];
      while (stack.length > 0) {
        const cur = stack.pop();
        const col = cur % cols;
        const row = cur / cols | 0;
        for (const [dx, dy] of DIRS44) {
          const nc = col + dx;
          const nr = row + dy;
          if (!inBounds5(cols, rows, nc, nr)) continue;
          const ni = at7(cols, nc, nr);
          if (seen[ni] || !walls[ni] || !land[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
          cells.push(ni);
        }
      }
      out.push(cells);
    }
    return out;
  }
  function flangeTouchesForeign(ctx, cells, mother) {
    const { walls, cols, rows } = ctx;
    const self = new Set(cells.map((c) => at7(cols, c.col, c.row)));
    for (const cell of cells) {
      let onMother = false;
      for (const [dx, dy] of DIRS44) {
        const ni = inBounds5(cols, rows, cell.col + dx, cell.row + dy) ? at7(cols, cell.col + dx, cell.row + dy) : -1;
        if (ni >= 0 && mother.has(ni)) onMother = true;
      }
      if (onMother) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dc === 0 && dr === 0) continue;
          const nc = cell.col + dc;
          const nr = cell.row + dr;
          if (!inBounds5(cols, rows, nc, nr)) continue;
          const ni = at7(cols, nc, nr);
          if (!walls[ni]) continue;
          if (mother.has(ni) || self.has(ni)) continue;
          if (Math.abs(dc) + Math.abs(dr) <= 3) return true;
        }
      }
    }
    return false;
  }
  function placeFlanges(ctx) {
    const comps = wallComponents(ctx).filter((c) => c.length >= 6);
    for (const comp of comps) {
      const mother = new Set(comp);
      const tips = [];
      for (const i of comp) {
        const col = i % ctx.cols;
        const row = i / ctx.cols | 0;
        for (const [dx, dy] of DIRS44) {
          let open = 0;
          for (let k = 1; k <= 5; k++) {
            if (!isFloor3(ctx.land, ctx.walls, ctx.cols, ctx.rows, col + dx * k, row + dy * k)) break;
            if (blockedCell(ctx, col + dx * k, row + dy * k)) break;
            open++;
          }
          if (open < 4) continue;
          if (ctx.spec.rimRing) {
            const baseV = ctx.voidDist[at7(ctx.cols, col, row)];
            const tipV = ctx.voidDist[at7(ctx.cols, col + dx * 4, row + dy * 4)];
            if (tipV <= baseV) continue;
          }
          tips.push({ col, row, dx, dy, open });
        }
      }
      tips.sort((a, b) => b.open - a.open);
      let placed = 0;
      for (const tip of tips) {
        if (placed >= ctx.spec.maxFlangesPerMass) break;
        const cells = [];
        const px = -tip.dy;
        const py = tip.dx;
        for (let k = 1; k <= 4; k++) {
          const col = tip.col + tip.dx * k;
          const row = tip.row + tip.dy * k;
          cells.push({ col, row });
          cells.push({ col: col + px, row: row + py });
        }
        if (flangeTouchesForeign(ctx, cells, mother)) continue;
        if (tryStamp(ctx, cells)) placed++;
      }
    }
  }
  function inRimRing(ctx, col, row) {
    if (!ctx.spec.rimRing) return true;
    const d = ctx.voidDist[at7(ctx.cols, col, row)];
    return d >= 2 && d <= 10;
  }
  function pickSplitInYard(ctx, minWall, skip) {
    const { land, walls, cols, rows } = ctx;
    const yard = maxOpenYardRect(land, walls, cols, rows);
    const dist = nearestWallField(land, walls, cols, rows);
    let best = null;
    for (let row = yard.row; row < yard.row + yard.height - 3; row++) {
      for (let col = yard.col; col < yard.col + yard.width - 3; col++) {
        if (skip.has(at7(cols, col, row))) continue;
        if (blockedCell(ctx, col, row)) continue;
        if (!inRimRing(ctx, col, row)) continue;
        if (!isFloor3(land, walls, cols, rows, col, row)) continue;
        const d = dist[at7(cols, col, row)];
        if (d < minWall) continue;
        if (!best || d > best.dist) best = { col, row, dist: d };
      }
    }
    return best ? { col: best.col, row: best.row } : null;
  }
  function farthestFloor(ctx) {
    const { land, walls, cols, rows } = ctx;
    const dist = nearestWallField(land, walls, cols, rows);
    let best = null;
    for (let row = 0; row < rows - 2; row++) {
      for (let col = 0; col < cols - 2; col++) {
        if (blockedCell(ctx, col, row)) continue;
        if (!inRimRing(ctx, col, row)) continue;
        if (!isFloor3(land, walls, cols, rows, col, row)) continue;
        const d = dist[at7(cols, col, row)];
        if (!best || d > best.dist) best = { col, row, dist: d };
      }
    }
    return best;
  }
  function stampFamily(ctx, seed2) {
    const { rng, spec } = ctx;
    if (spec.preferPlate) {
      const long = rng.nextInt(4, 5);
      const horizontal = rng.next() < 0.5;
      const cells = horizontal ? rect(seed2.col, seed2.row, long, 2) : rect(seed2.col, seed2.row, 2, long);
      if (tryStamp(ctx, cells)) return true;
    }
    const w = rng.nextInt(3, 4);
    const h = rng.nextInt(3, 4);
    if (tryStamp(ctx, rect(seed2.col, seed2.row, w, h))) return true;
    return tryStamp(ctx, rect(seed2.col, seed2.row, 3, 3));
  }
  function fillHoles(ctx) {
    const skip = /* @__PURE__ */ new Set();
    for (let n = 0; n < 48; n++) {
      const ratio = wallRatio(ctx.land, ctx.walls);
      if (ratio >= WALL_FILL_CAP) break;
      const reach = measureCoverReach(ctx.land, ctx.walls, ctx.cols, ctx.rows, ctx.paint);
      const yard = maxOpenYard(ctx.land, ctx.walls, ctx.cols, ctx.rows);
      if (yard <= YARD_TARGET && reach.p90 <= P90_TARGET) break;
      const gap = yard > YARD_TARGET ? Math.min(4, ctx.spec.minGap) : ctx.spec.minGap;
      let seed2 = pickSplitInYard(ctx, gap, skip);
      const far = farthestFloor(ctx);
      if (!seed2 && far && far.dist > gap && !skip.has(at7(ctx.cols, far.col, far.row))) {
        seed2 = { col: Math.max(0, far.col - 1), row: Math.max(0, far.row - 1) };
      }
      if (!seed2) break;
      if (stampFamily(ctx, seed2)) continue;
      skip.add(at7(ctx.cols, seed2.col, seed2.row));
      if (far) skip.add(at7(ctx.cols, far.col, far.row));
    }
  }
  function applyStealthDensity(land, walls, cols, rows, paint, keepWood, rng, spec) {
    const ctx = {
      land,
      walls,
      cols,
      rows,
      paint,
      keepWood,
      plaza: new Uint8Array(land.length),
      voidDist: voidDistField(land, cols, rows),
      rng,
      spec
    };
    placeDividers(ctx);
    reservePlaza(ctx);
    fillHoles(ctx);
    placeFlanges(ctx);
    fillHoles(ctx);
  }
  var DIRS45 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  var DIRS8 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];
  function at8(cols, col, row) {
    return row * cols + col;
  }
  function inBounds6(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function isLand(land, cols, rows, col, row) {
    return inBounds6(cols, rows, col, row) && !!land[at8(cols, col, row)];
  }
  function landBBox(land, cols, rows) {
    let minC = cols;
    let minR = rows;
    let maxC = 0;
    let maxR = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!land[at8(cols, col, row)]) continue;
        if (col < minC) minC = col;
        if (row < minR) minR = row;
        if (col > maxC) maxC = col;
        if (row > maxR) maxR = row;
      }
    }
    return { minC, minR, maxC, maxR, width: maxC - minC + 1, height: maxR - minR + 1 };
  }
  function thicken2(spine, land, cols, rows) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const cell of spine) {
      for (const extra of solidRect(cell.col, cell.row, 2, 2, land, cols, rows)) {
        const i = at8(cols, extra.col, extra.row);
        if (seen.has(i)) continue;
        seen.add(i);
        out.push(extra);
      }
    }
    return out;
  }
  function stamp(walls, cells, cols) {
    for (const cell of cells) walls[at8(cols, cell.col, cell.row)] = 1;
  }
  function raiseNear(land, walls, cols, rows, near, radius) {
    const paint = [];
    const seen = /* @__PURE__ */ new Set();
    for (const cell of near) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const col = cell.col + dx;
          const row = cell.row + dy;
          if (!isLand(land, cols, rows, col, row)) continue;
          const i = at8(cols, col, row);
          if (walls[i] || seen.has(i)) continue;
          seen.add(i);
          paint.push({ col, row, role: "debris" });
        }
      }
    }
    return paint;
  }
  function pickLand(land, cols, rows, rng, n, minDist, filter) {
    const all = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!land[at8(cols, col, row)]) continue;
        const cell = { col, row };
        if (filter && !filter(cell)) continue;
        all.push(cell);
      }
    }
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 600 && all.length > 0) {
      const cell = all[rng.nextInt(0, all.length - 1)];
      if (out.some((p) => Math.abs(p.col - cell.col) + Math.abs(p.row - cell.row) < minDist)) continue;
      out.push(cell);
    }
    return out;
  }
  function nearVoid(land, cols, rows, col, row) {
    for (const [dx, dy] of DIRS45) {
      if (!isLand(land, cols, rows, col + dx, row + dy)) return true;
    }
    return false;
  }
  function pickInterior(land, cols, rows, rng, inset = 3) {
    const box = landBBox(land, cols, rows);
    const hits = [];
    const minC = box.minC + inset;
    const maxC = box.maxC - inset;
    const minR = box.minR + inset;
    const maxR = box.maxR - inset;
    for (let row = minR; row <= maxR; row++) {
      for (let col = minC; col <= maxC; col++) {
        if (isLand(land, cols, rows, col, row)) hits.push({ col, row });
      }
    }
    if (hits.length === 0) return pickLand(land, cols, rows, rng, 1, 1)[0] ?? null;
    return hits[rng.nextInt(0, hits.length - 1)];
  }
  function walkLimited(land, cols, rows, start, dx, dy, len, rng, bend) {
    const cells = [];
    const seen = /* @__PURE__ */ new Set();
    let col = start.col;
    let row = start.row;
    let ux = dx;
    let uy = dy;
    const bendAt = bend ? len / 2 | 0 : -1;
    for (let step = 0; step < len; step++) {
      const key = `${col},${row}`;
      if (!seen.has(key) && isLand(land, cols, rows, col, row)) {
        seen.add(key);
        cells.push({ col, row });
      }
      if (step === bendAt) {
        const left = rng.next() < 0.5;
        const nx = left ? -uy : uy;
        const ny = left ? ux : -ux;
        ux = nx;
        uy = ny;
      }
      let nc = col + ux;
      let nr = row + uy;
      if (bend && rng.next() < 0.28) {
        nc += rng.next() < 0.5 ? -uy : uy;
        nr += rng.next() < 0.5 ? ux : -ux;
      }
      if (!isLand(land, cols, rows, nc, nr)) {
        const opts = [];
        for (const [sx, sy] of DIRS8) {
          if (isLand(land, cols, rows, col + sx, row + sy) && !seen.has(`${col + sx},${row + sy}`)) {
            opts.push({ col: col + sx, row: row + sy });
          }
        }
        if (opts.length === 0) break;
        const pick = opts[rng.nextInt(0, opts.length - 1)];
        nc = pick.col;
        nr = pick.row;
      }
      col = nc;
      row = nr;
    }
    return cells;
  }
  function heading(rng) {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ];
    const d = dirs[rng.nextInt(0, dirs.length - 1)];
    return { dx: d[0], dy: d[1] };
  }
  function splitGap(spine, gapAt, gap) {
    return spine.filter((_, i) => i < gapAt || i >= gapAt + gap);
  }
  function solidRect(ox, oy, w, h, land, cols, rows) {
    const cells = [];
    for (let row = oy; row < oy + h; row++) {
      for (let col = ox; col < ox + w; col++) {
        if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
      }
    }
    return cells;
  }
  function buildRidge(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const walls = new Uint8Array(land.length);
    const paint = [];
    const start = pickInterior(land, cols, rows, rng, 4);
    if (!start) return { walls, paint };
    const { dx, dy } = heading(rng);
    const len = rng.nextInt(7, 10);
    const spine = walkLimited(land, cols, rows, start, dx, dy, len, rng, true);
    const gapped = splitGap(spine, Math.max(2, (spine.length / 2 | 0) - 1), 2);
    stamp(walls, thicken2(gapped, land, cols, rows), cols);
    const nugs = 1 + (rng.next() < spec.density ? 1 : 0);
    for (const seed2 of pickLand(land, cols, rows, rng, nugs, 6)) {
      if (Math.abs(seed2.col - start.col) + Math.abs(seed2.row - start.row) > 8) continue;
      stamp(walls, solidRect(seed2.col, seed2.row, rng.nextInt(2, 3), rng.nextInt(2, 3), land, cols, rows), cols);
    }
    paint.push(...raiseNear(land, walls, cols, rows, gapped, 2));
    return { walls, paint };
  }
  function buildShear(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const box = landBBox(land, cols, rows);
    const walls = new Uint8Array(land.length);
    const paint = [];
    const vertical = box.height >= box.width * 0.7;
    const segments = 2 + (spec.density > 0.55 ? 1 : 0);
    const lipLen = rng.nextInt(4, 7);
    const thick = Math.max(2, spec.thickness);
    const gap = thick + 3 + (rng.next() < 0.5 ? 1 : 0);
    const axis0 = vertical ? box.minR + 3 + rng.nextInt(0, Math.max(1, box.height - lipLen - 8)) : box.minC + 3 + rng.nextInt(0, Math.max(1, box.width - lipLen - 8));
    const cross4 = vertical ? box.minC + (box.width / 2 | 0) - (gap / 2 | 0) : box.minR + (box.height / 2 | 0) - (gap / 2 | 0);
    for (let s = 0; s < segments; s++) {
      const stagger = s * (lipLen + 1);
      const along = axis0 + stagger;
      const shift = s % 2 * gap;
      const cells = [];
      for (let k = 0; k < lipLen; k++) {
        for (let t = 0; t < thick; t++) {
          const col = vertical ? cross4 + shift + t : along + k;
          const row = vertical ? along + k : cross4 + shift + t;
          if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
        }
      }
      stamp(walls, cells, cols);
      paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
    }
    return { walls, paint };
  }
  function buildHunks(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const walls = new Uint8Array(land.length);
    const paint = [];
    const n = 3 + (spec.density > 0.6 ? 2 : 1);
    const seeds = pickLand(land, cols, rows, rng, n, 7);
    for (const seed2 of seeds) {
      const w = rng.nextInt(2, 4);
      const h = rng.nextInt(2, 4);
      const cells = solidRect(seed2.col, seed2.row, w, h, land, cols, rows);
      stamp(walls, cells, cols);
      paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
    }
    return { walls, paint };
  }
  function buildRim(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const walls = new Uint8Array(land.length);
    const paint = [];
    const n = 2 + (spec.density > 0.6 ? 1 : 0);
    const seeds = pickLand(land, cols, rows, rng, n, 8, (c) => nearVoid(land, cols, rows, c.col, c.row));
    for (const seed2 of seeds) {
      const alongEdge = [seed2];
      let col = seed2.col;
      let row = seed2.row;
      for (let step = 0; step < rng.nextInt(5, 8); step++) {
        let next = null;
        for (const [dx, dy] of DIRS45) {
          const nc = col + dx;
          const nr = row + dy;
          if (!isLand(land, cols, rows, nc, nr)) continue;
          if (!nearVoid(land, cols, rows, nc, nr)) continue;
          if (alongEdge.some((c) => c.col === nc && c.row === nr)) continue;
          next = { col: nc, row: nr };
          break;
        }
        if (!next) break;
        alongEdge.push(next);
        col = next.col;
        row = next.row;
      }
      stamp(walls, thicken2(alongEdge, land, cols, rows), cols);
      paint.push(...raiseNear(land, walls, cols, rows, alongEdge, 1));
    }
    return { walls, paint };
  }
  function buildOrthoRidge(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const walls = new Uint8Array(land.length);
    const paint = [];
    const start = pickInterior(land, cols, rows, rng, 4);
    if (!start) return { walls, paint };
    const arm = rng.nextInt(4, 6);
    const thick = Math.max(2, spec.thickness);
    const horizFirst = rng.next() < 0.5;
    const sH = rng.next() < 0.5 ? 1 : -1;
    const sV = rng.next() < 0.5 ? 1 : -1;
    const cells = [];
    const addArm = (dx, dy) => {
      for (let k = 0; k < arm; k++) {
        for (let t = 0; t < thick; t++) {
          const col = start.col + dx * k + (dy !== 0 ? t : 0);
          const row = start.row + dy * k + (dx !== 0 ? t : 0);
          if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
        }
      }
    };
    if (horizFirst) {
      addArm(sH, 0);
      addArm(0, sV);
    } else {
      addArm(0, sV);
      addArm(sH, 0);
    }
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
    return { walls, paint };
  }
  function buildTwinRidge(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const box = landBBox(land, cols, rows);
    const walls = new Uint8Array(land.length);
    const paint = [];
    const horiz = box.width >= box.height;
    const len = rng.nextInt(5, 6);
    const thick = Math.max(2, spec.thickness);
    const spacing = 3;
    const cx = box.minC + (box.width / 2 | 0) - ((horiz ? len : thick) / 2 | 0);
    const cy = box.minR + (box.height / 2 | 0) - ((horiz ? thick : len) / 2 | 0);
    const cells = [];
    for (let beam = 0; beam < 2; beam++) {
      const off = beam * (thick + spacing);
      for (let k = 0; k < len; k++) {
        for (let t = 0; t < thick; t++) {
          const col = horiz ? cx + k : cx + off + t;
          const row = horiz ? cy + off + t : cy + k;
          if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
        }
      }
    }
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
    return { walls, paint };
  }
  function buildPlates(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const box = landBBox(land, cols, rows);
    const walls = new Uint8Array(land.length);
    const paint = [];
    const horiz = box.width >= box.height;
    const n = 2 + (spec.density > 0.65 ? 1 : 0);
    const thick = Math.max(2, spec.thickness);
    const spacing = 4;
    for (let i = 0; i < n; i++) {
      const len = rng.nextInt(5, 8);
      const cells = [];
      if (horiz) {
        const row = box.minR + 3 + i * (thick + spacing);
        const start = box.minC + 2 + rng.nextInt(0, 4) + i % 2 * 2;
        for (let k = 0; k < len; k++) {
          for (let w = 0; w < thick; w++) {
            const col = start + k;
            const r = row + w;
            if (isLand(land, cols, rows, col, r)) cells.push({ col, row: r });
          }
        }
      } else {
        const col = box.minC + 3 + i * (thick + spacing);
        const start = box.minR + 2 + rng.nextInt(0, 4) + i % 2 * 2;
        for (let k = 0; k < len; k++) {
          for (let w = 0; w < thick; w++) {
            const c = col + w;
            const row = start + k;
            if (isLand(land, cols, rows, c, row)) cells.push({ col: c, row });
          }
        }
      }
      stamp(walls, cells, cols);
      paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
    }
    return { walls, paint };
  }
  function landInRect(land, cols, rows, minC, minR, w, h) {
    let n = 0;
    for (let row = minR; row < minR + h; row++) {
      for (let col = minC; col < minC + w; col++) {
        if (isLand(land, cols, rows, col, row)) n++;
      }
    }
    return n;
  }
  function buildPads(outline, rng, spec) {
    const { land, cols, rows } = outline;
    const walls = new Uint8Array(land.length);
    const paint = [];
    const want = spec.density > 0.9 ? 2 : 1;
    const placed = [];
    let guard = 0;
    while (placed.length < want && guard++ < 400) {
      const w = rng.nextInt(8, 10);
      const h = rng.nextInt(7, 9);
      const seed2 = pickInterior(land, cols, rows, rng, 3);
      if (!seed2) break;
      const minC = seed2.col - (w / 2 | 0);
      const minR = seed2.row - (h / 2 | 0);
      if (landInRect(land, cols, rows, minC, minR, w, h) < w * h * 0.72) continue;
      if (placed.some((p) => Math.abs(p.col - seed2.col) + Math.abs(p.row - seed2.row) < 10)) continue;
      placed.push(seed2);
      const open = rng.nextInt(0, 3);
      const cells = [];
      const ring = 2;
      for (let row = minR; row < minR + h; row++) {
        for (let col = minC; col < minC + w; col++) {
          if (!isLand(land, cols, rows, col, row)) continue;
          const onN = row < minR + ring;
          const onS = row >= minR + h - ring;
          const onW = col < minC + ring;
          const onE = col >= minC + w - ring;
          const onEdge = onN || onS || onW || onE;
          if (!onEdge) {
            paint.push({ col, row, role: "interior" });
            continue;
          }
          if (open === 0 && onN) continue;
          if (open === 1 && onE) continue;
          if (open === 2 && onS) continue;
          if (open === 3 && onW) continue;
          cells.push({ col, row });
        }
      }
      stamp(walls, cells, cols);
    }
    return { walls, paint };
  }
  function buildStructure(outline, rng, spec) {
    switch (spec.grammar) {
      case "ridge":
        return buildRidge(outline, rng, spec);
      case "shear":
        return buildShear(outline, rng, spec);
      case "hunks":
        return buildHunks(outline, rng, spec);
      case "rim":
        return buildRim(outline, rng, spec);
      case "orthoRidge":
        return buildOrthoRidge(outline, rng, spec);
      case "plates":
        return buildPlates(outline, rng, spec);
      case "twinRidge":
        return buildTwinRidge(outline, rng, spec);
      case "pads":
        return buildPads(outline, rng, spec);
    }
  }
  var MAX_STRUCTURE_ATTEMPTS = 36;
  var ROLE_RANK = {
    glitch: 5,
    stump: 4,
    root: 4,
    wreck: 4,
    organic: 3,
    vegetation: 3,
    debris: 2,
    interior: 1
  };
  var DIRS46 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  function at9(cols, col, row) {
    return row * cols + col;
  }
  function inBounds7(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function mergePaint(into, extra, cols, rows) {
    const best = /* @__PURE__ */ new Map();
    for (const cell of into.concat(extra)) {
      if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) continue;
      const i = at9(cols, cell.col, cell.row);
      const prev = best.get(i);
      if (!prev || ROLE_RANK[cell.role] >= ROLE_RANK[prev.role]) best.set(i, cell);
    }
    into.length = 0;
    for (const cell of best.values()) into.push(cell);
  }
  function floorCells(land, walls, cols, rows) {
    const out = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = at9(cols, col, row);
        if (land[i] && !walls[i]) out.push({ col, row, i });
      }
    }
    return out;
  }
  function nearWall(walls, cols, rows, col, row) {
    for (const [dx, dy] of DIRS46) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds7(cols, rows, nx, ny)) continue;
      if (walls[at9(cols, nx, ny)]) return true;
    }
    return false;
  }
  function nearStump(stumps, col, row) {
    for (const [dx, dy] of DIRS46) {
      if (stumps.has(`${col + dx},${row + dy}`)) return true;
    }
    return stumps.has(`${col},${row}`);
  }
  function nearVoid2(land, cols, rows, col, row) {
    for (const [dx, dy] of DIRS46) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds7(cols, rows, nx, ny) || !land[at9(cols, nx, ny)]) return true;
    }
    return false;
  }
  function scatterPaint(land, walls, cols, rows, recipe, rng, stumps) {
    const paint = [];
    const floors = floorCells(land, walls, cols, rows);
    const kind = recipe.scatter.kind;
    for (const cell of floors) {
      const rim = nearVoid2(land, cols, rows, cell.col, cell.row);
      const wall = nearWall(walls, cols, rows, cell.col, cell.row);
      const byStump = nearStump(stumps, cell.col, cell.row);
      let vegChance = recipe.scatter.vegetation;
      if (kind === "none") vegChance = 0;
      if (kind === "rimMoss") vegChance = rim ? recipe.scatter.vegetation : recipe.scatter.vegetation * 0.15;
      if (kind === "thicket") vegChance = wall ? recipe.scatter.vegetation * 1.6 : recipe.scatter.vegetation * 0.35;
      if (kind === "aisleLitter") vegChance = wall ? recipe.scatter.vegetation : 0;
      if (kind === "grassPads") vegChance = wall ? recipe.scatter.vegetation * 0.4 : recipe.scatter.vegetation;
      if (byStump) vegChance *= 0.08;
      if (vegChance > 0 && rng.next() < vegChance) {
        paint.push({ col: cell.col, row: cell.row, role: "vegetation" });
      }
      let wreckChance = recipe.scatter.wreck;
      if (kind === "aisleLitter") wreckChance = wall ? recipe.scatter.wreck * 1.4 : recipe.scatter.wreck;
      if (kind === "grassPads") wreckChance = wall ? 0 : recipe.scatter.wreck;
      if (wreckChance > 0 && rng.next() < wreckChance) {
        paint.push({ col: cell.col, row: cell.row, role: "wreck" });
      }
    }
    const glitchWant = recipe.scatter.glitch;
    const candidates = floors.filter((c) => nearWall(walls, cols, rows, c.col, c.row));
    const pool = candidates.length > 0 ? candidates : floors;
    const used = /* @__PURE__ */ new Set();
    let guard = 0;
    while (used.size < glitchWant && guard++ < 80 && pool.length > 0) {
      const cell = pool[rng.nextInt(0, pool.length - 1)];
      if (used.has(cell.i)) continue;
      used.add(cell.i);
      paint.push({ col: cell.col, row: cell.row, role: "glitch" });
    }
    return paint;
  }
  function toTileMap2(land, walls, cols, rows, tileSize) {
    const tiles = [];
    for (let row = 0; row < rows; row++) {
      const line = [];
      for (let col = 0; col < cols; col++) {
        const i = at9(cols, col, row);
        if (!land[i]) line.push(
          3
          /* VOID */
        );
        else if (walls[i]) line.push(
          0
          /* WALL */
        );
        else line.push(
          1
          /* FLOOR */
        );
      }
      tiles.push(line);
    }
    return { cols, rows, tileSize, tiles };
  }
  function generateRecipeDraft(seed2, recipe) {
    const base = generateOutline(seed2);
    const cols = base.cols;
    const rows = base.rows;
    const land = new Uint8Array(base.land);
    const { scatterRng, atmosphereRng } = forkMapRngs(seed2, recipe.id);
    let walls = new Uint8Array(land.length);
    let structurePaint = [];
    let attempt = 0;
    let ok = false;
    let lastWhy = "no attempt";
    for (; attempt < MAX_STRUCTURE_ATTEMPTS; attempt++) {
      land.set(base.land);
      const forked = forkMapRngs(seed2, recipe.id, attempt);
      const built = buildStructure({ ...base, land }, forked.structureRng, recipe.structure);
      walls = new Uint8Array(built.walls);
      structurePaint = built.paint;
      openSealedFloors(land, walls, cols, rows);
      if (countWalkableComponents(land, walls, cols, rows) !== 1) {
        lastWhy = "structure walkable != 1";
        continue;
      }
      const coverPaint = applyCover(land, walls, cols, rows, recipe.cover, forked.coverRng);
      for (let i = 0; i < walls.length; i++) if (!land[i]) walls[i] = 0;
      const keepWood = new Uint8Array(walls.length);
      for (const cell of coverPaint) {
        if (cell.role !== "stump" && cell.role !== "root") continue;
        keepWood[at9(cols, cell.col, cell.row)] = 1;
      }
      openSealedFloors(land, walls, cols, rows, keepWood);
      if (countWalkableComponents(land, walls, cols, rows) !== 1) {
        lastWhy = "cover walkable != 1";
        continue;
      }
      if (stumpTouchesStone(walls, cols, rows, coverPaint)) {
        lastWhy = "stump touches stone";
        continue;
      }
      if (recipe.cover.trees >= 1 && countBoles(coverPaint, walls, cols) < 1) {
        lastWhy = "missing bole";
        continue;
      }
      const painted = structurePaint.concat(coverPaint);
      const spec = stealthSpecFor(recipe);
      applyStealthDensity(
        land,
        walls,
        cols,
        rows,
        painted,
        keepWood,
        forked.densityRng,
        spec
      );
      for (let i = 0; i < walls.length; i++) if (!land[i]) walls[i] = 0;
      openSealedFloors(land, walls, cols, rows, keepWood);
      if (countWalkableComponents(land, walls, cols, rows) !== 1) {
        lastWhy = "density walkable != 1";
        continue;
      }
      if (stumpTouchesStone(walls, cols, rows, coverPaint)) {
        lastWhy = "stump touches stone after density";
        continue;
      }
      const sil = measureSilhouette(land, walls, cols, rows, painted);
      const silFail = silhouetteFails(sil);
      if (silFail) {
        lastWhy = silFail;
        continue;
      }
      const reach = measureCoverReach(land, walls, cols, rows, painted);
      const yardNow = maxOpenYard(land, walls, cols, rows);
      const reachFail = coverReachFails(reach, yardNow, spec.rimRing);
      if (reachFail) {
        lastWhy = reachFail;
        continue;
      }
      structurePaint = painted;
      ok = true;
      break;
    }
    const label = `generateRecipeDraft ${recipe.id} seed ${seed2}`;
    if (!ok) {
      throw new Error(`${label}: no connected structure after ${MAX_STRUCTURE_ATTEMPTS} attempts (${lastWhy})`);
    }
    assertSingleWalkable(land, walls, cols, rows, label);
    const paint = structurePaint.filter((c) => {
      const i = at9(cols, c.col, c.row);
      if (!land[i]) return false;
      if (walls[i]) return c.role === "stump" || c.role === "root";
      return true;
    });
    mergePaint(
      paint,
      scatterPaint(
        land,
        walls,
        cols,
        rows,
        recipe,
        scatterRng,
        new Set(
          paint.filter((c) => c.role === "stump" || c.role === "root").map((c) => `${c.col},${c.row}`)
        )
      ),
      cols,
      rows
    );
    const glitches = paint.filter((c) => c.role === "glitch");
    const atmosphere = buildAtmosphere(
      land,
      walls,
      cols,
      rows,
      recipe.atmosphere,
      glitches,
      atmosphereRng
    );
    let wallCount2 = 0;
    let landCount2 = 0;
    for (let i = 0; i < land.length; i++) {
      if (land[i]) landCount2++;
      if (walls[i]) wallCount2++;
    }
    const tileMap = toTileMap2(land, walls, cols, rows, base.tileSize);
    return {
      seed: seed2,
      attempt,
      fragmentTypeId: recipe.fragmentTypeId,
      outline: { ...base, land, tileMap },
      walls,
      features: [{ kind: "ridge", cells: [], paint }],
      tileMap,
      metrics: {
        wallCount: wallCount2,
        wallRatio: landCount2 === 0 ? 0 : wallCount2 / landCount2,
        featureCount: 1,
        leftoverConnected: leftoverDisconnectedCount(land, walls, cols, rows) === 0
      },
      overlays: atmosphere.motes,
      atmosphere
    };
  }
  var DIRS47 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  var DUAL_PATH_MIN_LENGTH_RATIO = 1.15;
  function at10(cols, col, row) {
    return row * cols + col;
  }
  function inBounds8(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function bfs(walk, cols, rows, start) {
    const dist = new Int32Array(walk.length).fill(-1);
    const parent = new Int32Array(walk.length).fill(-1);
    if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
    const queue = [start];
    dist[start] = 0;
    let q = 0;
    while (q < queue.length) {
      const cur = queue[q++];
      const col = cur % cols;
      const row = cur / cols | 0;
      const d = dist[cur];
      for (const [dx, dy] of DIRS47) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds8(cols, rows, nx, ny)) continue;
        const ni = at10(cols, nx, ny);
        if (!walk[ni] || dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        parent[ni] = cur;
        queue.push(ni);
      }
    }
    return { dist, parent };
  }
  function reconstruct(parent, start, goal) {
    if (goal < 0 || parent[goal] === void 0) return [];
    const path = [];
    let cur = goal;
    const guard = parent.length + 2;
    let n = 0;
    while (cur !== start && cur >= 0 && n++ < guard) {
      path.push(cur);
      cur = parent[cur];
    }
    if (cur !== start) return [];
    path.push(start);
    path.reverse();
    return path;
  }
  function wallNeighborCount(walls, cols, rows, cell) {
    const col = cell % cols;
    const row = cell / cols | 0;
    let n = 0;
    for (const [dx, dy] of DIRS47) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds8(cols, rows, nx, ny)) continue;
      if (walls[at10(cols, nx, ny)]) n++;
    }
    return n;
  }
  function openRatio(path, walls, cols, rows) {
    if (path.length === 0) return 0;
    let open = 0;
    for (const cell of path) {
      if (wallNeighborCount(walls, cols, rows, cell) <= 1) open++;
    }
    return open / path.length;
  }
  function fail(reason, extra) {
    return {
      ok: false,
      reason,
      mainSteps: extra?.mainSteps ?? -1,
      altSteps: extra?.altSteps ?? -1,
      mainOpenRatio: extra?.mainOpenRatio ?? 0,
      altOpenRatio: extra?.altOpenRatio ?? 0
    };
  }
  function evaluateDualPath(walk, walls, cols, rows, spawn, extract) {
    if (spawn === extract) return fail("no dual-path");
    if (spawn < 0 || extract < 0 || spawn >= walk.length || extract >= walk.length) {
      return fail("no dual-path");
    }
    if (!walk[spawn] || !walk[extract]) return fail("no dual-path");
    const mainSearch = bfs(walk, cols, rows, spawn);
    const mainSteps = mainSearch.dist[extract];
    if (mainSteps < 0) return fail("no dual-path");
    const mainPath = reconstruct(mainSearch.parent, spawn, extract);
    if (mainPath.length < 2) return fail("no dual-path", { mainSteps });
    const blocked = new Uint8Array(walk);
    for (const cell of mainPath) {
      if (cell !== spawn && cell !== extract) blocked[cell] = 0;
    }
    const altSearch = bfs(blocked, cols, rows, spawn);
    const altSteps = altSearch.dist[extract];
    if (altSteps < 0) return fail("no dual-path", { mainSteps });
    const altPath = reconstruct(altSearch.parent, spawn, extract);
    if (altPath.length < 2) return fail("no dual-path", { mainSteps, altSteps });
    if (altSteps < mainSteps * DUAL_PATH_MIN_LENGTH_RATIO) {
      return fail("no dual-path", { mainSteps, altSteps });
    }
    const mainOpenRatio = openRatio(mainPath, walls, cols, rows);
    const altOpenRatio = openRatio(altPath, walls, cols, rows);
    const mainIsShorter = mainSteps <= altSteps;
    const shortOpen = mainIsShorter ? mainOpenRatio : altOpenRatio;
    const longOpen = mainIsShorter ? altOpenRatio : mainOpenRatio;
    if (!(shortOpen > longOpen)) {
      return fail("no dual-path", { mainSteps, altSteps, mainOpenRatio, altOpenRatio });
    }
    return {
      ok: true,
      reason: "",
      mainSteps,
      altSteps,
      mainOpenRatio,
      altOpenRatio
    };
  }
  var PREVIEW_RECIPES = [
    {
      id: "ridge-soil",
      label: "\u541E\u6CA1\u8936\u810A",
      fragmentTypeId: "frag-outdoor",
      structure: { grammar: "ridge", density: 0.55, gapiness: 0.45, thickness: 2, align: "free" },
      cover: { align: "free", trees: 2, remains: 2, hollows: 1, cuts: 2, cycle: ["clump", "plate"] },
      scatter: { kind: "thicket", vegetation: 0.12, wreck: 0.04, glitch: 2 },
      atmosphere: { skyShadow: 0.68, fog: 0.82, motes: 36, seep: 0.28, poolRim: 0.35, poolHollow: 0.25, poolOpen: 0.4 }
    },
    {
      id: "shear-soil",
      label: "\u571F\u58E4\u6495\u7F1D",
      fragmentTypeId: "frag-outdoor",
      structure: { grammar: "shear", density: 0.5, gapiness: 0.4, thickness: 2, align: "free" },
      cover: { align: "free", trees: 1, remains: 2, hollows: 2, cuts: 2, cycle: ["clump", "plate"] },
      scatter: { kind: "thicket", vegetation: 0.1, wreck: 0.03, glitch: 3 },
      atmosphere: { skyShadow: 0.72, fog: 0.76, motes: 28, seep: 0.38, poolRim: 0.28, poolHollow: 0.5, poolOpen: 0.22 }
    },
    {
      id: "hunks-soil",
      label: "\u56ED\u7F18\u6B8B\u4F53",
      fragmentTypeId: "frag-outdoor",
      structure: { grammar: "hunks", density: 0.7, gapiness: 0.5, thickness: 2, align: "free" },
      cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ["clump"] },
      scatter: { kind: "thicket", vegetation: 0.08, wreck: 0.07, glitch: 1 },
      atmosphere: { skyShadow: 0.58, fog: 0.7, motes: 24, seep: 0.22, poolRim: 0.42, poolHollow: 0.28, poolOpen: 0.3 }
    },
    {
      id: "rim-soil",
      label: "\u6CBF\u7F18\u6B8B\u4F53",
      fragmentTypeId: "frag-outdoor",
      structure: { grammar: "rim", density: 0.8, gapiness: 0.4, thickness: 2, align: "free" },
      cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ["clump"] },
      scatter: { kind: "rimMoss", vegetation: 0.14, wreck: 0.05, glitch: 2 },
      atmosphere: { skyShadow: 0.64, fog: 0.92, motes: 32, seep: 0.32, poolRim: 0.7, poolHollow: 0.2, poolOpen: 0.1 }
    },
    {
      id: "ridge-clinic",
      label: "\u65E0\u83CC\u6298\u810A",
      fragmentTypeId: "frag-clinic",
      structure: { grammar: "orthoRidge", density: 0.75, gapiness: 0.28, thickness: 2, align: "free" },
      cover: { align: "free", trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ["clump", "plate"] },
      scatter: { kind: "none", vegetation: 0, wreck: 0.03, glitch: 2 },
      atmosphere: { skyShadow: 0.82, fog: 0.16, motes: 6, seep: 0.22, poolRim: 0.2, poolHollow: 0.15, poolOpen: 0.65 }
    },
    {
      id: "shear-clinic",
      label: "\u74F7\u9762\u9519\u4F4D",
      fragmentTypeId: "frag-clinic",
      structure: { grammar: "shear", density: 0.55, gapiness: 0.28, thickness: 2, align: "free" },
      cover: { align: "free", trees: 0, remains: 2, hollows: 2, cuts: 2, cycle: ["clump"] },
      scatter: { kind: "none", vegetation: 0, wreck: 0.05, glitch: 3 },
      atmosphere: { skyShadow: 0.78, fog: 0.2, motes: 8, seep: 0.36, poolRim: 0.18, poolHollow: 0.22, poolOpen: 0.6 }
    },
    {
      id: "shear-metro",
      label: "\u9508\u677F\u6495\u7F1D",
      fragmentTypeId: "frag-metro",
      structure: { grammar: "shear", density: 0.55, gapiness: 0.4, thickness: 2, align: "free" },
      cover: { align: "free", trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ["plate", "clump"] },
      scatter: { kind: "none", vegetation: 0, wreck: 0.06, glitch: 3 },
      atmosphere: { skyShadow: 0.52, fog: 0.24, motes: 18, seep: 0.88, poolRim: 0.25, poolHollow: 0.2, poolOpen: 0.55 }
    },
    {
      id: "hunks-metro",
      label: "\u5D4C\u677F\u6B8B\u4F53",
      fragmentTypeId: "frag-metro",
      structure: { grammar: "plates", density: 0.7, gapiness: 0.35, thickness: 2, align: "free" },
      cover: { align: "free", trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ["plate", "clump"] },
      scatter: { kind: "none", vegetation: 0, wreck: 0.08, glitch: 1 },
      atmosphere: { skyShadow: 0.42, fog: 0.2, motes: 12, seep: 0.48, poolRim: 0.22, poolHollow: 0.18, poolOpen: 0.6 }
    },
    {
      id: "ridge-library",
      label: "\u65AD\u6881\u6B8B\u810A",
      fragmentTypeId: "frag-library",
      structure: { grammar: "twinRidge", density: 0.7, gapiness: 0.35, thickness: 2, align: "free" },
      cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ["clump"] },
      scatter: { kind: "aisleLitter", vegetation: 0.04, wreck: 0.06, glitch: 2 },
      atmosphere: { skyShadow: 0.6, fog: 0.56, motes: 22, seep: 0.26, poolRim: 0.3, poolHollow: 0.25, poolOpen: 0.45 }
    },
    {
      id: "hunks-residential",
      label: "\u5B85\u57FA\u6B8B\u4F53",
      fragmentTypeId: "frag-residential",
      structure: { grammar: "pads", density: 0.8, gapiness: 0.35, thickness: 2, align: "free" },
      cover: { align: "free", trees: 1, remains: 2, hollows: 1, cuts: 1, cycle: ["clump"] },
      scatter: { kind: "grassPads", vegetation: 0.09, wreck: 0.08, glitch: 2 },
      atmosphere: { skyShadow: 0.55, fog: 0.66, motes: 18, seep: 0.22, poolRim: 0.38, poolHollow: 0.22, poolOpen: 0.4 }
    }
  ];
  function recipeById(id) {
    const hit = PREVIEW_RECIPES.find((r) => r.id === id);
    if (!hit) throw new Error(`unknown recipe ${id}`);
    return hit;
  }
  var NEIGHBORHOOD = 0.3;
  function jitterScalar(rng, value, min = 0, max = 1) {
    const scaled = value * (1 - NEIGHBORHOOD + rng.next() * 2 * NEIGHBORHOOD);
    return scaled < min ? min : scaled > max ? max : scaled;
  }
  function jitterCount(rng, value, min, max) {
    const n = Math.round(jitterScalar(rng, value, min, max));
    return n < min ? min : n > max ? max : n;
  }
  function jitterRecipe(anchor, seed2) {
    const rng = new SeededRandom2(mix322(seed2, `jitter:${anchor.id}`));
    return {
      ...anchor,
      structure: {
        ...anchor.structure,
        density: jitterScalar(rng, anchor.structure.density),
        gapiness: jitterScalar(rng, anchor.structure.gapiness)
      },
      cover: {
        ...anchor.cover,
        trees: anchor.cover.trees === 0 ? 0 : jitterCount(rng, anchor.cover.trees, 1, 3),
        remains: jitterCount(rng, anchor.cover.remains, 1, 4),
        hollows: jitterCount(rng, anchor.cover.hollows, 0, 3),
        cuts: jitterCount(rng, anchor.cover.cuts, 0, 4)
      },
      scatter: {
        ...anchor.scatter,
        vegetation: jitterScalar(rng, anchor.scatter.vegetation),
        wreck: jitterScalar(rng, anchor.scatter.wreck),
        glitch: jitterCount(rng, anchor.scatter.glitch, 0, 6)
      },
      atmosphere: {
        skyShadow: jitterScalar(rng, anchor.atmosphere.skyShadow),
        fog: jitterScalar(rng, anchor.atmosphere.fog),
        motes: jitterCount(rng, anchor.atmosphere.motes, 0, 48),
        seep: jitterScalar(rng, anchor.atmosphere.seep),
        poolRim: jitterScalar(rng, anchor.atmosphere.poolRim),
        poolHollow: jitterScalar(rng, anchor.atmosphere.poolHollow),
        poolOpen: jitterScalar(rng, anchor.atmosphere.poolOpen)
      }
    };
  }
  var BODY_PROFILE_DATA3 = {
    "insect_remnant": {
      "moveScale": 1,
      "windupMs": 350,
      "cooldownMs": 1200,
      "rangePx": 38,
      "halfAngleDeg": 60
    },
    "human_remnant": {
      "moveScale": 1,
      "windupMs": 350,
      "cooldownMs": 1200,
      "rangePx": 38,
      "halfAngleDeg": 60
    },
    "mammal_remnant": {
      "moveScale": 1.1,
      "windupMs": 550,
      "cooldownMs": 1400,
      "rangePx": 38,
      "halfAngleDeg": 35
    },
    "worm_remnant": {
      "moveScale": 0.6,
      "windupMs": 650,
      "cooldownMs": 1500,
      "rangePx": 38,
      "halfAngleDeg": 25
    },
    "organic_remnant": {
      "moveScale": 0.7,
      "windupMs": 700,
      "cooldownMs": 1600,
      "rangePx": 36,
      "halfAngleDeg": 75
    },
    "stalk_clump": {
      "moveScale": 0.5,
      "windupMs": 750,
      "cooldownMs": 1750,
      "rangePx": 36,
      "halfAngleDeg": 80
    },
    "street_wreckage": {
      "moveScale": 0,
      "windupMs": 800,
      "cooldownMs": 1800,
      "rangePx": 38,
      "halfAngleDeg": 80
    }
  };
  var SAMPLE_STEP = 4;
  var EPSILON3 = 1e-3;
  var PLAYER_HALF2 = GAME_CONSTANTS3.PLAYER.BODY_SIZE / 2;
  var BODY_CLEARANCE2 = PLAYER_HALF2 + GAME_CONSTANTS3.AI.BODY_SIZE / 2;
  var STATIC_SUBSTRATES2 = Object.keys(BODY_PROFILE_DATA3).filter((id) => BODY_PROFILE_DATA3[id].moveScale === 0);
  function isStaticFloorBody(spawn) {
    return spawn.form?.occupancy === "floor" && BODY_PROFILE_DATA3[spawn.form.substrate]?.moveScale === 0;
  }
  function checkStaticBodyAccess(input) {
    const bodies = input.enemySpawns.filter(isStaticFloorBody);
    if (bodies.length === 0) return { reachable: true, blockedTargetIds: [], sampledPositions: 0 };
    const { grid, spawnPoint, targets } = input;
    const tile = grid.tileSize;
    if (tile < GAME_CONSTANTS3.PLAYER.BODY_SIZE || tile % SAMPLE_STEP !== 0) {
      throw new Error("Static body access requires tiles at least player-sized and aligned to navigation samples");
    }
    const width = grid.cols * tile / SAMPLE_STEP + 1;
    const height = grid.rows * tile / SAMPLE_STEP + 1;
    const free = new Uint8Array(width * height);
    const reached = new Uint8Array(free.length);
    const queue = new Int32Array(free.length);
    for (let row = 0; row < height; row++) {
      const y = row * SAMPLE_STEP;
      for (let col = 0; col < width; col++) {
        const x = col * SAMPLE_STEP;
        const left = Math.floor((x - PLAYER_HALF2 + EPSILON3) / tile);
        const right = Math.floor((x + PLAYER_HALF2 - EPSILON3) / tile);
        const top = Math.floor((y - PLAYER_HALF2 + EPSILON3) / tile);
        const bottom = Math.floor((y + PLAYER_HALF2 - EPSILON3) / tile);
        if (!grid.isWalkable(left, top) || !grid.isWalkable(right, top) || !grid.isWalkable(left, bottom) || !grid.isWalkable(right, bottom)) continue;
        let blocked = false;
        for (const body of bodies) {
          const bx = (body.spawn.col + 0.5) * tile;
          const by = (body.spawn.row + 0.5) * tile;
          if (Math.abs(x - bx) < BODY_CLEARANCE2 - EPSILON3 && Math.abs(y - by) < BODY_CLEARANCE2 - EPSILON3) {
            blocked = true;
            break;
          }
        }
        if (!blocked) free[row * width + col] = 1;
      }
    }
    const startCol = spawnPoint.x / SAMPLE_STEP, startRow = spawnPoint.y / SAMPLE_STEP;
    const start = startRow * width + startCol;
    if (!Number.isInteger(startCol) || !Number.isInteger(startRow) || !free[start]) {
      return { reachable: false, blockedTargetIds: targets.map((target) => target.id), sampledPositions: free.length };
    }
    let head = 0, tail = 1;
    queue[0] = start;
    reached[start] = 1;
    const enqueue = (index) => {
      if (index >= 0 && index < free.length && free[index] && !reached[index]) {
        reached[index] = 1;
        queue[tail++] = index;
      }
    };
    while (head < tail) {
      const index = queue[head++];
      const col = index % width;
      if (col > 0) enqueue(index - 1);
      if (col + 1 < width) enqueue(index + 1);
      enqueue(index - width);
      enqueue(index + width);
    }
    const blockedTargetIds = [];
    for (const target of targets) {
      let reachable = false;
      const minCol = Math.max(0, Math.ceil((target.position.x - target.radius) / SAMPLE_STEP));
      const maxCol = Math.min(width - 1, Math.floor((target.position.x + target.radius) / SAMPLE_STEP));
      const minRow = Math.max(0, Math.ceil((target.position.y - target.radius) / SAMPLE_STEP));
      const maxRow = Math.min(height - 1, Math.floor((target.position.y + target.radius) / SAMPLE_STEP));
      for (let row = minRow; row <= maxRow && !reachable; row++) for (let col = minCol; col <= maxCol && !reachable; col++) {
        if (reached[row * width + col] && (col * SAMPLE_STEP - target.position.x) ** 2 + (row * SAMPLE_STEP - target.position.y) ** 2 <= target.radius ** 2) reachable = true;
      }
      if (!reachable) blockedTargetIds.push(target.id);
    }
    return { reachable: blockedTargetIds.length === 0, blockedTargetIds, sampledPositions: free.length };
  }
  function ensureStaticBodyAccess(input, rng, fragmentTypeId) {
    if (checkStaticBodyAccess(input).reachable) return input.enemySpawns;
    const corrected = [...input.enemySpawns];
    for (let i = 0; i < corrected.length; i++) {
      const spawn = corrected[i];
      if (!isStaticFloorBody(spawn)) continue;
      const previous = spawn.form;
      const options = {
        portfolio: previous.portfolio,
        fragmentTypeId,
        coverage: previous.coverage,
        sense: previous.lexemes.sense,
        rhythm: previous.lexemes.rhythm,
        forbidSubstrate: STATIC_SUBSTRATES2
      };
      const form = drawOne(rng, { ...options, forbidMotion: ["motion_patrol"] }) ?? drawOne(rng, { ...options, motion: "motion_patrol" });
      if (!form) return null;
      corrected[i] = { ...spawn, form };
      if (checkStaticBodyAccess({ ...input, enemySpawns: corrected }).reachable) return corrected;
    }
    return null;
  }
  var DIRS48 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  function at11(cols, col, row) {
    return row * cols + col;
  }
  function inBounds9(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function isFloor4(map, col, row) {
    return map.tiles[row]?.[col] === 1;
  }
  function isWall(map, col, row) {
    return map.tiles[row]?.[col] === 0;
  }
  function collectWallEdges(map) {
    const { cols, rows } = map;
    const edge = [];
    const strike = /* @__PURE__ */ new Map();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!isWall(map, col, row)) continue;
        const floors = [];
        for (const [dx, dy] of DIRS48) {
          const nc = col + dx;
          const nr = row + dy;
          if (!inBounds9(cols, rows, nc, nr) || !isFloor4(map, nc, nr)) continue;
          floors.push({ col: nc, row: nr });
        }
        if (floors.length === 0) continue;
        const i = at11(cols, col, row);
        edge.push(i);
        const set = /* @__PURE__ */ new Set();
        for (const f of floors) set.add(`${f.col},${f.row}`);
        strike.set(i, set);
      }
    }
    const seen = /* @__PURE__ */ new Set();
    const lines = [];
    const edgeSet = new Set(edge);
    for (const start of edge) {
      if (seen.has(start)) continue;
      const stack = [start];
      seen.add(start);
      const tiles = [];
      const floors = /* @__PURE__ */ new Set();
      while (stack.length > 0) {
        const cur = stack.pop();
        const col = cur % cols;
        const row = cur / cols | 0;
        tiles.push({ col, row });
        for (const key of strike.get(cur) ?? []) floors.add(key);
        for (const [dx, dy] of DIRS48) {
          const nc = col + dx;
          const nr = row + dy;
          if (!inBounds9(cols, rows, nc, nr)) continue;
          const ni = at11(cols, nc, nr);
          if (!edgeSet.has(ni) || seen.has(ni)) continue;
          seen.add(ni);
          stack.push(ni);
        }
      }
      if (tiles.length === 0 || floors.size === 0) continue;
      lines.push({
        tiles,
        strikeFloors: [...floors].map((key) => {
          const [c, r] = key.split(",");
          return { col: Number(c), row: Number(r) };
        })
      });
    }
    lines.sort((a, b) => b.tiles.length - a.tiles.length);
    return lines;
  }
  function spanAlong(map, col, row, dx, dy) {
    const { cols, rows } = map;
    let n = 0;
    let c = col + dx;
    let r = row + dy;
    while (inBounds9(cols, rows, c, r) && isFloor4(map, c, r) && n < 12) {
      n++;
      c += dx;
      r += dy;
    }
    return n;
  }
  function collectCorridors(map) {
    const { cols, rows } = map;
    const tile = map.tileSize;
    const mark = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!isFloor4(map, col, row)) continue;
        const xSpan = 1 + spanAlong(map, col, row, 1, 0) + spanAlong(map, col, row, -1, 0);
        const ySpan = 1 + spanAlong(map, col, row, 0, 1) + spanAlong(map, col, row, 0, -1);
        if (Math.min(xSpan, ySpan) <= 4 && Math.max(xSpan, ySpan) >= 3) {
          mark[at11(cols, col, row)] = 1;
        }
      }
    }
    const seen = new Uint8Array(cols * rows);
    const boxes = [];
    for (let i = 0; i < mark.length; i++) {
      if (!mark[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
      let minCol = cols;
      let minRow = rows;
      let maxCol = 0;
      let maxRow = 0;
      let sumC = 0;
      let sumR = 0;
      let n = 0;
      const cells = [];
      while (stack.length > 0) {
        const cur = stack.pop();
        const col = cur % cols;
        const row = cur / cols | 0;
        cells.push(cur);
        n++;
        sumC += col;
        sumR += row;
        if (col < minCol) minCol = col;
        if (row < minRow) minRow = row;
        if (col > maxCol) maxCol = col;
        if (row > maxRow) maxRow = row;
        for (const [dx, dy] of DIRS48) {
          const nc = col + dx;
          const nr = row + dy;
          if (!inBounds9(cols, rows, nc, nr)) continue;
          const ni = at11(cols, nc, nr);
          if (!mark[ni] || seen[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (n < 6) continue;
      const width = maxCol - minCol + 1;
      const height = maxRow - minRow + 1;
      if (Math.min(width, height) > 5) continue;
      const cx = Math.round(sumC / n);
      const cy = Math.round(sumR / n);
      let core = at11(cols, cx, cy);
      if (!mark[core]) core = cells[0];
      boxes.push({
        minCol,
        minRow,
        maxCol,
        maxRow,
        coreCol: core % cols,
        coreRow: core / cols | 0
      });
    }
    boxes.sort((a, b) => {
      const aa = (a.maxCol - a.minCol + 1) * (a.maxRow - a.minRow + 1);
      const bb = (b.maxCol - b.minCol + 1) * (b.maxRow - b.minRow + 1);
      return bb - aa;
    });
    return boxes.slice(0, 8);
  }
  var PAINT_PINS_SHORT = "paint pins short";
  function paintHostSpacingLadder(paintCount) {
    return paintCount >= 9 ? [5, 4, 3] : [6, 4, 3];
  }
  function chebyshevCells(aCol, aRow, bCol, bRow) {
    return Math.max(Math.abs(aCol - bCol), Math.abs(aRow - bRow));
  }
  function walkBits(map) {
    const { cols, rows } = map;
    const walk = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (isFloor4(map, col, row)) walk[at11(cols, col, row)] = 1;
      }
    }
    return walk;
  }
  function neighborWalkCount(walk, cols, rows, col, row) {
    let n = 0;
    for (const [dx, dy] of DIRS48) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds9(cols, rows, nc, nr)) continue;
      if (walk[at11(cols, nc, nr)]) n++;
    }
    return n;
  }
  function bfsFrom(walk, cols, rows, start) {
    const dist = new Int16Array(walk.length);
    const parent = new Int32Array(walk.length);
    dist.fill(-1);
    parent.fill(-1);
    if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
    const queue = [start];
    dist[start] = 0;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const col = cur % cols;
      const row = cur / cols | 0;
      const d = dist[cur];
      for (const [dx, dy] of DIRS48) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds9(cols, rows, nc, nr)) continue;
        const ni = at11(cols, nc, nr);
        if (!walk[ni] || dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        parent[ni] = cur;
        queue.push(ni);
      }
    }
    return { dist, parent };
  }
  function reconstructPath(parent, start, goal) {
    if (goal < 0 || parent[goal] === void 0) return [];
    if (goal !== start && parent[goal] < 0) return [];
    const path = [];
    let cur = goal;
    while (cur >= 0) {
      path.push(cur);
      if (cur === start) break;
      cur = parent[cur];
    }
    if (path[path.length - 1] !== start) return [];
    path.reverse();
    return path;
  }
  function greedyKindlingCells(walk, cols, rows, spawn, extract, kindling) {
    const { parent } = bfsFrom(walk, cols, rows, spawn);
    const cells = /* @__PURE__ */ new Set();
    const take = (goal) => {
      for (const cell of reconstructPath(parent, spawn, goal)) cells.add(cell);
    };
    take(extract);
    for (const node of kindling) {
      if (node.tier !== "contested" && node.tier !== "deep") continue;
      if (!inBounds9(cols, rows, node.col, node.row)) continue;
      take(at11(cols, node.col, node.row));
    }
    return cells;
  }
  function isBannedPaintSeat(col, row, spawnCol, spawnRow, extractCol, extractRow, kindlingCells, cols) {
    if (chebyshevCells(col, row, spawnCol, spawnRow) <= 3) return true;
    if (chebyshevCells(col, row, extractCol, extractRow) <= 3) return true;
    return kindlingCells.has(at11(cols, col, row));
  }
  function rankSeats(cells, walk, cols, rows, greedy, dist, banned) {
    const seats = [];
    const seen = /* @__PURE__ */ new Set();
    for (const cell of cells) {
      if (seen.has(cell) || !walk[cell]) continue;
      seen.add(cell);
      const col = cell % cols;
      const row = cell / cols | 0;
      if (banned(col, row)) continue;
      const neighbors = neighborWalkCount(walk, cols, rows, col, row);
      seats.push({
        cell,
        col,
        row,
        onGreedy: greedy.has(cell),
        throatScore: 4 - neighbors,
        neighbors,
        dist: dist[cell]
      });
    }
    seats.sort((a, b) => {
      const throatA = a.neighbors === 2 ? 1 : 0;
      const throatB = b.neighbors === 2 ? 1 : 0;
      if (throatB !== throatA) return throatB - throatA;
      if (a.dist !== b.dist) return a.dist - b.dist;
      if (b.throatScore !== a.throatScore) return b.throatScore - a.throatScore;
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    return seats;
  }
  function pickSpaced(seats, count, minChebyshev) {
    const picked = [];
    for (const seat of seats) {
      let ok = true;
      for (const other of picked) {
        if (chebyshevCells(seat.col, seat.row, other.col, other.row) < minChebyshev) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      picked.push(seat);
      if (picked.length === count) return picked;
    }
    return null;
  }
  function ringAround(cells, walk, cols, rows, radius) {
    const out = /* @__PURE__ */ new Set();
    for (const cell of cells) {
      const col = cell % cols;
      const row = cell / cols | 0;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) > radius) continue;
          const nc = col + dc;
          const nr = row + dr;
          if (!inBounds9(cols, rows, nc, nr)) continue;
          const ni = at11(cols, nc, nr);
          if (walk[ni]) out.add(ni);
        }
      }
    }
    return out;
  }
  function reachableFloors(dist) {
    const out = [];
    for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) out.push(i);
    return out;
  }
  function toPins(seats) {
    return seats.map((seat) => ({
      floorCol: seat.col,
      floorRow: seat.row,
      onGreedy: seat.onGreedy,
      throatScore: seat.throatScore
    }));
  }
  function placePaintFloorPins(map, input) {
    const n = input.paintCount;
    if (n <= 0) return [];
    const { cols, rows } = map;
    if (!inBounds9(cols, rows, input.spawnCol, input.spawnRow)) {
      return `${PAINT_PINS_SHORT} (need ${n}, spawn out of bounds)`;
    }
    const walk = walkBits(map);
    const spawn = at11(cols, input.spawnCol, input.spawnRow);
    const extract = at11(cols, input.extractCol, input.extractRow);
    const { dist } = bfsFrom(walk, cols, rows, spawn);
    const greedy = greedyKindlingCells(walk, cols, rows, spawn, extract, input.kindling);
    const kindlingCells = /* @__PURE__ */ new Set();
    for (const node of input.kindling) {
      if (!inBounds9(cols, rows, node.col, node.row)) continue;
      kindlingCells.add(at11(cols, node.col, node.row));
    }
    const banned = (col, row) => isBannedPaintSeat(col, row, input.spawnCol, input.spawnRow, input.extractCol, input.extractRow, kindlingCells, cols);
    const pathSeats = rankSeats(greedy, walk, cols, rows, greedy, dist, banned);
    const ringSeats = rankSeats(ringAround(greedy, walk, cols, rows, 2), walk, cols, rows, greedy, dist, banned);
    const islandSeats = rankSeats(reachableFloors(dist), walk, cols, rows, greedy, dist, banned);
    const stages = [pathSeats, ringSeats, islandSeats];
    const spacings = paintHostSpacingLadder(n);
    for (const seats of stages) {
      for (const spacing of spacings) {
        const picked = pickSpaced(seats, n, spacing);
        if (picked) return toPins(picked);
      }
    }
    let best = 0;
    for (const seats of stages) {
      const trial = pickSpaced(seats, n, 3);
      if (trial) best = Math.max(best, trial.length);
      best = Math.max(best, Math.min(seats.length, n));
    }
    return `${PAINT_PINS_SHORT} (need ${n}, max placed ${best})`;
  }
  function collectContaminationPins(map, paint) {
    const paintFloors = placePaintFloorPins(map, paint);
    if (typeof paintFloors === "string") return paintFloors;
    return {
      wallEdges: collectWallEdges(map),
      paintFloors,
      corridorAabbs: collectCorridors(map)
    };
  }
  var TileGrid3 = class {
    constructor(map) {
      __publicField3(this, "cols");
      __publicField3(this, "rows");
      __publicField3(this, "tileSize");
      __publicField3(this, "widthPx");
      __publicField3(this, "heightPx");
      __publicField3(this, "data");
      __publicField3(this, "_version", 0);
      this.cols = map.cols;
      this.rows = map.rows;
      this.tileSize = map.tileSize;
      this.widthPx = map.cols * map.tileSize;
      this.heightPx = map.rows * map.tileSize;
      this.data = new Uint8Array(map.cols * map.rows);
      for (let row = 0; row < map.rows; row++) {
        const sourceRow = map.tiles[row];
        if (!sourceRow || sourceRow.length !== map.cols) {
          throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
        }
        for (let col = 0; col < map.cols; col++) {
          this.data[row * map.cols + col] = sourceRow[col];
        }
      }
    }
    get version() {
      return this._version;
    }
    /**
     * Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks.
     * In-bounds VOID stays VOID (unwalkable; opaque via `isOpaque`).
     */
    getTile(col, row) {
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
      return this.data[row * this.cols + col];
    }
    isOpaque(col, row) {
      const tile = this.getTile(col, row);
      return tile === 0 || tile === 3;
    }
    isWalkable(col, row) {
      const tile = this.getTile(col, row);
      return tile === 1 || tile === 2;
    }
    /** True when the world position falls inside a walkable tile. */
    isWalkableAt(x, y) {
      return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
    }
    /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
    setTile(col, row, tile) {
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
      const index = row * this.cols + col;
      if (this.data[index] === tile) return;
      this.data[index] = tile;
      this._version++;
    }
    /** Writes the centre of a tile into `out` (no allocation). */
    tileToWorld(col, row, out) {
      out.x = col * this.tileSize + this.tileSize / 2;
      out.y = row * this.tileSize + this.tileSize / 2;
      return out;
    }
    /** Writes the tile containing a world position into `out` (no allocation). */
    worldToTile(x, y, out) {
      out.col = Math.floor(x / this.tileSize);
      out.row = Math.floor(y / this.tileSize);
      return out;
    }
  };
  var RIFT_MAP_ASCII2 = [
    "################################################",
    "#..............................................#",
    "#.....##..............X.........###............#",
    "#.....###.........##..............##..P..##....#",
    "#..........##...............##.................#",
    "#.......J....##.......................K...##...#",
    "#.....##...........###........##...............#",
    "#.........##.............##............##......#",
    "#..7........###........##..........###.........#",
    "#...####..........######.........##............#",
    "#...###..........##....##...........6..........#",
    "#.Q......##.........##...........##............#",
    "#.........##.............###...................#",
    "#.....C...##........5....###..........D........#",
    "#...####..........##.....##....................#",
    "#..##.........##..........##..........###......#",
    "#......###............##.......###.............#",
    "#.....E...##.....##...................##.......#",
    "#......####..........##............4.....##....#",
    "#..............####.........##...........##....#",
    "#..##..........###..........##....R...###......#",
    "#.............##...............##...F.....8....#",
    "#...........##............##...................#",
    "#.......##........##........##.................#",
    "#.....H.......##...................G...##......#",
    "#...........3........##...........##...........#",
    "#....##.....A.................2......B.........#",
    "#........##...........1............##..........#",
    "#.....................S..........##............#",
    "#....##....................##..................#",
    "#..............................................#",
    "################################################"
  ];
  var KINDLING_TIERS2 = {
    "1": "safe",
    "2": "safe",
    "3": "safe",
    "4": "contested",
    "5": "contested",
    "6": "contested",
    "7": "deep",
    "8": "deep"
  };
  var CONTAMINANT_MARKER_CHARS2 = ["P", "Q", "R"];
  var PATROL_UNITS2 = [
    {
      id: "ENM_INF_01",
      waypointChars: "AB",
      mode: "pingpong",
      facing: 0,
      role: "spawn area sweep; east-west patrol covering the open ground between safe kindling and the transition zone"
    },
    {
      id: "ENM_INF_02",
      waypointChars: "CD",
      mode: "pingpong",
      facing: 0,
      role: "upper contested area; sweeps east-west through the debris field, guards KDL_05 and approach to deep zone"
    },
    {
      id: "ENM_INF_03",
      waypointChars: "EFGH",
      mode: "loop",
      facing: 0,
      role: "rectangular loop in the transition zone; covers the C-shape ruin and cliff ridge areas, guards KDL_04 and KDL_08 approaches"
    },
    {
      id: "ENM_INF_04",
      waypointChars: "JK",
      mode: "pingpong",
      facing: 0,
      scanAngles: [180, 0],
      role: "top zone gate; sweeps east-west in the extraction approach \u2014 the last obstacle before exit"
    }
  ];
  var LANDMARKS2 = [
    { id: "LMK_POOL", col: 28, row: 6, style: "pool" },
    { id: "LMK_SCRATCHES", col: 20, row: 26, style: "scratches" },
    { id: "LMK_RUBBLE", col: 8, row: 15, style: "rubble" },
    { id: "LMK_CRACK", col: 40, row: 18, style: "crack" },
    { id: "LMK_SCORCH", col: 30, row: 4, style: "scorch" },
    { id: "LMK_CRYSTALS", col: 41, row: 9, style: "crystals" },
    { id: "LMK_BLOODTRAIL", col: 22, row: 22, style: "bloodtrail" },
    { id: "LMK_RUNE", col: 6, row: 19, style: "rune" }
  ];
  function parseRiftMap2() {
    const tileSize = GAME_CONSTANTS3.TILE_SIZE;
    const rows = RIFT_MAP_ASCII2.length;
    const cols = RIFT_MAP_ASCII2[0].length;
    const tiles = [];
    const markers = /* @__PURE__ */ new Map();
    for (let row = 0; row < rows; row++) {
      const line = RIFT_MAP_ASCII2[row];
      if (line.length !== cols) {
        throw new Error(`rift-map-data: row ${row} has ${line.length} chars, expected ${cols}`);
      }
      const tileRow = new Array(cols);
      for (let col = 0; col < cols; col++) {
        const char = line[col];
        tileRow[col] = char === "#" ? 0 : 1;
        if (char !== "#" && char !== ".") {
          if (markers.has(char)) {
            throw new Error(`rift-map-data: marker '${char}' appears more than once`);
          }
          markers.set(char, {
            x: col * tileSize + tileSize / 2,
            y: row * tileSize + tileSize / 2
          });
        }
      }
      tiles.push(tileRow);
    }
    const requireMarker = (char) => {
      const position = markers.get(char);
      if (!position) throw new Error(`rift-map-data: missing marker '${char}'`);
      return position;
    };
    const kindlingNodes = Object.keys(KINDLING_TIERS2).sort().map((char) => ({
      id: `KDL_0${char}`,
      tier: KINDLING_TIERS2[char],
      position: requireMarker(char)
    }));
    const contaminantNodes = CONTAMINANT_MARKER_CHARS2.map((char, idx) => ({
      id: `CTM_NODE_0${idx + 1}`,
      position: requireMarker(char)
    }));
    const enemySpawns = PATROL_UNITS2.map((unit) => {
      const waypoints = unit.waypointChars.split("").map((char) => {
        const position = requireMarker(char);
        return {
          col: Math.floor(position.x / tileSize),
          row: Math.floor(position.y / tileSize)
        };
      });
      return {
        id: unit.id,
        type: "infiltrator",
        spawn: waypoints[0],
        facing: unit.facing,
        patrol: {
          waypoints,
          mode: unit.mode,
          pauseMs: unit.pauseMs,
          scanAngles: unit.scanAngles
        }
      };
    });
    const tileMap = { cols, rows, tileSize, tiles };
    return {
      tileMap,
      grid: new TileGrid3(tileMap),
      layout: {
        spawnPoint: requireMarker("S"),
        extractionPoint: {
          id: "EXIT_01",
          position: requireMarker("X"),
          triggerRadius: GAME_CONSTANTS3.PURIFICATION.INTERACTION_RADIUS
        },
        kindlingNodes,
        contaminantNodes,
        enemySpawns,
        landmarks: LANDMARKS2
      }
    };
  }
  var RIFT_MAP2 = parseRiftMap2();
  function createRayHit3() {
    return { x: 0, y: 0, dist: 0, hit: false };
  }
  var CORNER_MARGIN2 = 1;
  var losScratch3 = createRayHit3();
  function castRayDirection2(grid, originX, originY, dirX, dirY, maxDist, out) {
    const tileSize = grid.tileSize;
    let col = Math.floor(originX / tileSize);
    let row = Math.floor(originY / tileSize);
    if (grid.isOpaque(col, row)) {
      out.x = originX;
      out.y = originY;
      out.dist = 0;
      out.hit = true;
      return out;
    }
    const stepCol = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
    const stepRow = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
    const invX = stepCol !== 0 ? 1 / Math.abs(dirX) : Infinity;
    const invY = stepRow !== 0 ? 1 / Math.abs(dirY) : Infinity;
    const deltaX = tileSize * invX;
    const deltaY = tileSize * invY;
    let nextX = stepCol > 0 ? ((col + 1) * tileSize - originX) * invX : stepCol < 0 ? (originX - col * tileSize) * invX : Infinity;
    let nextY = stepRow > 0 ? ((row + 1) * tileSize - originY) * invY : stepRow < 0 ? (originY - row * tileSize) * invY : Infinity;
    const maxSteps = grid.cols + grid.rows + 2;
    for (let step = 0; step < maxSteps; step++) {
      const throughVertex = stepCol !== 0 && stepRow !== 0 && Math.abs(nextX - nextY) <= CORNER_MARGIN2;
      if (throughVertex) {
        const dist2 = nextX < nextY ? nextX : nextY;
        if (dist2 > maxDist) break;
        if (grid.isOpaque(col + stepCol, row) && grid.isOpaque(col, row + stepRow)) {
          return writeHit2(out, originX, originY, dirX, dirY, dist2, true);
        }
        col += stepCol;
        row += stepRow;
        nextX += deltaX;
        nextY += deltaY;
        if (grid.isOpaque(col, row)) {
          return writeHit2(out, originX, originY, dirX, dirY, dist2, true);
        }
        continue;
      }
      let dist;
      if (nextX < nextY) {
        dist = nextX;
        if (dist > maxDist) break;
        col += stepCol;
        nextX += deltaX;
      } else {
        dist = nextY;
        if (dist > maxDist) break;
        row += stepRow;
        nextY += deltaY;
      }
      if (grid.isOpaque(col, row)) {
        return writeHit2(out, originX, originY, dirX, dirY, dist, true);
      }
    }
    return writeHit2(out, originX, originY, dirX, dirY, maxDist, false);
  }
  function hasLineOfSight2(grid, from, to, maxDist) {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const length2 = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (length2 < 1e-6) {
      return !grid.isOpaque(Math.floor(from.x / grid.tileSize), Math.floor(from.y / grid.tileSize));
    }
    if (maxDist !== void 0 && length2 > maxDist) return false;
    castRayDirection2(grid, from.x, from.y, deltaX / length2, deltaY / length2, length2, losScratch3);
    return !losScratch3.hit || losScratch3.dist >= length2 - 1e-3;
  }
  function writeHit2(out, originX, originY, dirX, dirY, dist, hit) {
    out.x = originX + dirX * dist;
    out.y = originY + dirY * dist;
    out.dist = dist;
    out.hit = hit;
    return out;
  }
  var MAX_ISLAND_ATTEMPTS = 32;
  var MAX_PLACE_ATTEMPTS = 20;
  var SIGHT_PX2 = ENEMY_DATA3.infiltrator.sightRange;
  var TILE4 = GAME_CONSTANTS3.TILE_SIZE;
  var EXTRACT_EPS = 1;
  var DIRS49 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  var LANDMARK_STYLES = [
    "pool",
    "scratches",
    "rubble",
    "crack",
    "scorch",
    "crystals",
    "bloodtrail",
    "rune"
  ];
  var forbiddenExtract2 = RIFT_MAP2.layout.extractionPoint.position;
  function at12(cols, col, row) {
    return row * cols + col;
  }
  function inBounds10(cols, rows, col, row) {
    return col >= 0 && row >= 0 && col < cols && row < rows;
  }
  function worldOf(col, row) {
    return { x: col * TILE4 + TILE4 / 2, y: row * TILE4 + TILE4 / 2 };
  }
  function sameWorld(a, b) {
    return Math.abs(a.x - b.x) < EXTRACT_EPS && Math.abs(a.y - b.y) < EXTRACT_EPS;
  }
  function colOf(cols, i) {
    return i % cols;
  }
  function rowOf(cols, i) {
    return i / cols | 0;
  }
  function pickRecipeAnchor(seed2, islandAttempt) {
    const enabledIds = new Set(ENABLED_RIFT_FRAGMENTS3.map((row) => row.id));
    const live = PREVIEW_RECIPES.filter((recipe) => enabledIds.has(recipe.fragmentTypeId));
    if (live.length === 0) throw new Error("pickRecipe: no enabled fragment recipes");
    const types = [];
    for (const recipe of live) {
      if (!types.includes(recipe.fragmentTypeId)) types.push(recipe.fragmentTypeId);
    }
    const typeId = types[new SeededRandom2(mix322(seed2, "fragment-type")).nextInt(0, types.length - 1)];
    const ofType = live.filter((recipe) => recipe.fragmentTypeId === typeId);
    const pool = islandAttempt < 6 && ofType.length > 0 ? ofType : live;
    return pool[new SeededRandom2(mix322(seed2, `recipe:${islandAttempt}`)).nextInt(0, pool.length - 1)];
  }
  function pickRecipe(seed2, islandAttempt) {
    return jitterRecipe(pickRecipeAnchor(seed2, islandAttempt), islandSeed(seed2, islandAttempt));
  }
  function resolveRecipe(seed2, islandAttempt, options) {
    const anchor = options?.recipeId ? recipeById(options.recipeId) : pickRecipeAnchor(seed2, islandAttempt);
    if (options?.jitter === false) return anchor;
    return jitterRecipe(anchor, islandSeed(seed2, islandAttempt));
  }
  function islandSeed(seed2, islandAttempt) {
    if (islandAttempt === 0) return seed2 >>> 0;
    return mix322(seed2, `island:${islandAttempt}`);
  }
  function walkBits2(grid) {
    const bits2 = new Uint8Array(grid.cols * grid.rows);
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (grid.isWalkable(col, row)) bits2[at12(grid.cols, col, row)] = 1;
      }
    }
    return bits2;
  }
  function wallBits(grid) {
    const bits2 = new Uint8Array(grid.cols * grid.rows);
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (grid.getTile(col, row) === 0) bits2[at12(grid.cols, col, row)] = 1;
      }
    }
    return bits2;
  }
  function bfs2(walk, cols, rows, start) {
    const dist = new Int32Array(walk.length).fill(-1);
    const parent = new Int32Array(walk.length).fill(-1);
    if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
    const queue = [start];
    dist[start] = 0;
    let q = 0;
    while (q < queue.length) {
      const cur = queue[q++];
      const col = colOf(cols, cur);
      const row = rowOf(cols, cur);
      const d = dist[cur];
      for (const [dx, dy] of DIRS49) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds10(cols, rows, nx, ny)) continue;
        const ni = at12(cols, nx, ny);
        if (!walk[ni] || dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        parent[ni] = cur;
        queue.push(ni);
      }
    }
    return { dist, parent };
  }
  function farthest(dist) {
    let best = -1;
    let bestD = -1;
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i];
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
  function reconstruct2(parent, start, goal) {
    if (goal < 0 || parent[goal] === void 0) return [];
    const path = [];
    let cur = goal;
    const guard = parent.length + 2;
    let n = 0;
    while (cur !== start && cur >= 0 && n++ < guard) {
      path.push(cur);
      cur = parent[cur];
    }
    if (cur !== start) return [];
    path.push(start);
    path.reverse();
    return path;
  }
  function pathDistField(walk, cols, rows, path) {
    const dist = new Int32Array(walk.length).fill(-1);
    const queue = [];
    for (const i of path) {
      if (!walk[i]) continue;
      dist[i] = 0;
      queue.push(i);
    }
    let q = 0;
    while (q < queue.length) {
      const cur = queue[q++];
      const col = colOf(cols, cur);
      const row = rowOf(cols, cur);
      const d = dist[cur];
      for (const [dx, dy] of DIRS49) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds10(cols, rows, nx, ny)) continue;
        const ni = at12(cols, nx, ny);
        if (!walk[ni] || dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        queue.push(ni);
      }
    }
    return dist;
  }
  function manhattan(cols, a, b) {
    return Math.abs(colOf(cols, a) - colOf(cols, b)) + Math.abs(rowOf(cols, a) - rowOf(cols, b));
  }
  function pickRewriterExtraIndex(extraWps, contested, deep, cols) {
    if (extraWps.length === 0) return -1;
    const greedy = [...contested, ...deep];
    let best = 0;
    let bestDist = Infinity;
    extraWps.forEach((wps, idx) => {
      let d = Infinity;
      for (const wp of wps) {
        if (greedy.length === 0) {
          d = 0;
          break;
        }
        for (const cell of greedy) d = Math.min(d, manhattan(cols, wp, cell));
      }
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    });
    return best;
  }
  function worldDistCells(cols, a, b) {
    const dx = (colOf(cols, a) - colOf(cols, b)) * TILE4;
    const dy = (rowOf(cols, a) - rowOf(cols, b)) * TILE4;
    return Math.hypot(dx, dy);
  }
  var losFrom = { x: 0, y: 0 };
  var losTo = { x: 0, y: 0 };
  function cellSees(grid, from, to, maxPx) {
    const cols = grid.cols;
    if (worldDistCells(cols, from, to) > maxPx) return false;
    const a = worldOf(colOf(cols, from), rowOf(cols, from));
    const b = worldOf(colOf(cols, to), rowOf(cols, to));
    losFrom.x = a.x;
    losFrom.y = a.y;
    losTo.x = b.x;
    losTo.y = b.y;
    return hasLineOfSight2(grid, losFrom, losTo, maxPx);
  }
  function nearAny(cols, cell, taken, minSep) {
    for (const t of taken) {
      if (manhattan(cols, cell, t) < minSep) return true;
    }
    return false;
  }
  function pickSeparated(rng, cols, pool, taken, count, minSep) {
    const order = pool.slice();
    rng.shuffle(order);
    const picked = [];
    const mine = /* @__PURE__ */ new Set();
    for (const cell of order) {
      if (taken.has(cell) || mine.has(cell)) continue;
      if (nearAny(cols, cell, taken, minSep) || nearAny(cols, cell, mine, minSep)) continue;
      picked.push(cell);
      mine.add(cell);
      if (picked.length === count) return picked;
    }
    return null;
  }
  function firstWalkable(walk) {
    for (let i = 0; i < walk.length; i++) if (walk[i]) return i;
    return -1;
  }
  function collectBand(dist, lo, hi) {
    const out = [];
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i];
      if (d >= lo && d <= hi) out.push(i);
    }
    return out;
  }
  function samplesAlong(walk, cols, rows, waypoints, loop) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    const add22 = (i) => {
      if (seen.has(i)) return;
      seen.add(i);
      out.push(i);
    };
    for (const wp of waypoints) add22(wp);
    const hops = loop ? waypoints.length : Math.max(0, waypoints.length - 1);
    for (let h = 0; h < hops; h++) {
      const a = waypoints[h];
      const b = waypoints[(h + 1) % waypoints.length];
      const { parent, dist } = bfs2(walk, cols, rows, a);
      if (dist[b] < 0) continue;
      const path = reconstruct2(parent, a, b);
      for (const i of path) add22(i);
    }
    return out;
  }
  function anySees(grid, samples, cell, maxPx) {
    for (const s of samples) {
      if (cellSees(grid, s, cell, maxPx)) return true;
    }
    return false;
  }
  function coveredFraction(grid, samples, cells, maxPx) {
    if (cells.length === 0) return 0;
    let n = 0;
    for (const c of cells) if (anySees(grid, samples, c, maxPx)) n++;
    return n / cells.length;
  }
  function facingDeg(cols, from, to) {
    const dx = colOf(cols, to) - colOf(cols, from);
    const dy = rowOf(cols, to) - rowOf(cols, from);
    return historicalAtan2(dy, dx) * 180 / Math.PI;
  }
  function makeWalkableMask(grid) {
    return {
      cols: grid.cols,
      rows: grid.rows,
      isWalkable: (col, row) => grid.isWalkable(col, row)
    };
  }
  function offsetBeside(walk, cols, rows, cell, rng) {
    const col = colOf(cols, cell);
    const row = rowOf(cols, cell);
    const order = [0, 1, 2, 3];
    rng.shuffle(order);
    for (const k of order) {
      const [dx, dy] = DIRS49[k];
      const nx = col + dx * 2;
      const ny = row + dy * 2;
      if (!inBounds10(cols, rows, nx, ny)) continue;
      const ni = at12(cols, nx, ny);
      if (walk[ni]) return ni;
    }
    for (const k of order) {
      const [dx, dy] = DIRS49[k];
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds10(cols, rows, nx, ny)) continue;
      const ni = at12(cols, nx, ny);
      if (walk[ni]) return ni;
    }
    return cell;
  }
  function placeOnIsland(grid, walk, walls, rng, routePolicy = "legacy") {
    const cols = grid.cols;
    const rows = grid.rows;
    const origin = firstWalkable(walk);
    if (origin < 0) return "no floor";
    const fromOrigin = bfs2(walk, cols, rows, origin);
    const poleA = farthest(fromOrigin.dist);
    if (poleA < 0) return "no pole A";
    const fromA = bfs2(walk, cols, rows, poleA);
    const poleB = farthest(fromA.dist);
    if (poleB < 0) return "no pole B";
    const diameter = fromA.dist[poleB];
    const minPole = Math.max(16, Math.floor(diameter * 0.55));
    if (diameter < minPole) return `poles too close (${diameter})`;
    const farA = collectBand(fromA.dist, Math.floor(diameter * 0.85), diameter);
    const swap = rng.next() < 0.5;
    let spawn = swap ? poleB : poleA;
    let extract = swap ? poleA : poleB;
    const extractPool = farA.length > 0 ? farA : [poleB];
    const tryExtract = extractPool[rng.nextInt(0, extractPool.length - 1)];
    const fromTry = bfs2(walk, cols, rows, tryExtract);
    const spawnPool = collectBand(fromTry.dist, Math.floor(diameter * 0.85), diameter);
    if (spawnPool.length > 0) {
      extract = tryExtract;
      spawn = spawnPool[rng.nextInt(0, spawnPool.length - 1)];
    }
    const fromSpawn = bfs2(walk, cols, rows, spawn);
    if (fromSpawn.dist[extract] < minPole) return "spawn/extract not far enough";
    const path = reconstruct2(fromSpawn.parent, spawn, extract);
    if (path.length < 12) return `path too short (${path.length})`;
    const dual = evaluateDualPath(walk, walls, cols, rows, spawn, extract);
    if (routePolicy === "open-world" ? dual.altSteps < 0 : !dual.ok) return dual.reason;
    const extractPos = worldOf(colOf(cols, extract), rowOf(cols, extract));
    if (sameWorld(extractPos, forbiddenExtract2)) return "extract matches handwritten X";
    const distFromExtract = bfs2(walk, cols, rows, extract).dist;
    const distFromSpawn = bfs2(walk, cols, rows, spawn).dist;
    const toPath = pathDistField(walk, cols, rows, path);
    const lastLen = Math.max(4, Math.min(10, Math.floor(path.length * 0.25)));
    const lastStretch = path.filter((i) => {
      const d = distFromExtract[i];
      return d >= 1 && d <= lastLen;
    });
    if (lastStretch.length < 3) return "last stretch too small";
    const gateBand = path.filter((i) => {
      const d = distFromExtract[i];
      return d >= 6 && d <= 14;
    });
    if (gateBand.length < 2) return "no gate band";
    const gateA = gateBand[Math.floor(gateBand.length * 0.25)];
    const gateB = gateBand[Math.floor(gateBand.length * 0.75)];
    if (gateA === gateB || manhattan(cols, gateA, gateB) < 3) return "gate waypoints too close";
    const gateWps = [gateA, gateB];
    if (anySees(grid, gateWps, extract, SIGHT_PX2)) return "gate sees extract";
    const gateSamples = samplesAlong(walk, cols, rows, gateWps, false);
    if (coveredFraction(grid, gateSamples, lastStretch, SIGHT_PX2) < 0.45) {
      return "gate does not cover last stretch";
    }
    const patrolCount = rng.nextInt(3, 4);
    const extraNeeded = patrolCount - 1;
    const extraWps = [];
    const midLo = 0.22;
    const midHi = 0.68;
    for (let p = 0; p < extraNeeded; p++) {
      const t0 = midLo + (midHi - midLo) * p / Math.max(1, extraNeeded);
      const t1 = t0 + (midHi - midLo) / Math.max(2, extraNeeded * 1.5);
      const i0 = path[Math.max(0, Math.min(path.length - 1, Math.floor(path.length * t0)))];
      const i1 = path[Math.max(0, Math.min(path.length - 1, Math.floor(path.length * t1)))];
      let a = offsetBeside(walk, cols, rows, i0, rng);
      let b = offsetBeside(walk, cols, rows, i1, rng);
      if (a === b) b = offsetBeside(walk, cols, rows, path[Math.min(path.length - 1, path.indexOf(i1) + 4 | 0)] ?? i1, rng);
      if (a === b || manhattan(cols, a, b) < 4) return "mid patrol too short";
      if (distFromSpawn[a] < 8 || distFromSpawn[b] < 8) return "mid patrol too close to spawn";
      if (distFromExtract[a] < lastLen + 3 || distFromExtract[b] < lastLen + 3) {
        return "mid patrol overlaps last stretch";
      }
      extraWps.push([a, b]);
    }
    const allWaypoints = [...gateWps, ...extraWps.flat()];
    if (anySees(grid, allWaypoints, extract, SIGHT_PX2)) return "a patrol sees extract";
    if (anySees(grid, allWaypoints, spawn, SIGHT_PX2)) return "a patrol sees spawn";
    for (const wps of extraWps) {
      const samples = samplesAlong(walk, cols, rows, wps, false);
      if (coveredFraction(grid, samples, lastStretch, SIGHT_PX2) > 0.25) {
        return "second patrol covers last stretch";
      }
    }
    const sweepGroups = [gateSamples, ...extraWps.map((wps) => samplesAlong(walk, cols, rows, wps, false))];
    const allSweep = sweepGroups.flat();
    const inSweep = (cell) => anySees(grid, allSweep, cell, SIGHT_PX2);
    const occupied = /* @__PURE__ */ new Set([spawn, extract, ...allWaypoints]);
    const floors = [];
    for (let i = 0; i < walk.length; i++) if (walk[i]) floors.push(i);
    const safePool = floors.filter(
      (i) => !occupied.has(i) && toPath[i] >= 0 && toPath[i] <= 2 && distFromSpawn[i] >= 3 && distFromExtract[i] >= 10 && !inSweep(i)
    );
    const contestedPool = floors.filter(
      (i) => !occupied.has(i) && inSweep(i) && distFromExtract[i] >= 8 && distFromSpawn[i] >= 8
    );
    const deepPool = floors.filter(
      (i) => !occupied.has(i) && toPath[i] >= 5 && distFromExtract[i] >= 8 && distFromSpawn[i] >= 8
    );
    const deep = pickSeparated(rng, cols, deepPool, occupied, 2, 3);
    if (!deep) return `deep kindling short (${deepPool.length})`;
    for (const i of deep) occupied.add(i);
    const contested = pickSeparated(rng, cols, contestedPool, occupied, 3, 3);
    if (!contested) return `contested kindling short (${contestedPool.length})`;
    for (const i of contested) occupied.add(i);
    const safe = pickSeparated(rng, cols, safePool, occupied, 3, 3);
    if (!safe) return `safe kindling short (${safePool.length})`;
    for (const i of safe) occupied.add(i);
    const kindling = [];
    const pushTier = (cells, tier, startId) => {
      cells.forEach((cell, idx) => {
        const id = startId + idx;
        kindling.push({
          id: `KDL_0${id}`,
          tier,
          position: worldOf(colOf(cols, cell), rowOf(cols, cell))
        });
      });
    };
    pushTier(safe, "safe", 1);
    pushTier(contested, "contested", 4);
    pushTier(deep, "deep", 7);
    const contaminantPool = floors.filter(
      (i) => !occupied.has(i) && distFromSpawn[i] >= 4 && distFromExtract[i] >= 6
    );
    const contaminantsCells = pickSeparated(rng, cols, contaminantPool, occupied, 3, 4);
    if (!contaminantsCells) return `contaminants short (${contaminantPool.length})`;
    for (const i of contaminantsCells) occupied.add(i);
    const contaminants = contaminantsCells.map((cell, idx) => ({
      id: `CTM_NODE_0${idx + 1}`,
      tier: deepPool.includes(cell) ? "deep" : contestedPool.includes(cell) ? "contested" : "safe",
      position: worldOf(colOf(cols, cell), rowOf(cols, cell))
    }));
    const enemies = [];
    const pushPatrol = (id, wps, type) => {
      enemies.push({
        id,
        type,
        spawn: { col: colOf(cols, wps[0]), row: rowOf(cols, wps[0]) },
        facing: facingDeg(cols, wps[0], wps[1] ?? wps[0]),
        patrol: {
          waypoints: wps.map((i) => ({ col: colOf(cols, i), row: rowOf(cols, i) })),
          mode: "pingpong",
          pauseMs: GAME_CONSTANTS3.AI.WAYPOINT_PAUSE_MS
        }
      });
    };
    pushPatrol("ENM_INF_01", gateWps, "infiltrator");
    const rewriterExtra = pickRewriterExtraIndex(extraWps, contested, deep, cols);
    extraWps.forEach((wps, idx) => {
      const rewriter = idx === rewriterExtra;
      pushPatrol(rewriter ? "ENM_RWR_01" : `ENM_INF_0${idx + 2}`, wps, rewriter ? "rewriter" : "infiltrator");
    });
    if (enemies.filter((e) => e.type === "rewriter").length !== 1) {
      return "rewriter count not 1";
    }
    const landmarkPool = floors.filter((i) => !occupied.has(i) && toPath[i] >= 0);
    const landmarkCount = rng.nextInt(2, 4);
    const landmarkCells = pickSeparated(rng, cols, landmarkPool, occupied, landmarkCount, 5) ?? [];
    const landmarks = landmarkCells.map((cell, idx) => ({
      id: `LMK_${idx + 1}`,
      col: colOf(cols, cell),
      row: rowOf(cols, cell),
      style: LANDMARK_STYLES[idx % LANDMARK_STYLES.length]
    }));
    return { spawn, extract, kindling, contaminants, enemies, landmarks };
  }
  function jiaRoleFromForm(form) {
    return form.lexemes.sense === "sense_hear" ? "rewriter" : "infiltrator";
  }
  function attachLexiconForms(rng, fragmentTypeId, placed, drawn) {
    const warnings = [...drawn.warnings];
    const hostForms = drawn.forms.filter((form) => form.portfolio !== "jia");
    const hearingOnWall = hostForms.some((form) => form.lexemes.sense === "sense_hear");
    const requirePatrol = (hearing, gate = false) => {
      const form = drawOne(rng, {
        portfolio: "jia",
        fragmentTypeId,
        motion: "motion_patrol",
        sense: gate ? "sense_cone" : hearing ? "sense_hear" : void 0,
        forbidSense: hearing ? void 0 : ["sense_hear"],
        coverage: gate ? "infiltrate" : void 0,
        rhythm: gate ? "rhythm_open" : void 0
      });
      if (!form) throw new Error(`No legal patrol for ${fragmentTypeId}/${hearing ? "hear" : "visual"}/${gate ? "gate" : "any"}`);
      return form;
    };
    let sentryTaken = false;
    const enemySpawns = placed.map((spawn, index) => {
      let form;
      if (index === 0) form = requirePatrol(false, true);
      else if (spawn.type === "rewriter") form = requirePatrol(!hearingOnWall);
      else {
        const sentry = sentryTaken ? null : drawOne(rng, {
          portfolio: "jia",
          fragmentTypeId,
          forbidSense: ["sense_hear"],
          forbidMotion: ["motion_patrol"]
        });
        if (sentry) {
          form = sentry;
          sentryTaken = true;
        } else form = requirePatrol(false);
      }
      return { ...spawn, form, type: jiaRoleFromForm(form) };
    });
    const rewriterCount = enemySpawns.filter((e) => e.type === "rewriter").length;
    const expectedRewriters = hearingOnWall ? 0 : 1;
    if (rewriterCount !== expectedRewriters) warnings.push(`jia rewriter count ${rewriterCount} (want ${expectedRewriters})`);
    const jiaForms = enemySpawns.map((e) => e.form).filter((f) => f !== void 0);
    return {
      enemySpawns,
      contaminationDraw: {
        forms: [...jiaForms, ...hostForms],
        warnings
      }
    };
  }
  function deployRiftContents(seed2, draft, options) {
    if (draft.tileMap.tileSize !== TILE4) throw new Error("Production content placement requires 32px logical cells");
    const inputSeed = seed2 >>> 0;
    const roll = options;
    let lastWhy = "no placement";
    const grid = new TileGrid3(draft.tileMap);
    const walk = walkBits2(grid);
    const walls = wallBits(grid);
    let floorCount = 0;
    for (let i = 0; i < walk.length; i++) if (walk[i]) floorCount++;
    if (floorCount < 80) {
      lastWhy = `too few floors (${floorCount})`;
      return lastWhy;
    }
    for (let place = 0; place < MAX_PLACE_ATTEMPTS; place++) {
      const rng = new SeededRandom2(mix322(inputSeed, `${options.placementTag ?? "place:0"}:${place}`));
      const placed = placeOnIsland(grid, walk, options.routeObstructions ?? walls, rng, options.routePolicy);
      if (typeof placed === "string") {
        lastWhy = placed;
        continue;
      }
      const spawnPoint = worldOf(colOf(grid.cols, placed.spawn), rowOf(grid.cols, placed.spawn));
      const extractionPoint = {
        id: "EXIT_01",
        position: worldOf(colOf(grid.cols, placed.extract), rowOf(grid.cols, placed.extract)),
        triggerRadius: GAME_CONSTANTS3.PURIFICATION.INTERACTION_RADIUS
      };
      if (sameWorld(extractionPoint.position, forbiddenExtract2)) {
        lastWhy = "extract matches handwritten X";
        continue;
      }
      const paintCount = rollPaintHostCount(inputSeed, roll.contaminationAge);
      const spawnCol = colOf(grid.cols, placed.spawn);
      const spawnRow = rowOf(grid.cols, placed.spawn);
      const extractCol = colOf(grid.cols, placed.extract);
      const extractRow = rowOf(grid.cols, placed.extract);
      let contaminationPins = collectContaminationPins(draft.tileMap, {
        spawnCol,
        spawnRow,
        extractCol,
        extractRow,
        kindling: placed.kindling.map((node) => {
          const col = Math.floor(node.position.x / TILE4);
          const row = Math.floor(node.position.y / TILE4);
          return { col, row, tier: node.tier };
        }),
        paintCount
      });
      if (typeof contaminationPins === "string") {
        console.warn(`[contamination-pins] seed ${inputSeed} retry: ${contaminationPins}`);
        lastWhy = contaminationPins;
        continue;
      }
      const lexiconRng = new SeededRandom2(mix322(options.lexiconSeed ?? inputSeed, "lexicon"));
      const drawn = drawSortie(lexiconRng, {
        fragmentTypeId: draft.fragmentTypeId,
        paintCount,
        hasWallEdges: contaminationPins.wallEdges.length > 0,
        hasWallOpenings: doorwayWallSeats(contaminationPins.wallEdges, grid).length > 0,
        hasCorridors: contaminationPins.corridorAabbs.length > 0
      });
      if (drawn.forms.some((form) => form.portfolio === "ding" && isMaterialVolume(form.substrate))) {
        const seat = findTerrainSafeVolumeSeat(contaminationPins.corridorAabbs, (col, row) => grid.isWalkable(col, row));
        if (!seat) {
          lastWhy = "material volume has no legal 2x2 local corridor seat";
          continue;
        }
        contaminationPins = { ...contaminationPins, corridorAabbs: [seat] };
      }
      const bound = attachLexiconForms(
        lexiconRng,
        draft.fragmentTypeId,
        placed.enemies,
        drawn
      );
      const safeEnemySpawns = ensureStaticBodyAccess({
        grid,
        spawnPoint,
        enemySpawns: bound.enemySpawns,
        targets: [
          { id: extractionPoint.id, position: extractionPoint.position, radius: extractionPoint.triggerRadius },
          ...placed.kindling.map((node) => ({ id: node.id, position: node.position, radius: GAME_CONSTANTS3.LOOT.SEARCH_RADIUS })),
          ...placed.contaminants.map((node) => ({ id: node.id, position: node.position, radius: GAME_CONSTANTS3.LOOT.SEARCH_RADIUS }))
        ]
      }, lexiconRng, draft.fragmentTypeId);
      if (!safeEnemySpawns) {
        lastWhy = "static bodies block player access after legal redraw";
        continue;
      }
      const safeDraw = safeEnemySpawns === bound.enemySpawns ? bound.contaminationDraw : {
        forms: [...safeEnemySpawns.map((enemy) => enemy.form), ...bound.contaminationDraw.forms.filter((form) => form.portfolio !== "jia")],
        warnings: bound.contaminationDraw.warnings
      };
      const layout = {
        seed: inputSeed,
        fragmentTypeId: draft.fragmentTypeId,
        recipeId: options.recipeId,
        contaminationAge: roll.contaminationAge,
        ruinSeverity: roll.ruinSeverity,
        tileMap: draft.tileMap,
        ruins: {
          ...draft,
          contaminationAge: roll.contaminationAge,
          ruinSeverity: roll.ruinSeverity
        },
        walkableMask: makeWalkableMask(grid),
        spawnPoint,
        extractionPoint,
        kindlingNodes: placed.kindling,
        contaminantNodes: placed.contaminants,
        enemySpawns: safeEnemySpawns,
        landmarks: placed.landmarks,
        contaminationPins,
        contaminationDraw: safeDraw
      };
      if (options.postprocess) {
        const processed = options.postprocess(layout);
        if (typeof processed === "string") {
          lastWhy = processed;
          continue;
        }
        return processed;
      }
      return layout;
    }
    return lastWhy;
  }
  function generateRiftLayout2(seed2, options) {
    const inputSeed = seed2 >>> 0;
    const rolled = rollFragmentAxes(inputSeed);
    const roll = {
      contaminationAge: options?.contaminationAge ?? rolled.contaminationAge,
      ruinSeverity: options?.ruinSeverity ?? rolled.ruinSeverity
    };
    let lastWhy = "no attempt";
    for (let island = 0; island < MAX_ISLAND_ATTEMPTS; island++) {
      const recipe = options ? resolveRecipe(inputSeed, island, options) : pickRecipe(inputSeed, island);
      const draftSeed = islandSeed(inputSeed, island);
      let draft;
      try {
        draft = generateRecipeDraft(draftSeed, recipe);
      } catch (err) {
        lastWhy = err instanceof Error ? err.message : String(err);
        continue;
      }
      const deployed = deployRiftContents(inputSeed, draft, {
        recipeId: recipe.id,
        ...roll,
        placementTag: `place:${island}`
      });
      if (typeof deployed !== "string") return deployed;
      lastWhy = deployed;
    }
    throw new Error(
      `generateRiftLayout: seed ${inputSeed} failed after ${MAX_ISLAND_ATTEMPTS} island attempts \xD7 ${MAX_PLACE_ATTEMPTS} placements (${lastWhy})`
    );
  }
  var BODY_CLEARANCE_EPSILON2 = 1e-6;
  function bodyHasSupport2(walk, center3, halfWidth, halfHeight) {
    if (![center3.x, center3.y, halfWidth, halfHeight].every(Number.isFinite) || halfWidth < 0 || halfHeight < 0 || center3.x - halfWidth < 0 || center3.y - halfHeight < 0 || center3.x + halfWidth > walk.cols * walk.tileSize || center3.y + halfHeight > walk.rows * walk.tileSize) return false;
    const insetX = Math.min(halfWidth, BODY_CLEARANCE_EPSILON2), insetY = Math.min(halfHeight, BODY_CLEARANCE_EPSILON2);
    const firstCol = Math.floor((center3.x - halfWidth + insetX) / walk.tileSize);
    const lastCol = Math.floor((center3.x + halfWidth - insetX) / walk.tileSize);
    const firstRow = Math.floor((center3.y - halfHeight + insetY) / walk.tileSize);
    const lastRow = Math.floor((center3.y + halfHeight - insetY) / walk.tileSize);
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) if (!walk.isWalkable(col, row)) return false;
    }
    return true;
  }
  function bodyDisplacementFraction2(walk, center3, halfWidth, halfHeight, dx, dy) {
    if (!Number.isFinite(center3.x) || !Number.isFinite(center3.y) || !Number.isFinite(halfWidth) || !Number.isFinite(halfHeight) || !Number.isFinite(dx) || !Number.isFinite(dy) || halfWidth < 0 || halfHeight < 0) return 0;
    if (dx === 0 && dy === 0) return 0;
    const size = walk.tileSize, epsilon = BODY_CLEARANCE_EPSILON2;
    const firstCol = Math.max(-1, Math.floor((Math.min(center3.x, center3.x + dx) - halfWidth) / size));
    const lastCol = Math.min(walk.cols, Math.floor((Math.max(center3.x, center3.x + dx) + halfWidth) / size));
    const firstRow = Math.max(-1, Math.floor((Math.min(center3.y, center3.y + dy) - halfHeight) / size));
    const lastRow = Math.min(walk.rows, Math.floor((Math.max(center3.y, center3.y + dy) + halfHeight) / size));
    let fraction = 1;
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) {
        if (col >= 0 && row >= 0 && col < walk.cols && row < walk.rows && walk.isWalkable(col, row)) continue;
        const minX = col * size - halfWidth + epsilon, maxX = (col + 1) * size + halfWidth - epsilon;
        const minY = row * size - halfHeight + epsilon, maxY = (row + 1) * size + halfHeight - epsilon;
        let entry = 0, exit = fraction;
        if (dx === 0) {
          if (center3.x <= minX || center3.x >= maxX) continue;
        } else {
          const a = (minX - center3.x) / dx, b = (maxX - center3.x) / dx;
          entry = Math.max(entry, Math.min(a, b));
          exit = Math.min(exit, Math.max(a, b));
        }
        if (dy === 0) {
          if (center3.y <= minY || center3.y >= maxY) continue;
        } else {
          const a = (minY - center3.y) / dy, b = (maxY - center3.y) / dy;
          entry = Math.max(entry, Math.min(a, b));
          exit = Math.min(exit, Math.max(a, b));
        }
        if (entry < exit && exit > 0) fraction = Math.min(fraction, entry);
      }
    }
    return fraction < 1 ? Math.max(0, fraction - 1e-4 / Math.max(Math.abs(dx), Math.abs(dy))) : 1;
  }
  function resolveStopLoss(form) {
    const row = STOP_LOSS_DATA[`${form.continuity}_${form.coverage}`];
    if (!row) return "illegal";
    if (!row.legalOccupancies.includes(form.occupancy)) return "illegal";
    if (PORTFOLIO_DATA2[form.portfolio].blockWalk && row.family === "unkillable") return "illegal";
    return {
      family: row.family,
      corePolicy: row.corePolicy,
      hittable: row.family !== "unkillable"
    };
  }
  function chebyshevTiles(a, b) {
    return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
  }
  function pickSpreadSeats(floors, want, gap) {
    if (floors.length === 0 || want <= 0) return [];
    if (want === 1) return [{ ...floors[0] }];
    let pair = null;
    let pairDistance = -1;
    let triple = null;
    let tripleGap = -1, tripleSpread = -1;
    for (let a = 0; a < floors.length; a++) for (let b = a + 1; b < floors.length; b++) {
      const ab = chebyshevTiles(floors[a], floors[b]);
      if (ab < gap) continue;
      if (ab > pairDistance) {
        pairDistance = ab;
        pair = [a, b];
      }
      if (want < 3) continue;
      for (let c = b + 1; c < floors.length; c++) {
        const ac = chebyshevTiles(floors[a], floors[c]), bc = chebyshevTiles(floors[b], floors[c]);
        const minimum = Math.min(ab, ac, bc), spread = ab + ac + bc;
        if (minimum < gap) continue;
        if (minimum > tripleGap || minimum === tripleGap && spread > tripleSpread) {
          tripleGap = minimum;
          tripleSpread = spread;
          triple = [a, b, c];
        }
      }
    }
    const selected = triple ?? pair;
    return selected ? selected.map((i) => ({ ...floors[i] })) : [{ ...floors[0] }];
  }
  function colonyNucleusSeatsInFloors(floors, countMin, countMax, preferGap, fallbackGap) {
    const seen = /* @__PURE__ */ new Set();
    const unique = [];
    for (const floor of floors) {
      const key = `${floor.col},${floor.row}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ col: floor.col, row: floor.row });
    }
    if (unique.length === 0) return [];
    const want = Math.max(countMin, Math.min(countMax, 3));
    unique.sort((a, b) => a.row - b.row || a.col - b.col);
    for (const gap of [preferGap, fallbackGap, 1]) {
      const seats = pickSpreadSeats(unique, want, gap);
      if (seats.length >= countMin) return seats;
    }
    return [];
  }
  var WORLD_PROFILE_DATA2 = [
    {
      "id": "ash-strata",
      "label": "\u65E0\u5F69\u5C42\u539F",
      "description": "\u6C89\u79EF\u5C42\u7247\u4E0E\u5931\u8272\u65AD\u9762",
      "material": "strata",
      "surface": {
        "substrate": "strata",
        "coating": "strata",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    {
      "id": "crystal-fibre",
      "label": "\u6676\u5316\u6797\u5E8A",
      "description": "\u7EA4\u7EF4\u5E8A\u6CBF\u7EDF\u4E00\u65B9\u5411\u6676\u5316",
      "material": "crystal",
      "surface": {
        "substrate": "strata",
        "coating": "crystal",
        "organization": "clusters",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    {
      "id": "ivory-basin",
      "label": "\u5438\u5149\u91C9\u539F",
      "description": "\u539A\u91C9\u6C89\u79EF\u4E0E\u5438\u5149\u7ED3\u8282",
      "material": "glaze",
      "surface": {
        "substrate": "strata",
        "coating": "glaze",
        "organization": "patches",
        "coverage": 0.54,
        "wear": 0.57,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.72,
        "regionScale": 1.4,
        "quietness": 0.55,
        "formScale": 1.6,
        "fragmentation": 0.42,
        "accentCoverage": 0.11
      },
      "palette": {
        "void": 1448997,
        "shadow": 2699322,
        "floorDeep": 7367527,
        "floor": 11182476,
        "floorLight": 12564125,
        "materialDark": 4868945,
        "materialMid": 7695973,
        "materialLight": 9799795,
        "faceLight": 13813675,
        "accentDim": 6443617,
        "accent": 8809848,
        "accentLight": 11639443,
        "peak": 15590084,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 11182476,
        "groundLight": 12564125,
        "groundDark": 7367527,
        "wall": 7695973,
        "wallLight": 13813675,
        "wallDark": 4868945
      }
    },
    {
      "id": "carmine-lacquer",
      "label": "\u7329\u91C9\u5C42\u539F",
      "description": "\u9971\u548C\u7EDB\u91C9\u4E0E\u9752\u84DD\u88F8\u5E8A",
      "material": "glaze",
      "surface": {
        "substrate": "strata",
        "coating": "glaze",
        "organization": "patches",
        "coverage": 0.68,
        "wear": 0.28,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.65,
        "regionScale": 1.4,
        "quietness": 0.46,
        "formScale": 1.45,
        "fragmentation": 0.42,
        "accentCoverage": 0.14
      },
      "palette": {
        "void": 1448997,
        "shadow": 1512231,
        "floorDeep": 1320759,
        "floor": 2315112,
        "floorLight": 4361364,
        "materialDark": 5247786,
        "materialMid": 9774917,
        "materialLight": 13980262,
        "faceLight": 15963525,
        "accentDim": 2441094,
        "accent": 3571652,
        "accentLight": 7522780,
        "peak": 16764589,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 2315112,
        "groundLight": 4361364,
        "groundDark": 1320759,
        "wall": 9774917,
        "wallLight": 15963525,
        "wallDark": 5247786
      }
    },
    {
      "id": "cobalt-gold",
      "label": "\u94B4\u84DD\u91D1\u8109",
      "description": "\u94B4\u84DD\u6676\u5C42\u4E0E\u91D1\u8272\u5171\u751F\u6C89\u79EF",
      "material": "crystal",
      "surface": {
        "substrate": "strata",
        "coating": "crystal",
        "organization": "bands",
        "coverage": 0.62,
        "wear": 0.34,
        "deposits": 0.58,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.2,
        "quietness": 0.42,
        "formScale": 1.4,
        "fragmentation": 0.35,
        "accentCoverage": 0.44
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 1056331,
        "floor": 2309512,
        "floorLight": 4221904,
        "materialDark": 6961177,
        "materialMid": 11889444,
        "materialLight": 14131528,
        "faceLight": 15781518,
        "accentDim": 1785949,
        "accent": 3052190,
        "accentLight": 8112572,
        "peak": 16773308,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 2309512,
        "groundLight": 4221904,
        "groundDark": 1056331,
        "wall": 11889444,
        "wallLight": 15781518,
        "wallDark": 6961177
      }
    }
  ];
  var WORLD_PROFILES2 = WORLD_PROFILE_DATA2;
  function worldProfileById2(id) {
    const profile = WORLD_PROFILES2.find((value) => value.id === id);
    if (!profile) throw new Error(`Unknown world profile: ${id}`);
    return profile;
  }
  function validateWorldOrganization(value) {
    if (!value || !Number.isFinite(value.axis) || !Number.isFinite(value.coherence) || value.coherence < 0 || value.coherence > 1)
      throw new Error("Invalid world organization axis/coherence");
  }
  function clearanceField(mask, cols, rows) {
    const distance2 = new Uint16Array(mask.length), queue = new Int32Array(mask.length);
    let head = 0, tail = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) {
        distance2[i] = 0;
        queue[tail++] = i;
      } else distance2[i] = 65535;
    }
    while (head < tail) {
      const cell = queue[head++], x = cell % cols, y = Math.floor(cell / cols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, next = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || distance2[next] <= distance2[cell] + 1) continue;
        distance2[next] = distance2[cell] + 1;
        queue[tail++] = next;
      }
    }
    return distance2;
  }
  function erodeOpenLand(land, cols, rows, rng, profile, organization) {
    if (organization) validateWorldOrganization(organization);
    const walls = new Uint8Array(land.length), excluded = new Uint8Array(land.length);
    const coastDistance = clearanceField(land, cols, rows), area2 = land.reduce((sum, value) => sum + value, 0);
    const target = Math.round(area2 * profile.voidFraction);
    const basin = { x: rng.nextFloat(cols * 0.4, cols * 0.6), y: rng.nextFloat(rows * 0.4, rows * 0.6) };
    const centres = Array.from({ length: 3 }, () => ({
      x: basin.x + rng.nextFloat(-cols * 0.1, cols * 0.1),
      y: basin.y + rng.nextFloat(-rows * 0.1, rows * 0.1)
    }));
    const sampledMainAngle = rng.nextFloat(0, Math.PI);
    const mainAngle = organization?.axis ?? sampledMainAngle, shapePhase = rng.nextFloat(0, Math.PI * 2);
    let carved = 0, pits = 0, fractures = 0;
    for (let attempt = 0; attempt < 1800 && carved < target; attempt++) {
      const clustered = rng.next() < profile.clustering, centre = rng.pick(centres);
      const cx = clustered ? centre.x + rng.nextGaussian() * cols * 0.12 : rng.nextFloat(cols * 0.13, cols * 0.87);
      const cy = clustered ? centre.y + rng.nextGaussian() * rows * 0.12 : rng.nextFloat(rows * 0.13, rows * 0.87);
      if (clustered && ((cx - basin.x) / (cols * 0.3)) ** 2 + ((cy - basin.y) / (rows * 0.31)) ** 2 > 1) continue;
      const fracture2 = rng.next() < profile.crackFraction;
      const scale = profile.holeScale * (rng.next() < 0.27 ? rng.nextFloat(1.1, 1.4) : rng.nextFloat(0.72, 1));
      const rx = rng.nextFloat(fracture2 ? 4.6 : 2.8, fracture2 ? 7 : 4.6) * scale;
      const ry = rng.nextFloat(fracture2 ? 1.45 : 2.25, fracture2 ? 2.3 : 3.9) * scale;
      const angle = mainAngle + rng.nextFloat(-Math.PI, Math.PI) * (1 - profile.directionality);
      const cosine = Math.cos(angle), sine = Math.sin(angle), phase2 = rng.nextFloat(0, 6.28) + shapePhase;
      const extent = Math.ceil(Math.max(rx, ry) * 1.2 + 1), cells = [];
      let clear = true;
      for (let y = Math.floor(cy - extent); y <= cy + extent; y++) for (let x = Math.floor(cx - extent); x <= cx + extent; x++) {
        const dx = x - cx, dy = y - cy, u = (dx * cosine + dy * sine) / rx;
        const v = (-dx * sine + dy * cosine) / ry + Math.sin(u * 2.1 + phase2) * (fracture2 ? 0.21 : 0.09);
        const polar = historicalAtan2(v, u);
        const boundary = 1 + Math.sin(polar * 3 + phase2) * 0.2 + Math.sin(polar * 5 - phase2) * 0.06;
        if (u * u + v * v > boundary) continue;
        const cell = y * cols + x;
        if (x < 0 || y < 0 || x >= cols || y >= rows || coastDistance[cell] < 6 || excluded[cell]) {
          clear = false;
          continue;
        }
        cells.push(cell);
      }
      if (!clear || cells.length < 8 || carved + cells.length > target * 1.12) continue;
      for (const cell of cells) {
        walls[cell] = 1;
        const x = cell % cols, y = Math.floor(cell / cols);
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) excluded[ny * cols + nx] = 1;
        }
      }
      carved += cells.length;
      if (fracture2) fractures++;
      else pits++;
    }
    return { walls, targetFraction: profile.voidFraction, actualFraction: carved / area2, pits, fractures };
  }
  var cache = /* @__PURE__ */ new WeakMap();
  function smooth3(mask, cols, rows) {
    const output = new Float32Array(mask.length);
    const weights = [1, 2, 1];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      let value = 0;
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const nx = col + x, ny = row + y;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) value += mask[ny * cols + nx] * weights[x + 1] * weights[y + 1];
      }
      output[row * cols + col] = mask[row * cols + col] * 0.45 + value / 16 * 0.55;
    }
    return output;
  }
  function fieldsFor(sample) {
    let fields = cache.get(sample);
    if (!fields) {
      fields = { land: smooth3(sample.land, sample.cols, sample.rows), walls: smooth3(sample.walls, sample.cols, sample.rows) };
      cache.set(sample, fields);
    }
    return fields;
  }
  function at13(sample, field2, x, y) {
    if (x < 0 || y < 0 || x >= sample.cols * sample.tileSize || y >= sample.rows * sample.tileSize) return false;
    const gx = x / sample.tileSize - 0.5, gy = y / sample.tileSize - 0.5;
    const col = Math.floor(gx), row = Math.floor(gy), tx = gx - col, ty = gy - row;
    const cell = (c, r) => c < 0 || r < 0 || c >= sample.cols || r >= sample.rows ? 0 : field2[r * sample.cols + c];
    const top = cell(col, row) * (1 - tx) + cell(col + 1, row) * tx;
    const bottom = cell(col, row + 1) * (1 - tx) + cell(col + 1, row + 1) * tx;
    return top * (1 - ty) + bottom * ty >= 0.5;
  }
  function worldLandAt(sample, x, y) {
    return at13(sample, fieldsFor(sample).land, x, y);
  }
  function worldWallAt(sample, x, y) {
    return at13(sample, fieldsFor(sample).walls, x, y);
  }
  var cache2 = /* @__PURE__ */ new WeakMap();
  function getWorldSupportGrid(sample) {
    const existing = cache2.get(sample);
    if (existing) return existing;
    const tileSize = 8;
    const cols = sample.cols * sample.tileSize / tileSize, rows = sample.rows * sample.tileSize / tileSize;
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) throw new Error("World support dimensions must align to 8px");
    const walkable = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = col * tileSize + tileSize / 2, y = row * tileSize + tileSize / 2;
      walkable[row * cols + col] = worldLandAt(sample, x, y) && !worldWallAt(sample, x, y) ? 1 : 0;
    }
    const result = { cols, rows, tileSize, walkable };
    cache2.set(sample, result);
    return result;
  }
  function canStandWorld(sample, x, y, halfSize = 10) {
    const grid = getWorldSupportGrid(sample);
    const left = Math.floor((x - halfSize + 1e-3) / grid.tileSize), right = Math.floor((x + halfSize - 1e-3) / grid.tileSize);
    const top = Math.floor((y - halfSize + 1e-3) / grid.tileSize), bottom = Math.floor((y + halfSize - 1e-3) / grid.tileSize);
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows || !grid.walkable[row * grid.cols + col]) return false;
    }
    return true;
  }
  var DIRECTIONS4 = [[1, 0], [0, 1], [1, 1], [1, -1]];
  var CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var OPEN_SPACE_LIMITS = {
    broadFloorRatio: 0.56,
    multidirectionalRatio: 0.43,
    localOpenRatio: 0.18,
    coreCoverage: 0.985,
    maximumAlleyCells: 14
  };
  function connected(mask, cols, rows, start) {
    const parent = new Int32Array(mask.length).fill(-1), cells = [];
    if (start < 0 || !mask[start]) return { cells, parent };
    cells.push(start);
    parent[start] = start;
    for (let head = 0; head < cells.length; head++) {
      const cell = cells[head], x = cell % cols, y = Math.floor(cell / cols);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx, ny = y + dy, next = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !mask[next] || parent[next] !== -1) continue;
        parent[next] = cell;
        cells.push(next);
      }
    }
    return { cells, parent };
  }
  function openSpaceBodyFits(sample, x, y) {
    return canStandWorld(sample, x, y);
  }
  function bodyRoute(sample, parent, start, goal) {
    if (parent[goal] === -1) return false;
    const { cols, tileSize: tile } = sample;
    let cell = goal;
    while (cell !== start) {
      const previous = parent[cell];
      if (previous < 0 || previous === cell) return false;
      const x = (cell % cols + 0.5) * tile, y = (Math.floor(cell / cols) + 0.5) * tile;
      const px = (previous % cols + 0.5) * tile, py = (Math.floor(previous / cols) + 0.5) * tile;
      for (let offset = 0; offset <= tile; offset += 2) {
        if (!openSpaceBodyFits(sample, x + (px - x) * offset / tile, y + (py - y) * offset / tile)) return false;
      }
      cell = previous;
    }
    return openSpaceBodyFits(sample, sample.spawn.x, sample.spawn.y);
  }
  function evaluateOpenSpace(sample) {
    const { cols, rows, tileSize, land, walls } = sample, failures = [];
    const floor = Uint8Array.from(land, (value, i) => value && !walls[i] ? 1 : 0);
    const distance2 = clearanceField(floor, cols, rows), coast = clearanceField(land, cols, rows);
    const core = Uint8Array.from(floor, (value, i) => value && distance2[i] >= 3 ? 1 : 0);
    const open = new Uint8Array(floor.length), alley = new Uint8Array(floor.length);
    const start = Math.floor(sample.spawn.y / tileSize) * cols + Math.floor(sample.spawn.x / tileSize);
    const goal = Math.floor(sample.exit.y / tileSize) * cols + Math.floor(sample.exit.x / tileSize);
    let floorCells2 = 0, coreCells = 0, openCells = 0, landCells = 0;
    const ray = (x, y, dx, dy) => {
      for (let step = 1; step <= 12; step++) {
        const nx = x + dx * step, ny = y + dy * step, cell = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return { length: step - 1, wall: false };
        if (!floor[cell]) return { length: step - 1, wall: walls[cell] === 1 };
      }
      return { length: 12, wall: false };
    };
    for (let cell = 0; cell < floor.length; cell++) {
      landCells += land[cell];
      if (!floor[cell]) continue;
      floorCells2++;
      coreCells += core[cell];
      const x = cell % cols, y = Math.floor(cell / cols);
      let openAxes = 0, pinched = false, longAxis = false;
      for (const [dx, dy] of DIRECTIONS4) {
        const left = ray(x, y, dx, dy), right = ray(x, y, -dx, -dy);
        if (left.length >= 4 && right.length >= 4 && left.length + right.length >= 13) openAxes++;
        if (left.wall && right.wall && left.length + right.length + 1 <= 8) pinched = true;
        if (left.length + right.length >= 18) longAxis = true;
      }
      if (openAxes >= 2) {
        open[cell] = 1;
        openCells++;
      }
      if (coast[cell] >= 6 && pinched && longAxis && openAxes < 2) alley[cell] = 1;
    }
    const allReach = connected(floor, cols, rows, start), coreReach = connected(core, cols, rows, start);
    if (allReach.cells.length !== floorCells2) failures.push("Disconnected supported floor");
    const broadFloorRatio = coreCells / Math.max(1, floorCells2), coreCoverage = coreReach.cells.length / Math.max(1, coreCells);
    const multidirectionalRatio = openCells / Math.max(1, floorCells2);
    if (broadFloorRatio < OPEN_SPACE_LIMITS.broadFloorRatio) failures.push("Too little broad floor");
    if (coreCoverage < OPEN_SPACE_LIMITS.coreCoverage) failures.push("Narrow bottleneck splits broad floor");
    if (multidirectionalRatio < OPEN_SPACE_LIMITS.multidirectionalRatio) failures.push("Too little multidirectional open space");
    let minX = cols, minY = rows, maxX = 0, maxY = 0;
    for (const cell of coreReach.cells) {
      const x = cell % cols, y = Math.floor(cell / cols);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (minX > cols * 0.24 || maxX < cols * 0.76 || minY > rows * 0.25 || maxY < rows * 0.75)
      failures.push("Broad floor does not cross the interior in both axes");
    let worstLocalOpenRatio = 1;
    for (let y = 12; y < rows - 12; y += 8) for (let x = 12; x < cols - 12; x += 8) {
      if (coast[y * cols + x] < 9) continue;
      let count = 0, opened = 0;
      for (let dy = -8; dy < 8; dy++) for (let dx = -8; dx < 8; dx++) {
        const cell = (y + dy) * cols + x + dx;
        if (floor[cell]) {
          count++;
          opened += open[cell];
        }
      }
      if (count >= 96) worstLocalOpenRatio = Math.min(worstLocalOpenRatio, opened / count);
    }
    if (worstLocalOpenRatio < OPEN_SPACE_LIMITS.localOpenRatio) failures.push("Locally corridor-dominated interior");
    let longestAlley = 0;
    for (let cell = 0; cell < alley.length; cell++) {
      if (!alley[cell]) continue;
      const x = cell % cols, y = Math.floor(cell / cols);
      for (const [dx, dy] of DIRECTIONS4) {
        let length2 = 1;
        while (x + dx * length2 >= 0 && x + dx * length2 < cols && y + dy * length2 >= 0 && y + dy * length2 < rows && alley[(y + dy * length2) * cols + x + dx * length2]) length2++;
        longestAlley = Math.max(longestAlley, length2);
      }
    }
    if (longestAlley > OPEN_SPACE_LIMITS.maximumAlleyCells) failures.push("Long alley between tears");
    const continuous = bodyRoute(sample, coreReach.parent, start, goal);
    if (!continuous) failures.push("No continuous broad-body spawn/exit route");
    return {
      accepted: failures.length === 0,
      failures,
      floorCells: floorCells2,
      voidFraction: 1 - floorCells2 / Math.max(1, landCells),
      broadFloorRatio,
      multidirectionalRatio,
      worstLocalOpenRatio,
      coreCoverage,
      longestAlley,
      bodyRoute: continuous
    };
  }
  var WORLD_SPACE_DATA2 = [
    {
      "id": "open-scars",
      "label": "\u758F\u843D\u8680\u5751",
      "voidFraction": 0.09,
      "crackFraction": 0.2,
      "holeScale": 1,
      "directionality": 0.2,
      "clustering": 0.25
    },
    {
      "id": "fracture-fields",
      "label": "\u65AD\u88C2\u8352\u91CE",
      "voidFraction": 0.115,
      "crackFraction": 0.7,
      "holeScale": 1.1,
      "directionality": 0.65,
      "clustering": 0.65
    }
  ];
  var SPACE_PROFILES2 = WORLD_SPACE_DATA2;
  var SPACE_LIMITS = {
    voidFraction: [0.04, 0.18],
    crackFraction: [0, 1],
    holeScale: [0.65, 1.4],
    directionality: [0, 1],
    clustering: [0, 1]
  };
  function validateSpaceProfile(profile) {
    if (!profile || !profile.id || !profile.label) throw new Error("Space profile needs an id and label");
    for (const key of Object.keys(SPACE_LIMITS)) {
      const [min, max] = SPACE_LIMITS[key], value = profile[key];
      if (!Number.isFinite(value) || value < min || value > max)
        throw new Error(`Space ${key} must be in [${min}, ${max}], got ${value}`);
    }
  }
  function spaceProfileForTopology(topology) {
    const id = topology === "loops" ? "open-scars" : "fracture-fields";
    const profile = SPACE_PROFILES2.find((value) => value.id === id);
    if (!profile) throw new Error(`Missing space preset ${id}`);
    validateSpaceProfile(profile);
    return profile;
  }
  var COLS = 112;
  var ROWS = 76;
  var TILE_SIZE = 16;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function splitSeed(seed2, salt) {
    let value = Math.imul(seed2 ^ salt, 73244475);
    value = Math.imul(value ^ value >>> 16, 73244475);
    return (value ^ value >>> 16) >>> 0;
  }
  function flood(mask, start) {
    const queue = [start];
    const seen = new Uint8Array(mask.length);
    seen[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      const col = cell % COLS, row = Math.floor(cell / COLS);
      for (const [dx, dy] of DIRS) {
        const x = col + dx, y = row + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const next = y * COLS + x;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    return queue;
  }
  function components(mask) {
    const remaining = new Uint8Array(mask);
    const result = [];
    for (let cell = 0; cell < remaining.length; cell++) {
      if (!remaining[cell]) continue;
      const part = flood(remaining, cell);
      for (const index of part) remaining[index] = 0;
      result.push(part);
    }
    return result.sort((a, b) => b.length - a.length);
  }
  function clearance(mask, col, row, radius) {
    for (let y = row - radius; y <= row + radius; y++) for (let x = col - radius; x <= col + radius; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS || !mask[y * COLS + x]) return false;
    }
    return true;
  }
  function makeLand(seed2) {
    const rng = new SeededRandom2(splitSeed(seed2, 2167264849));
    const phases = Array.from({ length: 4 }, () => rng.nextFloat(0, Math.PI * 2));
    const land = new Uint8Array(COLS * ROWS);
    const cx = COLS / 2 + rng.nextFloat(-2, 2), cy = ROWS / 2 + rng.nextFloat(-1, 1);
    for (let row = 2; row < ROWS - 2; row++) for (let col = 2; col < COLS - 2; col++) {
      const x = (col - cx) / 50, y = (row - cy) / 32;
      const angle = historicalAtan2(y, x);
      const coast = 1 + 0.055 * Math.sin(angle * 3 + phases[0]) + 0.036 * Math.sin(angle * 5 + phases[1]) + 0.025 * Math.sin(angle * 9 + phases[2]) + 0.015 * Math.sin(angle * 17 + phases[3]);
      if (Math.hypot(x, y) < coast) land[row * COLS + col] = 1;
    }
    return land;
  }
  function formationsOf(walls) {
    return components(walls).map((cells, id) => {
      let cx = 0, cy = 0;
      for (const cell of cells) {
        cx += cell % COLS;
        cy += Math.floor(cell / COLS);
      }
      cx /= cells.length;
      cy /= cells.length;
      let xx = 0, yy = 0, xy2 = 0;
      for (const cell of cells) {
        const dx = cell % COLS - cx, dy = Math.floor(cell / COLS) - cy;
        xx += dx * dx;
        yy += dy * dy;
        xy2 += dx * dy;
      }
      return { id, cells, center: { x: (cx + 0.5) * TILE_SIZE, y: (cy + 0.5) * TILE_SIZE }, angle: 0.5 * historicalAtan2(2 * xy2, xx - yy) };
    });
  }
  var diagnostics = /* @__PURE__ */ new WeakMap();
  var MAX_SPACE_ATTEMPTS = 12;
  function generateWorldSample(profileId, topologyId, seed2, spaceProfile, organization) {
    if (!Number.isSafeInteger(seed2) || seed2 < 0 || seed2 > 4294967295) throw new Error("World seed must be an unsigned 32-bit integer");
    if (topologyId !== "loops" && topologyId !== "channels") throw new Error(`Unknown topology: ${topologyId}`);
    const profile = typeof profileId === "string" ? worldProfileById2(profileId) : profileId;
    const space = spaceProfile ?? spaceProfileForTopology(topologyId);
    validateSpaceProfile(space);
    if (organization) validateWorldOrganization(organization);
    const land = makeLand(seed2);
    const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
    const fieldRng = new SeededRandom2(splitSeed(seed2, 2300139489));
    const phase2 = fieldRng.nextFloat(0, Math.PI * 2), axis = fieldRng.nextFloat(-0.7, 0.7);
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const index = row * COLS + col;
      flowAngle[index] = organization ? organization.axis + (1 - organization.coherence) * (0.45 * Math.sin(row * 0.09 + phase2) + 0.15 * Math.cos(col * 0.06 + phase2)) : axis + 0.45 * Math.sin(row * 0.09 + phase2) + 0.15 * Math.cos(col * 0.06 + phase2);
      deposition[index] = 0.5 + 0.24 * Math.sin(col * 0.077 + row * 0.04 + phase2) + 0.22 * Math.cos(row * 0.13 - col * 0.032 + phase2);
    }
    let reason = "No erosion candidate";
    for (let attempt = 0; attempt < MAX_SPACE_ATTEMPTS; attempt++) {
      const rng = new SeededRandom2(splitSeed(seed2, 559290765 + attempt * 2654435761));
      const erosion = erodeOpenLand(land, COLS, ROWS, rng, space, organization), walls = erosion.walls;
      if (erosion.actualFraction < space.voidFraction * 0.85) {
        reason = "Requested erosion density could not fit broad spacing";
        continue;
      }
      const floor = Uint8Array.from(land, (value, index) => value && !walls[index] ? 1 : 0);
      const seats = [];
      for (let cell = 0; cell < floor.length; cell++)
        if (floor[cell] && clearance(floor, cell % COLS, Math.floor(cell / COLS), 2)) seats.push(cell);
      if (seats.length < 2) {
        reason = "No broad spawn/exit seats";
        continue;
      }
      const nearest = (targetX, targetY) => {
        let best = seats[0], bestDistance = Infinity;
        for (const cell of seats) {
          const dx = cell % COLS - targetX, dy = Math.floor(cell / COLS) - targetY, distance2 = dx * dx + dy * dy;
          if (distance2 < bestDistance) {
            bestDistance = distance2;
            best = cell;
          }
        }
        return best;
      };
      const point = (cell) => ({ x: (cell % COLS + 0.5) * TILE_SIZE, y: (Math.floor(cell / COLS) + 0.5) * TILE_SIZE });
      const sample = {
        profile,
        topologyId,
        seed: seed2,
        cols: COLS,
        rows: ROWS,
        tileSize: TILE_SIZE,
        land,
        walls,
        spawn: point(nearest(25, 55)),
        exit: point(nearest(87, 19)),
        formations: formationsOf(walls),
        flowAngle,
        deposition
      };
      const quality = evaluateOpenSpace(sample);
      if (!quality.accepted) {
        reason = quality.failures.join("; ");
        continue;
      }
      diagnostics.set(sample, { space, attempt, pits: erosion.pits, fractures: erosion.fractures, quality });
      return sample;
    }
    throw new Error(`Open-space generation rejected after ${MAX_SPACE_ATTEMPTS} bounded attempts (${space.id}, seed ${seed2}): ${reason}`);
  }
  function compositionOf(recipe) {
    return {
      organization: recipe.organization ?? "patches",
      regionScale: recipe.regionScale ?? 1,
      quietness: recipe.quietness ?? 0.42,
      formScale: recipe.formScale ?? 1,
      fragmentation: recipe.fragmentation ?? 0.45,
      accentCoverage: recipe.accentCoverage ?? 0.1
    };
  }
  function attachWorldScenery(sample, conditions, landmarks, tileSize) {
    const scenery = landmarks.map((landmark, i) => {
      const x = (landmark.col + 0.5) * tileSize, y = (landmark.row + 0.5) * tileSize;
      const cell = Math.min(sample.land.length - 1, Math.floor(y / sample.tileSize) * sample.cols + Math.floor(x / sample.tileSize));
      return {
        id: landmark.id,
        x,
        y,
        angle: sample.flowAngle[cell] ?? 0,
        radius: conditions.scenery.radiusPx * (i === 0 ? 1 : 0.94),
        kind: conditions.scenery.kind,
        density: conditions.scenery.density,
        seed: mix322(conditions.streams.material, `landmark:${landmark.id}`),
        motion: conditions.scenery.motion
      };
    });
    return { ...sample, scenery };
  }
  function validateSurfaceRecipe(recipe) {
    if (!recipe || !["strata", "crystal", "glaze"].includes(recipe.substrate) || !["strata", "crystal", "glaze"].includes(recipe.coating)) throw new Error("Unsupported material operator");
    const composition = compositionOf(recipe);
    if (!["patches", "bands", "clusters"].includes(composition.organization)) throw new Error("Invalid region organization");
    for (const key of ["regionScale", "quietness", "formScale", "fragmentation", "accentCoverage"]) {
      const value = composition[key], isScale = key === "regionScale" || key === "formScale";
      if (!Number.isFinite(value) || value < (isScale ? 0.5 : 0) || value > (isScale ? 2 : 1)) throw new Error(`Invalid composition ${key}`);
    }
    for (const key of ["coverage", "wear", "deposits", "scale", "relief", "contrast"]) {
      const value = recipe[key], min = key === "scale" ? 0.5 : 0, max = key === "scale" ? 2 : 1;
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid surface ${key}: ${value}`);
    }
  }
  var WORLD_CONTESTED_MIN_THREAT = 0.18;
  var STREAMS = ["world", "layout", "material", "placement", "encounters", "motion"];
  var RULES = ["deposition", "fracture", "aggregation"];
  var CAPABILITIES = /* @__PURE__ */ new Set([
    "surface:strata",
    "surface:crystal",
    "surface:glaze",
    "field:direction",
    "support:single-plane",
    "support:grid8",
    "body:aabb20",
    "void:opaque",
    "organization:patches",
    "organization:bands",
    "organization:clusters",
    "collision:dynamic",
    "space:multilevel"
  ]);
  var UINT_MAX = 4294967295;
  var uint = (value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= UINT_MAX;
  var inRange2 = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  var blend = (from, to, amount) => from + (to - from) * amount;
  var clauseValid = (value) => typeof value === "string" && value.length <= 200 && value.split("|").every((capability) => CAPABILITIES.has(capability));
  function validClauses(value) {
    return Array.isArray(value) && value.length <= 16 && new Set(value).size === value.length && value.every(clauseValid);
  }
  function worldConditionStreams(seed2) {
    if (!uint(seed2)) throw new Error("Invalid world conditions seed");
    return Object.freeze(Object.fromEntries(STREAMS.map((name) => [name, mix322(seed2, `world-conditions-v1:${name}`)])));
  }
  function worldOrganizationOf(conditions) {
    if (!validWorldConditions(conditions)) throw new Error("Invalid world organization conditions");
    return Object.freeze({
      axis: mix322(conditions.streams.world, "organization-axis") / 4294967296 * Math.PI,
      coherence: conditions.parameters.coherence
    });
  }
  function worldCapabilities(profile, space) {
    validateSurfaceRecipe(profile.surface);
    validateSpaceProfile(space);
    return /* @__PURE__ */ new Set([
      "support:single-plane",
      "support:grid8",
      "body:aabb20",
      "void:opaque",
      "field:direction",
      "organization:patches",
      "organization:bands",
      "organization:clusters",
      `surface:${profile.surface.substrate}`,
      `surface:${profile.surface.coating}`
    ]);
  }
  function worldConditionCompatibility(program, capabilities) {
    if (!validClauses(program.requiredCapabilities) || !validClauses(program.excludedCapabilities))
      throw new Error("Unsupported world capability clause");
    const matches = (clause) => clause.split("|").some((capability) => capabilities.has(capability));
    const missing = program.requiredCapabilities.filter((clause) => !matches(clause));
    const conflicts = program.excludedCapabilities.filter(matches);
    return { compatible: !missing.length && !conflicts.length, missing, conflicts };
  }
  function validWorldConditions(value) {
    try {
      if (!value || typeof value !== "object") return false;
      const c = value, p = c.parameters, s = c.semantic, v = c.scenery;
      const streams = worldConditionStreams(c.seed);
      if (c.version !== 1 || c.programVersion !== 1 || !uint(c.seed) || !RULES.includes(c.rule) || typeof c.programId !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(c.programId) || typeof c.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(c.sourceHash) || !validClauses(c.requiredCapabilities) || !c.requiredCapabilities.length || !validClauses(c.excludedCapabilities) || !p || !inRange2(p.strength, 0, 1) || !inRange2(p.coherence, 0, 1) || !inRange2(p.scale, 0.5, 2) || !c.streams || !STREAMS.every((name) => uint(c.streams[name]) && c.streams[name] === streams[name]) || !s || s.bodySizePx !== 20 || s.supportStepPx !== 8 || s.voidBlocksSight !== true || s.sceneryBlocksMovement !== false || !inRange2(s.minimumDeepDetourPx, 0, 2048) || !inRange2(s.safeMaxThreat, 0, 1) || !inRange2(s.routeThreatPenalty, 0, 64) || s.minimumDeepDetourPx <= 0 || s.routeThreatPenalty <= 0 || s.safeMaxThreat >= WORLD_CONTESTED_MIN_THREAT || !v || !["strata-fold", "crystal-fan", "glaze-basin"].includes(v.kind) || v.scale !== p.scale || !inRange2(v.radiusPx, 32, 128) || !inRange2(v.density, 0, 1) || !v.motion || v.motion.kind !== (c.rule === "fracture" ? "shear" : c.rule === "aggregation" ? "pulse" : "settle") || !inRange2(v.motion.amplitude, 0, 1.5) || !inRange2(v.motion.periodSeconds, 7, 30) || !Array.isArray(c.fallbackSeeds) || !c.fallbackSeeds.length || c.fallbackSeeds.length > 32 || new Set(c.fallbackSeeds).size !== c.fallbackSeeds.length || !c.fallbackSeeds.every(uint)) return false;
      return true;
    } catch {
      return false;
    }
  }
  function applyWorldConditions(profile, space, conditions) {
    if (!validWorldConditions(conditions)) throw new Error("Invalid frozen world conditions");
    const compatibility = worldConditionCompatibility(conditions, worldCapabilities(profile, space));
    if (!compatibility.compatible) throw new Error(`Incompatible world conditions: missing=${compatibility.missing.join(";")} conflicts=${compatibility.conflicts.join(";")}`);
    const expectedScenery = profile.surface.coating === "crystal" ? "crystal-fan" : profile.surface.coating === "glaze" ? "glaze-basin" : "strata-fold";
    if (conditions.scenery.kind !== expectedScenery) throw new Error("Scenery does not match frozen surface capability");
    const base = profile.surface, composition = compositionOf(base), { strength: s, coherence: c, scale } = conditions.parameters;
    const common = { regionScale: blend(composition.regionScale, scale, 0.65), formScale: blend(composition.formScale, scale, 0.5) };
    const holeScale = blend(space.holeScale, 0.65 + (scale - 0.5) / 1.5 * 0.75, 0.35);
    let surface, nextSpace;
    if (conditions.rule === "deposition") {
      surface = {
        ...base,
        ...common,
        organization: "bands",
        deposits: blend(base.deposits, 1, s * 0.5),
        wear: blend(base.wear, 0, s * 0.25),
        quietness: blend(composition.quietness, 0.7, s * 0.4),
        fragmentation: blend(composition.fragmentation, 0, c * 0.5)
      };
      nextSpace = {
        ...space,
        holeScale,
        crackFraction: blend(space.crackFraction, 0, s * 0.55),
        directionality: blend(space.directionality, c, 0.6),
        clustering: blend(space.clustering, c, 0.3)
      };
    } else if (conditions.rule === "fracture") {
      surface = {
        ...base,
        ...common,
        organization: "bands",
        wear: blend(base.wear, 1, s * 0.45),
        coverage: blend(base.coverage, 0, s * 0.18),
        fragmentation: blend(composition.fragmentation, 1, s * 0.65),
        quietness: blend(composition.quietness, 0.4, s * 0.3)
      };
      nextSpace = {
        ...space,
        holeScale,
        crackFraction: blend(space.crackFraction, 1, s * 0.7),
        directionality: blend(space.directionality, c, 0.8),
        clustering: blend(space.clustering, 0, s * 0.3)
      };
    } else {
      surface = {
        ...base,
        ...common,
        organization: "clusters",
        coverage: blend(base.coverage, 1, s * 0.25),
        deposits: blend(base.deposits, 1, s * 0.4),
        fragmentation: blend(composition.fragmentation, 0, c * 0.35),
        quietness: blend(composition.quietness, 0.75, s * 0.35)
      };
      nextSpace = {
        ...space,
        holeScale,
        crackFraction: blend(space.crackFraction, 0, s * 0.4),
        directionality: blend(space.directionality, c, 0.35),
        clustering: blend(space.clustering, 1, s * 0.65)
      };
    }
    validateSurfaceRecipe(surface);
    validateSpaceProfile(nextSpace);
    return { profile: { ...profile, palette: { ...profile.palette }, surface }, space: nextSpace };
  }
  var BEHAVIOR_PROFILE_DATA = {
    "rhythm_open": {
      "restMs": 0,
      "wakeMs": 0,
      "activeMs": 0,
      "releaseMs": 0,
      "rangeScale": 1,
      "coneDeg": 0
    },
    "rhythm_sleep": {
      "restMs": 0,
      "wakeMs": 600,
      "activeMs": 0,
      "releaseMs": 0,
      "rangeScale": 1,
      "coneDeg": 0
    },
    "rhythm_pulse": {
      "restMs": 2400,
      "wakeMs": 600,
      "activeMs": 3600,
      "releaseMs": 0,
      "rangeScale": 1,
      "coneDeg": 0
    },
    "sense_narrow": {
      "restMs": 0,
      "wakeMs": 0,
      "activeMs": 0,
      "releaseMs": 0,
      "rangeScale": 1.15,
      "coneDeg": 70
    },
    "sense_reverse": {
      "restMs": 0,
      "wakeMs": 300,
      "activeMs": 0,
      "releaseMs": 600,
      "rangeScale": 1,
      "coneDeg": 0
    }
  };
  var SemanticDeploymentError = class extends Error {
    constructor(reason) {
      super(`Semantic deployment: ${reason}`);
      this.name = "SemanticDeploymentError";
    }
  };
  var MIN_ROUTE_DETOUR = 64;
  var MIN_EXPOSURE_REDUCTION = 0.2;
  var CONTESTED_THREAT = WORLD_CONTESTED_MIN_THREAT;
  var DIRS2 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function adjacent(g, cell) {
    const x = cell % g.cols, y = Math.floor(cell / g.cols), out = [];
    for (const [dx, dy] of DIRS2) {
      const xx = x + dx, yy = y + dy, next = yy * g.cols + xx;
      if (xx >= 0 && yy >= 0 && xx < g.cols && yy < g.rows && g.walk[next]) out.push(next);
    }
    return out;
  }
  function center2(g, cell) {
    return { x: (cell % g.cols + 0.5) * g.tile, y: (Math.floor(cell / g.cols) + 0.5) * g.tile };
  }
  function cellAt(g, p) {
    return Math.floor(p.y / g.tile) * g.cols + Math.floor(p.x / g.tile);
  }
  function gridDistance(g, a, b) {
    return Math.abs(a % g.cols - b % g.cols) + Math.abs(Math.floor(a / g.cols) - Math.floor(b / g.cols));
  }
  function flood2(g, starts) {
    const distance2 = new Int32Array(g.walk.length).fill(-1), parent = new Int32Array(g.walk.length).fill(-1);
    const queue = [];
    for (const cell of starts) if (g.walk[cell] && distance2[cell] < 0) {
      distance2[cell] = 0;
      queue.push(cell);
    }
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      for (const next of adjacent(g, cell)) if (distance2[next] < 0) {
        distance2[next] = distance2[cell] + 1;
        parent[next] = cell;
        queue.push(next);
      }
    }
    return { distance: distance2, parent };
  }
  function reconstruct3(parent, start, goal) {
    const out = [goal];
    while (out[out.length - 1] !== start) {
      const next = parent[out[out.length - 1]];
      if (next < 0 || out.length > parent.length) return [];
      out.push(next);
    }
    return out.reverse();
  }
  function shortestPaths(g, start, threat, penalty = 0) {
    const distance2 = new Float64Array(g.walk.length).fill(Infinity), parent = new Int32Array(g.walk.length).fill(-1);
    const heap = [];
    const push = (cell, cost) => {
      let i = heap.length;
      heap.push({ cell, cost });
      while (i > 0) {
        const p = i - 1 >> 1;
        if (heap[p].cost <= cost) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = { cell, cost };
    };
    const pop = () => {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
          if (last.cost <= heap[child].cost) break;
          heap[i] = heap[child];
          i = child;
        }
        heap[i] = last;
      }
      return first;
    };
    for (const cell of typeof start === "number" ? [start] : start) {
      distance2[cell] = 0;
      push(cell, 0);
    }
    while (heap.length) {
      const item = pop();
      if (item.cost !== distance2[item.cell]) continue;
      for (const next of diagonalAdjacent(g, item.cell)) {
        const a = center2(g, item.cell), b = center2(g, next);
        const edge = Math.hypot(a.x - b.x, a.y - b.y);
        const cost = item.cost + edge * (1 + penalty * (threat ? (threat[item.cell] + threat[next]) / 2 : 0));
        if (cost + 1e-7 >= distance2[next]) continue;
        distance2[next] = cost;
        parent[next] = item.cell;
        push(next, cost);
      }
    }
    return { distance: distance2, parent };
  }
  function diagonalAdjacent(g, cell) {
    const out = adjacent(g, cell), x = cell % g.cols, y = Math.floor(cell / g.cols);
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      const xx = x + dx, yy = y + dy, next = yy * g.cols + xx;
      if (xx >= 0 && yy >= 0 && xx < g.cols && yy < g.rows && g.walk[next] && g.walk[y * g.cols + xx] && g.walk[yy * g.cols + x]) out.push(next);
    }
    return out;
  }
  function routeMetrics(g, path, threat) {
    let exposure = 0, length2 = 0;
    for (let i = 1; i < path.length; i++) {
      const a = center2(g, path[i - 1]), b = center2(g, path[i]);
      const edge = Math.hypot(a.x - b.x, a.y - b.y);
      length2 += edge;
      exposure += edge * (threat[path[i - 1]] + threat[path[i]]) / 2;
    }
    return { points: path.map((cell) => center2(g, cell)), lengthPx: length2, exposurePx: exposure };
  }
  function patrolSamples(g, enemy) {
    const form = enemy.form ?? (enemy.type === "rewriter" ? REWRITER_FORM2 : INFILTRATOR_FORM2);
    const motion = floorMotionFor2(form), spawn = enemy.spawn.row * g.cols + enemy.spawn.col;
    if (motion !== "motion_patrol" || enemy.patrol.mode === "static" || enemy.patrol.waypoints.length < 2)
      return [{ cell: spawn, heading: enemy.facing * Math.PI / 180, turns: motion === "motion_turn" }];
    const result = [];
    const wp = enemy.patrol.waypoints.map((p) => p.row * g.cols + p.col);
    const legs = enemy.patrol.mode === "loop" ? wp.length : wp.length - 1;
    for (let i = 0; i < legs; i++) {
      const from = wp[i], to = wp[(i + 1) % wp.length];
      const path = reconstruct3(flood2(g, [from]).parent, from, to);
      if (!path.length) throw new SemanticDeploymentError(`${enemy.id} has no patrol route`);
      for (let j = 0; j < path.length; j++) {
        const cell = path[j], a = center2(g, path[Math.max(0, j - 1)]), b = center2(g, path[Math.min(path.length - 1, j + 1)]);
        const heading2 = historicalAtan2(b.y - a.y, b.x - a.x);
        result.push({ cell, heading: heading2, turns: false });
        if (enemy.patrol.mode === "pingpong") result.push({ cell, heading: heading2 + Math.PI, turns: false });
      }
    }
    return result;
  }
  function buildThreat(g, grid, enemies) {
    const field2 = new Float32Array(g.walk.length), sources = [];
    for (const enemy of enemies) {
      const form = enemy.form ?? (enemy.type === "rewriter" ? REWRITER_FORM2 : INFILTRATOR_FORM2);
      const profile = ENEMY_DATA3[enemy.type], narrow = form.lexemes.sense === "sense_narrow" ? BEHAVIOR_PROFILE_DATA.sense_narrow : void 0;
      const range2 = profile.sightRange * (narrow?.rangeScale ?? 1), halfAngle = (narrow ? narrow.coneDeg / 2 : profile.sightHalfAngleCore) * Math.PI / 180;
      const hearing = profile.hearingRange, samples = patrolSamples(g, enemy), local = new Float32Array(field2.length);
      sources.push({ id: enemy.id, motion: floorMotionFor2(form), samples: samples.length, sightRange: range2, hearingRange: hearing });
      const radius = Math.ceil(Math.max(range2, hearing) / g.tile);
      for (const sample of samples) {
        const from = center2(g, sample.cell), sx = sample.cell % g.cols, sy = Math.floor(sample.cell / g.cols);
        for (let y = Math.max(0, sy - radius); y <= Math.min(g.rows - 1, sy + radius); y++) for (let x = Math.max(0, sx - radius); x <= Math.min(g.cols - 1, sx + radius); x++) {
          const cell = y * g.cols + x;
          if (!g.walk[cell]) continue;
          const point = center2(g, cell), distance2 = Math.hypot(point.x - from.x, point.y - from.y);
          if (distance2 > Math.max(range2, hearing)) continue;
          const los = hasLineOfSight2(grid, from, point, Math.max(range2, hearing));
          const bearing = historicalAtan2(point.y - from.y, point.x - from.x);
          const offset = Math.abs(historicalAtan2(Math.sin(bearing - sample.heading), Math.cos(bearing - sample.heading)));
          const sweep = sample.turns ? GAME_CONSTANTS3.AI.SCAN_SWEEP_ANGLE * Math.PI / 180 : 0;
          const inCone = offset <= halfAngle + sweep;
          const peripheral = !narrow && distance2 <= profile.sightRangePeriph && offset <= profile.sightHalfAnglePeriph * Math.PI / 180 + sweep;
          const visual = los && distance2 <= range2 && (inCone || peripheral) ? (0.25 + 0.75 * (1 - distance2 / range2)) * (inCone ? 1 : 0.5) : 0;
          const heardRange = hearing * (los ? 1 : profile.hearingWallFactor);
          const heard = distance2 <= heardRange ? (profile.hearingWeight > 0 ? 0.28 : 0.08) * (1 - distance2 / heardRange) : 0;
          local[cell] = Math.max(local[cell], visual, heard);
        }
      }
      for (let i = 0; i < field2.length; i++) field2[i] = 1 - (1 - field2[i]) * (1 - local[i]);
    }
    return { field: field2, sources };
  }
  function evaluateDeployment(layout, conditions, terrain) {
    const contract = conditions.semantic, grid = new TileGrid3(layout.tileMap);
    if (grid.tileSize !== 32) throw new SemanticDeploymentError("requires the conservative 32px deployment grid");
    if (layout.kindlingNodes.length !== 8 || layout.contaminantNodes.length !== 3)
      throw new SemanticDeploymentError("requires exactly eight kindling and three contaminant identities");
    if (!Number.isFinite(contract.minimumDeepDetourPx) || contract.minimumDeepDetourPx <= 0 || !Number.isFinite(contract.safeMaxThreat) || contract.safeMaxThreat < 0 || contract.safeMaxThreat >= CONTESTED_THREAT || !Number.isFinite(contract.routeThreatPenalty) || contract.routeThreatPenalty <= 0)
      throw new SemanticDeploymentError("invalid frozen semantic contract");
    const g = { cols: grid.cols, rows: grid.rows, tile: grid.tileSize, walk: new Uint8Array(grid.cols * grid.rows) };
    for (let i = 0; i < g.walk.length; i++) g.walk[i] = grid.isWalkable(i % g.cols, Math.floor(i / g.cols)) ? 1 : 0;
    const routeGraph = { ...g, walk: g.walk.slice() };
    for (const enemy of layout.enemySpawns.filter(isStaticFloorBody)) routeGraph.walk[enemy.spawn.row * g.cols + enemy.spawn.col] = 0;
    const spawn = cellAt(g, layout.spawnPoint), exit = cellAt(g, layout.extractionPoint.position);
    const fromSpawn = shortestPaths(routeGraph, spawn), fromExit = shortestPaths(routeGraph, exit);
    const shortPath = reconstruct3(fromSpawn.parent, spawn, exit);
    if (!shortPath.length) throw new SemanticDeploymentError("static roster disconnects exit");
    const { field: threat, sources } = buildThreat(g, grid, layout.enemySpawns);
    const shortRoute = routeMetrics(g, shortPath, threat);
    let safePath = [], lowExposureRoute;
    for (const multiplier of [1, 2, 4]) {
      const path = reconstruct3(shortestPaths(routeGraph, spawn, threat, contract.routeThreatPenalty * multiplier).parent, spawn, exit);
      const route = routeMetrics(g, path, threat);
      if (route.lengthPx >= shortRoute.lengthPx + MIN_ROUTE_DETOUR && route.exposurePx <= shortRoute.exposurePx * (1 - MIN_EXPOSURE_REDUCTION)) {
        safePath = path;
        lowExposureRoute = route;
        break;
      }
    }
    if (!lowExposureRoute) throw new SemanticDeploymentError("no longer, materially lower-exposure route");
    const toSafe = flood2(routeGraph, safePath).distance;
    const approach = new Float32Array(threat.length);
    for (let i = 0; i < approach.length; i++) if (routeGraph.walk[i]) {
      const legThreat = (parents) => {
        let cell = i, distance2 = 0, peak = threat[i];
        while (parents[cell] >= 0 && distance2 < 3 * g.tile) {
          const next = parents[cell], a = center2(g, cell), b = center2(g, next);
          distance2 += Math.hypot(a.x - b.x, a.y - b.y);
          peak = Math.max(peak, threat[next]);
          cell = next;
        }
        return peak;
      };
      approach[i] = Math.min(legThreat(fromSpawn.parent), legThreat(fromExit.parent));
    }
    const occupied = [spawn, exit, ...layout.enemySpawns.map((e) => e.spawn.row * g.cols + e.spawn.col)];
    const extra = (cell) => fromSpawn.distance[cell] + fromExit.distance[cell] - fromSpawn.distance[exit];
    const candidates = [];
    for (let i = 0; i < g.walk.length; i++) if (routeGraph.walk[i] && Number.isFinite(fromSpawn.distance[i]) && fromSpawn.distance[i] >= 4 * g.tile && fromExit.distance[i] >= 5 * g.tile) candidates.push(i);
    const coarseDeep = candidates.filter((cell) => extra(cell) >= contract.minimumDeepDetourPx && approach[cell] >= CONTESTED_THREAT);
    const interaction = terrain && coarseDeep.length >= 3 ? measureInteractionAreas(layout, terrain) : void 0;
    const deepChecks = /* @__PURE__ */ new Map();
    const deep = coarseDeep.filter((cell) => {
      if (!terrain) return true;
      const check = interaction?.at(center2(g, cell));
      if (check) deepChecks.set(cell, check);
      return check !== void 0 && check.minimumExtraPx >= contract.minimumDeepDetourPx && check.minimumApproachThreat >= CONTESTED_THREAT;
    });
    const contested = candidates.filter((cell) => threat[cell] >= CONTESTED_THREAT && fromSpawn.distance[cell] >= 7 * g.tile && fromExit.distance[cell] >= 8 * g.tile && extra(cell) < contract.minimumDeepDetourPx * 0.85);
    const safe = candidates.filter((cell) => threat[cell] <= contract.safeMaxThreat && toSafe[cell] <= 2);
    const select = (pool, count, score, name) => {
      const selected = [];
      for (let i = 0; i < count; i++) {
        const available = pool.filter((cell2) => occupied.every((other) => gridDistance(g, cell2, other) >= 3) && (name !== "deep" || selected.every((other) => gridDistance(g, cell2, other) >= 6)));
        available.sort((a, b) => {
          const spacing = (cell2) => selected.length ? Math.min(...selected.map((other) => gridDistance(g, cell2, other))) * 3 : 0;
          return score(b) + spacing(b) - score(a) - spacing(a) || a - b;
        });
        if (!available.length) throw new SemanticDeploymentError(`insufficient separated ${name} seats (${pool.length})`);
        const cell = available[0];
        selected.push(cell);
        occupied.push(cell);
      }
      return selected;
    };
    const deepCells = select(deep, 3, (cell) => Math.min(extra(cell), contract.minimumDeepDetourPx * 2) / g.tile + approach[cell] * 12, "deep");
    const contestedCells = select(contested, 4, (cell) => 18 - Math.abs(threat[cell] - 0.45) * 20, "contested");
    const safeCells = select(safe, 4, (cell) => -toSafe[cell] * 3 - threat[cell] * 30 + Math.min(fromSpawn.distance[cell] / g.tile, 18) * 0.15, "safe");
    const assigned = [safeCells.slice(0, 3), contestedCells.slice(0, 3), deepCells.slice(0, 2)];
    const tiers = ["safe", "contested", "deep"];
    const nodeDiagnostics = [];
    const record = (id, tier, cell) => {
      const checked = tier === "deep" ? deepChecks.get(cell) : void 0;
      nodeDiagnostics.push({
        id,
        tier,
        threat: threat[cell],
        approachThreat: checked?.minimumApproachThreat ?? approach[cell],
        extraTravelPx: checked?.minimumExtraPx ?? extra(cell),
        costBasis: checked ? "interaction-area" : "conservative-node-center",
        ...checked ? { interactionSeats: checked.seats } : {}
      });
    };
    let index = 0;
    const kindlingNodes = assigned.flatMap((cells, t) => cells.map((cell) => {
      const previous = layout.kindlingNodes[index++];
      if (!previous) throw new SemanticDeploymentError("expected eight kindling identities");
      record(previous.id, tiers[t], cell);
      return { ...previous, tier: tiers[t], position: center2(g, cell) };
    }));
    const itemCells = [safeCells[3], contestedCells[3], deepCells[2]];
    const contaminantNodes = layout.contaminantNodes.map((node, i) => {
      const cell = itemCells[i];
      if (cell === void 0) throw new SemanticDeploymentError("expected three contaminant identities");
      record(node.id, tiers[i], cell);
      return { ...node, tier: tiers[i], position: center2(g, cell) };
    });
    const landmarkSeats = [];
    const addLandmark = (anchor, purpose, style) => {
      const cells = floodRadius(routeGraph, anchor, 3).filter((cell) => occupied.every((other) => gridDistance(g, cell, other) >= 3) && landmarkSeats.every((other) => gridDistance(g, cell, other.cell) >= 5));
      cells.sort((a, b) => gridDistance(g, a, anchor) - gridDistance(g, b, anchor) || a - b);
      if (!cells.length) throw new SemanticDeploymentError(`no readable ${purpose} landmark seat`);
      landmarkSeats.push({ cell: cells[0], purpose, style });
    };
    const turns = safePath.filter((cell, i) => i > 2 && i < safePath.length - 3 && cell - safePath[i - 1] !== safePath[i + 1] - cell);
    const mainTurn = turns[Math.floor(turns.length / 2)] ?? safePath[Math.floor(safePath.length / 2)];
    addLandmark(mainTurn, "turn", "scratches");
    const deepEntryPath = reconstruct3(fromSpawn.parent, spawn, deepCells[0]);
    addLandmark(deepEntryPath[Math.max(0, deepEntryPath.length - 5)], "deep-approach", "crystals");
    addLandmark(safePath[Math.max(0, safePath.length - 5)], "exit-approach", "rubble");
    const landmarks = landmarkSeats.map((seat, i) => ({
      id: `LMK_${i + 1}`,
      col: seat.cell % g.cols,
      row: Math.floor(seat.cell / g.cols),
      style: seat.style
    }));
    return { layout: { ...layout, kindlingNodes, contaminantNodes, landmarks }, diagnostics: {
      version: 1,
      encounterAdjustments: [],
      shortRoute,
      lowExposureRoute,
      exposureReduction: 1 - lowExposureRoute.exposurePx / shortRoute.exposurePx,
      extraRoutePx: lowExposureRoute.lengthPx - shortRoute.lengthPx,
      nodes: nodeDiagnostics,
      landmarks: landmarkSeats.map((seat, i) => ({ id: landmarks[i].id, purpose: seat.purpose })),
      threatSources: sources
    } };
  }
  function floodRadius(g, start, radius) {
    const seen = /* @__PURE__ */ new Set([start]), queue = [{ cell: start, distance: 0 }];
    for (let i = 0; i < queue.length; i++) {
      const { cell, distance: distance2 } = queue[i];
      if (distance2 >= radius) continue;
      for (const next of adjacent(g, cell)) if (!seen.has(next)) {
        seen.add(next);
        queue.push({ cell: next, distance: distance2 + 1 });
      }
    }
    return [...seen];
  }
  function applySemanticDeployment(layout, conditions, terrain) {
    let originalFailure;
    try {
      return evaluateDeployment(layout, conditions, terrain);
    } catch (error) {
      if (!(error instanceof SemanticDeploymentError)) throw error;
      originalFailure = error;
    }
    const grid = new TileGrid3(layout.tileMap), tile = grid.tileSize;
    if (tile !== 32 || layout.enemySpawns.length < 2) throw originalFailure;
    const g = { cols: grid.cols, rows: grid.rows, tile, walk: new Uint8Array(grid.cols * grid.rows) };
    for (let i = 0; i < g.walk.length; i++) g.walk[i] = grid.isWalkable(i % g.cols, Math.floor(i / g.cols)) ? 1 : 0;
    const spawn = cellAt(g, layout.spawnPoint), exit = cellAt(g, layout.extractionPoint.position);
    const fromSpawn = shortestPaths(g, spawn), fromExit = shortestPaths(g, exit), direct = fromSpawn.distance[exit];
    const path = reconstruct3(fromSpawn.parent, spawn, exit);
    if (!path.length || !Number.isFinite(conditions.semantic.minimumDeepDetourPx)) throw originalFailure;
    const extra = (cell) => fromSpawn.distance[cell] + fromExit.distance[cell] - direct;
    const deepArea = [];
    for (let i = 0; i < g.walk.length; i++) if (g.walk[i] && Number.isFinite(fromSpawn.distance[i]) && extra(i) >= conditions.semantic.minimumDeepDetourPx - tile * 2 && fromSpawn.distance[i] >= 10 * tile && fromExit.distance[i] >= 12 * tile) deepArea.push(i);
    const capacity = /* @__PURE__ */ new Map();
    for (const cell of deepArea) capacity.set(cell, floodRadius(g, cell, 4).filter((p) => extra(p) >= conditions.semantic.minimumDeepDetourPx).length);
    const ranked = deepArea.filter((cell) => (capacity.get(cell) ?? 0) >= 12).sort((a, b) => capacity.get(b) - capacity.get(a) || extra(a) - extra(b) || a - b);
    const anchors = [];
    for (const cell of ranked) {
      if (anchors.every((other) => gridDistance(g, cell, other) >= 6)) anchors.push(cell);
      if (anchors.length === 6) break;
    }
    const eligible = layout.enemySpawns.slice(1).sort((a, b) => Number(floorMotionFor2(a.form ?? INFILTRATOR_FORM2) === "motion_patrol") - Number(floorMotionFor2(b.form ?? INFILTRATOR_FORM2) === "motion_patrol") || a.id.localeCompare(b.id));
    let attempts = 0, lastFailure = String(originalFailure);
    for (const anchor of anchors) for (const enemy of eligible) {
      if (++attempts > 12) break;
      if (layout.enemySpawns.some((other) => other.id !== enemy.id && gridDistance(g, anchor, other.spawn.row * g.cols + other.spawn.col) < 4)) continue;
      const position = center2(g, anchor), nearest = [...path].sort((a, b) => gridDistance(g, anchor, a) - gridDistance(g, anchor, b) || a - b)[0];
      const inward = center2(g, nearest), facing = historicalAtan2(position.y - inward.y, position.x - inward.x) * 180 / Math.PI;
      let waypoints = [{ col: anchor % g.cols, row: Math.floor(anchor / g.cols) }];
      const motion = floorMotionFor2(enemy.form ?? (enemy.type === "rewriter" ? REWRITER_FORM2 : INFILTRATOR_FORM2));
      if (motion === "motion_patrol") {
        const fromAnchor = shortestPaths(g, anchor);
        const end = ranked.filter((cell) => fromAnchor.distance[cell] >= 5 * tile && fromAnchor.distance[cell] <= 10 * tile && layout.enemySpawns.every((other) => other.id === enemy.id || gridDistance(g, cell, other.spawn.row * g.cols + other.spawn.col) >= 3)).sort((a, b) => capacity.get(b) - capacity.get(a) || fromAnchor.distance[a] - fromAnchor.distance[b] || a - b)[0];
        if (end === void 0) continue;
        const corridor = reconstruct3(flood2(g, [anchor]).parent, anchor, end);
        if (!corridor.length || corridor.some((cell) => fromSpawn.distance[cell] < 8 * tile || fromExit.distance[cell] < 10 * tile)) continue;
        waypoints = [waypoints[0], { col: end % g.cols, row: Math.floor(end / g.cols) }];
      }
      const moved = {
        ...enemy,
        spawn: waypoints[0],
        facing,
        patrol: { ...enemy.patrol, mode: motion === "motion_patrol" ? "pingpong" : "static", waypoints }
      };
      const movedThreat = buildThreat(g, grid, [moved]).field;
      if (movedThreat[spawn] > 1e-3 || movedThreat[exit] > 1e-3 || path.some((cell) => fromExit.distance[cell] <= 5 * tile && movedThreat[cell] >= CONTESTED_THREAT)) continue;
      const enemies = layout.enemySpawns.map((value) => value.id === enemy.id ? moved : value);
      try {
        const result = evaluateDeployment({ ...layout, enemySpawns: enemies }, conditions, terrain);
        return { ...result, diagnostics: { ...result.diagnostics, encounterAdjustments: [{
          id: enemy.id,
          from: center2(g, enemy.spawn.row * g.cols + enemy.spawn.col),
          to: position
        }] } };
      } catch (error) {
        if (!(error instanceof SemanticDeploymentError)) throw error;
        lastFailure = error.message;
      }
    }
    throw new SemanticDeploymentError(`initial and ${Math.min(attempts, 12)} bounded encounter seats rejected; ${lastFailure}`);
  }
  function measureInteractionAreas(layout, terrain) {
    const grid = new TileGrid3(terrain.tileMap), tile = grid.tileSize, offset = terrain.coordinateOffset;
    if (tile !== 8 || !Number.isFinite(offset.x) || !Number.isFinite(offset.y))
      throw new SemanticDeploymentError("interaction admission requires the actual 8px terrain and coordinate offset");
    const g = { cols: grid.cols, rows: grid.rows, tile, walk: new Uint8Array(grid.cols * grid.rows) };
    const point = (p) => ({ x: p.x + offset.x, y: p.y + offset.y });
    const coarse = {
      cols: layout.tileMap.cols,
      rows: layout.tileMap.rows,
      tile: layout.tileMap.tileSize,
      walk: Uint8Array.from(layout.tileMap.tiles.flat(), (value) => value === 1 || value === 2 ? 1 : 0)
    };
    const fineSeat = (p) => {
      const world = point({ x: (p.col + 0.5) * coarse.tile, y: (p.row + 0.5) * coarse.tile });
      return { col: Math.floor(world.x / tile), row: Math.floor(world.y / tile) };
    };
    const enemies = layout.enemySpawns.map((enemy) => {
      const waypoints = [];
      for (let leg = 1; leg < enemy.patrol.waypoints.length; leg++) {
        const a = enemy.patrol.waypoints[leg - 1], b = enemy.patrol.waypoints[leg];
        const start = a.row * coarse.cols + a.col, goal = b.row * coarse.cols + b.col;
        const route = reconstruct3(flood2(coarse, [start]).parent, start, goal);
        const bends = route.filter((cell, i) => i === 0 || i === route.length - 1 || cell - route[i - 1] !== route[i + 1] - cell);
        for (const cell of bends) {
          const seat = fineSeat({ col: cell % coarse.cols, row: Math.floor(cell / coarse.cols) });
          const last = waypoints[waypoints.length - 1];
          if (!last || last.col !== seat.col || last.row !== seat.row) waypoints.push(seat);
        }
      }
      if (!waypoints.length) waypoints.push(fineSeat(enemy.spawn));
      return { ...enemy, spawn: fineSeat(enemy.spawn), patrol: { ...enemy.patrol, waypoints } };
    });
    const staticBodies = enemies.filter(isStaticFloorBody).map((enemy) => center2(g, enemy.spawn.row * g.cols + enemy.spawn.col));
    const half = GAME_CONSTANTS3.PLAYER.BODY_SIZE / 2, clearance2 = half + GAME_CONSTANTS3.AI.BODY_SIZE / 2;
    for (let cell = 0; cell < g.walk.length; cell++) {
      const p = center2(g, cell);
      g.walk[cell] = bodyHasSupport2(grid, p, half, half) && !staticBodies.some((body) => Math.abs(p.x - body.x) < clearance2 - 1e-3 && Math.abs(p.y - body.y) < clearance2 - 1e-3) ? 1 : 0;
    }
    const spawn = cellAt(g, point(layout.spawnPoint)), exit = point(layout.extractionPoint.position), exitSeats = [];
    for (let cell = 0; cell < g.walk.length; cell++) if (g.walk[cell]) {
      const p = center2(g, cell);
      if (Math.hypot(p.x - exit.x, p.y - exit.y) <= layout.extractionPoint.triggerRadius) exitSeats.push(cell);
    }
    if (!g.walk[spawn] || !exitSeats.length) throw new SemanticDeploymentError("actual body cannot enter or use extraction area");
    const fromSpawn = shortestPaths(g, spawn), toExit = shortestPaths(g, exitSeats), direct = toExit.distance[spawn];
    if (!Number.isFinite(direct)) throw new SemanticDeploymentError("actual body has no extraction route");
    const senseGraph = { ...g, walk: Uint8Array.from({ length: g.walk.length }, (_, cell) => grid.isWalkable(cell % g.cols, Math.floor(cell / g.cols)) ? 1 : 0) };
    const { field: threat } = buildThreat(senseGraph, grid, enemies);
    const legThreat = (cell, parents) => {
      let travelled = 0, peak = threat[cell];
      while (parents[cell] >= 0 && travelled < 96) {
        const next = parents[cell], a = center2(g, cell), b = center2(g, next);
        travelled += Math.hypot(a.x - b.x, a.y - b.y);
        peak = Math.max(peak, threat[next]);
        cell = next;
      }
      return peak;
    };
    return { at(node) {
      const target = point(node), radius = GAME_CONSTANTS3.LOOT.SEARCH_RADIUS;
      let minimumExtraPx = Infinity, minimumApproachThreat = Infinity, seats = 0;
      const left = Math.max(0, Math.ceil((target.x - radius) / tile - 0.5));
      const right = Math.min(g.cols - 1, Math.floor((target.x + radius) / tile - 0.5));
      const top = Math.max(0, Math.ceil((target.y - radius) / tile - 0.5));
      const bottom = Math.min(g.rows - 1, Math.floor((target.y + radius) / tile - 0.5));
      for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
        const cell = row * g.cols + col, p = center2(g, cell);
        if (!g.walk[cell] || !Number.isFinite(fromSpawn.distance[cell]) || !Number.isFinite(toExit.distance[cell]) || Math.hypot(p.x - target.x, p.y - target.y) > radius || !hasLineOfSight2(grid, p, target, radius + 1e-3)) continue;
        seats++;
        minimumExtraPx = Math.min(minimumExtraPx, fromSpawn.distance[cell] + toExit.distance[cell] - direct);
        minimumApproachThreat = Math.min(minimumApproachThreat, legThreat(cell, fromSpawn.parent), legThreat(cell, toExit.parent));
      }
      return seats ? { minimumExtraPx, minimumApproachThreat, seats } : void 0;
    } };
  }
  function validWorldFallbackSeeds(value) {
    return Array.isArray(value) && value.length <= 32 && new Set(value).size === value.length && value.every((seed2) => Number.isSafeInteger(seed2) && seed2 >= 0 && seed2 <= 4294967295);
  }
  var COLOR_ROLES = ["void", "shadow", "floorDeep", "floor", "floorLight", "materialDark", "materialMid", "materialLight", "faceLight", "accentDim", "peak", "actorDark", "actorMid", "actorLight", "ground", "groundLight", "groundDark", "wall", "wallLight", "wallDark", "accent", "accentLight"];
  var named = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;
  function validWorldProductionRecipe2(value) {
    try {
      if (!value || typeof value !== "object") return false;
      const recipe = value, profile = recipe.profile;
      if (recipe.version !== 1 && recipe.version !== 2 || recipe.paintGeometryVersion !== void 0 && recipe.paintGeometryVersion !== 1 && recipe.paintGeometryVersion !== 2 || !Number.isSafeInteger(recipe.requestedSeed) || recipe.requestedSeed < 0 || recipe.requestedSeed > 4294967295 || !profile || !named(profile.id) || !named(profile.label) || typeof profile.description !== "string" || profile.description.length > 2e3 || !["strata", "crystal", "glaze"].includes(profile.material) || !profile.palette || !COLOR_ROLES.every((key) => Number.isSafeInteger(profile.palette[key]) && profile.palette[key] >= 0 && profile.palette[key] <= 16777215) || !recipe.space || !named(recipe.space.id) || !named(recipe.space.label) || !named(recipe.contentFragmentTypeId) || !CONTAMINATION_DIALECT_DATA2[recipe.contentFragmentTypeId]) return false;
      validateSurfaceRecipe(profile.surface);
      validateSpaceProfile(recipe.space);
      if (recipe.version === 2 && (recipe.paintGeometryVersion !== 2 || !validWorldConditions(recipe.conditions) || recipe.conditions.seed !== recipe.requestedSeed || !validWorldFallbackSeeds(recipe.conditions.fallbackSeeds))) return false;
      return true;
    } catch {
      return false;
    }
  }
  var HOST_TILE2 = GAME_CONSTANTS3.TILE_SIZE;
  var HALF_BODY4 = GAME_CONSTANTS3.PLAYER.BODY_SIZE / 2;
  var STATIC_CLEARANCE2 = HALF_BODY4 + GAME_CONSTANTS3.AI.BODY_SIZE / 2;
  var MAX_ATTEMPTS = 8;
  var RETRY_STRIDE = 104729;
  var DIRECTIONS22 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function center22(grid, cell) {
    return { x: (cell % grid.cols + 0.5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + 0.5) * grid.tileSize };
  }
  function tileMapOf(bits2, cols, rows, tileSize) {
    return { cols, rows, tileSize, tiles: Array.from({ length: rows }, (_, row) => Array.from(
      { length: cols },
      (_2, col) => bits2[row * cols + col] ? 1 : 3
      /* VOID */
    )) };
  }
  function hostFloorOf(sample) {
    const fine = getWorldSupportGrid(sample), scale = HOST_TILE2 / fine.tileSize;
    const cols = fine.cols / scale, rows = fine.rows / scale;
    if (!Number.isInteger(scale) || !Number.isInteger(cols) || !Number.isInteger(rows))
      throw new Error("World support must align with the 32px Host grid");
    const floor = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      let supported = true;
      for (let y = 0; y < scale && supported; y++) for (let x = 0; x < scale; x++)
        if (!fine.walkable[(row * scale + y) * fine.cols + col * scale + x]) {
          supported = false;
          break;
        }
      floor[row * cols + col] = supported ? 1 : 0;
    }
    const seen = new Uint8Array(floor.length);
    let largest = [];
    for (let first = 0; first < floor.length; first++) {
      if (!floor[first] || seen[first]) continue;
      const queue = [first];
      seen[first] = 1;
      for (let at14 = 0; at14 < queue.length; at14++) {
        const cell = queue[at14], col = cell % cols, row = Math.floor(cell / cols);
        for (const [dx, dy] of DIRECTIONS22) {
          const x = col + dx, y = row + dy, next = y * cols + x;
          if (x < 0 || y < 0 || x >= cols || y >= rows || !floor[next] || seen[next]) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
      if (queue.length > largest.length) largest = queue;
    }
    floor.fill(0);
    for (const cell of largest) floor[cell] = 1;
    return { floor, tileMap: tileMapOf(floor, cols, rows, HOST_TILE2) };
  }
  function ruinsOf(seed2, fragmentTypeId, tileMap, land) {
    const { cols, rows, tileSize } = tileMap;
    return {
      seed: seed2,
      attempt: 0,
      fragmentTypeId,
      tileMap,
      outline: { seed: seed2, attempt: 0, cols, rows, tileSize, land, tileMap, metrics: measureOutline2(land, cols, rows) },
      walls: new Uint8Array(land.length),
      features: [],
      metrics: { wallCount: 0, wallRatio: 0, featureCount: 0, leftoverConnected: true }
    };
  }
  function patrolRoute(grid, waypoints) {
    if (waypoints.length < 2) return [...waypoints];
    const result = [];
    for (let leg = 1; leg < waypoints.length; leg++) {
      const from = waypoints[leg - 1], to = waypoints[leg];
      const start = from.row * grid.cols + from.col, goal = to.row * grid.cols + to.col;
      const parent = new Int32Array(grid.cols * grid.rows).fill(-1), queue = [start];
      parent[start] = start;
      for (let at14 = 0; at14 < queue.length && parent[goal] === -1; at14++) {
        const cell = queue[at14], col = cell % grid.cols, row = Math.floor(cell / grid.cols);
        for (const [dx, dy] of DIRECTIONS22) {
          const x = col + dx, y = row + dy, next = y * grid.cols + x;
          if (!grid.isWalkable(x, y) || parent[next] !== -1) continue;
          parent[next] = cell;
          queue.push(next);
        }
      }
      if (parent[goal] === -1) throw new Error("No conservative body-safe patrol route");
      const path = [goal];
      while (path[path.length - 1] !== start) path.push(parent[path[path.length - 1]]);
      path.reverse();
      result.push(...leg === 1 ? path : path.slice(1));
    }
    return result.filter((cell, i) => i === 0 || i === result.length - 1 || cell - result[i - 1] !== result[i + 1] - cell).map((cell) => ({ col: cell % grid.cols, row: Math.floor(cell / grid.cols) }));
  }
  function bakeHost(layout, slot) {
    const form = layout.contaminationDraw.forms.filter((form2) => form2.portfolio === "bing")[slot];
    const seed2 = mix322(layout.seed, `ENM_BING_${String(slot + 1).padStart(2, "0")}`);
    return bakePaintGenome2({
      substrate: form.substrate,
      coverage: form.coverage,
      seed: seed2,
      continuity: form.continuity,
      sense: form.lexemes.sense,
      rhythm: form.lexemes.rhythm,
      fragmentTypeId: layout.fragmentTypeId,
      veinVariant: resolvePaintVeinVariant2(form.substrate, seed2),
      geometryVersion: layout.paintGeometryVersion ?? 1
    });
  }
  function seatCompletePaint(layout, grid, excludeItems = false, protectedRoute = []) {
    const tileAt = (point) => ({ col: Math.floor(point.x / HOST_TILE2), row: Math.floor(point.y / HOST_TILE2) });
    const spawn = tileAt(layout.spawnPoint);
    const exit = tileAt(layout.extractionPoint.position);
    const fuel = new Set([...layout.kindlingNodes, ...excludeItems ? layout.contaminantNodes : []].map((node) => {
      const cell = tileAt(node.position);
      return `${cell.col},${cell.row}`;
    }));
    const routeClearance = /* @__PURE__ */ new Set();
    const protect = (point) => {
      const cell = tileAt(point);
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) routeClearance.add(`${cell.col + x},${cell.row + y}`);
    };
    for (let i = 0; i < protectedRoute.length; i++) {
      const b = protectedRoute[i], a = protectedRoute[Math.max(0, i - 1)];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (HOST_TILE2 / 2)));
      for (let step = 0; step <= steps; step++) protect({
        x: a.x + (b.x - a.x) * step / steps,
        y: a.y + (b.y - a.y) * step / steps
      });
    }
    const candidates = [];
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++)
      if (grid.isWalkable(col, row)) candidates.push({ col, row });
    const occupied = /* @__PURE__ */ new Set();
    const paintFloors = layout.contaminationPins.paintFloors.map((pin, slot) => {
      const baked = bakeHost(layout, slot);
      const cells = (field2) => collectPaintGenomeFloorTiles2(
        field2,
        baked.canvasW,
        baked.canvasH,
        HOST_TILE2 / 2,
        HOST_TILE2 / 2,
        HOST_TILE2
      );
      const support = cells(baked.terrainFootprintField), danger = cells(baked.field);
      const allowed = candidates.filter((seat2) => support.every((offset) => grid.isWalkable(seat2.col + offset.col, seat2.row + offset.row)) && danger.every((offset) => {
        const col = seat2.col + offset.col, row = seat2.row + offset.row;
        return Math.max(Math.abs(col - spawn.col), Math.abs(row - spawn.row)) > 3 && Math.max(Math.abs(col - exit.col), Math.abs(row - exit.row)) > 3 && !fuel.has(`${col},${row}`) && !occupied.has(`${col},${row}`) && !routeClearance.has(`${col},${row}`);
      }));
      allowed.sort((a, b) => {
        const distance2 = (p) => (p.col - pin.floorCol) ** 2 + (p.row - pin.floorRow) ** 2;
        return distance2(a) - distance2(b) || a.row - b.row || a.col - b.col;
      });
      const seat = allowed[0];
      if (!seat) throw new Error(`No complete terrain footprint for paint Host ${slot + 1}`);
      for (const offset of danger) occupied.add(`${seat.col + offset.col},${seat.row + offset.row}`);
      return { ...pin, floorCol: seat.col, floorRow: seat.row };
    });
    return { ...layout, contaminationPins: { ...layout.contaminationPins, paintFloors } };
  }
  function admitPaintHosts(layout, hostGrid) {
    const forms = layout.contaminationDraw.forms.filter((form) => form.portfolio === "bing");
    const config = GAME_CONSTANTS3.CONTAMINATION;
    for (const [slot, form] of forms.entries()) {
      const pin = layout.contaminationPins.paintFloors[slot];
      const baked = bakeHost(layout, slot);
      if (layout.paintGeometryVersion === 2 && collectPaintGenomeFloorTiles2(
        baked.terrainFootprintField,
        baked.canvasW,
        baked.canvasH,
        (pin.floorCol + 0.5) * HOST_TILE2,
        (pin.floorRow + 0.5) * HOST_TILE2,
        HOST_TILE2
      ).some((point) => !hostGrid.isWalkable(point.col, point.row))) throw new Error("Paint Host would be terrain-clipped");
      const floors = collectPaintGenomeFloorTiles2(
        baked.field,
        baked.canvasW,
        baked.canvasH,
        (pin.floorCol + 0.5) * HOST_TILE2,
        (pin.floorRow + 0.5) * HOST_TILE2,
        HOST_TILE2
      ).filter((point) => hostGrid.isWalkable(point.col, point.row));
      const stop = resolveStopLoss(form);
      if (stop === "illegal" || floors.length === 0) throw new Error("Paint Host has no legal production surface");
      if (stop.family === "scatter_rejoin" && colonyNucleusSeatsInFloors(
        floors,
        config.COLONY_NUCLEUS_COUNT_MIN,
        config.COLONY_NUCLEUS_COUNT_MAX,
        config.COLONY_NUCLEUS_MIN_TILE_GAP,
        2
      ).length < config.COLONY_NUCLEUS_COUNT_MIN)
        throw new Error("Paint Host lost its production nucleus quota");
    }
  }
  function physicalAdmission(layout) {
    const grid = new TileGrid3(layout.tileMap), total = grid.cols * grid.rows;
    const bodies = layout.enemySpawns.filter(isStaticFloorBody).map((enemy) => ({ x: (enemy.spawn.col + 0.5) * grid.tileSize, y: (enemy.spawn.row + 0.5) * grid.tileSize }));
    const seats = new Uint8Array(total), distances = new Int32Array(total).fill(-1);
    const index = (point) => Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
    for (let cell = 0; cell < total; cell++) {
      const point = center22(grid, cell);
      seats[cell] = bodyHasSupport2(grid, point, HALF_BODY4, HALF_BODY4) && !bodies.some((body) => Math.abs(point.x - body.x) < STATIC_CLEARANCE2 - 1e-3 && Math.abs(point.y - body.y) < STATIC_CLEARANCE2 - 1e-3) ? 1 : 0;
    }
    const start = index(layout.spawnPoint);
    if (!seats[start]) throw new Error("Production spawn lacks static-body-safe support");
    const queue = [start];
    distances[start] = 0;
    for (let at14 = 0; at14 < queue.length; at14++) {
      const cell = queue[at14], col = cell % grid.cols, row = Math.floor(cell / grid.cols), from = center22(grid, cell);
      for (const [dx, dy] of DIRECTIONS22) {
        const x = col + dx, y = row + dy, next = y * grid.cols + x;
        if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || distances[next] !== -1) continue;
        if (bodyDisplacementFraction2(grid, from, HALF_BODY4, HALF_BODY4, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
        distances[next] = distances[cell] + 1;
        queue.push(next);
      }
    }
    const targets = [
      layout.extractionPoint.position,
      ...layout.kindlingNodes.map((node) => node.position),
      ...layout.contaminantNodes.map((node) => node.position)
    ];
    for (const target of targets) if (distances[index(target)] < 0)
      throw new Error("Production target lacks a complete body route around permanent enemies");
    for (const enemy of layout.enemySpawns) for (const point of [enemy.spawn, ...enemy.patrol.waypoints]) {
      if (!bodyHasSupport2(grid, { x: (point.col + 0.5) * grid.tileSize, y: (point.row + 0.5) * grid.tileSize }, HALF_BODY4, HALF_BODY4))
        throw new Error(`Enemy ${enemy.id} lacks complete body support`);
    }
    for (const enemy of layout.enemySpawns) for (let i = 1; i < enemy.patrol.waypoints.length; i++) {
      const a = enemy.patrol.waypoints[i - 1], b = enemy.patrol.waypoints[i];
      const from = { x: (a.col + 0.5) * grid.tileSize, y: (a.row + 0.5) * grid.tileSize };
      if (bodyDisplacementFraction2(grid, from, HALF_BODY4, HALF_BODY4, (b.col - a.col) * grid.tileSize, (b.row - a.row) * grid.tileSize) < 1)
        throw new Error(`Enemy ${enemy.id} patrol crosses unsupported terrain`);
    }
    return { reachableBodySeats: queue.length, extractionRoutePx: distances[index(layout.extractionPoint.position)] * grid.tileSize };
  }
  function admit(sample, space, options, requestedSeed, attempt, rejected) {
    const support = getWorldSupportGrid(sample), host = hostFloorOf(sample), axes = rollFragmentAxes(sample.seed);
    const hostGrid = new TileGrid3(host.tileMap);
    const tileMap = tileMapOf(support.walkable, support.cols, support.rows, support.tileSize);
    let semantic;
    const placement = deployRiftContents(sample.seed, ruinsOf(sample.seed, options.contentFragmentTypeId, host.tileMap, host.floor), {
      recipeId: `world-space:${space.id}`,
      ...axes,
      routePolicy: "open-world",
      // Void is an occluder in the accepted terrain. This mask changes only route
      // exposure measurements; no WALL is invented for rendering, physics or pins.
      routeObstructions: Uint8Array.from(host.floor, (floor) => floor ? 0 : 1),
      ...options.generationVersion === 2 ? {
        placementTag: `conditions:${options.conditions.streams.placement}`,
        lexiconSeed: options.conditions.streams.encounters,
        postprocess: (candidate) => {
          try {
            const result = applySemanticDeployment(candidate, options.conditions, {
              tileMap,
              coordinateOffset: { x: support.tileSize / 2, y: support.tileSize / 2 }
            });
            const painted = seatCompletePaint(
              {
                ...result.layout,
                fragmentTypeId: `world-study:${sample.profile.id}`,
                paintGeometryVersion: 2
              },
              hostGrid,
              true,
              result.diagnostics.lowExposureRoute.points
            );
            admitPaintHosts(painted, hostGrid);
            semantic = { ...result, layout: { ...result.layout, contaminationPins: painted.contaminationPins } };
            return semantic.layout;
          } catch (reason) {
            return reason instanceof Error ? reason.message : String(reason);
          }
        }
      } : {}
    });
    if (typeof placement === "string") throw new Error(placement);
    const deployed = placement;
    const fragmentTypeId = `world-study:${sample.profile.id}`;
    const scale = HOST_TILE2 / support.tileSize;
    const fineCell = (point) => ({ col: point.col * scale + Math.floor(scale / 2), row: point.row * scale + Math.floor(scale / 2) });
    const finePoint = (point) => ({ x: point.x + support.tileSize / 2, y: point.y + support.tileSize / 2 });
    let layout = {
      ...deployed,
      fragmentTypeId,
      tileMap,
      walkableMask: new TileGrid3(tileMap),
      ...(options.paintGeometryVersion ?? 2) === 2 ? { paintGeometryVersion: 2 } : {},
      ruins: { ...ruinsOf(sample.seed, fragmentTypeId, tileMap, support.walkable.slice()), ...axes },
      spawnPoint: finePoint(deployed.spawnPoint),
      extractionPoint: { ...deployed.extractionPoint, position: finePoint(deployed.extractionPoint.position) },
      kindlingNodes: deployed.kindlingNodes.map((node) => ({ ...node, position: finePoint(node.position) })),
      contaminantNodes: deployed.contaminantNodes.map((node) => ({ ...node, position: finePoint(node.position) })),
      enemySpawns: deployed.enemySpawns.map((enemy) => ({
        ...enemy,
        spawn: fineCell(enemy.spawn),
        patrol: { ...enemy.patrol, waypoints: patrolRoute(hostGrid, enemy.patrol.waypoints).map(fineCell) }
      })),
      landmarks: deployed.landmarks.map((landmark) => ({ ...landmark, ...fineCell(landmark) }))
    };
    if (layout.paintGeometryVersion === 2 && options.generationVersion !== 2)
      layout = seatCompletePaint(layout, hostGrid);
    const expectedPaint = rollPaintHostCount(sample.seed, axes.contaminationAge);
    if (layout.kindlingNodes.length !== 8 || layout.contaminantNodes.length !== 3 || layout.enemySpawns.length < 3 || layout.enemySpawns.length > 4 || layout.contaminationPins.paintFloors.length !== expectedPaint || layout.contaminationDraw.forms.filter((form) => form.portfolio === "bing").length !== expectedPaint || layout.contaminationDraw.forms.filter((form) => form.lexemes.sense === "sense_hear").length !== 1)
      throw new Error("Production content quota or hearing budget was lost");
    const access = physicalAdmission(layout);
    admitPaintHosts(layout, hostGrid);
    if (options.generationVersion === 2) sample = attachWorldScenery({
      ...sample,
      materialSeed: options.conditions.streams.material
    }, options.conditions, layout.landmarks, layout.tileMap.tileSize);
    let hash2 = 2166136261;
    for (const floor of support.walkable) hash2 = Math.imul(hash2 ^ floor, 16777619);
    for (const floor of host.floor) hash2 = Math.imul(hash2 ^ floor, 16777619);
    const definition = JSON.stringify({
      profile: sample.profile,
      space,
      contentFragmentTypeId: options.contentFragmentTypeId,
      seed: sample.seed,
      ...axes,
      spawnPoint: layout.spawnPoint,
      extraction: layout.extractionPoint,
      kindling: layout.kindlingNodes,
      contaminants: layout.contaminantNodes,
      enemies: layout.enemySpawns,
      landmarks: layout.landmarks,
      pins: layout.contaminationPins,
      draw: layout.contaminationDraw,
      ...options.generationVersion === 2 ? { conditions: options.conditions } : {}
    });
    for (let i = 0; i < definition.length; i++) hash2 = Math.imul(hash2 ^ definition.charCodeAt(i), 16777619);
    return { sample, layout, hostTileMap: host.tileMap, metadata: {
      world: sample.profile.id,
      space: space.id,
      contentFragmentTypeId: options.contentFragmentTypeId,
      requestedSeed,
      effectiveSeed: sample.seed,
      attempt,
      rejected: [...rejected],
      signature: (hash2 >>> 0).toString(16).padStart(8, "0"),
      bodySize: HALF_BODY4 * 2,
      supportTileSize: support.tileSize,
      hostTileSize: HOST_TILE2,
      ...access,
      ...options.generationVersion === 2 ? {
        conditions: options.conditions,
        semantic: semantic.diagnostics,
        fallbackUsed: attempt >= MAX_ATTEMPTS
      } : {}
    } };
  }
  function createWorldProductionMap2(world, spaceInput, requestedSeed, options) {
    if (!Number.isSafeInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 4294967295)
      throw new Error("Production world seed must be an unsigned 32-bit integer");
    if (options.paintGeometryVersion !== void 0 && options.paintGeometryVersion !== 1 && options.paintGeometryVersion !== 2)
      throw new Error("Unknown paint geometry contract");
    if (options.generationVersion !== void 0 && options.generationVersion !== 1 && options.generationVersion !== 2)
      throw new Error("Unknown world generation contract");
    const conditional = options.generationVersion === 2;
    if (conditional ? !validWorldConditions(options.conditions) || options.conditions.seed !== requestedSeed || options.paintGeometryVersion === 1 : options.conditions !== void 0 || options.fallbackSeeds !== void 0)
      throw new Error("World conditions do not match the generation contract");
    if (options.fallbackSeeds !== void 0 && !validWorldFallbackSeeds(options.fallbackSeeds))
      throw new Error("Invalid frozen world fallback candidates");
    if (conditional && options.fallbackSeeds !== void 0 && JSON.stringify(options.fallbackSeeds) !== JSON.stringify(options.conditions.fallbackSeeds))
      throw new Error("Fallback candidates must match the frozen world conditions");
    let profile = typeof world === "string" ? worldProfileById2(world) : world;
    let space = typeof spaceInput === "string" ? SPACE_PROFILES2.find((value) => value.id === spaceInput) : spaceInput;
    if (!space) throw new Error(`Unknown space ${String(spaceInput)}`);
    validateSpaceProfile(space);
    if (conditional) ({ profile, space } = applyWorldConditions(profile, space, options.conditions));
    if (!CONTAMINATION_DIALECT_DATA2[options.contentFragmentTypeId])
      throw new Error(`Unregistered production content dialect: ${options.contentFragmentTypeId}`);
    const rejected = [];
    const baseSeed = conditional ? options.conditions.streams.layout : requestedSeed;
    const candidates = Array.from({ length: MAX_ATTEMPTS }, (_, attempt) => baseSeed + attempt * RETRY_STRIDE >>> 0);
    for (const seed2 of conditional ? options.conditions.fallbackSeeds : []) if (!candidates.includes(seed2)) candidates.push(seed2);
    for (let attempt = 0; attempt < candidates.length; attempt++) {
      const seed2 = candidates[attempt];
      try {
        return admit(generateWorldSample(
          profile,
          "loops",
          seed2,
          space,
          conditional ? worldOrganizationOf(options.conditions) : void 0
        ), space, options, requestedSeed, attempt, rejected);
      } catch (reason) {
        rejected.push({ seed: seed2, reason: reason instanceof Error ? reason.message : String(reason) });
      }
    }
    throw new Error(`Production world admission failed after ${candidates.length} bounded candidates: ${JSON.stringify(rejected)}`);
  }
  return { createWorldProductionMap: createWorldProductionMap2, generateRiftLayout: generateRiftLayout2, validWorldProductionRecipe: validWorldProductionRecipe2 };
}
var view = new DataView(new ArrayBuffer(8));
function parts(value) {
  view.setFloat64(0, value, false);
  const bits2 = view.getBigUint64(0, false), biased = Number(bits2 >> 52n & 2047n);
  const magnitude = bits2 & 0xfffffffffffffn | (biased === 0 ? 0n : 0x10000000000000n);
  return { coefficient: bits2 >> 63n ? -magnitude : magnitude, exponent: biased === 0 ? -1074 : biased - 1075 };
}
function exactBinary64Fma(a, b, c) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return a * b + c;
  const x = parts(a), y = parts(b), z = parts(c), product = x.coefficient * y.coefficient, pe = x.exponent + y.exponent;
  if (product === 0n && z.coefficient === 0n) return a * b + c;
  const exponent = product === 0n ? z.exponent : z.coefficient === 0n ? pe : Math.min(pe, z.exponent);
  let integer2 = (product === 0n ? 0n : product << BigInt(pe - exponent)) + (z.coefficient === 0n ? 0n : z.coefficient << BigInt(z.exponent - exponent));
  if (integer2 === 0n) return 0;
  const negative = integer2 < 0n;
  if (negative) integer2 = -integer2;
  const shift = Math.max(0, integer2.toString(2).length - 53, -1074 - exponent);
  if (shift > 0) {
    const length2 = BigInt(shift), rest = integer2 & (1n << length2) - 1n, half = 1n << length2 - 1n;
    integer2 >>= length2;
    if (rest > half || rest === half && (integer2 & 1n) !== 0n) integer2++;
  }
  const result = Number(integer2) * 2 ** (exponent + shift);
  return negative ? -result : result;
}
function binary64Fma(a, b, c) {
  const product = a * b, sum = product + c;
  if (Math.abs(a) < 1e100 && Math.abs(b) < 1e100 && Math.abs(product) > 1e-100 && Math.abs(sum) > 1e-100 && Number.isFinite(sum)) {
    const splitA = 134217729 * a, highA = splitA - (splitA - a), lowA = a - highA;
    const splitB = 134217729 * b, highB = splitB - (splitB - b), lowB = b - highB;
    const productError = highA * highB - product + highA * lowB + lowA * highB + lowA * lowB;
    const virtual = sum - product, sumError = product - (sum - virtual) + (c - virtual);
    const correction = productError + sumError, bound = Math.abs(correction) * Number.EPSILON;
    const lower = sum + (correction - bound), upper = sum + (correction + bound);
    if (Object.is(lower, upper)) return lower;
  }
  return exactBinary64Fma(a, b, c);
}
var bits = new DataView(new ArrayBuffer(8));
function high(value) {
  bits.setFloat64(0, value, false);
  return bits.getInt32(0, false);
}
var HI = [0.4636476090008061, 0.7853981633974483, 0.982793723247329, 1.5707963267948966];
var LO = [22698777452961687e-33, 3061616997868383e-32, 13903311031230998e-33, 6123233995736766e-32];
var AT = [
  0.3333333333333293,
  -0.19999999999876483,
  0.14285714272503466,
  -0.11111110405462356,
  0.09090887133436507,
  -0.0769187620504483,
  0.06661073137387531,
  -0.058335701337905735,
  0.049768779946159324,
  -0.036531572744216916,
  0.016285820115365782
];
function v8FdlibmAtan(x, fused = false) {
  const hx = high(x), ix = hx & 2147483647;
  let id;
  if (ix >= 1141899264) {
    if (Number.isNaN(x)) return x + x;
    return hx > 0 ? HI[3] + LO[3] : -HI[3] - LO[3];
  }
  if (ix < 1071382528) {
    if (ix < 1044381696 && 1e300 + x > 1) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 1072889856) {
      if (ix < 1072037888) {
        id = 0;
        x = (fused ? binary64Fma(2, x, -1) : 2 * x - 1) / (2 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 1073971200) {
      id = 2;
      x = (x - 1.5) / (fused ? binary64Fma(1.5, x, 1) : 1 + 1.5 * x);
    } else {
      id = 3;
      x = -1 / x;
    }
  }
  const z = x * x, w = z * z;
  let s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  let s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (fused) {
    let odd = AT[10], even = AT[9];
    for (let i = 8; i >= 0; i -= 2) odd = binary64Fma(w, odd, AT[i]);
    for (let i = 7; i >= 1; i -= 2) even = binary64Fma(w, even, AT[i]);
    s1 = z * odd;
    s2 = w * even;
  }
  if (id < 0) return fused ? binary64Fma(-x, s1 + s2, x) : x - x * (s1 + s2);
  const answer = HI[id] - ((fused ? binary64Fma(x, s1 + s2, -LO[id]) : x * (s1 + s2) - LO[id]) - x);
  return hx < 0 ? -answer : answer;
}
function v8FdlibmAtan2(y, x, fused = false) {
  const hx = high(x), hy = high(y), ix = hx & 2147483647, iy = hy & 2147483647;
  const pi = 3.141592653589793, piOver2 = 1.5707963267948966, piOver4 = 0.7853981633974483, piLo = 12246467991473532e-32, tiny = 1e-300;
  if (Number.isNaN(x) || Number.isNaN(y)) return x + y;
  if (x === 1) return v8FdlibmAtan(y, fused);
  let m = hy >> 31 & 1 | hx >> 30 & 2;
  if (y === 0) return m < 2 ? y : m === 2 ? pi + tiny : -pi - tiny;
  if (x === 0) return hy < 0 ? -piOver2 - tiny : piOver2 + tiny;
  if (ix === 2146435072) {
    if (iy === 2146435072) return m === 0 ? piOver4 + tiny : m === 1 ? -piOver4 - tiny : m === 2 ? 3 * piOver4 + tiny : -3 * piOver4 - tiny;
    return m === 0 ? 0 : m === 1 ? -0 : m === 2 ? pi + tiny : -pi - tiny;
  }
  if (iy === 2146435072) return hy < 0 ? -piOver2 - tiny : piOver2 + tiny;
  const k = iy - ix >> 20;
  let z;
  if (k > 60) {
    z = piOver2 + 0.5 * piLo;
    m &= 1;
  } else if (hx < 0 && k < -60) z = 0;
  else z = v8FdlibmAtan(Math.abs(y / x), fused);
  return m === 0 ? z : m === 1 ? -z : m === 2 ? pi - (z - piLo) : z - piLo - pi;
}
var v8Arm64Atan2 = (y, x) => v8FdlibmAtan2(y, x, true);
var __defProp2 = Object.defineProperty;
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField2 = (obj, key, value) => __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
var GAME_CONSTANTS2 = {
  /** Tile size in pixels */
  TILE_SIZE: 32,
  /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
  CAMERA: {
    ZOOM: 1.5
  },
  /** Player movement (docs/specs/system-movement-vision.md, section M) */
  PLAYER: {
    SPEED: 80,
    // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
    MOVE_ACCEL_TIME: 0.08,
    // s from standstill to full speed
    MOVE_DECEL_TIME: 0.1,
    // s from full speed to standstill
    FACING_TURN_RATE: 1080,
    // deg/s the vision cone swings toward the input direction
    FACING_QUANT_HYSTERESIS: 5,
    // deg of dead zone around the 45 degree facing4 boundaries
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 sprite
    SPEED_MOD_MIN: 0.5
    // floor on the multiplied speed modifier stack
  },
  /**
   * Presentation-only gait (art-direction §3.3). Does not change facingAngle,
   * facing4 snap timing, speeds, or colliders.
   */
  ACTOR_MOTION: {
    FRAME_COUNT: 4,
    TURN_MS: 180,
    LAG_PX: 3,
    LAG_ALPHA: 0.38,
    MOVE_SPEED_FLOOR: 6,
    // px/s; below this the idle cycle plays
    PLAYER_IDLE_FPS: 4,
    PLAYER_WALK_FPS: 8,
    INFILTRATOR_IDLE_FPS: 4,
    INFILTRATOR_WALK_FPS: 4,
    // puppet hitch supplies the step; keep the sheet slow
    REWRITER_IDLE_FPS: 4,
    REWRITER_WALK_FPS: 6
  },
  /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
  CHAOS: {
    START_VALUE: 0,
    MAX_VALUE: 100,
    // HUD gauge max (value CAN exceed this)
    HARD_CAP: 150,
    BASE_RATE: 0.5,
    // points per second (DEC-024: calibrated for 80 px/s travel)
    THRESHOLD_1: 50,
    THRESHOLD_2: 75,
    THRESHOLD_3: 100,
    COMBAT_BONUS: 5,
    DETECTION_BONUS: 3,
    DETECTION_BONUS_COOLDOWN: 1e4,
    // ms per-enemy cooldown on detection chaos
    CHASE_RATE_MULT: 2,
    EMIT_STEP: 1,
    // minimum delta before emitting CHAOS_CHANGED
    MODULATOR_STEP: 1
    // minimum delta before calling onModulate callback
  },
  /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
  LOOT: {
    /** 迭代 10 起退役，见 spec 规则 14。名义参数，代码无引用；由 SEARCH_RADIUS 取代。 */
    PICKUP_RADIUS: 16,
    NODE_COUNT: 8,
    VALUE_SAFE: 1,
    VALUE_CONTESTED: 2,
    VALUE_DEEP: 4,
    SEARCH_CHANNEL_MS: 1200,
    SEARCH_RADIUS: 48,
    SEARCH_NOISE_RADIUS: 96,
    SEARCH_NOISE_LEVEL: "suspicious"
  },
  /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
  EXTRACTION: {
    TRIGGER_RADIUS: 48,
    KEY: "E",
    SETTLE_DELAY_MS: 600,
    RESTART_KEY: "R"
  },
  /**
   * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
   * Models a forward cone unioned with an ambient ring, with three fixed-width edge
   * bands. The older single-radius + edge-softness model was replaced rather than
   * extended, so the two parameter sets never coexist.
   */
  VISIBILITY: {
    RADIUS_FORWARD: 224,
    // px straight ahead (7 tiles); must exceed every profile sightRange (I1)
    RADIUS_AMBIENT: 80,
    // px all around (2.5 tiles) = the lamp the player carries
    CONE_HALF_ANGLE: 50,
    // deg half-angle of the full-range sector
    CONE_FALLOFF_ANGLE: 30,
    // deg of transition from forward range down to ambient
    MIN_SOLID_RADIUS: 48,
    // px that stay fully lit no matter what
    EDGE_BAND_WIDTH: 32,
    // px per gradient band (1 tile, art-direction 4.3)
    BAND_ALPHAS: [1, 0.6, 0.2],
    // visibility of core / middle / outer band
    ERASE_ALPHAS: [1, 0.5, 0.2],
    // per-layer erase strength producing those alphas
    RAY_COUNT: 60,
    // architecture ceiling
    RAY_SPLIT_FORWARD: 40,
    // rays inside the cone sector
    RAY_SPLIT_AMBIENT: 20,
    // rays across the remaining angles
    RAY_COUNT_DEGRADED: 40,
    // first degradation step
    RAY_SPLIT_FORWARD_DEGRADED: 28,
    RAY_SPLIT_AMBIENT_DEGRADED: 12,
    MIN_RADIUS_SCALE: 0.4,
    // hard floor for the chaos radius modulator
    CACHE_POS_EPSILON: 0.5,
    // px of movement tolerated before the cache is dropped
    CACHE_ANGLE_EPSILON: 0.5,
    // deg of rotation tolerated before the cache is dropped
    BUDGET_MS: 2,
    // per-frame raycasting budget
    DEGRADE_SAMPLE_FRAMES: 30,
    // consecutive frames over budget before degrading
    /** Void outside the field of view */
    VOID_COLOR: 526860,
    VOID_NOISE_ALPHA: 0.04,
    VOID_NOISE_TILE: 64,
    // px noise texture size
    VOID_NOISE_SCROLL: 2,
    // px/s drift
    /** Warm lamp the player carries - the only warm light inside a rift */
    PLAYER_LAMP_COLOR: 9067562,
    PLAYER_LAMP_ALPHA: 0.12,
    /**
     * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
     * the vision cone by the darkness mask. This is what makes the forward cone read as
     * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
     */
    FLASHLIGHT_COLOR: 11047018,
    // pale warm; a saturated brown would wash the cold floor out
    FLASHLIGHT_ALPHA: 0.16,
    // low enough that fragment L1 (clinic/metro/soil) still reads under the cone
    FLASHLIGHT_FORWARD_FRAC: 0.34,
    // push the pool centre this fraction of forward range ahead
    FLASHLIGHT_RADIUS_FRAC: 0.85,
    // pool radius as a fraction of forward range
    /** Glow bleeding through the darkness (Slice 1: extraction point only) */
    GLOW_LEAK_ALPHA: 0.25,
    GLOW_LEAK_RADIUS: 48,
    /** Chaos corruption of the vision edge */
    CORRUPTION_COLOR: 1748374,
    CORRUPTION_MAX_MIX: 0.6,
    // alpha of the teal band at corruption 1.0
    CORRUPTION_MAX_DEPTH: 0.35,
    // fraction of the range teal can eat at corruption 1.0
    CORRUPTION_JITTER_PX: 4,
    CORRUPTION_JITTER_HZ: 6,
    /**
     * Overflow (chaos > 100) full-screen teal wash. Persistent base stays well below the
     * old 0.08 epilepsy cap; the jump is a discrete ~2 s pulse (not a strobe), so its
     * peak can read as a "skip" without a rapid flash train.
     */
    FLICKER_BASE_ALPHA: 0.05,
    FLICKER_JUMP_ALPHA: 0.16,
    FLICKER_JUMP_PERIOD_MS: 2200,
    FLICKER_JUMP_WIDTH_MS: 140,
    /** Extra teal bite / edge jitter scale at screenFlicker = 1.0 */
    OVERFLOW_CORRUPTION_DEPTH_BOOST: 0.4,
    OVERFLOW_JITTER_BOOST: 1,
    /** Purification point overrides (omni mode) */
    PURIFY_RADIUS: 400,
    PURIFY_RAY_COUNT: 90
  },
  /**
   * Enemy AI (docs/specs/system-enemy-ai.md, "数值结构"). Every AI number lives here;
   * none are inlined in the systems.
   *
   * Six of these values are load-bearing relations rather than free parameters - the
   * balance invariants I1-I6 that make stealth playable at all. `config/invariants.ts`
   * asserts them at boot so tuning cannot silently break one.
   *
   * The old `SIGHT_ANGLE: 90 // cone half-angle` key was removed rather than kept: its
   * meaning split into a core cone and a peripheral band, and three overlapping angle
   * parameters would have been three ways to be wrong.
   */
  AI: {
    // --- movement and body (shared; per-role speeds live in data/enemies.csv) ---
    TURN_RATE: 360,
    // deg/s; a third of the player's, which is what makes flanking work (I6)
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 infiltrator sprite
    SEPARATION_RADIUS: 24,
    // px; soft repulsion instead of enemy-vs-enemy physics
    SEPARATION_WEIGHT: 0.35,
    // how strongly separation bends the movement direction
    STANDOFF_DISTANCE: 30,
    // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
    STANDOFF_BAND: 4,
    // px of tolerance around it (26..34)
    STANDOFF_ADJUST_SPEED: 60,
    // px/s used to back off when the player crowds it
    // --- perception (shared; cone / hearing radii / weights live in data/enemies.csv) ---
    DETECT_FILL_TIME: 0.45,
    // s of clear sight to go from 0 to certain; then × visionWeight
    HEAR_FILL_TIME: 2,
    // s of hearing fill baseline; then × hearingWeight × moveMult
    HEARING_STILL_CAP: 0.2,
    // still-hearing cannot push detection past this (below 0.35)
    HEAR_ALERT_THRESHOLD: 0.7,
    // rewriter T0-4b: hearing can push to ALERT, never CHASE
    DETECT_DIST_FACTOR_NEAR: 1.6,
    // detection rate multiplier at point blank
    DETECT_DIST_FACTOR_FAR: 0.5,
    // ...and at the edge of sight range
    DETECT_ZONE_FACTOR_PERIPH: 0.45,
    // peripheral vision fills far slower than the core cone
    SUSPICION_THRESHOLD: 0.35,
    // detection at which it stops and turns - the player's warning
    REACQUIRE_THRESHOLD: 0.5,
    // lower bar to re-lock while already searching
    DETECT_DECAY_RATE: 0.67,
    // per s; ~1.5 s to clear after breaking sight
    DETECT_DECAY_ALERT_SCALE: 0.5,
    // decays half as fast while searching: it is holding a grudge
    HEARING_JITTER: 32,
    // px of positional fuzz, so hearing is not a wall-hack locator
    PERCEPTION_TICK_MS: 100,
    // 10 Hz perception; one raycast per enemy per tick
    PERCEPTION_TICK_MS_FAR: 200,
    // 5 Hz beyond ACTIVE_RANGE (rule N8)
    // --- timers (section "计时器") ---
    LOS_GRACE_MS: 400,
    // how long a chase survives with no line of sight
    LOST_PLAYER_DURATION: 5e3,
    // ms of ALERT searching
    ALERT_DURATION: 3e3,
    // ms a SUSPICIOUS enemy stays wary with no new stimulus
    CHASE_ABANDON_RANGE: 320,
    // px past which an unseen chase is given up
    WAYPOINT_PAUSE_MS: 1200,
    // dwell at a patrol waypoint - the player's window to slip past
    SCAN_HOLD_MS: 600,
    // dwell on each scan heading
    SEARCH_HOLD_MS: 800,
    // dwell at each ALERT search point
    EXTRAPOLATE_SEC: 0.6,
    // how far ahead of the last sighting to guess - punishes running straight
    SEARCH_SPREAD: 96,
    // px radius of the random third search point
    ALERT_EMIT_COOLDOWN_MS: 1e3,
    // suppression window for repeated same-level ENEMY_ALERT
    SUSPICIOUS_TURN_HOLD_MS: 200,
    // minimum standstill when turning to look (rule B2, ">= 0.2 s")
    SCAN_SWEEP_ANGLE: 45,
    // deg to each side when scanning in place
    SCAN_SWEEP_PERIOD_MS: 1500,
    // full left-right-left sweep period
    FACING_ARRIVE_EPSILON: 6,
    // deg within which a turn counts as completed
    // --- pathfinding and performance (section "寻路与性能") ---
    MAX_PATHS_PER_FRAME: 1,
    // architecture hard rule
    REPATH_INTERVAL_MS: 500,
    REPATH_INTERVAL_MS_FAR: 1e3,
    // for requests past SIMPLE_PATH_RANGE (rule N5)
    REPATH_MOVE_THRESHOLD: 48,
    // px of target movement that earns an early chase repath
    SIMPLE_PATH_RANGE: 384,
    // px past which a request drops to the lowest priority
    ASTAR_MAX_NODES: 3e3,
    // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
    PATH_FAIL_LIMIT: 3,
    // consecutive failures before giving up on the goal
    ACTIVE_RANGE: 640,
    // px; beyond this the FSM runs at 5 Hz and never asks for a path
    ARRIVE_EPSILON: 8,
    // px within which a path point counts as reached
    MAX_ACTIVE_ENEMIES: 8,
    // Slice 1 uses 4; more than this means the map data is wrong
    MAX_PATH_POINTS: 64,
    // capacity of a per-enemy dynamic path buffer
    DT_CLAMP_MS: 100,
    // stops a backgrounded tab from teleporting enemies on return
    /**
     * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
     * clear sight line does not prove a 20 px body fits through the diagonal seam it
     * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
     * symptom (wanting to move but not moving) and fall back to a real path.
     */
    STUCK_REPATH_MS: 400,
    STUCK_PATH_PREFERENCE_MS: 2e3,
    // how long a stuck enemy keeps preferring A* over straight lines
    STUCK_PROGRESS_FRACTION: 0.25,
    // actual/desired speed below which we count as stuck
    // --- placeholder presentation (section "占位期表现", art-direction 12) ---
    BODY_COLOR: 13386820,
    // "low tier enemy"; encodes tier, never state
    INDICATOR_COLOR: 2811592,
    // contamination teal; state lives here
    SUSPICIOUS_BREATH_HZ_MIN: 1.5,
    // breathing rate at the suspicion threshold...
    SUSPICIOUS_BREATH_HZ_MAX: 3,
    // ...and at full certainty (rule R3)
    ALERT_BLINK_HZ: 3,
    // blinking = searching
    AFTERIMAGE_INTERVAL_MS: 100,
    AFTERIMAGE_LIFETIME_MS: 300,
    AFTERIMAGE_ALPHA: 0.3,
    AFTERIMAGE_SLOTS: 4,
    // ring buffer per enemy; lifetime/interval + 1
    /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
    DEBUG_SHOW_VISION_CONE: false
  },
  /** Map generation */
  MAP: {
    WIDTH: 80,
    // tiles (larger to accommodate multiple fragments)
    HEIGHT: 80,
    // tiles
    /** Voronoi partitioning */
    FRAGMENT_COUNT_MIN: 4,
    FRAGMENT_COUNT_MAX: 6,
    FRAGMENT_MIN_AREA: 150,
    // minimum tiles per fragment
    /** Cellular automata */
    CA_ITERATIONS: 5,
    // smoothing passes
    CA_WALL_THRESHOLD: 4,
    // cells with >= N wall neighbors become wall
    CA_INITIAL_FILL: 0.45,
    // initial random fill ratio (lower = more open)
    /** Fracture connections between fragments */
    FRACTURE_WIDTH: 2,
    // tiles (narrow passage width)
    FRACTURE_MAX_PER_EDGE: 2
    // max connections between two adjacent fragments
  },
  /**
   * Slice 6 C1 land outline. Rectangular tile buffer; walkable land must not fill it.
   * 80×80 MAP.* numbers stay architecture placeholders — do not use them for this generator.
   */
  GENERATION: {
    BUFFER_COLS: 64,
    BUFFER_ROWS: 42,
    MAX_OUTLINE_ATTEMPTS: 28,
    LAND_FILL_MIN: 0.24,
    LAND_FILL_MAX: 0.48,
    BORDER_RING: 2,
    /** Fraction of the outer ring that may be land. Higher = island hugging the rectangle. */
    BORDER_OCCUPANCY_MAX: 0.12,
    /** Land / axis-aligned bbox. Circles sit near 0.78; filled rectangles sit near 1. */
    BBOX_FILL_MAX: 0.8,
    /**
     * Share of land cells that touch void. Large blobs naturally sit lower;
     * this only rejects near-solid blocks (a 1-cell frame around a filled rect).
     */
    ROUGHNESS_MIN: 0.08,
    /** bbox must leave at least this many leftover cells on width+height combined. */
    MIN_BBOX_SLACK: 8,
    MAX_EDGES_TOUCHING: 3,
    MAX_RUIN_ATTEMPTS: 40,
    MIN_FEATURE_SEPARATION: 7,
    WALL_RATIO_MIN: 0.018,
    WALL_RATIO_MAX: 0.22,
    /** Largest leftover open rectangle (tiles). Bigger than this reads as an empty plaza. */
    YARD_AREA_MAX: 64
  },
  /** Purification point (docs/specs/system-purification-impact.md) */
  PURIFICATION: {
    /** Spatial layout */
    MAP_COLS: 14,
    // tiles
    MAP_ROWS: 12,
    // tiles
    INTERACTION_RADIUS: 32,
    // pixels for module/rift-entrance interaction
    /** Module state */
    MODULE_INITIAL_HP: 70,
    /** Tier-0 repair cap / effect denominator baseline (DEC-064). */
    MODULE_BASE_MAX_HP: 100,
    /** Alias of MODULE_BASE_MAX_HP so older call sites still compile. */
    MODULE_MAX_HP: 100,
    /** Each thicken tier adds this many maxHp to every module. */
    MODULE_MAX_HP_PER_TIER: 15,
    /** Highest purchasable thicken tier (maxHp = 100 + 15*3 = 145). */
    MODULE_MAX_HP_TIERS: 3,
    // Thickening purchase costs are authored alongside all other growth steps
    // in data/growth-route.csv, not a separate system-constant price ladder.
    /** All three module effects use this HP reference; thickening does not raise it. */
    MODULE_EFFECT_HP_REF: 100,
    /** Starting chaos when purifier hp = 0 (full integrity → 0). */
    CHAOS_HARD_START: 50,
    REPAIR_PER_KINDLING: 4,
    // 1 kindling = this many hp (tuned for scarcity)
    /** Impact system (intensity now driven by TideSystem, see TIDE constants) */
    BASE_IMPACT_DAMAGE: 30,
    THREAT_FOCUS_RATIO: 0.65,
    // primary target gets this fraction of total damage
    FORECAST_ACCURACY: 0.8,
    // particle prediction accuracy
    /** combust defense mechanic (DEC-030): fixed threshold, not derived from
     * BASE_IMPACT_DAMAGE, so tide-driven damage swings don't shift the trigger point.
     * Value chosen to equal ~2x BASE_IMPACT_DAMAGE(30) per the CSV's "约等于2次满额冲击". */
    COMBUST_BURN_THRESHOLD: 60,
    /** Module effects */
    MAX_CORE_REDUCTION: 0.3,
    // chaosRate reduction at full hp
    MAX_STORAGE_BONUS: 0.5,
    // kindling value bonus at full hp
    /** resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%".
     * A flat bump to both caps above while at least one resonate sits in a defense slot -
     * not a multiplier, so it reads the same way the CSV states it ("+10%" alongside two
     * numbers already expressed as flat percentages). "不叠加" is enforced by storing this
     * as a single on/off flag (`GameState.isResonateBonusActive()`), not a per-item count. */
    RESONATE_MODULE_CAP_BONUS: 0.1,
    /** siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍(1薪柴=8hp)" - same
     * "装备期间" derivation pattern as RESONATE_MODULE_CAP_BONUS above (owned by
     * `ContaminantSystem.syncRepairEfficiencyMult()` + `GameState`, not a per-impact
     * defense-engine effect), since the CSV names it a standing equip-state bonus rather
     * than a one-impact trigger. 4 (REPAIR_PER_KINDLING) * 2.0 = 8, matching the CSV. */
    SIPHON_REPAIR_EFFICIENCY_MULT: 2,
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 50,
      // active boundary particles
      PARTICLE_ALPHA_MIN: 0.06,
      PARTICLE_ALPHA_MAX: 0.25,
      PARTICLE_SPEED: 8,
      // px/s slow inward drift
      APPARITION_INTERVAL_MIN: 8e3,
      // ms
      APPARITION_INTERVAL_MAX: 15e3,
      APPARITION_DURATION: 3e3,
      // ms (0.5s fade in + 2s hold + 0.5s fade out)
      APPARITION_MAX_SIMULTANEOUS: 3
    },
    /** Dynamic boundary shape (polar pressure blob) */
    BOUNDARY: {
      SHRINK_AT_MAX_INTENSITY: 0.72,
      // tideScale at intensity 3.0 (boundary loses up to 28%)
      PRESSURE_PRIMARY_AMP: 0.2,
      // max inward push fraction (primary Gaussian lobe)
      PRESSURE_SECONDARY_AMP: 0.1,
      // secondary lobe amplitude
      PRESSURE_LOBE_SIGMA: 0.7,
      // radians; width of each Gaussian lobe
      PRESSURE_CREST_BONUS: 0.4,
      // +40% amplitude during crest phase
      PRESSURE_EBB_FACTOR: 0.6,
      // amplitude multiplier during ebb phase
      SAFE_MARGIN_TILES: 1,
      // minimum distance from any interaction point to boundary
      GRADIENT_INNER_START: 0.8,
      // fraction of R where darkening begins
      GRADIENT_MEMBRANE_START: 0.95,
      // fraction where "membrane" teal band begins
      GRADIENT_OUTER_END: 1.15,
      // fraction where full void begins
      /**
       * B4 (Slice 5): the old BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT
       * keys described a single global sinusoidal pulse from a "whole-boundary breathing"
       * design that DEC-028 (Slice 4.5) replaced with localized pressure impacts
       * (`src/systems/boundary-breath.ts`). Those 5 keys had zero consumers and were
       * removed; this nested object holds boundary-breath.ts's real tuning knobs
       * (previously inlined as top-of-file `const`s there) instead. Values unchanged.
       */
      BREATH: {
        SAMPLE_COUNT: 72,
        // angular resolution of the membrane/impact draw
        MAX_IMPACTS: 5,
        // max simultaneous localized impacts
        ARC_HALF_MIN: 0.4,
        // rad; narrowest impact arc half-width
        ARC_HALF_MAX: 0.8,
        // rad; widest impact arc half-width
        SPAWN_DIST_MIN: 14,
        // px; closest impact spawn distance outside the membrane
        SPAWN_DIST_MAX: 30,
        // px; farthest impact spawn distance
        IMPACT_DURATION_MIN: 1800,
        // ms; shortest single-impact lifetime
        IMPACT_DURATION_MAX: 3500,
        // ms; longest single-impact lifetime
        SPAWN_INTERVAL_MIN: 400,
        // ms; shortest gap between new impacts
        SPAWN_INTERVAL_MAX: 1200,
        // ms; longest gap between new impacts (x0.6 during crest)
        WAVE_COLOR: 936511,
        // dark desaturated teal, the inbound wave arcs
        MEMBRANE_COLOR: 1735274,
        // the boundary membrane line itself
        DEFORM_MAX_PX: 8
        // px; max inward push of the membrane at impact center
      }
    },
    /** Scene transition timing */
    IMPACT_RESULT_DISPLAY_MS: 2e3,
    SCENE_TRANSITION_DELAY_MS: 600
  },
  /**
   * Combat (docs/specs/system-combat.md, "数值结构"). Every combat number lives here.
   *
   * The system is a price list, not a fight: the point is that the player can work out
   * what swinging costs before swinging. Three of these relations carry that promise and
   * are asserted at boot by `config/invariants.ts` (K1/K2/K3/K5) - notably
   * `ENEMY_MAX_HEALTH` being an exact multiple of `PLAYER_DAMAGE`, which is what makes
   * "three hits" a fact rather than an average.
   *
   * When combat turns out too cheap in playtesting, the spec's tuning order is
   * `CHAOS.COMBAT_BONUS` and `NOISE_HIT_RADIUS` first, `ENEMY_MAX_HEALTH` second, and
   * `PLAYER_DAMAGE` never (weakening it makes combat expensive *and* unpleasant).
   */
  COMBAT: {
    // --- player attack (section "玩家攻击") ---
    PLAYER_DAMAGE: 25,
    ATTACK_COOLDOWN: 500,
    // ms, counted from the input instant, parallel to the phases
    ATTACK_RANGE: 40,
    // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
    ATTACK_HALF_ANGLE: 60,
    // deg -> a 120 deg forward sector
    ATTACK_WINDUP_MS: 100,
    // the player's side of the commitment
    ATTACK_ACTIVE_MS: 50,
    // ~3 frames; exists to tolerate frame jitter, not to widen the hit
    ATTACK_RECOVERY_MS: 70,
    ATTACK_SLOW_MS: 220,
    // derived: windup + active + recovery (asserted, not free)
    ATTACK_SELF_SLOW: 0.35,
    // move speed while swinging - the "cost" that lands on feel
    ATTACK_MIN_ANGLE_BYPASS: 16,
    // px within which the angle test is meaningless and skipped
    /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
    ATTACK_KEY: "SPACE",
    // --- infiltrator (section "敌人（渗透体）") ---
    ENEMY_MAX_HEALTH: 75,
    // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
    ENEMY_DAMAGE_BASE: 15,
    ENEMY_ATTACK_RANGE: 38,
    // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
    ENEMY_ATTACK_HALF_ANGLE: 60,
    // deg; symmetric with the player's
    ENEMY_ATTACK_WINDUP_MS: 350,
    // the player's dodge window - the whole of "controllable" (K3)
    ENEMY_ATTACK_COOLDOWN_MS: 1200,
    ENEMY_FIRST_ATTACK_DELAY_MS: 300,
    // "caught up with you" and "hit you" stay two events
    ENEMY_ATTACK_TOKENS: 2,
    // enemies allowed in windup at once; caps unavoidable damage
    ENEMY_HIT_FLASH_MS: 80,
    ENEMY_DEATH_FX_MS: 180,
    // presentation only; the enemy is gone from logic at 0 ms
    // --- player health and hits (section "玩家生命值与受击") ---
    PLAYER_IFRAME_MS: 400,
    // stops two enemies resolving on one frame for 30 damage
    PLAYER_HIT_FLASH_MS: 100,
    // --- noise: the exposure half of the price (section "噪声") ---
    NOISE_SWING_RADIUS: 96,
    // px (3 tiles), 'suspicious' - a whiff is heard, not billed
    NOISE_HIT_RADIUS: 160,
    // px (5 tiles), 'alert' - the main reason a fight is loud
    NOISE_KILL_RADIUS: 192,
    // px (6 tiles), 'alert'
    /**
     * Placeholder presentation (spec V2). White is on loan here: it currently means
     * "player / extraction point" in art-direction 12, and using thin white lines and
     * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
     * Treat these as stand-ins, not as the visual language.
     */
    FX_COLOR: 16777215,
    ATTACK_FAN_FX_MS: 60,
    // how long the swing outline stays up (spec V2)
    PLAYER_FLASH_PAD: 6,
    // px the hit flash overshoots the body; see report on white-on-white
    FX_POOL_SIZE: 12
    // preallocated flash/death sprites: 8 enemies + headroom
  },
  /**
   * Contamination lexicon (DEC-076). Morph tables stay in CSV.
   * These are system constants: core HP, chaos prices, draw retry, encounter timing.
   */
  CONTAMINATION: {
    CORE_MAX_HEALTH: 50,
    ADJACENT_STRIKE_DAMAGE: 15,
    ADJACENT_STRIKE_WINDUP_MS: 350,
    PAINT_STEP_CHAOS_REST: 2,
    PAINT_STEP_CHAOS_INFLATED: 4,
    VOLUME_CHAOS_PER_SEC: 1,
    VOLUME_SIGHT_MULT: 0.7,
    DRAW_RETRY_LIMIT: 12,
    ENCOUNTER_COOLDOWN_MS: 6e4,
    ENCOUNTER_GAP_MS: 2500,
    ENCOUNTER_HOLD_MS: 2500,
    VOLUME_DEPTH: 40,
    COLONY_NUCLEUS_COUNT_MIN: 2,
    COLONY_NUCLEUS_COUNT_MAX: 3,
    COLONY_NUCLEUS_MIN_TILE_GAP: 3
  },
  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5
  },
  /** Tide system (docs/specs/system-growth-tide.md, section T) */
  TIDE: {
    TIDES: [
      { floor: 1, peak: 1.6, riseCycles: 3, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.2 },
      { floor: 1.2, peak: 2, riseCycles: 4, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.5 },
      { floor: 1.5, peak: 2.4, riseCycles: 4, crestCycles: 2, ebbCycles: 2, ebbTarget: 1.8 },
      { floor: 1.8, peak: 2.8, riseCycles: 4, crestCycles: 2, ebbCycles: 3, ebbTarget: 2 },
      { floor: 2, peak: 3, riseCycles: 5, crestCycles: Infinity, ebbCycles: 0, ebbTarget: 2 }
    ],
    CREST_CHARGE_COST: 3,
    // impact charge cost during Crest phase
    NORMAL_CHARGE_COST: 1,
    // impact charge cost during Rise/Ebb phases
    TRANSFORM_THRESHOLD: 3
    // charges needed to transform defense -> tool
  },
  // Growth / permanent upgrades (docs/specs/system-growth-tide.md, section G):
  // Definitions come from data/upgrades.csv; all step costs come from
  // data/growth-route.csv (including thickening). Both generate upgrade-data.ts
  // under the CSV source rule — no constants block here
  // by design; growth-system.ts reads UPGRADE_DATA directly.
  /** Contaminant system (docs/specs/system-growth-tide.md, section CN) */
  CONTAMINANT: {
    NODES_PER_MAP: 3,
    // contaminant pickup nodes per rift map
    RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
    DEFENSE_SLOTS: 1,
    // base slot; each growth_defense_slot level adds +1
    SORTIE_SLOTS: 3,
    // base slots (2 active + 1 passive); growth_sortie_slot adds +1 active
    MAX_DEFENSE_SLOTS: 4,
    // DEFENSE_SLOTS + max growth_defense_slot bonus (maxLevel 3)
    MAX_SORTIE_SLOTS: 4,
    // SORTIE_SLOTS + max growth_sortie_slot bonus (maxLevel 1)
    USES: { common: 5, fine: 3, rare: 2 },
    // uses remaining after transformation
    /** echo defense mechanic: "单件因此最多+2" — per-tool cap on echo bonus grants. */
    ECHO_MAX_TOOL_USE_BONUS: 2,
    /**
     * Hotkeys for the active sortie slots, in slot order. The passive slot (always the
     * last unlocked slot, see `contaminantSystem.getSortiePassiveSlotIndex()`) never gets
     * an entry here - it has no hotkey by design. G was picked for the 3rd slot
     * (growth_sortie_slot, Slice 5 T5) because it sits directly beside F on the keyboard,
     * the same "one key past the movement cluster" reach as Q/F already use, and every
     * other neighbour (E/R/T) is already taken by extraction/restart/nothing-reserved-but-
     * awkward. Single source of truth for both the RiftScene binding and any UI that needs
     * to render the real key label.
     */
    SORTIE_ACTIVE_KEYS: ["Q", "F", "G"]
  },
  /** Purification stability (docs/specs/system-growth-tide.md, section S) */
  STABILITY: {
    MAX: 100,
    GAIN_EXTRACT: 1,
    // successful extraction (calibrated: ~35 cycles to cap)
    GAIN_GROWTH: 1,
    // purchased an upgrade
    GAIN_CREST_SURVIVED: 3,
    // survived a full Crest with no module at zero
    GAIN_TIDE_ADVANCE: 5,
    // tide advanced to next number
    LOSS_MODULE_ZERO: -1
    // a module reached 0 hp
  },
  /**
   * Fine/Rare active+passive tool numbers not already carried by
   * `src/generated/contaminant-data.ts` (radius/duration/uses read straight from the CSV
   * at the point of use instead of being re-hardcoded here - see `docs/design-notes/
   * slice3-sortie-tools.md`). Everything below is either a multiplier/amount the CSV
   * description states in prose (`data/contaminants.csv`, `description_tool` column) or,
   * where flagged, a placeholder-tier number the CSV leaves unspecified (Slice 5 T1).
   */
  TOOLS: {
    /** compress: "半径2格内敌人移速-60%" */
    COMPRESS_SPEED_MULT: 0.4,
    /** resonate: "弹回3格并眩晕2秒" */
    RESONATE_KNOCKBACK_PX: 96,
    RESONATE_STUN_MS: 2e3,
    /** overwrite: "感知范围缩小50%" */
    OVERWRITE_PERCEPTION_MULT: 0.5,
    /** combust: "感知范围-50%"(烈焰遮蔽视线) */
    COMBUST_PERCEPTION_MULT: 0.5,
    /** combust: "每秒受到持续伤害" - CSV gives no amount; placeholder tuned so an enemy
     * that stays the full 8s duration dies (75 hp / 15 = 5 ticks), matching the tool's
     * rare-tier power level. Flagged for design confirmation (see delivery report). */
    COMBUST_DAMAGE_PER_TICK: 15,
    COMBUST_TICK_MS: 1e3,
    /** mirror: "被敌人接触后碎裂消失" - CSV gives no contact radius; placeholder tuned to
     * roughly one enemy body width. Flagged for design confirmation. */
    MIRROR_CONTACT_RADIUS: 20,
    /** abyss: "使用后5秒内混乱增速+50%" - a second timing value the CSV's single
     * `tool_duration_ms` column cannot carry (that field holds the 10s reveal instead). */
    ABYSS_CHAOS_BOOST_MULT: 1.5,
    ABYSS_CHAOS_BOOST_MS: 5e3,
    /** siphon: "吸取2点薪柴且...混乱值增速减半" */
    SIPHON_KINDLING_GAIN: 2,
    SIPHON_CHAOS_REDUCTION_MULT: 0.5
  },
  /** Persistent save (docs/specs/system-growth-tide.md, section P) */
  SAVE: {
    KEY: "coh-save-v1",
    VERSION: 2
  }
};
var RIFT_FRAGMENT_DATA2 = {
  "frag-outdoor": {
    id: "frag-outdoor",
    displayName: "\u6237\u5916\u571F\u58E4",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 4,
    jogAmp: 1,
    gapCount: 0,
    gapPlacement: "",
    turnCount: 0,
    turnCorner: "",
    capKind: "stub",
    facingPolicy: "random",
    join: "single",
    surfaceMaterial: "soil",
    enabled: true,
    floorBv: 26,
    floorBiasR: 0.88,
    floorBiasG: 1.02,
    floorBiasB: 0.82,
    stainKey: "frag-outdoor",
    stainThreshold: 0.72,
    stainStrength: 0.4,
    grimeAmp: 0.5,
    macroAmp: 0.32,
    scratchPer1000px2: 0.55,
    fleckPer1000px2: 1.25,
    scratchAngle: "free",
    scratchDispersion: 0,
    wallBv: 24,
    wallBiasR: 1,
    wallBiasG: 0.88,
    wallBiasB: 0.75,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 12,
    featureCountMax: 24
  },
  "frag-clinic": {
    id: "frag-clinic",
    displayName: "\u533B\u9662\u5B9E\u9A8C\u5BA4",
    coverage: "remnant",
    massGrammar: "enclosure",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "end",
    turnCount: 2,
    turnCorner: "right",
    capKind: "none",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "tile",
    enabled: true,
    floorBv: 28,
    floorBiasR: 0.86,
    floorBiasG: 0.92,
    floorBiasB: 1.08,
    stainKey: "shadow-grey",
    stainThreshold: 0.78,
    stainStrength: 0.25,
    grimeAmp: 0.28,
    macroAmp: 0.18,
    scratchPer1000px2: 0.7,
    fleckPer1000px2: 0.55,
    scratchAngle: "orthogonal",
    scratchDispersion: 0,
    wallBv: 30,
    wallBiasR: 0.82,
    wallBiasG: 0.9,
    wallBiasB: 1.05,
    featureWidthTiles: 1,
    featureLengthTiles: 5,
    featureCountMin: 14,
    featureCountMax: 22
  },
  "frag-metro": {
    id: "frag-metro",
    displayName: "\u5730\u94C1\u5DE5\u4E1A",
    coverage: "remnant",
    massGrammar: "slab",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "center",
    turnCount: 0,
    turnCorner: "",
    capKind: "pier",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "metal",
    enabled: true,
    floorBv: 24,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "brick-dark",
    stainThreshold: 0.68,
    stainStrength: 0.35,
    grimeAmp: 0.42,
    macroAmp: 0.28,
    scratchPer1000px2: 0.45,
    fleckPer1000px2: 0.9,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.15,
    wallBv: 26,
    wallBiasR: 1.1,
    wallBiasG: 0.82,
    wallBiasB: 0.68,
    featureWidthTiles: 2,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-library": {
    id: "frag-library",
    displayName: "\u65E7\u56FE\u4E66\u9986",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 6,
    jogAmp: 1,
    gapCount: 2,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "none",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "wood",
    enabled: true,
    floorBv: 26,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-library",
    stainThreshold: 0.6,
    stainStrength: 0.3,
    grimeAmp: 0.34,
    macroAmp: 0.2,
    scratchPer1000px2: 0.8,
    fleckPer1000px2: 0.7,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.35,
    wallBv: 24,
    wallBiasR: 1.02,
    wallBiasG: 0.93,
    wallBiasB: 0.68,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-residential": {
    id: "frag-residential",
    displayName: "\u5C45\u6C11\u533A\u516C\u5BD3",
    coverage: "remnant",
    massGrammar: "cluster",
    jogPeriod: 2,
    jogAmp: 1,
    gapCount: 3,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "widen",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "plaster",
    enabled: false,
    floorBv: 28,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-residential",
    stainThreshold: 0.7,
    stainStrength: 0.3,
    grimeAmp: 0.38,
    macroAmp: 0.24,
    scratchPer1000px2: 0.4,
    fleckPer1000px2: 0.4,
    scratchAngle: "orthogonal",
    scratchDispersion: 0.6,
    wallBv: 30,
    wallBiasR: 1.02,
    wallBiasG: 0.96,
    wallBiasB: 0.79,
    featureWidthTiles: 2,
    featureLengthTiles: 5,
    featureCountMin: 18,
    featureCountMax: 24
  }
};
var ENABLED_RIFT_FRAGMENTS2 = Object.values(RIFT_FRAGMENT_DATA2).filter((row) => row.enabled);
var PALETTE_HEX3 = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE3 = PALETTE_HEX3.map(hexToRgb2);
var TEAL_FAMILY_HEX2 = [
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#b0fff5",
  "#4adf8a",
  "#1a7a9a"
];
var TEAL_FAMILY2 = TEAL_FAMILY_HEX2.map(hexToRgb2);
var TEAL_FAMILY_SET2 = new Set(TEAL_FAMILY_HEX2);
var TEAL_SUBSET_DEEP_MID_HEX2 = ["#0e4a3f", "#1a6b5c", "#1a7a9a"];
var TEAL_SUBSET_CORE_HEX2 = ["#1aad96"];
var TEAL_SUBSET_GLOW_HEX2 = ["#2ae6c8"];
var TEAL_SUBSET_DEEP_MID2 = TEAL_SUBSET_DEEP_MID_HEX2.map(hexToRgb2);
var TEAL_SUBSET_CORE2 = TEAL_SUBSET_CORE_HEX2.map(hexToRgb2);
var TEAL_SUBSET_GLOW2 = TEAL_SUBSET_GLOW_HEX2.map(hexToRgb2);
var L3_WARM_HEX2 = ["#8a5c2a", "#c4873a"];
var L4_GLOW_HEX2 = ["#e0a848"];
var UI_HEX2 = ["#8a8f96", "#c8cdd4", "#2a2d32", "#0f1114"];
var DANGER_HEX2 = ["#cc3333"];
var WARNING_HEX2 = ["#b89040"];
var DEBRIS_HEX2 = ["#50463c", "#5d483e", "#4f4835"];
var DEBRIS_HEX_SET2 = new Set(DEBRIS_HEX2);
var L1_EXCLUDED_HEX2 = /* @__PURE__ */ new Set([
  ...TEAL_FAMILY_HEX2,
  ...L3_WARM_HEX2,
  ...L4_GLOW_HEX2,
  ...UI_HEX2,
  ...DANGER_HEX2,
  ...WARNING_HEX2
]);
var L1_MEAN_MAX2 = 55;
function hexToRgb2(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function meanRgb2(rgb2) {
  return (rgb2[0] + rgb2[1] + rgb2[2]) / 3;
}
function temperatureGroup2(r, g, b) {
  if (r - b >= 6) return "WARM";
  if (b - r >= 6) return "COOL";
  if (g >= r + 2 && g >= b + 2) return "OLIVE";
  return "NEUTRAL";
}
function buildL1Pools2() {
  const pools = {
    WARM: [],
    COOL: [],
    OLIVE: [],
    NEUTRAL: []
  };
  for (let i = 0; i < PALETTE_HEX3.length; i++) {
    const hex = PALETTE_HEX3[i];
    if (L1_EXCLUDED_HEX2.has(hex)) continue;
    const rgb2 = PALETTE3[i];
    if (meanRgb2(rgb2) > L1_MEAN_MAX2) continue;
    pools[temperatureGroup2(rgb2[0], rgb2[1], rgb2[2])].push(rgb2);
  }
  return pools;
}
var L1_POOL_MUTABLE2 = buildL1Pools2();
var L1_POOL2 = {
  WARM: L1_POOL_MUTABLE2.WARM,
  COOL: L1_POOL_MUTABLE2.COOL,
  OLIVE: L1_POOL_MUTABLE2.OLIVE,
  NEUTRAL: L1_POOL_MUTABLE2.NEUTRAL
};
var PALETTE_HEX22 = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE22 = PALETTE_HEX22.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
]);
var PALETTE_WITHOUT_DEBRIS2 = PALETTE22.filter(
  (_rgb, i) => !DEBRIS_HEX_SET2.has(PALETTE_HEX22[i])
);
var PALETTE_HEX_SET2 = new Set(PALETTE_HEX22.map((h) => h.toLowerCase()));
var CLUSTER_TEAL_RGB2 = [
  ...TEAL_SUBSET_DEEP_MID2,
  ...TEAL_SUBSET_CORE2,
  ...TEAL_SUBSET_GLOW2
];
var RETRY = GAME_CONSTANTS2.CONTAMINATION.DRAW_RETRY_LIMIT;
var ENEMY_DATA = {
  infiltrator: {
    role: "infiltrator",
    displayName: "\u6E17\u900F\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 55,
    sightRangePeriph: 90,
    sightHalfAnglePeriph: 90,
    chaseSightRange: 210,
    hearingRange: 100,
    hearingMoveMult: 1,
    hearingStillRange: 0,
    hearingWallFactor: 0.6,
    visionWeight: 1,
    hearingWeight: 0,
    hearingMaxPush: "suspicious",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  },
  rewriter: {
    role: "rewriter",
    displayName: "\u6539\u5199\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 32,
    sightRangePeriph: 56,
    sightHalfAnglePeriph: 50,
    chaseSightRange: 210,
    hearingRange: 150,
    hearingMoveMult: 2,
    hearingStillRange: 40,
    hearingWallFactor: 0.6,
    visionWeight: 0.45,
    hearingWeight: 1,
    hearingMaxPush: "alert",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  }
};
var BODY_PROFILE_DATA = {
  "insect_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "human_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "mammal_remnant": {
    "moveScale": 1.1,
    "windupMs": 550,
    "cooldownMs": 1400,
    "rangePx": 38,
    "halfAngleDeg": 35
  },
  "worm_remnant": {
    "moveScale": 0.6,
    "windupMs": 650,
    "cooldownMs": 1500,
    "rangePx": 38,
    "halfAngleDeg": 25
  },
  "organic_remnant": {
    "moveScale": 0.7,
    "windupMs": 700,
    "cooldownMs": 1600,
    "rangePx": 36,
    "halfAngleDeg": 75
  },
  "stalk_clump": {
    "moveScale": 0.5,
    "windupMs": 750,
    "cooldownMs": 1750,
    "rangePx": 36,
    "halfAngleDeg": 80
  },
  "street_wreckage": {
    "moveScale": 0,
    "windupMs": 800,
    "cooldownMs": 1800,
    "rangePx": 38,
    "halfAngleDeg": 80
  }
};
var PLAYER_HALF = GAME_CONSTANTS2.PLAYER.BODY_SIZE / 2;
var BODY_CLEARANCE = PLAYER_HALF + GAME_CONSTANTS2.AI.BODY_SIZE / 2;
var STATIC_SUBSTRATES = Object.keys(BODY_PROFILE_DATA).filter((id) => BODY_PROFILE_DATA[id].moveScale === 0);
var TileGrid2 = class {
  constructor(map) {
    __publicField2(this, "cols");
    __publicField2(this, "rows");
    __publicField2(this, "tileSize");
    __publicField2(this, "widthPx");
    __publicField2(this, "heightPx");
    __publicField2(this, "data");
    __publicField2(this, "_version", 0);
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.cols * map.tileSize;
    this.heightPx = map.rows * map.tileSize;
    this.data = new Uint8Array(map.cols * map.rows);
    for (let row = 0; row < map.rows; row++) {
      const sourceRow = map.tiles[row];
      if (!sourceRow || sourceRow.length !== map.cols) {
        throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
      }
      for (let col = 0; col < map.cols; col++) {
        this.data[row * map.cols + col] = sourceRow[col];
      }
    }
  }
  get version() {
    return this._version;
  }
  /**
   * Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks.
   * In-bounds VOID stays VOID (unwalkable; opaque via `isOpaque`).
   */
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    return this.data[row * this.cols + col];
  }
  isOpaque(col, row) {
    const tile = this.getTile(col, row);
    return tile === 0 || tile === 3;
  }
  isWalkable(col, row) {
    const tile = this.getTile(col, row);
    return tile === 1 || tile === 2;
  }
  /** True when the world position falls inside a walkable tile. */
  isWalkableAt(x, y) {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }
  /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
  setTile(col, row, tile) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (this.data[index] === tile) return;
    this.data[index] = tile;
    this._version++;
  }
  /** Writes the centre of a tile into `out` (no allocation). */
  tileToWorld(col, row, out) {
    out.x = col * this.tileSize + this.tileSize / 2;
    out.y = row * this.tileSize + this.tileSize / 2;
    return out;
  }
  /** Writes the tile containing a world position into `out` (no allocation). */
  worldToTile(x, y, out) {
    out.col = Math.floor(x / this.tileSize);
    out.row = Math.floor(y / this.tileSize);
    return out;
  }
};
var RIFT_MAP_ASCII = [
  "################################################",
  "#..............................................#",
  "#.....##..............X.........###............#",
  "#.....###.........##..............##..P..##....#",
  "#..........##...............##.................#",
  "#.......J....##.......................K...##...#",
  "#.....##...........###........##...............#",
  "#.........##.............##............##......#",
  "#..7........###........##..........###.........#",
  "#...####..........######.........##............#",
  "#...###..........##....##...........6..........#",
  "#.Q......##.........##...........##............#",
  "#.........##.............###...................#",
  "#.....C...##........5....###..........D........#",
  "#...####..........##.....##....................#",
  "#..##.........##..........##..........###......#",
  "#......###............##.......###.............#",
  "#.....E...##.....##...................##.......#",
  "#......####..........##............4.....##....#",
  "#..............####.........##...........##....#",
  "#..##..........###..........##....R...###......#",
  "#.............##...............##...F.....8....#",
  "#...........##............##...................#",
  "#.......##........##........##.................#",
  "#.....H.......##...................G...##......#",
  "#...........3........##...........##...........#",
  "#....##.....A.................2......B.........#",
  "#........##...........1............##..........#",
  "#.....................S..........##............#",
  "#....##....................##..................#",
  "#..............................................#",
  "################################################"
];
var KINDLING_TIERS = {
  "1": "safe",
  "2": "safe",
  "3": "safe",
  "4": "contested",
  "5": "contested",
  "6": "contested",
  "7": "deep",
  "8": "deep"
};
var CONTAMINANT_MARKER_CHARS = ["P", "Q", "R"];
var PATROL_UNITS = [
  {
    id: "ENM_INF_01",
    waypointChars: "AB",
    mode: "pingpong",
    facing: 0,
    role: "spawn area sweep; east-west patrol covering the open ground between safe kindling and the transition zone"
  },
  {
    id: "ENM_INF_02",
    waypointChars: "CD",
    mode: "pingpong",
    facing: 0,
    role: "upper contested area; sweeps east-west through the debris field, guards KDL_05 and approach to deep zone"
  },
  {
    id: "ENM_INF_03",
    waypointChars: "EFGH",
    mode: "loop",
    facing: 0,
    role: "rectangular loop in the transition zone; covers the C-shape ruin and cliff ridge areas, guards KDL_04 and KDL_08 approaches"
  },
  {
    id: "ENM_INF_04",
    waypointChars: "JK",
    mode: "pingpong",
    facing: 0,
    scanAngles: [180, 0],
    role: "top zone gate; sweeps east-west in the extraction approach \u2014 the last obstacle before exit"
  }
];
var LANDMARKS = [
  { id: "LMK_POOL", col: 28, row: 6, style: "pool" },
  { id: "LMK_SCRATCHES", col: 20, row: 26, style: "scratches" },
  { id: "LMK_RUBBLE", col: 8, row: 15, style: "rubble" },
  { id: "LMK_CRACK", col: 40, row: 18, style: "crack" },
  { id: "LMK_SCORCH", col: 30, row: 4, style: "scorch" },
  { id: "LMK_CRYSTALS", col: 41, row: 9, style: "crystals" },
  { id: "LMK_BLOODTRAIL", col: 22, row: 22, style: "bloodtrail" },
  { id: "LMK_RUNE", col: 6, row: 19, style: "rune" }
];
function parseRiftMap() {
  const tileSize = GAME_CONSTANTS2.TILE_SIZE;
  const rows = RIFT_MAP_ASCII.length;
  const cols = RIFT_MAP_ASCII[0].length;
  const tiles = [];
  const markers = /* @__PURE__ */ new Map();
  for (let row = 0; row < rows; row++) {
    const line = RIFT_MAP_ASCII[row];
    if (line.length !== cols) {
      throw new Error(`rift-map-data: row ${row} has ${line.length} chars, expected ${cols}`);
    }
    const tileRow = new Array(cols);
    for (let col = 0; col < cols; col++) {
      const char = line[col];
      tileRow[col] = char === "#" ? 0 : 1;
      if (char !== "#" && char !== ".") {
        if (markers.has(char)) {
          throw new Error(`rift-map-data: marker '${char}' appears more than once`);
        }
        markers.set(char, {
          x: col * tileSize + tileSize / 2,
          y: row * tileSize + tileSize / 2
        });
      }
    }
    tiles.push(tileRow);
  }
  const requireMarker = (char) => {
    const position = markers.get(char);
    if (!position) throw new Error(`rift-map-data: missing marker '${char}'`);
    return position;
  };
  const kindlingNodes = Object.keys(KINDLING_TIERS).sort().map((char) => ({
    id: `KDL_0${char}`,
    tier: KINDLING_TIERS[char],
    position: requireMarker(char)
  }));
  const contaminantNodes = CONTAMINANT_MARKER_CHARS.map((char, idx) => ({
    id: `CTM_NODE_0${idx + 1}`,
    position: requireMarker(char)
  }));
  const enemySpawns = PATROL_UNITS.map((unit) => {
    const waypoints = unit.waypointChars.split("").map((char) => {
      const position = requireMarker(char);
      return {
        col: Math.floor(position.x / tileSize),
        row: Math.floor(position.y / tileSize)
      };
    });
    return {
      id: unit.id,
      type: "infiltrator",
      spawn: waypoints[0],
      facing: unit.facing,
      patrol: {
        waypoints,
        mode: unit.mode,
        pauseMs: unit.pauseMs,
        scanAngles: unit.scanAngles
      }
    };
  });
  const tileMap = { cols, rows, tileSize, tiles };
  return {
    tileMap,
    grid: new TileGrid2(tileMap),
    layout: {
      spawnPoint: requireMarker("S"),
      extractionPoint: {
        id: "EXIT_01",
        position: requireMarker("X"),
        triggerRadius: GAME_CONSTANTS2.PURIFICATION.INTERACTION_RADIUS
      },
      kindlingNodes,
      contaminantNodes,
      enemySpawns,
      landmarks: LANDMARKS
    }
  };
}
var RIFT_MAP = parseRiftMap();
function createRayHit2() {
  return { x: 0, y: 0, dist: 0, hit: false };
}
var losScratch2 = createRayHit2();
var SIGHT_PX = ENEMY_DATA.infiltrator.sightRange;
var TILE3 = GAME_CONSTANTS2.TILE_SIZE;
var forbiddenExtract = RIFT_MAP.layout.extractionPoint.position;
var HOST_TILE = GAME_CONSTANTS2.TILE_SIZE;
var HALF_BODY3 = GAME_CONSTANTS2.PLAYER.BODY_SIZE / 2;
var STATIC_CLEARANCE = HALF_BODY3 + GAME_CONSTANTS2.AI.BODY_SIZE / 2;
var arithmeticExecutors = [v8FdlibmAtan2, v8Arm64Atan2].map(createHistoricalArithmeticExecutor);
function checkpointChecksum(value) {
  const bytes = JSON.stringify(value);
  if (bytes === void 0) throw new Error("Checkpoint is not serializable");
  let hash2 = 2166136261;
  for (let index = 0; index < bytes.length; index++) {
    hash2 ^= bytes.charCodeAt(index);
    hash2 = Math.imul(hash2, 16777619);
  }
  return (hash2 >>> 0).toString(16).padStart(8, "0");
}
var ENEMY_DATA2 = {
  infiltrator: {
    role: "infiltrator",
    displayName: "\u6E17\u900F\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 55,
    sightRangePeriph: 90,
    sightHalfAnglePeriph: 90,
    chaseSightRange: 210,
    hearingRange: 100,
    hearingMoveMult: 1,
    hearingStillRange: 0,
    hearingWallFactor: 0.6,
    visionWeight: 1,
    hearingWeight: 0,
    hearingMaxPush: "suspicious",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  },
  rewriter: {
    role: "rewriter",
    displayName: "\u6539\u5199\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 32,
    sightRangePeriph: 56,
    sightHalfAnglePeriph: 50,
    chaseSightRange: 210,
    hearingRange: 150,
    hearingMoveMult: 2,
    hearingStillRange: 40,
    hearingWallFactor: 0.6,
    visionWeight: 0.45,
    hearingWeight: 1,
    hearingMaxPush: "alert",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  }
};
var BODY_PROFILE_DATA2 = {
  "insect_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "human_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "mammal_remnant": {
    "moveScale": 1.1,
    "windupMs": 550,
    "cooldownMs": 1400,
    "rangePx": 38,
    "halfAngleDeg": 35
  },
  "worm_remnant": {
    "moveScale": 0.6,
    "windupMs": 650,
    "cooldownMs": 1500,
    "rangePx": 38,
    "halfAngleDeg": 25
  },
  "organic_remnant": {
    "moveScale": 0.7,
    "windupMs": 700,
    "cooldownMs": 1600,
    "rangePx": 36,
    "halfAngleDeg": 75
  },
  "stalk_clump": {
    "moveScale": 0.5,
    "windupMs": 750,
    "cooldownMs": 1750,
    "rangePx": 36,
    "halfAngleDeg": 80
  },
  "street_wreckage": {
    "moveScale": 0,
    "windupMs": 800,
    "cooldownMs": 1800,
    "rangePx": 38,
    "halfAngleDeg": 80
  }
};
var RETRY2 = GAME_CONSTANTS.CONTAMINATION.DRAW_RETRY_LIMIT;
var INFILTRATOR_FORM = {
  substrate: "organic_remnant",
  coverage: "infiltrate",
  continuity: "monolith",
  occupancy: "floor",
  portfolio: "jia",
  lexemes: {
    motion: "motion_patrol",
    sense: "sense_cone",
    rhythm: "rhythm_open",
    contact: "contact_melee_three"
  }
};
var REWRITER_FORM = {
  substrate: "organic_remnant",
  coverage: "rewrite",
  continuity: "monolith",
  occupancy: "floor",
  portfolio: "jia",
  lexemes: {
    motion: "motion_patrol",
    sense: "sense_hear",
    rhythm: "rhythm_open",
    contact: "contact_melee_three"
  }
};
var TAU3 = Math.PI * 2;
var FACING4_ANGLES = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2
};
function shortestArc(delta) {
  let result = delta % TAU3;
  if (result > Math.PI) result -= TAU3;
  if (result < -Math.PI) result += TAU3;
  return result;
}
function stepAngleToward(current, target, maxStep) {
  const diff = shortestArc(target - current);
  if (Math.abs(diff) <= maxStep) return shortestArc(target);
  return shortestArc(current + Math.sign(diff) * maxStep);
}
function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}
function resolveNextWaypoint(mode, count, index, direction2) {
  if (mode === "static" || count <= 1) return { index, direction: direction2 };
  if (mode === "loop") return { index: (index + 1) % count, direction: direction2 };
  let nextDirection = direction2;
  let next = index + direction2;
  if (next >= count) {
    nextDirection = -1;
    next = index - 1;
  } else if (next < 0) {
    nextDirection = 1;
    next = index + 1;
  }
  return { index: Math.max(0, Math.min(count - 1, next)), direction: nextDirection };
}
var STEP_MS = 100;
var OBSERVATION_MS = 6e4;
var WINDOW_MS = 2400;
function advance(track) {
  if (track.pause > 0) {
    track.pause -= STEP_MS;
    if (track.pause <= 0) {
      const next = resolveNextWaypoint(track.spawn.patrol.mode, track.points.length, track.index, track.direction);
      track.index = next.index;
      track.direction = next.direction;
    }
    return;
  }
  const point = track.points[track.index], dx = point.x - track.position.x, dy = point.y - track.position.y, distance2 = Math.hypot(dx, dy);
  if (distance2 <= GAME_CONSTANTS.AI.ARRIVE_EPSILON) {
    track.pause = track.spawn.patrol.pauseMs ?? GAME_CONSTANTS.AI.WAYPOINT_PAUSE_MS;
    return;
  }
  track.facing = stepAngleToward(track.facing, Math.atan2(dy, dx), degToRad(GAME_CONSTANTS.AI.TURN_RATE) * STEP_MS / 1e3);
  const move = Math.min(distance2, track.speed * STEP_MS / 1e3);
  track.position.x += dx / distance2 * move;
  track.position.y += dy / distance2 * move;
}
function sees(world, track, point) {
  const data = ENEMY_DATA2[track.spawn.type], dx = point.x - track.position.x, dy = point.y - track.position.y, distance2 = Math.hypot(dx, dy);
  if (distance2 < GAME_CONSTANTS.AI.STANDOFF_DISTANCE + 8) return true;
  if (distance2 > data.sightRange + 8 || !hasLineOfSight(world.sight, track.position, point, data.sightRange + 8)) return false;
  const angle = Math.abs(shortestArc(Math.atan2(dy, dx) - track.facing));
  return angle <= degToRad(data.sightHalfAngleCore + 12) || distance2 <= data.sightRangePeriph + 8 && angle <= degToRad(data.sightHalfAnglePeriph + 12);
}
function findR100PatrolWindows(world, enemies, nodes, canReach) {
  if (enemies.some((enemy) => enemy.patrol.mode === "static" || enemy.patrol.waypoints.length < 2)) return [];
  const tracks = enemies.map((spawn) => ({
    spawn,
    position: { x: (spawn.spawn.col + 0.5) * 8, y: (spawn.spawn.row + 0.5) * 8 },
    facing: degToRad(spawn.facing),
    index: 1,
    direction: 1,
    pause: 0,
    points: spawn.patrol.waypoints.map((cell) => ({ x: (cell.col + 0.5) * 8, y: (cell.row + 0.5) * 8 })),
    speed: ENEMY_DATA2[spawn.type].patrolSpeed * (BODY_PROFILE_DATA2[spawn.form.substrate]?.moveScale ?? 1)
  }));
  const radius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS, grid = new TileGrid(world.layout.tileMap);
  const paint = new Set(world.pollution.paintCells.map((p) => `${Math.floor(p.x / 32)},${Math.floor(p.y / 32)}`));
  const pending = nodes.map((node) => {
    const seats = [];
    for (let dy = -radius; dy <= radius; dy += 8) for (let dx = -radius; dx <= radius; dx += 8) {
      const position = { x: node.position.x + dx, y: node.position.y + dy };
      if (Math.hypot(dx, dy) > radius || !bodyHasSupport(grid, position, 10, 10) || canReach !== void 0 && !canReach(position) || !hasLineOfSight(world.sight, position, node.position, radius + 1e-3)) continue;
      const col = Math.floor(position.x / 32), row = Math.floor(position.y / 32);
      if (paint.has(`${col},${row}`) || world.pollution.volumes.some((box) => col >= box.minCol && col <= box.maxCol && row >= box.minRow && row <= box.maxRow)) continue;
      seats.push({ position, elapsed: 0 });
    }
    return { node, seats, done: false };
  });
  const windows = [];
  for (let elapsed = STEP_MS; elapsed <= OBSERVATION_MS && windows.length < nodes.length; elapsed += STEP_MS) {
    for (const track of tracks) advance(track);
    for (const item of pending) {
      if (item.done) continue;
      for (const seat of item.seats) {
        seat.elapsed = tracks.some((track) => sees(world, track, seat.position)) ? 0 : seat.elapsed + STEP_MS;
        if (seat.elapsed < WINDOW_MS) continue;
        windows.push({ id: item.node.id, seat: seat.position, startMs: elapsed - seat.elapsed, durationMs: seat.elapsed });
        item.done = true;
        break;
      }
    }
  }
  return windows;
}
var DIRECTIONS3 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
var HALF = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
var TIERS = ["safe", "contested", "deep"];
function center(grid, cell) {
  return { x: (cell % grid.cols + 0.5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + 0.5) * grid.tileSize };
}
function cellOf(grid, point) {
  return Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
}
function routes(grid, starts) {
  const size = grid.cols * grid.rows, seats = new Uint8Array(size);
  for (let cell = 0; cell < size; cell++) seats[cell] = bodyHasSupport(grid, center(grid, cell), HALF, HALF) ? 1 : 0;
  const distance2 = new Float64Array(size).fill(Infinity), parent = new Int32Array(size).fill(-1);
  const heap = [];
  const push = (cell, cost) => {
    let index = heap.length;
    heap.push({ cell, distance: cost });
    while (index > 0) {
      const above = index - 1 >> 1;
      if (heap[above].distance <= cost) break;
      heap[index] = heap[above];
      index = above;
    }
    heap[index] = { cell, distance: cost };
  };
  const pop = () => {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let next = index * 2 + 1;
        if (next + 1 < heap.length && heap[next + 1].distance < heap[next].distance) next++;
        if (heap[next].distance >= last.distance) break;
        heap[index] = heap[next];
        index = next;
      }
      heap[index] = last;
    }
    return first;
  };
  for (const start of typeof starts === "number" ? [starts] : starts) {
    if (!seats[start]) throw new Error("Native production entrance lacks full body support");
    distance2[start] = 0;
    parent[start] = start;
    push(start, 0);
  }
  while (heap.length) {
    const entry = pop(), cell = entry.cell;
    if (entry.distance !== distance2[cell]) continue;
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols), position = center(grid, cell);
    for (const [dx, dy] of DIRECTIONS3) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      const cost = entry.distance + Math.hypot(dx, dy) * grid.tileSize;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || cost >= distance2[next] || bodyDisplacementFraction(grid, position, HALF, HALF, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
      distance2[next] = cost;
      parent[next] = cell;
      push(next, cost);
    }
  }
  return { seats, distance: distance2, parent };
}
function pathTo(grid, parent, cell) {
  const cells = [cell];
  if (parent[cell] < 0) throw new Error("Native production patrol target unreachable");
  while (parent[cells[cells.length - 1]] !== cells[cells.length - 1]) cells.push(parent[cells[cells.length - 1]]);
  cells.reverse();
  return cells.filter((value, index) => index === 0 || index === cells.length - 1 || value - cells[index - 1] !== cells[index + 1] - value).map((value) => ({ col: value % grid.cols, row: Math.floor(value / grid.cols) }));
}
function deployR100Expedition(world, definition, searchSitePolicy) {
  const base = world.layout, grid = new TileGrid(base.tileMap), start = cellOf(grid, base.spawnPoint), field2 = routes(grid, start);
  const searchSites = searchSitePolicy ? new SearchSitePlanner(world, searchSitePolicy) : void 0;
  const safePoints = world.pollution.safeRoute;
  const exitSeats = [];
  for (let cell = 0; cell < field2.seats.length; cell++) if (field2.seats[cell]) {
    const point = center(grid, cell);
    if (Math.hypot(point.x - base.extractionPoint.position.x, point.y - base.extractionPoint.position.y) <= base.extractionPoint.triggerRadius) exitSeats.push(cell);
  }
  const toExit = routes(grid, exitSeats), directReturn = toExit.distance[start];
  if (!Number.isFinite(directReturn)) throw new Error("Native production cannot reach its extraction area");
  const pollutionDistance = (point) => {
    let distance2 = Infinity;
    for (const painted of world.pollution.paintCells) distance2 = Math.min(distance2, Math.max(0, Math.hypot(point.x - painted.x, point.y - painted.y) - 24));
    for (const box of world.pollution.volumes) {
      const dx = Math.max(box.minCol * 32 - point.x, 0, point.x - (box.maxCol + 1) * 32);
      const dy = Math.max(box.minRow * 32 - point.y, 0, point.y - (box.maxRow + 1) * 32);
      distance2 = Math.min(distance2, Math.hypot(dx, dy));
    }
    return distance2;
  };
  const candidates = [];
  for (let cell = 0; cell < field2.distance.length; cell++) {
    if (!Number.isFinite(field2.distance[cell])) continue;
    const position = center(grid, cell);
    if (cell % grid.cols % 2 || Math.floor(cell / grid.cols) % 2) continue;
    if (Math.hypot(position.x - base.spawnPoint.x, position.y - base.spawnPoint.y) < 64 || Math.hypot(position.x - base.extractionPoint.position.x, position.y - base.extractionPoint.position.y) < 48) continue;
    let interactionDistance = Infinity, approachDistance = Infinity, interactionSeats = 0;
    const radius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS, steps = Math.ceil(radius / grid.tileSize);
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    for (let dy = -steps; dy <= steps; dy++) for (let dx = -steps; dx <= steps; dx++) {
      if (Math.hypot(dx, dy) * grid.tileSize > radius || col + dx < 0 || row + dy < 0 || col + dx >= grid.cols || row + dy >= grid.rows) continue;
      const seat = (row + dy) * grid.cols + col + dx, seatPoint = center(grid, seat);
      if (!Number.isFinite(field2.distance[seat]) || !Number.isFinite(toExit.distance[seat]) || !hasLineOfSight(world.sight, seatPoint, position, radius + 1e-3)) continue;
      interactionSeats++;
      interactionDistance = Math.min(interactionDistance, field2.distance[seat] + toExit.distance[seat] - directReturn);
      approachDistance = Math.min(approachDistance, field2.distance[seat]);
    }
    candidates.push({ cell, position, distance: interactionDistance, approachDistance, interactionSeats, pollutionDistance: pollutionDistance(position) });
  }
  const maxDistance = Math.max(...candidates.map((seat) => seat.distance));
  const spatial = world.spatialDeployment;
  const chosen = [];
  const kindlingNodes = [], contaminantNodes = [];
  for (const tier of TIERS) for (const kind of ["kindling", "contaminant"]) {
    const count = definition[`${kind}_${tier}_count`];
    for (let slot = 0; slot < count; slot++) {
      const minDepth = tier === "safe" ? 0 : tier === "contested" ? 0.32 : 0.65;
      const maxDepth = tier === "safe" ? 0.4 : tier === "contested" ? 0.8 : 1;
      const minimum = spatial ? tier === "safe" ? 0 : spatial[`${tier}_min_extra_travel_px`] : maxDistance * minDepth;
      const maximum = spatial ? spatial[`${tier}_max_extra_travel_px`] : maxDistance * maxDepth;
      const allowed = candidates.filter((seat2) => seat2.distance >= minimum && seat2.distance <= maximum && (!spatial || seat2.approachDistance <= (tier === "safe" ? spatial.safe_max_approach_px : spatial.max_search_approach_px)) && seat2.pollutionDistance >= (tier === "safe" ? 34 : 16) && (tier !== "safe" || safePoints.some((point) => Math.hypot(point.x - seat2.position.x, point.y - seat2.position.y) < 30)) && (!spatial || tier !== "deep" || seat2.pollutionDistance <= 100) && chosen.every((other) => Math.hypot(other.seat.position.x - seat2.position.x, other.seat.position.y - seat2.position.y) >= (spatial?.node_spacing_px ?? 52)));
      const goal = spatial ? (minimum + maximum) / 2 : maxDistance * (tier === "safe" ? 0.2 : tier === "contested" ? 0.57 : 0.85);
      const score = (seat2) => -Math.abs(seat2.distance - goal) + (tier === "safe" ? Math.min(100, seat2.pollutionDistance) * 0.5 : -Math.min(180, seat2.pollutionDistance) * 0.45) + (spatial && chosen.length ? Math.min(600, ...chosen.map((other) => Math.hypot(other.seat.position.x - seat2.position.x, other.seat.position.y - seat2.position.y))) * spatial.node_spread_weight : 0) - (spatial && tier === "safe" ? seat2.approachDistance * 0.2 : 0) + (searchSites?.score(seat2.position) ?? 0) + mix32(base.seed, `r100-content-${kind}-${tier}-${slot}-${seat2.cell}`) / 4294967296 * 64;
      allowed.sort((a, b) => score(b) - score(a) || a.cell - b.cell);
      const seat = allowed[0];
      if (!seat) throw new Error(`Cannot admit ${kind}/${tier}/${slot} with a full native route`);
      chosen.push({ seat, tier, kind });
      const id = `r100-${kind}-${tier}-${slot + 1}`;
      if (kind === "kindling") kindlingNodes.push({ id, tier, position: seat.position, value: definition[`kindling_${tier}_value`] });
      else contaminantNodes.push({ id, tier, position: seat.position });
    }
  }
  const threats = chosen.filter((item) => item.tier !== "safe").sort((a, b) => b.seat.distance - a.seat.distance);
  const enemies = [];
  for (let slot = 0; slot < definition.enemy_count; slot++) {
    const target = threats[Math.floor(slot * threats.length / definition.enemy_count)].seat;
    const allowed = candidates.filter((seat2) => seat2.distance >= (spatial?.contested_min_extra_travel_px ?? maxDistance * 0.38) && seat2.pollutionDistance >= 14 && (!spatial || seat2.approachDistance <= spatial.max_search_approach_px) && Math.hypot(seat2.position.x - base.spawnPoint.x, seat2.position.y - base.spawnPoint.y) >= 170 && chosen.filter((item) => item.tier === "safe").every((item) => Math.hypot(seat2.position.x - item.seat.position.x, seat2.position.y - item.seat.position.y) >= 112) && chosen.every((item) => Math.hypot(seat2.position.x - item.seat.position.x, seat2.position.y - item.seat.position.y) >= 40) && enemies.every((enemy) => Math.hypot(seat2.position.x - (enemy.spawn.col + 0.5) * 8, seat2.position.y - (enemy.spawn.row + 0.5) * 8) >= 96));
    allowed.sort((a, b) => Math.abs(Math.hypot(a.position.x - target.position.x, a.position.y - target.position.y) - 78) - Math.abs(Math.hypot(b.position.x - target.position.x, b.position.y - target.position.y) - 78) || a.cell - b.cell);
    let seat, local, end;
    const endpoints = candidates.filter((point) => point.pollutionDistance >= 14 && Math.hypot(point.position.x - base.spawnPoint.x, point.position.y - base.spawnPoint.y) >= 144 && chosen.filter((item) => item.tier === "safe").every((item) => Math.hypot(point.position.x - item.seat.position.x, point.position.y - item.seat.position.y) >= 96) && chosen.every((item) => Math.hypot(point.position.x - item.seat.position.x, point.position.y - item.seat.position.y) >= 40));
    for (const candidate of allowed) {
      const route = routes(grid, candidate.cell);
      const patrolTargets = endpoints.filter((point) => route.distance[point.cell] >= 88 && route.distance[point.cell] <= 200);
      patrolTargets.sort((a, b) => mix32(base.seed, `patrol-${slot}-${a.cell}`) - mix32(base.seed, `patrol-${slot}-${b.cell}`));
      if (!patrolTargets.length) continue;
      seat = candidate;
      local = route;
      end = patrolTargets[0];
      break;
    }
    if (!seat || !local || !end) throw new Error("Native patrol has no observable moving route; static fallback is forbidden");
    const waypoints = pathTo(grid, local.parent, end.cell), hearing = slot === definition.enemy_count - 1;
    enemies.push({
      id: hearing ? "ENM_RWR_01" : `ENM_INF_${String(slot + 1).padStart(2, "0")}`,
      type: hearing ? "rewriter" : "infiltrator",
      spawn: { col: seat.cell % grid.cols, row: Math.floor(seat.cell / grid.cols) },
      facing: Math.round(Math.atan2(target.position.y - seat.position.y, target.position.x - seat.position.x) * 180 / Math.PI * 1e6) / 1e6,
      patrol: { mode: waypoints.length > 1 ? "pingpong" : "static", waypoints },
      form: hearing ? REWRITER_FORM : INFILTRATOR_FORM
    });
  }
  for (const item of chosen.filter((item2) => item2.tier === "deep")) {
    const hostile = enemies.some((enemy) => enemy.patrol.waypoints.some((point) => Math.hypot((point.col + 0.5) * 8 - item.seat.position.x, (point.row + 0.5) * 8 - item.seat.position.y) <= 180 && hasLineOfSight(world.sight, { x: (point.col + 0.5) * 8, y: (point.row + 0.5) * 8 }, item.seat.position, 180)));
    if (!hostile && item.seat.pollutionDistance > 100) throw new Error("Deep prize has no actual hostile approach");
  }
  const searchable = [...kindlingNodes, ...contaminantNodes].filter((node) => node.tier !== "safe");
  const patrolWindows = findR100PatrolWindows(
    world,
    enemies,
    searchable,
    spatial ? (point) => Number.isFinite(field2.distance[cellOf(grid, point)]) : void 0
  );
  if (patrolWindows.length !== searchable.length) throw new Error(`No complete search window: ${searchable.filter((node) => !patrolWindows.some((window) => window.id === node.id)).map((node) => node.id).join(",")}`);
  const layout = {
    ...base,
    recipeId: `r100-native-v3:${world.definition.id}`,
    kindlingNodes,
    contaminantNodes,
    enemySpawns: enemies,
    contaminationDraw: { forms: [...enemies.map((enemy) => enemy.form), ...world.pollution.forms], warnings: [] }
  };
  const placements = searchSites ? [...kindlingNodes, ...contaminantNodes].map((node) => searchSites.placement(node.id, node.position)) : void 0;
  return { layout, ...placements ? { searchSites: placements } : {}, diagnostics: {
    reachableBodySeats: field2.distance.reduce((sum, distance2) => sum + Number(Number.isFinite(distance2)), 0),
    extractionRoutePx: field2.distance[cellOf(grid, base.extractionPoint.position)],
    maximumExtraTravelPx: maxDistance,
    directReturnRoutePx: directReturn,
    nodes: chosen.map((item) => ({ id: `${item.kind}/${item.tier}`, minimumExtraTravelPx: item.seat.distance, approachRoutePx: item.seat.approachDistance, interactionSeats: item.seat.interactionSeats, pollutionDistancePx: item.seat.pollutionDistance })),
    patrolWindows,
    patrolWindowContract: "2400ms unalerted-route model, dry full-body station; live approach/pursuit verified separately",
    ...spatial ? { spatialDeployment: spatial, searchExtraTravelCapPx: spatial.deep_max_extra_travel_px } : {},
    ...placements ? { searchSites: placements.map((site) => ({ nodeId: site.nodeId, sourceKind: site.sourceKind, family: site.family, sourceDomain: site.sourceDomain, sourceObjectId: site.sourceObjectId })), environmentScoreCap: searchSitePolicy.environmentScoreCap } : {},
    costBasis: "all-body-safe-48px-interaction-seats",
    guaranteedSafeReturn: true,
    enemyCount: enemies.length,
    kindlingCount: kindlingNodes.length,
    contaminantCount: contaminantNodes.length
  } };
}
function serializeR100MasterWorld(world, gradeDefinition, packageHash) {
  const { layout: _layout, sight: _sight, combat: _combat, matterAt: _matterAt, roleAt: _roleAt, ...data } = world;
  return { ...data, gradeDefinition, packageHash };
}
function hydrateR100MasterWorld(native, layout) {
  const map = layout.tileMap, width = map.cols * map.tileSize, height = map.rows * map.tileSize;
  if (map.tileSize !== 8 || native.hostTileMap.tileSize !== 32 || native.raster.width !== width || native.raster.height !== height || native.raster.objectId.length !== width * height)
    throw new Error("Native world transfer dimensions do not match its physical layout");
  const matterAt = (x, y) => x >= 0 && y >= 0 && x < width && y < height && map.tiles[Math.floor(y / map.tileSize)][Math.floor(x / map.tileSize)] !== 3;
  const roles = new Map(native.definition.instances.map((instance) => [instance.id, instance.role]));
  const roleAt = (x, y) => !matterAt(x, y) ? null : roles.get(native.raster.objectId[Math.floor(y) * width + Math.floor(x)]) ?? null;
  const world = {
    ...native,
    layout,
    matterAt,
    roleAt,
    combat: new TileGrid(map),
    sight: {
      cols: map.cols,
      rows: map.rows,
      tileSize: map.tileSize,
      version: 0,
      isOpaque: (col, row) => col < 0 || row < 0 || col >= map.cols || row >= map.rows || map.tiles[row][col] === 3
      /* VOID */
    }
  };
  validateSearchSites(world);
  return world;
}
function createR100ProductionMap(recipe) {
  if (!validR100ProductionRecipe(recipe)) throw new Error("Invalid or unavailable native world package");
  const rejected = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const seed2 = attempt === 0 ? recipe.requestedSeed : mix32(recipe.requestedSeed, `r100-native-v3-attempt-${attempt}`);
    try {
      const master = createR100SpatialWorld(
        recipe.nativeDefinition,
        recipe.spatialPolicy,
        seed2,
        { grade: recipe.gradeDefinition, profile: recipe.profile }
      );
      const deployed = deployR100Expedition(master, recipe.contentDefinition, recipe.searchSitePolicy), layout = deployed.layout;
      const native = serializeR100MasterWorld({ ...master, algorithmRevision: 9, searchSites: deployed.searchSites, appearance: recipe.appearance, layout, diagnostics: {
        ...master.diagnostics,
        qualification: "v3-production-candidate",
        expedition: deployed.diagnostics
      } }, recipe.gradeDefinition, recipe.package.dependencyHash);
      return {
        sample: master.sample,
        layout,
        hostTileMap: master.hostTileMap,
        native,
        metadata: {
          world: recipe.package.id,
          space: recipe.nativeDefinition.id,
          contentFragmentTypeId: recipe.contentFragmentTypeId,
          requestedSeed: recipe.requestedSeed,
          effectiveSeed: layout.seed,
          attempt,
          rejected,
          signature: checkpointChecksum({ recipe, geometry: master.diagnostics.geometryFingerprint, content: deployed.diagnostics }),
          bodySize: 20,
          supportTileSize: 8,
          hostTileSize: 32,
          reachableBodySeats: Number(deployed.diagnostics.reachableBodySeats),
          extractionRoutePx: Number(deployed.diagnostics.extractionRoutePx)
        }
      };
    } catch (error) {
      rejected.push({ seed: seed2, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  throw new Error(`Native v3 world could not admit its complete ${recipe.nativeDefinition.grade} contents after 8 attempts: ${rejected.map((item) => item.reason).join("; ")}`);
}
function materialHash(x, y, seed2) {
  let value = Math.imul(x | 0, 521288629) ^ Math.imul(y | 0, 1597334677) ^ seed2;
  value = Math.imul(value ^ value >>> 16, 73244475);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}
function materialNoise(x, y, seed2) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = materialHash(ix, iy, seed2), b = materialHash(ix + 1, iy, seed2);
  const c = materialHash(ix, iy + 1, seed2), d = materialHash(ix + 1, iy + 1, seed2);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
var clamp4 = (value) => Math.max(0, Math.min(1, value));
var smooth2 = (value) => {
  const t = clamp4(value);
  return t * t * (3 - 2 * t);
};
var luminance2 = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;
function paintedToneRange(surface) {
  const histogram = new Uint32Array(256), pixels = surface.pixels;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    if (!pixels[index + 3]) continue;
    const bin = Math.round(luminance2(pixels[index], pixels[index + 1], pixels[index + 2]));
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
function sampleWorldAppearance(appearance, u, v, seed2, out) {
  const scale = appearance.patternScale, x = u / scale, y = v / scale;
  const broad = materialNoise(x * 0.71, y * 0.83, seed2 ^ 14425);
  const wx = x + (materialNoise(x * 0.93, y * 0.81, seed2 ^ 18209) - 0.5) * 1.7;
  const wy = y + (materialNoise(x * 0.86, y * 1.07, seed2 ^ 8537) - 0.5) * 1.9;
  let structure = broad;
  switch (appearance.groundPattern) {
    case "strata":
      structure = materialNoise(wx * 0.74, wy * 1.7, seed2 ^ 29059);
      break;
    case "veins":
      structure = materialNoise(wx * 0.81, wy * 2.3, seed2 ^ 17047);
      break;
    case "plates":
      structure = materialNoise(wx * 1.35, wy * 1.1, seed2 ^ 26657);
      break;
    case "grains":
      structure = materialNoise(wx * 2.1, wy * 1.7, seed2 ^ 6455) * 0.74 + broad * 0.26;
      break;
    case "tension":
      structure = materialNoise(wx * 1.15, wy * 0.83, seed2 ^ 22291);
      break;
    case "flow":
      structure = materialNoise(wx * 0.83, wy * 1.6, seed2 ^ 38193);
      break;
  }
  const organized = clamp4((structure - 0.16) / 0.68);
  const threshold = 1 - appearance.secondaryCoverage;
  out.secondary = appearance.secondaryCoverage === 0 ? 0 : smooth2((organized - threshold + 0.13) / 0.26);
  out.tone = (structure - 0.5) * appearance.patternStrength * 0.22;
  const quiet = smooth2((appearance.quietCoverage - broad + 0.12) / 0.24);
  out.detail = appearance.textureContrast * (1 - quiet * 0.48);
}
function rampChannel(ramp, tone, channel2) {
  const shift = 16 - channel2 * 8;
  const a = (tone < 0.5 ? ramp.dark : ramp.mid) >>> shift & 255;
  const b = (tone < 0.5 ? ramp.mid : ramp.light) >>> shift & 255;
  const amount = tone < 0.5 ? tone * 2 : (tone - 0.5) * 2;
  return a + (b - a) * amount;
}
function mapWorldPigment(appearance, role, red, green, blue, range2, field2, secondary, out) {
  const lum = luminance2(red, green, blue);
  const span = lum < range2.mid ? range2.mid - range2.low : range2.high - range2.mid;
  const raw = (lum - range2.mid) / span;
  const normalized = raw / (1 + Math.abs(raw) * 0.22);
  const contrast = role === "ground" ? field2.detail : appearance.textureContrast;
  const tone = clamp4(0.5 + normalized * 0.43 * contrast + (role === "ground" ? field2.tone : 0));
  const ramp = appearance[role];
  const boundary = secondary * (1 - secondary) * 4;
  const materialMix = role === "ground" ? clamp4(secondary + normalized * boundary * 0.19) : secondary;
  for (let channel2 = 0; channel2 < 3; channel2++) {
    const primary = rampChannel(ramp, tone, channel2), second = rampChannel(appearance.secondary, tone, channel2);
    const source = channel2 === 0 ? red : channel2 === 1 ? green : blue;
    out[channel2] = Math.max(0, Math.min(255, primary + (second - primary) * materialMix + (source - lum) * 0.035));
  }
}
function fracturePigment(x, y, salt) {
  const hash2 = (a2, b2) => {
    let h = Math.imul(a2 ^ salt, 374761393) ^ Math.imul(b2, 668265263);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };
  const a = Math.floor(x), b = Math.floor(y), u = x - a, v = y - b, uu = u * u * (3 - 2 * u), vv = v * v * (3 - 2 * v);
  return (hash2(a, b) * (1 - uu) + hash2(a + 1, b) * uu) * (1 - vv) + (hash2(a, b + 1) * (1 - uu) + hash2(a + 1, b + 1) * uu) * vv;
}
function buildMasterSurfaceFields(world) {
  const r = world.raster, w = r.width, h = r.height, total = w * h;
  const solid = new Uint8Array(total), edgeDistance = new Float32Array(total), fractureDistance = new Float32Array(total), infection = new Float32Array(total);
  const roles = new Map(world.definition.instances.map((value) => [value.id, value.role]));
  edgeDistance.fill(999);
  fractureDistance.fill(999);
  for (let i = 0; i < total; i++) {
    solid[i] = r.matter[i] && roles.get(r.objectId[i]) === "solid" ? 1 : 0;
    if (!solid[i]) edgeDistance[i] = 0;
    if (r.matter[i] && r.material[i] === 3) fractureDistance[i] = 0;
  }
  const erosion = new Float32Array(total), erosionDistance = new Float32Array(total).fill(999);
  const within = (polygon, x, y) => {
    let inside2 = false;
    for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
      const p = polygon[a], q = polygon[b];
      if (p.y > y !== q.y > y && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) inside2 = !inside2;
    }
    return inside2;
  };
  for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
    const outsideOutline = world.definition.terrainOutline !== void 0 && !within(world.definition.terrainOutline, x + 4, y + 4);
    if (world.matterAt(x + 4, y + 4) || !outsideOutline && !world.definition.erosion.some((polygon) => within(polygon, x + 4, y + 4))) continue;
    for (let yy = y; yy < Math.min(y + 8, h); yy++) for (let xx = x; xx < Math.min(x + 8, w); xx++) erosionDistance[yy * w + xx] = 0;
  }
  const relax = (i, j, cost) => {
    if (solid[i]) edgeDistance[i] = Math.min(edgeDistance[i], edgeDistance[j] + cost);
    if (r.matter[i] && r.matter[j] && r.objectId[j] === r.objectId[i]) fractureDistance[i] = Math.min(fractureDistance[i], fractureDistance[j] + cost);
    erosionDistance[i] = Math.min(erosionDistance[i], erosionDistance[j] + cost);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) {
      relax(i, i - w, 1);
      if (x > 0) relax(i, i - w - 1, 1.414);
      if (x + 1 < w) relax(i, i - w + 1, 1.414);
    }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (x + 1 < w) relax(i, i + 1, 1);
    if (y + 1 < h) {
      relax(i, i + w, 1);
      if (x > 0) relax(i, i + w - 1, 1.414);
      if (x + 1 < w) relax(i, i + w + 1, 1.414);
    }
  }
  const width = world.definition.grade === "low" ? 8 : world.definition.grade === "medium" ? 12 : 17;
  const reach = world.definition.grade === "low" ? 88 : world.definition.grade === "medium" ? 132 : 180;
  let infectedPixels = 0;
  for (const i of r.occupiedPixels) {
    if (!world.matterAt(i % w, Math.floor(i / w))) continue;
    const d = fractureDistance[i];
    if (d > reach) continue;
    const u = r.uv[i * 2], v = r.uv[i * 2 + 1];
    const breakup = 0.76 + 0.16 * Math.sin(u * 0.29 + v * 0.13) + 0.08 * Math.sin(u * 0.81 - v * 0.39);
    const raggedWidth = width * breakup;
    const value = Math.max(0, 1 - d / raggedWidth);
    const exposed = r.material[i] === 1 || r.material[i] === 2 || r.region[i] === 2 || r.family[i] === 2 && r.normals[i * 3 + 2] < 0.94;
    const split = Math.max(0, 1 - Math.abs(Math.sin(v * 0.43 + Math.sin(u * 0.034) * 0.72)) / 0.3);
    const broken = Math.max(0.08, 0.55 + 0.45 * Math.sin(u * 0.13 + v * 0.043));
    let continuation = exposed ? split * broken * Math.sqrt(Math.max(0, 1 - d / reach)) * 0.92 : 0;
    if (r.family[i] >= 4) {
      const object3 = r.objectId[i], wide = fracturePigment(u / 23, v / 19, object3 + world.definition.seed);
      const fine = fracturePigment(u / 7, v / 9, object3 + 337), patch = Math.max(0, 1 - Math.abs(wide * 0.77 + fine * 0.23 - 0.54) * 9);
      const damage = r.material[i] === 1 ? 1 : r.region[i] === 4 ? 0.6 : r.region[i] === 1 ? 0.72 : r.material[i] === 2 ? 0.42 : 0.2;
      continuation = patch * patch * damage * Math.pow(Math.max(0, 1 - d / reach), 1.6) * 0.84;
    }
    infection[i] = Math.max(value * value, continuation);
    if (infection[i] > 0.025) infectedPixels++;
  }
  const erosionWidth = world.definition.grade === "low" ? 12 : world.definition.grade === "medium" ? 17 : 23;
  for (let i = 0; i < total; i++) {
    const x = i % w, y = Math.floor(i / w), d = erosionDistance[i];
    if (!world.matterAt(x, y) || d > erosionWidth) continue;
    const bands = 0.64 + 0.24 * Math.sin(x * 0.19 + y * 0.11) + 0.12 * Math.sin(x * 0.47 - y * 0.23);
    const decay = Math.max(0, 1 - d / (erosionWidth * bands));
    erosion[i] = decay * decay * (0.5 + 0.5 * bands);
  }
  return { solid, edgeDistance, fractureDistance, infection, erosion, infectedPixels };
}
function paintMasterGround(world) {
  const sample = world.sample, width = sample.cols * sample.tileSize, height = sample.rows * sample.tileSize;
  const support = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) support[y * width + x] = world.matterAt(x, y) ? 1 : 0;
  return bakeMasterGround({
    width,
    height,
    seed: sample.seed,
    axis: world.definition.axis,
    material: sample.profile.material,
    palette: sample.profile.palette,
    support,
    sources: world.definition.instances
  });
}
function prepareOrganizationSurfaceWindows(meshes, primaryFamily, painting) {
  const result = /* @__PURE__ */ new Map();
  for (const mesh of meshes) {
    if (mesh.spec.family !== primaryFamily) continue;
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    const localUvLength = (mesh.groundEdgeStart?.vertex ?? mesh.vertexCount) * 2;
    for (let i = 0; i < localUvLength; i += 2) {
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
        const seed2 = mesh.spec.seed >>> 0;
        return {
          left,
          top,
          width,
          height,
          sourceWidth: surface.width,
          minU,
          minV,
          scale,
          offsetU: 1 + (width - 2 - spanU * scale) * (seed2 % 83 / 82),
          offsetV: 1 + (height - 2 - spanV * scale) * ((seed2 >>> 8) % 97 / 96)
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
var rgb = (hex) => [hex >>> 16 & 255, hex >>> 8 & 255, hex & 255];
var mix2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function masterVolumePalette(world) {
  const p = world.sample.profile.palette, ramp = deriveFragmentContamRamp("frag-outdoor");
  const neutral = (ramp.mid[0] + ramp.mid[1] + ramp.mid[2]) / 3;
  const sourceColor = mix2(ramp.core, [neutral, neutral, neutral], 0.2);
  return {
    outer: { base: rgb(p.materialMid), dark: rgb(p.materialDark), light: rgb(p.materialLight), roughness: 0.84, structure: 0.75 },
    cut: { base: mix2(rgb(p.materialMid), rgb(p.materialLight), 0.25), dark: rgb(p.materialDark), light: rgb(p.faceLight), roughness: 0.93, structure: 0.82 },
    inner: { base: rgb(p.materialMid), dark: rgb(p.shadow), light: rgb(p.materialLight), roughness: 0.62, structure: 0.72 },
    joint: { base: rgb(p.shadow), dark: rgb(p.floorDeep), light: rgb(p.materialMid), roughness: 0.51, structure: 0.5, emission: sourceColor, emissionStrength: 0.72 + world.definition.emission * 0.4 }
  };
}
function bakeMasterSurface(world, ground, volume, painting) {
  const r = world.raster, w = r.width, h = r.height, size = w * h;
  const fields = buildMasterSurfaceFields(world), ramp = deriveFragmentContamRamp("frag-outdoor");
  const diagnostics = { structuralEmissionPixels: fields.infection.reduce((n, v) => n + (v > 0.15 ? 1 : 0), 0), erosionEdgePixels: fields.erosion.reduce((n, v) => n + (v > 0.1 ? 1 : 0), 0), blockingSurfaceMaterial: painting?.solid ? "dedicated compact skin/fracture atlas and finish; geometric face normals" : "object-local UV; no perimeter brightening", greenOwnership: "actual fractured object or authored light-eaten edge; never the whole floor" };
  const albedo = new Uint8Array(size * 4), normal = new Uint8Array(size * 4), response = new Uint8Array(size * 4), emission = new Uint8Array(size * 4);
  const axis = painting ? world.definition.axis : 0, ca = Math.cos(axis), sa = Math.sin(axis), seed2 = painting ? world.sample.seed : 0;
  const appearance = world.appearance;
  const identityField = { secondary: 0, tone: 0, detail: 1 };
  const mapped = new Float32Array(3), mappedGround = new Float32Array(3), transmitted = new Float32Array(3);
  const ranges = /* @__PURE__ */ new Map();
  const getRange = (surface) => {
    let range2 = ranges.get(surface);
    if (!range2) {
      range2 = paintedToneRange(surface);
      ranges.set(surface, range2);
    }
    return range2;
  };
  const primaryFamilyIndex = NATIVE_VOLUME_FAMILY_SEQUENCE.indexOf(world.definition.family) + 1;
  const familyPaints = [void 0, ...NATIVE_VOLUME_FAMILY_SEQUENCE.map((family) => painting?.families?.[family] ?? painting)];
  const organizationWindows = appearance?.materialOrganization && painting ? prepareOrganizationSurfaceWindows(world.meshes, world.definition.family, painting) : void 0;
  const mirror2 = (v, extent) => {
    const period = extent * 2, n = (Math.floor(v) % period + period) % period;
    return n < extent ? n : period - n - 1;
  };
  for (let i = 0; i < size; i++) {
    const x = i % w, y = Math.floor(i / w), q = i * 4, n = i * 3;
    if (!world.matterAt(x, y)) continue;
    const hasSurface = r.matter[i] === 1, height = hasSurface ? r.heightField[i] : ground.heightField[i];
    const cut = hasSurface && r.material[i] === 1;
    const objectPaint = hasSurface ? familyPaints[r.family[i]] : painting;
    const solidPaint = fields.solid[i] === 1 ? objectPaint?.solid : void 0;
    const receiverPaint = solidPaint ?? objectPaint;
    const groundEdge = r.groundEdgePixels !== void 0 && (r.groundEdgePixels[i >>> 5] & 1 << (i & 31)) !== 0;
    const organizedSurface = hasSurface && !groundEdge ? organizationWindows?.get(r.objectId[i]) : void 0;
    const transmission = hasSurface && r.material[i] === 2 ? r.family[i] === 5 ? 0.32 : r.family[i] === 6 ? 0.2 : 0 : 0;
    let transmittedIndex = 0;
    if (transmission && painting) {
      const scale = painting.width / painting.worldSize;
      transmittedIndex = (mirror2((-x * sa + y * ca) * scale + (seed2 >>> 8) % 97, painting.height) * painting.width + mirror2((x * ca + y * sa) * scale + seed2 % 83, painting.width)) * 4;
    }
    let paintingIndex = 0, worldPaintingIndex = 0;
    let paintRegion = "skin";
    if (receiverPaint) {
      if (hasSurface) {
        paintRegion = cut || r.region[i] === 2 || r.region[i] === 3 || r.region[i] === 4 ? "cleaved" : "skin";
        if (r.family[i] === 2) paintRegion = r.material[i] === 2 ? "loose" : "cleaved";
        if (r.family[i] === 3 && r.material[i] === 2) paintRegion = "cleaved";
      } else paintRegion = ground.materialEvents[i] === 2 ? "loose" : ground.materialEvents[i] === 1 ? "cleaved" : "skin";
      if (solidPaint) paintRegion = cut || r.material[i] === 2 || r.material[i] === 3 ? "cleaved" : "skin";
      const local = fields.solid[i] === 1 || cut || hasSurface && r.family[i] === 2 || organizedSurface !== void 0;
      const u = local ? r.uv[i * 2] : x * ca + y * sa, v = local ? r.uv[i * 2 + 1] : -x * sa + y * ca;
      const scale = receiverPaint.width / receiverPaint.worldSize;
      const px = mirror2(u * scale + seed2 % 83, receiverPaint.width), py = mirror2(v * scale + (seed2 >>> 8) % 97, receiverPaint.height);
      worldPaintingIndex = (py * receiverPaint.width + px) * 4;
      const patch = receiverPaint.regions?.[paintRegion];
      if (patch) {
        const left = Math.round(patch.x * receiverPaint.width), top = Math.round(patch.y * receiverPaint.height);
        const pw = Math.min(receiverPaint.width - left, Math.max(1, Math.round(patch.width * receiverPaint.width)));
        const ph = Math.min(receiverPaint.height - top, Math.max(1, Math.round(patch.height * receiverPaint.height)));
        const organizedWindow = (solidPaint ? organizedSurface?.solid : organizedSurface?.ground)?.[paintRegion];
        if (organizedWindow) {
          paintingIndex = organizationSampleIndex(organizedWindow, u, v);
        } else {
          const sx = left + mirror2(u * scale + seed2 % 83, pw), sy = top + mirror2(v * scale + (seed2 >>> 8) % 97, ph);
          paintingIndex = (sy * receiverPaint.width + sx) * 4;
        }
      } else paintingIndex = worldPaintingIndex;
    }
    if (appearance) {
      sampleWorldAppearance(appearance, x * ca + y * sa, -x * sa + y * ca, seed2, identityField);
      if (receiverPaint) {
        const primaryFamily = !hasSurface || r.family[i] === primaryFamilyIndex;
        const role = hasSurface ? paintRegion === "cleaved" ? "cleaved" : "solid" : "ground";
        const secondary = hasSurface ? primaryFamily ? 0 : 1 : identityField.secondary;
        const patchWeight = solidPaint || organizedSurface ? 1 : 0.92, worldWeight = 1 - patchWeight;
        mapWorldPigment(
          appearance,
          role,
          receiverPaint.pixels[paintingIndex] * patchWeight + receiverPaint.pixels[worldPaintingIndex] * worldWeight,
          receiverPaint.pixels[paintingIndex + 1] * patchWeight + receiverPaint.pixels[worldPaintingIndex + 1] * worldWeight,
          receiverPaint.pixels[paintingIndex + 2] * patchWeight + receiverPaint.pixels[worldPaintingIndex + 2] * worldWeight,
          getRange(receiverPaint),
          identityField,
          secondary,
          mapped
        );
        if (hasSurface && !fields.solid[i]) {
          const exposure = Math.min(1, Math.max(0, height - ground.heightField[i]) / 6);
          if (exposure < 1) {
            mapWorldPigment(appearance, "ground", receiverPaint.pixels[paintingIndex], receiverPaint.pixels[paintingIndex + 1], receiverPaint.pixels[paintingIndex + 2], getRange(receiverPaint), identityField, identityField.secondary, mappedGround);
            for (let c = 0; c < 3; c++) mapped[c] = mappedGround[c] * (1 - exposure) + mapped[c] * exposure;
          }
        }
      }
      if (transmission && painting) mapWorldPigment(appearance, "ground", painting.pixels[transmittedIndex], painting.pixels[transmittedIndex + 1], painting.pixels[transmittedIndex + 2], getRange(painting), identityField, identityField.secondary, transmitted);
    }
    let ao = hasSurface ? r.ambientOcclusion[i] : ground.ambientOcclusion[i];
    if (!hasSurface) {
      let enclosure = 0;
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [7, 7], [-7, 7], [7, -7], [-7, -7], [14, 0], [-14, 0], [0, 14], [0, -14]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (r.matter[j]) enclosure += Math.min(1, Math.max(0, r.heightField[j] - height) / Math.hypot(dx, dy));
      }
      ao *= 1 - Math.min(0.28, enclosure * 0.047);
    }
    for (let c = 0; c < 3; c++) {
      const exposure = fields.solid[i] ? 1 : Math.min(1, Math.max(0, height - ground.heightField[i]) / 10);
      albedo[q + c] = hasSurface ? ground.albedo[q + c] * (1 - exposure) + volume.albedo[n + c] * exposure : ground.albedo[q + c];
      if (receiverPaint) {
        const pigment = solidPaint ? receiverPaint.pixels[paintingIndex + c] : receiverPaint.pixels[paintingIndex + c] * 0.92 + receiverPaint.pixels[worldPaintingIndex + c] * 0.08;
        const gain = solidPaint ? paintRegion === "skin" ? solidPaint.gain : solidPaint.cutGain : cut ? 1.12 : fields.solid[i] ? r.material[i] === 2 ? 0.64 : 0.73 : hasSurface ? 0.87 + 0.13 * exposure : 0.87;
        albedo[q + c] = appearance ? mapped[c] : Math.min(255, pigment * gain * 0.94 + albedo[q + c] * 0.06);
      }
      if (transmission) {
        const substrate = painting ? appearance ? transmitted[c] : painting.pixels[transmittedIndex + c] * 0.87 : ground.albedo[q + c];
        albedo[q + c] = albedo[q + c] * (1 - transmission) + substrate * transmission;
      }
      const faceNormal = solidPaint ? r.normals[n + c] * 0.94 + volume.shadingNormals[n + c] * 0.06 : hasSurface ? volume.shadingNormals[n + c] : ground.normals[n + c];
      normal[q + c] = Math.round((faceNormal * 0.5 + 0.5) * 255);
      emission[q + c] = hasSurface ? Math.min(255, volume.emission[n + c]) : 0;
      const erosion = fields.erosion[i];
      const infection = Math.max(fields.infection[i], erosion * 0.82);
      if (infection > 0) {
        const pigment = ramp.mid[c] * 0.82 + ramp.core[c] * 0.18;
        albedo[q + c] = albedo[q + c] * (1 - infection * 0.68) + pigment * infection * 0.68;
        const glow = (ramp.core[c] * 0.66 + ramp.mid[c] * 0.34) * infection * (erosion > 0 ? 0.72 : 1);
        emission[q + c] = Math.max(emission[q + c], Math.min(255, glow));
      }
    }
    albedo[q + 3] = 255;
    normal[q + 3] = Math.round(ao * 255);
    const encoded = Math.max(0, Math.min(65535, Math.round(height * 128)));
    const roughness = hasSurface ? volume.roughness[i] : ground.roughness[i];
    const finish = paintRegion === "loose" ? 0.94 : paintRegion === "cleaved" ? 0.76 : 0.86;
    const surfaceFinish = solidPaint ? Math.min(0.98, (paintRegion === "skin" ? solidPaint.skinRoughness : solidPaint.cutRoughness) + (roughness - 0.7) * 0.04) : painting ? roughness * 0.35 + finish * 0.65 : roughness;
    response[q] = Math.round(surfaceFinish * 255);
    response[q + 1] = encoded >>> 8;
    response[q + 2] = encoded & 255;
    response[q + 3] = hasSurface ? 255 : 0;
  }
  return { width: w, height: h, albedo, normal, response, emission, diagnostics };
}
function bakeMasterWorldSurface(world, painting) {
  const revision = world.algorithmRevision;
  if (revision !== void 0 && revision !== 5 && revision !== 6 && revision !== 7 && revision !== 8 && revision !== 9) throw new Error("Unknown native surface algorithm revision");
  if (revision !== void 0 && !world.appearance) throw new Error("Explicit native surface revision requires frozen appearance");
  if (world.algorithmRevision !== 9 || !world.appearance) throw new Error("Revision 7 surface requires an explicit revision 9 world with appearance");
  return bakeMasterSurface(world, paintMasterGround(world), new NativeVolumeLighting(world.raster, masterVolumePalette(world), { seed: world.sample.seed, axis: world.definition.axis }), painting);
}
var clamp5 = (n, low, high2) => Math.max(low, Math.min(high2, n));
function randomSequence(seed2) {
  let state = seed2 >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = Math.imul(state ^ state >>> 15, state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function inside(points, x, y) {
  let hit = false;
  for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
    const p = points[a], q = points[b];
    if (p[1] > y !== q[1] > y && x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]) + p[0]) hit = !hit;
  }
  return hit;
}
function piecesFor(site, searched) {
  const random2 = randomSequence(site.visualSeed), pieces = [];
  const signed = (amount) => (random2() * 2 - 1) * amount;
  const add2 = (points, elevation, roughness, face = "skin", coverage = 1, family = site.family) => {
    pieces.push({ points, elevation, roughness, face, coverage, family });
  };
  const shard = (x, y, length2, breadth, z, slope, roughness, face = "skin", coverage = 1) => {
    const left = x - length2 / 2, right = x + length2 / 2, top = y - breadth / 2, bottom = y + breadth / 2;
    const points = [
      [left, top + breadth * 0.25],
      [left + length2 * (0.12 + random2() * 0.17), top],
      [right - length2 * (0.08 + random2() * 0.16), top + breadth * 0.1],
      [right, top + breadth * 0.56],
      [right - length2 * (0.13 + random2() * 0.2), bottom],
      [left + length2 * 0.09, bottom - breadth * 0.12]
    ];
    add2(points, (u, v) => Math.max(0.08, z + (u - x) * slope + (v - y) * slope * 0.24), roughness, face, coverage);
  };
  const ribbon2 = (x, y, length2, width, bend, z, roughness, coverage = 1, family = site.family, angle = 0) => {
    const upper = [], lower = [];
    for (let segment = 0; segment <= 6; segment++) {
      const t = segment / 6, u = x + (t - 0.5) * length2;
      const v = y + Math.sin(t * Math.PI) * bend + (t - 0.5) * bend * 0.18;
      const half = width * (0.3 + 0.2 * Math.sin(t * Math.PI)) * (segment === 0 || segment === 6 ? 0.58 : 1);
      upper.push([u, v - half]);
      lower.unshift([u, v + half]);
    }
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const points = [...upper, ...lower].map(([u, v]) => [x + (u - x) * ca - (v - y) * sa, y + (u - x) * sa + (v - y) * ca]);
    add2(points, (u, v) => {
      const localU = (u - x) * ca + (v - y) * sa + x;
      const localV = -(u - x) * sa + (v - y) * ca + y;
      const t = clamp5((localU - x) / length2 + 0.5, 0, 1);
      const middle = y + Math.sin(t * Math.PI) * bend + (t - 0.5) * bend * 0.18;
      return Math.max(0.08, z * Math.sqrt(Math.max(0, 1 - ((localV - middle) / Math.max(1, width * 0.6)) ** 2)));
    }, roughness, "skin", coverage, family);
  };
  const sourceDx = site.sourceAnchor ? site.sourceAnchor.x - site.position.x : 0;
  const sourceDy = site.sourceAnchor ? site.sourceAnchor.y - site.position.y : 0;
  const sourceU = sourceDx * Math.cos(site.axis) + sourceDy * Math.sin(site.axis);
  const sourceV = -sourceDx * Math.sin(site.axis) + sourceDy * Math.cos(site.axis);
  const sourceLength = Math.max(1, Math.hypot(sourceU, sourceV));
  const peripheralBias = site.sourceKind === "detached" ? sourceU / sourceLength : site.sourceKind === "surface-peel" ? -0.4 : 0.5;
  const scatterX = (i) => (i % 2 === 0 ? -1 : 1) * (15 + random2() * 10) + peripheralBias * 5;
  if (site.sourceKind === "surface-peel") switch (site.family) {
    case "fibre-knot":
      ribbon2(-16, -2, searched ? 14 : 28, 0.9, 1.2, 0.16, 0.9, 0.48, site.family, -0.18);
      if (!searched) ribbon2(-12, -3, 17, 0.7, -0.7, 0.14, 0.92, 0.48, site.family, 0.18);
      break;
    case "membrane-rim":
      add2([[-27, -2], [-20, -6], [-10, -4], [-4, -1], [-7, 4], [-15, 3], [-19, 5], [-24, 2]], () => 0.12, 0.77, "skin", 0.37);
      break;
    case "folded-slab":
      shard(-12, -4, 28, 4.5, 0.2, 8e-3, 0.92, "skin", 0.61);
      shard(-7, 4, 25, 2.4, 0.14, 3e-3, 0.94, "loose", 0.5);
      break;
    case "gel-flow":
      add2([[-29, -1], [-21, -5], [-15, -3], [-7, -4], [-2, 0], [-12, 3], [-22, 2]], () => 0.13, 0.53, "skin", 0.27);
      break;
    case "broken-shell":
      ribbon2(-11, 2, 27, 2.8, 2.4, 0.22, 0.72, 0.55);
      break;
    case "granular-ridge":
      for (let i = 0; i < 6; i++) shard(-16 + i * 3, signed(2), 2.8, 2.1, 0.15, 0, 0.98, "loose", 0.65);
      break;
  }
  switch (site.family) {
    case "folded-slab": {
      for (let i = 0; i < 4; i++) shard(scatterX(i), signed(12), 5 + random2() * 11, 1.5 + random2() * 2, 0.22 + random2() * 0.35, 0.018, 0.91, "loose", 0.72);
      shard(-2, 2, 30 + signed(2), 12, 0.35, 0.018, 0.88, "skin", 0.88);
      for (let i = 0; i < 3; i++) {
        const x = signed(5), y = -4 + i * 4 + signed(1), length2 = 19 + signed(5), width = 4 + random2() * 3;
        shard(
          x + (searched ? i % 2 ? 9 : -8 : 0),
          y + (searched ? i * 2 - 3 : 0),
          length2,
          width,
          searched ? 0.28 : 1 + i * 0.65,
          searched ? 4e-3 : 0.06,
          searched ? 0.93 : 0.81,
          i === 1 ? "cleaved" : "skin"
        );
      }
      break;
    }
    case "fibre-knot": {
      const tipBend = signed(1.5);
      ribbon2(-19, -4, 18, 0.9, tipBend, 0.23, 0.86, 0.83, site.family, -0.28);
      ribbon2(18, 7, 14, 0.8, -tipBend, 0.2, 0.88, 0.83, site.family, 0.31);
      if (searched) {
        ribbon2(-11, 5, 7 + random2() * 2, 1.1, 0.5, 0.31, 0.88, 1, site.family, -0.36);
        ribbon2(7, -7, 5 + random2() * 3, 0.95, -0.4, 0.24, 0.88, 1, site.family, 0.51);
        ribbon2(13, 1, 6, 0.8, 0.4, 0.22, 0.9, 1, site.family, -0.52);
      } else {
        const turn = signed(0.08);
        for (let bundle = 0; bundle < 3; bundle++) {
          const angle = [-0.2, 0.49, -0.58][bundle] + turn;
          const x = [-2, 1, -1][bundle] + signed(0.8), y = [0, 0, -2][bundle];
          const length2 = [30, 26, 22][bundle] + signed(2), breadth = [3.8, 3.4, 2.9][bundle];
          ribbon2(x, y, length2, breadth, signed(1.2), 1.55 + bundle * 0.55, 0.8, 1, site.family, angle);
          ribbon2(x - length2 * 0.22, y - 1.5, length2 * 0.56, 0.75, 0.8, 0.55, 0.84, 0.94, site.family, angle - 0.12);
        }
      }
      break;
    }
    case "membrane-rim": {
      for (let i = 0; i < 3; i++) shard(scatterX(i) * 0.86, (i - 1) * 10, 11 + random2() * 9, 2 + random2() * 3, 0.19, 5e-3, 0.73, "loose", 0.46);
      const tear = signed(2);
      if (searched) {
        add2([[-16, -5], [-10, -7], [-6, -3], [-8, 0], [-14, 2], [-17, -1]], () => 0.22, 0.69, "skin", 0.68);
        add2([[9, -1], [14, -2], [16, 3], [12, 7], [7, 5]], () => 0.24, 0.69, "skin", 0.68);
        add2([[0, -8 + tear], [6, -7], [4, -4], [-1, -5]], () => 0.17, 0.71, "skin", 0.68);
      } else {
        add2(
          [[-16, -5], [-8, -9], [3, -8 + tear], [14, -3], [10, 2], [15, 7], [4, 9], [-1, 5], [-11, 7], [-15, 1]],
          () => 0.28,
          0.69,
          "skin",
          0.68
        );
        shard(1, -1, 19 + signed(2), 5.5, 2.15, 0.095, 0.67, "skin", 0.94);
      }
      break;
    }
    case "gel-flow": {
      for (let i = 0; i < 4; i++) shard(scatterX(i), signed(10), 6 + random2() * 9, 2 + random2() * 3, 0.15, 0, 0.56, "loose", 0.3);
      add2(
        [[-29, -2], [-19, -4], [-12, -3], [-6, -8], [1, -7], [0, -3], [4, -2], [8, -5], [15, -1], [11, 3], [13, 6], [2, 8], [-7, 4], [-17, 3], [-21, 0]],
        (u) => 0.15 + 0.35 * clamp5((u + 25) / 38, 0, 1),
        0.41,
        "skin",
        0.54
      );
      if (site.groundFamily === "fibre-knot") for (let i = 0; i < 2; i++) ribbon2(-6 + i * 9, -2 + i * 5, 15 + random2() * 5, 1, signed(2), 0.42, 0.84, 0.85, "fibre-knot");
      if (searched) {
        shard(-9, 4, 10, 4, 0.4, 6e-3, 0.67, "loose", 0.65);
        shard(10, -6, 12, 5, 0.48, 6e-3, 0.63, "loose", 0.66);
      } else {
        add2(
          [[-9, -3], [-4, -7], [1, -6], [0, -3], [4, -2], [8, -5], [14, 0], [9, 2], [11, 4], [6, 6], [-3, 5]],
          (u, v) => 0.6 + 2.1 * Math.max(0, 1 - ((u - 2) / 15) ** 2 - (v / 9) ** 2),
          0.39,
          "skin",
          0.95
        );
      }
      break;
    }
    case "granular-ridge": {
      for (let i = 0; i < 9; i++) shard(scatterX(i) * 0.72, signed(12), 1.7 + random2() * 3.1, 1.4 + random2() * 2, 0.22 + random2() * 0.34, 0.01, 0.97, "loose", 0.81);
      for (let i = 0; i < 6; i++) {
        const x = (i % 3 - 1) * 8 + signed(1.8), y = (i < 3 ? -4 : 4) + signed(2), length2 = 6 + random2() * 5;
        shard(
          x + (searched ? i % 2 ? 5 : -5 : 0),
          y + (searched ? i < 3 ? -3 : 3 : 0),
          length2,
          4 + random2() * 4,
          searched ? 0.38 : 1.1 + random2() * 1.4,
          searched ? 0.01 : signed(0.08),
          0.94,
          i === 2 ? "cleaved" : "skin"
        );
      }
      break;
    }
    case "broken-shell": {
      for (let i = 0; i < 4; i++) shard(scatterX(i) * 0.8, signed(14), 6 + random2() * 5, 2 + random2() * 2, 0.35, 0.02, 0.79, "loose", 0.86);
      shard(-3, 3, 29, 12, 0.43, 0.016, 0.58, "skin", 0.91);
      for (let i = 0; i < 3; i++) {
        const length2 = 14 + random2() * 10, y = -4 + i * 4, x = signed(3), bend = 2 + random2() * 2;
        ribbon2(
          x + (searched ? (i - 1) * 7 : 0),
          y + (searched ? (i - 1) * 3 : 0),
          length2,
          4 + random2() * 2,
          searched ? bend * 0.5 : bend,
          searched ? 0.4 : 1.5 + random2() * 1.1,
          i === 1 ? 0.82 : 0.48
        );
      }
      break;
    }
  }
  if (site.sourceKind === "detached" && site.sourceAnchor) {
    const u = sourceU / sourceLength, v = sourceV / sourceLength;
    for (let i = 0; i < 3; i++) shard(
      u * (19 + i * 4),
      v * (19 + i * 4),
      5 - i,
      1.5 + random2(),
      0.2,
      8e-3,
      0.9,
      "loose",
      0.68 - i * 0.1
    );
  }
  return pieces;
}
function bakeSearchSiteGeometry(site, x, y, width, height, searched) {
  const size = width * height, elevation = new Float32Array(size), coverage = new Float32Array(size);
  const roughness = new Float32Array(size), face = Array(size).fill("skin");
  const family = Array(size).fill(site.family), overlap = new Uint8Array(size);
  const pieces = piecesFor(site, searched), ca = Math.cos(site.axis), sa = Math.sin(site.axis);
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const dx = x + px + 0.5 - site.position.x, dy = y + py + 0.5 - site.position.y;
    if (Math.abs(dx) > 38 || Math.abs(dy) > 30) continue;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca, index = py * width + px;
    for (const piece of pieces) {
      if (!inside(piece.points, u, v)) continue;
      const h = clamp5(piece.elevation(u, v), 0.05, searched ? 0.95 : 3.9);
      overlap[index] = Math.min(255, overlap[index] + 1);
      if (h < elevation[index]) continue;
      elevation[index] = h;
      coverage[index] = piece.coverage;
      roughness[index] = piece.roughness;
      face[index] = piece.face;
      family[index] = piece.family;
    }
  }
  return { height: elevation, coverage, roughness, face, family, overlap };
}
var CHANNELS = ["albedo", "normal", "response", "emission"];
var decodeHeight = (response, q) => (response[q + 1] * 256 + response[q + 2]) / 128;
var mirror = (value, extent) => {
  const n = (Math.floor(value) % (extent * 2) + extent * 2) % (extent * 2);
  return n < extent ? n : extent * 2 - n - 1;
};
function siteBounds(sites, width, height) {
  const boxes = sites.map((site) => ({
    x: Math.max(0, Math.floor(site.position.x) - 40),
    y: Math.max(0, Math.floor(site.position.y) - 32),
    right: Math.min(width, Math.floor(site.position.x) + 40),
    bottom: Math.min(height, Math.floor(site.position.y) + 32)
  }));
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    const p = boxes[a], q = boxes[b];
    if (p.right <= q.x || q.right <= p.x || p.bottom <= q.y || q.bottom <= p.y) continue;
    const u = sites[a].position, v = sites[b].position;
    const dx = Math.abs(u.x - v.x), dy = Math.abs(u.y - v.y);
    if (dx >= dy && dx >= 42) {
      const cut = Math.floor((u.x + v.x) / 2);
      if (u.x < v.x) {
        p.right = Math.min(p.right, cut);
        q.x = Math.max(q.x, cut);
      } else {
        q.right = Math.min(q.right, cut);
        p.x = Math.max(p.x, cut);
      }
    } else if (dy >= 42) {
      const cut = Math.floor((u.y + v.y) / 2);
      if (u.y < v.y) {
        p.bottom = Math.min(p.bottom, cut);
        q.y = Math.max(q.y, cut);
      } else {
        q.bottom = Math.min(q.bottom, cut);
        p.y = Math.max(p.y, cut);
      }
    } else throw new Error("Grounded search site cores overlap");
  }
  return boxes;
}
function copyReceiver(base, bounds) {
  const width = bounds.right - bounds.x, height = bounds.bottom - bounds.y;
  const target = {
    albedo: new Uint8Array(width * height * 4),
    normal: new Uint8Array(width * height * 4),
    response: new Uint8Array(width * height * 4),
    emission: new Uint8Array(width * height * 4)
  };
  for (const channel2 of CHANNELS) for (let y = 0; y < height; y++) {
    const start = ((bounds.y + y) * base.width + bounds.x) * 4;
    target[channel2].set(base[channel2].subarray(start, start + width * 4), y * width * 4);
  }
  return target;
}
function materialPixel(paint, region, u, v, seed2) {
  const patch = paint.regions?.[region];
  const left = patch ? Math.round(patch.x * paint.width) : 0, top = patch ? Math.round(patch.y * paint.height) : 0;
  const width = patch ? Math.min(paint.width - left, Math.max(1, Math.round(patch.width * paint.width))) : paint.width;
  const height = patch ? Math.min(paint.height - top, Math.max(1, Math.round(patch.height * paint.height))) : paint.height;
  const scale = paint.width / paint.worldSize;
  const x = left + mirror(u * scale + seed2 % 83, width), y = top + mirror(v * scale + (seed2 >>> 8) % 97, height);
  return (y * paint.width + x) * 4;
}
function bakeState(world, base, painting, site, bounds, searched, ranges) {
  const width = bounds.right - bounds.x, height = bounds.bottom - bounds.y, size = width * height;
  const channels = copyReceiver(base, bounds), geometry = bakeSearchSiteGeometry(site, bounds.x, bounds.y, width, height, searched);
  const anchorX = Math.max(0, Math.min(base.width - 1, Math.floor(site.position.x)));
  const anchorY = Math.max(0, Math.min(base.height - 1, Math.floor(site.position.y)));
  const anchorHeight = decodeHeight(base.response, (anchorY * base.width + anchorX) * 4);
  const allowed = new Uint8Array(size), pigment = new Float32Array(3);
  const identity = { secondary: 0, tone: 0, detail: 1 }, ca = Math.cos(site.axis), sa = Math.sin(site.axis);
  const worldCa = Math.cos(world.definition.axis), worldSa = Math.sin(world.definition.axis);
  for (let i = 0; i < size; i++) {
    const x = bounds.x + i % width, y = bounds.y + Math.floor(i / width), q = i * 4;
    if (geometry.coverage[i] <= 0 || !world.matterAt(x + 0.5, y + 0.5) || world.roleAt(x + 0.5, y + 0.5) === "solid" || channels.albedo[q + 3] !== 255 || decodeHeight(channels.response, q) > anchorHeight + 2) {
      geometry.height[i] = 0;
      continue;
    }
    allowed[i] = 1;
  }
  const relief = (x, y) => x < 0 || y < 0 || x >= width || y >= height ? 0 : geometry.height[y * width + x];
  for (let i = 0; i < size; i++) {
    if (!allowed[i]) continue;
    const px = i % width, py = Math.floor(i / width), x = bounds.x + px, y = bounds.y + py, q = i * 4;
    const family = geometry.family[i], face = geometry.face[i], paint = painting?.families?.[family] ?? painting;
    const dx = x - site.position.x, dy = y - site.position.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const appearance = world.appearance;
    if (paint) {
      const source = materialPixel(paint, face, u, v, site.visualSeed);
      if (appearance) {
        let range2 = ranges.get(paint);
        if (!range2) {
          range2 = paintedToneRange(paint);
          ranges.set(paint, range2);
        }
        sampleWorldAppearance(appearance, x * worldCa + y * worldSa, -x * worldSa + y * worldCa, world.sample.seed, identity);
        const secondary = family === world.definition.family ? 0 : 1;
        mapWorldPigment(
          appearance,
          face === "cleaved" ? "cleaved" : "solid",
          paint.pixels[source],
          paint.pixels[source + 1],
          paint.pixels[source + 2],
          range2,
          identity,
          secondary,
          pigment
        );
      } else for (let c = 0; c < 3; c++) pigment[c] = paint.pixels[source + c];
    } else {
      const color = face === "cleaved" ? world.sample.profile.palette.faceLight : world.sample.profile.palette.materialMid;
      pigment[0] = color >>> 16 & 255;
      pigment[1] = color >>> 8 & 255;
      pigment[2] = color & 255;
    }
    const coverage = geometry.coverage[i];
    for (let c = 0; c < 3; c++) channels.albedo[q + c] = Math.round(channels.albedo[q + c] * (1 - coverage) + pigment[c] * coverage);
    const nz = Math.max(0.18, channels.normal[q + 2] / 255 * 2 - 1);
    const sx = (channels.normal[q] / 255 * 2 - 1) / nz - (relief(px + 1, py) - relief(px - 1, py)) * 0.5;
    const sy = (channels.normal[q + 1] / 255 * 2 - 1) / nz - (relief(px, py + 1) - relief(px, py - 1)) * 0.5;
    const length2 = Math.hypot(sx, sy, 1);
    channels.normal[q] = Math.round((sx / length2 * 0.5 + 0.5) * 255);
    channels.normal[q + 1] = Math.round((sy / length2 * 0.5 + 0.5) * 255);
    channels.normal[q + 2] = Math.round((1 / length2 * 0.5 + 0.5) * 255);
    channels.normal[q + 3] = Math.round(channels.normal[q + 3] * (geometry.overlap[i] > 1 && !searched ? 0.92 : 0.99));
    const encoded = Math.max(0, Math.min(65535, Math.round((decodeHeight(channels.response, q) + geometry.height[i]) * 128)));
    channels.response[q] = Math.round(channels.response[q] * (1 - coverage) + geometry.roughness[i] * 255 * coverage);
    channels.response[q + 1] = encoded >>> 8;
    channels.response[q + 2] = encoded & 255;
    for (let c = 0; c < 4; c++) channels.emission[q + c] = 0;
  }
  return channels;
}
function bakeSearchSitePatches(world, baseSurface, painting) {
  if (world.algorithmRevision !== 9) return [];
  const sites = world.searchSites;
  if (!sites) throw new Error("Revision 9 native world has no frozen search sites");
  if (baseSurface.width !== world.raster.width || baseSurface.height !== world.raster.height) throw new Error("Search-site receiver dimensions differ from native world");
  if (new Set(sites.map((site) => site.nodeId)).size !== sites.length) throw new Error("Duplicate grounded search-site node");
  const boxes = siteBounds(sites, baseSurface.width, baseSurface.height), ranges = /* @__PURE__ */ new Map();
  return sites.map((site, index) => {
    const bounds = boxes[index];
    return {
      nodeId: site.nodeId,
      x: bounds.x,
      y: bounds.y,
      width: bounds.right - bounds.x,
      height: bounds.bottom - bounds.y,
      intact: bakeState(world, baseSurface, painting, site, bounds, false, ranges),
      searched: bakeState(world, baseSurface, painting, site, bounds, true, ranges)
    };
  });
}
export {
  bakeMasterWorldSurface,
  bakeSearchSitePatches,
  createR100ProductionMap,
  hydrateR100MasterWorld,
  validR100ProductionRecipe,
  validateSearchSites
};
