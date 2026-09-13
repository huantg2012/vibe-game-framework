/** CSV-backed native content, composed with the one existing spatial world. */
import { SUSPENDED_SEA_GROUND, SUSPENDED_SEA_OPENINGS, SUSPENDED_SEA_PLACEMENTS,
  SUSPENDED_SEA_SCENES, SUSPENDED_SEA_WATER, type SuspendedSeaSceneId } from '@/generated/suspended-sea-data';
import { CONTAMINANT_SOURCE_POOLS } from '@/generated/contaminant-sources-data';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import { mix32 } from '@/generation/seed-fork';
import { TileType } from '@/types/game-types';
import { SpatialSliceWorld, type SpatialSliceData } from '@/dev/spatial-study/slice-world';
import { assertStageVisualSupport } from '@/dev/spatial-study/stage-gameplay-fixture';
import { WaterFlowCycle } from '@/dev/spatial-study/water-flow';
import type { SpatialFixturePlacement } from '@/dev/spatial-study/fixture';
import type { SeaPoint, ShellDefinition, ShellCycleTiming } from '@/worlds/suspended-sea/types';

export type { SuspendedSeaSceneId } from '@/generated/suspended-sea-data';
export const SUSPENDED_SEA_LOADOUT_IDS = ['bare', 'melee', 'light', 'shore'] as const;
export type SuspendedSeaLoadoutId = typeof SUSPENDED_SEA_LOADOUT_IDS[number];
export interface SuspendedSeaOptions {
  readonly scene: SuspendedSeaSceneId;
  readonly loadout: SuspendedSeaLoadoutId;
  readonly seed: number;
}
export interface SuspendedSeaMetadata {
  readonly worldId: 'suspended-sea';
  readonly sceneId: SuspendedSeaSceneId;
  readonly sceneName: string;
  readonly recipeVersion: number;
  readonly seed: number;
  readonly variants: Readonly<Record<string, number>>;
  readonly waterPhaseOffsetMs: number;
  readonly sourcePools: readonly { nodeId: string; kind: string; tier: string; poolId: string | null; allowWeapon: boolean | null }[];
  readonly signature: string;
}
export interface SuspendedSeaWorld {
  readonly base: SpatialSliceWorld;
  readonly shellDefinition: ShellDefinition;
  readonly shellTiming: ShellCycleTiming;
  readonly shellBody: SeaPoint;
  readonly entryDurationMs: number;
  readonly metadata: SuspendedSeaMetadata;
}

export function resolveSuspendedSeaOptions(values: {
  scene?: string | null; loadout?: string | null; seed?: string | null;
}): SuspendedSeaOptions {
  const scene = values.scene ?? 'sea-open-channel';
  if (!SUSPENDED_SEA_SCENES.some(row => row.id === scene)) throw new Error(`未知悬海编排：${scene}`);
  const loadout = values.loadout ?? 'bare';
  if (!SUSPENDED_SEA_LOADOUT_IDS.some(id => id === loadout) || !BUILD_LAB_LOADOUTS.some(row => row.id === loadout)) {
    throw new Error(`悬海尚未支持此出击配置：${loadout}`);
  }
  const seedText = values.seed ?? '7';
  const seed = seedText.trim() === '' ? NaN : Number(seedText);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子须为 0–4294967295 之间的整数');
  return { scene: scene as SuspendedSeaSceneId, loadout: loadout as SuspendedSeaLoadoutId, seed };
}

