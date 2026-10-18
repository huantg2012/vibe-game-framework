import assert from 'node:assert/strict';
import { ChaosSystem } from '../../src/systems/chaos-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { audioManager } from '../../src/managers/audio-manager';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'zh-CN' } });
const { validateRiftRecoveryState } = await import('../../src/systems/rift-recovery-state');
const { createNativeRecoveryFixture } = await import('../recovery/native-fixture');
audioManager.playSFX = () => {}; audioManager.stopLoop = () => {};
const native = createNativeRecoveryFixture();
const original = native.capture();
const modernChaos = new ChaosSystem({ assimilationMode: 'persistent-v1', startingValue: 50,
  getAssimilation: () => 40, setAssimilation: () => {} });
const modern = { ...original, chaos: modernChaos.exportRuntimeState(), player: { ...original.player,
  speedModifiers: [...original.player.speedModifiers.filter(([source]) => source !== 'chaos'), ['chaos', .95] as [string, number]] } };
const inventory = inventoryStore.getState();
assert(validateRiftRecoveryState(modern, inventory, 0), 'New-mode slowdown participates in whole-frame validation');
assert(!validateRiftRecoveryState({ ...modern, player: { ...modern.player,
  speedModifiers: [['chaos', 1]] } }, inventory, 0), 'Legacy slowdown cannot be substituted into a modern frame');
const { assimilationMode: _mode, assimilationValue: _value, growthResistance: _growth, ...legacyChaos } = modern.chaos;
assert(!validateRiftRecoveryState({ ...modern, chaos: legacyChaos }, inventory, 0), 'Dropping the mode cannot silently reinterpret movement');
assert(validateRiftRecoveryState(original, inventory, 0), 'Original frame remains valid without migration');
modernChaos.destroy(); native.destroy();
console.log('PASS assimilation checkpoint: new/legacy whole-frame speed contract and mode isolation');
