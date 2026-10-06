import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SeaPoint, ShellView } from '@/worlds/suspended-sea/types';
import type { SlicePresentation, SpatialSliceWorld } from '../spatial-study/slice-world';
import { StagePresentation, type StageAttachment, type StageAttachmentContext } from '../spatial-study/stage/presentation';
import type { RiftPresentationView } from '../spatial-study/stage/bridge';
import { roughMaterial, noise } from '../spatial-study/stage/materials';
import { WaterFlowCycle, createFallingWaterFlow } from '../spatial-study/water-flow';
import { createSuspendedSeaBedTexture, createSeaSurfaceGeometry, createSeaRibbonGeometry,
  SuspendedSeaPile, type SeaPileSource } from './seabed';
import { SuspendedSeaAudio } from './audio';

export interface SuspendedSeaPresentationOptions {
  /** Body anchor is distinct from the authoritative melee contact on its lip. */
  readonly shellBody: SeaPoint;
}

export function createSuspendedSeaPresentation(context: RiftDevRuntimeContext, world: SpatialSliceWorld,
  readShell: () => ShellView, options: SuspendedSeaPresentationOptions): SlicePresentation {
  const sources = new Map<string, SeaPileSource>();
  for (const node of world.layout.contaminantNodes) {
    if (node.lootPoolId !== 'sea-deposit' && node.lootPoolId !== 'rift-debris')
      throw new Error(`Suspended sea pile ${node.id} requires an explicit local source`);
    sources.set(node.id, node.lootPoolId);
  }
  for (const node of world.layout.kindlingNodes) {
    if (node.allowWeapon === undefined) throw new Error(`Suspended sea pile ${node.id} lacks its source qualification`);
    sources.set(node.id, node.allowWeapon ? 'rift-debris' : 'sea-deposit');
  }
  return new StagePresentation(context, world, {
    camera: 'follow', terrain: { createSurfaceTexture: createSuspendedSeaBedTexture, scatterFragments: false },
    sea: { nativeFall: true },
    createPile: pile => {
      const source = sources.get(pile.id);
      if (!source) throw new Error(`Unregistered suspended sea search pile ${pile.id}`);
      return new SuspendedSeaPile(world, pile, source);
    },
    createAttachment: stage => new SuspendedSeaStage(context, world, readShell, options.shellBody, stage),
  });
}

const smooth = (value: number): number => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };

export class SuspendedSeaStage implements StageAttachment {
  onRuntimeRestored(): void { this.audio.synchronizeRecovery(this.readShell()); }
  private readonly group = new THREE.Group();
  private readonly shell = new THREE.Group();
  private readonly movablePlate = new THREE.Group();
  private readonly lip = new THREE.Group();
  private readonly shellChips: THREE.Mesh[] = [];
  private readonly shellBodyMaterial = roughMaterial(0x535751);
  private readonly shellFacetMaterial = roughMaterial(0x62675d);
  private readonly lipMaterial = roughMaterial(0x909184);
  private readonly seamMaterial = roughMaterial(0x242b2a);
  private readonly spill: THREE.Mesh;
  private readonly spillEdge: THREE.Mesh;
  private readonly drain: THREE.Mesh;
  private readonly drainFall: THREE.Mesh;
  private readonly flowClock = { value: 0 };
  private readonly spillAmount = { value: 0 };
  private readonly drainAmount = { value: 0 };
  private readonly spillDirection: THREE.Vector2;
  private readonly audio: SuspendedSeaAudio;
  private readonly flowCycle: WaterFlowCycle;
  private readonly flow = createFallingWaterFlow();
  private readonly entryScene = new THREE.Scene();
  private readonly entryCamera = new THREE.Camera();
  private readonly entryProgress = { value: 0 };
  private readonly entryMaterial: THREE.ShaderMaterial;
  private readonly entryGeometry: THREE.BufferGeometry;
  private readonly bodyHeight: number;
  private entryActive = true;
  private destroyed = false;
  private lastView: ShellView;
  private lipRaise = 0;
  private plateShift = 0;
  private hitAge = Infinity;
  private readonly dryDrain: readonly SeaPoint[];

