import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SlicePresentation, SpatialSliceWorld } from '../slice-world';
import { StagePlayer, StageInsect } from './actors';
import { StageTerrain, type StageTerrainStyle, type StageVisibility } from './terrain';
import { StageSea, type StageSeaOptions } from './sea';
import { StageLoot, type StagePileFactory } from './loot';
import type { RiftPresentationView } from './bridge';
import { createStageCamera, projectStagePoint, StageFollowCamera, type StageCameraMode } from './camera';
import { ACTOR_HEIGHT, disposeTree, STAGE_HEIGHT, STAGE_WIDTH } from './materials';
import { STAGE_PALETTE } from './palette';
import { StageEffects } from './effects';
import { assertStagePresentationSupported, supportsStageForm } from './support';
import type { StageWorldGeometry } from './world-geometry';

export interface StageTerrainSurface {
  readonly group: THREE.Group;
  readonly visibility: StageVisibility;
  readonly heightTexture?: THREE.DataTexture;
  update(elapsedMs: number, exitInRange: boolean): void;
  snapshot(): Record<string, unknown>;
  destroy(): void;
}

/** Explicit world-owned additions share the same depth, sight and final canvas.
 * The default stage never opts into a content pack's materials or atmosphere. */
export interface StageAttachmentContext {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly visibility: StageVisibility;
}
export interface StageAttachment {
  update(elapsedMs: number, frame: RiftPresentationView): void;
  renderOverlay?(renderer: THREE.WebGLRenderer): void;
  snapshot(): Record<string, unknown>;
  onRuntimeRestored?(): void;
  destroy(): void;
}
export interface StagePresentationOptions {
  readonly camera?: StageCameraMode;
  readonly terrain?: StageTerrainStyle;
  readonly createPile?: StagePileFactory;
  readonly sea?: StageSeaOptions | false;
  readonly createTerrain?: (context: RiftDevRuntimeContext, world: StageWorldGeometry) => StageTerrainSurface;
  readonly lighting?: { sky: number; bounce: number; key: number; rim: number; absence: number; exposure?: number };
  readonly dynamicSupport?: boolean;
  readonly createAttachment?: (stage: StageAttachmentContext) => StageAttachment;
}

