/** Direct Phaser destruction invalidates ScenePlugin before DESTROY. Exercise
 * actual waiting-menu and title cleanup against that invalid plugin boundary. */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';
import type { SaveDataV2 } from '../../src/types/game-types';

Object.assign(Phaser, { Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } } });
class Element extends EventTarget {
  id = ''; className = ''; innerHTML = ''; textContent = ''; hidden = false; disabled = false;
  isConnected = true; naturalWidth = 960; naturalHeight = 640;
  style = { cssText: '', opacity: '' }; dataset: Record<string, string> = {};
  children: Element[] = []; selectors = new Map<string, Element>();
  classList = { add() {}, toggle() {}, remove() {} };
  decodeResolve: (() => void) | null = null;
  decode(): Promise<void> { return new Promise(resolve => { this.decodeResolve = resolve; }); }
  appendChild(child: Element): Element { this.children.push(child); return child; }
  append(...children: Element[]): void { this.children.push(...children); }
  replaceChildren(...children: Element[]): void { this.children = children; }
  setAttribute(): void {}
  remove(): void { this.isConnected = false; }
  querySelector(selector: string): Element {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new Element());
    return this.selectors.get(selector)!;
  }
  querySelectorAll(selector: string): Element[] {
    return selector === '.joint-action' ? this.querySelector('.joint-actions').children : [];
  }
}
const root = new Element(), style = new Element();
const documentHost = Object.assign(new EventTarget(), {
  hidden: false, hasFocus: () => true, createElement: () => new Element(),
  getElementById: (id: string) => id === 'dom-ui-root' ? root : style,
});
Object.defineProperty(globalThis, 'document', { configurable: true, value: documentHost });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
class PendingWorker {
  static instances: PendingWorker[] = [];
  onmessage = null; onerror = null; onmessageerror = null; terminated = false;
  constructor() { PendingWorker.instances.push(this); }
  postMessage(): void {}
  terminate(): void { this.terminated = true; }
}
Object.defineProperty(globalThis, 'Worker', { configurable: true, value: PendingWorker });
const { PurificationScene } = await import('../../src/scenes/purification-scene');
const { MainMenuScene } = await import('../../src/scenes/main-menu-scene');
const { pauseMenu } = await import('../../src/ui/dom/pause-menu');
const { audioManager } = await import('../../src/managers/audio-manager');
const { saveManager } = await import('../../src/managers/save-manager');
const { inventoryStore } = await import('../../src/systems/inventory-store');
for (const method of ['unlock', 'playBGM', 'playSFX', 'pauseAll', 'resumeAll', 'haltNonBgm'] as const)
  Object.assign(audioManager, { [method]: () => {} });
const records = new Map<string, string>(), key = GAME_CONSTANTS.SAVE.KEY;
saveManager.setStorage({ getItem: name => records.get(name) ?? null, removeItem: name => { records.delete(name); },
  setItem: (name, bytes) => { records.set(name, bytes); } });
const base = (JSON.parse(readFileSync('tools/recovery/fixtures/prepared-base.json', 'utf8')) as { record: SaveDataV2 }).record;
records.set(key, JSON.stringify(base)); assert(saveManager.load());
const bytes = records.get(key), inventory = inventoryStore.getState();
function plugin() {
  let paused = false, invalidAccess = 0;
  const manager = { isActive: () => !paused, isPaused: () => paused, pause: () => { paused = true; }, resume: () => { paused = false; } };
  return {
    manager: manager as typeof manager | null, key: 'fixture',
    get invalidAccess() { return invalidAccess; },
    isActive() { if (!this.manager) invalidAccess++; return this.manager!.isActive(); },
    isPaused() { if (!this.manager) invalidAccess++; return this.manager!.isPaused(); },
    pause() { if (!this.manager) invalidAccess++; this.manager!.pause(); },
    resume() { if (!this.manager) invalidAccess++; this.manager!.resume(); },
    start() { if (!this.manager) { invalidAccess++; throw new Error('Destroyed ScenePlugin'); } },
  };
}

const havenPlugin = plugin(), haven = new PurificationScene();
Object.assign(haven, { events: new EventEmitter(), scene: havenPlugin });
const havenGate = haven as unknown as { prepareRiftDeparture(): Promise<void>; departureAbort: AbortController | null; shuttingDown: boolean };
const pending = havenGate.prepareRiftDeparture();
assert(pauseMenu.isOpen());
// Phaser sys.destroy does not call shutdown. The plugin's destroy listener
// invalidates its manager before these scene-owned waiting handlers run.
havenPlugin.manager = null; haven.events.emit('destroy');
await pending;
assert.equal(havenPlugin.invalidAccess, 0); assert.equal(pauseMenu.isOpen(), false);
assert.equal(havenGate.departureAbort, null); assert(havenGate.shuttingDown);
assert.equal(records.get(key), bytes); assert.deepEqual(inventoryStore.getState(), inventory);
assert(PendingWorker.instances.at(-1)!.terminated);
console.log('PASS direct haven destruction: invalid ScenePlugin is never resumed; actual waiting DOM discarded, bytes/inventory unchanged');

const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/formal-active.json', 'utf8'));
const active = structuredClone(base);
active.inventory = fixture.inventory; active.riftCheckpoint = fixture.checkpoint; active.cycle = fixture.checkpoint.state.conditions.cycle;
active.checkpointChecksum = checkpointChecksum(active); records.set(key, JSON.stringify(active));
const titlePlugin = plugin(), title = new MainMenuScene({ animate: false });
Object.assign(title, { events: new EventEmitter(), scene: titlePlugin, input: { enabled: true } });
title.create();
const titleGate = title as unknown as { continueRecord(): void; titleRoot: Element | null; loadAbort: AbortController | null };
const titleRoot = titleGate.titleRoot!, art = titleRoot.querySelector('.joint-art');
titleGate.continueRecord(); assert(titleGate.loadAbort);
const rejection: unknown[] = [], onRejection = (reason: unknown): void => { rejection.push(reason); };
process.on('unhandledRejection', onRejection);
titlePlugin.manager = null; title.events.emit('destroy'); art.decodeResolve!();
await new Promise(resolve => setImmediate(resolve));
process.off('unhandledRejection', onRejection);
assert.equal(titlePlugin.invalidAccess, 0); assert.equal(titleGate.loadAbort, null); assert.equal(titleGate.titleRoot, null);
assert.equal(titleRoot.isConnected, false); assert.deepEqual(rejection, []);
assert(PendingWorker.instances.at(-1)!.terminated);
assert.equal(title.events.listenerCount('shutdown'), 0); assert.equal(title.events.listenerCount('destroy'), 0);
title.events.emit('shutdown'); // A redundant lifecycle signal is harmless.
assert.equal(titlePlugin.invalidAccess, 0);
inventoryStore.setPersistence(null);
console.log('PASS direct title destruction: pending recovery and late art decode are cancelled; owned DOM and lifecycle listeners removed');
