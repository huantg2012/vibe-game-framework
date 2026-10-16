import { prepareLastLightPlayerAssets } from '@/entities/player-last-light-presentation';
/** Catalog inspection uses the formal v3 worker and RiftScene in memory storage. */
import { R100_NATIVE_WORLDS } from '@/generated/r100-native-worlds';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import { createR100ProductionRecipe, createR100NativeSpatialDevelopmentRecipe } from '@/generation/world-study/r100-package';
import { NATIVE_SPATIAL_WORLDS } from '@/generated/r100-native-spatial';
import { isPollutionGrade, POLLUTION_GRADES } from '@/generation/world-study/pollution-grade';
import { RiftGenerationClient } from '@/generation/rift-generation-client';
import { hydrateRiftGeneration } from '@/generation/rift-generation-protocol';
import { prepareR100Presentation } from '@/systems/r100-world-presentation';
import type { WorldProductionMap } from '@/generation/world-study/production-map';
import type { WorldProductionRecipeV3 } from '@/generation/world-study/production-recipe';
import { createRiftGymRuntime, type RiftGymRuntimeState } from './rift-gym-runtime';
import { TileType } from '@/types/game-types';

if (!import.meta.env.DEV) document.body.textContent = '此巡览仅在开发服务器开放。';
else initialize();

