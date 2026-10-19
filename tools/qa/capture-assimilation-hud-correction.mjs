/** One isolated real departure: secondary assimilation HUD and three body facts. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.COH_PLAYWRIGHT_MODULE ?? path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output = path.resolve('docs/qa/artifacts/assimilation-hud-correction-2026-10-19');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.COH_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1264, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = { date: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: await browser.version(), scope: 'One fresh isolated real production departure, controlled assimilation 30% and six read-only CSV-derived item projections (no domain inventory mutation). No player storage, broad balance, other-world or historical-save migration validation.', errors: [], checks: [], screenshots: [] };
page.on('pageerror', error => report.errors.push(error.message));
function check(name, condition, detail) { report.checks.push({ name, pass: condition, detail }); assert(condition, name); }
async function picture(name) {
  await page.waitForTimeout(180);
  const clip = await page.locator('#game-container canvas').boundingBox();
  await page.screenshot({ clip, path: path.join(output, `${name}.png`) });
  report.screenshots.push(`${name}.png`);
}
try {
  await page.goto(process.env.COH_QA_BASE_URL ?? 'http://127.0.0.1:3027');
  await page.getByRole('button', { name: '开始', exact: true }).waitFor({ timeout: 30000 });
  await page.evaluate(async () => {
    async function loaded(file) { return import(performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname === file).at(-1)?.name ?? file); }
    const { audioManager } = await loaded('/src/managers/audio-manager.ts');
    const { gameState } = await loaded('/src/managers/game-state.ts');
    const { inventoryPanel } = await loaded('/src/ui/dom/inventory-panel.ts');
    const { projectInventoryItem } = await loaded('/src/ui/inventory-presenter.ts');
    const { CONTAMINANT_DATA } = await loaded('/src/generated/contaminant-data.ts');
    window.__hudCorrection = { game: audioManager.game, gameState, inventoryPanel, projectInventoryItem, CONTAMINANT_DATA };
  });
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.waitForFunction(() => { const s = window.__hudCorrection.game.scene.getScene('PurificationScene'); return s?.scene.isActive() && s.player && !s.menuEntry && !s.interactionFocusReturn; }, null, { timeout: 30000 });
  await page.evaluate(() => window.__hudCorrection.game.scene.getScene('PurificationScene').enterRift());
  await page.locator('[data-departure-grade="low"]').click();
  await page.getByRole('button', { name: '整理行装', exact: true }).click();
  await page.locator('[data-prepare-action="depart"]').click();
  await page.waitForFunction(() => { const s = window.__hudCorrection.game.scene.getScene('RiftScene'); return s?.scene.isActive() && s.chaos && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive() && !s.entryView?.active; }, null, { timeout: 90000 });
  report.world = await page.evaluate(() => window.__hudCorrection.game.scene.getScene('RiftScene').recovery?.identity?.generation?.package?.id);
  check('zero assimilation remains visible', await page.locator('#rift-hud-assimilation').isVisible() && await page.locator('.rift-assimilation-value').textContent() === '0.0%');
  await page.evaluate(() => window.__hudCorrection.gameState.setAssimilation(30));
  await page.waitForFunction(() => document.querySelector('.rift-assimilation-value')?.textContent === '30.0%');
  check('scene commit refreshes secondary readout', await page.locator('.rift-assimilation-value').textContent() === '30.0%');
  const hud = await page.locator('#rift-hud').innerText();
  check('HUD has no mechanic explanation or impact claim', !/跨趟保留|污染已满|冲击增幅/.test(hud), hud);
  check('assimilation is separate from primary bars', !(await page.locator('#rift-hud-status,#rift-hud-chaos').allTextContents()).join(' ').includes('同化'));
  await picture('hud-assimilation-secondary');
  await page.locator('#rift-hud-help summary').click();
  const layout = await page.evaluate(() => {
    const a = document.querySelector('#rift-hud-assimilation').getBoundingClientRect(), h = document.querySelector('#rift-hud-help').getBoundingClientRect(), e = document.querySelector('#rift-hud-burden').getBoundingClientRect();
    return { separate: a.left > h.right && a.top > e.bottom, assimilation: a.toJSON(), help: h.toJSON(), entry: e.toJSON() };
  });
  check('expanded help and entry remain separate', layout.separate, layout);
  await picture('hud-help-expanded');
  await page.locator('#rift-hud-help summary').click();
  await page.locator('#rift-hud-burden').click();
  check('body query hides underlying secondary HUD', !(await page.locator('#rift-hud-assimilation').isVisible()));
  const body = await page.locator('.inventory-physiology').innerText();
  check('body exposes three facts and no impact claim', await page.locator('.inventory-physiology-fact').count() === 3 && !body.includes('冲击'), body);
  await page.evaluate(() => {
    const q = window.__hudCorrection;
    const items = Object.values(q.CONTAMINANT_DATA).filter(d => d.active).slice(0, 6).map((d, i) => {
      const id = `QA_HUD_CORRECTION_${i}`;
      return q.projectInventoryItem({ id, kind: 'contaminant', location: { kind: 'carried' }, contaminant: { id, type: d.id, rarity: d.rarity, stage: 'tool', impactCharges: 0, usesRemaining: d.toolUses } }, 'rift');
    });
    const snapshot = q.inventoryPanel.options.getSnapshot();
    q.inventoryPanel.update({ ...snapshot, items, weight: items.reduce((sum, item) => sum + item.weight, 0) });
  });
  report.bodyLayout = await page.locator('#inventory-panel').evaluate(panel => {
    const list = panel.querySelector('.inventory-list[data-lane="main"]'), footer = panel.querySelector('.inventory-bottom'), rect = panel.getBoundingClientRect();
    const row = list.querySelector('.inventory-item').getBoundingClientRect();
    return { listHeight: list.clientHeight, rowHeight: row.height / (rect.width / 598), rows: list.children.length, footerInside: footer.getBoundingClientRect().bottom <= rect.bottom + 1 };
  });
  check('six item list retains three full rows and fixed actions', report.bodyLayout.rows === 6 && report.bodyLayout.listHeight >= report.bodyLayout.rowHeight * 3 && report.bodyLayout.footerInside, report.bodyLayout);
  await picture('body-three-facts');
  await page.keyboard.press('Tab');
  check('Tab closes and restores secondary HUD', await page.locator('#inventory-panel').count() === 0 && await page.locator('#rift-hud-assimilation').isVisible());
  check('no page errors', report.errors.length === 0, report.errors);
  report.pass = true;
} catch (error) { report.pass = false; report.failure = error.stack; process.exitCode = 1; }
finally { await fs.writeFile(path.join(output, 'browser-check.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
