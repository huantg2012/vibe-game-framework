// src/generation/world-study/native-volume-organization.ts
var uv = (p) => [p[0], p[1]];
var mix = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
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
      b.quad(p, q, r, t, 0, [uv(p), uv(q), uv(r), uv(t)], [0, 0, 1], 0);
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
      b.quad(ring[j], ring[k], q, p, 1, [uv(ring[j]), uv(ring[k]), uv(q), uv(p)], [0, 0, 1], 3);
      b.quad(p, q, cf, af, 2, [uv(p), uv(q), uv(cf), uv(af)], [0, 0, 1], 2);
      b.quad(
        af,
        cf,
        centreBottom,
        centreBottom,
        2,
        [uv(af), uv(cf), uv(centreBottom), uv(centreBottom)],
        [0, 0, 1],
        0
      );
    }
  }
  for (const i of [0, rows.length - 1]) {
    const row = rowAt(i), face = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4].map((at) => curved(row, at));
    for (let j = 1; j < face.length - 1; j++) {
      const a = face[0], c = face[j], d = face[j + 1];
      b.quad(a, c, d, d, 0, [uv(a), uv(c), uv(d), uv(d)], [i ? 1 : -1, 0, 0], 0);
    }
  }
}
export {
  buildCompressedWedge,
  buildPorousBreak
};
