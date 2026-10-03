#!/usr/bin/env node
/** Rebuild the offline evidence viewer from captured records; never manufacture a capture. */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDirectory = path.join(root, 'docs/qa/artifacts/rift-r100-i02-rebuild');
const output = path.join(root, 'docs/qa/interactive/r100-i02-rebuild.html');
const families = [
  { id: 'folded-slab', name: '折叠板' },
  { id: 'fibre-knot', name: '纤维结' },
  { id: 'broken-shell', name: '厚壳腔' },
];
const grades = [{ id: 'low', name: '低污染' }, { id: 'medium', name: '中污染' }, { id: 'severe', name: '重污染' }];
const filePattern = /^(folded-slab|fibre-knot|broken-shell)-(low|medium|severe)-(\d+)\.json$/;
const warnings = [];
const datasets = [];
const seeds = new Set(['20261002', '20261003']);
const args = process.argv.slice(2);
if (args.some(argument => argument !== '--check')) throw new Error('Usage: node tools/world-study/render-master-review.mjs [--check]');

function pick(value, keys) {
  if (!value || typeof value !== 'object') return null;
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}

for (const name of (await readdir(evidenceDirectory)).sort()) {
  const match = filePattern.exec(name);
  if (!match) continue;
  const [, family, grade, seed] = match;
  const identity = `${family}-${grade}-${seed}`;
  const framePattern = new RegExp(`^${identity}-(\\d+)\\.(png|jpe?g|webp)$`, 'i');
  try {
    const records = JSON.parse(await readFile(path.join(evidenceDirectory, name), 'utf8'));
    if (!Array.isArray(records)) throw new Error('Expected an array of {file,state} records');
    const frames = [];
    for (const [recordIndex, record] of records.entries()) {
      try {
        const frameMatch = typeof record?.file === 'string' && framePattern.exec(record.file);
        if (!frameMatch || !record.state || typeof record.state !== 'object') throw new Error('Invalid capture filename or state');
        const state = record.state;
        if (state.world?.family !== family || state.world?.grade !== grade || String(state.world?.seed) !== seed) throw new Error('Filename and captured world identity differ');
        const metadata = await sharp(path.join(evidenceDirectory, record.file)).metadata();
        if (metadata.width !== 960 || metadata.height !== 640) throw new Error(`Expected native 960×640 capture; got ${metadata.width}×${metadata.height}`);
        const patrol = pick(state.patrol, ['mode', 'active', 'status', 'outcome', 'elapsedMs', 'activeMovementInputMs', 'minimumDurationMs', 'stationDwellMs', 'completedLegs', 'legDirection', 'blocked', 'actualDistance', 'targetIndex', 'plannedDistance', 'stations', 'position', 'method']);
        frames.push({
          file: record.file, url: `../artifacts/rift-r100-i02-rebuild/${record.file}`,
          frame: Number(frameMatch[1]), recordIndex,
          width: metadata.width, height: metadata.height, format: metadata.format,
          world: pick(state.world, ['identity', 'seed', 'sourceHash', 'geometryFingerprint', 'qualification', 'projection', 'nativeCanvas', 'cameraZoom', 'actorBody', 'sightPolicy', 'physicalRoles', 'dynamicTopology', 'gradeMechanics']),
          presentation: pick(state.presentation, ['mode', 'motion', 'phase', 'elapsedMs', 'activity', 'lastRenderMs', 'renderer', 'shoulderLight', 'sourceLights', 'sounds']),
          patrol,
          runtime: pick(state.runtime, ['ready', 'running', 'starting', 'paused']),
          probe: pick(state.runtime?.probe, ['elapsedMs', 'ended', 'player', 'hp', 'chaos']),
          performance: pick(state.runtime?.performance, ['method', 'state', 'sampledMs', 'requestedMs', 'frames', 'cpuSubmission', 'viewport', 'dpr', 'limitations']),
        });
      } catch (error) {
        warnings.push(`${name} record ${recordIndex}: ${error.message}`);
      }
    }
    if (frames.length) {
      datasets.push({ identity, family, grade, seed, json: `../artifacts/rift-r100-i02-rebuild/${name}`, recordCount: records.length, frames });
      seeds.add(seed);
    } else warnings.push(`${name}: no usable captures`);
  } catch (error) {
    warnings.push(`${name}: ${error.message}`);
  }
}
if (!datasets.length) throw new Error('No complete native captures found; existing viewer was not overwritten.');

