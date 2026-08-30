/**
 * Slice 9 A1/C1: synthesize placeholder keys as non-empty OGG + MP3.
 *
 * Prefers sox (if on PATH) is not required: Homebrew is broken on this macOS,
 * so synthesis uses ffmpeg lavfi (sine / anoisesrc) then libvorbis + libmp3lame.
 * If ffmpeg/sox are later installed via brew, PATH binaries win over the local .bin.
 *
 * Usage: node tools/audio-placeholders/generate.mjs [--verify]
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const ASSET_ROOT = join(ROOT, 'assets/audio');
const PUBLIC_ROOT = join(ROOT, 'public/assets/audio');
const TMP = join(__dirname, '.tmp/work');
const LOCAL_BIN = join(__dirname, '.bin');

const KEYS = [
  { key: 'bgm-menu-void-pad', dir: 'bgm', seconds: 90, peak: -6, bitrate: 128, kind: 'bed-menu' },
  { key: 'bgm-pp-isolation-drone', dir: 'bgm', seconds: 120, peak: -6, bitrate: 128, kind: 'bed-pp' },
  { key: 'bgm-rift-base-drone', dir: 'bgm', seconds: 120, peak: -6, bitrate: 128, kind: 'bed-rift-base' },
  { key: 'bgm-rift-high-chaos', dir: 'bgm', seconds: 120, peak: -6, bitrate: 128, kind: 'bed-rift-tension' },
  { key: 'bgm-rift-threat', dir: 'bgm', seconds: 120, peak: -6, bitrate: 128, kind: 'bed-rift-threat' },
  { key: 'amb-rift-proximity', dir: 'ambient', seconds: 120, peak: -9, bitrate: 96, kind: 'bed-proximity' },
  { key: 'bgm-impact-pressure', dir: 'bgm', seconds: 72, peak: -6, bitrate: 128, kind: 'bed-impact' },
  { key: 'amb-pp-mechanical-hum', dir: 'ambient', seconds: 120, peak: -9, bitrate: 96, kind: 'amb-pp' },
  { key: 'amb-rift-alien-atmosphere', dir: 'ambient', seconds: 120, peak: -9, bitrate: 96, kind: 'amb-rift' },

  { key: 'sfx-ui-click', dir: 'sfx/ui', seconds: 0.08, peak: -3, bitrate: 128, kind: 'ui-click' },
  { key: 'sfx-ui-hover', dir: 'sfx/ui', seconds: 0.03, peak: -3, bitrate: 128, kind: 'ui-hover' },
  { key: 'sfx-ui-open', dir: 'sfx/ui', seconds: 0.25, peak: -3, bitrate: 128, kind: 'ui-open' },
  { key: 'sfx-ui-close', dir: 'sfx/ui', seconds: 0.18, peak: -3, bitrate: 128, kind: 'ui-close' },
  { key: 'sfx-ui-allocate', dir: 'sfx/ui', seconds: 0.35, peak: -3, bitrate: 128, kind: 'ui-allocate' },
  { key: 'sfx-ui-warning', dir: 'sfx/ui', seconds: 0.40, peak: -3, bitrate: 128, kind: 'ui-warning' },
  { key: 'sfx-ui-error', dir: 'sfx/ui', seconds: 0.10, peak: -3, bitrate: 128, kind: 'ui-error' },

  { key: 'sfx-shared-player-step-metal', dir: 'sfx/player', seconds: 0.15, peak: -4, bitrate: 128, kind: 'step-metal' },
  { key: 'sfx-shared-player-step-organic', dir: 'sfx/player', seconds: 0.15, peak: -4, bitrate: 128, kind: 'step-organic' },
  { key: 'sfx-shared-player-step-crystal', dir: 'sfx/player', seconds: 0.15, peak: -4, bitrate: 128, kind: 'step-crystal' },
  { key: 'sfx-shared-player-hurt', dir: 'sfx/player', seconds: 0.30, peak: -4, bitrate: 128, kind: 'player-hurt' },
  { key: 'sfx-shared-player-attack', dir: 'sfx/player', seconds: 0.25, peak: -4, bitrate: 128, kind: 'player-attack' },
  { key: 'sfx-shared-player-pickup', dir: 'sfx/player', seconds: 0.15, peak: -4, bitrate: 128, kind: 'player-pickup' },
  { key: 'sfx-shared-player-use-item', dir: 'sfx/player', seconds: 0.30, peak: -4, bitrate: 128, kind: 'player-use' },
  { key: 'sfx-shared-player-search-loop', dir: 'sfx/player', seconds: 1.20, peak: -8, bitrate: 128, kind: 'search-loop' },
  { key: 'sfx-shared-player-search-interrupt', dir: 'sfx/player', seconds: 0.18, peak: -6, bitrate: 128, kind: 'search-interrupt' },
  { key: 'sfx-shared-player-search-reveal-kindling', dir: 'sfx/player', seconds: 0.28, peak: -4, bitrate: 128, kind: 'search-reveal-kindling' },
  { key: 'sfx-shared-player-search-reveal-residue', dir: 'sfx/player', seconds: 0.32, peak: -5, bitrate: 128, kind: 'search-reveal-residue' },

  { key: 'sfx-rift-enemy-idle', dir: 'sfx/enemy', seconds: 1.5, peak: -6, bitrate: 128, kind: 'enemy-idle' },
  { key: 'sfx-rift-enemy-overwriter-hum', dir: 'sfx/enemy', seconds: 2.0, peak: -6, bitrate: 128, kind: 'enemy-hum' },
  { key: 'sfx-rift-enemy-alert', dir: 'sfx/enemy', seconds: 0.40, peak: -6, bitrate: 128, kind: 'enemy-alert' },
  { key: 'sfx-rift-enemy-chase', dir: 'sfx/enemy', seconds: 0.50, peak: -6, bitrate: 128, kind: 'enemy-chase' },
  { key: 'sfx-rift-enemy-hit', dir: 'sfx/enemy', seconds: 0.20, peak: -6, bitrate: 128, kind: 'enemy-hit' },
  { key: 'sfx-rift-enemy-die', dir: 'sfx/enemy', seconds: 0.65, peak: -6, bitrate: 128, kind: 'enemy-die' },

  { key: 'sfx-rift-enter', dir: 'sfx/system', seconds: 1.20, peak: -4, bitrate: 128, kind: 'rift-enter' },
  { key: 'sfx-rift-exit', dir: 'sfx/system', seconds: 0.90, peak: -4, bitrate: 128, kind: 'rift-exit' },
  { key: 'sfx-shared-chaos-tick', dir: 'sfx/system', seconds: 0.05, peak: -4, bitrate: 128, kind: 'chaos-tick' },
  { key: 'sfx-shared-chaos-threshold', dir: 'sfx/system', seconds: 0.50, peak: -4, bitrate: 128, kind: 'chaos-threshold' },
  { key: 'sfx-impact-start', dir: 'sfx/system', seconds: 1.50, peak: -4, bitrate: 128, kind: 'impact-start' },
  { key: 'sfx-impact-hit', dir: 'sfx/system', seconds: 0.50, peak: -4, bitrate: 128, kind: 'impact-hit' },
  { key: 'sfx-impact-survive', dir: 'sfx/system', seconds: 0.30, peak: -4, bitrate: 128, kind: 'impact-survive' },
  { key: 'sfx-impact-break', dir: 'sfx/system', seconds: 0.80, peak: -4, bitrate: 128, kind: 'impact-break' },
  { key: 'sfx-shared-module-repair', dir: 'sfx/system', seconds: 0.50, peak: -4, bitrate: 128, kind: 'module-repair' },
  { key: 'sfx-pp-boundary-pulse', dir: 'sfx/system', seconds: 1.50, peak: -4, bitrate: 128, kind: 'boundary-pulse' },
];

if (KEYS.length !== 43) {
  throw new Error(`Expected 43 keys, got ${KEYS.length}`);
}

function which(name) {
  const pathEnv = process.env.PATH ?? '';
  for (const dir of pathEnv.split(':')) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveTool(name) {
  return which(name) ?? (existsSync(join(LOCAL_BIN, name)) ? join(LOCAL_BIN, name) : null);
}

const FFMPEG = resolveTool('ffmpeg');
const FFPROBE = resolveTool('ffprobe');
const SOX = resolveTool('sox');

function run(bin, args, opts = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...opts,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').slice(-2000);
    throw new Error(`${bin} ${args[0] ?? ''} failed (${result.status}): ${err}`);
  }
  return result;
}

function ffmpeg(args) {
  if (!FFMPEG) throw new Error('ffmpeg not found');
  return run(FFMPEG, ['-hide_banner', '-loglevel', 'error', ...args]);
}

function lavfi(expr) {
  return ['-f', 'lavfi', '-i', expr];
}

function noiseSrc(color, seconds, amplitude = 1) {
  return `anoisesrc=color=${color}:sample_rate=44100:duration=${seconds}:amplitude=${amplitude}`;
}

function sineSrc(freq, seconds) {
  return `sine=frequency=${freq}:sample_rate=44100:duration=${seconds}`;
}

function sweepSrc(f0, f1, seconds) {
  const k = (f1 - f0) / (2 * seconds);
  return `aevalsrc=sin(2*PI*(${f0}*t+${k}*t*t)):s=44100:d=${seconds}`;
}

function band(lo, hi) {
  return `highpass=f=${lo},lowpass=f=${hi}`;
}

function mixFilter(n) {
  return `amix=inputs=${n}:duration=longest:dropout_transition=0:normalize=0`;
}

function chainHpLp(extra = '') {
  return `highpass=f=30,lowpass=f=16000${extra ? `,${extra}` : ''}`;
}

function writeWav(outPath, inputs, filter, extraOut = []) {
  const args = ['-y'];
  for (const input of inputs) args.push(...input);
  args.push('-filter_complex', filter, '-map', '[out]', '-ac', '1', '-ar', '44100', ...extraOut, outPath);
  ffmpeg(args);
}

function peakDb(wavPath) {
  const result = spawnSync(FFMPEG, [
    '-hide_banner', '-i', wavPath, '-af', 'volumedetect', '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const text = `${result.stderr}\n${result.stdout}`;
  const match = text.match(/max_volume:\s*([-\d.]+)\s*dB/);
  if (!match) throw new Error(`volumedetect failed for ${wavPath}: ${text.slice(-500)}`);
  return Number(match[1]);
}

function normalizeTo(wavPath, targetDb) {
  const max = peakDb(wavPath);
  if (!Number.isFinite(max) || max < -80) {
    throw new Error(`${wavPath} is effectively silent (peak ${max} dB)`);
  }
  const gain = targetDb - max;
  const tmp = `${wavPath}.norm.wav`;
  ffmpeg(['-y', '-i', wavPath, '-af', `volume=${gain}dB`, '-ac', '1', '-ar', '44100', tmp]);
  copyFileSync(tmp, wavPath);
  rmSync(tmp, { force: true });
}

function encodePair(wavPath, destDir, key, bitrate) {
  mkdirSync(destDir, { recursive: true });
  const ogg = join(destDir, `${key}.ogg`);
  const mp3 = join(destDir, `${key}.mp3`);
  ffmpeg(['-y', '-i', wavPath, '-c:a', 'libvorbis', '-b:a', `${bitrate}k`, '-ac', '1', '-ar', '44100', ogg]);
  ffmpeg(['-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, '-ac', '1', '-ar', '44100', mp3]);
  const oggSize = statSync(ogg).size;
  const mp3Size = statSync(mp3).size;
  if (oggSize <= 0 || mp3Size <= 0) {
    throw new Error(`${key} encoded to empty file (ogg=${oggSize} mp3=${mp3Size})`);
  }
  mkdirSync(join(PUBLIC_ROOT, destDir.slice(ASSET_ROOT.length + 1) || '.'), { recursive: true });
  const relDir = destDir.slice(ASSET_ROOT.length + 1);
  const pubDir = join(PUBLIC_ROOT, relDir);
  mkdirSync(pubDir, { recursive: true });
  copyFileSync(ogg, join(pubDir, `${key}.ogg`));
  copyFileSync(mp3, join(pubDir, `${key}.mp3`));
}

function renderSineStack(outPath, seconds, sines, noise, opts = {}) {
  const inputs = [];
  const parts = [];
  sines.forEach((sine, i) => {
    inputs.push(lavfi(sineSrc(sine.f, seconds)));
    parts.push(`[${i}]volume=${sine.amp}[s${i}]`);
  });
  const noiseIndex = sines.length;
  inputs.push(lavfi(noiseSrc(noise.color, seconds)));
  let noiseChain = `[${noiseIndex}]`;
  if (noise.lowpass) noiseChain += `lowpass=f=${noise.lowpass},`;
  if (noise.highpass) noiseChain += `highpass=f=${noise.highpass},`;
  if (noise.band) noiseChain += `${band(noise.band[0], noise.band[1])},`;
  if (noise.edgeFade) {
    const startOut = Math.max(0, seconds - noise.edgeFade);
    noiseChain += `afade=t=in:d=${noise.edgeFade}:curve=tri,afade=t=out:st=${startOut}:d=${noise.edgeFade}:curve=tri,`;
  }
  noiseChain += `volume=${noise.amp}[n]`;
  parts.push(noiseChain);

  const mixIns = [...sines.map((_, i) => `[s${i}]`), '[n]'].join('');
  let post = chainHpLp(opts.post ?? '');
  if (opts.fadeIn) post += `,afade=t=in:d=${opts.fadeIn}:curve=tri`;
  if (opts.fadeOut) {
    const st = Math.max(0, seconds - opts.fadeOut);
    post += `,afade=t=out:st=${st}:d=${opts.fadeOut}:curve=tri`;
  }
  if (opts.tremolo) post += `,tremolo=f=${opts.tremolo.f}:d=${opts.tremolo.d}`;
  const filter = `${parts.join(';')};${mixIns}${mixFilter(sines.length + 1)},${post}[out]`;
  writeWav(outPath, inputs, filter);
}

function renderNoise(outPath, seconds, color, amp, fadeIn, extraAf, extraInputs = []) {
  const inputs = [lavfi(noiseSrc(color, seconds)), ...extraInputs];
  let af = `volume=${amp}`;
  if (extraAf) af = `${extraAf},${af}`;
  if (fadeIn) af += `,afade=t=in:d=${fadeIn}:curve=tri`;
  const fadeOut = Math.min(seconds * 0.5, Math.max(0.02, seconds - fadeIn - 0.005));
  const st = Math.max(0, seconds - fadeOut);
  af += `,afade=t=out:st=${st.toFixed(4)}:d=${fadeOut.toFixed(4)}:curve=tri,${chainHpLp()}`;
  writeWav(outPath, inputs, `[0]${af}[out]`);
}

function overlayAt(baseWav, overlayWav, times, outPath, overlayAmp = 1) {
  const inputs = [['-i', baseWav], ['-i', overlayWav]];
  const splits = times.map((_, i) => `[c${i}]`);
  const delayed = times.map((t, i) => `[c${i}]adelay=${Math.round(t * 1000)}:all=1,volume=${overlayAmp}[d${i}]`);
  const mixIns = ['[0]', ...times.map((_, i) => `[d${i}]`)].join('');
  const filter = `[1]asplit=${times.length}${splits.join('')};${delayed.join(';')};${mixIns}${mixFilter(times.length + 1)}[out]`;
  writeWav(outPath, inputs, filter);
}

function makeClick(outPath, seconds, lo, hi, fadeIn, fadeOutStart) {
  const fadeOutDur = Math.max(0.01, seconds - fadeOutStart);
  writeWav(outPath, [lavfi(noiseSrc('white', seconds))], `[0]${band(lo, hi)},afade=t=in:d=${fadeIn}:curve=tri,afade=t=out:st=${fadeOutStart}:d=${fadeOutDur}:curve=tri,${chainHpLp()}[out]`);
}

function synthesize(entry, wavPath) {
  const d = entry.seconds;
  switch (entry.kind) {
    case 'bed-menu':
      renderSineStack(wavPath, d, [
        { f: 41, amp: 0.16 },
        { f: 41.5, amp: 0.12 },
      ], { color: 'brown', amp: 0.03, lowpass: 150, edgeFade: 0.2 });
      break;
    case 'bed-pp':
      renderSineStack(wavPath, d, [
        { f: 55, amp: 0.28 },
        { f: 57.2, amp: 0.22 },
        { f: 62, amp: 0.12 },
        { f: 110, amp: 0.05 },
      ], { color: 'brown', amp: 0.04, lowpass: 180, edgeFade: 0.2 });
      break;
    case 'bed-rift-base': {
      const tmp = `${wavPath}.pre.wav`;
      renderSineStack(tmp, d, [
        { f: 48, amp: 0.26 },
        { f: 50.5, amp: 0.22 },
        { f: 53.3, amp: 0.16 },
      ], { color: 'brown', amp: 0.10, lowpass: 350, edgeFade: 0.2 });
      writeWav(wavPath, [['-i', tmp], lavfi(noiseSrc('pink', d))], `[1]${band(4000, 6000)},volume=0.02,afade=t=in:d=0.2,afade=t=out:st=${d - 0.2}:d=0.2[n];[0][n]${mixFilter(2)},${chainHpLp()}[out]`);
      rmSync(tmp, { force: true });
      break;
    }
    case 'bed-rift-tension': {
      const tmp = `${wavPath}.pre.wav`;
      renderSineStack(tmp, d, [
        { f: 58, amp: 0.24 },
        { f: 62.5, amp: 0.22 },
        { f: 67, amp: 0.18 },
      ], { color: 'brown', amp: 0.18, lowpass: 800, edgeFade: 0.2 });
      writeWav(wavPath, [['-i', tmp], lavfi(noiseSrc('pink', d))], `[1]highpass=f=200,lowpass=f=4000,volume=0.08,afade=t=in:d=0.2,afade=t=out:st=${d - 0.2}:d=0.2[n];[0][n]${mixFilter(2)},${chainHpLp()}[out]`);
      rmSync(tmp, { force: true });
      break;
    }
    case 'bed-rift-threat':
      renderSineStack(wavPath, d, [
        { f: 187, amp: 0.07 },
        { f: 193, amp: 0.06 },
      ], { color: 'pink', amp: 0.12, band: [2500, 6000], edgeFade: 0.2 });
      break;
    case 'bed-proximity':
      renderSineStack(wavPath, d, [{ f: 73, amp: 0.10 }], { color: 'brown', amp: 0.16, band: [180, 280], edgeFade: 0.2 });
      break;
    case 'bed-impact':
      renderSineStack(wavPath, d, [
        { f: 40, amp: 0.22 },
        { f: 41.5, amp: 0.18 },
      ], { color: 'brown', amp: 0.12, lowpass: 200, edgeFade: 0 }, {
        fadeIn: 2.0,
        fadeOut: 4.0,
        tremolo: { f: 0.7, d: 0.45 },
      });
      break;
    case 'amb-pp': {
      const bed = `${wavPath}.bed.wav`;
      const click = `${wavPath}.click.wav`;
      renderSineStack(bed, d, [
        { f: 60, amp: 0.22 },
        { f: 120, amp: 0.08 },
      ], { color: 'brown', amp: 0.10, lowpass: 100, edgeFade: 0.2 });
      writeWav(click, [lavfi(noiseSrc('white', 0.08))], `[0]${band(1200, 2500)},afade=t=in:d=0.04:curve=tri,afade=t=out:st=0.04:d=0.04:curve=tri,volume=0.06[out]`);
      overlayAt(bed, click, [18, 41, 63, 88, 109], wavPath, 1);
      rmSync(bed, { force: true });
      rmSync(click, { force: true });
      break;
    }
    case 'amb-rift': {
      const bed = `${wavPath}.bed.wav`;
      const ping = `${wavPath}.ping.wav`;
      renderSineStack(bed, d, [
        { f: 41, amp: 0.10 },
        { f: 44, amp: 0.08 },
      ], { color: 'pink', amp: 0.14, lowpass: 900, edgeFade: 0.2 });
      writeWav(ping, [lavfi(noiseSrc('pink', 0.09))], `[0]${band(3000, 4000)},afade=t=in:d=0.04:curve=tri,afade=t=out:st=0.05:d=0.04:curve=tri,volume=0.04[out]`);
      overlayAt(bed, ping, [25, 58, 97], wavPath, 1);
      rmSync(bed, { force: true });
      rmSync(ping, { force: true });
      break;
    }
    case 'ui-click':
      makeClick(wavPath, d, 2200, 4500, 0.008, 0.03);
      break;
    case 'ui-hover':
      makeClick(wavPath, d, 3000, 5000, 0.006, 0.01);
      break;
    case 'ui-open':
      writeWav(wavPath, [lavfi(noiseSrc('pink', d))], `[0]${band(800, 2500)},afade=t=in:d=0.01:curve=tri,afade=t=out:st=0.12:d=0.13:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'ui-close':
      writeWav(wavPath, [lavfi(noiseSrc('pink', d))], `[0]${band(1200, 2800)},afade=t=in:d=0.01:curve=tri,afade=t=out:st=0.08:d=0.10:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'ui-allocate': {
      const low = `${wavPath}.low.wav`;
      const clk = `${wavPath}.clk.wav`;
      writeWav(low, [lavfi(noiseSrc('brown', d))], `[0]lowpass=f=200,volume=0.2,afade=t=in:d=0.012:curve=tri,afade=t=out:st=0.22:d=0.13:curve=tri[out]`);
      makeClick(clk, 0.08, 2200, 4500, 0.008, 0.03);
      writeWav(wavPath, [['-i', low], ['-i', clk]], `[1]adelay=220:all=1,volume=0.5[c];[0][c]${mixFilter(2)},${chainHpLp()}[out]`);
      rmSync(low, { force: true });
      rmSync(clk, { force: true });
      break;
    }
    case 'ui-warning': {
      const pulse = `${wavPath}.p.wav`;
      renderSineStack(pulse, 0.16, [
        { f: 68, amp: 0.15 },
        { f: 71, amp: 0.15 },
      ], { color: 'brown', amp: 0.12, lowpass: 180, edgeFade: 0 }, { fadeIn: 0.04, fadeOut: 0.04 });
      writeWav(wavPath, [['-i', pulse], ['-i', pulse]], `[1]adelay=220:all=1,volume=0.65[p2];[0][p2]${mixFilter(2)},afade=t=in:d=0.04:curve=tri,apad=whole_dur=0.40,atrim=0:0.40[out]`);
      rmSync(pulse, { force: true });
      break;
    }
    case 'ui-error':
      makeClick(wavPath, d, 900, 1800, 0.008, 0.04);
      break;
    case 'step-metal':
      writeWav(wavPath, [lavfi(noiseSrc('pink', d))], `[0]${band(250, 800)},aecho=0.8:0.65:28:0.2,afade=t=in:d=0.008:curve=tri,afade=t=out:st=0.07:d=0.08:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'step-organic':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d))], `[0]lowpass=f=500,asetrate=44100*0.92,aresample=44100,afade=t=in:d=0.012:curve=tri,afade=t=out:st=0.06:d=0.09:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'step-crystal':
      writeWav(wavPath, [lavfi(noiseSrc('pink', d))], `[0]${band(1600, 3800)},aecho=0.8:0.5:18:0.15,afade=t=in:d=0.006:curve=tri,afade=t=out:st=0.05:d=0.10:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'player-hurt':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d)), lavfi(noiseSrc('pink', d))], `[0]lowpass=f=250,volume=0.8[a];[1]highpass=f=1500,volume=0.25[b];[a][b]${mixFilter(2)},afade=t=in:d=0.012:curve=tri,afade=t=out:st=0.12:d=0.18:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'player-attack':
      writeWav(wavPath, [lavfi(noiseSrc('pink', d))], `[0]${band(400, 1200)},afade=t=in:d=0.01:curve=tri,afade=t=out:st=0.08:d=0.17:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'player-pickup':
      makeClick(wavPath, d, 1000, 2400, 0.008, 0.05);
      break;
    case 'player-use':
      writeWav(wavPath, [lavfi(noiseSrc('pink', d))], `[0]highpass=f=400,afade=t=in:d=0.015:curve=tri,afade=t=out:st=0.12:d=0.18:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'search-loop':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d)), lavfi(noiseSrc('pink', d))], `[0]lowpass=f=700,volume=0.55[a];[1]${band(400, 1400)},volume=0.22[b];[a][b]${mixFilter(2)},afade=t=in:d=0.025:curve=tri,afade=t=out:st=1.05:d=0.15:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'search-interrupt':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d))], `[0]lowpass=f=500,afade=t=in:d=0.02:curve=tri,afade=t=out:st=0.05:d=0.13:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'search-reveal-kindling': {
      const click = `${wavPath}.c.wav`;
      const ping = `${wavPath}.p.wav`;
      makeClick(click, 0.12, 1800, 4200, 0.012, 0.04);
      writeWav(ping, [lavfi(sineSrc(1760, d))], `[0]volume=0.18,afade=t=in:d=0.02:curve=tri,afade=t=out:st=0.08:d=0.20:curve=tri[out]`);
      writeWav(wavPath, [['-i', click], ['-i', ping]], `[0]volume=0.7[a];[1]volume=0.55[b];[a][b]${mixFilter(2)},${chainHpLp()}[out]`);
      rmSync(click, { force: true });
      rmSync(ping, { force: true });
      break;
    }
    case 'search-reveal-residue':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d)), lavfi(sineSrc(220, d))], `[0]lowpass=f=380,volume=0.7[a];[1]volume=0.12,afade=t=in:d=0.02:curve=tri[b];[a][b]${mixFilter(2)},afade=t=in:d=0.02:curve=tri,afade=t=out:st=0.14:d=0.18:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'enemy-idle':
      renderSineStack(wavPath, d, [
        { f: 72, amp: 0.20 },
        { f: 76.5, amp: 0.16 },
      ], { color: 'brown', amp: 0.08, lowpass: 250, edgeFade: 0.04 }, { tremolo: { f: 1.2, d: 0.12 } });
      break;
    case 'enemy-hum':
      renderSineStack(wavPath, d, [
        { f: 36, amp: 0.28 },
        { f: 38.5, amp: 0.24 },
        { f: 41, amp: 0.14 },
      ], { color: 'brown', amp: 0.10, lowpass: 80, edgeFade: 0.08 });
      break;
    case 'enemy-alert': {
      const s1 = `${wavPath}.s1.wav`;
      const s2 = `${wavPath}.s2.wav`;
      const n = `${wavPath}.n.wav`;
      writeWav(s1, [lavfi(sweepSrc(72, 96, d))], `[0]volume=0.18,afade=t=in:d=0.04:curve=tri[out]`);
      writeWav(s2, [lavfi(sweepSrc(80, 108, d))], `[0]volume=0.16,afade=t=in:d=0.04:curve=tri[out]`);
      writeWav(n, [lavfi(noiseSrc('pink', d))], `[0]volume=0.12,afade=t=in:d=0.04:curve=tri[out]`);
      writeWav(wavPath, [['-i', s1], ['-i', s2], ['-i', n]], `[0][1][2]${mixFilter(3)},lowpass=f=900,${chainHpLp()},afade=t=out:st=0.28:d=0.12:curve=tri[out]`);
      rmSync(s1, { force: true });
      rmSync(s2, { force: true });
      rmSync(n, { force: true });
      break;
    }
    case 'enemy-chase': {
      const pulse = `${wavPath}.p.wav`;
      writeWav(pulse, [lavfi(noiseSrc('brown', 0.08))], `[0]lowpass=f=400,afade=t=in:d=0.02:curve=tri,afade=t=out:st=0.04:d=0.04:curve=tri[out]`);
      writeWav(wavPath, [['-i', pulse], ['-i', pulse]], `[1]adelay=250:all=1[p2];[0][p2]${mixFilter(2)},apad=whole_dur=0.50,atrim=0:0.50,afade=t=out:st=0.42:d=0.08:curve=tri,${chainHpLp()}[out]`);
      rmSync(pulse, { force: true });
      break;
    }
    case 'enemy-hit':
      writeWav(wavPath, [lavfi(noiseSrc('white', d)), lavfi(noiseSrc('brown', d))], `[0]${band(600, 3000)},volume=0.5[a];[1]volume=0.4[b];[a][b]${mixFilter(2)},afade=t=in:d=0.008:curve=tri,afade=t=out:st=0.06:d=0.14:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'enemy-die':
      writeWav(wavPath, [lavfi(sweepSrc(110, 36, d)), lavfi(noiseSrc('brown', d))], `[0]volume=0.22,afade=t=in:d=0.04:curve=tri[s];[1]volume=0.16,afade=t=in:d=0.04:curve=tri[n];[s][n]${mixFilter(2)},afade=t=out:st=0.30:d=0.35:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'rift-enter':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d)), lavfi(noiseSrc('pink', d)), lavfi(sweepSrc(40, 400, d))], `[0]volume=0.35[a];[1]volume=0.22[b];[2]volume=0.08[s];[a][b][s]${mixFilter(3)},afade=t=in:d=0.04:curve=tri,afade=t=out:st=0.7:d=0.5:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'rift-exit':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d)), lavfi(noiseSrc('pink', d)), lavfi(sweepSrc(400, 50, d))], `[0]volume=0.32[a];[1]volume=0.20[b];[2]volume=0.08[s];[a][b][s]${mixFilter(3)},afade=t=in:d=0.04:curve=tri,afade=t=out:st=0.45:d=0.45:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'chaos-tick':
      writeWav(wavPath, [lavfi(noiseSrc('white', d))], `[0]${band(5500, 7000)},volume=0.063,afade=t=in:d=0.006:curve=tri,afade=t=out:st=0.02:d=0.03:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'chaos-threshold':
      renderSineStack(wavPath, d, [
        { f: 55, amp: 0.22 },
        { f: 58, amp: 0.20 },
      ], { color: 'brown', amp: 0.14, lowpass: 200, edgeFade: 0 }, { fadeIn: 0.04, fadeOut: 0.12 });
      break;
    case 'impact-start':
      renderSineStack(wavPath, d, [
        { f: 32, amp: 0.22 },
        { f: 34, amp: 0.20 },
      ], { color: 'brown', amp: 0.16, lowpass: 120, edgeFade: 0 }, { fadeIn: 0.08, fadeOut: 0.4 });
      break;
    case 'impact-hit': {
      const body = `${wavPath}.b.wav`;
      const crack = `${wavPath}.c.wav`;
      writeWav(body, [lavfi(noiseSrc('brown', d))], `[0]lowpass=f=400,afade=t=in:d=0.04:curve=tri,afade=t=out:st=0.22:d=0.28:curve=tri[out]`);
      writeWav(crack, [lavfi(noiseSrc('white', 0.08))], `[0]${band(800, 2400)},afade=t=in:d=0.01:curve=tri,afade=t=out:st=0.03:d=0.05:curve=tri[out]`);
      writeWav(wavPath, [['-i', body], ['-i', crack]], `[1]adelay=180:all=1,volume=0.45[c];[0][c]${mixFilter(2)},${chainHpLp()}[out]`);
      rmSync(body, { force: true });
      rmSync(crack, { force: true });
      break;
    }
    case 'impact-survive':
      writeWav(wavPath, [lavfi(noiseSrc('pink', d))], `[0]lowpass=f=1200,afade=t=in:d=0.012:curve=tri,afade=t=out:st=0.08:d=0.22:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'impact-break':
      writeWav(wavPath, [lavfi(noiseSrc('brown', d)), lavfi(noiseSrc('pink', d)), lavfi(sweepSrc(90, 28, d))], `[0]lowpass=f=350,volume=0.5,afade=t=in:d=0.04:curve=tri[a];[1]highpass=f=1800,volume=0.12[b];[2]volume=0.12[s];[a][b][s]${mixFilter(3)},afade=t=out:st=0.35:d=0.45:curve=tri,${chainHpLp()}[out]`);
      break;
    case 'module-repair': {
      const hiss = `${wavPath}.h.wav`;
      const clunk = `${wavPath}.k.wav`;
      writeWav(hiss, [lavfi(noiseSrc('pink', 0.35))], `[0]${band(1200, 3000)},afade=t=in:d=0.015:curve=tri,afade=t=out:st=0.22:d=0.13:curve=tri[out]`);
      writeWav(clunk, [lavfi(noiseSrc('pink', 0.10))], `[0]${band(250, 800)},aecho=0.8:0.65:22:0.18,afade=t=in:d=0.008:curve=tri,afade=t=out:st=0.04:d=0.06:curve=tri[out]`);
      writeWav(wavPath, [['-i', hiss], ['-i', clunk]], `[1]adelay=320:all=1[k];[0][k]${mixFilter(2)},apad=whole_dur=0.50,atrim=0:0.50,${chainHpLp()}[out]`);
      rmSync(hiss, { force: true });
      rmSync(clunk, { force: true });
      break;
    }
    case 'boundary-pulse':
      renderSineStack(wavPath, d, [
        { f: 32, amp: 0.25 },
        { f: 34, amp: 0.25 },
      ], { color: 'brown', amp: 0.16, lowpass: 70, edgeFade: 0 }, { fadeIn: 0.05, fadeOut: 0.55, tremolo: { f: 0.9, d: 0.25 } });
      break;
    default:
      throw new Error(`Unknown kind ${entry.kind}`);
  }
}

function durationOf(path) {
  if (!FFPROBE) return null;
  const result = run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]);
  const value = Number((result.stdout || '').trim());
  return Number.isFinite(value) ? value : null;
}

export function verifyAssets() {
  const missing = [];
  for (const entry of KEYS) {
    for (const ext of ['ogg', 'mp3']) {
      const file = join(ASSET_ROOT, entry.dir, `${entry.key}.${ext}`);
      const pub = join(PUBLIC_ROOT, entry.dir, `${entry.key}.${ext}`);
      if (!existsSync(file) || statSync(file).size <= 0) missing.push(file);
      if (!existsSync(pub) || statSync(pub).size <= 0) missing.push(pub);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Empty or missing audio files:\n${missing.slice(0, 20).join('\n')}`);
  }
  return { keys: KEYS.length, files: KEYS.length * 2 };
}

function generateAll() {
  if (!FFMPEG) {
    throw new Error('ffmpeg not found. Install with brew, or place a binary in tools/audio-placeholders/.bin/');
  }
  mkdirSync(TMP, { recursive: true });
  mkdirSync(ASSET_ROOT, { recursive: true });
  mkdirSync(PUBLIC_ROOT, { recursive: true });
  console.log(`ffmpeg: ${FFMPEG}`);
  console.log(`sox: ${SOX ?? '(not used; ffmpeg lavfi synthesis)'}`);
  console.log(`Generating ${KEYS.length} keys…`);

  for (const entry of KEYS) {
    const existingOgg = join(ASSET_ROOT, entry.dir, `${entry.key}.ogg`);
    const existingMp3 = join(ASSET_ROOT, entry.dir, `${entry.key}.mp3`);
    if (
      existsSync(existingOgg) && statSync(existingOgg).size > 0
      && existsSync(existingMp3) && statSync(existingMp3).size > 0
    ) {
      process.stdout.write(`  ${entry.key} skip existing\n`);
      continue;
    }
    const wavPath = join(TMP, `${entry.key}.wav`);
    process.stdout.write(`  ${entry.key} (${entry.seconds}s)… `);
    synthesize(entry, wavPath);
    normalizeTo(wavPath, entry.peak);
    encodePair(wavPath, join(ASSET_ROOT, entry.dir), entry.key, entry.bitrate);
    const dur = durationOf(join(ASSET_ROOT, entry.dir, `${entry.key}.ogg`));
    const size = statSync(join(ASSET_ROOT, entry.dir, `${entry.key}.ogg`)).size;
    if (dur != null && dur <= 0) throw new Error(`${entry.key} decoded duration is 0`);
    console.log(`ok  ogg=${size}B${dur != null ? `  ${dur.toFixed(2)}s` : ''}`);
  }

  const result = verifyAssets();
  writeFileSync(join(ASSET_ROOT, 'manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    keys: KEYS.map((k) => k.key),
    count: result.keys,
    ffmpeg: FFMPEG,
    sox: SOX,
  }, null, 2)}\n`);
  console.log(`Verified ${result.keys} keys × 2 formats, all size > 0.`);
}

const verifyOnly = process.argv.includes('--verify');
if (verifyOnly) {
  const result = verifyAssets();
  console.log(`OK ${result.keys} keys, ${result.files} files, all size > 0`);
} else {
  generateAll();
}
