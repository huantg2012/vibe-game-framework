/** Low relief, in native world pixels. Geometry owns normals; source pigment
 * never changes height. This module has no access to loot or gameplay tiers. */
import type { NativeVolumeFamily } from '@/generation/world-study/native-volume-geometry';
import type { R100SearchSitePlacement } from '@/generation/world-study/search-site-types';

type Point = readonly [number, number];
export type SearchSiteFace = 'skin' | 'cleaved' | 'loose';
export interface SearchSiteGeometry {
  readonly height: Float32Array;
  readonly coverage: Float32Array;
  readonly roughness: Float32Array;
  readonly face: readonly SearchSiteFace[];
  readonly family: readonly NativeVolumeFamily[];
  readonly overlap: Uint8Array;
}
interface Piece {
  readonly points: readonly Point[];
  readonly elevation: (u: number, v: number) => number;
  readonly coverage: number;
  readonly roughness: number;
  readonly face: SearchSiteFace;
  readonly family: NativeVolumeFamily;
}
const clamp = (n: number, low: number, high: number): number => Math.max(low, Math.min(high, n));
function randomSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function inside(points: readonly Point[], x: number, y: number): boolean {
  let hit = false;
  for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
    const p = points[a]!, q = points[b]!;
    if ((p[1] > y) !== (q[1] > y) && x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]) + p[0]) hit = !hit;
  }
  return hit;
}

/** The before/after layouts share peripheral pieces. Searching breaks the
 * central overlap, rather than applying an opacity change to the intact pile. */
