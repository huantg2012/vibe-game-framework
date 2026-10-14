/** Whole-object capacity assignment on a finite, frozen L-B field. */
import type {Vector2} from '@/types/game-types';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialPrimitive} from './native-spatial-geometry';
import type {NativeSpatialPlanningGround} from './native-spatial-bay-layout';
import {compareNativeSpatialConstraintScores,type NativeSpatialConstraintScore} from './native-spatial-wide-domain';

type Point=Readonly<Vector2>;
export interface NativeSpatialInitialObject {
  readonly id:string;readonly kind:'hole'|'solid';
  readonly support:readonly NativeSpatialPrimitive[];readonly blocking:readonly NativeSpatialPrimitive[];
}
export interface NativeSpatialInitialPlacement {readonly id:string;readonly site:Point}
interface DomainSummary {readonly id:string;readonly count:number;readonly checked:number;readonly bounds:Readonly<{minX:number;minY:number;maxX:number;maxY:number}>|null}
interface AssignmentEdge {readonly objectId:string;readonly region:number;readonly site:Point;readonly cost:number}
interface Conflict {readonly a:NativeSpatialInitialPlacement;readonly b:NativeSpatialInitialPlacement}
interface StateTrace {
  readonly kind:'matching'|'update';readonly forbidden?:readonly string[];readonly alpha?:number;
  readonly assignment?:readonly AssignmentEdge[];readonly sites?:readonly NativeSpatialInitialPlacement[];
  readonly bottleneck?:number;readonly squaredCost?:number;readonly conflict?:Conflict;
  readonly legal:boolean;readonly reason?:string;score?:NativeSpatialConstraintScore;
}
export interface NativeSpatialInitialTrace {
  status:'planning'|'selected'|'empty-domain'|'fixed-graph-unresolved'|'state-budget';
  readonly field:readonly Point[];readonly objectIds:readonly string[];readonly anchors:Point[];
  readonly responsibilities:number[];readonly domains:DomainSummary[];readonly matrix:AssignmentEdge[][];
  readonly states:StateTrace[];readonly localCandidates:{id:string;sites:readonly Point[];maximum:number;mean:number}[];
  updatedResponsibilities?:readonly string[];selectedState?:number;
  readonly timings:{domainMs:number;matrixMs:number;matchingMs:number;localMs:number;globalMs:number};
  readonly counts:{supportChecks:number;matrixDistanceChecks:number;matchingStates:number;updateStates:number;legalStates:number;localScores:number;globalScores:number};
}
export interface NativeSpatialInitialContext {
  readonly objects:readonly NativeSpatialInitialObject[];readonly ground:NativeSpatialPlanningGround;
  readonly field:readonly Point[];readonly firstAnchorIndex:number;readonly gapPx:number;
  readonly checkpoint:()=>void;
  readonly evaluate:(placements:readonly NativeSpatialInitialPlacement[])=>NativeSpatialConstraintScore;
}
export interface NativeSpatialInitialResult {readonly placements:readonly NativeSpatialInitialPlacement[];readonly trace:NativeSpatialInitialTrace}
export class NativeSpatialInitialPlacementError extends Error {
  constructor(readonly initialPlacement:NativeSpatialInitialTrace){super(`Native initial capacity ${initialPlacement.status} on its fixed finite graph`);}
}
const STATE_LIMIT=12,LOCAL_LIMIT=12;
const orderPoint=(a:Point,b:Point)=>a.y-b.y||a.x-b.x;
const siteKey=(id:string,p:Point)=>`${id}@${p.x},${p.y}`;
const distanceSquared=(a:Point,b:Point)=>(a.x-b.x)**2+(a.y-b.y)**2;
const snapPoint=(p:Point):Point=>({x:Math.round(p.x/8)*8,y:Math.round(p.y/8)*8});
function vertices(primitives:readonly NativeSpatialPrimitive[]):Point[]{
  const unique=new Map<string,Point>();for(const p of primitives)for(let i=0;i<p.points.length;i+=2){const x=p.points[i]!,y=p.points[i+1]!;unique.set(`${x}:${y}`,{x,y});}return[...unique.values()];
}
function translate(primitives:readonly NativeSpatialPrimitive[],p:Point):NativeSpatialPrimitive[]{return primitives.map(t=>nativePrimitive(t.points.map((v,i)=>v+(i%2?p.y:p.x)),t.objectId));}
function overlaps(a:NativeSpatialPrimitive,b:NativeSpatialPrimitive):boolean {
  for(const p of [a,b])for(let i=0;i<p.points.length;i+=2){const j=(i+2)%p.points.length,nx=p.points[i+1]!-p.points[j+1]!,ny=p.points[j]!-p.points[i]!;let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(let k=0;k<a.points.length;k+=2){const d=a.points[k]!*nx+a.points[k+1]!*ny;amin=Math.min(amin,d);amax=Math.max(amax,d);}
    for(let k=0;k<b.points.length;k+=2){const d=b.points[k]!*nx+b.points[k+1]!*ny;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}if(amax<bmin||bmax<amin)return false;
  }return true;
}
function tooClose(a:readonly NativeSpatialPrimitive[],b:readonly NativeSpatialPrimitive[],radius:number):boolean {
  for(const p of a)for(const q of b){if(Math.hypot(Math.max(p.minX-q.maxX,q.minX-p.maxX,0),Math.max(p.minY-q.maxY,q.minY-p.maxY,0))>=radius)continue;
    if(overlaps(p,q))return true;const pt={...p,items:[p]},qt={...q,items:[q]};
    for(let i=0;i<p.points.length;i+=2)if(nativePrimitiveDistance(qt,p.points[i]!,p.points[i+1]!)<radius)return true;
    for(let i=0;i<q.points.length;i+=2)if(nativePrimitiveDistance(pt,q.points[i]!,q.points[i+1]!)<radius)return true;
  }return false;
}
/** Stable minimum-sum assignment under a hard bottleneck. Infinity means a
 * forbidden edge, not a large cost that could become acceptable. */
