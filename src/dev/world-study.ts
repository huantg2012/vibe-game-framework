/** Independent, seeded world study. No production save, combat or scene state. */
import { generateWorldSample } from '@/generation/world-study/layout';
import { GAME_CONSTANTS } from '@/config/constants';
import { readWorldStudyInput, stepWorldStudyVelocity } from '@/generation/world-study/movement';
import { renderWorldSurface } from '@/generation/world-study/surface';
import { worldLandAt, worldWallAt } from '@/generation/world-study/shape';
import { WorldStudyLightField, LIGHT_EXTENT, LIGHT_SIZE } from '@/generation/world-study/light-field';
import { paintMaterialLight } from '@/generation/world-study/material-light';
import { renderDensePlayerFrame, DENSE_PLAYER_GROUND_OFFSET_Y } from '@/entities/player-sprite-dense';
import type { Facing4 } from '@/types/game-types';
import type { WorldSample } from '@/generation/world-study/types';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const context = canvas.getContext('2d', { alpha: false })!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const topologyInput = document.querySelector<HTMLSelectElement>('#topology')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const errorBox = document.querySelector<HTMLElement>('#error')!;
const worldButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-world]'));
const overviewButton = document.querySelector<HTMLButtonElement>('#overview')!;
const walkButton = document.querySelector<HTMLButtonElement>('#walk')!;
const fieldButton = document.querySelector<HTMLButtonElement>('#field')!;
const seedButton = document.querySelector<HTMLButtonElement>('#regenerate')!;
const positionLabel = document.querySelector<HTMLElement>('#position')!;

