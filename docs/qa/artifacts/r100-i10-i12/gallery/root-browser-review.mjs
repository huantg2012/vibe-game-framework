// Root-only, single-browser review of the offline evidence gallery. Run only
// after the runtime owner has released its browser; no game page is opened.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root = '/Users/yilungao/coh';
const html = 'docs/qa/interactive/r100-i10-i12-worlds.html';
const dataPath = 'docs/qa/interactive/r100-i10-i12-worlds.data.json';
const output = path.join(root, 'docs/qa/artifacts/r100-i10-i12/gallery/root-browser-review');
assert(!fs.existsSync(output), 'Preserve earlier review artifacts');
fs.mkdirSync(output);
const sha = file => createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
const ref = file => ({path: file, sha256: sha(file)});
const report = {version: 1, status: 'running', reviewer: 'root', startedAt: new Date().toISOString(),
  html: ref(html), data: ref(dataPath), observations: [], screenshots: [], errors: [], cancelledRequests: [],
  scope: 'Offline 108-world gallery rendering and bounded navigation. No game execution or new world-art approval.',
  visualReview: 'pending-root-image-inspection'};
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1});
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push({type: 'pageerror', message: String(error)}));
  page.on('console', message => {if (message.type() === 'error') report.errors.push({type: 'console-error', message: message.text()});});
  page.on('requestfailed', request => {
    const row = {type: 'requestfailed', url: request.url(), failure: request.failure()};
    // Reloading or changing the viewed image may cancel an old image request.
    // Keep those observed cancellations separate; file/decoding failures remain errors.
    (row.failure?.errorText === 'net::ERR_ABORTED' ? report.cancelledRequests : report.errors).push(row);
  });
  const readState = () => page.evaluate(() => ({world: document.querySelector('#world-select').value,
    grade: document.querySelector('#grade-controls [aria-pressed=true]').dataset.grade,
    frame: document.querySelector('#frame-select').value, hash: location.hash,
    missing: !document.querySelector('#missing-frame').hidden,
    image: {src: document.querySelector('#frame-image').getAttribute('src'), complete: document.querySelector('#frame-image').complete,
      width: document.querySelector('#frame-image').naturalWidth},
    documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth}));
  const loaded = () => page.waitForFunction(() => {
    const image = document.querySelector('#frame-image');
    return !document.querySelector('#picture-stage').hidden && image.complete && image.naturalWidth > 0;
  });
  async function screenshot(name) {
    const file = path.join(output, name + '.png');
    await page.screenshot({path: file}); report.screenshots.push(ref(path.relative(root, file)));
  }
  await page.goto(pathToFileURL(path.join(root, html)).href);
  await loaded();
  assert.equal(await page.locator('#world-select option').count(), 108);
  assert.equal(await page.locator('.world-card').count(), 108);
  assert.equal(await page.locator('#missing-slots button').count(), 54);
  const initial = await readState();
  assert.equal(initial.world, 'cleft-tableland'); assert.equal(initial.grade, 'medium');
  assert(initial.documentWidth <= initial.viewportWidth);
  report.observations.push({action: 'initial', ...initial});
  await screenshot('01-default');
  await page.locator('#viewer').scrollIntoViewIfNeeded();
  await screenshot('02-viewer');
  await page.locator('#grade-controls [data-grade=severe]').click();
  await loaded();
  assert.equal((await readState()).grade, 'severe');
  if (!(await page.locator('#next-frame').isDisabled())) {
    const before = (await readState()).frame;
    await page.locator('#next-frame').click(); await loaded();
    assert.notEqual((await readState()).frame, before);
    await page.locator('#previous-frame').click(); await loaded();
    assert.equal((await readState()).frame, before);
  }
  const neighbor = page.locator('#neighbor-links button').first();
  const neighborId = await neighbor.getAttribute('title');
  await neighbor.click(); await loaded();
  assert.equal((await readState()).world, neighborId);
  assert.equal((await readState()).grade, 'severe');
  report.observations.push({action: 'neighbor-preserves-selected-grade', ...await readState()});
  await page.locator('#world-select').selectOption('last-shelf'); await loaded();
  const saved = await readState(); await page.reload(); await loaded();
  assert.deepEqual(await readState(), saved);
  report.observations.push({action: 'last-world-hash-reload', ...saved});
  await page.locator('#viewer').scrollIntoViewIfNeeded(); await screenshot('03-last-world-severe');
  await page.locator('#search').fill('cleft-tableland');
  const filteredCount = await page.locator('.world-card').count();
  assert(filteredCount > 0 && filteredCount < 108);
  assert.equal(await page.locator('.world-card[data-world="cleft-tableland"]').count(), 1);
  report.observations.push({action: 'world-and-neighbor-search', query: 'cleft-tableland', filteredCount});
  await page.locator('#catalog-section').scrollIntoViewIfNeeded(); await screenshot('04-filter');
  await page.locator('#search').fill('no-matching-world-20261008');
  assert.equal(await page.locator('.world-card').count(), 0);
  assert(await page.locator('#empty-search').isVisible());
  await page.locator('#search').fill(''); assert.equal(await page.locator('.world-card').count(), 108);
  const firstMissing = JSON.parse(fs.readFileSync(path.join(root, dataPath))).missingDirectFrameSlots[0];
  // Begin on severe; this link must switch to the missing slot's own grade.
  await page.locator('#grade-controls [data-grade=severe]').click(); await loaded();
  await page.locator('#coverage details > summary').click();
  await page.locator('#missing-slots button').first().click();
  const missing = await readState();
  assert.equal(missing.world, firstMissing.worldId); assert.equal(missing.grade, firstMissing.grade);
  assert.equal(missing.missing, true); assert.equal(missing.image.src, null);
  assert(await page.locator('#frame-select').isDisabled());
  assert.equal(await page.locator('#world-title').evaluate(e => document.activeElement === e), true);
  report.observations.push({action: 'missing-slot-selects-its-own-grade-and-focus', ...missing});
  await screenshot('05-explicit-historical-missing');
  await page.locator('#grade-controls [data-grade=medium]').click(); await loaded();
  report.observations.push({action: 'missing-to-existing-image', ...await readState()});
  assert.deepEqual(report.errors, []);
  assert.equal(sha(html), report.html.sha256); assert.equal(sha(dataPath), report.data.sha256);
  report.status = 'browser-checks-pass-pending-root-image-inspection';
  await context.close();
} catch (error) {
  report.status = 'failed'; report.failure = String(error); report.stack = error.stack; process.exitCode = 1;
} finally {
  await browser.close(); report.browserClosed = true; report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({status: report.status, screenshots: report.screenshots.length, errors: report.errors.length,
    path: path.relative(root, path.join(output, 'report.json')), failure: report.failure}));
}
