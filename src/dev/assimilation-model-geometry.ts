/** DEV geometry study: the accepted A is the authoring source, not an image
 * displacement. Every transformed triangle gets its normal recomputed. */
import {
  Model, add, cross, mul, sub, unit, type V3,
} from '../../docs/art/demos/purification-last-light/model';
import {
  actorShadowCapsules, buildActor, type ActorRightArmPose,
} from '../../docs/art/demos/purification-last-light/actor';
import { CAMERA, project } from '../../docs/art/demos/purification-last-light/render';
import {
  lastLightIdleLift, lastLightWalkArm, lastLightWalkLeg, lastLightWalkUpperPoint,
} from '@/art/last-light-gait';
import type {
  AssimilationModelMeta, AssimilationModelRequest, AssimilationModelSocket,
} from './assimilation-model-protocol';

export const ASSIMILATION_MODEL_CAMERA = {
  ...CAMERA, width: 64 as const, height: 80 as const,
  origin: [32, 66] as const, target: [0, 0, 0] as const,
};
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const smooth = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };
const blend = (a: V3, b: V3, t: number): V3 =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const yawPoint = (p: V3, yaw: number): V3 =>
  [p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), p[1], -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)];

export function validateAssimilationModelRequest(request: AssimilationModelRequest): void {
  if (!Number.isSafeInteger(request.id) || !Number.isFinite(request.amount) || request.amount < 0 || request.amount > 1
    || !Number.isFinite(request.fibre) || request.fibre < 0 || request.fibre > 1
    || (request.settle !== undefined && (!Number.isFinite(request.settle) || request.settle < 0 || request.settle > 1))
    || !Number.isFinite(request.yaw) || !Number.isFinite(request.breath)
    || !(request.phase === null || Number.isFinite(request.phase)))
    throw new Error('Invalid assimilation model request');
}

/** A continuous author-space deformation. Soles and lower legs retain their
 * original gait. The upper body leans about its own hip, never the sprite foot. */
export function morphAssimilationPoint(point: V3, amount: number, fibre: number): V3 {
  if (amount === 0 || point[1] <= .56) return point;
  const s = smooth(amount), torsoWeight = smooth((point[1] - .56) / .29);
  const angle = s * (16 + 4 * fibre) * Math.PI / 180 * torsoWeight;
  let [x, y, z] = point;
  // The neck transitions into a rigid counter-pose so the visor still faces
  // forward. It is not a detached head or a second screen-space transform.
  const head = smooth((y - 1.245) / .105);
  if (head > 0) {
    const neckY = y - 1.29, neckZ = z - .01, counter = -angle * .4 * head;
    y = 1.29 + neckY * Math.cos(counter) - neckZ * Math.sin(counter) - .025 * s * head;
    z = .01 + neckY * Math.sin(counter) + neckZ * Math.cos(counter) + .08 * s * head;
  }
  const relativeY = y - .76;
  y = .76 + relativeY * Math.cos(angle) - z * Math.sin(angle);
  z = relativeY * Math.sin(angle) + z * Math.cos(angle);
  // One continuous shoulder field also moves the sleeve/hand and the lamp
  // housing. No component is left at its old coordinate.
  const shoulder = smooth((point[1] - .63) / .32) * (1 - head);
  y -= s * .04 * Math.max(-1, Math.min(1, x / .22)) * shoulder;
  return [x, y, z];
}

/** A closed triangular ridge: two real slopes, an underside, closed end caps. */
function ridge(model: Model, points: readonly V3[], outward: V3, width: number, height: number): void {
  if (width <= 0 || height <= 0) return;
  const normal = unit(outward);
  const rings = points.map((point, index) => {
    const tangent = sub(points[Math.min(points.length - 1, index + 1)]!, points[Math.max(0, index - 1)]!);
    const side = unit(cross(tangent, normal));
    return [add(point, mul(side, -width / 2)), add(point, mul(side, width / 2)), add(point, mul(normal, height))] as const;
  });
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1]!, b = rings[i]!;
    for (let edge = 0; edge < 3; edge++) {
      const next = (edge + 1) % 3;
      model.quad(a[edge]!, a[next]!, b[next]!, b[edge]!, 'cloth', edge === 2 ? 1.38 : 1.18);
    }
  }
  model.triangle(rings[0]![2], rings[0]![1], rings[0]![0], 'cloth', 1.18);
  const end = rings[rings.length - 1]!;
  model.triangle(end[0], end[1], end[2], 'cloth', 1.18);
}

/** A folded ribbon with actual thickness. The strip collapses into its sewn
 * attachment at zero, so material does not pop into a full-sized sheet. */
function membrane(model: Model, seam: readonly V3[], out: V3, strength: number): void {
  if (strength <= 0) return;
  const outward = unit(out);
  const thickness = mul(unit(cross(sub(seam[seam.length - 1]!, seam[0]!), outward)), .026 * strength);
  const front = seam.map((p, i) => add(p, mul(outward, strength * (i === 1 ? .105 : .065))));
  for (let i = 1; i < seam.length; i++) {
    const a = seam[i - 1]!, b = seam[i]!, c = front[i]!, d = front[i - 1]!;
    const ai = sub(a, thickness), bi = sub(b, thickness), ci = sub(c, thickness), di = sub(d, thickness);
    model.quad(a, b, c, d, 'cloth', 1.34);
    model.quad(di, ci, bi, ai, 'cloth', .95);
    model.quad(d, c, ci, di, 'cloth', 1.12);
    model.quad(ai, bi, b, a, 'cloth', 1.02);
    if (i === 1) model.quad(a, d, di, ai, 'cloth', 1.12);
    if (i === seam.length - 1) model.quad(bi, ci, c, b, 'cloth', 1.12);
  }
}

