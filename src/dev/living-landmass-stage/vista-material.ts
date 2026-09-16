import * as THREE from 'three';

export type VistaMaterialRole = 'ground' | 'rock' | 'cliff';

const PALETTES = {
  ground: [0x4c3e48, 0x856a56, 0xb29a73],
  rock: [0x453e50, 0x7b6664, 0xb29d7d],
  cliff: [0x393845, 0x625b66, 0x938276],
} as const;

/** A unique ground painting and a separate cut-face painting share quiet
 * normal-based shading. Pigment palettes remain the unloaded fallback. */
export function createVistaMaterial(role: VistaMaterialRole, _legacyMap: THREE.Texture | null = null): THREE.MeshStandardMaterial {
  _legacyMap?.dispose();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1,
    metalness: 0, vertexColors: true, toneMapped: false });
  const palette = PALETTES[role];
  const air = { value: 0 };
  material.userData.vistaAir = air;
  const atlasBounds = { value: new THREE.Vector4(0,0,1,1) };
  material.userData.vistaAtlasBounds = atlasBounds;
  const cutface = { value: null as THREE.Texture | null }, hasCutface = { value: 0 };
  material.userData.vistaCutface = cutface;
  material.userData.vistaHasCutface = hasCutface;
  material.name = `vista-${role}-r8-painted`;
  material.onBeforeCompile = shader => {
    const ground = role === 'ground';
    shader.uniforms.vistaShade = { value: new THREE.Color(palette[0]) };
    shader.uniforms.vistaBody = { value: new THREE.Color(palette[1]) };
    shader.uniforms.vistaLight = { value: new THREE.Color(palette[2]) };
    shader.uniforms.vistaAir = air;
    shader.uniforms.vistaAtlasBounds = atlasBounds;
    shader.uniforms.vistaCutface = cutface;
    shader.uniforms.vistaHasCutface = hasCutface;
    shader.uniforms.vistaAirColor = { value: new THREE.Color(0x696372) };
    shader.vertexShader = `varying vec3 vVistaPosition; varying vec2 vVistaUv;
      ${ground ? 'attribute vec3 vistaStrata; varying vec3 vVistaStrata;' : ''}
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\nvVistaPosition=position; vVistaUv=uv; ${ground ? 'vVistaStrata=vistaStrata;' : ''}`);
    shader.fragmentShader = `uniform vec3 vistaShade,vistaBody,vistaLight,vistaAirColor;
      uniform float vistaAir,vistaHasCutface; uniform sampler2D vistaCutface;
      uniform vec4 vistaAtlasBounds; varying vec3 vVistaPosition; varying vec2 vVistaUv;
      ${ground ? 'varying vec3 vVistaStrata;' : ''}
    ` + shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '// Authored pigment maps are sampled once below.');
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 worldNormal = normalize(inverseTransformDirection(normal, viewMatrix));
      float formLight = dot(worldNormal, normalize(vec3(-.46,.78,.42)));
      vec3 pigment = mix(vistaShade, vistaBody, smoothstep(-.25,.38,formLight));
      pigment = mix(pigment, vistaLight, smoothstep(.72,.97,formLight)*.84);
      ${ground ? `
        float elevation = smoothstep(12.,106.,vVistaPosition.y);
        vec3 bedPigment = mix(vistaShade*1.12,vistaBody,elevation*.76+.24);
        pigment = mix(bedPigment,vistaLight,smoothstep(.63,.98,formLight)*.42);
        // The mask comes from an authored slope/basin, never from a path graph.
        float lee = smoothstep(.12,.78,vVistaStrata.y);
        float exposed = smoothstep(.3,.92,vVistaStrata.x);
        pigment = mix(pigment,pigment*vec3(1.10,.98,.86),lee*.42);
        pigment = mix(pigment,pigment*vec3(.94,.97,1.06),exposed*.34);
        // Broad translucent pigment washes; no fine tiled noise or fake relief.
        float wash = sin(vVistaPosition.x*.005+vVistaPosition.z*.002)
          * sin(vVistaPosition.z*.007-vVistaPosition.x*.0015);
        pigment *= 1. + wash*.035;
        #ifdef USE_MAP
          vec2 atlasUv=clamp((vVistaPosition.xz-vistaAtlasBounds.xy)/vistaAtlasBounds.zw,0.,1.);
          atlasUv.y=1.-atlasUv.y;
          vec3 atlas=texture2D(map,atlasUv).rgb;
          pigment=atlas*(.84+.12*smoothstep(.35,.94,formLight));
        #endif
      ` : `
        // Local, interrupted lamina accents. Large faces remain quiet and the
        // actual silhouette / folded cross-section does the descriptive work.
        float bedding = vVistaUv.y*2.6+sin(vVistaUv.x*2.3)*.12;
        float cut = 1.-smoothstep(.014,.040,abs(fract(bedding)-.5));
        float broken = smoothstep(.1,.5,sin(vVistaUv.x*4.9+vVistaUv.y*1.2));
        pigment *= 1.-cut*broken*.13;
        if (vistaHasCutface > .5) {
          vec2 cutUv = ${role === 'cliff' ? 'vec2(vVistaUv.x,clamp(vVistaUv.y,0.,1.))' : 'vec2(vVistaUv.x,.48+vVistaUv.y*.8)'};
          pigment = texture2D(vistaCutface,cutUv).rgb * (.82+.15*smoothstep(-.4,.9,formLight));
        }
      `}
      float baseLuma = max(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.01);
      float physicalLight = dot(outgoingLight,vec3(.2126,.7152,.0722))/baseLuma;
      // Retain cast/contact shadows without crushing the authored violet shade.
      pigment *= .78+.22*smoothstep(.12,.75,physicalLight);
      pigment *= mix(vec3(1.),diffuseColor.rgb,.18);
      outgoingLight = mix(pigment,vistaAirColor,vistaAir);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => `vista-${role}-painted-volume-r8`;
  return material;
}

/** Borrowed reference: the model's rock material owns this distinct cut-face
 * texture. Cliff material must not dispose it independently. */
export function setVistaRockSampler(material: THREE.MeshStandardMaterial, texture: THREE.Texture): void {
  (material.userData.vistaCutface as {value:THREE.Texture|null}).value = texture;
  (material.userData.vistaHasCutface as {value:number}).value = 1;
}

export function setVistaMaterialDistance(material: THREE.MeshStandardMaterial, amount: number): void {
  (material.userData.vistaAir as { value: number }).value = THREE.MathUtils.clamp(amount, 0, 1);
}

export function setVistaAtlasBounds(material: THREE.MeshStandardMaterial, bounds: THREE.Box3): void {
  (material.userData.vistaAtlasBounds as {value:THREE.Vector4}).value.set(
    bounds.min.x,bounds.min.z,bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z);
}
