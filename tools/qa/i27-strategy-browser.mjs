/** Interactive, isolated browser recorder for representative strategy assays.
 * JSON lines: {"js":"..."} with page / driver / root / fs / load in scope;
 * {"quit":true} closes Chrome. Call load('fixture-name') to read
 * <root>/fixture-name.storage.json. All actual movement uses keyboard events.
 * Read-only full-map routing is diagnostic navigation, never novice-play evidence.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createJourneyDriver } from './i27-journey-driver.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const root = path.resolve(process.argv[2] ?? 'docs/qa/artifacts/iteration-27/strategies');
const url = process.argv[3] ?? 'http://127.0.0.1:3016/';
fs.mkdirSync(root, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
let context, page, driver;
async function load(name) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Expected a fixture name');
  if (context) await context.close();
  const out = path.join(root, name);
  fs.mkdirSync(out, { recursive: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const values = JSON.parse(fs.readFileSync(path.join(root, `${name}.storage.json`), 'utf8'));
  await context.addInitScript(data => {
    localStorage.clear();
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
  }, values);
  page = await context.newPage();
  const error = (kind, text) => fs.appendFileSync(path.join(out, 'errors.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), kind, text }) + '\n');
  page.on('pageerror', reason => error('pageerror', reason.stack ?? String(reason)));
  page.on('console', message => { if (message.type() === 'error') error('console', message.text()); });
  driver = createJourneyDriver(page, out);
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await page.screenshot({ path: path.join(out, '00-menu.png') });
  return { name, url, fixture: 'Isolated prepared inventory, no in-run grants or actor overrides.' };
}
async function pause() {
  // Esc has an intentional input guard; verify the state, not just key delivery.
  await page.waitForTimeout(300);
  const current = await driver.state();
  if (current.scene === 'rift' && current.active && !current.ended) await driver.press('Escape');
  const after = await driver.state();
  if (after.scene === 'rift' && !after.ended && !after.paused) throw new Error('Pause did not engage');
  return after;
}
const lines = readline.createInterface({ input: process.stdin, terminal: false });
console.log('READY');
try {
  for await (const line of lines) {
    try {
      const command = JSON.parse(line);
      if (command.quit) break;
      if (typeof command.js !== 'string') throw new Error('Expected js or quit');
      // This local QA console intentionally evaluates operator-authored commands.
      const value = await eval(`(async()=>{${command.js}})()`);
      console.log(JSON.stringify(value ?? null));
    } catch (reason) {
      console.log(JSON.stringify({ error: String(reason), stack: reason.stack }));
    }
  }
} finally {
  await browser.close();
}
