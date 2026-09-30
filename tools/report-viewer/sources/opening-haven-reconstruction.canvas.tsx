import React,{useState} from 'react';

const modes=[
 {title:'先锁住同一个地方',why:'角色、炉火、可坐残墙与独特断沿是两个镜头共用的地标。空间身份通过这些相邻关系建立；无需把净化点全部设施搬进标题。',risk:'这些位置不为标题构图而移动。初始角色仍在真实出生点。'},
 {title:'直接放大为什么危险',why:'炉席背后首先是地板，右前方是比人高大的核心。放大当前镜头，可能同时放大这两个问题：人被设备压住，深渊被地坪替代。',risk:'独立相机略降俯角是待验证的选择。它也可能令核心更高、更抢眼；并不自动带来好构图。'},
 {title:'最强光源与人的焦点',why:'核心保持最强、全向的灰冷绿光。控制的是取景与可见亮面，让它有辨识度而不占满画面；炉光把人、座席与邻近地面联系起来。',risk:'图上箭头只表示因果关系，不是新灯光效果。阴影、反射和混光必须从同一构造重新计算。'}
];
const parts=[
 ['相机与深渊','略低的斜俯视，保持观察方位。平台从右侧进入，人物一侧有可读的断沿；大构件继续向画外、向下延伸。','压缩地坪铺展、突出建筑厚度，让小小栖身处仍面对无法掌控的世界。降低角度只是一种手段；深渊变小或核心压过人物，都应否决该取景。'],
 ['人物与生活','同一个头盔、背包和肩灯，站立静息、重心落地。暖炉、坐磨的残墙上缘与脚边使用痕迹形成一个紧凑单元。','生活感来自身体和材料的关系。它能表达有人使用这里，而不是靠增加箱罐让背景显得丰富。坐下保留为玩家接管后的选择。'],
 ['核心与色彩','允许核心局部出画，但必须读出约束构件和有体积的发光内质；灰冷绿照到真实接收面，橙火和暖白肩灯保留各自来源。','有限的亮面可以保留强源，同时让人的关系可读。冷暖在转面上相遇，有空间因果；全场洗绿或青黄混成一片会让温度与材料一起消失。'],
 ['材料与空气','石层、断面、孔壁和装配先塑形，再做有位置依据的磨损。近景具备充分中尺度细节，远景逐步失去纹理与轮廓。','观看需要距离与停顿。高频细节平均铺满只增加噪声；材质、遮挡、光和空间共同描述一个对象，才不会被一眼看穿。'],
 ['微动与声音','人物脚稳定，炉光跟火口变化；核心形变、透射和照明共享相位。远处异动稀疏，菜单镜头稳定，声音延续既有源。','让世界持续存在，避免所有图层齐刷刷呼吸。未知以短暂遮挡出现，保留不确定性；不靠入场轰鸣替代情绪。声音需带声样片另验。'],
 ['操作与节奏','用角色脚点作主锚、炉火作次锚匹配剪辑；正式镜头从炉席附近整理到既有全景，末段交还控制。新档约2.1秒预算，继续与减动更短。','观看与导航需要不同的取景。清楚的剪辑能保住两者，不必为无缝变角度引入复杂渲染；继续记录也不该强制重复一场表演。']
];
const production=[
 ['01 · 同源取景','开场完整关键帧＋剪辑接点＋正式首帧。','先证明真实位置容得下人的处境与深渊。构图失败时改相机，不挪已认可的功能布局。'],
 ['02 · 美术母版','目标尺寸的完成度足够的整景。','原画并置：空间更准确，孤独、纵深、材料和停留欲也不退步，才继续。'],
 ['03 · 动态交接','菜单循环＋一次真实点击进入的带声样片。','形变、阴影、肩灯和环境光共同变化；两个镜头认得出同一角色与炉火。'],
 ['04 · 正式接入','根入口的新档／继续／减动及异常路径。','保存状态和角色位置正确，及时交还控制。机械检查、艺术结果与用户终审分别记录。']
];
export default function OpeningPlan(){
 const [mode,setMode]=useState(0),[part,setPart]=useState(0),[step,setStep]=useState(0);
 return <main className="opening-plan"><style>{`
 body:has(.opening-plan){background:#101512}.opening-plan{max-width:1120px;margin:auto;padding:38px 24px 80px;color:#d4ddd6;font:16px/1.85 system-ui,sans-serif}.opening-plan *{box-sizing:border-box}.opening-plan h1{font-size:38px;line-height:1.4;margin:8px 0 20px}.opening-plan h2{font-size:24px;line-height:1.5;margin:34px 0 14px}.opening-plan p{max-width:850px}.opening-plan .kicker{color:#9fb6a8;font-size:12px;letter-spacing:.12em}.opening-plan strong{color:#f2eee1}.opening-plan .lead{font-size:19px;max-width:860px}.opening-plan nav{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 16px}.opening-plan button{font:inherit;font-size:14px;border:1px solid #63746a;background:#141e18;color:#d4ddd6;padding:8px 13px;border-radius:3px;cursor:pointer}.opening-plan button[aria-pressed=true]{background:#c6d1c5;color:#162117}.opening-plan a{color:#b6cbbb;text-underline-offset:4px}.opening-plan button:focus-visible,.opening-plan a:focus-visible{outline:2px solid #e3c597;outline-offset:4px}.opening-plan .map{display:block;width:100%;aspect-ratio:3/2;background:#080b09}.opening-plan .small{font-size:13px;color:#adb9b1}.opening-plan .reason{border-left:3px solid #bcaa84;padding:14px 22px;margin:18px 0;background:#1b241e}.opening-plan .reason p{margin:5px 0}.opening-plan .columns{display:grid;grid-template-columns:1fr 1fr;gap:30px}.opening-plan .columns article{border-top:1px solid #516257;padding-top:18px}.opening-plan .columns b{display:block;font-size:18px}.opening-plan .columns p{font-size:15px}.opening-plan .route{font-size:18px;line-height:2.2;color:#dcd9c9;padding:18px 0;border-block:1px solid #465a4a}.opening-plan li{margin:8px 0}.opening-plan details{margin-top:24px;border-top:1px solid #465a4a;padding-top:14px}.opening-plan summary{cursor:pointer}.opening-plan .step{padding:20px;background:#1a251e}.opening-plan .step h3{margin:0 0 8px}.opening-plan .warning{color:#cbbca3}@media(max-width:750px){.opening-plan .columns{grid-template-columns:1fr}.opening-plan h1{font-size:29px}}
 `}</style>
 <div className="kicker">制作提案 · 2026.09.30 · 未实施</div>
 <h1>在巨大废墟里，<br/>还有一处能停留的地方。</h1>
 <p className="lead">同一净化点，两次取景。开场让人看见自己的处境，游戏镜头让人看清如何行动。两者由同一个角色、同一处炉火接起来。</p>
 <p><strong>原画的美术方向保留。</strong> 重构场景取景、地标对应与交接，以当前同源几何重渲独立开场。下面是设计依据与制作方法，不是已经完成的新效果图。</p>
 <h2>从真实空间出发，而不是重新拼一张海报</h2>
 <nav aria-label="场景设计依据">{modes.map((m,i)=><button key={m.title} aria-pressed={mode===i} onClick={()=>setMode(i)}>{m.title}</button>)}</nav>
 <svg className="map" viewBox="214 152 852 568" role="img" aria-label={'现有净化点实帧：'+modes[mode].title}>
  <image href="../reviews/artifacts/opening-haven-2026-09-30/haven-first.png" width="1280" height="720"/>
  {mode===0&&<g stroke="#e3cda7" fill="none" strokeWidth="1.6"><circle cx="664" cy="471" r="24"/><circle cx="698" cy="477" r="30"/><circle cx="648" cy="509" r="21"/><path d="M645 533 L598 543 L579 525"/><path d="M658 438 L651 421 L566 421"/><text x="565" y="412" stroke="none" fill="#efe5cd" fontSize="13">角色 · 炉火 · 可坐残墙</text></g>}
  {mode===1&&<g><path d="M612 348 L784 395 L740 446 L626 433 Z" fill="#d8b993" fillOpacity=".1" stroke="#c8a97b" strokeWidth="1.5" strokeDasharray="6 4"/><path d="M798 481 Q841 421 889 450 L913 542 L818 568 Z" fill="none" stroke="#c8a97b" strokeWidth="1.6"/><text x="643" y="337" fill="#eee0c9" fontSize="13">炉席后方：大片地坪</text><text x="799" y="590" fill="#eee0c9" fontSize="13">核心在右前方</text></g>}
  {mode===2&&<g strokeWidth="1.6" fill="none"><circle cx="863" cy="499" r="32" stroke="#b2d7c3"/><path d="M840 498 Q766 477 716 501" stroke="#b2d7c3" strokeDasharray="5 5"/><circle cx="688" cy="482" r="17" stroke="#e4b980"/><path d="M676 480 Q666 486 649 497" stroke="#e4b980"/><text x="817" y="432" fill="#d2e6d9" stroke="none" fontSize="13">最强、全向</text><text x="585" y="463" fill="#efcea2" stroke="none" fontSize="13">人的暖区</text></g>}
 </svg>
 <p className="small">现状定位示意：色线标识关系与风险，不表示拟制后的轮廓、亮度或构图。<a href="../reviews/artifacts/opening-haven-2026-09-30/haven-first.png">原始实帧</a></p>
 <div className="reason"><strong>{modes[mode].title}</strong><p>{modes[mode].why}</p><p className="small warning">{modes[mode].risk}</p></div>
 <h2>每项取舍，都要在画面上有结果</h2>
 <nav aria-label="怎么做与为什么">{parts.map((p,i)=><button key={p[0]} aria-pressed={part===i} onClick={()=>setPart(i)}>{p[0]}</button>)}</nav>
 <div className="columns"><article><b>怎么做</b><p>{parts[part][1]}</p></article><article><b>为什么这样做</b><p>{parts[part][2]}</p></article></div>
 <h2>两次取景，清楚地交给玩家</h2>
 <div className="route">炉席近景 · 看见处境 → 人物／炉火匹配剪辑 → 正式镜头 · 认清通路 → 交还操作</div>
 <p>开场优先测试较低俯角的独立正交相机，保持物件真实位置与观察方位。匹配一个主锚点，不要求不同俯角的全部地标逐像素重合。继续记录尊重保存位置；不为标题表演把玩家搬回炉席。</p>
 <details><summary>为什么这条制作路线能够落地</summary><p>现有作者模型保留完整几何，render(model, camera) 可以用独立相机重绘。正式游戏是固定视角的图层、光场与人物图集合成，不是自由环绕的实时 3D。新方案利用前者生成开场资源，再用短剪辑接后者。</p><p>最小包是基底、真实光贡献、核心能量/透射八帧和一个朝向的八相位人物静息；人物变化 patch 必须包含肩灯受光与影子。无需复制整套步行图集或四层移动视差。新档两端同用实际初始装置状态，避免满亮标题切到受损据点时突然变暗。</p><p className="small">相机初始搜索约 26°–31°，当前约 34°。角度是待验证的取景参数，不是“高级感”的证明。若核心更抢眼或深渊缩水，样片就应失败。</p></details>
 <h2>分四段制作，每段有明确的否决条件</h2>
 <nav aria-label="制作阶段">{production.map((p,i)=><button key={p[0]} aria-pressed={step===i} onClick={()=>setStep(i)}>{p[0]}</button>)}</nav>
 <div className="step"><h3>{production[step][0]}</h3><strong>{production[step][1]}</strong><p>{production[step][2]}</p></div>
 <h2>替换旧标题的门槛</h2>
 <ul><li>能认出同一人、同一炉火，且不靠文案讲解地理关系。</li><li>孤独、深渊、材料厚度与停留欲都不弱于原画。</li><li>核心仍是最强光源，画面仍有人；两团光的空间关系清楚。</li><li>没有用噪点、全场染色、假光圈或挪动功能地标掩盖失败。</li><li>连续动态、声音和真实进入流程各有证据，不以静帧或检查通过代替终审。</li></ul>
 <p><strong>这份方案论证的是制作因果。新镜头的艺术表现，需要完整母版证明。</strong> 第一轮交付完整关键帧与剪辑接点，不以粗糙线稿定画风。</p>
 <p><a href="../design-notes/opening-haven-reconstruction.md">完整方案正文（构图、光色、材料、动态、资产、阶段与验收）</a> · <a href="../reviews/interactive/opening-haven-experience-2026-09-30.html">前置实帧评审</a></p>
 </main>
}
