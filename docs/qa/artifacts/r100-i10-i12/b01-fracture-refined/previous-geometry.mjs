// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-WVfiJO/src/generation/world-study/native-volume-cellular.ts
var TAU = Math.PI * 2;
var uv = (point) => [point[0], point[1]];
var lerp = (a, b, t) => a + (b - a) * t;
function variation(seed, salt) {
  let value = Math.imul(seed ^ salt, 73244475);
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
    for (const at of [0, steps]) {
      const row = rows[at], angle = at === 0 ? start : end, sign = at === 0 ? -1 : 1;
      for (let across = 0; across < row.length - 1; across++) {
        const a = row[across], b = row[across + 1];
        const run = Math.min(6, spec.thickness * 0.42) * (at === 0 ? 0.72 : 1.12);
        const dx = -Math.sin(angle) * run * sign, dy = Math.cos(angle) * run * sign;
        const c = [b[0] + dx, b[1] + dy, 0], d = [a[0] + dx, a[1] + dy, 0];
        builder.quad(a, b, c, d, 1, [uv(a), uv(b), uv(c), uv(d)], [0, 0, 1], 3);
      }
    }
  }
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-WVfiJO/src/generation/world-study/native-volume-expansion.ts
var NATIVE_VOLUME_SHAPE_PROFILES = ["rib-vault", "pleated-sheet", "cellular-shell", "lobed-cushion", "monolith-buttress", "terrace-shelf"];
var uv2 = (p) => [p[0], p[1]];
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function noise(seed, salt) {
  let value = Math.imul(seed ^ salt, 73244475);
  value = Math.imul(value ^ value >>> 16, 73244475);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}
