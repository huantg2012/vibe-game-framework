import * as THREE from 'three';
import { roughMaterial } from '../spatial-study/stage/materials';

export const LIVING_LIGHTING = {
  sky: 0xb1aaa5,
  bounce: 0x42434e,
  key: 0xc8b79f,
  rim: 0x89969f,
  absence: 0x080b0f,
  exposure: 1.05,
} as const;

export type LivingMaterialKind = 'surface' | 'edge' | 'body' | 'fibre' | 'distant';

const PIGMENTS: Record<LivingMaterialKind, readonly [number, number, number, number]> = {
  surface: [0x4d4447, 0x5c5051, 0x695d58, 0x817361],
  edge: [0x302a32, 0x40363e, 0x50424b, 0x695950],
  body: [0x3b3439, 0x494044, 0x554a4b, 0x64584f],
  fibre: [0x4a3c40, 0x66564e, 0x81705d, 0xa19279],
  distant: [0x262a30, 0x2c3037, 0x34383e, 0x3c3f44],
};

/** Stable broad pigment placement, independent of the gameplay random stream. */
function grain(x: number, y: number, seed: number): number {
  let value = Math.imul(x ^ seed, 73856093) ^ Math.imul(y, 19349663);
  value = Math.imul(value ^ (value >>> 16), 83492791);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

/** 256 world units per UV repeat gives two world units per texel. The marks
 * themselves occupy several texels: long dry flakes, never individual noise. */
function makePigment(kind: LivingMaterialKind, seed: number): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const palette = PIGMENTS[kind];
  const write = (x: number, y: number, tone: number): void => {
    const color = palette[tone]!;
    const at = (((y % size + size) % size) * size + (x % size + size) % size) * 4;
    pixels[at] = (color >>> 16) & 255;
    pixels[at + 1] = (color >>> 8) & 255;
    pixels[at + 2] = color & 255;
    pixels[at + 3] = 255;
  };
  // Pigment is a connected matte field. Discontinuous, tapered growth flakes
  // sit inside it; a grid of individually coloured cells never controls a face.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) write(x, y, 1);
  const alongU = kind === 'body' || kind === 'distant';
  const count = { surface: 76, edge: 66, body: 38, fibre: 106, distant: 20 }[kind];
  for (let flake = 0; flake < count; flake++) {
    const startX = Math.floor(grain(flake, 1, seed) * size);
    const startY = Math.floor(grain(flake, 2, seed) * size);
    const length = 8 + Math.floor(grain(flake, 3, seed) * (kind === 'fibre' ? 38 : 23));
    const width = 1 + Math.floor(grain(flake, 4, seed) * 3);
    const lean = (grain(flake, 5, seed) - .38) * .3;
    const quietBody = kind === 'body' || kind === 'distant';
    const tone = !quietBody && flake % 11 === 0 ? 3 : flake % (quietBody ? 5 : 3) === 0 ? 0 : 2;
    for (let step = 0; step < length; step++) {
      const u = step / length;
      const bend = Math.round(step * lean + Math.sin(u * Math.PI * 1.4 + flake) * 1.6);
      const taper = Math.max(1, Math.round(width * Math.sin(u * Math.PI) ** .45));
      for (let across = -taper; across <= taper; across++) {
        const x = alongU ? startX + step : startX + bend + across;
        const y = alongU ? startY + bend + across : startY + step;
        write(x, y, tone);
      }
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = `living:${kind}:dry-lamina:${seed}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** A factory owns its materials and reuses them across its meshes. No global
 * GPU cache outlives a stage or gets disposed by a different live stage. */
export function createLivingMaterial(kind: LivingMaterialKind, seed: number): THREE.MeshStandardMaterial {
  const material = roughMaterial(0xffffff, makePigment(kind, seed));
  material.name = `living:${kind}`;
  material.side = THREE.DoubleSide;
  // These are huge dry bodies in ambient depth, not black silhouette masks.
  // Surface navigation retains normal light; only bearing anatomy receives a
  // controlled material floor. Current-sight clipping is composed afterwards.
  const floor = { surface: .14, edge: .29, body: .48, fibre: .57, distant: .60 }[kind];
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float livingFacing=max(0.,dot(normal,normalize(vec3(-.48,.72,.5))));
      float livingBounce=${kind === 'body' || kind === 'distant' ? '.42+.58*livingFacing' : '1.'};
      outgoingLight=max(outgoingLight,diffuseColor.rgb*${floor.toFixed(3)}*livingBounce);
      ${kind === 'distant' ? 'outgoingLight*=.82;' : ''}
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `living-dry-lamina-r3:${kind}`;
  return material;
}
