// A-G3 合成测试 loop 脚本（一次性工具，非游戏运行时）。
// 流程：源图预处理(亮度归一/可选边缘镜像) -> 跑管线(可选滤镜/亮度) -> 验收 -> 合成场景+对照表 -> 打印客观指标。
// 用法: npx tsx docs/art/demos/rift-synth/loop.mjs --suffix loop1 --filter mitchell --tileTarget 20 --decalTarget 22 [--mirror] [--gradeB 1.0]
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..', '..', '..', '..'); // repo root
const imp = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const { runPipeline } = await imp('tools/art-pipeline/src/postprocess.ts');
const { verifyImage } = await imp('tools/art-pipeline/src/verify.ts');
const { loadRaw, loadPalette } = await imp('tools/art-pipeline/src/io.ts');

// ---- args ----
const A = process.argv.slice(2);
const arg = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const has = (k) => A.includes(k);
const SUFFIX = arg('--suffix', 'loop');
const FILTER = arg('--filter', 'mitchell');       // nearest | mitchell | lanczos3
const TILE_TARGET = Number(arg('--tileTarget', '20'));
const DECAL_TARGET = Number(arg('--decalTarget', '22'));
const GRADE_B = Number(arg('--gradeB', '1.0'));
const GRADE_S = Number(arg('--sat', '0.85'));
const MIRROR = has('--mirror');
const ROTATE_FLOORS = has('--rotateFloors');
const WEIGHTS = arg('--weights', '40,25,25,10').split(',').map(Number); // base,crack,worn,seam
const DECAL_COUNT = Number(arg('--decalCount', '11'));

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// 归一：把内容像素平均亮度缩放到 target（整图同倍缩放，保留色相与内部变化）
function normalize(raw, target, opaqueOnly) {
  const { data, width, height } = raw;
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (opaqueOnly) { // 只统计非近黑背景像素（chroma #080a0c 附近视为背景）
      const dist = Math.abs(r - 8) + Math.abs(g - 10) + Math.abs(b - 12);
      if (dist < 40) continue;
    }
    sum += luma(r, g, b); n++;
  }
  const mean = n ? sum / n : 1;
  const f = target / Math.max(mean, 0.5);
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.min(255, Math.round(out[i] * f));
    out[i + 1] = Math.min(255, Math.round(out[i + 1] * f));
    out[i + 2] = Math.min(255, Math.round(out[i + 2] * f));
  }
  return { data: out, width, height, meanBefore: mean };
}

// 边缘镜像混合：让 tile 上下/左右边缘趋于无缝（对噪声地面有效）
function mirrorBlend(raw) {
  const { data, width, height } = raw;
  const out = Buffer.from(data);
  const feather = Math.floor(width * 0.12);
  const at = (buf, x, y, c) => buf[(y * width + x) * 4 + c];
  const set = (buf, x, y, c, v) => { buf[(y * width + x) * 4 + c] = v; };
  for (let y = 0; y < height; y++) for (let x = 0; x < feather; x++) {
    const w = 0.5 * (1 - x / feather); // 边缘权重
    for (let c = 0; c < 3; c++) {
      // 左右混合
      const lv = at(data, x, y, c), rv = at(data, width - 1 - x, y, c);
      set(out, x, y, c, Math.round(lv * (1 - w) + rv * w));
      set(out, width - 1 - x, y, c, Math.round(rv * (1 - w) + lv * w));
    }
  }
  const out2 = Buffer.from(out);
  for (let x = 0; x < width; x++) for (let y = 0; y < feather; y++) {
    const w = 0.5 * (1 - y / feather);
    for (let c = 0; c < 3; c++) {
      const tv = at(out, x, y, c), bv = at(out, x, height - 1 - y, c);
      set(out2, x, y, c, Math.round(tv * (1 - w) + bv * w));
      set(out2, x, height - 1 - y, c, Math.round(bv * (1 - w) + tv * w));
    }
  }
  return { data: out2, width, height };
}

async function prep(base, names, target, opaqueOnly, mirror, outDir) {
  mkdirSync(outDir, { recursive: true });
  const stats = [];
  for (const name of names) {
    const png = await sharp(join(base, name + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let raw = { data: png.data, width: png.info.width, height: png.info.height };
    const norm = normalize(raw, target, opaqueOnly);
    raw = { data: norm.data, width: raw.width, height: raw.height };
    if (mirror && !opaqueOnly) raw = mirrorBlend(raw); // 只对 tile 做镜像，decal 不做
    await sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } }).png()
      .toFile(join(outDir, name + '.png'));
    stats.push({ name, meanBefore: norm.meanBefore.toFixed(1) });
  }
  return stats;
}

