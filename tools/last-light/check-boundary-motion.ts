import {
  canStandLastLight, createLastLightMovementState, stepLastLightMovement, lastLightProjectedWalkingSpeed, lastLightWorldDelta,
  type LastLightMovementState,
} from '../../src/systems/last-light-locomotion';
import {
  LAST_LIGHT_WORLD_WALK_SPEED, projectLastLight, sampleLastLightSurface,
  type ChamberPoint, type LastLightRoute,
} from '../../src/systems/last-light-layout';
import {LastLightGait, LAST_LIGHT_SETTLE_SECONDS, LAST_LIGHT_STRIDE_METRES, LAST_LIGHT_WALK_FRAMES} from '../../src/art/last-light-gait';

const ensure = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };
const angleDifference = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b)));
const degrees = (radians: number): number => radians * 180 / Math.PI;
const rounded = (value: number): number => Number(value.toFixed(6));
interface Trial {name: string; x: number; z: number; route: LastLightRoute; input: ChamberPoint}
const trials: Trial[] = [
  // The last fractional substep pointed 154.59 degrees away from this frame's
  // actual motion, then flipped back on the next frame in c9da7c3.
  {name:'visible front-edge flip',x:7.4387566189145575,z:7.340535850496551,route:'main',input:{x:1,y:1}},
  {name:'whole front-edge approach',x:4.8,z:7.6,route:'main',input:{x:1,y:1}},
  {name:'west-ramp inner wall',x:3.543782585721489,z:-1.0812360346907905,route:'main',input:{x:-1,y:-1}},
  {name:'west-ramp walking edge',x:1.7836198532369083,z:-1.8355914914698965,route:'west-ramp',input:{x:-1,y:-1}},
  {name:'growth machine front',x:5.995874096585965,z:-4.118,route:'upper',input:{x:1,y:-1}},
  {name:'rounded supply can',x:11.745,z:5.8,route:'main',input:{x:-1,y:-1}},
  {name:'pier corner',x:4.7,z:-4.613,route:'main',input:{x:1,y:-1}},
];
const patterns = [[1000/60], [1000/120], [8,25,12,21,34]];
let framesChecked = 0, maximumFacingError = 0, maximumSingleFrameDistance = 0, minimumForwardProgress = 0;
function run(trial: Trial, pattern: readonly number[], duration = 3000): LastLightMovementState {
  const state = createLastLightMovementState({x:trial.x,y:0,z:trial.z},trial.route);
  const gait = new LastLightGait(); gait.update([state.x,state.y,state.z],0,false);
  for(let elapsed=0,frame=0;elapsed<duration-1e-8;frame++){
    const dt=Math.min(pattern[frame%pattern.length]!,duration-elapsed),before={...state};elapsed+=dt;
    const speed=lastLightProjectedWalkingSpeed(state,trial.input,LAST_LIGHT_WORLD_WALK_SPEED);
    stepLastLightMovement(state,trial.input,dt,speed);
    const dx=state.x-before.x,dz=state.z-before.z,distance=Math.hypot(dx,dz);
    const requested=lastLightWorldDelta(before.route,before,trial.input.x,trial.input.y);
    const forwardProgress=(dx*requested.x+dz*requested.z)/Math.hypot(requested.x,requested.z);
    minimumForwardProgress=Math.min(minimumForwardProgress,forwardProgress);
    ensure(forwardProgress>=-1e-7,`${trial.name}: concave contact reverses progress against the original input (${forwardProgress}m)`);
    ensure(canStandLastLight(state,state.route),`${trial.name}: contact resolution left the supported collision-free surface`);
    ensure(distance<=LAST_LIGHT_WORLD_WALK_SPEED*dt/1000+.0002,
      `${trial.name}: contact resolution moved farther than the available walking distance`);
    maximumSingleFrameDistance=Math.max(maximumSingleFrameDistance,distance);
    if(distance>1e-5){
      const error=angleDifference(state.facing,Math.atan2(dx,dz));
      maximumFacingError=Math.max(maximumFacingError,error);
      ensure(error<.001,`${trial.name}: body facing differs from whole-frame movement by ${degrees(error)} degrees`);
    }else ensure(angleDifference(state.facing,before.facing)<1e-8,`${trial.name}: blocked movement changed body facing`);
    const pose=gait.update([state.x,state.y,state.z],dt/1000,false);
    ensure(pose.moving===(distance>1e-5),`${trial.name}: gait moving flag disagrees with actual travel`);
    framesChecked++;
  }
  return state;
}
const summaries=trials.map(trial=>({name:trial.name,endpoints:patterns.map(pattern=>{
  const end=run(trial,pattern);
  return{framePatternMs:pattern.map(rounded),x:rounded(end.x),z:rounded(end.z),route:end.route};
})}));

