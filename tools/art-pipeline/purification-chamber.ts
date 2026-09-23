/** Export the authored master as exact production pixels, not SVG antialiasing.
 * node --import tsx tools/art-pipeline/purification-chamber.ts [output-directory]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ChamberPixels, paintChamberDevices, paintChamberGrounding } from '../../src/art/purification-chamber-pixels';
import { ChamberSurfaceMap } from '../../src/art/chamber-surface-map';
import { paintAuthoredChamberArchitecture, paintAuthoredChamberFloor, paintAuthoredChamberForeground } from '../../src/art/chamber-authored-architecture';
import { paintChamberExteriorLayer } from '../../src/art/chamber-exterior-pixels';
import { ENVIRONMENT_FACES, ENVIRONMENT_REVISION, MATERIAL, type Layer } from '../../assets/source/purification-r9/environment';
import { CHAMBER_WALK_POLYGONS } from '../../src/systems/purification-chamber-layout';

const width = 640, height = 400, count = width * height;
const out = process.argv[2] ?? 'docs/qa/artifacts/iteration-30-r9/environment';
fs.mkdirSync(out, { recursive: true });
function canvas() {
  let pixels = new Uint8ClampedArray(count*4), dx = 0, dy = 0;
  const stack: [number,number][] = [];
  const context = {
    canvas: { width, height }, imageSmoothingEnabled: false, fillStyle: '#000000',
    fillRect(x:number,y:number,w:number,h:number) {
      const value = parseInt(this.fillStyle.slice(1),16);
      const rgb = [value >> 16, (value >> 8) & 255, value & 255, 255];
      for(let sy=Math.max(0,y+dy);sy<Math.min(height,y+dy+h);sy++)
        for(let sx=Math.max(0,x+dx);sx<Math.min(width,x+dx+w);sx++) pixels.set(rgb,(sy*width+sx)*4);
    },
    translate(x:number,y:number) { dx += x; dy += y; },
    save() { stack.push([dx,dy]); }, restore() { [dx,dy] = stack.pop()!; },
    getImageData() { return { data: pixels.slice(), width, height }; },
    putImageData(image: {data:Uint8ClampedArray}) { pixels = image.data.slice(); },
  };
  return { context: context as unknown as CanvasRenderingContext2D, bytes: () => pixels };
}
async function png(name: string, bytes: Uint8ClampedArray) {
  await sharp(Buffer.from(bytes),{raw:{width,height,channels:4}}).png().toFile(path.join(out,name));
}
function composite(target: Uint8ClampedArray, source: Uint8ClampedArray) {
  for(let i=0;i<count;i++) if(source[i*4+3]) target.set(source.subarray(i*4,i*4+4),i*4);
}
const compositeAlbedo = new Uint8ClampedArray(count*4), compositeBaked = new Uint8ClampedArray(count*4);
const layers = ['far','middle','near','architecture','floor','foreground'] as const;
const layeredRaster: string[] = [];
const manifest: Record<string, unknown> = { revision: ENVIRONMENT_REVISION,
  source: 'assets/source/purification-r9/environment.ts', finishSource:'src/art/chamber-authored-architecture.ts', projection:'X=x, Y=y+Z, Z=elevation',
  size:{width,height}, heightEncoding:'R*256+G; elevation=(value-32768)/32; alpha=coverage',
  normalEncoding:'RGB=(normal+1)*127.5; alpha=coverage',
  note:'No dynamic light. Device comparison uses current production painter. Human art judgment remains open.', layers:[] };
for (const layer of layers) {
  const output = canvas(), surface = new ChamberSurfaceMap(), p = new ChamberPixels(output.context,surface);
  if (layer === 'architecture') paintAuthoredChamberArchitecture(p);
  else if(layer === 'floor') paintAuthoredChamberFloor(p);
  else if(layer === 'foreground') paintAuthoredChamberForeground(p);
  else paintChamberExteriorLayer(p,layer);
  const albedo = output.bytes().slice();
  if (layer === 'floor') {
    const reference = canvas(), refPainter = new ChamberPixels(reference.context);
    for (const points of Object.values(CHAMBER_WALK_POLYGONS))
      refPainter.poly(points.map(p=>[p.x,p.y] as const),'#ffffff');
    const expected=reference.bytes();
    for(let i=0;i<count;i++) assert.equal(albedo[i*4+3],expected[i*4+3],
      `Authored floor must retain exact legal silhouettes at ${i%width},${Math.floor(i/width)}`);
  }
  const normal = new Uint8ClampedArray(count*4), elevation = new Uint8ClampedArray(count*4);
  let opaque = 0, mapped = 0;
  for(let i=0;i<count;i++) {
    if(albedo[i*4+3]) opaque++;
    if(!surface.coverage[i]) continue;
    assert.equal(albedo[i*4+3],255,`surface outside rendered pixels: ${layer}:${i}`);
    mapped++;
    normal.set([(surface.normalX[i]!+1)*127.5,(surface.normalY[i]!+1)*127.5,(surface.normalZ[i]!+1)*127.5,255],i*4);
    const h = Math.round(surface.heights[i]!*32)+32768;
    assert(h >= 0 && h <= 65535);
    elevation.set([h>>8,h&255,0,255],i*4);
  }
  surface.bake(output.context);
  await png(`${layer}.albedo.png`,albedo);
  await png(`${layer}.baked.png`,output.bytes());
  await png(`${layer}.normals.png`,normal);
  await png(`${layer}.height.png`,elevation);
  layeredRaster.push(`<g id="${layer}"><image width="640" height="400" href="data:image/png;base64,${fs.readFileSync(path.join(out,`${layer}.baked.png`)).toString('base64')}"/></g>`);
  composite(compositeAlbedo,albedo); composite(compositeBaked,output.bytes());
  (manifest.layers as unknown[]).push({ layer, opaque, mapped, hash:createHash('sha256').update(albedo).digest('hex') });
}
await png('environment.albedo.png',compositeAlbedo);
await png('environment.baked.png',compositeBaked);
const devices = canvas(), deviceSurfaces = new ChamberSurfaceMap();
paintChamberGrounding(new ChamberPixels(devices.context,deviceSurfaces));
paintChamberDevices(new ChamberPixels(devices.context,deviceSurfaces),{core:1,storage:1,purifier:1,thickenLevel:0,growthLevels:0});
deviceSurfaces.bake(devices.context); composite(compositeBaked,devices.bytes());
await png('composition-with-current-devices.png',compositeBaked);
await sharp(Buffer.from(compositeBaked),{raw:{width,height,channels:4}}).resize(160,100,{kernel:'nearest'}).png().toFile(path.join(out,'composition-quarter.png'));
const escape = (value: string) => value.replaceAll('&','&amp;').replaceAll('"','&quot;');
const groups = layers.map(layer => {
  const base = layer === 'floor' ? Object.entries(CHAMBER_WALK_POLYGONS).map(([route,points]) => `<polygon fill="${route==='main'?MATERIAL.floor:route==='upper'?MATERIAL.upper:MATERIAL.slateWorn}" points="${points.map(p=>`${p.x},${p.y}`).join(' ')}"/>`).join('') : '';
  return `<g id="${layer}">${base}${ENVIRONMENT_FACES.filter(f=>f.layer===layer).map(f=>`<polygon id="${escape(f.id)}" fill="${f.color}" points="${f.points.map(p=>p.join(',')).join(' ')}"/>`).join('')}</g>`;
}).join('\n');
fs.writeFileSync(path.join(out,'authored-structure.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" shape-rendering="crispEdges">${groups}</svg>`);
fs.writeFileSync(path.join(out,'authored-master.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" style="image-rendering:pixelated">${layeredRaster.join('')}</svg>`);
fs.writeFileSync(path.join(out,'surface-manifest.json'),JSON.stringify({...manifest, materials:MATERIAL, faces:ENVIRONMENT_FACES},null,2)+'\n');
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({out,revision:ENVIRONMENT_REVISION,layers:manifest.layers},null,2));