function piecesFor(site: R100SearchSitePlacement, searched: boolean): Piece[] {
  const random = randomSequence(site.visualSeed), pieces: Piece[] = [];
  const signed = (amount: number): number => (random() * 2 - 1) * amount;
  const add = (points: readonly Point[], elevation: Piece['elevation'], roughness: number,
    face: SearchSiteFace = 'skin', coverage = 1, family = site.family): void => {
    pieces.push({ points, elevation, roughness, face, coverage, family });
  };
  // Irregular broken plates have finite, open edges, not an encircling border.
  const shard = (x: number, y: number, length: number, breadth: number, z: number,
    slope: number, roughness: number, face: SearchSiteFace = 'skin', coverage = 1): void => {
    const left = x - length / 2, right = x + length / 2, top = y - breadth / 2, bottom = y + breadth / 2;
    const points: Point[] = [[left, top + breadth * .25], [left + length * (.12 + random() * .17), top],
      [right - length * (.08 + random() * .16), top + breadth * .10], [right, top + breadth * .56],
      [right - length * (.13 + random() * .2), bottom], [left + length * .09, bottom - breadth * .12]];
    add(points, (u, v) => Math.max(.08, z + (u - x) * slope + (v - y) * slope * .24), roughness, face, coverage);
  };
  const ribbon = (x: number, y: number, length: number, width: number, bend: number, z: number,
    roughness: number, coverage = 1, family = site.family, angle = 0): void => {
    const upper: Point[] = [], lower: Point[] = [];
    for (let segment = 0; segment <= 6; segment++) {
      const t = segment / 6, u = x + (t - .5) * length;
      const v = y + Math.sin(t * Math.PI) * bend + (t - .5) * bend * .18;
      const half = width * (.30 + .20 * Math.sin(t * Math.PI)) * (segment === 0 || segment === 6 ? .58 : 1);
      upper.push([u, v - half]); lower.unshift([u, v + half]);
    }
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const points: Point[] = [...upper, ...lower].map(([u, v]) => [x + (u - x) * ca - (v - y) * sa, y + (u - x) * sa + (v - y) * ca]);
    add(points, (u, v) => {
      const localU = (u - x) * ca + (v - y) * sa + x;
      const localV = -(u - x) * sa + (v - y) * ca + y;
      const t = clamp((localU - x) / length + .5, 0, 1);
      const middle = y + Math.sin(t * Math.PI) * bend + (t - .5) * bend * .18;
      return Math.max(.08, z * Math.sqrt(Math.max(0, 1 - ((localV - middle) / Math.max(1, width * .6)) ** 2)));
    }, roughness, 'skin', coverage, family);
  };
  const sourceDx = site.sourceAnchor ? site.sourceAnchor.x - site.position.x : 0;
  const sourceDy = site.sourceAnchor ? site.sourceAnchor.y - site.position.y : 0;
  const sourceU = sourceDx * Math.cos(site.axis) + sourceDy * Math.sin(site.axis);
  const sourceV = -sourceDx * Math.sin(site.axis) + sourceDy * Math.cos(site.axis);
  const sourceLength = Math.max(1, Math.hypot(sourceU, sourceV));
  const peripheralBias = site.sourceKind === 'detached' ? sourceU / sourceLength : site.sourceKind === 'surface-peel' ? -.4 : .5;
  const scatterX = (i: number): number => (i % 2 === 0 ? -1 : 1) * (15 + random() * 10) + peripheralBias * 5;

  // A peeled bed retains a short connected tail beneath the loose core. Open
  // accumulation deliberately has no such attachment: its separated pieces
  // stop on the exposed substrate instead of claiming it broke out of it.
  if (site.sourceKind === 'surface-peel') switch (site.family) {
    case 'fibre-knot':
      ribbon(-16, -2, searched ? 14 : 28, .9, 1.2, .16, .90, .48, site.family, -.18);
      if (!searched) ribbon(-12, -3, 17, .7, -.7, .14, .92, .48, site.family, .18);
      break;
    case 'membrane-rim':
      add([[-27, -2], [-20, -6], [-10, -4], [-4, -1], [-7, 4], [-15, 3], [-19, 5], [-24, 2]], () => .12, .77, 'skin', .37);
      break;
    case 'folded-slab':
      shard(-12, -4, 28, 4.5, .20, .008, .92, 'skin', .61);
      shard(-7, 4, 25, 2.4, .14, .003, .94, 'loose', .50);
      break;
    case 'gel-flow':
      add([[-29, -1], [-21, -5], [-15, -3], [-7, -4], [-2, 0], [-12, 3], [-22, 2]], () => .13, .53, 'skin', .27);
      break;
    case 'broken-shell':
      ribbon(-11, 2, 27, 2.8, 2.4, .22, .72, .55);
      break;
    case 'granular-ridge':
      for (let i = 0; i < 6; i++) shard(-16 + i * 3, signed(2), 2.8, 2.1, .15, 0, .98, 'loose', .65);
      break;
  }

  switch (site.family) {
    case 'folded-slab': {
      for (let i = 0; i < 4; i++) shard(scatterX(i), signed(12), 5 + random() * 11, 1.5 + random() * 2, .22 + random() * .35, .018, .91, 'loose', .72);
      shard(-2, 2, 30 + signed(2), 12, .35, .018, .88, 'skin', .88);
      for (let i = 0; i < 3; i++) {
        const x = signed(5), y = -4 + i * 4 + signed(1), length = 19 + signed(5), width = 4 + random() * 3;
        shard(x + (searched ? (i % 2 ? 9 : -8) : 0), y + (searched ? i * 2 - 3 : 0), length, width,
          searched ? .28 : 1.0 + i * .65, searched ? .004 : .06, searched ? .93 : .81, i === 1 ? 'cleaved' : 'skin');
      }
      break;
    }
    case 'fibre-knot': {
      // Peripheral ends are sparse and bent, not a full parallel hatch field.
      const tipBend = signed(1.5);
      ribbon(-19, -4, 18, .9, tipBend, .23, .86, .83, site.family, -.28);
      ribbon(18, 7, 14, .8, -tipBend, .20, .88, .83, site.family, .31);
      if (searched) {
        // Removing the tied overlap leaves disconnected broken ends around
        // exposed ground; no intact long bundle survives at the interaction point.
        ribbon(-11, 5, 7 + random() * 2, 1.1, .5, .31, .88, 1, site.family, -.36);
        ribbon(7, -7, 5 + random() * 3, .95, -.4, .24, .88, 1, site.family, .51);
        ribbon(13, 1, 6, .8, .4, .22, .90, 1, site.family, -.52);
      } else {
        const turn = signed(.08);
        for (let bundle = 0; bundle < 3; bundle++) {
          const angle = [-.20, .49, -.58][bundle]! + turn;
          const x = [-2, 1, -1][bundle]! + signed(.8), y = [0, 0, -2][bundle]!;
          const length = [30, 26, 22][bundle]! + signed(2), breadth = [3.8, 3.4, 2.9][bundle]!;
          ribbon(x, y, length, breadth, signed(1.2), 1.55 + bundle * .55, .80, 1, site.family, angle);
          // A narrow split strand shares one end, then opens out at the break.
          ribbon(x - length * .22, y - 1.5, length * .56, .75, .8, .55, .84, .94, site.family, angle - .12);
        }
      }
      break;
    }
    case 'membrane-rim': {
      // A broad, torn sheet remains flat; only one short folded flap is raised.
      for (let i = 0; i < 3; i++) shard(scatterX(i) * .86, (i - 1) * 10, 11 + random() * 9, 2 + random() * 3, .19, .005, .73, 'loose', .46);
      const tear = signed(2);
      if (searched) {
        // The lifted section has been pulled apart. Its centre exposes the
        // original receiver; separated margins cannot read as a new whole sheet.
        add([[-16, -5], [-10, -7], [-6, -3], [-8, 0], [-14, 2], [-17, -1]], () => .22, .69, 'skin', .68);
        add([[9, -1], [14, -2], [16, 3], [12, 7], [7, 5]], () => .24, .69, 'skin', .68);
        add([[0, -8 + tear], [6, -7], [4, -4], [-1, -5]], () => .17, .71, 'skin', .68);
      } else {
        add([[-16, -5], [-8, -9], [3, -8 + tear], [14, -3], [10, 2], [15, 7], [4, 9], [-1, 5], [-11, 7], [-15, 1]],
          () => .28, .69, 'skin', .68);
        shard(1, -1, 19 + signed(2), 5.5, 2.15, .095, .67, 'skin', .94);
      }
      break;
    }
    case 'gel-flow': {
      for (let i = 0; i < 4; i++) shard(scatterX(i), signed(10), 6 + random() * 9, 2 + random() * 3, .15, 0, .56, 'loose', .30);
      add([[-29, -2], [-19, -4], [-12, -3], [-6, -8], [1, -7], [0, -3], [4, -2], [8, -5], [15, -1], [11, 3], [13, 6], [2, 8], [-7, 4], [-17, 3], [-21, 0]],
        u => .15 + .35 * clamp((u + 25) / 38, 0, 1), .41, 'skin', .54);
      // Only a recorded local second material may supply visible inclusions.
      if (site.groundFamily === 'fibre-knot') for (let i = 0; i < 2; i++) ribbon(-6 + i * 9, -2 + i * 5, 15 + random() * 5, 1.0, signed(2), .42, .84, .85, 'fibre-knot');
      if (searched) {
        shard(-9, 4, 10, 4, .40, .006, .67, 'loose', .65);
        shard(10, -6, 12, 5, .48, .006, .63, 'loose', .66);
      } else {
        add([[-9, -3], [-4, -7], [1, -6], [0, -3], [4, -2], [8, -5], [14, 0], [9, 2], [11, 4], [6, 6], [-3, 5]],
          (u, v) => .60 + 2.1 * Math.max(0, 1 - ((u - 2) / 15) ** 2 - (v / 9) ** 2), .39, 'skin', .95);
      }
      break;
    }
    case 'granular-ridge': {
      for (let i = 0; i < 9; i++) shard(scatterX(i) * .72, signed(12), 1.7 + random() * 3.1, 1.4 + random() * 2, .22 + random() * .34, .01, .97, 'loose', .81);
      for (let i = 0; i < 6; i++) {
        const x = (i % 3 - 1) * 8 + signed(1.8), y = (i < 3 ? -4 : 4) + signed(2), length = 6 + random() * 5;
        shard(x + (searched ? (i % 2 ? 5 : -5) : 0), y + (searched ? (i < 3 ? -3 : 3) : 0), length, 4 + random() * 4,
          searched ? .38 : 1.1 + random() * 1.4, searched ? .01 : signed(.08), .94, i === 2 ? 'cleaved' : 'skin');
      }
      break;
    }
    case 'broken-shell': {
      for (let i = 0; i < 4; i++) shard(scatterX(i) * .8, signed(14), 6 + random() * 5, 2 + random() * 2, .35, .02, .79, 'loose', .86);
      shard(-3, 3, 29, 12, .43, .016, .58, 'skin', .91);
      for (let i = 0; i < 3; i++) {
        const length = 14 + random() * 10, y = -4 + i * 4, x = signed(3), bend = 2 + random() * 2;
        ribbon(x + (searched ? (i - 1) * 7 : 0), y + (searched ? (i - 1) * 3 : 0), length, 4 + random() * 2,
          searched ? bend * .5 : bend, searched ? .40 : 1.5 + random() * 1.1, i === 1 ? .82 : .48);
      }
      break;
    }
  }
  // Detached fragments favour the real source side. A short, broken material
  // trace is sufficient; it neither reaches across a void nor invents a wall.
  if (site.sourceKind === 'detached' && site.sourceAnchor) {
    const u = sourceU / sourceLength, v = sourceV / sourceLength;
    for (let i = 0; i < 3; i++) shard(u * (19 + i * 4), v * (19 + i * 4),
      5 - i, 1.5 + random(), .20, .008, .9, 'loose', .68 - i * .10);
  }
  return pieces;
}

