import { HitReaction, observeVisualHits } from '@/entities/hit-reaction';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import { applyFormVisibility, type FormAttachContext, type FormVisual, type FormVisualPose } from '../form-renderer';
import type { PaintBuf } from './genome/buffer';
import type { GenomeCanvas } from './genome/types';
import { ModelAnimationClock, type ModelPhase } from './model-animation';

export interface AnimatedModelRequest {
  seed: number;
  coverage: CoverageId;
  facing4: FormVisualPose['facing4'];
  phase: ModelPhase;
  phase01: number;
  restAmount?: number;
}
export interface AnimatedModel {
  id: string;
  walkCycleMs: number;
  stridePixels: number;
  bake(req: AnimatedModelRequest): { buf: PaintBuf; canvas: GenomeCanvas };
}
let nextTexture = 0;
const FRAME_CACHE_LIMIT = 64;

/** One GPU texture per body; bounded CPU frame reuse, all removed on destruction. */
export function attachAnimatedModel(ctx: FormAttachContext, model: AnimatedModel): FormVisual {
  const initial = model.bake({ seed: ctx.seed, coverage: ctx.form.coverage, facing4: 'down', phase: 'idle', phase01: 0 });
  const { canvas } = initial;
  const key = `${ctx.textureNamespace ?? 'rift'}-${model.id}-${nextTexture++}`;
  const texture = ctx.scene.textures.createCanvas(key, canvas.w, canvas.h);
  if (!texture) throw new Error(`Could not allocate ${model.id} texture`);
  const image = ctx.scene.add.image(0, 0, key).setDepth(ctx.depth).setOrigin(canvas.originX / canvas.w, canvas.originY / canvas.h);
  image.setScale(ctx.displayScale ?? 1);
  const context = texture.getContext();
  const pixels = context.createImageData(canvas.w, canvas.h);
  const reaction = new HitReaction();
  const stopHits = ctx.subjectId ? observeVisualHits(ctx.subjectId, reaction.receive) : () => {};
  const clock = new ModelAnimationClock(model.walkCycleMs, model.stridePixels);
  const cache = new Map<string, Uint8ClampedArray>();
  cache.set(`${ctx.form.coverage}:down:idle:0:0`, initial.buf.data);
  let lastFrame = '';
  let coverageOverride: CoverageId | null = null;
  let lastPose: FormVisualPose | null = null;
  let destroyed = false;
  let restAmount = 0;
  let receivedActivity = false;
  const visual: FormVisual = {
    update(pose) {
      if (destroyed) return;
      lastPose = pose;
      const frame = clock.advance(pose);
      const committed = pose.attack && pose.attack.phase !== 'idle';
      const targetRest = committed ? 0 : pose.activity?.phase === 'rest' ? 1
        : pose.activity?.phase === 'waking' ? 1 - pose.activity.progress : 0;
      const step = Math.max(0, Math.min(100, pose.deltaMs)) / 240;
      if (pose.activity && !receivedActivity) {
        restAmount = targetRest;
        receivedActivity = true;
      } else restAmount += Math.sign(targetRest - restAmount) * Math.min(Math.abs(targetRest - restAmount), step);
      const hit = reaction.advance(pose.deltaMs);
      image.setPosition(pose.x + hit.x, pose.y + hit.y);
      image.setScale((ctx.displayScale ?? 1) * hit.scaleX, (ctx.displayScale ?? 1) * hit.scaleY);
      applyFormVisibility(image, pose.visibility);
      if (pose.visibility <= 0) return;
      const sample = Math.min(29, Math.floor(frame.progress * 30));
      const coverage = coverageOverride ?? ctx.form.coverage;
      const restSample = Math.round(restAmount * 10);
      const frameKey = `${coverage}:${frame.facing}:${frame.phase}:${sample}:${restSample}`;
      if (lastFrame === frameKey) return;
      let data = cache.get(frameKey);
      if (data) cache.delete(frameKey);
      else {
        const baked = model.bake({ seed: ctx.seed, coverage, facing4: frame.facing, phase: frame.phase, phase01: sample / 29, restAmount: restSample / 10 });
        if (baked.canvas.w !== canvas.w || baked.canvas.h !== canvas.h
          || baked.canvas.originX !== canvas.originX || baked.canvas.originY !== canvas.originY) {
          throw new Error(`${model.id}: animated registration changed`);
        }
        data = baked.buf.data;
      }
      cache.set(frameKey, data);
      if (cache.size > FRAME_CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      pixels.data.set(data);
      context.putImageData(pixels, 0, 0);
      texture.refresh();
      lastFrame = frameKey;
    },
    setGroundDepth(depth) {
      if (!destroyed) image.setDepth(depth);
    },
    setReviewCoverage(coverage) {
      if (!import.meta.env.DEV || destroyed) return;
      coverageOverride = coverage;
      lastFrame = '';
      if (lastPose) visual.update({ ...lastPose, deltaMs: 0 });
    },
    getFlashSource() {
      return { textureKey: key, originX: image.originX, originY: image.originY, scaleX: image.scaleX, scaleY: image.scaleY };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopHits();
      cache.clear();
      image.destroy();
      ctx.scene.textures.remove(key);
    },
  };
  visual.update({ x: 0, y: 0, facing4: 'down', moving: false, visibility: 1, signal: 'idle', deltaMs: 0 });
  return visual;
}
