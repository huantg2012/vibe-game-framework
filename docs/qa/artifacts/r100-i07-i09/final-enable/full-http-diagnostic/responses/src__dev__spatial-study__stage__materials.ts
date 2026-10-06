import * as THREE from 'three';

export const STAGE_WIDTH = 960;
export const STAGE_HEIGHT = 640;
export const ACTOR_HEIGHT = 42;

export function noise(x: number, y: number, seed = 0): number {
  let n = Math.imul(Math.floor(x) ^ seed, 374761393) ^ Math.imul(Math.floor(y), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Authored-sized pigment clusters. Marks share broad material directions;
 * individual bright pixels are reserved for the ends of broken ridges. */
export function surfaceTexture(base: number, seed: number, kind: 'stone' | 'cloth' | 'shell'): THREE.DataTexture {
  const side = 64, bytes = new Uint8Array(side * side * 4), color = new THREE.Color(base);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const at = (y * side + x) * 4;
    const row = y + Math.floor(Math.sin(x / 17) * 3);
    const patch = noise(Math.floor((x + Math.floor(y / 11) * 3) / 7), Math.floor(row / 5), seed + 4);
    const broken = noise(Math.floor(x / 3), Math.floor(y / 2), seed + 17);
    const darkSeam = kind === 'cloth' ? ((x === 8 || x === 39) && y % 9 < 6)
      : kind === 'shell' ? ((x + Math.floor(y / 4)) % 27 < 2 && broken > .32)
        : (row % 19 < 2 && patch > .28);
    let shade = patch < .17 ? .62 : patch < .48 ? .82 : patch < .88 ? 1 : 1.18;
    if (darkSeam) shade = .43;
    else if (kind === 'stone' && row % 19 === 3 && broken > .55) shade = 1.31;
    bytes[at] = Math.min(255, color.r * shade * 255);
    bytes[at + 1] = Math.min(255, color.g * shade * 255);
    bytes[at + 2] = Math.min(255, color.b * shade * 255); bytes[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, side, side);
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

/** Exposed vertical rock: quiet pigment planes and a few irregular descending
 * fractures. Kept separate from the bedded stone used by walkable ground. */
export function sectionTexture(base: number, seed: number): THREE.DataTexture {
  const side = 64, bytes = new Uint8Array(side * side * 4), color = new THREE.Color(base);
  const pigment = color.r * .2126 + color.g * .7152 + color.b * .0722;
  color.setRGB(pigment * 1.035, pigment, pigment * .94);
  const paint = (x: number, y: number, shade: number): void => {
    const at = (((y + side) % side) * side + (x + side) % side) * 4;
    bytes[at] = Math.min(255, color.r * shade * 255);
    bytes[at + 1] = Math.min(255, color.g * shade * 255);
    bytes[at + 2] = Math.min(255, color.b * shade * 255); bytes[at + 3] = 255;
  };
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const plane = noise(Math.floor((x + Math.sin(y / 23) * 2) / 13), Math.floor(y / 29), seed + 3);
    paint(x, y, plane < .2 ? .80 : plane < .75 ? .91 : 1.02);
  }
  for (let scar = 0; scar < 7; scar++) {
    const startX = Math.floor(noise(scar, 0, seed + 31) * side);
    const startY = Math.floor(noise(scar, 1, seed + 31) * side);
    const length = 9 + Math.floor(noise(scar, 2, seed + 31) * 29);
    const lean = (noise(scar, 3, seed + 31) - .5) * .42;
    for (let step = 0; step < length; step++) {
      if (noise(scar, Math.floor(step / 3), seed + 67) > .91) continue;
      const bend = Math.floor((noise(scar, Math.floor(step / 7), seed + 43) - .5) * 3);
      const x = startX + Math.round(step * lean) + bend, y = startY + step;
      paint(x, y, step < 3 || step > length - 4 ? .65 : .46);
      if (step > 5 && step < length - 6 && scar % 3 === 0) paint(x + 1, y, .70);
    }
  }
  const texture = new THREE.DataTexture(bytes, side, side);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

export function roughMaterial(color: number, texture?: THREE.Texture): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: texture ? 0xffffff : color, map: texture ?? null,
    roughness: 1, metalness: 0 });
  // Geometry still supplies real light and shadow. The material interprets it
  // as broad pigment values rather than a continuously shaded plastic surface.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float pigmentBase=max(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.001);
      float pigmentLum=max(dot(outgoingLight,vec3(.2126,.7152,.0722)),.0001);
      float pigmentLight=pigmentLum/pigmentBase;
      float pigmentBand=max(.055,floor(pigmentLight*3.+.35)/3.);
      outgoingLight*=pigmentBand/max(pigmentLight,.0001);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'stage-pigment-clusters-r4';
  return material;
}

export function ellipsoid(width: number, height: number, depth: number, material: THREE.Material,
  segments = 12): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 8), material);
  mesh.scale.set(width, height, depth); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

/** A continuously shaded irregular ring extrusion. Topology, not polygon face tint, makes the form. */
export function ringBody(rings: readonly { y: number; x: number; z: number; dx?: number; dz?: number }[],
  sides = 12): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]!;
    for (let i = 0; i <= sides; i++) {
      const angle = i / sides * Math.PI * 2;
      positions.push((ring.dx ?? 0) + Math.sin(angle) * ring.x, ring.y,
        (ring.dz ?? 0) + Math.cos(angle) * ring.z);
      uvs.push(i / sides, r / (rings.length - 1));
      if (r && i) { const a = (r - 1) * (sides + 1) + i - 1, b = r * (sides + 1) + i - 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

const up = new THREE.Vector3(0, 1, 0), difference = new THREE.Vector3();
export function alignBone(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, radius: number): void {
  difference.subVectors(to, from);
  mesh.position.copy(from).addScaledVector(difference, .5);
  mesh.scale.set(radius, difference.length(), radius);
  mesh.quaternion.setFromUnitVectors(up, difference.normalize());
}

export function bone(material: THREE.Material, sides = 7): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, .85, 1, sides), material);
  mesh.castShadow = true; return mesh;
}

/** Dispose shared resources exactly once after the owning stage has stopped. */
export function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      const map = (material as THREE.MeshStandardMaterial).map; if (map) textures.add(map);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