export function bakeSearchSiteGeometry(site: R100SearchSitePlacement, x: number, y: number,
  width: number, height: number, searched: boolean): SearchSiteGeometry {
  const size = width * height, elevation = new Float32Array(size), coverage = new Float32Array(size);
  const roughness = new Float32Array(size), face: SearchSiteFace[] = Array(size).fill('skin');
  const family: NativeVolumeFamily[] = Array(size).fill(site.family), overlap = new Uint8Array(size);
  const pieces = piecesFor(site, searched), ca = Math.cos(site.axis), sa = Math.sin(site.axis);
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const dx = x + px + .5 - site.position.x, dy = y + py + .5 - site.position.y;
    // Leave a natural margin even when the local material axis is steep.
    if (Math.abs(dx) > 38 || Math.abs(dy) > 30) continue;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca, index = py * width + px;
    for (const piece of pieces) {
      if (!inside(piece.points, u, v)) continue;
      const h = clamp(piece.elevation(u, v), .05, searched ? .95 : 3.9);
      overlap[index] = Math.min(255, overlap[index]! + 1);
      if (h < elevation[index]!) continue;
      elevation[index] = h; coverage[index] = piece.coverage; roughness[index] = piece.roughness;
      face[index] = piece.face; family[index] = piece.family;
    }
  }
  return { height: elevation, coverage, roughness, face, family, overlap };
}
