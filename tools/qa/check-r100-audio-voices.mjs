/** Deliberate real-WebAudio saturation and ownership fixture; not natural play. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03-i06/audio-mix/voices-final');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e)));
try {
  await page.goto((process.env.GAME_URL ?? 'http://127.0.0.1:3083') + '/');
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  const result = await page.evaluate(async () => {
    const { audioManager: a } = await import('/src/managers/audio-manager.ts');
    a.unlock(); await a.game.sound.context.resume();
    const samples = [], checks = [];
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const mark = label => {
      const sample = { label, ...a.getState(), ids: a.voices.map(v => ({ id: v.id, key: v.key, instanceId: v.instanceId })) };
      samples.push(sample); return sample;
    };
    const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });
    const clear = () => { a.resumeAll(); a.stopBGM(0); a.haltNonBgm(0); };
    clear();
    for (let i = 0; i < 8; i++) a.playSFX('sfx-rift-enemy-idle', { loop: true, instanceId: 'qa-fill-' + i, priority: 'low', volume: .03 });
    mark('eight-existing-low-voices');
    a.playBGM('bgm-rift-base-drone', 0); mark('base-added');
    a.playAmbient('amb-rift-alien-atmosphere', 0); mark('ambient-requested');
    for (const layer of ['tension', 'threat', 'proximity']) { a.setLayerVolume(layer, .3, 0); mark(layer + '-requested'); }
    a.playSFX('sfx-rift-enemy-alert');
    check('critical enemy cue admitted over saturated low loops', mark('alert-admitted').voices.some(v => v.key === 'sfx-rift-enemy-alert'));
    a.playSFX('sfx-shared-player-hurt');
    check('hurt cue admitted over saturated low loops', mark('hurt-admitted').voices.some(v => v.key === 'sfx-shared-player-hurt'));
    for (let i = 0; i < 12; i++) a.playSFX('sfx-ui-warning');
    const ui = mark('twelve-same-frame-ui-cues');
    check('current base retained under UI flood', ui.voices.some(v => v.key === 'bgm-rift-base-drone'));
    a.playSFX('sfx-rift-enemy-alert');
    const rejected = mark('game-cue-after-ui-flood');
    check('playing UI ids survive subsequent request', ui.ids.filter(v => v.key === 'sfx-ui-warning').every(v => rejected.ids.some(n => n.id === v.id)));
    a.pauseAll(); const paused = mark('paused'); await wait(180); const held = mark('pause-held');
    check('paused voices and ownership stable', JSON.stringify(paused.ids) === JSON.stringify(held.ids) && held.voices.every(v => v.paused));
    a.resumeAll(); const resumed = mark('resumed');
    check('resume does not duplicate voices', JSON.stringify(held.ids) === JSON.stringify(resumed.ids));
    clear(); mark('first-disposed');

    // A bed-only mix must yield its low layers to a critical cue, and a yielded
    // ambient request must return after the cue, rather than disappear forever.
    a.playBGM('bgm-rift-base-drone', 0);
    a.playAmbient('amb-rift-alien-atmosphere', 0);
    for (const layer of ['tension', 'threat', 'proximity']) a.setLayerVolume(layer, .3, 0);
    for (let i = 0; i < 3; i++) a.playSFX('sfx-rift-enemy-idle', { loop: true, instanceId: 'qa-bed-fill-' + i, priority: 'low', volume: .03 });
    mark('full-bed-and-enemy-mix');
    a.playSFX('sfx-shared-player-hurt'); const yielded = mark('ambient-yields-to-hurt');
    check('ambient yields, base and hurt remain', !yielded.voices.some(v => v.key === 'amb-rift-alien-atmosphere') && yielded.voices.some(v => v.key === 'bgm-rift-base-drone') && yielded.voices.some(v => v.key === 'sfx-shared-player-hurt'));
    for (let i = 0; i < 3; i++) a.stopInstance('qa-bed-fill-' + i, 0);
    await wait(120); const restored = mark('ambient-restored');
    check('ambient returns once with request ownership', restored.voices.filter(v => v.key === 'amb-rift-alien-atmosphere').length === 1);
    clear();

    // Looping UI here deliberately holds protected slots, making the missing
    // BGM case reproducible independently of clip duration / machine timing.
    for (let i = 0; i < 8; i++) a.playSFX('sfx-ui-warning', { loop: true, instanceId: 'qa-protected-ui-' + i });
    a.playBGM('bgm-rift-base-drone', 0); const deferred = mark('base-deferred-by-eight-ui');
    check('base request does not overbook or interrupt UI', deferred.playingCount === 8 && deferred.voices.every(v => v.key === 'sfx-ui-warning'));
    a.pauseAll();
    for (let i = 0; i < 8; i++) a.stopInstance('qa-protected-ui-' + i, 0);
    await wait(120); check('pending base not created during pause', mark('pending-held-during-pause').playingCount === 0);
    a.resumeAll(); await wait(120);
    check('pending base starts once after resume', mark('pending-base-resumed').voices.filter(v => v.key === 'bgm-rift-base-drone').length === 1);
    clear();
    for (let i = 0; i < 8; i++) a.playSFX('sfx-ui-warning', { loop: true, instanceId: 'qa-cancel-ui-' + i });
    a.playBGM('bgm-rift-base-drone', 0); a.playAmbient('amb-rift-alien-atmosphere', 0);
    a.stopBGM(0); a.stopAmbient('amb-rift-alien-atmosphere', 0);
    for (let i = 0; i < 8; i++) a.stopInstance('qa-cancel-ui-' + i, 0);
    await wait(150);
    check('explicit stop cancels unadmitted base and ambient', mark('cancelled-targets-stay-silent').playingCount === 0);
    clear(); await wait(100); const last = mark('disposed');
    return { samples, checks, maximum: Math.max(...samples.map(s => s.playingCount)), last };
  });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ method: 'QA deliberately saturates the actual AudioManager with decoded WebAudio voices. No fake sound implementation. Looping UI is an explicit test fixture; it is not a claim about ordinary play.', url: page.url(), ...result, errors }, null, 2));
  console.log(JSON.stringify({ maximum: result.maximum, checks: result.checks, states: result.samples.map(s => [s.label, s.playingCount]) }));
  assert.deepEqual(errors, []);
  assert(result.maximum <= 8, 'all entry paths share eight-voice cap');
  assert.equal(result.last.playingCount, 0);
  for (const check of result.checks) assert(check.passed, check.name);
} finally { await browser.close(); }
