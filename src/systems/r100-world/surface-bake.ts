import { bakeMasterWorldSurface as bakeRevision5Surface } from '@/generation/legacy-r100-v5/executor-recovery.js';
import { bakeMasterWorldSurface as bakeRevision4Surface } from '@/generation/legacy-r100-v4/executor.js';
/** Pure immutable texture bake. Runs in the preparation Worker, never in a frame. */
import { bakeMasterWorldSurface as bakeRevision3Surface } from '@/generation/legacy-r100-v3/executor.js';
import { mapWorldPigment, paintedToneRange, sampleWorldAppearance, type WorldAppearanceField, type PaintedToneRange } from '@/generation/world-study/world-material-pigment';
import type { PaintedSurface } from './painted-material';
import type { MasterGroundSurface } from '@/generation/world-study/master-ground-field';
import { NativeVolumeLighting, type NativeVolumeMaterialSet } from '@/generation/world-study/native-volume-raster';
import type { MasterWorld } from '@/generation/world-study/r100-master-world';
import type { PaintedMaterial } from './painted-material';
import { buildMasterSurfaceFields } from './surface-fields';
import { deriveFragmentContamRamp, type Rgb } from '@/entities/form-renderers/d/fragment-ramp';
import { NATIVE_VOLUME_FAMILY_SEQUENCE } from '@/generation/world-study/native-volume-geometry';
import { paintMasterGround } from './ground';
import { organizationSampleIndex, prepareOrganizationSurfaceWindows } from './organization-sampling';
export interface MasterSurfaceBake {
 readonly width:number; readonly height:number;
 readonly albedo:Uint8Array; readonly normal:Uint8Array;
 readonly response:Uint8Array; readonly emission:Uint8Array;
 readonly diagnostics:Readonly<Record<string,number|string|boolean>>;
}
const rgb=(hex:number):Rgb=>[hex>>>16&255,hex>>>8&255,hex&255];
const mix=(a:Rgb,b:Rgb,t:number):Rgb=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
export function masterVolumePalette(world:MasterWorld):NativeVolumeMaterialSet {
 const p=world.sample.profile.palette,ramp=deriveFragmentContamRamp('frag-outdoor');
 const neutral=(ramp.mid[0]+ramp.mid[1]+ramp.mid[2])/3;
 const sourceColor=mix(ramp.core,[neutral,neutral,neutral],.20);
 return {
   outer:{base:rgb(p.materialMid),dark:rgb(p.materialDark),light:rgb(p.materialLight),roughness:.84,structure:.75},
   cut:{base:mix(rgb(p.materialMid),rgb(p.materialLight),.25),dark:rgb(p.materialDark),light:rgb(p.faceLight),roughness:.93,structure:.82},
   inner:{base:rgb(p.materialMid),dark:rgb(p.shadow),light:rgb(p.materialLight),roughness:.62,structure:.72},
   joint:{base:rgb(p.shadow),dark:rgb(p.floorDeep),light:rgb(p.materialMid),roughness:.51,structure:.5,emission:sourceColor,emissionStrength:.72+world.definition.emission*.40},
 };
}
export function bakeMasterSurface(world:MasterWorld,ground:MasterGroundSurface,volume:NativeVolumeLighting,painting?:PaintedMaterial):MasterSurfaceBake {
 const r=world.raster,w=r.width,h=r.height,size=w*h;
  const fields=buildMasterSurfaceFields(world),ramp=deriveFragmentContamRamp('frag-outdoor');
  const diagnostics={structuralEmissionPixels:fields.infection.reduce((n,v)=>n+(v>.15?1:0),0),erosionEdgePixels:fields.erosion.reduce((n,v)=>n+(v>.1?1:0),0),blockingSurfaceMaterial:painting?.solid?'dedicated compact skin/fracture atlas and finish; geometric face normals':'object-local UV; no perimeter brightening',greenOwnership:'actual fractured object or authored light-eaten edge; never the whole floor'};
  const albedo=new Uint8Array(size*4),normal=new Uint8Array(size*4),response=new Uint8Array(size*4),emission=new Uint8Array(size*4);
  const axis=painting?world.definition.axis:0,ca=Math.cos(axis),sa=Math.sin(axis),seed=painting?world.sample.seed:0;
  const appearance=world.appearance;
  const identityField:WorldAppearanceField={secondary:0,tone:0,detail:1};
  const mapped=new Float32Array(3),mappedGround=new Float32Array(3),transmitted=new Float32Array(3);
  const ranges=new Map<PaintedSurface,PaintedToneRange>();
  const getRange=(surface:PaintedSurface):PaintedToneRange=>{let range=ranges.get(surface);if(!range){range=paintedToneRange(surface);ranges.set(surface,range);}return range;};
  const primaryFamilyIndex=NATIVE_VOLUME_FAMILY_SEQUENCE.indexOf(world.definition.family)+1;
  const familyPaints=[undefined,...NATIVE_VOLUME_FAMILY_SEQUENCE.map(family=>painting?.families?.[family]??painting)];
  const organizationWindows=appearance?.materialOrganization&&painting
    ?prepareOrganizationSurfaceWindows(world.meshes,world.definition.family,painting):undefined;
  const mirror=(v:number,extent:number):number=>{const period=extent*2,n=((Math.floor(v)%period)+period)%period;return n<extent?n:period-n-1;};
  for(let i=0;i<size;i++){
   const x=i%w,y=Math.floor(i/w),q=i*4,n=i*3;if(!world.matterAt(x,y))continue;
   const hasSurface=r.matter[i]===1,height=hasSurface?r.heightField[i]!:ground.heightField[i]!;
   const cut=hasSurface&&r.material[i]===1;
   const objectPaint=hasSurface?familyPaints[r.family[i]!]:painting;
   const solidPaint=fields.solid[i]===1?objectPaint?.solid:undefined;
   const receiverPaint=solidPaint??objectPaint;
   const organizedSurface=hasSurface?organizationWindows?.get(r.objectId[i]!):undefined;
   // Apparent transmission uses only this world's known static substrate.
   // The receiver stays opaque: it can never reveal a hidden actor, change
   // the tactical visibility mask or erase an impassable thick edge.
   const transmission=hasSurface&&r.material[i]===2?(r.family[i]===5?.32:r.family[i]===6?.20:0):0;
   let transmittedIndex=0;
   if(transmission&&painting){
    const scale=painting.width/painting.worldSize;
    transmittedIndex=(mirror((-x*sa+y*ca)*scale+((seed>>>8)%97),painting.height)*painting.width
      +mirror((x*ca+y*sa)*scale+(seed%83),painting.width))*4;
   }
   let paintingIndex=0,worldPaintingIndex=0;
   let paintRegion:'skin'|'cleaved'|'loose'='skin';
   if(receiverPaint){
    // The selected photograph region follows the *construction event*. Lower
    // frequency alone cannot turn loose fracture products into intact skin.
    if(hasSurface){
     paintRegion=cut||r.region[i]===2||r.region[i]===3||r.region[i]===4?'cleaved':'skin';
     // A fibre surface is already exposed lengthwise material; its local UV
     // follows the swept strand instead of putting one world stripe across it.
     if(r.family[i]===2)paintRegion=r.material[i]===2?'loose':'cleaved';
     if(r.family[i]===3&&r.material[i]===2)paintRegion='cleaved';
    }else paintRegion=ground.materialEvents[i]===2?'loose':ground.materialEvents[i]===1?'cleaved':'skin';
    if(solidPaint)paintRegion=cut||r.material[i]===2||r.material[i]===3?'cleaved':'skin';
    // Blocking matter owns its material coordinates. Reusing the substrate's
    // world field makes a shallow, impassable face look like walkable ground.
    const local=fields.solid[i]===1||cut||(hasSurface&&r.family[i]===2)||organizedSurface!==undefined;
    const u=local?r.uv[i*2]!:x*ca+y*sa,v=local?r.uv[i*2+1]!:-x*sa+y*ca;
    const scale=receiverPaint.width/receiverPaint.worldSize;
    const px=mirror(u*scale+(seed%83),receiverPaint.width),py=mirror(v*scale+((seed>>>8)%97),receiverPaint.height);
    worldPaintingIndex=(py*receiverPaint.width+px)*4;
    const patch=receiverPaint.regions?.[paintRegion];
    if(patch){
     const left=Math.round(patch.x*receiverPaint.width),top=Math.round(patch.y*receiverPaint.height);
     const pw=Math.min(receiverPaint.width-left,Math.max(1,Math.round(patch.width*receiverPaint.width)));
     const ph=Math.min(receiverPaint.height-top,Math.max(1,Math.round(patch.height*receiverPaint.height)));
     // Preserve the source's native cluster size. Mirroring is continuous at
     // patch limits; no independently randomized tile or artificial outline.
     const organizedWindow=(solidPaint?organizedSurface?.solid:organizedSurface?.ground)?.[paintRegion];
     if(organizedWindow){
      paintingIndex=organizationSampleIndex(organizedWindow,u,v);
     }else{
      const sx=left+mirror(u*scale+(seed%83),pw),sy=top+mirror(v*scale+((seed>>>8)%97),ph);
      paintingIndex=(sy*receiverPaint.width+sx)*4;
     }
    }else paintingIndex=worldPaintingIndex;

   }
   if(appearance){
    sampleWorldAppearance(appearance,x*ca+y*sa,-x*sa+y*ca,seed,identityField);
    if(receiverPaint){
     const primaryFamily=!hasSurface||r.family[i]===primaryFamilyIndex;
     const role=hasSurface?(paintRegion==='cleaved'?'cleaved':'solid'):'ground';
     const secondary=hasSurface?(primaryFamily?0:1):identityField.secondary;
     const patchWeight=solidPaint||organizedSurface?1:.92,worldWeight=1-patchWeight;
     mapWorldPigment(appearance,role,
      receiverPaint.pixels[paintingIndex]!*patchWeight+receiverPaint.pixels[worldPaintingIndex]!*worldWeight,
      receiverPaint.pixels[paintingIndex+1]!*patchWeight+receiverPaint.pixels[worldPaintingIndex+1]!*worldWeight,
      receiverPaint.pixels[paintingIndex+2]!*patchWeight+receiverPaint.pixels[worldPaintingIndex+2]!*worldWeight,
      getRange(receiverPaint),identityField,secondary,mapped);
     if(hasSurface&&!fields.solid[i]){
      // A non-blocking exposed fibre, skin or flow keeps its parent material.
      // Only its actually buried foot blends into the local loose substrate.
      const exposure=Math.min(1,Math.max(0,height-ground.heightField[i]!)/6);
      if(exposure<1){
       mapWorldPigment(appearance,'ground',receiverPaint.pixels[paintingIndex]!,receiverPaint.pixels[paintingIndex+1]!,receiverPaint.pixels[paintingIndex+2]!,getRange(receiverPaint),identityField,identityField.secondary,mappedGround);
       for(let c=0;c<3;c++)mapped[c]=mappedGround[c]!*(1-exposure)+mapped[c]!*exposure;
      }
     }
    }
    if(transmission&&painting)mapWorldPigment(appearance,'ground',painting.pixels[transmittedIndex]!,painting.pixels[transmittedIndex+1]!,painting.pixels[transmittedIndex+2]!,getRange(painting),identityField,identityField.secondary,transmitted);
   }
   let ao=hasSurface?r.ambientOcclusion[i]!:ground.ambientOcclusion[i]!;
   if(!hasSurface){
    let enclosure=0;
    for(const [dx,dy] of [[3,0],[-3,0],[0,3],[0,-3],[7,7],[-7,7],[7,-7],[-7,-7],[14,0],[-14,0],[0,14],[0,-14]]){
     const xx=x+dx!,yy=y+dy!;if(xx<0||yy<0||xx>=w||yy>=h)continue;
     const j=yy*w+xx;if(r.matter[j])enclosure+=Math.min(1,Math.max(0,r.heightField[j]!-height)/Math.hypot(dx!,dy!));
    }
    ao*=1-Math.min(.28,enclosure*.047);
   }
   for(let c=0;c<3;c++){
    // Shallow bedded matter inherits its substrate; only an exposed raised
    // section fully owns the new material. This is a buried foot, not a decal.
    const exposure=fields.solid[i]?1:Math.min(1,Math.max(0,height-ground.heightField[i]!)/10);
    albedo[q+c]=hasSurface?ground.albedo[q+c]!*(1-exposure)+volume.albedo[n+c]!*exposure:ground.albedo[q+c]!;
    if(receiverPaint){
     const pigment=solidPaint?receiverPaint.pixels[paintingIndex+c]!:receiverPaint.pixels[paintingIndex+c]!*.92+receiverPaint.pixels[worldPaintingIndex+c]!*.08;
     // Use the authored tonal range directly, not a second narrow palette ramp.
     // Native geometry, shallow relief and lights continue to own illumination.
     const gain=solidPaint?(paintRegion==='skin'?solidPaint.gain:solidPaint.cutGain):cut?1.12:fields.solid[i]?(r.material[i]===2?.64:.73):hasSurface?.87+.13*exposure:.87;
     albedo[q+c]=appearance?mapped[c]!:Math.min(255,pigment*gain*.94+albedo[q+c]!*.06);
    }
    if(transmission){
     const substrate=painting?(appearance?transmitted[c]!:painting.pixels[transmittedIndex+c]!*.87):ground.albedo[q+c]!;
     albedo[q+c]=albedo[q+c]!*(1-transmission)+substrate*transmission;
    }
    // The old ground-grain normal field belongs to loose substrate. Compact
    // skins retain the true broad face (only a little of the old microrelief).
    // Image brightness never invents height, collision, visibility or normals.
    const faceNormal=solidPaint?r.normals[n+c]!*.94+volume.shadingNormals[n+c]!*.06:hasSurface?volume.shadingNormals[n+c]!:ground.normals[n+c]!;
    normal[q+c]=Math.round((faceNormal*.5+.5)*255);
    emission[q+c]=hasSurface?Math.min(255,volume.emission[n+c]!):0;
    const erosion=fields.erosion[i]!;
    const infection=Math.max(fields.infection[i]!,erosion*.82);
    if(infection>0){
     // Grey-green altered matter and light share one actual fracture mask.
     // Floor marks are restricted to authored eaten-light edges; their
     // absent interior is kept opaque black by the authoritative mask.
     const pigment=ramp.mid[c]!*.82+ramp.core[c]!*.18;
     albedo[q+c]=albedo[q+c]!*(1-infection*.68)+pigment*infection*.68;
     const glow=(ramp.core[c]!*.66+ramp.mid[c]!*.34)*infection*(erosion>0?.72:1);
     emission[q+c]=Math.max(emission[q+c]!,Math.min(255,glow));
    }
   }
   // A blocking boundary is drawn by its actual section geometry and material.
   // Do not brighten every outside pixel: that cancelled the solid/ground
   // material difference and erased the very edge it was meant to reveal.
   albedo[q+3]=255;normal[q+3]=Math.round(ao*255);
   const encoded=Math.max(0,Math.min(65535,Math.round(height*128)));
   const roughness=hasSurface?volume.roughness[i]!:ground.roughness[i]!;
   // Event-specific pigment and finish change together. This does not derive
   // geometric height or tactical visibility from a dark mark in the source.
   const finish=paintRegion==='loose'?.94:paintRegion==='cleaved'?.76:.86;
   const surfaceFinish=solidPaint?Math.min(.98,(paintRegion==='skin'?solidPaint.skinRoughness:solidPaint.cutRoughness)+(roughness-.7)*.04):painting?roughness*.35+finish*.65:roughness;
   response[q]=Math.round(surfaceFinish*255);response[q+1]=encoded>>>8;response[q+2]=encoded&255;response[q+3]=hasSurface?255:0;
  }
 return {width:w,height:h,albedo,normal,response,emission,diagnostics};
}
export function bakeMasterWorldSurface(world:MasterWorld,painting?:PaintedMaterial):MasterSurfaceBake {
 if(!world.appearance)return bakeRevision3Surface(world,painting);
 if(world.algorithmRevision===undefined)return bakeRevision4Surface(world,painting);
 if(world.algorithmRevision===5)return bakeRevision5Surface(world,painting);
 return bakeMasterSurface(world,paintMasterGround(world),new NativeVolumeLighting(world.raster,masterVolumePalette(world),{seed:world.sample.seed,axis:world.definition.axis}),painting);
}
