import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { loadRaw, saveRaw, loadPalette } from './io';
import { validateConfig } from './validate';
import { STAGES } from './stages/index';
import type { PipelineConfig, RGB } from './types';

export async function runPipeline(configPath: string, inOverride?: string, outOverride?: string) {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as PipelineConfig;
  const errs = validateConfig(config);
  if (errs.length) { console.error('invalid config:\n- ' + errs.join('\n- ')); process.exit(1); }
  const sourceDir = inOverride ?? config.sourceDir;
  const outputDir = outOverride ?? config.outputDir;
  await mkdir(outputDir, { recursive: true });
  const palette: RGB[] = config.paletteFile ? await loadPalette(config.paletteFile) : [];
  const ctx = { config, palette };
  const cfgHash = createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12);
  const enabled = config.stages.filter(s => s.enabled);
  const inputs = (await readdir(sourceDir)).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  for (const file of inputs) {
    let img = await loadRaw(join(sourceDir, file));
    const chain: string[] = [];
    for (const s of enabled) { img = await STAGES[s.name].run(img, s as any, ctx); chain.push(s.name); }
    const stem = basename(file, extname(file));
    await saveRaw(img, join(outputDir, stem + '.png'));
    await writeFile(join(outputDir, stem + '.provenance.json'),
      JSON.stringify({ source: file, configHash: cfgHash, stages: chain }, null, 2));
  }
  console.log(`postprocess: ${inputs.length} images -> ${outputDir}`);
}

const args = process.argv.slice(2);
const getArg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
if (getArg('--config')) runPipeline(getArg('--config')!, getArg('--in'), getArg('--out')).catch(e => { console.error(e); process.exit(1); });