function parsePoints(value: string, origin: SeaPoint): readonly SeaPoint[] {
  return value.split('|').map(pair => {
    const [x, y] = pair.split(':').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid native water coordinates');
    return Object.freeze({ x: origin.x + x!, y: origin.y + y! });
  });
}
function signature(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSuspendedSeaWorld(seed: number, sceneId: SuspendedSeaSceneId): SuspendedSeaWorld {
  resolveSuspendedSeaOptions({ scene: sceneId, seed: String(seed) });
  const scene = SUSPENDED_SEA_SCENES.find(row => row.id === sceneId)!;
  const water = SUSPENDED_SEA_WATER.find(row => row.sceneId === sceneId);
  if (!water) throw new Error(`Missing suspended sea water: ${sceneId}`);
  const allPlacements = SUSPENDED_SEA_PLACEMENTS.filter(row => row.sceneId === sceneId);
  const variants: Record<string, number> = {};
  for (const row of allPlacements) {
    if (!row.variantGroup || variants[row.variantGroup] !== undefined) continue;
    const alternatives = [...new Set(allPlacements.filter(other => other.variantGroup === row.variantGroup).map(other => other.variant!))].sort((a, b) => a - b);
    variants[row.variantGroup] = alternatives[mix32(seed, `suspended-sea:${sceneId}:placement:${row.variantGroup}`) % alternatives.length]!;
  }
  const selected = allPlacements.filter(row => !row.variantGroup || variants[row.variantGroup] === row.variant);
  const placements: SpatialFixturePlacement[] = selected.map(row => ({ ...row,
    allowWeapon: row.allowWeapon ?? undefined, lootPoolId: row.lootPoolId || undefined }));
  if (new Set(placements.map(row => row.id)).size !== placements.length) throw new Error('Duplicate selected native placement');
  for (const row of placements) {
    if (row.kind === 'contaminant' && (!row.lootPoolId || !Object.prototype.hasOwnProperty.call(CONTAMINANT_SOURCE_POOLS, row.lootPoolId))) {
      throw new Error(`Missing or unknown source on ${row.id}`);
    }
    if (row.kind === 'kindling' && row.allowWeapon === undefined) throw new Error(`Missing weapon-source permission on ${row.id}`);
  }
  const data: SpatialSliceData = {
    scene: { ...scene, loadout: 'bare', fragmentTypeId: scene.worldId, recipeId: `${scene.worldId}/${sceneId}@${scene.recipeVersion}` },
    water, placements,
    ground: SUSPENDED_SEA_GROUND.filter(row => row.sceneId === sceneId),
    openings: SUSPENDED_SEA_OPENINGS.filter(row => row.sceneId === sceneId),
  };
  const base = new SpatialSliceWorld(seed, data);
  assertStageVisualSupport(base.layout);
  if (base.layout.enemySpawns.length !== 2 || base.layout.enemySpawns.filter(enemy => enemy.type === 'rewriter').length !== 1
    || base.layout.kindlingNodes.length !== 3 || base.layout.contaminantNodes.length !== 4) throw new Error('Incomplete native suspended sea deployment');
  const shellDefinition: ShellDefinition = Object.freeze({ id: water.id,
    position: Object.freeze({ x: water.shellHitX, y: water.shellHitY }),
    spillOutline: Object.freeze(parsePoints(water.spillOutline, water)), drainPath: Object.freeze(parsePoints(water.drainPath, water)),
    diversionDelayMs: water.divertMs, returnMs: water.returnMs, damage: water.damage, hitIntervalMs: water.hitIntervalMs });
  const shellBody = Object.freeze({ x: water.shellX, y: water.shellY });
  if (!base.isFloor(shellDefinition.position.x, shellDefinition.position.y) || !base.isFloor(shellBody.x, shellBody.y)) throw new Error('Native shell requires supported floor');
  const drainEnd = shellDefinition.drainPath[shellDefinition.drainPath.length - 1]!;
  const map = base.layout.tileMap;
  if (map.tiles[Math.floor(drainEnd.y / map.tileSize)]?.[Math.floor(drainEnd.x / map.tileSize)] !== TileType.VOID) {
    throw new Error('Suspended sea drain must end inside a real chasm');
  }
  const flow = new WaterFlowCycle(water);
  const shellTiming: ShellCycleTiming = Object.freeze({ periodMs: flow.period, warningStartMs: water.quietMs,
    contactStartMs: flow.contactStart, contactEndMs: flow.contactEnd });
  const sourcePools = selected.filter(row => row.kind !== 'enemy').map(row => ({ nodeId: `SS_${row.id}`,
    kind: row.kind, tier: row.tier, poolId: row.lootPoolId || null, allowWeapon: row.allowWeapon }));
  const metadata: SuspendedSeaMetadata = Object.freeze({ worldId: 'suspended-sea', sceneId, sceneName: scene.name,
    recipeVersion: scene.recipeVersion, seed, variants: Object.freeze(variants), waterPhaseOffsetMs: 0,
    sourcePools: Object.freeze(sourcePools), signature: signature({ seed, data, variants, sourcePools, shellDefinition, shellTiming }) });
  return { base, shellDefinition, shellTiming, shellBody, entryDurationMs: scene.entryDurationMs, metadata };
}
