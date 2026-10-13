/** Read existing r11 receipts, cached maps and gallery pixels; never generate a map.
 * From the repository root: node docs/reviews/artifacts/native-generation-2026-10-13/baseline-counts.mjs --check
 * Requires the repository's installed sharp dependency and the receipt's temporary map caches.
 * Without --check, writes only the adjacent baseline-counts.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const receiptPath = 'docs/qa/artifacts/spatial-augmentation-2026-10-13/code/final-v4-medium.json';
const galleryDirectory = 'docs/qa/artifacts/spatial-augmentation-2026-10-13/gallery';
const read = relative => fs.readFileSync(path.resolve(root, relative));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const receiptBytes = read(receiptPath), receipt = JSON.parse(receiptBytes);
assert.equal(receipt.status, 'passed');
assert.equal(receipt.cases.length, 5);

// Exact stored-map hash format used by tools/stealth-obstacles/baseline.mjs.
// Copied here to avoid importing any current map generator or TS dependency.
function exactHash(value) {
  const hash = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) {
      hash.update(`typed:${item.constructor.name}:${item.byteLength}:`)
        .update(new Uint8Array(item.buffer, item.byteOffset, item.byteLength));
      return;
    }
    if (Array.isArray(item)) {
      hash.update(`array:${item.length}[`);
      for (const child of item) visit(child);
      hash.update(']');
      return;
    }
    if (item && typeof item === 'object') {
      hash.update('{');
      for (const key of Object.keys(item)) { visit(key); visit(item[key]); }
      hash.update('}');
      return;
    }
    assert.notEqual(typeof item, 'function');
    const text = item === undefined ? 'undefined' : JSON.stringify(item);
    hash.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value);
  return hash.digest('hex');
}

function fourConnectedComponents(grid, tile) {
  const flat = grid.tiles.flat(), seen = new Uint8Array(flat.length), result = [];
  for (let start = 0; start < flat.length; start++) {
    if (seen[start] || flat[start] !== tile) continue;
    const queue = [start]; seen[start] = 1;
    let touchesBufferEdge = false;
    for (let at = 0; at < queue.length; at++) {
      const cell = queue[at], x = cell % grid.cols, y = Math.floor(cell / grid.cols);
      if (x === 0 || y === 0 || x === grid.cols - 1 || y === grid.rows - 1) touchesBufferEdge = true;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy, next = ny * grid.cols + nx;
        if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows || seen[next] || flat[next] !== tile) continue;
        seen[next] = 1; queue.push(next);
      }
    }
    result.push({areaPx2: queue.length * grid.tileSize ** 2, touchesBufferEdge});
  }
  return result.sort((a, b) => b.areaPx2 - a.areaPx2);
}

const cases = [];
for (const entry of receipt.cases) {
  const cachedMapPath = `${entry.cacheBase}.map.v8.gz`, cachedRecipePath = `${entry.cacheBase}.recipe.json`;
  const mapBytes = fs.readFileSync(cachedMapPath), map = deserialize(gunzipSync(mapBytes));
  const recipeBytes = fs.readFileSync(cachedRecipePath), recipe = JSON.parse(recipeBytes);
  const observedMapHash = exactHash(map);
  assert.equal(observedMapHash, entry.mapHash, 'Stored map must match its passing receipt');
  assert.equal(map.metadata.requestedSeed, entry.requestedSeed);
  assert.equal(map.metadata.effectiveSeed, entry.effectiveSeed);
  const grid = map.layout.tileMap, tileArea = grid.tileSize ** 2;
  assert.equal(grid.tileSize, 8);
  const beforeImagePath = `${galleryDirectory}/${entry.worldId}-before.png`, imageBytes = read(beforeImagePath);
  const decoded = await sharp(imageBytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  assert.equal(decoded.info.width, grid.cols * 4);
  assert.equal(decoded.info.height, grid.rows * 4);
  const colors = {'5,8,9,255': 0, '130,149,148,255': 0, '185,137,83,255': 0};
  for (let i = 0; i < decoded.data.length; i += 4) {
    const color = [...decoded.data.subarray(i, i + 4)].join(',');
    assert(Object.hasOwn(colors, color), `Unexpected before-image pixel ${color}`);
    colors[color]++;
  }
  for (const count of Object.values(colors)) assert.equal(count % 16, 0);
  const baselineMatterCells = (colors['130,149,148,255'] + colors['185,137,83,255']) / 16;
  const finalMatterCells = grid.tiles.flat().filter(tile => tile !== 3).length;
  const solids = fourConnectedComponents(grid, 0), allVoids = fourConnectedComponents(grid, 3);
  const internalVoids = allVoids.filter(part => !part.touchesBufferEdge);
  assert.equal(internalVoids.length, map.native.definition.erosion.length);
  const finalFragment = map.native.diagnostics.spatialAugmentationFragmentShape;
  cases.push({
    worldId: entry.worldId, label: recipe.nativeDefinition.label, grade: entry.grade,
    requestedSeed: entry.requestedSeed, effectiveSeed: entry.effectiveSeed, attempt: entry.attempt,
    evidence: {receiptPath, cachedMapPath, cachedRecipePath, beforeImagePath,
      expectedMapHash: entry.mapHash, observedMapHash, mapHashMatched: true,
      cachedMapSha256: sha256(mapBytes), cachedRecipeSha256: sha256(recipeBytes), beforeImageSha256: sha256(imageBytes)},
    worldDimensionsPx: [grid.cols * grid.tileSize, grid.rows * grid.tileSize], supportCellPx: grid.tileSize,
    baselineGroundAreaPx2: baselineMatterCells * tileArea,
    finalGroundAreaPx2: finalMatterCells * tileArea,
    finalReachableBodySeatCount: map.metadata.reachableBodySeats,
    finalReachableSeatAreaPx2: map.metadata.reachableBodySeats * tileArea,
    baselineReachableSeatAreaPx2: null,
    baselineInternalVoidContourCount: recipe.spatialPolicy.erosion.length,
    finalInternalVoidContourCount: map.native.definition.erosion.length,
    finalInternalVoidGridComponentCount: internalVoids.length,
    finalInternalVoidComponentAreasPx2: internalVoids.map(part => part.areaPx2),
    finalSolidInstanceCount: map.native.definition.instances.filter(instance => instance.role === 'solid').length,
    finalSolid4ConnectedComponentCount: solids.length,
    finalSolidComponentAreasPx2: solids.map(part => part.areaPx2),
    finalReliefInstanceCount: map.native.definition.instances.filter(instance => instance.role === 'relief').length,
    baselineRectangleCounts: {land: recipe.spatialPolicy.fragmentShape.layout.landRects.length, void: recipe.spatialPolicy.fragmentShape.layout.voidRects.length},
    finalRectangleCounts: {land: finalFragment.layout.landRects.length, void: finalFragment.layout.voidRects.length},
    finalHoleVertexCount: map.native.definition.erosion.reduce((sum, polygon) => sum + polygon.length, 0),
    finalLargestHoleVertexCount: Math.max(...map.native.definition.erosion.map(polygon => polygon.length)),
    finalOuterVertexCount: map.native.definition.terrainOutline.length,
    countWarning: '内孔轮廓、solid实例、8px碰撞格四连通团是三种不同计数；均不直接等同玩家遇到或记忆的空间单元。',
  });
}

const output = {
  schemaVersion: 1, recordedOn: '2026-10-13', status: 'extracted-from-existing-evidence',
  scope: '五张既有r11中污染最终地图的只读尺度统计；未运行新地图生成、未重编译基底、未试玩。',
  receipt: {path: receiptPath, sha256: sha256(receiptBytes), status: receipt.status},
  reproduction: {command: 'node docs/reviews/artifacts/native-generation-2026-10-13/baseline-counts.mjs --check',
    dependencies: ['Node.js', 'repository node_modules/sharp', 'temporary cached maps and recipes at each evidence.cachedMapPath/cachedRecipePath'],
    missingCacheBehavior: 'Fail without regenerating maps. These temporary caches are not committed; the JSON and PNG witnesses remain available.'},
  definitions: {
    baselineGroundAreaPx2: '增补前已提交before.png的FLOOR+WALL纯色色块计数；每8px支撑格绘成4×4图像像素，因此每图像像素为4世界px²。包含实体下土地，排除外部VOID和内孔。',
    finalGroundAreaPx2: '已有最终缓存8px tileMap中非VOID格数×64，包含实体占地。',
    finalReachableSeatAreaPx2: '已有metadata.reachableBodySeats×64；20px身体中心的可达采样域面积，不是精确连续可走多边形面积。',
    baselineReachableSeatAreaPx2: '未知：原通过报告未直接记录，且本次禁止重编译基底。',
    finalInternalVoidContourCount: '已有最终definition.erosion.length；独立封闭内孔轮廓数，不含通外界岸湾。',
    finalInternalVoidGridComponentCount: '已有最终8px VOID格四连通域，排除接画布边缘的外部VOID；本五图与轮廓数一致。',
    finalSolidInstanceCount: '最终definition.instances中role=solid的对象数；相接实例可能成为同一物理团。',
    finalSolid4ConnectedComponentCount: '最终8px WALL碰撞格的四连通团数，无尺寸或感知筛选，不是语义障碍团数。',
  },
  limitations: [
    '不是全108世界或全部种子统计，不能代表最佳数量、密度或潜行体验。',
    '原面积依赖已提交无抗锯齿、无标记的before.png与render-batch.mjs的固定配色/4倍最近邻输出契约；脚本核对尺寸、纯色与16像素整倍数，不声称PNG等于独立几何重测。',
    '内孔数不包含外岸开口/岸湾；任意void矩形数不等于独立内孔数。',
    '四连通碰撞团未按人可识别尺寸、局部观察顺序或玩法作用过滤，不能直接当作2:1玩家遭遇比。',
    '缓存mapHash与原通过报告完全核对；没有重跑当前生成器，原报告验证范围不提升。',
  ], cases,
};
const text = `${JSON.stringify(output, null, 2)}\n`, target = path.join(directory, 'baseline-counts.json');
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8'), text, 'Stored baseline counts differ from existing evidence');
else fs.writeFileSync(target, text);
console.log(`PASS existing-evidence extraction: ${cases.length} maps, no generation (${process.argv.includes('--check') ? 'checked' : 'recorded'})`);
