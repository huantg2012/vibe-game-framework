/** Existing continuous substrate operators, with grade-independent quiet ground.
 * Native solids replace the old randomly stamped shallow forms in this art lab. */
import { paintGroundMaterial } from '@/generation/world-study/ground-material';
import { finishMaterialResponse } from '@/generation/world-study/material-response';
import { materialMix } from '@/generation/world-study/material-noise';
import { Raster } from '@/generation/world-study/raster';
import { worldSupportAt } from '@/generation/world-study/support';
import type { WorldSurface } from '@/generation/world-study/surface';
import type { WorldSample } from '@/generation/world-study/types';
import type { MasterWorld } from './world';
export function paintMasterGround(world:MasterWorld):WorldSurface{
  const original=world.sample,p=original.profile.palette,blend=world.definition.ground_material_blend;
  const sample:WorldSample={...original,profile:{...original.profile,palette:{...p,
    materialDark:materialMix(p.floorDeep,p.materialDark,blend),materialMid:materialMix(p.floor,p.materialMid,blend),
    materialLight:materialMix(p.floorLight,p.materialLight,blend),faceLight:materialMix(p.floorLight,p.faceLight,blend)}}};
  const width=sample.cols*sample.tileSize,height=sample.rows*sample.tileSize,raster=new Raster(width,height),floor=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)floor[y*width+x]=worldSupportAt(sample,x,y)?1:0;
  raster.fill(0);
  try{paintGroundMaterial(raster,sample,floor);raster.setClip(null);
    for(let i=0;i<floor.length;i++)if(!floor[i])raster.pixel(i%width,Math.floor(i/width),0);
  }finally{finishMaterialResponse(sample);}
  return{width,height,rgba:raster.rgba};
}
