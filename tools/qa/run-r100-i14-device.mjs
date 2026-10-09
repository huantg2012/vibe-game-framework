#!/usr/bin/env node
/** Portable I14 device handoff. Runs the exact frozen diagnostic; never certifies hardware or human review. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const mode = args[0];
const value = flag => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const manifestPath = 'I14-DEVICE-MANIFEST.json';
if (!['--preflight', '--run', '--play'].includes(mode)) {
  console.log('node tools/qa/run-r100-i14-device.mjs --preflight | --run --device device.json | --play\nOptional: --chrome ABSOLUTE_PATH; --playwright ABSOLUTE_MODULE_PATH');
  process.exit(mode ? 1 : 0);
}
assert(fs.existsSync(path.join(root, manifestPath)), 'Run this from an exported I14 device kit.');
const manifest = read(manifestPath);
const verify = () => { for (const [name, expected] of Object.entries(manifest.files)) {
  assert.equal(hash(fs.readFileSync(path.join(root, name))), expected, `Kit source changed: ${name}`);
} };
verify();
console.log(`Source verified: ${Object.keys(manifest.files).length} files; ${manifest.release.revision}`);
if (mode === '--preflight') process.exit(0);

const candidates = process.platform === 'darwin'
  ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  : process.platform === 'win32'
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter(Boolean).map(base => path.join(base, 'Google/Chrome/Application/chrome.exe'))
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const chrome = value('--chrome') ?? process.env.CHROME_PATH ?? candidates.find(p => fs.existsSync(p));
assert(chrome && fs.existsSync(chrome), 'Chrome not found; pass --chrome with its full executable path.');
const playwrightPath = value('--playwright') ?? process.env.PLAYWRIGHT_MODULE
  ?? path.join(root, '.i14-runtime/node_modules/playwright/index.mjs');
assert(fs.existsSync(playwrightPath), 'Install the separate .i14-runtime package first (see README-I14.md).');
const playwrightModule = pathToFileURL(path.resolve(playwrightPath)).href;
let server;
let child;
let browser;
let output;
let receipt;
let logStream;
let interrupted = false;
const save = () => { if (receipt) fs.writeFileSync(path.join(output, 'device-receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); };
const cleanup = async () => { child?.kill('SIGTERM'); await browser?.close(); await server?.close(); };
const onSignal = () => { interrupted = true; void cleanup(); };
process.once('SIGINT', onSignal);
process.once('SIGTERM', onSignal);
try {
  if (mode === '--run') {
    output = path.join(root, 'device-results', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(output, {recursive: true});
    receipt = {startedAt: new Date().toISOString(), purpose: 'actual-device-runtime-diagnostic',
      release: manifest.release, kitManifestSha256: hash(fs.readFileSync(path.join(root, manifestPath))),
      measuredHost: {platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model,
        logicalCores: os.cpus().length, memoryBytes: os.totalmem(), node: process.version}, chrome,
      weakerDeviceQualification: 'pending-independent-specification-comparison',
      scope: 'Four severe fixed diagnostic worlds. No claim of formal recovery, all-world performance, human listening, or final acceptance.',
      status: 'starting'};
    save();
    logStream = fs.createWriteStream(path.join(output, 'runner.log'), {flags: 'wx'});
  }
  const {createServer} = await import('vite');
  server = await createServer({root, configFile: path.join(root, 'vite.config.ts'),
    server: {host: '127.0.0.1', port: 5173, strictPort: false, open: false, hmr: false},
    cacheDir: path.join(root, '.vite-i14-device')});
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === 'object', 'Vite did not expose a local port.');
  const url = `http://127.0.0.1:${address.port}`;
  if (mode === '--play') {
    const {chromium} = await import(playwrightModule);
    browser = await chromium.launch({headless: false, executablePath: chrome});
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
    const page = await context.newPage();
    await page.goto(url);
    // Human play must receive real browser focus changes. Playwright otherwise pins focus on this page.
    const focus = await context.newCDPSession(page);
    await focus.send('Emulation.setFocusEmulationEnabled', {enabled: false});
    await page.bringToFront();
    console.log('Isolated formal game opened. This temporary browser has no existing player save. Close its window to finish.');
    if (!page.isClosed() && browser.isConnected()) {
      await new Promise(resolve => {
        page.once('close', resolve);
        browser.once('disconnected', resolve);
      });
    }
  } else {
    const devicePath = value('--device');
    assert(devicePath, '--run requires --device device.json describing the real machine and conditions.');
    const device = JSON.parse(fs.readFileSync(path.resolve(devicePath), 'utf8'));
    for (const key of ['operator', 'deviceModel', 'cpu', 'gpu', 'memoryGiB', 'os', 'power', 'backgroundActivity', 'displayScale']) {
      assert(device[key] !== null && device[key] !== undefined && String(device[key]).trim()
        && !String(device[key]).includes('填写'), `Fill the real device field: ${key}`);
    }
    assert.equal(device.exclusiveWindow, true, 'Close unrelated load and explicitly record exclusiveWindow: true.');
    receipt.device = device;
    receipt.status = 'running';
    save();
    console.log(`Four serial 61.2-second samples; output: ${output}`);
    child = spawn(process.execPath, [path.join(root, 'tools/qa/check-r100-i14-runtime-budget.mjs')], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, GAME_URL: url, CHROME_PATH: chrome,
        PLAYWRIGHT_MODULE: playwrightModule, QA_OUTPUT_DIR: output, QA_EXCLUSIVE_WINDOW: '1',
        QA_WORLDS: 'hollow-wreckage,buried-lamellae,felt-wedges,white-scarfield'}});
    child.stdout.on('data', chunk => { process.stdout.write(chunk); logStream.write(chunk); });
    child.stderr.on('data', chunk => { process.stderr.write(chunk); logStream.write(chunk); });
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve(signal ? 130 : (code ?? 1))); });
    verify();
    receipt.sourceVerifiedAfterRun = true;
    receipt.finishedAt = new Date().toISOString();
    receipt.exitCode = exitCode;
    receipt.status = interrupted ? 'interrupted' : exitCode === 0 ? 'diagnostic-completed' : 'diagnostic-has-failures';
    save();
    process.exitCode = exitCode;
    console.log('Return the entire result folder, including any failures. Hardware qualification and release remain separate reviews.');
  }
} catch (error) {
  if (receipt) {
    receipt.finishedAt = new Date().toISOString();
    receipt.status = interrupted ? 'interrupted' : 'failed';
    receipt.failure = String(error.stack ?? error);
    receipt.exitCode = interrupted ? 130 : 1;
    try { verify(); receipt.sourceVerifiedAfterRun = true; }
    catch (sourceError) { receipt.sourceVerifiedAfterRun = false; receipt.sourceFailure = String(sourceError); }
    logStream?.write(receipt.failure + '\n');
    save();
  }
  process.exitCode = interrupted ? 130 : 1;
  console.error(error);
} finally {
  process.removeListener('SIGINT', onSignal);
  process.removeListener('SIGTERM', onSignal);
  await cleanup();
  if (logStream) await new Promise(resolve => logStream.end(resolve));
}
