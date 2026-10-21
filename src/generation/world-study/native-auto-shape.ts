/** Compile independent material boundaries once. Planning and final terrain use
 * these identical contours; moving an object only translates its frozen shape. */
import {compileR100FragmentShape} from './r100-fragment-shape';
import {nativeVoidCellBoundary,nativePrimitiveTree,nativePrimitiveDistance,NATIVE_SPATIAL_DIRECTIONS} from './native-spatial-geometry';
import {NativeBodyCollision} from './native-body-collision';
import {TileType} from '@/types/game-types';
import type {NativeAutoRect as Rect} from './native-auto-types';
export interface NativeAutoPoint {readonly x:number;readonly y:number}
type Point=NativeAutoPoint;
export interface NativeAutoGroundField {
  margin(point:Point):number;
  supportsBody(point:Point):boolean;
  links(point:Point):number;
  containsRect(rect:Rect,gap:number):boolean;
}
function contains(polygon:readonly Point[],x:number,y:number):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i]!,b=polygon[j]!;
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
export function nativeAutoPolygonRects(polygon:readonly Point[]):Rect[]{
  const minX=Math.floor(Math.min(...polygon.map(p=>p.x))/8),maxX=Math.ceil(Math.max(...polygon.map(p=>p.x))/8);
  const minY=Math.floor(Math.min(...polygon.map(p=>p.y))/8),maxY=Math.ceil(Math.max(...polygon.map(p=>p.y))/8),rects:Rect[]=[];
  for(let y=minY;y<maxY;y++){let start:number|undefined;
    for(let x=minX;x<=maxX;x++){
      const occupied=x<maxX&&contains(polygon,x*8+4,y*8+4);
      if(occupied&&start===undefined)start=x;
      if(!occupied&&start!==undefined){rects.push([start*8,y*8,(x-start)*8,8]);start=undefined;}
    }
  }return rects;
}
export function nativeAutoCompileHole(rects:readonly Rect[],seed:number,sourceHash:string):readonly Point[]{
  const compiled=compileR100FragmentShape({algorithmVersion:'rectilinear-fragment-v1',layoutId:'automatic-native-hole',
    sourceHash,seedMode:'run-seed',seedSalt:0,edgeSeed:seed,layout:{worldScale:2,authoringFrame:[512,512],
      landRects:[[0,0,512,512]],voidRects:rects.map(([x,y,w,h])=>[(x+512)/2,(y+512)/2,w/2,h/2])}},seed);
  if(compiled.erosion.length!==1)throw new Error('Automatic hole must retain one contour');
  return compiled.erosion[0]!.map(point=>({x:point.x-512,y:point.y-512}));
}
export function nativeAutoCompiledField(land:readonly Rect[],holes:readonly (readonly Rect[])[],cuts:readonly Rect[],
  sites:readonly Point[],frame:readonly [number,number],seed:number,sourceHash:string){
  const compiled=compileR100FragmentShape({algorithmVersion:'rectilinear-fragment-v1',layoutId:'automatic-native-layout',
    sourceHash,seedMode:'run-seed',seedSalt:0,edgeSeed:seed,layout:{worldScale:2,authoringFrame:[frame[0]/2,frame[1]/2],
      landRects:land.map(r=>r.map(v=>v/2)),voidRects:[...holes.flat(),...cuts].map(r=>r.map(v=>v/2))}},seed);
  const cols=frame[0]/8,rows=frame[1]/8,matter=new Uint8Array(cols*rows),cells:number[]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(contains(compiled.terrainOutline,x*8+4,y*8+4)){
    matter[y*cols+x]=1;cells.push(y*cols+x);
  }
  const boundary=nativePrimitiveTree(nativeVoidCellBoundary(cells,cols,rows,-1));
  const prefix=new Uint32Array((cols+1)*(rows+1));
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)prefix[(y+1)*(cols+1)+x+1]=Number(!matter[y*cols+x])+prefix[y*(cols+1)+x+1]!+prefix[(y+1)*(cols+1)+x]!-prefix[y*(cols+1)+x]!;
  const present=(x:number,y:number)=>x>=0&&y>=0&&x<cols&&y<rows&&matter[y*cols+x]===1;
  const collision=new NativeBodyCollision({definition:{instances:[]},meshes:[]},{cols,rows,tileSize:8,
    tiles:Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>present(x,y)?TileType.FLOOR:TileType.VOID))});
  const ground:NativeAutoGroundField={
    margin:p=>present(Math.floor(p.x/8),Math.floor(p.y/8))?nativePrimitiveDistance(boundary,p.x,p.y):-1,
    supportsBody:p=>collision.supports(p,10,10),
    links:p=>{let links=0;for(let direction=0;direction<8;direction++){
      const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[direction]!;
      if(collision.displacementFraction(p,10,10,dx*8,dy*8)>=1-1e-9)links|=1<<direction;
    }return links;},
    containsRect:([x,y,w,h],gap)=>{
      const left=Math.floor((x-gap)/8),top=Math.floor((y-gap)/8),right=Math.ceil((x+w+gap)/8),bottom=Math.ceil((y+h+gap)/8);
      return left>=0&&top>=0&&right<=cols&&bottom<=rows&&prefix[bottom*(cols+1)+right]!-prefix[top*(cols+1)+right]!-prefix[bottom*(cols+1)+left]!+prefix[top*(cols+1)+left]! === 0;
    },
  };
  const holePolygons=holes.map((_,index)=>{
    const site=sites[index]!,polygon=compiled.erosion.find(loop=>contains(loop,site.x,site.y));
    if(!polygon)throw new Error('Automatic phase lost an internal hole identity');
    return polygon.map(point=>({x:point.x-site.x,y:point.y-site.y}));
  });
  return{ground,holeRects:holePolygons.map(nativeAutoPolygonRects),terrainOutline:compiled.terrainOutline,holePolygons};
}