// Contact with a straight wall has an analytic result: preserve the incoming
// tangent, consume the normal approach only until contact. Splitting the same
// elapsed time into different frame patterns must not produce repeated
// catch-up bursts. Near-normal input may legitimately leave a very slow tangent.
const straightTrials=[trials[2]!,trials[3]!,trials[4]!];
let maximumFramePartitionDrift=0;
for(const trial of straightTrials){
  const endpoints=patterns.map(pattern=>run(trial,pattern,650));
  for(const end of endpoints){
    const drift=Math.hypot(end.x-endpoints[0]!.x,end.z-endpoints[0]!.z);
    maximumFramePartitionDrift=Math.max(maximumFramePartitionDrift,drift);
    ensure(drift<.002,`${trial.name}: equivalent frame-time partitions diverge by ${drift}m`);
  }
}

// Head-on contact keeps input held while actual travel stops. Recovery must
// finish and idle must persist; contact must not accumulate hidden gait phase.
const blocked=createLastLightMovementState({x:6,y:2.6,z:-4.118},'upper');
const projection=projectLastLight(blocked),toward=projectLastLight({x:blocked.x,y:blocked.y,z:blocked.z-1});
const normalInput={x:toward.x-projection.x,y:toward.y-projection.y};
const inputLength=Math.hypot(normalInput.x,normalInput.y);normalInput.x/=inputLength;normalInput.y/=inputLength;
const gait=new LastLightGait();gait.update([blocked.x,blocked.y,blocked.z],0,false);
let stoppedCycle:number|undefined,stoppedSeconds=0,idleFrames=0;
for(let frame=0;frame<120;frame++){
  const dt=1000/60,before={...blocked};
  stepLastLightMovement(blocked,normalInput,dt,lastLightProjectedWalkingSpeed(blocked,normalInput,LAST_LIGHT_WORLD_WALK_SPEED));
  const distance=Math.hypot(blocked.x-before.x,blocked.z-before.z),pose=gait.update([blocked.x,blocked.y,blocked.z],dt/1000,false);
  framesChecked++;
  ensure(canStandLastLight(blocked,blocked.route),'Head-on wall contact lost collision clearance');
  if(distance<=1e-5){
    stoppedSeconds+=dt/1000;
    if(stoppedCycle===undefined)stoppedCycle=pose.cycle;
    ensure(Math.abs(pose.cycle-stoppedCycle)<1e-10,'Pressing into an impassable wall advances walking phase');
    ensure(!pose.moving,'An unmoving blocked actor is marked as walking');
    if(stoppedSeconds>LAST_LIGHT_SETTLE_SECONDS+.05){ensure(pose.pose==='idle','Blocked movement never finishes settling to idle');idleFrames++;}
  }else{ensure(stoppedSeconds<.05,'Head-on contact repeatedly restarts motion after stopping');stoppedSeconds=0;stoppedCycle=undefined;}
}
ensure(idleFrames>60,'Insufficient sustained blocked-idle coverage');

