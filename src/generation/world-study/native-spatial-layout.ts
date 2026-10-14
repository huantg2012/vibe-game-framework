/** Whole-layout proposals from frozen intent. No old placement/void rectangle is an input. */
import {mix32} from '@/generation/seed-fork';
import type {Vector2} from '@/types/game-types';
import {buildNativeVolume} from './native-volume-geometry';
import type {MasterDefinition} from './r100-master-world';
import type {NativeSpatialFrozenInput,NativeSpatialHoleProfile,NativeSpatialGateResult,NativeSpatialGeometryWork} from './native-spatial-types';
import {NativeSpatialGeometryWorkBudgetError} from './native-spatial-types';
import type {NativeSpatialAssemblyPlacement,NativeSpatialHolePlacement,NativeSpatialBayPlacement,NativeSpatialLandJoin} from './native-spatial-structures';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialPrimitive,type NativeSpatialActualVoidFeedback} from './native-spatial-geometry';
import {compileR100FragmentShape,type R100FrozenFragmentShape} from './r100-fragment-shape';
import type {FragmentRect} from './fragment-shape';
import {qualifyNativeSpatialHoles,selectNativeSpatialQualifiedSite,NATIVE_SPATIAL_SITE_EVALUATION_LIMIT,type NativeSpatialHoleQualification} from './native-spatial-hole-qualification';
import {createNativeSpatialInitialPlacement,type NativeSpatialInitialTrace} from './native-spatial-initial-placement';
import {NativeSpatialG1Field,nativeSpatialG1HoleShapes,nativeSpatialG1ExteriorRadius,nativeSpatialG1FilledDistance,type NativeSpatialG1FieldTrace,type NativeSpatialG1VoidContains} from './native-spatial-g1-field';
import {createNativeSpatialLand,type NativeSpatialLandPlate} from './native-spatial-land';
import {createNativeSpatialBays,createNativeSpatialPlanningGround,nativeSpatialLandJoins,type NativeSpatialPlanningGround} from './native-spatial-bay-layout';
import {NativeSpatialWideDomain,nativeSpatialConstraintScore,compareNativeSpatialConstraintScores,type NativeSpatialConstraintScore,type NativeSpatialWidePlacement,type NativeSpatialWideMeasurement} from './native-spatial-wide-domain';
import {refineNativeSpatialJointObjects,nativeSpatialConstraintsImproved,type NativeSpatialJointResult} from './native-spatial-joint-refinement';
import {selectNativeSpatialRoutePlacement,type NativeSpatialRouteRefinement} from './native-spatial-route-layout';
import type {NativeSpatialRouteFeedback} from './native-spatial-route-feedback';

type Rect=[number,number,number,number];
type Instance=MasterDefinition['instances'][number];
export interface NativeSpatialLayout {
  readonly candidate:number;readonly countPairIndex:number;readonly bayCountIndex:number;readonly layoutSeed:number;readonly definition:MasterDefinition;
  readonly fragmentShape:R100FrozenFragmentShape;readonly assemblies:readonly NativeSpatialAssemblyPlacement[];
  readonly requestedCounts:Readonly<{holes:number;solids:number}>;
  readonly holes:readonly NativeSpatialHolePlacement[];readonly bays:readonly NativeSpatialBayPlacement[];readonly landJoins:readonly NativeSpatialLandJoin[];
  readonly plan:NativeSpatialPlan;
}
class Stream {
  constructor(private readonly seed:number,private at=0){}
  get drawCount():number{return this.at;}
  next():number{return mix32(this.seed,`native-layout-draw-${this.at++}`)/0x100000000;}
  range(min:number,max:number):number{return min+(max-min)*this.next();}
  integer(min:number,max:number):number{return min+Math.floor(this.next()*(max-min+1));}
  choose<T>(items:readonly T[]):T{if(!items.length)throw new Error('Empty native authoring choice');return items[this.integer(0,items.length-1)]!;}
}
const snap=(v:number)=>Math.round(v/8)*8;
function rectArea(rects:readonly Rect[]):number{
  const xs=[...new Set(rects.flatMap(r=>[r[0],r[0]+r[2]]))].sort((a,b)=>a-b);let area=0;
  for(let i=0;i<xs.length-1;i++){
    const x=(xs[i]!+xs[i+1]!)/2,spans=rects.filter(r=>x>r[0]&&x<r[0]+r[2]).map(r=>[r[1],r[1]+r[3]]).sort((a,b)=>a[0]!-b[0]!);let start=0,end=0,length=0;
    spans.forEach((s,j)=>{if(j===0){start=s[0]!;end=s[1]!;}else if(s[0]!<=end)end=Math.max(end,s[1]!);else{length+=end-start;start=s[0]!;end=s[1]!;}});if(spans.length)length+=end-start;area+=(xs[i+1]!-xs[i]!)*length;
  }return area;
}
export function nativeSpatialCountPairs(input:NativeSpatialFrozenInput):readonly {holes:number;solids:number}[]{
  const {policy:p,world:w}=input,n=Math.round(w.targetWalkAreaPx2/(p.planningCellFactor*p.spacingPx*p.spacingPx)),pairs:{holes:number;solids:number}[]=[];
  for(let total=Math.ceil(n*(1-p.countToleranceRatio));total<=Math.floor(n*(1+p.countToleranceRatio));total++)for(let solids=Math.max(p.minSolidCount,input.assemblies.length);solids<total;solids++){
    const holes=total-solids;if(p.requireMoreHoles&&holes<=solids)continue;
    if(Math.abs(holes-p.holeToSolidRatio*solids)<=Math.max(p.holeCountAbsTolerance,p.holeCountRelTolerance*solids))pairs.push({holes,solids});
  }
  return pairs.sort((a,b)=>Math.abs(a.holes/a.solids-p.holeToSolidRatio)-Math.abs(b.holes/b.solids-p.holeToSolidRatio)||(a.holes+a.solids)-(b.holes+b.solids)||a.solids-b.solids);
}
function meshPrimitives(instances:readonly Instance[],native:MasterDefinition,seed:number,includeRelief=false):NativeSpatialPrimitive[]{
  const result:NativeSpatialPrimitive[]=[];
  for(const instance of instances){if(instance.role!=='solid'&&!includeRelief)continue;const {role:_role,groundEdgeWidth:_edge,...source}=instance;
    const mesh=buildNativeVolume({...source,family:instance.family??native.family,blocking:instance.role==='solid'?1:0,seed:seed^Math.imul(instance.id,104729)});
    for(let t=0;t<mesh.triangleCount;t++){const points:number[]=[];for(let c=0;c<3;c++){const at=mesh.indices[t*3+c]!*3;points.push(mesh.positions[at]!,mesh.positions[at+1]!);}if(Math.abs((points[2]!-points[0]!)*(points[5]!-points[1]!)-(points[3]!-points[1]!)*(points[4]!-points[0]!))>1e-7)result.push(nativePrimitive(points,instance.id));}
  }return result;
}
function shifted(primitives:readonly NativeSpatialPrimitive[],x:number,y:number):NativeSpatialPrimitive[]{return primitives.map(p=>nativePrimitive(p.points.map((v,i)=>v+(i%2?y:x)),p.objectId));}
function rectPrimitives(rects:readonly Rect[],id:number):NativeSpatialPrimitive[]{return rects.flatMap(([x,y,w,h])=>[nativePrimitive([x,y,x+w,y,x+w,y+h],id),nativePrimitive([x,y,x+w,y+h,x,y+h],id)]);}
function pointCloud(primitives:readonly NativeSpatialPrimitive[]):Vector2[]{const keys=new Set<string>(),points:Vector2[]=[];for(const p of primitives)for(let i=0;i<p.points.length;i+=2){const x=p.points[i]!,y=p.points[i+1]!,key=`${Math.round(x)}:${Math.round(y)}`;if(!keys.has(key)){keys.add(key);points.push({x,y});}}return points;}
interface JointObject {
  readonly kind:'hole'|'solid'; readonly instances:readonly Instance[]; readonly rects:readonly Rect[];
  readonly profileId?:string;
  readonly assembly?:NativeSpatialAssemblyPlacement; readonly site:Readonly<Vector2>;
}
/** Diagnostic-only frozen unfinished authoring state. No compiled geometry or
 * prior chosen site is reused when comparing initial traversal orders. */
