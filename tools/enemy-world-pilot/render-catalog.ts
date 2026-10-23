/** Offline production-baker atlas. No Phaser scene, gameplay or save access. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { ENEMY_WORLD_MATERIAL_RULES, ENEMY_WORLD_MATERIAL_ROUTING } from '../../src/generated/enemy-world-materials';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { R100_WORLD_APPEARANCES } from '../../src/generated/r100-world-appearance';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { mapWorldPigment, paintedToneRange, sampleWorldAppearance } from '../../src/generation/world-study/world-material-pigment';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { bakeHumanModel, type HumanPhase } from '../../src/entities/form-renderers/d/human-model';
import { lightModelPixels } from '../../src/entities/form-renderers/d/model-visual';
import { sampleWorldMaterialLight, type WorldMaterialLighting } from '../../src/entities/form-renderers/d/world-material-light';
import { bakePaintGenome } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { paintPaintGenomeLive } from '../../src/entities/form-renderers/d/paint-genome/live';
import { paintSurfaceMaterial } from '../../src/entities/form-renderers/d/paint-genome/material';
import { applyPaintWorldLighting } from '../../src/entities/form-renderers/d/paint-genome/lighting';

const out='docs/qa/artifacts/enemy-world-automation-2026-10-23';
await fs.mkdir(out,{recursive:true});
const kinds:Record<string,string>={fibre:'纤维 · 分束承力',membrane:'薄膜 · 偏心牵拉',slab:'折板 · 错层搭接',shell:'断壳 · 裂瓣包覆',granular:'颗粒 · 不均结块',gel:'胶流 · 下垂拖曳'};
const lighting:WorldMaterialLighting={lights:[{x:160,y:8,z:100,radius:500,intensity:2.4,color:[1,.94,.86],castsShadow:false}]};
const W=320,H=160,anchors=[28,76,124,172],facings=['down','left','up','right'] as const;
const poses:{phase:HumanPhase;phase01:number}[]=[{phase:'idle',phase01:0},...Array.from({length:30},(_,i)=>({phase:'walk' as const,phase01:i/30})),...Array.from({length:6},(_,i)=>({phase:'windup' as const,phase01:i/5})),{phase:'strike',phase01:0},...Array.from({length:6},(_,i)=>({phase:'recover' as const,phase01:i/5}))];
const raw=(data:Uint8Array|Uint8ClampedArray,width:number,height:number)=>sharp(Buffer.from(data),{raw:{width,height,channels:4}});
function blit(dst:Uint8Array,sw:number,src:Uint8Array|Uint8ClampedArray,w:number,h:number,left:number,top:number) {
  const dh=dst.length/sw/4;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {const p=(y*w+x)*4,dx=x+left,dy=y+top;if(!src[p+3]||dx<0||dy<0||dx>=sw||dy>=dh)continue;dst.set(src.subarray(p,p+4),(dy*sw+dx)*4);}
}
const cards=[];const contact:{input:Buffer;left:number;top:number}[]=[];
for(const [index,rule] of ENEMY_WORLD_MATERIAL_RULES.entries()) {
  const members=ENEMY_WORLD_MATERIAL_ROUTING.filter(row=>row.family===rule.family);
  const world=R100_NATIVE_WORLDS.find(w=>w.enabled&&members.some(m=>m.worldId===w.id))??R100_NATIVE_WORLDS.find(w=>w.id===members[0]!.worldId)!;
  const worldId=world.id, material=resolveEnemyWorldAdaptation(worldId)!,appearance=R100_WORLD_APPEARANCES.find(w=>w.worldId===worldId)!;
  const source=ORGANIZATION_MATERIALS.find(m=>m.organization===appearance.materialOrganization)??PAINTED_MATERIALS.find(m=>m.family===rule.family)!;
  const pigment=await sharp(`public${source.source}`).resize(512,512).ensureAlpha().raw().toBuffer();
  const range=paintedToneRange({pixels:new Uint8ClampedArray(pigment)}),field={secondary:0,tone:0,detail:1},rgb=new Float32Array(3),light:[number,number,number]=[0,0,0];
  const ground=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
    const sx=Math.floor((x+120)*512/source.world_size)%512,sy=Math.floor((y+90)*512/source.world_size)%512,p=(sy*512+sx)*4,j=(y*W+x)*4;
    sampleWorldAppearance(appearance,x+120,y+90,37,field);
    mapWorldPigment(appearance,'ground',pigment[p]!,pigment[p+1]!,pigment[p+2]!,range,field,field.secondary,rgb);
    sampleWorldMaterialLight(lighting,x,y,0,0,0,1,false,light);
    for(let c=0;c<3;c++)ground[j+c]=Math.round(Math.min(255,rgb[c]!*light[c]!));ground[j+3]=255;
  }
  const bodies=new Uint8Array(poses.length*64*256*4);
  const still=ground.slice();
  for(let facing=0;facing<4;facing++) for(let frame=0;frame<poses.length;frame++) {
    const body=bakeHumanModel({seed:37,coverage:'rewrite',facing4:facings[facing]!,...poses[frame]!,worldAdaptation:material});
    lightModelPixels(body.buf.data,body.lightingSurface!,anchors[facing]!,96,lighting);
    blit(bodies,poses.length*64,body.buf.data,64,64,frame*64,facing*64);
    if(frame===0)blit(still,W,body.buf.data,64,64,anchors[facing]!-32,54);
  }
  const baked=bakePaintGenome({substrate:'fungal_mat',coverage:'rewrite',seed:77,continuity:'colony',sense:'sense_touch',rhythm:'rhythm_cluster',geometryVersion:2});
  const {canvasW:pw,canvasH:ph}=baked,scratch=baked.field.slice(),pixels=new Uint8ClampedArray(pw*ph*4),paint=new Uint8Array(pw*32*ph*4);
  for(let frame=0;frame<32;frame++) {
    const time=frame/32*Math.PI*1000;
    paintPaintGenomeLive({rest:baked.field,scratch,out:pixels,w:pw,h:ph,elapsedMs:time,inflated:false,ramp:baked.ramp,growth:baked.growth});
    paintSurfaceMaterial(pixels,scratch,pw,ph,'fungal_mat','rewrite',77,time,undefined,material,baked.growth);
    applyPaintWorldLighting(pixels,scratch,pw,ph,248-pw/2,94-ph/2,lighting);
    blit(paint,pw*32,pixels,pw,ph,frame*pw,0);
    if(frame===0)blit(still,W,pixels,pw,ph,248-Math.floor(pw/2),94-Math.floor(ph/2));
  }
  await Promise.all([raw(ground,W,H).png().toFile(`${out}/${worldId}-ground.png`),raw(bodies,poses.length*64,256).png().toFile(`${out}/${worldId}-body.png`),raw(paint,pw*32,ph).png().toFile(`${out}/${worldId}-paint.png`),raw(still,W,H).png().toFile(`${out}/${worldId}.png`)]);
  const label=world.profile.label;
  const title=Buffer.from(`<svg width="640" height="52"><rect width="640" height="52" fill="#10181b"/><text x="16" y="24" font-size="18" fill="#d1d8cf" font-family="sans-serif">${label} · ${kinds[rule.kind]}</text><text x="16" y="44" font-size="12" fill="#94a49e" font-family="sans-serif">${worldId} · ${members.length} worlds</text></svg>`);
  contact.push({input:await sharp(title).png().toBuffer(),left:index%2*640,top:Math.floor(index/2)*372},{input:await raw(still,W,H).resize(640,320,{kernel:'nearest'}).png().toBuffer(),left:index%2*640,top:Math.floor(index/2)*372+52});
  cards.push({worldId,label,kind:kinds[rule.kind],count:members.length,pw,ph,source:source.source});
}
await sharp({create:{width:1280,height:1116,channels:4,background:'#10181b'}}).composite(contact).png().toFile(`${out}/overview.png`);
await fs.writeFile(`${out}/atlas.json`,JSON.stringify({scope:'Production bakers on actual world ground pigments under one common lamp; material study, not gameplay screenshots',cards},null,2)+'\n');
await fs.writeFile(`${out}/index.html`,`<!doctype html><html lang="zh"><meta charset="utf-8"><title>六种世界材料 · 怪物自动适配</title><style>body{background:#0f1518;color:#d1d8cf;font:16px system-ui;margin:32px auto;max-width:1320px}h1{font-size:28px}p{color:#9baa9f;line-height:1.7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:#172024;padding:16px}h2{font-size:19px;margin:0 0 8px}canvas{width:100%;image-rendering:pixelated}button{background:#283635;color:#d1d8cf;border:1px solid #526562;padding:8px 16px;margin-right:8px;cursor:pointer}small{color:#9baa9f}.controls{margin:24px 0}a{color:#bbcdb8}</style><h1>六种世界材料 · 同一套规则</h1><p>108 个世界自动选用家族画法与本地材料。这里使用正式模型烘焙器、原生地面材质和统一灯光，供比较结构与归属感。不是游戏实景，也不代表其余105世界已开放。</p><div class="controls"><button id="toggle">暂停</button><button data-mode="walk">行走</button><button data-mode="idle">静息</button><button data-mode="attack">攻击前摇 → 出手 → 收势</button><button id="scale">当前 2× · 切为 1×</button></div><div class="grid">${cards.map(c=>`<article><h2>${c.label} · ${c.kind}</h2><small>${c.count} 个世界共用此家族 · 正／左／背／右 · 占漆</small><canvas width="320" height="160" id="${c.worldId}"></canvas></article>`).join('')}</div><p>外观版本与地图／战斗规则分离；旧局按冻结材料恢复。仅验证类人及地面占漆；其他敌人类别保留现状。<a href="overview.png">静态总览</a> · <a href="checks.json">离线检查</a></p><script>
const cards=${JSON.stringify(cards)},loaded=[],anchors=[28,76,124,172];let playing=true,mode='walk',time=0,last=0,scale=2;
function load(src){return new Promise(r=>{const i=new Image;i.onload=()=>r(i);i.src=src})}
Promise.all(cards.map(async c=>{const [ground,body,paint]=await Promise.all(['ground','body','paint'].map(s=>load(c.worldId+'-'+s+'.png')));loaded.push({...c,ground,body,paint,ctx:document.getElementById(c.worldId).getContext('2d')})})).then(()=>requestAnimationFrame(tick));
function tick(now){if(playing)time+=Math.min(50,now-(last||now));last=now;const f=mode==='idle'?0:mode==='walk'?1+Math.floor(time%960/960*30):(()=>{const t=time%1600;return t<500?31+Math.min(5,Math.floor(t/500*6)):t<600?37:t<950?38+Math.min(5,Math.floor((t-600)/350*6)):0})();for(const c of loaded){c.ctx.imageSmoothingEnabled=false;c.ctx.drawImage(c.ground,0,0);const p=Math.floor(time%(Math.PI*1000)/(Math.PI*1000)*32);c.ctx.drawImage(c.paint,p*c.pw,0,c.pw,c.ph,248-Math.floor(c.pw/2),94-Math.floor(c.ph/2),c.pw,c.ph);for(let a=0;a<4;a++)c.ctx.drawImage(c.body,f*64,a*64,64,64,anchors[a]-32,54,64,64)}requestAnimationFrame(tick)}
document.getElementById('toggle').onclick=e=>{playing=!playing;e.target.textContent=playing?'暂停':'播放'};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;time=0});document.getElementById('scale').onclick=e=>{scale=3-scale;document.querySelectorAll('canvas').forEach(c=>c.style.width=scale===1?'320px':'100%');e.target.textContent='当前 '+scale+'× · 切为 '+(3-scale)+'×'};
</script></html>`);
console.log(JSON.stringify({cards:cards.map(c=>c.worldId),directory:out}));
