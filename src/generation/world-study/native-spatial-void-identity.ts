/** Shared final 8px VOID identities, including strips too thin for a 20px body. */
import {NATIVE_SPATIAL_CELL,NATIVE_SPATIAL_DIRECTIONS} from './native-spatial-geometry';
import type {Vector2} from '@/types/game-types';
import type {NativeSpatialHolePlacement} from './native-spatial-structures';

export interface NativeSpatialVoidIdentity {
  readonly cols:number;readonly rows:number;readonly labels:Int32Array;
  readonly cellsByLabel:ReadonlyMap<number,readonly number[]>;
  readonly componentCountByLabel:ReadonlyMap<number,number>;
  readonly exteriorLabels:ReadonlySet<number>;
}
export interface NativeSpatialVoidLabelStats {readonly area:number;readonly minX:number;readonly minY:number;readonly maxX:number;readonly maxY:number;readonly exterior:boolean}
export interface NativeSpatialHoleIdentity {
  readonly holeId:string;readonly finalLabel:number|null;readonly stat:NativeSpatialVoidLabelStats|undefined;
  readonly contourIndices:readonly number[];readonly valid:boolean;readonly duplicate:boolean;
}
export interface NativeSpatialHoleIdentities {
  readonly records:readonly NativeSpatialHoleIdentity[];readonly orphanLabels:readonly number[];readonly orphanContours:readonly number[];
}

export function identifyNativeSpatialVoid(matter:Uint8Array,cols:number,rows:number):NativeSpatialVoidIdentity {
  if(!Number.isSafeInteger(cols)||!Number.isSafeInteger(rows)||cols<=0||rows<=0||matter.length!==cols*rows)throw new Error('Invalid native VOID raster dimensions');
  const count=cols*rows,components:number[][]=[],labels=new Int32Array(count).fill(-1);
  for(let start=0;start<count;start++)if(!matter[start]&&labels[start]===-1){
    const label=components.length,cells=[start];labels[start]=label;
    for(let at=0;at<cells.length;at++){
      const cell=cells[at]!,x=cell%cols,y=Math.floor(cell/cols);
      for(let d=0;d<4;d++){
        const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[d]!,nx=x+dx,ny=y+dy,next=ny*cols+nx;
        if(nx<0||ny<0||nx>=cols||ny>=rows||matter[next]||labels[next]!==-1)continue;
        labels[next]=label;cells.push(next);
      }
    }components.push(cells);
  }
  const parent=components.map((_,i)=>i);
  const root=(index:number):number=>{while(parent[index]!==index){parent[index]=parent[parent[index]!]!;index=parent[index]!;}return index;};
  for(let cell=0;cell<count;cell++)if(labels[cell]!>=0){
    const x=cell%cols,y=Math.floor(cell/cols),label=labels[cell]!;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
      const other=labels[ny*cols+nx]!;
      if(other>=0&&other!==label&&Math.max(Math.max(0,Math.abs(dx)*8-8),Math.max(0,Math.abs(dy)*8-8))<20){
        const a=root(label),b=root(other);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);
      }
    }
  }
  const cellsByLabel=new Map<number,number[]>(),componentCountByLabel=new Map<number,number>(),exteriorLabels=new Set<number>();
  components.forEach((cells,index)=>{
    const id=root(index),group=cellsByLabel.get(id)??[];group.push(...cells);cellsByLabel.set(id,group);
    componentCountByLabel.set(id,(componentCountByLabel.get(id)??0)+1);
    if(cells.some(cell=>cell%cols===0||cell%cols===cols-1||cell<cols||cell>=count-cols))exteriorLabels.add(id);
    cells.forEach(cell=>{labels[cell]=id;});
  });
  return{cols,rows,labels,cellsByLabel,componentCountByLabel,exteriorLabels};
}

