import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/validate';
it('flags missing targetSize and unknown stage', () => {
  const errs = validateConfig({ sourceDir:'a', outputDir:'b', stages:[{name:'nope',enabled:true} as any], acceptance:{} } as any);
  expect(errs.some(e=>e.includes('targetSize'))).toBe(true);
  expect(errs.some(e=>e.includes('nope'))).toBe(true);
});
it('flags colorGrade after quantize', () => {
  const errs = validateConfig({ targetSize:{width:32,height:32}, sourceDir:'a', outputDir:'b', paletteFile:'p.json',
    stages:[{name:'quantize',enabled:true},{name:'colorGrade',enabled:true}], acceptance:{} } as any);
  expect(errs.some(e=>e.includes('colorGrade must run before quantize'))).toBe(true);
});
it('flags second colorGrade after quantize', () => {
  const errs = validateConfig({ targetSize:{width:32,height:32}, sourceDir:'a', outputDir:'b', paletteFile:'p.json',
    stages:[{name:'colorGrade',enabled:true},{name:'quantize',enabled:true},{name:'colorGrade',enabled:true}], acceptance:{} } as any);
  expect(errs.some(e=>e.includes('colorGrade must run before quantize'))).toBe(true);
});
it('passes a minimal valid config', () => {
  const errs = validateConfig({ targetSize:{width:32,height:32}, sourceDir:'a', outputDir:'b',
    stages:[{name:'downscale',enabled:true,filter:'nearest'}], acceptance:{} } as any);
  expect(errs).toEqual([]);
});
