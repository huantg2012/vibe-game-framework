/** Offline art correction: same production raster/material/light, all coverages.
 * No Phaser, gameplay simulation, browser driver or save access. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { bakeHumanModel, type HumanPhase } from '../../src/entities/form-renderers/d/human-model';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { lightModelPixels } from '../../src/entities/form-renderers/d/model-visual';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { INFILTRATOR_FORM, REWRITER_FORM } from '../../src/generation/contamination-draw';
import type { CoverageId } from '../../src/generated/contamination-lexicon-data';

const out = 'docs/qa/artifacts/enemy-human-readability-2026-10-23';
const source = 'docs/qa/artifacts/enemy-world-automation-2026-10-23';
const { cards } = JSON.parse(await fs.readFile(`${source}/atlas.json`, 'utf8')) as { cards: { worldId: string; label: string; kind: string }[] };
const tiers: CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const tierNames = ['渗透 · 低侵蚀', '改写 · 中侵蚀', '覆盖 · 高侵蚀'];
const facings = ['down', 'left', 'up', 'right'] as const;
const poses: { phase: HumanPhase; phase01: number }[] = [
  { phase: 'idle', phase01: 0 },
  ...Array.from({ length: 30 }, (_, i) => ({ phase: 'walk' as const, phase01: i / 30 })),
  ...Array.from({ length: 6 }, (_, i) => ({ phase: 'windup' as const, phase01: i / 5 })),
  { phase: 'strike', phase01: 0 },
  ...Array.from({ length: 6 }, (_, i) => ({ phase: 'recover' as const, phase01: i / 5 })),
];
const W = 208, H = 112, anchors = [30, 78, 126, 174], groundX = 56, groundY = 24, footY = 86;
const lighting = { lights: [{ x: 160, y: 8, z: 100, radius: 500, intensity: 2.4, color: [1, .94, .86] as const, castsShadow: false }] };
const raw = (data: Uint8Array | Uint8ClampedArray, width: number, height: number) => sharp(Buffer.from(data), { raw: { width, height, channels: 4 } });
function blit(dst: Uint8Array, sw: number, src: Uint8Array | Uint8ClampedArray, w: number, h: number, left: number, top: number) {
  const dh = dst.length / sw / 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4, dx = x + left, dy = y + top;
    if (src[p + 3] && dx >= 0 && dy >= 0 && dx < sw && dy < dh) dst.set(src.subarray(p, p + 4), (dy * sw + dx) * 4);
  }
}
await fs.mkdir(out, { recursive: true });
const tiles: { input: Buffer; left: number; top: number }[] = [];
const manifest = [];
let bakedFrames = 0;
for (const [index, card] of cards.entries()) {
  const worldAdaptation = resolveEnemyWorldAdaptation(card.worldId)!;
  const ground = new Uint8Array(await sharp(`${source}/${card.worldId}-ground.png`).extract({ left: groundX, top: groundY, width: W, height: H }).raw().toBuffer());
  await raw(ground, W, H).png().toFile(`${out}/${card.worldId}-ground.png`);
  const deployments = Object.fromEntries((['low', 'medium', 'severe'] as const).map(grade => {
    const recipe = createR100ProductionRecipe(card.worldId, 20261023, grade);
    const forms = [recipe.enemyDeployment?.infiltrator ?? INFILTRATOR_FORM, recipe.enemyDeployment?.rewriter ?? REWRITER_FORM];
    return [grade, [...new Set(forms.map(form => form.coverage))]];
  }));
  for (const version of [1, 2] as const) {
    const bodySheet = new Uint8Array(poses.length * 64 * (tiers.length * 4 * 64) * 4);
    for (const [tier, coverage] of tiers.entries()) {
      const still = ground.slice();
      for (let facing = 0; facing < 4; facing++) for (const [frame, pose] of poses.entries()) {
        const body = bakeHumanModel({ seed: 37, coverage, facing4: facings[facing]!, ...pose, worldAdaptation, ...(version === 2 ? { anatomyVersion: 2 as const } : {}) });
        lightModelPixels(body.buf.data, body.lightingSurface!, anchors[facing]! + groundX, footY + groundY, lighting);
        blit(bodySheet, poses.length * 64, body.buf.data, 64, 64, frame * 64, (tier * 4 + facing) * 64);
        if (frame === 0) blit(still, W, body.buf.data, 64, 64, anchors[facing]! - 32, footY - 42);
        bakedFrames++;
      }
      await raw(still, W, H).png().toFile(`${out}/${card.worldId}-${coverage}-v${version}.png`);
      if (version === 2) {
        const title = Buffer.from(`<svg width="416" height="52"><rect width="416" height="52" fill="#10181b"/><text x="12" y="23" font-size="16" fill="#d1d8cf" font-family="sans-serif">${card.label} · ${tierNames[tier]}</text><text x="12" y="43" font-size="12" fill="#94a49e" font-family="sans-serif">${card.kind} · 正 / 左 / 背 / 右</text></svg>`);
        tiles.push({ input: await sharp(title).png().toBuffer(), left: tier * 416, top: index * 276 });
        tiles.push({ input: await raw(still, W, H).resize(W * 2, H * 2, { kernel: 'nearest' }).png().toBuffer(), left: tier * 416, top: index * 276 + 52 });
      }
    }
    await raw(bodySheet, poses.length * 64, tiers.length * 4 * 64).png().toFile(`${out}/${card.worldId}-v${version}.png`);
  }
  manifest.push({ ...card, deployments });
}
await sharp({ create: { width: 1248, height: cards.length * 276, channels: 4, background: '#10181b' } }).composite(tiles).png().toFile(`${out}/overview.png`);
await fs.writeFile(`${out}/atlas.json`, JSON.stringify({ scope: 'Candidate anatomy v2 only, not production deployment; actual native ground pigments, same light, all three individual coverages. Map grades do not select humanoid coverage.', seed: 37, tiers, facings, framesPerFacing: poses.length, bakedFrames, groundSource: source, cards: manifest }, null, 2) + '\n');
await fs.writeFile(`${out}/index.html`, `<!doctype html><html lang="zh"><meta charset="utf-8"><title>人形识别修正 · 全侵蚀阶段</title>
<style>body{margin:28px auto;max-width:1360px;padding:0 24px;background:#0f1518;color:#d1d8cf;font:16px system-ui}h1{font-size:28px;margin-bottom:10px}p{max-width:1050px;color:#a1b0a8;line-height:1.7}a{color:#c4d5b9}button,select{background:#243132;color:#d1d8cf;border:1px solid #53635e;padding:8px 12px;cursor:pointer}button[aria-pressed=true]{border-color:#c9caa4;color:#edebce}header.controls{position:sticky;top:0;background:#0f1518f5;z-index:2;padding:12px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center}article{border-top:1px solid #3c4947;padding:18px 0 22px}h2{font-size:20px;margin:0 0 6px}.stages{display:flex;gap:16px;overflow-x:auto;padding:8px 0}.stage{flex:none;margin:0;width:416px}h3{font-size:16px;font-weight:500;margin:0 0 4px}.badge{height:24px;font-size:12px;color:#9cae9e}canvas{display:block;width:416px;height:224px;image-rendering:pixelated}.caption{font-size:12px;color:#94a49e;margin-top:6px}.status{color:#e1c294;font-size:14px}.grade{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.errors{color:#dfb0a3}small{color:#9baa9f}</style>
<h1>保留一个人的轮廓</h1><p class="status">修正候选 · 尚未切换正式游戏</p><p>六种材料，三个个体侵蚀阶段全部并排。头颈、肩腰、双臂和双腿持续可辨；污染改写组织、重心与节律。默认播放行走，可切动作、旧版和原始像素尺寸。</p>
<p>地图的「低／中／重污染」与个体的「渗透／改写／覆盖」是两件事。当前类人投放在三个地图档位均使用渗透与改写；覆盖列是完整结构展示，当前没有该阶段的常规类人投放。这里统一灯光，便于比较模型，不模拟三种地图氛围或玩家污染视野。</p>
<div class="grade">核对地图档位：<button data-grade="low" aria-pressed="true">低污染</button><button data-grade="medium" aria-pressed="false">中污染</button><button data-grade="severe" aria-pressed="false">重度污染</button><small>标注来自正式配方与投放 form；切档不会虚构另一套外形。</small></div>
<header class="controls"><button id="play">暂停</button><button data-mode="walk" aria-pressed="true">行走</button><button data-mode="idle" aria-pressed="false">静息</button><button data-mode="attack" aria-pressed="false">攻击</button><button id="version">当前：修正版 · 切旧版</button><select id="scale" aria-label="像素放大"><option value="1">1× 原始像素</option><option value="2" selected>2× 像素放大</option><option value="3">3× 像素放大</option></select><select id="world" aria-label="材料家族"><option value="all">全部六家族</option>${manifest.map(c => `<option value="${c.worldId}">${c.label} · ${c.kind.split(' · ')[0]}</option>`).join('')}</select><span id="load-status">正在载入图集…</span></header>
${manifest.map(c => `<article data-world="${c.worldId}"><h2>${c.label} · ${c.kind}</h2><div class="stages">${tiers.map((tier, t) => `<figure class="stage"><h3>${tierNames[t]}</h3><div class="badge" data-world="${c.worldId}" data-tier="${tier}"></div><canvas width="208" height="112" data-world="${c.worldId}" data-tier="${t}" aria-label="${c.label} ${tierNames[t]} 四向动态展示"></canvas><figcaption class="caption">正面 / 左侧 / 背面 / 右侧 · 同种子、同灯光</figcaption></figure>`).join('')}</div></article>`).join('')}
<p><a href="overview.png">六家族全阶段静态总览</a> · <a href="atlas.json">展示与投放口径</a> · <a href="checks.json">离线检查</a> · <a href="../enemy-world-automation-2026-10-23/index.html">原六家族图册（含占漆）</a></p>
<script>
const cards=${JSON.stringify(manifest)},anchors=${JSON.stringify(anchors)},footY=${footY},loaded=[];
let playing=true,version=2,mode='walk',time=0,last=0,grade='low';
const names={low:'低污染',medium:'中污染',severe:'重度污染'};
function badges(){document.querySelectorAll('.badge').forEach(el=>{const card=cards.find(c=>c.worldId===el.dataset.world);el.textContent=card.deployments[grade].includes(el.dataset.tier)?names[grade]+'地图 · 投放包含此阶段':'结构展示 · 此地图档位没有该阶段常规投放'})}badges();
function load(src){return new Promise((resolve,reject)=>{const image=new Image;image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(src));image.src=src})}
Promise.all(cards.map(async c=>{const [ground,v1,v2]=await Promise.all([load(c.worldId+'-ground.png'),load(c.worldId+'-v1.png'),load(c.worldId+'-v2.png')]);loaded.push({...c,ground,v1,v2,views:[...document.querySelectorAll('canvas[data-world="'+c.worldId+'"]')].map(canvas=>({ctx:canvas.getContext('2d'),tier:Number(canvas.dataset.tier)}))})})).then(()=>{document.getElementById('load-status').textContent='6 家族 × 3 阶段 × 4 朝向';requestAnimationFrame(tick)}).catch(error=>{const status=document.getElementById('load-status');status.className='errors';status.textContent='图集加载失败：'+error.message});
function tick(now){if(playing)time+=Math.min(50,now-(last||now));last=now;const frame=mode==='idle'?0:mode==='walk'?1+Math.floor(time%960/960*30):(()=>{const t=time%1600;return t<500?31+Math.min(5,Math.floor(t/500*6)):t<600?37:t<950?38+Math.min(5,Math.floor((t-600)/350*6)):0})();for(const c of loaded)for(const v of c.views){v.ctx.imageSmoothingEnabled=false;v.ctx.drawImage(c.ground,0,0);for(let d=0;d<4;d++)v.ctx.drawImage(c['v'+version],frame*64,(v.tier*4+d)*64,64,64,anchors[d]-32,footY-42,64,64)}requestAnimationFrame(tick)}
document.getElementById('play').onclick=e=>{playing=!playing;e.target.textContent=playing?'暂停':'播放'};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;time=0;document.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',el===b?'true':'false'))});
document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{grade=b.dataset.grade;badges();document.querySelectorAll('[data-grade]').forEach(el=>el.setAttribute('aria-pressed',el===b?'true':'false'))});
document.getElementById('version').onclick=e=>{version=3-version;e.target.textContent=version===2?'当前：修正版 · 切旧版':'当前：旧版 · 切修正版';document.querySelector('.status').textContent=version===2?'修正候选 · 尚未切换正式游戏':'旧版对照 · 三阶段补齐（原图册只展示改写）'};
document.getElementById('scale').onchange=e=>{const s=Number(e.target.value);document.querySelectorAll('canvas').forEach(c=>{c.style.width=208*s+'px';c.style.height=112*s+'px'});document.querySelectorAll('.stage').forEach(c=>c.style.width=208*s+'px')};
document.getElementById('world').onchange=e=>document.querySelectorAll('article').forEach(a=>a.hidden=e.target.value!=='all'&&a.dataset.world!==e.target.value);
</script></html>`);
console.log(JSON.stringify({ directory: out, cards: cards.length, tiers, bakedFrames }));
