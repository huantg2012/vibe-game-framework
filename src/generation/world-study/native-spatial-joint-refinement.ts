/** Bounded atomic two-object proposals. Every trial starts from one immutable
 * plan; complete geometry is still compiled and admitted by the real gates. */
import type {Vector2} from '@/types/game-types';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialPrimitive} from './native-spatial-geometry';
import type {NativeSpatialPlanningGround} from './native-spatial-bay-layout';
import {compareNativeSpatialConstraintScores,type NativeSpatialConstraintScore,type NativeSpatialWidePlacement} from './native-spatial-wide-domain';

export interface NativeSpatialJointObject {
  readonly id:string;readonly kind:'hole'|'solid';readonly site:Readonly<Vector2>;
  readonly support:readonly NativeSpatialPrimitive[];readonly blocking:readonly NativeSpatialPrimitive[];readonly relief:readonly NativeSpatialPrimitive[];
}
export interface NativeSpatialJointTrial {
  readonly ids:readonly string[];readonly entries:readonly NativeSpatialWidePlacement[];
  readonly cause:'blocker'|'coverage';readonly lossPoint:Readonly<Vector2>|null;
  readonly legal:boolean;readonly score?:NativeSpatialConstraintScore;
  readonly slot?:NativeSpatialJointSlot;
  readonly target?:NativeSpatialJointTarget;
}
export interface NativeSpatialJointResult {
  readonly entries:readonly NativeSpatialWidePlacement[];readonly before:NativeSpatialConstraintScore;readonly after:NativeSpatialConstraintScore;
  readonly pairCount:number;readonly trialCount:number;readonly evaluatedCount:number;readonly trials:readonly NativeSpatialJointTrial[];
  readonly primaryCount:number;readonly precheckCount:number;readonly sites:readonly NativeSpatialJointSiteTrace[];
}
export type NativeSpatialJointSlot='deep-t0'|'deep-t1'|'cover-t0'|'cover-t1'|'release';
export interface NativeSpatialJointTarget {
  readonly kind:'deep'|'cover';readonly points:readonly Readonly<Vector2>[];readonly centre:Readonly<Vector2>;
  readonly radius:number;readonly limit:number;readonly envelopeRadius:number;
  readonly unavailableReason?:'nonpositive-target-envelope';
  readonly oldDeepLabelsTouched?:number;
}
export interface NativeSpatialJointTargets {
  readonly newDeepPointCount:number;readonly newDeepComponentCount:number;
  readonly deep?:NativeSpatialJointTarget;readonly cover?:NativeSpatialJointTarget;
}
export interface NativeSpatialJointPrecheck {
  readonly slot:NativeSpatialJointSlot;readonly partnerId:string;readonly site:Readonly<Vector2>;
  readonly distance?:number;readonly requiredTranslation?:number;readonly translation?:number;
  readonly nearestPoint?:Readonly<Vector2>;readonly reasons:readonly string[];
}
export interface NativeSpatialJointSiteTrace extends NativeSpatialJointTargets {
  readonly primaryId:string;readonly site:Readonly<Vector2>;readonly blockerIds:readonly string[];
  readonly targetsComputed:boolean;
  readonly skippedReason?:string;readonly prechecks:readonly NativeSpatialJointPrecheck[];
}
export interface NativeSpatialJointCause {
  readonly a:number;readonly b:number;readonly kind:'blocker'|'coverage';readonly loss:Readonly<Vector2>|null;readonly distance:number;
}
/** Each primary receives one directed slot before a different partner could
 * consume its quota. Cause generation is unchanged and creates no reverse. */
