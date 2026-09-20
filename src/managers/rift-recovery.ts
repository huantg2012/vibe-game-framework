import { createWorldProductionMap, type WorldProductionMap } from '@/generation/world-study/production-map';
import { selectWorldProductionRecipe, validWorldProductionRecipe, type WorldProductionRecipe } from '@/generation/world-study/production-recipe';
import { validateHostRuntimeSnapshot } from '@/systems/contamination-host-system';
import { createCombatRuntimeConfigurationSignature } from '@/systems/combat-system';
/** Formal 2D world admission. Generation is deterministic; no runtime is replayed on load. */
import { generateRiftLayout } from '@/generation/rift-layout';
import type { GeneratedRiftLayout } from '@/generation/types';
import { saveManager } from './save-manager';
import { createAIRuntimeConfiguration } from '@/systems/ai/ai-system';
import { validateEnemyAIBindings } from '@/systems/ai/runtime-state';
import { runtimeRecord, runtimeNumber } from '@/systems/ai/runtime-validation';
import { validateRiftRecoveryState } from '@/systems/rift-recovery-state';
import { TileGrid } from '@/systems/tile-grid';
import { GAME_CONSTANTS } from '@/config/constants';
import { mix32 } from '@/generation/seed-fork';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '@/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { colonyNucleusSeatsInFloors, resolveStopLoss } from '@/systems/contamination-host-live';
import type { InventoryState } from '@/types/inventory-types';
import { checkpointChecksum, validRiftCheckpoint, validRiftDeparture, type RiftCheckpoint } from '@/types/rift-checkpoint';

const worlds = new WeakMap<GeneratedRiftLayout, WorldProductionMap>();
const generationRecipes = new WeakMap<GeneratedRiftLayout, WorldProductionRecipe>();
const layouts = new Map<string, GeneratedRiftLayout>();
const recipes = new Map<string, ReturnType<typeof createAIRuntimeConfiguration>>();
const signatures = new WeakMap<GeneratedRiftLayout, string>();
const hostManifests = new WeakMap<GeneratedRiftLayout, { targets: string[]; nucleusCounts: Map<string, number> }>();
/** The same pure paint footprint and nucleus placement used by the production
 * renderer/host. Stored target names are never allowed to define their own world. */
