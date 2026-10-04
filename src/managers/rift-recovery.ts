import { nativeRiftPlayerForRestore } from '@/systems/native-rift-body-recovery';
import { nativeBodyCollision } from '@/generation/world-study/native-body-collision';
import { createRiftHostManifest, type RiftHostManifest } from '@/systems/rift-host-manifest';
import { readR100PreparedGameplay, requireR100GameplayPreparation } from '@/systems/r100-world/prepared-gameplay';
import { selectMasterSourceCells } from '@/systems/r100-world/source-cells';
import { hydrateR100MasterWorld } from '@/generation/world-study/r100-native-data';
import { r100PresentationIdentity, validR100PresentationState } from '@/systems/r100-world/presentation-state';
import { selectR100ProductionRecipe, validR100ProductionRecipe } from '@/generation/world-study/r100-package';
import { createR100ProductionMap } from '@/generation/world-study/r100-production-map';
import type { PollutionGrade } from '@/generation/world-study/pollution-grade';
import type { WorldProductionMap } from '@/generation/world-study/production-map';
import { type WorldProductionRecipe } from '@/generation/world-study/production-recipe';
import { validateHostRuntimeSnapshot } from '@/systems/contamination-host-system';
import { createCombatRuntimeConfigurationSignature } from '@/systems/combat-system';
/** Formal 2D world admission. Generation is deterministic; no runtime is replayed on load. */
import { restoreLegacyProceduralLayout, restoreLegacyProductionWorld, validLegacyWorldRecipe } from '@/generation/legacy-rift-generation';
import { assertMatchingRiftIdentity, generatedRiftIdentity } from '@/generation/rift-generation-identity';
import { RiftGenerationClient } from '@/generation/rift-generation-client';
import { hydrateRiftGeneration, type RiftGenerationInput } from '@/generation/rift-generation-protocol';
import type { GeneratedRiftLayout } from '@/generation/types';
import { saveManager } from './save-manager';
import { createAIRuntimeConfiguration } from '@/systems/ai/ai-system';
import { validateEnemyAIBindings } from '@/systems/ai/runtime-state';
import { runtimeRecord, runtimeNumber } from '@/systems/ai/runtime-validation';
import { validateRiftRecoveryState } from '@/systems/rift-recovery-state';
import { TileGrid } from '@/systems/tile-grid';
import { GAME_CONSTANTS } from '@/config/constants';
import type { InventoryState } from '@/types/inventory-types';
import { validRiftCheckpoint, validRiftDeparture, type RiftCheckpoint } from '@/types/rift-checkpoint';

const worlds = new WeakMap<GeneratedRiftLayout, WorldProductionMap>();
const nativeSourceCounts = new WeakMap<GeneratedRiftLayout, number>();
const generationRecipes = new WeakMap<GeneratedRiftLayout, WorldProductionRecipe>();
const layouts = new Map<string, GeneratedRiftLayout>();
const recipes = new Map<string, ReturnType<typeof createAIRuntimeConfiguration>>();
const signatures = new WeakMap<GeneratedRiftLayout, string>();
const hostManifests = new WeakMap<GeneratedRiftLayout, RiftHostManifest>();
const generationClient = new RiftGenerationClient();
let requiredPreparedKey: string | null = null;
export interface ProceduralPreparationOptions { readonly signal?: AbortSignal; readonly pollutionGrade?: PollutionGrade }
export interface ProceduralPreparationMetrics {
  readonly generationMs: number;
  readonly elapsedMs: number;
  readonly hydrateMs: number;
  readonly verifyMs: number;
  readonly cacheMs: number;
}
let lastPreparationMetrics: ProceduralPreparationMetrics | null = null;
/** Last operation only; no growing telemetry buffer in a long game session. */
export function getProceduralPreparationMetrics(): ProceduralPreparationMetrics | null { return lastPreparationMetrics; }
/** The same pure paint footprint and nucleus placement used by the production
 * renderer/host. Stored target names are never allowed to define their own world. */
