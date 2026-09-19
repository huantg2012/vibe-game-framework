/** Browser-only pixel/canvas contracts plus production body-echo integration. Isolated save. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const base = (process.env.GAME_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
async function load(query) {
  await page.goto(`${base}/combat-lab.html?auto-reset=0&${query}`);
  await page.waitForFunction(() => window.__combatLab?.getState().ready);
  await page.locator('#game-container canvas').click();
  await page.evaluate(() => {
    window.echoScene = window.__combatLab.game.scene.getScene('CombatLabScene');
    window.echoKeys = () => Object.keys(window.echoScene.textures.list).filter(key => key.startsWith('tool-body-'));
    window.pixelDigest = key => {
      const canvas = window.echoScene.textures.get(key).getSourceImage();
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261, count = 0, maxAlpha = 0;
      for (let i = 0; i < pixels.length; i++) hash = Math.imul(hash ^ pixels[i], 16777619);
      for (let i = 3; i < pixels.length; i += 4) { if (pixels[i]) count++; maxAlpha = Math.max(maxAlpha, pixels[i]); }
      return { hash: hash >>> 0, count, maxAlpha, width: canvas.width, height: canvas.height };
    };
  });
}
try {
  await page.addInitScript(() => localStorage.setItem('coh-save-v1', 'body-echo-review-sentinel'));
  await load('exercise=empty');
  const unit = await page.evaluate(async () => {
    const s = window.echoScene; s.scene.pause();
    const { captureBodyEcho, restoreBodyEcho } = await import('/src/systems/tool-body-echo.ts');
    const before = window.echoKeys();
    const texture = s.textures.createCanvas('qa-trimmed-source', 80, 48);
    const ctx = texture.context;
    ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 80, 48); // Must never leak from the rest of the atlas.
    ctx.clearRect(40, 8, 20, 26);
    ctx.fillStyle = 'rgba(80,140,130,0.25)'; ctx.fillRect(40, 8, 20, 26);
    ctx.clearRect(40, 8, 4, 5); ctx.clearRect(56, 25, 4, 9); // An asymmetric transparent silhouette.
    texture.refresh();
    texture.add('selected-pose', 0, 40, 8, 20, 26).setTrim(40, 42, 6, 7, 20, 26);
    const source = { textureKey: 'qa-trimmed-source', frame: 'selected-pose', originX: .25, originY: .75, scaleX: 1.25, scaleY: .75 };
    const echo = captureBodyEcho(s, source, 'mirror');
    if (!echo) throw new Error('real trimmed frame did not capture');
    const keys = window.echoKeys().filter(key => !before.includes(key));
    const images = s.children.list.filter(child => keys.includes(child.texture?.key));
    const digests = keys.map(window.pixelDigest);
    const support = document.createElement('canvas'); support.width = 40; support.height = 42;
    const expectedCtx = support.getContext('2d');
    expectedCtx.drawImage(texture.getSourceImage(), 40, 8, 20, 26, 6, 7, 20, 26);
    const expected = expectedCtx.getImageData(0, 0, 40, 42).data;
    let outside = 0, alphaAmplified = 0;
    for (const key of keys) {
      const pixels = s.textures.get(key).context.getImageData(0, 0, 40, 42).data;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] && !expected[i]) outside++;
        if (pixels[i] > expected[i]) alphaAmplified++;
      }
    }
    let bakes = 0;
    for (const key of keys) {
      const t = s.textures.get(key), put = t.context.putImageData.bind(t.context), refresh = t.refresh.bind(t);
      t.context.putImageData = (...args) => { bakes++; return put(...args); };
      t.refresh = (...args) => { bakes++; return refresh(...args); };
    }
    ctx.clearRect(0, 0, 80, 48); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 80, 48); texture.refresh();
    // A later live source lookup is a hard failure, not merely an identical resulting picture.
    Object.defineProperty(source, 'textureKey', { get() { throw new Error('live source read after capture'); } });
    for (let i = 0; i < 100; i++) echo.update({ x: 200.4, y: 300.4 }, i / 150, 29);
    const unchanged = JSON.stringify(keys.map(window.pixelDigest)) === JSON.stringify(digests);
    const savedPose = JSON.parse(JSON.stringify(echo.exportRuntimeState()));
    const beforeRestore = window.echoKeys();
    const restored = restoreBodyEcho(s, savedPose);
    if (!restored) throw new Error('saved pose did not restore');
    restored.update({ x: 200.4, y: 300.4 }, .5, 29);
    const restoredKeys = window.echoKeys().filter(key => !beforeRestore.includes(key));
    const restoredEqual = JSON.stringify(restoredKeys.map(window.pixelDigest)) === JSON.stringify(digests);
    restored.destroy();
    const transforms = images.map(image => ({ originX: image.originX, originY: image.originY, scaleX: image.scaleX,
      scaleY: image.scaleY, alpha: image.alpha, x: image.x, y: image.y }));
    const childrenBeforeDestroy = s.children.list.length;
    echo.destroy(); echo.destroy(); echo.update({ x: 0, y: 0 }, 0, 0);
    const cleared = keys.every(key => !s.textures.exists(key));
    const removedImages = childrenBeforeDestroy - s.children.list.length;
    const noSource = captureBodyEcho(s, { textureKey: 'missing-body-fixture', originX: .5, originY: .5 }, 'memory');
    s.textures.remove('qa-trimmed-source');
    return { digests, outside, alphaAmplified, unchanged, restoredEqual, bakes, transforms, cleared, removedImages,
      keyCountAfter: window.echoKeys().length, baselineCount: before.length, noSource };
  });
  assert.equal(unit.digests.length, 3);
  assert(unit.digests.every(layer => layer.count > 0 && layer.width === 40 && layer.height === 42 && layer.maxAlpha <= 64), JSON.stringify(unit));
  assert.equal(unit.outside, 0, 'named cut frame and trim offset must preserve source support');
  assert.equal(unit.alphaAmplified, 0);
  assert(unit.unchanged, 'mutating the atlas cannot change a previously captured pose');
  assert(unit.restoredEqual, 'JSON restoration uses immutable original pixels after the atlas changed');
  assert.equal(unit.bakes, 0, 'update must not rasterize or refresh textures');
  assert(unit.transforms.every(layer => layer.originX === .25 && layer.originY === .75 && layer.scaleX === 1.25 && layer.scaleY === .75 && layer.alpha <= .72));
  assert.equal(unit.transforms[0].x, 200, 'foot layer stays fixed');
  assert(unit.transforms.every(layer => layer.y === 300));
  assert(unit.cleared); assert.equal(unit.removedImages, 3); assert.equal(unit.keyCountAfter, unit.baselineCount); assert.equal(unit.noSource, null);
  console.log('PASS explicit atlas frame/cut/trim, original origin/scale/alpha, immutable pose, zero update bakes, idempotent cleanup');

  await load('exercise=empty&tool-q=mirror');
  await page.keyboard.press('q', { delay: 60 });
  const mirror = await page.evaluate(() => {
    const s = window.echoScene; s.scene.pause();
    const keys = window.echoKeys(), layers = keys.map(window.pixelDigest);
    const hasEcho = !!s.tools.mirrorDecoys[0]?.echo;
    s.tools.update(8100);
    return { hasEcho, layers, remainingKeys: window.echoKeys(), decoys: s.ai.visualDecoys.size };
  });
  assert(mirror.hasEcho); assert.equal(mirror.layers.length, 3); assert(mirror.layers.every(layer => layer.count > 0));
  assert.deepEqual(mirror.remainingKeys, []); assert.equal(mirror.decoys, 0);
  console.log('PASS real Q mirror captures three nonempty body layers and expiry clears both pictures and AI decoy');

  await load('exercise=duel&tool-q=solidify');
  await page.locator('#approach').click();
  await page.evaluate(() => {
    const s = window.echoScene, capture = s.tools.captureEnemyVisual;
    s.tools.captureEnemyVisual = id => {
      const source = capture(id), frame = s.textures.getFrame(source.textureKey, source.frame);
      const canvas = document.createElement('canvas'); canvas.width = frame.realWidth; canvas.height = frame.realHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, frame.x, frame.y, frame.cutWidth, frame.cutHeight);
      window.frozenSource = { width: canvas.width, height: canvas.height, pixels: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
      return source;
    };
  });
  await page.keyboard.press('q', { delay: 60 });
  const freeze = await page.evaluate(() => {
    const s = window.echoScene; s.scene.pause();
    const target = s.ai.getEnemies()[0], keys = window.echoKeys(), source = window.frozenSource;
    let outside = 0, visiblePixels = 0, sourcePixels = 0;
    if (!source) return { captured: false };
    for (let i = 3; i < source.pixels.length; i += 4) if (source.pixels[i]) sourcePixels++;
    for (const key of keys) {
      const t = s.textures.get(key), pixels = t.context.getImageData(0, 0, source.width, source.height).data;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) { visiblePixels++; if (!source.pixels[i]) outside++; }
    }
    const active = !!s.tools.freezeEffects[0]?.echo && s.ai.getEnemyControlState(target.getId()).attackSuppressed;
    const hpBefore = s.combat.getEnemyHealth(target.getId());
    s.combat.applyToolDamage(target.getId(), 1); s.tools.update(16);
    return { captured: true, active, outside, visiblePixels, sourcePixels, count: keys.length,
      damage: hpBefore - s.combat.getEnemyHealth(target.getId()),
      released: !s.ai.getEnemyControlState(target.getId()).attackSuppressed,
      cleared: keys.every(key => !s.textures.exists(key)) };
  });
  assert(freeze.captured && freeze.active && freeze.released && freeze.cleared, JSON.stringify(freeze));
  assert.equal(freeze.count, 3); assert.equal(freeze.outside, 0); assert.equal(freeze.damage, 1);
  assert(freeze.visiblePixels > 0 && freeze.visiblePixels < freeze.sourcePixels, JSON.stringify(freeze));
  console.log('PASS real Q freeze traces the actual body support, real positive damage releases control and destroys its echo');

  await load('exercise=duel&tool-passive=retrograde');
  // Deliberately controlled visibility isolates old-pose ownership, not natural chase detection (tested separately).
  const memory = await page.evaluate(() => {
    const s = window.echoScene; s.scene.pause();
    const enemy = s.ai.getEnemies()[0];
    s.tools.isTargetVisible = () => true; s.tools.hasTargetLineOfSight = () => true;
    s.tools.beginTrackingEpisode(enemy.getId()); s.tools.update(100);
    const visibleKeys = window.echoKeys(), before = visibleKeys.map(window.pixelDigest);
    const lastSeen = { ...enemy.getPosition() };
    let forbiddenReads = 0;
    s.tools.isTargetVisible = () => false;
    s.tools.captureEnemyVisual = () => { forbiddenReads++; throw new Error('hidden target live visual read'); };
    s.tools.update(16);
    const mark = s.tools.retrogradeMarks[0];
    if (!mark) return { created: false };
    enemy.getSprite().body.reset(lastSeen.x + 90, lastSeen.y + 90); enemy.syncPositionFromBody();
    s.tools.update(1000);
    const unchanged = JSON.stringify(visibleKeys.map(window.pixelDigest)) === JSON.stringify(before);
    const position = { ...mark.position }, activeCount = window.echoKeys().length;
    s.tools.update(6000);
    return { created: !!mark.echo, lastSeen, position, forbiddenReads, unchanged, activeCount,
      nonempty: before.map(layer => layer.count), cleaned: visibleKeys.every(key => !s.textures.exists(key)) };
  });
  assert(memory.created && memory.unchanged && memory.cleaned, JSON.stringify(memory));
  assert.equal(memory.forbiddenReads, 0); assert.equal(memory.activeCount, 3);
  assert(memory.nonempty.some(count => count > 0)); assert.deepEqual(memory.position, memory.lastSeen);
  console.log('PASS controlled sight-loss memory keeps its captured body and position, never rereads the hidden source, cleans at expiry');
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), 'body-echo-review-sentinel');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
