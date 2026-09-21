/** New base effects coexist with frozen legacy departure/checkpoint conditions. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { inventoryStore } from '../../src/systems/inventory-store';
import { ChaosSystem } from '../../src/systems/chaos-system';
import type { ActiveRiftRecoveryState } from '../../src/systems/rift-recovery-state';
import { checkpointChecksum, type RiftCheckpoint, type RiftDepartureIntent } from '../../src/types/rift-checkpoint';
import type { SaveDataV2 } from '../../src/types/game-types';
import type { InventoryState } from '../../src/types/inventory-types';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { loadExpedition } = await import('../../src/managers/session');
const { installProceduralRiftRecovery, validateProceduralRiftAdmission } = await import('../../src/managers/rift-recovery');
const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/formal-active.json', 'utf8')) as {
  checkpoint: RiftCheckpoint<ActiveRiftRecoveryState>; inventory: InventoryState;
};
const base = (JSON.parse(readFileSync('tools/recovery/fixtures/prepared-base.json', 'utf8')) as { record: SaveDataV2 }).record;
const records = new Map<string, string>();
saveManager.setStorage({ getItem: key => records.get(key) ?? null, removeItem: key => { records.delete(key); },
  setItem: (key, value) => { records.set(key, value); } });
installProceduralRiftRecovery();
const results: { entry: string; frozenStartingChaos: number; newBaseStartingChaos: number; runtimeValue?: number }[] = [];
interface RoutedEntry {
  key: string;
  modifiers: RiftDepartureIntent['conditions']['modifiers'];
  checkpoint: RiftCheckpoint<ActiveRiftRecoveryState> | null;
}

for (const entry of ['checkpoint', 'departure'] as const) {
  const record = structuredClone(base);
  record.moduleMaxHpTier = 1;
  record.modules.forEach(module => { module.maxHp = 115; module.hp = module.id === 'PURIFIER' ? 100 : 70; });
  record.growth.schemaVersion = 2;
  record.growth.upgrades.growth_defense_slot = 2;
  record.inventory = structuredClone(fixture.inventory);
  record.cycle = fixture.checkpoint.state.conditions.cycle;
  delete record.riftCheckpoint; delete record.riftDeparture; delete record.checkpointChecksum;
  if (entry === 'checkpoint') {
    const checkpoint = structuredClone(fixture.checkpoint);
    // Controlled old-rule state: 100/115 purifier had an opening penalty of 7.
    checkpoint.state.conditions.modifiers.startingChaos = 7;
    assert(validateProceduralRiftAdmission(checkpoint, record.inventory));
    record.riftCheckpoint = checkpoint;
  } else {
    record.riftDeparture = { version: 1, runId: record.inventory.run!.id, identity: fixture.checkpoint.identity,
      conditions: { cycle: record.cycle, modifiers: { ...fixture.checkpoint.state.conditions.modifiers, startingChaos: 7 } } };
  }
  record.checkpointChecksum = checkpointChecksum(record);
  const bytes = JSON.stringify(record);
  records.set(GAME_CONSTANTS.SAVE.KEY, bytes);
  let routed: RoutedEntry | null = null;
  loadExpedition({ scene: { start(key: string, data: { modifiers: RoutedEntry['modifiers']; recovery: { checkpoint: RoutedEntry['checkpoint'] } }) {
    routed = { key, modifiers: data.modifiers, checkpoint: data.recovery.checkpoint };
  } } } as never);
  assert(routed, 'actual continue route must enter the saved Rift');
  const received = routed as RoutedEntry;
  assert.equal(received.key, 'RiftScene');
  assert.equal(received.modifiers.startingChaos, 7, 'continue passes frozen opening conditions');
  assert.equal(gameState.getSortieModifiers().startingChaos, 0, 'the next fresh departure reads the new fixed reference');
  assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), bytes, 'loading leaves the active package unchanged');
  const chaos = new ChaosSystem({ startingValue: received.modifiers.startingChaos, chaosRateModifier: received.modifiers.chaosRateModifier });
  assert.equal(chaos.getValue(), 7);
  if (received.checkpoint) {
    const runtime = received.checkpoint.state.chaos;
    chaos.restoreRuntimeState(runtime);
    assert.deepEqual(chaos.exportRuntimeState(), runtime, 'continuing restores actual accumulated chaos without recalculation');
    results.push({ entry, frozenStartingChaos: received.modifiers.startingChaos,
      newBaseStartingChaos: gameState.getStartingChaos(), runtimeValue: chaos.getValue() });
  } else results.push({ entry, frozenStartingChaos: received.modifiers.startingChaos, newBaseStartingChaos: gameState.getStartingChaos() });
  chaos.destroy();
}
inventoryStore.setPersistence(null);
const out = process.argv[2] ?? 'docs/qa/artifacts/iteration-29-r3/thicken-recovery.json';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ verifiedAt: new Date().toISOString(), result: 'PASS',
  method: 'production SaveManager, session continue routing, procedural admission and ChaosSystem; memory storage with an adapted recorded formal fixture',
  results, limitations: ['Controlled legacy 100/115 fixture; no renderer or live browser is exercised.'] }, null, 2) + '\n');
console.log(`Thickening recovery: old checkpoint and departure remain frozen; ${out}`);
