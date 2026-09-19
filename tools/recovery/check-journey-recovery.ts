/** Recovery routing, using fresh Node processes as genuine module reloads.
 * Actual SaveManager, JourneySession, RunController and the formal base create()
 * settlement run. Only rendering/timers are adapted. Offering setup is an explicit
 * unit fixture, not earned keyboard gameplay or a persistent-supply playtest.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/recovery/check-journey-recovery.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { checkpointChecksum, type RiftCheckpoint } from '../../src/types/rift-checkpoint';
import type { SaveDataV2 } from '../../src/types/game-types';
import type { RiftRecoveryState, SettledRiftRecoveryState } from '../../src/systems/rift-recovery-state';
import type { SeaJourneySelection } from '../../src/dev/suspended-sea/journey-session';

const key = GAME_CONSTANTS.SAVE.KEY;
type ChildInput = { mode: 'departure' | 'active' | 'terminal' | 'reload'; raw?: string; offering?: boolean;
  failure?: boolean; reason?: 'extract' | 'death'; selection?: SeaJourneySelection };
const self = fileURLToPath(import.meta.url);
function processReload(input: ChildInput): any {
  return JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', self, '--child'], {
    cwd: process.cwd(), input: JSON.stringify(input), encoding: 'utf8',
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' },
    maxBuffer: 8 * 1024 * 1024,
  }));
}
function encode(data: SaveDataV2): string {
  delete data.checkpointChecksum; data.checkpointChecksum = checkpointChecksum(data); return JSON.stringify(data);
}

async function child(input: ChildInput) {
  let browserWrites = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => 'zh-CN', setItem() { browserWrites++; throw new Error('Main browser storage was accessed'); },
    removeItem() { browserWrites++; throw new Error('Main browser storage was accessed'); },
  } });
  const { SuspendedSeaJourneySession } = await import('../../src/dev/suspended-sea/journey-session');
  const { PurificationScene } = await import('../../src/scenes/purification-scene');
  const { saveManager } = await import('../../src/managers/save-manager');
  const { gameState } = await import('../../src/managers/game-state');
  const { inventoryStore } = await import('../../src/systems/inventory-store');
  const { contaminantSystem } = await import('../../src/systems/contaminant-system');
  const { impactSystem } = await import('../../src/systems/impact-system');
  const { tideSystem } = await import('../../src/systems/tide-system');
  const { growthSystem } = await import('../../src/systems/growth-system');
  const { stabilityTracker } = await import('../../src/systems/stability-tracker');
  const { eventBus } = await import('../../src/core/event-bus');
  const { GameEvent } = await import('../../src/types/events');
  const { audioManager } = await import('../../src/managers/audio-manager');
  const { CONTAMINANT_DATA } = await import('../../src/generated/contaminant-data');
  const { commitEffects } = await import('../../src/core/commit-effects');
  const { suspendedSeaIdentity } = await import('../../src/dev/suspended-sea/recovery');
  const { createNativeRecoveryFixture } = await import('./native-fixture');
  audioManager.playSFX = () => {}; audioManager.stopLoop = () => {};
  const records = new Map<string, string>(input.raw ? [[key, input.raw]] : []);
  const attempted: string[] = [], events: string[] = [];
  let fail = false, retryRequested = false;
  const storage = { getItem: (name: string) => records.get(name) ?? null,
    removeItem: (name: string) => { records.delete(name); },
    setItem: (name: string, bytes: string) => { if (name === key) attempted.push(bytes);
      if (fail) throw new Error('Expected injected write failure'); records.set(name, bytes); } };
  for (const event of [GameEvent.GAME_SAVED, GameEvent.GAME_LOADED, GameEvent.RIFT_ENTERED,
    GameEvent.RIFT_EXITED, GameEvent.IMPACT_RESOLVED, GameEvent.CONTAMINANT_TRANSFORMED])
    eventBus.on(event, () => events.push(event));
  const facts = () => structuredClone({ inventory: inventoryStore.getState(), game: gameState.getState(),
    tide: tideSystem.getState(), growth: growthSystem.getState(), stability: stabilityTracker.getState(),
    forecast: impactSystem.getForecastState(), echo: contaminantSystem.getEchoBonusState() });
  const bases: boolean[] = [], starts: unknown[] = [];
  const drawnBoundary = new Error('Drawing boundary');
  const settleBase = (initial: boolean) => {
    bases.push(initial);
    const scene = new PurificationScene();
    Object.assign(scene, { textures: { exists() { throw drawnBoundary; } }, requestSaveRetry() { retryRequested = true; } });
    assert.throws(() => scene.create({ fromMenu: initial }), error => error === drawnBoundary);
  };
  const session = new SuspendedSeaJourneySession({ enterBase: settleBase,
    enterRift(world, data, checkpoint) {
      starts.push({ world: structuredClone(world.metadata), data: structuredClone(data), checkpoint: checkpoint ?? null });
      session.markRiftReady();
    },
  }, storage, true);
  const before = facts();
  if (input.mode === 'reload') fail = input.failure === true;
  let error: string | null = null;
  try { session.initialize({} as never); }
  catch (reason) { error = reason instanceof Error ? reason.message : String(reason); }
  if (input.mode !== 'reload') {
    assert.equal(error, null); assert.equal(session.snapshot().phase, 'base');
    if (input.offering) {
      // Fixture from a preceding trip, one true impact away from maturity.
      const item = contaminantSystem.createUnowned('kindle', CONTAMINANT_DATA.kindle.rarity, 'good');
      item.id = 'earlier-trip-offered-shell'; item.impactCharges = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD - 1;
      assert(inventoryStore.addContaminant(item).ok); assert(inventoryStore.slotOffering(item.id, 0).ok);
      gameState.incrementCycle(); // This earned-offering fixture already returned from its tutorial trip.
    }
    const scene = new PurificationScene();
    const selection = input.selection ?? { scene: 'sea-open-channel', seed: '19' };
    const gate = scene as unknown as { devDeparture: { start(data: unknown): void } | null; transitionToRift(): void };
    Object.assign(scene, {
      devSession: { prepareDeparture: () => session.prepareDeparture(selection) },
      // Stop at exactly the transition UI, leaving the already-written intent intact.
      finishRiftDeparture() {
        if (input.mode === 'departure') return;
        gate.devDeparture!.start({ cycle: gameState.getCycle(), modifiers: gameState.getSortieModifiers(), loadout: contaminantSystem.getSortieLoadout() });
      },
    });
    gate.transitionToRift();
    assert.equal(gameState.getCycle(), input.offering ? 2 : 1); assert.equal(inventoryStore.getRun()?.status, 'active');
    assert(saveManager.peekRiftDeparture());
    if (input.mode !== 'departure') {
      const intent = saveManager.peekRiftDeparture()!;
      const f = createNativeRecoveryFixture({ preserveInventory: true, seed: intent.identity.seed,
        sceneId: intent.identity.layoutId, conditions: intent.conditions });
      const publish = (state: RiftRecoveryState, sequence: number) => {
        const checkpoint: RiftCheckpoint<RiftRecoveryState> = { version: 1, runId: inventoryStore.getRun()!.id,
          identity: suspendedSeaIdentity(f.native), sequence, elapsedMs: state.run.elapsedMs, state };
        const write = saveManager.prepareRiftCommit(checkpoint);
        assert(inventoryStore.commitFrameTransaction(write)); commitEffects.flush();
      };
      inventoryStore.beginFrameTransaction(); commitEffects.begin(); publish(f.capture(), 0);
      if (input.mode === 'terminal') {
        inventoryStore.beginFrameTransaction(); commitEffects.begin();
        if (input.reason === 'death') eventBus.emit(GameEvent.PLAYER_DIED, { cause: 'unit fixture' });
        else eventBus.emit(GameEvent.RIFT_EXIT_REACHED, {});
        const receipt: SettledRiftRecoveryState = { version: 1, phase: 'settled', conditions: f.conditions,
          run: f.run.exportRuntimeState(), presentationSequence: 0, result: { killCount: 0, acquired: [], passiveTriggers: [] } };
        publish(receipt, 1);
      }
      f.destroy();
    }
  }
  const response = { raw: records.get(key), previous: records.get(`${key}:previous`) ?? null,
    before, after: facts(), phase: session.snapshot().phase, bases, starts, events, error,
    retryRequested, pending: saveManager.hasPendingSave(), attempted, browserWrites,
    ledger: session.exportLedger().map(row => row.boundary) };
  session.close(); assert.equal(browserWrites, 0);
  return response;
}

if (process.argv.includes('--child')) {
  process.stdout.write(JSON.stringify(await child(JSON.parse(readFileSync(0, 'utf8')))));
} else {
  let checks = 0;
  function check(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`); }
  check('formal departure atomically records one run/cycle and refresh resumes the entry intent without a new expedition', () => {
    const cut = processReload({ mode: 'departure', selection: { scene: 'sea-folded-ridge', seed: '7' } });
    const saved = JSON.parse(cut.raw) as SaveDataV2;
    assert.equal(saved.inventory.run!.id, saved.riftDeparture!.runId); assert.equal(saved.cycle, 1);
    assert.equal(saved.riftDeparture!.conditions.cycle, 1); assert.equal(saved.riftCheckpoint, undefined);
    assert.equal(cut.starts.length, 0, 'interruption is before the engine insertion, after the atomic save');
    const loaded = processReload({ mode: 'reload', raw: cut.raw });
    assert.equal(loaded.error, null); assert.deepEqual(loaded.bases, []); assert.equal(loaded.starts.length, 1);
    assert.equal(loaded.starts[0].checkpoint, null); assert.equal(loaded.starts[0].world.sceneId, 'sea-folded-ridge');
    assert.equal(loaded.starts[0].world.seed, 7); assert.equal(loaded.after.game.cycle, 1);
    assert.deepEqual(loaded.after.inventory, saved.inventory); assert.equal(loaded.raw, cut.raw);
    assert.equal(loaded.events.filter((event: string) => event === 'rift:entered').length, 0);
  });
  check('a complete active record routes its original world and unique inventory, independent of new sidebar selection', () => {
    const cut = processReload({ mode: 'active', selection: { scene: 'sea-open-channel', seed: '19' } });
    const saved = JSON.parse(cut.raw) as SaveDataV2; assert.equal((saved.riftCheckpoint!.state as RiftRecoveryState).phase, 'active');
    assert.equal(saved.riftDeparture, undefined);
    const loaded = processReload({ mode: 'reload', raw: cut.raw, selection: { scene: 'sea-folded-ridge', seed: '42' } });
    assert.equal(loaded.error, null); assert.deepEqual(loaded.bases, []); assert.equal(loaded.starts.length, 1);
    assert.equal(loaded.starts[0].world.sceneId, 'sea-open-channel'); assert.equal(loaded.starts[0].world.seed, 19);
    assert.deepEqual(loaded.starts[0].checkpoint, saved.riftCheckpoint); assert.equal(loaded.after.game.cycle, 1);
    assert.equal(loaded.raw, cut.raw); assert.deepEqual(loaded.after.inventory, saved.inventory);
  });
  check('settled receipt enters formal base impact/maturation once; another process load does not replay either', () => {
    const cut = processReload({ mode: 'terminal', offering: true, reason: 'extract' });
    const saved = JSON.parse(cut.raw) as SaveDataV2; assert.equal((saved.riftCheckpoint!.state as RiftRecoveryState).phase, 'settled');
    assert.notEqual(saved.inventory.run!.baseSettled, true);
    const loaded = processReload({ mode: 'reload', raw: cut.raw });
    assert.equal(loaded.error, null); assert.deepEqual(loaded.bases, [false]); assert.deepEqual(loaded.starts, []);
    assert.equal(loaded.after.inventory.run.baseSettled, true);
    const mature = loaded.after.inventory.items.find((item: any) => item.id === 'earlier-trip-offered-shell');
    assert.equal(mature.contaminant.stage, 'tool'); assert.equal(mature.contaminant.usesRemaining, 6);
    assert.equal(loaded.events.filter((event: string) => event === 'impact:resolved').length, 1);
    assert.equal(loaded.events.filter((event: string) => event === 'contaminant:transformed').length, 1);
    assert.equal(loaded.events.filter((event: string) => event === 'rift:exited').length, 0);
    const repeated = processReload({ mode: 'reload', raw: loaded.raw });
    assert.equal(repeated.error, null); assert.deepEqual(repeated.bases, [true]); assert.deepEqual(repeated.after, loaded.after);
    assert.equal(repeated.events.filter((event: string) => event === 'impact:resolved').length, 0);
    assert.equal(repeated.events.filter((event: string) => event === 'contaminant:transformed').length, 0);
  });
  check('failed base write preserves the settled record and reload produces identical impact, forecast and replacement ID', () => {
    const cut = processReload({ mode: 'terminal', offering: true, reason: 'death' });
    const failed = processReload({ mode: 'reload', raw: cut.raw, failure: true });
    assert.equal(failed.error, null); assert(failed.pending); assert.equal(failed.raw, cut.raw);
    // This adapter stops before rendering. Retry and reveal now wait until the
    // scene is ready; their real DOM/input behavior is covered by
    // tools/qa/check-i28-reveal-persistence.mjs, not this drawing-boundary fixture.
    const loaded = processReload({ mode: 'reload', raw: failed.raw });
    assert.equal(loaded.error, null); assert.deepEqual(loaded.after, failed.after);
    const replacement = loaded.after.inventory.items.find((item: any) => item.kind === 'weapon');
    assert.equal(replacement.id, `WPN_replacement:${loaded.after.inventory.run.id}`);
    assert.equal(replacement.weapon.usesRemaining, 60);
    const repeated = processReload({ mode: 'reload', raw: loaded.raw });
    assert.deepEqual(repeated.after, loaded.after); assert.deepEqual(repeated.bases, [true]);
  });
  check('bad JSON and unknown world signatures retain raw bytes and live systems, without new-game fallback', () => {
    const cut = processReload({ mode: 'active' });
    const saved = JSON.parse(cut.raw) as SaveDataV2; saved.riftCheckpoint!.identity.signature = 'unknown-version';
    for (const raw of ['{unfinished-json', encode(saved)]) {
      const loaded = processReload({ mode: 'reload', raw });
      assert(loaded.error); assert.equal(loaded.phase, 'faulted'); assert.equal(loaded.raw, raw);
      assert.deepEqual(loaded.bases, []); assert.deepEqual(loaded.starts, []);
      assert.deepEqual(loaded.after, loaded.before); assert.deepEqual(loaded.attempted, []);
    }
  });
  console.log(`${checks} journey recovery routing checks passed. Fresh processes replace module reloads; these are not gameplay or GPU evidence.`);
}
