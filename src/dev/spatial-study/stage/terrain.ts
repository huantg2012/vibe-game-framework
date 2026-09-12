import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SpatialSliceWorld } from '../slice-world';
import { noise, ringBody, roughMaterial, sectionTexture, surfaceTexture } from './materials';
import { createSeabedTexture, createStageGroundGeometry } from './ground-mesh';
import { VOID_SECTION_FADE_END, VOID_SECTION_FADE_START } from './void-section';
import { STAGE_PALETTE } from './palette';
import { TileType } from '@/types/game-types';

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
  private visibleAirCells=0;

  constructor(private readonly context: RiftDevRuntimeContext, readonly worldWidth: number, readonly worldHeight: number,
    isSurfaceAt: (x: number, y: number) => boolean = () => true) {
    this.width = Math.ceil(worldWidth / 8); this.height = Math.ceil(worldHeight / 8);
    // R = current sight through both land and air; G = seen physical terrain.
    // B = actual surface membership, not walkability or sight opacity. Empty
    // space can be looked through but never accumulates a phantom floor memory.
    this.data = new Uint8Array(this.width * this.height * 4);
    for (let row = 0; row < this.height; row++) for (let col = 0; col < this.width; col++) {
      const at = (row * this.width + col) * 4;
      this.data[at + 2] = isSurfaceAt((col + .5) / this.width * worldWidth, (row + .5) / this.height * worldHeight) ? 255 : 0;
      this.data[at + 3] = 255;
    }
    this.texture = new THREE.DataTexture(this.data, this.width, this.height, THREE.RGBAFormat);
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping; this.texture.needsUpdate = true;
  }

  update(elapsedMs: number): void {
    // Actor visibility is exact every tick. The 8px terrain field is refreshed at 20Hz.
    const sequence = Math.floor(elapsedMs / 50); if (sequence === this.lastSequence) return;
    this.lastSequence = sequence;
    let at = 0;this.visibleCells=0;this.visibleAirCells=0;
    for (let row = 0; row < this.height; row++) for (let col = 0; col < this.width; col++) {
      this.point.x = (col + .5) / this.width * this.worldWidth;
      this.point.y = (row + .5) / this.height * this.worldHeight;
      const live=Math.round(this.context.visibilityAt(this.point)*255);
      this.data[at]=live;
      if(live>0){
        this.visibleCells++;
        if(this.data[at+2]){if(!this.data[at+1]){this.data[at+1]=255;this.rememberedCells++;}}
        else this.visibleAirCells++;
      }
      at+=4;
    }
    this.samples += at/4; this.texture.needsUpdate = true;
  }

  apply(material: THREE.MeshStandardMaterial, fixedAnchor?: Readonly<{ x: number; y: number }>, erodedEdge = false,
    shoreSurface?: THREE.Texture): void {
    const size = new THREE.Vector2(this.worldWidth, this.worldHeight);
    const priorCompile = material.onBeforeCompile, priorCacheKey = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
      // roughMaterial owns the common pixel-lighting treatment. Visibility is
      // composed after it and must not silently replace that material policy.
      priorCompile.call(material, shader, renderer);
      shader.uniforms.stageVisibility = { value: this.texture }; shader.uniforms.stageWorldSize = { value: size };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 stageWorld;
        ${erodedEdge ? `attribute float stageDrop; attribute float stageSectionSpan; attribute vec2 stageAnchor;
          varying float stageEdgeDepth; varying float stageEdgeSpan; varying vec2 stageShore;` : ''}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vec4 stagePosition=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            stagePosition=instanceMatrix*stagePosition;
          #endif
          stageWorld=(modelMatrix*stagePosition).xyz;
          ${erodedEdge ? 'stageEdgeDepth=stageDrop;stageEdgeSpan=stageSectionSpan;stageShore=stageAnchor;' : ''}`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D stageVisibility; uniform vec2 stageWorldSize; varying vec3 stageWorld;
        ${erodedEdge ? `varying float stageEdgeDepth; varying float stageEdgeSpan; varying vec2 stageShore;
          ${shoreSurface ? 'uniform sampler2D stageShoreSurface;' : ''}` : ''}
        float stageCluster(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`)
        .replace('#include <opaque_fragment>', `
          vec2 perceptionPoint=${fixedAnchor ? `vec2(${fixedAnchor.x.toFixed(2)},${fixedAnchor.y.toFixed(2)})` : erodedEdge ? 'stageShore' : 'stageWorld.xz'};
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
          ${erodedEdge ? `// The deposited top stops at a thin broken lip. Its
          // vertical face has a separate, darker response rather than repeating
          // the light horizontal strata that read as another walkable terrace.
          float sectionDepth=clamp(stageEdgeDepth/max(stageEdgeSpan,1.),0.,1.);
          float sideFace=smoothstep(1.5,7.,stageEdgeDepth);
          float sectionScatter=mix(.28,.20,sectionDepth)*(.94+.06*abs(normal.x));
          vec3 sectionLight=max(outgoingLight*mix(.58,.48,sectionDepth),diffuseColor.rgb*sectionScatter);
          outgoingLight=mix(max(outgoingLight,diffuseColor.rgb*.52),sectionLight,sideFace);` : ''}
          vec3 rememberedGround=outgoingLight*.12+vec3(.0015,.002,.0015);
          outgoingLight=mix(rememberedGround,outgoingLight,smoothstep(.015,.92,awareness));
          ${erodedEdge ? `// A known shore exposes its geological thickness; only the
          // root is swallowed. The missing interior never receives a surface.
          float sectionRatio=stageEdgeDepth/max(stageEdgeSpan,1.);
          float loss=1.-smoothstep(${VOID_SECTION_FADE_START},${VOID_SECTION_FADE_END},sectionRatio);
          if(loss<grain*.62)discard;
          outgoingLight*=pow(loss,1.25);` : ''}`}
          #include <opaque_fragment>`);
      if (erodedEdge && shoreSurface) {
        shader.uniforms.stageShoreSurface = { value: shoreSurface };
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          // Only the thin broken lip carries the deposited ground pigment;
          // a short transition immediately turns into the dark vertical face.
          vec3 shorePigment=texture2D(stageShoreSurface,stageShore/stageWorldSize).rgb;
          diffuseColor.rgb=mix(shorePigment*.78,diffuseColor.rgb,smoothstep(1.5,7.,stageEdgeDepth));`);
      }
    };
    material.customProgramCacheKey = () => `${priorCacheKey.call(material)}|${fixedAnchor
      ? `stage-anchor:${fixedAnchor.x}:${fixedAnchor.y}` : `stage-ground:${erodedEdge}:shore-${!!shoreSurface}:lip-r7`}`;
  }

  destroy(): void { this.texture.dispose(); }

  snapshot():Record<string,unknown>{return {step:8,width:this.width,height:this.height,
    visibleCells:this.visibleCells,visibleAirCells:this.visibleAirCells,rememberedCells:this.rememberedCells,
    neverSeenSurface:'discarded, no opaque proxy',
    authority:'R=current authoritative sight including air; G=physical terrain memory only; B=surface membership; cleared with stage'};}
}

export class StageTerrain {
  readonly group = new THREE.Group();
  readonly reef: THREE.Mesh;
  readonly visibility: StageVisibility;
  readonly heightTexture: THREE.DataTexture;
  private readonly extract = new THREE.Group();
  private readonly extractGlass: THREE.MeshStandardMaterial;
  private readonly sectionStats:Record<string,unknown>;

  constructor(private readonly context: RiftDevRuntimeContext, private readonly world: SpatialSliceWorld) {
    this.visibility = new StageVisibility(context, world.width, world.height, (x, z) => {
      const map = world.layout.tileMap;
      const tile = map.tiles[Math.floor(z / map.tileSize)]?.[Math.floor(x / map.tileSize)];
      return tile !== undefined && tile !== TileType.VOID;
    });
    this.heightTexture = new THREE.DataTexture(world.ground.copyHeights(), world.ground.columns,
      world.ground.rows, THREE.RedFormat, THREE.FloatType);
    this.heightTexture.minFilter = this.heightTexture.magFilter = THREE.NearestFilter;
    this.heightTexture.wrapS = this.heightTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.heightTexture.needsUpdate = true;
    const stone = roughMaterial(0, createSeabedTexture(world));
    this.visibility.apply(stone);
    const sediment = roughMaterial(0, surfaceTexture(STAGE_PALETTE.sediment, world.seed + 14, 'stone'));
    this.visibility.apply(sediment);
    const dark = roughMaterial(0, sectionTexture(STAGE_PALETTE.section, world.seed + 2));
    this.visibility.apply(dark, undefined, true, stone.map!);
    const geometry = createStageGroundGeometry(world);
    this.sectionStats={...geometry.edge.userData,triangles:geometry.edge.getAttribute('position').count/3,
      fadeStart:VOID_SECTION_FADE_START,fadeEnd:VOID_SECTION_FADE_END};
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
    const reefMaterial = roughMaterial(0, surfaceTexture(STAGE_PALETTE.reef,world.seed+81,'stone'));
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
    edge:this.sectionStats};}

  destroy():void { this.visibility.destroy(); this.heightTexture.dispose(); }
}
