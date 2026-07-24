import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPipeline } from '../src/postprocess';
import { saveRaw } from '../src/io';
import { makeSolid } from './fixtures';
describe('postprocess', () => {
  it('runs enabled stages and writes outputs + provenance', async () => {
    const dir = join(tmpdir(), 'art-pp-test');
    const inDir = join(dir, 'in'), outDir = join(dir, 'out');
    try {
      await rm(dir, { recursive: true, force: true });
      await mkdir(inDir, { recursive: true });
      await saveRaw(makeSolid(64, 64, [9, 9, 9, 255]), join(inDir, 'a.png'));
      const cfg = { targetSize: { width: 32, height: 32 }, sourceDir: inDir, outputDir: outDir,
        stages: [{ name: 'downscale', enabled: true, filter: 'nearest' }], acceptance: { exactSize: [32, 32] } };
      const cfgFile = join(dir, 'c.json');
      await writeFile(cfgFile, JSON.stringify(cfg));
      await runPipeline(cfgFile);
      const files = await readdir(outDir);
      expect(files).toContain('a.png');
      expect(files).toContain('a.provenance.json');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
