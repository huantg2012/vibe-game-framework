/** A continuous, weight-bearing segment chain. Pollution changes how adjacent
 * sections fit and which surface is inside; it never adds legs or noisy rays. */
import { createModelRaster, modelProgress, modelSeed, smoothModel, type CreatureModelRequest, type CreatureModelResult, type CreaturePhase, type ModelPoint, type ModelColor } from './model-raster';

export type WormPhase = CreaturePhase;
export type WormModelRequest = CreatureModelRequest;
export const WORM_WALK_CYCLE_MS = 1320;
export const WORM_VARIANTS = ['drawn-chain', 'returning-hook', 'raised-fold'] as const;
export const wormVariantOf = (seed: number): number => modelSeed(seed ^ 0x71bd) % WORM_VARIANTS.length;
const BODY: ModelColor = [117, 108, 96];
const RING: ModelColor = [158, 143, 119];
const UNDER: ModelColor = [47, 44, 47];
const RECAST: ModelColor = [83, 110, 103];
const INNER: ModelColor = [128, 149, 130];
const SLIT: ModelColor = [150, 165, 151];

export function bakeWormModel(req: WormModelRequest): CreatureModelResult {
  const r = createModelRaster(req, 'worm');
  const variant = wormVariantOf(req.seed);
  const level = req.coverage === 'infiltrate' ? 0 : req.coverage === 'rewrite' ? 1 : 2;
  const p = modelProgress(req.phase01), cycle = p === 1 ? 0 : p;
  const gather = req.phase === 'windup' ? smoothModel(p) : 0;
  const hit = req.phase === 'strike' ? 1 - .2 * smoothModel(p) : req.phase === 'recover' ? .8 * (1 - smoothModel(p)) : 0;
  const breathe = req.phase === 'idle' ? Math.sin(cycle * Math.PI * 2) * .22 : 0;
  const watch = req.phase === 'alert' ? .6 + Math.sin(cycle * Math.PI * 2) * .25 : 0;
  const walking = req.phase === 'walk';
  const count = variant === 0 ? 10 : 9;
  const points: ModelPoint[] = [];
  const radii: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    let x: number, y: number, z: number;
    if (variant === 0) {
      x = Math.sin(t * Math.PI * 1.6) * 2.1;
      y = -18 + t * 32;
      z = 3.3 + Math.sin(t * Math.PI) * 1.1;
    } else if (variant === 1) {
      // A broad return bend: tail sits beside the middle, while the forward
      // end still defines the same committed attack direction in every facing.
      const a = -Math.PI * .8 + t * Math.PI * 1.3;
      x = Math.cos(a) * 9 - 3;
      y = Math.sin(a) * 10 + 2;
      z = 3.2 + Math.sin(t * Math.PI) * 1.8;
    } else {
      x = Math.sin(t * Math.PI * 1.8) * 5.2;
      y = -11 + t * 23;
      z = 3.5 + Math.sin(t * Math.PI) * 9;
    }
    const wave = Math.sin(cycle * Math.PI * 2 - t * Math.PI * 2);
    const baseWave = Math.sin(-t * Math.PI * 2);
    // The travelling compression moves individual sections. The low belly
    // sections remain in contact; this is a crawl, not a sliding ribbon.
    if (walking) {
      y += (wave - baseWave) * 1.05;
      z += Math.max(0, wave) * 1.55;
    }
    const front = Math.max(0, (t - .46) / .54);
    y += hit * front * 5.3 - gather * front * 4;
    z += gather * Math.sin(t * Math.PI) * 3 + watch * front + breathe;
    if (level === 1) {
      x += Math.sin(t * Math.PI * 2) * 2.4;
      z += t > .35 && t < .8 ? 2.4 : 0;
    } else if (level === 2) {
      x += Math.sin(t * Math.PI * 2) * (variant === 1 ? 2.7 : 3.8);
      z += Math.sin(t * Math.PI) * 4;
    }
    points.push([x, y, z]);
    const bodyRadius = variant === 2 ? 4.2 : variant === 1 ? 3.4 : 3.1;
    radii.push(bodyRadius * (.65 + Math.sin(t * Math.PI) * .35) + (level === 1 && i >= 3 && i <= 6 ? .8 : 0));
  }
  // A narrow connecting body stays behind the individual sleeves. In the
  // high tier it is recessed, so the outer profile reads as overlapping folds.
  for (let i = 1; i < count; i++) r.tube(points[i - 1]!, points[i]!, radii[i - 1]! * .72, radii[i]! * .72, level === 2 ? UNDER : BODY);

  for (let i = 0; i < count; i++) {
    const at = points[i]!, rad = radii[i]!;
    const prev = points[Math.max(0, i - 1)]!, next = points[Math.min(count - 1, i + 1)]!;
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const n = Math.hypot(dx, dy) || 1, nx = -dy / n, ny = dx / n;
    if (level === 0 || level === 1 && (i < 3 || i > 6)) {
      // Thick, dry sleeves leave a dark segment gap with a narrow upper ridge.
      r.mass(at, [rad, rad * .86, rad * .9], BODY);
      r.tube([at[0] + nx * rad * .8, at[1] + ny * rad * .8, at[2] + rad * .15], [at[0], at[1], at[2] + rad], .5, .65, RING);
      r.tube([at[0], at[1], at[2] + rad], [at[0] - nx * rad * .8, at[1] - ny * rad * .8, at[2] + rad * .15], .65, .5, RING);
    } else {
      // The sleeve turns inside out into two offset overlapping blades. Their
      // valley follows the original chain, retaining order without a worm face.
      const sideBias = i % 2 === 0 ? -1 : 1;
      const height = level === 2 ? rad * 1.55 : rad * 1.15;
      const shoulder = level === 2 ? rad * 1.45 : rad * 1.12;
      for (const side of [-1, 1]) {
        const root: ModelPoint = [at[0] + nx * side * rad * .25, at[1] + ny * side * rad * .25, at[2] - rad * .55];
        const crown: ModelPoint = [at[0] + nx * side * shoulder, at[1] + ny * side * shoulder, at[2] + height * (side === sideBias ? 1 : .64)];
        r.volume([
          { at: root, rx: rad * .48, ry: rad * .59 },
          { at: [crown[0], crown[1], crown[2] - 1.4], rx: rad * .54, ry: rad * .74 },
          { at: crown, rx: rad * .19, ry: rad * .45 },
        ], RECAST);
        r.tube([crown[0], crown[1] - rad * .32, crown[2]], [crown[0], crown[1] + rad * .36, crown[2]], .45, .55, INNER);
      }
    }
  }
  const head = points[count - 1]!;
  if (level < 2) {
    r.mass([head[0], head[1] + 1.1, head[2] + .1], [2.2, 2.3, 1.9], level ? RECAST : RING);
    r.tube([head[0] - 1.4, head[1] + 2.9, head[2]], [head[0] + 1.4, head[1] + 2.9, head[2]], .48, .48, UNDER);
  } else {
    // The front end has become an opening between two sleeves, not a head.
    for (const side of [-1, 1]) r.tube([head[0] + side * 1.8, head[1] - 1, head[2] - .5], [head[0] + side * (2.3 + hit), head[1] + 2.5, head[2] + 2.5], 1.5, .95, RECAST);
    r.tube([head[0] - 1.3, head[1] + 1.7, head[2]], [head[0] + 1.3, head[1] + 1.7, head[2]], .45, .45, SLIT);
  }
  r.finish();
  return { buf: r.buf, canvas: r.canvas };
}