const TILES = ['tile-rift-floor-metro-base', 'tile-rift-floor-metro-crack', 'tile-rift-floor-metro-worn', 'tile-rift-floor-metro-seam', 'tile-rift-wall-metro-straight', 'tile-rift-wall-metro-corner', 'tile-rift-error-small', 'tile-rift-error-large'];
const DECALS = ['decal-rift-teal-crack', 'decal-rift-debris'];
const FLOORS = ['tile-rift-floor-metro-base', 'tile-rift-floor-metro-crack', 'tile-rift-floor-metro-worn', 'tile-rift-floor-metro-seam'];

function baseCfg(sourceDir, outputDir, stages, acceptance) {
  return { targetSize: { width: 32, height: 32 }, sourceDir, outputDir, paletteFile: join(ROOT, 'docs/art/palette.json'), stages, acceptance };
}

async function main() {
  const prepT = join(DIR, `prep-tiles.${SUFFIX}`);
  const prepD = join(DIR, `prep-decals.${SUFFIX}`);
  const outT = join(DIR, `out-tiles.${SUFFIX}`);
  const outD = join(DIR, `out-decals.${SUFFIX}`);

  const st = await prep(join(DIR, 'src-tiles'), TILES, TILE_TARGET, false, MIRROR, prepT);
  const sd = await prep(join(DIR, 'src-decals'), DECALS, DECAL_TARGET, true, MIRROR, prepD);

  const tileStages = [
    { name: 'colorGrade', enabled: true, brightness: GRADE_B, saturation: GRADE_S, tint: [20, 26, 30], tintAmount: 0.08 },
    { name: 'downscale', enabled: true, filter: FILTER },
    { name: 'quantize', enabled: true },
    { name: 'cropPad', enabled: true, padding: 2 },
  ];
  const decalStages = [
    { name: 'bgRemove', enabled: true, method: 'chroma', color: [8, 10, 12], threshold: 24 },
    ...tileStages,
  ];
  const tileAcc = { maxAvgBrightness: 30, requireTransparentBg: false, paletteConformance: 0.9, paletteTolerance: 24, exactSize: [32, 32] };
  const decalAcc = { ...tileAcc, requireTransparentBg: true };

  const cfgTPath = join(DIR, `cfg-tiles.${SUFFIX}.json`);
  const cfgDPath = join(DIR, `cfg-decals.${SUFFIX}.json`);
  writeFileSync(cfgTPath, JSON.stringify(baseCfg(prepT, outT, tileStages, tileAcc), null, 2));
  writeFileSync(cfgDPath, JSON.stringify(baseCfg(prepD, outD, decalStages, decalAcc), null, 2));

  await runPipeline(cfgTPath);
  await runPipeline(cfgDPath);

  // 验收
  const palette = await loadPalette(join(ROOT, 'docs/art/palette.json'));
  const results = [];
  const means = {};
  for (const n of TILES) { const img = await loadRaw(join(outT, n + '.png')); const r = verifyImage(img, tileAcc, palette); results.push({ n, ...r }); means[n] = r.metrics.avgBrightness; }
  for (const n of DECALS) { const img = await loadRaw(join(outD, n + '.png')); const r = verifyImage(img, decalAcc, palette); results.push({ n, ...r }); means[n] = r.metrics.avgBrightness; }

  // 客观棋盘指标：四种地面输出均值的标准差
  const fm = FLOORS.map(n => means[n]);
  const fmean = fm.reduce((a, b) => a + b, 0) / fm.length;
  const fstd = Math.sqrt(fm.reduce((a, b) => a + (b - fmean) ** 2, 0) / fm.length);

  // ---- 合成场景 ----
  await compose(outT, outD, SUFFIX);

  // ---- 打印摘要 ----
  console.log(`\n===== ${SUFFIX} (filter=${FILTER}, tileTarget=${TILE_TARGET}, decalTarget=${DECAL_TARGET}, mirror=${MIRROR}, gradeB=${GRADE_B}) =====`);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.n}  avg=${means[r.n].toFixed(1)}${r.failures.length ? '  :: ' + r.failures.join('; ') : ''}`);
  console.log(`\nFLOOR output means: ${FLOORS.map((n, i) => n.replace('tile-rift-floor-metro-', '') + '=' + fm[i].toFixed(1)).join(', ')}`);
  console.log(`FLOOR mean-of-means=${fmean.toFixed(1)}  STDDEV(checkerboard metric)=${fstd.toFixed(2)}  (lower=less checkerboard)`);
  const allPass = results.every(r => r.pass);
  console.log(`\nVERIFY: ${allPass ? 'ALL PASS ✅' : 'SOME FAIL ❌'}`);
  console.log(`images: composed-raw.${SUFFIX}.png, composed-masked.${SUFFIX}.png, contact.${SUFFIX}.png (in ${DIR})`);
}

// 确定性 RNG
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

async function compose(TILESDIR, DECALSDIR, suffix) {
  const T = 32, COLS = 20, ROWS = 13, UP = 3;
  const rng = mulberry32(20260729);
  const pick = a => a[Math.floor(rng() * a.length)];
  const weighted = pairs => { const s = pairs.reduce((a, [, w]) => a + w, 0); let r = rng() * s; for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; };
  const FLOORW = [['tile-rift-floor-metro-base', WEIGHTS[0]], ['tile-rift-floor-metro-crack', WEIGHTS[1]], ['tile-rift-floor-metro-worn', WEIGHTS[2]], ['tile-rift-floor-metro-seam', WEIGHTS[3]]];
  const tbuf = async (dir, n, rot) => { let s = sharp(join(dir, n + '.png')).resize(T, T, { kernel: 'nearest' }); if (rot) s = s.rotate(rot); return s.toBuffer(); };

  const grid = [], grot = [];
  for (let r = 0; r < ROWS; r++) { grid[r] = []; grot[r] = []; for (let c = 0; c < COLS; c++) {
    if (r === 0) grid[r][c] = (c === 0 || c === COLS - 1) ? 'tile-rift-wall-metro-corner' : 'tile-rift-wall-metro-straight';
    else if (r === 4 && c >= 6 && c <= 13) grid[r][c] = 'tile-rift-wall-metro-straight';
    else grid[r][c] = weighted(FLOORW);
    // 只旋转地面 tile；墙/错误块保持朝向
    grot[r][c] = (ROTATE_FLOORS && grid[r][c].startsWith('tile-rift-floor')) ? pick([0, 90, 180, 270]) : 0;
  } }
  for (const [r, c] of [[7, 3], [9, 15], [3, 10]]) { grid[r][c] = 'tile-rift-error-small'; grot[r][c] = 0; }
  grid[8][9] = 'tile-rift-error-large'; grot[8][9] = 0;

  const W = COLS * T, H = ROWS * T;
  const comps = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) comps.push({ input: await tbuf(TILESDIR, grid[r][c], grot[r][c]), top: r * T, left: c * T });
  let scene = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 8, g: 10, b: 12, alpha: 1 } } }).composite(comps).png().toBuffer();

  const dcomps = []; let placed = 0, tries = 0;
  while (placed < DECAL_COUNT && tries < 600) { tries++; const r = Math.floor(rng() * ROWS), c = Math.floor(rng() * COLS); if (!grid[r][c].startsWith('tile-rift-floor')) continue; const name = placed % 2 === 0 ? 'decal-rift-teal-crack' : 'decal-rift-debris'; const rot = pick([0, 90, 180, 270]); const buf = await sharp(join(DECALSDIR, name + '.png')).resize(T, T, { kernel: 'nearest' }).rotate(rot).toBuffer(); dcomps.push({ input: buf, top: r * T, left: c * T }); placed++; }
  scene = await sharp(scene).composite(dcomps).png().toBuffer();

  await sharp(scene).resize(W * UP, H * UP, { kernel: 'nearest' }).png().toFile(join(DIR, `composed-raw.${suffix}.png`));

  const px = 10 * T + 16, py = 8 * T + 16, rSolid = 2.0 * T, rFull = 6.0 * T;
  const mask = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - px, y - py); let v; if (d <= rSolid) v = 1; else if (d >= rFull) v = 0.06; else v = 1 - 0.94 * ((d - rSolid) / (rFull - rSolid)); const i = (y * W + x) * 4; mask[i] = mask[i + 1] = mask[i + 2] = Math.round(255 * v); mask[i + 3] = 255; }
  const maskPng = await sharp(mask, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const masked = await sharp(scene).composite([{ input: maskPng, blend: 'multiply' }]).png().toBuffer();
  await sharp(masked).resize(W * UP, H * UP, { kernel: 'nearest' }).png().toFile(join(DIR, `composed-masked.${suffix}.png`));

  // 对照表
  const all = [...FLOORS, 'tile-rift-wall-metro-straight', 'tile-rift-wall-metro-corner', 'tile-rift-error-small', 'tile-rift-error-large'];
  const S = T * 4, GAP = 8, PER = 5; const sheetW = PER * S + (PER + 1) * GAP; const sc = []; let idx = 0;
  for (const n of all) { const rr = Math.floor(idx / PER), cc = idx % PER; sc.push({ input: await sharp(join(TILESDIR, n + '.png')).resize(S, S, { kernel: 'nearest' }).toBuffer(), top: GAP + rr * (S + GAP), left: GAP + cc * (S + GAP) }); idx++; }
  for (const n of DECALS) { const rr = Math.floor(idx / PER), cc = idx % PER; sc.push({ input: await sharp(join(DECALSDIR, n + '.png')).resize(S, S, { kernel: 'nearest' }).flatten({ background: { r: 20, g: 20, b: 24 } }).toBuffer(), top: GAP + rr * (S + GAP), left: GAP + cc * (S + GAP) }); idx++; }
  const rows = Math.ceil(idx / PER);
  await sharp({ create: { width: sheetW, height: GAP + rows * (S + GAP), channels: 4, background: { r: 15, g: 16, b: 20, alpha: 1 } } }).composite(sc).png().toFile(join(DIR, `contact.${suffix}.png`));
}

main().catch(e => { console.error(e); process.exit(1); });
