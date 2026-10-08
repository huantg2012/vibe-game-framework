import * as THREE from 'three';
import type { StageNativePile, StagePileFactory } from '../spatial-study/stage/loot';
import type { RiftPresentationView } from '../spatial-study/stage/bridge';
import type { StageWorldGeometry } from '../spatial-study/stage/world-geometry';
import { createLivingMaterial } from './materials';

type PileView = RiftPresentationView['piles'][number];
interface Piece {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  x: number; z: number; turn: number; tilt: number; height: number; spread: number;
}

function seedFromId(id: string): number {
  let value = 2166136261;
  for (let index = 0; index < id.length; index++) value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  return value >>> 0;
}
function portion(seed: number, index: number): number {
  let value = Math.imul(seed ^ index, 1103515245);
  value = Math.imul(value ^ (value >>> 16), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

/** Broad curled fragments with a real thin section, not pebbles or reward icons. */
function flakeGeometry(variant: number): THREE.BufferGeometry {
  const outline = [[-.56, -.26], [-.29, -.61], [.16, -.55], [.54, -.19], [.44, .39], [.1, .65], [-.44, .41], [-.53, .06]] as const;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let layer = 0; layer < 2; layer++) {
    positions.push(0, layer === 0 ? .12 : -.1, 0); uvs.push(.5, .5);
    for (const [index, point] of outline.entries()) {
      const x = point[0] * (1 + Math.sin(index * 2 + variant) * .11), z = point[1];
      const curl = Math.max(0, x + .12) ** 2 * (.85 + variant * .17);
      positions.push(x, curl + (layer === 0 ? .055 : -.09), z);
      uvs.push(x * .25 + .5, z * .25 + .5);
    }
  }
  const span = outline.length + 1;
  for (let edge = 0; edge < outline.length; edge++) {
    const a = edge + 1, b = (edge + 1) % outline.length + 1;
    indices.push(0, b, a, span, span + a, span + b,
      a, b, span + b, a, span + b, span + a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.computeVertexNormals(); return geometry;
}

function fibreFragmentGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= 12; row++) {
    const u = row / 12, turn = u * 3.1 - 1.55;
    const x = Math.sin(turn) * .58, z = Math.cos(turn) * .34 - .12;
    const y = Math.sin(u * Math.PI) * .14;
    for (let side = 0; side < 4; side++) {
      const width = side === 0 || side === 3 ? -.055 : .055;
      positions.push(x + Math.sin(turn) * width, y + (side < 2 ? .035 : -.035), z + Math.cos(turn) * width);
      uvs.push(side < 2 ? .1 : .2, u * .55);
      if (row) {
        const before = (row - 1) * 4 + side, next = (side + 1) % 4;
        indices.push(before, row * 4 + side, row * 4 + next, before, row * 4 + next, (row - 1) * 4 + next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.computeVertexNormals(); return geometry;
}

function materialInstance(template: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const material = template.clone();
  // Material.clone does not preserve custom compile hooks. Instances share
  // the factory texture but retain the dry pigment-lighting treatment.
  material.onBeforeCompile = template.onBeforeCompile;
  material.customProgramCacheKey = template.customProgramCacheKey;
  return material;
}

class LivingPile implements StageNativePile {
  readonly root = new THREE.Group();
  private readonly pieces: Piece[] = [];
  private readonly shell: THREE.MeshStandardMaterial;
  private readonly fibre: THREE.MeshStandardMaterial;
  private collectedAt = Infinity;
  private wasCollected: boolean;

  constructor(private readonly world: StageWorldGeometry, pile: PileView,
    geometries: readonly THREE.BufferGeometry[], shell: THREE.MeshStandardMaterial, fibre: THREE.MeshStandardMaterial) {
    this.root.name = `living-search-remains:${pile.id}`;
    this.wasCollected = pile.collected;
    this.shell = materialInstance(shell); this.fibre = materialInstance(fibre);
    const seed = seedFromId(pile.id);
    for (let index = 0; index < 7; index++) {
      const isFibre = index >= 4;
      const geometry = geometries[isFibre ? 3 : index % 3]!;
      const mesh = new THREE.Mesh(geometry, isFibre ? this.fibre : this.shell);
      mesh.name = isFibre ? 'dry-bound-fibres' : 'cast-off-keratin';
      const x = (portion(seed, index * 6 + 1) - .5) * 15;
      const z = (portion(seed, index * 6 + 2) - .5) * 12;
      const turn = portion(seed, index * 6 + 3) * Math.PI * 2;
      const height = isFibre ? 4 + portion(seed, index * 6 + 4) * 2 : 5 + portion(seed, index * 6 + 4) * 3;
      mesh.scale.set(isFibre ? 16 : 14 + portion(seed, index * 6 + 5) * 7, height,
        isFibre ? 13 : 13 + portion(seed, index * 6 + 6) * 6);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.root.add(mesh);
      this.pieces.push({ mesh, x, z, turn, height,
        tilt: (portion(seed, index * 6 + 7) - .5) * .25, spread: 1 + portion(seed, index * 6 + 8) * 2 });
    }
    this.update(pile, 0);
  }

  update(pile: PileView, elapsedMs: number): void {
    const ground = this.world.groundHeightAt(pile.position.x, pile.position.y);
    this.root.position.set(pile.position.x, ground, pile.position.y);
    this.root.visible = pile.visibility > 0;
    if (pile.collected && !this.wasCollected) { this.wasCollected = true; this.collectedAt = elapsedMs; }
    const age = elapsedMs - this.collectedAt;
    const reveal = age >= 0 && age < 360 ? Math.sin(age / 360 * Math.PI) : 0;
    const settlement = pile.collected ? (age >= 0 ? Math.min(1, age / 360) : 1) : 0;
    const visibility = Math.max(0, Math.min(1, pile.visibility));
    const pigment = visibility * (pile.collected ? .56 : pile.targeted ? 1.14 : 1);
    this.shell.color.setScalar(pigment); this.fibre.color.setScalar(pigment);
    for (const [index, piece] of this.pieces.entries()) {
      const spread = 1 + settlement * .16;
      const x = piece.x * spread, z = piece.z * spread;
      const wx = pile.position.x + x, wz = pile.position.y + z;
      const supported = this.world.groundHeightAt(wx, wz);
      const slopeX = (this.world.groundHeightAt(wx + 2, wz) - this.world.groundHeightAt(wx - 2, wz)) / 4;
      const slopeZ = (this.world.groundHeightAt(wx, wz + 2) - this.world.groundHeightAt(wx, wz - 2)) / 4;
      const searching = pile.searching ? Math.sin(elapsedMs * .018 + index * 1.7) : 0;
      piece.mesh.position.set(x, supported - ground + 1 + reveal * piece.spread + searching * .3, z);
      piece.mesh.scale.y = piece.height * (1 - settlement * .43);
      piece.mesh.rotation.set(Math.atan(slopeZ) + piece.tilt * (1 - settlement) + searching * .025,
        piece.turn + settlement * (index % 2 === 0 ? .14 : -.12), -Math.atan(slopeX));
    }
  }
}

/** One opaque local material source. No definition, quality, reward or loot
 * table is read while building the unsearched exterior. */
export function createLivingPileFactory(world: StageWorldGeometry): StagePileFactory {
  const geometries = [flakeGeometry(0), flakeGeometry(1), flakeGeometry(2), fibreFragmentGeometry()];
  const shell = createLivingMaterial('surface', world.seed + 133);
  const fibre = createLivingMaterial('fibre', world.seed + 136);
  return pile => new LivingPile(world, pile, geometries, shell, fibre);
}