  constructor(private readonly context: RiftDevRuntimeContext, private readonly world: SpatialSliceWorld,
    private readonly readShell: () => ShellView, private readonly body: SeaPoint,
    private readonly stage: StageAttachmentContext) {
    this.lastView = readShell();
    this.group.name = 'suspended-sea-native-world'; stage.scene.add(this.group);
    this.flowCycle = new WaterFlowCycle(world.waterDefinition);
    this.audio = new SuspendedSeaAudio(world.waterDefinition, world.waterDefinition);
    this.bodyHeight = world.groundHeightAt(body.x, body.y);
    const spillCenter = this.lastView.spillOutline.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    this.spillDirection = new THREE.Vector2(spillCenter.x / this.lastView.spillOutline.length - world.waterDefinition.x,
      spillCenter.y / this.lastView.spillOutline.length - world.waterDefinition.y).normalize();
    const angle = Math.atan2(this.lastView.position.x - body.x, this.lastView.position.y - body.y);
    this.shell.position.set(body.x, this.bodyHeight, body.y);
    this.group.add(this.shell); this.shell.add(this.movablePlate);
    for (const material of [this.shellBodyMaterial, this.shellFacetMaterial, this.lipMaterial, this.seamMaterial])
      stage.visibility.apply(material, undefined, false, undefined, true);
    const bodyOutline: SeaPoint[] = [{ x: -36, y: -11 }, { x: -23, y: -23 }, { x: 4, y: -19 },
      { x: 28, y: -13 }, { x: 35, y: 6 }, { x: 18, y: 18 }, { x: -10, y: 25 }, { x: -31, y: 15 }];
    const localGround = (x: number, y: number): number => {
      return world.groundHeightAt(body.x + x, body.y + y) - this.bodyHeight;
    };
    const cavity = new THREE.Mesh(createSeaSurfaceGeometry(bodyOutline, localGround, .35), this.seamMaterial);
    cavity.name = 'suspended-sea-shell-cavity';
    this.shell.add(cavity);
    const plate = new THREE.Mesh(createSeaSurfaceGeometry(bodyOutline, localGround, .85), this.shellBodyMaterial);
    plate.name = 'suspended-sea-shell-plate';
    plate.receiveShadow = true; this.movablePlate.add(plate);
    const foldedFace: SeaPoint[] = [{ x: -30, y: -7 }, { x: -18, y: -16 }, { x: 4, y: -13 },
      { x: 24, y: -8 }, { x: 12, y: -3 }, { x: -6, y: 3 }, { x: -22, y: 9 }];
    const fold = new THREE.Mesh(createSeaSurfaceGeometry(foldedFace, localGround, 1.1), this.shellFacetMaterial);
    fold.receiveShadow = true; this.movablePlate.add(fold);
    const foldLine = [{ x: -29, y: 11 }, { x: -10, y: 4 }, { x: 11, y: -2 }, { x: 28, y: -6 }];
    this.movablePlate.add(new THREE.Mesh(createSeaRibbonGeometry(foldLine, 2.2, localGround, 1.2, false), this.seamMaterial));
    // Irregular short calcium seams; no symmetric scallop or raised rim bowl.
    const rimPoints = [{ x: -31, y: 14 }, { x: -13, y: 22 }, { x: -4, y: 19 }];
    this.movablePlate.add(new THREE.Mesh(createSeaRibbonGeometry(rimPoints, 1.8, localGround, 1.05, false), this.lipMaterial));
    const lipLocalX = this.lastView.position.x - body.x;
    const lipLocalZ = this.lastView.position.y - body.y;
    this.lip.position.set(lipLocalX, localGround(lipLocalX, lipLocalZ), lipLocalZ);
    this.lip.rotation.y = angle;
    this.movablePlate.add(this.lip);
    const gap = new THREE.Mesh(new THREE.BoxGeometry(31, 2.5, 4.1), this.seamMaterial);
    gap.position.set(-1, 1.2, -.1); this.lip.add(gap);
    // The contact is an attached broken fold, not a freestanding straight rod.
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(i === 1 ? 12 : 11, 1.35, i === 1 ? 6.2 : 4.8), this.lipMaterial);
      blade.position.set(-10 + i * 10, 2.1 + (i === 1 ? .3 : 0), i === 1 ? .8 : 0);
      blade.rotation.y = i === 0 ? -.14 : i === 1 ? .06 : -.19; this.lip.add(blade);
    }
    const brokenEnd = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 3.8), this.shellBodyMaterial);
    brokenEnd.position.set(15, 2.3, 1.2); brokenEnd.rotation.y = .6; this.lip.add(brokenEnd);
    for (let i = 0; i < 5; i++) {
      const chip = new THREE.Mesh(new THREE.BoxGeometry(1.2 + noise(i, 1) * 1.4, .7, 1.1), this.lipMaterial);
      chip.visible = false; this.lip.add(chip); this.shellChips.push(chip);
    }

    const fill = this.waterMaterial(0x42626a, 'spill'), foam = this.waterMaterial(0x819b98, 'foam');
    this.spill = new THREE.Mesh(createSeaSurfaceGeometry(this.lastView.spillOutline, this.groundHeight, 1.4), fill);
    this.spillEdge = new THREE.Mesh(createSeaRibbonGeometry(this.lastView.spillOutline, 3.5, this.groundHeight, 1.55, true), foam);
    this.group.add(this.spill, this.spillEdge);

    // Follow supported bed only. The first void cell becomes an actual downward
    // stream; no ribbon spans an unwalkable chasm as an apparent bridge.
    const path = this.supportedDrain(this.lastView.drainPath);
    this.dryDrain = path;
    const dry = roughMaterial(0x3c4241); stage.visibility.apply(dry);
    this.group.add(new THREE.Mesh(createSeaRibbonGeometry(path, 13, this.groundHeight, .24, false), dry));
    this.drain = new THREE.Mesh(createSeaRibbonGeometry(path, 10, this.groundHeight, 1.45, false, true),
      this.waterMaterial(0x63868a, 'channel'));
    this.group.add(this.drain);
    const tip = path[path.length - 1] ?? this.body, previous = path[path.length - 2] ?? this.body;
    const dx = tip.x - previous.x, dy = tip.y - previous.y, length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length * 3.6, ny = dx / length * 3.6, h = world.groundHeightAt(tip.x, tip.y);
    const vertices = [tip.x - nx, h, tip.y - ny, tip.x + nx, h, tip.y + ny,
      tip.x - nx + dx / length * 3, h - 49, tip.y - ny + dy / length * 3,
      tip.x + nx, h, tip.y + ny, tip.x + nx + dx / length * 3, h - 49, tip.y + ny + dy / length * 3,
      tip.x - nx + dx / length * 3, h - 49, tip.y - ny + dy / length * 3];
    const fallGeometry = new THREE.BufferGeometry();
    fallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    fallGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 8, 0, 0, 49, 8, 0, 8, 49, 0, 49], 2));
    fallGeometry.computeVertexNormals();
    this.drainFall = new THREE.Mesh(fallGeometry, this.waterMaterial(0x63858a, 'fall')); this.group.add(this.drainFall);

    this.entryGeometry = new THREE.BufferGeometry();
    this.entryGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.entryMaterial = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
      uniforms: { progress: this.entryProgress },
      vertexShader: 'varying vec2 screenUv; void main(){screenUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
      fragmentShader: `uniform float progress; varying vec2 screenUv;
        void main(){float delay=.31*smoothstep(.18,.9,screenUv.y);
          float visible=smoothstep(delay,delay+.61,progress);
          gl_FragColor=vec4(.018,.024,.024,1.-visible);}`,
    });
    this.entryMaterial.toneMapped = false;
    const entry = new THREE.Mesh(this.entryGeometry, this.entryMaterial); entry.frustumCulled = false;
    this.entryScene.add(entry);
  }

  private readonly groundHeight = (x: number, y: number): number => this.world.groundHeightAt(x, y);

  private waterMaterial(color: number, kind: 'spill' | 'foam' | 'channel' | 'fall'): THREE.MeshStandardMaterial {
    const material = roughMaterial(color); material.transparent = true;
    material.opacity = kind === 'foam' ? .65 : kind === 'spill' ? .76 : .87;
    material.depthWrite = false;
    // Only the thin falling stream has two exposed sides. Ground geometry is
    // genuinely upward-facing; DoubleSide cannot conceal a winding failure.
    material.side = kind === 'fall' ? THREE.DoubleSide : THREE.FrontSide;
    const alongPath = kind === 'channel' || kind === 'fall';
    const prior = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prior.call(material, shader, renderer);
      shader.uniforms.seaClock = this.flowClock;
      shader.uniforms.seaAmount = kind === 'spill' || kind === 'foam' ? this.spillAmount : this.drainAmount;
      shader.uniforms.seaFlowDirection = { value: this.spillDirection };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 seaWaterUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nseaWaterUv=uv;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform float seaClock;uniform float seaAmount;uniform vec2 seaFlowDirection;varying vec2 seaWaterUv;
        float seaNoise(vec2 p){return fract(sin(dot(floor(p),vec2(41.73,289.19)))*19241.517);}`)
        .replace('#include <opaque_fragment>', `
          ${kind === 'fall' ? '' : 'if(texture2D(stageVisibility,stageWorld.xz/stageWorldSize).b<.5)discard;'}
          vec2 current=${alongPath ? 'seaWaterUv' : 'vec2(dot(seaWaterUv,vec2(-seaFlowDirection.y,seaFlowDirection.x)),dot(seaWaterUv,seaFlowDirection))'};
          float scroll=current.y*.15-seaClock*4.8;
          float moving=seaNoise(vec2(current.x*.21,scroll));
          float streak=step(.62,moving)*step(.22,seaNoise(vec2(current.x*.29,scroll*.19)));
          outgoingLight*= ${kind === 'foam' ? '.72+streak*.46' : kind === 'spill' ? '.73+streak*.47' : '.77+streak*.48'};
          ${kind === 'foam' ? `float patches=seaNoise(seaWaterUv*.12);
            diffuseColor.a*=.08+step(.63,patches)*(.46+streak*.46);` : ''}
          diffuseColor.a*=seaAmount;
          #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `suspended-sea-wet-flow-r2:${kind}`;
    this.stage.visibility.apply(material, undefined, false, undefined, true);
    return material;
  }

  private supportedDrain(path: readonly SeaPoint[]): SeaPoint[] {
    if (path.length < 2) throw new Error('Suspended sea drain requires an authored path to a real chasm');
    const result: SeaPoint[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!, b = path[i + 1]!, length = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(length / 3));
      for (let j = 0; j <= steps; j++) {
        const point = { x: a.x + (b.x - a.x) * j / steps, y: a.y + (b.y - a.y) * j / steps };
        if (!this.world.isFloor(point.x, point.y)) {
          if (result.length < 2) throw new Error('Suspended sea drain starts outside supported shore');
          return result;
        }
        if (!result.length || Math.hypot(point.x - result[result.length - 1]!.x, point.y - result[result.length - 1]!.y) > 2)
          result.push(point);
      }
    }
    throw new Error('Suspended sea drain must finish in a real chasm');
  }

  update(_elapsedMs: number, frame: RiftPresentationView): void {
    if (this.destroyed) return;
    const shell = this.readShell(), flow = this.flowCycle.sample(shell.elapsedMs, this.flow);
    this.lastView = shell;
    const entry = this.context.readEntryView();
    this.entryActive = entry.active && !frame.ended;
    this.entryProgress.value = this.entryActive ? entry.progress : 1;
    const open = shell.mode === 'diverting' ? smooth(shell.diversionProgress)
      : shell.mode === 'diverted' ? 1 : shell.mode === 'returning' ? 1 - smooth(shell.returnProgress) : 0;
    this.hitAge = shell.hitAtMs === null ? Infinity : shell.elapsedMs - shell.hitAtMs;
    const resistance = this.hitAge >= 0 && this.hitAge < 90 ? Math.sin(this.hitAge / 90 * Math.PI) : 0;
    this.plateShift = open * 12;
    this.movablePlate.position.x = this.plateShift;
    this.movablePlate.position.y = resistance * -1.5;
    this.movablePlate.rotation.y = open * -.07;
    this.lipRaise = shell.canHit ? smooth((shell.cycleTimeMs - this.world.waterDefinition.quietMs) / 220) * 4.5 : open * .45;
    this.lip.position.y = this.world.groundHeightAt(shell.position.x, shell.position.y) - this.bodyHeight + this.lipRaise + resistance;
    this.lip.rotation.x = open * .11;
    for (let i = 0; i < this.shellChips.length; i++) {
      const chip = this.shellChips[i]!, t = this.hitAge / 1000;
      chip.visible = this.hitAge >= 0 && this.hitAge < 200;
      if (chip.visible) chip.position.set(-10 + i * 5 + (noise(i, 2) - .5) * t * 45,
        3 + (13 + noise(i, 4) * 9) * t - 70 * t * t, (noise(i, 3) - .5) * t * 36);
    }
    this.flowClock.value = shell.elapsedMs / 1000;
    this.spillAmount.value = shell.coreActive && shell.spillActive ? 1 - open * .3 : 0;
    this.drainAmount.value = shell.coreActive ? smooth(open * 2.5) : 0;
    this.spill.visible = this.spillEdge.visible = shell.coreActive && shell.spillActive;
    // Remaining side water keeps its entire authored wet edge until authority
    // ends it. The new channel can fill while that last water is draining.
    const drains = shell.coreActive && open > .035;
    this.drain.visible = this.drainFall.visible = drains;
    this.audio.update(shell, frame.player.position, this.context.isRunEnded(), this.entryActive);
    // flow is intentionally sampled from the same authoritative instant even
    // while quiet; the renderer owns no separate fall or recovery timer.
    void flow;
  }

  renderOverlay(renderer: THREE.WebGLRenderer): void {
    if (!this.entryActive || this.destroyed) return;
    const clear = renderer.autoClear;
    try { renderer.autoClear = false; renderer.render(this.entryScene, this.entryCamera); }
    finally { renderer.autoClear = clear; }
  }

  snapshot(): Record<string, unknown> {
    return { world: 'suspended-sea', material: 'continuous compressed sediment with localized scour and source deposits',
      shell: { body: { ...this.body }, mode: this.lastView.mode, lipRaise: this.lipRaise, plateShift: this.plateShift,
        hitSequence: this.lastView.hitSequence, hitAge: Number.isFinite(this.hitAge) ? this.hitAge : null,
        spillVisible: this.spill.visible, drainVisible: this.drain.visible, coreActive: this.lastView.coreActive,
        drainEndsAtSupportedShore: this.dryDrain[this.dryDrain.length - 1] },
      entry: { active: this.entryActive, progress: this.entryProgress.value, compositor: 'final image only; no sight or sea removal' },
      audio: this.audio.snapshot() };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.audio.destroy();
    this.entryGeometry.dispose(); this.entryMaterial.dispose();
    // Stage owns the attached world's geometry/material disposal as one tree.
  }
}
