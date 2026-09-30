import { Model, random, type V2, type V3 } from '../../docs/art/demos/purification-last-light/model';

/** Opening-only extension of the ruined library, behind the playable world.
 * Identity: load-bearing masonry and an interrupted book gallery, not islands.
 * Authored for direction [33,15,17], scale 50, origin [766.8934,244.121].
 * All geometry remains below y=-5 and beyond x=-14. The left title interval
 * stays empty; mass is concentrated around screen x=400 and the lower crossing.
 * No navigation, interaction, palette override, or unmotivated light is added.
 */
export function addOpeningExterior(model: Model): void {
  const previousLayer = model.layer;
  try {
    model.layer = 'far';
    model.at([0, 0, 0], 0, 8701, () => brokenArch(model));
    model.layer = 'middle';
    model.at([-20.4, -13.65, -2.35], .61, 8702, () => libraryCrossing(model));
  } finally {
    model.layer = previousLayer;
  }
}

/** A closed, slightly battered octagonal pier. Each ring changes the actual
 * contour; broad faces remain broad instead of being covered in rubble noise. */
function pier(m: Model, rings: readonly { center: V3; width: number; depth: number }[], tint: number): void {
  const vertices = rings.map(({ center: [x, y, z], width: w, depth: d }): V3[] => [
    [x - w * .36, y, z - d * .5], [x + w * .37, y, z - d * .5],
    [x + w * .5, y, z - d * .34], [x + w * .5, y, z + d * .32],
    [x + w * .34, y, z + d * .5], [x - w * .35, y, z + d * .5],
    [x - w * .5, y, z + d * .33], [x - w * .5, y, z - d * .35],
  ]);
  for (let k = 0; k < vertices.length - 1; k++) {
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      m.quad(vertices[k]![i]!, vertices[k + 1]![i]!, vertices[k + 1]![next]!, vertices[k]![next]!, 'stone', tint);
    }
  }
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    m.triangle(rings[0]!.center, vertices[0]![i]!, vertices[0]![next]!, 'stone', tint * .77);
    m.triangle(rings[rings.length - 1]!.center, vertices[vertices.length - 1]![next]!, vertices[vertices.length - 1]![i]!, 'stone', tint);
  }
}

/** Convex broken floor contour with a real closed underside. */
function floor(m: Model, points: readonly V2[], top: number, bottom: number, tint: number): void {
  m.slab(points, top, bottom, 'stone', tint);
  const center: V3 = [points.reduce((n, p) => n + p[0], 0) / points.length, bottom, points.reduce((n, p) => n + p[1], 0) / points.length];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    m.triangle(center, [a[0], bottom, a[1]], [b[0], bottom, b[1]], 'stone', tint * .76);
  }
}

function brokenArch(m: Model): void {
  // The upper return is thicker than a person; its shaft continues beyond
  // the lower frame. Neither end is presented as a complete display object.
  pier(m, [
    { center: [-28.12, -21.8, -5.61], width: 1.55, depth: 1.95 },
    { center: [-27.96, -16.8, -5.73], width: 1.52, depth: 1.87 },
    { center: [-27.82, -12.4, -5.89], width: 1.42, depth: 1.79 },
    { center: [-27.65, -8.22, -5.98], width: 1.33, depth: 1.74 },
    { center: [-27.47, -7.71, -6.02], width: 1.59, depth: 1.89 },
  ], .49);
  // Broken arch shoulder: stepped bearing bed, deep return, lost continuation.
  m.beam([-27.60, -7.81, -6.04], [-25.96, -6.72, -7.10], 1.36, 1.67, 'cutstone', .51);
  m.beam([-25.96, -6.72, -7.10], [-22.66, -6.32, -9.37], 1.17, 1.49, 'stone', .48);
  m.beam([-22.66, -6.32, -9.37], [-20.51, -6.81, -10.80], 1.07, 1.40, 'stone', .43);
  m.box([-27.50, -7.51, -5.96], [1.88, .30, 2.05], 'cutstone', .065, .52);
  m.box([-27.51, -8.15, -5.97], [1.70, .25, 1.90], 'stone', .04, .45);
  // A lost outer skin reveals a recessed structural rib and broken ties.
  m.beam([-27.17, -8.22, -5.16], [-27.38, -12.65, -5.08], .20, .16, 'cutstone', .54);
  m.beam([-27.43, -14.07, -5.03], [-27.68, -20.57, -4.82], .23, .16, 'stone', .43);
  m.beam([-26.91, -8.19, -5.54], [-26.81, -10.11, -5.43], .075, .071, 'iron', .51);
  m.beam([-26.81, -10.11, -5.43], [-26.53, -10.51, -5.39], .072, .07, 'iron', .48);
  // Two masonry courses have different missing outer edges, not striping.
  m.box([-27.83, -12.71, -5.88], [1.56, .20, 1.94], 'stone', .034, .40);
  m.beam([-28.44, -16.14, -5.74], [-27.82, -16.15, -4.85], .19, .25, 'stone', .43);
  // Bent construction members descend into open air, attached at the fracture.
  m.cable([[-23.15, -6.93, -8.77], [-23.08, -9.68, -8.70], [-23.43, -12.78, -8.49], [-23.40, -16.52, -8.47]], .064, 'iron', .46);
  m.cable([[-25.40, -7.36, -6.96], [-25.18, -8.38, -6.86], [-25.42, -10.45, -6.69]], .075, 'iron', .49);
  // An exposed upper fracture, not a luminous outline of the whole arch.
  seam(m, [[-27.64, -7.352, -5.34], [-27.20, -7.352, -5.26], [-26.83, -7.352, -5.43]], .062, .90, 'opening-arch-fracture');
  seam(m, [[-27.09, -12.57, -5.67], [-27.095, -12.93, -5.60], [-27.10, -13.23, -5.66]], .043, .55, 'opening-pier-wound', [1, 0, 0]);
}

