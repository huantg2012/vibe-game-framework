/**
 * Seeded edge study for the approved rectangle silhouette. No runtime imports.
 * Coordinates stay in geometry.authoringFrame; worldScale is not baked in.
 * This is an authoring study, not production terrain or collision generation.
 * @typedef {[number, number]} Point
 * @typedef {[number, number, number, number]} Rect
 * @typedef {{authoringFrame: Point, landRects: Rect[], voidRects: Rect[]}} Geometry
 */

export const PREVIEW_SEEDS = Object.freeze([20261011, 20261027, 20261109]);

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const signedArea = points => points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;
const pointKey = point => `${point[0]},${point[1]}`;
const insideRect = (x, y, [rx, ry, rw, rh]) => x > rx && x < rx + rw && y > ry && y < ry + rh;
const round = value => Math.round(value * 100) / 100;

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let x = Math.imul(state ^ state >>> 15, 1 | state);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

/** Extract the union-minus-union boundary before any edge styling. */
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
    cells[y * width + x] = Number(geometry.landRects.some(r => insideRect(px, py, r)) && !geometry.voidRects.some(r => insideRect(px, py, r)));
  }
  const occupied = (x, y) => x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x] === 1;
  const edges = [];
  const starts = new Map();
  const addEdge = (a, b) => {
    const index = edges.length;
    edges.push({a, b, used: false});
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
      if (edge.used) throw new Error('Rectangle boundary unexpectedly revisited');
      edge.used = true;
      points.push(edge.a);
      if (pointKey(edge.b) === pointKey(edges[start].a)) break;
      const candidates = (starts.get(pointKey(edge.b)) ?? []).filter(i => !edges[i].used);
      if (candidates.length === 0) throw new Error('Rectangle boundary is open');
      // At a diagonal contact keep each face on its own right-hand boundary.
      candidates.sort((a, b) => cross(edge.a, edge.b, edges[b].b) - cross(edge.a, edge.b, edges[a].b));
      current = candidates[0];
    }
    const simplified = points.filter((p, i) => cross(points[(i + points.length - 1) % points.length], p, points[(i + 1) % points.length]) !== 0);
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

/**
 * Build a reproducible local edge treatment without changing the rectangle layout.
 * No smoothing radius: mixed retained corners, asymmetric cuts and broken facets.
 * @param {Geometry} geometry
 * @param {number} seed Unsigned integer identity for the local damage arrangement.
 * @returns {{seed:number, contours:Point[][], contourKinds:('outer'|'hole')[], pathD:string, stats:object}}
 */
