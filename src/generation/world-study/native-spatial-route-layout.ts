/** Deterministic whole-object proposals derived only from rejected real routes.
 * Planning legality is not route improvement: the next actual geometry/probe
 * decides, under the existing controller's geometry and deadline budgets. */
import type {Vector2} from '@/types/game-types';
import type {NativeSpatialPolicy} from './native-spatial-types';
import type {NativeSpatialPlanningGround} from './native-spatial-bay-layout';
import type {NativeSpatialRouteFeedback,NativeSpatialRouteWitness,NativeSpatialRouteWitnessEvent} from './native-spatial-route-feedback';
import {classifyNativeRouteHoleShare} from './native-spatial-routes';
import {nativeSpatialPlacementRejections,type NativeSpatialJointObject} from './native-spatial-joint-refinement';
import type {NativeSpatialWidePlacement} from './native-spatial-wide-domain';

type Point=Readonly<Vector2>;
export interface NativeSpatialRouteTrial {
  readonly routeId:string;readonly witnessKind:NativeSpatialRouteWitness['kind'];readonly at:number;
  readonly cause:'type-swap'|'narrow-single'|'narrow-pair'|'blocker-release';readonly variant:number;
  readonly sourceStructureIds:readonly string[];readonly objectIds:readonly string[];
  readonly entries:readonly NativeSpatialWidePlacement[];readonly reasons:readonly string[];
  readonly swapRank?:Readonly<{correctionValue:number;reverseEvidenceCount:number;footprintMismatch:number;distance:number;
    sources:readonly Readonly<{routeId:string;kind:'hole-share'|'window';primaryObjectId:string;primaryStructureId:string;at:number;
      partnerObjectId:string;reverseRouteId?:string;partnerStructureId?:string}>[]}>;
}
export interface NativeSpatialRouteRefinement {
  readonly ordinal:number;readonly nextOrdinal:number;readonly consumedTuples:number;readonly seenTupleKeys:readonly string[];
  readonly candidateCount:number;readonly legalCount:number;readonly exhausted:boolean;
  readonly entries:readonly NativeSpatialWidePlacement[];readonly selectedIndex:number|null;
  readonly trials:readonly NativeSpatialRouteTrial[];readonly unavailable:readonly Readonly<{routeId:string;reason:string}>[];
}
export interface NativeSpatialRoutePlacementContext {
  readonly objects:readonly NativeSpatialJointObject[];readonly ground:NativeSpatialPlanningGround;
  readonly policy:NativeSpatialPolicy;readonly feedback:NativeSpatialRouteFeedback;readonly checkpoint:()=>void;
}
const LIMIT=48;
const snap=(value:number)=>Math.round(value/8)*8;
function routeDistance(point:Point,path:readonly Point[]):number {
  let minimum=Infinity;
  for(let i=0;i<path.length;i++){const a=path[i]!,b=path[i+1]??a,dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/n)):0;minimum=Math.min(minimum,Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy));}
  return minimum;
}
function excessKind(witness:NativeSpatialRouteWitness,policy:NativeSpatialPolicy):'hole'|'solid'|undefined {
  if(witness.kind==='window')return'solid';
  if(witness.kind!=='hole-share'||!witness.events.length)return;
  const n=witness.events.length,h=witness.events.filter(e=>e.kind==='hole').length;
  let nearest=-1,distance=Infinity;
  for(let k=0;k<=n;k++)if(classifyNativeRouteHoleShare(k,n,policy).accepted&&Math.abs(k-h)<distance){nearest=k;distance=Math.abs(k-h);}
  return nearest<0||nearest===h?undefined:h>nearest?'hole':'solid';
}
function shareDeficit(holes:number,count:number,policy:NativeSpatialPolicy):number {
  let distance=Infinity;
  for(let k=0;k<=count;k++)if(classifyNativeRouteHoleShare(k,count,policy).accepted)distance=Math.min(distance,Math.abs(k-holes));
  return Number.isFinite(distance)?distance/Math.max(1,count):0;
}
/** Shape compatibility is only a cheap ranking feature, not a support or
 * collision check. It includes attached relief, which travels with its solid. */
