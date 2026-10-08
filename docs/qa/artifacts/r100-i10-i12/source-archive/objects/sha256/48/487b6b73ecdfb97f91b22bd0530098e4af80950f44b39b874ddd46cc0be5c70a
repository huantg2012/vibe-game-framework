import * as THREE from 'three';
import { disposeTree, noise } from '../spatial-study/stage/materials';
import { vistaMotion } from './vista-motion';
import { createVistaMaterial, setVistaMaterialDistance } from './vista-material';

interface RibStation { x: number; z: number; height: number; width: number; thickness: number }

/** Mid-distance landforms provide actual occlusion and thickness between the
 * walkable terrace and the painted far world. They never grant walking space. */
export class VistaScenery {
  readonly group = new THREE.Group();
  private readonly rockMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly mistMaterials: THREE.ShaderMaterial[] = [];
  private disposed = false;

  private bearing!: THREE.Mesh;
  private response!: THREE.Mesh;
  private middle!: THREE.Mesh;
  private readonly deformations: { mesh: THREE.Mesh; rest: Float32Array; weights: Float32Array; role: 'load' | 'response'; amplitude: number }[] = [];
  private panorama: THREE.Mesh | null = null;
  private motion = vistaMotion(0);
  private reducedMotion = false;

  constructor() {
    this.group.name = 'vista-middle-distance';
    this.addRidge('western-mineralized-flank', [
      {x:410,z:1370,height:-78,width:230,thickness:230},
      {x:255,z:1365,height:-155,width:240,thickness:205},
      {x:-170,z:910,height:-330,width:130,thickness:190},
      {x:-430,z:350,height:-430,width:195,thickness:240},
      {x:-900,z:-450,height:-790,width:230,thickness:280},
      {x:-1400,z:-2700,height:-1790,width:340,thickness:300},
    ],0xcebaaa,.7);
    this.bearing = this.addRidge('deep-bearing-body', [
      {x:750,z:930,height:-40,width:260,thickness:240},
      {x:980,z:965,height:-150,width:150,thickness:200},
      {x:815,z:815,height:-265,width:120,thickness:180},
      {x:1090,z:480,height:-390,width:100,thickness:170},
      {x:1100,z:140,height:-470,width:140,thickness:160},
    ],0xb9a7a3,.35);
    this.response = this.addRidge('delayed-load-lamella', [
      {x:1570,z:1180,height:-45,width:190,thickness:200},
      {x:1520,z:1000,height:-190,width:120,thickness:165},
      {x:1450,z:900,height:-270,width:85,thickness:130},
      {x:1510,z:610,height:-340,width:95,thickness:140},
    ],0xb2a0a3,.45);
    this.middle = new THREE.Mesh(new THREE.PlaneGeometry(2400,1600,48,32),
      new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,alphaTest:.05,toneMapped:false}));
    this.middle.name='middle-painted-cantilever';
    this.middle.position.set(-650,-1550,-2300);this.middle.rotation.x=-32*Math.PI/180;
    this.middle.renderOrder=-4;this.group.add(this.middle);
    this.registerDeformation(this.middle, 'load', 18, true);
    this.registerDeformation(this.bearing, 'load', 10, false);
    this.registerDeformation(this.response, 'response', 6, false);
    this.addMist(1100,-420,500,3700,360,.11,0);
    this.addMist(800,-740,-900,6000,760,.14,9.4);
  }

  /** Infinity backdrop: reduce only this layer's contrast/chroma, preserving
   * painted edges. No screen-space blur or effect on the player and terrain. */
  setPanoramaTexture(texture: THREE.Texture): void {
    if(this.disposed){texture.dispose();return;}
    if(this.panorama) throw new Error('Panorama already installed');
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.needsUpdate=true;
    const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
      toneMapped:false,uniforms:{map:{value:texture},air:{value:new THREE.Color(0x4c4653)}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}',
      fragmentShader:`uniform sampler2D map;uniform vec3 air;varying vec2 vUv;
        void main(){vec3 c=texture2D(map,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
          c=mix(vec3(l),c,.92);c=mix(c,air,.10);gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    this.panorama=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
    this.panorama.name='infinite-painted-world';this.panorama.frustumCulled=false;
    this.panorama.renderOrder=-100;this.group.add(this.panorama);
  }

  setMiddleTexture(texture:THREE.Texture):void {
    if(this.disposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.needsUpdate=true;
    const material=this.middle.material as THREE.MeshBasicMaterial;
    material.map?.dispose();material.map=texture;
    material.onBeforeCompile=shader=>{
      shader.uniforms.middleAir={value:new THREE.Color(0x625c6d)};
      shader.fragmentShader='uniform vec3 middleAir;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n diffuseColor.a=smoothstep(.50,.90,diffuseColor.a); diffuseColor.rgb=mix(diffuseColor.rgb,middleAir,.30);');
    };
    material.customProgramCacheKey=()=> 'r8-middle-painted-air';material.needsUpdate=true;
  }

  update(elapsedMs: number, reducedMotion: boolean): void {
    this.reducedMotion=reducedMotion;
    this.motion=vistaMotion(reducedMotion?0:elapsedMs*.001);
    for(const deform of this.deformations){
      const positions=deform.mesh.geometry.getAttribute('position');
      const amount=this.motion[deform.role]*deform.amplitude;
      for(let i=0;i<positions.count;i++){
        positions.setY(i,deform.rest[i*3+1]!+deform.weights[i]!*amount);
      }
      positions.needsUpdate=true;
      // Small slow displacements retain the authored face normals: updating
      // them each frame would produce shimmering highlights on the lamellae.
    }
    for(const material of this.mistMaterials) material.uniforms.time!.value=reducedMotion?0:elapsedMs*.001;
  }

  snapshot(): Record<string,unknown> {
    return {landforms:3,paintedLayers:1,atmosphereLayers:2,collision:false,
      distanceRoles:['distant painted silhouettes','painted middle cantilever','lower bearing roots','walkable landform'],
      motion:{...this.motion},reducedMotion:this.reducedMotion,
      transforms:{bearing:this.bearing.position.toArray(),response:this.response.position.toArray(),
        middle:this.middle.position.toArray()},
      deformation:this.deformations.map(d=>{
        let max=0,anchorIndex=0,flexIndex=0;
        for(let i=0;i<d.weights.length;i++){if(d.weights[i]!>max){max=d.weights[i]!;flexIndex=i;}if(d.weights[i]===0)anchorIndex=i;}
        const p=d.mesh.geometry.getAttribute('position');
        return {name:d.mesh.name,role:d.role,phase:this.motion[d.role],
          anchor:{index:anchorIndex,restY:d.rest[anchorIndex*3+1],y:p.getY(anchorIndex)},
          flex:{index:flexIndex,restY:d.rest[flexIndex*3+1],y:p.getY(flexIndex)},
          maxDisplacement:max*this.motion[d.role]*d.amplitude};
      }),
      middlePainting:{loaded:!!(this.middle.material as THREE.MeshBasicMaterial).map,width:2400,height:1600,airMix:.30,sourceWidth:1536},
      panorama:{airMix:.10,chroma:.92,sourceWidth:1536,filter:'linear mipmapped; simplified gouache silhouettes'},
      relation:'continuous natural landform with a unique painted atlas and depth-sorted painted forms; world-fixed middle painting recedes into gouache silhouettes; route graph never generates the land; scenic roots grant no support',
      animation:'26-second locally anchored bending; response delayed 1.4 seconds; walkable terrain remains static'};
  }

  destroy(): void {
    if(this.disposed)return;
    this.disposed=true;
    // disposeTree owns ordinary material.map textures; this map is a shader uniform.
    if(this.panorama)(this.panorama.material as THREE.ShaderMaterial).uniforms.map!.value.dispose();
    disposeTree(this.group);
    this.deformations.length=0;
  }

  private registerDeformation(mesh:THREE.Mesh,role:'load'|'response',amplitude:number,painting:boolean):void {
    const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
    const rest=new Float32Array(p.array),weights=new Float32Array(p.count);
    for(let i=0;i<p.count;i++){
      const t=painting?uv.getY(i):uv.getX(i)/6.5;
      weights[i]=painting?THREE.MathUtils.smoothstep(t,.14,.85)*THREE.MathUtils.smoothstep(uv.getX(i),.06,.6)
        : (t<.06||t>.94?0:Math.pow(Math.sin((t-.06)/.88*Math.PI),2));
    }
    mesh.geometry.computeBoundingSphere();
    if(mesh.geometry.boundingSphere)mesh.geometry.boundingSphere.radius+=amplitude;
    this.deformations.push({mesh,rest,weights,role,amplitude});
  }

  private addRidge(name: string, stations: RibStation[], pigment: number, lightStrength: number): THREE.Mesh {
    const center=new THREE.CatmullRomCurve3(stations.map(s=>new THREE.Vector3(s.x,s.height,s.z)));
    const profile = [
      [.52,.00],[.49,.055],[.27,.08],[-.08,.18],[-.38,.16],[-.56,.045],
      [-.46,-.08],[-.50,-.15],[-.31,-.28],[-.36,-.36],[-.12,-.60],
      [.02,-.92],[.15,-.51],[.31,-.37],[.26,-.20],[.43,-.12],[.52,.00],
    ] as const;
    const rows=90, sides=profile.length-1, vertices:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
    const color=new THREE.Color(pigment);
    for(let row=0;row<=rows;row++) {
      const t=row/rows,p=center.getPoint(t),direction=center.getTangent(t);
      const side=new THREE.Vector3(-direction.z,0,direction.x).normalize();
      const f=t*(stations.length-1),at=Math.min(stations.length-2,Math.floor(f)),fraction=f-at;
      const a=stations[at]!,b=stations[at+1]!;
      const width=THREE.MathUtils.lerp(a.width,b.width,fraction),depth=THREE.MathUtils.lerp(a.thickness,b.thickness,fraction);
      for(let col=0;col<=sides;col++) {
        const [across,level]=profile[col]!;
        const root=THREE.MathUtils.smoothstep(t,0,.12),tip=1-THREE.MathUtils.smoothstep(t,.88,1);
        const taper=.14+.86*Math.min(root,tip);
        const ring=1+.07*Math.sin(t*13+.7)+.025*Math.sin(t*33+across*5);
        const top=level>=0;
        const height=level*(top?width:depth)*taper;
        const fold=Math.sin(t*8+across*1.7)*width*.035;
        vertices.push(p.x+side.x*width*across*ring*taper,p.y+height+fold,p.z+side.z*width*across*ring*taper);
        uvs.push(t*6.5,col/sides*1.6);
        const shade=top?.94+.04*noise(col,Math.floor(row/7),112):.73+.07*noise(col,Math.floor(row/6),112);
        colors.push(color.r*shade,color.g*shade,color.b*shade);
        if(row<rows&&col<sides){const q=row*(sides+1)+col,r=q+sides+1;indices.push(q,r,q+1,q+1,r,r+1);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();
    const m=createVistaMaterial('rock');m.side=THREE.DoubleSide;
    setVistaMaterialDistance(m,(1-lightStrength)*.18);
    this.rockMaterials.push(m);const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=true;
    this.group.add(mesh);return mesh;
  }

  private addMist(x:number,height:number,z:number,width:number,tall:number,opacity:number,phase:number):void {
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
      uniforms:{time:{value:0},phase:{value:phase},strength:{value:opacity},tint:{value:new THREE.Color(0x4b4152)}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float time,phase,strength;uniform vec3 tint;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float field(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){float haze=field(vUv*vec2(7.,3.)+vec2(time*.018+phase,time*.006));
          float edge=pow(sin(vUv.y*3.14159265),1.5)*smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x);
          gl_FragColor=vec4(tint,strength*edge*(.4+.6*haze));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    this.mistMaterials.push(material);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,tall),material);
    mesh.position.set(x,height,z);mesh.rotation.x=-32*Math.PI/180;mesh.renderOrder=3;this.group.add(mesh);
  }
}
