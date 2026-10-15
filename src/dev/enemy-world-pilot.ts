/** Controlled visual pilot, deliberately separate from combat/AI admission.
 * Both organisms use production bakers; the setting is the actual native map. */
import './enemy-world-pilot.css';
import { buildPilotWorld, PILOT_WORLDS, type PilotWorld, type PilotWorldId } from './enemy-world-pilot-world';
import { bakeHumanModel, HUMAN_WALK_CYCLE_MS, type HumanPhase } from '@/entities/form-renderers/d/human-model';
import { resolveEnemyWorldAdaptation } from '@/entities/form-renderers/d/world-adaptation';
import { bakePaintGenome, type PaintGenomeBakeResult } from '@/entities/form-renderers/d/paint-genome/bake';
import { paintPaintGenomeLive, isPaintInflated, PAINT_BREATH } from '@/entities/form-renderers/d/paint-genome/live';
import { paintSurfaceMaterial } from '@/entities/form-renderers/d/paint-genome/material';
import { BODY_PROFILE_DATA } from '@/generated/contamination-body-data';
import { FAMILY_CAPABILITY_DATA } from '@/generated/contamination-family-data';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import { lightModelPixels } from '@/entities/form-renderers/d/model-visual';
import { applyPaintWorldLighting } from '@/entities/form-renderers/d/paint-genome/lighting';
import type { WorldMaterialLighting } from '@/entities/form-renderers/d/world-material-light';

if (!import.meta.env.DEV) throw new Error('This visual pilot is DEV-only');
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('stage'), ctx = canvas.getContext('2d')!;
const human = document.createElement('canvas'), humanCtx = human.getContext('2d')!;
human.width = human.height = 64;
const humanPixels = humanCtx.createImageData(64, 64);
const paint = document.createElement('canvas'), paintCtx = paint.getContext('2d')!;
const backdrop = document.createElement('canvas'), backdropCtx = backdrop.getContext('2d')!;
backdrop.width = 960; backdrop.height = 640;
const frames = new Map<string, ReturnType<typeof bakeHumanModel>>();
const worlds = new Map<PilotWorldId, Promise<PilotWorld>>();
const errors: string[] = [];
const paintFamily = FAMILY_CAPABILITY_DATA.find(family => family.id === 'fungal_mat_bing')!;
const params = new URLSearchParams(location.search);
let worldId: PilotWorldId = params.get('world') === 'ruptured-film' ? 'ruptured-film' : 'crystal-fibre';
let world: PilotWorld | undefined, ready = false, disposed = false, epoch = 0;
let seed = /^\d+$/.test(params.get('seed') ?? '') ? Number(params.get('seed')) >>> 0 : 2718;
let coverage: CoverageId = 'rewrite', zoom = 3, adapted = true, playing = true;
let action: HumanPhase | 'auto' = 'auto', elapsed = 0, previous = 0, lastMaterial = -Infinity;
let frameMs = 0, frameCount = 0, actorBakeMs = 0;
let lighting: WorldMaterialLighting;
let baked: PaintGenomeBakeResult, scratch: Float32Array, paintPixels: ImageData;
let anchor = { x: 0, y: 0 }, camera = { x: 0, y: 0 }, drag: { x: number; y: number } | null = null;
const labels: Record<HumanPhase, string> = { idle: '静息', walk: '行走', alert: '警觉', windup: '攻击前摇', strike: '出手', recover: '收势' };
const sequence: readonly [HumanPhase, number][] = [
  ['idle', 2000], ['walk', HUMAN_WALK_CYCLE_MS * 4], ['alert', 1800],
  ['windup', BODY_PROFILE_DATA.human_remnant?.windupMs ?? 350], ['strike', 80], ['recover', 240], ['idle', 1200],
];
const cycle = sequence.reduce((sum, [, duration]) => sum + duration, 0);
function phaseAt(time: number): { phase: HumanPhase; progress: number; phaseMs: number } {
  if (action !== 'auto') {
    const duration = action === 'walk' ? HUMAN_WALK_CYCLE_MS : sequence.find(([phase]) => phase === action)![1];
    return { phase: action, progress: (time % duration) / duration, phaseMs: time % (action === 'walk' ? duration * 4 : duration) };
  }
  let t = time % cycle;
  for (const [phase, duration] of sequence) {
    if (t < duration) return { phase, progress: phase === 'walk' ? (t % HUMAN_WALK_CYCLE_MS) / HUMAN_WALK_CYCLE_MS : t / duration, phaseMs: t };
    t -= duration;
  }
  return { phase: 'idle', progress: 0, phaseMs: 0 };
}
function reportError(error: unknown): void {
  const text = error instanceof Error ? error.stack ?? error.message : String(error);
  errors.push(text); ready = false; el('error').hidden = false; el('error').textContent = text;
  el('loading').hidden = true;
}
function diagnostics(): void {
  el('diagnostics').textContent = JSON.stringify(snapshot(), null, 2);
}
function snapshot() {
  return { ready, worldId, seed, coverage, adapted, playing, action, elapsedMs: Math.round(elapsed), zoom,
    pose: phaseAt(elapsed),
    profile: resolveEnemyWorldAdaptation(worldId), anchor, camera,
    buildMs: world?.buildMs, organismBakeMs: actorBakeMs, cachedHumanFrames: frames.size,
    meanRenderMs: frameCount ? frameMs / frameCount : 0, cachedWorlds: [...worlds.keys()], errors,
    scope: 'DEV controlled visual pilot; two native constructions; production bakers; no combat/save/production admission',
    actualWorldData: world ? { width: world.terrain.width, height: world.terrain.height, seed: world.mapSeed } : undefined };
}
/** Choose a complete support envelope for both specimens and the short walk.
 * No sample is drawn over VOID or an ordinary solid to make the screenshot fit. */