/** A complete alternate renderer. The Phaser scene remains the only simulation. */
export class StagePresentation implements SlicePresentation {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly followCamera: StageFollowCamera | null;
  private readonly sun: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly opaqueTarget = new THREE.WebGLRenderTarget(STAGE_WIDTH, STAGE_HEIGHT, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(STAGE_WIDTH, STAGE_HEIGHT, THREE.UnsignedIntType),
  });
  private readonly player = new StagePlayer();
  private readonly terrain: StageTerrainSurface;
  private readonly sea: StageSea | null;
  private readonly loot:StageLoot;
  private readonly effects: StageEffects;
  private readonly enemies = new Map<string,StageInsect>();
  private readonly resizeObserver: ResizeObserver;
  private readonly previousCanvasOpacity: string;
  private eventSequence = 0;
  private destroyed = false;
  private renderMs = 0;
  private opaqueDrawCalls = 0;
  private opaqueTriangles = 0;
  private finalDrawCalls = 0;
  private finalTriangles = 0;
  private endTailMs=0;
  private readonly attachment: StageAttachment | undefined;

  constructor(private readonly context: RiftDevRuntimeContext, private readonly world: StageWorldGeometry,
    options: StagePresentationOptions = {}) {
    assertStagePresentationSupported(context.readPresentationFrame());
    for (const form of context.layout.contaminationDraw.forms) if (!supportsStageForm(form))
      throw new Error(`Stage has no world model for ${form.occupancy}/${form.substrate}/${form.coverage}`);
    // Legacy terrain/sea retain their exact implementation and explicit data
    // contract. Other worlds must provide their own surface and opt out of sea.
    if ((!options.createTerrain || options.sea !== false) && !('waterDefinition' in world && 'ground' in world && 'sampleSea' in world))
      throw new Error('This world requires its own stage terrain and sea:false');
    const palette = options.lighting ?? STAGE_PALETTE;
    this.renderer = new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1); this.renderer.setSize(STAGE_WIDTH,STAGE_HEIGHT,false);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=options.lighting?.exposure ?? 1.2;
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.setClearColor(palette.absence,1);
    const canvas=this.renderer.domElement, original=context.scene.game.canvas;
    canvas.dataset.spatialStage='true'; canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:absolute;pointer-events:none;image-rendering:pixelated;z-index:0;';
    original.parentElement!.append(canvas);
    this.previousCanvasOpacity=original.style.opacity; original.style.opacity='0';
    this.resizeObserver=new ResizeObserver(this.alignCanvas); this.resizeObserver.observe(original); this.alignCanvas();
    this.followCamera=options.camera==='follow' ? new StageFollowCamera(world.width,world.height,world.layout.spawnPoint) : null;
    this.camera=this.followCamera?.camera ?? createStageCamera(world.width,world.height);
    this.scene.add(new THREE.HemisphereLight(palette.sky,palette.bounce,1.3));
    const sun=this.sun=new THREE.DirectionalLight(palette.key,1.8); sun.position.set(-280,680,-390); sun.target.position.set(world.width*.5,0,world.height*.5);
    sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-650; sun.shadow.camera.right=650;
    sun.shadow.camera.top=650; sun.shadow.camera.bottom=-650; sun.shadow.camera.far=1800; sun.shadow.bias=-.001;
    this.scene.add(sun,sun.target);
    const rim=this.rim=new THREE.DirectionalLight(palette.rim,.62); rim.position.set(850,210,400); this.scene.add(rim,rim.target);
    this.updateLightFootprint();
    this.loot=new StageLoot(this.groundHeightAt,(x,y)=>world.isFloor(x,y),options.createPile,options.dynamicSupport);
    this.player.setGroundSampler(this.groundHeightAt);
    // These resources exist before the world factory. Own them immediately so
    // even a failed factory is covered by the same stage cleanup.
    this.scene.add(this.player.root,this.loot.group);
    try {
      this.terrain=options.createTerrain?.(context,world) ?? new StageTerrain(context,world as SpatialSliceWorld,options.terrain);
      this.scene.add(this.terrain.group);
      this.effects = new StageEffects(context, world, this.terrain.visibility.texture);
      this.scene.add(this.effects.group);
      this.sea=options.sea===false ? null : new StageSea(context,world as SpatialSliceWorld,this.terrain.visibility.texture,this.terrain.heightTexture,this.opaqueTarget.depthTexture!,options.sea);
      if(this.sea)this.scene.add(this.sea.group);
      this.attachment=options.createAttachment?.({scene:this.scene,camera:this.camera,visibility:this.terrain.visibility});
      context.setWorldProjector((point,out)=>projectStagePoint(this.camera,point,out,this.groundHeightAt(point.x,point.y)));
      this.update(0);
    } catch (error) {
      // A content factory can fail after the native canvas and GPU resources
      // already exist. Runtime cannot receive this half-built owner to clean it.
      try { this.destroy(); } catch (cleanupError) { console.warn('Stage startup cleanup failed', cleanupError); }
      throw error;
    }
  }

  private readonly groundHeightAt=(x:number,y:number):number=>this.world.groundHeightAt(x,y);

  /** Translation changes the shadow footprint, never the material's key-light
   * direction. Otherwise a longer map would relight its far shore differently. */
  private updateLightFootprint():void {
    if(!this.followCamera)return;
    const focus=this.followCamera.focus;
    this.sun.target.position.set(focus.x,0,focus.z);
    this.sun.position.set(focus.x-776,680,focus.z-822);
    this.rim.target.position.set(focus.x,0,focus.z);
    this.rim.position.set(focus.x+850,210,focus.z+400);
  }

  private readonly alignCanvas=():void=>{
    if(this.destroyed)return;
    const original=this.context.scene.game.canvas,parent=original.parentElement!;
    const a=original.getBoundingClientRect(),p=parent.getBoundingClientRect(),style=this.renderer.domElement.style;
    style.left=`${a.left-p.left+parent.scrollLeft}px`;style.top=`${a.top-p.top+parent.scrollTop}px`;
    style.width=`${a.width}px`;style.height=`${a.height}px`;
  };

  prepareFrame(elapsedMs: number): void {
    const frame = this.context.readPresentationFrame();
    this.followCamera?.update(elapsedMs, frame.player, frame.ended, this.groundHeightAt(frame.player.position.x, frame.player.position.y));
    this.terrain.visibility.update(elapsedMs);
  }

  exportRuntimeState(): unknown { return { version: 1, memory: this.terrain.visibility.exportRuntimeState(), camera: this.followCamera?.exportRuntimeState() ?? null }; }
  validateRuntimeState(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const state = value as { version: number; memory: unknown; camera: unknown };
    return state.version === 1 && this.terrain.visibility.validateRuntimeState(state.memory)
      && (this.followCamera ? this.followCamera.validateRuntimeState(state.camera) : state.camera === null);
  }
  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid stage checkpoint');
    const state = value as { memory: unknown; camera: unknown };
    this.terrain.visibility.restoreRuntimeState(state.memory);
    this.followCamera?.restoreRuntimeState(state.camera);
    this.attachment?.onRuntimeRestored?.();
  }

  update(elapsedMs:number):void{
    if(this.destroyed)return;
    const start=performance.now(),frame=this.context.readPresentationFrame();
    assertStagePresentationSupported(frame);
    this.followCamera?.update(elapsedMs,frame.player,frame.ended,this.groundHeightAt(frame.player.position.x,frame.player.position.y));
    this.updateLightFootprint();
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
    this.player.update(frame.player,elapsedMs+this.endTailMs,frame.tools);
    for(const [id,model]of this.enemies){
      const state=frame.enemies.find(enemy=>enemy.id===id);
      if(state)model.setGroundHeight(this.groundHeightAt(state.position.x,state.position.y));
      model.update(state,elapsedMs+this.endTailMs);
    }
    this.terrain.update(elapsedMs,frame.exit.inRange);
    if (!frame.ended) this.effects.update(frame);
    this.loot.update(frame,elapsedMs);this.sea?.update(elapsedMs,frame.player.position,this.camera);
    this.attachment?.update(elapsedMs,frame);
    // The water reads the actual visible opaque surface, including a cliff
    // below ground and each pixel actor's pose depth. A ground-plane projection
    // alone incorrectly paints water back over a known descending shore.
    const shadows=this.renderer.shadowMap.autoUpdate;
    try {
      if(this.sea){
        this.sea.group.visible=false;
        this.renderer.setRenderTarget(this.opaqueTarget);
        this.renderer.render(this.scene,this.camera);
        this.opaqueDrawCalls=this.renderer.info.render.calls;
        this.opaqueTriangles=this.renderer.info.render.triangles;
        this.sea.group.visible=true;
        this.renderer.shadowMap.autoUpdate=false;
      }else{
        this.opaqueDrawCalls=0;this.opaqueTriangles=0;
      }
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene,this.camera);
      this.finalDrawCalls=this.renderer.info.render.calls;
      this.finalTriangles=this.renderer.info.render.triangles;
      const frameBeforeOverlay=this.renderer.info.render.frame;
      this.attachment?.renderOverlay?.(this.renderer);
      if(this.renderer.info.render.frame!==frameBeforeOverlay){
        this.finalDrawCalls+=this.renderer.info.render.calls;
        this.finalTriangles+=this.renderer.info.render.triangles;
      }
    } finally {
      if(this.sea)this.sea.group.visible=true;
      this.renderer.setRenderTarget(null);
      this.renderer.shadowMap.autoUpdate=shadows;
    }
    this.renderMs=performance.now()-start;
  }

  snapshot():Record<string,unknown>{return {type:'three-orthographic-stage',yaw:0,elevation:35,
    resolution:{width:STAGE_WIDTH,height:STAGE_HEIGHT},actorHeight:ACTOR_HEIGHT,
    simulation:'production-rift',worldSignature:this.world.signature(),renderMs:this.renderMs,drawCalls:this.opaqueDrawCalls+this.finalDrawCalls,
    triangles:this.opaqueTriangles+this.finalTriangles,terrainVisibilitySamples:this.terrain.visibility.samples,
    terrainPerception:this.terrain.visibility.snapshot(),endTailMs:this.endTailMs,
    terrain:this.terrain.snapshot(),loot:this.loot.snapshot(),effects:this.effects.snapshot(),waterReveal:this.sea?'current sight opens ground and empty chasms; opaque depth additionally projects descending shores; only physical terrain is remembered':null,
    sea:this.sea?.snapshot(this.camera) ?? null,attachment:this.attachment?.snapshot() ?? null,
    player:this.player.snapshot(),
    camera:{position:this.camera.position.toArray(),left:this.camera.left,right:this.camera.right,top:this.camera.top,bottom:this.camera.bottom,
      ...(this.followCamera?.snapshot() ?? {mode:'fixed',span:this.camera.right-this.camera.left})},
    entities:[...this.enemies].map(([id,model])=>({id,visible:model.root.visible,position:model.root.position.toArray()}))};}

  destroy():void{
    if(this.destroyed)return;this.destroyed=true;
    const failures:unknown[]=[];
    const release=(action:()=>void):void=>{try{action();}catch(error){failures.push(error);}};
    release(()=>this.context.setWorldProjector(null));
    release(()=>this.resizeObserver.disconnect());
    release(()=>this.attachment?.destroy());
    release(()=>this.effects?.destroy());
    release(()=>this.terrain?.destroy());
    release(()=>this.sea?.destroy());
    release(()=>disposeTree(this.scene));
    release(()=>this.opaqueTarget.dispose());
    release(()=>this.renderer.dispose());
    release(()=>this.renderer.forceContextLoss());
    release(()=>this.renderer.domElement.remove());
    release(()=>{this.context.scene.game.canvas.style.opacity=this.previousCanvasOpacity;});
    if(failures.length)throw failures[0];
  }
}
