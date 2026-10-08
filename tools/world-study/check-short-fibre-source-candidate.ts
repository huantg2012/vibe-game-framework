/** Isolated material study. Not normal FOV or a finished-world art approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { buildNativeVolume } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster, NativeVolumeLighting } from '../../src/generation/world-study/native-volume-raster';
import { mapWorldPigment, paintedToneRange } from '../../src/generation/world-study/world-material-pigment';
import { R100_WORLD_APPEARANCES } from '../../src/generated/r100-world-appearance';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { prepareOrganizationSurfaceWindows, organizationSampleIndex } from '../../src/systems/r100-world/organization-sampling';
import type { PaintedMaterial } from '../../src/systems/r100-world/painted-material';

const out = process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i10-i12/p34-short-fibre/source-v4-isolated';
fs.mkdirSync(out, { recursive: true });
const sha = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const definition = ORGANIZATION_MATERIALS.find(row => row.organization === 'short-fibre')!.solid;
const pixels = new Uint8ClampedArray(await sharp(`public${definition.source}`).resize(definition.logical_pixels, definition.logical_pixels).ensureAlpha().raw().toBuffer());
const beforePixels = sha(pixels), range = paintedToneRange({ pixels });
const candidatePath = 'docs/qa/artifacts/r100-i10-i12/p34-short-fibre/source-v4/short-fibre-solid.png';
const candidateLogical = Number(process.env.QA_LOGICAL ?? definition.logical_pixels);
const candidateWorldSize = Number(process.env.QA_WORLD_SIZE ?? definition.world_size);
assert(Number.isFinite(candidateWorldSize) && candidateWorldSize > 0);
assert([128,256,512].includes(candidateLogical));
const candidatePixels = new Uint8ClampedArray(await sharp(candidatePath).resize(candidateLogical, candidateLogical).ensureAlpha().raw().toBuffer());
const painting: PaintedMaterial = { width: definition.logical_pixels, height: definition.logical_pixels,
  pixels, worldSize: definition.world_size, source: definition.source, regions: definition.regions };
const palette = { base: [140, 130, 115] as const, dark: [70, 70, 70] as const,
  light: [190, 190, 180] as const, roughness: .86, structure: 0 };
const records = [], width = 360, height = 320;
for (const worldId of ['short-fibre-mat', 'felt-wedges']) for (const rotation of (process.env.QA_TWO_CASES ? [worldId === 'short-fibre-mat' ? 0 : Math.PI * .5] : [0, Math.PI * .5])) {
  const mesh = buildNativeVolume({ id: 1, family: 'membrane-rim', constructionVersion: 4,
    shapeProfile: 'compressed-wedge', blocking: 1, seed: 20261005, x: 180, y: 158,
    length: 220, width: 160, height: 55, thickness: 10, fold: .6, branches: 3, opening: .7, distortion: .3, rotation });
  const protectedMesh = sha(new Uint8Array(mesh.positions.buffer));
  const changedPainting: PaintedMaterial = { ...painting, width: candidateLogical, height: candidateLogical, worldSize: candidateWorldSize, pixels: candidatePixels, source: candidatePath };
  assert.equal(changedPainting.pixels.length, candidateLogical * candidateLogical * 4);
  assert.notEqual(changedPainting.pixels, painting.pixels, 'shared source is never modified');
  for (let i = 3; i < candidatePixels.length; i += 4) assert.equal(candidatePixels[i], 255, 'opaque source remains opaque');
  const raster = compileNativeVolumeRaster([mesh], { x: 0, y: 0, width, height, opticalHeight: 16 });

  const appearance = R100_WORLD_APPEARANCES.find(row => row.worldId === worldId)!;
  const pair = [];
  for (const candidate of [false, true]) {
    const selected = candidate ? changedPainting : painting;
    const selectedRange = candidate ? paintedToneRange(selected) : range;
    const sourceWindows = prepareOrganizationSurfaceWindows([mesh], 'membrane-rim', selected).get(1)!.ground;
    const lighting = new NativeVolumeLighting(raster, { outer: palette, cut: palette, inner: palette, joint: palette });
    const mapped = new Float32Array(3);
    for (const p of raster.occupiedPixels) {
      const cut = raster.material[p] === 1 || raster.region[p] === 3;
      const u = raster.uv[p * 2]!, v = raster.uv[p * 2 + 1]!;
      const index = organizationSampleIndex(sourceWindows[cut ? 'cleaved' : 'skin'], u, v);
      mapWorldPigment(appearance, cut ? 'cleaved' : 'solid', selected.pixels[index]!, selected.pixels[index + 1]!, selected.pixels[index + 2]!, selectedRange,
        { secondary: 0, tone: 0, detail: 1 }, 0, mapped);
      for (let c = 0; c < 3; c++) lighting.albedo[p * 3 + c] = mapped[c]!;
    }
    if (candidate && process.env.QA_DIAGNOSTICS) {
      const albedo = new Uint8ClampedArray(width * height * 4);
      const rawSource = new Uint8ClampedArray(width * height * 4);
      for (let p=0;p<width*height;p++) { albedo.set([24,26,30,255],p*4); rawSource.set([24,26,30,255],p*4); }
      const regionStats = Object.fromEntries(['skin','cleaved'].map(role=>[role,{screenPixels:0,minSourceX:Infinity,maxSourceX:-Infinity,minSourceY:Infinity,maxSourceY:-Infinity,minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity}]));
      for (const p of raster.occupiedPixels) {
        const role = raster.material[p] === 1 || raster.region[p] === 3 ? 'cleaved' : 'skin';
        const u=raster.uv[p*2]!,v=raster.uv[p*2+1]!,index=organizationSampleIndex(sourceWindows[role],u,v);
        const stat=regionStats[role]!,sx=index/4%selected.width,sy=Math.floor(index/4/selected.width);
        stat.screenPixels++; stat.minSourceX=Math.min(stat.minSourceX,sx);stat.maxSourceX=Math.max(stat.maxSourceX,sx);stat.minSourceY=Math.min(stat.minSourceY,sy);stat.maxSourceY=Math.max(stat.maxSourceY,sy);stat.minU=Math.min(stat.minU,u);stat.maxU=Math.max(stat.maxU,u);stat.minV=Math.min(stat.minV,v);stat.maxV=Math.max(stat.maxV,v);
        albedo.set([lighting.albedo[p*3]!,lighting.albedo[p*3+1]!,lighting.albedo[p*3+2]!,255],p*4);
        rawSource.set([selected.pixels[index]!,selected.pixels[index+1]!,selected.pixels[index+2]!,255],p*4);
      }
      const prefix=`${out}/${worldId}-${rotation===0?'east':'south'}`;
      await sharp(albedo,{raw:{width,height,channels:4}}).png().toFile(`${prefix}-pure-albedo.png`);
      await sharp(rawSource,{raw:{width,height,channels:4}}).png().toFile(`${prefix}-source-on-mesh.png`);
      for(const role of ['skin','cleaved'] as const) {const stat=regionStats[role]!;await sharp(selected.pixels,{raw:{width:selected.width,height:selected.height,channels:4}}).extract({left:stat.minSourceX,top:stat.minSourceY,width:stat.maxSourceX-stat.minSourceX+1,height:stat.maxSourceY-stat.minSourceY+1}).png().toFile(`${prefix}-${role}-actual-atlas-window.png`);}
      fs.writeFileSync(`${prefix}-sampling.json`,JSON.stringify({sourceWindows,regionStats,totalMeshPixels:raster.occupiedPixels.length,screenPixels:width*height,roles:'cleaved iff raster material1 or region3; all other occupied pixels use skin, identical to this existing isolation',normalLightingUnchanged:true},null,2));
    }
    const output = new Uint8ClampedArray(width * height * 4);
    lighting.render([{ x: 100, y: 278, z: 105, radius: 390, intensity: 2.1, color: [1, .98, .95] }], output, { ambient: .25, emissionScale: 0 });
    for (let p = 0; p < width * height; p++) if (!output[p * 4 + 3]) output.set([24, 26, 30, 255], p * 4);
    for (let y = 282; y < 302; y++) for (let x = 20; x < 40; x++) if (x === 20 || x === 39 || y === 282 || y === 301) output.set([150, 150, 150, 255], (y * width + x) * 4);
    const file = `${out}/${worldId}-${rotation === 0 ? 'east' : 'south'}-${candidate ? 'after' : 'before'}.png`;
    await sharp(output, { raw: { width, height, channels: 4 } }).png().toFile(file);
    pair.push({ candidate, file, sha256: sha(fs.readFileSync(file)), worldSize: selected.worldSize, logicalPixels: selected.width, sampleWindows: sourceWindows });
  }
  assert.equal(sha(new Uint8Array(mesh.positions.buffer)), protectedMesh);
  records.push({ worldId, rotation, meshSha256: protectedMesh, images: pair });
}
assert.equal(sha(pixels), beforePixels, 'source pixels are immutable');
const report = { status: 'isolated-contract-pass-art-pending', scope: 'Same actual compressed mesh, unchanged source window sampler and lighting, old versus new unmodified atom, two orientations and palettes. NativeVolumeLighting isolation, not normal game FOV. 20px outline is only a scale reference.', records, source: { path: `public${definition.source}`, sha256: sha(fs.readFileSync(`public${definition.source}`)) }, candidate: { logicalPixels: candidateLogical, worldSize: candidateWorldSize, path: candidatePath, sha256: sha(fs.readFileSync(candidatePath)) } };
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, pairs: records.length, out }));

for (const role of ['ground', 'solid']) {
 const input = `docs/qa/artifacts/r100-i10-i12/p34-short-fibre/source-v4/short-fibre-${role}.png`;
 const thumbnail = await sharp(input).resize(128,128).png().toBuffer();
 await sharp(thumbnail).toFile(`${out}/${role}-native128.png`);
 await sharp(thumbnail).resize(512,512,{kernel:'nearest'}).png().toFile(`${out}/${role}-native128-4x.png`);
}
