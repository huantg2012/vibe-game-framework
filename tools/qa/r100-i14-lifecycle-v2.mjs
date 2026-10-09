// Narrow correction: allow validated pagehide sequence/checksum recommit only. Original v1 and first failure preserved.
/** Read-only lifecycle observations around real pause, tab activation and Continue.
 * Runtime exports below are audit-only; none feed route or reward decisions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const hash = text => createHash('sha256').update(text).digest('hex');
const write = (folder, name, value) => fs.writeFileSync(path.join(folder, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

export async function installI14BrowserObservations(page) {
  await page.addInitScript(() => {
    window.__i14BrowserEvents = [];
    window.__i14LongTasks = [];
    for (const type of ['blur', 'focus', 'pagehide', 'pageshow', 'visibilitychange']) {
      (type === 'visibilitychange' ? document : window).addEventListener(type, event => {
        window.__i14BrowserEvents.push({ type, trusted: event.isTrusted, hidden: document.hidden,
          focused: document.hasFocus(), at: performance.now() });
      });
    }
    new PerformanceObserver(list => {
      for (const task of list.getEntries()) window.__i14LongTasks.push({ start: task.startTime, duration: task.duration });
    }).observe({ entryTypes: ['longtask'] });
  });
}

/** Observe the first complete normal frame; never pause or alter the frame. */
export async function armI14EntryObservation(page, phase) {
  return page.evaluate(async phase => {
    const { RiftScene } = await import('/src/scenes/rift-scene.ts');
    const { inventoryStore } = await import('/src/systems/inventory-store.ts');
    if (!window.__i14FrameObserverInstalled) {
      const original = RiftScene.prototype.onPostUpdate;
      RiftScene.prototype.onPostUpdate = function (...args) {
        const result = original.apply(this, args);
        const request = window.__i14EntryObservation;
        if (request && !request.firstComplete && this.nativeWorldPresentation && this.frameCommit
          && !this.stagedEntry?.isActive() && !this.nativeEntryFence?.isActive()
          && !this.frameCommit.isBlocked() && !this.runController.isRunEnded()) {
          request.firstComplete = { at: performance.now(), frame: this.game.loop.frame,
            checkpoint: this.captureRuntimeCheckpoint((this.frameCommit.sequence ?? 0) + 1),
            inventory: inventoryStore.getState(), raw: localStorage.getItem('coh-save-v1') };
        }
        return result;
      };
      window.__i14FrameObserverInstalled = true;
    }
    window.__i14EntryObservation = { phase, requestedAt: performance.now(), firstComplete: null };
    return window.__i14EntryObservation.requestedAt;
  }, phase);
}

export async function readI14EntryObservation(page) {
  return page.evaluate(() => ({ ...window.__i14EntryObservation,
    longTasks: window.__i14LongTasks.filter(task => task.start >= window.__i14EntryObservation.requestedAt) }));
}

export async function readI14FullState(page) {
  return page.evaluate(async () => {
    const scene = window.__game.scene.getScene('RiftScene');
    const { inventoryStore } = await import('/src/systems/inventory-store.ts');
    return { at: performance.now(), checkpoint: scene.captureRuntimeCheckpoint((scene.frameCommit?.sequence ?? 0) + 1),
      inventory: inventoryStore.getState(), raw: localStorage.getItem('coh-save-v1'),
      paused: scene.scene.isPaused(), physicsPaused: scene.physics.world.isPaused, clockPaused: scene.time.paused,
      hidden: document.hidden, focused: document.hasFocus(), events: window.__i14BrowserEvents ?? [] };
  });
}

