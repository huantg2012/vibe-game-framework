/** Travel drives walking; a bounded recovery returns to a distinct idle loop. */
export const LAST_LIGHT_STRIDE_METRES = 1.25;
export const LAST_LIGHT_WALK_FRAMES = 12;
export const LAST_LIGHT_SETTLE_STAGES = 4;
export const LAST_LIGHT_SETTLE_SECONDS = .44;
export const LAST_LIGHT_IDLE_FRAMES = 8;
export const LAST_LIGHT_IDLE_PERIOD_SECONDS = 3.2;
export const LAST_LIGHT_STANCE_FRACTION = .56;
export const LAST_LIGHT_THIGH_LENGTH = .335;
export const LAST_LIGHT_SHIN_LENGTH = .31;
export type GaitPoint = readonly [number, number, number];
export interface LastLightGaitSelection {
  pose: 'idle' | 'walk' | 'sit'; frame: number; moving: boolean; cycle: number;
}
interface FootPose {
  footZ: number; footLift: number; footPitch: number; footPivotZ: number;
}
export interface LastLightLegPose extends FootPose {
  hip: GaitPoint; knee: GaitPoint; ankle: GaitPoint; grounded: boolean;
}
const modulo = (value: number): number => ((value % 1) + 1) % 1;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => { const t = clamp(v); return t * t * (3 - 2 * t); };
const restZ = (right: boolean): number => right ? .080 : -.075;
const HIP_Y = .735, ANKLE_Y = .13;
export const lastLightIdleLift = (phase: number): number => Math.sin(phase) * .012;

/** Roll the rigid boot around the heel at landing and toe at push-off.
 * Its sole is .0025m above the ground in the authored neutral boot. */
export function lastLightFootPoint(foot: FootPose, point: GaitPoint): GaitPoint {
  const c = Math.cos(foot.footPitch), s = Math.sin(foot.footPitch);
  const y = point[1] - .0025, z = point[2] - foot.footPivotZ;
  return [point[0], .0025 + foot.footLift + y * c + z * s,
    foot.footZ + foot.footPivotZ + z * c - y * s];
}
function authoredFoot(cycle: number, right: boolean): FootPose {
  const phase = modulo(cycle + (right ? .5 : 0)), duty = LAST_LIGHT_STANCE_FRACTION;
  const half = LAST_LIGHT_STRIDE_METRES * duty / 2;
  let z: number, lift = 0, pitch: number;
  if (phase <= duty) {
    z = half - LAST_LIGHT_STRIDE_METRES * phase;
    // A flat, weight-bearing middle stance separates heel strike and toe-off.
    pitch = .16 * (1 - smooth(phase / .08)) - .34 * smooth((phase - (duty - .16)) / .16);
  } else {
    const t = (phase - duty) / (1 - duty);
    z = -half + 2 * half * smooth(t) - LAST_LIGHT_STRIDE_METRES * (1 - duty) * t * (1 - t) * (1 - 2 * t);
    // Recover the heel immediately after toe-off. The knee folds before the
    // shin is sent forward; a symmetric low arc kept the departing leg rigid.
    lift = .080 * Math.sin(Math.PI * Math.pow(t, .65)) ** 2;
    pitch = t < .20 ? -.34 - .16 * smooth(t / .20)
      : -.50 + .66 * smooth((t - .20) / .80);
  }
  return {footZ: z, footLift: lift, footPitch: pitch, footPivotZ: pitch >= 0 ? -.096 : .190};
}

