/** Revision-14 area qualification. Dense tessellation must not turn a real
 * solid into zero area merely because no 2px square fits in one triangle. */
import {nativeCellPoint,nativePrimitiveTree,type NativeSpatialBvh,type NativeSpatialPrimitive} from './native-spatial-geometry';
import type {NativeSpatialGroupResult,NativeSpatialStructure} from './native-spatial-structures';

export interface NativeAutoSolidAreaBudget {readonly maxCells:number;readonly maxPrimitiveTests:number}
export interface NativeAutoSolidAreaCertificate {
  readonly accepted:boolean;
  readonly status:'certified'|'unresolved';
  readonly reason:'target-proved'|'resolution-limit'|'cell-budget'|'primitive-budget';
  readonly targetAreaPx2:number;
  readonly areaLowerPx2:number;
  readonly work:Readonly<{visitedCells:number;primitiveTests:number;creditedCells:number;minCellSizePx:number;maxCells:number;maxPrimitiveTests:number}>;
}
const ROOT_HALF=4,MIN_HALF=.125;
const DEFAULT_BUDGET:NativeAutoSolidAreaBudget={maxCells:262144,maxPrimitiveTests:8388608};
interface Cell {readonly x:number;readonly y:number;readonly half:number;readonly triangles:readonly NativeSpatialPrimitive[]}

function overlaps(x:number,y:number,half:number,p:NativeSpatialBvh|NativeSpatialPrimitive):boolean {
  return p.minX<x+half&&p.maxX>x-half&&p.minY<y+half&&p.maxY>y-half;
}
/** Only strictly interior corners count. The allowance excludes uncertain
 * floating-point signs; unlike an outward epsilon it cannot enlarge a face. */
function containsSquare(x:number,y:number,half:number,triangle:NativeSpatialPrimitive):boolean {
  const p=triangle.points;
  if(p.length!==6||x-half<triangle.minX||x+half>triangle.maxX||y-half<triangle.minY||y+half>triangle.maxY)return false;
  for(const dx of [-half,half])for(const dy of [-half,half]){
    const px=x+dx,py=y+dy;let positive=true,negative=true;
    for(let i=0;i<6;i+=2){
      const j=(i+2)%6,ax=p[i]!,ay=p[i+1]!,bx=p[j]!,by=p[j+1]!;
      const cross=(bx-ax)*(py-ay)-(by-ay)*(px-ax);
      const error=8*Number.EPSILON*((Math.abs(bx)+Math.abs(ax))*(Math.abs(py)+Math.abs(ay))+
        (Math.abs(by)+Math.abs(ay))*(Math.abs(px)+Math.abs(ax))+1);
      positive&&=cross>error;negative&&=cross<-error;
    }
    if(!positive&&!negative)return false;
  }
  return true;
}

/** Disjoint dyadic cells partition the projected triangle union's domain.
 * A leaf contributes only if a single real triangle contains its whole square.
 * Overlapping faces therefore never add duplicate area. Uncertain leaves at
 * 0.25px contribute zero; reaching either finite work budget rejects. */
