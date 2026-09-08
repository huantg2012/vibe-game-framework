/** An unidentified organic load, not a second human or a bag with insect legs.
 * Thick bearing folds carry the mass; pollution rearranges the load-bearing
 * surfaces and eventually leaves an open mechanism around a recessed cavity. */
import { createModelRaster, modelProgress, modelSeed, smoothModel, type CreatureModelRequest, type CreatureModelResult, type CreaturePhase, type ModelPoint, type ModelColor } from './model-raster';

export type RemnantPhase = CreaturePhase;
export type RemnantModelRequest = CreatureModelRequest;
export const REMNANT_WALK_CYCLE_MS = 1540;
export const REMNANT_VARIANTS = ['folded-mantle', 'suspended-husk', 'shared-belly'] as const;
export const remnantVariantOf = (seed: number): number => modelSeed(seed ^ 0x32791) % REMNANT_VARIANTS.length;
const HUSK: ModelColor = [123, 111, 103];
const MEMBRANE: ModelColor = [151, 133, 117];
const UNDER: ModelColor = [51, 45, 45];
const RECAST: ModelColor = [83, 110, 103];
const RIDGE: ModelColor = [153, 157, 133];
const CLEFT: ModelColor = [44, 49, 43];

export function bakeRemnantModel(req: RemnantModelRequest): CreatureModelResult {
  const variant = remnantVariantOf(req.seed);
  const level = req.coverage === 'infiltrate' ? 0 : req.coverage === 'rewrite' ? 1 : 2;
  const p = modelProgress(req.phase01), cycle = p === 1 ? 0 : p;
  const gather = req.phase === 'windup' ? smoothModel(p) : 0;
  const hit = req.phase === 'strike' ? 1 - .2 * smoothModel(p) : req.phase === 'recover' ? .8 * (1 - smoothModel(p)) : 0;
  const breath = req.phase === 'idle' ? Math.sin(cycle * Math.PI * 2) * .42 : 0;
  const watch = req.phase === 'alert' ? .4 + Math.sin(cycle * Math.PI * 2) * .25 : 0;
  const walking = req.phase === 'walk';
  const sway = walking ? Math.sin(cycle * Math.PI * 2) : 0;
  const thrust = hit * 6.3 - gather * 2.8;
  const height = variant === 1 ? 13.7 : variant === 0 ? 9 : 11.7;
  const width = variant === 0 ? 12 : variant === 1 ? 7.5 : 11;
  const sink = gather * 2.2 + hit * 1.1;
  const h = height - sink + breath;
  const lift = (phase: number): number => walking ? Math.max(0, Math.sin(cycle * Math.PI * 2 + phase)) * 1.7 : 0;
  const twist = -gather * .42 + hit * .44;
  const r = createModelRaster(req, 'remnant', point => {
    if (twist === 0 || point[2] <= 2) return point;
    const angle = twist * Math.max(0, Math.min(1, (point[2] - 2) / 7));
    const c = Math.cos(angle), s = Math.sin(angle);
    return [point[0] * c - point[1] * s, point[0] * s + point[1] * c, point[2]];
  });

  // Three thick bearing folds with broad contact patches. Nothing hinges like
  // an arm, knee, or insect tarsus, and the silhouette carries no face.
  for (const i of [0, 1, 2]) {
    const side = i === 0 ? -1 : i === 1 ? 1 : .15;
    const rear = i === 2;
    const shiftedBearing = level === 1 && i === 0;
    const tip: ModelPoint = [side * (rear ? 2 : width + (shiftedBearing ? 2 : 0)), rear ? -9 : (shiftedBearing ? 2.5 : 7) + (walking ? sway * (i === 0 ? 1.8 : -1.8) : 0), .8 + lift(i * Math.PI * 2 / 3)];
    const middle: ModelPoint = [side * width * (shiftedBearing ? .95 : .68), rear ? -5 : (shiftedBearing ? -1 : 3) + thrust * .28, h * (shiftedBearing ? .68 : .47)];
    const root: ModelPoint = [side * width * .34, rear ? -2 : 1 + thrust * .3, h * .77];
    r.tube(tip, middle, variant === 1 ? 2 : 2.9, variant === 1 ? 2.6 : 3.8, level && i === 0 ? RECAST : HUSK);
    r.tube(middle, root, variant === 1 ? 2.6 : 3.8, 3.5, level === 2 ? RECAST : HUSK);
    r.mass([tip[0], tip[1] + .3, tip[2]], [rear ? 2.8 : 3.4, 3.5, .9], UNDER);
  }

  if (variant === 0) {
    // A flattened, lapped mantle: a broad back descends into two thick folds.
    // Middle: one compressed lobe hangs to the right of a raised bearing fold.
    // High: the thick mantle closes around an offset horizontal cleft; it is
    // deliberately not the beast's pair of open load-bearing arches.
    if (level < 2) r.mass([level ? 4.7 : 0, -1 + thrust * .45, h - (level ? 1.4 : 0)], [level ? 7.8 : width, level ? 6 : 7.5, 4.5], HUSK);
    else r.mass([0, -1.7 + thrust * .45, h + .7], [11.3, 7.4, 5.5], RECAST);
    for (const side of [-1, 1]) {
      const wrong = level && side === -1;
      const top: ModelPoint = [level === 2 ? side * 3.1 : side * (wrong ? 8 : 4.4), (wrong && level === 1 ? -4 : -2) + thrust * .65, h + (wrong && level === 1 ? 7 : level === 2 ? 4.6 : 2.4)];
      const front: ModelPoint = [side * (level === 2 ? 7.3 : 8.8), 7 + thrust, level === 2 ? 4.5 : 3.3];
      r.volume([
        { at: front, rx: 3.1, ry: 2.6 },
        { at: [top[0], top[1] + 2.5, top[2] - 3], rx: level === 2 ? 3 : 4.2, ry: 5.5 },
        { at: top, rx: level === 2 ? 1.5 : 2.6, ry: 4.8 },
      ], wrong || level === 2 ? RECAST : MEMBRANE);
      r.tube([top[0], top[1] - 3, top[2]], [top[0] + side * 1.2, top[1] + 3.5, top[2] - 1.5], .55, .6, level ? RIDGE : HUSK);
    }
    if (level === 1) r.tube([-8,3+thrust*.65,h-1],[3,6+thrust*.65,h-4],2.2,2.8,MEMBRANE);
    if (level === 2) {
      r.mass([2.3,5.7+thrust*.6,h-1.8],[6.2,1.6,1.1],CLEFT);
      r.tube([-3.8,7+thrust*.6,h-.9],[7.9,7+thrust*.6,h-3.2],1.05,1.2,MEMBRANE);
    }
  } else if (variant === 1) {
    // A heavy, oblique husk suspended above its contact folds. It has neither
    // a neck nor a head; its terminal planes are broad and uninterrupted.
    const coreX = level === 1 ? -3.2 : 0;
    if (level < 2) {
      r.volume([
        { at: [2, 2 + thrust * .3, 6 - sink], rx: 4.4, ry: 4 },
        { at: [coreX - 1.5, thrust * .65, h - 3], rx: 10, ry: 6.2 },
        { at: [coreX - 4.5, -2.2 + thrust * .8, h + 5.2], rx: 7.7, ry: 4.6 },
        { at: [coreX - 6, -3 + thrust * .8, h + 7], rx: 4.7, ry: 3.3 },
      ], level === 1 ? RECAST : HUSK);
      r.tube([coreX + 5.7, 2 + thrust * .7, h + 3], [2.5, 5 + thrust * .45, 7.3 - sink], 1.5, 1.1, MEMBRANE);
      r.tube([coreX + 5.5, 3 + thrust * .7, h + 1], [3.3, 5.7 + thrust * .45, 10 - sink], .48, .6, UNDER);
      if (level === 1) {
        r.mass([5, 3 + thrust, h - 5], [3.8, 4.5, 5], MEMBRANE);
        r.tube([-6.1, thrust * .6, h - 3], [-5.8, -2 + thrust * .7, h + 7], 1.2, 1.6, RIDGE);
      }
    } else {
      // The enclosing husk is still thick and closed above. Its two displaced
      // interior layers emerge through a diagonal lateral split, not a U-frame.
      r.volume([
        {at:[3,2+thrust*.45,5],rx:5.4,ry:4.8},
        {at:[-1,thrust*.65,h-1],rx:9,ry:6.3},
        {at:[-6,-2+thrust*.8,h+6.8],rx:5.7,ry:4.8},
        {at:[-5,-3+thrust*.8,h+8.2],rx:4.2,ry:3.8},
      ],RECAST);
      r.mass([5.8,3.5+thrust*.6,h-4],[4,2.7,4.1],CLEFT);
      r.volume([{at:[5.8,5.1+thrust*.6,6],rx:3.8,ry:2.6},{at:[2.8,4.5+thrust*.6,h+1],rx:3.8,ry:2.3}],MEMBRANE);
      r.tube([-3,4+thrust*.7,h+3],[6.7,5.8+thrust*.6,h-4],1.2,1.5,RIDGE);
    }
  } else {
    // Two offset loads share one broad belly. The asymmetry belongs to the
    // structure, rather than a randomly mirrored secondary head.
    if (level < 2) r.mass([level?3:0, -1 + thrust * .4, 6 - sink * .45], [level?7:10, 7, 3.7], HUSK);
    else r.mass([1,-.8+thrust*.5,8-sink*.4],[10.5,7.8,5],RECAST);
    const loads: readonly ModelPoint[] = [[level===1?-9:-5.8, (level===1?-5:-3) + thrust * .45, h + (level===1?6:level===2?2:0)], [level===1?7.3:5.3, (level===1?5.5:3.4) + thrust, h - (level===1?5.2:3.7)]];
    for (let i = 0; i < loads.length; i++) {
      const at = loads[i]!;
      const rewritten = level === 2 || level === 1 && i === 0;
      if (level < 2) r.mass(at, [i === 0 ? 6.6 : 5.8, i === 0 ? 5.2 : 6, i === 0 ? 6.5 : 4.9], rewritten ? RECAST : MEMBRANE);
      else r.mass([at[0],at[1],at[2]+.5],[6.9,i===0?5.8:6.4,i===0?5.7:4.2],RECAST);
      r.tube([at[0] - 2, at[1] + 3.8, at[2] + 3], [at[0] + 2.4, at[1] + 3.7, at[2] - 1], .8, .65, rewritten ? RIDGE : HUSK);
    }
    if (level === 1) r.tube([-8,-3+thrust*.5,h+3],[6,4+thrust*.7,5.4],2.4,3.1,MEMBRANE);
    if (level === 2) {
      r.mass([2.4,5.4+thrust*.6,8.5],[6.2,2,1.8],CLEFT);
      r.tube([-2.7,6.8+thrust*.6,10.7],[8,6.8+thrust*.6,6.9],1.2,1.45,MEMBRANE);
    }
  }
  // The load is layered tissue, not a stone with legs: broad turned hems cross
  // the silhouette and fold into each other. Each main shape has a different
  // seam direction, while the middle tier retains its still-readable old lobe.
  if (variant === 0) {
    for (const side of [-1, 1]) {
      const foldX = side * (level === 1 && side === -1 ? 7.6 : 8.1);
      const foldZ = h + (level === 1 && side === -1 ? 3.2 : .5);
      const a: ModelPoint = [foldX, -3.6 + thrust * .45, foldZ];
      const b: ModelPoint = [foldX + side * 1.7, .8 + thrust * .65, foldZ - 1.1];
      const c: ModelPoint = [side * 6.8, 4.7 + thrust * .8, foldZ - 3.4];
      r.tube(a, b, 1.8, 2.3, level === 2 ? RECAST : HUSK);
      r.tube(b, c, 2.3, .8, level === 2 ? RECAST : MEMBRANE);
      r.tube([a[0],a[1]+.6,a[2]-.7],[b[0],b[1]+.6,b[2]-.7],.5,.65,UNDER);
    }
  } else if (variant === 1) {
    const off = level === 1 ? -3.2 : 0;
    for (let seam = 0; seam < 3; seam++) {
      const z = h - 2 + seam * 3;
      const x = off - 2.8 - seam;
      // The front membrane folds over a darker slit; uneven edges remain
      // thick enough to read in the native 1 px raster and under dark fog.
      r.tube([x-3.2,3.5+thrust*.65,z+1],[x+2.6,5+thrust*.65,z-1.2],.65,.85,UNDER);
      r.tube([x-2.7,3.7+thrust*.65,z+1.7],[x+2.3,5.1+thrust*.65,z-.3],.9,1.3,level===2?RIDGE:MEMBRANE);
    }
  } else {
    for (const side of [-1,1]) {
      const x = side * 6.5;
      const z = h + (side === -1 ? 1 : -4);
      r.mass([x,1.5+thrust*.6,z],[2.5,4.1,2.6],level===2?RECAST:HUSK);
      r.tube([x-1.5,4.2+thrust*.65,z+.2],[x+1.4,4.8+thrust*.65,z-1],.65,.8,UNDER);
      r.tube([x-1.3,4.2+thrust*.65,z+1.2],[x+1.6,4.7+thrust*.65,z+.2],.75,1,level===2?RIDGE:MEMBRANE);
    }
  }

  // The sole forward aperture opens with the attack. At rest it is a recessed
  // overlap, not an eye, mouth full of teeth, or an emissive target sticker.
  const rimZ = variant === 1 ? 8 : 3.8;
  r.mass([0, 6.5 + thrust + watch, rimZ - sink * .2], [3.6 + hit * .9, 1.7, 1.2], CLEFT);
  r.tube([-3.7 - hit, 7.7 + thrust, rimZ - sink * .2 + 1.1], [3.3 + hit, 7.7 + thrust, rimZ - sink * .2 + 1.1], .7, .65, level === 2 ? RIDGE : MEMBRANE);
  r.finish();
  return { buf: r.buf, canvas: r.canvas };
}
