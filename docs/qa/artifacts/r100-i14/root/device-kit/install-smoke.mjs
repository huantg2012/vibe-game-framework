/** Reference-Mac bootstrap of the exported kit, not a weak-device or play qualification. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const kit = path.resolve(process.argv[2]);
const out = path.dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(kit, 'I14-DEVICE-MANIFEST.json')));
const verify = () => { for (const [name, sha] of Object.entries(manifest.files)) {
  assert.equal(hash(fs.readFileSync(path.join(kit, name))), sha, name);
} };
verify();
const {createServer} = await import(pathToFileURL(path.join(kit, 'node_modules/vite/dist/node/index.js')));
const {chromium} = await import(pathToFileURL(path.join(kit, '.i14-runtime/node_modules/playwright/index.mjs')));
const report = {startedAt: new Date().toISOString(), scope: 'Exported kit own installed dependencies and formal MainMenu; no departure, no existing player storage, no review-page access.',
  release: manifest.release, manifestSha256: hash(fs.readFileSync(path.join(kit, 'I14-DEVICE-MANIFEST.json'))),
  errors: [], status: 'running', weakDevice: false};
let server, browser;
try {
  server = await createServer({root: kit, configFile: path.join(kit, 'vite.config.ts'),
    server: {host: '127.0.0.1', port: 0, open: false, hmr: false}, cacheDir: path.join(kit, '.vite-smoke')});
  await server.listen();
  browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  report.browser = browser.version();
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive(), null, {timeout: 60000});
  report.menu = await page.evaluate(() => ({interactive: window.__game.scene.getScene('MainMenuScene').interactive(),
    currentSave: localStorage.getItem('coh-save-v1'), webgl: Boolean(window.__game.renderer.gl)}));
  assert(report.menu.interactive && report.menu.webgl);
  assert.equal(report.menu.currentSave, null);
  assert.deepEqual(report.errors, []);
  await page.screenshot({path: path.join(out, 'installed-kit-menu.png')});
  verify(); report.sourceVerifiedAfter = true;
  report.status = 'passed-reference-machine-isolated-formal-menu-bootstrap';
} catch (error) {
  report.status = 'failed'; report.failure = String(error.stack ?? error); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'install-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await server?.close();
}
console.log(JSON.stringify(report));
