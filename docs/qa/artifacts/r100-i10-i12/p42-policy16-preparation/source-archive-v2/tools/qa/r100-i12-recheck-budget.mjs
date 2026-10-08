/** Supplementary policy16 input deadline. Reads the real game clock only.
 * No clock mutation, injected rewards, hidden AI state, or input after a deadline
 * check fails. The 1000ms early-stop margin absorbs asynchronous cleanup; any
 * measured duration above6000ms is explicitly invalid, never qualified. */
import assert from 'node:assert/strict';

export const RECHECK_POLICY = Object.freeze({maxPerTrip: 1, maxElapsedMs: 6000,
  earlyStopMs: 5000, actionReserveMs: 250, minimumEntryDistance: 320, maxPickups: 3});

class RecheckStop extends Error {
  constructor(reason) {super(reason); this.name = 'RecheckStop';}
}

/** One claim for the whole trip, rather than one claim per observed target. */
export function claimObservedSearchRecheck(trip, {decision, target, observedIds, entry, state, pickupCount, pickupLimit}) {
  assert(Number.isInteger(pickupLimit) && pickupLimit > 0 && pickupLimit <= RECHECK_POLICY.maxPickups);
  if (trip.used || decision?.attempted !== false || decision.reason !== 'visible-opponent-too-close'
    || !target || !observedIds.includes(target.id) || state.ended || state.hp <= 30 || state.chaos >= 120
    || pickupCount >= pickupLimit || Math.hypot(target.pos.x-entry.x, target.pos.y-entry.y) <= RECHECK_POLICY.minimumEntryDistance) return false;
  trip.used = true; return true;
}

