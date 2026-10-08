/** Coarse plant fibres carry weight from a rooted base into dense stem bundles.
 * Turning/attacking does not move the rooted foot; only walking transfers the
 * contact patches. Pollution folds the grain and reconnects its growth planes. */
import { createModelRaster, modelProgress, modelSeed, smoothModel, type CreatureModelRequest, type CreatureModelResult, type CreaturePhase, type ModelPoint, type ModelColor } from './model-raster';

export type GrowthPhase = CreaturePhase;
export type GrowthModelRequest = CreatureModelRequest;
export const GROWTH_WALK_CYCLE_MS = 1880;
export const GROWTH_VARIANTS = ['bound-column', 'fallen-fan', 'split-stump'] as const;
export const growthVariantOf = (seed: number): number => modelSeed(seed ^ 0xa92c1) % GROWTH_VARIANTS.length;
const BARK: ModelColor = [113, 107, 88];
const FIBRE: ModelColor = [163, 150, 118];
const ROOT: ModelColor = [66, 67, 53];
const GROOVE: ModelColor = [48, 53, 47];
const RECAST: ModelColor = [99, 113, 106];
const END: ModelColor = [159, 174, 151];

export function bakeGrowthModel(req: GrowthModelRequest): CreatureModelResult {
  const variant = growthVariantOf(req.seed);
  const level = req.coverage === 'infiltrate' ? 0 : req.coverage === 'rewrite' ? 1 : 2;
  const p = modelProgress(req.phase01), cycle = p === 1 ? 0 : p;
  const gather = req.phase === 'windup' ? smoothModel(p) : 0;
  const hit = req.phase === 'strike' ? 1 - .2 * smoothModel(p) : req.phase === 'recover' ? .8 * (1 - smoothModel(p)) : 0;
  const sway = req.phase === 'idle' ? Math.sin(cycle * Math.PI * 2) * .55 : 0;
  const watch = req.phase === 'alert' ? .5 + Math.sin(cycle * Math.PI * 2) * .3 : 0;
  const walking = req.phase === 'walk';
  const stride = walking ? Math.sin(cycle * Math.PI * 2) : 0;
  const forward = hit * 8 - gather * 3.5 + watch;
  const drop = hit * 5 + gather * 1.7;
  const width = variant === 1 ? 10.5 : variant === 2 ? 7.7 : 5.7;
  const twist = -gather * .42 + hit * .5;
  const r = createModelRaster(req, 'growth', point => {
    if (twist === 0 || point[2] <= 2) return point;
    const angle = twist * Math.max(0, Math.min(1, (point[2] - 2) / 9));
    const c = Math.cos(angle), s = Math.sin(angle);
    return [point[0] * c - point[1] * s, point[0] * s + point[1] * c, point[2]];
  });

  // Four coarse buttresses ground every shape. They do not scale or translate
  // with the upper growth, including windup and the exact attack contact pose.
  for (const side of [-1, 1]) for (const front of [-1, 1]) {
    const step = walking ? stride * side * front : 0;
    const foot: ModelPoint = [side * (width + 1.1), front * (variant === 1 ? 6.5 : 7.5) + step * 1.7, .6 + Math.max(0, step) * 1.5];
    const root: ModelPoint = [side * 3.3, front * 2.5, 5];
    r.tube(foot, root, 1.6, 2.5, ROOT);
    r.tube([foot[0], foot[1], foot[2] + .6], [root[0], root[1], root[2] + .8], .45, .55, BARK);
    r.mass(foot, [2.2, 2.5, .65], GROOVE);
  }
  r.mass([0, 0, 4], [variant === 1 ? 7.5 : 5.8, 5.5, 3.4], BARK);

  /** One contiguous thick bundle, with grain following its bent structural
   * axis. Surface fibres are sparse, long and parallel rather than noise. */
  function bundle(base: ModelPoint, middle: ModelPoint, tip: ModelPoint, radius: number, altered: boolean, flattened = false): void {
    const color = altered ? RECAST : BARK;
    const ry = flattened ? radius * .56 : radius * .85;
    r.volume([
      { at: base, rx: radius * .8, ry: ry * .9 },
      { at: middle, rx: radius, ry },
      { at: tip, rx: radius * .73, ry: ry * .83 },
    ], color);
    // A broken, pale end grain remains a closed cut surface, not light.
    r.volume([
      { at: [tip[0], tip[1], tip[2] - .35], rx: radius * .7, ry: ry * .78 },
      { at: [tip[0] - .3, tip[1], tip[2] + .75], rx: radius * .5, ry: ry * .55 },
    ], altered ? END : FIBRE);
    // Split end-fibres interrupt the old perfect bevel. Three short nested
    // cuts establish a torn bundle without spraying detached pixels around it.
    for (const splinter of [-1, 1]) {
      const x = tip[0] + splinter * radius * .36;
      r.tube([x,tip[1]+ry*.28,tip[2]-.7],[x+splinter*.28,tip[1]+ry*.08,tip[2]+.75],.55,.4,altered?END:FIBRE);
    }
    for (const offset of [-.48, .2]) {
      const a: ModelPoint = [base[0] + radius * offset, base[1] + ry * .9, base[2] + 1];
      const b: ModelPoint = [middle[0] + radius * offset, middle[1] + ry, middle[2]];
      const c: ModelPoint = [tip[0] + radius * offset * .7, tip[1] + ry * .79, tip[2] - 1];
      r.tube(a, b, .4, .55, offset < 0 ? altered ? END : FIBRE : GROOVE);
      r.tube(b, c, .55, .4, offset < 0 ? altered ? END : FIBRE : GROOVE);
    }
  }

  if (variant === 0) {
    // A compact vertical bundle. Individual stems share a substantial base,
    // avoiding the old collection of floating one-pixel sticks.
    const heights = [25.7, 30, 21.5];
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 3.2;
      const altered = level === 2 || level === 1 && i === 0;
      const bend = level === 1 && i === 0 ? -5.7 : level === 2 ? (i - 1) * 5 : 0;
      const tipZ = heights[i]! - drop - (level === 2 && i === 1 ? 8 : 0);
      bundle([x * .5, 0, 4.5], [x + bend * .55, forward * .44, 14 - drop * .3], [x + bend + sway + stride * .55, 1 + forward + (level === 1 && i === 0 ? 2.3 : 0), tipZ], level === 1 && i === 0 ? 4.3 : i === 1 ? 3.4 : 2.8, altered, level === 2);
    }
    if (level > 0) {
      // An impossible transverse join redirects the original parallel grain.
      r.tube([-6.3, forward * .55, 16 - drop * .4], [4.4, forward * .7, 20 - drop * .5], 2.1, 2.4, RECAST);
    }
  } else if (variant === 1) {
    // A low, broad fan of folded fibres rather than a miniature tree crown.
    for (let i = 0; i < 3; i++) {
      const side = i - 1;
      const altered = level === 2 || level === 1 && i === 2;
      const sideShift = level === 1 && i === 2 ? -8 : 0;
      const tipX = side * (level === 2 ? 9 : 10.3) + sideShift + sway * .5;
      const tipY = (level === 1 && i === 2 ? 5.2 : i === 1 ? -3 : 1.5) + forward;
      const tipZ = (i === 1 ? 18 : 13) + (level && i === 2 ? level === 1 ? 7 : 4 : 0) - drop * .67;
      bundle([side * 2.2, -2, 4.3], [side * 6 + sideShift * .5, -1 + forward * .4, 9], [tipX, tipY, tipZ], level === 1 && i === 2 ? 5.6 : i === 1 ? 4.4 : 4.1, altered, true);
    }
    if (level === 2) {
      // The middle fold turns back into the base, leaving two tall side blades
      // framing a broad, hollow growing surface.
      r.tube([-7, 1 + forward * .6, 11], [1.5, 4 + forward * .8, 7], 2.2, 3.2, RECAST);
      r.tube([1.5, 4 + forward * .8, 7], [7.5, 1 + forward * .6, 12], 3.2, 2.1, RECAST);
    }
  } else {
    // A massive truncated stump, split into uneven planes. Three interlocked
    // lobes keep a short, broad signature all the way to the final coverage.
    for (let i = 0; i < 3; i++) {
      const side = i - 1;
      const altered = level === 2 || level === 1 && i === 0;
      const x = side * 4.5;
      const tipZ = (i === 0 ? 17.5 : i === 1 ? 11.8 : 14.5) + (level === 1 && i === 0 ? 4 : 0) - drop * .55;
      const tipX = x + (level === 2 ? side * 3.4 : level === 1 && i === 0 ? 3 : 0) + sway * .4;
      bundle([x * .6, i === 1 ? 2 : -1.4, 3.5], [x, forward * .35, 8], [tipX, forward + (i === 1 ? 3 : -1.3), tipZ], i === 1 ? 4.3 : 3.8, altered);
    }
    if (level > 0) r.tube([-6, forward * .6, 13], [6, forward * .6, 8], level === 2 ? 2.5 : 1.7, 2, RECAST);
  }
  r.finish();
  return { buf: r.buf, canvas: r.canvas };
}