function findAnchor(w: PilotWorld): { x: number; y: number } {
  const footprint: [number, number][] = [];
  for (let y = 0; y < baked.canvasH; y += 3) for (let x = 0; x < baked.canvasW; x += 3)
    if (baked.terrainFootprintField[y * baked.canvasW + x]! > .01) footprint.push([x - baked.canvasW / 2, y - baked.canvasH / 2]);
  let best: { x: number; y: number; score: number } | undefined;
  for (let y = 120; y < w.terrain.height - 120; y += 32) for (let x = 180; x < w.terrain.width - 180; x += 32) {
    if (!w.clear(x - 80, y) || !w.clear(x + 70, y)) continue;
    let valid = true;
    for (let dy = -32; dy <= 32 && valid; dy += 8) for (let dx = -122; dx <= -38; dx += 8)
      if (!w.clear(x + dx, y + dy)) { valid = false; break; }
    if (!valid || footprint.some(([dx, dy]) => !w.clear(x + 70 + dx, y + dy))) continue;
    // Keep a nearby material landmark in the normal camera, without seating on it.
    let nearest = 320;
    for (let d = 100; d <= 280; d += 32) for (let a = 0; a < 12; a++) {
      const px = x + Math.cos(a * Math.PI / 6) * d, py = y + Math.sin(a * Math.PI / 6) * d;
      if (w.terrain.matterAt(px, py) && !w.clear(px, py)) nearest = Math.min(nearest, d);
    }
    const score = Math.abs(nearest - 164) + Math.hypot(x - w.terrain.width / 2, y - w.terrain.height / 2) * .018;
    if (best && score >= best.score) continue;
    // A coarse candidate may miss a one-cell sliver. Reject it and keep searching.
    for (let py = 0; py < baked.canvasH && valid; py++) for (let px = 0; px < baked.canvasW; px++) {
      if (baked.terrainFootprintField[py * baked.canvasW + px]! > .01
        && !w.clear(x + 70 + px - baked.canvasW / 2, y + py - baked.canvasH / 2)) { valid = false; break; }
    }
    if (valid) best = { x, y, score };
  }
  if (!best) throw new Error('该关卡找不到同时支撑两种完整形体的观察位置。');
  return { x: best.x, y: best.y };
}
function regenerate(): void {
  const started = performance.now();
  baked = bakePaintGenome({ substrate: paintFamily.substrate, coverage, seed, continuity: 'colony', sense: paintFamily.sense[0], rhythm: paintFamily.rhythm[0], fragmentTypeId: 'frag-outdoor', geometryVersion: 2 });
  scratch = new Float32Array(baked.field.length);
  paint.width = baked.canvasW; paint.height = baked.canvasH;
  paintPixels = paintCtx.createImageData(paint.width, paint.height);
  frames.clear(); elapsed = 0;
  // Timed eager first frame, identical to the subsequent production-baker calls.
  bakeHumanModel({ seed, coverage, facing4: 'down', phase: 'idle', phase01: 0, worldAdaptation: adapted ? resolveEnemyWorldAdaptation(worldId) : undefined });
  actorBakeMs = performance.now() - started;
  if (world) {
    anchor = findAnchor(world); camera = { ...anchor, y: anchor.y - 18 };
    lighting = { lights: [{ x: anchor.x - 15, y: anchor.y + 64, z: 42, radius: 330, intensity: 2.6, color: [1, .94, .86], castsShadow: false }], shadeAt: world.shadeAt };
  }
  lastMaterial = -Infinity;
  el<HTMLInputElement>('seed').value = String(seed);
  el('generation-status').textContent = `seed ${seed} · 初次生成 ${actorBakeMs.toFixed(1)} ms`;
  history.replaceState(null, '', `?world=${worldId}&seed=${seed}`);
  diagnostics();
}
async function selectWorld(id: PilotWorldId): Promise<void> {
  const ticket = ++epoch; ready = false; worldId = id;
  el('loading').hidden = false; el('loading').textContent = '准备原生关卡…';
  document.body.dataset.world = id;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-world]')) button.setAttribute('aria-pressed', String(button.dataset.world === id));
  try {
    let pending = worlds.get(id);
    if (!pending) {
      pending = buildPilotWorld(id, text => { if (ticket === epoch) el('loading').textContent = text; });
      worlds.set(id, pending);
      void pending.then(value => { if (disposed) value.renderer.destroy(); }, () => worlds.delete(id));
    }
    const next = await pending;
    if (ticket !== epoch || disposed) return;
    world = next; regenerate(); ready = true;
    el('world-label').textContent = `${next.label} · 类人 / 占漆`;
    el('loading').hidden = true; diagnostics();
  } catch (error) { if (ticket === epoch && !disposed) reportError(error); }
}
function draw(time: number): void {
  if (disposed) return;
  const delta = previous ? Math.min(60, time - previous) : 0; previous = time;
  if (ready && world) {
    const started = performance.now();
    if (playing) elapsed += delta;
    try {
      const pose = phaseAt(elapsed);
      const walking = pose.phase === 'walk';
      const walk = walking ? pose.phaseMs / (HUMAN_WALK_CYCLE_MS * 4) * Math.PI * 2 : 0;
      // The four-cycle walk closes at its starting seat before the next action.
      const hx = anchor.x - 80 + (walking ? Math.sin(walk) * 27 : 0);
      const hy = anchor.y + (walking ? (1 - Math.cos(walk)) * 10 : 0);
      const facing: FormVisualPose['facing4'] = walking ? Math.cos(walk) > .35 ? 'right' : Math.cos(walk) < -.35 ? 'left' : Math.sin(walk) > 0 ? 'down' : 'up' : 'down';
      const profile = adapted ? resolveEnemyWorldAdaptation(worldId) : undefined;
      if (time - lastMaterial > 90) {
        world.renderer.draw(lighting.lights, .62, elapsed / 1000, 0);
        backdropCtx.fillStyle = '#000'; backdropCtx.fillRect(0, 0, 960, 640);
        backdropCtx.imageSmoothingEnabled = false;
        backdropCtx.drawImage(world.renderer.canvas, 480 - camera.x * zoom, 320 - camera.y * zoom, world.terrain.width * zoom, world.terrain.height * zoom);
        lastMaterial = time;
      }
      ctx.imageSmoothingEnabled = false; ctx.drawImage(backdrop, 0, 0);
      const inflated = isPaintInflated(elapsed * PAINT_BREATH);
      const formPose: FormVisualPose = { x: anchor.x + 70, y: anchor.y, facing4: 'down', moving: false,
        visibility: 1, signal: inflated ? 'inflated' : 'idle', deltaMs: delta, activity: { phase: 'active', progress: 1 } };
      paintPaintGenomeLive({ rest: baked.field, scratch, out: paintPixels.data, w: paint.width, h: paint.height,
        elapsedMs: elapsed, inflated, ramp: baked.ramp, growth: baked.growth });
      paintSurfaceMaterial(paintPixels.data, scratch, paint.width, paint.height, 'fungal_mat', coverage, seed, elapsed, formPose, profile, baked.growth);
      if (adapted) applyPaintWorldLighting(paintPixels.data,scratch,paint.width,paint.height,anchor.x+70-paint.width/2,anchor.y-paint.height/2,lighting);
      paintCtx.putImageData(paintPixels, 0, 0);
      ctx.drawImage(paint, 480 + (anchor.x + 70 - paint.width / 2 - camera.x) * zoom, 320 + (anchor.y - paint.height / 2 - camera.y) * zoom, paint.width * zoom, paint.height * zoom);
      const sample = Math.round(pose.progress * 29), key = `${profile?.key ?? 'legacy'}/${seed}/${coverage}/${pose.phase}/${sample}/${facing}`;
      let body = frames.get(key);
      if (!body) {
        body = bakeHumanModel({ seed, coverage, facing4: facing, phase: pose.phase, phase01: sample / 29, worldAdaptation: profile });
        frames.set(key, body); if (frames.size > 192) frames.delete(frames.keys().next().value!);
      }
      humanPixels.data.set(body.buf.data);
      if (adapted && body.lightingSurface) lightModelPixels(humanPixels.data,body.lightingSurface,hx,hy,lighting);
      humanCtx.putImageData(humanPixels, 0, 0);
      if(adapted) for(const foot of body.contacts) {
        if(foot.weight<.08)continue;
        ctx.fillStyle=`rgba(5,9,14,${.26*foot.weight})`;
        // Individual supported feet, not a whole-body floating ellipse.
        ctx.beginPath();ctx.ellipse(480+(hx+foot.x-camera.x)*zoom,320+(hy+foot.y*.48-camera.y)*zoom,2.3*zoom,1.2*zoom,0,0,Math.PI*2);ctx.fill();
      }
      ctx.drawImage(human, 480 + (hx - 32 - camera.x) * zoom, 320 + (hy - 42 - camera.y) * zoom, 64 * zoom, 64 * zoom);
      el('action-label').textContent = `${playing ? '▶' : 'Ⅱ'} ${labels[pose.phase]} · 占漆${inflated ? '扩张' : '回落'}${adapted ? '' : ' · 原模型对照'}`;
      frameMs += performance.now() - started; frameCount++;
    } catch (error) { reportError(error); }
  }
  requestAnimationFrame(draw);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-world]')) button.onclick = () => void selectWorld(button.dataset.world as PilotWorldId);