function footprintSize(object:NativeSpatialJointObject):readonly [number,number] {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of object.support){minX=Math.min(minX,p.minX);minY=Math.min(minY,p.minY);maxX=Math.max(maxX,p.maxX);maxY=Math.max(maxY,p.maxY);}
  return[maxX-minX,maxY-minY];
}
/** No random draws, new shapes, extra objects, or copied deployment. */
export function selectNativeSpatialRoutePlacement(context:NativeSpatialRoutePlacementContext):NativeSpatialRouteRefinement {
  const {objects,ground,policy,feedback,checkpoint}=context,ordinal=feedback.refinementOrdinal;
  if(!Number.isSafeInteger(ordinal)||ordinal<0)throw new Error('Invalid native route refinement ordinal');
  const budget=feedback.remainingTupleBudget;
  if(!Number.isSafeInteger(budget)||budget<0||budget>LIMIT)throw new Error('Invalid native route remaining tuple budget');
  if(feedback.gate.accepted||!feedback.comparable)throw new Error('Native route refinement requires a comparable rejected actual probe');
  const byId=new Map(objects.map((o,index)=>[o.id,index]));
  if(byId.size!==objects.length)throw new Error('Native route objects require unique identities');
  const resolve=(ids:readonly string[],kind:'hole'|'solid'):number|undefined=>{const matches=[...new Set(ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]))];return matches.length===1&&objects[matches[0]!]!.kind===kind?matches[0]:undefined;};
  const unavailable:{routeId:string;reason:string}[]=[],raw:Omit<NativeSpatialRouteTrial,'reasons'>[]=[];
  const trials:NativeSpatialRouteTrial[]=[],seen=new Set(feedback.seenTupleKeys??[]);
  if(seen.size>LIMIT)throw new Error('Native route tuple history exceeds its bounded epoch');
  let nextOrdinal=ordinal,selected:NativeSpatialRouteTrial|undefined,selectedIndex:number|null=null,candidateCount=0;
  const trace=():NativeSpatialRouteRefinement=>({ordinal,nextOrdinal,consumedTuples:trials.length,seenTupleKeys:[...seen],candidateCount,legalCount:selected?1:0,exhausted:!selected,entries:selected?.entries??[],selectedIndex,trials,unavailable});
  try{
  const sorted=[...feedback.witnesses].sort((a,b)=>a.routeId.localeCompare(b.routeId)||a.kind.localeCompare(b.kind));
  const orderedEvents=(events:readonly NativeSpatialRouteWitnessEvent[])=>[...events].sort((a,b)=>a.at-b.at||a.structureId.localeCompare(b.structureId));
  const eventObjects=(events:readonly NativeSpatialRouteWitnessEvent[],kind:'hole'|'solid')=>{const seen=new Set<number>();return orderedEvents(events).flatMap(event=>{if(event.kind!==kind)return[];const index=resolve(event.objectIds,kind);if(index===undefined||seen.has(index))return[];seen.add(index);return[{index,event}];});};
  const propose=(w:NativeSpatialRouteWitness,at:number,cause:NativeSpatialRouteTrial['cause'],variant:number,sourceStructureIds:readonly string[],entries:readonly NativeSpatialWidePlacement[])=>{
    raw.push({routeId:w.routeId,witnessKind:w.kind,at,cause,variant,sourceStructureIds,objectIds:entries.map(e=>objects[e.index]!.id),entries});
  };
  for(const witness of sorted){checkpoint();
    if(witness.kind==='hole-share'||witness.kind==='window'){
      const surplus=excessKind(witness,policy);if(!surplus){unavailable.push({routeId:witness.routeId,reason:'no-excess-type'});continue;}
      const missing=surplus==='hole'?'solid':'hole',primaries=eventObjects(witness.kind==='window'?witness.windowEvents??[]:witness.events,surplus);
      if(!primaries.length){unavailable.push({routeId:witness.routeId,reason:'no-unique-excess-object'});continue;}
      const reverse=sorted.filter(w=>w.kind==='hole-share'&&excessKind(w,policy)===missing).flatMap(w=>eventObjects(w.events,missing).map(entry=>({...entry,witness:w})));
      // Reverse failures provide evidence, not an exclusion filter. A smaller
      // missing-kind object outside them must still be able to get a turn.
      const partners=objects.map((o,index)=>({index,id:o.id,kind:o.kind})).filter(o=>o.kind===missing);
      for(const primary of primaries)for(const partner of partners){
        const a=objects[primary.index]!,b=objects[partner.index]!,as=footprintSize(a),bs=footprintSize(b),reverseSources=reverse.filter(r=>r.index===partner.index);
        let correctionValue=0;const scored=new Set<string>();
        for(const w of sorted){if(w.kind==='narrow')continue;
          const events=w.kind==='window'?w.windowEvents??[]:w.events,key=`${w.routeId}|${w.kind}|${events.map(e=>e.structureId).join(',')}`;
          if(scored.has(key)||!events.length)continue;scored.add(key);
          const h=events.filter(e=>e.kind==='hole').length;
          let delta=0;for(const e of events){const index=resolve(e.objectIds,e.kind);if(index===primary.index)delta+=b.kind==='hole'?1:-1;else if(index===partner.index)delta+=a.kind==='hole'?1:-1;}
          correctionValue+=w.kind==='window'?(Math.max(0,policy.minWindowHoles-h)-Math.max(0,policy.minWindowHoles-h-delta))/policy.minWindowHoles:shareDeficit(h,events.length,policy)-shareDeficit(h+delta,events.length,policy);
        }
        const sources=(reverseSources.length?reverseSources:[undefined]).map(r=>({routeId:witness.routeId,kind:witness.kind as 'hole-share'|'window',primaryObjectId:a.id,primaryStructureId:primary.event.structureId,at:primary.event.at,partnerObjectId:b.id,...(r?{reverseRouteId:r.witness.routeId,partnerStructureId:r.event.structureId}:{})}));
        raw.push({routeId:witness.routeId,witnessKind:witness.kind,at:primary.event.at,cause:'type-swap',variant:0,sourceStructureIds:[primary.event.structureId],objectIds:[a.id,b.id],entries:[{index:primary.index,site:{...b.site}},{index:partner.index,site:{...a.site}}],
          swapRank:{correctionValue,reverseEvidenceCount:new Set(reverseSources.map(r=>r.witness.routeId)).size,footprintMismatch:Math.abs(as[0]-bs[0])/Math.max(1,as[0],bs[0])+Math.abs(as[1]-bs[1])/Math.max(1,as[1],bs[1]),distance:Math.hypot(a.site.x-b.site.x,a.site.y-b.site.y)+routeDistance(b.site,witness.points),sources}});
      }
      continue;
    }
    const section=[...(witness.crossSections??[])].filter(s=>s.closed&&Number.isFinite(s.widthLowerPx)&&s.widthLowerPx>=0).sort((a,b)=>a.widthLowerPx-b.widthLowerPx||a.at-b.at)[0];
    if(!section){unavailable.push({routeId:witness.routeId,reason:'no-owned-closed-section'});continue;}
    const [left,right]=section.hits,dx=right.point.x-left.point.x,dy=right.point.y-left.point.y,length=Math.hypot(dx,dy);
    if(length<=1e-7){unavailable.push({routeId:witness.routeId,reason:'degenerate-section-normal'});continue;}
    const indices=section.hits.map(hit=>hit.owner.kind==='exterior'?undefined:resolve(hit.owner.objectIds,hit.owner.kind)),amount=Math.ceil(Math.max(8,policy.narrowWidthPx-section.widthLowerPx)/8)*8;
    if(section.hits.some((hit,i)=>hit.owner.kind!=='exterior'&&indices[i]===undefined)||indices[0]!==undefined&&indices[0]===indices[1]){unavailable.push({routeId:witness.routeId,reason:'ambiguous-section-object'});continue;}
    const move=(index:number,sign:number,distance:number):NativeSpatialWidePlacement=>({index,site:{x:snap(objects[index]!.site.x+sign*distance*dx/length),y:snap(objects[index]!.site.y+sign*distance*dy/length)}}),sources=section.hits.flatMap(h=>h.owner.structureId?[h.owner.structureId]:[]);
    if(section.hits.some(hit=>hit.owner.kind==='exterior')){
      const side=indices[0]!==undefined?0:1,index=indices[side];
      if(index===undefined||objects[index]!.kind!=='hole'){unavailable.push({routeId:witness.routeId,reason:'exterior-without-owned-hole'});continue;}
      for(let tier=0;tier<2;tier++)propose(witness,section.at,'narrow-single',tier,sources,[move(index,side===0?-1:1,amount+tier*8)]);
    }else{
      const a=indices[0]!,b=indices[1]!;
      for(let tier=0;tier<2;tier++){const distance=amount+tier*8;
        propose(witness,section.at,'narrow-single',tier*3,sources,[move(a,-1,distance)]);
        propose(witness,section.at,'narrow-single',tier*3+1,sources,[move(b,1,distance)]);
        propose(witness,section.at,'narrow-pair',tier*3+2,sources,[move(a,-1,distance/2),move(b,1,distance/2)]);
      }
    }
  }
  raw.sort((a,b)=>a.routeId.localeCompare(b.routeId)||a.at-b.at||a.objectIds.join('|').localeCompare(b.objectIds.join('|'))||a.variant-b.variant||a.cause.localeCompare(b.cause));
  const keyOf=(entries:readonly NativeSpatialWidePlacement[])=>[...entries].sort((a,b)=>a.index-b.index).map(e=>`${e.index}@${e.site.x},${e.site.y}`).join('|');
  const unique=new Map<string,Omit<NativeSpatialRouteTrial,'reasons'>>();
  for(const candidate of raw){const key=keyOf(candidate.entries),existing=unique.get(key);
    if(!existing){unique.set(key,candidate);continue;}
    if(existing.swapRank&&candidate.swapRank){const sources=[...existing.swapRank.sources,...candidate.swapRank.sources],sourceKeys=new Set<string>();
      unique.set(key,{...existing,swapRank:{...existing.swapRank,reverseEvidenceCount:Math.max(existing.swapRank.reverseEvidenceCount,candidate.swapRank.reverseEvidenceCount),distance:Math.min(existing.swapRank.distance,candidate.swapRank.distance),sources:sources.filter(source=>{const identity=JSON.stringify(source);if(sourceKeys.has(identity))return false;sourceKeys.add(identity);return true;})}});
    }
  }
  const stable=(a:Omit<NativeSpatialRouteTrial,'reasons'>,b:Omit<NativeSpatialRouteTrial,'reasons'>)=>a.routeId.localeCompare(b.routeId)||a.at-b.at||a.objectIds.join('|').localeCompare(b.objectIds.join('|'))||a.variant-b.variant||a.cause.localeCompare(b.cause);
  const swaps=[...unique.values()].filter(c=>c.swapRank),narrow=[...unique.values()].filter(c=>!c.swapRank),uses=new Map<number,number>(),orderedSwaps:typeof swaps=[];
  // Balance actual object identities before pure quality tie-breaks: neither
  // early route IDs nor the first three large holes can monopolise the domain.
  while(swaps.length&&orderedSwaps.length<LIMIT){checkpoint();
    const use=(c:typeof swaps[number])=>c.entries.map(e=>uses.get(e.index)??0);
    swaps.sort((a,b)=>Math.max(...use(a))-Math.max(...use(b))||use(a).reduce((s,n)=>s+n,0)-use(b).reduce((s,n)=>s+n,0)||b.swapRank!.correctionValue-a.swapRank!.correctionValue||b.swapRank!.reverseEvidenceCount-a.swapRank!.reverseEvidenceCount||a.swapRank!.footprintMismatch-b.swapRank!.footprintMismatch||a.swapRank!.distance-b.swapRank!.distance||stable(a,b));
    const chosen=swaps.shift()!;orderedSwaps.push(chosen);for(const e of chosen.entries)uses.set(e.index,(uses.get(e.index)??0)+1);
  }
  // Keep shore/narrow evidence represented in the same shared 48, without
  // performing uncharged placement checks while constructing either list.
  const domain:typeof raw=[];
  for(let i=0;domain.length<LIMIT&&(i<orderedSwaps.length||i<narrow.length);i++){
    if(i<orderedSwaps.length)domain.push(orderedSwaps[i]!);
    if(domain.length<LIMIT&&i<narrow.length)domain.push(narrow[i]!);
  }
  candidateCount=domain.length;
  const consider=(candidate:Omit<NativeSpatialRouteTrial,'reasons'>):NativeSpatialRouteTrial|undefined=>{
    checkpoint();if(trials.length>=budget)return;
    const key=keyOf(candidate.entries);if(seen.has(key))return;seen.add(key);
    const stationary=candidate.entries.every(e=>e.site.x===objects[e.index]!.site.x&&e.site.y===objects[e.index]!.site.y);
    const index=trials.length;trials.push({...candidate,reasons:['evaluation-incomplete']});
    const reasons=stationary?['unchanged-complete-state']:nativeSpatialPlacementRejections(objects,candidate.entries,ground,policy.wideRadiusPx*1.5),trial={...candidate,reasons};trials[index]=trial;return trial;
  };
  for(let index=ordinal;index<domain.length&&trials.length<budget;index++){
    nextOrdinal=index+1;const candidate=domain[index]!,trial=consider(candidate);
    if(!trial)continue;
    if(!trial.reasons.length){selected=trial;selectedIndex=index;break;}
    if(trial.entries.length!==1)continue;
    const first=trial.entries[0]!,primary=objects[first.index]!,blockers=objects.flatMap((o,i)=>i!==first.index&&trial.reasons.includes(`${primary.id}:${o.id}:fixed-conflict`)?[i]:[]);
    if(blockers.length!==1||trial.reasons.some(reason=>reason!==`${primary.id}:${objects[blockers[0]!]!.id}:fixed-conflict`))continue;
    const partner=blockers[0]!,other=objects[partner]!,delta={x:first.site.x-primary.site.x,y:first.site.y-primary.site.y};
    const released=consider({...candidate,cause:'blocker-release',objectIds:[primary.id,other.id],entries:[first,{index:partner,site:{x:other.site.x+delta.x,y:other.site.y+delta.y}}]});
    if(released&&!released.reasons.length){selected=released;selectedIndex=index;break;}
  }
  return trace();
  }catch(error){throw Object.assign(error instanceof Error?error:new Error(String(error)),{routeRefinement:trace()});}
}
