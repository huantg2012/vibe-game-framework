import type { Builder, Point, UV } from './native-volume-expansion';

/** A walkable, settled skin. Its shallow perimeter merges into the substrate;
 * only the separate curled solid carries an impassable edge. The footprint
 * stays within the original torn-sheet domain, including its open notches. */
export function buildSettledSheet(b: Builder): void {
  const outline: readonly UV[] = [[-.50, -.23], [-.29, -.48], [.13, -.37], [.40, -.26], [.51, -.03],
    [.34, .29], [.23, .13], [.04, -.02], [.13, .23], [-.10, .49], [-.37, .34], [-.28, .13], [-.46, .02]];
  const parts = [[0, 1, 2, 7, 11, 12], [11, 7, 8, 9, 10], [2, 3, 4, 5, 6, 7]];
  buildSettledMaterial(b, outline, parts, 'sheet');
}

/** A shallow buried layer retains the original branching break, but carries
 * no crisp paper-like wall around its entire perimeter. */
export function buildSettledFan(b: Builder): void {
  const outline: readonly UV[] = [[-.50, -.30], [-.32, -.49], [.24, -.40], [.43, -.18],
    [.51, .17], [.29, .39], [.16, .21], [.09, -.04], [-.02, .36], [-.30, .50], [-.46, .17], [-.30, -.10]];
  const parts = [[0, 1, 2, 3, 7, 11], [11, 7, 8, 9, 10], [7, 3, 4, 5, 6]];
  buildSettledMaterial(b, outline, parts, 'fan');
}

function buildSettledMaterial(b: Builder, outline: readonly UV[], parts: readonly (readonly number[])[], profile: 'sheet' | 'fan'): void {
  const s = b.spec;
  if (s.blocking !== 0 || s.height > 6) throw new Error('Settled material requires shallow, nonblocking material');
  const boundary = outline.map(([x, y]): UV => [x * s.length, y * s.width]);
  const smooth = (n: number): number => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
  const height = ([x, y]: UV): number => {
    let distance = Infinity;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i]!, c = boundary[(i + 1) % boundary.length]!;
      const dx = c[0] - a[0], dy = c[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      distance = Math.min(distance, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t));
    }
    // The ragged buried edge changes height, not opacity or collision. Its
    // zero-height border carries no upright perimeter wall or uniform bevel.
    const retreat = 5 + 3 * Math.sin(x * .043 + y * .025) + 2 * Math.sin(y * .071 - x * .019);
    const buried = smooth((distance - retreat) / 24);
    const fold = profile === 'sheet' ? .45 + .55 * smooth((y / s.width + .34 + .14 * x / s.length) / .70)
      : .78 + x / s.length * (.08 + s.fold * .08) - y / s.width * .13
        - .27 * smooth((x / s.length - .09) / .25) * smooth((y / s.width + .04) / .30);
    return s.height * buried * fold;
  };
  const clip = (polygon: readonly UV[], axis: 0 | 1, at: number, greater: boolean): UV[] => {
    const result: UV[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, c = polygon[(i + 1) % polygon.length]!;
      const ai = greater ? a[axis] >= at : a[axis] <= at;
      const ci = greater ? c[axis] >= at : c[axis] <= at;
      if (ai) result.push(a);
      if (ai !== ci) {
        const t = (at - a[axis]) / (c[axis] - a[axis]);
        result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    return result;
  };
  const minX = Math.min(...boundary.map(p => p[0])), maxX = Math.max(...boundary.map(p => p[0]));
  const minY = Math.min(...boundary.map(p => p[1])), maxY = Math.max(...boundary.map(p => p[1]));
  const xs = Array.from({ length: 13 }, (_, i) => minX + (maxX - minX) * i / 12);
  const ys = Array.from({ length: 11 }, (_, i) => minY + (maxY - minY) * i / 10);
  for (const part of parts) for (let x = 0; x < 12; x++) for (let y = 0; y < 10; y++) {
    const polygon = clip(clip(clip(clip(part.map(i => boundary[i]!), 0, xs[x]!, true),
      0, xs[x + 1]!, false), 1, ys[y]!, true), 1, ys[y + 1]!, false);
    if (polygon.length < 3) continue;
    const points = polygon.map((p): Point => [p[0], p[1], height(p)]);
    for (let i = 1; i < points.length - 1; i++) {
      b.quad(points[0]!, points[i]!, points[i + 1]!, points[i + 1]!, 0,
        [polygon[0]!, polygon[i]!, polygon[i + 1]!, polygon[i + 1]!], [0, 0, 1], 4);
    }
  }
}
