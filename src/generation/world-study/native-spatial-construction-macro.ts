/** DEV macro diagnostics of the filled exterior ring only. Internal holes are
 * deliberately not an input: perforating a square must not improve its shape.
 * These measurements and optional art flags do not change gameplay admission. */
export interface NativeConstructionMacroPoint {readonly x:number;readonly y:number}
export const NATIVE_CONSTRUCTION_MACRO_COLUMNS=['id','square_max_axis_ratio','square_min_hull_fill_ratio','square_max_depth_ratio','bar_min_axis_ratio','bar_min_hull_fill_ratio','macro_min_pocket_area_ratio','macro_min_pocket_depth_ratio'] as const;
export interface NativeConstructionMacroPolicy {
  readonly id:string;readonly sourceHash:string;
  readonly squareMaxAxisRatio:number;readonly squareMinHullFillRatio:number;readonly squareMaxDepthRatio:number;
  readonly barMinAxisRatio:number;readonly barMinHullFillRatio:number;
  readonly macroMinPocketAreaRatio:number;readonly macroMinPocketDepthRatio:number;
}
export interface NativeConstructionConcavity {
  readonly from:NativeConstructionMacroPoint;readonly to:NativeConstructionMacroPoint;
  readonly mouthWidthPx:number;readonly areaPx2:number;readonly hullAreaRatio:number;
  readonly maxDepthPx:number;readonly depthRatio:number;readonly deepestPoint:NativeConstructionMacroPoint;
}
export interface NativeConstructionMacroMetrics {
  readonly scope:'filled-exterior-only';readonly outerAreaPx2:number;
  readonly aabb:Readonly<{minX:number;minY:number;width:number;height:number;fillRatio:number}>;
  readonly hull:Readonly<{areaPx2:number;fillRatio:number;vertexCount:number}>;
  /** Uniform filled-area covariance, not covariance of sampled vertices. The
   * equivalent spans equal actual dimensions for a rectangle; they are not a
   * minimum navigable width or a promise that a long shape is a good map. */
  readonly pca:Readonly<{axisRatio:number;majorSpanPx:number;minorSpanPx:number;angleRadians:number}>;
  readonly concavity:Readonly<{deficitAreaPx2:number;maxDepthPx:number;maxDepthRatio:number;areaWeightedDepthPx:number;pockets:readonly NativeConstructionConcavity[]}>;
  readonly regression:Readonly<{policyId:string;policySourceHash:string;squareLike:boolean;barLike:boolean;macroPocketCount:number}>|null;
}

export function parseNativeConstructionMacroPolicy(csv:string,sourceHash:string):NativeConstructionMacroPolicy {
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.length!==2||lines[0]!==NATIVE_CONSTRUCTION_MACRO_COLUMNS.join(',')||lines[1]!.includes('"'))throw new Error('Invalid construction macro CSV; expected one policy row');
  const values=lines[1]!.split(',').map(value=>value.trim()),numbers=values.slice(1).map(Number);
  if(values.length!==NATIVE_CONSTRUCTION_MACRO_COLUMNS.length||!/^[a-z][a-z0-9-]{0,80}$/.test(values[0]!)||!/^[0-9a-f]{64}$/.test(sourceHash)||values.slice(1).some(value=>!value)||numbers.some(value=>!Number.isFinite(value)))throw new Error('Invalid construction macro policy identity or number');
  const [squareMaxAxisRatio,squareMinHullFillRatio,squareMaxDepthRatio,barMinAxisRatio,barMinHullFillRatio,macroMinPocketAreaRatio,macroMinPocketDepthRatio]=numbers as [number,number,number,number,number,number,number];
  if(squareMaxAxisRatio<1||barMinAxisRatio<=squareMaxAxisRatio||[squareMinHullFillRatio,barMinHullFillRatio,macroMinPocketAreaRatio].some(value=>value<=0||value>1)||squareMaxDepthRatio<0||macroMinPocketDepthRatio<=0)throw new Error('Invalid construction macro policy ranges');
  return{id:values[0]!,sourceHash,squareMaxAxisRatio,squareMinHullFillRatio,squareMaxDepthRatio,barMinAxisRatio,barMinHullFillRatio,macroMinPocketAreaRatio,macroMinPocketDepthRatio};
}

type Point=NativeConstructionMacroPoint;
const cross=(a:Point,b:Point,c:Point):number=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const twiceArea=(points:readonly Point[]):number=>{
  const origin=points[0]!;let sum=0;
  for(let i=1;i+1<points.length;i++)sum+=cross(origin,points[i]!,points[i+1]!);
  return sum;
};
type IndexedPoint=Point&Readonly<{index:number}>;
function convexHull(points:readonly Point[]):IndexedPoint[]{
  const sorted=points.map((point,index)=>({...point,index})).sort((a,b)=>a.x-b.x||a.y-b.y),lower:IndexedPoint[]=[],upper:IndexedPoint[]=[];
  const span=Math.max(sorted[sorted.length-1]!.x-sorted[0]!.x,Math.max(...points.map(point=>point.y))-Math.min(...points.map(point=>point.y)));
  // Rotated collinear vertices can have tiny cross-product roundoff. Treat
  // only machine-scale turns as straight, not a design-scale simplification.
  const turnTolerance=Number.EPSILON*span*span*64;
  for(const point of sorted){while(lower.length>1&&cross(lower[lower.length-2]!,lower[lower.length-1]!,point)<=turnTolerance)lower.pop();lower.push(point);}
  for(let i=sorted.length-1;i>=0;i--){const point=sorted[i]!;while(upper.length>1&&cross(upper[upper.length-2]!,upper[upper.length-1]!,point)<=turnTolerance)upper.pop();upper.push(point);}
  lower.pop();upper.pop();return lower.concat(upper);
}

