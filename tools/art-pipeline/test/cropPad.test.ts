import { describe, it, expect } from 'vitest';
import { cropPad } from '../src/stages/cropPad';
import type { RawImage } from '../src/types';
function oneDot(): RawImage {
  const data = Buffer.alloc(4 * 4 * 4);
  data.set([255, 0, 0, 255], (2 * 4 + 2) * 4); // (2,2) opaque
  return { data, width: 4, height: 4 };
}
describe('cropPad', () => {
  it('centers content into target size', async () => {
    const ctx = { config: { targetSize: { width: 3, height: 3 } } as any, palette: [] };
    const out = await cropPad.run(oneDot(), { name:'cropPad', enabled:true, padding:0 }, ctx);
    expect([out.width, out.height]).toEqual([3,3]);
    const c = (1 * 3 + 1) * 4; // center (1,1)
    expect([out.data[c], out.data[c + 3]]).toEqual([255, 255]);
  });
  it('returns empty target on fully transparent input', async () => {
    const ctx = { config: { targetSize: { width: 2, height: 2 } } as any, palette: [] };
    const empty: RawImage = { data: Buffer.alloc(4 * 4 * 4), width: 4, height: 4 };
    const out = await cropPad.run(empty, { name:'cropPad', enabled:true, padding:0 }, ctx);
    expect([out.width, out.height]).toEqual([2,2]);
    expect(out.data.every(b => b === 0)).toBe(true);
  });
});
