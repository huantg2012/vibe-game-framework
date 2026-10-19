/** One isolated production departure; controlled readout samples, not natural inventory progression. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.COH_PLAYWRIGHT_MODULE ?? path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output = path.resolve('docs/qa/artifacts/rift-pressure-hud-2026-10-19');
const sourceFiles = ['src/ui/dom/rift-hud.ts', 'src/ui/dom/panel-styles.ts', 'src/ui/dom/rift-pressure-readout.ts'];
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.COH_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = {
  date: '2026-10-19', startedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  features: ['COH-F032', 'COH-F054'], browser: await browser.version(), sourcesBefore: await hashes(),
  scope: 'Isolated Chrome profile: title → new record → Haven → preparation → one real low-grade Rift. Freeze the engine on one camera frame, then set the real game-state assimilation and production HUD burden readout to three controlled pairs (30/160 + A0, 140/160 + A60, 160/160 + A100). This does not represent naturally acquired weight or assimilation. Resume for real click/Tab inventory interaction. No player profile/storage, natural expedition/economy, legacy save migration, other worlds, full combat or human aesthetic acceptance.',
  errors: [], checks: [], samples: [], screenshots: [],
};
page.on('pageerror', error => report.errors.push(error.message));
function check(name, condition, detail) {
  report.checks.push({ name, pass: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
  assert(condition, name);
}
async function shot(file, selector = '#game-container canvas') {
  const clip = await page.locator(selector).boundingBox();
  await page.screenshot({ clip, path: path.join(output, file) });
  report.screenshots.push(file);
}
async function sample() {
  return page.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, width: r.width, height: r.height }; };
    const stack = document.querySelector('#rift-hud-resource-stack');
    return {
      assimilation: window.__pressureQA.gameState.getAssimilation(),
      body: document.querySelector('#rift-hud').innerText,
      root: document.querySelector('#dom-ui-root').contains(stack),
      icons: stack.querySelectorAll('img,svg').length,
      rows: [...stack.children].map(row => {
        const label = row.querySelector('span:first-child');
        const value = row.querySelector('.rift-pixel-value');
        const canvas = value.querySelector('canvas');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set(); let partialAlpha = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3]) colors.add('#' + [...pixels.slice(i, i + 3)].map(v => v.toString(16).padStart(2, '0')).join(''));
          if (pixels[i + 3] && pixels[i + 3] !== 255) partialAlpha++;
        }
        return { id: row.id, label: label.textContent, value: value.textContent, row: rect(row), labelBox: rect(label), canvas: rect(canvas), colors: [...colors], partialAlpha, smoothing: canvas.getContext('2d').imageSmoothingEnabled, imageRendering: getComputedStyle(canvas).imageRendering };
      }),
    };
  });
}

try {
  await page.goto(process.env.COH_QA_BASE_URL ?? 'http://127.0.0.1:3027');
  await page.getByRole('button', { name: '开始', exact: true }).waitFor({ timeout: 30000 });
  report.modules = await page.evaluate(async () => {
    const modules = {};
    async function loaded(file) { const url = performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname === file).at(-1)?.name ?? file; modules[file] = url; return import(url); }
    const { audioManager } = await loaded('/src/managers/audio-manager.ts');
    const { gameState } = await loaded('/src/managers/game-state.ts');
    window.__pressureQA = { game: audioManager.game, gameState };
    return modules;
  });
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.waitForFunction(() => { const s = window.__pressureQA.game.scene.getScene('PurificationScene'); return s?.scene.isActive() && s.player && !s.menuEntry && !s.interactionFocusReturn; }, null, { timeout: 30000 });
  await page.evaluate(() => window.__pressureQA.game.scene.getScene('PurificationScene').enterRift());
  await page.locator('[data-departure-grade="low"]').click();
  await page.getByRole('button', { name: '整理行装', exact: true }).click();
  await page.locator('[data-prepare-action="depart"]').click();
  await page.waitForFunction(() => { const s = window.__pressureQA.game.scene.getScene('RiftScene'); return s?.scene.isActive() && s.chaos && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive() && !s.entryView?.active; }, null, { timeout: 90000 });
  report.entry = await page.evaluate(() => {
    const q = window.__pressureQA, s = q.game.scene.getScene('RiftScene');
    q.game.loop.sleep();
    return { world: s.recovery?.identity?.generation?.package?.id, protocol: s.chaos.exportRuntimeState().assimilationMode, position: s.player.getPosition(), assimilation: q.gameState.getAssimilation() };
  });
  check('real preparation entered persistent Rift protocol at A0', report.entry.protocol === 'persistent-v1' && report.entry.assimilation === 0, report.entry);
  for (const [index, weight, assimilation, expectedBurden, expectedAssimilation] of [
    [0, 30, 0, '#b3baae', '#b3baae'],
    [1, 140, 60, '#bb756b', '#9aa588'],
    [2, 160, 100, '#bd685e', '#8c9973'],
  ]) {
    await page.evaluate(({ weight, assimilation }) => {
      const q = window.__pressureQA, s = q.game.scene.getScene('RiftScene');
      q.gameState.setAssimilation(assimilation);
      s.hud.setBurden(weight, 160);
      s.hud.refreshAssimilation();
    }, { weight, assimilation });
    const result = await sample();
    report.samples.push({ index, weight, assimilation, result });
    const [kindling, burden, body] = result.rows;
    check(`sample ${index}: three labels and exact values`, result.rows.map(r => r.label).join('|') === '薪柴|负重|同化' && burden.value === `${(weight / 10).toFixed(1)} / 16.0` && body.value === `${assimilation.toFixed(1)}%`, result.rows.map(({ label, value }) => ({ label, value })));
    check(`sample ${index}: approved numeric colors`, kindling.colors.includes('#b89040') && burden.colors.includes(expectedBurden) && burden.colors.includes('#8a8f96') && body.colors.length === 1 && body.colors[0] === expectedAssimilation, result.rows.map(({ colors }) => colors));
    check(`sample ${index}: equal 18px row pitch and shared left/right edges`, Math.abs(burden.row.y - kindling.row.y - 18) < .01 && Math.abs(body.row.y - burden.row.y - 18) < .01 && result.rows.every(r => r.labelBox.x === kindling.labelBox.x && r.canvas.right === kindling.canvas.right), result.rows.map(({ row, labelBox, canvas }) => ({ row, labelBox, canvas })));
    check(`sample ${index}: hard pixels inside overlay without icon or mechanism copy`, result.root && result.icons === 0 && result.rows.every(r => r.partialAlpha === 0 && !r.smoothing && r.imageRendering === 'pixelated') && !/跨趟保留|污染已满|冲击增幅|Tab/.test(result.rows.map(r => r.label + r.value).join(' ')));
    await shot(`scene-${index}.png`);
  }
  await page.evaluate(() => window.__pressureQA.game.loop.wake());
  await page.locator('#rift-hud-burden').click();
  await page.locator('#inventory-panel').waitFor({ timeout: 5000 });
  check('click burden opens live inventory', await page.locator('#inventory-panel').getAttribute('aria-label') === '随身' && !(await page.evaluate(() => window.__pressureQA.game.scene.getScene('RiftScene').scene.isPaused())));
  await shot('inventory-click.png');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  check('Tab closes inventory and restores secondary HUD', await page.locator('#inventory-panel').count() === 0 && await page.locator('#rift-hud-assimilation').isVisible());
  await page.keyboard.press('Tab');
  await page.locator('#inventory-panel').waitFor({ timeout: 5000 });
  check('Tab opens inventory', await page.locator('#inventory-panel').count() === 1);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  check('second Tab closes without pausing', await page.locator('#inventory-panel').count() === 0 && !(await page.evaluate(() => window.__pressureQA.game.scene.getScene('RiftScene').scene.isPaused())));
  report.sourcesAfter = await hashes();
  check('production sources unchanged during verification', JSON.stringify(report.sourcesBefore) === JSON.stringify(report.sourcesAfter));
  check('no runtime page errors', report.errors.length === 0, report.errors);
  report.result = 'pass';
} catch (error) {
  report.result = 'fail'; report.failure = error.stack; process.exitCode = 1;
  try { await shot('failure.png'); } catch {}
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>右上角 HUD · 正式接入</title><style>body{background:#0b1010;color:#b3baae;font:16px system-ui;max-width:1000px;margin:32px auto}img{max-width:100%;image-rendering:pixelated}figure{margin:32px 0}a{color:#bac4a6}li{margin:8px 0}</style><h1>右上角 HUD · 正式接入</h1><p>${escape(report.result)} · ${escape(report.revision)}</p><p>真实新建记录经备行进入低污染 Rift，同一镜头冻结后受控设值：轻载／未同化、临满／60%、满载／100%。截图使用正式 HUD，非自然累积过程。之后恢复循环验证负重点击与 Tab。未触碰玩家存档。</p><p><a href="report.json">执行记录与源码指纹</a></p><ul>${report.checks.map(c => `<li>${c.pass ? '通过' : '失败'} — ${escape(c.name)}</li>`).join('')}</ul>${report.screenshots.map(file => `<figure><figcaption>${escape(file)}</figcaption><a href="${file}"><img src="${file}" loading="lazy"></a></figure>`).join('')}`);
}
console.log(JSON.stringify({ result: report.result, output, checks: report.checks.length, failure: report.failure }, null, 2));
