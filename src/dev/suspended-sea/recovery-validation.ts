/** Current-content admission before SaveManager mutates live state or creates a scene. */
import { GAME_CONSTANTS } from '@/config/constants';
import { StageFollowCamera } from '@/dev/spatial-study/stage/camera';
import { StageVisibility } from '@/dev/spatial-study/stage/terrain';
import { createAIRuntimeConfiguration, type AIRuntimeConfiguration } from '@/systems/ai/ai-system';
import { bodyHasSupport } from '@/systems/ai/physical-grid';
import { validateEnemyAIBindings } from '@/systems/ai/runtime-state';
import { runtimeRecord } from '@/systems/ai/runtime-validation';
import { createCombatRuntimeConfigurationSignature } from '@/systems/combat-system';
import { validateRiftRecoveryState, type ActiveRiftRecoveryState } from '@/systems/rift-recovery-state';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type Vector2 } from '@/types/game-types';
import type { InventoryState } from '@/types/inventory-types';
import type { TileMapData } from '@/types/map-types';
import { checkpointChecksum, validRiftCheckpoint, type RiftCheckpoint } from '@/types/rift-checkpoint';
import { SuspendedSeaShellSystem } from '@/worlds/suspended-sea/shell-system';
import type { ShellCycleTiming, ShellDefinition } from '@/worlds/suspended-sea/types';
import { createSuspendedSeaWorld } from './world';

interface AdmissionRecipe {
  readonly identitySignature: string;
  readonly worldSignature: string;
  readonly width: number;
  readonly height: number;
  readonly map: TileMapData;
  readonly spawn: Vector2;
  readonly shell: ShellDefinition;
  readonly shellTiming: ShellCycleTiming;
  readonly ai: AIRuntimeConfiguration;
  readonly combatSignature: string;
  readonly enemyIds: readonly string[];
}

