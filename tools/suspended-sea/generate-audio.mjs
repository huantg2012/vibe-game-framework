/** Reproducible offline material synthesis, not field recordings or live oscillators.
 * Writes only the six suspended-sea keys; never regenerates legacy audio. */
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ffmpeg = resolve(root, 'tools/audio-placeholders/.bin/ffmpeg');
const ffprobe = resolve(root, 'tools/audio-placeholders/.bin/ffprobe');
const rate = 44100;
const recipes = [
  { key: 'amb-suspended-sea-pressure', kind: 'pressure', dir: 'ambient', seconds: 20, seed: 220901, loop: true, peak: .24 },
  { key: 'sfx-suspended-sea-gather', kind: 'gather', dir: 'sfx/system', seconds: 1.6, seed: 220902, loop: true, peak: .26 },
  { key: 'sfx-suspended-sea-fall', kind: 'fall', dir: 'sfx/system', seconds: .75, seed: 220903, loop: false, peak: .39 },
  { key: 'sfx-suspended-sea-contact', kind: 'contact', dir: 'sfx/system', seconds: 2.2, seed: 220904, loop: true, peak: .42 },
  { key: 'sfx-suspended-sea-drain', kind: 'drain', dir: 'sfx/system', seconds: .9, seed: 220905, loop: false, peak: .26 },
  { key: 'sfx-suspended-sea-shell-hit', kind: 'hit', dir: 'sfx/system', seconds: .28, seed: 220906, loop: false, peak: .62 },
];
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
function random(seed) { let n = seed >>> 0; return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; }; }
function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${binary}: ${result.stderr}`);
  return result.stdout;
}
function synthesize(recipe) {
  const count = Math.round(recipe.seconds * rate), data = new Float64Array(count);
  const rand = random(recipe.seed), phase = rand() * Math.PI * 2;
  let low = 0, middle = 0, high = 0, dcOutput = 0, previous = 0;
  const lowA = 1 - Math.exp(-2 * Math.PI * 95 / rate);
  const midA = 1 - Math.exp(-2 * Math.PI * 370 / rate);
  const highA = 1 - Math.exp(-2 * Math.PI * 3600 / rate);
  // Individually timed impulses, smoothed into grains rather than metronomic drops.
  const grains = [];
  const grainCount = recipe.kind === 'pressure' ? 13 : recipe.kind === 'contact' ? 19 : recipe.kind === 'gather' ? 23 : 7;
  for (let i = 0; i < grainCount; i++) grains.push({
    start: rand() * recipe.seconds, length: .013 + rand() * .074,
    gain: .18 + rand() * .6, frequency: 180 + rand() * 1200,
  });
  for (let i = 0; i < count; i++) {
    const t = i / rate, u = t / recipe.seconds, n = rand() * 2 - 1;
    low += lowA * (n - low); middle += midA * (n - middle); high += highA * (n - high);
    const body = (middle - low) * 2.3, friction = (high - middle) * .34;
    const resonance = Math.sin(t * Math.PI * 2 * 113 + phase) * .016
      + Math.sin(t * Math.PI * 2 * 77 + .37) * .012;
    let grain = 0;
    for (const g of grains) {
      const age = t - g.start;
      if (age >= 0 && age < g.length) {
        const e = Math.sin(age / g.length * Math.PI) ** 2;
        grain += e * g.gain * (friction + Math.sin(age * g.frequency * Math.PI * 2) * .04);
      }
    }
    let sample = 0;
    if (recipe.kind === 'pressure') {
      const breath = .82 + .1 * Math.sin(u * Math.PI * 4 + .7) + .06 * Math.sin(u * Math.PI * 10);
      sample = (body * .67 + low * .65 + resonance + friction * .047) * breath + grain * .035;
    } else if (recipe.kind === 'gather') {
      sample = body * .52 + friction * .17 + grain * .58 + resonance * .5;
    } else if (recipe.kind === 'fall') {
      const e = smooth(t / .12) * smooth((recipe.seconds - t) / .21);
      sample = (body * .9 + friction * .74) * e * (1 - .22 * u);
    } else if (recipe.kind === 'contact') {
      const pressure = .74 + .11 * Math.sin(u * Math.PI * 6 + .31) + .1 * Math.sin(u * Math.PI * 14);
      sample = (body * 1.05 + low * .55 + friction * .46) * pressure + grain * .47;
    } else if (recipe.kind === 'drain') {
      const e = smooth(t / .028) * (1 - smooth(u));
      sample = (body * .65 + friction * .42 + grain * .9) * e;
    } else {
      // Dry mineral resistance followed by a short loaded edge scrape; no bell.
      const crack = smooth(t / .0018) * Math.exp(-t * 75);
      const pressure = smooth(t / .007) * Math.exp(-t * 22);
      const scrape = smooth((t - .038) / .018) * smooth((recipe.seconds - t) / .06);
      sample = friction * crack * 3.2 + (body + low * .45) * pressure * 1.8
        + friction * scrape * .23;
    }
    // DC blocker retains the heavy low midrange without carrying a seam offset.
    const dc = sample - previous + .9993 * dcOutput;
    previous = sample; dcOutput = dc; data[i] = dc;
  }
  if (recipe.loop) {
    const seam = Math.round(rate * .024);
    // Equal-power circular blend connects the actual PCM endpoints. MP3 carries
    // gapless encoder metadata; OGG is the first browser source.
    for (let i = 0; i < seam; i++) {
      const u = smooth(i / (seam - 1));
      data[count - seam + i] = data[count - seam + i] * (1 - u) + data[i] * u;
    }
    data[count - 1] = data[0];
  } else {
    const fade = Math.round(rate * .004);
    for (let i = 0; i < fade; i++) { data[i] *= smooth(i / fade); data[count - 1 - i] *= smooth(i / fade); }
  }
  let maximum = 0;
  for (const value of data) maximum = Math.max(maximum, Math.abs(value));
  const gain = recipe.peak / Math.max(maximum, 1e-9);
  let squares = 0;
  for (let i = 0; i < data.length; i++) { data[i] *= gain; squares += data[i] ** 2; }
  return { data, peak: recipe.peak, rms: Math.sqrt(squares / data.length), seamDelta: Math.abs(data[0] - data.at(-1)) };
}
function wav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buffer;
}
const temp = resolve('/private/tmp/coh-suspended-sea-audio'); mkdirSync(temp, { recursive: true });
const report = { provenance: 'Deterministic offline procedural synthesis; no recordings or external generation models.', sampleRate: rate, channels: 1, recipes: [] };
for (const recipe of recipes) {
  const generated = synthesize(recipe), source = resolve(temp, `${recipe.key}.wav`);
  writeFileSync(source, wav(generated.data));
  const directory = resolve(root, 'assets/audio', recipe.dir), publicDir = resolve(root, 'public/assets/audio', recipe.dir);
  mkdirSync(directory, { recursive: true }); mkdirSync(publicDir, { recursive: true });
  const encoded = [];
  for (const format of ['ogg', 'mp3']) {
    const path = resolve(directory, `${recipe.key}.${format}`);
    run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-ac', '1', '-ar', String(rate),
      '-c:a', format === 'ogg' ? 'libvorbis' : 'libmp3lame', '-b:a', recipe.loop ? '96k' : '128k', path]);
    copyFileSync(path, resolve(publicDir, `${recipe.key}.${format}`));
    const probe = JSON.parse(run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels', '-of', 'json', path]));
    encoded.push({ format, bytes: readFileSync(path).length, duration: Number(probe.format.duration), ...probe.streams[0] });
  }
  report.recipes.push({ ...recipe, measuredPcmPeak: generated.peak, measuredPcmRms: generated.rms, measuredPcmSeamDelta: generated.seamDelta, encoded });
}
writeFileSync(resolve(root, 'tools/suspended-sea/audio-manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Generated and decoded ${recipes.length} sea sounds in two formats. Listening review remains separate.`);
