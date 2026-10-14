/** Actual admitted maps only; no reroll, hand repair or illustrative geometry. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {bakeMasterWorldSurface} from '../../src/systems/r100-world/surface-bake.ts';
import {bakeSearchSitePatches} from '../../src/systems/r100-world/search-site-bake.ts';
import {applySearchSitePatch} from '../../src/systems/r100-world/search-site-patches.ts';
import {TileType} from '../../src/types/game-types.ts';
import {exactHash,readPainting,sha256} from '../stealth-obstacles/baseline.mjs';
const [receiptFile,output]=process.argv.slice(2);assert(receiptFile&&output,'Usage: render-receipt.mjs RECEIPT NEW_DIRECTORY');
const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));assert(['passed','failed'].includes(receipt.status),'Only completed receipts');assert.equal(receipt.sourcesStable,true,'Generation sources must remain stable');assert(receipt.cases.length>0&&receipt.cases.length<=5);
assert(!fs.existsSync(output),'Evidence directories are immutable');fs.mkdirSync(output,{recursive:true});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=[],materialHashes={};
for(const row of receipt.cases){
 const recipe=JSON.parse(fs.readFileSync(`${row.cacheBase}.recipe.json`,'utf8'));
 const map=deserialize(gunzipSync(fs.readFileSync(`${row.cacheBase}.map.v8.gz`)));assert.equal(exactHash(map),row.mapHash);
 const id=`${row.worldId}-${row.grade}-${row.requestedSeed}`,tile=map.layout.tileMap,pixels=Buffer.alloc(tile.cols*tile.rows*4);
 for(let y=0;y<tile.rows;y++)for(let x=0;x<tile.cols;x++){
  const color=tile.tiles[y][x]===TileType.VOID?[4,7,8]:tile.tiles[y][x]===TileType.WALL?[192,145,89]:[133,152,149],at=(y*tile.cols+x)*4;
  for(let c=0;c<3;c++)pixels[at+c]=color[c];pixels[at+3]=255;
 }
 const width=tile.cols*4,height=tile.rows*4,spawn=map.layout.spawnPoint,exit=map.layout.extractionPoint.position;
 const marks=Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><circle cx="${spawn.x/2}" cy="${spawn.y/2}" r="7" fill="#080b0c" stroke="#fff" stroke-width="3"/><path d="M ${exit.x/2} ${exit.y/2-9} l 8 9 l -8 9 l -8 -9 Z" fill="#080b0c" stroke="#ffca66" stroke-width="3"/></svg>`);
 const base=await sharp(pixels,{raw:{width:tile.cols,height:tile.rows,channels:4}}).resize(width,height,{kernel:'nearest'}).png().toBuffer();
 await sharp(base).composite([{input:marks}]).png().toFile(path.join(output,`${id}-structure.png`));
 const world=hydrateR100MasterWorld(map.native,map.layout),painting=await readPainting(recipe,materialHashes),surface=bakeMasterWorldSurface(world,painting);
 for(const patch of bakeSearchSitePatches(world,surface,painting))applySearchSitePatch(surface,patch,patch.intact);
 await sharp(Buffer.from(surface.albedo),{raw:{width:surface.width,height:surface.height,channels:4}}).resize({width:1400,withoutEnlargement:true}).png().toFile(path.join(output,`${id}-material.png`));
 rows.push({id,worldId:row.worldId,label:recipe.nativeDefinition.label,requestedSeed:row.requestedSeed,effectiveSeed:row.effectiveSeed,grade:row.grade,mapHash:row.mapHash,albedoHash:sha256(surface.albedo),generationMs:row.generationMs,spawn,exit,diagnostics:map.native.diagnostics});
 console.log(`Rendered ${id}`);global.gc?.();
}
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({receiptFile,batchStatus:receipt.status,failures:receipt.failures,materialHashes,cases:rows,limits:['Actual accepted production maps, only listed samples.','Material view is surface albedo without gameplay fog/lighting; not a normal camera view.']},null,2)+'\n');
const failed=(receipt.failures??[]).map(row=>`<li>${esc(row.worldId)} / ${esc(row.grade)} / ${row.requestedSeed}：${esc(String(row.error).split('\n')[0])}</li>`).join('');
const content=rows.map(row=>`<section id="${esc(row.id)}"><h2>${esc(row.label)} <small>${esc(row.worldId)}</small></h2><p>请求种子 ${row.requestedSeed} · 实际种子 ${row.effectiveSeed} · ${esc(row.grade)} · ${(row.generationMs/1000).toFixed(1)} 秒</p><div class="pair"><figure><figcaption>真实支撑与阻挡 · 白圈出生／金菱撤离</figcaption><img src="${row.id}-structure.png" loading="lazy"></figure><figure><figcaption>正式材质全图 · 不含迷雾与运行时灯光</figcaption><img src="${row.id}-material.png" loading="lazy"></figure></div><details><summary>查看该图原始准入记录</summary><pre>${esc(JSON.stringify(row.diagnostics,null,2))}</pre></details></section>`).join('');
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>原生联合生成 · 实际地图检查</title><style>*{box-sizing:border-box}body{margin:0;background:#111718;color:#d9e0d9;font:15px/1.7 system-ui,sans-serif}main{max-width:1700px;margin:auto;padding:32px}h1{font-size:28px}h2{font-size:21px}small{font-size:13px;color:#94a69f;font-weight:400}p{color:#adbbb5}a{color:#c4d8ca}nav{display:flex;gap:24px;flex-wrap:wrap;margin:24px 0}section{padding:24px 0;border-top:1px solid #354442}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:12px 0}figcaption{margin-bottom:10px;color:#b7c5bd}img{width:100%;display:block;background:#040708}summary{cursor:pointer}pre{white-space:pre-wrap;max-height:500px;overflow:auto;font:12px/1.6 monospace}</style><main><h1>原生联合生成 · 实际地图检查</h1><p>土地、内部空洞和实体在同一布局阶段生成。以下 ${rows.length} 张来自完整准入后的实际地图，未作图像修补；限定样本不代表全库或潜行体验通过。</p>${failed?`<aside><h2>本批仍有未准入请求</h2><p>以下失败保留在同一份回执中，不能把本页已生成图解读为整批通过。</p><ul>${failed}</ul></aside>`:''}<p>灰绿为地面，赭色实体仅阻行，黑色空间缺失同时阻行与遮视。<a href="manifest.json">完整证据</a></p><nav>${rows.map(r=>`<a href="#${r.id}">${esc(r.label)}</a>`).join('')}</nav>${content}</main></html>`);
console.log(path.join(output,'index.html'));
