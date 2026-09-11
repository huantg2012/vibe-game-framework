import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SpatialSliceWorld } from '../slice-world';
import { noise, ringBody, roughMaterial, surfaceTexture } from './materials';
import { createSeabedTexture, createStageGroundGeometry } from './ground-mesh';

export class StageVisibility {
  readonly texture: THREE.DataTexture;
  readonly width: number;
  readonly height: number;
  private readonly data: Uint8Array;
  private readonly point = { x: 0, y: 0 };
  private lastSequence = -1;
  samples = 0;
  private rememberedCells=0;
  private visibleCells=0;

  constructor(private readonly context: RiftDevRuntimeContext, readonly worldWidth: number, readonly worldHeight: number) {
    this.width = Math.ceil(worldWidth / 8); this.height = Math.ceil(worldHeight / 8);
    // R is current, authoritative perception. G is a stage-local record of
    // ground that has already been seen; it is never supplied back to gameplay.
    this.data = new Uint8Array(this.width * this.height*2);
    this.texture = new THREE.DataTexture(this.data, this.width, this.height, THREE.RGFormat);
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping; this.texture.needsUpdate = true;
  }

  update(elapsedMs: number): void {
    // Actor visibility is exact every tick. The 8px terrain field is refreshed at 20Hz.
    const sequence = Math.floor(elapsedMs / 50); if (sequence === this.lastSequence) return;
    this.lastSequence = sequence;
    let at = 0;this.visibleCells=0;
    for (let row = 0; row < this.height; row++) for (let col = 0; col < this.width; col++) {
      this.point.x = (col + .5) / this.width * this.worldWidth;
      this.point.y = (row + .5) / this.height * this.worldHeight;
      const live=Math.round(this.context.visibilityAt(this.point)*255);
      this.data[at]=live;
      if(live>0){this.visibleCells++;if(!this.data[at+1]){this.data[at+1]=255;this.rememberedCells++;}}
      at+=2;
    }
    this.samples += at/2; this.texture.needsUpdate = true;
  }