const validationDirectory = path.join(root, 'docs/qa/artifacts/rift-r100-i02-validation');
const audioDirectory = path.join(validationDirectory, 'audio-listening-position');
const audioReport = JSON.parse(await readFile(path.join(audioDirectory, 'report.json'), 'utf8'));
if (audioReport.status !== 'signal-and-pause-verified-listening-pending') throw new Error('Review audio status explicitly before changing the evidence page wording.');
const audioCards = [];
for (const family of families) {
  const records = audioReport.cases.filter(record => record.family === family.id);
  if (records.length !== 1) throw new Error(`Expected one native recording for ${family.id}`);
  const record = records[0];
  if (record.video !== `${family.id}.webm` || record.audio !== `${family.id}-audio.webm` || record.grade !== 'severe' || record.seed !== 20261002 || !Number.isFinite(record.signal?.duration)) throw new Error(`Unexpected native recording identity: ${family.id}`);
  for (const file of [record.video, record.audio, `${family.id}.json`, `${family.id}-paused.jpg`]) await stat(path.join(audioDirectory, file));
  const base = '../artifacts/rift-r100-i02-validation/audio-listening-position';
  audioCards.push(`<details class="audio-record"${family.id === 'folded-slab' ? ' open' : ''}><summary>${family.name} · 重污染 · ${record.signal.duration.toFixed(1)}秒 · 待实际审听</summary><p class="note">种子 ${record.seed}。原生画面与Phaser主输出同录，保留材料声、环境声和现有音乐；不是单独音效示例。播放一段时会暂停本页其他媒体。</p><video controls preload="none" width="960" height="640" poster="${base}/${family.id}-paused.jpg" aria-label="${family.name}原生音画录制"><source src="${base}/${record.video}" type="video/webm">当前浏览器无法播放，可使用下方原始文件链接。</video><div class="links"><a href="${base}/${record.video}">原始音画</a><a href="${base}/${record.audio}">独立音轨</a><a href="${base}/${family.id}.json">逐时诊断</a></div><details><summary>仅播放实际音轨</summary><audio controls preload="none" aria-label="${family.name}录制音轨" src="${base}/${record.audio}"></audio></details></details>`);
}
const memoryReport = JSON.parse(await readFile(path.join(validationDirectory, 'memory/controlled-gc-memory.json'), 'utf8'));
if (!memoryReport.comparison?.measuredEnvelopeWithin10MiB || memoryReport.objectGraphAudit?.status !== 'pass-with-stated-scope') throw new Error('Memory evidence no longer matches the limited pass; review the statement before generating.');
const maxGrowthMiB = (memoryReport.comparison.maxEnvelopeGrowthBytes / 1024 ** 2).toFixed(3);