export function generateEdgeStudy(geometry, seed = 20261011) {
  if (!Number.isInteger(seed) || !Number.isFinite(seed)) throw new TypeError('Edge seed must be a finite integer');
  const normalizedSeed = seed >>> 0;
  const random = randomGenerator(normalizedSeed);
  const rawContours = rectangleContours(geometry);
  const allPoints = rawContours.flat();
  // Coherent patches correlate nearby corners; random vertices alone look noisy.
  const patches = Array.from({length: 4}, (_, i) => {
    const candidates = i < 2 ? rawContours[0] : allPoints;
    const p = candidates[Math.floor(random() * candidates.length)];
    return {point: p, reach: 135 + random() * 190, strength: 0.65 + random() * 0.35, bias: random() * 2 - 1, style: i % 3};
  });
  const damageAt = point => {
    let winner = patches[0];
    let intensity = 0;
    for (const patch of patches) {
      const weight = Math.exp(-Math.pow(length(point, patch.point) / patch.reach, 2)) * patch.strength;
      if (weight > intensity) { intensity = weight; winner = patch; }
    }
    return {intensity, bias: winner.bias, style: winner.style};
  };
  const counts = {retained: 0, bevel: 0, broken: 0, blunt: 0, edgeBreaks: 0};
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
      const chance = random();
      // Long, quiet stretches and some sharp turns survive in every seed.
      if (chance < 0.15 + (1 - damage.intensity) * 0.37 || Math.min(incomingLength, outgoingLength) < 9) {
        counts.retained++;
        return {start: vertex, end: vertex, points: [vertex], type: 'retained'};
      }
      const maximum = Math.min(68, clearance * 0.43);
      const scale = (0.56 + damage.intensity * 0.74) * (0.72 + random() * 0.48);
      const a = Math.min(incomingLength * 0.34, maximum * scale * (1 + damage.bias * 0.44));
      const b = Math.min(outgoingLength * 0.34, maximum * scale * (1 - damage.bias * 0.44));
      const inUnit = [(previous[0] - vertex[0]) / incomingLength, (previous[1] - vertex[1]) / incomingLength];
      const outUnit = [(next[0] - vertex[0]) / outgoingLength, (next[1] - vertex[1]) / outgoingLength];
      const local = (u, v) => [round(vertex[0] + inUnit[0] * a * u + outUnit[0] * b * v), round(vertex[1] + inUnit[1] * a * u + outUnit[1] * b * v)];
      const start = local(1, 0);
      const end = local(0, 1);
      const styleRoll = random();
      let style = damage.style;
      if (styleRoll < 0.35) style = Math.floor(random() * 3);
      let treatment;
      if (style === 0) {
        counts.bevel++;
        treatment = [start, end];
      } else if (style === 1) {
        counts.broken++;
        // Different long/short facets, with a small ledge rather than a radius.
        treatment = [start, local(0.64 + random() * 0.15, 0.07 + random() * 0.14), local(0.52 + random() * 0.10, 0.42 + random() * 0.14), local(0.11 + random() * 0.15, 0.56 + random() * 0.11), end];
      } else {
        counts.blunt++;
        // A few unequal planar turns provide a quieter, worn corner.
        treatment = [start, local(0.68 + random() * 0.13, 0.22 + random() * 0.12), local(0.20 + random() * 0.14, 0.73 + random() * 0.12), end];
      }
      return {start, end, points: treatment, type: ['bevel', 'broken', 'blunt'][style]};
    });
    // Tiny rectangular voids must not all become matching chamfered buttons.
    // This independent stream changes only their corner allocation, not the
    // main shore or later contours' damage sequence.
    if (signedArea(points) < 0 && points.length === 4 && Math.abs(signedArea(points)) < 3000) {
      const smallRandom = randomGenerator(normalizedSeed ^ Math.imul(ci + 1, 0x9e3779b1));
      const first = Math.floor(smallRandom() * 4);
      const keepCount = smallRandom() < 0.3 ? 3 : 2;
      const opposite = smallRandom() < 0.5;
      const preserve = keepCount === 3 ? [first, (first + 1) % 4, (first + 2) % 4] : [first, (first + (opposite ? 2 : 1)) % 4];
      for (const i of preserve) if (corners[i].type !== 'retained') {
        counts[corners[i].type]--;
        counts.retained++;
        corners[i] = {start: points[i], end: points[i], points: [points[i]], type: 'retained'};
      }
    }
    const treated = [];
    const edgeCandidates = corners.map((corner, i) => {
      const next = corners[(i + 1) % corners.length];
      const midpoint = [(corner.end[0] + next.start[0]) / 2, (corner.end[1] + next.start[1]) / 2];
      return {i, length: length(corner.end, next.start), priority: damageAt(midpoint).intensity * 0.8 + random() * 0.2};
    }).filter(edge => edge.length >= 145).sort((a, b) => b.priority - a.priority);
    // A few grouped breaks on long shores, never a continuous noisy outline.
    const brokenEdges = new Set(edgeCandidates.slice(0, ci === 0 ? 3 : 0).map(edge => edge.i));
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
      const direction = [(next.start[0] - current.end[0]) / edgeLength, (next.start[1] - current.end[1]) / edgeLength];
      const inward = [-direction[1], direction[0]];
      const width = Math.min(48, edgeLength * (0.14 + random() * 0.13));
      const center = edgeLength * (0.33 + random() * 0.34);
      const clearance = Math.min(...rawContours.flatMap((loop, index) => loop.map((a, ei) => index === ci && ei === i ? Infinity : pointSegmentDistance(midpoint, a, loop[(ei + 1) % loop.length]))));
      const depth = Math.min(7 + damage.intensity * 13, clearance * 0.18);
      const edgePoint = (along, inset) => [round(current.end[0] + direction[0] * along + inward[0] * inset), round(current.end[1] + direction[1] * along + inward[1] * inset)];
      treated.push(edgePoint(center - width / 2, 0), edgePoint(center - width * 0.18, depth * 0.72), edgePoint(center + width * 0.25, depth), edgePoint(center + width / 2, 0));
      retainedAxisLength -= width;
      counts.edgeBreaks++;
    }
    return {kind: signedArea(points) > 0 ? 'outer' : 'hole', points: treated, sourcePoints: points};
  });
  const pathD = contours.map(({points}) => `M${points.map(p => p.join(' ')).join('L')}Z`).join('');
  const originalArea = rawContours.reduce((total, points) => total + signedArea(points), 0);
  const treatedArea = contours.reduce((total, {points}) => total + signedArea(points), 0);
  return {
    seed: normalizedSeed,
    contours: contours.map(contour => contour.points),
    contourKinds: contours.map(contour => contour.kind),
    pathD,
    stats: {
      ...counts,
      outerContours: contours.filter(c => c.kind === 'outer').length,
      holeContours: contours.filter(c => c.kind === 'hole').length,
      sourceCorners: rawContours.reduce((sum, points) => sum + points.length, 0),
      originalArea,
      treatedArea: round(treatedArea),
      areaChangePercent: round((treatedArea - originalArea) / originalArea * 100),
      originalAxisLengthPercent: round(retainedAxisLength / sourcePerimeter * 100),
      coordinateSpace: 'authoringFrame; multiply by worldScale for world pixels',
    },
  };
}
