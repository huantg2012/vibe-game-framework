/** Bounded end-to-end CLI shutdown diagnostic on the reference Mac. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const out = path.dirname(fileURLToPath(import.meta.url));
const kit = path.resolve(process.argv[2]);
const observationPath = path.join(out, 'cli-play-observation.json');
const reportPath = path.join(out, 'cli-play-lifecycle.json');
const log = fs.createWriteStream(path.join(out, 'cli-play-lifecycle.log'), {flags: 'wx'});
const report = {startedAt: new Date().toISOString(), kit, status: 'running', scope: 'Original exported --play CLI lifecycle on reference Mac; only-page close is programmatic. No weak-device, listening, or native title-bar interaction claim.', timeoutMs: 30000};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const child = spawn(process.execPath, [path.join(kit, 'tools/qa/run-r100-i14-device.mjs'), '--play', '--playwright', path.join(out, 'cli-play-lifecycle-proxy.mjs')], {cwd: kit, env: {...process.env, I14_CLI_KIT: kit, I14_CLI_OBSERVATION: observationPath}, stdio: ['ignore', 'pipe', 'pipe']});
child.stdout.on('data', chunk => log.write(chunk));
child.stderr.on('data', chunk => log.write(chunk));
let timedOut = false;
const timer = setTimeout(() => {timedOut = true; child.kill('SIGINT');}, report.timeoutMs);
const exit = await new Promise(resolve => {child.once('error', error => resolve({error: String(error)})); child.once('close', (code, signal) => resolve({code, signal}));});
clearTimeout(timer);
await new Promise(resolve => log.end(resolve));
report.exit = exit; report.timedOut = timedOut;
report.observation = fs.existsSync(observationPath) ? JSON.parse(fs.readFileSync(observationPath, 'utf8')) : null;
const menu = report.observation?.events.find(event => event.type === 'menu');
if (menu) {
  try {await fetch(menu.url, {signal: AbortSignal.timeout(2000)}); report.serverClosedAfterExit = false;}
  catch {report.serverClosedAfterExit = true;}
}
report.status = !timedOut && exit.code === 0 && menu?.state.interactive && menu.state.currentSave === null && menu.state.webgl && report.serverClosedAfterExit && report.observation.events.some(event => event.type === 'only-page-closed') && !report.observation.events.some(event => ['pageerror', 'observer-error'].includes(event.type)) ? 'passed-reference-cli-only-page-close' : 'failed';
report.finishedAt = new Date().toISOString();
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = report.status === 'failed' ? 1 : 0;
