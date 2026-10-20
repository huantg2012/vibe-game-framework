/** A phase-local projection of the shared edge compiler. Translating these
 * shapes remains a prediction; final admission always compiles the whole plan. */
import {compileR100FragmentShape} from './r100-fragment-shape';
import {nativeVoidCellBoundary,nativePrimitiveTree,nativePrimitiveDistance} from './native-spatial-geometry';
import type {NativeAutoRect as Rect} from './native-auto-types';
interface Point {readonly x:number;readonly y:number}
export interface NativeAutoGroundField {
  margin(point:Point):number;
  supportsBody(point:Point):boolean;
}
function contains(polygon:readonly Point[],x:number,y:number):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i]!,b=polygon[j]!;
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function nativeAutoCompiledField(land:readonly Rect[],holes:readonly (readonly Rect[])[],cuts:readonly Rect[],
  sites:readonly Point[],frame:readonly [number,number],seed:number,sourceHash:string):Readonly<{ground:NativeAutoGroundField;holeRects:readonly (readonly Rect[])[]}> {
  const compiled=compileR100FragmentShape({algorithmVersion:'rectilinear-fragment-v1',layoutId:'automatic-native-layout',
    sourceHash,seedMode:'run-seed',seedSalt:0,edgeSeed:seed,layout:{worldScale:2,authoringFrame:[frame[0]/2,frame[1]/2],
      landRects:land.map(r=>r.map(v=>v/2)),voidRects:[...holes.flat(),...cuts].map(r=>r.map(v=>v/2))}},seed);
  const cols=frame[0]/8,rows=frame[1]/8,matter=new Uint8Array(cols*rows),cells:number[]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(contains(compiled.terrainOutline,x*8+4,y*8+4)){
    matter[y*cols+x]=1;cells.push(y*cols+x);
  }
  const boundary=nativePrimitiveTree(nativeVoidCellBoundary(cells,cols,rows,-1));
  const present=(x:number,y:number)=>x>=0&&y>=0&&x<cols&&y<rows&&matter[y*cols+x]===1;
  const ground:NativeAutoGroundField={
    margin:p=>present(Math.floor(p.x/8),Math.floor(p.y/8))?nativePrimitiveDistance(boundary,p.x,p.y):-1,
    supportsBody:p=>{
      for(let y=Math.floor((p.y-10)/8);y<Math.ceil((p.y+10)/8);y++)
        for(let x=Math.floor((p.x-10)/8);x<Math.ceil((p.x+10)/8);x++)if(!present(x,y))return false;
      return true;
    }};
  const holeRects=holes.map((_,index):Rect[]=>{
    const site=sites[index]!,polygon=compiled.erosion.find(loop=>contains(loop,site.x,site.y));
    if(!polygon)throw new Error('Automatic phase lost an internal hole identity');
    const minX=Math.floor(Math.min(...polygon.map(p=>p.x))/8),maxX=Math.ceil(Math.max(...polygon.map(p=>p.x))/8);
    const minY=Math.floor(Math.min(...polygon.map(p=>p.y))/8),maxY=Math.ceil(Math.max(...polygon.map(p=>p.y))/8),rects:Rect[]=[];
    for(let y=minY;y<maxY;y++){
      let start=-1;
      for(let x=minX;x<=maxX;x++){
        const occupied=x<maxX&&contains(polygon,x*8+4,y*8+4);
        if(occupied&&start<0)start=x;
        if(!occupied&&start>=0){rects.push([start*8-site.x,y*8-site.y,(x-start)*8,8]);start=-1;}
      }
    }
    return rects;
  });
  return{ground,holeRects};
}
