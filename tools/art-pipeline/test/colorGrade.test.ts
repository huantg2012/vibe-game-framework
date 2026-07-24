import { describe, it, expect } from 'vitest';
import { colorGrade } from '../src/stages/colorGrade';
import { makeSolid } from './fixtures';
const ctx = { config: {} as any, palette: [] };
describe('colorGrade', () => {
  it('brightness<1 darkens', async () => {
    const out = await colorGrade.run(makeSolid(1,1,[200,200,200,255]),
      { name:'colorGrade', enabled:true, brightness:0.5 }, ctx);
    expect(out.data[0]).toBe(100);
  });
  it('saturation=0 collapses to luma grey', async () => {
    const out = await colorGrade.run(makeSolid(1,1,[255,0,0,255]),
      { name:'colorGrade', enabled:true, saturation:0 }, ctx);
    const l = Math.round(0.299*255);
    expect([out.data[0],out.data[1],out.data[2]]).toEqual([l,l,l]);
  });
  it('preserves alpha', async () => {
    const out = await colorGrade.run(makeSolid(1,1,[10,10,10,128]),
      { name:'colorGrade', enabled:true, brightness:1 }, ctx);
    expect(out.data[3]).toBe(128);
  });
});
