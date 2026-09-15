/** Actual-input driver for iteration23. Read-only probes observe, never steer simulation. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, access, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

async function sources() {
  const names = [...execFileSync('rg', ['--files', 'src', 'data', 'tools/living-landmass', 'assets/audio', 'public/assets/audio'], { encoding: 'utf8' })
    .trim().split('\n').filter(name => name && (!/^(assets|public)\//.test(name) || name.includes('living-landmass'))),
  'living-landmass.html', 'package.json', 'vite.config.ts'].sort();
  const files = await Promise.all(names.map(async file => {
    const bytes = await readFile(file);
    return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  return { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), files };
}

export class LandmassQaDriver {
  held = new Set();
  constructor(options = {}) {
    this.options = { scene: 'living-borne-fin', seed: 7, loadout: 'bare', testCase: 'route', ...options };
    this.runId = options.runId ?? new Date().toISOString().replace(/[:.]/g, '-');
    this.dir = path.resolve(process.env.ARTIFACT_DIR ?? 'docs/qa/artifacts/iteration-23',
      `${this.options.scene}-${this.options.loadout}-${this.options.seed}-${this.options.testCase}-${this.runId}`);
    this.evidence = { schema: 1, ...this.options, runId: this.runId,
      method: 'Isolated empty Chrome context; real keyboard/mouse and normal simulation clock. Read-only production probes. No teleport, protection, state edits, refill or time override. Failed attempts retained.',
      inputs: [], checks: [], moves: [], observations: [], errors: [], consoleErrors: [], resourcesFailed: [],
      artVerdict: 'UNREVIEWED: normal frames and audio require separate review.' };
  }

  async open() {
    await mkdir(this.dir, { recursive: true });
    await assert.rejects(access(path.join(this.dir, 'evidence.json')), 'Never overwrite a previous attempt');
    this.evidence.sourceBefore = await sources();
    await writeFile(path.join(this.dir, 'source-start.json'), JSON.stringify(this.evidence.sourceBefore, null, 2));
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
    this.browser = await chromium.launch({ headless: true,
      executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    this.context = await this.browser.newContext({ viewport: { width: 1440, height: 960 },
      recordVideo: { dir: this.dir, size: { width: 1440, height: 960 } } });
    assert.deepEqual(await this.context.storageState(), { cookies: [], origins: [] });
    this.page = await this.context.newPage();
    this.page.on('pageerror', error => this.evidence.errors.push(error.message));
    this.page.on('console', message => {
      if (message.type() === 'error') this.evidence.consoleErrors.push({ text: message.text(), location: message.location() });
    });
    this.page.on('response', response => {
      if (response.status() >= 400) this.evidence.resourcesFailed.push({ url: response.url(), status: response.status() });
    });
    const { scene, seed, loadout } = this.options;
    const url = new URL('/living-landmass.html', process.env.GAME_URL ?? 'http://127.0.0.1:3007');
    for (const [key, value] of Object.entries({ scene, seed, loadout, autostart: 0 })) url.searchParams.set(key, String(value));
    this.evidence.url = url.href;
    const navigationStarted = Date.now();
    await this.page.goto(url.href);
    await this.page.waitForFunction(() => window.__livingLandmass?.getState().ready, null, { timeout: 30000 });
    this.evidence.readyWallMs = Date.now() - navigationStarted;
    this.sentinel = `i23-${this.runId}`;
    await this.page.evaluate(value => {
      if (localStorage.getItem('coh-save-v1') !== null) throw Error('Refuse to overwrite an existing SAVE');
      localStorage.setItem('coh-save-v1', value);
    }, this.sentinel);
    await this.installSampler();
    return this;
  }

  async start({ waitForControl = true } = {}) {
    const startClicked = Date.now();
    this.evidence.inputs.push({ kind: 'click', selector: '#start', at: Date.now() });
    await this.page.locator('#start').click();
    await this.until(s => s.running && s.snapshot, 'scene CREATE', 15000);
    await this.focus();
    if (waitForControl) await this.until(s => s.snapshot.elapsedMs > 100, 'entry hands over control', 6000);
    (this.evidence.starts ??= []).push({ at: startClicked, waitedForControl: waitForControl, wallMs: Date.now() - startClicked });
    await this.assertSave('start');
  }

  async focus() { await this.page.locator('#game-container').click({ position: { x: 18, y: 18 } }); }
  async release() {
    for (const key of this.held) {
      await this.page.keyboard.up(key);
      this.evidence.inputs.push({ kind: 'up', key, at: Date.now() });
    }
    this.held.clear();
  }
  async press(key, ms = 80) {
    this.held.add(key); this.evidence.inputs.push({ kind: 'down', key, at: Date.now(), requestedMs: ms });
    await this.page.keyboard.down(key);
    try { await this.page.waitForTimeout(ms); }
    finally {
      await this.page.keyboard.up(key); this.held.delete(key);
      this.evidence.inputs.push({ kind: 'up', key, at: Date.now() });
    }
  }
  async read() {
    const state = await this.page.evaluate(() => {
      const lab = window.__livingLandmass, game = lab.game, scene = game.scene.getScene('RiftScene');
      const running = game.scene.isActive('RiftScene') || game.scene.isPaused('RiftScene');
      return { running, paused: game.scene.isPaused('RiftScene'),
        snapshot: running ? scene.probeBuildLabState() : null,
        frame: running ? scene.probePresentationFrame() : null,
        spatial: running ? lab.getState().spatial : null,
        error: document.querySelector('#error')?.textContent ?? '' };
    });
    assert(!state.error, `Application error: ${state.error}`);
    return state;
  }
  async fullState() { return this.page.evaluate(() => window.__livingLandmass.getState()); }
  async until(predicate, label, timeout = 12000, step = 60) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const state = await this.read();
      if (predicate(state)) return state;
      await this.page.waitForTimeout(step);
    }
    throw Error(`Timeout: ${label}; ${JSON.stringify(await this.read())}`);
  }

  async move(axis, target, timeout = 35000) {
    const start = Date.now(); let pulses = 0, stalled = 0, previous;
    while (Date.now() - start < timeout) {
      assert.equal(this.held.size, 0, 'Movement keys released before reading probes');
      const state = await this.read();
      assert(state.running && !state.paused && !state.snapshot.ended, 'Walking requires a live scene');
      const current = state.snapshot.player[axis], diff = target - current;
      if (Math.abs(diff) <= 4) {
        this.evidence.moves.push({ axis, target, actual: current, elapsedMs: state.snapshot.elapsedMs, pulses }); return;
      }
      stalled = previous !== undefined && Math.abs(current - previous) < .2 ? stalled + 1 : 0;
      assert(stalled < 20, `Physical movement blocked: ${axis}=${target}, current ${current}`);
      previous = current;
      await this.press(axis === 'x' ? diff > 0 ? 'd' : 'a' : diff > 0 ? 's' : 'w',
        Math.max(24, Math.min(180, Math.abs(diff) * 3)));
      pulses++;
    }
    throw Error(`Walking did not converge: ${axis}=${target}; ${JSON.stringify((await this.read()).snapshot)}`);
  }
  async waypoint(x, y, order = 'xy') { for (const axis of order) await this.move(axis, axis === 'x' ? x : y); }

  async capture(label) {
    await this.release();
    const state = await this.fullState(), frame = (await this.read()).frame;
    this.evidence.observations.push({ label, state, frame });
    await this.page.screenshot({ path: path.join(this.dir, `${label}.png`) });
    console.log(`${this.options.testCase}/${this.options.loadout}: ${label}`);
    return { state, frame };
  }
  async assertSave(label) {
    assert.equal(await this.page.evaluate(() => localStorage.getItem('coh-save-v1')), this.sentinel);
    this.evidence.checks.push(`Formal SAVE unchanged: ${label}`);
  }
  async items() {
    const state = await this.fullState();
    return state.inventory.items.map(item => ({ id: item.id, kind: item.kind,
      type: item.kind === 'contaminant' ? item.contaminant.type : item.weapon.definitionId,
      uses: item.kind === 'contaminant' ? item.contaminant.usesRemaining : item.weapon.usesRemaining,
      location: item.location, source: item.source }));
  }
  async search(label) {
    const before = (await this.read()).snapshot.search.remaining;
    await this.press('e', 1550);
    await this.until(s => s.snapshot.search.remaining < before, `real reveal ${label}`, 3500);
    return this.capture(label);
  }
  async strikeEnemy(id) {
    for (let n = 0; n < 20; n++) {
      const state = await this.read(), enemy = state.snapshot.enemies.find(e => e.id === id);
      if (!enemy) return;
      assert(!state.snapshot.ended, 'Encounter ended the run');
      const dx = enemy.position.x - state.snapshot.player.x, dy = enemy.position.y - state.snapshot.player.y;
      const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'd' : 'a' : dy > 0 ? 's' : 'w';
      await this.press(direction, Math.hypot(dx, dy) > 65 ? 180 : 110);
      await this.press('Space', 90); await this.page.waitForTimeout(480);
    }
    assert(!(await this.read()).snapshot.enemies.some(e => e.id === id), `Enemy ${id} survived the actual-input encounter`);
  }

  async installSampler() {
    await this.page.evaluate(async () => {
      const { audioManager } = await import('/src/managers/audio-manager.ts');
      window.__qaLandmassAudioRead = () => audioManager.getState();
    });
    await this.page.evaluate(() => {
      window.__qaLandmass = { samples: [], frameTimes: [], sampleErrors: [], events: [], lastEvent: 0 };
      let previous, previousRuntime, runIndex = 0;
      const loop = now => {
        if (previous !== undefined && window.__qaLandmass.frameTimes.length < 72000) window.__qaLandmass.frameTimes.push(now - previous);
        previous = now; requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      setInterval(() => {
        try {
          const lab = window.__livingLandmass, scene = lab?.game.scene.getScene('RiftScene');
          if (!scene || !lab.game.scene.isActive('RiftScene')) return;
          const frame = scene.probePresentationFrame();
          if (!frame || window.__qaLandmass.samples.length >= 16000) return;
          const runtime = scene.devRuntime, world = runtime?.world;
          if (runtime !== previousRuntime) {
            previousRuntime = runtime; runIndex++; window.__qaLandmass.lastEvent = 0;
          }
          const body = frame.player.body, epsilon = .01;
          const physical = world ? [[body.x+epsilon,body.y+epsilon],[body.x+body.width-epsilon,body.y+epsilon],
            [body.x+epsilon,body.y+body.height-epsilon],[body.x+body.width-epsilon,body.y+body.height-epsilon]]
            .map(([x,y]) => world.isFloor(x,y)) : null;
          // Only copy observed state. No method that changes gameplay is called.
          window.__qaLandmass.samples.push({ ...structuredClone(frame), physical, runIndex,
            tension: world?.readTensionView ? structuredClone(world.readTensionView()) : null,
            supportHeight: world ? world.groundHeightAt(frame.player.position.x,frame.player.position.y) : null,
            audio: window.__qaLandmassAudioRead() });
          for (const event of frame.events) if (event.sequence > window.__qaLandmass.lastEvent) {
            window.__qaLandmass.events.push({ ...structuredClone(event), runIndex }); window.__qaLandmass.lastEvent = event.sequence;
          }
        } catch (error) { window.__qaLandmass.sampleErrors.push(String(error)); }
      }, 70);
    });
  }

  /** Tap only this game's existing output bus; no microphone or other app audio. */
  async recordAudio() {
    await this.page.evaluate(() => {
      const manager = window.__livingLandmass.game.sound;
      if (!manager.context || !manager.masterVolumeNode) throw Error('Game has no capturable WebAudio output');
      const destination = manager.context.createMediaStreamDestination();
      manager.masterVolumeNode.connect(destination);
      const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      window.__qaLandmassAudio = { recorder, destination, source: manager.masterVolumeNode, chunks };
      recorder.start(250);
    });
  }

  async saveAudio() {
    const encoded = await this.page.evaluate(async () => {
      const capture = window.__qaLandmassAudio;
      if (!capture) return null;
      await new Promise(resolve => { capture.recorder.onstop = resolve; capture.recorder.stop(); });
      capture.source.disconnect(capture.destination);
      const bytes = new Uint8Array(await new Blob(capture.chunks, { type: 'audio/webm' }).arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    });
    if (encoded) {
      await writeFile(path.join(this.dir, 'actual-game-audio.webm'), Buffer.from(encoded, 'base64'));
      this.evidence.audioCapture = 'Existing Phaser masterVolumeNode output, actual run, no microphone or synthesized offline timeline.';
    }
  }

  async finish(error = null) {
    this.evidence.passed = !error;
    if (error) this.evidence.failure = String(error.stack ?? error);
    if (!this.page) {
      this.evidence.failure ??= 'Browser/page did not initialize'; this.evidence.passed = false;
      await writeFile(path.join(this.dir, 'evidence.json'), JSON.stringify(this.evidence, null, 2));
      await this.browser?.close(); return this.evidence;
    }
    await this.release().catch(() => {});
    await this.saveAudio().catch(e => { this.evidence.audioCaptureFailure = String(e); });
    const trace = await this.page.evaluate(() => window.__qaLandmass).catch(() => null);
    this.evidence.records = await this.page.evaluate(() => window.__livingLandmass.getRecords()).catch(e => ({ error: String(e) }));
    this.evidence.finalState = await this.fullState().catch(e => ({ error: String(e) }));
    await this.assertSave('end').catch(e => { this.evidence.passed = false; this.evidence.failure = String(e); });
    this.evidence.sourceAfter = await sources();
    const after = new Map(this.evidence.sourceAfter.files.map(f => [f.file, f.sha256]));
    const beforeNames = new Set(this.evidence.sourceBefore.files.map(f => f.file));
    this.evidence.codeChangedDuringRun = [
      ...this.evidence.sourceBefore.files.filter(f => after.get(f.file) !== f.sha256).map(f => f.file),
      ...this.evidence.sourceAfter.files.filter(f => !beforeNames.has(f.file)).map(f => f.file),
    ];
    if (this.evidence.codeChangedDuringRun.length) {
      this.evidence.passed = false; this.evidence.failure = `${this.evidence.failure ?? ''}\nSource changed during run.`;
    }
    if (trace) {
      await writeFile(path.join(this.dir, 'trace.json'), JSON.stringify(trace));
      const frames = trace.frameTimes.slice().sort((a,b) => a-b);
      this.evidence.performance = { count: frames.length, medianMs: frames[Math.floor(frames.length*.5)],
        p95Ms: frames[Math.floor(frames.length*.95)], maxMs: frames.at(-1), over50ms: frames.filter(v => v > 50).length,
        scope: 'This host, headless Chrome and video only; not release performance certification.' };
      this.evidence.traceSummary = { samples: trace.samples.length, sampleErrors: trace.sampleErrors,
        illegalBodySamples: trace.samples.filter(s => s.physical?.some(valid => !valid)).length,
        knotHits: Math.max(0, ...trace.samples.map(s => s.tension?.hitSequence ?? 0)),
        tensionPhases: [...new Set(trace.samples.map(s=>s.tension?.phase))],
        snaredSamples: trace.samples.filter(s => s.enemies.some(e => e.restraint?.snared)).length,
        pressureSamples: trace.samples.filter(s => s.enemies.some(e => e.restraint?.pressure)).length,
        lureSamples: trace.samples.filter(s => s.enemies.some(e => e.targetingLure)).length,
        siphonSamples: trace.samples.filter(s => s.tools.siphonRemainingMs > 0).length,
        muffleSamples: trace.samples.filter(s => s.tools.muffleEpisodeActive).length };
      this.evidence.audioSummary = {
        maxActualVoices: Math.max(0, ...trace.samples.map(s => s.audio?.playingCount ?? 0)),
        keys: [...new Set(trace.samples.flatMap(s => s.audio?.voices.map(v => v.key) ?? []))],
      };
      if (trace.sampleErrors.length || this.evidence.traceSummary.illegalBodySamples) this.evidence.passed = false;
    }
    if (this.evidence.errors.length || this.evidence.resourcesFailed.some(r => !new URL(r.url).pathname.endsWith('/favicon.ico'))
      || this.evidence.consoleErrors.some(e => /Shader Error|shader is not compiled|VALIDATE_STATUS false|CONTEXT_LOST_WEBGL/.test(e.text))) this.evidence.passed = false;
    await this.page.screenshot({ path: path.join(this.dir, '99-final.png') }).catch(() => {});
    await writeFile(path.join(this.dir, 'evidence.json'), JSON.stringify(this.evidence, null, 2));
    const video = this.page.video();
    await this.context.close();
    if (video) await rename(await video.path(), path.join(this.dir, 'continuous.webm'));
    await this.browser.close();
    console.log(JSON.stringify({ directory: this.dir, passed: this.evidence.passed, failure: this.evidence.failure,
      trace: this.evidence.traceSummary, performance: this.evidence.performance }));
    return this.evidence;
  }
}
