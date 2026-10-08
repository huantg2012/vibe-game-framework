import * as THREE from 'three';
import type { SpatialSliceWorld } from '../spatial-study/slice-world';
import { noise, roughMaterial, ringBody } from '../spatial-study/stage/materials';
import type { StageNativePile } from '../spatial-study/stage/loot';
import type { RiftPresentationView } from '../spatial-study/stage/bridge';
import type { SeaPoint } from '@/worlds/suspended-sea/types';

/** Earcut's XY winding points down after the XZ mapping. Build the actual
 * supported top with upward winding, including on a sloping bed. Subdivision
 * keeps the thin surface above the shared relief between outline vertices. */
export function createSeaSurfaceGeometry(points: readonly SeaPoint[],
  heightAt: (x: number, y: number) => number, raise: number): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [];
  const add = (point: SeaPoint): void => {
    positions.push(point.x, heightAt(point.x, point.y) + raise, point.y); uvs.push(point.x, point.y);
  };
  const triangle = (a: SeaPoint, b: SeaPoint, c: SeaPoint): void => {
    const vertices = [a, b, c];
    let edge = 0, longest = 0;
    for (let i = 0; i < 3; i++) {
      const p = vertices[i]!, q = vertices[(i + 1) % 3]!;
      const length = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (length > longest) { longest = length; edge = i; }
    }
    if (longest > 64) {
      const p = vertices[edge]!, q = vertices[(edge + 1) % 3]!, r = vertices[(edge + 2) % 3]!;
      const mid = { x: (p.x + q.x) * .5, y: (p.y + q.y) * .5 };
      triangle(p, mid, r); triangle(mid, q, r); return;
    }
    add(a); add(b); add(c);
  };
  const shape = points.map(point => new THREE.Vector2(point.x, point.y));
  for (const indices of THREE.ShapeUtils.triangulateShape(shape, [])) {
    const a = points[indices[0]!]!, b = points[indices[1]!]!, c = points[indices[2]!]!;
    const xyCross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(xyCross) < 1e-8) continue;
    triangle(a, xyCross > 0 ? c : b, xyCross > 0 ? b : c);
  }
  const geometry = new THREE.BufferGeometry(); geometry.name = 'suspended-sea-supported-top';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.computeVertexNormals();
  return geometry;
}

/** Upward, ground-following strip. Channel UVs carry travelled distance, so
 * water continues round the authored bends instead of scrolling world north. */
export function createSeaRibbonGeometry(points: readonly SeaPoint[], width: number,
  heightAt: (x: number, y: number) => number, raise: number, closed: boolean,
  channelUv = false): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [];
  const add = (x: number, y: number, across: number, along: number): void => {
    positions.push(x, heightAt(x, y) + raise, y); uvs.push(channelUv ? across : x, channelUv ? along : y);
  };
  let travelled = 0;
  for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < .01) continue;
    const nx = -dy / length * width * .5, ny = dx / length * width * .5;
    const segments = Math.max(1, Math.ceil(length / 7));
    for (let step = 0; step < segments; step++) {
      const u = step / segments, v = (step + 1) / segments;
      const ax = a.x + dx * u, ay = a.y + dy * u, bx = a.x + dx * v, by = a.y + dy * v;
      const start = travelled + length * u, end = travelled + length * v;
      add(ax + nx, ay + ny, 0, start); add(bx + nx, by + ny, 0, end); add(ax - nx, ay - ny, width, start);
      add(bx + nx, by + ny, 0, end); add(bx - nx, by - ny, width, end); add(ax - nx, ay - ny, width, start);
    }
    travelled += length;
  }
  const geometry = new THREE.BufferGeometry(); geometry.name = 'suspended-sea-supported-strip';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.computeVertexNormals();
  return geometry;
}

function broadNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (noise(ix, iy, seed) * (1 - u) + noise(ix + 1, iy, seed) * u) * (1 - v)
    + (noise(ix, iy + 1, seed) * (1 - u) + noise(ix + 1, iy + 1, seed) * u) * v;
}

/** Quiet, water-combed sediment with broad uninterrupted pigment fields.
 * Fine fragments belong at authored deposits, not in a random tile-wide scatter. */
