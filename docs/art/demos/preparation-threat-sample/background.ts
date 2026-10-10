import { LastLightRenderer, type LastLightFrame, type LastLightRenderImages, type LastLightRenderPack, type LastLightRenderState } from '../../../../src/art/last-light-renderer';
import { CHAMBER_DEVICE_BASES, CHAMBER_DEVICE_VISUAL_BOUNDS, LAST_LIGHT_SPAWN } from '../../../../src/systems/last-light-layout';

export type Grade = 'low' | 'medium' | 'severe';
export type Phase = 'pollution' | 'equipment';

export interface ActorRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SampleBackground {
  readonly actorRegion: ActorRegion;
  setGrade(grade: Grade): void;
  setPhase(phase: Phase): void;
  setMotion(enabled: boolean): void;
  dispose(): void;
}

/** One unchanged world image beneath the independent UI-overlay study.
 * The production renderer, assets, idle phase and preparation camera remain
 * read-only. Grade and phase never alter world pixels; the UI owns its veil.
 */
export async function mountBackground(canvas: HTMLCanvasElement): Promise<SampleBackground> {
  const root = '/assets/last-light/';
  const json = async (file: string) => {
    const response = await fetch(root + file);
    if (!response.ok) throw new Error(`素材读取失败：${file}`);
    return response.json();
  };
  const manifest = await json('manifest.json');
  const loaded: ImageBitmap[] = [];
  const bitmap = async (file: string) => {
    const response = await fetch(root + file);
    if (!response.ok) throw new Error(`贴图读取失败：${file}`);
    const image = await createImageBitmap(await response.blob(), {
      imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none',
    });
    loaded.push(image);
    return image;
  };
  const t = manifest.textures, a = manifest.actor.textures;
  const exterior = (id: string) => manifest.exteriorLayers.find((layer: { id: string }) => layer.id === id).color;
  const names = {
    scene: t.haven, background: t.background, far: exterior('far'), middle: exterior('middle'), near: exterior('near'),
    exteriorFields: t.exteriorFields ?? 'exterior-fields.png', pollution: t.pollution,
    coreLight: t.coreLight, storageLight: t.storageLight, purifierLight: t.purifierLight,
    furnace: t.furnace, motion: t.motion, depth: t.depth, volumeDepth: t.volumeDepth,
    exteriorDepth: t.exteriorDepth, energy: t.coreEnergy, normal: t.normal, albedo: t.albedo,
    rough: t.roughSpec, actorColor: a.albedo, actorNormal: a.normal, actorDepth: a.depth, actorRough: a.roughSpec,
  };
  let renderer: LastLightRenderer | undefined;
  try {
    const images = Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, file]) => [key, await bitmap(file)]))) as unknown as LastLightRenderImages;
    const occluders = await json('occluders.json');
    const pack: LastLightRenderPack = {
      camera: manifest.camera,
      frames: manifest.actor.frames.map((f: any) => ({ ...f.rect, anchor: f.anchor, yaw: f.yaw, pose: f.pose, phase: f.frame, lamp: f.lamp, shadowCapsules: f.shadowCapsules })) as LastLightFrame[],
      lights: manifest.lights, occluders: Array.isArray(occluders) ? occluders : occluders.triangles,
      images, actorPortrait: await bitmap(a.color), actorDepthOffset: 80, actorDepthScale: 256,
      exteriorPadding: manifest.exteriorPadding ?? 32,
      exteriorParallax: ['far', 'middle', 'near'].map(id => manifest.exteriorLayers.find((layer: { id: string }) => layer.id === id).parallax) as [number, number, number],
      exteriorMotion: 'joint-depth',
    };
    renderer = new LastLightRenderer(pack);
    const state: LastLightRenderState = {
      seconds: 0, exteriorSeconds: 0, world: [LAST_LIGHT_SPAWN.x, LAST_LIGHT_SPAWN.y, LAST_LIGHT_SPAWN.z],
      yaw: 0, walking: false, resting: false, health: [1, 1, 1], charge: 0, growth: 0, thicken: 0,
      pulses: new Float32Array(6), reducedMotion: true, gaitPose: 'idle', gaitFrame: 0,
    };
    renderer.settleExteriorObserver(state.world, 0);
    renderer.draw(state);
    const bounds = CHAMBER_DEVICE_VISUAL_BOUNDS.rift, focus = CHAMBER_DEVICE_BASES.rift;
    const zoom = 2.2, left = focus.x - 184 / zoom;
    const top = focus.y + (bounds[1] + bounds[3]) / 2 - 330 / zoom;
    canvas.width = 960; canvas.height = 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建样例画布');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderer.canvas, left, top, 960 / zoom, 640 / zoom, 0, 0, 960, 640);
    const actor = renderer.actorBounds;
    const x = Math.max(0, Math.min(960, (actor.x - left) * zoom));
    const y = Math.max(0, Math.min(640, (actor.y - top) * zoom));
    const right = Math.max(x, Math.min(960, (actor.x + actor.width - left) * zoom));
    const bottom = Math.max(y, Math.min(640, (actor.y + actor.height - top) * zoom));
    const actorRegion: ActorRegion = Object.freeze({ x, y, width: right - x, height: bottom - y });
    let disposed = false;
    canvas.dataset.grade = 'low';
    canvas.dataset.renderer = 'production-last-light-unchanged-static-world';
    canvas.dataset.ready = 'true';
    return {
      actorRegion,
      setGrade(next: Grade) { if (!disposed) canvas.dataset.grade = next; },
      setPhase(_phase: Phase) { /* The world is identical in both UI phases. */ },
      setMotion(_enabled: boolean) { /* This study keeps its single idle frame. */ },
      dispose() {
        if (disposed) return;
        disposed = true;
        renderer!.destroy();
        loaded.forEach(image => image.close());
      },
    };
  } catch (error) { renderer?.destroy(); loaded.forEach(image => image.close()); throw error; }
}
