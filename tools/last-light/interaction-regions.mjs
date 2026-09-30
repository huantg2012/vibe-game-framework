/** Read-only visualization of the exact production eligibility query. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {LAST_LIGHT_INTERACTION_PROFILES,lastLightInteractionDistance} from '../../src/systems/last-light-interaction.ts';
import {canStandLastLight} from '../../src/systems/last-light-locomotion.ts';
import {sampleLastLightSurface,projectLastLight,LAST_LIGHT_STATIONS,REST_POSITION} from '../../src/systems/last-light-layout.ts';
const STEP=.06;
const output='docs/qa/artifacts/last-light-rift-interaction';
const presentation=[
 ['purifier','净化器','#65d4e9','贴近整排操作面','从公共地坪、画面右侧接近腔口和手轮。两端前半侧允许斜靠，贴住底座也应能操作。'],
 ['offering','供奉','#b89df2','面向环孔供奉','从环孔正面、画面下侧接近下沿夹件；背套筒一侧不作为操作面。'],
 ['growth','蜕变','#ee91b0','上楼后接近缸前','区域只在上层地坪，覆盖缸前与前侧；靠书架、后管线的一侧关闭。'],
 ['storage','储藏','#e6bf64','接近西侧支撑摇杆','主操作面在上层西侧，画面左上方。箱体两侧的西半段提供容错；朝镜头的大面并非整面可用。'],
 ['core','核心','#78a7f4','由回廊走向圣龛','朝据点中央的宽前沿和前侧可用，允许从回廊斜向接近；背向外缘的一侧关闭。'],
 ['rift','裂隙','#91cea7','在完整石坪上备行','只在内陆喉头约0.98m宽的阈边前接近，不沿整条裂隙触发，也不要求站进破口。'],
 ['rest','坐席','#ed976c','在炉子与断墙之间坐下','从面向炉火的内侧空位接近，坐下朝炉子。残墙背后靠平台外沿的位置不触发。'],
];
const {data:depth}=await sharp('public/assets/last-light/depth.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const image=await fs.readFile('public/assets/last-light/reference.png');
const imageUri='data:image/png;base64,'+image.toString('base64');
const p2=(x,y,z)=>{const p=projectLastLight({x,y,z});return [p.x,p.y];};
const fix=n=>Math.round(n*100)/100;
function boundary(cells){
 const edges=new Map();
 const key=p=>p.join(',');
 function add(a,b){const reverse=key(b)+'>'+key(a);if(edges.has(reverse))edges.delete(reverse);else edges.set(key(a)+'>'+key(b),[a,b]);}
 for(const [x,z]of cells){add([x,z],[x+1,z]);add([x+1,z],[x+1,z+1]);add([x+1,z+1],[x,z+1]);add([x,z+1],[x,z]);}
 const outgoing=new Map();for(const e of edges.values()){const k=key(e[0]);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(e);}
 const loops=[];while(edges.size){const first=edges.values().next().value;let e=first;const line=[];let guard=0;
  while(e&&guard++<100000){line.push(e[0]);edges.delete(key(e[0])+'>'+key(e[1]));if(key(e[1])===key(first[0]))break;e=outgoing.get(key(e[1]))?.find(q=>edges.has(key(q[0])+'>'+key(q[1])));}
  if(!e||guard>=100000)throw new Error('Unclosed region contour');loops.push(line);
 }return loops;
}
// Depth mask hides colour behind the actual opaque scene, instead of painting
// interaction polygons on the front of machines or on another storey's wall.
async function floorMask(y){
 const a=projectLastLight({x:0,y,z:0}),b=projectLastLight({x:1,y,z:0}),c=projectLastLight({x:0,y,z:1});
 const xx=b.x-a.x,xz=c.x-a.x,yx=b.y-a.y,yz=c.y-a.y,det=xx*yz-xz*yx;
 const bytes=Buffer.alloc(960*640*4);
 for(let py=0;py<640;py++)for(let px=0;px<960;px++){
  const dx=px+.5-a.x,dy=py+.5-a.y,x=(dx*yz-xz*dy)/det,z=(xx*dy-dx*yx)/det;
  const i=(py*960+px)*4,decoded=(depth[i]*256+depth[i+1])/256-80;
  const visible=depth[i+3]&&decoded-projectLastLight({x,y,z}).depth<.20;
  bytes.set([255,255,255,visible?255:0],i);
 }
 return 'data:image/png;base64,'+(await sharp(bytes,{raw:{width:960,height:640,channels:4}}).png().toBuffer()).toString('base64');
}
const masks={main:await floorMask(0),upper:await floorMask(2.6)};
const regions=[];
for(const [key,name,color,heading,intent]of presentation){
 const profile=LAST_LIGHT_INTERACTION_PROFILES.find(p=>p.key===key);
 const xs=profile.edges.flatMap(e=>[e.a.x,e.b.x]),zs=profile.edges.flatMap(e=>[e.a.z,e.b.z]);
 const minX=Math.floor((Math.min(...xs)-profile.reach)/STEP)*STEP,minZ=Math.floor((Math.min(...zs)-profile.reach)/STEP)*STEP;
 const cols=Math.ceil((Math.max(...xs)+profile.reach-minX)/STEP),rows=Math.ceil((Math.max(...zs)+profile.reach-minZ)/STEP);
 const cells=[];let tested=0;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const x=minX+(col+.5)*STEP,z=minZ+(row+.5)*STEP;
  const h=sampleLastLightSurface(profile.route,x,z);if(!h)continue;
  const state={x,y:h.height,z,route:profile.route};if(!canStandLastLight(state,profile.route))continue;tested++;
  if(Number.isFinite(lastLightInteractionDistance(state,profile,canStandLastLight)))cells.push([col,row]);
 }
 if(!cells.length)throw new Error(`${key}: no usable region`);
 const loops=boundary(cells).map(loop=>loop.map(([x,z])=>[minX+x*STEP,minZ+z*STEP]));
 const elevation=profile.route==='upper'?2.6:0;
 const point=key==='rest'?REST_POSITION:{x:LAST_LIGHT_STATIONS.find(s=>s.key===key).position[0],y:elevation,z:LAST_LIGHT_STATIONS.find(s=>s.key===key).position[2]};
 regions.push({key,name,color,heading,intent,number:String(regions.length+1).padStart(2,'0'),route:profile.route,elevation,loops,edges:profile.edges,anchor:point,tested,samples:cells.length});
 console.log(`${key}: ${cells.length} accepted centres / ${tested} standable samples`);
}
function path(loops,project){return loops.map(loop=>'M'+loop.map(([x,z])=>project(x,z).map(fix).join(',')).join('L')+'Z').join('');}
const tags={purifier:[362,253],offering:[454,159],growth:[661,143],storage:[783,254],core:[776,396],rift:[404,395],rest:[529,451]};
const groups=regions.map(r=>{
 const d=path(r.loops,(x,z)=>p2(x,r.elevation,z));
 const edgePaths=r.edges.map(e=>`M${p2(e.a.x,r.elevation,e.a.z).map(fix)}L${p2(e.b.x,r.elevation,e.b.z).map(fix)}`).join('');
 const anchor=projectLastLight(r.anchor),tag=tags[r.key];
 return `<g class="region" data-key="${r.key}" style="--c:${r.color}"><g class="fill-group" mask="url(#${r.route})"><path class="area" d="${d}" fill="${r.color}" fill-rule="evenodd"/><path d="${d}" fill="none" stroke="${r.color}" stroke-width=".8"/><path class="operating" d="${edgePaths}" fill="none" stroke="white" stroke-width="1.8"/></g><g class="tag"><path d="M${fix(anchor.x)},${fix(anchor.y)}L${tag[0]},${tag[1]}" stroke="${r.color}" stroke-width=".65"/><rect x="${tag[0]-13}" y="${tag[1]-7}" width="26" height="14" rx="3" fill="#101619" stroke="${r.color}" stroke-width=".8"/><text x="${tag[0]}" y="${tag[1]+3.2}" text-anchor="middle" fill="${r.color}" font-family="sans-serif" font-size="9" font-weight="700">${r.number}</text></g></g>`;
}).join('');
const defs=`<defs>${Object.entries(masks).map(([key,data])=>`<mask id="${key}" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="640"><image href="${data}" width="960" height="640"/></mask>`).join('')}</defs>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="315 120 505 352" aria-label="净化点实际可交互区域"><style>.area{fill-opacity:var(--area-opacity,.48)}.region{transition:opacity .12s}.region.dim{opacity:.10}.tag{pointer-events:none}</style>${defs}<image href="${imageUri}" width="960" height="640" style="image-rendering:pixelated"/>${groups}</svg>`;
await fs.writeFile(`${output}/regions.svg`,svg);
await sharp(Buffer.from(svg.replace('var(--area-opacity,.48)', '.48'))).resize(1515,1056).png().toFile(`${output}/regions.png`);
const sourceFiles=['src/systems/last-light-interaction.ts','src/systems/last-light-locomotion.ts','src/generated/last-light-layout.ts','public/assets/last-light/reference.png','public/assets/last-light/depth.png'];
const hashes={};for(const file of sourceFiles)hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
await fs.writeFile(`${output}/regions.json`,JSON.stringify({stepMetres:STEP,interpretation:'Eligible actor foot-centre positions, not mouse hitboxes. Sampled exact production predicate. Static eligibility, not history-dependent target priority.',hashes,regions},null,2)+'\n');
const topdown=regions.map(r=>`<g class="region" data-key="${r.key}"><path class="area" d="${path(r.loops,(x,z)=>[x*22,z*22])}" fill="${r.color}" fill-opacity=".46" fill-rule="evenodd" stroke="${r.color}" stroke-width=".8"/>${r.edges.map(e=>`<path d="M${e.a.x*22},${e.a.z*22}L${e.b.x*22},${e.b.z*22}" stroke="white" stroke-width="2"/>`).join('')}<text x="${r.anchor.x*22}" y="${r.anchor.z*22}" fill="${r.color}" text-anchor="middle" font-size="11" font-family="sans-serif">${r.number}</text></g>`).join('');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>净化点 · 七处交互区域</title><style>
*{box-sizing:border-box}body{margin:0;background:#101416;color:#e2e8e7;font:15px/1.55 system-ui,sans-serif}header{padding:22px 28px 16px;border-bottom:1px solid #344043}h1{font-size:24px;margin:0 0 6px}p{margin:0;color:#aebabb}button,input{font:inherit}main{display:grid;grid-template-columns:minmax(0,1fr) 300px;max-width:1650px;margin:auto}.stage{padding:14px 10px 0 20px;min-width:0}.controls{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 10px;font-size:13px;color:#c1cecc}button{border:1px solid #4e5d60;background:transparent;color:inherit;padding:5px 11px;cursor:pointer}.scene svg{display:block;width:100%;max-height:calc(100vh - 305px)}aside{padding:15px 24px 20px 18px;border-left:1px solid #344043}.key{display:block;width:100%;text-align:left;padding:9px 0;border:0;border-bottom:1px solid #303b3d}.key b{display:block;font-weight:600;font-size:15px}.key span{display:block;color:#a5b3b4;font-size:12px;padding-left:35px}.key.selected{background:#263033}.key i{display:inline-block;width:24px;font-size:13px;font-style:normal;color:var(--c);margin-right:10px}.detail{margin:14px 0 0;min-height:80px}.detail strong{display:block;margin-bottom:4px}.detail p{font-size:13px}.notes{font-size:12px;color:#acb8b8;padding:10px 4px 14px;max-width:1080px}.notes b{color:#e1e8e5}.topdown{display:none;background:#161d20;min-height:550px}.topdown svg{width:100%;height:540px}.scene.show-plan .iso{display:none}.scene.show-plan .topdown{display:block}footer{max-width:1650px;margin:auto;padding:10px 28px 20px;color:#7f9193;font-size:12px;border-top:1px solid #303b3d}a{color:#b4c9d0}input[type=range]{width:110px}.white-line{display:inline-block;width:23px;border-top:2px solid white;margin-right:5px}
@media(max-width:1050px){main{grid-template-columns:minmax(0,1fr)}.stage{padding:14px 18px 0}.scene svg{max-height:none}aside{border-left:0;border-top:1px solid #344043;display:grid;grid-template-columns:1fr 1fr;gap:0 22px;padding:10px 22px 20px}.detail{grid-column:1/-1;min-height:0}.key{padding:9px 4px}.controls{gap:10px}.topdown{min-height:0}.topdown svg{height:540px}}
</style><header><h1>净化点 · 可交互区域实图</h1><p>色块表示角色<b>脚底中心</b>处在这里时，可获得该对象的交互资格。它不是鼠标热区，也不是装置占地。</p></header><main><section class="stage"><div class="controls"><button id="all">显示全部</button><button id="view">切换俯视判定图</button><label>色块强度 <input id="opacity" aria-label="色块强度" type="range" min="15" max="80" value="48"></label><span><i class="white-line"></i>实际操作沿</span></div><div class="scene"><div class="iso">${svg}</div><div class="topdown"><svg viewBox="-130 -200 470 415" aria-label="分层判定区域的俯视投影"><text x="-120" y="-177" fill="#acb8b8" font-size="11">上方 = 世界 −Z · 右方 = +X（米制等比例）</text>${topdown}<path d="M-110,187h44" stroke="white" stroke-width="2"/><text x="-110" y="207" fill="white" font-size="10">2 m</text></svg></div></div><div class="notes"><b>读图：</b>色块已扣除机器底座、断口、无完整脚圆支撑的位置；上层色块按上层高度投影。场景视图会被实物遮挡，可切俯视图查看完整区域。<br><b>重叠处：</b>多个对象可同时有资格，E只选择更近的一处；旧目标仍有效时保留0.16m切换余量。<br><b>要留意：</b>储藏附近的断沿会切掉区域；当前算法只检查最近操作沿点的直达路径，出现细颈或断片时属于实际判定的保守裁切，并不都代表有意设计。</div></section><aside>${regions.map(r=>`<button class="key" data-select="${r.key}" style="--c:${r.color}"><b><i>${r.number}</i>${r.name}<small style="float:right;color:#91a2a5;font-size:11px;font-weight:400">${r.route==='upper'?'上层':'下层'}</small></b><span>${r.heading}</span></button>`).join('')}<div class="detail" aria-live="polite"><strong id="detail-title">为什么不是一圈圆？</strong><p id="detail-text">由可操作的前沿和前侧向外延伸，最大1.4m。背面不算操作面，隔层和跨断口不触发。点击右侧对象，可单独看它的区域和设计意图。</p></div></aside></main><footer>当前实现快照 · 2026-09-30 · 0.06m网格采样（轮廓近似约1–2原生像素） · canStandLastLight + lastLightInteractionDistance · 仅可视化，未改玩法判定。<br>所有辨识色仅用于此图，不是游戏美术配色。<a href="/">返回正式游戏</a> · <a href="../artifacts/last-light-rift-interaction/regions.svg">原始场景叠图</a></footer><script>
const data=${JSON.stringify(regions.map(({key,name,heading,intent})=>({key,name,heading,intent})))};let selected=null;function select(key){selected=key;document.querySelectorAll('.region').forEach(el=>el.classList.toggle('dim',!!key&&el.dataset.key!==key));document.querySelectorAll('.key').forEach(el=>el.classList.toggle('selected',el.dataset.select===key));const item=data.find(r=>r.key===key);document.querySelector('#detail-title').textContent=item?item.name+' · '+item.heading:'为什么不是一圈圆？';document.querySelector('#detail-text').textContent=item?item.intent:'由可操作的前沿和前侧向外延伸，最大1.4m。背面不算操作面，隔层和跨断口不触发。点击右侧对象，可单独看它的区域和设计意图。'}document.querySelectorAll('.key').forEach(b=>b.onclick=()=>select(selected===b.dataset.select?null:b.dataset.select));document.querySelector('#all').onclick=()=>select(null);document.querySelector('#opacity').oninput=e=>document.querySelector('.scene').style.setProperty('--area-opacity',e.target.value/100);document.querySelector('#view').onclick=e=>{const on=document.querySelector('.scene').classList.toggle('show-plan');e.target.textContent=on?'返回场景视图':'切换俯视判定图'};
</script></html>`;
await fs.writeFile('docs/qa/interactive/last-light-interaction-regions.html',html);
console.log('Wrote region contours, annotated SVG and interactive viewer.');
