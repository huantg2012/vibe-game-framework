/** Offline atlas of the actual versioned bakers. No game scene or save I/O. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { nativeOut as out, groundSource, nativeSubjects, coverages, facingNames, bodyPoses, specimenLight } from './native-specimens';
import { productionModelFor } from '../../src/entities/form-renderers/d/production-models';
import { resolveRuntimeEnemyWorldAppearance } from '../../src/entities/form-renderers/d/world-runtime';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { lightModelPixels } from '../../src/entities/form-renderers/d/model-visual';
import { createVolumePresenceFrame, updateVolumePresenceFrame, getVolumeProfile } from '../../src/systems/volume-presence';
import { paintVolumePresence } from '../../src/entities/form-renderers/d/volume-paint';
import { paintNativeVolume } from '../../src/entities/form-renderers/d/native-volume-paint';
import { paintNativeEcho } from '../../src/entities/form-renderers/d/native-echo';
import { dingRecipeFromForm } from '../../src/entities/form-renderers/d/ding-recipe';
import { paintDingFrame } from '../../src/entities/form-renderers/d/ding-paint';
import { bakePaintGenome } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { paintPaintGenomeLive } from '../../src/entities/form-renderers/d/paint-genome/live';
import { paintSurfaceMaterial } from '../../src/entities/form-renderers/d/paint-genome/material';
import { applyPaintWorldLighting } from '../../src/entities/form-renderers/d/paint-genome/lighting';
import type { ContaminationForm } from '../../src/generation/contamination-draw';
import type { FormAttachContext } from '../../src/entities/form-renderers/form-renderer';

const selected = process.argv.find(a => a.startsWith('--subjects='))?.slice(11).split(',');
if (selected?.some(id => !nativeSubjects.some(s => s.id === id))) throw new Error('Unknown native subject');
const { cards } = JSON.parse(await fs.readFile(`${groundSource}/atlas.json`, 'utf8')) as { cards: { worldId: string; label: string; kind: string }[] };
const W = 224, H = 160, GX = 48, GY = 0, feet = 108, anchors = [36, 86, 136, 186], environmentFrames = 48;
const tierNames = ['渗透', '改写', '覆盖'];
const raw = (data: Uint8Array | Uint8ClampedArray, width: number, height: number) => sharp(Buffer.from(data), { raw: { width, height, channels: 4 } });
function blit(dst: Uint8Array, sw: number, src: Uint8Array | Uint8ClampedArray, w: number, h: number, left: number, top: number) {
  const dh = dst.length / sw / 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4, dx = x + left, dy = y + top;
    if (!src[p + 3] || dx < 0 || dy < 0 || dx >= sw || dy >= dh) continue;
    const q = (dy * sw + dx) * 4, a = src[p + 3]! / 255;
    if (!dst[q + 3]) dst.set(src.subarray(p, p + 4), q);
    else { for (let c = 0; c < 3; c++) dst[q + c] = Math.round(src[p + c]! * a + dst[q + c]! * (1 - a)); dst[q + 3] = 255; }
  }
}
await fs.mkdir(out, { recursive: true });
const entries: object[] = selected ? JSON.parse(await fs.readFile(`${out}/atlas.json`, 'utf8')).entries.filter((e: {subject: string}) => !selected.includes(e.subject)) : [];
const overview: { input: Buffer; left: number; top: number }[] = [];
let frames = 0;
for (const [worldIndex, card] of cards.entries()) {
  const material = resolveEnemyWorldAdaptation(card.worldId)!;
  const ground = new Uint8Array(await sharp(`${groundSource}/${card.worldId}-ground.png`).extract({ left: GX, top: GY, width: W, height: H }).raw().toBuffer());
  await raw(ground, W, H).png().toFile(`${out}/${card.worldId}-ground.png`);
  for (const subject of nativeSubjects) {
    if (selected && !selected.includes(subject.id)) continue;
    const body = subject.type === 'body', paint = subject.type === 'paint';
    const n = body ? bodyPoses.length : environmentFrames, cw = body ? 64 : W, ch = body ? 64 : H;
    const rows = body ? 12 : 3, stem = `${card.worldId}-${subject.id}`;
    let cycleMs = subject.type === 'echo' ? 6000 : 3200;
    if (subject.type === 'volume') { const p = getVolumeProfile(subject.id); cycleMs = p.restMs + p.gatherMs + p.releaseMs + p.disperseMs; }
    if (body) cycleMs = productionModelFor(subject.id, true, 3)!.walkCycleMs;
    for (const version of [2, 3] as const) {
      // Existing three paint algorithms are reused byte-for-byte, not redesigned.
      if ((paint || selected) && version === 2) continue;
      const sheet = new Uint8Array(n * cw * rows * ch * 4);
      for (const [tier, coverage] of coverages.entries()) {
        const still = ground.slice();
        const form = { substrate: subject.id, coverage, continuity: 'monolith', occupancy: 'volume', portfolio: 'ding', lexemes: { motion: 'motion_anchor', sense: 'sense_touch', rhythm: 'rhythm_open', contact: 'contact_step' } } as ContaminationForm;
        const recipe = subject.type === 'echo' ? dingRecipeFromForm(form, { form, seed: 37 } as FormAttachContext) : undefined;
        const bakedPaint = paint ? bakePaintGenome({ substrate: subject.id, coverage, seed: 77, continuity: subject.id === 'oil_film' ? 'monolith' : 'colony', sense: 'sense_touch', rhythm: 'rhythm_cluster', geometryVersion: 2 }) : undefined;
        const scratch = bakedPaint?.field.slice();
        for (let frame = 0; frame < n; frame++) {
          const time = frame / n * cycleMs;
          if (body) {
            const appearance = resolveRuntimeEnemyWorldAppearance(material, subject.id, specimenLight, version);
            const model = productionModelFor(subject.id, !!appearance.worldAdaptation, version)!;
            for (const [direction, facing4] of facingNames.entries()) {
              const baked = model.bake({ seed: 37, coverage, facing4, ...bodyPoses[frame]!, worldAdaptation: appearance.worldAdaptation });
              if (baked.lightingSurface) lightModelPixels(baked.buf.data, baked.lightingSurface, anchors[direction]! + GX, feet + GY, specimenLight);
              // Historical insect uses 48px art; keep its original foot registration.
              const tile = new Uint8Array(64 * 64 * 4);
              blit(tile, 64, baked.buf.data, baked.canvas.w, baked.canvas.h, 32 - baked.canvas.originX, 42 - baked.canvas.originY);
              blit(sheet, n * cw, tile, 64, 64, frame * 64, (tier * 4 + direction) * 64);
              if (!frame) blit(still, W, tile, 64, 64, anchors[direction]! - 32, feet - 42);
              frames++;
            }
          } else {
            const pixels = new Uint8ClampedArray(W * H * 4);
            if (bakedPaint && scratch) {
              const b = bakedPaint, surface = new Uint8ClampedArray(b.canvasW * b.canvasH * 4);
              paintPaintGenomeLive({ rest: b.field, scratch, out: surface, w: b.canvasW, h: b.canvasH, elapsedMs: time, inflated: false, ramp: b.ramp, growth: b.growth });
              paintSurfaceMaterial(surface, scratch, b.canvasW, b.canvasH, subject.id, coverage, 77, time, undefined, material, b.growth);
              const x = Math.floor((W - b.canvasW) / 2), y = Math.floor((H - b.canvasH) / 2);
              applyPaintWorldLighting(surface, scratch, b.canvasW, b.canvasH, GX + x, GY + y, specimenLight);
              blit(pixels, W, surface, b.canvasW, b.canvasH, x, y);
            } else if (recipe) {
              const pose = { x: GX + W / 2, y: GY + H / 2, facing4: 'down' as const, moving: false, visibility: 1, signal: 'idle' as const, deltaMs: 0 };
              const box = { cx: W / 2, cy: H / 2, rx: 60, ry: 46, breath: 1, morphMs: time };
              if (version === 3) paintNativeEcho(pixels, W, H, recipe, pose, time, box, { material, lighting: specimenLight });
              else paintDingFrame(pixels, W, H, recipe, pose, time, box);
            } else {
              const f = updateVolumePresenceFrame(createVolumePresenceFrame(), { substrate: subject.id, coverage, elapsedMs: time, rect: { x: GX + (W - 128) / 2, y: GY + (H - 96) / 2, w: 128, h: 96 }, active: true });
              if (version === 3) paintNativeVolume(pixels, W, H, f, 37, { material, lighting: specimenLight }, 2);
              else paintVolumePresence(pixels, W, H, f, 37, 2);
            }
            blit(sheet, n * cw, pixels, W, H, frame * W, tier * H);
            if (frame === Math.floor(n * .55)) blit(still, W, pixels, W, H, 0, 0);
            frames++;
          }
        }
        await raw(still, W, H).png().toFile(`${out}/${stem}-${coverage}-v${version}.png`);
        if (!selected && version === 3 && worldIndex < 3) {
          const subjectIndex = nativeSubjects.indexOf(subject), tileW = W * 2, tileH = H * 2 + 36;
          const title = Buffer.from(`<svg width="${tileW}" height="36"><rect width="${tileW}" height="36" fill="#10181b"/><text x="12" y="24" fill="#d1d8cf" font-family="sans-serif" font-size="16">${card.label} · ${subject.label} · ${tierNames[tier]}</text></svg>`);
          if (worldIndex === 0) {
            overview.push({ input: await sharp(title).png().toBuffer(), left: tier * tileW, top: subjectIndex * tileH });
            overview.push({ input: await raw(still, W, H).resize(W * 2, H * 2, { kernel: 'nearest' }).png().toBuffer(), left: tier * tileW, top: subjectIndex * tileH + 36 });
          }
        }
      }
      await raw(sheet, n * cw, rows * ch).png().toFile(`${out}/${stem}-v${version}.png`);
    }
    entries.push({ worldId: card.worldId, subject: subject.id, type: subject.type, stem, frames: n, cw, ch, cycleMs, reusedPaint: paint });
  }
  console.log(`atlas ${worldIndex + 1}/${cards.length}: ${card.worldId}`);
}
if (selected) {
  for (const [i, subject] of nativeSubjects.entries()) for (const [tier, coverage] of coverages.entries()) {
    const title = Buffer.from(`<svg width="448" height="36"><rect width="448" height="36" fill="#10181b"/><text x="12" y="24" fill="#d1d8cf" font-family="sans-serif" font-size="16">${cards[0]!.label} · ${subject.label} · ${tierNames[tier]}</text></svg>`);
    overview.push({input: await sharp(title).png().toBuffer(), left:tier*W*2,top:i*(H*2+36)});
    overview.push({input: await sharp(`${out}/${cards[0]!.worldId}-${subject.id}-${coverage}-v3.png`).resize(W*2,H*2,{kernel:'nearest'}).png().toBuffer(),left:tier*W*2,top:i*(H*2+36)+36});
  }
}
await sharp({ create: { width: W * 6, height: (H * 2 + 36) * nativeSubjects.length, channels: 4, background: '#10181b' } }).composite(overview).png().toFile(`${out}/overview.png`);
await fs.writeFile(`${out}/atlas.json`, JSON.stringify({ scope: 'Actual v3 bakers, all three individual coverages. Offline material study, not gameplay screenshots. Paint is reused; encounter deployment unchanged.', worlds: cards, subjects: nativeSubjects, entries, seed: 37, frames: nativeSubjects.reduce((sum, s) => sum + (s.type === 'body' ? bodyPoses.length * 4 : environmentFrames) * 3 * (s.type === 'paint' ? 1 : 2), 0), lastRenderedFrames: frames, bodyPoses, coverages, sourceGround: groundSource }, null, 2) + '\n');
const template = await fs.readFile('tools/enemy-world-pilot/native-atlas.html', 'utf8');
await fs.writeFile(`${out}/index.html`, template.replace('/* ATLAS */', JSON.stringify({ cards, subjects: nativeSubjects, entries, W, H, anchors, feet })));
console.log(JSON.stringify({ out, frames, subjects: nativeSubjects.length }));
