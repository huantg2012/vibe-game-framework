import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { renderDensePlayerFrame } from '../../../../src/entities/player-sprite-dense.ts';
import { buildHaven } from './scene.ts';
import { CAMERA, cameraBasis, project, render } from './render.ts';
import { dot, Model } from './model.ts';
import { WALK_SURFACES } from './environment.ts';
const here = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'assets');
await fs.mkdir(output, { recursive: true });
const { model, stations } = buildHaven();
console.log(`Scene: ${model.triangles.length} triangles, ${stations.length} stations, ${model.lights.length} local lights.`);
const result = render(model, CAMERA, console.log);
const format = { raw: { width: CAMERA.width, height: CAMERA.height, channels: 4 } };
await sharp(Buffer.from(result.rgba), format).png().toFile(path.join(output, 'haven-clean.png'));
/** Same original production actor, same 33px body. Scene geometry can occlude
 * the actor by its pixel depth; the painted background is not a clickable mock. */
function player(r, feet) {
    const pixels = r.rgba.slice(), frame = renderDensePlayerFrame('up', 'idle', 0), screen = project(feet), basis = cameraBasis(CAMERA), s = 1.5;
    const left = Math.round(screen[0] - 24), top = Math.round(screen[1] - 39);
    const actorDepth = dot(feet, basis.back) + .28;
    // A contact shadow anchors the sprite to the baked floor, before its body.
    for(let dy=-5;dy<=5;dy++)for(let dx=-15;dx<=15;dx++){
        const x=Math.round(screen[0])+dx,y=Math.round(screen[1])+dy;
        if(x<0||x>=CAMERA.width||y<0||y>=CAMERA.height)continue;
        const falloff=Math.exp(-((dx/7)**2+(dy/2.6)**2))*.28,p=(y*CAMERA.width+x)*4;
        for(let k=0;k<3;k++)pixels[p+k]=Math.round(pixels[p+k]*(1-falloff));
    }
    for (let y = 0; y < 48; y++)
        for (let x = 0; x < 48; x++) {
            const sx = Math.floor(x / s), sy = Math.floor(y / s), source = (sy * 32 + sx) * 4;
            if (!frame[source + 3])
                continue;
            const xx = left + x, yy = top + y;
            if (xx < 0 || xx >= CAMERA.width || yy < 0 || yy >= CAMERA.height)
                continue;
            const i = yy * CAMERA.width + xx, bodyHeight = (39 - y) / CAMERA.scale / Math.max(.1, basis.up[1]);
            if (r.depth[i] > actorDepth + Math.max(0, bodyHeight) * basis.back[1] + .38)
                continue;
            const p = i * 4;
            pixels[p] = Math.round(frame[source] * .93);
            pixels[p + 1] = Math.round(frame[source + 1] * .96);
            pixels[p + 2] = Math.round(frame[source + 2] * 1.01);
            pixels[p + 3] = 255;
        }
    return pixels;
}
const actorPosition = [3.8, 0, 3.8];
await sharp(Buffer.from(player(result, actorPosition)), format).png().toFile(path.join(output, 'haven.png'));
await sharp(path.join(output, 'haven.png')).resize(1920, 1280, { kernel: 'nearest' }).png().toFile(path.join(output, 'haven-2x.png'));
const depthImage = new Uint8ClampedArray(CAMERA.width * CAMERA.height * 4), objectImage = depthImage.slice();
for (let i = 0; i < result.depth.length; i++) {
    const value = Number.isFinite(result.depth[i]) ? Math.max(0, Math.min(65535, Math.round((result.depth[i] + 80) * 256))) : 0;
    depthImage.set([value >> 8, value & 255, result.layers[i], 255], i * 4);
    objectImage.set([result.objects[i], 0, 0, 255], i * 4);
}
await sharp(Buffer.from(depthImage), format).png().toFile(path.join(output, 'depth-layers.png'));
await sharp(Buffer.from(objectImage), format).png().toFile(path.join(output, 'object-ids.png'));
const projected = stations.map(station => {
    const triangles = model.triangles.filter(t => t.object === station.id);
    const vertices = triangles.flatMap(t => [t.a, t.b, t.c]).map(p => project(p));
    const bounds = { x: Math.floor(Math.min(...vertices.map(v => v[0]))) - 7, y: Math.floor(Math.min(...vertices.map(v => v[1]))) - 7, right: Math.ceil(Math.max(...vertices.map(v => v[0]))) + 7, bottom: Math.ceil(Math.max(...vertices.map(v => v[1]))) + 7 };
    const x = Math.max(0, bounds.x), y = Math.max(0, bounds.y), width = Math.min(CAMERA.width, bounds.right) - x, height = Math.min(CAMERA.height, bounds.bottom) - y;
    if (width <= 0 || height <= 0)
        throw new Error(`Station outside camera: ${station.key}`);
    return { ...station, screen: project(station.position), approachScreen: project(station.approach), bounds: { x, y, width, height }, triangles: triangles.length };
});
// Individual models use the same authored geometry and light directions. A
// closer fixed pixel grid reveals construction; these are separate art views,
// not enlarged scene crops or claims about the production sprite resolution.
for(const station of projected){
    const isolated=new Model();isolated.triangles.push(...model.triangles.filter(t=>t.object===station.id));isolated.lights.push(...model.lights);
    const points=isolated.triangles.flatMap(t=>[t.a,t.b,t.c]).map(p=>project(p,{...CAMERA,scale:1,origin:[0,0]}));
    const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    const scale=Math.min(74,278/Math.max(maxX-minX,maxY-minY));
    const camera={...CAMERA,width:384,height:384,scale,origin:[192-(minX+maxX)/2*scale,192-(minY+maxY)/2*scale]};
    const portrait=render(isolated,camera);
    for(let i=0;i<portrait.objects.length;i++)if(!portrait.objects[i])portrait.rgba[i*4+3]=0;
    station.modelAsset=`model-${station.key}.png`;station.modelCamera=camera;
    await sharp(Buffer.from(portrait.rgba),{raw:{width:384,height:384,channels:4}}).png().toFile(path.join(output,station.modelAsset));
    console.log(`Exported ${station.key} model.`);
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ reference: 'public/assets/art/menu-last-light.png', method: 'Deterministic authored geometry rasterized directly to a fixed pixel grid; world-scale material paint, ray-tested direct light and four-ray contact occlusion. No generated image sampled as scene artwork.', camera: CAMERA, actor: { position: actorPosition,screen:project(actorPosition),source:'src/entities/player-sprite-dense.ts',bodyPixels:33 }, stations: projected, walkSurfaces:WALK_SURFACES,triangles: model.triangles.length, depthEncoding: 'RG = round((cameraDepth + 80) * 256), B = far 1 / middle 2 / near 3 / haven 4; zero RG is empty.', status: 'ART-CANDIDATE / NOT-PRODUCTION-INTEGRATED / HUMAN-REVIEW-PENDING' }, null, 2) + '\n');
console.log(`Exported full scene and six station bounds to ${output}.`);
const checksums={method:'SHA-256',sources:{},outputs:{}};
for(const filename of ['model.ts','render.ts','environment.ts','devices.ts','scene.ts','export.mjs','viewer.ts','index.html','check.mjs'])checksums.sources[filename]=createHash('sha256').update(await fs.readFile(path.join(here,filename))).digest('hex');
for(const filename of (await fs.readdir(output)).filter(f=>f.endsWith('.png')||f==='manifest.json'))checksums.outputs[filename]=createHash('sha256').update(await fs.readFile(path.join(output,filename))).digest('hex');
await fs.writeFile(path.join(output,'checksums.json'),JSON.stringify(checksums,null,2)+'\n');