interface BodyPose {
  x: number; y: number; z: number;
  hipYaw: number; hipRoll: number; hipPitch: number;
  chestYaw: number; chestRoll: number; chestPitch: number;
}
function rotate(point: GaitPoint, yaw: number, roll: number, pitch: number): GaitPoint {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x = point[0] * cy + point[2] * sy, z = -point[0] * sy + point[2] * cy;
  const rx = x * cr - point[1] * sr, y = x * sr + point[1] * cr;
  return [rx, y * cp - z * sp, y * sp + z * cp];
}
function keyedHeight(step: number): number {
  // Contact → loading/down → passing → rising → next contact. These are
  // authored whole-body poses, not the maximum reach of the airborne leg.
  const keys = [[0, .719], [.12, .716], [.46, .763], [.74, .761], [1, .719]] as const;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!, b = keys[i]!;
    if (step <= b[0]) return a[1] + (b[1] - a[1]) * smooth((step - a[0]) / (b[0] - a[0]));
  }
  return keys[0][1];
}
let cachedCycle = NaN, cachedBody: BodyPose;
function bodyAt(cycle: number): BodyPose {
  if (cycle === cachedCycle) return cachedBody;
  const phase = modulo(cycle), angle = phase * Math.PI * 2;
  const body: BodyPose = {
    x: -.036 * Math.sin(angle), y: keyedHeight(modulo(phase * 2)),
    z: .034 + .010 * Math.sin(angle * 2 - .4),
    hipYaw: .070 * Math.cos(angle), hipRoll: -.028 * Math.sin(angle), hipPitch: .025,
    chestYaw: -.065 * Math.cos(angle - .18), chestRoll: .018 * Math.sin(angle - .20),
    chestPitch: .110 + .025 * Math.sin(angle * 2 - .40),
  };
  const reach = (LAST_LIGHT_THIGH_LENGTH + LAST_LIGHT_SHIN_LENGTH) * .992;
  for (const right of [false, true]) {
    if (modulo(phase + (right ? .5 : 0)) > LAST_LIGHT_STANCE_FRACTION) continue;
    const x = right ? .143 : -.148;
    const hip = rotate([x * .87, 0, 0], body.hipYaw, body.hipRoll, body.hipPitch);
    const ankle = lastLightFootPoint(authoredFoot(phase, right), [x, ANKLE_Y, -.018]);
    const dx = ankle[0] - body.x - hip[0], dz = ankle[2] - body.z - hip[2];
    // Only a planted foot can limit body height. Swing recovery must adapt its
    // own knee, never pull the entire torso down to keep a trailing leg straight.
    body.y = Math.min(body.y, ankle[1] + Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz)) - hip[1]);
  }
  cachedCycle = cycle; cachedBody = body;
  return body;
}
function footAt(cycle: number, right: boolean): FootPose {
  const foot = authoredFoot(cycle, right);
  if (modulo(cycle + (right ? .5 : 0)) <= LAST_LIGHT_STANCE_FRACTION) return foot;
  const x = right ? .143 : -.148, body = bodyAt(cycle);
  const offset = rotate([x * .87, 0, 0], body.hipYaw, body.hipRoll, body.hipPitch);
  const ankle = lastLightFootPoint(foot, [x, ANKLE_Y, -.018]);
  const dx = ankle[0] - body.x - offset[0], dz = ankle[2] - body.z - offset[2];
  const swing = (modulo(cycle + (right ? .5 : 0)) - LAST_LIGHT_STANCE_FRACTION) / (1 - LAST_LIGHT_STANCE_FRACTION);
  const reach = (LAST_LIGHT_THIGH_LENGTH + LAST_LIGHT_SHIN_LENGTH) * (.983 + .009 * smooth((swing - .75) / .25));
  const clearance = body.y + offset[1] - Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz));
  // The airborne foot adapts to the authored body, retaining a small knee bend
  // through terminal swing. It never constrains the weight-bearing pelvis.
  foot.footLift += Math.max(0, clearance - ankle[1]);
  return foot;
}
export function lastLightWalkBodyLift(cycle: number, settle = 0): number {
  return (bodyAt(cycle).y - HIP_Y) * (1 - smooth(settle));
}
function torsoPoint(point: GaitPoint, body: BodyPose, weight: number, chest: number): GaitPoint {
  const lerp = (a: number, b: number): number => (a + (b - a) * chest) * weight;
  const p = rotate([point[0], point[1] - HIP_Y, point[2]],
    lerp(body.hipYaw, body.chestYaw), lerp(body.hipRoll, body.chestRoll), lerp(body.hipPitch, body.chestPitch));
  return [p[0] + body.x * weight, p[1] + HIP_Y + (body.y - HIP_Y) * weight, p[2] + body.z * weight];
}
/** The lower coat follows the loaded pelvis; the ribcage counter-rotates.
 * Blend through the waist rather than carrying the actor as one rigid block. */
