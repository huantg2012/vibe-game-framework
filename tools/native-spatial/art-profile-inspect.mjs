/** Art diagnostics from a saved real proposal. Never generates or repairs a layout. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {compileNativeTerrain} from '../../src/generation/world-study/native-terrain.ts';
import {compileNativeVolumeRaster, NativeVolumeLighting} from '../../src/generation/world-study/native-volume-raster.ts';

const [sourceFile, output, explicitSeed] = process.argv.slice(2);
assert(sourceFile && output, 'Usage: art-profile-inspect.mjs SAVED_PROPOSAL NEW_DIRECTORY [GEOMETRY_SEED]');
assert(!fs.existsSync(output), 'Art evidence directories are immutable');
const bytes = fs.readFileSync(sourceFile), saved = JSON.parse(bytes), proposal = saved.proposal ?? saved.layout ?? saved;
assert(proposal.definition && proposal.assemblies, 'A complete saved layout proposal is required');
const seed = saved.geometrySeed ?? (explicitSeed === undefined ? Number(path.basename(sourceFile).match(/-(\d+)-\d+\.json$/)?.[1]) : Number(explicitSeed));
assert(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Saved proposal filename or geometrySeed must identify its real geometry seed');
const hash = value => createHash('sha256').update(value).digest('hex');
const sources = ['src/generation/world-study/native-terrain.ts', 'src/generation/world-study/native-volume-geometry.ts', 'src/generation/world-study/native-volume-ground.ts', 'src/generation/world-study/native-volume-organization.ts', 'src/generation/world-study/native-volume-raster.ts'];
const sourceHashes = Object.fromEntries(sources.map(file => [file, hash(fs.readFileSync(file))]));
const terrain = compileNativeTerrain(proposal.definition, seed, false);
fs.mkdirSync(output, {recursive: true});
const material = {base:[142,148,144], dark:[142,148,144], light:[142,148,144], roughness:1, structure:0};
const palette = {outer:material, cut:material, inner:material, joint:material};
const groups = [], totalBodyPx = 20;
for (const assembly of proposal.assemblies) {
  const authoring = saved.input?.assemblies.find(row => row.id === assembly.assemblyId);
  const ids = assembly.instanceIds, mesh = terrain.meshes.filter(row => ids.includes(row.spec.id));
  assert(mesh.length === ids.length, 'Every actual assembly solid must be present');
  const xyz = mesh.flatMap(row => Array.from(row.positions));
  const xx = xyz.filter((_, i) => i % 3 === 0), yy = xyz.filter((_, i) => i % 3 === 1), zz = xyz.filter((_, i) => i % 3 === 2);
  const x = Math.floor(Math.min(...xx)) - 12, y = Math.floor(Math.min(...yy)) - 12;
  const width = Math.ceil(Math.max(...xx)) - x + 12, height = Math.ceil(Math.max(...yy)) - y + 12;
  const raster = compileNativeVolumeRaster(mesh, {x, y, width, height, pixelSize:1, supportCellSize:8, opticalHeight:20});
  const rgba = new Uint8ClampedArray(width * height * 4);
  const lighting = new NativeVolumeLighting(raster, palette);
  lighting.render([{x:x+width/2-160, y:y+height/2-160, z:400, radius:1400, intensity:1.25, color:[1,1,1], castsShadow:false}], rgba, {ambient:.30, emissionScale:0});
  const file = `${assembly.assemblyId}.png`;
  await sharp(Buffer.from(rgba), {raw:{width,height,channels:4}}).png().toFile(path.join(output,file));
  groups.push({id:assembly.assemblyId, kind:authoring?'mother':'subordinate', instanceIds:ids, attachedReliefIds:authoring?.attachedReliefIds??[],
    nativeFootprintPx2:raster.occupiedPixels.length, bounds:{x:x+12,y:y+12,width:width-24,height:height-24}, maxMeshHeight:Math.max(...zz),
    actualSpecs:mesh.map(row=>row.spec), image:file});
}
const sourceHashesAfter = Object.fromEntries(sources.map(file => [file, hash(fs.readFileSync(file))]));
assert.deepEqual(sourceHashesAfter, sourceHashes, 'Native constructors changed during the inspection');
const report = {status:'actual-proposal-profile-diagnostic', sourceFile, sourceHash:hash(bytes), sourceHashes, sourceHashesAfter, sourcesStable:true, geometrySeed:seed,
  geometrySeedSource:saved.geometrySeed!==undefined?'saved geometrySeed':explicitSeed===undefined?'capture-geometry filename contract':'explicit argument supplied by caller', candidate:proposal.candidate, pixelScale:1, totalBodyPx, groups,
  limits:['Saved unadmitted candidate; not a production or gameplay pass.', 'Actual native meshes, solid groups only; associated relief is listed but not rendered.', 'Uniform neutral diagnostic material and fixed light; not final game material, scene lighting or LOS.', 'All image pixels are 1:1 world pixels; no contour edits or individual object scaling.']};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><meta charset="utf-8"><title>实际母体与从属 · 等比例形体核对</title><style>body{background:#151919;color:#cad1cc;font:15px/1.6 system-ui;margin:32px}section{border-top:1px solid #4b514d;padding:16px 0}img{image-rendering:pixelated;background:#202623;max-width:none}p{max-width:1000px}.body{width:20px;height:20px;background:#ddd;display:inline-block;vertical-align:middle}</style><h1>实际母体与从属 · 1:1</h1><p>未准入候选 ${proposal.candidate}，种子 ${seed}。真实 mesh，仅统一中性材质诊断体积；不是游戏截图或材质验收。每张图都是世界 1 px = 图像 1 px，不为填满版面单独缩放。<span class="body"></span> 20 px 身体参照。</p>${groups.map(row=>`<section><h2>${esc(row.id)} · ${row.kind==='mother'?'母体':'从属'}</h2><p>投影面积 ${row.nativeFootprintPx2} px² · 外接 ${row.bounds.width} × ${row.bounds.height} · 最高 ${row.maxMeshHeight.toFixed(1)} px</p><img src="${esc(row.image)}"></section>`).join('')}`);
console.log(JSON.stringify({output,groups:groups.map(({id,kind,nativeFootprintPx2,bounds,maxMeshHeight})=>({id,kind,nativeFootprintPx2,bounds,maxMeshHeight}))},null,2));
