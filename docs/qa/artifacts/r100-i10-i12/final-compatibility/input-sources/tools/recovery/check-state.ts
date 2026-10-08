/** Whole-frame guard: real native constructors/snapshots, then targeted corruptions.
 * No browser or simulated playthrough; engine rendering and UI alone are adapted.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/recovery/check-state.ts
 */
import assert from 'node:assert/strict';
import { inventoryStore } from '../../src/systems/inventory-store';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { audioManager } from '../../src/managers/audio-manager';
import type { RiftRecoveryState, SettledRiftRecoveryState } from '../../src/systems/rift-recovery-state';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'zh-CN' } });
const { validateRiftRecoveryState } = await import('../../src/systems/rift-recovery-state');
const { createNativeRecoveryFixture: fixture } = await import('./native-fixture');
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const originalAudio = { playSFX: audioManager.playSFX, stopLoop: audioManager.stopLoop };
audioManager.playSFX = () => {}; audioManager.stopLoop = () => {};
let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`); }

check('real native modules export one valid active frame; validator never writes to input or inventory', () => {
  const f = fixture(); const saved = f.capture(), inventory = inventoryStore.getState(), text = JSON.stringify({ saved, inventory });
  assert(validateRiftRecoveryState(saved, inventory, 0));
  assert(validateRiftRecoveryState({ ...saved, physics: { ...saved.physics, elapsedMs: 40 } }, inventory, 0), 'fixed-step debt can exceed one step');
  assert.equal(JSON.stringify({ saved, inventory }), text);
  assert(!validateRiftRecoveryState(saved, inventory, 1), 'outer clock cannot refer to another frame');
  f.destroy();
});
check('cross-domain guard rejects mismatched alive roster, committed windup, interruption latch and player slowdown', () => {
  const f = fixture(), good = f.capture(), inventory = inventoryStore.getState();
  const cases: ((bad: any) => void)[] = [
    bad => bad.ai.enemies.reverse(),
    bad => { bad.physics.elapsedMs = -1; },
    bad => { bad.physics.timeScale = .5; },
    bad => { bad.combat.enemies[0].attackPhase = 'windup'; bad.combat.attackTokensInUse = 1; },
    bad => { bad.combat.enemies[0].controlInterruptRevision = 1; },
    bad => bad.player.speedModifiers.push(['attack', .35]),
    bad => { bad.combat.weaponId = null; },
    bad => { bad.ai.runSeed = 20; },
    bad => { bad.search.runSeed = 20; },
    bad => { bad.tools.elapsedMs = 1; },
    bad => { bad.trail.visited = [{ tileKey: bad.minimap.explored.length, atMs: 0 }]; },
    bad => { bad.result.killCount = 1; },
    bad => { bad.tools.stitchStops = [{ enemyId: 'not-in-world', source: 'tool:1', remainingMs: 500 }]; bad.tools.controlSerial = 1; },
  ];
  for (const corrupt of cases) { const bad = json(good); corrupt(bad); assert(!validateRiftRecoveryState(bad, inventory, 0)); }
  assert(validateRiftRecoveryState(good, inventory, 0)); f.destroy();
});
check('known dead targets remain valid historical seam membership, without respawning them', () => {
  const f = fixture(), saved = f.capture();
  const deadId = saved.ai.enemies[0]!.id;
  const cut = json(saved) as any;
  cut.ai.enemies.shift(); cut.combat.enemies.shift(); cut.result.killCount = 1;
  cut.tools.controlSerial = 1; cut.tools.stitchStops = [{ enemyId: deadId, source: 'tool:1', remainingMs: 500 }];
  assert(validateRiftRecoveryState(cut, inventoryStore.getState(), 0)); f.destroy();
});
check('real revealed UUIDs and pure fuel are cross-checked with the exact inventory ledger', () => {
  const f = fixture(); const fuel = f.native.base.layout.kindlingNodes.find(row => !row.allowWeapon)!;
  f.finishSearch(fuel.id); const item = f.native.base.layout.contaminantNodes[0]!; f.finishSearch(item.id);
  const good = f.capture(), inventory = inventoryStore.getState(); assert(validateRiftRecoveryState(good, inventory, 0));
  const badLedger = json(inventory); badLedger.run!.revealedNodes[item.id] = ['another-uuid'];
  assert(!validateRiftRecoveryState(good, badLedger, 0));
  const badFuel = json(inventory); badFuel.run!.revealedNodes[fuel.id] = ['invented-fuel-item'];
  assert(!validateRiftRecoveryState(good, badFuel, 0));
  const invalidItem = json(inventory); invalidItem.items.find(row => row.source?.nodeId === item.id)!.source!.runId = 'another-run';
  assert(!validateRiftRecoveryState(good, invalidItem, 0));
  f.destroy();
});
check('real death, extraction and explicit abandon produce only settled receipts matching the same loss/reward ledger', () => {
  for (const reason of ['death', 'extract', 'abandon'] as const) {
    const f = fixture(); f.setElapsed(500);
    const fuel = f.native.base.layout.kindlingNodes.find(row => !row.allowWeapon)!; f.finishSearch(fuel.id);
    if (reason === 'death') eventBus.emit(GameEvent.PLAYER_DIED, { cause: 'test' });
    else if (reason === 'extract') eventBus.emit(GameEvent.RIFT_EXIT_REACHED, undefined);
    else f.run.abandon();
    const receipt: SettledRiftRecoveryState = json({ version: 1, phase: 'settled', conditions: f.conditions,
      run: f.run.exportRuntimeState(), result: { killCount: 0, acquired: [], passiveTriggers: [] }, presentationSequence: 0 });
    const inventory = inventoryStore.getState(); assert(validateRiftRecoveryState(receipt, inventory, 500));
    assert(!('tools' in receipt)); assert(!('player' in receipt));
    if (reason !== 'extract') { assert.equal(inventory.items.filter(item => item.location.kind === 'carried').length, 0); assert.equal(receipt.run.lastKindling, 0); }
    else assert(receipt.run.lastKindling > 0);
    const mismatch = json(inventory); mismatch.run!.outcome = reason === 'extract' ? 'death' : 'extract';
    assert(!validateRiftRecoveryState(receipt, mismatch, 500));
    const repeated = json(inventory); repeated.run!.baseSettled = true;
    assert(!validateRiftRecoveryState(receipt, repeated, 500), 'a already-settled base cannot be charged again');
    const falseLive = { ...receipt, phase: 'active' } as unknown as RiftRecoveryState;
    assert(!validateRiftRecoveryState(falseLive, inventory, 500)); f.destroy();
  }
});

inventoryStore.setPersistence(null); audioManager.playSFX = originalAudio.playSFX; audioManager.stopLoop = originalAudio.stopLoop;
console.log(`${checks} whole-frame recovery checks passed. Native world geometry/signature and persisted publication remain owned by runtime/SaveManager.`);
