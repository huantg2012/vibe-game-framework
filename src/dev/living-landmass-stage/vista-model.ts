import * as THREE from 'three';
import sectionsCSV from '../../../data/living-landmass-vista-sections.csv?raw';
import type { VistaSection } from './vista-sections';
import strataCSV from '../../../data/living-landmass-vista-strata.csv?raw';
import type { VistaStratum, VistaStratumKind } from './vista-strata';
import { createVistaMaterial, setVistaRockSampler } from './vista-material';
import outlineCSV from '../../../data/living-landmass-vista-outline.csv?raw';
import rocksCSV from '../../../data/living-landmass-vista-rocks.csv?raw';
import holesCSV from '../../../data/living-landmass-vista-holes.csv?raw';
import regionsCSV from '../../../data/living-landmass-vista-regions.csv?raw';
import routeNodesCSV from '../../../data/living-landmass-vista-route-nodes.csv?raw';
import connectorsCSV from '../../../data/living-landmass-vista-connectors.csv?raw';
import { createVistaCliff } from './vista-cliff';
import { createVistaRocks, type VistaRockDefinition, type VistaRockKind } from './vista-rocks';
import { shapeVistaBoundary } from './vista-boundary';
import { TileGrid } from '@/systems/tile-grid';
import { TileType } from '@/types/game-types';
import { disposeTree, noise } from '../spatial-study/stage/materials';
import { createVistaTerrain, type VistaPoint, type VistaTerrainRegion, type VistaBoundaryVertex } from './vista-terrain';

type Point = VistaPoint;
const CELL = 8;
function rows(csv: string, fields: number): string[][] {
  return csv.trim().split(/\r?\n/).slice(1).map(line => {
    const row = line.split(',');
    if (row.length !== fields) throw new Error('Invalid vista CSV row');
    return row;
  });
}
function number(value: string | undefined): number {
  const parsed = value?.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) throw new Error('Non-finite vista coordinate');
  return parsed;
}
const OUTLINE = shapeVistaBoundary(rows(outlineCSV, 3).map(row => ({ x: number(row[1]), y: number(row[2]) })), 781);
const ROCKS: VistaRockDefinition[] = rows(rocksCSV, 7).map(row => ({ id: row[0]!, x: number(row[1]), y: number(row[2]),
  radius: number(row[3]), height: number(row[4]), kind: row[5] as VistaRockKind, yaw: number(row[6]) }));
if (ROCKS.some(rock => !['shell', 'ridge', 'plates', 'debris'].includes(rock.kind))) throw new Error('Invalid vista landmark kind');
const HOLES: Point[][] = [];
const holeIds: string[] = [];
for (const row of rows(holesCSV, 4)) {
  const id = row[0]!;
  if (!holeIds.includes(id)) { holeIds.push(id); HOLES.push([]); }
  HOLES[holeIds.indexOf(id)]!.push({ x: number(row[2]), y: number(row[3]) });
}
for (let i = 0; i < HOLES.length; i++) HOLES[i] = shapeVistaBoundary(HOLES[i]!, 903 + i * 71);
const REGIONS: VistaTerrainRegion[] = rows(regionsCSV, 9).map(row => ({ id: row[0]!, label: row[1]!,
  x: number(row[2]), y: number(row[3]), height: number(row[4]), radiusX: number(row[5]), radiusY: number(row[6]),
  tint: row[7]!, landmark: row[8]! }));
const SECTIONS: VistaSection[] = rows(sectionsCSV, 9).map(row => ({ id: row[0]!, ring: number(row[1]),
  x: number(row[2]), y: number(row[3]), radius: number(row[4]), offsetX: number(row[5]), offsetY: number(row[6]),
  drop: number(row[7]), thickness: number(row[8]) }));
if (SECTIONS.some(section => !Number.isInteger(section.ring) || section.ring < 0 || section.ring > HOLES.length
  || section.radius <= 0 || section.drop <= 8 || section.thickness <= 0)) throw new Error('Invalid vista section');
const STRATA: VistaStratum[] = rows(strataCSV, 11).map(row => ({ id: row[0]!, region: row[1]!,
  kind: row[2] as VistaStratumKind, x: number(row[3]), y: number(row[4]), length: number(row[5]),
  width: number(row[6]), yaw: number(row[7]), rise: number(row[8]), exposure: number(row[9]), sediment: number(row[10]) }));
if (STRATA.some(bed => !['shoulder', 'ridge', 'fold', 'basin', 'fold-plane', 'channel'].includes(bed.kind)
  || !REGIONS.some(region => region.id === bed.region) || bed.length <= 0 || bed.width <= 0
  || bed.exposure < 0 || bed.exposure > 1 || bed.sediment < 0 || bed.sediment > 1)) throw new Error('Invalid vista strata');
const ROUTE_NODES = rows(routeNodesCSV, 4).map(row => ({ id: row[0]!, region: row[1]!, x: number(row[2]), y: number(row[3]) }));
const CONNECTORS = rows(connectorsCSV, 5).map(row => ({ id: row[0]!, from: row[1]!, to: row[2]!,
  nodes: row[3]!.split('|'), width: number(row[4]) }));
