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
  const preview = { pollution: 0, assimilation: 0, presentation: 'light-eater' as Mode };
  const target = { pollution: 0, assimilation: 0 };
  // A continuous round trip, with still endpoints for comparison. No visual
  // modes are selected by these marks: every intermediate value is rendered.
  const path = [
    { ms: 0, p: 0, a: 0 }, { ms: 2000, p: 0, a: 0 },
    { ms: 18000, p: 100, a: 0 }, { ms: 21000, p: 100, a: 0 },
    { ms: 31000, p: 100, a: 80 }, { ms: 34000, p: 100, a: 80 },
    { ms: 44000, p: 100, a: 0 }, { ms: 60000, p: 0, a: 0 },
    { ms: 62000, p: 0, a: 0 },
  ];
  const client = new RiftGenerationClient();
  let request: AbortController | null = null, revision = 0, ready = false, disposed = false;
  let running = false, paused = false, automatic = false, cycleMs = 0;
  let previousTime = 0, frame = 0, readoutMs = 0;
  function values(): void {
    target.pollution = Number(pollution.value); target.assimilation = Number(assimilation.value);
    readouts();
  }
  function readouts(): void {
    el('p-value').textContent = `${Math.round(preview.pollution)}`;
    el('a-value').textContent = `${Math.round(preview.assimilation)}%`;
    document.querySelectorAll<HTMLButtonElement>('[data-p]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.p) === target.pollution && Number(button.dataset.a) === target.assimilation));
    });
    el('description').textContent = automatic
      ? '连续演示：污染渐满 → 同化扩距 → 原路回退。任意拖动滑杆可接管。'
      : '手动观察：读数为当前画面值；选定值平滑抵达，暂停可检查任意中间态。';
  }
  function set(p: number, a: number, mode: Mode = 'light-eater'): void {
    auto(false);
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
    el('auto').textContent = value ? '停止演示' : '连续演示';
    if (value) setMode('light-eater');
    readouts();
  }
  function tick(time: number): void {
    if (disposed) return;
    const dt = Math.min(80, Math.max(0, time - (previousTime || time))); previousTime = time;
    if (running && !paused && !document.hidden) {
      if (automatic) {
        cycleMs = (cycleMs + dt) % path[path.length - 1]!.ms;
        const index = path.findIndex(mark => mark.ms > cycleMs);
        const from = path[index - 1]!, to = path[index]!;
        const progress = (cycleMs - from.ms) / (to.ms - from.ms);
        const blend = progress * progress * (3 - 2 * progress);
        target.pollution = from.p + (to.p - from.p) * blend;
        target.assimilation = from.a + (to.a - from.a) * blend;
      }
      const blend = 1 - Math.exp(-dt / 400);
      preview.pollution += (target.pollution - preview.pollution) * blend;
      preview.assimilation += (target.assimilation - preview.assimilation) * blend;
      if (Math.abs(target.pollution - preview.pollution) < 0.03) preview.pollution = target.pollution;
      if (Math.abs(target.assimilation - preview.assimilation) < 0.03) preview.assimilation = target.assimilation;
      readoutMs += dt;
      if (readoutMs >= 100) {
        readoutMs = 0;
        if (automatic) { pollution.value = String(target.pollution); assimilation.value = String(target.assimilation); }
        readouts();
      }
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
  el('new').onclick = () => { auto(false); setMode('light-eater'); };
  el('old').onclick = () => { auto(false); setMode('legacy'); };
  el('auto').onclick = () => auto(!automatic);
  el('pause').onclick = () => runtime.togglePause();
  el('restart').onclick = () => void build(); world.onchange = () => void build();
  pollution.oninput = assimilation.oninput = () => { auto(false); values(); };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-p]')) button.onclick = () => { auto(false); set(Number(button.dataset.p), Number(button.dataset.a)); };
  values(); auto(true); frame = requestAnimationFrame(tick);
  const api = { snapshot: () => ({ world: world.value, preview: { ...preview }, target: { ...target }, automatic, cycleMs, state: runtime.getState() }),
    set, pause: () => runtime.pause(), resume: () => { if (runtime.getState().paused) runtime.togglePause(); }, auto };
  Object.assign(window, { __lightEaterStudy: api });
  window.addEventListener('pagehide', () => { disposed = true; cancelAnimationFrame(frame); request?.abort(); runtime.destroy(); delete (window as unknown as Record<string, unknown>).__lightEaterStudy; }, { once: true });
}