function libraryCrossing(m: Model): void {
  const rng = random(8717);
  // A single damaged section of corridor. Its support continues below frame;
  // the right end is broken rather than capped by a neat island silhouette.
  floor(m, [[-3.82, -.78], [-1.92, -.91], [2.81, -.74], [3.61, -.31], [3.24, .37], [1.55, .67], [-2.89, .62], [-3.91, .12]], 0, -.73, .55);
  m.beam([-3.73, -.57, .43], [2.65, -.65, .57], .28, .37, 'cutstone', .52);
  m.beam([-3.32, -.73, -.27], [-3.98, -7.91, -.08], .72, 1.05, 'stone', .45);
  m.beam([1.78, -.77, -.15], [2.88, -8.62, .31], .81, .91, 'stone', .43);
  m.beam([-3.27, -1.03, .02], [-1.13, -.87, .05], .38, .57, 'stone', .50);
  m.beam([1.69, -.99, .05], [.71, -2.57, .19], .49, .59, 'stone', .46);
  // Partly stripped book-wall. Gaps expose deep bays; there is no flat dark
  // rectangle pretending to be a complete cabinet back.
  for (const x of [-2.92, -1.20, .60, 2.14]) {
    const h = x > 1 ? 1.16 : x < -2 ? 2.54 : 2.88;
    m.beam([x, .05, -.34], [x + .035, h, -.40], .15, .23, 'wood', .54);
    m.beam([x, .04, -.52], [x, h * .83, -.53], .07, .13, 'iron', .46);
  }
  for (let row = 0; row < 4; row++) {
    const y = .19 + row * .64;
    const end = row === 3 ? .16 : row === 2 ? .71 : 2.12;
    m.beam([-2.95, y, -.18], [end, y + .015, -.18], .43, .09, 'wood', .54);
    // Books are grouped and interrupted, not individual high-contrast marks.
    for (let group = 0; group < 3; group++) {
      const start = -2.68 + group * 1.58;
      if (start > end - .34 || (row === 2 && group === 1)) continue;
      const count = group === 2 ? 3 : 5;
      let x = start;
      for (let book = 0; book < count && x < end - .17; book++) {
        const w = .11 + rng() * .085, h = .30 + rng() * .17;
        const shift = book === count - 1 ? .10 : .015;
        m.beam([x, y + .06, -.08], [x + shift, y + h, -.10], w, .29, book % 4 === 1 ? 'paper' : 'wood', .36 + rng() * .10);
        x += w + .035;
      }
    }
  }
  m.beam([-2.96, 2.75, -.35], [-.94, 2.97, -.39], .21, .26, 'wood', .57);
  m.beam([.61, 2.58, -.35], [1.30, 1.64, -.21], .14, .22, 'wood', .47);
  // Back planks only where they remain attached; masonry joints stay visible.
  for (const x of [-2.58, -2.27, -.87, -.56]) {
    m.beam([x, .13, -.52], [x + .02, 2.63, -.56], .23, .065, 'wood', .39);
  }
  m.beam([-3.53, .10, .50], [-3.49, .88, .52], .078, .082, 'iron', .50);
  m.beam([-3.49, .88, .52], [-2.53, .77, .60], .073, .075, 'iron', .49);
  m.cable([[2.93, -.05, .28], [2.98, -1.73, .40], [2.62, -4.31, .39], [2.84, -6.88, .56]], .047, 'iron', .45);
  // Two attached chips expose thickness at the broken right edge.
  m.beam([2.93, -.19, .38], [3.21, -.82, .24], .32, .41, 'stone', .58);
  m.beam([3.26, -.12, -.03], [3.58, -.38, -.16], .24, .33, 'stone', .53);
  seam(m, [[-.84, .018, .45], [-.46, .018, .48], [-.30, .018, .31], [-.09, .018, .34]], .051, .72, 'opening-gallery-seam');
}

/** Small, physically attached emissive cracks, with a matching local source. */
function seam(m: Model, path: readonly V3[], width: number, tint: number, id: string, normal: V3 = [0, 1, 0]): void {
  m.cable(path, width, 'pollutant', tint);
  const midpoint = path[Math.floor(path.length / 2)]!;
  m.box(midpoint, [width * 1.5, width * .75, width * 1.3], 'pollutant', width * .12, tint * .91);
  m.light([midpoint[0] + normal[0] * .12, midpoint[1] + normal[1] * .12, midpoint[2] + normal[2] * .12], [.38, .52, .39], .6 + tint * 1.7, 4.1 + tint * 2, { kind: 'pollution', id });
}
