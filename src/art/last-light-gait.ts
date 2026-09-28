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
const HIP_Y = .735, HIP_Z = .018, ANKLE_Y = .13;
export const lastLightIdleLift = (phase: number): number => Math.sin(phase) * .012;

/** Roll the rigid boot around the heel at landing and toe at push-off.
 * Its sole is .0025m above the ground in the authored neutral boot. */
export function lastLightFootPoint(foot: FootPose, point: GaitPoint): GaitPoint {
  const c = Math.cos(foot.footPitch), s = Math.sin(foot.footPitch);
  const y = point[1] - .0025, z = point[2] - foot.footPivotZ;
  return [point[0], .0025 + foot.footLift + y * c + z * s,
    foot.footZ + foot.footPivotZ + z * c - y * s];
}
function footAt(cycle: number, right: boolean): FootPose {
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
    lift = .075 * Math.sin(Math.PI * t) ** 2;
    pitch = -.34 + .50 * smooth(t);
  }
  return {footZ: z, footLift: lift, footPitch: pitch, footPivotZ: pitch >= 0 ? -.096 : .190};
}

/** Height follows actual leg reach, including the rolling ankle. Keeping the
 * old hip height with an ankle at the boot cuff forced a permanent crouch. */
export function lastLightWalkBodyLift(cycle: number, settle = 0): number {
  const reach = (LAST_LIGHT_THIGH_LENGTH + LAST_LIGHT_SHIN_LENGTH) * .992;
  let pelvis = .77;
  for (const right of [false, true]) {
    const x = right ? .143 : -.148;
    const ankle = lastLightFootPoint(footAt(cycle, right), [x, ANKLE_Y, -.018]);
    const lateral = x * .13, longitudinal = ankle[2] - HIP_Z;
    const reachableHeight = ankle[1] + Math.sqrt(Math.max(0, reach * reach - lateral * lateral - longitudinal * longitudinal));
    pelvis = Math.min(pelvis, reachableHeight);
  }
  return (pelvis - HIP_Y) * (1 - smooth(settle));
}

/** The coat, pack, head, lamp and their shadow rig share one small forward
 * lean. Feet remain independent ground contacts rather than pitching the actor. */
export function lastLightWalkTorsoPoint(point: GaitPoint, cycle: number, settle = 0): GaitPoint {
  const weight = 1 - smooth(settle), angle = .075 * weight;
  const c = Math.cos(angle), s = Math.sin(angle), y = point[1] - HIP_Y;
  return [point[0], HIP_Y + y * c - point[2] * s + lastLightWalkBodyLift(cycle, settle),
    y * s + point[2] * c + HIP_Z * weight];
}
export function lastLightWalkArmSwing(cycle: number, settle = 0): number {
  return footAt(cycle, false).footZ / (LAST_LIGHT_STRIDE_METRES * LAST_LIGHT_STANCE_FRACTION / 2) * .14 * (1 - smooth(settle));
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
  const x = right ? .143 : -.148, lift = lastLightWalkBodyLift(cycle, recovery);
  const hip: GaitPoint = [x * .87, HIP_Y + lift, HIP_Z * (1 - neutral)];
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
