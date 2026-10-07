// src/generation/world-study/native-volume-organization.ts
var uv = (p) => [p[0], p[1]];
var mix = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
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
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < across.length - 1; j++) {
    const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
    const cut = i === rows.length - 2 && (j === 1 || j === 4);
    b.quad(a, c, d, e, cut ? 1 : 0, [uv(a), uv(c), uv(d), uv(e)], [0, 0, 1], cut ? 3 : 1);
    if (i === 1 && j === 2) pressureFracture(b, a, c, d);
  }
  for (const side of [0, across.length - 1]) for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i][side], c = rows[i + 1][side], af = feet[i][side], cf = feet[i + 1][side];
    b.quad(af, cf, c, a, 0, [uv(af), uv(cf), uv(c), uv(a)], [0, side ? 1 : -1, 0], 1);
  }
  for (const i of [0, rows.length - 1]) for (let j = 0; j < across.length - 1; j++) {
    const a = rows[i][j], c = rows[i][j + 1], af = feet[i][j], cf = feet[i][j + 1];
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
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], c = rows[i + 1];
    for (const [from, to] of [["foot", "shoulder"], ["shoulder", "crown"], ["crown", "lip"]]) {
      b.quad(
        a[from],
        c[from],
        c[to],
        a[to],
        0,
        [uv(a[from]), uv(c[from]), uv(c[to]), uv(a[to])],
        [0, 0, 1],
        0
      );
      if (i === 2 && from === "crown") pressureFracture(b, a[from], c[from], c[to]);
    }
    const sample = (u, v) => mix(mix(a.lip, c.lip, u), mix(a.toe, c.toe, u), v);
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
    const row = rows[i], face = [row.foot, row.shoulder, row.crown, row.lip, row.toe];
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