export function selectNativeSpatialJointCauses(objects:readonly Pick<NativeSpatialJointObject,'id'>[],causes:readonly NativeSpatialJointCause[]):readonly NativeSpatialJointCause[] {
  const ordered=[...causes].sort((a,b)=>a.distance-b.distance||objects[a.a]!.id.localeCompare(objects[b.a]!.id)||Number(a.kind!=='blocker')-Number(b.kind!=='blocker')||objects[a.b]!.id.localeCompare(objects[b.b]!.id));
  const primaryIds=new Set<string>(),directions=new Set<string>(),selected:NativeSpatialJointCause[]=[];
  for(const cause of ordered){const primary=objects[cause.a]!.id,key=`${primary}:${objects[cause.b]!.id}`;if(primaryIds.has(primary)||directions.has(key))continue;
    primaryIds.add(primary);directions.add(key);selected.push(cause);if(selected.length===3)break;
  }return selected;
}
export interface NativeSpatialJointContext {
  readonly objects:readonly NativeSpatialJointObject[];readonly ground:NativeSpatialPlanningGround;readonly gapPx:number;
  readonly field:readonly Readonly<Vector2>[];readonly witness:Readonly<Vector2>;readonly deepWitness?:Readonly<Vector2>;readonly witnessKind:'empty'|'deep';
  readonly baseFieldCount:number;readonly baseFieldCellPx:number;readonly snapStep:number;
  readonly coverPlanningLimit:number;readonly deepPlanningLimit:number;
  readonly evaluate:(entries:readonly NativeSpatialWidePlacement[])=>NativeSpatialConstraintScore;
}
export function nativeSpatialConstraintsImproved(before:NativeSpatialConstraintScore,after:NativeSpatialConstraintScore):boolean {
  return after.maximum<before.maximum||(after.maximum===before.maximum&&after.sum<before.sum);
}
function worldPrimitives(primitives:readonly NativeSpatialPrimitive[],site:Readonly<Vector2>):NativeSpatialPrimitive[]{
  return primitives.map(p=>nativePrimitive(p.points.map((value,index)=>value+(index%2?site.y:site.x)),p.objectId));
}
function overlaps(a:NativeSpatialPrimitive,b:NativeSpatialPrimitive):boolean {
  // Both projected faces are convex triangles. SAT catches edge crossings and
  // complete containment even when no queried vertex approaches an edge.
  for(const p of [a,b])for(let i=0;i<p.points.length;i+=2){const next=(i+2)%p.points.length,nx=p.points[i+1]!-p.points[next+1]!,ny=p.points[next]!-p.points[i]!;
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(let j=0;j<a.points.length;j+=2){const value=a.points[j]!*nx+a.points[j+1]!*ny;amin=Math.min(amin,value);amax=Math.max(amax,value);}
    for(let j=0;j<b.points.length;j+=2){const value=b.points[j]!*nx+b.points[j+1]!*ny;bmin=Math.min(bmin,value);bmax=Math.max(bmax,value);}
    if(amax<bmin||bmax<amin)return false;
  }return true;
}
function tooClose(a:readonly NativeSpatialPrimitive[],b:readonly NativeSpatialPrimitive[],radius:number):boolean {
  for(const p of a)for(const q of b){if(Math.hypot(Math.max(p.minX-q.maxX,q.minX-p.maxX,0),Math.max(p.minY-q.maxY,q.minY-p.maxY,0))>=radius)continue;
    if(overlaps(p,q))return true;
    const pt={...p,items:[p]},qt={...q,items:[q]};
    for(let i=0;i<p.points.length;i+=2)if(nativePrimitiveDistance(qt,p.points[i]!,p.points[i+1]!)<radius)return true;
    for(let i=0;i<q.points.length;i+=2)if(nativePrimitiveDistance(pt,q.points[i]!,q.points[i+1]!)<radius)return true;
  }return false;
}
function supported(object:NativeSpatialJointObject,site:Readonly<Vector2>,ground:NativeSpatialPlanningGround):boolean {
  if(!Number.isFinite(site.x)||!Number.isFinite(site.y)||site.x%8!==0||site.y%8!==0||ground.margin(site)<24)return false;
  for(const p of object.support)for(let i=0;i<p.points.length;i+=2)if(ground.margin({x:p.points[i]!+site.x,y:p.points[i+1]!+site.y})<24)return false;
  return ground.supportsFootprint(object.support,site);
}
function conflict(a:NativeSpatialJointObject,as:Readonly<Vector2>,b:NativeSpatialJointObject,bs:Readonly<Vector2>,gap:number):boolean {
  const ap=worldPrimitives(a.blocking,as),bp=worldPrimitives(b.blocking,bs);
  if(tooClose(ap,bp,gap))return true;
  if(a.kind==='hole'&&tooClose(ap,worldPrimitives(b.support,bs),24))return true;
  if(b.kind==='hole'&&tooClose(bp,worldPrimitives(a.support,as),24))return true;
  return false;
}
/** Tests the final simultaneous state, never A against B's removed old site. */
export function nativeSpatialJointPlacementValid(objects:readonly NativeSpatialJointObject[],entries:readonly NativeSpatialWidePlacement[],ground:NativeSpatialPlanningGround,gapPx:number):boolean {
  return entries.length===2&&nativeSpatialPlacementRejections(objects,entries,ground,gapPx).length===0;
}
export function nativeSpatialPlacementRejections(objects:readonly NativeSpatialJointObject[],entries:readonly NativeSpatialWidePlacement[],ground:NativeSpatialPlanningGround,gapPx:number):string[] {
  if(entries.length<1||entries.length>2||new Set(entries.map(e=>e.index)).size!==entries.length)return['invalid-object-pair'];
  const sites=new Map(entries.map(e=>[e.index,e.site]));
  const reasons:string[]=[];
  for(const entry of entries){const object=objects[entry.index];if(!object){reasons.push('unknown-object');continue;}
    if(!supported(object,entry.site,ground))reasons.push(`${object.id}:ground-support`);
    for(let j=0;j<objects.length;j++){if(j===entry.index)continue;const other=objects[j]!;if(conflict(object,entry.site,other,sites.get(j)??other.site,gapPx))reasons.push(`${object.id}:${other.id}:${sites.has(j)?'moved':'fixed'}-conflict`);}
  }return reasons;
}
function directedSites(from:Readonly<Vector2>,to:Readonly<Vector2>,distances:readonly number[],snapStep:number):Vector2[]{
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(!length)return[];
  const seen=new Set<string>(),result:Vector2[]=[];
  for(const distance of distances){const site={x:Math.round((from.x+distance*dx/length)/snapStep)*snapStep,y:Math.round((from.y+distance*dy/length)/snapStep)*snapStep},key=`${site.x}:${site.y}`;
    if((site.x===from.x&&site.y===from.y)||seen.has(key))continue;seen.add(key);result.push(site);
  }return result;
}
const pointOrder=(a:Readonly<Vector2>,b:Readonly<Vector2>):number=>a.y-b.y||a.x-b.x;
function targetEnvelope(kind:'deep'|'cover',points:readonly Readonly<Vector2>[],limit:number,oldDeepLabelsTouched?:number):NativeSpatialJointTarget {
  const centre={x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,y:(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2};
  const radius=Math.max(...points.map(p=>Math.hypot(p.x-centre.x,p.y-centre.y)));
  return{kind,points,centre,radius,limit,envelopeRadius:limit-radius,...(limit<=radius?{unavailableReason:'nonpositive-target-envelope' as const}:{}),...(oldDeepLabelsTouched===undefined?{}:{oldDeepLabelsTouched})};
}
/** Reuses the deep proxy's cell adjacency, including its missing-corner rule.
 * Appended exact assessment points participate in cover selection only. These
 * representatives are guidance, not a cut or a proof of repaired topology. */
export function createNativeSpatialJointTargetSelector(field:readonly Readonly<Vector2>[],baseFieldCount:number,cellSize:number,oldDistances:readonly number[],coverLimit:number,deepLimit:number):(next:readonly number[])=>NativeSpatialJointTargets {
  if(!Number.isInteger(baseFieldCount)||baseFieldCount<0||baseFieldCount>field.length||oldDistances.length!==field.length||!Number.isFinite(cellSize)||cellSize<=0||![coverLimit,deepLimit].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid joint witness field');
  const points=field.slice(0,baseFieldCount),cols=Math.max(1,...points.map(p=>Math.floor(p.x/cellSize)+1)),rows=Math.max(1,...points.map(p=>Math.floor(p.y/cellSize)+1));
  const indexByCell=new Int32Array(cols*rows).fill(-1),cells=points.map((p,index)=>{
    const cell=Math.floor(p.y/cellSize)*cols+Math.floor(p.x/cellSize);if(indexByCell[cell]!==-1)throw new Error('Duplicate joint witness base cell');indexByCell[cell]=index;return cell;
  });
  const neighbours=points.map((_,index)=>{
    const cell=cells[index]!,x=cell%cols,y=Math.floor(cell/cols),adjacent:number[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=cols||yy>=rows)continue;
      const next=indexByCell[yy*cols+xx]!;if(next<0||dx&&dy&&(indexByCell[y*cols+xx]===-1||indexByCell[yy*cols+x]===-1))continue;adjacent.push(next);
    }return adjacent;
  });
  const components=(mask:readonly boolean[])=>{
    const labels=new Int32Array(baseFieldCount).fill(-1),groups:number[][]=[];
    for(let i=0;i<baseFieldCount;i++)if(mask[i]&&labels[i]===-1){const group=[i],label=groups.length;labels[i]=label;
      for(let head=0;head<group.length;head++)for(const next of neighbours[group[head]!]!)if(mask[next]&&labels[next]===-1){labels[next]=label;group.push(next);}groups.push(group);
    }return{labels,groups};
  };
  const old=components(points.map((_,i)=>oldDistances[i]!>deepLimit));
  return next=>{
    if(next.length!==field.length)throw new Error('Incomplete joint witness distances');
    const gained=components(points.map((_,i)=>oldDistances[i]!<=deepLimit&&next[i]!>deepLimit));
    const candidates=gained.groups.map(indices=>{
      const touched=new Set<number>();for(const index of indices)for(const other of neighbours[index]!)if(old.labels[other]!>=0)touched.add(old.labels[other]!);
      const gainOrder=(a:number,b:number)=>next[b]!-oldDistances[b]!-(next[a]!-oldDistances[a]!)||pointOrder(points[a]!,points[b]!);
      const p1=[...indices].sort(gainOrder)[0]!,p2=[...indices].sort((a,b)=>Math.hypot(points[b]!.x-points[p1]!.x,points[b]!.y-points[p1]!.y)-Math.hypot(points[a]!.x-points[p1]!.x,points[a]!.y-points[p1]!.y)||pointOrder(points[a]!,points[b]!))[0]!;
      const minimum=[...indices].sort((a,b)=>pointOrder(points[a]!,points[b]!))[0]!;
      return{indices,touched:touched.size,gain:next[p1]!-oldDistances[p1]!,minimum:points[minimum]!,representatives:p1===p2?[points[p1]!]:[points[p1]!,points[p2]!]};
    }).sort((a,b)=>Number(b.touched>=2)-Number(a.touched>=2)||b.gain-a.gain||pointOrder(a.minimum,b.minimum));
    let coverIndex=-1,coverGain=-Infinity;
    for(let i=0;i<field.length;i++)if(next[i]!>oldDistances[i]!&&next[i]!>coverLimit){
      const gain=Math.max(0,next[i]!-coverLimit)-Math.max(0,oldDistances[i]!-coverLimit);
      if(gain>coverGain||gain===coverGain&&(next[i]!>next[coverIndex]!||next[i]===next[coverIndex]&&pointOrder(field[i]!,field[coverIndex]!)<0)){coverIndex=i;coverGain=gain;}
    }
    const selected=candidates[0];return{newDeepPointCount:gained.groups.reduce((sum,group)=>sum+group.length,0),newDeepComponentCount:gained.groups.length,
      ...(selected?{deep:targetEnvelope('deep',selected.representatives,deepLimit,selected.touched)}:{}),...(coverIndex<0?{}:{cover:targetEnvelope('cover',[field[coverIndex]!],coverLimit)})};
  };
}
export interface NativeSpatialJointAnalyticMove {
  readonly nearestPoint:Readonly<Vector2>;readonly distance:number;readonly requiredTranslation:number;
  readonly moves:readonly Readonly<{site:Readonly<Vector2>;translation:number}>[];
}
/** The nearest point belongs to the blocking footprint, not its anchor. The
 * two translations cover the target envelope, then callers verify every W. */
export function nativeSpatialJointAnalyticMove(object:NativeSpatialJointObject,target:NativeSpatialJointTarget,snapStep:number):NativeSpatialJointAnalyticMove|undefined {
  if(!Number.isFinite(snapStep)||snapStep<=0)throw new Error('Invalid joint alignment step');
  if(target.envelopeRadius<=0)return undefined;
  const q={x:target.centre.x-object.site.x,y:target.centre.y-object.site.y};
  if(nativePrimitiveDistance(nativePrimitiveTree(object.blocking),q.x,q.y)<=target.envelopeRadius)return undefined;
  let squared=Infinity,z:Vector2|undefined;
  for(const primitive of object.blocking)for(let i=0;i<primitive.points.length;i+=2){
    const j=(i+2)%primitive.points.length,ax=primitive.points[i]!,ay=primitive.points[i+1]!,dx=primitive.points[j]!-ax,dy=primitive.points[j+1]!-ay;
    const length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((q.x-ax)*dx+(q.y-ay)*dy)/length)):0,p={x:ax+t*dx,y:ay+t*dy},d=(p.x-q.x)**2+(p.y-q.y)**2;
    if(d<squared||d===squared&&(!z||pointOrder(p,z)<0)){squared=d;z=p;}
  }
  if(!z||!Number.isFinite(squared))return undefined;
  const distance=Math.sqrt(squared),requiredTranslation=distance-target.envelopeRadius,dx=(q.x-z.x)/distance,dy=(q.y-z.y)/distance;
  const t0=requiredTranslation+snapStep/Math.SQRT2,moves=[t0,t0+snapStep].map(translation=>({translation,site:{x:Math.round((object.site.x+translation*dx)/snapStep)*snapStep,y:Math.round((object.site.y+translation*dy)/snapStep)*snapStep}}));
  return{nearestPoint:{x:z.x+object.site.x,y:z.y+object.site.y},distance,requiredTranslation,moves};
}
export function refineNativeSpatialJointObjects(context:NativeSpatialJointContext):NativeSpatialJointResult {
  const {objects,field,ground,gapPx,witness,snapStep}=context,before=context.evaluate([]),trees=objects.map(o=>nativePrimitiveTree(o.blocking));
  const distance=(index:number,point:Readonly<Vector2>,site=objects[index]!.site)=>nativePrimitiveDistance(trees[index]!,point.x-site.x,point.y-site.y);
  const objectDistances=objects.map((_,i)=>field.map(p=>distance(i,p))),baseDistances=field.map((_,p)=>Math.min(...objectDistances.map(d=>d[p]!)));
  const selectTargets=createNativeSpatialJointTargetSelector(field,context.baseFieldCount,context.baseFieldCellPx,baseDistances,context.coverPlanningLimit,context.deepPlanningLimit);
  const first=objects.map((o,index)=>({index,id:o.id,d:distance(index,witness)})).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).slice(0,3);
  const completeStates=new Set<string>(),pairs=new Set<string>(),siteTraces:NativeSpatialJointSiteTrace[]=[],trials:NativeSpatialJointTrial[]=[];
  let best=before,selected:readonly NativeSpatialWidePlacement[]=[],precheckCount=0;const cap=Math.min(48,12*objects.length);
  for(const primary of first){
    const a=primary.index,object=objects[a]!,remaining=field.map((_,p)=>Math.min(...objectDistances.flatMap((d,i)=>i===a?[]:[d[p]!])));
    for(const as of directedSites(object.site,witness,[16,32,64,96],snapStep)){
      const empty={targetsComputed:false,newDeepPointCount:0,newDeepComponentCount:0,primaryId:object.id,site:as,blockerIds:[],prechecks:[]};
      if(!supported(object,as,ground)){siteTraces.push({...empty,skippedReason:'primary-ground-support'});continue;}
      const blockers=objects.flatMap((other,index)=>index!==a&&conflict(object,as,other,other.site,gapPx)?[index]:[]).sort((i,j)=>objects[i]!.id.localeCompare(objects[j]!.id));
      if(blockers.length>1){siteTraces.push({...empty,blockerIds:blockers.map(i=>objects[i]!.id),skippedReason:'multiple-blockers'});continue;}
      const next=field.map((p,i)=>Math.min(remaining[i]!,distance(a,p,as))),targets=selectTargets(next),prechecks:NativeSpatialJointPrecheck[]=[];
      siteTraces.push({...targets,targetsComputed:true,primaryId:object.id,site:as,blockerIds:blockers.map(i=>objects[i]!.id),prechecks});
      const partnerMoves=(target:NativeSpatialJointTarget|undefined)=>!target?[]:objects.flatMap((other,index)=>{
        if(index===a||blockers.length&&index!==blockers[0])return[];const move=nativeSpatialJointAnalyticMove(other,target,snapStep);return move?[{index,id:other.id,...move}]:[];
      }).sort((left,right)=>left.requiredTranslation-right.requiredTranslation||left.id.localeCompare(right.id)).slice(0,3);
      const deep=partnerMoves(targets.deep),cover=partnerMoves(targets.cover);
      for(let slot=0;slot<4;slot++){
        if(trials.length>=cap)break;
        const release=slot===3&&blockers.length===1,target=slot<2?targets.deep:targets.cover;
        const name:NativeSpatialJointSlot=release?'release':(['deep-t0','deep-t1','cover-t0','cover-t1'] as const)[slot]!;
        const candidates=release?[{index:blockers[0]!,id:objects[blockers[0]!]!.id,move:{site:{x:objects[blockers[0]!]!.site.x+as.x-object.site.x,y:objects[blockers[0]!]!.site.y+as.y-object.site.y}},analytic:undefined}]:
          (slot<2?deep:cover).map(analytic=>({index:analytic.index,id:analytic.id,move:analytic.moves[slot%2]!,analytic}));
        for(const candidate of candidates){
          const entries=[{index:a,site:as},{index:candidate.index,site:candidate.move.site}],reasons:string[]=[];
          if(++precheckCount>144)throw new Error('Joint precheck budget exceeded');
          if(!release&&target!.points.some(p=>distance(candidate.index,p,candidate.move.site)>target!.limit))reasons.push('target-coverage');
          if(!reasons.length)reasons.push(...nativeSpatialPlacementRejections(objects,entries,ground,gapPx));
          const key=entries.map(entry=>`${objects[entry.index]!.id}@${entry.site.x},${entry.site.y}`).sort().join('|'),duplicate=!reasons.length&&completeStates.has(key);
          if(duplicate)reasons.push('duplicate-complete-state');
          prechecks.push({slot:name,partnerId:candidate.id,site:candidate.move.site,...(candidate.analytic?{distance:candidate.analytic.distance,nearestPoint:candidate.analytic.nearestPoint,requiredTranslation:candidate.analytic.requiredTranslation,translation:candidate.move.translation}:{}),reasons});
          if(duplicate)break; // A repeated slot is not replaced with another B.
          if(reasons.length)continue;
          completeStates.add(key);pairs.add(`${object.id}:${candidate.id}`);
          const score=context.evaluate(entries);trials.push({ids:[object.id,candidate.id],entries,cause:blockers.length?'blocker':'coverage',lossPoint:release?null:target!.points[0]!,legal:true,score,slot:name,...(!release?{target}: {})});
          if(nativeSpatialConstraintsImproved(before,score)&&compareNativeSpatialConstraintScores(score,best)<0){best=score;selected=entries;}break;
        }
      }
    }
  }
  return{entries:selected,before,after:best,pairCount:pairs.size,primaryCount:first.length,precheckCount,sites:siteTraces,trialCount:trials.length,evaluatedCount:trials.length,trials};
}