export interface NativeSpatialInitialFixture {
  readonly worldId:string;readonly sourceHash:string;readonly requestedSeed:number;readonly geometrySeed:number;
  readonly candidate:number;readonly layoutSeed:number;readonly countPairIndex:number;readonly bayCountIndex:number;
  readonly requestedCounts:Readonly<{holes:number;solids:number}>;
  readonly land:readonly Rect[];readonly landPlates:readonly NativeSpatialLandPlate[];
  readonly bays:readonly NativeSpatialBayPlacement[];readonly landJoins:readonly NativeSpatialLandJoin[];
  readonly objects:readonly JointObject[];readonly seedSalt:number;readonly randomDrawCount:number;
  readonly candidatePools:readonly (readonly Vector2[])[];
}
/** Coordinates alone are independent of the current placed prefix. Keep the
 * original draw order; rough scores and legality must never be cached here. */
export function nativeSpatialSiteCandidates(site:Readonly<Vector2>,field:readonly Vector2[],preferred:readonly Readonly<Vector2>[],random:Pick<Stream,'choose'|'range'>):Vector2[] {
  const candidates:Vector2[]=[];
  for(const point of preferred)for(const [dx,dy]of [[0,0],[64,0],[-64,0],[0,64],[0,-64]])candidates.push({x:snap(point.x+dx!),y:snap(point.y+dy!)});
  candidates.push({...site});
  for(const distance of [16,32,64])for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])candidates.push({x:snap(site.x+dx!*distance),y:snap(site.y+dy!*distance)});
  for(let i=0;i<160;i++){const at=random.choose(field);candidates.push({x:snap(at.x+random.range(-24,24)),y:snap(at.y+random.range(-24,24))});}
  return candidates;
}
export function nativeSpatialInitialOrder(kinds:readonly ('hole'|'solid')[],mode:'author'|'solids-first'):number[] {
  const indices=kinds.map((_,index)=>index);
  return mode==='author'?indices:[...indices.filter(i=>kinds[i]==='solid'),...indices.filter(i=>kinds[i]==='hole')];
}
export interface NativeSpatialPlacementSearch {readonly objectIndex:number;readonly originalCandidateCount:number;readonly originalLegalCount:number;readonly fallbackUsed:boolean;readonly fallbackSitesChecked:number;readonly evaluatedSites:number;readonly identityChecks:number;readonly identityRejected:number;readonly selectedFrom:'original'|'field'|'none'}
export interface NativeSpatialRefinement {readonly kind:'single'|'joint'|'route';readonly route?:NativeSpatialRouteRefinement;readonly before:NativeSpatialConstraintScore;readonly after:NativeSpatialConstraintScore;readonly constraintsImproved:boolean;readonly joint?:NativeSpatialJointResult;readonly reason?:string}
interface NativeSpatialPlan {readonly g1Field?:NativeSpatialG1FieldTrace&Readonly<{footprintSource:'raw-authoring'|'previous-actual-void-translation';feedbackCandidate:number|null}>;readonly initialPlacement?:NativeSpatialInitialTrace;readonly placementSearch?:readonly NativeSpatialPlacementSearch[];readonly refinement?:NativeSpatialRefinement;readonly land:readonly Rect[];readonly landPlates:readonly NativeSpatialLandPlate[];readonly bays:readonly NativeSpatialBayPlacement[];readonly objects:readonly JointObject[];readonly assessmentPoints?:readonly Readonly<Vector2>[];readonly deepSpanProxyPx:number;readonly wideEstimate?:Readonly<{rawRatio:number;correction:number;correctedRatio:number;feedbackCandidate:number|null;source?:'actual-void-fixed-body'|'raw-field';wideCount?:number|null;supportedBodySeats?:number|null}>;readonly largestWideRatioProxy?:number|null}
interface PlanningObject {readonly source:JointObject;readonly support:readonly NativeSpatialPrimitive[];readonly blocking:readonly NativeSpatialPrimitive[];readonly g1Blocking:readonly NativeSpatialPrimitive[];readonly g1Void?:NativeSpatialG1VoidContains}
function planningObject(source:JointObject,native:MasterDefinition,seed:number):PlanningObject {
  const blocking=source.kind==='hole'?rectPrimitives(source.rects,-1):meshPrimitives(source.instances,native,seed);
  return{source,support:source.kind==='hole'?blocking:meshPrimitives(source.instances,native,seed,true),blocking,g1Blocking:blocking};
}
/** Read-only diagnostic adapter over the exact planning footprints. Does not
 * compile a map, sample shapes, or perform a placement operation. */
export function nativeSpatialPlanningCoverage(layout:NativeSpatialLayout,geometrySeed:number):readonly Readonly<{id:string;kind:'hole'|'solid';boundary:readonly NativeSpatialPrimitive[]}>[] {
  let hole=0;
  return layout.plan.objects.map(source=>({id:source.kind==='hole'?`hole-${hole++}`:source.assembly!.assemblyId,kind:source.kind,
    boundary:shifted(planningObject(source,layout.definition,geometrySeed).blocking,source.site.x,source.site.y)}));
}
function planningField(ground:NativeSpatialPlanningGround,input:NativeSpatialFrozenInput,seed:number):Vector2[]{
  const points:Vector2[]=[];
  // Stratify on 16px cells but sample real 8px body-centre phases. A fixed
  // 16+32k phase aliases both rectangle edges and the 48px wide-domain radius.
  for(let cy=0;cy<input.world.frameHeightPx;cy+=16)for(let cx=0;cx<input.world.frameWidthPx;cx+=16){
    const phase=mix32(seed,`${input.world.worldId}:native-plan:${cx}:${cy}`),p={x:cx+4+8*(phase&1),y:cy+4+8*((phase>>>1)&1)};
    if(ground.margin(p)>=12)points.push(p);
  }
  return points;
}
function planningWideRatio(points:readonly Readonly<Vector2>[],ground:NativeSpatialPlanningGround,primitives:readonly NativeSpatialPrimitive[],radius:number):number {
  const tree=nativePrimitiveTree(primitives);let walk=0,wide=0;
  for(const p of points){const distance=nativePrimitiveDistance(tree,p.x,p.y);if(distance<10)continue;walk++;if(Math.min(distance,ground.margin(p))>=radius)wide++;}
  return wide/Math.max(1,walk);
}
/** Proposal-only connected-span estimate. Extra exact assessment points are
 * deliberately not grid vertices: they cannot duplicate cells or form bridges. */
export function createNativeDeepSpanProxy(points:readonly Readonly<Vector2>[],thresholdPx:number):(distances:readonly number[])=>number {
  const cellSize=16,cols=Math.max(1,...points.map(p=>Math.floor(p.x/cellSize)+1)),rows=Math.max(1,...points.map(p=>Math.floor(p.y/cellSize)+1)),count=cols*rows;
  const pointByCell=new Int32Array(count).fill(-1),cells:number[]=[];
  points.forEach((p,index)=>{const cell=Math.floor(p.y/cellSize)*cols+Math.floor(p.x/cellSize);if(pointByCell[cell]!==-1)throw new Error('Duplicate native planning-field cell');pointByCell[cell]=index;cells.push(cell);});
  const neighbors=new Int32Array(count*8).fill(-1),directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]] as const;
  for(const cell of cells){const x=cell%cols,y=Math.floor(cell/cols);for(let d=0;d<directions.length;d++){
    const [dx,dy]=directions[d]!,nx=x+dx,ny=y+dy,next=ny*cols+nx;if(nx<0||ny<0||nx>=cols||ny>=rows||pointByCell[next]===-1)continue;
    if(dx&&dy&&(pointByCell[y*cols+nx]===-1||pointByCell[ny*cols+x]===-1))continue;neighbors[cell*8+d]=next;
  }}
  const seen=new Uint32Array(count),deep=new Uint8Array(count),queue=new Int32Array(cells.length);let version=0;
  return distances=>{
    if(distances.length<points.length)throw new Error('Missing native planning-field distances');
    if(++version===0xffffffff){seen.fill(0);version=1;}
    for(const cell of cells)deep[cell]=Number(distances[pointByCell[cell]!]!+Math.SQRT2*4>thresholdPx);
    let maximum=0;
    for(const start of cells)if(deep[start]&&seen[start]!==version){
      let head=0,tail=1,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;queue[0]=start;seen[start]=version;
      while(head<tail){const cell=queue[head++]!,x=cell%cols,y=Math.floor(cell/cols);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        for(let d=0;d<8;d++){const next=neighbors[cell*8+d]!;if(next<0||!deep[next]||seen[next]===version)continue;seen[next]=version;queue[tail++]=next;}
      }
      maximum=Math.max(maximum,(maxX-minX+1)*cellSize,(maxY-minY+1)*cellSize);
    }
    return maximum;
  };
}
/** Refinement prediction uses the measured VOID numerator and the previous
 * actual body denominator. Moving objects can change that denominator; only
 * the next complete compile establishes the candidate's actual area ratio. */
