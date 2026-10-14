/** Positive wide-plate proposals. This is an authoring sampler, not an art admission gate. */
import type {NativeSpatialFrozenInput} from './native-spatial-types';
import type {MasterDefinition} from './r100-master-world';
export type NativeSpatialLandRect=[number,number,number,number];
export interface NativeSpatialRandom {
  next():number;range(min:number,max:number):number;integer(min:number,max:number):number;
  choose<T>(items:readonly T[]):T;
}
export interface NativeSpatialLandShore {readonly x1:number;readonly y1:number;readonly x2:number;readonly y2:number;readonly direction:0|1|2|3;readonly parent:number}
export interface NativeSpatialLandPlate {
  readonly role:'core'|'shoulder';readonly parentIndex:number|null;
  readonly sourceShore?:NativeSpatialLandShore;readonly extensionPx?:number;
}
export interface NativeSpatialLandPlan {readonly rects:readonly NativeSpatialLandRect[];readonly plates:readonly NativeSpatialLandPlate[]}
type Shore=NativeSpatialLandShore;
const snap=(value:number):number=>Math.round(value/8)*8;
const contained=(r:NativeSpatialLandRect,x:number,y:number):boolean=>x>=r[0]&&y>=r[1]&&x<=r[0]+r[2]&&y<=r[1]+r[3];
export function nativeRectUnionArea(rects:readonly NativeSpatialLandRect[]):number {
  const xs=[...new Set(rects.flatMap(r=>[r[0],r[0]+r[2]]))].sort((a,b)=>a-b);let result=0;
  for(let i=0;i<xs.length-1;i++){
    const x=(xs[i]!+xs[i+1]!)/2,spans=rects.filter(r=>x>r[0]&&x<r[0]+r[2]).map(r=>[r[1],r[1]+r[3]]).sort((a,b)=>a[0]!-b[0]!);
    let end=-Infinity,length=0;for(const [start,stop]of spans){length+=Math.max(0,stop!-Math.max(start!,end));end=Math.max(end,stop!);}result+=(xs[i+1]!-xs[i]!)*length;
  }return result;
}
export function nativeSpatialExposedShore(rects:readonly NativeSpatialLandRect[]):Shore[]{
  const xs=[...new Set(rects.flatMap(r=>[r[0],r[0]+r[2]]))].sort((a,b)=>a-b),ys=[...new Set(rects.flatMap(r=>[r[1],r[1]+r[3]]))].sort((a,b)=>a-b),result:Shore[]=[];
  const present=(x:number,y:number):boolean=>x>=0&&y>=0&&x<xs.length-1&&y<ys.length-1&&rects.some(r=>contained(r,(xs[x]!+xs[x+1]!)/2,(ys[y]!+ys[y+1]!)/2));
  for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++)if(present(x,y)){
    const l=xs[x]!,r=xs[x+1]!,t=ys[y]!,b=ys[y+1]!;
    const add=(direction:0|1|2|3,x1:number,y1:number,x2:number,y2:number,insideX:number,insideY:number):void=>{
      const parent=rects.findIndex(rect=>contained(rect,insideX,insideY));if(parent>=0)result.push({direction,x1,y1,x2,y2,parent});
    };
    if(!present(x-1,y))add(0,l,t,l,b,l+.5,(t+b)/2);
    if(!present(x+1,y))add(1,r,t,r,b,r-.5,(t+b)/2);
    if(!present(x,y-1))add(2,l,t,r,t,(l+r)/2,t+.5);
    if(!present(x,y+1))add(3,l,b,r,b,(l+r)/2,b-.5);
  }return result;
}
function box(rects:readonly NativeSpatialLandRect[]){return{minX:Math.min(...rects.map(r=>r[0])),minY:Math.min(...rects.map(r=>r[1])),maxX:Math.max(...rects.map(r=>r[0]+r[2])),maxY:Math.max(...rects.map(r=>r[1]+r[3]))};}
function consumedShoreLength(shore:Shore,rect:NativeSpatialLandRect):number {
  const vertical=shore.direction<2,axis=vertical?shore.x1:shore.y1;
  const low=vertical?rect[0]:rect[1],high=low+(vertical?rect[2]:rect[3]);
  // A new bank merely coinciding with the old bank does not consume it.
  if(axis<=low||axis>=high)return 0;
  return Math.max(0,Math.min(vertical?shore.y2:shore.x2,vertical?rect[1]+rect[3]:rect[0]+rect[2])-Math.max(vertical?shore.y1:shore.x1,vertical?rect[1]:rect[0]));
}
/** Diagnostics describe the raw positive union; no ratio is an art pass. */
export function describeNativeSpatialLand(rects:readonly NativeSpatialLandRect[]) {
  const area=nativeRectUnionArea(rects),bounds=box(rects),shore=nativeSpatialExposedShore(rects),perimeter=shore.reduce((sum,s)=>sum+Math.hypot(s.x2-s.x1,s.y2-s.y1),0);
  return{areaPx2:area,bounds,boundingBoxFill:area/((bounds.maxX-bounds.minX)*(bounds.maxY-bounds.minY)),perimeterPx:perimeter,
    plates:rects.map((rect,index)=>({index,rect,uniqueAreaPx2:area-nativeRectUnionArea(rects.filter((_,i)=>i!==index)),exposedShorePx:shore.filter(s=>s.parent===index).reduce((sum,s)=>sum+Math.hypot(s.x2-s.x1,s.y2-s.y1),0)}))};
}
export function createNativeSpatialLand(input:NativeSpatialFrozenInput,random:NativeSpatialRandom,counts:Readonly<{holes:number;solids:number}>,native:MasterDefinition,bayAreaEstimatePx2=0):NativeSpatialLandPlan{
  const w=input.world,overlap=w.landRectMinOverlapPx,countOptions:{core:number;shoulder:number}[]=[];
  if(w.landShoulderAttachment!=='core-outward-normal-v1')throw new Error('Unsupported native shoulder attachment');
  for(let core=w.landCoreMinCount;core<=w.landCoreMaxCount;core++)for(let shoulder=w.landShoulderMinCount;shoulder<=w.landShoulderMaxCount;shoulder++)if(core+shoulder>=w.landRectMinCount&&core+shoulder<=w.landRectMaxCount)countOptions.push({core,shoulder});
  const selectedCounts=random.choose(countOptions),number=selectedCounts.core;
  const motherArea=input.assemblies.reduce((sum,a)=>sum+a.sourceInstanceIds.reduce((n,id)=>{const i=native.instances.find(item=>item.id===id)!;return n+i.length*i.width*a.sourceScale*a.sourceScale*.38;},0),0);
  const holeArea=counts.holes*input.holeProfiles.reduce((sum,h)=>sum+h.weight*h.maxAreaPx2*.75,0)/input.holeProfiles.reduce((sum,h)=>sum+h.weight,0);
  const target=w.targetWalkAreaPx2+motherArea+(counts.solids-input.assemblies.length)*16000+holeArea+120000+bayAreaEstimatePx2;
  const shoulderShapes=Array.from({length:selectedCounts.shoulder},()=>({span:random.integer(w.landShoulderMinSpanPx/8,w.landShoulderMaxSpanPx/8)*8,thickness:random.integer(w.landShoulderMinThicknessPx/8,w.landShoulderMaxThicknessPx/8)*8}));
  const expectedShoulderArea=shoulderShapes.reduce((sum,d)=>sum+d.thickness*(w.landShoulderMinExtensionPx+Math.min(w.landShoulderMaxExtensionPx,d.span-overlap))/2,0);
  const coreTarget=target-expectedShoulderArea;
  const ranks=Array.from({length:number},(_,i)=>i);for(let i=number-1;i>0;i--){const j=random.integer(0,i);[ranks[i],ranks[j]]=[ranks[j]!,ranks[i]!];}
  const dimensions=Array.from({length:number},(_,i)=>{
    const span=snap(w.landRectMinSpanPx+(w.landRectMaxSpanPx-w.landRectMinSpanPx)*(i+random.next())/number);
    const thickness=snap(w.landRectMinThicknessPx+(w.landRectMaxThicknessPx-w.landRectMinThicknessPx)*(ranks[i]!+random.next())/number);
    return{span,thickness};
  });
  // Begin with a wide body. Later plates retain independently sampled scales
  // and attach to actual exposed union banks, not a monotonic centre line.
  // Establish the large offsets first. A late large plate otherwise sweeps
  // across several already formed shoulders and turns the union into a slab.
  dimensions.sort((a,b)=>b.span*b.thickness-a.span*a.thickness);
  const first=dimensions.shift()!,rects:NativeSpatialLandRect[]=[[0,0,first.span,first.thickness]],plates:NativeSpatialLandPlate[]=[{role:'core',parentIndex:null}];
  for(let i=1;i<number;i++){
    const shape=dimensions.shift()!,shore=nativeSpatialExposedShore(rects),currentArea=nativeRectUnionArea(rects);
    const remainingArea=shape.span*shape.thickness+dimensions.reduce((sum,d)=>sum+d.span*d.thickness,0);
    const desired=(coreTarget-currentArea)*shape.span*shape.thickness/remainingArea,options:{rect:NativeSpatialLandRect;score:number;parentIndex:number}[]=[];
    for(let draw=0;draw<96;draw++){
      const edge=random.choose(shore),parent=rects[edge.parent]!,vertical=random.next()<.5,width=vertical?shape.thickness:shape.span,height=vertical?shape.span:shape.thickness;
      const normal=edge.direction<2?width:height,tangent=edge.direction<2?height:width;
      const parentNormal=edge.direction<2?parent[2]:parent[3];
      // The full rectangle is within the authored size range throughout. Area
      // is solved by overlap depth; no final rescale can violate those sizes.
      const extension=snap(Math.max(8,Math.min(normal-overlap,desired/tangent*random.range(.7,1.35))));
      const depth=normal-extension;if(depth>parentNormal)continue;
      let x:number,y:number;
      if(edge.direction<2){
        const minimum=parent[1]+overlap-height,maximum=parent[1]+parent[3]-overlap;
        if(maximum<minimum)continue;
        y=snap(Math.max(minimum,Math.min(maximum,(edge.y1+edge.y2)/2-height/2+random.range(-height*.32,height*.32))));
        x=edge.direction===0?edge.x1-extension:edge.x1-depth;
      }else{
        const minimum=parent[0]+overlap-width,maximum=parent[0]+parent[2]-overlap;
        if(maximum<minimum)continue;
        x=snap(Math.max(minimum,Math.min(maximum,(edge.x1+edge.x2)/2-width/2+random.range(-width*.32,width*.32))));
        y=edge.direction===2?edge.y1-extension:edge.y1-depth;
      }
      const rect:NativeSpatialLandRect=[snap(x),snap(y),width,height],next=[...rects,rect],bounds=box(next);
      if(bounds.maxX-bounds.minX>w.frameWidthPx-96||bounds.maxY-bounds.minY>w.frameHeightPx-96)continue;
      if(!rects.some(old=>Math.min(old[0]+old[2],rect[0]+rect[2])-Math.max(old[0],rect[0])>=overlap&&Math.min(old[1]+old[3],rect[1]+rect[3])-Math.max(old[1],rect[1])>=overlap))continue;
      const area=nativeRectUnionArea(next),added=area-currentArea;if(added<=0)continue;
      // A swallowed prior plate would manufacture complexity in the parameter
      // list only. Unique area remains diagnostic, not an invented percentage.
      if(next.some((_,index)=>area===nativeRectUnionArea(next.filter((__,j)=>j!==index))))continue;
      const visible=nativeSpatialExposedShore(next).some(s=>s.parent===i);if(!visible)continue;
      // Local attachment can replace its own bank. Covering another bank is a
      // separate cost: it removes a previously formed shoulder or recess. This
      // is proposal ranking, not a new acceptance threshold or frozen corner.
      const unrelated=shore.reduce((sum,s)=>sum+(s.parent===edge.parent&&s.direction===edge.direction?0:consumedShoreLength(s,rect)),0);
      const score=Math.abs(added-desired)/Math.max(1,desired)+unrelated/Math.max(1,tangent)+random.range(0,.08);
      options.push({rect,score,parentIndex:edge.parent});
    }
    options.sort((a,b)=>a.score-b.score||a.rect[1]-b.rect[1]||a.rect[0]-b.rect[0]);
    if(!options.length)throw new Error('Native broad-plate attachment has no framed visible supported candidate');
    rects.push(options[0]!.rect);plates.push({role:'core',parentIndex:options[0]!.parentIndex});
  }
  // Shoulders are a second scale, attached only after every core is fixed. The
  // long dimension follows the selected outward normal; it is not a random
  // width/height flip that can leave a 64px ear outside a 320px overlap.
  for(const [shoulderIndex,shape]of shoulderShapes.entries()){
    const rawShore=nativeSpatialExposedShore(rects).filter(s=>s.parent<number),shore:Shore[]=[];
    const groups=new Map<string,Shore[]>();for(const s of rawShore){const key=`${s.parent}:${s.direction}:${s.direction<2?s.x1:s.y1}`,list=groups.get(key)??[];list.push(s);groups.set(key,list);}
    for(const list of groups.values()){list.sort((a,b)=>a.direction<2?a.y1-b.y1:a.x1-b.x1);let current=list[0]!;for(const next of list.slice(1))if(current.x2===next.x1&&current.y2===next.y1)current={...current,x2:next.x2,y2:next.y2};else{shore.push(current);current=next;}shore.push(current);}
    const currentArea=nativeRectUnionArea(rects),desired=(target-currentArea)/(shoulderShapes.length-shoulderIndex),options:{rect:NativeSpatialLandRect;score:number;edge:Shore;extension:number}[]=[];
    for(let draw=0;draw<128;draw++){
      const edge=random.choose(shore),parent=rects[edge.parent]!,normalX=edge.direction<2,parentNormal=normalX?parent[2]:parent[3];
      const minExtension=Math.max(w.landShoulderMinExtensionPx,shape.span-parentNormal),maxExtension=Math.min(w.landShoulderMaxExtensionPx,shape.span-overlap);
      const minUnits=Math.ceil(minExtension/8),maxUnits=Math.floor(maxExtension/8);if(minUnits>maxUnits)continue;
      const extension=random.integer(minUnits,maxUnits)*8,depth=shape.span-extension;
      const edgeStart=normalX?edge.y1:edge.x1,edgeEnd=normalX?edge.y2:edge.x2;
      if(edgeEnd-edgeStart<overlap)continue;
      const minimum=Math.max((normalX?parent[1]:parent[0])+overlap-shape.thickness,edgeStart+overlap-shape.thickness),maximum=Math.min((normalX?parent[1]+parent[3]:parent[0]+parent[2])-overlap,edgeEnd-overlap);
      if(Math.ceil(minimum/8)>Math.floor(maximum/8))continue;
      const tangent=random.integer(Math.ceil(minimum/8),Math.floor(maximum/8))*8;
      const rect:NativeSpatialLandRect=normalX?[edge.direction===0?edge.x1-extension:edge.x1-depth,tangent,shape.span,shape.thickness]:[tangent,edge.direction===2?edge.y1-extension:edge.y1-depth,shape.thickness,shape.span];
      const next=[...rects,rect],bounds=box(next);if(bounds.maxX-bounds.minX>w.frameWidthPx-96||bounds.maxY-bounds.minY>w.frameHeightPx-96)continue;
      const overlapX=Math.min(parent[0]+parent[2],rect[0]+rect[2])-Math.max(parent[0],rect[0]),overlapY=Math.min(parent[1]+parent[3],rect[1]+rect[3])-Math.max(parent[1],rect[1]);
      if(overlapX<overlap||overlapY<overlap)continue;
      const area=nativeRectUnionArea(next),added=area-currentArea;if(added<=0||next.some((_,index)=>area===nativeRectUnionArea(next.filter((__,j)=>j!==index))))continue;
      const lost=rawShore.reduce((sum,s)=>sum+(s.parent===edge.parent&&s.direction===edge.direction?0:consumedShoreLength(s,rect)),0);
      options.push({rect,edge,extension,score:Math.abs(added-desired)/Math.max(1,Math.abs(desired))+lost/shape.thickness+random.range(0,.08)});
    }
    options.sort((a,b)=>a.score-b.score||a.edge.parent-b.edge.parent||a.rect[1]-b.rect[1]||a.rect[0]-b.rect[0]);
    const selected=options[0];if(!selected)throw new Error('Native shoulder has no core-facing size/extension/overlap intersection');
    rects.push(selected.rect);plates.push({role:'shoulder',parentIndex:selected.edge.parent,sourceShore:selected.edge,extensionPx:selected.extension});
  }
  const bounds=box(rects),offsetX=snap((w.frameWidthPx-(bounds.maxX-bounds.minX))/2-bounds.minX),offsetY=snap((w.frameHeightPx-(bounds.maxY-bounds.minY))/2-bounds.minY);
  return{rects:rects.map(([x,y,width,height])=>[x+offsetX,y+offsetY,width,height]),plates:plates.map(p=>p.sourceShore?{...p,sourceShore:{...p.sourceShore,x1:p.sourceShore.x1+offsetX,x2:p.sourceShore.x2+offsetX,y1:p.sourceShore.y1+offsetY,y2:p.sourceShore.y2+offsetY}}:p)};
}
