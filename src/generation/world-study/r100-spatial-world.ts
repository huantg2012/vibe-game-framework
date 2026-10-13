/** Revision 7: authored macro arrangements populated with each world's own
 * material constructions. Terrain and extraction are frozen departure inputs. */
import { GAME_CONSTANTS } from '@/config/constants';
import { R100_SPATIAL_CONFIG as CONFIG, R100_SPATIAL_PLACEMENTS, R100_SPATIAL_EROSION,
  R100_SPATIAL_ANCHORS, R100_SPATIAL_WORLDS, R100_SPATIAL_MATERIALS, R100_SPATIAL_SOURCE_HASH, R100_SPATIAL_ORGANIZATIONS, R100_SPATIAL_AUTHORED_GROUPS, R100_SPATIAL_SECTORS } from '@/generated/r100-spatial-data';
import { mix32 } from '@/generation/seed-fork';
import { bodyHasSupport } from '@/systems/ai/physical-grid';
import { TileType, type Vector2 } from '@/types/game-types';
import { createMasterWorld, type MasterDefinition, type MasterWorld } from './r100-master-world';
import { validateNativeErosion, validateNativeTerrainOutline, FRAGMENT_TERRAIN_BUDGET } from './native-volume-erosion';
import { R100_FRAGMENT_AUTHORING, R100_FRAGMENT_SOURCE_HASH } from '@/generated/r100-fragment-data';
import { compileR100FragmentShape, freezeR100FragmentShape } from './r100-fragment-shape';
import type { PollutionGradeDefinition } from './pollution-grade';
import type { WorldProfile } from './types';
import { buildSpatialExtractionField, selectSpatialExtraction } from './spatial-extraction-selection';
import { getR100SpatialDeploymentPolicy, validateR100SpatialDeploymentPolicy } from './r100-spatial-deployment';
import type { R100SpatialPolicy } from './r100-spatial-types';
import { compileNativeTerrain } from './native-terrain';
import { augmentSpatialTerrain } from './spatial-augmentation-selection';
import { deriveSpatialAugmentationSeed } from './spatial-augmentation-candidates';
import type { SpatialAugmentationPolicy } from './spatial-augmentation-types';
export type { R100SpatialPolicy } from './r100-spatial-types';