type ProfileId = 'ash-strata' | 'crystal-fibre' | 'ivory-basin';
type TopologyId = 'loops' | 'channels';
type View = 'overview' | 'walk' | 'free';
const worldIds: readonly ProfileId[] = ['ash-strata', 'crystal-fibre', 'ivory-basin'];
function parseSeed(raw: string | null): number | null {
  if (raw === null || !/^\d{1,10}$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
}
const params = new URLSearchParams(location.search);
let worldId: ProfileId = worldIds.includes(params.get('world') as ProfileId) ? params.get('world') as ProfileId : 'crystal-fibre';
let topology: TopologyId = params.get('topology') === 'channels' ? 'channels' : 'loops';
let seed = parseSeed(params.get('seed')) ?? 70421;
let view: View = params.get('view') === 'overview' ? 'overview' : 'walk';
let field = params.get('field') !== '0';
let sample: WorldSample | null = null;
let terrain: HTMLCanvasElement | null = null;
let busy = false;
let generation = 0;
let elapsed = 0;
let lastFrame = 0;
let movedDistance = 0;
let width = 1, height = 1;
let zoom = view === 'walk' ? GAME_CONSTANTS.CAMERA.ZOOM : 1;
const camera = { x: 0, y: 0 };
const player: { x: number; y: number; facing: Facing4; walking: boolean } = { x: 0, y: 0, facing: 'up', walking: false };
const keys = new Set<string>();
const movementInput = { x: 0, y: 0 };
const velocity = { x: 0, y: 0 };
let drag: { x: number; y: number; cameraX: number; cameraY: number; pointer: number } | null = null;
let motes: { x: number; y: number; phase: number; size: number }[] = [];
let nextPositionUpdate = 0;
let lightField: WorldStudyLightField | null = null;
const litCanvas = document.createElement('canvas');
litCanvas.width = litCanvas.height = LIGHT_EXTENT * 2;
const litContext = litCanvas.getContext('2d')!;
const lightMask = document.createElement('canvas');
lightMask.width = lightMask.height = LIGHT_SIZE;
const maskContext = lightMask.getContext('2d')!;
const maskImage = maskContext.createImageData(LIGHT_SIZE, LIGHT_SIZE);
const actorFrames = new Map<string, HTMLCanvasElement>();
for (const facing of ['down', 'up', 'left', 'right'] as const) for (const gait of ['idle', 'walk'] as const) {
  for (let frame = 0; frame < 4; frame++) {
    const image = document.createElement('canvas'); image.width = image.height = 32;
    const ctx = image.getContext('2d')!;
    const data = ctx.createImageData(32, 32); data.data.set(renderDensePlayerFrame(facing, gait, frame));
    ctx.putImageData(data, 0, 0); actorFrames.set(`${facing}-${gait}-${frame}`, image);
  }
}

function updateUrl(): void {
  const query = new URLSearchParams({ world: worldId, topology, seed: String(seed), view: view === 'walk' ? 'walk' : 'overview' });
  query.set('field', field ? '1' : '0');
  history.replaceState(null, '', `${location.pathname}?${query}`);
}

function updateControls(): void {
  for (const button of worldButtons) button.setAttribute('aria-pressed', String(button.dataset.world === worldId));
  if (sample) {
    document.querySelector<HTMLElement>('#world-name')!.textContent = sample.profile.label;
    document.querySelector<HTMLElement>('#world-description')!.textContent = sample.profile.description;
  }
  document.querySelector<HTMLElement>('#world-code')!.textContent = `RIFT / 0${worldIds.indexOf(worldId) + 1} · ${topology === 'loops' ? 'RETURNING FIELDS' : 'CONFLUENT RIDGES'}`;
  topologyInput.value = topology;
  seedInput.value = String(seed);
  overviewButton.setAttribute('aria-pressed', String(view === 'overview'));
  walkButton.setAttribute('aria-pressed', String(view === 'walk'));
  fieldButton.setAttribute('aria-pressed', String(field && view !== 'overview'));
  updateUrl();
}

function fitOverview(): void {
  if (!sample) return;
  const worldWidth = sample.cols * sample.tileSize, worldHeight = sample.rows * sample.tileSize;
  zoom = Math.min((width - 84) / worldWidth, (height - 60) / worldHeight);
  camera.x = worldWidth / 2;
  camera.y = worldHeight / 2;
}

function setView(next: View): void {
  view = next;
  if (view === 'overview') fitOverview();
  if (view === 'walk') {
    zoom = GAME_CONSTANTS.CAMERA.ZOOM;
    camera.x = player.x;
    camera.y = player.y;
  }
  updateControls();
}

function resize(): void {
  const box = canvas.getBoundingClientRect();
  width = Math.max(1, Math.round(box.width));
  height = Math.max(1, Math.round(box.height));
  // Deliberate one logical pixel per CSS pixel; nearest-neighbour world scaling.
  canvas.width = width; canvas.height = height;
  context.imageSmoothingEnabled = false;
  if (view === 'overview') fitOverview();
}

function hash(value: number): number {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

async function regenerate(nextWorld = worldId, nextTopology = topology, nextSeed = seed): Promise<void> {
  const token = ++generation;
  busy = true;
  loading.hidden = false;
  errorBox.hidden = true;
  seedButton.disabled = true;
  keys.clear();
  velocity.x = velocity.y = 0;
  player.walking = false;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (token !== generation) return;
  try {
    const created = generateWorldSample(nextWorld, nextTopology, nextSeed);
    const surface = renderWorldSurface(created);
    const createdLight = new WorldStudyLightField(created);
    const baked = document.createElement('canvas');
    baked.width = surface.width; baked.height = surface.height;
    const bakedContext = baked.getContext('2d')!;
    const image = bakedContext.createImageData(surface.width, surface.height);
    image.data.set(surface.rgba);
    bakedContext.putImageData(image, 0, 0);
    const preserveLocation = sample && nextTopology === topology && nextSeed === seed;
    sample = created; terrain = baked; lightField = createdLight;
    worldId = nextWorld; topology = nextTopology; seed = nextSeed >>> 0;
    if (!preserveLocation) {
      player.x = sample.spawn.x; player.y = sample.spawn.y;
      player.facing = 'up'; movedDistance = 0;
    }
    motes = [];
    // Sparse, seed-stable surface details move independently of layout RNG.
    for (let i = 0; i < sample.land.length; i++) {
      if (!sample.land[i] || sample.walls[i] || hash(seed ^ i ^ 0x9971) % 37 !== 0) continue;
      motes.push({ x: (i % sample.cols + .5) * sample.tileSize, y: (Math.floor(i / sample.cols) + .5) * sample.tileSize,
        phase: hash(i + seed) % 1000 / 1000 * Math.PI * 2, size: 1 + hash(i) % 2 });
    }
    if (view === 'overview') fitOverview();
    else { camera.x = player.x; camera.y = player.y; }
    updateControls();
    canvas.focus({ preventScroll: true });
  } catch (error) {
    errorBox.textContent = `生成失败：${error instanceof Error ? error.message : String(error)}`;
    errorBox.hidden = false;
  } finally {
    if (token === generation) { busy = false; loading.hidden = true; seedButton.disabled = false; }
  }
}

function isWalkable(x: number, y: number): boolean {
  if (!sample) return false;
  return worldLandAt(sample, x, y) && !worldWallAt(sample, x, y);
}

function canStand(x: number, y: number): boolean {
  const radius = 6;
  return isWalkable(x - radius, y - radius) && isWalkable(x + radius, y - radius)
    && isWalkable(x - radius, y + radius) && isWalkable(x + radius, y + radius)
    && isWalkable(x, y) && isWalkable(x - radius, y) && isWalkable(x + radius, y)
    && isWalkable(x, y - radius) && isWalkable(x, y + radius);
}

function updatePlayer(delta: number): void {
  readWorldStudyInput(keys, movementInput);
  const requested = movementInput.x !== 0 || movementInput.y !== 0;
  player.walking = false;
  if (busy || !sample) { velocity.x = velocity.y = 0; return; }
  if (requested) {
    if (Math.abs(movementInput.x) > 0) player.facing = movementInput.x < 0 ? 'left' : 'right';
    else player.facing = movementInput.y < 0 ? 'up' : 'down';
  }
  stepWorldStudyVelocity(velocity, movementInput, delta);
  let dx = velocity.x * delta, dy = velocity.y * delta;
  // Substeps keep collision stable even after a delayed animation frame.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  const initialDistance = movedDistance;
  for (let step = 0; step < steps; step++) {
    const beforeX = player.x, beforeY = player.y;
    if (canStand(player.x + dx / steps, player.y)) player.x += dx / steps;
    else { velocity.x = 0; dx = 0; }
    if (canStand(player.x, player.y + dy / steps)) player.y += dy / steps;
    else { velocity.y = 0; dy = 0; }
    movedDistance += Math.hypot(player.x - beforeX, player.y - beforeY);
  }
  player.walking = delta > 0 && (movedDistance - initialDistance) / delta >= GAME_CONSTANTS.ACTOR_MOTION.MOVE_SPEED_FLOOR;
}

function drawPlayer(): void {
  if (!sample) return;
  const gait = player.walking ? 'walk' : 'idle';
  const step = Math.floor(elapsed * (player.walking ? 8 : 4)) % 6;
  const frame = step < 4 ? step : 6 - step;
  const image = actorFrames.get(`${player.facing}-${gait}-${frame}`)!;
  context.fillStyle = '#00000070';
  context.fillRect(Math.round(player.x) - 7, Math.round(player.y) - 1, 14, 3);
  context.drawImage(image, Math.round(player.x) - 16, Math.round(player.y) - 16 - DENSE_PLAYER_GROUND_OFFSET_Y);
}

function drawSurface(ctx = context): void {
  if (!sample || !terrain) return;
  const inheritedAlpha = ctx.globalAlpha;
  ctx.drawImage(terrain, 0, 0, sample.cols * sample.tileSize, sample.rows * sample.tileSize);
  for (const mote of motes) {
    const pulse = Math.sin(elapsed * .55 + mote.phase);
    if (pulse < .58) continue;
    ctx.globalAlpha = inheritedAlpha * (pulse - .58) * .3;
    ctx.fillStyle = `#${sample.profile.palette.accentLight.toString(16).padStart(6, '0')}`;
    const dx = worldId === 'crystal-fibre' ? Math.round(Math.sin(elapsed * .3 + mote.phase) * 3) : 0;
    const dy = worldId === 'ivory-basin' ? -Math.round((elapsed * 2 + mote.phase * 6) % 14) : 0;
    ctx.fillRect(mote.x + dx, mote.y + dy, mote.size, 1);
  }
  ctx.globalAlpha = inheritedAlpha;
}

function drawLitSurface(): void {
  if (!sample || !terrain || !lightField) return;
  if (lightField.update(player.x, player.y, player.facing)) {
    maskImage.data.set(lightField.pixels); maskContext.putImageData(maskImage, 0, 0);
  }
  litContext.setTransform(1, 0, 0, 1, 0, 0);
  litContext.clearRect(0, 0, litCanvas.width, litCanvas.height);
  litContext.imageSmoothingEnabled = false;
  litContext.setTransform(1, 0, 0, 1, -lightField.originX, -lightField.originY);
  drawSurface(litContext);
  paintMaterialLight(litContext, sample, player.x, player.y, elapsed);
  litContext.setTransform(1, 0, 0, 1, 0, 0);
  litContext.globalCompositeOperation = 'destination-in';
  litContext.drawImage(lightMask, 0, 0, litCanvas.width, litCanvas.height);
  litContext.globalCompositeOperation = 'source-over';
  context.drawImage(litCanvas, lightField.originX, lightField.originY);
}

function frame(timestamp: number): void {
  const delta = Math.min(.05, (timestamp - lastFrame) / 1000 || 0);
  lastFrame = timestamp; elapsed += delta;
  updatePlayer(delta);
  if (view === 'walk' && !drag) {
    const factor = 1 - Math.exp(-delta * 9);
    camera.x += (player.x - camera.x) * factor;
    camera.y += (player.y - camera.y) * factor;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = '#000000';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  context.setTransform(zoom, 0, 0, zoom, Math.round(width / 2 - camera.x * zoom), Math.round(height / 2 - camera.y * zoom));
  if (field && view !== 'overview') drawLitSurface();
  else drawSurface();
  if (sample) drawPlayer();
  context.setTransform(1, 0, 0, 1, 0, 0);
  if (elapsed > nextPositionUpdate && sample) {
    nextPositionUpdate = elapsed + .25;
    positionLabel.textContent = `${Math.floor(player.x / sample.tileSize)}, ${Math.floor(player.y / sample.tileSize)} · ${Math.round(zoom * 100)}% · 可步行样板`;
  }
  requestAnimationFrame(frame);
}

function nextSeed(): void { void regenerate(worldId, topology, (seed + 104729) >>> 0); }
for (const button of worldButtons) button.addEventListener('click', () => void regenerate(button.dataset.world as ProfileId));
seedButton.addEventListener('click', nextSeed);
topologyInput.addEventListener('change', () => void regenerate(worldId, topologyInput.value as TopologyId));
seedInput.addEventListener('change', () => {
  const value = parseSeed(seedInput.value);
  if (value === null) {
    seedInput.value = String(seed); return;
  }
  void regenerate(worldId, topology, value);
});
overviewButton.addEventListener('click', () => { setView('overview'); canvas.focus(); });
walkButton.addEventListener('click', () => { setView('walk'); canvas.focus(); });
fieldButton.addEventListener('click', () => { field = !field; if (field) setView('walk'); updateControls(); canvas.focus(); });

window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
    || event.target instanceof Element && event.target.closest('button')
    || event.ctrlKey || event.metaKey || event.altKey) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat || busy) return;
  if (event.code === 'Space') setView('walk');
  if (event.code === 'KeyR') nextSeed();
  if (event.code === 'KeyV') { field = !field; updateControls(); }
  const digit = Number(event.code.replace('Digit', ''));
  if (digit >= 1 && digit <= 3) void regenerate(worldIds[digit - 1]!);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); velocity.x = velocity.y = 0; drag = null; player.walking = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); velocity.x = velocity.y = 0; player.walking = false; }
});
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  canvas.focus(); canvas.setPointerCapture(event.pointerId);
  drag = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y, pointer: event.pointerId };
});
canvas.addEventListener('pointermove', event => {
  if (!drag || drag.pointer !== event.pointerId) return;
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3 && view !== 'free') return;
  view = 'free';
  camera.x = drag.cameraX - (event.clientX - drag.x) / zoom;
  camera.y = drag.cameraY - (event.clientY - drag.y) / zoom;
  overviewButton.setAttribute('aria-pressed', 'false'); walkButton.setAttribute('aria-pressed', 'false');
});
const releaseDrag = () => { drag = null; };
canvas.addEventListener('pointerup', releaseDrag);
canvas.addEventListener('pointercancel', releaseDrag);
canvas.addEventListener('lostpointercapture', releaseDrag);
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const box = canvas.getBoundingClientRect();
  const screenX = event.clientX - box.left - width / 2, screenY = event.clientY - box.top - height / 2;
  const worldX = camera.x + screenX / zoom, worldY = camera.y + screenY / zoom;
  zoom = Math.min(4, Math.max(.2, zoom * Math.exp(-event.deltaY * .0015)));
  camera.x = worldX - screenX / zoom; camera.y = worldY - screenY / zoom;
  view = 'free'; updateControls();
}, { passive: false });

