import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { AUDIO_ASSETS, audioUrlsFor } from '@/managers/audio-catalog';
import { audioManager } from '@/managers/audio-manager';
import { LEXEME_DATA, SUBSTRATE_DATA, PORTFOLIO_DATA, type CoverageId } from '@/generated/contamination-lexicon-data';
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { INSPECTOR_ENTRIES, entryGroup, inspectorForm, actionsFor, actionLabel, volumePhaseLabel, type ReviewAction } from './enemy-inspector-catalog';
import { EnemyInspectorPreview } from './enemy-inspector-preview';
import { EnemyInspectorArena } from './enemy-inspector-arena';
import { EnemyInspectorContext } from './enemy-inspector-context';
import { motionChoicesFor } from '@/generation/contamination-draw';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import './enemy-inspector.css';
const root = document.getElementById('inspector-root')!;
root.innerHTML = `<header><h1>敌人检视室</h1><p>那天之后 / 正式模型与行为</p><a href="/combat-lab.html">战斗试验场</a><a href="/">返回游戏</a></header>
<main><nav aria-label="敌人目录" id="catalog"></nav><section class="viewer">
<div class="mode-row"><button id="preview-mode" aria-pressed="true">单体检视</button><button id="arena-mode" aria-pressed="false">实战观察</button><button id="context-mode" aria-pressed="false">同场景对照</button><span id="sample-meta"></span></div>
<div id="game-container" tabindex="0" aria-label="敌人展示画布"></div><div id="error" role="alert"></div>
<div id="transport"><button id="play">暂停</button><button id="previous-frame" title="上一帧">− 帧</button><button id="next-frame" title="下一帧">+ 帧</button><input id="timeline" aria-label="动作时间轴" type="range" min="0" max="1000" value="0"/><output id="progress">0%</output></div>
<div id="phase-label" aria-live="off">加载生产资源…</div><p class="hint" id="mode-hint"></p>
</section><aside><div class="eyebrow" id="category"></div><h2 id="sample-title"></h2>
<label for="variant">外形变体</label><select id="variant"></select>
<label for="coverage">污染程度</label><select id="coverage"><option value="infiltrate">低 · 渗透</option><option value="rewrite">中 · 改写</option><option value="overwrite">高 · 覆盖</option></select>
<label for="fragment">场景材质</label><select id="fragment"></select>
<fieldset id="preview-controls"><label for="action">动作</label><select id="action"></select>
<label for="facing">朝向</label><select id="facing"><option value="down">正面 ↓</option><option value="right">右侧 →</option><option value="up">背面 ↑</option><option value="left">左侧 ←</option></select>
<label for="speed">播放速度</label><select id="speed"><option value="0.1">0.1× · 极慢</option><option value="0.25">0.25× · 慢放</option><option value="0.5">0.5×</option><option value="1" selected>1× · 原速</option><option value="2">2×</option></select>
<label for="zoom">模型放大</label><select id="zoom"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="5" selected>5×</option><option value="7">7×</option></select></fieldset>
<details id="behavior"><summary style="margin-top:24px;font-size:13px;cursor:pointer">行为配置（生产支持项）</summary>
<label for="motion">运动方式</label><select id="motion"></select><label for="sense">感知方式</label><select id="sense"></select><label for="rhythm">活动节律</label><select id="rhythm"></select><label for="continuity">结构连续性</label><select id="continuity"></select></details>
<div id="arena-controls" hidden><label class="check"><input id="protected" type="checkbox" checked/>观察保护</label><div class="actions"><button id="approach">接近样本</button><button id="melee">进入近战</button><button id="hit">受击样本</button><button id="kill">消亡样本</button><button id="restart">重新生成</button></div><p class="hint">点击场地 · WASD 移动 / 空格挥击。死亡后可重新生成同一个样本。</p><p id="live-summary" class="hint"></p><label for="arena-zoom">实战镜头</label><select id="arena-zoom"><option value="1.5">1.5× · 关卡视野</option><option value="3" selected>3× · 近观</option><option value="5">5× · 特写</option></select><details><summary style="margin-top:16px;font-size:12px">详细运行状态</summary><pre id="live-state"></pre></details></div>
</aside></main>`;
function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
function select(id: string): HTMLSelectElement { return el<HTMLSelectElement>(id); }
function fill(id: string, options: readonly {
    value: string;
    label: string;
}[], value?: string): void {
    const target = select(id);
    target.replaceChildren(...options.map(o => new Option(o.label, o.value)));
    if (value && options.some(o => o.value === value))
        target.value = value;
}
const query = new URLSearchParams(location.search);
let entry = INSPECTOR_ENTRIES.find(e => e.id === query.get('enemy')) ?? INSPECTOR_ENTRIES.find(e => e.family.substrate === 'insect_remnant')!;
let mode: 'preview' | 'arena' | 'context' = query.get('mode') === 'arena' ? 'arena' : query.get('mode') === 'context' ? 'context' : 'preview';
let ready = false;
let lastGroup = '';
for (const item of INSPECTOR_ENTRIES) {
    const group = entryGroup(item);
    if (group !== lastGroup) {
        const h = document.createElement('h2');
        h.textContent = group;
        el('catalog').append(h);
        lastGroup = group;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.enemy = item.id;
    button.textContent = item.label;
    button.addEventListener('click', () => { entry = item; populate(); restartMode(); });
    el('catalog').append(button);
}
fill('fragment', Object.values(RIFT_FRAGMENT_DATA).filter(f => ['frag-library', 'frag-outdoor', 'frag-clinic', 'frag-metro'].includes(f.id)).map(f => ({ value: f.id, label: f.displayName })), query.get('fragment') ?? 'frag-library');
if (['infiltrate', 'rewrite', 'overwrite'].includes(query.get('coverage') ?? ''))
    select('coverage').value = query.get('coverage')!;
function populate(): void {
    for (const button of el('catalog').querySelectorAll<HTMLButtonElement>('button'))
        button.setAttribute('aria-current', String(button.dataset.enemy === entry.id));
    el('category').textContent = entryGroup(entry);
    el('sample-title').textContent = entry.label;
    fill('variant', entry.variants.map((v, i) => ({ value: String(i), label: v.label })));
    fill('action', [{ value: 'auto', label: '自动 · 完整动作巡演' }, ...actionsFor(entry).map(a => ({ value: a, label: actionLabel(entry, a) }))]);
    select('zoom').value = entry.family.portfolio === 'jia' ? '5' : '2';
    const form = inspectorForm(entry, select('coverage').value as CoverageId);
    for (const slot of ['motion', 'sense', 'rhythm'] as const)
        fill(slot, entry.family[slot].map(id => ({ value: id, label: LEXEME_DATA[id]?.displayToken ?? id })), form.lexemes[slot]);
    const names = { monolith: '整块', shards: '碎裂', colony: '菌落', field: '场' };
    fill('continuity', PORTFOLIO_DATA[entry.family.portfolio].legalContinuities.filter(c => SUBSTRATE_DATA[entry.family.substrate]!.legalContinuities.includes(c)).map(c => ({ value: c, label: names[c] })));
    el('facing').toggleAttribute('disabled', entry.family.portfolio === 'bing' || entry.family.portfolio === 'ding');
}
populate();
if (entry.variants[Number(query.get('variant'))])
    select('variant').value = String(Number(query.get('variant')));
function selection() {
    const form = inspectorForm(entry, select('coverage').value as CoverageId);
    return { entry, form: { ...form, continuity: select('continuity').value as typeof form.continuity, lexemes: { ...form.lexemes, motion: select('motion').value, sense: select('sense').value, rhythm: select('rhythm').value } }, seed: entry.variants[Number(select('variant').value)]!.seed, fragmentTypeId: select('fragment').value };
}
class InspectorBoot extends Phaser.Scene {
    constructor() { super('InspectorBoot'); }
    preload() { for (const asset of AUDIO_ASSETS)
        this.load.audio(asset.key, audioUrlsFor(asset)); }
    create() { generatePlaceholderTextures(this); audioManager.bind(this.game); ready = true; this.scene.stop(); restartMode(); }
}
const game = new Phaser.Game(gameConfigWithScenes([InspectorBoot, EnemyInspectorPreview, EnemyInspectorArena, EnemyInspectorContext]));
const preview = () => game.scene.getScene('EnemyInspectorPreview') as EnemyInspectorPreview;
const arena = () => game.scene.getScene('EnemyInspectorArena') as EnemyInspectorArena;
function restartMode(): void {
    if (!ready)
        return;
    const oldMotion = select('motion').value;
    fill('motion', motionChoicesFor(entry.family.substrate, entry.family.portfolio, select('coverage').value as CoverageId).map(id => ({ value: id, label: LEXEME_DATA[id]!.displayToken })), oldMotion);
    const config = selection();
    const params = new URLSearchParams({ enemy: entry.id, variant: select('variant').value, coverage: config.form.coverage, fragment: config.fragmentTypeId, mode });
    history.replaceState(null, '', `${location.pathname}?${params}`);
    el('sample-meta').textContent = `${entry.variants.length} 主形 · 3 档污染 · seed ${config.seed}`;
    game.scene.stop('EnemyInspectorPreview');
    game.scene.stop('EnemyInspectorArena');
    game.scene.stop('EnemyInspectorContext');
    el('preview-mode').setAttribute('aria-pressed', String(mode === 'preview'));
    el('arena-mode').setAttribute('aria-pressed', String(mode === 'arena'));
    el('context-mode').setAttribute('aria-pressed', String(mode === 'context'));
    el('transport').hidden = mode !== 'preview';
    el('preview-controls').hidden = mode !== 'preview';
    el('arena-controls').hidden = mode !== 'arena';
    el('mode-hint').textContent = mode === 'arena' ? '实战使用同一模型种子、真实 AI、碰撞和战斗。保护只免伤；宿主是否可杀由生产规则决定。' : entry.family.portfolio === 'jia' ? '自动巡演依次展示该身体支持的动作。选单个动作可循环、慢放、逐帧或拖动时间轴；右下角是 1× 像素参照。受击与消亡请切换实战观察。' : '环境宿主使用正式渲染器。这里展示循环与可预览信号；接触伤害、感知、休眠与消亡规则在实战中观察。';
    if (mode === 'preview') {
        preview().events.once(Phaser.Scenes.Events.CREATE, () => { preview().setAction(select('action').value as ReviewAction | 'auto'); preview().setFacing(select('facing').value as FormVisualPose['facing4']); preview().setSpeed(Number(select('speed').value)); preview().setZoom(Number(select('zoom').value)); });
        game.scene.start('EnemyInspectorPreview', config);
    }
    else if(mode==='context'){
        el('mode-hint').textContent='六种生物与所选环境样本使用正式裂隙地面、生产模型和玩家比例。这里用于风格对照，样本席位不是关卡部署；危险与交互请切实战。';
        el('phase-label').textContent='同场景对照 · 活动姿态 · 同一污染档';
        game.scene.start('EnemyInspectorContext',config);
    }
    else {
        arena().events.once(Phaser.Scenes.Events.CREATE, () => { arena().setProtected(el<HTMLInputElement>('protected').checked); arena().setZoom(Number(select('arena-zoom').value)); });
        game.scene.start('EnemyInspectorArena', config);
    }
}
for (const id of ['variant', 'coverage', 'fragment', 'motion', 'sense', 'rhythm', 'continuity'])
    select(id).addEventListener('change', restartMode);
el('preview-mode').onclick = () => { mode = 'preview'; restartMode(); };
el('context-mode').onclick=()=>{mode='context';restartMode();};
el('arena-mode').onclick = () => { mode = 'arena'; restartMode(); audioManager.unlock(); };
select('action').onchange = () => { if (ready)
    preview().setAction(select('action').value as ReviewAction | 'auto'); };
select('facing').onchange = () => { if (ready)
    preview().setFacing(select('facing').value as FormVisualPose['facing4']); };
select('speed').onchange = () => { if (ready)
    preview().setSpeed(Number(select('speed').value)); };
select('zoom').onchange = () => { if (ready)
    preview().setZoom(Number(select('zoom').value)); };
el('play').onclick = () => { if (ready)
    preview().togglePlay(); };
el('previous-frame').onclick = () => { if (ready)
    preview().step(-1); };
el('next-frame').onclick = () => { if (ready)
    preview().step(1); };
el<HTMLInputElement>('timeline').oninput = () => { if (ready) preview().seek(Number(el<HTMLInputElement>('timeline').value) / 1000); };
el('approach').onclick = () => { el('game-container').focus(); arena().approach(); };
// Focus first: the arena cancels held review keys on focus changes. Focusing
// after approachMelee would cancel its genuine input turn before the first frame.
el('melee').onclick = () => { el('game-container').focus(); arena().approachMelee(); };
select('arena-zoom').onchange = () => arena().setZoom(Number(select('arena-zoom').value));
el('hit').onclick = () => arena().hitSample();
el('kill').onclick = () => arena().killSample();
el('restart').onclick = restartMode;
el('protected').onchange = () => { arena().setProtected(el<HTMLInputElement>('protected').checked); arena().setZoom(Number(select('arena-zoom').value)); };
const update = setInterval(() => {
    if (!ready)
        return;
    if (mode === 'preview' && game.scene.isActive('EnemyInspectorPreview')) {
        const state = preview().getReviewState();
        el('phase-label').textContent = `${state.label} · ${state.speed}×${state.auto ? ' · 自动巡演' : ''}`;
        el('play').textContent = state.playing ? '暂停' : '播放';
        el<HTMLInputElement>('timeline').value = String(Math.round(state.progress * 1000));
        el('progress').textContent = `${Math.round(state.progress * 100)}%`;
    }
    else if (mode === 'arena' && game.scene.isActive('EnemyInspectorArena')) {
        const state = arena().getReviewState();
        el('phase-label').textContent = '实战观察 · 原速';
        el('live-state').textContent = JSON.stringify(state, null, 2);
        const labels: Record<string, string> = { idle: '静息', patrol: '巡逻', chase: '追逐', alert: '警觉', suspicious: '怀疑', return: '返回', dead: '已消亡', active: '活动', rest: '休眠', waking: '苏醒', windup: '前摇', strike: '出手', recover: '收势', awake: '苏醒', inflated: '蓄势' };
        const phaseText = state.volume
            ? `${volumePhaseLabel(state.volume.substrate, state.volume.phase)} ${Math.round(state.volume.progress * 100)}%`
            : `攻击：${labels[state.attack?.phase ?? 'idle']}`;
        el('live-summary').textContent = `${labels[state.state] ?? state.state} · ${labels[state.activity?.phase ?? ''] ?? ''} · ${phaseText} · 混乱 ${state.chaos.toFixed(1)} · 玩家生命 ${state.health}/${state.maxHealth} · 活核 ${state.nuclei}`;
        el<HTMLButtonElement>('kill').disabled = !state.canDirectKill;
        el('hit').textContent = state.canDirectHit ? '受击样本' : '挥击（需近核）';
    }
}, 100);
window.addEventListener('error', event => { el('error').textContent = `检视室错误：${event.message}`; });
window.addEventListener('pagehide', event => {
    if (event.persisted) return; // A cached page resumes its scene and controls on Back.
    clearInterval(update);
    game.destroy(true);
});