const manifest = { families, grades, seeds: [...seeds].sort(), datasets, warnings };
const embedded = JSON.stringify(manifest).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function client() {
  'use strict';
  const manifest = JSON.parse(document.getElementById('manifest').textContent);
  const byId = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let family = manifest.families.some(item => item.id === params.get('family')) ? params.get('family') : 'folded-slab';
  let grade = manifest.grades.some(item => item.id === params.get('grade')) ? params.get('grade') : 'medium';
  let seed = manifest.seeds.includes(params.get('seed')) ? params.get('seed') : '20261002';
  let frameNumber = /^\d+$/.test(params.get('frame') ?? '') ? Number(params.get('frame')) : 1;
  let currentDataset = null;
  let currentIndex = 0;
  let imageSerial = 0;
  const buttons = [];
  const seedButtons = [];
  const number = (value, digits = 1) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '未记录';
  const seconds = value => typeof value === 'number' ? `${number(value / 1000, 2)} s` : '未记录';
  const position = value => value ? `x ${number(value.x)} · y ${number(value.y)}` : '未记录';
  const outcomes = { completed: '完成既定巡查', running: '巡查中', blocked: '受阻', stopped: '已停止', idle: '未开始' };
  const patrolStatus = patrol => !patrol ? '未记录' : `${patrol.status ?? '状态未记录'} / ${outcomes[patrol.outcome] ?? patrol.outcome ?? '结果未记录'}`;
  function field(id, text) { byId(id).textContent = text; }
  function setLink(id, url) { const link = byId(id); if (url) { link.href = url; link.removeAttribute('aria-disabled'); } else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); } }
  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('family', family); url.searchParams.set('grade', grade); url.searchParams.set('seed', seed); url.searchParams.set('frame', String(frameNumber));
    try { history.replaceState(null, '', url); } catch { /* file:// viewers may restrict history. */ }
  }
  function showFrame(index) {
    currentIndex = index;
    const frame = currentDataset?.frames[index];
    const serial = ++imageSerial;
    const viewport = byId('image-viewport');
    const oldImage = byId('capture');
    oldImage.hidden = true;
    byId('previous').disabled = !frame || index === 0;
    byId('next').disabled = !frame || index === currentDataset.frames.length - 1;
    byId('frame-select').disabled = !frame;
    if (!frame) {
      oldImage.removeAttribute('src');
      field('image-status', '该组合尚无可用的截图记录。重新生成此页面后才能收录后续捕获。');
      field('capture-caption', '未收录'); field('frame-counter', '0 帧');
      for (const id of ['player', 'phase', 'patrol', 'distance', 'session', 'final-patrol', 'fingerprint']) field(id, '未记录');
      field('diagnostics', '此组合没有可用记录。');
      setLink('original', null); setLink('json', null);
      updateUrl(); return;
    }
    frameNumber = frame.frame;
    byId('frame-select').value = String(index);
    field('frame-counter', `${index + 1} / ${currentDataset.frames.length} 帧 · 源帧 ${frame.frame}`);
    field('capture-caption', `${frame.file} · ${frame.width}×${frame.height} · ${frame.format.toUpperCase()} · 1 图像像素 = 1 CSS 像素`);
    field('image-status', '载入原生截图…');
    const image = new Image(frame.width, frame.height);
    image.id = 'capture'; image.hidden = true;
    image.alt = `${byId('selection').textContent}，源帧 ${frame.frame}，${frame.presentation?.phase ?? '相位未记录'}`;
    image.onload = () => { if (serial !== imageSerial) return; image.hidden = false; field('image-status', ''); };
    image.onerror = () => { if (serial !== imageSerial) return; field('image-status', '图片无法载入。若证据已更名，请重新运行生成工具。'); };
    oldImage.replaceWith(image); image.src = frame.url;
    viewport.setAttribute('aria-label', image.alt);
    field('player', position(frame.probe?.player));
    field('phase', `${frame.presentation?.phase ?? '未记录'} · ${seconds(frame.presentation?.elapsedMs)} · ${frame.presentation?.mode ?? '模式未记录'}`);
    field('patrol', patrolStatus(frame.patrol));
    field('distance', `${number(frame.patrol?.actualDistance)} px 已走 / ${number(frame.patrol?.plannedDistance)} px 计划 · ${seconds(frame.patrol?.activeMovementInputMs)} 移动输入`);
    field('session', `${frame.runtime?.paused ? '暂停' : frame.runtime?.running ? '运行中' : '未运行'} · HP ${number(frame.probe?.hp, 0)} · 混沌 ${number(frame.probe?.chaos)}`);
    const final = currentDataset.frames[currentDataset.frames.length - 1];
    field('final-patrol', `${patrolStatus(final.patrol)} · ${seconds(final.patrol?.elapsedMs)} · 取自末条记录（源帧 ${final.frame}），不代表审美或性能通过`);
    field('fingerprint', frame.world?.geometryFingerprint ?? '未记录');
    field('diagnostics', JSON.stringify(frame, null, 2));
    setLink('original', frame.url); setLink('json', currentDataset.json);
    byId('json').textContent = `原始诊断 JSON · record ${frame.recordIndex}`;
    updateUrl();
  }
  function select() {
    currentDataset = manifest.datasets.find(item => item.family === family && item.grade === grade && item.seed === seed) ?? null;
    const familyName = manifest.families.find(item => item.id === family).name;
    const gradeName = manifest.grades.find(item => item.id === grade).name;
    field('selection', `${familyName} / ${gradeName} / ${seed}`);
    for (const item of buttons) {
      const dataset = manifest.datasets.find(value => value.family === item.family && value.grade === item.grade && value.seed === seed);
      item.button.setAttribute('aria-pressed', String(item.family === family && item.grade === grade));
      item.count.textContent = dataset ? `${dataset.frames.length} 帧` : '未收录';
    }
    for (const item of seedButtons) item.button.setAttribute('aria-pressed', String(item.seed === seed));
    const select = byId('frame-select'); select.replaceChildren();
    for (const [index, frame] of (currentDataset?.frames ?? []).entries()) {
      const option = document.createElement('option'); option.value = String(index);
      option.textContent = `${index + 1}. 源帧 ${frame.frame} · ${frame.presentation?.phase ?? '未记录'} · ${seconds(frame.presentation?.elapsedMs)}`;
      select.append(option);
    }
    setLink('live', `../../../rift-r100-masters.html?family=${encodeURIComponent(family)}&grade=${encodeURIComponent(grade)}&seed=${encodeURIComponent(seed)}`);
    const index = currentDataset?.frames.findIndex(frame => frame.frame === frameNumber) ?? -1;
    showFrame(index >= 0 ? index : 0);
  }
  for (const row of manifest.families) {
    for (const column of manifest.grades) {
      const button = document.createElement('button'); button.type = 'button';
      const label = document.createElement('span'); label.textContent = `${row.name} · ${column.name}`;
      const count = document.createElement('small'); button.append(label, count);
      button.addEventListener('click', () => { family = row.id; grade = column.id; select(); });
      byId('nine-grid').append(button); buttons.push({ button, count, family: row.id, grade: column.id });
    }
  }
  for (const value of manifest.seeds) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = value;
    button.addEventListener('click', () => { seed = value; select(); });
    byId('seeds').append(button); seedButtons.push({ button, seed: value });
  }
  byId('previous').addEventListener('click', () => showFrame(currentIndex - 1));
  byId('next').addEventListener('click', () => showFrame(currentIndex + 1));
  byId('frame-select').addEventListener('change', event => showFrame(Number(event.target.value)));
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || /^(INPUT|SELECT|TEXTAREA|BUTTON|VIDEO|AUDIO)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    const next = event.key === 'ArrowRight' ? currentIndex + 1 : event.key === 'ArrowLeft' ? currentIndex - 1 : -1;
    if (currentDataset && next >= 0 && next < currentDataset.frames.length) { event.preventDefault(); showFrame(next); }
  });
  const frameCount = manifest.datasets.reduce((sum, dataset) => sum + dataset.frames.length, 0);
  field('inventory', `${manifest.datasets.length} 组实际记录 · ${frameCount} 张原生截图`);
  if (manifest.warnings.length) { byId('warnings').hidden = false; field('warning-text', manifest.warnings.join('\n')); }
  const media = [...document.querySelectorAll('video,audio')];
  for (const current of media) current.addEventListener('play', () => { for (const other of media) if (other !== current) other.pause(); });
  select();
}