function minimumAssignment(costs:readonly (readonly number[])[],limit:number,checkpoint:()=>void):number[]|undefined {
  const n=costs.length,u=new Float64Array(n+1),v=new Float64Array(n+1),p=new Int32Array(n+1),way=new Int32Array(n+1);
  for(let i=1;i<=n;i++){checkpoint();p[0]=i;let j0=0;const min=new Float64Array(n+1).fill(Infinity),used=new Uint8Array(n+1);
    do{used[j0]=1;const i0=p[j0]!;let delta=Infinity,j1=0;
      for(let j=1;j<=n;j++)if(!used[j]){const raw=costs[i0-1]![j-1]!,cur=raw<=limit?raw*raw-u[i0]!-v[j]!:Infinity;if(cur<min[j]!){min[j]=cur;way[j]=j0;}if(min[j]!<delta){delta=min[j]!;j1=j;}}
      if(!Number.isFinite(delta))return undefined;
      for(let j=0;j<=n;j++)if(used[j]){u[p[j]!]=u[p[j]!]!+delta;v[j]=v[j]!-delta;}else min[j]=min[j]!-delta;j0=j1;
    }while(p[j0]!==0);
    do{const j1=way[j0]!;p[j0]=p[j1]!;j0=j1;}while(j0!==0);
  }
  const assignment=Array<number>(n);for(let j=1;j<=n;j++)assignment[p[j]!-1]=j-1;return assignment;
}
export function solveNativeSpatialInitialMatching(matrix:readonly (readonly AssignmentEdge[])[],forbidden:ReadonlySet<string>,checkpoint:()=>void):readonly AssignmentEdge[]|undefined {
  const costs=matrix.map(row=>row.map(e=>forbidden.has(siteKey(e.objectId,e.site))?Infinity:e.cost)),thresholds=[...new Set(costs.flat().filter(Number.isFinite))].sort((a,b)=>a-b);
  let lo=0,hi=thresholds.length-1,best:number[]|undefined;
  while(lo<=hi){const mid=(lo+hi)>>1,assignment=minimumAssignment(costs,thresholds[mid]!,checkpoint);if(assignment){best=assignment;hi=mid-1;}else lo=mid+1;}
  if(!best)return undefined;
  // The last successful binary-search solution need not use the final minimum
  // threshold's minimum sum when the final probe failed below it.
  const indices=minimumAssignment(costs,thresholds[lo]!,checkpoint)!;return indices.map((j,i)=>matrix[i]![j]!);
}