  apply(material: THREE.MeshStandardMaterial, fixedAnchor?: Readonly<{ x: number; y: number }>, erodedEdge = false): void {
    const size = new THREE.Vector2(this.worldWidth, this.worldHeight);
    const priorCompile = material.onBeforeCompile, priorCacheKey = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
      // roughMaterial owns the common pixel-lighting treatment. Visibility is
      // composed after it and must not silently replace that material policy.
      priorCompile.call(material, shader, renderer);
      shader.uniforms.stageVisibility = { value: this.texture }; shader.uniforms.stageWorldSize = { value: size };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 stageWorld;
        ${erodedEdge ? 'attribute float stageDrop; varying float stageEdgeDepth;' : ''}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vec4 stagePosition=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            stagePosition=instanceMatrix*stagePosition;
          #endif
          stageWorld=(modelMatrix*stagePosition).xyz;
          ${erodedEdge ? 'stageEdgeDepth=stageDrop;' : ''}`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D stageVisibility; uniform vec2 stageWorldSize; varying vec3 stageWorld;
        ${erodedEdge ? 'varying float stageEdgeDepth;' : ''}
        float stageCluster(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`)
        .replace('#include <opaque_fragment>', `
          vec2 perceptionPoint=${fixedAnchor ? `vec2(${fixedAnchor.x.toFixed(2)},${fixedAnchor.y.toFixed(2)})` : 'stageWorld.xz'};
          vec2 perceptionUv=perceptionPoint/stageWorldSize;
          vec2 perception=texture2D(stageVisibility,perceptionUv).rg;
          float awareness=perception.r;
          ${fixedAnchor ? `if(awareness<=0.)discard;
          outgoingLight*=mix(.18,1.,awareness);` : `
          // Never-seen terrain has no opaque black proxy. Only actual seen
          // ground survives as a dim material memory, so air/VOID remains air.
          if(max(perception.r,perception.g)<=0.)discard;
          vec2 stepUv=vec2(8.)/stageWorldSize;
          float adjacent=min(min(texture2D(stageVisibility,perceptionUv+vec2(stepUv.x,0.)).g,
            texture2D(stageVisibility,perceptionUv-vec2(stepUv.x,0.)).g),
            min(texture2D(stageVisibility,perceptionUv+vec2(0.,stepUv.y)).g,
            texture2D(stageVisibility,perceptionUv-vec2(0.,stepUv.y)).g));
          float grain=stageCluster(floor(stageWorld.xz/4.));
          if(.36+.64*max(adjacent,awareness) < grain*.68)discard;
          vec3 rememberedGround=outgoingLight*.12+vec3(.0015,.002,.0015);
          outgoingLight=mix(rememberedGround,outgoingLight,smoothstep(.015,.92,awareness));
          ${erodedEdge ? `float loss=1.-smoothstep(6.,31.,stageEdgeDepth);
          if(loss<grain*.78)discard;
          outgoingLight=mix(vec3(.0015,.003,.0035),outgoingLight,loss*loss);` : ''}`}
          #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `${priorCacheKey.call(material)}|${fixedAnchor
      ? `stage-anchor:${fixedAnchor.x}:${fixedAnchor.y}` : `stage-ground:${erodedEdge}`}`;
  }

  destroy(): void { this.texture.dispose(); }

  snapshot():Record<string,unknown>{return {step:8,width:this.width,height:this.height,
    visibleCells:this.visibleCells,rememberedCells:this.rememberedCells,
    neverSeenSurface:'discarded, no opaque proxy',
    authority:'R=current production visibility; G=static terrain appearance only; cleared with stage'};}
}

export class StageTerrain {
  readonly group = new THREE.Group();
  readonly reef: THREE.Mesh;
  readonly visibility: StageVisibility;
  readonly heightTexture: THREE.DataTexture;
  private readonly extract = new THREE.Group();
  private readonly extractGlass: THREE.MeshStandardMaterial;

  constructor(private readonly context: RiftDevRuntimeContext, private readonly world: SpatialSliceWorld) {
    this.visibility = new StageVisibility(context, world.width, world.height);
    this.heightTexture = new THREE.DataTexture(world.ground.copyHeights(), world.ground.columns,
      world.ground.rows, THREE.RedFormat, THREE.FloatType);
    this.heightTexture.minFilter = this.heightTexture.magFilter = THREE.NearestFilter;
    this.heightTexture.wrapS = this.heightTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.heightTexture.needsUpdate = true;
    const stone = roughMaterial(0, createSeabedTexture(world));
    this.visibility.apply(stone);
    const sediment = roughMaterial(0, surfaceTexture(0x6f7161, world.seed + 14, 'stone'));
    this.visibility.apply(sediment);
    const dark = roughMaterial(0, surfaceTexture(0x343f40, world.seed + 2, 'stone'));
    this.visibility.apply(dark, undefined, true);
    const geometry = createStageGroundGeometry(world);
    const surface = new THREE.Mesh(geometry.surface, stone), edge = new THREE.Mesh(geometry.edge, dark);
    surface.receiveShadow = edge.receiveShadow = true; this.group.add(surface, edge);
    // Sparse shell fragments sit on the shared deposited surface, rather than
    // supplying fake terrain relief above an otherwise flat plane.
    const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),sediment,420);
    const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), axis = new THREE.Vector3(0,1,0), position = new THREE.Vector3(), scale = new THREE.Vector3();
    let count = 0;
    for (let i = 0; i < 420; i++) {
      const x = noise(i,1,world.seed) * world.width, z = noise(i,2,world.seed) * world.height;
      if (!world.isFloor(x,z)) continue;
      const groove = Math.sin(x / 61 + z / 102 + Math.sin(z / 81) * 1.6);
      if (groove < -.5) continue;
      position.set(x,world.groundHeightAt(x,z)+.45,z); scale.set(2 + noise(i,3)*4,.7 + noise(i,4)*.7,2 + noise(i,5)*8);
      q.setFromAxisAngle(axis,.5 + Math.sin(z / 81)*.5); matrix.compose(position,q,scale); chips.setMatrixAt(count++,matrix);
    }
    chips.count = count; chips.receiveShadow = true; this.group.add(chips);
    const reefMaterial = roughMaterial(0, surfaceTexture(0x707a71,world.seed+81,'stone'));
    this.visibility.apply(reefMaterial,world.reef);
    const h = world.reef.height;
    this.reef = new THREE.Mesh(ringBody([
      {y:-8,x:21,z:15}, {y:12,x:17,z:13}, {y:h*.29,x:15,z:9,dx:4,dz:1},
      {y:h*.61,x:10,z:7,dx:-2,dz:-7}, {y:h*.86,x:8,z:5,dx:7,dz:-10},
      {y:h,x:.6,z:.6,dx:9,dz:-13},
    ],9),reefMaterial);
    this.reef.position.set(world.reef.x,world.groundHeightAt(world.reef.x,world.reef.y),world.reef.y); this.reef.castShadow = true; this.reef.receiveShadow = true; this.group.add(this.reef);
    const exit = world.layout.extractionPoint.position;
    this.extract.position.set(exit.x,world.groundHeightAt(exit.x,exit.y),exit.y); this.group.add(this.extract);
    const markerMaterial=roughMaterial(0x434b3e);this.visibility.apply(markerMaterial);
    const stones = new THREE.Mesh(new THREE.TorusGeometry(10,2.8,5,17,Math.PI*1.7),markerMaterial);
    stones.rotation.x=-Math.PI/2; stones.rotation.z=.7; stones.position.y=1.8; this.extract.add(stones);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(2,18,2),roughMaterial(0x66635b)); marker.position.set(-7,9,-6); this.extract.add(marker);
    this.extractGlass = new THREE.MeshStandardMaterial({color:0xbac9b2,emissive:0x819783,emissiveIntensity:.7,roughness:.7});
    const wick = new THREE.Mesh(new THREE.BoxGeometry(3,2,2.5),this.extractGlass); wick.position.set(-7,15,-5); this.extract.add(wick);
  }

  update(elapsedMs: number, inRange: boolean): void {
    this.visibility.update(elapsedMs);
    this.reef.visible=this.context.visibilityAt(this.world.reef)>0;
    this.extractGlass.emissiveIntensity = (inRange ? 1.2 : .5) + Math.sin(elapsedMs*.002)*.12;
  }

  snapshot():Record<string,unknown>{return {height:this.world.ground.snapshot(),
    reefBase:this.reef.position.toArray(),exitBase:this.extract.position.toArray(),
    edge:'eroded real VOID section, fading to absent space; no bottom cap'};}

  destroy():void { this.visibility.destroy(); this.heightTexture.dispose(); }
}
