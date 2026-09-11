import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SlicePresentation, SpatialSliceWorld } from '../slice-world';
import { StagePlayer, StageInsect } from './actors';
import { StageTerrain } from './terrain';
import { StageSea } from './sea';
import { StageLoot } from './loot';
import { createStageCamera, projectStagePoint } from './camera';
import { ACTOR_HEIGHT, disposeTree, STAGE_HEIGHT, STAGE_WIDTH } from './materials';

/** A complete alternate renderer. The Phaser scene remains the only simulation. */
export class StagePresentation implements SlicePresentation {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly player = new StagePlayer();
  private readonly terrain: StageTerrain;
  private readonly sea: StageSea;
  private readonly loot:StageLoot;
  private readonly enemies = new Map<string,StageInsect>();
  private readonly resizeObserver: ResizeObserver;
  private readonly previousCanvasOpacity: string;
  private eventSequence = 0;
  private destroyed = false;
  private renderMs = 0;
  private endTailMs=0;

  constructor(private readonly context: RiftDevRuntimeContext, private readonly world: SpatialSliceWorld) {
    this.renderer = new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1); this.renderer.setSize(STAGE_WIDTH,STAGE_HEIGHT,false);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.25;
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.setClearColor(0x060b0d,1);
    const canvas=this.renderer.domElement, original=context.scene.game.canvas;
    canvas.dataset.spatialStage='true'; canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:absolute;pointer-events:none;image-rendering:pixelated;z-index:0;';
    original.parentElement!.append(canvas);
    this.previousCanvasOpacity=original.style.opacity; original.style.opacity='0';
    this.resizeObserver=new ResizeObserver(this.alignCanvas); this.resizeObserver.observe(original); this.alignCanvas();
    this.camera=createStageCamera(world.width,world.height);
    this.scene.add(new THREE.HemisphereLight(0x849f9c,0x182526,1.5));
    const sun=new THREE.DirectionalLight(0xa6c1c1,2.1); sun.position.set(-280,680,-390); sun.target.position.set(world.width*.5,0,world.height*.5);
    sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-650; sun.shadow.camera.right=650;
    sun.shadow.camera.top=650; sun.shadow.camera.bottom=-650; sun.shadow.camera.far=1800; sun.shadow.bias=-.001;
    this.scene.add(sun,sun.target);
    const rim=new THREE.DirectionalLight(0x506e78,.8); rim.position.set(850,210,400); this.scene.add(rim);
    this.loot=new StageLoot(this.groundHeightAt);
    this.player.setGroundSampler(this.groundHeightAt);
    this.terrain=new StageTerrain(context,world); this.scene.add(this.terrain.group,this.player.root);
    this.sea=new StageSea(context,world,this.terrain.visibility.texture,this.terrain.heightTexture);this.scene.add(this.sea.group,this.loot.group);
    context.setWorldProjector((point,out)=>projectStagePoint(this.camera,point,out,this.groundHeightAt(point.x,point.y)));
    this.update(0);
  }

  private readonly groundHeightAt=(x:number,y:number):number=>this.world.groundHeightAt(x,y);

  private readonly alignCanvas=():void=>{
    if(this.destroyed)return;
    const original=this.context.scene.game.canvas,parent=original.parentElement!;
    const a=original.getBoundingClientRect(),p=parent.getBoundingClientRect(),style=this.renderer.domElement.style;
    style.left=`${a.left-p.left+parent.scrollLeft}px`;style.top=`${a.top-p.top+parent.scrollTop}px`;
    style.width=`${a.width}px`;style.height=`${a.height}px`;
  };

  update(elapsedMs:number):void{
    if(this.destroyed)return;
    const start=performance.now(),frame=this.context.readPresentationFrame();
    for(const enemy of frame.enemies)if(!this.enemies.has(enemy.id)){
      const model=new StageInsect(enemy.id);model.setGroundSampler(this.groundHeightAt);
      this.enemies.set(enemy.id,model);this.scene.add(model.root);
    }
    for(const event of frame.events){
      if(event.sequence<=this.eventSequence)continue;this.eventSequence=event.sequence;
      if(event.kind==='player-hit')this.player.hit(event);
      else if(this.context.visibilityAt(event.position)>0)this.enemies.get(event.id)?.hit(event);
    }
    // Only finish already-triggered actor motion after settlement. Scene pause
    // stops this callback; the world/sea/hazard/record clocks remain frozen.
    if(frame.ended)this.endTailMs=Math.min(1000,this.endTailMs+Math.min(34,Math.max(0,this.context.scene.game.loop.delta)));
    this.player.setGroundHeight(this.groundHeightAt(frame.player.position.x,frame.player.position.y));
    this.player.update(frame.player,elapsedMs+this.endTailMs);
    for(const [id,model]of this.enemies){
      const state=frame.enemies.find(enemy=>enemy.id===id);
      if(state)model.setGroundHeight(this.groundHeightAt(state.position.x,state.position.y));
      model.update(state,elapsedMs+this.endTailMs);
    }
    this.terrain.update(elapsedMs,frame.exit.inRange);
    this.loot.update(frame,elapsedMs);this.sea.update(elapsedMs,frame.player.position,this.camera);
    this.renderer.render(this.scene,this.camera);this.renderMs=performance.now()-start;
  }

  snapshot():Record<string,unknown>{return {type:'three-orthographic-stage',yaw:0,elevation:35,
    resolution:{width:STAGE_WIDTH,height:STAGE_HEIGHT},actorHeight:ACTOR_HEIGHT,
    simulation:'production-rift',worldSignature:this.world.signature(),renderMs:this.renderMs,drawCalls:this.renderer.info.render.calls,
    triangles:this.renderer.info.render.triangles,terrainVisibilitySamples:this.terrain.visibility.samples,
    terrainPerception:this.terrain.visibility.snapshot(),endTailMs:this.endTailMs,
    terrain:this.terrain.snapshot(),loot:this.loot.snapshot(),
    sea:this.sea.snapshot(this.camera),
    player:this.player.snapshot(),
    camera:{position:this.camera.position.toArray(),left:this.camera.left,right:this.camera.right,top:this.camera.top,bottom:this.camera.bottom},
    entities:[...this.enemies].map(([id,model])=>({id,visible:model.root.visible,position:model.root.position.toArray()}))};}

  destroy():void{
    if(this.destroyed)return;this.destroyed=true;this.context.setWorldProjector(null);
    this.resizeObserver.disconnect();this.terrain.destroy();this.sea.destroy();disposeTree(this.scene);
    this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
    this.context.scene.game.canvas.style.opacity=this.previousCanvasOpacity;
  }
}
