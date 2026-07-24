import { readdir, readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaw, loadPalette } from './io';
import { rgbToLuma, rgbDistance } from './color';
import type { RawImage, AcceptanceConfig, RGB, PipelineConfig } from './types';

export function verifyImage(img: RawImage, acc: AcceptanceConfig, palette: RGB[]) {
  const failures: string[] = [];
  if (acc.exactSize && (img.width !== acc.exactSize[0] || img.height !== acc.exactSize[1]))
    failures.push(`size ${img.width}x${img.height} != ${acc.exactSize.join('x')}`);
  let lumaSum = 0, opaque = 0, transparent = 0, conform = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3];
    if (a === 0) { transparent++; continue; }
    opaque++;
    lumaSum += rgbToLuma([img.data[i], img.data[i + 1], img.data[i + 2]]);
    if (palette.length) {
      const dmin = Math.min(...palette.map(c => rgbDistance([img.data[i], img.data[i + 1], img.data[i + 2]] as RGB, c)));
      if (dmin <= (acc.paletteTolerance ?? 0)) conform++;
    }
  }
  const avg = opaque ? lumaSum / opaque : 0;
  if (acc.maxAvgBrightness != null && avg > acc.maxAvgBrightness)
    failures.push(`avg brightness ${avg.toFixed(1)} > ${acc.maxAvgBrightness}`);
  if (acc.requireTransparentBg && transparent === 0)
    failures.push('no transparent pixels (background not removed)');
  if (acc.paletteConformance != null && palette.length) {
    const ratio = opaque ? conform / opaque : 0;
    if (ratio < acc.paletteConformance)
      failures.push(`palette conformance ${(ratio * 100).toFixed(1)}% < ${acc.paletteConformance * 100}%`);
  }
  return { pass: failures.length === 0, failures, metrics: { avgBrightness: avg, opaque, transparent } };
}

export async function runVerify(configPath: string, outOverride?: string) {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as PipelineConfig;
  const outDir = outOverride ?? config.outputDir;
  const palette: RGB[] = config.paletteFile ? await loadPalette(config.paletteFile) : [];
  const files = (await readdir(outDir)).filter(f => /\.png$/i.test(f));
  const report: Array<{ file: string } & ReturnType<typeof verifyImage>> = [];
  let allPass = true;
  for (const f of files) {
    const r = verifyImage(await loadRaw(join(outDir, f)), config.acceptance, palette);
    report.push({ file: f, ...r });
    if (!r.pass) allPass = false;
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${f}${r.failures.length ? ' :: ' + r.failures.join('; ') : ''}`);
  }
  await writeFile(join(outDir, 'verify-report.json'), JSON.stringify(report, null, 2));
  if (!allPass) process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
function invokedDirectly(): boolean {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
}
if (invokedDirectly()) {
  const cfg = getArg('--config');
  if (!cfg) { console.error('usage: --config <path> [--out <dir>]'); process.exit(1); }
  runVerify(cfg, getArg('--out')).catch(e => { console.error(e); process.exit(1); });
}
