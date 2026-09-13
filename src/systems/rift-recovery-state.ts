/** Finite suspended-sea recovery boundary. The outer checkpoint owns world identity,
 * revision and elapsed time; the runtime validates the world-specific payload. */
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { WEAPON_DATA } from '@/generated/weapon-data';
import type { SortieModifiers } from '@/managers/game-state';
import { validatePlayerRuntimeState, type PlayerRuntimeState } from '@/entities/player';
import { validateCombatRuntimeState, type CombatRuntimeState } from '@/systems/combat-system';
import { validateAIRuntimeState, type AIRuntimeState } from '@/systems/ai/runtime-state';
import { validateToolRuntimeState, type ToolRuntimeState } from '@/systems/tool-system';
import { getChaosModulators, validateChaosRuntimeState, type ChaosRuntimeState } from '@/systems/chaos-system';
import { validateLootSearchRuntimeState, type LootSearchRuntimeState } from '@/systems/loot-search-system';
import { validateFieldLootRuntimeState, type FieldLootRuntimeState } from '@/systems/field-loot-inventory';
import { validateTrailRuntimeState, type TrailRuntimeState } from '@/systems/trail-system';
import { validateMinimapRuntimeState, type MinimapRuntimeState } from '@/ui/minimap';
import { validateRunRuntimeState, type RunRuntimeStateV1 } from '@/systems/run-controller';
import { runtimeInteger, runtimeNumber, runtimeRecord, runtimeStrings } from '@/systems/ai/runtime-validation';
import type { ContaminantRarity, ContaminantType } from '@/types/game-types';
import type { InventoryState } from '@/types/inventory-types';

const TOOL_TYPES: readonly ContaminantType[] = ['stitch', 'compress', 'kindle', 'siphon', 'muffle'];
export interface RiftRecoveryConditions {
  readonly modifiers: SortieModifiers;
  readonly cycle: number;
}
export interface RiftRecoveryResult {
  readonly killCount: number;
  readonly acquired: readonly { readonly type: ContaminantType; readonly rarity: ContaminantRarity }[];
  readonly passiveTriggers: readonly (readonly [ContaminantType, number])[];
}
interface RiftRecoveryCommon {
  readonly version: 1;
  readonly conditions: RiftRecoveryConditions;
  readonly run: RunRuntimeStateV1;
  readonly presentationSequence: number;
  readonly result: RiftRecoveryResult;
}
export interface ActiveRiftRecoveryState extends RiftRecoveryCommon {
  readonly phase: 'active';
  /** Fixed-step accumulator; this is not expedition time and can retain a large-frame debt. */
  readonly physics: { readonly fixedStep: true; readonly fps: 60; readonly timeScale: 1; readonly elapsedMs: number };
  readonly player: PlayerRuntimeState;
  readonly combat: CombatRuntimeState;
  readonly ai: AIRuntimeState;
  readonly tools: ToolRuntimeState;
  readonly chaos: ChaosRuntimeState;
  readonly search: LootSearchRuntimeState;
  readonly field: FieldLootRuntimeState;
  readonly trail: TrailRuntimeState;
  readonly minimap: MinimapRuntimeState;
  readonly world: unknown;
  readonly defenseHudEffects: readonly { readonly label: string; readonly remainingMs?: number }[];
}
/** Final receipt only. Loading it goes to base settlement, never back into the Rift. */
export interface SettledRiftRecoveryState extends RiftRecoveryCommon {
  readonly phase: 'settled';
}
export type RiftRecoveryState = ActiveRiftRecoveryState | SettledRiftRecoveryState;

