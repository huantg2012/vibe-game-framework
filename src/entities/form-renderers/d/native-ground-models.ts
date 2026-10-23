/** Substrate anatomy for native material version 3. Shared tissue operations
 * alter each body's supports; they never replace its identity with a human. */
import { createModelRaster, modelProgress, smoothModel, type CreatureModelRequest, type ModelPoint as V } from './model-raster';
import { tissueMass, tissueTendon, tissueAt as at } from './native-tissue';
import { BODY_INKS } from './body-pixel-material';
import { beastVariantOf } from './beast-model';
import { wormVariantOf } from './worm-model';
import { growthVariantOf } from './growth-model';

function rig(req: CreatureModelRequest, label: string) {
  const world = req.worldAdaptation;
  if (!world) throw new Error(`${label}: frozen world material required`);
  const level = req.coverage === 'infiltrate' ? 0 : req.coverage === 'rewrite' ? 1 : 2;
  const r = createModelRaster({ ...req, nativeCoverage: [.22, .6, .96][level] }, label);
  const p = modelProgress(req.phase01), clock = (p === 1 ? 0 : p) * Math.PI * 2;
  const gather = req.phase === 'windup' ? smoothModel(p) : 0;
  const hit = req.phase === 'strike' ? 1 - .2 * smoothModel(p) : req.phase === 'recover' ? .8 * (1 - smoothModel(p)) : 0;
  const walk = req.phase === 'walk';
  const breath = req.phase === 'idle' ? Math.sin(clock) * .3 : 0;
  const finish = () => { r.finish(); return { buf: r.buf, canvas: r.canvas, lightingSurface: r.lightingSurface }; };
  return { r, world, level, p, clock, gather, hit, walk, breath, finish };
}

export function bakeNativeBeast(req: CreatureModelRequest) {
  const { r, world, level, clock, gather, hit, walk, breath, finish } = rig(req, 'native-beast');
  const variant = beastVariantOf(req.seed);
  const length = variant === 0 ? 20 : variant === 1 ? 15.5 : 14.5;
  const width = variant === 2 ? 6.6 : 4.5, height = variant === 1 ? 16 : variant === 0 ? 9 : 11.5;
  const stride = walk ? Math.sin(clock) * 3.2 : 0;
  const roll = walk ? Math.sin(clock) * (.5 + level * .2) : 0;
  const chest: V = [roll, length * .3 + hit * 3.3 - gather * 1.8, height - gather * 2 - hit + breath];
  const hip: V = [-roll * .45, -length * .37, height + (variant === 1 ? 1.5 : -1.5) + breath];
  for (const front of [false, true]) for (const side of [-1, 1]) {
    const step = stride * side * (front ? 1 : -1);
    const root = at(front ? chest : hip, side * (front ? width * .65 : width * .6), 0, -1.6);
    const foot: V = [side * (front ? width + .8 : width), (front ? length * .4 : -length * .44) + step + (front ? hit * 3 : 0), .9 + (walk ? Math.max(0, step) * .4 : 0)];
    const knee: V = [side * width, (root[1] + foot[1]) / 2 + (front ? -.8 : 2), (root[2] + foot[2]) / 2];
    tissueTendon(r, world, root, knee, front ? 1.9 : 1.65, level);
    tissueTendon(r, world, knee, foot, 1.2, level);
    r.mass(at(foot, 0, .7), [1.65, 2.1, 1], BODY_INKS.hide[1]);
  }
  tissueTendon(r, world, hip, chest, variant === 2 ? 4.2 : 3.2, level);
  tissueMass(r, world, hip, [width * .84, 4.3, 3.8], level, req.seed + 2);
  tissueMass(r, world, chest, [width, 5, 4.1 + level * .45], level, req.seed);
  const neck = at(chest, -.45 * level, 4.3, -1.5 + gather);
  const skull = at(neck, .2, 3, -.5 - hit * 1.1);
  tissueTendon(r, world, chest, neck, 2.5, level);
  tissueMass(r, world, skull, [2.9, 3.3, 2.9], level, req.seed + 4);
  r.mass(at(skull, 0, 2.4, -1.3), [2.1, 2, 1.3], BODY_INKS.bone[1]);
  for (const side of [-1, 1]) r.tube(at(skull, side * 1.9, -.6, 1.3), at(skull, side * 2.2, -.9, 3.6), 1.1, .35, BODY_INKS.hide[1]);
  const tail: V = [Math.sin(clock - world.motionLag * 3) * (walk ? 2 : .3), -length * .5 - (variant === 0 ? 6 : 4), 4.5];
  tissueTendon(r, world, at(hip, 0, -3, -.5), tail, 1.15, level);
  return finish();
}

