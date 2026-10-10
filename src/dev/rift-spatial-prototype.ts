import { createSpatialPrototype } from './rift-spatial-prototype-world';
import { MasterSurfaceRenderer } from '@/systems/r100-world/surface-renderer';
import { bakeMasterWorldSurface } from '@/systems/r100-world/surface-bake';
import { loadPaintedMaterial } from '@/systems/r100-world/painted-material';
import { TileType } from '@/types/game-types';

if (!import.meta.env.DEV) throw new Error('Spatial prototype is development-only');
const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing prototype element: ${id}`);
  return node as T;
};
const map = element<HTMLCanvasElement>('map');
const annotation = element<HTMLCanvasElement>('annotation');
const stage = element('stage');
const viewport = element('viewport');
const seedInput = element<HTMLInputElement>('seed');
const context = map.getContext('2d');
const ink = annotation.getContext('2d');
if (!context || !ink) throw new Error('Canvas 2D unavailable');
const ctx = context, pen = ink;
type Prototype = ReturnType<typeof createSpatialPrototype>;
let prototype: Prototype | undefined;
let renderer: MasterSurfaceRenderer | undefined;
let mode: 'clean' | 'routes' | 'collision' = 'clean';
let native = false, ready = false, generation = 0;
const params = new URLSearchParams(location.search);
seedInput.value = params.get('seed') ?? '20261010';

function fit(): void {
  if (!prototype) return;
  const { width, height } = prototype.world.raster;
  const scale = native ? 1 : Math.min(viewport.clientWidth / width, viewport.clientHeight / height);
  stage.style.width = `${width * scale}px`;
  stage.style.height = `${height * scale}px`;
  for (const canvas of [map, annotation]) {
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
  }
}

function label(text: string, x: number, y: number, color: string): void {
  pen.font = '25px -apple-system, "PingFang SC", sans-serif';
  pen.textBaseline = 'middle';
  const width = pen.measureText(text).width;
  const left = Math.max(8, Math.min(map.width - width - 30, x + 20));
  const top = Math.max(22, Math.min(map.height - 22, y));
  pen.fillStyle = '#0a0b0d';
  pen.globalAlpha = .92;
  pen.fillRect(left - 8, top - 19, width + 16, 38);
  pen.globalAlpha = 1;
  pen.fillStyle = color;
  pen.fillText(text, left, top);
}

function drawAnnotations(): void {
  pen.clearRect(0, 0, annotation.width, annotation.height);
  if (!prototype || mode === 'clean') return;
  if (mode === 'collision') {
    const grid = prototype.world.layout.tileMap;
    pen.fillStyle = '#c4873a';
    pen.globalAlpha = .6;
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
      if (grid.tiles[row]?.[col] === TileType.WALL) pen.fillRect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
    }
    pen.globalAlpha = 1;
    label('橙色：真实实体占地（非装饰）', 45, 45, '#e0a848');
    return;
  }
  const colors = ['#e0a848', '#c8cdd4', '#b89040', '#8a8f96'];
  for (const [index, route] of prototype.routes.entries()) {
    if (!route.points.length) continue;
    pen.beginPath();
    pen.moveTo(route.points[0]!.x, route.points[0]!.y);
    for (const point of route.points.slice(1)) pen.lineTo(point.x, point.y);
    pen.strokeStyle = '#0a0b0d'; pen.lineWidth = 10; pen.setLineDash([]); pen.stroke();
    pen.strokeStyle = colors[index % colors.length]!; pen.lineWidth = 4;
    pen.setLineDash(index % 2 ? [14, 10] : []); pen.stroke(); pen.setLineDash([]);
  }
  for (const anchor of prototype.anchors) {
    if (anchor.role === 'route') continue;
    const { x, y } = anchor.point;
    const color = anchor.role === 'extraction' ? '#e0a848' : '#c8cdd4';
    pen.strokeStyle = color; pen.lineWidth = 3;
    pen.fillStyle = '#0a0b0d'; pen.beginPath(); pen.arc(x, y, 9, 0, Math.PI * 2); pen.fill(); pen.stroke();
    label(anchor.label, x, y - 24, color);
  }
  const x = 55, y = map.height - 60;
  pen.strokeStyle = '#c8cdd4'; pen.lineWidth = 3; pen.strokeRect(x, y - 20, 20, 20);
  label('20 × 20 角色碰撞尺寸', x + 15, y - 10, '#c8cdd4');
}

function selectMode(value: typeof mode): void {
  mode = value;
  for (const id of ['clean', 'routes', 'collision']) element(id).setAttribute('aria-pressed', String(id === mode));
  drawAnnotations();
}

async function build(): Promise<void> {
  const token = ++generation;
  ready = false;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = true;
  element('error').hidden = true;
  element('summary').textContent = '正在构造地形与身体可达网格…';
  try {
    const seed = Number(seedInput.value);
    if (!/^\d+$/.test(seedInput.value) || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子须为 0–4294967295 的整数');
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    renderer?.destroy(); renderer = undefined; prototype = undefined;
    const next = createSpatialPrototype(seed, 'medium');
    element('summary').textContent = '空间已构造；正在烘焙余烬脊的原生材质…';
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const painting = await loadPaintedMaterial(next.world.definition.family);
    if (token !== generation) return;
    const prepared = bakeMasterWorldSurface(next.world, painting);
    renderer = new MasterSurfaceRenderer(next.world, undefined, undefined, painting, prepared);
    const spawn = next.world.layout.spawnPoint;
    renderer.draw([{ x: spawn.x, y: spawn.y, z: 28, radius: 264, intensity: 3.1, color: [1, .94, .86], castsShadow: false }], .72, 0, 0);
    prototype = next;
    for (const canvas of [map, annotation]) { canvas.width = next.world.raster.width; canvas.height = next.world.raster.height; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderer.canvas, 0, 0);
    element('identity').textContent = `中污染 · 种子 ${seed} · ${map.width} × ${map.height} 原始像素`;
    element('summary').textContent = '去雾地形全图 · 可切换路线标记与实体占地核对';
    element('diagnostics').textContent = JSON.stringify({ scope: 'DEV spatial structure only; production rendering and collision; no complete sortie deployment', seed, metrics: next.metrics, routes: next.routes.map(route => ({ id: route.id, label: route.label, lengthPx: route.lengthPx })), anchors: next.anchors }, null, 2);
    const url = new URL(location.href); url.searchParams.set('seed', String(seed)); history.replaceState(null, '', url);
    fit(); drawAnnotations(); ready = true;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    element('error').textContent = message; element('error').hidden = false;
    element('summary').textContent = '本次生成失败，未替换正式游戏地图。';
  } finally {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = !ready && button.id !== 'rebuild';
  }
}

for (const id of ['clean', 'routes', 'collision'] as const) element(id).addEventListener('click', () => selectMode(id));
for (const id of ['fit', 'native'] as const) element(id).addEventListener('click', () => {
  native = id === 'native'; document.body.classList.toggle('native', native);
  element('fit').setAttribute('aria-pressed', String(!native)); element('native').setAttribute('aria-pressed', String(native)); fit();
});
element('rebuild').addEventListener('click', () => { void build(); });
seedInput.addEventListener('keydown', event => { if (event.key === 'Enter' && !element<HTMLButtonElement>('rebuild').disabled) void build(); });
element('download').addEventListener('click', () => {
  const canvas = document.createElement('canvas'); canvas.width = map.width; canvas.height = map.height;
  const draw = canvas.getContext('2d'); if (!draw) return;
  draw.drawImage(map, 0, 0); draw.drawImage(annotation, 0, 0);
  const link = document.createElement('a'); link.download = `cinder-ridge-spatial-${seedInput.value}-${mode}.png`; link.href = canvas.toDataURL('image/png'); link.click();
});
window.addEventListener('resize', fit);
window.addEventListener('pagehide', () => { generation++; renderer?.destroy(); }, { once: true });
Object.assign(window, { __spatialPrototype: { getState: () => ({ ready, mode, seed: prototype?.world.layout.seed, metrics: prototype?.metrics, anchors: prototype?.anchors, routes: prototype?.routes }), selectMode } });
void build();