export function nativeSpatialPlanningWideRatio(rawRatio:number,correction:number,measurement?:NativeSpatialWideMeasurement,supportedBodySeats?:number):number {
  if(!measurement)return Math.max(Number.EPSILON,rawRatio+correction);
  if(!Number.isSafeInteger(supportedBodySeats)||supportedBodySeats!<=0)throw new Error('Measured native wide estimate requires the previous actual body count');
  return measurement.wideCount/supportedBodySeats!;
}
/** Same full-field objective used by site selection. Joint trials differ only
 * in moving two complete objects before the one common measurement. */
function completePlanningScore(placed:readonly PlanningObject[],entries:readonly NativeSpatialWidePlacement[],ground:NativeSpatialPlanningGround,input:NativeSpatialFrozenInput,field:readonly Readonly<Vector2>[],g1Field:NativeSpatialG1Field,areaPointCount:number,deepSpan:(distances:readonly number[])=>number,wideCorrection:number,domain?:NativeSpatialWideDomain,supportedBodySeats?:number):NativeSpatialConstraintScore {
  const sites=new Map(entries.map(e=>[e.index,e.site])),tree=nativePrimitiveTree(placed.flatMap((o,index)=>{const site=sites.get(index)??o.source.site;return shifted(o.blocking,site.x,site.y);}));
  const g1Tree=nativePrimitiveTree(placed.flatMap((o,index)=>{const site=sites.get(index)??o.source.site;return shifted(o.g1Blocking,site.x,site.y);}));
  const g1Holes=placed.flatMap((o,index)=>o.g1Void?[{contains:o.g1Void,site:sites.get(index)??o.source.site}]:[]),inVoid:NativeSpatialG1VoidContains=(x,y)=>g1Holes.some(o=>o.contains(x-o.site.x,y-o.site.y));
  const distances=field.map(p=>nativePrimitiveDistance(tree,p.x,p.y)),maximum=g1Field.maximum(p=>nativeSpatialG1FilledDistance(g1Tree,inVoid,p.x,p.y));let mean=0,walk=0,areaWalk=0,wide=0;
  for(let index=0;index<field.length;index++){const d=distances[index]!;if(d<10)continue;walk++;mean+=Math.max(0,d-input.policy.deepEmptyThresholdPx)**2;
    if(index<areaPointCount){areaWalk++;if(Math.min(d,ground.margin(field[index]!))>=input.policy.wideRadiusPx)wide++;}
  }
  const measurement=domain?(entries.length?domain.evaluateMany(entries):domain.measure()):undefined;
  const estimate=nativeSpatialPlanningWideRatio(wide/Math.max(1,areaWalk),wideCorrection,measurement,supportedBodySeats),largest=measurement?.largestWideRatio;
  return nativeSpatialConstraintScore([Math.max(0,maximum/(input.policy.maxEmptyRadiusPx-8)-1),Math.max(0,deepSpan(distances)/input.policy.maxDeepEmptySpanPx-1),Math.max(0,1-estimate/input.policy.minWideRatio),...(largest===undefined?[]:[Math.max(0,1-largest/input.policy.minLargestWideRatio)])],mean/Math.max(1,walk));
}
/** The legal incumbent is one of the existing twelve complete evaluations,
 * never a fallback after a rough-list truncation has discarded it. */
export function selectNativeSpatialSite(candidates:readonly Vector2[],evaluate:(site:Vector2)=>NativeSpatialConstraintScore|undefined,incumbent?:Vector2,qualify?:(site:Readonly<Vector2>)=>NativeSpatialHoleQualification):Vector2 {
  let chosen:Vector2|undefined,best:NativeSpatialConstraintScore|undefined,legalCount=0;
  const seen=new Set<string>(),evaluated:{site:Vector2;score:NativeSpatialConstraintScore}[]=[];
  if(qualify&&!incumbent)throw new Error('Native refinement qualification requires a valid incumbent');
  const consider=(site:Vector2):void=>{
    const key=`${site.x}:${site.y}`;if(seen.has(key))return;seen.add(key);
    const score=evaluate(site);if(!score)return;
    legalCount++;
    if(qualify)evaluated.push({site,score});
    if(!best||compareNativeSpatialConstraintScores(score,best)<0){best=score;chosen=site;}
  };
  if(incumbent){
    consider(incumbent);
    if(!chosen)throw new Error('Native refinement incumbent is no longer legal');
  }
  for(const site of candidates){if(legalCount>=NATIVE_SPATIAL_SITE_EVALUATION_LIMIT)break;consider(site);}
  if(!chosen)throw new Error('Joint layout has no supported non-overlapping site for the next complete object');
  if(qualify){
    // The measured incumbent has already passed actual H identity. Only the
    // strictly better entries from these same twelve full scores may compile;
    // rejection never refills the candidate list or displaces the incumbent.
    const incumbentScore=evaluated[0]!.score;
    const selected=selectNativeSpatialQualifiedSite(evaluated.filter(entry=>compareNativeSpatialConstraintScores(entry.score,incumbentScore)<0),qualify);
    return selected?.site?{...selected.site}:incumbent!;
  }
  return chosen;
}
/** Production fresh initialization has no incumbent. The original finite
 * candidate list is authoritative; only an empty legal list can visit the
 * existing field. Final-H qualification consumes that same scored list. */
