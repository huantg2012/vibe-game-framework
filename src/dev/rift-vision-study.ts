/** A bounded visual study over the real Rift scene. Storage belongs to the gym's memory adapter. */
import { createR100ProductionRecipe } from '@/generation/world-study/r100-package';
import { RiftGenerationClient } from '@/generation/rift-generation-client';
import { hydrateRiftGeneration } from '@/generation/rift-generation-protocol';
import { prepareR100Presentation } from '@/systems/r100-world-presentation';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import { getAssimilationModulators } from '@/systems/assimilation-system';
import { createRiftGymRuntime, type RiftGymRuntimeState } from './rift-gym-runtime';

if (!import.meta.env.DEV) document.body.textContent = '此动态样片仅在开发服务器开放。';
else initialize();

function initialize(): void {
  const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
  const params = new URLSearchParams(location.search);
  const world = el<HTMLSelectElement>('world');
  const pollution = el<HTMLInputElement>('pollution'), assimilation = el<HTMLInputElement>('assimilation');
  const preview = { pollution: 70, assimilation: 0, presentation: 'perceptual' as 'legacy' | 'perceptual' };
  // Previously admitted medium-grade cases; a visual study does not search for new geometry.
  const seeds: Record<string, number> = { 'crystal-fibre': 156, 'cinder-ridge': 92, 'ruptured-film': 82 };
  if (params.get('world') && Object.prototype.hasOwnProperty.call(seeds, params.get('world')!)) world.value = params.get('world')!;
  const client = new RiftGenerationClient();
  let request: AbortController | null = null, revision = 0, ready = false, disposed = false;
  function syncValues(): void {
    preview.pollution = Number(pollution.value); preview.assimilation = Number(assimilation.value);
    el('p-value').textContent = `${preview.pollution}`;
    el('a-value').textContent = `${preview.assimilation}%`;
    document.querySelectorAll<HTMLButtonElement>('[data-p]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.p) === preview.pollution && Number(button.dataset.a) === preview.assimilation));
    });
  }
  function error(reason: unknown): void {
    el('error').hidden = false; el('error').textContent = String(reason);
    el('waiting').hidden = true;
  }
  function publish(state: RiftGymRuntimeState): void {
    if (!state.running) return;
    const scale = getAssimilationModulators(preview.pollution, preview.assimilation).radiusScale;
    el('pause').textContent = state.paused ? '继续画面' : '暂停画面';
    // Pausing freezes the rendered field too. Never imply that a changed slider
    // has already affected a frozen frame; resume before comparing another state.
    for (const input of document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.controls input,.controls button,.switch button')) {
      input.disabled = state.paused;
    }
    el('status').textContent = `${world.selectedOptions[0]?.text} · ${preview.presentation === 'perceptual' ? '新表现' : '当前正式表现'} · 视距 ${(scale * 100).toFixed(0)}%${state.paused ? ' · 已暂停' : state.probe?.ended ? ' · 本趟结束，请回到出生点' : ' · 动态运行中'}`;
  }
  const runtime = createRiftGymRuntime({
    onReady: () => { ready = true; void build(); }, onState: publish,
    onReturn: () => { el('status').textContent = '观察结束，可回到出生点重开。'; }, onError: error,
  });
  async function build(): Promise<void> {
    if (!ready || disposed) return;
    request?.abort(); request = new AbortController(); const signal = request.signal, current = ++revision;
    runtime.stop(); el('waiting').hidden = false; el('error').hidden = true;
    el('waiting').textContent = `准备${world.selectedOptions[0]?.text}…`;
    history.replaceState(null, '', `${location.pathname}?world=${world.value}`);
    try {
      const recipe = createR100ProductionRecipe(world.value, seeds[world.value]!, 'medium');
      const wire = await client.generate({ kind: 'departure', generation: recipe }, signal);
      if (current !== revision || signal.aborted) return;
      const result = hydrateRiftGeneration(wire);
      if (!result.world?.native) throw new Error('真实原生世界缺失；样片不能替换成独立布景。');
      await prepareR100Presentation(recipe, { signal, world: result.world });
      if (current !== revision || signal.aborted) return;
      runtime.start(result.world, BUILD_LAB_LOADOUTS[0]!.id, {
        productionRecipe: recipe, pollutionGrade: 'medium', assimilationMode: 'persistent-v1',
        readVisionPreview: () => preview,
      });
      el('waiting').hidden = true;
    } catch (reason) { if (!signal.aborted && current === revision) error(reason); }
  }
  function setMode(mode: 'legacy' | 'perceptual'): void {
    preview.presentation = mode;
    el('new').setAttribute('aria-pressed', String(mode === 'perceptual'));
    el('old').setAttribute('aria-pressed', String(mode === 'legacy'));
  }
  el('new').onclick = () => setMode('perceptual');
  el('old').onclick = () => setMode('legacy');
  el('pause').onclick = () => runtime.togglePause();
  el('restart').onclick = () => void build();
  world.onchange = () => void build();
  pollution.oninput = assimilation.oninput = syncValues;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-p]')) {
    button.onclick = () => { pollution.value = button.dataset.p!; assimilation.value = button.dataset.a!; syncValues(); };
  }
  syncValues();
  // Small, explicit automation surface: no private scene mutation or real storage access.
  const api = {
    snapshot: () => ({ world: world.value, preview: { ...preview }, state: runtime.getState() }),
    set: (p: number, a: number, mode: 'legacy' | 'perceptual' = 'perceptual') => {
      pollution.value = String(p); assimilation.value = String(a); syncValues(); setMode(mode);
    },
    pause: () => runtime.pause(), resume: () => { if (runtime.getState().paused) runtime.togglePause(); },
  };
  Object.assign(window, { __visionStudy: api });
  window.addEventListener('pagehide', () => { disposed = true; request?.abort(); delete (window as unknown as Record<string, unknown>).__visionStudy; }, { once: true });
}
