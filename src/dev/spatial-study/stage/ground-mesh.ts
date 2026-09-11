import * as THREE from 'three';
import type { SpatialSliceWorld } from '../slice-world';
import { TileType } from '@/types/game-types';
import { noise } from './materials';

export interface StageGroundGeometry {
  surface: THREE.BufferGeometry;
  edge: THREE.BufferGeometry;
}

/** Floor topology is exactly the production tile map. A shared 8px surface
 * grid only adds traversable vertical relief, never a new ledge or shortcut. */
export function createStageGroundGeometry(world: SpatialSliceWorld): StageGroundGeometry {
  const field = world.ground, map = world.layout.tileMap;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row < field.rows; row++) for (let col = 0; col < field.columns; col++) {
    const x = col * field.step, z = row * field.step;
    positions.push(x, field.heightAt(x, z), z); uvs.push(x / world.width, z / world.height);
  }
  for (let row = 0; row < field.rows - 1; row++) for (let col = 0; col < field.columns - 1; col++) {
    const tileCol = Math.floor((col + .5) * field.step / map.tileSize);
    const tileRow = Math.floor((row + .5) * field.step / map.tileSize);
    if (map.tiles[tileRow]![tileCol] === TileType.VOID) continue;
    const a = row * field.columns + col, b = a + field.columns, c = a + 1, d = b + 1;
    indices.push(a, b, c, c, b, d);
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surface.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  surface.setIndex(indices); surface.computeVertexNormals();

  const edgePositions: number[] = [], edgeUvs: number[] = [], edgeDrops: number[] = [];
  const triangle = (a: readonly number[], b: readonly number[], c: readonly number[]): void => {
    for (const p of [a, b, c]) {
      edgePositions.push(p[0]!, p[1]!, p[2]!);
      // Horizontal mineral seams follow the actual rock section, not the
      // camera. The skirt terminates by dissolving into air, not by a cap.
      edgeUvs.push((p[0]! + p[2]! * .31) / 110, (p[1]! + p[2]! * .015) / 58);
      edgeDrops.push(p[3]!);
    }
  };
  const levels = [0, 5, 15, 34];
  const inset = [0, 1.5, 5, 14];
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    if (map.tiles[row]![col] !== TileType.FLOOR) continue;
    const x = col * map.tileSize, z = row * map.tileSize;
    const edges = [
      [0, -1, x, z, x + map.tileSize, z],
      [1, 0, x + map.tileSize, z, x + map.tileSize, z + map.tileSize],
      [0, 1, x + map.tileSize, z + map.tileSize, x, z + map.tileSize],
      [-1, 0, x, z + map.tileSize, x, z],
    ];
    for (const [dx, dz, ax, az, bx, bz] of edges) {
      if (map.tiles[row + dz!]?.[col + dx!] !== undefined
        && map.tiles[row + dz!]?.[col + dx!] !== TileType.VOID) continue;
      for (let part = 0; part < map.tileSize / field.step; part++) {
        const at = part * field.step / map.tileSize, next = (part + 1) * field.step / map.tileSize;
        const xa = ax! + (bx! - ax!) * at, za = az! + (bz! - az!) * at;
        const xb = ax! + (bx! - ax!) * next, zb = az! + (bz! - az!) * next;
        const point = (px: number, pz: number, level: number): number[] => {
          const drop = levels[level]! * (.78 + noise(Math.floor(px / 19), Math.floor(pz / 17), world.seed) * .44);
          return [px - dx! * inset[level]!, field.heightAt(px, pz) - drop, pz - dz! * inset[level]!, drop];
        };
        for (let level = 0; level < levels.length - 1; level++) {
          const a = point(xa, za, level), b = point(xb, zb, level);
          const c = point(xa, za, level + 1), d = point(xb, zb, level + 1);
          triangle(a, b, c); triangle(b, d, c);
        }
      }
    }
  }
  const edge = new THREE.BufferGeometry();
  edge.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  edge.setAttribute('uv', new THREE.Float32BufferAttribute(edgeUvs, 2));
  edge.setAttribute('stageDrop', new THREE.Float32BufferAttribute(edgeDrops, 1));
  edge.computeVertexNormals();
  return { surface, edge };
}

/** World-aligned two-pixel mineral clusters. Texture describes deposited
 * material; light and silhouette still come from the shared real relief. */
export function createSeabedTexture(world: SpatialSliceWorld): THREE.DataTexture {
  const width = Math.ceil(world.width / 2), height = Math.ceil(world.height / 2);
  const bytes = new Uint8Array(width * height * 4);
  const palette = [0x38473e, 0x465449, 0x56604f, 0x676b58, 0x7c7e69].map(color => new THREE.Color(color));
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const x = col * 2, z = row * 2;
    const broad = noise(Math.floor((x + z * .21) / 38), Math.floor(z / 24), world.seed + 13);
    const bend = Math.sin(z / 133) * 21 + Math.sin(x / 196 + z / 211) * 15;
    const drift = x + z * .27 + bend;
    const cluster = noise(Math.floor(drift / 9), Math.floor((z - x * .13) / 5), world.seed + 51);
    const pocket = noise(Math.floor(drift / 23), Math.floor(z / 13), world.seed + 96);
    const channel = Math.max(0, Math.min(1, (world.groundHeightAt(x, z) + 6) / 39));
    let index = channel > .66 ? 2 : 1;
    if (broad > .65 && cluster > .35) index++;
    if (pocket < .21) index--;
    if (cluster > .83 && pocket > .64) index++;
    const color = palette[Math.max(0, Math.min(palette.length - 1, index))]!;
    const at = (row * width + col) * 4;
    bytes[at] = Math.round(color.r * 255); bytes[at + 1] = Math.round(color.g * 255);
    bytes[at + 2] = Math.round(color.b * 255); bytes[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace; texture.needsUpdate = true;
  return texture;
}
