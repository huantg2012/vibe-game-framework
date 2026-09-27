/** Shared physical gait contract: metres advance the stride, seconds only
 * lower a suspended foot after stopping. Authoring and runtime share this. */
export const LAST_LIGHT_STRIDE_METRES = 1.05;
export const LAST_LIGHT_WALK_FRAMES = 12;
export const LAST_LIGHT_SETTLE_STAGES = 2;
export const LAST_LIGHT_STANCE_FRACTION = .6;
export type GaitPoint = readonly [number, number, number];
export interface LastLightGaitSelection {
  pose: 'idle' | 'walk' | 'sit'; frame: number; moving: boolean; cycle: number;
}
export interface LastLightLegPose {
  hip: GaitPoint; knee: GaitPoint; ankle: GaitPoint;
  footZ: number; footLift: number; grounded: boolean;
}
const modulo = (value: number): number => ((value % 1) + 1) % 1;

export function lastLightWalkBodyLift(cycle: number, settle = 0): number {
  return .012 * (1 - Math.cos(cycle * Math.PI * 4)) * (1 - settle);
}

/** During stance, local dz/dcycle = -stride, cancelling the advancing root.
 * The Hermite swing keeps that endpoint velocity while clearing the floor. */
export function lastLightWalkLeg(cycle: number, right: boolean, settle = 0): LastLightLegPose {
  const phase = modulo(cycle + (right ? .5 : 0)), duty = LAST_LIGHT_STANCE_FRACTION;
  const half = LAST_LIGHT_STRIDE_METRES * duty / 2;
  let footZ: number, footLift = 0;
  if (phase < duty) footZ = half - LAST_LIGHT_STRIDE_METRES * phase;
  else {
    const t = (phase - duty) / (1 - duty), smooth = t * t * (3 - 2 * t);
    footZ = -half + 2 * half * smooth - LAST_LIGHT_STRIDE_METRES * (1 - duty) * t * (1 - t) * (1 - 2 * t);
    footLift = .155 * Math.sin(Math.PI * t) ** 2 * (1 - settle);
  }
  const x = right ? .143 : -.148, lift = lastLightWalkBodyLift(cycle, settle);
  const hip: GaitPoint = [x * .87, .735 + lift, -.025];
  const ankle: GaitPoint = [x, .203 + footLift, footZ - .018];
  // Two-bone IK preserves upper/lower-leg lengths. The knee bends toward the
  // face (+Z), rather than turning the entire trouser leg into a rubber cone.
  const thigh = .335, shin = .31;
  const delta = ankle.map((v, i) => v - hip[i]!) as [number, number, number];
  const distance = Math.hypot(...delta), axis = delta.map(v => v / distance);
  const along = (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  const bendLength = Math.hypot(axis[1]!, axis[2]!);
  const bend = [0, axis[2]! / bendLength, -axis[1]! / bendLength];
  const knee = hip.map((v, i) => v + axis[i]! * along + bend[i]! * height) as [number, number, number];
  return { hip, knee, ankle, footZ, footLift, grounded: phase <= duty || settle >= 1 };
}

/** Own exactly one instance per visible actor and call once per scene update. */
export class LastLightGait {
  private previous?: GaitPoint;
  private cycle = 0;
  private idleSeconds = 0;
  private stopSeconds = 0;
  private lastWalkFrame = 0;
  private hasWalked = false;
  private wasMoving = false;
  private wasResting = false;
  update(world: GaitPoint, deltaSeconds: number, resting: boolean): LastLightGaitSelection {
    const dt = Math.max(0, Math.min(.1, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
    const distance = this.previous ? Math.hypot(world[0] - this.previous[0], world[2] - this.previous[2]) : 0;
    this.previous = [world[0], world[1], world[2]];
    const stoodUp = this.wasResting && !resting;
    this.wasResting = resting;
    // A scene transfer/seat placement is not a very fast walking stride.
    // Standing restores the locomotion anchor even when the seat was nearby.
    if (resting || stoodUp || distance > 1.5) {
      this.hasWalked = false; this.wasMoving = false; this.stopSeconds = 0;
      return { pose: resting ? 'sit' : 'idle', frame: 0, moving: false, cycle: this.cycle };
    }
    const moving = distance > .00001;
    if (moving) {
      this.cycle = modulo(this.cycle + distance / LAST_LIGHT_STRIDE_METRES);
      this.lastWalkFrame = Math.round(this.cycle * LAST_LIGHT_WALK_FRAMES) % LAST_LIGHT_WALK_FRAMES;
      this.hasWalked = true; this.wasMoving = true; this.stopSeconds = 0;
      return { pose: 'walk', frame: this.lastWalkFrame, moving: true, cycle: this.cycle };
    }
    if (this.hasWalked) {
      this.stopSeconds = this.wasMoving ? dt : this.stopSeconds + dt; this.wasMoving = false;
      const stage = this.stopSeconds < .07 ? 0 : 1;
      return { pose: 'walk', frame: LAST_LIGHT_WALK_FRAMES + this.lastWalkFrame * LAST_LIGHT_SETTLE_STAGES + stage, moving: false, cycle: this.cycle };
    }
    this.idleSeconds += dt;
    return { pose: 'idle', frame: Math.floor(this.idleSeconds * 2) % 2, moving: false, cycle: this.cycle };
  }
}
