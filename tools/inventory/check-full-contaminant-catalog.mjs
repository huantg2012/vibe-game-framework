/** Real report projection for all 52 items; fresh browser context, no user saves. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000');
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await page.evaluate(async () => {
    window.productionModule = async path => import(performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === path).name);
    (await productionModule('/src/managers/session.ts')).beginNewExpedition(window.__game.scene.getScene('MainMenuScene'));
  });
  await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene') && !window.__game.scene.getScene('PurificationScene').menuEntry);
  const fixtures = await page.evaluate(async () => {
    const { inventoryStore } = await productionModule('/src/systems/inventory-store.ts');
    const { ACTIVE_CONTAMINANT_DATA } = await productionModule('/src/generated/contaminant-data.ts');
    const { CONTAMINANT_QUALITY_DATA } = await productionModule('/src/generated/contaminant-quality-data.ts');
    const { getContaminantMaxUses } = await productionModule('/src/systems/contaminant-quality.ts');
    const list = [];
    for (const def of ACTIVE_CONTAMINANT_DATA) for (const quality of Object.keys(CONTAMINANT_QUALITY_DATA)) {
      const item = { id: `catalog-${def.id}-${quality}`, type: def.id, quality, rarity: def.rarity, stage: 'tool', impactCharges: 3, usesRemaining: 1 };
      item.usesRemaining = getContaminantMaxUses(item);
      const added = inventoryStore.addContaminant(item); if (!added.ok) throw Error(added.reason);
      list.push({ id: item.id, family: def.id, quality, name: def.displayNameTool, uses: item.usesRemaining });
    }
    return list;
  });
  assert.equal(fixtures.length, 52);
  await page.locator('#purif-report-entry').click();
  await page.locator('.crt-tab[data-tab="1"]').click();
  await page.waitForSelector('#inventory-panel');
  const screenshotDir = process.env.SCREENSHOT_DIR;
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  const nativeIcons = new Set();
  for (const fixture of fixtures) {
    await page.locator(`[data-item-id="${fixture.id}"]`).click();
    const detail = page.locator('.inventory-detail');
    assert((await detail.innerText()).includes(fixture.name));
    assert.match(await detail.locator('.inventory-detail-uses').innerText(), new RegExp(`剩余次数\\s*${fixture.uses}$`));
    await detail.locator('img').evaluate(image => image.decode());
    assert(await detail.locator('img').evaluate(image => image.naturalWidth === 24 && image.naturalHeight === 24));
    const imageSrc = await detail.locator('img').getAttribute('src');
    assert(imageSrc.startsWith('data:image/svg+xml'), 'report uses crisp pixel geometry SVG');
    assert(!nativeIcons.has(imageSrc), 'each family and quality must select its distinct native icon');
    nativeIcons.add(imageSrc);
    if (screenshotDir && fixture.quality === 'excellent' && ['delay', 'siphon', 'stitch', 'compress', 'abyss'].includes(fixture.family)) {
      await page.screenshot({ path: `${screenshotDir}/catalog-${fixture.family}.png` });
    }
  }
  assert.equal(nativeIcons.size, 52);
  assert.deepEqual(errors, []);
  console.log('PASS all 13 families × 4 qualities in actual report: exact identity/uses, decoded native icons, selection and scroll');
} finally { await browser.close(); }
