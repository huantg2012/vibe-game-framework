/** Equal bounded candidate families; no world IDs or mutations of source inputs. */
import { mix32 } from '@/generation/seed-fork';
import { buildNativeVolume } from './native-volume-geometry';
import type { Vector2 } from '@/types/game-types';
import type { MasterDefinition } from './r100-master-world';
import { compileR100FragmentShape, type R100FrozenFragmentShape } from './r100-fragment-shape';
import type { SpatialAugmentationAxis, SpatialAugmentationKind, SpatialAugmentationPolicy } from './spatial-augmentation-types';
import type { SpatialHotspot } from './spatial-augmentation-measure';

export interface SpatialAugmentationGroup {readonly center:Readonly<Vector2>;readonly kind:SpatialAugmentationKind;readonly shape:string;readonly length:number;readonly width:number;readonly rotation:number}
export interface SpatialTerrainPlan {
  readonly definition:MasterDefinition; readonly fragmentShape:R100FrozenFragmentShape;
  readonly addedSolidIds:readonly number[]; readonly addedVoidCount:number; readonly addedGroups?:readonly SpatialAugmentationGroup[];
}
export interface SpatialTerrainCandidate extends SpatialTerrainPlan {
  readonly id:string; readonly kind:SpatialAugmentationKind; readonly axis:SpatialAugmentationAxis; readonly hotspot:Readonly<Vector2>;
  readonly newSolidIds:readonly number[]; readonly newVoidBoundary:readonly Readonly<Vector2>[];
}
export interface SpatialCandidateAttempt {
  readonly id:string; readonly kind:SpatialAugmentationKind; readonly axis:SpatialAugmentationAxis; readonly hotspot:Readonly<Vector2>;
  readonly candidate?:SpatialTerrainCandidate; readonly rejection?:string;
}
function inside(points:readonly Readonly<Vector2>[],p:Readonly<Vector2>):boolean {
  let result=false;for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i]!,b=points[j]!;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }return result;
}
function repeatsRow(groups:readonly SpatialAugmentationGroup[],center:Readonly<Vector2>,p:SpatialAugmentationPolicy['parameters']):boolean {
  const solids=groups.map(group=>group.center);
  const angle=Math.sin(p.repeatAngleToleranceDeg*Math.PI/180);
  for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++) {
    const a=solids[i]!,b=solids[j]!,ab=Math.hypot(a.x-b.x,a.y-b.y),ac=Math.hypot(a.x-center.x,a.y-center.y),bc=Math.hypot(b.x-center.x,b.y-center.y);
    if(!ab||!ac||!bc)return true;
    const distances=[ab,ac,bc].sort((x,y)=>x-y),[first,second,longest]=distances as [number,number,number];
    const cross=Math.abs((a.x-center.x)*(b.y-center.y)-(a.y-center.y)*(b.x-center.x))/(ac*bc);
    if(cross<=angle && Math.abs(first-second)/Math.max(first,second)<=p.repeatSpacingToleranceRatio
      &&Math.abs(longest-first-second)/longest<=p.repeatSpacingToleranceRatio)return true;
  }return false;
}
/** Frozen identity-derived randomness, separate from the effective mesh seed. */
export function deriveSpatialAugmentationSeed(requestedSeed:number,worldId:string,policy:SpatialAugmentationPolicy,effectiveSeed:number):number {
  if(![requestedSeed,effectiveSeed].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=0xffffffff)||!/^[a-z][a-z0-9-]+$/.test(worldId))throw new Error('Invalid augmentation seed identity');
  return mix32(requestedSeed,`spatial-completion:${worldId}:${policy.algorithm}:${policy.version}:${policy.sourceHash}:${effectiveSeed}`);
}
export function* spatialCandidateAttempts(current:SpatialTerrainPlan,hotspots:readonly SpatialHotspot[],policy:SpatialAugmentationPolicy,seed:number,round:number,candidateSeed=seed):Generator<SpatialCandidateAttempt> {
  const p=policy.parameters,profiles=policy.profiles.filter(profile=>profile.family===current.definition.family).sort((a,b)=>a.id.localeCompare(b.id));
  let count=0;
  for(let h=0;h<hotspots.length;h++)for(const kind of ['solid','void','combined'] as const)for(let variant=0;variant<2;variant++) {
    if(count++>=p.maxCandidatesPerRound)return;
    const hotspot=hotspots[h]!,id=`r${round}-h${h}-${kind}-${variant}`,metadata={id,kind,axis:hotspot.axis,hotspot:hotspot.point};
    try {
      const addSolid=kind!=='void',addVoid=kind!=='solid';
      if(addSolid&&(!profiles.length||current.addedSolidIds.length>=p.maxAddedSolids))throw new Error('solid-profile-or-budget');
      if(addVoid&&current.addedVoidCount>=p.maxAddedVoids)throw new Error('void-budget');
      const instances=[...current.definition.instances];
      if(addSolid&&(instances.length>=48||instances.filter(item=>item.role==='solid').length>=32))throw new Error('object-capacity');
      const random=(label:string):number=>mix32(candidateSeed,`spatial-completion-v1:${id}:${label}`)/0xffffffff;
      const sign=variant===0?1:-1,orientation=current.definition.axis+(variant===0?0:Math.PI/2),ux=-Math.sin(orientation)*sign,uy=Math.cos(orientation)*sign;
      // Reserve the original wide core at the hotspot. Proposal offsets use the
      // actual mesh projection / rectangle extent plus its required core radius.
      let solidCenter={...hotspot.point},voidCenter={...hotspot.point};
      const newSolidIds:number[]=[];
      if(addSolid) {

        const profile=profiles[Math.floor(random('profile')*profiles.length)%profiles.length]!,newId=Math.max(0,...instances.map(item=>item.id))+1;
        const between=(min:number,max:number,label:string):number=>min+(max-min)*random(label);
        let instance:MasterDefinition['instances'][number]={id:newId,role:'solid',family:profile.family,...solidCenter,
          rotation:orientation+profile.rotationOffsetRad,length:between(profile.minLengthPx,profile.maxLengthPx,'length'),width:between(profile.minWidthPx,profile.maxWidthPx,'width'),
          height:between(profile.minHeightPx,profile.maxHeightPx,'height'),thickness:profile.thicknessPx,fold:profile.fold,branches:profile.branches,opening:profile.opening,
          distortion:profile.distortion,constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile};
        const {role:_role,...shape}=instance;
        const mesh=buildNativeVolume({...shape,family:profile.family,blocking:1,seed:seed^Math.imul(newId,104729)});
        let inwardExtent=0;
        for(let vertex=0;vertex<mesh.positions.length;vertex+=3)inwardExtent=Math.max(inwardExtent,-((mesh.positions[vertex]!-hotspot.point.x)*ux+(mesh.positions[vertex+1]!-hotspot.point.y)*uy));
        const offset=Math.max(p.comboOffsetPx/2,inwardExtent+p.wideCoreRadiusPx+8);
        if(offset>p.hotspotRadiusPx)throw new Error('solid-does-not-fit-hotspot');
        solidCenter={x:hotspot.point.x+ux*offset,y:hotspot.point.y+uy*offset};instance={...instance,...solidCenter};
        const duplicate=instances.some(item=>item.role==='solid'&&item.x===instance.x&&item.y===instance.y&&item.rotation===instance.rotation&&item.length===instance.length&&item.width===instance.width);
        if(duplicate)throw new Error('duplicate-geometry');instances.push(instance);newSolidIds.push(newId);
      }
      let group:SpatialAugmentationGroup={center:kind==='combined'?hotspot.point:kind==='solid'?solidCenter:voidCenter,kind,shape:instances[instances.length-1]?.shapeProfile??'none',length:instances[instances.length-1]?.length??0,width:instances[instances.length-1]?.width??0,rotation:orientation};
      let fragmentShape=current.fragmentShape,definition={...current.definition,instances},newVoidBoundary:readonly Readonly<Vector2>[]=[];
      if(addVoid) {
        const scale=fragmentShape.layout.worldScale;
        const length=p.voidLengthMinPx+(p.voidLengthMaxPx-p.voidLengthMinPx)*random('void-length');
        const width=p.voidWidthMinPx+(p.voidWidthMaxPx-p.voidWidthMinPx)*random('void-width');
        const w=variant===0?length:width,hgt=variant===0?width:length;
        const extent=Math.abs(ux)*w/2+Math.abs(uy)*hgt/2,offset=Math.max(p.comboOffsetPx/2,extent+p.wideCoreRadiusPx+8);
        if(offset>p.hotspotRadiusPx)throw new Error('void-does-not-fit-hotspot');
        voidCenter={x:hotspot.point.x-ux*offset,y:hotspot.point.y-uy*offset};
        group={...group,center:kind==='void'?voidCenter:group.center,shape:kind==='void'?'rectilinear-void':`${group.shape}+void`,length:kind==='void'?w:group.length,width:kind==='void'?hgt:group.width,rotation:kind==='void'?0:group.rotation};
        const rect=[Math.round((voidCenter.x-w/2)/scale),Math.round((voidCenter.y-hgt/2)/scale),Math.round(w/scale),Math.round(hgt/scale)] as const;
        fragmentShape={...fragmentShape,layout:{...fragmentShape.layout,voidRects:[...fragmentShape.layout.voidRects,rect]}};
        const compiled=compileR100FragmentShape(fragmentShape);
        newVoidBoundary=compiled.erosion.find(polygon=>inside(polygon,voidCenter))??[];
        if(!newVoidBoundary.length)throw new Error('new-void-not-an-internal-hole');
        definition={...definition,terrainOutline:compiled.terrainOutline,erosion:compiled.erosion,fragmentShapeVersion:fragmentShape.algorithmVersion};
      }
      const groups=current.addedGroups??[];
      if(repeatsRow(groups,group.center,p))throw new Error('repeated-equal-spacing-row');
      const similar=(a:number,b:number):boolean=>Math.abs(a-b)/Math.max(a,b,1)<=p.repeatSpacingToleranceRatio;
      if(groups.some(previous=>previous.kind===group.kind&&previous.shape===group.shape&&similar(previous.length,group.length)&&similar(previous.width,group.width)
        &&Math.abs(Math.atan2(Math.sin(previous.rotation-group.rotation),Math.cos(previous.rotation-group.rotation)))<=p.repeatAngleToleranceDeg*Math.PI/180))throw new Error('repeated-normalized-geometry');
      yield {...metadata,candidate:{...metadata,definition,fragmentShape,newSolidIds,newVoidBoundary,
        addedGroups:[...groups,group],addedSolidIds:[...current.addedSolidIds,...newSolidIds],addedVoidCount:current.addedVoidCount+Number(addVoid)}};
    }catch(error){yield {...metadata,rejection:error instanceof Error?error.message:String(error)};}
  }
}