export function bakeNativeWorm(req: CreatureModelRequest) {
  const { r, world, level, clock, gather, hit, walk, breath, finish } = rig(req, 'native-worm');
  const variant = wormVariantOf(req.seed), points: V[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const wave = walk ? Math.sin(clock - t * Math.PI * 2) : Math.sin(clock - t * 2) * .12;
    const x = variant === 1 ? Math.cos(t * Math.PI * 1.55 - 2.2) * 9 : Math.sin(t * Math.PI * 1.6) * (variant === 2 ? 5.3 : 3.3);
    const y = variant === 1 ? Math.sin(t * Math.PI * 1.55 - 2.2) * 11 : -17 + t * 32;
    const z = 3.4 + (variant === 2 ? Math.sin(t * Math.PI) * 3.3 : 0) + Math.max(0, wave) * (1.1 + level * .2);
    points.push([x + wave * .65, y + wave * 1.1 + t * (hit * 4 - gather * 2), z + breath]);
  }
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, radius = (variant === 2 ? 3.8 : 3) * (i === 0 ? .6 : i === 9 ? .8 : 1);
    if (i) tissueTendon(r, world, points[i - 1]!, p, radius * .84, level);
    // The segmented axis survives every material; masses remain attached.
    tissueMass(r, world, p, [radius, radius * .85, radius * .81], level, req.seed + i);
  }
  return finish();
}

export function bakeNativeGrowth(req: CreatureModelRequest) {
  const { r, world, level, clock, gather, hit, walk, breath, finish } = rig(req, 'native-growth');
  const variant = growthVariantOf(req.seed), tilt = hit * 5 - gather * 2;
  const width = variant === 1 ? 10 : variant === 2 ? 7 : 4.5;
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI * .5 + .4, step = walk ? Math.sin(clock + i * Math.PI) * 1.4 : 0;
    const foot: V = [Math.cos(angle) * (width + 3), Math.sin(angle) * 8 + step, .8];
    tissueTendon(r, world, foot, [Math.cos(angle) * 3, Math.sin(angle) * 2, 4], 1.8, level);
  }
  tissueMass(r, world, [0, 0, 4], [5.1, 4.6, 3.2], level, req.seed);
  for (let i = 0; i < 3; i++) {
    const side = i - 1;
    const height = variant === 0 ? 23 + (i === 1 ? 4 : -i) : variant === 1 ? 12 + i * 3 : 16 + (i === 2 ? 6 : 0);
    const sway = Math.sin(clock - i * .8 - world.motionLag * 3) * (walk ? .8 : .22);
    const top: V = [side * width + sway + level * (i === 2 ? 1.6 : -.3), tilt + (variant === 1 ? -4 : side * 1.1), height - hit * 2 + breath];
    const base: V = [side * 1.8, i === 0 ? -1 : 1, 3];
    const joint: V = [(base[0] + top[0]) / 2 + side * .7, tilt * .42, height * .57];
    tissueTendon(r, world, base, joint, i === 1 ? 2.7 : 2.1, level);
    tissueTendon(r, world, joint, top, 1.8, level);
    if (level || i === 1) tissueMass(r, world, at(joint, side * .65, .2, 1), [2.6 + level * .35, 2.3, 3.3], level, req.seed + i + 3);
    r.tube(at(top, 0, 0, -2), at(top, side * .45, -.5, .3), 1.3, .75, BODY_INKS.bone[1]);
  }
  return finish();
}

export function bakeNativeInsect(req: CreatureModelRequest) {
  const { r, world, level, clock, gather, hit, walk, breath, finish } = rig(req, 'native-insect');
  const bodyZ = 5 + breath - gather * .8;
  const thrust = hit * 3 - gather * 1.5;
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
    const phase = clock + (i % 2 ? Math.PI : 0) + (side < 0 ? Math.PI : 0);
    const step = walk ? Math.sin(phase) * 2.4 : 0;
    const root: V = [side * 3.3, -4 + i * 3.4 + thrust, bodyZ];
    const knee: V = [side * (8 + (i === 1 ? 1 : 0)), -7 + i * 6 + step * .3 + thrust, 4.3];
    const foot: V = [side * (13 + (i === 1 ? 2 : 0)), -10 + i * 10 + step + thrust, .6 + (walk ? Math.max(0, -Math.cos(phase)) * 1.2 : 0)];
    tissueTendon(r, world, root, knee, 1.25, level);
    tissueTendon(r, world, knee, foot, .86, level);
  }
  const abdomen: V = [level * .3, -6 + thrust, bodyZ + 1.5];
  tissueMass(r, world, abdomen, [5.5 + level * .45, 6.1, 4.1], level, req.seed);
  tissueMass(r, world, [0, 1 + thrust, bodyZ + .4], [3.7, 3.1, 3.1], level, req.seed + 1);
  const head: V = [0, 5.2 + thrust, bodyZ - .3];
  tissueMass(r, world, head, [2.9, 2.7, 2.2], level, req.seed + 2);
  for (const side of [-1, 1]) {
    r.tube(at(head, side * 1.5, 1.6, .2), at(head, side * 3, 4.1 + hit, -.4), .75, .38, BODY_INKS.bone[1]);
  }
  return finish();
}
