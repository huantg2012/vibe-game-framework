import { describe, it, expect } from 'vitest';
import { quantize } from '../src/stages/quantize';
import { makeSolid } from './fixtures';
const ctx = (pal: any) => ({ config: {} as any, palette: pal });
describe('quantize', () => {
  it('snaps to nearest palette color', async () => {
    const out = await quantize.run(makeSolid(1,1,[8,8,8,255]),
      { name:'quantize', enabled:true }, ctx([[0,0,0],[255,255,255]]));
    expect([out.data[0],out.data[1],out.data[2]]).toEqual([0,0,0]);
  });
  it('skips fully transparent pixels', async () => {
    const out = await quantize.run(makeSolid(1,1,[123,45,67,0]),
      { name:'quantize', enabled:true }, ctx([[0,0,0]]));
    expect([out.data[0],out.data[1],out.data[2],out.data[3]]).toEqual([123,45,67,0]);
  });
  it('throws on empty palette', async () => {
    await expect(quantize.run(makeSolid(1,1,[1,2,3,255]), { name:'quantize', enabled:true }, ctx([])))
      .rejects.toThrow('empty palette');
  });
});