export function createSuspendedSeaBedTexture(world: SpatialSliceWorld): THREE.DataTexture {
  const width = Math.ceil(world.width / 2), height = Math.ceil(world.height / 2);
  const bytes = new Uint8Array(width * height * 4);
  const palette = [0x45444a, 0x514e4c, 0x58534f, 0x625b52, 0x6a6053, 0x817565].map(value => new THREE.Color(value));
  const spawn = world.layout.spawnPoint, water = world.waterDefinition;
  const routeLength = Math.hypot(water.x - spawn.x, water.y - spawn.y) || 1;
  const flowX = (water.x - spawn.x) / routeLength, flowY = (water.y - spawn.y) / routeLength;
  // Two local material accents, not new terrain or a world-wide stripe filter.
  const accents = [{ x: spawn.x + flowX * 25, y: spawn.y + flowY * 25, dx: flowX, dy: flowY },
    { x: water.x - 38, y: water.y + 5, dx: 1, dy: .22 }];
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const x = col * 2, y = row * 2;
    const bend = 24 * Math.sin(y / 173) + 17 * Math.sin((x + y * .31) / 229);
    const along = x + y * .18 + bend;
    const pressure = broadNoise(along / 218, (y - x * .11) / 84, world.seed + 91);
    const dry = world.groundHeightAt(x, y);
    const deposit = broadNoise((along + 40) / 151, y / 117, world.seed + 64);
    let index = pressure < .27 ? 1 : pressure < .72 ? 2 : 3;
    if (dry < -3 && pressure < .48) index--;
    // Only a few grouped scour edges, deliberately broken before they can form
    // parallel cross-road bars. Their broad direction follows old water flow.
    const band = (y - x * .14 + Math.sin(x / 146) * 15) / 78;
    const fract = band - Math.floor(band);
    const strip = fract > .77 && fract < .81 || fract > .88 && fract < .91;
    const shortEdge = deposit > .69 && pressure > .47 && strip;
    if (shortEdge) index = dry > 12 ? 5 : 4;
    for (const accent of accents) {
      const ax = x - accent.x, ay = y - accent.y;
      if (Math.abs(ax) > 140 || Math.abs(ay) > 140) continue;
      const u = ax * accent.dx + ay * accent.dy, v = -ax * accent.dy + ay * accent.dx;
      // Broad scour bends into the old water course. Only its short broken
      // exposed layer carries calcium; neither side implies a raised step.
      const curve = v - u * u * .0016;
      if (Math.abs(u) < 102 && Math.abs(curve + 4) < 19) index = Math.max(index, 3);
      for (let layer = 0; layer < 3; layer++) {
        const offset = layer === 0 ? -25 : layer === 1 ? 4 : 25;
        const halfLength = layer === 0 ? 43 : layer === 1 ? 66 : 30;
        const along = u - (layer === 0 ? -24 : layer === 1 ? 8 : 31);
        if (Math.abs(along) > halfLength || layer === 1 && along > 21 && along < 34) continue;
        const edge = curve - offset + Math.sin(u / 21 + layer) * 2.5;
        if (edge > -1 && edge < 3.2) index = 5;
        else if (edge >= 3.2 && edge < 6.4) index = 1;
      }
      // A few flattened remnants held along one deposition edge, never a
      // uniform scatter and never a searchable object or item-quality cue.
      for (let chip = 0; chip < 4; chip++) {
        const cx = -43 + chip * 21, cy = 37 + (chip % 2) * 5;
        if (Math.abs(u - cx) < 3 + chip % 3 && Math.abs(v - cy + (u - cx) * .25) < 1.8) index = 4 + chip % 2;
      }
    }
    const color = palette[Math.max(0, index)]!, at = (row * width + col) * 4;
    bytes[at] = Math.round(color.r * 255); bytes[at + 1] = Math.round(color.g * 255);
    bytes[at + 2] = Math.round(color.b * 255); bytes[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

export type SeaPileSource = 'sea-deposit' | 'rift-debris';

/** The whole silhouette identifies a local shell deposit or carried debris.
 * It never discloses the actual item or quality before the real search resolves. */
export class SuspendedSeaPile implements StageNativePile {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly material: THREE.MeshStandardMaterial;
  private readonly rim: THREE.MeshStandardMaterial;
  private readonly debris: THREE.MeshStandardMaterial;
  private revealed = false;
  private revealAt = Infinity;

  constructor(private readonly world: SpatialSliceWorld, pile: RiftPresentationView['piles'][number],
    readonly source: SeaPileSource) {
    this.root.name = `suspended-sea-pile:${source}:${pile.id}`;
    this.material = roughMaterial(source === 'sea-deposit' ? 0x62655f : 0x58524a);
    this.rim = roughMaterial(source === 'sea-deposit' ? 0x909184 : 0x8c8067);
    this.debris = roughMaterial(0x343c3a);
    this.root.add(this.body);
    const seed = pile.id.split('').reduce((value, letter) => Math.imul(value ^ letter.charCodeAt(0), 16777619), 2166136261);
    const shell = new THREE.Mesh(ringBody([
      { y: .4, x: 17, z: 11 }, { y: 2, x: 16, z: 10 },
      { y: 5.5, x: 12, z: 8, dx: -3, dz: -1 }, { y: 6, x: 2, z: 2, dx: -5, dz: -3 },
    ], 11), this.material);
    shell.rotation.y = -.27; shell.receiveShadow = true; shell.castShadow = true; this.body.add(shell);
    for (let i = 0; i < 3; i++) {
      const chip = new THREE.Mesh(ringBody([{ y: 0, x: 4 + noise(i, 1, seed) * 2, z: 3 },
        { y: 1.2, x: 3, z: 2, dx: 1 }, { y: 1.7, x: .4, z: .6 }], 5), i === 1 ? this.material : this.rim);
      chip.position.set(-13 + i * 12, .3, 10 + noise(i, 2, seed) * 6);
      chip.rotation.y = i * 1.8 + .4; this.root.add(chip);
    }
    // Two short exposed edges, not a bright ring or loot-quality border.
    for (let i = 0; i < 2; i++) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(8 + i * 2, 1.1, 2), this.rim);
      edge.position.set(-7 + i * 17, 4 - i * 1.5, 6 - i * 4); edge.rotation.y = -.25 + i * .5; this.body.add(edge);
    }
    if (source === 'rift-debris') {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(23, 2, 4), this.debris);
      slat.position.set(0, 6, 0); slat.rotation.y = -.43; this.body.add(slat);
      const fibre = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 14), this.rim);
      fibre.position.set(-8, 3, 7); fibre.rotation.y = -.3; this.root.add(fibre);
    } else {
      // The collected fuel residue is foreign matter caught in the deposit,
      // rather than an assertion that ordinary shells themselves are fuel.
      const remnant = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 3), this.debris);
      remnant.position.set(7, 4, 2); remnant.rotation.y = .6; this.body.add(remnant);
    }
  }

  update(pile: RiftPresentationView['piles'][number], elapsedMs: number): void {
    this.root.position.set(pile.position.x, this.world.groundHeightAt(pile.position.x, pile.position.y), pile.position.y);
    this.root.visible = pile.visibility > 0;
    if (pile.collected && !this.revealed) { this.revealed = true; this.revealAt = elapsedMs; }
    const age = elapsedMs - this.revealAt;
    this.body.scale.y = pile.collected ? .4 : 1;
    this.body.position.y = age >= 0 && age < 260 ? Math.sin(age / 260 * Math.PI) * 2.8 : 0;
    this.body.rotation.z = pile.searching ? Math.sin(elapsedMs * .026) * .019 : 0;
    const gain = Math.max(.12, pile.visibility) * (pile.targeted ? 1.11 : 1);
    this.material.color.setHex(this.source === 'sea-deposit' ? 0x62655f : 0x58524a).multiplyScalar(gain);
    this.rim.color.setHex(this.source === 'sea-deposit' ? 0x909184 : 0x8c8067).multiplyScalar(gain);
    this.debris.color.setHex(0x343c3a).multiplyScalar(gain);
  }
}