// User-visible slow-motion regressions: these keys are nearly perpendicular
// to the contacted wall. The previous solver retained only 5–6% of walk speed,
// holding each full-stride pose for roughly one second. That tiny remainder
// must become a real stop rather than creeping or an in-place walk loop.
const nearNormalTrials:Trial[]=[
  {name:'user ramp east SE creep',x:3.4163801467630917,z:-1.9644085085301035,route:'west-ramp',input:{x:1,y:1}},
  trials[4]!,
];
const stoppedSummaries=nearNormalTrials.map(trial=>{
  let maximumTravel=0,verifiedIdleFrames=0;
  for(const pattern of patterns){
    const state=createLastLightMovementState({x:trial.x,y:0,z:trial.z},trial.route),animation=new LastLightGait();
    animation.update([state.x,state.y,state.z],0,false);
    let travel=0,stationaryCycle:number|undefined;
    for(let elapsed=0,frame=0;elapsed<1600-1e-8;frame++){
      const dt=Math.min(pattern[frame%pattern.length]!,1600-elapsed),before={...state};elapsed+=dt;
      stepLastLightMovement(state,trial.input,dt,lastLightProjectedWalkingSpeed(state,trial.input,LAST_LIGHT_WORLD_WALK_SPEED));
      const distance=Math.hypot(state.x-before.x,state.z-before.z);travel+=distance;
      const pose=animation.update([state.x,state.y,state.z],dt/1000,false);
      framesChecked++;
      ensure(canStandLastLight(state,state.route),`${trial.name}: stopping contact lost full foot support`);
      if(elapsed>200){
        ensure(distance<1e-5,`${trial.name}: near-normal held input still creeps along the wall`);
        if(stationaryCycle===undefined)stationaryCycle=pose.cycle;
        ensure(Math.abs(pose.cycle-stationaryCycle)<1e-10,`${trial.name}: stationary contact advances walking phase`);
      }
      if(elapsed>200+LAST_LIGHT_SETTLE_SECONDS*1000+50){
        ensure(pose.pose==='idle'&&!pose.moving,`${trial.name}: nearly head-on contact retains a slow walking pose`);
        verifiedIdleFrames++;
      }
    }
    maximumTravel=Math.max(maximumTravel,travel);
    ensure(travel<.03,`${trial.name}: a small initial contact gap became sustained wall creep`);
  }
  return{name:trial.name,maximumApproachTravelMetres:rounded(maximumTravel),verifiedIdleFrames};
});

