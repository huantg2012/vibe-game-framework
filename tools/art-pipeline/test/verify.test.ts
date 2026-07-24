import { describe, it, expect } from 'vitest';
import { verifyImage } from '../src/verify';
import { makeSolid } from './fixtures';
describe('verify', () => {
  it('flags too-bright image', () => {
    const r = verifyImage(makeSolid(2,2,[200,200,200,255]), { maxAvgBrightness:30 }, []);
    expect(r.pass).toBe(false);
    expect(r.failures.some(f=>f.includes('brightness'))).toBe(true);
  });
  it('passes dark image within brightness', () => {
    const r = verifyImage(makeSolid(2,2,[10,10,10,255]), { maxAvgBrightness:30 }, []);
    expect(r.pass).toBe(true);
  });
  it('checks exact size', () => {
    const r = verifyImage(makeSolid(2,2,[0,0,0,255]), { exactSize:[3,3] }, []);
    expect(r.pass).toBe(false);
  });
  it('flags missing transparent bg', () => {
    const r = verifyImage(makeSolid(2,2,[0,0,0,255]), { requireTransparentBg:true }, []);
    expect(r.pass).toBe(false);
  });
});
