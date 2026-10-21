/** Exact translated obstacle masks and a reusable spawn-connected body graph.
 * Every edge is a swept square measured by the live collision implementation. */
import {createNativeBodyPrimitiveProbe} from './native-body-collision';
import {NATIVE_SPATIAL_DIRECTIONS,nativePrimitiveDistance,type NativeSpatialPrimitive,type NativeSpatialBvh} from './native-spatial-geometry';
import type {NativeAutoGroundField} from './native-auto-shape';
interface Point {readonly x:number;readonly y:number}
export interface NativeAutoTraversalTemplate {
  supported(x:number,y:number):boolean;
  links(x:number,y:number):number;
}
export function createNativeAutoTraversalTemplate(primitives:readonly NativeSpatialPrimitive[]):NativeAutoTraversalTemplate {
  const probe=createNativeBodyPrimitiveProbe(primitives.map(p=>{
    const points:Point[]=[];for(let i=0;i<p.points.length;i+=2)points.push({x:p.points[i]!,y:p.points[i+1]!});return points;
  }));
  const left=Math.floor((Math.min(...primitives.map(p=>p.minX))-24)/8),top=Math.floor((Math.min(...primitives.map(p=>p.minY))-24)/8);
  const right=Math.ceil((Math.max(...primitives.map(p=>p.maxX))+24)/8),bottom=Math.ceil((Math.max(...primitives.map(p=>p.maxY))+24)/8);
  const cols=right-left+1,rows=bottom-top+1,supported=new Uint8Array(cols*rows),edges=new Uint8Array(cols*rows);
  for(let gy=top;gy<=bottom;gy++)for(let gx=left;gx<=right;gx++){
    const point={x:gx*8+4,y:gy*8+4},cell=(gy-top)*cols+gx-left;
    if(!probe.supports(point))continue;supported[cell]=1;
    for(let direction=0;direction<8;direction++){
      const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[direction]!;
      if(probe.displacementFraction(point,dx*8,dy*8)>=1-1e-9)edges[cell]=edges[cell]!|(1<<direction);
    }
  }
  const index=(x:number,y:number)=>{const gx=Math.round((x-4)/8)-left,gy=Math.round((y-4)/8)-top;return gx<0||gy<0||gx>=cols||gy>=rows?-1:gy*cols+gx;};
  return{supported:(x,y)=>{const cell=index(x,y);return cell<0||supported[cell]===1;},links:(x,y)=>{const cell=index(x,y);return cell<0?255:edges[cell]!;}};
}
export function createNativeAutoConnectivity(points:readonly {readonly gx:number;readonly gy:number}[],spawn:Point,spacing=8){
  const cols=Math.max(...points.map(p=>p.gx))+1,rows=Math.max(...points.map(p=>p.gy))+1,lookup=new Int32Array(cols*rows).fill(-1);
  points.forEach((point,index)=>{lookup[point.gy*cols+point.gx]=index;});
  const start=lookup[Math.floor(spawn.y/spacing)*cols+Math.floor(spawn.x/spacing)]??-1;
  const neighbors=new Int32Array(points.length*8).fill(-1);
  points.forEach((point,index)=>NATIVE_SPATIAL_DIRECTIONS.forEach(([dx,dy],direction)=>{
    const x=point.gx+dx,y=point.gy+dy;if(x>=0&&y>=0&&x<cols&&y<rows)neighbors[index*8+direction]=lookup[y*cols+x]!;
  }));
  const seen=new Uint32Array(points.length),queue=new Int32Array(points.length);let epoch=0;
  return (available:Uint8Array,links:Uint8Array):boolean=>{
    if(start<0||!available[start])return false;
    epoch++;if(epoch===0xffffffff){seen.fill(0);epoch=1;}
    let count=0;for(const value of available)count+=Number(value!==0);
    let head=0,tail=1;queue[0]=start;seen[start]=epoch;
    while(head<tail){const cell=queue[head++]!;
      for(let direction=0;direction<8;direction++)if(links[cell]!&(1<<direction)){
        const next=neighbors[cell*8+direction]!;if(next>=0&&available[next]&&seen[next]!==epoch){seen[next]=epoch;queue[tail++]=next;}
      }
    }
    return tail===count;
  };
}

export interface NativeAutoBodyPoint extends Point {readonly gx:number;readonly gy:number;readonly margin:number;readonly source:number}
export interface NativeAutoBodyField {
  readonly points:readonly NativeAutoBodyPoint[];
  readonly baseLinks:Uint8Array;
  readonly connected:(available:Uint8Array,links:Uint8Array)=>boolean;
}
export function createNativeAutoBodyField(ground:NativeAutoGroundField,source:NativeSpatialBvh,
  sourcePrimitives:readonly NativeSpatialPrimitive[],frame:readonly[number,number],spawn:Point):NativeAutoBodyField {
  const template=createNativeAutoTraversalTemplate(sourcePrimitives),points:NativeAutoBodyPoint[]=[],links:number[]=[];
  for(let gy=0;gy*8+4<frame[1];gy++)for(let gx=0;gx*8+4<frame[0];gx++){
    const point={x:gx*8+4,y:gy*8+4};
    if(!ground.supportsBody(point)||!template.supported(point.x,point.y))continue;
    points.push({...point,gx,gy,margin:ground.margin(point),source:nativePrimitiveDistance(source,point.x,point.y)});
    links.push(ground.links(point)&template.links(point.x,point.y));
  }
  const baseLinks=Uint8Array.from(links),connected=createNativeAutoConnectivity(points,spawn);
  if(!connected(new Uint8Array(points.length).fill(1),baseLinks))throw new Error('Automatic initial source and shore have disconnected body domain');
  return{points,baseLinks,connected};
}
