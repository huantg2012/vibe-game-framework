/** Complete mother transforms shared by intent estimates and final planning.
 * This mirrors the existing reference compiler's assembly transform exactly. */
import {nativeConstructionFootprints} from './native-spatial-construction-shore';
import {NATIVE_SPATIAL_BODY_HALF,nativePrimitiveTree,type NativeSpatialPrimitive,type NativeSpatialBvh} from './native-spatial-geometry';
import type {MasterDefinition} from './r100-master-world';

/** Largest x in A - B at |y| <= gap. The nine vertex differences span
 * this convex polygon; its intersection with either horizontal band edge
 * lies on a vertex-pair segment. This uses the actual projected triangles,
 * leaving concavities available instead of excluding an assembly rectangle. */
function triangleSeparation(a:NativeSpatialPrimitive,b:NativeSpatialPrimitive,gap:number):number {
  if(a.maxY+gap<b.minY||b.maxY+gap<a.minY)return-Infinity;
  const xs:number[]=[],ys:number[]=[];
  let maximum=-Infinity;
  for(let i=0;i<6;i+=2)for(let j=0;j<6;j+=2){
    const x=a.points[i]!-b.points[j]!,y=a.points[i+1]!-b.points[j+1]!;
    xs.push(x);ys.push(y);if(Math.abs(y)<=gap)maximum=Math.max(maximum,x);
  }
  for(let i=0;i<9;i++)for(let j=0;j<i;j++){
    const yi=ys[i]!,yj=ys[j]!;if(yi===yj)continue;
    for(const edge of [-gap,gap])if((yi<edge&&yj>edge)||(yi>edge&&yj<edge))
      maximum=Math.max(maximum,xs[i]!+(xs[j]!-xs[i]!)*(edge-yi)/(yj-yi));
  }
  return maximum+gap;
}

/** Bounded, one-way ordering of complete parts. Each later solid moves only
 * along x, far enough to retain the shared clearance from every earlier part.
 * Relief follows its nearest original solid (stable id tie-break). Dimensions,
 * shape controls and materials are untouched; spacing follows final scaling. */
export function nativeAutoPreparedSourceInstances(native:MasterDefinition,seed:number,scale:number,clearancePx:number):MasterDefinition['instances'] {
  if(!Number.isFinite(clearancePx)||clearancePx<2*NATIVE_SPATIAL_BODY_HALF||clearancePx>1024||native.instances.length>48)
    throw new Error('Invalid automatic source clearance');
  const instances=nativeAutoSourceInstances(native,scale),solids=instances.filter(i=>i.role==='solid').sort((a,b)=>a.x-b.x||a.id-b.id);
  const primitives=nativeConstructionFootprints(instances,native.family,seed).solidPrimitives;
  if(primitives.length>32768)throw new Error('Automatic source exceeds triangle capacity');
  const parts=solids.map(instance=>({instance,tree:nativePrimitiveTree(primitives.filter(p=>p.objectId===instance.id)),offset:0}));
  let pairs=0;
  const separation=(a:NativeSpatialBvh,b:NativeSpatialBvh,best:number):number=>{
    if(++pairs>8388608)throw new Error('Automatic source exceeds separation work budget');
    if(a.maxY+clearancePx<b.minY||b.maxY+clearancePx<a.minY||a.maxX-b.minX+clearancePx<=best)return best;
    if(a.items&&b.items){
      for(const first of a.items)for(const second of b.items){
        if(++pairs>8388608)throw new Error('Automatic source exceeds separation work budget');
        if(first.maxX-second.minX+clearancePx>best)best=Math.max(best,triangleSeparation(first,second,clearancePx));
      }
      return best;
    }
    if(a.left&&(!b.left||(a.maxX-a.minX+a.maxY-a.minY)>(b.maxX-b.minX+b.maxY-b.minY))){
      const first=a.left.maxX>=a.right!.maxX?a.left:a.right!,second=first===a.left?a.right!:a.left;
      return separation(second,b,separation(first,b,best));
    }
    const first=b.left!.minX<=b.right!.minX?b.left!:b.right!,second=first===b.left?b.right!:b.left!;
    return separation(a,second,separation(a,first,best));
  };
  for(let next=0;next<parts.length;next++){
    const part=parts[next]!;
    for(let previous=0;previous<next;previous++){
      const other=parts[previous]!;
      part.offset=other.offset+separation(other.tree,part.tree,part.offset-other.offset);
    }
    // Float32 terrain translation must not close an exactly touching gap.
    if(part.offset>0)part.offset=Math.ceil(part.offset*1024)/1024+1/1024;
  }
  const center=parts.reduce((sum,part)=>sum+part.offset,0)/parts.length;
  return instances.map(instance=>{
    const parent=instance.role==='solid'?parts.find(part=>part.instance.id===instance.id)!:
      parts.reduce((nearest,part)=>{
        const distance=(part.instance.x-instance.x)**2+(part.instance.y-instance.y)**2;
        const best=(nearest.instance.x-instance.x)**2+(nearest.instance.y-instance.y)**2;
        return distance<best||(distance===best&&part.instance.id<nearest.instance.id)?part:nearest;
      });
    return{...instance,x:instance.x+parent.offset-center};
  });
}