export function differences(before, after, prefix = '') {
  if (Object.is(before, after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [{ path: prefix, before, after }];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => differences(before[key], after[key], prefix ? `${prefix}.${key}` : key));
}

export async function probeI14Lifecycle(page, driver, folder, ordinal, receipt) {
  const result = { method: 'Real Escape, real browser tab activation, reload and menu Continue. Read-only first-complete-frame observer; all runtime differences preserved.',
    strategyBudgetAtReload: { normalSlotUses: 0, searches: 0, routeDecisions: 0 }, status: 'running' };
  receipt.lifecycle = result;
  await driver.press('Escape');
  await page.waitForFunction(() => window.__game.scene.isPaused('RiftScene'));
  const pausedBefore = await readI14FullState(page);
  await page.waitForTimeout(700);
  const pausedAfter = await readI14FullState(page);
  write(folder, `${ordinal}-pause-before.json`, pausedBefore);
  write(folder, `${ordinal}-pause-after.json`, pausedAfter);
  result.pause = { stateDifferences: differences(pausedBefore.checkpoint.state, pausedAfter.checkpoint.state),
    elapsedBefore: pausedBefore.checkpoint.elapsedMs, elapsedAfter: pausedAfter.checkpoint.elapsedMs,
    inventoryEqual: JSON.stringify(pausedBefore.inventory) === JSON.stringify(pausedAfter.inventory),
    rawEqual: pausedBefore.raw === pausedAfter.raw };
  assert.deepEqual(result.pause.stateDifferences, [], 'Paused complete simulation state must not advance');
  assert.equal(result.pause.elapsedBefore, result.pause.elapsedAfter);
  assert(result.pause.inventoryEqual && result.pause.rawEqual);
  await driver.press('Escape');
  await page.waitForFunction(() => window.__game.scene.isActive('RiftScene'));
  const beforeBlur = await readI14FullState(page);
  const alternate = await page.context().newPage();
  try {
    await alternate.goto('about:blank'); await alternate.bringToFront(); await page.waitForTimeout(700);
    const afterBlur = await readI14FullState(page);
    await page.waitForTimeout(700);
    const heldBlur = await readI14FullState(page);
    write(folder, `${ordinal}-focus-before.json`, beforeBlur);
    write(folder, `${ordinal}-focus-after.json`, afterBlur);
    write(folder, `${ordinal}-focus-held.json`, heldBlur);
    const nativeLoss = afterBlur.events.slice(beforeBlur.events.length).filter(event => event.trusted
      && (event.type === 'blur' || (event.type === 'visibilitychange' && event.hidden)));
    result.focus = { nativeEvents: nativeLoss, nativeLossObserved: nativeLoss.length > 0,
      paused: afterBlur.paused, heldStateDifferences: differences(afterBlur.checkpoint.state, heldBlur.checkpoint.state),
      elapsedAfter: afterBlur.checkpoint.elapsedMs, elapsedHeld: heldBlur.checkpoint.elapsedMs,
      limitation: nativeLoss.length ? null : 'This browser mode did not emit native focus loss; no synthetic event is substituted. Real focus gate remains pending.' };
    if (nativeLoss.length) {
      assert(afterBlur.paused, 'Real focus loss must pause the live sortie');
      assert.deepEqual(result.focus.heldStateDifferences, []);
      assert.equal(result.focus.elapsedAfter, result.focus.elapsedHeld);
    }
  } finally { await page.bringToFront(); await alternate.close(); }
  const current = await readI14FullState(page);
  if (!current.paused) await driver.press('Escape');
  await page.waitForFunction(() => window.__game.scene.isPaused('RiftScene'));
  const beforeReload = await readI14FullState(page);
  write(folder, `${ordinal}-cold-before.json`, beforeReload);
  fs.writeFileSync(path.join(folder, `${ordinal}-cold-input.save.json`), beforeReload.raw, { flag: 'wx' });
  result.inputRawSha256 = hash(beforeReload.raw);
  let saved = JSON.parse(beforeReload.raw);
  assert.equal(saved.inventory.run.id, receipt.entrySave.state.inventory.run.id);
  await page.screenshot({ path: path.join(folder, `${ordinal}-before-cold.png`) });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
  const loadedRaw = await page.evaluate(() => localStorage.getItem('coh-save-v1'));
  const loaded = JSON.parse(loadedRaw);
  result.menuCommitDifferences = differences(saved, loaded);
  assert(result.menuCommitDifferences.every(row => ['riftCheckpoint.sequence', 'checkpointChecksum'].includes(row.path)), 'Pagehide may recommit the complete paused state, never change game data');
  assert(loaded.riftCheckpoint.sequence >= saved.riftCheckpoint.sequence);
  await validateI14Envelope(page, loaded);
  saved = loaded;
  result.actualContinueRawSha256 = hash(loadedRaw);
  fs.writeFileSync(path.join(folder, `${ordinal}-cold-menu-input.save.json`), loadedRaw, { flag: 'wx' });
  await armI14EntryObservation(page, 'cold-continue');
  const started = Date.now(); await driver.press('Enter');
  await page.waitForFunction(() => {
    const s = window.__game?.scene.getScene('RiftScene');
    return s?.scene.isActive() && s.nativeWorldPresentation && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive()
      && window.__i14EntryObservation?.firstComplete;
  }, null, { timeout: 45000 });
  result.restoreWallMs = Date.now() - started;
  result.coldObservation = await readI14EntryObservation(page);
  write(folder, `${ordinal}-cold-first-complete.json`, result.coldObservation);
  const observed = await readI14FullState(page);
  write(folder, `${ordinal}-cold-before-first-input.json`, observed);
  const first = result.coldObservation.firstComplete;
  assert.deepEqual(first.checkpoint.identity, saved.riftCheckpoint.identity, 'Continue cannot change frozen grade, world, pressure or reward contract');
  assert.equal(first.checkpoint.runId, saved.inventory.run.id);
  assert.deepEqual(first.inventory, saved.inventory, 'Cold restore cannot replenish gear or alter the inventory ledger');
  assert.deepEqual(first.checkpoint.state.player.position, saved.riftCheckpoint.state.player.position);
  assert(first.checkpoint.elapsedMs >= saved.riftCheckpoint.elapsedMs);
  result.cold = { runId: first.checkpoint.runId, inputSequence: saved.riftCheckpoint.sequence,
    firstSequence: first.checkpoint.sequence, elapsedDeltaMs: first.checkpoint.elapsedMs - saved.riftCheckpoint.elapsedMs,
    stateDifferences: differences(saved.riftCheckpoint.state, first.checkpoint.state),
    observedFrameDeltaMs: observed.checkpoint.elapsedMs - first.checkpoint.elapsedMs,
    invariantIdentityInventoryPosition: true };
  result.status = result.focus.nativeLossObserved ? 'pause-native-focus-cold-invariants-observed-full-differences-for-independent-audit' : 'pause-cold-observed-native-focus-pending';
  await page.screenshot({ path: path.join(folder, `${ordinal}-after-cold.png`) });
  driver.log({ event: 'i14-same-run-lifecycle', ordinal, result });
  write(folder, `${ordinal}-lifecycle.json`, result);
  return result;
}

export async function startI14Capture(page) {
  return page.evaluate(() => {
    const manager = window.__game.sound;
    if (!manager.context || !manager.masterVolumeNode) return { started: false, reason: 'No actual WebAudio master output' };
    const destination = manager.context.createMediaStreamDestination(); manager.masterVolumeNode.connect(destination);
    const videoStream = window.__game.canvas.captureStream(30);
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 1400000 });
    const audioRecorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks = [], audioChunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    audioRecorder.ondataavailable = event => { if (event.data.size) audioChunks.push(event.data); };
    const startedAt = performance.now(), contextState = manager.context.state;
    window.__i14Capture = { recorder, audioRecorder, chunks, audioChunks, destination, source: manager.masterVolumeNode, stream, startedAt };
    recorder.start(250); audioRecorder.start(250);
    return { started: true, startedAt, contextState, audioTracks: stream.getAudioTracks().length,
      method: 'Canvas30fps and unmodified Phaser master output. No gain change, sound injection or clock override.',
      limitations: 'Starts after lifecycle recovery, before first movement. Canvas excludes DOM HUD/dialogs; corresponding full-page screenshots remain. Capture overhead disqualifies this clip as a dedicated performance sample.' };
  });
}