/** Matches the centre-sample polygon convention used by native terrain. */
export function nativeSpatialPolygonContains(points:readonly Readonly<Vector2>[],x:number,y:number):boolean {
  let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i]!,b=points[j]!;if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}

/** The same authoring-to-final-VOID association for planning and final gates. */
export function identifyNativeSpatialHoles(cols:number,rows:number,labels:Int32Array,erosion:readonly (readonly Readonly<Vector2>[])[],placements:readonly NativeSpatialHolePlacement[]):NativeSpatialHoleIdentities {
  const labelStats=new Map<number,{area:number;minX:number;minY:number;maxX:number;maxY:number;exterior:boolean}>();
  for(let cell=0;cell<labels.length;cell++)if(labels[cell]!>=0){
    const label=labels[cell]!,x=cell%cols,y=Math.floor(cell/cols),stat=labelStats.get(label)??{area:0,minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity,exterior:false};
    stat.area+=64;stat.minX=Math.min(stat.minX,x*8);stat.minY=Math.min(stat.minY,y*8);stat.maxX=Math.max(stat.maxX,(x+1)*8);stat.maxY=Math.max(stat.maxY,(y+1)*8);
    stat.exterior ||= x===0||y===0||x===cols-1||y===rows-1;labelStats.set(label,stat);
  }
  const initial=placements.map(placement=>{
    const found=new Set<number>();
    for(const [x,y,w,h]of placement.rects)for(let row=Math.max(0,Math.floor(y/8));row<Math.min(rows,Math.ceil((y+h)/8));row++)for(let col=Math.max(0,Math.floor(x/8));col<Math.min(cols,Math.ceil((x+w)/8));col++){
      const px=col*8+4,py=row*8+4,label=labels[row*cols+col]!;if(px>=x&&px<=x+w&&py>=y&&py<=y+h&&label>=0)found.add(label);
    }
    const contourIndices=erosion.flatMap((loop,index)=>placement.rects.some(([x,y,w,h])=>nativeSpatialPolygonContains(loop,x+w/2,y+h/2))?[index]:[]);
    const finalLabel=found.size===1?[...found][0]!:null,stat=finalLabel===null?undefined:labelStats.get(finalLabel);
    return{holeId:placement.holeId,finalLabel,stat,contourIndices,valid:!!placement.rects.length&&found.size===1&&!!stat&&!stat.exterior&&contourIndices.length===1};
  });
  const records=initial.map(row=>({...row,duplicate:initial.some(other=>other!==row&&(other.holeId===row.holeId||row.finalLabel!==null&&other.finalLabel===row.finalLabel||row.contourIndices.some(index=>other.contourIndices.includes(index))))}));
  const assignedLabels=new Set(records.map(row=>row.finalLabel)),assignedContours=new Set(records.flatMap(row=>row.contourIndices));
  return{records,orphanLabels:[...labelStats].filter(([label,stat])=>!stat.exterior&&!assignedLabels.has(label)).map(([label])=>label),orphanContours:erosion.flatMap((_,index)=>assignedContours.has(index)?[]:[index])};
}

export function rasterNativeSpatialFragment(width:number,height:number,outline:readonly Readonly<Vector2>[],erosion:readonly (readonly Readonly<Vector2>[])[]):{matter:Uint8Array;cols:number;rows:number} {
  const cols=width/NATIVE_SPATIAL_CELL,rows=height/NATIVE_SPATIAL_CELL;
  if(!Number.isSafeInteger(cols)||!Number.isSafeInteger(rows)||cols<=0||rows<=0)throw new Error('Invalid native fragment raster dimensions');
  const matter=new Uint8Array(cols*rows);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=(col+.5)*NATIVE_SPATIAL_CELL,y=(row+.5)*NATIVE_SPATIAL_CELL;
    matter[row*cols+col]=Number(nativeSpatialPolygonContains(outline,x,y)&&!erosion.some(loop=>nativeSpatialPolygonContains(loop,x,y)));
  }return{matter,cols,rows};
}
