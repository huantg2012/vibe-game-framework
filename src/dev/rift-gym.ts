/** Map inspection is a DEV overlay; playable scenes retain native vision and rules. */
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import type { WorldProductionMap } from '@/generation/world-study/production-map';
import { TileType, type Vector2 } from '@/types/game-types';
import { RIFT_GYM_COMBINATIONS, hydrateRiftGymMap, readRiftGymSelection, riftGymCombination,
  riftGymQuery, type RiftGymSelection } from './rift-gym-model';
import { createRiftGymRuntime, type RiftGymRuntimeState } from './rift-gym-runtime';
import type { RiftGymWorkerResult } from './rift-gym-worker';

if (!import.meta.env.DEV) document.body.textContent = '此练习场仅在开发服务器开放。';
else initialize();

function initialize(): void {
  const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
  const button = (id: string): HTMLButtonElement => el(id);
  const world = el<HTMLSelectElement>('world'), space = el<HTMLSelectElement>('space'), program = el<HTMLSelectElement>('program');
  const seed = el<HTMLInputElement>('seed'), loadout = el<HTMLSelectElement>('loadout');
  const canvas = el<HTMLCanvasElement>('map'), ctx = canvas.getContext('2d')!;
  const terrain = document.createElement('canvas'), terrainContext = terrain.getContext('2d')!;
  const objects = el<HTMLInputElement>('objects'), routes = el<HTMLInputElement>('routes'), support = el<HTMLInputElement>('support');
  const catalog = el('catalog'), status = el('status'), waiting = el('waiting'), error = el('error');
  let selection: RiftGymSelection = readRiftGymSelection(new URLSearchParams());
  let map: WorldProductionMap | null = null, mapSelection: RiftGymSelection | null = null;
  let worker: Worker | null = null, request = 0, busy = false, playing = false, ready = false;
  let tour = false, tourIndex = 0, tourSeed = 0, tourTimer: ReturnType<typeof setTimeout> | undefined;
  let generationStarted = 0, elapsed = 0, view = { x: 0, y: 0, scale: 1 }, fitted = true;
  let pointer: { x: number; y: number } | null = null;
  const results = new Map<string, { status: 'passed' | 'failed'; effectiveSeed?: number; error?: string }>();
  const markers: { x: number; y: number; label: string }[] = [];
  const visitKey = (s: RiftGymSelection): string => `${riftGymCombination(s).key}:${s.seed}`;
  const comboButtons = RIFT_GYM_COMBINATIONS.map((combo, index) => {
    const item = document.createElement('button'); item.type = 'button';
    item.textContent = `${String(index + 1).padStart(2, '0')}  ${combo.worldLabel} / ${combo.spaceLabel} / ${combo.programLabel}`;
    item.title = `${combo.world} / ${combo.space} / ${combo.program}`;
    item.onclick = () => selectIndex(index); catalog.append(item); return item;
  });
  el('catalog-count').textContent = `${RIFT_GYM_COMBINATIONS.length} 组`;
  for (const build of BUILD_LAB_LOADOUTS) loadout.add(new Option(build.name, build.id));
  function fill(control: HTMLSelectElement, pairs: readonly (readonly [string, string])[], value: string): void {
    control.replaceChildren();
    for (const [id, label] of new Map(pairs)) control.add(new Option(label, id));
    control.value = value;
  }
  function syncControls(): void {
    fill(world, RIFT_GYM_COMBINATIONS.map(c => [c.world, c.worldLabel]), selection.world);
    const inWorld = RIFT_GYM_COMBINATIONS.filter(c => c.world === selection.world);
    fill(space, inWorld.map(c => [c.space, c.spaceLabel]), selection.space);
    fill(program, inWorld.filter(c => c.space === selection.space).map(c => [c.program, c.programLabel]), selection.program);
    seed.value = String(selection.seed);
    const active = riftGymCombination(selection);
    el('ordinal').textContent = `${RIFT_GYM_COMBINATIONS.indexOf(active) + 1} / ${RIFT_GYM_COMBINATIONS.length}`;
    comboButtons.forEach((item, i) => {
      const combo = RIFT_GYM_COMBINATIONS[i]!;
      item.setAttribute('aria-current', String(combo.key === active.key));
      const result = results.get(`${combo.key}:${selection.seed}`);
      item.dataset.result = result?.status ?? 'unchecked';
      item.textContent = `${result?.status === 'passed' ? '●' : result ? '×' : '·'} ${String(i + 1).padStart(2, '0')}  ${combo.worldLabel} / ${combo.spaceLabel} / ${combo.programLabel}`;
    });
  }
  function showError(reason: unknown): void {
    error.textContent = reason instanceof Error ? reason.message : String(reason); error.hidden = false;
  }
  function clearError(): void { error.hidden = true; error.textContent = ''; }
  function updateButtons(): void {
    button('play').disabled = !ready || !map || busy;
    button('play').textContent = playing ? '重开这张地图' : '进入这张地图';
    button('pause').disabled = !playing;
    button('return').disabled = !playing;
    button('export').disabled = !map || busy;
    button('copy').disabled = busy || !mapSelection;
  }
  function showOverview(): void {
    playing = false; document.body.classList.remove('playing');
    el('game-container').classList.add('concealed'); el('mode').textContent = 'FULL MAP / 全图检查';
    updateButtons(); draw();
  }
  function renderRuntime(state: RiftGymRuntimeState): void {
    ready = state.ready;
    if (playing) {
      status.textContent = state.starting ? '正在装载原生场景…' : state.paused ? '试玩已暂停；点击「暂停 / 继续」或 Esc 返回。'
        : state.probe?.ended ? '本趟已结束；R 返回全图，或重开这张地图。' : '原生试玩 · 实际视野、碰撞、敌人、翻找与撤离规则';
      el('diagnostic-text').textContent = JSON.stringify({ generation: map?.metadata, runtime: state }, null, 2);
    }
    updateButtons();
  }
  const runtime = createRiftGymRuntime({
    onReady: () => { ready = true; updateButtons(); }, onState: renderRuntime,
    onReturn: () => { showOverview(); describeMap(); },
    onError: reason => { showOverview(); showError(reason); status.textContent = '试玩启动失败；生成记录保留。'; },
  });
  function stopTour(): void {
    tour = false; clearTimeout(tourTimer); button('tour').textContent = '以当前种子巡检全部组合';
  }
  function terminateGeneration(): void { worker?.terminate(); worker = null; request++; busy = false; waiting.hidden = true; }
  function readSeed(): number {
    if (!/^\d+$/.test(seed.value.trim()) || Number(seed.value) > 0xffffffff) throw new Error('种子须为 0–4294967295 的整数。');
    return Number(seed.value);
  }
  function selectIndex(index: number): void {
    try {
      const nextSeed = readSeed(); stopTour();
      const c = RIFT_GYM_COMBINATIONS[(index + RIFT_GYM_COMBINATIONS.length) % RIFT_GYM_COMBINATIONS.length]!;
      selection = { world: c.world, space: c.space, program: c.program, seed: nextSeed }; generate();
    } catch (reason) { showError(reason); }
  }
  function continueTour(): void {
    if (!tour) return;
    const tested = RIFT_GYM_COMBINATIONS.slice(0, tourIndex + 1).map(c => results.get(`${c.key}:${tourSeed}`));
    el('tour-status').textContent = `${tourIndex + 1} / ${RIFT_GYM_COMBINATIONS.length} 已检查 · ${tested.filter(r => r?.status === 'failed').length} 组拒绝`;
    tourIndex++;
    if (tourIndex >= RIFT_GYM_COMBINATIONS.length) { stopTour(); return; }
    tourTimer = setTimeout(() => {
      if (!tour) return;
      const c = RIFT_GYM_COMBINATIONS[tourIndex]!;
      selection = { world: c.world, space: c.space, program: c.program, seed: tourSeed }; generate();
    }, 700);
  }
  function describeMap(): void {
    if (!map || !mapSelection) return;
    const m = map.metadata, c = riftGymCombination(mapSelection), layout = map.layout;
    el('map-title').textContent = `${c.worldLabel} / ${c.spaceLabel} / ${c.programLabel}`;
    status.textContent = `已生成 · 请求 ${m.requestedSeed} → 实际 ${m.effectiveSeed}${m.fallbackUsed ? ' · 使用正式后备种子' : ''}`;
    el('metrics').textContent = `${terrain.width} × ${terrain.height} px · ${layout.kindlingNodes.length} 薪柴 / ${layout.contaminantNodes.length} 污染物 / ${layout.enemySpawns.length} 地面敌人 · ${m.rejected.length} 次拒绝 · ${(elapsed / 1000).toFixed(1)}s`;
    el('diagnostic-text').textContent = JSON.stringify(m, null, 2);
  }
  function generate(): void {
    runtime.stop(); showOverview(); terminateGeneration(); clearError();
    map = null; mapSelection = null; markers.length = 0; busy = true; syncControls();
    history.replaceState(null, '', `?${riftGymQuery(selection)}`);
    const c = riftGymCombination(selection);
    el('map-title').textContent = `${c.worldLabel} / ${c.spaceLabel} / ${c.programLabel}`;
    waiting.hidden = false; waiting.textContent = '生成地形、投放与地表…'; status.textContent = '后台生成中；切换组合可取消当前请求。';
    el('metrics').textContent = ''; el('point-info').hidden = true; el('diagnostic-text').textContent = '';
    updateButtons(); generationStarted = performance.now();
    const id = ++request;
    worker = new Worker(new URL('./rift-gym-worker.ts', import.meta.url), { type: 'module' });
    const finishError = (message: string): void => {
      busy = false; waiting.hidden = false; waiting.textContent = '此组合 / 种子生成失败';
      results.set(visitKey(selection), { status: 'failed', error: message });
      showError(message); status.textContent = '拒绝原因已保留；可切换种子或其他组合。'; syncControls(); updateButtons(); continueTour();
    };
    worker.onerror = event => { if (id === request) finishError(event.message); };
    worker.onmessage = ({ data }: MessageEvent<RiftGymWorkerResult>) => {
      if (data.id !== request) return;
      if ('error' in data) { finishError(data.error); return; }
      try {
        map = hydrateRiftGymMap(data.map); mapSelection = data.selection;
        terrain.width = data.pixels.width; terrain.height = data.pixels.height;
        terrainContext.putImageData(new ImageData(new Uint8ClampedArray(data.pixels.rgba), terrain.width, terrain.height), 0, 0);
        elapsed = performance.now() - generationStarted; busy = false; waiting.hidden = true;
        results.set(visitKey(selection), { status: 'passed', effectiveSeed: map.metadata.effectiveSeed });
        syncControls(); updateButtons(); describeMap(); fit(); continueTour();
      } catch (reason) { finishError(String(reason)); }
    };
    worker.postMessage({ id, selection });
  }
  function fit(): void {
    if (!map) return;
    view.scale = Math.min((canvas.width - 54) / terrain.width, (canvas.height - 32) / terrain.height);
    view.x = (canvas.width - terrain.width * view.scale) / 2; view.y = (canvas.height - terrain.height * view.scale) / 2;
    fitted = true; draw();
  }
  function zoom(factor: number, x = canvas.width / 2, y = canvas.height / 2): void {
    const scale = Math.max(.15, Math.min(6, view.scale * factor)), ratio = scale / view.scale;
    view.x = x - (x - view.x) * ratio; view.y = y - (y - view.y) * ratio; view.scale = scale; fitted = false; draw();
  }
  function line(points: readonly Vector2[], color: string, dashed = false): void {
    if (!points.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5 / view.scale; ctx.setLineDash(dashed ? [5 / view.scale, 5 / view.scale] : []);
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
  }
  function marker(p: Vector2, label: string, color: string, glyph: string): void {
    markers.push({ ...p, label });
    ctx.fillStyle = '#07100ee0'; ctx.beginPath(); ctx.arc(p.x, p.y, 9 / view.scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.font = `${13 / view.scale}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, p.x, p.y);
  }
  function draw(): void {
    ctx.fillStyle = '#030606'; ctx.fillRect(0, 0, canvas.width, canvas.height); markers.length = 0;
    if (!map) return;
    ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale); ctx.imageSmoothingEnabled = false; ctx.drawImage(terrain, 0, 0);
    const layout = map.layout, tile = layout.tileMap.tileSize, host = map.hostTileMap.tileSize;
    if (support.checked) {
      ctx.fillStyle = '#7bb6a340';
      layout.tileMap.tiles.forEach((row, y) => row.forEach((v, x) => { if (v === TileType.FLOOR) ctx.fillRect(x * tile, y * tile, tile, tile); }));
    }
    if (routes.checked) {
      const semantic = map.metadata.semantic;
      if (semantic) { line(semantic.shortRoute.points, '#b4bab090', true); line(semantic.lowExposureRoute.points, '#7dbbabcc'); }
      for (const enemy of layout.enemySpawns) line(enemy.patrol.waypoints.map(p => ({ x: (p.col + .5) * tile, y: (p.row + .5) * tile })), '#d4817380', true);
    }
    if (objects.checked) {
      ctx.strokeStyle = '#799e83'; ctx.fillStyle = '#799e8320'; ctx.lineWidth = 1 / view.scale;
      for (const pin of layout.contaminationPins.paintFloors) {
        ctx.strokeRect(pin.floorCol * host, pin.floorRow * host, host, host);
        markers.push({ x: (pin.floorCol + .5) * host, y: (pin.floorRow + .5) * host, label: '占漆宿主锚点\n方框为锚格，实际蔓延形体见试玩' });
      }
      for (const pin of layout.contaminationPins.corridorAabbs) {
        ctx.fillRect(pin.minCol * host, pin.minRow * host, (pin.maxCol - pin.minCol + 1) * host, (pin.maxRow - pin.minRow + 1) * host);
        ctx.strokeRect(pin.minCol * host, pin.minRow * host, (pin.maxCol - pin.minCol + 1) * host, (pin.maxRow - pin.minRow + 1) * host);
        markers.push({ x: (pin.coreCol + .5) * host, y: (pin.coreRow + .5) * host, label: '占空宿主区域\n框为部署区域；形态与伤害时序见试玩' });
      }
      for (const e of layout.enemySpawns) marker({ x: (e.spawn.col + .5) * tile, y: (e.spawn.row + .5) * tile }, `${e.id}\n${e.form?.substrate ?? e.type} / ${e.patrol.mode}`, '#d48173', '▲');
      for (const node of layout.kindlingNodes) marker(node.position, `${node.id} / 薪柴\n收益档：${node.tier}`, '#cdb478', '■');
      for (const node of layout.contaminantNodes) marker(node.position, `${node.id} / 污染物\n收益档：${node.tier ?? '未分档'}`, '#bd94d0', '◇');
      marker(layout.spawnPoint, '出生点', '#d4d9cc', '●'); marker(layout.extractionPoint.position, '撤离点', '#81c7d1', '◆');
    }
    ctx.restore();
  }
  const resize = new ResizeObserver(() => {
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
    if (fitted) fit(); else draw();
  }); resize.observe(canvas);
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(-event.deltaY * .0015), event.offsetX, event.offsetY); }, { passive: false });
  canvas.onpointerdown = event => { pointer = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); };
  canvas.onpointerup = canvas.onpointercancel = () => { pointer = null; };
  canvas.onpointermove = event => {
    if (pointer) { view.x += event.clientX - pointer.x; view.y += event.clientY - pointer.y; pointer = { x: event.clientX, y: event.clientY }; fitted = false; draw(); }
    const point = { x: (event.offsetX - view.x) / view.scale, y: (event.offsetY - view.y) / view.scale };
    const closest = markers.reduce<{ x: number; y: number; label: string } | undefined>((best, m) =>
      Math.hypot(m.x - point.x, m.y - point.y) < Math.min(16 / view.scale, best ? Math.hypot(best.x - point.x, best.y - point.y) : Infinity) ? m : best, undefined);
    el('point-info').hidden = !closest; if (closest) el('point-info').textContent = `${closest.label}\n位置 ${Math.round(closest.x)}, ${Math.round(closest.y)}`;
  };
  canvas.onpointerleave = () => { el('point-info').hidden = true; };
  for (const control of [objects, routes, support]) control.onchange = draw;
  for (const control of [world, space, program]) control.onchange = () => {
    try {
      const requested = new URLSearchParams({ world: world.value, seed: String(readSeed()) });
      if (control !== world) requested.set('space', space.value);
      if (control === program) requested.set('program', program.value);
      else if (RIFT_GYM_COMBINATIONS.some(c => c.world === world.value && (control === world || c.space === space.value) && c.program === program.value)) requested.set('program', program.value);
      selection = readRiftGymSelection(requested); stopTour(); generate();
    } catch (reason) {
      const typedSeed = seed.value;
      syncControls(); seed.value = typedSeed; showError(reason);
    }
  };
  button('previous').onclick = () => selectIndex(RIFT_GYM_COMBINATIONS.indexOf(riftGymCombination(selection)) - 1);
  button('next').onclick = () => selectIndex(RIFT_GYM_COMBINATIONS.indexOf(riftGymCombination(selection)) + 1);
  button('generate').onclick = () => { try { selection = { ...selection, seed: readSeed() }; stopTour(); generate(); } catch (reason) { showError(reason); } };
  seed.onkeydown = event => { if (event.key === 'Enter') button('generate').click(); };
  for (const [id, step] of [['seed-previous', -1], ['seed-next', 1]] as const) button(id).onclick = () => {
    try { seed.value = String((readSeed() + step + 0x100000000) % 0x100000000); button('generate').click(); } catch (reason) { showError(reason); }
  };
  button('random').onclick = () => { seed.value = String(crypto.getRandomValues(new Uint32Array(1))[0]); button('generate').click(); };
  button('tour').onclick = () => {
    if (tour) { stopTour(); terminateGeneration(); if (!map) { draw(); status.textContent = '巡检已停止；点生成继续检查当前组合。'; } updateButtons(); return; }
    try {
      tourSeed = readSeed(); tourIndex = 0; tour = true; button('tour').textContent = '停止巡检';
      const c = RIFT_GYM_COMBINATIONS[0]!; selection = { world: c.world, space: c.space, program: c.program, seed: tourSeed }; generate();
    } catch (reason) { stopTour(); showError(reason); }
  };
  button('fit').onclick = fit; button('zoom-in').onclick = () => zoom(1.3); button('zoom-out').onclick = () => zoom(1 / 1.3); button('pixel').onclick = () => zoom(1 / view.scale);
  button('play').onclick = () => {
    if (!map || busy) return;
    stopTour(); clearError(); playing = true; document.body.classList.add('playing'); el('game-container').classList.remove('concealed');
    el('point-info').hidden = true; el('mode').textContent = 'NATIVE PLAY / 正式规则试玩'; runtime.start(map, loadout.value); updateButtons();
  };
  button('return').onclick = () => { runtime.stop(); showOverview(); describeMap(); };
  button('pause').onclick = () => runtime.togglePause();
  el('configuration').addEventListener('focusin', event => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) runtime.pause(); });
  button('copy').onclick = async () => {
    if (!mapSelection) return;
    try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}?${riftGymQuery(mapSelection)}`); status.textContent = '当前地图链接已复制。'; }
    catch { status.textContent = '无法访问剪贴板；地址栏即为当前地图的链接。'; }
  };
  button('export').onclick = () => {
    if (!map || !mapSelection) return;
    const record = { selection: mapSelection, metadata: map.metadata, layout: { ...map.layout, walkableMask: undefined, ruins: undefined },
      recipe: { version: 2, conditions: map.metadata.conditions }, checked: Object.fromEntries(results), scope: 'DEV training; no production inventory or save' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `rift-${mapSelection.world}-${mapSelection.space}-${mapSelection.program}-${mapSelection.seed}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  window.addEventListener('pagehide', () => { stopTour(); terminateGeneration(); resize.disconnect(); runtime.destroy(); }, { once: true });
  Object.defineProperty(window, '__riftGym', { configurable: true, value: Object.freeze({ getState: () => ({ selection: { ...selection }, mapSelection,
    busy, playing, tour, combinationCount: RIFT_GYM_COMBINATIONS.length, results: Object.fromEntries(results), metadata: map?.metadata,
    runtime: runtime.getState(), error: error.hidden ? null : error.textContent }) }) });
  try { selection = readRiftGymSelection(new URLSearchParams(location.search)); syncControls(); generate(); }
  catch (reason) { syncControls(); waiting.hidden = true; status.textContent = '链接参数无效；请修改配置后生成。'; showError(reason); }
}
