import { PixelLayer, type Ink, type Point } from './raster';

type Normal = NonNullable<Ink['normal']>;
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const fract = (n: number) => n - Math.floor(n);
const unit = (n: Normal): Normal => {
  const d = Math.hypot(...n) || 1;
  return [n[0] / d, n[1] / d, n[2] / d];
};

/** The small value interval is aggregate inside cement, not a dirt overlay.
 * The three scales describe a mineral bed, trowel pressure, then pore mouths.
 * No whole-surface freckle/noise texture is multiplied onto an existing image. */
function cementBody(u: number, v: number): number {
  const mineral = Math.sin(u * .039 + Math.sin(v * .054) * 1.8) * .20;
  const pressure = Math.sin(v * .125 + Math.sin(u * .041) * 1.4) * .085;
  const pu = u / 4.4, pv = v / 3.7;
  const cu = Math.floor(pu), cv = Math.floor(pv);
  let closest = 9, density = 0;
  // Irregular mineral centres cross the sampling cells. Empty cell boundaries
  // must never reveal a tiled checkerboard in the concrete binder.
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const iu = cu + ox, iv = cv + oy;
    const a = fract(Math.sin(iu * 27.13 + iv * 17.87) * 1423.17);
    const b = fract(Math.sin(iu * 13.41 + iv * 31.37) * 918.77);
    const c = fract(Math.sin(iu * 19.57 + iv * 9.83) * 627.21);
    const du = pu - iu - a, dv = pv - iv - b;
    const d = Math.abs(du) * (.75 + c * .3) + Math.abs(dv) * (.95 - c * .2);
    if (d < closest) { closest = d; density = a - b; }
  }
  const granule = closest < .43 ? density * .20 : -.025;
  return mineral + pressure + granule;
}

/** An unpainted cast plane: trowel waves and compression rolls affect its normal.
 * Rounded edges are kept in the construction geometry; this is only its body. */
export function castPlane(layer: PixelLayer, points: readonly Point[], tone: number,
  normal: Normal, origin: Point = points[0]!, material: Ink['material'] = 'concrete', light = .9): void {
  layer.surface(points, (x, y) => {
    const u = x - origin[0], v = y - origin[1];
    const roll = Math.sin(v * .11 + Math.sin(u * .025) * 1.2);
    const grain = cementBody(u, v);
    return {
      material, tone: tone + grain,
      normal: unit([normal[0] + Math.sin(u * .083 + v * .012) * .068,
        normal[1] + roll * .055, normal[2] + Math.cos(v * .11 + Math.sin(u * .025) * 1.2) * .09]),
      roughness: .88 + roll * .035, specular: .07, occlusion: .97, light,
    };
  });
}

/** Stone slabs are sampled in one pair of C's ground axes. The worn crown,
 * bevel, grout and rough chipped joint are different physical surfaces. */
export function paving(layer: PixelLayer, points: readonly Point[], tone = 3.6,
  origin: Point = [304, 615], axisU: Point = [105, 24], axisV: Point = [-52, 27], light = 1): void {
  const determinant = axisU[0] * axisV[1] - axisU[1] * axisV[0];
  const variants = [.02, -.12, .11, -.06, .06, -.04, .1, -.07, .04, -.11, .08, -.01, .13];
  layer.surface(points, (x, y) => {
    const dx = x - origin[0], dy = y - origin[1];
    const a = (dx * axisV[1] - dy * axisV[0]) / determinant;
    const b = (dy * axisU[0] - dx * axisU[1]) / determinant;
    const row = Math.floor(b), u = a + (row % 2 === 0 ? 0 : .45);
    const col = Math.floor(u), fu = fract(u), fv = fract(b);
    const slot = ((col * 3 + row * 7) % variants.length + variants.length) % variants.length;
    const bend = .0025 * Math.sin(fv * 31 + col * 2.7) + .002 * Math.sin(fv * 71 + row);
    const du = Math.min(fu + bend, 1 - fu - bend), dv = Math.min(fv, 1 - fv);
    const edgeU = du * 69, edgeV = dv * 44;
    const d = Math.min(edgeU, edgeV);
    const jointWear = .5 + .5 * Math.sin((edgeU < edgeV ? fv : fu) * 7 + row * 2.3 + col * 1.3);
    if (d < .66) return {
      material: 'concrete', tone: tone - .22 - jointWear * .27 + cementBody(x * .6, y) * .7,
      normal: [0, .7, .4], roughness: .98, specular: .025, occlusion: .87, light: light * .9,
    };
    const bevel = clamp((2.4 - d) / 1.75);
    const crown = Math.sin(fu * Math.PI) * Math.sin(fv * Math.PI);
    // Contact polish belongs to the short real work route and device foothold,
    // never repeats at the middle of every paving slab.
    const route = y > 586 && y < 709 ? Math.max(
      Math.exp(-((x - 477) ** 2 / 2200 + (y - 631 - (x - 477) * .2) ** 2 / 185)),
      Math.exp(-((x - 571) ** 2 / 3000 + (y - 642 + (x - 571) * .13) ** 2 / 155)),
      Math.exp(-((x - 703) ** 2 / 780 + (y - 631) ** 2 / 120)),
    ) : 0;
    const worn = clamp(route * (1 + Math.sin(x * .19 + y * .34) * .07));
    // A shallow dragged load left two compressions within the surface. The
    // sloping sides change the normal; this cannot be reproduced by a stain.
    const dent = y > 596 && y < 701 ? Math.exp(-((x - 552) ** 2 / 980 + (y - 659 - (x - 552) * .23) ** 2 / 5.8)) : 0;
    const dentSide = (y - 659 - (x - 552) * .23) * dent * .04;
    const left = fu < .5 ? -1 : 1, near = fv < .5 ? -.6 : .65;
    const normal = edgeU < edgeV
      ? unit([left * bevel * .42 + Math.cos(fu * Math.PI) * .065, .025 + dentSide, 1 - bevel * .15 - dent * .045])
      : unit([-.04, near * bevel * .52 + Math.cos(fv * Math.PI) * .055 + dentSide, 1 - bevel * .18 - dent * .045]);
    const mineral = cementBody(fu * 83 + col * 41, fv * 60 + row * 37);
    return {
      material: 'concrete', tone: tone + variants[slot]! + mineral * (1 - worn * .25)
        + crown * .075 - bevel * .12 - dent * .11,
      normal, roughness: .9 - worn * .34 + bevel * .035,
      specular: .08 + worn * .17, occlusion: 1 - bevel * .04, light,
    };
  });
}