/** Input must be the compiler's simple exterior ring. No rasterisation,
 * simplification, vertex-weighted statistics or geometry construction occurs. */
export function measureNativeConstructionMacro(outline:readonly Point[],policy?:NativeConstructionMacroPolicy):NativeConstructionMacroMetrics {
  if(outline.length<3||outline.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))throw new Error('Invalid macro exterior ring');
  const points=outline.filter((point,i)=>{const previous=outline[(i+outline.length-1)%outline.length]!;return point.x!==previous.x||point.y!==previous.y;});
  if(points.length<3)throw new Error('Degenerate macro exterior ring');
  let area2=twiceArea(points);
  if(!Number.isFinite(area2)||area2===0)throw new Error('Degenerate macro exterior area');
  if(area2<0){points.reverse();area2=-area2;}
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const point of points){minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y);}
  const area=area2/2,width=maxX-minX,height=maxY-minY;
  // Shift coordinates before area moments to avoid cancellation under large
  // world translations. These exact polygon integrals ignore vertex density.
  let sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for(let i=0;i<points.length;i++){
    const a=points[i]!,b=points[(i+1)%points.length]!,x=a.x-minX,y=a.y-minY,u=b.x-minX,v=b.y-minY,k=x*v-u*y;
    sx+=(x+u)*k;sy+=(y+v)*k;sxx+=(x*x+x*u+u*u)*k;syy+=(y*y+y*v+v*v)*k;sxy+=(2*x*y+x*v+u*y+2*u*v)*k;
  }
  const cx=sx/(6*area),cy=sy/(6*area),xx=sxx/(12*area)-cx*cx,yy=syy/(12*area)-cy*cy,xy=sxy/(24*area)-cx*cy;
  const difference=Math.hypot(xx-yy,2*xy),major=(xx+yy+difference)/2,minor=(xx+yy-difference)/2;
  if(!(minor>0&&Number.isFinite(major)))throw new Error('Degenerate macro area covariance');
  const majorSpanPx=Math.sqrt(12*major),minorSpanPx=Math.sqrt(12*minor),axisRatio=Math.sqrt(major/minor);
  const hull=convexHull(points),hullArea=twiceArea(hull)/2,pockets:NativeConstructionConcavity[]=[];
  const areaTolerance=Number.EPSILON*width*height*points.length*32;
  for(let edge=0;edge<hull.length;edge++){
    const from=hull[edge]!,to=hull[(edge+1)%hull.length]!,chain:Point[]=[from];
    for(let i=(from.index+1)%points.length;i!==to.index;i=(i+1)%points.length)chain.push(points[i]!);
    chain.push(to);
    const pocketArea=Math.abs(twiceArea(chain))/2;
    if(pocketArea<=areaTolerance)continue;
    const mouthWidthPx=Math.hypot(to.x-from.x,to.y-from.y);let maxDepthPx=0,deepestPoint:Point=from;
    for(const point of chain){const depth=Math.abs(cross(from,to,point))/mouthWidthPx;if(depth>maxDepthPx){maxDepthPx=depth;deepestPoint=point;}}
    pockets.push({from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},mouthWidthPx,areaPx2:pocketArea,hullAreaRatio:pocketArea/hullArea,maxDepthPx,depthRatio:maxDepthPx/minorSpanPx,deepestPoint:{...deepestPoint}});
  }
  const hullFillRatio=Math.min(1,area/hullArea),maxDepthPx=pockets.reduce((maximum,pocket)=>Math.max(maximum,pocket.maxDepthPx),0),maxDepthRatio=maxDepthPx/minorSpanPx;
  const pocketArea=pockets.reduce((sum,pocket)=>sum+pocket.areaPx2,0),weightedDepth=pockets.reduce((sum,pocket)=>sum+pocket.areaPx2*pocket.maxDepthPx,0);
  return{scope:'filled-exterior-only',outerAreaPx2:area,aabb:{minX,minY,width,height,fillRatio:Math.min(1,area/(width*height))},hull:{areaPx2:hullArea,fillRatio:hullFillRatio,vertexCount:hull.length},pca:{axisRatio,majorSpanPx,minorSpanPx,angleRadians:difference<=Number.EPSILON*Math.max(xx,yy)*32?0:Math.atan2(2*xy,xx-yy)/2},concavity:{deficitAreaPx2:Math.max(0,hullArea-area),maxDepthPx,maxDepthRatio,areaWeightedDepthPx:pocketArea?weightedDepth/pocketArea:0,pockets},regression:policy?{policyId:policy.id,policySourceHash:policy.sourceHash,squareLike:axisRatio<=policy.squareMaxAxisRatio&&hullFillRatio>=policy.squareMinHullFillRatio&&maxDepthRatio<=policy.squareMaxDepthRatio,barLike:axisRatio>=policy.barMinAxisRatio&&hullFillRatio>=policy.barMinHullFillRatio,macroPocketCount:pockets.filter(pocket=>pocket.hullAreaRatio>=policy.macroMinPocketAreaRatio&&pocket.depthRatio>=policy.macroMinPocketDepthRatio).length}:null};
}
