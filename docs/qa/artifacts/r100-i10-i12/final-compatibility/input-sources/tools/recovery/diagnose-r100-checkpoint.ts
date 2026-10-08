/** Read-only owner diagnostics for a captured real, rejected frame. Never repairs
 * or writes a save. Run against the same frozen sources as the captured runtime. */
import { readFileSync } from 'node:fs';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { validRiftCheckpoint } = await import('../../src/types/rift-checkpoint');
const { validatePlayerRuntimeState } = await import('../../src/entities/player');
const { validateCombatRuntimeState } = await import('../../src/systems/combat-system');
const { validateAIRuntimeState, validateEnemyAIBindings } = await import('../../src/systems/ai/runtime-state');
const { createAIRuntimeConfiguration } = await import('../../src/systems/ai/ai-system');
const { validateToolRuntimeState } = await import('../../src/systems/tool-system');
const { validateChaosRuntimeState } = await import('../../src/systems/chaos-system');
const { validateLootSearchRuntimeState } = await import('../../src/systems/loot-search-system');
const { validateFieldLootRuntimeState } = await import('../../src/systems/field-loot-inventory');
const { validateTrailRuntimeState } = await import('../../src/systems/trail-system');
const { validateMinimapRuntimeState } = await import('../../src/ui/minimap');
const { validateRunRuntimeState } = await import('../../src/systems/run-controller');
const { validateHostRuntimeSnapshot } = await import('../../src/systems/contamination-host-system');
const { validateRiftRecoveryState } = await import('../../src/systems/rift-recovery-state');
const { validR100PresentationState, r100PresentationIdentity } = await import('../../src/systems/r100-world/presentation-state');
const { TileGrid } = await import('../../src/systems/tile-grid');

const path = process.argv[2];
if (!path) throw new Error('Pass the rejected-state JSON path');
const captured = JSON.parse(readFileSync(path, 'utf8'));
const checkpoint = captured.checkpoint ?? captured.riftCheckpoint ?? captured.snapshot;
const inventory = captured.inventory ?? captured.record?.inventory;
if (!checkpoint) throw new Error(`Capture itself failed: ${captured.captureError ?? 'no checkpoint'}`);
const recovery = await import('../../src/managers/rift-recovery');
const state = checkpoint.state;
const checks: Record<string, unknown> = {
  checkpoint: validRiftCheckpoint(checkpoint),
  sharedWithoutInventory: validateRiftRecoveryState(state, undefined, checkpoint.elapsedMs),
  sharedWithInventory: validateRiftRecoveryState(state, inventory, checkpoint.elapsedMs),
  player: validatePlayerRuntimeState(state.player), combat: validateCombatRuntimeState(state.combat, state.conditions?.maxHealth ?? 100),
  ai: validateAIRuntimeState(state.ai), tools: validateToolRuntimeState(state.tools), chaos: validateChaosRuntimeState(state.chaos),
  search: validateLootSearchRuntimeState(state.search), field: validateFieldLootRuntimeState(state.field),
  trail: validateTrailRuntimeState(state.trail), minimap: validateMinimapRuntimeState(state.minimap), run: validateRunRuntimeState(state.run),
  nativePresentationShape: validR100PresentationState(state.world?.nativePresentation),
  clock: { checkpoint: checkpoint.elapsedMs, run: state.run?.elapsedMs, tools: state.tools?.elapsedMs,
    chaos: state.chaos?.clockMs, trail: state.trail?.elapsedMs, native: state.world?.nativePresentation },
};
try {
  const layout = recovery.restoreProceduralLayout(checkpoint.identity), grid = new TileGrid(layout.tileMap);
  checks.hosts = validateHostRuntimeSnapshot(state.world?.hosts, layout.contaminationDraw);
  const authored = createAIRuntimeConfiguration(layout.enemySpawns, grid);
  checks.aiRoster = authored.rosterSignature === state.ai.rosterSignature;
  checks.aiBindings = state.ai.enemies.map((enemy: any) => {
    const source = authored.enemies.find(row => row.id === enemy.id);
    return { id: enemy.id, valid: !!source && validateEnemyAIBindings({ ...source, role: source.config.role }, enemy.state) };
  });
  const generation = checkpoint.identity.generation;
  if (generation?.version === 3) checks.nativeIdentity = validR100PresentationState(state.world?.nativePresentation,
    r100PresentationIdentity(generation.nativeDefinition.id, layout.seed, generation.package.dependencyHash));
  checks.completeAdmission = recovery.validateProceduralRiftAdmission(checkpoint, inventory);
} catch (error) { checks.generationError = String(error); }
console.log(JSON.stringify(checks, null, 2));