function hostManifest(layout: GeneratedRiftLayout): { targets: string[]; nucleusCounts: Map<string, number> } {
  const cached = hostManifests.get(layout);
  if (cached) return cached;
  const manifest = { targets: [] as string[], nucleusCounts: new Map<string, number>() };
  const grid = new TileGrid(worlds.get(layout)?.hostTileMap ?? layout.tileMap), tile = GAME_CONSTANTS.TILE_SIZE, c = GAME_CONSTANTS.CONTAMINATION;
  let paintIndex = 0;
  for (const form of layout.contaminationDraw.forms) {
    if (form.portfolio === 'jia') continue;
    const stop = resolveStopLoss(form);
    if (stop === 'illegal') throw new Error('Invalid authored host');
    const id = form.portfolio === 'bing' ? `ENM_BING_${String(paintIndex + 1).padStart(2, '0')}` : `ENM_${form.portfolio.toUpperCase()}_01`;
    let targetCount = 1;
    if (form.portfolio === 'bing') {
      const pin = layout.contaminationPins.paintFloors[paintIndex++]!;
      const seed = mix32(layout.seed, id);
      const baked = bakePaintGenome({ substrate: form.substrate, coverage: form.coverage, seed, continuity: form.continuity,
        sense: form.lexemes.sense, rhythm: form.lexemes.rhythm, fragmentTypeId: layout.fragmentTypeId,
        veinVariant: resolvePaintVeinVariant(form.substrate, seed) });
      const floors = collectPaintGenomeFloorTiles(baked.field, baked.canvasW, baked.canvasH,
        pin.floorCol * tile + tile / 2, pin.floorRow * tile + tile / 2, tile).filter(p => grid.isWalkable(p.col, p.row));
      const seats = stop.family === 'scatter_rejoin'
        ? colonyNucleusSeatsInFloors(floors, c.COLONY_NUCLEUS_COUNT_MIN, c.COLONY_NUCLEUS_COUNT_MAX, c.COLONY_NUCLEUS_MIN_TILE_GAP, 2) : [];
      manifest.nucleusCounts.set(id, stop.family === 'scatter_rejoin' ? Math.max(c.COLONY_NUCLEUS_COUNT_MIN, seats.length) : 0);
      targetCount = floors.length === 0 || (stop.family === 'scatter_rejoin' && seats.length < c.COLONY_NUCLEUS_COUNT_MIN) ? 0 : Math.max(1, seats.length);
    }
    if (stop.hittable) for (let i = 0; i < targetCount; i++) manifest.targets.push(`core:${id}:${i}`);
  }
  // Preserve the authored host/nucleus traversal, exactly as Combat registers it.
  hostManifests.set(layout, manifest); return manifest;
}
export function proceduralRiftIdentity(layout: GeneratedRiftLayout): RiftCheckpoint['identity'] {
  let signature = signatures.get(layout);
  if (!signature) {
    signature = checkpointChecksum({ tileMap: layout.tileMap, spawns: layout.enemySpawns, pins: layout.contaminationPins, draw: layout.contaminationDraw, spawn: layout.spawnPoint, exit: layout.extractionPoint, fuel: layout.kindlingNodes, items: layout.contaminantNodes });
    const generation = generationRecipes.get(layout);
    if (generation) signature = checkpointChecksum({ layout: signature, generation, hostTileMap: worlds.get(layout)!.hostTileMap });
    signatures.set(layout, signature);
  }
  return { worldId: 'procedural-rift', layoutId: 'procedural-rift', seed: layout.seed, recipeId: layout.recipeId,
    signature, ...(generationRecipes.has(layout) ? { generation: generationRecipes.get(layout)! } : {}) };
}
function rememberWorld(generation: WorldProductionRecipe): GeneratedRiftLayout {
  if (!validWorldProductionRecipe(generation)) throw new Error('Invalid saved world recipe');
  const world = createWorldProductionMap(generation.profile, generation.space, generation.requestedSeed,
    { contentFragmentTypeId: generation.contentFragmentTypeId });
  worlds.set(world.layout, world); generationRecipes.set(world.layout, generation);
  return world.layout;
}
function layoutKey(identity: RiftCheckpoint['identity']): string {
  return `${identity.seed}:${identity.recipeId}:${identity.generation ? checkpointChecksum(identity.generation) : 'legacy'}`;
}
export function createProceduralDeparture(): RiftCheckpoint['identity'] {
  const values = new Uint32Array(1); crypto.getRandomValues(values);
  const layout = rememberWorld(selectWorldProductionRecipe(values[0]!));
  const identity = proceduralRiftIdentity(layout);
  layouts.clear(); layouts.set(layoutKey(identity), layout);
  return { ...identity, catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 };
}
export function restoreProceduralLayout(identity: RiftCheckpoint['identity']): GeneratedRiftLayout {
  if (identity.worldId !== 'procedural-rift' || identity.layoutId !== 'procedural-rift') throw new Error('Unsupported procedural world');
  const key = layoutKey(identity);
  let layout = layouts.get(key);
  if (!layout) {
    layout = identity.generation ? rememberWorld(identity.generation) : generateRiftLayout(identity.seed);
    if (layouts.size >= 4) layouts.clear(); layouts.set(key, layout);
  }
  const actual = proceduralRiftIdentity(layout);
  if (actual.signature !== identity.signature
    || (identity.generation && (actual.seed !== identity.seed || actual.recipeId !== identity.recipeId)))
    throw new Error('Saved world does not match the current generation contract');
  return layout;
}
/** Presentation/Host adapters have no separate save state; the shared gameplay owns it. */
export function restoreProceduralWorld(identity: RiftCheckpoint['identity']): WorldProductionMap | null {
  return worlds.get(restoreProceduralLayout(identity)) ?? null;
}

