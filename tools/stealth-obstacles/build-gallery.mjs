import fs from 'node:fs';
import path from 'node:path';

const base = 'docs/qa/artifacts/stealth-obstacles-2026-10-13';
const before = JSON.parse(fs.readFileSync(`${base}/code/before-regions/summary.json`, 'utf8'));
const after = JSON.parse(fs.readFileSync(`${base}/code/regions-final/summary.json`, 'utf8'));
const worlds = [
  ['split-rib-causeway', '双脊渡口', '2 → 7', '东北长伏肋与厚短叉，西南三件错位张开；原双脊仍是主景。南东宽床保留。'],
  ['gel-rafts', '断脂浅片', '2 → 8', '北、西南、东侧各有长低与短厚凝块，原四片可走浅层保留。'],
  ['sloughed-court', '剥皮露庭', '1 → 7', '西翼、东北、南侧以长薄折返和立厚片构成三组；东北孔上仍保留开阔地。'],
].map(([id, name, count, note]) => ({ id, name, count, note,
  before: before.cases.find(x => x.worldId === id).metrics,
  after: after.cases.find(x => x.worldId === id).metrics,
}));
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>开放地带 · 三图障碍补布对照</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#101414;color:#d4dacf;font:15px/1.6 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:28px 32px}h1{font-size:27px;margin:5px 0}p{margin:8px 0;color:#9ca9a2}a{color:#bdd1b6}button{font:inherit;color:inherit;background:#1a2220;border:1px solid #46534b;border-radius:3px;padding:7px 17px;cursor:pointer}button[aria-pressed=true]{background:#ccd7bc;color:#172015;border-color:#ccd7bc}nav{display:flex;gap:10px;margin:20px 0;flex-wrap:wrap}.eyebrow{color:#8c9b89;font-size:12px;letter-spacing:.16em}.metrics{display:flex;gap:30px;margin:14px 0}.metrics b{display:block;font-size:24px;font-weight:500;color:#dbe3cc}.metrics span{font-size:12px;color:#98a397}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;background:#050706}figcaption{padding:9px 14px;border-bottom:1px solid #303b34;color:#c2cdbb}img{width:100%;display:block;object-fit:contain}summary{cursor:pointer;padding:10px 0;color:#bccab4}.limit{border-left:2px solid #8b7e5c;padding:4px 16px;margin:20px 0;color:#aeb7a8}footer{font-size:13px;color:#8b9b8d;margin-top:20px}.runtime{max-width:960px}.toolbar{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
</style><main><div class="eyebrow">真实生产材质 / 中污染 / 请求种子 20261012</div><h1>开放地带 · 三图障碍补布对照</h1><p>保留开放碎片与原空洞，在空白腹地补充有主从、方向与尺度差异的实体关系组。</p><nav id="worlds"></nav><div class="toolbar"><h2 id="title"></h2><a id="play" target="_blank" rel="noopener">进入正常视野试玩 ↗</a><a href="../../world-upgrades-rollout-2026-10-12/index.html">全库原推广图册</a></div><p id="note"></p><div class="metrics"><div><span>实体数量（可走浅层不计）</span><b id="count"></b></div><div><span>距实体超过224px的可达点占比</span><b id="distance"></b></div><div><span>最大连续净空半径</span><b id="radius"></b></div></div><div class="pair"><figure><figcaption>修改前</figcaption><a id="before-link" target="_blank"><img id="before" alt="修改前真实材质全图"></a></figure><figure><figcaption>当前增补</figcaption><a id="after-link" target="_blank"><img id="after" alt="新增中尺度实体后的真实材质全图"></a></figure></div><div class="limit">本轮只改三图，共追加17件实体；原实体、边界与空洞保持。实体改变绕行和地标，仍不挡视线，不能当成新增潜行掩体。全库空旷问题与真实敌人接近、等待、撤回的体验仍待继续验证。</div><details><summary>正常镜头实测截图</summary><p>真实按键移动后的有限观察，不是完整自然搜撤或敌人潜行验收。</p><img class="runtime" id="runtime" alt="正常相机与迷雾中的实测"></details><details><summary>验证范围与原始记录</summary><p>三图 × 三档 × 两种子18例完整生成通过；9份旧r10地图精确回放。13/17新增单件取得严格双侧路线见证，覆盖8/8关系组；另外4件不宣称单件双侧已验证。指标用于定位空白，不表示潜行安全或审美终验。</p><a href="../code/regions-final/summary.json">净空诊断</a> · <a href="../code/witnesses-final/summary.json">双侧路径</a> · <a href="../qa/final-geometry-and-player-void.json">独立几何与视线检查</a> · <a href="production-final/report.json">18例完整生成</a></details><footer>旧图册保留为推广批次历史证据；本页为三图当前修订。点击全图可查看原分辨率。</footer></main>
<script>
const worlds=${JSON.stringify(worlds)};
function show(i){const w=worlds[i];document.querySelectorAll('nav button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));document.querySelector('#title').textContent=w.name;document.querySelector('#note').textContent=w.note;document.querySelector('#count').textContent=w.count;document.querySelector('#distance').textContent=[w.before,w.after].map(m=>(100*m.farFromSolidRatio224).toFixed(1)+'%').join(' → ');document.querySelector('#radius').textContent=[w.before,w.after].map(m=>Math.round(m.maxClearRadiusPx)+'px').join(' → ');for(const state of ['before','after']){const src='../code/'+(state==='after'?'after-final':'before')+'/'+w.id+'-medium-20261012/intact-material.png';document.querySelector('#'+state).src=src;document.querySelector('#'+state+'-link').href=src;}document.querySelector('#runtime').src='browser/'+w.id+'.jpg';document.querySelector('#play').href='/r100-gym.html?world='+w.id+'&grade=medium&seed=20261012';}
worlds.forEach((w,i)=>{const b=document.createElement('button');b.textContent=w.name;b.onclick=()=>show(i);document.querySelector('#worlds').append(b)});show(0);
</script></html>`;
fs.mkdirSync(`${base}/root-owned`, { recursive: true });
fs.writeFileSync(path.join(base, 'root-owned/index.html'), html);
console.log('Wrote three-world before/after gallery.');
