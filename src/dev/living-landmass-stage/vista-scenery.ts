import * as THREE from 'three';
import { disposeTree, noise } from '../spatial-study/stage/materials';
import { vistaMotion } from './vista-motion';

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
  private painted: THREE.Mesh | null = null;
  private readonly deformations: { mesh: THREE.Mesh; rest: Float32Array; weights: Float32Array; role: 'load' | 'response'; amplitude: number }[] = [];
  private panorama: THREE.Mesh | null = null;
  private motion = vistaMotion(0);
  private reducedMotion = false;

  constructor() {
    this.group.name = 'vista-middle-distance';
    this.addRidge('western-mineralized-flank', [
      {x:-100,z:1840,height:-205,width:120,thickness:160},
      {x:-210,z:1370,height:-265,width:170,thickness:210},
      {x:-170,z:910,height:-330,width:130,thickness:190},
      {x:-430,z:350,height:-430,width:195,thickness:240},
      {x:-900,z:-450,height:-790,width:230,thickness:280},
      {x:-1400,z:-2700,height:-1790,width:340,thickness:300},
    ],0xb5a9a0,.7);
    this.bearing = this.addRidge('deep-bearing-body', [
      {x:520,z:1420,height:-320,width:100,thickness:120},
      {x:630,z:1110,height:-250,width:110,thickness:150},
      {x:880,z:810,height:-245,width:125,thickness:150},
      {x:1090,z:480,height:-390,width:100,thickness:170},
      {x:1100,z:140,height:-470,width:140,thickness:160},
    ],0xc2b1ac,.35);
    this.response = this.addRidge('delayed-load-lamella', [
      {x:1380,z:1570,height:-290,width:85,thickness:110},
      {x:1320,z:1220,height:-255,width:85,thickness:120},
      {x:1450,z:900,height:-270,width:85,thickness:130},
      {x:1510,z:610,height:-340,width:95,thickness:140},
    ],0xb9a8a5,.45);
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
      uniforms:{map:{value:texture},air:{value:new THREE.Color(0xb3a9b3)}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}',
      fragmentShader:`uniform sampler2D map;uniform vec3 air;varying vec2 vUv;
        void main(){vec3 c=texture2D(map,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
          c=mix(vec3(l),c,.86);c=mix(c,air,.17);gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    this.panorama=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
    this.panorama.name='infinite-painted-world';this.panorama.frustumCulled=false;
    this.panorama.renderOrder=-100;this.group.add(this.panorama);
  }

  /** Owns a world-fixed, gently curved cutout. Its diagonal silhouette leaves
   * air around the playable path while camera translation supplies parallax. */
  setDistantTexture(texture: THREE.Texture): void {
    if(this.disposed){texture.dispose();return;}
    if(this.painted) throw new Error('Distant painting already installed');
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.needsUpdate=true;
    const geometry=new THREE.PlaneGeometry(2500,1667,48,32);
    const positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i)/1250;
      positions.setZ(i,-65*x*x);
    }
    geometry.computeVertexNormals();
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,
      side:THREE.DoubleSide,toneMapped:true,alphaTest:.02,color:0xe7e0e5});
    // Generated alpha contains a broad low-opacity glow. Narrow only that
    // coverage range; keep the original bitmap and antialiased object edges.
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n diffuseColor.a = smoothstep(0.72, 0.97, diffuseColor.a);');
    };
    material.customProgramCacheKey=()=> 'vista-r5-painted-alpha';
    this.painted=new THREE.Mesh(geometry,material);
    this.painted.name='independent-painted-shell';this.painted.position.set(-650,-1250,-3000);
    this.painted.rotation.x=-24*Math.PI/180;
    this.painted.renderOrder=-5;this.group.add(this.painted);
    this.registerDeformation(this.painted, 'load', 18, true);
  }

  setSurfaceTexture(source: THREE.Texture): void {
    for (const material of this.rockMaterials) {
      const texture=source.clone();texture.repeat.set(1,1);texture.needsUpdate=true;
      material.map=texture;material.needsUpdate=true;
    }
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
    return {landforms:3,paintedLayers:this.painted?1:0,atmosphereLayers:2,collision:false,
      distanceRoles:['infinite panorama','fixed-world curved painting','real middle bearings','walkable terrain'],
      motion:{...this.motion},reducedMotion:this.reducedMotion,
      transforms:{bearing:this.bearing.position.toArray(),response:this.response.position.toArray(),
        painting:this.painted?.position.toArray()},
      deformation:this.deformations.map(d=>{
        let max=0,anchorIndex=0,flexIndex=0;
        for(let i=0;i<d.weights.length;i++){if(d.weights[i]!>max){max=d.weights[i]!;flexIndex=i;}if(d.weights[i]===0)anchorIndex=i;}
        const p=d.mesh.geometry.getAttribute('position');
        return {name:d.mesh.name,role:d.role,phase:this.motion[d.role],
          anchor:{index:anchorIndex,restY:d.rest[anchorIndex*3+1],y:p.getY(anchorIndex)},
          flex:{index:flexIndex,restY:d.rest[flexIndex*3+1],y:p.getY(flexIndex)},
          maxDisplacement:max*this.motion[d.role]*d.amplitude};
      }),
      painting:{width:2500,height:1667,sourceWidth:1536,filter:'linear mipmapped, native source; narrow alpha coverage',airMix:0},
      panorama:{airMix:.17,chroma:.86,filter:'linear mipmapped; no blur'},
      relation:'world-fixed far painting and deep bearings frame the mineralized walkable loop; background grants no support',
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
    const rows=70, sides=16, vertices:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
    const color=new THREE.Color(pigment);
    for(let row=0;row<=rows;row++) {
      const t=row/rows,p=center.getPoint(t),direction=center.getTangent(t);
      const side=new THREE.Vector3(-direction.z,0,direction.x).normalize();
      const f=t*(stations.length-1),at=Math.min(stations.length-2,Math.floor(f)),fraction=f-at;
      const a=stations[at]!,b=stations[at+1]!;
      const width=THREE.MathUtils.lerp(a.width,b.width,fraction),depth=THREE.MathUtils.lerp(a.thickness,b.thickness,fraction);
      for(let col=0;col<=sides;col++) {
        const angle=col/sides*Math.PI*2,across=Math.cos(angle);
        const ring=(1+.03*Math.sin(t*25+col*1.13)+.014*Math.sin(t*63+col*2.4));
        const top=Math.sin(angle)>=0;
        const height=top?Math.pow(Math.sin(angle),.7)*width*(.24+.055*Math.sin(t*18)):-Math.pow(-Math.sin(angle),.75)*depth;
        vertices.push(p.x+side.x*width*.5*across*ring,p.y+height,p.z+side.z*width*.5*across*ring);
        uvs.push(t*6.5,col/sides*1.6);
        const shade=top?.94+.04*noise(col,Math.floor(row/7),112):.73+.07*noise(col,Math.floor(row/6),112);
        colors.push(color.r*shade,color.g*shade,color.b*shade);
        if(row<rows&&col<sides){const q=row*(sides+1)+col,r=q+sides+1;indices.push(q,r,q+1,q+1,r,r+1);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,side:THREE.DoubleSide,
      emissive:0x887886,emissiveIntensity:(1-lightStrength)*.22});
    this.rockMaterials.push(m);const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=true;
    this.group.add(mesh);return mesh;
  }

  private addMist(x:number,height:number,z:number,width:number,tall:number,opacity:number,phase:number):void {
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
      uniforms:{time:{value:0},phase:{value:phase},strength:{value:opacity},tint:{value:new THREE.Color(0xb6a7b3)}},
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
