/** Mammalian load paths survive the first rewrite, then become a different
 * mechanism: an articulated forebody carried between incompatible shoulders.
 * No generic appendage operators or post-raster body deformation. */
import { createModelRaster, modelProgress, modelSeed, smoothModel, type CreatureModelRequest, type CreatureModelResult, type CreaturePhase, type ModelPoint, type ModelColor } from './model-raster';

export type BeastPhase = CreaturePhase;
export type BeastModelRequest = CreatureModelRequest;
export const BEAST_WALK_CYCLE_MS = 880;
export const BEAST_VARIANTS = ['low-slung', 'high-haunch', 'broad-shoulder'] as const;
export const beastVariantOf = (seed: number): number => modelSeed(seed) % BEAST_VARIANTS.length;
const HIDE: ModelColor = [113, 106, 91];
const BONE: ModelColor = [162, 146, 116];
const RECAST: ModelColor = [85, 107, 103];
const CLEFT: ModelColor = [39, 46, 45];
const SEAM: ModelColor = [123, 160, 144];

export function bakeBeastModel(req: BeastModelRequest): CreatureModelResult {
  const r = createModelRaster(req, 'beast');
  const variant = beastVariantOf(req.seed);
  const level = req.coverage === 'infiltrate' ? 0 : req.coverage === 'rewrite' ? 1 : 2;
  const p = modelProgress(req.phase01), cycle = p === 1 ? 0 : p;
  const gather = req.phase === 'windup' ? smoothModel(p) : 0;
  const hit = req.phase === 'strike' ? 1 - .2 * smoothModel(p) : req.phase === 'recover' ? .8 * (1 - smoothModel(p)) : 0;
  const breath = req.phase === 'idle' ? Math.sin(cycle * Math.PI * 2) * .35 : 0;
  const watch = req.phase === 'alert' ? .6 + Math.sin(cycle * Math.PI * 2) * .3 : 0;
  const walking = req.phase === 'walk';
  const bodyLength = variant === 0 ? 18 : variant === 1 ? 12.5 : 12;
  const shoulderWidth = variant === 2 ? 8.5 : variant === 1 ? 4.3 : 5;
  const height = variant === 1 ? 19 : variant === 2 ? 12.5 : 9.7;
  const stride = variant === 1 ? 4 : variant === 0 ? 3.7 : 2.6;
  const sink = gather * 2.3 + hit * 1.4;
  const thrust = hit * 5 - gather * 2;
  const backY = -bodyLength * .46;
  const foreY = bodyLength * .36 + thrust;
  const bob = walking ? Math.sin(cycle * Math.PI * 4) * .4 : breath;
  const h = height - sink + bob;
  const shift = level === 1 ? -3.2 : level === 2 ? -2.5 : 0;

  // Four rooted, jointed limbs. Forelimbs and hindlimbs have different bends;
  // the heavy forebody stays supported while a diagonal pair leaves the floor.
  for (const fore of [false, true]) for (const side of [-1, 1]) {
    const phase = (cycle + (fore ? side === -1 ? 0 : .5 : side === -1 ? .5 : 0)) % 1;
    const stance = phase < .64;
    const swing = (phase - .64) / .36;
    const step = walking ? stance ? stride - phase / .64 * stride * 2 : -stride + smoothModel(swing) * stride * 2 : 0;
    const lift = walking && !stance ? Math.sin(swing * Math.PI) * (variant === 1 ? 3 : 2) : 0;
    const hipX = side * (fore ? shoulderWidth * .77 : variant === 2 ? 4.1 : 3.6) + (fore ? shift : 0);
    const hipY = fore ? foreY : backY;
    const foot: ModelPoint = [side * (fore ? shoulderWidth + (level ? 1.8 : .8) : variant === 2 ? 5.7 : 4.2), (fore ? bodyLength * .5 + hit * 3 : backY - 2) + step, .9 + lift];
    const joint: ModelPoint = [hipX + side * (level === 2 && fore ? 2.3 : .8), hipY + (fore ? -2.7 : 2.9) + step * .26, h * (fore ? .42 : .5) + lift * .25];
    const hip: ModelPoint = [hipX, hipY, h - (fore ? level * 1.4 : 1.2)];
    r.tube(foot, joint, fore && level === 2 ? 2.2 : 1.3, fore ? 1.8 : 1.6, level && fore ? RECAST : HIDE);
    r.tube(joint, hip, fore ? 1.9 : 1.6, fore ? variant === 2 ? 3.1 : 2.3 : 2.1, level && fore ? RECAST : HIDE);
    r.mass([foot[0], foot[1] + .65, foot[2]], [1.7, fore ? 2.5 : 2, .8], CLEFT);
    if (level === 1 && fore && side === -1) r.tube(joint, [hipX - 2, hipY - 2, h + 4], 1.8, 2.1, RECAST);
  }

  const pelvis: ModelPoint = [0, backY, h - .5];
  const shoulder: ModelPoint = [shift, foreY - 1, h + (level === 1 ? 2 : 0)];
  r.mass(pelvis, [variant === 2 ? 4.4 : 4, 5.1, variant === 1 ? 4 : 3.1], HIDE);
  if (level < 2) {
    // A visible belly gap makes the four-point stance read at native scale.
    r.mass([shift * .4, (backY + foreY) * .5, h], [shoulderWidth * .85, bodyLength * .47, variant === 2 ? 4.8 : 3.3], HIDE);
    r.mass(shoulder, [shoulderWidth, 5.4, level === 1 ? 5.6 : variant === 2 ? 5.1 : 3.6], level === 1 ? RECAST : HIDE);
    // Ribs are a few structural ridges on a volume, never a noise fill.
    for (let rib = 0; rib < 3; rib++) {
      const y = foreY - 1 - rib * 2.7;
      r.tube([shift * .6 - shoulderWidth * .55, y, h + 2.5], [shift * .6, y - .5, h + 4], .48, .65, BONE);
      r.tube([shift * .6, y - .5, h + 4], [shift * .6 + shoulderWidth * .55, y, h + 2.5], .65, .48, BONE);
    }
  } else {
    // A paired load-bearing vault replaces the continuous animal torso. The
    // central slot remains genuinely empty; this is not a bright-eyed beast.
    for (const side of [-1, 1]) {
      const bottom: ModelPoint = [side * (shoulderWidth - .6), foreY + 1, h * .36];
      const crown: ModelPoint = [side * (shoulderWidth + .8), foreY - 3, h + (side === -1 ? 7 : 4.5)];
      const rear: ModelPoint = [side * 2.9, backY, h - 1];
      r.tube(bottom, crown, 2.8, variant === 2 ? 3.7 : 3.1, RECAST);
      r.tube(crown, rear, variant === 2 ? 3.7 : 3.1, 2.8, RECAST);
      r.tube([crown[0], crown[1] - .6, crown[2] + 1.1], [rear[0], rear[1], rear[2] + 1.5], .6, .75, BONE);
    }
    r.mass([1.6, foreY + 2.5 + hit * 2, h * .6], [shoulderWidth * .57, 3.7, 2.3], CLEFT);
    r.tube([-shoulderWidth * .4, foreY + 5 + hit * 2, h * .62], [shoulderWidth * .35, foreY + 5 + hit * 2, h * .62], .6, .65, SEAM);
  }

  if (level < 2) {
    // No expressive eyes, teeth or ears: the familiar head is an erased plane.
    const head: ModelPoint = [level === 1 ? 2.4 : 0, foreY + 6.1 + watch + hit * 1.6, h - 1.5 - level * 2.5];
    r.tube([shift, foreY + 1.3, h + .2], head, 3.1, level === 1 ? 2 : 2.6, HIDE);
    r.mass(head, [level === 1 ? 2.5 : 3.1, 3.6, 2.7], BONE);
    r.mass([head[0], head[1] + 2.5, head[2] - 1.1], [2.1, 2.4, 1.4], HIDE);
    r.tube([head[0] - 1.7, head[1] + 4, head[2] - 1], [head[0] + 1.7, head[1] + 4, head[2] - 1], .45, .45, CLEFT);
    if (level === 1) {
      // The shifted shoulder outgrows the old head; a second, silent opening
      // begins where the animal's neck should have been.
      r.mass([-4.4, foreY + 2, h + 5.5], [3.4, 4, 2.8], RECAST);
      r.tube([-6, foreY + 5.2, h + 5.2], [-2.5, foreY + 5.2, h + 5.2], .5, .5, CLEFT);
    }
  }
  // The shoulder hide is carried in overlapping scutes rather than a single
  // faceted dome. Short recessed seams stop before the silhouette; the crown
  // remains a coarse, continuous mass with no decorative particle fringe.
  for (const side of [-1, 1]) {
    const x = shift + side * shoulderWidth * .78;
    const a: ModelPoint = [x, foreY - 3.2, h + (level === 2 ? 1.2 : 2.6)];
    const b: ModelPoint = [x + side * .8, foreY, h + (level === 2 ? .2 : 1.1)];
    r.tube(a, b, 1.3, 1.8, level ? RECAST : HIDE);
    r.tube([a[0],a[1]+.4,a[2]-.6],[b[0],b[1]+.4,b[2]-.6],.45,.55,CLEFT);
  }
  // Each silhouette retains a different amount of rear mass, not cosmetic skin.
  if (variant === 0 && level < 2) {
    const tail: ModelPoint = [2.5 + (walking ? Math.sin(cycle * Math.PI * 2) : 0), -20.3, 3.4];
    r.tube([0, backY - 2, h], [1.7, -16.2, 5.7], 1.6, 1.1, HIDE);
    r.tube([1.7, -16.2, 5.7], tail, 1.1, .55, BONE);
  } else if (variant === 1) {
    r.mass([0, backY - 1.5, h + 2.3], [3, 3.4, level === 2 ? 4.7 : 3.8], level === 2 ? RECAST : HIDE);
  } else if (level > 0) {
    r.mass([2.2, backY - 1, h + 2], [4.7, 3.4, 3.3], RECAST);
  }
  r.finish();
  return { buf: r.buf, canvas: r.canvas };
}
