/** Actual GPU regression: projected self visibility never erases unrelated fog. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.COH_PLAYWRIGHT_MODULE || '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.COH_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1264, height: 1000 } });
  await page.goto(`${process.env.COH_REVIEW_BASE_URL || 'http://127.0.0.1:3027'}/r100-gym.html?world=cinder-ridge&grade=medium&seed=92&playerModel=a`);
  await page.waitForFunction(() => window.__r100Gym?.getState().runtime.running, null, { timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const s = audioManager.game.scene.getScene('RiftScene'), a = s.lastLightPlayerPresentation, v = s.visibility;
    s.scene.pause();
    const read = () => new Promise(resolve => v.mask.texture.snapshot(image => {
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      resolve(context.getImageData(0, 0, canvas.width, canvas.height));
    }));
    const rebuild = () => { v.update(s.player.getPosition(), s.player.getFacingAngle(), 0); s.devRuntime.afterUpdate(s.devElapsedMs); };
    rebuild(); const before = await read(); a.revealBody(v); const after = await read();
    const ox = a.image.x - 32 - v.maskOriginX, oy = a.image.y - 66 - v.maskOriginY;
    let changed = 0, outsideOpaque = 0;
    for (let y = 0; y < before.height; y++) for (let x = 0; x < before.width; x++) {
      const index = (y * before.width + x) * 4;
      if (before.data[index + 3] === after.data[index + 3]) continue;
      changed++;
      const lx = Math.floor(x + .5 - ox), ly = Math.floor(y + .5 - oy);
      // One raster-pixel allowance at fractional world coordinates, never a disc.
      let covered = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = lx + dx, yy = ly + dy;
        if (xx >= 0 && yy >= 0 && xx < 64 && yy < 80 && a.output.data[(yy * 64 + xx) * 4 + 3]) covered = true;
      }
      if (!covered) outsideOpaque++;
    }
    const originalMask = a.image.mask, geometry = s.add.graphics(), testMask = geometry.createGeometryMask();
    const sampleClip = async (halfVisible) => {
      geometry.clear();
      if (halfVisible) geometry.fillStyle(0xffffff).fillRect(a.image.x - 32, a.image.y - 80, 32, 100);
      rebuild(); const start = await read();
      a.image.setMask(testMask); a.revealBody(v); const end = await read();
      let pixels = 0, blockedSideLeaks = 0;
      for (let y = 0; y < start.height; y++) for (let x = 0; x < start.width; x++) {
        const index = (y * start.width + x) * 4;
        if (start.data[index + 3] !== end.data[index + 3]) { pixels++; if (x > a.image.x - v.maskOriginX + 1) blockedSideLeaks++; }
      }
      a.image.setMask(originalMask);
      return { pixels, blockedSideLeaks, restoredMaskPosition: [geometry.x, geometry.y] };
    };
    const half = await sampleClip(true), blocked = await sampleClip(false);
    testMask.destroy(); geometry.destroy(); rebuild(); a.revealBody(v);
    return { changed, outsideOpaque, half, blocked, contactStillMasked: !!a.contact.mask, bodyDepth: a.image.depth, fogDepth: v.mask.depth };
  });
  assert(result.changed > 100); assert.equal(result.outsideOpaque, 0);
  assert(result.half.pixels > 50); assert.equal(result.half.blockedSideLeaks, 0);
  assert.equal(result.blocked.pixels, 0); assert.deepEqual(result.half.restoredMaskPosition, [0, 0]);
  assert.deepEqual(result.blocked.restoredMaskPosition, [0, 0]); assert(result.contactStillMasked);
  assert(result.bodyDepth < result.fogDepth, 'Do not raise the body into HUD/overlay bands');
  const receipt = { pass: true, browser: await browser.version(), world: 'cinder-ridge', seed: 92, ...result };
  if (process.env.COH_FOG_PROOF_OUTPUT) await fs.writeFile(process.env.COH_FOG_PROOF_OUTPUT, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} finally { await browser.close(); }
