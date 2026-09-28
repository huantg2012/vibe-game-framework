/** Travel drives walking; a bounded recovery returns to a distinct idle loop. */
export const LAST_LIGHT_STRIDE_METRES = 1.05;
export const LAST_LIGHT_WALK_FRAMES = 12;
export const LAST_LIGHT_SETTLE_STAGES = 4;
export const LAST_LIGHT_SETTLE_SECONDS = .44;
export const LAST_LIGHT_IDLE_FRAMES = 8;
export const LAST_LIGHT_IDLE_PERIOD_SECONDS = 3.2;
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
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => { const t=clamp(v);return t*t*(3-2*t); };
const restZ = (right: boolean): number => right ? .080 : -.075;
export const lastLightIdleLift = (phase: number): number => Math.sin(phase)*.012;
export function lastLightWalkBodyLift(cycle: number, settle = 0): number {
  return .012 * (1 - Math.cos(cycle * Math.PI * 4)) * (1 - settle);
}
function footAt(cycle: number, right: boolean): {z:number;lift:number;grounded:boolean} {
  const phase=modulo(cycle+(right?.5:0)),duty=LAST_LIGHT_STANCE_FRACTION;
  const half=LAST_LIGHT_STRIDE_METRES*duty/2;
  if(phase<=duty)return {z:half-LAST_LIGHT_STRIDE_METRES*phase,lift:0,grounded:true};
  const t=(phase-duty)/(1-duty);
  return {z:-half+2*half*smooth(t)-LAST_LIGHT_STRIDE_METRES*(1-duty)*t*(1-t)*(1-2*t),
    lift:.105*Math.sin(Math.PI*t)**2,grounded:false};
}
/** Stance cancels root travel. On stopping, the airborne foot (or the foot
 * furthest from rest) gathers first while the other supports the body, then
 * the second foot gathers. Neither sole is dragged along the floor. */
export function lastLightWalkLeg(cycle: number, right: boolean, settle = 0): LastLightLegPose {
  const source=footAt(cycle,right),left=footAt(cycle,false),r=footAt(cycle,true);
  const firstRight=!r.grounded || (left.grounded && Math.abs(r.z-restZ(true))>Math.abs(left.z-restZ(false)));
  const recovery=clamp(settle),local=clamp(recovery*2-(right===firstRight?0:1)),gather=smooth(local);
  const footZ=source.z+(restZ(right)-source.z)*gather;
  const footLift=source.lift*(1-gather)+.065*Math.sin(Math.PI*local);
  const x=right?.143:-.148,lift=lastLightWalkBodyLift(cycle,recovery);
  const hip:GaitPoint=[x*.87,.735+lift,-.025];
  const ankle:GaitPoint=[x,.203+footLift,footZ-.018];
  const thigh=.335,shin=.31,delta=ankle.map((v,i)=>v-hip[i]!) as [number,number,number];
  const distance=Math.hypot(...delta),axis=delta.map(v=>v/distance);
  const along=(thigh*thigh-shin*shin+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(0,thigh*thigh-along*along)),bendLength=Math.hypot(axis[1]!,axis[2]!);
  const bend=[0,axis[2]!/bendLength,-axis[1]!/bendLength];
  const knee=hip.map((v,i)=>v+axis[i]!*along+bend[i]!*height) as [number,number,number];
  // The final recovery straightens the relaxed trouser silhouette into the
  // authored idle pose. This is pose recovery, not a frozen walking stance.
  const neutral=smooth(recovery);
  const recoveredHip:GaitPoint=[hip[0],hip[1],hip[2]+(restZ(right)-.041-hip[2])*neutral];
  const recoveredKnee:GaitPoint=[knee[0],knee[1]+(.38-knee[1])*neutral,knee[2]+(restZ(right)-.017-knee[2])*neutral];
  return {hip:recoveredHip,knee:recoveredKnee,ankle,footZ,footLift,grounded:footLift<.000001};
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