export function lastLightWalkTorsoPoint(point: GaitPoint, cycle: number, settle = 0): GaitPoint {
  return torsoPoint(point, bodyAt(cycle), 1 - smooth(settle), smooth((point[1] - .75) / .34));
}
/** Rigid attachments preserve their shape. The head stabilizes its orientation
 * over the neck; the pack follows the chest with a restrained phase delay. */
export function lastLightWalkUpperPoint(point: GaitPoint, cycle: number, settle = 0, part: 'chest' | 'head' | 'pack' = 'chest'): GaitPoint {
  const weight = 1 - smooth(settle), body = bodyAt(cycle);
  if (part === 'chest') return torsoPoint(point, body, weight, 1);
  const anchor: GaitPoint = part === 'head' ? [0, 1.245, .015] : [0, 1.10, -.14];
  const base = torsoPoint(anchor, body, weight, 1), angle = (cycle - .025) * Math.PI * 2;
  const yaw = part === 'head' ? body.chestYaw * .32 : -.065 * Math.cos(angle - .18);
  const roll = part === 'head' ? body.chestRoll * .35 : .018 * Math.sin(angle - .20);
  const pitch = part === 'head' ? .070 + (body.chestPitch - .110) * .3 : .110 + .025 * Math.sin(angle * 2 - .40);
  const p = rotate([point[0] - anchor[0], point[1] - anchor[1], point[2] - anchor[2]], yaw * weight, roll * weight, pitch * weight);
  return [base[0] + p[0], base[1] + p[1], base[2] + p[2]];
}
export function lastLightWalkArm(right: boolean, cycle: number, settle = 0): {shoulder: GaitPoint; elbow: GaitPoint; wrist: GaitPoint} {
  const shoulder: GaitPoint = right ? [.276, 1.145, .008] : [-.279, 1.142, .012];
  const elbow: GaitPoint = right ? [.331, .955, .006] : [-.328, .943, .041];
  const wrist: GaitPoint = right ? [.328, .775, .066] : [-.312, .758, .083];
  const weight = 1 - smooth(settle), phase = cycle * Math.PI * 2 - .12;
  const swing = (right ? -1 : 1) * .28 * Math.cos(phase) * weight;
  const upper = rotate([elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]], 0, 0, swing);
  const lower = rotate([wrist[0] - elbow[0], wrist[1] - elbow[1], wrist[2] - elbow[2]], 0, 0, swing + .10 * Math.sin(phase) * weight);
  const e: GaitPoint = [shoulder[0] + upper[0], shoulder[1] + upper[1], shoulder[2] + upper[2]];
  const w: GaitPoint = [e[0] + lower[0], e[1] + lower[1], e[2] + lower[2]];
  return {shoulder: lastLightWalkUpperPoint(shoulder, cycle, settle), elbow: lastLightWalkUpperPoint(e, cycle, settle), wrist: lastLightWalkUpperPoint(w, cycle, settle)};
}
/** During stance, local dz/dcycle cancels root travel. Recovery gathers the
 * airborne foot first, then the other, without dragging a planted sole. */
