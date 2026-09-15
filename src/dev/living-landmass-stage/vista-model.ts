import * as THREE from 'three';
import outlineCSV from '../../../data/living-landmass-vista-outline.csv?raw';
import rocksCSV from '../../../data/living-landmass-vista-rocks.csv?raw';
import holesCSV from '../../../data/living-landmass-vista-holes.csv?raw';
import regionsCSV from '../../../data/living-landmass-vista-regions.csv?raw';
import routeNodesCSV from '../../../data/living-landmass-vista-route-nodes.csv?raw';
import connectorsCSV from '../../../data/living-landmass-vista-connectors.csv?raw';
import { TileGrid } from '@/systems/tile-grid';
import { TileType } from '@/types/game-types';
import { disposeTree, noise } from '../spatial-study/stage/materials';
import { createVistaTerrain, VISTA_EDGE_SEGMENTS, type VistaPoint, type VistaTerrainRegion } from './vista-terrain';

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
const OUTLINE = rows(outlineCSV, 3).map(row => ({ x: number(row[1]), y: number(row[2]) }));
const ROCKS = rows(rocksCSV, 5).map(row => ({ id: row[0]!, x: number(row[1]), y: number(row[2]),
  radius: number(row[3]), height: number(row[4]) }));
const HOLES: Point[][] = [];
const holeIds: string[] = [];
for (const row of rows(holesCSV, 4)) {
  const id = row[0]!;
  if (!holeIds.includes(id)) { holeIds.push(id); HOLES.push([]); }
  HOLES[holeIds.indexOf(id)]!.push({ x: number(row[2]), y: number(row[3]) });
}
const REGIONS: VistaTerrainRegion[] = rows(regionsCSV, 9).map(row => ({ id: row[0]!, label: row[1]!,
  x: number(row[2]), y: number(row[3]), height: number(row[4]), radiusX: number(row[5]), radiusY: number(row[6]),
  tint: row[7]!, landmark: row[8]! }));
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
  private readonly texturedMaterials: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.group.name = 'five-connected-living-shelves';
    const terrain = createVistaTerrain(OUTLINE, HOLES, REGIONS);
    this.groundHeightAt = terrain.heightAt;
    const ground = this.material(0xffffff, terraceTexture());
    ground.vertexColors = true;
    this.surface = new THREE.Mesh(terrain.geometry, ground);
    this.surface.name = 'continuous-walkable-bedding';
    this.surface.receiveShadow = true;
    this.group.add(this.surface);
    this.makeCliff();
    for (const rock of ROCKS) {
      if (rock.radius <= 0 || rock.height <= 0) throw new Error('Invalid vista rock dimensions');
      this.makeRockCluster(rock.x, rock.y, rock.radius, rock.height, rock.id);
    }
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

  /** Ownership transfers to this model. Terrain and rock share one physical
   * pigment scale, with their UVs expressed directly in world units. */
  setSurfaceTexture(texture: THREE.Texture): void {
    if (this.disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    const previous = new Set<THREE.Texture>();
    for (const material of this.texturedMaterials) {
      if (material.map && material.map !== texture) previous.add(material.map);
      material.map = texture; material.needsUpdate = true;
    }
    previous.forEach(map => map.dispose());
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
      cliffDepth: { outer: 108, inner: 77.76 },
      terrainTriangles: this.surface.geometry.getAttribute('position').count / 3,
      relation: 'a continuous low rock shelf and exposed bedding; remote structures never grant support',
      source: ['outline', 'holes', 'regions', 'route-nodes', 'connectors', 'rocks'].map(name => `data/living-landmass-vista-${name}.csv`) };
  }

  destroy(): void { if (!this.disposed) { this.disposed = true; disposeTree(this.group); } }

  private material(color: number, map = this.surface?.material.map): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, map, roughness: 1, metalness: 0 });
    // Preserve the generated bedding marks while lifting its deepest pigment
    // fissures. This remaps albedo before lighting, not the real contact shadow.
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vVistaBed;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n vVistaBed = position;');
      shader.fragmentShader = 'varying vec3 vVistaBed;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb = diffuseColor.rgb * .86 + vec3(.022);
        float mineralZone = exp(-dot((vVistaBed.xz-vec2(370.,825.))/vec2(240.,300.),
          (vVistaBed.xz-vec2(370.,825.))/vec2(240.,300.)));
        float mineralPhase = vVistaBed.x*.036 + vVistaBed.z*.009 + sin(vVistaBed.z*.012)*2.4;
        float mineral = (1.-smoothstep(.06,.24,abs(sin(mineralPhase)))) * mineralZone;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.48,.43,.32), mineral*.27);
        float fibreZone = exp(-dot((vVistaBed.xz-vec2(1770.,790.))/vec2(270.,390.),
          (vVistaBed.xz-vec2(1770.,790.))/vec2(270.,390.)));
        float fibre = smoothstep(.84,.99,sin(vVistaBed.z*.032 + vVistaBed.x*.008 + sin(vVistaBed.x*.011)));
        diffuseColor.rgb *= 1. - fibre*fibreZone*.10;`);
    };
    material.customProgramCacheKey = () => 'vista-bedded-albedo-r4';
    this.texturedMaterials.push(material);
    return material;
  }

  private makeCliff(): void {
    // Both outer and inner rims are real geometry. Every edge has exactly
    // the top mesh subdivision count; void holes do not acquire a false lid.
    const rims = [OUTLINE, ...HOLES].map((outline, ring) => {
      const points: Point[] = [];
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
        for (let j = 0; j < VISTA_EDGE_SEGMENTS; j++) points.push({
          x: a.x + (b.x - a.x) * j / VISTA_EDGE_SEGMENTS,
          y: a.y + (b.y - a.y) * j / VISTA_EDGE_SEGMENTS });
      }
      const center = outline.reduce((sum, p) => ({ x: sum.x + p.x / outline.length, y: sum.y + p.y / outline.length }), { x: 0, y: 0 });
      return { points, center, direction: ring === 0 ? 1 : -1 };
    });
    const depths = [0, -6, -16, -21, -39, -45, -65, -87, -108];
    const ledges = [0, 1, -2, 2, -3, 1, -4, -8, -12];
    const palette = [0xd0c4b7, 0xc6baae, 0xcbbfb3, 0xc2b6aa, 0xc1b5a9, 0xbeb3a8, 0xb7aca2, 0xb3a9a0];
    const layerPoint = (p: Point, level: number, center: Point, direction: number): THREE.Vector3 => {
      const phase = p.x * .011 + p.y * .007;
      const outward = ledges[level]! + (level ? Math.sin(phase * 1.3 + level) * 3 : 0);
      const dx = (p.x - center.x) * direction, dy = (p.y - center.y) * direction, length = Math.hypot(dx, dy);
      return new THREE.Vector3(p.x + dx / length * outward,
        this.groundHeightAt(p.x, p.y) + depths[level]! * (direction < 0 ? .72 : 1) + (level ? Math.sin(phase) * Math.min(level * 1.4, 8) : 0),
        p.y + dy / length * outward);
    };
    for (let layer = 0; layer < depths.length - 1; layer++) {
      const positions: number[] = [], uv: number[] = [];
      let distance = 0;
      for (const rim of rims) for (let i = 0; i < rim.points.length; i++) {
        const p = rim.points[i]!, q = rim.points[(i + 1) % rim.points.length]!;
        const nextDistance = distance + Math.hypot(p.x - q.x, p.y - q.y);
        const a = layerPoint(p, layer, rim.center, rim.direction), b = layerPoint(q, layer, rim.center, rim.direction);
        const c = layerPoint(p, layer + 1, rim.center, rim.direction), d = layerPoint(q, layer + 1, rim.center, rim.direction);
        for (const v of [a, b, c, b, d, c]) positions.push(v.x, v.y, v.z);
        uv.push(distance / 744, a.y / 744, nextDistance / 744, b.y / 744, distance / 744, c.y / 744,
          nextDistance / 744, b.y / 744, nextDistance / 744, d.y / 744, distance / 744, c.y / 744);
        distance = nextDistance;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.computeVertexNormals();
      const material = this.material(palette[layer]!); material.side = THREE.DoubleSide;
      // Low broad indirect fill keeps unlit cut faces readable without erasing
      // actual directional/contact shadows or painting the holes black.
      material.emissive.setHex(0x8f8479); material.emissiveIntensity = .20;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `cliff-bedding-${layer}`; mesh.receiveShadow = true; mesh.castShadow = true;
      this.group.add(mesh);
    }
  }

  private makeRockCluster(x: number, y: number, radius: number, height: number, id: string): void {
    // Two fractured bedding plates meet obliquely. Their separate, offset
    // crowns avoid turning each cluster into concentric stacked discs.
    this.makeRock(x - radius * .22, y - radius * .17, radius * .77, height, `${id}-upper-plate`, 0);
    this.makeRock(x + radius * .33, y + radius * .24, radius * .66, height * .57, `${id}-lower-plate`, 4);
    // Low broken plates sit beside the same bed. Every visible fragment owns
    // its real footprint; no decorative platforms float over traversable ground.
    for (let i = 0; i < 3; i++) {
      const angle = .55 + i * 2.07;
      const fx = x + Math.cos(angle) * radius * (1.12 + i * .07);
      const fy = y + Math.sin(angle) * radius * .70;
      const r = radius * (.14 + i * .025);
      if (this.contains(fx, fy) && [OUTLINE, ...HOLES].every(poly => edgeDistance({ x: fx, y: fy }, poly) > r + 4)) {
        this.makeRock(fx, fy, r, height * (.13 + i * .035), `${id}-flake-${i}`, i + 1);
      }
    }
  }

  private makeRock(x: number, y: number, radius: number, height: number, id: string, variant: number): void {
    const rotation = -.45 + noise(x, y, 83) * .70 + (variant === 4 ? .52 : 0);
    const corners = [[-1, -.28], [-.64, -.56], [.24, -.48], [.95, -.2], [.78, .35], [.12, .61], [-.83, .36]];
    const polygon = corners.map((corner, i) => {
      const rx = corner[0]! * radius * (.90 + noise(i, x, 13 + variant) * .10);
      const ry = corner[1]! * radius * (.90 + noise(i, y, 26) * .10);
      return { x: x + rx * Math.cos(rotation) - ry * Math.sin(rotation),
        y: y + rx * Math.sin(rotation) + ry * Math.cos(rotation) };
    });
    this.obstacles.push(polygon);
    const levels = [0, .16, 1];
    const scales = [1, .96, .82];
    const points: THREE.Vector3[][] = levels.map((level, layer) => polygon.map((p, i) => {
      const inset = scales[layer]! - (layer === 2 ? noise(i, x, 127) * .12 : 0);
      const px = x + (p.x - x) * inset - radius * level * .10;
      const py = y + (p.y - y) * inset + radius * level * .06;
      // Broad tilt with a broken low end, rather than one level circular cap.
      const tilt = ((p.x - x) / radius * .29 - (p.y - y) / radius * .18);
      const brokenEnd = i === 3 || i === 4 ? .20 : 0;
      return new THREE.Vector3(px, this.groundHeightAt(px, py)
        + level * height * (1 + tilt - brokenEnd), py);
    }));
    const positions: number[] = [], uv: number[] = [], colors: number[] = [];
    const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: number): void => {
      const shade = new THREE.Color(color);
      for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); uv.push((p.x + p.y * .3) / 744, (p.z + p.y) / 744);
        colors.push(shade.r, shade.g, shade.b); }
    };
    const palette = [0xb9ada0, 0xbeb3a7];
    for (let layer = 0; layer < levels.length - 1; layer++) for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      triangle(points[layer]![i]!, points[layer + 1]![i]!, points[layer]![j]!, palette[layer]!);
      triangle(points[layer]![j]!, points[layer + 1]![i]!, points[layer + 1]![j]!, palette[layer]!);
    }
    const top = points[points.length - 1]!;
    for (let i = 1; i < polygon.length - 1; i++) triangle(top[0]!, top[i + 1]!, top[i]!, 0xe0d3c2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = this.material(0xffffff); material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = id; mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
  }
}
