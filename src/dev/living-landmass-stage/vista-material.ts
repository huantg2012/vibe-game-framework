import * as THREE from 'three';

export type VistaMaterialRole = 'ground' | 'rock' | 'cliff';

/** Each physical substrate owns its scale and coverage. Generated images are
 * optional pigment inputs; none is a universal overlay for all three roles. */
export function createVistaMaterial(role: VistaMaterialRole, map: THREE.Texture | null = null): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 1, metalness: 0, vertexColors: true });
  const rockMap = { value: null as THREE.Texture | null }, hasRockMap = { value: 0 };
  material.userData.vistaRockMap = rockMap;
  material.userData.vistaHasRockMap = hasRockMap;
  material.name = `vista-${role}-r6`;
  material.onBeforeCompile = shader => {
    const ground = role === 'ground';
    shader.uniforms.vistaRockMap = rockMap; shader.uniforms.vistaHasRockMap = hasRockMap;
    shader.vertexShader = `varying vec3 vVistaPosition;\nvarying vec2 vVistaUv;\n${ground ? 'attribute vec3 vistaStrata; varying vec3 vVistaStrata; attribute vec2 vistaBedding; varying vec2 vVistaBedding;\n' : ''}` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\nvVistaPosition = position; vVistaUv = uv; ${ground ? 'vVistaStrata = vistaStrata; vVistaBedding = vistaBedding;' : ''}`);
    shader.fragmentShader = `uniform sampler2D vistaRockMap; uniform float vistaHasRockMap;\n varying vec3 vVistaPosition;\nvarying vec2 vVistaUv;\n${ground ? 'varying vec3 vVistaStrata; varying vec2 vVistaBedding;\n' : ''}` + shader.fragmentShader;
    const pigment = ground ? `
      vec3 sediment = vec3(.255,.226,.202);
      #ifdef USE_MAP
        sediment = texture2D(map,vMapUv).rgb;
      #endif
      float exposure = clamp(vVistaStrata.x,0.,1.);
      float deposit = clamp(vVistaStrata.y,0.,1.);
      float fracture = clamp(vVistaStrata.z,0.,1.);
      // Broad bare faces retain the body's weight. Fine material is deposited
      // in the actual lee and bowls sampled when the mesh was authored.
      vec3 shell = vec3(.35,.35,.368);
      float brush = sin(vVistaPosition.x*.009+vVistaPosition.z*.003)*.013;
      shell += brush;
      if(vistaHasRockMap>.5) shell=mix(shell,texture2D(vistaRockMap,vVistaBedding).rgb*vec3(.98,.99,1.035),.82);
      float bedding = vVistaPosition.y*.25 + vVistaPosition.x*.009 - vVistaPosition.z*.013;
      float seam = 1.-smoothstep(.025,.075,abs(fract(bedding)-.50));
      shell *= 1.-seam*fracture*.15;
      float coverage = clamp(.76+deposit*.24-exposure*.95,.015,.98);
      diffuseColor.rgb *= mix(shell,sediment,coverage);
    ` : role === 'rock' ? `
      vec3 body = vec3(.34,.318,.278);
      #ifdef USE_MAP
        // The hard-rock image uses local longitudinal/cross-section scale,
        // and never inherits the ground's world UV or its dense coverage.
        body = mix(body,texture2D(map,vMapUv).rgb,.45);
      #endif
      float lamina = vVistaUv.y*3. + vVistaUv.x*.23;
      float cut = 1.-smoothstep(.017,.043,abs(fract(lamina)-.5));
      float root = 1.-smoothstep(.0,.16,vVistaUv.y);
      body *= 1.-cut*.11*(1.-root);
      body = mix(body,vec3(.205,.182,.16),root*.4);
      diffuseColor.rgb *= body;
    ` : `
      // Section: broad mineral layers. No ground map, cross-section scale is
      // vertical and much coarser than the sparse grains of deposited pigment.
      float bed = vVistaPosition.y/43. + sin(vVistaPosition.x*.004-vVistaPosition.z*.002)*.42;
      float section = floor(fract(bed)*2.)/2.;
      float lamina = 1.-smoothstep(.022,.057,abs(fract(bed)-.5));
      vec3 cut = mix(vec3(.235,.23,.258),vec3(.30,.29,.32),section*.45);
      if(vistaHasRockMap>.5) cut=mix(cut,texture2D(vistaRockMap,vVistaUv*vec2(.67,.36)+vec2(.12,.25)).rgb*vec3(.85,.85,.97),.72);
      cut *= 1.-lamina*.08;
      diffuseColor.rgb *= cut;
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', pigment);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float paintBase = max(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.002);
      float paintLight = max(dot(outgoingLight,vec3(.2126,.7152,.0722)),.002)/paintBase;
      float paintStep = floor(paintLight*5.+.5)/5.;
      outgoingLight *= mix(paintLight,max(.08,paintStep),.22)/max(paintLight,.002);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `vista-${role}-stratified-paint-r6`;
  return material;
}

/** The rock material owns the image; these two substrate samplers borrow it.
 * No extra texture object or competing disposal ownership is introduced. */
export function setVistaRockSampler(material: THREE.MeshStandardMaterial, texture: THREE.Texture): void {
  (material.userData.vistaRockMap as { value: THREE.Texture | null }).value = texture;
  (material.userData.vistaHasRockMap as { value: number }).value = 1;
}
