/** Isolated art plate: actual Rift geometry/materials, memory-only save adapter. */
import { createR100ProductionRecipe } from '@/generation/world-study/r100-package';
import { RiftGenerationClient } from '@/generation/rift-generation-client';
import { hydrateRiftGeneration } from '@/generation/rift-generation-protocol';
import { prepareR100Presentation } from '@/systems/r100-world-presentation';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import { createRiftGymRuntime, type RiftGymRuntimeState } from './rift-gym-runtime';

type Mode = 'legacy' | 'light-eater';
if (!import.meta.env.DEV) document.body.textContent = '此美术样片仅在开发服务器开放。';
else initialize();

function initialize(): void {
  const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
  const world = el<HTMLSelectElement>('world');
  const pollution = el<HTMLInputElement>('pollution'), assimilation = el<HTMLInputElement>('assimilation');
  const params = new URLSearchParams(location.search);
  const seeds: Record<string, number> = { 'crystal-fibre': 156, 'cinder-ridge': 92, 'ruptured-film': 82 };
  if (Object.prototype.hasOwnProperty.call(seeds, params.get('world') ?? '')) world.value = params.get('world')!;
  const preview = { pollution: 55, assimilation: 0, presentation: 'light-eater' as Mode };
  const target = { pollution: 55, assimilation: 0 };
  const states = [{ p: 15, a: 0 }, { p: 55, a: 0 }, { p: 100, a: 0 }, { p: 100, a: 80 }];
  const client = new RiftGenerationClient();
  let request: AbortController | null = null, revision = 0, ready = false, disposed = false;
  let running = false, paused = false, automatic = false, cycleMs = 0, cycleIndex = 1;
  let previousTime = 0, frame = 0;
  function values(): void {
    target.pollution = Number(pollution.value); target.assimilation = Number(assimilation.value);
    el('p-value').textContent = `${target.pollution}`;
    el('a-value').textContent = `${target.assimilation}%`;
    document.querySelectorAll<HTMLButtonElement>('[data-p]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.p) === target.pollution && Number(button.dataset.a) === target.assimilation));
    });
    el('description').textContent = target.assimilation > 30 ? '光仍被吞噬。远处的材质开始留下另一种信号。'
      : target.pollution >= 80 ? '灯还亮着，黑暗却已逼近。' : target.pollution >= 35 ? '断续的侵蚀正在截断远处的光。' : '灯光尚能伸远，边缘已经开始变化。';
  }
  function set(p: number, a: number, mode: Mode = 'light-eater'): void {
    pollution.value = String(p); assimilation.value = String(a); values(); setMode(mode);
  }
  function setMode(mode: Mode): void {
    preview.presentation = mode;
    el('new').setAttribute('aria-pressed', String(mode === 'light-eater'));
    el('old').setAttribute('aria-pressed', String(mode === 'legacy'));
  }
  function auto(value: boolean): void {
    automatic = value; cycleMs = 0;
    el('auto').setAttribute('aria-pressed', String(value));
    el('auto').textContent = value ? '停止轮播' : '四态轮播';
  }
  function tick(time: number): void {
    if (disposed) return;
    const dt = Math.min(80, Math.max(0, time - (previousTime || time))); previousTime = time;
    if (running && !paused && !document.hidden) {
      if (automatic) {
        cycleMs += dt;
        if (cycleMs >= 6500) { cycleMs = 0; cycleIndex = (cycleIndex + 1) % states.length; const state = states[cycleIndex]!; set(state.p, state.a); }
      }
      const blend = 1 - Math.exp(-dt / 400);
      preview.pollution += (target.pollution - preview.pollution) * blend;
      preview.assimilation += (target.assimilation - preview.assimilation) * blend;
      if (Math.abs(target.pollution - preview.pollution) < 0.03) preview.pollution = target.pollution;
      if (Math.abs(target.assimilation - preview.assimilation) < 0.03) preview.assimilation = target.assimilation;
    }
    frame = requestAnimationFrame(tick);
  }
  function error(reason: unknown): void { el('error').hidden = false; el('error').textContent = String(reason); el('waiting').hidden = true; }
  function publish(state: RiftGymRuntimeState): void {
    running = state.running; paused = state.paused;
    el('pause').textContent = paused ? '继续画面' : '暂停画面';
    for (const input of document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.controls input,.controls button,.switch button')) input.disabled = paused || !running;
    el('status').textContent = `${world.selectedOptions[0]?.text} · ${preview.presentation === 'light-eater' ? '吞光打版' : '正式旧版对照'} · ${paused ? '已暂停' : state.running ? '动态运行中' : '准备场景'}`;
  }
  const runtime = createRiftGymRuntime({ onReady: () => { ready = true; void build(); }, onState: publish,
    onReturn: () => { el('status').textContent = '已离开观察场景，可重新载入。'; }, onError: error });
  async function build(): Promise<void> {
    if (!ready || disposed) return;
    request?.abort(); request = new AbortController(); const signal = request.signal, current = ++revision;
    runtime.stop(); running = false; el('waiting').hidden = false; el('error').hidden = true;
    el('waiting').textContent = `准备${world.selectedOptions[0]?.text}…`;
    history.replaceState(null, '', `${location.pathname}?world=${world.value}`);
    try {
      const recipe = createR100ProductionRecipe(world.value, seeds[world.value]!, 'medium');
      const wire = await client.generate({ kind: 'departure', generation: recipe }, signal);
      if (current !== revision || signal.aborted) return;
      const result = hydrateRiftGeneration(wire);
      if (!result.world?.native) throw new Error('原生世界缺失，样片不能以独立布景代替。');
      await prepareR100Presentation(recipe, { signal, world: result.world });
      if (current !== revision || signal.aborted) return;
      runtime.start(result.world, BUILD_LAB_LOADOUTS[0]!.id, {
        productionRecipe: recipe, pollutionGrade: 'medium', assimilationMode: 'persistent-v1', visionArtStudy: true,
        readVisionPreview: () => preview,
      });
      el('waiting').hidden = true;
    } catch (reason) { if (!signal.aborted && current === revision) error(reason); }
  }
  el('new').onclick = () => setMode('light-eater'); el('old').onclick = () => setMode('legacy');
  el('auto').onclick = () => auto(!automatic);
  el('pause').onclick = () => runtime.togglePause();
  el('restart').onclick = () => void build(); world.onchange = () => void build();
  pollution.oninput = assimilation.oninput = () => { auto(false); values(); };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-p]')) button.onclick = () => { auto(false); set(Number(button.dataset.p), Number(button.dataset.a)); };
  values(); frame = requestAnimationFrame(tick);
  const api = { snapshot: () => ({ world: world.value, preview: { ...preview }, target: { ...target }, automatic, state: runtime.getState() }),
    set, pause: () => runtime.pause(), resume: () => { if (runtime.getState().paused) runtime.togglePause(); }, auto };
  Object.assign(window, { __lightEaterStudy: api });
  window.addEventListener('pagehide', () => { disposed = true; cancelAnimationFrame(frame); request?.abort(); runtime.destroy(); delete (window as unknown as Record<string, unknown>).__lightEaterStudy; }, { once: true });
}