if (REGIONS.some(region => region.radiusX <= 0 || region.radiusY <= 0 || !/^[0-9a-f]{6}$/i.test(region.tint))
  || new Set(REGIONS.map(region => region.id)).size !== REGIONS.length
  || new Set(ROUTE_NODES.map(node => node.id)).size !== ROUTE_NODES.length
  || HOLES.some(hole => hole.length < 3)) throw new Error('Invalid vista region geometry');
for (const connection of CONNECTORS) {
  if (!REGIONS.some(region => region.id === connection.from) || !REGIONS.some(region => region.id === connection.to)
    || connection.width <= 20 || connection.nodes.length < 2
    || connection.nodes.some(id => !ROUTE_NODES.some(node => node.id === id))) throw new Error('Invalid vista route graph');
}


function terraceTexture(): THREE.DataTexture {
  const size=256, bytes=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const broad=noise(Math.floor((x+y*.2)/29),Math.floor(y/23),8);
    const cluster=noise(Math.floor(x/4),Math.floor(y/3),19);
    const variation=(broad-.5)*.095+(cluster-.5)*.052;
    const at=(y*size+x)*4;
    bytes[at]=Math.round(132*(1+variation));bytes[at+1]=Math.round(124*(1+variation));bytes[at+2]=Math.round(116*(1+variation));bytes[at+3]=255;
  }
  // A handful of interrupted seams; most of the walking surface stays quiet.
  for(let crack=0;crack<16;crack++) {
    const sx=Math.floor(noise(crack,1,312)*size),sy=Math.floor(noise(crack,2,312)*size);
    const length=6+Math.floor(noise(crack,3,312)*25);
    for(let step=0;step<length;step++) {
      if(noise(crack,Math.floor(step/4),413)<.17)continue;
      const x=(sx+step)%size,y=(sy+Math.floor(step*.22)+Math.floor(noise(crack,Math.floor(step/5),74)*2))%size;
      const at=(y*size+x)*4;bytes[at]=100;bytes[at+1]=93;bytes[at+2]=90;
    }
  }
  const texture=new THREE.DataTexture(bytes,size,size);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.needsUpdate=true;return texture;
}

function inside(point: Point, polygon: readonly Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) result = !result;
  }
  return result;
}
function edgeDistance(p: Point, polygon: readonly Point[]): number {
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i+1)%polygon.length]!;
    const dx = b.x-a.x, dy = b.y-a.y, t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
    distance = Math.min(distance, Math.hypot(p.x-a.x-dx*t, p.y-a.y-dy*t));
  }
  return distance;
}

/** The authored shelf owns movement; distant structures never grant support. */
export class LandmassVistaModel {
  readonly group = new THREE.Group();
  readonly width = 2200;
  readonly height = 1904;
  readonly spawn = { x: ROUTE_NODES[0]!.x, y: ROUTE_NODES[0]!.y };
  readonly focus = { x: 560, y: 1110, height: 0 };
  readonly span = 1120;
  readonly walk: TileGrid;
  readonly surface: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly groundHeightAt: (x: number, y: number) => number;
  private disposed = false;
  private readonly obstacles: Point[][] = [];
  private readonly rockMaterial: THREE.MeshStandardMaterial;
  private cliffMaterial: THREE.MeshStandardMaterial | undefined;