export async function stopI14Capture(page, folder, ordinal) {
  const captured = await page.evaluate(async () => {
    const c = window.__i14Capture; if (!c) return null;
    await Promise.all([c.recorder, c.audioRecorder].map(recorder => new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); })));
    c.source.disconnect(c.destination); for (const track of c.stream.getTracks()) track.stop();
    const bytes = async blob => { const data = new Uint8Array(await blob.arrayBuffer()); let text = '';
      for (let i = 0; i < data.length; i += 8192) text += String.fromCharCode(...data.subarray(i, i + 8192)); return btoa(text); };
    window.__i14Capture = null;
    return { video: await bytes(new Blob(c.chunks, { type: 'video/webm' })), audio: await bytes(new Blob(c.audioChunks, { type: 'audio/webm' })),
      durationWallMs: performance.now() - c.startedAt };
  });
  if (!captured) return null;
  const video = `${ordinal}-natural-canvas.webm`, audio = `${ordinal}-natural-audio.webm`;
  fs.writeFileSync(path.join(folder, video), Buffer.from(captured.video, 'base64'), { flag: 'wx' });
  fs.writeFileSync(path.join(folder, audio), Buffer.from(captured.audio, 'base64'), { flag: 'wx' });
  return { video, audio, durationWallMs: captured.durationWallMs, hearingApproval: false };
}

