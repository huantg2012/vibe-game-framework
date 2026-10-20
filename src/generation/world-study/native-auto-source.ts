/** Complete mother transforms shared by intent estimates and final planning.
 * This mirrors the existing reference compiler's assembly transform exactly. */
import {nativeConstructionFootprints} from './native-spatial-construction-shore';
import type {MasterDefinition} from './r100-master-world';

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
export function nativeAutoSourceProjection(native:MasterDefinition,seed:number,scale:number){
  const instances=nativeAutoSourceInstances(native,scale),footprint=nativeConstructionFootprints(instances,native.family,seed);
  const left=Math.min(...footprint.supportBounds.map(r=>r[0])),top=Math.min(...footprint.supportBounds.map(r=>r[1]));
  const width=Math.max(...footprint.supportBounds.map(r=>r[0]+r[2]))-left,height=Math.max(...footprint.supportBounds.map(r=>r[1]+r[3]))-top;
  if(!Number.isFinite(width*height)||width<=0||height<=0)throw new Error('Automatic source has no projected support');
  return{instances,footprint,width,height,areaPx2:width*height};
}
/** Size the original complete model, never a completed map. Two arithmetic
 * projections handle homothetic sources quickly. Fixed-height relief can make
 * that estimate insufficient: a bounded interval solve retains only measured
 * feasible scales, rather than assuming all source materials scale alike. */
export function nativeAutoBudgetSource(native:MasterDefinition,seed:number,maxAreaPx2:number){
  if(!Number.isFinite(maxAreaPx2)||maxAreaPx2<=0)throw new Error('Invalid automatic source area budget');
  // Bounds of the unchanged native volume compiler. Relief keeps its height
  // and thickness, so blindly approaching zero is not a legal search domain.
  const minimum=Math.min(1,Math.max(...native.instances.map(instance=>Math.max(
    16/instance.length,12/instance.width,
    instance.role==='solid'?2/instance.height:0,
    instance.role==='solid'?1/instance.thickness:instance.thickness/(.45*Math.min(instance.length,instance.width)),
  )))*(1+1e-8));
  let scale=1,projection=nativeAutoSourceProjection(native,seed,scale);
  for(let pass=0;pass<2&&projection.areaPx2>maxAreaPx2;pass++){
    // A 0.001% inward area reserve accommodates Float32 coordinates and the
    // compiler's fixed relief height without another correction/search pass.
    scale=Math.max(minimum,scale*Math.sqrt(maxAreaPx2*(1-1e-5)/projection.areaPx2));
    projection=nativeAutoSourceProjection(native,seed,scale);
  }
  if(projection.areaPx2>maxAreaPx2){
    let upper=scale,lower=minimum;
    let feasible=nativeAutoSourceProjection(native,seed,lower);
    if(feasible.areaPx2>maxAreaPx2)throw new Error('Complete automatic source cannot fit its area budget');
    for(let step=0;step<16;step++){
      const middle=(lower+upper)/2,candidate=nativeAutoSourceProjection(native,seed,middle);
      if(candidate.areaPx2<=maxAreaPx2){lower=middle;feasible=candidate;}else upper=middle;
    }
    scale=lower;projection=feasible;
  }
  return{scale,...projection};
}
