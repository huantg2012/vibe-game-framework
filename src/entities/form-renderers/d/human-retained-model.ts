/** Human-readable anatomy study. Uses the production pixel raster, material and
 * lighting pipeline. Not selected by any gameplay request until art approval. */
import type { HumanModelRequest } from './human-model';
import { createModelRaster, modelSeed, type ModelPoint as V } from './model-raster';
import type { EnemyWorldAdaptation } from './world-adaptation';

// These identify the existing ink roles; bodyInk maps them to the frozen world palette.
const CLOTH = [48, 43, 44] as const, FLESH = [159, 145, 121] as const;
const DARK = [48, 43, 44] as const, TISSUE = [83, 110, 103] as const;
const smooth = (p: number) => p * p * (3 - 2 * p);
const shift = (p: V, x: number, y: number, z: number): V => [p[0] + x, p[1] + y, p[2] + z];
const between = (a: V, b: V, t: number): V => a.map((v, i) => v * (1 - t) + b[i]! * t) as unknown as V;
type Raster = ReturnType<typeof createModelRaster>;

/** Materials grow along one human ribcage/upper arm, never across the neck,
 * armpit or leg gap. More invasion changes anatomy without deleting a limb. */
function tissue(r: Raster, world: EnemyWorldAdaptation, bottom: V, top: V, width: number, depth: number, strength: number, seed: number, response: number): void {
  const { tube, volume, face } = r;
  if (world.kind === 'fibre') {
    const count = Math.max(2, Math.round(world.fibreCount * (.5 + strength * .5)));
    for (let i = 0; i < count; i++) {
      const offset = (i / (count - 1) - .5) * width * 1.4;
      tube(shift(bottom, offset * .35, depth, 0), shift(top, offset, depth, -.3 + i % 2 * .6), .4 + strength * .3, .65 + strength * .45, TISSUE);
    }
  } else if (world.kind === 'membrane') {
    const l = shift(top, -width * .8, depth, 0), right = shift(top, width * .7, depth, -.9);
    const fold = shift(between(bottom, top, .48), -.5 + seed, depth + .6 + response * .2, -.7);
    face([bottom, fold, l], TISSUE); face([l, fold, right], CLOTH); face([right, fold, bottom], TISSUE);
    tube(bottom, fold, .4, .6 + strength * .45, TISSUE);
  } else if (world.kind === 'slab') {
    for (let i = 0; i < 2 + Math.floor(strength * 2); i++) {
      const t = (i + 1) / (3 + Math.floor(strength * 2)), at = shift(between(bottom, top, t), (i % 2 ? -1 : 1) * .35, depth, 0);
      volume([{ at: shift(at, 0, 0, -1), rx: width * .65, ry: .65 }, { at, rx: width, ry: 1.2 }, { at: shift(at, -.4, -.2, .85), rx: width * .8, ry: .8 }], TISSUE);
    }
  } else if (world.kind === 'shell') {
    const at = shift(between(bottom, top, .64), -.4, depth, 0);
    volume([{ at: bottom, rx: width * .35, ry: .65 }, { at, rx: width, ry: 1.4 + strength }, { at: shift(top, -.5, depth - .2, .3), rx: width * .7, ry: 1.1 }], TISSUE);
    tube(shift(bottom, -.6, depth + 1.3, 1), shift(top, -.7, depth + 1.3, 0), .4, .6, DARK);
  } else if (world.kind === 'granular') {
    for (let i = 0; i < 2 + Math.floor(strength * 3); i++) {
      const t = (i + 1) / (3 + Math.floor(strength * 3)), at = shift(between(bottom, top, t), (i % 2 ? 1 : -1) * width * .4, depth, 0);
      const size = .85 + strength * .85 + (i % 3) * .2;
      r.mass(at, [Math.min(width, size), size * .8, size * 1.2], TISSUE);
    }
  } else {
    const middle = shift(between(bottom, top, .45), .3, depth + .2 + response * .2, -.7 * strength);
    tube(top, middle, width * .7, width, TISSUE);
    tube(middle, bottom, width, width * .45, TISSUE);
  }
}