/** The original first run failed at the pre-Continue envelope assertion. This
 * consumes its exact final current key through the normal menu, with no new run. */
export async function validateI14Envelope(page, saved) {
  const valid = await page.evaluate(async saved => {
    const { validRiftCheckpoint, checkpointChecksum } = await import('/src/types/rift-checkpoint.ts');
    const { checkpointChecksum: sum, ...record } = saved;
    return { envelope: validRiftCheckpoint(saved.riftCheckpoint), checksum: sum === checkpointChecksum(record) };
  }, saved);
  assert(valid.envelope && valid.checksum, 'A formal committed checkpoint and complete checksum are required');
}

export async function resumeI14OriginalRun(page, driver, folder, ordinal, saved) {
  await validateI14Envelope(page, saved);
  const raw = await page.evaluate(() => localStorage.getItem('coh-save-v1'));
  assert.deepEqual(JSON.parse(raw), saved, 'Cold restart menu must load the actual saved source');
  await armI14EntryObservation(page, 'same-run-after-checker-failure');
  const started = Date.now(); await driver.press('Enter');
  await page.waitForFunction(() => {
    const s = window.__game?.scene.getScene('RiftScene');
    return s?.scene.isActive() && s.nativeWorldPresentation && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive()
      && window.__i14EntryObservation?.firstComplete;
  }, null, { timeout: 45000 });
  const observation = await readI14EntryObservation(page), first = observation.firstComplete;
  await validateI14Envelope(page, JSON.parse(first.raw));
  assert.equal(first.checkpoint.runId, saved.inventory.run.id);
  assert.deepEqual(first.checkpoint.identity, saved.riftCheckpoint.identity);
  assert.deepEqual(first.inventory, saved.inventory);
  assert.deepEqual(first.checkpoint.state.player.position, saved.riftCheckpoint.state.player.position);
  assert(first.checkpoint.elapsedMs >= saved.riftCheckpoint.elapsedMs);
  const full = await readI14FullState(page);
  const result = { sourceRawSha256: hash(raw), sourceRunId: saved.inventory.run.id,
    sourceSequence: saved.riftCheckpoint.sequence, sourceElapsedMs: saved.riftCheckpoint.elapsedMs,
    restoreWallMs: Date.now() - started, observation,
    firstSavedRecordDifferences: differences(saved, JSON.parse(first.raw)),
    firstRuntimeDifferences: differences(saved.riftCheckpoint.state, first.checkpoint.state),
    firstRuntimeDeltaMs: first.checkpoint.elapsedMs - saved.riftCheckpoint.elapsedMs,
    beforeInputRuntimeDifferences: differences(first.checkpoint.state, full.checkpoint.state),
    beforeInputRuntimeDeltaMs: full.checkpoint.elapsedMs - first.checkpoint.elapsedMs,
    inheritedExecutionBudget: { searches: 0, normalSlotUses: 0, routeDecisions: 0 },
    limitation: 'Original pause and headless no-native-focus result retained. This is the same departure, not a replacement or another low sample.' };
  write(folder, `${ordinal}-resumed-first-complete.json`, result);
  write(folder, `${ordinal}-resumed-before-input.json`, full);
  fs.writeFileSync(path.join(folder, `${ordinal}-resumed.save.json`), first.raw, { flag: 'wx' });
  driver.log({ event: 'i14-same-run-checker-recovery', ordinal, ...result });
  return result;
}
