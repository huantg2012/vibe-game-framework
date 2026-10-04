/** Browser decoder check of the repaired loop boundary; not an audibility test. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03-i06/audio-mix/loop-browser');
fs.mkdirSync(out, { recursive: true });
const keys = ['bgm/bgm-rift-base-drone', 'bgm/bgm-rift-high-chaos', 'bgm/bgm-rift-threat', 'ambient/amb-rift-proximity', 'ambient/amb-rift-alien-atmosphere', 'sfx/enemy/sfx-rift-enemy-idle', 'sfx/enemy/sfx-rift-enemy-overwriter-hum'];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage();
  await page.goto((process.env.GAME_URL ?? 'http://127.0.0.1:3083') + '/');
  const rows = await page.evaluate(async keys => {
    const ctx = new AudioContext({ sampleRate: 44100 }), rows = [];
    for (const key of keys) for (const ext of ['ogg', 'mp3']) {
      const b = await ctx.decodeAudioData(await (await fetch(`/assets/audio/${key}.${ext}`)).arrayBuffer());
      let seam = 0, maxStep = 0, peak = 0, squares = 0, n = 0;
      for (let channel = 0; channel < b.numberOfChannels; channel++) {
        const d = b.getChannelData(channel); seam = Math.max(seam, Math.abs(d[0] - d.at(-1)));
        for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); squares += d[i] ** 2; n++; if (i) maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1])); }
      }
      rows.push({ key, ext, duration: b.duration, frames: b.length, sampleRate: b.sampleRate, seam, maxStep, peak, rms: Math.sqrt(squares / n) });
    }
    await ctx.close(); return rows;
  }, keys);
  const hashes = [];
  for (const key of keys) for (const ext of ['ogg', 'mp3']) {
    const file = `${key}.${ext}`, source = fs.readFileSync(`assets/audio/${file}`), deployed = fs.readFileSync(`public/assets/audio/${file}`);
    assert(source.equals(deployed), file + ' public copy differs');
    hashes.push({ file, sha256: createHash('sha256').update(source).digest('hex') });
  }
  const before = JSON.parse(fs.readFileSync('docs/qa/artifacts/r100-i03-i06/audio-mix/before/assets.json', 'utf8'));
  const comparisons = rows.filter(r => r.ext === 'ogg').map(row => { const old = before.find(b => `${b.dir}/${b.key}` === row.key); return { key: row.key, beforeSeam: old.seam, afterSeam: row.seam, rmsDeltaDb: 20 * Math.log10(row.rms / old.rms) }; });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ method: 'Actual Chrome WebAudio decoding of both shipping codecs at 44.1kHz. Seam sample jump must not exceed an internal adjacent sample jump; RMS delta bounded. This detects a digital discontinuity, not perceived sound quality.', rows, hashes, comparisons }, null, 2));
  for (const row of rows) { assert(row.seam <= row.maxStep, row.key + ' ' + row.ext + ' seam is larger than ordinary maximum sample step'); assert(row.peak < 1, row.key + ' clipped'); }
  for (const row of comparisons) assert(Math.abs(row.rmsDeltaDb) < .15, row.key + ' level changed beyond seam treatment');
  console.log(JSON.stringify({ codecCases: rows.length, comparisons }));
} finally { await browser.close(); }
