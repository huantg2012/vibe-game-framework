import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { bakeInsectModel, type InsectModelRequest } from '../../src/entities/form-renderers/d/insect-model';

const out = 'docs/art/iteration-16-evidence';
await mkdir(out, { recursive: true });
const facings = ['up', 'right', 'down', 'left'] as const;
const coverages = ['infiltrate', 'rewrite', 'overwrite'] as const;
const composites: sharp.OverlayOptions[] = [];
const cell = 192;
for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
  const { buf } = bakeInsectModel({ seed: 197, facing4: facings[col]!, coverage: coverages[row]!, phase: 'idle', phase01: .2 });
  const png = await sharp(Buffer.from(buf.data), { raw: { width: 48, height: 48, channels: 4 } }).resize(cell, cell, { kernel: 'nearest' }).png().toBuffer();
  composites.push({ input: png, left: col * cell, top: row * cell });
}
await sharp({ create: { width: cell * 4, height: cell * 3, channels: 4, background: '#292b29' } }).composite(composites).png().toFile(`${out}/insect-sheet.png`);
await sharp(`${out}/insect-sheet.png`).resize(192, 144, { kernel: 'nearest' }).png().toFile(`${out}/insect-native.png`);
const phases: InsectModelRequest['phase'][] = ['idle', 'walk', 'alert', 'windup', 'strike', 'recover'];
for (const motionCoverage of ['rewrite', 'overwrite'] as const) {
const frames: sharp.OverlayOptions[] = [];
for (let row = 0; row < phases.length; row++) for (let col = 0; col < 8; col++) {
  const { buf } = bakeInsectModel({ seed: 197, facing4: 'up', coverage: motionCoverage, phase: phases[row]!, phase01: col / 8 });
  const png = await sharp(Buffer.from(buf.data), { raw: { width: 48, height: 48, channels: 4 } }).resize(96, 96, { kernel: 'nearest' }).png().toBuffer();
  frames.push({ input: png, left: col * 96, top: row * 96 });
}
await sharp({ create: { width: 768, height: 576, channels: 4, background: '#292b29' } }).composite(frames).png().toFile(`${out}/insect-${motionCoverage === 'rewrite' ? 'motion' : 'overwrite-motion'}.png`);
}
console.log(`${out}/insect-sheet.png\n${out}/insect-motion.png`);

let count = 0;
let minPixels = Infinity;
let maxPixels = 0;
const started = performance.now();
for (const seed of [0, 1, 197, 0xffffffff]) for (const coverage of coverages) for (const facing4 of facings) for (const phase of phases) {
  for (let frame = 0; frame < 16; frame++) {
    const request: InsectModelRequest = { seed, coverage, facing4, phase, phase01: frame / 15 };
    const { buf } = bakeInsectModel(request);
    if (frame === 0 && !Buffer.from(buf.data).equals(Buffer.from(bakeInsectModel(request).buf.data))) throw new Error('Non-deterministic bake');
    let pixels = 0;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      if (!buf.data[(y * 48 + x) * 4 + 3]) continue;
      if (x === 0 || y === 0 || x === 47 || y === 47) throw new Error(`Canvas clipping: ${JSON.stringify(request)}`);
      pixels++;
    }
    minPixels = Math.min(minPixels, pixels); maxPixels = Math.max(maxPixels, pixels); count++;
  }
}
console.log({ frames: count, minPixels, maxPixels, millisecondsPerFrame: (performance.now() - started) / count });