export function selectNativeSpatialInitialSite(candidates:readonly Vector2[],fieldSites:()=>Iterable<Vector2>,evaluate:(site:Vector2)=>NativeSpatialConstraintScore|undefined,objectIndex:number,checkpoint:()=>void,qualify?:(site:Readonly<Vector2>)=>NativeSpatialHoleQualification):Readonly<{site:Vector2;trace:NativeSpatialPlacementSearch}> {
  const seen=new Set<string>(),evaluated:{site:Vector2;score:NativeSpatialConstraintScore}[]=[];
  let checked=0,fallbackSitesChecked=0;
  const consider=(site:Vector2,fromField:boolean):void=>{
    if(checked++%64===0)checkpoint();
    const key=`${site.x}:${site.y}`;if(seen.has(key))return;seen.add(key);
    if(fromField)fallbackSitesChecked++;
    const score=evaluate(site);if(score)evaluated.push({site,score});
  };
  checkpoint();
  for(const site of candidates){if(evaluated.length>=NATIVE_SPATIAL_SITE_EVALUATION_LIMIT)break;consider(site,false);}
  const originalLegalCount=evaluated.length,fallbackUsed=originalLegalCount===0;
  if(fallbackUsed)for(const site of fieldSites()){if(evaluated.length>=NATIVE_SPATIAL_SITE_EVALUATION_LIMIT)break;consider(site,true);}
  let qualification:NativeSpatialHoleQualification|undefined;
  const selected=qualify?selectNativeSpatialQualifiedSite(evaluated,site=>{checkpoint();return qualification=qualify(site);}):undefined;
  const site=qualify?selected?.site:[...evaluated].sort((a,b)=>compareNativeSpatialConstraintScores(a.score,b.score))[0]?.site;
  const trace:NativeSpatialPlacementSearch={objectIndex,originalCandidateCount:candidates.length,originalLegalCount,fallbackUsed,fallbackSitesChecked,evaluatedSites:evaluated.length,identityChecks:selected?.checks??0,identityRejected:selected?.rejected??0,selectedFrom:site?(fallbackUsed?'field':'original'):'none'};
  if(!site)throw Object.assign(new Error(`Native initial placement exhausted bounded domain: original=${originalLegalCount}, fieldChecked=${fallbackSitesChecked}, evaluated=${evaluated.length}, identityRejected=${trace.identityRejected}`),{placementSearch:trace,...(qualification?{qualification}:{})});
  return{site:{...site},trace};
}
interface InitialSiteContext {readonly objectIndex:number;readonly candidates:readonly Vector2[];readonly checkpoint:()=>void;readonly qualify?:(site:Readonly<Vector2>)=>NativeSpatialHoleQualification;readonly record:(trace:NativeSpatialPlacementSearch)=>void}
function siteFor(object:PlanningObject,ground:NativeSpatialPlanningGround,others:readonly PlanningObject[],input:NativeSpatialFrozenInput,random:Stream,field:readonly Vector2[],g1Field:NativeSpatialG1Field,deepSpan:(distances:readonly number[])=>number,areaPointCount:number,wideCorrection:number,preferred:readonly Readonly<Vector2>[]=[],measuredWide?:{readonly supportedBodySeats:number;readonly evaluate:(site:Readonly<Vector2>)=>NativeSpatialWideMeasurement},incumbent?:Vector2,initial?:InitialSiteContext,qualifyRefinement?:(site:Readonly<Vector2>)=>NativeSpatialHoleQualification):Vector2 {
  // Relief needs real land support but is neither a collision obstacle nor a
  // coverage contributor. Solids may share its ground; holes may not erase it.
  const blocking=others.flatMap(o=>shifted(o.blocking,o.source.site.x,o.source.site.y));
  const relief=object.source.kind==='hole'?others.flatMap(o=>{const ids=new Set(o.source.instances.filter(i=>i.role==='relief').map(i=>i.id));return shifted(o.support.filter(p=>ids.has(p.objectId)),o.source.site.x,o.source.site.y);}):[];
  const forbiddenTree=nativePrimitiveTree(blocking),coverageTree=forbiddenTree,reliefTree=nativePrimitiveTree(relief);
  const blockingPoints=pointCloud(blocking),reliefPoints=pointCloud(relief);
  const holes=nativePrimitiveTree(others.filter(o=>o.source.kind==='hole').flatMap(o=>shifted(o.blocking,o.source.site.x,o.source.site.y)));
  const support=pointCloud(object.support),body=pointCloud(object.blocking),bodyTree=nativePrimitiveTree(object.blocking);
  const remaining=field.map(p=>nativePrimitiveDistance(coverageTree,p.x,p.y)),coast=field.map(p=>ground.margin(p)),openCoast=field.map(p=>g1Field.exteriorRadius(p));
  const fineCoverageTree=nativePrimitiveTree(others.flatMap(o=>shifted(o.g1Blocking,o.source.site.x,o.source.site.y))),fineBodyTree=nativePrimitiveTree(object.g1Blocking);
  const inOtherVoid:NativeSpatialG1VoidContains=(x,y)=>others.some(o=>o.g1Void?.(x-o.source.site.x,y-o.source.site.y));
  const fineRemaining=g1Field.distances(p=>nativeSpatialG1FilledDistance(fineCoverageTree,inOtherVoid,p.x,p.y)),fineDescending=g1Field.descendingIndices(fineRemaining);
  const xs=body.map(p=>p.x),ys=body.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const rx=(Math.max(...xs)-Math.min(...xs))/2,ry=(Math.max(...ys)-Math.min(...ys))/2;
  const candidates=initial?.candidates??nativeSpatialSiteCandidates(object.source.site,field,preferred,random);
  const roughIndices=field.flatMap((_,i)=>i%4===0?[i]:[]);
  const cost=(distances:readonly number[],indices?:readonly number[],measurement?:NativeSpatialWideMeasurement,fineMaximum?:number):NativeSpatialConstraintScore=>{
    let score=0,maximum=0,walk=0,areaWalk=0,wide=0;
    for(let i=0;i<distances.length;i++){const d=distances[i]!;if(d<10)continue;walk++;
      const excess=Math.max(0,d-input.policy.deepEmptyThresholdPx);score+=excess*excess;
      const fieldIndex=indices?.[i]??i;
      // Only max measures the ground-contained empty circle. Deep and mean
      // deliberately retain their original internal H/S structure distance.
      maximum=Math.max(maximum,Math.min(d,openCoast[fieldIndex]!));
      // Exact failure witnesses guide coverage, but are not extra land area.
      if(fieldIndex<areaPointCount){areaWalk++;if(Math.min(d,coast[fieldIndex]!)>=input.policy.wideRadiusPx)wide++;}
    }
    // A joint search objective, not an admission shortcut: movement breadth and
    // coverage must improve together. The real 8px body domain still decides.
    // Full trials consume one actual-mask measurement for area and connectivity.
    // Coarse/fresh scoring alone retains the phase-corrected 16px estimate;
    // neither prediction changes the next compiled candidate's admission.
    const estimatedWide=nativeSpatialPlanningWideRatio(wide/Math.max(1,areaWalk),wideCorrection,measurement,measuredWide?.supportedBodySeats);
    const coverExcess=Math.max(0,(fineMaximum??maximum)/(input.policy.maxEmptyRadiusPx-8)-1),wideExcess=Math.max(0,1-estimatedWide/input.policy.minWideRatio);
    // Mean excess cannot distinguish a long connected exposure band from many
    // short pockets. The 16px graph guides placement; only the real 8px gate
    // performs body erosion and decides whether the final 448px rule passes.
    const deepExcess=indices?0:Math.max(0,deepSpan(distances)/input.policy.maxDeepEmptySpanPx-1);
    const connectivity=measurement===undefined?[]:[Math.max(0,1-measurement.largestWideRatio/input.policy.minLargestWideRatio)];
    return nativeSpatialConstraintScore([coverExcess,deepExcess,wideExcess,...connectivity],score/Math.max(1,walk));
  };
  const rough=candidates.map(p=>({p,score:cost(roughIndices.map(i=>{const q=field[i]!;return Math.min(remaining[i]!,Math.hypot(Math.max(0,Math.abs(q.x-p.x-cx)-rx),Math.max(0,Math.abs(q.y-p.y-cy)-ry)));}),roughIndices)})).sort((a,b)=>compareNativeSpatialConstraintScores(a.score,b.score)||a.p.y-b.p.y||a.p.x-b.p.x);
  const evaluate=(p:Vector2):NativeSpatialConstraintScore|undefined=>{
    if(ground.margin(p)<24)return;
    if(support.some(q=>ground.margin({x:p.x+q.x,y:p.y+q.y})<24||nativePrimitiveDistance(holes,p.x+q.x,p.y+q.y)<24))return;
    if(!ground.supportsFootprint(object.support,p))return;
    if(body.some(q=>nativePrimitiveDistance(forbiddenTree,p.x+q.x,p.y+q.y)<input.policy.wideRadiusPx*1.5||nativePrimitiveDistance(reliefTree,p.x+q.x,p.y+q.y)<24))return;
    // Symmetric footprint checks prevent a larger candidate from enclosing a
    // previously placed small object while all candidate vertices remain clear.
    const shiftedTree=nativePrimitiveTree(shifted(object.blocking,p.x,p.y));
    if(blockingPoints.some(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y)<input.policy.wideRadiusPx*1.5)||reliefPoints.some(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y)<24))return;
    const fineMaximum=g1Field.maximumWithRemaining(fineRemaining,fineDescending,q=>nativeSpatialG1FilledDistance(fineBodyTree,object.g1Void,q.x-p.x,q.y-p.y));
    const score=cost(field.map((q,i)=>Math.min(remaining[i]!,nativePrimitiveDistance(bodyTree,q.x-p.x,q.y-p.y))),undefined,measuredWide?.evaluate(p),fineMaximum);
    return score;
  };
  if(initial){
    const result=selectNativeSpatialInitialSite(rough.map(entry=>entry.p),()=>field.map(p=>({x:snap(p.x),y:snap(p.y)})),evaluate,initial.objectIndex,initial.checkpoint,initial.qualify);
    initial.record(result.trace);return result.site;
  }
  return selectNativeSpatialSite(rough.map(entry=>entry.p),evaluate,incumbent,qualifyRefinement);
}
function holeRects(profile:NativeSpatialHoleProfile,random:Stream,axis:number):Rect[]{
  const count=random.integer(profile.minRectCount,profile.maxRectCount),snapLocal=(v:number)=>Math.round(v/4)*4;
  // Reserve one real VOID-cell width and some area for free-edge/raster changes.
  // The compiled contour and actual VOID group still have independent hard gates.
  const maximumSpan=profile.maxSpanPx-8,maximumArea=profile.maxAreaPx2*.94;
  const bounds=(rects:readonly Rect[])=>({x:Math.min(...rects.map(r=>r[0])),y:Math.min(...rects.map(r=>r[1])),right:Math.max(...rects.map(r=>r[0]+r[2])),bottom:Math.max(...rects.map(r=>r[1]+r[3]))});
  const extent=(rects:readonly Rect[])=>{const b=bounds(rects);return{span:Math.max(b.right-b.x,b.bottom-b.y),thickness:Math.min(b.right-b.x,b.bottom-b.y)};};
  for(let attempt=0;attempt<48;attempt++){
    const target=random.range(profile.minSpanPx,maximumSpan),initialWidth=snapLocal(random.range(80,Math.min(112,maximumSpan/(1+(count-1)*(1-profile.maxOverlapRatio))))),initialHeight=snapLocal(random.range(80,Math.max(80,profile.maxThicknessPx/(1+profile.minOffsetRatio))));
    const rects:Rect[]=[[0,0,initialWidth,initialHeight]];
    for(let index=1;index<count;index++){
      const choices:{rect:Rect;score:number}[]=[];
      for(let draw=0;draw<96;draw++){
        // Every connection chooses its own edge, sign, size and offset. A large
        // hole's last rectangle may branch from an earlier rectangle.
        const parent=rects[profile.sizeClass==='large'&&index===count-1&&random.next()<.4?random.integer(0,index-1):index-1]!;
        const direction=random.next()<.8?random.integer(0,1):random.integer(2,3),normalX=direction<2,sign=direction%2===0?-1:1,offsetSign=random.next()<.5?-1:1;
        const width=snapLocal(random.range(80,Math.min(128,maximumSpan))),height=snapLocal(random.range(80,Math.max(80,profile.maxThicknessPx/(1+profile.minOffsetRatio))));
        const shorterNormal=Math.min(normalX?parent[2]:parent[3],normalX?width:height),shorterTangent=Math.min(normalX?parent[3]:parent[2],normalX?height:width);
        const overlap=snapLocal(shorterNormal*random.range(profile.minOverlapRatio,profile.maxOverlapRatio)),offset=snapLocal(shorterTangent*random.range(profile.minOffsetRatio,profile.maxOffsetRatio));
        if(overlap/shorterNormal<profile.minOverlapRatio||overlap/shorterNormal>profile.maxOverlapRatio||offset/shorterTangent<profile.minOffsetRatio||offset/shorterTangent>profile.maxOffsetRatio)continue;
        const x=normalX?(sign<0?parent[0]-width+overlap:parent[0]+parent[2]-overlap):parent[0]+parent[2]/2-width/2+offsetSign*offset;
        const y=normalX?parent[1]+parent[3]/2-height/2+offsetSign*offset:(sign<0?parent[1]-height+overlap:parent[1]+parent[3]-overlap);
        const rect:Rect=[x,y,width,height],next=[...rects,rect],size=extent(next),area=rectArea(next);
        if(size.span>maximumSpan||size.thickness>profile.maxThicknessPx||area>maximumArea||area<=rectArea(rects))continue;
        if(next.some((_,j)=>rectArea(next.filter((__,k)=>k!==j))===area))continue;
        if(index===count-1&&(size.span<profile.minSpanPx||size.thickness<profile.minThicknessPx))continue;
        const desired=initialWidth+(target-initialWidth)*index/(count-1);
        choices.push({rect,score:Math.abs(size.span-desired)/Math.max(1,target)+random.range(0,.12)});
      }
      if(!choices.length)break;
      choices.sort((a,b)=>a.score-b.score);rects.push(choices[0]!.rect);
    }
    if(rects.length!==count)continue;
    const b=bounds(rects),cx=(b.x+b.right)/2,cy=(b.y+b.bottom)/2,vertical=Math.abs(Math.sin(axis))>Math.abs(Math.cos(axis));
    return rects.map(([x,y,width,height])=>vertical?[y-cy,x-cx,height,width]:[x-cx,y-cy,width,height]);
  }
  throw new Error(`No bounded offset-rectangle grammar sample for hole profile ${profile.id}`);
}

