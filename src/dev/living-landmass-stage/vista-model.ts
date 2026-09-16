import * as THREE from 'three';
import sectionsCSV from '../../../data/living-landmass-vista-sections.csv?raw';
import type { VistaSection } from './vista-sections';
import strataCSV from '../../../data/living-landmass-vista-strata.csv?raw';
import type { VistaStratum, VistaStratumKind } from './vista-strata';
import { createVistaMaterial, setVistaRockSampler } from './vista-material';
import outlineCSV from '../../../data/living-landmass-vista-outline.csv?raw';
import rocksCSV from '../../../data/living-landmass-vista-rocks.csv?raw';
import paintedFootprintsCSV from '../../../data/living-landmass-vista-painted-footprints.csv?raw';
import holesCSV from '../../../data/living-landmass-vista-holes.csv?raw';
import regionsCSV from '../../../data/living-landmass-vista-regions.csv?raw';
import routeNodesCSV from '../../../data/living-landmass-vista-route-nodes.csv?raw';
import connectorsCSV from '../../../data/living-landmass-vista-connectors.csv?raw';
import { createVistaCliff } from './vista-cliff';
import { createVistaRocks, type VistaRockDefinition, type VistaRockKind } from './vista-rocks';
import { VistaPaintedLandforms, type VistaHeroTextureOptions } from './vista-painted-landforms';
import { shapeVistaBoundary } from './vista-boundary';
import { TileGrid } from '@/systems/tile-grid';
import { TileType } from '@/types/game-types';
import { disposeTree } from '../spatial-study/stage/materials';
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
if (ROCKS.some(rock => !['shell', 'ridge', 'plates', 'debris', 'wall', 'fallen'].includes(rock.kind))) throw new Error('Invalid vista landmark kind');
// Authored from the painted body's grounded lower contour. The buried slab
// proxy remains a shadow caster, not a second, mismatched collision outline.
const PAINTED_FOOTPRINTS = new Map<string, Point[]>();
for (const row of rows(paintedFootprintsCSV, 4)) {
  const id = row[0]!;
  if (!ROCKS.some(rock => rock.id === id && rock.kind === 'fallen')) throw new Error('Unknown painted footprint owner');
  const points = PAINTED_FOOTPRINTS.get(id) ?? [];
  if (number(row[1]) !== points.length) throw new Error('Unordered painted footprint');
  points.push({ x: number(row[2]), y: number(row[3]) });
  PAINTED_FOOTPRINTS.set(id, points);
}
if (ROCKS.some(rock => rock.kind === 'fallen' && (PAINTED_FOOTPRINTS.get(rock.id)?.length ?? 0) < 3)) {
  throw new Error('Fallen body lacks an authored painted footprint');
}
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
const CONNECTORS = rows(connectorsCSV, 4).map(row => ({ id: row[0]!, from: row[1]!, to: row[2]!,
  nodes: row[3]!.split('|') }));
if (REGIONS.some(region => region.radiusX <= 0 || region.radiusY <= 0 || !/^[0-9a-f]{6}$/i.test(region.tint))
  || new Set(REGIONS.map(region => region.id)).size !== REGIONS.length
  || new Set(ROUTE_NODES.map(node => node.id)).size !== ROUTE_NODES.length
  || HOLES.some(hole => hole.length < 3)) throw new Error('Invalid vista region geometry');
for (const connection of CONNECTORS) {
  if (!REGIONS.some(region => region.id === connection.from) || !REGIONS.some(region => region.id === connection.to)
    || connection.nodes.length < 2
    || connection.nodes.some(id => !ROUTE_NODES.some(node => node.id === id))) throw new Error('Invalid vista route graph');
}


/** A deterministic edge-covering walk. All IDs come from the authored graph;
 * revisits backtrack physical branches, never jump to a disconnected node. */
