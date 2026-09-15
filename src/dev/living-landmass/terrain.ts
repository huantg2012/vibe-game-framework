import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { StageTerrainSurface } from '../spatial-study/stage/presentation';
import { StageVisibility } from '../spatial-study/stage/terrain';
import { noise, roughMaterial } from '../spatial-study/stage/materials';
import type { LivingLandmassWorld } from './world';
import { createLivingMaterial } from './materials';

/** The exact support lattice becomes the visible skin. No second wave, floor
 * rectangle across the cavity or fixed-height side wall is introduced here. */
export class LivingLandmassTerrain implements StageTerrainSurface {
  readonly group = new THREE.Group();
  readonly visibility: StageVisibility;
  private readonly surface: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly sides: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly sideDrop: number[] = [];
  private readonly sideAnchors: number[] = [];
  private readonly exit = new THREE.Group();
  private readonly exitMaterial = roughMaterial(0xa19279);
  private readonly folds: THREE.Mesh[] = [];
  private readonly foldLift: number[][] = [];
  private readonly knot = new THREE.Group();
  private readonly knotMaterial = roughMaterial(0x4e7772);
  private lastHeightPose = NaN;
  private disposed = false;

  constructor(context: RiftDevRuntimeContext, readonly world: LivingLandmassWorld) {
    this.visibility = new StageVisibility(context,world.width,world.height,(x,y)=>world.isFloor(x,y));
    const step=world.supportStep, cols=world.supportColumns, rows=world.supportRows;
    const positions=new Float32Array(cols*rows*3),uvs=new Float32Array(cols*rows*2), indices:number[]=[];
    const sidePositions:number[]=[],sideUV:number[]=[],sideIndices:number[]=[];
    for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
      const i=z*cols+x;positions[i*3]=x*step;positions[i*3+1]=world.groundHeightAt(x*step,z*step);positions[i*3+2]=z*step;
      uvs[i*2]=x*step/256;uvs[i*2+1]=z*step/256;
    }
    const edge=(ax:number,az:number,bx:number,bz:number)=>{
      const base=sidePositions.length/3;
      // A thin rounded lip immediately turns downward into a dark fibrous edge.
      const length=Math.hypot(bx-ax,bz-az),nx=(bz-az)/length,nz=-(bx-ax)/length;
      for(const depth of [0,2,9,22,44])for(const [x,z]of[[ax,az],[bx,bz]]){
        const drop=depth*(.9+noise(Math.floor(x!/32),Math.floor(z!/32),world.seed)*.16);
        const inset=depth*.14;
        sidePositions.push(x!+nx*inset,world.groundHeightAt(x!,z!)-drop,z!+nz*inset);
        this.sideDrop.push(drop);this.sideAnchors.push(x!,z!);
        sideUV.push((x!+z!)/256,depth/128);
      }
      for(let row=0;row<4;row++){const a=base+row*2;sideIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
    };
    for(let z=0;z<rows-1;z++)for(let x=0;x<cols-1;x++){
      const wx=x*step,wz=z*step;
      if(!world.isFloor(wx+step*.5,wz+step*.5))continue;
      const a=z*cols+x,b=a+1,c=a+cols,d=c+1;
      indices.push(a,c,b,b,c,d);
      if(!world.isFloor(wx-step*.5,wz+step*.5))edge(wx,wz,wx,wz+step);
      if(!world.isFloor(wx+step*1.5,wz+step*.5))edge(wx+step,wz+step,wx+step,wz);
      if(!world.isFloor(wx+step*.5,wz-step*.5))edge(wx+step,wz,wx,wz);
      if(!world.isFloor(wx+step*.5,wz+step*1.5))edge(wx,wz+step,wx+step,wz+step);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=createLivingMaterial('surface',world.seed);this.visibility.apply(material);
    this.surface=new THREE.Mesh(geometry,material);this.surface.receiveShadow=true;this.surface.castShadow=true;this.surface.frustumCulled=false;
    this.surface.name='actual-supported-fin-surface';this.group.add(this.surface);
    const wall=new THREE.BufferGeometry();wall.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3).setUsage(THREE.DynamicDrawUsage));
    wall.setAttribute('uv',new THREE.Float32BufferAttribute(sideUV,2));wall.setIndex(sideIndices);wall.computeVertexNormals();
    wall.setAttribute('livingEdgeDrop',new THREE.Float32BufferAttribute(this.sideDrop,1));
    const sideMaterial=createLivingMaterial('edge',world.seed+31);sideMaterial.side=THREE.DoubleSide;this.visibility.apply(sideMaterial);
    const compile=sideMaterial.onBeforeCompile,cacheKey=sideMaterial.customProgramCacheKey;
    sideMaterial.onBeforeCompile=(shader,renderer)=>{
      compile.call(sideMaterial,shader,renderer);
      // The inherited terrain-memory breakup is planar. Applying that same
      // XZ decision through a whole side face cuts it into vertical comb teeth.
      // Keep R/G eligibility and lighting, but let this descending face own
      // its three-dimensional edge breakup below.
      shader.fragmentShader=shader.fragmentShader.replace('if(.36+.64*max(adjacent,awareness) < grain*.68)discard;','');
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float livingEdgeDrop; varying float livingDrop;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nlivingDrop=livingEdgeDrop;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float livingDrop;')
        .replace('#include <opaque_fragment>',`float edgeLoss=1.-smoothstep(12.,43.,livingDrop);
          // Include descent in the breakup: a world-XZ-only threshold leaves
          // long comb teeth down every otherwise continuous vertical section.
          vec3 edgeCell=floor(vec3(stageWorld.x,livingDrop,stageWorld.z)/3.);
          float edgeGrain=fract(sin(dot(edgeCell,vec3(127.1,83.17,311.7)))*43758.5453);
          if(edgeLoss<edgeGrain*.9)discard;
          outgoingLight*=mix(.25,1.,edgeLoss);
          #include <opaque_fragment>`);
    };
    sideMaterial.customProgramCacheKey=()=>`${cacheKey.call(sideMaterial)}|living-tapered-edge`;
    this.sides=new THREE.Mesh(wall,sideMaterial);this.sides.castShadow=true;this.sides.receiveShadow=true;this.sides.frustumCulled=false;this.group.add(this.sides);
    this.buildSeam();this.buildKnot();
    const exitPoint=world.layout.extractionPoint.position;
    this.visibility.apply(this.exitMaterial,exitPoint);
    for(let i=0;i<6;i++){
      const mark=new THREE.Mesh(new THREE.BoxGeometry(2.2,1,5+noise(i,1)*5),this.exitMaterial);
      mark.position.set(-12+i*4,1.1,Math.sin(i*.8)*3);mark.rotation.y=-.3+noise(i,2)*.6;this.exit.add(mark);
    }
    this.exit.name='arrival-scars';this.group.add(this.exit);this.update(0,false);
  }

  private buildSeam():void{
    const outline=this.world.readTensionView().outline;
    const north=Math.min(...outline.map(p=>p.y)),south=Math.max(...outline.map(p=>p.y));
    const bounds=(z:number):[number,number]=>{
      const cuts:number[]=[];
      for(let i=0;i<outline.length;i++){
        const a=outline[i]!,b=outline[(i+1)%outline.length]!;
        if(a.y===b.y){if(z===a.y)cuts.push(a.x,b.x);continue;}
        if(z>=Math.min(a.y,b.y)&&z<=Math.max(a.y,b.y))cuts.push(a.x+(b.x-a.x)*(z-a.y)/(b.y-a.y));
      }
      return[Math.min(...cuts),Math.max(...cuts)];
    };
    // Two broad overlapping edges follow the authored six-point contact area.
    // Their fixed roots sit on the real support; only the free lips curl.
    for(let layer=0;layer<2;layer++){
      const points:number[]=[],uv:number[]=[],index:number[]=[],lift:number[]=[];
      const columns=16,rows=8;
      const start=layer===0?north:north+(south-north)*.42;
      const end=layer===0?north+(south-north)*.6:south;
      for(let z=0;z<=rows;z++)for(let x=0;x<=columns;x++){
        const u=x/columns,v=z/rows;
        const wz=start+(end-start)*v,[left,right]=bounds(wz),wx=left+(right-left)*u;
        const curl=(layer===0?v:1-v)**2*Math.sin(u*Math.PI);
        points.push(wx,this.world.groundHeightAt(wx,wz)+.4+curl,wz);lift.push(curl);
        uv.push(wx/256,wz/256+layer*.18);
        if(z&&x){const a=(z-1)*(columns+1)+x-1,b=z*(columns+1)+x-1;index.push(a,b,a+1,a+1,b,b+1);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();
      const m=createLivingMaterial('surface',this.world.seed+100+layer);m.side=THREE.DoubleSide;
      this.visibility.apply(m,undefined,false,undefined,true);
      const fold=new THREE.Mesh(g,m);fold.castShadow=true;fold.receiveShadow=true;fold.frustumCulled=false;
      fold.name=`overlapping-pressure-edge-${layer}`;this.folds.push(fold);this.foldLift.push(lift);this.group.add(fold);
    }
  }

  private buildKnot():void{
    const p=this.world.tension.definition.position;
    this.visibility.apply(this.knotMaterial,p);
    const matte=createLivingMaterial('fibre',this.world.seed+331);this.visibility.apply(matte,p);
    for(let i=0;i<5;i++){
      const mesh=new THREE.Mesh(new THREE.TorusGeometry(7+i*.35,1.4,3,12,Math.PI*1.55),i===2?this.knotMaterial:matte);
      mesh.rotation.set(Math.PI/2+.15*i,.15*i,i*.6);mesh.position.set((i-2)*1.8,2+i*.8,0);mesh.scale.set(1,.6,1);
      this.knot.add(mesh);
    }
    this.knot.name='bound-fibre-contact';this.group.add(this.knot);
  }

  update(elapsedMs:number,exitInRange:boolean):void{
    if(this.disposed)return;
    this.visibility.update(elapsedMs);
    const view=this.world.readTensionView(),heightPose=view.tension;
    if(heightPose!==this.lastHeightPose){
      this.lastHeightPose=heightPose;
      const position=this.surface.geometry.getAttribute('position') as THREE.BufferAttribute,heights=this.world.readSupportHeights();
      for(let i=0;i<position.count;i++)position.setY(i,heights[i]!);
      position.needsUpdate=true;this.surface.geometry.computeVertexNormals();
      const sides=this.sides.geometry.getAttribute('position') as THREE.BufferAttribute;
      for(let i=0;i<sides.count;i++)sides.setY(i,this.world.groundHeightAt(this.sideAnchors[i*2]!,this.sideAnchors[i*2+1]!)-this.sideDrop[i]!);
      sides.needsUpdate=true;this.sides.geometry.computeVertexNormals();
    }
    for(let i=0;i<this.folds.length;i++){
      const fold=this.folds[i]!,t=view.tension;
      const positions=fold.geometry.getAttribute('position') as THREE.BufferAttribute;
      for(let vertex=0;vertex<positions.count;vertex++)positions.setY(vertex,
        this.world.groundHeightAt(positions.getX(vertex),positions.getZ(vertex))+.4+this.foldLift[i]![vertex]!*(1+t*7));
      positions.needsUpdate=true;fold.geometry.computeVertexNormals();
    }
    const knot=view.position,age=view.hitAtMs===null?Infinity:elapsedMs-view.hitAtMs;
    this.knot.position.set(knot.x,this.world.groundHeightAt(knot.x,knot.y)+2,knot.y);
    this.knot.rotation.z=view.reliefProgress*.1;
    this.knot.scale.x=1+view.reliefProgress*.35;
    if(age>=0&&age<200)this.knot.position.y+=Math.sin(age/200*Math.PI)*2;
    this.knotMaterial.color.setHex(view.canHit?0x5d8179:0x354c4c);
    const exit=this.world.layout.extractionPoint.position;
    this.exit.position.set(exit.x,this.world.groundHeightAt(exit.x,exit.y),exit.y);
    this.exitMaterial.color.setHex(exitInRange?0xa19279:0x827564);
  }

  snapshot():Record<string,unknown>{return{surface:'same 8px authoritative triangular support lattice',dynamicXY:false,
    vertices:this.surface.geometry.getAttribute('position').count,triangles:this.surface.geometry.index!.count/3,
    pose:this.lastHeightPose,sideVertices:this.sideDrop.length,exit:this.exit.position.toArray(),
    knot:this.knot.position.toArray(),folds:this.folds.map(f=>({position:f.position.toArray(),rotation:f.rotation.x}))};}

  destroy():void{if(this.disposed)return;this.disposed=true;this.visibility.destroy();}
}