function fracture(b, a, c, d, size) {
  const sample = (u, v) => [
    a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v,
    a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + 0.08
  ];
  const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const perpendicular = Math.abs((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0])) / Math.max(1e-3, length);
  const du = size ? Math.min(0.44, size[0] / Math.max(1e-3, length)) : 0.44;
  const dv = size ? Math.min(0.22, size[1] / Math.max(1e-3, perpendicular)) : 0.22;
  const p = sample(0.16, 0.12), q = sample(size ? 0.16 + du : 0.6, 0.12), r = sample(size ? 0.16 + du * 0.82 : 0.52, size ? 0.12 + dv : 0.34), s = sample(0.16, size ? 0.12 + dv : 0.34);
  b.quad(p, q, r, s, 3, [uv2(p), uv2(q), uv2(r), uv2(s)], [0, 0, 1], 3);
  b.joint(sample(size ? 0.16 + du * 0.43 : 0.35, size ? 0.12 + dv * 0.5 : 0.23));
}
function ribbon(b, centres, radii, form, marked = false, sideScales) {
  const rows = [];
  const section2 = form === "ridge" ? [[-1, 0], [-0.91, 0.14], [-0.63, 0.62], [-0.12, 1], [0.28, 0.9], [0.75, 0.41], [0.94, 0.14], [1, 0]] : [[-1, 0], [-0.95, 0.2], [-0.76, 0.77], [-0.37, 0.98], [0.29, 1], [0.74, 0.84], [0.94, 0.2], [1, 0]];
  for (let i = 0; i < centres.length; i++) {
    const p = centres[i], before = centres[Math.max(0, i - 1)], after = centres[Math.min(centres.length - 1, i + 1)];
    const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy) || 1;
    const radius = radii[i], foot = b.spec.blocking === 1 ? Math.min(8, p[2] * 0.32) : 0;
    rows.push(section2.map(([across, rise], at) => {
      const breadth = radius * across * (sideScales?.[i]?.[across < 0 ? 0 : 1] ?? 1);
      return [
        p[0] - dy / length * breadth,
        p[1] + dx / length * breadth,
        at === 0 || at === section2.length - 1 ? 0 : Math.max(foot, p[2] * rise)
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
    const dx = centre[0] - neighbour[0], dy = centre[1] - neighbour[1], length = Math.hypot(dx, dy) || 1;
    const run = Math.min(7, b.spec.thickness * 0.6);
    for (let j = 0; j < row.length - 1; j++) {
      const a = row[j], c = row[j + 1], af = [a[0] + dx / length * run, a[1] + dy / length * run, 0], cf = [c[0] + dx / length * run, c[1] + dy / length * run, 0];
      b.quad(a, af, cf, c, 1, [uv2(a), uv2(af), uv2(cf), uv2(c)], [0, 0, 1], 3);
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
    const at = (rib + 0.52) / count, length = s.width * (0.46 + noise(s.seed, 1900 + rib) * 0.28), centres = [], widths = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, bend = Math.sin(t * Math.PI * 0.86);
      centres.push([
        (at - 0.5) * s.length + bend * s.length * (0.036 + s.fold * 0.035),
        -s.width * 0.33 + t * length,
        s.height * (0.6 - t * 0.36 + bend * 0.12) * (1 - rib % 3 * 0.055)
      ]);
      widths.push(Math.min(s.length / count * 0.18, s.width * 0.057) * (1 - t * 0.38));
    }
    ribbon(b, centres, widths, "ridge");
  }
}
function pleatedSheet(b) {
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
  const creaseAt = (at) => {
    for (let i = 1; i < folds.length; i++) if (at <= folds[i][0]) {
      const a = folds[i - 1], c = folds[i], t = clamp((at - a[0]) / (c[0] - a[0]), 0, 1);
      return a[1] + (c[1] - a[1]) * t;
    }
    return folds[folds.length - 1][1];
  };
  const tear = (at, centre, radius) => Math.max(0, 1 - Math.abs(at - centre) / radius);
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
    for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
      const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
      b.quad(a, c, d, e, 0, [uv2(a), uv2(c), uv2(d), uv2(e)], [0, 0, 1], 4);
      if (start < 0 && i === 15 && j === 7) fracture(b, a, c, d);
    }
    const outline = [
      ...rows.map((row) => row[0]),
      ...rows[along].slice(1),
      ...rows.slice(0, along).reverse().map((row) => row[across]),
      ...rows[0].slice(1, across).reverse()
    ];
    const feet = outline.map((p, i) => {
      const prev = outline[(i + outline.length - 1) % outline.length], next = outline[(i + 1) % outline.length];
      const dx = next[0] - prev[0], dy = next[1] - prev[1], length = Math.hypot(dx, dy) || 1, width = s.blocking === 1 ? Math.min(6, s.thickness * 0.55) : 1.5;
      return [p[0] + dy / length * width, p[1] - dx / length * width, 0];
    });
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length, a = outline[i], c = outline[next];
      const exposedInnerTear = piece === 0 && i > along + 3 && i < along + across - 3;
      b.quad(a, feet[i], feet[next], c, exposedInnerTear ? 2 : 1, [uv2(a), uv2(feet[i]), uv2(feet[next]), uv2(c)], [0, 0, 1], 3);
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
    b.quad(centre, crown[i], crown[next], centre, 0, [uv2(centre), uv2(crown[i]), uv2(crown[next]), uv2(centre)], [0, 0, 1], 0);
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

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-WVfiJO/src/generation/world-study/native-volume-ground.ts
var NATIVE_VOLUME_V4_PROFILES = ["fracture-fan", "fallen-bundle", "clamp-bank", "torn-sheet"];
var uv3 = (p) => [p[0], p[1]];
function fracturedFace(b, a, c, d) {
  if (b.spec.blocking !== 1) return;
  const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const perpendicular = Math.abs((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0])) / Math.max(1e-3, length);
  const du = Math.min(0.34, 24 / Math.max(1, length)), dv = Math.min(0.23, 6 / Math.max(1, perpendicular));
  const sample = (u, v) => [
    a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v,
    a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + 0.06
  ];
  const p = sample(0.17, 0.14), q = sample(0.17 + du, 0.14), r = sample(0.17 + du * 0.78, 0.14 + dv), t = sample(0.17, 0.14 + dv);
  b.quad(p, q, r, t, 3, [uv3(p), uv3(q), uv3(r), uv3(t)], [0, 0, 1], 3);
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
    b.quad(a, c, centre, centre, 0, [uv3(a), uv3(c), uv3(centre), uv3(centre)], [0, 0, 1]);
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
        [uv3(a[j]), uv3(c[j]), uv3(c[j + 1]), uv3(a[j + 1])],
        [0, 0, 1],
        edge ? 3 : 0
      );
      if (i === 1 && j === 3) fracturedFace(b, a[j], c[j], c[j + 1]);
    }
  }
  for (const index of [0, rows.length - 1]) {
    const row = rows[index], direction = index === 0 ? -1 : 1;
    for (let j = 0; j < row.length - 1; j++) {
      const a = row[j], c = row[j + 1], af = [a[0], a[1], 0], cf = [c[0], c[1], 0];
      b.quad(af, a, c, cf, 1, [uv3(af), uv3(a), uv3(c), uv3(cf)], [direction, 0, 0], 3);
    }
  }
}
function fractureFan(b) {
  const s = b.spec, l = s.length, w = s.width;
  const parts = [
    [[-0.5, -0.3], [-0.32, -0.49], [0.24, -0.4], [0.43, -0.18], [0.09, -0.04], [-0.3, -0.1]],
    [[-0.3, -0.1], [0.09, -0.04], [-0.02, 0.36], [-0.3, 0.5], [-0.46, 0.17]],
    [[0.09, -0.04], [0.43, -0.18], [0.51, 0.17], [0.29, 0.39], [0.16, 0.21]]
  ];
  for (let i = 0; i < parts.length; i++) {
    const points = parts[i].map(([x, y]) => [x * l, y * w]);
    const foot = s.blocking === 1 ? 0.38 : 0.08;
    section(b, points, (x, y) => s.height * (foot + 0.34 + x / l * (0.12 + s.fold * 0.18) - y / w * 0.17 + i * 0.045), i === 0);
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
    rows.push(profile.map(([across, rise], at) => [
      x + s.length * 0.022 * across * (i === 0 ? 1 : i === xs.length - 1 ? -1 : 0),
      centre + radius * across * (across > 0 ? 0.84 + 0.1 * t : 1),
      at === 0 || at === profile.length - 1 ? 0 : Math.max(foot, peak * rise)
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
  const s = b.spec, rows = [];
  const along = [-0.5, -0.36, -0.13, 0.12, 0.34, 0.49];
  const breadths = [0.62, 1, 1.14, 0.91, 0.72, 0.35];
  for (let i = 0; i < along.length; i++) {
    const x = along[i] * s.length, bend = s.width * (0.1 * Math.sin(i * 0.65) - 0.03);
    const width = s.width * breadths[i], peak = s.height * (0.7 + 0.3 * Math.sin((i + 0.6) / (along.length + 0.2) * Math.PI));
    const foot = s.blocking === 1 ? Math.min(8, peak * 0.32) : 0;
    const profile = [[-0.5, 0], [-0.46, foot / peak], [-0.34, 0.58], [-0.13 - s.fold * 0.045, 1], [0.05, 0.91], [0.2 + s.opening * 0.035, 0.43], [0.4, 0.19], [0.47, foot / peak], [0.5, 0]];
    rows.push(profile.map(([across, rise], at) => [
      x + s.length * 0.028 * across,
      bend + width * across,
      at === 0 || at === profile.length - 1 ? 0 : Math.max(foot, peak * rise)
    ]));
  }
  strip(b, rows, 4);
}
function tornSheet(b) {
  const s = b.spec;
  const parts = [
    [[-0.5, -0.23], [-0.29, -0.48], [0.13, -0.37], [0.04, -0.02], [-0.28, 0.13], [-0.46, 0.02]],
    [[-0.28, 0.13], [0.04, -0.02], [0.13, 0.23], [-0.1, 0.49], [-0.37, 0.34]],
    [[0.13, -0.37], [0.4, -0.26], [0.51, -0.03], [0.34, 0.29], [0.23, 0.13], [0.04, -0.02]]
  ];
  const tilt = 0.12 + s.fold * 0.18;
  const coordinate = ([x, y]) => y + tilt * x;
  const clip = (polygon, boundary, greater) => {
    const result = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j], c = polygon[(j + 1) % polygon.length], av = coordinate(a), cv = coordinate(c);
      const ai = greater ? av >= boundary : av <= boundary, ci = greater ? cv >= boundary : cv <= boundary;
      if (ai) result.push(a);
      if (ai !== ci) {
        const t = (boundary - av) / (cv - av);
        result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    return result;
  };
  const bands = [-0.7, -0.3, -0.12, 0.03 + s.opening * 0.04, 0.26, 0.7];
  const rise = [s.blocking === 1 ? 0.24 : 0.08, 0.73, 1, 0.43, 0.22, 0.16];
  for (let i = 0; i < parts.length; i++) {
    const foot = parts[i].map(([x, y]) => [x * s.length, y * s.width]), crown = insetOutline(b, foot);
    const normalized = crown.map(([x, y]) => [x / s.length, y / s.width]);
    const height = (x, y) => {
      const v = coordinate([x / s.length, y / s.width]);
      const band = Math.max(0, Math.min(bands.length - 2, bands.findIndex((boundary) => boundary > v) - 1));
      const t = (v - bands[band]) / (bands[band + 1] - bands[band]);
      return s.height * (rise[band] + (rise[band + 1] - rise[band]) * t) * (i === 0 ? 1 : i === 1 ? 0.62 : 0.83);
    };
    for (let band = 0; band < bands.length - 1; band++) {
      const polygon = clip(clip(normalized, bands[band], true), bands[band + 1], false);
      if (polygon.length < 3) continue;
      section(b, polygon.map(([x, y]) => [x * s.length, y * s.width]), height, i === 0 && band === 2, false);
    }
    for (let j = 0; j < foot.length; j++) {
      const af = foot[j], cf = foot[(j + 1) % foot.length], a = crown[j], c = crown[(j + 1) % crown.length];
      const av = coordinate([a[0] / s.length, a[1] / s.width]), cv = coordinate([c[0] / s.length, c[1] / s.width]);
      const cuts = [0, ...bands.map((boundary) => (boundary - av) / (cv - av)).filter((t) => t > 0 && t < 1), 1].sort((x, y) => x - y);
      const at = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
      for (let k = 0; k < cuts.length - 1; k++) {
        const p = at(a, c, cuts[k]), q = at(a, c, cuts[k + 1]);
        const pFoot = [...at(af, cf, cuts[k]), 0], qFoot = [...at(af, cf, cuts[k + 1]), 0];
        const pTop = [...p, surfaceHeight(b, height(...p))], qTop = [...q, surfaceHeight(b, height(...q))];
        b.quad(pFoot, qFoot, qTop, pTop, 1, [uv3(pFoot), uv3(qFoot), uv3(qTop), uv3(pTop)], [0, 0, 1], 2);
      }
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
    default:
      throw new Error("Unknown construction 4 native shape profile");
  }
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-WVfiJO/src/generation/world-study/native-volume-ground-edge.ts
function distance(p, a, b) {
  const x = b.x - a.x, y = b.y - a.y, length = x * x + y * y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / length));
  return Math.hypot(p.x - a.x - x * t, p.y - a.y - y * t);
}
function appendNativeGroundEdges(b, context) {
  const width = b.spec.groundEdgeWidth;
  if (width === void 0) return;
  if (!context || !context.polygons.length || typeof context.matterAt !== "function" || !Number.isInteger(context.width / 8) || !Number.isInteger(context.height / 8)) throw new Error("Ground edge requires the complete authoritative terrain context");
  const cosine = Math.cos(b.spec.rotation), sine = Math.sin(b.spec.rotation), emitted = /* @__PURE__ */ new Set();
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
  for (const polygon of context.polygons) {
    const minX = Math.max(0, Math.floor((Math.min(...polygon.map((p) => p.x)) - width) / 8));
    const maxX = Math.min(context.width / 8 - 1, Math.floor((Math.max(...polygon.map((p) => p.x)) + width) / 8));
    const minY = Math.max(0, Math.floor((Math.min(...polygon.map((p) => p.y)) - width) / 8));
    const maxY = Math.min(context.height / 8 - 1, Math.floor((Math.max(...polygon.map((p) => p.y)) + width) / 8));
    for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
      const key = row * (context.width / 8) + col, x = col * 8, y = row * 8;
      if (emitted.has(key) || !context.matterAt(x + 4, y + 4) || nearest(x + 4, y + 4) > width + 6) continue;
      const points = [
        [x, y, heightAt(x, y)],
        [x + 8, y, heightAt(x + 8, y)],
        [x + 8, y + 8, heightAt(x + 8, y + 8)],
        [x, y + 8, heightAt(x, y + 8)]
      ];
      const centre = local(x + 4, y + 4, heightAt(x + 4, y + 4));
      if (points.every((p2) => p2[2] === 0) && centre[2] === 0) continue;
      emitted.add(key);
      if (emitted.size > 512) throw new Error("Authored ground cut exceeds the 2048-triangle edge budget");
      const p = points.map((v) => local(v[0], v[1], v[2]));
      const texels = [[x, y], [x + 8, y], [x + 8, y + 8], [x, y + 8]];
      for (let edge = 0; edge < 4; edge++) b.quad(
        p[edge],
        p[(edge + 1) % 4],
        centre,
        centre,
        1,
        [texels[edge], texels[(edge + 1) % 4], [x + 4, y + 4], [x + 4, y + 4]],
        [0, 0, 1],
        3
      );
    }
  }
  if (emitted.size === 0) throw new Error("Authored ground edge produced no present material");
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-WVfiJO/src/generation/world-study/native-volume-geometry.ts
var NATIVE_VOLUME_FAMILY_SEQUENCE = ["folded-slab", "fibre-knot", "broken-shell", "granular-ridge", "membrane-rim", "gel-flow"];
var NATIVE_VOLUME_MATERIALS = ["outer", "cut", "inner", "joint"];
var NATIVE_VOLUME_REGIONS = { intact: 0, compressed: 1, peeled: 2, fractured: 3, tension: 4, glazed: 5 };
var TAU2 = Math.PI * 2;
var clamp2 = (v, low, high) => Math.max(low, Math.min(high, v));
function phase(seed, salt) {
  let a = Math.imul((seed | 0) ^ salt, 73244475);
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
    this.cosine = Math.cos(spec.rotation);
    this.sine = Math.sin(spec.rotation);
  }
  points = [];
  normalData = [];
  texels = [];
  triangles = [];
  slots = [];
  regions = [];
  joints = [];
  bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: 0 };
  cosine;
  sine;
  vertex(p, uv4, n) {
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
    this.texels.push(uv4[0], uv4[1]);
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
  finish() {
    const heightScale = this.spec.height / Math.max(1, this.bounds.maxZ);
    for (let i = 0; i < this.points.length; i += 3) {
      this.points[i + 2] = this.points[i + 2] * heightScale;
      const nx = this.normalData[i], ny = this.normalData[i + 1], nz = this.normalData[i + 2] / heightScale;
      const length = Math.hypot(nx, ny, nz) || 1;
      this.normalData[i] = nx / length;
      this.normalData[i + 1] = ny / length;
      this.normalData[i + 2] = nz / length;
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
      const t = j / subdivisions, at = lerp2(p, q, t), along = (rank + t) / faultEdges.length;
      const lobe = fault ? clamp2(along < mouthPeak ? along / mouthPeak : (1 - along) / (1 - mouthPeak), 0, 1) : 0;
      const mouth = lobe * lobe * (3 - 2 * lobe);
      const radius = Math.hypot(at[0] - centre[0], at[1] - centre[1]) || 1;
      const nx = (at[0] - centre[0]) / radius, ny = (at[1] - centre[1]) / radius;
      const inset = cutWidth * mouth * (salt === 2 ? 0.52 : 0.78);
      let lip = lerp2(at, centre, Math.min(0.26, inset / radius));
      const burial = clamp2(at[2] / Math.max(3, s.height * 0.16), 0, 1);
      const spread = cutWidth * burial * (fault ? 0.13 + mouth * 1.8 : 0.26);
      const foot = [at[0] + nx * spread, at[1] + ny * spread, 0];
      if (footHeight > 0) {
        const sectionWidth = 6.5 + phase(s.seed, 830 + salt) * 1.5 + (at[0] / s.length + 0.5) * 1.1 + mouth * 0.8;
        const run = Math.hypot(lip[0] - foot[0], lip[1] - foot[1]);
        const lowEnd = 1 - clamp2(at[2] / (footHeight * 2), 0, 1);
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
  const cross = [
    [-l * 0.24, w * 0.48, s.thickness * 0.44],
    [-l * 0.18, w * 0.28, h * 0.29],
    [knotX + w * 0.07, knotY, h * 0.82],
    [l * 0.04, -w * 0.15, h * 0.45],
    [l * 0.15, -w * 0.46, s.thickness * 0.51]
  ];
  sweptBundle(b, cross, w * 0.08, 1);
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
  const s = b.spec, cross = 18, steps = (spine.length - 1) * 8;
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const whole = i / steps * (spine.length - 1), segment = Math.min(spine.length - 2, Math.floor(whole));
    const t = i === steps ? 1 : whole - segment;
    const a = spine[segment], c = spine[segment + 1];
    const before = spine[Math.max(0, segment - 1)], after = spine[Math.min(spine.length - 1, segment + 2)];
    const curve = (channel, q) => 0.5 * (2 * a[channel] + (-before[channel] + c[channel]) * q + (2 * before[channel] - 5 * a[channel] + 4 * c[channel] - after[channel]) * q * q + (-before[channel] + 3 * a[channel] - 3 * c[channel] + after[channel]) * q * q * q);
    const tangent = (channel) => 0.5 * (-before[channel] + c[channel] + 2 * (2 * before[channel] - 5 * a[channel] + 4 * c[channel] - after[channel]) * t + 3 * (-before[channel] + 3 * a[channel] - 3 * c[channel] + after[channel]) * t * t);
    const dx = tangent(0), dy = tangent(1), len = Math.hypot(dx, dy) || 1;
    const vx = -dy / len, vy = dx / len, along = i / steps;
    const clampWidth = 1 - Math.exp(-Math.pow((along - 0.5) / 0.16, 2)) * (salt === 0 ? 0.3 : 0.12);
    const rootTaper = 0.28 + Math.pow(Math.sin(along * Math.PI), 0.7) * 0.75;
    const r = radius * rootTaper * clampWidth;
    const cx = curve(0, t), cy = curve(1, t), cz = Math.max(r * (s.constructionVersion === 2 ? 0.78 : 0.62), curve(2, t));
    const ring = [];
    for (let j = 0; j < cross; j++) {
      const angle = j / cross * TAU2;
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
  for (let i = 0; i < steps; i++) for (let j = 0; j < cross; j++) {
    const a = rings[i], c = rings[i + 1], k = (j + 1) % cross;
    const slot = salt > 0 && i > steps * 0.45 && i < steps * 0.54 && j > 2 && j < 5 ? 3 : 0;
    b.quad(
      a[j],
      c[j],
      c[k],
      a[k],
      slot,
      [
        [i * s.length / steps, j * radius * TAU2 / cross],
        [(i + 1) * s.length / steps, j * radius * TAU2 / cross],
        [(i + 1) * s.length / steps, (j + 1) * radius * TAU2 / cross],
        [i * s.length / steps, (j + 1) * radius * TAU2 / cross]
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
      r.reduce((sum, p) => sum + p[0], 0) / cross,
      r.reduce((sum, p) => sum + p[1], 0) / cross,
      r.reduce((sum, p) => sum + p[2], 0) / cross
    ];
    for (let j = 0; j < cross; j++) {
      const k = (j + 1) % cross;
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
    const a = outline[i], c = outline[(i + 1) % outline.length], dx = c[0] - a[0], dy = c[1] - a[1], length = Math.hypot(dx, dy) || 1;
    const width = s.blocking === 1 ? Math.min(6, s.thickness * 0.55) : 1.5, ox = dy / length * width, oy = -dx / length * width;
    b.quad(a, [a[0] + ox, a[1] + oy, 0], [c[0] + ox, c[1] + oy, 0], c, 1, [[0, a[2]], [0, 0], [length, 0], [length, c[2]]], [0, 0, 1], NATIVE_VOLUME_REGIONS.fractured);
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
    const a = path[i - 1], c = path[i], dx = c[0] - a[0], dy = c[1] - a[1], length = Math.hypot(dx, dy), px = -dy / length * halfWidth, py = dx / length * halfWidth;
    const uv4 = [[a[0] + px, a[1] + py], [c[0] + px, c[1] + py], [c[0] - px, c[1] - py], [a[0] - px, a[1] - py]];
    b.quad(sample(...uv4[0]), sample(...uv4[1]), sample(...uv4[2]), sample(...uv4[3]), 3, uv4, [0, 0, 1], NATIVE_VOLUME_REGIONS.fractured);
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
  if (spec.groundEdgeWidth !== void 0) appendNativeGroundEdges(builder, ground);
  return builder.finish();
}
export {
  NATIVE_VOLUME_FAMILY_SEQUENCE,
  NATIVE_VOLUME_MATERIALS,
  NATIVE_VOLUME_REGIONS,
  NATIVE_VOLUME_SHAPE_PROFILES,
  NATIVE_VOLUME_V4_PROFILES,
  buildNativeVolume,
  validateNativeVolumeSpec
};
