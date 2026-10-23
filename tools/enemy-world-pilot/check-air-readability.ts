/** Offline regression for the three user-rejected air forms. No game startup.
 * Contrast checks are a regression floor on these ground samples, not art approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { nativeOut as out, coverages, specimenLight } from './native-specimens';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { paintNativeVolume } from '../../src/entities/form-renderers/d/native-volume-paint';
import { paintNativeEcho } from '../../src/entities/form-renderers/d/native-echo';
import { dingRecipeFromForm } from '../../src/entities/form-renderers/d/ding-recipe';
import { createVolumePresenceFrame, updateVolumePresenceFrame, sampleVolumeDensity, volumeTimeAtPhase } from '../../src/systems/volume-presence';
import type { ContaminationForm } from '../../src/generation/contamination-draw';
import type { FormAttachContext } from '../../src/entities/form-renderers/form-renderer';

const W = 224, H = 160, hash = (a: Uint8ClampedArray) => createHash('sha256').update(a).digest('hex');
const subjects = ['mist_bank', 'dust_swarm', 'sound_echo'];
const labels = ['雾团', '尘絮群', '余响'];
const { worlds } = JSON.parse(await fs.readFile(`${out}/atlas.json`, 'utf8')) as {worlds: {worldId: string; label: string}[]};
const pose = { x: 160, y: 80, facing4: 'down' as const, moving: false, visibility: 1, signal: 'idle' as const, deltaMs: 0 };
const box = { cx: 112, cy: 80, rx: 60, ry: 46, breath: 1, morphMs: 0 };
const failures: string[] = [], rows: object[] = [], times: number[] = [], motion: number[] = [];
let states = 0, densityPixels = 0, negativeControls = 0;
const check = (ok: boolean, message: string) => { if (!ok) failures.push(message); };

function contrast(sheet: Buffer, ground: Buffer, frame: number, tier: number) {
  let strong = 0, clear = 0, interior = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = ((tier * H + y) * 48 * W + frame * W + x) * 4, q = (y * W + x) * 4, a = sheet[p + 3]! / 255;
    const delta = Math.abs((sheet[p]! - ground[q]!) * .2126 + (sheet[p + 1]! - ground[q + 1]!) * .7152 + (sheet[p + 2]! - ground[q + 2]!) * .0722) * a;
    if (delta >= 28) strong++;
    if (x >= 64 && x < 160 && y >= 46 && y < 114) { interior++; if (!a) clear++; }
  }
  return { strong, clear: clear / interior };
}

for (const { worldId } of worlds) {
  const material = resolveEnemyWorldAdaptation(worldId)!;
  const ground = await sharp(`${out}/${worldId}-ground.png`).ensureAlpha().raw().toBuffer();
  for (const subject of subjects) {
    const sheet = await sharp(`${out}/${worldId}-${subject}-v3.png`).ensureAlpha().raw().toBuffer();
    const baseline = await sharp(`${out}/before-readability/${worldId}-${subject}-v3.png`).ensureAlpha().raw().toBuffer();
    const stageBytes = 48 * W * H * 4;
    assert.equal(new Set(coverages.map((_, i) => createHash('sha256').update(sheet.subarray(i * stageBytes, (i + 1) * stageBytes)).digest('hex'))).size, 3, 'three stages must not reuse identical pixels');
    for (const [tier, coverage] of coverages.entries()) {
      let minStrong = Infinity, beforeStrong = Infinity, clear = 1, beforeClear = 1;
      for (let frame = 0; frame < 48; frame += 4) {
        const current = contrast(sheet, ground, frame, tier), before = contrast(baseline, ground, frame, tier);
        minStrong = Math.min(minStrong, current.strong); beforeStrong = Math.min(beforeStrong, before.strong);
        clear = Math.min(clear, current.clear); beforeClear = Math.min(beforeClear, before.clear);
      }
      // At 1:1 require at least 8x8 pixels of strong luminance separation at
      // every sampled phase; the medium-sized subject cannot collapse to a dot.
      check(minStrong >= 64, `${worldId}/${subject}/${coverage}: strong area ${minStrong} < 64`);
      if (subject === 'sound_echo') check(clear >= .35, `${worldId}/${coverage}: echo interior is a filled backing`);
      if (subject === 'sound_echo' ? beforeClear < .35 : beforeStrong < 64) negativeControls++;
      rows.push({ worldId, subject, coverage, minimumStrongPixels: minStrong, beforeMinimumStrongPixels: beforeStrong,
        ...(subject === 'sound_echo' ? { minimumTransparentInterior: clear, beforeTransparentInterior: beforeClear } : {}) });

      const form = { substrate: subject, coverage, continuity: 'monolith', occupancy: 'volume', portfolio: 'ding', lexemes: { motion: 'motion_anchor', sense: 'sense_touch', rhythm: 'rhythm_open', contact: 'contact_step' } } as ContaminationForm;
      const recipe = dingRecipeFromForm(form, { form, seed: 37 } as FormAttachContext);
      for (const active of [true, false]) for (const phase of ['rest', 'gather', 'release', 'disperse'] as const) {
        const time = subject === 'sound_echo' ? ['rest','gather','release','disperse'].indexOf(phase) * 1400 : volumeTimeAtPhase(subject, phase, .6);
        const f = updateVolumePresenceFrame(createVolumePresenceFrame(), { substrate: subject, coverage, elapsedMs: time,
          rect: { x: 96, y: 32, w: 128, h: 96 }, active, isWalkableFloor: (x, y) => !(x === 4 && y === 3) });
        const before = JSON.stringify(f), pixels = new Uint8ClampedArray(W * H * 4), again = pixels.slice();
        let rays = 0;
        const lighting = { ...specimenLight, shadeAt: () => { rays++; return .7; } };
        const paint = (dst: Uint8ClampedArray, lit = true, elapsedMs = time) => subject === 'sound_echo'
          ? paintNativeEcho(dst, W, H, recipe, { ...pose, activity: { phase: active ? 'active' : 'rest', progress: 1 } }, elapsedMs, box, { material, lighting: lit ? lighting : undefined })
          : paintNativeVolume(dst, W, H, f, 37, { material, lighting: lit ? lighting : undefined }, 2);
        const start = performance.now(); paint(pixels); times.push(performance.now() - start);
        assert(rays <= Math.ceil(W / 4) * Math.ceil(H / 4), 'bounded 4px light sampling');
        assert.equal(JSON.stringify(f), before, 'painter cannot mutate authoritative frame');
        paint(again); assert.equal(hash(again), hash(pixels), 'seek/repeat is deterministic');
        paint(again, false); assert.notEqual(hash(again), hash(pixels), 'actual received light changes RGB');
        for (let i = 3; i < pixels.length; i += 4) assert.equal(again[i], pixels[i], 'light cannot change alpha');
        if (subject === 'sound_echo') {
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
            if (x <= 52 || x >= 171 || y <= 34 || y >= 125) assert.equal(pixels[(y * W + x) * 4 + 3], 0, 'no rectangle edge or out-of-host ink');
          paint(again, true, time + 6000); assert.equal(hash(again), hash(pixels), 'pressure cycle closes');
          if (recipe.paintStrikeCore) assert(pixels[(80 * W + 112) * 4 + 3]! >= 120, 'nucleus registered at actual center');
          if (active) { paint(again, true, time + 300); let delta = 0; for (let i = 3; i < pixels.length; i += 4) if (Math.abs(pixels[i]! - again[i]!) >= 25) delta++; motion.push(delta); assert(delta > 100, 'visible propagation'); }
        } else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = sampleVolumeDensity(f, x + 48.5, y + .5), a = pixels[(y * W + x) * 4 + 3]!;
          if (d < .035) assert.equal(a, 0, 'VOID, gap and outside density stay transparent');
          if (d >= f.dangerThreshold) assert(a >= 88 * (active ? 1 : .5), 'no unmarked dangerous holes');
          densityPixels++;
        }
        states++;
      }
    }
  }
}
check(negativeControls >= 18, 'known rejected frames must fail the new visual floor');
times.sort((a, b) => a - b);
const report = { scope: 'Offline three-air-form repair: sampled real-ground composition, unchanged density, received lighting, box-free echo. No gameplay/GPU claim.',
  limits: { luminanceDelta8Bit: 28, minimumStrongPixels: 64, minimumEchoTransparentInterior: .35 },
  states, densityPixels, rejectedBaselineCases: negativeControls, samples: rows, minimumEchoMotionPixels: Math.min(...motion),
  cpuLitMs: { median: times[Math.floor(times.length * .5)], p95: times[Math.floor(times.length * .95)], max: times.at(-1) }, failures };
await fs.writeFile(`${out}/air-readability-checks.json`, JSON.stringify(report, null, 2) + '\n');

// Editorial static evidence uses unmodified outputs of the formal baker.
const tiles: {input: Buffer; left: number; top: number}[] = [];
for (const [row, subject] of subjects.entries()) for (const [col, world] of worlds.entries()) {
  const title = Buffer.from(`<svg width="224" height="32"><rect width="224" height="32" fill="#10181b"/><text x="8" y="22" fill="#c9d4cb" font-family="sans-serif" font-size="13">${world.label} · ${labels[row]}</text></svg>`);
  tiles.push({input: await sharp(title).png().toBuffer(), left: col * W, top: row * (H + 32)});
  tiles.push({input: await sharp(`${out}/${world.worldId}-${subject}-infiltrate-v3.png`).png().toBuffer(),left:col*W,top:row*(H+32)+32});
}
await sharp({create:{width:W*6,height:(H+32)*3,channels:4,background:'#10181b'}}).composite(tiles).png().toFile(`${out}/air-readability-overview.png`);
const detail: {input: Buffer; left: number; top: number}[] = [];
for (const [i, subject] of subjects.entries()) {
  const title = Buffer.from(`<svg width="448" height="36"><rect width="448" height="36" fill="#10181b"/><text x="12" y="25" fill="#c9d4cb" font-family="sans-serif" font-size="18">${labels[i]} · 低侵蚀</text></svg>`);
  detail.push({input:await sharp(title).png().toBuffer(),left:i*448,top:0});
  detail.push({input:await sharp(`${out}/crystal-fibre-${subject}-infiltrate-v3.png`).resize(448,320,{kernel:'nearest'}).png().toBuffer(),left:i*448,top:36});
}
await sharp({create:{width:1344,height:356,channels:4,background:'#10181b'}}).composite(detail).png().toFile(`${out}/air-readability-crystal.png`);
console.log(JSON.stringify({states,densityPixels,negativeControls,cpuLitMs:report.cpuLitMs,failures}));
assert.equal(failures.length, 0, failures.join('\n'));
