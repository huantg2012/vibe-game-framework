/** Attempt-local G4 feedback. Fixed probes never become deployed content. */
import type {GeneratedRiftLayout} from '@/generation/types';
import type {Vector2} from '@/types/game-types';
import type {KindlingTier} from '@/types/map-types';
import type {NativeSpatialGeometry} from './native-spatial-geometry';
import type {NativeSpatialGroupResult} from './native-spatial-structures';
import type {NativeSpatialGateResult,NativeSpatialPolicy} from './native-spatial-types';
import {classifyNativeRouteHoleShare,evaluateNativeSpatialRoutes,type NativeSpatialRouteLayout} from './native-spatial-routes';

type Point=Readonly<Vector2>;
export interface NativeSpatialRouteProbe {
  readonly geometrySeed:number;readonly sourceCandidate:number;readonly sourceGeometryHash:string;
  readonly spawnPoint:Point;readonly exitPoint:Point;
  readonly nodes:readonly Readonly<{id:string;kind:'kindling'|'contaminant';tier?:KindlingTier;position:Point}>[];
  readonly baselineEligibleRouteIds:readonly string[];readonly baselineExploreRouteIds:readonly string[];
}
export interface NativeSpatialRouteBoundaryOwner {
  readonly kind:'hole'|'solid'|'exterior';readonly structureId?:string;readonly objectIds:readonly string[];
}
export interface NativeSpatialRouteWitnessEvent {
  readonly structureId:string;readonly kind:'hole'|'solid';readonly at:number;readonly point:Point;readonly objectIds:readonly string[];
}
export interface NativeSpatialRouteWitnessSection {
  readonly at:number;readonly center:Point;readonly widthLowerPx:number;readonly closed:true;
  readonly hits:readonly [Readonly<{point:Point;owner:NativeSpatialRouteBoundaryOwner}>,Readonly<{point:Point;owner:NativeSpatialRouteBoundaryOwner}>];
}
export interface NativeSpatialRouteWitness {
  readonly routeId:string;readonly kind:'hole-share'|'window'|'narrow';readonly severity:number;
  readonly points:readonly Point[];readonly events:readonly NativeSpatialRouteWitnessEvent[];
  readonly windowEvents?:readonly NativeSpatialRouteWitnessEvent[];
  readonly crossSections?:readonly NativeSpatialRouteWitnessSection[];
}
export interface NativeSpatialRouteFeedback {
  readonly probe:NativeSpatialRouteProbe;readonly gate:NativeSpatialGateResult;
  readonly comparable:boolean;readonly comparabilityReasons:readonly string[];
  /** Fixed direct/node-ID/4×3-region ordering, four axes per route. */
  readonly violations:readonly number[];readonly maximum:number;readonly sum:number;
  readonly witnesses:readonly NativeSpatialRouteWitness[];
  /** Existing base's raw deduplicated tuple cursor, including illegal trials. */
  readonly refinementOrdinal:number;
  /** All bases descended from the first failed full share this remainder. */
  readonly remainingTupleBudget:number;
  readonly seenTupleKeys:readonly string[];
}
interface RouteRecord {
  readonly id:string;readonly eligible:boolean;readonly lengthPx:number;readonly smoothedPoints:readonly Point[];
  readonly events:readonly Readonly<{id:string;kind:'hole'|'solid';at:number}>[];readonly windowFailures:readonly number[];
  readonly transverse:Readonly<{narrowRatio:number;maxNarrowOrUncertainRunPx:number;sections:readonly Readonly<{at:number;kind:string;span?:number;closed?:boolean;widthLowerPx?:number;sides?:readonly number[]}>[]}>;
}
/** Trusted same-source gate payload, checked at its runtime boundary. */
function records(gate:NativeSpatialGateResult):readonly RouteRecord[] {
  const routes=gate.metrics.routes;if(!Array.isArray(routes))return[];
  return routes as RouteRecord[];
}
function routeLayout(probe:NativeSpatialRouteProbe):NativeSpatialRouteLayout {
  return{spawnPoint:probe.spawnPoint,extractionPoint:{position:probe.exitPoint},kindlingNodes:probe.nodes.filter(n=>n.kind==='kindling'),contaminantNodes:probe.nodes.filter(n=>n.kind==='contaminant')};
}
export function freezeNativeSpatialRouteProbe(geometrySeed:number,sourceCandidate:number,sourceGeometryHash:string,layout:GeneratedRiftLayout,gate:NativeSpatialGateResult):NativeSpatialRouteProbe {
  if(gate.accepted||!sourceGeometryHash||!records(gate).length)throw new Error('Native route probe requires a rejected actual complete route family');
  const nodes=[...layout.kindlingNodes.map(n=>({...n,kind:'kindling' as const})),...layout.contaminantNodes.map(n=>({...n,kind:'contaminant' as const}))]
    .sort((a,b)=>a.id.localeCompare(b.id)).map(({id,kind,tier,position})=>Object.freeze({id,kind,...(tier?{tier}:{}),position:Object.freeze({...position})}));
  if(new Set(nodes.map(n=>n.id)).size!==nodes.length)throw new Error('Native route probe contains duplicate node IDs');
  return Object.freeze({geometrySeed,sourceCandidate,sourceGeometryHash,spawnPoint:Object.freeze({...layout.spawnPoint}),exitPoint:Object.freeze({...layout.extractionPoint.position}),nodes:Object.freeze(nodes),
    baselineEligibleRouteIds:Object.freeze(records(gate).filter(r=>r.eligible).map(r=>r.id)),baselineExploreRouteIds:Object.freeze(records(gate).filter(r=>r.id.startsWith('explore:')).map(r=>r.id))});
}
function pointAt(points:readonly Point[],at:number):Point {
  if(!points.length)throw new Error('Native route witness has no actual path');let left=Math.max(0,at);
  for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!,span=Math.hypot(b.x-a.x,b.y-a.y);if(left<=span){const t=span?left/span:0;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}left-=span;}
  return{...points[points.length-1]!};
}
/** Exact accepted-integer distance, rather than a continuous ratio surrogate. */
export function nativeSpatialRouteViolationVector(probe:NativeSpatialRouteProbe,gate:NativeSpatialGateResult,policy:NativeSpatialPolicy):Readonly<{violations:readonly number[];comparabilityReasons:readonly string[]}> {
  const routes=records(gate),byId=new Map(routes.map(r=>[r.id,r])),reasons:string[]=[],violations:number[]=[];
  for(const id of probe.baselineEligibleRouteIds)if(!byId.get(id)?.eligible)reasons.push(`${id}:lost-baseline-eligibility`);
  for(const id of probe.baselineExploreRouteIds)if(!byId.has(id))reasons.push(`${id}:lost-baseline-region`);
  for(const node of probe.nodes)if(!byId.has(`node:${node.id}`))reasons.push(`node:${node.id}:lost-legal-seat`);
  if(!byId.has('direct-exit'))reasons.push('direct-exit:missing');
  if(!routes.some(route=>route.eligible))reasons.push('insufficient-complete-route-encounter-evidence');
  const ids=['direct-exit',...probe.nodes.map(n=>`node:${n.id}`),...Array.from({length:12},(_,i)=>`explore:${i}`)];
  for(const id of ids){const r=byId.get(id);if(!r){violations.push(0,0,0,0);continue;}
    let share=0,window=0;
    if(r.eligible){const n=r.events.length,h=r.events.filter(e=>e.kind==='hole').length;let missing=Infinity;
      for(let k=0;k<=n;k++)if(classifyNativeRouteHoleShare(k,n,policy).accepted)missing=Math.min(missing,Math.abs(k-h));share=missing/n;
      for(let i=0;i+policy.windowSize<=n;i++){const holes=r.events.slice(i,i+policy.windowSize).filter(e=>e.kind==='hole').length;window=Math.max(window,Math.max(0,policy.minWindowHoles-holes)/policy.minWindowHoles);}}
    violations.push(share,window,Math.max(0,r.transverse.narrowRatio/policy.maxNarrowRatio-1),Math.max(0,r.transverse.maxNarrowOrUncertainRunPx/policy.maxNarrowRunPx-1));
  }
  return{violations,comparabilityReasons:reasons};
}
function witnesses(gate:NativeSpatialGateResult,geometry:NativeSpatialGeometry,groups:NativeSpatialGroupResult,ground:NativeSpatialGateResult,policy:NativeSpatialPolicy):readonly NativeSpatialRouteWitness[] {
  const structures=new Map(groups.structures.map(s=>[s.id,s]));
  const profiles=Array.isArray(ground.metrics.holeProfileMeasurements)?ground.metrics.holeProfileMeasurements as readonly {holeId:string;finalLabel:number}[]:[];
  const objectIds=(id:string):readonly string[]=>{const s=structures.get(id);if(!s)return[];if(s.kind==='solid')return s.assemblyIds;
    const label=groups.holeLabelByCell[s.cells[0]!];return profiles.filter(p=>p.finalLabel===label).map(p=>p.holeId);};
  const owner=(p:Point):NativeSpatialRouteBoundaryOwner|undefined=>{const matches=groups.structures.filter(s=>s.distance(p)<1e-5);
    if(matches.length===1){const s=matches[0]!,ids=objectIds(s.id);return ids.length?{kind:s.kind,structureId:s.id,objectIds:ids}:undefined;}
    if(matches.length===0&&geometry.voidDistance(p)<1e-5)return{kind:'exterior',objectIds:[]};return undefined;};
  const result:NativeSpatialRouteWitness[]=[];
  for(const r of records(gate)){
    const events=r.events.map(e=>({structureId:e.id,kind:e.kind,at:e.at,point:pointAt(r.smoothedPoints,e.at),objectIds:objectIds(e.id)}));
    if(gate.reasons.includes(`${r.id}:hole-share`))result.push({routeId:r.id,kind:'hole-share',severity:1,points:r.smoothedPoints,events});
    for(const offset of r.windowFailures)result.push({routeId:r.id,kind:'window',severity:1,points:r.smoothedPoints,events,windowEvents:events.slice(offset,offset+policy.windowSize)});
    if(!gate.reasons.includes(`${r.id}:narrow-transverse-opening`))continue;
    // Match the official continuous narrow/uncertain run and +/-32px axis.
    let current:typeof r.transverse.sections[number][]=[],longest:typeof current=[],length=0,maxLength=-1;
    const keep=():void=>{if(length>maxLength){maxLength=length;longest=current;}current=[];length=0;};
    for(const section of r.transverse.sections){if(section.kind==='wide'){keep();continue;}current.push(section);length+=Math.min(8,Math.max(0,r.lengthPx-section.at));}keep();
    const crossSections:NativeSpatialRouteWitnessSection[]=[];
    for(const s of longest){if(!s.closed||s.kind!=='narrow'||s.widthLowerPx===undefined||s.sides?.length!==2)continue;
      const center=pointAt(r.smoothedPoints,s.at),a=pointAt(r.smoothedPoints,s.at-32),b=pointAt(r.smoothedPoints,s.at+32),dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy);if(n<1e-7)continue;
      const hits=([-1,1] as const).map((sign,i)=>{const point={x:center.x-dy/n*sign*s.sides![i]!,y:center.y+dx/n*sign*s.sides![i]!};return{point,owner:owner(point)};});
      if(hits[0]!.owner&&hits[1]!.owner)crossSections.push({at:s.at,center,widthLowerPx:s.widthLowerPx,closed:true,hits:[{point:hits[0]!.point,owner:hits[0]!.owner},{point:hits[1]!.point,owner:hits[1]!.owner}]});
    }
    crossSections.sort((a,b)=>a.widthLowerPx-b.widthLowerPx||a.at-b.at);
    result.push({routeId:r.id,kind:'narrow',severity:Math.max(r.transverse.narrowRatio/policy.maxNarrowRatio,r.transverse.maxNarrowOrUncertainRunPx/policy.maxNarrowRunPx),points:r.smoothedPoints,events,crossSections});
  }
  return result;
}
export function assessNativeSpatialRouteFeedback(probe:NativeSpatialRouteProbe,gate:NativeSpatialGateResult,geometry:NativeSpatialGeometry,groups:NativeSpatialGroupResult,ground:NativeSpatialGateResult,policy:NativeSpatialPolicy):NativeSpatialRouteFeedback {
  const score=nativeSpatialRouteViolationVector(probe,gate,policy),reasons=[...score.comparabilityReasons];
  // Nodes need an actual legal 48px interaction seat, already checked by the
  // official route evaluator. Their visual centres are not player body seats.
  for(const [id,point]of [['spawn',probe.spawnPoint],['exit',probe.exitPoint]] as const)
    if(!geometry.collision.supports(point,10,10))reasons.push(`${id}:lost-body-support`);
  const comparable=reasons.length===0,violations=score.violations;
  return{probe,gate,comparable,comparabilityReasons:reasons,violations,maximum:comparable?Math.max(0,...violations):Infinity,sum:comparable?violations.reduce((a,b)=>a+b,0):Infinity,
    witnesses:comparable?witnesses(gate,geometry,groups,ground,policy):[],refinementOrdinal:0,remainingTupleBudget:48,seenTupleKeys:[]};
}
export function evaluateNativeSpatialRouteProbe(probe:NativeSpatialRouteProbe,geometry:NativeSpatialGeometry,groups:NativeSpatialGroupResult,ground:NativeSpatialGateResult,policy:NativeSpatialPolicy,checkpoint:()=>void):NativeSpatialRouteFeedback {
  checkpoint();const gate=evaluateNativeSpatialRoutes(geometry,groups.structures,policy,routeLayout(probe));checkpoint();
  const result=assessNativeSpatialRouteFeedback(probe,gate,geometry,groups,ground,policy);checkpoint();return result;
}