/** A broken slab is still one casting. These nonrepeating aggregate positions
 * lie inside the fracture volume; each exposes its own turned mineral facet. */
const aggregate: readonly (readonly [number, number, number, number, number])[] = [
  [9, 10, 7, 4, .2], [24, 14, 4, 3, -.2], [41, 8, 5, 3, .35],
  [57, 18, 8, 4, -.22], [73, 11, 4, 3, .12], [91, 8, 6, 4, .28],
  [111, 16, 5, 4, -.14], [128, 10, 9, 5, .18], [148, 20, 6, 4, -.08],
  [163, 11, 5, 4, .32], [181, 18, 8, 4, .12], [199, 12, 5, 3, -.15],
  [219, 20, 9, 5, .1], [242, 11, 6, 3, .3], [256, 23, 6, 5, -.18],
  [273, 14, 5, 4, .2], [295, 20, 8, 4, .12], [319, 12, 7, 3, -.1],
];
export function brokenConcrete(layer: PixelLayer, points: readonly Point[], start: Point, end: Point,
  tone: number, normal: Normal, depth = 34): void {
  const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
  layer.surface(points, (x, y) => {
    // Depth follows gravity, while the aggregate bed follows the exposed edge.
    const along = (x - start[0]) * dx / Math.max(.001, Math.abs(dx));
    const t = clamp((x - start[0]) / (dx || 1));
    const down = y - (start[1] + dy * t);
    const under = clamp(down / depth);
    let value = tone + cementBody(along, down) * 1.2 - under * .48;
    let n = unit([normal[0] + Math.sin(along * .083) * .1, normal[1], normal[2] + Math.cos(along * .071 + down * .18) * .16]);
    let material: Ink['material'] = 'concrete';
    let occlusion = .93 - under * .16;
    for (const [u, v, rx, ry, face] of aggregate) {
      const center = u * length / 320;
      const du = (Math.abs(along) - center) / rx, dv = (down - v * depth / 34) / ry;
      // Angular cut stone rather than circular pebbles pasted onto the surface.
      const d = Math.abs(du) * .75 + Math.abs(dv) * .9;
      if (d < .88) {
        material = face > .14 ? 'chalk' : 'concrete';
        const ridge = du * .42 - dv * .6;
        value = tone + face + (ridge > 0 ? .19 : -.31) - under * .28;
        n = unit([normal[0] + (ridge > 0 ? -.28 : .2), normal[1], normal[2] + (ridge > 0 ? .36 : -.16)]);
        occlusion = .96;
        break;
      }
      if (d < 1.02) { value -= .16; occlusion -= .1; }
    }
    return { material, tone: value, normal: n, roughness: .92,
      specular: material === 'chalk' ? .1 : .045, occlusion, light: .8 };
  });
}

/** A structural recess, with a broad occlusion rise instead of a black outline. */
export function recess(layer: PixelLayer, points: readonly Point[], tone: number, normal: Normal,
  origin: Point, width: number, height: number): void {
  layer.surface(points, (x, y) => {
    const u = clamp((x - origin[0]) / width), v = clamp((y - origin[1]) / height);
    const pocket = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
    return { material: 'concrete', tone: tone + cementBody(x, y) * .65,
      normal, roughness: .94, specular: .025,
      occlusion: .46 + pocket * .42, light: .65 };
  });
}
