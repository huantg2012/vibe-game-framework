/** Bounded real-input picture/audio run. Does not substitute for full-route QA. */
import assert from 'node:assert/strict';
import { SeaQaDriver } from './qa-driver.mjs';

const qa = new SeaQaDriver({ scene: 'sea-open-channel', seed: 7, loadout: 'bare', testCase: 'visual-audio' });
async function waitShell(predicate, label, timeout = 16000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const shell = (await qa.fullState()).spatial.shell;
    if (predicate(shell)) return shell;
    await qa.page.waitForTimeout(25);
  }
  throw Error(`Timeout waiting for real shell phase: ${label}`);
}
let failure;
try {
  await qa.open(); await qa.recordAudio(); await qa.start({ waitForControl: false });
  await qa.capture('00-entry-building');
  await qa.until(s => s.snapshot.elapsedMs > 100, 'full handover');
  await qa.capture('01-entry-finished');
  await qa.waypoint(304, 944); await qa.waypoint(464, 944); await qa.waypoint(464, 480);
  await qa.move('x', 768); await qa.press('d', 24); await qa.capture('02-observation');
  // Watch a full natural cycle before approaching the real lip.
  await qa.page.waitForTimeout(10500); await qa.capture('03-natural-water');
  await qa.waypoint(790, 477); await qa.press('d', 24);
  await waitShell(s => s.canHit && s.coreActive && s.cycleTimeMs < 7200, 'early contact');
  const before = await qa.fullState();
  assert(before.spatial.shell.canHit && before.spatial.shell.coreActive, 'A real flowing window must exist');
  await qa.capture('04-before-strike');
  const durability = (await qa.read()).frame.player.durability;
  await qa.press('Space', 135);
  const hitDeadline = Date.now() + 1500;
  while (Date.now() < hitDeadline && (await qa.fullState()).spatial.shell.hitSequence === 0) await qa.page.waitForTimeout(20);
  assert.equal((await qa.fullState()).spatial.shell.hitSequence, 1, 'Actual crowbar contact, not a test mutation');
  assert.equal((await qa.read()).frame.player.durability, durability - 1);
  await qa.capture('05-actual-shell-hit');
  await waitShell(s => s.hitAtMs !== null && s.elapsedMs - s.hitAtMs >= 280, 'middle of actual water tail');
  const mid = await qa.capture('05b-residual-water-middle');
  assert(mid.state.spatial.shell.spillActive && mid.state.spatial.shell.mode === 'diverting',
    'Residual water picture must be taken during real diversion, not an already safe state');
  await waitShell(s => s.hitAtMs !== null && s.elapsedMs - s.hitAtMs >= 650, 'side water drained');
  const diverted = await qa.fullState();
  assert(diverted.spatial.shell.coreActive, 'Vertical core still dangerous after diversion');
  assert(!diverted.spatial.shell.spillActive, 'Old sidewater has actually drained');
  await qa.capture('06-core-continues-side-diverted');
  await waitShell(s => s.mode === 'returning' && s.returnProgress >= .25 && s.returnProgress < .7,
    'middle of actual return');
  const returning = await qa.capture('07a-actual-return-middle');
  assert.equal(returning.state.spatial.shell.mode, 'returning');
  await waitShell(s => s.mode === 'closed', 'natural return finished');
  await qa.capture('07b-water-finished-return');
  await qa.press('Escape'); await qa.until(s => s.paused, 'normal pause');
  const paused = await qa.fullState(); await qa.page.waitForTimeout(400);
  assert.deepEqual((await qa.fullState()).spatial.shell, paused.spatial.shell);
  await qa.capture('08-pause'); await qa.press('Escape'); await qa.until(s => !s.paused, 'normal resume');
  await qa.page.locator('#abort').click();
  await qa.until(s => !s.running, 'normal stop');
  // Ambient shutdown intentionally fades for 350ms. The local near-water
  // instances stop immediately; the bed must be gone after that bounded tail.
  await qa.page.waitForTimeout(500);
  const audio = await qa.page.evaluate(() => window.__qaSeaAudioRead());
  assert(!audio.voices.some(v => v.key.includes('suspended-sea')), 'Native loops and one-shots stop on leaving');
  qa.evidence.checks.push('Actual shell contact spent exactly one durability; sidewater ceased after tail, vertical core remained; pause froze state; leaving cleared native sound instances.');
  qa.evidence.performanceContext = process.env.PERFORMANCE_CONTEXT ?? 'One QA browser; includes asset startup. Finite-device diagnostic, not release performance certification.';
} catch (error) { failure = error; console.error(error); }
const evidence = await qa.finish(failure);
if (!evidence.passed) process.exitCode = 1;
