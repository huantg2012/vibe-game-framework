import { describe, it, expect } from 'vitest';
import { bgRemove } from '../src/stages/bgRemove';
import { makeChecker } from './fixtures';
const ctx = { config: {} as any, palette: [] };
describe('bgRemove', () => {
  it('clears near-bg pixels to transparent, keeps others', async () => {
    const img = makeChecker(2,2,[0,0,0,255],[250,250,250,255]); // (0,0)=black, (1,0)=white
    const out = await bgRemove.run(img,
      { name:'bgRemove', enabled:true, method:'chroma', color:[0,0,0], threshold:20 }, ctx);
    expect(out.data[3]).toBe(0);        // black -> transparent
    expect(out.data[4*1+3]).toBe(255);  // white -> kept
    expect([out.data[4],out.data[5],out.data[6]]).toEqual([250,250,250]); // rgb unchanged
  });
});