export function lastLightWalkLeg(cycle: number, right: boolean, settle = 0): LastLightLegPose {
  const source = footAt(cycle, right), left = footAt(cycle, false), r = footAt(cycle, true);
  const firstRight = r.footLift > 1e-8 || (left.footLift <= 1e-8 && Math.abs(r.footZ - restZ(true)) > Math.abs(left.footZ - restZ(false)));
  const recovery = clamp(settle), neutral = smooth(recovery);
  const local = clamp(recovery * 2 - (right === firstRight ? 0 : 1)), gather = smooth(local);
  const foot: FootPose = {
    footZ: source.footZ + (restZ(right) - source.footZ) * gather,
    footLift: source.footLift * (1 - gather) + .065 * Math.sin(Math.PI * local),
    footPitch: source.footPitch * (1 - neutral), footPivotZ: source.footPivotZ,
  };
  const x = right ? .143 : -.148;
  const hip = lastLightWalkTorsoPoint([x * .87, HIP_Y, 0], cycle, recovery);
  const ankle = lastLightFootPoint(foot, [x, ANKLE_Y, -.018]);
  const thigh = LAST_LIGHT_THIGH_LENGTH, shin = LAST_LIGHT_SHIN_LENGTH;
  const delta = ankle.map((v, i) => v - hip[i]!) as [number, number, number];
  const distance = Math.hypot(...delta), axis = delta.map(v => v / distance);
  const along = (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  const bendLength = Math.hypot(axis[1]!, axis[2]!), bend = [0, axis[2]! / bendLength, -axis[1]! / bendLength];
  const knee = hip.map((v, i) => v + axis[i]! * along + bend[i]! * height) as [number, number, number];
  const recoveredHip: GaitPoint = [hip[0], hip[1], hip[2] + (restZ(right) - .041 - hip[2]) * neutral];
  const recoveredKnee: GaitPoint = [knee[0], knee[1] + (.38 - knee[1]) * neutral, knee[2] + (restZ(right) - .017 - knee[2]) * neutral];
  return {...foot, hip: recoveredHip, knee: recoveredKnee, ankle, grounded: foot.footLift < .000001};
}

/** One instance per visible actor, called once per scene update. */
export class LastLightGait {
  private previous?:GaitPoint;
  private cycle=1/3;
  private idleSeconds=0;
  private stopSeconds=0;
  private lastWalkFrame=4;
  private hasWalked=false;
  private wasResting=false;
  update(world:GaitPoint,deltaSeconds:number,resting:boolean):LastLightGaitSelection {
    const dt=Math.max(0,Math.min(.1,Number.isFinite(deltaSeconds)?deltaSeconds:0));
    const distance=this.previous?Math.hypot(world[0]-this.previous[0],world[2]-this.previous[2]):0;
    this.previous=[world[0],world[1],world[2]];
    const stoodUp=this.wasResting&&!resting;this.wasResting=resting;
    if(resting||stoodUp||distance>1.5){
      this.hasWalked=false;this.stopSeconds=0;this.idleSeconds=0;this.cycle=1/3;
      return {pose:resting?'sit':'idle',frame:0,moving:false,cycle:this.cycle};
    }
    const moving=distance>.00001;
    if(moving){
      if(!this.hasWalked)this.cycle=1/3;
      this.cycle=modulo(this.cycle+distance/LAST_LIGHT_STRIDE_METRES);
      this.lastWalkFrame=Math.round(this.cycle*LAST_LIGHT_WALK_FRAMES)%LAST_LIGHT_WALK_FRAMES;
      this.hasWalked=true;this.stopSeconds=0;this.idleSeconds=0;
      return {pose:'walk',frame:this.lastWalkFrame,moving:true,cycle:this.cycle};
    }
    if(this.hasWalked){
      this.stopSeconds+=dt;
      if(this.stopSeconds<LAST_LIGHT_SETTLE_SECONDS){
        const stage=Math.min(LAST_LIGHT_SETTLE_STAGES-1,Math.floor(this.stopSeconds/LAST_LIGHT_SETTLE_SECONDS*LAST_LIGHT_SETTLE_STAGES));
        return {pose:'walk',frame:LAST_LIGHT_WALK_FRAMES+this.lastWalkFrame*LAST_LIGHT_SETTLE_STAGES+stage,moving:false,cycle:this.cycle};
      }
      this.hasWalked=false;this.idleSeconds=0;
      return {pose:'idle',frame:0,moving:false,cycle:this.cycle};
    }
    this.idleSeconds+=dt;
    return {pose:'idle',frame:Math.floor(this.idleSeconds/LAST_LIGHT_IDLE_PERIOD_SECONDS*LAST_LIGHT_IDLE_FRAMES)%LAST_LIGHT_IDLE_FRAMES,moving:false,cycle:this.cycle};
  }
}
