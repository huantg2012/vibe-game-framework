/** Bounded offline art gates. Human recognition still requires the user's review. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import sharp from 'sharp';
import { bakeHumanModel, type HumanPhase } from '../../src/entities/form-renderers/d/human-model';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { lightModelPixels } from '../../src/entities/form-renderers/d/model-visual';
import type { CoverageId } from '../../src/generated/contamination-lexicon-data';

const directory = 'docs/qa/artifacts/enemy-human-readability-2026-10-23';
const atlas = JSON.parse(fs.readFileSync(`${directory}/atlas.json`, 'utf8'));
const tiers: CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const facings = ['down', 'left', 'up', 'right'] as const;
const phases: HumanPhase[] = ['idle', 'walk', 'alert', 'windup', 'strike', 'recover'];
const hash = (data: Uint8Array | Uint8ClampedArray) => createHash('sha256').update(data).digest('hex');
const mask = (data: Uint8ClampedArray) => data.filter((_, i) => i % 4 === 3);
let frames = 0, minMargin = 64, neckChecks = 0, legChecks = 0;
const times: number[] = [];
const silhouettes = new Set<string>();
for (const card of atlas.cards) {
  const worldAdaptation = resolveEnemyWorldAdaptation(card.worldId)!;
  const palette = new Set([worldAdaptation.dark, worldAdaptation.mid, worldAdaptation.light, worldAdaptation.secondary].map(c => c.join(',')));
  const family = createHash('sha256');
  for (const seed of [37, 192]) for (const coverage of tiers) for (const facing4 of facings) for (const phase of phases) for (const phase01 of (phase === 'walk' ? [0, .25, .5, .75, 1] : [0, .5, 1])) {
    const req = { seed, coverage, facing4, phase, phase01, worldAdaptation, anatomyVersion: 2 as const };
    const t = performance.now(), body = bakeHumanModel(req); times.push(performance.now() - t);
    assert.equal(hash(body.buf.data), hash(bakeHumanModel(req).buf.data), 'deterministic pose');
    assert.deepEqual([body.canvas.w, body.canvas.h, body.canvas.originX, body.canvas.originY, body.canvas.collision], [64, 64, 32, 42, 20]);
    assert.equal(body.contacts.length, 2, 'both anatomical feet retained at every tier');
    assert(body.contacts.some(c => c.weight > .99), 'a foot remains grounded');
    assert(body.lightingSurface);
    for (let i = 0; i < 4096; i++) {
      const a = body.buf.data[i * 4 + 3]; assert(a === 0 || a === 255);
      if (!a) continue;
      const x = i % 64, y = Math.floor(i / 64); minMargin = Math.min(minMargin, x, y, 63 - x, 63 - y);
      assert(palette.has(Array.from(body.buf.data.subarray(i * 4, i * 4 + 3)).join(',')));
      const normals = body.lightingSurface.normals.subarray(i * 3, i * 3 + 3);
      assert(Math.abs(Math.hypot(...normals) - 1) < .001, 'visible pixel has a geometric normal');
    }
    if (seed === 37 && phase === 'idle' && phase01 === 0) {
      family.update(mask(body.buf.data));
      if (facing4 === 'down' || facing4 === 'up') {
        const rows = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => x).filter(x => body.buf.data[(y * 64 + x) * 4 + 3]));
        const top = rows.findIndex(row => row.length);
        const widths = rows.map(row => row.length ? row.at(-1)! - row[0]! + 1 : 0);
        // Measure the actual alpha silhouette: a narrow connection below the
        // cranium before a broad shoulder band, not merely declared joint names.
        const neck = widths.slice(top + 5, top + 11).some((width, i) => width > 0 && width <= 6 && Math.max(...widths.slice(top + 6 + i, top + 14 + i)) >= width + 5);
        assert(neck, `${card.worldId}/${coverage}/${facing4}: neck buried in shoulders`); neckChecks++;
        const splitRows = rows.slice(37, 41).filter(row => row.some((x, i) => i > 0 && x > row[i - 1]! + 1));
        assert(splitRows.length >= 3, `${card.worldId}/${coverage}/${facing4}: lower legs fused`); legChecks++;
      }
    }
    frames++;
  }
  silhouettes.add(family.digest('hex'));
  for (const coverage of tiers) for (const facing4 of facings) {
    const pose = (phase: HumanPhase, phase01: number) => bakeHumanModel({ seed: 37, coverage, facing4, phase, phase01, worldAdaptation, anatomyVersion: 2 });
    for (const phase of ['idle', 'walk'] as const) assert.equal(hash(pose(phase, 0).buf.data), hash(pose(phase, 1).buf.data));
    assert.notEqual(hash(mask(pose('walk', .25).buf.data)), hash(mask(pose('idle', 0).buf.data)), 'stride must animate the silhouette');
    assert.equal(hash(pose('strike', 1).buf.data), hash(pose('recover', 0).buf.data));
    assert.equal(hash(pose('recover', 1).buf.data), hash(pose('idle', 0).buf.data));
    const body = pose('idle', 0), lit = body.buf.data.slice();
    lightModelPixels(lit, body.lightingSurface!, 0, 0, { lights: [] });
    assert.equal(hash(mask(lit)), hash(mask(body.buf.data)), 'light does not change silhouette');
    assert.notEqual(hash(lit), hash(body.buf.data));
  }
  for (const grade of ['low', 'medium', 'severe']) assert.deepEqual(card.deployments[grade], ['infiltrate', 'rewrite']);
  for (const version of [1, 2]) {
    const meta = await sharp(`${directory}/${card.worldId}-v${version}.png`).metadata();
    assert.deepEqual([meta.width, meta.height], [44 * 64, 3 * 4 * 64]);
  }
}
assert.equal(silhouettes.size, 6, 'material families must alter visible structure');
assert(minMargin >= 2, 'pose crops canvas');
const html = fs.readFileSync(`${directory}/index.html`, 'utf8');
new Script(html.match(/<script>([\s\S]*?)<\/script>/)![1]!);
assert.equal((html.match(/<canvas /g) ?? []).length, 18, 'all stages visible without a selector');
assert.equal(atlas.bakedFrames, 6336);
times.sort((a, b) => a - b);
const report = { scope: 'Offline candidate anatomy and atlas only. No gameplay, GPU or human approval.', frames, minMargin, neckChecks, legChecks, families: silhouettes.size, atlasCanvases: 18, atlasFrames: 6336, bakeMs: { median: times[Math.floor(times.length * .5)], p95: times[Math.floor(times.length * .95)], max: times.at(-1) } };
fs.writeFileSync(`${directory}/checks.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