el<HTMLSelectElement>('zoom').onchange = () => { zoom = Number(el<HTMLSelectElement>('zoom').value); lastMaterial = -Infinity; };
el<HTMLSelectElement>('coverage').onchange = () => { coverage = el<HTMLSelectElement>('coverage').value as CoverageId; if (ready) { try { regenerate(); } catch (e) { reportError(e); } } };
el<HTMLSelectElement>('action').onchange = () => { action = el<HTMLSelectElement>('action').value as typeof action; elapsed = 0; };
el<HTMLInputElement>('adapted').onchange = () => { adapted = el<HTMLInputElement>('adapted').checked; frames.clear(); diagnostics(); };
el('pause').onclick = () => { playing = !playing; el('pause').textContent = playing ? '暂停' : '继续'; diagnostics(); };
el('focus').onclick = () => { camera = { ...anchor, y: anchor.y - 18 }; lastMaterial = -Infinity; };
el('regenerate').onclick = () => {
  const value = Number(el<HTMLInputElement>('seed').value);
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) { el<HTMLInputElement>('seed').reportValidity(); return; }
  seed = value; if (ready) { try { regenerate(); } catch (e) { reportError(e); } }
};
el('next-seed').onclick = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; if (ready) { try { regenerate(); } catch (e) { reportError(e); } } };
canvas.onpointerdown = event => { canvas.setPointerCapture(event.pointerId); drag = { x: event.clientX, y: event.clientY }; canvas.focus(); };
canvas.onpointermove = event => { if (!drag) return; const factor = 960 / canvas.getBoundingClientRect().width / zoom;
  camera.x -= (event.clientX - drag.x) * factor; camera.y -= (event.clientY - drag.y) * factor;
  drag = { x: event.clientX, y: event.clientY }; lastMaterial = -Infinity; };
canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
document.addEventListener('keydown', event => {
  if ((event.target as HTMLElement).matches('input,select')) return;
  if (event.code === 'Digit1' || event.code === 'Digit2') { event.preventDefault(); void selectWorld(PILOT_WORLDS[event.code === 'Digit1' ? 0 : 1]); }
  if (event.code === 'Space') { event.preventDefault(); el('pause').click(); }
  if (event.code === 'KeyN') el('next-seed').click();
});
window.addEventListener('pagehide', () => { disposed = true; epoch++; for (const pending of worlds.values()) void pending.then(w => w.renderer.destroy(), () => {}); frames.clear(); });
Object.assign(window, { __enemyWorldPilot: { getState: snapshot, selectWorld, regenerate,
  seek(ms: number) { playing = false; elapsed = Math.max(0, ms); el('pause').textContent = '继续'; lastMaterial = -Infinity; }, canvas } });
void selectWorld(worldId); requestAnimationFrame(draw);
