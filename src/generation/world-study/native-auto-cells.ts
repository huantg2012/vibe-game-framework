/** The density formula is the area of a triangular lattice cell. Preserve
 * that construction when assigning real footprints, rather than packing a
 * quota with unrelated farthest-point choices. */
import type {NativeAutoBodyPoint} from './native-auto-traversal';
export interface NativeAutoCoverageCell {
  readonly column:number;readonly row:number;readonly x:number;readonly y:number;
  readonly points:readonly number[];readonly boundary:boolean;readonly sourceOccupied:boolean;
  readonly sourceDistance:number;
}
export function nativeAutoCoverageCells(points:readonly NativeAutoBodyPoint[],spacing:number,maxEmpty:number,deepThreshold:number,contains:(x:number,y:number)=>boolean=()=>true):NativeAutoCoverageCell[]{
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const point of points){minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y);}
  const rowStep=Math.round(spacing*Math.sqrt(3)/2/8)*8,originX=Math.round((minX+maxX)/2/8)*8;
  // Boundary rows share the clipped cell's coverage. Starting half a cell off
  // the shore avoids creating a second almost-empty row outside the fragment.
  const inset=Math.min(maxEmpty,spacing/2),rowCount=Math.max(1,Math.floor((maxY-minY-2*inset)/rowStep)+1);
  const originY=Math.round(((minY+maxY)/2-(rowCount-1)*rowStep/2)/8)*8;
  const cells:{column:number;row:number;x:number;y:number;points:number[]}[]=[];
  for(let row=0;row<rowCount;row++){
    const x0=originX+(row%2)*spacing/2,y=originY+row*rowStep;
    for(let column=Math.ceil((minX+inset-x0)/spacing);column<=Math.floor((maxX-inset-x0)/spacing);column++){
      const x=x0+column*spacing;if(contains(x,y))cells.push({column,row,x,y,points:[]});
    }
  }
  if(!cells.length)throw new Error('Automatic coverage lattice has no supported cell');
  points.forEach((point,index)=>{
    let best=Infinity,nearest=0;
    for(let cell=0;cell<cells.length;cell++){const site=cells[cell]!,distance=(point.x-site.x)**2+(point.y-site.y)**2;
      if(distance<best){best=distance;nearest=cell;}}
    cells[nearest]!.points.push(index);
  });
  return cells.filter(cell=>cell.points.length).map(cell=>{
    let x=0,y=0,sourceDistance=0,sourceMax=0,boundary=false;
    for(const index of cell.points){const point=points[index]!;x+=point.x;y+=point.y;sourceDistance+=point.source;sourceMax=Math.max(sourceMax,point.source);boundary ||= point.margin<=16;}
    return {...cell,x:Math.round(x/cell.points.length/8)*8,y:Math.round(y/cell.points.length/8)*8,boundary,
      sourceDistance:sourceDistance/cell.points.length,sourceOccupied:sourceMax+Math.SQRT2*4<=maxEmpty||sourceDistance/cell.points.length<=deepThreshold};
  });
}

/** Subdivide an oversized clipped boundary cell before assigning any object.
 * This uses the complete-unit budget, never adds content to a completed map. */
export function nativeAutoSplitCoverageCell(cell:NativeAutoCoverageCell,points:readonly NativeAutoBodyPoint[]):readonly NativeAutoCoverageCell[]{
  const xs=cell.points.map(i=>points[i]!.x),ys=cell.points.map(i=>points[i]!.y),horizontal=Math.max(...xs)-Math.min(...xs)>=Math.max(...ys)-Math.min(...ys);
  const ordered=[...cell.points].sort((a,b)=>horizontal?points[a]!.x-points[b]!.x:points[a]!.y-points[b]!.y),middle=Math.floor(ordered.length/2);
  return [ordered.slice(0,middle),ordered.slice(middle)].map(indices=>{
    let x=0,y=0,sourceDistance=0,boundary=false;
    for(const index of indices){const p=points[index]!;x+=p.x;y+=p.y;sourceDistance+=p.source;boundary ||= p.margin<=16;}
    return {...cell,points:indices,x:Math.round(x/indices.length/8)*8,y:Math.round(y/indices.length/8)*8,sourceDistance:sourceDistance/indices.length,boundary,sourceOccupied:false};
  });
}
export function nativeAutoCoverageCellNeighbors(cells:readonly NativeAutoCoverageCell[],points:readonly NativeAutoBodyPoint[]):readonly (readonly number[])[]{
  let cols=0,rows=0;for(const p of points){cols=Math.max(cols,p.gx+1);rows=Math.max(rows,p.gy+1);}
  const owners=new Int32Array(cols*rows).fill(-1),neighbors=cells.map(()=>new Set<number>());
  cells.forEach((cell,index)=>cell.points.forEach(i=>{const p=points[i]!;owners[p.gy*cols+p.gx]=index;}));
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const owner=owners[y*cols+x]!;if(owner<0)continue;
    for(const next of [x+1<cols?owners[y*cols+x+1]!:-1,y+1<rows?owners[(y+1)*cols+x]!:-1])
      if(next>=0&&next!==owner){neighbors[owner]!.add(next);neighbors[next]!.add(owner);}
  }
  return neighbors.map(indices=>[...indices]);
}
