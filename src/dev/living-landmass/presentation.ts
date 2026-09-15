import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SlicePresentation } from '../spatial-study/slice-world';
import { StagePresentation, type StageAttachment, type StageAttachmentContext } from '../spatial-study/stage/presentation';
import type { RiftPresentationView } from '../spatial-study/stage/bridge';
import type { TensionView } from '@/worlds/living-landmass/types';
import type { LivingLandmassWorld } from './world';
import { LivingLandmassTerrain } from './terrain';
import { LivingScenery } from './scenery';
import { LIVING_LIGHTING } from './materials';
import { createLivingPileFactory } from './pile-model';

/** A second world shares the actual stage/actors/effects, while providing its
 * own supported terrain and landscape. There is no hidden sea simulation. */
export function createLivingLandmassPresentation(context:RiftDevRuntimeContext,world:LivingLandmassWorld,
  readTension:()=>TensionView):SlicePresentation {
  return new StagePresentation(context,world,{camera:'follow',sea:false,dynamicSupport:true,lighting:LIVING_LIGHTING,
    createTerrain:()=>new LivingLandmassTerrain(context,world),createPile:createLivingPileFactory(world),
    createAttachment:stage=>new LandmassAttachment(context,world,readTension,stage)});
}

class LandmassAttachment implements StageAttachment {
  private readonly scenery:LivingScenery;
  private readonly overlayScene=new THREE.Scene();
  private readonly overlayCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private readonly overlayMaterial=new THREE.MeshBasicMaterial({color:0x080b0f,transparent:true,opacity:1,depthTest:false,depthWrite:false,toneMapped:false});
  private readonly overlayGeometry=new THREE.PlaneGeometry(2,2);
  private entryActive=true;
  private disposed=false;
  private readonly pose={load:0,tension:0,lift:0};
  constructor(private readonly context:RiftDevRuntimeContext,world:LivingLandmassWorld,
    private readonly readTension:()=>TensionView,stage:StageAttachmentContext){
    this.scenery=new LivingScenery(world,stage.visibility);stage.scene.add(this.scenery.group);
    this.overlayScene.add(new THREE.Mesh(this.overlayGeometry,this.overlayMaterial));
  }
  update(elapsedMs:number,_frame:RiftPresentationView):void{
    if(this.disposed)return;
    const view=this.readTension();
    this.pose.load=Math.min(1,view.naturalTension*1.45);this.pose.tension=view.tension;this.pose.lift=view.tension;
    this.scenery.update(elapsedMs,this.pose);
    const entry=this.context.readEntryView();this.entryActive=entry.active;
    const progress=Math.min(1,Math.max(0,entry.progress));
    this.overlayMaterial.opacity=1-progress*progress*(3-2*progress);
  }
  renderOverlay(renderer:THREE.WebGLRenderer):void{
    if(!this.entryActive||this.disposed)return;
    const clear=renderer.autoClear;
    try{renderer.autoClear=false;renderer.render(this.overlayScene,this.overlayCamera);}finally{renderer.autoClear=clear;}
  }
  snapshot():Record<string,unknown>{return{world:'living-landmass',scenery:this.scenery.snapshot(),pose:{...this.pose},entry:this.entryActive};}
  destroy():void{if(this.disposed)return;this.disposed=true;this.overlayGeometry.dispose();this.overlayMaterial.dispose();}
}
