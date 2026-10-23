/** Material grammar applied to anatomical supports, never to a world ID.
 * The caller owns silhouette, contact points and choreography. */
import { modelSeed, type createModelRaster, type ModelPoint as V } from './model-raster';
import { BODY_INKS } from './body-pixel-material';
import type { EnemyWorldAdaptation } from './world-adaptation';

export type TissueRaster = ReturnType<typeof createModelRaster>;
export const tissueAt = (p: V, x = 0, y = 0, z = 0): V => [p[0] + x, p[1] + y, p[2] + z];
const MID = BODY_INKS.hide[1], INNER = BODY_INKS.bone[2], DARK = BODY_INKS.soot[0];

/** All protrusions connect to the same underlying load. There is no scattering
 * of detached polygons and no frame-random geometry. */
export function tissueMass(r: TissueRaster, world: EnemyWorldAdaptation, p: V, radius: V, level: number, seed: number): void {
  const [x, y, z] = radius;
  const bias = (modelSeed(seed) % 100) / 100 - .5;
  const strength = .28 + level * .31;
  r.mass(p, [x * .78, y * .82, z * .82], MID);
  if (world.kind === 'fibre') {
    const count = Math.min(5, world.fibreCount);
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1) - .5) * 1.5;
      const a = tissueAt(p, t * x * .55, y * .12, -z * .78);
      const b = tissueAt(p, t * x, -y * .28 + t * y * .25, z * (.68 + strength * .35));
      r.tube(a, b, x * .26, x * (.23 + .03 * level), i === 0 ? DARK : MID);
    }
  } else if (world.kind === 'membrane') {
    r.volume([
      { at: tissueAt(p, -x * .16, y * .18, -z), rx: x * .38, ry: y * .5 },
      { at: tissueAt(p, x * .08, y * .12, -z * .46), rx: x, ry: y },
      { at: tissueAt(p, x * bias * strength, -y * .12, z * .38), rx: x * .87, ry: y * .8 },
      { at: tissueAt(p, -x * .2, -y * .24, z), rx: x * .32, ry: y * .5 },
    ], MID);
    r.tube(tissueAt(p, -x * .62, y * .3, z * .43), tissueAt(p, -x * .35, y * .6, -z * .6), .55, .9, INNER);
  } else if (world.kind === 'slab') {
    for (let i = 0; i < 3; i++) {
      const center = tissueAt(p, (i % 2 ? -.12 : .12) * x * strength, 0, (i - 1) * z * .52);
      r.volume([
        { at: tissueAt(center, 0, 0, -z * .34), rx: x * .73, ry: y * .78 },
        { at: center, rx: x * (1 - i * .06), ry: y * (1 - i * .04) },
        { at: tissueAt(center, -x * .08, -y * .1, z * .23), rx: x * .84, ry: y * .83 },
      ], MID);
    }
  } else if (world.kind === 'shell') {
    for (const side of [-1, 1]) {
      const center = tissueAt(p, side * x * .43, side * y * .17, side * z * .1);
      r.volume([
        { at: tissueAt(center, -side * x * .08, 0, -z * .82), rx: x * .38, ry: y * .72 },
        { at: center, rx: x * .66, ry: y * .88 },
        { at: tissueAt(center, side * x * .12, -y * .15, z * .84), rx: x * .24, ry: y * .5 },
      ], side < 0 ? MID : INNER);
    }
  } else if (world.kind === 'granular') {
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? -1 : 1, t = i / 4;
      const center = tissueAt(p, side * x * (.28 + bias * .15), (t - .5) * y * .6, (t - .5) * z * 1.2);
      r.mass(center, [x * (.64 - t * .12), y * .75, z * .57], i === 4 ? INNER : MID);
    }
  } else {
    r.volume([
      { at: tissueAt(p, x * .15, y * .16, -z), rx: x * .55, ry: y * .5 },
      { at: tissueAt(p, x * .1, y * .16, -z * .4), rx: x, ry: y },
      { at: tissueAt(p, -x * .12, 0, z * .5), rx: x * .75, ry: y * .78 },
      { at: tissueAt(p, -x * .22, -y * .12, z), rx: x * .32, ry: y * .4 },
    ], MID);
    r.tube(tissueAt(p, -x * .4, y * .38, z * .45), tissueAt(p, -x * .2, y * .65, -z * .62), .7, 1.25, INNER);
  }
}

/** Interior sag/lamination changes while endpoints remain attached. */
export function tissueTendon(r: TissueRaster, world: EnemyWorldAdaptation, a: V, b: V, radius: number, level: number): void {
  const mid: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - (world.kind === 'gel' || world.kind === 'membrane' ? .4 + level * .35 : 0)];
  r.tube(a, mid, radius, radius * 1.12, MID);
  r.tube(mid, b, radius * 1.12, radius * .72, MID);
  if (world.kind === 'fibre' && radius > 1.3) r.tube(tissueAt(a, -.45, .5), tissueAt(b, -.45, .5), .45, .4, INNER);
}
