import React, {useState} from 'react';

const base='../artifacts/opening-haven-2026-09-30/';
const stages=[
  {name:'标题实帧',file:'title.png',line:'一个人，面对巨大废墟',text:'人物、炉火、断沿构成情绪中心。深渊与残构提供尺度，左侧留白让菜单保持安静。'},
  {name:'进入净化点',file:'haven-first.png',line:'整座平台，和一圈可操作设施',text:'同一世界的材料仍在，但人物与炉火重新落位，核心和全平台成为主焦点。顶部 DEV 栏不属于游戏。'}
];
export default function OpeningReview(){
 const [selected,setSelected]=useState(0);
 const [split,setSplit]=useState(false);
 const stage=stages[selected];
 return <main className="opening-review">
  <style>{`
  body:has(.opening-review){background:#101612} .opening-review{max-width:1160px;margin:0 auto;padding:36px 24px 64px;color:#d8dedb;font:16px/1.8 system-ui,sans-serif}
  .opening-review *{box-sizing:border-box}.opening-review h1{font-size:34px;line-height:1.35;margin:10px 0 18px}.opening-review h2{font-size:23px;margin:32px 0 14px}.opening-review p{max-width:850px}.opening-review .eyebrow{font-size:12px;letter-spacing:.14em;color:#9cb6ae}.opening-review .verdict{border-left:3px solid #a7c6b8;padding:8px 22px;margin:24px 0;background:#18201e}.opening-review strong{color:#f0eee4}.opening-review nav{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0 12px}.opening-review button{font:inherit;font-size:14px;border:1px solid #55615b;background:#131a17;color:#d8dedb;padding:7px 16px;border-radius:3px;cursor:pointer}.opening-review button[aria-pressed=true]{background:#c2d4ca;color:#18221c}.opening-review button:focus-visible,.opening-review a:focus-visible{outline:2px solid #eee7c2;outline-offset:4px}.opening-review figure{margin:0}.opening-review .frame{width:100%;aspect-ratio:3/2;background:#080b0a;display:block}.opening-review .pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.opening-review figcaption{font-size:14px;color:#a9b6af;margin-top:12px}.opening-review .truth{font-size:13px;color:#aab6b0}.opening-review .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:24px 0}.opening-review article{padding:18px 0;border-top:1px solid #45574d}.opening-review article b{display:block;font-size:18px}.opening-review article p{font-size:15px;color:#b8c5bc;margin:8px 0}.opening-review a{color:#bcd3c7;text-underline-offset:4px}.opening-review details{border-top:1px solid #45574d;margin-top:30px;padding-top:18px}.opening-review summary{cursor:pointer}.opening-review .small{font-size:14px;color:#acb9b2}.opening-review li{margin:8px 0} @media(max-width:750px){.opening-review .pair,.opening-review .steps{grid-template-columns:1fr}.opening-review h1{font-size:27px}}
  `}</style>
  <div className="eyebrow">知情专家评审 · 15ed7bf · 2026.09.30</div>
  <h1>从“看见这个世界”，<br/>到“我就在这里”。</h1>
  <div className="verdict"><strong>建议重构开场取景与空间衔接。原画的美术方向保留。</strong><p>画面本身有吸引力。最大问题是从“人面对深渊”切到“设施总览”，人物与炉火没有接上。单独换一张更漂亮的海报，解决不了这一点。</p></div>
  <nav aria-label="实帧对照">
   {stages.map((s,i)=><button key={s.name} aria-pressed={!split&&selected===i} onClick={()=>{setSelected(i);setSplit(false)}}>{s.name}</button>)}
   <button aria-pressed={split} onClick={()=>setSplit(!split)}>并排对照</button>
  </nav>
  <div className={split?'pair':''}>
   {(split?stages:[stage]).map((s)=><figure key={s.file}>
    <svg className="frame" viewBox={s.file==='title.png'?'100 0 1080 720':'214 152 852 568'} role="img" aria-label={s.name+'：'+s.line}>
     <image href={base+s.file} width="1280" height="720"/>
    </svg>
    <figcaption><strong>{s.line}</strong><br/>{s.text} <a href={base+s.file} target="_blank" rel="noreferrer">完整原始截图</a></figcaption>
   </figure>)}
  </div>
  <p className="truth">展示按真实游戏画框裁切并等宽呈现；保留原始截图供核对。不是重画、效果预演或新方案成品。</p>
  <h2>连续的是什么，断开的又是什么</h2>
  <div className="steps">
   <article><b>世界身份 · 成立</b><p>书架残构、厚重石层、深黑虚空、冷色污染与有限炉火，让两屏仍属于同一个世界。</p></article>
   <article><b>空间与视线 · 脆弱</b><p>标题中的人和落脚点，进入后难以直接认回。功能总览有价值，但不宜抢走首次落脚的情绪。</p></article>
   <article><b>初始行动 · 脆弱</b><p>实际首屏提示“坐下”，同时出现潮汐、归来预报。生活感成立，是否帮助全新玩家理解处境仍需验证。</p></article>
  </div>
  <h2>推荐方向：净化点里的一口喘息</h2>
  <p>用当前净化点的<strong>角色—炉子—可坐残墙—独特断沿</strong>组成开场近景。保留原画的大残构和深渊；让核心以受约束的能量与真实受光提前进入中景，使这片庇护拥有本游戏自己的原因。</p>
  <div className="steps">
   <article><b>① 人的落脚处</b><p>相同头盔、背包和肩灯；炉席关系与出生位置对得上。暖光服务身体与生活，不增添装饰设备。</p></article>
   <article><b>② 危险中的庇护</b><p>核心仍是最强光源，用取景控制出场分量。近、中、远残构逐层消隐，让小据点面对巨大未知。</p></article>
   <article><b>③ 把画面交给玩家</b><p>菜单退去，以炉席为锚点回到正式游玩构图。可用匹配剪辑，无缝长镜头不是硬指标。站稳后再认识设施。</p></article>
  </div>
  <p><strong>先做两端关键帧和一次最短交接。</strong>检查玩家能否认出同一处炉火、同一个人，并愿意迈出第一步；成立后再雕琢材料与动态。原画不弃用，已认可的净化点整体构图不推翻。</p>
  <details><summary>证据范围与未验证项</summary><ul>
   <li>已从无记录标题点击真实“进入净化点”，在隔离内存存档中到达正式场景，未修改正式记录。</li>
   <li>代码名义时序约 2.1 秒；没有独立叙事开场。当前是黑场切换与小幅倍率落位，不是人物在同一空间中的连续穿行。</li>
   <li>熟悉项目的专家评审，不是盲测。没有连续录像下的节奏/FPS判断，音频未实际试听；代码已有音频提前衔接。</li>
   <li>本轮只评审；新方向未实施，也不代表已获用户终审。</li>
  </ul></details>
  <p className="small"><a href="../2026-09-30-opening-haven-experience.md">完整评审与验收建议</a> · <a href="../index.html">审查档案</a></p>
 </main>
}
