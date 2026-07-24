import { describe, it, expect } from 'vitest';
import { rgbDistance, nearestColor, rgbToLuma } from '../src/color';
describe('color', () => {
  it('rgbDistance is euclidean', () => {
    expect(rgbDistance([0,0,0],[0,0,0])).toBe(0);
    expect(rgbDistance([0,0,0],[255,0,0])).toBe(255);
  });
  it('nearestColor picks closest palette entry', () => {
    const pal: [number,number,number][] = [[0,0,0],[255,255,255]];
    expect(nearestColor([10,10,10], pal)).toEqual([0,0,0]);
    expect(nearestColor([240,240,240], pal)).toEqual([255,255,255]);
  });
  it('rgbToLuma uses Rec.601 weights', () => {
    expect(Math.round(rgbToLuma([255,255,255]))).toBe(255);
    expect(Math.round(rgbToLuma([0,0,0]))).toBe(0);
  });
});