function validConditions(value: unknown): value is RiftRecoveryConditions {
  return runtimeRecord(value) && runtimeInteger(value.cycle, 1) && runtimeRecord(value.modifiers)
    && runtimeNumber(value.modifiers.chaosRateModifier, 0) && runtimeNumber(value.modifiers.kindlingValueModifier, 0)
    && runtimeNumber(value.modifiers.startingChaos, 0, GAME_CONSTANTS.CHAOS.HARD_CAP);
}
function validResult(value: unknown): value is RiftRecoveryResult {
  if (!runtimeRecord(value) || !runtimeInteger(value.killCount, 0, 2) || !Array.isArray(value.acquired)
    || value.acquired.length > 4096 || !Array.isArray(value.passiveTriggers) || value.passiveTriggers.length > 2) return false;
  const passives = new Set<string>();
  return value.acquired.every(row => runtimeRecord(row) && TOOL_TYPES.includes(row.type as ContaminantType)
    && (row.rarity === 'common' || row.rarity === 'fine' || row.rarity === 'rare'))
    && value.passiveTriggers.every(entry => {
      if (!Array.isArray(entry) || entry.length !== 2 || (entry[0] !== 'siphon' && entry[0] !== 'muffle')
        || !runtimeInteger(entry[1], 1, 1000) || passives.has(entry[0])) return false;
      passives.add(entry[0]); return true;
    });
}
function near(a: number, b: number): boolean { return Math.abs(a - b) <= .001; }
function orderedEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
/** The SaveManager additionally validates complete item lifecycle and base rules.
 * This boundary checks referential integrity without loading/mutating InventoryStore. */
function inventoryShape(inventory: Readonly<InventoryState>): boolean {
  return runtimeRecord(inventory) && Array.isArray(inventory.items)
    && runtimeRecord(inventory.equipment) && Array.isArray(inventory.equipment.toolIds)
    && Array.isArray(inventory.equipment.defenseIds) && runtimeRecord(inventory.run)
    && typeof inventory.run.id === 'string' && inventory.run.id.length > 0
    && runtimeStrings(inventory.run.carriedOutIds, 4096) && runtimeStrings(inventory.run.destroyedIds, 4096)
    && runtimeRecord(inventory.run.revealedNodes)
    && Object.values(inventory.run.revealedNodes).every(ids => runtimeStrings(ids, 4096))
    && inventory.items.every(item => runtimeRecord(item) && typeof item.id === 'string'
      && (item.kind === 'weapon' || item.kind === 'contaminant') && runtimeRecord(item.location))
    && new Set(inventory.items.map(item => item.id)).size === inventory.items.length;
}
function validateInventoryBindings(value: RiftRecoveryState, inventory: Readonly<InventoryState>): boolean {
  if (!inventoryShape(inventory)) return false;
  const ledger = inventory.run!;
  if (value.phase === 'settled') {
    const outcome = value.run.lastEndReason === 'extract' ? 'extract' : value.run.lastEndReason === 'abandon' ? 'abandon' : 'death';
    return ledger.status === 'settled' && !ledger.baseSettled && ledger.outcome === outcome
      && ledger.kindlingGained === value.run.lastKindling;
  }
  if (ledger.status !== 'active' || ledger.baseSettled || ledger.outcome !== undefined) return false;
  const items = new Map(inventory.items.map(item => [item.id, item]));
  const weapon = inventory.equipment.weaponId ? items.get(inventory.equipment.weaponId) : null;
  if (weapon && (weapon.kind !== 'weapon' || !weapon.weapon || weapon.location.kind !== 'carried'
    || weapon.weapon.stage !== 'tool' || !runtimeInteger(weapon.weapon.usesRemaining, 1)
    || !WEAPON_DATA[weapon.weapon.definitionId])) return false;
  if (inventory.equipment.weaponId && !weapon) return false;
  if (value.combat.weaponId !== (weapon?.kind === 'weapon' ? weapon.weapon.definitionId : null)) return false;
  const toolIds = inventory.equipment.toolIds;
  if (value.tools.loadoutIds.some((id, index) => id !== (toolIds[index] ?? null))
    || toolIds.slice(value.tools.loadoutIds.length).some(id => id !== null)) return false;
  for (const [index, id] of value.tools.loadoutIds.entries()) {
    if (id === null) continue;
    const item = items.get(id);
    if (item?.kind !== 'contaminant' || !item.contaminant || item.location.kind !== 'carried'
      || item.contaminant.stage !== 'tool' || !runtimeInteger(item.contaminant.usesRemaining, 1)
      || !TOOL_TYPES.includes(item.contaminant.type)) return false;
    const passive = CONTAMINANT_DATA[item.contaminant.type].toolType === 'passive';
    if (passive !== (index === value.tools.loadoutIds.length - 1)) return false;
  }
  for (const type of ['muffle', 'siphon'] as const) {
    const item = value.tools.loadoutIds.map(id => id ? items.get(id) : undefined)
      .find(candidate => candidate?.kind === 'contaminant' && candidate.contaminant.type === type);
    if (value.tools[type].triggersRemaining !== (item?.kind === 'contaminant' ? item.contaminant.usesRemaining : 0)) return false;
  }
  const nodeIds = new Set(value.search.nodes.map(node => node.id));
  if (Object.keys(ledger.revealedNodes).some(id => !nodeIds.has(id))) return false;
  for (const node of value.search.nodes) {
    const revealed = ledger.revealedNodes[node.id], cached = node.revealedItem;
    if (node.collected && cached) {
      if (!revealed || !orderedEqual(revealed, [cached.id])) return false;
      const actual = items.get(cached.id);
      if (!actual) { if (!ledger.destroyedIds.includes(cached.id)) return false; }
      else {
        if (actual.kind !== cached.kind || actual.source?.runId !== ledger.id || actual.source.nodeId !== node.id
          || actual.source.fragmentId !== value.search.fragmentTypeId) return false;
        if (actual.location.kind !== 'carried' && (actual.location.kind !== 'ground' || actual.location.runId !== ledger.id)) return false;
        if (actual.kind === 'weapon' && cached.kind === 'weapon'
          && (!actual.weapon || actual.weapon.definitionId !== cached.weapon.definitionId)) return false;
        if (actual.kind === 'contaminant' && cached.kind === 'contaminant'
          && (!actual.contaminant || actual.contaminant.type !== cached.contaminant.type
            || actual.contaminant.rarity !== cached.contaminant.rarity || actual.contaminant.quality !== cached.contaminant.quality)) return false;
      }
    } else if (revealed || (cached && items.has(cached.id))) return false;
  }
  const known = new Set([...ledger.carriedOutIds, ...ledger.destroyedIds, ...Object.values(ledger.revealedNodes).flat()]);
  if (inventory.items.some(item => item.location.kind === 'carried' && !known.has(item.id))) return false;
  return value.field.acquisitionRun !== ledger.id || value.field.acquiredIds.every(id => known.has(id));
}