function restArm(right: boolean, breath: number): ActorRightArmPose {
  const lift: V3 = [0, lastLightIdleLift(breath), 0];
  return right
    ? { shoulder: add([.276, 1.145, .008], lift), elbow: add([.331, .955, .006], lift), wrist: add([.328, .775, .066], lift) }
    : { shoulder: add([-.279, 1.142, .012], lift), elbow: add([-.328, .943, .041], lift), wrist: add([-.312, .758, .083], lift) };
}

function growStructure(model: Model, request: AssimilationModelRequest): void {
  const s = smooth(request.amount), fibre = s * request.fibre, film = s * (1 - request.fibre);
  const cycle = (request.phase ?? 0) / (Math.PI * 2), settle = request.settle ?? 0;
  const upper = (p: V3, part: 'pack' | 'chest'): V3 => request.phase === null
    ? add(p, [0, lastLightIdleLift(request.breath), 0]) : lastLightWalkUpperPoint(p, cycle, settle, part);
  // The pack/shoulder carries long load-bearing ribs, not separate antennae.
  for (const x of [-.18, .035, .19])
    ridge(model, ([[x, 1.21, -.265], [x * 1.03, 1.10, -.415], [x * .88, .79, -.385]] satisfies V3[]).map(p => upper(p, 'pack')),
      [x < 0 ? -.35 : .35, .12, -1], .085 * fibre, .085 * fibre);
  const left = request.phase === null ? restArm(false, request.breath) : lastLightWalkArm(false, cycle, settle);
  ridge(model, [blend(left.shoulder, left.elbow, .18), left.elbow, blend(left.elbow, left.wrist, .64)]
    .map(p => add(p, [-.083, 0, -.01])), [-1, .1, 0], .080 * fibre, .070 * fibre);
  // Both shin ridges follow the original walking joints; they never replant feet.
  for (const right of [false, true]) {
    const sign = right ? 1 : -1;
    const leg = request.phase === null
      ? { knee: [sign * .145, .38, right ? .063 : -.092] as V3, ankle: [sign * .145, .13, right ? .105 : -.05] as V3 }
      : lastLightWalkLeg(cycle, right, settle);
    ridge(model, [leg.knee, blend(leg.knee, leg.ankle, .60)].map(p => add(p, [sign * .077, 0, .035])),
      [sign, .06, .25], .065 * fibre, .065 * fibre);
  }
  // Broad joined sheets bend around existing shoulder/back and hip, with a
  // visibly returned outer edge. They use the same mother-model cloth material.
  membrane(model, ([[-.24, 1.20, -.12], [-.24, 1.03, -.34], [-.20, .76, -.30]] satisfies V3[])
    .map(p => upper(p, 'pack')), [-1, .05, -.4], film);
  membrane(model, ([[.23, 1.16, -.16], [.23, 1.01, -.37], [.19, .78, -.32]] satisfies V3[])
    .map(p => upper(p, 'pack')), [.8, 0, -.7], film);
  membrane(model, [blend(left.shoulder, left.elbow, .12), left.elbow, blend(left.elbow, left.wrist, .5)]
    .map(p => add(p, [-.075, 0, .025])), [-1, 0, .30], film);
}

export interface BuiltAssimilationModel { readonly model: Model; readonly meta: AssimilationModelMeta }
export function buildAssimilationModel(request: AssimilationModelRequest): BuiltAssimilationModel {
  validateAssimilationModelRequest(request);
  // buildActor and its capsule rig treat the final recovery sample as exact
  // neutral idle. Growth and sockets must make the same choice.
  const settle = request.settle ?? 0;
  const pose = settle >= 1 ? { ...request, phase: null, breath: 0, settle: 0 } : request;
  const source = new Model();
  buildActor(source, [0, 0, 0], 0, pose.breath, pose.phase ?? undefined, pose.settle ?? 0);
  if (request.amount > 0) growStructure(source, pose);
  const point = (p: V3): V3 => morphAssimilationPoint(p, request.amount, request.fibre);
  const model = new Model();
  model.at([0, 0, 0], request.yaw, 7, () => {
    for (const triangle of source.triangles)
      model.triangle(point(triangle.a), point(triangle.b), point(triangle.c), triangle.material, triangle.tint);
    for (const light of source.lights)
      model.light(point(light.position), light.color, 1, 2.6, { kind: light.kind, id: light.id });
  });
  const worldPoint = (p: V3): V3 => yawPoint(point(p), request.yaw);
  const arm = pose.phase === null ? restArm(true, pose.breath)
    : lastLightWalkArm(true, pose.phase / (Math.PI * 2), pose.settle ?? 0);
  const socket = (p: V3): AssimilationModelSocket => {
    const world = worldPoint(p), screen = project(world, ASSIMILATION_MODEL_CAMERA);
    return { world, screen: [screen[0], screen[1]] };
  };
  const capsules = actorShadowCapsules(pose.phase === null ? 'idle' : 'walk', 0, pose.phase ?? pose.breath, pose.settle ?? 0)
    .map(c => [...worldPoint([c[0]!, c[1]!, c[2]!]), ...worldPoint([c[3]!, c[4]!, c[5]!]), c[6]!]);
  const lamp = model.lights.find(light => light.id === 'actor-shoulder');
  if (!lamp) throw new Error('The mother model shoulder light is missing');
  return { model, meta: {
    yaw: request.yaw, phase: request.phase, settle, breath: request.breath, amount: request.amount, fibre: request.fibre,
    anchor: [32, 66], lamp: lamp.position, wrist: socket(arm.wrist), shoulder: socket(arm.shoulder),
    shadowCapsules: capsules,
  } };
}
