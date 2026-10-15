/** Fields follow the raster's real material and object ownership. They never
 * create collision, optical cover or a separate painted floor contaminant. */
import type { MasterSurfaceWorld } from './surface-world';

function fracturePigment(x:number,y:number,salt:number):number {
 const hash=(a:number,b:number):number=>{
  let h=Math.imul(a^salt,374761393)^Math.imul(b,668265263);h=Math.imul(h^(h>>>13),1274126177);
  return((h^(h>>>16))>>>0)/4294967296;
 };
 const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,uu=u*u*(3-2*u),vv=v*v*(3-2*v);
 return(hash(a,b)*(1-uu)+hash(a+1,b)*uu)*(1-vv)+(hash(a,b+1)*(1-uu)+hash(a+1,b+1)*uu)*vv;
}

export interface MasterSurfaceFields {
 readonly solid: Uint8Array;
 /** Distance into the visible solid, in world pixels. */
 readonly edgeDistance: Float32Array;
 /** Distance from a real material-3 fracture, clipped to that same object. */
 readonly fractureDistance: Float32Array;
 readonly infection: Float32Array;
 readonly erosion: Float32Array;
 readonly infectedPixels: number;
}

export function buildMasterSurfaceFields(world:MasterSurfaceWorld):MasterSurfaceFields {
 const r=world.raster,w=r.width,h=r.height,total=w*h;
 const solid=new Uint8Array(total),edgeDistance=new Float32Array(total),fractureDistance=new Float32Array(total),infection=new Float32Array(total);
 const roles=new Map<number,string>(world.definition.instances.map(value=>[value.id,value.role]));
 edgeDistance.fill(999);fractureDistance.fill(999);
 for(let i=0;i<total;i++){
  solid[i]=r.matter[i]&&roles.get(r.objectId[i]!)==='solid'?1:0;
  if(!solid[i])edgeDistance[i]=0;
  if(r.matter[i]&&r.material[i]===3)fractureDistance[i]=0;
 }
 const erosion=new Float32Array(total),erosionDistance=new Float32Array(total).fill(999);
 const within=(polygon:readonly {x:number;y:number}[],x:number,y:number):boolean=>{
  let inside=false;for(let a=0,b=polygon.length-1;a<polygon.length;b=a++){
   const p=polygon[a]!,q=polygon[b]!;
   if((p.y>y)!==(q.y>y)&&x<(q.x-p.x)*(y-p.y)/(q.y-p.y)+p.x)inside=!inside;
  }return inside;
 };
 for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){
  const outsideOutline=world.definition.terrainOutline!==undefined&&!within(world.definition.terrainOutline,x+4,y+4);
  if(world.matterAt(x+4,y+4)||!outsideOutline&&!world.definition.erosion.some(polygon=>within(polygon,x+4,y+4)))continue;
  for(let yy=y;yy<Math.min(y+8,h);yy++)for(let xx=x;xx<Math.min(x+8,w);xx++)erosionDistance[yy*w+xx]=0;
 }
 // One pair of scans computes all fields. Fixed neighbours avoid allocating
 // arrays for each native pixel on scene entry.
 const relax=(i:number,j:number,cost:number):void=>{
  if(solid[i])edgeDistance[i]=Math.min(edgeDistance[i]!,edgeDistance[j]!+cost);
  if(r.matter[i]&&r.matter[j]&&r.objectId[j]===r.objectId[i])fractureDistance[i]=Math.min(fractureDistance[i]!,fractureDistance[j]!+cost);
  erosionDistance[i]=Math.min(erosionDistance[i]!,erosionDistance[j]!+cost);
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;
  if(x>0)relax(i,i-1,1);
  if(y>0){relax(i,i-w,1);if(x>0)relax(i,i-w-1,1.414);if(x+1<w)relax(i,i-w+1,1.414);}
 }
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
  const i=y*w+x;
  if(x+1<w)relax(i,i+1,1);
  if(y+1<h){relax(i,i+w,1);if(x>0)relax(i,i+w-1,1.414);if(x+1<w)relax(i,i+w+1,1.414);}
 }
 const width=world.definition.grade==='low'?8:world.definition.grade==='medium'?12:17;
 const reach=world.definition.grade==='low'?88:world.definition.grade==='medium'?132:180;
 let infectedPixels=0;
 for(const i of r.occupiedPixels){
  if(!world.matterAt(i%w,Math.floor(i/w)))continue;
  const d=fractureDistance[i]!;if(d>reach)continue;
  // Material-bound clusters interrupt the damaged band. This is neither an
  // organic vine nor a uniform neon outline, and its dark gaps remain fixed.
  const u=r.uv[i*2]!,v=r.uv[i*2+1]!;
  const breakup=.76+.16*Math.sin(u*.29+v*.13)+.08*Math.sin(u*.81-v*.39);
  const raggedWidth=width*breakup;
  const value=Math.max(0,1-d/raggedWidth);
  // Continue along exposed laminations, not over intact flat tops. The
  // spread begins at a real emissive fracture and is bounded on its object.
  const exposed=r.material[i]===1||r.material[i]===2||r.region[i]===2||r.family[i]===2&&r.normals[i*3+2]!<.94;
  const split=Math.max(0,1-Math.abs(Math.sin(v*.43+Math.sin(u*.034)*.72))/.30);
  const broken=Math.max(.08,.55+.45*Math.sin(u*.13+v*.043));
  let continuation=exposed?split*broken*Math.sqrt(Math.max(0,1-d/reach))*.92:0;
  if(r.family[i]!>=4){
   // New materials are not laminations. Their failures spread in uneven small
   // patches across rough cuts, a stretched sheet or the loaded gel front.
   // No constant-pitch decorative lines across tessellation/UV rows.
   const object=r.objectId[i]!,wide=fracturePigment(u/23,v/19,object+world.definition.seed);
   const fine=fracturePigment(u/7,v/9,object+337),patch=Math.max(0,1-Math.abs(wide*.77+fine*.23-.54)*9);
   const damage=r.material[i]===1?1:r.region[i]===4?.60:r.region[i]===1?.72:r.material[i]===2?.42:.20;
   continuation=patch*patch*damage*Math.pow(Math.max(0,1-d/reach),1.6)*.84;
  }
  infection[i]=Math.max(value*value,continuation);
  if(infection[i]!>.025)infectedPixels++;
 }
 const erosionWidth=world.definition.grade==='low'?12:world.definition.grade==='medium'?17:23;
 for(let i=0;i<total;i++){
  const x=i%w,y=Math.floor(i/w),d=erosionDistance[i]!;
  if(!world.matterAt(x,y)||d>erosionWidth)continue;
  const bands=.64+.24*Math.sin(x*.19+y*.11)+.12*Math.sin(x*.47-y*.23);
  const decay=Math.max(0,1-d/(erosionWidth*bands));
  erosion[i]=decay*decay*(.5+.5*bands);
 }
 return{solid,edgeDistance,fractureDistance,infection,erosion,infectedPixels};
}