// Only copied, frozen generation/configuration data is cached. No scene, runtime
// instance, saved state, visibility buffer, texture or inventory can enter here.
const recipes = new Map<string, AdmissionRecipe>();
const identitySignatures = new Map<string, string>();
function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}
function remember<T>(cache: Map<string, T>, key: string, value: T): T {
  if (cache.size >= 16) cache.clear();
  cache.set(key, value); return value;
}
function identityKey(identity: RiftCheckpoint['identity']): string { return `${identity.layoutId}:${identity.seed}`; }
function currentIdentity(identity: RiftCheckpoint['identity']): boolean {
  const key = identityKey(identity);
  let signature = identitySignatures.get(key);
  if (signature === undefined) signature = remember(identitySignatures, key,
    createSuspendedSeaWorld(identity.seed, identity.layoutId).metadata.signature);
  return signature === identity.signature;
}
function currentRecipe(identity: RiftCheckpoint['identity']): AdmissionRecipe {
  const key = identityKey(identity), cached = recipes.get(key);
  if (cached) return cached;
  const world = createSuspendedSeaWorld(identity.seed, identity.layoutId);
  const layout = world.base.layout, grid = new TileGrid(layout.tileMap);
  const recipe: AdmissionRecipe = { identitySignature: world.metadata.signature,
    worldSignature: checkpointChecksum(world.base.signature()), width: world.base.width, height: world.base.height,
    map: layout.tileMap, spawn: layout.spawnPoint, shell: world.shellDefinition, shellTiming: world.shellTiming,
    ai: createAIRuntimeConfiguration(layout.enemySpawns, grid),
    combatSignature: createCombatRuntimeConfigurationSignature({ signature: world.metadata.signature,
      runSeed: identity.seed, externalTargetIds: [world.shellDefinition.id] },
    layout.enemySpawns.map(spawn => {
      if (!spawn.form) throw new Error('Suspended-sea enemy requires its authored form');
      return { id: spawn.id, role: spawn.type, form: spawn.form };
    })), enemyIds: layout.enemySpawns.map(spawn => spawn.id) };
  // Copy before freezing: type-config profiles also reference generated CSV data.
  return remember(recipes, key, freezeTree(JSON.parse(JSON.stringify(recipe)) as AdmissionRecipe));
}
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
function samePoint(a: Readonly<Vector2>, b: Readonly<Vector2>): boolean {
  return Math.abs(a.x - b.x) <= .001 && Math.abs(a.y - b.y) <= .001;
}
function validBody(grid: TileGrid, position: Readonly<Vector2>, bodyPosition: Readonly<Vector2>, size: number): boolean {
  const half = size / 2, center = { x: bodyPosition.x + half, y: bodyPosition.y + half };
  return samePoint(position, center) && bodyHasSupport(grid, center, half, half);
}
function validActors(state: ActiveRiftRecoveryState, identity: RiftCheckpoint['identity'], recipe: AdmissionRecipe, grid: TileGrid): boolean {
  if (state.ai.signature !== identity.signature || state.ai.runSeed !== identity.seed
    || state.ai.rosterSignature !== recipe.ai.rosterSignature || state.combat.configurationSignature !== recipe.combatSignature
    || !sameIds(state.combat.enemyIds, recipe.enemyIds) || !sameIds(state.combat.externalTargetIds, [recipe.shell.id])
    || !validBody(grid, state.player.position, state.player.bodyPosition, GAME_CONSTANTS.PLAYER.BODY_SIZE)) return false;
  return state.ai.enemies.every(enemy => {
    const authored = recipe.ai.enemies.find(entry => entry.id === enemy.id);
    return !!authored && validateEnemyAIBindings({ ...authored, role: authored.config.role }, enemy.state)
      && validBody(grid, enemy.entity.position, enemy.entity.bodyPosition, authored.config.bodySize);
  });
}
function validWorld(state: ActiveRiftRecoveryState, elapsedMs: number, recipe: AdmissionRecipe, grid: TileGrid): boolean {
  const world = state.world;
  if (!runtimeRecord(world) || world.version !== 1 || world.signature !== recipe.worldSignature || world.elapsedMs !== elapsedMs
    || !runtimeRecord(world.presentation) || world.presentation.version !== 1) return false;
  const shell = new SuspendedSeaShellSystem(recipe.shell, recipe.shellTiming, (x, y) => grid.isWalkableAt(x, y));
  let memory: StageVisibility | undefined;
  try {
    if (!shell.validateRuntimeState(world.shell) || world.shell.stopped || world.shell.elapsedMs !== elapsedMs) return false;
    const camera = new StageFollowCamera(recipe.width, recipe.height, recipe.spawn);
    if (!camera.validateRuntimeState(world.presentation.camera) || world.presentation.camera.elapsedMs !== elapsedMs
      || !samePoint(world.presentation.camera.previousPlayer, state.player.position)) return false;
    memory = new StageVisibility({ visibilityAt: () => 0 }, recipe.width, recipe.height, (x, y) => {
      const tile = recipe.map.tiles[Math.floor(y / recipe.map.tileSize)]?.[Math.floor(x / recipe.map.tileSize)];
      // Exploration remembers solid wall surfaces as well as walkable ground.
      return tile !== undefined && tile !== TileType.VOID;
    });
    return memory.validateRuntimeState(world.presentation.memory);
  } finally {
    memory?.texture.dispose(); shell.destroy();
  }
}

/** Boolean admission only: never hydrates, settles, presents or publishes anything. */
export function validateSuspendedSeaAdmission(checkpoint: unknown, inventory: Readonly<InventoryState>): boolean {
  try {
    if (!validRiftCheckpoint(checkpoint) || checkpoint.identity.seed > 0xffffffff
      || !validateRiftRecoveryState(checkpoint.state, inventory, checkpoint.elapsedMs)
      || inventory.run?.id !== checkpoint.runId || !currentIdentity(checkpoint.identity)) return false;
    // A terminal receipt needs no actor/world payload and allocates no guard instances.
    if (checkpoint.state.phase === 'settled') return true;
    const recipe = currentRecipe(checkpoint.identity), grid = new TileGrid(recipe.map);
    return recipe.identitySignature === checkpoint.identity.signature
      && validActors(checkpoint.state, checkpoint.identity, recipe, grid)
      && validWorld(checkpoint.state, checkpoint.elapsedMs, recipe, grid);
  } catch { return false; }
}
