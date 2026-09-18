import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const records = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1040 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:3011/rift-worlds.html?world=crystal-fibre&space=fracture-fields&seed=175150&view=walk&field=0');
  await page.waitForFunction(() => window.__worldStudy?.getState().ready);
  async function record(label) {
    records.push(await page.evaluate(async label => {
      const api = window.__worldStudy;
      const state = api.getState();
      const grid = api.getGrid();
      const shape = await import('/src/generation/world-study/shape.ts');
      const sample = { ...grid, land: new Uint8Array(grid.land), walls: new Uint8Array(grid.walls) };
      const support = (x, y) => shape.worldLandAt(sample, x, y) && !shape.worldWallAt(sample, x, y);
      const offsets = [[0,0],[-6,-6],[6,-6],[-6,6],[6,6],[-6,0],[6,0],[0,-6],[0,6]];
      const probes = {};
      for (const [name, dx, dy] of [['current',0,0],['east',1,0],['north',0,-1],['south',0,1],['south-east',1,1]]) {
        const x=state.player.x+dx, y=state.player.y+dy;
        probes[name]={ center:[x,y], canStand:api.collisionAt(x,y), unsupported:offsets.filter(([ox,oy])=>!support(x+ox,y+oy)) };
      }
      return { label, at:new Date().toISOString(), state, probes };
    },label));
  }
  await record('spawn');
  for (const [label, keys, ms] of [
    ['east-1',['d'],2400], ['east-2',['d'],2400], ['north-to-edge',['w'],2400],
    ['east-to-tip',['d'],1500], ['north-block',['w'],2000], ['north-east-block',['w','d'],2200], ['east-block',['d'],1000],
    ['retreat',['s'],400], ['east-recover',['d'],1200], ['north-recover',['w'],2200],
  ]) {
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    for (const key of keys) await page.keyboard.up(key);
    await page.waitForTimeout(160);
    await record(label);
    if (label === 'east-block' || label === 'east-recover') await page.screenshot({ path: dir+label+'.png' });
  }
} finally {
  await browser.close();
  writeFileSync(dir+'corner-probe.json', JSON.stringify({ kind:'D-stage actual browser diagnostic, not first-contact evidence', records, closedAt:new Date().toISOString() }, null, 2)+'\n');
}
console.log(JSON.stringify(records.map(({label,state,probes})=>({label,player:state.player,probes}))));
