/** Directed boundary regression, not a natural progression or balance sample.
 * Copies the real I28 carried-shell fixture into an isolated browser context,
 * explicitly prepares its last offering charge / settled return, then faults
 * only the primary storage write. Production settlement and UI run unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const key = 'coh-save-v1';
const sourcePath = 'docs/qa/artifacts/iteration-28/browser/natural-current/03-carry.storage.json';
const out = path.resolve(process.env.QA_OUT ?? 'docs/qa/artifacts/iteration-28/reveal-persistence');
const fixture = JSON.parse(JSON.parse(fs.readFileSync(sourcePath, 'utf8'))[key]);
const shell = fixture.inventory.items.find(item => item.contaminant?.catalog?.definitionId === 'amber_beetle');
assert(shell, 'Natural fixture must contain the first unopened amber beetle');
assert.equal(shell.contaminant.catalog.identification, 'unidentified');
// Explicit targeted setup: next impact completes the already fixed first item.
shell.contaminant.impactCharges = 2;
shell.location = { kind: 'defense', slot: 0 };
fixture.inventory.equipment.defenseIds = [shell.id];
fixture.inventory.run.status = 'settled';
fixture.inventory.run.outcome = 'extract';
fixture.inventory.run.returnedIds = [shell.id];
fixture.inventory.run.kindlingGained = 0;
delete fixture.inventory.run.baseSettled;
fixture.cycle = 3;
delete fixture.riftCheckpoint;
delete fixture.riftDeparture;
delete fixture.checkpointChecksum;
const bytes = JSON.stringify(fixture);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'directed-last-offering.storage.json'), JSON.stringify({ [key]: bytes }, null, 2));

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const cases = [], errors = [];
let failure = null;
async function createCase(label, caseBytes = bytes) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.addInitScript(({ key, bytes }) => {
    if (!sessionStorage.getItem('i28-reveal-seeded')) {
      sessionStorage.setItem('i28-reveal-seeded', 'true');
      localStorage.clear(); localStorage.setItem(key, bytes);
    }
    window.__qaReveal = { reject: false, writes: [], reports: 0, sounds: 0, toasts: 0 };
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (this === localStorage && k === key) {
        window.__qaReveal.writes.push({ bytes: String(value), rejected: window.__qaReveal.reject });
        if (window.__qaReveal.reject) throw new DOMException('I28 directed quota fault', 'QuotaExceededError');
      }
      return original.call(this, k, value);
    };
  }, { key, bytes: caseBytes });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push({ label, error: String(error) }));
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3017/');
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await page.evaluate(async () => {
    const scene = window.__game.scene.getScene('PurificationScene');
    for (const [method, counter] of [['playImpactAudio', 'sounds'], ['showNewToolToast', 'toasts']]) {
      const original = scene[method];
      scene[method] = function (...args) { window.__qaReveal[counter]++; return original.apply(this, args); };
    }
    const { impactResultPanel } = await import('/src/ui/dom/impact-result-panel.ts');
    const show = impactResultPanel.show;
    impactResultPanel.show = function (...args) { window.__qaReveal.reports++; return show.apply(this, args); };
    window.__qaReveal.reject = true;
  });
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '尚未保存 · 点击重试' }).waitFor();
  return { context, page };
}
async function observation(page) {
  return page.evaluate(key => ({
    ...window.__qaReveal, durable: localStorage.getItem(key), text: document.body.innerText,
    reportVisible: !!document.querySelector('#impact-result-panel'),
    player: { ...window.__game.scene.getScene('PurificationScene').player.getPosition() },
  }), key);
}
async function hold(page, input, duration = 180) {
  await page.keyboard.down(input); await page.waitForTimeout(duration); await page.keyboard.up(input);
}
const item = value => value.inventory.items.find(item => item.id === shell.id);
const revealFacts = (page, name) => page.getByText(name, { exact: true }).evaluate(element => {
  const facts = element.parentElement.nextElementSibling.nextElementSibling;
  return [...facts.querySelectorAll(':scope > span')].map(span => span.textContent.trim());
});
async function firstScreenReveal(page, name) {
  const geometry = await page.getByText(name, { exact: true }).evaluate(element => {
    const row = element.parentElement;
    const image = row.nextElementSibling.querySelector('img');
    const facts = row.nextElementSibling.nextElementSibling;
    const scroll = element.closest('.scroll-area');
    const box = node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return { scrollTop: scroll.scrollTop, viewport: box(scroll), name: box(element),
      icon: image ? box(image) : null, facts: box(facts), iconLoaded: !!image?.complete && image.naturalWidth > 0 };
  });
  assert.equal(geometry.scrollTop, 0, 'First revelation evidence must not scroll the report');
  assert(geometry.iconLoaded, 'The real revealed icon must load');
  for (const [field, box] of Object.entries({ name: geometry.name, icon: geometry.icon, facts: geometry.facts })) {
    assert(box && box.width > 0 && box.height > 0, `${field} must have a visible bounding box`);
    assert(box.top >= geometry.viewport.top - 1 && box.bottom <= geometry.viewport.bottom + 1
      && box.left >= geometry.viewport.left - 1 && box.right <= geometry.viewport.right + 1,
    `${field} must fit wholly inside the unscrolled report viewport`);
  }
  return geometry;
}
try {
  // Slow path: failed save, failed retry, durable retry, report, refresh.
  const { context, page } = await createCase('repeated-refusal');
  await page.waitForTimeout(1100); // Includes the menu transition's onReady callback.
  const refused = await observation(page);
  assert.equal(refused.durable, bytes);
  assert.equal(refused.reports, 0); assert.equal(refused.sounds, 0); assert.equal(refused.toasts, 0);
  assert(!refused.reportVisible); assert(!refused.text.includes('琥珀甲虫'));
  await hold(page, 'd');
  assert.deepEqual((await observation(page)).player, refused.player, 'Pending save must keep movement locked after entry animation');
  await page.screenshot({ path: path.join(out, '01-rejected-no-reveal.png') });
  await page.getByRole('button', { name: '尚未保存 · 点击重试' }).click();
  const twice = await observation(page);
  assert.equal(twice.writes.length, 2);
  assert(twice.writes.every(write => write.rejected && write.bytes === twice.writes[0].bytes));
  assert.equal(twice.durable, bytes); assert.equal(twice.reports, 0); assert(!twice.text.includes('琥珀甲虫'));
  await page.evaluate(() => window.__qaReveal.reject = false);
  await page.getByRole('button', { name: '尚未保存 · 点击重试' }).click();
  await page.locator('#impact-result-panel').waitFor();
  const committed = await observation(page), saved = JSON.parse(committed.durable);
  assert.equal(committed.writes.length, 3);
  assert(committed.writes.every(write => write.bytes === committed.writes[0].bytes), 'All retries must write the byte-identical settled candidate');
  assert.equal(committed.reports, 1); assert.equal(committed.sounds, 1); assert.equal(committed.toasts, 0);
  assert(committed.text.includes('琥珀甲虫')); assert.equal(item(saved).contaminant.catalog.identification, 'revealed');
  assert.equal(item(saved).contaminant.impactCharges, 3); assert.equal(item(saved).contaminant.usesRemaining, 5);
  assert.deepEqual(saved.inventory.discoveredCatalogIds, ['amber_beetle']);
  assert.equal(Object.values(saved.inventory.offeringReceipts).flat().filter(r => r.itemId === shell.id).length, 1);
  const activeFacts = await revealFacts(page, '琥珀甲虫');
  assert.deepEqual(activeFacts, ['主动', '5', '次', '重量', '2'], 'First reveal must show separate actual slot, use count and weight fields');
  await page.waitForTimeout(350);
  const activeFirstScreen = await firstScreenReveal(page, '琥珀甲虫');
  await page.screenshot({ path: path.join(out, '02-durable-reveal.png') });
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  assert.equal((await observation(page)).toasts, 1);
  const beforeMove = (await observation(page)).player;
  await hold(page, 'd');
  assert((await observation(page)).player.x > beforeMove.x + 2, 'Dismissed result restores movement');
  await page.reload(); await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1200);
  const reload = await observation(page), reloaded = JSON.parse(reload.durable);
  assert(!reload.reportVisible, 'Completed reveal must not replay after reload');
  for (const field of ['inventory', 'modules', 'tide', 'stability']) assert.deepEqual(reloaded[field], saved[field], `Reload must not repeat ${field} settlement`);
  cases.push({ name: 'repeated-refusal', result: 'PASS', failedWrites: 2, successfulWrites: 1,
    byteIdenticalCandidate: true, reportCount: committed.reports, impactAudioCount: committed.sounds,
    identifiedName: '琥珀甲虫', usesRemaining: item(saved).contaminant.usesRemaining,
    firstRevealFacts: activeFacts,
    firstScreen: activeFirstScreen,
    discoveryCount: saved.inventory.discoveredCatalogIds.length, revealReceiptCount: Object.values(saved.inventory.offeringReceipts).flat().length,
    reloadReplaysReport: reload.reportVisible });
  await context.close();

  // Fast path: retry and dismiss before the menu-entry ready callback runs.
  const fast = await createCase('early-dismiss');
  await fast.page.evaluate(() => window.__qaReveal.reject = false);
  await fast.page.getByRole('button', { name: '尚未保存 · 点击重试' }).click();
  await fast.page.locator('#impact-result-panel').waitFor();
  await fast.page.keyboard.press('Enter');
  const dismissedDuringTransition = await fast.page.evaluate(() => !!document.querySelector('#menu-entry-transition'));
  assert(dismissedDuringTransition, 'This counterexample must dismiss before the transition finishes');
  await fast.page.waitForTimeout(1200);
  const before = (await observation(fast.page)).player;
  await hold(fast.page, 'd');
  const after = await observation(fast.page);
  assert(after.player.x > before.x + 2, 'Later entry-ready callback must not re-lock movement after report dismissal');
  assert.equal(after.reports, 1); assert.equal(after.sounds, 1); assert.equal(after.toasts, 1);
  await fast.page.screenshot({ path: path.join(out, '03-early-dismiss-movable.png') });
  cases.push({ name: 'early-dismiss', result: 'PASS', dismissedDuringTransition, movementAfterTransition: after.player.x - before.x,
    reportCount: after.reports, impactAudioCount: after.sounds, toastCount: after.toasts });
  await fast.context.close();

  // Explicit same-shell counterexamples for the new reveal facts. These two
  // identities are directed fixture variants, not claimed natural discoveries.
  for (const variant of [
    { id: 'brass_monocle', name: '铜框单镜', facts: ['被动', '2', '趟', '重量', '2'], stage: 'tool' },
    { id: 'double_hole_token', name: '双孔票牌', facts: ['重量', '2'], stage: 'inert' },
  ]) {
    const directed = structuredClone(fixture);
    item(directed).contaminant.catalog.definitionId = variant.id;
    const planned = directed.inventory.run.dropPlan.entries.find(entry => entry.contaminant.id === shell.id);
    planned.contaminant.catalog.definitionId = variant.id;
    delete directed.inventory.run.dropPlan.tutorialNodeId;
    const run = await createCase(`reveal-facts-${variant.id}`, JSON.stringify(directed));
    const before = await observation(run.page);
    assert(!before.text.includes(variant.name)); assert.equal(before.reports, 0);
    await run.page.evaluate(() => window.__qaReveal.reject = false);
    await run.page.getByRole('button', { name: '尚未保存 · 点击重试' }).click();
    await run.page.locator('#impact-result-panel').waitFor();
    const facts = await revealFacts(run.page, variant.name);
    assert.deepEqual(facts, variant.facts, 'Passive must use trips; inert must have no false usage or slot');
    const revealed = JSON.parse((await observation(run.page)).durable);
    assert.equal(item(revealed).contaminant.stage, variant.stage);
    if (variant.stage === 'inert') {
      assert.equal(item(revealed).contaminant.usesRemaining, 0);
      assert(!(await run.page.locator('#impact-result-panel').innerText()).includes('可在备行时装配'));
    }
    await run.page.waitForTimeout(1000);
    const firstScreen = await firstScreenReveal(run.page, variant.name);
    await run.page.screenshot({ path: path.join(out, `04-reveal-facts-${variant.id}.png`) });
    cases.push({ name: `reveal-facts-${variant.id}`, result: 'PASS', directedDefinitionOverride: variant.id,
      firstRevealFacts: facts, firstScreen, stage: item(revealed).contaminant.stage, noIdentityBeforePersistence: true });
    await run.context.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS I28 reveal persistence: refusal hides knowledge, identical retries reveal once, reload stable, early dismissal movable, active/passive/inert reveal facts correct');
} catch (error) {
  failure = error.stack ?? String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({
    method: 'Directed boundary regression; isolated Chromium contexts, real keyboard/button controls and production return settlement. Storage transport refusal only; method wrappers count publication without replacing logic.',
    source: sourcePath,
    fixtureEdits: ['Move the real unopened first item to offering slot 0', 'Set offering progress to 2 of 3', 'Prepare extracted, un-settled return with cycle 3', 'Remove active-world checkpoint; retain the fixed item identity and run drop plan'],
    additionalDirectedVariants: 'The passive and inert presentation cases replace both the owned and planned fixed definition, remove the tutorial override and keep the same unopened shell. They are not natural drop samples.',
    status: failure ? 'FAIL' : 'PASS', cases, errors, failure,
  }, null, 2));
  await browser.close();
}