export function createNativeSpatialInitialPlacement(context:NativeSpatialInitialContext):NativeSpatialInitialResult {
  const {ground,gapPx,checkpoint}=context,objects=[...context.objects].sort((a,b)=>a.id.localeCompare(b.id)),field=[...context.field];
  if(!objects.length||new Set(objects.map(o=>o.id)).size!==objects.length||field.length<objects.length)throw new Error('Invalid native initial assignment domain');
  if(!Number.isInteger(context.firstAnchorIndex)||context.firstAnchorIndex<0||context.firstAnchorIndex>=field.length)throw new Error('Invalid native first coverage anchor');
  const trace:NativeSpatialInitialTrace={status:'planning',field,objectIds:objects.map(o=>o.id),anchors:[],responsibilities:[],domains:[],matrix:[],states:[],localCandidates:[],timings:{domainMs:0,matrixMs:0,matchingMs:0,localMs:0,globalMs:0},counts:{supportChecks:0,matrixDistanceChecks:0,matchingStates:0,updateStates:0,legalStates:0,localScores:0,globalScores:0}};
  const supportVertices=objects.map(o=>vertices(o.support)),trees=objects.map(o=>nativePrimitiveTree(o.blocking)),supportCache=objects.map(()=>new Map<string,boolean>()),worldCache=objects.map(()=>new Map<string,{blocking:NativeSpatialPrimitive[];support:NativeSpatialPrimitive[]}>());
  const supported=(i:number,p:Point):boolean=>{const key=siteKey(objects[i]!.id,p),cached=supportCache[i]!.get(key);if(cached!==undefined)return cached;
    if((trace.counts.supportChecks++&63)===0)checkpoint();
    const okay=Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x%8===0&&p.y%8===0&&ground.margin(p)>=24&&supportVertices[i]!.every(q=>ground.margin({x:q.x+p.x,y:q.y+p.y})>=24)&&ground.supportsFootprint(objects[i]!.support,p);supportCache[i]!.set(key,okay);return okay;
  };
  const world=(i:number,p:Point)=>{const key=siteKey(objects[i]!.id,p);let value=worldCache[i]!.get(key);if(!value){value={blocking:translate(objects[i]!.blocking,p),support:translate(objects[i]!.support,p)};worldCache[i]!.set(key,value);}return value;};
  const conflict=(sites:readonly Point[]):Conflict|undefined=>{for(let i=0;i<objects.length;i++){checkpoint();for(let j=i+1;j<objects.length;j++){const a=world(i,sites[i]!),b=world(j,sites[j]!);
    if(tooClose(a.blocking,b.blocking,gapPx)||(objects[i]!.kind==='hole'&&tooClose(a.blocking,b.support,24))||(objects[j]!.kind==='hole'&&tooClose(b.blocking,a.support,24)))return{a:{id:objects[i]!.id,site:sites[i]!},b:{id:objects[j]!.id,site:sites[j]!}};
  }}return undefined;};
  const started=performance.now(),siteMap=new Map<string,Point>();for(const p of field){const site=snapPoint(p);siteMap.set(`${site.x}:${site.y}`,site);}const sites=[...siteMap.values()].sort(orderPoint);
  const domains=objects.map((object,i)=>{const domain=sites.filter(p=>supported(i,p));trace.domains.push({id:object.id,count:domain.length,checked:sites.length,bounds:domain.length?{minX:Math.min(...domain.map(p=>p.x)),minY:Math.min(...domain.map(p=>p.y)),maxX:Math.max(...domain.map(p=>p.x)),maxY:Math.max(...domain.map(p=>p.y))}:null});return domain;});trace.timings.domainMs=performance.now()-started;
  if(domains.some(d=>!d.length)){trace.status='empty-domain';throw new NativeSpatialInitialPlacementError(trace);}
  trace.anchors.push(field[context.firstAnchorIndex]!);const nearest=field.map(p=>distanceSquared(p,trace.anchors[0]!));
  while(trace.anchors.length<objects.length){checkpoint();let selected=0;for(let i=1;i<field.length;i++)if(nearest[i]!>nearest[selected]!||(nearest[i]===nearest[selected]&&orderPoint(field[i]!,field[selected]!)<0))selected=i;const anchor=field[selected]!;trace.anchors.push(anchor);for(let i=0;i<field.length;i++)nearest[i]=Math.min(nearest[i]!,distanceSquared(field[i]!,anchor));}
  const regions=trace.anchors.map(()=>[] as number[]);field.forEach((p,index)=>{let selected=0;for(let j=1;j<trace.anchors.length;j++)if(distanceSquared(p,trace.anchors[j]!)<distanceSquared(p,trace.anchors[selected]!))selected=j;trace.responsibilities.push(selected);regions[selected]!.push(index);});
  const nearestSite=(i:number,target:Point):Point=>{let best=domains[i]![0]!,distance=distanceSquared(best,target);for(const p of domains[i]!){if((trace.counts.matrixDistanceChecks++&1023)===0)checkpoint();const next=distanceSquared(p,target);if(next<distance||(next===distance&&orderPoint(p,best)<0)){best=p;distance=next;}}return best;};
  const domainCost=(i:number,p:Point,indices:readonly number[]):{maximum:number;mean:number}=>{let maximum=0,sum=0;for(let k=0;k<indices.length;k++){if((k&255)===0)checkpoint();const q=field[indices[k]!]!,distance=nativePrimitiveDistance(trees[i]!,q.x-p.x,q.y-p.y);maximum=Math.max(maximum,distance);sum+=distance*distance;}return{maximum,mean:sum/Math.max(1,indices.length)};};
  const matrixStart=performance.now();for(let i=0;i<objects.length;i++)trace.matrix.push(trace.anchors.map((anchor,region)=>{const site=nearestSite(i,anchor);return{objectId:objects[i]!.id,region,site,cost:domainCost(i,site,regions[region]!).maximum};}));trace.timings.matrixMs=performance.now()-matrixStart;
  interface Node {readonly forbidden:readonly string[];readonly assignment:readonly AssignmentEdge[];readonly index:number;readonly bottleneck:number;readonly sum:number}
  const queue:Node[]=[],visited=new Set<string>();let truncated=false;
  const solve=(forbidden:readonly string[]):void=>{const key=JSON.stringify(forbidden);if(visited.has(key))return;if(trace.states.length>=STATE_LIMIT){truncated=true;return;}visited.add(key);checkpoint();
    const start=performance.now(),assignment=solveNativeSpatialInitialMatching(trace.matrix,new Set(forbidden),checkpoint);trace.counts.matchingStates++;
    if(!assignment){trace.states.push({kind:'matching',forbidden,legal:false,reason:'no-complete-matching'});trace.timings.matchingMs+=performance.now()-start;return;}
    const positions=assignment.map(e=>e.site),collision=conflict(positions),bottleneck=Math.max(...assignment.map(e=>e.cost)),sum=assignment.reduce((n,e)=>n+e.cost*e.cost,0),index=trace.states.length;
    trace.states.push({kind:'matching',forbidden,assignment,bottleneck,squaredCost:sum,legal:!collision,...(collision?{conflict:collision}:{})});if(!collision)trace.counts.legalStates++;
    queue.push({forbidden,assignment,index,bottleneck,sum});trace.timings.matchingMs+=performance.now()-start;
  };
  solve([]);let base:Node|undefined;
  while(queue.length){checkpoint();queue.sort((a,b)=>a.bottleneck-b.bottleneck||a.sum-b.sum||JSON.stringify(a.forbidden).localeCompare(JSON.stringify(b.forbidden)));const node=queue.shift()!,collision=trace.states[node.index]!.conflict;
    if(!collision){base=node;break;}
    for(const pose of [collision.a,collision.b])solve([...new Set([...node.forbidden,siteKey(pose.id,pose.site)])].sort());
  }
  if(!base){trace.status=truncated?'state-budget':'fixed-graph-unresolved';throw new NativeSpatialInitialPlacementError(trace);}
  const evaluate=(positions:readonly Point[]):NativeSpatialConstraintScore=>{checkpoint();const start=performance.now(),score=context.evaluate(positions.map((site,i)=>({id:objects[i]!.id,site})));trace.timings.globalMs+=performance.now()-start;trace.counts.globalScores++;checkpoint();return score;};
  const baseSites=base.assignment.map(e=>e.site);let selected=baseSites,best=evaluate(baseSites),selectedState=base.index;trace.states[base.index]!.score=best;
  if(best.maximum>0&&trace.states.length<STATE_LIMIT){const localStart=performance.now(),responsibilities=objects.map(()=>[] as number[]);trace.updatedResponsibilities=[];const labels:string[]=[];
    for(let k=0;k<field.length;k++){if((k&255)===0)checkpoint();const p=field[k]!;let owner=0,distance=Infinity;for(let i=0;i<objects.length;i++){const site=baseSites[i]!,d=nativePrimitiveDistance(trees[i]!,p.x-site.x,p.y-site.y);if(d<distance){owner=i;distance=d;}}responsibilities[owner]!.push(k);labels.push(objects[owner]!.id);}trace.updatedResponsibilities=labels;
    const targets=objects.map((object,i)=>{const indices=responsibilities[i]!,baseSite=baseSites[i]!;if(!indices.length)return baseSite;
      let farthest=indices[0]!,farDistance=-Infinity,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const index of indices){const p=field[index]!,d=nativePrimitiveDistance(trees[i]!,p.x-baseSite.x,p.y-baseSite.y);if(d>farDistance||(d===farDistance&&orderPoint(p,field[farthest]!)<0)){farthest=index;farDistance=d;}minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
      const centre={x:(minX+maxX)/2,y:(minY+maxY)/2},far=field[farthest]!,candidates=new Map<string,Point>();
      for(const anchor of [baseSite,centre,far])for(const alpha of [0,.25,.5,1]){const target={x:baseSite.x+(anchor.x-baseSite.x)*alpha,y:baseSite.y+(anchor.y-baseSite.y)*alpha},site=nearestSite(i,target);candidates.set(siteKey(object.id,site),site);}
      let chosen=baseSite,score={maximum:Infinity,mean:Infinity};const considered=[...candidates.values()].slice(0,LOCAL_LIMIT);
      for(const site of considered){const next=domainCost(i,site,indices);trace.counts.localScores++;if(next.maximum<score.maximum||(next.maximum===score.maximum&&(next.mean<score.mean||(next.mean===score.mean&&orderPoint(site,chosen)<0)))){chosen=site;score=next;}}
      trace.localCandidates.push({id:object.id,sites:considered,...score});return chosen;
    });trace.timings.localMs=performance.now()-localStart;
    // t=0 is the already validated/scored baseline, not a free extra state.
    for(const alpha of [1,.5,.25]){if(trace.states.length>=STATE_LIMIT)break;checkpoint();const positions=baseSites.map((p,i)=>snapPoint({x:p.x+(targets[i]!.x-p.x)*alpha,y:p.y+(targets[i]!.y-p.y)*alpha})),placements=positions.map((site,i)=>({id:objects[i]!.id,site}));
      const unsupported=positions.some((site,i)=>!supported(i,site)),collision=unsupported?undefined:conflict(positions),row:StateTrace={kind:'update',alpha,sites:placements,legal:!unsupported&&!collision,...(unsupported?{reason:'ground-support'}:{}),...(collision?{conflict:collision}:{})};trace.states.push(row);trace.counts.updateStates++;
      if(!row.legal)continue;trace.counts.legalStates++;const score=evaluate(positions);row.score=score;if(compareNativeSpatialConstraintScores(score,best)<0){selected=positions;best=score;selectedState=trace.states.length-1;}
    }
  }
  trace.status='selected';trace.selectedState=selectedState;return{placements:selected.map((site,i)=>({id:objects[i]!.id,site})),trace};
}