function recommendedRoute(): string[] {
  const route = [ROUTE_NODES[0]!.id], visited = new Set<string>();
  const walk = (id: string): void => {
    for (const connection of CONNECTORS) {
      if (visited.has(connection.id)) continue;
      const chain = connection.nodes[0] === id ? connection.nodes
        : connection.nodes[connection.nodes.length - 1] === id ? [...connection.nodes].reverse() : null;
      if (!chain) continue;
      visited.add(connection.id);
      route.push(...chain.slice(1));
      walk(chain[chain.length - 1]!);
      route.push(...chain.slice(0, -1).reverse());
    }
  };
  walk(route[0]!);
  if (visited.size !== CONNECTORS.length) throw new Error('Disconnected vista route');
  return route;
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
  readonly focus = { x: 650, y: 1110, height: 0 };
  readonly span = 1120;
  readonly walk: TileGrid;
  readonly surface: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly groundHeightAt: (x: number, y: number) => number;
  private disposed = false;
  private readonly obstacles: Point[][] = [];
  private readonly rockMaterial: THREE.MeshStandardMaterial;
  private readonly paintedLandforms: VistaPaintedLandforms;
  private cliffMaterial: THREE.MeshStandardMaterial | undefined;

  constructor() {
    this.group.name = 'continuous-landform-and-uplifted-shells';
    const terrain = createVistaTerrain(OUTLINE, HOLES, REGIONS, STRATA);
    this.groundHeightAt = terrain.heightAt;
    const ground = createVistaMaterial('ground');
    ground.vertexColors = true;
    this.surface = new THREE.Mesh(terrain.geometry, ground);
    this.surface.name = 'continuous-walkable-bedding';
    this.surface.receiveShadow = true;
    this.group.add(this.surface);
    this.makeCliff(terrain.boundaryRings);
    const mainBodies = ROCKS.filter(rock => rock.kind === 'wall' || rock.kind === 'fallen');
    const rocks = createVistaRocks(mainBodies, this.groundHeightAt, (x, y) => this.contains(x, y));
    const beds = rocks.geometry.userData.beds as { id: string; kind: VistaRockKind }[];
    this.obstacles.push(...rocks.footprints.filter((_, index) => beds[index]?.kind !== 'fallen'));
    for (const points of PAINTED_FOOTPRINTS.values()) {
      if (points.some(point => !this.contains(point.x, point.y))) throw new Error('Painted footprint lacks terrain');
      this.obstacles.push(points.map(point => ({ ...point })));
    }
    const shadowMaterial = createVistaMaterial('rock');
    shadowMaterial.name = 'vista-main-solid-shadow-proxy-r8';
    shadowMaterial.colorWrite = false; shadowMaterial.depthWrite = false;
    const rockMesh = new THREE.Mesh(rocks.geometry, shadowMaterial);
    rockMesh.name = 'mineral-landmarks-and-basal-flakes'; rockMesh.castShadow = true;
    this.group.add(rockMesh);
    const fragments = createVistaRocks(ROCKS.filter(rock => rock.kind !== 'wall' && rock.kind !== 'fallen'),
      this.groundHeightAt, (x, y) => this.contains(x, y));
    this.obstacles.push(...fragments.footprints);
    const rockMaterial = this.rockMaterial = createVistaMaterial('rock'); rockMaterial.vertexColors = true;
    const fragmentMesh = new THREE.Mesh(fragments.geometry, rockMaterial);
    fragmentMesh.name = 'visible-source-fragments'; fragmentMesh.castShadow = true; fragmentMesh.receiveShadow = true;
    this.group.add(fragmentMesh);
    this.paintedLandforms = new VistaPaintedLandforms(mainBodies.map(rock => {
      const points = rocks.footprints.filter((_, index) => beds[index]?.id === rock.id).flat();
      if (!points.length) throw new Error(`Painted body lacks a solid footprint: ${rock.id}`);
      return { id: rock.id, role: rock.kind === 'wall' ? 'hero' : 'fallen', x: rock.x,
        frontZ: Math.max(...points.map(point => point.y)) };
    }), this.groundHeightAt);
    this.group.add(this.paintedLandforms.group);
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

  /** Ownership transfers to the model. The unique ground atlas is mapped once
   * over actual terrain bounds; it is never repeated on rocks or cliff faces. */
  setSurfaceTexture(texture: THREE.Texture): void {
    this.replaceTexture(this.surface.material, texture);
    if (!this.disposed) texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  }

  /** Painted hero assets transfer ownership, including late loads after destroy. */
  setHeroTextures(hero: THREE.Texture, fallen: THREE.Texture, options?: VistaHeroTextureOptions): void {
    this.paintedLandforms.setHeroTextures(hero, fallen, options);
  }

  /** Optional hard-body albedo, in rock-local bedding UVs. Ownership transfers
   * even when loading completes after destroy; that late asset is disposed. */
  setRockTexture(texture: THREE.Texture): void {
    if (this.disposed) { texture.dispose(); return; }
    this.replaceTexture(this.rockMaterial, texture);
    texture.wrapT = THREE.ClampToEdgeWrapping;
    setVistaRockSampler(this.rockMaterial, texture);
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
    const atlas = this.surface.material.map;
    const atlasImage = atlas?.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | undefined;
    const atlasBounds = (this.surface.material.userData.vistaAtlasBounds as { value?: THREE.Vector4 } | undefined)?.value;
    return { type: 'continuous-landscape-with-independent-exploration-routes',
      outline: OUTLINE.map(p => ({ ...p })), holes: HOLES.map(hole => hole.map(p => ({ ...p }))),
      regions: REGIONS.map(region => ({ ...region, actualHeight: this.groundHeightAt(region.x, region.y) })), regionCount: REGIONS.length,
      strata: STRATA.map(bed => ({ ...bed })),
      sections: SECTIONS.map(section => ({ ...section })),
      materials: { ground: 'unique authored land atlas mapped once over terrain bounds, not repeated',
        rock: 'painted hero cutouts over invisible solid shadow/collision proxies; small fragments retain painted shading',
        cliff: 'separate painted cut-face trim over actual geological section geometry',
        rendering: 'painted-assets-over-3d-r8', surfaceImageLoaded: this.surface.material.map !== null,
        sharedCoverageMap: false, rockTextureLoaded: this.rockMaterial.map !== null },
      paintedLandforms: this.paintedLandforms.snapshot(),
      paintedFootprints: [...PAINTED_FOOTPRINTS].map(([id, points]) => ({ id,
        source: 'data/living-landmass-vista-painted-footprints.csv',
        relation: 'wide shallow base aligned to the painted lower contour; independent of buried shadow slabs',
        points: points.map(point => ({ ...point })) })),
      surfaceAtlas: { loaded: atlas !== null,
        imageSize: atlasImage ? { width: atlasImage.naturalWidth || atlasImage.width || 0,
          height: atlasImage.naturalHeight || atlasImage.height || 0 } : null,
        bounds: atlasBounds ? { minX: atlasBounds.x, minZ: atlasBounds.y, width: atlasBounds.z, depth: atlasBounds.w } : null,
        geometryBounds: { minX: bounds.min.x, minZ: bounds.min.z, maxX: bounds.max.x, maxZ: bounds.max.z },
        wrap: atlas ? { s: atlas.wrapS, t: atlas.wrapT } : null,
        repeat: atlas?.repeat.toArray() ?? null, offset: atlas?.offset.toArray() ?? null },
      mainSolidProxies: { colorWrite: false, depthWrite: false, castShadow: true, collisionRetained: true,
        collision: 'wall bed footprints; fallen independent painted base footprint' },
      landmarks: ROCKS.map(rock => ({ ...rock })),
      connectors: CONNECTORS.map(connection => ({ ...connection, nodes: [...connection.nodes] })),
      routeNodes: ROUTE_NODES.map(node => ({ ...node, height: this.groundHeightAt(node.x, node.y) })),
      topology: { geometryFromRoutes: false,
        routeSegments: CONNECTORS.reduce((sum, connection) => sum + connection.nodes.length - 1, 0),
        independentLoops: CONNECTORS.reduce((sum, connection) => sum + connection.nodes.length - 1, 0) - ROUTE_NODES.length + 1 },
      recommendedRoute: recommendedRoute(),
      qualityRoute: ['spawn', 'split', 'west', 'look', 'rejoin', 'upper-turn', 'east', 'gap', 'wall-front', 'split'],
      qaChecks: [{ id: 'main-shell-wall', node: 'wall-front', key: 'W', dx: 0, dy: -330, expected: 'stone' },
        { id: 'fallen-rib', node: 'basin', key: 'W', dx: 0, dy: -280, expected: 'stone' },
        { id: 'western-cliff', node: 'west', key: 'A', dx: -500, dy: 0, expected: 'void' },
        { id: 'southern-cliff', node: 'spawn', key: 'S', dx: 0, dy: 400, expected: 'void' }],
      alternateRoute: ['split', 'wall-front', 'gap', 'basin', 'lower-turn', 'outer', 'east-join', 'east', 'upper-turn', 'rejoin', 'look', 'west', 'split'],
      obstacles: this.obstacles.map(poly => poly.map(p => ({ ...p }))),
      world: { width: this.width, height: this.height },
      surfaceHeight: { min: bounds.min.y, max: bounds.max.y, sampling: 'actual-float32-triangle-barycentric' },
      cliffDepth: { variation: 'broad geological body: 92 + positive relief × 1.4 + local section thickness × .5' },
      boundaryTreatment: 'independently authored broad land boundary; shared Float32 lip and physical boundary',
      terrainTriangles: this.surface.geometry.getAttribute('position').count / 3,
      relation: 'one broad supported landscape; solid uplift and fallen body organize independent detours; scenic undersides never grant support',
      source: ['outline', 'holes', 'regions', 'route-nodes', 'connectors', 'rocks', 'strata', 'sections', 'painted-footprints'].map(name => `data/living-landmass-vista-${name}.csv`) };
  }

  destroy(): void { if (!this.disposed) { this.disposed = true; this.paintedLandforms.destroy(); disposeTree(this.group); } }

  private makeCliff(boundaryRings: readonly (readonly VistaBoundaryVertex[])[]): void {
    const geometry = createVistaCliff(boundaryRings, STRATA, SECTIONS);
    const material = this.cliffMaterial = createVistaMaterial('cliff');
    material.vertexColors = true; material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'worn-lips-fractured-faces-and-tapering-bases';
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
  }
}