export function nativeAutoSourceInstances(native:MasterDefinition,scale:number):MasterDefinition['instances'] {
  const solids=native.instances.filter(instance=>instance.role==='solid');
  if(!solids.length||!Number.isFinite(scale)||scale<=0||scale>1)throw new Error('Invalid complete automatic source scale');
  const cx=solids.reduce((sum,instance)=>sum+instance.x,0)/solids.length;
  const cy=solids.reduce((sum,instance)=>sum+instance.y,0)/solids.length;
  return native.instances.map(instance=>({...instance,x:(instance.x-cx)*scale,y:(instance.y-cy)*scale,
    length:instance.length*scale,width:instance.width*scale,
    height:instance.role==='solid'?instance.height*scale:instance.height,
    thickness:instance.role==='solid'?instance.thickness*scale:instance.thickness}));
}
export function nativeAutoSourceProjection(native:MasterDefinition,seed:number,scale:number,clearancePx=0){
  const instances=clearancePx?nativeAutoPreparedSourceInstances(native,seed,scale,clearancePx):nativeAutoSourceInstances(native,scale);
  const footprint=nativeConstructionFootprints(instances,native.family,seed);
  const left=Math.min(...footprint.supportBounds.map(r=>r[0])),top=Math.min(...footprint.supportBounds.map(r=>r[1]));
  const width=Math.max(...footprint.supportBounds.map(r=>r[0]+r[2]))-left,height=Math.max(...footprint.supportBounds.map(r=>r[1]+r[3]))-top;
  if(!Number.isFinite(width*height)||width<=0||height<=0)throw new Error('Automatic source has no projected support');
  return{instances,footprint,width,height,areaPx2:width*height};
}
/** Size the original complete model, never a completed map. Two arithmetic
 * projections handle homothetic sources quickly. Fixed-height relief can make
 * that estimate insufficient: a bounded interval solve retains only measured
 * feasible scales, rather than assuming all source materials scale alike. */
export function nativeAutoBudgetSource(native:MasterDefinition,seed:number,maxAreaPx2:number,clearancePx=0){
  if(!Number.isFinite(maxAreaPx2)||maxAreaPx2<=0)throw new Error('Invalid automatic source area budget');
  // Bounds of the unchanged native volume compiler. Relief keeps its height
  // and thickness, so blindly approaching zero is not a legal search domain.
  const minimum=Math.min(1,Math.max(...native.instances.map(instance=>Math.max(
    16/instance.length,12/instance.width,
    instance.role==='solid'?2/instance.height:0,
    instance.role==='solid'?1/instance.thickness:instance.thickness/(.45*Math.min(instance.length,instance.width)),
  )))*(1+1e-8));
  let scale=1,projection=nativeAutoSourceProjection(native,seed,scale,clearancePx);
  for(let pass=0;pass<2&&projection.areaPx2>maxAreaPx2;pass++){
    // A 0.001% inward area reserve accommodates Float32 coordinates and the
    // compiler's fixed relief height without another correction/search pass.
    scale=Math.max(minimum,scale*Math.sqrt(maxAreaPx2*(1-1e-5)/projection.areaPx2));
    projection=nativeAutoSourceProjection(native,seed,scale,clearancePx);
  }
  if(projection.areaPx2>maxAreaPx2){
    let upper=scale,lower=minimum;
    let feasible=nativeAutoSourceProjection(native,seed,lower,clearancePx);
    if(feasible.areaPx2>maxAreaPx2)throw new Error('Complete automatic source cannot fit its area budget');
    for(let step=0;step<16;step++){
      const middle=(lower+upper)/2,candidate=nativeAutoSourceProjection(native,seed,middle,clearancePx);
      if(candidate.areaPx2<=maxAreaPx2){lower=middle;feasible=candidate;}else upper=middle;
    }
    scale=lower;projection=feasible;
  }
  return{scale,...projection};
}