function finiteJson(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length < 20000 && value.every(finiteJson);
  return runtimeRecord(value) && Object.values(value).every(finiteJson);
}
export function validateProceduralRiftAdmission(checkpoint: unknown, inventory: Readonly<InventoryState>): boolean {
  try {
    if (!validRiftCheckpoint(checkpoint) || checkpoint.identity.worldId !== 'procedural-rift'
      || !validateRiftRecoveryState(checkpoint.state, inventory, checkpoint.elapsedMs) || inventory.run?.id !== checkpoint.runId) return false;
    const layout = restoreProceduralLayout(checkpoint.identity), state = checkpoint.state;
    if (state.phase === 'settled') return true;
    const grid = new TileGrid(layout.tileMap);
    const ledger = inventory.run!;
    if (ledger.catalogVersion === 'contaminant-v1') {
      if (checkpoint.identity.catalogVersion !== ledger.catalogVersion || checkpoint.identity.combatRulesVersion !== ledger.combatRulesVersion
        || checkpoint.identity.lootAlgorithmVersion !== ledger.lootAlgorithmVersion || !ledger.dropPlan || ledger.dropPlan.runSeed !== layout.seed) return false;
      // A stored result is authoritative. Weight/content expansion may never reroll a live journey.
      if (ledger.dropPlan.entries.length !== layout.contaminantNodes.length || ledger.dropPlan.entries.some(entry => {
        const node = layout.contaminantNodes.find(candidate => candidate.id === entry.nodeId);
        return !node || entry.tier !== (node.tier ?? 'safe');
      })) return false;
      if (ledger.dropPlan.sourceRegions) {
        const nodes = [...layout.kindlingNodes, ...layout.contaminantNodes];
        if (Object.keys(ledger.dropPlan.sourceRegions).length !== nodes.length
          || nodes.some(node => !ledger.dropPlan!.sourceRegions![node.id])) return false;
      }
    }
    let recipe = recipes.get(checkpoint.identity.signature);
    if (!recipe) { recipe = createAIRuntimeConfiguration(layout.enemySpawns, grid); if (recipes.size >= 4) recipes.clear(); recipes.set(checkpoint.identity.signature, recipe); }
    if (state.ai.signature !== checkpoint.identity.signature || state.ai.runSeed !== layout.seed
      || state.ai.rosterSignature !== recipe.rosterSignature || state.search.fragmentTypeId !== layout.fragmentTypeId
      || state.search.nodes.length !== layout.kindlingNodes.length + layout.contaminantNodes.length
      || state.minimap.mapWidth !== grid.cols || state.minimap.mapHeight !== grid.rows
      || !runtimeRecord(state.world) || state.world.version !== 1 || !runtimeRecord(state.world.hosts)
      || !validateHostRuntimeSnapshot(state.world.hosts, layout.contaminationDraw) || !finiteJson(state.world)) return false;
    const manifest = hostManifest(layout);
    if (state.combat.externalTargetIds.length !== manifest.targets.length
      || state.combat.externalTargetIds.some((id, index) => id !== manifest.targets[index])
      || state.world.hosts.hosts.some(host => host.kind === 'bing' && (host.state.nuclei as unknown[]).length !== manifest.nucleusCounts.get(host.id))) return false;
    if (state.combat.configurationSignature !== createCombatRuntimeConfigurationSignature({ signature: checkpoint.identity.signature, runSeed: layout.seed, externalTargetIds: manifest.targets }, layout.enemySpawns.map(spawn => ({ id: spawn.id, role: spawn.type, form: spawn.form! })), state.conditions.maxHealth ?? 100)) return false;
    if (!state.search.nodes.every((node, index) => {
      const kindling = index < layout.kindlingNodes.length;
      const source = kindling ? layout.kindlingNodes[index]! : layout.contaminantNodes[index - layout.kindlingNodes.length]!;
      if (node.id !== source.id || node.kind !== (kindling ? 'kindling' : 'contaminant')
        || node.position.x !== source.position.x || node.position.y !== source.position.y) return false;
      if (kindling) {
        const def = layout.kindlingNodes[index]!, loot = GAME_CONSTANTS.LOOT;
        const value = def.value ?? (def.tier === 'safe' ? loot.VALUE_SAFE : def.tier === 'contested' ? loot.VALUE_CONTESTED : loot.VALUE_DEEP);
        return node.value === value && node.tier === def.tier && node.lootPoolId === null && node.allowWeapon === (def.allowWeapon ?? null);
      }
      const def = layout.contaminantNodes[index - layout.kindlingNodes.length]!;
      return node.value === 0 && node.tier === (def.tier ?? 'safe') && node.lootPoolId === (def.lootPoolId ?? null) && node.allowWeapon === null;
    })) return false;
    const validPosition = (p: { x: number; y: number }): boolean => runtimeNumber(p.x, 0, grid.widthPx) && runtimeNumber(p.y, 0, grid.heightPx);
    if (!validPosition(state.player.position) || !grid.isWalkableAt(state.player.position.x, state.player.position.y)) return false;
    return state.ai.enemies.every(enemy => {
      const authored = recipe!.enemies.find(candidate => candidate.id === enemy.id);
      return !!authored && validPosition(enemy.entity.position) && validateEnemyAIBindings({ ...authored, role: authored.config.role }, enemy.state);
    });
  } catch { return false; }
}
export function installProceduralRiftRecovery(): void {
  saveManager.setRiftDepartureValidator(intent => {
    try { return validRiftDeparture(intent) && !!restoreProceduralLayout(intent.identity); } catch { return false; }
  });
  saveManager.setRiftStateValidator(validateProceduralRiftAdmission);
}
