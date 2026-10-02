/** Art-lab ground: material beds and their real shallow surface response. */
import { bakeMasterGround, type MasterGroundSurface } from '@/generation/world-study/master-ground-field';
import type { MasterWorld } from './world';
export function paintMasterGround(world:MasterWorld):MasterGroundSurface {
  const sample=world.sample,width=sample.cols*sample.tileSize,height=sample.rows*sample.tileSize;
  const support=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)support[y*width+x]=world.matterAt(x,y)?1:0;
  return bakeMasterGround({width,height,seed:sample.seed,axis:world.definition.axis,
    material:sample.profile.material,palette:sample.profile.palette,support,sources:world.definition.instances});
}
