import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(root, 'tools/suspended-sea/audio-manifest.json'), 'utf8'));
assert.equal(manifest.recipes.length, 6);
assert.equal(new Set(manifest.recipes.map(recipe => recipe.key)).size, 6);
const ffmpeg = resolve(root, 'tools/audio-placeholders/.bin/ffmpeg');
let checks = 0;
const rows = [];
for (const recipe of manifest.recipes) {
  assert.equal(recipe.loop ? recipe.measuredPcmSeamDelta : 0, 0);
  for (const format of ['ogg', 'mp3']) {
    const path = resolve(root, 'assets/audio', recipe.dir, `${recipe.key}.${format}`);
    const bytes = readFileSync(path), publicBytes = readFileSync(resolve(root, 'public/assets/audio', recipe.dir, `${recipe.key}.${format}`));
    assert.deepEqual(bytes, publicBytes, 'public and source audio must be byte-identical');
    const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', '44100', 'pipe:1'], { maxBuffer: 8 * 1024 * 1024 });
    assert.equal(decoded.status, 0, decoded.stderr.toString());
    const samples = decoded.stdout.length / 4;
    assert(Math.abs(samples / 44100 - recipe.seconds) < .04, 'decoded clip duration');
    let peak = 0, sum = 0, maximumStep = 0, previous = decoded.stdout.readFloatLE(0);
    for (let i = 0; i < samples; i++) {
      const sample = decoded.stdout.readFloatLE(i * 4);
      assert(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
      maximumStep = Math.max(maximumStep, Math.abs(sample - previous)); previous = sample;
    }
    const rms = Math.sqrt(sum / samples), seam = Math.abs(decoded.stdout.readFloatLE(0) - decoded.stdout.readFloatLE((samples - 1) * 4));
    assert(peak < .9 && peak > .05 && rms > .009, 'decodable nonempty headroom, not silence');
    if (recipe.loop) assert(seam < maximumStep, 'loop seam cannot exceed the loudest within-clip adjacent sample change');
    rows.push({ key: recipe.key, format, seconds: samples / 44100, peak, rms, seam, maximumStep,
      sha256: createHash('sha256').update(bytes).digest('hex') });
    checks++;
  }
}
console.log(JSON.stringify({ checks, source: 'offline deterministic procedural synthesis', decoded: rows }, null, 2));
console.log('PASS 12 assets: source/public hashes, actual decode, duration, headroom and bounded loop seams. Listening is separate.');