function initialize(): void {
  const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
  const params = new URLSearchParams(location.search);
  const nativeDevelopment = params.get('nativeSpatial') === '1';
  const playerModelA = params.get('playerModel') === 'a';
  const createRecipe = nativeDevelopment ? createR100NativeSpatialDevelopmentRecipe : createR100ProductionRecipe;
  const worlds = nativeDevelopment ? R100_NATIVE_WORLDS.filter(world => NATIVE_SPATIAL_WORLDS.some(intent => intent.worldId === world.id && intent.enabled && intent.annotationStatus === 'reviewed')) : R100_NATIVE_WORLDS;
  const world = el<HTMLSelectElement>('world'), grade = el<HTMLSelectElement>('grade');
  const seed = el<HTMLInputElement>('seed'), loadout = el<HTMLSelectElement>('loadout');
  const client = new RiftGenerationClient();
  let map: WorldProductionMap | null = null, recipe: WorldProductionRecipeV3 | null = null;
  let request: AbortController | null = null, revision = 0, scan = false, overview = false;
  let generatedMs = 0, ready = false;
  for (const entry of worlds) world.add(new Option(`${entry.label}${entry.enabled ? '' : ' · 待审'}`, entry.id));
  for (const entry of BUILD_LAB_LOADOUTS) loadout.add(new Option(entry.name, entry.id));
  if (worlds.some(entry => entry.id === params.get('world'))) world.value = params.get('world')!;
  if (isPollutionGrade(params.get('grade'))) grade.value = params.get('grade')!;
  if (/^\d+$/.test(params.get('seed') ?? '')) seed.value = params.get('seed')!;
  if (BUILD_LAB_LOADOUTS.some(entry => entry.id === params.get('loadout'))) loadout.value = params.get('loadout')!;
  const catalog = el('catalog');
  const catalogButtons = worlds.map((entry, index) => {
    const button = document.createElement('button'); button.textContent = `${String(index + 1).padStart(2, '0')}　${entry.label}`;
    button.dataset.world = entry.id; button.onclick = () => { world.value = entry.id; void build(); };
    catalog.append(button); return button;
  });
  el('catalog-count').textContent = `${nativeDevelopment ? 'DEV r12 · ' : ''}${worlds.length} 世界 / ${worlds.length * 3} 档`;
  function error(reason: unknown): void { el('error').hidden = false; el('error').textContent = String(reason); el('waiting').hidden = true; }
  function publish(state: RiftGymRuntimeState): void {
    el<HTMLButtonElement>('pause').disabled = !state.running;
    if (state.running) el('status').textContent = state.paused ? '暂停 · Esc 继续' : state.probe?.ended ? '本趟结束 · 可重开或查看其他世界' : '正常视野 · 当前世界内存试玩';
    el('diagnostics').textContent = JSON.stringify({ recipe, metadata: map?.metadata, runtime: state }, null, 2);
  }
  const runtime = createRiftGymRuntime({ onReady: () => { ready = true; void build(); }, onState: publish, onReturn: () => { overview = true; syncView(); }, onError: error });
  function query(): string { return new URLSearchParams({ world: world.value, grade: grade.value, seed: seed.value, loadout: loadout.value, ...(nativeDevelopment ? { nativeSpatial: '1' } : {}), ...(playerModelA ? { playerModel: 'a' } : {}) }).toString(); }
  function readRecipe(): WorldProductionRecipeV3 {
    if (!/^\d+$/.test(seed.value) || Number(seed.value) > 0xffffffff || !isPollutionGrade(grade.value)) throw new Error('种子或污染等级不合法。');
    return createRecipe(world.value, Number(seed.value), grade.value);
  }
  function stopScan(): void { scan = false; el('scan').textContent = '巡检全部世界 × 三级'; }
  function syncView(): void {
    el('game-container').classList.toggle('concealed', overview);
    el('map').hidden = !overview;
    el('mode').textContent = overview ? 'GEOMETRY / 地形诊断，非美术画面' : 'NORMAL PLAY / 正常游玩';
    el('overview').textContent = overview ? '返回实景' : '地形诊断';
    if (overview) { runtime.pause(); drawMap(); }
    else { if (runtime.getState().paused) runtime.togglePause(); el('game-container').focus({ preventScroll: true }); }
  }
  function drawMap(): void {
    if (!map) return;
    const canvas = el<HTMLCanvasElement>('map'), ctx = canvas.getContext('2d')!;
    const grid = map.layout.tileMap;
    canvas.width = grid.cols * grid.tileSize; canvas.height = grid.rows * grid.tileSize;
    ctx.fillStyle = '#060a0b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
      const value = grid.tiles[y]![x];
      ctx.fillStyle = value === TileType.FLOOR ? '#384342' : value === TileType.WALL ? '#8c9993' : '#060a0b';
      ctx.fillRect(x * grid.tileSize, y * grid.tileSize, grid.tileSize, grid.tileSize);
    }
    for (const [points, color] of [[map.layout.kindlingNodes, '#b99c74'], [map.layout.contaminantNodes, '#ab93b9'], [map.layout.enemySpawns, '#bc8176']] as const) {
      ctx.fillStyle = color;
      for (const point of points) {
        const position = 'position' in point ? point.position
          : { x: (point.spawn.col + .5) * grid.tileSize, y: (point.spawn.row + .5) * grid.tileSize };
        ctx.fillRect(position.x - 4, position.y - 4, 8, 8);
      }
    }
    ctx.fillStyle = '#e5e5cf'; ctx.fillRect(map.layout.spawnPoint.x - 5, map.layout.spawnPoint.y - 5, 10, 10);
    const exit = map.layout.extractionPoint.position;
    ctx.strokeStyle = '#a1c7c2'; ctx.strokeRect(exit.x - 7, exit.y - 7, 14, 14);
  }
  async function build(): Promise<void> {
    if (!ready) return; // Boot owns initial assets; the latest selected controls are read on ready.
    stopScan(); request?.abort(); request = new AbortController(); const current = ++revision, signal = request.signal;
    runtime.stop(); map = null; recipe = null; overview = false;
    el('waiting').hidden = false; el('waiting').textContent = '生成正式投放并准备材质…'; el('error').hidden = true;
    el<HTMLButtonElement>('export').disabled = true;
    try {
      const frozen = readRecipe(), start = performance.now();
      history.replaceState(null, '', `?${query()}`);
      const wire = await client.generate({ kind: 'departure', generation: frozen }, signal);
      if (current !== revision || signal.aborted) return;
      const result = hydrateRiftGeneration(wire);
      if (!result.world?.native) throw new Error('原生世界缺失；不回落其他地图。');
      await prepareR100Presentation(frozen,{signal,world:result.world});
      const playerModelAssets = playerModelA ? await prepareLastLightPlayerAssets({ signal }) : undefined;
      if(current!==revision||signal.aborted)return;
      map = result.world; recipe = frozen; generatedMs = performance.now() - start;
      const entry = R100_NATIVE_WORLDS.find(row => row.id === world.value)!;
      el('map-title').textContent = `${entry.label} · ${frozen.gradeDefinition.label}`;
      el('qualification').textContent = playerModelA ? 'DEV · A 角色空手模型审阅 · 独立内存存档' : nativeDevelopment ? 'DEV r12 · 未准入正常游戏' : entry.enabled ? '正式随机池' : '候选 · 尚未进入随机池';
      for (const button of catalogButtons) button.setAttribute('aria-current', String(button.dataset.world === world.value));
      el('metrics').textContent = `请求 ${frozen.requestedSeed} → 实际 ${map.layout.seed} · ${map.layout.kindlingNodes.length} 薪柴 / ${map.layout.contaminantNodes.length} 污染物 / ${map.layout.enemySpawns.length} 敌人 · ${(generatedMs / 1000).toFixed(2)} 秒`;
      runtime.start(map, loadout.value, { productionRecipe: frozen, pollutionGrade: frozen.nativeDefinition.grade,
        ...(playerModelAssets ? { playerModel: 'last-light-a', playerModelAssets } : {}) });
      el('waiting').hidden = true; el<HTMLButtonElement>('export').disabled = false; syncView();
    } catch (reason) { if (!signal.aborted && current === revision) error(reason); }
  }
  function adjacent(delta: number): void {
    const index = worlds.findIndex(row => row.id === world.value);
    world.value = worlds[(index + delta + worlds.length) % worlds.length]!.id; void build();
  }
  for (const control of [world, grade, loadout]) control.onchange = () => { void build(); };
  el('generate').onclick = () => { void build(); };
  seed.onkeydown = event => { if (event.key === 'Enter') void build(); };
  el('previous').onclick = () => adjacent(-1); el('next').onclick = () => adjacent(1);
  el('pause').onclick = () => runtime.togglePause(); el('overview').onclick = () => { overview = !overview; syncView(); };
  el('copy').onclick = () => { void navigator.clipboard.writeText(`${location.origin}${location.pathname}?${query()}`).then(() => { el('status').textContent = '同图链接已复制'; }, error); };
  el('export').onclick = () => {
    if (!recipe || !map) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ recipe, metadata: map.metadata, runtime: runtime.getState(), generatedMs }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${world.value}-${grade.value}-${recipe.requestedSeed}.json`; a.click(); URL.revokeObjectURL(url);
  };
  el('scan').onclick = async () => {
    if (scan) { stopScan(); request?.abort(); return; }
    if (!ready) return;
    request?.abort(); runtime.stop(); overview = true; syncView();
    scan = true; request = new AbortController(); const signal = request.signal;
    el('scan').textContent = '停止巡检'; let checked = 0, failed = 0;
    try {
      const inputSeed = readRecipe().requestedSeed;
      for (const entry of worlds) for (const level of POLLUTION_GRADES) {
        if (!scan || signal.aborted) return;
        try { await client.generate({ kind: 'departure', generation: createRecipe(entry.id, inputSeed, level) }, signal); }
        catch (reason) { if (signal.aborted) return; failed++; error(`${entry.label} / ${level}: ${String(reason)}`); }
        el('scan-status').textContent = `${++checked} / ${worlds.length * 3} 已生成 · ${failed} 拒绝。仅证明当前种子准入。`;
      }
    } catch (reason) { error(reason); }
    finally { stopScan(); }
  };
  window.addEventListener('pagehide', () => request?.abort(), { once: true });
  Object.assign(window, { __r100Gym: { getState: () => ({ runtime: runtime.getState(), recipe, metadata: map?.metadata }),
    getLayout: () => map?.layout, getNative: () => map?.native } });
}
