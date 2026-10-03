/** Controlled legal-position views of the real renderer, not a walking proof. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve('docs/qa/artifacts/rift-r100-i02-corrections/boundaries');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1340, height: 900 }, deviceScaleFactor: 1 });
const results = [], errors = [];
page.on('pageerror', e => errors.push(String(e)));
try {
  for (const family of ['folded-slab', 'fibre-knot', 'broken-shell']) for (const grade of ['low', 'medium', 'severe']) {
    await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3027'}/rift-r100-masters.html?family=${family}&grade=${grade}&seed=20261002`);
    await page.waitForFunction(() => { try { return JSON.parse(document.querySelector('#diagnostics').textContent).runtime.running; } catch { return false; } }, null, { timeout: 60000 });
    await page.locator('#pixel').click();
    const setup = async kind => page.evaluate(async kind => {
      const { audioManager } = await import('/src/managers/audio-manager.ts');
      const { TileGrid } = await import('/src/systems/tile-grid.ts');
      const { TileType } = await import('/src/types/game-types.ts');
      const { bodyHasSupport } = await import('/src/systems/ai/physical-grid.ts');
      const scene = audioManager.game.scene.getScene('RiftScene'), world = scene.devRuntime.world;
      const grid = new TileGrid(world.layout.tileMap), choices = [];
      const inPolygon = (points, x, y) => { let result = false; for (let a = 0, b = points.length - 1; a < points.length; b = a++) { const p = points[a], q = points[b]; if ((p.y > y) !== (q.y > y) && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) result = !result; } return result; };
      for (let row = 1; row < grid.rows - 1; row++) for (let col = 1; col < grid.cols - 1; col++) {
        const x = (col + .5) * grid.tileSize, y = (row + .5) * grid.tileSize;
        if (kind === 'edge') {
          if (grid.getTile(col, row) !== TileType.WALL || grid.getTile(col, row + 1) !== TileType.FLOOR) continue;
          const point = { x, y: (row + 1) * grid.tileSize + 16 };
          if (bodyHasSupport(grid, point, 10, 10)) choices.push({ point, facing: 'w', edge: { x, y }, score: Math.abs(x - world.meshes[0].spec.x) + Math.abs(y - world.meshes[0].bounds.maxY) });
        } else {
          if (world.matterAt(x, y) || !world.definition.erosion.some(p => inPolygon(p, x, y))) continue;
          if (!world.matterAt(x - 8, y)) continue;
          const point = { x: x - 32, y };
          if (!bodyHasSupport(grid, point, 10, 10)) continue;
          choices.push({ point, facing: 'd', edge: { x, y }, score: Math.hypot(x - world.layout.spawnPoint.x, y - world.layout.spawnPoint.y) });
        }
      }
      choices.sort((a, b) => a.score - b.score);
      if (!choices[0]) throw new Error(`No legal ${kind} observation seat`);
      const selected = choices[0]; scene.probePlacePlayer(selected.point.x, selected.point.y);
      return selected;
    }, kind);
    for (const kind of ['edge', 'erosion']) {
      const seat = await setup(kind);
      await page.locator('#game-container').focus();
      await page.keyboard.down(seat.facing); await page.waitForTimeout(70); await page.keyboard.up(seat.facing);
      await page.waitForTimeout(250);
      const observed = await page.evaluate(async edge => {
        const { audioManager } = await import('/src/managers/audio-manager.ts');
        const scene = audioManager.game.scene.getScene('RiftScene');
        return { position: scene.player.getPosition(), edgeVisibility: scene.visibility.getVisibilityAt(edge), state: scene.probeBuildLabState() };
      }, seat.edge);
      await page.locator('#game-container canvas').screenshot({ path: path.join(out, `${family}-${grade}-${kind}.png`) });
      results.push({ family, grade, kind, seat, observed });
    }
  }
  assert.equal(errors.length, 0);
} finally { await writeFile(path.join(out, 'report.json'), JSON.stringify({ scope: 'Controlled positions chosen on native 20px legal support, real movement to face material edge or explicit erosion. These frames do not prove natural traversal or user art approval.', results, errors }, null, 2)); await browser.close(); }
