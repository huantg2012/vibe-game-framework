/** Build the auditable listening page and objective summary after real capture. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = 'docs/qa/artifacts/r100-i03-i06/audio-mix';
const read = file => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
const final = read('delivery/report.json'), before = read('before/report.json'), loops = read('loop-browser-delivery/report.json'), voices = read('voices-final/report.json');
assert.equal(final.cases.length, 18); assert.equal(before.cases.length, 18);
const assets = new Map(read('delivery/assets.json').map(a => [a.key, a]));
const oldAssets = new Map(read('before/assets.json').map(a => [a.key, a]));
const gameLoops = loops.comparisons.map(row => {
  const key = row.key.split('/').at(-1), old = oldAssets.get(key), current = assets.get(key);
  assert.equal(old.sampleRate, current.sampleRate);
  assert(current.seam <= current.maximumNeighborStep);
  return { key: row.key, sampleRate: current.sampleRate, beforeSeam: old.seam, afterSeam: current.seam, rmsDeltaDb: 20 * Math.log10(current.rms / old.rms) };
});
const cueRows = [], caseRows = [];
for (const entry of final.cases) {
  const data = read('delivery/' + entry.name + '.json');
  assert.equal(data.clipped, 0); assert(data.maximumVoices <= 8); assert.equal(data.ended.playingCount, 0);
  assert.equal(entry.events, 2); assert(data.pauseVoices.every(v => v.paused));
  for (const cue of data.cues) {
    const sample = data.voices.find(v => v.at >= cue.at && v.voices.some(v => v.key === cue.key));
    assert(sample, entry.name + ' critical cue absent: ' + cue.key);
    const voice = sample.voices.find(v => v.key === cue.key);
    assert(voice.volume > 0);
    const ownRms = assets.get(voice.key).rms * voice.volume;
    const otherRms = Math.sqrt(sample.voices.filter(v => v !== voice).reduce((sum, v) => sum + (assets.get(v.key).rms * v.volume) ** 2, 0));
    cueRows.push({ case: entry.name, cue: cue.key, requestedAt: cue.at, observedAt: sample.at, gain: voice.volume, broadbandEnergyEstimateDb: 20 * Math.log10(ownRms / otherRms) });
  }
  caseRows.push({ ...entry, peakDbfs: 20 * Math.log10(entry.peak), rmsDbfs: 20 * Math.log10(entry.rms), crestDb: 20 * Math.log10(entry.peak / entry.rms) });
}
const summary = {
  status: 'objective-contract-pass; subjective-listening-pending',
  scope: 'Real browser WebAudio capture of actual production sources and AudioManager, controlled six-family/three-grade fixture at distance zero with fixed pressure clocks and four explicit critical cues. Not natural encounters or human listening.',
  sourceEvidence: { containerEquivalence: 'container-equivalence.json (six OGG files differ only in container serial/CRC; all codec payload/timing bytes are identical)', before: '../../r100-i06/final-runtime/frozen/source-snapshot.json', final: 'frozen-delivery/source-snapshot.json', note: 'The original mix script sources field hashes the working tree and is not itself proof of the served version. Frozen server manifests, URL and source-copy hashes are authoritative.' },
  cases: caseRows,
  cueEnergyProxy: { method: 'Whole-file decoded source RMS × actual active voice gain, energy-summed against simultaneous voices at the first sample after cue admission. This is a coarse broadband level proxy; it does not measure critical-band masking, phonetic recognition, perception or audibility.', cases: cueRows },
  loops: gameLoops,
  allocation: { beforeMaximum: read('voices-before/report.json').maximum, finalMaximum: voices.maximum, checks: voices.checks },
  humanEarChecks: ['六种材料在游戏混音中的触感是否对应实体，而非只听成一组通用合成音。', '低、中、重度的压力变化是否自然且没有抢走敌人警觉/受击/翻找中断提示。', '长时间循环是否令人疲劳，接缝虽数值改善是否仍可感知。', '不同耳机/扬声器与低音量下，翻找中断（本轮能量余量最低）是否明确。'],
};
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
const families = [['folded-slab','层片'],['fibre-knot','纤维'],['broken-shell','釉壳'],['granular-ridge','颗粒'],['membrane-rim','膜'],['gel-flow','凝胶']];
const audio = file => `<audio controls preload="none" src="${file}"></audio>`;
const rows = families.map(([id,label]) => `<section><h2>${label}</h2>${['low','medium','severe'].map((grade,i) => { const name=id+'-'+grade, r=caseRows.find(c=>c.name===name);return `<article><h3>${['低污染','中污染','重度污染'][i]}</h3><div><span>修复前 · rev2</span>${audio('before/'+name+'.webm')}</div><div><span>修复后 · 最终声音实现</span>${audio('delivery/'+name+'.webm')}</div><p>峰值 ${r.peakDbfs.toFixed(1)} dBFS · 峰均差 ${r.crestDb.toFixed(1)} dB · 0 削波 · ${r.maximumVoices} 声部</p></article>`; }).join('')}</section>`).join('');
const boundaries = gameLoops.map(r => { const key=r.key.split('/').at(-1);return `<article><h3>${key}</h3><p>原电平的首尾邻域重复五次，仅用于找接缝；不是自然游玩。</p><div><span>前</span>${audio('loop-repair/'+key+'-before.wav')}</div><div><span>后</span>${audio('loop-repair/'+key+'-after.wav')}</div><p>同一 ${r.sampleRate}Hz 游戏解码的首尾单样本跳变 ${r.beforeSeam.toFixed(6)} → ${r.afterSeam.toFixed(6)}；整段 RMS 改变 ${r.rmsDeltaDb.toFixed(3)} dB。</p></article>`; }).join('');
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="zh"><meta charset="utf-8"><title>R100 声景实际混音对照</title><style>body{margin:0;background:#111714;color:#c8ccc6;font:16px/1.65 system-ui,sans-serif}main{max-width:1160px;margin:40px auto;padding:0 28px}h1,h2,h3{font-weight:500;color:#e1e1d5}h1{font-size:28px}h2{border-top:1px solid #3a463f;padding-top:24px}p{color:#9da8a0}.notice{border-left:3px solid #93977a;padding:8px 20px;background:#1d2520}section{display:flow-root}article{display:inline-block;vertical-align:top;width:calc(33.33% - 28px);margin:0 20px 20px 0}audio{width:100%;height:36px;display:block;margin:8px 0 14px}span{font-size:13px;color:#acb8ac}a{color:#bac5aa}article p{font-size:12px}details article{width:calc(50% - 28px)}</style><main><h1>六类材料 × 三级污染：实际混音对照</h1><div class="notice"><strong>客观声音合同已验证；主观听感未签。</strong><p>录音来自 Chrome 真实 WebAudio 总线。这是受控混音台：距离固定为零，播放实际环境底、压力周期和明确注入的敌人警觉、受击、翻找中断、污染阈值提示。不是自然遭遇，也不代表已经有人听过。</p></div><p>修复了全局声音上限被环境层绕过（压力测试 17 → 8）、低层抢占后不恢复与切场声音目标丢失；七条循环只处理首尾 30ms 并保留源音色和总体电平。前后录音的实际帧调度不同，不用于逐样本抵消比较。</p><p><a href="summary.json">客观结果与局限</a> · <a href="voices-final/report.json">12项真实声部/暂停检查</a> · <a href="loop-browser-delivery/report.json">14双格式循环解码</a> · <a href="frozen-delivery/source-snapshot.json">最终声音源冻结</a></p>${rows}<details><summary>七条循环的接缝局部试听</summary>${boundaries}</details><h2>仍须人耳判断</h2><ul>${summary.humanEarChecks.map(s=>'<li>'+s+'</li>').join('')}</ul><p>数据门不代替审听。特别是翻找中断的宽频能量余量低于其他关键提示；当前未发现被分配器吞掉或低到零的事件，但是否易辨仍应在正常游玩中听。</p></main></html>`);
console.log(JSON.stringify({cases:caseRows.length,cues:cueRows.length,clipped:0,maximumVoices:Math.max(...caseRows.map(c=>c.maximumVoices)),maxPeakDbfs:Math.max(...caseRows.map(c=>c.peakDbfs)),minimumEnergyProxyDb:Math.min(...cueRows.map(c=>c.broadbandEnergyEstimateDb))}));
