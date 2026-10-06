/** Repository review-page QA only. Run after the parent grants the sole-browser window. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const out = path.resolve('docs/qa/artifacts/r100-i07-i09/gallery-browser');
const htmlPath = path.join(root, 'docs/qa/interactive/r100-i07-i09-worlds.html');
const url = `${process.env.GAME_URL ?? 'http://127.0.0.1:3027'}/docs/qa/interactive/r100-i07-i09-worlds.html`;
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report = {
  scope: 'Repository meta-review page interaction, not gameplay or new world-art approval. Existing PNGs are unchanged.',
  url, startedAt: new Date().toISOString(), htmlSha256: hash(htmlPath),
  scriptSha256: hash(new URL(import.meta.url)), checks: [], screenshots: [], pageErrors: [], consoleErrors: [], requestFailures: [], httpErrors: [],
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(7000);
page.on('pageerror', e => report.pageErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
page.on('requestfailed', r => report.requestFailures.push({ url: r.url(), failure: r.failure() }));
page.on('response', r => { if (r.status() >= 400) report.httpErrors.push({ url: r.url(), status: r.status() }); });
async function shot(name) {
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file });
  report.screenshots.push({ path: path.relative(root, file), sha256: hash(file) });
}
async function imageReady() {
  await page.waitForFunction(() => { const p = document.querySelector('#viewer-image'); return !p.hidden && p.complete && p.naturalWidth === 1136 && p.naturalHeight === 758; });
}
async function openWorld(id) {
  await page.locator(`.world-card .image-link[data-world="${id}"]`).click();
  assert(await page.locator('#viewer').evaluate(d => d.open));
  assert.equal(await page.locator('#viewer-id').textContent(), id);
  await imageReady();
}
try {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('.world-card').count(), 32);
  assert.equal(await page.locator('.neighbor').count(), 4);
  assert.equal(await page.locator('.comparison img').count(), 8);
  await page.waitForFunction(() => [...document.querySelectorAll('.comparison img')].slice(0, 2).every(i => i.complete && i.naturalWidth === 1136));
  report.checks.push('32 world cards and 4 comparison pairs render with actual PNGs');
  await shot('01-neighbors');
  for (const stage of ['I07', 'I08']) {
    await page.locator(`[data-filter="${stage}"]`).click();
    assert.equal(await page.locator('.world-card:visible').count(), 16);
  }
  await page.locator('[data-filter="all"]').click();
  assert.equal(await page.locator('.world-card:visible').count(), 32);
  await page.locator('#search').fill('sentinel');
  assert.equal(await page.locator('.world-card:visible').count(), 1);
  await page.locator('#search').fill('no-such-world-qa');
  assert.equal(await page.locator('.world-card:visible').count(), 0);
  assert(await page.locator('#empty').isVisible());
  await page.locator('#search').fill('');
  report.checks.push('I07/I08 filters, name/ID search, zero-match and reset');
  await page.locator('#worlds').scrollIntoViewIfNeeded();
  await shot('02-catalog');
  await openWorld('rib-vault');
  for (const grade of ['low', 'medium', 'severe']) {
    await page.locator(`[data-frame-choice="${grade}"]`).click();
    await imageReady();
    assert((await page.locator('#viewer-image').getAttribute('src')).endsWith(`rib-vault-${grade}-walk.png`));
    assert.equal(await page.locator(`[data-frame-choice="${grade}"]`).getAttribute('aria-pressed'), 'true');
  }
  await shot('03-three-grade-dialog');
  await page.locator('#native-size').click();
  assert.equal(await page.locator('#native-size').getAttribute('aria-pressed'), 'true');
  await page.locator('#native-size').click();
  await page.locator('#next-world').click();
  await imageReady();
  assert.equal(await page.locator('#viewer-id').textContent(), 'pleated-hide');
  await page.locator('#prev-world').click();
  await imageReady();
  assert.equal(await page.locator('#viewer-id').textContent(), 'rib-vault');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#viewer').evaluate(d => d.open), false);
  report.checks.push('Modal opens, three grade PNGs load, native-size toggle, previous/next and Escape work');
  await openWorld('sentinel-mass');
  assert((await page.locator('#viewer-image').getAttribute('src')).includes('b07-identity-followup'));
  await shot('04-repaired-sentinel');
  await page.locator('[data-frame-choice="low"]').click();
  await imageReady();
  assert((await page.locator('#frame-info').textContent()).includes('修前档案'));
  assert((await page.locator('#source-manifest').getAttribute('href')).includes('b07-refined-source'));
  assert((await page.locator('[data-frame-choice="low"]').textContent()).includes('修前'));
  await page.locator('.close').click();
  await openWorld('tendon-shelves');
  assert((await page.locator('#viewer-image').getAttribute('src')).includes('tendon-foot-refined'));
  await page.locator('[data-frame-choice="medium"]').click();
  await imageReady();
  assert((await page.locator('#frame-info').textContent()).includes('修前档案'));
  await page.locator('.close').click();
  report.checks.push('Sentinel and tendon repaired deep frames remain distinct from explicitly historical normal-grade views');
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.requestFailures, []);
  assert.deepEqual(report.httpErrors, []);
  assert.equal(hash(htmlPath), report.htmlSha256, 'Page source changed during QA');
  report.status = 'passed-repository-page-interaction';
} catch (e) {
  report.status = 'failed'; report.failure = String(e); report.stack = e?.stack;
  await shot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  report.browserClosed = true; report.endedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.pageErrors.length + report.consoleErrors.length, browserClosed: true }));
}
