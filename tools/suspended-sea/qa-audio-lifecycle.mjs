import assert from 'node:assert/strict';
import { SeaQaDriver } from './qa-driver.mjs';
const qa = new SeaQaDriver({ scene: 'sea-open-channel', seed: 7, loadout: 'bare', testCase: 'audio-lifecycle' });
let failure;
try {
  await qa.open(); await qa.recordAudio(); await qa.start();
  await qa.page.waitForTimeout(6500);
  const before = await qa.page.evaluate(() => window.__qaSeaAudioRead());
  assert(before.voices.some(v => v.key === 'amb-suspended-sea-pressure'));
  assert(!before.voices.some(v => v.key === 'amb-rift-alien-atmosphere'));
  await qa.press('Escape'); await qa.until(s => s.paused, 'pause');
  const paused = await qa.page.evaluate(() => window.__qaSeaAudioRead());
  assert(paused.paused && paused.voices.every(v => v.paused));
  await qa.press('Escape'); await qa.until(s => !s.paused, 'resume');
  await qa.page.locator('#abort').click(); await qa.until(s => !s.running, 'abort');
  const immediate = await qa.page.evaluate(() => window.__qaSeaAudioRead());
  assert(!immediate.voices.some(v => v.instanceId.startsWith('suspended-sea-water:')));
  await qa.page.waitForTimeout(500);
  const afterTail = await qa.page.evaluate(() => window.__qaSeaAudioRead());
  assert(!afterTail.voices.some(v => v.key.includes('suspended-sea')), 'Native ambient gone after the specified 350ms shutdown fade');
  qa.evidence.observations.push({ label: 'real-audio-pause-and-shutdown', before, paused, immediate, after500ms: afterTail });
  qa.evidence.checks.push('Ambient replaced rather than doubled; all voices paused; local instances stopped immediately; native ambient removed after 350ms configured shutdown fade.');
} catch (error) { failure = error; console.error(error); }
const evidence = await qa.finish(failure);
if (!evidence.passed) process.exitCode = 1;
