import assert from 'node:assert/strict';
import { bakeMasterGround, sampleMasterMaterial, type MasterMaterialSample } from '../../src/generation/world-study/master-ground-field';
import { worldProfileById } from '../../src/generation/world-study/profiles';
const width=128,height=96,support=new Uint8Array(width*height).fill(1);
for(let y=38;y<56;y++)for(let x=50;x<73;x++)support[y*width+x]=0;
const profile=worldProfileById('ash-strata');
const config={width,height,seed:10991,axis:-.22,material:profile.material,palette:profile.palette,support};
const a=bakeMasterGround(config),b=bakeMasterGround(config),changed=bakeMasterGround({...config,seed:10992});
assert.deepEqual(a.albedo,b.albedo,'same authoring inputs reproduce the same pigment');
assert.deepEqual(a.heightField,b.heightField,'same inputs reproduce the same deposit surface');
assert.notDeepEqual(a.albedo,changed.albedo,'seed changes the material bodies');
let positiveX=0,negativeX=0;
for(let i=0;i<support.length;i++){
  if(!support[i]){assert.equal(a.albedo[i*4+3],0,'an absent cell has no material');assert.equal(a.rgba[i*4]+a.rgba[i*4+1]+a.rgba[i*4+2],0,'VOID is not shaded pigment');continue;}
  assert.equal(a.albedo[i*4+3],255);
  const n=i*3,nx=a.normals[n]!,ny=a.normals[n+1]!,nz=a.normals[n+2]!;
  assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1)<1e-5,'finite unit material normal');
  assert.ok(a.roughness[i]!>=0&&a.roughness[i]!<=1,'bounded roughness');
  assert.ok(a.ambientOcclusion[i]!>=.64&&a.ambientOcclusion[i]!<=1,'material AO never replaces a floor with absolute black');
  if(nx>.02)positiveX++;if(nx<-.02)negativeX++;
}
assert.ok(positiveX>30&&negativeX>30,'opposed shoulders of surface relief respond to opposed lamp direction');
const left:MasterMaterialSample={tone:0,roughness:0,relief:0},right:MasterMaterialSample={tone:0,roughness:0,relief:0};
for(const material of ['strata','crystal','glaze'] as const){sampleMasterMaterial(material,-85,109,42,left);sampleMasterMaterial(material,-85,109,42,right);assert.deepEqual(left,right);assert.ok(Object.values(left).every(Number.isFinite));}
assert.throws(()=>bakeMasterGround({...config,support:new Uint8Array(3)}),/extent mismatch/);
assert.throws(()=>bakeMasterGround({...config,width:0}),/extent/);
console.log('Ground contract: deterministic material/deposit fields, support void, normal response, roughness/AO bounds and sampler checked. Visual quality requires the actual scene review.');
