/** Read-only gallery from completed production receipts and temporary full maps. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {createR100SpatialBaselineTerrain} from '../../src/generation/world-study/r100-spatial-world.ts';
import {compileNativeTerrain} from '../../src/generation/world-study/native-terrain.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {bakeMasterWorldSurface} from '../../src/systems/r100-world/surface-bake.ts';
import {bakeSearchSitePatches} from '../../src/systems/r100-world/search-site-bake.ts';
import {applySearchSitePatch} from '../../src/systems/r100-world/search-site-patches.ts';
import {readPainting, exactHash} from '../stealth-obstacles/baseline.mjs';
import {TileType} from '../../src/types/game-types.ts';

const [receiptPath, output] = process.argv.slice(2);
assert(receiptPath && output, 'Usage: render-batch.mjs COMPLETED_REPORT NEW_OUTPUT_DIR');
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
assert.equal(receipt.status, 'passed', 'Only completed passing production receipts can supply this gallery');
assert(receipt.cases.length > 0 && receipt.cases.length <= 5);
assert(!fs.existsSync(output), 'Refusing to overwrite visual evidence');
fs.mkdirSync(output, {recursive:true});
const esc = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const rows = [], materialHashes = {};
async function geometryImage(tileMap, file, landmarks) {
  const rgba = Buffer.alloc(tileMap.cols * tileMap.rows * 4);
  for (let y=0;y<tileMap.rows;y++) for(let x=0;x<tileMap.cols;x++) {
    const tile=tileMap.tiles[y][x], i=(y*tileMap.cols+x)*4;
    const color=tile===TileType.VOID?[5,8,9]:tile===TileType.WALL?[185,137,83]:[130,149,148];
    for(let c=0;c<3;c++)rgba[i+c]=color[c];rgba[i+3]=255;
  }
  const width=tileMap.cols*4,height=tileMap.rows*4;
  const pixels=await sharp(rgba,{raw:{width:tileMap.cols,height:tileMap.rows,channels:4}})
    .resize(width,height,{kernel:'nearest'}).png().toBuffer();
  let result=sharp(pixels);
  if(landmarks){
    const s={x:landmarks.spawn.x/2,y:landmarks.spawn.y/2},e={x:landmarks.extraction.x/2,y:landmarks.extraction.y/2};
    const svg=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><circle cx="${s.x}" cy="${s.y}" r="7" fill="#071012" stroke="#fff" stroke-width="3"/><path d="M ${e.x} ${e.y-9} L ${e.x+8} ${e.y} L ${e.x} ${e.y+9} L ${e.x-8} ${e.y} Z" fill="#071012" stroke="#ffca66" stroke-width="3"/></svg>`;
    result=result.composite([{input:Buffer.from(svg)}]);
  }
  await result.png().toFile(file);
}
for(const entry of receipt.cases) {
  const recipe=JSON.parse(fs.readFileSync(`${entry.cacheBase}.recipe.json`,'utf8'));
  const map=deserialize(gunzipSync(fs.readFileSync(`${entry.cacheBase}.map.v8.gz`)));
  assert.equal(exactHash(map),entry.mapHash,'Cached map must match the tested map');
  const base=createR100SpatialBaselineTerrain(recipe.nativeDefinition,recipe.spatialPolicy,map.metadata.effectiveSeed);
  const terrain=compileNativeTerrain(base.definition,map.metadata.effectiveSeed);
  const id=entry.worldId;
  await geometryImage(terrain.tileMap,path.join(output,`${id}-before.png`));
  await geometryImage(map.layout.tileMap,path.join(output,`${id}-after.png`),{spawn:map.layout.spawnPoint,extraction:map.layout.extractionPoint.position});
  const world=hydrateR100MasterWorld(map.native,map.layout),painting=await readPainting(recipe,materialHashes);
  const surface=bakeMasterWorldSurface(world,painting);
  for(const patch of bakeSearchSitePatches(world,surface,painting))applySearchSitePatch(surface,patch,patch.intact);
  await sharp(Buffer.from(surface.albedo),{raw:{width:surface.width,height:surface.height,channels:4}})
    .resize({width:1400,withoutEnlargement:true}).png().toFile(path.join(output,`${id}-material.png`));
  const trace=map.native.diagnostics.spatialAugmentation;
  assert(trace,'Actual augmentation trace required');
  rows.push({worldId:id,label:recipe.nativeDefinition.label,grade:entry.grade,requestedSeed:entry.requestedSeed,
    effectiveSeed:map.metadata.effectiveSeed,mapHash:entry.mapHash,augmentation:trace,deployment:entry.deployment,
    generationMs:entry.generationMs,spawn:map.layout.spawnPoint,extraction:map.layout.extractionPoint.position});
  console.log(`Rendered ${id}: ${trace.status}`);global.gc?.();
}
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({status:'completed',receiptPath,materialHashes,cases:rows,
  limits:['Only listed tested production cases; not an all-world or player experience verdict.',
    'Structure views are actual 8px support/collision grids; beige solid blocks movement but does not block sight.',
    'Material image uses production surface channels without gameplay lighting/fog; base view excludes augmentation only.']},null,2)+'\n');
const pct=(a,b)=>b?`${((1-a/b)*100).toFixed(1)}%`:'基底无缺口';
const content=rows.map(row=>{
  const t=row.augmentation;
  return `<section id="${esc(row.worldId)}"><h2>${esc(row.label)} <small>${esc(row.worldId)}</small></h2>
  <p>新增实体 ${t.addedSolidIds.length} · 新增空洞 ${t.addedVoidCount} · 身体结构缺口下降 ${pct(t.remainingDeficits.physical,t.baselineDeficits.physical)} · 遮视缺口下降 ${pct(t.remainingDeficits.occlusion,t.baselineDeficits.occlusion)}</p>
  <p class="status">停止原因：${esc(t.status)}；${t.fallback?'最终部署使用回退候选':'最终部署使用首选候选'}。生成 ${(row.generationMs/1000).toFixed(1)} 秒（离线，不含浏览器载入）。</p>
  <div class="pair"><figure><figcaption>同种子基底 · 增补前（未部署内容）</figcaption><img loading="lazy" src="${esc(row.worldId)}-before.png"></figure><figure><figcaption>最终正式地图 · 增补后</figcaption><img loading="lazy" src="${esc(row.worldId)}-after.png"></figure></div>
  <details><summary>查看正式材质去雾全图</summary><img loading="lazy" class="material" src="${esc(row.worldId)}-material.png"></details>
  <details><summary>候选与拒绝原因</summary><pre>${esc(JSON.stringify(t,null,2))}</pre></details></section>`;
}).join('');
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>实体与空洞 · 联合增补检查</title>
<style>*{box-sizing:border-box}body{margin:0;background:#111718;color:#d9e0d9;font:15px/1.7 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:32px}h1{font-size:28px}h2{font-size:21px;margin:0}small{font-size:13px;color:#8da19b;font-weight:400}p{margin:8px 0;color:#aabdb3}a{color:#c0d8c6}nav{display:flex;gap:22px;flex-wrap:wrap;margin:24px 0}section{padding:30px 0;border-top:1px solid #354442}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:12px 0}figcaption{color:#b8c4bd;margin-bottom:8px}img{display:block;width:100%;background:#050809}.status{color:#c4b695}details{margin-top:18px}summary{cursor:pointer;color:#c0d8c6}pre{white-space:pre-wrap;font:12px/1.5 monospace;max-height:420px;overflow:auto}.material{margin-top:12px;max-width:1400px}.legend{padding:12px 0;color:#c4cfc9}</style>
<main><h1>实体与空洞 · 联合增补检查</h1><p>同一正式管线、同一有效种子的基底与最终地形。${rows.length}张中污染有限样本；策略接入与全库体验验收分开。</p>
<p class="legend">灰绿：真实地面　赭色：行进障碍　黑色：缺地、阻行并遮视的VOID。白圈：出生点　金色菱形：撤离点。结构图按真实8px支持格显示。</p>
<p>达到停止条件不代表全图潜行通过。残余缺口、回退和拒绝均保留在记录中。<a href="manifest.json">读取完整证据</a></p>
<nav>${rows.map(row=>`<a href="#${esc(row.worldId)}">${esc(row.label)}</a>`).join('')}</nav>${content}</main></html>`);
console.log(`Gallery: ${output}/index.html`);