export function createR100SpatialPolicy(worldId: string, requestedSeed: number): R100SpatialPolicy {
  const world = R100_SPATIAL_WORLDS.find(row => row.worldId === worldId);
  if (!world) throw new Error(`No spatial arrangement for ${worldId}`);
  const organization = R100_SPATIAL_ORGANIZATIONS.find(row => row.organization === world.organization);
  if (!organization) throw new Error(`No spatial organization rules for ${world.organization}`);
  const { organization: _organization, placementJitterPx, ...organizationRules } = organization;
  const group = R100_SPATIAL_AUTHORED_GROUPS.find(row => row.worldId === worldId);
  const sectors = R100_SPATIAL_SECTORS.find(row => row.worldId === worldId);
  const terrainOutline = sectors && 'terrainOutline' in sectors ? sectors.terrainOutline : undefined;
  const fragmentAuthoring = R100_FRAGMENT_AUTHORING.find(row => row.worldId === worldId);
  const fragmentShape = fragmentAuthoring ? freezeR100FragmentShape(fragmentAuthoring, R100_FRAGMENT_SOURCE_HASH, requestedSeed) : undefined;
  const fragment = fragmentShape ? compileR100FragmentShape(fragmentShape, requestedSeed) : undefined;
  const policy: R100SpatialPolicy = {
    version: fragment ? 2 : 1, worldId, sourceHash: R100_SPATIAL_SOURCE_HASH, organization: world.organization,
    organizationRules: sectors?.organizationRules ?? (group ? { ...organizationRules, solidCount: group.solidCount, reliefCount: group.reliefCount } : organizationRules),
    groupTransform: group?.transform ?? null,
    cols: CONFIG.cols, rows: CONFIG.rows, mirrorX: world.mirrorX, mirrorY: world.mirrorY,
    placementJitterPx: sectors?.placementJitterPx ?? placementJitterPx,
    placements: sectors?.placements ?? group?.placements ?? R100_SPATIAL_PLACEMENTS.filter(row => row.organization === world.organization).map(({ organization: _organization, ...placement }) => placement),
    materials: R100_SPATIAL_MATERIALS,
    erosion: fragment?.erosion ?? sectors?.erosion ?? group?.erosion ?? R100_SPATIAL_EROSION.filter(row => row.organization === world.organization).map(row => row.points),
    ...(fragment ? {terrainOutline: fragment.terrainOutline, fragmentShape} : terrainOutline === undefined ? {} : { terrainOutline }),
    spawnCandidates: sectors?.spawnCandidates ?? R100_SPATIAL_ANCHORS.filter(row => row.organization === world.organization).map(({ x, y }) => ({ x, y })),
    extraction: {
      minPathDistancePx: CONFIG.extraction_min_path_distance, minEuclideanDistancePx: CONFIG.extraction_min_euclidean_distance,
      minPathFraction: CONFIG.extraction_min_path_fraction, maxPathFraction: CONFIG.extraction_max_path_fraction,
      clearanceHalfSize: CONFIG.extraction_clearance_half_size, regionCols: CONFIG.extraction_region_cols,
      regionRows: CONFIG.extraction_region_rows, distanceBands: CONFIG.extraction_distance_bands,
    },
    deployment: getR100SpatialDeploymentPolicy(),
  };
  if (!validR100SpatialPolicy(policy, worldId, requestedSeed)) throw new Error(`Invalid authored spatial policy for ${worldId}`);
  return structuredClone(policy);
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value: object, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const range = (value: unknown, lo: number, hi: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi;
const integer = (value: unknown, lo: number, hi: number): value is number => range(value, lo, hi) && Number.isInteger(value);

/** Structural and bounded validation of the saved value only. Never compare a
 * frozen policy with current CSV contents, world assignments or source hashes. */
export function validR100SpatialPolicy(value: unknown, worldId: string, requestedSeed?: number): value is R100SpatialPolicy {
  try {
    if (!object(value) || !keysAre(value, ['version', 'worldId', 'sourceHash', 'organization', 'organizationRules', 'groupTransform', 'cols', 'rows', 'mirrorX', 'mirrorY', 'placementJitterPx', 'placements', 'materials', 'erosion', 'spawnCandidates', 'extraction', 'deployment',
      ...(Object.prototype.hasOwnProperty.call(value, 'terrainOutline') ? ['terrainOutline'] : []),
      ...(Object.prototype.hasOwnProperty.call(value, 'fragmentShape') ? ['fragmentShape'] : [])])
      || (value.version !== 1 && value.version !== 2) || value.worldId !== worldId || !/^[a-z][a-z0-9-]+$/.test(worldId)
      || typeof value.sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.sourceHash)
      || !['offset-divides', 'broken-bay', 'staggered-reaches', 'single-buttress', 'joined-quarters', 'authored-group', 'authored-sectors'].includes(value.organization as string)
      || !integer(value.cols, 48, 96) || !integer(value.rows, 36, 72) || value.cols * value.rows * 1024 > 4194304
      || typeof value.mirrorX !== 'boolean' || typeof value.mirrorY !== 'boolean' || !range(value.placementJitterPx, 0, 24)) return false;
    const width = value.cols * 32, height = value.rows * 32;
    const hasFragment = Object.prototype.hasOwnProperty.call(value, 'fragmentShape');
    if ((value.version === 2) !== hasFragment) return false;
    const fragment = hasFragment ? compileR100FragmentShape(value.fragmentShape, requestedSeed) : undefined;
    if (fragment && (value.organization !== 'authored-sectors' || value.mirrorX || value.mirrorY
      || fragment.snapshot.layout.authoringFrame[0] * fragment.snapshot.layout.worldScale !== width
      || fragment.snapshot.layout.authoringFrame[1] * fragment.snapshot.layout.worldScale !== height
      || JSON.stringify(value.terrainOutline) !== JSON.stringify(fragment.terrainOutline)
      || JSON.stringify(value.erosion) !== JSON.stringify(fragment.erosion))) return false;
    const rules = value.organizationRules;
    if (!object(rules) || !keysAre(rules, ['sourceMode', 'materialScaling', 'solidCount', 'reliefCount'])
      || !['repeat', 'source-once'].includes(rules.sourceMode as string) || typeof rules.materialScaling !== 'boolean'
      || !integer(rules.solidCount, 1, 32) || !integer(rules.reliefCount, 0, 16)
      || rules.sourceMode === 'repeat' && rules.solidCount < 12) return false;
    const group = value.groupTransform;
    if (value.organization === 'authored-group') {
      if (!object(group) || !keysAre(group, ['scale', 'sourceX', 'sourceY', 'targetX', 'targetY'])
        || !range(group.scale, 1, 2) || !range(group.sourceX, 0, 2048) || !range(group.sourceY, 0, 2048)
        || !range(group.targetX, 0, width) || !range(group.targetY, 0, height)
        || rules.sourceMode !== 'source-once' || rules.materialScaling || value.placementJitterPx !== 0 || value.mirrorX || value.mirrorY) return false;
    } else if (group !== null) return false;
    const point = (p: unknown): boolean => object(p) && keysAre(p, ['x', 'y']) && range(p.x, 0, width) && range(p.y, 0, height);
    if (!Array.isArray(value.placements) || value.placements.length !== rules.solidCount + rules.reliefCount || value.placements.length > 48
      || !Array.isArray(value.materials) || value.materials.length < 6 || value.materials.length > 32
      || !Array.isArray(value.spawnCandidates) || value.spawnCandidates.length < 6 || value.spawnCandidates.length > 32 || !value.spawnCandidates.every(point)
      || !Array.isArray(value.erosion) || (fragment ? value.erosion.length > FRAGMENT_TERRAIN_BUDGET.maxPolygons : value.erosion.length < 4 || value.erosion.length > 12)) return false;
    const ids = new Set<number>();
    for (const p of value.placements) {
      if (!object(p) || !keysAre(p, ['id', 'role', 'sourceIndex', 'x', 'y', 'rotation', 'length', 'width'])
        || !integer(p.id, 1, 10000) || ids.has(p.id) || !['solid', 'relief'].includes(p.role as string)
        || !integer(p.sourceIndex, 0, 31) || !range(p.x, 32, width - 32) || !range(p.y, 32, height - 32)
        || !range(p.rotation, -Math.PI * 2, Math.PI * 2) || !range(p.length, 16, 2048) || !range(p.width, 12, 2048)) return false;
      ids.add(p.id);
    }
    if (value.placements.filter(p => p.role === 'solid').length !== rules.solidCount
      || value.placements.filter(p => p.role === 'relief').length !== rules.reliefCount) return false;
    if (rules.sourceMode === 'source-once') for (const role of ['solid', 'relief']) {
      const placements = value.placements.filter(p => p.role === role);
      if (placements.some(p => p.sourceIndex >= placements.length) || new Set(placements.map(p => p.sourceIndex)).size !== placements.length) return false;
    }
    const shapeKeys = new Set<string>();
    for (const m of value.materials) {
      if (!object(m) || !keysAre(m, ['key', 'lengthScale', 'widthScale']) || typeof m.key !== 'string' || !/^[a-z][a-z-]+$/.test(m.key)
        || shapeKeys.has(m.key) || !range(m.lengthScale, .5, 2) || !range(m.widthScale, .5, 3)) return false;
      shapeKeys.add(m.key);
    }
    const budget = fragment ? FRAGMENT_TERRAIN_BUDGET : undefined;
    if (value.erosion.some(polygon => !Array.isArray(polygon) || polygon.length < 3 || polygon.length > (budget?.maxPoints ?? 32) || !polygon.every(point))) return false;
    validateNativeErosion(value.erosion, width, height, budget);
    if (Object.prototype.hasOwnProperty.call(value, 'terrainOutline')) {
      if (value.organization !== 'authored-sectors') return false;
      validateNativeTerrainOutline(value.terrainOutline, width, height, value.erosion, budget);
    }
    const e = value.extraction;
    if (!object(e) || !keysAre(e, ['minPathDistancePx', 'minEuclideanDistancePx', 'minPathFraction', 'maxPathFraction', 'clearanceHalfSize', 'regionCols', 'regionRows', 'distanceBands'])
      || !range(e.minPathDistancePx, 700, 8000) || !range(e.minEuclideanDistancePx, 400, 2000)
      || !range(e.minPathFraction, .1, .8) || !range(e.maxPathFraction, .5, 1) || e.minPathFraction >= e.maxPathFraction
      || !range(e.clearanceHalfSize, 20, 80) || !integer(e.regionCols, 2, 8) || !integer(e.regionRows, 2, 8) || !integer(e.distanceBands, 2, 8)) return false;
    validateR100SpatialDeploymentPolicy(value.deployment);
    return true;
  } catch { return false; }
}

export function createR100SpatialDefinition(native: MasterDefinition, policy: R100SpatialPolicy, seed: number): { definition: MasterDefinition; spawnIndex: number } {
  if (Object.prototype.hasOwnProperty.call(native, 'terrainOutline') || Object.prototype.hasOwnProperty.call(native, 'fragmentShapeVersion'))
    throw new Error('The source mother form cannot override the frozen spatial terrain outline');
  const width = policy.cols * 32, height = policy.rows * 32;
  const transform = (p: Readonly<Vector2>): Vector2 => ({ x: policy.mirrorX ? width - p.x : p.x, y: policy.mirrorY ? height - p.y : p.y });
  const solids = native.instances.filter(instance => instance.role === 'solid');
  const reliefs = native.instances.filter(instance => instance.role === 'relief');
  if (!solids.length) throw new Error('Spatial arrangement requires the source world to define real solid material');
  const sourceOnce = policy.organizationRules.sourceMode === 'source-once';
  if (sourceOnce && (solids.length !== policy.organizationRules.solidCount || reliefs.length !== policy.organizationRules.reliefCount))
    throw new Error('Source-once spatial arrangement must preserve every authored instance exactly once');
  const edgeOwner = reliefs.find(instance => instance.groundEdgeWidth !== undefined);
  let edgeAssigned = false;
  const placements = [...policy.placements].sort((a, b) => (a.role === 'relief' ? 0 : 1) - (b.role === 'relief' ? 0 : 1) || a.id - b.id);
  const instances: MasterDefinition['instances'][number][] = [];
  for (const p of placements) {
    const sources = p.role === 'solid' ? solids : reliefs;
    if (!sources.length) continue;
    // Exactly one first primary-material relief keeps v4 terrain-edge ownership.
    const source = sourceOnce ? sources[p.sourceIndex]!
      : p.role === 'relief' && edgeOwner && !edgeAssigned ? edgeOwner : sources[p.sourceIndex % sources.length]!;
    const group = policy.groupTransform;
    if (group && (p.id !== source.id || Math.abs(p.x - (group.targetX + (source.x - group.sourceX) * group.scale)) > 1e-6
      || Math.abs(p.y - (group.targetY + (source.y - group.sourceY) * group.scale)) > 1e-6 || p.rotation !== source.rotation
      || Math.abs(p.length - source.length * group.scale) > 1e-6 || Math.abs(p.width - source.width * group.scale) > 1e-6))
      throw new Error('Whole-group spatial placement diverges from its frozen source transform');
    const { groundEdgeWidth: _groundEdgeWidth, ...geometry } = source;
    const style = policy.materials.find(row => row.key === (source.shapeProfile ?? source.family ?? native.family))
      ?? policy.materials.find(row => row.key === (source.family ?? native.family));
    if (!style) throw new Error(`No frozen spatial material proportions for ${source.shapeProfile ?? source.family ?? native.family}`);
    const jitter = (axis: string): number => ((mix32(seed, `spatial-${policy.worldId}-${p.id}-${axis}`) / 0xffffffff) * 2 - 1) * policy.placementJitterPx;
    const center = transform({ x: p.x + jitter('x'), y: p.y + jitter('y') });
    let rotation = p.rotation;
    if (policy.mirrorX) rotation = Math.PI - rotation;
    if (policy.mirrorY) rotation = -rotation;
    const instance: MasterDefinition['instances'][number] = {
      ...geometry, id: p.id, role: p.role, ...center, rotation,
      length: p.length * (p.role === 'solid' && policy.organizationRules.materialScaling ? style.lengthScale : 1),
      width: p.width * (p.role === 'solid' && policy.organizationRules.materialScaling ? style.widthScale : 1),
      ...(p.role === 'relief' && edgeOwner && !edgeAssigned && (!sourceOnce || source === edgeOwner) ? { groundEdgeWidth: edgeOwner.groundEdgeWidth } : {}),
    };
    if (instance.groundEdgeWidth !== undefined) edgeAssigned = true;
    instances.push(instance);
  }
  const spawnIndex = policy.spawnCandidates.map((_, index) => ({ index, order: mix32(seed, `spatial-spawn-${policy.worldId}-${index}`) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)[0]!.index;
  const spawn = transform(policy.spawnCandidates[spawnIndex]!);
  const search = transform({ x: width * .5, y: height * .68 }), enemy = transform({ x: width * .7, y: height * .55 });
  return { spawnIndex, definition: { ...native, cols: policy.cols, rows: policy.rows, seed,
    spawn_x: spawn.x, spawn_y: spawn.y, exit_x: spawn.x, exit_y: spawn.y,
    search_x: search.x, search_y: search.y, enemy_x: enemy.x, enemy_y: enemy.y,
    instances, erosion: policy.erosion.map(polygon => polygon.map(transform)),
    ...(policy.terrainOutline === undefined ? {} : { terrainOutline: policy.terrainOutline.map(transform) }),
    ...(policy.fragmentShape === undefined ? {} : {fragmentShapeVersion: policy.fragmentShape.algorithmVersion}),
  } };
}

/** Keep the temporary multi-megapixel raster out of the final-build scope.
 * Only small placement/metric data survives this phase. */
function inspectSpatialTerrain(definition: MasterDefinition, policy: R100SpatialPolicy, seed: number,
  _options: Parameters<typeof createMasterWorld>[2]) {
  const terrain = compileNativeTerrain(definition, seed, false);
  const grid = terrain.grid;
  const extractionField = buildSpatialExtractionField(grid, terrain.spawnPoint, policy.extraction);
  const extraction = selectSpatialExtraction(extractionField, seed);
  let matter = 0, solid = 0, supported = 0;
  const half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
    const tile = grid.getTile(x, y);
    if (tile !== TileType.VOID) matter++;
    if (tile === TileType.WALL) solid++;
    if (bodyHasSupport(grid, { x: (x + .5) * grid.tileSize, y: (y + .5) * grid.tileSize }, half, half)) supported++;
  }
  const reachable = terrain.reachableBodySeats;
  if (reachable / supported < .97) throw new Error(`Spatial terrain leaves ${supported - reachable}/${supported} full-body seats disconnected`);
  return { extraction, extractionCandidateField: extractionField.summary, reachable, supported,
    terrainFillRatio: matter / (grid.cols * grid.rows), solidTerrainRatio: solid / matter };
}

export function createR100SpatialWorld(native: MasterDefinition, policy: R100SpatialPolicy, seed: number,
  frozen: { readonly grade: PollutionGradeDefinition; readonly profile: WorldProfile }): MasterWorld {
  if (!validR100SpatialPolicy(policy, policy.worldId)) throw new Error('Invalid frozen spatial policy');
  const { definition, spawnIndex } = createR100SpatialDefinition(native, policy, seed);
  const options = { ...frozen, spatialDeployment: policy.deployment };
  // The first terrain provides the real support graph. Its temporary exit is
  // never exposed. Rebuild deployment around the selected real extraction.
  const { extraction, extractionCandidateField, reachable, supported, terrainFillRatio, solidTerrainRatio } = inspectSpatialTerrain(definition, policy, seed, options);
  const world = createMasterWorld({ ...definition, exit_x: extraction.point.x, exit_y: extraction.point.y }, seed, options);
  if (world.layout.extractionPoint.position.x !== extraction.point.x || world.layout.extractionPoint.position.y !== extraction.point.y)
    throw new Error('Spatial extraction moved during final physical deployment');
  return { ...world, algorithmRevision: 8, diagnostics: { ...world.diagnostics,
    spatial: { version: policy.version, worldId: policy.worldId, sourceHash: policy.sourceHash, organization: policy.organization,
      width: policy.cols * 32, height: policy.rows * 32, terrainFillRatio,
      solidTerrainRatio, bodyReachableRatio: reachable / supported, unreachableBodySeats: supported - reachable,
      spawnIndex, spawnRelocationPx: Math.hypot(world.layout.spawnPoint.x - definition.spawn_x, world.layout.spawnPoint.y - definition.spawn_y),
      extraction, extractionCandidateField,
      solidObjectCount: world.definition.instances.filter(row => row.role === 'solid').length,
    },
  } };
}

/** The actual production base, before augmentation, for bounded diagnostics. */
export function createR100SpatialBaselineTerrain(native:MasterDefinition,policy:R100SpatialPolicy,seed:number) {
  if(!validR100SpatialPolicy(policy,policy.worldId)||!policy.fragmentShape)throw new Error('Spatial augmentation requires a valid frozen fragment policy');
  return {...createR100SpatialDefinition(native,policy,seed),fragmentShape:policy.fragmentShape};
}
/** Current production, lazily rasterized: at most best geometry + preceding
 * legal geometry. The complete content deployment remains the caller's gate. */
export function* createR100SpatialWorldCandidates(native:MasterDefinition,policy:R100SpatialPolicy,seed:number,
  frozen:{readonly grade:PollutionGradeDefinition;readonly profile:WorldProfile;readonly augmentationPolicy:SpatialAugmentationPolicy;readonly requestedSeed:number}):Generator<MasterWorld> {
  const {definition,spawnIndex,fragmentShape}=createR100SpatialBaselineTerrain(native,policy,seed);
  const candidateSeed=deriveSpatialAugmentationSeed(frozen.requestedSeed,policy.worldId,frozen.augmentationPolicy,seed);
  const plans=augmentSpatialTerrain({definition,fragmentShape,policy:frozen.augmentationPolicy,seed,candidateSeed});
  const options={grade:frozen.grade,profile:frozen.profile,spatialDeployment:policy.deployment};
  const preparationRejected:string[]=[];let yielded=0;
  for(const plan of plans) {
    try {
    const {extraction,extractionCandidateField,reachable,supported,terrainFillRatio,solidTerrainRatio}=inspectSpatialTerrain(plan.definition,policy,seed,options);
    const world=createMasterWorld({...plan.definition,exit_x:extraction.point.x,exit_y:extraction.point.y},seed,options);
    if(world.layout.extractionPoint.position.x!==extraction.point.x||world.layout.extractionPoint.position.y!==extraction.point.y)
      throw new Error('Spatial extraction moved during final physical deployment');
    yielded++;yield {...world,algorithmRevision:11,diagnostics:{...world.diagnostics,
      spatialAugmentationPreparationRejected:[...preparationRejected],
      spatialAugmentation:plan.trace,spatialAugmentationFragmentShape:plan.fragmentShape,
      spatial:{version:policy.version,worldId:policy.worldId,sourceHash:policy.sourceHash,organization:policy.organization,
        width:policy.cols*32,height:policy.rows*32,terrainFillRatio,solidTerrainRatio,bodyReachableRatio:reachable/supported,
        unreachableBodySeats:supported-reachable,spawnIndex,spawnRelocationPx:Math.hypot(world.layout.spawnPoint.x-definition.spawn_x,world.layout.spawnPoint.y-definition.spawn_y),
        extraction,extractionCandidateField,solidObjectCount:world.definition.instances.filter(row=>row.role==='solid').length}}};
    } catch(error) {preparationRejected.push(error instanceof Error?error.message:String(error));}
  }
  if(!yielded)throw new Error(`All spatial geometry finalists failed preparation: ${preparationRejected.join(' | ')}`);
}