type NativeSpatialPrevious=Readonly<{layout:NativeSpatialLayout;gate:NativeSpatialGateResult;actualVoid?:NativeSpatialActualVoidFeedback;allowJoint?:boolean;routeFeedback?:NativeSpatialRouteFeedback}>;
export function createNativeSpatialLayout(native:MasterDefinition,input:NativeSpatialFrozenInput,requestedSeed:number,geometrySeed:number,candidate:number,
  previous?:NativeSpatialPrevious,countPairIndex?:number,bayCountIndex?:number,geometryWork?:NativeSpatialGeometryWork):NativeSpatialLayout {
  return buildNativeSpatialLayout(native,input,requestedSeed,geometrySeed,candidate,previous,countPairIndex,bayCountIndex,geometryWork);
}
/** Diagnostic-only global initializer with frozen L/B/shapes/edge seed.
 * Production fresh initialization does not enter or fall back to this path. */
export function reinitializeNativeSpatialLayout(native:MasterDefinition,input:NativeSpatialFrozenInput,requestedSeed:number,geometrySeed:number,frozen:NativeSpatialLayout,geometryWork:NativeSpatialGeometryWork):NativeSpatialLayout {
  return buildNativeSpatialLayout(native,input,requestedSeed,geometrySeed,frozen.candidate,undefined,frozen.countPairIndex,frozen.bayCountIndex,geometryWork,frozen);
}
/** Runs only an explicitly supplied frozen diagnostic fixture. Production
 * never selects an alternative order or falls back to this entry point. */
