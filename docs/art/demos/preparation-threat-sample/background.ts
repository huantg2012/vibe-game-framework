import { LastLightRenderer, type LastLightFrame, type LastLightRenderImages, type LastLightRenderPack, type LastLightRenderState } from '../../../../src/art/last-light-renderer';
import { CHAMBER_DEVICE_BASES, CHAMBER_DEVICE_VISUAL_BOUNDS, LAST_LIGHT_SPAWN } from '../../../../src/systems/last-light-layout';

export type Grade = 'low' | 'medium' | 'severe';
export type Phase = 'pollution' | 'equipment';

/** Visual proposal only. The production renderer and assets are read-only.
 * New forms represent remote, incomplete folds of the existing exterior, not
 * entities, damage, walkable ground or a preview of the destination world.
 * The source camera and pixel scale stay fixed. Haven, near joints and actor
 * are excluded with the authored opaque-layer identity and actor bounds.
 * Signalis: quiet reading hierarchy; Darkwood: a small human in actual space;
 * HLD: direct marks. No foreign skin, noise veil or full-screen grade tint.
 */
export async function mountBackground(canvas: HTMLCanvasElement) {
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法创建样例画布');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderer.canvas, left, top, 960 / zoom, 640 / zoom, 0, 0, 960, 640);
    const source = ctx.getImageData(0, 0, 960, 640);
    // Same-phase authored depth: reference spawn has zero parallax offset.
    const depthCanvas = document.createElement('canvas'); depthCanvas.width = 960; depthCanvas.height = 640;
    const depthCtx = depthCanvas.getContext('2d', { willReadFrequently: true })!;
    depthCtx.translate(0, 640); depthCtx.scale(1, -1); depthCtx.drawImage(images.depth, 0, 0);
    const depth = depthCtx.getImageData(0, 0, 960, 640).data;
    const actor = renderer.actorBounds;
    const masks = new Uint8Array(960 * 640);
    for (let y = 0; y < 640; y++) for (let x = 0; x < 960; x++) {
      const sx = Math.floor(left + x / zoom), sy = Math.floor(top + y / zoom);
      if (sx < 0 || sx >= 960 || sy < 0 || sy >= 640) continue;
      const index = (sy * 960 + sx) * 4;
      const inActor = sx >= actor.x - 2 && sx <= actor.x + actor.width + 2 && sy >= actor.y - 2 && sy <= actor.y + actor.height + 2;
      // Only empty space/far/middle. Preserve all near/haven material pixels.
      if (depth[index + 2]! < 3 && !inActor) masks[y * 960 + x] = 1;
    }

    // Wide, broken, incomplete planes cut by the real scene. Their common
    // cool charcoal values are derived from the existing exterior family.
    // Increasing severity changes coverage/negative space, not global exposure.
    const grain = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };
    type Point = readonly [number, number];
    // Broken vertical side faces: no connected upper rim resembling a path.
    const inside = (x: number, y: number, corners: readonly Point[]) => {
      let sign = 0;
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i]!, b = corners[(i + 1) % corners.length]!;
        const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        if (cross !== 0) { const next = Math.sign(cross); if (sign && sign !== next) return false; sign = next; }
      }
      return true;
    };
    const grades: Record<Grade, number> = { low: 0, medium: 1, severe: 2 };
    const frames = new Map<Grade, ImageData>();
    for (const name of ['low', 'medium', 'severe'] as const) {
      const grade = grades[name], output = new ImageData(new Uint8ClampedArray(source.data), 960, 640);
      const planes: readonly (readonly Point[])[] = [
        [[-65, 510 - grade * 65], [18 + grade * 8, 529 - grade * 66], [95 + grade * 16, 720], [-60, 720]],
        [[168, 577 - grade * 57], [219, 599 - grade * 50], [141, 720], [63, 720]],
        [[260, 463], [293, 437], [393, 710], [256, 710]],
      ];
      for (let y = 0; y < 640; y++) for (let x = 0; x < 960; x++) {
        if (!masks[y * 960 + x]) continue;
        const px = Math.floor(x / zoom), py = Math.floor(y / zoom);
        const gx = px * zoom, gy = py * zoom;
        for (let fold = 0; fold <= grade; fold++) {
          const corners = planes[fold]!;
          if (!inside(gx, gy, corners)) continue;
          // Light belongs to the side turn, fades vertically; never a bright top.
          const slope = fold === 0 ? .34 : fold === 1 ? -.43 : .37;
          const edgeX = corners[1]![0] + (gy - corners[1]![1]) * slope;
          const width = fold === 0 ? 118 : 70;
          const u = Math.max(0, Math.min(1, (edgeX - gx) / width));
          const facet = u < .32 ? .82 : u < .58 ? 1 : .35;
          const heightFall = Math.max(.35, 1 - (gy - 420) / 380);
          const face = 14 + facet * (33 + grade * 4) * heightFall + (grain(px, py) - .5) * 2;
          const i = (y * 960 + x) * 4, mix = .93;
          output.data[i] = source.data[i]! * (1 - mix) + face * .88 * mix;
          output.data[i + 1] = source.data[i + 1]! * (1 - mix) + face * mix;
          output.data[i + 2] = source.data[i + 2]! * (1 - mix) + face * .94 * mix;
        }
      }
      frames.set(name, output);
    }
    let grade: Grade = 'low', disposed = false;
    function paint() {
      if (!disposed) ctx!.putImageData(frames.get(grade)!, 0, 0);
      canvas.dataset.grade = grade;
    }
    paint();
    canvas.dataset.renderer = 'production-last-light-with-isolated-static-proposal';
    canvas.dataset.ready = 'true';
    return {
      setGrade(next: Grade) { grade = next; paint(); },
      setPhase(_phase: Phase) { /* Static candidate keeps severity in equipment. */ },
      setMotion(_enabled: boolean) { /* No motion or audio in this visual set. */ },
      dispose() { if (disposed) return; disposed = true; renderer!.destroy(); frames.clear(); loaded.forEach(image => image.close()); },
    };
  } catch (error) { renderer?.destroy(); loaded.forEach(image => image.close()); throw error; }
}
