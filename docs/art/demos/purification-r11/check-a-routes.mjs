import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SPACE,FLOORS,DEVICES,SPAWN,WAYPOINTS,OUTER_BOUNDARY,createState,canStand,clearance,
  stepMovement,routeAt,canInteract,planPath,directionToward,createController,setFocus,setPaused,stepController } from './a-route-model.mjs';

const checks=[],failures=[];
const report={kind:'R11 A independent candidate geometry',status:'running',
  coordinateSpace:'1536×1024 image pixels; 2.4 image pixels = 1 world pixel',
  productionSceneVerified:false,actorHeight:SPACE.actorHeight,feetRadius:SPACE.feetRadius,
  interactionRadius:SPACE.interactionRadius,sourceAlgorithm:'src/systems/purification-chamber-locomotion.ts',
  algorithmDelta:'Candidate sweep advances 0.0001 image pixels less at contact to avoid floating-point negative-time corner escape; production source unchanged.',
  motion:'Same module as browser; A* chooses directions, every position update is a continuous swept-circle movement step.',
  checks,failures,metrics:{frames:0,distance:0,minClearance:Infinity,interactions:[],routes:[],teleports:0},
  limitations:['Independent candidate only; production camera, occlusion, device panels and scene integration are not tested.',
    'Image is a concept reference. Greybox floor polygons and device footprints are the precise candidate geometry.',
    'Automated geometry evidence does not approve visual quality or human movement feel.'],
};
const requireCondition=(condition,message)=>{if(!condition) throw new Error(message);};
async function test(name,run) {
  try {const details=await run();checks.push({name,status:'pass',...details});}
  catch(error) {checks.push({name,status:'fail',error:error.message});failures.push(`${name}: ${error.message}`);}
}
const round=value=>Math.round(value*1000)/1000;
function moveFrame(state,input,delta=1000/60) {
  const before={...state};stepMovement(state,input,delta);
  requireCondition(canStand(state),`Full foot penetrated floor/solid at ${JSON.stringify(state)}`);
  requireCondition(state.route===routeAt(state),'Route does not match supported floor');
  const travel=Math.hypot(state.x-before.x,state.y-before.y);
  requireCondition(travel<=SPACE.speed*Math.min(delta,SPACE.maxStepMs)/1000+1e-5,'Movement exceeded frame travel budget');
  report.metrics.frames++;report.metrics.distance+=travel;
  report.metrics.minClearance=Math.min(report.metrics.minClearance,clearance(state));
  if(!report.metrics.routes.includes(state.route)) report.metrics.routes.push(state.route);
}
function walk(state,target,delta=1000/60) {
  const before=report.metrics.frames,distanceBefore=report.metrics.distance,routeSequence=[state.route];
  for(const waypoint of planPath(state,target)) {
    let frames=0;
    while(Math.hypot(state.x-waypoint.x,state.y-waypoint.y)>.02) {
      requireCondition(++frames<1800,`Stuck on route to ${JSON.stringify(waypoint)}`);
      moveFrame(state,directionToward(state,waypoint,delta),delta);
      if(routeSequence.at(-1)!==state.route) routeSequence.push(state.route);
    }
  }
  requireCondition(Math.hypot(state.x-target.x,state.y-target.y)<.05,'Route goal not reached');
  return {frames:report.metrics.frames-before,distance:round(report.metrics.distance-distanceBefore),routeSequence};
}
let state=createState();
await test('All floor patches, operation anchors and spawn have circular-foot clearance',()=>{
  for(const device of DEVICES) {
    requireCondition(canStand(device.anchor),`${device.id} anchor cannot support feet`);
    requireCondition(routeAt(device.anchor)===device.floor,`${device.id} anchor on wrong floor`);
    requireCondition(canInteract(createState(device.anchor),device),`${device.id} not interactive at own anchor`);
  }
  for(const [id,p] of Object.entries(WAYPOINTS)) requireCondition(canStand(p),`${id} cannot support feet`);
  return {anchorClearance:DEVICES.map(device=>({id:device.id,clearance:round(clearance(device.anchor))}))};
});
await test('One continuous journey reaches and operates all six devices',()=>{
  const visited=[];
  for(const id of ['core','storage','growth','offering','purifier','rift']) {
    const device=DEVICES.find(d=>d.id===id),travel=walk(state,device.anchor);
    requireCondition(canInteract(state,device),`${id} operation rejected after actual movement`);
    requireCondition(!canInteract({...state,route:device.floor==='main'?'upper':'main'},device),'Other floor accepted operation');
    visited.push({id,position:{x:round(state.x),y:round(state.y)},...travel});report.metrics.interactions.push(id);
  }
  walk(state,SPAWN);return {visited};
});
await test('Adjacent lower-floor devices connect both ways without using either ramp',()=>{
  const rift=DEVICES.find(device=>device.id==='rift'),journeys=[];
  for(const [id,maxDistance] of [['purifier',200],['core',450]]) {
    const device=DEVICES.find(candidate=>candidate.id===id);
    walk(state,device.anchor);
    for(const [from,target] of [[device,rift],[rift,device]]) {
      const result=walk(state,target.anchor);
      requireCondition(result.routeSequence.every(route=>route==='main'),`${from.id}→${target.id} left the lower floor`);
      requireCondition(result.distance<=maxDistance,`${from.id}→${target.id} detoured ${result.distance}px (limit ${maxDistance}px)`);
      requireCondition(canInteract(state,target),`${target.id} operation rejected after local lower-floor route`);
      journeys.push({from:from.id,to:target.id,maxDistance,...result});
    }
  }
  return {journeys};
});
await test('Both ramps in both directions, whole loop clockwise and counterclockwise',()=>{
  const loop=[WAYPOINTS.leftBottom,WAYPOINTS.leftMiddle,WAYPOINTS.leftTop,WAYPOINTS.upperMiddle,
    WAYPOINTS.rightTop,WAYPOINTS.rightMiddle,WAYPOINTS.rightBottom,WAYPOINTS.mainRight,SPAWN];
  const journeys=[];
  for(const [name,targets] of [['clockwise',loop],['counterclockwise',[...loop.slice(0,-1)].reverse().concat(SPAWN)]]) {
    const segments=targets.map(target=>walk(state,target));
    const sequence=segments.flatMap(segment=>segment.routeSequence);
    for(const route of Object.keys(FLOORS)) requireCondition(sequence.includes(route),`${name} omitted ${route}`);
    requireCondition(Math.hypot(state.x-SPAWN.x,state.y-SPAWN.y)<.05,`${name} did not close the loop at spawn`);
    journeys.push({name,frames:segments.reduce((sum,segment)=>sum+segment.frames,0),routeSequence:sequence.filter((route,i)=>i===0||route!==sequence[i-1])});
  }
  return {journeys};
});
await test('Ramp mouths have multiple usable lines and room for turning',()=>{
  const mouths=[];
  for(const [id,point,tangent] of [
    ['leftTop',WAYPOINTS.leftTop,{x:1,y:0}],['leftBottom',WAYPOINTS.leftBottom,{x:1,y:0}],
    ['rightTop',WAYPOINTS.rightTop,{x:.4,y:-.9165}],['rightBottom',WAYPOINTS.rightBottom,{x:.4,y:-.9165}],
  ]) {
    const points=[-10,0,10].map(offset=>({x:point.x+tangent.x*offset,y:point.y+tangent.y*offset}));
    for(const p of points) {requireCondition(canStand(p),`${id} has no lateral margin`);walk(state,p);}
    mouths.push({id,clearanceAtCenter:round(clearance(point)),testedCenterSpan:20});
  }
  // Explicit downhill arrival, left turn toward core, turn back uphill.
  const sequence=[WAYPOINTS.rightTop,WAYPOINTS.rightMiddle,WAYPOINTS.rightBottom,WAYPOINTS.mainRight,
    DEVICES.find(d=>d.id==='core').anchor,WAYPOINTS.mainRight,WAYPOINTS.rightBottom,WAYPOINTS.rightMiddle,WAYPOINTS.rightTop];
  const frames=sequence.map(point=>walk(state,point)).reduce((sum,result)=>sum+result.frames,0);
  return {mouths,rightBottomTurnFrames:frames};
});
await test('Upper cross passage supports three parallel walked lanes',()=>{
  const lanes=[];
  for(const y of [445,455,465]) {
    walk(state,{x:270,y});
    const result=walk(state,{x:560,y});
    requireCondition(result.routeSequence.every(route=>route==='upper'),'Cross passage escaped upper floor');
    lanes.push({y,...result});
  }
  return {lanes};
});
await test('Devices reject sustained direct movement through their solid feet',()=>{
  const results=[];
  for(const device of DEVICES) {
    walk(state,device.anchor);
    for(let frame=0;frame<120;frame++) moveFrame(state,{x:device.x-state.x,y:device.y-state.y});
    const blockedAt={x:round(state.x),y:round(state.y)};
    requireCondition(clearance(state)<.01,`${device.id} collision was not actually contacted`);
    results.push({id:device.id,blockedAt,clearance:round(clearance(state))});
  }
  return {results};
});
await test('Exposed edges block outward input and allow tangent sliding without sticking',()=>{
  const edges=[];
  for(const edge of OUTER_BOUNDARY) {
    if(Math.sqrt(edge.lengthSquared)<75) continue;
    const middle={x:edge.ax+edge.dx*.5,y:edge.ay+edge.dy*.5};
    let side=1,point={x:middle.x+edge.nx*(SPACE.feetRadius+.3),y:middle.y+edge.ny*(SPACE.feetRadius+.3)};
    if(!canStand(point)) {side=-1;point={x:middle.x-edge.nx*(SPACE.feetRadius+.3),y:middle.y-edge.ny*(SPACE.feetRadius+.3)};}
    if(!canStand(point)) continue;
    walk(state,point);
    for(let frame=0;frame<12;frame++) moveFrame(state,{x:-edge.nx*side,y:-edge.ny*side});
    requireCondition(clearance(state)<.01,'Outward input did not contact edge');
    const start={...state},length=Math.sqrt(edge.lengthSquared);
    for(let frame=0;frame<8;frame++) moveFrame(state,{x:edge.dx/length-edge.nx*side,y:edge.dy/length-edge.ny*side});
    const slid=Math.hypot(state.x-start.x,state.y-start.y);
    requireCondition(slid>10,`Stuck at exposed edge ${JSON.stringify(middle)}`);
    edges.push({midpoint:middle,slide:round(slid)});
  }
  requireCondition(edges.length>=8,'Too few exposed edges were exercised');
  return {testedEdges:edges.length,edges};
});
await test('100ms and large-delta movement stays bounded; paused and unfocused inputs stop',()=>{
  walk(state,SPAWN,100);
  const a=createState(),b=createState();stepMovement(a,{x:1,y:1},100);stepMovement(b,{x:1,y:1},60000);
  requireCondition(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,'Huge delta differs from 100ms cap');
  const controller=createController(),initial={...controller.state};
  controller.keys.add('KeyD');setFocus(controller,false);stepController(controller,60000);
  requireCondition(controller.keys.size===0,'Blur did not clear held keys');
  requireCondition(controller.state.x===initial.x&&controller.state.y===initial.y,'Blur moved player');
  setFocus(controller,true);stepController(controller,16);
  requireCondition(controller.state.x===initial.x&&controller.state.y===initial.y,'Focus restored stale held input');
  controller.keys.add('KeyD');setPaused(controller,true);stepController(controller,60000);
  requireCondition(controller.keys.size===0&&controller.state.x===initial.x&&controller.state.y===initial.y,'Pause moved player');
  const before={...state};
  for(const delta of [NaN,Infinity,0,-10]) stepMovement(state,{x:1,y:1},delta);
  stepMovement(state,{x:NaN,y:1},16);
  requireCondition(state.x===before.x&&state.y===before.y,'Invalid input changed position');
  return {largeDeltaDisplacement:round(Math.hypot(a.x-SPAWN.x,a.y-SPAWN.y)),maxAllowed:SPACE.speed*.1};
});
await test('Seeded varied-direction / large-frame collision stress',()=>{
  let seed=17123;
  for(let i=0;i<6000;i++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const angle=seed/2**32*Math.PI*2;
    moveFrame(state,{x:Math.cos(angle),y:Math.sin(angle)},i%37===0?20000:(i%5+1)*13);
  }
  return {frames:6000,seed:17123};
});
await test('Rounded solid corner contact never starts a following sweep behind the boundary',()=>{
  const fixtures=[
    // The earlier start (749.565,648.361) is inside the moved rift's foot
    // clearance. This valid nearby start reproduces the same old no-skin bug.
    {start:{x:740,y:632.5},inputs:[3.996401718469897,3.2380189808990862].map(angle=>({x:Math.cos(angle),y:Math.sin(angle)}))},
    {start:{x:185.6,y:425.0363200403388},inputs:[{x:0,y:-1},{x:1,y:-1}]},
  ];
  const results=[];
  for(const fixture of fixtures) {
    const corner=createState(fixture.start);
    for(const input of fixture.inputs) moveFrame(corner,input,100);
    for(let frame=0;frame<30;frame++) moveFrame(corner,{x:0,y:-1},100);
    requireCondition(routeAt(corner)!==null,'Corner sweep escaped supported floor');
    results.push({...fixture,deltaMs:100,clearance:round(clearance(corner)),final:{x:round(corner.x),y:round(corner.y)}});
  }
  return {results};
});

report.status=failures.length?'fail':'pass';
report.metrics.distance=round(report.metrics.distance);
report.metrics.minClearance=round(report.metrics.minClearance);
report.geometry={floors:FLOORS,devices:DEVICES.map(({height,...device})=>device),waypoints:WAYPOINTS,spawn:SPAWN};
report.fingerprints={model:createHash('sha256').update(await readFile(new URL('./a-route-model.mjs',import.meta.url))).digest('hex'),
  checker:createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex')};
await writeFile(new URL('./a-route-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.map(({name,status,error})=>({name,status,error})),metrics:report.metrics},null,2));
if(failures.length) process.exitCode=1;