declare global {
  interface Window {
    __worldStudy: {
      getState(): { ready: boolean; world: string; topology: string; seed: number; view: View; field: boolean; player: { x: number; y: number }; velocity: { x: number; y: number }; movedDistance: number; zoom: number; cols: number; rows: number; error: string | null };
      regenerate(world: ProfileId, topology: TopologyId, seed: number): Promise<void>;
      setView(view: View): void;
      visibilityAt(x: number, y: number): number;
      collisionAt(x: number, y: number): boolean;
      getGrid(): { cols: number; rows: number; tileSize: number; land: number[]; walls: number[] } | null;
    };
  }
}
window.__worldStudy = {
  getState: () => ({ ready: !!sample && !busy, world: worldId, topology, seed, view, field,
    player: { x: player.x, y: player.y }, velocity: { ...velocity }, movedDistance, zoom, cols: sample?.cols ?? 0, rows: sample?.rows ?? 0,
    error: errorBox.hidden ? null : errorBox.textContent }),
  regenerate, setView, collisionAt: canStand,
  visibilityAt: (x, y) => { lightField?.update(player.x, player.y, player.facing); return lightField?.visibilityAt(x, y) ?? 0; },
  getGrid: () => sample ? { cols: sample.cols, rows: sample.rows, tileSize: sample.tileSize, land: Array.from(sample.land), walls: Array.from(sample.walls) } : null,
};
window.addEventListener('resize', resize);
resize(); updateControls(); requestAnimationFrame(frame); void regenerate();
