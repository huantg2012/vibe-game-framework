/** Exercise the built root entry in an isolated browser, never the user's save.
 * OPENING_PRODUCTION_URL defaults to the local vite preview on 3028. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const url = process.env.OPENING_PRODUCTION_URL ?? 'http://127.0.0.1:3028/';
const out = 'docs/qa/artifacts/opening-production';
const key = 'coh-save-v1', checks = [], errors = [], requests = [], failures = [];
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceFingerprints = Object.fromEntries(['src/scenes/main-menu-scene.ts', 'src/main.ts', 'src/scenes/boot-scene.ts', 'src/scenes/last-light-visual.ts', 'src/art/title-motion.ts', 'src/art/title-exterior.ts', 'src/ui/dom/main-menu.css', 'public/assets/last-light/checksums.json'].map(file => [file, hash(readFileSync(file))]));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
let page;
const make = async (record, unavailable = false) => {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await context.route('**/__opening-qa', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  const p = await context.newPage();
  p.on('pageerror', error => errors.push(String(error)));
  p.on('request', request => requests.push(request.url()));
  p.on('response', response => { if (response.status() >= 400) failures.push([response.status(), response.url()]); });
  await p.goto(new URL('/__opening-qa', url).href);
  if (record !== undefined) await p.evaluate(([k, value]) => localStorage.setItem(k, value), [key, record]);
  if (unavailable) await context.addInitScript(k => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(name) { if (name === k) throw new DOMException('QA unavailable', 'SecurityError'); return get.call(this, name); };
  }, key);
  await p.goto(url);
  await p.locator('.joint-action:enabled').first().waitFor({ timeout: 60000 });
  return p;
};
const saved = p => p.evaluate(k => localStorage.getItem(k), key);
const haven = async p => {
  await p.locator('#purif-hud').waitFor({ timeout: 30000 });
  await p.locator('#menu-entry-transition').waitFor({ state: 'detached', timeout: 30000 });
  assert.equal(await p.locator('.joint-title').count(), 0);
  assert.equal(await p.locator('.joint-title-motion').count(), 0);
  assert.equal(await p.locator('canvas[data-last-light-exterior-motion="joint-depth"]').count(), 1);
};
try {
  page = await make();
  assert.equal(new URL(await page.locator('.joint-art').getAttribute('src'), url).pathname, '/assets/art/menu-refuge-f.png');
  assert.equal(await page.locator('.joint-title-motion').count(), 1);
  assert.equal(await page.locator('.joint-controls').count(), 0);
  checks.push('built root loads F, one motion canvas and no DEV controls');
  await page.screenshot({ path: `${out}/production-title.png` });

  await page.locator('.joint-action').first().focus();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => document.querySelector('#pause-overlay')?.style.display === 'flex');
  const frozen = await page.locator('.joint-title-motion').getAttribute('data-motion-time');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.joint-title-motion').getAttribute('data-motion-time'), frozen);
  await page.keyboard.down('Enter');
  for (let i = 0; i < 8; i++) await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#pause-overlay').evaluate(e => e.style.display), 'none');
  assert.equal(await page.locator('.joint-title').count(), 1);
  assert.equal(await page.locator('#menu-entry-transition').count(), 0);
  checks.push('dispatched blur freezes title; focused-button Enter plus native repeats only resumes');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => {
    const c = document.querySelector('.joint-title-motion');
    return !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v !== 0);
  }, null, { timeout: 5000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  checks.push('production reduced-motion clears the overlay');

  await page.getByRole('button', { name: '开始', exact: true }).click();
  await haven(page);
  const record = await saved(page);
  assert(record && JSON.parse(record).modules.length === 3);
  await page.screenshot({ path: `${out}/production-haven.png` });
  checks.push('real start enters promoted haven, removes title motion and persists a full save');
  await page.reload();
  await page.getByRole('button', { name: '继续', exact: true }).waitFor({ timeout: 60000 });
  await page.locator('.joint-action:enabled').first().waitFor();
  assert.equal(await saved(page), record);
  assert.equal(await page.locator('.joint-summary-row').count(), 3);
  checks.push('reload reads the genuine created save and restores Continue plus three summary rows');
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  assert.equal(await page.locator('.joint-title').getAttribute('data-menu-mode'), 'overwrite');
  assert.match(await page.locator('.joint-action.is-selected').innerText(), /继续已保存/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.joint-title').getAttribute('data-menu-mode'), 'root');
  assert.equal(await saved(page), record);
  checks.push('restart confirmation defaults to keeping the record; Escape preserves exact bytes');
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await haven(page);
  const resumed = JSON.parse(await saved(page)), original = JSON.parse(record);
  for (const field of ['modules', 'cycle', 'tide', 'growth', 'kindlingReserve']) assert.deepEqual(resumed[field], original[field]);
  checks.push('real Continue returns to haven with modules, cycle, tide, growth and reserve retained');

  page = await make('{"broken":"preserve-me"');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  assert.equal(await page.locator('.joint-title').getAttribute('data-menu-mode'), 'overwrite');
  assert.match(await page.locator('.joint-action.is-selected').innerText(), /保留记录/);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.joint-title').getAttribute('data-menu-mode'), 'root');
  assert.equal(await saved(page), '{"broken":"preserve-me"');
  checks.push('malformed existing record is not treated as empty; default confirmation preserves exact bytes');

  page = await make(undefined, true);
  await page.getByRole('button', { name: '开始', exact: true }).click();
  assert.match(await page.locator('.joint-warning').innerText(), /无法安全创建记录/);
  assert.equal(await page.locator('#purif-hud').count(), 0);
  assert.equal(await page.locator('.joint-title').count(), 1);
  checks.push('unreadable storage blocks starting instead of resetting progress');

  assert.equal(requests.filter(request => new URL(request).pathname.startsWith('/docs/')).length, 0);
  assert.equal(errors.length, 0); assert.equal(failures.length, 0);
  checks.push('production assets require no docs URLs; no page exceptions or HTTP failures');
  const result = { ok: true, verifiedAt: new Date().toISOString(), url, sourceFingerprints, checks, errors, failures,
    uniqueRequests: [...new Set(requests)], scope: 'Built root, fresh isolated Chromium contexts. Blur is dispatched, not an OS focus test. Native active-Rift recovery and long-session performance not retested.' };
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, checks, out }));
} catch (error) {
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  await writeFile(`${out}/failure.json`, JSON.stringify({ ok: false, error: String(error.stack), checks, errors, failures }, null, 2));
  throw error;
} finally { await browser.close(); }
