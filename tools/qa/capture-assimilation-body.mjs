/** Bounded, real-scene evidence for the body/posture art-study revision. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = path.resolve('docs/qa/artifacts/assimilation-body-2026-10-20');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = [], cards = [];
const angles = [['front', '正向', 0], ['side', '侧向', Math.PI / 2], ['back', '背向', Math.PI]];
const sources = [['base', '原角色', 0, .5, true], ['shape', '仅看形体', 1, .5, false],
  ['fibre', '晶纤 100%', 1, 1, true], ['film', '破膜 100%', 1, 0, true], ['mixed', '混合 100%', 1, .5, true]];
try {
  for (const [world, title] of [['crystal-fibre', '晶化林床'], ['ruptured-film', '破膜盆地'], ['haven', '净化点']]) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 1100 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      window.__writes = [];
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { window.__writes.push(key); return original.call(this, key, value); };
    });
    await page.goto(`http://127.0.0.1:3027/docs/art/previews/assimilation-appearance-study/?world=${world}&amount=1&fibre=.5`);
    await page.waitForFunction(() => window.__assimilationStudy?.snapshot().ready, null, { timeout: 90000 });
    await page.waitForTimeout(1000);
    const row = { world, title, errors, frames: [], performance: [] };
    for (const [angle, label, yaw] of angles) {
      await page.evaluate(yaw => { window.__assimilationStudy.pause(false); window.__assimilationStudy.face(yaw); }, yaw);
      await page.waitForTimeout(180);
      await page.evaluate(() => window.__assimilationStudy.pause(true));
      for (const [key, name, amount, fibre, material] of sources) {
        await page.evaluate(({ amount, fibre, material }) => {
          const api = window.__assimilationStudy;
          api.material(material); api.set(amount, fibre, true);
        }, { amount, fibre, material });
        await page.waitForFunction(() => window.__assimilationStudy.snapshot().modelSettled, null, { timeout: 20000 });
        await page.evaluate(() => window.__assimilationStudy.captureDetail());
        await page.waitForTimeout(100);
        const data = await page.locator('#detail').evaluate(canvas => canvas.toDataURL('image/png'));
        const filename = `${world}-${angle}-${key}.png`;
        await fs.writeFile(path.join(out, filename), Buffer.from(data.split(',')[1], 'base64'));
        row.frames.push({ angle, key, snapshot: await page.evaluate(() => window.__assimilationStudy.snapshot()) });
        cards.push({ world, title, label, name, filename, angle, key });
        if (key === 'mixed' && angle === 'side')
          await page.locator('#game-container').screenshot({ path: path.join(out, `${world}-scene.png`) });
      }
    }
    // Actual motion and low-A recovery. Samples are full-scene timing, not GPU timing.
    await page.evaluate(() => {
      const api = window.__assimilationStudy; api.material(true); api.inspector(false); api.pause(false);
    });
    for (const baseline of [true, false]) {
      await page.evaluate(baseline => { const api = window.__assimilationStudy; api.baseline(baseline); api.clearSamples(); }, baseline);
      await page.waitForTimeout(1800);
      row.performance.push({ baseline, snapshot: await page.evaluate(() => window.__assimilationStudy.snapshot()) });
    }
    const before = await page.evaluate(() => window.__assimilationStudy.snapshot());
    await page.locator('#game-container').focus(); await page.keyboard.down('KeyD');
    await page.waitForTimeout(700); await page.keyboard.up('KeyD'); await page.waitForTimeout(650);
    const after = await page.evaluate(() => window.__assimilationStudy.snapshot());
    row.movement = { before: before.player, after: after.player, model: after.modelMetrics };
    assert(Math.hypot(after.player.x - before.player.x, after.player.y - before.player.y) > .5, `${world}: actual movement`);
    assert(after.modelMetrics.applied > before.modelMetrics.applied, `${world}: geometry updates while walking/settling`);
    assert(after.modelMetrics.cacheBytes <= 16 * 64 * 80 * 16, 'bounded frame cache');
    await page.evaluate(() => { window.__assimilationStudy.pause(true); window.__assimilationStudy.set(0, .5, true); });
    await page.waitForTimeout(100);
    row.healed = await page.evaluate(() => window.__assimilationStudy.snapshot());
    assert.equal(row.healed.state.amount, 0);
    assert.equal(row.healed.modelSettled, true);
    row.storageWrites = await page.evaluate(() => window.__writes);
    assert.equal(row.storageWrites.length, 0, 'no persistent storage writes');
    assert.equal(errors.length, 0, `${world}: browser errors`);
    report.push(row);
    console.log(JSON.stringify({ world, frames: row.frames.length, errors, writes: row.storageWrites, performance: row.performance.map(p => ({
      baseline: p.baseline, frameP50: p.snapshot.frameP50, frameP95: p.snapshot.frameP95, cpuP95: p.snapshot.cpuP95, model: p.snapshot.modelMetrics,
    })) }));
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
const groups = ['crystal-fibre', 'ruptured-film', 'haven'].map(world => {
  const entries = cards.filter(card => card.world === world), title = entries[0].title;
  return `<section><h2>${title}</h2><img class="scene" src="${world}-scene.png" alt="${title}正常游戏尺度">` +
    angles.map(([angle, label]) => `<h3>${label} · 同场景、同朝向、同一动作时刻</h3><div class="row">` +
      entries.filter(card => card.angle === angle).map(card => `<figure><figcaption>${card.name}</figcaption><img src="${card.filename}" alt="${card.name} ${label}"></figure>`).join('') + '</div>').join('') + '</section>';
}).join('');
await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>同化形体 · 实景对照</title>
<style>body{background:#0d1314;color:#bec8bd;font:15px/1.6 system-ui;margin:30px auto;max-width:1280px}h1,h2{color:#dde2d4}a{color:#b6c8a9}.row{display:flex;gap:10px}figure{margin:0;background:#111a1b;padding:5px}figcaption{text-align:center}img{image-rendering:pixelated}.scene{width:960px;max-width:100%}section{border-top:1px solid #35403c;margin-top:35px}p{max-width:1000px}</style>
<h1>同化形体 · 实景对照</h1><p>第一版人审50/100后的返工。原角色／只有真实形体／单源／混合以同场、同角度对照。3×来自实际游戏画面，不加检视灯；上方大图为960×640实际尺度。</p>
<p>胸背前屈、头前探、肩差、实体脊与厚膜；满同化覆盖以整个角色可见面计算。肩灯位置随身体变化，场景依真实灯位重新受光。尚为独立美术打版，攻击、坐姿及正式来源存档不在此次范围。</p>
<p><a href="/docs/art/previews/assimilation-appearance-study/?amount=1&fibre=.5">打开动态打版</a> · <a href="report.json">限定运行与性能记录</a></p>
<h2>连续实录</h2><video src="body-transition.webm" controls loop muted style="width:960px;image-rendering:pixelated"></video>
<p>实景录制：同化加深 → 晶纤 → 破膜 → 混合 → 疗愈。由 check-assimilation-body-motion.mjs 生成。</p>${groups}</html>`);