// Meaningful oblique input should keep an ordinary walking cadence by moving
// the body along the wall. Advancing animation independently from travel would
// pass a frame-rate-only test but recreate sliding planted feet (moonwalking).
const cadenceTrials:Trial[]=[
  {...nearNormalTrials[0]!,name:'ramp east edge up-slide',input:{x:1,y:0}},
  {...nearNormalTrials[0]!,name:'ramp east edge down-slide',input:{x:0,y:1}},
];
const cadenceSummaries=cadenceTrials.map(trial=>{
  const state=createLastLightMovementState({x:trial.x,y:0,z:trial.z},trial.route),animation=new LastLightGait();
  let previousPose=animation.update([state.x,state.y,state.z],0,false),travel=0,heldSeconds=0,maximumHoldSeconds=0,changes=0;
  for(let frame=0;frame<36;frame++){
    const dt=1000/60,before={...state};
    stepLastLightMovement(state,trial.input,dt,lastLightProjectedWalkingSpeed(state,trial.input,LAST_LIGHT_WORLD_WALK_SPEED));
    const distance=Math.hypot(state.x-before.x,state.z-before.z),pose=animation.update([state.x,state.y,state.z],dt/1000,false);travel+=distance;
    framesChecked++;
    ensure(canStandLastLight(state,state.route),`${trial.name}: useful slide lost full foot support`);
    ensure(pose.pose==='walk'&&pose.moving,`${trial.name}: useful slide repeatedly stops instead of walking`);
    const phaseAdvance=((pose.cycle-previousPose.cycle)%1+1)%1;
    ensure(Math.abs(phaseAdvance-distance/LAST_LIGHT_STRIDE_METRES)<1e-8,
      `${trial.name}: faster-looking animation is detached from real foot travel`);
    if(frame===0||pose.frame!==previousPose.frame){maximumHoldSeconds=Math.max(maximumHoldSeconds,heldSeconds);heldSeconds=dt/1000;if(frame>0)changes++;}
    else heldSeconds+=dt/1000;
    previousPose=pose;
  }
  maximumHoldSeconds=Math.max(maximumHoldSeconds,heldSeconds);
  const meanSpeed=travel/.6;
  ensure(meanSpeed>LAST_LIGHT_WORLD_WALK_SPEED*.75,`${trial.name}: an intentional oblique slide still truncates most of the stride budget`);
  ensure(maximumHoldSeconds<.15&&changes>=6,`${trial.name}: full walking poses still remain on screen in slow motion`);
  return{name:trial.name,meanWorldSpeed:rounded(meanSpeed),cadenceStepsPerMinute:rounded(meanSpeed/LAST_LIGHT_STRIDE_METRES*120),
    effectiveAnimationFramesPerSecond:rounded(meanSpeed/LAST_LIGHT_STRIDE_METRES*LAST_LIGHT_WALK_FRAMES),
    maximumWalkingPoseHoldSeconds:rounded(maximumHoldSeconds),walkingFrameChanges:changes};
});

// Real eight-key inputs at each contact must remain safe and face actual
// travel. This catches cardinal-only fixes and diagonal-only normal selection.
const keys:ChamberPoint[]=[{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:-1,y:-1},{x:0,y:-1},{x:1,y:-1}];
for(const trial of trials)for(const input of keys)run({...trial,input},[8,25,12,21,34],500);

// Normalizing a second contact's tangent against only the already-deflected
// remainder can reverse travel in a concave corner. These two observed seeds
// must respect the original frame input throughout repeated contact handling.
const concaveTrials:(Trial&{dt:number})[]=[
  {name:'east concave reversal',x:9.51650236490082,z:7.185089349239516,route:'main',
    input:{x:-.9434267924901985,y:.33158089090244036},dt:16.6667},
  {name:'west concave reversal',x:-2.260760628663009,z:-5.137396694760002,route:'main',
    input:{x:.20725901051164675,y:-.9782861046553473},dt:33},
];
for(const trial of concaveTrials)run(trial,[trial.dt],trial.dt*120);

// Verify the chosen old visible regression location has not become a false
// start outside its real physical storey, hiding the regression by relocation.
ensure(sampleLastLightSurface('main',trials[0]!.x,trials[0]!.z),'The visible regression seed lost its physical floor');
console.log(JSON.stringify({status:'PASS',framesChecked,
  maximumFacingErrorDegrees:rounded(degrees(maximumFacingError)),maximumSingleFrameDistance:rounded(maximumSingleFrameDistance),
  minimumOriginalInputProgressMetres:minimumForwardProgress,concaveReversalFrames:concaveTrials.length*120,
  maximumFramePartitionDrift:rounded(maximumFramePartitionDrift),sustainedBlockedIdleFrames:idleFrames,
  checks:['visible fractional-substep flip','main/ramp/upper/circle boundaries','fixed and variable frame times',
    'whole-frame facing','full foot clearance and bounded travel','straight-contact partition stability',
    'held head-on collision settles to idle without walking phase','near-normal input stops instead of one-fps creep',
    'oblique wall slide keeps travel-driven cadence without moonwalking','all eight real screen keys',
    'two concave reversal seeds retain nonnegative original-input progress'],
  nearNormalStops:stoppedSummaries,slideCadence:cadenceSummaries,
  cases:summaries,
},null,2));