export function validateRiftRecoveryState(
  value: unknown, inventory?: Readonly<InventoryState>, elapsedMs?: number,
): value is RiftRecoveryState {
  if (!runtimeRecord(value) || value.version !== 1 || !validConditions(value.conditions)
    || !validateRunRuntimeState(value.run) || !validResult(value.result) || !runtimeInteger(value.presentationSequence)
    || (elapsedMs !== undefined && (!runtimeNumber(elapsedMs, 0) || !near(value.run.elapsedMs, elapsedMs)))) return false;
  if (value.phase === 'settled') {
    if (!value.run.runEnded || !value.run.settlementSaved) return false;
    return inventory === undefined || validateInventoryBindings(value as unknown as SettledRiftRecoveryState, inventory);
  }
  if (value.phase !== 'active' || value.run.runEnded || !runtimeRecord(value.physics)
    || value.physics.fixedStep !== true || value.physics.fps !== 60 || value.physics.timeScale !== 1
    || !runtimeNumber(value.physics.elapsedMs, 0) || !validatePlayerRuntimeState(value.player)
    || !validateCombatRuntimeState(value.combat) || !validateAIRuntimeState(value.ai) || !validateToolRuntimeState(value.tools)
    || !validateChaosRuntimeState(value.chaos) || !validateLootSearchRuntimeState(value.search)
    || !validateFieldLootRuntimeState(value.field) || !validateTrailRuntimeState(value.trail)
    || !validateMinimapRuntimeState(value.minimap) || !runtimeRecord(value.world)
    || !Array.isArray(value.defenseHudEffects) || value.defenseHudEffects.length > 32
    || !value.defenseHudEffects.every(row => runtimeRecord(row) && typeof row.label === 'string' && row.label.length > 0 && row.label.length <= 160
      && (row.remainingMs === undefined || runtimeNumber(row.remainingMs, Number.MIN_VALUE)))) return false;
  const active = value as unknown as ActiveRiftRecoveryState;
  const { ai, combat, tools, chaos, search, player, trail, minimap } = active;
  if (combat.dead || !combat.enabled || combat.signature !== ai.signature || combat.runSeed !== ai.runSeed
    || search.runSeed !== ai.runSeed || search.fragmentTypeId !== 'suspended-sea'
    || !near(search.kindlingValueModifier, active.conditions.modifiers.kindlingValueModifier)
    || !orderedEqual(ai.enemies.map(enemy => enemy.id), combat.enemies.map(enemy => enemy.id))) return false;
  const roster = new Set(combat.enemyIds);
  if (ai.enemies.some(enemy => !roster.has(enemy.id)) || active.result.killCount !== roster.size - ai.enemies.length) return false;
  for (let index = 0; index < ai.enemies.length; index++) {
    const enemy = ai.enemies[index]!, attack = combat.enemies[index]!;
    if (enemy.entity.attackCommitted !== (attack.attackPhase === 'windup') || attack.controlInterruptRevision > enemy.attackInterruptRevision
      || !near(enemy.entity.position.x, enemy.state.position.x) || !near(enemy.entity.position.y, enemy.state.position.y)) return false;
  }
  const attackFactor = player.speedModifiers.find(([source]) => source === 'attack')?.[1];
  if (combat.phase === 'idle' ? attackFactor !== undefined : attackFactor !== GAME_CONSTANTS.COMBAT.ATTACK_SELF_SLOW) return false;
  if (combat.phase !== 'idle' && combat.weaponId !== combat.swingWeaponId
    && !(combat.weaponId === null && combat.weaponUseCommitted)) return false;
  const chaosFactor = player.speedModifiers.find(([source]) => source === 'chaos')?.[1];
  if (chaosFactor !== undefined && !near(chaosFactor, getChaosModulators(chaos.lastModulated).speedMult)) return false;
  // create() leaves the initial hearing projection to the first Tool.update.
  if (tools.elapsedMs > 0 && ai.hearingSuppressed !== (tools.muffle.episodeActive || tools.muffle.equipped)) return false;
  // Historical crossing membership and independent stops can outlive a killed body.
  // The initial authored roster, never arbitrary IDs, remains their identity authority.
  if (tools.stitchStops.some(stop => !roster.has(stop.enemyId))
    || tools.stitches.some(line => line.affectedEnemyIds.some(id => !roster.has(id))
      || line.previousPositions.some(previous => !roster.has(previous.enemyId)))
    || tools.anchors.some(anchor => anchor.affectedEnemyIds.some(id => !roster.has(id)))
    || chaos.chasingEnemyIds.some(id => !ai.enemies.some(enemy => enemy.id === id))
    || chaos.detectionCooldowns.some(entry => !roster.has(entry.enemyId))) return false;
  if (trail.mapWidth !== minimap.mapWidth || trail.tileSize !== minimap.tileSize
    || trail.visited.some(entry => entry.tileKey >= minimap.mapWidth * minimap.mapHeight)) return false;
  // Owners keep their own clocks (including the death frame that skips Tool.update).
  // Offline time is never added and physicsElapsedMs is not an expedition clock.
  const clock = elapsedMs ?? active.run.elapsedMs;
  if ([tools.elapsedMs, chaos.clockMs, trail.elapsedMs].some(time => time > clock + .001)) return false;
  return inventory === undefined || validateInventoryBindings(active, inventory);
}
