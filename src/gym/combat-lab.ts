import { contaminantIconUrl } from '@/art/contaminant-icons';
import { CONTAMINANT_QUALITY_DATA } from '@/generated/contaminant-quality-data';
import type { ContaminantQuality } from '@/types/game-types';
/** Standalone combat experience tool. Configuration is shareable, gameplay saves are untouched. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { AUDIO_ASSETS, audioUrlsFor } from '@/managers/audio-catalog';
import { audioManager } from '@/managers/audio-manager';
import { inventoryStore } from '@/systems/inventory-store';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { LEXEME_DATA, PORTFOLIO_DATA, SUBSTRATE_DATA, type CoverageId } from '@/generated/contamination-lexicon-data';
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { motionChoicesFor } from '@/generation/contamination-draw';
import { INSPECTOR_ENTRIES, inspectorForm, entryGroup } from './enemy-inspector-catalog';
import { CombatLabScene } from './combat-lab-scene';
import type { CombatLabConfig } from './combat-lab-types';
import type { ContaminantType } from '@/types/game-types';
import './combat-lab.css';

// game-config transitively imports production save wiring. Disconnect before any lab mutation.
inventoryStore.setPersistence(null);
const root = document.getElementById('combat-lab-root')!;
root.innerHTML = `<header><h1>战斗试验场</h1><p>那天之后 · 出手、交锋与受伤</p><a id="inspector-link" href="/enemy-inspector.html">敌人检视室</a><a href="/">返回游戏</a></header>
<main><aside aria-label="对练配置">
<fieldset><legend>手中之物</legend><label for="weapon">撬棍</label><select id="weapon"></select>
<div class="weapon-preview"><img id="weapon-icon" alt="撬棍像素图标"/><div><strong id="weapon-name"></strong><span id="weapon-stats"></span></div></div>
<div class="pair"><div><label for="tool-q">主动 · Q</label><select id="tool-q"></select></div><div><label for="tool-f">主动 · F</label><select id="tool-f"></select></div></div>
<label for="tool-quality">异物品质</label><select id="tool-quality"></select><label for="tool-passive">被动工具</label><select id="tool-passive"></select><p class="small" id="tool-description">工具使用真实次数，重开后补满。</p></fieldset>
<fieldset><legend>交锋对象</legend><label for="enemy">敌人</label><select id="enemy"></select>
<div class="pair"><div><label for="coverage">污染程度</label><select id="coverage"><option value="infiltrate">低污染</option><option value="rewrite">中污染</option><option value="overwrite">高污染</option></select></div><div><label for="variant">外形</label><select id="variant"></select></div></div>
<div class="pair"><div><label for="count">数量</label><select id="count"><option value="1">1 · 单体</option><option value="2">2 · 双目标</option><option value="3">3 · 围攻</option></select></div><div><label for="exercise">试验方式</label><select id="exercise"><option value="duel">真实对练</option><option value="empty">空场试挥</option></select></div></div><p class="small" id="enemy-note"></p>
<details class="experiment"><summary>行为与身体构成</summary><label for="motion">行动</label><select id="motion"></select><label for="sense">感知</label><select id="sense"></select><label for="rhythm">活动节律</label><select id="rhythm"></select><label for="continuity">身体构成</label><select id="continuity"></select></details></fieldset>
<fieldset><legend>对练节奏</legend><label class="check"><input id="auto-reset" type="checkbox" checked/>倒地或清场后自动重开</label><label class="check"><input id="protected" type="checkbox"/>玩家免伤（不体验受伤反馈）</label>
<div class="pair"><div><label for="zoom">镜头</label><select id="zoom"><option value="1.5">1.5× · 实战</option><option value="3">3× · 近观</option></select></div><div><label for="fragment">场地材质</label><select id="fragment"></select></div></div>
<details class="experiment"><summary>负重与混乱</summary><label for="chaos">起始混乱</label><select id="chaos"><option value="0">0 · 稳定</option><option value="40">40 · 侵入</option><option value="80">80 · 高压</option></select><label for="extra-weight">附加负重 <output id="extra-label">0.0</output></label><input id="extra-weight" type="range" min="0" max="130" value="0" step="1"/><p class="small" id="burden-note"></p></details></fieldset>
<p class="small">调整配置会重开当前对练。这里只保存网址参数；不会改变正式装备、进度或存档。</p></aside>
<section class="viewer" aria-label="战斗场地"><div class="toolbar"><strong id="encounter-title">准备场地…</strong><button id="approach">靠近敌人</button><button id="restart">R 重开</button><button id="pause" class="primary">暂停</button></div>
<div class="stage"><div id="game-container" tabindex="0" aria-label="点击进入战斗，WASD移动，空格攻击"></div><div id="pause-veil" class="pause-veil" hidden><button id="resume">进入对练<small>点击场地继续 · 配置时暂停</small></button></div></div>
<div class="readouts"><div><span>玩家完整度</span><strong id="health">—</strong><div class="health-track"><i id="health-fill" style="width:100%"></i></div></div><div><span>当前挥击 · 实际伤害</span><strong id="swing">—</strong></div><div><span>敌人状态</span><strong id="subjects">—</strong></div></div>
<div class="feedback"><p id="message" role="status">使用真实动作、碰撞与攻击判定。</p><output id="hits"></output></div><footer><kbd>WASD</kbd> 移动 / 转向　<kbd>Space</kbd> 挥击　<kbd>Q</kbd> / <kbd>F</kbd> 工具　<kbd>R</kbd> 重开　<kbd>Esc</kbd> 暂停　<span id="live-attributes"></span><br/>武器耐久度：<span id="weapon-durability">—</span>　工具余次：<span id="tool-uses">未装配</span></footer><p id="error" class="error" role="alert"></p></section></main>`;
const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const select = (id: string): HTMLSelectElement => el<HTMLSelectElement>(id);
const query = new URLSearchParams(location.search);
function fill(id: string, entries: readonly {value: string; label: string}[], requested?: string | null): void {
  const node = select(id); node.replaceChildren(...entries.map(item => new Option(item.label, item.value)));
  if (entries.some(item => item.value === requested)) node.value = requested!;
}
function fromQuery(id: string): void { const value = query.get(id); if (value && [...select(id).options].some(o => o.value === value)) select(id).value = value; }
fill('weapon', Object.values(WEAPON_DATA).map(w => ({value:w.id,label:`${w.name}${w.variant === 'standard' ? '' : w.variant === 'light' ? ' · 轻型' : ' · 抗污'}`})), query.get('weapon'));
let group: HTMLOptGroupElement | undefined;
for (const entry of INSPECTOR_ENTRIES) {
  const label = entryGroup(entry);
  if (!group || group.label !== label) { group = document.createElement('optgroup'); group.label = label; select('enemy').append(group); }
  group.append(new Option(entry.label, entry.id));
}
select('enemy').value = INSPECTOR_ENTRIES.find(e=>e.id===query.get('enemy'))?.id ?? INSPECTOR_ENTRIES.find(e=>e.family.substrate==='insect_remnant')!.id;
for (const id of ['tool-q','tool-f','tool-passive']) fill(id, [{value:'',label:'不装配'},...Object.values(CONTAMINANT_DATA).filter(c=>c.toolType===(id==='tool-passive'?'passive':'active')).map(c=>({value:c.id,label:c.displayNameTool}))], query.get(id));
fill('tool-quality', Object.values(CONTAMINANT_QUALITY_DATA).map(q=>({value:q.id,label:q.name})),query.get('tool-quality'));
fill('fragment', Object.values(RIFT_FRAGMENT_DATA).filter(f=>['frag-library','frag-clinic','frag-metro','frag-outdoor'].includes(f.id)).map(f=>({value:f.id,label:f.displayName})),query.get('fragment')??'frag-library');
for (const id of ['coverage','count','exercise','zoom','chaos']) fromQuery(id);
el<HTMLInputElement>('protected').checked=query.get('protected')==='1';
el<HTMLInputElement>('auto-reset').checked=query.get('auto-reset')!=='0';
const extra=Number(query.get('extra-weight')??0);el<HTMLInputElement>('extra-weight').value=String(Number.isFinite(extra)?Math.max(0,Math.min(160,Math.round(extra))):0);
const entry=()=>INSPECTOR_ENTRIES.find(e=>e.id===select('enemy').value)!;
const continuityLabels: Record<string,string>={monolith:'整块 · 可攻击主体',shards:'碎裂',colony:'菌落 · 多核',field:'场域 · 不可杀'};
function syncEnemy(reset: boolean): void {
  const e=entry(); const form=inspectorForm(e,select('coverage').value as CoverageId);
  fill('variant',e.variants.map((v,i)=>({value:String(i),label:v.label})),reset?'0':select('variant').value||query.get('variant'));
  fill('motion',motionChoicesFor(e.family.substrate,e.family.portfolio,form.coverage).map(id=>({value:id,label:LEXEME_DATA[id]?.displayToken??id})),reset?form.lexemes.motion:select('motion').value||query.get('motion'));
  for(const slot of ['sense','rhythm'] as const) fill(slot,e.family[slot].map(id=>({value:id,label:LEXEME_DATA[id]?.displayToken??id})),reset?form.lexemes[slot]:select(slot).value||query.get(slot));
  fill('continuity',PORTFOLIO_DATA[e.family.portfolio].legalContinuities.filter(c=>SUBSTRATE_DATA[e.family.substrate]!.legalContinuities.includes(c)).map(c=>({value:c,label:continuityLabels[c]!})),reset?form.continuity:select('continuity').value||query.get('continuity'));
  select('count').disabled=e.family.portfolio!=='jia';
  if(select('count').disabled) select('count').value='1';
  el('enemy-note').textContent=e.family.portfolio==='jia'?'使用该敌人的正式感知、攻击时序与污染模型。':'环境污染体每次放置一体。整块 / 菌落须击中核；场域不可杀，请测试其接触与危险周期。';
}
function syncGear(): void {
  const w=WEAPON_DATA[select('weapon').value]!;
  el<HTMLImageElement>('weapon-icon').src=`/assets/weapons/crowbars/${w.id}-icon.png`;
  el('weapon-name').textContent=w.name;
  el('weapon-stats').textContent=`伤害 ${w.damageMin}–${w.damageMax}　负重 ${(w.weight/10).toFixed(1)}　抗性 ${w.pollutionResistance}%`;
  const toolIds=['tool-q','tool-f','tool-passive'].map(id=>select(id).value).filter(Boolean);
  const descriptions = toolIds.map(id => {
    const def = CONTAMINANT_DATA[id as ContaminantType];
    const row = document.createElement('span'); row.style.display = 'block';
    const icon = document.createElement('img'); icon.src = contaminantIconUrl(id as ContaminantType, select('tool-quality').value as ContaminantQuality);
    icon.alt = ''; icon.width = 24; icon.height = 24; icon.style.imageRendering = 'pixelated'; icon.style.verticalAlign = 'middle';
    row.append(icon, document.createTextNode(`${def.displayNameTool}：${def.descriptionTool}`)); return row;
  });
  el('tool-description').replaceChildren(...(descriptions.length ? descriptions : [document.createTextNode('工具使用真实次数，重开后补满。')]));
  const base=w.weight+toolIds.length*20, slider=el<HTMLInputElement>('extra-weight'); slider.max=String(Math.max(0,160-base));
  if(Number(slider.value)>Number(slider.max))slider.value=slider.max;
  el('extra-label').textContent=(Number(slider.value)/10).toFixed(1);
  el('burden-note').textContent=`装备 ${(base/10).toFixed(1)} + 附加 ${(Number(slider.value)/10).toFixed(1)} / 上限 16.0。工具耗尽后实际负重随之减少。`;
}
syncEnemy(false);syncGear();
function config():CombatLabConfig {
  const e=entry(), base=inspectorForm(e,select('coverage').value as CoverageId);
  const tool=(id:string):ContaminantType|null=>(select(id).value||null) as ContaminantType|null;
  return {form:{...base,continuity:select('continuity').value as typeof base.continuity,lexemes:{...base.lexemes,motion:select('motion').value,sense:select('sense').value,rhythm:select('rhythm').value}},
    seed:e.variants[Number(select('variant').value)]!.seed,fragmentTypeId:select('fragment').value,weaponId:select('weapon').value,
    toolQuality:select('tool-quality').value as ContaminantQuality,tools:[tool('tool-q'),tool('tool-f'),tool('tool-passive')],
    count:Number(select('count').value) as 1|2|3,empty:select('exercise').value==='empty',protected:el<HTMLInputElement>('protected').checked,autoReset:el<HTMLInputElement>('auto-reset').checked,zoom:Number(select('zoom').value),extraWeight:Number(el<HTMLInputElement>('extra-weight').value),startingChaos:Number(select('chaos').value)};
}
let ready=false,paused=false,revision=0;
const stage=el('game-container');
class CombatLabBoot extends Phaser.Scene {
  constructor(){super('CombatLabBoot');}
  preload():void {for(const asset of AUDIO_ASSETS)this.load.audio(asset.key,audioUrlsFor(asset));}
  create():void {generatePlaceholderTextures(this);audioManager.bind(this.game);ready=true;this.scene.stop();restart(false);}
}
const game=new Phaser.Game(gameConfigWithScenes([CombatLabBoot,CombatLabScene]));
const scene=():CombatLabScene=>game.scene.getScene('CombatLabScene') as CombatLabScene;
function updatePauseView():void{el('pause-veil').hidden=!paused;el('pause').textContent=paused?'继续':'暂停';}
function pause():void{
  if(!ready)return;paused=true;if(game.scene.isActive('CombatLabScene'))game.scene.pause('CombatLabScene');game.sound.pauseAll();updatePauseView();
}
function play():void{
  if(!ready)return;paused=false;stage.focus();if(game.scene.isPaused('CombatLabScene'))game.scene.resume('CombatLabScene');scene().focusArena();game.sound.resumeAll();audioManager.unlock();updatePauseView();
}
function restart(keepPaused=paused):void{
  if(!ready)return;paused=keepPaused;revision++;const current=revision,c=config();
  const params=new URLSearchParams();
  for(const id of ['weapon','enemy','coverage','variant','motion','sense','rhythm','continuity','count','exercise','zoom','fragment','chaos','tool-q','tool-f','tool-passive'])params.set(id,select(id).value);
  params.set('tool-quality',c.toolQuality);params.set('extra-weight',String(c.extraWeight));params.set('protected',c.protected?'1':'0');params.set('auto-reset',c.autoReset?'1':'0');history.replaceState(null,'',`${location.pathname}?${params}`);
  el<HTMLAnchorElement>('inspector-link').href=`/enemy-inspector.html?enemy=${encodeURIComponent(entry().id)}&coverage=${c.form.coverage}&variant=${select('variant').value}`;
  el('encounter-title').textContent=c.empty?'空场 · 试挥与移动':`${entry().label} · ${select('coverage').selectedOptions[0]!.textContent} · ${c.count} 体`;
  el<HTMLButtonElement>('approach').disabled=c.empty;
  game.scene.stop('CombatLabScene');
  scene().events.once(Phaser.Scenes.Events.CREATE,()=>{if(current!==revision)return;if(paused)pause();else play();});
  game.scene.start('CombatLabScene',c);updatePauseView();
}
for(const node of root.querySelectorAll<HTMLSelectElement|HTMLInputElement>('aside select, aside input')){
  node.addEventListener('change',()=>{if(node.id==='enemy')syncEnemy(true);else if(node.id==='coverage')syncEnemy(false);syncGear();restart(true);});
}
el('extra-weight').addEventListener('input',syncGear);
root.querySelector('aside')!.addEventListener('focusin',pause);
el('resume').onclick=play;stage.addEventListener('pointerdown',play);
el('pause').onclick=()=>paused?play():pause();
el('restart').onclick=()=>{restart(false);};
el('approach').onclick=()=>{play();scene().approachMelee();};
document.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(target.matches('input,select,textarea')||target.isContentEditable)return;
  if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();paused?play():pause();}
  else if(!target.matches('button')&&event.code==='KeyR'&&!event.repeat){event.preventDefault();event.stopImmediatePropagation();restart(false);}
},true);
const phaseLabels:Record<string,string>={idle:'就绪',windup:'起手',active:'挥击',recovery:'回收',cooldown:'收势',strike:'出手',dead:'消亡',awake:'苏醒',inflated:'警觉'};
const setText=(id:string,text:string):void=>{const node=el(id);if(node.textContent!==text)node.textContent=text;};
const interval=setInterval(()=>{
  if(!ready||(!game.scene.isActive('CombatLabScene')&&!game.scene.isPaused('CombatLabScene')))return;
  const s=scene().getReviewState();if(!s.ready)return;
  setText('health',`${s.health} / ${s.maxHealth}${el<HTMLInputElement>('protected').checked?' · 免伤':''}`);
  el('health-fill').style.width=`${Math.max(0,s.health/s.maxHealth*100)}%`;
  setText('swing',`${phaseLabels[s.playerPhase]??s.playerPhase} · ${s.swingCount?s.lastSwingDamage:'—'}${s.swingCount?` / 第 ${s.swingCount} 挥`:''}`);
  setText('subjects',s.subjects.length?s.subjects.map((e,i)=>`${i+1}: ${!e.alive?'消亡':e.health===null?`${e.nuclei} 核`:e.health+' HP'} · ${phaseLabels[e.phase]??e.phase}`).join(' / '):'空场');
  setText('hits',`命中 ${s.hitsDealt} · 受击 ${s.hitsTaken}`);
  setText('message',s.message||(paused?'已暂停，点击场地继续。':'按 R 随时重开同一场对练。'));
  setText('live-attributes',`混乱 ${s.chaos.toFixed(1)} · 负重 ${(s.weight/10).toFixed(1)}/16.0 · 负重减速 ${Math.round((1-s.speedFactor)*100)}% · 抗性 ${s.resistancePercent}%`);
  setText('weapon-durability',`${s.weaponDurability} / ${s.weaponMaxDurability}${s.weaponDurability === 0 ? ' · 已损坏' : ''}`);
  setText('tool-uses',s.tools.length?s.tools.map(t=>`${CONTAMINANT_DATA[t.id].displayNameTool} ${t.remaining}`).join(' / '):'未装配');
},100);
window.addEventListener('error',event=>{setText('error',`试验场错误：${event.message}`);});
window.addEventListener('blur',pause);
window.addEventListener('pagehide',event=>{if(event.persisted){pause();return;}clearInterval(interval);game.destroy(true);});
// Read-only inspection surface for the browser regression; no entry point to a game save.
Object.assign(window,{__combatLab:{game,getConfig:config,getState:()=>scene().getReviewState()}});