export function initializeNativeSpatialFrozenFixture(native:MasterDefinition,input:NativeSpatialFrozenInput,fixture:NativeSpatialInitialFixture,order:readonly number[],geometryWork:NativeSpatialGeometryWork):NativeSpatialLayout {
  if(fixture.worldId!==input.world.worldId||fixture.sourceHash!==input.policy.sourceHash)throw new Error('Native initial fixture authoring identity mismatch');
  const expectedSeed=mix32(fixture.requestedSeed,`${input.policy.algorithm}:${input.policy.version}:${input.policy.sourceHash}:${input.world.worldId}:${fixture.geometrySeed}:${fixture.candidate}`);
  if(fixture.layoutSeed!==expectedSeed||fixture.seedSalt!==mix32(expectedSeed,'native-fragment-edge'))throw new Error('Native initial fixture seed identity mismatch');
  if(!Number.isSafeInteger(fixture.randomDrawCount)||fixture.randomDrawCount<0||fixture.candidatePools.length!==fixture.objects.length)throw new Error('Native initial fixture has invalid candidate pools');
  if(fixture.objects.some(o=>o.site.x!==0||o.site.y!==0)||fixture.candidatePools.some(pool=>pool.length!==185||pool.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x%8!==0||p.y%8!==0)))throw new Error('Native initial fixture must contain unchanged unplaced shapes and original snapped pools');
  if(order.length!==fixture.objects.length||new Set(order).size!==order.length||order.some(i=>!Number.isSafeInteger(i)||i<0||i>=fixture.objects.length))throw new Error('Native initial fixture order is not a complete author-index permutation');
  return buildNativeSpatialLayout(native,input,fixture.requestedSeed,fixture.geometrySeed,fixture.candidate,undefined,fixture.countPairIndex,fixture.bayCountIndex,geometryWork,undefined,{fixture,order});
}
function buildNativeSpatialLayout(native:MasterDefinition,input:NativeSpatialFrozenInput,requestedSeed:number,geometrySeed:number,candidate:number,
  previous?:NativeSpatialPrevious,countPairIndex?:number,bayCountIndex?:number,geometryWork?:NativeSpatialGeometryWork,frozen?:NativeSpatialLayout,initial?:Readonly<{fixture:NativeSpatialInitialFixture;order:readonly number[]}>):NativeSpatialLayout {
  if(input.world.landGrammar!=='offset-overlap-v1'||input.world.bayGrammar!=='shore-rect-cut-v1')throw new Error('Unsupported native plate grammar');
  const layoutSeed=initial?.fixture.layoutSeed??frozen?.layoutSeed??mix32(requestedSeed,`${input.policy.algorithm}:${input.policy.version}:${input.policy.sourceHash}:${input.world.worldId}:${geometrySeed}:${candidate}`),random=new Stream(layoutSeed,initial?.fixture.randomDrawCount),pairs=nativeSpatialCountPairs(input);
  if(!pairs.length)throw new Error('Intent count/assembly contract has no integer solution');
  const reuse=!!previous,retained=frozen??previous?.layout;
  const selectedPairIndex=reuse?(previous!.layout.countPairIndex??pairs.findIndex(p=>p.holes===previous!.layout.requestedCounts.holes&&p.solids===previous!.layout.requestedCounts.solids)):(countPairIndex??candidate%pairs.length);
  if(!Number.isSafeInteger(selectedPairIndex)||selectedPairIndex<0||selectedPairIndex>=pairs.length)throw new Error('Invalid native count pair index');
  const counts=initial?.fixture.requestedCounts??retained?.requestedCounts??pairs[selectedPairIndex]!;
  if(counts.solids>32)throw new Error('Native count pair exceeds solid capacity');
  const selectedBayIndex=reuse?previous!.layout.bayCountIndex:(bayCountIndex??candidate%input.world.bayCountOptions.length);
  if(!Number.isSafeInteger(selectedBayIndex)||selectedBayIndex<0||selectedBayIndex>=input.world.bayCountOptions.length)throw new Error('Invalid native bay count index');
  const bayCount=input.world.bayCountOptions[selectedBayIndex]!,bayRandom=new Stream(mix32(layoutSeed,'native-bay-geometry'));
  const availableBayProfiles=input.bayProfiles.filter(p=>input.world.bayProfileIds.includes(p.id));
  const bayProfiles=retained||initial?[]:Array.from({length:bayCount},()=>bayRandom.choose(availableBayProfiles));
  const bayAreaEstimate=bayProfiles.reduce((sum,p)=>sum+(p.minRemovedLandAreaPx2+p.maxRemovedLandAreaPx2)/2,0);
  const landPlan=initial?{rects:initial.fixture.land,plates:initial.fixture.landPlates}:retained?{rects:retained.plan.land,plates:retained.plan.landPlates}:createNativeSpatialLand(input,random,counts,native,bayAreaEstimate);
  const land=landPlan.rects,landPlates=landPlan.plates;
  const landJoins=initial?.fixture.landJoins??(retained?retained.landJoins:nativeSpatialLandJoins(land,input.world.landRectMinOverlapPx,landPlates.map(p=>p.parentIndex)));
  const bays=initial?.fixture.bays??(retained?retained.bays:createNativeSpatialBays(land,landJoins,bayProfiles,bayRandom,{width:input.world.frameWidthPx,height:input.world.frameHeightPx}));
  const bayRects=bays.flatMap(b=>b.rects.map(r=>[...r] as Rect)),ground=createNativeSpatialPlanningGround(land,bayRects),objects:JointObject[]=initial?[...initial.fixture.objects]:retained?[...retained.plan.objects]:[];
  const assessmentPoints:Readonly<Vector2>[]=reuse?[...(previous!.layout.plan.assessmentPoints??[])]:[];
  const hotspots:Vector2[]=reuse?[previous!.gate.metrics.worstDeepPoint,previous!.gate.metrics.worstEmptyPoint].filter((point):point is Vector2=>!!point):[];
  for(const hotspot of hotspots)if(!assessmentPoints.some(p=>p.x===hotspot.x&&p.y===hotspot.y))assessmentPoints.push({...hotspot});
  const g1Exterior=previous?.actualVoid?nativeSpatialG1ExteriorRadius(previous.actualVoid):(p:Readonly<Vector2>)=>ground.margin(p);
  const g1Field=new NativeSpatialG1Field(input.world.frameWidthPx,input.world.frameHeightPx,p=>ground.margin(p),assessmentPoints,()=>geometryWork?.checkpoint(),g1Exterior);
  const baseField=planningField(ground,input,geometrySeed),deepSpan=createNativeDeepSpanProxy(baseField,input.policy.deepEmptyThresholdPx),field=[...baseField,...assessmentPoints],placed:PlanningObject[]=[];
  const placementSearch:NativeSpatialPlacementSearch[]=[];
  let wideCorrection=0,supportedBodySeats:number|undefined,wideDomain:NativeSpatialWideDomain|undefined,refinement:NativeSpatialRefinement|undefined,initialPlacement:NativeSpatialInitialTrace|undefined;
  const seedSalt=initial?.fixture.seedSalt??(retained?retained.fragmentShape.seedSalt:mix32(layoutSeed,'native-fragment-edge'));
  const fragmentFor=(sources:readonly JointObject[]):R100FrozenFragmentShape=>({algorithmVersion:'rectilinear-fragment-v1',layoutId:`${input.world.worldId}-native`,sourceHash:input.policy.sourceHash,seedMode:'run-seed',seedSalt,edgeSeed:(requestedSeed+seedSalt)>>>0,
    layout:{worldScale:2,authoringFrame:[input.world.frameWidthPx/2,input.world.frameHeightPx/2],landRects:land.map(r=>r.map(v=>v/2) as unknown as FragmentRect),voidRects:[...bayRects,...sources.flatMap(o=>o.rects.map(([x,y,w,h])=>[x+o.site.x,y+o.site.y,w,h] as Rect))].map(r=>r.map(v=>v/2) as unknown as FragmentRect)}});
  const holePlacements=(sources:readonly JointObject[]):NativeSpatialHolePlacement[]=>sources.filter(o=>o.kind==='hole').map((o,index)=>{if(!o.profileId)throw new Error('Native hole has no authoring profile');return{holeId:`hole-${index}`,profileId:o.profileId,rects:o.rects.map(([x,y,w,h])=>[x+o.site.x,y+o.site.y,w,h] as Rect)};});
  let nextId=Math.max(...native.instances.map(i=>i.id))+1;
  try{
  if(!reuse){
    if(!frozen&&!initial){
    for(const assembly of input.assemblies){
      const sourceIds=new Set([...assembly.sourceInstanceIds,...assembly.attachedReliefIds]),source=native.instances.filter(i=>sourceIds.has(i.id));
      const anchor=assembly.sourceInstanceIds.map(id=>native.instances.find(i=>i.id===id)!),cx=anchor.reduce((n,i)=>n+i.x,0)/anchor.length,cy=anchor.reduce((n,i)=>n+i.y,0)/anchor.length;
      const scale=assembly.sourceScale*random.range(assembly.minScale,assembly.maxScale),rotation=random.choose(assembly.rotationOffsetsRad),c=Math.cos(rotation),s=Math.sin(rotation);
      const local=source.map(i=>({...i,x:((i.x-cx)*c-(i.y-cy)*s)*scale,y:((i.x-cx)*s+(i.y-cy)*c)*scale,rotation:i.rotation+rotation,length:i.length*scale,width:i.width*scale,height:i.role==='solid'?i.height*scale:i.height,thickness:i.role==='solid'?i.thickness*scale:i.thickness}));
      objects.push({kind:'solid',instances:local,rects:[],assembly:{assemblyId:assembly.id,instanceIds:assembly.sourceInstanceIds,maxSpanPx:assembly.maxSpanPx},site:{x:0,y:0}});
    }
    // Allocate authored size weights once by largest remainder, then scramble
    // object order. Repeated random picks may not silently omit the large tier.
    const totalWeight=input.holeProfiles.reduce((n,p)=>n+p.weight,0),alloc=input.holeProfiles.map(p=>({profile:p,count:Math.floor(counts.holes*p.weight/totalWeight),remainder:counts.holes*p.weight/totalWeight%1}));
    const missing=counts.holes-alloc.reduce((n,a)=>n+a.count,0);
    [...alloc].sort((a,b)=>b.remainder-a.remainder||a.profile.id.localeCompare(b.profile.id)).slice(0,missing).forEach(a=>a.count++);
    const profiles=alloc.flatMap(a=>Array<NativeSpatialHoleProfile>(a.count).fill(a.profile));
    for(let i=profiles.length-1;i>0;i--){const j=random.integer(0,i);[profiles[i],profiles[j]]=[profiles[j]!,profiles[i]!];}
    const kinds:('hole'|'solid')[]=[...Array<'hole'>(counts.holes).fill('hole'),...Array<'solid'>(counts.solids-input.assemblies.length).fill('solid')];
    for(let i=kinds.length-1;i>0;i--){const j=random.integer(0,i);[kinds[i],kinds[j]]=[kinds[j]!,kinds[i]!];}
    for(const kind of kinds){
      if(kind==='hole'){const profile=profiles.pop()!;objects.push({kind,profileId:profile.id,instances:[],rects:holeRects(profile,random,input.world.materialAxisRad+(random.next()<.28?Math.PI/2:0)),site:{x:0,y:0}});}
      else{
        const p=random.choose(input.subordinateProfiles),id=nextId++,instance:Instance={id,role:'solid',family:p.family,constructionVersion:4,shapeProfile:p.shapeProfile,x:0,y:0,rotation:input.world.materialAxisRad+p.rotationOffsetRad+random.range(-.25,.25),length:random.range(p.minLengthPx,p.maxLengthPx),width:random.range(p.minWidthPx,p.maxWidthPx),height:random.range(p.minHeightPx,p.maxHeightPx),thickness:p.thicknessPx,fold:p.fold,branches:p.branches,opening:p.opening,distortion:p.distortion};
        objects.push({kind,instances:[instance],rects:[],assembly:{assemblyId:`subordinate-${id}`,instanceIds:[id],maxSpanPx:512},site:{x:0,y:0}});
      }
    }
    }
    if(!geometryWork)throw new Error('Native initial placement requires a shared geometry-work budget');
    if(frozen){
    placed.push(...objects.map(o=>planningObject(o,native,geometrySeed)));
    let holeIndex=0;const ids=objects.map(o=>o.kind==='hole'?`hole-${holeIndex++}`:o.assembly!.assemblyId),byId=new Map(ids.map((id,index)=>[id,index]));
    const result=createNativeSpatialInitialPlacement({objects:placed.map((o,index)=>({id:ids[index]!,kind:o.source.kind,support:o.support,blocking:o.blocking})),ground,field:baseField,firstAnchorIndex:mix32(layoutSeed,'native-initial-anchors')%baseField.length,gapPx:input.policy.wideRadiusPx*1.5,checkpoint:()=>geometryWork.checkpoint(),evaluate:placements=>completePlanningScore(placed,placements.map(p=>({index:byId.get(p.id)!,site:p.site})),ground,input,field,g1Field,baseField.length,deepSpan,0)});
    initialPlacement=result.trace;
    for(const entry of result.placements){const index=byId.get(entry.id)!;objects[index]={...objects[index]!,site:entry.site};placed[index]={...placed[index]!,source:objects[index]!};}
    const qualification=geometryWork.run({kind:'initial-hole-identity',candidate},()=>qualifyNativeSpatialHoles(fragmentFor(objects),requestedSeed,holePlacements(objects),counts.holes));
    if(!qualification.accepted)throw Object.assign(new Error('Native initial complete assignment failed final hole identity'),{initialPlacement,qualification});
    }else{
      // Bounded r12 partial initialization over complete authored objects.
      // A rejected plan is rejected; it never switches to the diagnostic solver.
      const candidatePools=initial?.fixture.candidatePools??objects.map(o=>{geometryWork.checkpoint();return nativeSpatialSiteCandidates(o.site,field,[],random);});
      const order=initial?.order??nativeSpatialInitialOrder(objects.map(o=>o.kind),'author');
      const lastHole=[...order].reverse().find(i=>objects[i]!.kind==='hole');
      const placedByIndex:(PlanningObject|undefined)[]=new Array(objects.length);
      for(const i of order){
        geometryWork.checkpoint();
        const object=planningObject(objects[i]!,native,geometrySeed);
        const prior=placedByIndex.filter((o):o is PlanningObject=>!!o);
        const qualify=i===lastHole?(site:Readonly<Vector2>):NativeSpatialHoleQualification=>{
          const sources=objects.flatMap((source,index)=>index===i?[{...source,site}]:placedByIndex[index]?[placedByIndex[index]!.source]:[]);
          return geometryWork.run({kind:'initial-hole-identity',candidate,objectIndex:i,site},()=>qualifyNativeSpatialHoles(fragmentFor(sources),requestedSeed,holePlacements(sources),counts.holes));
        }:undefined;
        const site=siteFor(object,ground,prior,input,random,field,g1Field,deepSpan,baseField.length,0,[],undefined,undefined,{objectIndex:i,candidates:candidatePools[i]!,checkpoint:()=>geometryWork.checkpoint(),qualify,record:trace=>placementSearch.push(trace)});
        objects[i]={...objects[i]!,site};placedByIndex[i]={...object,source:objects[i]!};
      }
      placed.push(...placedByIndex.filter((o):o is PlanningObject=>!!o));
    }
  }else{
    placed.push(...objects.map(o=>planningObject(o,native,geometrySeed)));
    if(previous!.actualVoid){
      const holeSources=placed.filter(o=>o.source.kind==='hole').map((o,index)=>({holeId:`hole-${index}`,site:o.source.site})),shapes=nativeSpatialG1HoleShapes(previous!.actualVoid,holeSources);let g1Hole=0;
      for(let i=0;i<placed.length;i++)if(placed[i]!.source.kind==='hole'){const shape=shapes.get(`hole-${g1Hole++}`)!;placed[i]={...placed[i]!,g1Blocking:shape.boundary,g1Void:shape.contains};}
      supportedBodySeats=Number(previous!.gate.metrics.supportedBodySeats);if(!Number.isSafeInteger(supportedBodySeats)||supportedBodySeats<=0)throw new Error('Actual VOID feedback requires a positive measured body count');let holeIndex=0;wideDomain=new NativeSpatialWideDomain(previous!.actualVoid,placed.map(o=>({site:o.source.site,blocking:o.blocking,...(o.source.kind==='hole'?{holeId:`hole-${holeIndex++}`}:{})})),input.policy.wideRadiusPx);}
    const actualWide=previous!.gate.metrics.wideRatio;
    if(typeof actualWide==='number'&&Number.isFinite(actualWide)){
      // The fallback supports saved diagnostic receipts from before the proxy
      // was recorded. Production proposals always carry their raw estimate.
      const priorRaw=previous!.layout.plan.wideEstimate?.rawRatio??planningWideRatio(baseField,ground,placed.flatMap(o=>shifted(o.blocking,o.source.site.x,o.source.site.y)),input.policy.wideRadiusPx);
      wideCorrection=actualWide-priorRaw;
    }
    const worst=previous!.gate.metrics.worstEmptyPoint as Vector2|undefined;
    const evaluate=(entries:readonly NativeSpatialWidePlacement[])=>completePlanningScore(placed,entries,ground,input,field,g1Field,baseField.length,deepSpan,wideCorrection,wideDomain,supportedBodySeats);
    if(previous!.routeFeedback){
      if(!previous!.gate.accepted||!wideDomain)throw new Error('Route refinement requires accepted actual geometry and actual VOID feedback');
      const before=evaluate([]);let holeIndex=0;
      const route=selectNativeSpatialRoutePlacement({objects:placed.map(o=>{const reliefIds=new Set(o.source.instances.filter(i=>i.role==='relief').map(i=>i.id));return{id:o.source.kind==='hole'?`hole-${holeIndex++}`:o.source.assembly!.assemblyId,kind:o.source.kind,site:o.source.site,support:o.support,blocking:o.blocking,relief:o.support.filter(p=>reliefIds.has(p.objectId))};}),ground,policy:input.policy,feedback:previous!.routeFeedback,checkpoint:()=>geometryWork?.checkpoint()});
      refinement={kind:'route',before,after:before,constraintsImproved:false,route};
      if(route.exhausted)throw Object.assign(new Error('Native route refinement exhausted its bounded actual-witness domain'),{routeRefinement:route});
      // Route changes are not ranked by the old G1 mean. Their actual G1/G2/G3
      // and fixed-probe G4 evaluation occurs once in the generation controller.
      const after=evaluate(route.entries);wideDomain.commitMany(route.entries);
      for(const entry of route.entries){objects[entry.index]={...objects[entry.index]!,site:entry.site};placed[entry.index]={...placed[entry.index]!,source:objects[entry.index]!};}
      refinement={kind:'route',before,after,constraintsImproved:nativeSpatialConstraintsImproved(before,after),route};
    }else if(previous!.allowJoint){
      const before=evaluate([]),deepWitness=previous!.gate.metrics.worstDeepPoint as Vector2|undefined;
      const emptyViolation=Math.max(0,Number(previous!.gate.metrics.maxEmptyUpperPx)/input.policy.maxEmptyRadiusPx-1),deepViolation=Math.max(0,Number(previous!.gate.metrics.maxDeepSpanPx)/input.policy.maxDeepEmptySpanPx-1);
      const witnessKind=deepWitness&&deepViolation>emptyViolation?'deep':'empty',witness=witnessKind==='deep'?deepWitness:worst;
      if(wideDomain&&witness){let holeIndex=0;
        const joint=refineNativeSpatialJointObjects({objects:placed.map(o=>{const reliefIds=new Set(o.source.instances.filter(i=>i.role==='relief').map(i=>i.id));return{id:o.source.kind==='hole'?`hole-${holeIndex++}`:o.source.assembly!.assemblyId,kind:o.source.kind,site:o.source.site,support:o.support,blocking:o.blocking,relief:o.support.filter(p=>reliefIds.has(p.objectId))};}),ground,gapPx:input.policy.wideRadiusPx*1.5,field,baseFieldCount:baseField.length,baseFieldCellPx:16,snapStep:8,coverPlanningLimit:input.policy.maxEmptyRadiusPx-8,deepPlanningLimit:input.policy.deepEmptyThresholdPx-4*Math.SQRT2,witness,witnessKind,deepWitness,evaluate});
        if(joint.entries.length){wideDomain.commitMany(joint.entries);for(const entry of joint.entries){objects[entry.index]={...objects[entry.index]!,site:entry.site};placed[entry.index]={...placed[entry.index]!,source:objects[entry.index]!};}}
        refinement={kind:'joint',before:joint.before,after:joint.after,constraintsImproved:nativeSpatialConstraintsImproved(joint.before,joint.after),joint};
      }else refinement={kind:'joint',before,after:before,constraintsImproved:false,reason:wideDomain?'missing-actual-witness':'missing-actual-void-feedback'};
    }else{
      if(!geometryWork)throw new Error('Native refinement requires a shared geometry-work budget');
      const before=evaluate([]);
      // Joint refinement replaces this scan, never appends another search.
      const order=objects.map((_,i)=>i).sort((a,b)=>worst?Math.hypot(objects[a]!.site.x-worst.x,objects[a]!.site.y-worst.y)-Math.hypot(objects[b]!.site.x-worst.x,objects[b]!.site.y-worst.y):a-b);
      for(const i of order){
        const qualify=objects[i]!.kind==='hole'?(site:Readonly<Vector2>):NativeSpatialHoleQualification=>{
          const sources=objects.map((source,index)=>index===i?{...source,site}:source);
          return geometryWork.run({kind:'refinement-hole-identity',candidate,objectIndex:i,site},()=>qualifyNativeSpatialHoles(fragmentFor(sources),requestedSeed,holePlacements(sources),counts.holes));
        }:undefined;
        try{const site=siteFor(placed[i]!,ground,placed.filter((_,j)=>j!==i),input,random,field,g1Field,deepSpan,baseField.length,wideCorrection,hotspots,wideDomain?{supportedBodySeats:supportedBodySeats!,evaluate:p=>wideDomain!.evaluate(i,p)}:undefined,objects[i]!.site,undefined,qualify);wideDomain?.commit(i,site);objects[i]={...objects[i]!,site};placed[i]={...placed[i]!,source:objects[i]!};}catch(error){if(error instanceof NativeSpatialGeometryWorkBudgetError)throw error;geometryWork.checkpoint();/* Retain a prior valid site, but never swallow work exhaustion or the deadline. */}
      }
      const after=evaluate([]);refinement={kind:'single',before,after,constraintsImproved:nativeSpatialConstraintsImproved(before,after)};
    }
  }
  const instances:Instance[]=objects.flatMap(o=>o.instances.map(i=>({...i,x:i.x+o.site.x,y:i.y+o.site.y}))),assemblies=objects.flatMap(o=>o.assembly?[o.assembly]:[]),voidRects=[...bayRects,...objects.flatMap(o=>o.rects.map(([x,y,w,h])=>[x+o.site.x,y+o.site.y,w,h] as Rect))];
  const holes=holePlacements(objects);
  if(instances.length>48||land.length+voidRects.length>128)throw new Error('Native complete layout exceeds instance/fragment capacity');
  const fragmentShape=fragmentFor(objects);
  const compiled=compileR100FragmentShape(fragmentShape,requestedSeed),all=nativePrimitiveTree(placed.flatMap(o=>shifted(o.blocking,o.source.site.x,o.source.site.y))),probes=field.filter(p=>ground.margin(p)>=32&&nativePrimitiveDistance(all,p.x,p.y)>=24);
  if(!probes.length)throw new Error('Native complete layout has no initial body probe');const probe=random.choose(probes);
  const definition:MasterDefinition={...native,cols:input.world.frameWidthPx/32,rows:input.world.frameHeightPx/32,instances,erosion:compiled.erosion,terrainOutline:compiled.terrainOutline,fragmentShapeVersion:'rectilinear-fragment-v1',spawn_x:probe.x,spawn_y:probe.y,exit_x:probe.x,exit_y:probe.y,search_x:probe.x,search_y:probe.y,enemy_x:probe.x,enemy_y:probe.y};
  const deepSpanProxyPx=deepSpan(baseField.map(p=>nativePrimitiveDistance(all,p.x,p.y)));
  const rawRatio=planningWideRatio(baseField,ground,placed.flatMap(o=>shifted(o.blocking,o.source.site.x,o.source.site.y)),input.policy.wideRadiusPx);
  const measurement=wideDomain?.measure();
  const wideEstimate={rawRatio,correction:wideCorrection,correctedRatio:measurement?nativeSpatialPlanningWideRatio(rawRatio,wideCorrection,measurement,supportedBodySeats):Math.max(0,Math.min(1,rawRatio+wideCorrection)),feedbackCandidate:reuse?previous!.layout.candidate:null,source:measurement?'actual-void-fixed-body' as const:'raw-field' as const,wideCount:measurement?.wideCount??null,supportedBodySeats:supportedBodySeats??null};
  // Fresh plans have no measured boundary cache yet. Null means unknown, not
  // an invented connectivity pass; the actual gate always runs after compile.
  const largestWideRatioProxy=measurement?.largestWideRatio??null;
  return{candidate,countPairIndex:selectedPairIndex,bayCountIndex:selectedBayIndex,layoutSeed,definition,fragmentShape,assemblies,requestedCounts:counts,holes,bays,landJoins,plan:{land,landPlates,bays,objects,assessmentPoints,g1Field:{...g1Field.trace(),footprintSource:previous?.actualVoid?'previous-actual-void-translation':'raw-authoring',feedbackCandidate:previous?.actualVoid?previous.layout.candidate:null},deepSpanProxyPx,wideEstimate,largestWideRatioProxy,...(refinement?{refinement}:{}),...(initialPlacement?{initialPlacement}:{}),...(placementSearch.length?{placementSearch}:{})}};
  }catch(error){if(refinement?.route)throw Object.assign(error instanceof Error?error:new Error(String(error)),{routeRefinement:refinement.route});throw error;}
}
