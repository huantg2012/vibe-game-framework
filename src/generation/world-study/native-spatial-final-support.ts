/** Final authored mesh support. Dedicated generated ground-edge geometry is excluded. */
import {nativeSolidPrimitives,type NativeSpatialGeometry,type NativeSpatialPrimitive} from './native-spatial-geometry';
import type {NativeSpatialGateResult} from './native-spatial-types';

/** Strict separating axes reject zero-area edge/corner contact. Checking the
 * full projected triangle also catches a void through its interior when all
 * three vertices remain on land. */
function overlapsCell(p:NativeSpatialPrimitive,col:number,row:number):boolean {
  const x=col*8+4,y=row*8+4,epsilon=1e-7;
  if(p.maxX<=x-4+epsilon||p.minX>=x+4-epsilon||p.maxY<=y-4+epsilon||p.minY>=y+4-epsilon)return false;
  const v=p.points;
  for(let i=0;i<6;i+=2){
    const j=(i+2)%6,nx=v[j+1]!-v[i+1]!,ny=v[i]!-v[j]!,a=v[0]!*nx+v[1]!*ny,b=v[2]!*nx+v[3]!*ny,c=v[4]!*nx+v[5]!*ny;
    const center=x*nx+y*ny,radius=4*(Math.abs(nx)+Math.abs(ny));
    if(Math.max(a,b,c)<=center-radius+epsilon||Math.min(a,b,c)>=center+radius-epsilon)return false;
  }
  return true;
}
export function evaluateNativeSpatialFinalSupport(geometry:NativeSpatialGeometry):NativeSpatialGateResult {
  const {terrain}=geometry,{cols,rows,matter}=terrain,failed=new Set<number>();
  const unsupportedSources:{instanceId:number;role:string;reason:string;point:{x:number;y:number}}[]=[];
  let checkedTriangles=0,voidCellTests=0;
  for(const triangle of nativeSolidPrimitives(terrain,true)){
    if(failed.has(triangle.objectId))continue;
    checkedTriangles++;
    let failure:{reason:string;point:{x:number;y:number}}|undefined;
    if(triangle.minX<0||triangle.minY<0||triangle.maxX>cols*8||triangle.maxY>rows*8){
      const at=[0,2,4].find(i=>triangle.points[i]!<0||triangle.points[i]!>cols*8||triangle.points[i+1]!<0||triangle.points[i+1]!>rows*8)!;
      failure={reason:'source-footprint-outside-frame',point:{x:triangle.points[at]!,y:triangle.points[at+1]!}};
    }else for(let row=Math.max(0,Math.floor(triangle.minY/8));row<Math.min(rows,Math.ceil(triangle.maxY/8))&&!failure;row++){
      for(let col=Math.max(0,Math.floor(triangle.minX/8));col<Math.min(cols,Math.ceil(triangle.maxX/8));col++)if(!matter[row*cols+col]){
        voidCellTests++;if(overlapsCell(triangle,col,row)){failure={reason:'source-footprint-over-final-void',point:{x:col*8+4,y:row*8+4}};break;}
      }
    }
    if(failure){failed.add(triangle.objectId);unsupportedSources.push({instanceId:triangle.objectId,role:terrain.roles.get(triangle.objectId)??'unknown',...failure});}
  }
  return{accepted:!unsupportedSources.length,reasons:unsupportedSources.length?['final-source-footprint-unsupported']:[],metrics:{finalSourceSupportViolationCount:unsupportedSources.length,unsupportedSources,finalSourceSupportCheckedTriangles:checkedTriangles,finalSourceSupportVoidCellTests:voidCellTests}};
}
