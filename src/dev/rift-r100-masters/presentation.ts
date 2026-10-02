import type Phaser from 'phaser';
import { deriveFragmentContamRamp, type Rgb } from '@/entities/form-renderers/d/fragment-ramp';
import { NativeVolumeLighting, nativeVolumeLightVisibility, nativeVolumeHeightAt, type NativeVolumeLight, type NativeVolumeMaterialSet } from '@/generation/world-study/native-volume-raster';
import { paintMasterGround } from './ground';
import type { RiftDevRuntime, RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { MasterWorld } from './world';
import { hasMasterMatterPath } from './visibility';

export type MasterViewMode='normal'|'albedo'|'light'|'geometry';
const rgb=(hex:number):Rgb=>[hex>>>16&255,hex>>>8&255,hex&255];
const mix=(a:Rgb,b:Rgb,t:number):Rgb=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

/** Native world-space pixels; presentation never alters navigation or damage. */
export class MasterPresentation implements RiftDevRuntime {
  private readonly lighting:NativeVolumeLighting;
  private readonly objects:Phaser.GameObjects.Image[]=[];
  private readonly keys:string[]=[];
  private readonly volume:Phaser.Textures.CanvasTexture;
  private readonly ground:Phaser.Textures.CanvasTexture;
  private readonly volumeImage:Phaser.GameObjects.Image;
  private readonly volumePixels:ImageData;
  private readonly groundPixels:ImageData;
  private readonly groundAlbedo:Uint8ClampedArray;
  private readonly groundEmission:Float32Array;
  private readonly surfaceVisibility:Float32Array;
  private readonly phaseSources:NativeVolumeLight[]=[];
  private readonly lamp:NativeVolumeLight={x:0,y:0,z:28,radius:264,intensity:2.4,color:[1,.93,.82]};
  private readonly lights:NativeVolumeLight[];
  private readonly point={x:0,y:0};
  private readonly viewport={x:0,y:0,width:520,height:520};
  private readonly actorMaskGraphics:Phaser.GameObjects.Graphics;
  private readonly actorMask:Phaser.Display.Masks.GeometryMask;
  private readonly actorObjects:Phaser.GameObjects.Components.Mask[]=[];
  private mode:MasterViewMode='normal';
  private motion=true;
  private destroyed=false;
  private dirty=true;
  private time=0;
  private lastElapsed=0;
  private lastLightX=NaN;
  private lastLightY=NaN;
  private lastFacing=NaN;
  private lastActivity=NaN;
  private maskX=NaN;
  private maskY=NaN;
  private maskGround=NaN;
  private renderedMode:MasterViewMode|null=null;
  private updated=-Infinity;
  private phase='静默';
  private visiblePixels=0;
  private renderMs=0;
  private visibilityRevision=-1;
  private activity=.22;
  private readonly sourceColor:Rgb;

  constructor(private readonly context:RiftDevRuntimeContext,readonly world:MasterWorld){
    const {scene}=context,r=world.raster,p=world.sample.profile.palette;
    const ramp=deriveFragmentContamRamp('frag-outdoor'),neutral=(ramp.mid[0]+ramp.mid[1]+ramp.mid[2])/3;
    this.sourceColor=mix(ramp.mid,[neutral,neutral,neutral],.38);
    const palette:NativeVolumeMaterialSet={
      outer:{base:rgb(p.materialMid),dark:rgb(p.materialDark),light:rgb(p.materialLight),roughness:.84,structure:.52},
      cut:{base:rgb(p.materialLight),dark:rgb(p.materialDark),light:rgb(p.faceLight),roughness:.93,structure:.70},
      inner:{base:rgb(p.materialMid),dark:rgb(p.shadow),light:rgb(p.materialLight),roughness:.48,structure:.36},
      joint:{base:rgb(p.shadow),dark:rgb(p.floorDeep),light:rgb(p.materialMid),roughness:.41,structure:.5,emission:this.sourceColor,emissionStrength:world.definition.emission},
    };
    this.lighting=new NativeVolumeLighting(r,palette);this.surfaceVisibility=new Float32Array(r.width*r.height);
    const surface=paintMasterGround(world);this.groundAlbedo=surface.rgba;
    const key=`r100-master-${world.definition.id}-${world.layout.seed}`;
    const ground=scene.textures.createCanvas(`${key}-ground`,r.width,r.height),volume=scene.textures.createCanvas(`${key}-volume`,r.width,r.height);
    if(!ground||!volume)throw new Error('Could not allocate native master layers');
    this.keys.push(`${key}-ground`,`${key}-volume`);this.ground=ground;this.volume=volume;
    this.groundPixels=ground.context.createImageData(r.width,r.height);this.volumePixels=volume.context.createImageData(r.width,r.height);
    this.groundPixels.data.set(surface.rgba);ground.context.putImageData(this.groundPixels,0,0);ground.refresh();
    this.objects.push(scene.add.image(0,0,`${key}-ground`).setOrigin(0).setDepth(0));
    this.volumeImage=scene.add.image(0,0,`${key}-volume`).setOrigin(0).setDepth(29);this.objects.push(this.volumeImage);
    for(const mesh of world.meshes){
      const joint=mesh.joints[Math.floor(mesh.joints.length*.55)]??{x:mesh.spec.x,y:mesh.spec.y,z:mesh.spec.height*.3};
      // Move the source to the nearest actually visible joint surface. It cannot
      // be hidden inside an opaque layer while inexplicably lighting neighbours.
      let index=-1,distance=Infinity;
      for(const cell of r.occupiedPixels){if(r.objectId[cell]!==mesh.spec.id||r.material[cell]!==3)continue;const x=cell%r.width,y=Math.floor(cell/r.width),d=(x-joint.x)**2+(y-joint.y)**2;if(d<distance){index=cell;distance=d;}}
      const x=index>=0?index%r.width:joint.x,y=index>=0?Math.floor(index/r.width):joint.y,z=index>=0?r.heightField[index]!+3:joint.z+3;
      this.phaseSources.push({x,y,z,radius:world.definition.light_radius,intensity:world.definition.emission,color:[this.sourceColor[0]/255,this.sourceColor[1]/255,this.sourceColor[2]/255]});
    }
    this.lights=[this.lamp,...this.phaseSources];this.groundEmission=new Float32Array(r.width*r.height*3);
    this.bakeGroundEmission();
    this.actorMaskGraphics=scene.add.graphics().setVisible(false);this.actorMask=this.actorMaskGraphics.createGeometryMask();
    for(const object of context.player.objects){if('setMask' in object){const masked=object as unknown as Phaser.GameObjects.Components.Mask;masked.setMask(this.actorMask);this.actorObjects.push(masked);}}
  }
  private bakeGroundEmission():void{
    const r=this.world.raster,ground=this.groundAlbedo;
    for(const light of this.phaseSources){
      const minX=Math.max(0,Math.floor(light.x-light.radius)),maxX=Math.min(r.width-1,Math.ceil(light.x+light.radius));
      const minY=Math.max(0,Math.floor(light.y-light.radius)),maxY=Math.min(r.height-1,Math.ceil(light.y+light.radius));
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const i=y*r.width+x;if(r.matter[i]||!ground[i*4+3]||ground[i*4]===0&&ground[i*4+1]===0&&ground[i*4+2]===0)continue;
        const distance=Math.hypot(x-light.x,y-light.y,light.z);if(distance>=light.radius)continue;
        const energy=(1-distance/light.radius)**2*light.intensity*3*nativeVolumeLightVisibility(r,x,y,0,light);
        for(let c=0;c<3;c++)this.groundEmission[i*3+c]=this.groundEmission[i*3+c]!+energy*light.color[c]!;
      }
    }
  }
  setMode(mode:MasterViewMode):void{this.mode=mode;this.dirty=true;}
  setMotion(enabled:boolean):void{this.motion=enabled;this.dirty=true;}
  update(elapsedMs:number,ended:boolean):void{const dt=Math.max(0,elapsedMs-this.lastElapsed);this.lastElapsed=elapsedMs;if(this.motion&&!ended)this.time+=dt;}
  afterUpdate(elapsedMs:number):void{
    if(this.destroyed)return;
    if(this.dirty||elapsedMs-this.updated>=1000/20){this.updated=elapsedMs;this.dirty=false;this.render();}
    // Only source surfaces already bounded by the real, unoccluded vision query
    // and the common height-field LOS are allowed to pierce the 2D wall mask.
    this.context.revealProjectedTerrain(this.volumeImage,1);
    this.maskActor();
  }
  private render():void{
    const began=performance.now(),r=this.world.raster,frame=this.context.readPresentationFrame();
    const player=frame.player.position;this.lamp.x=player.x;this.lamp.y=player.y;
    this.viewport.x=Math.floor(player.x)-260;this.viewport.y=Math.floor(player.y)-260;
    const cycle=(this.time/1000%this.world.definition.motion_period)/this.world.definition.motion_period;
    const pressure=cycle<.56?0:cycle<.76?(cycle-.56)/.20:cycle<.83?1:Math.max(0,1-(cycle-.83)/.17);
    this.activity=.22+pressure*.78;this.phase=cycle<.56?'静默':cycle<.76?'接点收紧':cycle<.83?'层间承压':'余压回落';
    // Reuse pixels only while the actual native visibility query is unchanged.
    // The material-animation clock cannot invalidate or freeze gameplay sight.
    const visibilityRevision=this.context.getVisibilityRevision();
    if(this.mode===this.renderedMode && player.x===this.lastLightX && player.y===this.lastLightY
      && frame.player.facing===this.lastFacing && this.activity===this.lastActivity && visibilityRevision===this.visibilityRevision)return;
    this.lastLightX=player.x;this.lastLightY=player.y;this.lastFacing=frame.player.facing;this.lastActivity=this.activity;this.renderedMode=this.mode;
    for(let i=0;i<this.phaseSources.length;i++){
      const delayed=Math.max(0,Math.min(1,pressure-i*.14));this.phaseSources[i]!.intensity=this.world.definition.emission*(.22+delayed*.78);
    }
    if(visibilityRevision!==this.visibilityRevision){
      this.surfaceVisibility.fill(0);this.visiblePixels=0;
      for(const i of r.occupiedPixels){
        const x=i%r.width,y=Math.floor(i/r.width);this.point.x=x+.5;this.point.y=y+.5;
        const range=this.context.unoccludedVisibilityAt(this.point);if(range<=.015)continue;
        const sample=this.world.sample;
        if(!hasMasterMatterPath(sample.land,sample.cols,sample.rows,sample.tileSize,player.x,player.y,x+.5,y+.5))continue;
        const visibility=range*this.lighting.lightVisibilityAt(i,this.lamp);
        if(visibility>.015){this.surfaceVisibility[i]=visibility;this.visiblePixels++;}
      }
      this.visibilityRevision=visibilityRevision;
    }
    this.lighting.render(this.lights,this.volumePixels.data,{ambient:.34,emissionScale:this.activity,viewport:this.viewport,visibility:this.surfaceVisibility});
    const pixels=this.volumePixels.data;
    for(const i of r.occupiedPixels){
      const visibility=this.surfaceVisibility[i]!;if(visibility<=.015)continue;
      if(this.mode==='albedo'){for(let c=0;c<3;c++)pixels[i*4+c]=this.lighting.albedo[i*3+c]!;}
      else if(this.mode==='geometry'){pixels[i*4]=(r.normals[i*3]!*.5+.5)*180;pixels[i*4+1]=(r.normals[i*3+1]!*.5+.5)*180;pixels[i*4+2]=70+r.heightField[i]!*.6;}
      else if(this.mode==='light'){for(let c=0;c<3;c++)pixels[i*4+c]=Math.min(255,pixels[i*4+c]!/Math.max(1,this.lighting.albedo[i*3+c]!)*150);}
      if(this.mode!=='normal')for(let c=0;c<3;c++)pixels[i*4+c]=pixels[i*4+c]!*visibility;
    }
    this.volume.context.putImageData(this.volumePixels,0,0);this.volume.refresh();
    const out=this.groundPixels.data;out.set(this.groundAlbedo);
    for(let y=Math.max(0,this.viewport.y);y<Math.min(r.height,this.viewport.y+this.viewport.height);y++)for(let x=Math.max(0,this.viewport.x);x<Math.min(r.width,this.viewport.x+this.viewport.width);x++){
      const i=y*r.width+x,q=i*4;if(r.matter[i]||out[q]===0&&out[q+1]===0&&out[q+2]===0)continue;
      if(this.mode==='geometry'){const blocked=r.occupancy[Math.floor(y/r.cellSize)*r.columns+Math.floor(x/r.cellSize)]===1;out[q]=blocked?120:30;out[q+1]=blocked?34:62;out[q+2]=blocked?24:45;continue;}
      if(this.mode==='albedo')continue;
      for(let c=0;c<3;c++){const light=this.groundEmission[i*3+c]!*this.activity;out[q+c]=this.mode==='light'?40+light*160:out[q+c]!*(1+light)+light*10;}
    }
    this.ground.context.putImageData(this.groundPixels,0,0);this.ground.refresh();this.renderMs=performance.now()-began;
  }
  private maskActor():void{
    const point=this.context.player.getPosition(),ground=this.context.player.getGroundY();
    const x0=Math.floor(point.x)-24,y0=Math.floor(point.y)-28,g=this.actorMaskGraphics;
    if(x0===this.maskX&&y0===this.maskY&&ground===this.maskGround)return;
    this.maskX=x0;this.maskY=y0;this.maskGround=ground;g.clear();g.fillStyle(0xffffff);
    for(let y=y0;y<y0+56;y++){
      let start=-1;
      for(let x=x0;x<=x0+48;x++){
        const visible=x<x0+48&&nativeVolumeHeightAt(this.world.raster,x,y)<Math.max(1,ground-y);
        if(visible&&start<0)start=x;if(!visible&&start>=0){g.fillRect(start,y,x-start,1);start=-1;}
      }
    }
  }
  snapshot():Record<string,unknown>&{phase:string}{return{mode:this.mode,motion:this.motion,phase:this.phase,elapsedMs:this.time,activity:this.activity,visibleSurfacePixels:this.visiblePixels,lastRenderMs:this.renderMs,
    shoulderLight:this.lamp,sourceLights:this.phaseSources,geometryDiagnostics:this.world.diagnostics,
    surfaceVisibility:'native unoccluded range × same-heightfield LOS; original floor/actors retain native vision',occlusion:'same-heightfield player pixel mask; no walkable undercuts',sounds:'existing Rift mix; material-specific sound production pending'}};
  exportRuntimeState():unknown{return{version:1,artLab:true,elapsedMs:this.time};}
  destroy():void{if(this.destroyed)return;this.destroyed=true;for(const object of this.actorObjects)object.clearMask();this.actorMask.destroy();this.actorMaskGraphics.destroy();for(const object of this.objects)object.destroy();for(const key of this.keys)if(this.context.scene.textures.exists(key))this.context.scene.textures.remove(key);}
}
