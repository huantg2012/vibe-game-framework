import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = 'docs/qa/artifacts/iteration-26/play/corner'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1040 }, deviceScaleFactor: 1 });
const events = [], errors = [], failures = [];
page.on('pageerror', error => errors.push(error.stack ?? error.message));
const read = () => page.evaluate(() => window.__worldPlay.getState());
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(40); };
const capture = async (name) => {
  const state = await read();
  events.push({ name, snapshot: state.snapshot, footprint: state.surface.footprint });
  await page.screenshot({ path: `${out}/${name}.png` }); return state.snapshot.player;
};
try {
  await page.goto('http://127.0.0.1:3012/rift-world-play.html?world=crystal-fibre&space=fracture-fields&seed=175150');
  await page.waitForFunction(() => window.__worldPlay?.getState().sceneCreated);
  const initial = await read(), oldPoint = { x: 917.71, y: 817.27 };
  const route = await page.evaluate(({ from, to }) => window.__worldPlay.getRoutes(from, to), { from: initial.snapshot.player, to: oldPoint });
  events.push({ name: 'planned-body-safe-route', oldPoint, route, metadata: initial.metadata });
  for (const target of route) for (const axis of ['x', 'y']) {
    for (let count = 0; ; count++) {
      const state = await read(), delta = target[axis] - state.snapshot.player[axis];
      assert(!state.snapshot.ended);
      if (Math.abs(delta) < 1.5) break;
      assert(count < 45, `Could not reach body-safe target ${JSON.stringify(target)}`);
      await hold(axis === 'x' ? delta > 0 ? 'KeyD' : 'KeyA' : delta > 0 ? 'KeyS' : 'KeyW', Math.max(17, Math.min(180, Math.abs(delta) / 80 * 1000 - 8)));
    }
  }
  const near = await capture('01-near-old-tip');
  await hold('KeyW', 650); const blocked = await capture('02-north-stops');
  await hold('KeyW', 400); const blockedAgain = await capture('03-north-remains-blocked');
  assert(Math.hypot(blocked.x - blockedAgain.x, blocked.y - blockedAgain.y) < 1, 'North input should remain blocked by missing support');
  await hold('KeyD', 600); const tangent = await capture('04-east-tangent-continues');
  assert(tangent.x - blockedAgain.x > 30, 'Supported tangent should continue under actual native movement');
  await hold('KeyS', 350); const retreat = await capture('05-south-retreat');
  assert(retreat.y - tangent.y > 15);
  events.push({ name: 'result', near, blocked, blockedAgain, tangent, retreat,
    interpretation: 'Old 12px-body point is not legal for the current 20px body. Actual input approached a nearby supported seat; north stops while east tangent and south retreat remain available. No automatic corner routing is claimed.' });
  assert.deepEqual(errors, []);
} catch (reason) { failures.push(reason.stack ?? String(reason)); await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); }
finally { await writeFile(`${out}/corner-probe.json`, JSON.stringify({ events, failures, errors, endedAt: new Date().toISOString() }, null, 2)); await browser.close(); }
console.log(JSON.stringify({ events: events.length, failures, errors }));
if (failures.length || errors.length) process.exitCode = 1;
