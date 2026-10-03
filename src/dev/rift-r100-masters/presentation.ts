import type Phaser from 'phaser';
import { deriveFragmentContamRamp, type Rgb } from '@/entities/form-renderers/d/fragment-ramp';
import { NativeVolumeLighting, nativeVolumeHeightAt, type NativeVolumeLight, type NativeVolumeMaterialSet } from '@/generation/world-study/native-volume-raster';
import { paintMasterGround } from './ground';
import type { RiftDevRuntime, RiftDevRuntimeContext, RiftDevActorVisuals } from '@/scenes/rift-scene';
import type { MasterWorld } from './world';
import { MasterSurfaceRenderer } from './surface-renderer';
import { MasterMaterialAudio } from './audio';
import type { PaintedMaterial } from './painted-material';
import { audioManager } from '@/managers/audio-manager';
export type MasterViewMode='normal'|'albedo'|'light'|'geometry';
const rgb=(hex:number):Rgb=>[hex>>>16&255,hex>>>8&255,hex&255];
const mix=(a:Rgb,b:Rgb,t:number):Rgb=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

/** Presentation is below native fog. Geometry never grants a new sight query. */
export class MasterPresentation implements RiftDevRuntime {
 private readonly renderer:MasterSurfaceRenderer;
 private readonly image:Phaser.GameObjects.Image;
 private readonly texture:Phaser.Textures.Texture;
 private readonly audio:MasterMaterialAudio;
 private readonly stress:Phaser.GameObjects.Graphics;
 private readonly key:string;
 private readonly phaseSources:NativeVolumeLight[]=[];
 private readonly sourceAxes:number[]=[];
 private readonly erosionSources:NativeVolumeLight[]=[];
 private readonly hostSources=new Map<string,NativeVolumeLight>();
 private readonly pollutionColor:Rgb;
 private readonly lamp:NativeVolumeLight={x:0,y:0,z:28,radius:264,intensity:3.1,color:[1,.94,.86],castsShadow:false};
 private readonly lights:NativeVolumeLight[];
 private readonly actorMasks:Array<{actor:RiftDevActorVisuals;graphics:Phaser.GameObjects.Graphics;mask:Phaser.Display.Masks.GeometryMask;objects:Phaser.GameObjects.Components.Mask[];key:string;retired:boolean}>=[];
 private mode:MasterViewMode='normal';private motion=true;private destroyed=false;
 private time=0;private lastElapsed=0;private phase='缓慢闪动';private activity=.72;private renderMs=0;
 constructor(private readonly context:RiftDevRuntimeContext,readonly world:MasterWorld,painting?:PaintedMaterial){
  const {scene}=context,r=world.raster,p=world.sample.profile.palette;
  const ramp=deriveFragmentContamRamp('frag-outdoor'),neutral=(ramp.mid[0]+ramp.mid[1]+ramp.mid[2])/3;
  const sourceColor=mix(ramp.core,[neutral,neutral,neutral],.20);
  this.pollutionColor=sourceColor.map(v=>v/Math.max(...sourceColor)) as unknown as Rgb;
  const palette:NativeVolumeMaterialSet={
   outer:{base:rgb(p.materialMid),dark:rgb(p.materialDark),light:rgb(p.materialLight),roughness:.84,structure:.75},
   cut:{base:mix(rgb(p.materialMid),rgb(p.materialLight),.25),dark:rgb(p.materialDark),light:rgb(p.faceLight),roughness:.93,structure:.82},
   inner:{base:rgb(p.materialMid),dark:rgb(p.shadow),light:rgb(p.materialLight),roughness:.62,structure:.72},
   joint:{base:rgb(p.shadow),dark:rgb(p.floorDeep),light:rgb(p.materialMid),roughness:.51,structure:.5,emission:sourceColor,emissionStrength:.72+world.definition.emission*.40},
  };
  this.renderer=new MasterSurfaceRenderer(world,paintMasterGround(world),new NativeVolumeLighting(r,palette,{seed:world.sample.seed,axis:world.definition.axis}),painting);
  this.key=`r100-master-${world.definition.id}-${world.layout.seed}`;
  const rollback:Array<()=>void>=[()=>this.renderer.destroy()];
  try {
  rollback.push(()=>{if(scene.textures.exists(this.key))scene.textures.remove(this.key);});
  const texture=scene.textures.addImage(this.key,this.renderer.canvas as unknown as HTMLImageElement);
  if(!texture){this.renderer.destroy();throw new Error('Could not allocate native material texture');}
  rollback.push(()=>{if(scene.textures.exists(this.key))scene.textures.remove(this.key);});
  this.texture=texture;texture.setFilter(1); // Phaser NEAREST, native pixels at the existing camera scale.
  this.image=scene.add.image(0,0,this.key);
  rollback.push(()=>this.image.destroy());this.image.setOrigin(0).setDepth(0);
  this.stress=scene.add.graphics();
  rollback.push(()=>this.stress.destroy());this.stress.setDepth(1);
  this.audio=new MasterMaterialAudio({family:world.definition.family,grade:world.definition.grade,seed:world.sample.seed},audioManager);
  rollback.push(()=>this.audio.destroy());
  for(const mesh of world.meshes){
   const joint=mesh.joints[Math.floor(mesh.joints.length*.55)]??{x:mesh.spec.x,y:mesh.spec.y,z:mesh.spec.height*.3};
   let index=-1,distance=Infinity;
   for(const cell of r.occupiedPixels){if(r.objectId[cell]!==mesh.spec.id||r.material[cell]!==3)continue;const x=cell%r.width,y=Math.floor(cell/r.width),d=(x-joint.x)**2+(y-joint.y)**2;if(d<distance){index=cell;distance=d;}}
   // No luminous fallback for a concealed/nonexistent joint.
   if(index<0)continue;
   const x=index%r.width,y=Math.floor(index/r.width);if(!world.matterAt(x,y))continue;
   this.phaseSources.push({x,y,z:r.heightField[index]!+3,radius:world.definition.light_radius,intensity:world.definition.emission,castsShadow:false,color:[sourceColor[0]/Math.max(...sourceColor),sourceColor[1]/Math.max(...sourceColor),sourceColor[2]/Math.max(...sourceColor)]});
   this.sourceAxes.push(mesh.spec.rotation??world.definition.axis);
  }
  // Eaten-light regions have a faint damaged lip on the surviving material.
  // Their black interior never receives a light or a drawn receiver.
  for(const polygon of world.definition.erosion){
   let found:{x:number;y:number}|null=null,distance=Infinity;
   for(const vertex of polygon)for(let dy=-12;dy<=12;dy+=4)for(let dx=-12;dx<=12;dx+=4){
    const x=vertex.x+dx,y=vertex.y+dy;if(!world.matterAt(x,y))continue;
    const d=(x-world.layout.spawnPoint.x)**2+(y-world.layout.spawnPoint.y)**2;
    if(d<distance){distance=d;found={x,y};}
   }
   if(found)this.erosionSources.push({...found,z:12,radius:64,intensity:.55,color:[sourceColor[0]/Math.max(...sourceColor),sourceColor[1]/Math.max(...sourceColor),sourceColor[2]/Math.max(...sourceColor)],castsShadow:false});
  }
  this.lights=[this.lamp];
  for(const actor of [context.player,...context.enemies]){
   const graphics=scene.add.graphics().setVisible(false);rollback.push(()=>graphics.destroy());
   const mask=graphics.createGeometryMask(),objects:Phaser.GameObjects.Components.Mask[]=[];rollback.push(()=>mask.destroy());
   for(const object of actor.objects)if('setMask' in object){const masked=object as unknown as Phaser.GameObjects.Components.Mask;rollback.push(()=>masked.clearMask());masked.setMask(mask);objects.push(masked);}
   this.actorMasks.push({actor,graphics,mask,objects,key:'',retired:false});
  }
  }catch(error){for(const cleanup of rollback.reverse()){try{cleanup();}catch{/* Preserve the original failed initialization. */}}throw error;}
 }
 setMode(mode:MasterViewMode):void{this.mode=mode;}
 setMotion(enabled:boolean):void{this.motion=enabled;}
 update(elapsedMs:number,ended:boolean):void{const dt=Math.max(0,elapsedMs-this.lastElapsed);this.lastElapsed=elapsedMs;if(this.motion&&!ended)this.time+=dt;if(ended)this.audio.destroy();}
 afterUpdate():void{
  if(this.destroyed)return;const began=performance.now(),frame=this.context.readPresentationFrame();
  this.lamp.x=frame.player.position.x;this.lamp.y=frame.player.position.y;
  const cycle=(this.time/1000%this.world.definition.motion_period)/this.world.definition.motion_period;
  const pressure=cycle<.56?0:cycle<.76?(cycle-.56)/.20:cycle<.83?1:Math.max(0,1-(cycle-.83)/.17);
  this.activity=.72+pressure*.40;this.phase=cycle<.56?'缓慢闪动':cycle<.76?'绿色侵蚀逐渐变亮':cycle<.83?'绿色侵蚀强烈闪动':'绿色侵蚀逐渐变暗';
  for(let i=0;i<this.phaseSources.length;i++)this.phaseSources[i]!.intensity=this.world.definition.emission*1.8*(.65+Math.max(0,pressure-i*.09)*.55);
  for(const light of this.erosionSources)light.intensity=.48+pressure*.36;
  this.audio.update(this.time,pressure,frame.player.position,this.phaseSources,this.motion);
  const liveHosts=this.context.readPollutionSources?.()??[],seen=new Set<string>();
  for(const source of liveHosts){
   seen.add(source.id);let light=this.hostSources.get(source.id);
   if(!light){light={x:source.x,y:source.y,z:7,radius:source.kind==='paint'?68:82,intensity:0,color:this.pollutionColor,castsShadow:false};this.hostSources.set(source.id,light);}
   light.x=source.x;light.y=source.y;
   // A live film weakly reflects onto nearby matter. A light-eating volume's
   // reflection is weaker still; neither changes the native observation mask.
   light.intensity=source.active?(source.kind==='paint'?.34:.17)*(.88+.12*Math.sin(this.time*.002+source.x*.01)):0;
  }
  for(const id of this.hostSources.keys())if(!seen.has(id))this.hostSources.delete(id);
  const candidates=[...this.phaseSources,...this.erosionSources,...this.hostSources.values()];
  const score=(light:NativeVolumeLight):number=>light.intensity*Math.max(0,1-Math.hypot(light.x-this.lamp.x,light.y-this.lamp.y)/(light.radius+160));
  candidates.sort((a,b)=>score(b)-score(a));
  this.lights.length=1;this.lights.push(...candidates.filter(light=>light.intensity>0).slice(0,7));
  this.renderer.draw(this.lights,this.activity,this.time/1000,['normal','albedo','light','geometry'].indexOf(this.mode));
  this.texture.source[0]!.update();this.drawStress(cycle);this.maskActor();this.renderMs=performance.now()-began;
 }
 private drawStress(cycle:number):void{
  const g=this.stress;g.clear();if(this.mode!=='normal')return;
  const period=this.world.definition.motion_period,grade=this.world.definition.grade;
  const count=grade==='severe'?13:grade==='medium'?8:4;
  const family=this.world.definition.family,p=this.world.sample.profile.palette;
  for(let s=0;s<this.phaseSources.length;s++){
   const source=this.phaseSources[s]!,age=(cycle-.76-s*.025)*period;
   if(age<0||age>2.4)continue;
   const angle=this.sourceAxes[s]!;
   for(let j=0;j<count;j++){
    const delay=j*.055,t=age-delay;if(t<0||t>1.25)continue;
    const side=j%2?1:-1,along=(j*.618%1-.5)*18;
    const outward=side*(2+t*(3+j%3));
    const x=Math.round(source.x+Math.cos(angle)*along-Math.sin(angle)*outward);
    const y=Math.round(source.y+Math.sin(angle)*along+Math.cos(angle)*outward);
    if(!this.world.matterAt(x,y))continue;
    const alpha=(1-t/1.25)*.58;
    g.fillStyle(j%3===0?p.materialLight:p.materialMid,alpha);
    // Short mineral splinters, taut fibre flecks and heavier shell flakes have
    // different release shapes. They shed from a real joint and settle locally.
    if(family==='fibre-knot')g.fillRect(x,y,3,1);
    else if(family==='broken-shell')g.fillTriangle(x,y,x+2,y+1,x,y+3);
    else g.fillRect(x,y,j%3?1:2,1);
   }
  }
 }
 private maskActor():void{
  for(const entry of this.actorMasks){
   if(entry.retired)continue;
   if(!entry.actor.objects.some(object=>object.scene)){entry.mask.destroy();entry.graphics.destroy();entry.objects.length=0;entry.retired=true;continue;}
   const point=entry.actor.getPosition(),ground=entry.actor.getGroundY();
   let x0=point.x-64,x1=point.x+64,y0=point.y-80,y1=point.y+64;
   for(const object of entry.actor.objects)if(object.scene&&'getBounds' in object){
    const box=(object as unknown as {getBounds():{left:number;right:number;top:number;bottom:number}}).getBounds();
    if([box.left,box.right,box.top,box.bottom].every(Number.isFinite)){x0=Math.min(x0,box.left-2);x1=Math.max(x1,box.right+2);y0=Math.min(y0,box.top-2);y1=Math.max(y1,box.bottom+2);}
   }
   x0=Math.floor(x0);x1=Math.ceil(x1);y0=Math.floor(y0);y1=Math.ceil(y1);
   const key=`${x0},${x1},${y0},${y1},${ground}`;if(key===entry.key)continue;entry.key=key;
   const g=entry.graphics;g.clear();g.fillStyle(0xffffff);
   for(let y=y0;y<=y1;y++){let start=-1;for(let x=x0;x<=x1+1;x++){
    const visible=x<=x1&&(this.world.roleAt(x,y)!=='solid'||nativeVolumeHeightAt(this.world.raster,x,y)<Math.max(1,ground-y));
    if(visible&&start<0)start=x;if(!visible&&start>=0){g.fillRect(start,y,x-start,1);start=-1;}
   }}
  }
 }
 snapshot():Record<string,unknown>&{phase:string}{return{mode:this.mode,motion:this.motion,phase:this.phase,elapsedMs:this.time,activity:this.activity,lastRenderMs:this.renderMs,
  renderer:'native-pixel WebGL2 material receiver under unchanged Rift fog',gpuBytes:this.renderer.gpuBytes,surfaces:this.renderer.surfaceDiagnostics,
  shoulderLight:this.lamp,sourceLights:this.phaseSources,erosionLights:this.erosionSources,hostLights:[...this.hostSources.values()],activeLightCount:this.lights.length,geometryDiagnostics:this.world.diagnostics,
  surfaceVisibility:'native finite fog: only erosion/void blocks sight; local material shading never changes tactical visibility',
  occlusion:'explicit solid role masks foreground; walkable relief never clips actors',sounds:this.audio.snapshot()};}
 exportRuntimeState():unknown{return{version:1,artLab:true,elapsedMs:this.time};}
 destroy():void{if(this.destroyed)return;this.destroyed=true;for(const entry of this.actorMasks){if(entry.retired)continue;for(const object of entry.objects)object.clearMask();entry.mask.destroy();entry.graphics.destroy();}this.audio.destroy();this.stress.destroy();this.image.destroy();if(this.context.scene.textures.exists(this.key))this.context.scene.textures.remove(this.key);this.renderer.destroy();}
}