  constructor() {
    this.group.name = 'five-connected-living-shelves';
    const terrain = createVistaTerrain(OUTLINE, HOLES, REGIONS, STRATA);
    this.groundHeightAt = terrain.heightAt;
    const ground = createVistaMaterial('ground', terraceTexture());
    ground.vertexColors = true;
    this.surface = new THREE.Mesh(terrain.geometry, ground);
    this.surface.name = 'continuous-walkable-bedding';
    this.surface.receiveShadow = true;
    this.group.add(this.surface);
    this.makeCliff(terrain.boundaryRings);
    const rocks = createVistaRocks(ROCKS, this.groundHeightAt, (x, y) => this.contains(x, y));
    this.obstacles.push(...rocks.footprints);
    const rockMaterial = this.rockMaterial = createVistaMaterial('rock'); rockMaterial.vertexColors = true;
    const rockMesh = new THREE.Mesh(rocks.geometry, rockMaterial);
    rockMesh.name = 'mineral-landmarks-and-basal-flakes'; rockMesh.castShadow = true; rockMesh.receiveShadow = true;
    this.group.add(rockMesh);
    const cols = this.width / CELL, rows = this.height / CELL;
    this.walk = new TileGrid({ cols, rows, tileSize: CELL, tiles: Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => {
        const p = { x: (col + .5) * CELL, y: (row + .5) * CELL };
        // Whole-cell clearance plus the production AABB sweep protects the
        // complete actor, including along concave cliff edges.
        return this.contains(p.x, p.y) && [OUTLINE, ...HOLES].every(poly => edgeDistance(p, poly) > CELL * Math.SQRT1_2)
          && this.obstacles.every(poly => !inside(p, poly) && edgeDistance(p, poly) > CELL * Math.SQRT1_2)
          ? TileType.FLOOR : TileType.VOID;
      })) });
  }

  /** Ownership transfers to the model. This image is sediment only; bare
   * ground, embedded hard bodies and cliff sections keep their own coverage. */
  setSurfaceTexture(texture: THREE.Texture): void {
    this.replaceTexture(this.surface.material, texture);
  }

  /** Optional hard-body albedo, in rock-local bedding UVs. Ownership transfers
   * even when loading completes after destroy; that late asset is disposed. */
  setRockTexture(texture: THREE.Texture): void {
    if (this.disposed) { texture.dispose(); return; }
    this.replaceTexture(this.rockMaterial, texture);
    setVistaRockSampler(this.surface.material, texture);
    if (this.cliffMaterial) setVistaRockSampler(this.cliffMaterial, texture);
  }

  private replaceTexture(material: THREE.MeshStandardMaterial, texture: THREE.Texture): void {
    if (this.disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    const previous = material.map;
    material.map = texture; material.needsUpdate = true;
    if (previous && previous !== texture && previous !== this.surface.material.map && previous !== this.rockMaterial.map) previous.dispose();
  }

  contains(x: number, y: number): boolean {
    const point = { x, y };
    return inside(point, OUTLINE) && HOLES.every(hole => !inside(point, hole));
  }
  snapshot(): Record<string, unknown> {
    const bounds = this.surface.geometry.boundingBox!;
    return { type: 'five-connected-bedded-landmasses',
      outline: OUTLINE.map(p => ({ ...p })), holes: HOLES.map(hole => hole.map(p => ({ ...p }))),
      regions: REGIONS.map(region => ({ ...region, actualHeight: this.groundHeightAt(region.x, region.y) })), regionCount: REGIONS.length,
      strata: STRATA.map(bed => ({ ...bed })),
      sections: SECTIONS.map(section => ({ ...section })),
      materials: { ground: 'sediment at lee and basins; exposed broad shell from geometric strata weights',
        rock: 'local bedding UV, broad hard faces, basal deposit only', cliff: 'independent cross-section UV and localized geometric laminae',
        sharedCoverageMap: false, rockTextureLoaded: this.rockMaterial.map !== null },
      landmarks: ROCKS.map(rock => ({ ...rock })),
      connectors: CONNECTORS.map(connection => ({ ...connection, nodes: [...connection.nodes] })),
      routeNodes: ROUTE_NODES.map(node => ({ ...node, height: this.groundHeightAt(node.x, node.y) })),
      recommendedRoute: ['spawn', 'west-rise', 'west', 'upper-west', 'crown', 'upper-east', 'east', 'lower-east', 'lower', 'bottom', 'bottom-west', 'spawn',
        'west-rise', 'west', 'middle-west', 'middle', 'middle-east', 'east', 'lower-east', 'lower', 'bottom', 'bottom-west', 'spawn'],
      qaChecks: [{ id: 'upper-air-edge', node: 'middle', key: 'W', dx: 0, dy: -300, expected: 'void' },
        { id: 'lower-air-edge', node: 'middle', key: 'S', dx: 0, dy: 300, expected: 'void' },
        { id: 'outer-edge', node: 'arrival-look', key: 'S', dx: 0, dy: 300, expected: 'void' },
        { id: 'arrival-stone', node: 'spawn', key: 'A', dx: -240, dy: 0, expected: 'stone' }],
      alternateRoute: ['west', 'middle-west', 'middle', 'middle-east', 'east'],
      obstacles: this.obstacles.map(poly => poly.map(p => ({ ...p }))),
      world: { width: this.width, height: this.height },
      surfaceHeight: { min: bounds.min.y, max: bounds.max.y, sampling: 'actual-float32-triangle-barycentric' },
      cliffDepth: { outerBase: 128, innerBase: 85, variation: 'body thickness follows positive strata relief; section tapers into the underside' },
      boundaryTreatment: 'authored oblique shoulders and unequal shelves; restrained 4-11 unit local fracture, shared mesh and physical polygon',
      terrainTriangles: this.surface.geometry.getAttribute('position').count / 3,
      relation: 'a continuous low rock shelf and exposed bedding; remote structures never grant support',
      source: ['outline', 'holes', 'regions', 'route-nodes', 'connectors', 'rocks', 'strata', 'sections'].map(name => `data/living-landmass-vista-${name}.csv`) };
  }

  destroy(): void { if (!this.disposed) { this.disposed = true; disposeTree(this.group); } }

  private makeCliff(boundaryRings: readonly (readonly VistaBoundaryVertex[])[]): void {
    const geometry = createVistaCliff(boundaryRings, STRATA, SECTIONS);
    const material = this.cliffMaterial = createVistaMaterial('cliff');
    material.vertexColors = true; material.side = THREE.DoubleSide;
    material.emissive.setHex(0x8f8479); material.emissiveIntensity = .12;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'worn-lips-fractured-faces-and-tapering-bases';
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
  }
}
