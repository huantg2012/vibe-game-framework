import * as THREE from 'three';
import type { StageWorldGeometry } from '../spatial-study/stage/world-geometry';
import type { StageVisibility } from '../spatial-study/stage/terrain';
import { createLivingMaterial } from './materials';

interface Section {
  x: number; y: number; z: number;
  left: number; right: number; rise: number; depth: number;
}
interface DeformingBody { geometry: THREE.BufferGeometry; rest: Float32Array }
interface Fibre {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  targetX: number; targetZ: number; strand: number; width: number;
  loadSource: 'local' | 'natural';
  start: THREE.Vector3; end: THREE.Vector3;
}

const BEARING_X = 704;
const BEARING_Z = 704;
const BODY_Y = -13;
const FIBRE_STEPS = 28;

/** A closed, asymmetric lamina loft. Its broad centre, clipped fan edge and
 * independent left/right profiles give it a bearing anatomy, not an island. */
function lamina(sections: readonly Section[], seed: number): THREE.BufferGeometry {
  const longitudinal = 40, cross = 28, half = cross / 2;
  const curve = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s.x, s.y, s.z)));
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const length = curve.getLength();
  for (let row = 0; row <= longitudinal; row++) {
    const u = row / longitudinal;
    const centre = curve.getPoint(u), tangent = curve.getTangent(u);
    const horizontal = Math.hypot(tangent.x, tangent.z) || 1;
    const nx = tangent.z / horizontal, nz = -tangent.x / horizontal;
    const at = u * (sections.length - 1), index = Math.min(sections.length - 2, Math.floor(at));
    const a = sections[index]!, b = sections[index + 1]!, blend = at - index;
    const left = THREE.MathUtils.lerp(a.left, b.left, blend);
    const right = THREE.MathUtils.lerp(a.right, b.right, blend);
    const rise = THREE.MathUtils.lerp(a.rise, b.rise, blend);
    const depth = THREE.MathUtils.lerp(a.depth, b.depth, blend);
    for (let col = 0; col <= cross; col++) {
      const upper = col <= half;
      const side = -1 + (upper ? col / half : (cross - col) / half) * 2;
      const width = side < 0 ? left : right;
      const scallop = Math.sin(u * 19 + seed) * 2.5 * Math.pow(Math.abs(side), 5);
      const lateral = side * (width + scallop);
      const crown = rise * (1 - Math.pow(Math.abs(side), 1.45));
      const fold = Math.sin(u * Math.PI) * Math.max(0, 1 - Math.abs(side + .24) * 4) * rise * .18;
      const height = upper ? crown + fold : -depth * (.5 + .5 * (1 - side * side));
      positions.push(centre.x + nx * lateral, centre.y + height, centre.z + nz * lateral);
      uvs.push(u * length / 256, (side + 1) * (left + right) / 512);
      if (row && col) {
        const back = (row - 1) * (cross + 1) + col - 1;
        const front = row * (cross + 1) + col - 1;
        indices.push(back, front, front + 1, back, front + 1, back + 1);
      }
    }
  }
  for (const row of [0, longitudinal]) {
    const section = sections[row === 0 ? 0 : sections.length - 1]!;
    const centreIndex = positions.length / 3;
    positions.push(section.x, section.y, section.z); uvs.push(row / longitudinal * length / 256, .5);
    for (let col = 0; col < cross; col++) {
      const at = row * (cross + 1) + col;
      if (row === 0) indices.push(centreIndex, at, at + 1);
      else indices.push(centreIndex, at + 1, at);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function fibreGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array((FIBRE_STEPS + 1) * 4 * 3);
  const uvs = new Float32Array((FIBRE_STEPS + 1) * 4 * 2);
  const indices: number[] = [];
  for (let row = 0; row <= FIBRE_STEPS; row++) for (let side = 0; side < 4; side++) {
    const at = row * 4 + side;
    uvs[at * 2] = side === 0 || side === 3 ? 0 : .125;
    uvs[at * 2 + 1] = row / FIBRE_STEPS * 1.1;
    if (row) {
      const previous = (row - 1) * 4 + side, next = (side + 1) % 4;
      indices.push(previous, row * 4 + side, row * 4 + next,
        previous, row * 4 + next, (row - 1) * 4 + next);
    }
  }
  indices.push(0, 1, 2, 0, 2, 3);
  const last = FIBRE_STEPS * 4;
  indices.push(last, last + 2, last + 1, last, last + 3, last + 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  return geometry;
}

export class LivingScenery {
  readonly group = new THREE.Group();
  private readonly bodies: DeformingBody[] = [];
  private readonly fibres: Fibre[] = [];
  private readonly distant: THREE.Group[] = [];
  private readonly pose = { load: 0, tension: 0, lift: 0 };

  constructor(private readonly world: StageWorldGeometry, visibility: StageVisibility) {
    this.group.name = 'living-landmass:connected-bodies';
    const body = createLivingMaterial('body', world.seed + 80);
    const face = createLivingMaterial('edge', world.seed + 83);
    const fibre = createLivingMaterial('fibre', world.seed + 86);
    const distant = createLivingMaterial('distant', world.seed + 89);
    // The underbody is a vista below the playable plane, not hidden terrain.
    // Its anatomy remains legible in ambient depth. Connections to the actual
    // ground still belong to current sight and disclose no hidden shortcut.
    visibility.apply(fibre, undefined, false, undefined, true);

    this.addBody('lower-bearing-shoulder', [
      { x: 1210, y: -250, z: 1130, left: 70, right: 105, rise: 22, depth: 66 },
      { x: 1030, y: -152, z: 955, left: 156, right: 128, rise: 35, depth: 110 },
      { x: 830, y: -87, z: 776, left: 135, right: 191, rise: 38, depth: 89 },
      { x: 645, y: -67, z: 665, left: 137, right: 221, rise: 47, depth: 82 },
      { x: 465, y: -155, z: 501, left: 202, right: 129, rise: 31, depth: 103 },
      { x: 264, y: -267, z: 310, left: 62, right: 119, rise: 19, depth: 58 },
    ], body, world.seed);
    this.addBody('bearing-contact-saddle', [
      { x: 620, y: -47, z: 659, left: 47, right: 65, rise: 14, depth: 25 },
      { x: 674, y: -28, z: 688, left: 56, right: 69, rise: 16, depth: 26 },
      { x: 720, y: -26, z: 717, left: 37, right: 50, rise: 14, depth: 20 },
      { x: 758, y: -35, z: 745, left: 11, right: 18, rise: 6, depth: 12 },
    ], face, world.seed + 3);

    // A few broad underside folds separate into load-bearing planes, then
    // merge back into the shoulder. They never become a forest of cylinders.
    for (let index = 0; index < 3; index++) this.addBody(`lower-overlapping-lamina:${index}`, [
      { x: 570 - index * 59, y: -195 - index * 29, z: 542 + index * 59, left: 19, right: 32, rise: 14, depth: 17 },
      { x: 663 - index * 43, y: -122 - index * 38, z: 638 + index * 78, left: 63, right: 84, rise: 21, depth: 29 },
      { x: 824 - index * 22, y: -135 - index * 31, z: 769 + index * 63, left: 50, right: 70, rise: 18, depth: 25 },
      { x: 1019, y: -203 - index * 34, z: 958 + index * 42, left: 9, right: 26, rise: 8, depth: 12 },
    ], index === 1 ? face : body, world.seed + index + 9);

    for (const [bundle, z] of [592, 704].entries()) for (let strand = -1; strand <= 1; strand++) {
      const mesh = new THREE.Mesh(fibreGeometry(), fibre);
      mesh.name = `living-tether:${bundle}:${strand}`;
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);
      this.fibres.push({ mesh, targetX: 848 + strand * 6, targetZ: z + strand * 7,
        strand, width: strand === 0 ? 11 : 7, loadSource: 'local', start: new THREE.Vector3(), end: new THREE.Vector3() });
    }

    // The organism keeps carrying its neighbouring root after the short
    // route is pried loose. This branch follows natural rather than local load.
    for (let strand = 0; strand < 2; strand++) {
      const mesh = new THREE.Mesh(fibreGeometry(), fibre);
      mesh.name = `living-tether:stable-branch:${strand}`;
      mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
      this.fibres.push({ mesh, targetX: 392 + strand * 8, targetZ: 736 + strand * 7,
        strand, width: 14 - strand * 3, loadSource: 'natural', start: new THREE.Vector3(), end: new THREE.Vector3() });
    }

    this.addDistant('far-overturned-body', [
      { x: -260, y: -243, z: 170, left: 53, right: 111, rise: 29, depth: 78 },
      { x: 105, y: -83, z: -26, left: 192, right: 312, rise: 66, depth: 133 },
      { x: 485, y: -127, z: -72, left: 174, right: 276, rise: 48, depth: 116 },
      { x: 826, y: -239, z: -278, left: 98, right: 166, rise: 39, depth: 96 },
      { x: 1090, y: -397, z: -439, left: 23, right: 72, rise: 17, depth: 44 },
    ], distant, world.seed + 21);
    this.addDistant('far-bearing-fan', [
      { x: world.width + 370, y: -247, z: 210, left: 55, right: 83, rise: 24, depth: 76 },
      { x: world.width + 81, y: -113, z: 423, left: 178, right: 121, rise: 37, depth: 117 },
      { x: world.width + 40, y: -116, z: 801, left: 233, right: 150, rise: 56, depth: 131 },
      { x: world.width + 263, y: -294, z: 1160, left: 69, right: 93, rise: 19, depth: 62 },
    ], distant, world.seed + 24);
    this.addDistant('deep-receiving-body', [
      { x: 72, y: -468, z: 929, left: 110, right: 82, rise: 31, depth: 90 },
      { x: 350, y: -352, z: 651, left: 158, right: 288, rise: 48, depth: 136 },
      { x: 760, y: -359, z: 429, left: 254, right: 185, rise: 47, depth: 105 },
      { x: 1160, y: -506, z: 352, left: 102, right: 51, rise: 27, depth: 80 },
    ], distant, world.seed + 27);
    this.addDistant('deep-folded-fin-lip', [
      { x: 18, y: -445, z: 1010, left: 7, right: 13, rise: 10, depth: 9 },
      { x: 283, y: -287, z: 838, left: 37, right: 75, rise: 32, depth: 15 },
      { x: 592, y: -292, z: 682, left: 51, right: 98, rise: 27, depth: 22 },
      { x: 903, y: -398, z: 505, left: 12, right: 39, rise: 15, depth: 11 },
    ], distant, world.seed + 32);
    this.update(0, this.pose);
  }

  private addBody(name: string, sections: readonly Section[], material: THREE.MeshStandardMaterial, seed: number): void {
    const geometry = lamina(sections, seed);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    positions.setUsage(THREE.DynamicDrawUsage);
    this.bodies.push({ geometry, rest: new Float32Array(positions.array) });
  }

  private addDistant(name: string, sections: readonly Section[], material: THREE.MeshStandardMaterial, seed: number): void {
    const group = new THREE.Group(); group.name = name;
    group.add(new THREE.Mesh(lamina(sections, seed), material));
    this.group.add(group); this.distant.push(group);
  }

  update(elapsedMs: number, pose: { load: number; tension: number; lift: number }): void {
    this.pose.load = THREE.MathUtils.clamp(pose.load, 0, 1);
    this.pose.tension = THREE.MathUtils.clamp(pose.tension, 0, 1);
    this.pose.lift = pose.lift;
    for (const body of this.bodies) {
      const positions = body.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < positions.count; index++) {
        const at = index * 3, x = body.rest[at]!, y = body.rest[at + 1]!, z = body.rest[at + 2]!;
        const radius = Math.hypot((x - BEARING_X) / 278, (z - BEARING_Z) / 246);
        const influence = Math.max(0, 1 - radius * radius);
        positions.setXYZ(index, x + influence * this.pose.load * 2,
          y + influence * this.pose.load * 13, z - influence * this.pose.load * 3);
      }
      positions.needsUpdate = true;
      body.geometry.computeVertexNormals(); body.geometry.computeBoundingSphere();
    }
    for (const fibre of this.fibres) this.updateFibre(fibre);
    for (const [index, distant] of this.distant.entries()) {
      const phase = elapsedMs / (23000 + index * 11000) + index * 2.4;
      distant.position.y = Math.sin(phase) * (3 + index * 2);
      distant.rotation.z = (Math.sin(phase * .81) - Math.sin(index * 2.4 * .81)) * .004;
    }
  }

  private updateFibre(fibre: Fibre): void {
    const load = this.pose.load, tension = fibre.loadSource === 'natural' ? load : this.pose.tension;
    fibre.start.set(BEARING_X + fibre.strand * 6 + load * 2, BODY_Y + load * 13, BEARING_Z + fibre.strand * 8 - load * 3);
    fibre.end.set(fibre.targetX, this.world.groundHeightAt(fibre.targetX, fibre.targetZ) + .7, fibre.targetZ);
    const dx = fibre.end.x - fibre.start.x, dz = fibre.end.z - fibre.start.z;
    const length = Math.hypot(dx, dz) || 1, nx = dz / length, nz = -dx / length;
    const sag = 12 + (1 - tension) * 28;
    const positions = fibre.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let row = 0; row <= FIBRE_STEPS; row++) {
      const u = row / FIBRE_STEPS, bow = Math.sin(u * Math.PI);
      const spread = fibre.strand * bow * (3 + (1 - tension) * 3);
      const x = THREE.MathUtils.lerp(fibre.start.x, fibre.end.x, u) + nx * spread;
      const z = THREE.MathUtils.lerp(fibre.start.z, fibre.end.z, u) + nz * spread;
      const y = THREE.MathUtils.lerp(fibre.start.y, fibre.end.y, u) - bow * sag;
      const width = fibre.width * (1.7 - bow * .87);
      for (let side = 0; side < 4; side++) {
        const across = side === 0 || side === 3 ? -1 : 1;
        const vertical = side < 2 ? 1 : -1;
        positions.setXYZ(row * 4 + side, x + nx * across * width * .5,
          y + vertical * .7 + across * bow * (fibre.strand * .9 + .6), z + nz * across * width * .5);
      }
    }
    positions.needsUpdate = true;
    fibre.mesh.geometry.computeVertexNormals(); fibre.mesh.geometry.computeBoundingSphere();
  }

  snapshot(): Record<string, unknown> {
    return { kind: 'living-bearing-anatomy', sharedPose: { ...this.pose }, nearBodies: this.bodies.length,
      distantBodies: this.distant.length, strands: this.fibres.length,
      fibres: this.fibres.map(fibre => ({ from: fibre.start.toArray(), to: fibre.end.toArray(), loadSource: fibre.loadSource,
        supportHeight: this.world.groundHeightAt(fibre.targetX, fibre.targetZ) })),
      deformationSource: 'mechanism-pose', nearSight: 'tethers-current-air-and-land', underbody: 'ambient-vista-below-ground',
      dynamicVertices: this.bodies.reduce((total, body) => total + body.rest.length / 3, 0) + this.fibres.length * (FIBRE_STEPS + 1) * 4,
    };
  }
}
