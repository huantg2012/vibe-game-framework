import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { loadRaw, saveRaw, loadPalette } from '../src/io';
import { makeSolid } from './fixtures';
describe('io', () => {
  it('saveRaw then loadRaw round-trips pixels', async () => {
    const img = makeSolid(4, 4, [10, 20, 30, 255]);
    const f = join(tmpdir(), `iot-${Date.now()}.png`);
    await saveRaw(img, f);
    const back = await loadRaw(f);
    expect(back.width).toBe(4); expect(back.height).toBe(4);
    expect([back.data[0], back.data[1], back.data[2], back.data[3]]).toEqual([10,20,30,255]);
  });
  it('loadPalette parses hex list', async () => {
    const f = join(tmpdir(), `pal-${Date.now()}.json`);
    await writeFile(f, JSON.stringify({ colors: ['#000000', '#ff8000'] }));
    expect(await loadPalette(f)).toEqual([[0,0,0],[255,128,0]]);
  });
});