function hostManifest(layout: GeneratedRiftLayout): RiftHostManifest {
  const world = worlds.get(layout);
  if (world?.native) {
    const prepared = readR100PreparedGameplay(layout, world.native);
    if (prepared) return prepared.hostManifest;
  }
  const cached = hostManifests.get(layout);
  if (cached) return cached;
  const manifest = createRiftHostManifest(layout, world?.hostTileMap ?? layout.tileMap);
  hostManifests.set(layout, manifest);
  return manifest;
}
export function proceduralRiftIdentity(layout: GeneratedRiftLayout): RiftCheckpoint['identity'] {
  let signature = signatures.get(layout);
  if (!signature) {
    signature = generatedRiftIdentity(layout, generationRecipes.get(layout), worlds.get(layout)).signature;
    signatures.set(layout, signature);
  }
  return { worldId: 'procedural-rift', layoutId: 'procedural-rift', seed: layout.seed, recipeId: layout.recipeId,
    signature, ...(generationRecipes.has(layout) ? { generation: generationRecipes.get(layout)! } : {}) };
}
function rememberWorld(generation: WorldProductionRecipe, expected?: RiftCheckpoint['identity']): GeneratedRiftLayout {
  // Creation and recovery dispatch by the same contract version. A later live
  // generator cannot accidentally create a v2 departure that v2 cannot restore.
  const world = generation.version === 3 ? createR100ProductionMap(generation) : restoreLegacyProductionWorld(generation, expected);
  worlds.set(world.layout, world); generationRecipes.set(world.layout, generation);
  return world.layout;
}
function layoutKey(identity: RiftCheckpoint['identity']): string {
  return `${identity.seed}:${identity.recipeId}:${identity.signature}:${identity.generation ? JSON.stringify(identity.generation) : 'legacy'}`;
}
function validProceduralIdentity(identity: RiftCheckpoint['identity']): boolean {
  return identity.worldId === 'procedural-rift' && identity.layoutId === 'procedural-rift'
    && Number.isSafeInteger(identity.seed) && identity.seed >= 0 && identity.seed <= 0xffffffff
    && (identity.generation === undefined || validLegacyWorldRecipe(identity.generation) || validR100ProductionRecipe(identity.generation));
}
function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
}
async function prepareGeneratedLayout(input: RiftGenerationInput, options: ProceduralPreparationOptions): Promise<RiftCheckpoint['identity']> {
  const started = performance.now();
  const wire = await generationClient.generate(input, options.signal);
  throwIfCancelled(options.signal);
  const hydrateStarted = performance.now();
  const { layout, world } = hydrateRiftGeneration(wire);
  const verifyStarted = performance.now();
  const generation = input.kind === 'departure' ? input.generation : input.identity.generation;
  if (!!generation !== !!world) throw new Error('Generated world transfer does not match the requested contract');
  const actual = generatedRiftIdentity(layout, generation, world);
  assertMatchingRiftIdentity(actual, wire.identity);
  if (input.kind === 'recovery') assertMatchingRiftIdentity(actual, input.identity);
  const cacheStarted = performance.now();
  throwIfCancelled(options.signal);
  if (world) worlds.set(layout, world);
  if (world?.native) requireR100GameplayPreparation(layout);
  if (generation) generationRecipes.set(layout, generation);
  signatures.set(layout, actual.signature);
  // Preparing does not start a run, consume inventory, or evict every old record.
  // Keep the existing four-entry bound, including independently restored worlds.
  if (layouts.size >= 4) layouts.clear();
  layouts.set(layoutKey(input.kind === 'recovery' ? input.identity : actual), layout);
  lastPreparationMetrics = { generationMs: wire.generationMs, elapsedMs: performance.now() - started,
    hydrateMs: verifyStarted - hydrateStarted, verifyMs: cacheStarted - verifyStarted, cacheMs: performance.now() - cacheStarted };
  return actual;
}

/** Freeze one random recipe before the cancellable wait; commit remains the scene's responsibility. */
export async function prepareProceduralDeparture(options: ProceduralPreparationOptions = {}): Promise<RiftCheckpoint['identity']> {
  throwIfCancelled(options.signal);
  const values = new Uint32Array(1); crypto.getRandomValues(values);
  const generation = selectR100ProductionRecipe(values[0]!, options.pollutionGrade ?? 'low');
  const identity = await prepareGeneratedLayout({ kind: 'departure', generation }, options);
  return { ...identity, catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 };
}