export function bakeRetainedHumanModel(req: HumanModelRequest) {
  const r = createModelRaster(req, 'human-retained');
  const { volume, tube } = r, world = req.worldAdaptation;
  const level = req.coverage === 'infiltrate' ? 0 : req.coverage === 'rewrite' ? 1 : 2;
  const strength = [.2, .6, 1][level]!;
  const individual = modelSeed(req.seed) / 0xffffffff;
  const p = Math.max(0, Math.min(1, Number.isFinite(req.phase01) ? req.phase01 : 0));
  const cycle = (p === 1 ? 0 : p) * Math.PI * 2;
  const gait = req.phase === 'walk' ? Math.sin(cycle) : 0;
  const breath = req.phase === 'idle' ? Math.sin(cycle) * .16 : 0;
  const gather = req.phase === 'windup' ? smooth(p) : 0;
  const hit = req.phase === 'strike' ? 1 - .2 * smooth(p) : req.phase === 'recover' ? .8 * (1 - smooth(p)) : 0;
  const watch = req.phase === 'alert' ? .5 - .5 * Math.cos(p * Math.PI * 2) : 0;
  const sink = gather * 2.5 + hit * 2 + Math.abs(gait) * .5;
  const thrust = hit * 9 - gather * 2 + gait * .4;
  const pelvis: V = [0, thrust * .28, 14.5 - sink + Math.abs(gait) * .4];
  const waist: V = [-.2 - level * .45, 1 + thrust * .5, 18 - sink];
  const chest: V = [-.4 - level * 1.05, 1.7 + level * .95 + thrust, 24.4 - level * .65 - sink + breath];
  const crown: V = [chest[0] + .3 + (individual - .5) * .7, chest[1] + 1 + level * .45 + watch, chest[2] + 9.6 - level * .2];
  const contacts: { x: number; y: number; weight: number }[] = [];
  const angle = { down: 0, left: Math.PI / 2, up: Math.PI, right: -Math.PI / 2 }[req.facing4];
  for (const side of [-1, 1]) {
    const step = gait * side, lift = Math.max(0, step) * 2.2;
    const foot: V = [side * 3.3, step * 3.7 + hit * side, 1.2 + lift];
    const knee: V = [side * 3.3 + level * .25, 1 - step * 1.4 + thrust * .25, 7.5 - sink * .35 + lift * .3];
    const hip: V = [pelvis[0] + side * 2.6, pelvis[1], pelvis[2]];
    contacts.push({ x: foot[0] * Math.cos(angle) - foot[1] * Math.sin(angle), y: foot[0] * Math.sin(angle) + foot[1] * Math.cos(angle), weight: Math.max(0, 1 - lift / 2.2) });
    tube(foot, knee, 1.5, 1.8, CLOTH); tube(knee, hip, 1.8, 2.25, CLOTH);
    volume([{ at: shift(foot, 0, 1, -.9), rx: 1.7, ry: 2.6 }, { at: foot, rx: 1.5, ry: 2.1 }], DARK);
    if (world && level === 2 && side === -1) tissue(r, world, shift(knee, 0, 0, 1), hip, 1.7, 1.5, strength, individual, 0);
  }
  volume([{ at: shift(pelvis, 0, 0, -1), rx: 4.1, ry: 2.7 }, { at: waist, rx: 3, ry: 2.1 }, { at: shift(chest, 0, 0, -2), rx: 5, ry: 3 }, { at: chest, rx: 5.5, ry: 3 }, { at: shift(chest, 0, -.2, 1.5), rx: 3.9, ry: 2.3 }], CLOTH);
  if (world) {
    // The upper chest stays below the neck. Low invasion occupies one flank;
    // later invasion spreads across ribs and back, not between arm and waist.
    tissue(r, world, shift(waist, -1, .4, -.4), shift(chest, -1, 0, .5), 1.5 + strength * 3.5, 3.1, strength, individual, gait);
    if (level > 0) tissue(r, world, shift(waist, .5, -.7, -.3), shift(chest, .5, -.7, .3), 2 + strength * 2.3, -2.5, strength, 1 - individual, -gait);
  }
  for (const side of [-1, 1]) {
    const swing = -side * gait;
    const shoulder: V = [chest[0] + side * 6, chest[1] + side * .2, chest[2] - .3 - side * level * .85];
    const elbow: V = [shoulder[0] + side * (.8 + level * .25), 1 + thrust * .7 + swing * 2 - gather * 3, 18 - sink - (side === 1 ? level * .7 : 0)];
    const hand: V = [shoulder[0] + side * (.8 + level * .3), 2 + swing * 3 + hit * (side === 1 ? 13 : 6) - gather * 5, 11.8 - sink - (side === 1 ? level : 0) + hit * (side === 1 ? 8 : 5)];
    tube(shoulder, elbow, 2, 1.55, CLOTH); tube(elbow, hand, 1.55, 1.15, FLESH);
    volume([{ at: shift(hand, 0, .3, -1.8), rx: 1.35, ry: .9 }, { at: hand, rx: 1.4, ry: 1.1 }], FLESH);
    if (world && (side === -1 || level === 2)) {
      const lag = req.phase === 'walk' ? Math.sin(cycle - world.motionLag * Math.PI * 2) - Math.sin(-world.motionLag * Math.PI * 2) : 0;
      tissue(r, world, shift(elbow, side * .8, 0, .3), shift(shoulder, side * .6, 0, .5), 1 + strength * 2.2, 1.2, strength, individual, lag);
      if (level === 2 && side === -1) tissue(r, world, shift(hand, side * .3, 0, 1), elbow, 1.3, 1, strength, individual, lag);
    }
  }
  // The neck is a real narrow support, not a painted line within shoulder mass.
  tube(shift(chest, .1, .3, 1), shift(crown, 0, -.2, -5.3), 1.4, 1.35, DARK);
  volume([{ at: shift(crown, .2, .6, -5.4), rx: 1.6, ry: 1.7 }, { at: shift(crown, 0, .2, -3.5), rx: 2.5, ry: 2.25 }, { at: shift(crown, -.2, -.1, -.9), rx: 2.5, ry: 2.25 }, { at: crown, rx: 1.85, ry: 1.7 }], FLESH);
  // Brow and nose give a profile; no round infant head or emissive eye pair.
  tube(shift(crown, -1.7, 2.25, -2.5), shift(crown, 1.6, 2.25, -2.7), .45, .45, DARK);
  volume([{ at: shift(crown, .2, 2.3, -4.4), rx: .7, ry: .7 }, { at: shift(crown, .1, 2.5, -3.1), rx: .6, ry: .65 }], FLESH);
  if (world && level > 0) tissue(r, world, shift(crown, -1.3, -.6, -4.6), shift(crown, -1.3, -.6, -.5), .8 + level * .2, -.9, strength, individual, 0);
  r.finish();
  return { buf: r.buf, canvas: r.canvas, lightingSurface: r.lightingSurface, contacts };
}
