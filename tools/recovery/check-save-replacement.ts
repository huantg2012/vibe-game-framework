/** New-record guards against isolated storage; never reads a browser's save. */
import assert from 'node:assert/strict';
import type Phaser from 'phaser';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { getDefenseRuntimeState } from '../../src/systems/defense-engine';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';

const records = new Map<string, string>();
const key = GAME_CONSTANTS.SAVE.KEY;
// UI localization is initialized on import; game persistence uses the injected
// backend below, and cannot fall through to a browser's real storage.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (name: string) => name === 'coh_locale' ? 'zh-CN' : null,
} });
const { beginNewExpedition, hasReadableSave } = await import('../../src/managers/session');
const { MainMenuScene } = await import('../../src/scenes/main-menu-scene');
let failReads = false, failRemoves = false, failWrites = false;
let removes = 0, entries = 0, checks = 0;
saveManager.setStorage({
  getItem: name => { if (failReads) throw new Error('Storage access denied'); return records.get(name) ?? null; },
  removeItem: name => {
    removes++;
    if (failRemoves) throw new Error('Deletion denied');
    records.delete(name);
  },
  setItem: (name, value) => { if (failWrites) throw new Error('Write denied'); records.set(name, value); },
});
const host = { scene: { start: () => { entries++; } } } as unknown as Phaser.Scene;
const enter = () => { entries++; };
const snapshot = () => ({
  game: gameState.getState(), inventory: inventoryStore.getState(), growth: growthSystem.getState(),
  tide: tideSystem.getState(), stability: stabilityTracker.getState(), defense: getDefenseRuntimeState(),
  echo: contaminantSystem.getEchoBonusState(), forecast: impactSystem.getForecastState(),
});
const check = (name: string, action: () => void) => { action(); checks++; console.log(`PASS ${name}`); };

check('absent storage starts a new record and normal saves remain loadable', () => {
  assert.equal(saveManager.getRecordPresence(), 'absent');
  assert(beginNewExpedition(host, enter));
  assert.equal(entries, 1);
  gameState.addKindling(19);
  saveManager.save();
  assert.equal(hasReadableSave(), true);
  assert.equal(saveManager.load(), true);
});
const validBytes = records.get(key)!;

for (const [label, bytes] of [
  ['valid', validBytes], ['malformed JSON', '{not-json'], ['future version', '{"version":999,"record":"keep me"}'],
  ['empty stored string', ''], ['JSON null', 'null'],
] as const) {
  check(`${label}: no reset, entry or deletion without explicit replacement`, () => {
    records.set(key, bytes);
    const before = snapshot(), beforeEntries = entries, beforeRemoves = removes;
    assert.equal(saveManager.getRecordPresence(), 'present');
    assert.equal(saveManager.hasSave(), true);
    assert.equal(hasReadableSave(), label === 'valid');
    assert.equal(beginNewExpedition(host, enter), false);
    assert.deepEqual(snapshot(), before);
    assert.equal(entries, beforeEntries);
    assert.equal(removes, beforeRemoves);
    assert.equal(records.get(key), bytes);
  });
}

check('inaccessible storage is not treated as an empty slot, even after confirmation', () => {
  records.set(key, validBytes);
  const before = snapshot(), beforeRemoves = removes, beforeEntries = entries;
  failReads = true;
  assert.equal(saveManager.getRecordPresence(), 'unavailable');
  assert.equal(saveManager.hasSave(), true);
  assert.equal(hasReadableSave(), false);
  assert.equal(saveManager.load(), false);
  assert.equal(beginNewExpedition(host, enter, true), false);
  failReads = false;
  assert.deepEqual(snapshot(), before);
  assert.equal(entries, beforeEntries);
  assert.equal(removes, beforeRemoves);
  assert.equal(records.get(key), validBytes);
});

check('confirmed replacement never deletes the old record, including a read-only deletion backend', () => {
  records.set(key, '{broken');
  const beforeEntries = entries, beforeRemoves = removes;
  failRemoves = true;
  assert(beginNewExpedition(host, enter, true));
  failRemoves = false;
  assert.equal(entries, beforeEntries + 1);
  assert.equal(removes, beforeRemoves);
  assert.equal(records.get(key), '{broken');
  assert.equal(gameState.getCycle(), 0);
  assert.equal(inventoryStore.getRun(), null);
  saveManager.save();
  assert.equal(saveManager.load(), true);
});

