import type { LightVector } from '@/art/last-light-spatial';
import type { WeaponAttackPose } from '@/systems/weapon-swing';
export interface LastLightArmPose { shoulder:LightVector; elbow:LightVector; wrist:LightVector }
export const LAST_LIGHT_REST_ARM: LastLightArmPose = {
  shoulder:[.276,1.145,.008], elbow:[.331,.955,.006], wrist:[.328,.775,.066],
};
export const LAST_LIGHT_ATTACK_SAMPLES = [
  ...[.25,.5,.75,1].map(progress=>({phase:'windup' as const,progress})),
  ...[0,1/6,2/6,3/6,4/6,5/6,1].map(progress=>({phase:'active' as const,progress})),
  ...[.25,.5,.75,1].map(progress=>({phase:'recovery' as const,progress})),
] as const;
const clamp=(x:number):number=>Math.max(0,Math.min(1,x));
const ease=(x:number):number=>{const t=clamp(x);return t*t*(3-2*t);};
export function lastLightSwingSample(phase:'windup'|'active'|'recovery',progress:number):{sweep:number;lift:number} {
  if(phase==='windup'){const t=ease(progress);return{sweep:.55+(-Math.PI/3-.55)*t,lift:t};}
  if(phase==='active')return{sweep:-Math.PI/3+clamp(progress)*Math.PI*2/3,lift:1};
  const t=ease(progress);return{sweep:Math.PI/3+(.55-Math.PI/3)*t,lift:1-t};
}
/** Authored reach plus two-bone solve, preserving the mother model's arm lengths. */
export function lastLightAttackArm(phase:'windup'|'active'|'recovery',progress:number):LastLightArmPose {
  const {sweep,lift}=lastLightSwingSample(phase,progress),rest=LAST_LIGHT_REST_ARM;
  if(lift===0)return rest;
  const shoulder=rest.shoulder;
  const target:LightVector=[shoulder[0]-Math.sin(sweep)*.28,1.045,shoulder[2]+Math.cos(sweep)*.28];
  const wrist=rest.wrist.map((v,i)=>v+(target[i]!-v)*lift) as unknown as LightVector;
  const delta=wrist.map((v,i)=>v-shoulder[i]!),distance=Math.hypot(...delta),axis=delta.map(v=>v/distance);
  const upper=Math.hypot(...rest.elbow.map((v,i)=>v-shoulder[i]!));
  const lower=Math.hypot(...rest.wrist.map((v,i)=>v-rest.elbow[i]!));
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const pole=[.7,-.5,-.5],dot=pole.reduce((sum,v,i)=>sum+v*axis[i]!,0);
  const projected=pole.map((v,i)=>v-dot*axis[i]!),length=Math.hypot(...projected);
  const elbow=shoulder.map((v,i)=>v+axis[i]!*along+projected[i]!/length*height) as unknown as LightVector;
  return{shoulder,elbow,wrist};
}
/** Uses the real swing/contact clock. No independent visual timer can outlive death/pause. */
export function lastLightAttackSampleIndex(pose:Readonly<WeaponAttackPose>|null):number {
  if(!pose||pose.phase==='idle')return -1;
  const time=pose.contactRemainingMs>0&&pose.contactElapsedMs!==undefined?pose.contactElapsedMs:pose.elapsedMs;
  let phase:'windup'|'active'|'recovery',progress:number;
  if(time<pose.windupMs){phase='windup';progress=time/Math.max(1,pose.windupMs);}
  else if(time<=pose.windupMs+pose.activeMs){phase='active';progress=(time-pose.windupMs)/Math.max(1,pose.activeMs);}
  else{phase='recovery';progress=(time-pose.windupMs-pose.activeMs)/Math.max(1,pose.recoveryMs);}
  let best=0,distance=Infinity;
  for (let index = 0; index < LAST_LIGHT_ATTACK_SAMPLES.length; index++) {
    const sample = LAST_LIGHT_ATTACK_SAMPLES[index]!;
    const gap = Math.abs(sample.progress - progress);
    if (sample.phase === phase && gap < distance) { best = index; distance = gap; }
  }
  return best;
}
