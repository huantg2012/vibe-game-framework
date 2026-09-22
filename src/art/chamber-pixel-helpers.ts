import type { ChamberPixels, ChamberPoint } from './purification-chamber-pixels';
import type { SurfacePlane } from './chamber-surface-map';

export const CHAMBER_PALETTE = {
  void: '#080a0c', black: '#0d1114', shadow: '#151a1e', recess: '#1e2228',
  concrete: '#2c2e33', plane: '#3a3d42', plaster: '#3a3838', ash: '#2e2d30',
  earth: '#50463c', oldPlaster: '#2a2420', steel: '#4a4e55', edge: '#5a5f66',
  glint: '#8a8f96', pale: '#c8cdd4', rust: '#5d483e', olive: '#4f4835',
  warm: '#8a5c2a', lamp: '#c4873a', deep: '#0e4a3f', teal: '#1a6b5c',
  live: '#1aad96', light: '#2ae6c8',
} as const;

/** Fixed authored faces, not geometry inferred from brightness or material patches. */
export function horizontal(p: ChamberPixels, elevation: number, occlusion = .96, roughness = .95): void {
  p.setPlane({ normal: [0, 0, 1], elevation, occlusion, roughness });
}

/** A vertical face descends one world-height unit for each screen row. The optional foot
 * slope follows a visible oblique base edge. Broad ruined wall bases remain art approximations. */
export function upright(p: ChamberPixels, footY: number, elevation = 0,
  normal: SurfacePlane['normal'] = [0, 1, 0], occlusion = .92,
  footSlope = 0, originX = 0): void {
  p.setPlane({ normal, elevation, originY: footY, originX,
    riseX: footSlope, riseY: -1, occlusion, roughness: .95 });
}

/** Cached, palette-only material fields. Large coverage, medium wear and fine aggregate
 * are separate scales; this never scatters unbounded noise over a silhouette. */
export function materialFace(p: ChamberPixels, points: readonly ChamberPoint[],
  colors: readonly [string, string, string], seed: number, scaleX = 24, scaleY = 13): void {
  const y0 = Math.ceil(Math.min(...points.map(v => v[1])));
  const y1 = Math.ceil(Math.max(...points.map(v => v[1])));
  for (let y = y0; y < y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!; const b = points[(i + 1) % points.length]!;
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const start = Math.ceil(xs[i]!); const end = Math.ceil(xs[i + 1]!);
      let runStart = start; let previous = '';
      for (let x = start; x < end; x++) {
        const broad = materialField(x / scaleX, y / scaleY, seed);
        const wear = materialField(x / 6, y / 3, seed + 19);
        const value = broad * .78 + wear * .22;
        // A mineral face remains one material. Extremes are rare exposed inclusions;
        // broad 40/58% thresholds produced camouflage rather than material in R3's first frame.
        const color = colors[value < .24 ? 0 : value > .76 ? 2 : 1];
        if (color !== previous) {
          if (x > runStart) p.rect(runStart, y, x - runStart, 1, previous);
          runStart = x; previous = color;
        }
      }
      if (end > runStart) p.rect(runStart, y, end - runStart, 1, previous);
    }
  }
}

function materialHash(x: number, y: number, seed: number): number {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function materialField(x: number, y: number, seed: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
  const a = materialHash(ix, iy, seed); const b = materialHash(ix + 1, iy, seed);
  const d = materialHash(ix, iy + 1, seed); const e = materialHash(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (d + (e - d) * sx) * sy;
}