const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>R100 I02 · 实景证据</title>
<style>
:root{color-scheme:dark;font:14px/1.55 system-ui,-apple-system,"PingFang SC",sans-serif;color:#d2d5d3;background:#141718}*{box-sizing:border-box}body{margin:0}header{padding:22px 26px 16px;border-bottom:1px solid #373d3d}h1{font-size:23px;font-weight:600;margin:0 0 6px}p{margin:4px 0;color:#a5adab}a{color:#b9d4d0;text-underline-offset:3px}button,select{font:inherit;color:inherit;background:#202627;border:1px solid #4a5555;border-radius:4px;min-height:36px;padding:6px 10px}button{cursor:pointer}button:hover{background:#2d3838}button[aria-pressed=true]{border-color:#b6cbc6;background:#354443}button:disabled{opacity:.38;cursor:default}a[aria-disabled=true]{opacity:.35;pointer-events:none}button:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible,.viewport:focus-visible{outline:2px solid #d0dcd6;outline-offset:3px}.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:22px;padding:20px 26px}aside{min-width:0}h2{font-size:15px;margin:0 0 10px;font-weight:600}.seeds{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}.nine-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.nine-grid button{font-size:12px;min-height:66px;padding:7px 5px;text-align:left}.nine-grid small{display:block;color:#a7b3b0;margin-top:3px}.note{font-size:12px;color:#919e9b;margin:10px 0 18px}.facts{margin:16px 0 0}.facts dt{font-size:12px;color:#8e9d98;margin:11px 0 3px}.facts dd{margin:0;overflow-wrap:anywhere}.final{padding-top:10px;margin-top:14px;border-top:1px solid #394241}main{min-width:0}.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0}.toolbar select{min-width:240px}.counter{color:#a3adaa;font-size:12px}.links{display:flex;gap:17px;flex-wrap:wrap;margin:12px 0;font-size:13px}.viewport{overflow:auto;max-width:100%;min-height:640px;background:#090c0c;border:1px solid #343b3a;position:relative}#capture{display:block;width:960px;height:640px;max-width:none;image-rendering:pixelated}#capture[hidden]{display:none}#image-status{margin:0;padding:18px;position:absolute;inset:0;pointer-events:none;color:#b0b9b6}#image-status:empty{display:none}figcaption{margin-top:7px;font-size:12px;color:#94a39e;overflow-wrap:anywhere}figure{margin:0}details{margin-top:18px;border-top:1px solid #35403d;padding-top:10px}summary{cursor:pointer;color:#b4c3bd}pre{font:12px/1.55 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#a6b5af;max-height:480px;overflow:auto}#warnings{padding:12px 26px;color:#d1bc98}footer{padding:0 26px 24px;color:#81918b;font-size:12px}
.supplemental{margin:16px 26px 26px;border-top:1px solid #394241;padding-top:18px}.supplemental h2{font-size:19px}.supplemental>p{max-width:1040px}.audio-record{max-width:1080px;margin:16px 0;padding:14px 18px;border:1px solid #35403d;border-radius:4px;background:#181e1e}.audio-record video{display:block;width:960px;height:auto;max-width:100%;image-rendering:pixelated;background:#060909;margin-top:12px}.audio-record audio{display:block;width:520px;max-width:100%;margin-top:12px}.audit-links{margin-top:16px}.audit-status{color:#d0c6ab}
</style></head>
<body><header><h1>R100 I02 · 实景证据</h1><p>固定原生 960×640；逐张查看真实运行画面与对应诊断。记录本身不代表美术、听感或性能审核通过。</p><p id="inventory"></p></header>
<div class="layout"><aside><h2>种子</h2><div class="seeds" id="seeds" aria-label="选择地图种子"></div><h2>构造 × 污染等级</h2><div class="nine-grid" id="nine-grid" aria-label="选择九格"></div><p class="note">保留同编号源帧；该编号不存在时回到首条记录。两个种子的源帧并非同步相位对照。未收录组合不会替换为其他地图。</p>
<dl class="facts"><dt>实际角色脚点（世界坐标）</dt><dd id="player"></dd><dt>画面相位 / 场景时钟 / 模式</dt><dd id="phase"></dd><dt>本帧巡查</dt><dd id="patrol"></dd><dt>本帧巡查行程</dt><dd id="distance"></dd><dt>本帧运行状态</dt><dd id="session"></dd><dt>几何指纹</dt><dd id="fingerprint"></dd><dt class="final">本组最后记录的巡查结果</dt><dd id="final-patrol"></dd></dl></aside>
<main><h2 id="selection"></h2><div class="toolbar"><button type="button" id="previous" aria-label="上一帧">← 上一帧</button><select id="frame-select" aria-label="选择实际捕获帧"></select><button type="button" id="next" aria-label="下一帧">下一帧 →</button><span class="counter" id="frame-counter"></span></div><div class="links"><a id="original" target="_blank" rel="noopener">查看原图</a><a id="json" target="_blank" rel="noopener">原始诊断 JSON</a><a id="live" target="_blank" rel="noopener">进入同地图原生母版 ↗</a></div>
<figure><div class="viewport" id="image-viewport" tabindex="0"><img id="capture" width="960" height="640" alt="待载入的实景截图" hidden><p id="image-status" role="status" aria-live="polite"></p></div><figcaption id="capture-caption"></figcaption></figure><p class="note">窄窗口请横向滚动查看完整画面；页面不会缩小原图。方向键可逐帧浏览。母版试玩链接需从项目开发服务打开。</p><details><summary>本帧诊断摘录与记录来源</summary><p class="note">以下为原始记录的字段摘录；完整巡查采样、原始精度和全部运行诊断以 JSON 链接为准。</p><pre id="diagnostics"></pre></details></main></div>
<section class="supplemental" id="audio-evidence"><h2>三种材料 · 原生音画实录</h2><p class="audit-status">每组38.4秒，重污染 / 20261002。信号与暂停技术检查已完成；实际听感、混音、材料身份与音画关系仍待审听。</p><p>没有注入声音、调整增益、瞬移角色或改动场景时钟。这三段提供真实听验对象；非静音、无削波和声音键记录均不能替代耳朵的判断。视频可全屏，原始像素为960×640。</p><div class="links"><a href="../artifacts/rift-r100-i02-validation/audio-listening-position/report.json">录制总记录</a><a href="../rift-r100-i02.md">I02 验证报告与边界</a></div>${audioCards.join('\n')}</section>
<section class="supplemental" id="memory-evidence"><h2>受控GC · 重建保留量</h2><p>九格预热，10次同配置重建与12次混合选择；23个GC样本、三个完整堆图。相同配置的观察包络最大增长 <strong>${maxGrowthMiB}MiB</strong>，低于10MiB；真实对象图只保留当前世界，三份材料backing固定为3MiB。</p><p class="note">限定通过DEV同页原生重建。不是GPU驱动物理字节、完整浏览器原生内存或全部正式出击状态的认证；保留原始失败尝试与完整范围说明。</p><div class="links audit-links"><a href="../artifacts/rift-r100-i02-validation/memory/report.md">完整方法与限制</a><a href="../artifacts/rift-r100-i02-validation/memory/controlled-gc-memory.json">23次原始读数</a><a href="../artifacts/rift-r100-i02-validation/memory/heap-graph-audit.json">真实对象图核查</a></div></section>
<details id="warnings" hidden><summary>生成时未收录的记录</summary><pre id="warning-text"></pre></details><footer>证据源：docs/qa/artifacts/rift-r100-i02-rebuild/ 与 rift-r100-i02-validation/ · 更新：node tools/world-study/render-master-review.mjs · 离线可查看截图、音画和诊断</footer>
<script type="application/json" id="manifest">${embedded}</script>
<script>(${client.toString()})();</script></body></html>
`;
if (args.includes('--check')) {
  const existing = await readFile(output, 'utf8').catch(() => '');
  if (existing !== html) throw new Error('Evidence viewer is stale. Run node tools/world-study/render-master-review.mjs');
} else {
  await writeFile(output, html);
}
console.log(`${args.includes('--check') ? 'Checked' : 'Generated'} ${path.relative(root, output)}: ${datasets.length} datasets, ${datasets.reduce((sum, item) => sum + item.frames.length, 0)} frames.`);
for (const warning of warnings) console.warn(`Skipped: ${warning}`);
