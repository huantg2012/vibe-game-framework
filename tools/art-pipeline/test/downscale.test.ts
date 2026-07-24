import { describe, it, expect } from 'vitest';
import { downscale } from '../src/stages/downscale';
import { makeSolid } from './fixtures';
describe('downscale', () => {
  it('shrinks square to target preserving aspect', async () => {
    const ctx = { config: { targetSize: { width: 8, height: 8 } } as any, palette: [] };
    const out = await downscale.run(makeSolid(64,64,[100,100,100,255]),
      { name:'downscale', enabled:true, filter:'nearest' }, ctx);
    expect([out.width, out.height]).toEqual([8,8]);
    expect(out.data.length).toBe(8*8*4);
  });
});
