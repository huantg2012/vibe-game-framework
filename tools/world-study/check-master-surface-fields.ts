import assert from 'node:assert/strict';
import { createMasterWorld } from '../../src/dev/rift-r100-masters/world';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import { buildMasterSurfaceFields } from '../../src/dev/rift-r100-masters/surface-fields';

const results=[];
for(const seed of [20261002,20261003])for(const definition of MASTER_SCENES){
 const world=createMasterWorld(definition,seed),r=world.raster,f=buildMasterSurfaceFields(world);
 let visibleFracture=0,erosionEdge=0,originalJoint=0,solidFoot=0;
 for(let i=0;i<r.width*r.height;i++){
  const x=i%r.width,y=Math.floor(i/r.width),present=world.matterAt(x,y);
  assert(Number.isFinite(f.infection[i])&&f.infection[i]!>=0&&f.infection[i]!<=1);
  assert(Number.isFinite(f.erosion[i])&&f.erosion[i]!>=0&&f.erosion[i]!<=1);
  if(!present)assert.equal(f.infection[i]!+f.erosion[i]!,0,'absent terrain remains black, never a painted receiver');
  if(f.infection[i]!>0){assert.equal(r.matter[i],1,'fracture spread remains on its object');assert(f.fractureDistance[i]!<181,'bounded propagation from an actual joint');}
  if(f.erosion[i]!>0)assert(present,'light-eaten lip only occupies surviving material');
  if(f.infection[i]!>.15)visibleFracture++;
  if(f.erosion[i]!>.10)erosionEdge++;
  if(r.material[i]===3&&present)originalJoint++;
  if(f.solid[i]&&r.heightField[i]!<10)solidFoot++;
 }
 assert(visibleFracture>originalJoint*1.5,`${definition.id}: fractured material must extend beyond the old tiny source`);
 assert(erosionEdge>250,`${definition.id}: even low pollution needs a readable eaten-light boundary`);
 results.push({scene:definition.id,seed,originalJoint,visibleFracture,erosionEdge,solidFoot});
}
console.log(JSON.stringify({status:'pass',scope:'geometry-bound masks, not perceptual approval',results},null,2));
