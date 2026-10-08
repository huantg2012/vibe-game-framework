/** Exact visible material emitters shared by rendering and save admission. */
import type { MasterWorld } from '@/generation/world-study/r100-master-world';
export interface MasterSourceCell { readonly cell:number; readonly meshIndex:number }
const cache=new WeakMap<MasterWorld['raster'],{readonly tileMap:MasterWorld['layout']['tileMap'];readonly cells:readonly MasterSourceCell[]}>();
export function selectMasterSourceCells(world:MasterWorld):readonly MasterSourceCell[]{
 const old=cache.get(world.raster);if(old?.tileMap===world.layout.tileMap)return old.cells;
 const r=world.raster,cells:MasterSourceCell[]=[];
 for(let meshIndex=0;meshIndex<world.meshes.length;meshIndex++){
  const mesh=world.meshes[meshIndex]!;
  const joint=mesh.joints[Math.floor(mesh.joints.length*.55)]??{x:mesh.spec.x,y:mesh.spec.y,z:mesh.spec.height*.3};
  let index=-1,distance=Infinity;
  for(const cell of r.occupiedPixels){
   if(r.objectId[cell]!==mesh.spec.id||r.material[cell]!==3)continue;
   const x=cell%r.width,y=Math.floor(cell/r.width),d=(x-joint.x)**2+(y-joint.y)**2;
   if(d<distance){index=cell;distance=d;}
  }
  if(index<0)continue;
  if(!world.matterAt(index%r.width,Math.floor(index/r.width)))continue;
  cells.push(Object.freeze({cell:index,meshIndex}));
 }
 const result=Object.freeze(cells);cache.set(r,{tileMap:world.layout.tileMap,cells:result});return result;
}