export function certifyNativeAutoSolidArea(primitives:readonly NativeSpatialPrimitive[],targetAreaPx2:number,
  checkpoint:()=>void=()=>{},budget:NativeAutoSolidAreaBudget=DEFAULT_BUDGET,
  domain?:Readonly<{cells:readonly number[];cols:number}>):NativeAutoSolidAreaCertificate {
  if(!Number.isFinite(targetAreaPx2)||targetAreaPx2<=0
    ||!Number.isInteger(budget.maxCells)||budget.maxCells<1||budget.maxCells>DEFAULT_BUDGET.maxCells
    ||!Number.isInteger(budget.maxPrimitiveTests)||budget.maxPrimitiveTests<1||budget.maxPrimitiveTests>DEFAULT_BUDGET.maxPrimitiveTests)
    throw new Error('Invalid automatic solid-area certificate bounds');
  const tree=nativePrimitiveTree(primitives),stack:Cell[]=[];
  let visitedCells=0,primitiveTests=0,creditedCells=0,areaLowerPx2=0;
  const finish=(reason:NativeAutoSolidAreaCertificate['reason']):NativeAutoSolidAreaCertificate=>({
    accepted:reason==='target-proved',status:reason==='target-proved'?'certified':'unresolved',reason,targetAreaPx2,areaLowerPx2,
    work:{visitedCells,primitiveTests,creditedCells,minCellSizePx:MIN_HALF*2,...budget}});
  function* roots():Generator<{x:number;y:number}> {
    // The formal gate clips projected area to these exact in-map root cells.
    if(domain){for(const cell of new Set(domain.cells))yield nativeCellPoint(cell,domain.cols);}
    else for(let y=Math.floor(tree.minY/8)*8+4;y<Math.ceil(tree.maxY/8)*8;y+=8)
      for(let x=Math.floor(tree.minX/8)*8+4;x<Math.ceil(tree.maxX/8)*8;x+=8)yield{x,y};
  }
  const pendingRoots=roots();
  let exhausted=false;
  while(!exhausted||stack.length){
    if(visitedCells>=budget.maxCells)return finish('cell-budget');
    if(visitedCells%256===0)checkpoint();
    if(!stack.length){
      const root=pendingRoots.next();if(root.done){exhausted=true;continue;}
      const triangles:NativeSpatialPrimitive[]=[],nodes=[tree];
      while(nodes.length){
        const node=nodes.pop()!;if(!overlaps(root.value.x,root.value.y,ROOT_HALF,node))continue;
        if(node.items)for(const triangle of node.items){
          if(primitiveTests>=budget.maxPrimitiveTests)return finish('primitive-budget');
          primitiveTests++;
          if(overlaps(root.value.x,root.value.y,ROOT_HALF,triangle))triangles.push(triangle);
        }else{nodes.push(node.left!,node.right!);}
      }
      stack.push({...root.value,half:ROOT_HALF,triangles});
    }
    const cell=stack.pop()!;visitedCells++;
    let covered=false;
    for(const triangle of cell.triangles){
      if(primitiveTests>=budget.maxPrimitiveTests)return finish('primitive-budget');
      primitiveTests++;
      if(containsSquare(cell.x,cell.y,cell.half,triangle)){covered=true;break;}
    }
    if(covered){
      areaLowerPx2+=4*cell.half**2;creditedCells++;
      if(areaLowerPx2>=targetAreaPx2)return finish('target-proved');
    }else if(cell.half>MIN_HALF){
      const half=cell.half/2;
      for(const dy of [-half,half])for(const dx of [-half,half]){
        const x=cell.x+dx,y=cell.y+dy,triangles:NativeSpatialPrimitive[]=[];
        for(const triangle of cell.triangles){
          if(primitiveTests>=budget.maxPrimitiveTests)return finish('primitive-budget');
          primitiveTests++;
          if(overlaps(x,y,half,triangle))triangles.push(triangle);
        }
        if(triangles.length)stack.push({x,y,half,triangles});
      }
    }
  }
  return finish('resolution-limit');
}

/** Call with legacy identities measured at an internal zero area cutoff.
 * Every solid is then required to meet the unchanged real cutoff, either by
 * the existing bound or this stricter refinement. All other gates stay intact. */
export function qualifyNativeAutoSolidAreas(groups:NativeSpatialGroupResult,cols:number,minAreaPx2:number,checkpoint:()=>void):{
  groups:NativeSpatialGroupResult;
  areaCertificate:readonly Readonly<{structureId:string;coarseAreaLowerPx2:number;certificate:NativeAutoSolidAreaCertificate}>[];
} {
  const structures:NativeSpatialStructure[]=[],rejected=[...groups.rejected];
  const areaCertificate:{structureId:string;coarseAreaLowerPx2:number;certificate:NativeAutoSolidAreaCertificate}[]=[];
  for(const structure of groups.structures){
    if(structure.kind!=='solid'||structure.areaLowerPx2>=minAreaPx2){structures.push(structure);continue;}
    const certificate=certifyNativeAutoSolidArea(structure.boundary,minAreaPx2,checkpoint,DEFAULT_BUDGET,{cells:structure.cells,cols});
    areaCertificate.push({structureId:structure.id,coarseAreaLowerPx2:structure.areaLowerPx2,certificate});
    if(certificate.accepted)structures.push({...structure,areaLowerPx2:certificate.areaLowerPx2});
    else rejected.push({id:structure.id,reasons:['solid-effective-area-too-small']});
  }
  return{groups:{...groups,structures,rejected},areaCertificate};
}