/** Only a ready exact identity is a cache hit; malformed contracts cannot bypass validation. */
export function hasPreparedProceduralLayout(identity: RiftCheckpoint['identity']): boolean {
  if (!validProceduralIdentity(identity)) return false;
  const layout = layouts.get(layoutKey(identity));
  if (!layout) return false;
  try { assertMatchingRiftIdentity(proceduralRiftIdentity(layout), identity); return true; }
  catch { return false; }
}

export async function prepareProceduralRecovery(identity: RiftCheckpoint['identity'], options: ProceduralPreparationOptions = {}): Promise<void> {
  throwIfCancelled(options.signal);
  if (!validProceduralIdentity(identity)) throw new Error('Invalid saved world recipe');
  if (hasPreparedProceduralLayout(identity)) return;
  // A caller changing its object while the worker runs cannot change the promise being generated.
  await prepareGeneratedLayout({ kind: 'recovery', identity: structuredClone(identity) }, options);
}

/** Sync admission after async preparation must fail closed, never regenerate on a cache miss. */
export function withPreparedProceduralRecovery<T>(identity: RiftCheckpoint['identity'], action: () => T): T {
  if (!hasPreparedProceduralLayout(identity)) throw new Error('Procedural world has not been prepared');
  const previous = requiredPreparedKey;
  requiredPreparedKey = layoutKey(identity);
  try { return action(); } finally { requiredPreparedKey = previous; }
}
export function createProceduralDeparture(pollutionGrade: PollutionGrade = 'low'): RiftCheckpoint['identity'] {
  const values = new Uint32Array(1); crypto.getRandomValues(values);
  const layout = rememberWorld(selectR100ProductionRecipe(values[0]!, pollutionGrade));
  const identity = proceduralRiftIdentity(layout);
  layouts.clear(); layouts.set(layoutKey(identity), layout);
  return { ...identity, catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 };
}
export function restoreProceduralLayout(identity: RiftCheckpoint['identity']): GeneratedRiftLayout {
  if (!validProceduralIdentity(identity)) throw new Error('Invalid saved world recipe');
  const key = layoutKey(identity);
  let layout = layouts.get(key);
  if (requiredPreparedKey !== null && (key !== requiredPreparedKey || !layout))
    throw new Error('Prepared recovery cannot synchronously generate a world');
  if (!layout) {
    layout = identity.generation ? rememberWorld(identity.generation, identity) : restoreLegacyProceduralLayout(identity.seed);
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
    const generation = checkpoint.identity.generation;
    if (generation?.version === 3) {
      if (state.chaos.pollutionGrade !== generation.gradeDefinition.id
        || !validR100PresentationState(state.world.nativePresentation,
          r100PresentationIdentity(generation.nativeDefinition.id, layout.seed, generation.package.dependencyHash))
        || state.world.nativePresentation.elapsedMs > checkpoint.elapsedMs + .001
        || state.world.nativePresentation.lastElapsedMs > checkpoint.elapsedMs + .001) return false;
      const native=worlds.get(layout)?.native;if(!native)return false;
      const preparedGameplay=readR100PreparedGameplay(layout,native);
      let sourceCount=preparedGameplay?.sourceCells.length??nativeSourceCounts.get(layout);
      if(sourceCount===undefined){
        const native=worlds.get(layout)?.native;if(!native)return false;
        const prepared=readR100PreparedGameplay(layout,native);
        sourceCount=prepared?.sourceCells.length??selectMasterSourceCells(hydrateR100MasterWorld(native,layout)).length;nativeSourceCounts.set(layout,sourceCount);
      }
      if(state.world.nativePresentation.audio.sourceIndex>=sourceCount)return false;
    } else if (state.chaos.pollutionGrade !== undefined || state.world.nativePresentation !== undefined
      || state.world.bodyGeometryVersion !== undefined) return false;
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
    if (!validPosition(state.player.position)) return false;
    if (generation?.version === 3) {
      const native = worlds.get(layout)?.native;
      if (!native || !nativeRiftPlayerForRestore(state, nativeBodyCollision(native, layout))) return false;
    } else if (!grid.isWalkableAt(state.player.position.x, state.player.position.y)) return false;
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
