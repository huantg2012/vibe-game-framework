import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Review metadata and page generation only; no image/audio processing or game writes.
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const ref = p => ({path:p, sha256:hash(p)});
const directory = 'docs/qa/artifacts/r100-i14';
const output = 'docs/qa/interactive/r100-i14-review';
const mixes = json('docs/qa/interactive/r100-material-listening.json');
const galleryPath = 'docs/qa/interactive/r100-i10-i12-worlds.html';
const gallery = JSON.parse(read(galleryPath).match(/<script[^>]+id="gallery-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const materialKeys = ['gather','contact','shell-hit','drain','fall'];
const labels = {gather:'聚集',contact:'接触','shell-hit':'壳体冲击',drain:'流退',fall:'散落'};
const loopKeys = ['bgm-rift-base-drone','bgm-rift-high-chaos','bgm-rift-threat','amb-rift-proximity','amb-rift-alien-atmosphere','sfx-rift-enemy-idle','sfx-rift-enemy-overwriter-hum'];
const runtimePath = `${directory}/art-runtime-media.json`;
const runtime = fs.existsSync(runtimePath) ? json(runtimePath) : {status:'awaiting-first-three-recordings', clips:[], playEntry:null};
const data = {
  schemaVersion:1, date:'2026-10-09', generatedAt:new Date().toISOString(),
  status:runtime.clips.length ? 'review-materials-prepared-actual-human-review-pending' : 'historical-and-source-materials-ready-natural-recordings-pending',
  features:['COH-F052','COH-F041','COH-F007','COH-F039'],
  candidate:{revision:'r100-native-v3-revision-6-internal-rc-20261008',...ref('docs/qa/artifacts/r100-i10-i12/release-candidate.json')},
  sourceDisposition:ref('docs/qa/artifacts/r100-i10-i12/final-audio-root-disposition.json'),
  currentAudioOwners:mixes.currentSourceComparison.map(s=>({...ref(s.path), comparedWith:s.recordedSha256,unchanged:hash(s.path)===s.recordedSha256})),
  sourceSounds:materialKeys.map(k=>({key:`sfx-suspended-sea-${k}`,label:labels[k],mp3:ref(`public/assets/audio/sfx/system/sfx-suspended-sea-${k}.mp3`),ogg:ref(`public/assets/audio/sfx/system/sfx-suspended-sea-${k}.ogg`)})),
  controlledMixes:{...ref('docs/qa/interactive/r100-material-listening.json'),recordingReport:ref(mixes.recordingSource),families:mixes.families},
  loopExcerpts:loopKeys.map(key=>({key,...ref(`docs/qa/artifacts/r100-i03-i06/audio-mix/loop-repair/${key}-after.wav`)})),
  gallery:{...ref(galleryPath), summary:gallery.summary,selected:['hollow-wreckage','buried-lamellae','felt-wedges','white-scarfield'].map(id=>{const w=gallery.worlds.find(w=>w.id===id);return{id,label:w.label,family:w.family,neighbors:w.neighborIds.map(id=>({id,label:gallery.worlds.find(w=>w.id===id)?.label??id}))};})},
  runtime,
  humanReview:{status:'pending',listener:null,device:null,volume:null,duration:null,observations:[],finalAcceptance:null},
  limits:[
    '五条材料原声按文件播放；没有套用游戏增益、距离衰减或声部分配，不能据此比较游戏响度。',
    '18份历史受控混音监听位置固定近处，threat=0.5、proximity=0.3，四种关键提示为显式注入；不冒充自然遭遇。',
    '六种主材配方复用五条材料声源，不代表108套独立声音身份；混材不逐副材发声。',
    '七条循环局部来自历史修复结果，数字接缝指标和播放成功都不等于人耳接缝通过。',
    '图库保留原录制版本与来源绑定：324档入口中270档列793张正常原帧，54档明确无直接原帧；不是本轮324档新图审。',
    '前三自然录像从各自恢复检查结束、首次场内移动前开始；canvas不含DOM HUD/菜单，整页原截图另看，自动行动及录像开销如实披露。',
    '实际空间听感、关键提示掩蔽、反复转换、长听与连续视觉疲劳、用户整版认可均待实际体验。'
  ],
  feedbackPrompts:[
    {id:'material',label:'材料与世界身份',hint:'记住了什么形体／材质？五源、六族混音是否像相应实体；哪些太相似？'},
    {id:'space',label:'行动与空间可读',hint:'边界、翻找物、危险和退路是否清楚；具体世界、档位、片段／时间。'},
    {id:'cues',label:'重要声音',hint:'实际游戏中的敌人警觉、受击、翻找中断、污染提示是否听清；未实际遇到就写未遇到。'},
    {id:'transition',label:'循环与转换',hint:'循环、暂停／恢复、出入场景有无点击、突然截断、重叠或不合适的静默；记录实际现象。'},
    {id:'fatigue',label:'连续观感与疲劳',hint:'实际看／听／玩了多久？哪些反复运动或声音开始烦、麻木、遮挡判断；不设虚构听满时长。'}
  ]
};
for (const f of data.controlledMixes.families) for (const c of f.clips) {
  if(hash(c.path)!==c.sha256 || hash(c.metadataPath)!==c.metadataSha256) throw new Error(`Historical clip changed: ${c.path}`);
}
fs.writeFileSync(`${output}.json`,JSON.stringify(data,null,2)+'\n');
const embedded = JSON.stringify(data).replaceAll('<','\\u003c');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>R100 I14 · 看、听、玩</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#111515;color:#d6d9d4}body{margin:0}main{max-width:1100px;margin:40px auto;padding:0 28px 60px}h1,h2,h3{font-weight:500}h1{font-size:28px}h2{font-size:22px;border-top:1px solid #3b4743;padding-top:28px;margin-top:42px}h3{font-size:18px}p,li{line-height:1.75}a{color:#bbc6a4}nav{display:flex;gap:20px;flex-wrap:wrap}.muted,.detail{color:#aeb7b2}.detail{font-size:13px}.note{border-left:3px solid #9b9c80;padding:12px 18px;background:#1b2220}.rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:24px;margin:24px 0}article{border-top:1px solid #344139;padding-top:10px}audio{display:block;width:100%;height:38px;margin:14px 0}video{display:block;width:100%;max-width:960px;background:#000}button,select,input,textarea{font:inherit;border:1px solid #697466;border-radius:0;padding:8px 11px;background:#26312b;color:#e2e4d8}button,select{cursor:pointer}textarea{display:block;box-sizing:border-box;width:100%;min-height:90px;margin:8px 0 20px}label{display:block;margin:16px 0}input{display:block;box-sizing:border-box;width:100%;margin-top:8px}button:focus-visible,select:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #e0d3a7;outline-offset:3px}code{overflow-wrap:anywhere}.links{display:flex;gap:16px;flex-wrap:wrap}summary{cursor:pointer}.status{min-height:1.7em;color:#d7c9a3}footer{border-top:1px solid #344139;margin-top:42px;padding-top:18px}img{max-width:100%;height:auto}
</style></head><body><main>
<h1>R100 I14 · 看、听、玩</h1><p class="muted">先看正常行动，再比较材料声景与画面，最后留下具体体验。当前候选：<code>r100-native-v3-revision-6-internal-rc-20261008</code>。</p>
<p class="note">审阅材料已整理；实际听感、连续视觉体验和最终认可仍待审。播放器不自动播放，一次只播放一份。没有播放量或时长达标即通过的规则。</p>
<nav aria-label="审阅内容"><a href="#natural">正常行动</a><a href="#worlds">世界与近邻</a><a href="#mixes">六族三档</a><a href="#sources">五条原声</a><a href="#loops">循环局部</a><a href="#feedback">留下反馈</a></nav>
<p id="media-status" class="status" role="status" aria-live="polite">请选择一份材料播放。</p>
<section id="natural"><h2>正常行动与试玩</h2><p>低／中／重前三趟按预先锁定的自动行动路线进行，仍受真实碰撞、有限视野、危险、消耗与收益约束。它们是自然随机出发的辅助执行样本，不能代表真人操作手感。每份录像范围和缺口单独列明。</p><div id="runtime"></div><div id="play-entry"></div></section>
<section id="worlds"><h2>世界与近邻</h2><p>下面沿用既有正常尺度原帧。先观察材料、结构、走路边界，再切换近邻；同一世界也可切低／中／重。静帧不能替代连续视觉疲劳判断。四例来自本轮既定诊断集合，并不都已证明是最弱画面。</p><div id="world-list" class="rows"></div><p><a href="r100-i10-i12-worlds.html">打开完整108世界图库</a> · 324档入口，270档列有793张原帧；54档的直接原帧缺口在图库中保留。</p></section>
<section id="mixes"><h2>六种材料 × 三档混音</h2><p class="note">历史受控录音：监听位置固定近处，敌人警觉、受击、翻找中断、污染提示由测试明确触发。保留原游戏混音，没有重新编码或归一化；这里的听清不能代签正常游戏里的空间听感。</p><div id="mix-list" class="rows"></div></section>
<section id="sources"><h2>五条材料原声</h2><p>用来判断声音本身的物质感。原文件直放，没有套用游戏音量和距离；请按舒适音量播放，不用原声与混音的响度差判断游戏平衡。六种配方复用这五条声音。</p><div id="source-list" class="rows"></div></section>
<section id="loops"><h2>七条循环接缝局部</h2><p>以下是历史修复后的接缝局部片段。听到点击、抽吸、突变时记下音源与时间；没有听到也只记录所听范围。完整游玩中的重复转换仍需实际体验。</p><div id="loop-list" class="rows"></div><p><a href="../artifacts/r100-i03-i06/audio-mix/index.html">旧版／修复后完整对照</a></p></section>
<section id="feedback"><h2>留下实际体验</h2><p>未看、未听、未遇到的内容保持“未观察”。填写设备、时长与具体材料即可；局部认可只覆盖写明的范围。导出只生成本地反馈文件，不发送数据、不修改台账。</p>
<label>审阅者<input id="reviewer" autocomplete="name" placeholder="姓名或称呼"></label><label>设备与音量<input id="device" placeholder="例如：电脑型号、耳机／扬声器、浏览器、系统／游戏音量"></label><label>实际范围与时长<input id="scope" placeholder="例如：听过哪些原声／族与档，玩过哪几趟，实际约多久"></label><div id="feedback-fields"></div>
<label>对上述范围的结论<select id="verdict"><option value="pending">尚未下结论</option><option value="changes-required">仍需整改</option><option value="accepted-stated-scope">认可写明的范围</option></select></label><label>其他问题或整版判断<textarea id="overall" placeholder="如有整版判断，请说明实际看／听／玩范围及仍未验证的部分。"></textarea></label>
<button id="make-feedback" type="button">生成反馈文本</button> <button id="download-feedback" type="button">下载反馈 JSON</button><p id="feedback-status" class="status" role="status" aria-live="polite"></p><textarea id="feedback-output" aria-label="可复制反馈文本" readonly placeholder="生成后可复制回对话。"></textarea></section>
<footer><details><summary>来源与范围</summary><p><a href="r100-i14-review.json">本页材料清单与 SHA</a> · <a href="../artifacts/r100-i10-i12/release-candidate.json">内部 RC</a> · <a href="../artifacts/r100-i10-i12/final-audio-root-disposition.json">原声音处置</a></p><ul id="limitations"></ul></details></footer>
</main><script id="review-data" type="application/json">${embedded}</script><script>
'use strict';
const data=JSON.parse(document.querySelector('#review-data').textContent);
const q=s=>document.querySelector(s),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const href=p=>p.startsWith('docs/qa/artifacts/')?'../artifacts/'+p.slice(18):p.startsWith('docs/qa/interactive/')?p.slice(20):'../../../'+p;
const link=(text,p)=>{const n=el('a',text);n.href=href(p);return n;};
const status=q('#media-status'),players=[];
function player(p,label,video=false){const n=el(video?'video':'audio');n.controls=true;n.preload='none';n.setAttribute('aria-label',label);if(video)n.playsInline=true;n.src=href(p);players.push(n);n.addEventListener('play',()=>{players.forEach(x=>{if(x!==n)x.pause();});status.textContent='正在播放：'+label;});n.addEventListener('error',()=>status.textContent='无法载入：'+label+'。可用原文件链接核对。');return n;}
const gradeNames={low:'低污染',medium:'中污染',severe:'重度污染'};
for(const f of data.controlledMixes.families){const a=el('article'),select=el('select'),p=el('p');p.className='detail';select.setAttribute('aria-label',f.label+'污染等级');for(const g of ['low','medium','severe']){const o=el('option',gradeNames[g]);o.value=g;select.append(o);}select.value='medium';const audio=player(f.clips[1].path,f.label+'混音');const original=link('打开原录音',f.clips[1].path);function choose(){audio.pause();const c=f.clips.find(c=>c.grade===select.value);audio.src=href(c.path);audio.setAttribute('aria-label',f.label+'·'+gradeNames[c.grade]);original.href=href(c.path);p.textContent='材料周期 '+c.pressurePeriodSeconds+'秒；四种注入提示约在 '+c.cues.map(x=>x.seconds.toFixed(1)).join(' / ')+'秒。末尾暂停与停止保留。';}select.addEventListener('change',choose);choose();a.append(el('h3',f.label),el('p',f.use),select,audio,p,original);q('#mix-list').append(a);}
for(const s of data.sourceSounds){const a=el('article');a.append(el('h3',s.label),player(s.mp3.path,s.label+'原声'),link('原 MP3',s.mp3.path),document.createTextNode(' · '),link('原 OGG',s.ogg.path));q('#source-list').append(a);}
for(const s of data.loopExcerpts){const a=el('article');a.append(el('h3',s.key),player(s.path,s.key+'接缝局部'),link('原 WAV',s.path));q('#loop-list').append(a);}
for(const w of data.gallery.selected){const a=el('article'),primary=link(w.label,data.gallery.path);primary.href+='#world='+encodeURIComponent(w.id)+'&grade=severe&frame=0';a.append(el('h3',w.label),primary,el('p','近邻：'));for(const n of w.neighbors){const l=link(n.label,data.gallery.path);l.href+='#world='+encodeURIComponent(n.id)+'&grade=severe&frame=0';a.append(l);}q('#world-list').append(a);}
if(!data.runtime.clips.length){q('#runtime').append(el('p','本轮前三趟正常录像正在准备，尚无可播放片段；不以旧受控混音代替。'));}else for(const c of data.runtime.clips){const a=el('article');a.append(el('h3',c.label),el('p',c.scope),player(c.video.path,c.label,true));const p=el('p');p.className='detail';p.textContent=(c.limitations||[]).join(' ');a.append(p,link('原含声录像',c.video.path));if(c.audio){const d=el('details');d.append(el('summary','仅听同次游戏混音'),player(c.audio.path,c.label+'同次原混音'),link('原录音',c.audio.path));a.append(d);}const identity=el('p');identity.className='detail';identity.textContent='run '+c.runId+' · 种子 '+c.seed+'。录制墙钟含收尾处理，实际编码播放时长以播放器为准。';a.append(identity);if(c.captureReceipt)a.append(link('本段原执行收据摘录',c.captureReceipt.path));for(const s of c.screenshots||[]){const d=el('details');d.append(el('summary',s.label));const img=el('img');img.src=href(s.path);img.loading='lazy';img.alt=s.label;d.append(img,link('原整页截图',s.path));a.append(d);}q('#runtime').append(a);}
if(data.runtime.coverage)q('#runtime').append(el('p','这三段覆盖低／中／重，但只有厚壳与膜层两种主材；不代表六族正常空间听感已齐。六族历史混音继续在下面单独标示。'));
if(data.runtime.laterFocusEvidence){const p=el('p');p.className='detail';p.append(document.createTextNode('录制分支未展示真实失焦。后续三档 Chrome 155 浏览器 trusted blur 专项已由主任务采纳；hidden=false、操作系统焦点及跨设备不扩张。'),link('后续专项及采纳范围',data.runtime.laterFocusEvidence.reference.path));q('#runtime').append(p);}
if(data.runtime.playEntry){q('#play-entry').append(el('p',data.runtime.playEntry.instructions));if(data.runtime.playEntry.reference)q('#play-entry').append(link('隔离试玩与真实设备包说明',data.runtime.playEntry.reference.path));if(data.runtime.playEntry.url){const a=el('a','打开隔离试玩');a.href=data.runtime.playEntry.url;q('#play-entry').append(a);}}else q('#play-entry').append(el('p','隔离正式试玩入口待源与存储配置冻结后填写；本页不访问或改写现有游戏存档。'));
for(const s of data.limits)q('#limitations').append(el('li',s));
for(const f of data.feedbackPrompts){const label=el('label',f.label),select=el('select'),area=el('textarea');select.id='state-'+f.id;select.setAttribute('aria-label',f.label+'观察状态');for(const [value,text]of[['unobserved','未观察'],['no-issue-in-scope','所观察范围未见问题'],['issue','发现问题'],['uncertain','难以判断']]){const o=el('option',text);o.value=value;select.append(o);}area.id='note-'+f.id;area.placeholder=f.hint;area.setAttribute('aria-label',f.label+'具体记录');label.append(select,area);q('#feedback-fields').append(label);}
function feedback(){return{schemaVersion:1,candidate:data.candidate,submittedAt:new Date().toISOString(),reviewer:q('#reviewer').value.trim(),deviceAndVolume:q('#device').value.trim(),actualScopeAndDuration:q('#scope').value.trim(),observations:data.feedbackPrompts.map(f=>({id:f.id,label:f.label,status:q('#state-'+f.id).value,note:q('#note-'+f.id).value.trim()})),verdict:q('#verdict').value,overall:q('#overall').value.trim(),automaticReleaseApproval:false};}
function prepare(){const d=feedback();q('#feedback-output').value=JSON.stringify(d,null,2);q('#feedback-status').textContent='已生成本地反馈。结论仅覆盖填写的实际范围，整版验收由主任务核对。';return d;}
q('#make-feedback').addEventListener('click',prepare);q('#download-feedback').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(prepare(),null,2)+'\\n'],{type:'application/json'}),u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download='r100-i14-human-review.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)players.forEach(p=>p.pause());});window.addEventListener('pagehide',()=>players.forEach(p=>p.pause()));
</script></body></html>\n`;
fs.writeFileSync(`${output}.html`,html);
console.log(JSON.stringify({json:`${output}.json`,html:`${output}.html`,mixes:18,sourceSounds:5,loopExcerpts:7,runtimeClips:data.runtime.clips.length,unchangedAudioOwners:data.currentAudioOwners.every(x=>x.unchanged)},null,2));
