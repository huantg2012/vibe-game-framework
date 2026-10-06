import Phaser from 'phaser';
import * as THREE from 'three';
import { Player } from '@/entities/player';
import { generateDensePlayerPlaceholders } from '@/entities/player-sprite-dense';
import { generatePlayerLampAuraTextures } from '@/entities/player-lamp-aura';
import { bodyDisplacementFraction, bodyHasSupport } from '@/systems/ai/physical-grid';
import { StagePlayer } from '../spatial-study/stage/actors';
import { createPresentationFrame } from '../spatial-study/stage/bridge';
import { disposeTree } from '../spatial-study/stage/materials';
import { STUDY_HEIGHT, STUDY_WIDTH } from './camera';
import { LandmassVistaCamera } from './vista-camera';
import { LandmassVistaModel } from './vista-model';
import { VistaScenery } from './vista-scenery';
import { VistaAudio } from './vista-audio';
import { setVistaAtlasBounds } from './vista-material';

/** A walking visual study. Phaser's production Player is the sole movement
 * owner; this scene deliberately creates no game inventory, FOV or combat. */
export class LivingLandmassStudyScene extends Phaser.Scene {
  private readonly player = new Player();
  private readonly view = createPresentationFrame();
  private readonly previous = { x: 0, y: 0 };
  private readonly next = { x: 0, y: 0 };
  private readonly projected = { x: 0, y: 0 };
  private readonly model = new LandmassVistaModel();
  private readonly stage = new THREE.Scene();
  private readonly scenery = new VistaScenery();
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private inputPaused = false;
  private audio: VistaAudio | null = null;
  private readonly actor = new StagePlayer({ elevationDeg: 35 });
  private readonly rig = new LandmassVistaCamera(this.model.focus, 960);
  private stageRenderer: THREE.WebGLRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private previousOpacity = '';
  private elapsedMs = 0;
  private frames = 0;
  private blockedFrames = 0;
  private destroyed = false;
  private ready = false;
  private readonly failures: string[] = [];
  private readonly shadow: THREE.Mesh;

  constructor() {
    super({ key: 'LivingLandmassStudy' });
    this.shadow = this.actor.root.getObjectByName('pixel-contact-shadow') as THREE.Mesh;
  }

  preload(): void {
    this.load.image('living-vista-r8', '/assets/dev/living-landmass/vista-r8.png');
    this.load.image('living-ground-r8', '/assets/dev/living-landmass/ground-atlas-r8.png');
    this.load.image('living-carapace-r8', '/assets/dev/living-landmass/carapace-r8.png');
    this.load.image('living-fallen-r8', '/assets/dev/living-landmass/fallen-r8.png');
    this.load.image('living-middle-r8', '/assets/dev/living-landmass/middle-carapace-r8.png');
    this.load.image('living-cutface-r8', '/assets/dev/living-landmass/cutface-r8.png');
  }