export function createRecheckBudget(rawPage, readState, log, returnBudgetStopped = async () => false) {
  let active = null;
  let runs = 0;
  const held = new Set();
  function stop(reason) {active.stopReason ??= reason; throw new RecheckStop(active.stopReason);}
  function inspect(state, costMs = 0) {
    if (!active) return;
    assert(state.scene === 'rift' && Number.isFinite(state.elapsedMs), 'A real Rift elapsed clock is required');
    const elapsed = state.elapsedMs-active.startedElapsedMs;
    assert(elapsed >= 0, 'Recheck game clock cannot move backwards');
    active.maxObservedElapsedMs = Math.max(active.maxObservedElapsedMs, elapsed);
    if (active.stopReason) throw new RecheckStop(active.stopReason);
    if (state.ended) stop('run-ended');
    if (!state.active || state.paused) stop('run-not-active');
    if (state.hp <= 30 || state.chaos >= 120) stop('return-reserve-threshold');
    if (elapsed >= RECHECK_POLICY.earlyStopMs
      || elapsed+costMs+RECHECK_POLICY.actionReserveMs >= RECHECK_POLICY.earlyStopMs)
      stop('game-time-budget');
  }
  async function checkpoint(costMs = 0) {
    if (!active) return;
    const state = await readState(); inspect(state, costMs);
    if (await returnBudgetStopped(state)) stop('return-reserve-threshold');
    // A read-only route calculation also consumes real simulation time.
    inspect(await readState(), costMs);
  }
  const keyboard = {
    async down(key) {
      await checkpoint();
      if (active) held.add(key);
      await rawPage.keyboard.down(key);
      if (active && key.toLowerCase() === 'e') active.searchStarted = true;
      await checkpoint();
    },
    async up(key) {
      // Release is always allowed, including deadline/exception cleanup.
      await rawPage.keyboard.up(key); held.delete(key);
    },
    async press(key, options) {
      await checkpoint(options?.delay ?? 0);
      if (!active) return rawPage.keyboard.press(key, options);
      held.add(key);
      try {await rawPage.keyboard.press(key, options); await checkpoint();}
      finally {await keyboard.up(key);}
    },
  };
  const page = new Proxy(rawPage, {
    get(target, key) {
      if (key === 'keyboard') return keyboard;
      if (key === 'waitForTimeout') return async ms => {
        await checkpoint(ms); await target.waitForTimeout(ms); await checkpoint();
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  async function run({targetId, reason, originalSearchIndex, triggerElapsedMs}, work) {
    assert(!active, 'Recheck windows cannot overlap');
    assert(runs < RECHECK_POLICY.maxPerTrip, 'At most one recheck window per trip');
    const before = await readState();
    assert(before.scene === 'rift' && !before.ended && Number.isFinite(before.elapsedMs));
    assert(Number.isInteger(originalSearchIndex) && originalSearchIndex >= 0);
    assert(Number.isFinite(triggerElapsedMs) && triggerElapsedMs <= before.elapsedMs);
    runs++;
    active = {targetId, reason, originalSearchIndex, triggerElapsedMs,
      startedElapsedMs: before.elapsedMs, maxObservedElapsedMs: 0, searchStarted: false};
    const receipt = {...active, status: 'running', searchDecision: null, actualCollectedNodeIds: [], errors: []};
    log({event: 'bounded-search-recheck-start', ...receipt, policy: RECHECK_POLICY});
    let result;
    try {await checkpoint(); result = await work(); await checkpoint(); receipt.status = 'completed';}
    catch (error) {
      if (error instanceof RecheckStop) {
        receipt.status = error.message === 'game-time-budget' ? 'game-time-budget' : 'completed';
        receipt.completionReason = error.message;
      }
      else {receipt.status = 'error'; receipt.errors.push(String(error.stack ?? error));}
    } finally {
      for (const key of [...held]) {
        try {await keyboard.up(key);} catch (error) {receipt.errors.push(`Input release ${key}: ${error}`);}
      }
      // Keep cleanup inside the measured interval. Clearing the guard happens
      // only after every outstanding key is released and the actual clock read.
      try {
        const after = await readState();
        assert(after.scene === 'rift' && Number.isFinite(after.elapsedMs));
        receipt.endedElapsedMs = after.elapsedMs;
        receipt.elapsedMs = after.elapsedMs-receipt.startedElapsedMs;
        receipt.maxObservedElapsedMs = Math.max(active.maxObservedElapsedMs, receipt.elapsedMs);
        receipt.withinTimeBound = receipt.elapsedMs >= 0 && receipt.maxObservedElapsedMs <= RECHECK_POLICY.maxElapsedMs;
        receipt.actualCollectedNodeIds = after.nodes.filter(node => node.collected
          && before.nodes.find(original => original.id === node.id)?.collected === false).map(node => node.id);
        receipt.searchDecision = result?.searchDecision ?? {attempted: active.searchStarted,
          reason: active.searchStarted ? `bounded-input-${receipt.status}` : 'bounded-input-before-channel'};
        if (!receipt.withinTimeBound) receipt.errors.push(`Measured recheck exceeded6000ms: ${receipt.elapsedMs}`);
        if (result?.reason) receipt.completionReason = result.reason;
        result = {...result, after};
      } catch (error) {receipt.withinTimeBound = false; receipt.errors.push(`Final recheck clock: ${error}`);}
      receipt.releasedAllTrackedKeys = held.size === 0;
      if (!receipt.releasedAllTrackedKeys) receipt.errors.push('Not all held inputs could be released');
      active = null;
      if (receipt.errors.length) receipt.status = 'failed';
      log({event: 'bounded-search-recheck-end', ...receipt});
    }
    return {receipt, after: result?.after};
  }
  return {page, checkpoint, inspect, run};
}

/** Preserve the real driver, with the whole hold reserved before any key-down. */
export function guardRecheckDriver(inputDriver, readState, budget) {
  return {...inputDriver,
    state: async () => {const state = await readState(); budget.inspect(state); return state;},
    hold: async (keys, ms) => {
      await budget.checkpoint(ms + 35); await inputDriver.hold(keys, ms); await budget.checkpoint();
    },
    snap: async label => {
      await budget.checkpoint(); const result = await inputDriver.snap(label); await budget.checkpoint(); return result;
    },
  };
}
