import type { PipelineConfig } from './types';
const KNOWN = new Set(['bgRemove','colorGrade','downscale','quantize','cropPad']);
export function validateConfig(cfg: PipelineConfig): string[] {
  const e: string[] = [];
  if (!cfg?.targetSize?.width || !cfg?.targetSize?.height) e.push('missing targetSize {width,height}');
  if (!cfg?.sourceDir) e.push('missing sourceDir');
  if (!cfg?.outputDir) e.push('missing outputDir');
  if (!Array.isArray(cfg?.stages)) e.push('stages must be an array');
  else {
    cfg.stages.forEach((s,i)=>{ if(!KNOWN.has((s as any).name)) e.push(`unknown stage[${i}]: ${(s as any).name}`); });
    let quantizeSeen = false;
    for (const s of cfg.stages) {
      if (!s.enabled) continue;
      if (s.name === 'quantize') quantizeSeen = true;
      else if (s.name === 'colorGrade' && quantizeSeen) { e.push('colorGrade must run before quantize'); break; }
    }
  }
  if (cfg?.stages?.some(s=>s.name==='quantize'&&s.enabled) && !cfg.paletteFile)
    e.push('quantize enabled but config.paletteFile missing');
  return e;
}