  create(): void {
    this.stage.add(this.scenery.group, this.model.group, this.actor.root);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownStudy, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdownStudy, this);
    try {
      generateDensePlayerPlaceholders(this); generatePlayerLampAuraTextures(this);
      this.physics.world.setBounds(0, 0, this.model.width, this.model.height);
      this.player.create(this, { spawn: this.model.spawn, facing: 'up' });
      this.previous.x = this.model.spawn.x; this.previous.y = this.model.spawn.y;
      this.view.player.hp = this.view.player.maxHp = 100;
      this.actor.setGroundSampler(this.model.groundHeightAt);
      this.stageRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.stageRenderer.setPixelRatio(2); this.stageRenderer.setSize(STUDY_WIDTH, STUDY_HEIGHT, false);
      this.stageRenderer.outputColorSpace = THREE.SRGBColorSpace;
      this.stageRenderer.toneMapping = THREE.ACESFilmicToneMapping; this.stageRenderer.toneMappingExposure = .95;
      this.stageRenderer.shadowMap.enabled = true; this.stageRenderer.shadowMap.type = THREE.PCFShadowMap;
      for(const asset of ['living-vista-r8','living-ground-r8','living-carapace-r8','living-fallen-r8','living-middle-r8','living-cutface-r8'])
        if(!this.textures.exists(asset))throw new Error(`场景绘制资产加载失败: ${asset}`);
      this.scenery.setPanoramaTexture(new THREE.Texture(this.textures.get('living-vista-r8').getSourceImage()));
      this.scenery.setMiddleTexture(new THREE.Texture(this.textures.get('living-middle-r8').getSourceImage()));
      const ground = new THREE.Texture(this.textures.get('living-ground-r8').getSourceImage());
      this.model.setSurfaceTexture(ground);
      this.model.setRockTexture(new THREE.Texture(this.textures.get('living-cutface-r8').getSourceImage()));
      ground.wrapS=ground.wrapT=THREE.ClampToEdgeWrapping;
      setVistaAtlasBounds(this.model.surface.material,this.model.surface.geometry.boundingBox!);
      this.model.setHeroTextures(
        new THREE.Texture(this.textures.get('living-carapace-r8').getSourceImage()),
        new THREE.Texture(this.textures.get('living-fallen-r8').getSourceImage()),
        {hero:{width:480,height:242,crop:{x:40,y:75,width:1453,height:732}},
          fallen:{width:280,height:120.4,crop:{x:13,y:201,width:1494,height:643}}});
      this.stageRenderer.setClearColor(0x302b37, 1);
      const ambient = new THREE.HemisphereLight(0xbdb4b6, 0x51414a, 1.2);
      const key = new THREE.DirectionalLight(0xd9baa0, 1.4); key.position.set(-472, 2536, 2344);
      key.target.position.set(1000, 40, 1000); key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -1700; key.shadow.camera.right = 1700;
      key.shadow.camera.top = 1700; key.shadow.camera.bottom = -1700; key.shadow.camera.far = 4700;
      key.shadow.bias = -.0003; key.shadow.normalBias = 1.2;
      const bounce = new THREE.DirectionalLight(0x8b7c96, .22); bounce.position.set(1260, -80, 930);
      // A broad, quiet front fill keeps mineral sections readable in the
      // working view; the dark albedo still owns the scene's weight.
      const fill = new THREE.DirectionalLight(0xbeb4c2, .85); fill.position.set(-900, 1100, 2400);
      this.stage.add(ambient, key, key.target, bounce, fill);
      const canvas = this.stageRenderer.domElement, original = this.game.canvas;
      canvas.dataset.livingStage = 'true'; canvas.setAttribute('aria-label', '实时三维生命大陆');
      canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;image-rendering:auto';
      original.parentElement!.append(canvas); this.previousOpacity = original.style.opacity; original.style.opacity = '0';
      this.resizeObserver = new ResizeObserver(this.alignCanvas); this.resizeObserver.observe(original); this.alignCanvas();
      this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this);
      this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.game.events.on(Phaser.Core.Events.FOCUS, this.onFocus, this);
      document.addEventListener('visibilitychange', this.onVisibility);
      window.addEventListener('blur', this.onBlur);
      window.addEventListener('focus', this.onFocus);
      this.audio = new VistaAudio(this.reducedMotion);
      this.ready = true; this.renderScene();
      document.querySelector<HTMLElement>('#game-container')?.focus();
    } catch (error) {
      this.failures.push(error instanceof Error ? error.message : String(error));
      this.shutdownStudy();
      throw error;
    }
  }

  override update(_time: number, delta: number): void {
    if (!this.ready || this.destroyed || this.inputPaused) return;
    this.elapsedMs += Math.min(delta, 100); this.player.update(delta);
  }

  /** Page teardown cannot wait for Phaser's deferred game.destroy frame. */
  dispose(): void { this.shutdownStudy(); }

  snapshot(includeGeometry = true): Record<string, unknown> {
    if (!this.ready || this.destroyed) return { ready: false, errors: [...this.failures], destroyed: this.destroyed };
    const body = this.player.getSprite().body as Phaser.Physics.Arcade.Body, position = this.player.getPosition();
    const height = this.model.groundHeightAt(position.x, position.y);
    this.rig.project(position, height, this.projected);
    const actor = this.actor.snapshot(), feet = actor.feet as number[][];
    return { ready: this.ready, study: 'living-landmass-vista-walk', revision: 8, elapsedMs: this.elapsedMs,
      camera: this.rig.snapshot(), ...(includeGeometry ? { geometry: this.model.snapshot() } : {}), scenery: this.scenery.snapshot(), audio: this.audio?.snapshot(), inputPaused: this.inputPaused, player: { ...position, height,
        facing: this.player.getFacingAngle(), moving: this.player.isMoving(), velocity: { x: body.velocity.x, y: body.velocity.y },
        screen: { ...this.projected }, body: { x: body.x, y: body.y, width: body.width, height: body.height },
        supported: bodyHasSupport(this.model.walk, position, body.halfWidth, body.halfHeight),
        feet: feet.map(foot => ({ x: foot[0], height: foot[1], y: foot[2],
          supportHeight: this.model.groundHeightAt(foot[0]!, foot[2]!), clearance: foot[1]! - this.model.groundHeightAt(foot[0]!, foot[2]!) })) },
      actorProjection: { elevation: this.rig.actorElevation(position, height), colour: 'native finite-palette pixel redraw', depth: 'per-pixel physical pose; real shared depth buffer',
        material: 'alpha-test .5, opaque depth-write, nearest texture', scale: this.actor.root.scale.toArray() },
      visibility: 'open visual workbench; tactical perception is not enabled or validated',
      simulation: 'shared production Player/input and physical-grid sweep only; no RiftScene, combat, search, inventory or save',
      render: { logical:{width:STUDY_WIDTH,height:STUDY_HEIGHT}, internal:{width:this.stageRenderer!.domElement.width,height:this.stageRenderer!.domElement.height}, antialias:this.stageRenderer!.getContext().getContextAttributes()?.antialias, samples:this.stageRenderer!.getContext().getParameter(this.stageRenderer!.getContext().SAMPLES), frames: this.frames, drawCalls: this.stageRenderer!.info.render.calls, triangles: this.stageRenderer!.info.render.triangles,
        buffers: this.stageRenderer!.info.memory.geometries, textures: this.stageRenderer!.info.memory.textures }, blockedFrames: this.blockedFrames,
      errors: [...this.failures] };
  }

  private readonly onBlur = (): void => {
    if (!this.ready || this.destroyed) return;
    this.inputPaused = true; this.audio?.pause(); this.player.setInputEnabled(false); this.physics.world.pause();
  };
  private readonly onFocus = (): void => {
    if (!this.ready || this.destroyed || document.hidden) return;
    this.inputPaused = false; this.audio?.resume(); this.physics.world.resume(); this.player.setInputEnabled(true);
  };
  private readonly onVisibility = (): void => { if (document.hidden) this.onBlur(); else this.onFocus(); };

  private readonly alignCanvas = (): void => {
    if (!this.stageRenderer || this.destroyed) return;
    const box = this.game.canvas.getBoundingClientRect(), parent = this.game.canvas.parentElement!.getBoundingClientRect();
    const style = this.stageRenderer.domElement.style;
    style.left = `${box.left - parent.left}px`; style.top = `${box.top - parent.top}px`;
    style.width = `${box.width}px`; style.height = `${box.height}px`;
  };

  private afterPhysics(): void {
    if (!this.ready || this.destroyed) return;
    const image = this.player.getSprite(), body = image.body as Phaser.Physics.Arcade.Body;
    const dx = image.x - this.previous.x, dy = image.y - this.previous.y;
    // Use the shared continuous AABB sweep and slide each axis. The grid is
    // derived from the actual surface footprint, not from a rectangular stage.
    const fx = bodyDisplacementFraction(this.model.walk, this.previous, body.halfWidth, body.halfHeight, dx, 0);
    this.next.x = this.previous.x + dx * fx; this.next.y = this.previous.y;
    const fy = bodyDisplacementFraction(this.model.walk, this.next, body.halfWidth, body.halfHeight, 0, dy);
    this.next.y += dy * fy;
    if (dx !== 0 && fx < 1 || dy !== 0 && fy < 1) {
      const vx = body.velocity.x, vy = body.velocity.y;
      body.reset(this.next.x, this.next.y); body.setVelocity(fx < 1 ? 0 : vx, fy < 1 ? 0 : vy); this.blockedFrames++;
    }
    this.player.postUpdate();
    Object.assign(this.previous, this.player.getPosition()); this.renderScene();
  }

  private renderScene(): void {
    const body = this.player.getSprite().body as Phaser.Physics.Arcade.Body, p = this.view.player;
    Object.assign(p.position, this.player.getPosition()); p.velocity.x = body.velocity.x; p.velocity.y = body.velocity.y;
    p.facing = this.player.getFacingAngle(); p.moving = this.player.isMoving();
    this.rig.follow(p.position);
    const ground = this.model.groundHeightAt(p.position.x, p.position.y);
    this.actor.setCameraElevation(this.rig.actorElevation(p.position, ground));
    this.actor.setGroundHeight(ground); this.actor.update(p, this.elapsedMs);
    this.audio?.update(this.elapsedMs, p.position);
    this.scenery.update(this.audio?.presentationMs(this.elapsedMs) ?? this.elapsedMs, this.reducedMotion);
    // The contact shadow samples the same surface as both soles. The original
    // Stage actor's shared renderer and drawing are otherwise unchanged.
    const vertices = this.shadow.geometry.getAttribute('position'), yaw = this.actor.root.rotation.y;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    for (let index = 0; index < vertices.count; index++) {
      const x = vertices.getX(index), z = -vertices.getY(index);
      vertices.setZ(index, this.model.groundHeightAt(p.position.x + x * cos + z * sin, p.position.y - x * sin + z * cos) - ground);
    }
    vertices.needsUpdate = true;
    this.stageRenderer!.render(this.stage, this.rig.camera); this.frames++;
  }

  private shutdownStudy(): void {
    if (this.destroyed) return; this.destroyed = true; this.ready = false;
    const attempt = (action: () => void): void => { try { action(); } catch (error) { this.failures.push(String(error)); } };
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this); this.game.events.off(Phaser.Core.Events.FOCUS, this.onFocus, this);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur); window.removeEventListener('focus', this.onFocus);
    attempt(() => this.audio?.destroy());
    this.stage.remove(this.scenery.group); attempt(() => this.scenery.destroy());
    attempt(() => this.player.destroy()); attempt(() => this.resizeObserver?.disconnect());
    if (this.stage.background instanceof THREE.Texture) { this.stage.background.dispose(); this.stage.background = null; }
    this.stage.remove(this.model.group); attempt(() => this.model.destroy()); attempt(() => disposeTree(this.stage));
    this.stage.traverse(object => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose(); });
    attempt(() => this.stageRenderer?.dispose()); attempt(() => this.stageRenderer?.forceContextLoss());
    attempt(() => this.stageRenderer?.domElement.remove());
    this.game.canvas.style.opacity = this.previousOpacity;
  }
}