check('first replacement write failure retains the exact old bytes; retry commits one complete new record', () => {
  for (const bytes of [validBytes, '{broken', '{"version":999}', '']) {
    records.set(key, bytes);
    assert(beginNewExpedition(host, enter, true));
    failWrites = true;
    assert.equal(saveManager.commitWorldTransaction(() => gameState.addKindling(3)), false);
    assert.equal(records.get(key), bytes);
    assert.equal(saveManager.hasPendingSave(), true);
    assert.equal(beginNewExpedition(host, enter, true), false);
    assert.equal(saveManager.trySave(), false);
    assert.equal(records.get(key), bytes);
    failWrites = false;
    assert(saveManager.trySave());
    assert.equal(saveManager.hasPendingSave(), false);
    assert.equal(saveManager.load(), true);
    assert.equal(gameState.getKindlingReserve(), 3);
  }
});

check('pending settlement and open inventory frames cannot be erased by new-record entry', () => {
  failWrites = true;
  assert.equal(saveManager.commitWorldTransaction(() => gameState.addKindling(1)), false);
  const before = snapshot(), bytes = records.get(key), beforeRemoves = removes;
  assert.equal(beginNewExpedition(host, enter, true), false);
  assert.deepEqual(snapshot(), before);
  assert.equal(records.get(key), bytes);
  assert.equal(removes, beforeRemoves);
  failWrites = false;
  assert(saveManager.trySave());
  inventoryStore.beginFrameTransaction();
  assert.equal(beginNewExpedition(host, enter, true), false);
  assert.equal(removes, beforeRemoves);
  inventoryStore.cancelFrameTransaction();
});

// Exercise the current title render/actions/keyboard path. Only DOM primitives
// are adapted; no menu decision or record-preservation method is replaced.
class MenuElement {
  hidden = false;
  textContent = '';
  children: MenuElement[] = [];
  dataset: Record<string, string> = {};
  classList = { toggle() {} };
  appendChild(child: MenuElement): void { this.children.push(child); }
  replaceChildren(): void { this.children = []; }
  addEventListener(): void {}
  setAttribute(): void {}
  closest(): null { return null; }
}
const elements = new Map(['.joint-warning', '.joint-back-hint', '.joint-english', '.joint-summary', '.joint-actions']
  .map(selector => [selector, new MenuElement()]));
const titleRoot = Object.assign(new MenuElement(), {
  querySelector: (selector: string) => elements.get(selector) ?? null,
  querySelectorAll: (selector: string) => selector === '.joint-action' ? elements.get('.joint-actions')!.children : [],
});
Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: MenuElement });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new MenuElement() } });
interface MenuHarness {
  mode: string; actions: { label: string; run: () => void }[]; selected: number;
  renderMenu(mode?: string): void; keyDown(event: KeyboardEvent): void;
}
const menu = Object.assign(new MainMenuScene(), {
  titleRoot, ready: true, input: { enabled: true },
  scene: { isActive: () => true, isPaused: () => false },
}) as unknown as MenuHarness;
check('title new-game enters confirmation for damaged/future/empty records; cancel and Escape preserve bytes', () => {
  for (const bytes of ['{broken', '{"version":999}', '']) {
    records.set(key, bytes);
    const before = snapshot(), beforeRemoves = removes, beforeEntries = entries;
    menu.renderMenu();
    assert.equal(menu.actions.at(-1)?.label, '开始');
    menu.actions.at(-1)!.run();
    assert.equal(menu.mode, 'overwrite');
    assert.equal(menu.actions[menu.selected]?.label, '保留记录，返回');
    menu.actions[menu.selected]!.run();
    assert.equal(menu.mode, 'root');
    assert.equal(records.get(key), bytes);
    menu.actions.at(-1)!.run();
    let prevented = false;
    menu.keyDown({ key: 'Escape', target: null, repeat: false, preventDefault() { prevented = true; } } as unknown as KeyboardEvent);
    assert(prevented, 'Escape is handled by the real menu keyboard path');
    assert.equal(menu.mode, 'root');
    assert.equal(records.get(key), bytes);
    assert.deepEqual(snapshot(), before);
    assert.equal(removes, beforeRemoves);
    assert.equal(entries, beforeEntries);
  }
});

console.log(`${checks} save replacement checks passed. Browser layout and the in-game pause menu require runtime verification.`);
