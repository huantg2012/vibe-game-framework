import * as THREE from 'three';
import type { SpatialSliceWorld } from '../slice-world';
import { TileType } from '@/types/game-types';
import { VoidRegions } from '../void-regions';
import { noise } from './materials';

interface RimVertex { x: number; z: number; nx: number; nz: number; count: number }
interface RimSegment {
  a: RimVertex; b: RimVertex;
  col: number; row: number;
  internal: boolean;
}

export const VOID_SECTION_FADE_START = .43;
export const VOID_SECTION_FADE_END = .99;

function key(x: number, z: number): string { return `${x}:${z}`; }

function broadNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), u = x - ix, v = z - iz;
  const sx = u * u * (3 - 2 * u), sz = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(noise(ix, iz, seed), noise(ix + 1, iz, seed), sx),
    THREE.MathUtils.lerp(noise(ix, iz + 1, seed), noise(ix + 1, iz + 1, seed), sx), sz);
}

/** The extension belongs to the known land, never to the interior void. Its
 * roots fold underneath the land and end without a bottom or a back wall. */
export function createVoidSectionGeometry(world: SpatialSliceWorld): THREE.BufferGeometry {
  const map = world.layout.tileMap, field = world.ground, regions = new VoidRegions(map);
  const vertices = new Map<string, RimVertex>(), segments: RimSegment[] = [];
  const vertex = (x: number, z: number, nx: number, nz: number): RimVertex => {
    const id = key(x, z);
    let found = vertices.get(id);
    if (!found) { found = { x, z, nx: 0, nz: 0, count: 0 }; vertices.set(id, found); }
    found.nx += nx; found.nz += nz; found.count++;
    return found;
  };
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
      const next = map.tiles[row + dz!]?.[col + dx!];
      if (next !== undefined && next !== TileType.VOID) continue;
      const internal = regions.isInterior(x + (dx! + .5) * map.tileSize, z + (dz! + .5) * map.tileSize);
      for (let part = 0; part < map.tileSize / field.step; part++) {
        const at = part * field.step / map.tileSize, after = (part + 1) * field.step / map.tileSize;
        segments.push({
          a: vertex(ax! + (bx! - ax!) * at, az! + (bz! - az!) * at, dx!, dz!),
          b: vertex(ax! + (bx! - ax!) * after, az! + (bz! - az!) * after, dx!, dz!),
          col, row, internal,
        });
      }
    }
  }
  const positions: number[] = [], uvs: number[] = [], drops: number[] = [], spans: number[] = [];
  const anchors: number[] = [], boundary: number[] = [];
  const levels = [0, .085, .22, .43, .7, 1];
  const folds = [0, 2, 9, 5, 18, 26];
  const a: number[] = [], b: number[] = [], c: number[] = [], d: number[] = [];
  const place = (vertex: RimVertex, level: number, segment: RimSegment, out: number[]): void => {
    const large = broadNoise(vertex.x / 107, vertex.z / 89, world.seed + 113);
    const scar = broadNoise(vertex.x / 43, vertex.z / 57, world.seed + 41);
    const span = segment.internal ? 72 + large * 46 + scar * 12 : 28 + large * 13;
    const depth = span * levels[level]!;
    const length = Math.hypot(vertex.nx, vertex.nz);
    // Shared rim vertices use one shared fold vector. Even concave corners
    // weld; four-way point contacts remain fixed instead of tearing apart.
    const nx = length > 0 && vertex.count <= 2 ? vertex.nx / length : 0;
    const nz = length > 0 && vertex.count <= 2 ? vertex.nz / length : 0;
    const inset = folds[level]! * (segment.internal ? .78 + scar * .38 : .48);
    out[0] = vertex.x - nx * inset;
    out[1] = field.heightAt(vertex.x, vertex.z) - depth;
    out[2] = vertex.z - nz * inset;
    out[3] = depth; out[4] = span;
    // Clamp the anchor into the segment's actual floor tile. The entire
    // downward section inherits that shore's perception, not projected VOID.
    out[5] = Math.max(segment.col * map.tileSize + 4, Math.min((segment.col + 1) * map.tileSize - 4, vertex.x));
    out[6] = Math.max(segment.row * map.tileSize + 4, Math.min((segment.row + 1) * map.tileSize - 4, vertex.z));
  };
  const triangle = (a: readonly number[], b: readonly number[], c: readonly number[], internal: boolean): void => {
    for (const p of [a, b, c]) {
      positions.push(p[0]!, p[1]!, p[2]!);
      // Bedded texture remains attached to rock height. Side depth is not a
      // screen gradient and never paints a surface across the hole itself.
      uvs.push((p[0]! + p[2]! * .31) / 110, (p[1]! + p[2]! * .025) / 72);
      drops.push(p[3]!); spans.push(p[4]!); anchors.push(p[5]!, p[6]!); boundary.push(internal ? 1 : 0);
    }
  };
  for (const segment of segments) for (let level = 0; level < levels.length - 1; level++) {
    place(segment.a, level, segment, a); place(segment.b, level, segment, b);
    place(segment.a, level + 1, segment, c); place(segment.b, level + 1, segment, d);
    triangle(a, b, c, segment.internal); triangle(b, d, c, segment.internal);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('stageDrop', new THREE.Float32BufferAttribute(drops, 1));
  geometry.setAttribute('stageSectionSpan', new THREE.Float32BufferAttribute(spans, 1));
  geometry.setAttribute('stageAnchor', new THREE.Float32BufferAttribute(anchors, 2));
  geometry.setAttribute('stageInterior', new THREE.Float32BufferAttribute(boundary, 1));
  geometry.computeVertexNormals();
  geometry.userData = {
    internalSegments: segments.filter(segment => segment.internal).length,
    exteriorSegments: segments.filter(segment => !segment.internal).length,
    layers: levels.length - 1,
    interiorDepthRange: [72, 130],
    perception: 'shore-floor anchors only',
    bottom: 'absent',
  };
  return geometry;
}
